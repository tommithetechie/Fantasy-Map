import type { Map } from "maplibre-gl";
import { captureBasePaint, ensureNightWindows, getBasePaint, getResolved } from "./layers";
import { lighten, mix, parseColor, rgbCss, type RGB } from "./palette";
import { emitRuntime, runtime } from "./runtime";
import {
  dateKey,
  dayOfYear,
  phaseFor,
  phaseStrength,
  solarFromParts,
  type CivilParts,
  type Phase,
  type TimeState,
} from "./solar";
import { TZ } from "./constants";

const NIGHT_BG = "#141a2e";
const NIGHT_BUILDING = "#2a3248";
const NIGHT_WATER = "#16283f";
const DAWN_BG = "#6b4a52";
const DAWN_BUILDING = "#6e554e";
const DUSK_BG = "#4a3350";
const DUSK_BUILDING = "#54405a";
const GOLDEN_BUILDING = "#c98a3d";
const GOLDEN_BG = "#e2b15a";

const maps: Map[] = [];
const skyTouched = new WeakSet<Map>();
let frozen: { hour: number; minute: number } | null = null;
let clock = 0;
let flicker = -1;
let lastPaint = 0;
let lastPhase: Phase | null = null;
const phaseListeners: Array<(phase: Phase) => void> = [];

const chicagoFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

const offsetFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  timeZoneName: "shortOffset",
  hour: "2-digit",
});

export function onPhase(fn: (phase: Phase) => void): void {
  phaseListeners.push(fn);
}

export function getTimeState(): TimeState {
  return compute(new Date());
}

export function initTime(map: Map): void {
  frozen = readOverride();
  bindMap(map);
  wireHourglass();
  publish(true);
  if (clock) window.clearInterval(clock);
  clock = window.setInterval(() => {
    if (runtime.hidden) return;
    publish(false);
  }, 1000);
}

export function bindMap(map: Map): void {
  if (!maps.includes(map)) maps.push(map);
  const apply = (): void => {
    captureBasePaint(map);
    ensureNightWindows(map);
    paintMap(map, true);
  };
  apply();
  map.on("style.load", apply);
}

export function catchUp(): void {
  publish(true);
}

function readOverride(): { hour: number; minute: number } | null {
  const raw = new URLSearchParams(location.search).get("time");
  if (!raw || raw === "live") return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function readChicago(date: Date): CivilParts {
  const bag: Record<string, string> = {};
  const parts = chicagoFormat.formatToParts(date);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour,
    minute: Number(bag.minute),
    second: Number(bag.second),
    weekday: bag.weekday ?? "",
  };
}

function offsetHours(date: Date): number {
  const parts = offsetFormat.formatToParts(date);
  let name = "GMT-6";
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].type === "timeZoneName") name = parts[i].value;
  }
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!match) return -6;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const mins = match[3] ? Number(match[3]) : 0;
  return sign * (hours + mins / 60);
}

function compute(now: Date): TimeState {
  const live = readChicago(now);
  const parts: CivilParts = frozen
    ? { ...live, hour: frozen.hour, minute: frozen.minute, second: 0 }
    : live;
  const solar = solarFromParts(parts, offsetHours(now));
  const phase = phaseFor(solar.elevationDeg, solar.descending);
  return {
    elevationDeg: solar.elevationDeg,
    phase,
    t: phaseStrength(phase, solar.elevationDeg),
    descending: solar.descending,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
    year: parts.year,
    month: parts.month,
    day: parts.day,
    weekday: parts.weekday,
    dayOfYear: dayOfYear(parts.year, parts.month, parts.day),
    frozen: frozen !== null,
  };
}

function publish(snap: boolean): void {
  const state = compute(new Date());
  const phaseChanged = lastPhase !== state.phase;
  runtime.phase = state.phase;
  runtime.elevation = state.elevationDeg;
  runtime.hour = state.hour;
  runtime.minute = state.minute;
  runtime.month = state.month;
  runtime.day = state.day;
  runtime.year = state.year;
  runtime.weekday = state.weekday;
  runtime.dayOfYear = state.dayOfYear;
  runtime.dateKey = dateKey(state);
  runtime.frozenTime = state.frozen;
  const nowMs = performance.now();
  const due = snap || phaseChanged || state.phase === "day" || nowMs - lastPaint >= 2000;
  if (due && !runtime.hidden) {
    lastPaint = nowMs;
    for (let i = 0; i < maps.length; i++) paintMap(maps[i], snap || state.phase === "day");
  }
  if (!runtime.hidden) paintWindows(state);
  paintChrome(state);
  if (phaseChanged) {
    lastPhase = state.phase;
    for (let i = 0; i < phaseListeners.length; i++) phaseListeners[i](state.phase);
  }
  emitRuntime();
}

function paintWindows(state: TimeState): void {
  const on = state.phase === "night" || state.phase === "dusk";
  const next = on ? (Math.floor(Date.now() / 4000) % 2 === 0 ? 0.45 : 0.6) : 0;
  if (next === flicker) return;
  flicker = next;
  for (let i = 0; i < maps.length; i++) {
    const map = maps[i];
    if (!map.getLayer("ferrell-night-windows")) continue;
    map.setPaintProperty("ferrell-night-windows", "fill-extrusion-opacity", flicker);
  }
}

function paintMap(map: Map, snap: boolean): void {
  const state = getTimeState();
  const base = getBasePaint(map);
  const layers = getResolved(map);
  if (!base) return;
  if (state.phase === "day") {
    restoreDay(map, base, layers.background, layers.buildings, layers.water);
    return;
  }
  const target = phaseColors(state, base);
  const building = runtime.snowLighten ? lighten(target.building, 0.18) : target.building;
  setColor(map, layers.background, "background-color", target.background, snap);
  setColor(map, layers.buildings, "fill-extrusion-color", building, snap);
  if (layers.buildings && state.phase === "night") {
    map.setPaintProperty(layers.buildings, "fill-extrusion-opacity", 0.85);
  } else if (layers.buildings && typeof base.buildingOpacity === "number") {
    map.setPaintProperty(layers.buildings, "fill-extrusion-opacity", base.buildingOpacity);
  }
  if (!runtime.shimmerOwnsWater && layers.water) {
    if (state.phase === "night") {
      map.setPaintProperty(layers.water, "fill-color", NIGHT_WATER);
    } else if (base.waterColor != null) {
      map.setPaintProperty(layers.water, "fill-color", base.waterColor as never);
    }
  }
  paintSky(map, state, base);
}

function restoreDay(
  map: Map,
  base: NonNullable<ReturnType<typeof getBasePaint>>,
  background: string | null,
  buildings: string | null,
  water: string | null,
): void {
  if (background && base.background != null) {
    map.setPaintProperty(background, "background-color", base.background as never);
  }
  if (buildings && base.buildingColor != null) {
    map.setPaintProperty(buildings, "fill-extrusion-color", wrapGlow(base.buildingColor) as never);
  }
  if (buildings && base.buildingOpacity != null) {
    map.setPaintProperty(buildings, "fill-extrusion-opacity", base.buildingOpacity as never);
  }
  if (!runtime.shimmerOwnsWater && water) {
    if (base.waterColor != null) map.setPaintProperty(water, "fill-color", base.waterColor as never);
    if (base.waterOpacity != null) {
      map.setPaintProperty(water, "fill-opacity", base.waterOpacity as never);
    }
  }
  if (skyTouched.has(map)) {
    if (base.sky) map.setSky(base.sky);
    skyTouched.delete(map);
  }
}

const held = new WeakMap<Map, { background: RGB; building: RGB }>();

function setColor(
  map: Map,
  layer: string | null,
  prop: "background-color" | "fill-extrusion-color",
  target: RGB,
  snap: boolean,
): void {
  if (!layer || !map.getLayer(layer)) return;
  const bucket = held.get(map) ?? { background: target, building: target };
  const key = prop === "background-color" ? "background" : "building";
  const prev = bucket[key];
  const next = snap ? target : mix(prev, target, 0.65);
  bucket[key] = next;
  held.set(map, bucket);
  const value = prop === "fill-extrusion-color" ? wrapGlow(rgbCss(next)) : rgbCss(next);
  map.setPaintProperty(layer, prop, value as never);
}

function wrapGlow(color: unknown): unknown {
  if (!runtime.buildingGlow || typeof color !== "string") return color;
  return ["case", ["boolean", ["feature-state", "hover"], false], "#ffe7ad", color];
}

function phaseColors(state: TimeState, base: NonNullable<ReturnType<typeof getBasePaint>>): {
  background: RGB;
  building: RGB;
} {
  const bgBase = parseColor(base.background) ?? [230, 211, 163];
  const bldBase = parseColor(base.buildingColor) ?? [176, 141, 87];
  switch (state.phase) {
    case "night":
      return { background: parseColor(NIGHT_BG)!, building: parseColor(NIGHT_BUILDING)! };
    case "dawn":
      return { background: parseColor(DAWN_BG)!, building: parseColor(DAWN_BUILDING)! };
    case "dusk":
      return { background: parseColor(DUSK_BG)!, building: parseColor(DUSK_BUILDING)! };
    case "golden": {
      const warmBg = parseColor(GOLDEN_BG)!;
      const warmB = parseColor(GOLDEN_BUILDING)!;
      return {
        background: mix(bgBase, warmBg, state.t),
        building: mix(bldBase, warmB, state.t),
      };
    }
    case "day":
      return { background: bgBase, building: bldBase };
    default: {
      const neverPhase: never = state.phase;
      return neverPhase;
    }
  }
}

function paintSky(map: Map, state: TimeState, base: NonNullable<ReturnType<typeof getBasePaint>>): void {
  let sky = "#d8c08e";
  let horizon = "#f4e6c4";
  switch (state.phase) {
    case "night":
      sky = NIGHT_BG;
      horizon = "#2a2038";
      break;
    case "dawn":
      sky = DAWN_BG;
      horizon = "#c48a78";
      break;
    case "dusk":
      sky = DUSK_BG;
      horizon = "#7a5a68";
      break;
    case "golden":
      sky = "#e7b06a";
      horizon = "#f0d2a4";
      break;
    case "day":
      if (base.sky) map.setSky(base.sky);
      return;
    default: {
      const neverPhase: never = state.phase;
      return neverPhase;
    }
  }
  map.setSky({
    "sky-color": sky,
    "horizon-color": horizon,
    "sky-horizon-blend": 0.68,
    "atmosphere-blend": state.phase === "night" ? 0.92 : 0.8,
  });
  skyTouched.add(map);
}

function paintChrome(state: TimeState): void {
  const label = document.getElementById("hourLabel");
  const slider = document.getElementById("hour");
  const pause = document.getElementById("hourPause");
  const luminary = document.getElementById("luminary");
  if (label) {
    const hh = String(state.hour).padStart(2, "0");
    const mm = String(state.minute).padStart(2, "0");
    label.textContent = `${state.phase} · ${hh}:${mm} · ${runtime.weatherLabel}`;
  }
  if (slider instanceof HTMLInputElement && document.activeElement !== slider) {
    const value = state.hour + state.minute / 60;
    slider.value = value.toFixed(2);
  }
  if (pause) {
    pause.textContent = state.frozen ? "Hourglass: stilled" : "Hourglass: Nashville";
    pause.classList.toggle("active", !state.frozen);
  }
  if (luminary) luminary.classList.toggle("moon", state.phase === "night" || state.phase === "dusk");
}

function wireHourglass(): void {
  const slider = document.getElementById("hour");
  const pause = document.getElementById("hourPause");
  if (slider instanceof HTMLInputElement) {
    slider.addEventListener("input", () => {
      const value = Number(slider.value);
      const hour = Math.floor(value) % 24;
      const minute = Math.round((value - Math.floor(value)) * 60) % 60;
      frozen = { hour, minute };
      publish(true);
    });
  }
  if (pause instanceof HTMLButtonElement) {
    pause.addEventListener("click", () => {
      if (frozen) frozen = null;
      else {
        const state = getTimeState();
        frozen = { hour: state.hour, minute: state.minute };
      }
      publish(true);
    });
  }
  window.addEventListener("keydown", (event) => {
    if (typing(event) || runtime.flying) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.code === "BracketRight" || event.code === "BracketLeft") {
      const state = getTimeState();
      const delta = event.code === "BracketRight" ? 30 : -30;
      const total = (state.hour * 60 + state.minute + delta + 1440) % 1440;
      frozen = { hour: Math.floor(total / 60), minute: total % 60 };
      publish(true);
      event.preventDefault();
    } else if (event.code === "KeyP") {
      if (frozen) frozen = null;
      else frozen = { hour: runtime.hour, minute: runtime.minute };
      publish(true);
    }
  });
}

function typing(event: KeyboardEvent): boolean {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
}
