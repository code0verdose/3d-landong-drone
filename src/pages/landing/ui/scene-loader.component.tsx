import { useSyncExternalStore } from 'react';
import { useProgress } from '@react-three/drei';
import { sceneReady } from '@shared/lib/scene-ready.store';
import styles from './scene-loader.module.css';

export function SceneLoader({ brand }: { brand: string }) {
  const { progress } = useProgress();
  const ready = useSyncExternalStore(sceneReady.subscribe, sceneReady.get);
  return (
    <div className={styles.loader} data-done={ready} aria-hidden={ready}>
      <span className={styles.brand}>{brand}</span>
      <span className={styles.pct}>{Math.round(ready ? 100 : Math.min(progress, 96))}%</span>
      <span className={styles.track}><i style={{ transform: `scaleX(${ready ? 1 : Math.min(progress, 96) / 100})` }} /></span>
    </div>
  );
}
