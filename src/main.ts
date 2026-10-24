import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import { fantasyStyle } from "./map-style";
import { initControls } from "./systems/controls";
import { initFog } from "./systems/fogOfWar";
import { initMinimap } from "./systems/minimap";
import { initOverlays } from "./systems/overlays";
import { initPerf, setVisibleHook } from "./systems/perf";
import { initProgress } from "./systems/progress";
import { catchUp, initTime } from "./systems/timeOfDay";
import { initWeather, refreshWeatherIfStale } from "./systems/weather";

const map = new maplibregl.Map({
  container: "map",
  style: fantasyStyle,
  center: [-86.7816, 36.1627], // downtown Nashville
  zoom: 14.5,
  pitch: 60,
  bearing: -25,
  maxPitch: 85,
  attributionControl: { compact: true },
});

map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), "bottom-left");

const compass = document.getElementById("compass");
function syncCompass(): void {
  if (!compass) return;
  compass.style.transform = `rotate(${-map.getBearing()}deg)`;
}
syncCompass();
map.on("rotate", syncCompass);

function requireButton(id: string): HTMLButtonElement {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error(`Missing button #${id}`);
  }
  return el;
}

/* 3D tilt toggle */
const tiltBtn = requireButton("tiltBtn");
tiltBtn.addEventListener("click", () => {
  const tilted = map.getPitch() > 0;
  map.easeTo({ pitch: tilted ? 0 : 60, duration: 900 });
  tiltBtn.textContent = "3D tilt: " + (tilted ? "OFF" : "ON");
  tiltBtn.classList.toggle("active", !tilted);
});

/* zone-name toggle */
const zonesBtn = requireButton("zonesBtn");
zonesBtn.addEventListener("click", () => {
  const on = map.getLayoutProperty("fantasy_zones", "visibility") !== "none";
  map.setLayoutProperty("fantasy_zones", "visibility", on ? "none" : "visible");
  zonesBtn.textContent = "Zone names: " + (on ? "OFF" : "ON");
  zonesBtn.classList.toggle("active", !on);
});

/* how-to panel */
const howto = document.getElementById("howto");
if (!howto) throw new Error("Missing #howto");
requireButton("howtoBtn").addEventListener("click", () => {
  howto.style.display = howto.style.display === "block" ? "none" : "block";
});

map.on("load", () => {
  initPerf(map);
  initTime(map);
  initProgress();
  initWeather(map);
  initOverlays(map);
  initFog(map);
  initControls(map);
  initMinimap(map);
  setVisibleHook(() => {
    catchUp();
    refreshWeatherIfStale();
  });
});

map.on("moveend", () => {
  const on = map.getPitch() > 5;
  tiltBtn.textContent = "3D tilt: " + (on ? "ON" : "OFF");
  tiltBtn.classList.toggle("active", on);
});

/* export the style JSON for Maputnik */
requireButton("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(fantasyStyle, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "realm-of-nash-style.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
});
