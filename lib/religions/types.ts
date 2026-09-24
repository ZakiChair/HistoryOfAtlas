import { z } from 'zod';

const Id = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const Text = z.object({ fr: z.string().min(1), en: z.string().min(1) });
const Coordinate = z.tuple([z.number().min(-180).max(180), z.number().min(-85).max(85)]);
const Source = z.object({ id: Id, title: z.string().min(1), url: z.url().startsWith('https://') });
const Tradition = z.object({
  id: Id,
  names: Text,
  description: Text,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  symbol: Id,
});
const Milestone = z.object({
  id: Id,
  traditionId: Id,
  kind: z.enum(['origin', 'spread']),
  year: z.number().int().min(-3500).max(2026),
  approximate: z.boolean(),
  title: Text,
  description: Text,
  coordinates: Coordinate,
  mechanisms: z
    .array(
      z.enum([
        'emergence',
        'trade',
        'mission',
        'migration',
        'patronage',
        'conquest',
        'diaspora',
        'reform',
      ]),
    )
    .min(1),
  sourceIds: z.array(Id).min(1),
  fromId: Id.optional(),
  area: z.object({ label: Text, ring: z.array(Coordinate).min(4) }).optional(),
});

export const ReligionDatasetSchema = z
  .object({
    version: z.literal(1),
    sources: z.array(Source).min(1),
    traditions: z.array(Tradition).min(1),
    milestones: z.array(Milestone).min(1),
  })
  .superRefine((data, context) => {
    const issue = (message: string) => context.addIssue({ code: 'custom', message });
    for (const key of ['sources', 'traditions', 'milestones'] as const) {
      if (new Set(data[key].map((item) => item.id)).size !== data[key].length)
        issue(`Duplicate ${key} ID`);
    }
    const traditions = new Set(data.traditions.map((item) => item.id));
    const sources = new Set(data.sources.map((item) => item.id));
    const stages = new Map(data.milestones.map((item) => [item.id, item]));
    for (const stage of data.milestones) {
      if (!traditions.has(stage.traditionId)) issue(`Unknown tradition: ${stage.id}`);
      if (stage.sourceIds.some((id) => !sources.has(id))) issue(`Unknown source: ${stage.id}`);
      if (stage.fromId) {
        const from = stages.get(stage.fromId);
        if (
          !from ||
          from.id === stage.id ||
          from.traditionId !== stage.traditionId ||
          from.year >= stage.year
        )
          issue(`Invalid chronological link: ${stage.id}`);
      }
      if (stage.area) {
        const ring = stage.area.ring;
        if (ring[0][0] !== ring.at(-1)![0] || ring[0][1] !== ring.at(-1)![1])
          issue(`Unclosed area: ${stage.id}`);
        if (new Set(ring.map((point) => point.join(','))).size < 3)
          issue(`Degenerate area: ${stage.id}`);
      }
    }
  });

export type ReligionDataset = z.infer<typeof ReligionDatasetSchema>;
export type ReligionTradition = z.infer<typeof Tradition>;
export type ReligionMilestone = z.infer<typeof Milestone>;
export type ReligionMechanism = ReligionMilestone['mechanisms'][number];
export type ReligionText = z.infer<typeof Text>;
