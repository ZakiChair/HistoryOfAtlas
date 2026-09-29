import { z } from '../zod';
import {
  refineThematicDataset,
  thematicMilestoneFields,
  ThematicId,
  ThematicSource,
  ThematicText,
  ThematicTheme,
} from '../thematic/schema';

/** emergence: first documented appearance; outbreak: dated outbreak or wave; eradication: documented end. */
export const EPIDEMIC_KINDS = ['emergence', 'outbreak', 'eradication'] as const;
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
    toll: z.array(Toll).optional(),
  })
  .refine(
    (stage) => stage.endYear === undefined || stage.endYear >= stage.year,
    'An outbreak cannot end before it starts',
  );

export const EpidemicDatasetSchema = z
  .object({
    version: z.literal(1),
    sources: z.array(ThematicSource).min(1),
    diseases: z.array(Disease).min(1),
    milestones: z.array(Milestone).min(1),
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
  });

export type EpidemicDataset = z.infer<typeof EpidemicDatasetSchema>;
export type EpidemicDisease = z.infer<typeof Disease>;
export type EpidemicMilestone = z.infer<typeof Milestone>;
export type EpidemicVector = (typeof EPIDEMIC_VECTORS)[number];
export type EpidemicToll = z.infer<typeof Toll>;
export type EpidemicText = z.infer<typeof ThematicText>;
