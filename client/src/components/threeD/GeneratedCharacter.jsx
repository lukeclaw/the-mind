import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Procedural character rig using simple meshes and runtime animation blending.
 */
export default function GeneratedCharacter({ playerName, stateRef, bodyRef }) {
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

        // Blend walk/run cycles for smoother transitions as speed changes.
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
