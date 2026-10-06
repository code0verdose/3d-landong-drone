import { useEffect, useRef } from 'react';
import { scrollStore } from '@shared/lib/scroll-store';
import styles from './scroll-meter.module.css';

/** Полоса прогресса сверху и рейка справа с отметками секций. */
export function ScrollMeter({ count }: { count: number }) {
  const bar = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  // эффект оправдан: чтение изменяемого хранилища на каждом кадре без ре-рендеров
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const p = scrollStore.page;
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
      if (fill.current) fill.current.style.transform = `scaleY(${p})`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <>
      <div ref={bar} className={styles.bar} />
      <div className={styles.rail} aria-hidden>
        <div ref={fill} className={styles.fill} />
        {Array.from({ length: count }, (_, i) => <span key={i} style={{ top: `${(i / (count - 1)) * 100}%` }} />)}
      </div>
    </>
  );
}
