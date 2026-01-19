/**
 * Physics Module - Matter.js setup and collision handling
 * 
 * Manages the physics engine, world, and creature interactions
 */

const Matter = window.Matter;
const { Engine, World, Bodies, Body, Events, Vector } = Matter;

// Combat constants
const DAMAGE_THRESHOLD = 2.0;      // Minimum impact to cause damage
const DAMAGE_MULTIPLIER = 0.15;    // Scale impact to damage
const MOUTH_HEART_RADIUS = 25;     // Distance for instant kill

/**
 * Physics manager class
 */
export class PhysicsManager {
    constructor(width, height) {
        this.width = width;
        this.height = height;

        // Create engine with no gravity (top-down view)
        this.engine = Engine.create({
            gravity: { x: 0, y: 0 }
        });

        this.world = this.engine.world;
        this.creatures = new Map(); // id -> Creature
        this.obstacles = [];
        // No current/flow - creatures move freely

        // Create arena boundaries
        this.createBoundaries();

        // Create some initial obstacles
        this.createObstacles(5);

        // Set up collision detection
        this.setupCollisionHandling();
    }

    /**
     * Create invisible boundary walls
     */
    createBoundaries() {
        // Remove existing walls if they exist
        if (this.walls) {
            World.remove(this.world, this.walls);
        }

        const thickness = 200; // Much thicker to prevent tunneling
        const options = {
            isStatic: true,
            friction: 0.1,
            restitution: 0.8, // Bouncy boundaries to push creatures back
            label: 'boundary',
            render: { visible: false }
        };

        this.walls = [
            // Top
            Bodies.rectangle(this.width / 2, -thickness / 2, this.width + thickness * 2, thickness, options),
            // Bottom
            Bodies.rectangle(this.width / 2, this.height + thickness / 2, this.width + thickness * 2, thickness, options),
            // Left
            Bodies.rectangle(-thickness / 2, this.height / 2, thickness, this.height + thickness * 2, options),
            // Right
            Bodies.rectangle(this.width + thickness / 2, this.height / 2, thickness, this.height + thickness * 2, options)
        ];

        World.add(this.world, this.walls);
    }

    /**
     * Create random obstacles (rocks/walls)
     */
    createObstacles(count) {
        // Clear old obstacles
        for (const obs of this.obstacles) World.remove(this.world, obs);
        this.obstacles = [];

        for (let i = 0; i < count; i++) {
            const x = 100 + Math.random() * (this.width - 200);
            const y = 100 + Math.random() * (this.height - 200);
            const size = 30 + Math.random() * 50;
            const isRound = Math.random() > 0.5;

            const obstacle = isRound ?
                Bodies.circle(x, y, size / 2, { isStatic: true, label: 'obstacle', render: { fillStyle: '#334155' } }) :
                Bodies.rectangle(x, y, size, size, { isStatic: true, label: 'obstacle', render: { fillStyle: '#334155' }, angle: Math.random() * Math.PI });

            this.obstacles.push(obstacle);
        }
        World.add(this.world, this.obstacles);
    }

    /**
     * Set up collision event handling
     */
    setupCollisionHandling() {
        Events.on(this.engine, 'collisionStart', (event) => {
            for (const pair of event.pairs) {
                this.handleCollision(pair);
            }
        });
    }

    /**
     * Handle a collision between two bodies
     */
    handleCollision(pair) {
        const { bodyA, bodyB } = pair;

        // Handle Power-up collection
        if (bodyA.label === 'powerup' && bodyB.creature) {
            bodyA.powerUp.collect(bodyB.creature);
            return;
        }
        if (bodyB.label === 'powerup' && bodyA.creature) {
            bodyB.powerUp.collect(bodyA.creature);
            return;
        }

        // Skip non-creature collisions
        if (!bodyA.creature || !bodyB.creature) return;

        // Skip same-creature collisions
        if (bodyA.creatureId === bodyB.creatureId) return;

        const creatureA = bodyA.creature;
        const creatureB = bodyB.creature;

        // Skip if either is dead
        if (!creatureA.isAlive() || !creatureB.isAlive()) return;

        // Check for mouth-heart instant kill
        this.checkMouthHeartKill(creatureA, creatureB);
        this.checkMouthHeartKill(creatureB, creatureA);

        // Calculate collision damage
        const relativeVelocity = Vector.sub(bodyA.velocity, bodyB.velocity);
        const impactSpeed = Vector.magnitude(relativeVelocity);

        if (impactSpeed > DAMAGE_THRESHOLD) {
            const damage = (impactSpeed - DAMAGE_THRESHOLD) *
                (bodyA.mass + bodyB.mass) *
                DAMAGE_MULTIPLIER;

            // Both creatures take damage proportional to impact
            creatureA.takeDamage(damage * 0.5, creatureB);
            creatureB.takeDamage(damage * 0.5, creatureA);
        }
    }

    /**
     * Check if attacker's mouth is near victim's heart
     */
    checkMouthHeartKill(attacker, victim) {
        const mouthPos = attacker.getMouthPosition();
        const heartPos = victim.getHeartPosition();

        const distance = Vector.magnitude(Vector.sub(mouthPos, heartPos));

        if (distance < MOUTH_HEART_RADIUS) {
            victim.die(attacker);
            attacker.restoreHealth(150); // Eating the victim gives significant energy reward
        }
    }

    /**
     * Register a creature with the physics manager
     */
    registerCreature(creature) {
        this.creatures.set(creature.id, creature);
    }

    /**
     * Remove a creature from tracking
     */
    unregisterCreature(creature) {
        this.creatures.delete(creature.id);
    }

    /**
     * Resize the physics world
     */
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.createBoundaries();
    }

    /**
     * Update physics simulation
     * @param {number} deltaTime - Time step in milliseconds
     */
    update(deltaTime) {
        // Clean up any invalid creatures before update
        const invalidCreatures = [];
        for (const creature of this.creatures.values()) {
            if (!creature || !creature.composite || !creature.composite.id) {
                invalidCreatures.push(creature);
            }
        }
        for (const creature of invalidCreatures) {
            if (creature) {
                this.creatures.delete(creature.id);
            }
        }

        // Clean up any invalid constraints in the world before update
        if (this.world && this.world.constraints) {
            const validConstraints = this.world.constraints.filter(c => {
                if (!c || !c.id) return false;
                if (!c.bodyA || !c.bodyB) return false;
                if (!c.bodyA.id || !c.bodyB.id) return false;
                // Check if bodies are still in world
                const bodyAInWorld = this.world.bodies && this.world.bodies.some(b => b && b.id === c.bodyA.id);
                const bodyBInWorld = this.world.bodies && this.world.bodies.some(b => b && b.id === c.bodyB.id);
                return bodyAInWorld && bodyBInWorld;
            });
            
            // Remove invalid constraints
            for (const constraint of this.world.constraints) {
                if (!validConstraints.includes(constraint)) {
                    try {
                        World.remove(this.world, constraint);
                    } catch (e) {
                        // Ignore errors
                    }
                }
            }
        }

        try {
            Engine.update(this.engine, deltaTime);
        } catch (error) {
            console.error('Physics engine update error:', error);
            // Try to recover by cleaning up potentially corrupted state
            this.recoverFromError();
            return;
        }

        // Update creatures (no current/flow applied)
        // Update all creatures, including dead ones (for fade-out animation)
        const creaturesToUpdate = Array.from(this.creatures.values());
        for (const creature of creaturesToUpdate) {
            try {
                // Only update if creature still has valid composite and is in world
                if (creature && creature.composite && creature.composite.id) {
                    // Verify composite is still in world
                    const compositeInWorld = this.world.composites && 
                        this.world.composites.some(c => c && c.id === creature.composite.id);
                    if (compositeInWorld) {
                        creature.update(deltaTime / 1000); // Convert to seconds
                    } else {
                        // Composite was removed, mark for cleanup
                        this.creatures.delete(creature.id);
                    }
                }
            } catch (error) {
                console.warn('Error updating creature:', error);
                // Mark creature for removal if update fails
                if (creature) {
                    this.creatures.delete(creature.id);
                    creature.canDestroy = true;
                }
            }
        }
    }

    /**
     * Recover from physics engine error by cleaning up corrupted state
     */
    recoverFromError() {
        try {
            // Remove all creatures from tracking and world
            const creaturesToRemove = Array.from(this.creatures.values());
            for (const creature of creaturesToRemove) {
                if (creature) {
                    try {
                        if (creature.composite && creature.composite.id) {
                            // Check if composite is still in world
                            const compositeInWorld = this.world.composites && 
                                this.world.composites.some(c => c && c.id === creature.composite.id);
                            if (compositeInWorld) {
                                Composite.remove(this.world, creature.composite);
                            }
                        }
                    } catch (e) {
                        // Ignore errors during cleanup
                    }
                    // Clear references
                    if (creature.constraints) creature.constraints = [];
                    if (creature.bodies) creature.bodies = [];
                    creature.composite = null;
                }
                this.creatures.delete(creature.id);
            }
            
            // Clean up any orphaned constraints or bodies
            if (this.world) {
                // Remove invalid constraints
                if (this.world.constraints) {
                    const validConstraints = this.world.constraints.filter(c => {
                        if (!c || !c.id) return false;
                        // Check if constraint has valid body references
                        if (c.bodyA && c.bodyB) {
                            return c.bodyA.id && c.bodyB.id;
                        }
                        return false;
                    });
                    // Remove invalid constraints
                    for (const constraint of this.world.constraints) {
                        if (!validConstraints.includes(constraint)) {
                            try {
                                World.remove(this.world, constraint);
                            } catch (e) {
                                // Ignore errors
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error during recovery:', error);
        }
    }

    /**
     * Clear all creatures from the world
     */
    clearCreatures() {
        for (const creature of this.creatures.values()) {
            creature.destroy();
        }
        this.creatures.clear();
    }

    /**
     * Get all living creatures
     */
    getLivingCreatures() {
        return Array.from(this.creatures.values()).filter(c => c.isAlive());
    }

    /**
     * Get the physics world
     */
    getWorld() {
        return this.world;
    }
}

export default PhysicsManager;
