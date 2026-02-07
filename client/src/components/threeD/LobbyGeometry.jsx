/**
 * Pure rendering component for lobby platforms and landmark props.
 * Collision is handled separately via derived colliders.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useLoader } from '@react-three/fiber';
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

const SURFACE_EPSILON = 0.03;

function prepareTexture(texture, repeatX, repeatY) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
}

function InstancedBoxBatch({ size, instances, materialConfig, texture }) {
    const meshRef = useRef();
    const dummy = useMemo(() => new THREE.Object3D(), []);

    useLayoutEffect(() => {
        if (!meshRef.current) return;

        instances.forEach((instance, index) => {
            dummy.position.set(instance.position[0], instance.position[1], instance.position[2]);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(index, dummy.matrix);
        });

        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [dummy, instances]);

    return (
        <instancedMesh ref={meshRef} args={[null, null, instances.length]} castShadow receiveShadow>
            <boxGeometry args={size} />
            <meshStandardMaterial
                color={materialConfig.color}
                roughness={materialConfig.roughness}
                metalness={materialConfig.metalness}
                map={texture}
            />
        </instancedMesh>
    );
}

function InstancedObjBatch({ model, instances, materialConfig }) {
    const meshRefs = useRef([]);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    const sourceMeshes = useMemo(() => {
        model.updateMatrixWorld(true);
        const meshes = [];
        model.traverse((child) => {
            if (child.isMesh) meshes.push(child);
        });
        return meshes;
    }, [model]);

    const transformedGeometries = useMemo(() => {
        return sourceMeshes.map((mesh) => {
            const geometry = mesh.geometry.clone();
            geometry.applyMatrix4(mesh.matrixWorld);
            return geometry;
        });
    }, [sourceMeshes]);

    const material = useMemo(() => {
        return new THREE.MeshStandardMaterial({
            color: materialConfig.color,
            roughness: 0.55,
            metalness: 0.2,
            emissive: materialConfig.emissive,
            emissiveIntensity: materialConfig.emissiveIntensity,
            transparent: false,
            opacity: 1,
            depthWrite: true,
            depthTest: true,
            side: THREE.DoubleSide
        });
    }, [materialConfig.color, materialConfig.emissive, materialConfig.emissiveIntensity]);

    useLayoutEffect(() => {
        transformedGeometries.forEach((_, meshIndex) => {
            const meshRef = meshRefs.current[meshIndex];
            if (!meshRef) return;

            instances.forEach((instance, instanceIndex) => {
                const rotation = instance.rotation || [0, 0, 0];
                dummy.position.set(instance.position[0], instance.position[1], instance.position[2]);
                dummy.rotation.set(rotation[0], rotation[1], rotation[2]);
                dummy.scale.setScalar(instance.scale ?? 1);
                dummy.updateMatrix();
                meshRef.setMatrixAt(instanceIndex, dummy.matrix);
            });

            meshRef.instanceMatrix.needsUpdate = true;
        });
    }, [dummy, instances, transformedGeometries]);

    return (
        <>
            {transformedGeometries.map((geometry, meshIndex) => (
                <instancedMesh
                    key={`obj-batch-${meshIndex}`}
                    ref={(node) => {
                        meshRefs.current[meshIndex] = node;
                    }}
                    args={[geometry, material, instances.length]}
                    castShadow
                    receiveShadow
                />
            ))}
        </>
    );
}

export default function LobbyGeometry({ platforms, objects }) {
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

    const modelMap = useMemo(() => ({
        crate: crateModel,
        bench: benchModel,
        crystal: crystalModel,
        pillar: pillarModel
    }), [crateModel, benchModel, crystalModel, pillarModel]);

    const objectBatches = useMemo(() => {
        const batches = new Map();

        for (const objectDef of objects) {
            const key = [
                objectDef.modelKey,
                objectDef.color || '#94a3b8',
                objectDef.emissive || '#000000',
                objectDef.emissiveIntensity || 0
            ].join('|');

            if (!batches.has(key)) {
                batches.set(key, {
                    key,
                    modelKey: objectDef.modelKey,
                    materialConfig: {
                        color: objectDef.color || '#94a3b8',
                        emissive: objectDef.emissive || '#000000',
                        emissiveIntensity: objectDef.emissiveIntensity || 0
                    },
                    instances: []
                });
            }

            batches.get(key).instances.push(objectDef);
        }

        return [...batches.values()];
    }, [objects]);

    const platformBatches = useMemo(() => {
        const batches = new Map();

        for (const platform of platforms) {
            const textureKey = platform.textureKey || 'none';
            const key = `${platform.type}|${textureKey}|${platform.color}`;

            if (!batches.has(key)) {
                const texture = textureKey !== 'none'
                    ? textures[textureKey].clone()
                    : null;

                if (texture && platform.textureRepeat) {
                    prepareTexture(texture, platform.textureRepeat[0], platform.textureRepeat[1]);
                }

                batches.set(key, {
                    key,
                    size: platform.size,
                    instances: [],
                    texture,
                    materialConfig: {
                        color: platform.color,
                        roughness: platform.roughness,
                        metalness: platform.metalness
                    }
                });
            }

            batches.get(key).instances.push(platform);
        }

        return [...batches.values()];
    }, [platforms, textures]);

    const bridgeDecals = useMemo(() => {
        return platforms.filter((platform) => platform.hazardDecal);
    }, [platforms]);

    return (
        <>
            {platformBatches.map((batch) => (
                <InstancedBoxBatch
                    key={batch.key}
                    size={batch.size}
                    instances={batch.instances}
                    materialConfig={batch.materialConfig}
                    texture={batch.texture}
                />
            ))}

            <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
                <planeGeometry args={[320, 320]} />
                <meshStandardMaterial color="#0f172a" roughness={1} metalness={0} map={textures.hazardStripes} />
            </mesh>

            {objectBatches.map((batch) => {
                const model = modelMap[batch.modelKey];
                if (!model) return null;

                return (
                    <InstancedObjBatch
                        key={batch.key}
                        model={model}
                        instances={batch.instances}
                        materialConfig={batch.materialConfig}
                    />
                );
            })}

            {bridgeDecals.map((platform) => {
                const [x, y, z] = platform.position;
                const [sx, sy, sz] = platform.size;
                const isNorthSouth = platform.hazardOrientation === 'ns';

                return (
                    <mesh
                        key={`${platform.id}-decal`}
                        receiveShadow
                        position={[x, y + sy * 0.5 + SURFACE_EPSILON, z]}
                        rotation={[-Math.PI / 2, 0, isNorthSouth ? 0 : Math.PI / 2]}
                    >
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
