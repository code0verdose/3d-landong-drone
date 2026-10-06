import { useEffect, useRef } from 'react';
import styles from './cursor.module.css';

/**
 * Кольцо-курсор с инерцией: над ссылками и кнопками кольцо увеличивается.
 * Только для точных указателей (мышь, тачпад); на сенсорных экранах не монтируется.
 * Эффект оправдан: подписка на события указателя и собственный цикл rAF с очисткой.
 */
export function Cursor() {
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, raf = 0, hover = false;
    const move = (e: PointerEvent) => {
      x = e.clientX; y = e.clientY;
      if (ring.current) ring.current.style.opacity = '1';
      if (dot.current) dot.current.style.opacity = '1';
      hover = !!(e.target as HTMLElement).closest('a, button');
    };
    const loop = () => {
      rx += (x - rx) * 0.16; ry += (y - ry) * 0.16;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0) scale(${hover ? 1.9 : 1})`;
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener('pointermove', move, { passive: true });
    raf = requestAnimationFrame(loop);
    document.documentElement.dataset.cursor = 'on';
    return () => {
      window.removeEventListener('pointermove', move);
      cancelAnimationFrame(raf);
      delete document.documentElement.dataset.cursor;
    };
  }, []);
  return (
    <>
      <div ref={ring} className={styles.ring} aria-hidden />
      <div ref={dot} className={styles.dot} aria-hidden />
    </>
  );
}
