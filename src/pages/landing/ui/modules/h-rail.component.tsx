import type { ReactNode } from 'react';
import { SplitWords } from '@shared/ui/split-words.component';
import styles from './h-rail.module.css';

interface Props { title: string; kicker: string; children: ReactNode; progress?: boolean }

/** Горизонтальная лента: блок прилипает к экрану, вертикальная прокрутка сдвигает карточки вбок (data-hpin).
 *  progress — полоса прогресса внизу; у шагов её роль играет заливка линии между точками. */
export function HRail({ title, kicker, children, progress = true }: Props) {
  return (
    <section className={styles.wrap} data-module="rail" data-hpin>
      <div className={styles.head}>
        <span className={styles.kicker}>{kicker}</span>
        <h2 className={styles.title} data-split><SplitWords text={title} /></h2>
      </div>
      <div className={styles.viewport}>
        <div className={styles.track} data-htrack>{children}</div>
      </div>
      {progress && <div className={styles.progress}><i data-hbar /></div>}
    </section>
  );
}
