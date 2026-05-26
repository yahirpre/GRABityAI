# DESIGN.md — GRABity! Game Design Document

## Overview

**GRABity!** is a single-player 2D side-scrolling platformer. The player controls a small character who can run, jump, double-jump, and — the signature mechanic — **flip gravity** by clicking the mouse. Gravity reversal lets the player walk on ceilings, reach otherwise inaccessible areas, and navigate around hazards. The goal of each level is to collect every gem while avoiding spikes. Running out of lives triggers a game over.

---

## Display Configuration

| Property | Value |
|----------|-------|
| Canvas width | 960 px (20 tiles × 16 px × 3× scale) |
| Canvas height | 720 px (15 tiles × 16 px × 3× scale) |
| Pixel-art scaling | 3× (nearest-neighbor, no blurring) |
| Renderer | Canvas 2D |
| Camera | Horizontally follows the player with lerp (0.1 horizontal, 0 vertical — effectively instant vertical tracking). Camera bounds match the full scaled map dimensions. |

---

## Controls

| Input | Action |
|-------|--------|
| **A** key | Move left |
| **D** key | Move right |
| **Space** key | Jump (when grounded) or double-jump (when airborne, once per airborne period) |
| **Left mouse click** | Flip gravity (once per airborne period; resets on landing) |
| **R** key | Restart the level |

---

## Player Avatar

The player is a single sprite with four animation states. All movement uses acceleration-based physics (not direct velocity), giving the character weight and momentum.

### Movement Tuning

| Parameter | Value | Notes |
|-----------|-------|-------|
| Horizontal acceleration | 700 px/s² | Applied while A or D is held |
| Horizontal drag | 2000 px/s | Applied when no movement key is held (deceleration) |
| Maximum horizontal speed | 200 px/s | Hard cap on X velocity |
| Gravity (normal) | 2000 px/s² downward | Positive Y = downward on screen |
| Gravity (flipped) | 2000 px/s² upward | Same magnitude, opposite direction |
| Jump velocity | 700 px/s (against gravity) | Set as instant Y velocity on jump; direction is always opposite to current gravity |
| Double-jump velocity | Same as jump (700 px/s against gravity) | Identical force to the first jump |
| Terminal velocity | 400 px/s | Maximum falling speed in the gravity direction; the player's Y velocity is clamped to this value each frame |
| World bounds | X: 0 to (map width × 3×), Y: −50 to (map height × 3× + 100) | Extra padding above and below the map for out-of-bounds detection |

### Animation States

| State | Key | Frames | Frame Rate | Loop |
|-------|-----|--------|------------|------|
| Idle | `idle` | Single frame (`player_idle.png`) | — | Yes |
| Walk | `walk` | 2-frame cycle (`player_walk01.png`, `player_walk02.png`) | 15 fps | Yes |
| Jump | `jump` | Single frame (`player_jump.png`) | — | Yes |

Animation transitions are driven directly by player state each frame:
- A or D held → `walk`
- No movement key + grounded → `idle`
- Airborne (not blocked by a surface) → `jump`

The player sprite flips horizontally (facing left) when moving left and flips vertically when gravity is flipped.

### Spawn Position

The player spawns at pixel position **(80, 400)** in world coordinates (post-scale). On death, the player resets to this same position.

### World-Bounds Collision

The player collides with world bounds (`setCollideWorldBounds(true)`), preventing them from leaving the left, right, or bottom edges of the level. The top bound has slight padding (−50 px) to allow the player to briefly exceed the visible map when gravity is flipped.

### Out-of-Bounds Death

If the player's Y position exceeds **map.heightInPixels × 3 + player.displayHeight/2** (below the map) or falls below **−player.displayHeight/2** (above the map), the player dies. This catches falls through the bottom and upward exits through the top when gravity is flipped.

---

## Gravity Flip Mechanic

Gravity flipping is the central mechanic and has specific rules to prevent exploits:

1. **Trigger**: Left mouse click (anywhere on screen)
2. **One flip per airborne period**: After flipping, the player cannot flip again until they land on a surface (their "feet" side is blocked by a tile). This prevents infinite mid-air flipping.
3. **On landing, flip ability resets**: Both `flipAbility` and `canDoubleJump` reset to `true` when the player touches a surface on their "feet" side.
4. **Direction-aware "grounded" check**: When gravity is normal, "grounded" means the player's bottom is blocked (`body.blocked.down`). When gravity is flipped, "grounded" means the player's top is blocked (`body.blocked.up`). This uses `body.blocked` (not `body.touching`) because tilemap collisions only set the `blocked` flags.
5. **Visual flip**: The player sprite toggles vertical flip (`flipY`) when gravity flips.
6. **All physics flip**: Gravity direction, jump velocity sign, and the grounded-check direction all reverse simultaneously.

### Gravity Reset

On player death, if gravity is currently flipped, it is automatically flipped back to normal before respawning. This ensures the player always starts a life under normal gravity.

---

## Jump & Double-Jump

1. **First jump**: Available only when the player is grounded (blocked on their "feet" side). Pressing Space sets the player's Y velocity to jump velocity (opposing current gravity direction). This is checked with `JustDown` (single-press, not held).
2. **Double-jump**: Available once per airborne period after leaving the ground. Pressing Space again while airborne sets the same jump velocity. After use, `canDoubleJump` becomes `false` and is not available again until the next landing.
3. **Jump and flip are independent**: A player can jump, flip gravity mid-air, and still use their double-jump (if not already used). The double-jump always applies force opposite to the *current* gravity direction.

---

## Level Structure

Levels are defined as Tiled Map Editor JSON files (`.tmj` format). The current level is `assets/level-test.tmj`.

### Map Properties

| Property | Value |
|----------|-------|
| Map size | 60 tiles wide × 15 tiles tall |
| Tile size | 16 × 16 pixels |
| Scaled pixel size | 2880 × 720 pixels (at 3× scale) |

### Tilesets

Two tilesets from the Kenney 1-Bit Platformer Pack are used. Both are 320×320 pixel atlas images containing 400 tiles each (20 columns × 20 rows, 16×16 px per tile).

| Tileset Name | Image File | firstgid | Usage |
|--------------|-----------|----------|-------|
| `monochrome_tilemap_transparent_packed` | `monochrome_tilemap_transparent_packed.png` | 1 | Transparent-background tiles: used for the Decor layer, gem/spike object sprites, and the Background1 layer |
| `monochrome_tilemap_packed` | `monochrome_tilemap_packed.png` | 401 | Black-background tiles: used for the Platforms layer and the Background2 layer |

**Important**: The second tileset's image path in the `.tmj` file points to a local absolute path (`../../../../Downloads/kenney_1-bit-platformer-pack/Tilemap/monochrome_tilemap_packed.png`). When reusing this map, update the `image` field in the tileset definition to point to `monochrome_tilemap_packed.png` in the assets directory.

### Collision Properties

Individual tiles in both tilesets may carry a custom boolean property `collides`. Only tiles with `collides: true` are treated as solid platforms. The collision system checks this property on each tile, not on the layer as a whole.

The following tile IDs have `collides: true` set in the transparent tileset: 115–118, 122, 135–138, 155–158, 166, 175–178, 183. The packed (black) tileset has `collides: true` on: 115–118, 135–138, 155–158, 175–178.

### Animated Tiles

Tile ID 67 in the transparent tileset has an animation definition: it alternates between tile 67 and tile 47, with each frame lasting 1000 ms. An AnimatedTiles plugin is used to play tile animations defined in the Tiled map data.

### Map Layers

Layers are rendered in the following order (bottom to top). All tile layers are scaled at 3×.

| Layer Name | Type | Tileset | Visible In-Game | Purpose & Rendering |
|------------|------|---------|-----------------|---------------------|
| Background1 | tilelayer | transparent | **No** (disabled in code) | Would be a deep parallax background at 0.25 scroll factor, alpha 0.25 |
| Background2 | tilelayer | black | Yes | Mid-distance parallax background. Scroll factor 0.5 (moves at half camera speed). Alpha 0.33. Rendered with the black-background tileset. |
| Platforms | tilelayer | black | Yes | Primary collision surface. Only tiles with `collides: true` are solid. Full scroll factor (1.0). Fully opaque. |
| Decor | tilelayer | transparent | Yes | Non-colliding decoration tiles. Full scroll factor (1.0). Fully opaque. |
| Spikes | tilelayer | — | **No** | Not used by the game code. The spike objects come from the objectgroup below. |
| Spikes | objectgroup | transparent | Yes (objects) | Spike hazard objects. Each object is named `"Spike"` (one is named `"Spikey"` — both are treated identically). All use tile frame 166 from the spritesheet. 57 objects total. |
| Gems | objectgroup | transparent | Yes | Collectible gem objects. Each object is named `"Gem"`. All use tile frame 82 from the spritesheet (some are horizontally flipped in Tiled). 10 objects total. |

**Note**: The tilelayer and objectgroup named "Spikes" are separate things. Only the objectgroup is used for gameplay.

---

## Collectibles: Gems

Gems are the sole collectible and the win condition.

| Property | Value |
|----------|-------|
| Source | Tiled objectgroup `"Gems"`, objects named `"Gem"` |
| Sprite | Tile frame 82 from `monochrome_tilemap_transparent_packed.png` spritesheet |
| Animation | 2-frame cycle between frame 82 and frame 62 at 3 fps, looping |
| Physics | Static body (immovable). Uses **overlap** detection (player passes through). |
| On collection | Gem is destroyed, gem counter increments, collection sound plays, star-particle VFX fires, HUD text updates |
| Win condition | When `grabbedGems == totalGems`, the level is complete |

### Object Scaling

All objects placed from Tiled must be scaled to match the 3× tilemap scale:
1. Scale the sprite: `setScale(3.0)`
2. Scale the position: `x *= 3.0`, `y *= 3.0`
3. Update the physics body: `body.updateFromGameObject()`

This is required because Tiled stores object positions in raw tile-pixel coordinates, but the map layers are rendered at 3× scale.

---

## Hazards: Spikes

Spikes are the only hazard type.

| Property | Value |
|----------|-------|
| Source | Tiled objectgroup `"Spikes"`, objects named `"Spike"` |
| Sprite | Tile frame 166 from `monochrome_tilemap_transparent_packed.png` spritesheet |
| Physics | Static body (immovable). Uses **overlap** detection (player passes through — no physical blocking). |
| On contact | Player dies (see Death & Lives below). |

### Spike Hitbox

The spike physics body is intentionally smaller than the visual sprite to make the game more forgiving:

| Property | Value |
|----------|-------|
| Body width | `sprite.width × 3 × 0.5` (50% of full scaled width) |
| Body height | `sprite.height × 3 × 0.5` (50% of full scaled height) |
| Body offset | `(4 × 3, 4 × 3)` = (12, 12) pixels from the top-left corner |

This means the deadly zone is a small rectangle centered within the spike sprite, rather than covering the entire sprite area.

---

## Death & Lives

| Property | Value |
|----------|-------|
| Starting lives | 3 |
| On death | Lives decrement by 1, player teleports to spawn (80, 400), velocity zeroes, gravity resets to normal if flipped |
| Death sound | Plays at 1.5× pitch for all deaths except the final one |
| Game over | Triggered when lives reach **−1** (checked as `lives < 0`). This means the player effectively gets 4 deaths before game over (at lives 3, 2, 1, 0). |

### Death Triggers

The player dies from:
1. **Spike overlap** — touching any spike object
2. **Out of bounds** — falling below the bottom of the map or rising above the top (with a margin of half the player's display height)

### Invincibility

There is **no invincibility period** after death. The player respawns immediately at the spawn point with zero velocity. If the spawn point itself is on or near a hazard, repeated rapid deaths are possible.

---

## End Screens

There are three end-screen scenarios. All end screens perform the same sequence: freeze the game (set gravity to 0, zero player velocity and acceleration), draw a black rectangle covering the entire map, display centered text using the bitmap font, wait a specified duration, then restart the scene.

| Trigger | Display Text | Delay Before Restart |
|---------|-------------|---------------------|
| Lives depleted (`lives < 0`) | "Game Over!" | 3 seconds |
| All gems collected | "Level Completed!" | 3 seconds (after a 2-second delay before the end screen even begins) |
| Manual restart (R key) | "Restarting!" | 1 second |

**Level completion timing**: When the last gem is collected, there is a 2-second delay, then the level-complete sound plays and the end screen appears. After another 3 seconds, the scene restarts. Total time from last gem to restart: 5 seconds.

---

## HUD (Heads-Up Display)

The HUD is rendered using the `kenneySquare` bitmap font and remains fixed on screen (scroll factor 0).

| Element | Position | Format | Updates On |
|---------|----------|--------|------------|
| Gem count | (10, 10) | `"Gems: X / Y"` where X = grabbed, Y = total | Each gem collection |
| Lives | (10, 40) | `"Lives: N"` | Each death |

---

## Visual Effects (Particles)

Three particle emitter systems are used. All emitters follow the player's position. All use additive (`ADD`) blending for a glowing effect.

### Jump VFX

Fires when the player jumps or double-jumps. A short burst of small circle particles.

| Property | Value |
|----------|-------|
| Particle image | `circle_05.png` |
| Emission angle | 0° to 180° (downward semicircle) |
| Scale | 0.1 → 0.01 (shrinking) |
| Speed | 50 px/s |
| Lifespan | 500 ms |
| Alpha | 1.0 → 0.5 (fading) |
| Max alive particles | 10 |
| Duration | 100 ms burst |
| Frequency | 1 (emits every 1 ms during burst) |

### Walk VFX

Continuous emission while the player is moving left or right. Small dust-like circle particles.

| Property | Value |
|----------|-------|
| Particle image | `circle_05.png` |
| Scale | 0.05 → 0.01 (shrinking) |
| Frequency | 100 ms between emissions |
| Lifespan | 1000 ms |
| Alpha | 1.0 → 0.5 (fading) |
| Start/stop | Starts when movement key is held; stops when no movement key is held |

### Gem Collection VFX

Fires when a gem is collected. A burst of star particles radiating outward.

| Property | Value |
|----------|-------|
| Particle image | `star_07.png` |
| Emission angle | 0° to 360° (full radial burst) |
| Scale | 0.075 (constant, no change over life) |
| Speed | 100 px/s |
| Lifespan | 500 ms |
| Alpha | 0.5 → 0.0 (fading out) |
| Max alive particles | 20 |
| Duration | 100 ms burst |

---

## Audio

All audio files are OGG format. Master volume is set to 0.25 (25%).

| Event | Asset File | Sound Key | Special Properties |
|-------|-----------|-----------|-------------------|
| Jump / Double-jump | `tone1.ogg` | `jump` | — |
| Gravity flip | `phaserUp1.ogg` | `flip` | — |
| Gem collection | `powerUp6.ogg` | `gemGrab` | — |
| Death (non-final) | `lowDown.ogg` | `death` | Playback rate 1.5× (higher pitch) |
| Game over (lives depleted) | `spaceTrash3.ogg` | `gameOver` | — |
| Level complete | `powerUp1.ogg` | `levelComplete` | Plays after 2-second delay post-collection |

Death sound does **not** play on the final death (when lives reach 0 → −1), because the check is `if(lives > 0)` before decrementing. The game-over sound plays instead.

---

## Art Assets

### Sprite Images (Player)

All player sprites are standalone PNG images (not a spritesheet). Each image is a single frame.

| Key | File | Purpose |
|-----|------|---------|
| `walk1` | `player_walk01.png` | Walk animation frame 1 |
| `walk2` | `player_walk02.png` | Walk animation frame 2 |
| `idle` | `player_idle.png` | Idle / standing frame |
| `jump` | `player_jump.png` | Airborne frame |

### Tilemap Images

| Key | File | Purpose |
|-----|------|---------|
| `tilemap_tiles` | `monochrome_tilemap_transparent_packed.png` | Full tileset image (transparent background) — loaded as a plain image for tilemap rendering |
| `tilemap_tiles_black` | `monochrome_tilemap_packed.png` | Full tileset image (black background) — loaded as a plain image for tilemap rendering |
| `tilemap_sheet` | `monochrome_tilemap_transparent_packed.png` | Same image as `tilemap_tiles`, but loaded as a **spritesheet** with `frameWidth: 16, frameHeight: 16` — used for object sprites (gems frame 82, spikes frame 166) and gem animation (frames 82, 62) |

**Note**: The transparent tileset PNG is loaded twice — once as a plain image and once as a spritesheet — because Phaser requires different loader types for tilemap tilesets vs. individual sprite frame access.

### Particle Images

| Key | File | Purpose |
|-----|------|---------|
| `circleParticle` | `circle_05.png` | Jump dust and walk dust |
| `starParticle` | `star_07.png` | Gem collection sparkle |

### Font

| Key | Files | Purpose |
|-----|-------|---------|
| `kenneySquare` | `kenneySquare_0.png` + `kenneySquare.fnt` | Bitmap font for HUD and end-screen text |

### Level File

| Key | File | Format |
|-----|------|--------|
| `level-1` | `level-test.tmj` | Tiled JSON (`.tmj`) |

---

## Scene Flow

```
[Game Start] → Load Scene → Platformer Scene
```

**Load Scene**: Preloads all assets (images, spritesheets, tilemaps, audio, font). Creates the three player animation definitions (walk, idle, jump). Writes the game title and controls instructions to HTML elements outside the canvas. Then immediately transitions to the Platformer scene.

**Platformer Scene**: The entire game. Initializes physics, builds the tilemap and all game objects, sets up input, creates particle emitters, wires collisions, and runs the game loop. On game over or level completion, displays an end screen and restarts itself after a delay.

---

## Tile Collision Detail

Platform collision uses per-tile custom properties. In Tiled, individual tiles in the tileset can have a boolean property named `collides`. The game enables collision only for tiles where `collides === true`:

```
platformLayer.setCollisionByProperty({ collides: true })
```

This means:
- Not every tile in the Platforms layer is solid — only those explicitly marked.
- Decor and background layers have no collision at all.
- Spikes use overlap (not collision), so they do not physically block the player.

### Gravity Flip & Platform Collision

Platform collision works identically in both gravity directions. When gravity is flipped, the player falls upward and collides with the **bottom** of platform tiles. Phaser's Arcade Physics handles this automatically — the same collider works regardless of gravity direction. The player can walk on ceilings and the undersides of platforms when gravity is inverted.

---

## State Reset on Scene Restart

When the scene restarts (after game over, level completion, or manual restart), Phaser calls `init()` again, which resets all game state to initial values:

| State | Initial Value |
|-------|--------------|
| `gravityFlipped` | `false` |
| `flipAbility` | `true` |
| `canDoubleJump` | `true` |
| `lives` | `3` |
| `gameRunning` | `true` |
| `levelCompleted` | `false` |
| `grabbedGems` | `0` |
| World gravity Y | `2000` (downward) |
| Jump velocity | `−700` (upward) |
