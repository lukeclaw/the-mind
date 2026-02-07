import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky, Stats } from '@react-three/drei';
import CharacterController from './threeD/CharacterController';
import LobbyGeometry from './threeD/LobbyGeometry';
import { LOBBY_OBJECT_COLLIDERS, LOBBY_OBJECTS, LOBBY_PLATFORMS, PLATFORM_COLLIDERS } from './threeD/levelData';

export default function ThreeDPlatformer({ onLeave, playerName = 'Player' }) {
    const colliders = useMemo(() => [...PLATFORM_COLLIDERS, ...LOBBY_OBJECT_COLLIDERS], []);

    return (
        <div className="three-d-game">
            <Canvas shadows camera={{ position: [0, 5, 10], fov: 55 }}>
                <color attach="background" args={['#0b1220']} />
                <fog attach="fog" args={['#0b1220', 20, 90]} />

                <ambientLight intensity={0.5} />
                <directionalLight
                    castShadow
                    position={[14, 20, 8]}
                    intensity={1.25}
                    shadow-mapSize-width={2048}
                    shadow-mapSize-height={2048}
                />

                <Sky distance={450000} sunPosition={[5, 1, 8]} inclination={0.5} azimuth={0.2} />
                <Stats showPanel={0} />

                <LobbyGeometry platforms={LOBBY_PLATFORMS} objects={LOBBY_OBJECTS} />
                <CharacterController playerName={playerName} colliders={colliders} />
            </Canvas>

            <div className="three-d-overlay">
                <div className="three-d-help">Click scene to lock mouse. Move: WASD. Sprint: Shift. Jump: Space.</div>
                <button className="btn btn-secondary btn-small" onClick={onLeave}>Leave Game</button>
            </div>
        </div>
    );
}
