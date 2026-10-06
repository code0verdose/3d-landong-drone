// Состояние прокрутки, которое читает 3D-сцена на каждом кадре.
// Намеренно не React-стейт: значения меняются на каждый пиксель, ре-рендер здесь не нужен.
export interface ScrollTargets {
  progress: number;   // доля анимации модели 0..1
  shotA: number;      // индекс ракурса, из которого идём
  shotB: number;      // индекс ракурса, в который идём
  blend: number;      // 0..1 между ними
  offset: number;     // сдвиг модели от текста: -1 влево, 1 вправо
  dim: number;        // 0..1 — насколько приглушить сцену в финальных блоках
  lift: number;       // сдвиг модели вниз кадра, когда текст стоит по центру над ней
  zoom: number;       // множитель дистанции камеры
  hide: number;       // 0..1 — сцена полностью убрана после истории
  page: number;       // 0..1 — прокрутка всей страницы
  velocity: number;   // скорость прокрутки от Lenis
}

export const scrollStore: ScrollTargets = {
  progress: 0, shotA: 0, shotB: 0, blend: 0, offset: 0, dim: 0, lift: 0, zoom: 1, hide: 0, page: 0, velocity: 0,
};

/**
 * Как пересчитать цели сцены для произвольной позиции прокрутки. Страница регистрирует функцию,
 * 3D-сцена вызывает её каждый кадр со сглаженной позицией — всё в сцене считается от одного числа
 * и в том же кадре, где рисуется, поэтому движение плавное и не зависит от порядка событий.
 */
export const scrollSampler: { sample: ((center: number) => void) | null } = { sample: null };

export function resetScrollStore(): void {
  Object.assign(scrollStore, { progress: 0, shotA: 0, shotB: 0, blend: 0, offset: 0, dim: 0, lift: 0, zoom: 1, hide: 0, page: 0, velocity: 0 });
}
