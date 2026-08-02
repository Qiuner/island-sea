import React from 'react';
import { useGameStore } from '../store/useGameStore';

export default function MainMenu() {
  const setScreen = useGameStore(state => state.setScreen);
  const setLevel = useGameStore(state => state.setLevel);
  const setStoryPhase = useGameStore(state => state.setStoryPhase);

  const handleStart = () => {
    setLevel(0);
    setStoryPhase('pre');
    setScreen('story');
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0D0221] text-white">
      {/* 简单背景动画效果用 CSS + HTML 占位，后面如果有 Canvas 背景可以替换 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-[#6C3483] rounded-full blur-[80px] opacity-50"></div>
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-[#00BFFF] rounded-full blur-[100px] opacity-30"></div>
      </div>
      
      <div className="z-10 flex flex-col items-center">
        <h1 className="text-6xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-[#00BFFF] to-[#FFD700] drop-shadow-lg text-center leading-tight">
          星球派对：<br/>圆滚冒险
        </h1>
        <p className="text-xl text-gray-300 mb-12 tracking-wider">复古科幻派对竞技体验</p>
        
        <button 
          onClick={handleStart}
          className="px-10 py-4 bg-gradient-to-r from-[#6C3483] to-[#8E44AD] hover:from-[#8E44AD] hover:to-[#6C3483] rounded-full text-2xl font-bold shadow-[0_0_20px_rgba(108,52,131,0.6)] hover:shadow-[0_0_30px_rgba(0,191,255,0.8)] transition-all duration-300 transform hover:scale-105 active:scale-95"
        >
          开始派对
        </button>
      </div>
    </div>
  );
}
