// Композиция страницы и сценарий прокрутки.
// Порядок на странице: hero → история → манифест → модуль 1 → цифры → строка → модуль 2 → детали → модуль 3 → финал.
import type { ModuleKind } from './extras.types';

export type HeroVariant = 'split' | 'center' | 'poster' | 'bottom';
export type FeaturesVariant = 'cards' | 'bento' | 'list';

export interface PagePlan {
  hero: HeroVariant;
  modules: ModuleKind[];
  features: FeaturesVariant;
  invertStats?: boolean;
  // сценарий: первый экран закреплён, пока скролл проигрывает анимацию до этой доли
  intro?: number;
  // сценарий: последний блок закреплён, пока скролл проигрывает анимацию от этой доли до конца
  outro?: number;
  // сценарий: пока блок закреплён, анимация модели стоит; движется только между блоками
  freeze?: boolean;
  // сцена полностью растворяется, как только закончилась история, а не приглушается до конца страницы
  hideAfterStory?: boolean;
  // сценарий: секции между первым экраном и последним блоком перелистываются сами за одинаковое время
  snap?: boolean;
}

export const plan: PagePlan = {
  hero: 'split', modules: ['timeline', 'spec', 'pricing'], features: 'cards', invertStats: true,
  intro: 0.32, outro: 0.8, freeze: true, snap: true, hideAfterStory: true,
};
