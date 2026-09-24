import { describe, expect, it, vi } from 'vitest';
import type { FeatureCollection, Polygon } from 'geojson';
import { BattleRecordSchema } from '../../lib/battles/schema';
import { applyBattleMetadata, BattleMetadataFileSchema } from '../../pipeline/battles/metadata';

const source = { label: 'Reviewed archive', url: 'https://example.org/archive' };
const land: FeatureCollection<Polygon> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [10, 45],
            [15, 45],
            [15, 55],
            [10, 55],
            [10, 45],
          ],
        ],
      },
    },
  ],
};
const fixture = () =>
  BattleRecordSchema.parse({
    id: 'Q1',
    name: { en: 'Reviewed siege' },
    type: 'siege',
    medium: 'land',
    end: { year: 1659, month: 4 },
    sources: [source],
    participants: [],
    totals: { strength: [], deaths: [], casualties: [] },
    note: 'Existing evidence.',
    missing: ['missing-date', 'land-event-in-open-ocean', 'unresolved-participant'],
  });
const patch = () => ({
  expected: { start: null, end: { year: 1659, month: 4 }, coords: null },
  start: { year: 1658 },
  coords: [12, 50] as [number, number],
  note: 'Documented siege year and battlefield landmark.',
  sources: [source],
  coordinateBasis: 'Official GPS of the documented battlefield chapel, not troop positions.',
  coordinateSourceUrl: source.url,
});

describe('reviewed battle metadata', () => {
  it('recovers a mapped battle at the documented precision and preserves unrelated evidence', () => {
    const battle = fixture();
    const before = structuredClone(battle);
    applyBattleMetadata(battle, patch(), '2026-09-21', land);
    expect(battle.start).toEqual({ year: 1658 });
    expect(battle.end).toEqual(before.end);
    expect(battle.coords).toEqual([12, 50]);
    expect(battle.era).toBe('early-modern');
    expect(battle.region).toBe('europe');
    expect(battle.missing).toEqual(['unresolved-participant']);
    expect(battle.totals).toEqual(before.totals);
    expect(battle.participants).toEqual(before.participants);
    expect(battle.note).toContain(before.note);
    expect(battle.sources).toEqual([source]);
    expect(battle.metadataReview).toEqual({
      reviewedAt: '2026-09-21',
      fields: ['start', 'coords'],
      before: patch().expected,
      note: patch().note,
      coordinateBasis: patch().coordinateBasis,
      sources: [source],
    });
    expect(battle.coordinateSource).toEqual({
      kind: 'reviewed',
      entityId: 'Q1',
      label: source.label,
      url: source.url,
    });
    expect(BattleRecordSchema.parse(battle).metadataReview).toBeDefined();
  });

  it('uses a record review date without changing the file default or unrelated provenance', () => {
    const file = BattleMetadataFileSchema.parse({
      version: 1,
      reviewedAt: '2026-09-22',
      records: { Q1: { ...patch(), reviewedAt: '2026-09-23' } },
    });
    const legacy = fixture();
    applyBattleMetadata(legacy, patch(), file.reviewedAt, land);
    const battle = fixture();
    applyBattleMetadata(battle, file.records.Q1, file.reviewedAt, land);
    expect(file.reviewedAt).toBe('2026-09-22');
    expect(legacy.metadataReview?.reviewedAt).toBe('2026-09-22');
    expect(battle.metadataReview?.reviewedAt).toBe('2026-09-23');
    expect(JSON.stringify(battle)).toBe(
      JSON.stringify({
        ...legacy,
        metadataReview: { ...legacy.metadataReview, reviewedAt: '2026-09-23' },
      }),
    );
  });

  it.each(['2026-02-29', '2026-09-31', '2026-13-01', '23/09/2026', '2026-09-23T00:00:00Z', ''])(
    'rejects invalid record review date %j without mutating the battle',
    (reviewedAt) => {
      const input = { ...patch(), reviewedAt };
      expect(
        BattleMetadataFileSchema.safeParse({
          version: 1,
          reviewedAt: '2026-09-22',
          records: { Q1: input },
        }).success,
      ).toBe(false);
      const battle = fixture();
      const before = JSON.stringify(battle);
      expect(() => applyBattleMetadata(battle, input, '2026-09-22', land)).toThrow();
      expect(JSON.stringify(battle)).toBe(before);
    },
  );

  it('retains a month-only start and year-only end without inventing a day', () => {
    const battle = fixture();
    battle.end = { year: 1678 };
    applyBattleMetadata(
      battle,
      {
        expected: { start: null, end: battle.end, coords: null },
        start: { year: 1678, month: 3 },
        note: 'March siege.',
        sources: [source],
      },
      '2026-09-21',
      land,
    );
    expect(battle.start).toEqual({ year: 1678, month: 3 });
    expect(battle.coords).toBeUndefined();
    expect(battle.missing).toContain('land-event-in-open-ocean');
  });

  it('withdraws an unsupported place point without losing dates or quantitative evidence', () => {
    const battle = BattleRecordSchema.parse({
      ...fixture(),
      type: 'naval',
      medium: 'naval',
      start: { year: 1659 },
      coords: [128.83, 35.03],
      region: 'asia',
      coordinateSource: { kind: 'place', entityId: 'Q2', url: source.url },
      missing: ['unresolved-participant'],
      participants: [
        {
          id: 'local:Q1:ships',
          name: { en: 'Documented ships' },
          kind: 'military-unit',
          strength: [
            {
              value: 2,
              counts: 'ships',
              scope: 'participant',
              renderable: true,
              sources: [source],
            },
          ],
          casualties: [
            {
              value: 1,
              counts: 'ships',
              scope: 'participant',
              renderable: true,
              sources: [source],
            },
          ],
          deaths: [],
          sources: [source],
        },
      ],
    });
    const before = structuredClone(battle);
    const removal = {
      expected: { start: battle.start!, end: battle.end!, coords: battle.coords! },
      coords: null,
      note: 'The linked island point does not establish where the ships fought.',
      sources: [source],
      coordinateBasis: 'Withdraw the island locator; the offshore engagement position is unknown.',
      coordinateSourceUrl: source.url,
    };
    applyBattleMetadata(battle, removal, '2026-09-21', land);
    expect(battle).not.toHaveProperty('coords');
    expect(battle).not.toHaveProperty('coordinateSource');
    expect(battle).not.toHaveProperty('region');
    expect(battle.missing).toEqual(['unresolved-participant', 'missing-coordinates']);
    expect(battle.start).toEqual(before.start);
    expect(battle.end).toEqual(before.end);
    expect(battle.participants).toEqual(before.participants);
    expect(battle.totals).toEqual(before.totals);
    expect(battle.note).toContain(before.note);
    expect(battle.metadataReview).toMatchObject({
      fields: ['coords'],
      before: removal.expected,
      note: removal.note,
      coordinateBasis: removal.coordinateBasis,
      sources: [source],
    });
  });

  it('can correct a false year and withdraw a place point in the same reviewed patch', () => {
    const battle = fixture();
    battle.start = { year: 1957, month: 7, day: 14 };
    delete battle.end;
    battle.coords = [128.83, 35.03];
    battle.region = 'asia';
    battle.coordinateSource = { kind: 'place', entityId: 'Q2', url: source.url };
    battle.missing = ['invalid-date'];
    applyBattleMetadata(
      battle,
      {
        expected: { start: battle.start, end: null, coords: battle.coords },
        start: { year: 1597 },
        coords: null,
        note: 'Only the year is established in the atlas calendar; the island centre is withdrawn.',
        sources: [source],
        coordinateBasis: 'No engagement point is established.',
        coordinateSourceUrl: source.url,
      },
      '2026-09-21',
      land,
    );
    expect(battle.start).toEqual({ year: 1597 });
    expect(battle.era).toBe('early-modern');
    expect(battle).not.toHaveProperty('coords');
    expect(battle.missing).toEqual(['missing-coordinates']);
  });

  it('rejects withdrawal when its snapshot is stale, its evidence is missing, or no point changes', () => {
    const removal = {
      ...patch(),
      start: undefined,
      coords: null,
      expected: {
        start: null,
        end: { year: 1659, month: 4 },
        coords: [12, 50] as [number, number],
      },
    };
    for (const extra of [
      { expected: { ...removal.expected, coords: [13, 50] } },
      { sources: [] },
      { coordinateBasis: undefined },
      { coordinateSourceUrl: 'https://example.org/uncited' },
    ]) {
      const battle = fixture();
      battle.coords = [12, 50];
      const before = structuredClone(battle);
      expect(() =>
        applyBattleMetadata(battle, { ...removal, ...extra } as typeof removal, '2026-09-21', land),
      ).toThrow();
      expect(battle).toEqual(before);
    }
    const battle = fixture();
    expect(() =>
      applyBattleMetadata(battle, { ...removal, expected: patch().expected }, '2026-09-21', land),
    ).toThrow(/no change/);
  });

  it.each([
    { reviewedAt: undefined, expectedDate: '2026-09-21' },
    { reviewedAt: '2026-09-23', expectedDate: '2026-09-23' },
  ])(
    'verifies a coordinate withdrawal with review date $expectedDate',
    async ({ reviewedAt, expectedDate }) => {
      const original = BattleRecordSchema.parse({
        ...fixture(),
        start: { year: 1659 },
        coords: [12, 50],
        region: 'europe',
        coordinateSource: { kind: 'event', entityId: 'Q1', url: source.url },
        missing: [],
      });
      const removal = {
        ...(reviewedAt ? { reviewedAt } : {}),
        expected: { start: original.start!, end: original.end!, coords: original.coords! },
        coords: null,
        note: 'The original point is not established by the evidence.',
        sources: [source],
        coordinateBasis: 'Withdraw the unsupported original event point.',
        coordinateSourceUrl: source.url,
      };
      const record = structuredClone(original);
      applyBattleMetadata(record, removal, '2026-09-21', land);
      expect(record.metadataReview?.reviewedAt).toBe(expectedDate);
      const counts = { total: 1, mappable: 0, documented: 0, unmapped: 1 };
      const documents: Record<string, unknown> = {
        '/public/data/battles/index.json': {
          version: 1,
          counts,
          unmapped: 1,
          battles: [{ ...record, documented: false }],
        },
        '/public/data/battles/documented.json': { version: 1, ids: [] },
        '/public/data/battles/events/Q1.json': record,
        '/public/data/events/Q1.json': original,
        '/public/data/battles/coverage.json': {
          ...counts,
          candidates: 1,
          notFetched: [],
          status: 'all-cached-candidates-audited',
          reasonCounts: { 'missing-coordinates': 1 },
          reviewedParticipantProfiles: [],
          reviewedMetadata: ['Q1'],
          reviewedInclusions: [],
          quantitativeEvidence: {
            reviewedBattles: [],
            coverage: {
              withParticipants: 0,
              withStrengthEvidence: 0,
              withDeathEvidence: 0,
              withCasualtyEvidence: 0,
              withComparableArmies: 0,
              inheritedPlaceCoordinates: 0,
            },
          },
        },
        '/public/data/battles/candidates.json': {
          candidates: [{ id: 'Q1', classification: 'published-battle' }],
        },
        '/data/curated/battle-metadata.json': {
          version: 1,
          reviewedAt: '2026-09-21',
          records: { Q1: removal },
        },
        '/data/curated/battle-inclusions.json': {
          version: 1,
          reviewedAt: '2026-09-21',
          records: {},
        },
        '/data/curated/battle-profiles.json': { version: 1, records: {} },
        '/data/curated/battle-cdb90-profiles.json': { version: 1, records: {} },
      };
      let verification: unknown;
      vi.resetModules();
      // Exercise the real executable checker against a small catalog without reading
      // or rewriting the live catalog; the independent CDB artifact audit is out of scope.
      vi.doMock('node:fs/promises', () => ({
        readFile: async (path: string) => {
          const key = Object.keys(documents).find((suffix) => path.endsWith(suffix));
          if (!key) throw new Error(`Unexpected checker read: ${path}`);
          return JSON.stringify(documents[key]);
        },
        readdir: async () => ['Q1.json'],
        writeFile: async (path: string, value: string) => {
          if (!path.endsWith('/public/data/battles/verification.json'))
            throw new Error(`Unexpected checker write: ${path}`);
          verification = JSON.parse(value);
        },
      }));
      vi.doMock('../../pipeline/battles/cdb90-check', () => ({
        checkCdb90Artifacts: async () => {},
      }));
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        await import('../../pipeline/battles/check');
        expect(verification).toMatchObject({
          status: 'passed',
          records: 1,
          originalBattlesPreserved: 1,
          reviewedOriginalMetadataCorrections: ['Q1'],
          mappable: 0,
          documented: 0,
        });
        original.coords = [13, 50];
        vi.resetModules();
        await expect(import('../../pipeline/battles/check')).rejects.toThrow(
          'Original coords changed after review: Q1',
        );
      } finally {
        log.mockRestore();
        vi.doUnmock('node:fs/promises');
        vi.doUnmock('../../pipeline/battles/cdb90-check');
        vi.resetModules();
      }
    },
  );

  it('rejects stale reviews atomically instead of overwriting changed source data', () => {
    const battle = fixture();
    battle.start = { year: 1657 };
    const before = structuredClone(battle);
    expect(() => applyBattleMetadata(battle, patch(), '2026-09-21', land)).toThrow(/changed/);
    expect(battle).toEqual(before);
  });

  it('rejects impossible chronology and ocean locations without changing the record', () => {
    for (const extra of [
      { start: { year: 1660 } },
      { start: { year: -4000 } },
      { coords: [0, 0] as [number, number] },
    ]) {
      const battle = fixture();
      const before = structuredClone(battle);
      expect(() =>
        applyBattleMetadata(battle, { ...patch(), ...extra }, '2026-09-21', land),
      ).toThrow();
      expect(battle).toEqual(before);
    }
  });

  it('requires evidence, coordinate provenance, and an explicit previous-value snapshot', () => {
    for (const extra of [
      { sources: [] },
      { coords: [200, 50] },
      { expected: undefined },
      { coordinateBasis: undefined },
      { coordinateSourceUrl: 'https://example.org/uncited' },
      { strength: 1000 },
    ]) {
      expect(
        BattleMetadataFileSchema.safeParse({
          version: 1,
          reviewedAt: '2026-09-21',
          records: { Q1: { ...patch(), ...extra } },
        }).success,
      ).toBe(false);
    }
  });
});
