import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Sky, Stars, OrbitControls } from '@react-three/drei';
import { useGameStore } from '../store/useGameStore';
import Level1 from './Level1';
import Level2 from './Level2';
import Level3 from './Level3';
import Level4 from './Level4';
import Level5 from './Level5';
import Lobby from './Lobby';
import HUD from '../ui/HUD';
import ArenaHUD from '../ui/ArenaHUD';

export const GameScene = () => {
  const currentLevel = useGameStore(state => state.currentLevel);
  const screen = useGameStore(state => state.screen);
  const levelKey = useGameStore(state => state.levelKey);
  
  // 只有在游戏进行或结算时才渲染对应的物理场景
  if (screen !== 'game' && screen !== 'result') return null;

  return (
    <>
      <Canvas shadows camera={{ position: [0, 15, 25], fov: 60 }}>
        {currentLevel === 5 && (
          <OrbitControls 
            makeDefault 
            enablePan={false} 
            maxPolarAngle={Math.PI / 2.2} 
            minPolarAngle={0} 
            minDistance={10}
            maxDistance={50}
          />
        )}
        <Suspense fallback={null}>
          <Sky sunPosition={[100, 20, 100]} />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          
          <ambientLight intensity={1.5} />
          <directionalLight castShadow position={[10, 20, 10]} intensity={1.5} shadow-mapSize={[2048, 2048]} />
          
          <Physics debug={false} key={levelKey}>
            {currentLevel === 0 && <Lobby />}
            {currentLevel === 1 && <Level1 />}
            {currentLevel === 2 && <Level2 />}
            {currentLevel === 3 && <Level3 />}
            {currentLevel === 4 && <Level4 />}
            {currentLevel === 5 && <Level5 />}
          </Physics>
        </Suspense>
      </Canvas>
      {screen === 'game' && currentLevel !== 5 && <HUD />}
      {screen === 'game' && currentLevel === 5 && <ArenaHUD />}
    </>
  );
};
