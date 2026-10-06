import { useEffect, useRef } from 'react';
import { scrollStore } from '@shared/lib/scroll-store';
import styles from './marquee.module.css';

/** Бегущая строка: базовая скорость плюс скорость прокрутки, наклон — от её знака. */
export function Marquee({ text }: { text: string }) {
  const track = useRef<HTMLDivElement>(null);
  // эффект оправдан: собственный цикл requestAnimationFrame с остановкой при размонтировании
  useEffect(() => {
    let x = 0;
    let skew = 0;
    let raf = 0;
    const loop = () => {
      const v = scrollStore.velocity;
      x -= 0.6 + Math.abs(v) * 0.35;
      skew += (Math.max(-8, Math.min(8, v * 0.6)) - skew) * 0.1;
      const el = track.current;
      if (el) {
        const half = el.scrollWidth / 2;
        if (-x > half) x += half;
        el.style.transform = `translate3d(${x}px,0,0) skewX(${-skew}deg)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const items = Array.from({ length: 8 }, (_, i) => (
    <span key={i} className={i % 2 ? styles.outline : styles.solid}>{text}<i>✦</i></span>
  ));
  return (
    <div className={styles.wrap} aria-hidden>
      <div ref={track} className={styles.track}>{items}{items}</div>
    </div>
  );
}
