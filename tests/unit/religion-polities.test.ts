import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ReligionPolitiesSchema,
  religionPolitiesAt,
  religionPolityFamilies,
} from '../../lib/religions/polities';

const dataset = ReligionPolitiesSchema.parse(
  JSON.parse(
    readFileSync(new URL('../../public/data/religions/polities.json', import.meta.url), 'utf8'),
  ),
);

const at = (name: string, horizon: number) =>
  religionPolitiesAt(dataset, horizon).get(
    dataset.polities.find((p) => p.name === name)?.entityId ?? '',
  );

describe('published religion-by-polity attribution', () => {
  it('attributes the documented dominant religions', () => {
    expect(at('Ottoman Empire', 1700)?.familyId).toBe('islam');
    expect(at('Russian Empire', 1750)).toMatchObject({
      familyId: 'christianity',
      evidence: 'majority',
      basis: 'editorial',
    });
    const mughal = at('Mughal Empire', 1650);
    expect(mughal?.familyId).toBe('hinduism');
    expect(mughal?.state?.familyId).toBe('islam');
    expect(at('Kingdom of Armenia', -100)?.familyId).toBe('ancient-near-east');
    expect(at('Kingdom of Armenia', 400)?.familyId).toBe('christianity');
    expect(at('Roman Empire', 300)?.familyId).toBe('greco-roman');
    expect(at('Roman Empire', 380)).toMatchObject({ familyId: 'christianity', basis: 'seshat' });
    expect(at('Golden Horde', 1300)).toMatchObject({ familyId: 'tengrism', basis: 'wikidata' });
    expect(at('Golden Horde', 1400)).toMatchObject({ familyId: 'islam', basis: 'editorial' });
  });

  it('filters by family and counts families per evidence at a horizon', () => {
    const islamOnly = religionPolitiesAt(dataset, 1700, 'islam');
    for (const span of islamOnly.values()) expect(span.familyId).toBe('islam');
    const families = religionPolityFamilies(dataset, 1700);
    expect(families.size).toBeGreaterThan(0);
    const christianity = families.get('christianity');
    expect(christianity).toBeDefined();
    expect(
      christianity!.majority + christianity!.predominant + christianity!.state,
    ).toBeGreaterThan(0);
  });
});
