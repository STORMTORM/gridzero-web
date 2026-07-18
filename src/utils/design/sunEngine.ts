import * as THREE from "three";
import type { SunPath } from "./types";

const DEG = Math.PI / 180;

/**
 * Look up the sun's ENU direction from the backend-precomputed table (pvlib).
 * Returns null when the table is absent or the requested day isn't present, so
 * callers can fall back to sunDirectionENU().
 *
 * dayOfMonth must be a precomputed day (the 15th). hourOfDay is snapped to the
 * nearest 15-min slot: index = round((hour - start_hour) * 4), clamped to the
 * available range (06:00..19:00).
 */
export function sunENUFromPath(
  sp: SunPath | null | undefined,
  month: number,
  dayOfMonth: number,
  hourOfDay: number
): [number, number, number] | null {
  if (!sp?.enu) return null;
  const label = `${String(month).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
  const rows = sp.enu[label];
  if (!rows || rows.length === 0) return null;
  let slot = Math.round((hourOfDay - (sp.start_hour ?? 0)) * 4);
  if (slot < 0) slot = 0;
  else if (slot > rows.length - 1) slot = rows.length - 1;
  const v = rows[slot];
  return v ? [v[0], v[1], v[2]] : null;
}


/**
 * Compute sun direction in ENU (East-North-Up) for a given latitude, month, and hour.
 */
export function sunDirectionENU(latDeg: number, month: number, hourOfDay: number): [number, number, number] {
  const decl = 23.44 * Math.sin(2 * Math.PI * (month - 3) / 12) * DEG;
  const H = (Math.PI / 12) * (hourOfDay - 12);
  const lat = latDeg * DEG;

  const east = -Math.cos(decl) * Math.sin(H);
  const north = Math.cos(lat) * Math.sin(decl) - Math.sin(lat) * Math.cos(decl) * Math.cos(H);
  const up = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(H);

  return [east, north, up];
}

/**
 * Convert ENU sun direction to scene coordinates.
 * Scene: X=right, Y=up, Z=down (image-Y).
 * angleSouthDeg = angle from image-down direction to true south.
 */
export function sunToScene(
  enu: [number, number, number],
  angleSouthDeg: number
): THREE.Vector3 {
  const [eastIn, northIn, up] = enu;
  // Rotate sun position 90° clockwise in horizontal plane (Z up).
  // Corrects initial sun direction so it rises in the east, not the north.
  const east = northIn;
  const north = -eastIn;
  const a = angleSouthDeg * DEG;
  const cosA = Math.cos(a);
  const sinA = Math.sin(a);

  // Image coords: imgRight, imgDown
  // South points along imgDown rotated by angleSouth
  const southX = sinA;
  const southZ = cosA;
  const eastX = cosA;
  const eastZ = -sinA;

  const x = east * eastX + north * (-southX);
  const z = east * eastZ + north * (-southZ);
  const y = up;

  return new THREE.Vector3(x, y, z).normalize();
}

/**
 * Update directional light to match sun position.
 */
export function updateSunLight(
  light: THREE.DirectionalLight,
  sunDir: THREE.Vector3,
  sceneCenter: THREE.Vector3,
  sceneRadius: number
) {
  const sunDist = sceneRadius * 2;
  light.position.copy(sceneCenter).addScaledVector(sunDir, sunDist);
  light.target.position.copy(sceneCenter);

  const cam = light.shadow.camera as THREE.OrthographicCamera;
  const halfSize = sceneRadius * 0.95;
  cam.left = -halfSize;
  cam.right = halfSize;
  cam.top = halfSize;
  cam.bottom = -halfSize;
  cam.far = sunDist * 3;
  cam.updateProjectionMatrix();

  light.shadow.needsUpdate = true;
}

/**
 * Get sun azimuth in degrees (0=North, clockwise) for compass display.
 */
export function getSunAzimuthDeg(enu: [number, number, number]): number {
  const [east, north] = enu;
  let az = Math.atan2(east, north) / DEG;
  if (az < 0) az += 360;
  return az;
}
