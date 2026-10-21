import type maplibregl from "maplibre-gl";
import { onFrame } from "./loop";
import { goldenAmount, hourName, nightAmount, realm } from "./state";

const DAY_SECONDS = 150;
const HOUR_RATE = 24 / DAY_SECONDS;

const DAY_BUILDING = "#b08d57";
const NIGHT_BUILDING = "#6a5130";
const DAY_WATER = "#8fb8a8";
const NIGHT_WATER = "#6d9084";

let mapRef: maplibregl.Map | null = null;
let grade: HTMLElement | null = null;
let label: HTMLElement | null = null;
let slider: HTMLInputElement | null = null;
let pauseBtn: HTMLButtonElement | null = null;
let luminary: HTMLElement | null = null;
let scrubbing = false;
let bucket = -1;
let builtNight = false;
let reduceMotion = false;

const lightPos: [number, number, number] = [1.15, 210, 40];

function requireEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}

export function startAtmosphere(map: maplibregl.Map): void {
  mapRef = map;
  grade = requireEl("grade");
  label = requireEl("hourLabel");
  slider = requireEl<HTMLInputElement>("hour");
  pauseBtn = requireEl<HTMLButtonElement>("hourPause");
  luminary = requireEl("luminary");
  reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) realm.paused = true;

  slider.value = sliderValue(realm.hour);
  slider.addEventListener("pointerdown", () => {
    scrubbing = true;
  });
  slider.addEventListener("pointerup", () => {
    scrubbing = false;
  });
  slider.addEventListener("input", () => {
    realm.hour = Number(slider!.value);
    publish(true);
  });
  pauseBtn.addEventListener("click", togglePause);
  window.addEventListener("keydown", onKey);

  map.setSky({
    "sky-color": "#d9c090",
    "horizon-color": "#f4e6c4",
    "sky-horizon-blend": 0.62,
    "atmosphere-blend": 0.78,
  });

  bucket = (realm.hour * 4) | 0;
  syncDerived();
  paintChrome();
  onFrame((_now, dt) => {
    if (!realm.paused && !scrubbing) {
      realm.hour += dt * HOUR_RATE;
      if (realm.hour >= 24) realm.hour -= 24;
    }
    const next = (realm.hour * 4) | 0;
    if (next !== bucket) {
      bucket = next;
      publish(false);
    }
  });
}

export function shiftHour(delta: number): void {
  realm.hour = (realm.hour + delta) % 24;
  if (realm.hour < 0) realm.hour += 24;
  publish(true);
}

function togglePause(): void {
  realm.paused = !realm.paused;
  if (pauseBtn) {
    pauseBtn.textContent = realm.paused ? "Hourglass: stilled" : "Hourglass: running";
    pauseBtn.classList.toggle("active", !realm.paused);
  }
}

function onKey(event: KeyboardEvent): void {
  if (event.target instanceof HTMLInputElement) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.code === "BracketRight") {
    shiftHour(0.8);
    event.preventDefault();
  } else if (event.code === "BracketLeft") {
    shiftHour(-0.8);
    event.preventDefault();
  } else if (event.code === "KeyP") {
    togglePause();
  }
}

function sliderValue(hour: number): string {
  const snapped = Math.round(hour * 100) / 100;
  return snapped.toFixed(2);
}

function syncDerived(): void {
  realm.night = nightAmount(realm.hour);
  realm.golden = goldenAmount(realm.hour);
}

function publish(forceSlider: boolean): void {
  syncDerived();
  paintChrome();
  if (forceSlider && slider && !scrubbing) slider.value = sliderValue(realm.hour);
  else if (slider && document.activeElement !== slider) slider.value = sliderValue(realm.hour);
  applyWorldLight();
  applyBuildingNight();
}

function paintChrome(): void {
  if (!label || !grade || !luminary) return;
  label.textContent = `${cap(hourName(realm.hour))} · ${realm.weatherTitle}`;
  label.title = realm.weatherDetail;
  const night = realm.night;
  const golden = realm.golden;
  const weather = realm.weather;
  grade.className = "";
  if (night > 0.45) grade.classList.add("night");
  else if (weather === "storm") grade.classList.add("storm");
  else if (weather === "rain" || weather === "snow") grade.classList.add("rain");
  else if (weather === "fog") grade.classList.add("misty");
  else if (golden > 0.35) grade.classList.add("golden");
  else if (realm.weatherLive && weather === "clear" && night < 0.2) grade.classList.add("fair");
  luminary.classList.toggle("moon", night > 0.55);
}

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function applyWorldLight(): void {
  const map = mapRef;
  if (!map) return;
  const night = realm.night;
  const golden = realm.golden;
  const hour = realm.hour;
  const dayT = Math.min(1, Math.max(0, (hour - 6) / 12));
  const polar = night > 0.55 ? 108 : 80 - Math.sin(dayT * Math.PI) * 58;
  const azimuth = night > 0.55 ? 20 : (270 + dayT * 180) % 360;
  lightPos[1] = azimuth;
  lightPos[2] = polar;

  let color = "#fff6e8";
  let intensity = 0.48;
  if (golden > 0.35) {
    color = "#ffc078";
    intensity = 0.66;
  } else if (realm.weather === "clear" && night < 0.25) {
    color = "#ffe3ad";
    intensity = 0.56;
  }
  if (night > 0.55) {
    color = "#9eb4dc";
    intensity = 0.2;
  }
  if (realm.weather === "rain" || realm.weather === "storm" || realm.weather === "snow") {
    color = "#c9d4e0";
    intensity = night > 0.55 ? 0.16 : 0.32;
  }
  if (realm.weather === "fog") {
    color = "#d9d3c4";
    intensity = 0.28;
  }

  map.setLight({
    anchor: "viewport",
    position: lightPos,
    color,
    intensity,
  });

  const sky = night > 0.55 ? "#1a2236" : golden > 0.35 ? "#e39a52" : "#d8c08e";
  const horizon = night > 0.55 ? "#3c2c22" : golden > 0.35 ? "#f0c48a" : "#f4e6c4";
  map.setSky({
    "sky-color": sky,
    "horizon-color": horizon,
    "sky-horizon-blend": 0.66,
    "atmosphere-blend": night > 0.4 ? 0.92 : 0.8,
  });
}

function applyBuildingNight(): void {
  const map = mapRef;
  if (!map) return;
  const wantNight = realm.night > 0.62;
  if (wantNight === builtNight) return;
  builtNight = wantNight;
  const walls = wantNight ? NIGHT_BUILDING : DAY_BUILDING;
  const water = wantNight ? NIGHT_WATER : DAY_WATER;
  map.setPaintProperty("building", "fill-color", walls);
  map.setPaintProperty("building-3d", "fill-extrusion-color", walls);
  map.setPaintProperty("water", "fill-color", water);
}

/** Weather (or a scrub) changed the light story. Refresh immediately. */
export function refreshAtmosphere(): void {
  bucket = (realm.hour * 4) | 0;
  publish(false);
}
