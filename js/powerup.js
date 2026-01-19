/**
 * PowerUp Module - Collectible items that restore health
 */

const Matter = window.Matter;
const { Bodies, World } = Matter;

export class PowerUp {
    constructor(world, x, y, id, type = 'health') {
        this.world = world;
        this.id = id;
        this.type = type;
        this.radius = type === 'super' ? 18 : 12;
        // Create physics body
        this.body = Bodies.circle(x, y, this.radius, {
            isSensor: true, // Sensors don't cause physical collisions
            isStatic: type !== 'super',
            frictionAir: 0.1,
            label: 'powerup',
            render: { visible: false }
        });

        this.healthRestore = type === 'super' ? 150 : 50; // Increased to make food more valuable
        this.color = type === 'super' ? 0xff4444 : 0x44ff44; // Red for super, Green for regular

        this.body.powerUp = this; // Self-reference for collision handling
        World.add(this.world, this.body);

        this.collected = false;
    }

    /**
     * Update powerup behavior
     */
    update(creatures) {
        if (this.type === 'super') {
            // "Super" (red) food runs away from nearby creatures
            let fleeVector = { x: 0, y: 0 };
            let count = 0;

            for (const creature of creatures) {
                if (!creature.isAlive()) continue;
                const pos = creature.getCenterPosition();
                const dx = this.body.position.x - pos.x;
                const dy = this.body.position.y - pos.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < 150 * 150) {
                    const dist = Math.sqrt(distSq);
                    fleeVector.x += (dx / dist) * (150 - dist);
                    fleeVector.y += (dy / dist) * (150 - dist);
                    count++;
                }
            }

            if (count > 0) {
                fleeVector.x /= count;
                fleeVector.y /= count;
                const force = 0.0005;
                Matter.Body.applyForce(this.body, this.body.position, {
                    x: fleeVector.x * force,
                    y: fleeVector.y * force
                });
            }
        }
    }

    /**
     * Mark as collected and remove from physics world
     */
    collect(creature) {
        if (this.collected) return;
        this.collected = true;

        creature.restoreHealth(this.healthRestore);
        World.remove(this.world, this.body);
    }

    /**
     * Clean up resources
     */
    destroy() {
        World.remove(this.world, this.body);
    }
}

export default PowerUp;
