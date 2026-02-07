/**
 * Renderable platform definitions for the lobby map.
 * Positions/sizes are box meshes in world space.
 */
export const LOBBY_PLATFORMS = [
    { id: 'spawn-plaza', position: [0, -0.6, 0], size: [24, 1.2, 24], color: '#334155' },
    { id: 'north-bridge', position: [0, -0.35, -16], size: [6, 0.7, 8], color: '#475569' },
    { id: 'south-bridge', position: [0, -0.35, 16], size: [6, 0.7, 8], color: '#475569' },
    { id: 'east-bridge', position: [16, -0.35, 0], size: [8, 0.7, 6], color: '#475569' },
    { id: 'west-bridge', position: [-16, -0.35, 0], size: [8, 0.7, 6], color: '#475569' },

    { id: 'ring-1', position: [22, 0.2, 6], size: [5, 0.8, 5], color: '#0f766e' },
    { id: 'ring-2', position: [28, 1.3, 2], size: [4.5, 0.8, 4.5], color: '#0f766e' },
    { id: 'ring-3', position: [31, 2.5, -4], size: [4, 0.8, 4], color: '#0f766e' },
    { id: 'ring-4', position: [25, 3.6, -10], size: [4.5, 0.8, 4.5], color: '#0f766e' },
    { id: 'ring-5', position: [17, 2.7, -8], size: [5, 0.8, 5], color: '#0f766e' },
    { id: 'ring-return', position: [11, 1.4, -3], size: [4.5, 0.8, 4.5], color: '#0f766e' },

    { id: 'tower-approach', position: [-22, 0.2, -7], size: [5, 0.8, 5], color: '#8b5cf6' },
    { id: 'tower-step-1', position: [-25, 1.5, -10], size: [4, 0.8, 4], color: '#8b5cf6' },
    { id: 'tower-step-2', position: [-28, 2.9, -13], size: [4, 0.8, 4], color: '#8b5cf6' },
    { id: 'tower-step-3', position: [-31, 4.3, -16], size: [4, 0.8, 4], color: '#8b5cf6' },
    { id: 'tower-base', position: [-31, 5.8, -20], size: [10, 1, 10], color: '#7c3aed' },
    { id: 'tower-mid', position: [-31, 8.3, -20], size: [7, 0.8, 7], color: '#7c3aed' },
    { id: 'tower-top', position: [-31, 10.8, -20], size: [4.5, 0.8, 4.5], color: '#7c3aed' },

    { id: 'secret-1', position: [-8, 0.2, 22], size: [4.5, 0.8, 4.5], color: '#ca8a04' },
    { id: 'secret-2', position: [-13, 1.2, 26], size: [4.5, 0.8, 4.5], color: '#ca8a04' },
    { id: 'secret-3', position: [-19, 2.4, 30], size: [5, 0.8, 5], color: '#ca8a04' },
    { id: 'secret-vista', position: [-27, 4.2, 34], size: [12, 1, 10], color: '#a16207' }
];

/**
 * Precomputed AABB colliders derived from LOBBY_PLATFORMS.
 * Used by collision resolution each frame.
 */
export const PLATFORM_COLLIDERS = LOBBY_PLATFORMS.map((platform) => {
    const [x, y, z] = platform.position;
    const [sx, sy, sz] = platform.size;
    const halfX = sx * 0.5;
    const halfZ = sz * 0.5;

    return {
        id: platform.id,
        minX: x - halfX,
        maxX: x + halfX,
        minZ: z - halfZ,
        maxZ: z + halfZ,
        bottomY: y - sy * 0.5,
        topY: y + sy * 0.5
    };
});

/**
 * AABB colliders for non-platform props/landmarks so players cannot clip through them.
 */
export const LOBBY_OBJECT_COLLIDERS = [
    { id: 'spawn-wall', minX: -2.75, maxX: 2.75, minZ: -13.4, maxZ: -12.6, bottomY: 0.0, topY: 4.2 },
    { id: 'spawn-core', minX: -2.8, maxX: 2.8, minZ: -2.8, maxZ: 2.8, bottomY: 0.15, topY: 0.65 },

    { id: 'bench-north', minX: -1.25, maxX: 1.25, minZ: -7.2, maxZ: -6.4, bottomY: 0.0, topY: 0.95 },
    { id: 'bench-south', minX: -1.25, maxX: 1.25, minZ: 6.4, maxZ: 7.2, bottomY: 0.0, topY: 0.95 },

    { id: 'crate-east-south', minX: 7.4, maxX: 8.6, minZ: 6.4, maxZ: 7.6, bottomY: 0.0, topY: 1.1 },
    { id: 'crate-west-south', minX: -8.0, maxX: -6.8, minZ: 6.4, maxZ: 7.6, bottomY: 0.0, topY: 1.1 },
    { id: 'crate-east-north', minX: 7.3, maxX: 8.3, minZ: -7.5, maxZ: -6.5, bottomY: 0.0, topY: 0.9 },

    { id: 'pillar-ring', minX: 28.95, maxX: 30.05, minZ: -4.55, maxZ: -3.45, bottomY: 2.95, topY: 6.35 },
    { id: 'pillar-tower', minX: -31.65, maxX: -30.35, minZ: -20.65, maxZ: -19.35, bottomY: 11.8, topY: 15.9 },
    { id: 'pillar-secret', minX: -27.55, maxX: -26.45, minZ: 33.45, maxZ: 34.55, bottomY: 5.6, topY: 9.0 },

    { id: 'crystal-ring', minX: 24.35, maxX: 25.25, minZ: -10.45, maxZ: -9.55, bottomY: 3.95, topY: 6.1 },
    { id: 'crystal-tower', minX: -30.5, maxX: -29.5, minZ: -20.5, maxZ: -19.5, bottomY: 6.5, topY: 9.0 },
    { id: 'crystal-secret', minX: -24.95, maxX: -24.05, minZ: 32.75, maxZ: 33.65, bottomY: 4.85, topY: 7.0 }
];
