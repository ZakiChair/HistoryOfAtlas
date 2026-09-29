import { z } from '../zod';
import {
  refineThematicDataset,
  thematicMilestoneFields,
  ThematicId,
  ThematicSource,
  ThematicText,
  ThematicTheme,
} from '../thematic/schema';

export const RELIGION_KINDS = ['origin', 'spread', 'schism', 'contraction'] as const;
export const RELIGION_MECHANISMS = [
  'emergence',
  'trade',
  'mission',
  'migration',
  'patronage',
  'conquest',
  'diaspora',
  'reform',
  'persecution',
  'division',
] as const;

const Tradition = ThematicTheme;
const Milestone = z.object({
  ...thematicMilestoneFields({
    kinds: RELIGION_KINDS,
    mechanisms: RELIGION_MECHANISMS,
    minYear: -3500,
    maxYear: 2026,
  }),
  traditionId: ThematicId,
});

export const ReligionDatasetSchema = z
  .object({
    version: z.literal(1),
    sources: z.array(ThematicSource).min(1),
    traditions: z.array(Tradition).min(1),
    milestones: z.array(Milestone).min(1),
  })
  .superRefine((data, context) =>
    refineThematicDataset(
      { sources: data.sources, themes: data.traditions, milestones: data.milestones },
      {
        themeIdOf: (milestone) => milestone.traditionId,
        labels: { plural: 'traditions', singular: 'tradition' },
        closingKinds: ['contraction'],
      },
      (message) => context.addIssue({ code: 'custom', message }),
    ),
  );

export type ReligionDataset = z.infer<typeof ReligionDatasetSchema>;
export type ReligionTradition = z.infer<typeof Tradition>;
export type ReligionMilestone = z.infer<typeof Milestone>;
export type ReligionMechanism = ReligionMilestone['mechanisms'][number];
export type ReligionText = z.infer<typeof ThematicText>;
