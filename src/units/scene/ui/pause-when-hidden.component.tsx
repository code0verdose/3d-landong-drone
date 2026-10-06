import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { scrollStore } from '@shared/lib/scroll-store';

/**
 * Когда сцена полностью скрыта (после истории), рендер останавливается: GPU не рисует
 * невидимое, пока человек читает остальную страницу, и ноутбук не греется.
 * Эффект оправдан: лёгкий цикл rAF следит за внешним хранилищем прокрутки и переключает frameloop.
 */
export function PauseWhenHidden() {
  const setFrameloop = useThree((s) => s.setFrameloop);
  useEffect(() => {
    let raf = 0;
    let paused = false;
    const loop = () => {
      const hidden = scrollStore.hide >= 0.999;
      if (hidden !== paused) {
        paused = hidden;
        setFrameloop(hidden ? 'never' : 'always');
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      setFrameloop('always');
    };
  }, [setFrameloop]);
  return null;
}
