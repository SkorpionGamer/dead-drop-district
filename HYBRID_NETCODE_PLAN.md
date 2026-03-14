# Dead Drop District Hybrid Netcode Plan

## Goal

Move from the current loose host-authoritative relay model to a **hybrid session server**.

In the hybrid model:

- the **server** owns session truth
- the **host** still owns moment-to-moment combat simulation for now
- **clients** send inputs and requests, not arbitrary gameplay truth

This is the best medium-size architecture upgrade for the current project because it fixes the worst co-op failures without requiring a full dedicated authoritative server rewrite.

## Target Authority Split

### Server owns

- room membership
- host assignment
- restart / ready state
- player live/dead/running state
- player loadout identity
- player persistent combat resources:
  - hp
  - maxHp
  - ammo
  - magSize
  - reload state
  - shield
  - medkits
  - noise charges
  - cash
  - admin flags
- world version / level id
- canonical world object mutations:
  - doors
  - windows
  - loot collected
- reconnect / stale-player eviction

### Host owns for phase 1

- enemy AI
- bullets
- hit resolution
- heat gain logic
- boss logic
- temporary combat effects

### Clients own

- local input
- local rendering
- local prediction
- UI / overlays / debug

## What Changes First

Do this in phases. Do not rewrite everything at once.

### Phase 1: Session Truth

Files:

- [server.js](/d:/Project/dead-drop-district/server/server.js)
- [client/network.js](/d:/Project/dead-drop-district/client/network.js)
- [app.js](/d:/Project/dead-drop-district/app.js)

Main change:

- stop treating `player_state` as a partial truth blob
- replace it with:
  - `input_state`
  - `player_request`
  - server-owned `player_snapshot`

Server stores canonical per-player state and only accepts specific requests.

Examples:

- `reload_request`
- `medkit_request`
- `noise_request`
- `restart_request`
- `admin_request`

The server should never accept direct non-host writes for:

- hp
- ammo
- running
- invisible
- admin flags
- cash
- medkits
- noise charges

### Phase 2: World Versioning

Files:

- [server.js](/d:/Project/dead-drop-district/server/server.js)
- [app.js](/d:/Project/dead-drop-district/app.js)

Add:

- `room.worldVersion`
- `room.combatVersion`
- `room.levelVersion`

Every world or combat authority update increments a version.

Clients only apply snapshots if:

- the version is newer
- or the change is explicitly forced, such as host handoff

This prevents stale restart and stale handoff snapshots from replaying old state over new runs.

### Phase 3: Restart Flow

Files:

- [server.js](/d:/Project/dead-drop-district/server/server.js)
- [client/network.js](/d:/Project/dead-drop-district/client/network.js)
- [app.js](/d:/Project/dead-drop-district/app.js)

Current restart flow still resets locally and depends on follow-up world/combat sync.

Replace it with a real restart transaction:

1. player sends `restart_request`
2. server tracks ready set
3. server broadcasts `restart_status`
4. when quorum is reached, server increments `levelVersion`
5. server clears room combat/world transient state for the run
6. host receives `restart_commit`
7. host repopulates fresh combat/world state for the new version
8. clients ignore older versions

This removes the current stale authority window.

### Phase 4: Reconnect and Stale Session Handling

Files:

- [server.js](/d:/Project/dead-drop-district/server/server.js)
- [client/network.js](/d:/Project/dead-drop-district/client/network.js)

Add:

- stale player timeout using `updatedAt`
- connection token / session token per player
- reconnect path that rebinds an existing player slot when possible

Server should evict players when:

- no socket
- no updates for timeout window
- not in restart grace / reconnect grace

This fixes ghost players blocking rooms and restarts.

### Phase 5: Input-Driven Non-Host Flow

Files:

- [client/network.js](/d:/Project/dead-drop-district/client/network.js)
- [app.js](/d:/Project/dead-drop-district/app.js)
- [server.js](/d:/Project/dead-drop-district/server/server.js)

Instead of sending full `player_state` every `16ms`, send:

- movement intent
- aim angle
- buttons currently active

Example payload:

```json
{
  "type": "input_state",
  "moveX": 1,
  "moveY": 0,
  "aim": 1.57,
  "sprint": false,
  "quiet": true,
  "fireHeld": false
}
```

For phase 1 hybrid, the server can still relay this to host.
Later, the server can validate or own more of it directly.

This reduces bandwidth and removes many desync causes from arbitrary state replication.

## Concrete Code Changes

## 1. Replace `player_state` usage

Current problem:

- non-hosts still send too much state through `player_state`

Current locations:

- [client/network.js](/d:/Project/dead-drop-district/client/network.js)
- [server.js](/d:/Project/dead-drop-district/server/server.js)

Target:

- `player_state` becomes host-only or debug-only
- non-host clients send `input_state`
- server stores canonical player resources

## 2. Add canonical player model on server

In [server.js](/d:/Project/dead-drop-district/server/server.js), create a stronger player object:

- `sessionId`
- `connected`
- `initialized`
- `readyState`
- `running`
- `dead`
- `className`
- `position`
- `aim`
- `resources`
- `adminFlags`
- `lastInputAt`
- `lastSnapshotAck`

Do not leave these as loose top-level fields forever.

## 3. Add snapshot versions

In [server.js](/d:/Project/dead-drop-district/server/server.js):

- `snapshot.sequence`
- `world.version`
- `combat.version`

In [client/network.js](/d:/Project/dead-drop-district/client/network.js):

- cache last applied versions
- reject stale packets

In [app.js](/d:/Project/dead-drop-district/app.js):

- apply only newer authoritative snapshots

## 4. Formalize host handoff

Current issue:

- host handoff sends state to the new host only
- the rest of the room continues during that transition

Hybrid fix:

1. server sets room phase to `handoff`
2. server broadcasts `handoff_begin`
3. clients stop accepting normal gameplay authority updates except session updates
4. new host receives full authority payload
5. new host acknowledges
6. server broadcasts `handoff_commit`

Until `handoff_commit`, room gameplay should be paused.

## 5. Reduce replication rate and payload size

Current:

- `player_state` at ~62 Hz
- combat at ~30 Hz
- large JSON payloads

Target:

- input at 20-30 Hz
- combat snapshot at 10-20 Hz
- world snapshots only on versioned mutation

Do not resend full `world` on every snapshot forever.

Use:

- event updates for doors/windows/loot
- periodic compact state snapshots

## 6. Add room phase state on server

In [server.js](/d:/Project/dead-drop-district/server/server.js), add:

- `lobby`
- `running`
- `restart_wait`
- `restarting`
- `handoff`
- `disconnected`

Many current bugs exist because the room is always implicitly “running unless not.”

## 7. Make debug overlay reflect server phases

In [app.js](/d:/Project/dead-drop-district/app.js), the `F9` overlay should eventually show:

- room phase
- world version
- combat version
- host id
- local role
- restart quorum
- stale age
- reconnect grace

This will make hybrid debugging much easier.

## Recommended Order of Implementation

### Step 1

Lock down server authority over player resources and running/dead flags.

### Step 2

Convert non-host `player_state` to `input_state`.

### Step 3

Version world/combat snapshots.

### Step 4

Rebuild restart flow on top of room phase + versions.

### Step 5

Add reconnect / stale-player eviction.

### Step 6

Pause room during host handoff and commit a clean transition.

## What Not To Do

Do not:

- add dual-host simulation
- let both clients mutate world truth
- keep expanding `player_state` as a catch-all
- keep restart as a local reset followed by hope
- keep sending full world forever at high frequency

## Success Criteria

The hybrid migration is working when:

- second player can reconnect without ghost duplication
- restart is one-click and deterministic
- host migration does not fork the run
- hp/ammo/resources stop bouncing
- clients cannot soft-freeze each other with bad snapshots
- local debug overlay shows stable versioned authority flow

## After Hybrid

If co-op remains central, the next architecture step is:

- move combat simulation from host to server

At that point the server becomes fully authoritative.
But do not do that yet. Get the hybrid stable first.
