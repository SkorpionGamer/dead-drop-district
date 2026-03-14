# Dead Drop District: Future Instance Guide

This file is for future Codex instances working in `d:\Project\dead-drop-district`.

It summarizes what this project is, what has already been built, how the workflow works, and which pitfalls already showed up in real use.

## Project Identity

`Dead Drop District` is a top-down HTML/JS extraction shooter with:

- three main stages in the run flow:
  - `freight`
  - `admin`
  - `reactor`
- stealth, heat escalation, gunplay, loot, extraction, and boss flow
- optional multiplayer support over WebSocket
- an in-browser standalone level editor

Art direction:

- industrial extraction shooter first
- post-cyberpunk overall
- rare `royalpunk` accents in elite tech and special gear
- the `Warden` boss is a key example of that rarer royal-tech look
- some weapons can also lean into that royal-tech language

Future instances should not steer the project toward:

- generic neon cyberpunk
- pure horror/zombie identity
- clean military sim styling

The project is plain HTML/CSS/JS with a small Node server.

Main runtime files:

- `app.js`
- `index.html`
- `styles.css`
- `server/server.js`
- `client/network.js`
- `client/config.js`
- `shared/multiplayer.js`

Editor files:

- `level-editor.html`
- `editor.js`
- `editor.css`
- `launch-level-editor.cmd`

## High-Level Game State

The game is no longer just a small prototype. It has a lot of layered systems:

- class system:
  - `stealther`
  - `breacher`
  - `marksman`
- prep shop before run
- mid-run breach shop / refit system
- advanced visual variants for upgraded classes
- stealth readability HUD
- heat system driven by player actions, not just time
- admin level added between freight and reactor
- cyber specimen faction added in admin
- soundtrack selection deck on `M`
- custom OST/SFX assets wired into the game
- crate damage stages and debris
- separate level editor with save-to-`app.js`

## Current Run Flow

Current intended run progression:

1. `freight`
2. breach/refit screen
3. `admin`
4. breach/refit screen
5. `reactor`

Admin is a fenced security/administrative zone between freight and reactor.

## Important Design Direction From The User

The user has been steering the game toward:

- tactical-industrial tone, not generic horror
- stronger stealth readability
- stealth being less punishing than before
- custom soundtrack control, but with smart default auto-music
- stronger environmental art control through the editor
- a more serious content pipeline, even though the data is still mostly in `app.js`

The user also cares a lot about:

- being able to place and resize art manually
- separating collision and visual bounds
- editor usability over purity
- deployed behavior on Railway, not just local behavior

## Level Editor: What Exists

The editor is already substantial.

Features already built:

- standalone editor page
- loads runtime level templates from `app.js`
- can save back into `app.js`
- click-anything smart selection
- asset palette
- add/select/duplicate/delete
- drag move
- resize handles
- separate `Collision` vs `Visual` bounds editing
- snap grid
- box select
- keyboard rotation
- playtest mode (`P`, `WASD`, `E`)
- undo/redo
- layer visibility/lock controls
- validation panel
- enemy preview layer
- squad spawns layer
- runtime-like visual preview for maps
- mapped textures on collidable objects
- fit collision to asset
- auto-fit collision toggle

Main editor rule:

- the editor is practical, not architecturally pure
- there are some type-specific fit profiles and legacy special cases

## Editor Workflow

Launch:

- run `launch-level-editor.cmd`
- or run `node server/server.js`
- then open `http://127.0.0.1:3000/level-editor.html`

Important buttons:

- `Reload From app.js`
  - discard in-browser edits and reload current source data
- `Save To app.js`
  - writes current editor level data back into `app.js`
  - server route: `/api/save-levels`
- `Frame World`
  - resets the camera only

Important editor behaviors:

- selecting an asset influences smart placement
- `Obstacles` and `Buildings` can have separate visual and collision bounds
- `Decor` is visual-only
- some objects use generic opaque-bounds auto-fit
- some older objects use type-specific profiles

## Legacy Obstacle Handling

Not every obstacle is fully generic.

Current state:

- modern mapped objects can use `asset`, `drawOffsetX`, `drawOffsetY`, `drawW`, `drawH`
- old freight containers are legacy preset-driven objects
- crates use a custom crate renderer

Because of that:

- generic image auto-fit exists
- crate fit uses a handcrafted profile
- legacy freight containers use preset-derived fit behavior

This is intentional for now.

Do not assume every obstacle is fully data-driven yet.

## Runtime / Multiplayer Reality

Multiplayer exists, but the project is still effectively host-authoritative and somewhat permissive.

Important runtime files:

- `server/server.js`
- `client/network.js`
- `app.js`

Very important deployment fix already made:

- `client/network.js` no longer auto-connects to the websocket server just because the game is hosted over HTTP/HTTPS
- solo Railway runs should stay local unless `window.__DDD_CONFIG__` explicitly provides:
  - `websocketUrl`
  - or `serverBaseUrl`

This was needed because automatic self-connection on deployed solo runs caused state corruption symptoms like:

- random HP mismatch
- crate state reset
- other authoritative snapshot weirdness

If future instances reintroduce automatic websocket fallback to `window.location.host`, they may revive those bugs.

## Audio / Music Reality

Audio has been a major source of deployment bugs.

Current music/SFX setup:

- OST and SFX files are in:
  - `assets/ost`
  - `assets/sfx`
- music deck opens on `M`
- `Auto` mode should remain the default unless the player manually overrides it

Important fixes already made:

1. Asset path case was corrected to `assets/ost/...`
2. Server now supports better audio delivery:
   - `.mp3` MIME
   - byte-range support
   - cache policy for assets
3. SFX playback was changed from fragile one-off cloning toward pooled preloaded clips
4. Music unlock/startup was hardened so tracks retry after loading
5. URL decoding bug in the server was fixed:
   - OST filenames contain spaces
   - `sanitizeRequestPath()` must decode `%20`
   - without that, Railway music silently fails

If music disappears again, check:

- `server/server.js`
- `sanitizeRequestPath()`
- `.mp3` range support
- asset filenames with spaces
- `ensureMusicTracks()`
- `playMusicTrack()`
- `musicUnlocked`

## Railway / Deployment Workflow

GitHub repo in use:

- `https://github.com/SkorpionGamer/dead-drop-district`

Railway is expected to deploy from `main`.

Important deployment history:

- `v0.6` was pushed
- then several Railway hotfixes were pushed after it

Known pushed commits from this conversation:

- `13e74cd` `Dead Drop District v0.6`
- `e1261b3` `Fix deployed HUD and audio streaming`
- `cb549a3` `Fix solo deploy sync and music startup`
- `84d8466` `Decode asset URLs for music files`

If a future instance is debugging deployed behavior, check whether Railway is actually on the newest `main` commit.

## Git Workflow In This Workspace

This workspace originally had a parent git repo at `d:\Project`, which was not suitable for pushing only this game.

What was done:

- `d:\Project\dead-drop-district` was initialized as its own git repo locally
- pushes were performed through a separate temp clone:
  - `d:\Project\dead-drop-district-push`

Why:

- preserve remote history cleanly
- avoid pushing the whole `d:\Project` workspace

Practical rule for future instances:

- if you need to push, it is safer to use the existing temp clone workflow than to improvise from the parent workspace

But also be aware:

- the temp clone sometimes hits stale `.git/index.lock` issues
- clear the lock if needed before retrying commit

## UI Direction

Game UI:

- light industrial / control-room aesthetic
- not dark-mode-by-default
- not generic purple sci-fi

Editor UI:

- was heavily refined away from “everything is a card”
- sidebars are their own scrollable panel surfaces now
- collapsed sections should remain reachable

If future instances touch the editor UI:

- do not return to the old “same glossy card everywhere” look
- preserve scrollable sidebars and working collapsibles

## Known Systems Added During This Conversation

This is the short feature inventory future instances should assume exists:

- soundtrack deck on `M`
- default area soundtrack remains active until user manually overrides it
- stealth tracks are tied to enemy visibility, not crouch alone
- new OST tracks added
- new SFX mappings added
- shot/reload timings tuned
- stealth made more forgiving and more readable
- heat system rebuilt to react to player behavior
- mid-level upgrade shop added
- advanced class textures wired
- admin level inserted between freight and reactor
- admin visual identity improved
- admin fenced perimeter and checkpoints added
- cyber specimen placed and later made into a real enemy faction
- level editor created and repeatedly improved
- editor can save back to `app.js`
- runtime renders editor-authored mapped textures
- split visual/collision bounds support
- auto-fit collision support

## Important Remaining Weaknesses

Not everything is clean.

Future instances should assume there may still be issues in:

- multiplayer authority/security
- editor generalization across all obstacle types
- deployed browser/audio edge cases
- legacy map data still living inside `app.js`
- world-state sync around transitions

Also note:

- there were earlier code-review findings about windows/line-of-sight and multiplayer trust
- those were real concerns and should not be forgotten

## Best Working Style For Future Instances

When touching this project:

1. check whether the issue is local-only or Railway-only
2. check whether the issue is solo-only or caused by unintended multiplayer sync
3. check whether the object/system is generic or legacy-special-cased
4. prefer small hotfix pushes when deployment is already live
5. avoid reverting user-facing systems just to simplify architecture

Good default debugging order:

- inspect `app.js`
- inspect `server/server.js`
- inspect `client/network.js`
- inspect `styles.css`
- if editor-related, inspect `editor.js`, `editor.css`, `level-editor.html`

## If You Need To Explain The Project Quickly

Use this:

`Dead Drop District is a top-down extraction shooter prototype that has grown into a multi-stage raid game with stealth, heat escalation, custom music/SFX, a mid-run upgrade system, an administrative complex level, a hostile third faction, and a standalone in-browser level editor that writes back into the runtime templates.`
