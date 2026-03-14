const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const visualOverlay = document.querySelector("#visual-overlay");

const startOverlay = document.querySelector("#start-overlay");
const endOverlay = document.querySelector("#end-overlay");
const breachOverlay = document.querySelector("#breach-overlay");
const startButton = document.querySelector("#start-button");
const restartButton = document.querySelector("#restart-button");
const classCards = Array.from(document.querySelectorAll(".class-card"));
const endTag = document.querySelector("#end-tag");
const endTitle = document.querySelector("#end-title");
const endSummary = document.querySelector("#end-summary");
const restartStatusText = document.querySelector("#restart-status-text");
const restartPresence = document.querySelector("#restart-presence");
const reticle = document.querySelector("#reticle");
const reticleAmmoRing = document.querySelector("#reticle-ammo-ring");
const interactPrompt = document.querySelector("#interact-prompt");
const musicDeck = document.querySelector("#music-deck");
const musicDeckMode = document.querySelector("#music-deck-mode");
const musicDeckButtons = Array.from(document.querySelectorAll(".music-deck__button[data-music-mode]"));
const adminDeckButtons = Array.from(document.querySelectorAll(".music-deck__admin-button"));
const adminDeckStatus = document.querySelector("#admin-deck-status");
const musicSlider = document.querySelector("#music-slider");
const sfxSlider = document.querySelector("#sfx-slider");
const visualModeSelect = document.querySelector("#visual-mode-select");
const visualModeInline = document.querySelector("#visual-mode-inline");
const musicSliderValue = document.querySelector("#music-slider-value");
const sfxSliderValue = document.querySelector("#sfx-slider-value");
const bankValue = document.querySelector("#bank-value");
const profileDisplayNameInput = document.querySelector("#profile-display-name");
const profileTitleInput = document.querySelector("#profile-title");
const profilePreview = document.querySelector("#profile-preview");
const shopButtons = Array.from(document.querySelectorAll(".shop-button"));
const shopResetButton = document.querySelector("#shop-reset");
const breachCashValue = document.querySelector("#breach-cash-value");
const breachSummary = document.querySelector("#breach-summary");
const breachClassGrid = document.querySelector("#breach-class-grid");
const breachUtilityGrid = document.querySelector("#breach-utility-grid");
const breachContinueButton = document.querySelector("#breach-continue");
const breachSkipButton = document.querySelector("#breach-skip");
const debugOverlay = document.querySelector("#debug-overlay");
const debugGrid = document.querySelector("#debug-grid");
const debugEvents = document.querySelector("#debug-events");
const debugSocketState = document.querySelector("#debug-socket-state");
const debugActionButtons = Array.from(document.querySelectorAll(".debug-action-button"));

const timerValue = document.querySelector("#timer-value");
const lootValue = document.querySelector("#loot-value");
const cashValue = document.querySelector("#cash-value");
const heatValue = document.querySelector("#heat-value");
const brandTitle = document.querySelector(".brand-mark h1");
const operatorMark = document.querySelector("#operator-mark");
const squadValue = document.querySelector("#squad-value");
const extractionValue = document.querySelector("#extraction-value");
const healthValue = document.querySelector("#health-value");
const healthFill = document.querySelector("#health-fill");
const healthCells = document.querySelector("#health-cells");
const ammoValue = document.querySelector("#ammo-value");
const ammoFill = document.querySelector("#ammo-fill");
const shieldValue = document.querySelector("#shield-value");
const shieldFill = document.querySelector("#shield-fill");
const shieldCells = document.querySelector("#shield-cells");
const stealthValue = document.querySelector("#stealth-value");
const abilityValue = document.querySelector("#ability-value");
const stealthDetailValue = document.querySelector("#stealth-detail-value");
const medkitValue = document.querySelector("#medkit-value");
const noiseValue = document.querySelector("#noise-value");
const statusText = document.querySelector("#status-text");
const runtimeConfig = window.__DDD_CONFIG__ || {};
const protocolApi = window.DDDProtocol || {};
const sessionConfig = window.DDDSessionConfig || {};

const WORLD = {
  width: Number.isFinite(sessionConfig.WORLD_BOUNDS?.width) ? sessionConfig.WORLD_BOUNDS.width : 2600,
  height: Number.isFinite(sessionConfig.WORLD_BOUNDS?.height) ? sessionConfig.WORLD_BOUNDS.height : 1800,
};
const movementReconciliationConfig = sessionConfig.MOVEMENT_RECONCILIATION || {};

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

function isLocalHostEnvironment() {
  const hostname = (window.location?.hostname || "").toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || window.location?.protocol === "file:";
}

function isDevUiEnabled() {
  return runtimeConfig.showDevUi === true || (runtimeConfig.showDevUi !== false && isLocalHostEnvironment());
}

function areAdminControlsEnabled() {
  return runtimeConfig.enableAdminControls === true || (runtimeConfig.enableAdminControls !== false && isLocalHostEnvironment());
}

document.body.dataset.devUi = isDevUiEnabled() ? "enabled" : "disabled";

let gameState = null;
let lastTime = 0;
let animationFrameId = 0;
let audioContext = null;
let masterGain = null;
let selectedClass = "stealther";
const spriteCache = {};
const patternCache = {};
const scaledSpriteCache = {};
const spriteBoundsCache = {};
const floorLayerCache = {};
let preferredMusicMode = "auto";
let musicDeckVisible = false;
let musicUnlocked = false;
let lastAutoMusicMode = "intro";
let hudFrameAccumulator = 0;
const hudRenderCache = Object.create(null);
const RETICLE_AMMO_RING_CIRCUMFERENCE = 2 * Math.PI * 17;
let introTrack = null;
let firstLevelTrack = null;
let freightStealthTrack = null;
let shadowStealthTrack = null;
let bossTrack = null;
let altBossTrack = null;
const sfxClipCache = new Map();
const SFX_POOL_SIZE = 6;
let queuedMusicTrack = null;
let activeVisualMode = "clean";
let debugOverlayVisible = false;
let debugOverlayAccumulator = 0;
const networkUiState = {
  socketState: "offline",
  restartState: "idle",
  restartReadyIds: [],
  restartMessage: "",
  lastSnapshotAt: 0,
  recentEvents: [],
};
const queuedNetworkActions = {
  shootPressed: false,
  reloadPressed: false,
  interactPressed: false,
  medkitPressed: false,
  noisePressed: false,
  abilityPressed: false,
  takedownPressed: false,
  adminPressed: false,
  adminAction: null,
  noiseTarget: null,
};
const shaderBuffer = document.createElement("canvas");
const shaderBufferCtx = shaderBuffer.getContext("2d");
const shaderPixelBuffer = document.createElement("canvas");
const shaderPixelCtx = shaderPixelBuffer.getContext("2d");
const audioSettings = {
  music: 0.72,
  sfx: 1,
};
const VISUAL_MODE_STORAGE_KEY = "ddd-visual-mode";
const VISUAL_MODES = {
  clean: {
    label: "Clean",
    cssMode: "clean",
  },
  vhs: {
    label: "VHS",
    cssMode: "vhs",
  },
  pixel: {
    label: "Pixel",
    cssMode: "pixel",
    pixelScale: 0.34,
  },
  surveillance: {
    label: "Surveillance",
    cssMode: "surveillance",
  },
  amber: {
    label: "Amber CRT",
    cssMode: "amber",
  },
  blueprint: {
    label: "Blueprint",
    cssMode: "blueprint",
  },
  nightvision: {
    label: "Night Vision",
    cssMode: "nightvision",
  },
};
const TRACK_BASE_VOLUMES = {
  intro: 0.9,
  freight: 0.78,
  freightStealth: 0.72,
  shadowStealth: 0.7,
  boss: 0.92,
  bossAlt: 0.9,
};
const REMOTE_ACTION_STALE_MS = 1400;
const REMOTE_INTERACT_COOLDOWN = 0.18;
const REMOTE_NOISE_COOLDOWN = 0.45;
const REMOTE_TAKEDOWN_COOLDOWN = 0.45;
const REMOTE_NOISE_RANGE = 320;
const MUSIC_SUSPICIOUS_HOLD_BY_HEAT = {
  1: 3,
  2: 5,
  3: 7,
  4: 10,
};
const MUSIC_COMBAT_HOLD_BY_HEAT = {
  1: 6,
  2: 8,
  3: 11,
  4: 15,
};
const LIGHTING_PROFILES = {
  freight: {
    baseExposure: 0.2,
    darkness: 0.46,
    indoorExposureOffset: -0.08,
    indoorOverlayDelta: -0.08,
    heatDarknessAdd: 0.025,
    alertDarknessAdd: 0.04,
    revealRangeScale: 0.34,
    revealConeScale: 0.18,
    overlayTint: [10, 16, 23],
    alertTint: [199, 123, 72],
    staticLightColor: "rgba(214, 224, 235, 0.24)",
    extractionColor: "rgba(124, 214, 198, 0.34)",
    doorLightColor: "rgba(230, 240, 249, 0.16)",
    playerLightColor: "rgba(174, 228, 219, 0.14)",
  },
  admin: {
    baseExposure: 0.3,
    darkness: 0.4,
    indoorExposureOffset: 0.02,
    indoorOverlayDelta: 0.02,
    heatDarknessAdd: 0.018,
    alertDarknessAdd: 0.085,
    revealRangeScale: 0.42,
    revealConeScale: 0.24,
    overlayTint: [11, 14, 18],
    alertTint: [222, 96, 78],
    staticLightColor: "rgba(247, 239, 221, 0.24)",
    extractionColor: "rgba(236, 188, 116, 0.28)",
    doorLightColor: "rgba(247, 239, 221, 0.18)",
    playerLightColor: "rgba(192, 232, 224, 0.12)",
  },
  reactor: {
    baseExposure: 0.26,
    darkness: 0.43,
    indoorExposureOffset: -0.04,
    indoorOverlayDelta: -0.04,
    heatDarknessAdd: 0.016,
    alertDarknessAdd: 0.06,
    revealRangeScale: 0.38,
    revealConeScale: 0.22,
    overlayTint: [8, 12, 18],
    alertTint: [240, 138, 61],
    staticLightColor: "rgba(133, 196, 240, 0.24)",
    extractionColor: "rgba(247, 174, 108, 0.28)",
    doorLightColor: "rgba(182, 220, 245, 0.16)",
    playerLightColor: "rgba(168, 231, 250, 0.12)",
  },
};
const LEVEL_LIGHT_ANCHORS = {
  freight: [
    { x: 260, y: 260, radius: 260, intensity: 0.5 },
    { x: 930, y: 240, radius: 240, intensity: 0.46 },
    { x: 1540, y: 240, radius: 240, intensity: 0.4 },
    { x: 2210, y: 360, radius: 230, intensity: 0.48 },
    { x: 2310, y: 1490, radius: 240, intensity: 0.52 },
  ],
  admin: [
    { x: 540, y: 1520, radius: 260, intensity: 0.62 },
    { x: 2030, y: 1510, radius: 260, intensity: 0.62 },
    { x: 1300, y: 1140, radius: 280, intensity: 0.34 },
    { x: 1340, y: 540, radius: 230, intensity: 0.44 },
  ],
  reactor: [
    { x: 1300, y: 870, radius: 420, intensity: 0.64, color: "rgba(128, 205, 255, 0.28)", pulse: 0.12 },
    { x: 420, y: 320, radius: 210, intensity: 0.24 },
    { x: 2160, y: 340, radius: 210, intensity: 0.24 },
    { x: 430, y: 1440, radius: 220, intensity: 0.22 },
    { x: 2170, y: 1460, radius: 220, intensity: 0.22 },
  ],
};
const TEMP_LIGHT_DEFAULTS = {
  muzzle: { radius: 118, intensity: 0.34, ttl: 0.12, color: "rgba(255, 203, 124, 0.34)" },
  enemyMuzzle: { radius: 106, intensity: 0.3, ttl: 0.12, color: "rgba(255, 124, 152, 0.26)" },
  decoy: { radius: 190, intensity: 0.28, ttl: 0.46, color: "rgba(120, 201, 242, 0.22)" },
  breach: { radius: 160, intensity: 0.22, ttl: 0.3, color: "rgba(228, 240, 248, 0.18)" },
  specimen: { radius: 210, intensity: 0.32, ttl: 0.5, color: "rgba(97, 231, 206, 0.24)" },
};
const PROFILE_STORAGE_KEY = "ddd-profile";
const DEFAULT_PROFILE = {
  displayName: "Operator",
  title: "District Ghost",
  bankCredits: 220,
  pendingPrep: {
    medkits: 0,
    noiseCharges: 0,
    shieldCells: 0,
  },
};
const SHOP_ITEMS = {
  medkits: { label: "Field Medkit", cost: 120 },
  noiseCharges: { label: "Noise Maker", cost: 90 },
  shieldCells: { label: "Shield Cells", cost: 140 },
};
const MIDSHOP_CLASS_UPGRADES = {
  stealther: [
    {
      id: "ghost-rig",
      label: "Ghost Rig",
      cost: 230,
      copy: "Quieter movement, softer shot report, and a cached noise maker.",
      effects: {
        quietMultiplierMult: 0.82,
        soundRadiusMult: 0.78,
        abilityCooldownAdd: -1.4,
      },
      bonuses: {
        noiseCharges: 1,
      },
    },
    {
      id: "phase-weave",
      label: "Phase Weave",
      cost: 220,
      copy: "Longer cloak window, faster recharge, and a cleaner reload cycle.",
      effects: {
        abilityCooldownAdd: -3,
        abilityDurationAdd: 1.2,
        reloadTimeAdd: -0.18,
      },
    },
  ],
  breacher: [
    {
      id: "siege-pump",
      label: "Siege Pump",
      cost: 230,
      copy: "Tighter shell pattern, faster reload, and one extra shell in the tube.",
      effects: {
        reloadTimeAdd: -0.38,
        spreadMult: 0.84,
        magSizeAdd: 1,
        ammoAdd: 1,
      },
    },
    {
      id: "shock-stock",
      label: "Shock Stock",
      cost: 240,
      copy: "Harder pellet hits with steadier recovery and one extra shield cell.",
      effects: {
        damageAdd: 2,
        recoilMult: 0.88,
        shieldCellsAdd: 1,
      },
    },
  ],
  marksman: [
    {
      id: "stabilizer-kit",
      label: "Stabilizer Kit",
      cost: 230,
      copy: "Lower recoil, tighter spread, and a faster reload to re-enter fights cleanly.",
      effects: {
        recoilMult: 0.78,
        spreadMult: 0.72,
        reloadTimeAdd: -0.28,
      },
    },
    {
      id: "mag-clamp",
      label: "Mag Clamp",
      cost: 210,
      copy: "Larger magazine and reserve, trading a touch of reload speed for pressure.",
      effects: {
        magSizeAdd: 6,
        ammoAdd: 6,
        reloadTimeAdd: 0.12,
      },
    },
  ],
};
const MIDSHOP_UTILITY_UPGRADES = [
  {
    id: "field-med-pouch",
    label: "Field Med Pouch",
    cost: 120,
    copy: "Carry one extra medkit into the reactor push.",
    bonuses: {
      medkits: 1,
    },
  },
  {
    id: "signal-cache",
    label: "Signal Cache",
    cost: 110,
    copy: "Carry one extra distraction tool into the reactor push.",
    bonuses: {
      noiseCharges: 1,
    },
  },
  {
    id: "composite-plating",
    label: "Composite Plating",
    cost: 160,
    copy: "Adds one extra HP cell for the remainder of the run.",
    effects: {
      hpCellsAdd: 1,
    },
  },
];
let playerProfile = structuredClone(DEFAULT_PROFILE);
let localShotCounter = 0;
let enemyBulletCounter = 0;
let dynamicLootCounter = 0;

const CLASS_LOADOUTS = sessionConfig.CLASS_LOADOUTS || {
  stealther: {
    name: "Stealther",
    weaponLabel: "Suppressed Sidearm",
    ammo: 12,
    shotRate: 0.25,
    reloadTime: 2.45,
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
    hpCells: 2,
    shieldCells: 0,
    canUseShield: false,
    ability: "cloak",
    abilityCooldown: 14,
    abilityDuration: 3.8,
  },
  breacher: {
    name: "Breacher",
    weaponLabel: "Shotgun",
    ammo: 6,
    shotRate: 0.54,
    reloadTime: 2.7,
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
    hpCells: 3,
    shieldCells: 2,
    canUseShield: true,
    ability: "brace",
    abilityCooldown: 10,
    abilityDuration: 2.8,
  },
  marksman: {
    name: "Marksman",
    weaponLabel: "Carbine",
    ammo: 20,
    shotRate: 0.36,
    reloadTime: 2.55,
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
    hpCells: 2,
    shieldCells: 1,
    canUseShield: true,
    ability: "focus",
    abilityCooldown: 9,
    abilityDuration: 2.4,
  },
};

const CHARACTER_SPRITES = {
  stealther: "assets/characters/Stealther.png",
  stealther_advanced: "assets/characters/stealther_advanced.png",
  breacher: "assets/characters/Breacher.png",
  breacher_advanced: "assets/characters/Breacher_advanced.png",
  marksman: "assets/characters/Marksman.png",
  shielded_marksman: "assets/characters/Shielded_marksman.png",
  cyber_specimen: "assets/characters/cyber_specimen.png",
  enemy_guard: "assets/characters/Enemy_guard.png",
  enemy_rusher: "assets/characters/Enemy_rusher.png",
  warden_stage_one: "assets/characters/WARDEN.png",
  warden_stage_two: "assets/characters/WARd3n_THE_KINGS_MACHINE.png",
};

const ENVIRONMENT_ASSETS = {
  freightFloor: "assets/environment/base_freight_floor.jpg",
  freightLane: "assets/environment/painted_lane_tile.jpg",
  container: "assets/environment/container.png",
};

const { ENVIRONMENT_ASSET_BOUNDS, isRoofAssetPath, getEntityVisualRect, drawAssetImage } = window.DDDAssetRendering;

const CONTAINER_PRESETS = {
  freightLongH: {
    colliderW: 212,
    colliderH: 92,
    drawW: 236,
    drawH: 112,
    rotation: 0,
  },
  freightShortH: {
    colliderW: 212,
    colliderH: 92,
    drawW: 236,
    drawH: 112,
    rotation: 0,
  },
  freightLongV: {
    colliderW: 92,
    colliderH: 212,
    drawW: 112,
    drawH: 236,
    rotation: Math.PI * 0.5,
  },
  freightShortV: {
    colliderW: 92,
    colliderH: 212,
    drawW: 112,
    drawH: 236,
    rotation: Math.PI * 0.5,
  },
};

const OST_TRACKS = {
  intro: "assets/ost/DEAD DROP DISTRICT-INTRO.mp3",
  freight: "assets/ost/Walk in the container park- first level.mp3",
  freightStealth: "assets/ost/Silent walk in the freight park(for stealth).mp3",
  shadowStealth: "assets/ost/Untitled for stealth.mp3",
  boss: "assets/ost/Kings Machine_ft. WARd3n.mp3",
  bossAlt: "assets/ost/alt boss theme.mp3",
};

const MUSIC_MODE_LABELS = {
  auto: "auto",
  intro: "intro",
  freight: "freight",
  "freight-stealth": "freight stealth",
  "shadow-stealth": "deep stealth",
  boss: "boss",
  "boss-alt": "alt boss",
  mute: "mute",
};

const SFX_TRACKS = {
  shot: {
    stealther: "assets/sfx/stealther_shot.mp3",
    breacher: "assets/sfx/Breacher_shot.mp3",
    marksman: "assets/sfx/Marksman_shot.mp3",
  },
  reload: {
    stealther: "assets/sfx/Stealther_reload.mp3",
    breacher: "assets/sfx/Tactical_Shotgun_Reload.mp3",
    marksman: "assets/sfx/Marksman_reload.mp3",
  },
  enemyShot: {
    rusher: "assets/sfx/runner_shot.mp3",
    guard: "assets/sfx/Guard_shot.mp3",
    boss: "assets/sfx/Boss_gunshot.mp3",
  },
  crateBreak: "assets/sfx/crate_breaking.mp3",
};

const STEALTH_TUNING = {
  quietSightRangeMultiplier: 0.72,
  quietSightConeMultiplier: 0.82,
  quietCloseRangeMultiplier: 0.68,
  cloakSightRangeMultiplier: 0.4,
  cloakSightConeMultiplier: 0.58,
  cloakCloseRangeMultiplier: 0.48,
  quietStepRadius: 28,
  quietStepIntensity: 0.06,
  quietStepInterval: 0.72,
  normalStepRadius: 96,
  normalStepIntensity: 0.24,
  sprintStepRadius: 190,
  sprintStepIntensity: 0.68,
  investigateBase: 1.8,
  investigateIntensityScale: 1,
  searchBase: 2.5,
  eliteViewBonus: 18,
  eliteHearingBonus: 24,
};

const HEAT_SCORE_THRESHOLDS = {
  1: 0,
  2: 2.2,
  3: 5.1,
  4: 8.6,
};
const AI_TUNING = {
  alertShareRange: 420,
  alertShareBlockedMultiplier: 1.4,
  alertShareSpreadMin: 20,
  alertShareSpreadMax: 140,
  soundInvestigateMin: 16,
  soundInvestigateMax: 132,
  raidAwarenessInvestigateRadius: 210,
  raidAwarenessSearchRadius: 180,
  patrolAnchorDriftChance: 0.012,
};

function updateClassSelectionUi() {
  for (const card of classCards) {
    card.classList.toggle("is-selected", card.dataset.class === selectedClass);
  }

  syncShopUi();
}

function normalizePrepState(prep) {
  return {
    medkits: Math.max(0, Number(prep?.medkits) || 0),
    noiseCharges: Math.max(0, Number(prep?.noiseCharges) || 0),
    shieldCells: Math.max(0, Number(prep?.shieldCells) || 0),
  };
}

function normalizeProfileDisplayName(value) {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
  return normalized || DEFAULT_PROFILE.displayName;
}

function normalizeProfileTitle(value) {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 32);
  return normalized || DEFAULT_PROFILE.title;
}

function getProfileSignature(profile = playerProfile) {
  return `${normalizeProfileTitle(profile?.title)} // ${normalizeProfileDisplayName(profile?.displayName)}`;
}

function getPlayerIdentityLabel(entity) {
  if (!entity) {
    return "operator";
  }

  const title = typeof entity.title === "string" ? normalizeProfileTitle(entity.title) : "";
  const displayName = typeof entity.displayName === "string" ? normalizeProfileDisplayName(entity.displayName) : "";
  if (title || displayName) {
    return `${title || DEFAULT_PROFILE.title} // ${displayName || DEFAULT_PROFILE.displayName}`;
  }
  return entity.className || entity.weapon?.displayName || "operator";
}

function drawPlayerIdentityTag(entity, x, y, options = {}) {
  const label = getPlayerIdentityLabel(entity);
  if (!label) {
    return;
  }

  const alpha = clamp(options.alpha ?? 1, 0, 1);
  const yOffset = options.yOffset ?? 28;
  const accent = options.accent || "#9fd0c0";
  const fill = options.fill || "rgba(8, 15, 24, 0.72)";
  const border = options.border || "rgba(190, 226, 220, 0.2)";

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '11px Consolas';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const metrics = ctx.measureText(label);
  const width = Math.ceil(metrics.width) + 14;
  const height = 18;
  const left = x - width * 0.5;
  const top = y - yOffset - height * 0.5;

  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(left, top, width, height, 6);
  ctx.fill();

  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.fillText(label, x, top + height * 0.5 + 0.5);
  ctx.restore();
}

function syncProfileUi() {
  const displayName = normalizeProfileDisplayName(playerProfile?.displayName);
  const title = normalizeProfileTitle(playerProfile?.title);
  playerProfile.displayName = displayName;
  playerProfile.title = title;

  if (profileDisplayNameInput && document.activeElement !== profileDisplayNameInput) {
    profileDisplayNameInput.value = displayName;
  }
  if (profileTitleInput && document.activeElement !== profileTitleInput) {
    profileTitleInput.value = title;
  }
  if (profilePreview) {
    profilePreview.textContent = getProfileSignature();
  }
  if (operatorMark) {
    operatorMark.textContent = getProfileSignature();
  }
}

function normalizeRunUpgrades(runUpgrades) {
  return {
    classUpgrade: typeof runUpgrades?.classUpgrade === "string" ? runUpgrades.classUpgrade : null,
    utilityUpgrade: typeof runUpgrades?.utilityUpgrade === "string" ? runUpgrades.utilityUpgrade : null,
  };
}

function getActiveClassName() {
  return gameState?.player?.weapon?.className || selectedClass;
}

function resolveUpgradeClassBucket(className = getActiveClassName()) {
  const key = `${className || ""}`.toLowerCase();
  if (MIDSHOP_CLASS_UPGRADES[key]) {
    return key;
  }
  if (key.includes("stealth")) {
    return "stealther";
  }
  if (key.includes("mark")) {
    return "marksman";
  }
  if (key.includes("breach")) {
    return "breacher";
  }
  return MIDSHOP_CLASS_UPGRADES[selectedClass] ? selectedClass : "stealther";
}

function getMidshopClassUpgrades(className = getActiveClassName()) {
  return MIDSHOP_CLASS_UPGRADES[resolveUpgradeClassBucket(className)] || [];
}

function getMidshopClassUpgradeById(className = getActiveClassName(), upgradeId = "") {
  return getMidshopClassUpgrades(className).find((upgrade) => upgrade.id === upgradeId) || null;
}

function getMidshopUtilityUpgradeById(upgradeId = "") {
  return MIDSHOP_UTILITY_UPGRADES.find((upgrade) => upgrade.id === upgradeId) || null;
}

function getSpriteVariantForRunUpgrades(className = getActiveClassName(), runUpgrades = null) {
  const bucket = resolveUpgradeClassBucket(className);
  if (!runUpgrades?.classUpgrade) {
    return null;
  }
  if (bucket === "stealther" || bucket === "breacher") {
    return "advanced";
  }
  return null;
}

function getUpgradeSelectionLabel(upgrade) {
  return upgrade ? `${upgrade.label} [$${upgrade.cost}]` : "none";
}

function applyRunUpgradeBonuses(player, upgrade) {
  if (!player || !upgrade?.bonuses) {
    return;
  }

  if (upgrade.bonuses.medkits) {
    player.medkits = Math.max(0, (player.medkits || 0) + upgrade.bonuses.medkits);
  }

  if (upgrade.bonuses.noiseCharges) {
    player.noiseCharges = Math.max(0, (player.noiseCharges || 0) + upgrade.bonuses.noiseCharges);
  }
}

function applyRunUpgradeEffects(player, runUpgrades, className = getActiveClassName()) {
  if (!player) {
    return;
  }

  player.spriteVariant = getSpriteVariantForRunUpgrades(className, runUpgrades);
  const upgrades = [
    getMidshopClassUpgradeById(className, runUpgrades?.classUpgrade),
    getMidshopUtilityUpgradeById(runUpgrades?.utilityUpgrade),
  ].filter(Boolean);

  for (const upgrade of upgrades) {
    const effects = upgrade.effects || {};

    if (effects.hpCellsAdd) {
      player.maxHp = Math.max(1, player.maxHp + effects.hpCellsAdd);
      player.hp = clamp(player.hp + effects.hpCellsAdd, 0, player.maxHp);
    }

    if (effects.shieldCellsAdd && player.canUseShield) {
      player.maxShieldHp = Math.max(0, player.maxShieldHp + effects.shieldCellsAdd);
      player.shieldEquipped = true;
      player.shieldHp = clamp(player.shieldHp + effects.shieldCellsAdd, 0, player.maxShieldHp);
    }

    if (effects.magSizeAdd) {
      player.magSize = Math.max(1, player.magSize + effects.magSizeAdd);
      player.ammo = clamp(player.ammo + effects.magSizeAdd, 0, player.magSize);
    }

    if (effects.ammoAdd) {
      player.ammo = clamp(player.ammo + effects.ammoAdd, 0, player.magSize);
    }

    if (effects.reloadTimeAdd) {
      player.reloadTime = Math.max(0.45, player.reloadTime + effects.reloadTimeAdd);
    }

    if (effects.shotRateAdd) {
      player.shotRate = Math.max(0.12, player.shotRate + effects.shotRateAdd);
    }

    if (effects.quietMultiplierMult) {
      player.quietMultiplier = clamp(player.quietMultiplier * effects.quietMultiplierMult, 0.2, 1);
    }

    if (effects.abilityCooldownAdd) {
      player.abilityCooldown = Math.max(2, player.abilityCooldown + effects.abilityCooldownAdd);
    }

    if (effects.abilityDurationAdd) {
      player.abilityDuration = Math.max(0.6, player.abilityDuration + effects.abilityDurationAdd);
    }

    if (effects.interactRadiusAdd) {
      player.interactRadius = Math.max(44, player.interactRadius + effects.interactRadiusAdd);
    }

    if (effects.weaponLabel) {
      player.weapon.label = effects.weaponLabel;
    }

    if (effects.soundRadiusMult) {
      player.weapon.soundRadius = Math.max(70, player.weapon.soundRadius * effects.soundRadiusMult);
    }

    if (effects.recoilMult) {
      player.weapon.recoil = Math.max(0.12, player.weapon.recoil * effects.recoilMult);
    }

    if (effects.spreadMult) {
      player.weapon.spread = Math.max(0.0035, player.weapon.spread * effects.spreadMult);
    }

    if (effects.damageAdd) {
      player.weapon.damage = Math.max(1, player.weapon.damage + effects.damageAdd);
    }
  }
}

function loadPlayerProfile() {
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      playerProfile = structuredClone(DEFAULT_PROFILE);
      syncProfileUi();
      return;
    }

    const parsed = JSON.parse(raw);
    playerProfile = {
      displayName: normalizeProfileDisplayName(parsed?.displayName),
      title: normalizeProfileTitle(parsed?.title),
      bankCredits: Math.max(0, Number(parsed?.bankCredits) || 0),
      pendingPrep: normalizePrepState(parsed?.pendingPrep),
    };
  } catch {
    playerProfile = structuredClone(DEFAULT_PROFILE);
  }
  syncProfileUi();
}

function savePlayerProfile() {
  playerProfile.displayName = normalizeProfileDisplayName(playerProfile.displayName);
  playerProfile.title = normalizeProfileTitle(playerProfile.title);
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(playerProfile));
}

function getPendingPrep() {
  if (!playerProfile.pendingPrep) {
    playerProfile.pendingPrep = normalizePrepState();
  }
  return playerProfile.pendingPrep;
}

function refundPendingPrep() {
  const prep = getPendingPrep();
  for (const [key, item] of Object.entries(SHOP_ITEMS)) {
    const count = prep[key] || 0;
    if (count > 0) {
      playerProfile.bankCredits += item.cost * count;
      prep[key] = 0;
    }
  }
  savePlayerProfile();
  syncShopUi();
}

function buyPrepItem(key) {
  const item = SHOP_ITEMS[key];
  if (!item) {
    return;
  }

  if (key === "shieldCells" && !CLASS_LOADOUTS[selectedClass]?.canUseShield) {
    setStatusMessage("This class cannot stage shield cells.");
    return;
  }

  if (playerProfile.bankCredits < item.cost) {
    setStatusMessage("Not enough prep credits.");
    return;
  }

  playerProfile.bankCredits -= item.cost;
  const prep = getPendingPrep();
  prep[key] = (prep[key] || 0) + 1;
  savePlayerProfile();
  syncShopUi();
  setStatusMessage(`${item.label} staged for the next run.`);
}

function consumePendingPrep() {
  const prep = normalizePrepState(playerProfile.pendingPrep);
  playerProfile.pendingPrep = normalizePrepState();
  savePlayerProfile();
  return prep;
}

function applyStagedPrepToCurrentRun() {
  if (!gameState || gameState.prepApplied) {
    return;
  }

  const prep = consumePendingPrep();
  gameState.player.medkits += prep.medkits;
  gameState.player.noiseCharges += prep.noiseCharges;
  if (prep.shieldCells > 0) {
    restoreShieldCells(gameState.player);
  }
  gameState.prepApplied = true;
  syncShopUi();
}

function awardProfileCredits(amount) {
  const gain = Math.max(0, Math.floor(amount));
  if (!gain) {
    return;
  }

  playerProfile.bankCredits += gain;
  savePlayerProfile();
  syncShopUi();
}

function syncShopUi() {
  if (bankValue) {
    bankValue.textContent = `$${Math.floor(playerProfile.bankCredits || 0)}`;
  }

  const prep = getPendingPrep();
  for (const button of shopButtons) {
    const itemKey = button.dataset.item;
    const item = SHOP_ITEMS[itemKey];
    const count = prep[itemKey] || 0;
    const allowed = !(itemKey === "shieldCells" && !CLASS_LOADOUTS[selectedClass]?.canUseShield);
    const affordable = playerProfile.bankCredits >= (item?.cost || 0);
    button.disabled = !allowed || !affordable;
    button.classList.toggle("is-disabled", !allowed);
    const countLabel = button.querySelector("[data-pending]");
    if (countLabel) {
      countLabel.textContent = count > 0 ? `x${count}` : "";
    }
  }

  if (shopResetButton) {
    const hasPending = Object.values(prep).some((value) => value > 0);
    shopResetButton.disabled = !hasPending;
  }
}

function buildUpgradeCardMarkup(upgrade, kind, options = {}) {
  const { selected = false, disabled = false } = options;
  return `
    <button class="upgrade-card${selected ? " is-selected" : ""}" data-upgrade-kind="${kind}" data-upgrade-id="${upgrade.id}" type="button"${
      disabled ? " disabled" : ""
    }>
      <span class="label">${upgrade.label}</span>
      <strong>$${upgrade.cost}</strong>
      <span class="shop-copy">${upgrade.copy}</span>
    </button>
  `;
}

function syncMidshopUi() {
  if (!breachOverlay || !breachClassGrid || !breachUtilityGrid || !gameState) {
    return;
  }

  const className = getActiveClassName();
  const upgrades = normalizeRunUpgrades(gameState.runUpgrades);
  const classUpgrades = getMidshopClassUpgrades(className);
  const utilityUpgrades = MIDSHOP_UTILITY_UPGRADES;
  const classLocked = Boolean(upgrades.classUpgrade);
  const utilityLocked = Boolean(upgrades.utilityUpgrade);

  if (breachCashValue) {
    breachCashValue.textContent = `$${Math.floor(gameState.cash || 0)}`;
  }

  breachClassGrid.innerHTML = classUpgrades
    .map((upgrade) =>
      buildUpgradeCardMarkup(upgrade, "class", {
        selected: upgrades.classUpgrade === upgrade.id,
        disabled: (classLocked && upgrades.classUpgrade !== upgrade.id) || gameState.cash < upgrade.cost,
      })
    )
    .join("");

  breachUtilityGrid.innerHTML = utilityUpgrades
    .map((upgrade) =>
      buildUpgradeCardMarkup(upgrade, "utility", {
        selected: upgrades.utilityUpgrade === upgrade.id,
        disabled: (utilityLocked && upgrades.utilityUpgrade !== upgrade.id) || gameState.cash < upgrade.cost,
      })
    )
    .join("");

  if (breachSummary) {
    breachSummary.textContent = `Class refit: ${getUpgradeSelectionLabel(
      getMidshopClassUpgradeById(className, upgrades.classUpgrade)
    )}. Utility package: ${getUpgradeSelectionLabel(getMidshopUtilityUpgradeById(upgrades.utilityUpgrade))}.`;
  }
}

function buyMidshopUpgrade(kind, upgradeId) {
  if (!gameState || !breachOverlay?.classList.contains("is-visible")) {
    return;
  }

  gameState.runUpgrades = normalizeRunUpgrades(gameState.runUpgrades);
  const className = getActiveClassName();
  const upgrade =
    kind === "class" ? getMidshopClassUpgradeById(className, upgradeId) : kind === "utility" ? getMidshopUtilityUpgradeById(upgradeId) : null;

  if (!upgrade) {
    return;
  }

  if (kind === "class" && gameState.runUpgrades.classUpgrade) {
    setStatusMessage("Class refit already locked for this breach.");
    return;
  }

  if (kind === "utility" && gameState.runUpgrades.utilityUpgrade) {
    setStatusMessage("Utility package already locked for this breach.");
    return;
  }

  if (gameState.cash < upgrade.cost) {
    setStatusMessage("Not enough raid cash for that upgrade.");
    return;
  }

  gameState.cash -= upgrade.cost;
  if (kind === "class") {
    gameState.runUpgrades.classUpgrade = upgrade.id;
  } else {
    gameState.runUpgrades.utilityUpgrade = upgrade.id;
  }
  applyRunUpgradeBonuses(gameState.player, upgrade);
  gameState.message = `${upgrade.label} fitted for the reactor breach.`;
  statusText.textContent = gameState.message;
  syncHud();
  syncMidshopUi();
}

function openBreachShop(targetLevel = "reactor") {
  if (!gameState || !breachOverlay) {
    return;
  }

  const targetLayout = getLevelTemplate(targetLevel);
  gameState.running = false;
  gameState.pendingTransitionLevel = targetLevel;
  gameState.runUpgrades = normalizeRunUpgrades(gameState.runUpgrades);
  setMusicDeckVisible(false);
  breachOverlay.classList.add("is-visible");
  gameState.message = `${targetLayout.name} ahead. Spend raid cash on one class refit and one utility package before the breach.`;
  statusText.textContent = gameState.message;
  syncMidshopUi();
}

function continueFromBreachShop() {
  if (!gameState?.pendingTransitionLevel) {
    breachOverlay?.classList.remove("is-visible");
    return;
  }

  const targetLevel = gameState.pendingTransitionLevel;
  const clearedLevel = gameState.levelId;
  breachOverlay?.classList.remove("is-visible");
  beginLevel(targetLevel, { preservePlayer: true, preserveRunState: true });
  gameState.running = true;
  gameState.message = getStageTransitionMessage(clearedLevel);
  statusText.textContent = gameState.message;
  syncHud();
  window.__raidRuntime?.publishWorldState?.(exportWorldState());
}

function loadSprite(path) {
  if (spriteCache[path]) {
    return spriteCache[path];
  }

  const image = new Image();
  image.addEventListener("load", () => {
    delete patternCache[path];
    delete scaledSpriteCache[path];
    delete floorLayerCache.freight;
    delete floorLayerCache.reactor;
  });
  image.src = path;
  spriteCache[path] = image;
  return image;
}

function getSpriteForPlayer(player) {
  return getSpriteForClass(player.weapon.className, player.shieldEquipped, player.spriteVariant);
}

function getSpriteForClass(className, shieldEquipped, spriteVariant = null) {
  if (className === "marksman" && shieldEquipped) {
    return loadSprite(CHARACTER_SPRITES.shielded_marksman);
  }

  const spriteKey = spriteVariant ? `${className}_${spriteVariant}` : className;
  return loadSprite(CHARACTER_SPRITES[spriteKey] || CHARACTER_SPRITES[className] || CHARACTER_SPRITES.stealther);
}

function getSpriteForEnemy(enemy) {
  if (enemy.kind === "boss") {
    return loadSprite(enemy.bossPhase === 2 ? CHARACTER_SPRITES.warden_stage_two : CHARACTER_SPRITES.warden_stage_one);
  }

  if (enemy.kind === "specimen") {
    return loadSprite(CHARACTER_SPRITES.cyber_specimen);
  }

  return loadSprite(enemy.kind === "guard" ? CHARACTER_SPRITES.enemy_guard : CHARACTER_SPRITES.enemy_rusher);
}

function getEnvironmentAsset(key) {
  const path = ENVIRONMENT_ASSETS[key];
  return path ? loadSprite(path) : null;
}

function getPatternForAsset(path) {
  if (patternCache[path]) {
    return patternCache[path];
  }

  const image = spriteCache[path];
  if (!image || !image.complete || !image.naturalWidth) {
    return null;
  }

  const pattern = ctx.createPattern(image, "repeat");
  if (pattern) {
    patternCache[path] = pattern;
  }
  return pattern;
}

function createCacheCanvas(width, height) {
  const layer = document.createElement("canvas");
  layer.width = width;
  layer.height = height;
  return layer;
}

function getScaledSprite(path, targetWidth, targetHeight, rotation = 0) {
  const image = spriteCache[path];
  if (!image || !image.complete || !image.naturalWidth) {
    return null;
  }

  const key = `${path}:${Math.round(targetWidth)}:${Math.round(targetHeight)}:${rotation.toFixed(2)}`;
  if (scaledSpriteCache[key]) {
    return scaledSpriteCache[key];
  }

  const layer = createCacheCanvas(Math.max(2, Math.ceil(targetWidth)), Math.max(2, Math.ceil(targetHeight)));
  const layerCtx = layer.getContext("2d");
  layerCtx.save();
  layerCtx.translate(layer.width * 0.5, layer.height * 0.5);
  if (rotation !== 0) {
    layerCtx.rotate(rotation);
  }

  const rotated = Math.abs(rotation % Math.PI) > 0.01;
  const sourceAspect = rotated ? image.naturalHeight / image.naturalWidth : image.naturalWidth / image.naturalHeight;
  let drawWidth = layer.width;
  let drawHeight = drawWidth / sourceAspect;

  if (drawHeight > layer.height) {
    drawHeight = layer.height;
    drawWidth = drawHeight * sourceAspect;
  }

  layerCtx.drawImage(image, -drawWidth * 0.5, -drawHeight * 0.5, drawWidth, drawHeight);
  layerCtx.restore();
  scaledSpriteCache[key] = layer;
  return layer;
}

function getOpaqueSpriteBounds(path) {
  if (spriteBoundsCache[path]) {
    return spriteBoundsCache[path];
  }

  const image = spriteCache[path];
  if (!image || !image.complete || !image.naturalWidth) {
    return null;
  }

  const normalized = ENVIRONMENT_ASSET_BOUNDS[path];
  const bounds = normalized
    ? {
        x: Math.round(image.naturalWidth * normalized.x),
        y: Math.round(image.naturalHeight * normalized.y),
        w: Math.max(1, Math.round(image.naturalWidth * normalized.w)),
        h: Math.max(1, Math.round(image.naturalHeight * normalized.h)),
      }
    : { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight };

  spriteBoundsCache[path] = bounds;
  return bounds;
}

function getCroppedSpriteCanvas(path, bounds) {
  const key = `${path}:crop:${bounds.x}:${bounds.y}:${bounds.w}:${bounds.h}`;
  if (scaledSpriteCache[key]) {
    return scaledSpriteCache[key];
  }

  const image = spriteCache[path];
  if (!image || !image.complete || !image.naturalWidth) {
    return null;
  }

  const layer = createCacheCanvas(bounds.w, bounds.h);
  const layerCtx = layer.getContext("2d");
  layerCtx.imageSmoothingEnabled = false;
  layerCtx.drawImage(image, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);
  scaledSpriteCache[key] = layer;
  return layer;
}

function getScaledCanvas(sourceCanvas, targetWidth, targetHeight, rotation = 0) {
  const key = `canvas:${sourceCanvas.width}:${sourceCanvas.height}:${Math.round(targetWidth)}:${Math.round(targetHeight)}:${rotation.toFixed(2)}`;
  if (scaledSpriteCache[key]) {
    return scaledSpriteCache[key];
  }

  const rotated = Math.abs(rotation % Math.PI) > 0.01;
  const layer = createCacheCanvas(
    Math.max(2, Math.ceil(rotated ? targetHeight : targetWidth)),
    Math.max(2, Math.ceil(rotated ? targetWidth : targetHeight))
  );
  const layerCtx = layer.getContext("2d");
  layerCtx.imageSmoothingEnabled = false;
  layerCtx.save();
  layerCtx.translate(layer.width * 0.5, layer.height * 0.5);
  if (rotation !== 0) {
    layerCtx.rotate(rotation);
  }
  layerCtx.drawImage(sourceCanvas, -targetWidth * 0.5, -targetHeight * 0.5, targetWidth, targetHeight);
  layerCtx.restore();
  scaledSpriteCache[key] = layer;
  return layer;
}

function getFreightFloorLayer() {
  if (floorLayerCache.freight) {
    return floorLayerCache.freight;
  }

  const layer = createCacheCanvas(WORLD.width, WORLD.height);
  const layerCtx = layer.getContext("2d");

  layerCtx.fillStyle = "#c8d1d9";
  layerCtx.fillRect(0, 0, WORLD.width, WORLD.height);

  const basePattern = getPatternForAsset(ENVIRONMENT_ASSETS.freightFloor);
  if (basePattern) {
    layerCtx.save();
    layerCtx.globalAlpha = 0.34;
    layerCtx.fillStyle = basePattern;
    layerCtx.fillRect(0, 0, WORLD.width, WORLD.height);
    layerCtx.restore();
  }

  const lanePattern = getPatternForAsset(ENVIRONMENT_ASSETS.freightLane);
  if (lanePattern) {
    layerCtx.save();
    layerCtx.globalAlpha = 0.18;
    layerCtx.fillStyle = lanePattern;
    layerCtx.fillRect(0, 980, WORLD.width, 220);
    layerCtx.restore();
  }

  layerCtx.fillStyle = "rgba(239, 242, 245, 0.3)";
  layerCtx.fillRect(0, 980, WORLD.width, 220);
  layerCtx.fillStyle = "rgba(92, 108, 123, 0.08)";
  layerCtx.fillRect(0, 1060, WORLD.width, 48);

  layerCtx.strokeStyle = "rgba(112, 124, 137, 0.12)";
  layerCtx.lineWidth = 3;
  for (let lane = 0; lane < 4; lane += 1) {
    const y = 240 + lane * 360;
    layerCtx.beginPath();
    layerCtx.moveTo(0, y);
    layerCtx.lineTo(WORLD.width, y);
    layerCtx.stroke();
  }

  layerCtx.strokeStyle = "rgba(112, 124, 137, 0.08)";
  layerCtx.lineWidth = 1.25;
  for (let x = 120; x < WORLD.width; x += 320) {
    layerCtx.beginPath();
    layerCtx.moveTo(x, 0);
    layerCtx.lineTo(x, WORLD.height);
    layerCtx.stroke();
  }

  floorLayerCache.freight = layer;
  return layer;
}

function drawContainerSprite(obstacle) {
  const preset = obstacle.containerPreset ? CONTAINER_PRESETS[obstacle.containerPreset] : null;
  const horizontal = preset ? preset.rotation === 0 : obstacle.w >= obstacle.h;
  const bodyW = obstacle.drawW || obstacle.w;
  const bodyH = obstacle.drawH || obstacle.h;
  const left = obstacle.x + (typeof obstacle.drawOffsetX === "number" ? obstacle.drawOffsetX : (obstacle.w - bodyW) * 0.5);
  const top = obstacle.y + (typeof obstacle.drawOffsetY === "number" ? obstacle.drawOffsetY : (obstacle.h - bodyH) * 0.5);
  const ribCount = horizontal ? 12 : 10;
  const ribGap = horizontal ? Math.max(8, Math.floor((bodyW - 28) / ribCount)) : Math.max(8, Math.floor((bodyH - 28) / ribCount));
  const edgeColor = "rgba(18, 28, 36, 0.95)";
  const frameColor = "#698091";
  const faceTop = "#7e97ab";
  const faceBottom = "#54697a";
  const highlight = "rgba(233, 242, 248, 0.24)";
  const shadow = "rgba(21, 32, 40, 0.2)";

  ctx.save();
  const faceGradient = horizontal
    ? ctx.createLinearGradient(0, top, 0, top + bodyH)
    : ctx.createLinearGradient(left, 0, left + bodyW, 0);
  faceGradient.addColorStop(0, faceTop);
  faceGradient.addColorStop(1, faceBottom);

  ctx.fillStyle = shadow;
  ctx.fillRect(left + 4, top + 6, bodyW, bodyH);

  ctx.fillStyle = faceGradient;
  ctx.fillRect(left, top, bodyW, bodyH);

  ctx.strokeStyle = edgeColor;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(left, top, bodyW, bodyH);

  ctx.fillStyle = frameColor;
  ctx.fillRect(left + 8, top + 8, bodyW - 16, 8);
  ctx.fillRect(left + 8, top + bodyH - 16, bodyW - 16, 8);
  ctx.fillRect(left + 8, top + 16, 8, bodyH - 32);
  ctx.fillRect(left + bodyW - 16, top + 16, 8, bodyH - 32);

  const panelLeft = left + 18;
  const panelTop = top + 18;
  const panelW = bodyW - 36;
  const panelH = bodyH - 36;

  for (let index = 0; index < ribCount; index += 1) {
    if (horizontal) {
      const x = panelLeft + index * ribGap;
      ctx.fillStyle = "rgba(104, 128, 147, 0.75)";
      ctx.fillRect(x, panelTop, 4, panelH);
      ctx.fillStyle = "rgba(213, 228, 239, 0.14)";
      ctx.fillRect(x, panelTop, 1, panelH);
      ctx.fillStyle = "rgba(20, 30, 38, 0.14)";
      ctx.fillRect(x + 3, panelTop, 1, panelH);
    } else {
      const y = panelTop + index * ribGap;
      ctx.fillStyle = "rgba(104, 128, 147, 0.75)";
      ctx.fillRect(panelLeft, y, panelW, 4);
      ctx.fillStyle = "rgba(213, 228, 239, 0.14)";
      ctx.fillRect(panelLeft, y, panelW, 1);
      ctx.fillStyle = "rgba(20, 30, 38, 0.14)";
      ctx.fillRect(panelLeft, y + 3, panelW, 1);
    }
  }

  ctx.fillStyle = highlight;
  if (horizontal) {
    ctx.fillRect(left + 10, top + 9, bodyW - 20, 2);
  } else {
    ctx.fillRect(left + 9, top + 10, 2, bodyH - 20);
  }

  const bolts = [
    [left + 9, top + 9],
    [left + bodyW - 9, top + 9],
    [left + 9, top + bodyH - 9],
    [left + bodyW - 9, top + bodyH - 9],
  ];

  for (const [bx, by] of bolts) {
    ctx.fillStyle = edgeColor;
    ctx.beginPath();
    ctx.arc(bx, by, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(182, 201, 214, 0.22)";
    ctx.beginPath();
    ctx.arc(bx - 0.8, by - 0.8, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  return true;
}

function getVisualRect(entity) {
  return getEntityVisualRect(entity);
}

function drawMappedAsset(entity, options = {}) {
  if (!entity?.asset) {
    return false;
  }

  const image = loadSprite(entity.asset);
  if (!image?.complete || !image.naturalWidth) {
    return false;
  }

  return drawAssetImage(ctx, image, entity, {
    rect: options.rect,
    useVisualBounds: options.useVisualBounds,
    alphaMultiplier: options.alphaMultiplier,
    cropToOpaqueBounds: options.cropToOpaqueBounds,
  });
}

function drawWoodenCrate(obstacle) {
  const left = obstacle.x;
  const top = obstacle.y;
  const damageStage = obstacle.damageStage || 0;
  const wear = Math.min(1, damageStage / 2);
  const crateGradient = ctx.createLinearGradient(left, top, left, top + obstacle.h);
  crateGradient.addColorStop(0, wear > 0 ? "#b17b47" : "#b98954");
  crateGradient.addColorStop(1, wear > 0.5 ? "#68411f" : "#815931");

  ctx.save();
  ctx.fillStyle = "rgba(31, 19, 10, 0.18)";
  ctx.fillRect(left + 4 + damageStage, top + 5 + damageStage, obstacle.w, obstacle.h);
  ctx.fillStyle = crateGradient;
  ctx.fillRect(left, top, obstacle.w, obstacle.h);
  ctx.strokeStyle = "rgba(55, 33, 16, 0.92)";
  ctx.lineWidth = 2;
  ctx.strokeRect(left, top, obstacle.w, obstacle.h);

  ctx.fillStyle = "rgba(239, 214, 180, 0.18)";
  ctx.fillRect(left + 5, top + 5, obstacle.w - 10, 5);

  ctx.strokeStyle = "rgba(73, 45, 19, 0.7)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(left + 8, top + 8);
  ctx.lineTo(left + obstacle.w - 8, top + obstacle.h - 8);
  ctx.moveTo(left + obstacle.w - 8, top + 8);
  ctx.lineTo(left + 8, top + obstacle.h - 8);
  ctx.stroke();

  ctx.fillStyle = "rgba(96, 62, 28, 0.9)";
  ctx.fillRect(left + obstacle.w * 0.5 - 3, top + 6, 6, obstacle.h - 12);
  ctx.fillRect(left + 6, top + obstacle.h * 0.5 - 3, obstacle.w - 12, 6);

  if (damageStage >= 1) {
    ctx.strokeStyle = "rgba(58, 32, 16, 0.9)";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(left + 10, top + obstacle.h * 0.26);
    ctx.lineTo(left + obstacle.w * 0.44, top + obstacle.h * 0.48);
    ctx.lineTo(left + obstacle.w * 0.35, top + obstacle.h - 10);
    ctx.stroke();

    ctx.fillStyle = "rgba(48, 28, 15, 0.26)";
    ctx.fillRect(left + obstacle.w * 0.62, top + 8, 6, obstacle.h - 16);
  }

  if (damageStage >= 2) {
    ctx.fillStyle = "rgba(58, 33, 17, 0.42)";
    ctx.beginPath();
    ctx.moveTo(left + obstacle.w * 0.55, top + 9);
    ctx.lineTo(left + obstacle.w - 9, top + 14);
    ctx.lineTo(left + obstacle.w - 13, top + obstacle.h * 0.52);
    ctx.lineTo(left + obstacle.w * 0.68, top + obstacle.h * 0.44);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(235, 205, 172, 0.28)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(left + obstacle.w * 0.58, top + 13);
    ctx.lineTo(left + obstacle.w - 12, top + obstacle.h * 0.48);
    ctx.stroke();
  }

  ctx.restore();
}

function drawFenceObstacle(obstacle) {
  const vertical = obstacle.h > obstacle.w;
  ctx.save();
  ctx.fillStyle = "rgba(78, 86, 92, 0.24)";
  ctx.fillRect(obstacle.x + 2, obstacle.y + 3, obstacle.w, obstacle.h);
  ctx.fillStyle = "rgba(112, 117, 120, 0.9)";
  ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
  ctx.strokeStyle = "rgba(230, 238, 242, 0.3)";
  ctx.lineWidth = 1;
  ctx.strokeRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);

  ctx.strokeStyle = "rgba(223, 232, 237, 0.22)";
  ctx.lineWidth = 1;
  if (vertical) {
    for (let y = obstacle.y + 10; y < obstacle.y + obstacle.h - 10; y += 22) {
      ctx.beginPath();
      ctx.moveTo(obstacle.x + 2, y);
      ctx.lineTo(obstacle.x + obstacle.w - 2, y + 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(obstacle.x + obstacle.w - 2, y);
      ctx.lineTo(obstacle.x + 2, y + 8);
      ctx.stroke();
    }
  } else {
    for (let x = obstacle.x + 10; x < obstacle.x + obstacle.w - 10; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, obstacle.y + 2);
      ctx.lineTo(x + 8, obstacle.y + obstacle.h - 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 8, obstacle.y + 2);
      ctx.lineTo(x, obstacle.y + obstacle.h - 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawFencePostObstacle(obstacle) {
  ctx.save();
  const gradient = ctx.createLinearGradient(obstacle.x, obstacle.y, obstacle.x, obstacle.y + obstacle.h);
  gradient.addColorStop(0, "#a49d8f");
  gradient.addColorStop(1, "#6d665d");
  ctx.fillStyle = gradient;
  ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
  ctx.strokeStyle = "rgba(53, 50, 47, 0.42)";
  ctx.strokeRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
  ctx.fillStyle = "rgba(255, 247, 236, 0.14)";
  ctx.fillRect(obstacle.x + 4, obstacle.y + 4, obstacle.w - 8, 6);
  ctx.restore();
}

function drawCheckpointBarrier(obstacle) {
  ctx.save();
  ctx.fillStyle = "rgba(69, 65, 58, 0.14)";
  ctx.fillRect(obstacle.x + 5, obstacle.y + 6, obstacle.w, obstacle.h);
  const gradient = ctx.createLinearGradient(obstacle.x, obstacle.y, obstacle.x, obstacle.y + obstacle.h);
  gradient.addColorStop(0, "#d9ceb8");
  gradient.addColorStop(1, "#b8a98a");
  ctx.fillStyle = gradient;
  ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
  ctx.strokeStyle = "rgba(103, 85, 47, 0.44)";
  ctx.lineWidth = 2;
  ctx.strokeRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
  for (let x = obstacle.x - 16; x < obstacle.x + obstacle.w + 20; x += 34) {
    ctx.fillStyle = "rgba(153, 108, 38, 0.78)";
    ctx.beginPath();
    ctx.moveTo(x, obstacle.y + obstacle.h);
    ctx.lineTo(x + 18, obstacle.y);
    ctx.lineTo(x + 30, obstacle.y);
    ctx.lineTo(x + 12, obstacle.y + obstacle.h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawTurretObstacle(obstacle) {
  const cx = obstacle.x + obstacle.w * 0.5;
  const cy = obstacle.y + obstacle.h * 0.5;
  ctx.save();
  ctx.fillStyle = "rgba(34, 39, 44, 0.16)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 12, obstacle.w * 0.42, obstacle.h * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  const baseGradient = ctx.createLinearGradient(0, obstacle.y, 0, obstacle.y + obstacle.h);
  baseGradient.addColorStop(0, "#746f68");
  baseGradient.addColorStop(1, "#4e4a45");
  ctx.fillStyle = baseGradient;
  ctx.beginPath();
  ctx.roundRect(obstacle.x + 8, obstacle.y + 18, obstacle.w - 16, obstacle.h - 12, 10);
  ctx.fill();

  ctx.fillStyle = "#2c3137";
  ctx.beginPath();
  ctx.arc(cx, cy + 2, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx - 6, cy - 8, 12, 20, 5);
  ctx.fill();

  ctx.fillStyle = "#9ea8b0";
  ctx.beginPath();
  ctx.roundRect(cx - 18, cy - 18, 36, 16, 6);
  ctx.fill();
  ctx.fillStyle = "#1e2329";
  ctx.fillRect(cx + 6, cy - 13, 26, 6);
  ctx.fillRect(cx - 32, cy - 13, 26, 6);

  ctx.strokeStyle = "rgba(231, 237, 241, 0.22)";
  ctx.strokeRect(obstacle.x + 8, obstacle.y + 18, obstacle.w - 16, obstacle.h - 12);
  ctx.restore();
}

function drawSpecimenZones() {
  if (gameState.levelId !== "admin" || !activeSpecimenZones.length) {
    return;
  }

  const specimenSprite = loadSprite(CHARACTER_SPRITES.cyber_specimen);
  for (const zone of activeSpecimenZones) {
    const containedSpecimen = gameState.enemies.find((enemy) => enemy.zoneId === zone.id && enemy.hidden);
    ctx.save();
    ctx.fillStyle = "rgba(127, 46, 54, 0.12)";
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    ctx.strokeStyle = "rgba(166, 78, 90, 0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);

    if (containedSpecimen && drawCharacterSprite(specimenSprite, zone.specimenX, zone.specimenY, zone.angle || 0, 84, 84, 0.78)) {
      ctx.fillStyle = "rgba(27, 10, 15, 0.18)";
      ctx.beginPath();
      ctx.ellipse(zone.specimenX, zone.specimenY + 26, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(233, 238, 241, 0.2)";
    ctx.lineWidth = 1.2;
    for (let x = zone.x + 10; x < zone.x + zone.w - 8; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, zone.y + 4);
      ctx.lineTo(x, zone.y + zone.h - 4);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255, 239, 214, 0.72)";
    ctx.font = '11px Consolas';
    ctx.fillText("SPECIMEN", zone.x + 8, zone.y - 8);
    ctx.restore();
  }
}

function drawCharacterSprite(image, x, y, angle, width, height, alpha = 1) {
  if (!image || !image.complete || !image.naturalWidth) {
    return false;
  }

  ctx.save();
  ctx.globalAlpha = alpha;
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
  {
    "x": 184,
    "y": 164,
    "w": 212,
    "h": 92,
    "drawW": 236,
    "drawH": 112,
    "visualType": "container",
    "containerPreset": "freightShortH",
    "asset": "assets/environment/container.png",
    "drawOffsetX": -12,
    "drawOffsetY": -10,
    "rotation": 0
  },
  {
    "x": 509,
    "y": 129,
    "w": 212,
    "h": 92,
    "drawW": 236,
    "drawH": 112,
    "visualType": "container",
    "containerPreset": "freightShortH",
    "asset": "assets/environment/container.png",
    "drawOffsetX": -24,
    "drawOffsetY": -6,
    "rotation": 1.5707963267948966
  },
  {
    "x": 834,
    "y": 244,
    "w": 212,
    "h": 92,
    "drawW": 236,
    "drawH": 112,
    "visualType": "container",
    "containerPreset": "freightShortH",
    "asset": "assets/environment/container.png",
    "drawOffsetX": -12,
    "drawOffsetY": -10,
    "rotation": 0
  },
  {
    "x": 1452,
    "y": 224,
    "w": 212,
    "h": 92,
    "drawW": 236,
    "drawH": 112,
    "visualType": "container",
    "containerPreset": "freightShortH",
    "asset": "assets/environment/container.png",
    "drawOffsetX": -23,
    "drawOffsetY": -6,
    "rotation": 1.5707963267948966
  },
  {
    "x": 2104,
    "y": 169,
    "w": 212,
    "h": 92,
    "drawW": 236,
    "drawH": 112,
    "visualType": "container",
    "containerPreset": "freightShortH",
    "asset": "assets/environment/container.png",
    "drawOffsetX": -12,
    "drawOffsetY": -10,
    "rotation": 0
  },
  {
    "x": 219,
    "y": 531,
    "w": 212,
    "h": 92,
    "drawW": 236,
    "drawH": 112,
    "visualType": "container",
    "containerPreset": "freightShortH",
    "asset": "assets/environment/container.png",
    "drawOffsetX": -23,
    "drawOffsetY": -6,
    "rotation": 1.5707963267948966
  },
  {
    "x": 1003,
    "y": 568,
    "w": 212,
    "h": 92,
    "drawW": 236,
    "drawH": 112,
    "visualType": "container",
    "containerPreset": "freightShortH",
    "asset": "assets/environment/container.png",
    "drawOffsetX": -27,
    "drawOffsetY": -7,
    "rotation": 1.5707963267948966
  },
  {
    "x": 1339,
    "y": 664,
    "w": 212,
    "h": 92,
    "drawW": 236,
    "drawH": 112,
    "visualType": "container",
    "containerPreset": "freightShortH",
    "asset": "assets/environment/container.png",
    "drawOffsetX": -12,
    "drawOffsetY": -10,
    "rotation": 0
  },
  {
    "x": 244,
    "y": 914,
    "w": 212,
    "h": 92,
    "drawW": 236,
    "drawH": 112,
    "visualType": "container",
    "containerPreset": "freightShortH",
    "asset": "assets/environment/container.png",
    "drawOffsetX": -12,
    "drawOffsetY": -10,
    "rotation": 0
  },
  {
    "x": 644,
    "y": 929,
    "w": 212,
    "h": 92,
    "drawW": 236,
    "drawH": 112,
    "visualType": "container",
    "containerPreset": "freightShortH",
    "asset": "assets/environment/container.png",
    "drawOffsetX": -12,
    "drawOffsetY": -10,
    "rotation": 0
  },
  {
    "x": 1054,
    "y": 934,
    "w": 212,
    "h": 92,
    "drawW": 236,
    "drawH": 112,
    "visualType": "container",
    "containerPreset": "freightShortH",
    "asset": "assets/environment/container.png",
    "drawOffsetX": -12,
    "drawOffsetY": -10,
    "rotation": 0
  },
  {
    "x": 1544,
    "y": 939,
    "w": 212,
    "h": 92,
    "drawW": 236,
    "drawH": 112,
    "visualType": "container",
    "containerPreset": "freightShortH",
    "asset": "assets/environment/container.png",
    "drawOffsetX": -12,
    "drawOffsetY": -10,
    "rotation": 0
  },
  {
    "x": 1870,
    "y": 798,
    "w": 212,
    "h": 92,
    "drawW": 236,
    "drawH": 112,
    "visualType": "container",
    "containerPreset": "freightShortH",
    "asset": "assets/environment/container.png",
    "drawOffsetX": -23,
    "drawOffsetY": -5,
    "rotation": 1.5707963267948966
  },
  {
    "x": 2174,
    "y": 889,
    "w": 212,
    "h": 92,
    "drawW": 236,
    "drawH": 112,
    "visualType": "container",
    "containerPreset": "freightShortH",
    "asset": "assets/environment/container.png",
    "drawOffsetX": -12,
    "drawOffsetY": -10,
    "rotation": 0
  },
  {
    "x": 709,
    "y": 1334,
    "w": 212,
    "h": 92,
    "drawW": 236,
    "drawH": 112,
    "visualType": "container",
    "containerPreset": "freightShortH",
    "asset": "assets/environment/container.png",
    "drawOffsetX": -12,
    "drawOffsetY": -10,
    "rotation": 0
  },
  {
    "x": 1984,
    "y": 1359,
    "w": 212,
    "h": 92,
    "drawW": 236,
    "drawH": 112,
    "visualType": "container",
    "containerPreset": "freightShortH",
    "asset": "assets/environment/container.png",
    "drawOffsetX": -12,
    "drawOffsetY": -10,
    "rotation": 0
  },
  {
    "id": "freight-crate-4",
    "x": 1988,
    "y": 1284,
    "w": 47,
    "h": 47,
    "kind": "crate",
    "hp": 18,
    "maxHp": 18,
    "damageStage": 0,
    "broken": false,
    "lootType": "noise",
    "lootValue": 1,
    "lootSpawned": false,
    "drawOffsetX": -4,
    "drawOffsetY": -4,
    "drawW": 56,
    "drawH": 56
  },
  {
    "id": "freight-crate-5",
    "x": 2306,
    "y": 990,
    "w": 56,
    "h": 56,
    "kind": "crate",
    "hp": 18,
    "maxHp": 18,
    "damageStage": 0,
    "broken": false,
    "lootType": "shield",
    "lootValue": 42,
    "lootSpawned": false
  },
  {
    "id": "obstacle-257",
    "x": 941,
    "y": 925,
    "w": 71,
    "h": 71,
    "kind": "crate",
    "asset": "assets/environment/crate.png",
    "rotation": 0,
    "opacity": 1,
    "drawOffsetX": -7,
    "drawOffsetY": -7,
    "drawW": 84,
    "drawH": 84
  },
  {
    "id": "obstacle-263",
    "x": 1973,
    "y": 1253,
    "w": 71,
    "h": 71,
    "kind": "crate",
    "asset": "assets/environment/crate.png",
    "rotation": 0,
    "opacity": 1,
    "drawOffsetX": -7,
    "drawOffsetY": -7,
    "drawW": 84,
    "drawH": 84
  },
  {
    "id": "obstacle-265",
    "x": 2302,
    "y": 986,
    "w": 71,
    "h": 71,
    "kind": "crate",
    "asset": "assets/environment/crate.png",
    "rotation": 0,
    "opacity": 1,
    "drawOffsetX": -7,
    "drawOffsetY": -7,
    "drawW": 84,
    "drawH": 84
  },
  {
    "id": "obstacle-267",
    "x": 1740,
    "y": 390,
    "w": 71,
    "h": 71,
    "kind": "crate",
    "asset": "assets/environment/crate.png",
    "rotation": 0,
    "opacity": 1,
    "drawOffsetX": -7,
    "drawOffsetY": -7,
    "drawW": 84,
    "drawH": 84
  },
  {
    "id": "obstacle-269",
    "x": 466,
    "y": 419,
    "w": 71,
    "h": 71,
    "kind": "crate",
    "asset": "assets/environment/crate.png",
    "rotation": 0,
    "opacity": 1,
    "drawOffsetX": -7,
    "drawOffsetY": -7,
    "drawW": 84,
    "drawH": 84
  },
  {
    "id": "obstacle-271",
    "x": 1688,
    "y": 1277,
    "w": 129,
    "h": 84,
    "kind": "wall",
    "asset": "assets/environment/pallets.png",
    "rotation": 0,
    "opacity": 1,
    "drawOffsetX": -8,
    "drawOffsetY": -2,
    "drawW": 145,
    "drawH": 90
  },
  {
    "id": "obstacle-273",
    "x": 1575,
    "y": 1378,
    "w": 107,
    "h": 93,
    "kind": "wall",
    "asset": "assets/environment/pallets.png",
    "rotation": 0,
    "opacity": 1,
    "drawOffsetX": -7,
    "drawOffsetY": -3,
    "drawW": 120,
    "drawH": 99
  },
  {
    "id": "obstacle-275",
    "x": 1584,
    "y": 1283,
    "w": 90,
    "h": 94,
    "kind": "wall",
    "asset": "assets/environment/pallets.png",
    "rotation": 1.5707963267948966,
    "opacity": 1,
    "drawOffsetX": -9,
    "drawOffsetY": -2,
    "drawW": 105,
    "drawH": 96
  },
  {
    "id": "obstacle-277",
    "x": 1694,
    "y": 1374,
    "w": 102,
    "h": 103,
    "kind": "wall",
    "asset": "assets/environment/pallets.png",
    "rotation": 1.5707963267948966,
    "opacity": 1,
    "drawOffsetX": -8,
    "drawOffsetY": -3,
    "drawW": 116,
    "drawH": 109
  },
  {
    "id": "obstacle-279",
    "x": 1884,
    "y": -9,
    "w": 85,
    "h": 273,
    "kind": "wall",
    "asset": "assets/environment/conctete_wall.png",
    "rotation": 1.5707963267948966,
    "opacity": 1,
    "drawOffsetX": -131,
    "drawOffsetY": 58,
    "drawW": 346,
    "drawH": 156
  },
  {
    "id": "obstacle-284",
    "x": 1887,
    "y": 319,
    "w": 85,
    "h": 273,
    "kind": "wall",
    "asset": "assets/environment/conctete_wall.png",
    "rotation": 1.5707963267948966,
    "opacity": 1,
    "drawOffsetX": -131,
    "drawOffsetY": 58,
    "drawW": 346,
    "drawH": 156
  },
  {
    "id": "obstacle-288",
    "x": 1887,
    "y": 1619,
    "w": 85,
    "h": 273,
    "kind": "wall",
    "asset": "assets/environment/conctete_wall.png",
    "rotation": 1.5707963267948966,
    "opacity": 1,
    "drawOffsetX": -131,
    "drawOffsetY": 58,
    "drawW": 346,
    "drawH": 156
  }
];

const buildings = [
  {
    "id": "service",
    "label": "service room",
    "x": 620,
    "y": 540,
    "w": 280,
    "h": 180,
    "door": {
      "id": "service-door",
      "side": "south",
      "x": 730,
      "y": 708,
      "w": 60,
      "h": 12,
      "kind": "door",
      "open": false
    },
    "windows": [
      {
        "id": "service-north-west",
        "side": "north",
        "x": 662,
        "y": 540,
        "w": 48,
        "h": 12,
        "kind": "window",
        "broken": false
      },
      {
        "id": "service-north-east",
        "side": "north",
        "x": 806,
        "y": 540,
        "w": 48,
        "h": 12,
        "kind": "window",
        "broken": false
      }
    ],
    "squadSpawns": [
      {
        "x": 695,
        "y": 610,
        "kind": "rusher",
        "tactic": "assault",
        "squadRole": "breacher"
      },
      {
        "x": 768,
        "y": 612,
        "kind": "guard",
        "tactic": "anchor",
        "shield": true,
        "squadRole": "shieldLead"
      },
      {
        "x": 836,
        "y": 636,
        "kind": "rusher",
        "tactic": "flankRight",
        "squadRole": "flankRight"
      }
    ]
  },
  {
    "id": "records",
    "label": "records office",
    "x": 1080,
    "y": 1260,
    "w": 320,
    "h": 190,
    "door": {
      "id": "records-door",
      "side": "west",
      "x": 1080,
      "y": 1332,
      "w": 12,
      "h": 62,
      "kind": "door",
      "open": false
    },
    "windows": [
      {
        "id": "records-north-left",
        "side": "north",
        "x": 1136,
        "y": 1260,
        "w": 54,
        "h": 12,
        "kind": "window",
        "broken": false
      },
      {
        "id": "records-north-right",
        "side": "north",
        "x": 1290,
        "y": 1260,
        "w": 54,
        "h": 12,
        "kind": "window",
        "broken": false
      }
    ],
    "squadSpawns": [
      {
        "x": 1160,
        "y": 1338,
        "kind": "guard",
        "tactic": "anchor",
        "shield": true,
        "squadRole": "shieldLead"
      },
      {
        "x": 1248,
        "y": 1324,
        "kind": "rusher",
        "tactic": "flankLeft",
        "squadRole": "flankLeft"
      },
      {
        "x": 1320,
        "y": 1386,
        "kind": "rusher",
        "tactic": "assault",
        "squadRole": "breacher"
      }
    ]
  },
  {
    "id": "depot",
    "label": "loading depot",
    "x": 2060,
    "y": 470,
    "w": 280,
    "h": 180,
    "door": {
      "id": "depot-door",
      "side": "south",
      "x": 2164,
      "y": 638,
      "w": 64,
      "h": 12,
      "kind": "door",
      "open": false
    },
    "windows": [
      {
        "id": "depot-north-left",
        "side": "north",
        "x": 2100,
        "y": 470,
        "w": 48,
        "h": 12,
        "kind": "window",
        "broken": false
      },
      {
        "id": "depot-east-slit",
        "side": "east",
        "x": 2328,
        "y": 512,
        "w": 12,
        "h": 46,
        "kind": "window",
        "broken": false
      }
    ],
    "squadSpawns": [
      {
        "x": 2140,
        "y": 548,
        "kind": "guard",
        "tactic": "anchor",
        "shield": true,
        "squadRole": "shieldLead"
      },
      {
        "x": 2206,
        "y": 608,
        "kind": "rusher",
        "tactic": "flankRight",
        "squadRole": "flankRight"
      },
      {
        "x": 2276,
        "y": 560,
        "kind": "rusher",
        "tactic": "flankLeft",
        "squadRole": "flankLeft"
      }
    ]
  }
];

const extractionZone = {
  "x": 2370,
  "y": 1540,
  "w": 180,
  "h": 150
};
const spawnPools = {
  "player": [
    {
      "x": 120,
      "y": 1520
    },
    {
      "x": 130,
      "y": 980
    },
    {
      "x": 170,
      "y": 430
    },
    {
      "x": 300,
      "y": 1640
    }
  ],
  "core": [
    {
      "x": 672,
      "y": 580
    },
    {
      "x": 818,
      "y": 676
    },
    {
      "x": 1140,
      "y": 1294
    },
    {
      "x": 1360,
      "y": 1416
    },
    {
      "x": 2110,
      "y": 506
    },
    {
      "x": 2310,
      "y": 620
    }
  ],
  "shield": [
    {
      "x": 420,
      "y": 980
    },
    {
      "x": 1280,
      "y": 720
    },
    {
      "x": 1840,
      "y": 1180
    },
    {
      "x": 2280,
      "y": 620
    }
  ],
  "medkit": [
    {
      "x": 558,
      "y": 664
    },
    {
      "x": 1188,
      "y": 1360
    },
    {
      "x": 1760,
      "y": 1180
    },
    {
      "x": 2148,
      "y": 564
    }
  ],
  "noise": [
    {
      "x": 848,
      "y": 628
    },
    {
      "x": 1318,
      "y": 1366
    },
    {
      "x": 1640,
      "y": 420
    },
    {
      "x": 2230,
      "y": 612
    }
  ],
  "cash": [
    {
      "x": 330,
      "y": 820
    },
    {
      "x": 510,
      "y": 470
    },
    {
      "x": 720,
      "y": 820
    },
    {
      "x": 930,
      "y": 392
    },
    {
      "x": 1120,
      "y": 830
    },
    {
      "x": 1410,
      "y": 540
    },
    {
      "x": 1490,
      "y": 890
    },
    {
      "x": 1670,
      "y": 520
    },
    {
      "x": 860,
      "y": 1080
    },
    {
      "x": 560,
      "y": 1080
    },
    {
      "x": 1830,
      "y": 320
    },
    {
      "x": 2230,
      "y": 370
    },
    {
      "x": 1830,
      "y": 810
    },
    {
      "x": 2320,
      "y": 1080
    },
    {
      "x": 610,
      "y": 1510
    },
    {
      "x": 1220,
      "y": 1440
    },
    {
      "x": 1860,
      "y": 1430
    },
    {
      "x": 2260,
      "y": 1540
    }
  ],
  "enemy": [
    {
      "x": 150,
      "y": 310
    },
    {
      "x": 470,
      "y": 470
    },
    {
      "x": 720,
      "y": 790
    },
    {
      "x": 1100,
      "y": 390
    },
    {
      "x": 950,
      "y": 820
    },
    {
      "x": 1250,
      "y": 390
    },
    {
      "x": 1430,
      "y": 540
    },
    {
      "x": 1470,
      "y": 900
    },
    {
      "x": 1640,
      "y": 500
    },
    {
      "x": 1110,
      "y": 1080
    },
    {
      "x": 1930,
      "y": 280
    },
    {
      "x": 2210,
      "y": 540
    },
    {
      "x": 1860,
      "y": 980
    },
    {
      "x": 760,
      "y": 1440
    },
    {
      "x": 1660,
      "y": 1420
    },
    {
      "x": 2200,
      "y": 1370
    }
  ]
};

function cloneBuilding(building) {
  return {
    ...building,
    door: building.door ? { ...building.door } : null,
    windows: (building.windows || []).map((windowEntry) => ({ ...windowEntry })),
    squadSpawns: (building.squadSpawns || []).map((spawn) => ({ ...spawn })),
  };
}

function cloneSpawnPools(source) {
  return Object.fromEntries(
    Object.entries(source || {}).map(([key, entries]) => [key, (entries || []).map((entry) => ({ ...entry }))])
  );
}

function cloneMarkerEntries(entries = []) {
  return entries.map((entry) => ({ ...entry }));
}

const LEVEL_TEMPLATES = {
  "freight": {
    "id": "freight",
    "name": "Freight Quarter",
    "duration": 300,
    "requiredLoot": 3,
    "bossRequired": false,
    "objective": "Sweep the district, secure 3 relay cores, and get out alive.",
    "extractionPrompt": "Collect the relay cores and move east for extraction.",
    "objectiveSingular": "relay core",
    "objectivePlural": "relay cores",
    "objectiveShort": "cores",
    "nextLevelId": "admin",
    "transitionMessage": "Freight district cleared. Administrative complex infiltration underway.",
    "obstacles": [
      {
        "x": 184,
        "y": 164,
        "w": 212,
        "h": 92,
        "drawW": 236,
        "drawH": 112,
        "visualType": "container",
        "containerPreset": "freightShortH",
        "asset": "assets/environment/container.png",
        "drawOffsetX": -12,
        "drawOffsetY": -10,
        "rotation": 0
      },
      {
        "x": 509,
        "y": 129,
        "w": 212,
        "h": 92,
        "drawW": 236,
        "drawH": 112,
        "visualType": "container",
        "containerPreset": "freightShortH",
        "asset": "assets/environment/container.png",
        "drawOffsetX": -24,
        "drawOffsetY": -6,
        "rotation": 1.5707963267948966
      },
      {
        "x": 834,
        "y": 244,
        "w": 212,
        "h": 92,
        "drawW": 236,
        "drawH": 112,
        "visualType": "container",
        "containerPreset": "freightShortH",
        "asset": "assets/environment/container.png",
        "drawOffsetX": -12,
        "drawOffsetY": -10,
        "rotation": 0
      },
      {
        "x": 1452,
        "y": 224,
        "w": 212,
        "h": 92,
        "drawW": 236,
        "drawH": 112,
        "visualType": "container",
        "containerPreset": "freightShortH",
        "asset": "assets/environment/container.png",
        "drawOffsetX": -23,
        "drawOffsetY": -6,
        "rotation": 1.5707963267948966
      },
      {
        "x": 2104,
        "y": 169,
        "w": 212,
        "h": 92,
        "drawW": 236,
        "drawH": 112,
        "visualType": "container",
        "containerPreset": "freightShortH",
        "asset": "assets/environment/container.png",
        "drawOffsetX": -12,
        "drawOffsetY": -10,
        "rotation": 0
      },
      {
        "x": 219,
        "y": 531,
        "w": 212,
        "h": 92,
        "drawW": 236,
        "drawH": 112,
        "visualType": "container",
        "containerPreset": "freightShortH",
        "asset": "assets/environment/container.png",
        "drawOffsetX": -23,
        "drawOffsetY": -6,
        "rotation": 1.5707963267948966
      },
      {
        "x": 1003,
        "y": 568,
        "w": 212,
        "h": 92,
        "drawW": 236,
        "drawH": 112,
        "visualType": "container",
        "containerPreset": "freightShortH",
        "asset": "assets/environment/container.png",
        "drawOffsetX": -27,
        "drawOffsetY": -7,
        "rotation": 1.5707963267948966
      },
      {
        "x": 1339,
        "y": 664,
        "w": 212,
        "h": 92,
        "drawW": 236,
        "drawH": 112,
        "visualType": "container",
        "containerPreset": "freightShortH",
        "asset": "assets/environment/container.png",
        "drawOffsetX": -12,
        "drawOffsetY": -10,
        "rotation": 0
      },
      {
        "x": 244,
        "y": 914,
        "w": 212,
        "h": 92,
        "drawW": 236,
        "drawH": 112,
        "visualType": "container",
        "containerPreset": "freightShortH",
        "asset": "assets/environment/container.png",
        "drawOffsetX": -12,
        "drawOffsetY": -10,
        "rotation": 0
      },
      {
        "x": 644,
        "y": 929,
        "w": 212,
        "h": 92,
        "drawW": 236,
        "drawH": 112,
        "visualType": "container",
        "containerPreset": "freightShortH",
        "asset": "assets/environment/container.png",
        "drawOffsetX": -12,
        "drawOffsetY": -10,
        "rotation": 0
      },
      {
        "x": 1054,
        "y": 934,
        "w": 212,
        "h": 92,
        "drawW": 236,
        "drawH": 112,
        "visualType": "container",
        "containerPreset": "freightShortH",
        "asset": "assets/environment/container.png",
        "drawOffsetX": -12,
        "drawOffsetY": -10,
        "rotation": 0
      },
      {
        "x": 1544,
        "y": 939,
        "w": 212,
        "h": 92,
        "drawW": 236,
        "drawH": 112,
        "visualType": "container",
        "containerPreset": "freightShortH",
        "asset": "assets/environment/container.png",
        "drawOffsetX": -12,
        "drawOffsetY": -10,
        "rotation": 0
      },
      {
        "x": 1870,
        "y": 798,
        "w": 212,
        "h": 92,
        "drawW": 236,
        "drawH": 112,
        "visualType": "container",
        "containerPreset": "freightShortH",
        "asset": "assets/environment/container.png",
        "drawOffsetX": -23,
        "drawOffsetY": -5,
        "rotation": 1.5707963267948966
      },
      {
        "x": 2174,
        "y": 889,
        "w": 212,
        "h": 92,
        "drawW": 236,
        "drawH": 112,
        "visualType": "container",
        "containerPreset": "freightShortH",
        "asset": "assets/environment/container.png",
        "drawOffsetX": -12,
        "drawOffsetY": -10,
        "rotation": 0
      },
      {
        "x": 709,
        "y": 1334,
        "w": 212,
        "h": 92,
        "drawW": 236,
        "drawH": 112,
        "visualType": "container",
        "containerPreset": "freightShortH",
        "asset": "assets/environment/container.png",
        "drawOffsetX": -12,
        "drawOffsetY": -10,
        "rotation": 0
      },
      {
        "x": 1984,
        "y": 1359,
        "w": 212,
        "h": 92,
        "drawW": 236,
        "drawH": 112,
        "visualType": "container",
        "containerPreset": "freightShortH",
        "asset": "assets/environment/container.png",
        "drawOffsetX": -12,
        "drawOffsetY": -10,
        "rotation": 0
      },
      {
        "id": "freight-crate-4",
        "x": 1988,
        "y": 1284,
        "w": 47,
        "h": 47,
        "kind": "crate",
        "hp": 18,
        "maxHp": 18,
        "damageStage": 0,
        "broken": false,
        "lootType": "noise",
        "lootValue": 1,
        "lootSpawned": false,
        "drawOffsetX": -4,
        "drawOffsetY": -4,
        "drawW": 56,
        "drawH": 56
      },
      {
        "id": "freight-crate-5",
        "x": 2306,
        "y": 990,
        "w": 56,
        "h": 56,
        "kind": "crate",
        "hp": 18,
        "maxHp": 18,
        "damageStage": 0,
        "broken": false,
        "lootType": "shield",
        "lootValue": 42,
        "lootSpawned": false
      },
      {
        "id": "obstacle-257",
        "x": 941,
        "y": 925,
        "w": 71,
        "h": 71,
        "kind": "crate",
        "asset": "assets/environment/crate.png",
        "rotation": 0,
        "opacity": 1,
        "drawOffsetX": -7,
        "drawOffsetY": -7,
        "drawW": 84,
        "drawH": 84
      },
      {
        "id": "obstacle-263",
        "x": 1973,
        "y": 1253,
        "w": 71,
        "h": 71,
        "kind": "crate",
        "asset": "assets/environment/crate.png",
        "rotation": 0,
        "opacity": 1,
        "drawOffsetX": -7,
        "drawOffsetY": -7,
        "drawW": 84,
        "drawH": 84
      },
      {
        "id": "obstacle-265",
        "x": 2302,
        "y": 986,
        "w": 71,
        "h": 71,
        "kind": "crate",
        "asset": "assets/environment/crate.png",
        "rotation": 0,
        "opacity": 1,
        "drawOffsetX": -7,
        "drawOffsetY": -7,
        "drawW": 84,
        "drawH": 84
      },
      {
        "id": "obstacle-267",
        "x": 1740,
        "y": 390,
        "w": 71,
        "h": 71,
        "kind": "crate",
        "asset": "assets/environment/crate.png",
        "rotation": 0,
        "opacity": 1,
        "drawOffsetX": -7,
        "drawOffsetY": -7,
        "drawW": 84,
        "drawH": 84
      },
      {
        "id": "obstacle-269",
        "x": 466,
        "y": 419,
        "w": 71,
        "h": 71,
        "kind": "crate",
        "asset": "assets/environment/crate.png",
        "rotation": 0,
        "opacity": 1,
        "drawOffsetX": -7,
        "drawOffsetY": -7,
        "drawW": 84,
        "drawH": 84
      },
      {
        "id": "obstacle-271",
        "x": 1688,
        "y": 1277,
        "w": 129,
        "h": 84,
        "kind": "wall",
        "asset": "assets/environment/pallets.png",
        "rotation": 0,
        "opacity": 1,
        "drawOffsetX": -8,
        "drawOffsetY": -2,
        "drawW": 145,
        "drawH": 90
      },
      {
        "id": "obstacle-273",
        "x": 1575,
        "y": 1378,
        "w": 107,
        "h": 93,
        "kind": "wall",
        "asset": "assets/environment/pallets.png",
        "rotation": 0,
        "opacity": 1,
        "drawOffsetX": -7,
        "drawOffsetY": -3,
        "drawW": 120,
        "drawH": 99
      },
      {
        "id": "obstacle-275",
        "x": 1584,
        "y": 1283,
        "w": 90,
        "h": 94,
        "kind": "wall",
        "asset": "assets/environment/pallets.png",
        "rotation": 1.5707963267948966,
        "opacity": 1,
        "drawOffsetX": -9,
        "drawOffsetY": -2,
        "drawW": 105,
        "drawH": 96
      },
      {
        "id": "obstacle-277",
        "x": 1694,
        "y": 1374,
        "w": 102,
        "h": 103,
        "kind": "wall",
        "asset": "assets/environment/pallets.png",
        "rotation": 1.5707963267948966,
        "opacity": 1,
        "drawOffsetX": -8,
        "drawOffsetY": -3,
        "drawW": 116,
        "drawH": 109
      },
      {
        "id": "obstacle-279",
        "x": 1884,
        "y": -9,
        "w": 85,
        "h": 273,
        "kind": "wall",
        "asset": "assets/environment/conctete_wall.png",
        "rotation": 1.5707963267948966,
        "opacity": 1,
        "drawOffsetX": -131,
        "drawOffsetY": 58,
        "drawW": 346,
        "drawH": 156
      },
      {
        "id": "obstacle-284",
        "x": 1887,
        "y": 319,
        "w": 85,
        "h": 273,
        "kind": "wall",
        "asset": "assets/environment/conctete_wall.png",
        "rotation": 1.5707963267948966,
        "opacity": 1,
        "drawOffsetX": -131,
        "drawOffsetY": 58,
        "drawW": 346,
        "drawH": 156
      },
      {
        "id": "obstacle-288",
        "x": 1887,
        "y": 1619,
        "w": 85,
        "h": 273,
        "kind": "wall",
        "asset": "assets/environment/conctete_wall.png",
        "rotation": 1.5707963267948966,
        "opacity": 1,
        "drawOffsetX": -131,
        "drawOffsetY": 58,
        "drawW": 346,
        "drawH": 156
      }
    ],
    "buildings": [
      {
        "id": "service",
        "label": "service room",
        "x": 620,
        "y": 540,
        "w": 280,
        "h": 180,
        "door": {
          "id": "service-door",
          "side": "south",
          "x": 730,
          "y": 708,
          "w": 60,
          "h": 12,
          "kind": "door",
          "open": false
        },
        "windows": [
          {
            "id": "service-north-west",
            "side": "north",
            "x": 662,
            "y": 540,
            "w": 48,
            "h": 12,
            "kind": "window",
            "broken": false
          },
          {
            "id": "service-north-east",
            "side": "north",
            "x": 806,
            "y": 540,
            "w": 48,
            "h": 12,
            "kind": "window",
            "broken": false
          }
        ],
        "squadSpawns": [
          {
            "x": 695,
            "y": 610,
            "kind": "rusher",
            "tactic": "assault",
            "squadRole": "breacher"
          },
          {
            "x": 768,
            "y": 612,
            "kind": "guard",
            "tactic": "anchor",
            "shield": true,
            "squadRole": "shieldLead"
          },
          {
            "x": 836,
            "y": 636,
            "kind": "rusher",
            "tactic": "flankRight",
            "squadRole": "flankRight"
          }
        ]
      },
      {
        "id": "records",
        "label": "records office",
        "x": 1080,
        "y": 1260,
        "w": 320,
        "h": 190,
        "door": {
          "id": "records-door",
          "side": "west",
          "x": 1080,
          "y": 1332,
          "w": 12,
          "h": 62,
          "kind": "door",
          "open": false
        },
        "windows": [
          {
            "id": "records-north-left",
            "side": "north",
            "x": 1136,
            "y": 1260,
            "w": 54,
            "h": 12,
            "kind": "window",
            "broken": false
          },
          {
            "id": "records-north-right",
            "side": "north",
            "x": 1290,
            "y": 1260,
            "w": 54,
            "h": 12,
            "kind": "window",
            "broken": false
          }
        ],
        "squadSpawns": [
          {
            "x": 1160,
            "y": 1338,
            "kind": "guard",
            "tactic": "anchor",
            "shield": true,
            "squadRole": "shieldLead"
          },
          {
            "x": 1248,
            "y": 1324,
            "kind": "rusher",
            "tactic": "flankLeft",
            "squadRole": "flankLeft"
          },
          {
            "x": 1320,
            "y": 1386,
            "kind": "rusher",
            "tactic": "assault",
            "squadRole": "breacher"
          }
        ]
      },
      {
        "id": "depot",
        "label": "loading depot",
        "x": 2060,
        "y": 470,
        "w": 280,
        "h": 180,
        "door": {
          "id": "depot-door",
          "side": "south",
          "x": 2164,
          "y": 638,
          "w": 64,
          "h": 12,
          "kind": "door",
          "open": false
        },
        "windows": [
          {
            "id": "depot-north-left",
            "side": "north",
            "x": 2100,
            "y": 470,
            "w": 48,
            "h": 12,
            "kind": "window",
            "broken": false
          },
          {
            "id": "depot-east-slit",
            "side": "east",
            "x": 2328,
            "y": 512,
            "w": 12,
            "h": 46,
            "kind": "window",
            "broken": false
          }
        ],
        "squadSpawns": [
          {
            "x": 2140,
            "y": 548,
            "kind": "guard",
            "tactic": "anchor",
            "shield": true,
            "squadRole": "shieldLead"
          },
          {
            "x": 2206,
            "y": 608,
            "kind": "rusher",
            "tactic": "flankRight",
            "squadRole": "flankRight"
          },
          {
            "x": 2276,
            "y": 560,
            "kind": "rusher",
            "tactic": "flankLeft",
            "squadRole": "flankLeft"
          }
        ]
      }
    ],
    "lightSources": [],
    "extractionZone": {
      "x": 2370,
      "y": 1540,
      "w": 180,
      "h": 150
    },
    "spawnPools": {
      "player": [
        {
          "x": 120,
          "y": 1520
        },
        {
          "x": 130,
          "y": 980
        },
        {
          "x": 170,
          "y": 430
        },
        {
          "x": 300,
          "y": 1640
        }
      ],
      "core": [
        {
          "x": 672,
          "y": 580
        },
        {
          "x": 818,
          "y": 676
        },
        {
          "x": 1140,
          "y": 1294
        },
        {
          "x": 1360,
          "y": 1416
        },
        {
          "x": 2110,
          "y": 506
        },
        {
          "x": 2310,
          "y": 620
        }
      ],
      "shield": [
        {
          "x": 420,
          "y": 980
        },
        {
          "x": 1280,
          "y": 720
        },
        {
          "x": 1840,
          "y": 1180
        },
        {
          "x": 2280,
          "y": 620
        }
      ],
      "medkit": [
        {
          "x": 558,
          "y": 664
        },
        {
          "x": 1188,
          "y": 1360
        },
        {
          "x": 1760,
          "y": 1180
        },
        {
          "x": 2148,
          "y": 564
        }
      ],
      "noise": [
        {
          "x": 848,
          "y": 628
        },
        {
          "x": 1318,
          "y": 1366
        },
        {
          "x": 1640,
          "y": 420
        },
        {
          "x": 2230,
          "y": 612
        }
      ],
      "cash": [
        {
          "x": 330,
          "y": 820
        },
        {
          "x": 510,
          "y": 470
        },
        {
          "x": 720,
          "y": 820
        },
        {
          "x": 930,
          "y": 392
        },
        {
          "x": 1120,
          "y": 830
        },
        {
          "x": 1410,
          "y": 540
        },
        {
          "x": 1490,
          "y": 890
        },
        {
          "x": 1670,
          "y": 520
        },
        {
          "x": 860,
          "y": 1080
        },
        {
          "x": 560,
          "y": 1080
        },
        {
          "x": 1830,
          "y": 320
        },
        {
          "x": 2230,
          "y": 370
        },
        {
          "x": 1830,
          "y": 810
        },
        {
          "x": 2320,
          "y": 1080
        },
        {
          "x": 610,
          "y": 1510
        },
        {
          "x": 1220,
          "y": 1440
        },
        {
          "x": 1860,
          "y": 1430
        },
        {
          "x": 2260,
          "y": 1540
        }
      ],
      "enemy": [
        {
          "x": 150,
          "y": 310
        },
        {
          "x": 470,
          "y": 470
        },
        {
          "x": 720,
          "y": 790
        },
        {
          "x": 1100,
          "y": 390
        },
        {
          "x": 950,
          "y": 820
        },
        {
          "x": 1250,
          "y": 390
        },
        {
          "x": 1430,
          "y": 540
        },
        {
          "x": 1470,
          "y": 900
        },
        {
          "x": 1640,
          "y": 500
        },
        {
          "x": 1110,
          "y": 1080
        },
        {
          "x": 1930,
          "y": 280
        },
        {
          "x": 2210,
          "y": 540
        },
        {
          "x": 1860,
          "y": 980
        },
        {
          "x": 760,
          "y": 1440
        },
        {
          "x": 1660,
          "y": 1420
        },
        {
          "x": 2200,
          "y": 1370
        }
      ]
    },
    "enemyDefinitions": [
      {
        "kind": "rusher",
        "radius": 15,
        "padding": 80
      },
      {
        "kind": "rusher",
        "radius": 15,
        "padding": 80
      },
      {
        "kind": "guard",
        "radius": 17,
        "padding": 90,
        "shield": true
      },
      {
        "kind": "rusher",
        "radius": 15,
        "padding": 80
      },
      {
        "kind": "rusher",
        "radius": 15,
        "padding": 80
      },
      {
        "kind": "guard",
        "radius": 17,
        "padding": 90,
        "shield": true
      },
      {
        "kind": "rusher",
        "radius": 15,
        "padding": 80
      },
      {
        "kind": "rusher",
        "radius": 15,
        "padding": 80
      },
      {
        "kind": "guard",
        "radius": 17,
        "padding": 90,
        "shield": true
      }
    ],
    "fixedEnemies": [],
    "decor": [
      {
        "id": "decor-265",
        "asset": "assets/environment/security_rooftop.png",
        "x": 1085,
        "y": 1266,
        "w": 310,
        "h": 178,
        "rotation": 0,
        "opacity": 1,
        "layer": "roof"
      },
      {
        "id": "decor-262",
        "asset": "assets/environment/security_rooftop.png",
        "x": 2069,
        "y": 475,
        "w": 264,
        "h": 169,
        "rotation": 0,
        "opacity": 1,
        "layer": "roof"
      },
      {
        "id": "decor-264",
        "asset": "assets/environment/security_rooftop.png",
        "x": 629,
        "y": 546,
        "w": 263,
        "h": 171,
        "rotation": 0,
        "opacity": 1,
        "layer": "roof"
      }
    ]
  },
  "admin": {
    "id": "admin",
    "name": "Administrative Complex",
    "duration": 270,
    "requiredLoot": 2,
    "bossRequired": false,
    "objective": "Breach the administrative complex, secure 2 clearance drives, and unlock the north transfer.",
    "extractionPrompt": "Secure the clearance drives and move north to the reactor transfer gate.",
    "objectiveSingular": "clearance drive",
    "objectivePlural": "clearance drives",
    "objectiveShort": "drives",
    "nextLevelId": "reactor",
    "transitionMessage": "Administrative complex cleared. Reactor ring breach underway.",
    "obstacles": [
      {
        "x": 118,
        "y": 170,
        "w": 18,
        "h": 1370,
        "kind": "fence"
      },
      {
        "x": 2464,
        "y": 170,
        "w": 18,
        "h": 1370,
        "kind": "fence"
      },
      {
        "x": 118,
        "y": 170,
        "w": 926,
        "h": 18,
        "kind": "fence"
      },
      {
        "x": 1492,
        "y": 170,
        "w": 990,
        "h": 18,
        "kind": "fence"
      },
      {
        "x": 118,
        "y": 1522,
        "w": 286,
        "h": 18,
        "kind": "fence"
      },
      {
        "x": 616,
        "y": 1522,
        "w": 1328,
        "h": 18,
        "kind": "fence"
      },
      {
        "x": 2176,
        "y": 1522,
        "w": 306,
        "h": 18,
        "kind": "fence"
      },
      {
        "x": 402,
        "y": 1444,
        "w": 24,
        "h": 96,
        "kind": "fence-post"
      },
      {
        "x": 590,
        "y": 1444,
        "w": 24,
        "h": 96,
        "kind": "fence-post"
      },
      {
        "x": 1942,
        "y": 1444,
        "w": 24,
        "h": 96,
        "kind": "fence-post"
      },
      {
        "x": 2152,
        "y": 1444,
        "w": 24,
        "h": 96,
        "kind": "fence-post"
      },
      {
        "x": 444,
        "y": 1414,
        "w": 128,
        "h": 44,
        "kind": "checkpoint-barrier"
      },
      {
        "x": 1982,
        "y": 1414,
        "w": 156,
        "h": 44,
        "kind": "checkpoint-barrier",
        "drawOffsetX": 0,
        "drawOffsetY": 0,
        "drawW": 156,
        "drawH": 44
      },
      {
        "x": 318,
        "y": 1410,
        "w": 56,
        "h": 56,
        "kind": "turret"
      },
      {
        "x": 642,
        "y": 1410,
        "w": 56,
        "h": 56,
        "kind": "turret",
        "drawOffsetX": 0,
        "drawOffsetY": 0,
        "drawW": 56,
        "drawH": 56
      },
      {
        "x": 1862,
        "y": 1410,
        "w": 56,
        "h": 56,
        "kind": "turret"
      },
      {
        "x": 2238,
        "y": 1410,
        "w": 56,
        "h": 56,
        "kind": "turret"
      },
      {
        "x": 160,
        "y": 180,
        "w": 310,
        "h": 140
      },
      {
        "x": 520,
        "y": 190,
        "w": 220,
        "h": 110
      },
      {
        "x": 840,
        "y": 160,
        "w": 130,
        "h": 300
      },
      {
        "x": 1680,
        "y": 170,
        "w": 130,
        "h": 290
      },
      {
        "x": 1940,
        "y": 170,
        "w": 300,
        "h": 130
      },
      {
        "x": 180,
        "y": 780,
        "w": 260,
        "h": 120
      },
      {
        "x": 480,
        "y": 690,
        "w": 170,
        "h": 260
      },
      {
        "x": 930,
        "y": 760,
        "w": 180,
        "h": 110
      },
      {
        "x": 1510,
        "y": 760,
        "w": 180,
        "h": 110
      },
      {
        "x": 1970,
        "y": 720,
        "w": 230,
        "h": 150
      },
      {
        "x": 650,
        "y": 1480,
        "w": 240,
        "h": 100
      },
      {
        "x": 1120,
        "y": 1470,
        "w": 170,
        "h": 110
      },
      {
        "x": 1490,
        "y": 1460,
        "w": 180,
        "h": 110
      },
      {
        "id": "admin-crate-1",
        "x": 252,
        "y": 948,
        "w": 56,
        "h": 56,
        "kind": "crate",
        "hp": 18,
        "maxHp": 18,
        "damageStage": 0,
        "broken": false,
        "lootType": "cash",
        "lootValue": 150,
        "lootSpawned": false
      },
      {
        "id": "admin-crate-2",
        "x": 1268,
        "y": 920,
        "w": 56,
        "h": 56,
        "kind": "crate",
        "hp": 18,
        "maxHp": 18,
        "damageStage": 0,
        "broken": false,
        "lootType": "medkit",
        "lootValue": 1,
        "lootSpawned": false
      },
      {
        "id": "admin-crate-3",
        "x": 1706,
        "y": 910,
        "w": 56,
        "h": 56,
        "kind": "crate",
        "hp": 18,
        "maxHp": 18,
        "damageStage": 0,
        "broken": false,
        "lootType": "noise",
        "lootValue": 1,
        "lootSpawned": false
      },
      {
        "id": "admin-crate-4",
        "x": 2280,
        "y": 920,
        "w": 56,
        "h": 56,
        "kind": "crate",
        "hp": 18,
        "maxHp": 18,
        "damageStage": 0,
        "broken": false,
        "lootType": "shield",
        "lootValue": 42,
        "lootSpawned": false
      }
    ],
    "buildings": [
      {
        "id": "admin-records",
        "label": "records hall",
        "x": 320,
        "y": 360,
        "w": 470,
        "h": 300,
        "door": {
          "id": "admin-records-door",
          "side": "south",
          "x": 514,
          "y": 648,
          "w": 74,
          "h": 12,
          "kind": "door",
          "open": false
        },
        "windows": [
          {
            "id": "admin-records-north-left",
            "side": "north",
            "x": 382,
            "y": 360,
            "w": 60,
            "h": 12,
            "kind": "window",
            "broken": false
          },
          {
            "id": "admin-records-north-right",
            "side": "north",
            "x": 664,
            "y": 360,
            "w": 60,
            "h": 12,
            "kind": "window",
            "broken": false
          },
          {
            "id": "admin-records-west-slit",
            "side": "west",
            "x": 320,
            "y": 456,
            "w": 12,
            "h": 58,
            "kind": "window",
            "broken": false
          }
        ],
        "squadSpawns": [
          {
            "x": 430,
            "y": 454,
            "kind": "guard",
            "tactic": "anchor",
            "shield": true,
            "squadRole": "shieldLead"
          },
          {
            "x": 560,
            "y": 452,
            "kind": "rusher",
            "tactic": "flankLeft",
            "squadRole": "flankLeft"
          },
          {
            "x": 678,
            "y": 546,
            "kind": "rusher",
            "tactic": "breacher",
            "squadRole": "breacher"
          }
        ]
      },
      {
        "id": "admin-tower",
        "label": "administration tower",
        "x": 1010,
        "y": 260,
        "w": 580,
        "h": 390,
        "door": {
          "id": "admin-tower-door",
          "side": "south",
          "x": 1262,
          "y": 638,
          "w": 82,
          "h": 12,
          "kind": "door",
          "open": false
        },
        "windows": [
          {
            "id": "admin-tower-north-left",
            "side": "north",
            "x": 1100,
            "y": 260,
            "w": 62,
            "h": 12,
            "kind": "window",
            "broken": false
          },
          {
            "id": "admin-tower-north-right",
            "side": "north",
            "x": 1436,
            "y": 260,
            "w": 62,
            "h": 12,
            "kind": "window",
            "broken": false
          },
          {
            "id": "admin-tower-west-slit",
            "side": "west",
            "x": 1010,
            "y": 378,
            "w": 12,
            "h": 60,
            "kind": "window",
            "broken": false
          },
          {
            "id": "admin-tower-east-slit",
            "side": "east",
            "x": 1578,
            "y": 378,
            "w": 12,
            "h": 60,
            "kind": "window",
            "broken": false
          }
        ],
        "squadSpawns": [
          {
            "x": 1140,
            "y": 380,
            "kind": "guard",
            "tactic": "anchor",
            "shield": true,
            "squadRole": "shieldLead"
          },
          {
            "x": 1260,
            "y": 430,
            "kind": "guard",
            "tactic": "anchor",
            "squadRole": "anchor"
          },
          {
            "x": 1420,
            "y": 412,
            "kind": "rusher",
            "tactic": "flankRight",
            "squadRole": "flankRight"
          },
          {
            "x": 1490,
            "y": 540,
            "kind": "rusher",
            "tactic": "assault",
            "squadRole": "breacher"
          }
        ]
      },
      {
        "id": "admin-security",
        "label": "security annex",
        "x": 1810,
        "y": 350,
        "w": 430,
        "h": 310,
        "door": {
          "id": "admin-security-door",
          "side": "west",
          "x": 1810,
          "y": 460,
          "w": 12,
          "h": 76,
          "kind": "door",
          "open": false
        },
        "windows": [
          {
            "id": "admin-security-north-left",
            "side": "north",
            "x": 1884,
            "y": 350,
            "w": 56,
            "h": 12,
            "kind": "window",
            "broken": false
          },
          {
            "id": "admin-security-north-right",
            "side": "north",
            "x": 2096,
            "y": 350,
            "w": 56,
            "h": 12,
            "kind": "window",
            "broken": false
          },
          {
            "id": "admin-security-east-slit",
            "side": "east",
            "x": 2228,
            "y": 442,
            "w": 12,
            "h": 56,
            "kind": "window",
            "broken": false
          }
        ],
        "squadSpawns": [
          {
            "x": 1920,
            "y": 458,
            "kind": "guard",
            "tactic": "anchor",
            "shield": true,
            "squadRole": "shieldLead"
          },
          {
            "x": 2040,
            "y": 480,
            "kind": "guard",
            "tactic": "anchor",
            "squadRole": "anchor"
          },
          {
            "x": 2160,
            "y": 540,
            "kind": "rusher",
            "tactic": "flankRight",
            "squadRole": "flankRight"
          }
        ]
      },
      {
        "id": "admin-archive",
        "label": "archive wing",
        "x": 700,
        "y": 1060,
        "w": 540,
        "h": 310,
        "door": {
          "id": "admin-archive-door",
          "side": "north",
          "x": 928,
          "y": 1060,
          "w": 80,
          "h": 12,
          "kind": "door",
          "open": false
        },
        "windows": [
          {
            "id": "admin-archive-south-left",
            "side": "south",
            "x": 782,
            "y": 1358,
            "w": 58,
            "h": 12,
            "kind": "window",
            "broken": false
          },
          {
            "id": "admin-archive-south-right",
            "side": "south",
            "x": 1092,
            "y": 1358,
            "w": 58,
            "h": 12,
            "kind": "window",
            "broken": false
          },
          {
            "id": "admin-archive-east-slit",
            "side": "east",
            "x": 1228,
            "y": 1168,
            "w": 12,
            "h": 58,
            "kind": "window",
            "broken": false
          }
        ],
        "squadSpawns": [
          {
            "x": 830,
            "y": 1168,
            "kind": "guard",
            "tactic": "anchor",
            "shield": true,
            "squadRole": "shieldLead"
          },
          {
            "x": 980,
            "y": 1220,
            "kind": "rusher",
            "tactic": "flankLeft",
            "squadRole": "flankLeft"
          },
          {
            "x": 1110,
            "y": 1246,
            "kind": "guard",
            "tactic": "anchor",
            "squadRole": "anchor"
          }
        ]
      },
      {
        "id": "admin-registry",
        "label": "registry wing",
        "x": 1520,
        "y": 1060,
        "w": 560,
        "h": 310,
        "door": {
          "id": "admin-registry-door",
          "side": "north",
          "x": 1760,
          "y": 1060,
          "w": 82,
          "h": 12,
          "kind": "door",
          "open": false
        },
        "windows": [
          {
            "id": "admin-registry-south-left",
            "side": "south",
            "x": 1606,
            "y": 1358,
            "w": 58,
            "h": 12,
            "kind": "window",
            "broken": false
          },
          {
            "id": "admin-registry-south-right",
            "side": "south",
            "x": 1930,
            "y": 1358,
            "w": 58,
            "h": 12,
            "kind": "window",
            "broken": false
          },
          {
            "id": "admin-registry-west-slit",
            "side": "west",
            "x": 1520,
            "y": 1164,
            "w": 12,
            "h": 58,
            "kind": "window",
            "broken": false
          }
        ],
        "squadSpawns": [
          {
            "x": 1660,
            "y": 1170,
            "kind": "guard",
            "tactic": "anchor",
            "shield": true,
            "squadRole": "shieldLead"
          },
          {
            "x": 1810,
            "y": 1232,
            "kind": "guard",
            "tactic": "anchor",
            "squadRole": "anchor"
          },
          {
            "x": 1940,
            "y": 1194,
            "kind": "rusher",
            "tactic": "assault",
            "squadRole": "breacher"
          }
        ]
      }
    ],
    "lightSources": [],
    "extractionZone": {
      "x": 1110,
      "y": 48,
      "w": 320,
      "h": 120
    },
    "spawnPools": {
      "player": [
        {
          "x": 240,
          "y": 1620
        },
        {
          "x": 540,
          "y": 1600
        },
        {
          "x": 1990,
          "y": 1600
        },
        {
          "x": 2290,
          "y": 1580
        }
      ],
      "core": [
        {
          "x": 430,
          "y": 472
        },
        {
          "x": 688,
          "y": 584
        },
        {
          "x": 1938,
          "y": 470
        },
        {
          "x": 2152,
          "y": 556
        },
        {
          "x": 844,
          "y": 1220
        },
        {
          "x": 1920,
          "y": 1210
        }
      ],
      "shield": [
        {
          "x": 920,
          "y": 930
        },
        {
          "x": 1680,
          "y": 930
        },
        {
          "x": 2240,
          "y": 540
        }
      ],
      "medkit": [
        {
          "x": 590,
          "y": 760
        },
        {
          "x": 1310,
          "y": 790
        },
        {
          "x": 1020,
          "y": 1450
        },
        {
          "x": 1810,
          "y": 1450
        }
      ],
      "noise": [
        {
          "x": 780,
          "y": 730
        },
        {
          "x": 1510,
          "y": 720
        },
        {
          "x": 2240,
          "y": 1240
        }
      ],
      "cash": [
        {
          "x": 250,
          "y": 580
        },
        {
          "x": 860,
          "y": 520
        },
        {
          "x": 940,
          "y": 980
        },
        {
          "x": 1370,
          "y": 860
        },
        {
          "x": 1670,
          "y": 990
        },
        {
          "x": 2330,
          "y": 910
        },
        {
          "x": 610,
          "y": 1460
        },
        {
          "x": 1380,
          "y": 1490
        },
        {
          "x": 2110,
          "y": 1460
        }
      ],
      "enemy": [
        {
          "x": 220,
          "y": 420
        },
        {
          "x": 840,
          "y": 430
        },
        {
          "x": 930,
          "y": 900
        },
        {
          "x": 1320,
          "y": 720
        },
        {
          "x": 1650,
          "y": 870
        },
        {
          "x": 2280,
          "y": 460
        },
        {
          "x": 620,
          "y": 1180
        },
        {
          "x": 1420,
          "y": 1160
        },
        {
          "x": 2240,
          "y": 1210
        }
      ]
    },
    "enemyDefinitions": [
      {
        "kind": "guard",
        "radius": 17,
        "padding": 92,
        "shield": true
      },
      {
        "kind": "guard",
        "radius": 17,
        "padding": 88
      },
      {
        "kind": "rusher",
        "radius": 15,
        "padding": 76
      },
      {
        "kind": "guard",
        "radius": 17,
        "padding": 90,
        "shield": true
      },
      {
        "kind": "rusher",
        "radius": 15,
        "padding": 76
      },
      {
        "kind": "guard",
        "radius": 17,
        "padding": 88
      }
    ],
    "fixedEnemies": [
      {
        "id": "admin-west-checkpoint-lead",
        "x": 462,
        "y": 1368,
        "kind": "guard",
        "tactic": "anchor",
        "squadRole": "shieldLead",
        "shield": true
      },
      {
        "id": "admin-west-checkpoint-wing",
        "x": 552,
        "y": 1366,
        "kind": "rusher",
        "tactic": "flankRight",
        "squadRole": "flankRight"
      },
      {
        "id": "admin-east-checkpoint-lead",
        "x": 2030,
        "y": 1368,
        "kind": "guard",
        "tactic": "anchor",
        "squadRole": "shieldLead",
        "shield": true
      },
      {
        "id": "admin-east-checkpoint-wing",
        "x": 2118,
        "y": 1364,
        "kind": "rusher",
        "tactic": "flankLeft",
        "squadRole": "flankLeft"
      },
      {
        "id": "admin-roaming-specimen",
        "x": 1450,
        "y": 934,
        "kind": "specimen",
        "tactic": "assault",
        "squadRole": "specimen",
        "state": "hunt"
      },
      {
        "id": "admin-contained-specimen-1",
        "x": 2264,
        "y": 1376,
        "kind": "specimen",
        "tactic": "assault",
        "squadRole": "specimen",
        "state": "contained",
        "contained": true,
        "hidden": true,
        "zoneId": "east-checkpoint-pen",
        "releaseHeat": 2
      },
      {
        "id": "admin-contained-specimen-2",
        "x": 1284,
        "y": 776,
        "kind": "specimen",
        "tactic": "assault",
        "squadRole": "specimen",
        "state": "contained",
        "contained": true,
        "hidden": true,
        "zoneId": "tower-sublab",
        "releaseHeat": 3
      },
      {
        "id": "admin-contained-specimen-3",
        "x": 2166,
        "y": 822,
        "kind": "specimen",
        "tactic": "assault",
        "squadRole": "specimen",
        "state": "contained",
        "contained": true,
        "hidden": true,
        "zoneId": "security-holding",
        "releaseHeat": 4
      }
    ],
    "specimenZones": [
      {
        "id": "east-checkpoint-pen",
        "label": "checkpoint quarantine pen",
        "x": 2198,
        "y": 1302,
        "w": 132,
        "h": 144,
        "specimenX": 2264,
        "specimenY": 1376,
        "angle": 3.141592653589793,
        "releaseHeat": 2
      },
      {
        "id": "tower-sublab",
        "label": "sublevel specimen lab",
        "x": 1210,
        "y": 712,
        "w": 152,
        "h": 126,
        "specimenX": 1284,
        "specimenY": 776,
        "angle": 0.3141592653589793,
        "releaseHeat": 3
      },
      {
        "id": "security-holding",
        "label": "security holding wing",
        "x": 2108,
        "y": 742,
        "w": 116,
        "h": 156,
        "specimenX": 2166,
        "specimenY": 822,
        "angle": 1.5707963267948966,
        "releaseHeat": 4
      }
    ]
  },
  "reactor": {
    "id": "reactor",
    "name": "Reactor Ring",
    "duration": 240,
    "requiredLoot": 0,
    "bossRequired": true,
    "objective": "Drop the central Warden and exfil north.",
    "extractionPrompt": "Neutralize the Warden, then exfil through the north lift.",
    "objectiveSingular": "reactor target",
    "objectivePlural": "reactor targets",
    "objectiveShort": "targets",
    "nextLevelId": null,
    "transitionMessage": "",
    "obstacles": [
      {
        "x": 240,
        "y": 250,
        "w": 260,
        "h": 120
      },
      {
        "x": 620,
        "y": 160,
        "w": 150,
        "h": 240
      },
      {
        "x": 1010,
        "y": 180,
        "w": 190,
        "h": 120
      },
      {
        "x": 1380,
        "y": 170,
        "w": 170,
        "h": 220
      },
      {
        "x": 1770,
        "y": 220,
        "w": 250,
        "h": 130
      },
      {
        "x": 2120,
        "y": 180,
        "w": 220,
        "h": 170
      },
      {
        "x": 240,
        "y": 760,
        "w": 260,
        "h": 150
      },
      {
        "x": 560,
        "y": 980,
        "w": 180,
        "h": 220
      },
      {
        "x": 820,
        "y": 580,
        "w": 210,
        "h": 120
      },
      {
        "x": 1020,
        "y": 620,
        "w": 120,
        "h": 90
      },
      {
        "x": 1440,
        "y": 620,
        "w": 120,
        "h": 90
      },
      {
        "x": 980,
        "y": 1040,
        "w": 130,
        "h": 90
      },
      {
        "x": 1460,
        "y": 1040,
        "w": 130,
        "h": 90
      },
      {
        "x": 1700,
        "y": 560,
        "w": 230,
        "h": 150
      },
      {
        "x": 2030,
        "y": 760,
        "w": 240,
        "h": 160
      },
      {
        "x": 250,
        "y": 1320,
        "w": 300,
        "h": 180
      },
      {
        "x": 760,
        "y": 1360,
        "w": 230,
        "h": 150
      },
      {
        "x": 1100,
        "y": 1320,
        "w": 360,
        "h": 170
      },
      {
        "x": 1660,
        "y": 1300,
        "w": 260,
        "h": 170
      },
      {
        "x": 2060,
        "y": 1260,
        "w": 300,
        "h": 190
      },
      {
        "id": "reactor-crate-1",
        "x": 710,
        "y": 460,
        "w": 56,
        "h": 56,
        "kind": "crate",
        "hp": 18,
        "maxHp": 18,
        "damageStage": 0,
        "broken": false,
        "lootType": "cash",
        "lootValue": 140,
        "lootSpawned": false
      },
      {
        "id": "reactor-crate-2",
        "x": 1750,
        "y": 1010,
        "w": 56,
        "h": 56,
        "kind": "crate",
        "hp": 18,
        "maxHp": 18,
        "damageStage": 0,
        "broken": false,
        "lootType": "medkit",
        "lootValue": 1,
        "lootSpawned": false
      },
      {
        "id": "reactor-crate-3",
        "x": 920,
        "y": 1180,
        "w": 56,
        "h": 56,
        "kind": "crate",
        "hp": 18,
        "maxHp": 18,
        "damageStage": 0,
        "broken": false,
        "lootType": "noise",
        "lootValue": 1,
        "lootSpawned": false
      }
    ],
    "buildings": [
      {
        "id": "reactor-west",
        "label": "west relay chamber",
        "x": 420,
        "y": 470,
        "w": 260,
        "h": 180,
        "door": {
          "id": "reactor-west-door",
          "side": "east",
          "x": 668,
          "y": 530,
          "w": 12,
          "h": 60,
          "kind": "door",
          "open": false
        },
        "windows": [
          {
            "id": "reactor-west-north-slit",
            "side": "north",
            "x": 462,
            "y": 470,
            "w": 48,
            "h": 12,
            "kind": "window",
            "broken": false
          },
          {
            "id": "reactor-west-south-slit",
            "side": "south",
            "x": 574,
            "y": 638,
            "w": 48,
            "h": 12,
            "kind": "window",
            "broken": false
          }
        ],
        "squadSpawns": [
          {
            "x": 500,
            "y": 548,
            "kind": "rusher",
            "tactic": "assault",
            "squadRole": "breacher"
          },
          {
            "x": 590,
            "y": 556,
            "kind": "guard",
            "tactic": "anchor",
            "shield": true,
            "squadRole": "shieldLead"
          }
        ]
      },
      {
        "id": "reactor-east",
        "label": "east relay chamber",
        "x": 1880,
        "y": 1030,
        "w": 250,
        "h": 180,
        "door": {
          "id": "reactor-east-door",
          "side": "west",
          "x": 1880,
          "y": 1088,
          "w": 12,
          "h": 60,
          "kind": "door",
          "open": false
        },
        "windows": [
          {
            "id": "reactor-east-north-slit",
            "side": "north",
            "x": 1928,
            "y": 1030,
            "w": 46,
            "h": 12,
            "kind": "window",
            "broken": false
          },
          {
            "id": "reactor-east-east-slit",
            "side": "east",
            "x": 2118,
            "y": 1122,
            "w": 12,
            "h": 44,
            "kind": "window",
            "broken": false
          }
        ],
        "squadSpawns": [
          {
            "x": 1960,
            "y": 1114,
            "kind": "rusher",
            "tactic": "flankLeft",
            "squadRole": "flankLeft"
          },
          {
            "x": 2050,
            "y": 1102,
            "kind": "guard",
            "tactic": "anchor",
            "shield": true,
            "squadRole": "shieldLead"
          }
        ]
      },
      {
        "id": "reactor-core",
        "label": "reactor vault",
        "x": 1120,
        "y": 730,
        "w": 360,
        "h": 280,
        "door": {
          "id": "reactor-core-door",
          "side": "south",
          "x": 1266,
          "y": 998,
          "w": 68,
          "h": 12,
          "kind": "door",
          "open": false
        },
        "windows": [
          {
            "id": "reactor-core-north-left",
            "side": "north",
            "x": 1184,
            "y": 730,
            "w": 54,
            "h": 12,
            "kind": "window",
            "broken": false
          },
          {
            "id": "reactor-core-north-right",
            "side": "north",
            "x": 1360,
            "y": 730,
            "w": 54,
            "h": 12,
            "kind": "window",
            "broken": false
          },
          {
            "id": "reactor-core-east-slit",
            "side": "east",
            "x": 1468,
            "y": 830,
            "w": 12,
            "h": 52,
            "kind": "window",
            "broken": false
          }
        ],
        "squadSpawns": []
      }
    ],
    "lightSources": [],
    "extractionZone": {
      "x": 1130,
      "y": 60,
      "w": 260,
      "h": 120
    },
    "spawnPools": {
      "player": [
        {
          "x": 240,
          "y": 1620
        },
        {
          "x": 420,
          "y": 1590
        },
        {
          "x": 2230,
          "y": 1600
        },
        {
          "x": 2050,
          "y": 1560
        }
      ],
      "core": [],
      "shield": [
        {
          "x": 640,
          "y": 1240
        },
        {
          "x": 1870,
          "y": 870
        }
      ],
      "medkit": [
        {
          "x": 560,
          "y": 570
        },
        {
          "x": 1980,
          "y": 1110
        },
        {
          "x": 1280,
          "y": 1220
        }
      ],
      "noise": [
        {
          "x": 760,
          "y": 1240
        },
        {
          "x": 1760,
          "y": 900
        }
      ],
      "cash": [
        {
          "x": 920,
          "y": 430
        },
        {
          "x": 1630,
          "y": 430
        },
        {
          "x": 900,
          "y": 1260
        },
        {
          "x": 1670,
          "y": 1180
        }
      ],
      "enemy": [
        {
          "x": 780,
          "y": 380
        },
        {
          "x": 1680,
          "y": 360
        },
        {
          "x": 600,
          "y": 980
        },
        {
          "x": 1930,
          "y": 840
        }
      ]
    },
    "enemyDefinitions": [
      {
        "kind": "guard",
        "radius": 17,
        "padding": 90,
        "shield": true
      },
      {
        "kind": "rusher",
        "radius": 15,
        "padding": 70
      },
      {
        "kind": "rusher",
        "radius": 15,
        "padding": 70
      },
      {
        "kind": "guard",
        "radius": 17,
        "padding": 90,
        "shield": true
      }
    ],
    "fixedEnemies": [
      {
        "id": "warden-core",
        "x": 1295,
        "y": 860,
        "kind": "boss",
        "tactic": "anchor",
        "squadRole": "boss",
        "shield": true
      },
      {
        "id": "warden-left",
        "x": 1110,
        "y": 1030,
        "kind": "guard",
        "tactic": "anchor",
        "squadRole": "shieldLead",
        "shield": true
      },
      {
        "id": "warden-right",
        "x": 1480,
        "y": 1020,
        "kind": "rusher",
        "tactic": "flankRight",
        "squadRole": "flankRight"
      }
    ]
  }
};
let activeLayoutId = "freight";
let activeSpecimenZones = [];
let activeDecor = [];
let activeLightSources = [];

function normalizeRuntimeObstacleState(obstacle) {
  if (!obstacle) {
    return obstacle;
  }

  if (obstacle.kind === "crate") {
    const maxHp = Number.isFinite(obstacle.maxHp) && obstacle.maxHp > 0 ? obstacle.maxHp : 18;
    const hp = Number.isFinite(obstacle.hp) ? obstacle.hp : maxHp;
    const normalizedCrate = {
      ...obstacle,
      hp: clamp(hp, 0, maxHp),
      maxHp,
      broken: Boolean(obstacle.broken),
      lootType: obstacle.lootType || "cash",
      lootValue: Number.isFinite(obstacle.lootValue) ? obstacle.lootValue : 90,
      lootSpawned: Boolean(obstacle.lootSpawned),
    };
    normalizedCrate.damageStage =
      typeof obstacle.damageStage === "number" ? obstacle.damageStage : getCrateDamageStage(normalizedCrate);
    return normalizedCrate;
  }

  return obstacle;
}

function applyLayoutTemplate(layoutId) {
  const template = LEVEL_TEMPLATES[layoutId] || LEVEL_TEMPLATES.freight;
  activeLayoutId = template.id;

  obstacles.splice(0, obstacles.length, ...template.obstacles.map((obstacle) => normalizeRuntimeObstacleState({ ...obstacle })));
  activeSpecimenZones = cloneMarkerEntries(template.specimenZones || []);
  activeDecor = cloneMarkerEntries(template.decor || []);
  activeLightSources = cloneMarkerEntries(template.lightSources || []);
  if (template.id === "freight") {
    for (let index = 0; index < obstacles.length; index += 1) {
      if (isContainerObstacle(obstacles[index])) {
        obstacles[index] = normalizeFreightContainerObstacle(obstacles[index]);
      }
    }
  }
  buildings.splice(0, buildings.length, ...template.buildings.map(cloneBuilding));
  Object.assign(extractionZone, template.extractionZone);

  for (const key of Object.keys(spawnPools)) {
    spawnPools[key] = (template.spawnPools[key] || []).map((entry) => ({ ...entry }));
  }
}

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
  return [...obstacles.filter((obstacle) => !(obstacle.kind === "crate" && obstacle.broken)), ...getBuildingSegments()];
}

function getSightBlockingObstacles() {
  return getWorldObstacles().filter((obstacle) => obstacle.kind !== "window");
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

function findCrateById(crateId) {
  return obstacles.find((obstacle) => obstacle.kind === "crate" && obstacle.id === crateId) || null;
}

function circleIntersectsRect(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy < circle.r * circle.r;
}

function lineBlocked(fromX, fromY, toX, toY) {
  return getSightBlockingObstacles().some((obstacle) => segmentIntersectsRect(fromX, fromY, toX, toY, obstacle));
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

function loadAudioSettings() {
  try {
    const raw = window.localStorage.getItem("ddd-audio");
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    if (typeof parsed.music === "number") {
      audioSettings.music = clamp(parsed.music, 0, 1);
    }
    if (typeof parsed.sfx === "number") {
      audioSettings.sfx = clamp(parsed.sfx, 0, 1.4);
    }
  } catch {}
}

function saveAudioSettings() {
  try {
    window.localStorage.setItem("ddd-audio", JSON.stringify(audioSettings));
  } catch {}
}

function loadVisualMode() {
  try {
    const raw = window.localStorage.getItem(VISUAL_MODE_STORAGE_KEY);
    if (raw && VISUAL_MODES[raw]) {
      activeVisualMode = raw;
    }
  } catch {}
}

function saveVisualMode() {
  try {
    window.localStorage.setItem(VISUAL_MODE_STORAGE_KEY, activeVisualMode);
  } catch {}
}

function syncVisualModeUi() {
  if (visualModeSelect) {
    visualModeSelect.value = activeVisualMode;
  }
  if (visualModeInline) {
    visualModeInline.value = activeVisualMode;
  }
}

function applyVisualMode(mode = activeVisualMode) {
  activeVisualMode = VISUAL_MODES[mode] ? mode : "clean";
  document.body.dataset.visualMode = activeVisualMode;
  if (visualOverlay) {
    visualOverlay.dataset.visualMode = activeVisualMode;
  }
  canvas.style.imageRendering = activeVisualMode === "pixel" ? "pixelated" : "auto";
  syncVisualModeUi();
}

function setVisualMode(mode) {
  applyVisualMode(mode);
  saveVisualMode();
}

function applyAudioSettings() {
  if (masterGain) {
    masterGain.gain.value = 0.24 * audioSettings.sfx;
  }

  if (introTrack) {
    introTrack.volume = TRACK_BASE_VOLUMES.intro * audioSettings.music;
  }
  if (firstLevelTrack) {
    firstLevelTrack.volume = TRACK_BASE_VOLUMES.freight * audioSettings.music;
  }
  if (freightStealthTrack) {
    freightStealthTrack.volume = TRACK_BASE_VOLUMES.freightStealth * audioSettings.music;
  }
  if (shadowStealthTrack) {
    shadowStealthTrack.volume = TRACK_BASE_VOLUMES.shadowStealth * audioSettings.music;
  }
  if (bossTrack) {
    bossTrack.volume = TRACK_BASE_VOLUMES.boss * audioSettings.music;
  }
  if (altBossTrack) {
    altBossTrack.volume = TRACK_BASE_VOLUMES.bossAlt * audioSettings.music;
  }

  if (musicSlider) {
    musicSlider.value = `${Math.round(audioSettings.music * 100)}`;
  }
  if (sfxSlider) {
    sfxSlider.value = `${Math.round((audioSettings.sfx / 1.4) * 100)}`;
  }
  if (musicSliderValue) {
    musicSliderValue.textContent = `${Math.round(audioSettings.music * 100)}`;
  }
  if (sfxSliderValue) {
    sfxSliderValue.textContent = `${Math.round((audioSettings.sfx / 1.4) * 100)}`;
  }
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
  masterGain.gain.value = 0.24 * audioSettings.sfx;
  masterGain.connect(audioContext.destination);
  return audioContext;
}

function ensureMusicTracks() {
  if (introTrack && firstLevelTrack && freightStealthTrack && shadowStealthTrack && bossTrack && altBossTrack) {
    return;
  }

  introTrack = new Audio(OST_TRACKS.intro);
  firstLevelTrack = new Audio(OST_TRACKS.freight);
  freightStealthTrack = new Audio(OST_TRACKS.freightStealth);
  shadowStealthTrack = new Audio(OST_TRACKS.shadowStealth);
  bossTrack = new Audio(OST_TRACKS.boss);
  altBossTrack = new Audio(OST_TRACKS.bossAlt);

  for (const track of [introTrack, firstLevelTrack, freightStealthTrack, shadowStealthTrack, bossTrack, altBossTrack]) {
    track.loop = true;
    track.preload = "auto";
    track.playsInline = true;
    track.volume = 0;
    track.addEventListener("loadeddata", () => {
      if (!musicUnlocked || queuedMusicTrack !== track) {
        return;
      }
      const playPromise = track.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    });
    track.load();
  }

  applyAudioSettings();
}

function getMusicTracks() {
  return [introTrack, firstLevelTrack, freightStealthTrack, shadowStealthTrack, bossTrack, altBossTrack].filter(Boolean);
}

function stopTrack(track, reset = true) {
  if (!track) {
    return;
  }

  track.pause();
  if (reset) {
    track.currentTime = 0;
  }
}

function stopMusicTracks(except = null) {
  ensureMusicTracks();

  for (const track of getMusicTracks()) {
    if (track === except) {
      continue;
    }
    stopTrack(track);
  }
}

function getMusicTrackByMode(mode) {
  switch (mode) {
    case "intro":
      return introTrack;
    case "freight":
      return firstLevelTrack;
    case "freight-stealth":
      return freightStealthTrack;
    case "shadow-stealth":
      return shadowStealthTrack;
    case "boss":
      return bossTrack;
    case "boss-alt":
      return altBossTrack;
    default:
      return null;
  }
}

function playMusicMode(mode) {
  const track = getMusicTrackByMode(mode);
  if (!track) {
    return false;
  }

  playMusicTrack(track);
  return true;
}

function playMusicTrack(track) {
  ensureMusicTracks();
  if (!track) {
    return;
  }

  if (!track.paused && !track.ended) {
    stopMusicTracks(track);
    return;
  }

  stopMusicTracks(track);
  queuedMusicTrack = track;
  if (track.readyState < 2) {
    track.load();
  }
  const playPromise = track.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }
}

function getLocationCalmMusicMode(levelId = gameState?.levelId) {
  if (levelId === "admin" || levelId === "reactor") {
    return "shadow-stealth";
  }
  return "freight-stealth";
}

function getLocationActionMusicMode(levelId = gameState?.levelId) {
  if (levelId === "reactor" && hasLiveBoss()) {
    return "boss";
  }
  return "freight";
}

function getAwarenessHoldDuration(awareness, heat = gameState?.heat || 1) {
  const clampedHeat = Math.max(1, Math.min(4, Math.round(heat)));
  if (awareness === "spotted" || awareness === "lost") {
    return MUSIC_COMBAT_HOLD_BY_HEAT[clampedHeat];
  }
  if (awareness === "suspicious") {
    return MUSIC_SUSPICIOUS_HOLD_BY_HEAT[clampedHeat];
  }
  return 0;
}

function getAutoMusicMode() {
  if (gameState?.ended) {
    return lastAutoMusicMode;
  }

  if (gameState?.running) {
    const awareness = gameState.awareness;
    const alertHoldActive =
      (gameState.musicAlertTimer || 0) > 0 || awareness === "spotted" || awareness === "suspicious" || awareness === "lost";
    const calmMode = getLocationCalmMusicMode(gameState.levelId);
    const actionMode = getLocationActionMusicMode(gameState.levelId);

    if (gameState.levelId === "reactor") {
      if (hasLiveBoss() && alertHoldActive) {
        lastAutoMusicMode = "boss";
        return "boss";
      }
      lastAutoMusicMode = alertHoldActive ? actionMode : calmMode;
      return lastAutoMusicMode;
    }

    lastAutoMusicMode = alertHoldActive ? actionMode : calmMode;
    return lastAutoMusicMode;
  }

  return "intro";
}

function getResolvedMusicMode() {
  if (preferredMusicMode === "auto" || preferredMusicMode === "game") {
    return getAutoMusicMode();
  }

  if (
    preferredMusicMode === "intro" ||
    preferredMusicMode === "freight" ||
    preferredMusicMode === "freight-stealth" ||
    preferredMusicMode === "shadow-stealth" ||
    preferredMusicMode === "boss" ||
    preferredMusicMode === "boss-alt"
  ) {
    return preferredMusicMode;
  }

  return "mute";
}

function syncMusicDeckUi() {
  const resolvedMode = getResolvedMusicMode();

  if (musicDeckMode) {
    musicDeckMode.textContent =
      preferredMusicMode === "auto" ? `${MUSIC_MODE_LABELS.auto} / ${MUSIC_MODE_LABELS[resolvedMode]}` : MUSIC_MODE_LABELS[preferredMusicMode];
  }

  for (const button of musicDeckButtons) {
    button.classList.toggle("is-active", button.dataset.musicMode === preferredMusicMode);
  }
}

function syncAdminDeckUi() {
  if (!areAdminControlsEnabled()) {
    if (adminDeckStatus) {
      adminDeckStatus.textContent = "hidden";
    }
    return;
  }

  const player = gameState?.player;
  const invisibleActive = Boolean(player?.adminInvisible);
  const godModeActive = Boolean(player?.adminGodMode);

  for (const button of adminDeckButtons) {
    const action = button.dataset.adminAction || "";
    button.classList.toggle("is-active", (action === "toggleInvisible" && invisibleActive) || (action === "toggleGodMode" && godModeActive));
  }

  if (!adminDeckStatus) {
    return;
  }

  const activeModes = [];
  if (invisibleActive) {
    activeModes.push("invisible");
  }
  if (godModeActive) {
    activeModes.push("godmode");
  }
  adminDeckStatus.textContent = activeModes.length ? activeModes.join(" / ") : "offline";
}

function pushNetworkEvent(message) {
  if (!message) {
    return;
  }
  const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  networkUiState.recentEvents.unshift(`${stamp}  ${message}`);
  networkUiState.recentEvents = networkUiState.recentEvents.slice(0, 18);
}

function setSocketUiState(stateLabel) {
  networkUiState.socketState = stateLabel || "offline";
  if (debugSocketState) {
    debugSocketState.textContent = networkUiState.socketState;
  }
}

function getRestartParticipantCount() {
  if (!gameState) {
    return 1;
  }
  return Math.max(1, gameState.networkPresence || 1);
}

function syncRestartOverlayUi() {
  if (!restartButton || !restartStatusText || !restartPresence || !gameState) {
    return;
  }

  const stateLabel = networkUiState.restartState;
  const readyCount = networkUiState.restartReadyIds.length;
  const participantCount = getRestartParticipantCount();
  const hostLabel = isRaidHost() ? "host" : "host";
  const statusByState = {
    idle: "Press Run It Back to restart the raid.",
    dead: "Press Run It Back to queue a co-op restart.",
    requesting_restart: "Restart request sent. Waiting for acknowledgement...",
    waiting_for_peer: "Restart requested. Waiting for the second player.",
    waiting_for_host: `Ready received. Waiting for ${hostLabel} to commit the restart.`,
    restarting: "Restarting raid...",
    live: "Raid live.",
  };
  restartStatusText.textContent = networkUiState.restartMessage || statusByState[stateLabel] || statusByState.idle;
  restartPresence.textContent = `Ready: ${readyCount} / ${participantCount}`;

  const inFlight = ["requesting_restart", "waiting_for_peer", "waiting_for_host", "restarting"].includes(stateLabel);
  restartButton.disabled = inFlight;
  restartButton.textContent = inFlight ? "Waiting..." : "Run It Back";
}

function setRestartUiState(nextState, options = {}) {
  networkUiState.restartState = nextState;
  if (Array.isArray(options.readyIds)) {
    networkUiState.restartReadyIds = [...options.readyIds];
  }
  if (typeof options.message === "string") {
    networkUiState.restartMessage = options.message;
    if (options.message) {
      pushNetworkEvent(options.message);
    }
  }
  syncRestartOverlayUi();
}

function hasLiveNetworkSession() {
  return networkUiState.socketState === "live" || networkUiState.socketState === "host";
}

function setDebugOverlayVisible(visible) {
  if (!isDevUiEnabled()) {
    debugOverlayVisible = false;
    debugOverlay?.classList.remove("is-visible");
    debugOverlay?.setAttribute("aria-hidden", "true");
    return;
  }

  debugOverlayVisible = Boolean(visible);
  debugOverlay?.classList.toggle("is-visible", debugOverlayVisible);
  debugOverlay?.setAttribute("aria-hidden", debugOverlayVisible ? "false" : "true");
  if (debugOverlayVisible) {
    syncDebugOverlay();
  }
}

function queueNetworkActionFlag(key, value = true) {
  if (!Object.prototype.hasOwnProperty.call(queuedNetworkActions, key)) {
    return;
  }

  queuedNetworkActions[key] = value;
}

function consumeQueuedNetworkActions() {
  const payload = {
    shootPressed: queuedNetworkActions.shootPressed,
    reloadPressed: queuedNetworkActions.reloadPressed,
    interactPressed: queuedNetworkActions.interactPressed,
    medkitPressed: queuedNetworkActions.medkitPressed,
    noisePressed: queuedNetworkActions.noisePressed,
    abilityPressed: queuedNetworkActions.abilityPressed,
    takedownPressed: queuedNetworkActions.takedownPressed,
    adminPressed: queuedNetworkActions.adminPressed,
    adminAction: queuedNetworkActions.adminAction,
    noiseTarget: queuedNetworkActions.noiseTarget ? { ...queuedNetworkActions.noiseTarget } : null,
  };

  queuedNetworkActions.shootPressed = false;
  queuedNetworkActions.reloadPressed = false;
  queuedNetworkActions.interactPressed = false;
  queuedNetworkActions.medkitPressed = false;
  queuedNetworkActions.noisePressed = false;
  queuedNetworkActions.abilityPressed = false;
  queuedNetworkActions.takedownPressed = false;
  queuedNetworkActions.adminPressed = false;
  queuedNetworkActions.adminAction = null;
  queuedNetworkActions.noiseTarget = null;

  return payload;
}

function buildLocalSeedState() {
  if (!gameState?.player) {
    return null;
  }

  const player = gameState.player;
  return {
    hp: player.hp,
    maxHp: player.maxHp,
    ammo: player.ammo,
    magSize: player.magSize,
    reloadTime: player.reloadTime,
    shieldEquipped: player.shieldEquipped,
    shieldHp: player.shieldHp,
    medkits: player.medkits,
    noiseCharges: player.noiseCharges,
    cash: gameState.cash,
    adminInvisible: Boolean(player.adminInvisible),
    adminGodMode: Boolean(player.adminGodMode),
    invisible: player.invisible,
  };
}

function buildDebugFields() {
  const state = gameState;
  const localId = state?.localNetworkId || "n/a";
  const snapshotAge = networkUiState.lastSnapshotAt ? `${Math.max(0, ((performance.now() - networkUiState.lastSnapshotAt) / 1000)).toFixed(2)}s` : "n/a";
  const remotes = state?.remotePlayers?.map((player) => `${player.id?.slice(-4) || "none"}:${player.hp ?? "?"}/${player.ammo ?? "?"}:${player.running === false ? "down" : "live"}`).join(" | ") || "none";
  return [
    ["Role", state?.isRaidHost ? "host" : "client"],
    ["Room", state?.networkPhase || "lobby"],
    ["Socket", networkUiState.socketState],
    ["Local ID", localId],
    ["Raid", state?.running ? "running" : state?.ended ? "ended" : "idle"],
    ["Restart", networkUiState.restartState],
    ["Ready", `${networkUiState.restartReadyIds.length} / ${getRestartParticipantCount()}`],
    ["Presence", `${state?.networkPresence || 1}`],
    ["Snapshot Age", snapshotAge],
    ["HP/Ammo", state ? `${state.player.hp}/${state.player.maxHp} | ${state.player.ammo}/${state.player.magSize}` : "n/a"],
    ["Remotes", remotes],
  ];
}

function syncDebugOverlay() {
  if (!debugOverlayVisible || !debugGrid || !debugEvents) {
    return;
  }

  debugGrid.innerHTML = buildDebugFields()
    .map(
      ([label, value]) => `<div class="debug-field"><span class="label">${label}</span><strong>${String(value)}</strong></div>`
    )
    .join("");

  debugEvents.innerHTML = networkUiState.recentEvents.length
    ? networkUiState.recentEvents.map((entry) => `<div class="debug-event">${entry}</div>`).join("")
    : `<div class="debug-event">No recent network events.</div>`;
}

function requestRaidRestart(options = {}) {
  if (!gameState) {
    return;
  }

  const multiplayer = (gameState.networkPresence || 1) > 1;
  if (!multiplayer || options.localOnly) {
    setRestartUiState("restarting", { readyIds: [gameState.localNetworkId].filter(Boolean), message: "Restarting raid..." });
    resetGame({ preserveMusic: true });
    startGame();
    setRestartUiState("live", { readyIds: [] });
    return;
  }

  if (["requesting_restart", "waiting_for_peer", "waiting_for_host", "restarting"].includes(networkUiState.restartState)) {
    return;
  }

  const localId = gameState.localNetworkId;
  setRestartUiState("requesting_restart", {
    readyIds: localId ? [localId] : [],
    message: "Restart request sent. Waiting for the room.",
  });
  window.__raidRuntime?.publishRestartRequest?.({ force: Boolean(options.force && isRaidHost()) });
}

function applyRestartStatus(status = {}) {
  const readyIds = Array.isArray(status.readyIds) ? status.readyIds : [];
  const localReady = readyIds.includes(gameState?.localNetworkId);
  const participantCount = typeof status.playerCount === "number" ? status.playerCount : getRestartParticipantCount();
  const stateLabel = status.phase === "restarting"
    ? "restarting"
    : localReady
      ? readyIds.length >= participantCount
        ? "waiting_for_host"
        : "waiting_for_peer"
      : "dead";

  setRestartUiState(stateLabel, {
    readyIds,
    message: typeof status.message === "string" ? status.message : "",
  });
}

function applyRestartCommit(commit = {}) {
  setRestartUiState("restarting", {
    readyIds: Array.isArray(commit.readyIds) ? commit.readyIds : [],
    message: "Restarting raid...",
  });
  resetGame({ preserveMusic: true });
  startGame();
}

function applyStatusMessage(event = {}) {
  const payload = event.payload || event;
  if (!gameState || typeof payload.message !== "string" || !payload.message) {
    return;
  }

  gameState.message = payload.message;
  statusText.textContent = payload.message;
  syncHud();
}

function applyRaidTransition(event = {}) {
  const payload = event.payload || event;
  if (!gameState) {
    return;
  }

  if (payload.mode === "breach_shop") {
    openBreachShop(payload.nextLevelId || "reactor");
    return;
  }

  if (payload.mode === "success") {
    endGame(true, payload.message || "Extraction successful.");
    return;
  }

  if (payload.mode === "fail") {
    endGame(false, payload.message || "Raid failed.");
  }
}

function runDebugAction(actionKey) {
  if (!gameState) {
    return;
  }

  if (actionKey === "forceRestart") {
    requestRaidRestart({ force: true });
    return;
  }

  if (actionKey === "killSelf") {
    if (gameState.running) {
      gameState.player.hp = 0;
      endGame(false, `You were dropped carrying ${gameState.lootCollected} ${getObjectiveLabels().plural} and $${gameState.cash}.`);
    }
    return;
  }

  if (actionKey === "reconnect") {
    window.__raidRuntime?.reconnectNetwork?.();
    pushNetworkEvent("Reconnect requested.");
    syncDebugOverlay();
    return;
  }

  if (actionKey === "copy") {
    copyDebugStateToClipboard();
  }
}

function copyDebugStateToClipboard() {
  const snapshot = JSON.stringify(
    {
      socket: networkUiState.socketState,
      restart: networkUiState.restartState,
      readyIds: networkUiState.restartReadyIds,
      localId: gameState?.localNetworkId || null,
      isHost: gameState?.isRaidHost || false,
      running: gameState?.running || false,
      ended: gameState?.ended || false,
      presence: gameState?.networkPresence || 1,
      player: gameState
        ? {
            hp: gameState.player.hp,
            maxHp: gameState.player.maxHp,
            ammo: gameState.player.ammo,
            magSize: gameState.player.magSize,
            x: gameState.player.x,
            y: gameState.player.y,
          }
        : null,
      remotes: gameState?.remotePlayers || [],
      events: networkUiState.recentEvents,
    },
    null,
    2
  );

  navigator.clipboard?.writeText(snapshot).catch(() => {});
  pushNetworkEvent("Copied debug snapshot.");
  syncDebugOverlay();
}

function refreshPlayerInvisibility(player) {
  if (!player) {
    return;
  }
  player.invisible = Boolean(player.adminInvisible || (player.ability === "cloak" && player.abilityTimer > 0));
}

function restoreActorShield(actor) {
  if (!actor || !actor.canUseShield || actor.maxShieldHp <= 0) {
    return false;
  }
  actor.shieldEquipped = true;
  actor.shieldHp = actor.maxShieldHp;
  actor.shieldFlash = 1;
  return true;
}

function getAdminPatchKeysForAction(actionKey) {
  switch (actionKey) {
    case "toggleInvisible":
      return ["adminInvisible", "invisible"];
    case "toggleGodMode":
      return ["adminGodMode", "hp", "maxHp", "shieldEquipped", "shieldHp"];
    case "heal":
      return ["hp", "maxHp"];
    case "refillAmmo":
      return ["ammo", "magSize"];
    case "restoreShield":
      return ["shieldEquipped", "shieldHp"];
    default:
      return [];
  }
}

function applyAdminActionToActor(actor, actionKey) {
  if (!actor) {
    return false;
  }

  switch (actionKey) {
    case "toggleInvisible":
      actor.adminInvisible = !actor.adminInvisible;
      refreshPlayerInvisibility(actor);
      return true;
    case "toggleGodMode":
      actor.adminGodMode = !actor.adminGodMode;
      if (actor.adminGodMode) {
        actor.hp = actor.maxHp;
        restoreActorShield(actor);
      }
      return true;
    case "heal":
      actor.hp = actor.maxHp;
      return true;
    case "refillAmmo":
      actor.ammo = actor.magSize;
      actor.reloadTimer = 0;
      return true;
    case "restoreShield":
      return restoreActorShield(actor);
    default:
      return false;
  }
}

function runAdminAction(actionKey) {
  if (!areAdminControlsEnabled()) {
    return;
  }

  if (!gameState?.player) {
    return;
  }

  const player = gameState.player;
  if (!applyAdminActionToActor(player, actionKey)) {
    if (actionKey === "restoreShield") {
      gameState.message = "This class cannot use shields.";
      statusText.textContent = gameState.message;
      syncHud();
    }
    return;
  }

  const statusMessages = {
    toggleInvisible: player.adminInvisible ? "Admin invisibility enabled." : "Admin invisibility disabled.",
    toggleGodMode: player.adminGodMode ? "Godmode engaged." : "Godmode disabled.",
    heal: "Vitals restored.",
    refillAmmo: "Magazine refilled.",
    restoreShield: player.canUseShield ? "Shield restored." : "This class cannot use shields.",
  };

  if (statusMessages[actionKey]) {
    gameState.message = statusMessages[actionKey];
    statusText.textContent = gameState.message;
  }

  queueNetworkActionFlag("adminPressed");
  queueNetworkActionFlag("adminAction", actionKey);

  if (!isRaidHost()) {
    window.__raidRuntime?.publishPlayerAction({
      type: "admin",
      adminAction: actionKey,
      actor: { x: player.x, y: player.y, angle: player.angle, radius: player.radius, className: selectedClass },
    });
  }

  syncAdminDeckUi();
  syncHud();
}

function setMusicDeckVisible(visible) {
  musicDeckVisible = Boolean(visible);
  musicDeck?.classList.toggle("is-visible", musicDeckVisible);
  musicDeck?.setAttribute("aria-hidden", musicDeckVisible ? "false" : "true");
}

function setPreferredMusicMode(mode) {
  if (!Object.prototype.hasOwnProperty.call(MUSIC_MODE_LABELS, mode)) {
    return;
  }

  preferredMusicMode = mode;
  syncMusicDeckUi();
  syncPreferredMusic();
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
  ensureMusicTracks();
  playMusicMode("intro");
}

function stopIntroMusic() {
  stopTrack(introTrack);
}

function startGameMusic() {
  ensureMusicTracks();
  playMusicMode(getAutoMusicMode());
}

function stopGameMusic() {
  ensureMusicTracks();
  queuedMusicTrack = null;
  stopTrack(firstLevelTrack);
  stopTrack(freightStealthTrack);
  stopTrack(shadowStealthTrack);
  stopTrack(bossTrack);
  stopTrack(altBossTrack);
}

function syncPreferredMusic() {
  ensureMusicTracks();
  syncMusicDeckUi();
  if (!musicUnlocked) {
    return;
  }

  const resolvedMode = getResolvedMusicMode();

  if (playMusicMode(resolvedMode)) {
    return;
  }

  stopIntroMusic();
  stopGameMusic();
}

function getSfxPath(kind, context = {}) {
  if (kind === "shot") {
    const className = context.className || gameState?.player?.weapon?.className || selectedClass;
    return SFX_TRACKS.shot[className] || null;
  }

  if (kind === "reload") {
    const className = context.className || gameState?.player?.weapon?.className || selectedClass;
    return SFX_TRACKS.reload[className] || null;
  }

  if (kind === "enemyShot") {
    return SFX_TRACKS.enemyShot[context.enemyKind] || null;
  }

  if (kind === "crateBreak") {
    return SFX_TRACKS.crateBreak || null;
  }

  return null;
}

function getSfxPlaybackOptions(kind, context = {}) {
  if (kind === "shot" && context.className === "stealther") {
    return { maxDurationMs: 500 };
  }

  if (kind === "enemyShot" && context.enemyKind === "rusher") {
    return { maxDurationMs: 500 };
  }

  return {};
}

function ensureSfxClip(path) {
  if (!path) {
    return null;
  }

  if (!sfxClipCache.has(path)) {
    const pool = [];
    for (let index = 0; index < SFX_POOL_SIZE; index += 1) {
      const clip = new Audio(path);
      clip.preload = "auto";
      clip.playsInline = true;
      clip.load();
      pool.push(clip);
    }
    sfxClipCache.set(path, { pool, nextIndex: 0 });
  }

  return sfxClipCache.get(path) || null;
}

function playSfxClip(path, volume = 1, options = {}) {
  if (!path) {
    return false;
  }

  const clipState = ensureSfxClip(path);
  if (!clipState) {
    return false;
  }

  const clip = clipState.pool.find((entry) => entry.paused || entry.ended) || clipState.pool[clipState.nextIndex];
  clipState.nextIndex = (clipState.nextIndex + 1) % clipState.pool.length;
  try {
    clip.pause();
    clip.currentTime = 0;
  } catch {}
  clip.volume = clamp(volume * Math.min(1, audioSettings.sfx), 0, 1);
  const maxDurationMs = Number.isFinite(options.maxDurationMs) ? Math.max(0, options.maxDurationMs) : 0;
  let stopTimer = null;

  if (maxDurationMs > 0) {
    stopTimer = window.setTimeout(() => {
      try {
        clip.pause();
        clip.currentTime = 0;
      } catch {}
    }, maxDurationMs);
    clip.addEventListener(
      "ended",
      () => {
        if (stopTimer !== null) {
          window.clearTimeout(stopTimer);
        }
      },
      { once: true }
    );
  }

  const playPromise = clip.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }
  return true;
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

function getLightingProfile(levelId = gameState?.levelId || activeLayoutId) {
  return LIGHTING_PROFILES[levelId] || LIGHTING_PROFILES.freight;
}

function pointInsideBuilding(x, y, inset = 18) {
  return buildings.some(
    (building) =>
      x > building.x + inset &&
      x < building.x + building.w - inset &&
      y > building.y + inset &&
      y < building.y + building.h - inset
  );
}

function distanceToRect(x, y, rect) {
  const closestX = clamp(x, rect.x, rect.x + rect.w);
  const closestY = clamp(y, rect.y, rect.y + rect.h);
  return Math.hypot(x - closestX, y - closestY);
}

function getBuildingRoofRevealAmount(building) {
  if (!gameState?.player) {
    return 0;
  }

  const targets = [gameState.player, ...(gameState.remotePlayers || []).filter((remote) => remote.running !== false && (remote.hp ?? 1) > 0)];
  const nearMargin = 82;
  const fadeDistance = 118;
  let reveal = 0;

  for (const target of targets) {
    const expandedRect = {
      x: building.x - nearMargin,
      y: building.y - nearMargin,
      w: building.w + nearMargin * 2,
      h: building.h + nearMargin * 2,
    };
    if (target.x >= expandedRect.x && target.x <= expandedRect.x + expandedRect.w && target.y >= expandedRect.y && target.y <= expandedRect.y + expandedRect.h) {
      reveal = 1;
      break;
    }
    const rectDistance = distanceToRect(target.x, target.y, building);
    if (rectDistance < fadeDistance) {
      reveal = Math.max(reveal, 1 - rectDistance / fadeDistance);
    }
  }

  return clamp(reveal, 0, 1);
}

function getOverlayRevealAmount(rect) {
  if (!gameState?.player || !rect) {
    return 0;
  }

  const targets = [gameState.player, ...(gameState.remotePlayers || []).filter((remote) => remote.running !== false && (remote.hp ?? 1) > 0)];
  const nearMargin = 82;
  const fadeDistance = 118;
  let reveal = 0;

  for (const target of targets) {
    const expandedRect = {
      x: rect.x - nearMargin,
      y: rect.y - nearMargin,
      w: rect.w + nearMargin * 2,
      h: rect.h + nearMargin * 2,
    };
    if (target.x >= expandedRect.x && target.x <= expandedRect.x + expandedRect.w && target.y >= expandedRect.y && target.y <= expandedRect.y + expandedRect.h) {
      reveal = 1;
      break;
    }
    const rectDistance = distanceToRect(target.x, target.y, rect);
    if (rectDistance < fadeDistance) {
      reveal = Math.max(reveal, 1 - rectDistance / fadeDistance);
    }
  }

  return clamp(reveal, 0, 1);
}

function drawBuildingRoof(building, theme) {
  const mappedRoofAsset = isRoofAssetPath(building.asset);
  const roofInset = mappedRoofAsset ? 0 : 12;
  const roofX = building.x + roofInset;
  const roofY = building.y + roofInset;
  const roofW = building.w - roofInset * 2;
  const roofH = building.h - roofInset * 2;
  const roofReveal = getBuildingRoofRevealAmount(building);
  const roofAlpha = 1 - roofReveal * 0.94;

  if (roofAlpha <= 0.03) {
    return;
  }

  if (building.asset) {
    drawMappedAsset(
      {
        ...building,
        x: roofX,
        y: roofY,
        w: roofW,
        h: roofH,
        drawOffsetX: 0,
        drawOffsetY: 0,
        drawW: roofW,
        drawH: roofH,
      },
      {
        useVisualBounds: false,
        alphaMultiplier: roofAlpha,
      }
    );
  } else {
    const roofGradient = ctx.createLinearGradient(roofX, roofY, roofX, roofY + roofH);
    roofGradient.addColorStop(0, theme.roofTop);
    roofGradient.addColorStop(1, theme.roofBottom);

    ctx.save();
    ctx.globalAlpha *= roofAlpha;
    ctx.fillStyle = roofGradient;
    ctx.fillRect(roofX, roofY, roofW, roofH);
    ctx.strokeStyle = theme.buildingStroke;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(roofX, roofY, roofW, roofH);

    ctx.fillStyle = theme.roofHighlight;
    ctx.fillRect(roofX + 10, roofY + 10, roofW - 20, 8);
    ctx.fillStyle = theme.roofStripe;
    for (let stripe = roofY + 26; stripe < roofY + roofH - 12; stripe += 22) {
      ctx.fillRect(roofX + 12, stripe, roofW - 24, 2);
    }

    if (gameState.levelId === "admin") {
      ctx.fillStyle = "rgba(86, 82, 76, 0.08)";
      for (let pilaster = roofX + 34; pilaster < roofX + roofW - 22; pilaster += 94) {
        ctx.fillRect(pilaster, roofY + 18, 10, roofH - 36);
      }
    }

    ctx.fillStyle = theme.roofBoxFill;
    ctx.fillRect(roofX + roofW - 54, roofY + 18, 30, 22);
    ctx.strokeStyle = theme.roofBoxStroke;
    ctx.strokeRect(roofX + roofW - 54, roofY + 18, 30, 22);
    ctx.restore();
  }

  if (mappedRoofAsset) {
    return;
  }

  ctx.save();
  ctx.globalAlpha *= clamp(roofAlpha + 0.04, 0, 1);
  for (const window of building.windows) {
    ctx.fillStyle = window.broken ? theme.windowBrokenFill : theme.windowFill;
    ctx.fillRect(window.x, window.y, window.w, window.h);
    ctx.strokeStyle = window.broken ? theme.windowBrokenStroke : theme.windowStroke;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(window.x, window.y, window.w, window.h);
    if (!window.broken) {
      ctx.strokeStyle = "rgba(237, 249, 255, 0.2)";
      ctx.beginPath();
      ctx.moveTo(window.x + 3, window.y + 3);
      ctx.lineTo(window.x + window.w - 3, window.y + window.h - 3);
      ctx.stroke();
    }
  }

  ctx.fillStyle = building.door.open ? theme.doorOpenFill : theme.doorClosedFill;
  ctx.fillRect(building.door.x, building.door.y, building.door.w, building.door.h);
  ctx.strokeStyle = theme.doorStroke;
  ctx.strokeRect(building.door.x, building.door.y, building.door.w, building.door.h);
  ctx.restore();
}

function getAwarenessAlertLevel(state = gameState) {
  if (!state) {
    return 0;
  }
  if (state.awareness === "spotted") {
    return 1;
  }
  if (state.awareness === "lost") {
    return 0.7;
  }
  if (state.awareness === "suspicious") {
    return 0.45;
  }
  return 0;
}

function getStageLightAnchors(levelId = gameState?.levelId || activeLayoutId) {
  return LEVEL_LIGHT_ANCHORS[levelId] || [];
}

function getEnvironmentalLights() {
  const profile = getLightingProfile();
  const lights = [];
  for (const anchor of getStageLightAnchors()) {
    lights.push({
      x: anchor.x,
      y: anchor.y,
      radius: anchor.radius,
      intensity: anchor.intensity,
      color: anchor.color || profile.staticLightColor,
      pulse: anchor.pulse || 0,
      kind: "anchor",
    });
  }

  for (const light of activeLightSources) {
    lights.push({
      x: light.x,
      y: light.y,
      radius: light.radius || 160,
      intensity: light.intensity || 0.2,
      color: light.color || profile.staticLightColor,
      pulse: light.pulse || 0,
      kind: "placed-light",
      asset: light.asset || "",
      assetSize: light.assetSize || 56,
    });
  }

  for (const building of buildings) {
    if (building?.door) {
      lights.push({
        x: building.door.x + building.door.w * 0.5,
        y: building.door.y + building.door.h * 0.5,
        radius: 150,
        intensity: gameState?.levelId === "admin" ? 0.22 : 0.14,
        color: profile.doorLightColor,
        kind: "door",
      });
    }
  }

  if (extractionZone) {
    lights.push({
      x: extractionZone.x + extractionZone.w * 0.5,
      y: extractionZone.y + extractionZone.h * 0.5,
      radius: Math.max(extractionZone.w, extractionZone.h) * 0.9,
      intensity: 0.16,
      color: profile.extractionColor,
      pulse: 0.08,
      kind: "extraction",
    });
  }

  for (const zone of gameState?.specimenZones || []) {
    lights.push({
      x: zone.specimenX,
      y: zone.specimenY,
      radius: 120,
      intensity: 0.1,
      color: "rgba(104, 229, 205, 0.18)",
      pulse: 0.12,
      kind: "specimen-zone",
    });
  }

  if (gameState?.player) {
    lights.push({
      x: gameState.player.x,
      y: gameState.player.y,
      radius: 92,
      intensity: gameState.player.invisible ? 0.05 : 0.1,
      color: profile.playerLightColor,
      kind: "player",
    });
    if (gameState.player.muzzleFlash > 0) {
      lights.push({
        x: gameState.player.x + Math.cos(gameState.player.angle) * 24,
        y: gameState.player.y + Math.sin(gameState.player.angle) * 24,
        radius: 132,
        intensity: 0.2 + gameState.player.muzzleFlash * 1.6,
        color: TEMP_LIGHT_DEFAULTS.muzzle.color,
        kind: "player-flash",
      });
    }
  }

  for (const remote of gameState?.remotePlayers || []) {
    if (remote.running === false || (remote.hp ?? 1) <= 0) {
      continue;
    }
    lights.push({
      x: remote.x,
      y: remote.y,
      radius: 84,
      intensity: remote.invisible ? 0.04 : 0.085,
      color: profile.playerLightColor,
      kind: "remote-player",
    });
  }

  for (const enemy of gameState?.enemies || []) {
    if (enemy.dead || !(enemy.muzzleFlash > 0)) {
      continue;
    }
    lights.push({
      x: enemy.x + Math.cos(enemy.aimAngle || 0) * 22,
      y: enemy.y + Math.sin(enemy.aimAngle || 0) * 22,
      radius: enemy.kind === "boss" ? 148 : enemy.kind === "guard" ? 122 : 104,
      intensity: 0.16 + enemy.muzzleFlash * 1.5,
      color: TEMP_LIGHT_DEFAULTS.enemyMuzzle.color,
      kind: "enemy-flash",
    });
  }

  return lights;
}

function resolveLightStrength(light, now = performance.now() * 0.001) {
  if (!light) {
    return 0;
  }
  let strength = light.intensity || 0;
  if (light.pulse) {
    strength *= 0.88 + Math.sin(now * 3.4 + (light.x || 0) * 0.01 + (light.y || 0) * 0.008) * light.pulse;
  }
  if (typeof light.ttl === "number" && typeof light.maxTtl === "number" && light.maxTtl > 0) {
    strength *= clamp(light.ttl / light.maxTtl, 0, 1);
  }
  return Math.max(0, strength);
}

function getActiveLights() {
  return [...getEnvironmentalLights(), ...(gameState?.dynamicLights || [])];
}

function spawnLightPulse(x, y, kind = "muzzle", overrides = {}) {
  if (!gameState) {
    return;
  }
  const preset = TEMP_LIGHT_DEFAULTS[kind] || TEMP_LIGHT_DEFAULTS.muzzle;
  gameState.dynamicLights.push({
    x,
    y,
    radius: overrides.radius || preset.radius,
    intensity: overrides.intensity || preset.intensity,
    ttl: overrides.ttl || preset.ttl,
    maxTtl: overrides.ttl || preset.ttl,
    color: overrides.color || preset.color,
    pulse: overrides.pulse || 0,
  });
}

function sampleIlluminationAt(x, y) {
  const profile = getLightingProfile();
  let value = profile.baseExposure || 0.2;
  if (pointInsideBuilding(x, y)) {
    value += profile.indoorExposureOffset || 0;
  }

  const now = performance.now() * 0.001;
  for (const light of getActiveLights()) {
    const radius = light.radius || 0;
    if (radius <= 0) {
      continue;
    }
    const lightDistance = Math.hypot(x - light.x, y - light.y);
    if (lightDistance >= radius) {
      continue;
    }
    const falloff = 1 - lightDistance / radius;
    value += resolveLightStrength(light, now) * falloff * falloff;
  }

  return clamp(value, 0.04, 1);
}

function updateLighting(dt) {
  if (!gameState) {
    return;
  }

  for (const light of gameState.dynamicLights) {
    light.ttl -= dt;
  }
  gameState.dynamicLights = gameState.dynamicLights.filter((light) => light.ttl > 0);
  if (gameState.player) {
    gameState.player.lightExposure = sampleIlluminationAt(gameState.player.x, gameState.player.y);
  }
}

function drawLightingOverlay() {
  if (!gameState?.running) {
    return;
  }

  const profile = getLightingProfile();
  const worldWidth = canvas.width / CAMERA_ZOOM;
  const worldHeight = canvas.height / CAMERA_ZOOM;
  const worldX = gameState.camera.x;
  const worldY = gameState.camera.y;
  const heatFactor = Math.max(0, (gameState.heat || 1) - 1);
  const alertFactor = getAwarenessAlertLevel();
  const playerIndoors = pointInsideBuilding(gameState.player.x, gameState.player.y);
  const activeLights = getActiveLights();
  const darknessAlpha = clamp(
    profile.darkness + heatFactor * profile.heatDarknessAdd + alertFactor * profile.alertDarknessAdd + (playerIndoors ? profile.indoorOverlayDelta || 0 : 0),
    0.18,
    0.72
  );
  const [r, g, b] = profile.overlayTint;

  ctx.save();
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${darknessAlpha})`;
  ctx.fillRect(worldX - 12, worldY - 12, worldWidth + 24, worldHeight + 24);
  ctx.globalCompositeOperation = "destination-out";
  for (const light of activeLights) {
    const strength = resolveLightStrength(light);
    if (strength <= 0) {
      continue;
    }
    const gradient = ctx.createRadialGradient(light.x, light.y, light.radius * 0.16, light.x, light.y, light.radius);
    gradient.addColorStop(0, `rgba(0, 0, 0, ${Math.min(0.92, strength)})`);
    gradient.addColorStop(0.45, `rgba(0, 0, 0, ${Math.min(0.64, strength * 0.72)})`);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(light.x, light.y, light.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const light of activeLights) {
    const strength = resolveLightStrength(light);
    if (strength <= 0) {
      continue;
    }
    const gradient = ctx.createRadialGradient(light.x, light.y, light.radius * 0.1, light.x, light.y, light.radius);
    gradient.addColorStop(0, light.color || profile.staticLightColor);
    gradient.addColorStop(0.55, (light.color || profile.staticLightColor).replace(/0?\.\d+\)/, `${Math.max(0.08, strength * 0.16).toFixed(2)})`));
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(light.x, light.y, light.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  if (alertFactor > 0.2) {
    const [ar, ag, ab] = profile.alertTint;
    ctx.fillStyle = `rgba(${ar}, ${ag}, ${ab}, ${0.04 + alertFactor * 0.04})`;
    ctx.fillRect(worldX - 12, worldY - 12, worldWidth + 24, worldHeight + 24);
  }
  ctx.restore();
}

function drawLightFixtures() {
  if (!gameState?.running) {
    return;
  }

  const profile = getLightingProfile();
  const theme = getLevelVisualTheme();
  const now = performance.now() * 0.001;

  for (const anchor of getStageLightAnchors()) {
    const strength = resolveLightStrength(anchor, now);
    const outerRadius = gameState.levelId === "admin" ? 16 : gameState.levelId === "reactor" ? 13 : 14;
    const innerRadius = gameState.levelId === "admin" ? 7 : 6;
    ctx.fillStyle = "rgba(23, 31, 39, 0.3)";
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, outerRadius + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = gameState.levelId === "admin" ? "rgba(230, 221, 198, 0.92)" : "rgba(72, 86, 98, 0.88)";
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, outerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = gameState.levelId === "reactor" ? "rgba(119, 205, 250, 0.9)" : "rgba(242, 246, 249, 0.9)";
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, innerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = profile.staticLightColor.replace(/0?\.\d+\)/, `${Math.max(0.18, strength * 0.42).toFixed(2)})`);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, outerRadius + 7 + Math.sin(now * 2.8 + anchor.x * 0.01) * 1.8, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const light of activeLightSources) {
    const strength = resolveLightStrength(light, now);
    const asset = light.asset ? getCachedImage(light.asset) : null;
    const fixtureSize = Math.max(18, Number(light.assetSize) || 44);
    if (asset?.complete && asset.naturalWidth > 0) {
      ctx.drawImage(asset, light.x - fixtureSize * 0.5, light.y - fixtureSize * 0.5, fixtureSize, fixtureSize);
    } else {
      ctx.fillStyle = "rgba(21, 29, 36, 0.76)";
      ctx.beginPath();
      ctx.arc(light.x, light.y, Math.max(7, fixtureSize * 0.26), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(246, 239, 215, 0.96)";
      ctx.beginPath();
      ctx.arc(light.x, light.y, Math.max(3, fixtureSize * 0.14), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = profile.staticLightColor.replace(/0?\.\d+\)/, `${Math.max(0.18, strength * 0.42).toFixed(2)})`);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(light.x, light.y, Math.max(12, fixtureSize * 0.34 + 6 + Math.sin(now * 2.4 + light.x * 0.01) * 1.3), 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const building of buildings) {
    if (!building?.door) {
      continue;
    }
    const doorCenterX = building.door.x + building.door.w * 0.5;
    const doorCenterY = building.door.y + building.door.h * 0.5;
    const horizontalDoor = building.door.w >= building.door.h;
    const fixtureW = horizontalDoor ? Math.max(18, building.door.w * 0.42) : 8;
    const fixtureH = horizontalDoor ? 8 : Math.max(18, building.door.h * 0.42);
    const fixtureX = doorCenterX - fixtureW * 0.5;
    const fixtureY = horizontalDoor ? building.door.y - 10 : doorCenterY - fixtureH * 0.5;
    ctx.fillStyle = "rgba(33, 41, 49, 0.82)";
    ctx.beginPath();
    ctx.roundRect(fixtureX, fixtureY, fixtureW, fixtureH, 3);
    ctx.fill();
    ctx.fillStyle = gameState.levelId === "admin" ? "rgba(247, 238, 214, 0.92)" : theme.windowStroke;
    ctx.beginPath();
    ctx.roundRect(fixtureX + 2, fixtureY + 2, Math.max(4, fixtureW - 4), Math.max(4, fixtureH - 4), 2);
    ctx.fill();
  }
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function inIndoorAcoustics() {
  if (!gameState?.player) {
    return false;
  }

  return buildings.some(
    (building) =>
      gameState.player.x > building.x + 18 &&
      gameState.player.x < building.x + building.w - 18 &&
      gameState.player.y > building.y + 18 &&
      gameState.player.y < building.y + building.h - 18
  );
}

function playGameSound(kind, context = {}) {
  const indoor = inIndoorAcoustics();
  const reactor = gameState?.levelId === "reactor";
  const sfxPath = getSfxPath(kind, context);

  if (sfxPath) {
    playSfxClip(sfxPath, context.volume ?? 0.88, getSfxPlaybackOptions(kind, context));
    return;
  }

  switch (kind) {
    case "shot":
      playTone({
        frequency: reactor ? randomBetween(128, 148) : randomBetween(148, 172),
        duration: 0.06,
        type: "sawtooth",
        volume: indoor ? 0.16 : 0.2,
        slideTo: randomBetween(58, 74),
      });
      playTone({
        frequency: randomBetween(700, 960),
        duration: 0.028,
        type: "square",
        volume: 0.07,
        slideTo: randomBetween(200, 260),
      });
      playTone({
        frequency: indoor ? randomBetween(170, 220) : randomBetween(120, 165),
        duration: indoor ? 0.16 : 0.1,
        type: "triangle",
        volume: indoor ? 0.06 : 0.035,
        slideTo: randomBetween(70, 100),
      });
      break;
    case "enemyShot":
      playTone({
        frequency: reactor ? randomBetween(114, 132) : randomBetween(132, 154),
        duration: 0.07,
        type: "sawtooth",
        volume: indoor ? 0.13 : 0.16,
        slideTo: randomBetween(60, 80),
      });
      playTone({
        frequency: randomBetween(520, 720),
        duration: 0.035,
        type: "square",
        volume: 0.05,
        slideTo: randomBetween(180, 240),
      });
      break;
    case "pickup":
      playTone({ frequency: 560, duration: 0.08, type: "triangle", volume: 0.11, slideTo: 820 });
      playTone({ frequency: 880, duration: 0.05, type: "sine", volume: 0.05, slideTo: 1020 });
      break;
    case "core":
      playTone({ frequency: 240, duration: 0.2, type: "triangle", volume: 0.13, slideTo: 430 });
      playTone({ frequency: 480, duration: 0.18, type: "sine", volume: 0.08, slideTo: 760 });
      break;
    case "reload":
      playTone({ frequency: 210, duration: 0.04, type: "square", volume: 0.07, slideTo: 170 });
      playTone({ frequency: 320, duration: 0.05, type: "triangle", volume: 0.05, slideTo: 250 });
      window.setTimeout(() => {
        playTone({ frequency: 260, duration: 0.04, type: "square", volume: 0.06, slideTo: 210 });
      }, 55);
      break;
    case "hit":
      playTone({ frequency: 118, duration: 0.09, type: "sawtooth", volume: 0.14, slideTo: 74 });
      playTone({ frequency: 980, duration: 0.018, type: "square", volume: 0.035, slideTo: 410 });
      break;
    case "alert":
      playTone({ frequency: 470, duration: 0.11, type: "square", volume: 0.08, slideTo: 390 });
      playTone({ frequency: 620, duration: 0.08, type: "triangle", volume: 0.045, slideTo: 520 });
      break;
    case "step":
      playTone({
        frequency: indoor ? 120 : 86,
        duration: 0.03,
        type: indoor ? "square" : "triangle",
        volume: indoor ? 0.028 : 0.02,
        slideTo: indoor ? 86 : 64,
      });
      break;
    case "medkit":
      playTone({ frequency: 280, duration: 0.12, type: "triangle", volume: 0.09, slideTo: 420 });
      playTone({ frequency: 440, duration: 0.1, type: "sine", volume: 0.06, slideTo: 620 });
      break;
    case "decoy":
      playTone({ frequency: 520, duration: 0.1, type: "square", volume: 0.09, slideTo: 360 });
      playTone({ frequency: 260, duration: 0.14, type: "triangle", volume: 0.045, slideTo: 180 });
      break;
    case "shatter":
      playTone({ frequency: 420, duration: 0.035, type: "square", volume: 0.055, slideTo: 180 });
      playTone({ frequency: 260, duration: 0.06, type: "sawtooth", volume: 0.09, slideTo: 120 });
      window.setTimeout(() => {
        playTone({ frequency: 760, duration: 0.025, type: "triangle", volume: 0.03, slideTo: 320 });
      }, 20);
      break;
    default:
      break;
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

function createCrate(id, x, y, w, h, lootType = "cash", lootValue = 90) {
  return {
    id,
    x,
    y,
    w,
    h,
    kind: "crate",
    hp: 18,
    maxHp: 18,
    damageStage: 0,
    broken: false,
    lootType,
    lootValue,
    lootSpawned: false,
  };
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

function updateCrateDamageStage(crate) {
  if (!crate) {
    return false;
  }

  const nextStage = getCrateDamageStage(crate);
  const changed = nextStage !== crate.damageStage;
  crate.damageStage = nextStage;
  return changed;
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
      cellDamage: 1,
      viewRange: 330,
      viewCone: Math.PI * 0.66,
      hearingRange: 320,
      meleeRange: 0,
    },
    guard: {
      speed: 102,
      hp: 74,
      cooldown: 0.95,
      color: "#ff944d",
      radius: 17,
      damage: 19,
      cellDamage: 1,
      viewRange: 390,
      viewCone: Math.PI * 0.82,
      hearingRange: 380,
      meleeRange: 0,
    },
    boss: {
      speed: 88,
      hp: 260,
      cooldown: 0.55,
      color: "#ffbf63",
      radius: 24,
      damage: 24,
      cellDamage: 2,
      viewRange: 470,
      viewCone: Math.PI,
      hearingRange: 440,
      meleeRange: 0,
    },
    specimen: {
      speed: 162,
      hp: 68,
      cooldown: 0.78,
      color: "#70e0cf",
      radius: 17,
      damage: 18,
      cellDamage: 1,
      viewRange: 260,
      viewCone: Math.PI * 0.94,
      hearingRange: 460,
      meleeRange: 34,
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
    cellDamage: preset.cellDamage,
    viewRange: preset.viewRange,
    viewCone: preset.viewCone,
    hearingRange: preset.hearingRange,
    meleeRange: preset.meleeRange,
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
    pursuitTimer: 0,
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
    elite: false,
    eliteTier: 0,
    hitFlash: 0,
    muzzleFlash: 0,
    flinchTimer: 0,
    wounded: false,
    woundedSeverity: 0,
    bleedoutTimer: 0,
    nextBleedDripAt: 0,
    woundedByRaid: false,
    woundSourceAngle: 0,
    deadTimer: 2.8,
    bossPhase: kind === "boss" ? 1 : 0,
    targetId: null,
    faction: kind === "specimen" ? "specimen" : "security",
    contained: false,
    hidden: false,
    zoneId: null,
    releaseHeat: 0,
    releaseRadius: 170,
    releaseSoundRadius: 190,
    patrolAnchorX: x,
    patrolAnchorY: y,
    patrolRadius: kind === "guard" ? 92 : kind === "boss" ? 78 : kind === "specimen" ? 96 : 128,
    targetCommitTimer: 0,
    searchNodes: [{ x, y }],
    searchNodeIndex: 0,
    patrolPause: Math.random() * 1.2,
    patrolPauseCooldown: 1.4 + Math.random() * 1.8,
    evadeTimer: 0,
    dodgeCooldown: 0,
    evadeSide: Math.random() > 0.5 ? 1 : -1,
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
  let effectiveRange = range;
  let effectiveCone = cone;
  let effectiveCloseRange = closeRange;

  if (observer.kind && target?.quietMode) {
    effectiveRange *= STEALTH_TUNING.quietSightRangeMultiplier;
    effectiveCone *= STEALTH_TUNING.quietSightConeMultiplier;
    effectiveCloseRange *= STEALTH_TUNING.quietCloseRangeMultiplier;
  }

  if (observer.kind && target?.invisible) {
    effectiveRange *= STEALTH_TUNING.cloakSightRangeMultiplier;
    effectiveCone *= STEALTH_TUNING.cloakSightConeMultiplier;
    effectiveCloseRange *= STEALTH_TUNING.cloakCloseRangeMultiplier;
  }

  if (observer.kind && target) {
    const profile = getLightingProfile();
    const lightExposure =
      typeof target.lightExposure === "number" ? target.lightExposure : sampleIlluminationAt(target.x, target.y);
    effectiveRange *= 0.82 + lightExposure * profile.revealRangeScale;
    effectiveCone *= 0.9 + lightExposure * profile.revealConeScale;
    effectiveCloseRange *= 0.92 + lightExposure * 0.18;
  }

  if (targetDistance > effectiveRange) {
    return false;
  }

  if (lineBlocked(observer.x, observer.y, target.x, target.y)) {
    return false;
  }

  if (!observer.kind || targetDistance <= effectiveCloseRange) {
    return true;
  }

  const targetAngle = angleTo(observer, target);
  return angleDifference(targetAngle, facingAngle) <= effectiveCone * 0.5;
}

function canPlayerSee(target) {
  const player = gameState.player;
  const targetDistance = distance(player, target);
  const bonusRange =
    target.kind === "boss"
      ? 120
      : target.kind
        ? 80
        : target.type === "core"
          ? 20
          : 0;
  return targetDistance <= player.viewRange + bonusRange && !lineBlocked(player.x, player.y, target.x, target.y);
}

function getEnemiesSeeingPlayerCount(state = gameState) {
  if (!state?.player || !Array.isArray(state.enemies)) {
    return 0;
  }

  return state.enemies.filter(
    (enemy) => !enemy.dead && canSeeTarget(enemy, state.player, enemy.viewRange, enemy.viewCone, enemy.aimAngle, 24)
  ).length;
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

function isObstacleUsableForCover(obstacle) {
  if (!obstacle) {
    return false;
  }
  if (obstacle.kind === "window") {
    return false;
  }
  if (obstacle.kind === "crate" && obstacle.broken) {
    return false;
  }
  return true;
}

function getCoverPointForObstacle(obstacle, player, sideBias = 0, enemyRadius = 15) {
  const centerX = obstacle.x + obstacle.w * 0.5;
  const centerY = obstacle.y + obstacle.h * 0.5;
  const angleFromPlayer = angleTo(player, { x: centerX, y: centerY });
  const lateralAngle = angleFromPlayer + sideBias * Math.PI * 0.5;
  const padding = 26 + enemyRadius * 0.8;
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

  return options.find((candidate) => !positionBlocked({ radius: enemyRadius }, candidate.x, candidate.y)) || options[0];
}

function scoreObstacleForCover(obstacle, enemy, player, sideBias = 0) {
  if (!isObstacleUsableForCover(obstacle)) {
    return null;
  }

  const centerX = obstacle.x + obstacle.w * 0.5;
  const centerY = obstacle.y + obstacle.h * 0.5;
  const coverPoint = getCoverPointForObstacle(obstacle, player, sideBias, enemy.radius || 15);
  const enemyDistance = distance(enemy, coverPoint);
  const playerDistance = distance(player, { x: centerX, y: centerY });
  const coverBlocksPlayer = lineBlocked(coverPoint.x, coverPoint.y, player.x, player.y);
  const enemyCanReach = !positionBlocked(enemy, coverPoint.x, coverPoint.y);
  const obstacleFootprint = obstacle.w * obstacle.h;

  let score = enemyDistance + playerDistance * 0.16;

  if (!enemyCanReach) {
    score += 260;
  }
  if (coverBlocksPlayer) {
    score -= 180;
  } else {
    score += 220;
  }
  if (playerDistance < 72) {
    score += 130;
  }
  if (obstacle.kind === "crate") {
    score += 28;
  }
  score += Math.min(42, obstacleFootprint / 1200);

  return {
    obstacle,
    point: coverPoint,
    score,
  };
}

function findCoverPosition(enemy, player) {
  const sideBias =
    enemy.tactic === "flankLeft" ? -1 : enemy.tactic === "flankRight" ? 1 : enemy.strafeBias;
  const nearby = getWorldObstacles()
    .filter((obstacle) => distance(enemy, { x: obstacle.x + obstacle.w * 0.5, y: obstacle.y + obstacle.h * 0.5 }) < 380)
    .map((obstacle) => scoreObstacleForCover(obstacle, enemy, player, sideBias))
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);

  if (nearby.length === 0) {
    return null;
  }

  return nearby[0].point;
}

function isSpecimenEnemy(enemy) {
  return enemy?.kind === "specimen";
}

function getEnemyFaction(enemy) {
  return isSpecimenEnemy(enemy) ? "specimen" : "security";
}

function findSpecimenZoneById(zoneId) {
  return activeSpecimenZones.find((zone) => zone.id === zoneId) || null;
}

function getHostileEnemyTargets(enemy) {
  if (!gameState) {
    return [];
  }

  const faction = getEnemyFaction(enemy);
  return gameState.enemies
    .filter((target) => !target.dead && !target.hidden && target !== enemy && getEnemyFaction(target) !== faction)
    .map((target) => ({
      id: target.id,
      x: target.x,
      y: target.y,
      vx: target.vx || 0,
      vy: target.vy || 0,
      angle: target.aimAngle || target.angle || 0,
      radius: target.radius,
      hp: target.hp,
      maxHp: target.maxHp,
      faction: getEnemyFaction(target),
      kind: target.kind,
      invisible: false,
    }));
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

function getApproximateAlertPoint(sourceEnemy, ally, targetX, targetY) {
  const blocked = lineBlocked(sourceEnemy.x, sourceEnemy.y, ally.x, ally.y);
  const relayDistance = distance(sourceEnemy, ally);
  const spread = clamp(
    AI_TUNING.alertShareSpreadMin + relayDistance * 0.16 + (blocked ? 32 : 0),
    AI_TUNING.alertShareSpreadMin,
    AI_TUNING.alertShareSpreadMax
  ) * (blocked ? AI_TUNING.alertShareBlockedMultiplier : 1);
  return {
    x: clamp(targetX + (Math.random() - 0.5) * spread * 2, 28, WORLD.width - 28),
    y: clamp(targetY + (Math.random() - 0.5) * spread * 2, 28, WORLD.height - 28),
  };
}

function notifyNearbyEnemies(sourceEnemy, playerX, playerY) {
  if (hasLiveNetworkSession()) {
    return;
  }
  for (const ally of gameState.enemies) {
    if (ally.dead || ally === sourceEnemy) {
      continue;
    }

    if (getEnemyFaction(ally) !== getEnemyFaction(sourceEnemy)) {
      continue;
    }

    if (distance(sourceEnemy, ally) > AI_TUNING.alertShareRange) {
      continue;
    }

    const approximatePoint = getApproximateAlertPoint(sourceEnemy, ally, playerX, playerY);
    ally.state = "investigate";
    ally.investigateX = approximatePoint.x;
    ally.investigateY = approximatePoint.y;
    ally.lastSeenX = approximatePoint.x;
    ally.lastSeenY = approximatePoint.y;
    ally.targetId = null;
    ally.targetCommitTimer = 0;
    ally.searchTimer = 2.6 + Math.random() * 0.9;
    ally.coverTimer = 0;
  }
}

function getSquadmates(enemy) {
  return gameState.enemies.filter((ally) => !ally.dead && ally.squadId === enemy.squadId);
}

function getShieldLead(enemy) {
  return getSquadmates(enemy).find((ally) => ally.squadRole === "shieldLead" && ally.shieldEquipped && ally.shieldHp > 0) || null;
}

function getClosestRaidDistanceToPoint(x, y) {
  const targets = getLiveRaidTargets();
  if (!targets.length) {
    return Infinity;
  }

  return Math.min(...targets.map((target) => Math.hypot(target.x - x, target.y - y)));
}

function enemyThreatensRaid(enemy) {
  if (!enemy || enemy.dead) {
    return false;
  }

  const trackedTarget = getRaidTargetById(enemy.targetId);
  if (enemy.state === "hunt") {
    if (trackedTarget?.faction === "raid") {
      return true;
    }
    return getLiveRaidTargets().some((target) => canSeeTarget(enemy, target, enemy.viewRange, enemy.viewCone, enemy.aimAngle, 24));
  }
  if (enemy.state === "investigate") {
    return getClosestRaidDistanceToPoint(enemy.investigateX, enemy.investigateY) <= AI_TUNING.raidAwarenessInvestigateRadius;
  }
  if (enemy.state === "search") {
    return getClosestRaidDistanceToPoint(enemy.lastSeenX, enemy.lastSeenY) <= AI_TUNING.raidAwarenessSearchRadius;
  }

  return false;
}

function buildSearchNodes(enemy, originX, originY) {
  const radius = enemy.kind === "guard" ? 86 : enemy.kind === "boss" ? 96 : enemy.kind === "specimen" ? 78 : 102;
  const baseAngle = angleTo(enemy, { x: originX, y: originY });
  const offsets = [0, Math.PI * 0.55, -Math.PI * 0.55, Math.PI];
  const nodes = [{ x: originX, y: originY }];

  for (const offset of offsets) {
    const candidate = {
      x: clamp(originX + Math.cos(baseAngle + offset) * radius, 32, WORLD.width - 32),
      y: clamp(originY + Math.sin(baseAngle + offset) * radius, 32, WORLD.height - 32),
    };
    if (positionBlocked(enemy, candidate.x, candidate.y)) {
      continue;
    }
    if (nodes.some((node) => distance(node, candidate) < 28)) {
      continue;
    }
    nodes.push(candidate);
  }

  return nodes;
}

function beginEnemySearch(enemy, originX, originY, duration = STEALTH_TUNING.searchBase) {
  enemy.state = "search";
  enemy.lastSeenX = originX;
  enemy.lastSeenY = originY;
  enemy.targetCommitTimer = 0;
  enemy.searchTimer = duration;
  enemy.searchNodes = buildSearchNodes(enemy, originX, originY);
  enemy.searchNodeIndex = 0;
}

function getInvestigatePointForSound(enemy, soundEvent) {
  const heardDistance = distance(enemy, soundEvent);
  const spreadBase = clamp(
    AI_TUNING.soundInvestigateMin + heardDistance * 0.18 + soundEvent.intensity * 20,
    AI_TUNING.soundInvestigateMin,
    AI_TUNING.soundInvestigateMax
  );
  const precisionBias = enemy.kind === "guard" ? 0.82 : enemy.kind === "boss" ? 0.76 : enemy.kind === "specimen" ? 0.58 : 1;
  const spread = spreadBase * precisionBias;
  return {
    x: clamp(soundEvent.x + (Math.random() - 0.5) * spread * 2, 28, WORLD.width - 28),
    y: clamp(soundEvent.y + (Math.random() - 0.5) * spread * 2, 28, WORLD.height - 28),
  };
}

function scoreTargetForEnemy(enemy, target) {
  const targetDistance = distance(enemy, target);
  let score = 220 - targetDistance * 0.68;

  if (getEnemyFaction(enemy) === "security") {
    score += target.faction === "raid" ? 180 : 0;
    score += target.kind === "specimen" ? (targetDistance < 110 ? 80 : -55) : 0;
  } else {
    score += target.faction === "raid" ? 110 : 65;
    score -= target.kind === "boss" ? 16 : 0;
  }

  if (target.id === enemy.targetId) {
    score += 120 + enemy.targetCommitTimer * 40;
  }

  return score;
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
    layoutId: gameState?.levelId || activeLayoutId,
    bounds: { ...WORLD },
    extractionZone: { ...extractionZone },
    requiredLoot: gameState?.requiredLoot || 0,
    bossRequired: Boolean(gameState?.bossRequired),
    nextLevelId: getNextLevelId(),
    doors: buildings.map((building) => ({
      id: building.door.id,
      kind: building.door.kind || "door",
      x: building.door.x,
      y: building.door.y,
      w: building.door.w,
      h: building.door.h,
      side: building.door.side,
      open: building.door.open,
    })),
    windows: buildings.flatMap((building) =>
      building.windows.map((window) => ({
        id: window.id,
        kind: window.kind || "window",
        x: window.x,
        y: window.y,
        w: window.w,
        h: window.h,
        side: window.side,
        broken: window.broken,
      }))
    ),
    loot: gameState.loot.map((loot) => ({
      id: loot.id,
      x: loot.x,
      y: loot.y,
      type: loot.type,
      value: loot.value,
      radius: loot.radius,
      collected: loot.collected,
    })),
    crates: obstacles
      .filter((obstacle) => obstacle.kind === "crate")
      .map((crate) => ({
        id: crate.id,
        kind: crate.kind || "crate",
        x: crate.x,
        y: crate.y,
        w: crate.w,
        h: crate.h,
        lootType: crate.lootType,
        lootValue: crate.lootValue,
        maxHp: crate.maxHp,
        hp: crate.hp,
        damageStage: crate.damageStage,
        broken: crate.broken,
        lootSpawned: crate.lootSpawned,
      })),
    collision: getWorldObstacles().map((obstacle) => ({
      id: obstacle.id || null,
      kind: obstacle.kind || "wall",
      x: obstacle.x,
      y: obstacle.y,
      w: obstacle.w,
      h: obstacle.h,
    })),
  };
}

function applyWorldState(world) {
  if (!world || !gameState) {
    return;
  }

  if (world.layoutId && world.layoutId !== gameState.levelId) {
    beginLevel(world.layoutId, { preservePlayer: true, preserveRunState: true });
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
    gameState.loot = world.loot.map((lootState) => ({
      id: lootState.id,
      x: lootState.x,
      y: lootState.y,
      type: lootState.type,
      value: lootState.value,
      radius: lootState.radius,
      collected: Boolean(lootState.collected),
      pulse: Math.random() * Math.PI * 2,
    }));
  }

  if (Array.isArray(world.crates)) {
    for (const crateState of world.crates) {
      const crate = findCrateById(crateState.id);
      if (!crate) {
        continue;
      }
      crate.hp = typeof crateState.hp === "number" ? crateState.hp : crate.hp;
      crate.broken = Boolean(crateState.broken);
      crate.damageStage =
        typeof crateState.damageStage === "number" ? crateState.damageStage : getCrateDamageStage(crate);
      crate.lootSpawned = Boolean(crateState.lootSpawned);
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
    cellDamage: enemy.cellDamage,
    viewRange: enemy.viewRange,
    viewCone: enemy.viewCone,
    hearingRange: enemy.hearingRange,
    meleeRange: enemy.meleeRange,
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
    pursuitTimer: enemy.pursuitTimer,
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
    elite: enemy.elite,
    eliteTier: enemy.eliteTier,
    hitFlash: enemy.hitFlash,
    muzzleFlash: enemy.muzzleFlash,
    flinchTimer: enemy.flinchTimer,
    wounded: enemy.wounded,
    woundedSeverity: enemy.woundedSeverity,
    bleedoutTimer: enemy.bleedoutTimer,
    nextBleedDripAt: enemy.nextBleedDripAt,
    woundedByRaid: enemy.woundedByRaid,
    woundSourceAngle: enemy.woundSourceAngle,
    deadTimer: enemy.deadTimer,
    bossPhase: enemy.bossPhase,
    targetId: enemy.targetId,
    faction: enemy.faction,
    contained: enemy.contained,
    hidden: enemy.hidden,
    zoneId: enemy.zoneId,
    releaseHeat: enemy.releaseHeat,
    patrolAnchorX: enemy.patrolAnchorX,
    patrolAnchorY: enemy.patrolAnchorY,
    patrolRadius: enemy.patrolRadius,
    targetCommitTimer: enemy.targetCommitTimer,
    searchNodes: enemy.searchNodes,
    searchNodeIndex: enemy.searchNodeIndex,
    evadeTimer: enemy.evadeTimer,
    dodgeCooldown: enemy.dodgeCooldown,
    evadeSide: enemy.evadeSide,
  };
}

function applyEnemySnapshot(target, snapshot) {
  const hasLivePosition = typeof target.x === "number" && typeof target.y === "number";
  const currentX = target.x;
  const currentY = target.y;
  Object.assign(target, snapshot);
  target.syncX = snapshot.x;
  target.syncY = snapshot.y;
  if (hasLivePosition) {
    target.x = currentX;
    target.y = currentY;
  }
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
    outerColor: bullet.outerColor,
    coreColor: bullet.coreColor,
    headColor: bullet.headColor,
    trailWidth: bullet.trailWidth,
    innerTrailWidth: bullet.innerTrailWidth,
    ownerId: bullet.ownerId || null,
    ownerEnemyId: bullet.ownerEnemyId || null,
    ownerFaction: bullet.ownerFaction || null,
    bulletId: bullet.bulletId || null,
    shotToken: bullet.shotToken || null,
  };
}

function applyBulletSnapshot(snapshot) {
  return { ...snapshot };
}

function getCombatSnapshot() {
  if (!gameState?.running || !isRaidHost()) {
    return null;
  }

  const liveSession = hasLiveNetworkSession();
  if (liveSession && gameState.serverCombatSeedReady && gameState.serverCombatSeedLevelId === gameState.levelId) {
    return null;
  }

  return {
    levelId: gameState.levelId,
    elapsed: gameState.elapsed,
    heat: gameState.heat,
    heatScore: gameState.heatScore,
    heatTierApplied: gameState.heatTierApplied,
    lootCollected: gameState.lootCollected,
    message: gameState.message,
    enemies: gameState.enemies.map(serializeEnemy),
    bullets: liveSession ? [] : gameState.bullets.map(serializeBullet),
    enemyBullets: gameState.enemyBullets.map(serializeBullet),
  };
}

function applyCombatSnapshotInternal(snapshot, options = {}) {
  const force = options.force === true;
  if (!gameState || !snapshot || (!force && isRaidHost() && !hasLiveNetworkSession())) {
    return;
  }

  if (snapshot.levelId && snapshot.levelId !== gameState.levelId) {
    beginLevel(snapshot.levelId, { preservePlayer: true, preserveRunState: true });
  }

  if (hasLiveNetworkSession() && Array.isArray(snapshot.enemies) && snapshot.enemies.length > 0) {
    gameState.serverCombatSeedReady = true;
    gameState.serverCombatSeedLevelId = snapshot.levelId || gameState.levelId;
  }

  gameState.elapsed = typeof snapshot.elapsed === "number" ? snapshot.elapsed : gameState.elapsed;
  gameState.heat = typeof snapshot.heat === "number" ? snapshot.heat : gameState.heat;
  gameState.heatScore = typeof snapshot.heatScore === "number" ? snapshot.heatScore : gameState.heatScore;
  gameState.heatTierApplied =
    typeof snapshot.heatTierApplied === "number" ? snapshot.heatTierApplied : gameState.heatTierApplied;
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
    const authoritativeBullets = snapshot.bullets.map(applyBulletSnapshot);
    const confirmedTokens = new Set(
      authoritativeBullets
        .filter((bullet) => bullet.ownerId === gameState.localNetworkId && bullet.shotToken)
        .map((bullet) => bullet.shotToken)
    );
    if (confirmedTokens.size > 0) {
      gameState.predictedBullets = gameState.predictedBullets.filter((bullet) => !confirmedTokens.has(bullet.shotToken));
    }
    gameState.bullets = authoritativeBullets;
  }

  if (Array.isArray(snapshot.enemyBullets)) {
    gameState.enemyBullets = snapshot.enemyBullets.map(applyBulletSnapshot);
  }

  syncHud();
}

function applyCombatSnapshot(snapshot) {
  applyCombatSnapshotInternal(snapshot);
}

function applyCombatEvent(event = {}) {
  if (!gameState || !event?.kind) {
    return;
  }

  const payload = event.payload || {};
  const localId = event.localId || gameState.localNetworkId;
  const playerId = payload.playerId || null;
  const isLocalActor = Boolean(playerId && localId && playerId === localId);
  const actorState =
    playerId && !isLocalActor
      ? resolveRemoteActionActor(playerId, {
          angle: payload.angle,
          className: payload.className,
        }) || {
          id: playerId,
          x: payload.x,
          y: payload.y,
          angle: payload.angle || 0,
          radius: payload.radius || 15,
          className: payload.className || "stealther",
        }
      : null;

  if (event.kind === (protocolApi.COMBAT_EVENT_KIND?.SHOT || "shot")) {
    if (!isLocalActor && actorState) {
      emitRemotePlayerShot(actorState, payload);
    }
    return;
  }

  if (event.kind === (protocolApi.COMBAT_EVENT_KIND?.ENEMY_SHOT || "enemy_shot")) {
    const enemy = gameState.enemies.find((entry) => entry.id === payload.enemyId);
    const shotX = Number.isFinite(payload.x) ? payload.x : enemy?.x;
    const shotY = Number.isFinite(payload.y) ? payload.y : enemy?.y;
    const shotAngle = Number.isFinite(payload.angle) ? payload.angle : enemy?.aimAngle || 0;
    if (enemy) {
      enemy.aimAngle = shotAngle;
      enemy.muzzleFlash = 0.08;
      enemy.justAlerted = true;
    }
    if (Number.isFinite(shotX) && Number.isFinite(shotY)) {
      emitSound(shotX, shotY, 220, "enemyShot", 0.8);
      spawnLightPulse(shotX + Math.cos(shotAngle) * 22, shotY + Math.sin(shotAngle) * 22, "enemyMuzzle", {
        radius: payload.kind === "boss" ? 156 : payload.kind === "guard" ? 122 : 108,
        intensity: payload.kind === "boss" ? 0.4 : 0.3,
      });
      spawnBulletCasings(
        shotX + Math.cos(shotAngle) * 8,
        shotY + Math.sin(shotAngle) * 8,
        shotAngle,
        getCasingProfileForShooter("enemy", payload.kind)
      );
      playGameSound("enemyShot", { enemyKind: payload.kind });
    }
    return;
  }

  if (event.kind === (protocolApi.COMBAT_EVENT_KIND?.HIT || "hit")) {
    const enemy = gameState.enemies.find((entry) => entry.id === payload.enemyId);
    const impactX = Number.isFinite(payload.x) ? payload.x : enemy?.x;
    const impactY = Number.isFinite(payload.y) ? payload.y : enemy?.y;
    if (Number.isFinite(impactX) && Number.isFinite(impactY)) {
      if (payload.shieldBlocked) {
        spawnImpactBurst(impactX, impactY, ["#a8d8f3", "#f4fbff", "rgba(146, 166, 182, 0.5)"], 3.2);
      } else {
        spawnImpactBurst(impactX, impactY, ["#ff7a45", "#ffe6c9", "rgba(126, 26, 45, 0.5)"], 3.4);
        spawnBloodBurst(impactX, impactY, enemy?.kind === "boss" ? 9 : 6, false, {
          kind: enemy?.kind,
          angle: enemy?.woundSourceAngle || 0,
          force: 84,
        });
        playGameSound("hit");
      }
    }
    return;
  }

  if (event.kind === (protocolApi.COMBAT_EVENT_KIND?.DEATH || "death")) {
    const enemy = gameState.enemies.find((entry) => entry.id === payload.enemyId);
    const deathX = Number.isFinite(payload.x) ? payload.x : enemy?.x;
    const deathY = Number.isFinite(payload.y) ? payload.y : enemy?.y;
    if (Number.isFinite(deathX) && Number.isFinite(deathY)) {
      spawnBloodBurst(deathX, deathY, payload.kind === "boss" ? 14 : 9, false, {
        kind: payload.kind || enemy?.kind,
        angle: enemy?.woundSourceAngle || 0,
        force: 112,
      });
    }
    return;
  }

  if (event.kind === (protocolApi.COMBAT_EVENT_KIND?.PLAYER_HIT || "player_hit")) {
    const hitTarget = getMutableRaidPlayerById(payload.playerId || localId);
    const hitX = Number.isFinite(payload.x) ? payload.x : hitTarget?.x;
    const hitY = Number.isFinite(payload.y) ? payload.y : hitTarget?.y;
    const localTarget = Boolean(payload.playerId && payload.playerId === localId);
    if (hitTarget) {
      if (typeof payload.hp === "number") {
        hitTarget.hp = payload.hp;
      }
      if (typeof payload.maxHp === "number") {
        hitTarget.maxHp = payload.maxHp;
      }
      if (typeof payload.shieldHp === "number") {
        hitTarget.shieldHp = payload.shieldHp;
      }
      if (typeof payload.shieldEquipped === "boolean") {
        hitTarget.shieldEquipped = payload.shieldEquipped;
      }
    }
    if (Number.isFinite(hitX) && Number.isFinite(hitY)) {
      if (payload.shieldBlocked) {
        if (hitTarget) {
          hitTarget.shieldFlash = 1;
        }
        spawnImpactBurst(hitX, hitY, ["#7ab7d8", "#dff6ff", "rgba(38, 73, 94, 0.36)"], 4.4);
      } else {
        if (hitTarget) {
          hitTarget.hitFlash = 1;
        }
        spawnImpactBurst(
          hitX,
          hitY,
          payload.melee
            ? ["#70e0cf", "#d8fff9", "rgba(126, 26, 45, 0.3)"]
            : ["#ff5d73", "#ffd6de", "rgba(122, 18, 39, 0.44)"],
          payload.melee ? 4.6 : 4.2
        );
        spawnBloodBurst(hitX, hitY, 5, Boolean(payload.melee), {
          kind: "rusher",
          angle: hitTarget ? angleTo(hitTarget, { x: hitX, y: hitY }) : 0,
          force: payload.melee ? 132 : 112,
        });
      }
    }
    if (localTarget) {
      if (payload.shieldBlocked) {
        gameState.player.shake = Math.max(gameState.player.shake, 4.5);
        gameState.message = payload.shieldEquipped === false ? "Side shield shattered." : "Shield absorbed the hit.";
      } else {
        gameState.player.shake = Math.max(gameState.player.shake, payload.melee ? 5.8 : 6.5);
        gameState.message = payload.melee ? "Cyber specimen made contact." : "You are taking fire.";
      }
      statusText.textContent = gameState.message;
      playGameSound("hit");
      syncHud();
      if (!gameState.ended && (payload.hp || 0) <= 0) {
        endGame(false, `You were dropped carrying ${gameState.lootCollected} ${getObjectiveLabels().plural} and $${gameState.cash}.`);
      }
    }
    return;
  }

  if (event.kind === (protocolApi.COMBAT_EVENT_KIND?.NOISE || "noise")) {
    if (!isLocalActor && payload.target && Number.isFinite(payload.target.x) && Number.isFinite(payload.target.y)) {
      emitSound(payload.target.x, payload.target.y, 360, "decoy", 1.4);
      spawnImpactBurst(payload.target.x, payload.target.y, ["#7aaed0", "#f5fbff", "rgba(74, 118, 142, 0.34)"], 4.4);
      spawnLightPulse(payload.target.x, payload.target.y, "decoy");
      playGameSound("decoy");
    }
    return;
  }

  if (event.kind === (protocolApi.COMBAT_EVENT_KIND?.MEDKIT || "medkit")) {
    if (!isLocalActor && actorState) {
      spawnImpactBurst(actorState.x, actorState.y, ["#0f8e79", "#c8fff1", "rgba(92, 214, 171, 0.35)"], 4.2);
    }
    return;
  }

  if (event.kind === (protocolApi.COMBAT_EVENT_KIND?.RELOAD || "reload")) {
    if (!isLocalActor) {
      const remote = getMutableRaidPlayerById(playerId);
      if (remote && typeof payload.durationMs === "number") {
        remote.reloadTimer = Math.max(0, payload.durationMs / 1000);
      }
    }
    return;
  }

  if (event.kind === (protocolApi.COMBAT_EVENT_KIND?.ABILITY || "ability")) {
    if (!isLocalActor && payload.ability === "cloak") {
      const remote = getMutableRaidPlayerById(playerId);
      if (remote) {
        remote.invisible = true;
        remote.abilityTimer = typeof payload.durationMs === "number" ? payload.durationMs / 1000 : remote.abilityTimer;
        remote.abilityCooldownTimer =
          typeof payload.cooldownMs === "number" ? payload.cooldownMs / 1000 : remote.abilityCooldownTimer;
      }
    }
    return;
  }

  if (event.kind === (protocolApi.COMBAT_EVENT_KIND?.ADMIN || "admin")) {
    if (!isLocalActor) {
      const remote = getMutableRaidPlayerById(playerId);
      if (remote) {
        applyAdminActionToActor(remote, payload.adminAction || "");
      }
    }
    return;
  }

  if (event.kind === (protocolApi.COMBAT_EVENT_KIND?.TAKEDOWN || "takedown")) {
    if (!isLocalActor && actorState) {
      actorState.angle = payload.angle || actorState.angle || 0;
      const target = getTakedownTargetForActor(actorState);
      if (target) {
        target.dead = true;
        target.deadTimer = 5.2;
        spawnImpactBurst(target.x, target.y, ["#f5f8fb", "#ff7a45", "rgba(126, 26, 45, 0.38)"], 4);
        spawnBloodBurst(target.x, target.y, 4, true, {
          kind: target.kind,
          angle: actorState.angle,
          force: 132,
        });
      }
    }
  }
}

function adoptHostAuthorityState(payload = {}) {
  if (!gameState) {
    return;
  }

  if (payload.world) {
    applyWorldState(payload.world);
  }
  if (payload.combat) {
    applyCombatSnapshotInternal(payload.combat, { force: true });
  }
}

function interpolateAngle(from, to, amount) {
  if (!Number.isFinite(from)) {
    return Number.isFinite(to) ? to : 0;
  }
  if (!Number.isFinite(to)) {
    return from;
  }

  return from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * clamp(amount, 0, 1);
}

function reconcileLocalPlayer(dt) {
  if (!gameState?.running || isRaidHost()) {
    return;
  }

  const player = gameState.player;
  if (!Number.isFinite(player.syncX) || !Number.isFinite(player.syncY)) {
    return;
  }

  const blendDurationMs = Math.max(
    Number(movementReconciliationConfig.localBlendMinMs) || 80,
    Math.min(
      Number(movementReconciliationConfig.localBlendMaxMs) || 120,
      Number(player.reconcileBlendMs) || Number(movementReconciliationConfig.localBlendMaxMs) || 120
    )
  );
  const correctionRate =
    Number(movementReconciliationConfig.localCorrectionRate) > 0 ? Number(movementReconciliationConfig.localCorrectionRate) : 12;
  const blend = clamp(dt * correctionRate * (100 / blendDurationMs), 0.08, 0.45);
  player.x += (player.syncX - player.x) * blend;
  player.y += (player.syncY - player.y) * blend;
  if (Number.isFinite(player.targetAngle)) {
    player.angle = interpolateAngle(player.angle, player.targetAngle, clamp(dt * 10, 0.08, 0.4));
  }

  if (Math.hypot(player.syncX - player.x, player.syncY - player.y) < 1) {
    player.x = player.syncX;
    player.y = player.syncY;
  }
}

function updateRemotePlayers(dt) {
  if (!gameState?.remotePlayers?.length) {
    return;
  }

  const interpolationDelayMs = Number(movementReconciliationConfig.remoteInterpolationDelayMs) || 120;
  const sampleTtlMs = Number(movementReconciliationConfig.remoteSampleTtlMs) || 1000;
  const nowMs = performance.now();
  const positionBlend = clamp(dt * 12, 0.08, 0.5);
  const angleBlend = dt * 10;
  for (const remote of gameState.remotePlayers) {
    if (Array.isArray(remote.networkSamples) && remote.networkSamples.length > 0) {
      remote.networkSamples = remote.networkSamples.filter((sample) => nowMs - sample.time <= sampleTtlMs);
      const renderTime = nowMs - interpolationDelayMs;
      let previousSample = remote.networkSamples[0];
      let nextSample = remote.networkSamples[remote.networkSamples.length - 1];

      for (let index = 1; index < remote.networkSamples.length; index += 1) {
        const sample = remote.networkSamples[index];
        if (sample.time <= renderTime) {
          previousSample = sample;
          continue;
        }
        nextSample = sample;
        break;
      }

      if (previousSample && nextSample) {
        const span = Math.max(1, nextSample.time - previousSample.time);
        const amount = nextSample.time === previousSample.time ? 1 : clamp((renderTime - previousSample.time) / span, 0, 1);
        remote.syncX = previousSample.x + (nextSample.x - previousSample.x) * amount;
        remote.syncY = previousSample.y + (nextSample.y - previousSample.y) * amount;
        remote.targetAngle = interpolateAngle(previousSample.angle, nextSample.angle, amount);
      }
    }

    if (!Number.isFinite(remote.x)) {
      remote.x = Number.isFinite(remote.syncX) ? remote.syncX : 0;
    }
    if (!Number.isFinite(remote.y)) {
      remote.y = Number.isFinite(remote.syncY) ? remote.syncY : 0;
    }
    if (!Number.isFinite(remote.syncX)) {
      remote.syncX = remote.x;
    }
    if (!Number.isFinite(remote.syncY)) {
      remote.syncY = remote.y;
    }
    remote.x += (remote.syncX - remote.x) * positionBlend;
    remote.y += (remote.syncY - remote.y) * positionBlend;

    if (Number.isFinite(remote.targetAngle)) {
      remote.angle = turnToward(Number.isFinite(remote.angle) ? remote.angle : remote.targetAngle, remote.targetAngle, angleBlend);
    }
  }
}

function updateRemoteReloads() {
  if (hasLiveNetworkSession()) {
    return;
  }

  if (!gameState?.remotePlayers?.length || !gameState?.remoteActionState) {
    return;
  }

  const now = performance.now() * 0.001;
  for (const remote of gameState.remotePlayers) {
    const tracker = gameState.remoteActionState[remote.id];
    if (!tracker?.reloadCompleteAt || now < tracker.reloadCompleteAt) {
      continue;
    }

    tracker.reloadCompleteAt = 0;
    remote.ammo = remote.magSize;
    const patch = getNetworkPatchForActor(remote, ["ammo", "magSize"]);
    if (patch) {
      applyPlayerPatchLocally(remote.id, patch);
      window.__raidRuntime?.publishPlayerPatch(remote.id, patch);
    }
  }
}

function getLevelTemplate(levelId = activeLayoutId) {
  return LEVEL_TEMPLATES[levelId] || LEVEL_TEMPLATES.freight;
}

function getObjectiveLabels(state = gameState) {
  const layout = getLevelTemplate(state?.levelId || activeLayoutId);
  return {
    singular: layout.objectiveSingular || "relay core",
    plural: layout.objectivePlural || "relay cores",
    short: layout.objectiveShort || "cores",
  };
}

function getNextLevelId(state = gameState) {
  const layout = getLevelTemplate(state?.levelId || activeLayoutId);
  return layout.nextLevelId || null;
}

function getStageTransitionMessage(levelId) {
  const layout = getLevelTemplate(levelId);
  return layout.transitionMessage || `${layout.name} underway.`;
}

function hasLiveBoss(state = gameState) {
  return Boolean(state?.bossRequired && state.enemies.some((enemy) => enemy.kind === "boss" && !enemy.dead));
}

function buildCarryState(state) {
  if (!state) {
    return null;
  }

  const player = state.player;
  return {
    hp: player.hp,
    maxHp: player.maxHp,
    ammo: player.ammo,
    magSize: player.magSize,
    shieldEquipped: player.shieldEquipped,
    shieldHp: player.shieldHp,
    medkits: player.medkits,
    noiseCharges: player.noiseCharges,
    quietMode: player.quietMode,
    adminInvisible: Boolean(player.adminInvisible),
    adminGodMode: Boolean(player.adminGodMode),
    cash: state.cash,
    heat: state.heat,
    heatScore: state.heatScore,
    runUpgrades: normalizeRunUpgrades(state.runUpgrades),
  };
}

function clampPlayerCells(player) {
  player.hp = clamp(player.hp, 0, player.maxHp);
  player.shieldHp = clamp(player.shieldHp, 0, player.maxShieldHp);
  if (player.maxShieldHp <= 0) {
    player.shieldEquipped = false;
    player.shieldHp = 0;
  }
}

function applyCellDamage(target, amount = 1) {
  if (!target || target.adminGodMode) {
    return;
  }

  const damage = Math.max(1, amount);

  for (let hit = 0; hit < damage; hit += 1) {
    if (target.shieldEquipped && target.shieldHp > 0) {
      target.shieldHp -= 1;
      if (target.shieldHp <= 0) {
        target.shieldHp = 0;
        target.shieldEquipped = false;
      }
    } else {
      target.hp -= 1;
    }
  }

  clampPlayerCells(target);
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
  enemy.cooldown = Math.min(enemy.cooldown, enemy.fireRate * 0.4);
  if (enemy.shieldEquipped || enemy.kind === "guard") {
    enemy.shieldEquipped = true;
    enemy.maxShieldHp += 12;
    enemy.shieldHp = Math.max(enemy.shieldHp, enemy.maxShieldHp);
    enemy.shieldFlash = 1;
  }
  return true;
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

function registerHeat(amount, reason = "", options = {}) {
  if (!gameState || !isRaidHost() || hasLiveNetworkSession() || !(amount > 0)) {
    return;
  }

  gameState.heatScore = Math.max(0, (gameState.heatScore || 0) + amount);
  if (!options.silent && reason) {
    gameState.lastHeatTrigger = reason;
  }
  updateHeat();
}

function getShotHeatGain(loadout) {
  if (!loadout) {
    return 0.45;
  }

  return clamp(0.18 + loadout.soundRadius / 520 + (loadout.pellets > 1 ? 0.12 : 0), 0.3, 0.95);
}

function spawnHeatReinforcement(kind = "rusher", options = {}) {
  if (!gameState || !isRaidHost()) {
    return null;
  }

  const radius = kind === "guard" ? 17 : 15;
  const occupied = [
    { x: gameState.player.x, y: gameState.player.y, radius: 280 },
    ...gameState.enemies.filter((enemy) => !enemy.dead).map((enemy) => ({ x: enemy.x, y: enemy.y, radius: enemy.radius + 26 })),
  ];
  const pool = (spawnPools.enemy || []).filter((entry) => distance(entry, gameState.player) > 260);
  const spawn = pickSpawnPoint(pool.length ? pool : spawnPools.enemy, radius, occupied, {
    extraPadding: kind === "guard" ? 96 : 82,
    fallbackAttempts: 120,
  });
  const enemyId = createEnemyId(`${gameState.levelId}-heat`, gameState.heatSpawnCounter || gameState.enemies.length);
  gameState.heatSpawnCounter = (gameState.heatSpawnCounter || 0) + 1;
  const enemy = createEnemy(enemyId, spawn.x, spawn.y, kind);
  enemy.tactic = kind === "guard" ? "anchor" : options.flank ? "flankRight" : "assault";
  enemy.roleIndex = gameState.enemies.length;
  enemy.squadId = `${gameState.levelId}-heat-${gameState.heat}`;
  enemy.squadRole = kind === "guard" ? "shieldLead" : enemy.tactic;
  enemy.state = "investigate";
  enemy.investigateX = gameState.player.x;
  enemy.investigateY = gameState.player.y;
  enemy.searchTimer = 4.4;

  if (options.shield || kind === "guard") {
    enemy.shieldEquipped = true;
    enemy.shieldHp = enemy.maxShieldHp;
  }

  gameState.enemies.push(enemy);
  return enemy;
}

function orderHeatSweep(duration = 3.8) {
  if (!gameState) {
    return;
  }

  for (const enemy of gameState.enemies) {
    if (enemy.dead || enemy.kind === "boss") {
      continue;
    }

    enemy.investigateX = gameState.player.x + (Math.random() - 0.5) * 110;
    enemy.investigateY = gameState.player.y + (Math.random() - 0.5) * 110;
    enemy.searchTimer = Math.max(enemy.searchTimer, duration);
    if (enemy.state !== "hunt") {
      enemy.state = "investigate";
    }
  }
}

function applyHeatEscalation() {
  if (!gameState || !isRaidHost() || hasLiveNetworkSession()) {
    return;
  }

  const targetTier = Math.max(1, Math.min(4, gameState.heat));
  if (targetTier <= gameState.heatTierApplied) {
    return;
  }

  for (let tier = gameState.heatTierApplied + 1; tier <= targetTier; tier += 1) {
    const preferredPool =
      tier % 2 === 0
        ? gameState.enemies.filter((enemy) => !enemy.dead && enemy.kind === "guard" && !enemy.elite)
        : gameState.enemies.filter((enemy) => !enemy.dead && enemy.kind === "rusher" && !enemy.elite);
    const fallbackPool = gameState.enemies.filter(
      (enemy) => !enemy.dead && enemy.kind !== "boss" && enemy.kind !== "specimen" && !enemy.elite
    );
    const candidate = [...(preferredPool.length ? preferredPool : fallbackPool)].sort(
      (a, b) => distance(a, gameState.player) - distance(b, gameState.player)
    )[0];

    let escalated = false;

    if (candidate && promoteEnemyToElite(candidate, tier)) {
      escalated = true;
      gameState.message =
        candidate.kind === "guard" ? "Heat spike. Elite shield unit deployed." : "Heat spike. Elite rusher incoming.";
    }

    if (tier === 3) {
      const reinforcement = spawnHeatReinforcement(gameState.levelId === "reactor" ? "guard" : "rusher", {
        shield: gameState.levelId === "reactor",
      });
      if (reinforcement) {
        escalated = true;
        gameState.message = "Heat spike. Reinforcements just entered the district.";
      }
    }

    if (tier === 4) {
      const rusher = spawnHeatReinforcement("rusher", { flank: true });
      const guard = spawnHeatReinforcement("guard", { shield: true });
      orderHeatSweep(4.8);
      if (rusher || guard) {
        escalated = true;
        gameState.message = "District lockdown escalating. Multiple hostile reinforcements inbound.";
      }
    }

    if (escalated) {
      statusText.textContent = gameState.message;
      playGameSound("alert");
    }
  }

  gameState.heatTierApplied = targetTier;
}

function bulletCellDamage(bullet) {
  return bullet.damage >= 22 ? 2 : 1;
}

function restoreShieldCells(player) {
  if (!player.canUseShield || player.maxShieldHp <= 0) {
    return false;
  }

  player.shieldEquipped = true;
  player.shieldHp = player.maxShieldHp;
  player.shieldFlash = 1;
  return true;
}

function renderCells(container, count, filled, className, disabled = false) {
  if (!container) {
    return;
  }

  container.classList.toggle("is-disabled", Boolean(disabled));
  const total = Math.max(0, count);
  while (container.children.length < total) {
    const cell = document.createElement("span");
    cell.className = `cell ${className}`;
    container.appendChild(cell);
  }
  while (container.children.length > total) {
    container.removeChild(container.lastElementChild);
  }

  const roundedFilled = Math.max(0, Math.floor(filled));
  for (let index = 0; index < total; index += 1) {
    container.children[index].classList.toggle("is-filled", index < roundedFilled);
  }
}

function setHudText(key, node, value) {
  if (!node) {
    return;
  }
  const normalized = String(value ?? "");
  if (hudRenderCache[key] === normalized) {
    return;
  }
  hudRenderCache[key] = normalized;
  node.textContent = normalized;
}

function setHudStyle(key, node, property, value) {
  if (!node) {
    return;
  }
  const normalized = String(value ?? "");
  const cacheKey = `${key}:${property}`;
  if (hudRenderCache[cacheKey] === normalized) {
    return;
  }
  hudRenderCache[cacheKey] = normalized;
  node.style[property] = normalized;
}

function setHudClass(key, node, className, enabled) {
  if (!node) {
    return;
  }
  const normalized = Boolean(enabled);
  const cacheKey = `${key}:class:${className}`;
  if (hudRenderCache[cacheKey] === normalized) {
    return;
  }
  hudRenderCache[cacheKey] = normalized;
  node.classList.toggle(className, normalized);
}

function getCardinalDirectionLabel(angle) {
  const directions = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];
  const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const index = Math.round(normalized / (Math.PI / 4)) % directions.length;
  return directions[index];
}

function getExtractionHudLabel(state) {
  if (!state?.player) {
    return "Extract offline";
  }

  if (state.requiredLoot > 0 && state.lootCollected < state.requiredLoot) {
    const remaining = state.requiredLoot - state.lootCollected;
    return `${remaining} core${remaining === 1 ? "" : "s"} before evac`;
  }

  const zoneCenterX = extractionZone.x + extractionZone.w * 0.5;
  const zoneCenterY = extractionZone.y + extractionZone.h * 0.5;
  const dx = zoneCenterX - state.player.x;
  const dy = zoneCenterY - state.player.y;
  const distanceToExtract = Math.round(Math.hypot(dx, dy));

  if (distanceToExtract <= Math.max(extractionZone.w, extractionZone.h) * 0.5 + 18) {
    return state.bossRequired && hasLiveBoss(state) ? "Warden still blocking evac" : "Inside extract lane";
  }

  return `Extract ${getCardinalDirectionLabel(Math.atan2(dy, dx))} • ${distanceToExtract}m`;
}

function getSquadHudLabel(state) {
  const remotePlayers = state?.remotePlayers || [];
  const squadSize = 1 + remotePlayers.length;
  const remoteLiveCount = remotePlayers.filter((player) => player.running !== false && (player.hp ?? 1) > 0).length;
  const localLiveCount = state?.player && state.player.hp > 0 ? 1 : 0;
  return `Squad ${localLiveCount + remoteLiveCount} / ${squadSize} live`;
}

function getAbilityStatusText(player) {
  if (player.ability === "cloak") {
    if (player.abilityTimer > 0) {
      return "cloak live";
    }
    if (player.abilityCooldownTimer > 0) {
      return `cloak ${player.abilityCooldownTimer.toFixed(1)}s`;
    }
    return "cloak ready";
  }

  return "passive";
}

function createLevelLoot(layout, occupied) {
  const loot = [];
  const cashValues = layout.id === "reactor" ? [180, 220, 260, 320] : [120, 140, 160, 180, 220];
  const shieldCount = layout.id === "reactor" ? 1 : 2;
  const medkitCount = layout.id === "reactor" ? 2 : 3;
  const noiseCount = layout.id === "reactor" ? 2 : 3;
  const strictCoreCandidates = (layout.spawnPools?.core || []).slice().sort(() => Math.random() - 0.5);

  for (let index = 0; index < layout.requiredLoot; index += 1) {
    let spawn = null;
    const strictIndex = strictCoreCandidates.findIndex(
      (candidate) =>
        occupied.every((entry) => distance(candidate, entry) >= 14 + entry.radius + 10) &&
        !circleIntersectsRect({ x: candidate.x, y: candidate.y, r: 24 }, extractionZone)
    );
    if (strictIndex >= 0) {
      spawn = strictCoreCandidates.splice(strictIndex, 1)[0];
    }
    if (!spawn) {
      spawn = pickSpawnPoint(layout.spawnPools?.core || spawnPools.core, 14, occupied, { extraPadding: 8 });
    }
    const entry = createLoot(createLootId("core", index), spawn.x, spawn.y, "core", 1);
    occupied.push({ x: entry.x, y: entry.y, radius: entry.radius });
    loot.push(entry);
  }

  cashValues.forEach((value, index) => {
    const spawn = pickSpawnPoint(spawnPools.cash, 11, occupied, { extraPadding: 20 });
    const entry = createLoot(createLootId("cash", index), spawn.x, spawn.y, "cash", value);
    occupied.push({ x: entry.x, y: entry.y, radius: entry.radius });
    loot.push(entry);
  });

  Array.from({ length: shieldCount }, (_, index) => index).forEach((index) => {
    const spawn = pickSpawnPoint(spawnPools.shield, 13, occupied, { extraPadding: 30 });
    const entry = createLoot(createLootId("shield", index), spawn.x, spawn.y, "shield", 42);
    occupied.push({ x: entry.x, y: entry.y, radius: entry.radius });
    loot.push(entry);
  });

  Array.from({ length: medkitCount }, (_, index) => index).forEach((index) => {
    const spawn = pickSpawnPoint(spawnPools.medkit, 12, occupied, { extraPadding: 22 });
    const entry = createLoot(createLootId("medkit", index), spawn.x, spawn.y, "medkit", 1);
    occupied.push({ x: entry.x, y: entry.y, radius: entry.radius });
    loot.push(entry);
  });

  Array.from({ length: noiseCount }, (_, index) => index).forEach((index) => {
    const spawn = pickSpawnPoint(spawnPools.noise, 11, occupied, { extraPadding: 20 });
    const entry = createLoot(createLootId("noise", index), spawn.x, spawn.y, "noise", 1);
    occupied.push({ x: entry.x, y: entry.y, radius: entry.radius });
    loot.push(entry);
  });

  return loot;
}

function makeState(options = {}) {
  const { levelId = activeLayoutId, carry = null, previous = null, preserveRunState = false } = options;
  const layout = getLevelTemplate(levelId);
  const loadout = CLASS_LOADOUTS[selectedClass] || CLASS_LOADOUTS.stealther;
  const carriedHeat = preserveRunState ? Math.max(1, Math.min(4, carry?.heat ?? previous?.heat ?? 1)) : 1;
  const carriedHeatScore = preserveRunState ? Math.max(0, carry?.heatScore ?? previous?.heatScore ?? 0) : 0;
  const carriedRunUpgrades = preserveRunState ? normalizeRunUpgrades(carry?.runUpgrades ?? previous?.runUpgrades) : normalizeRunUpgrades();
  resetBuildingState();
  const occupied = [];
  const playerSpawn = pickSpawnPoint(spawnPools.player, 15, occupied, { extraPadding: 28 });
  occupied.push({ ...playerSpawn, radius: 15 });
  const enemySpawnOccupied = [...occupied, { x: playerSpawn.x, y: playerSpawn.y, radius: 290 }];
  const loot = createLevelLoot(layout, occupied);

  const roamingEnemies = (layout.enemyDefinitions || []).map((definition, index) => {
    const spawn = pickSpawnPoint(spawnPools.enemy, definition.radius, enemySpawnOccupied, {
      extraPadding: definition.padding,
    });
    const enemy = createEnemy(createEnemyId(`${layout.id}-roam`, index), spawn.x, spawn.y, definition.kind);
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
    enemy.squadId = `${layout.id}-roam-${Math.floor(index / 3)}`;
    enemy.squadRole = definition.kind === "guard" ? "shieldLead" : enemy.tactic;
    occupied.push({ x: enemy.x, y: enemy.y, radius: enemy.radius });
    enemySpawnOccupied.push({ x: enemy.x, y: enemy.y, radius: enemy.radius });
    return enemy;
  });

  const interiorSquad = buildings.flatMap((building) =>
    building.squadSpawns.map((definition, index) => {
      const enemy = createEnemy(createEnemyId(building.id, index), definition.x, definition.y, definition.kind);
      enemy.tactic = definition.tactic;
      enemy.roleIndex = roamingEnemies.length + index;
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

  const fixedEnemies = (layout.fixedEnemies || []).map((definition, index) => {
    const enemy = createEnemy(definition.id || createEnemyId(`${layout.id}-fixed`, index), definition.x, definition.y, definition.kind);
    enemy.tactic = definition.tactic || "anchor";
    enemy.roleIndex = roamingEnemies.length + interiorSquad.length + index;
    enemy.state = definition.state || "hunt";
    enemy.squadId = definition.squadId || `${layout.id}-boss`;
    enemy.squadRole = definition.squadRole || enemy.tactic;
    enemy.aimAngle = Math.PI * 0.5;
    if (definition.shield) {
      enemy.shieldEquipped = true;
      enemy.shieldHp = enemy.maxShieldHp;
    }
    enemy.contained = Boolean(definition.contained);
    enemy.hidden = Boolean(definition.hidden);
    enemy.zoneId = definition.zoneId || null;
    enemy.releaseHeat = typeof definition.releaseHeat === "number" ? definition.releaseHeat : enemy.releaseHeat;
    enemy.faction = definition.faction || getEnemyFaction(enemy);
    return enemy;
  });

  const state = {
    running: preserveRunState,
    ended: false,
    levelId: layout.id,
    levelName: layout.name,
    elapsed: 0,
    duration: layout.duration,
    spawnGrace: 2.6,
    heat: carriedHeat,
    heatScore: carriedHeatScore,
    heatTierApplied: 1,
    lastHeatTrigger: "",
    heatSpawnCounter: previous?.heatSpawnCounter ?? 0,
    musicAlertTimer: preserveRunState ? Math.max(0, previous?.musicAlertTimer ?? 0) : 0,
    awareness: "open",
    lootCollected: 0,
    requiredLoot: layout.requiredLoot,
    bossRequired: layout.bossRequired,
    cash: carry?.cash ?? loadout.cash,
    camera: { x: 0, y: 0 },
    message: layout.objective,
    particles: [],
    soundEvents: [],
    dynamicLights: [],
    prepApplied: preserveRunState,
    runUpgrades: carriedRunUpgrades,
    pendingTransitionLevel: null,
    remotePlayers: previous?.remotePlayers || [],
    remoteActionState: previous?.remoteActionState || {},
    localNetworkId: previous?.localNetworkId || null,
    networkPresence: previous?.networkPresence || 1,
    networkPhase: previous?.networkPhase || "lobby",
    serverCombatSeedReady: false,
    serverCombatSeedLevelId: null,
    isRaidHost: previous?.isRaidHost ?? true,
    predictedBullets: [],
    player: {
      x: playerSpawn.x,
      y: playerSpawn.y,
      radius: 15,
      spriteVariant: null,
      displayName: normalizeProfileDisplayName(playerProfile.displayName),
      title: normalizeProfileTitle(playerProfile.title),
      speed: loadout.speed,
      sprintSpeed: loadout.sprintSpeed,
      hp: clamp(carry?.hp ?? loadout.hpCells, 0, loadout.hpCells),
      maxHp: loadout.hpCells,
      ammo: carry?.ammo ?? loadout.ammo,
      magSize: carry?.magSize ?? loadout.ammo,
      reloadTime: loadout.reloadTime,
      reloadTimer: 0,
      shotCooldown: 0,
      shotRate: loadout.shotRate,
      lightExposure: 0,
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
      shieldEquipped: loadout.canUseShield ? Boolean(carry?.shieldEquipped && (carry?.shieldHp ?? 0) > 0) : false,
      shieldHp: loadout.canUseShield ? clamp(carry?.shieldHp ?? 0, 0, loadout.shieldCells) : 0,
      maxShieldHp: loadout.shieldCells,
      shieldFlash: 0,
      quietMode: carry?.quietMode ?? false,
      canUseShield: loadout.canUseShield,
      medkits: carry?.medkits ?? loadout.medkits,
      noiseCharges: carry?.noiseCharges ?? loadout.noiseCharges,
      quietMultiplier: loadout.quietMultiplier,
      weapon: {
        className: selectedClass,
        displayName: loadout.name,
        label: loadout.weaponLabel,
        bulletSpeed: loadout.bulletSpeed,
        damage: loadout.damage,
        pellets: loadout.pellets,
        spread: loadout.spread,
        recoil: loadout.recoil,
        soundRadius: loadout.soundRadius,
      },
      ability: loadout.ability,
      abilityCooldown: loadout.abilityCooldown,
      abilityDuration: loadout.abilityDuration,
      abilityTimer: 0,
      abilityCooldownTimer: 0,
      adminInvisible: Boolean(carry?.adminInvisible),
      adminGodMode: Boolean(carry?.adminGodMode),
      invisible: false,
      knifeTimer: 0,
      knifeReady: false,
    },
    bullets: [],
    enemyBullets: [],
    enemies: [...roamingEnemies, ...interiorSquad, ...fixedEnemies],
    loot,
  };

  applyRunUpgradeEffects(state.player, state.runUpgrades, selectedClass);
  refreshPlayerInvisibility(state.player);
  return state;
}

function beginLevel(levelId, options = {}) {
  const { preservePlayer = false, preserveRunState = false } = options;
  const previous = gameState;
  const carry = preservePlayer ? buildCarryState(previous) : null;
  hudFrameAccumulator = 0;

  applyLayoutTemplate(levelId);
  gameState = makeState({ levelId, carry, previous, preserveRunState });
  if (preserveRunState && isRaidHost()) {
    applyHeatEscalation();
  }
  syncAdminDeckUi();
  syncHud();

  if (preserveRunState && isRaidHost()) {
    window.__raidRuntime?.publishWorldState?.(exportWorldState());
  }
}

function resetGame(options = {}) {
  const { preserveMusic = false } = options;
  beginLevel("freight");
  if (gameState) {
    gameState.networkPhase = "lobby";
  }
  setRestartUiState("idle", { readyIds: [], message: "" });
  syncAdminDeckUi();
  syncHud();
  syncShopUi();
  startOverlay.classList.add("is-visible");
  endOverlay.classList.remove("is-visible");
  breachOverlay?.classList.remove("is-visible");
  setMusicDeckVisible(false);
  if (!preserveMusic) {
    stopGameMusic();
    syncPreferredMusic();
  }
}

function startGame() {
  if (!gameState) {
    resetGame();
  }

  applyStagedPrepToCurrentRun();
  const layout = getLevelTemplate(gameState.levelId);
  gameState.running = true;
  gameState.ended = false;
  gameState.networkPhase = "running";
  gameState.elapsed = 0;
  gameState.spawnGrace = 2.6;
  gameState.awareness = "open";
  gameState.message = `${gameState.player.weapon.displayName} live with ${gameState.player.weapon.label}. Use the nearby cover, keep heat low, and ${layout.extractionPrompt.toLowerCase()}`;
  statusText.textContent = gameState.message;
  setMusicDeckVisible(false);
  setRestartUiState("live", { readyIds: [] });
  syncPreferredMusic();
  startOverlay.classList.remove("is-visible");
  endOverlay.classList.remove("is-visible");
  breachOverlay?.classList.remove("is-visible");
  if (isRaidHost()) {
    window.__raidRuntime?.publishWorldState?.(exportWorldState());
  }
  syncHud();
}

function endGame(success, reason) {
  gameState.running = false;
  gameState.ended = true;
  if (success) {
    awardProfileCredits(gameState.cash);
  }
  endOverlay.classList.add("is-visible");
  breachOverlay?.classList.remove("is-visible");
  endTag.textContent = success ? "raid complete" : "raid failed";
  endTitle.textContent = success ? "Extraction Confirmed" : "Operator Lost";
  endSummary.textContent = `${reason} ${success ? "Operator:" : "Last signal:"} ${getProfileSignature()}`;
  statusText.textContent = reason;
  setMusicDeckVisible(false);
  setRestartUiState("dead", {
    readyIds: [],
    message: (gameState.networkPresence || 1) > 1 ? "Press Run It Back to request a co-op restart." : "Press Run It Back to restart the raid.",
  });
  const endHoldDuration = getAwarenessHoldDuration(gameState.awareness, gameState.heat);
  if (endHoldDuration > 0) {
    gameState.musicAlertTimer = Math.max(gameState.musicAlertTimer || 0, endHoldDuration);
  }
  syncPreferredMusic();
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

function spawnBulletCasings(originX, originY, facingAngle, options = {}) {
  if (!gameState) {
    return;
  }

  const {
    count = 1,
    spread = 0.35,
    speedMin = 72,
    speedMax = 138,
    lifeMin = 0.8,
    lifeMax = 1.35,
    sizeMin = 2.6,
    sizeMax = 4.2,
    colorSet = ["#d8bb63", "#b98b35", "#7f5a1f"],
    lateralBias = 1,
  } = options;

  const ejectBaseAngle = facingAngle + lateralBias * Math.PI * 0.5;
  for (let index = 0; index < count; index += 1) {
    const angle = ejectBaseAngle + (Math.random() - 0.5) * spread * 2;
    const speed = speedMin + Math.random() * (speedMax - speedMin);
    const life = lifeMin + Math.random() * (lifeMax - lifeMin);
    const width = sizeMin + Math.random() * (sizeMax - sizeMin);
    const height = Math.max(1.4, width * (0.32 + Math.random() * 0.12));
    gameState.particles.push({
      x: originX + Math.cos(angle) * (8 + Math.random() * 8),
      y: originY + Math.sin(angle) * (8 + Math.random() * 8),
      vx: Math.cos(angle) * speed + Math.cos(facingAngle) * 12,
      vy: Math.sin(angle) * speed + Math.sin(facingAngle) * 12 - 8,
      life,
      maxLife: life,
      color: colorSet[Math.floor(Math.random() * colorSet.length)],
      size: width,
      shape: "casing",
      width,
      height,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 15,
      drag: 0.9,
      gravity: 220,
    });
  }
}

function spawnCrateDebris(crate, intensity = 1, burst = "hit") {
  if (!gameState || !crate) {
    return;
  }

  const centerX = crate.x + crate.w * 0.5;
  const centerY = crate.y + crate.h * 0.5;
  const pieceCount = burst === "break" ? 16 : 5 + Math.round(intensity * 2);
  const baseSpeed = burst === "break" ? 170 : 80;
  const lifeBase = burst === "break" ? 1.4 : 0.5;
  const colors = ["#f0d1a5", "#b37a3e", "#8a5c2d", "#5e3920"];

  for (let index = 0; index < pieceCount; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = baseSpeed + Math.random() * baseSpeed * 0.8;
    const width = 6 + Math.random() * (burst === "break" ? 11 : 7);
    const height = 2 + Math.random() * 4;
    const life = lifeBase + Math.random() * (burst === "break" ? 0.9 : 0.35);

    gameState.particles.push({
      x: centerX + (Math.random() - 0.5) * crate.w * 0.4,
      y: centerY + (Math.random() - 0.5) * crate.h * 0.4,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.max(2, height),
      shape: "debris",
      width,
      height,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * (burst === "break" ? 10 : 6),
      drag: burst === "break" ? 0.88 : 0.8,
    });
  }
}

function spawnGoreDecal(x, y, intensity = 1, slash = false, options = {}) {
  const palette = options.palette || getBloodPalette(options.kind, slash);
  const shape = options.shape || (slash ? "slash" : "pool");
  gameState.particles.push({
    x,
    y,
    vx: (Math.random() - 0.5) * 16,
    vy: (Math.random() - 0.5) * 16,
    life: slash ? 4.6 : 8.5 + Math.random() * 2.5,
    maxLife: slash ? 4.6 : 11,
    color:
      options.color ||
      (shape === "wallstain"
        ? "rgba(96, 18, 28, 0.48)"
        : slash
          ? "rgba(122, 26, 36, 0.42)"
          : "rgba(111, 18, 28, 0.56)"),
    accentColor: palette[palette.length - 1],
    size: 7 + intensity * 4 + Math.random() * 4,
    staticScale: 0.985,
    sticky: true,
    shape,
    angle: options.angle ?? Math.random() * Math.PI * 2,
    width: options.width,
    height: options.height,
    grow: options.grow ?? (shape === "pool" ? 2.2 + intensity * 0.9 : shape === "wallstain" ? 0.4 : 0),
  });
}

function findNearbyBloodSurface(x, y, maxDistance = 26) {
  let best = null;

  for (const obstacle of getWorldObstacles()) {
    if (obstacle.kind === "window") {
      continue;
    }
    const closestX = clamp(x, obstacle.x, obstacle.x + obstacle.w);
    const closestY = clamp(y, obstacle.y, obstacle.y + obstacle.h);
    const hitDistance = Math.hypot(x - closestX, y - closestY);
    if (hitDistance > maxDistance) {
      continue;
    }
    if (!best || hitDistance < best.distance) {
      best = { obstacle, x: closestX, y: closestY, distance: hitDistance };
    }
  }

  return best;
}

function spawnWallBloodSplat(x, y, angle, kind = "rusher", intensity = 1) {
  const hit = findNearbyBloodSurface(x, y, 30 + intensity * 10);
  if (!hit) {
    return;
  }

  const palette = getBloodPalette(kind, false);
  spawnGoreDecal(hit.x, hit.y, 0.85 + intensity * 0.45, false, {
    kind,
    palette,
    shape: "wallstain",
    angle,
    width: 10 + intensity * 8,
    height: 4 + intensity * 2,
    color: "rgba(92, 15, 24, 0.44)",
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
  const layout = getLevelTemplate(state.levelId);
  const objectiveLabels = getObjectiveLabels(state);
  const remaining = Math.max(0, state.duration - state.elapsed);
  const minutes = Math.floor(remaining / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(remaining % 60)
    .toString()
    .padStart(2, "0");

  setHudText("timer", timerValue, `${minutes}:${seconds}`);
  setHudText(
    "loot",
    lootValue,
    state.bossRequired
    ? hasLiveBoss(state)
      ? "warden active"
      : "warden down"
    : `${state.lootCollected} / ${state.requiredLoot} ${objectiveLabels.short}`
  );
  setHudText("cash", cashValue, `$${state.cash}`);
  setHudText("heat", heatValue, `${state.heat}`);
  if (brandTitle) {
    setHudText("brandTitle", brandTitle, layout.name);
  }
  if (operatorMark) {
    setHudText("operatorMark", operatorMark, getProfileSignature());
  }
  if (squadValue) {
    setHudText("squadValue", squadValue, getSquadHudLabel(state));
  }
  if (extractionValue) {
    setHudText("extractionValue", extractionValue, getExtractionHudLabel(state));
  }

  const healthRatio = state.player.hp / state.player.maxHp;
  setHudText("healthValue", healthValue, `${Math.max(0, Math.ceil(state.player.hp))} / ${state.player.maxHp}`);
  if (healthFill) {
    setHudStyle("healthFill", healthFill, "width", `${healthRatio * 100}%`);
  }
  renderCells(healthCells, state.player.maxHp, state.player.hp, "health-cell");

  const ammoRatio = state.player.magSize > 0 ? clamp(state.player.ammo / state.player.magSize, 0, 1) : 0;
  setHudText("ammoValue", ammoValue, state.player.reloadTimer > 0 ? "reloading..." : `${state.player.ammo} / ${state.player.magSize}`);
  setHudStyle("ammoFill", ammoFill, "width", `${ammoRatio * 100}%`);
  if (reticleAmmoRing) {
    const dashOffset = RETICLE_AMMO_RING_CIRCUMFERENCE * (1 - ammoRatio);
    setHudStyle(
      "reticleAmmoRing",
      reticleAmmoRing,
      "stroke-dasharray",
      `${RETICLE_AMMO_RING_CIRCUMFERENCE.toFixed(2)}`
    );
    setHudStyle(
      "reticleAmmoRing",
      reticleAmmoRing,
      "stroke-dashoffset",
      `${dashOffset.toFixed(2)}`
    );
    setHudStyle(
      "reticleAmmoRing",
      reticleAmmoRing,
      "opacity",
      state.player.magSize > 0 ? "1" : "0"
    );
  }
  setHudClass("reticle", reticle, "is-reloading", state.player.reloadTimer > 0);
  setHudClass("reticle", reticle, "is-empty", state.player.ammo <= 0 && state.player.reloadTimer <= 0);

  const shieldRatio = state.player.shieldEquipped ? state.player.shieldHp / state.player.maxShieldHp : 0;
  setHudText(
    "shieldValue",
    shieldValue,
    state.player.maxShieldHp > 0
      ? state.player.shieldEquipped
        ? `${Math.max(0, Math.ceil(state.player.shieldHp))} / ${state.player.maxShieldHp}`
        : "offline"
      : "n/a"
  );
  if (shieldFill) {
    setHudStyle("shieldFill", shieldFill, "width", `${shieldRatio * 100}%`);
    setHudStyle("shieldFill", shieldFill, "opacity", state.player.shieldEquipped ? "1" : "0.18");
  }
  renderCells(
    shieldCells,
    state.player.maxShieldHp,
    state.player.shieldHp,
    "shield-cell",
    state.player.maxShieldHp <= 0
  );

  const awarenessMap = {
    stealth: { label: "stealth", color: "#0f8e79" },
    open: { label: "open", color: "#566778" },
    suspicious: { label: "suspicious", color: "#b88937" },
    spotted: { label: "spotted", color: "#b54a64" },
    lost: { label: "lost contact", color: "#677888" },
  };
  const awareness = awarenessMap[state.awareness] || awarenessMap.open;
  setHudText("stealthValue", stealthValue, awareness.label);
  setHudStyle("stealthValue", stealthValue, "color", awareness.color);
  if (abilityValue) {
    setHudText("abilityValue", abilityValue, getAbilityStatusText(state.player));
    setHudStyle("abilityValue", abilityValue, "color", state.player.abilityTimer > 0 ? "var(--signal)" : "var(--muted)");
  }
  if (stealthDetailValue) {
    const quietMovement = Boolean(state.player.quietMode && !keys.has("shift"));
    const noiseLabel = state.player.invisible
      ? "noise ghosted"
      : quietMovement
        ? "noise low"
        : keys.has("shift")
          ? "noise loud"
          : "noise med";
    const eyesOnPlayer = getEnemiesSeeingPlayerCount(state);
    const searchingEnemies = state.enemies.filter((enemy) => !enemy.dead && (enemy.state === "investigate" || enemy.state === "search")).length;
    const lightPercent = Math.round(clamp(state.player.lightExposure || 0, 0, 1) * 100);
    setHudText("stealthDetailValue", stealthDetailValue, `${noiseLabel} | eyes ${eyesOnPlayer} | light ${lightPercent}% | alert ${searchingEnemies}`);
    setHudStyle(
      "stealthDetailValue",
      stealthDetailValue,
      "color",
      eyesOnPlayer > 0
        ? "var(--danger)"
        : searchingEnemies > 0
          ? "var(--warning)"
          : state.player.invisible
            ? "var(--signal)"
            : "var(--muted)"
    );
  }
  setHudText("medkitValue", medkitValue, `${state.player.medkits}`);
  setHudText("noiseValue", noiseValue, `${state.player.noiseCharges}`);
  syncRestartOverlayUi();
  syncDebugOverlay();
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

function fireBullet(origin, angle, speed, fromEnemy, damage, meta = {}) {
  const className = fromEnemy ? "enemy" : origin.weapon?.className || "stealther";
  const visuals =
    className === "breacher"
      ? {
          outer: "rgba(255, 199, 118, 0.34)",
          core: "rgba(255, 238, 188, 0.96)",
          head: "#fff0c7",
          tail: "#a46a2c",
          width: 7,
          innerWidth: 3.2,
        }
      : className === "marksman"
        ? {
            outer: "rgba(157, 211, 255, 0.34)",
            core: "rgba(228, 245, 255, 0.96)",
            head: "#eef8ff",
            tail: "#4d7698",
            width: 6.2,
            innerWidth: 2.4,
          }
        : className === "enemy"
          ? {
              outer: "rgba(255, 112, 142, 0.3)",
              core: "rgba(255, 220, 230, 0.96)",
              head: "#ffdce5",
              tail: "#a83f57",
              width: 6.6,
              innerWidth: 2.8,
            }
          : {
              outer: "rgba(164, 241, 213, 0.28)",
              core: "rgba(226, 255, 246, 0.94)",
              head: "#f1fff9",
              tail: "#2f7d68",
              width: 5.8,
              innerWidth: 2.2,
            };

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
    trail: visuals.tail,
    outerColor: visuals.outer,
    coreColor: visuals.core,
    headColor: visuals.head,
    trailWidth: visuals.width,
    innerTrailWidth: visuals.innerWidth,
    ownerId: meta.ownerId || null,
    ownerEnemyId: meta.ownerEnemyId || null,
    ownerFaction: meta.ownerFaction || null,
    bulletId: meta.bulletId || (fromEnemy ? `${meta.ownerEnemyId || "enemy"}-${++enemyBulletCounter}` : null),
    shotToken: meta.shotToken || null,
  };

  if (fromEnemy) {
    gameState.enemyBullets.push(bullet);
  } else {
    gameState.bullets.push(bullet);
  }
}

function firePredictedBullet(origin, angle, speed, damage, meta = {}) {
  const className = origin.weapon?.className || "stealther";
  const visuals =
    className === "breacher"
      ? { outer: "rgba(255, 199, 118, 0.28)", core: "rgba(255, 238, 188, 0.9)", head: "#fff0c7", tail: "#a46a2c" }
      : className === "marksman"
        ? { outer: "rgba(157, 211, 255, 0.28)", core: "rgba(228, 245, 255, 0.92)", head: "#eef8ff", tail: "#4d7698" }
        : { outer: "rgba(164, 241, 213, 0.24)", core: "rgba(226, 255, 246, 0.9)", head: "#f1fff9", tail: "#2f7d68" };

  gameState.predictedBullets.push({
    x: origin.x + Math.cos(angle) * (origin.radius + 6),
    y: origin.y + Math.sin(angle) * (origin.radius + 6),
    prevX: origin.x,
    prevY: origin.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 2.6,
    damage,
    life: 0.16,
    trail: visuals.tail,
    outerColor: visuals.outer,
    coreColor: visuals.core,
    headColor: visuals.head,
      trailWidth: 5.4,
      innerTrailWidth: 2,
      ownerId: meta.ownerId || null,
      shotToken: meta.shotToken || null,
    });
  }

function getLoadoutForClass(className) {
  const key = String(className || "").toLowerCase();
  return CLASS_LOADOUTS[key] || CLASS_LOADOUTS.stealther;
}

function getCasingProfileForShooter(kind, className = null) {
  if (kind === "enemy") {
    if (className === "guard") {
      return { count: 1, speedMin: 80, speedMax: 144, sizeMin: 2.7, sizeMax: 4 };
    }
    if (className === "boss") {
      return { count: 2, speedMin: 92, speedMax: 166, sizeMin: 3.2, sizeMax: 4.8 };
    }
    return { count: 1, speedMin: 76, speedMax: 132, sizeMin: 2.6, sizeMax: 3.8 };
  }

  if (className === "marksman") {
    return { count: 1, speedMin: 86, speedMax: 150, sizeMin: 3.1, sizeMax: 4.5 };
  }
  if (className === "breacher") {
    return { count: 1, speedMin: 58, speedMax: 110, sizeMin: 3.8, sizeMax: 5.8, colorSet: ["#cb9d54", "#986f2e", "#6b4a1b"] };
  }
  return { count: 1, speedMin: 78, speedMax: 136, sizeMin: 2.7, sizeMax: 4.1 };
}

function isHumanEnemy(enemy) {
  return enemy?.kind === "guard" || enemy?.kind === "rusher";
}

function getBloodPalette(enemyOrKind, slash = false) {
  const kind = typeof enemyOrKind === "string" ? enemyOrKind : enemyOrKind?.kind;
  if (kind === "specimen") {
    return slash
      ? ["#1e796f", "#4db6a8", "#94efe2"]
      : ["#12574f", "#2f8f84", "#6cddd0"];
  }
  if (kind === "boss") {
    return slash
      ? ["#7e1824", "#b12635", "#e05e67"]
      : ["#5d0d17", "#8f1a29", "#d04454"];
  }
  return slash
    ? ["#5f0f1b", "#8a1a29", "#c43b4d"]
    : ["#61111d", "#8f1d2b", "#cc4a58"];
}

function getRemoteActionTracker(playerId) {
  if (!gameState?.remoteActionState) {
    return null;
  }

  if (!gameState.remoteActionState[playerId]) {
    gameState.remoteActionState[playerId] = {
      nextShootAt: 0,
      nextInteractAt: 0,
      nextNoiseAt: 0,
      nextMedkitAt: 0,
      nextReloadAt: 0,
      reloadCompleteAt: 0,
      nextTakedownAt: 0,
    };
  }

  return gameState.remoteActionState[playerId];
}

function resolveRemoteActionActor(playerId, actionActor = null) {
  const snapshot = getPlayerSnapshotById(playerId);
  if (!snapshot || snapshot.running === false || (snapshot.hp ?? 100) <= 0) {
    return null;
  }

  if (snapshot.updatedAt && Date.now() - snapshot.updatedAt > REMOTE_ACTION_STALE_MS) {
    return null;
  }

  const angle = Number.isFinite(actionActor?.angle) ? actionActor.angle : snapshot.angle || 0;
  const loadout = getLoadoutForClass(snapshot.className || actionActor?.className);
  return {
    ...snapshot,
    x: snapshot.x,
    y: snapshot.y,
    angle,
    radius: snapshot.radius || 15,
    className: snapshot.className || actionActor?.className || "stealther",
    canUseShield: typeof snapshot.canUseShield === "boolean" ? snapshot.canUseShield : Boolean(loadout.canUseShield),
    maxShieldHp: typeof snapshot.maxShieldHp === "number" ? snapshot.maxShieldHp : loadout.shieldCells || 0,
    reloadTime: typeof snapshot.reloadTime === "number" ? snapshot.reloadTime : loadout.reloadTime || 1,
    medkits: typeof snapshot.medkits === "number" ? snapshot.medkits : 0,
    noiseCharges: typeof snapshot.noiseCharges === "number" ? snapshot.noiseCharges : 0,
    cash: typeof snapshot.cash === "number" ? snapshot.cash : 0,
  };
}

function canProcessRemoteAction(playerId, trackerKey, cooldownSeconds) {
  const tracker = getRemoteActionTracker(playerId);
  if (!tracker) {
    return false;
  }

  const now = performance.now() * 0.001;
  if (now < (tracker[trackerKey] || 0)) {
    return false;
  }

  tracker[trackerKey] = now + cooldownSeconds;
  return true;
}

function getPlayerSnapshotById(playerId) {
  if (!gameState || !playerId) {
    return null;
  }

  if (playerId === gameState.localNetworkId) {
    return {
      id: playerId,
      className: selectedClass,
      displayName: normalizeProfileDisplayName(playerProfile.displayName),
      title: normalizeProfileTitle(playerProfile.title),
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

function getLiveRaidTargets() {
  const targets = [];
  const now = performance.now() * 0.001;

  if (gameState?.player?.hp > 0) {
    targets.push({
      id: gameState.localNetworkId || "local",
      x: gameState.player.x,
      y: gameState.player.y,
      vx: gameState.player.vx,
      vy: gameState.player.vy,
      angle: gameState.player.angle,
      radius: gameState.player.radius,
      shieldEquipped: gameState.player.shieldEquipped,
      shieldHp: gameState.player.shieldHp,
      hp: gameState.player.hp,
      maxHp: gameState.player.maxHp,
      invisible: gameState.player.invisible,
      spawnProtected: gameState.spawnGrace > 0,
      faction: "raid",
      isLocal: true,
    });
  }

  for (const remote of gameState.remotePlayers) {
    if ((remote.hp ?? 100) <= 0 || remote.running === false) {
      continue;
    }

    targets.push({
      id: remote.id,
      x: remote.x,
      y: remote.y,
      vx: remote.vx || 0,
      vy: remote.vy || 0,
      angle: remote.angle || 0,
      radius: remote.radius || 15,
      shieldEquipped: Boolean(remote.shieldEquipped),
      shieldHp: remote.shieldHp || 0,
      hp: remote.hp ?? 100,
      maxHp: remote.maxHp ?? 100,
      invisible: Boolean(remote.invisible),
      spawnProtected: Number.isFinite(remote.spawnGraceUntil) && remote.spawnGraceUntil > now,
      faction: "raid",
      isLocal: false,
    });
  }

  return targets;
}

function selectEnemyTarget(enemy) {
  const targets = [...getLiveRaidTargets(), ...getHostileEnemyTargets(enemy)];
  let chosen = null;

  for (const target of targets) {
    if (target.invisible || target.spawnProtected) {
      continue;
    }
    const visible = gameState.spawnGrace <= 0 && canSeeTarget(enemy, target, enemy.viewRange, enemy.viewCone, enemy.aimAngle, 26);
    if (!visible) {
      continue;
    }

    const targetDistance = distance(enemy, target);
    const priority = scoreTargetForEnemy(enemy, target);
    if (!chosen || priority > chosen.priority || (priority === chosen.priority && targetDistance < chosen.distance)) {
      chosen = { target, distance: targetDistance, priority };
    }
  }

  return chosen;
}

function getExtractionParticipants() {
  return getLiveRaidTargets();
}

function getRaidTargetById(targetId) {
  if (!targetId) {
    return null;
  }

  return [...getLiveRaidTargets(), ...gameState.enemies.filter((enemy) => !enemy.dead && !enemy.hidden)].find((target) => target.id === targetId) || null;
}

function tryOpenEnemyDoor(enemy) {
  const nearbyDoor = getNearbyDoor(enemy, 42);
  if (!nearbyDoor || nearbyDoor.open) {
    return false;
  }

  nearbyDoor.open = true;
  window.__raidRuntime?.publishWorldAction({
    type: "door",
    id: nearbyDoor.id,
    open: true,
  });
  return true;
}

function allPlayersReadyToExtract() {
  const participants = getExtractionParticipants();
  if (participants.length <= 1) {
    return true;
  }

  return participants.every((target) => rectContains(extractionZone, target.x, target.y));
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
    if (typeof patch.medkits === "number") {
      gameState.player.medkits = patch.medkits;
    }
    if (typeof patch.noiseCharges === "number") {
      gameState.player.noiseCharges = patch.noiseCharges;
    }
    if (typeof patch.cash === "number") {
      gameState.cash = patch.cash;
    }
    if (typeof patch.ammo === "number") {
      gameState.player.ammo = patch.ammo;
    }
    if (typeof patch.adminInvisible === "boolean") {
      gameState.player.adminInvisible = patch.adminInvisible;
    }
    if (typeof patch.adminGodMode === "boolean") {
      gameState.player.adminGodMode = patch.adminGodMode;
    }
    if (typeof patch.invisible === "boolean") {
      gameState.player.invisible = patch.invisible;
    } else {
      refreshPlayerInvisibility(gameState.player);
    }
    syncAdminDeckUi();
    syncHud();
    return;
  }

  const remote = gameState.remotePlayers.find((player) => player.id === playerId);
  if (remote) {
    Object.assign(remote, patch);
  }
}

function getMutableRaidPlayerById(playerId) {
  if (!gameState || !playerId) {
    return null;
  }

  const actor = playerId === gameState.localNetworkId
    ? gameState.player
    : gameState.remotePlayers.find((player) => player.id === playerId) || null;

  if (!actor) {
    return null;
  }

  const loadout = getLoadoutForClass(actor.className || selectedClass);
  actor.canUseShield = typeof actor.canUseShield === "boolean" ? actor.canUseShield : Boolean(loadout.canUseShield);
  actor.maxShieldHp = typeof actor.maxShieldHp === "number" ? actor.maxShieldHp : loadout.shieldCells || 0;
  actor.medkits = typeof actor.medkits === "number" ? actor.medkits : 0;
  actor.noiseCharges = typeof actor.noiseCharges === "number" ? actor.noiseCharges : 0;
  if (playerId !== gameState.localNetworkId) {
    actor.cash = typeof actor.cash === "number" ? actor.cash : 0;
  }
  return actor;
}

function getNetworkPatchForActor(actor, keys) {
  if (!actor?.id || !Array.isArray(keys) || !keys.length) {
    return null;
  }

  const patch = {};
  for (const key of keys) {
    if (key === "cash" && actor.id === gameState.localNetworkId) {
      patch.cash = gameState.cash;
      continue;
    }
    if (typeof actor[key] !== "undefined") {
      patch[key] = actor[key];
    }
  }
  return Object.keys(patch).length ? patch : null;
}

function shouldReleaseSpecimen(enemy) {
  if (hasLiveNetworkSession()) {
    return false;
  }
  if (!enemy?.contained || !enemy.hidden) {
    return false;
  }

  if (gameState.heat >= (enemy.releaseHeat || 99)) {
    return true;
  }

  if (
    gameState.soundEvents.some(
      (soundEvent) =>
        distance(enemy, soundEvent) <= (enemy.releaseSoundRadius || 190) &&
        (soundEvent.kind === "shot" || soundEvent.kind === "enemyShot" || soundEvent.kind === "decoy")
    )
  ) {
    return true;
  }

  return getLiveRaidTargets().some((target) => !target.invisible && distance(enemy, target) <= (enemy.releaseRadius || 170));
}

function releaseSpecimen(enemy) {
  if (!enemy?.hidden) {
    return;
  }

  enemy.hidden = false;
  enemy.contained = false;
  enemy.state = "hunt";
  enemy.cooldown = 0.2 + Math.random() * 0.25;
  enemy.searchTimer = 3.8;
  enemy.justAlerted = true;
  const zone = findSpecimenZoneById(enemy.zoneId);
  if (zone) {
    gameState.message = `Containment breach: ${zone.label}.`;
    statusText.textContent = gameState.message;
    spawnImpactBurst(zone.specimenX, zone.specimenY, ["#70e0cf", "#d8fff9", "rgba(67, 182, 170, 0.32)"], 5.2);
    emitSound(zone.specimenX, zone.specimenY, 220, "body", 0.9);
    spawnLightPulse(zone.specimenX, zone.specimenY, "specimen");
    playGameSound("alert");
  }
}

function killEnemyByHostileForce(enemy, sourceLabel) {
  enemy.dead = true;
  enemy.deadTimer = 5.2;
  enemy.hp = 0;
  enemy.targetId = null;
  enemy.wounded = false;
  enemy.bleedoutTimer = 0;
  enemy.nextBleedDripAt = 0;
  spawnBloodBurst(enemy.x, enemy.y, enemy.kind === "boss" ? 14 : 9, false, {
    kind: enemy.kind,
    angle: enemy.woundSourceAngle || enemy.aimAngle || 0,
    force: enemy.kind === "boss" ? 160 : 118,
    dragTrail: enemy.kind !== "specimen",
    dragTrailLength: enemy.kind === "boss" ? 1.6 : 0.9,
  });
  emitSound(enemy.x, enemy.y, 120, "body", 0.42);
  if (enemy.kind === "boss") {
    syncPreferredMusic();
  }
  if (sourceLabel) {
    gameState.message = sourceLabel;
    statusText.textContent = gameState.message;
  }
}

function applySpecimenMeleeHit(enemy, target) {
  enemy.cooldown = enemy.fireRate + Math.random() * 0.14;
  enemy.justAlerted = true;
  enemy.aimAngle = angleTo(enemy, target);
  if (hasLiveNetworkSession() && target.faction === "raid") {
    return;
  }

  spawnImpactBurst(target.x, target.y, ["#70e0cf", "#d8fff9", "rgba(126, 26, 45, 0.3)"], 4.2);
  emitSound(target.x, target.y, 105, "body", 0.55);
  playGameSound("hit");

  if (target.faction === "raid") {
    if (target.isLocal) {
      if (gameState.player.adminGodMode) {
        return;
      }
      applyCellDamage(gameState.player, enemy.cellDamage || 1);
      gameState.player.hitFlash = 1;
      gameState.player.shake = Math.max(gameState.player.shake, 5.8);
      spawnBloodBurst(target.x, target.y, 5, true, {
        kind: "rusher",
        angle: enemy.aimAngle,
        force: 132,
      });
      gameState.message = "Cyber specimen made contact.";
      statusText.textContent = gameState.message;
      syncHud();
      if (gameState.player.hp <= 0) {
        endGame(false, `You were torn down carrying ${gameState.lootCollected} ${getObjectiveLabels().plural} and $${gameState.cash}.`);
      }
      return;
    }

    const remote = gameState.remotePlayers.find((player) => player.id === target.id);
    if (!remote) {
      return;
    }
    if (remote.adminGodMode) {
      return;
    }
    const patch = {
      hp: typeof remote.hp === "number" ? remote.hp : 100,
      maxHp: typeof remote.maxHp === "number" ? remote.maxHp : 100,
      shieldEquipped: Boolean(remote.shieldEquipped),
      shieldHp: typeof remote.shieldHp === "number" ? remote.shieldHp : 0,
      adminGodMode: Boolean(remote.adminGodMode),
    };
    applyCellDamage(patch, enemy.cellDamage || 1);
    applyPlayerPatchLocally(remote.id, patch);
    window.__raidRuntime?.publishPlayerPatch(remote.id, patch);
    return;
  }

  const hostileEnemy = gameState.enemies.find((entry) => entry.id === target.id);
  if (!hostileEnemy || hostileEnemy.dead) {
    return;
  }

  hostileEnemy.hp -= enemy.damage;
  hostileEnemy.hitFlash = 1;
  hostileEnemy.flinchTimer = 0.18;
  hostileEnemy.braceTimer = 0;
  hostileEnemy.woundSourceAngle = enemy.aimAngle;
  spawnBloodBurst(target.x, target.y, hostileEnemy.kind === "boss" ? 8 : 6, true, {
    kind: hostileEnemy.kind,
    angle: enemy.aimAngle,
    force: 150,
    biasStrength: 0.88,
  });
  maybeEnterWoundedState(hostileEnemy, enemy.aimAngle, "specimen");
  if (hostileEnemy.hp <= 0) {
    killEnemyByHostileForce(hostileEnemy, hostileEnemy.kind === "specimen" ? "Containment subject destroyed." : "Security unit torn apart.");
  }
}

function emitRemotePlayerShot(playerState, action = null) {
  if (!playerState) {
    return;
  }

  const loadout = getLoadoutForClass(playerState.className);
  const actor = {
    x: playerState.x,
    y: playerState.y,
    radius: playerState.radius || 15,
  };

  const spreads =
    Array.isArray(action?.spreads) && action.spreads.length
      ? action.spreads
      : Array.from({ length: loadout.pellets }, (_, pellet) =>
          (pellet - (loadout.pellets - 1) * 0.5) * loadout.spread + (Math.random() - 0.5) * loadout.spread * 0.45
        );

  for (const spread of spreads) {
    fireBullet(actor, (playerState.angle || 0) + spread, loadout.bulletSpeed, false, loadout.damage, {
      ownerId: playerState.id || null,
      shotToken: action?.shotToken || null,
    });
  }

  spawnParticle(
    actor.x + Math.cos(playerState.angle || 0) * 24,
    actor.y + Math.sin(playerState.angle || 0) * 24,
    "#ffd166",
    4 + loadout.pellets * 0.3
  );
  spawnBulletCasings(
    actor.x + Math.cos(playerState.angle || 0) * 8,
    actor.y + Math.sin(playerState.angle || 0) * 8,
    playerState.angle || 0,
    getCasingProfileForShooter("player", playerState.className || loadout.className)
  );
  spawnLightPulse(actor.x + Math.cos(playerState.angle || 0) * 26, actor.y + Math.sin(playerState.angle || 0) * 26, "muzzle", {
    radius: loadout.className === "breacher" ? 144 : loadout.className === "marksman" ? 132 : 114,
    intensity: loadout.className === "breacher" ? 0.42 : 0.34,
  });
  emitSound(actor.x, actor.y, loadout.soundRadius, "shot", loadout.soundRadius < 180 ? 0.5 : 1);
  playGameSound("shot", { className: playerState.className || loadout.className });
  registerHeat(getShotHeatGain(loadout), "Gunfire is drawing district attention.");
}

function handleInteractForActor(actor) {
  if (!actor) {
    return;
  }

  const mutableActor = actor.id ? getMutableRaidPlayerById(actor.id) : null;
  const activeActor = mutableActor || actor;
  const nextLevelId = getNextLevelId();
  const nearbyDoor = getNearbyDoor(activeActor);
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
    if (loot.collected || distance(activeActor, loot) > 58) {
      continue;
    }

    loot.collected = true;
    let playerPatch = null;
    if (loot.type === "core") {
      gameState.lootCollected += 1;
    } else if (loot.type === "shield") {
      if (!restoreShieldCells(activeActor)) {
        loot.collected = false;
        return;
      }
      playerPatch = getNetworkPatchForActor(activeActor, ["shieldEquipped", "shieldHp"]);
    } else if (loot.type === "medkit") {
      activeActor.medkits = (activeActor.medkits || 0) + loot.value;
      playerPatch = getNetworkPatchForActor(activeActor, ["medkits"]);
    } else if (loot.type === "noise") {
      activeActor.noiseCharges = (activeActor.noiseCharges || 0) + loot.value;
      playerPatch = getNetworkPatchForActor(activeActor, ["noiseCharges"]);
    } else {
      if (activeActor.id === gameState.localNetworkId) {
        gameState.cash = (gameState.cash || 0) + loot.value;
      } else {
        activeActor.cash = (activeActor.cash || 0) + loot.value;
      }
      playerPatch = getNetworkPatchForActor(activeActor, ["cash"]);
    }

    window.__raidRuntime?.publishWorldAction({
      type: "loot",
      id: loot.id,
      collected: true,
    });
    if (mutableActor?.id && mutableActor.id !== gameState.localNetworkId && playerPatch) {
      applyPlayerPatchLocally(mutableActor.id, playerPatch);
      window.__raidRuntime?.publishPlayerPatch(mutableActor.id, playerPatch);
    }
    recalculateSharedObjectiveProgress();
    syncHud();
    return;
  }

  if (rectContains(extractionZone, activeActor.x, activeActor.y)) {
    if (gameState.requiredLoot > 0 && gameState.lootCollected < gameState.requiredLoot) {
      return;
    }

    if (hasLiveBoss()) {
      return;
    }

    if (!allPlayersReadyToExtract()) {
      gameState.message = "Need both operators inside the evac zone.";
      statusText.textContent = gameState.message;
      return;
    }

    if (nextLevelId) {
      openBreachShop(nextLevelId);
    } else {
      endGame(true, `You cleared all three zones, neutralized the Warden, and extracted with $${gameState.cash}.`);
    }
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

  const authoritativeSession = hasLiveNetworkSession();
  const actor = resolveRemoteActionActor(playerId, action.actor);
  if (!actor) {
    return;
  }

  if (action.type === "shoot") {
    const loadout = getLoadoutForClass(actor.className);
    if (!canProcessRemoteAction(playerId, "nextShootAt", Math.max(0.12, loadout.shotRate * 0.92))) {
      return;
    }
    const mutableActor = getMutableRaidPlayerById(playerId);
    if (!mutableActor || (mutableActor.ammo || 0) <= 0) {
      return;
    }
    if (!authoritativeSession) {
      mutableActor.ammo = Math.max(0, (mutableActor.ammo || 0) - 1);
      const patch = getNetworkPatchForActor(mutableActor, ["ammo", "magSize"]);
      if (patch) {
        applyPlayerPatchLocally(mutableActor.id, patch);
        window.__raidRuntime?.publishPlayerPatch(mutableActor.id, patch);
      }
    }
    emitRemotePlayerShot(actor, action);
    return;
  }

  if (action.type === "noise" && action.target) {
    if (!canProcessRemoteAction(playerId, "nextNoiseAt", REMOTE_NOISE_COOLDOWN)) {
      return;
    }
    const mutableActor = getMutableRaidPlayerById(playerId);
    if (mutableActor && (mutableActor.noiseCharges || 0) <= 0) {
      return;
    }
    if (!Number.isFinite(action.target.x) || !Number.isFinite(action.target.y)) {
      return;
    }
    if (distance(actor, action.target) > REMOTE_NOISE_RANGE) {
      return;
    }
    if (mutableActor && !authoritativeSession) {
      mutableActor.noiseCharges = Math.max(0, (mutableActor.noiseCharges || 0) - 1);
      const patch = getNetworkPatchForActor(mutableActor, ["noiseCharges"]);
      if (patch) {
        applyPlayerPatchLocally(mutableActor.id, patch);
        window.__raidRuntime?.publishPlayerPatch(mutableActor.id, patch);
      }
    }
    emitSound(action.target.x, action.target.y, 360, "decoy", 1.4);
    spawnImpactBurst(action.target.x, action.target.y, ["#7aaed0", "#f5fbff", "rgba(74, 118, 142, 0.34)"], 4.4);
    spawnLightPulse(action.target.x, action.target.y, "decoy");
    playGameSound("decoy");
    return;
  }

  if (action.type === "interact") {
    if (!canProcessRemoteAction(playerId, "nextInteractAt", REMOTE_INTERACT_COOLDOWN)) {
      return;
    }
    handleInteractForActor(actor);
    return;
  }

  if (action.type === "medkit") {
    if (!canProcessRemoteAction(playerId, "nextMedkitAt", 0.35)) {
      return;
    }
    const mutableActor = getMutableRaidPlayerById(playerId);
    if (!mutableActor || (mutableActor.medkits || 0) <= 0 || (mutableActor.hp || 0) >= (mutableActor.maxHp || 0)) {
      return;
    }
    spawnImpactBurst(mutableActor.x, mutableActor.y, ["#0f8e79", "#c8fff1", "rgba(92, 214, 171, 0.35)"], 4.2);
    if (!authoritativeSession) {
      mutableActor.medkits = Math.max(0, (mutableActor.medkits || 0) - 1);
      mutableActor.hp = Math.min(mutableActor.maxHp || 1, (mutableActor.hp || 0) + 1);
      const patch = getNetworkPatchForActor(mutableActor, ["hp", "maxHp", "medkits"]);
      if (patch) {
        applyPlayerPatchLocally(mutableActor.id, patch);
        window.__raidRuntime?.publishPlayerPatch(mutableActor.id, patch);
      }
    }
    return;
  }

  if (action.type === "reload") {
    if (!canProcessRemoteAction(playerId, "nextReloadAt", 0.25)) {
      return;
    }
    const mutableActor = getMutableRaidPlayerById(playerId);
    if (!mutableActor || (mutableActor.ammo || 0) >= (mutableActor.magSize || 0)) {
      return;
    }
    const tracker = getRemoteActionTracker(playerId);
    const reloadDuration = Math.max(0.45, mutableActor.reloadTime || getLoadoutForClass(mutableActor.className).reloadTime || 1);
    if (tracker) {
      const now = performance.now() * 0.001;
      tracker.nextShootAt = Math.max(tracker.nextShootAt || 0, now + reloadDuration);
      tracker.reloadCompleteAt = authoritativeSession ? 0 : now + reloadDuration;
    }
    return;
  }

  if (action.type === "admin") {
    const mutableActor = getMutableRaidPlayerById(playerId);
    if (!mutableActor) {
      return;
    }
    if (!authoritativeSession && applyAdminActionToActor(mutableActor, action.adminAction || "")) {
      const patch = getNetworkPatchForActor(mutableActor, getAdminPatchKeysForAction(action.adminAction || ""));
      if (patch) {
        applyPlayerPatchLocally(mutableActor.id, patch);
        window.__raidRuntime?.publishPlayerPatch(mutableActor.id, patch);
      }
    }
    return;
  }

  if (action.type === "takedown") {
    if (!canProcessRemoteAction(playerId, "nextTakedownAt", REMOTE_TAKEDOWN_COOLDOWN)) {
      return;
    }
    const target = getTakedownTargetForActor(actor);
    if (target) {
      target.dead = true;
      target.deadTimer = 5.2;
      spawnImpactBurst(target.x, target.y, ["#f5f8fb", "#ff7a45", "rgba(126, 26, 45, 0.38)"], 4);
      spawnBloodBurst(target.x, target.y, 4, true, {
        kind: target.kind,
        angle: actor.angle || 0,
        force: 132,
      });
    }
  }
}

function applyAuthoritativeLocalState(playerState) {
  if (!gameState || !playerState) {
    return;
  }

  const player = gameState.player;
  gameState.localNetworkId = playerState.id || gameState.localNetworkId;
  const previousHp = player.hp;
  player.hp = typeof playerState.hp === "number" ? playerState.hp : player.hp;
  player.maxHp = typeof playerState.maxHp === "number" ? playerState.maxHp : player.maxHp;
  player.shieldEquipped =
    typeof playerState.shieldEquipped === "boolean" ? playerState.shieldEquipped : player.shieldEquipped;
  player.shieldHp = typeof playerState.shieldHp === "number" ? playerState.shieldHp : player.shieldHp;
  player.ammo = typeof playerState.ammo === "number" ? playerState.ammo : player.ammo;
  player.magSize = typeof playerState.magSize === "number" ? playerState.magSize : player.magSize;
  player.spriteVariant =
    typeof playerState.spriteVariant === "string" || playerState.spriteVariant === null
      ? playerState.spriteVariant
      : player.spriteVariant;
  player.displayName = typeof playerState.displayName === "string" ? normalizeProfileDisplayName(playerState.displayName) : player.displayName;
  player.title = typeof playerState.title === "string" ? normalizeProfileTitle(playerState.title) : player.title;
  player.adminInvisible = typeof playerState.adminInvisible === "boolean" ? playerState.adminInvisible : player.adminInvisible;
  player.adminGodMode = typeof playerState.adminGodMode === "boolean" ? playerState.adminGodMode : player.adminGodMode;
  player.invisible = Boolean(playerState.invisible);
  player.quietMode = typeof playerState.quietMode === "boolean" ? playerState.quietMode : player.quietMode;
  player.medkits = typeof playerState.medkits === "number" ? playerState.medkits : player.medkits;
  player.noiseCharges = typeof playerState.noiseCharges === "number" ? playerState.noiseCharges : player.noiseCharges;
  player.reloadTimer = typeof playerState.reloadRemaining === "number" ? playerState.reloadRemaining : player.reloadTimer;
  player.abilityTimer = typeof playerState.abilityActiveRemaining === "number" ? playerState.abilityActiveRemaining : player.abilityTimer;
  player.abilityCooldownTimer =
    typeof playerState.abilityCooldownRemaining === "number" ? playerState.abilityCooldownRemaining : player.abilityCooldownTimer;
  gameState.cash = typeof playerState.cash === "number" ? playerState.cash : gameState.cash;

  const authoritativeX = typeof playerState.x === "number" ? playerState.x : null;
  const authoritativeY = typeof playerState.y === "number" ? playerState.y : null;
  if (Number.isFinite(authoritativeX) && Number.isFinite(authoritativeY)) {
    const distanceToAuthoritative = Math.hypot(authoritativeX - player.x, authoritativeY - player.y);
    const snapDistance = Number(movementReconciliationConfig.localSnapDistance) || 84;
    player.syncX = authoritativeX;
    player.syncY = authoritativeY;
    player.targetAngle = typeof playerState.angle === "number" ? playerState.angle : player.targetAngle;
    player.vx = typeof playerState.vx === "number" ? playerState.vx : player.vx;
    player.vy = typeof playerState.vy === "number" ? playerState.vy : player.vy;
    player.reconcileBlendMs = clamp(distanceToAuthoritative * 2.4, Number(movementReconciliationConfig.localBlendMinMs) || 80, Number(movementReconciliationConfig.localBlendMaxMs) || 120);
    if (distanceToAuthoritative > snapDistance) {
      player.x = authoritativeX;
      player.y = authoritativeY;
      if (Number.isFinite(player.targetAngle)) {
        player.angle = player.targetAngle;
      }
    }
  }

  syncAdminDeckUi();
  syncHud();

  if (!gameState.ended && gameState.running && previousHp > 0 && gameState.player.hp <= 0) {
    endGame(false, `You were dropped carrying ${gameState.lootCollected} ${getObjectiveLabels().plural} and $${gameState.cash}.`);
  }
}

function shootPlayer() {
  const player = gameState.player;
  const weapon = player.weapon;

  if (!gameState.running || player.reloadTimer > 0 || player.shotCooldown > 0 || player.ammo <= 0) {
    return;
  }

  queueNetworkActionFlag("shootPressed");
  player.ammo -= 1;
  player.shotCooldown = player.shotRate;
  const pelletCount = weapon.pellets || 1;
  const shotToken = `${gameState.localNetworkId || "local"}-${++localShotCounter}`;
  const spreads = Array.from({ length: pelletCount }, (_, pellet) =>
    (pellet - (pelletCount - 1) * 0.5) * weapon.spread + (Math.random() - 0.5) * weapon.spread * 0.45
  );

  if (hasLiveNetworkSession()) {
    for (const spread of spreads) {
      firePredictedBullet(player, player.angle + spread, weapon.bulletSpeed, weapon.damage, {
        ownerId: gameState.localNetworkId || "local",
        shotToken,
      });
    }
    player.recoil = weapon.recoil;
    player.muzzleFlash = 0.08;
    player.shake = Math.max(player.shake, 2.8);
    spawnLightPulse(player.x + Math.cos(player.angle) * 26, player.y + Math.sin(player.angle) * 26, "muzzle", {
      radius: weapon.className === "breacher" ? 144 : weapon.className === "marksman" ? 132 : 114,
      intensity: weapon.className === "breacher" ? 0.42 : 0.34,
    });
    spawnBulletCasings(
      player.x + Math.cos(player.angle) * 8,
      player.y + Math.sin(player.angle) * 8,
      player.angle,
      getCasingProfileForShooter("player", weapon.className || selectedClass)
    );
    emitSound(player.x, player.y, weapon.soundRadius, "shot", weapon.soundRadius < 180 ? 0.5 : 1);
    playGameSound("shot", { className: weapon.className || selectedClass });
    if (isRaidHost()) {
      registerHeat(getShotHeatGain(weapon), "Gunfire is drawing district attention.");
    }
    syncHud();
    return;
  }

  if (!isRaidHost()) {
    for (const spread of spreads) {
      firePredictedBullet(player, player.angle + spread, weapon.bulletSpeed, weapon.damage, {
        ownerId: gameState.localNetworkId || "local",
        shotToken,
      });
    }
    player.recoil = weapon.recoil;
    player.muzzleFlash = 0.08;
    player.shake = Math.max(player.shake, 2.8);
    spawnLightPulse(player.x + Math.cos(player.angle) * 26, player.y + Math.sin(player.angle) * 26, "muzzle", {
      radius: weapon.className === "breacher" ? 144 : weapon.className === "marksman" ? 132 : 114,
      intensity: weapon.className === "breacher" ? 0.42 : 0.34,
    });
    spawnBulletCasings(
      player.x + Math.cos(player.angle) * 8,
      player.y + Math.sin(player.angle) * 8,
      player.angle,
      getCasingProfileForShooter("player", weapon.className || selectedClass)
    );
    playGameSound("shot", { className: weapon.className || selectedClass });
    window.__raidRuntime?.publishPlayerAction({
      type: "shoot",
      actor: {
        x: player.x,
        y: player.y,
        angle: player.angle,
        radius: player.radius,
        className: selectedClass,
      },
      shotToken,
      spreads,
    });
    syncHud();
    return;
  }

  for (const spread of spreads) {
    fireBullet(player, player.angle + spread, weapon.bulletSpeed, false, weapon.damage, {
      ownerId: gameState.localNetworkId || "host",
      shotToken,
    });
  }

  spawnParticle(player.x + Math.cos(player.angle) * 24, player.y + Math.sin(player.angle) * 24, "#ffd166", 4 + pelletCount * 0.3);
  spawnParticle(player.x + Math.cos(player.angle) * 28, player.y + Math.sin(player.angle) * 28, "rgba(255,255,255,0.92)", 2 + pelletCount * 0.15);
  spawnBulletCasings(
    player.x + Math.cos(player.angle) * 8,
    player.y + Math.sin(player.angle) * 8,
    player.angle,
    getCasingProfileForShooter("player", weapon.className || selectedClass)
  );
  player.recoil = weapon.recoil;
  player.muzzleFlash = 0.08;
  player.shake = Math.max(player.shake, 2.8);
  spawnLightPulse(player.x + Math.cos(player.angle) * 26, player.y + Math.sin(player.angle) * 26, "muzzle", {
    radius: weapon.className === "breacher" ? 144 : weapon.className === "marksman" ? 132 : 114,
    intensity: weapon.className === "breacher" ? 0.42 : 0.34,
  });
  emitSound(player.x, player.y, weapon.soundRadius, "shot", weapon.soundRadius < 180 ? 0.5 : 1);
  playGameSound("shot", { className: weapon.className || selectedClass });
  registerHeat(getShotHeatGain(weapon), "Gunfire is drawing district attention.");
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

  queueNetworkActionFlag("reloadPressed");
  player.reloadTimer = player.reloadTime;
  gameState.message = "Reloading...";
  statusText.textContent = gameState.message;
  playGameSound("reload", { className: player.weapon.className || selectedClass });
  if (!isRaidHost()) {
    window.__raidRuntime?.publishPlayerAction({
      type: "reload",
      actor: { x: player.x, y: player.y, angle: player.angle, radius: player.radius, className: selectedClass },
    });
  }
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
  queueNetworkActionFlag("medkitPressed");
  player.hp = Math.min(player.maxHp, player.hp + 1);
  player.hitFlash = Math.max(0, player.hitFlash - 0.3);
  spawnImpactBurst(player.x, player.y, ["#0f8e79", "#c8fff1", "rgba(92, 214, 171, 0.35)"], 4.2);
  playGameSound("medkit");
  gameState.message = "Field medkit applied.";
  statusText.textContent = gameState.message;
  if (!isRaidHost()) {
    window.__raidRuntime?.publishPlayerAction({
      type: "medkit",
      actor: { x: player.x, y: player.y, angle: player.angle, radius: player.radius, className: selectedClass },
    });
  }
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
  queueNetworkActionFlag("noisePressed");
  queueNetworkActionFlag("noiseTarget", target);

  if (!isRaidHost()) {
    gameState.message = "Noise maker tossed.";
    statusText.textContent = gameState.message;
    playGameSound("decoy");
    spawnLightPulse(target.x, target.y, "decoy");
    window.__raidRuntime?.publishPlayerAction({
      type: "noise",
      target,
      actor: { x: player.x, y: player.y, angle: player.angle, radius: player.radius, className: selectedClass },
    });
    syncHud();
    return;
  }

  emitSound(target.x, target.y, 360, "decoy", 1.4);
  spawnImpactBurst(target.x, target.y, ["#7aaed0", "#f5fbff", "rgba(74, 118, 142, 0.34)"], 4.4);
  spawnLightPulse(target.x, target.y, "decoy");
  playGameSound("decoy");
  registerHeat(0.55, "The distraction is pushing district chatter upward.");
  gameState.message = "Noise maker tossed. Hostiles are checking it.";
  statusText.textContent = gameState.message;
  syncHud();
}

function useClassAbility() {
  if (!gameState?.running) {
    return;
  }

  const player = gameState.player;

  if (player.ability !== "cloak") {
    gameState.message = "No active ability on this class.";
    statusText.textContent = gameState.message;
    return;
  }

  if (player.abilityTimer > 0 || player.abilityCooldownTimer > 0) {
    gameState.message = "Cloak not ready.";
    statusText.textContent = gameState.message;
    return;
  }

  queueNetworkActionFlag("abilityPressed");
  player.abilityTimer = player.abilityDuration;
  player.abilityCooldownTimer = player.abilityCooldown;
  player.invisible = true;
  gameState.message = "Cloak engaged.";
  statusText.textContent = gameState.message;
  syncHud();
}

function interact() {
  if (!gameState.running) {
    return;
  }

  queueNetworkActionFlag("interactPressed");
  const player = gameState.player;
  const objectiveLabels = getObjectiveLabels();
  const nextLevelId = getNextLevelId();
  if (hasLiveNetworkSession()) {
    const nearbyDoor = getNearbyDoor(player);
    if (nearbyDoor) {
      gameState.message = nearbyDoor.open ? "Syncing door close..." : "Syncing door open...";
    } else if (rectContains(extractionZone, player.x, player.y)) {
      gameState.message = nextLevelId ? "Syncing breach clearance..." : "Syncing extraction...";
    } else {
      gameState.message = "Syncing field interaction...";
    }
    statusText.textContent = gameState.message;
    window.__raidRuntime?.publishPlayerAction({
      type: "interact",
      actor: { x: player.x, y: player.y, angle: player.angle, radius: player.radius, className: selectedClass },
    });
    return;
  }

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
          gameState.message = `${objectiveLabels.singular} secured. ${gameState.requiredLoot - gameState.lootCollected} remaining.`;
        } else if (loot.type === "shield") {
          if (restoreShieldCells(player)) {
            gameState.message = "Shield cells locked in.";
          } else {
            loot.collected = false;
            gameState.message = "This class cannot use shields.";
          }
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

    window.__raidRuntime?.publishPlayerAction({
      type: "interact",
      actor: { x: player.x, y: player.y, angle: player.angle, radius: player.radius, className: selectedClass },
    });
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
      gameState.message = `${objectiveLabels.singular} secured. ${gameState.requiredLoot - gameState.lootCollected} remaining.`;
      playGameSound("core");
    } else if (loot.type === "shield") {
      if (restoreShieldCells(player)) {
        gameState.message = "Shield cells locked in.";
        playGameSound("pickup");
      } else {
        loot.collected = false;
        collectedSomething = false;
        gameState.message = "This class cannot use shields.";
      }
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
    if (gameState.requiredLoot > 0 && gameState.lootCollected < gameState.requiredLoot) {
      gameState.message = `Extraction gate locked. You still need more ${objectiveLabels.plural}.`;
      statusText.textContent = gameState.message;
      return;
    }

    if (hasLiveBoss()) {
      gameState.message = "The Warden is still active. Drop the boss before exfil.";
      statusText.textContent = gameState.message;
      return;
    }

    if (!allPlayersReadyToExtract()) {
      gameState.message = "Need both operators inside the evac zone.";
      statusText.textContent = gameState.message;
      return;
    }

    if (nextLevelId) {
      openBreachShop(nextLevelId);
    } else {
      endGame(true, `You cleared all three zones, neutralized the Warden, and extracted with $${gameState.cash}.`);
    }
  }
}

function getInteractionTarget() {
  if (!gameState?.running) {
    return null;
  }

  const player = gameState.player;
  const objectiveLabels = getObjectiveLabels();
  const nextLevelId = getNextLevelId();
  const nextLevel = nextLevelId ? getLevelTemplate(nextLevelId) : null;
  const nearbyDoor = getNearbyDoor(player);

  if (nearbyDoor) {
    return nearbyDoor.open ? "Press E to close service door" : "Press E to open service door";
  }

  for (const loot of gameState.loot) {
    if (!loot.collected && distance(player, loot) <= player.interactRadius) {
      if (loot.type === "core") {
        return `Press E to secure ${objectiveLabels.singular}`;
      }
      if (loot.type === "shield") {
        if (!player.canUseShield) {
          return "Stealther cannot use shield cells";
        }
        return player.shieldEquipped ? "Press E to refresh shield cells" : "Press E to equip shield cells";
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
    if (gameState.requiredLoot > 0 && gameState.lootCollected < gameState.requiredLoot) {
      return `Need all ${objectiveLabels.plural} before extraction`;
    }

    if (hasLiveBoss()) {
      return "Neutralize the Warden before extraction";
    }

    if (!allPlayersReadyToExtract()) {
      return "Need both operators in the evac zone";
    }

    return nextLevel ? `Press E to breach ${nextLevel.name.toLowerCase()}` : "Press E to extract";
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
  queueNetworkActionFlag("takedownPressed");

  if (!isRaidHost()) {
    gameState.player.knifeTimer = 0.28;
    window.__raidRuntime?.publishPlayerAction({
      type: "takedown",
      actor: {
        x: gameState.player.x,
        y: gameState.player.y,
        angle: gameState.player.angle,
        radius: gameState.player.radius,
        className: selectedClass,
      },
    });
    return;
  }

  const target = getTakedownTarget();

  if (!target) {
    return;
  }

  target.dead = true;
  target.wounded = false;
  target.bleedoutTimer = 0;
  gameState.player.knifeTimer = 0.36;
  gameState.player.shake = Math.max(gameState.player.shake, 2.4);
  gameState.cash += 40;
  spawnImpactBurst(target.x, target.y, ["#f5f8fb", "#ff7a45", "rgba(126, 26, 45, 0.38)"], 4);
  spawnBloodBurst(target.x, target.y, 4, true, {
    kind: target.kind,
    angle: gameState.player.angle,
    force: 138,
    dragTrail: true,
    dragTrailLength: 0.5,
  });
  emitSound(target.x, target.y, 70, "body", 0.18);
  registerHeat(0.12, "Close-contact kills still raise district suspicion.");
  gameState.message = "Silent takedown.";
  statusText.textContent = gameState.message;
  syncHud();
}

function updateAwarenessState() {
  const player = gameState.player;
  const previous = gameState.awareness;
  let next = player.quietMode ? "stealth" : "open";

  if (gameState.enemies.some((enemy) => enemyThreatensRaid(enemy) && enemy.state === "hunt")) {
    next = "spotted";
  } else if (gameState.enemies.some((enemy) => enemyThreatensRaid(enemy) && enemy.state === "investigate")) {
    next = "suspicious";
  } else if (gameState.enemies.some((enemy) => enemyThreatensRaid(enemy) && enemy.state === "search")) {
    next = "lost";
  }

  gameState.awareness = next;

  const nextHoldDuration = getAwarenessHoldDuration(next, gameState.heat);
  if (nextHoldDuration > 0) {
    gameState.musicAlertTimer = Math.max(gameState.musicAlertTimer || 0, nextHoldDuration);
  }

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
  syncPreferredMusic();
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
  player.abilityTimer = Math.max(0, player.abilityTimer - dt);
  player.abilityCooldownTimer = Math.max(0, player.abilityCooldownTimer - dt);
  refreshPlayerInvisibility(player);

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

  if (isRaidHost()) {
    updateRemoteReloads();
  }

  if (isMoving) {
    player.stepTimer -= dt;

    if (player.stepTimer <= 0) {
      const radius = quietMovement
        ? STEALTH_TUNING.quietStepRadius
        : sprinting
          ? STEALTH_TUNING.sprintStepRadius
          : STEALTH_TUNING.normalStepRadius;
      const intensity = quietMovement
        ? STEALTH_TUNING.quietStepIntensity
        : sprinting
          ? STEALTH_TUNING.sprintStepIntensity
          : STEALTH_TUNING.normalStepIntensity;

      if (gameState.spawnGrace <= 0) {
        emitSound(player.x, player.y, radius, sprinting ? "sprint" : "step", intensity);
      }

      if (sprinting) {
        playGameSound("step");
      }

      player.stepTimer = quietMovement ? STEALTH_TUNING.quietStepInterval : sprinting ? 0.26 : 0.54;
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

function spawnBloodBurst(x, y, amount = 6, slash = false, options = {}) {
  const palette = options.palette || getBloodPalette(options.kind, slash);
  const angle = Number.isFinite(options.angle) ? options.angle : Math.random() * Math.PI * 2;
  const spread = options.spread ?? (slash ? 0.3 : Math.PI * 0.72);
  const force = options.force ?? (slash ? 170 : 110);
  const biasStrength = options.biasStrength ?? (slash ? 1 : 0.72);

  for (let index = 0; index < amount; index += 1) {
    const direction = angle + (Math.random() - 0.5) * spread * 2;
    const speed = force * (0.35 + Math.random() * 0.85);
    const vx = Math.cos(direction) * speed * biasStrength + (Math.random() - 0.5) * 28;
    const vy = Math.sin(direction) * speed * biasStrength + (Math.random() - 0.5) * 28;
    gameState.particles.push({
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      vx,
      vy,
      gravity: 180,
      drag: 0.9,
      life: (slash ? 0.4 : 0.56) + Math.random() * 0.3,
      maxLife: slash ? 0.7 : 0.9,
      color: palette[index % palette.length],
      size: (slash ? 2.4 : 3.2) + Math.random() * 2.4,
      shape: slash ? "slash" : undefined,
      angle: direction,
      width: slash ? 8 + Math.random() * 9 : undefined,
      height: slash ? 2 + Math.random() * 1.2 : undefined,
    });
  }

  if (options.dragTrail) {
    const trailCount = 1 + Math.floor((options.dragTrailLength || 0.8) * 2);
    for (let index = 0; index < trailCount; index += 1) {
      const offset = index * (6 + Math.random() * 8);
      spawnGoreDecal(
        x - Math.cos(angle) * offset + (Math.random() - 0.5) * 3,
        y - Math.sin(angle) * offset + (Math.random() - 0.5) * 3,
        0.45 + amount / 14,
        true,
        {
          kind: options.kind,
          palette,
          angle,
          width: 12 + Math.random() * 8,
          height: 2 + Math.random() * 1.6,
          color: "rgba(111, 18, 28, 0.34)",
        }
      );
    }
  }

  spawnGoreDecal(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10, amount / 6, slash, {
    kind: options.kind,
    palette,
    angle,
  });

  if (!slash) {
    spawnWallBloodSplat(x, y, angle, options.kind, amount / 8);
  }
}

function createDynamicLootId(type) {
  dynamicLootCounter += 1;
  return `${gameState.levelId}-${type}-dyn-${dynamicLootCounter}`;
}

function spawnCrateLoot(crate) {
  if (!crate || crate.lootSpawned) {
    return;
  }

  crate.lootSpawned = true;
  const loot = createLoot(
    createDynamicLootId(crate.lootType),
    crate.x + crate.w * 0.5 + (Math.random() - 0.5) * 8,
    crate.y + crate.h * 0.5 + (Math.random() - 0.5) * 8,
    crate.lootType,
    crate.lootValue
  );
  gameState.loot.push(loot);
}

function maybeEnterWoundedState(enemy, hitAngle = 0, sourceFaction = "raid") {
  if (!enemy || enemy.dead || enemy.wounded || !isHumanEnemy(enemy)) {
    return false;
  }

  const hpRatio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0;
  if (hpRatio > 0.34) {
    return false;
  }

  enemy.wounded = true;
  enemy.woundedSeverity = clamp(1 - hpRatio, 0.25, 1);
  enemy.bleedoutTimer = enemy.kind === "guard" ? 8.2 - enemy.woundedSeverity * 2.1 : 6.4 - enemy.woundedSeverity * 2.3;
  enemy.nextBleedDripAt = 0.28;
  enemy.woundedByRaid = sourceFaction === "raid";
  enemy.woundSourceAngle = hitAngle;
  enemy.state = "hunt";
  enemy.coverTimer = 0;
  enemy.targetCommitTimer = 0;
  enemy.searchNodes = [{ x: enemy.x, y: enemy.y }];
  enemy.searchNodeIndex = 0;
  spawnBloodBurst(enemy.x, enemy.y, enemy.kind === "guard" ? 6 : 5, false, {
    kind: enemy.kind,
    angle: hitAngle + Math.PI,
    force: 124,
    dragTrail: true,
    dragTrailLength: 0.7,
  });
  return true;
}

function resolveBleedoutDeath(enemy) {
  if (!enemy || enemy.dead) {
    return;
  }

  enemy.dead = true;
  enemy.deadTimer = 5.2;
  enemy.hp = 0;
  enemy.targetId = null;
  enemy.wounded = false;
  enemy.bleedoutTimer = 0;
  enemy.nextBleedDripAt = 0;
  spawnBloodBurst(enemy.x, enemy.y, enemy.kind === "guard" ? 9 : 7, false, {
    kind: enemy.kind,
    angle: enemy.woundSourceAngle || enemy.aimAngle || 0,
    force: 90,
    dragTrail: true,
    dragTrailLength: 1.2,
  });
  emitSound(enemy.x, enemy.y, 110, "body", 0.34);

  if (enemy.woundedByRaid) {
    gameState.cash += 75;
    gameState.message = "Wounded hostile bled out.";
    statusText.textContent = gameState.message;
  } else {
    gameState.message = "A wounded hostile collapsed.";
    statusText.textContent = gameState.message;
  }
}

function damageCrate(crate, amount, impactX, impactY) {
  if (!crate || crate.broken) {
    return false;
  }

  crate.hp -= amount;
  const stageChanged = updateCrateDamageStage(crate);
  spawnImpactBurst(impactX, impactY, ["#9a6f3b", "#f0d1a5", "rgba(76, 55, 31, 0.34)"], 2.8);
  spawnCrateDebris(crate, stageChanged ? 1.2 + crate.damageStage * 0.35 : 0.7, "hit");
  emitSound(crate.x + crate.w * 0.5, crate.y + crate.h * 0.5, 160, "shot", 0.55);

  if (crate.hp <= 0) {
    crate.hp = 0;
    crate.broken = true;
    crate.damageStage = 3;
    registerHeat(0.2, "Crate debris is exposing your route.", { silent: true });
    gameState.message = "Wooden crate splintered.";
    statusText.textContent = gameState.message;
    spawnImpactBurst(crate.x + crate.w * 0.5, crate.y + crate.h * 0.5, ["#b37a3e", "#f2d7b5", "#6d4320"], 4.2);
    spawnCrateDebris(crate, 2.4, "break");
    playGameSound("crateBreak", { volume: 0.92 });
    spawnCrateLoot(crate);
    if (isRaidHost()) {
      window.__raidRuntime?.publishWorldState?.(exportWorldState());
    }
  } else if (stageChanged) {
    gameState.message = crate.damageStage >= 2 ? "Crate ready to collapse." : "Crate cracked open.";
    statusText.textContent = gameState.message;
    if (isRaidHost()) {
      window.__raidRuntime?.publishWorldState?.(exportWorldState());
    }
  }

  return true;
}

function updateBullets(dt) {
  if (hasLiveNetworkSession()) {
    for (const bullet of gameState.predictedBullets) {
      bullet.prevX = bullet.x;
      bullet.prevY = bullet.y;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
    }

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

    gameState.predictedBullets = gameState.predictedBullets.filter((bullet) => bullet.life > 0);
    gameState.bullets = gameState.bullets.filter((bullet) => bullet.life > 0);
    gameState.enemyBullets = gameState.enemyBullets.filter((bullet) => bullet.life > 0);
    return;
  }

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
            registerHeat(0.22, "Window breaches are exposing your route.", { silent: true });
            gameState.message = "Window breached.";
            statusText.textContent = gameState.message;
            window.__raidRuntime?.publishWorldAction({
              type: "window",
              id: matchingWindow.id,
              broken: true,
            });
          }
          spawnImpactBurst(bullet.x, bullet.y, ["#a8d8f3", "#f4fbff", "rgba(146, 166, 182, 0.5)"], 3.2);
          spawnLightPulse(bullet.x, bullet.y, "breach", { radius: 148, intensity: 0.18, ttl: 0.16 });
          emitSound(hitSurface.x + hitSurface.w * 0.5, hitSurface.y + hitSurface.h * 0.5, 210, "shot", 0.9);
        } else if (hitSurface.kind === "crate") {
          damageCrate(findCrateById(hitSurface.id), bullet.damage, bullet.x, bullet.y);
          return false;
        }
        spawnImpactBurst(bullet.x, bullet.y, ["#8f6820", "#ffe2a4", "rgba(56, 66, 78, 0.34)"], 2.2);
        spawnLightPulse(bullet.x, bullet.y, "breach", { radius: 104, intensity: 0.12, ttl: 0.08 });
      }
      return false;
    }

    for (const enemy of gameState.enemies) {
      if (enemy.dead || enemy.hidden || distance(bullet, enemy) > enemy.radius + bullet.radius) {
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
      enemy.woundSourceAngle = Math.atan2(bullet.vy, bullet.vx);
      if (enemy.kind === "rusher") {
        enemy.evadeTimer = 0.52;
        enemy.dodgeCooldown = 0.88;
        enemy.evadeSide = bullet.x < enemy.x ? 1 : -1;
        enemy.strafeBias = enemy.evadeSide;
      }
      spawnImpactBurst(bullet.x, bullet.y, ["#ff7a45", "#ffe6c9", "rgba(126, 26, 45, 0.5)"], 3.4);
      spawnBloodBurst(bullet.x, bullet.y, enemy.kind === "boss" ? 9 : 6, false, {
        kind: enemy.kind,
        angle: Math.atan2(bullet.vy, bullet.vx),
        force: enemy.kind === "boss" ? 170 : 122,
      });
      maybeEnterWoundedState(enemy, Math.atan2(bullet.vy, bullet.vx), "raid");

      if (enemy.hp <= 0) {
        enemy.dead = true;
        enemy.deadTimer = 5.2;
        enemy.wounded = false;
        enemy.bleedoutTimer = 0;
        enemy.nextBleedDripAt = 0;
        gameState.cash += 75;
        gameState.message = "Enemy squad neutralized.";
        statusText.textContent = gameState.message;
        emitSound(enemy.x, enemy.y, 120, "body", 0.4);
        spawnBloodBurst(enemy.x, enemy.y, enemy.kind === "boss" ? 14 : 9, false, {
          kind: enemy.kind,
          angle: Math.atan2(bullet.vy, bullet.vx),
          force: enemy.kind === "boss" ? 180 : 130,
          dragTrail: true,
          dragTrailLength: enemy.kind === "boss" ? 1.4 : 0.8,
        });
        if (enemy.kind === "boss") {
          syncPreferredMusic();
        }
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
            registerHeat(0.22, "Window breaches are exposing your route.", { silent: true });
            window.__raidRuntime?.publishWorldAction({
              type: "window",
              id: matchingWindow.id,
              broken: true,
            });
          }
          spawnImpactBurst(bullet.x, bullet.y, ["#a8d8f3", "#f4fbff", "rgba(146, 166, 182, 0.5)"], 3);
          spawnLightPulse(bullet.x, bullet.y, "breach", { radius: 148, intensity: 0.16, ttl: 0.16 });
        } else if (hitSurface.kind === "crate") {
          damageCrate(findCrateById(hitSurface.id), Math.max(6, bullet.damage * 0.6), bullet.x, bullet.y);
          return false;
        }
        spawnImpactBurst(bullet.x, bullet.y, ["#ab4458", "#ffd6de", "rgba(56, 66, 78, 0.34)"], 2.4);
        spawnLightPulse(bullet.x, bullet.y, "breach", { radius: 104, intensity: 0.1, ttl: 0.08 });
      }
      return false;
    }

    for (const enemy of gameState.enemies) {
      if (
        enemy.dead ||
        enemy.hidden ||
        enemy.id === bullet.ownerEnemyId ||
        getEnemyFaction(enemy) === (bullet.ownerFaction || "security") ||
        distance(bullet, enemy) > enemy.radius + bullet.radius
      ) {
        continue;
      }

      enemy.hp -= bullet.damage;
      enemy.hitFlash = 1;
      enemy.flinchTimer = 0.18;
      spawnImpactBurst(bullet.x, bullet.y, ["#70e0cf", "#ffe6c9", "rgba(126, 26, 45, 0.45)"], 3.2);
      enemy.woundSourceAngle = Math.atan2(bullet.vy, bullet.vx);
      spawnBloodBurst(bullet.x, bullet.y, enemy.kind === "boss" ? 9 : 5, false, {
        kind: enemy.kind,
        angle: Math.atan2(bullet.vy, bullet.vx),
        force: enemy.kind === "boss" ? 150 : 116,
      });
      maybeEnterWoundedState(enemy, Math.atan2(bullet.vy, bullet.vx), bullet.ownerFaction || "security");

      if (enemy.hp <= 0) {
        killEnemyByHostileForce(
          enemy,
          getEnemyFaction(enemy) === "specimen" ? "Containment target dropped by security fire." : "Security unit dropped by crossfire."
        );
      }

      return false;
    }

    if (isRaidHost()) {
      for (const remote of gameState.remotePlayers) {
        const remoteRadius = remote.radius || 15;
        if (remote.adminGodMode) {
          continue;
        }
        if (Number.isFinite(remote.spawnGraceUntil) && performance.now() * 0.001 < remote.spawnGraceUntil) {
          continue;
        }
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
          applyCellDamage(patch, bulletCellDamage(bullet));
        } else {
          applyCellDamage(patch, bulletCellDamage(bullet));
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
      if (gameState.player.adminGodMode) {
        return false;
      }

      if (playerShieldBlocksBullet(gameState.player, bullet)) {
        applyCellDamage(gameState.player, bulletCellDamage(bullet));
        gameState.player.shieldFlash = 1;
        gameState.player.shake = Math.max(gameState.player.shake, 4.5);
        spawnImpactBurst(bullet.x, bullet.y, ["#7ab7d8", "#dff6ff", "rgba(38, 73, 94, 0.36)"], 4.4);

      if (!gameState.player.shieldEquipped) {
        gameState.message = "Side shield shattered.";
      } else {
        gameState.message = "Shield absorbed the hit.";
        }

        statusText.textContent = gameState.message;
        syncHud();
        return false;
      }

      applyCellDamage(gameState.player, bulletCellDamage(bullet));
      spawnImpactBurst(bullet.x, bullet.y, ["#ff5d73", "#ffd6de", "rgba(122, 18, 39, 0.44)"], 4.2);
      spawnBloodBurst(bullet.x, bullet.y, 5, false, {
        kind: "rusher",
        angle: Math.atan2(bullet.vy, bullet.vx),
        force: 112,
      });
      gameState.player.shake = Math.max(gameState.player.shake, 6.5);
      gameState.player.hitFlash = 1;
      gameState.message = "You are taking fire.";
      statusText.textContent = gameState.message;
      playGameSound("hit");
      syncHud();

      if (gameState.player.hp <= 0) {
        endGame(false, `You were dropped carrying ${gameState.lootCollected} ${getObjectiveLabels().plural} and $${gameState.cash}.`);
      }

      return false;
    }

    return true;
  });
}

function updateEnemies(dt) {
  if (hasLiveNetworkSession()) {
    return;
  }
  for (const enemy of gameState.enemies) {
    if (enemy.dead) {
      enemy.deadTimer = Math.max(0, enemy.deadTimer - dt);
      continue;
    }

    const prevX = enemy.x;
    const prevY = enemy.y;

    if (enemy.hidden) {
      if (shouldReleaseSpecimen(enemy)) {
        releaseSpecimen(enemy);
      } else {
        continue;
      }
    }

    if (enemy.kind === "boss" && enemy.bossPhase === 1 && enemy.hp <= enemy.maxHp * 0.5) {
      enemy.bossPhase = 2;
      enemy.speed += 18;
      enemy.fireRate = Math.max(0.36, enemy.fireRate - 0.14);
      enemy.damage += 6;
      enemy.cooldown = 0.1;
      enemy.shieldEquipped = true;
      enemy.shieldHp = Math.max(enemy.maxShieldHp, 2);
      enemy.maxShieldHp = Math.max(enemy.maxShieldHp, 2);
      enemy.shieldFlash = 1;
      gameState.message = "WARd3n sheds restraint. Phase two live.";
      statusText.textContent = gameState.message;
      syncPreferredMusic();
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
    if (enemy.wounded) {
      enemy.bleedoutTimer = Math.max(0, enemy.bleedoutTimer - dt);
      enemy.nextBleedDripAt = Math.max(0, enemy.nextBleedDripAt - dt);
      if (enemy.nextBleedDripAt <= 0) {
        spawnGoreDecal(
          enemy.x + (Math.random() - 0.5) * 6,
          enemy.y + enemy.radius * 0.35 + (Math.random() - 0.5) * 4,
          0.28 + enemy.woundedSeverity * 0.45,
          false,
          {
            kind: enemy.kind,
            angle: enemy.woundSourceAngle || enemy.aimAngle || 0,
            width: 7 + enemy.woundedSeverity * 6,
            height: 3 + enemy.woundedSeverity * 2,
            color: "rgba(99, 16, 26, 0.34)",
          }
        );
        enemy.nextBleedDripAt = 0.38 + Math.random() * 0.42;
      }
      if (enemy.bleedoutTimer <= 0) {
        resolveBleedoutDeath(enemy);
        enemy.vx = 0;
        enemy.vy = 0;
        continue;
      }
    }
    const targetSelection = selectEnemyTarget(enemy);
    const rememberedTarget = getRaidTargetById(enemy.targetId);
    const activeTarget = targetSelection?.target || rememberedTarget || getLiveRaidTargets()[0] || gameState.player;
    const toPlayer = distance(enemy, activeTarget);
    const chaseAngle = angleTo(enemy, activeTarget);
    const targetIsRaid = activeTarget?.faction === "raid";
    const incomingPlayerFire =
      enemy.kind === "rusher" &&
      gameState.bullets.some((bullet) => {
        if (distance(enemy, bullet) > 96) {
          return false;
        }
        const bulletHeading = Math.atan2(bullet.vy, bullet.vx);
        return angleDifference(bulletHeading, angleTo(bullet, enemy)) < 0.55;
      });
    const nearIncomingFire = enemy.shieldEquipped && gameState.bullets.some((bullet) => distance(enemy, bullet) < 130);
    const squadLead = getShieldLead(enemy);
    const shieldLeadDrivingPush =
      squadLead && squadLead !== enemy && squadLead.state === "hunt" && (squadLead.braceTimer > 0.1 || distance(squadLead, activeTarget) < 220);
    const woundedHuman = enemy.wounded && isHumanEnemy(enemy);
    const woundedSpeedMultiplier = woundedHuman ? Math.max(0.46, 0.72 - enemy.woundedSeverity * 0.2) : 1;

    if (nearIncomingFire) {
      enemy.braceTimer = Math.max(enemy.braceTimer, 0.65);
    }

    if (incomingPlayerFire && enemy.dodgeCooldown <= 0) {
      enemy.evadeTimer = 0.42;
      enemy.dodgeCooldown = 0.9;
      enemy.evadeSide = Math.random() > 0.5 ? 1 : -1;
      enemy.strafeBias = enemy.evadeSide;
    }

    if (enemy.shieldEquipped && gameState.bullets.length > 0 && toPlayer < 240) {
      enemy.braceTimer = Math.max(enemy.braceTimer, 0.38);
    }

    const visiblePlayer = Boolean(targetSelection);

    if (isSpecimenEnemy(enemy)) {
      if (visiblePlayer) {
        enemy.state = "hunt";
        enemy.lastSeenX = activeTarget.x;
        enemy.lastSeenY = activeTarget.y;
        enemy.targetId = activeTarget.id;
        enemy.searchTimer = 4.2;
        enemy.pursuitTimer = 4.8;
        enemy.aimAngle = turnToward(enemy.aimAngle, chaseAngle, dt * 9.6);
      } else {
        enemy.pursuitTimer = Math.max(0, enemy.pursuitTimer - dt);
        enemy.aimAngle = turnToward(enemy.aimAngle, angleTo(enemy, { x: enemy.lastSeenX, y: enemy.lastSeenY }), dt * 6.5);
      }

      if (visiblePlayer) {
        moveEntityToward(enemy, activeTarget.x, activeTarget.y, enemy.speed * (toPlayer > 86 ? 1.18 : 0.94), dt);
      } else if (enemy.pursuitTimer > 0) {
        moveEntityToward(enemy, enemy.lastSeenX, enemy.lastSeenY, enemy.speed * 1.04, dt);
      } else if (enemy.state === "investigate") {
        moveEntityToward(enemy, enemy.investigateX, enemy.investigateY, enemy.speed * 0.8, dt);
      } else {
        enemy.wanderAngle += (Math.random() - 0.5) * 0.58;
        moveEntityToward(
          enemy,
          enemy.x + Math.cos(enemy.wanderAngle) * 84,
          enemy.y + Math.sin(enemy.wanderAngle) * 84,
          enemy.speed * 0.48,
          dt
        );
      }

      if (enemy.cooldown <= 0 && visiblePlayer && toPlayer <= (enemy.meleeRange || 34) + activeTarget.radius + 2) {
        applySpecimenMeleeHit(enemy, activeTarget);
      }
      enemy.vx = (enemy.x - prevX) / Math.max(dt, 0.0001);
      enemy.vy = (enemy.y - prevY) / Math.max(dt, 0.0001);
      continue;
    }

    if (visiblePlayer) {
      const braceAim =
        enemy.shieldEquipped && enemy.braceTimer > 0
          ? chaseAngle - enemy.shieldSide * Math.PI * 0.5
          : chaseAngle;
      enemy.aimAngle = turnToward(enemy.aimAngle, braceAim, dt * (enemy.braceTimer > 0 ? 9.6 : 7.2));
      enemy.state = "hunt";
      enemy.lastSeenX = activeTarget.x;
      enemy.lastSeenY = activeTarget.y;
      enemy.targetId = activeTarget.id;
      enemy.targetCommitTimer = activeTarget.faction === "raid" ? 1.45 : 1;
      enemy.searchTimer = 3.8;
      enemy.pursuitTimer = enemy.kind === "boss" ? 5.6 : enemy.kind === "guard" ? 4.8 : 4.2;

      if (enemy.seenTimer <= 0) {
        enemy.justAlerted = true;
        if (targetIsRaid) {
          registerHeat(enemy.kind === "boss" ? 1.2 : enemy.kind === "guard" ? 0.85 : 0.65, "Enemy visual contact is escalating district response.");
        }
        notifyNearbyEnemies(enemy, activeTarget.x, activeTarget.y);
        if (enemy.squadRole === "shieldLead") {
          for (const ally of getSquadmates(enemy)) {
            if (ally === enemy) {
              continue;
            }

            const relayPoint = getApproximateAlertPoint(enemy, ally, activeTarget.x, activeTarget.y);
            ally.state = "hunt";
            ally.lastSeenX = relayPoint.x;
            ally.lastSeenY = relayPoint.y;
            ally.targetId = activeTarget.id;
            ally.targetCommitTimer = activeTarget.faction === "raid" ? 1.15 : 0.8;
            ally.searchTimer = 3.4;
            ally.pursuitTimer = ally.kind === "guard" ? 4.6 : 4;
            ally.coverTimer = 0;

            if (ally.kind !== "guard") {
              ally.tactic = ally.squadRole === "flankLeft" ? "flankLeft" : ally.squadRole === "flankRight" ? "flankRight" : "assault";
            }
          }
        }
        if (targetIsRaid) {
          playGameSound("alert");
          gameState.message = "Enemy contact. They have visual on you.";
          statusText.textContent = gameState.message;
        }
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

        const investigatePoint = getInvestigatePointForSound(enemy, soundEvent);
        enemy.state = "investigate";
        enemy.targetId = null;
        enemy.targetCommitTimer = 0;
        enemy.investigateX = investigatePoint.x;
        enemy.investigateY = investigatePoint.y;
        enemy.searchTimer = STEALTH_TUNING.investigateBase + soundEvent.intensity * STEALTH_TUNING.investigateIntensityScale;
        break;
      }
    }

    enemy.cooldown -= dt;
    enemy.coverTimer -= dt;

    if (enemy.state === "hunt") {
      const desiredDistance = enemy.kind === "boss" ? 250 : enemy.kind === "guard" ? 210 : shieldLeadDrivingPush ? 118 : 145;
      const prefersCover = enemy.kind === "guard" || enemy.kind === "boss" || enemy.tactic === "anchor";
      const shouldFlank = enemy.tactic === "flankLeft" || enemy.tactic === "flankRight" || shieldLeadDrivingPush;
      const coverTarget =
        enemy.coverTimer <= 0 || !enemy.coverX
          ? findCoverPosition(enemy, activeTarget)
          : { x: enemy.coverX, y: enemy.coverY };

      if (!visiblePlayer) {
        enemy.pursuitTimer = Math.max(0, enemy.pursuitTimer - dt);
        enemy.aimAngle = turnToward(enemy.aimAngle, angleTo(enemy, { x: enemy.lastSeenX, y: enemy.lastSeenY }), dt * 6.4);

        if (enemy.pursuitTimer > 0) {
          if (lineBlocked(enemy.x, enemy.y, enemy.lastSeenX, enemy.lastSeenY)) {
            tryOpenEnemyDoor(enemy);
          }

          moveEntityToward(
            enemy,
            enemy.lastSeenX,
            enemy.lastSeenY,
            enemy.speed * (enemy.kind === "rusher" ? 1.02 : 0.86) * woundedSpeedMultiplier,
            dt
          );

          if (distance(enemy, { x: enemy.lastSeenX, y: enemy.lastSeenY }) < 24 && enemy.pursuitTimer < 1.2) {
            beginEnemySearch(enemy, enemy.lastSeenX, enemy.lastSeenY, STEALTH_TUNING.searchBase);
          }
        } else {
          beginEnemySearch(enemy, enemy.lastSeenX, enemy.lastSeenY, Math.max(enemy.searchTimer, STEALTH_TUNING.searchBase));
        }
      } else if (enemy.shieldEquipped && enemy.braceTimer > 0) {
        moveEntityToward(
          enemy,
          enemy.x + Math.cos(chaseAngle) * 48,
          enemy.y + Math.sin(chaseAngle) * 48,
          enemy.speed * 0.72 * woundedSpeedMultiplier,
          dt
        );
      } else if (woundedHuman && coverTarget) {
        enemy.coverX = coverTarget.x;
        enemy.coverY = coverTarget.y;
        enemy.coverTimer = 1.35;
        moveEntityToward(enemy, coverTarget.x, coverTarget.y, enemy.speed * 0.74 * woundedSpeedMultiplier, dt);
      } else if (enemy.kind === "rusher" && enemy.evadeTimer > 0) {
        const evadeAngle = chaseAngle + enemy.evadeSide * Math.PI * 0.5;
        enemy.aimAngle = turnToward(enemy.aimAngle, chaseAngle, dt * 9.2);
        moveEntityToward(
          enemy,
          enemy.x + Math.cos(evadeAngle) * 138,
          enemy.y + Math.sin(evadeAngle) * 138,
          enemy.speed * 1.18 * woundedSpeedMultiplier,
          dt
        );
      } else if (enemy.flinchTimer > 0) {
        moveEntityToward(
          enemy,
          enemy.x - Math.cos(chaseAngle) * 46,
          enemy.y - Math.sin(chaseAngle) * 46,
          enemy.speed * 0.42 * woundedSpeedMultiplier,
          dt
        );
      } else if (prefersCover && coverTarget && toPlayer > desiredDistance * 0.72) {
        enemy.coverX = coverTarget.x;
        enemy.coverY = coverTarget.y;
        enemy.coverTimer = 1.1;
        moveEntityToward(enemy, coverTarget.x, coverTarget.y, enemy.speed * 0.98 * woundedSpeedMultiplier, dt);
      } else if (shouldFlank && toPlayer > 100) {
        const flankTarget = getFlankTarget(enemy, activeTarget);
        moveEntityToward(enemy, flankTarget.x, flankTarget.y, enemy.speed * 1.04 * woundedSpeedMultiplier, dt);
      } else if (toPlayer > desiredDistance) {
        moveEntityToward(enemy, activeTarget.x, activeTarget.y, enemy.speed * (enemy.kind === "rusher" ? 1.1 : 0.94) * woundedSpeedMultiplier, dt);
      } else if (toPlayer < desiredDistance - 42) {
        moveEntityToward(
          enemy,
          enemy.x - Math.cos(chaseAngle) * 120,
          enemy.y - Math.sin(chaseAngle) * 120,
          enemy.speed * 0.72 * woundedSpeedMultiplier,
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
          enemy.speed * 0.72 * woundedSpeedMultiplier,
          dt
        );
      }

      if (enemy.cooldown <= 0 && visiblePlayer && toPlayer < enemy.viewRange - 25 && enemy.braceTimer <= 0.08 && enemy.flinchTimer <= 0.04 && (!woundedHuman || enemy.bleedoutTimer > 1.2 || Math.random() > 0.18 + enemy.woundedSeverity * 0.18)) {
        const bulletSpeed = enemy.kind === "boss" ? 470 : enemy.kind === "guard" ? 430 : 390;
        const targetVelocity = Math.hypot(activeTarget.vx || 0, activeTarget.vy || 0);
        const leadTime = clamp(toPlayer / bulletSpeed + targetVelocity / 900, 0.06, enemy.kind === "boss" ? 0.42 : 0.34);
        const predictedTarget = {
          x: activeTarget.x + (activeTarget.vx || 0) * leadTime * 1.1,
          y: activeTarget.y + (activeTarget.vy || 0) * leadTime * 1.1,
        };
        const volleyCount = enemy.kind === "boss" ? 3 : enemy.kind === "guard" ? 2 : 1;
        const baseShotAngle = angleTo(enemy, predictedTarget);
        const rangePenalty = clamp(toPlayer / Math.max(enemy.viewRange, 1), 0, 1);
        const movePenalty = clamp(Math.hypot(enemy.vx || 0, enemy.vy || 0) / 220, 0, 0.04);
        const alertPenalty = enemy.justAlerted ? 0.05 : 0;
        const typePenalty = enemy.kind === "rusher" ? 0.04 : enemy.kind === "guard" ? 0.018 : enemy.kind === "boss" ? 0.01 : 0.03;
        const spreadBase = typePenalty + rangePenalty * (enemy.kind === "boss" ? 0.02 : 0.045) + movePenalty + alertPenalty + (woundedHuman ? 0.05 + enemy.woundedSeverity * 0.06 : 0);
        enemy.aimAngle = turnToward(enemy.aimAngle, baseShotAngle, dt * 11);

        if (hasLiveNetworkSession() && activeTarget?.faction === "raid") {
          enemy.cooldown = enemy.fireRate + Math.random() * 0.16;
          enemy.strafeBias *= -1;
          enemy.muzzleFlash = 0.08;
          continue;
        }

        for (let volley = 0; volley < volleyCount; volley += 1) {
          const spread =
            (volley - (volleyCount - 1) * 0.5) * (enemy.kind === "boss" ? 0.045 : 0.055) +
            (Math.random() - 0.5) * spreadBase * 2;
          fireBullet(enemy, enemy.aimAngle + spread, bulletSpeed, true, enemy.damage, {
            ownerEnemyId: enemy.id,
            ownerFaction: getEnemyFaction(enemy),
          });
        }

        emitSound(enemy.x, enemy.y, 220, "enemyShot", 0.8);
        spawnLightPulse(enemy.x + Math.cos(enemy.aimAngle) * 22, enemy.y + Math.sin(enemy.aimAngle) * 22, "enemyMuzzle", {
          radius: enemy.kind === "boss" ? 156 : enemy.kind === "guard" ? 122 : 108,
          intensity: enemy.kind === "boss" ? 0.4 : 0.3,
        });
        spawnBulletCasings(
          enemy.x + Math.cos(enemy.aimAngle) * 8,
          enemy.y + Math.sin(enemy.aimAngle) * 8,
          enemy.aimAngle,
          getCasingProfileForShooter("enemy", enemy.kind)
        );
        playGameSound("enemyShot", { enemyKind: enemy.kind });
        enemy.cooldown = enemy.fireRate + Math.random() * 0.16;
        enemy.strafeBias *= -1;
        enemy.muzzleFlash = 0.08;
      }
    } else if (enemy.state === "investigate") {
      const investigateTarget = { x: enemy.investigateX, y: enemy.investigateY };
      const reachedTarget = distance(enemy, investigateTarget) < 20;

      if (!reachedTarget) {
        moveEntityToward(enemy, investigateTarget.x, investigateTarget.y, enemy.speed * 0.72 * woundedSpeedMultiplier, dt);
        enemy.aimAngle = turnToward(enemy.aimAngle, angleTo(enemy, investigateTarget), dt * 3.9);
      } else {
        enemy.wanderAngle += dt * 1.8;
        enemy.aimAngle = turnToward(enemy.aimAngle, enemy.wanderAngle, dt * 3.2);
      }

      enemy.searchTimer -= dt;

      if (enemy.searchTimer <= 0 || reachedTarget) {
        beginEnemySearch(enemy, investigateTarget.x, investigateTarget.y, Math.max(1.7, STEALTH_TUNING.searchBase - 0.5));
      }
    } else if (enemy.state === "search") {
      enemy.searchTimer -= dt;
      if (!Array.isArray(enemy.searchNodes) || enemy.searchNodes.length === 0) {
        enemy.searchNodes = buildSearchNodes(enemy, enemy.lastSeenX, enemy.lastSeenY);
        enemy.searchNodeIndex = 0;
      }
      const currentNode = enemy.searchNodes[enemy.searchNodeIndex] || { x: enemy.lastSeenX, y: enemy.lastSeenY };
      enemy.aimAngle = turnToward(enemy.aimAngle, angleTo(enemy, currentNode), dt * 3.4);
      moveEntityToward(enemy, currentNode.x, currentNode.y, enemy.speed * 0.42 * woundedSpeedMultiplier, dt);

      if (distance(enemy, currentNode) < 18 && enemy.searchNodes.length > 1) {
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
  }
}

function updateSyncedCombat(dt) {
  for (const bullet of gameState.predictedBullets) {
    bullet.prevX = bullet.x;
    bullet.prevY = bullet.y;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
  }

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

  gameState.predictedBullets = gameState.predictedBullets.filter((bullet) => bullet.life > 0);
  gameState.bullets = gameState.bullets.filter((bullet) => bullet.life > 0);
  gameState.enemyBullets = gameState.enemyBullets.filter((bullet) => bullet.life > 0);

  for (const enemy of gameState.enemies) {
    if (typeof enemy.syncX === "number" && typeof enemy.syncY === "number") {
      enemy.x += (enemy.syncX - enemy.x) * Math.min(1, dt * 12);
      enemy.y += (enemy.syncY - enemy.y) * Math.min(1, dt * 12);
    }
    enemy.shieldFlash = Math.max(0, (enemy.shieldFlash || 0) - dt * 3);
    enemy.hitFlash = Math.max(0, (enemy.hitFlash || 0) - dt * 3.6);
    enemy.muzzleFlash = Math.max(0, (enemy.muzzleFlash || 0) - dt * 5);
    enemy.flinchTimer = Math.max(0, (enemy.flinchTimer || 0) - dt);
    enemy.deadTimer = Math.max(0, (enemy.deadTimer || 0) - dt);
    enemy.evadeTimer = Math.max(0, (enemy.evadeTimer || 0) - dt);
    enemy.dodgeCooldown = Math.max(0, (enemy.dodgeCooldown || 0) - dt);
  }
}

function updateParticles(dt) {
  for (const particle of gameState.particles) {
    if (typeof particle.gravity === "number") {
      particle.vy += particle.gravity * dt;
    }
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    if (typeof particle.drag === "number") {
      const drag = Math.pow(particle.drag, dt * 60);
      particle.vx *= drag;
      particle.vy *= drag;
    }
    if (particle.sticky) {
      particle.vx *= particle.staticScale ?? 0.96;
      particle.vy *= particle.staticScale ?? 0.96;
    }
    if (typeof particle.spin === "number") {
      particle.angle = (particle.angle || 0) + particle.spin * dt;
    }
    if (typeof particle.grow === "number") {
      particle.size += particle.grow * dt;
    }
    particle.life -= dt;
  }

  gameState.particles = gameState.particles.filter((particle) => particle.life > 0);
}

function updateHeat() {
  if (hasLiveNetworkSession()) {
    return;
  }
  const progress = clamp(gameState.duration > 0 ? gameState.elapsed / gameState.duration : 0, 0, 0.999);
  const timeHeat = Math.max(1, Math.min(4, 1 + Math.floor(progress * 4)));
  const behaviorHeat = getHeatTierFromScore(gameState.heatScore || 0);
  const nextHeat = Math.max(timeHeat, behaviorHeat);

  if (nextHeat !== gameState.heat) {
    gameState.heat = nextHeat;
    const detail = gameState.lastHeatTrigger ? ` ${gameState.lastHeatTrigger}` : "";
    gameState.message = `District heat increased to ${gameState.heat}.${detail}`;
    statusText.textContent = gameState.message;
    applyHeatEscalation();
    gameState.lastHeatTrigger = "";
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

function getLevelVisualTheme() {
  if (gameState?.levelId === "admin") {
    return {
      base: "#d6d2cb",
      gridMinor: "rgba(109, 111, 112, 0.08)",
      gridMajor: "rgba(88, 92, 96, 0.12)",
      ambientTop: "rgba(255, 248, 236, 0.08)",
      ambientMid: "rgba(145, 133, 118, 0.07)",
      ambientBottom: "rgba(70, 74, 79, 0.07)",
      buildingFill: "rgba(188, 185, 178, 0.26)",
      buildingStroke: "rgba(118, 116, 112, 0.18)",
      roofTop: "#c9c2b7",
      roofBottom: "#9e9689",
      roofHighlight: "rgba(255, 249, 240, 0.18)",
      roofStripe: "rgba(90, 84, 77, 0.08)",
      roofBoxFill: "rgba(125, 119, 110, 0.22)",
      roofBoxStroke: "rgba(68, 65, 61, 0.2)",
      windowFill: "rgba(148, 177, 190, 0.26)",
      windowBrokenFill: "rgba(93, 98, 104, 0.32)",
      windowStroke: "rgba(241, 247, 251, 0.62)",
      windowBrokenStroke: "rgba(218, 226, 231, 0.24)",
      doorClosedFill: "rgba(102, 98, 92, 0.9)",
      doorOpenFill: "rgba(58, 61, 66, 0.7)",
      doorStroke: "rgba(235, 227, 215, 0.34)",
      obstacleTop: "#b9b4ad",
      obstacleBottom: "#8f887f",
      obstacleStripe: "rgba(84, 80, 74, 0.1)",
      obstacleLine: "rgba(70, 68, 64, 0.24)",
      reactorGlow: "rgba(135, 156, 171, 0.06)",
      extractionFill: "rgba(171, 152, 97, 0.16)",
      extractionStroke: "rgba(137, 114, 54, 0.84)",
      extractionText: "rgba(88, 67, 29, 0.96)",
      extractionLabel: "TRANSFER",
      worldGlow: "rgba(255, 248, 235, 0.14)",
      obstacleStripeHeight: 2,
    };
  }

  if (gameState?.levelId === "reactor") {
    return {
      base: "#bbc4ce",
      gridMinor: "rgba(96, 106, 118, 0.12)",
      gridMajor: "rgba(88, 96, 108, 0.14)",
      ambientTop: "rgba(252, 242, 223, 0.08)",
      ambientMid: "rgba(138, 120, 98, 0.08)",
      ambientBottom: "rgba(50, 58, 66, 0.08)",
      buildingFill: "rgba(169, 179, 189, 0.22)",
      buildingStroke: "rgba(118, 130, 142, 0.16)",
      roofTop: "#b8b1aa",
      roofBottom: "#8d857c",
      roofHighlight: "rgba(255, 248, 235, 0.14)",
      roofStripe: "rgba(73, 64, 54, 0.08)",
      roofBoxFill: "rgba(120, 111, 101, 0.24)",
      roofBoxStroke: "rgba(60, 56, 52, 0.18)",
      windowFill: "rgba(163, 205, 226, 0.4)",
      windowBrokenFill: "rgba(70, 84, 98, 0.42)",
      windowStroke: "rgba(237, 249, 255, 0.72)",
      windowBrokenStroke: "rgba(215, 227, 236, 0.3)",
      doorClosedFill: "rgba(98, 112, 126, 0.92)",
      doorOpenFill: "rgba(47, 56, 67, 0.74)",
      doorStroke: "rgba(164, 124, 52, 0.28)",
      obstacleTop: "#a9b1b9",
      obstacleBottom: "#7d8892",
      obstacleStripe: "rgba(239, 170, 88, 0.18)",
      obstacleLine: "rgba(55, 70, 84, 0.28)",
      reactorGlow: "rgba(231, 155, 72, 0.18)",
      extractionFill: "rgba(197, 164, 89, 0.18)",
      extractionStroke: "rgba(164, 124, 52, 0.82)",
      extractionText: "rgba(97, 73, 28, 0.94)",
      extractionLabel: "EXTRACT",
      worldGlow: "rgba(255, 245, 220, 0.12)",
      obstacleStripeHeight: 3,
    };
  }

  return {
    base: "#c8d1d9",
    gridMinor: "rgba(94, 109, 124, 0.12)",
    gridMajor: "rgba(94, 109, 124, 0.08)",
    ambientTop: "rgba(255, 255, 255, 0.05)",
    ambientMid: "rgba(103, 116, 129, 0.04)",
    ambientBottom: "rgba(31, 42, 51, 0.04)",
    buildingFill: "rgba(182, 192, 201, 0.22)",
    buildingStroke: "rgba(115, 129, 143, 0.12)",
    roofTop: "#b5c0c8",
    roofBottom: "#8d9aa7",
    roofHighlight: "rgba(255, 255, 255, 0.12)",
    roofStripe: "rgba(49, 63, 77, 0.08)",
    roofBoxFill: "rgba(123, 136, 149, 0.3)",
    roofBoxStroke: "rgba(48, 63, 76, 0.24)",
    windowFill: "rgba(163, 205, 226, 0.4)",
    windowBrokenFill: "rgba(70, 84, 98, 0.42)",
    windowStroke: "rgba(237, 249, 255, 0.72)",
    windowBrokenStroke: "rgba(215, 227, 236, 0.3)",
    doorClosedFill: "rgba(98, 112, 126, 0.92)",
    doorOpenFill: "rgba(47, 56, 67, 0.74)",
    doorStroke: "rgba(232, 239, 245, 0.36)",
    obstacleTop: "#aeb9c3",
    obstacleBottom: "#8795a2",
    obstacleStripe: "rgba(45, 61, 77, 0.08)",
    obstacleLine: "rgba(45, 61, 77, 0.3)",
    reactorGlow: "rgba(78, 119, 151, 0.06)",
    extractionFill: "rgba(170, 188, 201, 0.18)",
    extractionStroke: "rgba(126, 143, 159, 0.8)",
    extractionText: "rgba(99, 116, 132, 1)",
    extractionLabel: "TRANSIT",
    worldGlow: "rgba(255, 255, 255, 0.18)",
    obstacleStripeHeight: 2,
  };
}

function isContainerObstacle(obstacle) {
  if (obstacle.visualType === "container" || (obstacle.kind && CONTAINER_PRESETS[obstacle.kind])) {
    return true;
  }

  if ((gameState?.levelId || activeLayoutId) !== "freight" || obstacle.kind) {
    return false;
  }

  return (obstacle.w >= 180 || obstacle.h >= 180) && Math.abs(obstacle.w - obstacle.h) > 40;
}

function normalizeFreightContainerObstacle(obstacle) {
  if (obstacle.kind && !CONTAINER_PRESETS[obstacle.kind]) {
    return obstacle;
  }

  if (obstacle.kind && CONTAINER_PRESETS[obstacle.kind]) {
    return {
      ...obstacle,
      visualType: "container",
      containerPreset: obstacle.containerPreset || obstacle.kind,
    };
  }

  if (obstacle.visualType === "container" || obstacle.containerPreset) {
    return {
      ...obstacle,
      visualType: "container",
      containerPreset: obstacle.containerPreset || obstacle.kind || null,
    };
  }

  const wide = obstacle.w >= obstacle.h;
  const centerX = obstacle.x + obstacle.w * 0.5;
  const centerY = obstacle.y + obstacle.h * 0.5;
  const presetKey = obstacle.containerPreset || obstacle.kind || (
    wide
      ? (obstacle.w >= 260 ? "freightLongH" : "freightShortH")
      : (obstacle.h >= 260 ? "freightLongV" : "freightShortV")
  );
  const preset = CONTAINER_PRESETS[presetKey];

  return {
    ...obstacle,
    x: Math.round(centerX - preset.colliderW * 0.5),
    y: Math.round(centerY - preset.colliderH * 0.5),
    w: preset.colliderW,
    h: preset.colliderH,
    drawW: typeof obstacle.drawW === "number" ? obstacle.drawW : preset.drawW,
    drawH: typeof obstacle.drawH === "number" ? obstacle.drawH : preset.drawH,
    drawOffsetX:
      typeof obstacle.drawOffsetX === "number" ? obstacle.drawOffsetX : Math.round((preset.colliderW - preset.drawW) * 0.5),
    drawOffsetY:
      typeof obstacle.drawOffsetY === "number" ? obstacle.drawOffsetY : Math.round((preset.colliderH - preset.drawH) * 0.5),
    visualType: "container",
    containerPreset: presetKey,
  };
}

function drawFloorDetails() {
  const theme = getLevelVisualTheme();

  if (gameState.levelId === "admin") {
    ctx.fillStyle = "rgba(122, 118, 111, 0.06)";
    for (let x = 120; x < WORLD.width - 120; x += 220) {
      ctx.fillRect(x, 120, 8, WORLD.height - 240);
    }

    ctx.fillStyle = "rgba(255, 248, 236, 0.14)";
    ctx.fillRect(120, 118, WORLD.width - 240, 148);
    ctx.fillRect(240, 1460, WORLD.width - 480, 126);

    ctx.fillStyle = "rgba(110, 107, 100, 0.08)";
    for (let y = 302; y < WORLD.height - 180; y += 290) {
      ctx.fillRect(140, y, WORLD.width - 280, 14);
    }

    const boulevard = ctx.createLinearGradient(0, 0, 0, WORLD.height);
    boulevard.addColorStop(0, "rgba(148, 144, 135, 0.08)");
    boulevard.addColorStop(0.5, "rgba(120, 116, 108, 0.1)");
    boulevard.addColorStop(1, "rgba(148, 144, 135, 0.08)");
    ctx.fillStyle = boulevard;
    ctx.fillRect(1040, 120, 520, WORLD.height - 240);

    ctx.fillStyle = "rgba(255, 250, 242, 0.12)";
    for (let y = 194; y < WORLD.height - 220; y += 132) {
      ctx.fillRect(1288, y, 24, 54);
    }

    ctx.fillStyle = "rgba(166, 154, 121, 0.16)";
    ctx.fillRect(1080, 72, 380, 98);
    ctx.fillRect(180, 932, 2260, 30);

    ctx.strokeStyle = "rgba(143, 133, 109, 0.24)";
    ctx.lineWidth = 3;
    ctx.strokeRect(1080, 72, 380, 98);

    ctx.fillStyle = "rgba(86, 112, 87, 0.12)";
    ctx.fillRect(182, 338, 98, 362);
    ctx.fillRect(2280, 338, 98, 362);
    ctx.fillRect(610, 1386, 248, 84);
    ctx.fillRect(1740, 1386, 248, 84);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 2;
    for (let x = 210; x < 2410; x += 242) {
      ctx.strokeRect(x, 818, 128, 86);
    }

    ctx.fillStyle = "rgba(59, 72, 84, 0.08)";
    ctx.fillRect(140, 780, WORLD.width - 280, 146);
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    for (let x = 190; x < WORLD.width - 160; x += 178) {
      ctx.fillRect(x, 848, 94, 4);
    }
    return;
  }

  if (gameState.levelId === "reactor") {
    const centerX = 1300;
    const centerY = 870;
    const glow = ctx.createRadialGradient(centerX, centerY, 80, centerX, centerY, 560);
    glow.addColorStop(0, theme.reactorGlow);
    glow.addColorStop(0.55, "rgba(214, 127, 42, 0.08)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 560, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(116, 96, 70, 0.16)";
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 248, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(239, 171, 92, 0.16)";
    ctx.lineWidth = 6;
    ctx.setLineDash([18, 10]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, 302, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    for (let ring = 0; ring < 3; ring += 1) {
      const y = 300 + ring * 420;
      ctx.fillStyle = "rgba(235, 176, 95, 0.08)";
      ctx.fillRect(120, y, WORLD.width - 240, 10);
      ctx.fillStyle = "rgba(73, 85, 98, 0.08)";
      ctx.fillRect(120, y + 10, WORLD.width - 240, 24);
    }

    ctx.strokeStyle = "rgba(103, 112, 124, 0.12)";
    ctx.lineWidth = 2;
    for (let x = 180; x < WORLD.width - 120; x += 260) {
      ctx.beginPath();
      ctx.moveTo(x, 120);
      ctx.lineTo(x, WORLD.height - 120);
      ctx.stroke();
    }
    return;
  }

  const freightLayer = getFreightFloorLayer();
  if (freightLayer) {
    ctx.drawImage(freightLayer, 0, 0);
  }
}

function drawDecorLayer(layer = "mid") {
  if (!activeDecor?.length) {
    return;
  }

  for (const decor of activeDecor) {
    const decorLayer = decor.layer || "mid";
    if (decorLayer !== layer) {
      continue;
    }
    const alphaMultiplier =
      decorLayer === "roof" || isRoofAssetPath(decor.asset)
        ? 1 - getOverlayRevealAmount({ x: decor.x, y: decor.y, w: decor.w, h: decor.h }) * 0.96
        : 1;
    if (alphaMultiplier <= 0.03) {
      continue;
    }
    drawMappedAsset(decor, { alphaMultiplier });
  }
}

function update(dt) {
  if (!gameState.running) {
    interactPrompt.classList.remove("is-visible");
    return;
  }

  hudFrameAccumulator += dt;

  const previousMusicAlertTimer = gameState.musicAlertTimer || 0;
  gameState.musicAlertTimer = Math.max(0, previousMusicAlertTimer - dt);
  if (previousMusicAlertTimer > 0 && gameState.musicAlertTimer === 0 && preferredMusicMode === "auto") {
    syncPreferredMusic();
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
  reconcileLocalPlayer(dt);
  if (isRaidHost() && !hasLiveNetworkSession()) {
    updateBullets(dt);
    updateEnemies(dt);
    updateHeat();
  } else {
    updateSyncedCombat(dt);
  }
  updateRemotePlayers(dt);
  updateAwarenessState();
  updateParticles(dt);
  updateSoundEvents(dt);
  updateLighting(dt);
  updateCamera();
  const takedownTarget = getTakedownTarget();
  gameState.player.knifeReady = Boolean(takedownTarget);
  const interactionTarget = getInteractionTarget();
  interactPrompt.textContent = takedownTarget ? "Press F to perform knife takedown" : interactionTarget || "Press E to interact";
  interactPrompt.classList.toggle("is-visible", Boolean(takedownTarget || interactionTarget));
  if (hudFrameAccumulator >= 0.1) {
    hudFrameAccumulator = 0;
    syncHud();
  }
}

function drawGrid() {
  if (gameState?.levelId === "freight") {
    return;
  }

  const size = 60;
  const startX = -((gameState.camera.x % size) + size) % size;
  const startY = -((gameState.camera.y % size) + size) % size;
  const theme = getLevelVisualTheme();

  ctx.strokeStyle = theme.gridMinor;
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

  ctx.strokeStyle = theme.gridMajor;
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
  const theme = getLevelVisualTheme();

  ctx.fillStyle = theme.base;
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
  gradient.addColorStop(0, theme.worldGlow);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const ambientGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  ambientGradient.addColorStop(0, theme.ambientTop);
  ambientGradient.addColorStop(0.45, theme.ambientMid);
  ambientGradient.addColorStop(1, theme.ambientBottom);
  ctx.fillStyle = ambientGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
  ctx.translate(-gameState.camera.x, -gameState.camera.y);

  drawFloorDetails();
  drawDecorLayer("ground");
  drawLightFixtures();
  drawExtractionZone();
  drawObstacles();
  drawDecorLayer("mid");
  drawSpecimenZones();
  drawLoot();
  drawRemotePlayers();
  drawEnemies();
  drawBullets();
  drawPlayer();
  drawDecorLayer("roof");
  drawDecorLayer("foreground");
  drawParticles();
  drawSoundEvents();
  drawLightingOverlay();

  ctx.restore();

  drawCombatOverlay();
  drawCompass();
}

function drawObstacles() {
  const theme = getLevelVisualTheme();

  for (const building of buildings) {
    drawBuildingRoof(building, theme);
  }

  for (const obstacle of getWorldObstacles()) {
    if (obstacle.kind === "window") {
      continue;
    }

    if (obstacle.kind === "door") {
      continue;
    }

    if (drawMappedAsset(obstacle)) {
      continue;
    }

    if (obstacle.kind === "crate") {
      drawWoodenCrate(obstacle);
      continue;
    }

    if (obstacle.kind === "fence") {
      drawFenceObstacle(obstacle);
      continue;
    }

    if (obstacle.kind === "fence-post") {
      drawFencePostObstacle(obstacle);
      continue;
    }

    if (obstacle.kind === "checkpoint-barrier") {
      drawCheckpointBarrier(obstacle);
      continue;
    }

    if (obstacle.kind === "turret") {
      drawTurretObstacle(obstacle);
      continue;
    }

    if (isContainerObstacle(obstacle)) {
      if (drawContainerSprite(obstacle)) {
        continue;
      }

      const horizontal = obstacle.w > obstacle.h;
      ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
      ctx.fillRect(obstacle.x + 6, obstacle.y + 6, obstacle.w - 12, 10);
      ctx.fillStyle = "rgba(38, 52, 65, 0.09)";
      if (horizontal) {
        for (let x = obstacle.x + 18; x < obstacle.x + obstacle.w - 16; x += 26) {
          ctx.fillRect(x, obstacle.y + 14, 3, obstacle.h - 28);
        }
      } else {
        for (let y = obstacle.y + 18; y < obstacle.y + obstacle.h - 16; y += 26) {
          ctx.fillRect(obstacle.x + 14, y, obstacle.w - 28, 3);
        }
      }
      ctx.strokeStyle = "rgba(233, 239, 244, 0.24)";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(obstacle.x + 10, obstacle.y + 14, obstacle.w - 20, obstacle.h - 28);
      ctx.lineWidth = 1;
      continue;
    }

    const obstacleGradient = ctx.createLinearGradient(obstacle.x, obstacle.y, obstacle.x, obstacle.y + obstacle.h);
    obstacleGradient.addColorStop(0, theme.obstacleTop);
    obstacleGradient.addColorStop(1, theme.obstacleBottom);
    ctx.fillStyle = obstacleGradient;
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
    ctx.strokeStyle = theme.obstacleLine;
    ctx.strokeRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);

    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    ctx.fillRect(obstacle.x + 6, obstacle.y + 6, obstacle.w - 12, 12);

    ctx.fillStyle = theme.obstacleStripe;
    for (let y = obstacle.y + 22; y < obstacle.y + obstacle.h - 10; y += 24) {
      ctx.fillRect(obstacle.x + 10, y, obstacle.w - 20, theme.obstacleStripeHeight);
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
  const theme = getLevelVisualTheme();
  const extractionVisible =
    rectContains(extractionZone, gameState.player.x, gameState.player.y) ||
    canPlayerSee({
      x: extractionZone.x + extractionZone.w * 0.5,
      y: extractionZone.y + extractionZone.h * 0.5,
    });
  const baseAlpha = extractionVisible ? 1 : 0.4;
  const pulse = 0.6 + Math.sin(performance.now() * 0.004) * 0.2;
  const fillAlpha = (0.14 + pulse * 0.08) * baseAlpha;
  const strokeAlpha = (gameState.levelId === "admin" ? 0.9 : gameState.levelId === "reactor" ? 0.86 : 0.8) * baseAlpha;
  const textAlpha = baseAlpha;
  ctx.fillStyle = theme.extractionFill.replace(/[\d.]+\)\s*$/, `${fillAlpha})`);
  ctx.fillRect(extractionZone.x, extractionZone.y, extractionZone.w, extractionZone.h);
  ctx.strokeStyle = theme.extractionStroke.replace(/[\d.]+\)\s*$/, `${strokeAlpha})`);
  ctx.lineWidth = 3;
  ctx.strokeRect(extractionZone.x, extractionZone.y, extractionZone.w, extractionZone.h);

  ctx.fillStyle = theme.extractionText.replace(/[\d.]+\)\s*$/, `${textAlpha})`);
  ctx.font = '16px Consolas';
  ctx.fillText(theme.extractionLabel, extractionZone.x + 30, extractionZone.y + extractionZone.h / 2 + 6);

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
    if (!remote.running || (remote.hp ?? 1) <= 0) {
      continue;
    }

    const remoteSprite = getSpriteForClass(remote.className, remote.shieldEquipped, remote.spriteVariant);
    if (drawCharacterSprite(remoteSprite, remote.x, remote.y, remote.angle || 0, 92, 92, remote.invisible ? 0.4 : 1)) {
      drawPlayerIdentityTag(remote, remote.x, remote.y, {
        alpha: remote.invisible ? 0.62 : 1,
        accent: "#dbeff2",
      });
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
    drawPlayerIdentityTag(remote, remote.x, remote.y, {
      alpha: remote.invisible ? 0.62 : 1,
      accent: "#dbeff2",
    });
  }
}

function drawEnemyAlertBadge(enemy, label, color, fill) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y - enemy.radius - 22);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(-16, -9, 32, 18, 7);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = '12px Consolas';
  ctx.textAlign = "center";
  ctx.fillText(label, 0, 4);
  ctx.restore();
}

function drawEnemyDetectionCue(enemy, seesPlayerNow) {
  if (!canPlayerSee(enemy)) {
    return;
  }

  if (seesPlayerNow) {
    ctx.strokeStyle = "rgba(194, 73, 98, 0.38)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(enemy.x, enemy.y);
    ctx.lineTo(gameState.player.x, gameState.player.y);
    ctx.stroke();
    drawEnemyAlertBadge(enemy, "EYE", "#ff8ea4", "rgba(71, 21, 32, 0.78)");
    return;
  }

  if (enemy.state === "investigate") {
    drawEnemyAlertBadge(enemy, "?", "#f0c46e", "rgba(63, 44, 18, 0.78)");
    return;
  }

  if (enemy.state === "search") {
    drawEnemyAlertBadge(enemy, "...", "#c8d4df", "rgba(39, 52, 63, 0.76)");
    return;
  }

  if (enemy.wounded && isHumanEnemy(enemy)) {
    drawEnemyAlertBadge(enemy, "HIT", "#ffb08f", "rgba(74, 26, 22, 0.76)");
  }
}

function drawEnemies() {
  for (const enemy of gameState.enemies) {
    if (enemy.hidden) {
      continue;
    }

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
    const seesPlayerNow = canSeeTarget(enemy, gameState.player, enemy.viewRange, enemy.viewCone, enemy.aimAngle, 24);

    if (!visible) {
      continue;
    }

    if (!isSpecimenEnemy(enemy)) {
      drawEnemyDetectionCue(enemy, seesPlayerNow);
    }

      if (enemy.state === "hunt") {
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 13, 0, Math.PI * 2);
        ctx.strokeStyle = isSpecimenEnemy(enemy) ? "rgba(73, 194, 177, 0.24)" : "rgba(194, 73, 98, 0.22)";
        ctx.lineWidth = 1.8;
        ctx.stroke();
    } else if (enemy.state === "investigate") {
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius + 11, 0, Math.PI * 2);
      ctx.strokeStyle = isSpecimenEnemy(enemy) ? "rgba(84, 176, 166, 0.22)" : "rgba(184, 137, 55, 0.2)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (enemy.state === "search") {
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius + 10, 0, Math.PI * 2);
      ctx.strokeStyle = isSpecimenEnemy(enemy) ? "rgba(108, 146, 152, 0.18)" : "rgba(103, 120, 136, 0.16)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      if (enemy.elite) {
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 18, 0, Math.PI * 2);
        ctx.strokeStyle = enemy.kind === "guard" ? "rgba(255, 173, 94, 0.36)" : "rgba(255, 108, 134, 0.34)";
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }

      const enemySprite = getSpriteForEnemy(enemy);
      const enemySpriteSize = (enemy.kind === "boss" ? 126 : enemy.kind === "guard" ? 92 : enemy.kind === "specimen" ? 96 : 86) + (enemy.elite ? 10 : 0);
    if (drawCharacterSprite(enemySprite, enemy.x, enemy.y, enemy.aimAngle, enemySpriteSize, enemySpriteSize)) {
      if (enemy.justAlerted) {
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 10, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 93, 115, 0.65)";
        ctx.stroke();
      }

       if (enemy.kind === "boss") {
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 22, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 191, 99, 0.42)";
        ctx.lineWidth = 2.4;
        ctx.stroke();
        }

        if (enemy.elite) {
          ctx.beginPath();
          ctx.arc(enemy.x, enemy.y, enemy.radius + 18, 0, Math.PI * 2);
          ctx.strokeStyle = enemy.kind === "guard" ? "rgba(255, 173, 94, 0.42)" : "rgba(255, 108, 134, 0.38)";
          ctx.lineWidth = 2.2;
          ctx.stroke();
        }

        ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
      ctx.fillRect(enemy.x - 22, enemy.y - enemy.radius - 16, 44, 6);
        ctx.fillStyle = enemy.kind === "specimen" ? "#87f0de" : "#ff9baa";
      ctx.fillRect(enemy.x - 22, enemy.y - enemy.radius - 16, 44 * (enemy.hp / enemy.maxHp), 6);
      if (enemy.wounded && isHumanEnemy(enemy)) {
        ctx.fillStyle = "rgba(141, 20, 32, 0.46)";
        ctx.beginPath();
        ctx.arc(enemy.x - 6, enemy.y + enemy.radius * 0.16, Math.max(4, enemy.radius * 0.34), 0, Math.PI * 2);
        ctx.fill();
      }
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

    ctx.fillStyle = enemy.hitFlash > 0 ? "#fff4df" : enemy.wounded && isHumanEnemy(enemy) ? "#d87c6a" : enemy.kind === "guard" ? "#ef9750" : "#ef6b82";
    ctx.strokeStyle = "rgba(22, 32, 43, 0.8)";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(-1, 0, enemy.radius - 1, enemy.radius - 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(-2, -6, 10, 12, 3);
    ctx.fillStyle = enemy.wounded && isHumanEnemy(enemy) ? "#e39b91" : enemy.kind === "guard" ? "#ffcb95" : "#ffc1cb";
    ctx.fill();

    if (enemy.wounded && isHumanEnemy(enemy)) {
      ctx.fillStyle = "rgba(111, 18, 28, 0.46)";
      ctx.beginPath();
      ctx.ellipse(-4, 4, 4.8, 2.4, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

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
  for (const bullet of gameState.predictedBullets) {
    const dx = bullet.vx || bullet.x - bullet.prevX;
    const dy = bullet.vy || bullet.y - bullet.prevY;
    const length = 16;
    const tailX = bullet.x - (dx / (Math.hypot(dx, dy) || 1)) * length;
    const tailY = bullet.y - (dy / (Math.hypot(dx, dy) || 1)) * length;
    ctx.strokeStyle = bullet.outerColor || "rgba(255, 215, 120, 0.2)";
    ctx.lineWidth = bullet.trailWidth || 5.4;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();

    ctx.strokeStyle = bullet.coreColor || "rgba(255, 240, 200, 0.88)";
    ctx.lineWidth = bullet.innerTrailWidth || 2;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();
  }

  for (const bullet of gameState.bullets) {
    if (!canPlayerSee(bullet) && distance(gameState.player, bullet) > gameState.player.closeViewRange) {
      continue;
    }

    const dx = bullet.vx || bullet.x - bullet.prevX;
    const dy = bullet.vy || bullet.y - bullet.prevY;
    const velocity = Math.hypot(dx, dy) || 1;
    const tracerLength = 22;
    const tailX = bullet.x - (dx / velocity) * tracerLength;
    const tailY = bullet.y - (dy / velocity) * tracerLength;
    ctx.strokeStyle = bullet.outerColor || "rgba(230, 183, 72, 0.26)";
    ctx.lineWidth = bullet.trailWidth || 6;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();

    ctx.strokeStyle = bullet.coreColor || "rgba(255, 244, 214, 0.92)";
    ctx.lineWidth = bullet.innerTrailWidth || 2.6;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius + 0.6, 0, Math.PI * 2);
    ctx.fillStyle = bullet.trail || "#8f6820";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, Math.max(1.6, bullet.radius - 0.6), 0, Math.PI * 2);
    ctx.fillStyle = bullet.headColor || "#ffe2a4";
    ctx.fill();
  }

  for (const bullet of gameState.enemyBullets) {
    if (!canPlayerSee(bullet) && distance(gameState.player, bullet) > gameState.player.closeViewRange) {
      continue;
    }

    const dx = bullet.vx || bullet.x - bullet.prevX;
    const dy = bullet.vy || bullet.y - bullet.prevY;
    const velocity = Math.hypot(dx, dy) || 1;
    const tracerLength = 24;
    const tailX = bullet.x - (dx / velocity) * tracerLength;
    const tailY = bullet.y - (dy / velocity) * tracerLength;
    ctx.strokeStyle = bullet.outerColor || "rgba(255, 103, 131, 0.28)";
    ctx.lineWidth = bullet.trailWidth || 6;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();

    ctx.strokeStyle = bullet.coreColor || "rgba(255, 224, 232, 0.94)";
    ctx.lineWidth = bullet.innerTrailWidth || 2.8;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius + 0.8, 0, Math.PI * 2);
    ctx.fillStyle = bullet.trail || "#ab4458";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, Math.max(1.8, bullet.radius - 0.7), 0, Math.PI * 2);
    ctx.fillStyle = bullet.headColor || "#ffd6de";
    ctx.fill();
  }
}

function drawPlayer() {
  const player = gameState.player;
  const playerSprite = getSpriteForPlayer(player);
  const spriteAlpha = player.invisible ? 0.4 : 1;
  if (drawCharacterSprite(playerSprite, player.x, player.y, player.angle, 92, 92, spriteAlpha)) {
    drawPlayerIdentityTag(player, player.x, player.y, {
      alpha: player.invisible ? 0.7 : 1,
      accent: "#b6efe0",
      border: "rgba(118, 204, 181, 0.24)",
    });
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
  drawPlayerIdentityTag(player, player.x, player.y, {
    alpha: player.invisible ? 0.7 : 1,
    accent: "#b6efe0",
    border: "rgba(118, 204, 181, 0.24)",
  });
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

function applyScreenShader() {
  const mode = VISUAL_MODES[activeVisualMode] || VISUAL_MODES.clean;
  if (activeVisualMode !== "pixel") {
    return;
  }

  const sourceWidth = canvas.width;
  const sourceHeight = canvas.height;
  const pixelWidth = Math.max(160, Math.floor(sourceWidth * (mode.pixelScale || 0.34)));
  const pixelHeight = Math.max(90, Math.floor(sourceHeight * (mode.pixelScale || 0.34)));

  if (shaderBuffer.width !== sourceWidth || shaderBuffer.height !== sourceHeight) {
    shaderBuffer.width = sourceWidth;
    shaderBuffer.height = sourceHeight;
  }
  if (shaderPixelBuffer.width !== pixelWidth || shaderPixelBuffer.height !== pixelHeight) {
    shaderPixelBuffer.width = pixelWidth;
    shaderPixelBuffer.height = pixelHeight;
  }

  shaderBufferCtx.clearRect(0, 0, sourceWidth, sourceHeight);
  shaderBufferCtx.drawImage(canvas, 0, 0);
  shaderPixelCtx.imageSmoothingEnabled = false;
  shaderPixelCtx.clearRect(0, 0, pixelWidth, pixelHeight);
  shaderPixelCtx.drawImage(shaderBuffer, 0, 0, pixelWidth, pixelHeight);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, sourceWidth, sourceHeight);
  ctx.drawImage(shaderPixelBuffer, 0, 0, sourceWidth, sourceHeight);
  ctx.restore();
}

function drawParticles() {
  for (const particle of gameState.particles) {
    const alpha = particle.life / particle.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    if (particle.shape === "pool") {
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.angle || 0);
      ctx.beginPath();
      ctx.ellipse(0, 0, particle.size * 1.4, particle.size * 0.76, 0, 0, Math.PI * 2);
      ctx.fill();
      if (particle.accentColor) {
        ctx.fillStyle = particle.accentColor;
        ctx.globalAlpha = alpha * 0.26;
        ctx.beginPath();
        ctx.ellipse(-particle.size * 0.22, -particle.size * 0.08, particle.size * 0.5, particle.size * 0.2, -0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (particle.shape === "wallstain") {
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.angle || 0);
      ctx.beginPath();
      ctx.ellipse(0, 0, particle.width || particle.size * 1.4, particle.height || particle.size * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();
      if (particle.accentColor) {
        ctx.fillStyle = particle.accentColor;
        ctx.globalAlpha = alpha * 0.22;
        ctx.beginPath();
        ctx.ellipse(-(particle.width || particle.size * 1.4) * 0.18, 0, (particle.width || particle.size * 1.4) * 0.28, (particle.height || particle.size * 0.46) * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (particle.shape === "slash") {
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.angle || 0);
      ctx.beginPath();
      ctx.roundRect(
        -(particle.width || particle.size * 1.8) * 0.5,
        -(particle.height || particle.size * 0.36) * 0.5,
        particle.width || particle.size * 1.8,
        particle.height || particle.size * 0.36,
        particle.size * 0.14
      );
      ctx.fill();
      ctx.restore();
    } else if (particle.shape === "debris") {
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.angle || 0);
      ctx.fillRect(
        -(particle.width || particle.size * 1.6) * 0.5,
        -(particle.height || particle.size * 0.55) * 0.5,
        particle.width || particle.size * 1.6,
        particle.height || particle.size * 0.55
      );
      ctx.restore();
    } else if (particle.shape === "casing") {
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.angle || 0);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.roundRect(
        -(particle.width || particle.size * 1.4) * 0.5,
        -(particle.height || particle.size * 0.45) * 0.5,
        particle.width || particle.size * 1.4,
        particle.height || particle.size * 0.45,
        Math.max(0.6, (particle.height || particle.size * 0.45) * 0.28)
      );
      ctx.fill();
      ctx.fillStyle = "rgba(255, 236, 178, 0.42)";
      ctx.fillRect(
        -(particle.width || particle.size * 1.4) * 0.18,
        -(particle.height || particle.size * 0.45) * 0.36,
        (particle.width || particle.size * 1.4) * 0.42,
        Math.max(0.7, (particle.height || particle.size * 0.45) * 0.3)
      );
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
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
  applyScreenShader();
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
  const context = ensureAudio();
  if (context?.state === "suspended") {
    context.resume().catch(() => {});
  }
  ensureMusicTracks();
  musicUnlocked = true;
  syncPreferredMusic();
};

window.addEventListener("pointerdown", unlockMenuAudio, { passive: true });
window.addEventListener("keydown", unlockMenuAudio);
window.addEventListener("touchstart", unlockMenuAudio, { passive: true });
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    syncPreferredMusic();
  } else {
    stopMusicTracks();
  }
});

for (const card of classCards) {
  card.addEventListener("click", () => {
    selectClass(card.dataset.class || "stealther");
  });
}

for (const button of shopButtons) {
  button.addEventListener("click", () => {
    buyPrepItem(button.dataset.item);
  });
}

for (const button of musicDeckButtons) {
  button.addEventListener("click", () => {
    ensureAudio();
    musicUnlocked = true;
    setPreferredMusicMode(button.dataset.musicMode || "auto");
  });
}

for (const button of adminDeckButtons) {
  button.addEventListener("click", () => {
    runAdminAction(button.dataset.adminAction || "");
  });
}

shopResetButton?.addEventListener("click", () => {
  refundPendingPrep();
  setStatusMessage("Prep staging refunded.");
});

breachClassGrid?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-upgrade-id]");
  if (!button) {
    return;
  }
  buyMidshopUpgrade("class", button.dataset.upgradeId || "");
});

breachUtilityGrid?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-upgrade-id]");
  if (!button) {
    return;
  }
  buyMidshopUpgrade("utility", button.dataset.upgradeId || "");
});

breachContinueButton?.addEventListener("click", () => {
  continueFromBreachShop();
});

breachSkipButton?.addEventListener("click", () => {
  continueFromBreachShop();
});

musicSlider?.addEventListener("input", () => {
  audioSettings.music = clamp(Number(musicSlider.value) / 100, 0, 1);
  applyAudioSettings();
  saveAudioSettings();
});

sfxSlider?.addEventListener("input", () => {
  audioSettings.sfx = clamp((Number(sfxSlider.value) / 100) * 1.4, 0, 1.4);
  applyAudioSettings();
  saveAudioSettings();
});

profileDisplayNameInput?.addEventListener("input", () => {
  playerProfile.displayName = normalizeProfileDisplayName(profileDisplayNameInput.value);
  if (gameState?.player) {
    gameState.player.displayName = playerProfile.displayName;
  }
  syncProfileUi();
  savePlayerProfile();
});

profileTitleInput?.addEventListener("input", () => {
  playerProfile.title = normalizeProfileTitle(profileTitleInput.value);
  if (gameState?.player) {
    gameState.player.title = playerProfile.title;
  }
  syncProfileUi();
  savePlayerProfile();
});

visualModeSelect?.addEventListener("input", () => {
  setVisualMode(visualModeSelect.value);
});

visualModeInline?.addEventListener("input", () => {
  setVisualMode(visualModeInline.value);
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
    event.preventDefault();
  }

  if (key === "m" && !event.repeat) {
    event.preventDefault();
    ensureAudio();
    musicUnlocked = true;
    syncPreferredMusic();
    setMusicDeckVisible(!musicDeckVisible);
    return;
  }

  if (key === "f9" && !event.repeat) {
    event.preventDefault();
    setDebugOverlayVisible(!debugOverlayVisible);
    return;
  }

  if (breachOverlay?.classList.contains("is-visible")) {
    if (key === "enter" && !event.repeat) {
      event.preventDefault();
      continueFromBreachShop();
    }
    return;
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

  if (key === "c") {
    useClassAbility();
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
  musicUnlocked = true;
  ensureMusicTracks();
  startGame();
});

restartButton.addEventListener("click", () => {
  ensureAudio();
  musicUnlocked = true;
  ensureMusicTracks();
  requestRaidRestart();
});

for (const button of debugActionButtons) {
  button.addEventListener("click", () => {
    runDebugAction(button.dataset.debugAction || "");
  });
}

updateClassSelectionUi();
Object.values(CHARACTER_SPRITES).forEach(loadSprite);
Object.values(ENVIRONMENT_ASSETS).forEach(loadSprite);
loadPlayerProfile();
loadAudioSettings();
loadVisualMode();
ensureAudio();
applyAudioSettings();
applyVisualMode(activeVisualMode);
syncMusicDeckUi();
setMusicDeckVisible(false);
syncShopUi();

function renderGameToText() {
  const state = gameState;
  const zoneCenter = {
    x: extractionZone.x + extractionZone.w * 0.5,
    y: extractionZone.y + extractionZone.h * 0.5,
  };
  const visibleEnemies = (state?.enemies || [])
    .filter((enemy) => !enemy.dead && canPlayerSee(enemy))
    .slice(0, 6)
    .map((enemy) => ({
      id: enemy.id,
      kind: enemy.kind,
      state: enemy.state,
      x: Math.round(enemy.x),
      y: Math.round(enemy.y),
      hp: Math.max(0, Math.ceil(enemy.hp || 0)),
    }));
  const visibleLoot = (state?.loot || [])
    .filter((loot) => !loot.collected && canPlayerSee(loot))
    .slice(0, 8)
    .map((loot) => ({
      id: loot.id,
      type: loot.type,
      x: Math.round(loot.x),
      y: Math.round(loot.y),
    }));

  return JSON.stringify({
    protocolVersion: protocolApi.PROTOCOL_VERSION || runtimeConfig.protocolVersion || 1,
    coordinateSystem: "origin top-left; +x right; +y down",
    levelId: state?.levelId || "freight",
    mode: state?.running ? "running" : state?.ended ? "ended" : "lobby",
    phase: state?.networkPhase || "lobby",
    player: state?.player
      ? {
          x: Math.round(state.player.x),
          y: Math.round(state.player.y),
          vx: Math.round(state.player.vx || 0),
          vy: Math.round(state.player.vy || 0),
          hp: state.player.hp,
          maxHp: state.player.maxHp,
          ammo: state.player.ammo,
          magSize: state.player.magSize,
          quietMode: Boolean(state.player.quietMode),
          ability: getAbilityStatusText(state.player),
        }
      : null,
    objective: state
      ? {
          progress: `${state.lootCollected}/${state.requiredLoot}`,
          label: getObjectiveLabels(state).short,
        }
      : null,
    extraction: state
      ? {
          label: getExtractionHudLabel(state),
          zoneCenterX: Math.round(zoneCenter.x),
          zoneCenterY: Math.round(zoneCenter.y),
        }
      : null,
    squad: state ? getSquadHudLabel(state) : "Squad offline",
    visibleEnemies,
    visibleLoot,
    recentStatus: state?.message || "",
  });
}

function advanceTime(ms) {
  const step = 1000 / 60;
  const steps = Math.max(1, Math.round(Math.max(0, Number(ms) || 0) / step));
  for (let index = 0; index < steps; index += 1) {
    update(1 / 60);
  }
  drawWorld();
  applyScreenShader();
  return renderGameToText();
}

window.__raidRuntime = {
  getState: () => gameState,
  getSelectedClass: () => selectedClass,
  selectClass,
  exportWorldState,
  applyWorldState,
  getCombatSnapshot,
  applyCombatSnapshot,
  applyCombatEvent,
  adoptHostAuthorityState,
  applyAuthoritativeLocalState,
  applyRemoteAction,
  isRaidHost: () => isRaidHost(),
  setNetworkStatus: (message) => {
    if (!gameState?.running) {
      setStatusMessage(message);
    }
    if (message) {
      pushNetworkEvent(message);
      syncDebugOverlay();
    }
  },
  setSocketStatus: (state) => {
    setSocketUiState(state);
    syncDebugOverlay();
  },
  noteSnapshotReceived: (serverTime = null) => {
    networkUiState.lastSnapshotAt = performance.now();
  },
  applyRestartStatus,
  applyRestartCommit,
  applyStatusMessage,
  applyRaidTransition,
  publishRestartRequest: () => {},
  reconnectNetwork: () => {},
  setRemotePlayers: (players) => {
    if (gameState) {
      const previousPlayers = new Map((gameState.remotePlayers || []).map((player) => [player.id, player]));
      const now = performance.now();
      const sampleTtlMs = Number(movementReconciliationConfig.remoteSampleTtlMs) || 1000;
      gameState.remotePlayers = players.map((player) => {
        const previous = previousPlayers.get(player.id);
        const becameActive = previous?.running === false && player.running !== false;
        const networkSamples = Array.isArray(previous?.networkSamples)
          ? previous.networkSamples.filter((sample) => now - sample.time <= sampleTtlMs)
          : [];
        if (Number.isFinite(player.x) && Number.isFinite(player.y)) {
          networkSamples.push({
            time: now,
            x: player.x,
            y: player.y,
            angle: Number.isFinite(player.angle) ? player.angle : previous?.targetAngle || 0,
          });
        }
        return {
          ...previous,
          ...player,
          x: Number.isFinite(previous?.x) ? previous.x : player.x,
          y: Number.isFinite(previous?.y) ? previous.y : player.y,
          syncX: Number.isFinite(player.x) ? player.x : previous?.syncX,
          syncY: Number.isFinite(player.y) ? player.y : previous?.syncY,
          targetAngle: Number.isFinite(player.angle) ? player.angle : previous?.targetAngle,
          spawnGraceUntil:
            becameActive
              ? now * 0.001 + 2.6
              : Number.isFinite(previous?.spawnGraceUntil)
                ? previous.spawnGraceUntil
                : 0,
          displayName:
            typeof player.displayName === "string" ? normalizeProfileDisplayName(player.displayName) : previous?.displayName,
          title: typeof player.title === "string" ? normalizeProfileTitle(player.title) : previous?.title,
          networkSamples,
        };
      });
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
    syncRestartOverlayUi();
    syncDebugOverlay();
  },
  getLocalSnapshot: () => {
    if (!gameState) {
      return null;
    }

    const player = gameState.player;
    return {
      className: selectedClass,
      displayName: normalizeProfileDisplayName(playerProfile.displayName),
      title: normalizeProfileTitle(playerProfile.title),
      weaponLabel: player.weapon.label,
      x: player.x,
      y: player.y,
      radius: player.radius,
      vx: player.vx,
      vy: player.vy,
      angle: player.angle,
      hp: player.hp,
      maxHp: player.maxHp,
      ammo: player.ammo,
      magSize: player.magSize,
      reloadTime: player.reloadTime,
      shieldEquipped: player.shieldEquipped,
      shieldHp: player.shieldHp,
      spriteVariant: player.spriteVariant,
      adminInvisible: Boolean(player.adminInvisible),
      adminGodMode: Boolean(player.adminGodMode),
      invisible: player.invisible,
      medkits: player.medkits,
      noiseCharges: player.noiseCharges,
      cash: gameState.cash,
      running: gameState.running,
    };
  },
  getLocalInputState: () => {
    if (!gameState) {
      return null;
    }

    const player = gameState.player;
    return {
      className: selectedClass,
      displayName: normalizeProfileDisplayName(playerProfile.displayName),
      title: normalizeProfileTitle(playerProfile.title),
      weaponLabel: player.weapon.label,
      x: player.x,
      y: player.y,
      radius: player.radius,
      vx: player.vx,
      vy: player.vy,
      angle: player.angle,
      spriteVariant: player.spriteVariant,
      running: gameState.running,
      quietMode: Boolean(player.quietMode),
      seed: buildLocalSeedState(),
    };
  },
  getLocalInputFrame: () => {
    if (!gameState) {
      return null;
    }

    const player = gameState.player;
    const moveX = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
    const moveY = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
    const actionState = consumeQueuedNetworkActions();
    return {
      moveX,
      moveY,
      aimAngle: player.angle,
      shootPressed: Boolean(actionState.shootPressed),
      fireHeld: Boolean(pointer.down),
      sprintHeld: Boolean(keys.has("shift")),
      quietHeld: Boolean(player.quietMode && !keys.has("shift")),
      ...actionState,
      className: selectedClass,
      displayName: normalizeProfileDisplayName(playerProfile.displayName),
      title: normalizeProfileTitle(playerProfile.title),
      weaponLabel: player.weapon.label,
      spriteVariant: player.spriteVariant,
      running: Boolean(gameState.running),
      quietMode: Boolean(player.quietMode),
      seed: buildLocalSeedState(),
      spawn: {
        x: player.x,
        y: player.y,
        radius: player.radius,
      },
    };
  },
  publishWorldAction: () => {},
  publishWorldState: () => {},
  publishPlayerAction: () => {},
  publishPlayerPatch: () => {},
  setRoomPhase: (phase) => {
    if (gameState) {
      const nextPhase = phase || gameState.networkPhase;
      gameState.networkPhase = gameState.running && nextPhase === "lobby" ? "running" : nextPhase;
    }
    syncRestartOverlayUi();
    syncDebugOverlay();
  },
};
window.render_game_to_text = renderGameToText;
window.advanceTime = advanceTime;
resetGame();
syncPreferredMusic();
resizeCanvas();
animationFrameId = window.requestAnimationFrame((timestamp) => {
  lastTime = timestamp;
  loop(timestamp);
});
