import { z } from 'zod';
import registry from '@/data/curated/polity-identities.json';

const Qid = z.string().regex(/^Q[1-9]\d*$/);
const IdentitySchema = z
  .object({
    polityId: z.string().regex(/^clio-[a-f0-9]+$/),
    sourceName: z.string().min(1),
    sourceWikidataId: Qid,
    wikidataId: Qid,
    status: z.enum(['verified', 'ambiguous']),
    label: z.object({ en: z.string().min(1), fr: z.string().min(1).optional() }),
    wikidataRevision: z.number().int().positive(),
    wikidataDescription: z.object({ en: z.string().optional(), fr: z.string().optional() }),
    reason: z.string().min(1),
    sources: z
      .array(z.object({ label: z.string().min(1), url: z.string().url().startsWith('https://') }))
      .min(2),
  })
  .superRefine((mapping, context) => {
    if (mapping.wikidataId !== mapping.sourceWikidataId)
      context.addIssue({
        code: 'custom',
        message: 'A reviewed cross-reference cannot silently replace the source QID.',
      });
  });

export const PolityIdentityRegistrySchema = z
  .object({
    version: z.literal(1),
    reviewedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    policy: z.string().min(1),
    mappings: z.array(IdentitySchema),
  })
  .superRefine((value, context) => {
    const ids = new Set<string>();
    for (const mapping of value.mappings) {
      if (ids.has(mapping.polityId))
        context.addIssue({
          code: 'custom',
          message: `Duplicate political identity: ${mapping.polityId}`,
        });
      ids.add(mapping.polityId);
    }
  });

export const polityIdentityRegistry = PolityIdentityRegistrySchema.parse(registry);
export type PolityIdentity = z.infer<typeof IdentitySchema>;
const byPolity = new Map(
  polityIdentityRegistry.mappings.map((mapping) => [mapping.polityId, mapping]),
);

/** Source cross-references are assertions to review, not universal identity joins. */
export function resolvePolityIdentity(polity: {
  id: string;
  name: string;
  wikidataId?: string;
}): PolityIdentity | null {
  const mapping = byPolity.get(polity.id);
  if (
    !mapping ||
    mapping.status !== 'verified' ||
    mapping.sourceName !== polity.name ||
    mapping.sourceWikidataId !== polity.wikidataId
  )
    return null;
  return mapping;
}
