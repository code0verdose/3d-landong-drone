import { useLayoutEffect, type RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { formatCount, parseCount } from '@shared/lib/count.util';

gsap.registerPlugin(ScrollTrigger);

/**
 * Анимации текста по скроллу, объявленные атрибутами в разметке:
 * data-split — слова поднимаются из маски; data-reveal — блок проявляется;
 * data-line — линия прорисовывается; data-count — число досчитывается;
 * data-parallax="0.3" — элемент сдвигается медленнее прокрутки; data-stagger — дети по очереди.
 * Эффект оправдан: императивные анимации GSAP с полной очисткой через gsap.context.
 */
export function useReveal(root: RefObject<HTMLElement | null>, key: string): void {
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      // у каждой раскладки свой характер появления заголовков
      const layout = el.dataset.layout ?? 'split';
      const wordsFrom: Record<string, gsap.TweenVars> = {
        split: { yPercent: 118, rotate: 4, duration: 1.15, ease: 'expo.out', stagger: 0.055 },
        center: { opacity: 0, y: 30, filter: 'blur(12px)', duration: 1.3, ease: 'power3.out', stagger: 0.07 },
        editorial: { yPercent: 110, skewY: 9, duration: 1.4, ease: 'power4.out', stagger: 0.08 },
        tech: { opacity: 0, x: -24, duration: 0.6, ease: 'power2.out', stagger: 0.035 },
      };
      gsap.utils.toArray<HTMLElement>('[data-split]').forEach((node) => {
        const words = node.querySelectorAll('.w');
        const immediate = node.dataset.split === 'now';
        gsap.from(words, {
          ...(wordsFrom[layout] ?? wordsFrom.split),
          delay: immediate ? 0.35 : 0,
          scrollTrigger: immediate ? undefined : { trigger: node, start: 'top 82%', toggleActions: 'play none none reverse' },
        });
      });
      // перебор символов: подписи в технической раскладке «набираются», как на терминале
      if (layout === 'tech') {
        const glyphs = '01<>/[]#%&*+=';
        gsap.utils.toArray<HTMLElement>('[data-scramble]').forEach((node) => {
          const text = node.textContent ?? '';
          const state = { p: 0 };
          const render = () => {
            const n = Math.floor(state.p * text.length);
            node.textContent = text.slice(0, n) + text.slice(n).replace(/\S/g, () => glyphs[Math.floor(Math.random() * glyphs.length)]);
          };
          gsap.to(state, {
            p: 1, duration: 1.1, ease: 'none', onUpdate: render, onComplete: () => { node.textContent = text; },
            scrollTrigger: { trigger: node, start: 'top 88%' },
          });
        });
      }
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((node) => {
        const immediate = node.dataset.reveal === 'now';
        gsap.from(node, {
          y: 36, opacity: 0, filter: 'blur(6px)', duration: 1.1, ease: 'power3.out',
          delay: immediate ? 0.75 + Number(node.dataset.delay ?? 0) : Number(node.dataset.delay ?? 0),
          scrollTrigger: immediate ? undefined : { trigger: node, start: 'top 86%', toggleActions: 'play none none reverse' },
        });
      });
      gsap.utils.toArray<HTMLElement>('[data-stagger]').forEach((node) => {
        gsap.from(node.children, {
          y: 50, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.09,
          scrollTrigger: { trigger: node, start: 'top 82%', toggleActions: 'play none none reverse' },
        });
      });
      gsap.utils.toArray<HTMLElement>('[data-line]').forEach((node) => {
        gsap.fromTo(node, { scaleX: 0 }, {
          scaleX: 1, transformOrigin: 'left center', duration: 1.4, ease: 'expo.out',
          scrollTrigger: { trigger: node, start: 'top 90%' },
        });
      });
      gsap.utils.toArray<HTMLElement>('[data-count]').forEach((node) => {
        const parts = parseCount(node.dataset.count ?? '');
        if (!parts) return;
        const obj = { v: 0 };
        node.textContent = formatCount(parts, 0);
        gsap.to(obj, {
          v: parts.value, duration: 2.2, ease: 'power2.out',
          scrollTrigger: { trigger: node, start: 'top 88%' },
          onUpdate: () => { node.textContent = formatCount(parts, obj.v); },
        });
      });
      gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((node) => {
        const k = Number(node.dataset.parallax ?? 0.2);
        gsap.fromTo(node, { yPercent: -40 * k }, {
          yPercent: 40 * k, ease: 'none',
          scrollTrigger: { trigger: node.parentElement ?? node, start: 'top bottom', end: 'bottom top', scrub: true },
        });
      });
      // манифест: слова заливаются цветом синхронно с прокруткой
      gsap.utils.toArray<HTMLElement>('[data-scrub-words]').forEach((node) => {
        gsap.to(node.children, {
          opacity: 1, stagger: 0.12, ease: 'none',
          scrollTrigger: { trigger: node, start: 'top 78%', end: 'bottom 42%', scrub: true },
        });
      });
      // горизонтальные ленты: блок закрепляется, вертикальная прокрутка двигает карточки вбок
      gsap.utils.toArray<HTMLElement>('[data-hpin]').forEach((node) => {
        const track = node.querySelector<HTMLElement>('[data-htrack]');
        const bar = node.querySelector<HTMLElement>('[data-hbar]');
        const fill = node.querySelector<HTMLElement>('[data-hfill]');
        if (!track) return;
        const dist = () => Math.max(0, track.scrollWidth - node.clientWidth + 48);
        const tl = gsap.timeline({
          scrollTrigger: { trigger: node, start: 'top top', end: () => `+=${dist()}`, pin: true, scrub: 0.6, invalidateOnRefresh: true },
        });
        tl.to(track, { x: () => -dist(), ease: 'none' }, 0);
        if (bar) tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, ease: 'none' }, 0);
        if (fill) tl.fromTo(fill, { scaleX: 0 }, { scaleX: 1, ease: 'none' }, 0);
      });
      // сравнение: пункты «до» зачёркиваются и гаснут, пункты «после» загораются — по очереди
      gsap.utils.toArray<HTMLElement>('[data-wipe]').forEach((node) => {
        const before = node.querySelectorAll<HTMLElement>('[data-wipe-before]');
        const after = node.querySelectorAll<HTMLElement>('[data-wipe-after]');
        const arrow = node.querySelector<HTMLElement>('[data-wipe-arrow]');
        const tl = gsap.timeline({ scrollTrigger: { trigger: node, start: 'top top', end: '+=120%', pin: true, scrub: 0.5 } });
        before.forEach((li, i) => {
          tl.to(li, { '--s': 1, duration: 1, ease: 'none' }, i * 1.2);
          tl.to(li, { opacity: 0.35, duration: 0.6, ease: 'none' }, i * 1.2 + 0.6);
          if (after[i]) tl.to(after[i], { opacity: 1, duration: 0.8, ease: 'none' }, i * 1.2 + 0.4);
        });
        if (arrow) tl.fromTo(arrow, { rotate: 0, scale: 0.8 }, { rotate: 360, scale: 1, duration: before.length * 1.2, ease: 'none' }, 0);
      });
    }, el);
    return () => ctx.revert();
  }, [root, key]);
}
