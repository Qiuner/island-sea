import React, { useState, useEffect, useRef } from 'react';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useGameStore } from '../store/useGameStore';
import Player from '../components/Player';
import AIPlayer from '../components/AIPlayer';
import * as THREE from 'three';

interface PlatformData {
  id: string;
  x: number;
  z: number;
  state: 'normal' | 'warning' | 'fallen';
}

export default function Level2() {
  const endGame = useGameStore(state => state.endGame);
  const updateSurvivors = useGameStore(state => state.updateSurvivors);
  
  const [platforms, setPlatforms] = useState<PlatformData[]>(() => {
    const arr: PlatformData[] = [];
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        arr.push({ id: `p_${i}_${j}`, x: i * 4.5, z: j * 4.5, state: 'normal' });
      }
    }
    return arr;
  });

  const [survivors, setSurvivors] = useState<string[]>(['player', 'AI1', 'AI2', 'AI3']);
  
  const ai1Target = useRef(new THREE.Vector3(0, 0, 0));
  const ai2Target = useRef(new THREE.Vector3(0, 0, 0));
  const ai3Target = useRef(new THREE.Vector3(0, 0, 0));

  // 平台消失逻辑
  useEffect(() => {
    const interval = setInterval(() => {
      setPlatforms(prev => {
        const next = [...prev];
        const normals = next.filter(p => p.state === 'normal');
        if (normals.length > 0) {
          const randomIndex = Math.floor(Math.random() * normals.length);
          normals[randomIndex].state = 'warning';
          
          setTimeout(() => {
            setPlatforms(current => {
              const updated = [...current];
              const p = updated.find(p => p.id === normals[randomIndex].id);
              if (p) p.state = 'fallen';
              return updated;
            });
          }, 2000); // 2秒后掉落
        }
        return next;
      });
    }, 3000); // 每3秒触发一次

    return () => clearInterval(interval);
  }, []);

  // AI 寻路逻辑
  useEffect(() => {
    const aiInterval = setInterval(() => {
      const activePlatforms = platforms.filter(p => p.state === 'normal');
      if (activePlatforms.length > 0) {
        const p1 = activePlatforms[Math.floor(Math.random() * activePlatforms.length)];
        const p2 = activePlatforms[Math.floor(Math.random() * activePlatforms.length)];
        const p3 = activePlatforms[Math.floor(Math.random() * activePlatforms.length)];
        ai1Target.current.set(p1.x, 0, p1.z);
        ai2Target.current.set(p2.x, 0, p2.z);
        ai3Target.current.set(p3.x, 0, p3.z);
      }
    }, 1000);
    return () => clearInterval(aiInterval);
  }, [platforms]);

  // 处理淘汰
  const handleFall = (name: string) => {
    if (!survivors.includes(name)) return;
    
    setSurvivors(prev => {
      const next = prev.filter(s => s !== name);
      updateSurvivors(next.length);
      
      if (name === 'player') {
        endGame('lose', { survivors: next.length });
      } else if (next.length === 1 && next.includes('player')) {
        endGame('win', { survivors: 1 });
      }
      return next;
    });
  };

  return (
    <>
      {/* 平台阵列 */}
      {platforms.map(p => (
        p.state !== 'fallen' && (
          <RigidBody key={p.id} type="fixed" position={[p.x, -0.5, p.z]} restitution={0.2} friction={1}>
            <mesh receiveShadow>
              <boxGeometry args={[4, 1, 4]} />
              <meshStandardMaterial 
                color={p.state === 'warning' ? '#E74C3C' : '#8E44AD'} 
                emissive={p.state === 'warning' ? '#E74C3C' : '#000000'}
                emissiveIntensity={p.state === 'warning' ? 0.5 : 0}
              />
            </mesh>
          </RigidBody>
        )
      ))}

      {/* 死区：玩家掉落到 y=-5 以下即淘汰 */}
      <CuboidCollider 
        position={[0, -10, 0]} 
        args={[50, 1, 50]} 
        sensor 
        onIntersectionEnter={(payload) => {
          if (payload.other.rigidBodyObject?.name) {
            handleFall(payload.other.rigidBodyObject.name);
          }
        }} 
      />
      
      {/* 玩家与AI (只渲染存活的) */}
      {survivors.includes('player') && <Player position={[0, 2, 0]} />}
      {survivors.includes('AI1') && <AIPlayer position={[6, 2, 6]} color="#9B59B6" name="AI1" target={ai1Target.current} speedMultiplier={0.9} />}
      {survivors.includes('AI2') && <AIPlayer position={[-6, 2, -6]} color="#E67E22" name="AI2" target={ai2Target.current} speedMultiplier={0.8} />}
      {survivors.includes('AI3') && <AIPlayer position={[6, 2, -6]} color="#2ECC71" name="AI3" target={ai3Target.current} speedMultiplier={0.85} />}
    </>
  );
}
