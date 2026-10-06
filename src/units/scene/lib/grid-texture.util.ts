// Фон сцены с сеткой: рисуется на холсте в размер экрана и ставится как scene.background.
// Так дрон и площадки закрывают сетку собой, а пустой фон сцены её не перекрывает.
import { CanvasTexture, SRGBColorSpace } from 'three';

const CELL = 80;          // шаг сетки в CSS-пикселях
const LINE_ALPHA = 0.06;  // как color-mix(fg 6%) в прежнем CSS-слое

export function gridTexture(width: number, height: number, dpr: number, bg: string, fg: string): CanvasTexture {
  const w = Math.max(1, Math.round(width * dpr));
  const h = Math.max(1, Math.round(height * dpr));
  const lines = document.createElement('canvas');
  lines.width = w;
  lines.height = h;
  const g = lines.getContext('2d')!;
  g.fillStyle = fg;
  g.globalAlpha = LINE_ALPHA;
  const step = CELL * dpr;
  const px = Math.max(1, Math.round(dpr));
  for (let x = 0; x < w; x += step) g.fillRect(Math.round(x), 0, px, h);
  for (let y = 0; y < h; y += step) g.fillRect(0, Math.round(y), w, px);
  // маска-эллипс: сетка видна в центре и растворяется к краям
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'destination-in';
  g.save();
  g.translate(w / 2, h / 2);
  g.scale(w * 0.8, h * 0.7);
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  grd.addColorStop(0.3, 'rgba(0,0,0,1)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(-1, -1, 2, 2);
  g.restore();

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const o = out.getContext('2d')!;
  o.fillStyle = bg;
  o.fillRect(0, 0, w, h);
  o.drawImage(lines, 0, 0);
  const tex = new CanvasTexture(out);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}
