import type { Map } from "maplibre-gl";
import { CELL_DEG, REVEAL_RADIUS_M } from "./constants";
import { cellKey, cellOrigin, downtownCells, metersBetween } from "./geo";
import { mountOverlay } from "./overlayDom";
import { onFog, type FogUpdate } from "./progress";
import { onPhase } from "./timeOfDay";
import { showToasts } from "./toast";
import { BROADWAY_STRIP, CENTENNIAL, LANDMARKS } from "./world";

const STORAGE = "ferrell:fog:v1";
const RANGE = downtownCells();
const STRIP_KEYS = BROADWAY_STRIP.map((point) => cellKey(point[0], point[1]));

const explored = new Set<string>();
const ll: [number, number] = [0, 0];

let mapRef: Map | null = null;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let saveTimer = 0;
let fogMoveTimer = 0;
let lastSample = { lng: 0, lat: 0, at: 0 };
let wired = false;

export function initFog(map: Map): void {
  mapRef = map;
  canvas = mountOverlay(map, "ferrell-fog");
  ctx = canvas.getContext("2d", { alpha: true });
  load();
  const center = map.getCenter();
  reveal(center.lng, center.lat);
  resize();
  if (!wired) {
    wired = true;
    window.addEventListener("resize", resize);
    map.on("moveend", () => {
      // jumpTo during WASD emits moveend every frame. Debounce so the mask
      // is not rebuilt per frame; the flight sampler reveals on its own clock.
      if (fogMoveTimer) window.clearTimeout(fogMoveTimer);
      fogMoveTimer = window.setTimeout(() => {
        fogMoveTimer = 0;
        const c = map.getCenter();
        reveal(c.lng, c.lat);
      }, 180);
    });
    onPhase(() => redraw());
    const mist = document.getElementById("mistBtn");
    if (mist instanceof HTMLButtonElement) mist.addEventListener("click", toggleMist);
    const reset = document.getElementById("fogReset");
    if (reset instanceof HTMLButtonElement) reset.addEventListener("click", resetFog);
  }
  publish(true);
}

/** WASD calls this. Reveals only after 150m and at most every 500ms. */
export function revealIfFlown(lng: number, lat: number, now: number): void {
  if (now - lastSample.at < 500) return;
  if (metersBetween(lastSample.lng, lastSample.lat, lng, lat) < 150 && lastSample.at !== 0) return;
  lastSample = { lng, lat, at: now };
  reveal(lng, lat);
}

export function toggleMist(): void {
  const on = canvas?.style.visibility === "hidden";
  if (canvas) canvas.style.visibility = on ? "visible" : "hidden";
  const btn = document.getElementById("mistBtn");
  if (btn instanceof HTMLButtonElement) {
    btn.textContent = on ? "Mists: ON" : "Mists: OFF";
    btn.classList.toggle("active", on);
  }
}

export function resetFog(): void {
  explored.clear();
  try {
    localStorage.removeItem(STORAGE);
  } catch {
    /* private mode */
  }
  const map = mapRef;
  if (map) {
    const center = map.getCenter();
    reveal(center.lng, center.lat);
  } else {
    publish(true);
  }
}

function reveal(lng: number, lat: number): void {
  const cos = Math.cos((lat * Math.PI) / 180);
  const dLat = REVEAL_RADIUS_M / 111320;
  const dLng = REVEAL_RADIUS_M / (111320 * (Math.abs(cos) < 0.2 ? 0.2 : cos));
  const x0 = Math.floor((lng - dLng) / CELL_DEG);
  const x1 = Math.floor((lng + dLng) / CELL_DEG);
  const y0 = Math.floor((lat - dLat) / CELL_DEG);
  const y1 = Math.floor((lat + dLat) / CELL_DEG);
  let grew = false;
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const clng = (x + 0.5) * CELL_DEG;
      const clat = (y + 0.5) * CELL_DEG;
      if (metersBetween(lng, lat, clng, clat) > REVEAL_RADIUS_M) continue;
      const key = `${x}:${y}`;
      if (explored.has(key)) continue;
      explored.add(key);
      grew = true;
    }
  }
  publish(grew);
  if (grew) scheduleSave();
}

function publish(grew: boolean): void {
  redraw();
  const map = mapRef;
  const info = snapshot(map ? map.getZoom() : 14, grew);
  const toasts = onFog(info);
  paintChip(info.percent);
  if (toasts.length) showToasts(toasts);
}

function snapshot(zoom: number, grew: boolean): FogUpdate {
  const exploredLandmarkIds: string[] = [];
  for (let i = 0; i < LANDMARKS.length; i++) {
    const landmark = LANDMARKS[i];
    if (explored.has(cellKey(landmark.coordinates[0], landmark.coordinates[1]))) {
      exploredLandmarkIds.push(landmark.id);
    }
  }
  let stripReady = true;
  for (let i = 0; i < STRIP_KEYS.length; i++) {
    if (!explored.has(STRIP_KEYS[i])) {
      stripReady = false;
      break;
    }
  }
  return {
    exploredLandmarkIds,
    stripReady,
    centennial: explored.has(cellKey(CENTENNIAL[0], CENTENNIAL[1])),
    shelby: explored.has(cellKey(-86.724, 36.169)),
    radnor: explored.has(cellKey(-86.8096, 36.0637)),
    zoom,
    percent: (countDowntown() / RANGE.total) * 100,
    grew,
  };
}

function countDowntown(): number {
  let n = 0;
  for (const key of explored) {
    const origin = cellOrigin(key);
    if (!origin) continue;
    const x = Math.floor(origin[0] / CELL_DEG);
    const y = Math.floor(origin[1] / CELL_DEG);
    if (x >= RANGE.x0 && x < RANGE.x1 && y >= RANGE.y0 && y < RANGE.y1) n += 1;
  }
  return n;
}

function paintChip(percent: number): void {
  const chip = document.getElementById("exploredChip");
  if (!chip) return;
  const text = `Realm explored: ${percent.toFixed(1)}%`;
  if (chip.textContent !== text) chip.textContent = text;
}

/**
 * The mask is redrawn on reveal, moveend, resize, and phase changes only.
 * It intentionally lags during a camera gesture — projecting every frame
 * would blow the frame budget, and MapLibre's own camera owns that time.
 */
function redraw(): void {
  const map = mapRef;
  const context = ctx;
  const fog = canvas;
  if (!map || !context || !fog) return;
  const w = Math.max(1, fog.clientWidth);
  const h = Math.max(1, fog.clientHeight);
  if (fog.width !== w) fog.width = w;
  if (fog.height !== h) fog.height = h;
  context.globalCompositeOperation = "source-over";
  context.clearRect(0, 0, w, h);
  context.fillStyle = "rgba(24,20,14,0.88)";
  context.fillRect(0, 0, w, h);

  const bounds = map.getBounds();
  const west = bounds.getWest() - 0.004;
  const east = bounds.getEast() + 0.004;
  const south = bounds.getSouth() - 0.004;
  const north = bounds.getNorth() + 0.004;
  const quads: number[] = [];
  for (const key of explored) {
    const origin = cellOrigin(key);
    if (!origin) continue;
    const lng = origin[0];
    const lat = origin[1];
    if (lng > east || lng + CELL_DEG < west || lat > north || lat + CELL_DEG < south) continue;
    const corners = projectQuad(map, lng, lat);
    if (!corners) continue;
    quads.push(
      corners[0],
      corners[1],
      corners[2],
      corners[3],
      corners[4],
      corners[5],
      corners[6],
      corners[7],
    );
  }
  const grads = quads.length / 8 <= 600;
  context.globalCompositeOperation = "destination-out";
  for (let i = 0; i < quads.length; i += 8) {
    const x0 = quads[i];
    const y0 = quads[i + 1];
    const x1 = quads[i + 2];
    const y1 = quads[i + 3];
    const x2 = quads[i + 4];
    const y2 = quads[i + 5];
    const x3 = quads[i + 6];
    const y3 = quads[i + 7];
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.lineTo(x2, y2);
    context.lineTo(x3, y3);
    context.closePath();
    if (grads) {
      const cx = (x0 + x1 + x2 + x3) / 4;
      const cy = (y0 + y1 + y2 + y3) / 4;
      const radius = Math.max(Math.hypot(x1 - x0, y1 - y0), Math.hypot(x3 - x0, y3 - y0));
      const gradient = context.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius * 0.95);
      gradient.addColorStop(0, "rgba(0,0,0,1)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = gradient;
    } else {
      context.fillStyle = "#000";
    }
    context.fill();
  }
  context.globalCompositeOperation = "source-over";
}

function projectQuad(map: Map, lng: number, lat: number): number[] | null {
  const pts = [
    project(map, lng, lat),
    project(map, lng + CELL_DEG, lat),
    project(map, lng + CELL_DEG, lat + CELL_DEG),
    project(map, lng, lat + CELL_DEG),
  ];
  if (pts.some((point) => point === null)) return null;
  const flat: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const point = pts[i];
    if (!point) return null;
    flat.push(point.x, point.y);
  }
  return flat;
}

function project(map: Map, lng: number, lat: number): { x: number; y: number } | null {
  ll[0] = lng;
  ll[1] = lat;
  const point = map.project(ll);
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  if (point.y < -80) return null;
  return point;
}

function resize(): void {
  redraw();
}

function scheduleSave(): void {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flush, 1000);
}

function flush(): void {
  saveTimer = 0;
  try {
    localStorage.setItem(STORAGE, JSON.stringify([...explored]));
  } catch {
    /* private mode */
  }
}

function load(): void {
  explored.clear();
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    for (let i = 0; i < parsed.length; i++) {
      if (typeof parsed[i] === "string") explored.add(parsed[i]);
    }
  } catch {
    explored.clear();
  }
}

