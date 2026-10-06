import { useEffect, type RefObject } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { scrollStore, resetScrollStore, scrollSampler } from '@shared/lib/scroll-store';
import { setLenis } from '@shared/lib/lenis.store';
import { clamp01, lerp, smooth } from '@shared/lib/math.util';
import type { Keyframe } from '../lib/keyframes.util';

gsap.registerPlugin(ScrollTrigger);

/**
 * Плавная прокрутка (Lenis) и перевод положения на странице в цели для 3D-сцены.
 * Опорные блоки помечены data-anchor; между их центрами сцена плавно переходит
 * от одного ракурса и доли анимации к следующим.
 * Эффект оправдан: подписка на внешний источник (скролл, ресайз) с отпиской.
 */
interface ScrollOptions {
  hideAfterStory?: boolean;   // сцена полностью гаснет после истории
  finaleAnchor?: number;      // якорь последнего блока истории: до него секции перелистываются сами
  snap?: boolean;             // между первым экраном и последним блоком секции перелистываются сами
}

const SNAP_DURATION = 1.8;          // секунды на переход между секциями — одинаково при любом рывке колеса
// Новый жест колеса или тачпада — пауза в событиях или рывок поверх затухающей инерции. Хвост инерции
// прошлого жеста не листает дальше, но и не требует от человека остановиться: тачпад шлёт события без пауз.
const GESTURE_GAP_MS = 160;         // пауза, после которой любое событие — новый жест
const GESTURE_JUMP = 1.5;           // рост силы шага над последними, при котором это новый жест, а не инерция
const GESTURE_MIN = 12;             // слабее — хвост инерции
const SPIN_AFTER_MS = 300;          // колесо, которое крутят без остановки, листает дальше не чаще, чем так после перехода
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function useLandingScroll(root: RefObject<HTMLElement | null>, keys: Keyframe[], opts: ScrollOptions = {}): void {
  const { hideAfterStory = false, finaleAnchor, snap = false } = opts;
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    resetScrollStore();
    window.scrollTo(0, 0);
    // Перелистывание секций: точки остановки — конец первого экрана, середины закреплённых секций
    // и начало последнего блока. Внутри этого отрезка колесо не двигает страницу, а запускает переход
    // к соседней точке за фиксированное время. Первый экран и последний блок управляются скроллом.
    let stops: number[] = [];
    let animating = false;
    let settled = true;              // после перехода ждём новый жест: хвост прошлого не листает
    let lastWheel = 0;
    let completedAt = 0;
    let startedAt = 0;
    let queued = 0;                  // жест во время перехода — следующий переход сразу после текущего
    const recent: number[] = [];     // сила последних шагов: по ней отличаем новый жест от инерции
    // Что сделать с шагом прокрутки в направлении dir: true — обычная прокрутка, false — шаг поглощён
    // (переход запущен или идёт). delta — насколько далеко хотел уехать шаг (для границ отрезка).
    const snapStep = (dir: number, delta: number, fresh = true): boolean => {
      const y = lenis.targetScroll;
      const first = stops[0];
      const last = stops[stops.length - 1];
      // допуск маленький: «стоим на остановке» — только если переход до неё довёз; обычная прокрутка,
      // замершая в паре пикселей до границы, сначала довозится до неё, а не перескакивает дальше
      const eps = 2;
      // вне отрезка — обычная прокрутка, но не проскакиваем в него по инерции: останавливаемся на границе
      if (y < first - eps) {
        if (dir > 0 && y + delta >= first) {
          go(first);
          return false;
        }
        return true;
      }
      if (y > last + eps) {
        if (dir < 0 && y + delta <= last) {
          go(last);
          return false;
        }
        return true;
      }
      // до края отрезка доехали обычной прокруткой — продолжение того же жеста не листает дальше:
      // конец подбора коробки и начало финала — остановки, с них листает только новый жест
      if (!fresh && ((dir > 0 && Math.abs(y - first) <= eps) || (dir < 0 && Math.abs(y - last) <= eps))) {
        settled = false;
        completedAt = performance.now();
        return false;
      }
      // на краях отрезка наружу — обычная прокрутка: вверх в первый экран, вниз в последний блок
      if (dir < 0 && y <= first + eps) return true;
      if (dir > 0 && y >= last - eps) return true;
      const target = dir > 0 ? stops.find((s) => s > y + eps) : [...stops].reverse().find((s) => s < y - eps);
      if (target === undefined) return true;
      go(target);
      return false;
    };
    const onVirtualScroll = ({ deltaY, event }: { deltaY: number; event: Event }): boolean => {
      if (!snap || stops.length < 2 || event.type !== 'wheel') return true;
      // Lenis при false выходит раньше, чем гасит событие, и браузер прокрутил бы страницу сам —
      // инерция тачпада проскакивала бы секции. Поглощённый шаг гасим здесь.
      const swallow = () => {
        if (event.cancelable) event.preventDefault();
        return false;
      };
      const now = performance.now();
      const gap = now - lastWheel;
      lastWheel = now;
      const mag = Math.abs(deltaY);
      const prevMax = recent.length ? Math.max(...recent.slice(-3)) : 0;
      const prevLast = recent.length ? recent[recent.length - 1] : 0;
      recent.push(mag);
      if (recent.length > 6) recent.shift();
      if (deltaY === 0) return animating ? swallow() : true;
      const dir = deltaY > 0 ? 1 : -1;
      const fresh = gap > GESTURE_GAP_MS || (mag >= GESTURE_MIN && mag > prevMax * GESTURE_JUMP);
      if (animating) {
        // в очередь — только явно новый жест, начатый во время перехода, а не продолжение того,
        // что этот переход запустил (иначе заход на границу сразу пролетал бы следующую остановку)
        if (fresh && now - startedAt > 250) queued = dir;
        return swallow();
      }
      if (!settled) {
        const spinning = mag >= 24 && mag >= prevLast && now - completedAt > SPIN_AFTER_MS;
        if (!fresh && !spinning) return swallow();
        settled = true;
      }
      return snapStep(dir, deltaY, fresh) ? true : swallow();
    };
    // клавиши листают так же, как колесо: иначе стрелки и пробел проскакивали бы переходы
    const onKey = (e: KeyboardEvent) => {
      if (!snap || stops.length < 2 || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const down = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey);
      const up = e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey);
      if (!down && !up) return;
      const dir = down ? 1 : -1;
      if (animating) {
        queued = dir;
        e.preventDefault();
        return;
      }
      if (!snapStep(dir, dir * window.innerHeight * 0.9)) e.preventDefault();
    };
    const go = (target: number) => {
      animating = true;
      settled = false;
      queued = 0;
      startedAt = performance.now();
      lenis.scrollTo(target, {
        duration: SNAP_DURATION,
        easing: easeInOutCubic,
        lock: true,
        force: true,
        onComplete: () => {
          animating = false;
          completedAt = performance.now();
          // жест, сделанный во время перехода, не теряется: сразу следующий переход в ту же сторону
          if (queued) {
            const q = queued;
            queued = 0;
            snapStep(q, q * window.innerHeight);
          }
        },
      });
    };
    const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, touchMultiplier: 1.4, virtualScroll: onVirtualScroll });
    setLenis(lenis);
    // Два набора опор. Доля анимации модели идёт непрерывно между центрами блоков.
    // Камера (ракурс, сторона, приглушение) держится, пока текст секции прилип к экрану,
    // и переезжает только в промежутке между секциями — текст и модель не пересекаются.
    // В режиме сценария доля анимации идёт по точкам закрепления: внутри закреплённого блока
    // она меняется от progress до end (у секций они равны — модель стоит), между блоками — переход.
    let track: { pos: number; p: number }[] = [];
    let holds: { pos: number; k: number }[] = [];
    let storyEnd = Infinity;

    const measure = () => {
      const ih = window.innerHeight;
      const els = Array.from(el.querySelectorAll<HTMLElement>('[data-anchor]'))
        .sort((a, b) => Number(a.dataset.anchor) - Number(b.dataset.anchor));
      track = [];
      holds = [];
      stops = [];
      const story = el.querySelector<HTMLElement>('#story');
      storyEnd = story ? story.getBoundingClientRect().bottom + window.scrollY : Infinity;
      els.forEach((a, k) => {
        const top = a.getBoundingClientRect().top + window.scrollY;
        const h = a.offsetHeight;
        const key = keys[Math.min(k, keys.length - 1)];
        const pinned = a.dataset.hold !== undefined && h > ih;
        if (pinned) {
          holds.push({ pos: top + ih / 2, k }, { pos: top + h - ih / 2, k });
        } else {
          holds.push({ pos: top + h / 2, k });
        }
        if (snap && finaleAnchor !== undefined && k <= finaleAnchor) {
          const y0 = top;
          // первый экран — конец закрепления, последний блок — его начало, секции — середина закрепления
          stops.push(k === 0 ? y0 + h - ih : k === finaleAnchor ? y0 : y0 + (h - ih) / 2);
        }
        if (pinned && key.end !== undefined && key.tail) {
          const len = h - ih;
          track.push(
            { pos: top + ih / 2, p: key.progress },
            { pos: top + ih / 2 + len * (1 - key.tail), p: key.end },
            { pos: top + h - ih / 2, p: key.end },
          );
        } else if (pinned && key.end !== undefined) {
          track.push({ pos: top + ih / 2, p: key.progress }, { pos: top + h - ih / 2, p: key.end });
        } else {
          track.push({ pos: top + h / 2, p: key.progress });
        }
      });
    };

    const segment = (arr: number[], c: number) => {
      let i = 0;
      while (i < arr.length - 2 && c >= arr[i + 1]) i++;
      return { i, f: clamp01((c - arr[i]) / Math.max(1, arr[i + 1] - arr[i])) };
    };

    // цели 3D-сцены для позиции c (центр экрана в координатах страницы)
    const sampleScene = (c: number) => {
      const pr = segment(track.map((t) => t.pos), c);
      scrollStore.progress = track.length
        ? lerp(track[pr.i].p, track[Math.min(pr.i + 1, track.length - 1)].p, pr.f)
        : 0;
      const cam = segment(holds.map((h) => h.pos), c);
      const ka = holds[cam.i]?.k ?? 0;
      const kb = holds[Math.min(cam.i + 1, holds.length - 1)]?.k ?? 0;
      const a = keys[ka];
      const b = keys[kb];
      const f = smooth(cam.f);
      scrollStore.shotA = ka;
      scrollStore.shotB = kb;
      scrollStore.blend = cam.f;
      scrollStore.offset = lerp(a.offset, b.offset, f);
      scrollStore.dim = lerp(a.dim, b.dim, f);
      scrollStore.lift = lerp(a.lift, b.lift, f);
      scrollStore.zoom = lerp(a.zoom, b.zoom, f);
    };
    const update = () => {
      sampleScene(window.scrollY + window.innerHeight / 2);
      // сцена растворяется в конце последней секции и исчезает целиком до того, как следующий блок
      // покажется из-под экрана: от 30% экрана до конца истории до 5% экрана до её конца
      const ih = window.innerHeight;
      scrollStore.hide = hideAfterStory ? clamp01((window.scrollY + ih - (storyEnd - ih * 0.3)) / (ih * 0.25)) : 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollStore.page = max > 0 ? clamp01(window.scrollY / max) : 0;
      scrollStore.velocity = lenis.velocity;
    };

    lenis.on('scroll', () => {
      ScrollTrigger.update();
      update();
    });
    scrollSampler.sample = sampleScene;
    window.addEventListener('keydown', onKey);
    const tick = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    const ro = new ResizeObserver(() => {
      measure();
      update();
      ScrollTrigger.refresh();
    });
    ro.observe(el);
    measure();
    update();
    return () => {
      scrollSampler.sample = null;
      window.removeEventListener('keydown', onKey);
      ro.disconnect();
      gsap.ticker.remove(tick);
      lenis.destroy();
      setLenis(null);
    };
  }, [root, keys, hideAfterStory, finaleAnchor, snap]);
}
