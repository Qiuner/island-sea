import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';

export default function BGMPlayer() {
  const screen = useGameStore(state => state.screen);
  const currentLevel = useGameStore(state => state.currentLevel);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sequenceRef = useRef<number | null>(null);
  
  useEffect(() => {
    // 处理用户交互后才允许播放声音
    const handleFirstInteraction = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        setIsPlaying(true);
      }
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
    
    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);
    
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      if (sequenceRef.current) cancelAnimationFrame(sequenceRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  useEffect(() => {
    if (!isPlaying || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    
    let lastTime = 0;
    let step = 0;
    
    const playNote = (freq: number, type: OscillatorType, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);
    };

    // 不同的状态播放不同的旋律模式
    const tick = () => {
      const now = ctx.currentTime;
      if (now - lastTime > 0.2) { // 每0.2秒一个音符
        lastTime = now;
        
        let freqs = [220, 261.63, 329.63, 440]; // Am
        let type: OscillatorType = 'square';
        
        if (screen === 'menu') {
          freqs = [261.63, 329.63, 392.00, 523.25]; // C major
          type = 'sine';
        } else if (screen === 'game') {
          if (currentLevel === 1) freqs = [329.63, 392, 493.88, 659.25]; // E minor, fast
          if (currentLevel === 2) freqs = [196, 233.08, 293.66, 392]; // G minor, tense
          if (currentLevel === 3) freqs = [146.83, 174.61, 220, 293.66]; // D minor, stealth
          if (currentLevel === 4) freqs = [130.81, 155.56, 196, 261.63]; // C minor, heist
          type = 'sawtooth';
        } else if (screen === 'result') {
          freqs = [440, 554.37, 659.25, 880]; // A major
          type = 'triangle';
        }
        
        const note = freqs[step % freqs.length];
        playNote(note, type, 0.3);
        
        // 加入简单的低音节奏
        if (step % 4 === 0) {
          playNote(freqs[0] / 2, 'square', 0.5);
        }
        
        step++;
      }
      sequenceRef.current = requestAnimationFrame(tick);
    };

    sequenceRef.current = requestAnimationFrame(tick);
    
    return () => {
      if (sequenceRef.current) cancelAnimationFrame(sequenceRef.current);
    };
  }, [isPlaying, screen, currentLevel]);

  return null;
}
