import type maplibregl from "maplibre-gl";
import { journeyTo } from "./journey";
import { onFrame } from "./loop";
import { QUEST_LANDMARKS } from "./quests";
import { loadFog, saveFog } from "./save";
import { realm } from "./state";
import { landmarks } from "./zones";

const WEST = -86.88;
const EAST = -86.64;
const SOUTH = 36.07;
const NORTH = 36.24;
const COLS = 120;
const ROWS = 90;
const MW = 176;
const MH = 118;
const DEG = Math.PI / 180;

const cells = new Uint8Array(COLS * ROWS);
const grid = document.createElement("canvas");
grid.width = COLS;
grid.height = ROWS;

const RIVER = new Float64Array([
  -86.842, 36.198, -86.824, 36.182, -86.808, 36.168, -86.794, 36.164,
  -86.782, 36.174, -86.77, 36.169, -86.756, 36.16, -86.74, 36.152,
  -86.722, 36.142, -86.702, 36.13,
]);

let mapRef: maplibregl.Map | null = null;
let fog: HTMLCanvasElement | null = null;
let fogCtx: CanvasRenderingContext2D | null = null;
let mini: HTMLCanvasElement | null = null;
let miniCtx: CanvasRenderingContext2D | null = null;
let gridCtx: CanvasRenderingContext2D | null = null;
let cssW = 1;
let cssH = 1;
let moved = true;
let cellsChanged = false;
let acc = 0;
let saveAcc = 0;

function idx(x: number, y: number): number {
  return y * COLS + x;
}

function revealDisc(lng: number, lat: number, radiusM: number): boolean {
  const cos = Math.cos(lat * DEG);
  const metersLng = 111320 * (Math.abs(cos) < 0.01 ? 0.01 : cos);
  const rx = (radiusM / metersLng / (EAST - WEST)) * COLS;
  const ry = (radiusM / 111320 / (NORTH - SOUTH)) * ROWS;
  const cx = ((lng - WEST) / (EAST - WEST)) * COLS;
  const cy = ((NORTH - lat) / (NORTH - SOUTH)) * ROWS;
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(COLS - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(ROWS - 1, Math.ceil(cy + ry));
  const rx2 = rx * rx;
  const ry2 = ry * ry;
  if (rx2 < 0.01 || ry2 < 0.01) return false;
  let changed = false;
  for (let y = y0; y <= y1; y++) {
    const dy = (y + 0.5 - cy) / ry;
    for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / rx;
      if (dx * dx + dy * dy > 1) continue;
      const i = idx(x, y);
      if (cells[i]) continue;
      cells[i] = 1;
      changed = true;
    }
  }
  return changed;
}

function radiusForZoom(zoom: number): number {
  return 460 * Math.pow(2, 15 - zoom);
}

function paintGrid(): void {
  const g = gridCtx;
  if (!g) return;
  g.globalCompositeOperation = "source-over";
  g.fillStyle = "rgba(58,40,18,0.42)";
  g.fillRect(0, 0, COLS, ROWS);
  g.globalCompositeOperation = "destination-out";
  g.fillStyle = "#000";
  for (let i = 0; i < cells.length; i++) {
    if (!cells[i]) continue;
    g.fillRect(i % COLS, (i / COLS) | 0, 1, 1);
  }
  g.globalCompositeOperation = "source-over";
}

function paintFog(): void {
  const ctx = fogCtx;
  if (!ctx || !fog) return;
  ctx.clearRect(0, 0, cssW, cssH);
  if (!realm.mist) return;
  ctx.imageSmoothingEnabled = true;
  ctx.filter = "blur(14px)";
  ctx.drawImage(grid, -24, -24, cssW + 48, cssH + 48);
  ctx.filter = "none";
}

function paintMini(): void {
  const ctx = miniCtx;
  const map = mapRef;
  if (!ctx || !map) return;
  ctx.fillStyle = "#e4d0a4";
  ctx.fillRect(0, 0, MW, MH);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(grid, 0, 0, MW, MH);
  ctx.strokeStyle = "#6b9a8e";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i < RIVER.length; i += 2) {
    const x = ((RIVER[i] - WEST) / (EAST - WEST)) * MW;
    const y = ((NORTH - RIVER[i + 1]) / (NORTH - SOUTH)) * MH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  const step = realm.step;
  for (let i = 0; i < landmarks.length; i++) {
    const c = landmarks[i].coordinates;
    const x = ((c[0] - WEST) / (EAST - WEST)) * MW;
    const y = ((NORTH - c[1]) / (NORTH - SOUTH)) * MH;
    const active = step < QUEST_LANDMARKS.length && landmarks[i].id === QUEST_LANDMARKS[step];
    ctx.fillStyle = active ? "#e2b34a" : "#4a3016";
    ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  const center = map.transform.center;
  const px = ((center.lng - WEST) / (EAST - WEST)) * MW;
  const py = ((NORTH - center.lat) / (NORTH - SOUTH)) * MH;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(map.transform.bearing * DEG);
  ctx.fillStyle = "#f4e7c3";
  ctx.strokeStyle = "#4a3016";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4.5, 5);
  ctx.lineTo(0, 3);
  ctx.lineTo(-4.5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function resize(): void {
  if (!fog) return;
  cssW = Math.max(1, fog.clientWidth);
  cssH = Math.max(1, fog.clientHeight);
  fog.width = cssW;
  fog.height = cssH;
  paintFog();
}

function encodeFog(): string {
  let binary = "";
  for (let i = 0; i < cells.length; i++) binary += String.fromCharCode(cells[i]);
  return btoa(binary);
}

function decodeFog(value: string): boolean {
  try {
    const binary = atob(value);
    if (binary.length !== cells.length) return false;
    for (let i = 0; i < cells.length; i++) cells[i] = binary.charCodeAt(i) ? 1 : 0;
    return true;
  } catch {
    return false;
  }
}

function toggleMist(): void {
  realm.mist = !realm.mist;
  const btn = document.getElementById("mistBtn");
  if (btn instanceof HTMLButtonElement) {
    btn.textContent = realm.mist ? "Mists: ON" : "Mists: OFF";
    btn.classList.toggle("active", realm.mist);
  }
  if (fog) fog.style.visibility = realm.mist ? "visible" : "hidden";
  paintFog();
}

function onMiniClick(event: MouseEvent): void {
  const map = mapRef;
  const canvas = mini;
  if (!map || !canvas) return;
  const rect = canvas.getBoundingClientRect();
  const u = (event.clientX - rect.left) / rect.width;
  const v = (event.clientY - rect.top) / rect.height;
  if (u < 0 || v < 0 || u > 1 || v > 1) return;
  journeyTo(map, WEST + u * (EAST - WEST), NORTH - v * (NORTH - SOUTH));
}

export function startFog(map: maplibregl.Map): void {
  mapRef = map;
  const fogCanvas = document.getElementById("fog");
  const miniCanvas = document.getElementById("mini");
  const mistBtn = document.getElementById("mistBtn");
  if (!(fogCanvas instanceof HTMLCanvasElement) || !(miniCanvas instanceof HTMLCanvasElement)) {
    throw new Error("Missing fog canvases");
  }
  if (!(mistBtn instanceof HTMLButtonElement)) throw new Error("Missing #mistBtn");
  fog = fogCanvas;
  mini = miniCanvas;
  fogCtx = fog.getContext("2d", { alpha: true });
  miniCtx = mini.getContext("2d", { alpha: true });
  gridCtx = grid.getContext("2d", { alpha: true });
  if (!fogCtx || !miniCtx || !gridCtx) throw new Error("Canvas unsupported");

  const saved = loadFog();
  if (!saved || !decodeFog(saved)) cells.fill(0);
  const home = landmarks[0].coordinates;
  revealDisc(home[0], home[1], 6200);
  revealDisc(map.transform.center.lng, map.transform.center.lat, radiusForZoom(map.transform.zoom));

  mistBtn.addEventListener("click", toggleMist);
  mini.addEventListener("click", onMiniClick);
  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.code === "KeyM") toggleMist();
  });
  window.addEventListener("resize", resize);
  map.on("move", () => {
    moved = true;
  });
  paintGrid();
  resize();
  paintMini();

  onFrame((_now, dt) => {
    acc += dt;
    if (cellsChanged) {
      saveAcc += dt;
      if (saveAcc > 0.6) {
        saveAcc = 0;
        cellsChanged = false;
        saveFog(encodeFog());
      }
    }
    if (!moved || acc < 0.16) return;
    acc = 0;
    moved = false;
    const center = map.transform.center;
    if (revealDisc(center.lng, center.lat, radiusForZoom(map.transform.zoom))) {
      cellsChanged = true;
      paintGrid();
      paintFog();
    }
    paintMini();
  });
}
