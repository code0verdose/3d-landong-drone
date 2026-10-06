import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Object3D, type SpotLight } from 'three';
import { cameraStore } from '@shared/lib/camera-store';

/**
 * Свет ночного города вместо студийного: небо и земля, луна, тёплый рабочий свет над стартовой
 * площадкой на крыше. Остальное светят сами фонари, окна и фары — через свечение материалов.
 * Плюс мягкий узкий свет на объект съёмки — как у оператора: дрон не превращается в силуэт,
 * а дальность ограничена, чтобы не заливать город.
 */
export function NightLights() {
  const spot = useRef<SpotLight>(null);
  const aim = useMemo(() => new Object3D(), []);
  useFrame(() => {
    const s = spot.current;
    if (!s) return;
    s.visible = cameraStore.active;
    if (!cameraStore.active) return;
    const dx = cameraStore.sx - cameraStore.cx;
    const dy = cameraStore.sy - cameraStore.cy;
    const dz = cameraStore.sz - cameraStore.cz;
    const d = Math.hypot(dx, dy, dz);
    // чуть выше камеры: свет сверху-спереди лепит форму и даёт блик на корпусе
    s.position.set(cameraStore.cx, cameraStore.cy + d * 0.35, cameraStore.cz);
    aim.position.set(cameraStore.sx, cameraStore.sy, cameraStore.sz);
    aim.updateMatrixWorld();
    s.distance = d * 2.4;
  });
  return (
    <>
      <hemisphereLight args={['#243150', '#050508', 0.55]} />
      <directionalLight position={[-30, 45, -20]} intensity={0.55} color="#aebfff" />
      <pointLight position={[2.5, 3.6, 3]} intensity={14} distance={14} decay={2} color="#ffd9a8" />
      <spotLight ref={spot} target={aim} angle={0.2} penumbra={0.8} intensity={150} decay={2} color="#e6ecff" />
      <primitive object={aim} />
    </>
  );
}
