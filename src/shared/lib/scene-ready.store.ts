// Сцена готова, когда модель отрисовалась несколько кадров подряд: к этому моменту
// шейдеры скомпилированы, и загрузчик можно убирать без чёрной вспышки.
type Listener = () => void;
let ready = false;
const listeners = new Set<Listener>();

export const sceneReady = {
  get: (): boolean => ready,
  set(v: boolean): void {
    if (ready === v) return;
    ready = v;
    listeners.forEach((l) => l());
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
};
