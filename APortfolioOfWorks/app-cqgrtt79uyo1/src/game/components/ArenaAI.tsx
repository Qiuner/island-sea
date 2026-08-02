import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useArenaStore, arenaPositionsRef } from '../store/useArenaStore';

const ROLE_COLORS = {
  blue: '#3498DB',
  pink: '#FF69B4',
  red: '#E74C3C',
  yellow: '#F1C40F',
  black: '#2C3E50'
};

export default function ArenaAI({ id, initialPosition }: { id: string, initialPosition: [number, number, number] }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const pState = useArenaStore(state => state.players[id]);
  const applyDamage = useArenaStore(state => state.applyDamage);
  const applyHeal = useArenaStore(state => state.applyHeal);
  const applyShield = useArenaStore(state => state.applyShield);
  const applyStatus = useArenaStore(state => state.applyStatus);
  const playerCards = useArenaStore(state => state.playerCards);
  const phase = useArenaStore(state => state.phase);

  // 内部状态
  const targetIdRef = useRef<string | null>(null);
  const lastAttackTime = useRef(0);
  
  const [effect, setEffect] = useState<'q' | 'w' | 'e' | 'attack' | null>(null);

  const triggerEffect = (type: 'q' | 'w' | 'e' | 'attack') => {
    setEffect(type);
    setTimeout(() => setEffect(null), 300);
  };

  // 技能 CD (Q, W, E)
  const cds = useRef([0, 0, 0]);

  // 获取技能基础CD
  const getBaseCDs = () => {
    switch (pState?.role) {
      case 'blue': return [8, 15, 10];
      case 'red': return [6, 15, 20];
      case 'pink': return [12, 18, 15];
      case 'yellow': return [8, 12, 16];
      case 'black': return [10, 18, 14];
      default: return [10, 10, 10];
    }
  };

  const getDmgMult = () => {
    if (!pState) return 1;
    let mult = 1;
    if (playerCards[id] === 'strength') mult = 1.5;
    return mult;
  };

  useFrame((state, delta) => {
    if (!bodyRef.current || !pState || pState.isDead) return;

    const pos = bodyRef.current.translation();
    const myPos = new THREE.Vector3(pos.x, pos.y, pos.z);
    arenaPositionsRef.current[id] = [pos.x, pos.y, pos.z];

    if (phase !== 'playing') {
      bodyRef.current.setLinvel({ x: 0, y: bodyRef.current.linvel().y, z: 0 }, true);
      return;
    }

    const now = Date.now();
    if (now < pState.frozenUntil || now < pState.stunnedUntil) {
       bodyRef.current.setLinvel({ x: 0, y: bodyRef.current.linvel().y, z: 0 }, true);
       return;
    }

    // 寻找最近的敌人
    let minD = Infinity;
    let nearest: string | null = null;
    let nearestPos: THREE.Vector3 | null = null;
    const currentPositions = arenaPositionsRef.current;

    Object.entries(currentPositions).forEach(([tid, tPosArr]) => {
      if (tid === id || tid.startsWith(`t${pState.team}_`)) return;
      const tPos = new THREE.Vector3(...tPosArr);
      const d = myPos.distanceTo(tPos);
      if (d < minD) {
        minD = d;
        nearest = tid;
        nearestPos = tPos;
      }
    });

    targetIdRef.current = nearest;

    let speed = 4;
    if (playerCards[id] === 'speed') speed *= 1.5;

    if (nearestPos !== null && minD > 2) {
      const posVec = nearestPos as THREE.Vector3;
      const dir = posVec.clone().sub(myPos).normalize();
      bodyRef.current.setLinvel({ x: dir.x * speed, y: bodyRef.current.linvel().y, z: dir.z * speed }, true);
    } else {
      bodyRef.current.setLinvel({ x: 0, y: bodyRef.current.linvel().y, z: 0 }, true);
    }

    // 冷却更新
    for (let i = 0; i < 3; i++) {
      if (cds.current[i] > 0) cds.current[i] = Math.max(0, cds.current[i] - delta);
    }

    const mult = getDmgMult();

    // 普攻
    if (nearest && minD < 3 && now - lastAttackTime.current > 1000) {
      lastAttackTime.current = now;
      applyDamage(nearest, 10 * mult);
      triggerEffect('attack');
    }

    // 自动放技能
    if (nearest && nearestPos) {
      let cdRate = 1;
      const base = getBaseCDs();

      if (pState.role === 'blue') {
        if (cds.current[0] === 0 && minD < 8) {
          applyDamage(nearest, 15 * mult);
          applyStatus(nearest, 'freeze', 2);
          cds.current[0] = base[0] * cdRate;
          triggerEffect('q');
        }
        if (cds.current[1] === 0 && pState.hp < pState.maxHp * 0.7) {
          applyShield(id, 30);
          applyShield(`t${pState.team}_p${id.endsWith('p1') ? '2' : '1'}`, 30);
          cds.current[1] = base[1] * cdRate;
          triggerEffect('w');
        }
        if (cds.current[2] === 0 && minD > 5 && minD < 15) {
          const nPos = nearestPos as THREE.Vector3;
          bodyRef.current.setTranslation({ x: pos.x + (nPos.x - pos.x) * 0.5, y: pos.y, z: pos.z + (nPos.z - pos.z) * 0.5 }, true);
          cds.current[2] = base[2] * cdRate;
          triggerEffect('e');
        }
      } 
      else if (pState.role === 'red') {
        if (cds.current[0] === 0 && minD < 5) {
          applyDamage(nearest, 20 * mult);
          cds.current[0] = base[0] * cdRate;
          triggerEffect('q');
        }
        if (cds.current[1] === 0 && minD > 5 && minD < 12) {
          const nPos = nearestPos as THREE.Vector3;
          bodyRef.current.setTranslation({ x: pos.x + (nPos.x - pos.x) * 0.8, y: pos.y, z: pos.z + (nPos.z - pos.z) * 0.8 }, true);
          applyDamage(nearest, 10 * mult);
          cds.current[1] = base[1] * cdRate;
          triggerEffect('w');
        }
        if (cds.current[2] === 0 && minD < 5) {
          Object.entries(currentPositions).forEach(([tid, tPosArr]) => {
            if (tid.startsWith(`t${pState.team}_`)) return;
            if (myPos.distanceTo(new THREE.Vector3(...tPosArr)) < 5) applyStatus(tid, 'stun', 2);
          });
          cds.current[2] = base[2] * cdRate;
          triggerEffect('e');
        }
      }
      else if (pState.role === 'pink') {
        const teammateId = `t${pState.team}_p${id.endsWith('p1') ? '2' : '1'}`;
        const teammate = useArenaStore.getState().players[teammateId];
        
        if (cds.current[0] === 0 && teammate && !teammate.isDead && teammate.hp < teammate.maxHp * 0.7) {
          applyHeal(teammateId, 30);
          cds.current[0] = base[0] * cdRate;
          triggerEffect('q');
        }
        if (cds.current[1] === 0 && pState.hp < pState.maxHp * 0.8) {
          applyShield(id, 20); applyShield(teammateId, 20);
          cds.current[1] = base[1] * cdRate;
          triggerEffect('w');
        }
        if (cds.current[2] === 0 && minD < 8) {
          Object.entries(currentPositions).forEach(([tid, tPosArr]) => {
            if (tid.startsWith(`t${pState.team}_`)) return;
            if (myPos.distanceTo(new THREE.Vector3(...tPosArr)) < 8) applyStatus(tid, 'stun', 1.5);
          });
          cds.current[2] = base[2] * cdRate;
          triggerEffect('e');
        }
      }
      else if (pState.role === 'yellow') {
        if (cds.current[0] === 0 && minD < 5) {
          applyDamage(nearest, 10 * mult);
          applyStatus(nearest, 'stun', 1);
          cds.current[0] = base[0] * cdRate;
          triggerEffect('q');
        }
        if (cds.current[1] === 0 && pState.hp < pState.maxHp * 0.6) {
          applyShield(id, 50);
          cds.current[1] = base[1] * cdRate;
          triggerEffect('w');
        }
        if (cds.current[2] === 0 && pState.hp < pState.maxHp * 0.5) {
          applyHeal(id, 40);
          cds.current[2] = base[2] * cdRate;
          triggerEffect('e');
        }
      }
      else if (pState.role === 'black') {
        if (cds.current[0] === 0 && minD < 5) {
          applyDamage(nearest, 25 * mult);
          cds.current[0] = base[0] * cdRate;
          triggerEffect('q');
        }
        if (cds.current[1] === 0 && minD < 5) {
          applyDamage(nearest, 15 * mult);
          applyStatus(nearest, 'freeze', 2);
          cds.current[1] = base[1] * cdRate;
          triggerEffect('w');
        }
        if (cds.current[2] === 0 && minD < 5) {
          applyDamage(nearest, 40 * mult);
          cds.current[2] = base[2] * cdRate;
          triggerEffect('e');
        }
      }
    }
  });

  if (!pState || pState.isDead) return null;

  const isFrozen = Date.now() < pState.frozenUntil;
  const isStunned = Date.now() < pState.stunnedUntil;
  const color = ROLE_COLORS[pState.role];

  return (
    <RigidBody ref={bodyRef} position={initialPosition} lockRotations colliders="ball">
      <mesh castShadow>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color={isFrozen ? '#A9CCE3' : isStunned ? '#F1C40F' : color} />
      </mesh>
      
      {/* 技能特效 */}
      {effect === 'attack' && (
        <mesh position={[0, 0, -1.5]}>
          <boxGeometry args={[0.5, 0.5, 3]} />
          <meshBasicMaterial color="white" transparent opacity={0.6} />
        </mesh>
      )}
      {effect === 'q' && (
        <mesh>
          <torusGeometry args={[2, 0.2, 16, 32]} />
          <meshBasicMaterial color="#3498DB" transparent opacity={0.8} />
        </mesh>
      )}
      {effect === 'w' && (
        <mesh>
          <sphereGeometry args={[1.5, 16, 16]} />
          <meshBasicMaterial color="#2ECC71" transparent opacity={0.5} wireframe />
        </mesh>
      )}
      {effect === 'e' && (
        <mesh>
          <torusGeometry args={[4, 0.1, 16, 64]} />
          <meshBasicMaterial color="#E74C3C" transparent opacity={0.8} />
        </mesh>
      )}

      {pState.shield > 0 && (
        <mesh>
          <sphereGeometry args={[1.2, 16, 16]} />
          <meshBasicMaterial color="#3498DB" transparent opacity={0.3} />
        </mesh>
      )}
      <Html position={[0, 1.5, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="flex flex-col items-center select-none w-32">
          <span className={`text-white text-xs font-bold drop-shadow-md bg-black/50 px-2 rounded-full mb-1 ${pState.team === 1 ? 'text-blue-300' : 'text-red-400'}`}>
            {pState.team === 1 ? '队友' : `敌方 T${pState.team}`} ({pState.role})
          </span>
          <div className="w-full h-2 bg-gray-800 rounded-full border border-gray-900 overflow-hidden relative">
            <div className={`h-full transition-all ${pState.team === 1 ? 'bg-blue-500' : 'bg-red-500'}`} style={{ width: `${(pState.hp / pState.maxHp) * 100}%` }} />
            {pState.shield > 0 && (
              <div className="absolute top-0 right-0 h-full bg-blue-400 opacity-50" style={{ width: `${(pState.shield / pState.maxHp) * 100}%` }} />
            )}
          </div>
        </div>
      </Html>
    </RigidBody>
  );
}