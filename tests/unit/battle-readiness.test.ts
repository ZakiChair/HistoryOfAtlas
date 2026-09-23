import { describe, expect, it } from 'vitest';
import type { BattleParticipant, BattleRecord } from '../../lib/battles/schema';
import { assessBattleReadiness } from '../../pipeline/battles/readiness';

const source = { label: 'Synthetic test evidence', url: 'https://example.org/evidence' };
function army(id: string, sideId: string, strength?: number, deaths?: number): BattleParticipant {
  return {
    id,
    sideId,
    name: { en: id },
    kind: 'military-unit',
    profileId: 'musket-infantry',
    strength:
      strength === undefined
        ? []
        : [
            {
              value: strength,
              counts: 'soldiers',
              scope: 'participant',
              renderable: true,
              sources: [source],
            },
          ],
    deaths:
      deaths === undefined
        ? []
        : [
            {
              value: deaths,
              counts: 'soldiers',
              scope: 'participant',
              renderable: true,
              sources: [source],
            },
          ],
    casualties: [],
    sources: [source],
  };
}
function battle(participants: BattleParticipant[]): BattleRecord {
  return {
    id: 'Q1',
    name: { en: 'Synthetic battle' },
    type: 'battle',
    medium: 'land',
    start: { year: 1862 },
    coords: [1, 2],
    participants,
    totals: { strength: [], deaths: [], casualties: [] },
    sources: [source],
  };
}

describe('actual battle readiness', () => {
  it('resolves equipment and losses in each force’s own medium in a coastal battle', () => {
    const shore = army('shore', 'a', 6000, 3000);
    shore.medium = 'land';
    const fleet = army('fleet', 'b', 12, 6);
    fleet.medium = 'naval';
    fleet.profileId = 'steam-corvette';
    fleet.strength[0].counts = 'ships';
    fleet.deaths[0].counts = 'ships';
    const record = battle([shore, fleet]);
    record.medium = 'naval';
    record.type = 'naval';
    const result = assessBattleReadiness(record);
    expect(result.equipment).toBe('complete');
    expect(result.profiles).toEqual(['musket-infantry', 'steam-corvette']);
    expect(result.visibleLosses).toEqual({ desktop: 9, mobile: 9 });
    // A count of ships is not comparable to a count of soldiers across camps.
    expect(result.comparableOpposingForces).toBe(false);
    expect(result.fullEvidenceCombination).toBe(false);
  });

  it('keeps comparable camps distinct from complete numerical coverage', () => {
    const extra = army('unknown', 'a');
    extra.profileId = 'unclassified-unit';
    const result = assessBattleReadiness(
      battle([army('a', 'a', 2000), army('b', 'b', 3000), extra]),
    );
    expect(result.comparableOpposingForces).toBe(true);
    expect(result.allArmiesQuantified).toBe(false);
    expect(result.equipment).toBe('partial');
    expect(result.fullCombination).toBe(false);
  });

  it('does not count an unassigned overall death toll as per-army animated losses', () => {
    const record = battle([army('a', 'a', 80000), army('b', 'b', 80000)]);
    record.totals.deaths = [
      { value: 30000, counts: 'soldiers', scope: 'total', renderable: false, sources: [source] },
    ];
    const result = assessBattleReadiness(record);
    expect(result.hasAnyLossEvidence).toBe(true);
    expect(result.armiesWithCompatibleLossEvidence).toBe(0);
    expect(result.visibleLosses.desktop).toBe(0);
  });

  it('does not equate numerical death evidence with a visibly removed model', () => {
    const result = assessBattleReadiness(battle([army('a', 'a', 150, 17), army('b', 'b', 4000)]));
    expect(result.armiesWithCompatibleLossEvidence).toBe(1);
    expect(result.visibleLosses.desktop).toBe(0);
    expect(result.fullCombination).toBe(false);
  });

  it('does not infer opposing armies from a symbolic fallback', () => {
    const result = assessBattleReadiness(battle([]));
    expect(result.armies).toBe(1);
    expect(result.identifiedArmies).toBe(0);
    expect(result.opposingCamps).toBe(false);
    expect(result.equipment).toBe('unknown');
  });

  it('separates incompatible dates from missing dates', () => {
    const record = battle([]);
    record.type = 'naval';
    record.medium = 'naval';
    record.start = { year: -1200 };
    expect(assessBattleReadiness(record).equipment).toBe('date-incompatible');
    delete record.start;
    const result = assessBattleReadiness(record);
    expect(result.equipment).toBe('missing-date');
    expect(result.mappable).toBe(false);
  });

  it('requires located opposing forces, equipment and losses in each camp for the full combination', () => {
    const record = battle([army('a', 'a', 2000, 1000), army('b', 'b', 3000, 1000)]);
    const result = assessBattleReadiness(record);
    expect(result.equipment).toBe('complete');
    expect(result.allCampsWithCompatibleLossEvidence).toBe(true);
    expect(result.visibleLosses.desktop).toBe(2);
    expect(result.fullCombination).toBe(true);
    delete record.coords;
    expect(assessBattleReadiness(record).fullCombination).toBe(false);
  });
});
