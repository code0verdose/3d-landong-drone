import type { LandingExtras } from '@content/extras.types';
import { HRail } from './h-rail.component';
import styles from './timeline-rail.module.css';

export function TimelineRail({ timeline }: { timeline: NonNullable<LandingExtras['timeline']> }) {
  return (
    <HRail title={timeline.title} kicker="Как это происходит" progress={false}>
      <div className={styles.line} aria-hidden>
        <i className={styles.fill} data-hfill />
      </div>
      {timeline.steps.map((s) => (
        <article key={s.title} className={styles.step}>
          <span className={styles.dot} />
          <span className={styles.label}>{s.step}</span>
          <h3 className={styles.title}>{s.title}</h3>
          <p className={styles.text}>{s.text}</p>
        </article>
      ))}
    </HRail>
  );
}
