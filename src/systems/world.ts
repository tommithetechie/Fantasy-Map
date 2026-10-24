import type { Phase } from "./solar";

export type ObjectiveType =
  | "flyTo"
  | "clickLandmark"
  | "revealFog"
  | "flyToAndClick"
  | "visitAtTime"
  | "visitInWeather";

export type LandmarkDef = {
  id: string;
  /** Pack fantasy name. */
  name: string;
  /** Pack common name. */
  common: string;
  coordinates: [number, number];
  lore: string;
  /** Real-history line, only when the pack states one. */
  fact: string;
};

/**
 * Twelve hero landmarks. The pack marks every coordinate approximate.
 * Frist has no landmarkId in the pack; `frist-art-museum` is only so the twelfth card can open.
 */
export const LANDMARKS: readonly LandmarkDef[] = [
  {
    id: "batman-building",
    name: "The Twin-Spired Watchtower",
    common: "Batman Building",
    coordinates: [-86.7768, 36.1629],
    lore: "Ears up since 1994. The Dark Knight never confirmed the lease, but he never denied it either.",
    fact: "",
  },
  {
    id: "ryman-auditorium",
    name: "The Mother Church of Song",
    common: "Ryman Auditorium",
    coordinates: [-86.7785, 36.1613],
    lore: "Built for a revival in 1892; the acoustics were the miracle. Pew seating. No bad seat. Every legend has knelt here.",
    fact: "tabernacle 1892, Opry home 1943–1974, pews + stained glass.",
  },
  {
    id: "broadway",
    name: "The Neon Gauntlet",
    common: "Lower Broadway honky-tonks",
    coordinates: [-86.778, 36.1602],
    lore: "Four blocks, forty stages, zero cover charge. Survive it on a Saturday night for +10 Stamina.",
    fact: "",
  },
  {
    id: "parthenon",
    name: "Temple of Athena of the South",
    common: "The Parthenon",
    coordinates: [-86.8133, 36.1497],
    lore: "A full-scale temple built for a birthday party in 1897. The 42-foot goddess inside is gilded, patient, and undefeated.",
    fact: "",
  },
  {
    id: "nissan-stadium",
    name: "The Titan's Bowl",
    common: "Nissan Stadium",
    coordinates: [-86.7713, 36.1665],
    lore: "Across the river, the giants clash on Sundays. When it roars, the Citadel can hear it — and pretends not to be jealous.",
    fact: "",
  },
  {
    id: "grand-ole-opry",
    name: "The Unbroken Circle",
    common: "Grand Ole Opry House",
    coordinates: [-86.692, 36.2069],
    lore: "On air since 1925 — the longest quest chain in the realm. Stand in the circle of Ryman oak. Do not break it.",
    fact: "WSM/Barn Dance 1925, the 1927 naming night, circle of oak, 2010 flood.",
  },
  {
    id: "country-music-hall-of-fame",
    name: "The Hall of Remembered Voices",
    common: "Country Music Hall of Fame",
    coordinates: [-86.7763, 36.1582],
    lore: "Its windows are piano keys and its tower is a radio spire. Inside, every fallen hero's gear is preserved.",
    fact: "",
  },
  {
    id: "state-capitol",
    name: "The Tomb-Crowned Seat",
    common: "Tennessee State Capitol",
    coordinates: [-86.7843, 36.1658],
    lore: "A Greek temple on a hill, finished in 1859, with its architect and a president buried in its walls. Government, but make it a dungeon.",
    fact: "completed 1859, Strickland + Polk buried on grounds, no dome.",
  },
  {
    id: "shelby-bottoms",
    name: "The Riverbottom Wilds",
    common: "Shelby Bottoms",
    coordinates: [-86.724, 36.169],
    lore: "A thousand acres where the city gives up. Herons are the flight masters here.",
    fact: "",
  },
  {
    id: "radnor-lake",
    name: "The Stillwater Sanctum",
    common: "Radnor Lake",
    coordinates: [-86.8096, 36.0637],
    lore: "No swimming, no jogging, no noise — a lake built in 1914 for steam engines, now ruled by turtles, otters, and silence.",
    fact: "",
  },
  {
    id: "seigenthaler-bridge",
    name: "The Walkers' Span",
    common: "Seigenthaler Pedestrian Bridge",
    coordinates: [-86.7726, 36.1622],
    lore: "Built in 1909, saved from demolition, now car-free forever. The only crossing where the view is the entire point.",
    fact: "",
  },
  {
    id: "frist-art-museum",
    name: "The Marble Archive",
    common: "Frist Art Museum",
    coordinates: [-86.7838, 36.1579],
    lore: "An Art Deco marble fortress from 1934 that delivered mail, then delivered masterpieces. The loot rotates.",
    fact: "",
  },
];

/** Quest rotate list — the 11 ids the pack names. Frist is not in that list. */
export const ROTATE_IDS: readonly string[] = [
  "batman-building",
  "ryman-auditorium",
  "broadway",
  "parthenon",
  "nissan-stadium",
  "state-capitol",
  "country-music-hall-of-fame",
  "seigenthaler-bridge",
  "grand-ole-opry",
  "shelby-bottoms",
  "radnor-lake",
];

export type NpcDef = {
  npcId: string;
  name: string;
  role: string;
  homeLandmarkId: string;
  greetingLine: string;
};

export const NPCS: readonly NpcDef[] = [
  {
    npcId: "cartographer",
    name: "The Cartographer of Nash",
    role: "gives Q1/Q4/Q10",
    homeLandmarkId: "batman-building",
    greetingLine: "Mind the fog, traveler. I drew this city once — then the city went and changed on me.",
  },
  {
    npcId: "bard",
    name: "The Bard of Broadway",
    role: "gives Q2/Q3/Q9",
    homeLandmarkId: "broadway",
    greetingLine: "Tip the band, hydrate, and never request the song they're already playing.",
  },
  {
    npcId: "captain",
    name: "Captain of the Cumberland",
    role: "gives Q5/Q8",
    homeLandmarkId: "seigenthaler-bridge",
    greetingLine: "River's older than every song in this town.",
  },
  {
    npcId: "archivist",
    name: "The Archivist of the Hall",
    role: "gives Q6/Q7",
    homeLandmarkId: "country-music-hall-of-fame",
    greetingLine: "Everything in this hall was somebody's working tool once.",
  },
  {
    npcId: "usher",
    name: "The Usher of the Mother Church",
    role: "Ryman",
    homeLandmarkId: "ryman-auditorium",
    greetingLine: "Your pew's third from the front, hon.",
  },
  {
    npcId: "athena",
    name: "Athena's Keeper",
    role: "Parthenon",
    homeLandmarkId: "parthenon",
    greetingLine: "Forty-two feet tall, gold leaf, and a tiny Nike in her palm.",
  },
  {
    npcId: "voice",
    name: "The Voice on the Radio",
    role: "Grand Ole Opry",
    homeLandmarkId: "grand-ole-opry",
    greetingLine: "",
  },
  {
    npcId: "keeper",
    name: "The Keeper of the Bottoms",
    role: "gives Q10",
    homeLandmarkId: "shelby-bottoms",
    greetingLine: "Herons don't care about your follower count.",
  },
];

export type QuestDef = {
  questId: string;
  chainOrder: number;
  title: string;
  landmarkId: string;
  secondLandmarkId: string | null;
  giverNpcId: string;
  objectiveType: ObjectiveType;
  objectiveText: string;
  giverLine: string;
  completionText: string;
  xpReward: number;
  cosmeticRewardId: string | null;
  cosmeticName: string | null;
  titleReward: string | null;
  requiresQuestId: string | null;
  /** Pack compounds revealFog with another objective. */
  alsoReveal: boolean;
  /** Full-length traversal, no teleport. */
  traverse: boolean;
  /** Broadway 1st–5th strip at low zoom. */
  lowZoomStrip: boolean;
};

export const QUESTS: readonly QuestDef[] = [
  {
    questId: "q01-bat-signal",
    chainOrder: 1,
    title: "The Bat-Signal Over the Cumberland",
    landmarkId: "batman-building",
    secondLandmarkId: null,
    giverNpcId: "cartographer",
    objectiveType: "flyToAndClick",
    objectiveText: "revealFog + flyToAndClick",
    giverLine:
      "Every map of Nash starts with the tower with ears. If you can't find the Batman Building, you can't find anything.",
    completionText: "",
    xpReward: 100,
    cosmeticRewardId: "bat-ears-map-pin",
    cosmeticName: "Bat Ears Map Pin",
    titleReward: null,
    requiresQuestId: null,
    alsoReveal: true,
    traverse: false,
    lowZoomStrip: false,
  },
  {
    questId: "q02-mother-church",
    chainOrder: 2,
    title: "Take Your Pew at the Mother Church",
    landmarkId: "ryman-auditorium",
    secondLandmarkId: null,
    giverNpcId: "bard",
    objectiveType: "flyToAndClick",
    objectiveText: "flyToAndClick",
    giverLine: "Tip the band, hydrate, and never request the song they're already playing.",
    completionText: "tabernacle 1892, Opry home 1943–1974, pews + stained glass.",
    xpReward: 120,
    cosmeticRewardId: null,
    cosmeticName: null,
    titleReward: "Pew Warmer",
    requiresQuestId: "q01-bat-signal",
    alsoReveal: false,
    traverse: false,
    lowZoomStrip: false,
  },
  {
    questId: "q03-honky-tonk-gauntlet",
    chainOrder: 3,
    title: "Survive the Honky-Tonk Gauntlet",
    landmarkId: "broadway",
    secondLandmarkId: null,
    giverNpcId: "bard",
    objectiveType: "revealFog",
    objectiveText: "revealFog the full 1st–5th Ave strip at low zoom",
    giverLine: "Tip the band, hydrate, and never request the song they're already playing.",
    completionText: "",
    xpReward: 150,
    cosmeticRewardId: "neon-trail",
    cosmeticName: "Neon Trail",
    titleReward: null,
    requiresQuestId: "q02-mother-church",
    alsoReveal: true,
    traverse: false,
    lowZoomStrip: true,
  },
  {
    questId: "q04-goddess-west-end",
    chainOrder: 4,
    title: "The Goddess in the West End",
    landmarkId: "parthenon",
    secondLandmarkId: null,
    giverNpcId: "cartographer",
    objectiveType: "flyToAndClick",
    objectiveText: "flyToAndClick",
    giverLine: "Mind the fog, traveler. I drew this city once — then the city went and changed on me.",
    completionText: "",
    xpReward: 180,
    cosmeticRewardId: null,
    cosmeticName: null,
    titleReward: "Athens of the South",
    requiresQuestId: "q03-honky-tonk-gauntlet",
    alsoReveal: false,
    traverse: false,
    lowZoomStrip: false,
  },
  {
    questId: "q05-face-the-titans",
    chainOrder: 5,
    title: "Cross the River, Face the Titans",
    landmarkId: "nissan-stadium",
    secondLandmarkId: null,
    giverNpcId: "captain",
    objectiveType: "flyToAndClick",
    objectiveText: "flyToAndClick across the river",
    giverLine: "River's older than every song in this town.",
    completionText: "",
    xpReward: 200,
    cosmeticRewardId: "river-wake",
    cosmeticName: "River-Wake",
    titleReward: null,
    requiresQuestId: "q04-goddess-west-end",
    alsoReveal: false,
    traverse: false,
    lowZoomStrip: false,
  },
  {
    questId: "q06-hill-of-laws",
    chainOrder: 6,
    title: "The Hill Where Laws Are Forged",
    landmarkId: "state-capitol",
    secondLandmarkId: null,
    giverNpcId: "archivist",
    objectiveType: "flyToAndClick",
    objectiveText: "flyToAndClick",
    giverLine: "Everything in this hall was somebody's working tool once.",
    completionText: "completed 1859, Strickland + Polk buried on grounds, no dome.",
    xpReward: 220,
    cosmeticRewardId: null,
    cosmeticName: null,
    titleReward: "Capitol Climber",
    requiresQuestId: "q05-face-the-titans",
    alsoReveal: false,
    traverse: false,
    lowZoomStrip: false,
  },
  {
    questId: "q07-hall-of-legends",
    chainOrder: 7,
    title: "Enter the Hall of Legends",
    landmarkId: "country-music-hall-of-fame",
    secondLandmarkId: null,
    giverNpcId: "archivist",
    objectiveType: "flyToAndClick",
    objectiveText: "flyToAndClick incl. rotunda/keyboard-windows",
    giverLine: "Everything in this hall was somebody's working tool once.",
    completionText: "",
    xpReward: 250,
    cosmeticRewardId: "gold-record-marker-ring",
    cosmeticName: "Gold Record Marker Ring",
    titleReward: null,
    requiresQuestId: "q06-hill-of-laws",
    alsoReveal: false,
    traverse: false,
    lowZoomStrip: false,
  },
  {
    questId: "q08-bridge-of-second-chances",
    chainOrder: 8,
    title: "The Bridge of Second Chances",
    landmarkId: "seigenthaler-bridge",
    secondLandmarkId: null,
    giverNpcId: "captain",
    objectiveType: "flyTo",
    objectiveText: "flyTo full-length traversal, no teleport",
    giverLine: "River's older than every song in this town.",
    completionText: "",
    xpReward: 280,
    cosmeticRewardId: null,
    cosmeticName: null,
    titleReward: "Bridge Walker",
    requiresQuestId: "q07-hall-of-legends",
    alsoReveal: false,
    traverse: true,
    lowZoomStrip: false,
  },
  {
    questId: "q09-pilgrimage-to-the-opry",
    chainOrder: 9,
    title: "Pilgrimage to the Opry",
    landmarkId: "grand-ole-opry",
    secondLandmarkId: null,
    giverNpcId: "bard",
    objectiveType: "flyToAndClick",
    objectiveText: "flyToAndClick, long NE flight",
    giverLine: "Tip the band, hydrate, and never request the song they're already playing.",
    completionText: "",
    xpReward: 320,
    cosmeticRewardId: "circle-of-oak-aura",
    cosmeticName: "Circle of Oak Aura",
    titleReward: null,
    requiresQuestId: "q08-bridge-of-second-chances",
    alsoReveal: false,
    traverse: false,
    lowZoomStrip: false,
  },
  {
    questId: "q10-city-breathes",
    chainOrder: 10,
    title: "Where the City Learns to Breathe",
    landmarkId: "shelby-bottoms",
    secondLandmarkId: "radnor-lake",
    giverNpcId: "keeper",
    objectiveType: "flyToAndClick",
    objectiveText: "Shelby Bottoms THEN Radnor Lake — revealFog x2 + flyToAndClick",
    giverLine: "Herons don't care about your follower count.",
    completionText: "MAIN QUEST COMPLETE — VISITOR NO MORE",
    xpReward: 400,
    cosmeticRewardId: "lost-star-map-skin",
    cosmeticName: "Lost Star Map Skin",
    titleReward: "Keeper of the Lost Star",
    requiresQuestId: "q09-pilgrimage-to-the-opry",
    alsoReveal: true,
    traverse: false,
    lowZoomStrip: false,
  },
];

export type AchievementDef = {
  achievementId: string;
  name: string;
  description: string;
  conditionText: string;
  xpReward: number;
  secret: boolean;
  cosmeticRewardId: string | null;
  cosmeticName: string | null;
  titleReward: string | null;
};

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    achievementId: "ach-first-flight",
    name: "first Fly To",
    description: "first Fly To",
    conditionText: "first Fly To",
    xpReward: 50,
    secret: false,
    cosmeticRewardId: null,
    cosmeticName: null,
    titleReward: null,
  },
  {
    achievementId: "ach-downtown-100",
    name: "Fog? What Fog?",
    description: "100% downtown revealed",
    conditionText: "100% downtown revealed",
    xpReward: 250,
    secret: false,
    cosmeticRewardId: "clear-skies-border",
    cosmeticName: "Clear-Skies Border",
    titleReward: null,
  },
  {
    achievementId: "ach-night-owl",
    name: "landmark at night/after 7pm",
    description: "landmark at night/after 7pm",
    conditionText: "landmark at night/after 7pm",
    xpReward: 50,
    secret: false,
    cosmeticRewardId: null,
    cosmeticName: null,
    titleReward: null,
  },
  {
    achievementId: "ach-rainy-day",
    name: "landmark in live rain",
    description: "landmark in live rain",
    conditionText: "landmark in live rain",
    xpReward: 50,
    secret: false,
    cosmeticRewardId: null,
    cosmeticName: null,
    titleReward: null,
  },
  {
    achievementId: "ach-bridge-trio",
    name: "fly 3 Cumberland bridges",
    description: "fly 3 Cumberland bridges",
    conditionText: "fly 3 Cumberland bridges",
    xpReward: 50,
    secret: false,
    cosmeticRewardId: null,
    cosmeticName: null,
    titleReward: null,
  },
  {
    achievementId: "ach-lore-10",
    name: "read 10 lore cards",
    description: "read 10 lore cards",
    conditionText: "read 10 lore cards",
    xpReward: 50,
    secret: false,
    cosmeticRewardId: null,
    cosmeticName: null,
    titleReward: null,
  },
  {
    achievementId: "ach-all-npcs",
    name: "meet all 8 NPCs",
    description: "meet all 8 NPCs",
    conditionText: "meet all 8 NPCs",
    xpReward: 50,
    secret: false,
    cosmeticRewardId: null,
    cosmeticName: null,
    titleReward: null,
  },
  {
    achievementId: "ach-hot-chicken",
    name: "click same Broadway landmark 5x in one session",
    description: "click same Broadway landmark 5x in one session",
    conditionText: "click same Broadway landmark 5x in one session",
    xpReward: 50,
    secret: true,
    cosmeticRewardId: null,
    cosmeticName: null,
    titleReward: null,
  },
  {
    achievementId: "ach-full-circle",
    name: "Ryman + Opry same day",
    description: "Ryman + Opry same day",
    conditionText: "Ryman + Opry same day",
    xpReward: 50,
    secret: false,
    cosmeticRewardId: null,
    cosmeticName: null,
    titleReward: null,
  },
  {
    achievementId: "ach-both-banks",
    name: "Nissan + Batman in one session, no fast-travel menu",
    description: "Nissan + Batman in one session, no fast-travel menu",
    conditionText: "Nissan + Batman in one session, no fast-travel menu",
    xpReward: 50,
    secret: false,
    cosmeticRewardId: null,
    cosmeticName: null,
    titleReward: null,
  },
  {
    achievementId: "ach-green-mile",
    name: "Shelby + Radnor + Centennial revealed",
    description: "Shelby + Radnor + Centennial revealed",
    conditionText: "Shelby + Radnor + Centennial revealed",
    xpReward: 100,
    secret: false,
    cosmeticRewardId: null,
    cosmeticName: null,
    titleReward: null,
  },
  {
    achievementId: "ach-speed-tour",
    name: "3 quests in <10 min",
    description: "Bless your heart. Now go back and read the lore cards.",
    conditionText: "3 quests in <10 min",
    xpReward: 50,
    secret: true,
    cosmeticRewardId: null,
    cosmeticName: null,
    titleReward: null,
  },
  {
    achievementId: "ach-early-bird",
    name: "visit before 7am",
    description: "visit before 7am",
    conditionText: "visit before 7am",
    xpReward: 50,
    secret: false,
    cosmeticRewardId: null,
    cosmeticName: null,
    titleReward: null,
  },
  {
    achievementId: "ach-streak-7",
    name: "7 total daily completions",
    description: "7 total daily completions — NOT consecutive",
    conditionText: "7 total daily completions",
    xpReward: 50,
    secret: false,
    cosmeticRewardId: null,
    cosmeticName: null,
    titleReward: null,
  },
  {
    achievementId: "ach-completionist",
    name: "all quests + all lore + L20",
    description: "all quests + all lore + L20",
    conditionText: "all quests + all lore + L20",
    xpReward: 500,
    secret: false,
    cosmeticRewardId: "gold-foil-journal-page",
    cosmeticName: "gold-foil journal page",
    titleReward: "Legend of the Lost Star",
  },
];

/** XP required to leave this level. Index 0 unused. Level 20 has none. */
export const XP_TO_NEXT: readonly number[] = [
  0, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1350,
  1500, 1750,
];

export const RANKS: readonly string[] = [
  "",
  "Visitor",
  "Day-Tripper",
  "Downtown Wanderer",
  "Broadway Regular",
  "Honky-Tonk Hero",
  "River Crosser",
  "West End Scholar",
  "SoBro Insider",
  "Music Valley Pilgrim",
  "Nash Guide",
  "Greenway Ranger",
  "Skyline Cartographer",
  "Opry Regular",
  "Keeper of Stories",
  "Cumberland Captain",
  "Athens Laureate",
  "Hall of Famer (Honorary)",
  "Lost Star Bearer",
  "Voice of Nash",
  "True Nashvillian",
];

export const L10_NOTE =
  "Can give directions without saying 'you know, by the Batman Building'";

export const MAIN_COMPLETE_BANNER = "MAIN QUEST COMPLETE — VISITOR NO MORE";

export type DailyTag =
  | "saturday"
  | "month-first"
  | "return"
  | "storm"
  | "rain"
  | "hot"
  | "cold"
  | "clear"
  | "spring"
  | "summer"
  | "fall"
  | "winter"
  | "rotate";

export type DailyDef = {
  questId: string;
  tag: DailyTag;
  title: string;
  landmarkIds: readonly string[];
  objectiveType: ObjectiveType;
  objectiveText: string;
  xpReward: number;
  bonusXp: number;
};

export const DAILIES: readonly DailyDef[] = [
  {
    questId: "daily-opry-night",
    tag: "saturday",
    title: "Opry Night",
    landmarkIds: ["grand-ole-opry"],
    objectiveType: "flyToAndClick",
    objectiveText: "Opry Night",
    xpReward: 75,
    bonusXp: 25,
  },
  {
    questId: "daily-month-first",
    tag: "month-first",
    title: "reveal one hidden landmark",
    landmarkIds: [],
    objectiveType: "revealFog",
    objectiveText: "reveal one hidden landmark",
    xpReward: 75,
    bonusXp: 0,
  },
  {
    questId: "daily-welcome-back",
    tag: "return",
    title: "Well, Look Who's Back in Town",
    landmarkIds: [],
    objectiveType: "flyTo",
    objectiveText: "fly to any visited landmark",
    xpReward: 75,
    bonusXp: 0,
  },
  {
    questId: "daily-storm-shelter",
    tag: "storm",
    title: "Storm Shelter Scholar",
    landmarkIds: [],
    objectiveType: "clickLandmark",
    objectiveText: "read 2 new lore cards",
    xpReward: 75,
    bonusXp: 0,
  },
  {
    questId: "daily-raindrops",
    tag: "rain",
    title: "Raindrops on the River",
    landmarkIds: ["seigenthaler-bridge"],
    objectiveType: "visitInWeather",
    objectiveText: "Seigenthaler in rain",
    xpReward: 75,
    bonusXp: 0,
  },
  {
    questId: "daily-shade",
    tag: "hot",
    title: "Find the Shade",
    landmarkIds: ["radnor-lake", "shelby-bottoms"],
    objectiveType: "flyTo",
    objectiveText: "Radnor OR Shelby",
    xpReward: 75,
    bonusXp: 0,
  },
  {
    questId: "daily-warm-pews",
    tag: "cold",
    title: "Warm Pews",
    landmarkIds: ["ryman-auditorium"],
    objectiveType: "flyToAndClick",
    objectiveText: "Ryman",
    xpReward: 75,
    bonusXp: 0,
  },
  {
    questId: "daily-postcard",
    tag: "clear",
    title: "Postcard Day",
    landmarkIds: ["batman-building"],
    objectiveType: "flyTo",
    objectiveText: "Batman Building, zoom in then out",
    xpReward: 75,
    bonusXp: 0,
  },
  {
    questId: "daily-spring",
    tag: "spring",
    title: "Parthenon/Athena card",
    landmarkIds: ["parthenon"],
    objectiveType: "clickLandmark",
    objectiveText: "Parthenon/Athena card",
    xpReward: 75,
    bonusXp: 0,
  },
  {
    questId: "daily-summer",
    tag: "summer",
    title: "Nissan + Broadway one session",
    landmarkIds: ["nissan-stadium", "broadway"],
    objectiveType: "flyTo",
    objectiveText: "Nissan + Broadway one session",
    xpReward: 75,
    bonusXp: 0,
  },
  {
    questId: "daily-fall",
    tag: "fall",
    title: "Shelby after 5pm",
    landmarkIds: ["shelby-bottoms"],
    objectiveType: "visitAtTime",
    objectiveText: "Shelby after 5pm",
    xpReward: 75,
    bonusXp: 0,
  },
  {
    questId: "daily-winter",
    tag: "winter",
    title: "Broadway in Night mode",
    landmarkIds: ["broadway"],
    objectiveType: "visitAtTime",
    objectiveText: "Broadway in Night mode",
    xpReward: 75,
    bonusXp: 0,
  },
];

export function landmarkById(id: string): LandmarkDef | null {
  for (let i = 0; i < LANDMARKS.length; i++) {
    if (LANDMARKS[i].id === id) return LANDMARKS[i];
  }
  return null;
}

export function questById(id: string): QuestDef | null {
  for (let i = 0; i < QUESTS.length; i++) {
    if (QUESTS[i].questId === id) return QUESTS[i];
  }
  return null;
}

export function npcAt(landmarkId: string): NpcDef | null {
  for (let i = 0; i < NPCS.length; i++) {
    if (NPCS[i].homeLandmarkId === landmarkId) return NPCS[i];
  }
  return null;
}

export function npcById(id: string): NpcDef | null {
  for (let i = 0; i < NPCS.length; i++) {
    if (NPCS[i].npcId === id) return NPCS[i];
  }
  return null;
}

export function dailyById(id: string): DailyDef | null {
  for (let i = 0; i < DAILIES.length; i++) {
    if (DAILIES[i].questId === id) return DAILIES[i];
  }
  return null;
}

export function achievementById(id: string): AchievementDef | null {
  for (let i = 0; i < ACHIEVEMENTS.length; i++) {
    if (ACHIEVEMENTS[i].achievementId === id) return ACHIEVEMENTS[i];
  }
  return null;
}

/** Approximate 1st–5th Ave along Broadway. The pack names the strip and gives Broadway's centre only. */
export const BROADWAY_STRIP: readonly [number, number][] = [
  [-86.7746, 36.1607],
  [-86.7762, 36.1605],
  [-86.778, 36.1602],
  [-86.7802, 36.16],
  [-86.7822, 36.1598],
];

export const STRIP_ZOOM_MAX = 15;

/**
 * Approximate ends of the Seigenthaler span.
 * The pack gives the centre [-86.7726, 36.1622] only.
 */
export const SEIGENTHALER_ENDS: readonly [[number, number], [number, number]] = [
  [-86.7772, 36.1615],
  [-86.7684, 36.1632],
];

/**
 * Three Cumberland crossings for ach-bridge-trio.
 * Only Seigenthaler is a pack coordinate. The other two are approximate.
 */
export const CUMBERLAND_BRIDGES: readonly { id: string; coordinates: [number, number] }[] = [
  { id: "seigenthaler-bridge", coordinates: [-86.7726, 36.1622] },
  { id: "woodland-bridge", coordinates: [-86.7638, 36.167] },
  { id: "gateway-bridge", coordinates: [-86.7734, 36.1586] },
];

/** Centennial / The Great Green, used by ach-green-mile. Zone coordinate from the pack. */
export const CENTENNIAL: [number, number] = [-86.8133, 36.1461];

/**
 * Firefly fallbacks when park tiles have not loaded.
 * Centennial and Shelby use pack coordinates. The other four are approximate.
 */
export const PARK_FALLBACKS: readonly { name: string; coordinates: [number, number] }[] = [
  { name: "Centennial", coordinates: [-86.8133, 36.1461] },
  { name: "Shelby entrance", coordinates: [-86.724, 36.169] },
  { name: "Riverfront", coordinates: [-86.7742, 36.1662] },
  { name: "Bicentennial", coordinates: [-86.7874, 36.1734] },
  { name: "Percy Warner entrance", coordinates: [-86.8735, 36.0802] },
  { name: "Public Square", coordinates: [-86.7816, 36.1672] },
];

export function seasonFor(month: number): "spring" | "summer" | "fall" | "winter" {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

export function nightPhase(phase: Phase): boolean {
  return phase === "night" || phase === "dusk";
}

const RAIN_CODES = new Set([61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const STORM_CODES = new Set([95, 96, 99]);

export function isRainCode(code: number): boolean {
  return RAIN_CODES.has(code);
}

export function isStormCode(code: number): boolean {
  return STORM_CODES.has(code);
}

export function cToF(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}
