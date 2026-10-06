import { scrollToId, scrollToTop } from '@shared/lib/lenis.store';
import styles from './landing-nav.module.css';

interface Props { brand: string; cta: string }

export function LandingNav({ brand, cta }: Props) {
  return (
    <header className={styles.nav}>
      <button type="button" className={styles.brand} onClick={scrollToTop}>{brand}</button>
      <nav className={styles.links}>
        <button type="button" onClick={() => scrollToId('story')}>Продукт</button>
        <button type="button" onClick={() => scrollToId('numbers')}>Цифры</button>
        <button type="button" onClick={() => scrollToId('features')}>Детали</button>
      </nav>
      <button type="button" className={styles.cta} onClick={() => scrollToId('finale')}>{cta}</button>
    </header>
  );
}
