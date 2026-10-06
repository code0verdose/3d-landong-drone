// Схема данных страницы. Тексты — в landing.content.ts.
export type Shot = 'hero' | 'close' | 'wide' | 'left' | 'right' | 'top' | 'low';
export type Layout = 'split' | 'center' | 'editorial' | 'tech';
export type FontKey = 'oswald' | 'rubik' | 'jetbrains';

export interface LandingSection {
  kicker: string;
  title: string;
  body: string;
  progress: number;
  shot: Shot;
  side: 'left' | 'right' | 'center';
  bullets?: string[];
}

export interface Landing {
  slug: string;
  brand: string;
  product: string;
  theme: {
    bg: string;
    fg: string;
    muted: string;
    accent: string;
    accent2: string;
    display: FontKey;
    body: FontKey;
    layout: Layout;
    mood: 'dark' | 'light';
  };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    cta: string;
    ctaSecondary: string;
  };
  sections: LandingSection[];
  stats: { value: string; label: string }[];
  features: { title: string; text: string }[];
  marquee: string;
  finale: { title: string; text: string; cta: string };
  footer: string;
}
