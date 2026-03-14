# Dead Drop District Deploy

## Railway Server

Deploy the whole project repo or the [dead-drop-district](d:/Project/dead-drop-district) folder to Railway from GitHub.

Railway should use:

- start command: `node server/server.js`
- port: provided automatically by Railway through `PORT`
- health check: `/health`

This project already supports Railway server hosting:

- [server/server.js](d:/Project/dead-drop-district/server/server.js) binds `0.0.0.0`
- [server/server.js](d:/Project/dead-drop-district/server/server.js) reads `process.env.PORT`
- [railway.json](d:/Project/dead-drop-district/railway.json) declares the start command and health check

After deploy, Railway will give you a public URL like:

- `https://your-railway-app.up.railway.app`

The matching WebSocket URL will be:

- `wss://your-railway-app.up.railway.app/ws`

## Static Client

If you host the browser client on a different static host like Netlify or Vercel, set the server URL in [client/config.js](d:/Project/dead-drop-district/client/config.js).

Example:

```js
(function () {
  window.__DDD_CONFIG__ = {
    websocketUrl: "wss://your-railway-app.up.railway.app/ws",
  };
})();
```

You can also use `serverBaseUrl` instead:

```js
(function () {
  window.__DDD_CONFIG__ = {
    serverBaseUrl: "https://your-railway-app.up.railway.app",
  };
})();
```

[client/network.js](d:/Project/dead-drop-district/client/network.js) will derive `/ws` automatically from `serverBaseUrl`.

## Same-Origin Hosting

If you let the Railway Node server host the client and the WebSocket on the same origin, you do not need to change [client/config.js](d:/Project/dead-drop-district/client/config.js). The client will use same-origin `/ws` automatically.

## Quick Test

1. Deploy the server to Railway.
2. Open the Railway URL in your browser.
3. Confirm `/health` returns JSON.
4. Open the game on two machines.
5. Start a run and verify both players see the same raid state.
