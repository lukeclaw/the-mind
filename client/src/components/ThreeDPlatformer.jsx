import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Sky } from '@react-three/drei';
import * as THREE from 'three';

function GeneratedCharacter({ playerName, stateRef, bodyRef }) {
    const torsoRef = useRef();
    const headRef = useRef();
    const leftArmRef = useRef();
    const rightArmRef = useRef();
    const leftLegRef = useRef();
    const rightLegRef = useRef();

    useFrame(({ clock }, delta) => {
        const state = stateRef.current;
        const dt = Math.min(delta, 0.033);
        const t = clock.elapsedTime;
        const moveBlend = state.moveBlend;

        const walkPhase = state.walkTime * 9.0;
        const runPhase = state.walkTime * 14.0;
        const runWeight = Math.max(0, (moveBlend - 0.55) / 0.45);
        const walkWeight = moveBlend - runWeight * 0.4;

        const armSwing =
            Math.sin(walkPhase) * 0.5 * walkWeight +
            Math.sin(runPhase) * 0.65 * runWeight;
        const legSwing =
            Math.sin(walkPhase) * 0.65 * walkWeight +
            Math.sin(runPhase) * 0.9 * runWeight;
        const bob =
            Math.sin(walkPhase * 2.0) * 0.05 * walkWeight +
            Math.sin(runPhase * 2.0) * 0.08 * runWeight;

        const idleBreath = Math.sin(t * 2.2) * 0.02 * (1 - moveBlend);
        const idleSway = Math.sin(t * 1.6) * 0.06 * (1 - moveBlend);

        if (torsoRef.current) {
            torsoRef.current.position.y = 1.08 + idleBreath + bob;
            torsoRef.current.rotation.z = idleSway * 0.2;
            torsoRef.current.rotation.x = -Math.abs(armSwing) * 0.08;
        }

        if (headRef.current) {
            headRef.current.rotation.y = idleSway * 0.35;
            headRef.current.rotation.x = idleBreath * 0.7;
        }

        if (leftArmRef.current) {
            leftArmRef.current.rotation.x = armSwing;
            leftArmRef.current.rotation.z = 0.08;
        }

        if (rightArmRef.current) {
            rightArmRef.current.rotation.x = -armSwing;
            rightArmRef.current.rotation.z = -0.08;
        }

        if (leftLegRef.current) {
            leftLegRef.current.rotation.x = -legSwing;
        }

        if (rightLegRef.current) {
            rightLegRef.current.rotation.x = legSwing;
        }

        if (bodyRef.current) {
            const targetYaw = state.yaw;
            bodyRef.current.rotation.y = THREE.MathUtils.damp(bodyRef.current.rotation.y, targetYaw, 12, dt);
        }
    });

    return (
        <group ref={bodyRef}>
            <group ref={torsoRef} position={[0, 1.08, 0]}>
                <mesh castShadow>
                    <capsuleGeometry args={[0.33, 1.0, 8, 16]} />
                    <meshStandardMaterial color="#22d3ee" roughness={0.42} metalness={0.08} />
                </mesh>

                <group ref={headRef} position={[0, 0.92, 0]}>
                    <mesh castShadow>
                        <sphereGeometry args={[0.24, 16, 16]} />
                        <meshStandardMaterial color="#f8fafc" roughness={0.5} />
                    </mesh>
                    <mesh position={[0, 0.02, 0.21]}>
                        <boxGeometry args={[0.16, 0.08, 0.03]} />
                        <meshStandardMaterial color="#0f172a" />
                    </mesh>
                </group>

                <group ref={leftArmRef} position={[0.5, 0.35, 0]}>
                    <mesh castShadow position={[0, -0.3, 0]}>
                        <capsuleGeometry args={[0.09, 0.5, 6, 10]} />
                        <meshStandardMaterial color="#67e8f9" roughness={0.45} />
                    </mesh>
                </group>

                <group ref={rightArmRef} position={[-0.5, 0.35, 0]}>
                    <mesh castShadow position={[0, -0.3, 0]}>
                        <capsuleGeometry args={[0.09, 0.5, 6, 10]} />
                        <meshStandardMaterial color="#67e8f9" roughness={0.45} />
                    </mesh>
                </group>
            </group>

            <group ref={leftLegRef} position={[0.2, 0.55, 0]}>
                <mesh castShadow position={[0, -0.35, 0]}>
                    <capsuleGeometry args={[0.11, 0.6, 6, 10]} />
                    <meshStandardMaterial color="#0ea5e9" roughness={0.5} />
                </mesh>
            </group>

            <group ref={rightLegRef} position={[-0.2, 0.55, 0]}>
                <mesh castShadow position={[0, -0.35, 0]}>
                    <capsuleGeometry args={[0.11, 0.6, 6, 10]} />
                    <meshStandardMaterial color="#0ea5e9" roughness={0.5} />
                </mesh>
            </group>

            <Html position={[0, 2.5, 0]} center distanceFactor={12}>
                <div className="three-d-name-tag">{playerName}</div>
            </Html>
        </group>
    );
}

function CharacterController({ playerName }) {
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
        position: new THREE.Vector3(0, 1, 0),
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
        const walkSpeed = 5.5;
        const runSpeed = 8.6;
        const gravity = 24;
        const jumpSpeed = 10;

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

        state.velocity.y -= gravity * dt;
        state.position.addScaledVector(state.velocity, dt);

        const halfPlatform = 10;
        const isOverPlatform = Math.abs(state.position.x) <= halfPlatform && Math.abs(state.position.z) <= halfPlatform;

        if (isOverPlatform && state.position.y <= 1) {
            state.position.y = 1;
            state.velocity.y = 0;
            state.grounded = true;
        } else {
            state.grounded = false;
        }

        if (state.position.y < -30) {
            state.position.set(0, 3, 0);
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

        const target = state.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        const distance = 6;
        const horizontal = Math.cos(state.pitch) * distance;
        const camPos = new THREE.Vector3(
            target.x - Math.sin(state.yaw) * horizontal,
            target.y - Math.sin(state.pitch) * distance + 1.5,
            target.z - Math.cos(state.yaw) * horizontal
        );

        camera.position.copy(camPos);
        camera.lookAt(target);
    });

    return <GeneratedCharacter playerName={playerName} stateRef={stateRef} bodyRef={bodyRef} />;
}

export default function ThreeDPlatformer({ onLeave, playerName = 'Player' }) {
    return (
        <div className="three-d-game">
            <Canvas shadows camera={{ position: [0, 4, 8], fov: 55 }}>
                <color attach="background" args={['#0b1220']} />
                <fog attach="fog" args={['#0b1220', 18, 70]} />

                <ambientLight intensity={0.45} />
                <directionalLight
                    castShadow
                    position={[8, 16, 6]}
                    intensity={1.3}
                    shadow-mapSize-width={2048}
                    shadow-mapSize-height={2048}
                />

                <Sky distance={450000} sunPosition={[5, 1, 8]} inclination={0.5} azimuth={0.2} />

                <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
                    <boxGeometry args={[20, 20, 0.5]} />
                    <meshStandardMaterial color="#334155" roughness={0.9} />
                </mesh>

                <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.26, 0]}>
                    <planeGeometry args={[220, 220]} />
                    <meshStandardMaterial color="#0f172a" roughness={1} metalness={0} />
                </mesh>

                <mesh castShadow receiveShadow position={[0, 1.5, -8]}>
                    <boxGeometry args={[4, 3, 0.6]} />
                    <meshStandardMaterial color="#1e293b" />
                </mesh>

                <CharacterController playerName={playerName} />
            </Canvas>

            <div className="three-d-overlay">
                <div className="three-d-help">Click scene to lock mouse. Move: WASD. Sprint: Shift. Jump: Space.</div>
                <button className="btn btn-secondary btn-small" onClick={onLeave}>Leave Game</button>
            </div>
        </div>
    );
}
