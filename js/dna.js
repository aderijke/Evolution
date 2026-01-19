/**
 * DNA Module - Genetic structure and operators for creatures
 * 
 * DNA defines both morphology (segments/joints) and behavior (motor patterns)
 */

/**
 * Generate a random color with some base hue for family resemblance
 * @param {number} baseHue - Optional base hue (0-360)
 * @returns {number[]} RGB color array
 */
function randomColor(baseHue = null) {
    const hue = baseHue !== null
        ? (baseHue + (Math.random() - 0.5) * 60) % 360
        : Math.random() * 360;
    const saturation = 0.6 + Math.random() * 0.3;
    const lightness = 0.5 + Math.random() * 0.2;

    // HSL to RGB conversion
    const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
    const m = lightness - c / 2;

    let r, g, b;
    if (hue < 60) { r = c; g = x; b = 0; }
    else if (hue < 120) { r = x; g = c; b = 0; }
    else if (hue < 180) { r = 0; g = c; b = x; }
    else if (hue < 240) { r = 0; g = x; b = c; }
    else if (hue < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    return [
        Math.round((r + m) * 255),
        Math.round((g + m) * 255),
        Math.round((b + m) * 255)
    ];
}

/**
 * Generate random DNA for a new creature
 * @param {Object} options - Generation options
 * @returns {Object} DNA structure
 */
export function generateRandomDNA(options = {}) {
    const {
        minSegments = 2,
        maxSegments = 5,
        baseHue = Math.random() * 360,
        minSensors = 1,
        maxSensors = 3
    } = options;

    const segmentCount = minSegments + Math.floor(Math.random() * (maxSegments - minSegments + 1));
    const segments = [];
    const joints = [];

    // Generate segments with parentId for tree structure
    for (let i = 0; i < segmentCount; i++) {
        const isCircle = Math.random() < 0.3;
        segments.push({
            id: i,
            parentId: i === 0 ? null : i - 1, // Linear chain by default
            attachAngle: 0, // Angle relative to parent
            shape: isCircle ? 'circle' : 'rectangle',
            length: isCircle ? null : 25 + Math.random() * 35,
            width: isCircle ? null : 8 + Math.random() * 12,
            radius: isCircle ? 10 + Math.random() * 15 : null,
            mass: 0.8 + Math.random() * 1.5,
            color: randomColor(baseHue),
            isHeart: i === 0,
            isMouth: i === segmentCount - 1,
            isGripper: Math.random() < 0.2 // 20% chance for a segment to be a gripper
        });
    }

    // Generate joints connecting segments
    for (let i = 0; i < segmentCount - 1; i++) {
        const segA = segments[i];
        const segB = segments[i + 1];

        const offsetA = segA.shape === 'circle'
            ? [0, -segA.radius]
            : [0, -segA.length / 2];
        const offsetB = segB.shape === 'circle'
            ? [0, segB.radius]
            : [0, segB.length / 2];

        joints.push({
            segA: i,
            segB: i + 1,
            attachPointA: offsetA,
            attachPointB: offsetB,
            type: 'distance',
            restLength: 15 + Math.random() * 20,
            minLength: 10,
            maxLength: 50,
            stiffness: 0.3 + Math.random() * 0.5,
            motorPattern: {
                amplitude: 3 + Math.random() * 8,
                frequency: 0.5 + Math.random() * 2.5,
                phase: Math.random() * Math.PI * 2
            }
        });
    }

    // Generate sensors (eyes and feelers)
    const sensorCount = minSensors + Math.floor(Math.random() * (maxSensors - minSensors + 1));
    const sensors = [];
    for (let i = 0; i < sensorCount; i++) {
        const isEye = Math.random() < 0.6;
        sensors.push({
            id: i,
            type: isEye ? 'eye' : 'feeler',
            segmentId: Math.floor(Math.random() * segmentCount),
            angle: (Math.random() - 0.5) * Math.PI, // -90 to +90 degrees
            range: isEye ? 100 + Math.random() * 150 : 30 + Math.random() * 40,
            fov: isEye ? 30 + Math.random() * 60 : 0 // Field of view for eyes
        });
    }

    // Sensor to motor weights matrix
    // Each sensor influences each joint's amplitude/frequency modulation
    const sensorMotorWeights = [];
    for (let s = 0; s < sensorCount; s++) {
        const weights = [];
        for (let j = 0; j < Math.max(1, joints.length); j++) {
            weights.push({
                amplitudeMod: (Math.random() - 0.5) * 2, // -1 to 1
                frequencyMod: (Math.random() - 0.5) * 1,  // -0.5 to 0.5
                phaseMod: (Math.random() - 0.5) * 0.5     // -0.25 to 0.25
            });
        }
        sensorMotorWeights.push(weights);
    }

    return {
        segments,
        joints,
        sensors,
        sensorMotorWeights,
        controller: {
            type: 'sensor-modulated'
        },
        generation: 0,
        fitness: 0,
        baseHue: baseHue,
        beauty: Math.random(), // 0-1 attractiveness value
        memorySize: 2 // Small constant memory for now
    };
}

/**
 * Deep clone a DNA structure
 * @param {Object} dna - DNA to clone
 * @returns {Object} Cloned DNA
 */
export function cloneDNA(dna) {
    return JSON.parse(JSON.stringify(dna));
}

/**
 * Mutate a DNA structure
 * @param {Object} dna - DNA to mutate
 * @param {number} rate - Mutation rate (0-1)
 * @returns {Object} Mutated DNA (new object)
 */
export function mutateDNA(dna, rate = 0.1) {
    const mutated = cloneDNA(dna);

    // Mutate segment properties
    for (const segment of mutated.segments) {
        if (Math.random() < rate) {
            // Mutate dimensions
            if (segment.shape === 'circle') {
                segment.radius = clamp(segment.radius + (Math.random() - 0.5) * 10, 5, 30);
            } else {
                segment.length = clamp(segment.length + (Math.random() - 0.5) * 15, 15, 70);
                segment.width = clamp(segment.width + (Math.random() - 0.5) * 6, 5, 25);
            }
        }
        if (Math.random() < rate) {
            segment.mass = clamp(segment.mass + (Math.random() - 0.5) * 0.5, 0.3, 3);
        }
        if (Math.random() < rate * 0.5) {
            // Slight color mutation - influenced by beauty
            const beautyShift = (mutated.beauty - 0.5) * 50;
            segment.color = segment.color.map(c =>
                clamp(c + Math.floor((Math.random() - 0.5) * 40 + beautyShift), 0, 255)
            );
        }
        if (segment.isGripper !== undefined && Math.random() < rate * 0.1) {
            segment.isGripper = !segment.isGripper;
        }
    }

    // Mutate beauty
    if (Math.random() < rate) {
        mutated.beauty = clamp(mutated.beauty + (Math.random() - 0.5) * 0.2, 0, 1);
    }

    // Mutate joint/motor properties
    for (const joint of mutated.joints) {
        if (Math.random() < rate) {
            joint.restLength = clamp(joint.restLength + (Math.random() - 0.5) * 10, 5, 60);
        }
        if (Math.random() < rate) {
            joint.stiffness = clamp(joint.stiffness + (Math.random() - 0.5) * 0.2, 0.1, 0.9);
        }

        const mp = joint.motorPattern;
        if (Math.random() < rate * 1.5) {
            mp.amplitude = clamp(mp.amplitude + (Math.random() - 0.5) * 4, 0, 15);
        }
        if (Math.random() < rate * 1.5) {
            mp.frequency = clamp(mp.frequency + (Math.random() - 0.5) * 1, 0.1, 4);
        }
        if (Math.random() < rate * 1.5) {
            mp.phase += (Math.random() - 0.5) * Math.PI * 0.5;
        }
    }

    // Mutate sensors
    if (mutated.sensors) {
        for (const sensor of mutated.sensors) {
            if (Math.random() < rate) {
                sensor.angle += (Math.random() - 0.5) * 0.5;
            }
            if (Math.random() < rate) {
                sensor.range = clamp(sensor.range + (Math.random() - 0.5) * 30, 20, 300);
            }
            if (sensor.type === 'eye' && Math.random() < rate) {
                sensor.fov = clamp(sensor.fov + (Math.random() - 0.5) * 20, 10, 120);
            }
        }

        // Mutate sensor-motor weights (more frequent for behavior evolution)
        if (mutated.sensorMotorWeights) {
            for (const sensorWeights of mutated.sensorMotorWeights) {
                for (const weight of sensorWeights) {
                    if (Math.random() < rate * 2) {
                        weight.amplitudeMod = clamp(weight.amplitudeMod + (Math.random() - 0.5) * 0.4, -2, 2);
                    }
                    if (Math.random() < rate * 2) {
                        weight.frequencyMod = clamp(weight.frequencyMod + (Math.random() - 0.5) * 0.2, -1, 1);
                    }
                    if (Math.random() < rate * 2) {
                        weight.phaseMod = clamp(weight.phaseMod + (Math.random() - 0.5) * 0.2, -1, 1);
                    }
                }
            }
        }

        // Add new sensor (rare)
        if (Math.random() < rate * 0.05 && mutated.sensors.length < 5) {
            const isEye = Math.random() < 0.6;
            mutated.sensors.push({
                id: mutated.sensors.length,
                type: isEye ? 'eye' : 'feeler',
                segmentId: Math.floor(Math.random() * mutated.segments.length),
                angle: (Math.random() - 0.5) * Math.PI,
                range: isEye ? 100 + Math.random() * 100 : 30 + Math.random() * 30,
                fov: isEye ? 40 + Math.random() * 40 : 0
            });
            // Add weights for new sensor
            const newWeights = [];
            for (let j = 0; j < mutated.joints.length; j++) {
                newWeights.push({
                    amplitudeMod: (Math.random() - 0.5) * 2,
                    frequencyMod: (Math.random() - 0.5) * 1,
                    phaseMod: (Math.random() - 0.5) * 0.5
                });
            }
            mutated.sensorMotorWeights.push(newWeights);
        }
    }

    // Structural mutations - add branch (rare)
    if (Math.random() < rate * 0.08 && mutated.segments.length < 8) {
        const parentIdx = Math.floor(Math.random() * mutated.segments.length);
        const newId = mutated.segments.length;
        const isCircle = Math.random() < 0.3;
        const branchAngle = (Math.random() - 0.5) * Math.PI; // Random branch direction

        mutated.segments.push({
            id: newId,
            parentId: parentIdx,
            attachAngle: branchAngle,
            shape: isCircle ? 'circle' : 'rectangle',
            length: isCircle ? null : 20 + Math.random() * 25,
            width: isCircle ? null : 6 + Math.random() * 10,
            radius: isCircle ? 8 + Math.random() * 12 : null,
            mass: 0.5 + Math.random() * 1,
            color: randomColor(mutated.baseHue),
            isHeart: false,
            isMouth: Math.random() < 0.3 // Some branches become mouths
        });

        mutated.joints.push({
            segA: parentIdx,
            segB: newId,
            attachPointA: [0, 0],
            attachPointB: [0, 10],
            type: 'distance',
            restLength: 15 + Math.random() * 15,
            minLength: 8,
            maxLength: 40,
            stiffness: 0.3 + Math.random() * 0.4,
            motorPattern: {
                amplitude: 2 + Math.random() * 6,
                frequency: 0.5 + Math.random() * 2,
                phase: Math.random() * Math.PI * 2
            }
        });

        // Add weights for new joint to all sensors
        if (mutated.sensorMotorWeights) {
            for (const sensorWeights of mutated.sensorMotorWeights) {
                sensorWeights.push({
                    amplitudeMod: (Math.random() - 0.5) * 2,
                    frequencyMod: (Math.random() - 0.5) * 1,
                    phaseMod: (Math.random() - 0.5) * 0.5
                });
            }
        }
    }

    return mutated;
}

/**
 * Crossover two DNA structures (for sexual reproduction)
 * @param {Object} dna1 - First parent DNA
 * @param {Object} dna2 - Second parent DNA
 * @returns {Object} Child DNA
 */
export function crossoverDNA(dna1, dna2) {
    // For MVP: use simpler approach - take structure from one parent, motor patterns from mix
    const child = cloneDNA(Math.random() < 0.5 ? dna1 : dna2);

    // Mix motor patterns from both parents
    const minJoints = Math.min(child.joints.length, dna1.joints.length, dna2.joints.length);
    for (let i = 0; i < minJoints; i++) {
        const source = Math.random() < 0.5 ? dna1 : dna2;
        if (source.joints[i]) {
            child.joints[i].motorPattern = { ...source.joints[i].motorPattern };
        }
    }

    // Blend base hue
    child.baseHue = (dna1.baseHue + dna2.baseHue) / 2 + (Math.random() - 0.5) * 30;

    return child;
}

/**
 * Clamp a value between min and max
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export default {
    generateRandomDNA,
    cloneDNA,
    mutateDNA,
    crossoverDNA
};
