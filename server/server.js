const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const { MULTIPLAYER } = require("../shared/multiplayer");
const { WORLD_BOUNDS, CLASS_LOADOUTS } = require("../shared/session-config");
const {
  PROTOCOL_VERSION,
  ROOM_PHASE,
  CLIENT_MESSAGE,
  SERVER_MESSAGE,
  UI_EVENT_KIND,
  WORLD_EVENT_KIND,
  COMBAT_EVENT_KIND,
  createRoomId,
  createReconnectToken,
  createWelcomePayload,
  createSnapshotPayload,
  createEventPayload,
} = require("../shared/protocol");

const ROOT = path.resolve(__dirname, "..");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".svg": "image/svg+xml",
};

const ASSET_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);
const APP_JS_PATH = path.join(ROOT, "app.js");
const APP_JS_BACKUP_PATH = path.join(ROOT, "app.js.level-editor.bak");
const STALE_PLAYER_TIMEOUT_MS = 30000;
const PLAYER_REQUEST_TYPES = new Set(["shoot", "noise", "interact", "medkit", "reload", "takedown", "admin"]);
const PLAYER_ACTION_COOLDOWNS_MS = Object.freeze({
  interact: 180,
  medkit: 350,
  noise: 450,
  takedown: 450,
});
const HEAT_SCORE_THRESHOLDS = Object.freeze({ 1: 0, 2: 2.2, 3: 5.1, 4: 8.6 });
const STEALTH_TUNING = Object.freeze({
  quietSightRangeMultiplier: 0.72,
  quietSightConeMultiplier: 0.82,
  quietCloseRangeMultiplier: 0.68,
  cloakSightRangeMultiplier: 0.4,
  cloakSightConeMultiplier: 0.58,
  cloakCloseRangeMultiplier: 0.48,
  investigateBase: 1.8,
  investigateIntensityScale: 1,
  searchBase: 2.5,
  eliteViewBonus: 18,
  eliteHearingBonus: 24,
});
const AI_TUNING = Object.freeze({
  alertShareRange: 420,
  alertShareBlockedMultiplier: 1.4,
  alertShareSpreadMin: 20,
  alertShareSpreadMax: 140,
  soundInvestigateMin: 16,
  soundInvestigateMax: 132,
  patrolAnchorDriftChance: 0.012,
});
const LEVEL_DURATIONS_SECONDS = Object.freeze({
  freight: 300,
  admin: 270,
  reactor: 240,
});

function collectAssetFiles(rootDir, currentDir = rootDir, results = []) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      collectAssetFiles(rootDir, fullPath, results);
      continue;
    }

    if (!ASSET_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }

    const relative = path.relative(ROOT, fullPath).split(path.sep).join("/");
    results.push(relative);
  }
  return results;
}

function sanitizeRequestPath(requestUrl) {
  const parsed = new URL(requestUrl, "http://localhost");
  const rawPathname = parsed.pathname === "/" ? "/index.html" : parsed.pathname;
  let pathname;
  try {
    pathname = decodeURIComponent(rawPathname);
  } catch {
    return null;
  }
  const resolved = path.resolve(ROOT, `.${pathname}`);
  return resolved.startsWith(ROOT) ? resolved : null;
}

function cacheControlFor(filePath, ext) {
  if (filePath.includes(`${path.sep}assets${path.sep}`)) {
    return "public, max-age=604800";
  }
  if (ext === ".html") {
    return "no-store";
  }
  return "no-cache";
}

function parseRangeHeader(rangeHeader, size) {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=") || !(size > 0)) {
    return null;
  }

  const [rawStart, rawEnd] = rangeHeader.slice(6).split("-");
  let start = rawStart === "" ? NaN : Number(rawStart);
  let end = rawEnd === "" ? NaN : Number(rawEnd);

  if (Number.isNaN(start) && Number.isNaN(end)) {
    return null;
  }

  if (Number.isNaN(start)) {
    const suffixLength = Math.max(0, end);
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else if (Number.isNaN(end)) {
    end = size - 1;
  }

  start = Math.max(0, Math.min(start, size - 1));
  end = Math.max(start, Math.min(end, size - 1));

  return { start, end };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 8 * 1024 * 1024) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

function renderLevelTemplateBlock(levels) {
  const orderedEntries = Object.entries(levels || {});
  if (!orderedEntries.length) {
    throw new Error("No levels were provided.");
  }

  const freightLevel = levels.freight || orderedEntries[0][1];
  if (!freightLevel) {
    throw new Error("Freight level is required for the runtime bootstrap.");
  }

  const stringify = (value) => JSON.stringify(value, null, 2);

  return [
    `const obstacles = ${stringify(freightLevel.obstacles || [])};`,
    ``,
    `const buildings = ${stringify(freightLevel.buildings || [])};`,
    ``,
    `const extractionZone = ${stringify(freightLevel.extractionZone || { x: 0, y: 0, w: 180, h: 120 })};`,
    `const spawnPools = ${stringify(freightLevel.spawnPools || {})};`,
    ``,
    `function cloneBuilding(building) {`,
    `  return {`,
    `    ...building,`,
    `    door: building.door ? { ...building.door } : null,`,
    `    windows: (building.windows || []).map((windowEntry) => ({ ...windowEntry })),`,
    `    squadSpawns: (building.squadSpawns || []).map((spawn) => ({ ...spawn })),`,
    `  };`,
    `}`,
    ``,
    `function cloneSpawnPools(source) {`,
    `  return Object.fromEntries(`,
    `    Object.entries(source || {}).map(([key, entries]) => [key, (entries || []).map((entry) => ({ ...entry }))])`,
    `  );`,
    `}`,
    ``,
    `function cloneMarkerEntries(entries = []) {`,
    `  return entries.map((entry) => ({ ...entry }));`,
    `}`,
    ``,
    `const LEVEL_TEMPLATES = ${stringify(levels)};`,
    ``,
  ].join("\n");
}

function replaceLevelTemplateBlock(source, nextBlock) {
  const start = source.indexOf("const obstacles = [");
  const end = source.indexOf("let activeLayoutId =", start);
  if (start === -1 || end === -1) {
    throw new Error("Could not find the level template block in app.js.");
  }
  return `${source.slice(0, start)}${nextBlock}${source.slice(end)}`;
}

function createRoom() {
  return {
    id: createRoomId(),
    seed: Date.now(),
    players: new Map(),
    world: null,
    combat: null,
    hostId: null,
    phase: ROOM_PHASE.LOBBY,
    snapshotSequence: 0,
    worldVersion: 0,
    combatVersion: 0,
    levelVersion: 0,
    restart: {
      readyIds: new Set(),
      phase: "idle",
    },
    enemyMeleeLocks: new Map(),
    enemyShotLocks: new Map(),
    enemyAlertLocks: new Map(),
    recentSignals: [],
    phaseLock: null,
    lastSimulatedAt: Date.now(),
  };
}

function finiteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function applySeedState(player, seed) {
  if (!seed || typeof seed !== "object") {
    return;
  }

  player.resources.hp = typeof seed.hp === "number" ? seed.hp : player.resources.hp;
  player.resources.maxHp = typeof seed.maxHp === "number" ? seed.maxHp : player.resources.maxHp;
  player.resources.ammo = finiteNumber(Number(seed.ammo), player.resources.ammo);
  player.resources.magSize = finiteNumber(Number(seed.magSize), player.resources.magSize);
  player.resources.reloadTime = finiteNumber(Number(seed.reloadTime), player.resources.reloadTime);
  player.resources.shieldEquipped =
    typeof seed.shieldEquipped === "boolean" ? seed.shieldEquipped : player.resources.shieldEquipped;
  player.resources.shieldHp = typeof seed.shieldHp === "number" ? seed.shieldHp : player.resources.shieldHp;
  player.resources.medkits = typeof seed.medkits === "number" ? seed.medkits : player.resources.medkits;
  player.resources.noiseCharges = typeof seed.noiseCharges === "number" ? seed.noiseCharges : player.resources.noiseCharges;
  player.resources.cash = typeof seed.cash === "number" ? seed.cash : player.resources.cash;
  player.adminFlags.invisible = typeof seed.adminInvisible === "boolean" ? seed.adminInvisible : player.adminFlags.invisible;
  player.adminFlags.godMode = typeof seed.adminGodMode === "boolean" ? seed.adminGodMode : player.adminFlags.godMode;
  player.runtime.invisible = typeof seed.invisible === "boolean" ? seed.invisible : player.runtime.invisible;
  player.runtime.quietMode = typeof seed.quietMode === "boolean" ? seed.quietMode : player.runtime.quietMode;
}

function createPlayerRecord(id, socket) {
  return {
    id,
    sessionId: `${id}-${Date.now().toString(36)}`,
    reconnectToken: createReconnectToken(),
    socket,
    connected: true,
    meta: {
      className: "stealther",
      weaponLabel: "Suppressed Sidearm",
      spriteVariant: null,
      displayName: "Operator",
      title: "District Ghost",
    },
    position: {
      x: 0,
      y: 0,
      radius: 15,
      vx: 0,
      vy: 0,
      angle: 0,
    },
    resources: {
      hp: 100,
      maxHp: 100,
      ammo: 0,
      magSize: 0,
      reloadTime: 1,
      shieldEquipped: false,
      shieldHp: 0,
      medkits: 0,
      noiseCharges: 0,
      cash: 0,
    },
    adminFlags: {
      invisible: false,
      godMode: false,
    },
    runtime: {
      running: false,
      initialized: false,
      invisible: false,
      quietMode: false,
      dead: false,
      updatedAt: Date.now(),
      lastInputAt: 0,
      lastInputSeq: 0,
      processedInputSeq: 0,
      lastInputFrame: null,
      lastSimulatedAt: Date.now(),
      spawnProtectedUntil: 0,
      nextShootAt: 0,
      nextMedkitAt: 0,
      nextNoiseAt: 0,
      nextTakedownAt: 0,
      reloadCompleteAt: 0,
      abilityActiveUntil: 0,
      abilityCooldownUntil: 0,
    },
  };
}

function getPlayerSnapshot(player) {
  const now = Date.now();
  return {
    id: player.id,
    initialized: Boolean(player.runtime.initialized),
    className: player.meta.className,
    weaponLabel: player.meta.weaponLabel,
    spriteVariant: player.meta.spriteVariant ?? null,
    displayName: player.meta.displayName || null,
    title: player.meta.title || null,
    x: player.position.x,
    y: player.position.y,
    radius: player.position.radius,
    vx: player.position.vx,
    vy: player.position.vy,
    angle: player.position.angle,
    hp: player.resources.hp,
    maxHp: player.resources.maxHp,
    ammo: player.resources.ammo,
    magSize: player.resources.magSize,
    reloadTime: player.resources.reloadTime,
    shieldEquipped: player.resources.shieldEquipped,
    shieldHp: player.resources.shieldHp,
    adminInvisible: Boolean(player.adminFlags.invisible),
    adminGodMode: Boolean(player.adminFlags.godMode),
    invisible: player.runtime.invisible,
    quietMode: player.runtime.quietMode,
    medkits: player.resources.medkits,
    noiseCharges: player.resources.noiseCharges,
    cash: player.resources.cash,
    canUseShield: Boolean(getClassLoadout(player.meta.className).canUseShield),
    maxShieldHp: getClassLoadout(player.meta.className).shieldCells || 0,
    reloadRemaining: Math.max(0, (player.runtime.reloadCompleteAt - now) / 1000),
    abilityActiveRemaining: Math.max(0, (player.runtime.abilityActiveUntil - now) / 1000),
    abilityCooldownRemaining: Math.max(0, (player.runtime.abilityCooldownUntil - now) / 1000),
    spawnProtectedRemaining: Math.max(0, (player.runtime.spawnProtectedUntil - now) / 1000),
    running: player.runtime.running,
    lastInputSeq: player.runtime.lastInputSeq || 0,
    updatedAt: player.runtime.updatedAt,
  };
}

function getConnectedPlayers(room) {
  return Array.from(room.players.values()).filter((player) => player.connected);
}

function applyHelloState(player, message) {
  player.meta.className = message.className || player.meta.className;
  player.meta.weaponLabel = message.weaponLabel || player.meta.weaponLabel;
  player.meta.displayName = typeof message.displayName === "string" ? message.displayName : player.meta.displayName;
  player.meta.title = typeof message.title === "string" ? message.title : player.meta.title;
  player.runtime.updatedAt = Date.now();
}

function applyPlayerPatch(target, patch) {
  if (typeof patch.hp === "number") {
    target.resources.hp = patch.hp;
  }
  if (typeof patch.maxHp === "number") {
    target.resources.maxHp = patch.maxHp;
  }
  if (typeof patch.shieldEquipped === "boolean") {
    target.resources.shieldEquipped = patch.shieldEquipped;
  }
  if (typeof patch.shieldHp === "number") {
    target.resources.shieldHp = patch.shieldHp;
  }
  if (typeof patch.adminInvisible === "boolean") {
    target.adminFlags.invisible = patch.adminInvisible;
  }
  if (typeof patch.adminGodMode === "boolean") {
    target.adminFlags.godMode = patch.adminGodMode;
  }
  if (typeof patch.invisible === "boolean") {
    target.runtime.invisible = patch.invisible;
  }
  if (typeof patch.medkits === "number") {
    target.resources.medkits = patch.medkits;
  }
  if (typeof patch.noiseCharges === "number") {
    target.resources.noiseCharges = patch.noiseCharges;
  }
  if (typeof patch.cash === "number") {
    target.resources.cash = patch.cash;
  }
  if (typeof patch.ammo === "number") {
    target.resources.ammo = patch.ammo;
  }
  if (typeof patch.magSize === "number") {
    target.resources.magSize = patch.magSize;
  }
  if (typeof patch.running === "boolean") {
    target.runtime.running = patch.running;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getClassLoadout(className) {
  const key = String(className || "").toLowerCase();
  return CLASS_LOADOUTS[key] || CLASS_LOADOUTS.stealther;
}

function normalizeCollisionEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const x = Number(entry.x);
  const y = Number(entry.y);
  const w = Number(entry.w);
  const h = Number(entry.h);
  if (![x, y, w, h].every(Number.isFinite)) {
    return null;
  }

  return {
    id: typeof entry.id === "string" ? entry.id : null,
    kind: typeof entry.kind === "string" ? entry.kind : "wall",
    x,
    y,
    w,
    h,
  };
}

function circleIntersectsRect(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy < circle.r * circle.r;
}

function getWorldCollision(room) {
  return Array.isArray(room.world?.collision) ? room.world.collision.map(normalizeCollisionEntry).filter(Boolean) : [];
}

function getEntityRadius(entity) {
  if (!entity || typeof entity !== "object") {
    return 15;
  }
  return finiteNumber(Number(entity.position?.radius ?? entity.radius), 15);
}

function getEntityX(entity) {
  if (!entity || typeof entity !== "object") {
    return 0;
  }
  return finiteNumber(Number(entity.position?.x ?? entity.x), 0);
}

function getEntityY(entity) {
  if (!entity || typeof entity !== "object") {
    return 0;
  }
  return finiteNumber(Number(entity.position?.y ?? entity.y), 0);
}

function setEntityPosition(entity, x, y) {
  if (!entity || typeof entity !== "object") {
    return;
  }
  if (entity.position && typeof entity.position === "object") {
    entity.position.x = x;
    entity.position.y = y;
    return;
  }
  entity.x = x;
  entity.y = y;
}

function positionBlocked(room, entity, x, y) {
  const bounds = room.world?.bounds || WORLD_BOUNDS;
  const radius = getEntityRadius(entity);
  const probe = { x, y, r: radius };
  if (
    x - radius < 0 ||
    y - radius < 0 ||
    x + radius > bounds.width ||
    y + radius > bounds.height
  ) {
    return true;
  }

  return getWorldCollision(room).some((obstacle) => circleIntersectsRect(probe, obstacle));
}

function tryMove(room, entity, dx, dy) {
  const startX = getEntityX(entity);
  const startY = getEntityY(entity);
  let nextX = startX;
  let nextY = startY;

  if (!positionBlocked(room, entity, startX + dx, startY)) {
    nextX = startX + dx;
  }

  if (!positionBlocked(room, entity, nextX, startY + dy)) {
    nextY = startY + dy;
  }

  setEntityPosition(entity, nextX, nextY);
}

function upsertWorldCollision(world, entry, active) {
  if (!world || !entry || typeof entry.id !== "string") {
    return;
  }

  const collision = Array.isArray(world.collision) ? world.collision.map(normalizeCollisionEntry).filter(Boolean) : [];
  const filtered = collision.filter((item) => item.id !== entry.id);
  if (active) {
    const normalized = normalizeCollisionEntry(entry);
    if (normalized) {
      filtered.push(normalized);
    }
  }
  world.collision = filtered;
}

function normalizeWorldState(world) {
  if (!world || typeof world !== "object") {
    return null;
  }

  return {
    ...world,
    bounds: {
      width: finiteNumber(Number(world.bounds?.width), WORLD_BOUNDS.width),
      height: finiteNumber(Number(world.bounds?.height), WORLD_BOUNDS.height),
    },
    collision: Array.isArray(world.collision) ? world.collision.map(normalizeCollisionEntry).filter(Boolean) : [],
  };
}

function distanceBetween(a, b) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0));
}

function rectContains(rect, x, y) {
  return Boolean(rect) && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function getNearbyDoor(world, position, radius = 64) {
  if (!Array.isArray(world?.doors)) {
    return null;
  }

  for (const door of world.doors) {
    const center = {
      x: door.x + door.w * 0.5,
      y: door.y + door.h * 0.5,
    };
    if (distanceBetween(position, center) <= radius) {
      return door;
    }
  }

  return null;
}

function getCollectedCoreCount(world) {
  if (!Array.isArray(world?.loot)) {
    return 0;
  }
  return world.loot.filter((loot) => loot.type === "core" && loot.collected).length;
}

function hasLiveBoss(room) {
  return Array.isArray(room.combat?.enemies) && room.combat.enemies.some((enemy) => enemy.kind === "boss" && !enemy.dead);
}

function getConnectedRaidPlayers(room) {
  return getConnectedPlayers(room).filter((player) => player.runtime.running && player.runtime.initialized);
}

function restorePlayerShield(player) {
  const loadout = getClassLoadout(player.meta.className);
  if (!loadout.canUseShield || !(loadout.shieldCells > 0)) {
    return false;
  }
  player.resources.shieldEquipped = true;
  player.resources.shieldHp = loadout.shieldCells;
  return true;
}

function applyServerAdminAction(player, actionKey) {
  if (!player) {
    return false;
  }

  switch (actionKey) {
    case "toggleInvisible":
      player.adminFlags.invisible = !player.adminFlags.invisible;
      player.runtime.invisible = Boolean(player.adminFlags.invisible || Date.now() < (player.runtime.abilityActiveUntil || 0));
      return true;
    case "toggleGodMode":
      player.adminFlags.godMode = !player.adminFlags.godMode;
      if (player.adminFlags.godMode) {
        player.resources.hp = player.resources.maxHp;
        restorePlayerShield(player);
      }
      return true;
    case "heal":
      player.resources.hp = player.resources.maxHp;
      return true;
    case "refillAmmo":
      player.resources.ammo = player.resources.magSize;
      player.runtime.reloadCompleteAt = 0;
      return true;
    case "restoreShield":
      return restorePlayerShield(player);
    default:
      return false;
  }
}

function normalizeAngle(angle) {
  let value = angle;
  while (value > Math.PI) {
    value -= Math.PI * 2;
  }
  while (value < -Math.PI) {
    value += Math.PI * 2;
  }
  return value;
}

function angleDifference(a, b) {
  return Math.abs(normalizeAngle(a - b));
}

function orientation(ax, ay, bx, by, cx, cy) {
  const value = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  if (Math.abs(value) < 0.0001) {
    return 0;
  }
  return value > 0 ? 1 : 2;
}

function onSegment(ax, ay, bx, by, px, py) {
  return px <= Math.max(ax, bx) && px >= Math.min(ax, bx) && py <= Math.max(ay, by) && py >= Math.min(ay, by);
}

function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const o1 = orientation(ax, ay, bx, by, cx, cy);
  const o2 = orientation(ax, ay, bx, by, dx, dy);
  const o3 = orientation(cx, cy, dx, dy, ax, ay);
  const o4 = orientation(cx, cy, dx, dy, bx, by);

  if (o1 !== o2 && o3 !== o4) {
    return true;
  }
  if (o1 === 0 && onSegment(ax, ay, bx, by, cx, cy)) {
    return true;
  }
  if (o2 === 0 && onSegment(ax, ay, bx, by, dx, dy)) {
    return true;
  }
  if (o3 === 0 && onSegment(cx, cy, dx, dy, ax, ay)) {
    return true;
  }
  if (o4 === 0 && onSegment(cx, cy, dx, dy, bx, by)) {
    return true;
  }

  return false;
}

function segmentIntersectsRect(fromX, fromY, toX, toY, rect) {
  if (rectContains(rect, fromX, fromY) || rectContains(rect, toX, toY)) {
    return true;
  }

  const left = rect.x;
  const right = rect.x + rect.w;
  const top = rect.y;
  const bottom = rect.y + rect.h;

  return (
    segmentsIntersect(fromX, fromY, toX, toY, left, top, right, top) ||
    segmentsIntersect(fromX, fromY, toX, toY, right, top, right, bottom) ||
    segmentsIntersect(fromX, fromY, toX, toY, right, bottom, left, bottom) ||
    segmentsIntersect(fromX, fromY, toX, toY, left, bottom, left, top)
  );
}

function lineBlockedWorld(world, fromX, fromY, toX, toY) {
  return getWorldCollisionEntries(world).some((obstacle) => segmentIntersectsRect(fromX, fromY, toX, toY, obstacle));
}

function angleToPoint(fromX, fromY, toX, toY) {
  return Math.atan2(toY - fromY, toX - fromX);
}

function turnToward(currentAngle, targetAngle, maxStep) {
  const delta = normalizeAngle(targetAngle - currentAngle);
  return normalizeAngle(currentAngle + clamp(delta, -maxStep, maxStep));
}

function isSpecimenEnemy(enemy) {
  return enemy?.kind === "specimen";
}

function isHumanEnemy(enemy) {
  return Boolean(enemy && !isSpecimenEnemy(enemy));
}

function getEnemyFaction(enemy) {
  return isSpecimenEnemy(enemy) ? "specimen" : "security";
}

function createEnemyFallback(kind = "rusher") {
  if (kind === "guard") {
    return {
      radius: 17,
      maxHp: 74,
      speed: 102,
      damage: 19,
      cellDamage: 1,
      fireRate: 0.95,
      viewRange: 390,
      viewCone: Math.PI * 0.82,
      hearingRange: 380,
      meleeRange: 0,
      patrolRadius: 92,
      shieldEquipped: true,
      maxShieldHp: 34,
      tactic: "anchor",
      squadRole: "shieldLead",
    };
  }
  if (kind === "boss") {
    return {
      radius: 24,
      maxHp: 260,
      speed: 88,
      damage: 24,
      cellDamage: 2,
      fireRate: 0.55,
      viewRange: 470,
      viewCone: Math.PI,
      hearingRange: 440,
      meleeRange: 0,
      patrolRadius: 78,
      maxShieldHp: 34,
      tactic: "anchor",
      squadRole: "anchor",
    };
  }
  if (kind === "specimen") {
    return {
      radius: 17,
      maxHp: 68,
      speed: 162,
      damage: 18,
      cellDamage: 1,
      fireRate: 0.78,
      viewRange: 260,
      viewCone: Math.PI * 0.94,
      hearingRange: 460,
      meleeRange: 34,
      patrolRadius: 96,
      faction: "specimen",
      tactic: "assault",
      squadRole: "breacher",
    };
  }
  return {
    radius: 15,
    maxHp: 52,
    speed: 136,
    damage: 14,
    cellDamage: 1,
    fireRate: 0.7,
    viewRange: 330,
    viewCone: Math.PI * 0.66,
    hearingRange: 320,
    meleeRange: 0,
    patrolRadius: 128,
    maxShieldHp: 22,
    tactic: "assault",
    squadRole: "breacher",
  };
}

function ensureEnemyDefaults(enemy) {
  if (!enemy || typeof enemy !== "object") {
    return;
  }
  const fallback = createEnemyFallback(enemy.kind);
  enemy.radius = finiteNumber(Number(enemy.radius), fallback.radius);
  enemy.maxHp = finiteNumber(Number(enemy.maxHp), fallback.maxHp);
  enemy.hp = finiteNumber(Number(enemy.hp), enemy.maxHp);
  enemy.speed = finiteNumber(Number(enemy.speed), fallback.speed);
  enemy.damage = finiteNumber(Number(enemy.damage), fallback.damage);
  enemy.cellDamage = finiteNumber(Number(enemy.cellDamage), fallback.cellDamage);
  enemy.fireRate = Math.max(0.24, finiteNumber(Number(enemy.fireRate), fallback.fireRate));
  enemy.viewRange = finiteNumber(Number(enemy.viewRange), fallback.viewRange);
  enemy.viewCone = finiteNumber(Number(enemy.viewCone), fallback.viewCone);
  enemy.hearingRange = finiteNumber(Number(enemy.hearingRange), fallback.hearingRange);
  enemy.meleeRange = finiteNumber(Number(enemy.meleeRange), fallback.meleeRange);
  enemy.patrolRadius = finiteNumber(Number(enemy.patrolRadius), fallback.patrolRadius);
  enemy.state = typeof enemy.state === "string" ? enemy.state : "patrol";
  enemy.aimAngle = finiteNumber(Number(enemy.aimAngle), Math.random() * Math.PI * 2);
  enemy.wanderAngle = finiteNumber(Number(enemy.wanderAngle), enemy.aimAngle);
  enemy.moveAngle = finiteNumber(Number(enemy.moveAngle), enemy.aimAngle);
  enemy.searchTimer = finiteNumber(Number(enemy.searchTimer), 0);
  enemy.pursuitTimer = finiteNumber(Number(enemy.pursuitTimer), 0);
  enemy.seenTimer = finiteNumber(Number(enemy.seenTimer), 0);
  enemy.coverTimer = finiteNumber(Number(enemy.coverTimer), 0);
  enemy.flinchTimer = finiteNumber(Number(enemy.flinchTimer), 0);
  enemy.braceTimer = finiteNumber(Number(enemy.braceTimer), 0);
  enemy.hitFlash = finiteNumber(Number(enemy.hitFlash), 0);
  enemy.shieldFlash = finiteNumber(Number(enemy.shieldFlash), 0);
  enemy.muzzleFlash = finiteNumber(Number(enemy.muzzleFlash), 0);
  enemy.deadTimer = finiteNumber(Number(enemy.deadTimer), 2.8);
  enemy.cooldown = finiteNumber(Number(enemy.cooldown), Math.random() * enemy.fireRate);
  enemy.targetCommitTimer = finiteNumber(Number(enemy.targetCommitTimer), 0);
  enemy.patrolPause = finiteNumber(Number(enemy.patrolPause), Math.random() * 1.2);
  enemy.patrolPauseCooldown = finiteNumber(Number(enemy.patrolPauseCooldown), 1.4 + Math.random() * 1.8);
  enemy.evadeTimer = finiteNumber(Number(enemy.evadeTimer), 0);
  enemy.dodgeCooldown = finiteNumber(Number(enemy.dodgeCooldown), 0);
  enemy.evadeSide = finiteNumber(Number(enemy.evadeSide), Math.random() > 0.5 ? 1 : -1);
  enemy.strafeBias = finiteNumber(Number(enemy.strafeBias), Math.random() > 0.5 ? 1 : -1);
  enemy.patrolAnchorX = finiteNumber(Number(enemy.patrolAnchorX), enemy.x);
  enemy.patrolAnchorY = finiteNumber(Number(enemy.patrolAnchorY), enemy.y);
  enemy.investigateX = finiteNumber(Number(enemy.investigateX), enemy.x);
  enemy.investigateY = finiteNumber(Number(enemy.investigateY), enemy.y);
  enemy.lastSeenX = finiteNumber(Number(enemy.lastSeenX), enemy.x);
  enemy.lastSeenY = finiteNumber(Number(enemy.lastSeenY), enemy.y);
  enemy.coverX = finiteNumber(Number(enemy.coverX), enemy.x);
  enemy.coverY = finiteNumber(Number(enemy.coverY), enemy.y);
  enemy.maxShieldHp = finiteNumber(Number(enemy.maxShieldHp), fallback.maxShieldHp || 0);
  enemy.shieldEquipped = typeof enemy.shieldEquipped === "boolean" ? enemy.shieldEquipped : Boolean(fallback.shieldEquipped);
  enemy.shieldHp = finiteNumber(Number(enemy.shieldHp), enemy.shieldEquipped ? enemy.maxShieldHp : 0);
  enemy.shieldSide = finiteNumber(Number(enemy.shieldSide), 1);
  enemy.faction = typeof enemy.faction === "string" ? enemy.faction : fallback.faction || getEnemyFaction(enemy);
  enemy.tactic = typeof enemy.tactic === "string" ? enemy.tactic : fallback.tactic;
  enemy.squadRole = typeof enemy.squadRole === "string" ? enemy.squadRole : fallback.squadRole;
  enemy.squadId = typeof enemy.squadId === "string" ? enemy.squadId : "roam";
  enemy.searchNodes = Array.isArray(enemy.searchNodes) && enemy.searchNodes.length ? enemy.searchNodes : [{ x: enemy.x, y: enemy.y }];
  enemy.searchNodeIndex = clamp(Math.floor(finiteNumber(Number(enemy.searchNodeIndex), 0)), 0, Math.max(enemy.searchNodes.length - 1, 0));
  enemy.hidden = Boolean(enemy.hidden);
  enemy.contained = Boolean(enemy.contained);
  enemy.justAlerted = Boolean(enemy.justAlerted);
  enemy.bossPhase = finiteNumber(Number(enemy.bossPhase), enemy.kind === "boss" ? 1 : 0);
}

function getLiveRaidTargetsForRoom(room) {
  const now = Date.now();
  return getConnectedPlayers(room)
    .filter((player) => player.runtime.running && player.runtime.initialized && !player.runtime.dead && (player.resources.hp || 0) > 0)
    .map((player) => ({
      id: player.id,
      x: player.position.x,
      y: player.position.y,
      vx: player.position.vx || 0,
      vy: player.position.vy || 0,
      angle: player.position.angle || 0,
      radius: player.position.radius || 15,
      shieldEquipped: Boolean(player.resources.shieldEquipped),
      shieldHp: player.resources.shieldHp || 0,
      hp: player.resources.hp || 0,
      maxHp: player.resources.maxHp || 0,
      invisible: Boolean(player.runtime.invisible),
      spawnProtected: Number.isFinite(player.runtime.spawnProtectedUntil) && player.runtime.spawnProtectedUntil > now,
      quietMode: Boolean(player.runtime.quietMode),
      faction: "raid",
      player,
    }));
}

function getHostileEnemyTargetsForEnemy(room, enemy) {
  if (!Array.isArray(room.combat?.enemies)) {
    return [];
  }
  const faction = getEnemyFaction(enemy);
  return room.combat.enemies
    .filter((entry) => entry && entry !== enemy && !entry.dead && !entry.hidden && getEnemyFaction(entry) !== faction)
    .map((entry) => ({
      id: entry.id,
      x: entry.x,
      y: entry.y,
      vx: entry.vx || 0,
      vy: entry.vy || 0,
      angle: entry.aimAngle || 0,
      radius: entry.radius || 15,
      shieldEquipped: Boolean(entry.shieldEquipped),
      shieldHp: entry.shieldHp || 0,
      hp: entry.hp || 0,
      maxHp: entry.maxHp || 0,
      invisible: false,
      spawnProtected: false,
      quietMode: false,
      faction: getEnemyFaction(entry),
      enemy: entry,
      kind: entry.kind,
    }));
}

function canEnemySeeTarget(room, enemy, target, closeRange = 76) {
  if (!enemy || !target) {
    return false;
  }
  const targetDistance = distanceBetween(enemy, target);
  let effectiveRange = finiteNumber(Number(enemy.viewRange), 0);
  let effectiveCone = finiteNumber(Number(enemy.viewCone), Math.PI);
  let effectiveCloseRange = closeRange;

  if (target.quietMode) {
    effectiveRange *= STEALTH_TUNING.quietSightRangeMultiplier;
    effectiveCone *= STEALTH_TUNING.quietSightConeMultiplier;
    effectiveCloseRange *= STEALTH_TUNING.quietCloseRangeMultiplier;
  }

  if (target.invisible) {
    effectiveRange *= STEALTH_TUNING.cloakSightRangeMultiplier;
    effectiveCone *= STEALTH_TUNING.cloakSightConeMultiplier;
    effectiveCloseRange *= STEALTH_TUNING.cloakCloseRangeMultiplier;
  }

  if (targetDistance > effectiveRange) {
    return false;
  }

  if (lineBlockedWorld(room.world, enemy.x, enemy.y, target.x, target.y)) {
    return false;
  }

  if (targetDistance <= effectiveCloseRange) {
    return true;
  }

  return angleDifference(angleToPoint(enemy.x, enemy.y, target.x, target.y), finiteNumber(Number(enemy.aimAngle), 0)) <= effectiveCone * 0.5;
}

function scoreTargetForEnemy(enemy, target) {
  const targetDistance = distanceBetween(enemy, target);
  let score = 220 - targetDistance * 0.68;

  if (getEnemyFaction(enemy) === "security") {
    score += target.faction === "raid" ? 180 : 0;
    score += target.kind === "specimen" ? (targetDistance < 110 ? 80 : -55) : 0;
  } else {
    score += target.faction === "raid" ? 110 : 65;
    score -= target.kind === "boss" ? 16 : 0;
  }

  if (target.id === enemy.targetId) {
    score += 120 + finiteNumber(Number(enemy.targetCommitTimer), 0) * 40;
  }

  return score;
}

function selectEnemyTarget(room, enemy) {
  const targets = [...getLiveRaidTargetsForRoom(room), ...getHostileEnemyTargetsForEnemy(room, enemy)];
  let chosen = null;

  for (const target of targets) {
    if (!target || target.invisible || target.spawnProtected) {
      continue;
    }
    if (!canEnemySeeTarget(room, enemy, target, 26)) {
      continue;
    }
    const targetDistance = distanceBetween(enemy, target);
    const priority = scoreTargetForEnemy(enemy, target);
    if (!chosen || priority > chosen.priority || (priority === chosen.priority && targetDistance < chosen.distance)) {
      chosen = { target, distance: targetDistance, priority };
    }
  }

  return chosen;
}

function getRememberedEnemyTarget(room, targetId) {
  if (!targetId) {
    return null;
  }
  const player = room.players.get(targetId);
  if (player?.runtime.running && player.runtime.initialized && !player.runtime.dead && (player.resources.hp || 0) > 0) {
    return {
      id: player.id,
      x: player.position.x,
      y: player.position.y,
      vx: player.position.vx || 0,
      vy: player.position.vy || 0,
      angle: player.position.angle || 0,
      radius: player.position.radius || 15,
      shieldEquipped: Boolean(player.resources.shieldEquipped),
      shieldHp: player.resources.shieldHp || 0,
      hp: player.resources.hp || 0,
      maxHp: player.resources.maxHp || 0,
      invisible: Boolean(player.runtime.invisible),
      spawnProtected: false,
      quietMode: Boolean(player.runtime.quietMode),
      faction: "raid",
      player,
    };
  }

  const enemy = Array.isArray(room.combat?.enemies) ? room.combat.enemies.find((entry) => entry.id === targetId && !entry.dead && !entry.hidden) : null;
  if (!enemy) {
    return null;
  }
  return {
    id: enemy.id,
    x: enemy.x,
    y: enemy.y,
    vx: enemy.vx || 0,
    vy: enemy.vy || 0,
    angle: enemy.aimAngle || 0,
    radius: enemy.radius || 15,
    shieldEquipped: Boolean(enemy.shieldEquipped),
    shieldHp: enemy.shieldHp || 0,
    hp: enemy.hp || 0,
    maxHp: enemy.maxHp || 0,
    invisible: false,
    spawnProtected: false,
    quietMode: false,
    faction: getEnemyFaction(enemy),
    enemy,
    kind: enemy.kind,
  };
}

function getSquadmates(room, enemy) {
  if (!Array.isArray(room.combat?.enemies)) {
    return [];
  }
  return room.combat.enemies.filter((ally) => ally && !ally.dead && ally.squadId === enemy.squadId);
}

function getShieldLead(room, enemy) {
  return getSquadmates(room, enemy).find((ally) => ally.squadRole === "shieldLead" && ally.shieldEquipped && (ally.shieldHp || 0) > 0) || null;
}

function moveEntityToward(room, entity, targetX, targetY, speed, dt) {
  const baseAngle = angleToPoint(getEntityX(entity), getEntityY(entity), targetX, targetY);
  const attempts = [0, 0.45, -0.45, 0.9, -0.9, Math.PI];
  let moved = false;

  for (const offset of attempts) {
    const angle = baseAngle + offset;
    const nextX = getEntityX(entity) + Math.cos(angle) * speed * dt;
    const nextY = getEntityY(entity) + Math.sin(angle) * speed * dt;
    if (!positionBlocked(room, entity, nextX, nextY)) {
      setEntityPosition(entity, nextX, nextY);
      entity.moveAngle = angle;
      moved = true;
      break;
    }
  }

  if (!moved) {
    tryMove(room, entity, Math.cos(baseAngle) * speed * dt, Math.sin(baseAngle) * speed * dt);
    entity.moveAngle = baseAngle;
  }
}

function getCoverPointForObstacle(room, obstacle, player, sideBias = 0, enemyRadius = 15) {
  const centerX = obstacle.x + obstacle.w * 0.5;
  const centerY = obstacle.y + obstacle.h * 0.5;
  const angleFromPlayer = angleToPoint(player.x, player.y, centerX, centerY);
  const lateralAngle = angleFromPlayer + sideBias * Math.PI * 0.5;
  const padding = 26 + enemyRadius * 0.8;
  const candidates = [
    {
      x: centerX + Math.cos(angleFromPlayer) * (obstacle.w * 0.4 + padding),
      y: centerY + Math.sin(angleFromPlayer) * (obstacle.h * 0.4 + padding),
    },
    {
      x: centerX + Math.cos(lateralAngle) * (obstacle.w * 0.45 + padding),
      y: centerY + Math.sin(lateralAngle) * (obstacle.h * 0.45 + padding),
    },
    {
      x: centerX + Math.cos(lateralAngle + Math.PI) * (obstacle.w * 0.45 + padding),
      y: centerY + Math.sin(lateralAngle + Math.PI) * (obstacle.h * 0.45 + padding),
    },
  ];
  return candidates.find((candidate) => !positionBlocked(room, { radius: enemyRadius }, candidate.x, candidate.y)) || candidates[0];
}

function findCoverPosition(room, enemy, player) {
  const sideBias = enemy.tactic === "flankLeft" ? -1 : enemy.tactic === "flankRight" ? 1 : enemy.strafeBias || 1;
  let best = null;

  for (const obstacle of getWorldCollisionEntries(room.world)) {
    if (!obstacle || obstacle.kind === "window") {
      continue;
    }
    const obstacleCenter = { x: obstacle.x + obstacle.w * 0.5, y: obstacle.y + obstacle.h * 0.5 };
    if (distanceBetween(enemy, obstacleCenter) >= 380) {
      continue;
    }
    const coverPoint = getCoverPointForObstacle(room, obstacle, player, sideBias, enemy.radius || 15);
    const enemyDistance = distanceBetween(enemy, coverPoint);
    const playerDistance = distanceBetween(player, obstacleCenter);
    const coverBlocksPlayer = lineBlockedWorld(room.world, coverPoint.x, coverPoint.y, player.x, player.y);
    let score = enemyDistance + playerDistance * 0.16;
    if (coverBlocksPlayer) {
      score -= 180;
    } else {
      score += 220;
    }
    if (playerDistance < 72) {
      score += 130;
    }
    score += Math.min(42, (obstacle.w * obstacle.h) / 1200);
    if (!best || score < best.score) {
      best = { x: coverPoint.x, y: coverPoint.y, score };
    }
  }

  return best ? { x: best.x, y: best.y } : null;
}

function getFlankTarget(room, enemy, player) {
  const flankDistance = enemy.kind === "guard" ? 210 : 150;
  const side = enemy.tactic === "flankLeft" ? -1 : 1;
  const aroundAngle = angleToPoint(player.x, player.y, enemy.x, enemy.y) + side * Math.PI * 0.75;
  const bounds = room.world?.bounds || WORLD_BOUNDS;
  return {
    x: clamp(player.x + Math.cos(aroundAngle) * flankDistance, 36, bounds.width - 36),
    y: clamp(player.y + Math.sin(aroundAngle) * flankDistance, 36, bounds.height - 36),
  };
}

function getApproximateAlertPoint(room, sourceEnemy, ally, targetX, targetY) {
  const blocked = lineBlockedWorld(room.world, sourceEnemy.x, sourceEnemy.y, ally.x, ally.y);
  const relayDistance = distanceBetween(sourceEnemy, ally);
  const spread =
    clamp(
      AI_TUNING.alertShareSpreadMin + relayDistance * 0.16 + (blocked ? 32 : 0),
      AI_TUNING.alertShareSpreadMin,
      AI_TUNING.alertShareSpreadMax
    ) * (blocked ? AI_TUNING.alertShareBlockedMultiplier : 1);
  const bounds = room.world?.bounds || WORLD_BOUNDS;
  return {
    x: clamp(targetX + (Math.random() - 0.5) * spread * 2, 28, bounds.width - 28),
    y: clamp(targetY + (Math.random() - 0.5) * spread * 2, 28, bounds.height - 28),
  };
}

function buildSearchNodes(room, enemy, originX, originY) {
  const radius = enemy.kind === "guard" ? 86 : enemy.kind === "boss" ? 96 : enemy.kind === "specimen" ? 78 : 102;
  const bounds = room.world?.bounds || WORLD_BOUNDS;
  const baseAngle = angleToPoint(enemy.x, enemy.y, originX, originY);
  const offsets = [0, Math.PI * 0.55, -Math.PI * 0.55, Math.PI];
  const nodes = [{ x: originX, y: originY }];

  for (const offset of offsets) {
    const candidate = {
      x: clamp(originX + Math.cos(baseAngle + offset) * radius, 32, bounds.width - 32),
      y: clamp(originY + Math.sin(baseAngle + offset) * radius, 32, bounds.height - 32),
    };
    if (positionBlocked(room, enemy, candidate.x, candidate.y)) {
      continue;
    }
    if (nodes.some((node) => distanceBetween(node, candidate) < 28)) {
      continue;
    }
    nodes.push(candidate);
  }

  return nodes;
}

function beginEnemySearch(room, enemy, originX, originY, duration = STEALTH_TUNING.searchBase) {
  enemy.state = "search";
  enemy.lastSeenX = originX;
  enemy.lastSeenY = originY;
  enemy.targetCommitTimer = 0;
  enemy.searchTimer = duration;
  enemy.searchNodes = buildSearchNodes(room, enemy, originX, originY);
  enemy.searchNodeIndex = 0;
}

function getInvestigatePointForSignal(room, enemy, signal) {
  const heardDistance = distanceBetween(enemy, signal);
  const spreadBase = clamp(
    AI_TUNING.soundInvestigateMin + heardDistance * 0.18 + finiteNumber(Number(signal.intensity), 0) * 20,
    AI_TUNING.soundInvestigateMin,
    AI_TUNING.soundInvestigateMax
  );
  const precisionBias = enemy.kind === "guard" ? 0.82 : enemy.kind === "boss" ? 0.76 : enemy.kind === "specimen" ? 0.58 : 1;
  const spread = spreadBase * precisionBias;
  const bounds = room.world?.bounds || WORLD_BOUNDS;
  return {
    x: clamp(signal.x + (Math.random() - 0.5) * spread * 2, 28, bounds.width - 28),
    y: clamp(signal.y + (Math.random() - 0.5) * spread * 2, 28, bounds.height - 28),
  };
}

function tryOpenEnemyDoor(room, enemy) {
  const nearbyDoor = getNearbyDoor(room.world, { x: enemy.x, y: enemy.y }, 42);
  if (!nearbyDoor || nearbyDoor.open) {
    return false;
  }
  nearbyDoor.open = true;
  upsertWorldCollision(room.world, nearbyDoor, false);
  return true;
}

function getPlayerBulletVisuals(className) {
  if (className === "breacher") {
    return {
      outerColor: "rgba(255, 199, 118, 0.34)",
      coreColor: "rgba(255, 238, 188, 0.96)",
      headColor: "#fff0c7",
      trail: "#a46a2c",
      trailWidth: 7,
      innerTrailWidth: 3.2,
    };
  }
  if (className === "marksman") {
    return {
      outerColor: "rgba(157, 211, 255, 0.34)",
      coreColor: "rgba(228, 245, 255, 0.96)",
      headColor: "#eef8ff",
      trail: "#4d7698",
      trailWidth: 6.2,
      innerTrailWidth: 2.4,
    };
  }
  return {
    outerColor: "rgba(164, 241, 213, 0.28)",
    coreColor: "rgba(226, 255, 246, 0.94)",
    headColor: "#f1fff9",
    trail: "#2f7d68",
    trailWidth: 5.8,
    innerTrailWidth: 2.2,
  };
}

function getEnemyBulletVisuals() {
  return {
    outerColor: "rgba(255, 112, 142, 0.3)",
    coreColor: "rgba(255, 220, 230, 0.96)",
    headColor: "#ffdce5",
    trail: "#a83f57",
    trailWidth: 6.6,
    innerTrailWidth: 2.8,
  };
}

function createDeterministicRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function getShotSeed(player) {
  const idSeed = String(player.id || "")
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return ((player.runtime.lastInputSeq || 0) * 1103515245 + idSeed * 12345) >>> 0;
}

function getShotSpreads(loadout, player) {
  const pelletCount = Math.max(1, loadout.pellets || 1);
  const random = createDeterministicRandom(getShotSeed(player));
  return Array.from({ length: pelletCount }, (_, pellet) => {
    const base = (pellet - (pelletCount - 1) * 0.5) * (loadout.spread || 0);
    const jitter = (random() - 0.5) * (loadout.spread || 0) * 0.45;
    return base + jitter;
  });
}

function createPlayerBullet(player, angle, loadout, shotToken) {
  const visuals = getPlayerBulletVisuals(player.meta.className);
  return {
    x: player.position.x + Math.cos(angle) * (player.position.radius + 6),
    y: player.position.y + Math.sin(angle) * (player.position.radius + 6),
    prevX: player.position.x,
    prevY: player.position.y,
    vx: Math.cos(angle) * loadout.bulletSpeed,
    vy: Math.sin(angle) * loadout.bulletSpeed,
    radius: 3,
    damage: loadout.damage,
    life: 1.1,
    trail: visuals.trail,
    outerColor: visuals.outerColor,
    coreColor: visuals.coreColor,
    headColor: visuals.headColor,
    trailWidth: visuals.trailWidth,
    innerTrailWidth: visuals.innerTrailWidth,
    ownerId: player.id,
    ownerEnemyId: null,
    ownerFaction: "raid",
    shotToken,
  };
}

function createEnemyBullet(enemy, angle, speed, bulletId) {
  const visuals = getEnemyBulletVisuals();
  return {
    x: enemy.x + Math.cos(angle) * ((enemy.radius || 16) + 6),
    y: enemy.y + Math.sin(angle) * ((enemy.radius || 16) + 6),
    prevX: enemy.x,
    prevY: enemy.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 4,
    damage: enemy.damage || 1,
    life: 1.1,
    trail: visuals.trail,
    outerColor: visuals.outerColor,
    coreColor: visuals.coreColor,
    headColor: visuals.headColor,
    trailWidth: visuals.trailWidth,
    innerTrailWidth: visuals.innerTrailWidth,
    ownerId: null,
    ownerEnemyId: enemy.id || null,
    ownerFaction: enemy.faction || "security",
    bulletId,
    shotToken: null,
  };
}

function createEmptyCombatState(levelId = "freight") {
  return {
    levelId,
    elapsed: 0,
    heat: 0,
    heatScore: 0,
    heatTierApplied: 0,
    lootCollected: 0,
    message: "",
    enemies: [],
    bullets: [],
    enemyBullets: [],
  };
}

function getCombatProjectileKey(projectile) {
  if (!projectile || typeof projectile !== "object") {
    return null;
  }
  if (typeof projectile.bulletId === "string" && projectile.bulletId) {
    return projectile.bulletId;
  }
  if (typeof projectile.shotToken === "string" && projectile.shotToken) {
    return projectile.shotToken;
  }
  return null;
}

function mergeAuthoritativeProjectiles(existing = [], incoming = []) {
  const existingByKey = new Map();
  for (const projectile of existing) {
    const key = getCombatProjectileKey(projectile);
    if (key) {
      existingByKey.set(key, projectile);
    }
  }

  const merged = [];
  const seenKeys = new Set();
  for (const projectile of incoming) {
    const key = getCombatProjectileKey(projectile);
    if (key && existingByKey.has(key)) {
      merged.push(existingByKey.get(key));
      seenKeys.add(key);
      continue;
    }
    merged.push(projectile);
    if (key) {
      seenKeys.add(key);
    }
  }

  for (const projectile of existing) {
    const key = getCombatProjectileKey(projectile);
    if (!key || seenKeys.has(key)) {
      continue;
    }
    merged.push(projectile);
  }

  return merged;
}

function getWorldCollisionEntries(world) {
  return Array.isArray(world?.collision) ? world.collision.map(normalizeCollisionEntry).filter(Boolean) : [];
}

function getBulletCollisionSurfaceFromWorld(world, bullet) {
  return getWorldCollisionEntries(world).find((obstacle) => rectContains(obstacle, bullet.x, bullet.y)) || null;
}

function enemyShieldBlocksBullet(enemy, bullet) {
  if (!enemy?.shieldEquipped || !(enemy.shieldHp > 0)) {
    return false;
  }
  const shieldSourceAngle = Math.atan2(-bullet.vy, -bullet.vx);
  const shieldAngle = (enemy.aimAngle || 0) + (enemy.shieldSide || 1) * Math.PI * 0.5;
  return angleDifference(shieldSourceAngle, shieldAngle) <= Math.PI * 0.34;
}

function playerShieldBlocksBullet(player, bullet) {
  if (!player?.resources?.shieldEquipped || !(player.resources.shieldHp > 0)) {
    return false;
  }
  const shieldSourceAngle = Math.atan2(-bullet.vy, -bullet.vx);
  const rightSideAngle = (player.position.angle || 0) + Math.PI * 0.5;
  return angleDifference(shieldSourceAngle, rightSideAngle) <= Math.PI * 0.34;
}

function bulletCellDamage(bullet) {
  return bullet?.damage >= 22 ? 2 : 1;
}

function applyPlayerCellDamage(player, amount = 1) {
  if (!player || player.adminFlags.godMode) {
    return;
  }

  const damage = Math.max(1, amount);
  for (let hit = 0; hit < damage; hit += 1) {
    if (player.resources.shieldEquipped && player.resources.shieldHp > 0) {
      player.resources.shieldHp -= 1;
      if (player.resources.shieldHp <= 0) {
        player.resources.shieldHp = 0;
        player.resources.shieldEquipped = false;
      }
    } else {
      player.resources.hp -= 1;
    }
  }

  const maxShieldHp = getClassLoadout(player.meta.className).shieldCells || 0;
  player.resources.hp = clamp(player.resources.hp, 0, player.resources.maxHp);
  player.resources.shieldHp = clamp(player.resources.shieldHp, 0, maxShieldHp);
  if (maxShieldHp <= 0) {
    player.resources.shieldEquipped = false;
    player.resources.shieldHp = 0;
  }
}

function getClosestLivePlayerForEnemy(room, enemy) {
  let closest = null;
  let closestDistance = Infinity;
  const now = Date.now();
  for (const player of room.players.values()) {
    if (!player.connected || !player.runtime.initialized || !player.runtime.running || player.runtime.dead) {
      continue;
    }
    if (player.runtime.invisible || (player.runtime.spawnProtectedUntil || 0) > now) {
      continue;
    }
    const distanceToPlayer = distanceBetween(enemy, player.position);
    if (distanceToPlayer < closestDistance) {
      closestDistance = distanceToPlayer;
      closest = player;
    }
  }
  return closest ? { player: closest, distance: closestDistance } : null;
}

function getEnemyRaidTarget(room, enemy) {
  if (!enemy) {
    return null;
  }

  const preferredTarget =
    typeof enemy.targetId === "string" && enemy.targetId
      ? room.players.get(enemy.targetId)
      : null;
  if (
    preferredTarget &&
    preferredTarget.connected &&
    preferredTarget.runtime.initialized &&
    preferredTarget.runtime.running &&
    !preferredTarget.runtime.dead &&
    !preferredTarget.runtime.invisible &&
    (preferredTarget.runtime.spawnProtectedUntil || 0) <= Date.now()
  ) {
    return {
      player: preferredTarget,
      distance: distanceBetween(enemy, preferredTarget.position),
    };
  }

  return getClosestLivePlayerForEnemy(room, enemy);
}

function simulateEnemyAuthority(room, dt) {
  if (!room.combat || !Array.isArray(room.combat.enemies)) {
    return { combatMutated: false, worldMutated: false };
  }

  let combatMutated = false;
  let worldMutated = false;
  const raidTargets = getLiveRaidTargetsForRoom(room);
  const running = raidTargets.length > 0 && room.phase === ROOM_PHASE.RUNNING;
  room.combat.levelId = room.world?.layoutId || room.combat.levelId || "freight";
  if (running) {
    room.combat.elapsed = Math.max(0, finiteNumber(Number(room.combat.elapsed), 0) + dt);
  }

  for (const enemy of room.combat.enemies) {
    if (!enemy) {
      continue;
    }

    ensureEnemyDefaults(enemy);

    if (enemy.dead) {
      enemy.deadTimer = Math.max(0, enemy.deadTimer - dt);
      enemy.justAlerted = false;
      continue;
    }

    const prevX = enemy.x;
    const prevY = enemy.y;

    if (enemy.hidden || !running) {
      enemy.vx = 0;
      enemy.vy = 0;
      enemy.justAlerted = false;
      continue;
    }

    if (enemy.kind === "boss" && enemy.bossPhase === 1 && enemy.hp <= enemy.maxHp * 0.5) {
      enemy.bossPhase = 2;
      enemy.speed += 18;
      enemy.fireRate = Math.max(0.36, enemy.fireRate - 0.14);
      enemy.damage += 6;
      enemy.cooldown = 0.1;
      enemy.shieldEquipped = true;
      enemy.maxShieldHp = Math.max(enemy.maxShieldHp || 0, 2);
      enemy.shieldHp = Math.max(enemy.shieldHp || 0, enemy.maxShieldHp);
      enemy.shieldFlash = 1;
      room.combat.message = "WARd3n sheds restraint. Phase two live.";
      combatMutated = true;
    }

    enemy.justAlerted = false;
    enemy.shieldFlash = Math.max(0, enemy.shieldFlash - dt * 3);
    enemy.braceTimer = Math.max(0, enemy.braceTimer - dt);
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 3.6);
    enemy.muzzleFlash = Math.max(0, enemy.muzzleFlash - dt * 5);
    enemy.flinchTimer = Math.max(0, enemy.flinchTimer - dt);
    enemy.evadeTimer = Math.max(0, enemy.evadeTimer - dt);
    enemy.dodgeCooldown = Math.max(0, enemy.dodgeCooldown - dt);
    enemy.targetCommitTimer = Math.max(0, enemy.targetCommitTimer - dt);
    enemy.cooldown = Math.max(0, enemy.cooldown - dt);
    enemy.coverTimer = Math.max(0, enemy.coverTimer - dt);

    if (enemy.wounded) {
      enemy.bleedoutTimer = Math.max(0, (enemy.bleedoutTimer || 0) - dt);
      enemy.nextBleedDripAt = Math.max(0, (enemy.nextBleedDripAt || 0) - dt);
      if (enemy.bleedoutTimer <= 0) {
        enemy.dead = true;
        enemy.deadTimer = 5.2;
        enemy.hp = 0;
        enemy.targetId = null;
        enemy.wounded = false;
        enemy.nextBleedDripAt = 0;
        combatMutated = true;
        continue;
      }
    }

    const targetSelection = selectEnemyTarget(room, enemy);
    const rememberedTarget = getRememberedEnemyTarget(room, enemy.targetId);
    const activeTarget = targetSelection?.target || rememberedTarget || raidTargets[0] || null;
    const visibleTarget = Boolean(targetSelection);
    const toTarget = activeTarget ? distanceBetween(enemy, activeTarget) : Infinity;
    const chaseAngle = activeTarget ? angleToPoint(enemy.x, enemy.y, activeTarget.x, activeTarget.y) : enemy.aimAngle;
    const targetIsRaid = activeTarget?.faction === "raid";
    const incomingPlayerFire =
      enemy.kind === "rusher" &&
      Array.isArray(room.combat.bullets) &&
      room.combat.bullets.some((bullet) => {
        if (distanceBetween(enemy, bullet) > 96) {
          return false;
        }
        const bulletHeading = Math.atan2(bullet.vy, bullet.vx);
        return angleDifference(bulletHeading, angleToPoint(bullet.x, bullet.y, enemy.x, enemy.y)) < 0.55;
      });
    const nearIncomingFire =
      enemy.shieldEquipped &&
      Array.isArray(room.combat.bullets) &&
      room.combat.bullets.some((bullet) => distanceBetween(enemy, bullet) < 130);
    const squadLead = getShieldLead(room, enemy);
    const shieldLeadDrivingPush =
      squadLead && squadLead !== enemy && squadLead.state === "hunt" && ((squadLead.braceTimer || 0) > 0.1 || distanceBetween(squadLead, activeTarget || enemy) < 220);
    const woundedHuman = Boolean(enemy.wounded && isHumanEnemy(enemy));
    const woundedSpeedMultiplier = woundedHuman ? Math.max(0.46, 0.72 - (enemy.woundedSeverity || 0) * 0.2) : 1;

    if (nearIncomingFire) {
      enemy.braceTimer = Math.max(enemy.braceTimer, 0.65);
    }
    if (incomingPlayerFire && enemy.dodgeCooldown <= 0) {
      enemy.evadeTimer = 0.42;
      enemy.dodgeCooldown = 0.9;
      enemy.evadeSide = Math.random() > 0.5 ? 1 : -1;
      enemy.strafeBias = enemy.evadeSide;
    }
    if (enemy.shieldEquipped && Array.isArray(room.combat.bullets) && room.combat.bullets.length > 0 && toTarget < 240) {
      enemy.braceTimer = Math.max(enemy.braceTimer, 0.38);
    }

    if (isSpecimenEnemy(enemy)) {
      if (visibleTarget && activeTarget) {
        enemy.state = "hunt";
        enemy.lastSeenX = activeTarget.x;
        enemy.lastSeenY = activeTarget.y;
        enemy.targetId = activeTarget.id;
        enemy.searchTimer = 4.2;
        enemy.pursuitTimer = 4.8;
        enemy.aimAngle = turnToward(enemy.aimAngle, chaseAngle, dt * 9.6);
        enemy.justAlerted = true;
      } else {
        enemy.pursuitTimer = Math.max(0, enemy.pursuitTimer - dt);
        enemy.aimAngle = turnToward(enemy.aimAngle, angleToPoint(enemy.x, enemy.y, enemy.lastSeenX, enemy.lastSeenY), dt * 6.5);
      }

      if (visibleTarget && activeTarget) {
        moveEntityToward(room, enemy, activeTarget.x, activeTarget.y, enemy.speed * (toTarget > 86 ? 1.18 : 0.94), dt);
      } else if (enemy.pursuitTimer > 0) {
        moveEntityToward(room, enemy, enemy.lastSeenX, enemy.lastSeenY, enemy.speed * 1.04, dt);
      } else if (enemy.state === "investigate") {
        moveEntityToward(room, enemy, enemy.investigateX, enemy.investigateY, enemy.speed * 0.8, dt);
      } else {
        enemy.wanderAngle += (Math.random() - 0.5) * 0.58;
        moveEntityToward(room, enemy, enemy.x + Math.cos(enemy.wanderAngle) * 84, enemy.y + Math.sin(enemy.wanderAngle) * 84, enemy.speed * 0.48, dt);
      }

      enemy.vx = (enemy.x - prevX) / Math.max(dt, 0.0001);
      enemy.vy = (enemy.y - prevY) / Math.max(dt, 0.0001);
      combatMutated = combatMutated || enemy.vx !== 0 || enemy.vy !== 0;
      continue;
    }

    if (visibleTarget && activeTarget) {
      const braceAim = enemy.shieldEquipped && enemy.braceTimer > 0 ? chaseAngle - enemy.shieldSide * Math.PI * 0.5 : chaseAngle;
      enemy.aimAngle = turnToward(enemy.aimAngle, braceAim, dt * (enemy.braceTimer > 0 ? 9.6 : 7.2));
      enemy.state = "hunt";
      enemy.lastSeenX = activeTarget.x;
      enemy.lastSeenY = activeTarget.y;
      enemy.targetId = activeTarget.id;
      enemy.targetCommitTimer = targetIsRaid ? 1.45 : 1;
      enemy.searchTimer = 3.8;
      enemy.pursuitTimer = enemy.kind === "boss" ? 5.6 : enemy.kind === "guard" ? 4.8 : 4.2;

      if (enemy.seenTimer <= 0) {
        enemy.justAlerted = true;
        if (enemy.squadRole === "shieldLead") {
          for (const ally of getSquadmates(room, enemy)) {
            if (ally === enemy || ally.dead) {
              continue;
            }
            const relayPoint = getApproximateAlertPoint(room, enemy, ally, activeTarget.x, activeTarget.y);
            ally.state = "hunt";
            ally.lastSeenX = relayPoint.x;
            ally.lastSeenY = relayPoint.y;
            ally.targetId = activeTarget.id;
            ally.targetCommitTimer = targetIsRaid ? 1.15 : 0.8;
            ally.searchTimer = 3.4;
            ally.pursuitTimer = ally.kind === "guard" ? 4.6 : 4;
            ally.coverTimer = 0;
          }
        }
      }

      enemy.seenTimer = 1.15;
    } else {
      enemy.seenTimer = Math.max(0, enemy.seenTimer - dt);
    }

    if (enemy.state !== "hunt") {
      for (const signal of room.recentSignals) {
        const heardDistance = distanceBetween(enemy, signal);
        const effectiveRange = Math.min(signal.radius || 0, enemy.hearingRange + (signal.radius || 0) * 0.4);
        if (heardDistance > effectiveRange) {
          continue;
        }
        const investigatePoint = getInvestigatePointForSignal(room, enemy, signal);
        enemy.state = "investigate";
        enemy.targetId = null;
        enemy.targetCommitTimer = 0;
        enemy.investigateX = investigatePoint.x;
        enemy.investigateY = investigatePoint.y;
        enemy.searchTimer = STEALTH_TUNING.investigateBase + finiteNumber(Number(signal.intensity), 0) * STEALTH_TUNING.investigateIntensityScale;
        combatMutated = true;
        break;
      }
    }

    if (enemy.state === "hunt" && activeTarget) {
      const desiredDistance = enemy.kind === "boss" ? 250 : enemy.kind === "guard" ? 210 : shieldLeadDrivingPush ? 118 : 145;
      const prefersCover = enemy.kind === "guard" || enemy.kind === "boss" || enemy.tactic === "anchor";
      const shouldFlank = enemy.tactic === "flankLeft" || enemy.tactic === "flankRight" || shieldLeadDrivingPush;
      const coverTarget = enemy.coverTimer <= 0 || !Number.isFinite(enemy.coverX) ? findCoverPosition(room, enemy, activeTarget) : { x: enemy.coverX, y: enemy.coverY };

      if (!visibleTarget) {
        enemy.pursuitTimer = Math.max(0, enemy.pursuitTimer - dt);
        enemy.aimAngle = turnToward(enemy.aimAngle, angleToPoint(enemy.x, enemy.y, enemy.lastSeenX, enemy.lastSeenY), dt * 6.4);
        if (enemy.pursuitTimer > 0) {
          if (lineBlockedWorld(room.world, enemy.x, enemy.y, enemy.lastSeenX, enemy.lastSeenY)) {
            worldMutated = tryOpenEnemyDoor(room, enemy) || worldMutated;
          }
          moveEntityToward(room, enemy, enemy.lastSeenX, enemy.lastSeenY, enemy.speed * (enemy.kind === "rusher" ? 1.02 : 0.86) * woundedSpeedMultiplier, dt);
          if (distanceBetween(enemy, { x: enemy.lastSeenX, y: enemy.lastSeenY }) < 24 && enemy.pursuitTimer < 1.2) {
            beginEnemySearch(room, enemy, enemy.lastSeenX, enemy.lastSeenY, STEALTH_TUNING.searchBase);
          }
        } else {
          beginEnemySearch(room, enemy, enemy.lastSeenX, enemy.lastSeenY, Math.max(enemy.searchTimer, STEALTH_TUNING.searchBase));
        }
      } else if (enemy.shieldEquipped && enemy.braceTimer > 0) {
        moveEntityToward(room, enemy, enemy.x + Math.cos(chaseAngle) * 48, enemy.y + Math.sin(chaseAngle) * 48, enemy.speed * 0.72 * woundedSpeedMultiplier, dt);
      } else if (woundedHuman && coverTarget) {
        enemy.coverX = coverTarget.x;
        enemy.coverY = coverTarget.y;
        enemy.coverTimer = 1.35;
        moveEntityToward(room, enemy, coverTarget.x, coverTarget.y, enemy.speed * 0.74 * woundedSpeedMultiplier, dt);
      } else if (enemy.kind === "rusher" && enemy.evadeTimer > 0) {
        const evadeAngle = chaseAngle + enemy.evadeSide * Math.PI * 0.5;
        enemy.aimAngle = turnToward(enemy.aimAngle, chaseAngle, dt * 9.2);
        moveEntityToward(room, enemy, enemy.x + Math.cos(evadeAngle) * 138, enemy.y + Math.sin(evadeAngle) * 138, enemy.speed * 1.18 * woundedSpeedMultiplier, dt);
      } else if (enemy.flinchTimer > 0) {
        moveEntityToward(room, enemy, enemy.x - Math.cos(chaseAngle) * 46, enemy.y - Math.sin(chaseAngle) * 46, enemy.speed * 0.42 * woundedSpeedMultiplier, dt);
      } else if (prefersCover && coverTarget && toTarget > desiredDistance * 0.72) {
        enemy.coverX = coverTarget.x;
        enemy.coverY = coverTarget.y;
        enemy.coverTimer = 1.1;
        moveEntityToward(room, enemy, coverTarget.x, coverTarget.y, enemy.speed * 0.98 * woundedSpeedMultiplier, dt);
      } else if (shouldFlank && toTarget > 100) {
        const flankTarget = getFlankTarget(room, enemy, activeTarget);
        moveEntityToward(room, enemy, flankTarget.x, flankTarget.y, enemy.speed * 1.04 * woundedSpeedMultiplier, dt);
      } else if (toTarget > desiredDistance) {
        moveEntityToward(room, enemy, activeTarget.x, activeTarget.y, enemy.speed * (enemy.kind === "rusher" ? 1.1 : 0.94) * woundedSpeedMultiplier, dt);
      } else if (toTarget < desiredDistance - 42) {
        moveEntityToward(room, enemy, enemy.x - Math.cos(chaseAngle) * 120, enemy.y - Math.sin(chaseAngle) * 120, enemy.speed * 0.72 * woundedSpeedMultiplier, dt);
      } else {
        const strafeAngle = chaseAngle + enemy.strafeBias * (enemy.tactic === "assault" ? Math.PI * 0.42 : Math.PI * 0.58);
        moveEntityToward(room, enemy, enemy.x + Math.cos(strafeAngle) * 118, enemy.y + Math.sin(strafeAngle) * 118, enemy.speed * 0.72 * woundedSpeedMultiplier, dt);
      }
    } else if (enemy.state === "investigate") {
      const investigateTarget = { x: enemy.investigateX, y: enemy.investigateY };
      const reachedTarget = distanceBetween(enemy, investigateTarget) < 20;
      if (!reachedTarget) {
        moveEntityToward(room, enemy, investigateTarget.x, investigateTarget.y, enemy.speed * 0.72 * woundedSpeedMultiplier, dt);
        enemy.aimAngle = turnToward(enemy.aimAngle, angleToPoint(enemy.x, enemy.y, investigateTarget.x, investigateTarget.y), dt * 3.9);
      } else {
        enemy.wanderAngle += dt * 1.8;
        enemy.aimAngle = turnToward(enemy.aimAngle, enemy.wanderAngle, dt * 3.2);
      }
      enemy.searchTimer -= dt;
      if (enemy.searchTimer <= 0 || reachedTarget) {
        beginEnemySearch(room, enemy, investigateTarget.x, investigateTarget.y, Math.max(1.7, STEALTH_TUNING.searchBase - 0.5));
      }
    } else if (enemy.state === "search") {
      enemy.searchTimer -= dt;
      if (!Array.isArray(enemy.searchNodes) || enemy.searchNodes.length === 0) {
        enemy.searchNodes = buildSearchNodes(room, enemy, enemy.lastSeenX, enemy.lastSeenY);
        enemy.searchNodeIndex = 0;
      }
      const currentNode = enemy.searchNodes[enemy.searchNodeIndex] || { x: enemy.lastSeenX, y: enemy.lastSeenY };
      enemy.aimAngle = turnToward(enemy.aimAngle, angleToPoint(enemy.x, enemy.y, currentNode.x, currentNode.y), dt * 3.4);
      moveEntityToward(room, enemy, currentNode.x, currentNode.y, enemy.speed * 0.42 * woundedSpeedMultiplier, dt);
      if (distanceBetween(enemy, currentNode) < 18 && enemy.searchNodes.length > 1) {
        enemy.searchNodeIndex = (enemy.searchNodeIndex + 1) % enemy.searchNodes.length;
      }
      if (enemy.searchTimer <= 0) {
        enemy.state = "patrol";
        enemy.targetId = null;
        enemy.targetCommitTimer = 0;
        enemy.patrolPause = 0.5 + Math.random() * 1.2;
        enemy.patrolPauseCooldown = 0.8 + Math.random() * 1.4;
      }
    } else {
      enemy.patrolPause = Math.max(0, enemy.patrolPause - dt);
      enemy.patrolPauseCooldown = Math.max(0, enemy.patrolPauseCooldown - dt);
      if (enemy.patrolPause <= 0 && enemy.patrolPauseCooldown <= 0 && Math.random() < 0.015) {
        enemy.patrolPause = 1.2 + Math.random() * 2.8;
        enemy.patrolPauseCooldown = 2.4 + Math.random() * 2.2;
      }
      enemy.wanderAngle += (Math.random() - 0.5) * 0.42;
      enemy.aimAngle = turnToward(enemy.aimAngle, enemy.wanderAngle, dt * 2.5);
      if (enemy.patrolPause > 0) {
        enemy.vx = 0;
        enemy.vy = 0;
      } else {
        if (Math.random() < AI_TUNING.patrolAnchorDriftChance) {
          enemy.wanderAngle += (Math.random() - 0.5) * Math.PI * 0.8;
        }
        moveEntityToward(
          room,
          enemy,
          enemy.patrolAnchorX + Math.cos(enemy.wanderAngle) * enemy.patrolRadius,
          enemy.patrolAnchorY + Math.sin(enemy.wanderAngle) * enemy.patrolRadius,
          enemy.speed * 0.28 * woundedSpeedMultiplier,
          dt
        );
      }
    }

    enemy.vx = (enemy.x - prevX) / Math.max(dt, 0.0001);
    enemy.vy = (enemy.y - prevY) / Math.max(dt, 0.0001);
    if (enemy.vx !== 0 || enemy.vy !== 0 || enemy.justAlerted) {
      combatMutated = true;
    }
  }

  return { combatMutated, worldMutated };
}

function getHeatTierFromScore(score = 0) {
  if (score >= HEAT_SCORE_THRESHOLDS[4]) {
    return 4;
  }
  if (score >= HEAT_SCORE_THRESHOLDS[3]) {
    return 3;
  }
  if (score >= HEAT_SCORE_THRESHOLDS[2]) {
    return 2;
  }
  return 1;
}

function registerEncounterSignal(room, signal = {}) {
  if (!room || !Number.isFinite(signal.x) || !Number.isFinite(signal.y)) {
    return;
  }
  const now = Date.now();
  room.recentSignals = (Array.isArray(room.recentSignals) ? room.recentSignals : [])
    .filter((entry) => entry.expiresAt > now)
    .concat({
      x: signal.x,
      y: signal.y,
      radius: Math.max(0, Number(signal.radius) || 0),
      expiresAt: now + Math.max(250, Number(signal.ttlMs) || 1800),
    });
}

function registerRoomHeat(room, amount, reason = "") {
  if (!room?.combat || !(amount > 0)) {
    return;
  }
  room.combat.heatScore = Math.max(0, (room.combat.heatScore || 0) + amount);
  if (reason) {
    room.combat.message = reason;
  }
}

function promoteEnemyToElite(enemy, tier = 1) {
  if (!enemy || enemy.dead || enemy.kind === "boss" || enemy.kind === "specimen" || enemy.elite) {
    return false;
  }
  enemy.elite = true;
  enemy.eliteTier = tier;
  enemy.radius += enemy.kind === "guard" ? 2 : 1;
  enemy.maxHp += enemy.kind === "guard" ? 26 : 18;
  enemy.hp += enemy.kind === "guard" ? 26 : 18;
  enemy.speed += enemy.kind === "guard" ? 8 : 14;
  enemy.damage += enemy.kind === "guard" ? 5 : 4;
  enemy.viewRange += STEALTH_TUNING.eliteViewBonus;
  enemy.hearingRange += STEALTH_TUNING.eliteHearingBonus;
  enemy.fireRate = Math.max(0.34, enemy.fireRate - (enemy.kind === "guard" ? 0.1 : 0.08));
  enemy.cooldown = Math.min(enemy.cooldown || enemy.fireRate, enemy.fireRate * 0.4);
  if (enemy.shieldEquipped || enemy.kind === "guard") {
    enemy.shieldEquipped = true;
    enemy.maxShieldHp = Math.max(enemy.maxShieldHp || 0, (enemy.kind === "guard" ? 34 : 22) + 12);
    enemy.shieldHp = Math.max(enemy.shieldHp || 0, enemy.maxShieldHp);
    enemy.shieldFlash = 1;
  }
  return true;
}

function updateEncounterAuthority(room) {
  if (!room?.combat || !Array.isArray(room.combat.enemies)) {
    return false;
  }

  let mutated = false;
  const now = Date.now();
  const enemies = room.combat.enemies;
  room.recentSignals = (Array.isArray(room.recentSignals) ? room.recentSignals : []).filter((entry) => entry.expiresAt > now);

  for (const enemy of enemies) {
    if (!enemy || enemy.dead || !enemy.justAlerted) {
      continue;
    }
    const nextAllowedAt = room.enemyAlertLocks.get(enemy.id) || 0;
    if (now < nextAllowedAt) {
      continue;
    }
    room.enemyAlertLocks.set(enemy.id, now + 900);
    registerRoomHeat(
      room,
      enemy.kind === "boss" ? 1.2 : enemy.kind === "guard" ? 0.85 : 0.65,
      "Enemy visual contact is escalating district response."
    );
    const targetInfo = getEnemyRaidTarget(room, enemy);
    if (targetInfo) {
      for (const ally of enemies) {
        if (!ally || ally.dead || ally.id === enemy.id || ally.hidden || ally.faction !== enemy.faction) {
          continue;
        }
        if (distanceBetween(enemy, ally) > AI_TUNING.alertShareRange) {
          continue;
        }
        ally.state = "investigate";
        ally.investigateX = clamp(targetInfo.player.position.x + (Math.random() - 0.5) * 80, 28, (room.world?.bounds?.width || WORLD_BOUNDS.width) - 28);
        ally.investigateY = clamp(targetInfo.player.position.y + (Math.random() - 0.5) * 80, 28, (room.world?.bounds?.height || WORLD_BOUNDS.height) - 28);
        ally.lastSeenX = ally.investigateX;
        ally.lastSeenY = ally.investigateY;
        ally.targetId = targetInfo.player.id;
        ally.targetCommitTimer = 0.8;
        ally.searchTimer = STEALTH_TUNING.investigateBase + 0.8;
        ally.coverTimer = 0;
        mutated = true;
      }
    }
  }

  for (const enemy of enemies) {
    if (!enemy || enemy.dead || !enemy.hidden || !enemy.contained) {
      continue;
    }
    const playerNearby = getConnectedRaidPlayers(room).some(
      (player) => !player.runtime.invisible && distanceBetween(enemy, player.position) <= (enemy.releaseRadius || 170)
    );
    const loudSignalNearby = room.recentSignals.some(
      (signal) => distanceBetween(enemy, signal) <= Math.max(enemy.releaseSoundRadius || 190, signal.radius || 0)
    );
    const heatTriggered = (room.combat.heat || 1) >= (enemy.releaseHeat || 99);
    if (!playerNearby && !loudSignalNearby && !heatTriggered) {
      continue;
    }
    enemy.hidden = false;
    enemy.contained = false;
    enemy.state = "hunt";
    enemy.cooldown = 0.2;
    enemy.searchTimer = 3.8;
    enemy.justAlerted = true;
    room.combat.message = "Containment breach detected.";
    mutated = true;
  }

  const levelDuration = LEVEL_DURATIONS_SECONDS[room.combat.levelId] || LEVEL_DURATIONS_SECONDS.freight;
  const progress = clamp(levelDuration > 0 ? (room.combat.elapsed || 0) / levelDuration : 0, 0, 0.999);
  const timeHeat = Math.max(1, Math.min(4, 1 + Math.floor(progress * 4)));
  const behaviorHeat = getHeatTierFromScore(room.combat.heatScore || 0);
  const nextHeat = Math.max(timeHeat, behaviorHeat);
  if (nextHeat !== room.combat.heat) {
    room.combat.heat = nextHeat;
    room.combat.message = `District heat increased to ${nextHeat}.`;
    mutated = true;
  }

  const targetTier = Math.max(1, Math.min(4, room.combat.heat || 1));
  if (targetTier > (room.combat.heatTierApplied || 1)) {
    for (let tier = (room.combat.heatTierApplied || 1) + 1; tier <= targetTier; tier += 1) {
      const candidate = enemies
        .filter((enemy) => !enemy.dead && enemy.kind !== "boss" && enemy.kind !== "specimen" && !enemy.elite)
        .sort((a, b) => distanceBetween(a, getEnemyRaidTarget(room, a)?.player?.position || { x: a.x, y: a.y }) - distanceBetween(b, getEnemyRaidTarget(room, b)?.player?.position || { x: b.x, y: b.y }))[0];
      if (candidate && promoteEnemyToElite(candidate, tier)) {
        room.combat.message = candidate.kind === "guard" ? "Heat spike. Elite shield unit deployed." : "Heat spike. Elite rusher incoming.";
        mutated = true;
      }
    }
    room.combat.heatTierApplied = targetTier;
    mutated = true;
  }

  room.combat.lootCollected = getCollectedCoreCount(room.world);
  return mutated;
}

function getCrateDamageStage(crate) {
  if (!crate || crate.broken || crate.hp <= 0) {
    return 3;
  }
  const ratio = crate.maxHp > 0 ? crate.hp / crate.maxHp : 0;
  if (ratio <= 0.34) {
    return 2;
  }
  if (ratio <= 0.68) {
    return 1;
  }
  return 0;
}

function spawnCrateLoot(world, crate) {
  if (!world || !crate || crate.lootSpawned) {
    return;
  }
  crate.lootSpawned = true;
  if (!Array.isArray(world.loot)) {
    world.loot = [];
  }
  const lootId = `${crate.id}-loot`;
  if (world.loot.some((entry) => entry.id === lootId)) {
    return;
  }
  world.loot.push({
    id: lootId,
    x: crate.x + crate.w * 0.5,
    y: crate.y + crate.h * 0.5,
    type: crate.lootType || "cash",
    value: Number(crate.lootValue) || 90,
    radius: 11,
    collected: false,
  });
}

function mergeCombatState(existing, incoming) {
  if (!incoming || typeof incoming !== "object") {
    return existing;
  }

  if (!existing || typeof existing !== "object") {
    const inferredLevelId =
      typeof incoming.levelId === "string" && incoming.levelId
        ? incoming.levelId
        : typeof existing?.levelId === "string" && existing.levelId
          ? existing.levelId
          : "freight";
    const initial = createEmptyCombatState(inferredLevelId);
    return {
      ...initial,
      ...incoming,
      bullets: Array.isArray(incoming.bullets) ? incoming.bullets : [],
      enemyBullets: Array.isArray(incoming.enemyBullets) ? incoming.enemyBullets : [],
      enemies: Array.isArray(incoming.enemies) ? incoming.enemies : [],
    };
  }

  const shouldSeedEnemies =
    !Array.isArray(existing.enemies) ||
    existing.enemies.length === 0 ||
    (typeof incoming.levelId === "string" && incoming.levelId && incoming.levelId !== existing.levelId);
  const seededEnemies = shouldSeedEnemies && Array.isArray(incoming.enemies) ? incoming.enemies : existing.enemies || [];

  return {
    ...existing,
    levelId: typeof incoming.levelId === "string" && incoming.levelId ? incoming.levelId : existing.levelId,
    enemies: seededEnemies,
    elapsed:
      shouldSeedEnemies && Number.isFinite(Number(incoming.elapsed))
        ? Number(incoming.elapsed)
        : finiteNumber(Number(existing.elapsed), 0),
    heat:
      shouldSeedEnemies && Number.isFinite(Number(incoming.heat))
        ? Number(incoming.heat)
        : finiteNumber(Number(existing.heat), 0),
    heatScore:
      shouldSeedEnemies && Number.isFinite(Number(incoming.heatScore))
        ? Number(incoming.heatScore)
        : finiteNumber(Number(existing.heatScore), 0),
    heatTierApplied:
      shouldSeedEnemies && Number.isFinite(Number(incoming.heatTierApplied))
        ? Number(incoming.heatTierApplied)
        : finiteNumber(Number(existing.heatTierApplied), 0),
    lootCollected:
      shouldSeedEnemies && Number.isFinite(Number(incoming.lootCollected))
        ? Number(incoming.lootCollected)
        : finiteNumber(Number(existing.lootCollected), 0),
    message:
      shouldSeedEnemies && typeof incoming.message === "string"
        ? incoming.message
        : typeof existing.message === "string"
          ? existing.message
          : "",
    bullets: Array.isArray(existing.bullets) ? existing.bullets : [],
    enemyBullets: Array.isArray(existing.enemyBullets) ? existing.enemyBullets : [],
  };
}

function getInputFrameState(frame) {
  if (!frame || typeof frame !== "object") {
    return {};
  }

  if (frame.state && typeof frame.state === "object") {
    return frame.state;
  }

  return frame;
}

function applyInputFrame(player, frame, room, sequence = 0) {
  if (!player || !frame || typeof frame !== "object") {
    return;
  }

  const state = getInputFrameState(frame);
  const previousClassName = player.meta.className;
  const previousRunning = player.runtime.running;
  const incomingClassName = frame.className || state.className || player.meta.className;
  const shouldSeedState =
    !player.runtime.initialized ||
    (previousRunning === false && state.running === true) ||
    (incomingClassName && incomingClassName !== previousClassName) ||
    room.phase !== ROOM_PHASE.RUNNING;

  player.meta.className = incomingClassName;
  player.meta.weaponLabel = frame.weaponLabel || state.weaponLabel || player.meta.weaponLabel;
  player.meta.displayName = typeof frame.displayName === "string" ? frame.displayName : player.meta.displayName;
  player.meta.title = typeof frame.title === "string" ? frame.title : player.meta.title;
  player.meta.spriteVariant =
    typeof frame.spriteVariant === "string" || frame.spriteVariant === null ? frame.spriteVariant : player.meta.spriteVariant;
  player.position.angle = finiteNumber(Number(frame.aimAngle ?? state.angle), player.position.angle);
  player.runtime.running = typeof state.running === "boolean" ? state.running : typeof frame.running === "boolean" ? frame.running : player.runtime.running;
  player.runtime.quietMode =
    typeof frame.quietMode === "boolean" ? frame.quietMode : typeof frame.quietHeld === "boolean" ? frame.quietHeld : player.runtime.quietMode;
  player.runtime.updatedAt = Date.now();
  player.runtime.lastInputAt = player.runtime.updatedAt;
  player.runtime.lastInputSeq = Math.max(player.runtime.lastInputSeq || 0, finiteNumber(Number(sequence), 0));
  player.runtime.lastInputFrame = {
    moveX: clamp(finiteNumber(Number(frame.moveX), 0), -1, 1),
    moveY: clamp(finiteNumber(Number(frame.moveY), 0), -1, 1),
    aimAngle: finiteNumber(Number(frame.aimAngle), player.position.angle),
    shootPressed: Boolean(frame.shootPressed),
    sprintHeld: Boolean(frame.sprintHeld),
    quietHeld:
      typeof frame.quietHeld === "boolean" ? frame.quietHeld : typeof frame.quietMode === "boolean" ? frame.quietMode : false,
    quietMode: typeof frame.quietMode === "boolean" ? frame.quietMode : player.runtime.quietMode,
    reloadPressed: Boolean(frame.reloadPressed),
    medkitPressed: Boolean(frame.medkitPressed),
    noisePressed: Boolean(frame.noisePressed),
    abilityPressed: Boolean(frame.abilityPressed),
    takedownPressed: Boolean(frame.takedownPressed),
    adminPressed: Boolean(frame.adminPressed),
    adminAction: typeof frame.adminAction === "string" ? frame.adminAction : "",
    noiseTarget:
      frame.noiseTarget && typeof frame.noiseTarget === "object"
        ? {
            x: finiteNumber(Number(frame.noiseTarget.x), NaN),
            y: finiteNumber(Number(frame.noiseTarget.y), NaN),
          }
        : null,
  };

  if (shouldSeedState) {
    const spawn = frame.spawn && typeof frame.spawn === "object" ? frame.spawn : state;
    player.position.x = finiteNumber(Number(spawn.x), player.position.x);
    player.position.y = finiteNumber(Number(spawn.y), player.position.y);
    player.position.radius = finiteNumber(Number(spawn.radius), player.position.radius);
    player.position.vx = 0;
    player.position.vy = 0;
    applySeedState(player, state.seed || frame.seed);
    player.runtime.initialized = true;
    player.runtime.lastSimulatedAt = player.runtime.updatedAt;
    player.runtime.spawnProtectedUntil = player.runtime.updatedAt + 2600;
  }

  player.runtime.dead = (player.resources.hp || 0) <= 0;
}

function simulatePlayers(room) {
  const now = Date.now();
  const bounds = room.world?.bounds || WORLD_BOUNDS;
  const dt = clamp((now - room.lastSimulatedAt) / 1000, 0.001, 0.1);
  room.lastSimulatedAt = now;

  for (const player of room.players.values()) {
    if (!player.connected || !player.runtime.initialized || !player.runtime.running) {
      player.position.vx = 0;
      player.position.vy = 0;
      player.runtime.lastSimulatedAt = now;
      continue;
    }

    const frame = player.runtime.lastInputFrame;
    if (!frame || now - (player.runtime.lastInputAt || 0) > MULTIPLAYER.tickRateMs * 3) {
      player.position.vx = 0;
      player.position.vy = 0;
      player.runtime.lastSimulatedAt = now;
      continue;
    }

    const moveMagnitude = Math.hypot(frame.moveX, frame.moveY);
    const loadout = getClassLoadout(player.meta.className);
    const moveX = moveMagnitude > 0 ? frame.moveX / moveMagnitude : 0;
    const moveY = moveMagnitude > 0 ? frame.moveY / moveMagnitude : 0;
    const quietHeld = Boolean(frame.quietHeld && !frame.sprintHeld);
    const speed = frame.sprintHeld ? loadout.sprintSpeed : quietHeld ? loadout.speed * loadout.quietMultiplier : loadout.speed;
    const previousX = player.position.x;
    const previousY = player.position.y;
    tryMove(room, player, moveX * speed * dt, moveY * speed * dt);
    player.position.x = clamp(player.position.x, player.position.radius, bounds.width - player.position.radius);
    player.position.y = clamp(player.position.y, player.position.radius, bounds.height - player.position.radius);
    player.position.vx = (player.position.x - previousX) / Math.max(dt, 0.0001);
    player.position.vy = (player.position.y - previousY) / Math.max(dt, 0.0001);
    player.position.angle = finiteNumber(Number(frame.aimAngle), player.position.angle);
    player.runtime.lastSimulatedAt = now;
  }
}

function processPlayerCombatActions(room, emitters = {}) {
  let mutated = false;
  const now = Date.now();
  const emitCombatEvent = (kind, payload) => emitters.broadcastCombatEvent?.(kind, payload);

  if (!room.combat) {
    room.combat = createEmptyCombatState(room.world?.layoutId || "freight");
  }

  for (const player of room.players.values()) {
    if (!player.connected || !player.runtime.initialized) {
      continue;
    }

    if (player.runtime.reloadCompleteAt > 0 && now >= player.runtime.reloadCompleteAt) {
      player.resources.ammo = player.resources.magSize;
      player.runtime.reloadCompleteAt = 0;
      mutated = true;
    }

    if (player.runtime.abilityActiveUntil > 0 && now >= player.runtime.abilityActiveUntil) {
      player.runtime.abilityActiveUntil = 0;
      player.runtime.invisible = Boolean(player.adminFlags.invisible);
      mutated = true;
    } else {
      player.runtime.invisible = Boolean(player.adminFlags.invisible || now < (player.runtime.abilityActiveUntil || 0));
    }

    if (!player.runtime.running || player.runtime.processedInputSeq >= player.runtime.lastInputSeq) {
      continue;
    }

    const frame = player.runtime.lastInputFrame || {};
    const loadout = getClassLoadout(player.meta.className);
    const actorPayload = {
      playerId: player.id,
      x: player.position.x,
      y: player.position.y,
      angle: player.position.angle,
      radius: player.position.radius,
      className: player.meta.className,
      displayName: player.meta.displayName,
    };

    if (frame.shootPressed && now >= (player.runtime.nextShootAt || 0) && now >= (player.runtime.reloadCompleteAt || 0) && (player.resources.ammo || 0) > 0) {
      player.resources.ammo = Math.max(0, (player.resources.ammo || 0) - 1);
      player.runtime.nextShootAt = now + Math.max(120, loadout.shotRate * 1000);
      registerRoomHeat(room, clamp(0.18 + loadout.soundRadius / 520 + ((loadout.pellets || 1) > 1 ? 0.12 : 0), 0.3, 0.95), "Gunfire is drawing district attention.");
      registerEncounterSignal(room, {
        x: player.position.x,
        y: player.position.y,
        radius: loadout.soundRadius || 180,
        ttlMs: 1800,
      });
      if (room.combat && Array.isArray(room.combat.bullets)) {
        const shotToken = `${player.id}-${player.runtime.lastInputSeq}`;
        const spreads = getShotSpreads(loadout, player);
        for (const spread of spreads) {
          room.combat.bullets.push(createPlayerBullet(player, player.position.angle + spread, loadout, shotToken));
        }
        emitCombatEvent(COMBAT_EVENT_KIND.SHOT, {
          ...actorPayload,
          shotToken,
          spreads,
          serverTime: now,
        });
      }
      mutated = true;
    }

    if (frame.reloadPressed && now >= (player.runtime.reloadCompleteAt || 0) && (player.resources.ammo || 0) < (player.resources.magSize || 0)) {
      const reloadMs = Math.max(450, (player.resources.reloadTime || loadout.reloadTime || 1) * 1000);
      player.runtime.reloadCompleteAt = now + reloadMs;
      player.runtime.nextShootAt = Math.max(player.runtime.nextShootAt || 0, player.runtime.reloadCompleteAt);
      mutated = true;
      emitCombatEvent(COMBAT_EVENT_KIND.RELOAD, {
        ...actorPayload,
        durationMs: reloadMs,
        serverTime: now,
      });
    }

    if (
      frame.medkitPressed &&
      now >= (player.runtime.nextMedkitAt || 0) &&
      (player.resources.medkits || 0) > 0 &&
      (player.resources.hp || 0) < (player.resources.maxHp || 0)
    ) {
      player.resources.medkits = Math.max(0, (player.resources.medkits || 0) - 1);
      player.resources.hp = Math.min(player.resources.maxHp || 1, (player.resources.hp || 0) + 1);
      player.runtime.nextMedkitAt = now + PLAYER_ACTION_COOLDOWNS_MS.medkit;
      mutated = true;
      emitCombatEvent(COMBAT_EVENT_KIND.MEDKIT, {
        ...actorPayload,
        serverTime: now,
      });
    }

    if (frame.noisePressed && now >= (player.runtime.nextNoiseAt || 0) && (player.resources.noiseCharges || 0) > 0) {
      player.resources.noiseCharges = Math.max(0, (player.resources.noiseCharges || 0) - 1);
      player.runtime.nextNoiseAt = now + PLAYER_ACTION_COOLDOWNS_MS.noise;
      registerRoomHeat(room, 0.55, "The distraction is pushing district chatter upward.");
      registerEncounterSignal(room, {
        x: frame.noiseTarget && Number.isFinite(frame.noiseTarget.x) ? frame.noiseTarget.x : player.position.x,
        y: frame.noiseTarget && Number.isFinite(frame.noiseTarget.y) ? frame.noiseTarget.y : player.position.y,
        radius: 360,
        ttlMs: 2200,
      });
      mutated = true;
      emitCombatEvent(COMBAT_EVENT_KIND.NOISE, {
        ...actorPayload,
        target:
          frame.noiseTarget && Number.isFinite(frame.noiseTarget.x) && Number.isFinite(frame.noiseTarget.y)
            ? frame.noiseTarget
            : null,
        serverTime: now,
      });
    }

    if (frame.abilityPressed && loadout.ability === "cloak" && now >= (player.runtime.abilityCooldownUntil || 0)) {
      player.runtime.abilityActiveUntil = now + Math.max(600, loadout.abilityDuration * 1000);
      player.runtime.abilityCooldownUntil = now + Math.max(2000, loadout.abilityCooldown * 1000);
      player.runtime.invisible = true;
      mutated = true;
      emitCombatEvent(COMBAT_EVENT_KIND.ABILITY, {
        ...actorPayload,
        ability: loadout.ability,
        durationMs: Math.max(600, loadout.abilityDuration * 1000),
        cooldownMs: Math.max(2000, loadout.abilityCooldown * 1000),
        serverTime: now,
      });
    }

    if (frame.adminPressed && frame.adminAction && applyServerAdminAction(player, frame.adminAction)) {
      mutated = true;
      emitCombatEvent(COMBAT_EVENT_KIND.ADMIN, {
        ...actorPayload,
        adminAction: frame.adminAction,
        serverTime: now,
      });
    }

    if (frame.takedownPressed && now >= (player.runtime.nextTakedownAt || 0)) {
      player.runtime.nextTakedownAt = now + PLAYER_ACTION_COOLDOWNS_MS.takedown;
      emitCombatEvent(COMBAT_EVENT_KIND.TAKEDOWN, {
        ...actorPayload,
        serverTime: now,
      });
    }

    player.runtime.processedInputSeq = player.runtime.lastInputSeq;
  }

  return mutated;
}

function simulateAuthoritativeCombat(room, dt, emitters = {}) {
  if (!room.combat || !Array.isArray(room.combat.bullets)) {
    return { combatMutated: false, worldMutated: false };
  }

  let combatMutated = false;
  let worldMutated = false;
  const now = Date.now();
  const enemyList = Array.isArray(room.combat.enemies) ? room.combat.enemies : [];
  const emitCombatEvent = (kind, payload) => emitters.broadcastCombatEvent?.(kind, payload);

  room.combat.bullets = room.combat.bullets.filter((bullet) => {
    bullet.prevX = bullet.x;
    bullet.prevY = bullet.y;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    const hitSurface = getBulletCollisionSurfaceFromWorld(room.world, bullet);
    if (
      bullet.life <= 0 ||
      bullet.x < 0 ||
      bullet.y < 0 ||
      bullet.x > (room.world?.bounds?.width || WORLD_BOUNDS.width) ||
      bullet.y > (room.world?.bounds?.height || WORLD_BOUNDS.height) ||
      hitSurface
    ) {
      if (hitSurface?.kind === "window" && Array.isArray(room.world?.windows)) {
        const windowEntry = room.world.windows.find((entry) => entry.id === hitSurface.id);
        if (windowEntry && !windowEntry.broken) {
          windowEntry.broken = true;
          upsertWorldCollision(room.world, windowEntry, false);
          registerRoomHeat(room, 0.22, "Window breaches are exposing your route.");
          worldMutated = true;
        }
      } else if (hitSurface?.kind === "crate" && Array.isArray(room.world?.crates)) {
        const crate = room.world.crates.find((entry) => entry.id === hitSurface.id);
        if (crate && !crate.broken) {
          crate.hp = Math.max(0, (crate.hp || 0) - bullet.damage);
          crate.damageStage = getCrateDamageStage(crate);
          if (crate.hp <= 0) {
            crate.broken = true;
            crate.damageStage = 3;
            upsertWorldCollision(room.world, crate, false);
            spawnCrateLoot(room.world, crate);
            registerRoomHeat(room, 0.2, "Crate debris is exposing your route.");
          }
          worldMutated = true;
        }
      }
      combatMutated = true;
      return false;
    }

    for (const enemy of enemyList) {
      if (!enemy || enemy.dead || enemy.hidden || distanceBetween(bullet, enemy) > (enemy.radius || 15) + (bullet.radius || 3)) {
        continue;
      }

      if (enemyShieldBlocksBullet(enemy, bullet)) {
        enemy.shieldHp = Math.max(0, (enemy.shieldHp || 0) - bullet.damage);
        enemy.shieldFlash = 1;
        enemy.braceTimer = Math.max(enemy.braceTimer || 0, 0.95);
        if (enemy.shieldHp <= 0) {
          enemy.shieldEquipped = false;
          enemy.shieldHp = 0;
        }
        emitCombatEvent(COMBAT_EVENT_KIND.HIT, {
          enemyId: enemy.id,
          ownerId: bullet.ownerId || null,
          x: bullet.x,
          y: bullet.y,
          shieldBlocked: true,
          hp: enemy.hp,
          shieldHp: enemy.shieldHp,
          serverTime: now,
        });
        combatMutated = true;
        return false;
      }

      enemy.hp = Math.max(0, (enemy.hp || 0) - bullet.damage);
      enemy.hitFlash = 1;
      enemy.flinchTimer = 0.16;
      enemy.woundSourceAngle = Math.atan2(bullet.vy, bullet.vx);
      emitCombatEvent(COMBAT_EVENT_KIND.HIT, {
        enemyId: enemy.id,
        ownerId: bullet.ownerId || null,
        x: bullet.x,
        y: bullet.y,
        shieldBlocked: false,
        hp: enemy.hp,
        shieldHp: enemy.shieldHp || 0,
        damage: bullet.damage,
        serverTime: now,
      });
      if (enemy.hp <= 0) {
        enemy.dead = true;
        enemy.deadTimer = 5.2;
        enemy.wounded = false;
        enemy.bleedoutTimer = 0;
        enemy.nextBleedDripAt = 0;
        const owner = room.players.get(bullet.ownerId);
        if (owner) {
          owner.resources.cash = Math.max(0, (owner.resources.cash || 0) + 75);
        }
        emitCombatEvent(COMBAT_EVENT_KIND.DEATH, {
          enemyId: enemy.id,
          ownerId: bullet.ownerId || null,
          x: enemy.x,
          y: enemy.y,
          kind: enemy.kind || "guard",
          cashAward: 75,
          serverTime: now,
        });
      }
      combatMutated = true;
      return false;
    }

    return true;
  });

  room.combat.enemyBullets = (Array.isArray(room.combat.enemyBullets) ? room.combat.enemyBullets : []).filter((bullet) => {
    bullet.prevX = bullet.x;
    bullet.prevY = bullet.y;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    const hitSurface = getBulletCollisionSurfaceFromWorld(room.world, bullet);
    if (
      bullet.life <= 0 ||
      bullet.x < 0 ||
      bullet.y < 0 ||
      bullet.x > (room.world?.bounds?.width || WORLD_BOUNDS.width) ||
      bullet.y > (room.world?.bounds?.height || WORLD_BOUNDS.height) ||
      hitSurface
    ) {
      if (hitSurface?.kind === "window" && Array.isArray(room.world?.windows)) {
        const windowEntry = room.world.windows.find((entry) => entry.id === hitSurface.id);
        if (windowEntry && !windowEntry.broken) {
          windowEntry.broken = true;
          upsertWorldCollision(room.world, windowEntry, false);
          registerRoomHeat(room, 0.22, "Window breaches are exposing your route.");
          worldMutated = true;
        }
      } else if (hitSurface?.kind === "crate" && Array.isArray(room.world?.crates)) {
        const crate = room.world.crates.find((entry) => entry.id === hitSurface.id);
        if (crate && !crate.broken) {
          crate.hp = Math.max(0, (crate.hp || 0) - Math.max(6, bullet.damage * 0.6));
          crate.damageStage = getCrateDamageStage(crate);
          if (crate.hp <= 0) {
            crate.broken = true;
            crate.damageStage = 3;
            upsertWorldCollision(room.world, crate, false);
            spawnCrateLoot(room.world, crate);
            registerRoomHeat(room, 0.2, "Crate debris is exposing your route.");
          }
          worldMutated = true;
        }
      }
      combatMutated = true;
      return false;
    }

    for (const player of room.players.values()) {
      if (!player.connected || !player.runtime.initialized || !player.runtime.running || player.runtime.dead) {
        continue;
      }
      if (player.adminFlags.godMode || now < (player.runtime.spawnProtectedUntil || 0)) {
        continue;
      }
      if (distanceBetween(bullet, player.position) > (player.position.radius || 15) + (bullet.radius || 3)) {
        continue;
      }

      const shieldBlocked = playerShieldBlocksBullet(player, bullet);
      applyPlayerCellDamage(player, bulletCellDamage(bullet));
      player.runtime.dead = (player.resources.hp || 0) <= 0;
      if (player.runtime.dead) {
        player.runtime.running = false;
      }

      emitCombatEvent(COMBAT_EVENT_KIND.PLAYER_HIT, {
        playerId: player.id,
        ownerEnemyId: bullet.ownerEnemyId || null,
        x: bullet.x,
        y: bullet.y,
        shieldBlocked,
        hp: player.resources.hp,
        maxHp: player.resources.maxHp,
        shieldHp: player.resources.shieldHp,
        shieldEquipped: player.resources.shieldEquipped,
        serverTime: now,
      });
      combatMutated = true;
      return false;
    }

    return true;
  });

  for (const enemy of enemyList) {
    if (!enemy || enemy.dead || enemy.hidden || enemy.kind === "specimen" || enemy.state !== "hunt") {
      continue;
    }

    const targetInfo = getEnemyRaidTarget(room, enemy);
    if (!targetInfo || targetInfo.distance >= Math.max(0, (enemy.viewRange || 0) - 25)) {
      continue;
    }
    if (targetInfo.player.runtime.invisible) {
      continue;
    }
    if (lineBlockedWorld(room.world, enemy.x, enemy.y, targetInfo.player.position.x, targetInfo.player.position.y)) {
      continue;
    }

    const nextAllowedAt = room.enemyShotLocks.get(enemy.id) || 0;
    if (now < nextAllowedAt) {
      continue;
    }

    const bulletSpeed = enemy.kind === "boss" ? 470 : enemy.kind === "guard" ? 430 : 390;
    const targetVelocity = Math.hypot(targetInfo.player.position.vx || 0, targetInfo.player.position.vy || 0);
    const leadTime = clamp(
      targetInfo.distance / bulletSpeed + targetVelocity / 900,
      0.06,
      enemy.kind === "boss" ? 0.42 : 0.34
    );
    const predictedTarget = {
      x: targetInfo.player.position.x + (targetInfo.player.position.vx || 0) * leadTime * 1.1,
      y: targetInfo.player.position.y + (targetInfo.player.position.vy || 0) * leadTime * 1.1,
    };
    const volleyCount = enemy.kind === "boss" ? 3 : enemy.kind === "guard" ? 2 : 1;
    const baseShotAngle = Math.atan2(predictedTarget.y - enemy.y, predictedTarget.x - enemy.x);
    const rangePenalty = clamp(targetInfo.distance / Math.max(enemy.viewRange || 1, 1), 0, 1);
    const movePenalty = clamp(Math.hypot(enemy.vx || 0, enemy.vy || 0) / 220, 0, 0.04);
    const alertPenalty = enemy.justAlerted ? 0.05 : 0;
    const typePenalty = enemy.kind === "rusher" ? 0.04 : enemy.kind === "guard" ? 0.018 : enemy.kind === "boss" ? 0.01 : 0.03;
    const woundedHuman = Boolean(enemy.wounded && enemy.faction !== "specimen");
    const spreadBase =
      typePenalty +
      rangePenalty * (enemy.kind === "boss" ? 0.02 : 0.045) +
      movePenalty +
      alertPenalty +
      (woundedHuman ? 0.05 + (enemy.woundedSeverity || 0) * 0.06 : 0);
    const shotDelayMs = Math.max(120, ((enemy.fireRate || 0.6) + Math.random() * 0.16) * 1000);

    enemy.aimAngle = baseShotAngle;
    enemy.muzzleFlash = 0.08;
    enemy.strafeBias = typeof enemy.strafeBias === "number" ? enemy.strafeBias * -1 : -1;
    room.enemyShotLocks.set(enemy.id, now + shotDelayMs);

    for (let volley = 0; volley < volleyCount; volley += 1) {
      const spread =
        (volley - (volleyCount - 1) * 0.5) * (enemy.kind === "boss" ? 0.045 : 0.055) +
        (Math.random() - 0.5) * spreadBase * 2;
      const bulletId = `${enemy.id}-${now}-${volley}`;
      room.combat.enemyBullets.push(createEnemyBullet(enemy, enemy.aimAngle + spread, bulletSpeed, bulletId));
    }

    emitCombatEvent(COMBAT_EVENT_KIND.ENEMY_SHOT, {
      enemyId: enemy.id,
      kind: enemy.kind || "guard",
      x: enemy.x,
      y: enemy.y,
      angle: enemy.aimAngle,
      volleyCount,
      serverTime: now,
    });
    registerEncounterSignal(room, {
      x: enemy.x,
      y: enemy.y,
      radius: 220,
      ttlMs: 1200,
    });
    combatMutated = true;
  }

  for (const enemy of enemyList) {
    if (!enemy || enemy.dead || enemy.hidden || enemy.kind !== "specimen" || enemy.state !== "hunt") {
      continue;
    }

    const targetInfo = getClosestLivePlayerForEnemy(room, enemy);
    if (!targetInfo) {
      continue;
    }

    const meleeReach = (enemy.meleeRange || 34) + (targetInfo.player.position.radius || 15) + 2;
    if (targetInfo.distance > meleeReach) {
      continue;
    }

    const nextAllowedAt = room.enemyMeleeLocks.get(enemy.id) || 0;
    if (now < nextAllowedAt) {
      continue;
    }

    room.enemyMeleeLocks.set(enemy.id, now + Math.max(220, (enemy.fireRate || 0.6) * 1000));
    enemy.justAlerted = true;
    enemy.aimAngle = Math.atan2(targetInfo.player.position.y - enemy.y, targetInfo.player.position.x - enemy.x);

    const shieldBlocked = playerShieldBlocksBullet(targetInfo.player, {
      vx: Math.cos(enemy.aimAngle),
      vy: Math.sin(enemy.aimAngle),
    });
    applyPlayerCellDamage(targetInfo.player, enemy.cellDamage || 1);
    targetInfo.player.runtime.dead = (targetInfo.player.resources.hp || 0) <= 0;
    if (targetInfo.player.runtime.dead) {
      targetInfo.player.runtime.running = false;
    }

    emitCombatEvent(COMBAT_EVENT_KIND.PLAYER_HIT, {
      playerId: targetInfo.player.id,
      enemyId: enemy.id,
      x: targetInfo.player.position.x,
      y: targetInfo.player.position.y,
      shieldBlocked,
      melee: true,
      hp: targetInfo.player.resources.hp,
      maxHp: targetInfo.player.resources.maxHp,
      shieldHp: targetInfo.player.resources.shieldHp,
      shieldEquipped: targetInfo.player.resources.shieldEquipped,
      serverTime: now,
    });
    combatMutated = true;
  }

  const initializedRaidPlayers = getConnectedPlayers(room).filter((player) => player.runtime.initialized);
  if (
    initializedRaidPlayers.length > 0 &&
    initializedRaidPlayers.every((player) => player.runtime.dead || !player.runtime.running || (player.resources.hp || 0) <= 0)
  ) {
    if (room.phaseLock !== ROOM_PHASE.FAIL) {
      room.phaseLock = ROOM_PHASE.FAIL;
      emitters.broadcastUiEvent?.(UI_EVENT_KIND.RAID_TRANSITION, {
        mode: "fail",
        message: "Squad wiped before extraction.",
        serverTime: now,
      });
    }
  }

  return { combatMutated, worldMutated };
}

function createAppServer() {
  const room = createRoom();

  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, players: room.players.size }));
      return;
    }

    if (req.url === "/api/assets") {
      const assetRoot = path.join(ROOT, "assets");
      const files = fs.existsSync(assetRoot) ? collectAssetFiles(assetRoot).sort() : [];
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ files }));
      return;
    }

    if (req.url === "/api/save-levels" && req.method === "POST") {
      readJsonBody(req)
        .then((payload) => {
          const levels = payload?.levels;
          if (!levels || typeof levels !== "object" || !Object.keys(levels).length) {
            throw new Error("Missing level payload.");
          }

          const currentSource = fs.readFileSync(APP_JS_PATH, "utf8");
          const nextSource = replaceLevelTemplateBlock(currentSource, renderLevelTemplateBlock(levels));
          fs.writeFileSync(APP_JS_BACKUP_PATH, currentSource, "utf8");
          fs.writeFileSync(APP_JS_PATH, nextSource, "utf8");

          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
          res.end(JSON.stringify({ ok: true, backup: path.basename(APP_JS_BACKUP_PATH) }));
        })
        .catch((error) => {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
          res.end(JSON.stringify({ ok: false, error: error.message || "Failed to save levels." }));
        });
      return;
    }

    const filePath = sanitizeRequestPath(req.url || "/");

    if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const stat = fs.statSync(filePath);
    const range = ext === ".mp3" ? parseRangeHeader(req.headers.range, stat.size) : null;
    const commonHeaders = {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": cacheControlFor(filePath, ext),
      "Accept-Ranges": ext === ".mp3" ? "bytes" : "none",
    };

    if (range) {
      const chunkSize = range.end - range.start + 1;
      res.writeHead(206, {
        ...commonHeaders,
        "Content-Range": `bytes ${range.start}-${range.end}/${stat.size}`,
        "Content-Length": chunkSize,
      });
      fs.createReadStream(filePath, { start: range.start, end: range.end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      ...commonHeaders,
      "Content-Length": stat.size,
    });
    fs.createReadStream(filePath).pipe(res);
  });

  const wss = new WebSocketServer({ server, path: "/ws" });

  function send(socket, payload) {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }

  function sendUiEvent(socket, kind, payload = {}) {
    send(socket, createEventPayload(SERVER_MESSAGE.UI_EVENT, kind, { payload }));
  }

  function broadcastUiEvent(kind, payload = {}) {
    const event = createEventPayload(SERVER_MESSAGE.UI_EVENT, kind, { payload });
    for (const client of wss.clients) {
      send(client, event);
    }
  }

  function broadcastWorldMutation(action) {
    room.worldVersion += 1;
    const worldEvent = createEventPayload(SERVER_MESSAGE.WORLD_EVENT, action.type || WORLD_EVENT_KIND.SYNC, {
      world: room.world,
      worldVersion: room.worldVersion,
      payload: action,
    });
    for (const client of wss.clients) {
      send(client, worldEvent);
    }
    broadcastSnapshot();
  }

  function broadcastCombatEvent(kind, payload = {}) {
    const event = createEventPayload(SERVER_MESSAGE.COMBAT_EVENT, kind, { payload });
    for (const client of wss.clients) {
      send(client, event);
    }
  }

  function applyInteractAction(player) {
    if (!player?.connected || !room.world || room.phaseLock === ROOM_PHASE.SUCCESS || room.phaseLock === ROOM_PHASE.FAIL) {
      return false;
    }

    const actorPosition = {
      x: player.position.x,
      y: player.position.y,
    };
    const nearbyDoor = getNearbyDoor(room.world, actorPosition);
    if (nearbyDoor) {
      nearbyDoor.open = !nearbyDoor.open;
      upsertWorldCollision(room.world, nearbyDoor, !nearbyDoor.open);
      sendUiEvent(player.socket, UI_EVENT_KIND.STATUS_MESSAGE, {
        message: nearbyDoor.open ? "Service door opened." : "Service door closed.",
        serverTime: Date.now(),
      });
      broadcastWorldMutation({
        type: WORLD_EVENT_KIND.DOOR,
        id: nearbyDoor.id,
        open: nearbyDoor.open,
      });
      return true;
    }

    if (Array.isArray(room.world.loot)) {
      for (const loot of room.world.loot) {
        if (loot.collected || distanceBetween(actorPosition, loot) > 58) {
          continue;
        }

        let pickupMessage = "";
        if (loot.type === "shield") {
          const loadout = getClassLoadout(player.meta.className);
          if (!loadout.canUseShield || !(loadout.shieldCells > 0)) {
            sendUiEvent(player.socket, UI_EVENT_KIND.STATUS_MESSAGE, {
              message: "This class cannot use shields.",
              serverTime: Date.now(),
            });
            return true;
          }
          player.resources.shieldEquipped = true;
          player.resources.shieldHp = loadout.shieldCells;
          pickupMessage = "Shield cells locked in.";
        } else if (loot.type === "medkit") {
          player.resources.medkits = Math.max(0, (player.resources.medkits || 0) + (Number(loot.value) || 0));
          pickupMessage = "Field medkit secured.";
        } else if (loot.type === "noise") {
          player.resources.noiseCharges = Math.max(0, (player.resources.noiseCharges || 0) + (Number(loot.value) || 0));
          pickupMessage = "Noise maker secured.";
        } else if (loot.type === "cash") {
          player.resources.cash = Math.max(0, (player.resources.cash || 0) + (Number(loot.value) || 0));
          pickupMessage = `Cash recovered: $${Number(loot.value) || 0}.`;
        } else if (loot.type === "core") {
          pickupMessage = `Objective secured. ${Math.max(0, (Number(room.world.requiredLoot) || 0) - (getCollectedCoreCount(room.world) + 1))} remaining.`;
        } else {
          player.resources.cash = Math.max(0, (player.resources.cash || 0) + (Number(loot.value) || 0));
          pickupMessage = `Cash recovered: $${Number(loot.value) || 0}.`;
        }

        loot.collected = true;
        sendUiEvent(player.socket, UI_EVENT_KIND.STATUS_MESSAGE, {
          message: pickupMessage,
          serverTime: Date.now(),
        });
        broadcastWorldMutation({
          type: WORLD_EVENT_KIND.LOOT,
          id: loot.id,
          collected: true,
        });
        return true;
      }
    }

    if (rectContains(room.world.extractionZone, actorPosition.x, actorPosition.y)) {
      if ((Number(room.world.requiredLoot) || 0) > getCollectedCoreCount(room.world)) {
        sendUiEvent(player.socket, UI_EVENT_KIND.STATUS_MESSAGE, {
          message: "Extraction gate locked. Secure the remaining objective cargo.",
          serverTime: Date.now(),
        });
        return true;
      }

      if (room.world.bossRequired && hasLiveBoss(room)) {
        sendUiEvent(player.socket, UI_EVENT_KIND.STATUS_MESSAGE, {
          message: "The Warden is still active. Drop the boss before exfil.",
          serverTime: Date.now(),
        });
        return true;
      }

      const raidPlayers = getConnectedRaidPlayers(room);
      const everyoneReady = raidPlayers.length > 0 && raidPlayers.every((entry) => rectContains(room.world.extractionZone, entry.position.x, entry.position.y));
      if (!everyoneReady) {
        sendUiEvent(player.socket, UI_EVENT_KIND.STATUS_MESSAGE, {
          message: "Need the whole squad inside the evac zone.",
          serverTime: Date.now(),
        });
        return true;
      }

      for (const entry of raidPlayers) {
        entry.runtime.running = false;
      }

      if (room.world.nextLevelId) {
        room.phaseLock = ROOM_PHASE.BREACH_SHOP;
        room.phase = ROOM_PHASE.BREACH_SHOP;
        broadcastUiEvent(UI_EVENT_KIND.RAID_TRANSITION, {
          mode: "breach_shop",
          nextLevelId: room.world.nextLevelId,
          serverTime: Date.now(),
        });
      } else {
        room.phaseLock = ROOM_PHASE.SUCCESS;
        room.phase = ROOM_PHASE.SUCCESS;
        broadcastUiEvent(UI_EVENT_KIND.RAID_TRANSITION, {
          mode: "success",
          message: "Extraction successful.",
          serverTime: Date.now(),
        });
      }
      broadcastSnapshot();
      return true;
    }

    return false;
  }

  function buildSnapshot(kind) {
    const players = getConnectedPlayers(room).map(getPlayerSnapshot);
    return createSnapshotPayload(kind, {
      roomId: room.id,
      seed: room.seed,
      players,
      world: room.world,
      combat: room.combat,
      hostId: room.hostId,
      phase: room.phase,
      snapshotSequence: ++room.snapshotSequence,
      worldVersion: room.worldVersion,
      combatVersion: room.combatVersion,
      levelVersion: room.levelVersion,
      playerCount: players.length,
      serverTime: Date.now(),
    });
  }

  function sendSnapshot(socket, kind = SERVER_MESSAGE.DELTA_SNAPSHOT) {
    send(socket, buildSnapshot(kind));
  }

  function broadcastSnapshot() {
    const snapshot = buildSnapshot(SERVER_MESSAGE.DELTA_SNAPSHOT);

    for (const client of wss.clients) {
      send(client, snapshot);
    }
  }

  function sendWelcome(socket, player) {
    send(
      socket,
      createWelcomePayload({
        id: player.id,
        roomId: room.id,
        phase: room.phase,
        isHost: room.hostId === player.id,
        reconnectToken: player.reconnectToken,
        maxPlayers: MULTIPLAYER.maxPlayers,
        needsWorld: room.hostId === player.id && !room.world,
      })
    );
    sendSnapshot(socket, SERVER_MESSAGE.FULL_SNAPSHOT);
  }

  function resetRestartState() {
    room.restart.readyIds.clear();
    room.restart.phase = "idle";
  }

  function recomputeRoomPhase() {
    if (room.restart.phase === "restarting") {
      room.phase = ROOM_PHASE.RESTARTING;
      return;
    }
    if (room.restart.phase === "waiting") {
      room.phase = ROOM_PHASE.RESTART_WAIT;
      return;
    }
    if (room.phaseLock) {
      room.phase = room.phaseLock;
      return;
    }
    room.phase = getConnectedPlayers(room).some((player) => player.runtime.running) ? ROOM_PHASE.RUNNING : ROOM_PHASE.LOBBY;
  }

  function broadcastRestartStatus(message = "") {
    const payload = createEventPayload(SERVER_MESSAGE.UI_EVENT, UI_EVENT_KIND.RESTART_STATUS, {
      payload: {
        phase: room.restart.phase,
        readyIds: Array.from(room.restart.readyIds),
        playerCount: getConnectedPlayers(room).length,
        hostId: room.hostId,
        message,
        serverTime: Date.now(),
      },
    });
    for (const client of wss.clients) {
      send(client, payload);
    }
  }

  function commitRestart() {
    room.phase = ROOM_PHASE.RESTARTING;
    room.phaseLock = null;
    room.world = null;
    room.combat = null;
    room.enemyMeleeLocks.clear();
    room.enemyShotLocks.clear();
    room.enemyAlertLocks.clear();
    room.recentSignals = [];
    room.levelVersion += 1;
    room.worldVersion += 1;
    room.combatVersion += 1;
    for (const player of room.players.values()) {
      player.runtime.running = false;
      player.runtime.initialized = false;
      player.runtime.invisible = false;
      player.runtime.quietMode = false;
      player.runtime.processedInputSeq = 0;
      player.runtime.nextShootAt = 0;
      player.runtime.nextMedkitAt = 0;
      player.runtime.nextNoiseAt = 0;
      player.runtime.nextTakedownAt = 0;
      player.runtime.reloadCompleteAt = 0;
      player.runtime.abilityActiveUntil = 0;
      player.runtime.abilityCooldownUntil = 0;
      player.position.vx = 0;
      player.position.vy = 0;
    }
    const payload = createEventPayload(SERVER_MESSAGE.UI_EVENT, UI_EVENT_KIND.RESTART_COMMIT, {
      payload: {
        readyIds: Array.from(room.restart.readyIds),
        playerCount: getConnectedPlayers(room).length,
        hostId: room.hostId,
        worldVersion: room.worldVersion,
        combatVersion: room.combatVersion,
        levelVersion: room.levelVersion,
        serverTime: Date.now(),
      },
    });
    resetRestartState();
    for (const client of wss.clients) {
      send(client, payload);
    }
  }

  function sendHostHandoff(nextHostId) {
    if (!nextHostId) {
      return;
    }

    const nextHost = room.players.get(nextHostId);
    if (!nextHost?.socket || !nextHost.connected) {
      return;
    }

    send(
      nextHost.socket,
      createEventPayload(SERVER_MESSAGE.UI_EVENT, UI_EVENT_KIND.HOST_HANDOFF, {
        payload: {
          id: nextHostId,
          world: room.world,
          combat: room.combat,
          worldVersion: room.worldVersion,
          combatVersion: room.combatVersion,
          levelVersion: room.levelVersion,
        },
      })
    );
  }

  function getNextConnectedHostId(excludeId = null) {
    for (const player of room.players.values()) {
      if (!player.connected || player.id === excludeId) {
        continue;
      }
      return player.id;
    }
    return null;
  }

  function removePlayer(playerId, options = {}) {
    const player = room.players.get(playerId);
    if (!player) {
      return;
    }

    if (options.disconnectOnly) {
      player.connected = false;
      player.socket = null;
      player.runtime.running = false;
      player.runtime.updatedAt = Date.now();
      room.restart.readyIds.delete(playerId);
    } else {
      room.players.delete(playerId);
      room.restart.readyIds.delete(playerId);
    }

    if (!options.disconnectOnly && options.closeSocket !== false) {
      try {
        player.socket?.close();
      } catch {}
    }

    if (room.hostId === playerId) {
      room.hostId = getNextConnectedHostId(playerId);
      sendHostHandoff(room.hostId);
    }

    if (!room.hostId) {
      room.combat = null;
      room.world = null;
      room.enemyMeleeLocks.clear();
      room.enemyShotLocks.clear();
      room.enemyAlertLocks.clear();
      room.recentSignals = [];
      room.phase = ROOM_PHASE.LOBBY;
      room.phaseLock = null;
      resetRestartState();
      room.worldVersion += 1;
      room.combatVersion += 1;
    }

    recomputeRoomPhase();
    if (getConnectedPlayers(room).length > 0) {
      broadcastRestartStatus(room.restart.readyIds.size ? "Restart room updated." : "");
    }
    broadcastSnapshot();
  }

  const snapshotTimer = setInterval(broadcastSnapshot, MULTIPLAYER.snapshotRateMs);
  const simulationTimer = setInterval(() => {
    simulatePlayers(room);
    const playerCombatMutated = processPlayerCombatActions(room, {
      broadcastCombatEvent,
    });
    const { combatMutated: enemyCombatMutated, worldMutated: enemyWorldMutated } = simulateEnemyAuthority(room, MULTIPLAYER.tickRateMs / 1000);
    const { combatMutated, worldMutated } = simulateAuthoritativeCombat(room, MULTIPLAYER.tickRateMs / 1000, {
      broadcastCombatEvent,
      broadcastUiEvent,
    });
    const encounterMutated = updateEncounterAuthority(room);
    if (playerCombatMutated || enemyCombatMutated || combatMutated || encounterMutated) {
      room.combatVersion += 1;
    }
    if (enemyWorldMutated || worldMutated) {
      room.worldVersion += 1;
    }
    recomputeRoomPhase();
    if (playerCombatMutated || enemyCombatMutated || combatMutated || enemyWorldMutated || worldMutated || encounterMutated) {
      broadcastSnapshot();
    }
  }, MULTIPLAYER.tickRateMs);
  const stalePlayerTimer = setInterval(() => {
    const now = Date.now();
    for (const player of Array.from(room.players.values())) {
      if (!player.connected && now - player.runtime.updatedAt > STALE_PLAYER_TIMEOUT_MS) {
        removePlayer(player.id);
        continue;
      }
      if (player.connected && now - player.runtime.updatedAt > STALE_PLAYER_TIMEOUT_MS * 2) {
        removePlayer(player.id);
      }
    }
  }, 2000);

  wss.on("connection", (socket) => {
    if (getConnectedPlayers(room).length >= MULTIPLAYER.maxPlayers) {
      socket.close(1013, "Room full");
      return;
    }

    const id = `p_${Math.random().toString(36).slice(2, 10)}`;
    let player = createPlayerRecord(id, socket);

    room.players.set(id, player);
    if (!room.hostId) {
      room.hostId = id;
    }

    sendWelcome(socket, player);
    broadcastSnapshot();

    socket.on("message", (raw) => {
      let message;
      try {
        message = JSON.parse(String(raw));
      } catch {
        return;
      }

      if (message.type === CLIENT_MESSAGE.HELLO || message.type === "hello") {
        const reconnectToken =
          typeof message.reconnectToken === "string" && message.reconnectToken
            ? message.reconnectToken
            : typeof message.reconnectKey === "string" && message.reconnectKey
              ? message.reconnectKey
              : null;
        if (reconnectToken) {
          const reboundPlayer = Array.from(room.players.values()).find(
            (entry) => entry.id !== player.id && entry.reconnectToken === reconnectToken && !entry.connected
          );
          if (reboundPlayer) {
            room.players.delete(player.id);
            player = reboundPlayer;
            player.socket = socket;
            player.connected = true;
            player.sessionId = `${player.id}-${Date.now().toString(36)}`;
            player.runtime.updatedAt = Date.now();
            room.players.set(player.id, player);
          } else {
            player.reconnectToken = reconnectToken;
          }
        }
        applyHelloState(player, message);
        sendWelcome(socket, player);
        recomputeRoomPhase();
        broadcastSnapshot();
        return;
      }

      if ((message.type === CLIENT_MESSAGE.WORLD_INIT || message.type === "world_init") && message.world && player.id === room.hostId) {
        room.world = normalizeWorldState(message.world);
        room.combat = createEmptyCombatState(room.world?.layoutId || "freight");
        room.enemyMeleeLocks.clear();
        room.enemyShotLocks.clear();
        room.enemyAlertLocks.clear();
        room.recentSignals = [];
        room.phaseLock = null;
        room.worldVersion += 1;
        room.combatVersion += 1;
        recomputeRoomPhase();
        broadcastSnapshot();
        return;
      }

      if (message.type === CLIENT_MESSAGE.RESTART_REQUEST || message.type === "restart_request") {
        room.restart.readyIds.add(player.id);
        room.restart.phase = "waiting";
        recomputeRoomPhase();
        const connectedCount = getConnectedPlayers(room).length;
        broadcastRestartStatus(room.restart.readyIds.size >= connectedCount ? "All players ready." : "Restart request received.");
        if ((message.force && player.id === room.hostId) || (connectedCount > 0 && room.restart.readyIds.size >= connectedCount)) {
          room.restart.phase = "restarting";
          commitRestart();
        }
        return;
      }

      if ((message.type === CLIENT_MESSAGE.COMBAT_STATE || message.type === "combat_state") && message.combat && player.id === room.hostId) {
        room.combat = mergeCombatState(room.combat, message.combat);
        room.combatVersion += 1;
        return;
      }

      if ((message.type === CLIENT_MESSAGE.WORLD_ACTION || message.type === "world_action") && message.action && room.world && player.id === room.hostId) {
        const { action } = message;

        if (action.type === "door" && Array.isArray(room.world.doors)) {
          const door = room.world.doors.find((entry) => entry.id === action.id);
          if (door) {
            door.open = Boolean(action.open);
            upsertWorldCollision(room.world, door, !door.open);
          }
        }

        if (action.type === "window" && Array.isArray(room.world.windows)) {
          const windowEntry = room.world.windows.find((entry) => entry.id === action.id);
          if (windowEntry) {
            windowEntry.broken = Boolean(action.broken);
            upsertWorldCollision(room.world, windowEntry, !windowEntry.broken);
          }
        }

        if (action.type === "loot" && Array.isArray(room.world.loot)) {
          const loot = room.world.loot.find((entry) => entry.id === action.id);
          if (loot) {
            loot.collected = Boolean(action.collected);
          }
        }
        room.worldVersion += 1;
        const worldEvent = createEventPayload(SERVER_MESSAGE.WORLD_EVENT, action.type || WORLD_EVENT_KIND.SYNC, {
          world: room.world,
          worldVersion: room.worldVersion,
          payload: action,
        });
        for (const client of wss.clients) {
          send(client, worldEvent);
        }
        broadcastSnapshot();
        return;
      }

      const playerRequest =
        message.type === CLIENT_MESSAGE.ACTION_REQUEST || message.type === "action_request"
          ? message.action || message.request
          : message.type === "player_request"
            ? message.request
            : message.type === "player_action"
              ? message.action
              : null;
      if (playerRequest?.type === "interact") {
        applyInteractAction(player);
        recomputeRoomPhase();
        return;
      }
      if (playerRequest && PLAYER_REQUEST_TYPES.has(playerRequest.type)) {
        return;
      }
      if (
        playerRequest &&
        room.hostId &&
        room.hostId !== player.id &&
        PLAYER_REQUEST_TYPES.has(playerRequest.type)
      ) {
        const host = room.players.get(room.hostId);
        if (host?.socket) {
          send(host.socket, { type: "action_request", playerId: player.id, action: playerRequest });
        }
        return;
      }

      if (message.type === "player_patch" && message.playerId && message.patch && player.id === room.hostId) {
        const target = room.players.get(message.playerId);
        if (target) {
          applyPlayerPatch(target, message.patch);
          target.runtime.updatedAt = Date.now();
          target.runtime.dead = (target.resources.hp || 0) <= 0;
          broadcastSnapshot();
        }
        return;
      }

      if ((message.type === CLIENT_MESSAGE.INPUT_FRAME || message.type === "input_frame") && message.input) {
        applyInputFrame(player, message.input, room, message.seq);
        recomputeRoomPhase();
        return;
      }

      if (message.type === "input_state" && message.input) {
        applyInputFrame(player, message.input, room, message.seq);
        recomputeRoomPhase();
        return;
      }

      if (message.type === "player_state" && message.state) {
        applyInputFrame(player, { ...message.state, state: message.state }, room, message.seq);
        recomputeRoomPhase();
      }
    });

    socket.on("close", () => {
      removePlayer(player.id, { closeSocket: false, disconnectOnly: true });
    });
  });

  server.on("close", () => {
    clearInterval(snapshotTimer);
    clearInterval(simulationTimer);
    clearInterval(stalePlayerTimer);
    wss.close();
  });

  return server;
}

module.exports = {
  createAppServer,
};

if (require.main === module) {
  const server = createAppServer();
  const port = Number(process.env.PORT) || MULTIPLAYER.port;
  server.listen(port, "0.0.0.0", () => {
    console.log(`Multiplayer server listening on http://0.0.0.0:${port}`);
  });
}
