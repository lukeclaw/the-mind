import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import GeneratedCharacter from './GeneratedCharacter';
import { resolvePlayerCollisions } from './collision';
import { CAMERA_CONFIG, FALL_RESET_Y, MOVEMENT_CONFIG, SPAWN_POINT } from './constants';

/**
 * Handles local player input, simulation, camera follow, and character pose state.
 */
export default function CharacterController({ playerName, colliders }) {
    const { camera, gl } = useThree();
    const bodyRef = useRef();
    const keysRef = useRef({
        KeyW: false,
        KeyA: false,
        KeyS: false,
        KeyD: false,
        Space: false,
        ShiftLeft: false,
        ShiftRight: false
    });
    const stateRef = useRef({
        position: SPAWN_POINT.clone(),
        velocity: new THREE.Vector3(),
        yaw: 0,
        pitch: -0.25,
        grounded: false,
        moveBlend: 0,
        walkTime: 0
    });

    const forward = useMemo(() => new THREE.Vector3(), []);
    const right = useMemo(() => new THREE.Vector3(), []);
    const moveInput = useMemo(() => new THREE.Vector3(), []);
    const target = useMemo(() => new THREE.Vector3(), []);
    const camPos = useMemo(() => new THREE.Vector3(), []);
    const previousPosition = useMemo(() => new THREE.Vector3(), []);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.code in keysRef.current) keysRef.current[event.code] = true;
        };

        const onKeyUp = (event) => {
            if (event.code in keysRef.current) keysRef.current[event.code] = false;
        };

        const onMouseMove = (event) => {
            if (document.pointerLockElement !== gl.domElement) return;

            stateRef.current.yaw -= event.movementX * 0.0025;
            stateRef.current.pitch -= event.movementY * 0.0018;
            stateRef.current.pitch = Math.max(-0.95, Math.min(0.55, stateRef.current.pitch));
        };

        const onCanvasClick = () => {
            // Pointer lock gives us uninterrupted mouse delta for camera yaw/pitch.
            if (document.pointerLockElement !== gl.domElement) {
                gl.domElement.requestPointerLock();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('mousemove', onMouseMove);
        gl.domElement.addEventListener('click', onCanvasClick);

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('mousemove', onMouseMove);
            gl.domElement.removeEventListener('click', onCanvasClick);
        };
    }, [gl]);

    useFrame((_, delta) => {
        const dt = Math.min(delta, 0.033);
        const { walkSpeed, runSpeed, gravity, jumpSpeed } = MOVEMENT_CONFIG;

        const keys = keysRef.current;
        const state = stateRef.current;

        forward.set(Math.sin(state.yaw), 0, Math.cos(state.yaw));
        right.set(-forward.z, 0, forward.x);

        moveInput.set(0, 0, 0);
        if (keys.KeyW) moveInput.add(forward);
        if (keys.KeyS) moveInput.sub(forward);
        if (keys.KeyD) moveInput.add(right);
        if (keys.KeyA) moveInput.sub(right);

        const sprinting = keys.ShiftLeft || keys.ShiftRight;
        const targetSpeed = sprinting ? runSpeed : walkSpeed;

        if (moveInput.lengthSq() > 0) {
            // Damped horizontal velocity gives responsive but not twitchy movement.
            moveInput.normalize().multiplyScalar(targetSpeed);
            state.velocity.x = THREE.MathUtils.damp(state.velocity.x, moveInput.x, 14, dt);
            state.velocity.z = THREE.MathUtils.damp(state.velocity.z, moveInput.z, 14, dt);
        } else {
            state.velocity.x = THREE.MathUtils.damp(state.velocity.x, 0, 10, dt);
            state.velocity.z = THREE.MathUtils.damp(state.velocity.z, 0, 10, dt);
        }

        if (keys.Space && state.grounded) {
            state.velocity.y = jumpSpeed;
            state.grounded = false;
        }

        // Store pre-step position for swept collision checks.
        previousPosition.copy(state.position);
        state.velocity.y -= gravity * dt;
        state.position.addScaledVector(state.velocity, dt);

        state.grounded = resolvePlayerCollisions(previousPosition, state.position, state.velocity, colliders);

        if (state.position.y < FALL_RESET_Y) {
            state.position.copy(SPAWN_POINT);
            state.velocity.set(0, 0, 0);
            state.grounded = false;
        }

        const planarSpeed = Math.sqrt(state.velocity.x * state.velocity.x + state.velocity.z * state.velocity.z);
        const normalizedSpeed = Math.min(1, planarSpeed / runSpeed);
        state.moveBlend = THREE.MathUtils.damp(state.moveBlend, normalizedSpeed, 8, dt);
        state.walkTime += dt * (0.8 + state.moveBlend * 1.9);

        if (bodyRef.current) {
            bodyRef.current.position.copy(state.position);
        }

        // Follow camera stays behind yaw direction and pivots with pitch.
        target.copy(state.position).add(new THREE.Vector3(0, CAMERA_CONFIG.targetOffsetY, 0));
        const horizontal = Math.cos(state.pitch) * CAMERA_CONFIG.distance;
        camPos.set(
            target.x - Math.sin(state.yaw) * horizontal,
            target.y - Math.sin(state.pitch) * CAMERA_CONFIG.distance + CAMERA_CONFIG.cameraLift,
            target.z - Math.cos(state.yaw) * horizontal
        );

        camera.position.copy(camPos);
        camera.lookAt(target);
    });

    return <GeneratedCharacter playerName={playerName} stateRef={stateRef} bodyRef={bodyRef} />;
}
