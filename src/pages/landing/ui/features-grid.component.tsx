import type { Landing } from '@content/landing.types';
import type { FeaturesVariant } from '@content/page-plan';
import { SplitWords } from '@shared/ui/split-words.component';
import styles from './features-grid.module.css';

interface Props { features: Landing['features']; brand: string; variant: FeaturesVariant }

/** Шесть деталей продукта в одном из трёх видов: карточки, бенто-сетка или редакционный список. */
export function FeaturesGrid({ features, brand, variant }: Props) {
  return (
    <section id="features" className={styles.wrap} data-variant={variant}>
      <header className={styles.head}>
        <span className={styles.kicker} data-reveal>Что внутри {brand}</span>
        <h2 className={styles.title} data-split><SplitWords text="Шесть деталей, которые решают" /></h2>
      </header>
      <div className={styles.grid} data-stagger>
        {features.map((f, i) => (
          <article key={f.title} className={styles.card}>
            <span className={styles.num}>{String(i + 1).padStart(2, '0')}</span>
            <h3 className={styles.cardTitle}>{f.title}</h3>
            <p className={styles.text}>{f.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
