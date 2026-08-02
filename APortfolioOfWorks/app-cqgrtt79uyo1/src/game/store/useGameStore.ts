import { create } from 'zustand';
import * as THREE from 'three';

export type ScreenState = 'menu' | 'story' | 'game' | 'result';
export type LevelId = 0 | 1 | 2 | 3 | 4 | 5;
export type GameStatus = 'idle' | 'playing' | 'paused' | 'ended';
export type Weapon = 'harpoon' | 'shovel' | 'medkit';

interface GameState {
  screen: ScreenState;
  currentLevel: LevelId;
  storyPhase: 'pre' | 'post';
  gameStatus: GameStatus;
  gameResult: 'win' | 'lose' | null;
  score: number;       
  rank: number;        
  survivors: number;   
  timeLeft: number;    

  maxUnlockedLevel: number;
  returnToLobby: () => void;
  progress: Record<string, number>;
  levelKey: number;

  // 摸金关卡专用
  hp: number;
  inventoryCount: number;
  totalMoney: number;
  extractedStatus: 'success' | 'failed' | null;

  setScreen: (screen: ScreenState) => void;
  setLevel: (level: LevelId) => void;
  setStoryPhase: (phase: 'pre' | 'post') => void;
  startGame: () => void;
  endGame: (result: 'win' | 'lose', stats?: Partial<Pick<GameState, 'score' | 'rank' | 'survivors' | 'timeLeft'>>) => void;
  restartLevel: () => void;
  nextLevel: () => void;
  resetGame: () => void;
  
  updateTimeLeft: (time: number) => void;
  updateSurvivors: (count: number) => void;
  updateRank: (rank: number) => void;
  updateProgress: (id: string, z: number) => void;
  
  // 摸金状态更新
  updateHp: (hp: number) => void;
  updateInventory: (count: number) => void;
  updateMoney: (money: number) => void;
  setExtractedStatus: (status: 'success' | 'failed') => void;
  
  // HUD交互提示
  interactionText: string | null;
  interactionProgress: number | null;
  setInteraction: (text: string | null, progress: number | null) => void;

  // 战斗系统
  lastAttackTime: number;
  triggerAttack: () => void;
  
  // 武器与治疗系统
  weapon: Weapon;
  isHealing: boolean;
  healProgress: number;
  setWeapon: (w: Weapon) => void;
  setHealing: (isHealing: boolean, progress: number) => void;
  interruptHealing: () => void;
}

export const playerPosRef = { current: new THREE.Vector3() };
export const playerDirRef = { current: new THREE.Vector3(0, 0, -1) };

export const useGameStore = create<GameState>((set) => ({
  screen: 'menu',
  currentLevel: 0,
  storyPhase: 'pre',
  maxUnlockedLevel: 5,
  
  gameStatus: 'idle',
  gameResult: null,
  score: 0,
  rank: 1,
  survivors: 4,
  timeLeft: 90,
  progress: {},
  levelKey: 0,
  hp: 100,
  inventoryCount: 0,
  totalMoney: 0,
  extractedStatus: null,
  interactionText: null,
  interactionProgress: null,
  lastAttackTime: 0,
  weapon: 'harpoon',
  isHealing: false,
  healProgress: 0,

  setScreen: (screen) => set({ screen }),
  setLevel: (level) => set({ currentLevel: level }),
  setStoryPhase: (phase) => set({ storyPhase: phase }),
  
  startGame: () => set((state) => ({ 
    screen: 'game', 
    gameStatus: 'playing', 
    gameResult: null, 
    progress: {}, 
    levelKey: state.levelKey + 1,
    hp: 100,
    inventoryCount: 0,
    totalMoney: 0,
    extractedStatus: null,
    interactionText: null,
    interactionProgress: null,
    lastAttackTime: 0,
    weapon: 'harpoon',
    isHealing: false,
    healProgress: 0
  })),
  
  endGame: (result, stats) => set((state) => {
    // 胜利时解锁下一关
    const newMax = result === 'win' && state.currentLevel < 5 && state.currentLevel >= state.maxUnlockedLevel 
      ? state.currentLevel + 1 
      : state.maxUnlockedLevel;
    
    return { 
      gameStatus: 'ended', 
      gameResult: result, 
      screen: 'result',
      maxUnlockedLevel: newMax,
      ...stats
    };
  }),
  
  restartLevel: () => set((state) => ({
    screen: 'game',
    gameStatus: 'playing',
    gameResult: null,
    score: 0,
    rank: 1,
    survivors: 4,
    timeLeft: 90,
    progress: {},
    hp: 100,
    inventoryCount: 0,
    totalMoney: 0,
    extractedStatus: null,
    interactionText: null,
    interactionProgress: null,
    lastAttackTime: 0,
    weapon: 'harpoon',
    isHealing: false,
    healProgress: 0,
    levelKey: state.levelKey + 1
  })),

  nextLevel: () => set((state) => {
    const nextLvl = (state.currentLevel + 1) as LevelId;
    if (nextLvl > 5) {
      return { screen: 'menu', currentLevel: 1, storyPhase: 'pre' };
    }
    return { currentLevel: nextLvl, screen: 'story', storyPhase: 'pre', levelKey: state.levelKey + 1 };
  }),

  resetGame: () => set({
    screen: 'game',
    currentLevel: 0, // 0 = Lobby
    storyPhase: 'pre',
    gameStatus: 'idle',
    gameResult: null,
    progress: {},
    hp: 100,
    inventoryCount: 0,
    totalMoney: 0,
    extractedStatus: null,
    interactionText: null,
    interactionProgress: null,
    lastAttackTime: 0,
    weapon: 'harpoon',
    isHealing: false,
    healProgress: 0
  }),

  returnToLobby: () => set((state) => ({
    screen: 'game',
    currentLevel: 0,
    gameStatus: 'idle',
    levelKey: state.levelKey + 1
  })),

  updateTimeLeft: (time) => set({ timeLeft: time }),
  updateSurvivors: (count) => set({ survivors: count }),
  updateRank: (rank) => set({ rank }),
  updateProgress: (id, z) => set((state) => ({
    progress: { ...state.progress, [id]: z }
  })),
  updateHp: (hp) => set((state) => {
    if (hp < state.hp && state.isHealing) {
      setTimeout(() => set({ interactionText: null, interactionProgress: null }), 1500);
      return { hp, isHealing: false, healProgress: 0, interactionText: '治疗被打断！', interactionProgress: null };
    }
    return { hp };
  }),
  updateInventory: (count) => set({ inventoryCount: count }),
  updateMoney: (money) => set({ totalMoney: money }),
  setExtractedStatus: (status) => set({ extractedStatus: status }),
  setInteraction: (text, progress) => set({ interactionText: text, interactionProgress: progress }),
  triggerAttack: () => set({ lastAttackTime: performance.now() }),
  setWeapon: (w) => set((state) => {
    if (state.isHealing && w !== state.weapon) {
      setTimeout(() => set({ interactionText: null, interactionProgress: null }), 1500);
      return { weapon: w, isHealing: false, healProgress: 0, interactionText: '治疗已取消', interactionProgress: null };
    }
    return { weapon: w };
  }),
  setHealing: (isHealing, progress) => set({ isHealing, healProgress: progress }),
  interruptHealing: () => set({ isHealing: false, healProgress: 0, interactionText: '治疗被打断！', interactionProgress: null })
}));
