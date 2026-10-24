import type { FilterSpecification, LightSpecification, Map, SkySpecification } from "maplibre-gl";

export type ResolvedLayers = {
  background: string | null;
  buildings: string | null;
  buildingsSource: string | null;
  buildingsSourceLayer: string | null;
  water: string | null;
  parks: string[];
  roads: string[];
};

export type BasePaint = {
  background: unknown;
  buildingColor: unknown;
  buildingOpacity: unknown;
  buildingHeight: unknown;
  buildingFilter: FilterSpecification | null;
  waterColor: unknown;
  waterOpacity: unknown;
  sky: SkySpecification | undefined;
  light: LightSpecification | undefined;
};

const resolvedByMap = new WeakMap<Map, ResolvedLayers>();
const paintByMap = new WeakMap<Map, BasePaint>();
let missingWarned = false;

export function resolveLayers(map: Map): ResolvedLayers {
  const layers = map.getStyle()?.layers ?? [];
  let background: string | null = null;
  let buildings: string | null = null;
  let buildingsSource: string | null = null;
  let buildingsSourceLayer: string | null = null;
  let water: string | null = null;
  const parks: string[] = [];
  const roads: string[] = [];

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    if (layer.type === "background" && !background) background = layer.id;
    const sourceLayer = "source-layer" in layer ? layer["source-layer"] : undefined;
    if (layer.type === "fill-extrusion" && sourceLayer === "building" && !buildings) {
      buildings = layer.id;
      buildingsSource = "source" in layer ? (layer.source ?? null) : null;
      buildingsSourceLayer = sourceLayer ?? null;
    }
    if (layer.type === "fill" && sourceLayer === "water" && !water) water = layer.id;
    if (sourceLayer === "park" || sourceLayer === "landuse" || sourceLayer === "landcover") {
      parks.push(layer.id);
    }
    if (layer.type === "line" && sourceLayer === "transportation") roads.push(layer.id);
  }

  if (!buildings && !missingWarned) {
    missingWarned = true;
    console.warn("Ferrell: no fill-extrusion building layer; night windows disabled.");
  }

  const resolved: ResolvedLayers = {
    background,
    buildings,
    buildingsSource,
    buildingsSourceLayer,
    water,
    parks,
    roads,
  };
  resolvedByMap.set(map, resolved);
  return resolved;
}

export function getResolved(map: Map): ResolvedLayers {
  return resolvedByMap.get(map) ?? resolveLayers(map);
}

/** Call at the start of style.load, before any Ferrell paint, so day can restore it exactly. */
export function captureBasePaint(map: Map): BasePaint {
  const layers = resolveLayers(map);
  const paint: BasePaint = {
    background: layers.background ? map.getPaintProperty(layers.background, "background-color") : null,
    buildingColor: layers.buildings
      ? map.getPaintProperty(layers.buildings, "fill-extrusion-color")
      : null,
    buildingOpacity: layers.buildings
      ? map.getPaintProperty(layers.buildings, "fill-extrusion-opacity")
      : null,
    buildingHeight: layers.buildings
      ? map.getPaintProperty(layers.buildings, "fill-extrusion-height")
      : null,
    buildingFilter: layers.buildings ? (map.getFilter(layers.buildings) ?? null) : null,
    waterColor: layers.water ? map.getPaintProperty(layers.water, "fill-color") : null,
    waterOpacity: layers.water ? map.getPaintProperty(layers.water, "fill-opacity") : null,
    sky: map.getSky(),
    light: map.getLight(),
  };
  paintByMap.set(map, paint);
  return paint;
}

export function getBasePaint(map: Map): BasePaint | null {
  return paintByMap.get(map) ?? null;
}

export function ensureNightWindows(map: Map): void {
  if (map.getLayer("ferrell-night-windows")) return;
  const layers = getResolved(map);
  const paint = getBasePaint(map);
  if (!layers.buildings || !layers.buildingsSource || paint?.buildingHeight == null) return;
  const order = map.getStyle()?.layers ?? [];
  let before: string | undefined;
  for (let i = 0; i < order.length; i++) {
    if (order[i].id === layers.buildings) {
      before = order[i + 1]?.id;
      break;
    }
  }
  const height = paint.buildingHeight;
  try {
    map.addLayer(
      {
        id: "ferrell-night-windows",
        type: "fill-extrusion",
        source: layers.buildingsSource,
        "source-layer": layers.buildingsSourceLayer ?? "building",
        minzoom: 14,
        ...(paint.buildingFilter ? { filter: paint.buildingFilter } : {}),
        paint: {
          "fill-extrusion-color": "#ffb84d",
          "fill-extrusion-height": height as never,
          "fill-extrusion-base": scaleZoomOutput(height, 0.35) as never,
          "fill-extrusion-opacity": 0,
        },
      },
      before,
    );
  } catch (error) {
    console.warn("Ferrell: night windows layer was not added.", error);
  }
}

/**
 * Zoom expressions are only legal as the top-level step/interpolate.
 * Scale each output stop instead of wrapping the whole expression.
 */
function scaleZoomOutput(expr: unknown, factor: number): unknown {
  if (!Array.isArray(expr)) return ["*", expr, factor];
  const op = expr[0];
  if (op === "interpolate" && Array.isArray(expr[2]) && expr[2][0] === "zoom") {
    const copy = expr.slice();
    for (let i = 4; i < copy.length; i += 2) copy[i] = ["*", copy[i], factor];
    return copy;
  }
  if (op === "step" && Array.isArray(expr[1]) && expr[1][0] === "zoom") {
    const copy = expr.slice();
    copy[2] = ["*", copy[2], factor];
    for (let i = 4; i < copy.length; i += 2) copy[i] = ["*", copy[i], factor];
    return copy;
  }
  return ["*", expr, factor];
}
