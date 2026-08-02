import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import { useKeyboard } from '../hooks/useKeyboard';
import { useGameStore, playerPosRef, playerDirRef } from '../store/useGameStore';
import * as THREE from 'three';

interface PlayerProps {
  position?: [number, number, number];
}

const SPEED = 12;
const JUMP_FORCE = 8;
const MAX_VELOCITY = 10;
const MIN_CAMERA_DIST = 3;
const MAX_CAMERA_DIST = 15;

export default function Player({ position = [0, 2, 0] }: PlayerProps) {
  const body = useRef<RapierRigidBody>(null);
  const keys = useKeyboard();
  const direction = new THREE.Vector3();
  const frontVector = new THREE.Vector3();
  const sideVector = new THREE.Vector3();
  const targetCameraPos = new THREE.Vector3();
  
  // 增加相机距离状态
  const cameraDistance = useRef(8);
  const cameraHeight = useRef(5);

  const currentLevel = useGameStore(state => state.currentLevel);
  const triggerAttack = useGameStore(state => state.triggerAttack);
  const setWeapon = useGameStore(state => state.setWeapon);
  const setHealing = useGameStore(state => state.setHealing);
  const interruptHealing = useGameStore(state => state.interruptHealing);

  // 监听武器切换
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentLevel === 4) {
        if (e.key === '1') setWeapon('harpoon');
        if (e.key === '2') setWeapon('shovel');
        if (e.key === '3') setWeapon('medkit');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentLevel, setWeapon]);

  // 处理攻击
  useEffect(() => {
    const handleMouseClick = (e: MouseEvent) => {
      if (currentLevel === 4 && e.button === 0) { // 左键
        const store = useGameStore.getState();
        if (store.weapon === 'medkit') {
          if (!store.isHealing && store.hp < 100) {
            setHealing(true, 0);
          } else if (store.hp >= 100) {
            store.setInteraction('血量已满！', null);
            setTimeout(() => store.setInteraction(null, null), 1500);
          }
        } else {
          if (!store.isHealing) {
            triggerAttack();
          }
        }
      }
    };
    window.addEventListener('mousedown', handleMouseClick);
    return () => window.removeEventListener('mousedown', handleMouseClick);
  }, [currentLevel, triggerAttack, setHealing]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // 滚轮向下放大距离，向上缩小距离
      const zoomSpeed = 0.5;
      cameraDistance.current += Math.sign(e.deltaY) * zoomSpeed;
      cameraDistance.current = Math.max(MIN_CAMERA_DIST, Math.min(MAX_CAMERA_DIST, cameraDistance.current));
      
      // 按比例调整高度
      cameraHeight.current = cameraDistance.current * 0.6;
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  useFrame((state, delta) => {
    if (!body.current) return;

    const pos = body.current.translation();
    
    // 更新相机位置 (平滑追尾)，采用可变的距离
    targetCameraPos.set(pos.x, pos.y + cameraHeight.current, pos.z + cameraDistance.current);
    state.camera.position.lerp(targetCameraPos, delta * 5);
    state.camera.lookAt(pos.x, pos.y + 1, pos.z);

    // 获取当前速度
    const velocity = body.current.linvel();
    const isGrounded = Math.abs(velocity.y) < 0.1; // 简单的着地检测，复杂场景需要射线

    const store = useGameStore.getState();
    const isMovingInput = keys.forward || keys.backward || keys.left || keys.right || keys.jump;

    if (store.isHealing) {
      if (isMovingInput) {
        interruptHealing();
      } else {
        const nextProgress = store.healProgress + delta / 5; // 5秒读条
        if (nextProgress >= 1) {
          const nextHp = Math.min(100, store.hp + 40);
          store.updateHp(nextHp);
          store.setInteraction('治疗完成！', null);
          setTimeout(() => store.setInteraction(null, null), 1500);
          // 在 updateHp 不会打断因为 hp 增加了
          interruptHealing(); 
        } else {
          setHealing(true, nextProgress);
          if (store.interactionText !== '正在治疗...') {
             store.setInteraction('正在治疗...', nextProgress);
          } else {
             useGameStore.setState({ interactionProgress: nextProgress });
          }
        }
      }
    }

    // 计算移动方向
    frontVector.set(0, 0, (keys.backward ? 1 : 0) - (keys.forward ? 1 : 0));
    sideVector.set((keys.left ? 1 : 0) - (keys.right ? 1 : 0), 0, 0);

    // 如果正在治疗，不允许移动
    if (store.isHealing) {
      frontVector.set(0, 0, 0);
      sideVector.set(0, 0, 0);
    }

    // 移动方向需要相对于相机的朝向，这样按 W 总是往相机看的方向走
    direction.subVectors(frontVector, sideVector).normalize();
    
    // 取相机Y轴旋转角度
    const euler = new THREE.Euler(0, state.camera.rotation.y, 0, 'YXZ');
    direction.applyEuler(euler).multiplyScalar(SPEED);

    // 应用力度
    body.current.applyImpulse({ x: direction.x * 0.1, y: 0, z: direction.z * 0.1 }, true);

    // 限制最大水平速度
    const currentVel = body.current.linvel();
    const horizontalVel = new THREE.Vector2(currentVel.x, currentVel.z);
    if (horizontalVel.length() > MAX_VELOCITY) {
      horizontalVel.normalize().multiplyScalar(MAX_VELOCITY);
      body.current.setLinvel({ x: horizontalVel.x, y: currentVel.y, z: horizontalVel.y }, true);
    }

    // 防掉出界重置
    if (pos.y < -20) {
      body.current.setTranslation({ x: 0, y: 5, z: pos.z }, true);
      body.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }

    // 跳跃
    if (keys.jump && isGrounded && !store.isHealing) {
      body.current.setLinvel({ x: currentVel.x, y: JUMP_FORCE, z: currentVel.z }, true);
    }

    // 更新进度
    if (store.gameStatus === 'playing') {
      store.updateProgress('player', pos.z);
    }

    // 全局玩家位置更新
    playerPosRef.current.set(pos.x, pos.y, pos.z);
    
    // 更新玩家朝向引用 (用相机的相反方向作为玩家的大致朝向)
    const euler2 = new THREE.Euler(0, state.camera.rotation.y, 0, 'YXZ');
    playerDirRef.current.set(0, 0, -1).applyEuler(euler2);
  });

  return (
    <RigidBody 
      ref={body} 
      position={position} 
      colliders="ball" 
      restitution={0.6} // 弹性
      friction={1} // 摩擦力
      linearDamping={2} // 线性阻尼，让球不按键时会停下
      angularDamping={2}
      name="player"
      onCollisionEnter={(payload) => {
        if (payload.other.rigidBodyObject?.name?.startsWith('AI_CATCHER')) {
          const store = useGameStore.getState();
          if (store.gameStatus === 'playing') {
            store.endGame('lose', { score: 30 - store.timeLeft });
          }
        }
      }}
    >
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color="#3498DB" emissive="#00BFFF" emissiveIntensity={0.2} roughness={0.2} metalness={0.8} />
      </mesh>
      
      {/* 简单的面部表情：两个眼睛 */}
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
