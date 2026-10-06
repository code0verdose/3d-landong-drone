import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type { Group } from 'three';
import { scrollStore } from '@shared/lib/scroll-store';
import { sceneReady } from '@shared/lib/scene-ready.store';
import type { ModelConfig } from '../lib/models.config';
import { createWarmup } from '../lib/warmup.util';
import { buildRig } from '../lib/build-rig.util';
import { createSpecial, type SpecialHandle } from '../lib/specials.util';

/**
 * Модель из Блендера: анимация 1..240 кадров двигается прокруткой, поверх неё — приём дрона
 * (винты, покачивание, камера сцены, свет). Сцена считается готовой после нескольких кадров
 * модели — к этому моменту шейдеры собраны и загрузчик можно убирать без вспышки.
 */
export function ModelRig({ model: cfg }: { model: ModelConfig }) {
  const gltf = useGLTF(`/models/${cfg.file}.glb`, '/draco/');
  const rig = useMemo(() => buildRig(gltf.scene, gltf.animations[0], cfg), [gltf, cfg]);
  const root = gltf.scene as unknown as Group;
  const sp = useRef<SpecialHandle | null>(null);
  const frames = useRef(0);
  // эффект оправдан: приём создаёт и освобождает объекты three.js, готовность — внешнее хранилище
  useEffect(() => {
    frames.current = 0;
    sceneReady.set(false);
    // приём создаётся от позы начала анимации, а не от текущего кадра
    rig.setProgress(0);
    sp.current = createSpecial(cfg.special, root);
    return () => {
      sp.current?.dispose();
      sp.current = null;
    };
  }, [cfg.special, root, rig]);
  // прогрев ждёт приём: он добавляет свет и пятна, шейдеры нужны уже с ними
  const warm = useMemo(() => createWarmup(gltf.scene, () => !cfg.special || sp.current !== null), [gltf, rig, cfg.special]);
  // приоритет −1: после пересчёта прокрутки (−2) и до камеры (0) — камера видит позу этого же кадра
  useFrame((state) => {
    warm.before();
    if (++frames.current === 4) sceneReady.set(true);
    rig.setProgress(scrollStore.progress);
    sp.current?.update(scrollStore.progress, state.clock.elapsedTime);
    warm.after();
  }, -1);
  return (
    <group scale={rig.scale} position={rig.offset}>
      <primitive object={gltf.scene} />
    </group>
  );
}
