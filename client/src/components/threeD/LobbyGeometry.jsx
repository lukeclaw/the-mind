/**
 * Pure rendering component for lobby platforms and landmark props.
 * Collision is handled separately via derived colliders.
 */
import { useLoader } from '@react-three/fiber';
import { useMemo } from 'react';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as THREE from 'three';

const TEXTURE_PATHS = [
    '/assets/threeD/textures/tech_floor.svg',
    '/assets/threeD/textures/stone_tiles.svg',
    '/assets/threeD/textures/moss_block.svg',
    '/assets/threeD/textures/hazard_stripes.svg',
    '/assets/threeD/textures/energy_orbs.svg',
    '/assets/threeD/textures/wood_planks.svg'
];

const MODEL_PATHS = [
    '/assets/threeD/models/crate_lowpoly.obj',
    '/assets/threeD/models/bench_lowpoly.obj',
    '/assets/threeD/models/crystal_cluster.obj',
    '/assets/threeD/models/sci_fi_pillar.obj'
];

const PLATFORM_TEXTURE_RULES = {
    'spawn-plaza': { key: 'techFloor', repeat: [7, 7] },
    'north-bridge': { key: 'woodPlanks', repeat: [2, 3] },
    'south-bridge': { key: 'woodPlanks', repeat: [2, 3] },
    'east-bridge': { key: 'woodPlanks', repeat: [3, 2] },
    'west-bridge': { key: 'woodPlanks', repeat: [3, 2] },
    'tower-base': { key: 'stoneTiles', repeat: [3, 3] },
    'tower-mid': { key: 'stoneTiles', repeat: [2, 2] },
    'tower-top': { key: 'energyOrbs', repeat: [1, 1] },
    'secret-vista': { key: 'mossBlock', repeat: [3, 2] }
};

const BRIDGE_IDS = new Set(['north-bridge', 'south-bridge', 'east-bridge', 'west-bridge']);
const SURFACE_EPSILON = 0.03;

function prepareTexture(texture, repeatX, repeatY) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
}

function ObjProp({ model, position, rotation = [0, 0, 0], scale = 1, color = '#94a3b8', emissive = '#000000', emissiveIntensity = 0 }) {
    const object = useMemo(() => {
        const cloned = model.clone(true);
        cloned.traverse((child) => {
            if (!child.isMesh) return;
            child.castShadow = true;
            child.receiveShadow = true;
            child.material = new THREE.MeshStandardMaterial({
                color,
                roughness: 0.55,
                metalness: 0.2,
                emissive,
                emissiveIntensity,
                transparent: false,
                opacity: 1,
                depthWrite: true,
                depthTest: true,
                side: THREE.DoubleSide
            });
        });
        return cloned;
    }, [model, color, emissive, emissiveIntensity]);

    return <primitive object={object} position={position} rotation={rotation} scale={scale} />;
}

/**
 * Pure rendering component for lobby platforms and landmark props.
 * Collision is handled separately via derived colliders.
 */
export default function LobbyGeometry({ platforms }) {
    const [techFloor, stoneTiles, mossBlock, hazardStripes, energyOrbs, woodPlanks] = useLoader(THREE.TextureLoader, TEXTURE_PATHS);
    const [crateModel, benchModel, crystalModel, pillarModel] = useLoader(OBJLoader, MODEL_PATHS);

    const textures = useMemo(() => {
        prepareTexture(techFloor, 7, 7);
        prepareTexture(stoneTiles, 5, 5);
        prepareTexture(mossBlock, 5, 5);
        prepareTexture(hazardStripes, 4, 4);
        prepareTexture(energyOrbs, 2, 2);
        prepareTexture(woodPlanks, 4, 4);
        return { techFloor, stoneTiles, mossBlock, hazardStripes, energyOrbs, woodPlanks };
    }, [techFloor, stoneTiles, mossBlock, hazardStripes, energyOrbs, woodPlanks]);

    const platformTextureMap = useMemo(() => {
        const variants = {};

        for (const [platformId, rule] of Object.entries(PLATFORM_TEXTURE_RULES)) {
            const baseTexture = textures[rule.key];
            if (!baseTexture) continue;

            const variant = baseTexture.clone();
            prepareTexture(variant, rule.repeat[0], rule.repeat[1]);
            variants[platformId] = variant;
        }

        return variants;
    }, [textures]);

    return (
        <>
            {platforms.map((platform) => (
                <mesh key={platform.id} castShadow receiveShadow position={platform.position}>
                    <boxGeometry args={platform.size} />
                    <meshStandardMaterial
                        color={platform.color}
                        roughness={0.82}
                        metalness={0.1}
                        map={platformTextureMap[platform.id] || null}
                    />
                </mesh>
            ))}

            <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
                <planeGeometry args={[280, 280]} />
                <meshStandardMaterial color="#0f172a" roughness={1} metalness={0} map={textures.hazardStripes} />
            </mesh>

            <mesh castShadow receiveShadow position={[0, 2.1, -13]}>
                <boxGeometry args={[5.5, 4.2, 0.8]} />
                <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.12} />
            </mesh>

            <mesh castShadow receiveShadow position={[-31, 13.2, -20]}>
                <cylinderGeometry args={[0.8, 1.1, 4, 12]} />
                <meshStandardMaterial color="#e879f9" emissive="#701a75" emissiveIntensity={0.45} />
            </mesh>

            <mesh castShadow receiveShadow position={[-27, 6.2, 34]}>
                <cylinderGeometry args={[0.9, 1.2, 3.2, 12]} />
                <meshStandardMaterial color="#f59e0b" emissive="#78350f" emissiveIntensity={0.42} />
            </mesh>

            <mesh castShadow receiveShadow position={[31, 4.9, -4]}>
                <cylinderGeometry args={[0.75, 1.0, 3, 12]} />
                <meshStandardMaterial color="#2dd4bf" emissive="#134e4a" emissiveIntensity={0.4} />
            </mesh>

            <mesh castShadow receiveShadow position={[0, 0.4, 0]}>
                <cylinderGeometry args={[3.2, 3.8, 0.5, 32]} />
                <meshStandardMaterial color="#64748b" roughness={0.5} metalness={0.25} />
            </mesh>

            <ObjProp model={benchModel} position={[0, SURFACE_EPSILON, -6.8]} scale={1.2} color="#7c5a3f" />
            <ObjProp model={benchModel} position={[0, SURFACE_EPSILON, 6.8]} rotation={[0, Math.PI, 0]} scale={1.2} color="#7c5a3f" />

            <ObjProp model={crateModel} position={[8, SURFACE_EPSILON, 7]} scale={1.1} color="#8b6b47" />
            <ObjProp model={crateModel} position={[-7.4, SURFACE_EPSILON, 7]} scale={1.1} color="#8b6b47" />
            <ObjProp model={crateModel} position={[7.8, SURFACE_EPSILON, -7]} scale={0.9} color="#8b6b47" />

            <ObjProp model={pillarModel} position={[29.5, 2.95, -4]} scale={1.2} color="#22d3ee" emissive="#155e75" emissiveIntensity={0.25} />
            <ObjProp model={pillarModel} position={[-31, 11.8, -20]} scale={1.45} color="#c084fc" emissive="#581c87" emissiveIntensity={0.35} />
            <ObjProp model={pillarModel} position={[-27, 5.6, 34]} scale={1.2} color="#f59e0b" emissive="#78350f" emissiveIntensity={0.3} />

            <ObjProp model={crystalModel} position={[24.8, 3.95, -10]} scale={1.25} color="#5eead4" emissive="#0f766e" emissiveIntensity={0.28} />
            <ObjProp model={crystalModel} position={[-30, 6.5, -20]} scale={1.5} color="#d8b4fe" emissive="#7e22ce" emissiveIntensity={0.32} />
            <ObjProp model={crystalModel} position={[-24.5, 4.85, 33.2]} scale={1.25} color="#fbbf24" emissive="#92400e" emissiveIntensity={0.24} />

            {[...BRIDGE_IDS].map((bridgeId) => {
                const bridge = platforms.find((platform) => platform.id === bridgeId);
                if (!bridge) return null;

                const [x, y, z] = bridge.position;
                const [sx, sy, sz] = bridge.size;
                const isNorthSouth = bridgeId === 'north-bridge' || bridgeId === 'south-bridge';

                return (
                    <mesh key={`${bridgeId}-decal`} receiveShadow position={[x, y + sy * 0.5 + SURFACE_EPSILON, z]} rotation={[-Math.PI / 2, 0, isNorthSouth ? 0 : Math.PI / 2]}>
                        <planeGeometry args={[isNorthSouth ? sx * 0.85 : sz * 0.85, isNorthSouth ? sz * 0.85 : sx * 0.85]} />
                        <meshStandardMaterial
                            map={textures.hazardStripes}
                            color="#facc15"
                            transparent={false}
                            opacity={1}
                            depthWrite={false}
                            polygonOffset
                            polygonOffsetFactor={-2}
                            polygonOffsetUnits={-2}
                        />
                    </mesh>
                );
            })}
        </>
    );
}
