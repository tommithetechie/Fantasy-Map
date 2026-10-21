import type { FeatureCollection, Point } from "geojson";

export type FantasyZoneProperties = {
  name: string;
};

export type Landmark = {
  id: string;
  name: string;
  epithet: string;
  lore: string;
  coordinates: [number, number];
};

/** Cartographer's landmarks. Coordinates match the original zone layer. */
export const landmarks: readonly Landmark[] = [
  {
    id: "citadel",
    name: "THE CITADEL",
    epithet: "heart of the realm",
    lore: "Seat of Nash, where the streets run in a grid like a war-map and every tower keeps a ledger. The cartographers swear the realm's pulse is loudest at the widest crossing.",
    coordinates: [-86.7816, 36.1627],
  },
  {
    id: "gulch",
    name: "THE GULCH DEEP",
    epithet: "canyon of taverns",
    lore: "A ravine cut between cliffs of new stone. Songs leak up from the cellars, and travelers leave lighter of coin than they arrived. Mind the stairs. They are older than they look.",
    coordinates: [-86.7866, 36.1566],
  },
  {
    id: "bards",
    name: "BARD'S ROW",
    epithet: "where songs are sealed",
    lore: "A lane of scribes and luthiers. Ballads are drafted here like treaties, and the ones that survive go on to conquer other realms. Hum quietly. The walls remember.",
    coordinates: [-86.7966, 36.1494],
  },
  {
    id: "stone",
    name: "STONE WARD",
    epithet: "the northern gate",
    lore: "Old stone and new banners. The ward still sells bread to soldiers who have not marched in a hundred years, and the gate opens for anyone who knows the knock.",
    coordinates: [-86.7772, 36.1755],
  },
  {
    id: "eastmarch",
    name: "EASTMARCH",
    epithet: "banners beyond the river",
    lore: "Across the water the colors change. Painters, fiddlers, and excellent pies. Eastmarch answers to the Citadel only when the wind is favorable.",
    coordinates: [-86.7494, 36.1855],
  },
  {
    id: "greenhills",
    name: "GREENHILLS",
    epithet: "merchant groves",
    lore: "Southern hills of clipped hedges and well-guarded shops. If you must buy a relic, buy it here, then lose the receipt before the tax-wights come calling.",
    coordinates: [-86.8144, 36.1033],
  },
  {
    id: "grandhall",
    name: "THE GRAND HALL",
    epithet: "where the stars attend",
    lore: "A hall so loud the constellations lean in. Pilgrims ride for hours to hear a single chorus. Leave an offering of applause, and do not speak during the bridge.",
    coordinates: [-86.6936, 36.2116],
  },
  {
    id: "griffon",
    name: "GRIFFON LANDING",
    epithet: "nests of iron wings",
    lore: "Great metal griffons stoop out of the clouds and scream as they land. Keep off the nesting lanes. The beasts answer to horns, not to oats.",
    coordinates: [-86.6772, 36.1238],
  },
  {
    id: "green",
    name: "THE GREAT GREEN",
    epithet: "temple in the lawn",
    lore: "A marble temple to a goddess from another map, set in a green as round as a coin. Locals picnic on the steps as if Olympus were a tavern bench. She does not seem to mind.",
    coordinates: [-86.8133, 36.1461],
  },
  {
    id: "wolfswood",
    name: "WOLFSWOOD",
    epithet: "timber by the river",
    lore: "Soft paths, green light, and something with too many eyes in the canebrake. The rangers insist it is only a heron. The heron has not confirmed this.",
    coordinates: [-86.7227, 36.1794],
  },
];

/** Zone names drawn by the fantasy symbol layer. */
export const fantasyZones: FeatureCollection<Point, FantasyZoneProperties> = {
  type: "FeatureCollection",
  features: landmarks.map((landmark) => ({
    type: "Feature" as const,
    properties: { name: landmark.name },
    geometry: { type: "Point" as const, coordinates: landmark.coordinates },
  })),
};
