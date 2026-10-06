import { Fragment } from 'react';
import styles from './split-words.module.css';

/** Разбивает строку на слова в масках: GSAP поднимает каждое слово из-под обреза.
 *  Пробел стоит снаружи маски — внутри inline-block он схлопывается. */
export function SplitWords({ text }: { text: string }) {
  const words = text.split(' ');
  return (
    <>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span className={styles.mask}><span className={`${styles.word} w`}>{w}</span></span>
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </>
  );
}
