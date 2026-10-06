import type { Landing } from '@content/landing.types';
import type { HeroVariant } from '@content/page-plan';
import { SplitWords } from '@shared/ui/split-words.component';
import { scrollToId } from '@shared/lib/lenis.store';
import { openLead } from '@shared/lib/lead-dialog.store';
import styles from './hero.module.css';

interface Props { hero: Landing['hero']; product: string; variant: HeroVariant; pin?: boolean }

/** pin — первый экран закреплён, пока скролл проигрывает вступительную анимацию модели. */
export function Hero({ hero, product, variant, pin }: Props) {
  const content = (
    <section className={styles.hero} data-anchor={pin ? undefined : '0'} data-hero={variant} data-long={hero.title.length > 30}>
      <div className={styles.inner}>
        <p className={styles.eyebrow} data-reveal="now"><span className={styles.dot} />{hero.eyebrow}</p>
        <h1 className={styles.title} data-split="now"><SplitWords text={hero.title} /></h1>
        <div className={styles.lower}>
          <p className={styles.subtitle} data-reveal="now" data-delay="0.1">{hero.subtitle}</p>
          <div className={styles.actions} data-reveal="now" data-delay="0.2">
            <button type="button" className={styles.primary} onClick={() => openLead()}>{hero.cta}</button>
            <button type="button" className={styles.secondary} onClick={() => scrollToId('story')}>{hero.ctaSecondary}</button>
          </div>
        </div>
      </div>
      <div className={styles.foot} data-reveal="now" data-delay="0.4">
        <span>{product}</span>
        <span className={styles.hint}>Листайте<i /></span>
      </div>
    </section>
  );
  return pin ? <div className={styles.pin} data-anchor="0" data-hold>{content}</div> : content;
}
