import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import { startAtmosphere } from "./atmosphere";
import { startFog } from "./fog";
import { startFly } from "./fly";
import { startFx } from "./fx";
import { startLore } from "./lore";
import { startLoop } from "./loop";
import { fantasyStyle } from "./map-style";
import { startQuests } from "./quests";
import { startWeather } from "./weather";

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

map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), "bottom-right");

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
  startAtmosphere(map);
  startLore(map);
  startQuests(map);
  startFx(map);
  startFly(map);
  startWeather();
  startFog(map);
  startLoop();
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
