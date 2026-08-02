import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import { useKeyboard } from '../hooks/useKeyboard';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useArenaStore, arenaPositionsRef } from '../store/useArenaStore';
import { playerPosRef, playerDirRef } from '../store/useGameStore';

export default function ArenaPlayer({ id, initialPosition }: { id: string, initialPosition: [number, number, number] }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const keys = useKeyboard();
  const applyDamage = useArenaStore(state => state.applyDamage);
  const applyShield = useArenaStore(state => state.applyShield);
  const applyStatus = useArenaStore(state => state.applyStatus);
  const applyHeal = useArenaStore(state => state.applyHeal);
  const setPlayerCooldown = useArenaStore(state => state.setPlayerCooldown);
  const playerCooldowns = useArenaStore(state => state.playerCooldowns);
  
  // 角色状态
  const pState = useArenaStore(state => state.players[id]);
  const playerCards = useArenaStore(state => state.playerCards);
  const phase = useArenaStore(state => state.phase);
  
  const speedRef = useRef(5);
  const lastAttackTime = useRef(0);
  const lastHealTime = useRef(0);

  const [color] = useState('#3498DB'); // 蓝球颜色
  const [effect, setEffect] = useState<'q' | 'w' | 'e' | 'attack' | null>(null);

  const triggerEffect = React.useCallback((type: 'q' | 'w' | 'e' | 'attack') => {
    setEffect(type);
    setTimeout(() => setEffect(null), 300);
  }, []);

  useFrame((state, delta) => {
    if (!bodyRef.current || !pState || pState.isDead) return;

    const pos = bodyRef.current.translation();
    playerPosRef.current.set(pos.x, pos.y, pos.z);
    arenaPositionsRef.current[id] = [pos.x, pos.y, pos.z];

    // 相机跟随
    const idealCameraPos = new THREE.Vector3(pos.x, pos.y + 5, pos.z + 8);
    state.camera.position.lerp(idealCameraPos, 0.1);
    state.camera.lookAt(pos.x, pos.y + 1, pos.z);

    if (phase !== 'playing') return;

    // 控制判定
    const now = Date.now();
    if (now < pState.frozenUntil || now < pState.stunnedUntil) {
      return; // 无法移动和攻击
    }

    const dir = new THREE.Vector3();
    if (keys.forward) dir.z -= 1;
    if (keys.backward) dir.z += 1;
    if (keys.left) dir.x -= 1;
    if (keys.right) dir.x += 1;

    if (dir.lengthSq() > 0) {
      dir.normalize();
      playerDirRef.current.copy(dir);
      
      let speed = speedRef.current;
      if (playerCards[id] === 'speed') speed *= 1.4;
      
      bodyRef.current.setLinvel({ x: dir.x * speed, y: bodyRef.current.linvel().y, z: dir.z * speed }, true);
    } else {
      bodyRef.current.setLinvel({ x: 0, y: bodyRef.current.linvel().y, z: 0 }, true);
    }

    if (keys.jump && Math.abs(bodyRef.current.linvel().y) < 0.1) {
      bodyRef.current.applyImpulse({ x: 0, y: 5, z: 0 }, true);
    }
    
    // 更新冷却 (交由 store 中统一 tick 或者由组件自身更新)
    if (playerCooldowns[0] > 0) setPlayerCooldown(0, Math.max(0, playerCooldowns[0] - delta));
    if (playerCooldowns[1] > 0) setPlayerCooldown(1, Math.max(0, playerCooldowns[1] - delta));
    if (playerCooldowns[2] > 0) setPlayerCooldown(2, Math.max(0, playerCooldowns[2] - delta));
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'playing') return;
      if (!pState || pState.isDead) return;
      const now = Date.now();
      if (now < pState.frozenUntil || now < pState.stunnedUntil) return;

      const key = e.key.toLowerCase();
      
      if (key === ' ' || key === 'spacebar') {
        e.preventDefault(); // 防止滚动网页
        executeBasicAttack();
        return;
      }
      
      let dmgMult = 1;
      if (playerCards[id] === 'strength') dmgMult = 1.5;

      // 寻找前方目标
      const findTargetsInFront = (range: number, radius: number) => {
        const targets: string[] = [];
        const pPos = playerPosRef.current;
        const pDir = playerDirRef.current;
        const currentPositions = arenaPositionsRef.current;
        Object.entries(currentPositions).forEach(([targetId, tPosArr]) => {
          if (targetId === id || targetId.startsWith(`t${pState.team}_`)) return; // 忽略自己和队友
          const tPos = new THREE.Vector3(...tPosArr);
          const dist = pPos.distanceTo(tPos);
          if (dist < range) {
            const dirToTarget = tPos.clone().sub(pPos).normalize();
            if (pDir.dot(dirToTarget) > Math.cos(Math.PI / 4)) { // 45度扇形
              targets.push(targetId);
            }
          }
        });
        return targets;
      };

      const findNearestEnemy = (range: number) => {
        const pPos = playerPosRef.current;
        const currentPositions = arenaPositionsRef.current;
        let nearest: string | null = null;
        let minDist = range;
        Object.entries(currentPositions).forEach(([targetId, tPosArr]) => {
          if (targetId === id || targetId.startsWith(`t${pState.team}_`)) return;
          const tPos = new THREE.Vector3(...tPosArr);
          const dist = pPos.distanceTo(tPos);
          if (dist < minDist) {
            minDist = dist;
            nearest = targetId;
          }
        });
        return nearest;
      };

      if (key === 'q' && playerCooldowns[0] === 0) {
        let cd = 10;
        if (pState.role === 'blue') {
          cd = 8;
          findTargetsInFront(8, 2).forEach(tid => { applyDamage(tid, 15 * dmgMult); applyStatus(tid, 'freeze', 2); });
        } else if (pState.role === 'red') {
          cd = 6;
          findTargetsInFront(5, 2).forEach(tid => applyDamage(tid, 20 * dmgMult));
        } else if (pState.role === 'pink') {
          cd = 12;
          applyHeal(`t${pState.team}_p2`, 30);
        } else if (pState.role === 'yellow') {
          cd = 8;
          const nearest = findNearestEnemy(5);
          if (nearest) { applyDamage(nearest, 10 * dmgMult); applyStatus(nearest, 'stun', 1); }
        } else if (pState.role === 'black') {
          cd = 10;
          const nearest = findNearestEnemy(5);
          if (nearest) applyDamage(nearest, 25 * dmgMult);
        }
        if (false) cd *= 0.7;
        setPlayerCooldown(0, cd);
        triggerEffect('q');
      } else if (key === 'w' && playerCooldowns[1] === 0) {
        let cd = 15;
        if (pState.role === 'blue') {
          applyShield(id, 30); applyShield(`t${pState.team}_p2`, 30);
        } else if (pState.role === 'red') {
          if (bodyRef.current) {
            const pos = bodyRef.current.translation();
            bodyRef.current.setTranslation({ x: pos.x + playerDirRef.current.x * 8, y: pos.y, z: pos.z + playerDirRef.current.z * 8 }, true);
            findTargetsInFront(8, 2).forEach(tid => applyDamage(tid, 10 * dmgMult));
          }
        } else if (pState.role === 'pink') {
          cd = 18;
          applyShield(id, 20); applyShield(`t${pState.team}_p2`, 20);
        } else if (pState.role === 'yellow') {
          cd = 12;
          applyShield(id, 50);
        } else if (pState.role === 'black') {
          cd = 18;
          const nearest = findNearestEnemy(5);
          if (nearest) { applyDamage(nearest, 15 * dmgMult); applyStatus(nearest, 'freeze', 2); }
        }
        if (false) cd *= 0.7;
        setPlayerCooldown(1, cd);
        triggerEffect('w');
      } else if (key === 'e' && playerCooldowns[2] === 0) {
        let cd = 10;
        if (pState.role === 'blue') {
          if (bodyRef.current) {
            const pos = bodyRef.current.translation();
            bodyRef.current.setTranslation({ x: pos.x + playerDirRef.current.x * 5, y: pos.y, z: pos.z + playerDirRef.current.z * 5 }, true);
          }
        } else if (pState.role === 'red') {
          cd = 20;
          const pPos = playerPosRef.current;
          Object.entries(arenaPositionsRef.current).forEach(([tid, tPosArr]) => {
            if (tid === id || tid.startsWith(`t${pState.team}_`)) return;
            if (pPos.distanceTo(new THREE.Vector3(...tPosArr)) < 5) applyStatus(tid, 'stun', 2);
          });
        } else if (pState.role === 'pink') {
          cd = 15;
          const pPos = playerPosRef.current;
          Object.entries(arenaPositionsRef.current).forEach(([tid, tPosArr]) => {
            if (tid === id || tid.startsWith(`t${pState.team}_`)) return;
            if (pPos.distanceTo(new THREE.Vector3(...tPosArr)) < 8) applyStatus(tid, 'stun', 1.5);
          });
        } else if (pState.role === 'yellow') {
          cd = 16;
          applyHeal(id, 40);
        } else if (pState.role === 'black') {
          cd = 14;
          const nearest = findNearestEnemy(5);
          if (nearest) applyDamage(nearest, 40 * dmgMult);
        }
        if (false) cd *= 0.7;
        setPlayerCooldown(2, cd);
        triggerEffect('e');
      }
    };

    const executeBasicAttack = () => {
      if (phase !== 'playing') return;
      if (!pState || pState.isDead) return;
      const now = Date.now();
      if (now - lastAttackTime.current < 500) return; // 0.5s atk speed
      if (now < pState.frozenUntil || now < pState.stunnedUntil) return;

      lastAttackTime.current = now;

      let dmgMult = 1;
      if (playerCards[id] === 'strength') dmgMult = 1.5;

      const pPos = playerPosRef.current;
      const currentPositions = arenaPositionsRef.current;

      // 自动寻找最近的敌人进行攻击
      let minD = 5; // 攻击距离 5
      let target: string | null = null;
      Object.entries(currentPositions).forEach(([targetId, tPosArr]) => {
        if (targetId === id || targetId.startsWith(`t${pState.team}_`)) return;
        const tPos = new THREE.Vector3(...tPosArr);
        const dist = pPos.distanceTo(tPos);
        if (dist < minD) {
          minD = dist;
          target = targetId;
        }
      });

      if (target) {
        applyDamage(target, 10 * dmgMult);
        triggerEffect('attack');
      }
    };

    const handleMouseClick = (e: MouseEvent) => {
      if (e.button !== 2) return; // 仅右键
      executeBasicAttack();
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault(); // 屏蔽右键菜单
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseClick);
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseClick);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [pState, playerCooldowns, playerCards, id, applyDamage, applyShield, applyStatus, setPlayerCooldown, phase, applyHeal, triggerEffect]);

  if (!pState || pState.isDead) return null;

  const isFrozen = Date.now() < pState.frozenUntil;
  const isStunned = Date.now() < pState.stunnedUntil;

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
          <span className="text-white text-xs font-bold drop-shadow-md bg-black/50 px-2 rounded-full mb-1">
            你 ({pState.role})
          </span>
          <div className="w-full h-2 bg-gray-800 rounded-full border border-gray-900 overflow-hidden relative">
            <div className="h-full bg-green-500 transition-all" style={{ width: `${(pState.hp / pState.maxHp) * 100}%` }} />
            {pState.shield > 0 && (
              <div className="absolute top-0 right-0 h-full bg-blue-400 opacity-50" style={{ width: `${(pState.shield / pState.maxHp) * 100}%` }} />
            )}
          </div>
        </div>
      </Html>
    </RigidBody>
  );
}