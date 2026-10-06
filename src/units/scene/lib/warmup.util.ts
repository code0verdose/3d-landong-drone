// Прогрев шейдеров: в первом кадре модели показываем всё скрытое (детали, которые появляются
// по ходу скролла, растворяемые площадки), и сцена рендерится целиком через ту же постобработку.
// Шейдеры собираются под загрузчиком, а не в момент появления детали посреди прокрутки.
// gl.compile здесь не подходит: он собирает вариант для экрана, а постобработка рисует в текстуру.
// Отсечение по кадру на этот кадр выключено: иначе дальние кварталы маршрута не рисуются,
// и их шейдеры с буферами собирались бы позже, в момент подлёта.
import type { Material, Mesh, Object3D } from 'three';

export interface Warmup {
  /** В начале кадра: во втором кадре возвращает скрытому прежнюю невидимость. */
  before(): void;
  /** В конце кадра: в первом кадре показывает всё скрытое. */
  after(): void;
}

/** ready — готова ли сцена к прогреву: особые приёмы подменяют материалы, и прогревать нужно уже их. */
export function createWarmup(root: Object3D, ready: () => boolean = () => true): Warmup {
  let frame = 0;
  const objs: Object3D[] = [];
  const mats: Material[] = [];
  const culled: Object3D[] = [];
  return {
    before() {
      if (frame !== 1) return;
      objs.forEach((o) => { o.visible = false; });
      mats.forEach((m) => { m.visible = false; });
      culled.forEach((o) => { o.frustumCulled = true; });
      objs.length = 0;
      mats.length = 0;
      culled.length = 0;
    },
    after() {
      if (frame === 0 && !ready()) return;
      frame++;
      if (frame !== 1) return;
      root.traverse((o) => {
        if (!o.visible) { objs.push(o); o.visible = true; }
        if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; }
        const m = (o as Mesh).material;
        if (!m) return;
        for (const x of Array.isArray(m) ? m : [m]) {
          if (!x.visible) { mats.push(x); x.visible = true; }
        }
      });
    },
  };
}
