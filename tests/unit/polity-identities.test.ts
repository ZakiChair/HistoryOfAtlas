import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PolityIdentityRegistrySchema,
  polityIdentityRegistry,
  resolvePolityIdentity,
} from '../../lib/polity-identities';

const territory = (id: string, name: string, wikidataId: string) => ({ id, name, wikidataId });

describe('reviewed political identities', () => {
  it('retains sourced translated polity labels during validation', () => {
    const first = polityIdentityRegistry.mappings[0];
    const label = { ...first.label, de: 'Beispiel', es: 'Ejemplo', zh: '示例', ru: 'Пример' };
    const result = PolityIdentityRegistrySchema.parse({
      ...polityIdentityRegistry,
      mappings: [{ ...first, label }],
    });
    expect(result.mappings[0].label).toEqual(label);
  });

  it('requires the exact reviewed map record and its unchanged source identifier', () => {
    expect(
      resolvePolityIdentity(territory('clio-bd4b87bc07eb4c', 'Ottoman Empire', 'Q12560'))
        ?.wikidataId,
    ).toBe('Q12560');
    expect(
      resolvePolityIdentity(territory('clio-bd4b87bc07eb4c', 'Ottoman Empire', 'Q12544')),
    ).toBeNull();
    expect(
      resolvePolityIdentity(territory('clio-bd4b87bc07eb4c', 'Different polity', 'Q12560')),
    ).toBeNull();
  });

  it('does not transfer Byzantine rulers to the earlier Roman Empire sharing its source QID', () => {
    expect(
      resolvePolityIdentity(territory('clio-4cc2aedd5ebff5', 'Roman Empire', 'Q12544')),
    ).toBeNull();
    expect(
      resolvePolityIdentity(territory('clio-7e06fd81c0e059', 'Eastern Roman Empire', 'Q12544'))
        ?.wikidataId,
    ).toBe('Q12544');
  });

  it('rejects the Sasanian-to-Indo-Sassanid source cross-reference', () => {
    expect(
      resolvePolityIdentity(territory('clio-08a805b4e8b60a', 'Sasanian Empire', 'Q1661685')),
    ).toBeNull();
  });

  it('does not infer identities from matching names, valid QIDs or another source', () => {
    expect(
      resolvePolityIdentity(territory('hb-bd4b87bc07eb4c', 'Ottoman Empire', 'Q12560')),
    ).toBeNull();
    expect(
      resolvePolityIdentity(territory('clio-00000000000000', 'Ottoman Empire', 'Q12560')),
    ).toBeNull();
    expect(resolvePolityIdentity({ id: 'clio-bd4b87bc07eb4c', name: 'Ottoman Empire' })).toBeNull();
  });

  it('keeps reviewed mappings synchronized with actual sourced map records', () => {
    const polities: { id: string; name: string; wikidataId: string }[] = JSON.parse(
      readFileSync(new URL('../../public/geo/polities.json', import.meta.url), 'utf8'),
    );
    for (const mapping of polityIdentityRegistry.mappings) {
      const actual = polities.find((item) => item.id === mapping.polityId);
      expect(actual, mapping.polityId).toBeDefined();
      expect(actual?.name).toBe(mapping.sourceName);
      expect(actual?.wikidataId).toBe(mapping.sourceWikidataId);
      expect(mapping.sources.some((source) => source.url.includes('/cliopatria/tree/'))).toBe(true);
      expect(
        mapping.sources.some((source) =>
          source.url.includes(`wikidata.org/wiki/${mapping.sourceWikidataId}`),
        ),
      ).toBe(true);
    }
  });

  it('records the actual Wikidata labels and exact reviewed revision separately from map names', () => {
    const review: {
      items: {
        qid: string;
        revision: number;
        labels: { en: string; fr?: string };
        revisionUrl: string;
      }[];
    } = JSON.parse(
      readFileSync(
        new URL('../../data/reports/polity-identity-review.json', import.meta.url),
        'utf8',
      ),
    );
    for (const mapping of polityIdentityRegistry.mappings) {
      const evidence = review.items.find((item) => item.qid === mapping.wikidataId);
      expect(evidence, mapping.polityId).toBeDefined();
      expect(mapping.label).toEqual(evidence?.labels);
      expect(mapping.wikidataRevision).toBe(evidence?.revision);
      expect(mapping.sources.some((source) => source.url === evidence?.revisionUrl)).toBe(true);
    }
  });

  it('rejects duplicate polity entries and unproven identity reassignment', () => {
    const first = polityIdentityRegistry.mappings.find((item) => item.status === 'verified')!;
    expect(
      PolityIdentityRegistrySchema.safeParse({
        ...polityIdentityRegistry,
        mappings: [first, first],
      }).success,
    ).toBe(false);
    expect(
      PolityIdentityRegistrySchema.safeParse({
        ...polityIdentityRegistry,
        mappings: [{ ...first, wikidataId: 'Q12544' }],
      }).success,
    ).toBe(false);
    expect(
      PolityIdentityRegistrySchema.safeParse({
        ...polityIdentityRegistry,
        mappings: [{ ...first, sources: [] }],
      }).success,
    ).toBe(false);
  });
});
