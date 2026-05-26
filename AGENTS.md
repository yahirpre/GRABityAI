# AGENTS.md — GRABity!

## Project Status

**Source code is not yet implemented.** `index.html` references three files that don't exist yet:
- `src/Scenes/Load.js` — asset preloading scene
- `src/Scenes/Platformer.js` — main game scene
- `src/main.js` — Phaser game configuration and entry point

`DESIGN.md` is the authoritative, exhaustive game design document. Every gameplay parameter, physics value, asset key, and behavioral rule is specified there. **Read it fully before writing any game code.**

## Running the Project

No build step. This is a vanilla HTML/JS project using Phaser 3 via a local bundle (`lib/phaser.js`).

- **Simplest**: Open `index.html` in a browser directly (works for basic testing; some Phaser features like XHR tilemap loading may fail without a server)
- **Recommended**: Serve via any local static server (e.g. `npx serve .`, `python -m http.server`, VS Code Live Server)

No package manager, no `node_modules`, no bundler. All dependencies are committed in `lib/`.

## Architecture

Two-scene Phaser 3 game (Arcade Physics, Canvas 2D renderer):

```
[Boot] → Load Scene (preload assets, create animations) → Platformer Scene (entire game loop)
```

Scenes are loaded as global `<script>` tags (not ES modules). They attach to the `Phaser.Scene` prototype or a global object — match whatever pattern `main.js` establishes when it's created.

**Third-party plugins**: `lib/AnimatedTiles.js` is a Phaser plugin for tile animations defined in Tiled map data. It must be registered in the Phaser game config under `plugins.scene`.

## Key Conventions & Gotchas

### 3× Pixel-Art Scaling

Everything is scaled 3× from the base 16×16 tile size. The canvas is 960×720 (20×15 tiles at 48px each). This affects:

- **Map rendering**: Tilemap layers are rendered at `SCALE = 3` via Phaser's `setScale(3)` on each layer
- **Object positions**: Tiled stores object positions in raw pixel coordinates. You **must** multiply both `x` and `y` by 3 when placing objects from Tiled objectgroups
- **Object sprites**: Must call `setScale(3)` and then `body.updateFromGameObject()` to sync the physics body
- **Spike hitboxes**: Intentionally 50% of the scaled sprite size with a (12, 12) offset — don't "fix" this

### Tileset Dual-Loading

The transparent tileset PNG (`monochrome_tilemap_transparent_packed.png`) is loaded **twice** with different Phaser loader types:
1. As a plain **image** (`tilemap_tiles`) — for tilemap rendering
2. As a **spritesheet** (`tilemap_sheet`, `frameWidth: 16, frameHeight: 16`) — for individual sprite frame access (gems, spikes, gem animation)

This is not a mistake — Phaser requires different loader types for these two use cases.

### Tileset Image Path in `.tmj`

The second tileset (`monochrome_tilemap_packed`, firstgid 401) has its `image` field pointing to a local absolute path (`../../../../Downloads/kenney_1-bit-platformer-pack/...`). If the map is moved or the project is shared, this path **must** be updated to `monochrome_tilemap_packed.png` (relative to the assets directory).

### Collision: `blocked` vs `touching`

Platform collision uses `body.blocked` (not `body.touching`) for the grounded check. This is because Phaser's Arcade Physics only sets `blocked` flags for tilemap collisions — `touching` is for body-vs-body overlap/collision. Using `touching` will silently fail.

### Gravity-Direction-Aware Grounded Check

"Grounded" depends on current gravity direction:
- Normal gravity → `body.blocked.down` means grounded
- Flipped gravity → `body.blocked.up` means grounded

Getting this wrong breaks jump input, double-jump reset, and gravity-flip ability reset.

### Lives Off-by-One

Game over triggers when `lives < 0` (not `lives === 0`). Starting at 3, the player gets 4 deaths before game over. This is intentional per the design doc.

### Death Sound Gating

Death sound plays at 1.5× pitch only when `lives > 0` **before** decrementing. On the final death (lives goes to −1), the death sound is skipped and the game-over sound plays instead. The condition is `if(lives > 0)` — don't change it to `if(lives >= 0)`.

### No Invincibility After Death

There is no invincibility frame after respawning. The player teleports to spawn with zero velocity immediately. If spawn overlaps a hazard, rapid repeated deaths occur — this is by design.

## Asset Reference

| Directory | Contents |
|-----------|----------|
| `assets/` | Tilemap (`level-test.tmj`), tileset PNGs, player sprite PNGs, particle PNGs (`circle_05.png`, `star_07.png`), OGG audio files, bitmap font (`kenneySquare.fnt` + `kenneySquare_0.png`), Tiled project files |
| `lib/` | `phaser.js` (Phaser 3 engine), `AnimatedTiles.js` (tile animation plugin) |

### Asset Keys (as defined in DESIGN.md)

- **Images**: `tilemap_tiles`, `tilemap_tiles_black`, `tilemap_sheet`
- **Player sprites**: `walk1`, `walk2`, `idle`, `jump`
- **Particles**: `circleParticle`, `starParticle`
- **Audio**: `jump`, `flip`, `gemGrab`, `death`, `gameOver`, `levelComplete`
- **Font**: `kenneySquare`
- **Map**: `level-1`
- **Animations**: `walk` (2-frame loop 15fps), `idle` (single frame), `jump` (single frame)
- **Gem animation**: 2-frame cycle (frame 82 ↔ 62) at 3fps

## Tiled Map Details

- Format: `.tmj` (Tiled JSON), map size 60×15 tiles, 16×16 tile size
- Two tilesets: transparent (firstgid 1) and black-bg (firstgid 401)
- Tile collision uses per-tile custom property `collides: true` — enforced via `setCollisionByProperty({ collides: true })`
- Layer order (bottom→top): Background1 (disabled), Background2, Platforms, Decor, Spikes objectgroup, Gems objectgroup
- **Only the Spikes objectgroup is used**, not the Spikes tilelayer — they are separate things with the same name
- Tile 67 has a Tiled animation definition (alternates with tile 47, 1000ms per frame) — requires AnimatedTiles plugin

## HTML Structure

`index.html` provides:
- `<div id="phaser-game">` — Phaser canvas target
- `<span id="description">` — for game title text (written by Load scene)
- `<span id="controls">` — for control instructions (written by Load scene)

Scripts are loaded in order: phaser.js → Load.js → Platformer.js → main.js. This means scenes must be defined before `main.js` runs the Phaser config.
