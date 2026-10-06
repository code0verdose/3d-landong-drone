// Что glTF не переносит из Блендера, делается здесь поверх загруженной сцены: винты крутятся
// по времени, дрон покачивается в воздухе, камера берётся из пустышек сцены, у фонарей — пятна света.
import {
  AdditiveBlending, CanvasTexture, Group, InstancedMesh, Matrix4, MeshBasicMaterial, Object3D, PlaneGeometry,
  PointLight, Quaternion, Vector3,
} from 'three';
import { clamp01 } from '@shared/lib/math.util';
import { cameraStore, resetCameraStore } from '@shared/lib/camera-store';
import type { Special } from './models.config';

export interface SpecialHandle {
  update(progress: number, time: number): void;
  dispose(): void;
}

function findByName(root: Object3D, name: string): Object3D | undefined {
  // Точное имя важнее начала имени: «Дрон» не должен находить корень «Дрон 3 pivot».
  // Суффикс Блендера (.001, .002) не мешает точному
  // совпадению: загрузчик заменяет пробелы на «_», а точку выбрасывает («Дрон.002» → «Дрон002»).
  let exact: Object3D | undefined;
  let prefix: Object3D | undefined;
  root.traverse((o) => {
    const n = o.name.replace(/_/g, ' ');
    if (!exact && n.replace(/ ?\d{3}$/, '') === name) exact = o;
    if (!prefix && n.startsWith(name)) prefix = o;
  });
  return exact ?? prefix;
}

interface Wrap {
  group: Group;
  undo(): void;
}

/**
 * Прослойка для добавок поверх анимации из Блендера. Миксер пишет только в сам узел, а покачивание
 * и вращение — в прослойку, абсолютными значениями. Ничего не копится, даже если миксер молчит
 * (он пишет позу, только когда она изменилась) или сцена пережила горячую перезагрузку кода.
 * inside — прослойка между узлом и его детьми (вращение вокруг центра узла),
 * outside — между узлом и его родителем (сдвиг узла целиком).
 */
function wrap(o: Object3D | undefined, mode: 'inside' | 'outside'): Wrap | null {
  if (!o || (mode === 'outside' && !o.parent)) return null;
  const group = new Group();
  if (mode === 'inside') {
    [...o.children].forEach((c) => group.add(c));
    o.add(group);
    return {
      group,
      undo() {
        [...group.children].forEach((c) => o.add(c));
        o.remove(group);
      },
    };
  }
  const parent = o.parent!;
  parent.add(group);
  group.add(o);
  return {
    group,
    undo() {
      parent.add(o);
      parent.remove(group);
    },
  };
}

interface Stage {
  update(p: number): void;
  dispose(): void;
}

/** Пятна тёплого света на земле под фонарями карты: одна отрисовка на все фонари.
 *  Позиции — пустышки «Свет фонаря NN» у основания фонаря, масштаб пустышки — высота фонаря в метрах. */
function lampPools(lamps: Object3D[]): { dispose(): void } {
  const parent = lamps[0]?.parent;
  if (!parent) return { dispose() {} };
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.4)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new CanvasTexture(c);
  const geo = new PlaneGeometry(2, 2);
  geo.rotateX(-Math.PI / 2);
  const mat = new MeshBasicMaterial({
    map: tex, color: '#ffb066', transparent: true, opacity: 0.42, blending: AdditiveBlending, depthWrite: false,
  });
  const inst = new InstancedMesh(geo, mat, lamps.length);
  const m = new Matrix4();
  const q = new Quaternion();
  const sc = new Vector3();
  const pos = new Vector3();
  lamps.forEach((l, i) => {
    // радиус пятна ~0.9 высоты фонаря (метры → единицы сцены ×3); чуть выше тротуара, чтобы не мерцало
    const r = l.scale.x * 3 * 0.9;
    pos.copy(l.position);
    pos.y += 0.54;
    sc.set(r, 1, r);
    inst.setMatrixAt(i, m.compose(pos, q, sc));
  });
  inst.instanceMatrix.needsUpdate = true;
  // габарит у инстансов считается по одной плашке — отсечение по кадру прятало бы дальние пятна
  inst.frustumCulled = false;
  parent.add(inst);
  return {
    dispose() {
      parent.remove(inst);
      geo.dispose();
      mat.dispose();
      tex.dispose();
    },
  };
}

/** Постановка сплошной карты: мир целиком на месте, камера задана в сцене (пустышки «Камера»
 *  и «Цель камеры»), у двери и у фонарей свой свет, у дрона — мягкая подсветка снизу. */
function mapStage(root: Object3D, droneNode: Object3D | undefined): Stage {
  const camNode = findByName(root, 'Камера');
  const tgtNode = findByName(root, 'Цель камеры');
  const lamps: Object3D[] = [];
  root.traverse((o) => {
    if (o.name.replace(/_/g, ' ').startsWith('Свет фонаря')) lamps.push(o);
  });
  const pools = lampPools(lamps);
  const doorAnchor = findByName(root, 'Свет у двери');
  const door = new PointLight('#ffc98f', 5, 12, 2);
  doorAnchor?.add(door);
  // подсветка снизу: коробка и корпус читаются на фоне ночного города, у фасадов — живое пятно света
  const down = new PointLight('#d8e6ff', 3, 10, 2);
  down.position.set(0, -0.35, 0.1);
  droneNode?.add(down);
  const v = new Vector3();
  cameraStore.active = !!(camNode && tgtNode);
  return {
    update() {
      if (camNode && tgtNode) {
        camNode.getWorldPosition(v);
        cameraStore.cx = v.x; cameraStore.cy = v.y; cameraStore.cz = v.z;
        tgtNode.getWorldPosition(v);
        cameraStore.tx = v.x; cameraStore.ty = v.y; cameraStore.tz = v.z;
      }
      if (droneNode) {
        droneNode.getWorldPosition(v);
        cameraStore.sx = v.x; cameraStore.sy = v.y; cameraStore.sz = v.z;
      }
    },
    dispose() {
      pools.dispose();
      doorAnchor?.remove(door);
      door.dispose();
      droneNode?.remove(down);
      down.dispose();
      resetCameraStore();
    },
  };
}

function drone(root: Object3D): SpecialHandle {
  const parcel = findByName(root, 'Посылка');
  const droneNode = findByName(root, 'Дрон');
  const stage = mapStage(root, droneNode);
  // живой дрон: винты крутятся по времени, а не только от скролла, корпус чуть покачивается в воздухе
  const body = wrap(droneNode, 'inside');
  const tether = wrap(findByName(root, 'Трос'), 'outside');
  const box = wrap(parcel, 'outside');
  const props = [1, 2, 3, 4].map((i) => wrap(findByName(root, `Пропеллер ${i}`), 'inside'));
  const all = [body, tether, box, ...props];
  const SPIN_DIR = [1, -1, -1, 1];   // соседние винты крутятся навстречу, как в Блендере
  const UP = new Vector3(0, 1, 0);
  let spinAngle = 0;
  let lastTime = -1;
  return {
    update(p, time) {
      const dt = lastTime < 0 ? 0 : Math.min(time - lastTime, 0.1);
      lastTime = time;
      // постановка читает позы без покачивания: качается дрон, а не кадр
      if (box) box.group.position.y = 0;
      stage.update(p);
      // винты раскручиваются с момента раскладки (кадр 18 из 240) и дальше не останавливаются
      spinAngle = (spinAngle + dt * 16 * clamp01((p - 0.07) / 0.05)) % (Math.PI * 2);
      props.forEach((w, i) => w?.group.quaternion.setFromAxisAngle(UP, spinAngle * SPIN_DIR[i]));
      // покачивание только в воздухе: мягкий подъём-спуск и крен в пару градусов
      const air = clamp01((p - 0.12) / 0.08) * (1 - clamp01((p - 0.93) / 0.05));
      const bob = Math.sin(time * 1.7) * 0.05 * air;
      if (body) {
        // прослойка внутри корпуса: он отмасштабирован в Блендере на 1.9, сдвиг задаём в его единицах
        body.group.position.y = bob / 1.9;
        body.group.rotation.set(Math.sin(time * 1.1 + 1) * 0.02 * air, 0, Math.sin(time * 1.3) * 0.025 * air);
      }
      if (tether) tether.group.position.y = bob;
      // коробка качается вместе с дроном, пока висит на нём: от подъёма с площадки до отцепки у двери
      if (box) box.group.position.y = p > 0.25 && p < 0.88 ? bob : 0;
    },
    dispose() {
      // снимаем в обратном порядке: внешние прослойки могли оказаться внутри внутренних
      [...all].reverse().forEach((w) => w?.undo());
      stage.dispose();
    },
  };
}

export function createSpecial(kind: Special | undefined, root: Object3D): SpecialHandle | null {
  return kind === 'drone' ? drone(root) : null;
}
