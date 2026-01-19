/**
 * WebGL Renderer Module - PixiJS based rendering for high performance
 * 
 * Replaces the Canvas 2D renderer for larger populations
 */

const PIXI = window.PIXI;

/**
 * WebGL Renderer class
 */
export class WebGLRenderer {
    constructor(canvas) {
        this.canvas = canvas;

        // Get actual display dimensions from CSS
        const rect = canvas.getBoundingClientRect();
        const displayWidth = rect.width || 800;
        const displayHeight = rect.height || 600;

        // Initialize Pixi Application with display dimensions
        this.app = new PIXI.Application({
            view: canvas,
            width: displayWidth,
            height: displayHeight,
            backgroundColor: 0x12121a,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });

        // Containers for layering
        this.backgroundLayer = new PIXI.Container();
        this.obstacleLayer = new PIXI.Container();
        this.powerUpLayer = new PIXI.Container();
        this.creatureLayer = new PIXI.Container();
        this.effectsLayer = new PIXI.Container();
        this.uiLayer = new PIXI.Container();

        this.app.stage.addChild(this.backgroundLayer);
        this.app.stage.addChild(this.obstacleLayer);
        this.app.stage.addChild(this.powerUpLayer);
        this.app.stage.addChild(this.creatureLayer);
        this.app.stage.addChild(this.effectsLayer);
        this.app.stage.addChild(this.uiLayer);

        // Settings
        this.arenaMargin = 40;
        this.creatureGraphics = new Map(); // creatureId -> PIXI Container
        this.powerUpGraphics = new Map(); // powerUpId -> PIXI Graphics

        // Draw initial background
        this.setupBackground();
    }

    /**
     * Set up arena and grid
     */
    setupBackground() {
        this.backgroundLayer.removeChildren();

        // Use renderer dimensions (which are in logical pixels)
        const width = this.app.renderer.width;
        const height = this.app.renderer.height;

        const grid = new PIXI.Graphics();
        grid.lineStyle(1, 0x6366f1, 0.08);

        // Vertical lines
        for (let x = 0; x <= width; x += 50) {
            grid.moveTo(x, 0);
            grid.lineTo(x, height);
        }
        // Horizontal lines
        for (let y = 0; y <= height; y += 50) {
            grid.moveTo(0, y);
            grid.lineTo(width, y);
        }

        // Arena border - removed visually (physics boundaries still exist)
        // grid.lineStyle(2, 0x8b5cf6, 0.4);
        // const m = this.arenaMargin;
        // grid.drawRect(m, m, width - m * 2, height - m * 2);

        this.backgroundLayer.addChild(grid);
    }

    /**
     * Resize renderer
     */
    resize(width, height) {
        this.app.renderer.resize(width, height);
        this.setupBackground();
    }

    /**
     * Prepare for new frame (not strictly needed in Pixi, but for compat)
     */
    clear() {
        // Pixi handles clear internally
    }

    /**
     * Render all creatures
     */
    renderCreatures(creatures) {
        // Remove dead creature graphics that are no longer in the list
        const activeIds = new Set(creatures.map(c => c.id));
        for (const [id, container] of this.creatureGraphics.entries()) {
            if (!activeIds.has(id)) {
                this.creatureLayer.removeChild(container);
                container.destroy({ children: true });
                this.creatureGraphics.delete(id);
            }
        }

        for (const creature of creatures) {
            this.renderCreature(creature);
        }
    }

    /**
     * Render a single creature using Pixi Graphics
     */
    renderCreature(creature) {
        let container = this.creatureGraphics.get(creature.id);

        if (!container) {
            container = new PIXI.Container();
            this.creatureLayer.addChild(container);
            this.creatureGraphics.set(creature.id, container);

            // Create graphics for each segment
            for (let i = 0; i < creature.bodies.length; i++) {
                const body = creature.bodies[i];
                const seg = body.segmentData;
                const graphics = new PIXI.Graphics();
                graphics.name = `seg_${i}`;

                // Apply beauty-based color enhancement
                const beauty = creature.dna.beauty || 0.5;
                // Increase saturation and brightness for higher beauty
                const beautyMultiplier = 0.7 + (beauty * 0.6); // 0.7 to 1.3 range
                
                // Ensure color exists and is valid array
                let baseColor = [128, 128, 128]; // Default gray
                if (seg.color && Array.isArray(seg.color) && seg.color.length >= 3) {
                    baseColor = seg.color;
                }
                
                // Clamp and calculate RGB values
                const r = Math.max(0, Math.min(255, Math.round((baseColor[0] || 128) * beautyMultiplier)));
                const g = Math.max(0, Math.min(255, Math.round((baseColor[1] || 128) * beautyMultiplier)));
                const b = Math.max(0, Math.min(255, Math.round((baseColor[2] || 128) * beautyMultiplier)));
                
                // Ensure final color value is valid (0x000000 to 0xFFFFFF)
                const color = Math.max(0, Math.min(0xFFFFFF, (r << 16) | (g << 8) | b));

                graphics.beginFill(color);
                if (seg.shape === 'circle') {
                    graphics.drawCircle(0, 0, seg.radius);
                } else {
                    graphics.drawRoundedRect(-seg.width / 2, -seg.length / 2, seg.width, seg.length, 3);
                }
                graphics.endFill();

                // Add mouth/heart markers
                if (seg.isMouth) {
                    graphics.beginFill(0xff6464, 0.8);
                    graphics.drawCircle(0, seg.shape === 'circle' ? -seg.radius : -seg.length / 2, 4);
                    graphics.endFill();
                }
                if (seg.isHeart) {
                    graphics.beginFill(0x64ff96, 0.8);
                    graphics.drawCircle(0, 0, 5);
                    graphics.endFill();
                }
                if (seg.isGripper) {
                    graphics.lineStyle(2, 0x000000, 0.4);
                    graphics.drawCircle(0, 0, (seg.radius || 10) + 2);
                }

                container.addChild(graphics);
            }

            // Food bar container
            const foodBar = new PIXI.Graphics();
            foodBar.name = 'foodBar';
            container.addChild(foodBar);

            // Health bar container
            const healthBar = new PIXI.Graphics();
            healthBar.name = 'healthBar';
            container.addChild(healthBar);

            // Oldest indicator (crown icon)
            const oldestIndicator = new PIXI.Graphics();
            oldestIndicator.name = 'oldestIndicator';
            container.addChild(oldestIndicator);

            // Selection highlight
            const selectionCircle = new PIXI.Graphics();
            selectionCircle.name = 'selection';
            container.addChildAt(selectionCircle, 0);

            // Beauty glow effect container
            const beautyGlow = new PIXI.Graphics();
            beautyGlow.name = 'beautyGlow';
            container.addChildAt(beautyGlow, 0);

            // Sensors container
            const sensorsGraphic = new PIXI.Graphics();
            sensorsGraphic.name = 'sensors';
            container.addChild(sensorsGraphic);
        }

        // Apply alpha for fading corpses
        container.alpha = creature.fadeAlpha;
        
        // Hide completely if canDestroy (fully faded)
        container.visible = !creature.canDestroy;

        // Desaturate if dead (rudimentary gray-out)
        if (!creature.isAlive()) {
            // In a more complex Pixi app we'd use filters, here we'll just tint it gray
            container.tint = 0x888888;
        } else {
            // Apply beauty-based tint for living creatures (higher beauty = brighter)
            const beauty = creature.dna.beauty || 0.5;
            const tintValue = Math.floor(0xFFFFFF * (0.85 + beauty * 0.15)); // 85% to 100% brightness
            container.tint = tintValue;
        }
        
        // Update beauty glow effect
        const beautyGlow = container.getChildByName('beautyGlow');
        if (beautyGlow && creature.isAlive()) {
            beautyGlow.clear();
            const beauty = creature.dna.beauty || 0.5;
            if (beauty > 0.7) {
                // Add glow for high-beauty creatures
                const centerPos = creature.getCenterPosition();
                const glowIntensity = (beauty - 0.7) * 3.33; // 0 to 1 for beauty 0.7 to 1.0
                const glowColor = 0xFFFF00; // Yellow/gold glow
                const glowAlpha = glowIntensity * 0.3;
                const glowRadius = 30 + beauty * 20;
                
                beautyGlow.beginFill(glowColor, glowAlpha);
                beautyGlow.drawCircle(centerPos.x, centerPos.y, glowRadius);
                beautyGlow.endFill();
            }
        }

        // Update positions
        for (let i = 0; i < creature.bodies.length; i++) {
            const body = creature.bodies[i];
            const graphics = container.getChildByName(`seg_${i}`);
            if (graphics) {
                graphics.x = body.position.x;
                graphics.y = body.position.y;
                graphics.rotation = body.angle;
            }
        }

        // Update food bar
        const foodBar = container.getChildByName('foodBar');
        if (foodBar && creature.isAlive()) {
            foodBar.clear();
            const pos = creature.getCenterPosition();
            const width = 30;
            const height = 3;
            const foodPercent = Math.min(1, creature.food / 200);

            // Food bar background (black)
            foodBar.beginFill(0x000000, 0.5);
            foodBar.drawRect(pos.x - width / 2, pos.y - 30, width, height);

            // Food bar (orange/yellow color)
            const foodColor = PIXI.utils.rgb2hex([1, 0.7 - foodPercent * 0.3, 0]);
            foodBar.beginFill(foodColor);
            foodBar.drawRect(pos.x - width / 2, pos.y - 30, width * foodPercent, height);
        }

        // Update health bar
        const healthBar = container.getChildByName('healthBar');
        if (healthBar && creature.isAlive()) {
            healthBar.clear();
            const pos = creature.getCenterPosition();
            const width = 30;
            const height = 3;
            const healthPercent = Math.min(1, creature.health / 200);

            // Health bar background (black)
            healthBar.beginFill(0x000000, 0.5);
            healthBar.drawRect(pos.x - width / 2, pos.y - 23, width, height);

            // Health bar (red to green color ramp)
            const healthColor = PIXI.utils.rgb2hex([1 - healthPercent, healthPercent, 0]);
            healthBar.beginFill(healthColor);
            healthBar.drawRect(pos.x - width / 2, pos.y - 23, width * healthPercent, height);
        }

        // Update oldest indicator (crown)
        const oldestIndicator = container.getChildByName('oldestIndicator');
        if (oldestIndicator && creature.isAlive()) {
            oldestIndicator.clear();
            // Check if this is the oldest creature
            if (window.simulation && window.simulation.getOldestCreatureId) {
                const oldestId = window.simulation.getOldestCreatureId();
                if (oldestId === creature.id) {
                    const pos = creature.getCenterPosition();
                    // Draw a simple crown icon above the creature
                    const crownY = pos.y - 45;
                    oldestIndicator.beginFill(0xFFD700, 0.9); // Gold color
                    // Simple crown shape (triangle with points)
                    oldestIndicator.drawPolygon([
                        pos.x - 8, crownY + 4,
                        pos.x - 6, crownY,
                        pos.x - 2, crownY + 2,
                        pos.x, crownY - 2,
                        pos.x + 2, crownY + 2,
                        pos.x + 6, crownY,
                        pos.x + 8, crownY + 4,
                        pos.x + 8, crownY + 8,
                        pos.x - 8, crownY + 8
                    ]);
                    oldestIndicator.endFill();
                }
            }
        }

        // Update selection highlight
        const selection = container.getChildByName('selection');
        if (selection) {
            selection.clear();
            if (window.simulation?.ui?.selectedCreature?.id === creature.id) {
                const pos = creature.getCenterPosition();
                selection.lineStyle(2, 0xffffff, 0.5);
                selection.drawCircle(pos.x, pos.y, 40 + Math.sin(Date.now() * 0.01) * 5);
            }
        }

        // Update sensors
        const sensorsGraphic = container.getChildByName('sensors');
        if (sensorsGraphic) {
            sensorsGraphic.clear();
            if (creature.isAlive() && creature.sensors) {
                for (const sensor of creature.sensors) {
                    if (!sensor.body) continue;

                    const pos = sensor.body.position;
                    const angle = sensor.body.angle + sensor.angle;
                    const activation = sensor.activation || 0;

                    if (sensor.type === 'eye') {
                        const fov = (sensor.fov * Math.PI / 180);
                        const intensity = 0.05 + activation * 0.15;
                        sensorsGraphic.lineStyle(1, 0xffff64, intensity * 2);
                        sensorsGraphic.beginFill(0xffff64, intensity);
                        sensorsGraphic.moveTo(pos.x, pos.y);
                        sensorsGraphic.arc(pos.x, pos.y, sensor.range, angle - fov / 2, angle + fov / 2);
                        sensorsGraphic.lineTo(pos.x, pos.y);
                        sensorsGraphic.endFill();
                    } else {
                        const intensity = 0.2 + activation * 0.6;
                        sensorsGraphic.lineStyle(2, 0x64c8ff, intensity);
                        sensorsGraphic.moveTo(pos.x, pos.y);
                        sensorsGraphic.lineTo(
                            pos.x + Math.cos(angle) * sensor.range,
                            pos.y + Math.sin(angle) * sensor.range
                        );
                        sensorsGraphic.drawCircle(
                            pos.x + Math.cos(angle) * sensor.range,
                            pos.y + Math.sin(angle) * sensor.range,
                            2
                        );
                    }
                }
            }
        }
    }

    /**
     * Render static obstacles
     */
    renderObstacles(obstacles) {
        if (this.obstacleLayer.children.length === 0 && obstacles.length > 0) {
            for (const obs of obstacles) {
                const g = new PIXI.Graphics();
                const color = 0x334155;
                g.beginFill(color);
                g.lineStyle(2, 0x475569);

                if (obs.circleRadius) {
                    g.drawCircle(0, 0, obs.circleRadius);
                } else {
                    // Extract width/height from vertices if possible, or just use a placeholder
                    // For now we'll just check if it's a rectangle
                    const width = 40; // Default
                    const height = 40;
                    g.drawRoundedRect(-width / 2, -height / 2, width, height, 5);
                }
                g.endFill();
                g.x = obs.position.x;
                g.y = obs.position.y;
                g.rotation = obs.angle;
                this.obstacleLayer.addChild(g);
            }
        }
    }

    /**
     * Render all power-ups
     */
    renderPowerUps(powerUps) {
        // Remove old power-ups
        const activeIds = new Set(powerUps.map(p => p.id));
        for (const [id, graphics] of this.powerUpGraphics.entries()) {
            if (!activeIds.has(id)) {
                // Add collection effect if it was just removed
                const g = this.powerUpGraphics.get(id);
                if (g) this.addEffect(g.x, g.y, 'collect', g.powerUpColor);

                this.powerUpLayer.removeChild(graphics);
                graphics.destroy();
                this.powerUpGraphics.delete(id);
            }
        }

        for (const p of powerUps) {
            let graphics = this.powerUpGraphics.get(p.id);
            if (!graphics) {
                graphics = new PIXI.Graphics();
                graphics.powerUpColor = p.color;

                // Outer glow
                graphics.beginFill(p.color, 0.2);
                graphics.drawCircle(0, 0, p.radius * 1.5);
                graphics.endFill();

                // Core
                graphics.beginFill(p.color, 0.8);
                graphics.lineStyle(2, 0xffffff, 0.5);
                graphics.drawCircle(0, 0, p.radius);
                graphics.endFill();

                this.powerUpLayer.addChild(graphics);
                this.powerUpGraphics.set(p.id, graphics);
            }

            graphics.x = p.body.position.x;
            graphics.y = p.body.position.y;

            // Pulsing effect
            const scale = 1 + Math.sin(Date.now() * 0.005) * 0.1;
            graphics.scale.set(scale);
        }
    }

    /**
     * Add collision effect (simple circle for now)
     */
    addEffect(x, y, type = 'hit', color = 0xffff64) {
        const effect = new PIXI.Graphics();

        if (type === 'collect') {
            effect.beginFill(color, 0.6);
            effect.drawCircle(0, 0, 20);
        } else {
            effect.beginFill(0xffff64, 0.5);
            effect.drawCircle(0, 0, 10);
        }

        effect.x = x;
        effect.y = y;
        effect.life = 1.0;

        this.effectsLayer.addChild(effect);
    }

    /**
     * Update and render effects
     */
    updateEffects(deltaTime) {
        for (let i = this.effectsLayer.children.length - 1; i >= 0; i--) {
            const effect = this.effectsLayer.children[i];
            effect.life -= deltaTime * 3;

            if (effect.life <= 0) {
                this.effectsLayer.removeChild(effect);
                effect.destroy();
                continue;
            }

            effect.alpha = effect.life;
            effect.scale.set((1 - effect.life) * 3 + 1);
        }
    }
}
