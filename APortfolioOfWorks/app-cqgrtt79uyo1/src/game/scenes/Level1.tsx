import React, { useEffect, useRef } from 'react';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../store/useGameStore';
import Player from '../components/Player';
import AIPlayer from '../components/AIPlayer';
import * as THREE from 'three';

const TRACK_LENGTH = 150;
const FINISH_Z = -TRACK_LENGTH;

export default function Level1() {
  const endGame = useGameStore(state => state.endGame);
  const updateRank = useGameStore(state => state.updateRank);
  
  // 用于动态给 AI 设定目标
  const ai1Target = useRef(new THREE.Vector3(0, 0, FINISH_Z - 10));
  const ai2Target = useRef(new THREE.Vector3(0, 0, FINISH_Z - 10));
  
  useFrame(() => {
    const store = useGameStore.getState();
    if (store.gameStatus !== 'playing') return;

    const progress = store.progress;
    if (!progress.player) return;

    // 根据 Z 轴排序，值越小越靠前
    const racers = [
      { id: 'player', z: progress.player || 0 },
      { id: 'AI1', z: progress.AI1 || 0 },
      { id: 'AI2', z: progress.AI2 || 0 },
    ];
    
    racers.sort((a, b) => a.z - b.z);
    const playerRank = racers.findIndex(r => r.id === 'player') + 1;
    
    if (store.rank !== playerRank) {
      updateRank(playerRank);
    }

    // 终点判断
    if (progress.player <= FINISH_Z) {
      endGame('win', { rank: playerRank });
    } else if (progress.AI1 <= FINISH_Z || progress.AI2 <= FINISH_Z) {
      // 别人先到，稍微延迟一点算玩家失败，让玩家看到别人赢了
      endGame('lose', { rank: playerRank });
    }
  });

  return (
    <>
      {/* 赛道 */}
      <RigidBody type="fixed" restitution={0.2} friction={1}>
        <mesh receiveShadow position={[0, -0.5, -TRACK_LENGTH/2]}>
          <boxGeometry args={[20, 1, TRACK_LENGTH + 20]} />
          <meshStandardMaterial color="#2C3E50" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* 终点线 */}
      <RigidBody type="fixed">
        <mesh position={[0, 0.1, FINISH_Z]}>
          <boxGeometry args={[20, 0.2, 2]} />
          <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.5} />
        </mesh>
      </RigidBody>

      {/* 一些障碍物 */}
      {Array.from({ length: 10 }).map((_, i) => (
        <RigidBody key={i} type="fixed" position={[(Math.random() - 0.5) * 15, 0.5, -15 - i * 12]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[1, 1, 1, 16]} />
            <meshStandardMaterial color="#E74C3C" />
          </mesh>
        </RigidBody>
      ))}

      {/* 加速带/弹簧 (这里仅做简单的固定碰撞体，可以让玩家跳过去) */}
      {Array.from({ length: 5 }).map((_, i) => (
        <RigidBody key={`jump_${i}`} type="fixed" position={[(Math.random() - 0.5) * 10, 0, -25 - i * 25]} restitution={1.5}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[4, 0.5, 4]} />
            <meshStandardMaterial color="#00BFFF" emissive="#00BFFF" emissiveIntensity={0.5} />
          </mesh>
        </RigidBody>
      ))}
      
      {/* 玩家 */}
      <Player position={[0, 2, 0]} />
      
      {/* AI */}
      <AIPlayer position={[3, 2, 0]} color="#9B59B6" name="AI1" target={ai1Target.current} speedMultiplier={0.9} />
      <AIPlayer position={[-3, 2, 0]} color="#E67E22" name="AI2" target={ai2Target.current} speedMultiplier={0.85} />
    </>
  );
}
