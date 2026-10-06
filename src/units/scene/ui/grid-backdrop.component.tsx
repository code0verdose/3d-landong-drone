import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { gridTexture } from '../lib/grid-texture.util';

/** Сетка как фон сцены: лежит под моделью, а не поверх неё. */
export function GridBackdrop({ bg, fg }: { bg: string; fg: string }) {
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const tex = useMemo(() => gridTexture(size.width, size.height, dpr, bg, fg), [size.width, size.height, dpr, bg, fg]);
  // эффект оправдан: текстура three.js освобождается вручную при пересоздании и размонтировании
  useEffect(() => () => tex.dispose(), [tex]);
  return <primitive object={tex} attach="background" />;
}
