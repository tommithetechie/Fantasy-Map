/** Shared anchors from the technical spec. Do not retune. */
export const NASHVILLE = { lng: -86.7816, lat: 36.1627 } as const;
export const TZ = "America/Chicago";
/** [west, south, east, north] */
export const DOWNTOWN_BBOX = [-86.86, 36.11, -86.7, 36.22] as const;
export const CELL_DEG = 0.002;
export const REVEAL_RADIUS_M = 400;
export const PARTICLE_CAP = 1000;
export const RAIN_CAP = 800;
export const SNOW_CAP = 400;
export const FIREFLY_CAP = 120;
export const MARKER_CAP = 5;

/** WASD centre clamp: downtown bbox expanded by 0.03°. */
export const WASD_LIMIT = {
  west: DOWNTOWN_BBOX[0] - 0.03,
  south: DOWNTOWN_BBOX[1] - 0.03,
  east: DOWNTOWN_BBOX[2] + 0.03,
  north: DOWNTOWN_BBOX[3] + 0.03,
} as const;
