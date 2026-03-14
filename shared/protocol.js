(function (root, factory) {
  const protocol = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = protocol;
  }

  if (root) {
    root.DDDProtocol = Object.assign({}, root.DDDProtocol || {}, protocol);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PROTOCOL_VERSION = 1;

  const ROOM_PHASE = Object.freeze({
    LOBBY: "lobby",
    DEPLOYING: "deploying",
    RUNNING: "running",
    BREACH_SHOP: "breach_shop",
    EXTRACTING: "extracting",
    SUCCESS: "success",
    FAIL: "fail",
    RECONNECT_GRACE: "reconnect_grace",
    RESTART_WAIT: "restart_wait",
    RESTARTING: "restarting",
  });

  const CLIENT_MESSAGE = Object.freeze({
    HELLO: "hello",
    INPUT_FRAME: "input_frame",
    ACTION_REQUEST: "action_request",
    RESTART_REQUEST: "restart_request",
    WORLD_ACTION: "world_action",
    WORLD_INIT: "world_init",
    COMBAT_STATE: "combat_state",
  });

  const SERVER_MESSAGE = Object.freeze({
    WELCOME: "welcome",
    FULL_SNAPSHOT: "full_snapshot",
    DELTA_SNAPSHOT: "delta_snapshot",
    WORLD_EVENT: "world_event",
    COMBAT_EVENT: "combat_event",
    UI_EVENT: "ui_event",
  });

  const UI_EVENT_KIND = Object.freeze({
    RESTART_STATUS: "restart_status",
    RESTART_COMMIT: "restart_commit",
    HOST_HANDOFF: "host_handoff",
    STATUS_MESSAGE: "status_message",
    RAID_TRANSITION: "raid_transition",
  });

  const WORLD_EVENT_KIND = Object.freeze({
    DOOR: "door",
    WINDOW: "window",
    LOOT: "loot",
    SYNC: "sync",
  });

  const COMBAT_EVENT_KIND = Object.freeze({
    SNAPSHOT: "snapshot",
    HANDOFF: "handoff",
    SHOT: "shot",
    ENEMY_SHOT: "enemy_shot",
    HIT: "hit",
    DEATH: "death",
    PLAYER_HIT: "player_hit",
    RELOAD: "reload",
    MEDKIT: "medkit",
    NOISE: "noise",
    ABILITY: "ability",
    ADMIN: "admin",
    TAKEDOWN: "takedown",
  });

  function createToken(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  }

  function createRoomId() {
    return createToken("room");
  }

  function createReconnectToken() {
    return createToken("reconnect");
  }

  function createWelcomePayload(overrides = {}) {
    return {
      type: SERVER_MESSAGE.WELCOME,
      protocolVersion: PROTOCOL_VERSION,
      ...overrides,
    };
  }

  function createSnapshotPayload(kind, overrides = {}) {
    return {
      type: kind,
      protocolVersion: PROTOCOL_VERSION,
      ...overrides,
    };
  }

  function createEventPayload(type, kind, payload = {}) {
    return {
      type,
      kind,
      protocolVersion: PROTOCOL_VERSION,
      ...payload,
    };
  }

  return {
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
  };
});
