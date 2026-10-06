import { useMemo, useRef, type CSSProperties } from 'react';
import type { Landing } from '@content/landing.types';
import { plan } from '@content/page-plan';
import { extras } from '@content/extras.content';
import { Cursor } from '@shared/ui/cursor.component';
import { SceneCanvas, MODEL } from '@units/scene';
import { FONT_FAMILY } from '@shared/lib/fonts.constant';
import { buildKeyframes } from './lib/keyframes.util';
import { useLandingScroll } from './hooks/use-landing-scroll.hook';
import { useReveal } from './hooks/use-reveal.hook';
import { LandingNav } from './ui/landing-nav.component';
import { Hero } from './ui/hero.component';
import { StorySection } from './ui/story-section.component';
import { StatsBand } from './ui/stats-band.component';
import { Marquee } from './ui/marquee.component';
import { FeaturesGrid } from './ui/features-grid.component';
import { Finale } from './ui/finale.component';
import { ScrollMeter } from './ui/scroll-meter.component';
import { SceneLoader } from './ui/scene-loader.component';
import { ModuleSlot } from './ui/module-slot.component';
import { Manifesto } from './ui/modules/manifesto.component';
import styles from './page.module.css';

export function LandingPage({ landing }: { landing: Landing }) {
  const root = useRef<HTMLDivElement>(null);
  const keys = useMemo(() => buildKeyframes(landing, plan), [landing]);
  const shots = useMemo(() => keys.map((k) => k.shot), [keys]);
  const t = landing.theme;
  const vars = {
    '--bg': t.bg, '--fg': t.fg, '--muted': t.muted, '--accent': t.accent, '--accent2': t.accent2,
    '--display': FONT_FAMILY[t.display], '--body': FONT_FAMILY[t.body], '--mono': FONT_FAMILY.jetbrains,
  } as CSSProperties;
  useLandingScroll(root, keys, {
    hideAfterStory: plan.hideAfterStory,
    finaleAnchor: plan.outro !== undefined ? landing.sections.length : undefined,
    snap: plan.snap,
  });
  useReveal(root, landing.slug);

  return (
    <div ref={root} className={styles.page} style={vars} data-layout={t.layout} data-mood={t.mood}>
      <div className={styles.stage}>
        <SceneCanvas model={MODEL} shots={shots} bg={t.bg} fg={t.fg} />
      </div>
      <div className={styles.grain} aria-hidden />
      <LandingNav brand={landing.brand} cta={landing.hero.cta} />
      <ScrollMeter count={keys.length} />
      <main className={styles.main}>
        <Hero hero={landing.hero} product={landing.product} variant={plan.hero} pin={plan.intro !== undefined} />
        <div id="story">
          {landing.sections.map((s, i) => (
            <StorySection key={s.title} section={s} index={i} total={landing.sections.length}
              long={plan.outro !== undefined && i === landing.sections.length - 1} />
          ))}
        </div>
        <Manifesto text={extras.manifesto} brand={landing.brand} />
        <ModuleSlot kind={plan.modules[0]} extras={extras} cta={landing.hero.cta} />
        <StatsBand stats={landing.stats} anchor={landing.sections.length + 1} invert={plan.invertStats} />
        <Marquee text={landing.marquee} />
        <ModuleSlot kind={plan.modules[1]} extras={extras} cta={landing.hero.cta} />
        <FeaturesGrid features={landing.features} brand={landing.brand} variant={plan.features} />
        <ModuleSlot kind={plan.modules[2]} extras={extras} cta={landing.hero.cta} />
        <Finale finale={landing.finale} footer={landing.footer} brand={landing.brand} />
      </main>
      <SceneLoader brand={landing.brand} />
      <Cursor />
    </div>
  );
}
