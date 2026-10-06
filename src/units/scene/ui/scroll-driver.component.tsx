import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { scrollSampler } from '@shared/lib/scroll-store';
import { damp } from '@shared/lib/math.util';

/**
 * Первое, что происходит в кадре сцены: сглаженная позиция прокрутки и пересчёт целей сцены
 * от неё. Модель и камера читают цели уже после этого, в том же кадре (приоритеты useFrame:
 * −2 здесь, −1 модели, 0 камера). Одно сглаживание на всё — кадр по-прежнему функция позиции
 * на странице, но без рывков от того, в каком порядке пришли события прокрутки и кадры.
 */
export function ScrollDriver() {
  const c = useRef<number | null>(null);
  useFrame((_, rawDt) => {
    const raw = window.scrollY + window.innerHeight / 2;
    // после паузы рендера (сцена была скрыта) или первого кадра — сразу к текущей позиции
    if (c.current === null || rawDt > 0.25) c.current = raw;
    else c.current = damp(c.current, raw, 9, rawDt);
    if (Math.abs(c.current - raw) < 0.5) c.current = raw;
    scrollSampler.sample?.(c.current);
  }, -2);
  return null;
}
