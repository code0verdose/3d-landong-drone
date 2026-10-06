import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, type PerspectiveCamera } from 'three';
import { scrollStore } from '@shared/lib/scroll-store';
import { cameraStore } from '@shared/lib/camera-store';
import { damp, lerp, smooth } from '@shared/lib/math.util';
import { SHOTS, type ShotKey } from '../lib/shots.constant';

const UP = new Vector3(0, 1, 0);
const pos = new Vector3();
const target = new Vector3();
const fwd = new Vector3();
const right = new Vector3();
const RAD = Math.PI / 180;
const subj = new Vector3();

/**
 * Камера идёт между ракурсами соседних блоков страницы, модель уходит от текста вбок,
 * указатель мыши добавляет лёгкий параллакс. Всё сглажено, поэтому рывки колеса не видны.
 */
export function CameraRig({ shots }: { shots: ShotKey[] }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const cur = useRef({ az: SHOTS.hero.az, el: SHOTS.hero.el, dist: SHOTS.hero.dist, ty: 0, off: 0, dim: 0, px: 0, py: 0, lift: 0 });

  const authored = useRef(false);
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = scrollStore;
    const persp = camera as PerspectiveCamera;
    const c = cur.current;
    c.px = damp(c.px, state.pointer.x * 5, 2, dt);
    c.py = damp(c.py, state.pointer.y * 2.5, 2, dt);
    c.dim = damp(c.dim, s.dim, 3, dt);
    if (cameraStore.active) {
      // Камера задана в сцене: ракурсы секций подобраны в Блендере под десктоп, с местом под карточку текста.
      // Большой мир — дальняя плоскость дальше, ближняя чуть больше (точнее глубина на расстоянии).
      if (!authored.current) {
        persp.near = 0.2;
        persp.far = 2500;
        persp.updateProjectionMatrix();
        authored.current = true;
      }
      pos.set(cameraStore.cx, cameraStore.cy, cameraStore.cz);
      target.set(cameraStore.tx, cameraStore.ty, cameraStore.tz);
      if (size.width < 820) {
        // узкий экран: текст внизу — дрон по центру по горизонтали и в верхней половине, камера дальше
        subj.set(cameraStore.sx, cameraStore.sy, cameraStore.sz);
        fwd.subVectors(pos, target).normalize();
        const d = pos.distanceTo(subj) * 1.45;
        target.copy(subj);
        pos.copy(subj).addScaledVector(fwd, d);
        target.y -= Math.tan((persp.fov / 2) * RAD) * d * 0.62;
      }
      // лёгкий параллакс от указателя — пропорционально дистанции, чтобы ощущался одинаково
      fwd.subVectors(target, pos);
      const dist = fwd.length();
      fwd.normalize();
      right.crossVectors(fwd, UP).normalize();
      pos.addScaledVector(right, c.px * dist * 0.004);
      pos.y += c.py * dist * 0.004;
      camera.position.copy(pos);
      camera.lookAt(target);
      gl.domElement.style.opacity = String(1 - c.dim * 0.62);
      const wrapEl = gl.domElement.parentElement;
      if (wrapEl) wrapEl.style.opacity = String(1 - s.hide);
      return;
    }
    if (authored.current) {
      persp.near = 0.1;
      persp.far = 200;
      persp.updateProjectionMatrix();
      authored.current = false;
    }
    const a = SHOTS[shots[s.shotA] ?? 'hero'];
    const b = SHOTS[shots[s.shotB] ?? 'hero'];
    const t = smooth(s.blend);
    const narrow = size.width < 820;
    // Ракурс, сдвиг от текста и слежение считаются прямо от позиции скролла, без собственного
    // сглаживания: прокрутку уже сглаживает Lenis. Раньше каждое значение догоняло своё со своей
    // скоростью, и при быстром скролле они расходились — модель заезжала под карточку.
    // Теперь кадр — функция позиции страницы и не зависит от скорости прокрутки.
    c.az = lerp(a.az, b.az, t);
    c.el = lerp(a.el, b.el, t);
    // на телефоне текст внизу экрана, поэтому модель поднимается в верхнюю часть и отъезжает
    c.dist = lerp(a.dist, b.dist, t) * (narrow ? 1.6 : 1) * s.zoom;
    c.lift = narrow ? -1.7 : s.lift;
    c.ty = lerp(a.ty, b.ty, t);
    c.off = narrow ? 0 : s.offset * (size.width / size.height > 1.6 ? 2.0 : 1.55);

    const az = (c.az + c.px) * RAD;
    const el = (c.el + c.py) * RAD;
    pos.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(c.dist);
    pos.y += c.ty;
    // lift поднимает точку взгляда — модель опускается в нижнюю часть кадра
    pos.y += c.lift;
    target.set(0, c.ty + c.lift, 0);
    fwd.subVectors(target, pos).normalize();
    right.crossVectors(fwd, UP).normalize();
    // модель справа от текста = камера смотрит левее модели
    right.multiplyScalar(-c.off);
    pos.add(right);
    target.add(right);
    camera.position.copy(pos);
    camera.lookAt(target);
    gl.domElement.style.opacity = String(1 - c.dim * 0.62);
    // скрытие после истории — без сглаживания и без CSS-перехода у canvas: сцена гаснет ровно в такт скроллу,
    // иначе она догоняет с опозданием и проступает под следующим блоком
    const wrap = gl.domElement.parentElement;
    if (wrap) wrap.style.opacity = String(1 - s.hide);
  });
  return null;
}
