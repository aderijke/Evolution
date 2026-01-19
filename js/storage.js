/**
 * Storage Module - DNA serialization and persistence
 */

/**
 * Export DNA to a JSON file
 * @param {Object} dna - DNA structure to export
 * @param {string} name - Optional filename
 */
export function exportDNA(dna, name = 'creature_dna') {
    const data = JSON.stringify(dna, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}_gen${dna.generation || 0}.json`;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);
}

/**
 * Save DNA to local storage "Hall of Fame"
 * @param {Object} dna - DNA to save
 */
export function saveToHallOfFame(dna) {
    const hallOfFame = getHallOfFame();

    // Add timestamp and ID
    const entry = {
        id: Date.now(),
        date: new Date().toISOString(),
        dna: JSON.parse(JSON.stringify(dna)) // Deep clone
    };

    hallOfFame.unshift(entry);

    // Keep only top 10
    if (hallOfFame.length > 10) {
        hallOfFame.pop();
    }

    localStorage.setItem('evolution_hall_of_fame', JSON.stringify(hallOfFame));
}

/**
 * Get all DNA entries from Hall of Fame
 * @returns {Array} List of saved DNA entries
 */
export function getHallOfFame() {
    const data = localStorage.getItem('evolution_hall_of_fame');
    return data ? JSON.parse(data) : [];
}

/**
 * Clear Hall of Fame
 */
export function clearHallOfFame() {
    localStorage.removeItem('evolution_hall_of_fame');
}

export default {
    exportDNA,
    saveToHallOfFame,
    getHallOfFame,
    clearHallOfFame
};
