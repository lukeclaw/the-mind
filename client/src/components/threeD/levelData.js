/**
 * Modular geometry definitions for a performance-focused lobby layout.
 * Each module type can be instanced, and colliders are derived from size metadata.
 */
const MODULE_TYPES = {
    plazaCore: {
        size: [24, 1.2, 24],
        color: '#334155',
        textureKey: 'techFloor',
        textureRepeat: [7, 7],
        roughness: 0.82,
        metalness: 0.1
    },
    bridgeNS: {
        size: [6, 0.7, 8],
        color: '#475569',
        textureKey: 'woodPlanks',
        textureRepeat: [2, 3],
        roughness: 0.8,
        metalness: 0.1,
        hazardDecal: true,
        hazardOrientation: 'ns'
    },
    bridgeEW: {
        size: [8, 0.7, 6],
        color: '#475569',
        textureKey: 'woodPlanks',
        textureRepeat: [3, 2],
        roughness: 0.8,
        metalness: 0.1,
        hazardDecal: true,
        hazardOrientation: 'ew'
    },
    parkourPad: {
        size: [4.5, 0.8, 4.5],
        color: '#0f766e',
        textureKey: 'mossBlock',
        textureRepeat: [2, 2],
        roughness: 0.84,
        metalness: 0.08
    },
    parkourPadSmall: {
        size: [4, 0.8, 4],
        color: '#115e59',
        textureKey: 'mossBlock',
        textureRepeat: [2, 2],
        roughness: 0.86,
        metalness: 0.06
    },
    towerStep: {
        size: [4, 0.8, 4],
        color: '#8b5cf6',
        textureKey: 'stoneTiles',
        textureRepeat: [2, 2],
        roughness: 0.78,
        metalness: 0.12
    },
    towerBase: {
        size: [10, 1, 10],
        color: '#7c3aed',
        textureKey: 'stoneTiles',
        textureRepeat: [3, 3],
        roughness: 0.76,
        metalness: 0.14
    },
    towerMid: {
        size: [7, 0.8, 7],
        color: '#7c3aed',
        textureKey: 'stoneTiles',
        textureRepeat: [2, 2],
        roughness: 0.76,
        metalness: 0.14
    },
    towerTop: {
        size: [4.5, 0.8, 4.5],
        color: '#7c3aed',
        textureKey: 'energyOrbs',
        textureRepeat: [1, 1],
        roughness: 0.68,
        metalness: 0.2
    },
    secretPad: {
        size: [4.5, 0.8, 4.5],
        color: '#ca8a04',
        textureKey: 'mossBlock',
        textureRepeat: [2, 2],
        roughness: 0.84,
        metalness: 0.08
    },
    secretVista: {
        size: [12, 1, 10],
        color: '#a16207',
        textureKey: 'mossBlock',
        textureRepeat: [3, 2],
        roughness: 0.84,
        metalness: 0.08
    },
    skywalk: {
        size: [5.5, 0.7, 5.5],
        color: '#1d4ed8',
        textureKey: 'techFloor',
        textureRepeat: [2, 2],
        roughness: 0.72,
        metalness: 0.22
    },
    spawnWall: {
        size: [5.5, 4.2, 0.8],
        color: '#1e293b',
        roughness: 0.7,
        metalness: 0.12
    },
    spawnCore: {
        size: [3.8, 0.5, 3.8],
        color: '#64748b',
        roughness: 0.5,
        metalness: 0.25
    }
};

function makeInstance(id, type, position) {
    return { id, type, position };
}

const MODULE_INSTANCES = [
    makeInstance('spawn-plaza', 'plazaCore', [0, -0.6, 0]),
    makeInstance('north-bridge', 'bridgeNS', [0, -0.35, -16]),
    makeInstance('south-bridge', 'bridgeNS', [0, -0.35, 16]),
    makeInstance('east-bridge', 'bridgeEW', [16, -0.35, 0]),
    makeInstance('west-bridge', 'bridgeEW', [-16, -0.35, 0]),

    makeInstance('ring-1', 'parkourPad', [22, 0.2, 6]),
    makeInstance('ring-2', 'parkourPad', [26, 0.9, 4]),
    makeInstance('ring-3', 'parkourPadSmall', [30, 1.8, 0]),
    makeInstance('ring-4', 'parkourPadSmall', [32, 2.5, -5]),
    makeInstance('ring-5', 'parkourPad', [29, 3.4, -10]),
    makeInstance('ring-6', 'parkourPad', [23, 3.8, -13]),
    makeInstance('ring-7', 'parkourPad', [17, 3.1, -11]),
    makeInstance('ring-8', 'parkourPadSmall', [12, 2.2, -7]),
    makeInstance('ring-return', 'parkourPad', [10, 1.3, -2]),

    makeInstance('tower-approach', 'towerStep', [-22, 0.2, -7]),
    makeInstance('tower-step-1', 'towerStep', [-25, 1.4, -10]),
    makeInstance('tower-step-2', 'towerStep', [-28, 2.8, -13]),
    makeInstance('tower-step-3', 'towerStep', [-31, 4.2, -16]),
    makeInstance('tower-base', 'towerBase', [-31, 5.8, -20]),
    makeInstance('tower-mid', 'towerMid', [-31, 8.3, -20]),
    makeInstance('tower-top', 'towerTop', [-31, 10.8, -20]),
    makeInstance('tower-balcony-east', 'towerStep', [-26.5, 6.8, -20]),
    makeInstance('tower-balcony-west', 'towerStep', [-35.5, 6.8, -20]),

    makeInstance('secret-1', 'secretPad', [-8, 0.2, 22]),
    makeInstance('secret-2', 'secretPad', [-12, 1.0, 25]),
    makeInstance('secret-3', 'secretPad', [-16, 1.8, 28]),
    makeInstance('secret-4', 'secretPad', [-20, 2.7, 31]),
    makeInstance('secret-5', 'secretPad', [-24, 3.5, 33]),
    makeInstance('secret-vista', 'secretVista', [-27, 4.2, 34]),

    makeInstance('skywalk-1', 'skywalk', [0, 1.1, -23]),
    makeInstance('skywalk-2', 'skywalk', [6, 1.6, -26]),
    makeInstance('skywalk-3', 'skywalk', [12, 2.2, -29]),
    makeInstance('skywalk-4', 'skywalk', [18, 2.8, -30]),

    makeInstance('spawn-wall', 'spawnWall', [0, 2.1, -13]),
    makeInstance('spawn-core', 'spawnCore', [0, 0.4, 0])
];

/**
 * Decorative objects. Colliders are derived from optional colliderSize metadata.
 */
export const LOBBY_OBJECTS = [
    { id: 'bench-north', modelKey: 'bench', position: [0, 0.03, -6.8], scale: 1.2, color: '#7c5a3f', colliderSize: [2.5, 0.95, 0.8] },
    { id: 'bench-south', modelKey: 'bench', position: [0, 0.03, 6.8], rotation: [0, Math.PI, 0], scale: 1.2, color: '#7c5a3f', colliderSize: [2.5, 0.95, 0.8] },

    { id: 'crate-east-south', modelKey: 'crate', position: [8, 0.03, 7], scale: 1.1, color: '#8b6b47', colliderSize: [1.2, 1.1, 1.2] },
    { id: 'crate-west-south', modelKey: 'crate', position: [-7.4, 0.03, 7], scale: 1.1, color: '#8b6b47', colliderSize: [1.2, 1.1, 1.2] },
    { id: 'crate-east-north', modelKey: 'crate', position: [7.8, 0.03, -7], scale: 0.9, color: '#8b6b47', colliderSize: [1.0, 0.9, 1.0] },

    { id: 'pillar-ring', modelKey: 'pillar', position: [29.5, 2.95, -4], scale: 1.2, color: '#22d3ee', emissive: '#155e75', emissiveIntensity: 0.25, colliderSize: [1.1, 3.4, 1.1] },
    { id: 'pillar-tower', modelKey: 'pillar', position: [-31, 11.8, -20], scale: 1.45, color: '#c084fc', emissive: '#581c87', emissiveIntensity: 0.35, colliderSize: [1.3, 4.1, 1.3] },
    { id: 'pillar-secret', modelKey: 'pillar', position: [-27, 5.6, 34], scale: 1.2, color: '#f59e0b', emissive: '#78350f', emissiveIntensity: 0.3, colliderSize: [1.1, 3.4, 1.1] },

    { id: 'crystal-ring', modelKey: 'crystal', position: [24.8, 3.95, -10], scale: 1.25, color: '#5eead4', emissive: '#0f766e', emissiveIntensity: 0.28, colliderSize: [0.9, 2.15, 0.9] },
    { id: 'crystal-tower', modelKey: 'crystal', position: [-30, 6.5, -20], scale: 1.5, color: '#d8b4fe', emissive: '#7e22ce', emissiveIntensity: 0.32, colliderSize: [1.0, 2.5, 1.0] },
    { id: 'crystal-secret', modelKey: 'crystal', position: [-24.5, 4.85, 33.2], scale: 1.25, color: '#fbbf24', emissive: '#92400e', emissiveIntensity: 0.24, colliderSize: [0.9, 2.15, 0.9] }
];

function makeAabb(id, position, size) {
    const [x, y, z] = position;
    const [sx, sy, sz] = size;
    return {
        id,
        minX: x - sx * 0.5,
        maxX: x + sx * 0.5,
        minZ: z - sz * 0.5,
        maxZ: z + sz * 0.5,
        bottomY: y - sy * 0.5,
        topY: y + sy * 0.5
    };
}

/**
 * Renderable platform definitions for the lobby map.
 */
export const LOBBY_PLATFORMS = MODULE_INSTANCES.map((instance) => {
    const typeDef = MODULE_TYPES[instance.type];
    return {
        id: instance.id,
        type: instance.type,
        position: instance.position,
        size: typeDef.size,
        color: typeDef.color,
        textureKey: typeDef.textureKey || null,
        textureRepeat: typeDef.textureRepeat || null,
        roughness: typeDef.roughness,
        metalness: typeDef.metalness,
        hazardDecal: Boolean(typeDef.hazardDecal),
        hazardOrientation: typeDef.hazardOrientation || null
    };
});

/**
 * AABB colliders derived from modular platform data.
 */
export const PLATFORM_COLLIDERS = LOBBY_PLATFORMS.map((platform) => makeAabb(platform.id, platform.position, platform.size));

/**
 * AABB colliders derived from decorative objects that should block player movement.
 */
export const LOBBY_OBJECT_COLLIDERS = LOBBY_OBJECTS
    .filter((objectDef) => objectDef.colliderSize)
    .map((objectDef) => makeAabb(objectDef.id, objectDef.position, objectDef.colliderSize));
