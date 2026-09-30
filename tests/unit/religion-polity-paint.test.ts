import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_OPACITY,
  religionPolityPaint,
  RELIGION_NEUTRAL,
} from '../../components/map/religion-polity-paint';
import type { ReligionPolityDataset } from '../../lib/religions/polities';

const dataset = {
  version: 1,
  acquiredAt: 'x',
  reviewedAt: 'x',
  families: [
    {
      id: 'christianity',
      names: { fr: 'C', en: 'C' },
      color: '#111111',
      symbol: 'x',
      kind: 'religion',
    },
    { id: 'islam', names: { fr: 'I', en: 'I' }, color: '#222222', symbol: 'x', kind: 'religion' },
    {
      id: 'hinduism',
      names: { fr: 'H', en: 'H' },
      color: '#111111',
      symbol: 'x',
      kind: 'religion',
    },
  ],
  evidence: {
    majority: { fr: 'm', en: 'm' },
    predominant: { fr: 'p', en: 'p' },
    state: { fr: 's', en: 's' },
  },
  sources: [{ id: 's', title: 'S', url: 'https://example.org', license: 'x' }],
  polities: [
    {
      entityId: 'a',
      name: 'A',
      spans: [
        {
          from: 0,
          to: 100,
          familyId: 'christianity',
          evidence: 'majority',
          basis: 'seshat',
          label: { fr: 'x', en: 'x' },
          sourceIds: ['s'],
        },
      ],
    },
    {
      entityId: 'b',
      name: 'B',
      spans: [
        {
          from: 0,
          to: 100,
          familyId: 'islam',
          evidence: 'state',
          basis: 'wikidata',
          label: { fr: 'x', en: 'x' },
          sourceIds: ['s'],
        },
      ],
    },
    {
      entityId: 'c',
      name: 'C',
      spans: [
        {
          from: 0,
          to: 100,
          familyId: 'hinduism',
          evidence: 'majority',
          basis: 'editorial',
          label: { fr: 'x', en: 'x' },
          sourceIds: ['s'],
        },
      ],
    },
  ],
} as unknown as ReligionPolityDataset;

describe('religionPolityPaint', () => {
  it('returns plain neutral constants without a dataset or attribution', () => {
    expect(religionPolityPaint(null, 50, null, 'dark')).toEqual({
      fillColor: RELIGION_NEUTRAL,
      fillOpacity: EVIDENCE_OPACITY.dark.none,
      stateIds: [],
    });
    expect(religionPolityPaint(dataset, 500, null, 'dark').fillColor).toBe(RELIGION_NEUTRAL);
  });

  it('groups entities by colour and maps opacity by evidence', () => {
    const paint = religionPolityPaint(dataset, 50, null, 'dark');
    expect(paint.fillColor).toEqual([
      'match',
      ['get', 'entityId'],
      ['a', 'c'],
      '#111111',
      ['b'],
      '#222222',
      RELIGION_NEUTRAL,
    ]);
    expect(paint.fillOpacity).toEqual([
      'match',
      ['get', 'entityId'],
      ['a', 'c'],
      EVIDENCE_OPACITY.dark.majority,
      ['b'],
      EVIDENCE_OPACITY.dark.state,
      EVIDENCE_OPACITY.dark.none,
    ]);
    expect(paint.stateIds).toEqual(['b']);
  });

  it('keeps only the filtered family and drops empty opacity cases', () => {
    const paint = religionPolityPaint(dataset, 50, 'christianity', 'light');
    expect(paint.fillColor).toEqual([
      'match',
      ['get', 'entityId'],
      ['a'],
      '#111111',
      RELIGION_NEUTRAL,
    ]);
    expect(paint.fillOpacity).toEqual([
      'match',
      ['get', 'entityId'],
      ['a'],
      EVIDENCE_OPACITY.light.majority,
      EVIDENCE_OPACITY.light.none,
    ]);
    expect(paint.stateIds).toEqual([]);
  });
});
