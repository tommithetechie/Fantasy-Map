import type maplibregl from "maplibre-gl";
import { journeyTo } from "./journey";
import { landmarks } from "./zones";

let mapRef: maplibregl.Map | null = null;
let card: HTMLElement | null = null;
let openIndex = -1;
let onVisit: (id: string) => void = () => {};

function requireEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

export function setVisitHandler(handler: (id: string) => void): void {
  onVisit = handler;
}

export function startLore(map: maplibregl.Map): void {
  mapRef = map;
  card = requireEl("lore");
  const flyBtn = document.getElementById("loreFly");
  const closeBtn = document.getElementById("loreClose");
  if (!(flyBtn instanceof HTMLButtonElement) || !(closeBtn instanceof HTMLButtonElement)) {
    throw new Error("Missing lore buttons");
  }
  flyBtn.addEventListener("click", () => {
    if (!mapRef || openIndex < 0) return;
    const landmark = landmarks[openIndex];
    journeyTo(mapRef, landmark.coordinates[0], landmark.coordinates[1]);
  });
  closeBtn.addEventListener("click", closeLore);
  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape") closeLore();
  });
}

export function openLore(index: number): void {
  if (!card || index < 0 || index >= landmarks.length) return;
  const landmark = landmarks[index];
  openIndex = index;
  const title = requireEl("loreTitle");
  const epithet = requireEl("loreEpithet");
  const body = requireEl("loreBody");
  title.textContent = landmark.name;
  epithet.textContent = landmark.epithet;
  body.textContent = landmark.lore;
  card.style.display = "block";
  card.classList.remove("unfurl");
  // restart the unfurl animation without allocating a stylesheet
  void card.offsetWidth;
  card.classList.add("unfurl");
  onVisit(landmark.id);
}

export function closeLore(): void {
  if (!card) return;
  card.style.display = "none";
  card.classList.remove("unfurl");
  openIndex = -1;
}

export function loreIsOpen(): boolean {
  return openIndex >= 0;
}
