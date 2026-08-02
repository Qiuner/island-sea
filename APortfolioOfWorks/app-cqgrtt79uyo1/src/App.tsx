import React from 'react';
import { useGameStore } from './game/store/useGameStore';
import MainMenu from './game/ui/MainMenu';
import StoryScreen from './game/ui/StoryScreen';
import GameResult from './game/ui/GameResult';
import { GameScene } from './game/scenes/GameScene';
import { ErrorBoundary } from './components/ErrorBoundary';
import BGMPlayer from './game/components/BGMPlayer';

function App() {
  const screen = useGameStore(state => state.screen);
  
  return (
    <div className="w-screen h-screen overflow-hidden bg-[#0D0221] text-white font-sans relative">
      <BGMPlayer />
      
      {/* 3D 游戏场景 */}
      <div className="absolute inset-0 z-0">
        <ErrorBoundary>
          <GameScene />
        </ErrorBoundary>
      </div>
      
      {/* UI 叠层 */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {(screen === 'menu' || screen === 'story' || screen === 'result') && (
          <div className="pointer-events-auto w-full h-full">
            {screen === 'menu' && <MainMenu />}
            {screen === 'story' && <StoryScreen />}
            {screen === 'result' && <GameResult />}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
