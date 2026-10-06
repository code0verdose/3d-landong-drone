import type { LandingSection } from '@content/landing.types';
import { SplitWords } from '@shared/ui/split-words.component';
import styles from './story-section.module.css';

interface Props { section: LandingSection; index: number; total: number; long?: boolean }

export function StorySection({ section, index, total, long }: Props) {
  const n = String(index + 1).padStart(2, '0');
  return (
    <section className={styles.section} data-anchor={index + 1} data-hold data-side={section.side} data-long={long || undefined}>
      <div className={styles.sticky}>
        <span className={styles.bigNum} data-parallax="0.6" aria-hidden>{n}</span>
        <article className={styles.card}>
          <div className={styles.meta} data-reveal>
            <span className={styles.index}>{n} / {String(total).padStart(2, '0')}</span>
            <span className={styles.rule} data-line />
            <span className={styles.kicker} data-scramble>{section.kicker}</span>
          </div>
          <h2 className={styles.title} data-split><SplitWords text={section.title} /></h2>
          <p className={styles.body} data-reveal data-delay="0.1">{section.body}</p>
          {section.bullets && section.bullets.length > 0 && (
            <ul className={styles.bullets} data-stagger>
              {section.bullets.map((b) => <li key={b}>{b}</li>)}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
