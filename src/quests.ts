import type maplibregl from "maplibre-gl";
import { journeyTo } from "./journey";
import { setVisitHandler } from "./lore";
import { onFrame } from "./loop";
import { saveStep, loadStep } from "./save";
import { realm } from "./state";
import { landmarks } from "./zones";

export const SURVEY = [
  { id: "citadel", title: "The Citadel Beacon", detail: "Stand in the Citadel and take the survey into your keeping." },
  { id: "gulch", title: "Into the Gulch", detail: "Descend into the Gulch Deep and mark the tavern-canyons." },
  { id: "bards", title: "The Ballad Treaty", detail: "Walk Bard's Row and record which songs the realm is singing." },
  { id: "green", title: "The Marble Goddess", detail: "Pay respects at the temple in the Great Green." },
  { id: "grandhall", title: "Pilgrimage to the Hall", detail: "Reach the Grand Hall before the chorus ends." },
  { id: "citadel", title: "Return the Survey", detail: "Bring the finished map back to the Citadel." },
] as const;

export const QUEST_LANDMARKS: readonly string[] = SURVEY.map((step) => step.id);

const DEG = Math.PI / 180;
const VISIT_METERS = 420;

let mapRef: maplibregl.Map | null = null;
let list: HTMLOListElement | null = null;
let hint: HTMLElement | null = null;
let toastEl: HTMLElement | null = null;
let toastTimer = 0;
let visitAcc = 0;
let armed = false;
let originLng = 0;
let originLat = 0;

function landmarkById(id: string) {
  for (let i = 0; i < landmarks.length; i++) {
    if (landmarks[i].id === id) return landmarks[i];
  }
  return null;
}

export function startQuests(map: maplibregl.Map): void {
  mapRef = map;
  realm.step = Math.min(loadStep(), SURVEY.length);
  list = document.getElementById("questList") as HTMLOListElement | null;
  hint = document.getElementById("questHint");
  toastEl = document.getElementById("toast");
  const log = document.getElementById("questlog");
  const questBtn = document.getElementById("questBtn");
  const resetBtn = document.getElementById("questReset");
  if (!list || !hint || !log || !(questBtn instanceof HTMLButtonElement) || !(resetBtn instanceof HTMLButtonElement)) {
    throw new Error("Missing quest log");
  }

  for (let i = 0; i < SURVEY.length; i++) {
    const li = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = SURVEY[i].title;
    const where = document.createElement("span");
    where.textContent = landmarkById(SURVEY[i].id)?.name ?? SURVEY[i].id;
    li.append(title, where);
    li.addEventListener("click", () => selectStep(i));
    list.append(li);
  }

  questBtn.addEventListener("click", () => toggleLog());
  resetBtn.addEventListener("click", () => {
    realm.step = 0;
    saveStep(0);
    render();
    announce("The margin is blank again.");
  });
  window.addEventListener("keydown", onKey);
  setVisitHandler((id) => completeIfCurrent(id));
  render();
  originLng = map.transform.center.lng;
  originLat = map.transform.center.lat;
  onFrame((_now, dt) => {
    visitAcc += dt;
    if (visitAcc < 0.45 || !mapRef) return;
    visitAcc = 0;
    const center = mapRef.transform.center;
    if (!armed) {
      if (meters(originLng, originLat, center.lng, center.lat) < 40) return;
      armed = true;
    }
    const current = currentLandmark();
    if (!current) return;
    if (meters(center.lng, center.lat, current.coordinates[0], current.coordinates[1]) < VISIT_METERS) {
      completeIfCurrent(current.id);
    }
  });
}

function currentLandmark() {
  if (realm.step >= SURVEY.length) return null;
  return landmarkById(SURVEY[realm.step].id);
}

function meters(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const dx = (lng2 - lng1) * 111320 * Math.cos(lat1 * DEG);
  const dy = (lat2 - lat1) * 111320;
  return Math.hypot(dx, dy);
}

function completeIfCurrent(id: string): void {
  if (realm.step >= SURVEY.length) return;
  if (SURVEY[realm.step].id !== id) return;
  const finished = SURVEY[realm.step].title;
  realm.step += 1;
  saveStep(realm.step);
  render();
  if (realm.step >= SURVEY.length) announce("The survey is sealed.");
  else announce(`Surveyed — ${finished}`);
}

function selectStep(index: number): void {
  if (!mapRef || index > realm.step || index >= SURVEY.length) return;
  const landmark = landmarkById(SURVEY[index].id);
  if (!landmark) return;
  journeyTo(mapRef, landmark.coordinates[0], landmark.coordinates[1]);
}

function render(): void {
  if (!list || !hint) return;
  const items = list.children;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    item.className = i < realm.step ? "done" : i === realm.step ? "active" : "locked";
  }
  if (realm.step >= SURVEY.length) {
    hint.textContent = "The survey is complete. Nash has your name in the margin.";
  } else {
    hint.textContent = SURVEY[realm.step].detail;
  }
}

function toggleLog(): void {
  const log = document.getElementById("questlog");
  const btn = document.getElementById("questBtn");
  if (!log || !(btn instanceof HTMLButtonElement)) return;
  const open = log.style.display !== "block";
  log.style.display = open ? "block" : "none";
  btn.classList.toggle("active", open);
}

function onKey(event: KeyboardEvent): void {
  if (event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.code === "KeyL") {
    event.preventDefault();
    toggleLog();
    return;
  }
  if (event.code >= "Digit1" && event.code <= "Digit6") {
    const index = Number(event.code.slice(5)) - 1;
    selectStep(index);
  }
}

function announce(message: string): void {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.remove("show");
  void toastEl.offsetWidth;
  toastEl.classList.add("show");
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl?.classList.remove("show"), 3200);
}
