import { describe, expect, it } from 'vitest';
import { type Entity } from '../../pipeline/normalize';
import {
  BattleInclusionsFileSchema,
  battleCandidateIds,
  reviewedBattleKind,
  verifyBattleInclusion,
} from '../../pipeline/battles/inclusions';
import { BattleRecordSchema } from '../../lib/battles/schema';

const source = { label: 'Naval archive', url: 'https://example.org/tsushima' };
const review = {
  type: 'naval' as const,
  expectedInstanceOf: ['Q876274'],
  note: 'The archive identifies this specific event as a naval battle, not a campaign.',
  sources: [source],
};
const entity = (classes = ['Q876274']): Entity => ({
  id: 'Q208127',
  claims: { P31: classes.map((id) => ({ mainsnak: { datavalue: { value: { id } } } })) },
});
const file = () =>
  BattleInclusionsFileSchema.parse({
    version: 1,
    reviewedAt: '2026-09-21',
    records: { Q208127: review },
  });

describe('source-reviewed catalogue inclusions', () => {
  it('adds only individually reviewed IDs without widening the discovery class', () => {
    expect(battleCandidateIds(['Q1', 'Q2'], file())).toEqual(['Q1', 'Q2', 'Q208127']);
    expect(battleCandidateIds(['Q208127', 'Q2'], file())).toEqual(['Q208127', 'Q2']);
    expect(reviewedBattleKind(entity(), review)).toBe('naval');
    expect(() => battleCandidateIds(['Q1', 'Q1'], file())).toThrow(/duplicate/i);
  });

  it('fails closed when the source classification changes', () => {
    expect(() => reviewedBattleKind(entity(['Q178561']), review)).toThrow(/classification/i);
    expect(() => reviewedBattleKind(entity([]), review)).toThrow(/classification/i);
    expect(() => reviewedBattleKind(entity(['Q876274', 'Q178561']), review)).toThrow(
      /classification/i,
    );
  });

  it('does not bypass fictional, legendary or explicitly excluded events', () => {
    for (const id of ['Q15707521', 'Q26913948', 'Q124042044']) {
      expect(() =>
        reviewedBattleKind(entity([id]), { ...review, expectedInstanceOf: [id] }),
      ).toThrow(/excluded/i);
    }
  });

  it('cannot reclassify a person, war, campaign, conquest or treaty as an engagement', () => {
    for (const id of ['Q5', 'Q198', 'Q831663', 'Q1361229', 'Q625298'])
      expect(() =>
        reviewedBattleKind(entity([id]), { ...review, expectedInstanceOf: [id] }),
      ).toThrow(/incompatible/i);
    const subclasses = new Map([['Q999', new Set(['Q831663'])]]);
    expect(() =>
      reviewedBattleKind(entity(['Q999']), { ...review, expectedInstanceOf: ['Q999'] }, subclasses),
    ).toThrow(/incompatible/i);
  });

  it('requires evidence and forbids mixing metadata or quantities into inclusion reviews', () => {
    for (const patch of [
      { sources: [] },
      { expectedInstanceOf: ['Q876274', 'Q876274'] },
      { type: 'war' },
      { coords: [130, 34] },
      { strength: 38 },
    ]) {
      expect(() =>
        BattleInclusionsFileSchema.parse({
          ...file(),
          records: { Q208127: { ...review, ...patch } },
        }),
      ).toThrow();
    }
  });

  it('verifies published provenance and rejects unregistered or altered inclusions offline', () => {
    const record = BattleRecordSchema.parse({
      id: 'Q208127',
      name: { en: 'Battle of Tsushima' },
      type: 'naval',
      medium: 'naval',
      sources: [source],
      participants: [],
      totals: { strength: [], deaths: [], casualties: [] },
      inclusionReview: { ...review, reviewedAt: file().reviewedAt },
    });
    expect(record.inclusionReview).toBeDefined();
    expect(() => verifyBattleInclusion(record, file())).not.toThrow();
    expect(() => verifyBattleInclusion({ ...record, type: 'battle' }, file())).toThrow();
    expect(() =>
      verifyBattleInclusion(
        { ...record, sources: [{ ...source, url: 'https://example.org/unrelated' }] },
        file(),
      ),
    ).toThrow();
    expect(() =>
      verifyBattleInclusion({ ...record, inclusionReview: undefined }, file()),
    ).toThrow();
    expect(() => verifyBattleInclusion(record, { ...file(), records: {} })).toThrow();
    expect(() =>
      verifyBattleInclusion(
        { ...record, inclusionReview: { ...record.inclusionReview!, note: 'Changed note' } },
        file(),
      ),
    ).toThrow();
  });
});
