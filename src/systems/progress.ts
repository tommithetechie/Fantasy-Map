import { runtime } from "./runtime";
import {
  ACHIEVEMENTS,
  achievementById,
  CUMBERLAND_BRIDGES,
  cToF,
  DAILIES,
  dailyById,
  isRainCode,
  isStormCode,
  L10_NOTE,
  LANDMARKS,
  landmarkById,
  MAIN_COMPLETE_BANNER,
  npcAt,
  QUESTS,
  questById,
  RANKS,
  ROTATE_IDS,
  seasonFor,
  STRIP_ZOOM_MAX,
  XP_TO_NEXT,
  type AchievementDef,
  type DailyDef,
  type DailyTag,
  type QuestDef,
} from "./world";

const KEY = "realm-of-nash-progress-v1";

export type QuestStatus = "locked" | "available" | "active" | "complete";

export type AchievementUnlock = { achievementId: string; unlockedAt: string };

export type Player = {
  level: number;
  xpTotal: number;
  xpIntoLevel: number;
  activeQuestId: string | null;
  completedQuestIds: string[];
  unlockedTitleIds: string[];
  equippedTitleId: string | null;
  unlockedCosmeticIds: string[];
  equippedCosmeticId: string | null;
  achievementIds: AchievementUnlock[];
  revealedLandmarkIds: string[];
  visitedLandmarkIds: string[];
  fogRevealPercentDowntown: number;
  daily: {
    date: string;
    questId: string;
    status: "available" | "active" | "complete";
    weatherTagUsed: string;
  };
  stats: {
    totalFlights: number;
    nightVisits: number;
    rainVisits: number;
    bridgesCrossed: number;
    loreCardsRead: number;
  };
  loreReadIds: string[];
  npcMetIds: string[];
  objectiveStep: Record<string, number>;
  fogAward50: boolean;
  fogAward100: boolean;
  dailyCompletions: number;
  lastPlayedDate: string;
  visitDates: Record<string, string>;
  bridgeIds: string[];
  q10Step: number;
};

export type FogUpdate = {
  exploredLandmarkIds: readonly string[];
  stripReady: boolean;
  centennial: boolean;
  shelby: boolean;
  radnor: boolean;
  zoom: number;
  percent: number;
  grew: boolean;
};

export type DailyInput = {
  weekday: string;
  month: number;
  day: number;
  dayOfYear: number;
  daysAway: number;
  hasVisited: boolean;
  weatherCode: number;
  temperatureF: number;
  weatherReady: boolean;
};

const COSMETIC_NAMES: Record<string, string> = {
  "bat-ears-map-pin": "Bat Ears Map Pin",
  "neon-trail": "Neon Trail",
  "river-wake": "River-Wake",
  "gold-record-marker-ring": "Gold Record Marker Ring",
  "circle-of-oak-aura": "Circle of Oak Aura",
  "lost-star-map-skin": "Lost Star Map Skin",
  "hot-chicken-crown-pin": "Hot Chicken Crown Pin",
  "clear-skies-border": "Clear-Skies Border",
  "gold-foil-journal-page": "gold-foil journal page",
};

const session = {
  broadwayClicks: 0,
  banks: new Set<string>(),
  summer: new Set<string>(),
  questTimes: [] as number[],
  traverse: [false, false] as [boolean, boolean],
  loreThisDaily: 0,
  postcardBase: -1,
  postcardIn: false,
  hiddenTargets: [] as string[],
  q10Radnor: false,
};

let player = defaultPlayer();
const listeners: Array<() => void> = [];

export function onProgress(fn: () => void): void {
  listeners.push(fn);
}

export function initProgress(): void {
  player = defaultPlayer();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) player = sanitize(JSON.parse(raw) as Partial<Player>);
  } catch {
    player = defaultPlayer();
  }
  const away = daysBetween(player.lastPlayedDate, runtime.dateKey);
  ensureDaily(runtime.weatherReady, away);
  player.lastPlayedDate = runtime.dateKey;
  save();
}

export function getPlayer(): Player {
  return player;
}

export function mainQuests(): readonly QuestDef[] {
  return QUESTS;
}

export function mainStatus(quest: QuestDef): QuestStatus {
  if (player.completedQuestIds.includes(quest.questId)) return "complete";
  if (player.activeQuestId === quest.questId) return "active";
  if (quest.requiresQuestId && !player.completedQuestIds.includes(quest.requiresQuestId)) return "locked";
  if (player.activeQuestId) return "locked";
  return "available";
}

export function currentDaily(): DailyDef | null {
  return resolveDaily(player.daily.questId);
}

export function markerLandmarkIds(): string[] {
  const ids: string[] = [];
  const add = (id: string | null): void => {
    if (!id || ids.length >= 5 || ids.includes(id)) return;
    ids.push(id);
  };
  const active = player.activeQuestId ? questById(player.activeQuestId) : null;
  const next = active ?? availableMain();
  if (next) {
    if (next.questId === "q10-city-breathes" && player.q10Step >= 1) add(next.secondLandmarkId);
    else add(next.landmarkId);
  }
  if (player.daily.status !== "complete") {
    const daily = currentDaily();
    if (daily) {
      for (let i = 0; i < daily.landmarkIds.length; i++) add(daily.landmarkIds[i]);
    }
  }
  return ids;
}

export function acceptQuest(questId: string): void {
  const main = questById(questId);
  if (main && mainStatus(main) === "available") {
    player.activeQuestId = questId;
    commit();
    return;
  }
  if (player.daily.questId === questId && player.daily.status === "available") {
    player.daily.status = "active";
    session.postcardBase = -1;
    session.postcardIn = false;
    session.loreThisDaily = 0;
    commit();
  }
}

export function onFlyStarted(): string[] {
  session.traverse = [false, false];
  player.stats.totalFlights += 1;
  const toasts: string[] = [];
  toasts.push(...grantAch("ach-first-flight"));
  finish(toasts);
  return toasts;
}

export function breakTraverse(): void {
  session.traverse = [false, false];
}

export function onTraverseEnd(index: 0 | 1): string[] {
  session.traverse[index] = true;
  const toasts: string[] = [];
  const quest = player.activeQuestId ? questById(player.activeQuestId) : null;
  if (quest?.traverse && session.traverse[0] && session.traverse[1]) completeMain(quest, toasts);
  if (toasts.length) finish(toasts);
  return toasts;
}

export function onBridge(bridgeId: string): string[] {
  if (player.bridgeIds.includes(bridgeId)) return [];
  if (!CUMBERLAND_BRIDGES.some((bridge) => bridge.id === bridgeId)) return [];
  player.bridgeIds.push(bridgeId);
  player.stats.bridgesCrossed = player.bridgeIds.length;
  const toasts: string[] = [];
  if (player.bridgeIds.length >= 3) toasts.push(...grantAch("ach-bridge-trio"));
  finish(toasts);
  return toasts;
}

export function onBroadwayClick(): string[] {
  session.broadwayClicks += 1;
  if (session.broadwayClicks < 5) return [];
  const toasts = grantAch("ach-hot-chicken");
  finish(toasts);
  return toasts;
}

export function onLoreRead(landmarkId: string): string[] {
  const toasts: string[] = [];
  const isNew = !player.loreReadIds.includes(landmarkId);
  if (isNew) {
    player.loreReadIds.push(landmarkId);
    player.stats.loreCardsRead = player.loreReadIds.length;
    toasts.push(...addXp(25));
    if (player.loreReadIds.length >= 10) toasts.push(...grantAch("ach-lore-10"));
  }
  const npc = npcAt(landmarkId);
  if (npc && !player.npcMetIds.includes(npc.npcId)) {
    player.npcMetIds.push(npc.npcId);
    if (player.npcMetIds.length >= NPC_COUNT) toasts.push(...grantAch("ach-all-npcs"));
  }
  if (isNew && dailyActive("daily-storm-shelter")) {
    session.loreThisDaily += 1;
    if (session.loreThisDaily >= 2) completeDaily(toasts);
  }
  if (dailyActive("daily-spring") && landmarkId === "parthenon") completeDaily(toasts);
  finish(toasts);
  return toasts;
}

export function onMarkVisited(landmarkId: string): string[] {
  const toasts: string[] = [];
  markVisited(landmarkId, toasts);
  arriveMain(landmarkId, toasts);
  arriveDaily(landmarkId, toasts);
  finish(toasts);
  return toasts;
}

export function onArrived(landmarkId: string): string[] {
  return onMarkVisited(landmarkId);
}

export function onZoom(zoom: number, nearBatman: boolean): string[] {
  if (!dailyActive("daily-postcard") || !nearBatman) return [];
  if (session.postcardBase < 0) session.postcardBase = zoom;
  if (zoom >= session.postcardBase + 1) session.postcardIn = true;
  if (!(session.postcardIn && zoom <= session.postcardBase + 0.35)) return [];
  const toasts: string[] = [];
  completeDaily(toasts);
  finish(toasts);
  return toasts;
}

export function onFog(info: FogUpdate): string[] {
  const toasts: string[] = [];
  for (let i = 0; i < info.exploredLandmarkIds.length; i++) {
    const id = info.exploredLandmarkIds[i];
    if (player.revealedLandmarkIds.includes(id)) continue;
    player.revealedLandmarkIds.push(id);
    toasts.push(...addXp(30));
    if (dailyActive("daily-month-first") && session.hiddenTargets.includes(id)) {
      completeDaily(toasts);
    }
  }
  if (
    dailyActive("daily-month-first") &&
    session.hiddenTargets.length === 0 &&
    info.grew &&
    player.daily.status === "active"
  ) {
    completeDaily(toasts);
  }
  player.fogRevealPercentDowntown = Math.round(info.percent * 10) / 10;
  if (info.percent >= 50 && !player.fogAward50) {
    player.fogAward50 = true;
    toasts.push(...addXp(100));
  }
  if (info.percent >= 100 && !player.fogAward100) {
    player.fogAward100 = true;
    toasts.push(...addXp(250));
    toasts.push(...grantAch("ach-downtown-100"));
  }
  const quest = player.activeQuestId ? questById(player.activeQuestId) : null;
  if (quest?.alsoReveal && info.exploredLandmarkIds.includes(quest.landmarkId)) {
    setBit(quest.questId, 1);
    if (!quest.lowZoomStrip && quest.questId !== "q10-city-breathes") maybeComplete(quest, toasts);
  }
  if (quest?.lowZoomStrip && info.stripReady && info.zoom <= STRIP_ZOOM_MAX) {
    completeMain(quest, toasts);
  }
  if (quest?.questId === "q10-city-breathes") advanceQ10(info, null, toasts);
  if (info.shelby && info.radnor && info.centennial) toasts.push(...grantAch("ach-green-mile"));
  if (toasts.length || info.grew) finish(toasts);
  return toasts;
}

export function onWeatherForDaily(): void {
  const away = daysBetween(player.lastPlayedDate, runtime.dateKey);
  const before = player.daily.questId;
  ensureDaily(true, player.daily.date === runtime.dateKey ? 0 : away);
  if (player.daily.questId !== before) commit();
}

export function equipTitle(id: string | null): void {
  if (id !== null && !player.unlockedTitleIds.includes(id)) return;
  player.equippedTitleId = id;
  commit();
}

export function equipCosmetic(id: string | null): void {
  if (id !== null && !player.unlockedCosmeticIds.includes(id)) return;
  player.equippedCosmeticId = id;
  commit();
}

export function resetProgress(): void {
  const away = 0;
  player = defaultPlayer();
  player.lastPlayedDate = runtime.dateKey;
  ensureDaily(runtime.weatherReady, away);
  session.broadwayClicks = 0;
  session.banks.clear();
  session.summer.clear();
  session.questTimes = [];
  session.traverse = [false, false];
  session.loreThisDaily = 0;
  session.postcardBase = -1;
  session.postcardIn = false;
  session.q10Radnor = false;
  commit();
}

export function titleName(id: string): string {
  if (id.startsWith("rank-")) {
    const level = Number(id.slice(5));
    return RANKS[level] ?? id;
  }
  return id;
}

export function cosmeticName(id: string): string {
  return COSMETIC_NAMES[id] ?? id;
}

export function rankName(level: number): string {
  return RANKS[level] ?? "Visitor";
}

export function levelFromTotal(xp: number): { level: number; into: number } {
  let level = 1;
  let remain = Math.max(0, xp);
  while (level < 20) {
    const need = XP_TO_NEXT[level] ?? 0;
    if (remain < need) return { level, into: remain };
    remain -= need;
    level += 1;
  }
  return { level: 20, into: remain };
}

export function chooseDaily(input: DailyInput): DailyDef | null {
  if (input.weekday === "Sat") return dailyByTag("saturday");
  if (input.day === 1) return dailyByTag("month-first");
  if (input.daysAway >= 7 && input.hasVisited) return dailyByTag("return");
  if (!input.weatherReady) return null;
  if (isStormCode(input.weatherCode)) return dailyByTag("storm");
  if (isRainCode(input.weatherCode)) return dailyByTag("rain");
  if (input.temperatureF >= 90) return dailyByTag("hot");
  if (input.temperatureF < 40) return dailyByTag("cold");
  if (input.weatherCode === 0) return dailyByTag("clear");
  const season = seasonFor(input.month);
  const seasonal = dailyByTag(season);
  if (seasonal) return seasonal;
  return rotateDaily(input.dayOfYear);
}

export function chainXp(): number {
  let total = 0;
  for (let i = 0; i < QUESTS.length; i++) total += QUESTS[i].xpReward;
  return total;
}

const NPC_COUNT = 8;

function defaultPlayer(): Player {
  return {
    level: 1,
    xpTotal: 0,
    xpIntoLevel: 0,
    activeQuestId: null,
    completedQuestIds: [],
    unlockedTitleIds: ["rank-1"],
    equippedTitleId: null,
    unlockedCosmeticIds: [],
    equippedCosmeticId: null,
    achievementIds: [],
    revealedLandmarkIds: [],
    visitedLandmarkIds: [],
    fogRevealPercentDowntown: 0,
    daily: { date: "", questId: "", status: "available", weatherTagUsed: "" },
    stats: { totalFlights: 0, nightVisits: 0, rainVisits: 0, bridgesCrossed: 0, loreCardsRead: 0 },
    loreReadIds: [],
    npcMetIds: [],
    objectiveStep: {},
    fogAward50: false,
    fogAward100: false,
    dailyCompletions: 0,
    lastPlayedDate: "",
    visitDates: {},
    bridgeIds: [],
    q10Step: 0,
  };
}

function sanitize(raw: Partial<Player>): Player {
  const next = defaultPlayer();
  const level = levelFromTotal(typeof raw.xpTotal === "number" ? raw.xpTotal : 0);
  next.xpTotal = level.level === 1 && level.into === 0 && raw.xpTotal === undefined ? 0 : Math.max(0, raw.xpTotal ?? 0);
  const computed = levelFromTotal(next.xpTotal);
  next.level = computed.level;
  next.xpIntoLevel = computed.into;
  next.activeQuestId = typeof raw.activeQuestId === "string" ? raw.activeQuestId : null;
  next.completedQuestIds = strings(raw.completedQuestIds);
  next.unlockedTitleIds = strings(raw.unlockedTitleIds);
  if (!next.unlockedTitleIds.includes("rank-1")) next.unlockedTitleIds.unshift("rank-1");
  next.equippedTitleId = typeof raw.equippedTitleId === "string" ? raw.equippedTitleId : null;
  next.unlockedCosmeticIds = strings(raw.unlockedCosmeticIds);
  next.equippedCosmeticId = typeof raw.equippedCosmeticId === "string" ? raw.equippedCosmeticId : null;
  next.achievementIds = Array.isArray(raw.achievementIds)
    ? raw.achievementIds.filter(
        (row): row is AchievementUnlock =>
          !!row && typeof row.achievementId === "string" && typeof row.unlockedAt === "string",
      )
    : [];
  next.revealedLandmarkIds = strings(raw.revealedLandmarkIds);
  next.visitedLandmarkIds = strings(raw.visitedLandmarkIds);
  next.fogRevealPercentDowntown =
    typeof raw.fogRevealPercentDowntown === "number" ? raw.fogRevealPercentDowntown : 0;
  if (raw.daily && typeof raw.daily.questId === "string" && typeof raw.daily.date === "string") {
    const status = raw.daily.status;
    next.daily = {
      date: raw.daily.date,
      questId: raw.daily.questId,
      status: status === "active" || status === "complete" ? status : "available",
      weatherTagUsed: typeof raw.daily.weatherTagUsed === "string" ? raw.daily.weatherTagUsed : "",
    };
  }
  if (raw.stats) {
    next.stats = {
      totalFlights: num(raw.stats.totalFlights),
      nightVisits: num(raw.stats.nightVisits),
      rainVisits: num(raw.stats.rainVisits),
      bridgesCrossed: num(raw.stats.bridgesCrossed),
      loreCardsRead: num(raw.stats.loreCardsRead),
    };
  }
  next.loreReadIds = strings(raw.loreReadIds);
  next.npcMetIds = strings(raw.npcMetIds);
  next.objectiveStep = recordNums(raw.objectiveStep);
  next.fogAward50 = raw.fogAward50 === true;
  next.fogAward100 = raw.fogAward100 === true;
  next.dailyCompletions = num(raw.dailyCompletions);
  next.lastPlayedDate = typeof raw.lastPlayedDate === "string" ? raw.lastPlayedDate : "";
  next.visitDates = recordStrings(raw.visitDates);
  next.bridgeIds = strings(raw.bridgeIds);
  next.q10Step = num(raw.q10Step);
  next.stats.loreCardsRead = next.loreReadIds.length;
  next.stats.bridgesCrossed = next.bridgeIds.length;
  return next;
}

function ensureDaily(weatherReady: boolean, daysAway: number): void {
  if (player.daily.date === runtime.dateKey && player.daily.questId) return;
  const picked = chooseDaily({
    weekday: runtime.weekday,
    month: runtime.month,
    day: runtime.day,
    dayOfYear: runtime.dayOfYear,
    daysAway,
    hasVisited: player.visitedLandmarkIds.length > 0,
    weatherCode: runtime.weatherCode,
    temperatureF: cToF(runtime.temperatureC),
    weatherReady,
  });
  if (!picked) return;
  player.daily = {
    date: runtime.dateKey,
    questId: picked.questId,
    status: "available",
    weatherTagUsed: picked.tag,
  };
  session.loreThisDaily = 0;
  session.postcardBase = -1;
  session.postcardIn = false;
  session.hiddenTargets =
    picked.tag === "month-first"
      ? LANDMARKS.map((landmark) => landmark.id).filter((id) => !player.revealedLandmarkIds.includes(id))
      : [];
}

function dailyByTag(tag: DailyTag): DailyDef | null {
  for (let i = 0; i < DAILIES.length; i++) {
    if (DAILIES[i].tag === tag) return DAILIES[i];
  }
  return null;
}

function rotateDaily(dayOfYear: number): DailyDef {
  const landmarkId = ROTATE_IDS[Math.abs(dayOfYear) % ROTATE_IDS.length] ?? ROTATE_IDS[0];
  const landmark = landmarkById(landmarkId);
  return {
    questId: `daily-rotate-${landmarkId}`,
    tag: "rotate",
    title: landmark?.name ?? landmarkId,
    landmarkIds: [landmarkId],
    objectiveType: "flyTo",
    objectiveText: "rotate landmark by day-of-year",
    xpReward: 75,
    bonusXp: 0,
  };
}

function resolveDaily(id: string): DailyDef | null {
  const known = dailyById(id);
  if (known) return known;
  if (!id.startsWith("daily-rotate-")) return null;
  const landmarkId = id.slice("daily-rotate-".length);
  if (!landmarkById(landmarkId)) return null;
  return {
    questId: id,
    tag: "rotate",
    title: landmarkById(landmarkId)?.name ?? landmarkId,
    landmarkIds: [landmarkId],
    objectiveType: "flyTo",
    objectiveText: "rotate landmark by day-of-year",
    xpReward: 75,
    bonusXp: 0,
  };
}

function availableMain(): QuestDef | null {
  for (let i = 0; i < QUESTS.length; i++) {
    const quest = QUESTS[i];
    if (player.completedQuestIds.includes(quest.questId)) continue;
    if (quest.requiresQuestId && !player.completedQuestIds.includes(quest.requiresQuestId)) return null;
    return quest;
  }
  return null;
}

function arriveMain(landmarkId: string, toasts: string[]): void {
  const quest = player.activeQuestId ? questById(player.activeQuestId) : null;
  if (!quest || quest.traverse || quest.lowZoomStrip) return;
  if (quest.questId === "q10-city-breathes") {
    advanceQ10(null, landmarkId, toasts);
    return;
  }
  if (quest.landmarkId !== landmarkId) return;
  setBit(quest.questId, 2);
  maybeComplete(quest, toasts);
}

function advanceQ10(info: FogUpdate | null, arrivedId: string | null, toasts: string[]): void {
  const shelbyExplored = info ? info.shelby : player.revealedLandmarkIds.includes("shelby-bottoms");
  const radnorExplored = info ? info.radnor : player.revealedLandmarkIds.includes("radnor-lake");
  const shelbyVisited = arrivedId === "shelby-bottoms" || player.visitedLandmarkIds.includes("shelby-bottoms");
  if (player.q10Step < 1 && shelbyVisited && shelbyExplored) {
    player.q10Step = 1;
    session.q10Radnor = false;
  }
  if (arrivedId === "radnor-lake" && player.q10Step >= 1) session.q10Radnor = true;
  if (player.q10Step >= 1 && session.q10Radnor && radnorExplored) {
    player.q10Step = 2;
    const quest = questById("q10-city-breathes");
    if (quest) completeMain(quest, toasts);
  }
}

function maybeComplete(quest: QuestDef, toasts: string[]): void {
  if (player.completedQuestIds.includes(quest.questId)) return;
  const bits = player.objectiveStep[quest.questId] ?? 0;
  if (quest.alsoReveal && (bits & 1) === 0) return;
  if ((bits & 2) === 0) return;
  completeMain(quest, toasts);
}

function completeMain(quest: QuestDef, toasts: string[]): void {
  if (player.completedQuestIds.includes(quest.questId)) return;
  player.completedQuestIds.push(quest.questId);
  if (player.activeQuestId === quest.questId) player.activeQuestId = null;
  if (quest.cosmeticRewardId) unlockCosmetic(quest.cosmeticRewardId);
  if (quest.titleReward) unlockTitle(quest.titleReward);
  toasts.push(quest.completionText || quest.title);
  if (quest.questId === "q10-city-breathes") toasts.push(MAIN_COMPLETE_BANNER);
  toasts.push(...addXp(quest.xpReward));
  const now = performance.now();
  const recent: number[] = [];
  for (let i = 0; i < session.questTimes.length; i++) {
    if (now - session.questTimes[i] < 600000) recent.push(session.questTimes[i]);
  }
  recent.push(now);
  session.questTimes = recent;
  if (recent.length >= 3) toasts.push(...grantAch("ach-speed-tour"));
}

function arriveDaily(landmarkId: string, toasts: string[]): void {
  if (player.daily.status !== "active") return;
  const daily = currentDaily();
  if (!daily) return;
  switch (daily.tag) {
    case "saturday":
    case "cold":
    case "rotate":
      if (daily.landmarkIds.includes(landmarkId)) completeDaily(toasts);
      break;
    case "rain":
      if (landmarkId === "seigenthaler-bridge" && isRainCode(runtime.weatherCode)) completeDaily(toasts);
      break;
    case "hot":
      if (landmarkId === "radnor-lake" || landmarkId === "shelby-bottoms") completeDaily(toasts);
      break;
    case "fall":
      if (landmarkId === "shelby-bottoms" && runtime.hour >= 17) completeDaily(toasts);
      break;
    case "winter":
      if (landmarkId === "broadway" && runtime.phase === "night") completeDaily(toasts);
      break;
    case "summer":
      if (landmarkId === "nissan-stadium" || landmarkId === "broadway") session.summer.add(landmarkId);
      if (session.summer.has("nissan-stadium") && session.summer.has("broadway")) completeDaily(toasts);
      break;
    case "return":
      if (player.visitedLandmarkIds.includes(landmarkId)) completeDaily(toasts);
      break;
    case "spring":
    case "storm":
    case "clear":
    case "month-first":
      break;
    default: {
      const neverTag: never = daily.tag;
      void neverTag;
    }
  }
}

function completeDaily(toasts: string[]): void {
  if (player.daily.status === "complete") return;
  const daily = currentDaily();
  if (!daily) return;
  player.daily.status = "complete";
  player.dailyCompletions += 1;
  toasts.push(daily.title);
  toasts.push(...addXp(daily.xpReward + daily.bonusXp));
  if (player.dailyCompletions >= 7) toasts.push(...grantAch("ach-streak-7"));
}

function markVisited(landmarkId: string, toasts: string[]): void {
  if (!player.visitedLandmarkIds.includes(landmarkId)) player.visitedLandmarkIds.push(landmarkId);
  player.visitDates[landmarkId] = runtime.dateKey;
  if (runtime.phase === "night" || runtime.hour >= 19) {
    player.stats.nightVisits += 1;
    toasts.push(...grantAch("ach-night-owl"));
  }
  if (runtime.hour < 7) toasts.push(...grantAch("ach-early-bird"));
  if (isRainCode(runtime.weatherCode)) {
    player.stats.rainVisits += 1;
    toasts.push(...grantAch("ach-rainy-day"));
  }
  if (landmarkId === "batman-building" || landmarkId === "nissan-stadium") {
    session.banks.add(landmarkId);
    if (session.banks.size === 2) toasts.push(...grantAch("ach-both-banks"));
  }
  const ryman = player.visitDates["ryman-auditorium"];
  const opry = player.visitDates["grand-ole-opry"];
  if (ryman && ryman === opry) toasts.push(...grantAch("ach-full-circle"));
}

function dailyActive(questId: string): boolean {
  return player.daily.status === "active" && player.daily.questId === questId;
}

function setBit(questId: string, bit: number): void {
  player.objectiveStep[questId] = (player.objectiveStep[questId] ?? 0) | bit;
}

function addXp(amount: number): string[] {
  if (amount <= 0) return [];
  const before = player.level;
  player.xpTotal += amount;
  const next = levelFromTotal(player.xpTotal);
  player.level = next.level;
  player.xpIntoLevel = next.into;
  const toasts: string[] = [];
  for (let level = before + 1; level <= player.level; level++) {
    const rank = RANKS[level] ?? "Visitor";
    unlockTitle(`rank-${level}`);
    toasts.push(`LEVEL UP — You are now a ${rank}`);
    if (level === 10) toasts.push(L10_NOTE);
    if (level === 20) unlockCosmetic("hot-chicken-crown-pin");
  }
  return toasts;
}

function grantAch(id: string): string[] {
  if (hasAch(id)) return [];
  if (id === "ach-completionist" && !completionistReady()) return [];
  const def = achievementById(id);
  if (!def) return [];
  player.achievementIds.push({ achievementId: id, unlockedAt: new Date().toISOString() });
  const toasts = [def.name];
  if (def.description !== def.name) toasts.push(def.description);
  if (def.cosmeticRewardId) unlockCosmetic(def.cosmeticRewardId);
  if (def.titleReward) unlockTitle(def.titleReward);
  toasts.push(...addXp(def.xpReward));
  if (id !== "ach-completionist") toasts.push(...grantAch("ach-completionist"));
  return toasts;
}

function completionistReady(): boolean {
  if (player.level < 20) return false;
  if (player.loreReadIds.length < LANDMARKS.length) return false;
  for (let i = 0; i < QUESTS.length; i++) {
    if (!player.completedQuestIds.includes(QUESTS[i].questId)) return false;
  }
  return true;
}

function hasAch(id: string): boolean {
  for (let i = 0; i < player.achievementIds.length; i++) {
    if (player.achievementIds[i].achievementId === id) return true;
  }
  return false;
}

function unlockTitle(id: string): void {
  if (!player.unlockedTitleIds.includes(id)) player.unlockedTitleIds.push(id);
}

function unlockCosmetic(id: string): void {
  if (!player.unlockedCosmeticIds.includes(id)) player.unlockedCosmeticIds.push(id);
}

function finish(toasts: string[]): void {
  toasts.push(...grantAch("ach-completionist"));
  commit();
}

function commit(): void {
  save();
  for (let i = 0; i < listeners.length; i++) listeners[i]();
}

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(player));
  } catch {
    /* private mode */
  }
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] === "string") out.push(value[i]);
  }
  return out;
}

function recordStrings(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  const entries = Object.entries(value as Record<string, unknown>);
  for (let i = 0; i < entries.length; i++) {
    const text = entries[i][1];
    if (typeof text === "string") out[entries[i][0]] = text;
  }
  return out;
}

function recordNums(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, number> = {};
  const entries = Object.entries(value as Record<string, unknown>);
  for (let i = 0; i < entries.length; i++) {
    const amount = entries[i][1];
    if (typeof amount === "number") out[entries[i][0]] = amount;
  }
  return out;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function daysBetween(from: string, to: string): number {
  if (!from || !to) return 0;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.floor((b - a) / 86400000);
}

export function achievementVisible(id: string): boolean {
  const def = achievementById(id);
  if (!def) return false;
  if (!def.secret) return true;
  return hasAch(id);
}

export function listAchievements(): readonly AchievementDef[] {
  return ACHIEVEMENTS;
}
