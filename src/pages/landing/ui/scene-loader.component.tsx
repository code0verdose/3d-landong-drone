import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useProgress } from '@react-three/drei';
import { sceneReady } from '@shared/lib/scene-ready.store';
import styles from './scene-loader.module.css';

/** Роторы квадрокоптера сверху: центры, направление вращения (соседние — навстречу, как у настоящего). */
const ROTORS = [
  { x: 46, y: 46, dir: 1 },
  { x: 154, y: 46, dir: -1 },
  { x: 154, y: 154, dir: 1 },
  { x: 46, y: 154, dir: -1 },
] as const;
const GUARD_R = 34;
const GUARD_LEN = 2 * Math.PI * GUARD_R;

/** Обороты в секунду от доли загрузки: раскрутка, как при взведении дрона перед взлётом. */
const revs = (p: number, ready: boolean) => (ready ? 16 : 0.5 + 10.5 * Math.pow(p, 1.6));
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const STATUS: [number, string][] = [
  [0, 'Калибровка датчиков'],
  [0.35, 'Проверка лопастей'],
  [0.7, 'Связь с базой'],
  [0.96, 'Готов к взлёту'],
];

/**
 * Экран загрузки — дрон Lopastra сверху: пропеллеры раскручиваются вместе с загрузкой сцены,
 * кольца роторов заполняются прогрессом, мигают навигационные огни. Когда сцена готова,
 * дрон взлетает и экран растворяется в первый кадр.
 */
export function SceneLoader({ brand }: { brand: string }) {
  const { progress } = useProgress();
  const ready = useSyncExternalStore(sceneReady.subscribe, sceneReady.get);
  const p = ready ? 1 : Math.min(progress, 96) / 100;
  const props = useRef<(SVGGElement | null)[]>([]);
  const state = useRef({ p, ready });
  state.current = { p, ready };

  // эффект оправдан: вращение пропеллеров — свой цикл rAF, без ре-рендера React на каждый кадр
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = performance.now();
    let speed = 0.5;
    const angles = ROTORS.map((_, i) => i * 37);
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const target = revs(state.current.p, state.current.ready) * (reduce ? 0.15 : 1);
      // раскрутка инерционная: лопасти разгоняются, а не прыгают на новые обороты
      speed += (target - speed) * (1 - Math.exp(-dt * 2.2));
      const blur = clamp01((speed - 3.5) / 6);
      ROTORS.forEach((r, i) => {
        angles[i] = (angles[i] + r.dir * speed * 360 * dt) % 360;
        const g = props.current[i];
        if (!g) return;
        g.setAttribute('transform', `rotate(${angles[i].toFixed(2)} ${r.x} ${r.y})`);
        g.style.setProperty('--blur', blur.toFixed(3));
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const status = [...STATUS].reverse().find(([at]) => p >= at)?.[1] ?? STATUS[0][1];
  const pct = Math.round(p * 100);

  return (
    <div className={styles.loader} data-done={ready} aria-hidden={ready} role="status" aria-label={`Загрузка ${pct}%`}>
      <div className={styles.drone}>
        <svg viewBox="0 0 200 200" className={styles.svg} aria-hidden>
          <defs>
            <radialGradient id="ld-disc" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="var(--fg)" stopOpacity="0" />
              <stop offset="0.55" stopColor="var(--fg)" stopOpacity="0.06" />
              <stop offset="0.92" stopColor="var(--fg)" stopOpacity="0.22" />
              <stop offset="1" stopColor="var(--fg)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="ld-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="0.35" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="96" fill="url(#ld-glow)" className={styles.halo} />
          {/* лучи рамы */}
          <path d="M100 100 L46 46 M100 100 L154 46 M100 100 L154 154 M100 100 L46 154" className={styles.arm} />
          {ROTORS.map((r, i) => (
            <g key={i}>
              {/* защитное кольцо ротора и прогресс по нему */}
              <circle cx={r.x} cy={r.y} r={GUARD_R} className={styles.guard} />
              <circle
                cx={r.x}
                cy={r.y}
                r={GUARD_R}
                className={styles.fill}
                strokeDasharray={GUARD_LEN}
                strokeDashoffset={GUARD_LEN * (1 - clamp01(p * 4 - i))}
                transform={`rotate(-90 ${r.x} ${r.y})`}
              />
              <circle cx={r.x} cy={r.y} r="5" className={styles.motor} />
              <g
                ref={(el) => {
                  props.current[i] = el;
                }}
                className={styles.prop}
              >
                <circle cx={r.x} cy={r.y} r="30" fill="url(#ld-disc)" className={styles.disc} />
                <path
                  d={`M${r.x} ${r.y} C ${r.x - 6} ${r.y - 10}, ${r.x - 4} ${r.y - 26}, ${r.x + 1} ${r.y - 29} C ${r.x + 4} ${r.y - 24}, ${r.x + 4} ${r.y - 10}, ${r.x} ${r.y} Z M${r.x} ${r.y} C ${r.x + 6} ${r.y + 10}, ${r.x + 4} ${r.y + 26}, ${r.x - 1} ${r.y + 29} C ${r.x - 4} ${r.y + 24}, ${r.x - 4} ${r.y + 10}, ${r.x} ${r.y} Z`}
                  className={styles.blade}
                />
              </g>
              <circle cx={r.x} cy={r.y} r="2.4" className={styles.hub} />
            </g>
          ))}
          {/* корпус: обтекатель, камера и навигационные огни */}
          <rect x="78" y="70" width="44" height="60" rx="16" className={styles.body} />
          <rect x="86" y="80" width="28" height="12" rx="6" className={styles.canopy} />
          <circle cx="100" cy="122" r="5" className={styles.lens} />
          <circle cx="84" cy="74" r="2.6" className={styles.ledFront} />
          <circle cx="116" cy="74" r="2.6" className={styles.ledFront} />
          <circle cx="84" cy="126" r="2.6" className={styles.ledRear} />
          <circle cx="116" cy="126" r="2.6" className={styles.ledRear} />
        </svg>
      </div>
      <span className={styles.brand}>{brand}</span>
      <span className={styles.status}>
        <span className={styles.statusText}>{status}</span>
        <span className={styles.pct}>{pct}%</span>
      </span>
    </div>
  );
}
