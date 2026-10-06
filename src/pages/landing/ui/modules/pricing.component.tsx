import type { LandingExtras } from '@content/extras.types';
import { SplitWords } from '@shared/ui/split-words.component';
import { scrollToId } from '@shared/lib/lenis.store';
import styles from './pricing.module.css';

export function Pricing({ pricing, cta }: { pricing: NonNullable<LandingExtras['pricing']>; cta: string }) {
  return (
    <section className={styles.wrap} data-module="pricing">
      <h2 className={styles.title} data-split><SplitWords text={pricing.title} /></h2>
      <div className={styles.grid} data-stagger>
        {pricing.plans.map((p) => (
          <article key={p.name} className={styles.plan} data-featured={p.featured ?? false}>
            {p.featured && <span className={styles.badge}>Чаще выбирают</span>}
            <h3 className={styles.name}>{p.name}</h3>
            <p className={styles.price}>{p.price}<small>{p.period}</small></p>
            <ul className={styles.points}>{p.points.map((x) => <li key={x}>{x}</li>)}</ul>
            <button type="button" className={styles.cta} onClick={() => scrollToId('finale')}>{cta}</button>
          </article>
        ))}
      </div>
    </section>
  );
}
