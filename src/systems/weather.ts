import type { Map } from "maplibre-gl";
import { catchUp } from "./timeOfDay";
import { emitRuntime, runtime } from "./runtime";
import { mapWeatherCode, type WeatherMapped } from "./wmo";

const CACHE_KEY = "ferrell:weather:v1";
const URL =
  "https://api.open-meteo.com/v1/forecast?latitude=36.1627&longitude=-86.7816&current=temperature_2m,weather_code,cloud_cover,visibility,wind_speed_10m,wind_direction_10m,is_day&timezone=America%2FChicago&forecast_days=1";

type Current = {
  temperature_2m: number;
  weather_code: number;
  cloud_cover: number;
  visibility: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  is_day: number;
};

type Cache = { at: number; payload: Current };

let mapRef: Map | null = null;
let warned = false;
let timer = 0;
let override: number | null = null;

export function initWeather(map: Map): void {
  mapRef = map;
  const raw = new URLSearchParams(location.search).get("weather");
  if (raw !== null && raw !== "" && Number.isFinite(Number(raw))) override = Number(raw);
  const cached = readCache();
  const age = cached ? Date.now() - cached.at : Infinity;
  if (cached && age < 3 * 60 * 60 * 1000) apply(cached.payload);
  if (!cached || age >= 15 * 60 * 1000) void fetchWeather();
  else if (override !== null) apply(cached.payload);
  if (timer) window.clearInterval(timer);
  timer = window.setInterval(() => {
    void fetchWeather();
  }, 15 * 60 * 1000);
}

export function refreshWeatherIfStale(): void {
  const cached = readCache();
  const age = cached ? Date.now() - cached.at : Infinity;
  if (age >= 15 * 60 * 1000) void fetchWeather();
}

async function fetchWeather(): Promise<void> {
  const ctrl = new AbortController();
  const timeout = window.setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(URL, { signal: ctrl.signal });
    if (!res.ok) throw new Error("weather");
    const body: unknown = await res.json();
    const current = (body as { current?: Partial<Current> }).current;
    if (!current || typeof current.weather_code !== "number") throw new Error("weather");
    const payload: Current = {
      temperature_2m: num(current.temperature_2m, 20),
      weather_code: current.weather_code,
      cloud_cover: num(current.cloud_cover, 20),
      visibility: num(current.visibility, 10000),
      wind_speed_10m: num(current.wind_speed_10m, 12),
      wind_direction_10m: num(current.wind_direction_10m, 270),
      is_day: num(current.is_day, 1),
    };
    writeCache(payload);
    apply(payload);
  } catch {
    fail();
  } finally {
    window.clearTimeout(timeout);
  }
}

function fail(): void {
  if (!warned) {
    warned = true;
    console.warn("Ferrell weather unavailable; using fallback.");
  }
  const cached = readCache();
  if (cached && Date.now() - cached.at < 3 * 60 * 60 * 1000) {
    apply(cached.payload);
    return;
  }
  apply({
    temperature_2m: 20,
    weather_code: 2,
    cloud_cover: 40,
    visibility: 10000,
    wind_speed_10m: 12,
    wind_direction_10m: 270,
    is_day: 1,
  });
}

function apply(payload: Current): void {
  const code = override ?? payload.weather_code;
  const mapped = mapWeatherCode(code, payload.visibility);
  writeRuntime(mapped, payload);
  applyFog(mapped);
  emitRuntime();
  catchUp();
}

function writeRuntime(mapped: WeatherMapped, payload: Current): void {
  runtime.weatherCode = override ?? payload.weather_code;
  runtime.weatherLabel = mapped.label;
  runtime.rainTarget = mapped.rain;
  runtime.snowTarget = mapped.snow;
  runtime.snowLighten = mapped.snowLighten;
  runtime.shimmer = mapped.shimmer;
  runtime.fireflies = mapped.fireflies;
  runtime.cloudOpacity = mapped.cloudOpacity;
  runtime.clouds = mapped.clouds;
  runtime.lightning = mapped.lightning;
  runtime.tintOpacity = mapped.tintOpacity;
  runtime.tintColor = mapped.tintColor;
  runtime.fogRange = mapped.fogRange;
  runtime.temperatureC = payload.temperature_2m;
  runtime.apiIsDay = payload.is_day;
  runtime.weatherReady = true;
  const wind = windVector(payload.wind_speed_10m, payload.wind_direction_10m);
  runtime.windX = wind.x;
  runtime.windY = wind.y;
}

function windVector(speedKmh: number, fromDeg: number): { x: number; y: number } {
  const px = Math.max(2, Math.min(40, speedKmh * 0.45));
  const dir = ((fromDeg + 180) * Math.PI) / 180;
  return { x: Math.sin(dir) * px, y: -Math.cos(dir) * px };
}

function applyFog(mapped: WeatherMapped): void {
  const map = mapRef;
  if (!map) return;
  const maybe = map as Map & { setFog?: (fog: object | null) => void };
  if (typeof maybe.setFog !== "function") return;
  if (!mapped.fogRange) {
    maybe.setFog(null);
    return;
  }
  maybe.setFog({ range: mapped.fogRange, color: mapped.tintColor, "horizon-blend": 0.2 });
}

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Cache>;
    if (!parsed || typeof parsed.at !== "number" || typeof parsed.payload?.weather_code !== "number") {
      return null;
    }
    return parsed as Cache;
  } catch {
    return null;
  }
}

function writeCache(payload: Current): void {
  try {
    const cache: Cache = { at: Date.now(), payload };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* private mode */
  }
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
