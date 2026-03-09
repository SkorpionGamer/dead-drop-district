const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const startOverlay = document.querySelector("#start-overlay");
const endOverlay = document.querySelector("#end-overlay");
const startButton = document.querySelector("#start-button");
const restartButton = document.querySelector("#restart-button");
const classCards = Array.from(document.querySelectorAll(".class-card"));
const endTag = document.querySelector("#end-tag");
const endTitle = document.querySelector("#end-title");
const endSummary = document.querySelector("#end-summary");
const reticle = document.querySelector("#reticle");
const interactPrompt = document.querySelector("#interact-prompt");

const timerValue = document.querySelector("#timer-value");
const lootValue = document.querySelector("#loot-value");
const cashValue = document.querySelector("#cash-value");
const heatValue = document.querySelector("#heat-value");
const healthValue = document.querySelector("#health-value");
const healthFill = document.querySelector("#health-fill");
const ammoValue = document.querySelector("#ammo-value");
const ammoFill = document.querySelector("#ammo-fill");
const shieldValue = document.querySelector("#shield-value");
const shieldFill = document.querySelector("#shield-fill");
const stealthValue = document.querySelector("#stealth-value");
const medkitValue = document.querySelector("#medkit-value");
const noiseValue = document.querySelector("#noise-value");
const statusText = document.querySelector("#status-text");

const WORLD = {
  width: 2600,
  height: 1800,
};

const CAMERA_ZOOM = 1.18;
const SPRITE_SCALE = 1.14;

const keys = new Set();
const pointer = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  worldX: WORLD.width / 2,
  worldY: WORLD.height / 2,
  down: false,
};

let gameState = null;
let lastTime = 0;
let animationFrameId = 0;
let audioContext = null;
let masterGain = null;
let selectedClass = "stealther";
const spriteCache = {};
let musicGain = null;
let gameMusicGain = null;
let introMusicTimer = 0;
let introMusicActive = false;
let introMusicNextBarTime = 0;
let gameMusicTimer = 0;
let gameMusicActive = false;
let gameMusicNextBarTime = 0;
let preferredMusicMode = "intro";

const CLASS_LOADOUTS = {
  stealther: {
    name: "Stealther",
    weaponLabel: "Suppressed Sidearm",
    ammo: 12,
    shotRate: 0.18,
    reloadTime: 0.95,
    bulletSpeed: 600,
    damage: 20,
    pellets: 1,
    spread: 0.018,
    recoil: 0.72,
    soundRadius: 135,
    speed: 182,
    sprintSpeed: 268,
    medkits: 1,
    noiseCharges: 2,
    quietMultiplier: 0.48,
    cash: 60,
  },
  breacher: {
    name: "Breacher",
    weaponLabel: "Shotgun",
    ammo: 6,
    shotRate: 0.54,
    reloadTime: 1.2,
    bulletSpeed: 560,
    damage: 11,
    pellets: 5,
    spread: 0.18,
    recoil: 1.15,
    soundRadius: 300,
    speed: 166,
    sprintSpeed: 246,
    medkits: 1,
    noiseCharges: 0,
    quietMultiplier: 0.62,
    cash: 0,
  },
  marksman: {
    name: "Marksman",
    weaponLabel: "Carbine",
    ammo: 20,
    shotRate: 0.26,
    reloadTime: 1.05,
    bulletSpeed: 690,
    damage: 29,
    pellets: 1,
    spread: 0.01,
    recoil: 0.84,
    soundRadius: 235,
    speed: 172,
    sprintSpeed: 252,
    medkits: 0,
    noiseCharges: 1,
    quietMultiplier: 0.56,
    cash: 90,
  },
};

const CHARACTER_SPRITES = {
  stealther: "assets/characters/stealther_Nero_AI_Background_Remover_transparent.png",
  breacher: "assets/characters/breacher_Nero_AI_Background_Remover_transparent.png",
  marksman: "assets/characters/marksman_Nero_AI_Background_Remover_transparent.png",
  enemy_guard: "assets/characters/enemy_guard_Nero_AI_Background_Remover_transparent.png",
  enemy_rusher: "assets/characters/enemy_rusher_Nero_AI_Background_Remover_transparent.png",
};

function updateClassSelectionUi() {
  for (const card of classCards) {
    card.classList.toggle("is-selected", card.dataset.class === selectedClass);
  }
}

function loadSprite(path) {
  if (spriteCache[path]) {
    return spriteCache[path];
  }

  const image = new Image();
  image.src = path;
  spriteCache[path] = image;
  return image;
}

function getSpriteForPlayer(player) {
  return loadSprite(CHARACTER_SPRITES[player.weapon.className] || CHARACTER_SPRITES.stealther);
}

function getSpriteForEnemy(enemy) {
  return loadSprite(enemy.kind === "guard" ? CHARACTER_SPRITES.enemy_guard : CHARACTER_SPRITES.enemy_rusher);
}

function drawCharacterSprite(image, x, y, angle, width, height) {
  if (!image || !image.complete || !image.naturalWidth) {
    return false;
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI * 0.5);
  ctx.drawImage(image, -(width * SPRITE_SCALE) * 0.5, -(height * SPRITE_SCALE) * 0.5, width * SPRITE_SCALE, height * SPRITE_SCALE);
  ctx.restore();
  return true;
}

function setStatusMessage(message) {
  if (!gameState) {
    statusText.textContent = message;
    return;
  }

  gameState.message = message;
  statusText.textContent = message;
}

function selectClass(className) {
  selectedClass = CLASS_LOADOUTS[className] ? className : "stealther";
  updateClassSelectionUi();

  if (!gameState?.running) {
    resetGame();
    setStatusMessage(`${CLASS_LOADOUTS[selectedClass].name} staged. ${CLASS_LOADOUTS[selectedClass].weaponLabel} ready.`);
    syncHud();
  }
}

const obstacles = [
  { x: 180, y: 150, w: 220, h: 120 },
  { x: 520, y: 120, w: 160, h: 260 },
  { x: 810, y: 220, w: 260, h: 140 },
  { x: 1180, y: 120, w: 200, h: 200 },
  { x: 1480, y: 180, w: 170, h: 300 },
  { x: 1760, y: 120, w: 210, h: 220 },
  { x: 2060, y: 140, w: 300, h: 150 },
  { x: 260, y: 520, w: 170, h: 240 },
  { x: 1030, y: 520, w: 180, h: 260 },
  { x: 1320, y: 620, w: 250, h: 180 },
  { x: 1730, y: 520, w: 220, h: 230 },
  { x: 220, y: 880, w: 260, h: 160 },
  { x: 640, y: 900, w: 220, h: 150 },
  { x: 1020, y: 900, w: 280, h: 160 },
  { x: 1540, y: 900, w: 220, h: 170 },
  { x: 1860, y: 860, w: 180, h: 280 },
  { x: 2140, y: 850, w: 280, h: 170 },
  { x: 260, y: 1240, w: 280, h: 180 },
  { x: 700, y: 1300, w: 230, h: 160 },
  { x: 1560, y: 1280, w: 240, h: 240 },
  { x: 1940, y: 1320, w: 300, h: 170 },
];

function createBuilding({ id, label, x, y, w, h, door, windows, squadSpawns }) {
  const thickness = 12;

  const toRect = (entry, kind) => {
    if (entry.side === "north" || entry.side === "south") {
      return {
        id: `${id}-${entry.id || kind}`,
        side: entry.side,
        x: x + entry.offset,
        y: entry.side === "north" ? y : y + h - thickness,
        w: entry.size,
        h: thickness,
        kind,
      };
    }

    return {
      id: `${id}-${entry.id || kind}`,
      side: entry.side,
      x: entry.side === "west" ? x : x + w - thickness,
      y: y + entry.offset,
      w: thickness,
      h: entry.size,
      kind,
    };
  };

  return {
    id,
    label,
    x,
    y,
    w,
    h,
    door: { ...toRect({ ...door, id: "door" }, "door"), open: false },
    windows: windows.map((window) => ({ ...toRect(window, "window"), broken: false })),
    squadSpawns,
  };
}

const buildings = [
  createBuilding({
    id: "service",
    label: "service room",
    x: 620,
    y: 540,
    w: 280,
    h: 180,
    door: { side: "south", offset: 110, size: 60 },
    windows: [
      { id: "north-west", side: "north", offset: 42, size: 48 },
      { id: "north-east", side: "north", offset: 186, size: 48 },
    ],
    squadSpawns: [
      { x: 695, y: 610, kind: "rusher", tactic: "assault", squadRole: "breacher" },
      { x: 768, y: 612, kind: "guard", tactic: "anchor", shield: true, squadRole: "shieldLead" },
      { x: 836, y: 636, kind: "rusher", tactic: "flankRight", squadRole: "flankRight" },
    ],
  }),
  createBuilding({
    id: "records",
    label: "records office",
    x: 1080,
    y: 1260,
    w: 320,
    h: 190,
    door: { side: "west", offset: 72, size: 62 },
    windows: [
      { id: "north-left", side: "north", offset: 56, size: 54 },
      { id: "north-right", side: "north", offset: 210, size: 54 },
    ],
    squadSpawns: [
      { x: 1160, y: 1338, kind: "guard", tactic: "anchor", shield: true, squadRole: "shieldLead" },
      { x: 1248, y: 1324, kind: "rusher", tactic: "flankLeft", squadRole: "flankLeft" },
      { x: 1320, y: 1386, kind: "rusher", tactic: "assault", squadRole: "breacher" },
    ],
  }),
  createBuilding({
    id: "depot",
    label: "loading depot",
    x: 2060,
    y: 470,
    w: 280,
    h: 180,
    door: { side: "south", offset: 104, size: 64 },
    windows: [
      { id: "north-left", side: "north", offset: 40, size: 48 },
      { id: "east-slit", side: "east", offset: 42, size: 46 },
    ],
    squadSpawns: [
      { x: 2140, y: 548, kind: "guard", tactic: "anchor", shield: true, squadRole: "shieldLead" },
      { x: 2206, y: 608, kind: "rusher", tactic: "flankRight", squadRole: "flankRight" },
      { x: 2276, y: 560, kind: "rusher", tactic: "flankLeft", squadRole: "flankLeft" },
    ],
  }),
];

const extractionZone = { x: 2370, y: 1540, w: 180, h: 150 };
const spawnPools = {
  player: [
    { x: 120, y: 1520 },
    { x: 130, y: 980 },
    { x: 170, y: 430 },
    { x: 300, y: 1640 },
  ],
  core: [
    { x: 470, y: 390 },
    { x: 760, y: 460 },
    { x: 1120, y: 430 },
    { x: 1430, y: 545 },
    { x: 560, y: 815 },
    { x: 940, y: 815 },
    { x: 1440, y: 900 },
    { x: 1760, y: 420 },
    { x: 2140, y: 620 },
    { x: 760, y: 1180 },
    { x: 1700, y: 1160 },
    { x: 2260, y: 1400 },
  ],
  shield: [
    { x: 420, y: 980 },
    { x: 1280, y: 720 },
    { x: 1840, y: 1180 },
    { x: 2280, y: 620 },
  ],
  medkit: [
    { x: 558, y: 664 },
    { x: 1188, y: 1360 },
    { x: 1760, y: 1180 },
    { x: 2148, y: 564 },
  ],
  noise: [
    { x: 848, y: 628 },
    { x: 1318, y: 1366 },
    { x: 1640, y: 420 },
    { x: 2230, y: 612 },
  ],
  cash: [
    { x: 330, y: 820 },
    { x: 510, y: 470 },
    { x: 720, y: 820 },
    { x: 930, y: 392 },
    { x: 1120, y: 830 },
    { x: 1410, y: 540 },
    { x: 1490, y: 890 },
    { x: 1670, y: 520 },
    { x: 860, y: 1080 },
    { x: 560, y: 1080 },
    { x: 1830, y: 320 },
    { x: 2230, y: 370 },
    { x: 1830, y: 810 },
    { x: 2320, y: 1080 },
    { x: 610, y: 1510 },
    { x: 1220, y: 1440 },
    { x: 1860, y: 1430 },
    { x: 2260, y: 1540 },
  ],
  enemy: [
    { x: 150, y: 310 },
    { x: 470, y: 470 },
    { x: 720, y: 790 },
    { x: 1100, y: 390 },
    { x: 950, y: 820 },
    { x: 1250, y: 390 },
    { x: 1430, y: 540 },
    { x: 1470, y: 900 },
    { x: 1640, y: 500 },
    { x: 1110, y: 1080 },
    { x: 1930, y: 280 },
    { x: 2210, y: 540 },
    { x: 1860, y: 980 },
    { x: 760, y: 1440 },
    { x: 1660, y: 1420 },
    { x: 2200, y: 1370 },
  ],
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleTo(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x);
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

function turnToward(current, target, maxStep) {
  const delta = normalizeAngle(target - current);
  const step = clamp(delta, -maxStep, maxStep);
  return normalizeAngle(current + step);
}

function rectContains(rect, x, y) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
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

function resetBuildingState() {
  for (const building of buildings) {
    building.door.open = false;
    for (const window of building.windows) {
      window.broken = false;
    }
  }
}

function addWallSegments(segments, side, originX, originY, length, openings) {
  const thickness = 12;
  let cursor = 0;
  const ordered = openings
    .slice()
    .sort((a, b) => (side === "north" || side === "south" ? a.x - b.x : a.y - b.y));

  for (const opening of ordered) {
    const start = side === "north" || side === "south" ? opening.x - originX : opening.y - originY;
    const openingLength = side === "north" || side === "south" ? opening.w : opening.h;

    if (start > cursor) {
      segments.push(
        side === "north" || side === "south"
          ? { x: originX + cursor, y: originY, w: start - cursor, h: thickness, kind: "wall" }
          : { x: originX, y: originY + cursor, w: thickness, h: start - cursor, kind: "wall" }
      );
    }

    cursor = Math.max(cursor, start + openingLength);
  }

  if (cursor < length) {
    segments.push(
      side === "north" || side === "south"
        ? { x: originX + cursor, y: originY, w: length - cursor, h: thickness, kind: "wall" }
        : { x: originX, y: originY + cursor, w: thickness, h: length - cursor, kind: "wall" }
    );
  }
}

function getBuildingSegments() {
  const segments = [];

  for (const building of buildings) {
    const northOpenings = [
      ...building.windows.filter((window) => window.side === "north"),
      ...(building.door.side === "north" ? [building.door] : []),
    ];
    const southOpenings = [
      ...building.windows.filter((window) => window.side === "south"),
      ...(building.door.side === "south" ? [building.door] : []),
    ];
    const westOpenings = [
      ...building.windows.filter((window) => window.side === "west"),
      ...(building.door.side === "west" ? [building.door] : []),
    ];
    const eastOpenings = [
      ...building.windows.filter((window) => window.side === "east"),
      ...(building.door.side === "east" ? [building.door] : []),
    ];

    addWallSegments(
      segments,
      "north",
      building.x,
      building.y,
      building.w,
      northOpenings
    );
    addWallSegments(
      segments,
      "south",
      building.x,
      building.y + building.h - 12,
      building.w,
      southOpenings
    );
    addWallSegments(
      segments,
      "west",
      building.x,
      building.y,
      building.h,
      westOpenings
    );
    addWallSegments(
      segments,
      "east",
      building.x + building.w - 12,
      building.y,
      building.h,
      eastOpenings
    );

    if (!building.door.open) {
      segments.push({ ...building.door });
    }

    for (const window of building.windows) {
      if (!window.broken) {
        segments.push({ ...window });
      }
    }
  }

  return segments.filter((segment, index, source) => {
    if (segment.kind === "wall") {
      return true;
    }

    return source.findIndex((entry) => entry.id === segment.id) === index;
  });
}

function getWorldObstacles() {
  return [...obstacles, ...getBuildingSegments()];
}

function getNearbyDoor(player, radius = 64) {
  for (const building of buildings) {
    const center = {
      x: building.door.x + building.door.w * 0.5,
      y: building.door.y + building.door.h * 0.5,
    };

    if (distance(player, center) <= radius) {
      return building.door;
    }
  }

  return null;
}

function findWindowById(windowId) {
  for (const building of buildings) {
    const match = building.windows.find((window) => window.id === windowId);
    if (match) {
      return match;
    }
  }

  return null;
}

function circleIntersectsRect(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy < circle.r * circle.r;
}

function lineBlocked(fromX, fromY, toX, toY) {
  return getWorldObstacles().some((obstacle) => segmentIntersectsRect(fromX, fromY, toX, toY, obstacle));
}

function positionBlocked(entity, x, y) {
  const probe = { x, y, r: entity.radius };

  if (x - entity.radius < 0 || y - entity.radius < 0 || x + entity.radius > WORLD.width || y + entity.radius > WORLD.height) {
    return true;
  }

  return getWorldObstacles().some((obstacle) => circleIntersectsRect(probe, obstacle));
}

function createProbe(radius) {
  return { radius };
}

function isSpawnValid(candidate, radius, occupied = [], extraPadding = 18) {
  const probe = createProbe(radius + extraPadding);

  if (positionBlocked(probe, candidate.x, candidate.y)) {
    return false;
  }

  if (circleIntersectsRect({ x: candidate.x, y: candidate.y, r: radius + extraPadding }, extractionZone)) {
    return false;
  }

  return occupied.every(
    (entry) => distance(candidate, entry) >= radius + entry.radius + extraPadding
  );
}

function pickSpawnPoint(candidates, radius, occupied = [], options = {}) {
  const { fallbackAttempts = 160, margin = 36, extraPadding = 18 } = options;
  const available = candidates.filter((candidate) => isSpawnValid(candidate, radius, occupied, extraPadding));

  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)];
  }

  for (let attempt = 0; attempt < fallbackAttempts; attempt += 1) {
    const candidate = {
      x: margin + Math.random() * (WORLD.width - margin * 2),
      y: margin + Math.random() * (WORLD.height - margin * 2),
    };

    if (isSpawnValid(candidate, radius, occupied, extraPadding)) {
      return candidate;
    }
  }

  return { x: margin + radius, y: WORLD.height - margin - radius };
}

function ensureAudio() {
  if (audioContext) {
    return audioContext;
  }

  const AudioCtor = window.AudioContext || window.webkitAudioContext;

  if (!AudioCtor) {
    return null;
  }

  audioContext = new AudioCtor();
  masterGain = audioContext.createGain();
  masterGain.gain.value = 0.1;
  masterGain.connect(audioContext.destination);
  musicGain = audioContext.createGain();
  musicGain.gain.value = 0;
  musicGain.connect(masterGain);
  gameMusicGain = audioContext.createGain();
  gameMusicGain.gain.value = 0;
  gameMusicGain.connect(masterGain);
  return audioContext;
}

function playTone({ frequency, duration, type = "sine", volume = 0.2, slideTo = null }) {
  const context = ensureAudio();

  if (!context || !masterGain) {
    return;
  }

  if (context.state === "suspended") {
    context.resume();
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);

  if (slideTo !== null) {
    oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gain);
  gain.connect(masterGain);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function scheduleTone({
  when,
  frequency,
  duration,
  type = "sine",
  volume = 0.15,
  slideTo = null,
  targetGain = masterGain,
  attack = 0.01,
  release = 0.06,
}) {
  const context = ensureAudio();

  if (!context || !targetGain) {
    return;
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  const startAt = Math.max(when, now + 0.005);
  const stopAt = startAt + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);

  if (slideTo !== null) {
    oscillator.frequency.exponentialRampToValueAtTime(slideTo, stopAt);
  }

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, stopAt + release);

  oscillator.connect(gain);
  gain.connect(targetGain);
  oscillator.start(startAt);
  oscillator.stop(stopAt + release + 0.02);
}

function noteFrequency(note) {
  const lookup = {
    "A1": 55,
    "B1": 61.74,
    "C2": 65.41,
    "D2": 73.42,
    "E2": 82.41,
    "F2": 87.31,
    "G2": 98,
    "A2": 110,
    "B2": 123.47,
    "C3": 130.81,
    "D3": 146.83,
    "E3": 164.81,
    "F3": 174.61,
    "G3": 196,
    "A3": 220,
    "B3": 246.94,
    "C4": 261.63,
    "D4": 293.66,
    "E4": 329.63,
    "G4": 392,
  };

  return lookup[note] || 220;
}

function scheduleIntroBar(startAt) {
  const beat = 0.36;
  const bassLine = ["E2", "G2", "D2", "A1"];
  const pulseChords = [
    ["E3", "B3", "G3"],
    ["G3", "D4", "B3"],
    ["D3", "A3", "F3"],
    ["A2", "E3", "C3"],
  ];
  const leadNotes = [
    { beat: 1.25, note: "B3", duration: beat * 1.65 },
    { beat: 3.25, note: "D4", duration: beat * 1.35 },
    { beat: 5.25, note: "A3", duration: beat * 1.8 },
    { beat: 7.15, note: "G3", duration: beat * 1.6 },
  ];
  const accentHits = [0, 2, 4, 6];

  for (let index = 0; index < bassLine.length; index += 1) {
    const when = startAt + index * beat * 2;
    scheduleTone({
      when,
      frequency: noteFrequency(bassLine[index]),
      duration: beat * 1.7,
      type: "sawtooth",
      targetGain: musicGain,
      volume: 0.16,
      slideTo: noteFrequency(bassLine[index]) * 0.94,
      attack: 0.01,
      release: 0.12,
    });

    const chord = pulseChords[index];
    for (const note of chord) {
      scheduleTone({
        when,
        frequency: noteFrequency(note),
        duration: beat * 1.95,
        type: "triangle",
        targetGain: musicGain,
        volume: note === chord[0] ? 0.05 : 0.034,
        slideTo: noteFrequency(note) * 1.015,
        attack: 0.025,
        release: 0.18,
      });
    }
  }

  for (const noteEvent of leadNotes) {
    scheduleTone({
      when: startAt + noteEvent.beat * beat,
      frequency: noteFrequency(noteEvent.note),
      duration: noteEvent.duration,
      type: "square",
      targetGain: musicGain,
      volume: 0.075,
      slideTo: noteFrequency(noteEvent.note) * 1.012,
      attack: 0.01,
      release: 0.14,
    });
  }

  for (const step of accentHits) {
    scheduleTone({
      when: startAt + step * beat,
      frequency: 82.41,
      duration: beat * 0.5,
      type: "triangle",
      targetGain: musicGain,
      volume: 0.032,
      slideTo: 61.74,
      attack: 0.005,
      release: 0.08,
    });
  }

  for (let hit = 0; hit < 8; hit += 1) {
    scheduleTone({
      when: startAt + hit * beat,
      frequency: 220 + hit * 8,
      duration: 0.05,
      type: "square",
      targetGain: musicGain,
      volume: hit % 2 === 0 ? 0.022 : 0.012,
      attack: 0.005,
      release: 0.03,
    });
  }

  return beat * 8;
}

function scheduleGameBar(startAt) {
  const beat = 0.31;
  const bass = ["E2", "E2", "G2", "D2", "E2", "E2", "A1", "B1"];
  const arp = ["B2", "D3", "E3", "G3", "A2", "C3", "D3", "G3"];

  for (let step = 0; step < bass.length; step += 1) {
    const when = startAt + step * beat;
    scheduleTone({
      when,
      frequency: noteFrequency(bass[step]),
      duration: beat * 0.8,
      type: "triangle",
      targetGain: gameMusicGain,
      volume: step % 2 === 0 ? 0.09 : 0.065,
      slideTo: noteFrequency(bass[step]) * 0.97,
      attack: 0.008,
      release: 0.06,
    });

    scheduleTone({
      when: when + beat * 0.5,
      frequency: noteFrequency(arp[step]),
      duration: beat * 0.55,
      type: "square",
      targetGain: gameMusicGain,
      volume: 0.028,
      slideTo: noteFrequency(arp[step]) * 1.01,
      attack: 0.008,
      release: 0.05,
    });
  }

  for (let step = 0; step < 16; step += 1) {
    scheduleTone({
      when: startAt + step * beat * 0.5,
      frequency: step % 4 === 0 ? 230 : 178,
      duration: 0.035,
      type: "triangle",
      targetGain: gameMusicGain,
      volume: step % 4 === 0 ? 0.011 : 0.006,
      attack: 0.003,
      release: 0.02,
    });
  }

  return beat * 8;
}

function startIntroMusic() {
  const context = ensureAudio();

  if (!context || !musicGain) {
    return;
  }

  if (context.state === "suspended") {
    context.resume().catch(() => {});
  }

  if (introMusicActive) {
    return;
  }

  stopGameMusic();
  introMusicActive = true;
  const now = context.currentTime;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setValueAtTime(Math.max(0.0001, musicGain.gain.value), now);
  musicGain.gain.exponentialRampToValueAtTime(0.95, now + 0.65);

  introMusicNextBarTime = now + 0.08;
  introMusicNextBarTime += scheduleIntroBar(introMusicNextBarTime);

  if (introMusicTimer) {
    window.clearInterval(introMusicTimer);
  }

  introMusicTimer = window.setInterval(() => {
    if (!introMusicActive) {
      return;
    }

    const audio = ensureAudio();
    if (!audio) {
      return;
    }

    while (introMusicNextBarTime < audio.currentTime + 1.8) {
      introMusicNextBarTime += scheduleIntroBar(introMusicNextBarTime);
    }
  }, 400);
}

function stopIntroMusic() {
  if (!audioContext || !musicGain) {
    return;
  }

  introMusicActive = false;
  if (introMusicTimer) {
    window.clearInterval(introMusicTimer);
    introMusicTimer = 0;
  }

  const now = audioContext.currentTime;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setValueAtTime(Math.max(0.0001, musicGain.gain.value), now);
  musicGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
}

function startGameMusic() {
  const context = ensureAudio();

  if (!context || !gameMusicGain) {
    return;
  }

  if (context.state === "suspended") {
    context.resume().catch(() => {});
  }

  if (gameMusicActive) {
    return;
  }

  stopIntroMusic();
  gameMusicActive = true;
  const now = context.currentTime;
  gameMusicGain.gain.cancelScheduledValues(now);
  gameMusicGain.gain.setValueAtTime(Math.max(0.0001, gameMusicGain.gain.value), now);
  gameMusicGain.gain.exponentialRampToValueAtTime(0.7, now + 0.55);

  gameMusicNextBarTime = now + 0.08;
  gameMusicNextBarTime += scheduleGameBar(gameMusicNextBarTime);

  if (gameMusicTimer) {
    window.clearInterval(gameMusicTimer);
  }

  gameMusicTimer = window.setInterval(() => {
    if (!gameMusicActive) {
      return;
    }

    const audio = ensureAudio();
    if (!audio) {
      return;
    }

    while (gameMusicNextBarTime < audio.currentTime + 1.4) {
      gameMusicNextBarTime += scheduleGameBar(gameMusicNextBarTime);
    }
  }, 300);
}

function stopGameMusic() {
  if (!audioContext || !gameMusicGain) {
    return;
  }

  gameMusicActive = false;
  if (gameMusicTimer) {
    window.clearInterval(gameMusicTimer);
    gameMusicTimer = 0;
  }

  const now = audioContext.currentTime;
  gameMusicGain.gain.cancelScheduledValues(now);
  gameMusicGain.gain.setValueAtTime(Math.max(0.0001, gameMusicGain.gain.value), now);
  gameMusicGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
}

function syncPreferredMusic() {
  const context = ensureAudio();

  if (!context) {
    return;
  }

  const startPreferred = () => {
    if (preferredMusicMode === "game") {
      startGameMusic();
    } else if (preferredMusicMode === "intro") {
      startIntroMusic();
    } else {
      stopIntroMusic();
      stopGameMusic();
    }
  };

  if (context.state === "suspended") {
    context.resume().then(startPreferred).catch(() => {});
  } else {
    startPreferred();
  }
}

function emitSound(x, y, radius, kind, intensity = 1) {
  if (!gameState) {
    return;
  }

  gameState.soundEvents.push({
    x,
    y,
    radius,
    kind,
    ttl: 0.36,
    maxTtl: 0.36,
    intensity,
  });
}

function playGameSound(kind) {
  const soundMap = {
    shot: { frequency: 220, duration: 0.08, type: "square", volume: 0.24, slideTo: 120 },
    enemyShot: { frequency: 180, duration: 0.1, type: "sawtooth", volume: 0.14, slideTo: 110 },
    pickup: { frequency: 660, duration: 0.12, type: "triangle", volume: 0.15, slideTo: 920 },
    core: { frequency: 420, duration: 0.2, type: "triangle", volume: 0.18, slideTo: 710 },
    reload: { frequency: 240, duration: 0.1, type: "square", volume: 0.12, slideTo: 180 },
    hit: { frequency: 130, duration: 0.14, type: "sawtooth", volume: 0.18, slideTo: 80 },
    alert: { frequency: 540, duration: 0.16, type: "square", volume: 0.12, slideTo: 430 },
    step: { frequency: 90, duration: 0.05, type: "triangle", volume: 0.04, slideTo: 70 },
    medkit: { frequency: 360, duration: 0.16, type: "triangle", volume: 0.16, slideTo: 520 },
    decoy: { frequency: 480, duration: 0.14, type: "square", volume: 0.12, slideTo: 340 },
    shatter: { frequency: 260, duration: 0.12, type: "sawtooth", volume: 0.16, slideTo: 120 },
  };

  const definition = soundMap[kind];

  if (definition) {
    playTone(definition);
  }
}

function createLoot(id, x, y, type, value) {
  return {
    id,
    x,
    y,
    type,
    value,
    radius:
      type === "core"
        ? 14
        : type === "shield"
          ? 13
          : type === "medkit"
            ? 12
            : type === "noise"
              ? 11
              : 11,
    collected: false,
    pulse: Math.random() * Math.PI * 2,
  };
}

function createEnemy(id, x, y, kind = "rusher") {
  const presets = {
    rusher: {
      speed: 136,
      hp: 52,
      cooldown: 0.7,
      color: "#ff5d73",
      radius: 15,
      damage: 14,
      viewRange: 360,
      viewCone: Math.PI * 0.72,
      hearingRange: 380,
    },
    guard: {
      speed: 102,
      hp: 74,
      cooldown: 0.95,
      color: "#ff944d",
      radius: 17,
      damage: 19,
      viewRange: 430,
      viewCone: Math.PI * 0.9,
      hearingRange: 450,
    },
  };
  const preset = presets[kind];

  return {
    id,
    x,
    y,
    vx: 0,
    vy: 0,
    kind,
    radius: preset.radius,
    hp: preset.hp,
    maxHp: preset.hp,
    speed: preset.speed,
    cooldown: Math.random() * preset.cooldown,
    fireRate: preset.cooldown,
    color: preset.color,
    damage: preset.damage,
    viewRange: preset.viewRange,
    viewCone: preset.viewCone,
    hearingRange: preset.hearingRange,
    dead: false,
    wanderAngle: Math.random() * Math.PI * 2,
    angle: Math.random() * Math.PI * 2,
    aimAngle: Math.random() * Math.PI * 2,
    moveAngle: Math.random() * Math.PI * 2,
    state: "patrol",
    investigateX: x,
    investigateY: y,
    lastSeenX: x,
    lastSeenY: y,
    searchTimer: 0,
    seenTimer: 0,
    strafeBias: Math.random() > 0.5 ? 1 : -1,
    justAlerted: false,
    tactic: "assault",
    roleIndex: 0,
    squadId: "roam",
    squadRole: kind === "guard" ? "shieldLead" : "breacher",
    coverX: x,
    coverY: y,
    coverTimer: 0,
    shieldEquipped: false,
    shieldHp: 0,
    maxShieldHp: kind === "guard" ? 34 : 22,
    shieldFlash: 0,
    braceTimer: 0,
    shieldSide: 1,
    hitFlash: 0,
    muzzleFlash: 0,
    flinchTimer: 0,
    deadTimer: 2.8,
  };
}

function enemyShieldBlocksBullet(enemy, bullet) {
  if (!enemy.shieldEquipped || enemy.shieldHp <= 0) {
    return false;
  }

  const shieldSourceAngle = Math.atan2(-bullet.vy, -bullet.vx);
  const shieldAngle = enemy.aimAngle + enemy.shieldSide * Math.PI * 0.5;
  return angleDifference(shieldSourceAngle, shieldAngle) <= Math.PI * 0.34;
}

function canSeeTarget(observer, target, range, cone, facingAngle, closeRange = 76) {
  const targetDistance = distance(observer, target);

  if (targetDistance > range) {
    return false;
  }

  if (lineBlocked(observer.x, observer.y, target.x, target.y)) {
    return false;
  }

  if (!observer.kind || targetDistance <= closeRange) {
    return true;
  }

  const targetAngle = angleTo(observer, target);
  return angleDifference(targetAngle, facingAngle) <= cone * 0.5;
}

function canPlayerSee(target) {
  const player = gameState.player;
  const targetDistance = distance(player, target);
  return targetDistance <= player.viewRange && !lineBlocked(player.x, player.y, target.x, target.y);
}

function moveEntityToward(entity, targetX, targetY, speed, dt) {
  const baseAngle = angleTo(entity, { x: targetX, y: targetY });
  const attempts = [0, 0.45, -0.45, 0.9, -0.9, Math.PI];
  let moved = false;

  for (const offset of attempts) {
    const angle = baseAngle + offset;
    const nextX = entity.x + Math.cos(angle) * speed * dt;
    const nextY = entity.y + Math.sin(angle) * speed * dt;

    if (!positionBlocked(entity, nextX, nextY)) {
      entity.x = nextX;
      entity.y = nextY;
      entity.moveAngle = angle;
      moved = true;
      break;
    }
  }

  if (!moved) {
    tryMove(entity, Math.cos(baseAngle) * speed * dt, Math.sin(baseAngle) * speed * dt);
    entity.moveAngle = baseAngle;
  }
}

function scoreObstacleForCover(obstacle, enemy, player) {
  const centerX = obstacle.x + obstacle.w * 0.5;
  const centerY = obstacle.y + obstacle.h * 0.5;
  const enemyDistance = distance(enemy, { x: centerX, y: centerY });
  const playerDistance = distance(player, { x: centerX, y: centerY });
  const between = lineBlocked(enemy.x, enemy.y, player.x, player.y);

  let score = enemyDistance + playerDistance * 0.2;

  if (between) {
    score -= 160;
  }

  return score;
}

function getCoverPointForObstacle(obstacle, player, sideBias = 0) {
  const centerX = obstacle.x + obstacle.w * 0.5;
  const centerY = obstacle.y + obstacle.h * 0.5;
  const angleFromPlayer = angleTo(player, { x: centerX, y: centerY });
  const lateralAngle = angleFromPlayer + sideBias * Math.PI * 0.5;
  const padding = 34;
  const options = [
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

  return options.find((candidate) => !positionBlocked({ radius: 15 }, candidate.x, candidate.y)) || options[0];
}

function findCoverPosition(enemy, player) {
  const nearby = getWorldObstacles()
    .map((obstacle) => ({ obstacle, score: scoreObstacleForCover(obstacle, enemy, player) }))
    .filter((entry) => distance(enemy, { x: entry.obstacle.x + entry.obstacle.w * 0.5, y: entry.obstacle.y + entry.obstacle.h * 0.5 }) < 380)
    .sort((a, b) => a.score - b.score);

  if (nearby.length === 0) {
    return null;
  }

  const sideBias =
    enemy.tactic === "flankLeft" ? -1 : enemy.tactic === "flankRight" ? 1 : enemy.strafeBias;

  return getCoverPointForObstacle(nearby[0].obstacle, player, sideBias);
}

function getFlankTarget(enemy, player) {
  const flankDistance = enemy.kind === "guard" ? 210 : 150;
  const side = enemy.tactic === "flankLeft" ? -1 : 1;
  const aroundAngle = angleTo(player, enemy) + side * Math.PI * 0.75;

  return {
    x: clamp(player.x + Math.cos(aroundAngle) * flankDistance, 36, WORLD.width - 36),
    y: clamp(player.y + Math.sin(aroundAngle) * flankDistance, 36, WORLD.height - 36),
  };
}

function notifyNearbyEnemies(sourceEnemy, playerX, playerY) {
  for (const ally of gameState.enemies) {
    if (ally.dead || ally === sourceEnemy) {
      continue;
    }

    if (distance(sourceEnemy, ally) > 420) {
      continue;
    }

    ally.state = "investigate";
    ally.investigateX = playerX;
    ally.investigateY = playerY;
    ally.lastSeenX = playerX;
    ally.lastSeenY = playerY;
    ally.searchTimer = 2.8;
    ally.coverTimer = 0;
  }
}

function getSquadmates(enemy) {
  return gameState.enemies.filter((ally) => !ally.dead && ally.squadId === enemy.squadId);
}

function getShieldLead(enemy) {
  return getSquadmates(enemy).find((ally) => ally.squadRole === "shieldLead" && ally.shieldEquipped && ally.shieldHp > 0) || null;
}

function createLootId(type, index) {
  return `${type}-${index}`;
}

function createEnemyId(group, index) {
  return `${group}-${index}`;
}

function isRaidHost() {
  return !gameState || gameState.isRaidHost;
}

function recalculateSharedObjectiveProgress() {
  if (!gameState) {
    return;
  }

  gameState.lootCollected = gameState.loot.filter((loot) => loot.type === "core" && loot.collected).length;
}

function exportWorldState() {
  return {
    doors: buildings.map((building) => ({ id: building.door.id, open: building.door.open })),
    windows: buildings.flatMap((building) =>
      building.windows.map((window) => ({
        id: window.id,
        broken: window.broken,
      }))
    ),
    loot: gameState.loot.map((loot) => ({
      id: loot.id,
      collected: loot.collected,
    })),
  };
}

function applyWorldState(world) {
  if (!world || !gameState) {
    return;
  }

  if (Array.isArray(world.doors)) {
    for (const doorState of world.doors) {
      for (const building of buildings) {
        if (building.door.id === doorState.id) {
          building.door.open = Boolean(doorState.open);
          break;
        }
      }
    }
  }

  if (Array.isArray(world.windows)) {
    for (const windowState of world.windows) {
      const windowRef = findWindowById(windowState.id);
      if (windowRef) {
        windowRef.broken = Boolean(windowState.broken);
      }
    }
  }

  if (Array.isArray(world.loot)) {
    for (const lootState of world.loot) {
      const loot = gameState.loot.find((entry) => entry.id === lootState.id);
      if (loot) {
        loot.collected = Boolean(lootState.collected);
      }
    }
  }

  recalculateSharedObjectiveProgress();
  syncHud();
}

function serializeEnemy(enemy) {
  return {
    id: enemy.id,
    x: enemy.x,
    y: enemy.y,
    vx: enemy.vx,
    vy: enemy.vy,
    kind: enemy.kind,
    radius: enemy.radius,
    hp: enemy.hp,
    maxHp: enemy.maxHp,
    speed: enemy.speed,
    cooldown: enemy.cooldown,
    fireRate: enemy.fireRate,
    color: enemy.color,
    damage: enemy.damage,
    viewRange: enemy.viewRange,
    viewCone: enemy.viewCone,
    hearingRange: enemy.hearingRange,
    dead: enemy.dead,
    wanderAngle: enemy.wanderAngle,
    angle: enemy.angle,
    aimAngle: enemy.aimAngle,
    moveAngle: enemy.moveAngle,
    state: enemy.state,
    investigateX: enemy.investigateX,
    investigateY: enemy.investigateY,
    lastSeenX: enemy.lastSeenX,
    lastSeenY: enemy.lastSeenY,
    searchTimer: enemy.searchTimer,
    seenTimer: enemy.seenTimer,
    strafeBias: enemy.strafeBias,
    justAlerted: enemy.justAlerted,
    tactic: enemy.tactic,
    roleIndex: enemy.roleIndex,
    squadId: enemy.squadId,
    squadRole: enemy.squadRole,
    coverX: enemy.coverX,
    coverY: enemy.coverY,
    coverTimer: enemy.coverTimer,
    shieldEquipped: enemy.shieldEquipped,
    shieldHp: enemy.shieldHp,
    maxShieldHp: enemy.maxShieldHp,
    shieldFlash: enemy.shieldFlash,
    braceTimer: enemy.braceTimer,
    shieldSide: enemy.shieldSide,
    hitFlash: enemy.hitFlash,
    muzzleFlash: enemy.muzzleFlash,
    flinchTimer: enemy.flinchTimer,
    deadTimer: enemy.deadTimer,
  };
}

function applyEnemySnapshot(target, snapshot) {
  Object.assign(target, snapshot);
  return target;
}

function serializeBullet(bullet) {
  return {
    x: bullet.x,
    y: bullet.y,
    prevX: bullet.prevX,
    prevY: bullet.prevY,
    vx: bullet.vx,
    vy: bullet.vy,
    radius: bullet.radius,
    damage: bullet.damage,
    life: bullet.life,
    trail: bullet.trail,
  };
}

function applyBulletSnapshot(snapshot) {
  return { ...snapshot };
}

function getCombatSnapshot() {
  if (!gameState?.running || !isRaidHost()) {
    return null;
  }

  return {
    elapsed: gameState.elapsed,
    heat: gameState.heat,
    lootCollected: gameState.lootCollected,
    message: gameState.message,
    enemies: gameState.enemies.map(serializeEnemy),
    bullets: gameState.bullets.map(serializeBullet),
    enemyBullets: gameState.enemyBullets.map(serializeBullet),
  };
}

function applyCombatSnapshot(snapshot) {
  if (!gameState || !snapshot || isRaidHost()) {
    return;
  }

  gameState.elapsed = typeof snapshot.elapsed === "number" ? snapshot.elapsed : gameState.elapsed;
  gameState.heat = typeof snapshot.heat === "number" ? snapshot.heat : gameState.heat;
  gameState.lootCollected =
    typeof snapshot.lootCollected === "number" ? snapshot.lootCollected : gameState.lootCollected;

  if (typeof snapshot.message === "string" && snapshot.message) {
    gameState.message = snapshot.message;
    statusText.textContent = snapshot.message;
  }

  if (Array.isArray(snapshot.enemies)) {
    const enemyMap = new Map(gameState.enemies.map((enemy) => [enemy.id, enemy]));
    gameState.enemies = snapshot.enemies.map((entry) => applyEnemySnapshot(enemyMap.get(entry.id) || {}, entry));
  }

  if (Array.isArray(snapshot.bullets)) {
    gameState.bullets = snapshot.bullets.map(applyBulletSnapshot);
  }

  if (Array.isArray(snapshot.enemyBullets)) {
    gameState.enemyBullets = snapshot.enemyBullets.map(applyBulletSnapshot);
  }

  syncHud();
}

function makeState() {
  const loadout = CLASS_LOADOUTS[selectedClass] || CLASS_LOADOUTS.stealther;
  resetBuildingState();
  const occupied = [];
  const playerSpawn = pickSpawnPoint(spawnPools.player, 15, occupied, { extraPadding: 28 });
  occupied.push({ ...playerSpawn, radius: 15 });
  const enemySpawnOccupied = [...occupied, { x: playerSpawn.x, y: playerSpawn.y, radius: 290 }];

  const coreLoot = Array.from({ length: 3 }, () => {
    const index = occupied.length;
    const spawn = pickSpawnPoint(spawnPools.core, 14, occupied, { extraPadding: 34 });
    const loot = createLoot(createLootId("core", index), spawn.x, spawn.y, "core", 1);
    occupied.push({ x: loot.x, y: loot.y, radius: loot.radius });
    return loot;
  });

  const cashLoot = [120, 140, 160, 180, 220].map((value, index) => {
    const spawn = pickSpawnPoint(spawnPools.cash, 11, occupied, { extraPadding: 20 });
    const loot = createLoot(createLootId("cash", index), spawn.x, spawn.y, "cash", value);
    occupied.push({ x: loot.x, y: loot.y, radius: loot.radius });
    return loot;
  });

  const shieldLoot = Array.from({ length: 2 }, (_, index) => {
    const spawn = pickSpawnPoint(spawnPools.shield, 13, occupied, { extraPadding: 30 });
    const loot = createLoot(createLootId("shield", index), spawn.x, spawn.y, "shield", 42);
    occupied.push({ x: loot.x, y: loot.y, radius: loot.radius });
    return loot;
  });

  const medkitLoot = Array.from({ length: 3 }, (_, index) => {
    const spawn = pickSpawnPoint(spawnPools.medkit, 12, occupied, { extraPadding: 22 });
    const loot = createLoot(createLootId("medkit", index), spawn.x, spawn.y, "medkit", 1);
    occupied.push({ x: loot.x, y: loot.y, radius: loot.radius });
    return loot;
  });

  const noiseLoot = Array.from({ length: 3 }, (_, index) => {
    const spawn = pickSpawnPoint(spawnPools.noise, 11, occupied, { extraPadding: 20 });
    const loot = createLoot(createLootId("noise", index), spawn.x, spawn.y, "noise", 1);
    occupied.push({ x: loot.x, y: loot.y, radius: loot.radius });
    return loot;
  });

  const enemyDefinitions = [
    { kind: "rusher", radius: 15, padding: 80 },
    { kind: "rusher", radius: 15, padding: 80 },
    { kind: "guard", radius: 17, padding: 90, shield: true },
    { kind: "rusher", radius: 15, padding: 80 },
    { kind: "rusher", radius: 15, padding: 80 },
    { kind: "guard", radius: 17, padding: 90, shield: true },
    { kind: "rusher", radius: 15, padding: 80 },
    { kind: "rusher", radius: 15, padding: 80 },
    { kind: "guard", radius: 17, padding: 90, shield: true },
  ];

  const enemies = enemyDefinitions.map((definition, index) => {
    const spawn = pickSpawnPoint(spawnPools.enemy, definition.radius, enemySpawnOccupied, {
      extraPadding: definition.padding,
    });
    const enemy = createEnemy(createEnemyId("roam", index), spawn.x, spawn.y, definition.kind);
    if (definition.shield) {
      enemy.shieldEquipped = true;
      enemy.shieldHp = enemy.maxShieldHp;
    }
    enemy.tactic =
      definition.kind === "guard"
        ? "anchor"
        : index % 3 === 0
          ? "flankLeft"
          : index % 3 === 1
            ? "flankRight"
            : "assault";
    enemy.roleIndex = index;
    enemy.squadId = `roam-${Math.floor(index / 3)}`;
    enemy.squadRole = definition.kind === "guard" ? "shieldLead" : enemy.tactic;
    occupied.push({ x: enemy.x, y: enemy.y, radius: enemy.radius });
    enemySpawnOccupied.push({ x: enemy.x, y: enemy.y, radius: enemy.radius });
    return enemy;
  });

  const interiorSquad = buildings.flatMap((building) =>
    building.squadSpawns.map((definition, index) => {
      const enemy = createEnemy(
        createEnemyId(building.id, index),
        definition.x,
        definition.y,
        definition.kind
      );
      enemy.tactic = definition.tactic;
      enemy.roleIndex = enemies.length + index;
      enemy.state = "patrol";
      enemy.wanderAngle = Math.PI * 0.5;
      enemy.aimAngle = Math.PI * 0.5;
      enemy.squadId = building.id;
      enemy.squadRole = definition.squadRole || (definition.shield ? "shieldLead" : definition.tactic);
      if (definition.shield) {
        enemy.shieldEquipped = true;
        enemy.shieldHp = enemy.maxShieldHp;
      }
      occupied.push({ x: enemy.x, y: enemy.y, radius: enemy.radius });
      return enemy;
    })
  );

  return {
    running: false,
    ended: false,
    elapsed: 0,
    duration: 300,
    spawnGrace: 2.6,
    heat: 1,
    awareness: "open",
    lootCollected: 0,
    requiredLoot: 3,
    cash: loadout.cash,
    camera: { x: 0, y: 0 },
    message: "Sweep the district, secure 3 relay cores, and get out alive.",
    particles: [],
    soundEvents: [],
    remotePlayers: [],
    localNetworkId: null,
    networkPresence: 1,
    isRaidHost: true,
    player: {
      x: playerSpawn.x,
      y: playerSpawn.y,
      radius: 15,
      speed: loadout.speed,
      sprintSpeed: loadout.sprintSpeed,
      hp: 100,
      maxHp: 100,
      ammo: loadout.ammo,
      magSize: loadout.ammo,
      reloadTime: loadout.reloadTime,
      reloadTimer: 0,
      shotCooldown: 0,
      shotRate: loadout.shotRate,
      interactRadius: 58,
      angle: 0,
      viewRange: 355,
      closeViewRange: 108,
      viewCone: Math.PI * 0.76,
      stepTimer: 0,
      recoil: 0,
      muzzleFlash: 0,
      stride: 0,
      shake: 0,
      hitFlash: 0,
      vx: 0,
      vy: 0,
      shieldEquipped: false,
      shieldHp: 0,
      maxShieldHp: 42,
      shieldFlash: 0,
      quietMode: false,
      medkits: loadout.medkits,
      noiseCharges: loadout.noiseCharges,
      quietMultiplier: loadout.quietMultiplier,
      weapon: {
        className: loadout.name,
        label: loadout.weaponLabel,
        bulletSpeed: loadout.bulletSpeed,
        damage: loadout.damage,
        pellets: loadout.pellets,
        spread: loadout.spread,
        recoil: loadout.recoil,
        soundRadius: loadout.soundRadius,
      },
      knifeTimer: 0,
      knifeReady: false,
    },
    bullets: [],
    enemyBullets: [],
    enemies: [...enemies, ...interiorSquad],
    loot: [...cashLoot, ...shieldLoot, ...medkitLoot, ...noiseLoot, ...coreLoot],
  };
}

function resetGame() {
  gameState = makeState();
  syncHud();
  startOverlay.classList.add("is-visible");
  endOverlay.classList.remove("is-visible");
  preferredMusicMode = "intro";
  stopGameMusic();
  if (audioContext) {
    syncPreferredMusic();
  }
}

function startGame() {
  if (!gameState) {
    resetGame();
  }

  gameState.running = true;
  gameState.ended = false;
  gameState.elapsed = 0;
  gameState.spawnGrace = 2.6;
  gameState.awareness = "open";
  gameState.message = `${gameState.player.weapon.className} live with ${gameState.player.weapon.label}. Collect the relay cores and move east for extraction.`;
  statusText.textContent = gameState.message;
  preferredMusicMode = "game";
  syncPreferredMusic();
  startOverlay.classList.remove("is-visible");
  endOverlay.classList.remove("is-visible");
}

function endGame(success, reason) {
  gameState.running = false;
  gameState.ended = true;
  endOverlay.classList.add("is-visible");
  endTag.textContent = success ? "raid complete" : "raid failed";
  endTitle.textContent = success ? "Extraction Confirmed" : "Operator Lost";
  endSummary.textContent = reason;
  statusText.textContent = reason;
}

function spawnParticle(x, y, color, size) {
  gameState.particles.push({
    x,
    y,
    vx: (Math.random() - 0.5) * 120,
    vy: (Math.random() - 0.5) * 120,
    life: 0.4 + Math.random() * 0.3,
    maxLife: 0.7,
    color,
    size,
  });
}

function updateSoundEvents(dt) {
  for (const event of gameState.soundEvents) {
    event.ttl -= dt;
  }

  gameState.soundEvents = gameState.soundEvents.filter((event) => event.ttl > 0);
}

function syncHud() {
  const state = gameState;
  const remaining = Math.max(0, state.duration - state.elapsed);
  const minutes = Math.floor(remaining / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(remaining % 60)
    .toString()
    .padStart(2, "0");

  timerValue.textContent = `${minutes}:${seconds}`;
  lootValue.textContent = `${state.lootCollected} / ${state.requiredLoot} cores`;
  cashValue.textContent = `$${state.cash}`;
  heatValue.textContent = `${state.heat}`;

  const healthRatio = state.player.hp / state.player.maxHp;
  healthValue.textContent = `${Math.max(0, Math.ceil(state.player.hp))} hp`;
  healthFill.style.width = `${healthRatio * 100}%`;

  const ammoRatio = state.player.ammo / state.player.magSize;
  ammoValue.textContent = state.player.reloadTimer > 0 ? "reloading..." : `${state.player.ammo} / ${state.player.magSize}`;
  ammoFill.style.width = `${ammoRatio * 100}%`;

  const shieldRatio = state.player.shieldEquipped ? state.player.shieldHp / state.player.maxShieldHp : 0;
  shieldValue.textContent = state.player.shieldEquipped ? `${Math.max(0, Math.ceil(state.player.shieldHp))} sp` : "offline";
  shieldFill.style.width = `${shieldRatio * 100}%`;
  shieldFill.style.opacity = state.player.shieldEquipped ? "1" : "0.18";

  const awarenessMap = {
    stealth: { label: "stealth", color: "#0f8e79" },
    open: { label: "open", color: "#566778" },
    suspicious: { label: "suspicious", color: "#b88937" },
    spotted: { label: "spotted", color: "#b54a64" },
    lost: { label: "lost contact", color: "#677888" },
  };
  const awareness = awarenessMap[state.awareness] || awarenessMap.open;
  stealthValue.textContent = awareness.label;
  stealthValue.style.color = awareness.color;
  medkitValue.textContent = `${state.player.medkits}`;
  noiseValue.textContent = `${state.player.noiseCharges}`;
}

function viewportToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const localX = (clientX - rect.left) * scaleX;
  const localY = (clientY - rect.top) * scaleY;

  pointer.x = localX;
  pointer.y = localY;
  pointer.worldX = gameState.camera.x + localX / CAMERA_ZOOM;
  pointer.worldY = gameState.camera.y + localY / CAMERA_ZOOM;

  if (reticle) {
    reticle.style.left = `${clientX - rect.left}px`;
    reticle.style.top = `${clientY - rect.top}px`;
  }
}

function tryMove(entity, dx, dy) {
  const nextX = entity.x + dx;
  const nextY = entity.y + dy;

  if (!positionBlocked(entity, nextX, entity.y)) {
    entity.x = nextX;
  }

  if (!positionBlocked(entity, entity.x, nextY)) {
    entity.y = nextY;
  }
}

function fireBullet(origin, angle, speed, fromEnemy, damage) {
  const radius = fromEnemy ? 4 : 3;
  const bullet = {
    x: origin.x + Math.cos(angle) * (origin.radius + 6),
    y: origin.y + Math.sin(angle) * (origin.radius + 6),
    prevX: origin.x,
    prevY: origin.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius,
    damage,
    life: 1.1,
    trail: fromEnemy ? "#b14b5c" : "#5a4a20",
  };

  if (fromEnemy) {
    gameState.enemyBullets.push(bullet);
  } else {
    gameState.bullets.push(bullet);
  }
}

function getLoadoutForClass(className) {
  const key = String(className || "").toLowerCase();
  return CLASS_LOADOUTS[key] || CLASS_LOADOUTS.stealther;
}

function getPlayerSnapshotById(playerId) {
  if (!gameState || !playerId) {
    return null;
  }

  if (playerId === gameState.localNetworkId) {
    return {
      id: playerId,
      className: selectedClass,
      x: gameState.player.x,
      y: gameState.player.y,
      angle: gameState.player.angle,
      hp: gameState.player.hp,
      maxHp: gameState.player.maxHp,
      shieldEquipped: gameState.player.shieldEquipped,
      shieldHp: gameState.player.shieldHp,
      radius: gameState.player.radius,
    };
  }

  return gameState.remotePlayers.find((player) => player.id === playerId) || null;
}

function applyPlayerPatchLocally(playerId, patch) {
  if (!gameState || !patch) {
    return;
  }

  if (playerId === gameState.localNetworkId) {
    if (typeof patch.hp === "number") {
      gameState.player.hp = patch.hp;
    }
    if (typeof patch.maxHp === "number") {
      gameState.player.maxHp = patch.maxHp;
    }
    if (typeof patch.shieldEquipped === "boolean") {
      gameState.player.shieldEquipped = patch.shieldEquipped;
    }
    if (typeof patch.shieldHp === "number") {
      gameState.player.shieldHp = patch.shieldHp;
    }
    syncHud();
    return;
  }

  const remote = gameState.remotePlayers.find((player) => player.id === playerId);
  if (remote) {
    Object.assign(remote, patch);
  }
}

function emitRemotePlayerShot(playerState) {
  if (!playerState) {
    return;
  }

  const loadout = getLoadoutForClass(playerState.className);
  const actor = {
    x: playerState.x,
    y: playerState.y,
    radius: playerState.radius || 15,
  };

  for (let pellet = 0; pellet < loadout.pellets; pellet += 1) {
    const spread =
      (pellet - (loadout.pellets - 1) * 0.5) * loadout.spread + (Math.random() - 0.5) * loadout.spread * 0.45;
    fireBullet(actor, (playerState.angle || 0) + spread, loadout.bulletSpeed, false, loadout.damage);
  }

  spawnParticle(
    actor.x + Math.cos(playerState.angle || 0) * 24,
    actor.y + Math.sin(playerState.angle || 0) * 24,
    "#ffd166",
    4 + loadout.pellets * 0.3
  );
  emitSound(actor.x, actor.y, loadout.soundRadius, "shot", loadout.soundRadius < 180 ? 0.5 : 1);
  playGameSound("shot");
}

function handleInteractForActor(actor) {
  if (!actor) {
    return;
  }

  const nearbyDoor = getNearbyDoor(actor);
  if (nearbyDoor) {
    nearbyDoor.open = !nearbyDoor.open;
    window.__raidRuntime?.publishWorldAction({
      type: "door",
      id: nearbyDoor.id,
      open: nearbyDoor.open,
    });
    return;
  }

  for (const loot of gameState.loot) {
    if (loot.collected || distance(actor, loot) > 58) {
      continue;
    }

    loot.collected = true;
    if (loot.type === "core") {
      gameState.lootCollected += 1;
    }

    window.__raidRuntime?.publishWorldAction({
      type: "loot",
      id: loot.id,
      collected: true,
    });
    recalculateSharedObjectiveProgress();
    syncHud();
    return;
  }
}

function getTakedownTargetForActor(actor) {
  if (!actor) {
    return null;
  }

  for (const enemy of gameState.enemies) {
    if (enemy.dead || distance(actor, enemy) > 42) {
      continue;
    }

    const enemySeesActor = canSeeTarget(enemy, actor, enemy.viewRange, enemy.viewCone, enemy.aimAngle, 24);
    const behindAngle = angleDifference(angleTo(enemy, actor), enemy.aimAngle);

    if (!enemySeesActor && behindAngle > Math.PI * 0.58 && enemy.state !== "hunt") {
      return enemy;
    }
  }

  return null;
}

function applyRemoteAction(playerId, action) {
  if (!gameState?.running || !isRaidHost() || !action) {
    return;
  }

  const actor = getPlayerSnapshotById(playerId);
  if (!actor) {
    return;
  }

  if (action.type === "shoot") {
    emitRemotePlayerShot(actor);
    return;
  }

  if (action.type === "noise" && action.target) {
    emitSound(action.target.x, action.target.y, 360, "decoy", 1.4);
    spawnImpactBurst(action.target.x, action.target.y, ["#7aaed0", "#f5fbff", "rgba(74, 118, 142, 0.34)"], 4.4);
    playGameSound("decoy");
    return;
  }

  if (action.type === "interact") {
    handleInteractForActor(actor);
    return;
  }

  if (action.type === "takedown") {
    const target = getTakedownTargetForActor(actor);
    if (target) {
      target.dead = true;
      target.deadTimer = 5.2;
      spawnImpactBurst(target.x, target.y, ["#f5f8fb", "#ff7a45", "rgba(126, 26, 45, 0.38)"], 4);
    }
  }
}

function applyAuthoritativeLocalState(playerState) {
  if (!gameState || !playerState) {
    return;
  }

  gameState.localNetworkId = playerState.id || gameState.localNetworkId;
  gameState.player.hp = typeof playerState.hp === "number" ? playerState.hp : gameState.player.hp;
  gameState.player.maxHp = typeof playerState.maxHp === "number" ? playerState.maxHp : gameState.player.maxHp;
  gameState.player.shieldEquipped =
    typeof playerState.shieldEquipped === "boolean" ? playerState.shieldEquipped : gameState.player.shieldEquipped;
  gameState.player.shieldHp =
    typeof playerState.shieldHp === "number" ? playerState.shieldHp : gameState.player.shieldHp;
  syncHud();
}

function shootPlayer() {
  const player = gameState.player;
  const weapon = player.weapon;

  if (!gameState.running || player.reloadTimer > 0 || player.shotCooldown > 0 || player.ammo <= 0) {
    return;
  }

  player.ammo -= 1;
  player.shotCooldown = player.shotRate;
  const pelletCount = weapon.pellets || 1;

  if (!isRaidHost()) {
    player.recoil = weapon.recoil;
    player.muzzleFlash = 0.08;
    player.shake = Math.max(player.shake, 2.8);
    playGameSound("shot");
    window.__raidRuntime?.publishPlayerAction({ type: "shoot" });
    syncHud();
    return;
  }

  for (let pellet = 0; pellet < pelletCount; pellet += 1) {
    const spread = (pellet - (pelletCount - 1) * 0.5) * weapon.spread + (Math.random() - 0.5) * weapon.spread * 0.45;
    fireBullet(player, player.angle + spread, weapon.bulletSpeed, false, weapon.damage);
  }

  spawnParticle(player.x + Math.cos(player.angle) * 24, player.y + Math.sin(player.angle) * 24, "#ffd166", 4 + pelletCount * 0.3);
  spawnParticle(player.x + Math.cos(player.angle) * 28, player.y + Math.sin(player.angle) * 28, "rgba(255,255,255,0.92)", 2 + pelletCount * 0.15);
  player.recoil = weapon.recoil;
  player.muzzleFlash = 0.08;
  player.shake = Math.max(player.shake, 2.8);
  emitSound(player.x, player.y, weapon.soundRadius, "shot", weapon.soundRadius < 180 ? 0.5 : 1);
  playGameSound("shot");
  syncHud();

  if (player.ammo <= 0) {
    gameState.message = "Magazine empty. Reload now.";
    statusText.textContent = gameState.message;
  }
}

function reloadPlayer() {
  const player = gameState.player;

  if (player.reloadTimer > 0 || player.ammo === player.magSize) {
    return;
  }

  player.reloadTimer = player.reloadTime;
  gameState.message = "Reloading...";
  statusText.textContent = gameState.message;
  playGameSound("reload");
}

function useMedkit() {
  if (!gameState?.running) {
    return;
  }

  const player = gameState.player;

  if (player.medkits <= 0) {
    gameState.message = "No medkits on hand.";
    statusText.textContent = gameState.message;
    return;
  }

  if (player.hp >= player.maxHp) {
    gameState.message = "Vitals already stable.";
    statusText.textContent = gameState.message;
    return;
  }

  player.medkits -= 1;
  player.hp = Math.min(player.maxHp, player.hp + 38);
  player.hitFlash = Math.max(0, player.hitFlash - 0.3);
  spawnImpactBurst(player.x, player.y, ["#0f8e79", "#c8fff1", "rgba(92, 214, 171, 0.35)"], 4.2);
  playGameSound("medkit");
  gameState.message = "Field medkit applied.";
  statusText.textContent = gameState.message;
  syncHud();
}

function throwNoiseMaker() {
  if (!gameState?.running) {
    return;
  }

  const player = gameState.player;

  if (player.noiseCharges <= 0) {
    gameState.message = "No noise makers left.";
    statusText.textContent = gameState.message;
    return;
  }

  player.noiseCharges -= 1;
  const dx = pointer.worldX - player.x;
  const dy = pointer.worldY - player.y;
  const distanceToAim = Math.hypot(dx, dy) || 1;
  const throwDistance = Math.min(280, distanceToAim);
  const target = {
    x: clamp(player.x + (dx / distanceToAim) * throwDistance, 28, WORLD.width - 28),
    y: clamp(player.y + (dy / distanceToAim) * throwDistance, 28, WORLD.height - 28),
  };

  if (!isRaidHost()) {
    gameState.message = "Noise maker tossed.";
    statusText.textContent = gameState.message;
    playGameSound("decoy");
    window.__raidRuntime?.publishPlayerAction({ type: "noise", target });
    syncHud();
    return;
  }

  emitSound(target.x, target.y, 360, "decoy", 1.4);
  spawnImpactBurst(target.x, target.y, ["#7aaed0", "#f5fbff", "rgba(74, 118, 142, 0.34)"], 4.4);
  playGameSound("decoy");
  gameState.message = "Noise maker tossed. Hostiles are checking it.";
  statusText.textContent = gameState.message;
  syncHud();
}

function interact() {
  if (!gameState.running) {
    return;
  }

  const player = gameState.player;

  if (!isRaidHost()) {
    const nearbyDoor = getNearbyDoor(player);

    if (nearbyDoor) {
      gameState.message = nearbyDoor.open ? "Requesting door close..." : "Requesting door open...";
      statusText.textContent = gameState.message;
    } else {
      for (const loot of gameState.loot) {
        if (loot.collected || distance(player, loot) > player.interactRadius) {
          continue;
        }

        loot.collected = true;

        if (loot.type === "core") {
          gameState.lootCollected += 1;
          gameState.message = `Relay core secured. ${gameState.requiredLoot - gameState.lootCollected} remaining.`;
        } else if (loot.type === "shield") {
          player.shieldEquipped = true;
          player.shieldHp = player.maxShieldHp;
          player.shieldFlash = 1;
          gameState.message = "Side shield equipped.";
        } else if (loot.type === "medkit") {
          player.medkits += loot.value;
          gameState.message = "Field medkit secured.";
        } else if (loot.type === "noise") {
          player.noiseCharges += loot.value;
          gameState.message = "Noise maker secured.";
        } else {
          gameState.cash += loot.value;
          gameState.message = `Cash recovered: $${loot.value}.`;
        }

        statusText.textContent = gameState.message;
        syncHud();
        break;
      }
    }

    window.__raidRuntime?.publishPlayerAction({ type: "interact" });
    return;
  }
  const nearbyDoor = getNearbyDoor(player);

  if (nearbyDoor) {
    nearbyDoor.open = !nearbyDoor.open;
    gameState.message = nearbyDoor.open ? "Service door opened." : "Service door closed.";
    statusText.textContent = gameState.message;
    window.__raidRuntime?.publishWorldAction({
      type: "door",
      id: nearbyDoor.id,
      open: nearbyDoor.open,
    });
    return;
  }

  let collectedSomething = false;

  for (const loot of gameState.loot) {
    if (loot.collected || distance(player, loot) > player.interactRadius) {
      continue;
    }

    loot.collected = true;
    collectedSomething = true;

    if (loot.type === "core") {
      gameState.lootCollected += 1;
      gameState.message = `Relay core secured. ${gameState.requiredLoot - gameState.lootCollected} remaining.`;
      playGameSound("core");
    } else if (loot.type === "shield") {
      player.shieldEquipped = true;
      player.shieldHp = player.maxShieldHp;
      player.shieldFlash = 1;
      gameState.message = "Side shield equipped.";
      playGameSound("pickup");
    } else if (loot.type === "medkit") {
      player.medkits += loot.value;
      gameState.message = "Field medkit secured.";
      playGameSound("pickup");
    } else if (loot.type === "noise") {
      player.noiseCharges += loot.value;
      gameState.message = "Noise maker secured.";
      playGameSound("pickup");
    } else {
      gameState.cash += loot.value;
      gameState.message = `Cash recovered: $${loot.value}.`;
      playGameSound("pickup");
    }

    spawnParticle(
      loot.x,
      loot.y,
      loot.type === "core"
        ? "#61f0bc"
        : loot.type === "shield"
          ? "#7ab7d8"
          : loot.type === "medkit"
            ? "#0f8e79"
            : loot.type === "noise"
              ? "#5e88a6"
              : "#ffd166",
      5
    );
    emitSound(loot.x, loot.y, 90, "pickup", 0.45);
    window.__raidRuntime?.publishWorldAction({
      type: "loot",
      id: loot.id,
      collected: true,
    });
  }

  if (collectedSomething) {
    recalculateSharedObjectiveProgress();
    statusText.textContent = gameState.message;
    syncHud();
    return;
  }

  if (rectContains(extractionZone, player.x, player.y)) {
    if (gameState.lootCollected >= gameState.requiredLoot) {
      endGame(true, `You extracted with ${gameState.lootCollected} relay cores and $${gameState.cash}.`);
    } else {
      gameState.message = "Extraction gate locked. You still need more relay cores.";
      statusText.textContent = gameState.message;
    }
  }
}

function getInteractionTarget() {
  if (!gameState?.running) {
    return null;
  }

  const player = gameState.player;
  const nearbyDoor = getNearbyDoor(player);

  if (nearbyDoor) {
    return nearbyDoor.open ? "Press E to close service door" : "Press E to open service door";
  }

  for (const loot of gameState.loot) {
    if (!loot.collected && distance(player, loot) <= player.interactRadius) {
      if (loot.type === "core") {
        return "Press E to secure relay core";
      }
      if (loot.type === "shield") {
        return player.shieldEquipped ? "Press E to swap side shield" : "Press E to equip side shield";
      }
      if (loot.type === "medkit") {
        return "Press E to collect medkit";
      }
      if (loot.type === "noise") {
        return "Press E to collect noise maker";
      }
      return `Press E to collect $${loot.value}`;
    }
  }

  if (rectContains(extractionZone, player.x, player.y)) {
    if (gameState.lootCollected >= gameState.requiredLoot) {
      return "Press E to extract";
    }

    return "Need all relay cores before extraction";
  }

  return null;
}

function getTakedownTarget() {
  if (!gameState?.running) {
    return null;
  }

  const player = gameState.player;

  for (const enemy of gameState.enemies) {
    if (enemy.dead) {
      continue;
    }

    const closeEnough = distance(player, enemy) <= 42;
    if (!closeEnough) {
      continue;
    }

    const enemySeesPlayer = canSeeTarget(enemy, player, enemy.viewRange, enemy.viewCone, enemy.aimAngle, 24);
    const behindAngle = angleDifference(angleTo(enemy, player), enemy.aimAngle);

    if (!enemySeesPlayer && behindAngle > Math.PI * 0.58 && enemy.state !== "hunt") {
      return enemy;
    }
  }

  return null;
}

function performTakedown() {
  if (!isRaidHost()) {
    gameState.player.knifeTimer = 0.28;
    window.__raidRuntime?.publishPlayerAction({ type: "takedown" });
    return;
  }

  const target = getTakedownTarget();

  if (!target) {
    return;
  }

  target.dead = true;
  gameState.player.knifeTimer = 0.36;
  gameState.player.shake = Math.max(gameState.player.shake, 2.4);
  gameState.cash += 40;
  spawnImpactBurst(target.x, target.y, ["#f5f8fb", "#ff7a45", "rgba(126, 26, 45, 0.38)"], 4);
  emitSound(target.x, target.y, 70, "body", 0.18);
  gameState.message = "Silent takedown.";
  statusText.textContent = gameState.message;
  syncHud();
}

function updateAwarenessState() {
  const player = gameState.player;
  const previous = gameState.awareness;
  let next = player.quietMode ? "stealth" : "open";

  if (gameState.enemies.some((enemy) => !enemy.dead && enemy.state === "hunt")) {
    next = "spotted";
  } else if (gameState.enemies.some((enemy) => !enemy.dead && enemy.state === "investigate")) {
    next = "suspicious";
  } else if (gameState.enemies.some((enemy) => !enemy.dead && enemy.state === "search")) {
    next = "lost";
  }

  gameState.awareness = next;

  if (next === previous) {
    return;
  }

  if (next === "suspicious") {
    gameState.message = "Suspicion rising. Keep cover between you and the squad.";
  } else if (next === "spotted") {
    gameState.message = "Spotted. Break line of sight or brace for contact.";
  } else if (next === "lost") {
    gameState.message = "Contact lost. Enemies are searching your last position.";
  } else if (next === "stealth") {
    gameState.message = "Stealth walk active.";
  } else if (previous === "spotted" || previous === "suspicious" || previous === "lost") {
    gameState.message = "Area calm. You are back in the open.";
  }

  statusText.textContent = gameState.message;
}

function updatePlayer(dt) {
  const player = gameState.player;
  const move = { x: 0, y: 0 };
  const prevX = player.x;
  const prevY = player.y;

  if (keys.has("w") || keys.has("arrowup")) {
    move.y -= 1;
  }
  if (keys.has("s") || keys.has("arrowdown")) {
    move.y += 1;
  }
  if (keys.has("a") || keys.has("arrowleft")) {
    move.x -= 1;
  }
  if (keys.has("d") || keys.has("arrowright")) {
    move.x += 1;
  }

  const magnitude = Math.hypot(move.x, move.y) || 1;
  const isMoving = Math.hypot(move.x, move.y) > 0;
  const sprinting = keys.has("shift") && isMoving;
  const quietMovement = player.quietMode && !sprinting;
  const speed = sprinting ? player.sprintSpeed : quietMovement ? player.speed * player.quietMultiplier : player.speed;

  tryMove(player, (move.x / magnitude) * speed * dt, (move.y / magnitude) * speed * dt);
  player.vx = (player.x - prevX) / Math.max(dt, 0.0001);
  player.vy = (player.y - prevY) / Math.max(dt, 0.0001);
  player.stride += isMoving ? dt * (sprinting ? 13 : quietMovement ? 4.6 : 8) : dt * 2;

  player.angle = angleTo(player, { x: pointer.worldX, y: pointer.worldY });
  player.recoil = Math.max(0, player.recoil - dt * 5.5);
  player.muzzleFlash = Math.max(0, player.muzzleFlash - dt);
  player.shake = Math.max(0, player.shake - dt * 18);
  player.hitFlash = Math.max(0, player.hitFlash - dt * 1.9);
  player.shieldFlash = Math.max(0, player.shieldFlash - dt * 2.8);
  player.knifeTimer = Math.max(0, player.knifeTimer - dt * 2.5);

  if (player.shotCooldown > 0) {
    player.shotCooldown -= dt;
  }

  if (player.reloadTimer > 0) {
    player.reloadTimer -= dt;

    if (player.reloadTimer <= 0) {
      player.ammo = player.magSize;
      gameState.message = "Magazine topped off.";
      statusText.textContent = gameState.message;
      syncHud();
    }
  }

  if (isMoving) {
    player.stepTimer -= dt;

    if (player.stepTimer <= 0) {
      const radius = quietMovement ? 46 : sprinting ? 210 : 110;
      const intensity = quietMovement ? 0.12 : sprinting ? 0.75 : 0.32;

      if (gameState.spawnGrace <= 0) {
        emitSound(player.x, player.y, radius, sprinting ? "sprint" : "step", intensity);
      }

      if (sprinting) {
        playGameSound("step");
      }

      player.stepTimer = quietMovement ? 0.56 : sprinting ? 0.26 : 0.48;
    }
  } else {
    player.stepTimer = Math.min(player.stepTimer, 0.08);
  }

  if (pointer.down) {
    shootPlayer();
  }
}

function bulletHitsObstacle(bullet) {
  return getWorldObstacles().some((obstacle) => rectContains(obstacle, bullet.x, bullet.y));
}

function getBulletCollisionSurface(bullet) {
  return getWorldObstacles().find((obstacle) => rectContains(obstacle, bullet.x, bullet.y)) || null;
}

function playerShieldBlocksBullet(player, bullet) {
  if (!player.shieldEquipped || player.shieldHp <= 0) {
    return false;
  }

  const shieldSourceAngle = Math.atan2(-bullet.vy, -bullet.vx);
  const rightSideAngle = player.angle + Math.PI * 0.5;
  return angleDifference(shieldSourceAngle, rightSideAngle) <= Math.PI * 0.34;
}

function spawnImpactBurst(x, y, colors, size = 3) {
  for (const color of colors) {
    spawnParticle(x, y, color, size + Math.random() * 1.8);
  }
}

function updateBullets(dt) {
  for (const bullet of gameState.bullets) {
    bullet.prevX = bullet.x;
    bullet.prevY = bullet.y;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
  }

  for (const bullet of gameState.enemyBullets) {
    bullet.prevX = bullet.x;
    bullet.prevY = bullet.y;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
  }

  gameState.bullets = gameState.bullets.filter((bullet) => {
    const hitSurface = getBulletCollisionSurface(bullet);
    const hitObstacle = Boolean(hitSurface);

    if (
      bullet.life <= 0 ||
      bullet.x < 0 ||
      bullet.y < 0 ||
      bullet.x > WORLD.width ||
      bullet.y > WORLD.height ||
      hitObstacle
    ) {
      if (hitObstacle) {
      if (hitSurface.kind === "window") {
          const matchingWindow = findWindowById(hitSurface.id);
          if (matchingWindow) {
            matchingWindow.broken = true;
            gameState.message = "Window breached.";
            statusText.textContent = gameState.message;
            window.__raidRuntime?.publishWorldAction({
              type: "window",
              id: matchingWindow.id,
              broken: true,
            });
          }
          spawnImpactBurst(bullet.x, bullet.y, ["#a8d8f3", "#f4fbff", "rgba(146, 166, 182, 0.5)"], 3.2);
          emitSound(hitSurface.x + hitSurface.w * 0.5, hitSurface.y + hitSurface.h * 0.5, 210, "shot", 0.9);
        }
        spawnImpactBurst(bullet.x, bullet.y, ["#8f6820", "#ffe2a4", "rgba(56, 66, 78, 0.34)"], 2.2);
      }
      return false;
    }

    for (const enemy of gameState.enemies) {
      if (enemy.dead || distance(bullet, enemy) > enemy.radius + bullet.radius) {
        continue;
      }

      if (enemyShieldBlocksBullet(enemy, bullet)) {
        enemy.shieldHp -= bullet.damage;
        enemy.shieldFlash = 1;
        enemy.braceTimer = Math.max(enemy.braceTimer, 0.95);
        spawnImpactBurst(bullet.x, bullet.y, ["#7ab7d8", "#dff6ff", "rgba(38, 73, 94, 0.36)"], 4);

        if (enemy.shieldHp <= 0) {
          enemy.shieldEquipped = false;
          enemy.shieldHp = 0;
          gameState.message = "Enemy shield shattered.";
          statusText.textContent = gameState.message;
          playGameSound("shatter");
        }

        return false;
      }

      enemy.hp -= bullet.damage;
      enemy.braceTimer = Math.max(enemy.braceTimer, 0.4);
      enemy.hitFlash = 1;
      enemy.flinchTimer = 0.16;
      spawnImpactBurst(bullet.x, bullet.y, ["#ff7a45", "#ffe6c9", "rgba(126, 26, 45, 0.5)"], 3.4);

      if (enemy.hp <= 0) {
        enemy.dead = true;
        enemy.deadTimer = 5.2;
        gameState.cash += 75;
        gameState.message = "Enemy squad neutralized.";
        statusText.textContent = gameState.message;
        emitSound(enemy.x, enemy.y, 120, "body", 0.4);
      }

      syncHud();
      return false;
    }

    return true;
  });

  gameState.enemyBullets = gameState.enemyBullets.filter((bullet) => {
    const hitSurface = getBulletCollisionSurface(bullet);
    const hitObstacle = Boolean(hitSurface);

    if (
      bullet.life <= 0 ||
      bullet.x < 0 ||
      bullet.y < 0 ||
      bullet.x > WORLD.width ||
      bullet.y > WORLD.height ||
      hitObstacle
    ) {
      if (hitObstacle) {
        if (hitSurface.kind === "window") {
          const matchingWindow = findWindowById(hitSurface.id);
          if (matchingWindow) {
            matchingWindow.broken = true;
            window.__raidRuntime?.publishWorldAction({
              type: "window",
              id: matchingWindow.id,
              broken: true,
            });
          }
          spawnImpactBurst(bullet.x, bullet.y, ["#a8d8f3", "#f4fbff", "rgba(146, 166, 182, 0.5)"], 3);
        }
        spawnImpactBurst(bullet.x, bullet.y, ["#ab4458", "#ffd6de", "rgba(56, 66, 78, 0.34)"], 2.4);
      }
      return false;
    }

    if (isRaidHost()) {
      for (const remote of gameState.remotePlayers) {
        const remoteRadius = remote.radius || 15;
        if (distance(bullet, remote) > remoteRadius + bullet.radius) {
          continue;
        }

        const patch = {
          hp: typeof remote.hp === "number" ? remote.hp : 100,
          maxHp: typeof remote.maxHp === "number" ? remote.maxHp : 100,
          shieldEquipped: Boolean(remote.shieldEquipped),
          shieldHp: typeof remote.shieldHp === "number" ? remote.shieldHp : 0,
        };

        if (playerShieldBlocksBullet(remote, bullet)) {
          patch.shieldHp -= bullet.damage;
          if (patch.shieldHp <= 0) {
            patch.shieldHp = 0;
            patch.shieldEquipped = false;
          }
        } else {
          patch.hp -= bullet.damage;
        }

        applyPlayerPatchLocally(remote.id, patch);
        window.__raidRuntime?.publishPlayerPatch(remote.id, patch);
        return false;
      }
    }

    if (distance(bullet, gameState.player) <= gameState.player.radius + bullet.radius) {
      if (gameState.spawnGrace > 0) {
        return false;
      }

      if (playerShieldBlocksBullet(gameState.player, bullet)) {
        gameState.player.shieldHp -= bullet.damage;
        gameState.player.shieldFlash = 1;
        gameState.player.shake = Math.max(gameState.player.shake, 4.5);
        spawnImpactBurst(bullet.x, bullet.y, ["#7ab7d8", "#dff6ff", "rgba(38, 73, 94, 0.36)"], 4.4);

        if (gameState.player.shieldHp <= 0) {
          gameState.player.shieldEquipped = false;
          gameState.player.shieldHp = 0;
          gameState.message = "Side shield shattered.";
        } else {
          gameState.message = "Shield absorbed the hit.";
        }

        statusText.textContent = gameState.message;
        syncHud();
        return false;
      }

      gameState.player.hp -= bullet.damage;
      spawnImpactBurst(bullet.x, bullet.y, ["#ff5d73", "#ffd6de", "rgba(122, 18, 39, 0.44)"], 4.2);
      gameState.player.shake = Math.max(gameState.player.shake, 6.5);
      gameState.player.hitFlash = 1;
      gameState.message = "You are taking fire.";
      statusText.textContent = gameState.message;
      playGameSound("hit");
      syncHud();

      if (gameState.player.hp <= 0) {
        endGame(false, `You were dropped carrying ${gameState.lootCollected} relay cores and $${gameState.cash}.`);
      }

      return false;
    }

    return true;
  });
}

function updateEnemies(dt) {
  const player = gameState.player;

  for (const enemy of gameState.enemies) {
    if (enemy.dead) {
      enemy.deadTimer = Math.max(0, enemy.deadTimer - dt);
      continue;
    }

    enemy.justAlerted = false;
    enemy.shieldFlash = Math.max(0, enemy.shieldFlash - dt * 3);
    enemy.braceTimer = Math.max(0, enemy.braceTimer - dt);
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 3.6);
    enemy.muzzleFlash = Math.max(0, enemy.muzzleFlash - dt * 5);
    enemy.flinchTimer = Math.max(0, enemy.flinchTimer - dt);
    const toPlayer = distance(enemy, player);
    const chaseAngle = angleTo(enemy, player);
    const nearIncomingFire = enemy.shieldEquipped && gameState.bullets.some((bullet) => distance(enemy, bullet) < 130);
    const squadLead = getShieldLead(enemy);
    const shieldLeadDrivingPush =
      squadLead && squadLead !== enemy && squadLead.state === "hunt" && (squadLead.braceTimer > 0.1 || distance(squadLead, player) < 220);

    if (nearIncomingFire) {
      enemy.braceTimer = Math.max(enemy.braceTimer, 0.65);
    }

    if (enemy.shieldEquipped && player.shotCooldown > 0 && toPlayer < 240) {
      enemy.braceTimer = Math.max(enemy.braceTimer, 0.38);
    }

    const visiblePlayer =
      gameState.spawnGrace <= 0 &&
      canSeeTarget(enemy, player, enemy.viewRange, enemy.viewCone, enemy.aimAngle, 26);

    if (visiblePlayer) {
      const braceAim =
        enemy.shieldEquipped && enemy.braceTimer > 0
          ? chaseAngle - enemy.shieldSide * Math.PI * 0.5
          : chaseAngle;
      enemy.aimAngle = turnToward(enemy.aimAngle, braceAim, dt * (enemy.braceTimer > 0 ? 9.6 : 7.2));
      enemy.state = "hunt";
      enemy.lastSeenX = player.x;
      enemy.lastSeenY = player.y;
      enemy.searchTimer = 3.8;

      if (enemy.seenTimer <= 0) {
        enemy.justAlerted = true;
        notifyNearbyEnemies(enemy, player.x, player.y);
        if (enemy.squadRole === "shieldLead") {
          for (const ally of getSquadmates(enemy)) {
            if (ally === enemy) {
              continue;
            }

            ally.state = "hunt";
            ally.lastSeenX = player.x;
            ally.lastSeenY = player.y;
            ally.searchTimer = 3.4;
            ally.coverTimer = 0;

            if (ally.kind !== "guard") {
              ally.tactic = ally.squadRole === "flankLeft" ? "flankLeft" : ally.squadRole === "flankRight" ? "flankRight" : "assault";
            }
          }
        }
        playGameSound("alert");
        gameState.message = "Enemy contact. They have visual on you.";
        statusText.textContent = gameState.message;
      }

      enemy.seenTimer = 1.15;
    } else {
      enemy.seenTimer = Math.max(0, enemy.seenTimer - dt);
    }

    if (enemy.state !== "hunt" && gameState.spawnGrace <= 0) {
      for (const soundEvent of gameState.soundEvents) {
        const heardDistance = distance(enemy, soundEvent);
        const effectiveRange = Math.min(soundEvent.radius, enemy.hearingRange + soundEvent.radius * 0.4);

        if (heardDistance > effectiveRange) {
          continue;
        }

        enemy.state = "investigate";
        enemy.investigateX = soundEvent.x;
        enemy.investigateY = soundEvent.y;
        enemy.searchTimer = 2.6 + soundEvent.intensity * 1.3;
        break;
      }
    }

    enemy.cooldown -= dt;
    enemy.coverTimer -= dt;

    if (enemy.state === "hunt") {
      const desiredDistance = enemy.kind === "guard" ? 210 : shieldLeadDrivingPush ? 118 : 145;
      const prefersCover = enemy.kind === "guard" || enemy.tactic === "anchor";
      const shouldFlank = enemy.tactic === "flankLeft" || enemy.tactic === "flankRight" || shieldLeadDrivingPush;
      const coverTarget =
        enemy.coverTimer <= 0 || !enemy.coverX
          ? findCoverPosition(enemy, player)
          : { x: enemy.coverX, y: enemy.coverY };

      if (!visiblePlayer) {
        enemy.state = "search";
      } else if (enemy.shieldEquipped && enemy.braceTimer > 0) {
        moveEntityToward(
          enemy,
          enemy.x + Math.cos(chaseAngle) * 48,
          enemy.y + Math.sin(chaseAngle) * 48,
          enemy.speed * 0.72,
          dt
        );
      } else if (enemy.flinchTimer > 0) {
        moveEntityToward(
          enemy,
          enemy.x - Math.cos(chaseAngle) * 46,
          enemy.y - Math.sin(chaseAngle) * 46,
          enemy.speed * 0.42,
          dt
        );
      } else if (prefersCover && coverTarget && toPlayer > desiredDistance * 0.72) {
        enemy.coverX = coverTarget.x;
        enemy.coverY = coverTarget.y;
        enemy.coverTimer = 1.1;
        moveEntityToward(enemy, coverTarget.x, coverTarget.y, enemy.speed * 0.98, dt);
      } else if (shouldFlank && toPlayer > 100) {
        const flankTarget = getFlankTarget(enemy, player);
        moveEntityToward(enemy, flankTarget.x, flankTarget.y, enemy.speed * 1.04, dt);
      } else if (toPlayer > desiredDistance) {
        moveEntityToward(enemy, player.x, player.y, enemy.speed * (enemy.kind === "rusher" ? 1.1 : 0.94), dt);
      } else if (toPlayer < desiredDistance - 42) {
        moveEntityToward(
          enemy,
          enemy.x - Math.cos(chaseAngle) * 120,
          enemy.y - Math.sin(chaseAngle) * 120,
          enemy.speed * 0.72,
          dt
        );
      } else {
        const strafeAngle =
          chaseAngle +
          enemy.strafeBias * (enemy.tactic === "assault" ? Math.PI * 0.42 : Math.PI * 0.58);
        moveEntityToward(
          enemy,
          enemy.x + Math.cos(strafeAngle) * 118,
          enemy.y + Math.sin(strafeAngle) * 118,
          enemy.speed * 0.72,
          dt
        );
      }

      if (enemy.cooldown <= 0 && visiblePlayer && toPlayer < enemy.viewRange - 25 && enemy.braceTimer <= 0.08 && enemy.flinchTimer <= 0.04) {
        const bulletSpeed = enemy.kind === "guard" ? 430 : 390;
        const leadTime = clamp(toPlayer / bulletSpeed, 0.05, 0.28);
        const predictedTarget = {
          x: player.x + player.vx * leadTime,
          y: player.y + player.vy * leadTime,
        };
        const volleyCount = enemy.kind === "guard" ? 2 : 1;
        const baseShotAngle = angleTo(enemy, predictedTarget);
        enemy.aimAngle = turnToward(enemy.aimAngle, baseShotAngle, dt * 11);

        for (let volley = 0; volley < volleyCount; volley += 1) {
          const spread = (volley - (volleyCount - 1) * 0.5) * 0.055 + (Math.random() - 0.5) * 0.03;
          fireBullet(enemy, enemy.aimAngle + spread, bulletSpeed, true, enemy.damage);
        }

        emitSound(enemy.x, enemy.y, 220, "enemyShot", 0.8);
        playGameSound("enemyShot");
        enemy.cooldown = enemy.fireRate + Math.random() * 0.16;
        enemy.strafeBias *= -1;
        enemy.muzzleFlash = 0.08;
      }
    } else if (enemy.state === "investigate") {
      const investigateTarget = { x: enemy.investigateX, y: enemy.investigateY };
      const reachedTarget = distance(enemy, investigateTarget) < 20;

      if (!reachedTarget) {
        moveEntityToward(enemy, investigateTarget.x, investigateTarget.y, enemy.speed * 0.72, dt);
        enemy.aimAngle = turnToward(enemy.aimAngle, angleTo(enemy, investigateTarget), dt * 3.9);
      } else {
        enemy.wanderAngle += dt * 1.8;
        enemy.aimAngle = turnToward(enemy.aimAngle, enemy.wanderAngle, dt * 3.2);
      }

      enemy.searchTimer -= dt;

      if (enemy.searchTimer <= 0 || reachedTarget) {
        enemy.state = "search";
        enemy.lastSeenX = investigateTarget.x;
        enemy.lastSeenY = investigateTarget.y;
        enemy.searchTimer = 2.2;
      }
    } else if (enemy.state === "search") {
      enemy.searchTimer -= dt;
      enemy.wanderAngle += dt * (enemy.kind === "guard" ? 1.8 : 2.2) * enemy.strafeBias;
      enemy.aimAngle = turnToward(enemy.aimAngle, enemy.wanderAngle, dt * 2.9);
      moveEntityToward(
        enemy,
        enemy.lastSeenX + Math.cos(enemy.wanderAngle) * 60,
        enemy.lastSeenY + Math.sin(enemy.wanderAngle) * 60,
        enemy.speed * 0.38,
        dt
      );

      if (enemy.searchTimer <= 0) {
        enemy.state = "patrol";
      }
    } else {
      enemy.wanderAngle += (Math.random() - 0.5) * 0.42;
      enemy.aimAngle = turnToward(enemy.aimAngle, enemy.wanderAngle, dt * 2.5);
      moveEntityToward(
        enemy,
        enemy.x + Math.cos(enemy.wanderAngle) * 80,
        enemy.y + Math.sin(enemy.wanderAngle) * 80,
        enemy.speed * 0.28,
        dt
      );
    }
  }
}

function updateSyncedCombat(dt) {
  for (const bullet of gameState.bullets) {
    bullet.prevX = bullet.x;
    bullet.prevY = bullet.y;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
  }

  for (const bullet of gameState.enemyBullets) {
    bullet.prevX = bullet.x;
    bullet.prevY = bullet.y;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
  }

  gameState.bullets = gameState.bullets.filter((bullet) => bullet.life > 0);
  gameState.enemyBullets = gameState.enemyBullets.filter((bullet) => bullet.life > 0);

  for (const enemy of gameState.enemies) {
    enemy.shieldFlash = Math.max(0, (enemy.shieldFlash || 0) - dt * 3);
    enemy.hitFlash = Math.max(0, (enemy.hitFlash || 0) - dt * 3.6);
    enemy.muzzleFlash = Math.max(0, (enemy.muzzleFlash || 0) - dt * 5);
    enemy.flinchTimer = Math.max(0, (enemy.flinchTimer || 0) - dt);
    enemy.deadTimer = Math.max(0, (enemy.deadTimer || 0) - dt);
  }
}

function updateParticles(dt) {
  for (const particle of gameState.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
  }

  gameState.particles = gameState.particles.filter((particle) => particle.life > 0);
}

function updateHeat() {
  const nextHeat = 1 + Math.floor((gameState.elapsed / gameState.duration) * 4);

  if (nextHeat !== gameState.heat) {
    gameState.heat = nextHeat;
    gameState.message = `District heat increased to ${gameState.heat}.`;
    statusText.textContent = gameState.message;
    syncHud();
  }
}

function updateCamera() {
  const viewWidth = canvas.width / CAMERA_ZOOM;
  const viewHeight = canvas.height / CAMERA_ZOOM;
  gameState.camera.x = clamp(gameState.player.x - viewWidth / 2, 0, WORLD.width - viewWidth);
  gameState.camera.y = clamp(gameState.player.y - viewHeight / 2, 0, WORLD.height - viewHeight);
  pointer.worldX = gameState.camera.x + pointer.x / CAMERA_ZOOM;
  pointer.worldY = gameState.camera.y + pointer.y / CAMERA_ZOOM;
}

function update(dt) {
  if (!gameState.running) {
    interactPrompt.classList.remove("is-visible");
    return;
  }

  if (isRaidHost()) {
    gameState.elapsed += dt;
  }

  if (gameState.elapsed >= gameState.duration) {
    endGame(false, `Lockdown closed the district. You escaped with $${gameState.cash}, but not the package.`);
    return;
  }

  if (isRaidHost()) {
    gameState.spawnGrace = Math.max(0, gameState.spawnGrace - dt);
  }

  updatePlayer(dt);
  if (isRaidHost()) {
    updateBullets(dt);
    updateEnemies(dt);
    updateHeat();
  } else {
    updateSyncedCombat(dt);
  }
  updateAwarenessState();
  updateParticles(dt);
  updateSoundEvents(dt);
  updateCamera();
  const takedownTarget = getTakedownTarget();
  gameState.player.knifeReady = Boolean(takedownTarget);
  const interactionTarget = getInteractionTarget();
  interactPrompt.textContent = takedownTarget ? "Press F to perform knife takedown" : interactionTarget || "Press E to interact";
  interactPrompt.classList.toggle("is-visible", Boolean(takedownTarget || interactionTarget));
  syncHud();
}

function drawGrid() {
  const size = 60;
  const startX = -((gameState.camera.x % size) + size) % size;
  const startY = -((gameState.camera.y % size) + size) % size;

  ctx.strokeStyle = "rgba(94, 109, 124, 0.12)";
  ctx.lineWidth = 1;

  for (let x = startX; x < canvas.width; x += size) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = startY; y < canvas.height; y += size) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(94, 109, 124, 0.08)";
  ctx.lineWidth = 1.25;

  for (let x = startX; x < canvas.width; x += size * 4) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = startY; y < canvas.height; y += size * 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawWorld() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#c8d1d9";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const shakeX = (Math.random() - 0.5) * gameState.player.shake * 2.2;
  const shakeY = (Math.random() - 0.5) * gameState.player.shake * 2.2;

  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawGrid();

  const gradient = ctx.createRadialGradient(
    canvas.width * 0.5,
    canvas.height * 0.5,
    40,
    canvas.width * 0.5,
    canvas.height * 0.5,
    canvas.width * 0.8
  );
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.18)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const ambientGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  ambientGradient.addColorStop(0, "rgba(255, 255, 255, 0.05)");
  ambientGradient.addColorStop(0.45, "rgba(103, 116, 129, 0.04)");
  ambientGradient.addColorStop(1, "rgba(31, 42, 51, 0.04)");
  ctx.fillStyle = ambientGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
  ctx.translate(-gameState.camera.x, -gameState.camera.y);

  drawExtractionZone();
  drawObstacles();
  drawLoot();
  drawRemotePlayers();
  drawEnemies();
  drawBullets();
  drawPlayer();
  drawParticles();
  drawSoundEvents();

  ctx.restore();

  drawCombatOverlay();
  drawCompass();
}

function drawObstacles() {
  for (const building of buildings) {
    ctx.fillStyle = "rgba(182, 192, 201, 0.22)";
    ctx.fillRect(building.x + 12, building.y + 12, building.w - 24, building.h - 24);
    ctx.strokeStyle = "rgba(115, 129, 143, 0.12)";
    ctx.strokeRect(building.x + 16, building.y + 16, building.w - 32, building.h - 32);
  }

  for (const obstacle of getWorldObstacles()) {
    if (obstacle.kind === "window") {
      ctx.fillStyle = "rgba(163, 205, 226, 0.48)";
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
      ctx.strokeStyle = "rgba(237, 249, 255, 0.62)";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
      continue;
    }

    if (obstacle.kind === "door") {
      ctx.fillStyle = "rgba(98, 112, 126, 0.92)";
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
      ctx.strokeStyle = "rgba(232, 239, 245, 0.36)";
      ctx.strokeRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
      continue;
    }

    const obstacleGradient = ctx.createLinearGradient(obstacle.x, obstacle.y, obstacle.x, obstacle.y + obstacle.h);
    obstacleGradient.addColorStop(0, "#aeb9c3");
    obstacleGradient.addColorStop(1, "#8795a2");
    ctx.fillStyle = obstacleGradient;
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
    ctx.strokeStyle = "rgba(45, 61, 77, 0.3)";
    ctx.strokeRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);

    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    ctx.fillRect(obstacle.x + 6, obstacle.y + 6, obstacle.w - 12, 12);

    ctx.fillStyle = "rgba(45, 61, 77, 0.08)";
    for (let y = obstacle.y + 22; y < obstacle.y + obstacle.h - 10; y += 24) {
      ctx.fillRect(obstacle.x + 10, y, obstacle.w - 20, 2);
    }
  }
}

function drawSoundEvents() {
  for (const soundEvent of gameState.soundEvents) {
    const progress = 1 - soundEvent.ttl / soundEvent.maxTtl;
    const radius = soundEvent.radius * progress;
    const alpha = (1 - progress) * 0.22;

    ctx.beginPath();
    ctx.arc(soundEvent.x, soundEvent.y, Math.max(12, radius), 0, Math.PI * 2);
    ctx.strokeStyle =
      soundEvent.kind === "shot" || soundEvent.kind === "enemyShot"
        ? `rgba(157, 118, 72, ${alpha})`
        : soundEvent.kind === "decoy"
          ? `rgba(84, 130, 164, ${alpha + 0.08})`
        : `rgba(116, 130, 144, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawVisibilityMask() {
  const player = gameState.player;
  const playerScreenX = player.x - gameState.camera.x;
  const playerScreenY = player.y - gameState.camera.y;
  const coneStart = player.angle - player.viewCone * 0.5;
  const coneEnd = player.angle + player.viewCone * 0.5;

  ctx.save();
  ctx.fillStyle = "rgba(188, 198, 209, 0.12)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "destination-out";

  ctx.beginPath();
  ctx.arc(playerScreenX, playerScreenY, player.closeViewRange, 0, Math.PI * 2);
  ctx.fill();

  const gradient = ctx.createRadialGradient(
    playerScreenX,
    playerScreenY,
    player.closeViewRange * 0.45,
    playerScreenX,
    playerScreenY,
    player.viewRange
  );
  gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
  gradient.addColorStop(0.55, "rgba(0, 0, 0, 0.18)");
  gradient.addColorStop(0.82, "rgba(0, 0, 0, 0.34)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(playerScreenX, playerScreenY);
  ctx.arc(playerScreenX, playerScreenY, player.viewRange, coneStart, coneEnd);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(78, 95, 112, 0.16)";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(playerScreenX, playerScreenY, player.viewRange - 6, coneStart, coneEnd);
  ctx.stroke();
  ctx.restore();
}

function drawExtractionZone() {
  const extractionVisible =
    rectContains(extractionZone, gameState.player.x, gameState.player.y) ||
    canPlayerSee({
      x: extractionZone.x + extractionZone.w * 0.5,
      y: extractionZone.y + extractionZone.h * 0.5,
    });
  const baseAlpha = extractionVisible ? 1 : 0.4;
  const pulse = 0.6 + Math.sin(performance.now() * 0.004) * 0.2;
  ctx.fillStyle = `rgba(170, 188, 201, ${(0.14 + pulse * 0.08) * baseAlpha})`;
  ctx.fillRect(extractionZone.x, extractionZone.y, extractionZone.w, extractionZone.h);
  ctx.strokeStyle = `rgba(126, 143, 159, ${0.8 * baseAlpha})`;
  ctx.lineWidth = 3;
  ctx.strokeRect(extractionZone.x, extractionZone.y, extractionZone.w, extractionZone.h);

  ctx.fillStyle = `rgba(99, 116, 132, ${baseAlpha})`;
  ctx.font = '16px Consolas';
  ctx.fillText("EXTRACT", extractionZone.x + 36, extractionZone.y + extractionZone.h / 2 + 6);

  if (rectContains(extractionZone, gameState.player.x, gameState.player.y)) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
    ctx.setLineDash([8, 8]);
    ctx.strokeRect(extractionZone.x - 6, extractionZone.y - 6, extractionZone.w + 12, extractionZone.h + 12);
    ctx.setLineDash([]);
  }
}

function drawLoot() {
  for (const loot of gameState.loot) {
    if (loot.collected || !canPlayerSee(loot)) {
      continue;
    }

    loot.pulse += 0.08;
    const radius = loot.radius + Math.sin(loot.pulse) * 1.2;
    const isCore = loot.type === "core";
    const isShield = loot.type === "shield";
    const isMedkit = loot.type === "medkit";
    const isNoise = loot.type === "noise";
    const fill = isCore ? "#27c59a" : isShield ? "#7aaed0" : isMedkit ? "#0f8e79" : isNoise ? "#5e88a6" : "#d7a13a";
    const glow = isCore
      ? "rgba(39, 197, 154, 0.2)"
      : isShield
        ? "rgba(122, 174, 208, 0.2)"
        : isMedkit
          ? "rgba(15, 142, 121, 0.2)"
          : isNoise
            ? "rgba(94, 136, 166, 0.18)"
        : "rgba(215, 161, 58, 0.18)";

    ctx.beginPath();
    ctx.arc(loot.x, loot.y, radius + 6, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    if (isCore) {
      ctx.save();
      ctx.translate(loot.x, loot.y);
      ctx.rotate(Math.PI * 0.25);
      ctx.fillStyle = fill;
      ctx.strokeStyle = "rgba(24, 35, 46, 0.72)";
      ctx.lineWidth = 2;
      ctx.fillRect(-9, -9, 18, 18);
      ctx.strokeRect(-9, -9, 18, 18);
      ctx.restore();
    } else if (isShield) {
      ctx.save();
      ctx.translate(loot.x, loot.y);
      ctx.fillStyle = "#233340";
      ctx.beginPath();
      ctx.roundRect(-7, -11, 14, 22, 5);
      ctx.fill();
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(-4, -9, 8, 18, 3);
      ctx.fill();
      ctx.strokeStyle = "rgba(233, 248, 255, 0.58)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-1, -7);
      ctx.lineTo(-1, 7);
      ctx.stroke();
      ctx.restore();
    } else if (isMedkit) {
      ctx.beginPath();
      ctx.roundRect(loot.x - 10, loot.y - 8, 20, 16, 4);
      ctx.fillStyle = "#e8f7f0";
      ctx.fill();
      ctx.strokeStyle = "rgba(24, 35, 46, 0.68)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = fill;
      ctx.fillRect(loot.x - 3, loot.y - 6, 6, 12);
      ctx.fillRect(loot.x - 7, loot.y - 2, 14, 4);
    } else if (isNoise) {
      ctx.beginPath();
      ctx.arc(loot.x, loot.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = "#f1f7fb";
      ctx.fill();
      ctx.strokeStyle = "rgba(24, 35, 46, 0.68)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(loot.x, loot.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.roundRect(loot.x - 10, loot.y - 7, 20, 14, 4);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = "rgba(24, 35, 46, 0.68)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(loot.x, loot.y, radius + 2, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.44)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (distance(gameState.player, loot) <= gameState.player.interactRadius) {
      ctx.beginPath();
      ctx.arc(loot.x, loot.y, loot.radius + 12, 0, Math.PI * 2);
      ctx.strokeStyle = isCore
        ? "rgba(39, 197, 154, 0.52)"
        : isShield
          ? "rgba(122, 174, 208, 0.54)"
          : isMedkit
            ? "rgba(15, 142, 121, 0.48)"
            : isNoise
              ? "rgba(94, 136, 166, 0.48)"
          : "rgba(215, 161, 58, 0.48)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

function drawRemotePlayers() {
  if (!gameState?.remotePlayers?.length) {
    return;
  }

  for (const remote of gameState.remotePlayers) {
    if (!remote.running || !canPlayerSee(remote)) {
      continue;
    }

    const remoteSprite = loadSprite(CHARACTER_SPRITES[remote.className] || CHARACTER_SPRITES.stealther);
    if (drawCharacterSprite(remoteSprite, remote.x, remote.y, remote.angle || 0, 92, 92)) {
      ctx.fillStyle = "rgba(17, 32, 51, 0.74)";
      ctx.font = '12px Consolas';
      ctx.fillText(remote.className || "ally", remote.x - 18, remote.y - 26);
      continue;
    }

    ctx.save();
    ctx.translate(remote.x, remote.y);
    ctx.rotate(remote.angle || 0);

    if (remote.shieldEquipped) {
      ctx.fillStyle = "rgba(16, 24, 33, 0.18)";
      ctx.beginPath();
      ctx.ellipse(-2, 18, 21, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#6f7d89";
    ctx.beginPath();
    ctx.arc(-9, -5, 4.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-9, 6, 4.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ecf3f8";
    ctx.strokeStyle = "rgba(27, 38, 49, 0.72)";
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    ctx.ellipse(-3, 0, 12, 10.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(5, -5, remote.className === "breacher" ? 28 : remote.className === "marksman" ? 38 : 30, 10, 3);
    ctx.fillStyle = "#22303c";
    ctx.fill();

    ctx.fillStyle = remote.className === "stealther" ? "#0f8e79" : remote.className === "breacher" ? "#d96a32" : "#5a7ca8";
    ctx.fillRect(-1, -5, 5, 10);

    if (remote.shieldEquipped) {
      ctx.fillStyle = "rgba(28, 46, 59, 0.86)";
      ctx.beginPath();
      ctx.roundRect(-4, 7, 10, 22, 5);
      ctx.fill();
    }

    ctx.restore();

    ctx.fillStyle = "rgba(17, 32, 51, 0.74)";
    ctx.font = '12px Consolas';
    ctx.fillText(remote.className || "ally", remote.x - 18, remote.y - 26);
  }
}

function drawEnemies() {
  for (const enemy of gameState.enemies) {
    if (enemy.dead) {
      if (enemy.deadTimer > 0 && canPlayerSee(enemy)) {
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(enemy.aimAngle + Math.PI * 0.3);
        ctx.globalAlpha = Math.min(0.55, enemy.deadTimer * 0.16);
        ctx.fillStyle = "rgba(34, 44, 53, 0.45)";
        ctx.beginPath();
        ctx.ellipse(0, 0, enemy.radius + 9, enemy.radius - 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      continue;
    }

    const visible = canPlayerSee(enemy);

    if (!visible) {
      continue;
    }

    if (enemy.state === "hunt") {
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius + 13, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(194, 73, 98, 0.22)";
      ctx.lineWidth = 1.8;
      ctx.stroke();
    } else if (enemy.state === "investigate") {
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius + 11, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(184, 137, 55, 0.2)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (enemy.state === "search") {
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius + 10, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(103, 120, 136, 0.16)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    const enemySprite = getSpriteForEnemy(enemy);
    if (drawCharacterSprite(enemySprite, enemy.x, enemy.y, enemy.aimAngle, enemy.kind === "guard" ? 92 : 86, enemy.kind === "guard" ? 92 : 86)) {
      if (enemy.justAlerted) {
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 10, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 93, 115, 0.65)";
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
      ctx.fillRect(enemy.x - 18, enemy.y - enemy.radius - 12, 36, 5);
      ctx.fillStyle = "#ff9baa";
      ctx.fillRect(enemy.x - 18, enemy.y - enemy.radius - 12, 36 * (enemy.hp / enemy.maxHp), 5);
      continue;
    }

    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.aimAngle);

    if (enemy.shieldEquipped) {
      ctx.fillStyle = "rgba(16, 24, 32, 0.18)";
      ctx.beginPath();
      ctx.ellipse(-2, enemy.radius + 6, enemy.radius + 6, enemy.radius * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = enemy.kind === "guard" ? "#6b5549" : "#5a4850";
    ctx.beginPath();
    ctx.arc(-8, -6, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-8, 6, 4.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(-8, -5, 22, 10, 4);
    ctx.fillStyle = "#2a3642";
    ctx.fill();

    if (enemy.shieldEquipped) {
      const shieldRatio = enemy.shieldHp / enemy.maxShieldHp;
      ctx.fillStyle = `rgba(28, 46, 59, ${0.82 + enemy.shieldFlash * 0.14})`;
      ctx.beginPath();
      ctx.roundRect(-4, 7, 10, 22, 5);
      ctx.fill();

      ctx.fillStyle = shieldRatio > 0.45 ? "#79b3cf" : shieldRatio > 0.18 ? "#d8a45c" : "#cf6678";
      ctx.beginPath();
      ctx.roundRect(-1, 9, 5, 18, 3);
      ctx.fill();

      ctx.strokeStyle = `rgba(233, 248, 255, ${0.48 + enemy.shieldFlash * 0.3})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(1.5, 11);
      ctx.lineTo(1.5, 25);
      ctx.stroke();
    }

    ctx.fillStyle = enemy.hitFlash > 0 ? "#fff4df" : enemy.kind === "guard" ? "#ef9750" : "#ef6b82";
    ctx.strokeStyle = "rgba(22, 32, 43, 0.8)";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(-1, 0, enemy.radius - 1, enemy.radius - 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(-2, -6, 10, 12, 3);
    ctx.fillStyle = enemy.kind === "guard" ? "#ffcb95" : "#ffc1cb";
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.76)";
    ctx.beginPath();
    ctx.arc(6, -2, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(6, -4, 24, 8, 3);
    ctx.fillStyle = "#1b2630";
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(26, -2.5, 10, 5, 2);
    ctx.fillStyle = "#5f7180";
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.34)";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(10, -2);
    ctx.lineTo(28, -2);
    ctx.stroke();

    ctx.strokeStyle = enemy.kind === "guard" ? "rgba(255, 220, 176, 0.9)" : "rgba(255, 211, 220, 0.9)";
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(35, -1);
    ctx.lineTo(42, -1);
    ctx.stroke();

    if (enemy.muzzleFlash > 0) {
      ctx.fillStyle = `rgba(237, 186, 93, ${enemy.muzzleFlash * 10})`;
      ctx.beginPath();
      ctx.moveTo(41, 0);
      ctx.lineTo(56, -4);
      ctx.lineTo(49, 0);
      ctx.lineTo(56, 4);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();

    if (enemy.justAlerted) {
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius + 10, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 93, 115, 0.65)";
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    ctx.fillRect(enemy.x - 18, enemy.y - enemy.radius - 12, 36, 5);
    ctx.fillStyle = "#ff9baa";
    ctx.fillRect(enemy.x - 18, enemy.y - enemy.radius - 12, 36 * (enemy.hp / enemy.maxHp), 5);
  }
}

function drawBullets() {
  for (const bullet of gameState.bullets) {
    if (!canPlayerSee(bullet) && distance(gameState.player, bullet) > gameState.player.closeViewRange) {
      continue;
    }

    ctx.strokeStyle = "rgba(230, 183, 72, 0.26)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(bullet.prevX, bullet.prevY);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();

    ctx.strokeStyle = "rgba(96, 67, 16, 0.9)";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(bullet.prevX, bullet.prevY);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius + 0.6, 0, Math.PI * 2);
    ctx.fillStyle = "#8f6820";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, Math.max(1.6, bullet.radius - 0.6), 0, Math.PI * 2);
    ctx.fillStyle = "#ffe2a4";
    ctx.fill();
  }

  for (const bullet of gameState.enemyBullets) {
    if (!canPlayerSee(bullet) && distance(gameState.player, bullet) > gameState.player.closeViewRange) {
      continue;
    }

    ctx.strokeStyle = "rgba(255, 103, 131, 0.28)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(bullet.prevX, bullet.prevY);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();

    ctx.strokeStyle = "rgba(147, 38, 58, 0.94)";
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(bullet.prevX, bullet.prevY);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius + 0.8, 0, Math.PI * 2);
    ctx.fillStyle = "#ab4458";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, Math.max(1.8, bullet.radius - 0.7), 0, Math.PI * 2);
    ctx.fillStyle = "#ffd6de";
    ctx.fill();
  }
}

function drawPlayer() {
  const player = gameState.player;
  const playerSprite = getSpriteForPlayer(player);
  if (drawCharacterSprite(playerSprite, player.x, player.y, player.angle, 92, 92)) {
    return;
  }

  const weapon = player.weapon;
  const stride = Math.sin(player.stride) * 2.2;
  const recoilOffset = player.recoil * 8.8;
  const shieldRatio = player.shieldEquipped ? player.shieldHp / player.maxShieldHp : 0;
  const gunBodyLength = weapon.className === "breacher" ? 28 : weapon.className === "marksman" ? 38 : 30;
  const muzzleLength = weapon.className === "breacher" ? 8 : weapon.className === "marksman" ? 15 : 10;
  const gunHeight = weapon.className === "breacher" ? 13 : weapon.className === "marksman" ? 9 : 10;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  if (player.shieldEquipped) {
    ctx.fillStyle = "rgba(16, 24, 33, 0.22)";
    ctx.beginPath();
    ctx.ellipse(-2, 18, 21, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#4e5964";
  ctx.beginPath();
  ctx.arc(-9, -6 + stride * 0.24, 4.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(-9, 7 - stride * 0.24, 4.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f5f8fb";
  ctx.strokeStyle = "rgba(27, 38, 49, 0.9)";
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.ellipse(-3, 0, 12, 10.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(-9, -4.5, 10, 9, 3);
  ctx.fillStyle = "#2b3641";
  ctx.fill();

  ctx.beginPath();
  ctx.roundRect(-3, -6.5, 10, 13, 3);
  ctx.fillStyle = "#8ea8bc";
  ctx.fill();

  ctx.fillStyle = "#0f8e79";
  ctx.fillRect(3, -5, 4, 10);

  if (player.shieldEquipped) {
    ctx.fillStyle = "rgba(18, 28, 38, 0.16)";
    ctx.beginPath();
    ctx.ellipse(-1, 18, 9, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(28, 46, 59, ${0.84 + player.shieldFlash * 0.14})`;
    ctx.beginPath();
    ctx.roundRect(-4, 7, 10, 22, 5);
    ctx.fill();

    ctx.fillStyle = shieldRatio > 0.45 ? "#79b3cf" : shieldRatio > 0.18 ? "#d8a45c" : "#cf6678";
    ctx.beginPath();
    ctx.roundRect(-1, 9, 5, 18, 3);
    ctx.fill();

    ctx.strokeStyle = `rgba(233, 248, 255, ${0.48 + player.shieldFlash * 0.34})`;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(1.5, 11);
    ctx.lineTo(1.5, 25);
    ctx.stroke();

    ctx.strokeStyle = `rgba(17, 27, 35, ${0.44 + player.shieldFlash * 0.22})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-2.5, 10);
    ctx.lineTo(-2.5, 26);
    ctx.stroke();
  }

  if (player.knifeReady || player.knifeTimer > 0) {
    const knifeAlpha = player.knifeTimer > 0 ? 0.92 : 0.7;
    ctx.fillStyle = `rgba(35, 46, 57, ${knifeAlpha})`;
    ctx.beginPath();
    ctx.roundRect(-15, -3, 8, 6, 2);
    ctx.fill();

    ctx.fillStyle = `rgba(226, 234, 239, ${knifeAlpha})`;
    ctx.beginPath();
    ctx.moveTo(-15, 0);
    ctx.lineTo(-27, -3);
    ctx.lineTo(-27, 3);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = "rgba(38, 52, 65, 0.94)";
  ctx.beginPath();
  ctx.arc(5, -2, 2.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.roundRect(5 - recoilOffset, -(gunHeight * 0.5), gunBodyLength, gunHeight, 3.5);
  ctx.fillStyle = "#111b23";
  ctx.fill();

  ctx.beginPath();
  ctx.roundRect(5 + gunBodyLength - 4 - recoilOffset, -2.5, muzzleLength, 5, 2);
  ctx.fillStyle = "#70818f";
  ctx.fill();

  ctx.beginPath();
  ctx.roundRect(0 - recoilOffset, -3.5, 8, 7, 2);
  ctx.fillStyle = "#42505d";
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.48)";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(8 - recoilOffset, -2);
  ctx.lineTo(5 + gunBodyLength - 2 - recoilOffset, -2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(8 - recoilOffset, -4, 3.3, 0, Math.PI * 2);
  ctx.fillStyle = "#d7e2ea";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(8 - recoilOffset, 4, 3.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(20, 31, 42, 0.72)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(5, -3);
  ctx.lineTo(9 - recoilOffset, -2);
  ctx.lineTo(9 - recoilOffset, 2);
  ctx.lineTo(5, 3);
  ctx.stroke();

  ctx.strokeStyle = "rgba(11, 18, 26, 0.72)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(5 + gunBodyLength + muzzleLength - recoilOffset, 0);
  ctx.stroke();

  if (player.muzzleFlash > 0) {
    ctx.fillStyle = `rgba(237, 186, 93, ${player.muzzleFlash * 10})`;
    ctx.beginPath();
    const muzzleX = 5 + gunBodyLength + muzzleLength - recoilOffset;
    ctx.moveTo(muzzleX, 0);
    ctx.lineTo(muzzleX + 16, -5);
    ctx.lineTo(muzzleX + 6, 0);
    ctx.lineTo(muzzleX + 16, 5);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 242, 214, ${player.muzzleFlash * 9})`;
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }

  ctx.restore();
}

function drawCombatOverlay() {
  const player = gameState.player;

  if (player.hitFlash <= 0.01 && player.hp > 35) {
    return;
  }

  const lowHealthFactor = clamp((35 - player.hp) / 35, 0, 1);
  const alpha = player.hitFlash * 0.18 + lowHealthFactor * 0.12;
  const gradient = ctx.createRadialGradient(
    canvas.width * 0.5,
    canvas.height * 0.5,
    canvas.height * 0.24,
    canvas.width * 0.5,
    canvas.height * 0.5,
    canvas.width * 0.7
  );
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, `rgba(173, 49, 72, ${alpha})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawParticles() {
  for (const particle of gameState.particles) {
    const alpha = particle.life / particle.maxLife;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fillStyle = particle.color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawCompass() {
  ctx.fillStyle = "rgba(7, 18, 32, 0.74)";
  ctx.fillRect(canvas.width / 2 - 86, 12, 172, 36);
  ctx.strokeStyle = "rgba(118, 169, 214, 0.24)";
  ctx.strokeRect(canvas.width / 2 - 86, 12, 172, 36);

  ctx.fillStyle = "#8ba5c1";
  ctx.font = '16px Consolas';
  ctx.fillText("W", canvas.width / 2 - 64, 35);
  ctx.fillText("N", canvas.width / 2 - 8, 35);
  ctx.fillText("E", canvas.width / 2 + 50, 35);
}

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0, 0.033);
  lastTime = timestamp;

  update(dt);
  drawWorld();
  animationFrameId = window.requestAnimationFrame(loop);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(640, Math.floor(rect.width));
  const height = Math.max(360, Math.floor(rect.height));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  updateCamera();
}

window.addEventListener("resize", resizeCanvas);

const unlockMenuAudio = () => {
  preferredMusicMode = gameState?.running ? "game" : "intro";
  syncPreferredMusic();
};

window.addEventListener("pointerdown", unlockMenuAudio, { passive: true });
window.addEventListener("keydown", unlockMenuAudio);
window.addEventListener("touchstart", unlockMenuAudio, { passive: true });
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    preferredMusicMode = gameState?.running ? "game" : "intro";
    syncPreferredMusic();
  }
});

for (const card of classCards) {
  card.addEventListener("click", () => {
    selectClass(card.dataset.class || "stealther");
  });
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
    event.preventDefault();
  }

  if (key === "control" && !event.repeat && gameState?.player) {
    gameState.player.quietMode = !gameState.player.quietMode;
    gameState.message = gameState.player.quietMode ? "Stealth walk enabled." : "Stealth walk disabled.";
    statusText.textContent = gameState.message;
    if (gameState.running) {
      updateAwarenessState();
      syncHud();
    }
  }

  keys.add(key);

  if (key === "r") {
    reloadPlayer();
  }

  if (key === "e") {
    interact();
  }

  if (key === "f") {
    performTakedown();
  }

  if (key === "q") {
    useMedkit();
  }

  if (key === "g") {
    throwNoiseMaker();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

canvas.addEventListener("mousemove", (event) => {
  viewportToWorld(event.clientX, event.clientY);
});

canvas.addEventListener("mousedown", (event) => {
  viewportToWorld(event.clientX, event.clientY);
  pointer.down = true;
  shootPlayer();
});

window.addEventListener("mouseup", () => {
  pointer.down = false;
});

canvas.addEventListener("mouseleave", () => {
  pointer.down = false;
});

startButton.addEventListener("click", () => {
  ensureAudio();
  startGame();
});

restartButton.addEventListener("click", () => {
  ensureAudio();
  resetGame();
  startGame();
});

updateClassSelectionUi();
Object.values(CHARACTER_SPRITES).forEach(loadSprite);
ensureAudio();
window.__raidRuntime = {
  getState: () => gameState,
  getSelectedClass: () => selectedClass,
  selectClass,
  exportWorldState,
  applyWorldState,
  getCombatSnapshot,
  applyCombatSnapshot,
  applyAuthoritativeLocalState,
  applyRemoteAction,
  isRaidHost: () => isRaidHost(),
  setNetworkStatus: (message) => {
    if (!gameState?.running) {
      setStatusMessage(message);
    }
  },
  setRemotePlayers: (players) => {
    if (gameState) {
      gameState.remotePlayers = players;
    }
  },
  setLocalNetworkId: (id) => {
    if (gameState) {
      gameState.localNetworkId = id;
    }
  },
  setRaidHost: (value) => {
    if (gameState) {
      gameState.isRaidHost = Boolean(value);
    }
  },
  setPresenceCount: (count) => {
    if (gameState) {
      gameState.networkPresence = count;
    }
  },
  getLocalSnapshot: () => {
    if (!gameState) {
      return null;
    }

    const player = gameState.player;
    return {
      className: selectedClass,
      weaponLabel: player.weapon.label,
      x: player.x,
      y: player.y,
      radius: player.radius,
      angle: player.angle,
      hp: player.hp,
      maxHp: player.maxHp,
      ammo: player.ammo,
      magSize: player.magSize,
      shieldEquipped: player.shieldEquipped,
      shieldHp: player.shieldHp,
      running: gameState.running,
    };
  },
  publishWorldAction: () => {},
  publishPlayerAction: () => {},
  publishPlayerPatch: () => {},
};
resetGame();
syncPreferredMusic();
resizeCanvas();
animationFrameId = window.requestAnimationFrame((timestamp) => {
  lastTime = timestamp;
  loop(timestamp);
});
