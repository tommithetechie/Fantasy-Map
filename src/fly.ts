import type maplibregl from "maplibre-gl";
import { onFrame } from "./loop";
import { realm } from "./state";

const DEG = Math.PI / 180;
const center: [number, number] = [0, 0];
const jump = {
  center,
  bearing: 0,
  pitch: 0,
  zoom: 14.5,
};

let mapRef: maplibregl.Map | null = null;
let look = false;
let keyW = 0;
let keyA = 0;
let keyS = 0;
let keyD = 0;
let keyShift = 0;
let yaw = 0;
let pitchDelta = 0;

export function startFly(map: maplibregl.Map): void {
  mapRef = map;
  const btn = document.getElementById("flyBtn");
  if (!(btn instanceof HTMLButtonElement)) throw new Error("Missing #flyBtn");
  btn.addEventListener("click", () => toggleFly());
  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  const canvas = map.getCanvas();
  document.addEventListener("pointerlockchange", () => {
    look = document.pointerLockElement === canvas;
  });
  canvas.addEventListener("mousemove", onMouse);
  map.on("click", () => {
    if (realm.flying && !look) canvas.requestPointerLock();
  });
  onFrame((_now, dt) => {
    if (realm.flying) step(dt);
  });
}

function toggleFly(): void {
  const map = mapRef;
  if (!map) return;
  realm.flying = !realm.flying;
  const btn = document.getElementById("flyBtn");
  const banner = document.getElementById("flyBanner");
  if (btn instanceof HTMLButtonElement) {
    btn.textContent = realm.flying ? "Land" : "Take flight";
    btn.classList.toggle("active", realm.flying);
  }
  if (banner) banner.style.display = realm.flying ? "block" : "none";
  if (realm.flying) {
    map.dragPan.disable();
    map.dragRotate.disable();
    map.getCanvas().requestPointerLock();
  } else {
    map.dragPan.enable();
    map.dragRotate.enable();
    if (document.pointerLockElement) document.exitPointerLock();
    keyW = 0;
    keyA = 0;
    keyS = 0;
    keyD = 0;
    keyShift = 0;
    yaw = 0;
    pitchDelta = 0;
  }
}

function typing(event: KeyboardEvent): boolean {
  return event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
}

function onDown(event: KeyboardEvent): void {
  if (typing(event) || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.code === "KeyF") {
    event.preventDefault();
    toggleFly();
    return;
  }
  if (!realm.flying) return;
  if (event.code === "KeyW") keyW = 1;
  else if (event.code === "KeyA") keyA = 1;
  else if (event.code === "KeyS") keyS = 1;
  else if (event.code === "KeyD") keyD = 1;
  else if (event.code === "ShiftLeft" || event.code === "ShiftRight") keyShift = 1;
}

function onUp(event: KeyboardEvent): void {
  if (event.code === "KeyW") keyW = 0;
  else if (event.code === "KeyA") keyA = 0;
  else if (event.code === "KeyS") keyS = 0;
  else if (event.code === "KeyD") keyD = 0;
  else if (event.code === "ShiftLeft" || event.code === "ShiftRight") keyShift = 0;
}

function onMouse(event: MouseEvent): void {
  if (!look) return;
  yaw += event.movementX * 0.12;
  pitchDelta -= event.movementY * 0.08;
}

function step(dt: number): void {
  const map = mapRef;
  if (!map) return;
  if (keyW + keyA + keyS + keyD === 0 && yaw === 0 && pitchDelta === 0) return;
  const tr = map.transform;
  let bearing = tr.bearing + yaw;
  yaw = 0;
  let pitch = tr.pitch + pitchDelta;
  pitchDelta = 0;
  if (pitch < 0) pitch = 0;
  else if (pitch > 80) pitch = 80;
  const lat = tr.center.lat;
  let lng = tr.center.lng;
  const speed = (keyShift ? 980 : 320) * Math.pow(2, 15 - tr.zoom) * dt;
  const br = bearing * DEG;
  const fwd = (keyW - keyS) * speed;
  const strafe = (keyD - keyA) * speed;
  const east = Math.sin(br) * fwd + Math.cos(br) * strafe;
  const north = Math.cos(br) * fwd - Math.sin(br) * strafe;
  const cos = Math.cos(lat * DEG);
  lng += east / (111320 * (Math.abs(cos) < 0.01 ? 0.01 : cos));
  center[0] = lng;
  center[1] = lat + north / 111320;
  jump.bearing = bearing;
  jump.pitch = pitch;
  jump.zoom = tr.zoom;
  map.jumpTo(jump);
}
