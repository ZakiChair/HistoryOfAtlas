import { describe, expect, it } from 'vitest';
import { z } from '../../lib/zod';
import {
  refineThematicDataset,
  thematicMilestoneFields,
  ThematicId,
  ThematicSource,
  ThematicTheme,
} from '../../lib/thematic/schema';

const Milestone = z.object({
  ...thematicMilestoneFields({
    kinds: ['origin', 'spread', 'schism'],
    mechanisms: ['emergence', 'contact'],
    minYear: -3500,
    maxYear: 2026,
  }),
  themeId: ThematicId,
});

const CorpusSchema = z
  .object({
    sources: z.array(ThematicSource).min(1),
    themes: z.array(ThematicTheme).min(1),
    milestones: z.array(Milestone).min(1),
  })
  .superRefine((data, context) =>
    refineThematicDataset(
      { sources: data.sources, themes: data.themes, milestones: data.milestones },
      { themeIdOf: (milestone) => milestone.themeId, crossThemeKinds: ['schism'] },
      (message) => context.addIssue({ code: 'custom', message }),
    ),
  );

type TestMilestone = z.infer<typeof Milestone>;
const text = { fr: 'Texte', en: 'Text' };
const corpus = (): {
  sources: z.infer<typeof ThematicSource>[];
  themes: z.infer<typeof ThematicTheme>[];
  milestones: TestMilestone[];
} => ({
  sources: [{ id: 'source', title: 'Source', url: 'https://example.org' }],
  themes: [
    { id: 'alpha', names: text, description: text, color: '#edb75a', symbol: 'dot' },
    { id: 'beta', names: text, description: text, color: '#9ad5ed', symbol: 'dot' },
  ],
  milestones: [
    {
      id: 'alpha-origin',
      themeId: 'alpha',
      kind: 'origin' as const,
      year: -500,
      approximate: true,
      title: text,
      description: text,
      coordinates: [10, 20] as [number, number],
      mechanisms: ['emergence' as const],
      sourceIds: ['source'],
    },
    {
      id: 'beta-origin',
      themeId: 'beta',
      kind: 'origin' as const,
      year: -400,
      approximate: true,
      title: text,
      description: text,
      coordinates: [20, 30] as [number, number],
      mechanisms: ['emergence' as const],
      sourceIds: ['source'],
    },
  ],
});
const milestone = (overrides: Record<string, unknown>): TestMilestone => ({
  id: 'alpha-spread',
  themeId: 'alpha',
  kind: 'spread' as const,
  year: -300,
  approximate: true,
  title: text,
  description: text,
  coordinates: [30, 40] as [number, number],
  mechanisms: ['contact' as const],
  sourceIds: ['source'],
  ...overrides,
});

const messages = (data: unknown) =>
  CorpusSchema.safeParse(data).error?.issues.map((issue) => issue.message) ?? [];

describe('composed thematic schema', () => {
  it('accepts a valid corpus', () => {
    expect(CorpusSchema.safeParse(corpus()).success).toBe(true);
  });

  it('rejects a spread linked into another theme but accepts a schism', () => {
    const spread = corpus();
    spread.milestones.push(milestone({ fromId: 'beta-origin' }));
    expect(messages(spread)).toContain('Invalid chronological link: alpha-spread');
    const schism = corpus();
    schism.milestones.push(milestone({ kind: 'schism', fromId: 'beta-origin' }));
    expect(CorpusSchema.safeParse(schism).success).toBe(true);
  });

  it('rejects duplicate milestone ids', () => {
    const data = corpus();
    data.milestones.push(milestone({ id: 'alpha-origin' }));
    expect(messages(data)).toContain('Duplicate milestones ID');
  });

  it('uses theme labels by default', () => {
    const data = corpus();
    data.milestones.push(milestone({ id: 'orphan', themeId: 'gamma' }));
    expect(messages(data)).toContain('Unknown theme: orphan');
  });
});
