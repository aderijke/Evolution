/**
 * Evolution Module - Genetic algorithm for creature evolution
 * 
 * Handles selection, reproduction, mutation, and generation management
 */

import { generateRandomDNA, mutateDNA, crossoverDNA, cloneDNA } from './dna.js';

/**
 * Evolution manager class
 */
export class EvolutionManager {
    constructor(options = {}) {
        // Configuration
        this.populationSize = options.populationSize || 20;
        this.eliteCount = options.eliteCount || 2;
        this.mutationRate = options.mutationRate || 0.15;
        this.crossoverRate = options.crossoverRate || 0.3;

        // State
        this.generation = 0;
        this.population = []; // Array of DNA objects with fitness
        this.bestFitness = 0;
        this.avgFitness = 0;
        this.history = []; // Track fitness over generations
    }

    /**
     * Initialize first generation with random DNA
     */
    initializePopulation() {
        this.population = [];
        for (let i = 0; i < this.populationSize; i++) {
            this.population.push(generateRandomDNA());
        }
        this.generation = 0;
    }

    /**
     * Get current population DNA for creature spawning
     */
    getPopulation() {
        return this.population;
    }

    /**
     * Update population fitness from creature results
     * @param {Creature[]} creatures - Array of creatures with fitness calculated
     */
    updateFitness(creatures) {
        for (const creature of creatures) {
            const dna = this.population.find(d => d === creature.dna);
            if (dna) {
                dna.fitness = creature.calculateFitness();
                // Store age directly in DNA for all living creatures
                // This will be preserved for elite creatures in next generation
                if (creature.isAlive()) {
                    dna.creatureAge = creature.age;
                } else {
                    // Clear age for dead creatures
                    delete dna.creatureAge;
                }
            } else {
                // Debug: DNA not found - this shouldn't happen
                console.warn('DNA not found for creature', creature.id);
            }
        }

        // Calculate stats
        const fitnesses = this.population.map(d => d.fitness || 0);
        this.bestFitness = Math.max(...fitnesses);
        this.avgFitness = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;

        // Record history
        this.history.push({
            generation: this.generation,
            best: this.bestFitness,
            avg: this.avgFitness
        });
    }

    /**
     * Evolve to next generation
     * @param {Creature[]} creatures - Current generation creatures (for age lookup)
     * @param {Creature[]} eliteCreatures - Elite creatures that will survive (their DNA will be updated)
     */
    evolveNextGeneration(creatures = [], eliteCreatures = []) {
        // Sort by fitness (descending)
        const sorted = [...this.population].sort((a, b) => (b.fitness || 0) - (a.fitness || 0));

        const newPopulation = [];

        // Elitism: keep top performers unchanged
        // Update their DNA objects in place (they're already on screen)
        for (let i = 0; i < this.eliteCount && i < sorted.length; i++) {
            const eliteDNA = sorted[i];
            const elite = cloneDNA(eliteDNA);
            elite.generation = this.generation + 1;
            elite.fitness = 0;
            
            // No need to preserve age - elite creatures keep their age automatically
            // They stay on screen and continue aging
            
            // Clean up temporary properties
            delete elite.creatureAge;
            delete elite.savedAge;
            newPopulation.push(elite);
        }

        // Fill rest with offspring
        while (newPopulation.length < this.populationSize) {
            let child;

            if (Math.random() < this.crossoverRate && sorted.length >= 2) {
                // Sexual reproduction with crossover
                const parent1 = this.selectParent(sorted);
                const parent2 = this.selectParent(sorted);
                child = crossoverDNA(parent1, parent2);
            } else {
                // Asexual reproduction - clone a parent
                const parent = this.selectParent(sorted);
                child = cloneDNA(parent);
            }

            // Apply mutation
            child = mutateDNA(child, this.mutationRate);
            child.generation = this.generation + 1;
            child.fitness = 0;

            newPopulation.push(child);
        }

        this.population = newPopulation;
        this.generation++;
    }

    /**
     * Tournament selection for parent
     * @param {Object[]} sorted - Fitness-sorted population
     * @returns {Object} Selected parent DNA
     */
    selectParent(sorted) {
        // Tournament selection: pick 3 random, return best
        const tournamentSize = Math.min(3, sorted.length);
        const candidates = [];

        for (let i = 0; i < tournamentSize; i++) {
            const idx = Math.floor(Math.random() * sorted.length);
            candidates.push(sorted[idx]);
        }

        // Return the one with highest fitness
        return candidates.reduce((best, curr) =>
            (curr.fitness || 0) > (best.fitness || 0) ? curr : best
        );
    }

    /**
     * Get current generation number
     */
    getGeneration() {
        return this.generation;
    }

    /**
     * Get evolution statistics
     */
    getStats() {
        return {
            generation: this.generation,
            populationSize: this.population.length,
            bestFitness: Math.round(this.bestFitness),
            avgFitness: Math.round(this.avgFitness),
            history: this.history
        };
    }

    /**
     * Update configuration
     */
    setPopulationSize(size) {
        this.populationSize = size;
    }
}

export default EvolutionManager;
