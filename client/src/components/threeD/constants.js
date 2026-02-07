import * as THREE from 'three';

/** Player collision envelope relative to CharacterController position.y. */
export const PLAYER_FEET_OFFSET = 0.22;
export const PLAYER_HEAD_OFFSET = 2.24;
export const PLAYER_RADIUS = 0.32;
export const FALL_RESET_Y = -30;
export const SPAWN_POINT = new THREE.Vector3(0, 3, 0);

/** Movement tuning for local simulation. */
export const MOVEMENT_CONFIG = {
    walkSpeed: 5.5,
    runSpeed: 8.6,
    gravity: 24,
    jumpSpeed: 10
};

/** Third-person follow camera tuning. */
export const CAMERA_CONFIG = {
    distance: 6,
    targetOffsetY: 1.2,
    cameraLift: 1.5
};

/** Collision tolerances used by swept overlap checks and snap behavior. */
export const COLLISION_CONFIG = {
    landingSnap: 0.08,
    maxLandingDepth: 1.0,
    ceilingSnap: 0.04,
    wallTopClearance: 0.25
};
