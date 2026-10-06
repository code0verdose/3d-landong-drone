import type { LandingExtras } from '@content/extras.types';
import { SplitWords } from '@shared/ui/split-words.component';
import styles from './spec-table.module.css';

export function SpecTable({ spec }: { spec: NonNullable<LandingExtras['spec']> }) {
  return (
    <section className={styles.wrap} data-module="spec">
      <h2 className={styles.title} data-split><SplitWords text={spec.title} /></h2>
      <dl className={styles.table} data-stagger>
        {spec.rows.map((r) => (
          <div key={r.label} className={styles.row}>
            <dt>{r.label}</dt>
            <span className={styles.leader} aria-hidden />
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
