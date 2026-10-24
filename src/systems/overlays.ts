import type { Map } from "maplibre-gl";
import { FIREFLY_CAP, NASHVILLE, PARTICLE_CAP, RAIN_CAP, SNOW_CAP } from "./constants";
import { getBasePaint, getResolved } from "./layers";
import { mountFlash, mountOverlay } from "./overlayDom";
import { parseColor, rgbCss, scaleLightness } from "./palette";
import { PARK_FALLBACKS } from "./world";
import { addTick, wake } from "./perf";
import { getPlayer } from "./progress";
import { emitRuntime, onRuntime, runtime } from "./runtime";
import { onPhase } from "./timeOfDay";

const rainX = new Float32Array(RAIN_CAP);
const rainY = new Float32Array(RAIN_CAP);
const rainSp = new Float32Array(RAIN_CAP);
const rainLen = new Float32Array(RAIN_CAP);
const snowX = new Float32Array(SNOW_CAP);
const snowY = new Float32Array(SNOW_CAP);
const snowSp = new Float32Array(SNOW_CAP);
const snowR = new Float32Array(SNOW_CAP);
const snowPhase = new Float32Array(SNOW_CAP);
const flyPhase = new Float32Array(FIREFLY_CAP);
const flyPark = new Uint8Array(FIREFLY_CAP);
const parkLng = new Float32Array(12);
const parkLat = new Float32Array(12);
const trailLng = new Float64Array(48);
const trailLat = new Float64Array(48);
const ll: [number, number] = [0, 0];

let mapRef: Map | null = null;
let fx: HTMLCanvasElement | null = null;
let fxCtx: CanvasRenderingContext2D | null = null;
let clouds: HTMLCanvasElement | null = null;
let cloudCtx: CanvasRenderingContext2D | null = null;
let flashEl: HTMLElement | null = null;
let tile: HTMLCanvasElement | null = null;
let tileCtx: CanvasRenderingContext2D | null = null;
let cssW = 1;
let cssH = 1;
let rainRamp = 0;
let snowRamp = 0;
let cloudOffsetX = 0;
let cloudOffsetY = 0;
let cloudFrame = 0;
let parkCount = 0;
let poolsReady = false;
let capAsserted = false;
let trailHead = 0;
let trailCount = 0;
let shimmerTimer = 0;
let lightningTimer = 0;
let tilePhase = "";
let cleared = true;

export function initOverlays(map: Map): void {
  mapRef = map;
  clouds = mountOverlay(map, "ferrell-clouds");
  fx = mountOverlay(map, "ferrell-fx");
  flashEl = mountFlash(map);
  fxCtx = fx.getContext("2d", { alpha: true });
  cloudCtx = clouds.getContext("2d", { alpha: true });
  tile = document.createElement("canvas");
  tile.width = 512;
  tile.height = 512;
  tileCtx = tile.getContext("2d", { alpha: true });
  seedPools();
  seedFlies();
  resize();
  window.addEventListener("resize", resize);
  map.on("idle", collectParks);
  onPhase(() => {
    tilePhase = "";
    wake();
  });
  onRuntime(() => {
    syncGrade();
    armLightning();
    if (wantsLoop()) wake();
  });
  addTick(tick);
  if (shimmerTimer) window.clearInterval(shimmerTimer);
  shimmerTimer = window.setInterval(updateShimmer, 200);
  syncGrade();
  wake();
  console.assert(RAIN_CAP <= 800 && SNOW_CAP <= 400 && FIREFLY_CAP <= 120, "particle caps");
}

function tick(dt: number, now: number): boolean {
  const map = mapRef;
  const context = fxCtx;
  if (!map || !context || !fx) return false;
  const dtSec = dt * 0.001;
  if (!runtime.effects || runtime.hidden) {
    const trailing = runtime.flying && cosmeticTrail();
    if (!cleared || trailing) {
      context.clearRect(0, 0, cssW, cssH);
      if (cloudCtx && clouds) cloudCtx.clearRect(0, 0, clouds.width, clouds.height);
      cleared = !trailing;
    }
    runtime.shimmerOwnsWater = false;
    return trailing ? drawTrail(context, map) : false;
  }
  cleared = false;
  context.clearRect(0, 0, cssW, cssH);
  const rainN = stepCount(runtime.rainTarget, "rain", dtSec);
  const snowN = stepCount(runtime.snowTarget, "snow", dtSec);
  const flies = drawFlies(context, map, now);
  drawPrecipitation(context, dtSec, rainN, snowN, now);
  const clouding = drawClouds(dtSec);
  const trailing = drawTrail(context, map);
  const total = rainN + snowN + (flies ? Math.min(FIREFLY_CAP, runtime.reducedMotion ? 60 : FIREFLY_CAP) : 0);
  if (total > PARTICLE_CAP && !capAsserted) {
    capAsserted = true;
    console.assert(false, "particle cap exceeded", total);
  }
  return rainN + snowN > 0 || flies || clouding || trailing;
}

function wantsLoop(): boolean {
  if (runtime.hidden) return false;
  if (!runtime.effects) return runtime.flying && cosmeticTrail();
  if (runtime.rainTarget > 0 || runtime.snowTarget > 0) return true;
  if (runtime.fireflies && (runtime.phase === "night" || runtime.phase === "dusk")) return true;
  if (runtime.clouds && runtime.phase !== "night" && !runtime.reducedMotion) return true;
  return cosmeticTrail();
}

function cosmeticTrail(): boolean {
  const id = getPlayer().equippedCosmeticId;
  return id === "neon-trail" || id === "river-wake";
}

function seedPools(): void {
  for (let i = 0; i < RAIN_CAP; i++) {
    rainX[i] = (i * 47) % 1000;
    rainY[i] = (i * 91) % 1000;
    rainSp[i] = 700 + ((i * 17) % 401);
    rainLen[i] = 10 + (i % 9);
  }
  for (let i = 0; i < SNOW_CAP; i++) {
    snowX[i] = (i * 53) % 1000;
    snowY[i] = (i * 29) % 1000;
    snowSp[i] = 40 + (i % 15) * 5;
    snowR[i] = 1 + (i % 3);
    snowPhase[i] = (i % 12) * 0.5;
  }
  poolsReady = true;
}

function seedFlies(): void {
  for (let i = 0; i < FIREFLY_CAP; i++) flyPhase[i] = (i % 20) * 0.31;
}

function resize(): void {
  if (!fx || !clouds) return;
  cssW = Math.max(1, fx.clientWidth || window.innerWidth);
  cssH = Math.max(1, fx.clientHeight || window.innerHeight);
  fx.width = cssW;
  fx.height = cssH;
  const cap = 1024;
  clouds.width = Math.min(cap, cssW);
  clouds.height = Math.min(cap, cssH);
  if (!poolsReady) return;
  for (let i = 0; i < RAIN_CAP; i++) {
    rainX[i] = (rainX[i] % cssW) + (rainX[i] < 0 ? cssW : 0);
    rainY[i] = (rainY[i] % cssH) + (rainY[i] < 0 ? cssH : 0);
  }
}

function stepCount(target: number, kind: "rain" | "snow", dtSec: number): number {
  const scaled = runtime.reducedMotion ? target * 0.5 : target;
  const cap = kind === "rain" ? RAIN_CAP : SNOW_CAP;
  const step = cap * dtSec;
  if (kind === "rain") {
    if (rainRamp < scaled) rainRamp = Math.min(scaled, rainRamp + step);
    else rainRamp = Math.max(scaled, rainRamp - step);
    return rainRamp | 0;
  }
  if (snowRamp < scaled) snowRamp = Math.min(scaled, snowRamp + step);
  else snowRamp = Math.max(scaled, snowRamp - step);
  return snowRamp | 0;
}

function drawPrecipitation(
  context: CanvasRenderingContext2D,
  dtSec: number,
  rainN: number,
  snowN: number,
  now: number,
): void {
  const speed = runtime.reducedMotion ? 0.6 : 1;
  const slant = runtime.windX * 0.02;
  if (rainN > 0) {
    context.strokeStyle = "#d5deea";
    context.globalAlpha = 0.45;
    context.lineWidth = 1.2;
    context.beginPath();
    for (let i = 0; i < rainN; i++) {
      rainY[i] += rainSp[i] * dtSec * speed;
      rainX[i] += slant * rainLen[i] * dtSec * 8;
      if (rainY[i] > cssH + 20) {
        rainY[i] -= cssH + rainLen[i];
        rainX[i] += 37;
      }
      if (rainX[i] > cssW + 40) rainX[i] -= cssW + 80;
      if (rainX[i] < -40) rainX[i] += cssW + 80;
      context.moveTo(rainX[i], rainY[i]);
      context.lineTo(rainX[i] + slant * 10, rainY[i] + rainLen[i]);
    }
    context.stroke();
  }
  if (snowN > 0) {
    context.fillStyle = "#f4f7fb";
    context.globalAlpha = 0.8;
    const t = now * 0.001;
    for (let i = 0; i < snowN; i++) {
      snowY[i] += snowSp[i] * dtSec * speed;
      const sway = Math.sin(t + snowPhase[i]) * 12;
      if (snowY[i] > cssH + 8) snowY[i] -= cssH + 16;
      context.fillRect(snowX[i] + sway, snowY[i], snowR[i], snowR[i]);
    }
  }
  context.globalAlpha = 1;
}

function drawFlies(context: CanvasRenderingContext2D, map: Map, now: number): boolean {
  if (!runtime.fireflies || (runtime.phase !== "night" && runtime.phase !== "dusk")) return false;
  if (parkCount === 0) return false;
  const count = runtime.reducedMotion ? 60 : FIREFLY_CAP;
  const t = now * 0.001;
  context.fillStyle = "#d6ee7a";
  for (let i = 0; i < count; i++) {
    const park = flyPark[i] % parkCount;
    ll[0] = parkLng[park] + Math.sin(flyPhase[i] + t * 0.7) * 0.00045;
    ll[1] = parkLat[park] + Math.cos(flyPhase[i] * 1.2 + t * 0.5) * 0.00032;
    const point = map.project(ll);
    if (point.x < -16 || point.y < -16 || point.x > cssW + 16 || point.y > cssH + 16) continue;
    const twinkle = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 3.1 + flyPhase[i]));
    context.globalAlpha = twinkle;
    context.fillRect(point.x, point.y, 2.2, 2.2);
  }
  context.globalAlpha = 1;
  return true;
}

function drawClouds(dtSec: number): boolean {
  const context = cloudCtx;
  const canvas = clouds;
  if (!context || !canvas) return false;
  const on = runtime.clouds && runtime.phase !== "night" && runtime.cloudOpacity > 0;
  canvas.style.opacity = on ? String(runtime.cloudOpacity) : "0";
  if (!on) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    return false;
  }
  if (tilePhase !== runtime.phase) {
    tilePhase = runtime.phase;
    rebuildTile();
  }
  if (!runtime.reducedMotion) {
    cloudOffsetX += runtime.windX * dtSec;
    cloudOffsetY += runtime.windY * dtSec;
  }
  cloudFrame = (cloudFrame + 1) & 1;
  if (cloudFrame === 1 && !runtime.reducedMotion) return true;
  const tileSize = 512;
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  if (!tile) return true;
  const ox = ((cloudOffsetX % tileSize) + tileSize) % tileSize;
  const oy = ((cloudOffsetY % tileSize) + tileSize) % tileSize;
  for (let y = -1; y <= 2; y++) {
    for (let x = -1; x <= 2; x++) {
      context.drawImage(tile, x * tileSize + ox, y * tileSize + oy);
    }
  }
  return !runtime.reducedMotion;
}

function rebuildTile(): void {
  const context = tileCtx;
  if (!context) return;
  context.clearRect(0, 0, 512, 512);
  for (let i = 0; i < 17; i++) {
    const x = (i * 97) % 512;
    const y = (i * 61) % 512;
    const radius = 78 + (i % 5) * 16;
    const gradient = context.createRadialGradient(x, y, radius * 0.15, x, y, radius);
    gradient.addColorStop(0, "rgba(48,36,18,0.5)");
    gradient.addColorStop(1, "rgba(48,36,18,0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
}

function drawTrail(context: CanvasRenderingContext2D, map: Map): boolean {
  if (!runtime.flying || !cosmeticTrail()) return false;
  const center = map.transform.center;
  const moved =
    trailCount === 0 ||
    Math.abs(center.lng - trailLng[(trailHead + 47) % 48]) > 0.00002 ||
    Math.abs(center.lat - trailLat[(trailHead + 47) % 48]) > 0.00002;
  if (moved) {
    trailLng[trailHead] = center.lng;
    trailLat[trailHead] = center.lat;
    trailHead = (trailHead + 1) % 48;
    if (trailCount < 48) trailCount += 1;
  }
  const neon = getPlayer().equippedCosmeticId === "neon-trail";
  context.lineWidth = neon ? 3 : 2.5;
  context.lineCap = "round";
  for (let i = 1; i < trailCount; i++) {
    const a = (trailHead - trailCount + i - 1 + 96) % 48;
    const b = (trailHead - trailCount + i + 96) % 48;
    ll[0] = trailLng[a];
    ll[1] = trailLat[a];
    const p0 = map.project(ll);
    ll[0] = trailLng[b];
    ll[1] = trailLat[b];
    const p1 = map.project(ll);
    context.globalAlpha = i / trailCount;
    context.strokeStyle = neon ? "#e7a2c4" : "#9fd4e2";
    context.beginPath();
    context.moveTo(p0.x, p0.y);
    context.lineTo(p1.x, p1.y);
    context.stroke();
  }
  context.globalAlpha = 1;
  return true;
}

function collectParks(): void {
  const map = mapRef;
  if (!map) return;
  const found: { lng: number; lat: number; d: number }[] = [];
  const sourceIds = new Set<string>();
  const layers = map.getStyle()?.layers ?? [];
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    if (!("source-layer" in layer) || layer["source-layer"] !== "park") continue;
    if ("source" in layer && layer.source) sourceIds.add(layer.source);
  }
  for (const source of sourceIds) {
    const features = map.querySourceFeatures(source, { sourceLayer: "park" });
    for (let i = 0; i < features.length; i++) {
      const center = centroid(features[i].geometry);
      if (!center) continue;
      const dx = center[0] - NASHVILLE.lng;
      const dy = center[1] - NASHVILLE.lat;
      found.push({ lng: center[0], lat: center[1], d: dx * dx + dy * dy });
    }
  }
  found.sort((a, b) => a.d - b.d);
  parkCount = 0;
  const limit = Math.min(12, found.length);
  for (let i = 0; i < limit; i++) {
    parkLng[i] = found[i].lng;
    parkLat[i] = found[i].lat;
    parkCount += 1;
  }
  if (parkCount === 0) {
    parkCount = Math.min(12, PARK_FALLBACKS.length);
    for (let i = 0; i < parkCount; i++) {
      parkLng[i] = PARK_FALLBACKS[i].coordinates[0];
      parkLat[i] = PARK_FALLBACKS[i].coordinates[1];
    }
  }
  for (let i = 0; i < FIREFLY_CAP; i++) flyPark[i] = parkCount === 0 ? 0 : i % parkCount;
}

function centroid(geometry: GeoJSON.Geometry): [number, number] | null {
  if (geometry.type === "Polygon") return ringCenter(geometry.coordinates[0]);
  if (geometry.type === "MultiPolygon") return ringCenter(geometry.coordinates[0]?.[0]);
  if (geometry.type === "Point") return [geometry.coordinates[0], geometry.coordinates[1]];
  return null;
}

function ringCenter(ring: number[][] | undefined): [number, number] | null {
  if (!ring || ring.length === 0) return null;
  let lng = 0;
  let lat = 0;
  const n = Math.min(ring.length, 40);
  for (let i = 0; i < n; i++) {
    lng += ring[i][0];
    lat += ring[i][1];
  }
  return [lng / n, lat / n];
}

function updateShimmer(): void {
  const map = mapRef;
  if (!map || runtime.hidden) return;
  const want = runtime.effects && shimmerWanted();
  const layers = getResolved(map);
  if (!layers.water || !map.getLayer(layers.water)) return;
  if (!want) {
    if (runtime.shimmerOwnsWater) {
      runtime.shimmerOwnsWater = false;
      const base = getBasePaint(map);
      if (base?.waterColor != null) map.setPaintProperty(layers.water, "fill-color", base.waterColor as never);
      if (base?.waterOpacity != null) {
        map.setPaintProperty(layers.water, "fill-opacity", base.waterOpacity as never);
      }
      emitRuntime();
    }
    return;
  }
  runtime.shimmerOwnsWater = true;
  const wave = 0.5 + 0.5 * Math.sin(performance.now() * 0.0022);
  const opacity = 0.82 + 0.18 * wave;
  map.setPaintProperty(layers.water, "fill-opacity", opacity);
  const base = getBasePaint(map);
  const rgb = parseColor(base?.waterColor) ?? [143, 184, 168];
  const factor = 0.96 + 0.08 * wave;
  map.setPaintProperty(layers.water, "fill-color", rgbCss(scaleLightness(rgb, factor)));
}

function shimmerWanted(): boolean {
  if (!runtime.shimmer) return false;
  if (runtime.phase === "golden") return true;
  return runtime.phase === "day" && runtime.weatherCode === 0;
}

function syncGrade(): void {
  const grade = document.getElementById("grade");
  if (!grade) return;
  let opacity = runtime.tintOpacity;
  let color = runtime.tintColor;
  if (
    runtime.phase === "golden" &&
    (runtime.weatherCode === 0 || runtime.weatherCode === 1 || runtime.weatherCode === 2) &&
    opacity < 0.16
  ) {
    opacity = 0.22;
    color = "#e39a45";
  }
  grade.style.backgroundColor = color;
  grade.style.opacity = String(opacity);
}

function armLightning(): void {
  if (lightningTimer) {
    window.clearTimeout(lightningTimer);
    lightningTimer = 0;
  }
  if (flashEl) flashEl.style.opacity = "0";
  if (!runtime.lightning || runtime.reducedMotion || runtime.hidden || !runtime.effects) return;
  const wait = 7000 + ((Math.floor(performance.now()) * 13) % 11000);
  lightningTimer = window.setTimeout(strike, wait);
}

function strike(): void {
  lightningTimer = 0;
  if (!runtime.lightning || runtime.reducedMotion || runtime.hidden || !runtime.effects || !flashEl) return;
  flash(1);
  window.setTimeout(() => flash(0), 70);
  window.setTimeout(() => flash(1), 150);
  window.setTimeout(() => flash(0), 260);
  armLightning();
}

function flash(opacity: number): void {
  if (!flashEl) return;
  flashEl.style.opacity = String(opacity);
}
