import { useState, useEffect } from 'react';

export function useKeyboard() {
  const [keys, setKeys] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    action: false, // 例如推人
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          setKeys((k) => ({ ...k, forward: true }));
          break;
        case 'KeyS':
        case 'ArrowDown':
          setKeys((k) => ({ ...k, backward: true }));
          break;
        case 'KeyA':
        case 'ArrowLeft':
          setKeys((k) => ({ ...k, left: true }));
          break;
        case 'KeyD':
        case 'ArrowRight':
          setKeys((k) => ({ ...k, right: true }));
          break;
        case 'Space':
          setKeys((k) => ({ ...k, jump: true }));
          break;
        case 'KeyF':
        case 'Enter':
          setKeys((k) => ({ ...k, action: true }));
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          setKeys((k) => ({ ...k, forward: false }));
          break;
        case 'KeyS':
        case 'ArrowDown':
          setKeys((k) => ({ ...k, backward: false }));
          break;
        case 'KeyA':
        case 'ArrowLeft':
          setKeys((k) => ({ ...k, left: false }));
          break;
        case 'KeyD':
        case 'ArrowRight':
          setKeys((k) => ({ ...k, right: false }));
          break;
        case 'Space':
          setKeys((k) => ({ ...k, jump: false }));
          break;
        case 'KeyF':
        case 'Enter':
          setKeys((k) => ({ ...k, action: false }));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return keys;
}
