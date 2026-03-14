Original prompt: try fixing the 4th problem, design a better intro screen and in game ui using new guidance we got today

- Using the local Impeccable guidance from `d:\Project\.codex\skills`, primarily `critique` and `frontend-design`.
- Focus area: redesign the intro screen and in-game HUD so the visual language better fits a post-industrial cyberpunk tone.
- Constraint: keep gameplay logic intact and avoid broad JavaScript rewrites unless a UI behavior fix is necessary.
- Reworked the visual system toward darker carbon surfaces, sodium-amber highlights, oxidized teal signals, and sharper industrial geometry.
- Intro screen changes:
- stronger hierarchy around title, class choice, and `Start Raid`
- angular panels and CTA treatment replacing the softer translucent dashboard feel
- scrollable overlay on mobile so the launch flow is reachable on narrow screens
- Live HUD changes:
- asymmetrical industrial card shapes and stronger metric emphasis
- updated palette and contrast for better thematic fit
- mobile HUD spacing tightened so objective/time/cash/heat no longer clip into the bottom status panel
- Shell cleanup:
- added an inline favicon to remove the 404 console error during page load
- Browser validation completed in Playwright:
- desktop intro and live HUD screenshots reviewed
- mobile intro screenshot confirmed overlay scrolling works
- mobile live HUD screenshot reviewed after position adjustments
- console logs are clean after the favicon addition
- Follow-up HUD pass:
- replaced the repeated “same card everywhere” treatment with more distinct live HUD modules
- vitals now reads as a primary slab, ammo as a rounded pressure gauge, shield as a quieter strip, stealth as a diagnostic panel, and right-side metrics as a lighter data rail
- mobile combat HUD is now a compact grid layout rather than separate absolute left/right stacks fighting each other
- revalidated desktop and mobile gameplay screenshots after the HUD refactor
- Authoritative migration foundation pass:
- added `shared/protocol.js` with protocol version, room phases, message constants, reconnect token helpers, and snapshot/event payload helpers for both browser and Node
- `client/config.js` now defaults dev/admin surfaces to local-dev only and same-origin websocket auto-connect to localhost only; deployed production pages now require explicit websocket/server config
- `index.html` script order now loads config + shared protocol before `app.js`
- shipping HUD additions:
- top-left squad state line
- objective subline with extraction guidance / objective gate
- dev-only class applied to admin controls and debug overlay so they are hidden outside dev mode
- `app.js` additions:
- dev-ui/admin gating in runtime behavior, not just CSS
- queued input-frame action flags for reload / interact / medkit / noise / ability / takedown / admin
- `window.render_game_to_text()` and `window.advanceTime(ms)` deterministic test hooks
- HUD sync now includes squad status + extraction guidance
- startup status copy now teaches the first 30 seconds more directly
- client networking pass:
- switched to explicit reconnect token storage from server welcome payload
- added `input_frame` sending path with sequence ids and semantic button state
- added support for `full_snapshot`, `delta_snapshot`, `ui_event`, `world_event`, and `combat_event`
- kept current gameplay-compatible action requests and combat/world sync as bridge compatibility
- server foundation pass:
- room now has `roomId`, seed, protocol-aware welcome payloads, reconnect tokens, and full/delta snapshot helpers
- input handling now accepts `input_frame` and legacy state messages through one shared applicator
- restart / host-handoff / world mutation messages now emit protocol event envelopes in addition to snapshots
- validation:
- `node --check` passed for `app.js`, `client/network.js`, `server/server.js`, `shared/protocol.js`
- Playwright smoke suite updated to current game flow (`freight` -> breach hold -> later stages) and passes: `6 passed`
- localhost browser pass confirmed:
- websocket link comes up on `http://127.0.0.1:3000/`
- new HUD fields render
- deterministic hooks are present
- room phase settles to `running` after the first authoritative tick

- Remaining roadmap work not yet implemented:
- true server-authoritative combat / AI / loot / extraction simulation is still pending
- host gameplay authority still exists as a bridge for combat/world logic
- client/runtime monolith has not yet been split into dedicated render / ui / client_sim / net / audio modules

Authoritative movement / reconciliation pass:
- added `shared/session-config.js` so both browser and Node can read the same world bounds, class movement stats, and reconciliation tuning
- `shared/multiplayer.js` now separates the session loop from snapshots:
- server simulation tick: `20 Hz`
- snapshot broadcast: about `15 Hz`
- browser `input_frame` messages no longer carry a live `state` position shadow; they now send semantic input plus one spawn/seed bundle for initialization
- `exportWorldState()` now includes:
- world bounds
- geometry-rich door/window/crate entries
- a collision snapshot derived from `getWorldObstacles()`
- server session authority now simulates player movement against that collision snapshot instead of copying per-frame browser positions
- client authority bridge now performs real reconciliation:
- local player blends back toward authoritative snapshot positions and only snaps on large divergence
- remote players buffer timestamped samples and render with a small interpolation delay instead of immediately chasing the newest snapshot
- added smoke coverage to lock in the new protocol bridge:
- input frames stay strict (no legacy `state`)
- exported world state includes collision data and geometry

Validation:
- `node --check` passed for:
- `app.js`
- `client/network.js`
- `server/server.js`
- `shared/protocol.js`
- `shared/session-config.js`
- Playwright smoke suite now passes: `7 passed`

Remaining architectural gaps after this pass:
- combat, AI, loot arbitration, extraction, and room progression are still not fully server-authored
- host-era `combat_state`, `world_action`, `player_action`, and `player_patch` bridges still exist for gameplay systems that have not yet been extracted
- freight collision/movement is now much closer to authoritative, but later stages still need the same treatment once their gameplay systems move off the browser host

Authoritative interact / extraction pass:
- `shared/protocol.js` now has dedicated UI event kinds for server-authored status messages and raid transitions
- live-session `interact()` in `app.js` now routes through the server instead of mutating doors/loot/extraction locally first
- `exportWorldState()` now includes the extraction zone, required objective count, boss gate flag, and next level id so the server can arbitrate extraction rules
- `server/server.js` now:
- preserves explicit room phases with `phaseLock`
- handles `action_request` / `player_action` interact requests directly for any player, including the room host
- awards loot/resources server-side for shield cells, medkits, noise tools, cash, and objective cargo
- validates extraction against squad presence, required loot, and boss state from the bridged combat snapshot
- emits raid transition UI events for breach-shop handoff and final extraction success
- `client/network.js` now consumes those new UI events and forwards them into the runtime
- `app.js` now applies server-authored status text and raid transitions (`breach_shop`, `success`, `fail`)

Validation:
- `node --check` passed again for:
- `app.js`
- `client/network.js`
- `server/server.js`
- `shared/protocol.js`
- Playwright smoke suite still passes: `7 passed`

Known limit after this pass:
- the smoke suite still runs in file-mode, so it validates the new bridge contracts but not a full multi-client extraction flow against the WebSocket server yet
- combat damage, shooting, AI state changes, takedowns, and most consumable timing are still bridged through the host-side combat runtime

Authoritative player combat-resource pass:
- `app.js` input frames now include a discrete `shootPressed` flag in addition to the existing semantic action flags
- `client/network.js` no longer skips authoritative local player snapshots when the local player is also the room host
- `server/server.js` now owns per-player combat resource timing/state for live sessions:
- shot ammo consumption and fire cooldown
- reload completion timing
- medkit consumption and HP restoration
- noise tool consumption
- cloak ability active/cooldown timers and server-owned invisibility state
- admin toggles and instant refill/heal actions
- player snapshots now expose `reloadRemaining`, `abilityActiveRemaining`, and `abilityCooldownRemaining`
- host-era browser combat bridge was narrowed further:
- host runtime still simulates bullets / AI / takedown outcomes as a temporary bridge
- but in live sessions it no longer publishes remote player ammo / medkit / noise / admin patches as the source of truth
- `updateRemoteReloads()` now stands down in live sessions so reload completion comes back from server snapshots instead of browser patches

Validation:
- `node --check` passed for:
- `app.js`
- `client/network.js`
- `server/server.js`
- `shared/protocol.js`
- Playwright smoke suite still passes: `7 passed`
- localhost WebSocket sanity pass:
- page boots on `http://127.0.0.1:3000/`
- raid starts successfully
- console errors: `0`

Remaining hard gap after this pass:
- enemy AI, bullet stepping, hit registration, damage application, takedown resolution, and full room progression still need extraction into a shared simulation before the browser host can be fully removed from combat authority

Server-authored combat-event bridge pass:
- `shared/protocol.js` now defines concrete combat event kinds for:
- `shot`
- `reload`
- `medkit`
- `noise`
- `ability`
- `admin`
- `takedown`
- `server/server.js` now broadcasts those combat events from the authoritative player-action processor instead of relying on direct client-to-host action forwarding for live sessions
- `client/network.js` now forwards non-snapshot combat events into the runtime via `applyCombatEvent`
- `app.js` now consumes those combat events so the host runtime can keep simulating remote player shots / noise / takedown side effects from server-approved actions rather than raw client action RPCs
- live-session `action_request` forwarding for known player combat actions is now cut off on the server; the server is the gatekeeper and event source for those actions

Validation:
- `node --check` passed again for:
- `app.js`
- `client/network.js`
- `server/server.js`
- `shared/protocol.js`
- Playwright smoke suite still passes: `7 passed`
- localhost WebSocket sanity pass still boots and starts raids with `0` console errors

Current practical boundary after this pass:
- player action authority is significantly more centralized on the server
- but the host browser still owns the underlying combat simulation model for bullets, enemy behavior, and damage outcomes
- the remaining work is no longer “wire up another message”; it is extracting the actual combat/AI simulation into a shared module used by both browser and Node
Authoritative player-bullet / hit-resolution pass:
- `shared/protocol.js` now defines additional server-authored combat outcome kinds:
- `hit`
- `death`
- `server/server.js` now keeps a minimal authoritative combat state even before the host has fully bridged combat, so live shots do not silently fail on an uninitialized room combat payload
- host `combat_state` updates now merge into the server copy instead of overwriting it, which preserves server-owned player bullets while still ingesting bridged enemy / enemy-bullet state from the host runtime
- the authoritative server loop now:
- steps player bullets every simulation tick
- resolves bullet collisions against exported freight collision
- breaks windows on impact
- damages / breaks crates and spawns crate loot server-side
- applies enemy shield blocks and HP damage server-side
- marks enemy deaths and awards the shooter cash server-side
- emits server-authored `hit` and `death` combat events for client FX
- `app.js` host combat bridge is narrower again:
- live-session `getCombatSnapshot()` no longer echoes player bullets back up to the server
- runtime now consumes server-authored `hit` / `death` events for impact and blood FX

Validation:
- `node --check` passed for:
- `server/server.js`
- `app.js`
- `shared/protocol.js`
- Playwright smoke suite still passes: `7 passed`
- localhost WebSocket sanity pass on `http://127.0.0.1:3000/`:
- page booted successfully
- console errors: `0`
- live-session ammo dropped from `12` to `11` after a real browser click shot, confirming the current shot/ammo path still round-trips over WebSocket

Remaining hard boundary after this pass:
- server now owns player bullet stepping and enemy hit/death outcomes, but enemy AI movement, enemy firing, damage to players, takedown resolution, alert propagation, and later-stage combat progression are still bridged through the browser host runtime
- full host removal still requires extracting enemy combat / AI simulation into shared code and replacing bridged `combat_state` enemy truth with server simulation truth

Authoritative enemy-bullet / player-damage pass:
- `shared/protocol.js` now defines `player_hit` as a server-authored combat event kind
- host-created enemy bullets now carry stable `bulletId` values in `app.js`, and serialized combat snapshots now include:
- `bulletId`
- `ownerEnemyId`
- `ownerFaction`
- `server/server.js` now:
- tracks per-player spawn protection time in the authoritative player runtime
- exposes `spawnProtectedRemaining` in player snapshots
- merges incoming host enemy bullets by stable projectile id instead of overwriting the server copy every snapshot
- steps bridged enemy bullets on the authoritative server loop
- applies enemy-bullet damage to players server-side with shield facing / shield break rules and spawn-protection / godmode checks
- marks dead players and stops their server-side `running` state
- emits server-authored `player_hit` combat events for hit FX and immediate local feedback
- emits a server-authored fail transition when the initialized squad is fully wiped
- `app.js` now consumes `player_hit` combat events so local/remote raid actors get hit/shield FX and the local player gets immediate HUD/message feedback before the next snapshot lands
- added smoke coverage for stable enemy bullet ids in combat snapshots

Validation:
- `node --check` passed for:
- `server/server.js`
- `app.js`
- `shared/protocol.js`
- `tests/smoke.spec.js`
- Playwright smoke suite now passes: `8 passed`
- localhost WebSocket sanity pass on `http://127.0.0.1:3000/`:
- page booted successfully
- console errors: `0`
- gameplay screenshot reviewed after starting a live raid

Remaining hard boundary after this pass:
- enemy firing origin still comes from the host-side AI runtime; the server now owns the stepped enemy projectiles and their raid damage outcomes, but it does not yet originate those shots itself
- specimen melee, enemy movement/decision-making, alert propagation, heat escalation, and later-stage encounter progression are still primarily host-authored
- the next true extraction step is shared enemy AI/sensing/combat generation so `combat_state` no longer has to feed server enemy truth at all

Authoritative specimen-melee / contact-damage pass:
- `server/server.js` now tracks per-room enemy melee locks so hostile contact damage is rate-limited on the server instead of relying on host-local cooldown state
- the authoritative combat loop now:
- selects nearby live visible raid targets for `specimen` enemies in `hunt`
- applies melee contact damage server-side using the same player shield / HP cell rules as projectile damage
- marks dead players as no longer running and lets the existing squad-wipe fail transition trigger from server state
- emits `player_hit` combat events with `melee: true` so clients can render contact-hit feedback without waiting for a full snapshot
- `app.js` now stands the host damage path down for raid-target specimen hits during live sessions; the host still advances enemy animation/cooldown intent, but it no longer directly mutates player HP on contact when a live server is attached
- `app.js` `player_hit` handling now distinguishes melee vs projectile impacts for messages and hit FX
- added smoke coverage to lock in the live-session melee guard on the host runtime

Validation:
- `node --check` passed for:
- `server/server.js`
- `app.js`
- `tests/smoke.spec.js`
- Playwright smoke suite now passes: `9 passed`
- localhost WebSocket sanity pass on `http://127.0.0.1:3000/`:
- page booted successfully
- console errors: `0`
- gameplay screenshot reviewed after starting a live raid

Remaining hard boundary after this pass:
- hostile intent is still host-authored: enemy movement, sensing, alert spread, containment release, heat escalation, and enemy shot origination still come from the browser combat runtime and are only being consumed/refined by the server
- the server now owns more of the consequences, but full authority still requires extracting enemy AI state transitions and attack generation into shared/server code so `combat_state` stops being the source of truth for enemy behavior

Authoritative enemy-shot origination pass:
- `shared/protocol.js` now defines `enemy_shot` as a server-authored combat event kind
- `server/server.js` now:
- tracks per-room ranged enemy shot locks separately from bridged enemy cooldown fields
- has world line-of-sight helpers for server-side hostile shot gating
- selects live raid targets from authoritative player state, predicts a short lead, and originates hostile bullets on the server instead of waiting for the host runtime to spawn them
- emits `enemy_shot` combat events for immediate muzzle/audio feedback
- clears ranged shot locks on restart/world re-init alongside other room combat lock state
- `app.js` now:
- consumes `enemy_shot` combat events for muzzle flash, shell ejection, sound, and local awareness feedback
- stands the host firing branch down for live-session raid-target shots while still advancing local enemy cooldown/muzzle intent so the browser runtime does not double-spawn hostile bullets
- added smoke coverage proving the live host runtime no longer spawns raid-target enemy bullets directly

Validation:
- `node --check` passed for:
- `server/server.js`
- `app.js`
- `shared/protocol.js`
- `tests/smoke.spec.js`
- Playwright smoke suite now passes: `10 passed`
- localhost WebSocket sanity pass on `http://127.0.0.1:3000/`:
- page booted successfully
- console errors: `0`
- gameplay screenshot reviewed after starting a live raid

Remaining hard boundary after this pass:
- the server now owns enemy shot generation, enemy projectile stepping, projectile damage to raid players, specimen contact damage, and player bullet hit/death outcomes
- the biggest remaining authority gaps are still enemy movement/sensing/state transitions, containment release, alert propagation, and heat/encounter escalation, which are still primarily derived from the browser host combat runtime and fed across via `combat_state`

Server-owned encounter escalation / containment pass:
- `server/server.js` now has encounter-side authority helpers for:
- heat score thresholds
- recent loud combat signals
- elite promotion
- hidden specimen release
- ally alert spreading from `justAlerted` enemies
- room-level heat/tier progression derived from authoritative combat + elapsed time
- player shots, noise tools, hostile shots, and breach impacts now feed server-side encounter signals / heat score instead of relying on the host browser to own escalation pressure
- hidden contained specimens can now release from server-owned heat/signal/player proximity checks
- `justAlerted` enemies now drive server-side ally investigation propagation and server-side heat increases
- `combat.heat`, `combat.heatScore`, `combat.heatTierApplied`, `combat.lootCollected`, and escalation messages are now refreshed in the authoritative server tick instead of trusting the host combat payload as the final source
- `app.js` live-session stand-downs now cover:
- `registerHeat`
- `applyHeatEscalation`
- `updateHeat`
- `notifyNearbyEnemies`
- `shouldReleaseSpecimen`
- added smoke coverage that the host runtime no longer escalates heat or releases contained specimens during a live session

Validation:
- `node --check` passed for:
- `server/server.js`
- `app.js`
- `tests/smoke.spec.js`
- Playwright smoke suite now passes: `11 passed`
- localhost WebSocket sanity pass on `http://127.0.0.1:3000/`:
- page booted successfully
- console errors: `0`
- gameplay screenshot reviewed after starting a live raid and confirmed hostile presence on the live map

Remaining hard boundary after this pass:
- the server now owns most combat consequences plus encounter escalation pressure, but browser-host enemy simulation still drives raw movement/sensing/state changes that feed `combat_state`
- a true final end-state would still require extracting enemy locomotion/search/hunt/patrol logic and reinforcement spawning into shared/server simulation so the host browser stops being the producer of enemy truth altogether

Server-owned enemy movement / sensing authority pass:
- `server/server.js` now runs a real authoritative enemy simulation step every server tick:
- patrol / investigate / search / hunt movement
- quiet/cloak-aware line-of-sight acquisition
- pursuit memory and search-node generation
- cover / flank / strafe behavior for human enemies
- specimen pursuit movement
- boss phase-two transition on the server
- authoritative `combat.elapsed` now advances on the server, so heat-tier progression no longer depends on host-fed elapsed combat time
- host `combat_state` is now narrowed to seeding instead of authority:
- `mergeCombatState()` only adopts incoming enemy truth when a room has not been seeded yet or a fresh level has just been initialized
- once seeded, incoming host combat payloads no longer overwrite server-owned enemy positions/states or enemy bullets
- `WORLD_INIT` now resets room combat to a fresh empty authoritative state so the next host seed cleanly bootstraps a new level instead of carrying stale enemy truth forward
- `app.js` live-session host stand-down is now explicit:
- `update()` no longer runs `updateBullets()`, `updateEnemies()`, or `updateHeat()` on the host while attached to a live server session
- `updateEnemies()` itself now returns immediately during live sessions as a hard guard against old call paths
- live-session host combat publishing is now self-throttling:
- once a server combat snapshot with seeded enemies arrives, `getCombatSnapshot()` returns `null` so the host stops streaming full combat snapshots every `33 ms`
- added local validation helpers to support the final browser loop:
- `tools/web_game_playwright_client.mjs`
- `tools/web-game-actions.json`
- smoke coverage additions:
- live-session host enemy AI no longer advances locally
- live-session host stops publishing combat snapshots after server authority seeds combat

Validation:
- `node --check` passed for:
- `server/server.js`
- `app.js`
- `tests/smoke.spec.js`
- Playwright smoke suite now passes: `12 passed`
- develop-web-game browser loop executed against `http://127.0.0.1:3000/`:
- screenshots written to `output/web-game-authority/`
- latest state dump `state-2.json` shows a valid live raid in `phase: "running"`
- no `errors-*.json` were produced by the browser loop
- latest gameplay screenshot reviewed and confirmed rendering/HUD/objective rails look correct during a live run

Current status after this pass:
- for live multiplayer sessions, the browser host is no longer the producer of enemy movement/sensing/combat truth
- the server is now the producer of enemy movement/state, hostile shots, bullet stepping, projectile/contact damage, heat escalation, containment release, alert spread, loot/extraction progression, and room outcome transitions
- the remaining compatibility bridge is limited to initial combat seeding after a fresh world init plus older offline/local-host play paths
