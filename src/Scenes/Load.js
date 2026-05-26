// ====================================================================
// Load.js — Preloading Scene for GRABity!
//
// This scene runs first: it loads every asset the game needs (images,
// spritesheets, tilemap, audio, bitmap font), creates the player
// animation definitions, writes descriptive text to the HTML page,
// and then transitions to the Platformer scene.
// ====================================================================

class Load extends Phaser.Scene {

    constructor() {
        super("loadScene");
    }

    // ----------------------------------------------------------------
    // preload() — Queue all assets for loading
    // ----------------------------------------------------------------
    preload() {
        // Display a simple loading message so the player knows something
        // is happening while assets download.
        this.add.text(
            this.scale.width / 2,
            this.scale.height / 2,
            "Loading…",
            { fontSize: "32px", color: "#ffffff" }
        ).setOrigin(0.5);

        this._loadTilemapAssets();
        this._loadPlayerAssets();
        this._loadParticleAssets();
        this._loadAudioAssets();
        this._loadFontAssets();
    }

    // ----------------------------------------------------------------
    // create() — Runs after all assets are loaded
    //   • Generate the three player animation definitions
    //   • Write game info to the HTML page
    //   • Start the Platformer scene
    // ----------------------------------------------------------------
    create() {
        this._createPlayerAnimations();

        // Update the HTML elements outside the canvas with the game
        // title and control instructions (see index.html).
        document.getElementById("description").innerHTML =
            "GRABity! — A Gravity-Flipping Platformer";
        document.getElementById("controls").innerHTML =
            "A/D: Move | Space: Jump | Click: Flip Gravity | R: Restart";

        // Everything is ready — hand off to the main game scene.
        this.scene.start("platformerScene");
    }

    // ==================================================================
    // Private helpers — grouped by asset category for readability
    // ==================================================================

    // ------------------------------------------------------------------
    // Tilemap: two tileset images (one loaded twice for different
    // Phaser loader types) plus the Tiled JSON map file.
    // ------------------------------------------------------------------
    _loadTilemapAssets() {
        // Plain image — used by Phaser's tilemap renderer for the
        // transparent tileset (firstgid 1, 20×20 grid of 16×16 tiles).
        this.load.image("tilemap_tiles", "assets/monochrome_tilemap_transparent_packed.png");

        // Spritesheet — same PNG but sliced into individual 16×16
        // frames so we can use specific tile IDs as sprites (gems,
        // spikes, etc.).
        this.load.spritesheet("tilemap_sheet",
            "assets/monochrome_tilemap_transparent_packed.png", {
                frameWidth:  16,
                frameHeight: 16
            }
        );

        // Black-background tileset image (firstgid 401). Used by the
        // Platforms and Background2 tilemap layers.
        this.load.image("tilemap_tiles_black", "assets/monochrome_tilemap_packed.png");

        // Tiled map JSON — describes layers, tile data, and object
        // groups (spikes & gems).
        this.load.tilemapTiledJSON("level-1", "assets/level-test.tmj");
    }

    // ------------------------------------------------------------------
    // Player sprites — four standalone PNGs (not a spritesheet).
    // ------------------------------------------------------------------
    _loadPlayerAssets() {
        this.load.image("walk1", "assets/player_walk01.png");
        this.load.image("walk2", "assets/player_walk02.png");
        this.load.image("idle",  "assets/player_idle.png");
        this.load.image("jump",  "assets/player_jump.png");
    }

    // ------------------------------------------------------------------
    // Particle images — small sprites used by Phaser's particle
    // emitter system for jump dust, walk dust, and gem sparkle.
    // ------------------------------------------------------------------
    _loadParticleAssets() {
        this.load.image("circleParticle", "assets/circle_05.png");
        this.load.image("starParticle",   "assets/star_07.png");
    }

    // ------------------------------------------------------------------
    // Audio — six OGG sound effects mapped to semantic keys.
    // ------------------------------------------------------------------
    _loadAudioAssets() {
        this.load.audio("jump",          "assets/tone1.ogg");
        this.load.audio("flip",          "assets/phaserUp1.ogg");
        this.load.audio("gemGrab",       "assets/powerUp6.ogg");
        this.load.audio("death",         "assets/lowDown.ogg");
        this.load.audio("gameOver",      "assets/spaceTrash3.ogg");
        this.load.audio("levelComplete", "assets/powerUp1.ogg");
    }

    // ------------------------------------------------------------------
    // Bitmap font — Kenney's square pixel font, used for the HUD and
    // end-screen text.
    // ------------------------------------------------------------------
    _loadFontAssets() {
        this.load.bitmapFont("kenneySquare",
            "assets/kenneySquare_0.png",
            "assets/kenneySquare.fnt"
        );
    }

    // ------------------------------------------------------------------
    // Player animation definitions — three animations that the
    // Platformer scene will play based on the player's state.
    // ------------------------------------------------------------------
    _createPlayerAnimations() {
        // Idle: single-frame loop (player standing still).
        this.anims.create({
            key:      "idle",
            frames:   [{ key: "idle" }],
            frameRate: 1,
            repeat:   -1
        });

        // Walk: 2-frame cycle at 15 fps (left-right shuffle).
        this.anims.create({
            key:      "walk",
            frames:   [
                { key: "walk1" },
                { key: "walk2" }
            ],
            frameRate: 15,
            repeat:   -1
        });

        // Jump: single-frame loop (player airborne).
        this.anims.create({
            key:      "jump",
            frames:   [{ key: "jump" }],
            frameRate: 1,
            repeat:   -1
        });
    }
}
