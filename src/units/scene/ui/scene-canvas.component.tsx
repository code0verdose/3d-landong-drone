import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import { PerformanceMonitor } from '@react-three/drei';
import { ACESFilmicToneMapping } from 'three';
import type { ShotKey } from '../lib/shots.constant';
import type { ModelConfig } from '../lib/models.config';
import { NightEnv } from './night-env.component';
import { ModelRig } from './model-rig.component';
import { CameraRig } from './camera-rig.component';
import { PauseWhenHidden } from './pause-when-hidden.component';
import { ScrollDriver } from './scroll-driver.component';
import { NightLights } from './night-lights.component';
import { GridBackdrop } from './grid-backdrop.component';

interface Props {
  model: ModelConfig;
  shots: ShotKey[];
  bg: string;
  fg: string;
  className?: string;
}

export function SceneCanvas({ model, shots, bg, fg, className }: Props) {
  // плотность пикселей подстраивается под машину: просели кадры — рисуем чуть грубее, отпустило — обратно
  const [dpr, setDpr] = useState(1.5);
  return (
    <Canvas
      className={className}
      dpr={dpr}
      camera={{ fov: 34, near: 0.1, far: 200, position: [0, 2, 9] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.0;
      }}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} flipflops={3} onFallback={() => setDpr(1)} />
      <GridBackdrop bg={bg} fg={fg} />
      <NightEnv intensity={0.9} />
      <NightLights />
      {/* туман в цвет фона: дальние кварталы растворяются, как в воздухе */}
      <fog attach="fog" args={[bg, 55, 320]} />
      <Suspense fallback={null}>
        <ModelRig model={model} />
      </Suspense>
      <ScrollDriver />
      <PauseWhenHidden />
      <CameraRig shots={shots} />
      <EffectComposer multisampling={2}>
        <Bloom mipmapBlur intensity={0.8} luminanceThreshold={1.05} luminanceSmoothing={0.1} />
        <Noise opacity={0.035} />
        <Vignette offset={0.28} darkness={0.62} />
      </EffectComposer>
    </Canvas>
  );
}
