const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const { MULTIPLAYER } = require("../shared/multiplayer");

const ROOT = path.resolve(__dirname, "..");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function sanitizeRequestPath(requestUrl) {
  const parsed = new URL(requestUrl, "http://localhost");
  const pathname = parsed.pathname === "/" ? "/index.html" : parsed.pathname;
  const resolved = path.resolve(ROOT, `.${pathname}`);
  return resolved.startsWith(ROOT) ? resolved : null;
}

function createRoom() {
  return {
    players: new Map(),
    world: null,
    combat: null,
    hostId: null,
  };
}

function createAppServer() {
  const room = createRoom();

  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, players: room.players.size }));
      return;
    }

    const filePath = sanitizeRequestPath(req.url || "/");

    if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(filePath).pipe(res);
  });

  const wss = new WebSocketServer({ server, path: "/ws" });

  function send(socket, payload) {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }

  function broadcastSnapshot() {
    const players = Array.from(room.players.values()).map((player) => ({
      id: player.id,
      className: player.className,
      weaponLabel: player.weaponLabel,
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
      running: player.running,
      updatedAt: player.updatedAt,
    }));

    const snapshot = {
      type: "snapshot",
      players,
      world: room.world,
      combat: room.combat,
      hostId: room.hostId,
      playerCount: players.length,
      serverTime: Date.now(),
    };

    for (const client of wss.clients) {
      send(client, snapshot);
    }
  }

  const snapshotTimer = setInterval(broadcastSnapshot, MULTIPLAYER.snapshotRateMs);

  wss.on("connection", (socket) => {
    const id = `p_${Math.random().toString(36).slice(2, 10)}`;
    const player = {
      id,
      socket,
      className: "stealther",
      weaponLabel: "Suppressed Sidearm",
      x: 0,
      y: 0,
      radius: 15,
      angle: 0,
      hp: 100,
      maxHp: 100,
      ammo: 0,
      magSize: 0,
      shieldEquipped: false,
      shieldHp: 0,
      running: false,
      updatedAt: Date.now(),
    };

    room.players.set(id, player);
    if (!room.hostId) {
      room.hostId = id;
    }

    send(socket, {
      type: "welcome",
      id,
      isHost: room.hostId === id,
      maxPlayers: MULTIPLAYER.maxPlayers,
      needsWorld: !room.world,
    });
    broadcastSnapshot();

    socket.on("message", (raw) => {
      let message;
      try {
        message = JSON.parse(String(raw));
      } catch {
        return;
      }

      if (message.type === "hello") {
        player.className = message.className || player.className;
        player.weaponLabel = message.weaponLabel || player.weaponLabel;
        player.updatedAt = Date.now();
        return;
      }

      if (message.type === "world_init" && message.world && !room.world) {
        room.world = message.world;
        broadcastSnapshot();
        return;
      }

      if (message.type === "combat_state" && message.combat && id === room.hostId) {
        room.combat = message.combat;
        return;
      }

      if (message.type === "world_action" && message.action && room.world) {
        const { action } = message;

        if (action.type === "door" && Array.isArray(room.world.doors)) {
          const door = room.world.doors.find((entry) => entry.id === action.id);
          if (door) {
            door.open = Boolean(action.open);
          }
        }

        if (action.type === "window" && Array.isArray(room.world.windows)) {
          const windowEntry = room.world.windows.find((entry) => entry.id === action.id);
          if (windowEntry) {
            windowEntry.broken = Boolean(action.broken);
          }
        }

        if (action.type === "loot" && Array.isArray(room.world.loot)) {
          const loot = room.world.loot.find((entry) => entry.id === action.id);
          if (loot) {
            loot.collected = Boolean(action.collected);
          }
        }

        broadcastSnapshot();
        return;
      }

      if (message.type === "player_action" && message.action && room.hostId && room.hostId !== id) {
        const host = room.players.get(room.hostId);
        if (host?.socket) {
          send(host.socket, { type: "player_action", playerId: id, action: message.action });
        }
        return;
      }

      if (message.type === "player_patch" && message.playerId && message.patch && id === room.hostId) {
        const target = room.players.get(message.playerId);
        if (target) {
          Object.assign(target, {
            hp: typeof message.patch.hp === "number" ? message.patch.hp : target.hp,
            maxHp: typeof message.patch.maxHp === "number" ? message.patch.maxHp : target.maxHp,
            shieldEquipped:
              typeof message.patch.shieldEquipped === "boolean" ? message.patch.shieldEquipped : target.shieldEquipped,
            shieldHp: typeof message.patch.shieldHp === "number" ? message.patch.shieldHp : target.shieldHp,
          });
          broadcastSnapshot();
        }
        return;
      }

      if (message.type === "player_state" && message.state) {
        Object.assign(player, {
          className: message.state.className || player.className,
          weaponLabel: message.state.weaponLabel || player.weaponLabel,
          x: Number(message.state.x) || 0,
          y: Number(message.state.y) || 0,
          radius: Number(message.state.radius) || player.radius,
          angle: Number(message.state.angle) || 0,
          hp: Number(message.state.hp) || player.hp,
          maxHp: Number(message.state.maxHp) || player.maxHp,
          ammo: Number(message.state.ammo) || 0,
          magSize: Number(message.state.magSize) || 0,
          shieldEquipped: Boolean(message.state.shieldEquipped),
          shieldHp: Number(message.state.shieldHp) || 0,
          running: Boolean(message.state.running),
          updatedAt: Date.now(),
        });
      }
    });

    socket.on("close", () => {
      room.players.delete(id);
      if (room.hostId === id) {
        room.hostId = room.players.keys().next().value || null;
        room.combat = null;
      }
      broadcastSnapshot();
    });
  });

  server.on("close", () => {
    clearInterval(snapshotTimer);
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
