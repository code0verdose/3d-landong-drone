// Ракурсы камеры в сферических координатах вокруг модели, вписанной в радиус 2.4.
export type ShotKey = 'hero' | 'close' | 'wide' | 'left' | 'right' | 'top' | 'low';

export interface ShotParams { az: number; el: number; dist: number; ty: number }

export const SHOT_ORDER: ShotKey[] = ['hero', 'close', 'wide', 'left', 'right', 'top', 'low'];

export const SHOTS: Record<ShotKey, ShotParams> = {
  hero: { az: 28, el: 16, dist: 8.4, ty: 0 },
  close: { az: 48, el: 8, dist: 5.7, ty: 0.15 },
  wide: { az: -24, el: 24, dist: 11, ty: 0 },
  left: { az: 78, el: 14, dist: 7.6, ty: 0 },
  right: { az: -62, el: 12, dist: 7.6, ty: 0 },
  top: { az: 10, el: 62, dist: 8.8, ty: 0 },
  low: { az: 34, el: -10, dist: 7.2, ty: 0.3 },
};
