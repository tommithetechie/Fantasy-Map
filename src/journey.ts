import type maplibregl from "maplibre-gl";

const DEG = Math.PI / 180;

/** Cinematic flight that keeps the current tilt choice. */
export function journeyTo(map: maplibregl.Map, lng: number, lat: number): void {
  const center = map.transform.center;
  const cos = Math.cos(center.lat * DEG);
  const dx = (lng - center.lng) * 111320 * cos;
  const dy = (lat - center.lat) * 111320;
  const dist = Math.hypot(dx, dy);
  const duration = Math.max(1600, Math.min(5400, 1300 + dist * 0.85));
  const flat = map.getPitch() < 8;
  map.flyTo({
    center: [lng, lat],
    zoom: 15.15,
    pitch: flat ? 0 : 62,
    bearing: flat ? map.getBearing() : -22,
    duration,
    curve: 1.32,
    essential: true,
  });
}
