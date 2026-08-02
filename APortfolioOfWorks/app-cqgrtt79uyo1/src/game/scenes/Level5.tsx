import React, { useEffect } from 'react';
import { useArenaStore } from '../store/useArenaStore';
import { useGameStore } from '../store/useGameStore';
import { RigidBody } from '@react-three/rapier';
import ArenaPlayer from '../components/ArenaPlayer';
import ArenaAI from '../components/ArenaAI';

export default function Level5() {
  const phase = useArenaStore(state => state.phase);
  const playerDeaths = useArenaStore(state => state.playerDeaths);
  const initArena = useArenaStore(state => state.initArena);
  const startBattle = useArenaStore(state => state.startBattle);
  const checkGameOver = useArenaStore(state => state.checkGameOver);
  const endGame = useGameStore(state => state.endGame);
  
  useEffect(() => {
    initArena();
  }, [initArena]);
  
  useEffect(() => {
    if (phase === 'intro') {
      const timer = setTimeout(() => startBattle(), 3000); // 配合3秒倒计时
      return () => clearTimeout(timer);
    } else if (phase === 'game_over') {
      const t1p1 = playerDeaths['t1_p1'] >= 5;
      const t1p2 = playerDeaths['t1_p2'] >= 5;
      if (t1p1 && t1p2) {
        setTimeout(() => endGame('lose', { score: 1 }), 2000);
      } else {
        setTimeout(() => endGame('win', { score: 1 }), 2000);
      }
    }
  }, [phase, startBattle, endGame, playerDeaths]);

  // 定期检查存活状态
  useEffect(() => {
    if (phase === 'playing') {
      const timer = setInterval(() => checkGameOver(), 1000);
      return () => clearInterval(timer);
    }
  }, [phase, checkGameOver]);

  const SPAWN_POS = {
    't1_p1': [14, 2, 14],
    't1_p2': [12, 2, 14],
    't2_p1': [14, 2, -14],
    't2_p2': [12, 2, -14],
    't3_p1': [-14, 2, 14],
    't3_p2': [-12, 2, 14],
    't4_p1': [-14, 2, -14],
    't4_p2': [-12, 2, -14],
  } as Record<string, [number, number, number]>;

  return (
    <>
      <group>
        <RigidBody type="fixed" friction={1}>
          <mesh receiveShadow position={[0, -0.5, 0]}>
            <cylinderGeometry args={[20, 20, 1, 64]} />
            <meshStandardMaterial color="#6C3483" roughness={0.8} />
          </mesh>
        </RigidBody>

        {/* 隐形空气墙 防止掉落 */}
        <RigidBody type="fixed" position={[0, 5, -20]}>
          <mesh visible={false}><boxGeometry args={[40, 10, 2]} /><meshBasicMaterial /></mesh>
        </RigidBody>
        <RigidBody type="fixed" position={[0, 5, 20]}>
          <mesh visible={false}><boxGeometry args={[40, 10, 2]} /><meshBasicMaterial /></mesh>
        </RigidBody>
        <RigidBody type="fixed" position={[-20, 5, 0]}>
          <mesh visible={false}><boxGeometry args={[2, 10, 40]} /><meshBasicMaterial /></mesh>
        </RigidBody>
        <RigidBody type="fixed" position={[20, 5, 0]}>
          <mesh visible={false}><boxGeometry args={[2, 10, 40]} /><meshBasicMaterial /></mesh>
        </RigidBody>
        
        {/* 障碍物 */}
        <RigidBody type="fixed" position={[5, 1, 5]}>
          <mesh castShadow><boxGeometry args={[4,4,4]} /><meshStandardMaterial color="#34495E" /></mesh>
        </RigidBody>
        <RigidBody type="fixed" position={[-5, 1, -5]}>
          <mesh castShadow><boxGeometry args={[4,4,4]} /><meshStandardMaterial color="#34495E" /></mesh>
        </RigidBody>
        <RigidBody type="fixed" position={[8, 1, -8]}>
          <mesh castShadow><boxGeometry args={[3,6,3]} /><meshStandardMaterial color="#2C3E50" /></mesh>
        </RigidBody>
        <RigidBody type="fixed" position={[-8, 1, 8]}>
          <mesh castShadow><boxGeometry args={[3,6,3]} /><meshStandardMaterial color="#2C3E50" /></mesh>
        </RigidBody>

        {/* Entities */}
        {phase === 'playing' && (
          <group>
            {(playerDeaths['t1_p1'] || 0) < 5 && <ArenaPlayer id="t1_p1" initialPosition={SPAWN_POS['t1_p1']} />}
            {(playerDeaths['t1_p2'] || 0) < 5 && <ArenaAI id="t1_p2" initialPosition={SPAWN_POS['t1_p2']} />}
            {(playerDeaths['t2_p1'] || 0) < 5 && <ArenaAI id="t2_p1" initialPosition={SPAWN_POS['t2_p1']} />}
            {(playerDeaths['t2_p2'] || 0) < 5 && <ArenaAI id="t2_p2" initialPosition={SPAWN_POS['t2_p2']} />}
            {(playerDeaths['t3_p1'] || 0) < 5 && <ArenaAI id="t3_p1" initialPosition={SPAWN_POS['t3_p1']} />}
            {(playerDeaths['t3_p2'] || 0) < 5 && <ArenaAI id="t3_p2" initialPosition={SPAWN_POS['t3_p2']} />}
            {(playerDeaths['t4_p1'] || 0) < 5 && <ArenaAI id="t4_p1" initialPosition={SPAWN_POS['t4_p1']} />}
            {(playerDeaths['t4_p2'] || 0) < 5 && <ArenaAI id="t4_p2" initialPosition={SPAWN_POS['t4_p2']} />}
          </group>
        )}
      </group>
    </>
  );
}