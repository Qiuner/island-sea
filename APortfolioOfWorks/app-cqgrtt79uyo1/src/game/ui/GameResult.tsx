import React from 'react';
import { useGameStore } from '../store/useGameStore';

export default function GameResult() {
  const currentLevel = useGameStore(state => state.currentLevel);
  const gameResult = useGameStore(state => state.gameResult);
  const score = useGameStore(state => state.score);
  const rank = useGameStore(state => state.rank);
  const survivors = useGameStore(state => state.survivors);
  const timeLeft = useGameStore(state => state.timeLeft);
  const nextLevel = useGameStore(state => state.nextLevel);
  const restartLevel = useGameStore(state => state.restartLevel);
  const returnToLobby = useGameStore(state => state.returnToLobby);
  const totalMoney = useGameStore(state => state.totalMoney);
  const inventoryCount = useGameStore(state => state.inventoryCount);
  const extractedStatus = useGameStore(state => state.extractedStatus);

  const isWin = gameResult === 'win';

  const renderStats = () => {
    switch (currentLevel) {
      case 1:
        return <p className="text-lg">最终排名: <span className="font-bold text-yellow-400">第 {rank} 名</span></p>;
      case 2:
        return <p className="text-lg">坚持到了最后！淘汰了 {4 - survivors} 个对手</p>;
      case 3:
        return <p className="text-lg">存活时间: <span className="font-bold text-yellow-400">{score}</span> 秒</p>;
      case 4:
        return (
          <div className="space-y-2">
            <p className="text-lg">收集能量: <span className="font-bold text-yellow-400">{totalMoney.toLocaleString()}</span></p>
            <p className="text-lg">背包残留: <span className="font-bold text-blue-400">{inventoryCount} 箱</span></p>
            <p className="text-lg">状态: <span className={`font-bold ${extractedStatus === 'success' ? 'text-green-400' : 'text-red-400'}`}>{extractedStatus === 'success' ? '成功撤离' : '淘汰'}</span></p>
          </div>
        );
      case 5:
        return (
          <div className="space-y-2">
            <p className="text-lg">最终排名: <span className="font-bold text-yellow-400">{isWin ? '第 1 名' : '已淘汰'}</span></p>
            {score > 0 && <p className="text-lg">总回合数: <span className="font-bold text-blue-400">{score}</span></p>}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm z-50 absolute inset-0 pointer-events-auto">
      <div className={`p-8 rounded-3xl border-4 text-center max-w-lg w-[90%] shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden ${isWin ? 'border-[#FFD700] bg-[#6C3483] bg-opacity-80' : 'border-red-500 bg-red-900 bg-opacity-80'}`}>
        <h1 className={`text-6xl font-bold mb-6 drop-shadow-lg relative z-10 ${isWin ? 'text-[#FFD700]' : 'text-gray-400'}`}>
          {isWin ? '过关！' : '淘汰'}
        </h1>
        
        <div className="text-xl text-white mb-8 space-y-2 bg-black/40 p-6 rounded-2xl relative z-10">
          {renderStats()}
        </div>

        <div className="flex gap-4 justify-center relative z-10">
          {isWin ? (
            <button 
              onClick={() => {
                useGameStore.getState().setStoryPhase('post');
                useGameStore.getState().setScreen('story');
              }}
              className="px-6 py-3 bg-[#00BFFF] hover:bg-[#3498DB] rounded-xl text-xl font-bold shadow-lg transition-transform hover:scale-105 active:scale-95 text-white pointer-events-auto"
            >
              继续剧情
            </button>
          ) : (
            <>
              <button 
                onClick={restartLevel}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 rounded-xl text-xl font-bold shadow-lg transition-transform hover:scale-105 active:scale-95 text-white pointer-events-auto"
              >
                重新挑战
              </button>
              <button 
                onClick={() => {
                  useGameStore.getState().setStoryPhase('post');
                  useGameStore.getState().setScreen('story');
                }}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-500 rounded-xl text-xl font-bold shadow-lg transition-transform hover:scale-105 active:scale-95 text-white pointer-events-auto"
              >
                查看结局
              </button>
            </>
          )}
          <button 
            onClick={returnToLobby}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl text-xl font-bold shadow-lg transition-transform hover:scale-105 active:scale-95 text-white pointer-events-auto"
          >
            返回岛屿大厅
          </button>
        </div>
      </div>
    </div>
  );
}