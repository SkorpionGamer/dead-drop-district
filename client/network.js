(function () {
  const runtime = window.__raidRuntime;

  if (!runtime) {
    return;
  }

  let socket = null;
  let localId = null;
  let reconnectTimer = 0;

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

    if (window.location.protocol === "http:" || window.location.protocol === "https:") {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${wsProtocol}//${window.location.host}/ws`;
    }

    return "ws://127.0.0.1:3000/ws";
  }

  function pushPresence() {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(
      JSON.stringify({
        type: "hello",
        className: runtime.getSelectedClass(),
        weaponLabel: runtime.getState()?.player?.weapon?.label || "",
      })
    );
  }

  function connect() {
    socket = new WebSocket(getSocketUrl());

    socket.addEventListener("open", () => {
      reconnectTimer = 0;
      pushPresence();
      runtime.setNetworkStatus("Multiplayer link live.");
    });

    socket.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      if (message.type === "welcome") {
        localId = message.id;
        runtime.setLocalNetworkId(localId);
        runtime.setRaidHost(Boolean(message.isHost));
        if (message.needsWorld) {
          const world = runtime.exportWorldState?.();
          if (world) {
            socket.send(JSON.stringify({ type: "world_init", world }));
          }
        }
        return;
      }

      if (message.type === "snapshot" && Array.isArray(message.players)) {
        runtime.setRaidHost(message.hostId === localId);
        const remotes = message.players.filter((player) => player.id !== localId);
        runtime.setRemotePlayers(remotes);
        runtime.setPresenceCount(message.playerCount || remotes.length + (localId ? 1 : 0));
        const localPlayer = message.players.find((player) => player.id === localId);
        if (localPlayer) {
          runtime.applyAuthoritativeLocalState?.(localPlayer);
        }
        if (message.world) {
          runtime.applyWorldState?.(message.world);
        }
        if (message.combat) {
          runtime.applyCombatSnapshot?.(message.combat);
        }
        return;
      }

      if (message.type === "player_action" && runtime.isRaidHost?.()) {
        runtime.applyRemoteAction?.(message.playerId, message.action);
      }
    });

    socket.addEventListener("close", () => {
      runtime.setRemotePlayers([]);
      runtime.setPresenceCount(1);
      runtime.setNetworkStatus("Multiplayer link lost. Reconnecting...");
      reconnectTimer = window.setTimeout(connect, 1000);
    });
  }

  function sendLocalState() {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const snapshot = runtime.getLocalSnapshot();
    if (!snapshot) {
      return;
    }

    socket.send(JSON.stringify({ type: "player_state", state: snapshot }));
  }

  function sendCombatState() {
    if (!socket || socket.readyState !== WebSocket.OPEN || !runtime.isRaidHost?.()) {
      return;
    }

    const combat = runtime.getCombatSnapshot?.();
    if (!combat) {
      return;
    }

    socket.send(JSON.stringify({ type: "combat_state", combat }));
  }

  runtime.publishWorldAction = (action) => {
    if (!socket || socket.readyState !== WebSocket.OPEN || !action) {
      return;
    }

    socket.send(JSON.stringify({ type: "world_action", action }));
  };

  runtime.publishPlayerAction = (action) => {
    if (!socket || socket.readyState !== WebSocket.OPEN || !action) {
      return;
    }

    socket.send(JSON.stringify({ type: "player_action", action }));
  };

  runtime.publishPlayerPatch = (playerId, patch) => {
    if (!socket || socket.readyState !== WebSocket.OPEN || !playerId || !patch) {
      return;
    }

    socket.send(JSON.stringify({ type: "player_patch", playerId, patch }));
  };

  connect();
  window.setInterval(sendLocalState, 66);
  window.setInterval(sendCombatState, 50);
})();
