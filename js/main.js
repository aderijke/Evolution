/**
 * Main Module - Entry point and simulation orchestration
 * 
 * Coordinates physics, creatures, evolution, rendering, and UI
 */

import { PhysicsManager } from './physics.js';
import { EvolutionManager } from './evolution.js';
import { WebGLRenderer as Renderer } from './webgl-renderer.js';
import { UIManager } from './ui.js';
import { Creature } from './creature.js';
import { mutateDNA, crossoverDNA } from './dna.js';
import { exportDNA, saveToHallOfFame } from './storage.js';
import { PowerUp } from './powerup.js';

// Configuration
const CONFIG = {
    // Initial sizes are placeholders, will be updated on load/resize
    populationSize: 30,
    maxPowerUps: 2, // Always maintain 2 power-ups
    physicsTimestep: 1000 / 60 // 60 Hz
};

/**
 * Main Simulation class
 */
class Simulation {
    constructor() {
        // Get canvas
        this.canvas = document.getElementById('simulation-canvas');

        // Set initial dimensions based on container
        this.updateCanvasDimensions();

        // Get actual display dimensions (without device pixel ratio)
        const rect = this.canvas.getBoundingClientRect();
        const displayWidth = rect.width;
        const displayHeight = rect.height;

        // Initialize managers with display dimensions
        this.physics = new PhysicsManager(displayWidth, displayHeight);
        this.evolution = new EvolutionManager();
        this.renderer = new Renderer(this.canvas);
        
        // Immediately resize renderer to ensure correct dimensions
        this.renderer.resize(displayWidth, displayHeight);
        
        this.ui = new UIManager();

        // State
        this.running = false;
        this.totalTime = 0; // Total simulation time (continues across generations)
        this.speedMultiplier = 1;
        this.creatures = [];
        this.powerUps = [];
        this.lastFrameTime = 0;
        this.nextCreatureId = 0;
        this.nextPowerUpId = 0;

        // Set up UI callbacks
        this.setupUICallbacks();

        // Initialize first generation
        this.initGeneration();

        // Set up event logging
        this.setupEventLogging();

        // Canvas click for selection
        this.canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.handleCanvasClick(e);
        });
        
        // Also handle pointer events for better compatibility
        this.canvas.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.handleCanvasClick(e);
        });

        // Window resize
        window.addEventListener('resize', () => this.handleResize());
        
        // Force an initial resize to ensure everything is correct
        setTimeout(() => {
            this.handleResize();
        }, 50);
    }

    /**
     * Update canvas dimensions based on CSS layout
     */
    updateCanvasDimensions() {
        // Force a layout recalculation
        void this.canvas.offsetHeight;
        const rect = this.canvas.getBoundingClientRect();
        
        // Ensure we have valid dimensions
        const width = Math.max(1, rect.width || 800);
        const height = Math.max(1, rect.height || 600);
        
        // Use device pixel ratio for crisp rendering
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        
        // Scale the canvas context back down
        if (this.canvas.style) {
            this.canvas.style.width = width + 'px';
            this.canvas.style.height = height + 'px';
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        this.updateCanvasDimensions();

        // Get actual display dimensions (without device pixel ratio)
        const rect = this.canvas.getBoundingClientRect();
        const displayWidth = rect.width;
        const displayHeight = rect.height;

        // Update managers with display dimensions
        if (this.physics) this.physics.resize(displayWidth, displayHeight);
        if (this.renderer) this.renderer.resize(displayWidth, displayHeight);

        // Re-draw if not running
        if (!this.running) {
            this.render();
        }
    }

    /**
     * Handle canvas click for creature selection
     */
    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        
        // Get mouse position in canvas coordinates
        // PixiJS with autoDensity uses display coordinates, so we use display coords
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Find creature under mouse by checking if click is inside any body segment
        let selected = null;
        let closestDistance = Infinity;
        let closestCreature = null;
        
        for (const c of this.creatures) {
            if (!c.isAlive()) continue;
            
            // Check each body segment for hit
            for (const body of c.bodies) {
                const seg = body.segmentData;
                if (!seg) continue;
                
                // Get body position in display coordinates (PixiJS uses display coords)
                const bodyX = body.position.x;
                const bodyY = body.position.y;
                
                // Transform mouse position to body's local coordinate system
                const dx = mouseX - bodyX;
                const dy = mouseY - bodyY;
                
                // Rotate point back to body's local space
                const cos = Math.cos(-body.angle);
                const sin = Math.sin(-body.angle);
                const localX = dx * cos - dy * sin;
                const localY = dx * sin + dy * cos;
                
                let hit = false;
                let distance = 0;
                
                if (seg.shape === 'circle') {
                    // Circle: check if point is within radius
                    distance = Math.sqrt(localX * localX + localY * localY);
                    hit = distance <= seg.radius;
                } else {
                    // Rectangle: check if point is within bounds
                    const halfWidth = seg.width / 2;
                    const halfLength = seg.length / 2;
                    const inBounds = Math.abs(localX) <= halfWidth && Math.abs(localY) <= halfLength;
                    
                    if (inBounds) {
                        hit = true;
                        distance = 0; // Inside rectangle
                    } else {
                        // Calculate distance to rectangle edge for closest selection
                        const closestX = Math.max(-halfWidth, Math.min(halfWidth, localX));
                        const closestY = Math.max(-halfLength, Math.min(halfLength, localY));
                        distance = Math.sqrt((localX - closestX) ** 2 + (localY - closestY) ** 2);
                    }
                }
                
                if (hit) {
                    // If hit, select immediately
                    selected = c;
                    break;
                } else if (distance < closestDistance && distance < 50) {
                    // Track closest creature within reasonable range (fallback)
                    closestDistance = distance;
                    closestCreature = c;
                }
            }
            
            if (selected) break;
        }

        // Use closest creature if no direct hit (for easier clicking)
        if (!selected && closestCreature) {
            selected = closestCreature;
        }

        this.ui.selectCreature(selected);
    }

    /**
     * Set up UI event handlers
     */
    setupUICallbacks() {
        this.ui.on('onStart', () => this.start());
        this.ui.on('onPause', () => this.pause());
        this.ui.on('onReset', () => this.reset());
        this.ui.on('onSpeedChange', (speed) => {
            this.speedMultiplier = speed;
        });
        this.ui.on('onPopulationChange', (size) => {
            this.evolution.setPopulationSize(size);
        });
        this.ui.on('onExport', () => this.exportBestDNA());
        this.ui.on('onImport', (dna) => this.importDNA(dna));
    }

    /**
     * Set up page visibility handling (simulation continues in background)
     */
    setupVisibilityHandling() {
        // Simulation continues in background - no pause on tab hide
        // DeltaTime capping prevents issues with large time steps
    }

    /**
     * Initialize a new generation (first generation only)
     */
    initGeneration() {
        // Clear previous generation
        this.physics.clearCreatures();
        this.creatures = [];

        // Clear and reset power-ups
        for (const p of this.powerUps) p.destroy();
        this.powerUps = [];
        this.spawnInitialPowerUps();

        // Regenerate obstacles
        this.physics.createObstacles(5 + Math.floor(Math.random() * 5));

        // Don't reset time - it continues across generations

        // Generate or evolve population
        if (this.evolution.getGeneration() === 0) {
            this.evolution.initializePopulation();
        }

        // Spawn creatures from population DNA
        const population = this.evolution.getPopulation();
        const rect = this.canvas.getBoundingClientRect();
        const displayWidth = rect.width;
        const displayHeight = rect.height;
        const margin = 150; // Increased margin for large branched creatures
        const areaWidth = displayWidth - margin * 2;
        const areaHeight = displayHeight - margin * 2;

        for (let i = 0; i < population.length; i++) {
            const dna = population[i];

            // Random spawn position within arena
            const x = margin + Math.random() * areaWidth;
            const y = margin + Math.random() * areaHeight;

            const creature = new Creature(
                dna,
                this.physics.getWorld(),
                x, y,
                this.nextCreatureId++
            );

            this.physics.registerCreature(creature);
            this.creatures.push(creature);
            
            // Log birth event
            this.ui.addLogEntry(`Wezen #${creature.id} is geboren`, 'birth');
        }

        // Update UI
        this.updateUI();
    }

    /**
     * Add new creatures to the generation, keeping elite creatures alive
     * @param {Creature[]} eliteCreatures - Elite creatures to keep alive
     */
    addNewCreaturesToGeneration(eliteCreatures) {
        // Update DNA references for elite creatures to match new generation DNA
        const population = this.evolution.getPopulation();
        const eliteDNA = population.slice(0, eliteCreatures.length);
        
        // Update elite creatures' DNA references to point to new generation DNA
        for (let i = 0; i < eliteCreatures.length && i < eliteDNA.length; i++) {
            eliteCreatures[i].dna = eliteDNA[i];
        }

        // Clear and reset power-ups
        for (const p of this.powerUps) p.destroy();
        this.powerUps = [];
        this.spawnInitialPowerUps();

        // Regenerate obstacles
        this.physics.createObstacles(5 + Math.floor(Math.random() * 5));

        // Spawn only NEW creatures (skip elite count)
        const rect = this.canvas.getBoundingClientRect();
        const displayWidth = rect.width;
        const displayHeight = rect.height;
        const margin = 150;
        const areaWidth = displayWidth - margin * 2;
        const areaHeight = displayHeight - margin * 2;

        // Start from eliteCount to skip elite DNA (they're already on screen)
        for (let i = eliteCreatures.length; i < population.length; i++) {
            const dna = population[i];

            // Random spawn position within arena
            const x = margin + Math.random() * areaWidth;
            const y = margin + Math.random() * areaHeight;

            const creature = new Creature(
                dna,
                this.physics.getWorld(),
                x, y,
                this.nextCreatureId++
            );

            this.physics.registerCreature(creature);
            this.creatures.push(creature);
            
            // Log birth event
            this.ui.addLogEntry(`Wezen #${creature.id} is geboren`, 'birth');
        }

        // Update UI
        this.updateUI();
    }

    /**
     * Start the simulation
     */
    start() {
        if (this.running) return;
        this.running = true;
        this.ui.setRunning(true);
        this.lastFrameTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    /**
     * Pause the simulation
     */
    pause() {
        this.running = false;
        this.ui.setRunning(false);
    }

    /**
     * Reset the simulation
     */
    reset() {
        this.pause();
        this.evolution = new EvolutionManager({
            populationSize: this.ui.getPopulationSize()
        });
        this.nextCreatureId = 0;
        this.initGeneration();
    }

    /**
     * Main simulation loop
     */
    loop(timestamp) {
        if (!this.running) return;

        // Calculate delta time
        const deltaTime = timestamp - this.lastFrameTime;
        this.lastFrameTime = timestamp;

        // Cap delta time to prevent issues when tab becomes active again
        // Max 100ms per frame (equivalent to 10fps minimum)
        // This allows simulation to continue in background safely
        const cappedDeltaTime = Math.min(deltaTime, 100);

        // Apply speed multiplier using sub-stepping for stability
        // We cap the delta per physics step to ~16ms to prevent tunneling
        // but run multiple steps if the speed multiplier is high.
        const baseDelta = 16.666; // Standard 60fps frame time
        const totalSimTime = cappedDeltaTime * this.speedMultiplier;
        const numSubSteps = Math.ceil(this.speedMultiplier);
        const subStepDelta = totalSimTime / numSubSteps;

        for (let s = 0; s < numSubSteps; s++) {
            // Provide other creatures references for sensors (once per sub-step is enough, or even once per frame)
            if (s === 0) {
                for (const creature of this.creatures) {
                    if (creature.isAlive()) {
                        creature.setOtherCreatures(this.creatures);
                    }
                }
            }

            // Update physics
            this.physics.update(subStepDelta);

            // Update power-ups
            if (s === 0) {
                this.updatePowerUps();
                for (const p of this.powerUps) {
                    p.update(this.creatures);

                    // Gripper attraction
                    for (const c of this.creatures) {
                        if (!c.isAlive()) continue;
                        for (const body of c.bodies) {
                            if (body.segmentData?.isGripper) {
                                const dx = body.position.x - p.body.position.x;
                                const dy = body.position.y - p.body.position.y;
                                const distSq = dx * dx + dy * dy;
                                if (distSq < 100 * 100) {
                                    const force = 0.0002;
                                    Matter.Body.applyForce(p.body, p.body.position, {
                                        x: dx * force,
                                        y: dy * force
                                    });
                                }
                            }
                        }
                    }
                }
            }

            // Remove creatures that are faded out (only check once per sub-step or once per frame)
            if (s === 0) {
                for (let i = this.creatures.length - 1; i >= 0; i--) {
                    const creature = this.creatures[i];
                    if (creature && creature.canDestroy) {
                        try {
                            this.physics.unregisterCreature(creature);
                            creature.destroy();
                            this.creatures.splice(i, 1);
                        } catch (error) {
                            console.warn('Error removing creature:', error);
                            // Force remove even if destroy fails
                            this.creatures.splice(i, 1);
                        }
                    }
                }
            }

            // Track total simulation time (continues across generations)
            this.totalTime += subStepDelta / 1000;
        }

        // Check for reproduction during generation (once per frame, not per sub-step)
        this.checkReproduction();

        // Automatic generation cycle - trigger when only 2 creatures remain
        const livingCount = this.creatures.filter(c => c.isAlive()).length;
        if (livingCount <= 2 || this.allDead()) {
            this.endGeneration();
        }

        // Render
        this.render();

        // Update UI
        this.updateUI();

        // Continue loop
        requestAnimationFrame((t) => this.loop(t));
    }

    /**
     * Check if all creatures are dead
     */
    allDead() {
        return this.creatures.every(c => !c.isAlive());
    }

    /**
     * End current generation and evolve
     */
    endGeneration() {
        // Calculate fitness for all creatures
        this.evolution.updateFitness(this.creatures);

        // Get elite creatures (top 2) that will survive to next generation
        const sorted = [...this.creatures]
            .filter(c => c.isAlive())
            .sort((a, b) => (b.dna.fitness || 0) - (a.dna.fitness || 0));
        const eliteCreatures = sorted.slice(0, Math.min(2, sorted.length));

        // Remove dead creatures from the array (but keep elite alive ones)
        for (let i = this.creatures.length - 1; i >= 0; i--) {
            const creature = this.creatures[i];
            if (!creature.isAlive() || !eliteCreatures.includes(creature)) {
                // Remove dead creatures and non-elite creatures
                if (creature.canDestroy || !eliteCreatures.includes(creature)) {
                    try {
                        this.physics.unregisterCreature(creature);
                        creature.destroy();
                        this.creatures.splice(i, 1);
                    } catch (error) {
                        console.warn('Error removing creature:', error);
                        this.creatures.splice(i, 1);
                    }
                }
            }
        }

        // Evolve next generation (pass creatures so age can be looked up if needed)
        // This will create new DNA for the population, but we'll keep elite creatures
        this.evolution.evolveNextGeneration(this.creatures, eliteCreatures);

        // Add new creatures to the existing elite creatures
        this.addNewCreaturesToGeneration(eliteCreatures);
    }

    /**
     * Render the current frame
     */
    render() {
        this.renderer.clear();
        this.renderer.renderObstacles(this.physics.obstacles);
        this.renderer.renderCreatures(this.creatures);
        this.renderer.renderPowerUps(this.powerUps);
        this.renderer.updateEffects(1 / 60);
    }

    /**
     * Export DNA of the best currently alive creature
     */
    exportBestDNA() {
        if (this.creatures.length === 0) return;

        // Find best creature by fitness
        const sorted = [...this.creatures].sort((a, b) => b.calculateFitness() - a.calculateFitness());
        const best = sorted[0];

        if (best) {
            exportDNA(best.dna);
            saveToHallOfFame(best.dna);
        }
    }

    /**
     * Import DNA and start a new generation with it
     */
    importDNA(dna) {
        this.pause();

        // Create new population starting with this DNA
        this.evolution.population = [];
        for (let i = 0; i < this.evolution.populationSize; i++) {
            this.evolution.population.push(i === 0 ? dna : mutateDNA(dna, 0.2));
        }

        this.evolution.generation = dna.generation || 0;
        this.initGeneration();
        this.start();
    }

    /**
     * Spawn initial set of power-ups
     */
    spawnInitialPowerUps() {
        for (let i = 0; i < CONFIG.maxPowerUps; i++) {
            this.spawnPowerUp();
        }
    }

    /**
     * Spawn a single power-up at random location
     */
    spawnPowerUp() {
        const rect = this.canvas.getBoundingClientRect();
        const displayWidth = rect.width;
        const displayHeight = rect.height;
        const margin = 100;
        const x = margin + Math.random() * (displayWidth - margin * 2);
        const y = margin + Math.random() * (displayHeight - margin * 2);

        // Randomly choose type: 80% regular health, 20% super health
        const type = Math.random() > 0.8 ? 'super' : 'health';

        const powerUp = new PowerUp(this.physics.getWorld(), x, y, this.nextPowerUpId++, type);
        this.powerUps.push(powerUp);
    }

    /**
     * Update power-ups state (replenish if collected)
     */
    updatePowerUps() {
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            if (this.powerUps[i].collected) {
                this.powerUps.splice(i, 1);
                this.spawnPowerUp(); // Maintain always 2
            }
        }
    }

    /**
     * Set up event logging handlers
     */
    setupEventLogging() {
        // These will be called from creature.js
        this.onCreatureDeath = (creature, killer, cause) => {
            const creatureName = `Wezen #${creature.id}`;
            if (cause === 'starvation') {
                this.ui.addLogEntry(`${creatureName} is verhongerd`, 'starvation');
            } else if (killer) {
                const killerName = `Wezen #${killer.id}`;
                this.ui.addLogEntry(`${killerName} heeft ${creatureName} vermoord`, 'kill');
            } else {
                this.ui.addLogEntry(`${creatureName} is overleden`, 'death');
            }
        };

        this.onDamageDealt = (attacker, victim, amount) => {
            const attackerName = `Wezen #${attacker.id}`;
            const victimName = `Wezen #${victim.id}`;
            this.ui.addLogEntry(`${attackerName} heeft ${amount.toFixed(1)} schade toegebracht aan ${victimName}`, 'damage');
        };
    }

    /**
     * Update UI stats
     */
    /**
     * Check for reproduction between creatures during generation
     */
    checkReproduction() {
        const REPRODUCTION_DISTANCE = 80; // Distance for reproduction
        const MIN_AGE_FOR_REPRODUCTION = 30; // Minimum age in seconds
        const MIN_FOOD_FOR_REPRODUCTION = 50; // Minimum food level
        const MIN_HEALTH_FOR_REPRODUCTION = 50; // Minimum health level
        const REPRODUCTION_COOLDOWN = 60; // Cooldown in seconds between reproductions
        const MAX_POPULATION = 100; // Maximum population size

        const aliveCreatures = this.creatures.filter(c => c.isAlive());
        
        // Don't reproduce if population is too large
        if (aliveCreatures.length >= MAX_POPULATION) {
            return;
        }

        // Check all pairs of creatures
        for (let i = 0; i < aliveCreatures.length; i++) {
            const creature1 = aliveCreatures[i];
            
            // Check if creature1 can reproduce
            if (creature1.age < MIN_AGE_FOR_REPRODUCTION) continue;
            if (creature1.food < MIN_FOOD_FOR_REPRODUCTION) continue;
            if (creature1.health < MIN_HEALTH_FOR_REPRODUCTION) continue;
            if (this.totalTime - creature1.lastReproductionTime < REPRODUCTION_COOLDOWN) continue;

            for (let j = i + 1; j < aliveCreatures.length; j++) {
                const creature2 = aliveCreatures[j];
                
                // Check if creature2 can reproduce
                if (creature2.age < MIN_AGE_FOR_REPRODUCTION) continue;
                if (creature2.food < MIN_FOOD_FOR_REPRODUCTION) continue;
                if (creature2.health < MIN_HEALTH_FOR_REPRODUCTION) continue;
                if (this.totalTime - creature2.lastReproductionTime < REPRODUCTION_COOLDOWN) continue;

                // Check distance between creatures
                const pos1 = creature1.getCenterPosition();
                const pos2 = creature2.getCenterPosition();
                const dx = pos2.x - pos1.x;
                const dy = pos2.y - pos1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < REPRODUCTION_DISTANCE) {
                    // Reproduce!
                    this.reproduce(creature1, creature2);
                    
                    // Update reproduction times
                    creature1.lastReproductionTime = this.totalTime;
                    creature2.lastReproductionTime = this.totalTime;
                    
                    // Only one reproduction per creature per check
                    break;
                }
            }
        }
    }

    /**
     * Create a new creature from two parents
     * @param {Creature} parent1 - First parent
     * @param {Creature} parent2 - Second parent
     */
    reproduce(parent1, parent2) {
        // Create child DNA through crossover
        let childDNA = crossoverDNA(parent1.dna, parent2.dna);
        
        // Apply some mutation
        childDNA = mutateDNA(childDNA, 0.1); // 10% mutation rate
        
        // Set generation to current
        childDNA.generation = this.evolution.getGeneration();
        childDNA.fitness = 0;

        // Spawn position between parents
        const pos1 = parent1.getCenterPosition();
        const pos2 = parent2.getCenterPosition();
        const spawnX = (pos1.x + pos2.x) / 2 + (Math.random() - 0.5) * 40;
        const spawnY = (pos1.y + pos2.y) / 2 + (Math.random() - 0.5) * 40;

        // Ensure spawn is within bounds
        const rect = this.canvas.getBoundingClientRect();
        const margin = 50;
        const clampedX = Math.max(margin, Math.min(rect.width - margin, spawnX));
        const clampedY = Math.max(margin, Math.min(rect.height - margin, spawnY));

        // Create new creature
        const child = new Creature(
            childDNA,
            this.physics.getWorld(),
            clampedX,
            clampedY,
            this.nextCreatureId++
        );

        this.physics.registerCreature(child);
        this.creatures.push(child);

        // Log birth event
        this.ui.addLogEntry(`Wezen #${child.id} is geboren (ouders: #${parent1.id} & #${parent2.id})`, 'birth');
    }

    /**
     * Get the ID of the oldest living creature
     * @returns {number|null} ID of oldest creature or null
     */
    getOldestCreatureId() {
        const aliveCreatures = this.creatures.filter(c => c.isAlive());
        if (aliveCreatures.length === 0) return null;
        
        const oldest = aliveCreatures.reduce((oldest, current) => {
            return current.age > oldest.age ? current : oldest;
        });
        return oldest.id;
    }

    updateUI() {
        const stats = this.evolution.getStats();
        const livingCount = this.creatures.filter(c => c.isAlive()).length;

        // Find oldest creature
        const aliveCreatures = this.creatures.filter(c => c.isAlive());
        let oldestCreature = null;
        let oldestAge = 0;
        if (aliveCreatures.length > 0) {
            oldestCreature = aliveCreatures.reduce((oldest, current) => {
                return current.age > oldest.age ? current : oldest;
            });
            oldestAge = oldestCreature.age;
        }

        this.ui.updateStats({
            generation: stats.generation,
            time: this.totalTime,
            aliveCount: livingCount,
            bestFitness: stats.bestFitness,
            avgFitness: stats.avgFitness,
            oldestCreature: oldestCreature ? {
                id: oldestCreature.id,
                age: oldestAge
            } : null
        });
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    // Wait for layout to be complete
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            window.simulation = new Simulation();
        });
    });
});
