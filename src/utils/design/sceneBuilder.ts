import * as THREE from "three";
import type { SceneData, ObjectData, PanelPlacement } from "./types";

const DEG = Math.PI / 180;
// const ROD_SECTION = 0.03;
// Lipped C-channel ("C-purlin") cross-section shared by pillar / rafter / purlin.
// web  = closed back plate; depth = flange length (the mouth opens along this);
// lip  = inward return at the open mouth; thk = wall thickness. Values in metres.
const LIPPED_WEB = 0.07;    // 70 mm — closed back (web)
const LIPPED_DEPTH = 0.04;  // 40 mm — flange depth; mouth opens along this axis
const LIPPED_LIP = 0.015;   // 15 mm — inward return lip at the open mouth
const LIPPED_THK = 0.002;   // 2 mm — wall thickness
const BASE_SIZE = 0.15;
const BASE_THICKNESS = 0.15;
const PILLAR_STEP = 0.6096;      // 2 feet in meters — quantised pillar height increment
const MAX_N_STEPS = 2;           // pillar height = frontPillarHeight + n*PILLAR_STEP, n=0..2
// Vertical (world Y) drop applied to the panel + purlin assembly together.
// 0  → honest perpendicular stack (panel on purlin on rafter, ~5–6 cm above pillar top).
// ROD_SECTION → collapses purlin onto slope line (embedded with rafter) and brings
//   the panel essentially flush with the pillar top.
// ROD_SECTION + 0.02 → panel bottom slightly BELOW pillar top (single flat plane look).
// const STACK_DROP = ROD_SECTION;

/**
 * Compute the effective tilt (degrees) so that every pillar line height
 * equals frontPillarHeight + n * PILLAR_STEP  (n = 0, 1, or 2).
 * For 3 pillar lines the middle must also land on a step, so only n=0 or 2
 * at the back line are valid (middle would be n/2).
 */
function computeEffectiveTiltDeg(
    tiltDeg: number,
    maxPillarSpan: number,
    nSideViewPillars: number,
): number {
    if (Math.abs(tiltDeg) < 0.01 || maxPillarSpan <= 0.001) return tiltDeg;
    const absSinT = Math.sin(Math.abs(tiltDeg) * DEG);
    const TOL = 0.005;
    for (let n = MAX_N_STEPS; n >= 1; n--) {
        if (nSideViewPillars >= 3 && n % 2 !== 0) continue;
        if (n * PILLAR_STEP <= maxPillarSpan * absSinT + TOL) return tiltDeg;
    }
    return 0;
}

/** Compute the actual pillar span for a given effective tilt. */
function computeActualPillarSpan(
    tiltDeg: number,
    maxPillarSpan: number,
    nSideViewPillars: number,
): number {
    if (Math.abs(tiltDeg) < 0.01 || maxPillarSpan <= 0.001) return maxPillarSpan;
    const absSinT = Math.sin(Math.abs(tiltDeg) * DEG);
    const TOL = 0.005;
    for (let n = MAX_N_STEPS; n >= 1; n--) {
        if (nSideViewPillars >= 3 && n % 2 !== 0) continue;
        const required = (n * PILLAR_STEP) / absSinT;
        if (required <= maxPillarSpan + TOL) return required;
    }
    return maxPillarSpan;
}

/**
 * For sections where the standard quantized tilt is not achievable (e.g. remainder sections),
 * compute an adjusted tilt and pillar span that respects overhang.
 *
 * Priority: 1) quantized pillar heights  2) overhang maintained  3) tilt closest to requested  4) P2P can vary
 */
function computeAdjustedSectionTilt(
    requestedTiltDeg: number,
    sectionExtent: number,
    overhangLengthM: number,
    nSideViewPillars: number,
): { tiltDeg: number; pillarSpan: number } {
    const availableSpan = sectionExtent - 2 * overhangLengthM;
    if (availableSpan <= 0.001) return { tiltDeg: 0, pillarSpan: 0 };
    if (Math.abs(requestedTiltDeg) < 0.01) return { tiltDeg: 0, pillarSpan: availableSpan };

    const absTilt = Math.abs(requestedTiltDeg);
    const sign = requestedTiltDeg >= 0 ? 1 : -1;
    const absSinReq = Math.sin(absTilt * DEG);

    // Candidate: n=0 → flat, pillar span = available span
    let bestTilt = 0;
    let bestSpan = availableSpan;
    let bestErr = absTilt;

    for (let n = MAX_N_STEPS; n >= 1; n--) {
        if (nSideViewPillars >= 3 && n % 2 !== 0) continue;

        const idealSpan = (n * PILLAR_STEP) / absSinReq;
        if (idealSpan <= availableSpan + 0.005) {
            bestTilt = sign * absTilt;
            bestSpan = idealSpan;
            bestErr = 0;
            break;
        } else {
            const ratio = (n * PILLAR_STEP) / availableSpan;
            if (ratio > 1.0) continue;
            const achievableTilt = Math.asin(ratio) * (180 / Math.PI);
            if (achievableTilt > 25) continue;
            const err = Math.abs(absTilt - achievableTilt);
            if (err < bestErr) {
                bestErr = err;
                bestTilt = sign * achievableTilt;
                bestSpan = availableSpan;
            }
        }
    }

    return { tiltDeg: bestTilt, pillarSpan: bestSpan };
}

// ── Materials ──
const MATS = {
  roof: new THREE.MeshStandardMaterial({ color: 0xf0ece6, roughness: 0.7, metalness: 0.1, side: THREE.DoubleSide }),
  cuboid: new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.6, metalness: 0.1 }),
  cylinder: new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 0.6, metalness: 0.15 }),
  wall: new THREE.MeshStandardMaterial({ color: 0xd9d4cc, roughness: 0.7, metalness: 0.1 }),
  polygon: new THREE.MeshStandardMaterial({ color: 0x26a69a, roughness: 0.5, metalness: 0.1 }),
  panelSurface: () => new THREE.MeshPhongMaterial({ color: 0x000000, specular: 0xbbbbbb, shininess: 80 }),
  panelFrame: new THREE.MeshStandardMaterial({ color: 0xc0c0c0, roughness: 0.3, metalness: 0.7 }),
  // Bright galvanised-steel: light silver, shiny, lightly reflective. Kept
  // metalness moderate so it stays bright even without a scene environment map
  // (pure metal reflects the env; with none it renders dark). Low roughness
  // gives crisp specular highlights for the shine. envMapIntensity boosts any
  // reflection if a scene.environment is present.
  structure: new THREE.MeshStandardMaterial({ color: 0xd8dbdf, roughness: 0.2, metalness: 0.55, envMapIntensity: 1.5 }),
  base: new THREE.MeshPhongMaterial({ color: 0x3a3a3a }),
};

// ── Tag → model file mapping ──
const TAG_MODEL_MAP: Record<string, string> = {
  neem:              "/models/tagged/neem.glb",
  mango:             "/models/tagged/mango.glb",
  pine:              "/models/tagged/pine.glb",
  coconut:           "/models/tagged/cocnout.glb",
  chimney:           "/models/tagged/chimney.glb",
  chimney_box:       "/models/tagged/chimney_box.glb",
  cylinder_tank:     "/models/tagged/cylinder_tank.glb",
  horizontal_tank:   "/models/tagged/horizontal_tank.glb",
  rectangular_tank:  "/models/tagged/rectangular_tank.glb",
  overhead_tank:     "/models/tagged/overhead_tank.glb",
  tanker:            "/models/tagged/overhead_tank.glb",
  dish:              "/models/tagged/Dish.glb",
  skylight:          "/models/tagged/skylight.glb",
  mumtee:            "/models/tagged/mumtee_2.glb",
  mumtee_2:          "/models/tagged/mumtee_2.glb",
};

/* ================================================================== */
/*  Shared GLTFLoader + DRACOLoader + persistent model cache          */
/* ================================================================== */
let _gltfLoader: any = null;
let _loaderInitP: Promise<any> | null = null;
const _modelCache = new Map<string, THREE.Group>();
const _modelBoundsCache = new Map<string, { size: THREE.Vector3; center: THREE.Vector3; minY: number }>();

/** Lazily init a single shared GLTFLoader+DRACOLoader (reused across all calls). */
function getGltfLoader(): Promise<any> {
  if (_gltfLoader) return Promise.resolve(_gltfLoader);
  if (_loaderInitP) return _loaderInitP;
  _loaderInitP = (async () => {
    const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
      import("three/addons/loaders/GLTFLoader.js"),
      import("three/addons/loaders/DRACOLoader.js"),
    ]);
    const draco = new DRACOLoader();
    draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    draco.preload();                     // start WASM download immediately
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    _gltfLoader = loader;
    return loader;
  })();
  return _loaderInitP;
}

/**
 * Prefetch every known .glb file into the HTTP cache so subsequent
 * GLTFLoader.loadAsync() resolves from disk (instant). Also kicks off
 * lazy GLTFLoader + DRACO WASM init in parallel.
 *
 * Safe to call before any scene data is available — it does not parse
 * the GLBs, only warms the network cache. Idempotent.
 */
let _prefetchStarted = false;
export function prefetchAllModels(): void {
  if (_prefetchStarted) return;
  _prefetchStarted = true;
  // Kick off loader + WASM init in parallel with network fetches
  void getGltfLoader();
  const allPaths = [
    "/models/panel/blue panel monofacial.glb",
    "/models/tree/tree_v2.glb",
    ...Object.values(TAG_MODEL_MAP),
  ];
  for (const p of allPaths) {
    // Low-priority background fetch; result is discarded — only the
    // HTTP cache entry matters. Errors are swallowed silently.
    try {
      fetch(p, { cache: "force-cache", priority: "low" } as RequestInit).catch(() => {});
    } catch { /* ignore */ }
  }
}

// Paths that should NOT be decimated (tanks — need full quality)
const SKIP_DECIMATE = new Set([
  TAG_MODEL_MAP.cylinder_tank,
  TAG_MODEL_MAP.horizontal_tank,
  TAG_MODEL_MAP.rectangular_tank,
  TAG_MODEL_MAP.overhead_tank,
]);

// Paths that skip progressive quality (shown at full quality immediately)
const SKIP_PROGRESSIVE = new Set([TAG_MODEL_MAP.neem]);

// Low-quality model cache (30% triangles) for progressive loading
const _modelCacheLow = new Map<string, THREE.Group>();

// Shared placeholder materials (instant render while .glb downloads)
const PLACEHOLDER_TREE_MAT = new THREE.MeshStandardMaterial({ color: 0x4a7c4a, roughness: 0.9 });
const PLACEHOLDER_OBJ_MAT = new THREE.MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.7, metalness: 0.1 });
const UPGRADE_FULL_AFTER_MS = 3000;

/**
 * Build a unit-cube placeholder Group representing an object before its
 * .glb has loaded. Cube spans (0,0,0) → (sx, sy, sz) in local space, so it
 * sits on the wrapper origin like the loaded model does.
 */
function buildPlaceholderBox(sx: number, sy: number, sz: number, mat: THREE.Material, castShadow = true): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(Math.max(sx, 0.05), Math.max(sy, 0.05), Math.max(sz, 0.05));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, sy / 2, 0);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  g.add(mesh);
  return g;
}

/** Decimate all mesh geometries in a group to a given quality fraction (0–1). */
function decimateGroup(group: THREE.Group, quality: number): void {
  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const geo = (child as THREE.Mesh).geometry;
      if (geo.index && geo.index.count > 300) {
        const oldIdx = geo.index.array;
        const triCount = Math.floor(oldIdx.length / 3);
        const keepCount = Math.max(Math.floor(triCount * quality), 1);
        const step = triCount / keepCount;
        const newIndices: number[] = [];
        for (let i = 0; i < keepCount; i++) {
          const triIdx = Math.min(Math.floor(i * step), triCount - 1) * 3;
          newIndices.push(oldIdx[triIdx], oldIdx[triIdx + 1], oldIdx[triIdx + 2]);
        }
        geo.setIndex(newIndices);
      }
    }
  });
}

/** Load a model by path — caches full quality + low quality (30%) versions. */
async function loadModel(path: string): Promise<THREE.Group> {
  const cached = _modelCache.get(path);
  if (cached) return cached;
  const loader = await getGltfLoader();
  const gltf = await loader.loadAsync(path);
  const scene = gltf.scene as THREE.Group;
  // Pre-compute and cache bounds from full-quality model
  const box = new THREE.Box3().setFromObject(scene);
  _modelBoundsCache.set(path, {
    size: box.getSize(new THREE.Vector3()),
    center: box.getCenter(new THREE.Vector3()),
    minY: box.min.y,
  });
  // Set tree material properties on the template once (not per-clone)
  scene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (mat && mat.alphaTest === 0) { mat.alphaTest = 0.5; mat.transparent = false; mat.depthWrite = true; mat.side = THREE.DoubleSide; }
    }
  });

  // Cache full-quality template
  _modelCache.set(path, scene);
  // Create low-quality version (30% triangles) for progressive loading
  if (!SKIP_DECIMATE.has(path) && !SKIP_PROGRESSIVE.has(path)) {
    const lowClone = scene.clone();
    // Clone geometries so decimation doesn't affect the full-quality template
    lowClone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).geometry = (child as THREE.Mesh).geometry.clone();
      }
    });
    decimateGroup(lowClone, 0.3);
    _modelCacheLow.set(path, lowClone);
  }
  return scene;
}

/**
 * Pre-warm all models that a scene will need. Call early (in parallel with
 * texture loading) so models are cached by the time buildTrees / buildTaggedObjects run.
 */
export function preloadModels(data: SceneData): Promise<void> {
  const paths = new Set<string>();
  // Trees
  for (const tree of Object.values(data.objects.tree || {})) {
    const tag = (tree as any).tag || "";
    paths.add(TAG_MODEL_MAP[tag] || "/models/tree/tree_v2.glb");
  }
  // Tagged objects
  for (const obj of Object.values(data.objects.cuboid || {})) {
    if ((obj as any).tag && TAG_MODEL_MAP[(obj as any).tag]) paths.add(TAG_MODEL_MAP[(obj as any).tag]);
  }
  for (const obj of Object.values(data.objects.cylinder || {})) {
    if ((obj as any).tag && TAG_MODEL_MAP[(obj as any).tag]) paths.add(TAG_MODEL_MAP[(obj as any).tag]);
  }
  if (paths.size === 0) return Promise.resolve();
  // Fire all loads in parallel — each caches its result
  return Promise.all([...paths].map((p) => loadModel(p).catch(() => null))).then(() => {});
}

// ── Lipped C-channel ("C-purlin") geometry ──
// Cross-section: a `web` (closed back plate) with two flanges of `depth`, each
// ending in an inward return `lip`, constant wall `thk`. After build the member
// runs along local +Y, the open MOUTH faces local +X (web back at -X), and the
// `web` dimension spans local Z. Point it in the scene with orientMember().
function createLippedCChannelGeo(web: number, depth: number, lip: number, thk: number, length: number): THREE.ExtrudeGeometry {
  const hw = web / 2;     // half web — spans profile Y
  const hd = depth / 2;   // half depth — spans profile X, mouth at +X
  const xL = -hd, xLin = -hd + thk;   // web (back) outer / inner
  const xR = hd, xRin = hd - thk;     // mouth-side flange tip / lip inner
  const yT = hw, yTin = hw - thk;     // top flange outer / inner
  const yB = -hw, yBin = -hw + thk;   // bottom flange outer / inner
  const shape = new THREE.Shape();
  shape.moveTo(xL, yB);          // web/bottom-flange back corner
  shape.lineTo(xR, yB);          // bottom flange outer edge → mouth side
  shape.lineTo(xR, yB + lip);    // up the bottom return lip (outer)
  shape.lineTo(xRin, yB + lip);  // across to inner lip face
  shape.lineTo(xRin, yBin);      // down to bottom flange inner
  shape.lineTo(xLin, yBin);      // back along bottom flange inner to web
  shape.lineTo(xLin, yTin);      // up the web inner face
  shape.lineTo(xRin, yTin);      // out along top flange inner
  shape.lineTo(xRin, yT - lip);  // up to inner top lip
  shape.lineTo(xR, yT - lip);    // across to outer
  shape.lineTo(xR, yT);          // up the top return lip (outer)
  shape.lineTo(xL, yT);          // top flange outer edge → web
  shape.closePath();             // down the web (back) outer face
  const geo = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -length / 2, 0);
  geo.computeVertexNormals();
  return geo;
}

// Orient a member built by createLippedCChannelGeo (local length +Y, mouth +X):
// align its length to `dir`, then roll about that axis so the mouth points as
// close as possible to `mouthHint` (its component perpendicular to dir).
function orientMember(mesh: THREE.Object3D, dir: THREE.Vector3, mouthHint: THREE.Vector3): void {
  const d = dir.clone().normalize();
  const q1 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  const mouth0 = new THREE.Vector3(1, 0, 0).applyQuaternion(q1); // current mouth, ⟂ d
  const t = mouthHint.clone().sub(d.clone().multiplyScalar(mouthHint.dot(d))); // desired, ⟂ d
  if (t.lengthSq() < 1e-9) { mesh.setRotationFromQuaternion(q1); return; }
  t.normalize();
  const cross = new THREE.Vector3().crossVectors(mouth0, t);
  const phi = Math.atan2(cross.dot(d), mouth0.dot(t));
  const q2 = new THREE.Quaternion().setFromAxisAngle(d, phi);
  mesh.setRotationFromQuaternion(q2.multiply(q1));
}

// ── Coordinate converter ──
export interface CoordConverter {
  toX: (v: number) => number;    // for object centers
  toZ: (v: number) => number;
  roofToX: (v: number) => number; // for roof polygon points
  roofToZ: (v: number) => number;
  panelToX: (v: number) => number; // for panel/group centres
  panelToZ: (v: number) => number;
  pxToMX: (v: number) => number;  // raw pixel->meter
  pxToMY: (v: number) => number;
  isPixels: boolean;
}

export function makeCoordConverter(data: SceneData, imgW: number, imgH: number): CoordConverter {
  const W = data.width_meters;
  const H = data.height_meters;

  // The API always returns coordinates in image-pixel space.
  // Convert to meters using: (pixelValue / imagePixelDimension) * meterDimension
  // This matches the mobile app's pxToMX/pxToMY exactly.
  const pxToMX = (v: number) => (v / Math.max(imgW, 1)) * W;
  const pxToMY = (v: number) => (v / Math.max(imgH, 1)) * H;

  // Detect if data is already in meters (e.g. pre-converted)
  // by checking if all roof points fit within meter bounds
  const allPts: number[] = [];
  for (const roof of Object.values(data.roofs)) {
    for (const pt of roof.roof) { allPts.push(pt[0], pt[1]); }
  }
  const roofsInMeters = W > 0 && H > 0 && allPts.length > 0 &&
    allPts.every((v) => v >= 0 && v <= Math.max(W, H) * 1.1);

  // For objects, do the same check with object centers
  const objCoords: number[] = [];
  for (const dict of Object.values(data.objects)) {
    for (const obj of Object.values(dict as Record<string, ObjectData>)) {
      if (obj.center_x != null) objCoords.push(obj.center_x, obj.center_y);
    }
  }
  const objsInMeters = W > 0 && H > 0 && (objCoords.length === 0 ||
    objCoords.every((v) => v >= 0 && v <= Math.max(W, H) * 1.1));

  // For panel centres, do the same check. New visits store them in metres
  // (resolution-independent); older visits stored image pixels.
  const panelCoords: number[] = [];
  for (const p of (data.panel_placements || [])) {
    if (p.center_x != null) panelCoords.push(p.center_x, p.center_y);
  }
  const panelsInMeters = W > 0 && H > 0 && panelCoords.length > 0 &&
    panelCoords.every((v) => v >= 0 && v <= Math.max(W, H) * 1.1);

  // Roof converter
  const roofToX = roofsInMeters ? (v: number) => v : pxToMX;
  const roofToZ = roofsInMeters ? (v: number) => v : pxToMY;

  // Object converter (centers may be pixels or metres)
  const toX = objsInMeters ? (v: number) => v : pxToMX;
  const toZ = objsInMeters ? (v: number) => v : pxToMY;

  // Panel converter — metres (identity) for new visits, pixel->metre for legacy.
  const panelToX = panelsInMeters ? (v: number) => v : pxToMX;
  const panelToZ = panelsInMeters ? (v: number) => v : pxToMY;

  return {
    toX, toZ,
    isPixels: !objsInMeters,
    pxToMX, pxToMY,
    roofToX, roofToZ,
    panelToX, panelToZ,
  } as CoordConverter;
}

// ── Ground ──
export function buildGround(W: number, H: number, texture: THREE.Texture | null): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(W, H);
  geo.rotateX(-Math.PI / 2);
  geo.translate(W / 2, 0, H / 2);
  let mat: THREE.Material;
  if (texture) {
    texture.flipY = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  } else {
    mat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.userData.isGround = true;
  return mesh;
}

// ── Roofs ──
export function buildRoofs(data: SceneData, conv: CoordConverter): THREE.Group {
  const group = new THREE.Group();
  group.name = "roofs";
  Object.entries(data.roofs).forEach(([id, roof]) => {
    const pts = roof.roof;
    if (!pts || pts.length < 3) return;
    const shape = new THREE.Shape();
    shape.moveTo(conv.roofToX(pts[0][0]), -conv.roofToZ(pts[0][1]));
    for (let i = 1; i < pts.length; i++) shape.lineTo(conv.roofToX(pts[i][0]), -conv.roofToZ(pts[i][1]));
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: roof.height, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, MATS.roof);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { isRoof: true, roofId: id };
    group.add(mesh);
  });
  return group;
}

// ── Roof overlays ──
export function buildRoofOverlays(data: SceneData, conv: CoordConverter, texture: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  group.name = "roofOverlays";
  const W = data.width_meters, H = data.height_meters;
  const overlayMat = new THREE.MeshPhongMaterial({
    map: texture, shininess: 0, specular: 0x000000,
    depthWrite: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  Object.values(data.roofs).forEach((roof) => {
    const pts = roof.roof;
    if (!pts || pts.length < 3) return;
    const shape = new THREE.Shape();
    shape.moveTo(conv.roofToX(pts[0][0]), -conv.roofToZ(pts[0][1]));
    for (let i = 1; i < pts.length; i++) shape.lineTo(conv.roofToX(pts[i][0]), -conv.roofToZ(pts[i][1]));
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    const posAttr = geo.getAttribute("position");
    const uvs = new Float32Array(posAttr.count * 2);
    for (let i = 0; i < posAttr.count; i++) {
      uvs[i * 2] = posAttr.getX(i) / W;
      uvs[i * 2 + 1] = 1 - (-posAttr.getY(i) / H);
    }
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    const mesh = new THREE.Mesh(geo, overlayMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = roof.height + 0.05;
    mesh.receiveShadow = true;
    mesh.visible = false;
    group.add(mesh);
  });
  return group;
}

// ── Objects (cuboids, cylinders, walls, polygons) — NOT trees ──
export function buildObjects(data: SceneData, conv: CoordConverter): THREE.Group {
  const group = new THREE.Group();
  group.name = "objects";
  const addObj = (obj: ObjectData, type: string) => {
    if (obj.tag && TAG_MODEL_MAP[obj.tag]) return;

    const cast = obj.cast_shadow !== false;
    const baseY = obj.z_init || 0;
    const h = (obj.z_end || 0) - baseY;
    if (h <= 0 && type !== "wall") return;
    let mesh: THREE.Mesh | null = null;

    if (type === "cuboid" && obj.length && obj.width) {
      const geo = new THREE.BoxGeometry(obj.length, h, obj.width);
      mesh = new THREE.Mesh(geo, MATS.cuboid);
      mesh.position.set(conv.toX(obj.center_x), baseY + h / 2, conv.toZ(obj.center_y));
      if (obj.angle) mesh.rotation.y = -(obj.angle * DEG);
    } else if (type === "cylinder" && obj.radius) {
      const r = obj.radius;
      const geo = new THREE.CylinderGeometry(r, r, h, 16);
      mesh = new THREE.Mesh(geo, MATS.cylinder);
      mesh.position.set(conv.toX(obj.center_x), baseY + h / 2, conv.toZ(obj.center_y));
    } else if (type === "wall" && obj.p1 && obj.p2 && obj.thickness) {
      const W = data.width_meters, H = data.height_meters;
      const wallInMeters = W > 0 && H > 0 &&
        [obj.p1, obj.p2].every((p) => p![0] >= 0 && p![1] >= 0 && p![0] <= Math.max(W, H) * 1.1 && p![1] <= Math.max(W, H) * 1.1);
      const wallToX = wallInMeters ? (v: number) => v : conv.pxToMX;
      const wallToZ = wallInMeters ? (v: number) => v : conv.pxToMY;
      const x1 = wallToX(obj.p1[0]), z1 = wallToZ(obj.p1[1]);
      const x2 = wallToX(obj.p2[0]), z2 = wallToZ(obj.p2[1]);
      const wLen = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
      const wH = h > 0 ? h : 1;
      if (wLen <= 0) return;
      const geo = new THREE.BoxGeometry(wLen, wH, obj.thickness);
      mesh = new THREE.Mesh(geo, MATS.wall);
      mesh.position.set((x1 + x2) / 2, baseY + wH / 2, (z1 + z2) / 2);
      mesh.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    } else if (type === "polygon" && obj.polygon && obj.polygon.length >= 3) {
      const shape = new THREE.Shape();
      shape.moveTo(conv.toX(obj.polygon[0][0]), -conv.toZ(obj.polygon[0][1]));
      for (let i = 1; i < obj.polygon.length; i++) shape.lineTo(conv.toX(obj.polygon[i][0]), -conv.toZ(obj.polygon[i][1]));
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(h, 0.1), bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      mesh = new THREE.Mesh(geo, MATS.polygon);
      mesh.position.y = baseY;
    }
    if (mesh) { mesh.castShadow = cast; mesh.receiveShadow = true; mesh.userData.objectType = type; group.add(mesh); }
  };

  for (const obj of Object.values(data.objects.cuboid || {})) addObj(obj, "cuboid");
  for (const obj of Object.values(data.objects.cylinder || {})) addObj(obj, "cylinder");
  for (const obj of Object.values(data.objects.wall || {})) addObj(obj, "wall");
  for (const obj of Object.values(data.objects.polygon || {})) addObj(obj, "polygon");
  return group;
}

// ── Walls only ──
export function buildWalls(data: SceneData, conv: CoordConverter): THREE.Group {
  const group = new THREE.Group();
  group.name = "walls";
  for (const obj of Object.values(data.objects.wall || {})) {
    if (!obj.p1 || !obj.p2 || !obj.thickness) continue;
    const cast = obj.cast_shadow !== false;
    const baseY = obj.z_init || 0;
    const h = (obj.z_end || 0) - baseY;
    const W = data.width_meters, H = data.height_meters;
    const wallInMeters = W > 0 && H > 0 &&
      [obj.p1, obj.p2].every((p) => p![0] >= 0 && p![1] >= 0 && p![0] <= Math.max(W, H) * 1.1 && p![1] <= Math.max(W, H) * 1.1);
    const wallToX = wallInMeters ? (v: number) => v : conv.pxToMX;
    const wallToZ = wallInMeters ? (v: number) => v : conv.pxToMY;
    const x1 = wallToX(obj.p1[0]), z1 = wallToZ(obj.p1[1]);
    const x2 = wallToX(obj.p2[0]), z2 = wallToZ(obj.p2[1]);
    const wLen = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
    const wH = h > 0 ? h : 1;
    if (wLen <= 0) continue;
    const geo = new THREE.BoxGeometry(wLen, wH, obj.thickness);
    const mesh = new THREE.Mesh(geo, MATS.wall);
    mesh.position.set((x1 + x2) / 2, baseY + wH / 2, (z1 + z2) / 2);
    mesh.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    mesh.castShadow = cast; mesh.receiveShadow = true;
    mesh.userData.objectType = "wall";
    group.add(mesh);
  }
  return group;
}

// ── Tagged objects ──
export async function buildTaggedObjects(data: SceneData, parentGroup: THREE.Group, conv: CoordConverter): Promise<void> {
  const tagged: { obj: ObjectData; type: string }[] = [];
  for (const obj of Object.values(data.objects.cuboid || {})) {
    if (obj.tag && TAG_MODEL_MAP[obj.tag]) tagged.push({ obj, type: "cuboid" });
  }
  for (const obj of Object.values(data.objects.cylinder || {})) {
    if (obj.tag && TAG_MODEL_MAP[obj.tag]) tagged.push({ obj, type: "cylinder" });
  }
  if (tagged.length === 0) return;

  const buildStart = performance.now();
  const byPath = new Map<string, { wrapper: THREE.Group; obj: ObjectData; targetW: number; targetD: number; h: number; castShadow: boolean }[]>();

  for (const { obj } of tagged) {
    const modelPath = TAG_MODEL_MAP[obj.tag!];
    const baseY = obj.z_init || 0;
    const h = (obj.z_end || 0) - baseY;
    if (h <= 0) continue;

    const targetW = obj.length ?? (obj.radius ? obj.radius * 2 : 1);
    const targetD = obj.width ?? (obj.radius ? obj.radius * 2 : 1);
    const castShadow = obj.cast_shadow !== false;

    const wrapper = new THREE.Group();
    wrapper.position.set(conv.toX(obj.center_x), baseY, conv.toZ(obj.center_y));
    if (obj.angle) wrapper.rotation.y = -(obj.angle * DEG);
    wrapper.add(buildPlaceholderBox(targetW, h, targetD, PLACEHOLDER_OBJ_MAT, castShadow));
    parentGroup.add(wrapper);

    if (!byPath.has(modelPath)) byPath.set(modelPath, []);
    byPath.get(modelPath)!.push({ wrapper, obj, targetW, targetD, h, castShadow });
  }

  for (const [modelPath, entries] of byPath) {
    void (async () => {
      try { await loadModel(modelPath); } catch { return; }
      const bounds = _modelBoundsCache.get(modelPath);
      if (!bounds) return;

      const placeFromTemplate = (template: THREE.Group, entry: typeof entries[0]) => {
        const inst = template.clone();
        const sX = entry.targetW / bounds.size.x;
        const sY = entry.h / bounds.size.y;
        const sZ = entry.targetD / bounds.size.z;
        inst.scale.set(sX, sY, sZ);
        inst.position.set(-bounds.center.x * sX, -bounds.minY * sY, -bounds.center.z * sZ);
        inst.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) { (c as THREE.Mesh).castShadow = entry.castShadow; (c as THREE.Mesh).receiveShadow = true; }
        });
        return inst;
      };

      const lowTemplate = _modelCacheLow.get(modelPath) || _modelCache.get(modelPath);
      if (!lowTemplate) return;
      for (const entry of entries) {
        if (!entry.wrapper.parent) continue;
        const inst = placeFromTemplate(lowTemplate, entry);
        while (entry.wrapper.children.length) entry.wrapper.remove(entry.wrapper.children[0]);
        entry.wrapper.add(inst);
      }

      if (!_modelCacheLow.has(modelPath)) return;
      const elapsed = performance.now() - buildStart;
      const delay = Math.max(0, UPGRADE_FULL_AFTER_MS - elapsed);
      setTimeout(() => {
        const fullTemplate = _modelCache.get(modelPath);
        if (!fullTemplate) return;
        let i = 0;
        const upgradeNext = () => {
          if (i >= entries.length) return;
          const entry = entries[i++];
          if (!entry.wrapper.parent) { requestAnimationFrame(upgradeNext); return; }
          const inst = placeFromTemplate(fullTemplate, entry);
          while (entry.wrapper.children.length) entry.wrapper.remove(entry.wrapper.children[0]);
          entry.wrapper.add(inst);
          requestAnimationFrame(upgradeNext);
        };
        upgradeNext();
      }, delay);
    })();
  }
}

// ── Panels ──
export function buildPanels(data: SceneData, conv: CoordConverter): THREE.Group {
  const group = new THREE.Group();
  group.name = "panels";
  if (!data.panel_spec || !data.panel_placements?.length) return group;
  const angleSouthDeg = data.angle_south_vertical_deg || 0;

  const spec = data.panel_spec;
  const lengthM = spec.length / 1000;
  const widthM = spec.width / 1000;
  const roofArr = Object.values(data.roofs);

  const grouped: Record<string, PanelPlacement[]> = {};
  const ungrouped: PanelPlacement[] = [];
  for (const p of data.panel_placements) {
    if (p.group_id && data.panel_groups[p.group_id]) {
      (grouped[p.group_id] ??= []).push(p);
    } else {
      ungrouped.push(p);
    }
  }

  for (const panel of ungrouped) {
    const ori = panel.orientation || "landscape";
    const ph = panel.front_pillar_height ?? 1.21;
    const rawTilt = panel.tilt_angle ?? 17;
    const ang = panel.angle || 0;
    const normAngle = ((ang % 360) + 360) % 360;
    const isLandscape = ori === "landscape";
    let tiltDeg: number;
    if (isLandscape) {
      const inWorkingRange = normAngle >= 90 && normAngle <= 270;
      tiltDeg = inWorkingRange ? rawTilt : -rawTilt;
    } else {
      tiltDeg = -rawTilt;
    }
    const ovhW = ((panel.overhang_module_width ?? 100) / 1000);
    const ovhL = ((panel.overhang_module_length ?? 0) / 1000);
    const rafterOvh = panel.rafter_overhang ?? 0.2;
    const purlinOvh = panel.purlin_overhang ?? 0.2;
    const sx = conv.panelToX(panel.center_x);
    const sz = conv.panelToZ(panel.center_y);
    const roofH = panel.roof_idx >= 0 && panel.roof_idx < roofArr.length ? roofArr[panel.roof_idx].height : 0;

    const outerGroup = new THREE.Group();
    outerGroup.position.set(sx, roofH + ph, sz);
    outerGroup.rotation.y = -ang * DEG;

    const tiltGroup = new THREE.Group();
    const halfL = lengthM / 2, halfW = widthM / 2;
    const panelEdges = ori === "portrait" ? [-halfL, halfL] : [-halfW, halfW];
    const preTilt = [panelEdges[0] + ovhL + rafterOvh, panelEdges[1] - ovhL - rafterOvh];

    const pillarSpan = preTilt[1] - preTilt[0];
    let effectiveTiltDeg = computeEffectiveTiltDeg(tiltDeg, pillarSpan, 2);
    {
      const bph = panel.back_pillar_height;
      if (typeof bph === "number" && pillarSpan > 1e-6) {
        const ratio = Math.max(-1, Math.min(1, (bph - ph) / pillarSpan));
        const slopeAng = Math.asin(ratio) * 180 / Math.PI;
        effectiveTiltDeg = ori === "portrait" ? -slopeAng : -slopeAng;
      }
    }
    const sinT = Math.sin(effectiveTiltDeg * DEG);
    const cosT = Math.cos(effectiveTiltDeg * DEG);
    const structureSinT = ori === "portrait" ? -sinT : sinT;
    const frontZ = structureSinT >= 0 ? Math.min(...panelEdges) : Math.max(...panelEdges);

    const tiltRad = -(effectiveTiltDeg * DEG);
    if (ori === "portrait") tiltGroup.rotation.z = tiltRad;
    else tiltGroup.rotation.x = tiltRad;
    const frontPillarZ_pre = structureSinT >= 0 ? Math.min(...preTilt) : Math.max(...preTilt);
    tiltGroup.position.y = -frontPillarZ_pre * structureSinT;

    const PANEL_LIFT = 1.5 * LIPPED_WEB + LIPPED_DEPTH * Math.abs(sinT) / Math.abs(cosT) + 0.02;
    const surfGeo = new THREE.BoxGeometry(lengthM, 0.04, widthM);
    const surfMesh = new THREE.Mesh(surfGeo, MATS.panelSurface());
    surfMesh.position.y = PANEL_LIFT;
    surfMesh.castShadow = true; surfMesh.receiveShadow = true;
    surfMesh.userData.isPanelSurface = true;
    tiltGroup.add(surfMesh);

    const fThk = 0.015;
    const addFrame = (x: number, z: number, fsx: number, fsz: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(fsx, 0.05, fsz), MATS.panelFrame); m.position.set(x, PANEL_LIFT, z); m.userData.isPanelSurface = true; tiltGroup.add(m); };
    addFrame(0, -widthM / 2, lengthM, fThk); addFrame(0, widthM / 2, lengthM, fThk);
    addFrame(-lengthM / 2, 0, fThk, widthM); addFrame(lengthM / 2, 0, fThk, widthM);

    outerGroup.add(tiltGroup);
    outerGroup.userData.isIndividualPanel = true;

    const ewOverhang = ovhW + purlinOvh;
    const perpPositions = ori === "portrait"
      ? [-(halfW - ewOverhang), (halfW - ewOverhang)]
      : [-(halfL - ewOverhang), (halfL - ewOverhang)];

    const backPH = panel.back_pillar_height;
    let heights: number[];
    if (typeof backPH === "number" && preTilt.length >= 2) {
      const frontPillarZ_pre = structureSinT >= 0 ? Math.min(...preTilt) : Math.max(...preTilt);
      const backPillarZ_pre  = structureSinT >= 0 ? Math.max(...preTilt) : Math.min(...preTilt);
      const denom = backPillarZ_pre - frontPillarZ_pre;
      heights = Math.abs(denom) < 1e-6
        ? preTilt.map(() => ph)
        : preTilt.map((z) => ph + ((z - frontPillarZ_pre) / denom) * (backPH - ph));
    } else {
      heights = preTilt.map((z) => ph + (z - frontZ) * structureSinT);
    }
    const tiltWorldPos = preTilt.map((t) => t * cosT);

    for (let ti = 0; ti < preTilt.length; ti++) {
      const h = heights[ti];
      if (h <= 0.01) continue;
      const tp = tiltWorldPos[ti];
      for (const pp of perpPositions) {
        const px = ori === "portrait" ? tp : pp;
        const pz = ori === "portrait" ? pp : tp;
        const pillarGeo = createLippedCChannelGeo(LIPPED_WEB, LIPPED_DEPTH, LIPPED_LIP, LIPPED_THK, h);
        const pillar = new THREE.Mesh(pillarGeo, MATS.structure);
        pillar.position.set(px, -ph + h / 2, pz);
        const pEwAxis = new THREE.Vector3(ori === "portrait" ? 0 : 1, 0, ori === "portrait" ? 1 : 0);
        orientMember(pillar, new THREE.Vector3(0, 1, 0), pEwAxis);
        pillar.castShadow = true; pillar.receiveShadow = true;
        outerGroup.add(pillar);
        const bH = panel.base_height ?? BASE_THICKNESS;
        const bL = panel.base_length ?? BASE_SIZE;
        const bW = panel.base_width ?? BASE_SIZE;
        const bx = ori === "portrait" ? bW : bL;
        const bz = ori === "portrait" ? bL : bW;
        const baseGeo = new THREE.BoxGeometry(bx, bH, bz);
        const base = new THREE.Mesh(baseGeo, MATS.base);
        base.position.set(px, -ph + bH / 2, pz);
        base.receiveShadow = true;
        outerGroup.add(base);
      }
    }

    for (let ti = 0; ti < preTilt.length; ti++) {
      const tp = tiltWorldPos[ti];
      const topY = -ph + heights[ti];
      const rodLen = (perpPositions[perpPositions.length - 1] - perpPositions[0]) + 2 * purlinOvh;
      const midPerp = (perpPositions[0] + perpPositions[perpPositions.length - 1]) / 2;
      const purlinGeo = createLippedCChannelGeo(LIPPED_WEB, LIPPED_DEPTH, LIPPED_LIP, LIPPED_THK, rodLen);
      const rod = new THREE.Mesh(purlinGeo, MATS.structure);
      const rx = ori === "portrait" ? tp : midPerp;
      const rz = ori === "portrait" ? midPerp : tp;
      const rafterTopY = topY + (LIPPED_WEB * Math.abs(cosT)) / 2;
      const purlinHalf = (LIPPED_WEB * Math.abs(cosT) + LIPPED_DEPTH * Math.abs(sinT)) / 2;
      rod.position.set(rx, rafterTopY + purlinHalf, rz);
      const puEwAxis = new THREE.Vector3(ori === "portrait" ? 0 : 1, 0, ori === "portrait" ? 1 : 0);
      const puMouth = new THREE.Vector3(ori === "portrait" ? 1 : 0, 0, ori === "portrait" ? 0 : 1)
        .multiplyScalar((Math.sign(frontZ) || -1) * Math.abs(cosT));
      puMouth.y = -Math.abs(sinT);
      orientMember(rod, puEwAxis, puMouth);
      outerGroup.add(rod);
    }

    for (const pp of perpPositions) {
      const z0_pre = preTilt[0] - rafterOvh;
      const z1_pre = preTilt[preTilt.length - 1] + rafterOvh;
      const denomH = preTilt[preTilt.length - 1] - preTilt[0];
      const slopeH = Math.abs(denomH) < 1e-6 ? 0 : (heights[heights.length - 1] - heights[0]) / denomH;
      const h0 = heights[0] + (z0_pre - preTilt[0]) * slopeH;
      const h1 = heights[0] + (z1_pre - preTilt[0]) * slopeH;
      const t0 = z0_pre * cosT, t1 = z1_pre * cosT;
      const topY0 = -ph + h0, topY1 = -ph + h1;
      const px0 = ori === "portrait" ? t0 : pp, pz0 = ori === "portrait" ? pp : t0;
      const px1 = ori === "portrait" ? t1 : pp, pz1 = ori === "portrait" ? pp : t1;

      const dx = px1 - px0;
      const dy = topY1 - topY0;
      const dz = pz1 - pz0;
      const rodLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (rodLen < 0.001) continue;

      const rafterGeo = createLippedCChannelGeo(LIPPED_WEB, LIPPED_DEPTH, LIPPED_LIP, LIPPED_THK, rodLen);
      const rod = new THREE.Mesh(rafterGeo, MATS.structure);
      const raX = (px0 + px1) / 2 - (ori === "portrait" ? 0 : LIPPED_DEPTH);
      const raZ = (pz0 + pz1) / 2 - (ori === "portrait" ? LIPPED_DEPTH : 0);
      rod.position.set(raX, (topY0 + topY1) / 2, raZ);
      const raEwAxis = new THREE.Vector3(ori === "portrait" ? 0 : -1, 0, ori === "portrait" ? -1 : 0);
      orientMember(rod, new THREE.Vector3(dx, dy, dz), raEwAxis);
      rod.castShadow = true;
      outerGroup.add(rod);
    }
    group.add(outerGroup);
  }

  for (const [gid, panels] of Object.entries(grouped)) {
    const gDef = data.panel_groups[gid];
    if (!gDef || panels.length === 0) continue;
    const ori = gDef.orientation || panels[0].orientation || "landscape";
    let tableAngle: number;
    if (gDef.table_angle != null) {
      tableAngle = gDef.table_angle;
    } else {
      tableAngle = ori === "portrait" ? (panels[0].angle ?? 0) - 90 : (panels[0].angle ?? 0);
    }
    const rawTiltG = gDef.tilt_angle ?? panels[0].tilt_angle ?? 17;
    const diffG = (tableAngle - angleSouthDeg) * DEG;
    const facingSouthG = Math.cos(diffG) >= 0;
    let tiltDeg: number;
    if (ori === "landscape") {
      const normTA = ((tableAngle % 360) + 360) % 360;
      const inWorkingRange = normTA >= 90 && normTA <= 270;
      tiltDeg = inWorkingRange ? rawTiltG : -rawTiltG;
    } else {
      tiltDeg = facingSouthG ? rawTiltG : -rawTiltG;
      const normTAp = ((tableAngle % 360) + 360) % 360;
      if (normTAp > 180 && normTAp <= 270) tiltDeg = -tiltDeg;
    }
    const ph = gDef.front_pillar_height ?? 1.21;
    const ovhW = ((gDef.overhang_module_width ?? 100) / 1000);
    const purlinOvhG = gDef.purlin_overhang ?? 0.2;
    const pillarEW = gDef.pillar_to_pillar_ew ?? 2;
    const m2mEW = ((gDef.module_to_module_ew ?? 0) / 1000);
    const m2mNS = ((gDef.module_to_module_ns ?? 0) / 1000);
    const ovhL = ((gDef.overhang_module_length ?? 0) / 1000);
    const gridRows = gDef.grid_rows ?? 1;
    // const gridCols = gDef.grid_cols ?? 1;
    // const tiltRad = tiltDeg * DEG;
    // const sinT = Math.sin(tiltRad);
    // const cosT = Math.cos(tiltRad);

    const tableAngleRad = tableAngle * DEG;
    const cosTaC = Math.cos(tableAngleRad);
    const sinTaC = Math.sin(tableAngleRad);
    const pxs = panels.map((p) => conv.panelToX(p.center_x));
    const pzs = panels.map((p) => conv.panelToZ(p.center_y));
    const avgX = pxs.reduce((s, v) => s + v, 0) / pxs.length;
    const avgZ = pzs.reduce((s, v) => s + v, 0) / pzs.length;
    let lxMin = Infinity, lxMax = -Infinity, lzMin = Infinity, lzMax = -Infinity;
    for (let i = 0; i < pxs.length; i++) {
      const dx = pxs[i] - avgX;
      const dz = pzs[i] - avgZ;
      const lx = dx * cosTaC + dz * sinTaC;
      const lz = -dx * sinTaC + dz * cosTaC;
      if (lx < lxMin) lxMin = lx;
      if (lx > lxMax) lxMax = lx;
      if (lz < lzMin) lzMin = lz;
      if (lz > lzMax) lzMax = lz;
    }
    const lcx = (lxMin + lxMax) / 2;
    const lcz = (lzMin + lzMax) / 2;
    const gcx = avgX + lcx * cosTaC - lcz * sinTaC;
    const gcz = avgZ + lcx * sinTaC + lcz * cosTaC;

    const roofH = panels[0].roof_idx >= 0 && panels[0].roof_idx < roofArr.length ? roofArr[panels[0].roof_idx].height : 0;
    const outerGroup = new THREE.Group();
    const cosTA = Math.cos(tableAngleRad), sinTA = Math.sin(tableAngleRad);

    const cellEWSpread = ori === "portrait" ? widthM : lengthM;
    const ewSpreadScale = cellEWSpread > 0 && m2mEW > 0 ? (cellEWSpread + m2mEW) / cellEWSpread : 1;
    const cellNSSpread = ori === "portrait" ? lengthM : widthM;
    const nsSpreadScale = cellNSSpread > 0 && m2mNS > 0 ? (cellNSSpread + m2mNS) / cellNSSpread : 1;
    const cellNS = ori === "portrait" ? lengthM : widthM;
    const cellEW = ori === "portrait" ? widthM : lengthM;

    const pillarCount = gDef.pillar_count ?? (ori === "portrait" ? (gridRows >= 3 ? 3 : 2) : (gridRows >= 4 ? 3 : 2));

    const panelLocalData: { z: number; lx: number }[] = [];
    for (const p of panels) {
      const dx = conv.panelToX(p.center_x) - gcx;
      const dz = conv.panelToZ(p.center_y) - gcz;
      panelLocalData.push({
        z: (-dx * sinTA + dz * cosTA) * nsSpreadScale,
        lx: (dx * cosTA + dz * sinTA) * ewSpreadScale,
      });
    }

    const sortedZs = panelLocalData.map(d => d.z).sort((a, b) => a - b);
    const rowZCentres: number[] = [];
    const ROW_TOL = cellNS * 0.4;
    for (const z of sortedZs) {
      if (rowZCentres.length === 0 || z - rowZCentres[rowZCentres.length - 1] > ROW_TOL) {
        rowZCentres.push(z);
      }
    }

    const normalRowSpacing = cellNS + m2mNS;
    const rowGapM = gDef.row_gap ?? 2;
    const crossSectionSpacing = cellNS + rowGapM;
    const sectionGapThreshold = (normalRowSpacing + crossSectionSpacing) / 2;
    type SecDetect = { rows: number; minZ: number; maxZ: number };
    const detected: SecDetect[] = [{ rows: 1, minZ: rowZCentres[0], maxZ: rowZCentres[0] }];
    for (let i = 1; i < rowZCentres.length; i++) {
      if (rowZCentres[i] - rowZCentres[i - 1] > sectionGapThreshold) {
        detected.push({ rows: 1, minZ: rowZCentres[i], maxZ: rowZCentres[i] });
      } else {
        const cur = detected[detected.length - 1];
        cur.rows++;
        cur.maxZ = rowZCentres[i];
      }
    }

    const sectionSizes = detected.map(s => s.rows);
    const sectionExtents = detected.map(s => (s.maxZ - s.minZ) + cellNS);
    const sectionCenterZ = detected.map(s => (s.minZ + s.maxZ) / 2);
    const originalSectionCenterZ = sectionCenterZ.slice();

    if (sectionSizes.length > 1) {
      let mainIdx = 0;
      for (let i = 1; i < sectionSizes.length; i++) {
        if (sectionSizes[i] > sectionSizes[mainIdx]) mainIdx = i;
      }
      const mainSize = sectionSizes[mainIdx];
      const mainExtent = sectionExtents[mainIdx];
      const mainCenter = sectionCenterZ[mainIdx];
      const stride = mainExtent + rowGapM;
      for (let i = 0; i < sectionSizes.length; i++) {
        sectionSizes[i] = mainSize;
        sectionExtents[i] = mainExtent;
        sectionCenterZ[i] = mainCenter + (i - mainIdx) * stride;
      }
    }

    const sectionBounds: number[] = [];
    for (let i = 0; i < detected.length - 1; i++) {
      sectionBounds.push((detected[i].maxZ + detected[i + 1].minZ) / 2);
    }

    const rafterOvhG = gDef.rafter_overhang ?? 0.2;
    const totalOvhNS = ovhL + rafterOvhG;
    const sectionEffTiltDeg: number[] = [];
    const sectionNSideView: number[] = [];
    const sectionPillarSpans: number[] = [];
    for (let sec = 0; sec < sectionSizes.length; sec++) {
      const secRows = sectionSizes[sec];
      const secExtent = sectionExtents[sec];
      const rowBased = ori === "portrait" ? (secRows >= 3 ? 3 : 2) : (secRows >= 4 ? 3 : 2);
      const nSV = Math.min(pillarCount as number, rowBased);
      sectionNSideView.push(nSV);
      const standardTilt = computeEffectiveTiltDeg(tiltDeg, secExtent, nSV);
      if (Math.abs(standardTilt) >= 0.01 || Math.abs(tiltDeg) < 0.01) {
        sectionEffTiltDeg.push(standardTilt);
        sectionPillarSpans.push(computeActualPillarSpan(standardTilt, secExtent, nSV));
      } else {
        const adj = computeAdjustedSectionTilt(tiltDeg, secExtent, totalOvhNS, nSV);
        sectionEffTiltDeg.push(adj.tiltDeg);
        sectionPillarSpans.push(adj.pillarSpan);
      }
    }

    {
      const bphG = gDef.back_pillar_height;
      if (typeof bphG === "number") {
        for (let sec = 0; sec < sectionSizes.length; sec++) {
          const secExtent = sectionExtents[sec];
          const correctedSpan = secExtent - 2 * (ovhL + rafterOvhG);
          if (correctedSpan > 1e-6) sectionPillarSpans[sec] = correctedSpan;
          const span = sectionPillarSpans[sec];
          if (!Number.isFinite(span) || span <= 1e-6) continue;
          const ratio = Math.max(-1, Math.min(1, (bphG - ph) / span));
          const slopeAng = Math.asin(ratio) * 180 / Math.PI;
          const sign = sectionEffTiltDeg[sec] >= 0 ? 1 : -1;
          sectionEffTiltDeg[sec] = sign * Math.abs(slopeAng);
        }
      }
    }

    const sectionTiltGroups: THREE.Group[] = [];
    const sectionPanelXs: number[][] = sectionSizes.map(() => []);
    for (let sec = 0; sec < sectionSizes.length; sec++) {
      const effRad = sectionEffTiltDeg[sec] * DEG;
      const effSinT = Math.sin(effRad);
      const secHalfNS = sectionExtents[sec] / 2;
      const nsInnerSec = Math.min(sectionPillarSpans[sec] / 2, secHalfNS);
      const frontPillarZ_local = effSinT >= 0 ? -nsInnerSec : nsInnerSec;
      const tg = new THREE.Group();
      tg.rotation.x = -effRad;
      tg.position.y = -frontPillarZ_local * effSinT;
      tg.position.z = sectionCenterZ[sec];
      sectionTiltGroups.push(tg);
      outerGroup.add(tg);
    }

    for (const p of panels) {
      const dx = conv.panelToX(p.center_x) - gcx;
      const dz = conv.panelToZ(p.center_y) - gcz;
      const localX = dx * cosTA + dz * sinTA;
      const localZ = -dx * sinTA + dz * cosTA;
      const panelZ = localZ * nsSpreadScale;

      let bestSec = sectionBounds.length;
      for (let i = 0; i < sectionBounds.length; i++) {
        if (panelZ < sectionBounds[i]) { bestSec = i; break; }
      }

      const effRadP = sectionEffTiltDeg[bestSec] * DEG;
      const PANEL_LIFT_G = 1.5 * LIPPED_WEB + LIPPED_DEPTH * Math.abs(Math.sin(effRadP)) / Math.abs(Math.cos(effRadP)) + 0.02;
      const surfGeo = new THREE.BoxGeometry(lengthM, 0.04, widthM);
      const surfMesh = new THREE.Mesh(surfGeo, MATS.panelSurface());
      surfMesh.position.y = PANEL_LIFT_G;
      surfMesh.castShadow = true; surfMesh.receiveShadow = true;
      surfMesh.userData.isPanelSurface = true;

      const wrapper = new THREE.Group();
      wrapper.add(surfMesh);
      const fThk = 0.015;
      const addF = (fx: number, fz: number, fsx: number, fsz: number) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(fsx, 0.05, fsz), MATS.panelFrame);
        m.position.set(fx, PANEL_LIFT_G, fz); m.userData.isPanelSurface = true; wrapper.add(m);
      };
      addF(0, -widthM / 2, lengthM, fThk); addF(0, widthM / 2, lengthM, fThk);
      addF(-lengthM / 2, 0, fThk, widthM); addF(lengthM / 2, 0, fThk, widthM);

      if (ori === "portrait") wrapper.rotation.y = -(90 * DEG);
      wrapper.position.set(localX * ewSpreadScale, 0, panelZ - originalSectionCenterZ[bestSec]);
      wrapper.userData.isIndividualPanel = true;
      sectionTiltGroups[bestSec].add(wrapper);
      sectionPanelXs[bestSec].push(localX * ewSpreadScale);
    }

    for (let sec = 0; sec < sectionSizes.length; sec++) {
      const secRows = sectionSizes[sec];
      const secExtent = sectionExtents[sec];
      const secHalfNS = secExtent / 2;
      const secCenterZ = sectionCenterZ[sec];

      const secXs = sectionPanelXs[sec];
      if (secXs.length === 0) continue;
      const secXMin = Math.min(...secXs);
      const secXMax = Math.max(...secXs);
      const secEwExtent = (secXMax - secXMin) + cellEW;
      const secEwCenter = (secXMin + secXMax) / 2;

      const ewOverhangG = ovhW + purlinOvhG;
      const usableEW = secEwExtent - 2 * ewOverhangG;
      const nPillarsEW = Math.max(2, Math.floor(usableEW / pillarEW) + 1);
      const xPositions: number[] = [];
      const ewStart = secEwCenter - secEwExtent / 2 + ewOverhangG;
      const ewEnd = secEwCenter + secEwExtent / 2 - ewOverhangG;
      if (nPillarsEW === 1) {
        xPositions.push((ewStart + ewEnd) / 2);
      } else {
        const ewStep = (ewEnd - ewStart) / (nPillarsEW - 1);
        for (let i = 0; i < nPillarsEW; i++) xPositions.push(ewStart + i * ewStep);
      }

      const nSideView = sectionNSideView[sec];
      const preTiltZ: number[] = [];
      const actualSpanNS = sectionPillarSpans[sec];
      const nsInner = Math.min(actualSpanNS / 2, secHalfNS);
      if (nSideView === 2) {
        preTiltZ.push(-nsInner, nsInner);
      } else {
        preTiltZ.push(-nsInner, 0, nsInner);
      }

      const secSinT = Math.sin(sectionEffTiltDeg[sec] * DEG);
      const secCosT = Math.cos(sectionEffTiltDeg[sec] * DEG);
      const panelFrontZ = secSinT >= 0 ? -secHalfNS : secHalfNS;
      const backPHGroup = gDef.back_pillar_height;
      let lineHeights: number[];
      if (typeof backPHGroup === "number" && preTiltZ.length >= 2) {
        const frontPillarZ_pre = secSinT >= 0 ? Math.min(...preTiltZ) : Math.max(...preTiltZ);
        const backPillarZ_pre  = secSinT >= 0 ? Math.max(...preTiltZ) : Math.min(...preTiltZ);
        const denom = backPillarZ_pre - frontPillarZ_pre;
        lineHeights = Math.abs(denom) < 1e-6
          ? preTiltZ.map(() => ph)
          : preTiltZ.map((z) => ph + ((z - frontPillarZ_pre) / denom) * (backPHGroup - ph));
      } else {
        lineHeights = preTiltZ.map((z) => ph + (z - panelFrontZ) * secSinT);
      }
      const lineZ = preTiltZ.map((z) => z * secCosT + secCenterZ);

      for (let li = 0; li < lineZ.length; li++) {
        const z = lineZ[li], h = lineHeights[li];
        if (h <= 0.01) continue;
        for (const x of xPositions) {
          const pillarGeo = createLippedCChannelGeo(LIPPED_WEB, LIPPED_DEPTH, LIPPED_LIP, LIPPED_THK, h);
          const pillar = new THREE.Mesh(pillarGeo, MATS.structure);
          pillar.position.set(x, -ph + h / 2, z);
          orientMember(pillar, new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0));
          pillar.castShadow = true; pillar.receiveShadow = true;
          outerGroup.add(pillar);
          const bH = gDef.base_height ?? BASE_THICKNESS;
          const bL = gDef.base_length ?? BASE_SIZE;
          const bW = gDef.base_width ?? BASE_SIZE;
          const baseGeo = new THREE.BoxGeometry(bW, bH, bL);
          const base = new THREE.Mesh(baseGeo, MATS.base);
          base.position.set(x, -ph + bH / 2, z);
          base.receiveShadow = true;
          outerGroup.add(base);
        }
      }

      if (xPositions.length >= 2) {
        const rodLen = (xPositions[xPositions.length - 1] - xPositions[0]) + 2 * purlinOvhG;
        const midX = (xPositions[0] + xPositions[xPositions.length - 1]) / 2;

        const purlinPreTiltZ: number[] = [];
        for (let r = 0; r < secRows; r++) {
          const rowCenter = -secHalfNS + r * (cellNS + m2mNS) + cellNS / 2 + secCenterZ;
          purlinPreTiltZ.push(rowCenter - cellNS / 2 + ovhL);
          purlinPreTiltZ.push(rowCenter + cellNS / 2 - ovhL);
        }

        const denomNS = preTiltZ[preTiltZ.length - 1] - preTiltZ[0];
        const slopeNS = Math.abs(denomNS) < 1e-6 ? 0 : (lineHeights[lineHeights.length - 1] - lineHeights[0]) / denomNS;
        for (const pz of purlinPreTiltZ) {
          const localPz = pz - secCenterZ;
          const h = lineHeights[0] + (localPz - preTiltZ[0]) * slopeNS;
          if (h <= 0.01) continue;
          const topY = -ph + h;
          const worldZ = localPz * secCosT + secCenterZ;
          const purlinGeo = createLippedCChannelGeo(LIPPED_WEB, LIPPED_DEPTH, LIPPED_LIP, LIPPED_THK, rodLen);
          const rod = new THREE.Mesh(purlinGeo, MATS.structure);
          const rafterTopY = topY + (LIPPED_WEB * Math.abs(secCosT)) / 2;
          const purlinHalf = (LIPPED_WEB * Math.abs(secCosT) + LIPPED_DEPTH * Math.abs(secSinT)) / 2;
          rod.position.set(midX, rafterTopY + purlinHalf, worldZ);
          const puMouthG = new THREE.Vector3(0, -Math.abs(secSinT), (Math.sign(panelFrontZ) || -1) * Math.abs(secCosT));
          orientMember(rod, new THREE.Vector3(1, 0, 0), puMouthG);
          rod.castShadow = true;
          outerGroup.add(rod);
        }
      }

      if (lineZ.length >= 2) {
        const denomS = preTiltZ[preTiltZ.length - 1] - preTiltZ[0];
        const slopeS = Math.abs(denomS) < 1e-6 ? 0 : (lineHeights[lineHeights.length - 1] - lineHeights[0]) / denomS;
        const sectionFrontPre = preTiltZ[0] - rafterOvhG;
        const sectionBackPre = preTiltZ[preTiltZ.length - 1] + rafterOvhG;
        for (const x of xPositions) {
          for (let li = 0; li < lineZ.length - 1; li++) {
            const isFirst = li === 0;
            const isLast = li === lineZ.length - 2;
            const z0_pre = isFirst ? sectionFrontPre : preTiltZ[li];
            const z1_pre = isLast ? sectionBackPre : preTiltZ[li + 1];
            const h0 = lineHeights[0] + (z0_pre - preTiltZ[0]) * slopeS;
            const h1 = lineHeights[0] + (z1_pre - preTiltZ[0]) * slopeS;
            if (h0 <= 0.01 || h1 <= 0.01) continue;
            const topY0 = -ph + h0, topY1 = -ph + h1;
            const z0 = z0_pre * secCosT + secCenterZ;
            const z1 = z1_pre * secCosT + secCenterZ;
            const dy = topY1 - topY0, dz = z1 - z0;
            const rodLen = Math.sqrt(dy * dy + dz * dz);
            if (rodLen <= 0) continue;
            const rafterGeo = createLippedCChannelGeo(LIPPED_WEB, LIPPED_DEPTH, LIPPED_LIP, LIPPED_THK, rodLen);
            const rod = new THREE.Mesh(rafterGeo, MATS.structure);
            rod.position.set(x - LIPPED_DEPTH, (topY0 + topY1) / 2, (z0 + z1) / 2);
            orientMember(rod, new THREE.Vector3(0, dy, dz), new THREE.Vector3(-1, 0, 0));
            rod.castShadow = true;
            outerGroup.add(rod);
          }
        }
      }
    } // end per-section loop

    outerGroup.position.set(gcx, roofH + ph, gcz);
    outerGroup.rotation.y = -tableAngleRad;
    group.add(outerGroup);
  }

  return group;
}

// ── Trees ──
export async function buildTrees(data: SceneData, parentGroup: THREE.Group, conv: CoordConverter): Promise<void> {
  const treeObjs = Object.values(data.objects.tree || {});
  if (treeObjs.length === 0) return;

  const modelPaths = treeObjs.map((t) => {
    const tag = t.tag || "";
    return TAG_MODEL_MAP[tag] || "/models/tree/tree_v2.glb";
  });

  const buildStart = performance.now();
  const byPath = new Map<string, { wrapper: THREE.Group; crownR: number; totalH: number }[]>();

  for (let idx = 0; idx < treeObjs.length; idx++) {
    const tree = treeObjs[idx];
    const crownR = tree.radius != null ? Number(tree.radius) : 1.5;
    const totalH = ((tree.z_end || 5) - (tree.z_init || 0)) || 5;
    const baseY = tree.z_init || 0;
    const modelPath = modelPaths[idx];

    const wrapper = new THREE.Group();
    wrapper.position.set(conv.toX(tree.center_x), baseY, conv.toZ(tree.center_y));
    wrapper.add(buildPlaceholderBox(crownR * 2, totalH, crownR * 2, PLACEHOLDER_TREE_MAT, true));
    parentGroup.add(wrapper);

    if (!byPath.has(modelPath)) byPath.set(modelPath, []);
    byPath.get(modelPath)!.push({ wrapper, crownR, totalH });
  }

  for (const [modelPath, entries] of byPath) {
    void (async () => {
      try { await loadModel(modelPath); } catch { return; }
      const bounds = _modelBoundsCache.get(modelPath);
      if (!bounds) return;

      const placeFromTemplate = (template: THREE.Group, entry: typeof entries[0]) => {
        const inst = template.clone();
        const sX = (entry.crownR * 2) / bounds.size.x;
        const sY = entry.totalH / bounds.size.y;
        const sZ = (entry.crownR * 2) / bounds.size.z;
        inst.scale.set(sX, sY, sZ);
        inst.position.set(-bounds.center.x * sX, -bounds.minY * sY, -bounds.center.z * sZ);
        inst.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) { (c as THREE.Mesh).castShadow = true; (c as THREE.Mesh).receiveShadow = true; }
        });
        return inst;
      };

      const lowTemplate = _modelCacheLow.get(modelPath) || _modelCache.get(modelPath);
      if (!lowTemplate) return;
      for (const entry of entries) {
        if (!entry.wrapper.parent) continue;
        const inst = placeFromTemplate(lowTemplate, entry);
        while (entry.wrapper.children.length) entry.wrapper.remove(entry.wrapper.children[0]);
        entry.wrapper.add(inst);
      }

      if (!_modelCacheLow.has(modelPath)) return;
      const elapsed = performance.now() - buildStart;
      const delay = Math.max(0, UPGRADE_FULL_AFTER_MS - elapsed);
      setTimeout(() => {
        const fullTemplate = _modelCache.get(modelPath);
        if (!fullTemplate) return;
        let i = 0;
        const upgradeNext = () => {
          if (i >= entries.length) return;
          const entry = entries[i++];
          if (!entry.wrapper.parent) { requestAnimationFrame(upgradeNext); return; }
          const inst = placeFromTemplate(fullTemplate, entry);
          while (entry.wrapper.children.length) entry.wrapper.remove(entry.wrapper.children[0]);
          entry.wrapper.add(inst);
          requestAnimationFrame(upgradeNext);
        };
        upgradeNext();
      }, delay);
    })();
  }
}
