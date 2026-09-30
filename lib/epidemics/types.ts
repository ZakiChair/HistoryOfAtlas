import { z } from '../zod';
import {
  refineThematicDataset,
  thematicMilestoneFields,
  ThematicCoordinate,
  ThematicId,
  ThematicSource,
  ThematicText,
  ThematicTheme,
} from '../thematic/schema';

/** emergence: first documented appearance; outbreak: dated outbreak or wave; eradication: documented end; control: documented identification or control measure. */
export const EPIDEMIC_KINDS = ['emergence', 'outbreak', 'eradication', 'control'] as const;
/** Documented transmission contexts, stored in the generic `mechanisms` field. */
export const EPIDEMIC_VECTORS = [
  'trade',
  'shipping',
  'war',
  'pilgrimage',
  'migration',
  'colonization',
  'rail',
  'air-travel',
  'water',
  'undocumented',
] as const;

const Disease = ThematicTheme;
/** Schematic halo radii: the map draws a circle of this nominal reach, not a measured extent. */
export const EPIDEMIC_EXTENTS = ['city', 'region', 'country'] as const;
export const EPIDEMIC_EXTENT_KM: Record<EpidemicExtent, number> = {
  city: 150,
  region: 400,
  country: 800,
};
const Toll = z
  .object({
    kind: z.enum(['deaths', 'cases', 'share']),
    value: z.number().nonnegative().optional(),
    min: z.number().nonnegative().optional(),
    max: z.number().nonnegative().optional(),
    scope: ThematicText,
    sourceIds: z.array(ThematicId).min(1),
  })
  .refine(
    (toll) => toll.value !== undefined || toll.min !== undefined || toll.max !== undefined,
    'A toll requires a value or a range',
  )
  .refine(
    (toll) => toll.min === undefined || toll.max === undefined || toll.min <= toll.max,
    'Reversed toll range',
  )
  .refine(
    (toll) =>
      toll.kind !== 'share' ||
      [toll.value, toll.min, toll.max].every((part) => part === undefined || part <= 1),
    'A share cannot exceed 1',
  );
const Milestone = z
  .object({
    ...thematicMilestoneFields({
      kinds: EPIDEMIC_KINDS,
      mechanisms: EPIDEMIC_VECTORS,
      minYear: -3500,
      maxYear: 2026,
    }),
    diseaseId: ThematicId,
    /** Present when the outbreak ended; absent marks an ongoing pandemic or endemic focus. */
    endYear: z.number().int().min(-3500).max(2026).optional(),
    extent: z.enum(EPIDEMIC_EXTENTS),
    toll: z.array(Toll).optional(),
  })
  .refine(
    (stage) => stage.endYear === undefined || stage.endYear >= stage.year,
    'An outbreak cannot end before it starts',
  );

/**
 * The cumulative area a pandemic had reached by the end of `year`: editorial geometry,
 * not epidemiological data. `groupId` ties the dated fronts of one pandemic together.
 */
const Front = z
  .object({
    id: ThematicId,
    diseaseId: ThematicId,
    groupId: ThematicId,
    year: z.number().int().min(-3500).max(2026),
    endYear: z.number().int().min(-3500).max(2026),
    approximate: z.boolean(),
    label: ThematicText,
    ring: z.array(ThematicCoordinate).min(4),
    sourceIds: z.array(ThematicId).min(1),
  })
  .refine((front) => front.endYear >= front.year, 'A front cannot end before it is reached');

export const EpidemicDatasetSchema = z
  .object({
    version: z.literal(1),
    sources: z.array(ThematicSource).min(1),
    diseases: z.array(Disease).min(1),
    milestones: z.array(Milestone).min(1),
    fronts: z.array(Front).optional(),
  })
  .superRefine((data, context) => {
    const issue = (message: string) => context.addIssue({ code: 'custom', message });
    refineThematicDataset(
      { sources: data.sources, themes: data.diseases, milestones: data.milestones },
      {
        themeIdOf: (milestone) => milestone.diseaseId,
        labels: { plural: 'diseases', singular: 'disease' },
        closingKinds: ['eradication'],
        linkOrder: 'notLater',
      },
      issue,
    );
    const sources = new Set(data.sources.map((source) => source.id));
    for (const milestone of data.milestones)
      for (const toll of milestone.toll ?? [])
        for (const sourceId of toll.sourceIds)
          if (!sources.has(sourceId)) issue(`Unknown toll source: ${sourceId}`);
    const fronts = data.fronts ?? [];
    const milestoneIds = new Set(data.milestones.map((milestone) => milestone.id));
    const diseases = new Set(data.diseases.map((disease) => disease.id));
    if (new Set(fronts.map((front) => front.id)).size !== fronts.length)
      issue('Duplicate fronts ID');
    const groups = new Map<string, { diseaseId: string; years: Set<number> }>();
    for (const front of fronts) {
      if (milestoneIds.has(front.id)) issue(`Front id collides with a milestone: ${front.id}`);
      if (!diseases.has(front.diseaseId)) issue(`Unknown disease: ${front.id}`);
      if (front.sourceIds.some((id) => !sources.has(id))) issue(`Unknown source: ${front.id}`);
      const ring = front.ring;
      if (ring[0]![0] !== ring.at(-1)![0] || ring[0]![1] !== ring.at(-1)![1])
        issue(`Unclosed front: ${front.id}`);
      if (new Set(ring.map((point) => point.join(','))).size < 3)
        issue(`Degenerate front: ${front.id}`);
      for (let index = 1; index < ring.length; index += 1)
        if (Math.abs(ring[index]![0] - ring[index - 1]![0]) > 180)
          issue(`Unsplit antimeridian edge: ${front.id}`);
      const group = groups.get(front.groupId) ?? { diseaseId: front.diseaseId, years: new Set() };
      if (group.diseaseId !== front.diseaseId)
        issue(`Mixed diseases in front group: ${front.groupId}`);
      if (group.years.has(front.year)) issue(`Duplicate front year in group: ${front.groupId}`);
      group.years.add(front.year);
      groups.set(front.groupId, group);
    }
  });

export type EpidemicDataset = z.infer<typeof EpidemicDatasetSchema>;
export type EpidemicDisease = z.infer<typeof Disease>;
export type EpidemicMilestone = z.infer<typeof Milestone>;
export type EpidemicVector = (typeof EPIDEMIC_VECTORS)[number];
export type EpidemicToll = z.infer<typeof Toll>;
export type EpidemicFront = z.infer<typeof Front>;
export type EpidemicExtent = (typeof EPIDEMIC_EXTENTS)[number];
export type EpidemicText = z.infer<typeof ThematicText>;
