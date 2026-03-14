(function () {
  const runtime = window.__raidRuntime;
  const protocol = window.DDDProtocol || {};
  const CLIENT_MESSAGE = protocol.CLIENT_MESSAGE || {};
  const SERVER_MESSAGE = protocol.SERVER_MESSAGE || {};
  const UI_EVENT_KIND = protocol.UI_EVENT_KIND || {};
  const COMBAT_EVENT_KIND = protocol.COMBAT_EVENT_KIND || {};

  if (!runtime) {
    return;
  }

  let socket = null;
  let localId = null;
  let reconnectTimer = 0;
  let suppressReconnectOnClose = false;
  let inputSequence = 0;
  const RECONNECT_TOKEN_STORAGE = "ddd-reconnect-token";
  const LEGACY_SESSION_STORAGE = "ddd-client-session-key";
  const snapshotVersionState = {
    sequence: 0,
    worldVersion: 0,
    combatVersion: 0,
    levelVersion: 0,
  };

  function isSameOriginLocalWebSocketAllowed(config = {}) {
    if (config.allowSameOriginLocalWs === false) {
      return false;
    }

    const protocolName = window.location?.protocol || "";
    const hostname = (window.location?.hostname || "").toLowerCase();
    if (!/^https?:$/i.test(protocolName)) {
      return false;
    }

    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  }

  function getReconnectToken() {
    try {
      const stored = window.localStorage.getItem(RECONNECT_TOKEN_STORAGE) || window.localStorage.getItem(LEGACY_SESSION_STORAGE);
      return stored || null;
    } catch {
      return null;
    }
  }

  function storeReconnectToken(token) {
    if (!token) {
      return;
    }

    try {
      window.localStorage.setItem(RECONNECT_TOKEN_STORAGE, token);
      window.localStorage.removeItem(LEGACY_SESSION_STORAGE);
    } catch {}
  }

  function getSocketUrl() {
    const config = window.__DDD_CONFIG__ || {};

    if (config.websocketUrl) {
      return config.websocketUrl;
    }

    if (config.serverBaseUrl) {
      const serverUrl = new URL(config.serverBaseUrl);
      serverUrl.protocol = serverUrl.protocol === "https:" ? "wss:" : "ws:";
      serverUrl.pathname = "/ws";
      serverUrl.search = "";
      serverUrl.hash = "";
      return serverUrl.toString();
    }

    if (!isSameOriginLocalWebSocketAllowed(config)) {
      return null;
    }

    const sameOriginUrl = new URL(window.location.href);
    sameOriginUrl.protocol = sameOriginUrl.protocol === "https:" ? "wss:" : "ws:";
    sameOriginUrl.pathname = "/ws";
    sameOriginUrl.search = "";
    sameOriginUrl.hash = "";
    return sameOriginUrl.toString();
  }

  function buildHelloPayload() {
    return {
      type: CLIENT_MESSAGE.HELLO || "hello",
      reconnectToken: getReconnectToken(),
      className: runtime.getSelectedClass(),
      weaponLabel: runtime.getState()?.player?.weapon?.label || "",
      displayName: runtime.getState()?.player?.displayName || "",
      title: runtime.getState()?.player?.title || "",
    };
  }

  function pushPresence() {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify(buildHelloPayload()));
  }

  function applySnapshotMessage(message) {
    if (!Array.isArray(message.players)) {
      return;
    }

    const incomingSequence = Number(message.snapshotSequence) || 0;
    const incomingLevelVersion = Number(message.levelVersion) || 0;
    if (
      incomingSequence > 0 &&
      incomingSequence < snapshotVersionState.sequence &&
      incomingLevelVersion <= snapshotVersionState.levelVersion
    ) {
      return;
    }

    snapshotVersionState.sequence = Math.max(snapshotVersionState.sequence, incomingSequence);
    snapshotVersionState.levelVersion = Math.max(snapshotVersionState.levelVersion, incomingLevelVersion);
    runtime.noteSnapshotReceived?.(message.serverTime);
    runtime.setRoomPhase?.(message.phase || "lobby");
    runtime.setRaidHost(message.hostId === localId);

    const remotes = message.players.filter((player) => player.id !== localId && player.initialized !== false);
    runtime.setRemotePlayers(remotes);
    runtime.setPresenceCount(message.playerCount || remotes.length + (localId ? 1 : 0));

    const localPlayer = message.players.find((player) => player.id === localId);
    if (localPlayer?.initialized) {
      runtime.applyAuthoritativeLocalState?.(localPlayer);
    }

    const incomingWorldVersion = Number(message.worldVersion) || 0;
    if (message.world && incomingWorldVersion >= snapshotVersionState.worldVersion) {
      snapshotVersionState.worldVersion = incomingWorldVersion;
      runtime.applyWorldState?.(message.world);
    }

    const incomingCombatVersion = Number(message.combatVersion) || 0;
    if (message.combat && incomingCombatVersion >= snapshotVersionState.combatVersion) {
      snapshotVersionState.combatVersion = incomingCombatVersion;
      runtime.applyCombatSnapshot?.(message.combat);
    }
  }

  function handleUiEvent(message) {
    if (!message?.kind) {
      return;
    }

    if (message.kind === UI_EVENT_KIND.RESTART_STATUS || message.kind === "restart_status") {
      runtime.applyRestartStatus?.(message.payload || message);
      return;
    }

    if (message.kind === UI_EVENT_KIND.RESTART_COMMIT || message.kind === "restart_commit") {
      const payload = message.payload || message;
      snapshotVersionState.levelVersion = Math.max(snapshotVersionState.levelVersion, Number(payload.levelVersion) || 0);
      snapshotVersionState.worldVersion = Math.max(snapshotVersionState.worldVersion, Number(payload.worldVersion) || 0);
      snapshotVersionState.combatVersion = Math.max(snapshotVersionState.combatVersion, Number(payload.combatVersion) || 0);
      runtime.applyRestartCommit?.(payload);
      return;
    }

    if (message.kind === UI_EVENT_KIND.HOST_HANDOFF || message.kind === "host_handoff") {
      const payload = message.payload || message;
      if (payload.id !== localId) {
        return;
      }

      snapshotVersionState.levelVersion = Math.max(snapshotVersionState.levelVersion, Number(payload.levelVersion) || 0);
      snapshotVersionState.worldVersion = Math.max(snapshotVersionState.worldVersion, Number(payload.worldVersion) || 0);
      snapshotVersionState.combatVersion = Math.max(snapshotVersionState.combatVersion, Number(payload.combatVersion) || 0);
      runtime.adoptHostAuthorityState?.({
        world: payload.world,
        combat: payload.combat,
      });
      runtime.setRaidHost(true);
      runtime.setNetworkStatus("Host authority transferred to this client.");
      runtime.setSocketStatus?.("host");
      return;
    }

    if (message.kind === UI_EVENT_KIND.STATUS_MESSAGE || message.kind === "status_message") {
      runtime.applyStatusMessage?.(message.payload || message);
      return;
    }

    if (message.kind === UI_EVENT_KIND.RAID_TRANSITION || message.kind === "raid_transition") {
      runtime.applyRaidTransition?.(message.payload || message);
    }
  }

  function handleCombatEvent(message) {
    const payload = message.payload || message;
    if ((message.kind === COMBAT_EVENT_KIND.SNAPSHOT || message.kind === "snapshot") && payload.combat) {
      runtime.applyCombatSnapshot?.(payload.combat);
      return;
    }

    if ((message.kind === COMBAT_EVENT_KIND.HANDOFF || message.kind === "handoff") && payload.id === localId) {
      runtime.adoptHostAuthorityState?.({
        world: payload.world,
        combat: payload.combat,
      });
      return;
    }

    runtime.applyCombatEvent?.({
      kind: message.kind,
      payload,
      localId,
    });
  }

  function connect() {
    const socketUrl = getSocketUrl();
    if (!socketUrl) {
      runtime.setRemotePlayers([]);
      runtime.setPresenceCount(1);
      runtime.setNetworkStatus("Offline local run.");
      runtime.setSocketStatus?.("offline");
      runtime.setRoomPhase?.("lobby");
      runtime.setRaidHost(true);
      return;
    }

    runtime.setSocketStatus?.("connecting");
    const activeSocket = new WebSocket(socketUrl);
    socket = activeSocket;

    activeSocket.addEventListener("open", () => {
      if (socket !== activeSocket) {
        return;
      }
      reconnectTimer = 0;
      inputSequence = 0;
      activeSocket.send(JSON.stringify(buildHelloPayload()));
      runtime.setNetworkStatus("Multiplayer link live.");
      runtime.setSocketStatus?.("live");
    });

    activeSocket.addEventListener("message", (event) => {
      if (socket !== activeSocket) {
        return;
      }

      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      if (message.type === SERVER_MESSAGE.WELCOME || message.type === "welcome") {
        localId = message.id;
        snapshotVersionState.sequence = 0;
        snapshotVersionState.worldVersion = 0;
        snapshotVersionState.combatVersion = 0;
        snapshotVersionState.levelVersion = 0;
        runtime.setLocalNetworkId(localId);
        runtime.setRaidHost(Boolean(message.isHost));
        storeReconnectToken(message.reconnectToken || message.reconnectKey || null);
        if (message.needsWorld && message.isHost) {
          const world = runtime.exportWorldState?.();
          if (world) {
            activeSocket.send(JSON.stringify({ type: CLIENT_MESSAGE.WORLD_INIT || "world_init", world }));
          }
        }
        return;
      }

      if (
        message.type === SERVER_MESSAGE.FULL_SNAPSHOT ||
        message.type === SERVER_MESSAGE.DELTA_SNAPSHOT ||
        message.type === "snapshot"
      ) {
        applySnapshotMessage(message);
        return;
      }

      if (message.type === SERVER_MESSAGE.UI_EVENT) {
        handleUiEvent(message);
        return;
      }

      if (message.type === SERVER_MESSAGE.WORLD_EVENT) {
        if (message.world) {
          runtime.applyWorldState?.(message.world);
        }
        return;
      }

      if (message.type === SERVER_MESSAGE.COMBAT_EVENT) {
        handleCombatEvent(message);
        return;
      }

      if (message.type === "restart_status" || message.type === "restart_commit" || message.type === "host_handoff") {
        handleUiEvent({ kind: message.type, payload: message });
        return;
      }

      if (message.type === "combat_state" && message.combat) {
        runtime.applyCombatSnapshot?.(message.combat);
        return;
      }

      if (
        message.type === "action_request" ||
        message.type === "player_request" ||
        message.type === "player_action"
      ) {
        if (runtime.isRaidHost?.()) {
          runtime.applyRemoteAction?.(message.playerId, message.action || message.request);
        }
      }
    });

    activeSocket.addEventListener("close", (event) => {
      if (socket !== activeSocket) {
        return;
      }

      if (socket === activeSocket) {
        socket = null;
      }

      runtime.setRemotePlayers([]);
      runtime.setPresenceCount(1);
      runtime.setSocketStatus?.("offline");
      runtime.setRoomPhase?.("lobby");
      if (suppressReconnectOnClose) {
        suppressReconnectOnClose = false;
        return;
      }
      if (event.code === 1013) {
        runtime.setNetworkStatus("Raid room full.");
        return;
      }
      runtime.setNetworkStatus("Multiplayer link lost. Reconnecting...");
      reconnectTimer = window.setTimeout(connect, 1000);
    });
  }

  function sendInputFrame() {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const frame = runtime.getLocalInputFrame?.() || runtime.getLocalInputState?.();
    if (!frame) {
      return;
    }

    inputSequence += 1;
    socket.send(
      JSON.stringify({
        type: CLIENT_MESSAGE.INPUT_FRAME || "input_frame",
        seq: inputSequence,
        input: frame,
      })
    );
  }

  function sendCombatState() {
    if (!socket || socket.readyState !== WebSocket.OPEN || !runtime.isRaidHost?.()) {
      return;
    }

    const combat = runtime.getCombatSnapshot?.();
    if (!combat) {
      return;
    }

    socket.send(JSON.stringify({ type: CLIENT_MESSAGE.COMBAT_STATE || "combat_state", combat }));
  }

  runtime.publishWorldAction = (action) => {
    if (!socket || socket.readyState !== WebSocket.OPEN || !action) {
      return;
    }

    socket.send(JSON.stringify({ type: CLIENT_MESSAGE.WORLD_ACTION || "world_action", action }));
  };

  runtime.publishWorldState = (world) => {
    if (!socket || socket.readyState !== WebSocket.OPEN || !world) {
      return;
    }

    socket.send(JSON.stringify({ type: CLIENT_MESSAGE.WORLD_INIT || "world_init", world }));
  };

  runtime.publishPlayerAction = (action) => {
    if (!socket || socket.readyState !== WebSocket.OPEN || !action) {
      return;
    }

    socket.send(JSON.stringify({ type: CLIENT_MESSAGE.ACTION_REQUEST || "action_request", action }));
  };

  runtime.publishPlayerPatch = (playerId, patch) => {
    if (!socket || socket.readyState !== WebSocket.OPEN || !playerId || !patch) {
      return;
    }

    socket.send(JSON.stringify({ type: "player_patch", playerId, patch }));
  };

  runtime.publishRestartRequest = (payload = {}) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify({ type: CLIENT_MESSAGE.RESTART_REQUEST || "restart_request", force: Boolean(payload.force) }));
  };

  runtime.reconnectNetwork = () => {
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = 0;
    }
    suppressReconnectOnClose = true;
    try {
      socket?.close();
    } catch {}
    socket = null;
    connect();
  };

  runtime.refreshPresence = pushPresence;

  connect();
  window.setInterval(sendInputFrame, 33);
  window.setInterval(sendCombatState, 33);
})();
