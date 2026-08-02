import { create } from 'zustand';

export type TeamId = 1 | 2 | 3 | 4;
export type RoleType = 'blue' | 'pink' | 'red' | 'yellow' | 'black';
export type CardType = 'speed' | 'strength' | 'healing' | 'protection' | 'hp_up' | 'none';

export interface ArenaPlayerState {
  id: string;
  team: TeamId;
  role: RoleType;
  isPlayer: boolean;
  hp: number;
  maxHp: number;
  isDead: boolean;
  shield: number;
  frozenUntil: number;
  stunnedUntil: number;
}

interface ArenaState {
  phase: 'select_role' | 'intro' | 'playing' | 'game_over';
  playerDeaths: Record<string, number>;
  playerCards: Record<string, CardType>;
  playerReviveChoices: CardType[] | null; // For the local player
  players: Record<string, ArenaPlayerState>;
  
  playerCooldowns: [number, number, number]; // [Q, W, E]

  initArena: () => void;
  selectRole: (role: RoleType) => void;
  startBattle: () => void;
  setPlayerCooldown: (index: 0|1|2, cd: number) => void;
  tickCooldowns: (dt: number) => void;
  
  checkGameOver: () => void;
  applyDamage: (id: string, dmg: number) => void;
  applyHeal: (id: string, heal: number) => void;
  applyShield: (id: string, shield: number) => void;
  applyStatus: (id: string, type: 'freeze' | 'stun', duration: number) => void;
  
  revivePlayer: (id: string, card: CardType) => void;
}

const INITIAL_PLAYERS: Record<string, Omit<ArenaPlayerState, 'hp' | 'maxHp' | 'isDead' | 'shield' | 'frozenUntil' | 'stunnedUntil'>> = {
  't1_p1': { id: 't1_p1', team: 1, role: 'blue', isPlayer: true },
  't1_p2': { id: 't1_p2', team: 1, role: 'pink', isPlayer: false },
  't2_p1': { id: 't2_p1', team: 2, role: 'red', isPlayer: false },
  't2_p2': { id: 't2_p2', team: 2, role: 'yellow', isPlayer: false },
  't3_p1': { id: 't3_p1', team: 3, role: 'black', isPlayer: false },
  't3_p2': { id: 't3_p2', team: 3, role: 'blue', isPlayer: false },
  't4_p1': { id: 't4_p1', team: 4, role: 'pink', isPlayer: false },
  't4_p2': { id: 't4_p2', team: 4, role: 'red', isPlayer: false },
};

export const arenaPositionsRef = { current: {} as Record<string, [number, number, number]> };

export const useArenaStore = create<ArenaState>((set, get) => ({
  phase: 'intro',
  playerDeaths: {},
  playerCards: {},
  playerReviveChoices: null,
  players: {},
  playerCooldowns: [0, 0, 0],

  initArena: () => {
    const players: Record<string, ArenaPlayerState> = {};
    for (const [key, p] of Object.entries(INITIAL_PLAYERS)) {
      players[key] = { ...p, hp: 100, maxHp: 100, isDead: false, shield: 0, frozenUntil: 0, stunnedUntil: 0 };
    }
    const playerDeaths: Record<string, number> = {};
    const playerCards: Record<string, CardType> = {};
    for (const key of Object.keys(INITIAL_PLAYERS)) {
      playerDeaths[key] = 0;
      playerCards[key] = 'none';
    }
    set({
      phase: 'select_role',
      playerDeaths,
      playerCards,
      playerReviveChoices: null,
      players,
      playerCooldowns: [0, 0, 0]
    });
  },

  selectRole: (role: RoleType) => set((state) => {
    const newPlayers = { ...state.players };
    if (newPlayers['t1_p1']) {
      newPlayers['t1_p1'] = { ...newPlayers['t1_p1'], role };
    }
    return { players: newPlayers, phase: 'intro' };
  }),

  startBattle: () => {
    set((state) => {
      const newPlayers = { ...state.players };
      for (const key of Object.keys(newPlayers)) {
        newPlayers[key].hp = newPlayers[key].maxHp;
        newPlayers[key].isDead = false;
      }
      return { phase: 'playing', players: newPlayers };
    });
  },

  setPlayerCooldown: (index, cd) => {
    set((state) => {
      const cds = [...state.playerCooldowns] as [number, number, number];
      cds[index] = cd;
      return { playerCooldowns: cds };
    });
  },

  tickCooldowns: (dt) => {
    set((state) => {
      const cds = state.playerCooldowns.map(c => Math.max(0, c - dt)) as [number, number, number];
      return { playerCooldowns: cds };
    });
  },

  checkGameOver: () => {
    set((state) => {
      if (state.phase !== 'playing') return state;
      
      // 检查我方是否全部被淘汰（5次阵亡）
      const t1p1 = state.playerDeaths['t1_p1'] >= 5;
      const t1p2 = state.playerDeaths['t1_p2'] >= 5;
      if (t1p1 && t1p2) {
        return { phase: 'game_over' }; // 会在组件中处理
      }
      
      // 检查敌方是否全部被淘汰
      let enemiesAlive = false;
      for (const key of Object.keys(state.players)) {
        if (!key.startsWith('t1_') && state.playerDeaths[key] < 5) {
          enemiesAlive = true;
          break;
        }
      }
      
      if (!enemiesAlive) {
        return { phase: 'game_over' }; 
      }
      
      return state;
    });
  },

  applyDamage: (id, dmg) => {
    let shouldTriggerAIRevive = false;
    let shouldTriggerPlayerRevive = false;

    set((state) => {
      if (state.phase !== 'playing') return state;
      const p = state.players[id];
      if (!p || p.isDead) return state;

      let finalDmg = dmg;
      if (state.playerCards[id] === 'protection') finalDmg *= 0.7;

      const newPlayer = { ...p };
      let remainingDmg = finalDmg;
      if (newPlayer.shield > 0) {
        if (newPlayer.shield >= remainingDmg) {
          newPlayer.shield -= remainingDmg;
          remainingDmg = 0;
        } else {
          remainingDmg -= newPlayer.shield;
          newPlayer.shield = 0;
        }
      }

      let newPlayerDeaths = state.playerDeaths;
      let newPlayerReviveChoices = state.playerReviveChoices;

      if (remainingDmg > 0) {
        newPlayer.hp = Math.max(0, newPlayer.hp - remainingDmg);
        if (newPlayer.hp === 0) {
          newPlayer.isDead = true;
          const deaths = (state.playerDeaths[id] || 0) + 1;
          newPlayerDeaths = { ...state.playerDeaths, [id]: deaths };
          
          if (deaths < 5) {
            // 需要复活
            if (id === 't1_p1') {
              const allCards: CardType[] = ['speed', 'strength', 'healing', 'protection', 'hp_up'];
              const shuffled = allCards.sort(() => 0.5 - Math.random());
              newPlayerReviveChoices = shuffled.slice(0, 3);
              shouldTriggerPlayerRevive = true;
            } else {
              shouldTriggerAIRevive = true;
            }
          }
        }
      }
      return { players: { ...state.players, [id]: newPlayer }, playerDeaths: newPlayerDeaths, playerReviveChoices: newPlayerReviveChoices };
    });

    if (shouldTriggerPlayerRevive || shouldTriggerAIRevive) {
       // Check game over first just in case
       get().checkGameOver();
    }
    
    if (shouldTriggerAIRevive) {
       setTimeout(() => {
          const allCards: CardType[] = ['speed', 'strength', 'healing', 'protection', 'hp_up'];
          const randomCard = allCards[Math.floor(Math.random() * allCards.length)];
          get().revivePlayer(id, randomCard);
       }, 3000);
    }
  },

  applyHeal: (id, heal) => set((state) => {
    if (state.phase !== 'playing') return state;
    const p = state.players[id];
    if (!p || p.isDead) return state;
    const newPlayer = { ...p, hp: Math.min(p.maxHp, p.hp + heal) };
    return { players: { ...state.players, [id]: newPlayer } };
  }),

  applyShield: (id, shield) => set((state) => {
    if (state.phase !== 'playing') return state;
    const p = state.players[id];
    if (!p || p.isDead) return state;
    const newPlayer = { ...p, shield: shield };
    return { players: { ...state.players, [id]: newPlayer } };
  }),

  applyStatus: (id, type, duration) => set((state) => {
    if (state.phase !== 'playing') return state;
    const p = state.players[id];
    if (!p || p.isDead) return state;
    
    // 免疫控制卡
    if (false) return state;

    const newPlayer = { ...p };
    const now = Date.now();
    if (type === 'freeze') newPlayer.frozenUntil = Math.max(newPlayer.frozenUntil || 0, now + duration * 1000);
    if (type === 'stun') newPlayer.stunnedUntil = Math.max(newPlayer.stunnedUntil || 0, now + duration * 1000);
    return { players: { ...state.players, [id]: newPlayer } };
  }),

  revivePlayer: (id, card) => set((state) => {
    const p = state.players[id];
    if (!p) return state;
    
    // Check if eliminated
    if (state.playerDeaths[id] >= 5) return state;

    let maxHp = p.maxHp;
    if (card === 'hp_up') maxHp += 50;

    const np = { ...p, maxHp, hp: maxHp, isDead: false, shield: 0, frozenUntil: 0, stunnedUntil: 0 };
    return { 
      players: { ...state.players, [id]: np },
      playerCards: { ...state.playerCards, [id]: card },
      playerReviveChoices: id === 't1_p1' ? null : state.playerReviveChoices
    };
  })
}));
