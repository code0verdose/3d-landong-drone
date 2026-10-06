import type { Landing } from '@content/landing.types';
import { SplitWords } from '@shared/ui/split-words.component';
import styles from './finale.module.css';

export function Finale({ finale, footer, brand }: { finale: Landing['finale']; footer: string; brand: string }) {
  return (
    <section id="finale" className={styles.finale}>
      <div className={styles.glow} aria-hidden />
      <h2 className={styles.title} data-split><SplitWords text={finale.title} /></h2>
      <p className={styles.text} data-reveal>{finale.text}</p>
      <button type="button" className={styles.cta} data-reveal data-delay="0.15">
        <span>{finale.cta}</span><i>→</i>
      </button>
      <footer className={styles.footer}>
        <span className={styles.brand}>{brand}</span>
        <span>{footer}</span>
      </footer>
    </section>
  );
}
