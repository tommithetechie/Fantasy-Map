import maplibregl, { type Map } from "maplibre-gl";
import { WASD_LIMIT } from "./constants";
import { metersBetween } from "./geo";
import { getResolved } from "./layers";
import { landmarks as zonePins } from "../zones";
import { revealIfFlown } from "./fogOfWar";
import { addTick, wake } from "./perf";
import {
  acceptQuest,
  achievementVisible,
  breakTraverse,
  cosmeticName,
  currentDaily,
  equipCosmetic,
  equipTitle,
  getPlayer,
  listAchievements,
  mainQuests,
  mainStatus,
  markerLandmarkIds,
  onArrived,
  onBridge,
  onBroadwayClick,
  onFlyStarted,
  onLoreRead,
  onMarkVisited,
  onProgress,
  onTraverseEnd,
  onWeatherForDaily,
  onZoom,
  rankName,
  resetProgress,
  titleName,
} from "./progress";
import { emitRuntime, onRuntime, runtime } from "./runtime";
import { showToasts } from "./toast";
import { catchUp } from "./timeOfDay";
import {
  CUMBERLAND_BRIDGES,
  LANDMARKS,
  SEIGENTHALER_ENDS,
  landmarkById,
  npcAt,
  questById,
} from "./world";

const held = new Set<string>();
const screen: [number, number] = [0, 0];
let mapRef: Map | null = null;
let velF = 0;
let velS = 0;
let targetF = 0;
let targetS = 0;
let markerSig = "";
const markers: maplibregl.Marker[] = [];
let pendingLore: string | null = null;
let pendingArrive: string | null = null;
let hoverLandmark = "";
let glowChecked = false;
let hoverBuilding: string | number | undefined;
let lastMove = 0;
let zoneName = "";
let weatherNoted = false;
let zoneSample = 0;

export function initControls(map: Map): void {
  mapRef = map;
  const flyBtn = document.getElementById("flyBtn");
  if (flyBtn instanceof HTMLButtonElement) flyBtn.addEventListener("click", () => setFly(!runtime.flying));
  const effects = document.getElementById("effectsBtn");
  if (effects instanceof HTMLButtonElement) {
    effects.addEventListener("click", () => {
      runtime.effects = !runtime.effects;
      effects.textContent = runtime.effects ? "Effects: ON" : "Effects: OFF";
      effects.classList.toggle("active", runtime.effects);
      emitRuntime();
      wake();
    });
  }
  const questBtn = document.getElementById("questBtn");
  const log = document.getElementById("questlog");
  if (questBtn instanceof HTMLButtonElement && log) {
    questBtn.addEventListener("click", () => {
      const open = log.style.display !== "block";
      log.style.display = open ? "block" : "none";
      questBtn.classList.toggle("active", open);
    });
  }
  const reset = document.getElementById("questReset");
  if (reset instanceof HTMLButtonElement) {
    reset.addEventListener("click", () => {
      resetProgress();
      showToasts(["Progress cleared."]);
    });
  }
  wireLore();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  map.on("mousedown", zeroVelocity);
  map.on("wheel", zeroVelocity);
  map.on("touchstart", zeroVelocity);
  map.on("dragstart", () => {
    pendingLore = null;
    pendingArrive = null;
    breakTraverse();
    closeLore();
    zeroVelocity();
  });
  map.on("mousemove", onMouseMove);
  map.on("moveend", onMoveEnd);
  onProgress(renderChrome);
  onRuntime(() => {
    if (runtime.weatherReady && !weatherNoted) {
      weatherNoted = true;
      onWeatherForDaily();
    }
    renderChrome();
  });
  addTick(tick);
  renderChrome();
  const home = zonePins[0]?.name;
  if (home) showZone(home);
}

function tick(dt: number, now: number): boolean {
  const map = mapRef;
  if (!map || !runtime.flying) return false;
  const dtSec = dt * 0.001;
  const zoom = map.getZoom();
  let speed = 120 * 2 ** (18 - zoom);
  if (speed < 25) speed = 25;
  if (speed > 900) speed = 900;
  if (held.has("shift")) speed *= 3;
  const forward = (held.has("w") ? 1 : 0) - (held.has("s") ? 1 : 0);
  const strafe = (held.has("d") ? 1 : 0) - (held.has("a") ? 1 : 0);
  targetF = forward * speed;
  targetS = strafe * speed;
  const glide = runtime.reducedMotion ? 1 : 1 - Math.exp(-dtSec * 6);
  velF += (targetF - velF) * glide;
  velS += (targetS - velS) * glide;
  let nextZoom = zoom;
  const zoomKey = (held.has("e") ? 1 : 0) - (held.has("q") ? 1 : 0);
  if (zoomKey > 0) nextZoom = Math.min(19, zoom + 1.2 * dtSec);
  else if (zoomKey < 0 && zoom > 12) nextZoom = Math.max(12, zoom + zoomKey * 1.2 * dtSec);
  const moving = Math.abs(velF) > 0.4 || Math.abs(velS) > 0.4 || nextZoom !== zoom;
  if (moving) {
    const center = map.transform.center;
    const mpp = (156543.03392 * Math.cos((center.lat * Math.PI) / 180)) / 2 ** zoom;
    const projected = map.project(center);
    screen[0] = projected.x + (velS * dtSec) / mpp;
    screen[1] = projected.y - (velF * dtSec) / mpp;
    const next = map.unproject(screen);
    let lng = next.lng;
    let lat = next.lat;
    if (lng < WASD_LIMIT.west) lng = WASD_LIMIT.west;
    if (lng > WASD_LIMIT.east) lng = WASD_LIMIT.east;
    if (lat < WASD_LIMIT.south) lat = WASD_LIMIT.south;
    if (lat > WASD_LIMIT.north) lat = WASD_LIMIT.north;
    map.jumpTo({ center: [lng, lat], zoom: nextZoom });
    revealIfFlown(lng, lat, now);
    senseBridges(lng, lat);
    if (now - zoneSample > 500) {
      zoneSample = now;
      updateZone(map);
    }
  }
  return moving || held.has("w") || held.has("a") || held.has("s") || held.has("d") || held.has("q") || held.has("e");
}

function senseBridges(lng: number, lat: number): void {
  for (let i = 0; i < CUMBERLAND_BRIDGES.length; i++) {
    const bridge = CUMBERLAND_BRIDGES[i];
    if (metersBetween(lng, lat, bridge.coordinates[0], bridge.coordinates[1]) < 120) {
      showToasts(onBridge(bridge.id));
    }
  }
  const quest = getPlayer().activeQuestId;
  if (quest !== "q08-bridge-of-second-chances") return;
  for (let i = 0; i < SEIGENTHALER_ENDS.length; i++) {
    const end = SEIGENTHALER_ENDS[i];
    if (metersBetween(lng, lat, end[0], end[1]) < 110) showToasts(onTraverseEnd(i as 0 | 1));
  }
}

function setFly(on: boolean): void {
  const map = mapRef;
  if (!map) return;
  runtime.flying = on;
  if (on) map.keyboard.disable();
  else map.keyboard.enable();
  held.clear();
  velF = 0;
  velS = 0;
  targetF = 0;
  targetS = 0;
  const btn = document.getElementById("flyBtn");
  if (btn instanceof HTMLButtonElement) {
    btn.textContent = on ? "Fly mode: ON" : "Fly mode: OFF";
    btn.classList.toggle("active", on);
  }
  const banner = document.getElementById("flyBanner");
  if (banner) banner.style.display = on ? "block" : "none";
  if (on) wake();
}

function zeroVelocity(): void {
  velF = 0;
  velS = 0;
  targetF = 0;
  targetS = 0;
}

function onKeyDown(event: KeyboardEvent): void {
  if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.code === "KeyF") {
    event.preventDefault();
    setFly(!runtime.flying);
    return;
  }
  if (event.code === "Escape") {
    closeLore();
    return;
  }
  if (!runtime.flying) return;
  const alias = keyAlias(event.code);
  if (!alias) return;
  held.add(alias);
  event.preventDefault();
  wake();
}

function onKeyUp(event: KeyboardEvent): void {
  const alias = keyAlias(event.code);
  if (alias) held.delete(alias);
}

function keyAlias(code: string): string | null {
  switch (code) {
    case "KeyW":
    case "ArrowUp":
      return "w";
    case "KeyA":
    case "ArrowLeft":
      return "a";
    case "KeyS":
    case "ArrowDown":
      return "s";
    case "KeyD":
    case "ArrowRight":
      return "d";
    case "KeyQ":
      return "q";
    case "KeyE":
      return "e";
    case "ShiftLeft":
    case "ShiftRight":
      return "shift";
    default:
      return null;
  }
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
}

function onMouseMove(event: maplibregl.MapMouseEvent): void {
  const now = performance.now();
  if (now - lastMove < 60) return;
  lastMove = now;
  const map = mapRef;
  if (!map) return;
  const hit = landmarkAt(map, event.point.x, event.point.y);
  hoverLandmark = hit?.id ?? "";
  map.getCanvas().style.cursor = hit ? "pointer" : "";
  paintMarkerHover();
  if (!hit) hoverBuildingAt(map, event.point);
}

function landmarkAt(map: Map, x: number, y: number): (typeof LANDMARKS)[number] | null {
  let best: (typeof LANDMARKS)[number] | null = null;
  let bestD = 40 * 40;
  for (let i = 0; i < LANDMARKS.length; i++) {
    const point = map.project(LANDMARKS[i].coordinates);
    const dx = point.x - x;
    const dy = point.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = LANDMARKS[i];
    }
  }
  return best;
}

function hoverBuildingAt(map: Map, point: maplibregl.PointLike): void {
  const layers = getResolved(map);
  if (!layers.buildings || !layers.buildingsSource || (glowChecked && !runtime.buildingGlow)) return;
  const features = map.queryRenderedFeatures(point, { layers: [layers.buildings] });
  if (!glowChecked) {
    glowChecked = true;
    if (!features.length || features[0].id === undefined) {
      runtime.buildingGlow = false;
      return;
    }
    runtime.buildingGlow = true;
    catchUp();
  }
  const id = features[0]?.id;
  if (id === undefined || !layers.buildingsSourceLayer) return;
  if (hoverBuilding !== undefined && hoverBuilding !== id) {
    map.setFeatureState(
      { source: layers.buildingsSource, sourceLayer: layers.buildingsSourceLayer, id: hoverBuilding },
      { hover: false },
    );
  }
  hoverBuilding = id;
  map.setFeatureState(
    { source: layers.buildingsSource, sourceLayer: layers.buildingsSourceLayer, id },
    { hover: true },
  );
}

function onMoveEnd(): void {
  const map = mapRef;
  if (!map) return;
  if (runtime.flying && (Math.abs(velF) > 8 || Math.abs(velS) > 8)) return;
  updateZone(map);
  const arrive = pendingArrive;
  const lore = pendingLore;
  pendingArrive = null;
  pendingLore = null;
  if (arrive) showToasts(onArrived(arrive));
  if (lore) openLore(lore);
  const center = map.getCenter();
  const batman = landmarkById("batman-building");
  const nearBat =
    batman !== null && metersBetween(center.lng, center.lat, batman.coordinates[0], batman.coordinates[1]) < 450;
  showToasts(onZoom(map.getZoom(), nearBat));
}

function flyToLandmark(id: string): void {
  const map = mapRef;
  const landmark = landmarkById(id);
  if (!map || !landmark) return;
  pendingLore = id;
  pendingArrive = id;
  showToasts(onFlyStarted());
  const camera = {
    center: landmark.coordinates,
    zoom: 16.5,
    pitch: 60,
    bearing: -20,
  };
  if (runtime.reducedMotion) map.jumpTo(camera);
  else map.flyTo({ ...camera, duration: 2400, curve: 1.42, essential: true });
}

function openLore(id: string): void {
  const landmark = landmarkById(id);
  const card = document.getElementById("lore");
  if (!landmark || !card) return;
  showToasts(onLoreRead(id));
  const title = document.getElementById("loreTitle");
  const epithet = document.getElementById("loreEpithet");
  const body = document.getElementById("loreBody");
  const fact = document.getElementById("loreFact");
  if (title) title.textContent = landmark.name;
  if (epithet) epithet.textContent = landmark.common;
  if (body) body.textContent = landmark.lore;
  const npc = npcAt(id);
  const extra = [landmark.fact, npc?.greetingLine ?? ""].filter((line) => line.length > 0);
  if (fact) {
    fact.textContent = extra.join(" ");
    fact.style.display = extra.length ? "block" : "none";
  }
  const player = getPlayer();
  const visit = document.getElementById("loreVisit");
  if (visit instanceof HTMLButtonElement) {
    const seen = player.visitedLandmarkIds.includes(id);
    visit.textContent = seen ? "Visited" : "Mark Visited";
    visit.classList.toggle("stamped", seen);
    visit.onclick = () => {
      const center = mapRef?.getCenter();
      const near =
        center !== undefined &&
        metersBetween(center.lng, center.lat, landmark.coordinates[0], landmark.coordinates[1]) < 500;
      if (!near && pendingArrive !== id) {
        flyToLandmark(id);
        return;
      }
      showToasts(onMarkVisited(id));
      openLore(id);
    };
  }
  renderQuestActions(id);
  card.style.display = "block";
  const fly = document.getElementById("loreFly");
  if (fly instanceof HTMLButtonElement) fly.onclick = () => flyToLandmark(id);
}

function renderQuestActions(landmarkId: string): void {
  const slot = document.getElementById("loreQuest");
  if (!slot) return;
  slot.replaceChildren();
  const player = getPlayer();
  for (let i = 0; i < mainQuests().length; i++) {
    const quest = mainQuests()[i];
    const involved =
      quest.landmarkId === landmarkId ||
      (quest.secondLandmarkId === landmarkId && player.q10Step >= 1);
    if (!involved) continue;
    const status = mainStatus(quest);
    if (status === "locked" || status === "complete") continue;
    slot.append(questBlock(quest.questId, quest.title, quest.giverLine, quest.objectiveText, status));
  }
  const daily = currentDaily();
  if (daily && player.daily.status !== "complete" && daily.landmarkIds.includes(landmarkId)) {
    slot.append(questBlock(daily.questId, daily.title, "", daily.objectiveText, player.daily.status));
  }
}

function questBlock(
  questId: string,
  title: string,
  giverLine: string,
  objective: string,
  status: string,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "quest-offer";
  const heading = document.createElement("strong");
  heading.textContent = title;
  const line = document.createElement("p");
  line.textContent = giverLine || objective;
  wrap.append(heading, line);
  if (status === "available") {
    const accept = document.createElement("button");
    accept.type = "button";
    accept.className = "btn";
    accept.textContent = "Accept quest";
    accept.addEventListener("click", () => {
      acceptQuest(questId);
      const landmark = landmarkIdFor(questId) ?? "";
      if (landmark) openLore(landmark);
      else renderChrome();
    });
    wrap.append(accept);
  }
  return wrap;
}

function landmarkIdFor(questId: string): string | null {
  const quest = questById(questId);
  if (quest) return quest.landmarkId;
  const daily = currentDaily();
  if (daily && daily.questId === questId) return daily.landmarkIds[0] ?? null;
  return null;
}

function wireLore(): void {
  const close = document.getElementById("loreClose");
  if (close instanceof HTMLButtonElement) close.addEventListener("click", closeLore);
}

function closeLore(): void {
  const card = document.getElementById("lore");
  if (card) card.style.display = "none";
}

function renderChrome(): void {
  const player = getPlayer();
  const level = document.getElementById("levelChip");
  if (level) {
    const rank = rankName(player.level);
    const title = player.equippedTitleId ? ` · ${titleName(player.equippedTitleId)}` : "";
    level.textContent = `Level ${player.level} · ${rank}${title}`;
  }
  const stamps = document.getElementById("stamps");
  if (stamps) {
    stamps.replaceChildren();
    const filled = Math.min(7, player.dailyCompletions);
    for (let i = 0; i < 7; i++) {
      const stamp = document.createElement("i");
      stamp.className = i < filled ? "on" : "";
      stamps.append(stamp);
    }
  }
  document.body.dataset.cosmetic = player.equippedCosmeticId ?? "";
  document.body.dataset.skin = player.unlockedCosmeticIds.includes("lost-star-map-skin") ? "lost-star" : "";
  if (player.unlockedCosmeticIds.includes("clear-skies-border")) document.body.dataset.border = "clear";
  syncMarkers();
  renderLog();
  const card = document.getElementById("lore");
  if (card && card.style.display === "block") {
    const title = document.getElementById("loreTitle");
    const landmark = LANDMARKS.find((item) => item.name === title?.textContent);
    if (landmark) renderQuestActions(landmark.id);
  }
}

function renderLog(): void {
  const list = document.getElementById("questList");
  const hint = document.getElementById("questHint");
  if (!list || !hint) return;
  const player = getPlayer();
  const active = player.activeQuestId ? questById(player.activeQuestId) : null;
  const daily = currentDaily();
  hint.textContent = active?.objectiveText || daily?.objectiveText || "The Lost Star Tour";
  list.replaceChildren();
  for (let i = 0; i < mainQuests().length; i++) {
    const quest = mainQuests()[i];
    const status = mainStatus(quest);
    const item = document.createElement("li");
    item.className = status;
    const name = document.createElement("strong");
    name.textContent = quest.title;
    const detail = document.createElement("span");
    detail.textContent = `${quest.xpReward} XP · ${status}`;
    item.append(name, detail);
    if (status === "available" || status === "active") {
      item.addEventListener("click", () => flyToLandmark(quest.landmarkId));
    }
    list.append(item);
  }
  if (daily && player.daily.status !== "complete") {
    const item = document.createElement("li");
    item.className = player.daily.status;
    const name = document.createElement("strong");
    name.textContent = daily.title;
    const detail = document.createElement("span");
    detail.textContent = `Today in Nash · ${daily.xpReward + daily.bonusXp} XP`;
    item.append(name, detail);
    const where = daily.landmarkIds[0];
    if (where) item.addEventListener("click", () => flyToLandmark(where));
    list.append(item);
  }
  const ach = listAchievements();
  for (let i = 0; i < ach.length; i++) {
    const row = ach[i];
    if (!achievementVisible(row.achievementId)) continue;
    const unlocked = player.achievementIds.some((item) => item.achievementId === row.achievementId);
    if (!unlocked && row.secret) continue;
    const item = document.createElement("li");
    item.className = unlocked ? "done" : "locked";
    const name = document.createElement("strong");
    name.textContent = row.name;
    const detail = document.createElement("span");
    detail.textContent = unlocked ? row.description : row.conditionText;
    item.append(name, detail);
    list.append(item);
  }
  renderEquip(list, "Titles", player.unlockedTitleIds, player.equippedTitleId, titleName, equipTitle);
  renderEquip(
    list,
    "Cosmetics",
    player.unlockedCosmeticIds,
    player.equippedCosmeticId,
    cosmeticName,
    equipCosmetic,
  );
}

function renderEquip(
  list: HTMLElement,
  label: string,
  ids: readonly string[],
  equipped: string | null,
  nameOf: (id: string) => string,
  equip: (id: string | null) => void,
): void {
  if (ids.length === 0) return;
  const item = document.createElement("li");
  const name = document.createElement("strong");
  name.textContent = label;
  item.append(name);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.textContent = id === equipped ? `${nameOf(id)} · worn` : nameOf(id);
    button.addEventListener("click", () => equip(id === equipped ? null : id));
    item.append(button);
  }
  list.append(item);
}

function syncMarkers(): void {
  const map = mapRef;
  if (!map) return;
  const ids = markerLandmarkIds();
  const sig = `${ids.join("|")}|${getPlayer().equippedCosmeticId ?? ""}|${runtime.reducedMotion ? 1 : 0}`;
  if (sig === markerSig) {
    paintMarkerHover();
    return;
  }
  markerSig = sig;
  for (let i = 0; i < markers.length; i++) markers[i].remove();
  markers.length = 0;
  for (let i = 0; i < ids.length && i < 5; i++) {
    const landmark = landmarkById(ids[i]);
    if (!landmark) continue;
    const el = document.createElement("button");
    el.type = "button";
    el.className = "q-mark";
    el.dataset.landmark = landmark.id;
    el.style.animationDelay = `${i * 0.25}s`;
    el.innerHTML = '<span class="ring"></span><span class="diamond"></span>';
    if (runtime.reducedMotion) el.classList.add("still");
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      if (landmark.id === "broadway") showToasts(onBroadwayClick());
      flyToLandmark(landmark.id);
    });
    el.addEventListener("mousedown", (event) => event.stopPropagation());
    const marker = new maplibregl.Marker({ element: el, anchor: "center" })
      .setLngLat(landmark.coordinates)
      .addTo(map);
    markers.push(marker);
  }
  paintMarkerHover();
}

function paintMarkerHover(): void {
  for (let i = 0; i < markers.length; i++) {
    const el = markers[i].getElement();
    el.classList.toggle("hot", el.dataset.landmark === hoverLandmark);
  }
}

function updateZone(map: Map): void {
  const center = map.getCenter();
  let best = "";
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < zonePins.length; i++) {
    const zone = zonePins[i];
    const distance = metersBetween(center.lng, center.lat, zone.coordinates[0], zone.coordinates[1]);
    if (distance < bestD) {
      bestD = distance;
      best = zone.name;
    }
  }
  if (!best || bestD > 2500) return;
  if (best === zoneName) return;
  if (zoneName) {
    const current = zonePins.find((zone) => zone.name === zoneName);
    if (current) {
      const stay = metersBetween(center.lng, center.lat, current.coordinates[0], current.coordinates[1]);
      if (stay < bestD + 250) return;
    }
  }
  showZone(best);
}

function showZone(name: string): void {
  zoneName = name;
  const banner = document.getElementById("zoneBanner");
  if (!banner) return;
  banner.textContent = name;
  banner.classList.remove("show");
  void banner.offsetWidth;
  banner.classList.add("show");
  const parchment = document.getElementById("parchment");
  parchment?.classList.remove("ink");
  void parchment?.offsetWidth;
  parchment?.classList.add("ink");
}

