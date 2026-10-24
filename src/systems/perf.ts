import type { Map } from "maplibre-gl";
import { runtime } from "./runtime";

type Tick = (dt: number, now: number) => boolean;

const ticks: Tick[] = [];
let raf = 0;
let last = 0;
let running = false;
let stopMini: (() => void) | null = null;
let startMini: (() => void) | null = null;
let onVisible: (() => void) | null = null;

export function addTick(fn: Tick): void {
  ticks.push(fn);
}

export function setMiniHooks(stop: () => void, start: () => void): void {
  stopMini = stop;
  startMini = start;
}

export function setVisibleHook(fn: () => void): void {
  onVisible = fn;
}

export function wake(): void {
  if (running || runtime.hidden) return;
  running = true;
  last = 0;
  raf = requestAnimationFrame(frame);
}

export function initPerf(map: Map): void {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const applyMotion = (): void => {
    runtime.reducedMotion = media.matches;
  };
  applyMotion();
  media.addEventListener("change", applyMotion);
  document.addEventListener("visibilitychange", () => {
    setHidden(document.hidden || !mapOnScreen);
  });
  const observer = new IntersectionObserver((entries) => {
    mapOnScreen = entries.some((entry) => entry.isIntersecting);
    setHidden(document.hidden || !mapOnScreen);
  });
  observer.observe(map.getContainer());
}

let mapOnScreen = true;

function frame(now: number): void {
  const dt = last === 0 ? 0 : Math.min(50, now - last);
  last = now;
  let active = false;
  for (let i = 0; i < ticks.length; i++) {
    if (ticks[i](dt, now)) active = true;
  }
  if (!active || runtime.hidden) {
    running = false;
    raf = 0;
    return;
  }
  raf = requestAnimationFrame(frame);
}

function setHidden(hidden: boolean): void {
  if (runtime.hidden === hidden) return;
  runtime.hidden = hidden;
  if (hidden) {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    running = false;
    stopMini?.();
    return;
  }
  startMini?.();
  onVisible?.();
  wake();
}
