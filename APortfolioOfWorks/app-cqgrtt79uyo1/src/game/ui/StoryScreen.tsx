import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { STORY_DATA } from '../data/story';

export default function StoryScreen() {
  const currentLevel = useGameStore(state => state.currentLevel);
  const storyPhase = useGameStore(state => state.storyPhase);
  const gameResult = useGameStore(state => state.gameResult);
  const startGame = useGameStore(state => state.startGame);
  const setScreen = useGameStore(state => state.setScreen);
  const returnToLobby = useGameStore(state => state.returnToLobby);

  const [currentDialogIndex, setCurrentDialogIndex] = useState(0);

  // 获取对应剧情数据
  const levelStory = STORY_DATA[currentLevel];
  let phaseData = levelStory.pre;
  if (storyPhase === 'post') {
    phaseData = gameResult === 'win' ? levelStory.postWin : levelStory.postLose;
  }

  const dialogs = phaseData.dialogs;
  const currentLine = dialogs[currentDialogIndex] || dialogs[0];

  React.useEffect(() => {
    if (phaseData) setCurrentDialogIndex(0);
  }, [phaseData]);

  const handleNext = () => {
    if (currentDialogIndex < dialogs.length - 1) {
      setCurrentDialogIndex(prev => prev + 1);
    } else {
      // 对话结束，触发相应的动作
      if (storyPhase === 'pre') {
        if (currentLevel === 0) {
          setScreen('game'); // 序幕结束进入大厅
        } else {
          startGame(); // 关卡前剧情结束，进入游戏
        }
      } else {
        // 关卡后剧情结束，返回大厅
        returnToLobby();
      }
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-end pb-12 bg-[#0D0221] bg-opacity-90 relative" onClick={handleNext}>
      <div className="absolute top-10 text-center w-full text-2xl font-bold text-[#FFD700] tracking-widest opacity-80">
        {phaseData.title}
      </div>
      
      {/* 角色立绘占位 */}
      <div className="w-full max-w-4xl flex items-end justify-center mb-4">
        {currentLine.speaker === '球球' ? (
          <div className="w-48 h-48 bg-[#3498DB] rounded-full shadow-[0_0_30px_rgba(52,152,219,0.8)] border-4 border-white transform transition-transform duration-300"></div>
        ) : currentLine.speaker === '广播' ? (
          <div className="w-32 h-32 bg-gray-500 rounded-lg shadow-[0_0_20px_rgba(255,255,255,0.5)] flex items-center justify-center text-4xl">📻</div>
        ) : (
          <div className="w-40 h-40 bg-[#E74C3C] rounded-full shadow-[0_0_30px_rgba(231,76,60,0.8)] border-4 border-gray-800"></div>
        )}
      </div>

      <div className="w-[90%] max-w-4xl bg-gray-900 bg-opacity-80 border-2 border-[#00BFFF] rounded-2xl p-6 shadow-[0_0_20px_rgba(0,191,255,0.3)] backdrop-blur-md cursor-pointer relative">
        <div className="absolute -top-5 left-6 bg-[#6C3483] px-4 py-1 rounded-full text-white font-bold border-2 border-[#00BFFF]">
          {currentLine.speaker}
        </div>
        <p className="text-xl md:text-2xl mt-4 text-gray-100 min-h-[80px]">
          {currentLine.text}
        </p>
        <p className="text-right text-gray-500 text-sm mt-2 animate-pulse">点击继续 ▼</p>
      </div>
    </div>
  );
}
