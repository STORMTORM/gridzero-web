import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Hand, RotateCw } from "lucide-react";
import { fetch3DData } from "../../../utils/design/api";
import type { SceneData, QualityLevel } from "../../../utils/design/types";
import { sunDirectionENU, sunToScene, updateSunLight, getSunAzimuthDeg } from "../../../utils/design/sunEngine";
import { makeCoordConverter, buildGround, buildRoofs, buildRoofOverlays, buildObjects, buildWalls, buildPanels, buildTrees, buildTaggedObjects, preloadModels } from "../../../utils/design/sceneBuilder";
import { runPanelAnalysis, applyPanelColors, restorePanelColors } from "../../../utils/design/shadowAnalysis";
import ControlPanel from "./ControlPanel";
import Compass from "./Compass";

interface ViewerProps {
  data?: SceneData | null;
  sitevisitId?: string;
  refreshTrigger?: number;
}

export default function Viewer({ data: propData, sitevisitId: propSitevisitId, refreshTrigger }: ViewerProps) {
  const { id, sitevisitId: urlSitevisitId } = useParams<{ id?: string; sitevisitId?: string }>();
  const sitevisitId = propSitevisitId || id || urlSitevisitId;

  const [searchParams] = useSearchParams();
  const viewMode = (searchParams.get("mode") || "full") as "roof" | "object" | "full";
  // ── Capture / camera-positioning query params (used by RN snapshot screens) ──
  // ?cam=sw|center  → camera direction
  // ?zoom=0.75      → smaller = camera further away
  // ?height=20      → camera Y in metres (or "roof+10" handled below)
  // ?time=9         → initial sun hour (0-19)
  // ?capture=1      → enable preserveDrawingBuffer + expose window.__capture3D()
  // ?noUI=1         → hide control panel + compass (clean snapshot frame)
  // ?orient=ns      → (only for cam=center) align camera.up so scene N-S axis is screen-vertical
  const camParam = searchParams.get("cam");                 // sw | center | null
  const zoomParam = parseFloat(searchParams.get("zoom") || "1") || 1;
  const heightParam = searchParams.get("height");            // "20" | "roof+10" | null
  const timeParam = searchParams.get("time");                // initial hour, e.g. "9"
  const captureMode = searchParams.get("capture") === "1" || searchParams.get("stage") === "snapshots";
  const noUI = searchParams.get("noUI") === "1";
  const orientParam = searchParams.get("orient");            // "ns" | null
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const animFrameRef = useRef<number>(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SceneData | null>(null);

  const [quality, setQuality] = useState<QualityLevel>("high");
  const [showGround, setShowGround] = useState(true);
  const [showRoofImage, setShowRoofImage] = useState(false);
  const [showPanels, setShowPanels] = useState(true);
  const [showTrees, setShowTrees] = useState(true);
  const [month, setMonth] = useState(4);
  const initialT = (() => { const v = timeParam ? parseFloat(timeParam) : 12; return isFinite(v) ? v : 12; })();
  const [timeOfDay, setTimeOfDay] = useState(initialT);     // drives sun position (15-min snaps)
  const [displayTime, setDisplayTime] = useState(initialT);  // drives slider visual + time label (smooth)
  const [playing, setPlaying] = useState(false);
  const [cameraAngle, setCameraAngle] = useState(0);
  const [sunAzimuth, setSunAzimuth] = useState<number | null>(null);
  // Throttle compass updates — store in refs, sync to state every ~100ms
  const cameraAngleRef = useRef(0);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const groundRef = useRef<THREE.Mesh | null>(null);
  const groundTexMatRef = useRef<THREE.Material | null>(null);
  const groundTextureRef = useRef<THREE.Texture | null>(null);
  const mapImageWidthRef = useRef<number>(1000);
  const mapImageHeightRef = useRef<number>(1000);
  const groundBlackMatRef = useRef<THREE.Material>(new THREE.MeshStandardMaterial({ color: 0x111111, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const roofOverlaysRef = useRef<THREE.Group | null>(null);
  const panelsGroupRef = useRef<THREE.Group | null>(null);
  const treesGroupRef = useRef<THREE.Group | null>(null);
  const dynamicGroupRef = useRef<THREE.Group>(new THREE.Group());
  const isInitializedRef = useRef(false);
  const convRef = useRef<ReturnType<typeof makeCoordConverter> | null>(null);
  // Panel analysis cache + abort controller (so toggle = instant; cancel previous run)
  const panelOrigMatsRef = useRef<Map<THREE.Mesh, THREE.Material> | null>(null);
  const panelAnalysisCacheRef = useRef<{ panel: THREE.Object3D; shadowPct: number }[] | null>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);

  // Synchronize propData to local state
  useEffect(() => {
    if (propData !== undefined && propData !== null) {
      setData(propData);
      setLoading(false);
    }
  }, [propData]);

  // Fetch data
  useEffect(() => {
    if (propData) return;
    if (!sitevisitId) { setError("Missing sitevisit ID"); setLoading(false); return; }
    const forceRefresh = refreshTrigger !== undefined && refreshTrigger > 0;
    fetch3DData(sitevisitId, forceRefresh)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sitevisitId, refreshTrigger, propData]);

  // 1. Initialize WebGL Context (Renderer, Camera, Controls, Lights, permanent Group)
  useEffect(() => {
    if (!data || !containerRef.current || isInitializedRef.current) return;

    const container = containerRef.current;
    const W = data.width_meters;
    const H = data.height_meters;
    const lat = data.coordinates?.[0]?.[0] || 28.6;
    const angleSouth = data.angle_south_vertical_deg || 90;
    const diag = Math.sqrt(W * W + H * H);

    const devMem = (navigator as any).deviceMemory ?? 8;
    const cores = navigator.hardwareConcurrency ?? 8;
    const isLowEnd = devMem <= 4 || cores <= 4;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isLowEnd,
      powerPreference: "high-performance",
      preserveDrawingBuffer: captureMode,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    const dprCap = quality === "high" ? 2 : (quality === "medium" ? (isLowEnd ? 1 : 1.5) : 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap));
    renderer.shadowMap.enabled = quality !== "low";
    renderer.shadowMap.type = quality === "high" ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    renderer.setClearColor(0x021021);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Add our persistent dynamic group to the scene
    dynamicGroupRef.current.name = "dynamicObjects";
    scene.add(dynamicGroupRef.current);

    const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(W / 2, diag * 0.6, H + diag * 0.3);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(W / 2, 0, H / 2);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 3;
    controls.maxDistance = 500;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;

    // Apply snapshot camera positioning if present
    if (camParam) {
      let maxRoofH = 0;
      try {
        for (const r of Object.values(data.roofs as any)) {
          const h = (r as any).height;
          if (typeof h === "number" && h > maxRoofH) maxRoofH = h;
        }
      } catch { /* ignore */ }
      let camY: number;
      if (heightParam && heightParam.startsWith("roof+")) {
        const add = parseFloat(heightParam.slice(5)) || 10;
        camY = (maxRoofH || 5) + add;
      } else {
        camY = parseFloat(heightParam || "20") || 20;
      }

      const fovRad = (camera.fov * Math.PI) / 180;
      const fitDist = (diag / 2) / Math.tan(fovRad / 2);
      const dist = fitDist / Math.max(0.05, zoomParam);

      if (camParam === "sw") {
        const inv = 1 / Math.SQRT2;
        camera.position.set(W / 2 + dist * inv, camY, H / 2 + dist * inv);
      } else if (camParam === "center") {
        camera.position.set(W / 2 + 0.001, camY, H / 2 + 0.001);
        if (orientParam === "ns") {
          const a = ((angleSouth || 0) * Math.PI) / 180;
          camera.up.set(-Math.cos(a), 0, -Math.sin(a));
          camera.lookAt(W / 2, 0, H / 2);
          controls.enableRotate = false;
          controls.enablePan = true;
          controls.enableZoom = true;
          (controls as any).touches = {
            ONE: (THREE as any).TOUCH ? (THREE as any).TOUCH.PAN : 1,
            TWO: (THREE as any).TOUCH ? (THREE as any).TOUCH.DOLLY_PAN : 2,
          };
        }
      }
      controls.target.set(W / 2, 0, H / 2);
    }
    controls.update();
    controlsRef.current = controls;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 0.25));

    const sunLight = new THREE.DirectionalLight(0xfff5e1, 1.2);
    sunLight.castShadow = quality !== "low";
    const smSize = quality === "high" ? 2048 : (quality === "medium" ? (isLowEnd ? 512 : 1024) : 512);
    sunLight.shadow.mapSize.set(smSize, smSize);
    sunLight.shadow.bias = -0.0003;
    sunLight.shadow.normalBias = 0.05;
    scene.add(sunLight);
    scene.add(sunLight.target);
    sunLightRef.current = sunLight;

    const enu = sunDirectionENU(lat, 4, initialT);
    const sunDir = sunToScene(enu, angleSouth);
    updateSunLight(sunLight, sunDir, new THREE.Vector3(W / 2, 0, H / 2), diag / 2);

    // Render loop
    let lastCompassSync = 0;
    const animate = (now: number) => {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      const theta = Math.atan2(camera.position.z - controls.target.z, camera.position.x - controls.target.x);
      cameraAngleRef.current = (theta * 180) / Math.PI;
      if (now - lastCompassSync > 100) {
        lastCompassSync = now;
        setCameraAngle(cameraAngleRef.current);
      }
      renderer.render(scene, camera);
    };
    animFrameRef.current = requestAnimationFrame(animate);

    const onResize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    isInitializedRef.current = true;

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(animFrameRef.current);
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          (obj as THREE.Mesh).geometry?.dispose();
        }
      });
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      isInitializedRef.current = false;
    };
  }, [data === null, quality]);
  
  const [isPanMode, setIsPanMode] = useState(false);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (isPanMode) {
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE
      };
      (controls as any).touches = {
        ONE: (THREE as any).TOUCH ? (THREE as any).TOUCH.PAN : 1,
        TWO: (THREE as any).TOUCH ? (THREE as any).TOUCH.DOLLY_PAN : 2,
      };
    } else {
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
      };
      (controls as any).touches = {
        ONE: (THREE as any).TOUCH ? (THREE as any).TOUCH.ROTATE : 0,
        TWO: (THREE as any).TOUCH ? (THREE as any).TOUCH.DOLLY_PAN : 2,
      };
    }
    controls.update();
  }, [isPanMode]);

  // 2. Populate and Update Dynamic Objects in the Scene
  useEffect(() => {
    if (!data || !isInitializedRef.current || !sceneRef.current) return;

    // Reset analysis states
    if (analysisAbortRef.current) analysisAbortRef.current.abort();
    if (panelOrigMatsRef.current) { panelOrigMatsRef.current = null; }
    panelAnalysisCacheRef.current = null;
    setShowAnalysis(false);

    if (viewMode !== "roof") preloadModels(data);

    const W = data.width_meters;
    const H = data.height_meters;

    // Clear previous dynamic objects from the persistent dynamic group
    const dynamicGroup = dynamicGroupRef.current;
    while (dynamicGroup.children.length > 0) {
      const child = dynamicGroup.children[0];
      child.traverse((node) => {
        if ((node as THREE.Mesh).isMesh) {
          (node as THREE.Mesh).geometry?.dispose();
        }
      });
      dynamicGroup.remove(child);
    }

    // Estimate image pixel dimensions
    const estimateImgPixels = (): { w: number; h: number } => {
      let maxX = 0, maxY = 0;
      for (const roof of Object.values(data.roofs))
        for (const pt of roof.roof) { maxX = Math.max(maxX, pt[0]); maxY = Math.max(maxY, pt[1]); }
      for (const dict of Object.values(data.objects))
        for (const obj of Object.values(dict as Record<string, any>))
          if (obj.center_x != null) { maxX = Math.max(maxX, obj.center_x); maxY = Math.max(maxY, obj.center_y); }
      for (const p of data.panel_placements || [])
        { maxX = Math.max(maxX, p.center_x); maxY = Math.max(maxY, p.center_y); }
      if (maxX > W * 1.5 || maxY > H * 1.5) return { w: maxX * 1.1, h: maxY * 1.1 };
      return { w: 1, h: 1 };
    };

    const populateDynamicElements = (imgW: number, imgH: number, texture: THREE.Texture | null) => {
      const conv = makeCoordConverter(data, imgW, imgH);
      convRef.current = conv;

      const ground = buildGround(W, H, texture);
      dynamicGroup.add(ground);
      groundRef.current = ground;
      groundTexMatRef.current = ground.material as THREE.Material;

      const gridSize = Math.max(W, H);
      const divisions = Math.round(gridSize);
      const grid = new THREE.GridHelper(gridSize, divisions, 0x333333, 0x222222);
      grid.position.set(W / 2, 0.01, H / 2);
      grid.visible = !showGround;
      dynamicGroup.add(grid);
      gridHelperRef.current = grid;

      if (texture) {
        const roofOverlays = buildRoofOverlays(data, conv, texture);
        dynamicGroup.add(roofOverlays);
        roofOverlaysRef.current = roofOverlays;
        roofOverlays.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).visible = showRoofImage;
        });
      }

      dynamicGroup.add(buildRoofs(data, conv));

      if (viewMode === "roof") {
        dynamicGroup.add(buildWalls(data, conv));
      }

      if (viewMode !== "roof") {
        dynamicGroup.add(buildObjects(data, conv));

        const treeGroup = new THREE.Group();
        treeGroup.name = "trees";
        treeGroup.visible = showTrees;
        dynamicGroup.add(treeGroup);
        treesGroupRef.current = treeGroup;
        buildTrees(data, treeGroup, conv).catch(console.warn);

        const taggedGroup = new THREE.Group();
        taggedGroup.name = "taggedObjects";
        dynamicGroup.add(taggedGroup);
        buildTaggedObjects(data, taggedGroup, conv).catch(console.warn);
      }

      if (viewMode === "full") {
        const panels = buildPanels(data, conv);
        panels.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && child.userData.isPanelSurface) {
            (child as THREE.Mesh).visible = showPanels;
          }
        });
        dynamicGroup.add(panels);
        panelsGroupRef.current = panels;
      }
    };

    if (groundTextureRef.current && groundTextureRef.current.userData?.imageLink === data.image_link) {
      populateDynamicElements(mapImageWidthRef.current, mapImageHeightRef.current, groundTextureRef.current);
    } else {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const textureLoader = new THREE.TextureLoader();
        textureLoader.setCrossOrigin("anonymous");
        textureLoader.load(
          data.image_link,
          (tex) => {
            tex.userData = { imageLink: data.image_link };
            groundTextureRef.current = tex;
            mapImageWidthRef.current = img.naturalWidth;
            mapImageHeightRef.current = img.naturalHeight;
            populateDynamicElements(img.naturalWidth, img.naturalHeight, tex);
          },
          undefined,
          () => {
            populateDynamicElements(img.naturalWidth, img.naturalHeight, null);
          },
        );
      };
      img.onerror = () => {
        const est = estimateImgPixels();
        populateDynamicElements(est.w, est.h, null);
      };
      img.src = data.image_link;
    }

  }, [data]);

  // Sun update
  useEffect(() => {
    if (!data || !sunLightRef.current) return;
    const lat = data.coordinates?.[0]?.[0] || 28.6;
    const angleSouth = data.angle_south_vertical_deg || 90;
    const W = data.width_meters, H = data.height_meters;
    const diag = Math.sqrt(W * W + H * H);
    const enu = sunDirectionENU(lat, month, timeOfDay);
    const sunDir = sunToScene(enu, angleSouth);
    if (enu[2] > 0.01) {
      sunLightRef.current.visible = true;
      updateSunLight(sunLightRef.current, sunDir, new THREE.Vector3(W / 2, 0, H / 2), diag / 2);
      setSunAzimuth(getSunAzimuthDeg(enu));
    } else {
      sunLightRef.current.visible = false;
      setSunAzimuth(null);
    }
  }, [data, month, timeOfDay]);

  // Play — rAF-based: slider moves smoothly (1-min steps), sun updates every 15 min
  const playRafRef = useRef<number>(0);
  useEffect(() => {
    if (!playing) {
      if (playRafRef.current) cancelAnimationFrame(playRafRef.current);
      return;
    }
    let currentT = displayTime;
    if (currentT >= 18.75) { currentT = 6; setDisplayTime(6); setTimeOfDay(6); }
    let lastFrame = performance.now();
    let accum = 0;
    let lastSunT = Math.floor(currentT * 4) / 4;
    let lastDisplayMin = Math.floor(currentT * 60);
    const SPEED = 60; // display-minutes per real second
    const loop = (now: number) => {
      const dt = (now - lastFrame) / 1000;
      lastFrame = now;
      accum += dt * SPEED;
      while (accum >= 1) {
        accum -= 1;
        currentT = +(currentT + 1 / 60).toFixed(6);
        if (currentT > 19) {
          setDisplayTime(19);
          setTimeOfDay(19);
          setPlaying(false);
          return;
        }
      }
      const curMin = Math.floor(currentT * 60);
      if (curMin !== lastDisplayMin) {
        lastDisplayMin = curMin;
        setDisplayTime(currentT);
      }
      const sunT = Math.floor(currentT * 4) / 4;
      if (sunT !== lastSunT) {
        lastSunT = sunT;
        setTimeOfDay(sunT);
      }
      playRafRef.current = requestAnimationFrame(loop);
    };
    playRafRef.current = requestAnimationFrame(loop);
    return () => { if (playRafRef.current) cancelAnimationFrame(playRafRef.current); };
  }, [playing]);

  // Toggles
  useEffect(() => {
    if (!groundRef.current) return;
    if (showGround && groundTexMatRef.current) {
      groundRef.current.material = groundTexMatRef.current;
    } else {
      groundRef.current.material = groundBlackMatRef.current;
    }
    if (gridHelperRef.current) gridHelperRef.current.visible = !showGround;
  }, [showGround]);
  useEffect(() => {
    if (roofOverlaysRef.current) {
      roofOverlaysRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).visible = showRoofImage;
      });
    }
  }, [showRoofImage]);
  useEffect(() => {
    if (!panelsGroupRef.current) return;
    panelsGroupRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.userData.isPanelSurface) {
        (child as THREE.Mesh).visible = showPanels;
      }
    });
  }, [showPanels]);
  useEffect(() => {
    if (treesGroupRef.current) {
      treesGroupRef.current.visible = showTrees;
    }
  }, [showTrees]);
  useEffect(() => {
    if (!panelAnalysisCacheRef.current) return;
    if (showAnalysis) {
      if (!panelOrigMatsRef.current || panelOrigMatsRef.current.size === 0) {
        panelOrigMatsRef.current = applyPanelColors(panelAnalysisCacheRef.current);
      }
    } else {
      if (panelOrigMatsRef.current) restorePanelColors(panelOrigMatsRef.current);
    }
  }, [showAnalysis]);

  const runAnalysis = useCallback(async () => {
    if (!sceneRef.current || !data || !panelsGroupRef.current) return;

    if (panelAnalysisCacheRef.current && panelAnalysisCacheRef.current.length > 0) {
      if (!panelOrigMatsRef.current || panelOrigMatsRef.current.size === 0) {
        panelOrigMatsRef.current = applyPanelColors(panelAnalysisCacheRef.current);
      }
      setShowAnalysis(true);
      return;
    }

    if (analysisAbortRef.current) analysisAbortRef.current.abort();
    const ac = new AbortController();
    analysisAbortRef.current = ac;

    if (panelOrigMatsRef.current) {
      restorePanelColors(panelOrigMatsRef.current);
      panelOrigMatsRef.current = null;
    }

    const panels: THREE.Object3D[] = [];
    panelsGroupRef.current.traverse((child) => {
      if (child.userData.isIndividualPanel) panels.push(child);
    });
    if (panels.length === 0) return;

    setAnalysisRunning(true);
    setAnalysisProgress(0);
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));

    try {
      const lat = data.coordinates?.[0]?.[0] || 28.6;
      const angleSouth = data.angle_south_vertical_deg || 0;
      const results = await runPanelAnalysis(
        sceneRef.current!,
        panels,
        lat,
        angleSouth,
        (pct) => setAnalysisProgress(Math.round(pct * 100)),
        ac.signal
      );
      panelAnalysisCacheRef.current = results;
      panelOrigMatsRef.current = applyPanelColors(results);
      setShowAnalysis(true);
    } catch (e) {
      const err = e as { name?: string };
      if (err?.name !== "AbortError") console.warn("Panel analysis failed:", e);
    } finally {
      setAnalysisRunning(false);
    }
  }, [data]);

  useEffect(() => {
    return () => {
      if (analysisAbortRef.current) analysisAbortRef.current.abort();
    };
  }, []);

  const hasPanels = viewMode === "full" && (data?.panel_placements?.length || 0) > 0;
  const hasTrees = viewMode !== "roof" && Object.keys(data?.objects?.tree || {}).length > 0;

  // Snapshot capture API
  useEffect(() => {
    if (!captureMode) return;
    const w = window as any;
    const grabSquare = (): string | null => {
      const r = rendererRef.current, s = sceneRef.current, c = cameraRef.current;
      if (!r || !s || !c) return null;
      r.render(s, c);
      const src = r.domElement;
      const sw = src.width, sh = src.height;
      const size = Math.min(sw, sh);
      const ox = Math.round((sw - size) / 2);
      const oy = Math.round((sh - size) / 2);
      const tmp = document.createElement("canvas");
      tmp.width = size;
      tmp.height = size;
      const ctx = tmp.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(src, ox, oy, size, size, 0, 0, size, size);
      return tmp.toDataURL("image/jpeg", 0.85);
    };
    w.__capture3D = () => {
      try {
        const url = grabSquare();
        if (!url) throw new Error("renderer not ready");
        const rn = (window as any).ReactNativeWebView;
        if (rn) rn.postMessage(JSON.stringify({ type: "snapshot", data: url }));
        return url;
      } catch (e: any) {
        const rn = (window as any).ReactNativeWebView;
        if (rn) rn.postMessage(JSON.stringify({ type: "snapshot_error", error: String(e?.message || e) }));
        return null;
      }
    };
    w.__setSunTime = (t: number) => { setTimeOfDay(t); setDisplayTime(t); };
    w.__setCamera = (cam: string, heightVal?: string | number, zoomVal?: number, orientVal?: string) => {
      const controls = controlsRef.current, camera = cameraRef.current;
      if (!controls || !camera || !data) return;
      const W = data.width_meters;
      const H = data.height_meters;
      const diag = Math.sqrt(W * W + H * H);
      const angleSouth = data.angle_south_vertical_deg || 90;
      const zoom = zoomVal || 1;
      const orient = orientVal || "";
      let camY: number;
      if (heightVal && typeof heightVal === "string" && heightVal.startsWith("roof+")) {
        const add = parseFloat(heightVal.slice(5)) || 10;
        let maxRoofH = 0;
        try {
          for (const r of Object.values(data.roofs as any)) {
            const h = (r as any).height;
            if (typeof h === "number" && h > maxRoofH) maxRoofH = h;
          }
        } catch { /* ignore */ }
        camY = (maxRoofH || 5) + add;
      } else {
        camY = typeof heightVal === "number" ? heightVal : (parseFloat(String(heightVal || "20")) || 20);
      }

      const fovRad = (camera.fov * Math.PI) / 180;
      const fitDist = (diag / 2) / Math.tan(fovRad / 2);
      const dist = fitDist / Math.max(0.05, zoom);

      if (cam === "sw") {
        const inv = 1 / Math.SQRT2;
        camera.position.set(W / 2 + dist * inv, camY, H / 2 + dist * inv);
        controls.enableRotate = true;
        controls.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN
        };
      } else if (cam === "center") {
        camera.position.set(W / 2 + 0.001, camY, H / 2 + 0.001);
        if (orient === "ns") {
          const a = ((angleSouth || 0) * Math.PI) / 180;
          camera.up.set(-Math.cos(a), 0, -Math.sin(a));
          camera.lookAt(W / 2, 0, H / 2);
          controls.enableRotate = false;
          controls.mouseButtons = {
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE
          };
        }
      }
      controls.target.set(W / 2, 0, H / 2);
      controls.update();
      rendererRef.current?.render(sceneRef.current!, camera);
    };
    w.__captureSeries = async (hours: number[]) => {
      try {
        const out: { hour: number; data: string }[] = [];
        for (const h of hours) {
          w.__setSunTime(h);
          await new Promise((r) => setTimeout(r, 350));
          await new Promise((r) => requestAnimationFrame(() => r(undefined)));
          await new Promise((r) => requestAnimationFrame(() => r(undefined)));
          const url = grabSquare();
          if (url) out.push({ hour: h, data: url });
        }
        const rn = (window as any).ReactNativeWebView;
        if (rn) rn.postMessage(JSON.stringify({ type: "snapshot_series", data: out }));
      } catch (e: any) {
        const rn = (window as any).ReactNativeWebView;
        if (rn) rn.postMessage(JSON.stringify({ type: "snapshot_error", error: String(e?.message || e) }));
      }
    };
    const rn = (window as any).ReactNativeWebView;
    if (rn) rn.postMessage(JSON.stringify({ type: "capture_ready" }));
    return () => {
      delete w.__capture3D;
      delete w.__captureSeries;
      delete w.__setSunTime;
      delete w.__setCamera;
    };
  }, [captureMode, data]);

  const formatTime = (t: number) => {
    const h = Math.floor(t), m = Math.round((t - h) * 60);
    return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  };

  const handleZoomIn = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
    offset.multiplyScalar(0.85); // zoom in by 15%
    if (offset.length() < controls.minDistance) {
      offset.setLength(controls.minDistance);
    }
    camera.position.copy(controls.target).add(offset);
    controls.update();
  };

  const handleZoomOut = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
    offset.multiplyScalar(1.15); // zoom out by 15%
    if (offset.length() > controls.maxDistance) {
      offset.setLength(controls.maxDistance);
    }
    camera.position.copy(controls.target).add(offset);
    controls.update();
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", width: "100%", background: "#0a0a0a", color: "#fff" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, border: "3px solid #2E7D32", borderTop: "3px solid transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ fontSize: 14 }}>Loading 3D View...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", width: "100%", background: "#0a0a0a", color: "#f44336", flexDirection: "column", gap: 12 }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f44336" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      <p>{error}</p>
    </div>
  );

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#0a0a0a", overflow: "hidden" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }}
        onPointerDown={() => { if (playing) setPlaying(false); }}
      />
      {!noUI && (
        <Compass angle={cameraAngle} sunAzimuth={sunAzimuth} angleSouth={data?.angle_south_vertical_deg || 0} />
      )}
      {!noUI && (
        <div style={{
          position: "absolute",
          right: 28,
          top: 120,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          zIndex: 25,
        }}>
          <button
            onClick={() => setIsPanMode(!isPanMode)}
            style={{
              width: 40, height: 40, borderRadius: 20,
              background: isPanMode ? "rgba(167,206,56,0.95)" : "rgba(28,28,30,0.87)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: isPanMode ? "#fff" : "#ccc",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
              transition: "background 0.2s, transform 0.1s",
              outline: "none",
            }}
            onMouseEnter={(e) => { if (!isPanMode) e.currentTarget.style.background = "rgba(44,44,46,0.95)"; }}
            onMouseLeave={(e) => { if (!isPanMode) e.currentTarget.style.background = "rgba(28,28,30,0.87)"; }}
            title={isPanMode ? "Switch to Orbit Mode" : "Switch to Pan Mode"}
          >
            {isPanMode ? (
              <Hand size={18} />
            ) : (
              <RotateCw size={18} />
            )}
          </button>
          <button
            onClick={handleZoomIn}
            style={{
              width: 40, height: 40, borderRadius: 20,
              background: "rgba(28,28,30,0.87)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#ccc",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
              transition: "background 0.2s, transform 0.1s",
              outline: "none",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(44,44,46,0.95)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(28,28,30,0.87)"; }}
            title="Zoom In"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          <button
            onClick={handleZoomOut}
            style={{
              width: 40, height: 40, borderRadius: 20,
              background: "rgba(28,28,30,0.87)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#ccc",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
              transition: "background 0.2s, transform 0.1s",
              outline: "none",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(44,44,46,0.95)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(28,28,30,0.87)"; }}
            title="Zoom Out"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
        </div>
      )}
      {!noUI && (
        <div style={{
          position: "absolute",
          left: "50%",
          top: 20,
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          pointerEvents: "none",
          maxWidth: "min(92vw, 360px)",
        }}>
          {(() => {
            const sm = data?.salesman;
            const company = String(sm?.company_name ?? "").trim();
            const phoneRaw = String(sm?.company_phone ?? sm?.phone ?? "").trim();
            const phone = phoneRaw ? (phoneRaw.startsWith("+") ? phoneRaw : `+91 ${phoneRaw}`) : "";
            if (!company && !phone) return null;
            return (
              <div style={{
                textAlign: "center",
                fontFamily: "Poppins, system-ui, sans-serif",
                color: "rgba(255,255,255,0.92)",
                lineHeight: 1.35,
              }}>
                {company ? (
                  <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.2 }}>{company}</div>
                ) : null}
                {phone ? (
                  <div style={{ fontWeight: 500, fontSize: 12, color: "rgba(255,255,255,0.78)", marginTop: company ? 2 : 0 }}>
                    {phone}
                  </div>
                ) : null}
              </div>
            );
          })()}
          <div style={{ display: "flex", alignItems: "center", gap: 6, height: 28 }}>
            <span style={{
              fontFamily: "Poppins, system-ui, sans-serif",
              fontWeight: 500,
              fontSize: 12,
              color: "rgba(255,255,255,0.65)",
              letterSpacing: 0.2,
            }}>Powered by</span>
            <img
              src="/gridzero-green-footer.png"
              alt="GridZero"
              style={{ height: 18, width: "auto", display: "block" }}
            />
          </div>
        </div>
      )}
      {!noUI && (
      <ControlPanel
        viewMode={viewMode}
        quality={quality} setQuality={setQuality}
        showGround={showGround} setShowGround={setShowGround}
        showRoofImage={showRoofImage} setShowRoofImage={setShowRoofImage}
        showPanels={showPanels} setShowPanels={setShowPanels}
        showTrees={showTrees} setShowTrees={setShowTrees}
        hasTrees={hasTrees}
        showAnalysis={showAnalysis} setShowAnalysis={setShowAnalysis}
        hasPanels={hasPanels}
        month={month} setMonth={setMonth}
        displayTime={displayTime}
        onTimeChange={(t) => { setDisplayTime(t); setTimeOfDay(t); if (playing) setPlaying(false); }}
        playing={playing} setPlaying={setPlaying}
        formatTime={formatTime}
        onRunAnalysis={runAnalysis}
        analysisRunning={analysisRunning}
        analysisProgress={analysisProgress}
      />
      )}
    </div>
  );
}
