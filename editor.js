const WORLD = {
  width: 2600,
  height: 1800,
};
const SPRITE_SCALE = 1.14;

const SPAWN_KEYS = ["player", "core", "shield", "medkit", "noise", "cash", "enemy"];
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
const DEFAULT_CONTAINER_ASSET = "assets/environment/container.png";
const { ENVIRONMENT_ASSET_BOUNDS, isRoofAssetPath, isLampAssetPath, getEntityVisualRect, drawAssetImage } = window.DDDAssetRendering;
const OBSTACLE_BOUNDS_PROFILES = {
  crate: { x: 0.08, y: 0.08, w: 0.84, h: 0.84 },
};
const IMAGE_ASSET_OPTIONS = [
  DEFAULT_CONTAINER_ASSET,
  "assets/environment/painted_lane_tile.jpg",
  "assets/environment/base_freight_floor.jpg",
  "assets/characters/Stealther.png",
  "assets/characters/stealther_advanced.png",
  "assets/characters/Breacher.png",
  "assets/characters/Breacher_advanced.png",
  "assets/characters/Marksman.png",
  "assets/characters/Shielded_marksman.png",
  "assets/characters/Enemy_guard.png",
  "assets/characters/Enemy_rusher.png",
  "assets/characters/cyber_specimen.png",
  "assets/characters/WARDEN.png",
  "assets/characters/WARd3n_THE_KINGS_MACHINE.png",
  "assets/intro/6a63c51b-da78-4630-bcb6-1b0efba35904.jpg",
];

const canvas = document.querySelector("#editor-canvas");
const ctx = canvas.getContext("2d");
const levelSelect = document.querySelector("#level-select");
const layerSelect = document.querySelector("#layer-select");
const entityList = document.querySelector("#entity-list");
const entityCount = document.querySelector("#entity-count");
const entityFilterInput = document.querySelector("#entity-filter");
const assetPalette = document.querySelector("#asset-palette");
const assetFilterInput = document.querySelector("#asset-filter");
const assetCount = document.querySelector("#asset-count");
const inspectorForm = document.querySelector("#inspector-form");
const inspectorLayer = document.querySelector("#inspector-layer");
const levelMetaForm = document.querySelector("#level-meta-form");
const toolSelectButton = document.querySelector("#tool-select");
const toolAddButton = document.querySelector("#tool-add");
const deleteEntityButton = document.querySelector("#delete-entity");
const duplicateEntityButton = document.querySelector("#duplicate-entity");
const reloadSourceButton = document.querySelector("#reload-source");
const saveSourceButton = document.querySelector("#save-source");
const resetViewButton = document.querySelector("#reset-view");
const undoActionButton = document.querySelector("#undo-action");
const redoActionButton = document.querySelector("#redo-action");
const layerControls = document.querySelector("#layer-controls");
const sourceStatus = document.querySelector("#source-status");
const toolReadout = document.querySelector("#tool-readout");
const assetTargetReadout = document.querySelector("#asset-target-readout");
const smartPlacementToggle = document.querySelector("#smart-placement-toggle");
const boundsModeToggle = document.querySelector("#bounds-mode-toggle");
const autoFitToggle = document.querySelector("#auto-fit-toggle");
const snapToggle = document.querySelector("#snap-toggle");
const snapSizeSelect = document.querySelector("#snap-size-select");
const rotateLeftButton = document.querySelector("#rotate-left");
const rotateRightButton = document.querySelector("#rotate-right");
const buildingToolSelect = document.querySelector("#building-tool-select");
const playtestToggle = document.querySelector("#playtest-toggle");
const zoomReadout = document.querySelector("#zoom-readout");
const cursorReadout = document.querySelector("#cursor-readout");
const selectionReadout = document.querySelector("#selection-readout");
const copyLayerJsonButton = document.querySelector("#copy-layer-json");
const copyLevelJsonButton = document.querySelector("#copy-level-json");
const copyWorkspaceJsonButton = document.querySelector("#copy-workspace-json");
const downloadLevelJsonButton = document.querySelector("#download-level-json");
const assetOptions = document.querySelector("#asset-options");
const validationList = document.querySelector("#validation-list");
const validationCount = document.querySelector("#validation-count");

const imageCache = new Map();
const floorPreviewCache = new Map();
const assetBoundsCache = new Map();
const state = {
  levels: {},
  levelOrder: [],
  currentLevelId: "",
  currentLayer: "obstacles",
  availableAssets: [...IMAGE_ASSET_OPTIONS],
  selectedAsset: "",
  smartPlacement: true,
  boundsMode: "collision",
  autoFitCollision: true,
  gridEnabled: false,
  gridSize: 100,
  buildingTool: "off",
  playtest: {
    active: false,
    player: { x: 0, y: 0, radius: 16, angle: 0, speed: 250 },
    keys: { up: false, down: false, left: false, right: false },
    lastTimestamp: 0,
  },
  tool: "select",
  selection: null,
  entityFilter: "",
  assetFilter: "",
  dragMode: null,
  dragStartWorld: null,
  dragOriginEntity: null,
  dragOriginLayer: null,
  dragResizeHandle: null,
  dragOriginView: null,
  pointer: { x: 0, y: 0, worldX: 0, worldY: 0, rawWorldX: 0, rawWorldY: 0, snappedWorldX: 0, snappedWorldY: 0 },
  view: { x: 0, y: 0, zoom: 1 },
  idCounter: 1,
  layerUi: {},
  history: {
    undo: [],
    redo: [],
    limit: 80,
  },
  dragChanged: false,
  selectionBox: null,
};

function structuredCloneSafe(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createEditorId(prefix = "entity") {
  const id = `${prefix}-${state.idCounter}`;
  state.idCounter += 1;
  return id;
}

function basename(path) {
  return String(path || "").split("/").pop() || "";
}

function dirname(path) {
  const normalized = String(path || "");
  const parts = normalized.split("/");
  parts.pop();
  return parts.join("/");
}

function isImageAsset(path) {
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(String(path || ""));
}

function snapValue(value, size = state.gridSize) {
  return Math.round(value / size) * size;
}

function snapPoint(point, size = state.gridSize) {
  return {
    x: snapValue(point.x, size),
    y: snapValue(point.y, size),
  };
}

function placementPoint() {
  return state.gridEnabled
    ? { x: state.pointer.snappedWorldX, y: state.pointer.snappedWorldY }
    : { x: state.pointer.rawWorldX, y: state.pointer.rawWorldY };
}

function assetProfile(asset = state.selectedAsset) {
  const lower = String(asset || "").toLowerCase();
  const name = basename(lower);

  if (!asset || !isImageAsset(asset)) {
    return { asset, category: "generic", recommendedLayer: state.currentLayer, label: "Manual" };
  }

  if (lower.startsWith("assets/characters/")) {
    if (name === "enemy_guard.png") {
      return { asset, category: "npc", recommendedLayer: "fixedEnemies", enemyKind: "guard", label: "Fixed Enemies: Guard" };
    }
    if (name === "enemy_rusher.png") {
      return { asset, category: "npc", recommendedLayer: "fixedEnemies", enemyKind: "rusher", label: "Fixed Enemies: Rusher" };
    }
    if (name === "cyber_specimen.png") {
      return { asset, category: "npc", recommendedLayer: "fixedEnemies", enemyKind: "specimen", label: "Fixed Enemies: Specimen" };
    }
    if (name === "warden.png" || name === "ward3n_the_kings_machine.png") {
      return { asset, category: "npc", recommendedLayer: "fixedEnemies", enemyKind: "boss", label: "Fixed Enemies: Boss" };
    }
    return { asset, category: "sprite", recommendedLayer: "decor", decorLayer: "mid", defaultW: 96, defaultH: 96, label: "Decor: Character Sprite" };
  }

  if (lower.startsWith("assets/environment/")) {
    if (isLampAssetPath(name)) {
      return {
        asset,
        category: "light",
        recommendedLayer: "lights",
        defaultW: 56,
        defaultH: 56,
        label: "Lights: Lamp Fixture",
      };
    }
    if (isRoofAssetPath(name)) {
      return {
        asset,
        category: "roof",
        recommendedLayer: "decor",
        decorLayer: "roof",
        defaultW: 260,
        defaultH: 200,
        label: "Decor: Rooftop Overlay",
      };
    }
    if (name.includes("crate")) {
      return {
        asset,
        category: "crate",
        recommendedLayer: "obstacles",
        obstacleKind: "crate",
        defaultColliderW: 78,
        defaultColliderH: 78,
        defaultW: 84,
        defaultH: 84,
        label: "Obstacles: Crate",
      };
    }
    if (name.includes("container")) {
      return {
        asset,
        category: "prop",
        recommendedLayer: "obstacles",
        obstacleKind: "freightLongH",
        defaultColliderW: 212,
        defaultColliderH: 92,
        defaultW: 236,
        defaultH: 112,
        label: "Obstacles: Container",
      };
    }
    if (
      name.includes("wall") ||
      name.includes("barrier") ||
      name.includes("barricade") ||
      name.includes("fence") ||
      name.includes("gate") ||
      name.includes("pallet")
    ) {
      return {
        asset,
        category: "obstacle-art",
        recommendedLayer: "obstacles",
        obstacleKind: name.includes("fence") ? "fence" : "wall",
        defaultColliderW: name.includes("wall") ? 140 : 110,
        defaultColliderH: name.includes("wall") ? 80 : 70,
        defaultW: name.includes("wall") ? 156 : 120,
        defaultH: name.includes("wall") ? 92 : 82,
        label: "Obstacles: Barrier",
      };
    }
    if (name.includes("floor") || name.includes("tile")) {
      return { asset, category: "floor", recommendedLayer: "decor", decorLayer: "ground", defaultW: 160, defaultH: 160, label: "Decor: Floor Tile" };
    }
    return { asset, category: "prop", recommendedLayer: "decor", decorLayer: "mid", defaultW: 96, defaultH: 96, label: "Decor: Prop" };
  }

  return { asset, category: "art", recommendedLayer: "decor", decorLayer: "mid", defaultW: 128, defaultH: 128, label: "Decor: Image" };
}

function inferContainerPresetForEntity(entity) {
  const visualRect = getVisualRect(entity, "obstacles") || entity;
  const vertical = isQuarterTurnVerticalRotation(entity.rotation || 0) || visualRect.h > visualRect.w;
  const longSide = Math.max(visualRect.w || entity.w || 0, visualRect.h || entity.h || 0);
  if (vertical) {
    return longSide >= 220 ? "freightLongV" : "freightShortV";
  }
  return longSide >= 220 ? "freightLongH" : "freightShortH";
}

function normalizeEntityForAssignedAsset(entity, layer, options = {}) {
  if (!entity || !("asset" in entity) || !entity.asset) {
    return;
  }

  const profile = assetProfile(entity.asset);
  const silent = options.silent === true;

  if (layer === "decor") {
    entity.layer = profile.decorLayer || (profile.category === "floor" ? "ground" : profile.category === "roof" ? "roof" : "mid");
    return;
  }

  if (layer === "obstacles") {
    if (profile.category === "crate") {
      entity.kind = "crate";
      delete entity.visualType;
      delete entity.containerPreset;
      if (typeof entity.drawW !== "number") {
        entity.drawW = profile.defaultW || entity.w;
      }
      if (typeof entity.drawH !== "number") {
        entity.drawH = profile.defaultH || entity.h;
      }
      return;
    }

    if (profile.asset === DEFAULT_CONTAINER_ASSET || profile.label === "Obstacles: Container") {
      entity.visualType = "container";
      entity.containerPreset = entity.containerPreset || inferContainerPresetForEntity(entity);
      if (!silent && entity.kind === "crate") {
        updateSourceStatus("Container asset replaced crate behavior on this obstacle.", "info");
      }
      return;
    }

    if (profile.category === "obstacle-art") {
      if (entity.kind === "crate" && !silent) {
        updateSourceStatus("Barrier art replaced crate behavior on this obstacle.", "info");
      }
      if (entity.kind === "crate") {
        entity.kind = profile.obstacleKind || "wall";
      }
      delete entity.visualType;
      delete entity.containerPreset;
      return;
    }

    if ((profile.category === "floor" || profile.category === "roof" || profile.category === "sprite") && !silent) {
      updateSourceStatus(`${profile.label} is not a natural obstacle asset.`, "warning");
    }
    return;
  }

  if (layer === "buildings") {
    if (profile.category === "floor" && !silent) {
      updateSourceStatus("Floor tiles belong on Decor / Textures, not Buildings.", "warning");
    } else if (profile.category === "sprite" && !silent) {
      updateSourceStatus("Character sprites do not belong on Buildings.", "warning");
    }
  }
}

function effectiveAddLayer() {
  if (!state.smartPlacement) {
    return state.currentLayer;
  }
  const profile = assetProfile();
  return profile.recommendedLayer || state.currentLayer;
}

function updatePlacementControls() {
  if (assetTargetReadout) {
    assetTargetReadout.textContent = state.smartPlacement ? assetProfile().label : currentLayerDefinition().label;
  }
  if (smartPlacementToggle) {
    smartPlacementToggle.textContent = state.smartPlacement ? "Auto" : "Manual";
    smartPlacementToggle.classList.toggle("is-active", state.smartPlacement);
  }
  if (boundsModeToggle) {
    boundsModeToggle.textContent = state.boundsMode === "visual" ? "Visual" : "Collision";
    boundsModeToggle.classList.toggle("is-active", state.boundsMode === "collision");
  }
  if (autoFitToggle) {
    autoFitToggle.textContent = state.autoFitCollision ? "On" : "Off";
    autoFitToggle.classList.toggle("is-active", state.autoFitCollision);
  }
  if (snapToggle) {
    snapToggle.textContent = state.gridEnabled ? "On" : "Off";
    snapToggle.classList.toggle("is-active", state.gridEnabled);
  }
  if (snapSizeSelect) {
    snapSizeSelect.value = String(state.gridSize);
    snapSizeSelect.disabled = !state.gridEnabled;
  }
  if (buildingToolSelect) {
    buildingToolSelect.value = state.buildingTool;
    buildingToolSelect.disabled = !selectedBuildingEntity();
  }
  if (playtestToggle) {
    playtestToggle.textContent = state.playtest.active ? "On" : "Off";
    playtestToggle.classList.toggle("is-active", state.playtest.active);
  }
}

function layerDefinitions() {
  return [
    { value: "obstacles", label: "Obstacles" },
    { value: "buildings", label: "Buildings" },
    { value: "lights", label: "Lights" },
    { value: "fixedEnemies", label: "Fixed Enemies" },
    { value: "squadSpawns", label: "Squad Spawns" },
    { value: "enemyPreview", label: "Enemy Preview" },
    { value: "specimenZones", label: "Specimen Zones" },
    { value: "decor", label: "Decor / Textures" },
    { value: "extractionZone", label: "Extraction Zone" },
    ...SPAWN_KEYS.map((key) => ({ value: `spawn:${key}`, label: `Spawn Pool: ${key}` })),
  ];
}

function ensureLayerUiState() {
  const next = {};
  for (const entry of layerDefinitions()) {
    const previous = state.layerUi[entry.value] || {};
    next[entry.value] = {
      visible: previous.visible !== false,
      locked: Boolean(previous.locked),
    };
  }
  state.layerUi = next;
}

function isLayerVisible(layer) {
  return state.layerUi[layer]?.visible !== false;
}

function isLayerLocked(layer) {
  return Boolean(state.layerUi[layer]?.locked);
}

function serializeWorkspaceState() {
  return {
    levels: serializeWorkspace(),
    levelOrder: [...state.levelOrder],
    currentLevelId: state.currentLevelId,
    currentLayer: state.currentLayer,
    selection: state.selection ? { ...state.selection } : null,
  };
}

function restoreWorkspaceState(snapshot) {
  if (!snapshot?.levels) {
    return;
  }
  const restoredLevels = {};
  for (const [key, value] of Object.entries(snapshot.levels)) {
    restoredLevels[key] = normalizeTemplate(value);
  }
  state.levels = restoredLevels;
  state.levelOrder = snapshot.levelOrder?.filter((key) => restoredLevels[key]) || Object.keys(restoredLevels);
  state.currentLevelId = restoredLevels[snapshot.currentLevelId] ? snapshot.currentLevelId : state.levelOrder[0] || "";
  state.currentLayer = layerDefinitionByValue(snapshot.currentLayer)?.value || "obstacles";
  const nextSelection = snapshot.selection
    ? {
        layer: snapshot.selection.layer,
        entityId: snapshot.selection.entityId,
      }
    : null;
  state.selection = null;
  renderLevelSelect();
  renderLayerSelect();
  renderLevelMeta();
  renderEntityList();
  renderInspector();
  renderLayerControls();
  renderValidation();
  setSelection(nextSelection);
  if (state.playtest.active) {
    placePlaytestPlayer();
    requestPlaytestFrame();
  }
  draw();
}

function pushHistorySnapshot(label = "Edit") {
  state.history.undo.push({
    label,
    snapshot: serializeWorkspaceState(),
  });
  if (state.history.undo.length > state.history.limit) {
    state.history.undo.shift();
  }
  state.history.redo = [];
  updateHistoryButtons();
}

function updateHistoryButtons() {
  if (undoActionButton) {
    undoActionButton.disabled = state.history.undo.length === 0;
    undoActionButton.textContent = state.history.undo.length ? `Undo` : "Undo";
  }
  if (redoActionButton) {
    redoActionButton.disabled = state.history.redo.length === 0;
    redoActionButton.textContent = state.history.redo.length ? `Redo` : "Redo";
  }
}

function undoHistory() {
  const entry = state.history.undo.pop();
  if (!entry) {
    return;
  }
  state.history.redo.push({
    label: entry.label,
    snapshot: serializeWorkspaceState(),
  });
  restoreWorkspaceState(entry.snapshot);
  updateHistoryButtons();
  updateSourceStatus(`Undid: ${entry.label}.`, "success");
}

function redoHistory() {
  const entry = state.history.redo.pop();
  if (!entry) {
    return;
  }
  state.history.undo.push({
    label: entry.label,
    snapshot: serializeWorkspaceState(),
  });
  restoreWorkspaceState(entry.snapshot);
  updateHistoryButtons();
  updateSourceStatus(`Redid: ${entry.label}.`, "success");
}

function currentLevel() {
  return state.levels[state.currentLevelId] || null;
}

function currentLayerDefinition() {
  return layerDefinitions().find((entry) => entry.value === state.currentLayer) || layerDefinitions()[0];
}

function layerDefinitionByValue(value) {
  return layerDefinitions().find((entry) => entry.value === value) || null;
}

function isReadOnlyLayer(layer) {
  return layer === "enemyPreview" || isLayerLocked(layer);
}

function getSquadSpawnEntities(level = currentLevel()) {
  if (!level) {
    return [];
  }
  return level.buildings.flatMap((building) =>
    (building.squadSpawns || []).map((entry) => {
      entry._parentBuildingId = building.id;
      return entry;
    })
  );
}

function getEnemyPreviewEntities(level = currentLevel()) {
  if (!level) {
    return [];
  }

  const roamEntries = (level.spawnPools.enemy || []).map((entry, index) => ({
    _editorId: `preview-roam-${index}`,
    x: entry.x,
    y: entry.y,
    previewKind: "roam-spawn",
    label: `roam spawn ${index + 1}`,
  }));

  const squadEntries = getSquadSpawnEntities(level).map((entry) => ({
    _editorId: `preview-squad-${entry._editorId}`,
    x: entry.x,
    y: entry.y,
    kind: entry.kind,
    shield: entry.shield,
    previewKind: "squad-spawn",
    label: `${entry.kind || "enemy"} squad`,
  }));

  const fixedEntries = (level.fixedEnemies || []).map((entry) => ({
    _editorId: `preview-fixed-${entry._editorId}`,
    x: entry.x,
    y: entry.y,
    kind: entry.kind,
    shield: entry.shield,
    previewKind: "fixed-enemy",
    label: entry.id || entry.kind || "fixed enemy",
  }));

  return [...roamEntries, ...squadEntries, ...fixedEntries];
}

function markEntity(entity, prefix) {
  if (!entity._editorId) {
    entity._editorId = createEditorId(prefix);
  }
  return entity;
}

function normalizeSpawnPools(source = {}) {
  const result = {};
  for (const key of SPAWN_KEYS) {
    result[key] = (source[key] || []).map((entry) => markEntity({ ...entry }, `spawn-${key}`));
  }
  return result;
}

function rectToEdgeMeta(building, rect) {
  if (!rect) {
    return { id: "door", side: "south", offset: 0, size: 60 };
  }

  const prefix = `${building.id}-`;
  const rawId = typeof rect.id === "string" && rect.id.startsWith(prefix) ? rect.id.slice(prefix.length) : rect.id || "door";

  if (rect.side === "north" || rect.side === "south") {
    return {
      id: rawId,
      side: rect.side,
      offset: rect.x - building.x,
      size: rect.w,
    };
  }

  return {
    id: rawId,
    side: rect.side,
    offset: rect.y - building.y,
    size: rect.h,
  };
}

function edgeMetaToRect(building, entry, kind) {
  const thickness = 12;
  const id = `${building.id}-${entry.id || kind}`;

  if (entry.side === "north" || entry.side === "south") {
    return {
      id,
      side: entry.side,
      x: building.x + entry.offset,
      y: entry.side === "north" ? building.y : building.y + building.h - thickness,
      w: entry.size,
      h: thickness,
      kind,
    };
  }

  return {
    id,
    side: entry.side,
    x: entry.side === "west" ? building.x : building.x + building.w - thickness,
    y: building.y + entry.offset,
    w: thickness,
    h: entry.size,
    kind,
  };
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

function getBuildingSegments(level = currentLevel()) {
  if (!level) {
    return [];
  }

  const segments = [];
  for (const building of level.buildings) {
    const northOpenings = [
      ...(building.windows || []).filter((windowEntry) => windowEntry.side === "north" && !windowEntry.broken),
      ...(building.door?.side === "north" && building.door?.open ? [building.door] : []),
    ];
    const southOpenings = [
      ...(building.windows || []).filter((windowEntry) => windowEntry.side === "south" && !windowEntry.broken),
      ...(building.door?.side === "south" && building.door?.open ? [building.door] : []),
    ];
    const westOpenings = [
      ...(building.windows || []).filter((windowEntry) => windowEntry.side === "west" && !windowEntry.broken),
      ...(building.door?.side === "west" && building.door?.open ? [building.door] : []),
    ];
    const eastOpenings = [
      ...(building.windows || []).filter((windowEntry) => windowEntry.side === "east" && !windowEntry.broken),
      ...(building.door?.side === "east" && building.door?.open ? [building.door] : []),
    ];

    addWallSegments(segments, "north", building.x, building.y, building.w, northOpenings);
    addWallSegments(segments, "south", building.x, building.y + building.h - 12, building.w, southOpenings);
    addWallSegments(segments, "west", building.x, building.y, building.h, westOpenings);
    addWallSegments(segments, "east", building.x + building.w - 12, building.y, building.h, eastOpenings);

    if (building.door && !building.door.open) {
      segments.push({ ...building.door });
    }
    for (const windowEntry of building.windows || []) {
      if (!windowEntry.broken) {
        segments.push({ ...windowEntry });
      }
    }
  }

  return segments;
}

function syncBuildingOpenings(building) {
  building.doorMeta = building.doorMeta || rectToEdgeMeta(building, building.door);
  building.windowMeta = building.windowMeta || (building.windows || []).map((entry) => rectToEdgeMeta(building, entry));
  building.door = {
    ...edgeMetaToRect(building, building.doorMeta, "door"),
    open: Boolean(building.door?.open),
  };
  building.windows = building.windowMeta.map((entry) => ({
    ...edgeMetaToRect(building, entry, "window"),
    broken: false,
  }));
}

function normalizeBuilding(building) {
  const next = markEntity(structuredCloneSafe(building), "building");
  next.squadSpawns = (next.squadSpawns || []).map((entry) =>
    markEntity(
      {
        ...entry,
        _parentBuildingId: next.id,
      },
      "squad-spawn"
    )
  );
  next.doorMeta = rectToEdgeMeta(next, next.door);
  next.windowMeta = (next.windows || []).map((entry) => rectToEdgeMeta(next, entry));
  syncBuildingOpenings(next);
  return next;
}

function normalizeTemplate(template) {
  const normalized = structuredCloneSafe(template);
  normalized.obstacles = (normalized.obstacles || []).map((entry) => markEntity({ ...entry }, "obstacle"));
  if (normalized.id === "freight") {
    normalized.obstacles = normalized.obstacles.map((entry) => normalizeFreightContainerObstacle(entry));
  }
  normalized.obstacles = normalized.obstacles.map((entry) => applyLegacyObstacleAssetMapping(entry));
  normalized.buildings = (normalized.buildings || []).map(normalizeBuilding);
  normalized.lightSources = (normalized.lightSources || []).map((entry) =>
    markEntity(
      {
        radius: 160,
        intensity: 0.2,
        color: "rgba(232, 244, 255, 0.2)",
        pulse: 0,
        asset: "",
        assetSize: 56,
        ...entry,
      },
      "light"
    )
  );
  normalized.fixedEnemies = (normalized.fixedEnemies || []).map((entry) => markEntity({ ...entry }, "enemy"));
  normalized.specimenZones = (normalized.specimenZones || []).map((entry) => markEntity({ ...entry }, "specimen-zone"));
  normalized.decor = (normalized.decor || []).map((entry) => markEntity({ ...entry }, "decor"));
  normalized.extractionZone = markEntity({ ...(normalized.extractionZone || { x: 0, y: 0, w: 180, h: 120 }) }, "extraction");
  normalized.spawnPools = normalizeSpawnPools(normalized.spawnPools);
  normalized.enemyDefinitions = (normalized.enemyDefinitions || []).map((entry) => ({ ...entry }));
  return normalized;
}

function getLevelVisualTheme(levelId) {
  if (levelId === "admin") {
    return {
      base: "#d6d2cb",
      gridMinor: "rgba(109, 111, 112, 0.08)",
      gridMajor: "rgba(88, 92, 96, 0.12)",
      ambientTop: "rgba(255, 248, 236, 0.08)",
      ambientMid: "rgba(145, 133, 118, 0.07)",
      ambientBottom: "rgba(70, 74, 79, 0.07)",
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
      extractionFill: "rgba(171, 152, 97, 0.16)",
      extractionStroke: "rgba(137, 114, 54, 0.84)",
      extractionText: "rgba(88, 67, 29, 0.96)",
      extractionLabel: "TRANSFER",
      worldGlow: "rgba(255, 248, 235, 0.14)",
      obstacleStripeHeight: 2,
    };
  }

  if (levelId === "reactor") {
    return {
      base: "#bbc4ce",
      gridMinor: "rgba(96, 106, 118, 0.12)",
      gridMajor: "rgba(88, 96, 108, 0.14)",
      ambientTop: "rgba(252, 242, 223, 0.08)",
      ambientMid: "rgba(138, 120, 98, 0.08)",
      ambientBottom: "rgba(50, 58, 66, 0.08)",
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
    extractionFill: "rgba(170, 188, 201, 0.18)",
    extractionStroke: "rgba(126, 143, 159, 0.8)",
    extractionText: "rgba(99, 116, 132, 1)",
    extractionLabel: "TRANSIT",
    worldGlow: "rgba(255, 255, 255, 0.18)",
    obstacleStripeHeight: 2,
  };
}

function isContainerObstacle(obstacle, levelId = currentLevel()?.id) {
  if (obstacle.visualType === "container") {
    return true;
  }
  if (levelId !== "freight" || obstacle.kind) {
    return false;
  }
  return (obstacle.w >= 180 || obstacle.h >= 180) && Math.abs(obstacle.w - obstacle.h) > 40;
}

function normalizeFreightContainerObstacle(obstacle) {
  if (!isContainerObstacle(obstacle, "freight") || obstacle.kind) {
    return obstacle;
  }

  const wide = obstacle.w >= obstacle.h;
  const centerX = obstacle.x + obstacle.w * 0.5;
  const centerY = obstacle.y + obstacle.h * 0.5;
  const presetKey = wide
    ? obstacle.w >= 260
      ? "freightLongH"
      : "freightShortH"
    : obstacle.h >= 260
      ? "freightLongV"
      : "freightShortV";
  const preset = CONTAINER_PRESETS[presetKey];

  return {
    ...obstacle,
    x: Math.round(centerX - preset.colliderW * 0.5),
    y: Math.round(centerY - preset.colliderH * 0.5),
    w: preset.colliderW,
    h: preset.colliderH,
    drawW: preset.drawW,
    drawH: preset.drawH,
    visualType: "container",
    containerPreset: presetKey,
  };
}

function resolveContainerPresetKey(obstacle) {
  if (!obstacle) {
    return null;
  }
  if (obstacle.containerPreset && CONTAINER_PRESETS[obstacle.containerPreset]) {
    return obstacle.containerPreset;
  }
  if (obstacle.kind && CONTAINER_PRESETS[obstacle.kind]) {
    return obstacle.kind;
  }
  return null;
}

function getContainerPresetBounds(presetKey) {
  const preset = presetKey ? CONTAINER_PRESETS[presetKey] : null;
  if (!preset) {
    return null;
  }
  return {
    x: (preset.drawW - preset.colliderW) / (2 * preset.drawW),
    y: (preset.drawH - preset.colliderH) / (2 * preset.drawH),
    w: preset.colliderW / preset.drawW,
    h: preset.colliderH / preset.drawH,
  };
}

function applyLegacyObstacleAssetMapping(obstacle) {
  const presetKey = resolveContainerPresetKey(obstacle);
  if (!presetKey) {
    return obstacle;
  }

  const preset = CONTAINER_PRESETS[presetKey];
  const next = {
    ...obstacle,
    visualType: "container",
    containerPreset: presetKey,
    asset: obstacle.asset || DEFAULT_CONTAINER_ASSET,
  };

  if (typeof next.drawW !== "number") {
    next.drawW = preset.drawW;
  }
  if (typeof next.drawH !== "number") {
    next.drawH = preset.drawH;
  }
  if (typeof next.drawOffsetX !== "number") {
    next.drawOffsetX = Math.round((next.w - next.drawW) * 0.5);
  }
  if (typeof next.drawOffsetY !== "number") {
    next.drawOffsetY = Math.round((next.h - next.drawH) * 0.5);
  }
  if (typeof next.rotation !== "number") {
    next.rotation = preset.rotation;
  }
  return next;
}

async function loadLevelTemplatesFromSource() {
  const response = await fetch("app.js", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load app.js (${response.status})`);
  }

  const source = await response.text();
  const start = source.indexOf("const obstacles = [");
  const end = source.indexOf("let activeLayoutId =", start);
  if (start === -1 || end === -1) {
    throw new Error("Could not find level template block in app.js");
  }

  const snippet = source.slice(start, end);
  const factory = new Function(
    `
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
      ${snippet}
      return LEVEL_TEMPLATES;
    `
  );

  const templates = factory();
  const levels = {};
  for (const [key, template] of Object.entries(templates)) {
    levels[key] = normalizeTemplate(template);
  }
  return levels;
}

function populateAssetOptions() {
  assetOptions.innerHTML = "";
  for (const path of state.availableAssets) {
    const option = document.createElement("option");
    option.value = path;
    assetOptions.append(option);
  }
}

function preferredDecorAssetForLevel(levelId = currentLevel()?.id) {
  if (levelId === "freight") {
    return "assets/environment/painted_lane_tile.jpg";
  }
  return "assets/environment/base_freight_floor.jpg";
}

function resolveDefaultPlaceableAsset(levelId = currentLevel()?.id) {
  const preferred = state.selectedAsset || preferredDecorAssetForLevel(levelId);
  if (preferred && state.availableAssets.includes(preferred)) {
    return preferred;
  }
  const environmentAsset = state.availableAssets.find((entry) => entry.startsWith("assets/environment/"));
  if (environmentAsset) {
    return environmentAsset;
  }
  return state.availableAssets[0] || IMAGE_ASSET_OPTIONS.find(isImageAsset) || "";
}

function setSelectedAsset(asset, options = {}) {
  if (!asset || !isImageAsset(asset)) {
    return;
  }
  state.selectedAsset = asset;
  if (assetFilterInput && options.syncFilter !== false) {
    assetFilterInput.placeholder = basename(asset);
  }

  const entity = selectedEntity();
  if (options.applyToSelection === true && entity && "asset" in entity && !selectedEntityIsReadOnly()) {
    entity.asset = asset;
    normalizeEntityForAssignedAsset(entity, selectedEntityLayer(), { silent: true });
    autoFitEntityCollisionIfEnabled(entity, selectedEntityLayer());
    renderEntityList();
    renderInspector();
    renderValidation();
    draw();
  }

  renderAssetPalette();
  updatePlacementControls();
}

function filteredAssets() {
  const query = state.assetFilter.trim().toLowerCase();
  return state.availableAssets.filter((entry) => {
    if (!isImageAsset(entry)) {
      return false;
    }
    if (!query) {
      return true;
    }
    return `${basename(entry)} ${dirname(entry)}`.toLowerCase().includes(query);
  });
}

function renderAssetPalette() {
  if (!assetPalette) {
    return;
  }

  const assets = filteredAssets();
  assetPalette.innerHTML = "";
  if (assetCount) {
    assetCount.textContent = `${assets.length}`;
  }

  if (!assets.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No matching image assets.";
    assetPalette.append(empty);
    return;
  }

  for (const asset of assets) {
    const profile = assetProfile(asset);
    const row = document.createElement("button");
    row.type = "button";
    row.className = "asset-row";
    if (asset === state.selectedAsset) {
      row.classList.add("is-selected");
    }

    const thumb = document.createElement("img");
    thumb.className = "asset-thumb";
    thumb.src = asset;
    thumb.alt = basename(asset);

    const text = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = basename(asset);
    const meta = document.createElement("span");
    meta.textContent = `${dirname(asset) || "assets"} • ${profile.label}`;
    text.append(title, meta);

    row.append(thumb, text);
    row.addEventListener("click", () => {
      setSelectedAsset(asset);
      updateSourceStatus(`Active asset: ${basename(asset)}`, "success");
    });
    assetPalette.append(row);
  }
}

async function loadAvailableAssets() {
  try {
    const response = await fetch("/api/assets", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Asset listing failed (${response.status})`);
    }

    const payload = await response.json();
    if (Array.isArray(payload.files) && payload.files.length) {
      state.availableAssets = payload.files.filter(isImageAsset);
    } else {
      state.availableAssets = IMAGE_ASSET_OPTIONS.filter(isImageAsset);
    }
  } catch {
    state.availableAssets = IMAGE_ASSET_OPTIONS.filter(isImageAsset);
  }

  if (!state.selectedAsset || !state.availableAssets.includes(state.selectedAsset)) {
    state.selectedAsset = resolveDefaultPlaceableAsset();
  }
  populateAssetOptions();
  renderAssetPalette();
}

function updateSourceStatus(message, tone = "neutral") {
  sourceStatus.textContent = message;
  sourceStatus.style.color = tone === "error" ? "var(--danger)" : tone === "success" ? "var(--accent)" : "var(--accent-warm)";
}

function setTool(tool) {
  state.tool = tool;
  toolSelectButton.classList.toggle("is-active", tool === "select");
  toolAddButton.classList.toggle("is-active", tool === "add");
  toolReadout.textContent = tool === "add" ? "Add" : "Select";
}

function getEntitiesForLayer(level = currentLevel(), layer = state.currentLayer) {
  if (!level) {
    return [];
  }
  if (layer === "obstacles") {
    return level.obstacles;
  }
  if (layer === "buildings") {
    return level.buildings;
  }
  if (layer === "lights") {
    return level.lightSources || [];
  }
  if (layer === "fixedEnemies") {
    return level.fixedEnemies;
  }
  if (layer === "squadSpawns") {
    return getSquadSpawnEntities(level);
  }
  if (layer === "enemyPreview") {
    return getEnemyPreviewEntities(level);
  }
  if (layer === "specimenZones") {
    return level.specimenZones;
  }
  if (layer === "decor") {
    return level.decor;
  }
  if (layer === "extractionZone") {
    return [level.extractionZone];
  }
  if (layer.startsWith("spawn:")) {
    const key = layer.split(":")[1];
    return level.spawnPools[key] || [];
  }
  return [];
}

function selectedEntity(selection = state.selection) {
  if (!selection) {
    return null;
  }
  return getEntitiesForLayer(currentLevel(), selection.layer).find((entry) => entry._editorId === selection.entityId) || null;
}

function labelForEntity(entity, layer = state.currentLayer) {
  if (!entity) {
    return "none";
  }
  if (layer === "obstacles") {
    return `${entity.kind || "wall"} ${entity.id || entity._editorId}`;
  }
  if (layer === "buildings") {
    return entity.label || entity.id || entity._editorId;
  }
  if (layer === "lights") {
    return entity.label || basename(entity.asset) || entity.id || entity._editorId;
  }
  if (layer === "fixedEnemies") {
    return `${entity.kind || "enemy"} ${entity.id || entity._editorId}`;
  }
  if (layer === "squadSpawns") {
    return `${entity.kind || "enemy"} ${entity._parentBuildingId || "building"}`;
  }
  if (layer === "enemyPreview") {
    return entity.label || entity.previewKind || "enemy preview";
  }
  if (layer === "specimenZones") {
    return entity.label || entity.id || entity._editorId;
  }
  if (layer === "decor") {
    return basename(entity.asset) || entity.id || entity._editorId;
  }
  if (layer === "extractionZone") {
    return "Extraction Zone";
  }
  if (layer.startsWith("spawn:")) {
    return `${layer.split(":")[1]} spawn ${entity._editorId}`;
  }
  return entity.id || entity._editorId;
}

function detailForEntity(entity) {
  if (!entity) {
    return "";
  }
  if ("w" in entity && "h" in entity) {
    return `${Math.round(entity.x)}, ${Math.round(entity.y)} • ${Math.round(entity.w)} x ${Math.round(entity.h)}`;
  }
  return `${Math.round(entity.x)}, ${Math.round(entity.y)}`;
}

function setSelection(selection) {
  state.selection = selection;
  const entity = selectedEntity(selection);
  if (entity && "asset" in entity && entity.asset && isImageAsset(entity.asset)) {
    state.selectedAsset = entity.asset;
  }
  renderEntityList();
  renderInspector();
  updateReadouts();
  renderAssetPalette();
  updatePlacementControls();
}

function clearSelection() {
  setSelection(null);
}

function renderLevelSelect() {
  levelSelect.innerHTML = "";
  for (const key of state.levelOrder) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = state.levels[key].name || key;
    option.selected = key === state.currentLevelId;
    levelSelect.append(option);
  }
}

function renderLayerSelect() {
  layerSelect.innerHTML = "";
  for (const entry of layerDefinitions()) {
    const option = document.createElement("option");
    option.value = entry.value;
    option.textContent = entry.label;
    option.selected = entry.value === state.currentLayer;
    layerSelect.append(option);
  }
  layerSelect.value = state.currentLayer;
}

function renderLayerControls() {
  if (!layerControls) {
    return;
  }

  layerControls.innerHTML = "";
  for (const entry of layerDefinitions()) {
    const row = document.createElement("div");
    row.className = "layer-row";
    if (entry.value === state.currentLayer) {
      row.classList.add("is-current");
    }

    const meta = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = entry.label;
    const subtitle = document.createElement("span");
    subtitle.textContent = isReadOnlyLayer(entry.value) && entry.value !== "enemyPreview"
      ? "Locked"
      : entry.value === "enemyPreview"
        ? "Preview only"
        : isLayerVisible(entry.value)
          ? "Visible"
          : "Hidden";
    meta.append(title, subtitle);

    const visibleButton = document.createElement("button");
    visibleButton.type = "button";
    visibleButton.className = `layer-mini${isLayerVisible(entry.value) ? " is-active" : ""}`;
    visibleButton.textContent = isLayerVisible(entry.value) ? "Shown" : "Hidden";
    visibleButton.addEventListener("click", () => {
      state.layerUi[entry.value].visible = !state.layerUi[entry.value].visible;
      if (!isLayerVisible(entry.value) && state.selection?.layer === entry.value) {
        clearSelection();
      }
      renderLayerControls();
      draw();
    });

    const lockButton = document.createElement("button");
    lockButton.type = "button";
    lockButton.className = `layer-mini${isLayerLocked(entry.value) ? " is-active" : ""}`;
    lockButton.textContent = entry.value === "enemyPreview" ? "Read" : isLayerLocked(entry.value) ? "Locked" : "Edit";
    lockButton.disabled = entry.value === "enemyPreview";
    lockButton.addEventListener("click", () => {
      state.layerUi[entry.value].locked = !state.layerUi[entry.value].locked;
      renderLayerControls();
      renderInspector();
      draw();
    });

    row.append(meta, visibleButton, lockButton);
    layerControls.append(row);
  }
}

function validateCurrentLevel(level = currentLevel()) {
  if (!level) {
    return [];
  }

  const findings = [];
  const pushFinding = (severity, title, detail) => {
    findings.push({ severity, title, detail });
  };

  if (!level.spawnPools?.player?.length) {
    pushFinding("error", "No player spawns", "Add at least one player spawn or playtest/runtime entry will fail.");
  }

  if (!level.extractionZone || level.extractionZone.w <= 0 || level.extractionZone.h <= 0) {
    pushFinding("error", "Invalid extraction zone", "Extraction zone is missing or has zero size.");
  }

  if (!level.buildings?.length) {
    pushFinding("warning", "No buildings", "This level currently has no buildings or interior routes.");
  }

  if ((level.requiredLoot || 0) > 0 && (level.spawnPools?.core?.length || 0) < level.requiredLoot) {
    pushFinding("error", "Not enough objective spawns", `Required loot is ${level.requiredLoot}, but only ${(level.spawnPools?.core?.length || 0)} core spawns exist.`);
  }

  for (const building of level.buildings || []) {
    if (!building.door) {
      pushFinding("warning", `Building ${building.id || building.label || "unknown"} has no door`, "Playtest traversal may be misleading.");
    }
  }

  for (const obstacle of level.obstacles || []) {
    if (obstacle.x < 0 || obstacle.y < 0 || obstacle.x + obstacle.w > WORLD.width || obstacle.y + obstacle.h > WORLD.height) {
      pushFinding("warning", `Obstacle outside world`, `${obstacle.id || obstacle.kind || obstacle._editorId} extends past world bounds.`);
      break;
    }
    if (obstacle.asset) {
      const profile = assetProfile(obstacle.asset);
      if (profile.category === "floor") {
        pushFinding("warning", "Floor asset on obstacle", `${obstacle.id || obstacle.kind || obstacle._editorId} uses floor art as an obstacle.`);
      } else if (profile.category === "roof") {
        pushFinding("warning", "Roof asset on obstacle", `${obstacle.id || obstacle.kind || obstacle._editorId} should probably be a building.`);
      } else if (profile.category === "crate" && obstacle.kind !== "crate") {
        pushFinding("warning", "Crate asset mismatch", `${obstacle.id || obstacle.kind || obstacle._editorId} uses crate art but is not kind "crate".`);
      }
    }
  }

  for (const decor of level.decor || []) {
    if (!decor.asset) {
      continue;
    }
    const profile = assetProfile(decor.asset);
    if (profile.category === "roof" && decor.layer !== "roof") {
      pushFinding("warning", "Roof decor on wrong layer", `${decor.id || decor._editorId} should use decor layer "roof".`);
    }
    if (profile.category === "floor" && decor.layer !== "ground") {
      pushFinding("warning", "Floor decor on wrong layer", `${decor.id || decor._editorId} should use decor layer "ground".`);
    }
  }

  return findings;
}

function renderValidation() {
  if (!validationList || !validationCount) {
    return;
  }

  const findings = validateCurrentLevel();
  validationCount.textContent = `${findings.length}`;
  validationList.innerHTML = "";

  if (!findings.length) {
    const empty = document.createElement("div");
    empty.className = "validation-row validation-empty";
    empty.textContent = "No obvious validation issues found.";
    validationList.append(empty);
    return;
  }

  for (const finding of findings) {
    const row = document.createElement("div");
    row.className = `validation-row validation-row--${finding.severity}`;
    const title = document.createElement("strong");
    title.textContent = finding.title;
    const detail = document.createElement("span");
    detail.textContent = finding.detail;
    row.append(title, detail);
    validationList.append(row);
  }
}

function renderEntityList() {
  const entities = getEntitiesForLayer();
  const query = state.entityFilter.trim().toLowerCase();
  const filteredEntities = query
    ? entities.filter((entity) => {
        const haystack = `${labelForEntity(entity)} ${detailForEntity(entity)}`.toLowerCase();
        return haystack.includes(query);
      })
    : entities;
  entityCount.textContent = `${filteredEntities.length}/${entities.length}`;
  entityList.innerHTML = "";

  if (!filteredEntities.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = entities.length ? "No matches in this layer." : "No entities in this layer yet.";
    entityList.append(empty);
    return;
  }

  for (const entity of filteredEntities) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "entity-row";
    if (state.selection && entity._editorId === state.selection.entityId && state.selection.layer === state.currentLayer) {
      row.classList.add("is-selected");
    }

    const title = document.createElement("strong");
    title.textContent = labelForEntity(entity);
    const meta = document.createElement("span");
    meta.textContent = detailForEntity(entity);
    row.append(title, meta);
    row.addEventListener("click", () => {
      setSelection({ layer: state.currentLayer, entityId: entity._editorId });
      draw();
    });
    entityList.append(row);
  }
}

function fieldWrapper(label) {
  const wrapper = document.createElement("label");
  wrapper.className = "field";
  const title = document.createElement("span");
  title.textContent = label;
  wrapper.append(title);
  return wrapper;
}

function createActionButton(label, onClick, variant = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = variant;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function getPathValue(target, path) {
  return path.split(".").reduce((value, key) => (value == null ? value : value[key]), target);
}

function setPathValue(target, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  let cursor = target;
  for (const key of keys) {
    if (!cursor[key] || typeof cursor[key] !== "object") {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[last] = value;
}

function createInputField(target, config, onAfterChange) {
  const wrapper = fieldWrapper(config.label);
  const beforeChange = () => {
    if (typeof config.onBeforeChange === "function") {
      config.onBeforeChange();
    }
  };
  let committed = false;
  const commit = (value) => {
    if (!committed) {
      beforeChange();
      committed = true;
    }
    setPathValue(target, config.path, value);
    onAfterChange();
  };

  if (config.type === "checkbox") {
    const row = document.createElement("label");
    row.className = "checkbox-row";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(getPathValue(target, config.path));
    input.addEventListener("change", () => {
      commit(input.checked);
    });
    const text = document.createElement("span");
    text.textContent = config.copy || "Enabled";
    row.append(input, text);
    wrapper.append(row);
    return wrapper;
  }

  if (config.type === "select") {
    const select = document.createElement("select");
    for (const optionValue of config.options) {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionValue;
      option.selected = optionValue === getPathValue(target, config.path);
      select.append(option);
    }
    select.addEventListener("change", () => {
      commit(select.value);
    });
    wrapper.append(select);
    return wrapper;
  }

  const input = config.type === "textarea" || config.type === "json" ? document.createElement("textarea") : document.createElement("input");
  if (config.type === "number") {
    input.type = "number";
    input.step = config.step || "1";
  } else if (config.type === "text") {
    input.type = "text";
  }

  if (config.list) {
    input.setAttribute("list", config.list);
  }

  if (config.type === "json") {
    input.value = JSON.stringify(getPathValue(target, config.path) ?? config.defaultValue ?? [], null, 2);
    const error = document.createElement("div");
    error.className = "field-error";
    input.addEventListener("change", () => {
      try {
        const parsed = JSON.parse(input.value || "null");
        commit(parsed);
        error.textContent = "";
      } catch {
        error.textContent = "Invalid JSON";
      }
    });
    wrapper.append(input, error);
    return wrapper;
  }

  input.value = getPathValue(target, config.path) ?? "";
  const commitInput = () => {
    const value = config.type === "number" ? Number(input.value || 0) : input.value;
    commit(value);
  };
  input.addEventListener("change", commitInput);
  if (config.path === "asset" || config.live === true) {
    input.addEventListener("input", commitInput);
  }
  wrapper.append(input);
  return wrapper;
}

function renderLevelMeta() {
  const level = currentLevel();
  levelMetaForm.innerHTML = "";
  if (!level) {
    return;
  }
  const remember = () => pushHistorySnapshot("Edit level meta");
  const commitMeta = () => {
    renderValidation();
    draw();
  };

  const rowA = document.createElement("div");
  rowA.className = "field-row";
  rowA.append(
    createInputField(level, { label: "ID", type: "text", path: "id", onBeforeChange: remember }, commitMeta),
    createInputField(level, { label: "Name", type: "text", path: "name", onBeforeChange: remember }, commitMeta)
  );

  const rowB = document.createElement("div");
  rowB.className = "field-row field-row--triple";
  rowB.append(
    createInputField(level, { label: "Duration", type: "number", path: "duration", onBeforeChange: remember }, commitMeta),
    createInputField(level, { label: "Required Loot", type: "number", path: "requiredLoot", onBeforeChange: remember }, commitMeta),
    createInputField(level, { label: "Boss Required", type: "checkbox", path: "bossRequired", copy: "Boss gate active", onBeforeChange: remember }, commitMeta)
  );

  levelMetaForm.append(
    rowA,
    rowB,
    createInputField(level, { label: "Objective", type: "textarea", path: "objective", onBeforeChange: remember }, commitMeta),
    createInputField(level, { label: "Extraction Prompt", type: "textarea", path: "extractionPrompt", onBeforeChange: remember }, commitMeta),
    createInputField(level, { label: "Next Level ID", type: "text", path: "nextLevelId", onBeforeChange: remember }, commitMeta),
    createInputField(level, { label: "Transition Message", type: "textarea", path: "transitionMessage", onBeforeChange: remember }, commitMeta)
  );
}

function renderInspector() {
  inspectorForm.innerHTML = "";
  const entity = selectedEntity();
  const layer = selectedEntityLayer();
  if (!entity) {
    inspectorLayer.textContent = "No selection";
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Select an entity to edit its properties.";
    inspectorForm.append(empty);
    return;
  }

  inspectorLayer.textContent = selectedLayerDefinition().label;
  const remember = () => pushHistorySnapshot(`Edit ${selectedLayerDefinition().label}`);
  const field = (target, config) => createInputField(target, { ...config, onBeforeChange: config.onBeforeChange || remember }, commit);
  const commit = () => {
    if ("asset" in entity && entity.asset && isImageAsset(entity.asset)) {
      state.selectedAsset = entity.asset;
      normalizeEntityForAssignedAsset(entity, layer);
    }
    if (layer === "buildings") {
      syncBuildingOpenings(entity);
    }
    autoFitEntityCollisionIfEnabled(entity, layer);
    renderEntityList();
    draw();
    renderAssetPalette();
    renderValidation();
  };

  if (layer === "obstacles") {
    ensureVisualBounds(entity, layer);
    inspectorForm.append(
      field(entity, { label: "ID", type: "text", path: "id" }),
      field(entity, { label: "Kind", type: "text", path: "kind" }),
      field(entity, { label: "Asset", type: "text", path: "asset", list: "asset-options" })
    );
    const actionRow = document.createElement("div");
    actionRow.className = "button-row";
    actionRow.append(
      createActionButton("Fit Collision To Asset", () => {
        pushHistorySnapshot(`Fit collider for ${labelForEntity(entity, layer)}`);
        if (fitColliderToMappedAsset(entity, layer)) {
          renderEntityList();
          renderInspector();
          renderValidation();
          draw();
          updateSourceStatus(`Fitted collision to ${basename(entity.asset)}.`, "success");
        }
      })
    );
    const rowA = document.createElement("div");
    rowA.className = "field-row field-row--triple";
    rowA.append(
      field(entity, { label: "X", type: "number", path: "x" }),
      field(entity, { label: "Y", type: "number", path: "y" }),
      field(entity, { label: "W", type: "number", path: "w" })
    );
    const rowB = document.createElement("div");
    rowB.className = "field-row field-row--triple";
    rowB.append(
      field(entity, { label: "H", type: "number", path: "h" }),
      field(entity, { label: "Loot Type", type: "text", path: "lootType" }),
      field(entity, { label: "Loot Value", type: "number", path: "lootValue" })
    );
    const rowC = document.createElement("div");
    rowC.className = "field-row";
    rowC.append(
      field(entity, { label: "Rotation", type: "number", path: "rotation", step: "0.1" }),
      field(entity, { label: "Opacity", type: "number", path: "opacity", step: "0.05" })
    );
    const rowD = document.createElement("div");
    rowD.className = "field-row field-row--triple";
    rowD.append(
      field(entity, { label: "Draw Offset X", type: "number", path: "drawOffsetX" }),
      field(entity, { label: "Draw Offset Y", type: "number", path: "drawOffsetY" }),
      field(entity, { label: "Draw W", type: "number", path: "drawW" })
    );
    inspectorForm.append(actionRow, rowA, rowB, rowC, rowD, field(entity, { label: "Draw H", type: "number", path: "drawH" }));
    return;
  }

  if (layer === "buildings") {
    ensureVisualBounds(entity, layer);
    const rowA = document.createElement("div");
    rowA.className = "field-row";
    rowA.append(
      field(entity, { label: "ID", type: "text", path: "id" }),
      field(entity, { label: "Label", type: "text", path: "label" })
    );
    const rowB = document.createElement("div");
    rowB.className = "field-row field-row--triple";
    rowB.append(
      field(entity, { label: "X", type: "number", path: "x" }),
      field(entity, { label: "Y", type: "number", path: "y" }),
      field(entity, { label: "W", type: "number", path: "w" })
    );
    const rowC = document.createElement("div");
    rowC.className = "field-row field-row--triple";
    rowC.append(
      field(entity, { label: "H", type: "number", path: "h" }),
      field(entity, { label: "Door Side", type: "select", path: "doorMeta.side", options: ["north", "south", "east", "west"] }),
      field(entity, { label: "Door Offset", type: "number", path: "doorMeta.offset" })
    );
    const rowD = document.createElement("div");
    rowD.className = "field-row";
    rowD.append(
      field(entity, { label: "Asset", type: "text", path: "asset", list: "asset-options" }),
      field(entity, { label: "Opacity", type: "number", path: "opacity", step: "0.05" })
    );
    const rowGrid = document.createElement("div");
    rowGrid.className = "field-row field-row--triple";
    rowGrid.append(
      field(entity, { label: "Grid Size", type: "number", path: "gridSize" }),
      field(entity, { label: "Door Side", type: "select", path: "doorMeta.side", options: ["north", "south", "east", "west"] }),
      field(entity, { label: "Door Offset", type: "number", path: "doorMeta.offset" })
    );
    const actionRow = document.createElement("div");
    actionRow.className = "button-row";
    actionRow.append(
      createActionButton("Rotate Left", () => rotateSelectedEntity(-Math.PI * 0.5)),
      createActionButton("Rotate Right", () => rotateSelectedEntity(Math.PI * 0.5)),
      createActionButton("Snap Shell", () => {
        pushHistorySnapshot(`Snap shell for ${labelForEntity(entity, layer)}`);
        if (snapBuildingSkeleton(entity)) {
          renderEntityList();
          renderInspector();
          renderValidation();
          draw();
          updateSourceStatus(`Snapped ${entity.label || entity.id} to its building grid.`, "success");
        }
      }),
      createActionButton("Fit Collision To Asset", () => {
        pushHistorySnapshot(`Fit collider for ${labelForEntity(entity, layer)}`);
        if (fitColliderToMappedAsset(entity, layer)) {
          renderEntityList();
          renderInspector();
          renderValidation();
          draw();
          updateSourceStatus(`Fitted collision to ${basename(entity.asset)}.`, "success");
        }
      })
    );
    const rowE = document.createElement("div");
    rowE.className = "field-row field-row--triple";
    rowE.append(
      field(entity, { label: "Draw Offset X", type: "number", path: "drawOffsetX" }),
      field(entity, { label: "Draw Offset Y", type: "number", path: "drawOffsetY" }),
      field(entity, { label: "Draw W", type: "number", path: "drawW" })
    );
    inspectorForm.append(
      rowA,
      rowB,
      rowGrid,
      rowD,
      actionRow,
      rowE,
      field(entity, { label: "Door Size", type: "number", path: "doorMeta.size" }),
      rowC,
      field(entity, { label: "Draw H", type: "number", path: "drawH" }),
      field(entity, { label: "Window Meta JSON", type: "json", path: "windowMeta", defaultValue: [] }),
      field(entity, { label: "Squad Spawns JSON", type: "json", path: "squadSpawns", defaultValue: [] })
    );
    return;
  }

  if (layer === "lights") {
    const rowA = document.createElement("div");
    rowA.className = "field-row";
    rowA.append(
      field(entity, { label: "ID", type: "text", path: "id" }),
      field(entity, { label: "Label", type: "text", path: "label" })
    );
    const rowB = document.createElement("div");
    rowB.className = "field-row field-row--triple";
    rowB.append(
      field(entity, { label: "X", type: "number", path: "x" }),
      field(entity, { label: "Y", type: "number", path: "y" }),
      field(entity, { label: "Radius", type: "number", path: "radius" })
    );
    const rowC = document.createElement("div");
    rowC.className = "field-row field-row--triple";
    rowC.append(
      field(entity, { label: "Intensity", type: "number", path: "intensity", step: "0.01" }),
      field(entity, { label: "Pulse", type: "number", path: "pulse", step: "0.01" }),
      field(entity, { label: "Asset Size", type: "number", path: "assetSize" })
    );
    inspectorForm.append(
      rowA,
      rowB,
      rowC,
      field(entity, { label: "Asset", type: "text", path: "asset", list: "asset-options" }),
      field(entity, { label: "Color", type: "text", path: "color" })
    );
    return;
  }

  if (layer === "fixedEnemies") {
    const rowA = document.createElement("div");
    rowA.className = "field-row";
    rowA.append(
      field(entity, { label: "ID", type: "text", path: "id" }),
      field(entity, { label: "Kind", type: "select", path: "kind", options: ["rusher", "guard", "boss", "specimen"] })
    );
    const rowB = document.createElement("div");
    rowB.className = "field-row field-row--triple";
    rowB.append(
      field(entity, { label: "X", type: "number", path: "x" }),
      field(entity, { label: "Y", type: "number", path: "y" }),
      field(entity, { label: "Angle", type: "number", path: "angle", step: "0.1" })
    );
    inspectorForm.append(
      rowA,
      rowB,
      field(entity, { label: "Tactic", type: "text", path: "tactic" }),
      field(entity, { label: "Squad Role", type: "text", path: "squadRole" }),
      field(entity, { label: "Zone ID", type: "text", path: "zoneId" }),
      field(entity, { label: "Release Heat", type: "number", path: "releaseHeat" }),
      field(entity, { label: "Shield", type: "checkbox", path: "shield", copy: "Shielded" }),
      field(entity, { label: "Contained", type: "checkbox", path: "contained", copy: "Contained" }),
      field(entity, { label: "Hidden", type: "checkbox", path: "hidden", copy: "Hidden" })
    );
    return;
  }

  if (layer === "squadSpawns") {
    const buildingField = fieldWrapper("Building ID");
    const buildingValue = document.createElement("div");
    buildingValue.className = "empty-state";
    buildingValue.textContent = entity._parentBuildingId || "unknown";
    buildingField.append(buildingValue);
    const rowA = document.createElement("div");
    rowA.className = "field-row";
    rowA.append(
      buildingField,
      field(entity, { label: "Kind", type: "select", path: "kind", options: ["rusher", "guard", "boss", "specimen"] })
    );
    const rowB = document.createElement("div");
    rowB.className = "field-row field-row--triple";
    rowB.append(
      field(entity, { label: "X", type: "number", path: "x" }),
      field(entity, { label: "Y", type: "number", path: "y" }),
      field(entity, { label: "Shield", type: "checkbox", path: "shield", copy: "Shielded" })
    );
    inspectorForm.append(
      rowA,
      rowB,
      field(entity, { label: "Tactic", type: "text", path: "tactic" }),
      field(entity, { label: "Squad Role", type: "text", path: "squadRole" })
    );
    return;
  }

  if (layer === "enemyPreview") {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Enemy Preview is read-only. Edit fixed enemies, squad spawns, or enemy spawn pools from their own layers.";
    inspectorForm.append(empty);
    return;
  }

  if (layer === "specimenZones") {
    inspectorForm.append(
      field(entity, { label: "ID", type: "text", path: "id" }),
      field(entity, { label: "Label", type: "text", path: "label" })
    );
    const rowA = document.createElement("div");
    rowA.className = "field-row field-row--triple";
    rowA.append(
      field(entity, { label: "X", type: "number", path: "x" }),
      field(entity, { label: "Y", type: "number", path: "y" }),
      field(entity, { label: "W", type: "number", path: "w" })
    );
    const rowB = document.createElement("div");
    rowB.className = "field-row field-row--triple";
    rowB.append(
      field(entity, { label: "H", type: "number", path: "h" }),
      field(entity, { label: "Specimen X", type: "number", path: "specimenX" }),
      field(entity, { label: "Specimen Y", type: "number", path: "specimenY" })
    );
    inspectorForm.append(
      rowA,
      rowB,
      field(entity, { label: "Angle", type: "number", path: "angle", step: "0.1" }),
      field(entity, { label: "Release Heat", type: "number", path: "releaseHeat" })
    );
    return;
  }

  if (layer === "decor") {
    const rowA = document.createElement("div");
    rowA.className = "field-row";
    rowA.append(
      field(entity, { label: "ID", type: "text", path: "id" }),
      field(entity, { label: "Asset", type: "text", path: "asset", list: "asset-options" })
    );
    const rowB = document.createElement("div");
    rowB.className = "field-row field-row--triple";
    rowB.append(
      field(entity, { label: "X", type: "number", path: "x" }),
      field(entity, { label: "Y", type: "number", path: "y" }),
      field(entity, { label: "W", type: "number", path: "w" })
    );
    const rowC = document.createElement("div");
    rowC.className = "field-row field-row--triple";
    rowC.append(
      field(entity, { label: "H", type: "number", path: "h" }),
      field(entity, { label: "Rotation", type: "number", path: "rotation", step: "0.1" }),
      field(entity, { label: "Opacity", type: "number", path: "opacity", step: "0.05" })
    );
    inspectorForm.append(
      rowA,
      rowB,
      rowC,
      field(entity, { label: "Layer", type: "text", path: "layer" })
    );
    return;
  }

  if (layer === "extractionZone") {
    const row = document.createElement("div");
    row.className = "field-row field-row--triple";
    row.append(
      field(entity, { label: "X", type: "number", path: "x" }),
      field(entity, { label: "Y", type: "number", path: "y" }),
      field(entity, { label: "W", type: "number", path: "w" })
    );
    inspectorForm.append(row, field(entity, { label: "H", type: "number", path: "h" }));
    return;
  }

  if (layer.startsWith("spawn:")) {
    const row = document.createElement("div");
    row.className = "field-row";
    row.append(
      field(entity, { label: "X", type: "number", path: "x" }),
      field(entity, { label: "Y", type: "number", path: "y" })
    );
    inspectorForm.append(row);
  }
}

function updateReadouts() {
  zoomReadout.textContent = `${Math.round(state.view.zoom * 100)}%`;
  const point = placementPoint();
  cursorReadout.textContent = `${Math.round(point.x)}, ${Math.round(point.y)}${state.gridEnabled ? " snap" : ""}`;
  selectionReadout.textContent = selectedEntity() ? `${selectedLayerDefinition().label}: ${labelForEntity(selectedEntity(), selectedEntityLayer())}` : "none";
  updatePlacementControls();
}

function setCanvasSize() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(640, Math.round(rect.width));
  const height = Math.max(420, Math.round(rect.height));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function frameWorld() {
  setCanvasSize();
  const margin = 36;
  const zoom = Math.min((canvas.width - margin * 2) / WORLD.width, (canvas.height - margin * 2) / WORLD.height);
  state.view.zoom = clamp(zoom, 0.15, 1.4);
  state.view.x = -(canvas.width / state.view.zoom - WORLD.width) / 2;
  state.view.y = -(canvas.height / state.view.zoom - WORLD.height) / 2;
  draw();
}

function screenToWorld(x, y) {
  return {
    x: x / state.view.zoom + state.view.x,
    y: y / state.view.zoom + state.view.y,
  };
}

function updatePointer(event) {
  const rect = canvas.getBoundingClientRect();
  state.pointer.x = event.clientX - rect.left;
  state.pointer.y = event.clientY - rect.top;
  const world = screenToWorld(state.pointer.x, state.pointer.y);
  const snapped = snapPoint(world);
  state.pointer.rawWorldX = world.x;
  state.pointer.rawWorldY = world.y;
  state.pointer.snappedWorldX = snapped.x;
  state.pointer.snappedWorldY = snapped.y;
  state.pointer.worldX = world.x;
  state.pointer.worldY = world.y;
  updateReadouts();
  updateCanvasCursor();
}

function entityRect(entity, layer = state.currentLayer) {
  if (!entity) {
    return null;
  }
  if (layer === "fixedEnemies" || layer === "squadSpawns" || layer === "enemyPreview" || layer.startsWith("spawn:")) {
    const size = layer === "enemyPreview" ? 28 : layer === "fixedEnemies" || layer === "squadSpawns" ? 34 : 24;
    return { x: entity.x - size / 2, y: entity.y - size / 2, w: size, h: size };
  }
  if (layer === "lights") {
    const size = Math.max(22, Number(entity.assetSize) || 44);
    return { x: entity.x - size / 2, y: entity.y - size / 2, w: size, h: size };
  }
  if (layer === "decor") {
    return { x: entity.x, y: entity.y, w: entity.w || 64, h: entity.h || 64 };
  }
  return { x: entity.x, y: entity.y, w: entity.w, h: entity.h };
}

function isPointLayer(layer) {
  return layer === "lights" || layer === "fixedEnemies" || layer === "squadSpawns" || layer === "enemyPreview" || layer.startsWith("spawn:");
}

function isResizableLayer(layer) {
  return !isPointLayer(layer) && layer !== "enemyPreview";
}

function layerSupportsSeparateVisualBounds(layer) {
  return layer === "obstacles" || layer === "buildings";
}

function ensureVisualBounds(entity, layer) {
  if (!entity || !layerSupportsSeparateVisualBounds(layer)) {
    return;
  }
  if (typeof entity.drawOffsetX !== "number") {
    entity.drawOffsetX = 0;
  }
  if (typeof entity.drawOffsetY !== "number") {
    entity.drawOffsetY = 0;
  }
  if (typeof entity.drawW !== "number") {
    entity.drawW = entity.w;
  }
  if (typeof entity.drawH !== "number") {
    entity.drawH = entity.h;
  }
}

function getVisualRect(entity, layer = state.currentLayer) {
  if (!entity) {
    return null;
  }
  return getEntityVisualRect(entity, {
    decorLike: layer === "decor",
    separateBounds: layerSupportsSeparateVisualBounds(layer),
  });
}

function unionRect(a, b) {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.w, b.x + b.w);
  const bottom = Math.max(a.y + a.h, b.y + b.h);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

function rectFromPoints(a, b) {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x, b.x);
  const bottom = Math.max(a.y, b.y);
  return {
    x: left,
    y: top,
    w: Math.max(0, right - left),
    h: Math.max(0, bottom - top),
  };
}

function rectArea(rect) {
  return Math.max(0, rect?.w || 0) * Math.max(0, rect?.h || 0);
}

function editableBoundsModeForLayer(layer) {
  if (state.boundsMode === "visual" && layerSupportsSeparateVisualBounds(layer)) {
    return "visual";
  }
  return "collision";
}

function editableRect(entity, layer = state.currentLayer) {
  if (editableBoundsModeForLayer(layer) === "visual") {
    return getDisplayedVisualRect(entity, layer);
  }
  return entityRect(entity, layer);
}

function resizeHandleSize() {
  return 11 / state.view.zoom;
}

function resizeHandlesForRect(rect) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  return [
    { key: "nw", x: rect.x, y: rect.y },
    { key: "n", x: cx, y: rect.y },
    { key: "ne", x: rect.x + rect.w, y: rect.y },
    { key: "e", x: rect.x + rect.w, y: cy },
    { key: "se", x: rect.x + rect.w, y: rect.y + rect.h },
    { key: "s", x: cx, y: rect.y + rect.h },
    { key: "sw", x: rect.x, y: rect.y + rect.h },
    { key: "w", x: rect.x, y: cy },
  ];
}

function handleCursor(handle) {
  if (handle === "n" || handle === "s") {
    return "ns-resize";
  }
  if (handle === "e" || handle === "w") {
    return "ew-resize";
  }
  if (handle === "ne" || handle === "sw") {
    return "nesw-resize";
  }
  if (handle === "nw" || handle === "se") {
    return "nwse-resize";
  }
  return "crosshair";
}

function resizeHandleHit(point, entity = selectedEntity(), layer = selectedEntityLayer()) {
  if (!entity || !isResizableLayer(layer)) {
    return null;
  }
  const rect = editableRect(entity, layer);
  if (!rect) {
    return null;
  }
  const half = resizeHandleSize();
  const handles = resizeHandlesForRect(rect);
  for (const handle of handles) {
    if (Math.abs(point.x - handle.x) <= half && Math.abs(point.y - handle.y) <= half) {
      return handle.key;
    }
  }
  return null;
}

function applyResize(entity, layer, handle, originRect, point) {
  if (!entity || !originRect || !handle) {
    return;
  }

  const minSize = state.gridEnabled ? state.gridSize : 24;
  let left = originRect.x;
  let top = originRect.y;
  let right = originRect.x + originRect.w;
  let bottom = originRect.y + originRect.h;
  const px = point.x;
  const py = point.y;

  if (handle.includes("w")) {
    left = Math.min(px, right - minSize);
  }
  if (handle.includes("e")) {
    right = Math.max(px, left + minSize);
  }
  if (handle.includes("n")) {
    top = Math.min(py, bottom - minSize);
  }
  if (handle.includes("s")) {
    bottom = Math.max(py, top + minSize);
  }

  if (editableBoundsModeForLayer(layer) === "visual" && layerSupportsSeparateVisualBounds(layer)) {
    ensureVisualBounds(entity, layer);
    if (isQuarterTurnVerticalRotation(entity.rotation || 0)) {
      const centerX = (left + right) * 0.5;
      const centerY = (top + bottom) * 0.5;
      const displayW = Math.max(minSize, Math.round(right - left));
      const displayH = Math.max(minSize, Math.round(bottom - top));
      const nextDrawW = displayH;
      const nextDrawH = displayW;
      entity.drawW = nextDrawW;
      entity.drawH = nextDrawH;
      entity.drawOffsetX = Math.round(centerX - nextDrawW * 0.5 - entity.x);
      entity.drawOffsetY = Math.round(centerY - nextDrawH * 0.5 - entity.y);
      return;
    }
    entity.drawOffsetX = Math.round(left - entity.x);
    entity.drawOffsetY = Math.round(top - entity.y);
    entity.drawW = Math.max(minSize, Math.round(right - left));
    entity.drawH = Math.max(minSize, Math.round(bottom - top));
    return;
  }

  entity.x = Math.round(left);
  entity.y = Math.round(top);
  entity.w = Math.max(minSize, Math.round(right - left));
  entity.h = Math.max(minSize, Math.round(bottom - top));
}

function updateCanvasCursor() {
  let cursor = state.tool === "add" ? "copy" : "crosshair";
  if (state.dragMode === "pan") {
    cursor = "grabbing";
  } else if (state.dragMode === "box-select") {
    cursor = "crosshair";
  } else if (state.dragMode === "move") {
    cursor = "grabbing";
  } else if (state.dragMode === "resize" && state.dragResizeHandle) {
    cursor = handleCursor(state.dragResizeHandle);
  } else if (state.tool !== "add") {
    const handle = resizeHandleHit({ x: state.pointer.worldX, y: state.pointer.worldY });
    if (handle) {
      cursor = handleCursor(handle);
    } else {
      const hit = hitTest({ x: state.pointer.worldX, y: state.pointer.worldY });
      if (hit && canEditLayer(hit.layer)) {
        cursor = "grab";
      }
    }
  }
  canvas.style.cursor = cursor;
}

function rotationStep(event, layer = selectedEntityLayer()) {
  if (layer === "obstacles" || layer === "buildings") {
    return Math.PI * 0.5;
  }
  return event.shiftKey ? Math.PI * 0.25 : Math.PI / 12;
}

function normalizeRotation(angle) {
  let next = angle;
  while (next > Math.PI) {
    next -= Math.PI * 2;
  }
  while (next < -Math.PI) {
    next += Math.PI * 2;
  }
  return next;
}

function selectedEntitySupportsRotation() {
  const entity = selectedEntity();
  const layer = selectedEntityLayer();
  if (!entity || selectedEntityIsReadOnly()) {
    return false;
  }
  return layer === "decor" || layer === "obstacles" || layer === "buildings";
}

function rotatePointAroundPivot(point, pivot, clockwise = true) {
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  return clockwise
    ? { x: pivot.x - dy, y: pivot.y + dx }
    : { x: pivot.x + dy, y: pivot.y - dx };
}

function rotateRectAroundPivot(rect, pivot, clockwise = true) {
  const center = { x: rect.x + rect.w * 0.5, y: rect.y + rect.h * 0.5 };
  const nextCenter = rotatePointAroundPivot(center, pivot, clockwise);
  return {
    x: Math.round(nextCenter.x - rect.h * 0.5),
    y: Math.round(nextCenter.y - rect.w * 0.5),
    w: rect.h,
    h: rect.w,
  };
}

function openingMetaToCenter(meta, width, height) {
  if (meta.side === "north") {
    return { x: meta.offset + meta.size * 0.5, y: 0 };
  }
  if (meta.side === "south") {
    return { x: meta.offset + meta.size * 0.5, y: height };
  }
  if (meta.side === "west") {
    return { x: 0, y: meta.offset + meta.size * 0.5 };
  }
  return { x: width, y: meta.offset + meta.size * 0.5 };
}

function centerToOpeningMeta(point, size, width, height, fallbackId = "opening") {
  const epsilon = 1;
  if (Math.abs(point.y) <= epsilon) {
    return { id: fallbackId, side: "north", offset: Math.round(point.x - size * 0.5), size };
  }
  if (Math.abs(point.y - height) <= epsilon) {
    return { id: fallbackId, side: "south", offset: Math.round(point.x - size * 0.5), size };
  }
  if (Math.abs(point.x) <= epsilon) {
    return { id: fallbackId, side: "west", offset: Math.round(point.y - size * 0.5), size };
  }
  return { id: fallbackId, side: "east", offset: Math.round(point.y - size * 0.5), size };
}

function rotateBuildingEntity(entity, clockwise = true) {
  const oldRect = { x: entity.x, y: entity.y, w: entity.w, h: entity.h };
  const pivot = { x: oldRect.x + oldRect.w * 0.5, y: oldRect.y + oldRect.h * 0.5 };
  const nextRect = rotateRectAroundPivot(oldRect, pivot, clockwise);
  const visualRect = getVisualRect(entity, "buildings");
  const nextVisualRect = visualRect ? rotateRectAroundPivot(visualRect, pivot, clockwise) : null;
  const oldWidth = entity.w;
  const oldHeight = entity.h;

  entity.x = nextRect.x;
  entity.y = nextRect.y;
  entity.w = nextRect.w;
  entity.h = nextRect.h;
  entity.rotation = normalizeRotation((typeof entity.rotation === "number" ? entity.rotation : 0) + (clockwise ? Math.PI * 0.5 : -Math.PI * 0.5));

  if (nextVisualRect) {
    entity.drawOffsetX = Math.round(nextVisualRect.x - entity.x);
    entity.drawOffsetY = Math.round(nextVisualRect.y - entity.y);
    entity.drawW = nextVisualRect.w;
    entity.drawH = nextVisualRect.h;
  }

  entity.doorMeta = centerToOpeningMeta(
    rotatePointAroundPivot(openingMetaToCenter(entity.doorMeta, oldWidth, oldHeight), { x: oldWidth * 0.5, y: oldHeight * 0.5 }, clockwise),
    entity.doorMeta.size,
    entity.w,
    entity.h,
    entity.doorMeta.id || "door"
  );
  entity.windowMeta = (entity.windowMeta || []).map((meta) =>
    centerToOpeningMeta(
      rotatePointAroundPivot(openingMetaToCenter(meta, oldWidth, oldHeight), { x: oldWidth * 0.5, y: oldHeight * 0.5 }, clockwise),
      meta.size,
      entity.w,
      entity.h,
      meta.id || "window"
    )
  );
  entity.squadSpawns = (entity.squadSpawns || []).map((spawn) => {
    const next = rotatePointAroundPivot(
      { x: spawn.x - oldRect.x, y: spawn.y - oldRect.y },
      { x: oldWidth * 0.5, y: oldHeight * 0.5 },
      clockwise
    );
    return {
      ...spawn,
      x: Math.round(entity.x + next.x),
      y: Math.round(entity.y + next.y),
    };
  });
  syncBuildingOpenings(entity);
}

function rotateObstacleEntity(entity, clockwise = true) {
  const collisionRect = { x: entity.x, y: entity.y, w: entity.w, h: entity.h };
  const pivot = { x: collisionRect.x + collisionRect.w * 0.5, y: collisionRect.y + collisionRect.h * 0.5 };
  const nextCollision = rotateRectAroundPivot(collisionRect, pivot, clockwise);
  const visualRect = getVisualRect(entity, "obstacles");
  const nextVisualRect = visualRect ? rotateRectAroundPivot(visualRect, pivot, clockwise) : null;

  entity.x = nextCollision.x;
  entity.y = nextCollision.y;
  entity.w = nextCollision.w;
  entity.h = nextCollision.h;
  entity.rotation = normalizeRotation((typeof entity.rotation === "number" ? entity.rotation : 0) + (clockwise ? Math.PI * 0.5 : -Math.PI * 0.5));

  if (nextVisualRect) {
    entity.drawOffsetX = Math.round(nextVisualRect.x - entity.x);
    entity.drawOffsetY = Math.round(nextVisualRect.y - entity.y);
    entity.drawW = nextVisualRect.w;
    entity.drawH = nextVisualRect.h;
  }
}

function rotateSelectedEntity(delta) {
  if (!selectedEntitySupportsRotation()) {
    return;
  }
  const entity = selectedEntity();
  const layer = selectedEntityLayer();
  pushHistorySnapshot(`Rotate ${labelForEntity(entity, selectedEntityLayer())}`);
  if ((layer === "obstacles" || layer === "buildings") && Math.abs(delta) >= Math.PI * 0.49) {
    if (layer === "obstacles") {
      rotateObstacleEntity(entity, delta > 0);
    } else {
      rotateBuildingEntity(entity, delta > 0);
    }
  } else {
    entity.rotation = normalizeRotation((typeof entity.rotation === "number" ? entity.rotation : 0) + delta);
  }
  renderEntityList();
  renderInspector();
  renderValidation();
  draw();
}

function pointHitsRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function rectIntersectsRect(a, b) {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

function circleIntersectsRect(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy < circle.r * circle.r;
}

function getCollisionRects(level = currentLevel()) {
  if (!level) {
    return [];
  }
  const obstacleRects = (level.obstacles || [])
    .filter((entry) => !(entry.kind === "crate" && entry.broken))
    .map((entry) => ({ x: entry.x, y: entry.y, w: entry.w, h: entry.h, kind: entry.kind || "obstacle" }));
  return [...obstacleRects, ...getBuildingSegments(level)];
}

function playtestPositionBlocked(x, y) {
  const level = currentLevel();
  if (!level) {
    return false;
  }
  const player = state.playtest.player;
  if (x - player.radius < 0 || y - player.radius < 0 || x + player.radius > WORLD.width || y + player.radius > WORLD.height) {
    return true;
  }
  const probe = { x, y, r: player.radius };
  return getCollisionRects(level).some((rect) => circleIntersectsRect(probe, rect));
}

function nearestDoor(radius = 72) {
  const level = currentLevel();
  if (!level) {
    return null;
  }
  const player = state.playtest.player;
  let best = null;
  let bestDistance = radius;
  for (const building of level.buildings || []) {
    if (!building.door) {
      continue;
    }
    const center = {
      x: building.door.x + building.door.w * 0.5,
      y: building.door.y + building.door.h * 0.5,
    };
    const dx = center.x - player.x;
    const dy = center.y - player.y;
    const distanceToDoor = Math.hypot(dx, dy);
    if (distanceToDoor <= bestDistance) {
      bestDistance = distanceToDoor;
      best = building;
    }
  }
  return best;
}

function placePlaytestPlayer() {
  const level = currentLevel();
  const spawn = level?.spawnPools?.player?.[0] || { x: WORLD.width * 0.5, y: WORLD.height * 0.5 };
  state.playtest.player.x = spawn.x;
  state.playtest.player.y = spawn.y;
  state.playtest.player.angle = 0;
  state.view.x = state.playtest.player.x - canvas.width / state.view.zoom / 2;
  state.view.y = state.playtest.player.y - canvas.height / state.view.zoom / 2;
}

function setPlaytestActive(active) {
  state.playtest.active = active;
  state.playtest.lastTimestamp = 0;
  state.playtest.keys.up = false;
  state.playtest.keys.down = false;
  state.playtest.keys.left = false;
  state.playtest.keys.right = false;
  if (active) {
    placePlaytestPlayer();
    updateSourceStatus("Playtest active. WASD moves, E toggles doors, P exits.", "success");
    requestPlaytestFrame();
  } else {
    updateSourceStatus("Playtest stopped.", "neutral");
  }
  updatePlacementControls();
  draw();
}

function updatePlaytest(dt) {
  const player = state.playtest.player;
  const inputX = (state.playtest.keys.right ? 1 : 0) - (state.playtest.keys.left ? 1 : 0);
  const inputY = (state.playtest.keys.down ? 1 : 0) - (state.playtest.keys.up ? 1 : 0);
  if (!inputX && !inputY) {
    return;
  }

  const length = Math.hypot(inputX, inputY) || 1;
  const velocityX = (inputX / length) * player.speed * dt;
  const velocityY = (inputY / length) * player.speed * dt;
  player.angle = Math.atan2(inputY / length, inputX / length) - Math.PI * 0.5;

  const nextX = player.x + velocityX;
  if (!playtestPositionBlocked(nextX, player.y)) {
    player.x = nextX;
  }

  const nextY = player.y + velocityY;
  if (!playtestPositionBlocked(player.x, nextY)) {
    player.y = nextY;
  }

  state.view.x = player.x - canvas.width / state.view.zoom / 2;
  state.view.y = player.y - canvas.height / state.view.zoom / 2;
}

let playtestFrameId = null;
function requestPlaytestFrame() {
  if (playtestFrameId == null) {
    playtestFrameId = window.requestAnimationFrame(stepPlaytestFrame);
  }
}

function stepPlaytestFrame(timestamp) {
  playtestFrameId = null;
  if (!state.playtest.active) {
    return;
  }
  const previous = state.playtest.lastTimestamp || timestamp;
  const dt = Math.min(0.033, Math.max(0.001, (timestamp - previous) / 1000));
  state.playtest.lastTimestamp = timestamp;
  updatePlaytest(dt);
  draw();
  requestPlaytestFrame();
}

function getSelectableLayers() {
  const ordered = [];
  const pushLayer = (layer) => {
    if (layer && isLayerVisible(layer) && !ordered.includes(layer)) {
      ordered.push(layer);
    }
  };

  pushLayer(state.currentLayer);
  pushLayer("lights");
  pushLayer("fixedEnemies");
  pushLayer("squadSpawns");
  pushLayer("specimenZones");
  pushLayer("decor");
  pushLayer("obstacles");
  pushLayer("extractionZone");
  pushLayer("buildings");

  return ordered;
}

function pickEntityFromSelectionBox(rect) {
  if (!rect || rect.w <= 0 || rect.h <= 0) {
    return null;
  }

  const candidates = [];
  for (const layer of getSelectableLayers()) {
    if (isReadOnlyLayer(layer) && layer !== "enemyPreview") {
      continue;
    }
    const entities = getEntitiesForLayer(currentLevel(), layer);
    for (let index = entities.length - 1; index >= 0; index -= 1) {
      const entity = entities[index];
      const bounds = layerSupportsSeparateVisualBounds(layer)
        ? unionRect(entityRect(entity, layer), getDisplayedVisualRect(entity, layer))
        : entityRect(entity, layer);
      if (bounds && rectIntersectsRect(rect, bounds)) {
        candidates.push({ layer, entity, rect: bounds, index });
      }
    }
  }

  if (!candidates.length) {
    return null;
  }

  const preferredLayerMatches = candidates.filter((entry) => entry.layer === state.currentLayer);
  const pool = preferredLayerMatches.length ? preferredLayerMatches : candidates;
  pool.sort((a, b) => rectArea(a.rect) - rectArea(b.rect) || a.index - b.index);
  return pool[0];
}

function hitTest(point) {
  const level = currentLevel();
  if (!level) {
    return null;
  }

  for (const layer of getSelectableLayers()) {
    const entities = getEntitiesForLayer(level, layer);
    for (let index = entities.length - 1; index >= 0; index -= 1) {
      const entity = entities[index];
      const rect = layerSupportsSeparateVisualBounds(layer)
        ? unionRect(entityRect(entity, layer), getDisplayedVisualRect(entity, layer))
        : entityRect(entity, layer);
      if (rect && pointHitsRect(point, rect)) {
        return { layer, entity };
      }
    }
  }

  return null;
}

function selectEntity(selection, syncLayer = false) {
  if (syncLayer && selection?.layer && selection.layer !== state.currentLayer) {
    state.currentLayer = selection.layer;
    renderLayerSelect();
    renderLayerControls();
  }
  setSelection(selection);
}

function selectionLayer() {
  return state.selection?.layer || state.currentLayer;
}

function selectedLayerDefinition() {
  return layerDefinitionByValue(selectionLayer()) || currentLayerDefinition();
}

function selectedEntityLayer() {
  return selectionLayer();
}

function selectedEntityIsReadOnly() {
  return isReadOnlyLayer(selectedEntityLayer());
}

function selectedBuildingEntity() {
  return selectedEntityLayer() === "buildings" ? selectedEntity() : null;
}

function getBuildingGridSize(building = selectedBuildingEntity()) {
  return Math.max(20, Math.round(Number(building?.gridSize) || state.gridSize || 50));
}

function snapOpeningMetaToGrid(building, meta, gridSize = getBuildingGridSize(building)) {
  if (!building || !meta) {
    return meta;
  }
  const sideLength = meta.side === "north" || meta.side === "south" ? building.w : building.h;
  const snappedSize = clamp(Math.max(gridSize, Math.round((meta.size || gridSize) / gridSize) * gridSize), gridSize, Math.max(gridSize, sideLength));
  const maxOffset = Math.max(0, sideLength - snappedSize);
  return {
    ...meta,
    size: snappedSize,
    offset: clamp(Math.round((meta.offset || 0) / gridSize) * gridSize, 0, maxOffset),
  };
}

function snapBuildingSkeleton(building = selectedBuildingEntity()) {
  if (!building) {
    return false;
  }
  const gridSize = getBuildingGridSize(building);
  building.gridSize = gridSize;
  building.x = Math.round(building.x / gridSize) * gridSize;
  building.y = Math.round(building.y / gridSize) * gridSize;
  building.w = Math.max(gridSize * 2, Math.round(building.w / gridSize) * gridSize);
  building.h = Math.max(gridSize * 2, Math.round(building.h / gridSize) * gridSize);
  building.drawOffsetX = Math.round((Number(building.drawOffsetX) || 0) / gridSize) * gridSize;
  building.drawOffsetY = Math.round((Number(building.drawOffsetY) || 0) / gridSize) * gridSize;
  if (typeof building.drawW === "number") {
    building.drawW = Math.max(gridSize, Math.round(building.drawW / gridSize) * gridSize);
  }
  if (typeof building.drawH === "number") {
    building.drawH = Math.max(gridSize, Math.round(building.drawH / gridSize) * gridSize);
  }
  building.doorMeta = snapOpeningMetaToGrid(building, building.doorMeta || { id: "door", side: "south", offset: 0, size: gridSize }, gridSize);
  building.windowMeta = (building.windowMeta || []).map((meta) => snapOpeningMetaToGrid(building, meta, gridSize));
  syncBuildingOpenings(building);
  return true;
}

function getNearestBuildingSide(building, point) {
  const distances = [
    { side: "north", distance: Math.abs(point.y - building.y) },
    { side: "south", distance: Math.abs(point.y - (building.y + building.h)) },
    { side: "west", distance: Math.abs(point.x - building.x) },
    { side: "east", distance: Math.abs(point.x - (building.x + building.w)) },
  ];
  distances.sort((a, b) => a.distance - b.distance);
  return distances[0]?.side || "south";
}

function makeSnappedOpeningMeta(building, point, type = "window") {
  const side = getNearestBuildingSide(building, point);
  const gridSize = getBuildingGridSize(building);
  const size = gridSize;
  const sideLength = side === "north" || side === "south" ? building.w : building.h;
  const localCoord = side === "north" || side === "south" ? point.x - building.x : point.y - building.y;
  const snappedOffset = clamp(Math.round((localCoord - size * 0.5) / gridSize) * gridSize, 0, Math.max(0, sideLength - size));
  return {
    id: type === "door" ? "door" : createEditorId("window"),
    side,
    offset: snappedOffset,
    size,
  };
}

function findNearestBuildingOpening(building, candidate) {
  if (!building || !candidate) {
    return { windowIndex: -1, hitsDoor: false };
  }
  const tolerance = getBuildingGridSize(building) * 0.75;
  const windowIndex = (building.windowMeta || []).findIndex(
    (meta) => meta.side === candidate.side && Math.abs((meta.offset || 0) - candidate.offset) <= tolerance
  );
  const hitsDoor =
    building.doorMeta &&
    building.doorMeta.side === candidate.side &&
    Math.abs((building.doorMeta.offset || 0) - candidate.offset) <= tolerance;
  return { windowIndex, hitsDoor };
}

function applyBuildingShellToolAtPoint(point, building = selectedBuildingEntity()) {
  if (!building || state.buildingTool === "off") {
    return false;
  }

  const candidate = makeSnappedOpeningMeta(building, point, state.buildingTool === "door" ? "door" : "window");
  const { windowIndex, hitsDoor } = findNearestBuildingOpening(building, candidate);
  if (state.buildingTool === "seal" && hitsDoor && windowIndex < 0) {
    updateSourceStatus("Buildings keep one usable door. Seal windows or move the door instead.", "warning");
    return false;
  }
  pushHistorySnapshot(`Build ${building.label || building.id}`);

  if (state.buildingTool === "door") {
    building.doorMeta = {
      ...(building.doorMeta || {}),
      ...candidate,
      id: "door",
      size: Math.max(getBuildingGridSize(building), building.doorMeta?.size || candidate.size),
    };
  } else if (state.buildingTool === "window") {
    if (windowIndex >= 0) {
      building.windowMeta[windowIndex] = {
        ...building.windowMeta[windowIndex],
        side: candidate.side,
        offset: candidate.offset,
        size: candidate.size,
      };
    } else {
      building.windowMeta = [...(building.windowMeta || []), candidate];
    }
  } else if (state.buildingTool === "seal") {
    if (windowIndex >= 0) {
      building.windowMeta.splice(windowIndex, 1);
    } else {
      return false;
    }
  }

  snapBuildingSkeleton(building);
  renderInspector();
  renderEntityList();
  renderValidation();
  draw();
  updateSourceStatus(`Building shell ${state.buildingTool} applied on ${building.label || building.id}.`, "success");
  return true;
}

function hitTestSelectionRect(point) {
  const entity = selectedEntity();
  if (!entity) {
    return false;
  }
  const rect = entityRect(entity, selectedEntityLayer());
  return Boolean(rect && pointHitsRect(point, rect));
}

function canMoveSelection() {
  return Boolean(selectedEntity() && !selectedEntityIsReadOnly());
}

function canEditLayer(layer) {
  return !isReadOnlyLayer(layer);
}

function hitTestWithinCurrentLayer(point) {
  const entities = getEntitiesForLayer(currentLevel(), state.currentLayer);
  for (let index = entities.length - 1; index >= 0; index -= 1) {
    const entity = entities[index];
    const rect = entityRect(entity, state.currentLayer);
    if (rect && pointHitsRect(point, rect)) {
      return entity;
    }
  }
  return null;
}

function translateEntity(entity, dx, dy, layer = state.currentLayer, boundsMode = "collision") {
  if (!entity) {
    return;
  }

  if (boundsMode === "visual" && layerSupportsSeparateVisualBounds(layer)) {
    ensureVisualBounds(entity, layer);
    entity.drawOffsetX += dx;
    entity.drawOffsetY += dy;
    return;
  }

  if (layer === "buildings") {
    entity.x += dx;
    entity.y += dy;
    entity.squadSpawns = (entity.squadSpawns || []).map((spawn) => ({
      ...spawn,
      x: spawn.x + dx,
      y: spawn.y + dy,
    }));
    syncBuildingOpenings(entity);
    return;
  }

  if (layer === "specimenZones") {
    entity.x += dx;
    entity.y += dy;
    entity.specimenX += dx;
    entity.specimenY += dy;
    return;
  }

  entity.x += dx;
  entity.y += dy;
}

function createDefaultEntity(layer, x, y, profile = assetProfile()) {
  if (layer === "obstacles") {
    const colliderW = profile.defaultColliderW || profile.defaultW || 120;
    const colliderH = profile.defaultColliderH || profile.defaultH || 80;
    const drawW = profile.defaultW || colliderW;
    const drawH = profile.defaultH || colliderH;
    return markEntity(
      {
        id: createEditorId("obstacle"),
        x: Math.round(x - colliderW / 2),
        y: Math.round(y - colliderH / 2),
        w: colliderW,
        h: colliderH,
        kind: profile.obstacleKind || "wall",
        asset: state.selectedAsset || "",
        rotation: 0,
        opacity: 1,
        drawOffsetX: Math.round((colliderW - drawW) * 0.5),
        drawOffsetY: Math.round((colliderH - drawH) * 0.5),
        drawW,
        drawH,
      },
      "obstacle"
    );
  }

  if (layer === "buildings") {
    const drawW = profile.defaultW || 240;
    const drawH = profile.defaultH || 180;
    const entity = markEntity(
      {
        id: createEditorId("building"),
        label: "new building",
        x: Math.round(x - drawW / 2),
        y: Math.round(y - drawH / 2),
        w: drawW,
        h: drawH,
        asset: state.selectedAsset || "",
        opacity: 1,
        drawOffsetX: 0,
        drawOffsetY: 0,
        drawW,
        drawH,
        squadSpawns: [],
      },
      "building"
    );
    entity.doorMeta = { id: "door", side: "south", offset: 90, size: 60 };
    entity.windowMeta = [];
    syncBuildingOpenings(entity);
    return entity;
  }

  if (layer === "lights") {
    return markEntity(
      {
        id: createEditorId("light"),
        label: isLampAssetPath(profile.asset || "") ? "lamp" : "light source",
        x: Math.round(x),
        y: Math.round(y),
        radius: 160,
        intensity: 0.2,
        pulse: isLampAssetPath(profile.asset || "") ? 0.04 : 0,
        color: "rgba(232, 244, 255, 0.2)",
        asset: profile.asset || "",
        assetSize: profile.defaultW || 56,
      },
      "light"
    );
  }

  if (layer === "fixedEnemies") {
    return markEntity(
      {
        id: createEditorId("enemy"),
        x: Math.round(x),
        y: Math.round(y),
        kind: profile.enemyKind || "guard",
        tactic: profile.enemyKind === "rusher" ? "assault" : profile.enemyKind === "specimen" ? "assault" : "anchor",
        squadRole: profile.enemyKind === "rusher" ? "breacher" : profile.enemyKind === "specimen" ? "specimen" : profile.enemyKind || "anchor",
        shield: profile.enemyKind === "guard" || profile.enemyKind === "boss",
      },
      "enemy"
    );
  }

  if (layer === "squadSpawns") {
    return markEntity(
      {
        x: Math.round(x),
        y: Math.round(y),
        kind: profile.enemyKind || "guard",
        tactic: profile.enemyKind === "rusher" ? "assault" : profile.enemyKind === "specimen" ? "assault" : "anchor",
        squadRole: profile.enemyKind === "rusher" ? "breacher" : profile.enemyKind === "specimen" ? "specimen" : profile.enemyKind || "anchor",
        shield: profile.enemyKind === "guard" || profile.enemyKind === "boss",
      },
      "squad-spawn"
    );
  }

  if (layer === "specimenZones") {
    return markEntity(
      {
        id: createEditorId("specimen-zone"),
        label: "specimen zone",
        x: Math.round(x - 70),
        y: Math.round(y - 60),
        w: 140,
        h: 120,
        specimenX: Math.round(x),
        specimenY: Math.round(y),
        angle: 0,
        releaseHeat: 2,
      },
      "specimen-zone"
    );
  }

  if (layer === "decor") {
    return markEntity(
      {
        id: createEditorId("decor"),
        asset: resolveDefaultPlaceableAsset(),
        x: Math.round(x - (profile.defaultW || 96) / 2),
        y: Math.round(y - (profile.defaultH || 96) / 2),
        w: profile.defaultW || 96,
        h: profile.defaultH || 96,
        rotation: 0,
        opacity: 1,
        layer: profile.decorLayer || "mid",
      },
      "decor"
    );
  }

  if (layer === "extractionZone") {
    return markEntity(
      {
        x: Math.round(x - 90),
        y: Math.round(y - 60),
        w: 180,
        h: 120,
      },
      "extraction"
    );
  }

  if (layer.startsWith("spawn:")) {
    return markEntity(
      {
        x: Math.round(x),
        y: Math.round(y),
      },
      layer.replace(":", "-")
    );
  }

  return null;
}

function addEntityAtPointer() {
  const level = currentLevel();
  if (!level) {
    return;
  }

  const profile = assetProfile();
  const targetLayer = effectiveAddLayer();
  const point = placementPoint();
  const entity = createDefaultEntity(targetLayer, point.x, point.y, profile);
  if (!entity) {
    return;
  }
  pushHistorySnapshot(`Add ${layerDefinitionByValue(targetLayer)?.label || targetLayer}`);

  if (targetLayer === "obstacles") {
    level.obstacles.push(entity);
  } else if (targetLayer === "buildings") {
    level.buildings.push(entity);
  } else if (targetLayer === "lights") {
    level.lightSources.push(entity);
  } else if (targetLayer === "fixedEnemies") {
    level.fixedEnemies.push(entity);
  } else if (targetLayer === "squadSpawns") {
    const targetBuilding =
      level.buildings.find((building) => pointHitsRect(entity, { x: building.x, y: building.y, w: building.w, h: building.h })) ||
      level.buildings[0];
    if (!targetBuilding) {
      return;
    }
    entity._parentBuildingId = targetBuilding.id;
    targetBuilding.squadSpawns.push(entity);
  } else if (targetLayer === "specimenZones") {
    level.specimenZones.push(entity);
  } else if (targetLayer === "decor") {
    level.decor.push(entity);
  } else if (targetLayer === "extractionZone") {
    level.extractionZone = entity;
  } else if (targetLayer.startsWith("spawn:")) {
    level.spawnPools[targetLayer.split(":")[1]].push(entity);
  }

  selectEntity({ layer: targetLayer, entityId: entity._editorId }, true);
  autoFitEntityCollisionIfEnabled(entity, targetLayer);
  renderValidation();
  draw();
}

function duplicateSelectedEntity() {
  const level = currentLevel();
  const entity = selectedEntity();
  const layer = selectedEntityLayer();
  if (!level || !entity || layer === "extractionZone" || isReadOnlyLayer(layer)) {
    return;
  }
  pushHistorySnapshot(`Duplicate ${labelForEntity(entity, layer)}`);

  const copy = structuredCloneSafe(entity);
  delete copy._editorId;
  markEntity(copy, layer.replace(":", "-"));
  translateEntity(copy, 28, 28, layer);

  if (layer === "obstacles") {
    copy.id = createEditorId("obstacle");
    level.obstacles.push(copy);
  } else if (layer === "buildings") {
    copy.id = createEditorId("building");
    level.buildings.push(copy);
  } else if (layer === "lights") {
    copy.id = createEditorId("light");
    level.lightSources.push(copy);
  } else if (layer === "fixedEnemies") {
    copy.id = createEditorId("enemy");
    level.fixedEnemies.push(copy);
  } else if (layer === "squadSpawns") {
    const parentBuilding = level.buildings.find((building) => building.id === entity._parentBuildingId);
    if (!parentBuilding) {
      return;
    }
    copy._parentBuildingId = parentBuilding.id;
    parentBuilding.squadSpawns.push(copy);
  } else if (layer === "specimenZones") {
    copy.id = createEditorId("specimen-zone");
    level.specimenZones.push(copy);
  } else if (layer === "decor") {
    copy.id = createEditorId("decor");
    level.decor.push(copy);
  } else if (layer.startsWith("spawn:")) {
    level.spawnPools[layer.split(":")[1]].push(copy);
  }

  selectEntity({ layer, entityId: copy._editorId }, true);
  renderValidation();
  draw();
}

function deleteSelectedEntity() {
  const level = currentLevel();
  const entity = selectedEntity();
  const layer = selectedEntityLayer();
  if (!level || !entity || isReadOnlyLayer(layer)) {
    return;
  }
  pushHistorySnapshot(`Delete ${labelForEntity(entity, layer)}`);

  const removeFrom = (entries) => {
    const index = entries.findIndex((entry) => entry._editorId === entity._editorId);
    if (index !== -1) {
      entries.splice(index, 1);
    }
  };

  if (layer === "obstacles") {
    removeFrom(level.obstacles);
  } else if (layer === "buildings") {
    removeFrom(level.buildings);
  } else if (layer === "lights") {
    removeFrom(level.lightSources || []);
  } else if (layer === "fixedEnemies") {
    removeFrom(level.fixedEnemies);
  } else if (layer === "squadSpawns") {
    const parentBuilding = level.buildings.find((building) => building.id === entity._parentBuildingId);
    if (parentBuilding) {
      removeFrom(parentBuilding.squadSpawns || []);
    }
  } else if (layer === "specimenZones") {
    removeFrom(level.specimenZones);
  } else if (layer === "decor") {
    removeFrom(level.decor);
  } else if (layer.startsWith("spawn:")) {
    removeFrom(level.spawnPools[layer.split(":")[1]]);
  }

  clearSelection();
  renderValidation();
  draw();
}

function drawGrid() {
  const level = currentLevel();
  if (!state.gridEnabled && level?.id === "freight") {
    return;
  }

  const theme = getLevelVisualTheme(level?.id);
  const small = 100;
  const large = 500;
  const startX = Math.floor(state.view.x / small) * small;
  const endX = state.view.x + canvas.width / state.view.zoom;
  const startY = Math.floor(state.view.y / small) * small;
  const endY = state.view.y + canvas.height / state.view.zoom;

  ctx.save();
  ctx.strokeStyle = theme.gridMinor;
  ctx.lineWidth = 1 / state.view.zoom;
  for (let x = startX; x <= endX; x += small) {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }
  for (let y = startY; y <= endY; y += small) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }

  ctx.strokeStyle = theme.gridMajor;
  for (let x = Math.floor(state.view.x / large) * large; x <= endX; x += large) {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }
  for (let y = Math.floor(state.view.y / large) * large; y <= endY; y += large) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }

  if (state.gridEnabled) {
    const snap = state.gridSize;
    const snapStartX = Math.floor(state.view.x / snap) * snap;
    const snapStartY = Math.floor(state.view.y / snap) * snap;
    ctx.strokeStyle = "rgba(255, 230, 164, 0.18)";
    ctx.lineWidth = 1.25 / state.view.zoom;
    for (let x = snapStartX; x <= endX; x += snap) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }
    for (let y = snapStartY; y <= endY; y += snap) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function fillRectWorld(rect, fill, stroke) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2 / state.view.zoom;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

function drawCenteredLabel(x, y, text, color = "#edf3fb") {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${14 / state.view.zoom}px Consolas, monospace`;
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function getDecorImage(asset) {
  if (!asset) {
    return null;
  }
  if (imageCache.has(asset)) {
    return imageCache.get(asset);
  }
  const image = new Image();
  image.src = asset;
  imageCache.set(asset, image);
  image.addEventListener("load", () => {
    floorPreviewCache.clear();
    draw();
  });
  image.addEventListener("error", () => {
    floorPreviewCache.clear();
    draw();
  });
  return image;
}

function getAssetOpaqueBounds(asset) {
  if (!asset) {
    return null;
  }
  if (assetBoundsCache.has(asset)) {
    return assetBoundsCache.get(asset);
  }

  const image = getDecorImage(asset);
  if (!image || !image.complete || !image.naturalWidth) {
    return null;
  }

  const canvas = createCacheCanvas(image.naturalWidth, image.naturalHeight);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const { data, width, height } = context.getImageData(0, 0, image.naturalWidth, image.naturalHeight);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha < 24) {
        continue;
      }
      if (x < minX) {
        minX = x;
      }
      if (y < minY) {
        minY = y;
      }
      if (x > maxX) {
        maxX = x;
      }
      if (y > maxY) {
        maxY = y;
      }
    }
  }

  const bounds =
    maxX >= minX && maxY >= minY
      ? {
          x: minX / width,
          y: minY / height,
          w: Math.max(1 / width, (maxX - minX + 1) / width),
          h: Math.max(1 / height, (maxY - minY + 1) / height),
        }
      : { x: 0, y: 0, w: 1, h: 1 };

  assetBoundsCache.set(asset, bounds);
  return bounds;
}

function getEntityFitBounds(entity, layer) {
  if (!entity || (layer !== "obstacles" && layer !== "buildings")) {
    return null;
  }

  if (layer === "obstacles") {
    const presetKey = resolveContainerPresetKey(entity);
    if (presetKey) {
      return getContainerPresetBounds(presetKey);
    }
    if (entity.kind && OBSTACLE_BOUNDS_PROFILES[entity.kind]) {
      return OBSTACLE_BOUNDS_PROFILES[entity.kind];
    }
  }

  if (!entity.asset) {
    return null;
  }

  if (ENVIRONMENT_ASSET_BOUNDS[entity.asset]) {
    return ENVIRONMENT_ASSET_BOUNDS[entity.asset];
  }

  return getAssetOpaqueBounds(entity.asset);
}

function rotateNormalizedBounds(bounds, quarterTurns = 0) {
  const turns = ((quarterTurns % 4) + 4) % 4;
  if (turns === 0) {
    return bounds;
  }
  if (turns === 1) {
    return { x: 1 - (bounds.y + bounds.h), y: bounds.x, w: bounds.h, h: bounds.w };
  }
  if (turns === 2) {
    return { x: 1 - (bounds.x + bounds.w), y: 1 - (bounds.y + bounds.h), w: bounds.w, h: bounds.h };
  }
  return { x: bounds.y, y: 1 - (bounds.x + bounds.w), w: bounds.h, h: bounds.w };
}

function nearestQuarterTurns(angle = 0) {
  return Math.round(angle / (Math.PI * 0.5));
}

function rotatedVisualRect(rect, quarterTurns = 0) {
  const turns = ((quarterTurns % 4) + 4) % 4;
  if (turns % 2 === 0) {
    return rect;
  }
  const centerX = rect.x + rect.w * 0.5;
  const centerY = rect.y + rect.h * 0.5;
  return {
    x: Math.round(centerX - rect.h * 0.5),
    y: Math.round(centerY - rect.w * 0.5),
    w: rect.h,
    h: rect.w,
  };
}

function isQuarterTurnVerticalRotation(angle = 0) {
  const turns = nearestQuarterTurns(angle);
  const snapped = turns * (Math.PI * 0.5);
  return Math.abs(normalizeRotation(angle - snapped)) < 0.001 && Math.abs(turns % 2) === 1;
}

function getDisplayedVisualRect(entity, layer = state.currentLayer) {
  const rect = getVisualRect(entity, layer);
  if (!rect) {
    return null;
  }
  if (!isQuarterTurnVerticalRotation(entity.rotation || 0)) {
    return rect;
  }
  return rotatedVisualRect(rect, nearestQuarterTurns(entity.rotation || 0));
}

function scalePointWithinRect(point, fromRect, toRect) {
  const scaleX = fromRect.w !== 0 ? toRect.w / fromRect.w : 1;
  const scaleY = fromRect.h !== 0 ? toRect.h / fromRect.h : 1;
  return {
    x: Math.round(toRect.x + (point.x - fromRect.x) * scaleX),
    y: Math.round(toRect.y + (point.y - fromRect.y) * scaleY),
  };
}

function fitColliderToMappedAsset(entity, layer) {
  if (!entity || (layer !== "obstacles" && layer !== "buildings")) {
    return false;
  }

  const explicitBounds = getEntityFitBounds(entity, layer);
  const needsImageLoad = !!entity.asset && !(
    (layer === "obstacles" && resolveContainerPresetKey(entity)) ||
    (entity.kind && OBSTACLE_BOUNDS_PROFILES[entity.kind]) ||
    ENVIRONMENT_ASSET_BOUNDS[entity.asset]
  );

  if (needsImageLoad) {
    const image = getDecorImage(entity.asset);
    if (!image || !image.complete || !image.naturalWidth) {
      updateSourceStatus("Asset is not loaded yet. Try again in a moment.", "error");
      return false;
    }
  }

  const visualRect = getVisualRect(entity, layer);
  const opaqueBounds = explicitBounds;
  if (!visualRect || !opaqueBounds) {
    updateSourceStatus("Could not determine fit bounds for this object.", "error");
    return false;
  }

  const presetKey = layer === "obstacles" ? resolveContainerPresetKey(entity) : null;
  const usePresetVisualOrientation = !!presetKey;
  const quarterTurns = nearestQuarterTurns(entity.rotation || 0);
  const fittedVisualRect = usePresetVisualOrientation ? visualRect : rotatedVisualRect(visualRect, quarterTurns);
  const rotatedBounds = usePresetVisualOrientation ? opaqueBounds : rotateNormalizedBounds(opaqueBounds, quarterTurns);
  const nextRect = {
    x: Math.round(fittedVisualRect.x + fittedVisualRect.w * rotatedBounds.x),
    y: Math.round(fittedVisualRect.y + fittedVisualRect.h * rotatedBounds.y),
    w: Math.max(8, Math.round(fittedVisualRect.w * rotatedBounds.w)),
    h: Math.max(8, Math.round(fittedVisualRect.h * rotatedBounds.h)),
  };
  const previousRect = { x: entity.x, y: entity.y, w: entity.w, h: entity.h };

  entity.x = nextRect.x;
  entity.y = nextRect.y;
  entity.w = nextRect.w;
  entity.h = nextRect.h;
  entity.drawOffsetX = Math.round(visualRect.x - entity.x);
  entity.drawOffsetY = Math.round(visualRect.y - entity.y);
  entity.drawW = visualRect.w;
  entity.drawH = visualRect.h;

  if (layer === "buildings") {
    entity.doorMeta = {
      ...entity.doorMeta,
      offset: Math.round(
        entity.doorMeta.side === "north" || entity.doorMeta.side === "south"
          ? entity.doorMeta.offset * (previousRect.w !== 0 ? entity.w / previousRect.w : 1)
          : entity.doorMeta.offset * (previousRect.h !== 0 ? entity.h / previousRect.h : 1)
      ),
      size: Math.max(
        12,
        Math.round(
          entity.doorMeta.size *
            (entity.doorMeta.side === "north" || entity.doorMeta.side === "south"
              ? (previousRect.w !== 0 ? entity.w / previousRect.w : 1)
              : (previousRect.h !== 0 ? entity.h / previousRect.h : 1))
        )
      ),
    };
    entity.windowMeta = (entity.windowMeta || []).map((entry) => ({
      ...entry,
      offset: Math.round(
        entry.side === "north" || entry.side === "south"
          ? entry.offset * (previousRect.w !== 0 ? entity.w / previousRect.w : 1)
          : entry.offset * (previousRect.h !== 0 ? entity.h / previousRect.h : 1)
      ),
      size: Math.max(
        10,
        Math.round(
          entry.size *
            (entry.side === "north" || entry.side === "south"
              ? (previousRect.w !== 0 ? entity.w / previousRect.w : 1)
              : (previousRect.h !== 0 ? entity.h / previousRect.h : 1))
        )
      ),
    }));
    entity.squadSpawns = (entity.squadSpawns || []).map((spawn) => ({
      ...spawn,
      ...scalePointWithinRect({ x: spawn.x, y: spawn.y }, previousRect, nextRect),
    }));
    syncBuildingOpenings(entity);
  }

  return true;
}

function shouldAutoFitCollision(layer, entity) {
  if (!state.autoFitCollision || !entity || (layer !== "obstacles" && layer !== "buildings")) {
    return false;
  }
  return !!getEntityFitBounds(entity, layer);
}

function autoFitEntityCollisionIfEnabled(entity = selectedEntity(), layer = selectedEntityLayer()) {
  if (!shouldAutoFitCollision(layer, entity)) {
    return false;
  }
  return fitColliderToMappedAsset(entity, layer);
}

function createCacheCanvas(width, height) {
  const layer = document.createElement("canvas");
  layer.width = width;
  layer.height = height;
  return layer;
}

function getPatternForContext(context, asset) {
  const image = getDecorImage(asset);
  if (!image || !image.complete || !image.naturalWidth) {
    return null;
  }
  return context.createPattern(image, "repeat");
}

function getLevelFloorPreview(levelId) {
  if (floorPreviewCache.has(levelId)) {
    return floorPreviewCache.get(levelId);
  }

  const layer = createCacheCanvas(WORLD.width, WORLD.height);
  const layerCtx = layer.getContext("2d");

  if (levelId === "admin") {
    layerCtx.fillStyle = "#c8c2b8";
    layerCtx.fillRect(0, 0, WORLD.width, WORLD.height);

    layerCtx.fillStyle = "rgba(122, 118, 111, 0.06)";
    for (let x = 120; x < WORLD.width - 120; x += 220) {
      layerCtx.fillRect(x, 120, 8, WORLD.height - 240);
    }

    layerCtx.fillStyle = "rgba(255, 248, 236, 0.14)";
    layerCtx.fillRect(120, 118, WORLD.width - 240, 148);
    layerCtx.fillRect(240, 1460, WORLD.width - 480, 126);

    layerCtx.fillStyle = "rgba(110, 107, 100, 0.08)";
    for (let y = 302; y < WORLD.height - 180; y += 290) {
      layerCtx.fillRect(140, y, WORLD.width - 280, 14);
    }

    const boulevard = layerCtx.createLinearGradient(0, 0, 0, WORLD.height);
    boulevard.addColorStop(0, "rgba(148, 144, 135, 0.08)");
    boulevard.addColorStop(0.5, "rgba(120, 116, 108, 0.1)");
    boulevard.addColorStop(1, "rgba(148, 144, 135, 0.08)");
    layerCtx.fillStyle = boulevard;
    layerCtx.fillRect(1040, 120, 520, WORLD.height - 240);

    layerCtx.fillStyle = "rgba(255, 250, 242, 0.12)";
    for (let y = 194; y < WORLD.height - 220; y += 132) {
      layerCtx.fillRect(1288, y, 24, 54);
    }

    layerCtx.fillStyle = "rgba(166, 154, 121, 0.16)";
    layerCtx.fillRect(1080, 72, 380, 98);
    layerCtx.fillRect(180, 932, 2260, 30);

    layerCtx.strokeStyle = "rgba(143, 133, 109, 0.24)";
    layerCtx.lineWidth = 3;
    layerCtx.strokeRect(1080, 72, 380, 98);

    layerCtx.fillStyle = "rgba(86, 112, 87, 0.12)";
    layerCtx.fillRect(182, 338, 98, 362);
    layerCtx.fillRect(2280, 338, 98, 362);
    layerCtx.fillRect(610, 1386, 248, 84);
    layerCtx.fillRect(1740, 1386, 248, 84);

    layerCtx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    layerCtx.lineWidth = 2;
    for (let x = 210; x < 2410; x += 242) {
      layerCtx.strokeRect(x, 818, 128, 86);
    }

    layerCtx.fillStyle = "rgba(59, 72, 84, 0.08)";
    layerCtx.fillRect(140, 780, WORLD.width - 280, 146);
    layerCtx.fillStyle = "rgba(255, 255, 255, 0.08)";
    for (let x = 190; x < WORLD.width - 160; x += 178) {
      layerCtx.fillRect(x, 848, 94, 4);
    }

    floorPreviewCache.set(levelId, layer);
    return layer;
  }

  if (levelId === "reactor") {
    layerCtx.fillStyle = "#2e2b29";
    layerCtx.fillRect(0, 0, WORLD.width, WORLD.height);

    const centerX = 1300;
    const centerY = 870;
    const glow = layerCtx.createRadialGradient(centerX, centerY, 80, centerX, centerY, 560);
    glow.addColorStop(0, "rgba(246, 154, 72, 0.18)");
    glow.addColorStop(0.55, "rgba(214, 127, 42, 0.08)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    layerCtx.fillStyle = glow;
    layerCtx.beginPath();
    layerCtx.arc(centerX, centerY, 560, 0, Math.PI * 2);
    layerCtx.fill();

    layerCtx.strokeStyle = "rgba(116, 96, 70, 0.16)";
    layerCtx.lineWidth = 20;
    layerCtx.beginPath();
    layerCtx.arc(centerX, centerY, 248, 0, Math.PI * 2);
    layerCtx.stroke();

    layerCtx.strokeStyle = "rgba(239, 171, 92, 0.16)";
    layerCtx.lineWidth = 6;
    layerCtx.setLineDash([18, 10]);
    layerCtx.beginPath();
    layerCtx.arc(centerX, centerY, 302, 0, Math.PI * 2);
    layerCtx.stroke();
    layerCtx.setLineDash([]);

    for (let ring = 0; ring < 3; ring += 1) {
      const y = 300 + ring * 420;
      layerCtx.fillStyle = "rgba(235, 176, 95, 0.08)";
      layerCtx.fillRect(120, y, WORLD.width - 240, 10);
      layerCtx.fillStyle = "rgba(73, 85, 98, 0.08)";
      layerCtx.fillRect(120, y + 10, WORLD.width - 240, 24);
    }

    layerCtx.strokeStyle = "rgba(103, 112, 124, 0.12)";
    layerCtx.lineWidth = 2;
    for (let x = 180; x < WORLD.width - 120; x += 260) {
      layerCtx.beginPath();
      layerCtx.moveTo(x, 120);
      layerCtx.lineTo(x, WORLD.height - 120);
      layerCtx.stroke();
    }

    floorPreviewCache.set(levelId, layer);
    return layer;
  }

  layerCtx.fillStyle = "#c8d1d9";
  layerCtx.fillRect(0, 0, WORLD.width, WORLD.height);

  const basePattern = getPatternForContext(layerCtx, "assets/environment/base_freight_floor.jpg");
  if (basePattern) {
    layerCtx.save();
    layerCtx.globalAlpha = 0.34;
    layerCtx.fillStyle = basePattern;
    layerCtx.fillRect(0, 0, WORLD.width, WORLD.height);
    layerCtx.restore();
  }

  const lanePattern = getPatternForContext(layerCtx, "assets/environment/painted_lane_tile.jpg");
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

  floorPreviewCache.set(levelId, layer);
  return layer;
}

function drawMappedAssetRect(entity, fallbackFill, fallbackStroke, options = {}) {
  const rect =
    options.rect ||
    (options.useVisualBounds === false
      ? { x: entity.x, y: entity.y, w: entity.w, h: entity.h }
      : getVisualRect(entity, options.layer || state.currentLayer)) ||
    { x: entity.x, y: entity.y, w: entity.w, h: entity.h };
  const image = entity.asset ? getDecorImage(entity.asset) : null;
  if (image && image.complete && image.naturalWidth > 0) {
    drawAssetImage(ctx, image, entity, {
      rect,
      useVisualBounds: options.useVisualBounds,
      cropToOpaqueBounds: options.cropToOpaqueBounds,
      separateBounds: options.layer ? layerSupportsSeparateVisualBounds(options.layer) : layerSupportsSeparateVisualBounds(state.currentLayer),
      decorLike: (options.layer || state.currentLayer) === "decor",
      fallbackBoundsProvider: entity.asset ? (asset) => ENVIRONMENT_ASSET_BOUNDS[asset] || getAssetOpaqueBounds(asset) : null,
    });
    if (options.showOutline) {
      ctx.save();
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      if (typeof entity.rotation === "number" && entity.rotation) {
        ctx.rotate(entity.rotation);
      }
      ctx.strokeStyle = fallbackStroke;
      ctx.lineWidth = 2 / state.view.zoom;
      ctx.strokeRect(-rect.w / 2, -rect.h / 2, rect.w, rect.h);
      ctx.restore();
    }
  } else {
    ctx.save();
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    if (typeof entity.rotation === "number" && entity.rotation) {
      ctx.rotate(entity.rotation);
    }
    ctx.fillStyle = fallbackFill;
    ctx.fillRect(-rect.w / 2, -rect.h / 2, rect.w, rect.h);
    ctx.strokeStyle = fallbackStroke;
    ctx.lineWidth = 2 / state.view.zoom;
    ctx.strokeRect(-rect.w / 2, -rect.h / 2, rect.w, rect.h);
    ctx.restore();
  }

  if (options.label) {
    ctx.save();
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    drawCenteredLabel(0, options.labelY ?? 0, options.label, options.labelColor || "#edf3fb");
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
  ctx.rotate((angle || 0) + Math.PI * 0.5);
  ctx.drawImage(image, -(width * SPRITE_SCALE) * 0.5, -(height * SPRITE_SCALE) * 0.5, width * SPRITE_SCALE, height * SPRITE_SCALE);
  ctx.restore();
  return true;
}

function drawContainerSprite(obstacle) {
  const preset = obstacle.containerPreset ? CONTAINER_PRESETS[obstacle.containerPreset] : null;
  const horizontal = preset ? preset.rotation === 0 : obstacle.w >= obstacle.h;
  const visualRect = getVisualRect(obstacle, "obstacles") || { x: obstacle.x, y: obstacle.y, w: obstacle.w, h: obstacle.h };
  const bodyW = visualRect.w;
  const bodyH = visualRect.h;
  const left = visualRect.x;
  const top = visualRect.y;
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

  for (const [bx, by] of [
    [left + 9, top + 9],
    [left + bodyW - 9, top + 9],
    [left + 9, top + bodyH - 9],
    [left + bodyW - 9, top + bodyH - 9],
  ]) {
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

function drawWorldBounds() {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 2 / state.view.zoom;
  ctx.strokeRect(0, 0, WORLD.width, WORLD.height);
  ctx.restore();
}

function drawDecor(level, targetLayer = null) {
  if (!isLayerVisible("decor")) {
    return;
  }
  for (const entry of level.decor) {
    const decorLayer = entry.layer || "mid";
    if (targetLayer && decorLayer !== targetLayer) {
      continue;
    }
    if (!targetLayer && decorLayer !== "mid") {
      continue;
    }
    drawMappedAssetRect(entry, "rgba(109, 162, 224, 0.16)", "rgba(109, 162, 224, 0.55)", {
      layer: "decor",
      useVisualBounds: false,
      label: entry.asset ? null : basename(entry.asset) || "asset",
      labelColor: "#9ad0ff",
    });
  }
}

function drawLights(level) {
  if (!isLayerVisible("lights")) {
    return;
  }

  for (const light of level.lightSources || []) {
    const radius = Math.max(16, Number(light.radius) || 120);
    const intensity = clamp(Number(light.intensity) || 0.2, 0.02, 1);
    const fixtureSize = Math.max(20, Number(light.assetSize) || 44);
    const glow = ctx.createRadialGradient(light.x, light.y, radius * 0.12, light.x, light.y, radius);
    glow.addColorStop(0, light.color || `rgba(232, 244, 255, ${Math.min(0.4, intensity + 0.08)})`);
    glow.addColorStop(0.48, `rgba(255, 247, 223, ${Math.min(0.18, intensity * 0.55)})`);
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(light.x, light.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(253, 245, 217, ${Math.min(0.75, 0.28 + intensity)})`;
    ctx.lineWidth = 1.2 / state.view.zoom;
    ctx.setLineDash([8 / state.view.zoom, 6 / state.view.zoom]);
    ctx.beginPath();
    ctx.arc(light.x, light.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const image = getDecorImage(light.asset);
    if (image && image.complete && image.naturalWidth > 0) {
      ctx.drawImage(image, light.x - fixtureSize * 0.5, light.y - fixtureSize * 0.5, fixtureSize, fixtureSize);
    } else {
      ctx.fillStyle = "rgba(39, 52, 66, 0.78)";
      ctx.beginPath();
      ctx.arc(light.x, light.y, fixtureSize * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 244, 214, 0.94)";
      ctx.beginPath();
      ctx.arc(light.x, light.y, fixtureSize * 0.12, 0, Math.PI * 2);
      ctx.fill();
      if (light.label) {
        drawCenteredLabel(light.x, light.y - fixtureSize * 0.65, light.label, "#ffe6af");
      }
    }
  }
}

function drawObstacles(level) {
  if (!isLayerVisible("obstacles")) {
    return;
  }
  const theme = getLevelVisualTheme(level.id);
  for (const obstacle of level.obstacles) {
    if (obstacle.kind === "window" || obstacle.kind === "door") {
      continue;
    }

    if (obstacle.kind === "crate") {
      if (obstacle.asset) {
        drawMappedAssetRect(obstacle, theme.obstacleTop, theme.obstacleLine, { layer: "obstacles" });
        continue;
      }
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
    if (isContainerObstacle(obstacle, level.id) && obstacle.asset) {
      drawMappedAssetRect(obstacle, theme.obstacleTop, theme.obstacleLine, { layer: "obstacles" });
      continue;
    }
    if (isContainerObstacle(obstacle, level.id)) {
      drawContainerSprite(obstacle);
      continue;
    }
    if (obstacle.asset) {
      drawMappedAssetRect(obstacle, theme.obstacleTop, theme.obstacleLine, { layer: "obstacles" });
      continue;
    }

    const obstacleGradient = ctx.createLinearGradient(obstacle.x, obstacle.y, obstacle.x, obstacle.y + obstacle.h);
    obstacleGradient.addColorStop(0, theme.obstacleTop);
    obstacleGradient.addColorStop(1, theme.obstacleBottom);
    ctx.fillStyle = obstacleGradient;
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
    ctx.strokeStyle = theme.obstacleLine;
    ctx.lineWidth = 1;
    ctx.strokeRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    ctx.fillRect(obstacle.x + 6, obstacle.y + 6, obstacle.w - 12, 12);
    ctx.fillStyle = theme.obstacleStripe;
    for (let y = obstacle.y + 22; y < obstacle.y + obstacle.h - 10; y += 24) {
      ctx.fillRect(obstacle.x + 10, y, obstacle.w - 20, theme.obstacleStripeHeight);
    }
  }
}

function drawBuildings(level) {
  if (!isLayerVisible("buildings")) {
    return;
  }
  const theme = getLevelVisualTheme(level.id);
  for (const building of level.buildings) {
    const mappedRoofAsset = isRoofAssetPath(building.asset);
    const roofInset = mappedRoofAsset ? 0 : 12;
    const roofX = building.x + roofInset;
    const roofY = building.y + roofInset;
    const roofW = building.w - roofInset * 2;
    const roofH = building.h - roofInset * 2;
    if (building.asset) {
      drawMappedAssetRect(
        { ...building, x: roofX, y: roofY, w: roofW, h: roofH, rotation: building.rotation || 0, opacity: building.opacity },
        theme.roofTop,
        theme.buildingStroke,
        { useVisualBounds: false }
      );
    } else {
      const roofGradient = ctx.createLinearGradient(roofX, roofY, roofX, roofY + roofH);
      roofGradient.addColorStop(0, theme.roofTop);
      roofGradient.addColorStop(1, theme.roofBottom);
      ctx.fillStyle = roofGradient;
      ctx.fillRect(roofX, roofY, roofW, roofH);
      ctx.strokeStyle = theme.buildingStroke;
      ctx.lineWidth = 1.4 / state.view.zoom;
      ctx.strokeRect(roofX, roofY, roofW, roofH);
      ctx.fillStyle = theme.roofHighlight;
      ctx.fillRect(roofX + 10, roofY + 10, roofW - 20, 8);
      ctx.fillStyle = theme.roofStripe;
      for (let stripe = roofY + 26; stripe < roofY + roofH - 12; stripe += 22) {
        ctx.fillRect(roofX + 12, stripe, roofW - 24, 2);
      }

      if (level.id === "admin") {
        ctx.fillStyle = "rgba(86, 82, 76, 0.08)";
        for (let pilaster = roofX + 34; pilaster < roofX + roofW - 22; pilaster += 94) {
          ctx.fillRect(pilaster, roofY + 18, 10, roofH - 36);
        }
      }

      ctx.fillStyle = theme.roofBoxFill;
      ctx.fillRect(roofX + roofW - 54, roofY + 18, 30, 22);
      ctx.strokeStyle = theme.roofBoxStroke;
      ctx.strokeRect(roofX + roofW - 54, roofY + 18, 30, 22);

      for (const windowEntry of building.windows) {
        ctx.fillStyle = windowEntry.broken ? theme.windowBrokenFill : theme.windowFill;
        ctx.fillRect(windowEntry.x, windowEntry.y, windowEntry.w, windowEntry.h);
        ctx.strokeStyle = windowEntry.broken ? theme.windowBrokenStroke : theme.windowStroke;
        ctx.lineWidth = 1.2 / state.view.zoom;
        ctx.strokeRect(windowEntry.x, windowEntry.y, windowEntry.w, windowEntry.h);
        if (!windowEntry.broken) {
          ctx.strokeStyle = "rgba(237, 249, 255, 0.2)";
          ctx.beginPath();
          ctx.moveTo(windowEntry.x + 3, windowEntry.y + 3);
          ctx.lineTo(windowEntry.x + windowEntry.w - 3, windowEntry.y + windowEntry.h - 3);
          ctx.stroke();
        }
      }

      ctx.fillStyle = building.door.open ? theme.doorOpenFill : theme.doorClosedFill;
      ctx.fillRect(building.door.x, building.door.y, building.door.w, building.door.h);
      ctx.strokeStyle = theme.doorStroke;
      ctx.lineWidth = 1 / state.view.zoom;
      ctx.strokeRect(building.door.x, building.door.y, building.door.w, building.door.h);
    }

    if (mappedRoofAsset) {
      ctx.strokeStyle = "rgba(34, 44, 52, 0.28)";
      ctx.lineWidth = 1.2 / state.view.zoom;
      ctx.strokeRect(building.x, building.y, building.w, building.h);
    }
  }
}

function drawExtraction(level) {
  if (!isLayerVisible("extractionZone")) {
    return;
  }
  const theme = getLevelVisualTheme(level.id);
  fillRectWorld(level.extractionZone, theme.extractionFill, theme.extractionStroke);
  drawCenteredLabel(level.extractionZone.x + level.extractionZone.w / 2, level.extractionZone.y + level.extractionZone.h / 2, theme.extractionLabel, theme.extractionText);
}

function drawSpecimenZones(level) {
  if (!isLayerVisible("specimenZones")) {
    return;
  }
  for (const zone of level.specimenZones) {
    fillRectWorld(zone, "rgba(158, 96, 216, 0.18)", "rgba(202, 153, 255, 0.68)");
    const specimenSprite = getDecorImage(CHARACTER_SPRITES.cyber_specimen);
    drawCharacterSprite(specimenSprite, zone.specimenX, zone.specimenY, zone.angle || 0, 84, 84, 0.78);
    ctx.save();
    ctx.fillStyle = "rgba(27, 10, 15, 0.18)";
    ctx.beginPath();
    ctx.ellipse(zone.specimenX, zone.specimenY + 26, 22, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(233, 238, 241, 0.2)";
    ctx.lineWidth = 1.2 / state.view.zoom;
    for (let x = zone.x + 10; x < zone.x + zone.w - 8; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, zone.y + 4);
      ctx.lineTo(x, zone.y + zone.h - 4);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function getEnemySpritePath(enemy) {
  if (enemy.kind === "boss") {
    return CHARACTER_SPRITES.warden_stage_one;
  }
  if (enemy.kind === "specimen") {
    return CHARACTER_SPRITES.cyber_specimen;
  }
  return enemy.kind === "guard" ? CHARACTER_SPRITES.enemy_guard : CHARACTER_SPRITES.enemy_rusher;
}

function drawEnemySpriteEntity(enemy) {
  if (enemy.hidden) {
    return;
  }
  const sprite = getDecorImage(getEnemySpritePath(enemy));
  const size = enemy.kind === "boss" ? 126 : enemy.kind === "specimen" ? 94 : 86;
  if (drawCharacterSprite(sprite, enemy.x, enemy.y, enemy.angle || enemy.aimAngle || 0, size, size, enemy.hidden ? 0.25 : 1)) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    ctx.fillRect(enemy.x - 22, enemy.y - (enemy.radius || 18) - 16, 44, 6);
    ctx.fillStyle = enemy.kind === "specimen" ? "#87f0de" : "#ff9baa";
    ctx.fillRect(enemy.x - 22, enemy.y - (enemy.radius || 18) - 16, 44, 6);
  }
}

function drawFixedEnemies(level) {
  if (isLayerVisible("fixedEnemies")) {
  for (const enemy of level.fixedEnemies) {
    drawEnemySpriteEntity(enemy);
  }
  }

  if (!isLayerVisible("squadSpawns")) {
    return;
  }
  for (const building of level.buildings) {
    for (const spawn of building.squadSpawns || []) {
      drawEnemySpriteEntity({
        x: spawn.x,
        y: spawn.y,
        kind: spawn.kind,
        shieldEquipped: Boolean(spawn.shield),
        angle: 0,
        radius: spawn.kind === "guard" ? 17 : 15,
      });
    }
  }
}

function drawPlaytestPlayer() {
  if (!state.playtest.active) {
    return;
  }

  const player = state.playtest.player;
  const sprite = getDecorImage(CHARACTER_SPRITES.stealther);
  drawCharacterSprite(sprite, player.x, player.y, player.angle || 0, 82, 82, 0.98);

  ctx.save();
  ctx.strokeStyle = "rgba(105, 246, 186, 0.92)";
  ctx.lineWidth = 2 / state.view.zoom;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(15, 22, 29, 0.78)";
  ctx.fillRect(player.x - 32, player.y - player.radius - 24, 64, 12);
  ctx.fillStyle = "rgba(105, 246, 186, 0.95)";
  ctx.fillRect(player.x - 32, player.y - player.radius - 24, 64, 12);
  ctx.restore();
}

function drawSpawnPools(level) {
  if (!(state.currentLayer.startsWith("spawn:") || state.currentLayer === "enemyPreview")) {
    return;
  }
  const activeKey = state.currentLayer === "enemyPreview" ? "enemy" : state.currentLayer.split(":")[1];
  const keys = state.currentLayer === "enemyPreview" ? ["enemy"] : SPAWN_KEYS;
  for (const key of keys) {
    const layerKey = state.currentLayer === "enemyPreview" ? "enemyPreview" : `spawn:${key}`;
    if (!isLayerVisible(layerKey)) {
      continue;
    }
    for (const spawn of level.spawnPools[key] || []) {
      ctx.save();
      ctx.fillStyle =
        state.currentLayer === "enemyPreview"
          ? "rgba(255, 196, 106, 0.95)"
          : key === activeKey
            ? "rgba(77, 178, 140, 0.95)"
            : "rgba(198, 216, 236, 0.7)";
      ctx.strokeStyle = "rgba(10, 12, 16, 0.8)";
      ctx.lineWidth = 2 / state.view.zoom;
      ctx.beginPath();
      ctx.arc(spawn.x, spawn.y, 11 / state.view.zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (state.currentLayer === "enemyPreview") {
        ctx.strokeStyle = "rgba(255, 239, 214, 0.68)";
        ctx.lineWidth = 1.5 / state.view.zoom;
        ctx.beginPath();
        ctx.arc(spawn.x, spawn.y, 19 / state.view.zoom, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

function drawSelection() {
  const entity = selectedEntity();
  if (!entity) {
    return;
  }
  const layer = selectedEntityLayer();
  const rect = editableRect(entity, layer);
  if (!rect) {
    return;
  }
  ctx.save();
  if (layer === "buildings") {
    const gridSize = getBuildingGridSize(entity);
    ctx.strokeStyle = "rgba(77, 178, 140, 0.26)";
    ctx.lineWidth = 1 / state.view.zoom;
    for (let x = entity.x + gridSize; x < entity.x + entity.w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, entity.y);
      ctx.lineTo(x, entity.y + entity.h);
      ctx.stroke();
    }
    for (let y = entity.y + gridSize; y < entity.y + entity.h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(entity.x, y);
      ctx.lineTo(entity.x + entity.w, y);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
  ctx.lineWidth = 3 / state.view.zoom;
  ctx.setLineDash([10 / state.view.zoom, 7 / state.view.zoom]);
  ctx.strokeRect(rect.x - 2 / state.view.zoom, rect.y - 2 / state.view.zoom, rect.w + 4 / state.view.zoom, rect.h + 4 / state.view.zoom);
  ctx.setLineDash([]);
  if (isResizableLayer(layer)) {
    const size = resizeHandleSize();
    for (const handle of resizeHandlesForRect(rect)) {
      ctx.fillStyle = "rgba(255, 244, 204, 0.96)";
      ctx.strokeStyle = "rgba(20, 24, 30, 0.9)";
      ctx.lineWidth = 1.6 / state.view.zoom;
      ctx.beginPath();
      ctx.rect(handle.x - size, handle.y - size, size * 2, size * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  if (layerSupportsSeparateVisualBounds(layer)) {
    const collisionRect = entityRect(entity, layer);
    const visualRect = getDisplayedVisualRect(entity, layer);
    const secondary =
      editableBoundsModeForLayer(layer) === "visual"
        ? { rect: collisionRect, stroke: "rgba(97, 211, 255, 0.82)" }
        : { rect: visualRect, stroke: "rgba(255, 196, 106, 0.78)" };
    if (
      secondary.rect &&
      (Math.abs(secondary.rect.x - rect.x) > 0.5 ||
        Math.abs(secondary.rect.y - rect.y) > 0.5 ||
        Math.abs(secondary.rect.w - rect.w) > 0.5 ||
        Math.abs(secondary.rect.h - rect.h) > 0.5)
    ) {
      ctx.strokeStyle = secondary.stroke;
      ctx.lineWidth = 2 / state.view.zoom;
      ctx.strokeRect(secondary.rect.x, secondary.rect.y, secondary.rect.w, secondary.rect.h);
    }
  }
  ctx.restore();
}

function drawSelectionBox() {
  const rect = state.selectionBox;
  if (!rect || (rect.w < 1 && rect.h < 1)) {
    return;
  }
  ctx.save();
  ctx.fillStyle = "rgba(77, 178, 140, 0.14)";
  ctx.strokeStyle = "rgba(77, 178, 140, 0.92)";
  ctx.lineWidth = 2 / state.view.zoom;
  ctx.setLineDash([14 / state.view.zoom, 8 / state.view.zoom]);
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

function draw() {
  setCanvasSize();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const level = currentLevel();
  if (!level) {
    return;
  }
  const theme = getLevelVisualTheme(level.id);

  ctx.fillStyle = theme.base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
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

  ctx.save();
  ctx.scale(state.view.zoom, state.view.zoom);
  ctx.translate(-state.view.x, -state.view.y);
  const floorPreview = getLevelFloorPreview(level.id);
  if (floorPreview) {
    ctx.drawImage(floorPreview, 0, 0);
  }
  drawGrid();
  drawWorldBounds();
  drawDecor(level, "ground");
  drawLights(level);
  drawObstacles(level);
  drawBuildings(level);
  drawDecor(level, "mid");
  drawDecor(level, "roof");
  drawExtraction(level);
  drawSpecimenZones(level);
  drawFixedEnemies(level);
  drawPlaytestPlayer();
  drawSpawnPools(level);
  drawSelection();
  drawSelectionBox();
  ctx.restore();
  updateReadouts();
}

function serializeEntity(entity, layer) {
  const clone = structuredCloneSafe(entity);
  delete clone._editorId;

  if (layer === "buildings") {
    delete clone.doorMeta;
    delete clone.windowMeta;
    clone.door = structuredCloneSafe(entity.door);
    clone.windows = structuredCloneSafe(entity.windows);
    clone.squadSpawns = (entity.squadSpawns || []).map((entry) => {
      const spawn = structuredCloneSafe(entry);
      delete spawn._editorId;
      delete spawn._parentBuildingId;
      return spawn;
    });
  }

  if (layer === "squadSpawns") {
    delete clone._parentBuildingId;
  }

  return clone;
}

function serializeCurrentLayer() {
  const level = currentLevel();
  if (!level) {
    return "";
  }

  if (state.currentLayer === "extractionZone") {
    return JSON.stringify(serializeEntity(level.extractionZone, "extractionZone"), null, 2);
  }

  return JSON.stringify(getEntitiesForLayer(level, state.currentLayer).map((entry) => serializeEntity(entry, state.currentLayer)), null, 2);
}

function serializeLevel(level) {
  const result = {
    id: level.id,
    name: level.name,
    duration: level.duration,
    requiredLoot: level.requiredLoot,
    bossRequired: level.bossRequired,
    objective: level.objective,
    extractionPrompt: level.extractionPrompt,
    objectiveSingular: level.objectiveSingular,
    objectivePlural: level.objectivePlural,
    objectiveShort: level.objectiveShort,
    nextLevelId: level.nextLevelId,
    transitionMessage: level.transitionMessage,
    obstacles: level.obstacles.map((entry) => serializeEntity(entry, "obstacles")),
    buildings: level.buildings.map((entry) => serializeEntity(entry, "buildings")),
    lightSources: (level.lightSources || []).map((entry) => serializeEntity(entry, "lights")),
    extractionZone: serializeEntity(level.extractionZone, "extractionZone"),
    spawnPools: Object.fromEntries(SPAWN_KEYS.map((key) => [key, (level.spawnPools[key] || []).map((entry) => serializeEntity(entry, `spawn:${key}`))])),
    enemyDefinitions: structuredCloneSafe(level.enemyDefinitions || []),
    fixedEnemies: level.fixedEnemies.map((entry) => serializeEntity(entry, "fixedEnemies")),
  };

  if (level.specimenZones?.length) {
    result.specimenZones = level.specimenZones.map((entry) => serializeEntity(entry, "specimenZones"));
  }
  if (level.decor?.length) {
    result.decor = level.decor.map((entry) => serializeEntity(entry, "decor"));
  }

  return result;
}

function serializeWorkspace() {
  return Object.fromEntries(state.levelOrder.map((key) => [key, serializeLevel(state.levels[key])]));
}

async function copyText(text, successMessage) {
  await navigator.clipboard.writeText(text);
  updateSourceStatus(successMessage, "success");
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function applyLoadedLevels(levels) {
  state.levels = levels;
  state.levelOrder = Object.keys(levels);
  state.currentLevelId = state.levelOrder[0] || "";
  state.currentLayer = "obstacles";
  ensureLayerUiState();
  state.history.undo = [];
  state.history.redo = [];
  clearSelection();
  renderLevelSelect();
  renderLayerSelect();
  renderLayerControls();
  renderLevelMeta();
  renderEntityList();
  renderInspector();
  renderValidation();
  updateHistoryButtons();
  if (state.playtest.active) {
    placePlaytestPlayer();
    requestPlaytestFrame();
  }
  frameWorld();
}

async function reloadSource() {
  try {
    updateSourceStatus("Loading layout data...", "neutral");
    await loadAvailableAssets();
    const levels = await loadLevelTemplatesFromSource();
    applyLoadedLevels(levels);
    updateSourceStatus("Loaded level data from app.js.", "success");
  } catch (error) {
    updateSourceStatus(error.message || "Failed to load source data.", "error");
  }
}

async function saveSource() {
  try {
    updateSourceStatus("Saving level data into app.js...", "neutral");
    if (saveSourceButton) {
      saveSourceButton.disabled = true;
    }
    const response = await fetch("/api/save-levels", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ levels: serializeWorkspace() }),
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || `Failed to save app.js (${response.status})`);
    }
    updateSourceStatus(`Saved current editor workspace to app.js${payload.backup ? ` (${payload.backup} updated).` : "."}`, "success");
  } catch (error) {
    updateSourceStatus(error.message || "Failed to save app.js.", "error");
  } finally {
    if (saveSourceButton) {
      saveSourceButton.disabled = false;
    }
  }
}

function selectLevel(levelId) {
  if (!state.levels[levelId]) {
    return;
  }
  state.currentLevelId = levelId;
  clearSelection();
  renderLevelSelect();
  renderLevelMeta();
  renderEntityList();
  renderInspector();
  renderValidation();
  if (state.playtest.active) {
    placePlaytestPlayer();
    requestPlaytestFrame();
  }
  draw();
}

function selectLayer(layer) {
  state.currentLayer = layer;
  clearSelection();
  renderLayerSelect();
  renderLayerControls();
  renderEntityList();
  renderInspector();
  draw();
}

canvas.addEventListener("contextmenu", (event) => event.preventDefault());

canvas.addEventListener("pointerdown", (event) => {
  updatePointer(event);
  canvas.setPointerCapture(event.pointerId);

  if (event.button === 1 || event.button === 2) {
    state.dragMode = "pan";
    state.dragOriginView = { ...state.view };
    state.dragStartWorld = { x: state.pointer.rawWorldX, y: state.pointer.rawWorldY };
    return;
  }

  if (state.playtest.active) {
    return;
  }

  if (state.tool === "add") {
    addEntityAtPointer();
    return;
  }

  if (state.buildingTool !== "off") {
    const buildingHit = hitTest({ x: state.pointer.worldX, y: state.pointer.worldY });
    if (buildingHit?.layer === "buildings" && canEditLayer("buildings")) {
      selectEntity({ layer: "buildings", entityId: buildingHit.entity._editorId }, true);
      if (applyBuildingShellToolAtPoint(placementPoint(), buildingHit.entity)) {
        return;
      }
    }
  }

  const activeResizeHandle = resizeHandleHit({ x: state.pointer.worldX, y: state.pointer.worldY });
  if (activeResizeHandle && selectedEntity() && !selectedEntityIsReadOnly()) {
    const point = placementPoint();
    pushHistorySnapshot(`Resize ${labelForEntity(selectedEntity(), selectedEntityLayer())}`);
    state.dragMode = "resize";
    state.dragResizeHandle = activeResizeHandle;
    state.dragStartWorld = { x: point.x, y: point.y };
    state.dragOriginEntity = structuredCloneSafe(selectedEntity());
    state.dragOriginLayer = selectedEntityLayer();
    state.dragChanged = false;
    return;
  }

  const hit = hitTest({ x: state.pointer.worldX, y: state.pointer.worldY });
  if (hit) {
    selectEntity({ layer: hit.layer, entityId: hit.entity._editorId }, true);
    if (canEditLayer(hit.layer)) {
      const point = placementPoint();
      pushHistorySnapshot(`Move ${labelForEntity(hit.entity, hit.layer)}`);
      state.dragMode = "move";
      state.dragStartWorld = { x: point.x, y: point.y };
      state.dragOriginEntity = structuredCloneSafe(hit.entity);
      state.dragOriginLayer = hit.layer;
      state.dragChanged = false;
    }
    return;
  }

  const point = placementPoint();
  state.dragMode = "box-select";
  state.dragStartWorld = { x: point.x, y: point.y };
  state.selectionBox = { x: point.x, y: point.y, w: 0, h: 0 };
  draw();
});

canvas.addEventListener("pointermove", (event) => {
  updatePointer(event);

  if (state.dragMode === "pan" && state.dragStartWorld && state.dragOriginView) {
    const current = screenToWorld(state.pointer.x, state.pointer.y);
    const dx = current.x - state.dragStartWorld.x;
    const dy = current.y - state.dragStartWorld.y;
    state.view.x = state.dragOriginView.x - dx;
    state.view.y = state.dragOriginView.y - dy;
    draw();
    return;
  }

  if (state.dragMode === "move" && state.dragStartWorld && state.dragOriginEntity) {
    const entity = selectedEntity();
    if (!entity) {
      return;
    }
    const layer = state.dragOriginLayer || selectedEntityLayer();
    const point = placementPoint();
    const dx = Math.round(point.x - state.dragStartWorld.x);
    const dy = Math.round(point.y - state.dragStartWorld.y);
    Object.assign(entity, structuredCloneSafe(state.dragOriginEntity));
    translateEntity(entity, dx, dy, layer, editableBoundsModeForLayer(layer));
    if (layer === "buildings" && editableBoundsModeForLayer(layer) === "collision") {
      syncBuildingOpenings(entity);
    }
    if (editableBoundsModeForLayer(layer) === "visual") {
      autoFitEntityCollisionIfEnabled(entity, layer);
    }
    state.dragChanged = true;
    renderEntityList();
    draw();
  }

  if (state.dragMode === "resize" && state.dragOriginEntity && state.dragResizeHandle) {
    const entity = selectedEntity();
    if (!entity) {
      return;
    }
    const layer = state.dragOriginLayer || selectedEntityLayer();
    const point = placementPoint();
    Object.assign(entity, structuredCloneSafe(state.dragOriginEntity));
    applyResize(entity, layer, state.dragResizeHandle, editableRect(state.dragOriginEntity, layer), point);
    if (layer === "buildings" && editableBoundsModeForLayer(layer) === "collision") {
      syncBuildingOpenings(entity);
    }
    if (editableBoundsModeForLayer(layer) === "visual") {
      autoFitEntityCollisionIfEnabled(entity, layer);
    }
    state.dragChanged = true;
    renderEntityList();
    draw();
  }

  if (state.dragMode === "box-select" && state.dragStartWorld) {
    const point = placementPoint();
    state.selectionBox = rectFromPoints(state.dragStartWorld, point);
    draw();
  }
});

canvas.addEventListener("pointerup", () => {
  if (state.dragMode === "box-select") {
    const selectionRect = state.selectionBox;
    state.selectionBox = null;
    if (selectionRect && (selectionRect.w > 6 || selectionRect.h > 6)) {
      const hit = pickEntityFromSelectionBox(selectionRect);
      if (hit) {
        selectEntity({ layer: hit.layer, entityId: hit.entity._editorId }, true);
        updateSourceStatus(`Marquee selected ${labelForEntity(hit.entity, hit.layer)}.`, "success");
      } else {
        clearSelection();
      }
    } else {
      clearSelection();
    }
  }
  if (state.dragChanged) {
    autoFitEntityCollisionIfEnabled();
    renderValidation();
  } else if (state.dragMode === "move" || state.dragMode === "resize") {
    state.history.undo.pop();
    updateHistoryButtons();
  }
  state.dragMode = null;
  state.dragStartWorld = null;
  state.dragOriginEntity = null;
  state.dragOriginLayer = null;
  state.dragResizeHandle = null;
  state.dragOriginView = null;
  state.dragChanged = false;
  updateCanvasCursor();
});

canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    updatePointer(event);
    const before = screenToWorld(state.pointer.x, state.pointer.y);
    const zoomFactor = event.deltaY < 0 ? 1.08 : 0.92;
    state.view.zoom = clamp(state.view.zoom * zoomFactor, 0.12, 2.8);
    const after = screenToWorld(state.pointer.x, state.pointer.y);
    state.view.x += before.x - after.x;
    state.view.y += before.y - after.y;
    draw();
  },
  { passive: false }
);

levelSelect.addEventListener("change", () => selectLevel(levelSelect.value));
layerSelect.addEventListener("change", () => selectLayer(layerSelect.value));
entityFilterInput?.addEventListener("input", () => {
  state.entityFilter = entityFilterInput.value || "";
  renderEntityList();
});
assetFilterInput?.addEventListener("input", () => {
  state.assetFilter = assetFilterInput.value || "";
  renderAssetPalette();
});
smartPlacementToggle?.addEventListener("click", () => {
  state.smartPlacement = !state.smartPlacement;
  updatePlacementControls();
  updateReadouts();
});
boundsModeToggle?.addEventListener("click", () => {
  state.boundsMode = state.boundsMode === "collision" ? "visual" : "collision";
  updatePlacementControls();
  draw();
});
autoFitToggle?.addEventListener("click", () => {
  state.autoFitCollision = !state.autoFitCollision;
  if (state.autoFitCollision) {
    autoFitEntityCollisionIfEnabled();
    renderValidation();
    draw();
  }
  updatePlacementControls();
});
snapToggle?.addEventListener("click", () => {
  state.gridEnabled = !state.gridEnabled;
  updatePlacementControls();
  updateReadouts();
  draw();
});
snapSizeSelect?.addEventListener("change", () => {
  state.gridSize = Math.max(10, Number.parseInt(snapSizeSelect.value, 10) || 100);
  updatePointer({ clientX: canvas.getBoundingClientRect().left + state.pointer.x, clientY: canvas.getBoundingClientRect().top + state.pointer.y });
  updatePlacementControls();
  draw();
});
rotateLeftButton?.addEventListener("click", () => {
  rotateSelectedEntity(-rotationStep({ shiftKey: false }, selectedEntityLayer()));
});
rotateRightButton?.addEventListener("click", () => {
  rotateSelectedEntity(rotationStep({ shiftKey: false }, selectedEntityLayer()));
});
buildingToolSelect?.addEventListener("change", () => {
  state.buildingTool = buildingToolSelect.value || "off";
  updatePlacementControls();
  draw();
});
playtestToggle?.addEventListener("click", () => {
  setPlaytestActive(!state.playtest.active);
});
toolSelectButton.addEventListener("click", () => setTool("select"));
toolAddButton.addEventListener("click", () => setTool("add"));
deleteEntityButton.addEventListener("click", () => deleteSelectedEntity());
duplicateEntityButton.addEventListener("click", () => duplicateSelectedEntity());
reloadSourceButton.addEventListener("click", () => reloadSource());
saveSourceButton?.addEventListener("click", () => saveSource());
resetViewButton.addEventListener("click", () => frameWorld());
undoActionButton?.addEventListener("click", () => undoHistory());
redoActionButton?.addEventListener("click", () => redoHistory());

copyLayerJsonButton.addEventListener("click", async () => {
  try {
    await copyText(serializeCurrentLayer(), "Copied current layer JSON.");
  } catch {
    updateSourceStatus("Clipboard write failed.", "error");
  }
});

copyLevelJsonButton.addEventListener("click", async () => {
  try {
    await copyText(JSON.stringify(serializeLevel(currentLevel()), null, 2), "Copied full level JSON.");
  } catch {
    updateSourceStatus("Clipboard write failed.", "error");
  }
});

copyWorkspaceJsonButton.addEventListener("click", async () => {
  try {
    const payload = serializeWorkspace();
    await copyText(JSON.stringify(payload, null, 2), "Copied all level JSON.");
  } catch {
    updateSourceStatus("Clipboard write failed.", "error");
  }
});

downloadLevelJsonButton.addEventListener("click", () => {
  const level = currentLevel();
  if (!level) {
    return;
  }
  downloadText(`${level.id || "level"}.json`, JSON.stringify(serializeLevel(level), null, 2));
  updateSourceStatus(`Downloaded ${level.id || "level"}.json.`, "success");
});

window.addEventListener("keydown", (event) => {
  const activeTag = document.activeElement?.tagName;
  if (state.playtest.active) {
    if (event.key.toLowerCase() === "w" || event.key === "ArrowUp") {
      state.playtest.keys.up = true;
      event.preventDefault();
      return;
    }
    if (event.key.toLowerCase() === "s" || event.key === "ArrowDown") {
      state.playtest.keys.down = true;
      event.preventDefault();
      return;
    }
    if (event.key.toLowerCase() === "a" || event.key === "ArrowLeft") {
      state.playtest.keys.left = true;
      event.preventDefault();
      return;
    }
    if (event.key.toLowerCase() === "d" || event.key === "ArrowRight") {
      state.playtest.keys.right = true;
      event.preventDefault();
      return;
    }
    if (event.key.toLowerCase() === "e") {
      const building = nearestDoor();
      if (building?.door) {
        building.door.open = !building.door.open;
        updateSourceStatus(`${building.label || building.id} door ${building.door.open ? "opened" : "closed"}.`, "success");
        draw();
      }
      event.preventDefault();
      return;
    }
    if (event.key.toLowerCase() !== "p") {
      return;
    }
  }
  if (event.key.toLowerCase() === "p") {
    setPlaytestActive(!state.playtest.active);
    event.preventDefault();
    return;
  }
  if (
    activeTag !== "INPUT" &&
    activeTag !== "TEXTAREA" &&
    activeTag !== "SELECT" &&
    !event.ctrlKey &&
    !event.metaKey &&
    ["q", "e", "r", "f"].includes(event.key.toLowerCase())
  ) {
    const direction = event.key.toLowerCase() === "q" || event.key.toLowerCase() === "r" ? -1 : 1;
    rotateSelectedEntity(direction * rotationStep(event, selectedEntityLayer()));
    event.preventDefault();
    return;
  }
  if (event.key.toLowerCase() === "z" && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
    event.preventDefault();
    undoHistory();
    return;
  }
  if (
    ((event.key.toLowerCase() === "z" && (event.ctrlKey || event.metaKey) && event.shiftKey) ||
      (event.key.toLowerCase() === "y" && (event.ctrlKey || event.metaKey)))
  ) {
    event.preventDefault();
    redoHistory();
    return;
  }
  if (event.key.toLowerCase() === "s" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    saveSource();
    return;
  }
  if ((event.key === "Delete" || event.key === "Backspace") && activeTag !== "INPUT" && activeTag !== "TEXTAREA" && activeTag !== "SELECT") {
    deleteSelectedEntity();
  }
  if (event.key.toLowerCase() === "a") {
    setTool("add");
  }
  if (event.key.toLowerCase() === "v") {
    setTool("select");
  }
  if (event.key.toLowerCase() === "d" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    duplicateSelectedEntity();
  }
});

window.addEventListener("keyup", (event) => {
  if (!state.playtest.active) {
    return;
  }
  if (event.key.toLowerCase() === "w" || event.key === "ArrowUp") {
    state.playtest.keys.up = false;
    return;
  }
  if (event.key.toLowerCase() === "s" || event.key === "ArrowDown") {
    state.playtest.keys.down = false;
    return;
  }
  if (event.key.toLowerCase() === "a" || event.key === "ArrowLeft") {
    state.playtest.keys.left = false;
    return;
  }
  if (event.key.toLowerCase() === "d" || event.key === "ArrowRight") {
    state.playtest.keys.right = false;
  }
});

new ResizeObserver(() => draw()).observe(canvas);

setTool("select");
reloadSource();
