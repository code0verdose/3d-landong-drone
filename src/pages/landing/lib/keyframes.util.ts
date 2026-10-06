import type { Landing } from '@content/landing.types';
import type { ShotKey } from '@units/scene';
import type { PagePlan } from '@content/page-plan';
import type { HeroVariant } from '@content/page-plan';

export interface Keyframe {
  progress: number; shot: ShotKey; offset: number; dim: number; lift: number; zoom: number;
  end?: number;   // доля анимации в конце закрепления блока; задана только в режиме сценария
  tail?: number;  // доля закрепления в конце, где анимация уже закончилась и кадр стоит (финал)
}

/** Опорные точки сцены: hero, каждая секция истории и финальный блок с цифрами. */
// куда уводить модель на первом экране, чтобы она не спорила с заголовком
const HERO_FRAME: Record<HeroVariant, { offset: number; lift: number; zoom: number }> = {
  split: { offset: 0.75, lift: 0, zoom: 1 },
  center: { offset: 0, lift: 2.5, zoom: 1.22 },
  poster: { offset: 1.4, lift: 0.5, zoom: 1.18 },
  bottom: { offset: 0.15, lift: -1.05, zoom: 1.22 },
};

export function buildKeyframes(l: Landing, plan: PagePlan): Keyframe[] {
  const hero = plan.hero;
  const side = (s: 'left' | 'right' | 'center') => (s === 'left' ? 1 : s === 'right' ? -1 : 0);
  const hold = (p: number) => (plan.freeze ? p : undefined);
  const last = l.sections.length - 1;
  return [
    { progress: 0, end: plan.intro, shot: 'hero', dim: 0, ...HERO_FRAME[hero], zoom: HERO_FRAME[hero].zoom },
    ...l.sections.map((s, i) => ({
      // сценарий с финалом: последний блок закреплён, пока скролл проигрывает анимацию от outro до конца
      progress: i === last && plan.outro !== undefined ? plan.outro : s.progress,
      end: hold(s.progress),
      // финал: последние 30% закрепления — итоговый кадр стоит, пока сцена не погаснет
      tail: i === last && plan.outro !== undefined ? 0.3 : undefined,
      shot: s.shot, offset: side(s.side),
      dim: s.side === 'center' ? 0.3 : 0, lift: s.side === 'center' ? 1.4 : 0, zoom: s.side === 'center' ? 1.12 : 1,
    })),
    { progress: 1, end: hold(1), shot: 'wide', offset: 0, dim: 1, lift: 0, zoom: 1 },
  ];
}
