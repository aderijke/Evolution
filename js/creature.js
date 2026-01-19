/**
 * Creature Module - Physical representation of a creature built from DNA
 * 
 * Handles physics bodies, motor control, sticky feet locomotion, and state
 */

const Matter = window.Matter;
const { Bodies, Body, Composite, Constraint, Vector } = Matter;

// State constants
export const CreatureState = {
    ALIVE: 'alive',
    DEAD: 'dead'
};

/**
 * Creature class - builds and manages a creature from DNA
 */
export class Creature {
    constructor(dna, world, startX, startY, id) {
        this.id = id;
        this.dna = dna;
        this.world = world;

        // State
        this.state = CreatureState.ALIVE;
        this.food = 100; // Food level - decreases slowly, creature dies when empty
        this.health = 100; // Health level - only decreases from combat damage
        this.age = 0;
        this.fadeAlpha = 1.0;
        this.canDestroy = false;
        this.deathTime = 0;
        this.lastReproductionTime = 0; // Track when creature last reproduced

        // Fitness tracking
        this.startPosition = { x: startX, y: startY };
        this.lastDistanceFromStart = 0; // Track distance from start for movement reward
        this.damageDealt = 0;
        this.damageTaken = 0;
        this.kills = 0;

        // Physics components
        this.bodies = [];
        this.constraints = [];
        this.composite = Composite.create();

        // Sensors
        this.sensors = [];
        this.sensorReadings = []; // Current sensor activations (0-1)
        this.otherCreatures = []; // Reference to other creatures for sensing

        // Simulation time tracking for motor oscillation
        this.simTime = 0;
        this.memory = new Array(this.dna.memorySize || 0).fill(0);

        // Build the creature
        this.build(startX, startY);

        // Add to physics world
        Composite.add(world, this.composite);
    }

    /**
     * Set reference to other creatures for sensor detection
     */
    setOtherCreatures(creatures) {
        this.otherCreatures = creatures.filter(c => c.id !== this.id);
    }

    /**
     * Build physics bodies and constraints from DNA
     */
    /**
     * Build physics bodies and constraints from DNA
     */
    build(startX, startY) {
        const { segments, joints, sensors } = this.dna;

        // Create bodies for each segment
        // We use a map to keep track of segment positions for branched building
        const segmentPositions = new Map();

        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            let body;

            let x = startX;
            let y = startY;

            // If it has a parent, position it relative to the parent
            if (seg.parentId !== null && segmentPositions.has(seg.parentId)) {
                const parentPos = segmentPositions.get(seg.parentId);
                const parentSeg = segments[seg.parentId];
                const angle = seg.attachAngle || 0;

                // Offset based on parent shape
                const offset = (parentSeg.shape === 'circle' ? parentSeg.radius : parentSeg.length / 2) + 20;
                x = parentPos.x + Math.sin(angle) * offset;
                y = parentPos.y + Math.cos(angle) * offset;
            } else {
                // Root segment or fallback
                y += i * 40;
            }

            if (seg.shape === 'circle') {
                body = Bodies.circle(x, y, seg.radius, {
                    friction: 0.8,
                    frictionAir: 0.02,
                    restitution: 0.2,
                    density: seg.mass / (Math.PI * seg.radius * seg.radius),
                    label: `creature_${this.id}_seg_${seg.id}`,
                    render: { fillStyle: this.getRGBString(seg.color) }
                });
            } else {
                body = Bodies.rectangle(x, y, seg.width, seg.length, {
                    friction: 0.8,
                    frictionAir: 0.02,
                    restitution: 0.2,
                    density: seg.mass / (seg.width * seg.length),
                    label: `creature_${this.id}_seg_${seg.id}`,
                    render: { fillStyle: this.getRGBString(seg.color) }
                });
            }

            // Store metadata on body for collision detection
            body.creatureId = this.id;
            body.segmentData = seg;
            body.creature = this;

            this.bodies.push(body);
            segmentPositions.set(seg.id, { x: body.position.x, y: body.position.y });
            Composite.add(this.composite, body);
        }

        // Create constraints for each joint
        for (const joint of joints) {
            const bodyA = this.bodies[joint.segA];
            const bodyB = this.bodies[joint.segB];

            if (!bodyA || !bodyB) continue;

            const constraint = Constraint.create({
                bodyA,
                bodyB,
                pointA: { x: joint.attachPointA[0], y: joint.attachPointA[1] },
                pointB: { x: joint.attachPointB[0], y: joint.attachPointB[1] },
                length: joint.restLength,
                stiffness: joint.stiffness,
                damping: 0.1,
                label: `creature_${this.id}_joint`,
                render: { visible: false }
            });

            // Store motor pattern reference
            constraint.motorPattern = joint.motorPattern;
            constraint.baseLength = joint.restLength;
            constraint.minLength = joint.minLength;
            constraint.maxLength = joint.maxLength;
            // Store base values for sensor modulation
            constraint.baseAmplitude = joint.motorPattern.amplitude;
            constraint.baseFrequency = joint.motorPattern.frequency;
            constraint.basePhase = joint.motorPattern.phase;

            this.constraints.push(constraint);
            Composite.add(this.composite, constraint);
        }

        // Initialize sensors
        if (sensors) {
            for (let i = 0; i < sensors.length; i++) {
                const sensorDNA = sensors[i];
                this.sensors.push({
                    ...sensorDNA,
                    body: this.bodies[sensorDNA.segmentId] || this.bodies[0],
                    activation: 0
                });
                this.sensorReadings[i] = 0;
            }
        }
    }

    /**
     * Update creature - sensors, motor oscillation and sticky feet
     * @param {number} deltaTime - Time since last update (seconds)
     */
    update(deltaTime) {
        if (this.state === CreatureState.DEAD) {
            this.deathTime += deltaTime;
            if (this.deathTime > 2) { // Wait 2 seconds before fading
                this.fadeAlpha -= deltaTime * 0.5; // Fade over 2 seconds
                if (this.fadeAlpha <= 0) {
                    this.fadeAlpha = 0;
                    this.canDestroy = true;
                }
            }
            return;
        }

        this.simTime += deltaTime;
        this.age += deltaTime;

        // Food decreases slowly - takes exactly 1 hour (3600 seconds) to go from 100 to 0
        // Base consumption: 100 food / 3600 seconds = 0.02778 food per second
        const HOUR_IN_SECONDS = 3600;
        const baseFoodConsumption = 100 / HOUR_IN_SECONDS; // 0.02778 per second
        
        // Food decreases at constant rate (1 hour to empty)
        // No food reward for movement - creatures must find power-ups to survive
        this.food -= baseFoodConsumption * deltaTime;

        // Handle starvation - die when food reaches 0
        if (this.food <= 0) {
            this.food = 0; // Cap at 0
            this.die(null, 'starvation'); // Die from starvation
            return;
        }

        // Clean up invalid constraints before using them
        this.constraints = this.constraints.filter(c => {
            if (!c || !c.id) return false;
            if (!c.bodyA || !c.bodyA.id || !c.bodyB || !c.bodyB.id) return false;
            return true;
        });

        // Update sensors
        this.updateSensors();

        // Apply sensor modulation to motors
        this.modulateMotors();

        // Update motor oscillations
        this.updateMotors();

        // Update sticky feet friction
        this.updateStickyFeet();

        // Update memory (leaky integrator or state storage)
        if (this.memory.length > 0) {
            for (let i = 0; i < this.memory.length; i++) {
                // Memory is influenced by sensors and its own previous state
                let contrib = 0;
                for (let s = 0; s < this.sensors.length; s++) {
                    contrib += this.sensorReadings[s] * (i + 1) * 0.1;
                }
                this.memory[i] = this.memory[i] * 0.95 + contrib * 0.05;
            }
        }

        // Grabber logic: attract powerups if near a gripper limb
        this.updateGrippers();
    }

    /**
     * Update gripper segments - attract nearby powerups
     */
    updateGrippers() {
        for (const body of this.bodies) {
            if (body.segmentData?.isGripper) {
                // This segment is a gripper, simplified 'grabbing' - high friction for powerups
                // but actually we'll use main.js to check proximity or just apply a force here
            }
        }
    }

    /**
     * Update all sensors - detect nearby creatures
     */
    updateSensors() {
        for (let i = 0; i < this.sensors.length; i++) {
            const sensor = this.sensors[i];
            const reading = this.readSensor(sensor);
            this.sensorReadings[i] = reading;
            sensor.activation = reading; // Store for rendering
        }
    }

    /**
     * Read a single sensor - returns activation 0-1
     * Activation is enhanced by beauty of detected creatures (mate attraction)
     */
    readSensor(sensor) {
        if (!sensor.body) return 0;

        const sensorPos = sensor.body.position;
        const sensorAngle = sensor.body.angle + sensor.angle;

        let closestDistance = sensor.range;
        let bestBeauty = 0;
        let detected = false;

        for (const other of this.otherCreatures) {
            if (!other.isAlive()) continue;

            const otherPos = other.getCenterPosition();
            const dx = otherPos.x - sensorPos.x;
            const dy = otherPos.y - sensorPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > sensor.range) continue;

            let inRange = false;
            if (sensor.type === 'eye') {
                // Eye sensor: check if target is within field of view
                const angleToTarget = Math.atan2(dy, dx);
                let angleDiff = angleToTarget - sensorAngle;
                // Normalize angle difference
                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

                const halfFov = (sensor.fov * Math.PI / 180) / 2;
                if (Math.abs(angleDiff) <= halfFov) {
                    inRange = true;
                }
            } else {
                // Feeler sensor: simple proximity check
                inRange = true;
            }

            if (inRange && distance < closestDistance) {
                closestDistance = distance;
                // Track beauty of closest detected creature for mate attraction
                bestBeauty = other.dna.beauty || 0.5;
                detected = true;
            }
        }

        if (!detected) return 0;

        // Base activation: closer = higher activation (1 at contact, 0 at max range)
        const baseActivation = 1 - (closestDistance / sensor.range);
        
        // Enhance activation based on beauty (mate attraction)
        // Beautiful creatures produce stronger sensor signals (up to 30% boost)
        const beautyBoost = 1.0 + (bestBeauty * 0.3);
        
        return Math.min(1.0, baseActivation * beautyBoost);
    }

    /**
     * Modulate motor parameters based on sensor readings
     */
    modulateMotors() {
        const weights = this.dna.sensorMotorWeights;
        if (!weights || weights.length === 0) return;

        for (let j = 0; j < this.constraints.length; j++) {
            const constraint = this.constraints[j];
            // Validate constraint and its body references
            if (!constraint || !constraint.id || !constraint.bodyA || !constraint.bodyB) {
                continue;
            }
            // Check if bodies are still valid
            if (!constraint.bodyA.id || !constraint.bodyB.id) {
                continue;
            }
            const mp = constraint.motorPattern;
            if (!mp) continue;

            // Start with base values
            let ampMod = 0;
            let freqMod = 0;
            let phaseMod = 0;

            // Sum contributions from all sensors
            for (let s = 0; s < this.sensors.length; s++) {
                const activation = this.sensorReadings[s];
                if (activation > 0 && weights[s] && weights[s][j]) {
                    const w = weights[s][j];
                    ampMod += activation * w.amplitudeMod;
                    freqMod += activation * w.frequencyMod;
                    phaseMod += activation * w.phaseMod;
                }
            }

            // Apply modulations to motor pattern
            mp.amplitude = Math.max(0, Math.min(20, constraint.baseAmplitude + ampMod * 5));
            mp.frequency = Math.max(0.1, Math.min(5, constraint.baseFrequency + freqMod));
            mp.phase = constraint.basePhase + phaseMod * Math.PI;
        }
    }

    /**
     * Update motor oscillations - change constraint lengths
     */
    updateMotors() {
        for (const constraint of this.constraints) {
            // Validate constraint and its body references
            if (!constraint || !constraint.id || !constraint.bodyA || !constraint.bodyB) {
                continue;
            }
            // Check if bodies are still valid
            if (!constraint.bodyA.id || !constraint.bodyB.id) {
                continue;
            }
            const mp = constraint.motorPattern;
            if (!mp) continue;

            // Calculate target length using sinusoidal oscillation
            const oscillation = mp.amplitude * Math.sin(
                2 * Math.PI * mp.frequency * this.simTime + mp.phase
            );

            // Set new length, clamped to min/max
            const targetLength = constraint.baseLength + oscillation;
            constraint.length = Math.max(
                constraint.minLength,
                Math.min(constraint.maxLength, targetLength)
            );
        }
    }

    /**
     * Implement sticky feet locomotion
     * Alternate friction on segments based on motor phase
     */
    updateStickyFeet() {
        if (this.constraints.length === 0) return;

        // Use first constraint's motor phase to determine sticky pattern
        const mp = this.constraints[0].motorPattern;
        if (!mp) return;

        const phase = (2 * Math.PI * mp.frequency * this.simTime + mp.phase) % (2 * Math.PI);
        const extending = Math.cos(phase) > 0; // Extending when cos > 0

        // Toggle friction on first and last segments (front/back feet)
        for (let i = 0; i < this.bodies.length; i++) {
            const body = this.bodies[i];
            const isFirst = i === 0;
            const isLast = i === this.bodies.length - 1;

            if (isFirst || isLast) {
                // Sticky feet logic: alternate grip based on extension phase
                const shouldBeSticky = isFirst ? !extending : extending;
                body.friction = shouldBeSticky ? 0.95 : 0.1;
                body.frictionStatic = shouldBeSticky ? 1.0 : 0.05;
            }
        }
    }

    /**
     * Restore health and/or food to the creature
     * @param {number} amount - Amount to restore
     */
    restoreHealth(amount) {
        if (this.state === CreatureState.DEAD) return;
        // Power-ups restore both food and health
        this.food = Math.min(200, this.food + amount);
        this.health = Math.min(200, this.health + amount);
        this.powerUpsCollected = (this.powerUpsCollected || 0) + 1;
    }

    /**
     * Apply damage to creature (only affects health, not food)
     * @param {number} amount - Damage amount
     * @param {Creature} attacker - Attacking creature (optional)
     */
    takeDamage(amount, attacker = null) {
        if (this.state === CreatureState.DEAD) return;

        // Damage only affects health, not food
        this.health -= amount;
        this.damageTaken += amount;

        if (attacker) {
            attacker.damageDealt += amount;
            // Log damage event
            if (window.simulation && window.simulation.onDamageDealt) {
                window.simulation.onDamageDealt(attacker, this, amount);
            }
        }

        // Check for death
        if (this.health <= 0) {
            this.health = 0; // Cap at 0
            this.die(attacker, 'combat');
        }
    }

    /**
     * Kill the creature
     * @param {Creature} killer - The killing creature (optional)
     * @param {string} cause - Cause of death ('starvation' or 'combat')
     */
    die(killer = null, cause = 'combat') {
        // Prevent multiple death events
        if (this.state === CreatureState.DEAD) {
            return;
        }

        this.state = CreatureState.DEAD;
        this.food = 0;
        this.health = 0;
        this.deathTime = 0;
        this.deathCause = cause; // Store cause of death

        if (killer) {
            killer.kills++;
            // Restore killer to full health and food
            killer.health = 200; // Max health
            killer.food = 200; // Max food
        }

        // Visual feedback - gray out and prepare to fade
        for (const body of this.bodies) {
            body.friction = 0.5;
            body.frictionAir = 0.2;
        }

        // Trigger death event for logging
        if (window.simulation && window.simulation.onCreatureDeath) {
            window.simulation.onCreatureDeath(this, killer, cause);
        }
    }

    /**
     * Calculate fitness score
     * @returns {number} Fitness value
     */
    calculateFitness() {
        // Distance traveled from start
        const centerPos = this.getCenterPosition();
        const distance = Math.sqrt(
            Math.pow(centerPos.x - this.startPosition.x, 2) +
            Math.pow(centerPos.y - this.startPosition.y, 2)
        );

        // Fitness formula
        const fitness =
            distance * 1.0 +           // Reward movement
            this.kills * 100 +          // Big bonus for kills
            this.damageDealt * 0.5 -    // Reward aggression
            this.damageTaken * 0.3;     // Penalize taking damage

        return Math.max(0, fitness);
    }

    /**
     * Get center position of creature
     * @returns {{x: number, y: number}}
     */
    getCenterPosition() {
        if (this.bodies.length === 0) return this.startPosition;

        let totalMass = 0;
        let centerX = 0;
        let centerY = 0;

        for (const body of this.bodies) {
            centerX += body.position.x * body.mass;
            centerY += body.position.y * body.mass;
            totalMass += body.mass;
        }

        return {
            x: centerX / totalMass,
            y: centerY / totalMass
        };
    }

    /**
     * Get the mouth position (for combat detection)
     */
    getMouthPosition() {
        for (let i = this.bodies.length - 1; i >= 0; i--) {
            if (this.bodies[i].segmentData?.isMouth) {
                return this.bodies[i].position;
            }
        }
        return this.bodies[this.bodies.length - 1]?.position || { x: 0, y: 0 };
    }

    /**
     * Get the heart position (for combat detection)
     */
    getHeartPosition() {
        for (const body of this.bodies) {
            if (body.segmentData?.isHeart) {
                return body.position;
            }
        }
        return this.bodies[0]?.position || { x: 0, y: 0 };
    }

    /**
     * Remove creature from physics world
     */
    destroy() {
        if (!this.composite || !this.world) {
            // Already destroyed or invalid
            this.constraints = [];
            this.bodies = [];
            this.composite = null;
            return;
        }
        
        try {
            // Check if composite is still in world before removing
            const compositeInWorld = this.world.composites && 
                this.world.composites.some(c => c && c.id === this.composite.id);
            
            if (!compositeInWorld) {
                // Already removed, just clear references
                this.constraints = [];
                this.bodies = [];
                this.composite = null;
                return;
            }

            // Remove constraints first, one by one, to avoid orphaned references
            if (this.constraints && this.constraints.length > 0) {
                const constraintsToRemove = [...this.constraints];
                for (const constraint of constraintsToRemove) {
                    if (constraint && constraint.id) {
                        try {
                            // Check if constraint is still in world
                            const constraintInWorld = this.world.constraints && 
                                this.world.constraints.some(c => c && c.id === constraint.id);
                            if (constraintInWorld) {
                                World.remove(this.world, constraint);
                            }
                        } catch (e) {
                            // Ignore individual constraint removal errors
                        }
                    }
                }
            }
            
            // Remove bodies one by one
            if (this.bodies && this.bodies.length > 0) {
                const bodiesToRemove = [...this.bodies];
                for (const body of bodiesToRemove) {
                    if (body && body.id) {
                        try {
                            // Check if body is still in world
                            const bodyInWorld = this.world.bodies && 
                                this.world.bodies.some(b => b && b.id === body.id);
                            if (bodyInWorld) {
                                World.remove(this.world, body);
                            }
                        } catch (e) {
                            // Ignore individual body removal errors
                        }
                    }
                }
            }
            
            // Finally remove composite (should be empty now)
            try {
                Composite.remove(this.world, this.composite);
            } catch (e) {
                // Composite might already be empty/removed
            }
            
            // Clear references immediately
            this.constraints = [];
            this.bodies = [];
            this.composite = null;
        } catch (error) {
            console.warn('Error destroying creature:', error);
            // Force clear references even if removal fails
            this.constraints = [];
            this.bodies = [];
            this.composite = null;
        }
    }

    /**
     * Convert RGB array to CSS string
     */
    getRGBString(color) {
        return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    }

    /**
     * Check if creature is alive
     */
    isAlive() {
        return this.state !== CreatureState.DEAD;
    }
}

export default Creature;
