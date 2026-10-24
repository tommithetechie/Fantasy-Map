import type { Map } from "maplibre-gl";

const ORDER = ["ferrell-clouds", "ferrell-fog", "ferrell-fx", "ferrell-flash"];

/** Inserts an overlay just above the WebGL canvas and below MapLibre markers. */
export function mountOverlay(map: Map, id: string): HTMLCanvasElement {
  const container = map.getCanvasContainer();
  const existing = document.getElementById(id);
  const canvas = existing instanceof HTMLCanvasElement ? existing : document.createElement("canvas");
  canvas.id = id;
  canvas.className = "ferrell-overlay";
  place(container, map.getCanvas(), canvas);
  return canvas;
}

export function mountFlash(map: Map): HTMLElement {
  const container = map.getCanvasContainer();
  let flash = document.getElementById("ferrell-flash");
  if (!flash) {
    flash = document.createElement("div");
    flash.id = "ferrell-flash";
  }
  place(container, map.getCanvas(), flash);
  return flash;
}

function place(container: HTMLElement, canvas: HTMLCanvasElement, node: HTMLElement): void {
  const index = ORDER.indexOf(node.id);
  let anchor: Element = canvas;
  const children = container.children;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child === node) continue;
    const other = ORDER.indexOf(child.id);
    if (other >= 0 && other < index) anchor = child;
  }
  const next = anchor.nextElementSibling;
  if (next === node) return;
  if (next) container.insertBefore(node, next);
  else anchor.insertAdjacentElement("afterend", node);
}
