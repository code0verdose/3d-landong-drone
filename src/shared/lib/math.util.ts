export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smooth = (t: number): number => t * t * (3 - 2 * t);
/** Экспоненциальное сглаживание, не зависящее от частоты кадров. */
export const damp = (cur: number, target: number, lambda: number, dt: number): number =>
  lerp(cur, target, 1 - Math.exp(-lambda * dt));
