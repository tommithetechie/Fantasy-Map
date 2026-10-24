import { NASHVILLE } from "./constants";

export type Phase = "night" | "dawn" | "day" | "golden" | "dusk";

export type CivilParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
};

export type TimeState = {
  elevationDeg: number;
  phase: Phase;
  /** 0–1 strength inside the current phase. Day is always 0. */
  t: number;
  descending: boolean;
  hour: number;
  minute: number;
  second: number;
  year: number;
  month: number;
  day: number;
  weekday: string;
  dayOfYear: number;
  frozen: boolean;
};

export function dayOfYear(year: number, month: number, day: number): number {
  const start = Date.UTC(year, 0, 0);
  const now = Date.UTC(year, month - 1, day);
  return Math.round((now - start) / 86400000);
}

export function dateKey(parts: Pick<CivilParts, "year" | "month" | "day">): string {
  const m = String(parts.month).padStart(2, "0");
  const d = String(parts.day).padStart(2, "0");
  return `${parts.year}-${m}-${d}`;
}

/**
 * NOAA solar elevation for Nashville.
 * Central meridian is -90 in CST and -75 in CDT (15° × the UTC offset).
 * `tzOffsetHours` is the America/Chicago offset, e.g. -5 in CDT.
 */
export function solarFromParts(
  parts: CivilParts,
  tzOffsetHours: number,
): { elevationDeg: number; descending: boolean } {
  const doy = dayOfYear(parts.year, parts.month, parts.day);
  const hours = parts.hour + parts.minute / 60 + parts.second / 3600;
  const gamma = ((2 * Math.PI) / 365) * (doy - 1 + (hours - 12) / 24);
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const timeOffset = eqTime + 4 * NASHVILLE.lng - 60 * tzOffsetHours;
  const trueSolar = parts.hour * 60 + parts.minute + parts.second / 60 + timeOffset;
  const hourAngle = trueSolar / 4 - 180;
  const lat = (NASHVILLE.lat * Math.PI) / 180;
  const ha = (hourAngle * Math.PI) / 180;
  const elev = Math.asin(
    Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha),
  );
  return { elevationDeg: (elev * 180) / Math.PI, descending: hourAngle > 0 };
}

/**
 * Phase buckets from the spec. Descending 6–18° is golden, so a late-afternoon
 * sun still in that band stays golden instead of being swallowed by the dusk overlap.
 */
export function phaseFor(elevationDeg: number, descending: boolean): Phase {
  if (elevationDeg < -6) return "night";
  if (descending && elevationDeg <= 18 && elevationDeg >= 6) return "golden";
  if (descending && elevationDeg < 6) return "dusk";
  if (!descending && elevationDeg <= 6) return "dawn";
  if (elevationDeg > 12) return "day";
  return "day";
}

export function phaseStrength(phase: Phase, elevationDeg: number): number {
  switch (phase) {
    case "night":
      return 1;
    case "dawn":
      return (elevationDeg + 6) / 12;
    case "day":
      return 0;
    case "golden": {
      const dist = Math.min(1, Math.abs(elevationDeg - 12) / 6);
      return 0.55 + 0.45 * (1 - dist);
    }
    case "dusk":
      return 1 - Math.min(1, Math.max(0, (elevationDeg + 6) / 12));
    default: {
      const neverPhase: never = phase;
      return neverPhase;
    }
  }
}
