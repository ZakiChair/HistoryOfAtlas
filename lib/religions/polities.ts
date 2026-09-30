import { z } from '../zod';

const Id = z.string().trim().min(1);
const Text = z.object({ fr: z.string().min(1), en: z.string().min(1) });
const Year = z.number().int().safe();
const SafeUrl = z.url().refine((value) => {
  const url = new URL(value);
  return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
}, 'Expected a public HTTP(S) source');

const EVIDENCE = ['majority', 'predominant', 'state'] as const;
const OTHER_EVIDENCE = ['majority', 'substantial', 'presence'] as const;
const BASIS = ['seshat', 'wikidata', 'editorial'] as const;

const Family = z.object({
  id: Id,
  names: Text,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  symbol: Id,
  kind: z.enum(['religion', 'unaffiliated', 'aggregate']),
});
const FamilyLabel = z.object({ familyId: Id, label: Text });
const Span = z
  .object({
    from: Year,
    to: Year,
    familyId: Id,
    evidence: z.enum(EVIDENCE),
    basis: z.enum(BASIS),
    label: Text,
    note: Text.optional(),
    links: z.array(z.object({ label: z.string().min(1), url: SafeUrl })).optional(),
    sourceIds: z.array(Id).min(1),
    others: z
      .array(FamilyLabel.extend({ evidence: z.enum(OTHER_EVIDENCE) }))
      .max(6)
      .optional(),
    state: FamilyLabel.optional(),
    ambiguous: z.boolean().optional(),
    alternatives: z.array(FamilyLabel).optional(),
  })
  .refine((span) => span.from <= span.to, 'Reversed interval');
const Polity = z.object({
  entityId: Id,
  name: z.string().min(1),
  wikidataId: z
    .string()
    .regex(/^Q[1-9][0-9]*$/)
    .optional(),
  spans: z.array(Span),
  secular: z
    .array(z.object({ from: Year, to: Year, label: Text }).refine((s) => s.from <= s.to))
    .optional(),
  /** Colonial aggregates carry no attribution at all — the bilingual reason is shown instead. */
  excluded: Text.optional(),
  /** Every usable P140 statement, clipped to the family/item minimum year — display only. */
  wikidata: z
    .array(
      z
        .object({
          item: z.string().regex(/^Q[1-9][0-9]*$/),
          label: Text,
          familyId: Id.optional(),
          from: Year.optional(),
          to: Year.optional(),
        })
        .refine((s) => s.from === undefined || s.to === undefined || s.from <= s.to),
    )
    .optional(),
});
const Source = z.object({
  id: Id,
  title: z.string().min(1),
  url: SafeUrl,
  license: z.string().min(1),
  licenseUrl: SafeUrl.optional(),
});

export const ReligionPolitiesSchema = z
  .object({
    version: z.literal(1),
    acquiredAt: z.string(),
    reviewedAt: z.string(),
    families: z.array(Family).min(1),
    evidence: z.object({
      majority: Text,
      predominant: Text,
      state: Text,
    }),
    sources: z.array(Source).min(1),
    polities: z.array(Polity),
  })
  .superRefine((data, context) => {
    const issue = (message: string) => context.addIssue({ code: 'custom', message });
    const families = new Set(data.families.map((family) => family.id));
    if (families.size !== data.families.length) issue('Duplicate families ID');
    const sources = new Set(data.sources.map((source) => source.id));
    for (const polity of data.polities) {
      let previousTo = -Infinity;
      for (const span of polity.spans) {
        if (!families.has(span.familyId)) issue(`Unknown family: ${polity.name}`);
        if (span.state && !families.has(span.state.familyId))
          issue(`Unknown state family: ${polity.name}`);
        for (const other of span.others ?? [])
          if (!families.has(other.familyId)) issue(`Unknown other family: ${polity.name}`);
        for (const alternative of span.alternatives ?? [])
          if (!families.has(alternative.familyId))
            issue(`Unknown alternative family: ${polity.name}`);
        if (span.from < previousTo) issue(`Unsorted or overlapping spans: ${polity.name}`);
        previousTo = span.to;
        for (const sourceId of span.sourceIds)
          if (!sources.has(sourceId)) issue(`Unknown source: ${polity.name}`);
      }
    }
  });

export type ReligionPolityDataset = z.infer<typeof ReligionPolitiesSchema>;
export type ReligionPolitySpan = z.infer<typeof Span>;
export type ReligionPolity = z.infer<typeof Polity>;
export type ReligionPolityEvidence = (typeof EVIDENCE)[number];

/** The attributed span of each entity at `horizon`, optionally limited to one family. */
export function religionPolitiesAt(
  dataset: ReligionPolityDataset,
  horizon: number,
  family: string | null = null,
): Map<string, ReligionPolitySpan & { entityId: string; name: string }> {
  const found = new Map<string, ReligionPolitySpan & { entityId: string; name: string }>();
  for (const polity of dataset.polities) {
    const span = polity.spans.find(
      (item) => item.from <= horizon && horizon <= item.to && (!family || item.familyId === family),
    );
    if (span) found.set(polity.entityId, { ...span, entityId: polity.entityId, name: polity.name });
  }
  return found;
}

/** Families drawn at `horizon` with their span counts per evidence, busiest first. */
export function religionPolityFamilies(dataset: ReligionPolityDataset, horizon: number) {
  const counts = new Map<string, Record<ReligionPolityEvidence, number>>();
  for (const span of religionPolitiesAt(dataset, horizon).values()) {
    const entry = counts.get(span.familyId) ?? { majority: 0, predominant: 0, state: 0 };
    entry[span.evidence] += 1;
    counts.set(span.familyId, entry);
  }
  return new Map(
    [...counts.entries()].sort(
      (a, b) =>
        b[1].majority +
        b[1].predominant +
        b[1].state -
        (a[1].majority + a[1].predominant + a[1].state),
    ),
  );
}
