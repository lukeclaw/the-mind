import { COLLISION_CONFIG, PLAYER_FEET_OFFSET, PLAYER_HEAD_OFFSET, PLAYER_RADIUS } from './constants';

/**
 * Finds a valid landing surface by checking whether feet crossed a platform top
 * between frames, then snaps the player to the highest matching platform.
 */
function resolveLanding(prevPosition, position, velocity, colliders) {
    const prevFeetY = prevPosition.y - PLAYER_FEET_OFFSET;
    const feetY = position.y - PLAYER_FEET_OFFSET;
    let bestTopY = -Infinity;

    for (const collider of colliders) {
        const insideX = position.x >= collider.minX + PLAYER_RADIUS && position.x <= collider.maxX - PLAYER_RADIUS;
        const insideZ = position.z >= collider.minZ + PLAYER_RADIUS && position.z <= collider.maxZ - PLAYER_RADIUS;
        if (!insideX || !insideZ) continue;

        // Swept test: allows reliable landing even with larger frame deltas.
        const crossedTop = prevFeetY >= collider.topY - COLLISION_CONFIG.landingSnap
            && feetY <= collider.topY + COLLISION_CONFIG.landingSnap;
        const notTooDeep = feetY >= collider.topY - COLLISION_CONFIG.maxLandingDepth;
        if (!crossedTop || !notTooDeep || velocity.y > 0) continue;

        if (collider.topY > bestTopY) bestTopY = collider.topY;
    }

    if (bestTopY === -Infinity) return false;

    position.y = bestTopY + PLAYER_FEET_OFFSET;
    velocity.y = 0;
    return true;
}

/**
 * Prevents jumping through platform undersides by clamping the player below
 * the first ceiling intersected this frame.
 */
function resolveCeilingHit(prevPosition, position, velocity, colliders) {
    if (velocity.y <= 0) return;

    const prevHeadY = prevPosition.y + PLAYER_HEAD_OFFSET;
    const headY = position.y + PLAYER_HEAD_OFFSET;

    for (const collider of colliders) {
        const insideX = position.x >= collider.minX + PLAYER_RADIUS && position.x <= collider.maxX - PLAYER_RADIUS;
        const insideZ = position.z >= collider.minZ + PLAYER_RADIUS && position.z <= collider.maxZ - PLAYER_RADIUS;
        if (!insideX || !insideZ) continue;

        const crossedBottom = prevHeadY <= collider.bottomY + COLLISION_CONFIG.ceilingSnap
            && headY >= collider.bottomY - COLLISION_CONFIG.ceilingSnap;
        if (!crossedBottom) continue;

        position.y = collider.bottomY - PLAYER_HEAD_OFFSET - COLLISION_CONFIG.ceilingSnap;
        velocity.y = 0;
        return;
    }
}

/**
 * Resolves lateral overlap against platform volumes.
 * Pushes along the smallest penetration axis to reduce corner jitter.
 */
function resolveSideWalls(position, velocity, colliders) {
    const feetY = position.y - PLAYER_FEET_OFFSET;
    const bodyTopY = position.y + PLAYER_HEAD_OFFSET;

    for (const collider of colliders) {
        const verticalOverlap = bodyTopY > collider.bottomY + COLLISION_CONFIG.ceilingSnap
            && feetY < collider.topY - COLLISION_CONFIG.wallTopClearance;
        if (!verticalOverlap) continue;

        const expandedMinX = collider.minX - PLAYER_RADIUS;
        const expandedMaxX = collider.maxX + PLAYER_RADIUS;
        const expandedMinZ = collider.minZ - PLAYER_RADIUS;
        const expandedMaxZ = collider.maxZ + PLAYER_RADIUS;

        const insideExpanded = position.x > expandedMinX
            && position.x < expandedMaxX
            && position.z > expandedMinZ
            && position.z < expandedMaxZ;
        if (!insideExpanded) continue;

        const pushLeft = position.x - expandedMinX;
        const pushRight = expandedMaxX - position.x;
        const pushFront = position.z - expandedMinZ;
        const pushBack = expandedMaxZ - position.z;

        const minPush = Math.min(pushLeft, pushRight, pushFront, pushBack);
        // Keep only the component that does not push deeper into geometry.
        if (minPush === pushLeft) {
            position.x = expandedMinX;
            if (velocity.x < 0) velocity.x = 0;
        } else if (minPush === pushRight) {
            position.x = expandedMaxX;
            if (velocity.x > 0) velocity.x = 0;
        } else if (minPush === pushFront) {
            position.z = expandedMinZ;
            if (velocity.z < 0) velocity.z = 0;
        } else {
            position.z = expandedMaxZ;
            if (velocity.z > 0) velocity.z = 0;
        }
    }
}

/**
 * Runs the full collision pass for one simulation step.
 * Order matters: landing -> ceiling -> walls.
 */
export function resolvePlayerCollisions(prevPosition, position, velocity, colliders) {
    const grounded = resolveLanding(prevPosition, position, velocity, colliders);
    resolveCeilingHit(prevPosition, position, velocity, colliders);
    resolveSideWalls(position, velocity, colliders);

    return grounded;
}
