/**
 * Name Generator Module - Generates realistic-sounding names for creatures
 */

// Syllable components for name generation
const PREFIXES = [
    'Al', 'Ar', 'Ba', 'Be', 'Ca', 'Ce', 'Da', 'De', 'El', 'Er',
    'Fa', 'Fe', 'Ga', 'Ge', 'Ha', 'He', 'Il', 'Ir', 'Ja', 'Je',
    'Ka', 'Ke', 'La', 'Le', 'Ma', 'Me', 'Na', 'Ne', 'Ol', 'Or',
    'Pa', 'Pe', 'Qu', 'Ra', 'Re', 'Sa', 'Se', 'Ta', 'Te', 'Ul',
    'Ur', 'Va', 'Ve', 'Wa', 'We', 'Xa', 'Ya', 'Za', 'Ze'
];

const MIDDLES = [
    'an', 'ar', 'as', 'at', 'el', 'en', 'er', 'es', 'il', 'in',
    'ir', 'is', 'on', 'or', 'os', 'ot', 'ul', 'un', 'ur', 'us',
    'al', 'am', 'ap', 'ed', 'em', 'ep', 'id', 'im', 'ip', 'od',
    'om', 'op', 'ud', 'um', 'up'
];

const SUFFIXES = [
    'a', 'an', 'ar', 'as', 'at', 'el', 'en', 'er', 'es', 'il',
    'in', 'ir', 'is', 'on', 'or', 'os', 'ot', 'ul', 'un', 'ur',
    'us', 'ax', 'ex', 'ix', 'ox', 'ux', 'yn', 'yr', 'ys', 'yt'
];

/**
 * Generate a random realistic-sounding name
 * @returns {string} A generated name
 */
export function generateName() {
    // Decide on name structure (2-3 syllables)
    const syllableCount = Math.random() < 0.7 ? 2 : 3;
    
    let name = '';
    
    // First syllable (prefix)
    name += PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
    
    // Middle syllable(s)
    for (let i = 1; i < syllableCount; i++) {
        name += MIDDLES[Math.floor(Math.random() * MIDDLES.length)];
    }
    
    // Last syllable (suffix)
    name += SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
    
    // Capitalize first letter
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}
