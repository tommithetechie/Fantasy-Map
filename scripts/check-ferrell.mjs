import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

const solar = await server.ssrLoadModule("/src/systems/solar.ts");
const wmo = await server.ssrLoadModule("/src/systems/wmo.ts");
const world = await server.ssrLoadModule("/src/systems/world.ts");
const progress = await server.ssrLoadModule("/src/systems/progress.ts");
const geo = await server.ssrLoadModule("/src/systems/geo.ts");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const cells = geo.downtownCells();
assert(cells.total === 4400, `downtown cells ${cells.total}`);
assert(world.QUESTS.length === 10, "quest count");
assert(world.ACHIEVEMENTS.length === 15, "achievement count");
assert(world.NPCS.length === 8, "npc count");
assert(world.LANDMARKS.length === 12, "landmark count");
assert(progress.chainXp() === 2220, `chain xp ${progress.chainXp()}`);

let sum = 0;
for (let level = 1; level <= 19; level += 1) sum += world.XP_TO_NEXT[level];
assert(sum === 13600, `xp curve ${sum}`);
assert(progress.levelFromTotal(0).level === 1, "level 1");
assert(progress.levelFromTotal(100).level === 2, "level 2");
assert(progress.levelFromTotal(2200).level === 9, "level 9 at 2200");
assert(progress.levelFromTotal(2220).level === 9, "chain is level 9");
assert(progress.levelFromTotal(13600).level === 20, "level 20");

const heavy = wmo.mapWeatherCode(65, 20000);
assert(heavy.rain === 800, `heavy rain ${heavy.rain}`);
assert(heavy.lightning === false, "rain is not lightning");
const storm = wmo.mapWeatherCode(95, 20000);
assert(storm.rain === 800 && storm.lightning === true, "thunder");
assert(storm.fogRange[0] === 0.5 && storm.fogRange[1] === 6, "thunder fog");
const foggy = wmo.mapWeatherCode(0, 500);
assert(foggy.fogRange[0] === 0.3 && foggy.fogRange[1] === 4, "visibility override");
assert(wmo.mapWeatherCode(2, 10000).kind === "mainly-clear", "code 2");
assert(wmo.mapWeatherCode(999, 10000).kind === "mainly-clear", "unknown");

const saturday = progress.chooseDaily({
  weekday: "Sat",
  month: 10,
  day: 24,
  dayOfYear: 297,
  daysAway: 0,
  hasVisited: false,
  weatherCode: 65,
  temperatureF: 50,
  weatherReady: true,
});
assert(saturday.questId === "daily-opry-night", `saturday daily ${saturday?.questId}`);
assert(saturday.bonusXp === 25, "saturday bonus");

const rain = progress.chooseDaily({
  weekday: "Mon",
  month: 10,
  day: 26,
  dayOfYear: 299,
  daysAway: 0,
  hasVisited: false,
  weatherCode: 65,
  temperatureF: 60,
  weatherReady: true,
});
assert(rain.title === "Raindrops on the River", `rain daily ${rain?.title}`);

const parts = { year: 2026, month: 10, day: 24, second: 0, weekday: "Sat" };
for (const [hour, minute] of [
  [12, 0],
  [17, 30],
  [19, 40],
  [22, 0],
]) {
  const solarState = solar.solarFromParts({ ...parts, hour, minute }, -5);
  const phase = solar.phaseFor(solarState.elevationDeg, solarState.descending);
  console.log(
    `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    phase,
    solarState.elevationDeg.toFixed(2),
    solarState.descending ? "descending" : "ascending",
  );
}

for (let minute = 15 * 60; minute <= 20 * 60; minute += 10) {
  const hour = Math.floor(minute / 60);
  const min = minute % 60;
  const solarState = solar.solarFromParts({ ...parts, hour, minute: min }, -5);
  const phase = solar.phaseFor(solarState.elevationDeg, solarState.descending);
  if (phase === "golden" || phase === "dusk" || min === 0) {
    console.log(
      `scan ${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
      phase,
      solarState.elevationDeg.toFixed(2),
    );
  }
}

const noon = solar.solarFromParts({ ...parts, hour: 12, minute: 0 }, -5);
const night = solar.solarFromParts({ ...parts, hour: 22, minute: 0 }, -5);
assert(solar.phaseFor(noon.elevationDeg, noon.descending) === "day", "noon is day");
assert(solar.phaseFor(night.elevationDeg, night.descending) === "night", "22:00 is night");

await server.close();
console.log("ferrell checks passed");
