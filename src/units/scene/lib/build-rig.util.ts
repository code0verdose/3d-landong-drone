// Готовит загруженную сцену к прокрутке: миксер с одной анимацией, которую двигает скролл,
// и вписывание модели в единый радиус с учётом того, как она раздвигается по ходу анимации.
import { AnimationAction, AnimationClip, AnimationMixer, Box3, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, Sphere, Vector3 } from 'three';

export interface Rig {
  mixer: AnimationMixer | null;
  action: AnimationAction | null;
  duration: number;
  scale: number;
  offset: [number, number, number];
  setProgress(p: number): void;
}

/** Полированный металл из Блендера на вебе отражает направленный свет в белое пятно:
 *  чуть поднимаем шероховатость, цвет и характер материала не меняются. */
function tameMaterials(scene: Object3D): void {
  scene.traverse((o) => {
    const m = (o as Mesh).material as MeshStandardMaterial | MeshStandardMaterial[] | undefined;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) {
      if (!mat.isMeshStandardMaterial) continue;
      mat.emissiveIntensity = Math.min(mat.emissiveIntensity, 3);
      if (mat.metalness <= 0.7) continue;
      mat.roughness = Math.max(mat.roughness, 0.42);
      const c = mat.color;
      if (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 0.45) c.multiplyScalar(0.62);
    }
  });
}

/** Стекло через transmission заставляет three.js каждый кадр рендерить сцену второй раз в отдельную
 *  текстуру. Там, где стекло — мелкие линзы датчиков, хватает обычной полупрозрачности. */
function liteGlass(scene: Object3D): void {
  scene.traverse((o) => {
    const m = (o as Mesh).material as MeshPhysicalMaterial | MeshPhysicalMaterial[] | undefined;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) {
      if (!mat.isMeshPhysicalMaterial || mat.transmission <= 0) continue;
      mat.transmission = 0;
      mat.transparent = true;
      mat.opacity = 0.4;
      // не зеркало: точечный свет на зеркальной линзе давал крошечный пересвет, который размывалось в пятно
      mat.roughness = Math.max(mat.roughness, 0.35);
      mat.needsUpdate = true;
    }
  });
}

export interface RigOptions {
  fit?: number;
  fitAt?: number[];        // моменты анимации, по которым мерить габарит
  fitIgnore?: string[];    // узлы, которые в габарит не входят
  liteGlass?: boolean;     // стекло без transmission
}

export function buildRig(scene: Object3D, clip: AnimationClip | undefined, opts: RigOptions = {}): Rig {
  const { fit = 2.4, fitAt = [0, 0.35, 0.7, 1], fitIgnore = [] } = opts;
  tameMaterials(scene);
  if (opts.liteGlass) liteGlass(scene);
  const mixer = clip ? new AnimationMixer(scene) : null;
  const action = clip && mixer ? mixer.clipAction(clip) : null;
  const duration = clip ? Math.max(0.001, clip.duration - 0.001) : 1;
  if (action) action.play();
  // Объекты, чей масштаб анимирован: в Блендере «вырастающие» детали стартуют с масштаба 0.
  // Вырожденная матрица даёт NaN в нормалях, а размытие свечения разносит NaN на весь кадр —
  // экран чернеет. Пока деталь почти нулевая, просто не рисуем её.
  const scaled: Object3D[] = [];
  if (clip) {
    const names = new Set(clip.tracks.filter((t) => t.name.endsWith('.scale')).map((t) => t.name.slice(0, -'.scale'.length)));
    scene.traverse((o) => { if (names.has(o.name)) scaled.push(o); });
  }
  const setProgress = (p: number) => {
    if (!action || !mixer) return;
    action.time = Math.min(duration, Math.max(0, p * duration));
    mixer.update(0);
    for (const o of scaled) {
      const m = Math.min(Math.abs(o.scale.x), Math.abs(o.scale.y), Math.abs(o.scale.z));
      o.visible = m > 1e-3;
    }
  };
  // габарит по нескольким моментам прокрутки: разнесённые модели не должны вылезать из кадра
  const box = new Box3();
  const ignored = (o: Object3D | null): boolean => {
    for (let a = o; a; a = a.parent) if (fitIgnore.some((n) => a.name.replace(/_/g, ' ').startsWith(n))) return true;
    return false;
  };
  for (const p of fitAt) {
    setProgress(p);
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      if ((o as Mesh).isMesh && !ignored(o)) box.union(new Box3().setFromObject(o, true));
    });
  }
  setProgress(0);
  const sphere = box.getBoundingSphere(new Sphere());
  const scale = sphere.radius > 0 ? fit / sphere.radius : 1;
  const c = sphere.center.clone().multiplyScalar(-scale);
  return { mixer, action, duration, scale, offset: [c.x, c.y, c.z] as [number, number, number], setProgress };
}

export const ORIGIN = new Vector3();
