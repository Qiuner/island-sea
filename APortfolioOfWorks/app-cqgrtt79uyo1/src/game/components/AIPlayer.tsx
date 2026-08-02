import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import { useGameStore, playerPosRef } from '../store/useGameStore';
import * as THREE from 'three';

interface AIPlayerProps {
  position?: [number, number, number];
  color?: string;
  name?: string;
  target?: THREE.Vector3;
  speedMultiplier?: number;
}

const BASE_SPEED = 10;
const MAX_VELOCITY = 8;

export default function AIPlayer({ position = [2, 2, 0], color = "#E74C3C", name = "enemy", target, speedMultiplier = 1 }: AIPlayerProps) {
  const body = useRef<RapierRigidBody>(null);
  const direction = new THREE.Vector3();
  const lastDashTime = useRef(Date.now() + Math.random() * 2000);

  useFrame(() => {
    if (!body.current) return;

    let actualTarget = target || playerPosRef.current;
    if (!actualTarget) return;

    const pos = body.current.translation();
    const currentPos = new THREE.Vector3(pos.x, pos.y, pos.z);
    const store = useGameStore.getState();

    // 如果是第二关 (大逃杀)，增加推人机制
    if (store.currentLevel === 2) {
      const distToPlayer = currentPos.distanceTo(playerPosRef.current);
      if (distToPlayer < 8) {
        // 距离近时直接将目标设为玩家，试图将玩家推下去
        actualTarget = playerPosRef.current;
        // 每 2 秒进行一次冲撞攻击
        if (Date.now() - lastDashTime.current > 2000) {
          const dashDir = new THREE.Vector3().subVectors(playerPosRef.current, currentPos).normalize();
          body.current.applyImpulse({ x: dashDir.x * 8, y: 0, z: dashDir.z * 8 }, true);
          lastDashTime.current = Date.now();
        }
      } else {
        // 距离远时保持向中心移动，避免自己掉下去
        actualTarget = new THREE.Vector3(0, 0, 0);
      }
    }
    
    direction.subVectors(actualTarget, currentPos);
    direction.y = 0; 
    
    if (direction.length() > 0.5) {
      direction.normalize().multiplyScalar(BASE_SPEED * speedMultiplier);
      body.current.applyImpulse({ x: direction.x * 0.1, y: 0, z: direction.z * 0.1 }, true);
    }

    const currentVel = body.current.linvel();
    const horizontalVel = new THREE.Vector2(currentVel.x, currentVel.z);
    if (horizontalVel.length() > MAX_VELOCITY) {
      horizontalVel.normalize().multiplyScalar(MAX_VELOCITY);
      body.current.setLinvel({ x: horizontalVel.x, y: currentVel.y, z: horizontalVel.y }, true);
    }

    // 更新进度
    if (store.gameStatus === 'playing') {
      store.updateProgress(name, pos.z);
    }
  });

  return (
    <RigidBody 
      ref={body} 
      position={position} 
      colliders="ball" 
      restitution={0.6} 
      friction={1} 
      linearDamping={2} 
      angularDamping={2}
      name={name}
    >
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} roughness={0.2} metalness={0.8} />
      </mesh>
      
      <mesh position={[0.2, 0.2, 0.4]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <mesh position={[-0.2, 0.2, 0.4]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <mesh position={[0.2, 0.2, 0.48]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshBasicMaterial color="black" />
      </mesh>
      <mesh position={[-0.2, 0.2, 0.48]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshBasicMaterial color="black" />
      </mesh>
    </RigidBody>
  );
}
