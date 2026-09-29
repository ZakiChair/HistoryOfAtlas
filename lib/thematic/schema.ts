import { z } from '../zod';

export const ThematicId = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
export const ThematicText = z.object({ fr: z.string().min(1), en: z.string().min(1) });
export const ThematicColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const ThematicCoordinate = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-85).max(85),
]);
export const ThematicSource = z.object({
  id: ThematicId,
  title: z.string().min(1),
  url: z.url().startsWith('https://'),
});
export const ThematicTheme = z.object({
  id: ThematicId,
  names: ThematicText,
  description: ThematicText,
  color: ThematicColor,
  symbol: ThematicId,
});
export const ThematicArea = z.object({
  label: ThematicText,
  ring: z.array(ThematicCoordinate).min(4),
});

/** Fields every milestone corpus shares; a layer adds its theme reference (e.g. `traditionId`). */
export function thematicMilestoneFields<K extends string, M extends string>(options: {
  kinds: readonly [K, ...K[]];
  mechanisms: readonly [M, ...M[]];
  minYear: number;
  maxYear: number;
}) {
  return {
    id: ThematicId,
    kind: z.enum(options.kinds),
    year: z.number().int().min(options.minYear).max(options.maxYear),
    approximate: z.boolean(),
    title: ThematicText,
    description: ThematicText,
    coordinates: ThematicCoordinate,
    mechanisms: z.array(z.enum(options.mechanisms)).min(1),
    sourceIds: z.array(ThematicId).min(1),
    fromId: ThematicId.optional(),
    closesId: ThematicId.optional(),
    area: ThematicArea.optional(),
  };
}

export interface ThematicRefinementOptions<M> {
  themeIdOf: (milestone: M) => string;
  /** Message labels, e.g. { plural: 'traditions', singular: 'tradition' }; default themes/theme. */
  labels?: { plural: string; singular: string };
  /** Kinds whose `fromId` may point into another theme (e.g. a schism); none by default. */
  crossThemeKinds?: readonly string[];
  /** Kinds allowed to carry `closesId` (e.g. a contraction); none by default. */
  closingKinds?: readonly string[];
}

export function refineThematicDataset<
  M extends {
    id: string;
    kind: string;
    year: number;
    sourceIds: string[];
    fromId?: string;
    closesId?: string;
    area?: { ring: [number, number][] };
  },
>(
  data: { sources: { id: string }[]; themes: { id: string }[]; milestones: M[] },
  options: ThematicRefinementOptions<M>,
  issue: (message: string) => void,
): void {
  const labels = options.labels ?? { plural: 'themes', singular: 'theme' };
  if (new Set(data.sources.map((item) => item.id)).size !== data.sources.length)
    issue('Duplicate sources ID');
  if (new Set(data.themes.map((item) => item.id)).size !== data.themes.length)
    issue(`Duplicate ${labels.plural} ID`);
  if (new Set(data.milestones.map((item) => item.id)).size !== data.milestones.length)
    issue('Duplicate milestones ID');
  const themes = new Set(data.themes.map((item) => item.id));
  const sources = new Set(data.sources.map((item) => item.id));
  const stages = new Map(data.milestones.map((item) => [item.id, item]));
  for (const stage of data.milestones) {
    if (!themes.has(options.themeIdOf(stage))) issue(`Unknown ${labels.singular}: ${stage.id}`);
    if (stage.sourceIds.some((id) => !sources.has(id))) issue(`Unknown source: ${stage.id}`);
    if (stage.fromId) {
      const from = stages.get(stage.fromId);
      if (
        !from ||
        from.id === stage.id ||
        (!options.crossThemeKinds?.includes(stage.kind) &&
          options.themeIdOf(from) !== options.themeIdOf(stage)) ||
        from.year >= stage.year
      )
        issue(`Invalid chronological link: ${stage.id}`);
    }
    if (stage.closesId) {
      const target = stages.get(stage.closesId);
      if (
        !options.closingKinds?.includes(stage.kind) ||
        !target ||
        target.id === stage.id ||
        options.themeIdOf(target) !== options.themeIdOf(stage) ||
        target.year >= stage.year ||
        options.closingKinds?.includes(target.kind)
      )
        issue(`Invalid closure: ${stage.id}`);
    }
    if (stage.area) {
      const ring = stage.area.ring;
      if (ring[0][0] !== ring.at(-1)![0] || ring[0][1] !== ring.at(-1)![1])
        issue(`Unclosed area: ${stage.id}`);
      if (new Set(ring.map((point) => point.join(','))).size < 3)
        issue(`Degenerate area: ${stage.id}`);
    }
  }
}
