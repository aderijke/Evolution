/**
 * Renderer Module - Canvas 2D rendering for the simulation
 * 
 * Draws creatures, arena, and visual effects
 */

/**
 * Renderer class for Canvas 2D visualization
 */
export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Colors
        this.bgColor = '#12121a';
        this.gridColor = 'rgba(99, 102, 241, 0.08)';
        this.arenaColor = 'rgba(99, 102, 241, 0.15)';
        this.arenaBorderColor = 'rgba(139, 92, 246, 0.4)';

        // Arena settings
        this.arenaMargin = 40;

        // Effect tracking
        this.effects = [];
    }

    /**
     * Resize canvas to fit container
     */
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    /**
     * Clear and prepare for new frame
     */
    clear() {
        const { ctx, canvas } = this;

        // Clear with background
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw grid
        this.drawGrid();

        // Draw arena border
        this.drawArenaBorder();
    }

    /**
     * Draw background grid
     */
    drawGrid() {
        const { ctx, canvas } = this;
        const gridSize = 50;

        ctx.strokeStyle = this.gridColor;
        ctx.lineWidth = 1;

        ctx.beginPath();
        for (let x = 0; x <= canvas.width; x += gridSize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
        }
        for (let y = 0; y <= canvas.height; y += gridSize) {
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
        }
        ctx.stroke();
    }

    /**
     * Draw arena border - removed visually (physics boundaries still exist)
     */
    drawArenaBorder() {
        // Arena border visually removed - physics boundaries still active
        // const { ctx, canvas } = this;
        // const m = this.arenaMargin;
        // ctx.shadowColor = this.arenaBorderColor;
        // ctx.shadowBlur = 15;
        // ctx.strokeStyle = this.arenaBorderColor;
        // ctx.lineWidth = 2;
        // ctx.strokeRect(m, m, canvas.width - m * 2, canvas.height - m * 2);
        // ctx.shadowBlur = 0;
    }

    /**
     * Render all creatures
     * @param {Creature[]} creatures - Array of creatures to render
     */
    renderCreatures(creatures) {
        for (const creature of creatures) {
            this.renderCreature(creature);
        }
    }

    /**
     * Render a single creature
     * @param {Creature} creature - Creature to render
     */
    renderCreature(creature) {
        const { ctx } = this;

        // Draw each body segment
        for (const body of creature.bodies) {
            ctx.save();

            // Transform to body position and rotation
            ctx.translate(body.position.x, body.position.y);
            ctx.rotate(body.angle);

            // Get segment data
            const seg = body.segmentData;
            const color = body.render?.fillStyle || '#888888';

            // Shadow for depth
            ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 4;

            ctx.fillStyle = color;

            if (seg?.shape === 'circle') {
                ctx.beginPath();
                ctx.arc(0, 0, seg.radius, 0, Math.PI * 2);
                ctx.fill();

                // Inner highlight
                ctx.shadowBlur = 0;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.beginPath();
                ctx.arc(-seg.radius * 0.3, -seg.radius * 0.3, seg.radius * 0.4, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Rectangle
                const w = seg?.width || 10;
                const h = seg?.length || 30;

                // Rounded rectangle
                this.roundRect(-w / 2, -h / 2, w, h, 3);
                ctx.fill();

                // Inner highlight
                ctx.shadowBlur = 0;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                this.roundRect(-w / 2 + 2, -h / 2 + 2, w - 4, 6, 2);
                ctx.fill();
            }

            // Draw mouth indicator
            if (seg?.isMouth) {
                ctx.fillStyle = 'rgba(255, 100, 100, 0.8)';
                ctx.beginPath();
                ctx.arc(0, seg?.shape === 'circle' ? -seg.radius : -seg.length / 2, 4, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw heart indicator
            if (seg?.isHeart) {
                ctx.fillStyle = 'rgba(100, 255, 150, 0.8)';
                ctx.beginPath();
                ctx.arc(0, 0, 5, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }

        // Render sensors
        this.renderSensors(creature);

        // Draw health bar if damaged
        if (creature.health < 100 && creature.isAlive()) {
            this.drawHealthBar(creature);
        }
    }

    /**
     * Render creature sensors
     */
    renderSensors(creature) {
        const { ctx } = this;
        if (!creature.sensors) return;

        for (const sensor of creature.sensors) {
            if (!sensor.body) continue;

            const pos = sensor.body.position;
            const angle = sensor.body.angle + sensor.angle;
            const activation = sensor.activation || 0;

            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.rotate(angle);

            if (sensor.type === 'eye') {
                // Draw FOV cone
                const fov = (sensor.fov * Math.PI / 180);
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, sensor.range, -fov / 2, fov / 2);
                ctx.closePath();

                // Color based on activation
                ctx.fillStyle = activation > 0
                    ? `rgba(255, 255, 100, ${0.05 + activation * 0.15})`
                    : 'rgba(255, 255, 255, 0.02)';
                ctx.fill();

                // Draw center line
                ctx.strokeStyle = activation > 0
                    ? `rgba(255, 255, 100, ${0.1 + activation * 0.4})`
                    : 'rgba(255, 255, 255, 0.1)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(sensor.range * 0.8, 0);
                ctx.stroke();
            } else {
                // Feeler - draw arc or line
                ctx.strokeStyle = activation > 0
                    ? `rgba(100, 200, 255, ${0.2 + activation * 0.6})`
                    : 'rgba(100, 200, 255, 0.1)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(sensor.range, 0);
                ctx.stroke();

                // Small circle at end
                ctx.fillStyle = ctx.strokeStyle;
                ctx.beginPath();
                ctx.arc(sensor.range, 0, 2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    /**
     * Draw health bar above creature
     */
    drawHealthBar(creature) {
        const { ctx } = this;
        const pos = creature.getCenterPosition();

        const width = 30;
        const height = 4;
        const y = pos.y - 25;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(pos.x - width / 2, y, width, height);

        // Health fill
        const healthPercent = creature.health / 100;
        const hue = healthPercent * 120; // Green to red
        ctx.fillStyle = `hsl(${hue}, 80%, 50%)`;
        ctx.fillRect(pos.x - width / 2, y, width * healthPercent, height);
    }

    /**
     * Draw a rounded rectangle path
     */
    roundRect(x, y, width, height, radius) {
        const { ctx } = this;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    /**
     * Add a visual effect (e.g., hit flash)
     */
    addEffect(x, y, type = 'hit') {
        this.effects.push({
            x, y, type,
            life: 1.0,
            maxLife: 1.0
        });
    }

    /**
     * Update and render effects
     */
    updateEffects(deltaTime) {
        const { ctx } = this;

        for (let i = this.effects.length - 1; i >= 0; i--) {
            const effect = this.effects[i];
            effect.life -= deltaTime * 3;

            if (effect.life <= 0) {
                this.effects.splice(i, 1);
                continue;
            }

            // Draw effect
            const alpha = effect.life;
            const size = (1 - effect.life) * 30 + 5;

            ctx.beginPath();
            ctx.arc(effect.x, effect.y, size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 200, 100, ${alpha * 0.5})`;
            ctx.fill();
        }
    }
}

export default Renderer;
