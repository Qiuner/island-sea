import React from 'react';
import { useArenaStore, CardType, TeamId } from '../store/useArenaStore';
import { useGameStore } from '../store/useGameStore';

const CARD_NAMES: Record<CardType, string> = {
  speed: '速度 (提升移速)',
  strength: '力量 (提升伤害)',
  healing: '疗愈 (持续回血)',
  protection: '防护 (减少受伤)',
  hp_up: '血量 (最大生命+50)',
  none: '无'
};

const ALL_CARDS: CardType[] = ['speed', 'strength', 'healing', 'protection', 'hp_up'];

export default function ArenaHUD() {
  const phase = useArenaStore(state => state.phase);
  const selectRole = useArenaStore(state => state.selectRole);

  // 引入局部倒计时状态
  const [countdown, setCountdown] = React.useState(3);

  React.useEffect(() => {
    if (phase === 'intro') {
      setCountdown(3);
      const interval = setInterval(() => {
        setCountdown(c => c > 1 ? c - 1 : 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [phase]);

  if (phase === 'select_role') {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 pointer-events-auto">
        <div className="bg-gray-800 p-8 rounded-xl flex flex-col items-center shadow-2xl pointer-events-auto">
          <h2 className="text-3xl font-bold text-white mb-6">选择你的出战角色</h2>
          <div className="flex gap-4">
            <button onPointerDown={() => selectRole('blue')} onClick={() => selectRole('blue')} className="w-24 h-32 bg-blue-600 hover:bg-blue-500 rounded-lg shadow-lg flex flex-col items-center justify-center transform hover:scale-105 transition-all cursor-pointer pointer-events-auto">
              <div className="w-12 h-12 bg-blue-300 rounded-full mb-2" />
              <span className="text-white font-bold">小蓝</span>
            </button>
            <button onPointerDown={() => selectRole('red')} onClick={() => selectRole('red')} className="w-24 h-32 bg-red-600 hover:bg-red-500 rounded-lg shadow-lg flex flex-col items-center justify-center transform hover:scale-105 transition-all cursor-pointer pointer-events-auto">
              <div className="w-12 h-12 bg-red-300 rounded-full mb-2" />
              <span className="text-white font-bold">小红</span>
            </button>
            <button onPointerDown={() => selectRole('pink')} onClick={() => selectRole('pink')} className="w-24 h-32 bg-pink-500 hover:bg-pink-400 rounded-lg shadow-lg flex flex-col items-center justify-center transform hover:scale-105 transition-all cursor-pointer pointer-events-auto">
              <div className="w-12 h-12 bg-pink-300 rounded-full mb-2" />
              <span className="text-white font-bold">小粉</span>
            </button>
            <button onPointerDown={() => selectRole('yellow')} onClick={() => selectRole('yellow')} className="w-24 h-32 bg-yellow-500 hover:bg-yellow-400 rounded-lg shadow-lg flex flex-col items-center justify-center transform hover:scale-105 transition-all cursor-pointer pointer-events-auto">
              <div className="w-12 h-12 bg-yellow-300 rounded-full mb-2" />
              <span className="text-white font-bold">小黄</span>
            </button>
            <button onPointerDown={() => selectRole('black')} onClick={() => selectRole('black')} className="w-24 h-32 bg-gray-800 hover:bg-gray-700 border-2 border-gray-600 rounded-lg shadow-lg flex flex-col items-center justify-center transform hover:scale-105 transition-all cursor-pointer pointer-events-auto">
              <div className="w-12 h-12 bg-gray-900 rounded-full mb-2 border border-gray-700" />
              <span className="text-white font-bold">小黑</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-50">
        <h1 className="text-8xl font-bold text-white drop-shadow-[0_0_20px_#8E44AD] animate-pulse">超然竞技场</h1>
        <h2 className="text-6xl font-bold text-yellow-400 drop-shadow-lg mt-8 animate-bounce">{countdown}</h2>
      </div>
    );
  }

  return <PlayingHUD />;
}

function PlayingHUD() {
  const { phase, players, playerCooldowns, playerDeaths, playerCards, playerReviveChoices, revivePlayer } = useArenaStore();

  const p1 = players['t1_p1'];
  const p2 = players['t1_p2'];

  const renderPlayerStatus = (p: any, title: string) => {
    if (!p) return null;
    const deaths = playerDeaths[p.id] || 0;
    const isEliminated = deaths >= 5;
    return (
      <div className="flex flex-col bg-black/60 p-4 rounded-xl border-2 border-gray-600">
        <div className="text-white font-bold">{title} {isEliminated ? '(已淘汰)' : p.isDead ? '(等待复活)' : ''}</div>
        <div className="w-48 h-4 bg-gray-800 rounded-full mt-2 overflow-hidden border border-gray-700">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${(p.hp / p.maxHp) * 100}%` }} />
        </div>
        <div className="text-white text-sm mt-1">HP: {p.hp}/{p.maxHp} {p.shield > 0 ? ` (+${p.shield}盾)` : ''} | 剩余复活: {Math.max(0, 4 - deaths)}</div>
        {playerCards[p.id] && playerCards[p.id] !== 'none' && (
          <div className="text-yellow-300 text-xs mt-1 font-bold">{CARD_NAMES[playerCards[p.id]]}</div>
        )}
      </div>
    );
  };

  const getSkillsInfo = (role: string) => {
    switch (role) {
      case 'blue': return [ { key: 'Q', name: '冰冻射线' }, { key: 'W', name: '护盾展开' }, { key: 'E', name: '瞬移闪现' } ];
      case 'red': return [ { key: 'Q', name: '顺劈斩' }, { key: 'W', name: '冲锋突进' }, { key: 'E', name: '战争践踏' } ];
      case 'pink': return [ { key: 'Q', name: '治疗波' }, { key: 'W', name: '群体护盾' }, { key: 'E', name: '震荡波' } ];
      case 'yellow': return [ { key: 'Q', name: '制裁之锤' }, { key: 'W', name: '圣佑术' }, { key: 'E', name: '圣光术' } ];
      case 'black': return [ { key: 'Q', name: '致命打击' }, { key: 'W', name: '暗影突袭' }, { key: 'E', name: '刺杀指令' } ];
      default: return [ { key: 'Q', name: '技能1' }, { key: 'W', name: '技能2' }, { key: 'E', name: '技能3' } ];
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-40">
      {/* 顶部队伍状态 */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex gap-8">
        {[1, 2, 3, 4].map(t => {
          const deathsP1 = playerDeaths[`t${t}_p1`] || 0;
          const deathsP2 = playerDeaths[`t${t}_p2`] || 0;
          const isEliminated = deathsP1 >= 5 && deathsP2 >= 5;
          return (
            <div key={t} className={`flex flex-col items-center bg-black/80 p-3 rounded-lg border-2 ${t === 1 ? 'border-blue-500' : 'border-gray-500'} ${isEliminated ? 'opacity-40 grayscale' : 'shadow-[0_0_15px_rgba(0,0,0,0.5)]'}`}>
              <span className="text-white font-bold">{t === 1 ? '我方队伍' : `敌方队伍 ${t}`}</span>
              <span className={`font-bold text-xl mt-1 ${isEliminated ? 'text-gray-500' : 'text-red-400'}`}>
                {isEliminated ? '已淘汰' : '存活'}
              </span>
            </div>
          );
        })}
      </div>

      {/* 左上角我方血量 */}
      <div className="absolute top-4 left-4 flex flex-col gap-4">
        {renderPlayerStatus(p1, '玩家 (蓝球)')}
        {renderPlayerStatus(p2, '队友 (粉球)')}
      </div>

      {/* 底部技能 CD */}
      {p1 && !p1.isDead && phase === 'playing' && (
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex gap-6">
          {getSkillsInfo(p1.role).map((skill, index) => {
            const cd = playerCooldowns[index];
            return (
              <div key={skill.key} className="relative w-20 h-20 bg-gray-800 border-2 border-blue-400 rounded-lg flex items-center justify-center flex-col shadow-lg overflow-hidden">
                <span className="text-blue-300 font-bold text-sm mb-1">{skill.name}</span>
                <span className="text-white font-bold text-2xl">{skill.key}</span>
                {cd > 0 && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center pointer-events-none">
                    <span className="text-white text-xl font-bold">{Math.ceil(cd)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 复活抽卡界面 */}
      {playerReviveChoices && phase === 'playing' && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center pointer-events-auto backdrop-blur-sm z-50">
          <h2 className="text-5xl font-bold text-red-400 mb-4 drop-shadow-[0_0_10px_#E74C3C]">角色阵亡</h2>
          <h3 className="text-2xl font-bold text-white mb-12">选择一张增益卡牌并复活 (剩余复活次数: {Math.max(0, 4 - (playerDeaths['t1_p1'] || 0))})</h3>
          <div className="flex gap-6">
            {playerReviveChoices.map((card, i) => (
               <button 
                key={i} 
                onClick={() => revivePlayer('t1_p1', card)}
                className="w-48 h-64 bg-gradient-to-br from-indigo-600 to-purple-800 border-4 border-yellow-400 rounded-xl hover:scale-105 hover:shadow-[0_0_30px_#F1C40F] transition-all flex items-center justify-center text-center p-4 shadow-2xl group"
              >
                <span className="text-2xl font-bold text-white group-hover:text-yellow-200">{CARD_NAMES[card]}</span>
               </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}