import type { Landing } from '@content/landing.types';
import styles from './stats-band.module.css';

export function StatsBand({ stats, anchor, invert }: { stats: Landing['stats']; anchor: number; invert?: boolean }) {
  return (
    <section id="numbers" className={styles.band} data-anchor={anchor} data-invert={invert ?? false}>
      <div className={styles.grid}>
        {stats.map((s) => (
          <div key={s.label} className={styles.cell} data-reveal>
            <span className={styles.line} data-line />
            <strong className={styles.value} data-count={s.value}>{s.value}</strong>
            <span className={styles.label}>{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
