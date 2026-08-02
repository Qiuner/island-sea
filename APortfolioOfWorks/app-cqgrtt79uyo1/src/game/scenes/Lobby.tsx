import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody } from '@react-three/rapier';
import { useGameStore, playerPosRef } from '../store/useGameStore';
import Player from '../components/Player';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

const Portal = ({ position, level, name, color }: { position: [number, number, number], level: 1 | 2 | 3 | 4 | 5, name: string, color: string }) => {
  const portalPos = new THREE.Vector3(...position);
  const [isActive, setIsActive] = useState(false);
  const setScreen = useGameStore(state => state.setScreen);
  const setLevel = useGameStore(state => state.setLevel);
  const setStoryPhase = useGameStore(state => state.setStoryPhase);
  const setInteraction = useGameStore(state => state.setInteraction);
  const maxUnlockedLevel = useGameStore(state => state.maxUnlockedLevel);

  const isUnlocked = level <= maxUnlockedLevel;

  useFrame(() => {
    const dist = playerPosRef.current.distanceTo(portalPos);
    if (dist < 4) {
      if (!isActive) {
        setIsActive(true);
        if (isUnlocked) {
          setInteraction(`按 E 进入 [${name}]`, null);
        } else {
          setInteraction(`[锁定] ${name} (需通关上一关)`, null);
        }
      }
    } else {
      if (isActive) {
        setIsActive(false);
        setInteraction(null, null);
      }
    }
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'e' && isActive && isUnlocked) {
        setInteraction(null, null);
        setLevel(level);
        setStoryPhase('pre');
        setScreen('story');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isActive, isUnlocked, level, setLevel, setScreen, setStoryPhase, setInteraction]);

  return (
    <group position={position}>
      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2, 3, 32]} />
        <meshBasicMaterial color={isUnlocked ? color : '#555555'} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[2, 2, 4, 32]} />
        <meshBasicMaterial color={isUnlocked ? color : '#555555'} transparent opacity={0.2} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <pointLight position={[0, 2, 0]} color={isUnlocked ? color : '#555555'} intensity={isUnlocked ? 2 : 0.5} distance={10} />
      <Html position={[0, 5, 0]} center>
        <div className={`bg-black bg-opacity-75 text-white px-4 py-2 rounded-xl text-lg font-bold border-2 whitespace-nowrap`} style={{ borderColor: isUnlocked ? color : '#555555' }}>
          {isUnlocked ? name : `🔒 ${name}`}
        </div>
      </Html>
    </group>
  );
};

export default function Lobby() {
  const setInteraction = useGameStore(state => state.setInteraction);

  // 清除之前可能的交互提示
  useEffect(() => {
    setInteraction(null, null);
  }, [setInteraction]);

  return (
    <group>
      {/* 玩家初始位置 */}
      <Player position={[0, 2, 0]} />

      {/* 岛屿地面 */}
      <RigidBody type="fixed" position={[0, -0.5, 0]}>
        <mesh receiveShadow>
          <cylinderGeometry args={[40, 40, 1, 64]} />
          <meshStandardMaterial color="#228B22" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* 岛屿水面 */}
      <mesh position={[0, -1.5, 0]} receiveShadow>
        <cylinderGeometry args={[80, 80, 1, 64]} />
        <meshStandardMaterial color="#3498DB" transparent opacity={0.8} />
      </mesh>

      {/* 装饰物：树木/山石 */}
      <RigidBody type="fixed" position={[-15, 2, -15]}>
        <mesh castShadow position={[0, 2, 0]}>
          <coneGeometry args={[3, 8, 8]} />
          <meshStandardMaterial color="#006400" />
        </mesh>
        <mesh castShadow position={[0, -2, 0]}>
          <cylinderGeometry args={[1, 1, 4]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
      </RigidBody>

      <RigidBody type="fixed" position={[20, 3, -10]}>
        <mesh castShadow>
          <dodecahedronGeometry args={[4]} />
          <meshStandardMaterial color="#7F8C8D" />
        </mesh>
      </RigidBody>

      <RigidBody type="fixed" position={[-20, 2, 15]}>
        <mesh castShadow>
          <dodecahedronGeometry args={[3]} />
          <meshStandardMaterial color="#95A5A6" />
        </mesh>
      </RigidBody>

      {/* 传送门：五个关卡 */}
      <Portal position={[0, 0, -20]} level={1} name="第1关: 宇宙赛道" color="#F39C12" />
      <Portal position={[18, 0, -10]} level={2} name="第2关: 消失星台" color="#E74C3C" />
      <Portal position={[12, 0, 15]} level={3} name="第3关: 捉迷藏" color="#9B59B6" />
      <Portal position={[-12, 0, 15]} level={4} name="第4关: 核心掠夺" color="#F1C40F" />
      <Portal position={[-18, 0, -10]} level={5} name="第5关: 超然竞技场" color="#3498DB" />
    </group>
  );
}