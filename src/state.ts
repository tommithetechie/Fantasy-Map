export type WeatherKind = "clear" | "clouds" | "rain" | "storm" | "snow" | "fog";

/** Shared realm state. Mutated by systems, read by the frame loop. */
export const realm = {
  hour: 15.2,
  paused: false,
  night: 0,
  golden: 0,
  weather: "clear" as WeatherKind,
  weatherLive: false,
  weatherTitle: "Fair skies",
  weatherDetail: "the realm is gilt",
  flying: false,
  mist: true,
  step: 0,
  hover: -1,
};

export function nightAmount(hour: number): number {
  if (hour >= 7 && hour < 17) return 0;
  if (hour >= 17 && hour < 20) return (hour - 17) / 3;
  if (hour >= 5 && hour < 7) return 1 - (hour - 5) / 2;
  return 1;
}

export function goldenAmount(hour: number): number {
  const morning = Math.exp(-((hour - 7.1) * (hour - 7.1)) / 0.9);
  const evening = Math.exp(-((hour - 17.7) * (hour - 17.7)) / 1.15);
  const sum = morning + evening;
  return sum > 1 ? 1 : sum;
}

export function hourName(hour: number): string {
  if (hour < 5 || hour >= 22) return "the deep night";
  if (hour < 7) return "dawn";
  if (hour < 11) return "morning";
  if (hour < 14) return "high sun";
  if (hour < 17) return "afternoon";
  if (hour < 19.5) return "the gloaming";
  return "night";
}
