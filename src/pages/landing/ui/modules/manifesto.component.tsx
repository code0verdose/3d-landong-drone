import styles from './manifesto.module.css';

/** Крупный текст бренда: слова заливаются цветом по мере прокрутки (data-scrub-words). */
export function Manifesto({ text, brand }: { text: string; brand: string }) {
  return (
    <section className={styles.wrap} data-module="manifesto">
      <span className={styles.kicker} data-reveal>{brand} — коротко</span>
      <p className={styles.text} data-scrub-words>
        {text.split(' ').map((w, i) => <span key={i}>{w} </span>)}
      </p>
    </section>
  );
}
