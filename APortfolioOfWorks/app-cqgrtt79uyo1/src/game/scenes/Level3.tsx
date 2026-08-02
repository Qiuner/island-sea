import React, { useEffect, useState } from 'react';
import { RigidBody } from '@react-three/rapier';
import Player from '../components/Player';
import AIPlayer from '../components/AIPlayer';
import { useGameStore } from '../store/useGameStore';
import * as THREE from 'three';

const MAZE_SIZE = 40;

export default function Level3() {
  const updateTimeLeft = useGameStore(state => state.updateTimeLeft);
  const endGame = useGameStore(state => state.endGame);
  const gameStatus = useGameStore(state => state.gameStatus);

  const [timeLeft, setTimeLeft] = useState(30); // 30秒

  useEffect(() => {
    if (gameStatus !== 'playing') return;

    // 进入第三关时重置时间
    updateTimeLeft(30);

    const timer = setInterval(() => {
      setTimeLeft(t => {
        const next = t - 1;
        updateTimeLeft(next);
        if (next <= 0) {
          endGame('win', { score: 30 });
          clearInterval(timer);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStatus, endGame, updateTimeLeft]);

  // 生成简单的迷宫墙壁
  const walls = [
    // 外墙
    { pos: [0, 10, -20], size: [40, 20, 1] },
    { pos: [0, 10, 20], size: [40, 20, 1] },
    { pos: [-20, 10, 0], size: [1, 20, 40] },
    { pos: [20, 10, 0], size: [1, 20, 40] },
    // 内部掩体
    { pos: [-10, 10, -10], size: [8, 20, 2] },
    { pos: [10, 10, 10], size: [2, 20, 12] },
    { pos: [5, 10, -5], size: [12, 20, 2] },
    { pos: [-5, 10, 10], size: [8, 20, 2] },
    { pos: [-15, 10, 5], size: [2, 20, 8] },
    { pos: [15, 10, -15], size: [2, 20, 8] },
  ];

  return (
    <>
      {/* 地面/赛道 */}
      <RigidBody type="fixed" restitution={0.2} friction={1}>
        <mesh receiveShadow position={[0, -0.5, 0]}>
          <boxGeometry args={[MAZE_SIZE, 1, MAZE_SIZE]} />
          <meshStandardMaterial color="#16A085" />
        </mesh>
      </RigidBody>

      {/* 墙壁/掩体 */}
      {walls.map((w, i) => (
        <RigidBody key={i} type="fixed" position={w.pos as [number, number, number]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={w.size as [number, number, number]} />
            <meshStandardMaterial color="#34495E" transparent opacity={0.5} />
          </mesh>
        </RigidBody>
      ))}
      
      {/* 玩家 */}
      <Player position={[0, 2, 0]} />

      {/* AI 追捕者，只要不传 target 就会默认追玩家 (修改后的AIPlayer逻辑) */}
      <AIPlayer position={[15, 2, 15]} color="#E74C3C" name="AI_CATCHER_1" speedMultiplier={0.8} />
      <AIPlayer position={[-15, 2, -15]} color="#C0392B" name="AI_CATCHER_2" speedMultiplier={0.85} />
    </>
  );
}
