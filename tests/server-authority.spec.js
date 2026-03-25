const { once } = require("node:events");
const { test, expect } = require("playwright/test");
const WebSocket = require("ws");

const { createAppServer } = require("../server/server");
const { CLIENT_MESSAGE, ROOM_PHASE, SERVER_MESSAGE, UI_EVENT_KIND } = require("../shared/protocol");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startServer() {
  const server = createAppServer();
  await new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      resolve();
    });
  });

  const address = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    wsUrl: `ws://127.0.0.1:${address.port}/ws`,
  };
}

async function stopServer(server) {
  await new Promise((resolve) => server.close(resolve));
}

async function waitForMessage(messages, startIndex, predicate, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (let index = startIndex; index < messages.length; index += 1) {
      const message = messages[index];
      if (predicate(message)) {
        return message;
      }
    }
    await delay(25);
  }

  throw new Error("Timed out waiting for websocket message.");
}

test("lobby input frames stay in lobby until the raid actually starts", async () => {
  const { server, baseUrl, wsUrl } = await startServer();
  const socket = new WebSocket(wsUrl);
  const messages = [];

  socket.on("message", (raw) => {
    messages.push(JSON.parse(String(raw)));
  });

  try {
    await once(socket, "open");

    const helloPayload = {
      type: CLIENT_MESSAGE.HELLO,
      className: "stealther",
      weaponLabel: "Suppressed Sidearm",
      displayName: "Lobby Ghost",
      title: "Pre-raid",
    };

    socket.send(JSON.stringify(helloPayload));
    await waitForMessage(messages, 0, (message) => message.type === SERVER_MESSAGE.WELCOME);

    socket.send(
      JSON.stringify({
        type: CLIENT_MESSAGE.INPUT_FRAME,
        seq: 1,
        input: {
          moveX: 0,
          moveY: 0,
          aimAngle: 0,
          sprintHeld: false,
          quietHeld: false,
          quietMode: false,
          className: "stealther",
          weaponLabel: "Suppressed Sidearm",
          displayName: "Lobby Ghost",
          title: "Pre-raid",
          running: false,
          seed: {
            hp: 2,
            maxHp: 2,
            ammo: 12,
            magSize: 12,
            reloadTime: 2.45,
            shieldEquipped: false,
            shieldHp: 0,
            medkits: 1,
            noiseCharges: 2,
            cash: 60,
            adminInvisible: false,
            adminGodMode: false,
            invisible: false,
          },
          spawn: {
            x: 300,
            y: 1640,
            radius: 15,
          },
        },
      })
    );

    await delay(220);

    const health = await fetch(`${baseUrl}/health`).then((response) => response.json());
    expect(health.phase).toBe(ROOM_PHASE.LOBBY);

    const failEvents = messages.filter(
      (message) =>
        message.type === SERVER_MESSAGE.UI_EVENT &&
        message.kind === UI_EVENT_KIND.RAID_TRANSITION &&
        message.payload?.mode === ROOM_PHASE.FAIL
    );
    expect(failEvents).toHaveLength(0);

    const snapshotStartIndex = messages.length;
    socket.send(JSON.stringify(helloPayload));
    const fullSnapshot = await waitForMessage(
      messages,
      snapshotStartIndex,
      (message) =>
        message.type === SERVER_MESSAGE.FULL_SNAPSHOT &&
        Array.isArray(message.players) &&
        message.players.some((player) => player.displayName === "Lobby Ghost")
    );
    const lobbyPlayer = fullSnapshot.players.find((player) => player.displayName === "Lobby Ghost");
    expect(lobbyPlayer?.initialized).toBeFalsy();
    expect(lobbyPlayer?.running).toBeFalsy();
  } finally {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
      await Promise.race([once(socket, "close"), delay(1000)]);
    }
    await stopServer(server);
  }
});
