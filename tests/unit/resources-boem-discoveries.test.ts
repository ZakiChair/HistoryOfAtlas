import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { ResourceKnowledgeSchema, ResourceSiteSchema } from '../../lib/resources/types';
import { normalizeGemSites, type GemRow } from '../../pipeline/resources/normalize';

const contribution = JSON.parse(readFileSync('pipeline/resources/boem-discoveries.json', 'utf8'));
const fields = JSON.parse(
  gunzipSync(readFileSync('pipeline/resources/sources/boem-fields.json.gz')).toString(),
) as { field: string; discoveryYear: number; crudeOilProductionPositive: boolean }[];
const updates = contribution.knowledgeGroups[0].updates as {
  siteId: string;
  knowledge: unknown[];
}[];

describe('BOEM discovered-field contribution', () => {
  it('corrects Mad Dog’s transposed GEM discovery year without changing production', () => {
    const rows = JSON.parse(
      gunzipSync(readFileSync('pipeline/resources/sources/goget.json.gz')).toString(),
    ) as GemRow[];
    const row = rows.find((site) => site.id === 'L100000314393')!;
    const [corrected] = normalizeGemSites([row], 'goget');
    const [withoutCorrection] = normalizeGemSites([{ ...row, id: 'uncorrected-fixture' }], 'goget');
    expect(corrected.knowledge?.[0].fromYear).toBe(1998);
    expect(corrected.knowledge?.[0].sourceUrl).toContain('www.sec.gov');
    expect(corrected.periods).toEqual(withoutCorrection.periods);
  });
  it('retains explicit discovery dates without inventing exploitation periods', () => {
    const ids = new Set<string>();
    for (const value of contribution.sites) {
      const site = ResourceSiteSchema.parse(value);
      const source = fields.find((field) => site.id === `boem:${field.field}`)!;
      expect(ids.has(site.id)).toBe(false);
      ids.add(site.id);
      expect(site.periods).toEqual([]);
      expect(site.knowledge?.[0].fromYear).toBe(source.discoveryYear);
      expect(site.categories.includes('oil')).toBe(source.crudeOilProductionPositive);
      expect(site.coordinates[0]).toBeGreaterThan(-98);
      expect(site.coordinates[0]).toBeLessThan(-80);
      expect(site.coordinates[1]).toBeGreaterThan(18);
      expect(site.coordinates[1]).toBeLessThan(32);
    }
    for (const update of updates) {
      update.knowledge.forEach((knowledge) => ResourceKnowledgeSchema.parse(knowledge));
    }
  });

  it('does not merge a distinct discovery merely because it shares a block code', () => {
    for (const id of [
      'goget:L100000320669', // Tiberius oil 2023, distinct from Hadrian South gas 2008.
      'goget:L100000315324', // Salsa / Conger.
      'goget:L100000315742', // Rigel / Neidermeyer.
      'goget:L100000317955', // Ballymore / East Anstey.
      'goget:L100000319539', // Shenzi North / Shenzi.
      'goget:L100000318900', // Spruance 2019 / older EW921 field-code record.
      'goget:L100000320716', // Mad Dog Southwest phase / parent-field discovery.
    ]) {
      expect(updates.some((update) => update.siteId === id)).toBe(false);
      expect(
        contribution.rejectedMatches.some((match: { siteId: string }) => match.siteId === id),
      ).toBe(true);
    }
    const hadrian = contribution.sites.find((site: { id: string }) => site.id === 'boem:KC964');
    expect(hadrian.categories).toEqual(['gas']);
    expect(hadrian.knowledge[0].fromYear).toBe(2008);
    const olderEw921 = contribution.sites.find((site: { id: string }) => site.id === 'boem:EW921');
    expect(olderEw921.name).toBe('EW921 field');
  });
});
