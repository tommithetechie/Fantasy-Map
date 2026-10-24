export type WeatherKind =
  | "thunder"
  | "rain"
  | "drizzle"
  | "snow"
  | "fog"
  | "overcast"
  | "mainly-clear"
  | "clear";

export type WeatherMapped = {
  kind: WeatherKind;
  label: string;
  rain: number;
  snow: number;
  fogRange: [number, number] | null;
  tintOpacity: number;
  tintColor: string;
  lightning: boolean;
  cloudOpacity: number;
  clouds: boolean;
  fireflies: boolean;
  shimmer: boolean;
  snowLighten: boolean;
  unknown: boolean;
};

const RAIN_HEAVY = new Set([65, 67, 82]);
const RAIN_MOD = new Set([63, 66, 81]);
const RAIN = new Set([61, 63, 65, 66, 67, 80, 81, 82]);
const DRIZZLE = new Set([51, 53, 55, 56, 57]);
const SNOW_HEAVY = new Set([75, 86]);
const SNOW_MOD = new Set([73, 77]);
const SNOW = new Set([71, 73, 75, 77, 85, 86]);
const THUNDER = new Set([95, 96, 99]);

let unknownLogged = false;

function rainCount(code: number): number {
  if (RAIN_HEAVY.has(code)) return 800;
  if (RAIN_MOD.has(code)) return 550;
  return 350;
}

function snowCount(code: number): number {
  if (SNOW_HEAVY.has(code)) return 400;
  if (SNOW_MOD.has(code)) return 300;
  return 200;
}

/** First matching WMO row wins. Unknown codes are treated as 2. */
export function mapWeatherCode(code: number, visibilityM: number): WeatherMapped {
  let used = code;
  let unknown = false;
  if (!Number.isFinite(used)) {
    used = 2;
    unknown = true;
  }
  let mapped: WeatherMapped;
  if (THUNDER.has(used)) {
    mapped = row("thunder", "Thunderstorm", {
      rain: 800,
      fogRange: [0.5, 6],
      tintOpacity: 0.28,
      tintColor: "#141820",
      lightning: true,
      cloudOpacity: 0.28,
      clouds: true,
    });
  } else if (RAIN.has(used)) {
    mapped = row("rain", "Rain", {
      rain: rainCount(used),
      fogRange: [1, 8],
      shimmer: false,
      fireflies: false,
    });
  } else if (DRIZZLE.has(used)) {
    mapped = row("drizzle", "Drizzle", { rain: 150, shimmer: false, fireflies: false });
  } else if (SNOW.has(used)) {
    mapped = row("snow", "Snow", {
      snow: snowCount(used),
      snowLighten: true,
      shimmer: false,
      fireflies: false,
    });
  } else if (used === 45 || used === 48) {
    mapped = row("fog", "Fog", {
      fogRange: [0.2, 3],
      tintOpacity: 0.3,
      tintColor: "#c5c3bb",
      clouds: false,
      cloudOpacity: 0,
      shimmer: false,
      fireflies: false,
    });
  } else if (used === 3) {
    mapped = row("overcast", "Overcast", {
      tintOpacity: 0.1,
      tintColor: "#6d7278",
      cloudOpacity: 0.22,
      clouds: true,
      shimmer: false,
      fireflies: false,
    });
  } else if (used === 1 || used === 2) {
    mapped = row("mainly-clear", "Mainly clear", {});
  } else if (used === 0) {
    mapped = row("clear", "Clear", { shimmer: true, fireflies: true });
  } else {
    unknown = true;
    mapped = row("mainly-clear", "Mainly clear", {});
    if (!unknownLogged) {
      unknownLogged = true;
      console.warn(`Ferrell weather: unknown code ${code}, treating as 2.`);
    }
  }
  if (visibilityM < 1000) mapped = { ...mapped, fogRange: [0.3, 4] };
  return unknown ? { ...mapped, unknown: true } : mapped;
}

function row(
  kind: WeatherKind,
  label: string,
  extra: Partial<WeatherMapped>,
): WeatherMapped {
  return {
    kind,
    label,
    rain: 0,
    snow: 0,
    fogRange: null,
    tintOpacity: 0,
    tintColor: "#66788a",
    lightning: false,
    cloudOpacity: 0.16,
    clouds: true,
    fireflies: kind === "clear" || kind === "mainly-clear",
    shimmer: kind === "clear" || kind === "mainly-clear",
    snowLighten: false,
    unknown: false,
    ...extra,
  };
}
