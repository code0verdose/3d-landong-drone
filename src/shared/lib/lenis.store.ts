import type Lenis from 'lenis';

// Текущий экземпляр плавной прокрутки страницы — нужен кнопкам-якорям.
let current: Lenis | null = null;

export const setLenis = (l: Lenis | null): void => { current = l; };

export function scrollToTop(): void {
  if (current) current.scrollTo(0, { duration: 1.6, force: true });
  else window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function scrollToId(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  if (current) current.scrollTo(el, { offset: 0, duration: 1.6, force: true });
  else el.scrollIntoView({ behavior: 'smooth' });
}

// Пока открыто окно поверх страницы, колесо и клавиши не листают её под ним.
export function pauseScroll(): void { current?.stop(); }
export function resumeScroll(): void { current?.start(); }
