import type { Phase } from "./solar";

/**
 * Cross-system flags. Modules write their own fields and read the rest
 * so the map systems do not import each other in a circle.
 */
export const runtime = {
  reducedMotion: false,
  effects: true,
  hidden: false,
  flying: false,
  mist: true,
  buildingGlow: false,
  shimmerOwnsWater: false,
  phase: "day" as Phase,
  elevation: 40,
  hour: 12,
  minute: 0,
  month: 1,
  day: 1,
  year: 2026,
  weekday: "Thu",
  dayOfYear: 1,
  dateKey: "2026-01-01",
  frozenTime: false,
  weatherCode: 2,
  weatherLabel: "Mainly clear",
  rainTarget: 0,
  snowTarget: 0,
  snowLighten: false,
  shimmer: false,
  fireflies: false,
  cloudOpacity: 0.16,
  clouds: true,
  lightning: false,
  tintOpacity: 0,
  tintColor: "#66788a",
  fogRange: null as [number, number] | null,
  windX: 6,
  windY: 0,
  temperatureC: 20,
  weatherReady: false,
  apiIsDay: 1,
};

type Listener = () => void;
const listeners: Listener[] = [];

export function onRuntime(fn: Listener): void {
  listeners.push(fn);
}

export function emitRuntime(): void {
  for (let i = 0; i < listeners.length; i++) listeners[i]();
}
