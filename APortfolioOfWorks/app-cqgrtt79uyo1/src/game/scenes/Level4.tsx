import React, { useEffect, useState, useRef } from 'react';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { playerPosRef, useGameStore, playerDirRef } from '../store/useGameStore';
import Player from '../components/Player';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';

// 墙壁组件
const Wall = ({ position, args, color = '#334455' }: { position: [number, number, number], args: [number, number, number], color?: string }) => (
  <RigidBody type="fixed" position={position}>
    <mesh castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
    </mesh>
  </RigidBody>
);

// 楼梯组件 (斜坡)
const Stairs = ({ position, rotation, length = 14, height = 10 }: { position: [number, number, number], rotation: [number, number, number], length?: number, height?: number }) => {
  const angle = Math.atan2(height, length);
  const hypotenuse = Math.sqrt(length * length + height * height);
  
  return (
    <RigidBody type="fixed" position={position} rotation={[rotation[0] + angle, rotation[1], rotation[2]]}>
      <mesh receiveShadow castShadow>
        <boxGeometry args={[4, 0.5, hypotenuse]} />
        <meshStandardMaterial color="#445566" metalness={0.9} roughness={0.5} emissive="#00aa00" emissiveIntensity={0.2} />
      </mesh>
      <pointLight position={[0, 2, 0]} color="#00ff00" intensity={1} distance={15} />
    </RigidBody>
  );
};

// 宝箱组件
const Chest = ({ id, type, position }: { id: string, type: 'wood' | 'silver' | 'gold', position: [number, number, number] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const setInteraction = useGameStore(state => state.setInteraction);

  const chestPos = new THREE.Vector3(...position);
  const colors = { wood: '#8B5A2B', silver: '#C0C0C0', gold: '#FFD700' };
  const values = {
    wood: () => Math.floor(Math.random() * 23 + 1) * 10000,
    silver: () => Math.floor(Math.random() * 50 + 1) * 10000,
    gold: () => Math.floor(Math.random() * 100 + 1) * 10000
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'e' && !isOpen) {
        const dist = playerPosRef.current.distanceTo(chestPos);
        if (dist < 3) setIsOpening(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'e') {
        setIsOpening(false);
        setProgress(0);
        setInteraction(null, null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isOpen, chestPos, setInteraction]);

  useFrame((state, delta) => {
    if (isOpen) return;

    const dist = playerPosRef.current.distanceTo(chestPos);
    
    if (dist < 3) {
      if (isOpening) {
        // 如果背包满了，打断
        const store = useGameStore.getState();
        if (store.inventoryCount >= 10) {
          setInteraction('背包已满！', null);
          setIsOpening(false);
          setProgress(0);
          return;
        }

        const nextProg = progress + delta / 2; // 2秒读满
        setProgress(nextProg);
        setInteraction('正在开启...', nextProg);
        
        if (nextProg >= 1) {
          setIsOpen(true);
          setIsOpening(false);
          setInteraction('获得核心能量！', null);
          setTimeout(() => setInteraction(null, null), 1500);
          
          store.updateInventory(store.inventoryCount + 1);
          store.updateMoney(store.totalMoney + values[type]());
        }
      } else {
        // 没有在开，但靠近
        const store = useGameStore.getState();
        if (store.interactionText !== '正在开启...') {
           setInteraction('按 E 开启宝箱', null);
        }
      }
    } else {
      if (isOpening) {
        setIsOpening(false);
        setProgress(0);
        setInteraction(null, null);
      }
    }
  });

  return (
    <RigidBody type="fixed" position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={isOpen ? '#333333' : colors[type]} />
      </mesh>
    </RigidBody>
  );
};

// 机械守卫组件
const Guard = ({ initialPosition }: { initialPosition: [number, number, number] }) => {
  const body = useRef<any>(null);
  const [hp, setHp] = useState(90);
  const [isDead, setIsDead] = useState(false);
  const [isLooted, setIsLooted] = useState(false);
  
  const lastProcessedAttackTime = useRef(0);
  const nextAttackPlayerTime = useRef(0);

  // 简单游荡点
  const spawnPos = new THREE.Vector3(...initialPosition);
  const targetWanderPos = useRef(new THREE.Vector3(...initialPosition));
  const changeWanderTime = useRef(0);

  useFrame((state, delta) => {
    if (isDead) {
      if (!isLooted) {
        const store = useGameStore.getState();
        const dist = playerPosRef.current.distanceTo(new THREE.Vector3().copy(body.current?.translation() || spawnPos));
        if (dist < 3) {
          store.setInteraction('按 E 搜刮', null);
        }
      }
      return;
    }

    if (!body.current) return;

    const pos = body.current.translation();
    const guardPos = new THREE.Vector3(pos.x, pos.y, pos.z);
    const store = useGameStore.getState();
    const now = performance.now();

    // 1. 处理受击
    if (store.lastAttackTime !== lastProcessedAttackTime.current) {
      lastProcessedAttackTime.current = store.lastAttackTime;
      const dist = guardPos.distanceTo(playerPosRef.current);
      if (dist < 3.5) {
        // 判断是否在玩家前方 (夹角 < 60度)
        const dirToGuard = guardPos.clone().sub(playerPosRef.current).normalize();
        const angle = dirToGuard.angleTo(playerDirRef.current);
        if (angle < Math.PI / 3) {
          const damage = store.weapon === 'harpoon' ? 30 : (store.weapon === 'shovel' ? 20 : 0);
          if (damage > 0) {
            const nextHp = hp - damage;
            setHp(nextHp);
            if (nextHp <= 0) {
              setIsDead(true);
              return;
            }
          }
        }
      }
    }

    // 2. AI行为
    const distToPlayer = guardPos.distanceTo(playerPosRef.current);
    const dir = new THREE.Vector3();

    if (distToPlayer < 12) {
      // 追击玩家
      dir.subVectors(playerPosRef.current, guardPos).normalize();
      
      // 如果距离小于2米，并且CD好了，攻击玩家
      if (distToPlayer < 2 && now > nextAttackPlayerTime.current) {
        nextAttackPlayerTime.current = now + 1500; // 1.5s cd
        const currentHp = store.hp;
        if (currentHp > 0) {
          const nextPlayerHp = Math.max(0, currentHp - 30);
          store.updateHp(nextPlayerHp);
          if (nextPlayerHp <= 0) {
            store.endGame('lose');
          }
        }
      }
    } else {
      // 游荡
      if (now > changeWanderTime.current) {
        changeWanderTime.current = now + 3000 + Math.random() * 2000;
        targetWanderPos.current.set(
          spawnPos.x + (Math.random() - 0.5) * 10,
          pos.y,
          spawnPos.z + (Math.random() - 0.5) * 10
        );
      }
      if (guardPos.distanceTo(targetWanderPos.current) > 1) {
        dir.subVectors(targetWanderPos.current, guardPos).normalize();
      }
    }

    // 移动
    dir.y = 0;
    if (dir.lengthSq() > 0.1) {
      body.current.applyImpulse({ x: dir.x * 2, y: 0, z: dir.z * 2 }, true);
    }
    
    // 限速
    const vel = body.current.linvel();
    const speedLimit = distToPlayer < 12 ? 4 : 2;
    const hVel = new THREE.Vector2(vel.x, vel.z);
    if (hVel.length() > speedLimit) {
      hVel.normalize().multiplyScalar(speedLimit);
      body.current.setLinvel({ x: hVel.x, y: vel.y, z: hVel.y }, true);
    }
  });

  // 处理搜刮
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'e' && isDead && !isLooted) {
        const dist = playerPosRef.current.distanceTo(new THREE.Vector3().copy(body.current?.translation() || spawnPos));
        if (dist < 3) {
          setIsLooted(true);
          const store = useGameStore.getState();
          store.setInteraction('搜刮获得小额能量', null);
          setTimeout(() => store.setInteraction(null, null), 1500);
          store.updateMoney(store.totalMoney + Math.floor(Math.random() * 4 + 1) * 10000);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDead, isLooted, spawnPos]);

  return (
    <RigidBody ref={body} type="dynamic" position={initialPosition} colliders="ball" linearDamping={5}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color={isDead ? '#333333' : '#E74C3C'} emissive={isDead ? '#000' : '#FF0000'} emissiveIntensity={0.5} />
      </mesh>
    </RigidBody>
  );
};

// 撤离舱组件
const EvacPod = ({ position }: { position: [number, number, number] }) => {
  const [isInteracting, setIsInteracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState<'submit' | 'extract' | null>(null);

  const setInteraction = useGameStore(state => state.setInteraction);

  const podPos = new THREE.Vector3(...position);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'e') {
        const store = useGameStore.getState();
        const dist = playerPosRef.current.distanceTo(podPos);
        if (dist < 4) {
          if (store.inventoryCount > 0) {
            setMode('submit');
            setIsInteracting(true);
          } else if (store.totalMoney >= 150000) {
            setMode('extract');
            setIsInteracting(true);
          }
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'e') {
        setIsInteracting(false);
        setProgress(0);
        setInteraction(null, null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [podPos, setInteraction]);

  useFrame((state, delta) => {
    const store = useGameStore.getState();
    const dist = playerPosRef.current.distanceTo(podPos);

    if (dist < 4) {
      if (isInteracting && mode) {
        const targetTime = mode === 'submit' ? 3 : 5;
        const nextProg = progress + delta / targetTime;
        setProgress(nextProg);
        
        if (mode === 'submit') {
          setInteraction('正在上交物资...', nextProg);
        } else {
          setInteraction('正在准备撤离...', nextProg);
        }

        if (nextProg >= 1) {
          setIsInteracting(false);
          if (mode === 'submit') {
            store.updateInventory(0);
            setInteraction('物资上交成功！', null);
            setTimeout(() => setInteraction(null, null), 1500);
          } else if (mode === 'extract') {
            store.endGame('win', { score: store.totalMoney });
            store.setExtractedStatus('success');
            setInteraction(null, null);
          }
        }
      } else {
        if (store.interactionText !== '正在开启...') {
          if (store.inventoryCount > 0) {
            setInteraction('按 E 键上交物资 (3秒)', null);
          } else if (store.totalMoney >= 150000) {
            setInteraction('按 E 键撤离 (5秒)', null);
          } else {
            setInteraction('撤离门槛：150000，当前未满足', null);
          }
        }
      }
    } else {
      if (isInteracting) {
        setIsInteracting(false);
        setProgress(0);
        setInteraction(null, null);
      }
    }
  });

  return (
    <mesh position={[position[0], 0.1, position[2]]} rotation={[-Math.PI/2, 0, 0]}>
      <ringGeometry args={[3, 4, 32]} />
      <meshBasicMaterial color="#00ff00" transparent opacity={0.8} />
    </mesh>
  );
};

const WOOD_CHEST_SPAWNS: [number,number,number][] = [[10,0.5,10], [-15,0.5,-20], [20,0.5,-15], [-25,0.5,25], [0,0.5,20], [-10,0.5,0], [25,0.5,15]];
const SILVER_CHEST_SPAWNS: [number,number,number][] = [[10,10.5,-10], [-5,10.5,-10], [0,10.5,20], [20,10.5,20], [-20,10.5,-20], [-15,10.5,10]];
const GOLD_CHEST_SPAWNS: [number,number,number][] = [[10,20.5,25], [-10,20.5,-5], [0,20.5,10], [-25,20.5,15], [20,20.5,-20]];

// 障碍物建筑
const Obstacle = ({ position, args, color = '#2c1e2c' }: { position: [number, number, number], args: [number, number, number], color?: string }) => (
  <RigidBody type="fixed" position={position}>
    <mesh castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} metalness={0.6} roughness={0.8} />
    </mesh>
  </RigidBody>
);

export default function Level4() {
  const gameStatus = useGameStore(state => state.gameStatus);
  const updateTimeLeft = useGameStore(state => state.updateTimeLeft);
  const endGame = useGameStore(state => state.endGame);

  const [timeLeft, setTimeLeft] = useState(900); // 15分钟 = 900秒
  const [chests, setChests] = useState<{id: string, type: 'wood'|'silver'|'gold', pos: [number,number,number]}[]>([]);

  useEffect(() => {
    if (gameStatus !== 'playing') return;
    updateTimeLeft(900);

    const pickRandom = (arr: [number,number,number][], count: number) => {
      const shuffled = [...arr].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
    };

    setChests([
      ...pickRandom(WOOD_CHEST_SPAWNS, 4).map((pos, i) => ({ id: `w${i}`, type: 'wood' as const, pos })),
      ...pickRandom(SILVER_CHEST_SPAWNS, 3).map((pos, i) => ({ id: `s${i}`, type: 'silver' as const, pos })),
      ...pickRandom(GOLD_CHEST_SPAWNS, 2).map((pos, i) => ({ id: `g${i}`, type: 'gold' as const, pos }))
    ]);

    const timer = setInterval(() => {
      setTimeLeft(t => {
        const next = t - 1;
        updateTimeLeft(next);
        if (next <= 0) {
          endGame('lose'); // 超时失败
          clearInterval(timer);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStatus, updateTimeLeft, endGame]);

  return (
    <group>
      {/* 第四关特定光照：外星战场 */}
      <ambientLight color="#ffcccc" intensity={0.4} />
      <pointLight position={[0, 25, 0]} color="#aa44ff" intensity={1} distance={50} />
      <pointLight position={[15, 5, 15]} color="#ff4444" intensity={1} distance={30} />
      <pointLight position={[-15, 15, -15]} color="#44ffaa" intensity={1} distance={30} />

      {/* 玩家起始于1楼 */}
      <Player position={[0, 2, 0]} />

      {/* 第一层 (宽敞) */}
      <RigidBody type="fixed" position={[0, -0.5, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[60, 1, 60]} />
          <meshStandardMaterial color="#3b1513" metalness={0.5} roughness={0.8} />
        </mesh>
      </RigidBody>
      {/* 一楼边界墙 */}
      <Wall position={[0, 2, -30]} args={[60, 6, 1]} color="#261026" />
      <Wall position={[0, 2, 30]} args={[60, 6, 1]} color="#261026" />
      <Wall position={[-30, 2, 0]} args={[1, 6, 60]} color="#261026" />
      <Wall position={[30, 2, 0]} args={[1, 6, 60]} color="#261026" />

      {/* 障碍物 */}
      <Obstacle position={[12, 1, -12]} args={[4, 6, 4]} />
      <Obstacle position={[-18, 1, 15]} args={[6, 4, 3]} />
      <Obstacle position={[5, 1, 20]} args={[3, 5, 8]} />

      {/* 楼梯 1楼到2楼 */}
      <Stairs position={[20, 4.5, 0]} rotation={[0, Math.PI/2, 0]} length={15} height={10} />

      {/* 第二层 (带楼梯口) */}
      <RigidBody type="fixed" position={[0, 9.5, -15]}>
        <mesh receiveShadow>
          <boxGeometry args={[60, 1, 30]} />
          <meshStandardMaterial color="#2a0f0e" metalness={0.6} roughness={0.7} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" position={[-10, 9.5, 15]}>
        <mesh receiveShadow>
          <boxGeometry args={[40, 1, 30]} />
          <meshStandardMaterial color="#2a0f0e" metalness={0.6} roughness={0.7} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" position={[25, 9.5, 15]}>
        <mesh receiveShadow>
          <boxGeometry args={[10, 1, 30]} />
          <meshStandardMaterial color="#2a0f0e" metalness={0.6} roughness={0.7} />
        </mesh>
      </RigidBody>
      {/* 楼梯1->2口的洞在 x=15到20 之间, z=0到30 之间 */}
      {/* 二楼边界墙 */}
      <Wall position={[0, 12, -30]} args={[60, 6, 1]} color="#261026" />
      <Wall position={[0, 12, 30]} args={[60, 6, 1]} color="#261026" />
      <Wall position={[-30, 12, 0]} args={[1, 6, 60]} color="#261026" />
      <Wall position={[30, 12, 0]} args={[1, 6, 60]} color="#261026" />
      {/* 二楼房间隔断 */}
      <Wall position={[-15, 12, 0]} args={[30, 6, 1]} color="#381c38" />
      <Wall position={[0, 12, 15]} args={[1, 6, 30]} color="#381c38" />
      <Wall position={[15, 12, -15]} args={[1, 6, 30]} color="#381c38" />

      {/* 二楼障碍物 */}
      <Obstacle position={[-5, 11, -22]} args={[5, 8, 5]} />
      <Obstacle position={[22, 11, 22]} args={[4, 4, 4]} />

      {/* 楼梯 2楼到3楼 */}
      <Stairs position={[-20, 14.5, 20]} rotation={[0, 0, 0]} length={15} height={10} />

      {/* 第三层 (带楼梯口) */}
      <RigidBody type="fixed" position={[10, 19.5, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[40, 1, 60]} />
          <meshStandardMaterial color="#1c0a0a" metalness={0.7} roughness={0.6} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" position={[-20, 19.5, -15]}>
        <mesh receiveShadow>
          <boxGeometry args={[20, 1, 30]} />
          <meshStandardMaterial color="#1c0a0a" metalness={0.7} roughness={0.6} />
        </mesh>
      </RigidBody>
      {/* 楼梯2->3口的洞在 x=-30到-10 之间, z=0到30 之间 */}
      {/* 三楼边界墙 */}
      <Wall position={[0, 22, -30]} args={[60, 6, 1]} color="#261026" />
      <Wall position={[0, 22, 30]} args={[60, 6, 1]} color="#261026" />
      <Wall position={[-30, 22, 0]} args={[1, 6, 60]} color="#261026" />
      <Wall position={[30, 22, 0]} args={[1, 6, 60]} color="#261026" />

      {/* 三楼障碍物 */}
      <Obstacle position={[5, 21, 5]} args={[8, 4, 2]} />
      <Obstacle position={[-15, 21, -20]} args={[4, 10, 4]} />
      <Obstacle position={[25, 21, -15]} args={[3, 5, 3]} />

      {/* 撤离舱位置提示 (1楼中心) */}
      <EvacPod position={[0, 0, 0]} />
      
      {/* 随机宝箱 */}
      {chests.map(c => (
        <Chest key={c.id} id={c.id} type={c.type} position={c.pos} />
      ))}

      {/* 机械守卫 */}
      <Guard initialPosition={[15, 0.5, 15]} />
      <Guard initialPosition={[-15, 0.5, 15]} />
      
      <Guard initialPosition={[0, 10.5, -15]} />
      <Guard initialPosition={[-10, 10.5, 20]} />
      <Guard initialPosition={[20, 10.5, -5]} />

      <Guard initialPosition={[0, 20.5, 15]} />
      <Guard initialPosition={[20, 20.5, 15]} />
      <Guard initialPosition={[-20, 20.5, -15]} />
      <Guard initialPosition={[0, 20.5, -20]} />

    </group>
  );
}