import * as THREE from "three";
import { sunDirectionENU, sunToScene } from "./sunEngine";

const GRID_DENSITY = 0.5; // points per meter

export interface ShadowResult {
  roofId: string;
  exposure: number; // 0-100%
  points: { x: number; y: number; z: number; exposure: number }[];
}

/**
 * Run full shadow analysis across all roofs.
 */
export function runShadowAnalysis(
  scene: THREE.Scene,
  roofs: { id: string; height: number; points: [number, number][] }[],
  latDeg: number,
  angleSouthDeg: number,
  _widthM: number,
  _heightM: number,
  coordScale: { scaleX: number; scaleY: number; isPixels: boolean },
  onProgress?: (pct: number) => void
): ShadowResult[] {
  const toX = (v: number) => coordScale.isPixels ? v * coordScale.scaleX : v;
  const toZ = (v: number) => coordScale.isPixels ? v * coordScale.scaleY : v;

  // Precompute sun positions: 12 months x hourly 6-18
  const sunDirs: THREE.Vector3[] = [];
  for (let m = 1; m <= 12; m++) {
    for (let h = 6; h <= 18; h += 0.25) {
      const enu = sunDirectionENU(latDeg, m, h);
      if (enu[2] <= 0.01) continue; // below horizon
      sunDirs.push(sunToScene(enu, angleSouthDeg));
    }
  }

  if (sunDirs.length === 0) return [];

  const raycaster = new THREE.Raycaster();
  (raycaster as unknown as { firstHitOnly: boolean }).firstHitOnly = true;
  const results: ShadowResult[] = [];
  let totalPts = 0;
  let donePts = 0;

  // Count total for progress
  for (const roof of roofs) {
    const pts = roof.points;
    const xs = pts.map((p) => toX(p[0]));
    const zs = pts.map((p) => toZ(p[1]));
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const w = maxX - minX, h = maxZ - minZ;
    totalPts += Math.ceil(w * GRID_DENSITY) * Math.ceil(h * GRID_DENSITY);
  }

  for (const roof of roofs) {
    const pts = roof.points;
    const xs = pts.map((p) => toX(p[0]));
    const zs = pts.map((p) => toZ(p[1]));
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);

    const gridStepX = 1 / GRID_DENSITY;
    const gridStepZ = 1 / GRID_DENSITY;
    const roofPts: ShadowResult["points"] = [];

    for (let gx = minX; gx <= maxX; gx += gridStepX) {
      for (let gz = minZ; gz <= maxZ; gz += gridStepZ) {
        // Check if point is inside roof polygon
        if (!pointInPoly2D(gx, gz, xs, zs)) { donePts++; continue; }

        const origin = new THREE.Vector3(gx, roof.height + 0.1, gz);
        let litCount = 0;

        for (const dir of sunDirs) {
          raycaster.set(origin, dir);
          const hits = raycaster.intersectObjects(scene.children, true);
          let blocked = false;
          for (const hit of hits) {
            if (hit.distance < 0.05) continue; // self
            if (hit.object.userData.isRoof && hit.object.userData.roofId === roof.id) continue;
            if (hit.object.userData.isGround) continue;
            blocked = true;
            break;
          }
          if (!blocked) litCount++;
        }

        const exposure = (litCount / sunDirs.length) * 100;
        roofPts.push({ x: gx, y: roof.height + 0.12, z: gz, exposure });
        donePts++;
        if (onProgress && donePts % 50 === 0) onProgress(donePts / totalPts);
      }
    }

    const avgExposure = roofPts.length > 0
      ? roofPts.reduce((s, p) => s + p.exposure, 0) / roofPts.length
      : 0;

    results.push({ roofId: roof.id, exposure: avgExposure, points: roofPts });
  }

  return results;
}

/**
 * Run panel shadow analysis (May, hourly 7am–5pm). Async — yields to UI between
 * rays so the browser thread stays responsive.
 *
 * Each panel is divided into 4 equal quadrant sections (2×2 grid on the panel
 * surface). Rays are cast from all 4 quadrant centres for every sun direction.
 * The section that accumulates the highest shadow count determines the panel
 * colour — i.e. the worst-affected quarter drives the whole panel's result.
 */
export async function runPanelAnalysis(
  scene: THREE.Scene,
  panelGroups: THREE.Object3D[],
  latDeg: number,
  angleSouthDeg: number,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal
): Promise<{ panel: THREE.Object3D; shadowPct: number }[]> {
  // 11 hourly samples (7am–5pm) for May only — matches mobile
  const sunDirs: THREE.Vector3[] = [];
  for (let h = 7; h <= 17; h++) {
    const enu = sunDirectionENU(latDeg, 5, h);
    if (enu[2] <= 0.01) continue;
    sunDirs.push(sunToScene(enu, angleSouthDeg));
  }
  if (sunDirs.length === 0) return [];

  // Collect shadow-casting leaf meshes once (skip overlays + ground)
  const castObjects: THREE.Object3D[] = [];
  scene.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (m.isMesh && !obj.userData.isShadowOverlay && !obj.userData.isGround) {
      castObjects.push(obj);
    }
  });

  // Pre-build self-mesh UUID sets per panel for O(1) self-hit detection
  const panelMeshIds: Set<string>[] = panelGroups.map((p) => {
    const ids = new Set<string>();
    p.traverse((c) => { if ((c as THREE.Mesh).isMesh) ids.add(c.uuid); });
    return ids;
  });

  const raycaster = new THREE.Raycaster();
  raycaster.far = 500;
  (raycaster as unknown as { firstHitOnly: boolean }).firstHitOnly = true;
  const results: { panel: THREE.Object3D; shadowPct: number }[] = [];
  // 4 sample points per panel per sun direction
  const totalWork = panelGroups.length * sunDirs.length * 4;
  let workDone = 0;
  let lastYield = performance.now();

  for (let pi = 0; pi < panelGroups.length; pi++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const panelObj = panelGroups[pi];
    const selfIds = panelMeshIds[pi];

    // Find the surface mesh to derive panel dimensions and world transform.
    let surfaceMesh: THREE.Mesh | null = null;
    panelObj.traverse((c) => {
      if ((c as THREE.Mesh).isMesh && c.userData.isPanelSurface && !surfaceMesh) {
        surfaceMesh = c as THREE.Mesh;
      }
    });

    // Build 4 world-space sample points at the quarter-centres of the panel.
    // Local offsets: ±width/4 along X, ±depth/4 along Z (BoxGeometry axes).
    // Each point is lifted 0.1 m in world Y to clear the tilted surface.
    let samplePoints: THREE.Vector3[];
    if (surfaceMesh) {
      const geo = (surfaceMesh as THREE.Mesh).geometry as THREE.BoxGeometry;
      const hw = geo.parameters.width / 4;
      const hd = geo.parameters.depth / 4;
      const mat = (surfaceMesh as THREE.Mesh).matrixWorld;
      samplePoints = [
        new THREE.Vector3(-hw, 0, -hd),
        new THREE.Vector3(+hw, 0, -hd),
        new THREE.Vector3(-hw, 0, +hd),
        new THREE.Vector3(+hw, 0, +hd),
      ].map(lp => { lp.applyMatrix4(mat); lp.y += 0.1; return lp; });
    } else {
      // Fallback: single centre point (graceful degradation if mesh not found)
      const center = new THREE.Vector3();
      panelObj.getWorldPosition(center);
      center.y += 0.1;
      samplePoints = [center, center, center, center];
    }

    // Track blocked count independently for each of the 4 sections.
    const sectionCounts = [0, 0, 0, 0];

    for (let di = 0; di < sunDirs.length; di++) {
      for (let si = 0; si < 4; si++) {
        raycaster.set(samplePoints[si], sunDirs[di]);
        const hits = raycaster.intersectObjects(castObjects, false);
        let blocked = false;
        for (const hit of hits) {
          if (selfIds.has(hit.object.uuid)) continue;
          if (hit.distance < 0.05) continue;
          blocked = true;
          break;
        }
        if (blocked) sectionCounts[si]++;
        workDone++;

        const now = performance.now();
        if (now - lastYield >= 16) {
          lastYield = now;
          if (onProgress) onProgress(Math.min(0.99, workDone / totalWork));
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
          if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        }
      }
    }

    // The most-shaded section drives the panel colour.
    const maxCount = Math.max(...sectionCounts);
    const shadowPct = (maxCount / sunDirs.length) * 100;
    results.push({ panel: panelObj, shadowPct: Math.round(shadowPct * 10) / 10 });
  }

  if (onProgress) onProgress(1);
  return results;
}

function pointInPoly2D(px: number, pz: number, xs: number[], zs: number[]): boolean {
  let inside = false;
  for (let i = 0, j = xs.length - 1; i < xs.length; j = i++) {
    if ((zs[i] > pz) !== (zs[j] > pz) &&
      px < ((xs[j] - xs[i]) * (pz - zs[i])) / (zs[j] - zs[i]) + xs[i]) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Create colored overlay meshes from shadow results.
 */
export function createShadowOverlays(results: ShadowResult[], threshold: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "shadowOverlays";
  const size = 1 / GRID_DENSITY;

  for (const result of results) {
    for (const pt of result.points) {
      if (pt.exposure < threshold) continue;

      const color = exposureColor(pt.exposure);
      const geo = new THREE.PlaneGeometry(size, size);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.55, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pt.x, pt.y, pt.z);
      mesh.renderOrder = 900;
      group.add(mesh);
    }
  }

  return group;
}

function exposureColor(pct: number): number {
  if (pct >= 80) return 0x4caf50; // green
  if (pct >= 60) return 0xcddc39; // lime
  if (pct >= 40) return 0xffc107; // amber
  if (pct >= 20) return 0xff9800; // orange
  return 0xf44336; // red
}

/**
 * Apply panel analysis colors. Tints panel-surface meshes (skips pillars/rods).
 * Saves the original (shared) material so we can restore on toggle-off.
 * Color scheme matches mobile: green ≤25, yellow ≤50, orange ≤75, red >75 (% shadow).
 *
 * Returns a Map<mesh, originalMaterial> so the caller can restore later.
 */
export function applyPanelColors(
  results: { panel: THREE.Object3D; shadowPct: number }[]
): Map<THREE.Mesh, THREE.Material> {
  const origMats = new Map<THREE.Mesh, THREE.Material>();
  for (const { panel, shadowPct } of results) {
    let hex: number;
    if (shadowPct <= 25) hex = 0x4caf50;
    else if (shadowPct <= 50) hex = 0xffeb3b;
    else if (shadowPct <= 75) hex = 0xff9800;
    else hex = 0xf44336;
    const tint = new THREE.Color(hex);

    panel.traverse((child) => {
      const m = child as THREE.Mesh;
      if (m.isMesh && child.userData.isPanelSurface) {
        const orig = m.material as THREE.MeshPhongMaterial;
        if (!orig?.color) return;
        if (!origMats.has(m)) origMats.set(m, orig);
        const cloned = orig.clone();
        cloned.color.copy(tint);
        m.material = cloned;
      }
    });
  }
  return origMats;
}

/** Restore original (shared) materials after applyPanelColors. */
export function restorePanelColors(origMats: Map<THREE.Mesh, THREE.Material>) {
  for (const [mesh, orig] of origMats) {
    (mesh.material as THREE.Material).dispose();
    mesh.material = orig;
  }
  origMats.clear();
}
