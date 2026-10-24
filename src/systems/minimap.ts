import maplibregl, { type GeoJSONSource, type Map } from "maplibre-gl";
import type { Feature, Polygon } from "geojson";
import { fantasyStyle } from "../map-style";
import { setMiniHooks } from "./perf";
import { runtime } from "./runtime";
import { bindMap } from "./timeOfDay";

let mini: Map | null = null;
let mainRef: Map | null = null;
let marker: maplibregl.Marker | null = null;
let cone: HTMLElement | null = null;
let viewAt = 0;

const viewPoly: Feature<Polygon> = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
      ],
    ],
  },
};

export function initMinimap(main: Map): void {
  mainRef = main;
  const root = document.getElementById("ferrell-minimap");
  const holder = document.getElementById("miniMap");
  if (!root || !holder) return;
  try {
    mini = new maplibregl.Map({
      container: holder,
      style: structuredClone(fantasyStyle),
      center: main.getCenter(),
      zoom: main.getZoom() - 4.5,
      bearing: 0,
      pitch: 0,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      maxPitch: 0,
    });
  } catch (error) {
    console.warn("Ferrell minimap disabled.", error);
    root.hidden = true;
    return;
  }
  mini.on("load", () => {
    if (!mini) return;
    bindMap(mini);
    ensureViewport(mini);
    ensurePlayer(mini, main.getCenter());
    syncCamera();
    syncViewport();
  });
  main.on("move", syncCamera);
  main.on("moveend", syncViewport);
  setMiniHooks(
    () => {
      const stopper = mini as (Map & { stop?: () => void }) | null;
      stopper?.stop?.();
    },
    () => {
      mini?.resize();
      syncCamera();
      syncViewport();
    },
  );
}

function syncCamera(): void {
  const main = mainRef;
  if (!mini || !main || runtime.hidden || !mini.loaded()) return;
  const center = main.getCenter();
  mini.jumpTo({
    center,
    zoom: main.getZoom() - 4.5,
    bearing: 0,
    pitch: 0,
  });
  marker?.setLngLat(center);
  if (cone) cone.style.transform = `rotate(${main.getBearing()}deg)`;
}

function syncViewport(): void {
  const main = mainRef;
  if (!mini || !main || !mini.loaded()) return;
  const now = performance.now();
  if (runtime.flying && now - viewAt < 220) return;
  viewAt = now;
  const bounds = main.getBounds();
  const sw = bounds.getSouthWest();
  const se = bounds.getSouthEast();
  const ne = bounds.getNorthEast();
  const nw = bounds.getNorthWest();
  const ring = viewPoly.geometry.coordinates[0];
  ring[0][0] = sw.lng;
  ring[0][1] = sw.lat;
  ring[1][0] = se.lng;
  ring[1][1] = se.lat;
  ring[2][0] = ne.lng;
  ring[2][1] = ne.lat;
  ring[3][0] = nw.lng;
  ring[3][1] = nw.lat;
  ring[4][0] = sw.lng;
  ring[4][1] = sw.lat;
  const source = mini.getSource("ferrell-view");
  if (source && source.type === "geojson") (source as GeoJSONSource).setData(viewPoly);
}

function ensureViewport(map: Map): void {
  if (map.getSource("ferrell-view")) return;
  map.addSource("ferrell-view", { type: "geojson", data: viewPoly });
  map.addLayer({
    id: "ferrell-view-fill",
    type: "fill",
    source: "ferrell-view",
    paint: { "fill-color": "#e2b34a", "fill-opacity": 0.08 },
  });
  map.addLayer({
    id: "ferrell-view-line",
    type: "line",
    source: "ferrell-view",
    paint: { "line-color": "#e2b34a", "line-width": 1.5 },
  });
}

function ensurePlayer(map: Map, center: maplibregl.LngLatLike): void {
  const el = document.createElement("div");
  el.className = "mini-player";
  cone = document.createElement("div");
  cone.className = "mini-cone";
  const dot = document.createElement("div");
  dot.className = "mini-dot";
  el.append(cone, dot);
  marker = new maplibregl.Marker({ element: el, pitchAlignment: "viewport", rotationAlignment: "viewport" })
    .setLngLat(center)
    .addTo(map);
}
