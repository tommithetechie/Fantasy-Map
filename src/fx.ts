import type maplibregl from "maplibre-gl";
import { onFrame } from "./loop";
import { openLore } from "./lore";
import { QUEST_LANDMARKS } from "./quests";
import { realm } from "./state";
import { landmarks } from "./zones";

const RIVER = new Float64Array([
  -86.842, 36.198,
  -86.824, 36.182,
  -86.808, 36.168,
  -86.794, 36.164,
  -86.782, 36.174,
  -86.77, 36.169,
  -86.756, 36.16,
  -86.74, 36.152,
  -86.722, 36.142,
  -86.702, 36.13,
]);

const FIREFLY_N = 42;
const WINDOW_N = 72;
const CLOUD_N = 6;
const STAR_N = 40;
const RAIN_N = 160;
const MOTE_N = 22;

const fireLL = new Float64Array(FIREFLY_N * 2);
const fireXY = new Float32Array(FIREFLY_N * 2);
const firePhase = new Float32Array(FIREFLY_N);

const winLL = new Float64Array(WINDOW_N * 2);
const winXY = new Float32Array(WINDOW_N * 2);
const winPhase = new Float32Array(WINDOW_N);

const riverXY = new Float32Array(RIVER.length);
const markXY = new Float32Array(landmarks.length * 2);

const clouds = new Float32Array(CLOUD_N * 4);
const stars = new Float32Array(STAR_N * 3);
const rain = new Float32Array(RAIN_N * 3);
const motes = new Float32Array(MOTE_N * 4);

const pair: [number, number] = [0, 0];
const moonSprite = document.createElement("canvas");

let mapRef: maplibregl.Map | null = null;
let fx: HTMLCanvasElement | null = null;
let marks: HTMLCanvasElement | null = null;
let fxCtx: CanvasRenderingContext2D | null = null;
let markCtx: CanvasRenderingContext2D | null = null;
let cssW = 1;
let cssH = 1;
let cameraDirty = true;
let flash = 0;

const INK = "#4a3016";
const GOLD = "#e2b34a";
const GOLD_HOT = "#fff0b8";
const GOLD_DONE = "#8d7344";

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paintMoon(): void {
  moonSprite.width = 48;
  moonSprite.height = 48;
  const g = moonSprite.getContext("2d");
  if (!g) return;
  g.fillStyle = "#f3ecd4";
  g.beginPath();
  g.arc(20, 24, 14, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = "destination-out";
  g.beginPath();
  g.arc(27, 20, 12, 0, Math.PI * 2);
  g.fill();
}

function seedWorld(): void {
  paintMoon();
  const rand = mulberry(0x5a54);
  const clusters: ReadonlyArray<readonly [number, number]> = [
    [-86.8133, 36.1461],
    [-86.7227, 36.1794],
    [-86.79, 36.17],
    [-86.75, 36.16],
    [-86.8, 36.155],
  ];
  for (let i = 0; i < FIREFLY_N; i++) {
    const c = clusters[i % clusters.length];
    fireLL[i * 2] = c[0] + (rand() - 0.5) * 0.012;
    fireLL[i * 2 + 1] = c[1] + (rand() - 0.5) * 0.01;
    firePhase[i] = rand() * Math.PI * 2;
  }
  for (let i = 0; i < WINDOW_N; i++) {
    winLL[i * 2] = -86.802 + rand() * 0.045;
    winLL[i * 2 + 1] = 36.148 + rand() * 0.028;
    winPhase[i] = rand() * Math.PI * 2;
  }
  for (let i = 0; i < CLOUD_N; i++) {
    clouds[i * 4] = rand();
    clouds[i * 4 + 1] = 0.012 + rand() * 0.02;
    clouds[i * 4 + 2] = 0.08 + rand() * 0.55;
    clouds[i * 4 + 3] = 0.12 + rand() * 0.16;
  }
  for (let i = 0; i < STAR_N; i++) {
    stars[i * 3] = rand();
    stars[i * 3 + 1] = rand() * 0.28;
    stars[i * 3 + 2] = rand() * Math.PI * 2;
  }
  for (let i = 0; i < RAIN_N; i++) {
    rain[i * 3] = rand();
    rain[i * 3 + 1] = rand();
    rain[i * 3 + 2] = 0.55 + rand() * 0.9;
  }
  for (let i = 0; i < MOTE_N; i++) {
    motes[i * 4] = rand();
    motes[i * 4 + 1] = rand();
    motes[i * 4 + 2] = rand() * Math.PI * 2;
    motes[i * 4 + 3] = 0.15 + rand() * 0.35;
  }
}

function projectInto(ll: Float64Array, xy: Float32Array): void {
  const map = mapRef;
  if (!map) return;
  const n = ll.length >> 1;
  for (let i = 0; i < n; i++) {
    pair[0] = ll[i * 2];
    pair[1] = ll[i * 2 + 1];
    const p = map.project(pair);
    xy[i * 2] = p.x;
    xy[i * 2 + 1] = p.y;
  }
}

function projectLandmarks(): void {
  const map = mapRef;
  if (!map) return;
  for (let i = 0; i < landmarks.length; i++) {
    const c = landmarks[i].coordinates;
    pair[0] = c[0];
    pair[1] = c[1];
    const p = map.project(pair);
    markXY[i * 2] = p.x;
    markXY[i * 2 + 1] = p.y;
  }
}

function refreshCamera(): void {
  if (!cameraDirty) return;
  cameraDirty = false;
  projectInto(RIVER, riverXY);
  projectInto(fireLL, fireXY);
  projectInto(winLL, winXY);
  projectLandmarks();
}

function resize(): void {
  if (!fx || !marks || !fxCtx || !markCtx) return;
  cssW = fx.clientWidth;
  cssH = fx.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  fx.width = Math.max(1, Math.round(cssW));
  fx.height = Math.max(1, Math.round(cssH));
  marks.width = Math.max(1, Math.round(cssW * dpr));
  marks.height = Math.max(1, Math.round(cssH * dpr));
  markCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  markCtx.font = "700 12px Cinzel, serif";
  markCtx.lineWidth = 1.5;
  cameraDirty = true;
}

export function startFx(map: maplibregl.Map): void {
  mapRef = map;
  const fxCanvas = document.getElementById("fx");
  const markCanvas = document.getElementById("marks");
  if (!(fxCanvas instanceof HTMLCanvasElement) || !(markCanvas instanceof HTMLCanvasElement)) {
    throw new Error("Missing effect canvases");
  }
  fx = fxCanvas;
  marks = markCanvas;
  fxCtx = fx.getContext("2d", { alpha: true });
  markCtx = marks.getContext("2d", { alpha: true });
  if (!fxCtx || !markCtx) throw new Error("Canvas unsupported");
  seedWorld();
  resize();
  window.addEventListener("resize", resize);
  map.on("move", () => {
    cameraDirty = true;
  });
  map.on("click", (event) => {
    if (realm.flying) return;
    const hit = hitMarker(event.point.x, event.point.y);
    if (hit >= 0) openLore(hit);
  });
  map.on("mousemove", (event) => {
    const hit = hitMarker(event.point.x, event.point.y);
    if (hit === realm.hover) return;
    realm.hover = hit;
    map.getCanvas().style.cursor = hit >= 0 ? "pointer" : "";
  });
  onFrame(draw);
}

export function hitMarker(x: number, y: number): number {
  let best = -1;
  let bestD = 28 * 28;
  for (let i = 0; i < landmarks.length; i++) {
    const dx = markXY[i * 2] - x;
    const dy = markXY[i * 2 + 1] - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function draw(now: number, dt: number): void {
  const ctx = fxCtx;
  const mctx = markCtx;
  if (!ctx || !mctx || !mapRef) return;
  refreshCamera();
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  const pitch = mapRef.transform.pitch;
  drawClouds(ctx, now);
  if (pitch > 28) drawSkyBodies(ctx, now);
  drawRiver(ctx, now);
  drawWindows(ctx, now);
  drawFireflies(ctx, now);
  drawMotes(ctx, now);
  drawWeather(ctx, dt, now);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  mctx.clearRect(0, 0, cssW, cssH);
  drawMarkers(mctx, now);
}

function drawClouds(ctx: CanvasRenderingContext2D, now: number): void {
  const t = now * 0.001;
  const night = realm.night;
  ctx.fillStyle = "rgba(58, 40, 18, 0.16)";
  ctx.globalAlpha = (realm.weather === "clouds" || realm.weather === "rain" || realm.weather === "storm" ? 1 : 0.72) * (1 - night * 0.35);
  for (let i = 0; i < CLOUD_N; i++) {
    const o = i * 4;
    const x = ((clouds[o] + t * clouds[o + 1]) % 1.35 - 0.15) * cssW;
    const y = clouds[o + 2] * cssH;
    const rx = clouds[o + 3] * cssW;
    const ry = rx * 0.38;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + rx * 0.45, y + ry * 0.15, rx * 0.62, ry * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSkyBodies(ctx: CanvasRenderingContext2D, now: number): void {
  const hour = realm.hour;
  const night = realm.night;
  if (night < 0.82) {
    const dayT = Math.min(1, Math.max(0, (hour - 6) / 12));
    const x = dayT * cssW;
    const y = cssH * 0.46 - Math.sin(dayT * Math.PI) * cssH * 0.34;
    ctx.beginPath();
    ctx.fillStyle = realm.golden > 0.3 ? "#ffb15a" : "#f4d48a";
    ctx.globalAlpha = 0.9 * (1 - night);
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.18 * (1 - night);
    ctx.beginPath();
    ctx.arc(x, y, 48, 0, Math.PI * 2);
    ctx.fill();
  }
  if (night > 0.12) {
    const nightT = hour >= 18 ? (hour - 18) / 12 : (hour + 6) / 12;
    const clamped = nightT < 0 ? 0 : nightT > 1 ? 1 : nightT;
    const x = clamped * cssW;
    const y = cssH * 0.4 - Math.sin(clamped * Math.PI) * cssH * 0.28;
    ctx.globalAlpha = night > 1 ? 1 : night;
    ctx.drawImage(moonSprite, x - 20, y - 24);
    ctx.fillStyle = "#f7f1dc";
    for (let i = 0; i < STAR_N; i++) {
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now * 0.002 + stars[i * 3 + 2]));
      ctx.globalAlpha = night * tw * 0.85;
      ctx.fillRect(stars[i * 3] * cssW, stars[i * 3 + 1] * cssH, 1.6, 1.6);
    }
  }
  ctx.globalAlpha = 1;
}

function drawRiver(ctx: CanvasRenderingContext2D, now: number): void {
  const n = riverXY.length >> 1;
  const phase = (now * 0.00012) % 1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#f7f3e4";
  ctx.lineWidth = 5;
  ctx.globalAlpha = 0.16;
  ctx.beginPath();
  ctx.moveTo(riverXY[0], riverXY[1]);
  for (let i = 1; i < n; i++) ctx.lineTo(riverXY[i * 2], riverXY[i * 2 + 1]);
  ctx.stroke();
  ctx.lineWidth = 3;
  for (let i = 0; i < n - 1; i++) {
    const u = i / (n - 1);
    let d = u - phase;
    if (d < 0) d = -d;
    if (d > 0.5) d = 1 - d;
    if (d > 0.14) continue;
    ctx.globalAlpha = (1 - d / 0.14) * (0.45 + realm.night * 0.25);
    ctx.beginPath();
    ctx.moveTo(riverXY[i * 2], riverXY[i * 2 + 1]);
    ctx.lineTo(riverXY[(i + 1) * 2], riverXY[(i + 1) * 2 + 1]);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawWindows(ctx: CanvasRenderingContext2D, now: number): void {
  const night = realm.night;
  if (night < 0.18 || !mapRef || mapRef.getZoom() < 13) return;
  ctx.fillStyle = "#ffc56a";
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < WINDOW_N; i++) {
    const x = winXY[i * 2];
    const y = winXY[i * 2 + 1];
    if (x < -8 || y < -8 || x > cssW + 8 || y > cssH + 8) continue;
    const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now * 0.0015 + winPhase[i]));
    ctx.globalAlpha = night * tw * 0.85;
    ctx.fillRect(x, y, 2.2, 3.2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function drawFireflies(ctx: CanvasRenderingContext2D, now: number): void {
  const night = realm.night;
  if (night < 0.25) return;
  const t = now * 0.001;
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = "#d7e68a";
  for (let i = 0; i < FIREFLY_N; i++) {
    const ax = fireXY[i * 2];
    const ay = fireXY[i * 2 + 1];
    if (ax < -30 || ay < -30 || ax > cssW + 30 || ay > cssH + 30) continue;
    const ph = firePhase[i];
    const x = ax + Math.sin(t * 0.7 + ph) * 16;
    const y = ay + Math.cos(t * 0.55 + ph) * 10;
    const tw = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 3.2 + ph));
    ctx.globalAlpha = night * tw;
    ctx.beginPath();
    ctx.arc(x, y, 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function drawMotes(ctx: CanvasRenderingContext2D, now: number): void {
  if (realm.golden < 0.28 || realm.night > 0.35) return;
  const t = now * 0.001;
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = "#ffd27a";
  for (let i = 0; i < MOTE_N; i++) {
    const o = i * 4;
    const x = ((motes[o] + t * motes[o + 3] * 0.05) % 1) * cssW;
    const y = ((motes[o + 1] + Math.sin(t + motes[o + 2]) * 0.02) % 1) * cssH;
    ctx.globalAlpha = realm.golden * (0.35 + 0.4 * (0.5 + 0.5 * Math.sin(t * 2 + motes[o + 2])));
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function drawWeather(ctx: CanvasRenderingContext2D, dt: number, now: number): void {
  const kind = realm.weather;
  if (kind === "storm") {
    flash -= dt;
    if (flash <= 0 && (now % 7000) < 40) flash = 0.12;
    if (flash > 0) {
      ctx.fillStyle = "#f7f1e2";
      ctx.globalAlpha = flash * 2.2;
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.globalAlpha = 1;
    }
  }
  if (kind !== "rain" && kind !== "storm" && kind !== "snow") return;
  const snow = kind === "snow";
  ctx.strokeStyle = snow ? "#f4f0e4" : "#d5deea";
  ctx.globalAlpha = snow ? 0.55 : 0.35;
  ctx.lineWidth = snow ? 2 : 1.2;
  ctx.beginPath();
  for (let i = 0; i < RAIN_N; i++) {
    const o = i * 3;
    rain[o + 1] += dt * rain[o + 2] * (snow ? 0.18 : 0.85);
    if (rain[o + 1] > 1.05) {
      rain[o + 1] -= 1.1;
      rain[o] = (rain[o] + 0.173) % 1;
    }
    const x = rain[o] * cssW;
    const y = rain[o + 1] * cssH;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (snow ? 1.2 : 7), y + (snow ? 2 : 16));
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function markerKind(index: number): "active" | "done" | "idle" {
  const step = realm.step;
  const id = landmarks[index].id;
  let done = false;
  let inChain = false;
  for (let i = 0; i < QUEST_LANDMARKS.length; i++) {
    if (QUEST_LANDMARKS[i] !== id) continue;
    inChain = true;
    if (i === step) return "active";
    if (i < step) done = true;
  }
  if (done || (inChain && step >= QUEST_LANDMARKS.length)) return "done";
  return "idle";
}

function drawMarkers(ctx: CanvasRenderingContext2D, now: number): void {
  for (let i = 0; i < landmarks.length; i++) {
    const x = markXY[i * 2];
    const y = markXY[i * 2 + 1];
    if (x < -40 || y < -40 || x > cssW + 40 || y > cssH + 40) continue;
    const kind = markerKind(i);
    const hot = realm.hover === i;
    const bob = kind === "done" ? Math.sin(now * 0.002 + i) * 2 : Math.sin(now * 0.004 + i) * 6;
    const py = y + bob;
    if (kind === "active") {
      const pulse = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(now * 0.005));
      ctx.beginPath();
      ctx.strokeStyle = GOLD_HOT;
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 2;
      ctx.arc(x, py, 18 + pulse * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.moveTo(x, py - 16);
    ctx.lineTo(x + 9, py - 2);
    ctx.lineTo(x, py + 8);
    ctx.lineTo(x - 9, py - 2);
    ctx.closePath();
    ctx.fillStyle = hot ? GOLD_HOT : kind === "done" ? GOLD_DONE : GOLD;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    if (kind === "active") {
      ctx.fillStyle = INK;
      ctx.globalAlpha = 1;
      ctx.fillText("!", x - 3, py + 2);
    }
  }
}
