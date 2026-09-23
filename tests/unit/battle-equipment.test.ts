import { describe, expect, it } from 'vitest';
import { BattleRecordSchema } from '../../lib/battles/schema';
import { applyBattleEquipment, BattleEquipmentFileSchema } from '../../pipeline/battles/equipment';

const source = { label: 'Original record', url: 'https://www.wikidata.org/wiki/Q1' };
const evidence = { title: 'Ship and shore report', url: 'https://example.org/naval-report' };
const fixture = () =>
  BattleRecordSchema.parse({
    id: 'Q1',
    name: { en: 'Mixed operation' },
    type: 'naval',
    medium: 'naval',
    start: { year: 1864 },
    coords: [1, 2],
    sources: [source],
    totals: { strength: [], deaths: [], casualties: [] },
    participants: ['Q2', 'Q3'].map((id) => ({
      id,
      name: { en: id },
      kind: 'polity',
      sources: [source],
      strength: [],
      deaths: [],
      casualties: [],
    })),
  });

describe('equipment-only battle enrichment', () => {
  it('can identify a source-reviewed force without inventing its numbers or its camp', () => {
    const battle = fixture();
    battle.participants[0].kind = 'unknown';
    applyBattleEquipment(battle, {
      note: 'The source explicitly identifies this participant as the opposing fleet.',
      sources: [evidence],
      participants: [{ id: 'Q2', kind: 'military-unit', profileId: 'steam-corvette' }],
    });
    expect(battle.participants[0].kind).toBe('military-unit');
    expect(battle.participants[0].sources).toContainEqual({
      label: evidence.title,
      url: evidence.url,
    });
    expect(battle.participants[0].sideId).toBeUndefined();
    expect(battle.participants[0].strength).toEqual([]);
    expect(battle.participants[0].deaths).toEqual([]);
    expect(battle.participants[0].casualties).toEqual([]);
    battle.participants[1].kind = 'person';
    expect(() =>
      applyBattleEquipment(battle, {
        note: 'A commander is not a fleet.',
        sources: [evidence],
        participants: [{ id: 'Q3', kind: 'military-unit' }],
      }),
    ).toThrow(/person/);
  });

  it('preserves unknown forces and camps while separating a sourced ship from shore troops', () => {
    const battle = fixture();
    applyBattleEquipment(battle, {
      profileId: 'steam-corvette',
      note: 'Ships fired at shore troops.',
      sources: [evidence],
      participants: [
        { id: 'Q2', medium: 'naval', profileId: 'steam-corvette' },
        { id: 'Q3', medium: 'land', profileId: 'unclassified-unit' },
      ],
    });
    expect(battle.participants.map((p) => [p.id, p.medium, p.profileId])).toEqual([
      ['Q2', 'naval', 'steam-corvette'],
      ['Q3', 'land', 'unclassified-unit'],
    ]);
    for (const participant of battle.participants) {
      expect(participant.sideId).toBeUndefined();
      expect(participant.strength).toEqual([]);
      expect(participant.deaths).toEqual([]);
      expect(participant.casualties).toEqual([]);
      expect(participant.sources.some((item) => item.url === evidence.url)).toBe(true);
    }
    expect(BattleRecordSchema.parse(battle).profileId).toBe('steam-corvette');
  });

  it('rejects assigning equipment to a missing participant or a person', () => {
    expect(() =>
      applyBattleEquipment(fixture(), {
        note: 'Review',
        sources: [evidence],
        participants: [{ id: 'Q9', profileId: 'steam-corvette' }],
      }),
    ).toThrow(/absent/);
    const battle = fixture();
    battle.participants[0].kind = 'person';
    expect(() =>
      applyBattleEquipment(battle, {
        note: 'Review',
        sources: [evidence],
        participants: [{ id: 'Q2', profileId: 'steam-corvette' }],
      }),
    ).toThrow(/person/);
  });

  it('does not accept quantities or invented sides in an equipment-only file', () => {
    for (const extra of [{ strength: [] }, { sideId: 'invented' }])
      expect(
        BattleEquipmentFileSchema.safeParse({
          version: 1,
          reviewedAt: '2026-09-21',
          policy: 'Equipment only',
          records: {
            Q1: {
              note: 'Review',
              sources: [evidence],
              participants: [{ id: 'Q2', profileId: 'steam-corvette', ...extra }],
            },
          },
        }).success,
      ).toBe(false);
  });
});
