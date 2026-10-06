// Окружение для отражений ночного города: тёмное небо с тёплым заревом у горизонта, редкие огни
// кварталов по кругу и луна. Студийное окружение на стекле и воде ночью давало белые «лампы».
import {
  BackSide, BoxGeometry, BufferAttribute, Color, Mesh, MeshBasicMaterial, Scene, SphereGeometry,
} from 'three';

export function nightEnvironment(): Scene {
  const scene = new Scene();
  const sky = new SphereGeometry(50, 48, 24);
  const pos = sky.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const zenith = new Color('#05060c');
  const glow = new Color('#2b2231');
  const ground = new Color('#030305');
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / 50;
    if (t >= 0) c.copy(glow).lerp(zenith, Math.min(1, t * 2.2));
    else c.copy(glow).lerp(ground, Math.min(1, -t * 6));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  sky.setAttribute('color', new BufferAttribute(colors, 3));
  scene.add(new Mesh(sky, new MeshBasicMaterial({ vertexColors: true, side: BackSide })));
  // огни кварталов у горизонта — детерминированно, чтобы блики не менялись от захода к заходу
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const warm = new MeshBasicMaterial({ color: new Color('#ffb36b').multiplyScalar(2.2) });
  const cool = new MeshBasicMaterial({ color: new Color('#9fc2ff').multiplyScalar(1.6) });
  const box = new BoxGeometry(1, 1, 1);
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 44 + rnd() * 3;
    const m = new Mesh(box, rnd() < 0.7 ? warm : cool);
    m.position.set(Math.cos(a) * r, rnd() * 5 - 0.5, Math.sin(a) * r);
    m.scale.set(0.3 + rnd() * 1.2, 0.3 + rnd() * 0.8, 0.3 + rnd() * 1.2);
    m.lookAt(0, m.position.y, 0);
    scene.add(m);
  }
  const moon = new Mesh(new SphereGeometry(2, 16, 12), new MeshBasicMaterial({ color: new Color('#d8e0ff').multiplyScalar(2.5) }));
  moon.position.set(-22, 34, -26);
  scene.add(moon);
  return scene;
}
