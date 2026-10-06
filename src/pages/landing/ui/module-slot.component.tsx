import type { LandingExtras, ModuleKind } from '@content/extras.types';
import { SpecTable } from './modules/spec-table.component';
import { TimelineRail } from './modules/timeline-rail.component';
import { Pricing } from './modules/pricing.component';

/** Один модуль страницы по плану; если текста для модуля нет, блок не выводится. */
export function ModuleSlot({ kind, extras, cta }: { kind: ModuleKind | undefined; extras: LandingExtras; cta: string }) {
  switch (kind) {
    case 'spec': return extras.spec ? <SpecTable spec={extras.spec} /> : null;
    case 'timeline': return extras.timeline ? <TimelineRail timeline={extras.timeline} /> : null;
    case 'pricing': return extras.pricing ? <Pricing pricing={extras.pricing} cta={cta} /> : null;
    default: return null;
  }
}
