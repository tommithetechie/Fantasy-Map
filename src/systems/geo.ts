import { CELL_DEG, DOWNTOWN_BBOX } from "./constants";

const DEG = Math.PI / 180;

export function metersBetween(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const cos = Math.cos(lat1 * DEG);
  const dx = (lng2 - lng1) * 111320 * (Math.abs(cos) < 0.01 ? 0.01 : cos);
  const dy = (lat2 - lat1) * 111320;
  return Math.hypot(dx, dy);
}

export function cellKey(lng: number, lat: number): string {
  return `${Math.floor(lng / CELL_DEG)}:${Math.floor(lat / CELL_DEG)}`;
}

export function downtownCells(): { x0: number; x1: number; y0: number; y1: number; total: number } {
  const x0 = Math.floor(DOWNTOWN_BBOX[0] / CELL_DEG);
  const x1 = Math.floor(DOWNTOWN_BBOX[2] / CELL_DEG);
  const y0 = Math.floor(DOWNTOWN_BBOX[1] / CELL_DEG);
  const y1 = Math.floor(DOWNTOWN_BBOX[3] / CELL_DEG);
  return { x0, x1, y0, y1, total: (x1 - x0) * (y1 - y0) };
}

export function cellOrigin(key: string): [number, number] | null {
  const split = key.indexOf(":");
  if (split < 0) return null;
  const x = Number(key.slice(0, split));
  const y = Number(key.slice(split + 1));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [x * CELL_DEG, y * CELL_DEG];
}
