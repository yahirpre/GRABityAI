// ====================================================================
// main.js — Phaser Game Configuration & Entry Point for GRABity!
//
// This file creates the Phaser.Game instance with all the settings
// the game needs: canvas size, renderer, physics engine, scene list,
// and the AnimatedTiles plugin for tile animations defined in Tiled.
// ====================================================================

const config = {
    // ── Display ─────────────────────────────────────────────────────
    type:    Phaser.CANVAS,        // Canvas 2D renderer (no WebGL needed)
    width:   960,                 // 20 tiles × 16 px × 3× scale
    height:  720,                 // 15 tiles × 16 px × 3× scale
    pixelArt: true,               // Nearest-neighbor scaling (no blur)

    // ── Physics ─────────────────────────────────────────────────────
    physics: {
        default: "arcade",
        arcade: {
            debug: false         // Set true to see hitboxes & velocity vectors
        }
    },

    // ── Scenes — order matters: Load → Platformer ──────────────────
    scene: [Load, Platformer],

    // ── Plugins ─────────────────────────────────────────────────────
    // AnimatedTiles: a scene plugin that automatically plays tile
    // animations stored in Tiled map data (e.g. tile 67 ↔ 47).
    plugins: {
        scene: [
            {
                key: "AnimatedTiles",
                plugin: AnimatedTiles,   // Global from lib/AnimatedTiles.js
                mapping: "animatedTiles"  // Access via scene.animatedTiles
            }
        ]
    },

    // ── DOM — render into the #phaser-game div ─────────────────────
    parent: "phaser-game"
};

// Create the Phaser game instance — this starts the Load scene.
const game = new Phaser.Game(config);
