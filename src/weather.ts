import { refreshAtmosphere } from "./atmosphere";
import { realm, type WeatherKind } from "./state";

const COPY: Record<WeatherKind, readonly [string, string]> = {
  clear: ["Fair skies", "the realm is gilt"],
  clouds: ["A quilt of cloud", "shadows cross the wards"],
  rain: ["Rain on the citadel", "the serpent river swells"],
  storm: ["A storm is sworn", "the griffons stay grounded"],
  snow: ["Ash-white weather", "rare snow on the green"],
  fog: ["River mist", "the wards keep their secrets"],
};

function classify(code: number, cloud: number, precip: number): WeatherKind {
  if (code >= 95) return "storm";
  if (code >= 71 && code <= 77) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || precip >= 0.3) return "rain";
  if (code === 45 || code === 48) return "fog";
  if (code <= 1 && cloud < 40) return "clear";
  if (code <= 3 && cloud < 55) return "clear";
  return "clouds";
}

function apply(kind: WeatherKind): void {
  const copy = COPY[kind];
  realm.weather = kind;
  realm.weatherTitle = copy[0];
  realm.weatherDetail = copy[1];
  realm.weatherLive = true;
  refreshAtmosphere();
}

export function startWeather(): void {
  const url =
    "https://api.open-meteo.com/v1/forecast?latitude=36.1627&longitude=-86.7816&current=weather_code,cloud_cover,precipitation&timezone=America%2FChicago";
  fetch(url)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error("weather"))))
    .then((body: unknown) => {
      const current = (body as { current?: { weather_code?: number; cloud_cover?: number; precipitation?: number } }).current;
      const code = current?.weather_code;
      if (typeof code !== "number") {
        apply("clear");
        return;
      }
      const cloud = typeof current?.cloud_cover === "number" ? current.cloud_cover : 0;
      const precip = typeof current?.precipitation === "number" ? current.precipitation : 0;
      apply(classify(code, cloud, precip));
    })
    .catch(() => {
      apply("clear");
    });
}
