// Дополнительные блоки страницы; порядок — в page-plan.ts.
export type ModuleKind = 'spec' | 'timeline' | 'pricing';

export interface LandingExtras {
  /** 25–45 слов: главная мысль бренда. Слова заливаются цветом по мере прокрутки. */
  manifesto: string;
  spec?: { title: string; rows: { label: string; value: string }[] };               // 6–8 строк
  timeline?: { title: string; steps: { step: string; title: string; text: string }[] }; // 4–5 шагов
  pricing?: { title: string; plans: { name: string; price: string; period: string; points: string[]; featured?: boolean }[] }; // 3 тарифа
}
