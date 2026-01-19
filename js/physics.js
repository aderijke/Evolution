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
            const baseDamage = (impactSpeed - DAMAGE_THRESHOLD) *
                (bodyA.mass + bodyB.mass) *
                DAMAGE_MULTIPLIER;

            // Age-based combat system
            // Linear scaling from age 0 to maxAge
            const MAX_AGE = 14400; // Maximum age for full bonus (4 hours = 14400 seconds)
            const MAX_ATTACK_BONUS = 2.0; // Maximum attack multiplier (2x damage at max age)
            const MAX_DEFENSE_REDUCTION = 0.5; // Maximum defense reduction (50% less damage at max age)
            
            // Calculate attack bonus: linear from 1.0 to MAX_ATTACK_BONUS
            const attackBonusA = 1.0 + (Math.min(creatureA.age, MAX_AGE) / MAX_AGE) * (MAX_ATTACK_BONUS - 1.0);
            const attackBonusB = 1.0 + (Math.min(creatureB.age, MAX_AGE) / MAX_AGE) * (MAX_ATTACK_BONUS - 1.0);
            
            // Calculate defense reduction: linear from 1.0 to (1.0 - MAX_DEFENSE_REDUCTION)
            const defenseA = 1.0 - (Math.min(creatureA.age, MAX_AGE) / MAX_AGE) * MAX_DEFENSE_REDUCTION;
            const defenseB = 1.0 - (Math.min(creatureB.age, MAX_AGE) / MAX_AGE) * MAX_DEFENSE_REDUCTION;
            
            // Calculate final damage:
            // - Attacker's age increases damage dealt
            // - Defender's age reduces damage taken
            const damageToA = baseDamage * 0.5 * attackBonusB * defenseA;
            const damageToB = baseDamage * 0.5 * attackBonusA * defenseB;
            
            creatureA.takeDamage(damageToA, creatureB);
            creatureB.takeDamage(damageToB, creatureA);
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
        // Cap delta time to prevent issues
        const maxDeltaTime = 50; // Max 50ms per step
        const safeDeltaTime = Math.min(deltaTime, maxDeltaTime);

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

        // Aggressively clean up any invalid constraints in the world before update
        // This is critical to prevent Matter.js from accessing invalid body references
        if (this.world && this.world.constraints) {
            const constraintsToRemove = [];
            
            // Create a set of valid body IDs for fast lookup
            const validBodyIds = new Set();
            if (this.world.bodies) {
                for (const body of this.world.bodies) {
                    if (body && body.id) {
                        validBodyIds.add(body.id);
                    }
                }
            }
            
            // Check all constraints for validity
            for (let i = this.world.constraints.length - 1; i >= 0; i--) {
                const constraint = this.world.constraints[i];
                
                // Basic validation
                if (!constraint || !constraint.id) {
                    constraintsToRemove.push(constraint);
                    continue;
                }
                
                // Check body references exist
                if (!constraint.bodyA || !constraint.bodyB) {
                    constraintsToRemove.push(constraint);
                    continue;
                }
                
                // Check body IDs exist
                if (!constraint.bodyA.id || !constraint.bodyB.id) {
                    constraintsToRemove.push(constraint);
                    continue;
                }
                
                // Check bodies are still in world (using our set for fast lookup)
                if (!validBodyIds.has(constraint.bodyA.id) || !validBodyIds.has(constraint.bodyB.id)) {
                    constraintsToRemove.push(constraint);
                    continue;
                }
                
                // Additional safety: check if bodies have valid index (Matter.js internal)
                try {
                    if (constraint.bodyA.index === undefined || constraint.bodyB.index === undefined) {
                        constraintsToRemove.push(constraint);
                        continue;
                    }
                } catch (e) {
                    // If we can't access index, the body is likely invalid
                    constraintsToRemove.push(constraint);
                    continue;
                }
            }
            
            // Remove invalid constraints
            for (const constraint of constraintsToRemove) {
                try {
                    World.remove(this.world, constraint);
                } catch (e) {
                    // Ignore errors during cleanup
                }
            }
        }

        try {
            Engine.update(this.engine, safeDeltaTime);
        } catch (error) {
            // Silently handle errors when tab is hidden (common issue)
            if (!document.hidden) {
                console.error('Physics engine update error:', error);
            }
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
