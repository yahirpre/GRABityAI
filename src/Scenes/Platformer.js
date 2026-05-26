// ====================================================================
// Platformer.js — Main Game Scene for GRABity!
//
// This scene contains the entire game loop: tilemap setup, player
// physics, gravity-flipping, gem collection, spike hazards, HUD,
// particle VFX, and end-screen logic.  The code is split into small,
// focused helper methods so create() and update() stay readable.
// ====================================================================

class Platformer extends Phaser.Scene {

    constructor() {
        super("platformerScene");

        // ── Constants (all values from DESIGN.md) ──────────────────
        this.SCALE          = 3;      // 3× pixel-art upscale
        this.TILE_SIZE      = 16;     // Base tile size in pixels
        this.CANVAS_W       = 960;    // 20 tiles × 16 × 3
        this.CANVAS_H       = 720;    // 15 tiles × 16 × 3
        this.ACCEL          = 700;    // Horizontal acceleration (px/s²)
        this.DRAG           = 2000;   // Horizontal drag when idle (px/s)
        this.MAX_SPEED      = 200;    // Maximum horizontal speed (px/s)
        this.GRAVITY        = 2000;   // Gravity magnitude (px/s²)
        this.JUMP_VEL       = -1400;  // Jump velocity (against gravity)
        this.TERM_VEL       = 400;    // Terminal falling speed (px/s)
        this.SPAWN_X        = 80;     // Player spawn X (world px)
        this.SPAWN_Y        = 400;    // Player spawn Y (world px)
        this.START_LIVES    = 3;
        this.MASTER_VOL     = 0.25;   // Audio master volume
        this.SPIKE_BODY_PCT = 0.5;    // Spike hitbox is 50% of sprite
        this.SPIKE_OFFSET   = 12;     // (4×3) offset for spike body
    }

    // ----------------------------------------------------------------
    // init() — Reset ALL game state when the scene starts or restarts
    // ----------------------------------------------------------------
    init() {
        this.gravityFlipped = false;
        this.flipAbility    = true;    // Can flip gravity (1 per airborne)
        this.canDoubleJump  = true;    // Can double-jump (1 per airborne)
        this.lives          = this.START_LIVES;
        this.gameRunning    = true;    // False once an end-screen appears
        this.levelCompleted = false;
        this.grabbedGems    = 0;
        this.currentGravity = this.GRAVITY;   // Positive = down
        this.currentJumpVel  = this.JUMP_VEL; // Negative = up
    }

    // ----------------------------------------------------------------
    // create() — Build the entire game world once per scene run
    // ----------------------------------------------------------------
    create() {
        this._buildTilemap();       // Must come first — creates this.map
        this._setupPhysics();       // Uses this.map for world bounds
        this._createPlayer();
        this._setupCamera();
        this._setupInput();
        this._createSpikes();
        this._createGems();
        this._createParticleEmitters();
        this._setupHUD();
        this._setupCollisions();
    }

    // ----------------------------------------------------------------
    // update() — Game loop, called every frame
    // ----------------------------------------------------------------
    update() {
        if (!this.gameRunning) return;

        this._handleMovement();
        this._handleJump();
        this._handleRestart();
        this._updateAnimation();
        this._updateWalkVFX();
        this._checkOutOfBounds();
    }

    // ==================================================================
    // PHYSICS & WORLD SETUP
    // ==================================================================

    _setupPhysics() {
        // Arcade Physics gravity and world bounds.
        // this.map must already exist (call _buildTilemap first).
        this.physics.world.gravity.y = this.currentGravity;
        this.physics.world.setBounds(
            0, -50,
            this.map.widthInPixels * this.SCALE,
            this.map.heightInPixels * this.SCALE + 150
        );
    }

    // ==================================================================
    // TILEMAP — layers, scaling, parallax, collision
    // ==================================================================

    _buildTilemap() {
        // Load the tilemap from the Tiled JSON we preloaded.
        this.map = this.add.tilemap("level-1", this.TILE_SIZE, this.TILE_SIZE);

        // Register both tileset images with the map so Phaser can
        // look up tiles by ID across both sets.
        this.tilesetTransparent = this.map.addTilesetImage(
            "monochrome_tilemap_transparent_packed", "tilemap_tiles"
        );
        this.tilesetBlack = this.map.addTilesetImage(
            "monochrome_tilemap_packed", "tilemap_tiles_black"
        );

        this._createMapLayers();
    }

    _createMapLayers() {
        // ── Background1 — disabled (parallax too distant) ──────
        // const bg1 = this.map.createLayer("Background1", this.tilesetTransparent, 0, 0);
        // bg1.setScale(this.SCALE).setScrollFactor(0.25).setAlpha(0.25);

        // ── Background2 — mid-distance parallax with black tiles ──
        const bg2 = this.map.createLayer("Background2", this.tilesetBlack, 0, 0);
        bg2.setScale(this.SCALE);
        bg2.setScrollFactor(0.5);
        bg2.setAlpha(0.33);

        // ── Platforms — primary collision surface ───────────────
        this.platformLayer = this.map.createLayer("Platforms", this.tilesetBlack, 0, 0);
        this.platformLayer.setScale(this.SCALE);
        // Enable collision only on tiles marked `collides: true`
        this.platformLayer.setCollisionByProperty({ collides: true });

        // ── Decor — non-colliding decoration ────────────────────
        const decorLayer = this.map.createLayer("Decor", this.tilesetTransparent, 0, 0);
        decorLayer.setScale(this.SCALE);

        // ── Spikes tilelayer — NOT used (we use the objectgroup) ──
        // The tilelayer named "Spikes" exists in the map data but
        // only the objectgroup with the same name is used for gameplay.
    }

    // ==================================================================
    // PLAYER — sprite, physics body, world bounds
    // ==================================================================

    _createPlayer() {
        // Place the player at the spawn position using the 'idle' frame.
        this.player = this.physics.add.sprite(
            this.SPAWN_X, this.SPAWN_Y, "idle"
        );

        // Pixel-art rendering — prevent sub-pixel blurring.
        this.player.setOrigin(0.5, 1);
        this.player.setScale(this.SCALE);
        this.player.body.updateFromGameObject();

        // Prevent the player from leaving the world bounds.
        this.player.setCollideWorldBounds(true);

        // Horizontal drag gives momentum-based deceleration.
        this.player.setDragX(this.DRAG);
        this.player.setMaxVelocity(this.MAX_SPEED, this.TERM_VEL);

        // Track whether the player was grounded last frame so we
        // can detect the moment they land (to reset abilities).
        this.wasGrounded = false;
    }

    // ==================================================================
    // CAMERA — follow the player with lerp
    // ==================================================================

    _setupCamera() {
        this.cameras.main.setBounds(
            0, 0,
            this.map.widthInPixels * this.SCALE,
            this.map.heightInPixels * this.SCALE
        );
        this.cameras.main.startFollow(
            this.player,
            false,     // Round pixels (false = smooth scroll)
            0.1,       // Horizontal lerp (slight delay)
            0.0        // Vertical lerp (instant tracking)
        );
    }

    // ==================================================================
    // INPUT — keyboard keys and mouse click
    // ==================================================================

    _setupInput() {
        // Movement keys
        this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

        // Jump key — Space bar
        this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Restart key
        this.keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

        // Gravity flip — left mouse click
        this.input.on("pointerdown", () => {
            if (!this.gameRunning) return;
            this._tryFlipGravity();
        });
    }

    // ==================================================================
    // SPIKES — hazard objects from the Tiled objectgroup
    // ==================================================================

    _createSpikes() {
        this.spikes = this.physics.add.staticGroup();

        // Access the Spikes *objectgroup* (not the tilelayer).
        const spikeLayer = this.map.getObjectLayer("Spikes");

        if (!spikeLayer) return;

        spikeLayer.objects.forEach((obj) => {
            // Extract the actual tile index from the GID.
            // Tiled packs horizontal-flip flags into the upper bits.
            const FLIP_H = 0x80000000;
            const FLIP_V = 0x40000000;
            const FLIP_D = 0x20000000;
            const gid = obj.gid;
            const tileIndex = (gid & 0x1FFFFFFF) - 1; // 0-indexed for spritesheet
            const flipH = !!(gid & FLIP_H);

            // Create a sprite from the tilemap spritesheet at the
            // correct frame (166 → index 165, since gid is 1-based).
            const spike = this.spikes.create(
                obj.x * this.SCALE,   // Scale position 3×
                obj.y * this.SCALE,   // Scale position 3×
                "tilemap_sheet",
                tileIndex
            );

            // Set origin to bottom-center so the sprite aligns
            // with Tiled's y coordinate (bottom of tile objects).
            // Determine spike direction: check for a platform tile
            // above or below the spike in the tilemap data.
            // Tiled y = bottom edge, so the spike occupies the row:
            //   spikeRow = (y - height) / tileSize
            const col = Math.floor((obj.x + obj.width / 2) / this.TILE_SIZE);
            const spikeRow = Math.floor((obj.y - obj.height) / this.TILE_SIZE);
            const tileBelow = this.platformLayer.getTileAt(col, spikeRow + 1);
            const tileAbove = this.platformLayer.getTileAt(col, spikeRow - 1);

            // Floor spike (platform below) → point up (flip Y to face up).
            // Ceiling spike (platform above) → point down (default sprite).
            const flipV = (tileBelow && tileBelow.properties.collides)
                       && !(tileAbove && tileAbove.properties.collides);

            spike.setOrigin(0.5, 1);
            spike.setScale(this.SCALE);
            spike.setFlipX(flipH);
            spike.setFlipY(flipV);
            spike.body.updateFromGameObject();

            // Shrink the hitbox to 50% of the scaled sprite and offset
            // it so the deadly zone is centred (forgiving design).
            spike.body.setSize(
                spike.width  * this.SPIKE_BODY_PCT,
                spike.height * this.SPIKE_BODY_PCT
            );
            spike.body.setOffset(this.SPIKE_OFFSET, this.SPIKE_OFFSET);

            spike.setImmovable(true);
        });
    }

    // ==================================================================
    // GEMS — collectible objects from the Tiled objectgroup
    // ==================================================================

    _createGems() {
        this.gems = this.physics.add.staticGroup();

        const gemLayer = this.map.getObjectLayer("Gems");
        if (!gemLayer) return;

        this.totalGems = gemLayer.objects.length;

        const FLIP_H = 0x80000000;
        const FLIP_V = 0x40000000;

        gemLayer.objects.forEach((obj) => {
            const gid = obj.gid;
            const tileIndex = (gid & 0x1FFFFFFF) - 1;
            const flipH = !!(gid & FLIP_H);

            const gem = this.gems.create(
                obj.x * this.SCALE,
                obj.y * this.SCALE,
                "tilemap_sheet",
                tileIndex
            );

            // Set origin to bottom-center (Tiled y = bottom of tile).
            gem.setOrigin(0.5, 1);
            gem.setScale(this.SCALE);
            gem.setFlipX(flipH);
            gem.body.updateFromGameObject();

            gem.setImmovable(true);
        });

        // Create the gem animation (2-frame sparkle cycle at 3 fps).
        // Tiled tile IDs 82 & 62 map directly to spritesheet frames.
        this._createGemAnimation();
        this.gems.playAnimation("gemSpin");
    }

    _createGemAnimation() {
        // Guard: only create once per game session (animations are
        // global in Phaser and persist across scene restarts).
        if (this.anims.exists("gemSpin")) return;

        this.anims.create({
            key:      "gemSpin",
            frames:   [
                { key: "tilemap_sheet", frame: 82 },
                { key: "tilemap_sheet", frame: 62 }
            ],
            frameRate: 3,
            repeat:   -1
        });
    }

    // ==================================================================
    // COLLISIONS & OVERLAPS
    // ==================================================================

    _setupCollisions() {
        // Player vs. Platforms — physical blocking.
        this.physics.add.collider(this.player, this.platformLayer);

        // Player vs. Spikes — overlap (no push-back, just death).
        this.physics.add.overlap(
            this.player, this.spikes,
            this._onSpikeHit, null, this
        );

        // Player vs. Gems — overlap (walk through, collect).
        this.physics.add.overlap(
            this.player, this.gems,
            this._onGemCollect, null, this
        );
    }

    // ==================================================================
    // PARTICLE EMITTERS — jump dust, walk dust, gem sparkle
    // ==================================================================

    _createParticleEmitters() {
        this._createJumpVFX();
        this._createWalkVFX();
        this._createGemVFX();
    }

    // ── Jump VFX: short downward burst of circle particles ─────
    _createJumpVFX() {
        this.jumpEmitter = this.add.particles(0, 0, "circleParticle", {
            angle:      { min: 0, max: 180 },       // Downward semicircle
            speed:      50,
            lifespan:   500,
            scale:      { start: 0.1, end: 0.01 },
            alpha:      { start: 1.0, end: 0.5 },
            quantity:   10,
            duration:   100,                        // 100 ms burst
            frequency:  1,                          // Emit every 1 ms during burst
            emitting:   false,                      // Starts OFF — fire on jump
            blendMode:  "ADD"
        });
        this.jumpEmitter.startFollow(this.player);
    }

    // ── Walk VFX: continuous dust while moving ──────────────────
    _createWalkVFX() {
        this.walkEmitter = this.add.particles(0, 0, "circleParticle", {
            speed:      20,
            lifespan:   1000,
            scale:      { start: 0.05, end: 0.01 },
            alpha:      { start: 1.0, end: 0.5 },
            frequency:  100,                        // One particle every 100 ms
            emitting:   false,                      // Starts OFF
            blendMode:  "ADD"
        });
        this.walkEmitter.startFollow(this.player);
    }

    // ── Gem VFX: radial star burst on collection ───────────────
    _createGemVFX() {
        this.gemEmitter = this.add.particles(0, 0, "starParticle", {
            angle:      { min: 0, max: 360 },       // Full radial burst
            speed:      100,
            lifespan:   500,
            scale:      0.075,                      // Constant size
            alpha:      { start: 0.5, end: 0.0 },
            quantity:   20,
            duration:   100,
            frequency:  1,
            emitting:   false,
            blendMode:  "ADD"
        });
        // This emitter follows the player by default but we move it
        // to the gem position when a gem is collected (see _onGemCollect).
    }

    // ==================================================================
    // HUD — gem counter and lives display (fixed on screen)
    // ==================================================================

    _setupHUD() {
        const fontKey = "kenneySquare";
        const fontSize = 16;

        this.gemsText = this.add.bitmapText(
            10, 10, fontKey,
            `Gems: ${this.grabbedGems} / ${this.totalGems}`,
            fontSize
        ).setScrollFactor(0);

        this.livesText = this.add.bitmapText(
            10, 40, fontKey,
            `Lives: ${this.lives}`,
            fontSize
        ).setScrollFactor(0);
    }

    _updateHUD() {
        this.gemsText.setText(`Gems: ${this.grabbedGems} / ${this.totalGems}`);
        this.livesText.setText(`Lives: ${this.lives}`);
    }

    // ==================================================================
    // MOVEMENT — acceleration-based horizontal control
    // ==================================================================

    _handleMovement() {
        const onGround = this._isGrounded();

        if (this.keyA.isDown) {
            this.player.setAccelerationX(-this.ACCEL);
            this.player.setDragX(0);                // No drag while accelerating
            this.player.setFlipX(true);           // Face left
        } else if (this.keyD.isDown) {
            this.player.setAccelerationX(this.ACCEL);
            this.player.setDragX(0);                // No drag while accelerating
            this.player.setFlipX(false);          // Face right
        } else {
            // No movement key held → stop accelerating, apply drag.
            this.player.setAccelerationX(0);
            this.player.setDragX(this.DRAG);
        }

        // Detect landing — reset flip and double-jump on touch-down.
        if (onGround && !this.wasGrounded) {
            this.flipAbility   = true;
            this.canDoubleJump = true;
        }
        this.wasGrounded = onGround;
    }

    // ==================================================================
    // JUMP & DOUBLE-JUMP
    // ==================================================================

    _handleJump() {
        // Space must be *just* pressed (not held) to avoid bunny-hopping.
        if (!Phaser.Input.Keyboard.JustDown(this.keySpace)) return;

        const onGround = this._isGrounded();

        if (onGround) {
            // First jump — only available when grounded.
            this.player.setVelocityY(this.currentJumpVel);
            this.sound.play("jump", { volume: this.MASTER_VOL });
            this.jumpEmitter.explode();
        } else if (this.canDoubleJump) {
            // Double-jump — same force, once per airborne period.
            this.player.setVelocityY(this.currentJumpVel);
            this.canDoubleJump = false;
            this.sound.play("jump", { volume: this.MASTER_VOL });
            this.jumpEmitter.explode();
        }
    }

    // ==================================================================
    // RESTART — manual level restart via R key
    // ==================================================================

    _handleRestart() {
        if (Phaser.Input.Keyboard.JustDown(this.keyR)) {
            this._showEndScreen("Restarting!", 1000);
        }
    }

    // ==================================================================
    // GRAVITY FLIP — click to invert gravity
    // ==================================================================

    _tryFlipGravity() {
        if (!this.flipAbility) return;

        this.flipAbility = false;
        this.gravityFlipped = !this.gravityFlipped;

        // Invert gravity direction and jump velocity.
        this.currentGravity *= -1;
        this.currentJumpVel *= -1;
        this.physics.world.gravity.y = this.currentGravity;

        // Flip the player sprite vertically so it appears upside-down.
        this.player.setFlipY(this.gravityFlipped);

        this.sound.play("flip", { volume: this.MASTER_VOL });
    }

    // ==================================================================
    // GROUNDED CHECK — direction-aware (uses body.blocked, NOT touching)
    //
    //   Normal gravity  → blocked.down  means "feet on surface"
    //   Flipped gravity → blocked.up    means "feet on surface"
    // ==================================================================

    _isGrounded() {
        if (this.gravityFlipped) {
            return this.player.body.blocked.up;
        }
        return this.player.body.blocked.down;
    }

    // ==================================================================
    // ANIMATION — select walk / idle / jump based on player state
    // ==================================================================

    _updateAnimation() {
        const onGround = this._isGrounded();
        const moving   = this.keyA.isDown || this.keyD.isDown;

        if (!onGround) {
            this.player.play("jump", true);
        } else if (moving) {
            this.player.play("walk", true);
        } else {
            this.player.play("idle", true);
        }
    }

    // ==================================================================
    // WALK VFX — start/stop dust emitter based on movement state
    // ==================================================================

    _updateWalkVFX() {
        const onGround = this._isGrounded();
        const moving   = this.keyA.isDown || this.keyD.isDown;

        if (onGround && moving) {
            this.walkEmitter.emitting = true;
        } else {
            this.walkEmitter.emitting = false;
        }
    }

    // ==================================================================
    // OUT-OF-BOUNDS — kill the player if they fall/float off-screen
    // ==================================================================

    _checkOutOfBounds() {
        // Player origin is (0.5, 1) so y = bottom of sprite.
        // Die if the player is well past the map edges.
        const mapBottom = this.map.heightInPixels * this.SCALE;
        const fullH    = this.player.displayHeight;

        if (this.player.y > mapBottom + fullH ||
            this.player.y < -fullH) {
            this._onPlayerDeath();
        }
    }

    // ==================================================================
    // SPIKE HIT — overlap callback
    // ==================================================================

    _onSpikeHit(player, spike) {
        this._onPlayerDeath();
    }

    // ==================================================================
    // DEATH — decrement lives, reset position, check game-over
    // ==================================================================

    _onPlayerDeath() {
        // Death sound plays at 1.5× pitch UNLESS this is the final
        // death (lives is about to go below 0).
        if (this.lives > 0) {
            this.sound.play("death", {
                volume: this.MASTER_VOL,
                rate:   1.5
            });
        }

        this.lives--;

        // Reset gravity to normal if currently flipped.
        if (this.gravityFlipped) {
            this.gravityFlipped  = false;
            this.currentGravity  = this.GRAVITY;
            this.currentJumpVel  = this.JUMP_VEL;
            this.physics.world.gravity.y = this.currentGravity;
            this.player.setFlipY(false);
        }

        // Teleport to spawn with zero velocity.
        this.player.setPosition(this.SPAWN_X, this.SPAWN_Y);
        this.player.setVelocity(0, 0);
        this.player.setAcceleration(0, 0);

        // Reset per-airborne abilities.
        this.flipAbility   = true;
        this.canDoubleJump = true;

        this._updateHUD();

        // Game over check: lives < 0 means the player has exhausted
        // all 4 deaths (starting at 3 → 2 → 1 → 0 → −1).
        if (this.lives < 0) {
            this.sound.play("gameOver", { volume: this.MASTER_VOL });
            this._showEndScreen("Game Over!", 3000);
        }
    }

    // ==================================================================
    // GEM COLLECTION — overlap callback
    // ==================================================================

    _onGemCollect(player, gem) {
        // Move the gem emitter to the gem's position for the VFX burst.
        this.gemEmitter.setPosition(gem.x, gem.y);
        this.gemEmitter.explode();

        gem.destroy();

        this.grabbedGems++;
        this.sound.play("gemGrab", { volume: this.MASTER_VOL });
        this._updateHUD();

        // Win condition: all gems collected.
        if (this.grabbedGems === this.totalGems && !this.levelCompleted) {
            this.levelCompleted = true;
            // 2-second delay → play sound + show end screen.
            this.time.delayedCall(2000, () => {
                this.sound.play("levelComplete", { volume: this.MASTER_VOL });
                this._showEndScreen("Level Completed!", 3000);
            });
        }
    }

    // ==================================================================
    // END SCREEN — freeze game, overlay, text, then restart
    // ==================================================================

    _showEndScreen(message, delayMs) {
        this.gameRunning = false;

        // Freeze the player: zero gravity, zero velocity/acceleration.
        this.physics.world.gravity.y = 0;
        this.player.setVelocity(0, 0);
        this.player.setAcceleration(0, 0);

        // Semi-transparent black rectangle covering the entire map.
        const mapW = this.map.widthInPixels * this.SCALE;
        const mapH = this.map.heightInPixels * this.SCALE;
        this.add.rectangle(
            mapW / 2, mapH / 2,
            mapW, mapH,
            0x000000, 0.7
        ).setScrollFactor(1);

        // Centred end-screen text.
        this.add.bitmapText(
            this.player.x, this.player.y - 48,
            "kenneySquare", message, 24
        ).setOrigin(0.5).setScrollFactor(1);

        // Restart the scene after the specified delay.
        this.time.delayedCall(delayMs, () => {
            this.scene.restart();
        });
    }
}
