import React from 'react';
import { useGameStore } from '../store/useGameStore';

export default function HUD() {
  const currentLevel = useGameStore(state => state.currentLevel);
  const rank = useGameStore(state => state.rank);
  const survivors = useGameStore(state => state.survivors);
  const timeLeft = useGameStore(state => state.timeLeft);
  const progress = useGameStore(state => state.progress);
  const hp = useGameStore(state => state.hp);
  const inventoryCount = useGameStore(state => state.inventoryCount);
  const totalMoney = useGameStore(state => state.totalMoney);
  const interactionText = useGameStore(state => state.interactionText);
  const interactionProgress = useGameStore(state => state.interactionProgress);
  const weapon = useGameStore(state => state.weapon);

  const getFormatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
      {/* 顶部状态栏 */}
      <div className="flex justify-between items-start">
        {/* 左侧：关卡特定信息 */}
        <div className="bg-slate-900/80 backdrop-blur-md p-4 rounded-xl border border-white/10 shadow-lg">
          <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-2">
            {currentLevel === 1 && "关卡 1：宇宙赛道冲刺"}
            {currentLevel === 2 && "关卡 2：消失星台大逃杀"}
            {currentLevel === 3 && "关卡 3：捉迷藏大作战"}
            {currentLevel === 4 && "关卡 4：核心掠夺 (摸金撤离)"}
          </h2>
          
          <div className="space-y-1">
            {currentLevel === 1 && (
              <p className="text-2xl font-bold text-white">当前排名: <span className="text-yellow-400">{rank}</span> / 3</p>
            )}
            
            {currentLevel === 2 && (
              <p className="text-2xl font-bold text-white">存活人数: <span className="text-green-400">{survivors}</span> / 4</p>
            )}
            
            {(currentLevel === 3 || currentLevel === 4) && (
              <p className="text-2xl font-bold text-white">剩余时间: <span className="text-red-400">{getFormatTime(timeLeft)}</span></p>
            )}

            {currentLevel === 4 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-white font-bold">HP:</span>
                  <div className="w-32 h-4 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500" style={{ width: `${Math.max(0, hp)}%` }} />
                  </div>
                  <span className="text-sm">{Math.max(0, Math.floor(hp))}/100</span>
                </div>
                <p className="text-white font-bold mt-2">金额: <span className="text-yellow-400">{totalMoney.toLocaleString()}</span> / 150,000</p>
                <div className="flex gap-1 mt-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className={`w-4 h-4 border ${i < inventoryCount ? 'bg-blue-500 border-blue-400' : 'bg-transparent border-gray-500'}`} />
                  ))}
                </div>
                <div className="mt-4 text-xs font-bold space-y-1">
                  <p className="text-gray-400">当前装备 (按键1/2/3切换)</p>
                  <div className="flex flex-col gap-1">
                    <div className={`px-2 py-1 border rounded ${weapon === 'harpoon' ? 'bg-green-600 border-green-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>1: 鱼叉 (近战 伤害30)</div>
                    <div className={`px-2 py-1 border rounded ${weapon === 'shovel' ? 'bg-green-600 border-green-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>2: 铲子 (近战 伤害20)</div>
                    <div className={`px-2 py-1 border rounded ${weapon === 'medkit' ? 'bg-green-600 border-green-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>3: 医疗包 (5秒回复40)</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：排名/雷达 (可扩展) */}
        {currentLevel === 1 && (
          <div className="bg-slate-900/80 backdrop-blur-md p-4 rounded-xl border border-white/10 w-48">
            <h3 className="text-gray-400 text-sm font-bold mb-2 uppercase tracking-wider">实时进度</h3>
            {Object.entries(progress)
              .sort(([,a], [,b]) => b - a)
              .map(([id, z], idx) => (
                <div key={id} className="flex justify-between items-center mb-1 text-sm">
                  <span className={id === 'player' ? 'text-blue-400 font-bold' : 'text-gray-300'}>
                    {id === 'player' ? '你' : `对手 ${id.replace('AI', '')}`}
                  </span>
                  <span className="font-mono text-xs">{Math.max(0, Math.floor(z))}m</span>
                </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部：交互提示 */}
      <div className="flex justify-center mb-24">
        {interactionText && (
          <div className="bg-black/80 px-6 py-3 rounded-xl border border-white/20 text-center">
            <p className="text-xl font-bold text-white shadow-sm">{interactionText}</p>
            {interactionProgress !== null && (
              <div className="w-48 h-2 bg-gray-800 rounded-full mt-2 overflow-hidden mx-auto">
                <div className="h-full bg-yellow-400" style={{ width: `${interactionProgress * 100}%` }} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 操作提示 */}
      <div className="text-center text-white/50 text-sm drop-shadow-md pb-4 font-mono">
        [W A S D] 移动 · [空格] 跳跃 {currentLevel === 4 ? '· [鼠标左键] 攻击 · [E] 互动' : ''} · [滚轮] 缩放视角
      </div>
    </div>
  );
}