// Разбирает значение вида «±2 с», «14 000», «0,002 с», «×3» на префикс, число и хвост,
// чтобы счётчик анимировал только число и сохранял формат.
export interface CountParts { prefix: string; value: number; decimals: number; suffix: string; grouped: boolean }

export function parseCount(raw: string): CountParts | null {
  const m = raw.match(/^([^\d]*?)(\d[\d\s ]*(?:[.,]\d+)?)(.*)$/);
  if (!m) return null;
  const num = m[2].replace(/[\s ]/g, '');
  const dec = num.includes(',') || num.includes('.') ? num.split(/[.,]/)[1].length : 0;
  return { prefix: m[1], value: parseFloat(num.replace(',', '.')), decimals: dec, suffix: m[3], grouped: /\s/.test(m[2].trim()) };
}

export function formatCount(p: CountParts, v: number): string {
  let s = v.toFixed(p.decimals);
  if (p.decimals) s = s.replace('.', ',');
  if (p.grouped) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${p.prefix}${s}${p.suffix}`;
}
