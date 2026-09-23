import { describe, expect, it } from 'vitest';
import { normalizeBattle, quantityEvidence } from '../../pipeline/battles/normalize';
import { BattleRecordSchema } from '../../lib/battles/schema';
import type { Entity } from '../../pipeline/normalize';
import curatedProfiles from '../../data/curated/battle-profiles.json';
import { BattleParticipantSchema, BattleQuantitySchema } from '../../lib/battles/schema';
import {
  armyLossShares,
  buildBattleSimulation,
  hasComparableOpposingForces,
} from '../../lib/battles/simulation';

const source = { label: 'Wikidata', url: 'https://www.wikidata.org/wiki/Q1' };
const claim = (amount: string, qualifiers?: Record<string, unknown>) => ({
  id: 'Q1$test',
  rank: 'normal',
  qualifiers,
  mainsnak: { datavalue: { value: { amount, unit: '1' } } },
});

describe('battle evidence', () => {
  it('preserves an unrecognized source unit without turning it into a troop count', () => {
    const statement = claim('+10');
    statement.mainsnak.datavalue.value.unit = 'http://www.wikidata.org/entity/Q791801';
    expect(quantityEvidence({ id: 'Q1' }, statement, 'P1120', 'total')).toMatchObject({
      value: 10,
      counts: 'unknown',
      renderable: false,
      rawUnit: 'http://www.wikidata.org/entity/Q791801',
    });
  });
  it('does not label an unresolved per-side estimate as the total army strength', () => {
    const entity: Entity = {
      id: 'Q1',
      claims: { P1132: [claim('+500', { P518: [{ datavalue: { value: { id: 'Q2' } } }] })] },
    };
    const battle = normalizeBattle(
      { id: 'Q1', type: 'battle', name: { en: 'Battle' }, sources: [source] },
      entity,
      new Map(),
    );
    expect(battle.totals.strength).toEqual([]);
    expect(battle.unassigned?.strength).toHaveLength(1);
    expect(battle.unassigned?.strength[0]?.participantIds).toEqual(['Q2']);
  });
  it('prevents quantities counted as people or groups from scaling military units', () => {
    for (const counts of ['people', 'groups', 'unknown'])
      expect(
        BattleQuantitySchema.safeParse({
          value: 2,
          counts,
          scope: 'total',
          renderable: true,
          sources: [source],
        }).success,
      ).toBe(false);
  });
  it('does not scale a whole army from an unidentified subset or a commander', () => {
    const militaryQuantity = {
      value: 500,
      counts: 'soldiers',
      scope: 'participant',
      renderable: true,
      sources: [source],
    };
    for (const scope of ['subset', 'unknown'])
      expect(BattleQuantitySchema.safeParse({ ...militaryQuantity, scope }).success).toBe(false);
    expect(
      BattleParticipantSchema.safeParse({
        id: 'Q2',
        name: { en: 'Commander' },
        kind: 'person',
        strength: [militaryQuantity],
        deaths: [],
        casualties: [],
        sources: [source],
      }).success,
    ).toBe(false);
  });
  it('retains references for every reviewed number and compatible casualty units', () => {
    for (const record of Object.values(curatedProfiles.records)) {
      for (const participant of record.participants) {
        const parsed = BattleParticipantSchema.parse(participant);
        for (const field of ['strength', 'deaths', 'casualties'] as const)
          for (const quantity of parsed[field]) expect(quantity.sources.length).toBeGreaterThan(0);
        const strength = parsed.strength.find((quantity) => quantity.renderable);
        for (const loss of [...parsed.deaths, ...parsed.casualties])
          if (loss.renderable && strength && loss.counts === strength.counts)
            expect(loss.value).toBeLessThanOrEqual(strength.value);
        for (const deaths of parsed.deaths)
          for (const casualties of parsed.casualties)
            if (deaths.counts === casualties.counts && deaths.scope === casualties.scope)
              expect(deaths.value).toBeLessThanOrEqual(casualties.value);
      }
    }
    const trafalgar = curatedProfiles.records.Q171416.participants;
    expect(trafalgar.map((participant) => participant.strength[0]?.counts)).toEqual([
      'ships',
      'ships',
    ]);
    expect(
      trafalgar.every((participant) =>
        participant.deaths.every((quantity) => !quantity.renderable),
      ),
    ).toBe(true);
  });
  it('animates the captured Lake Erie vessels without converting their crews into lost ships', () => {
    const record = curatedProfiles.records.Q990715;
    const simulation = buildBattleSimulation({
      id: 'Q990715',
      name: { en: 'Battle of Lake Erie' },
      medium: 'naval',
      participants: record.participants.map((participant) =>
        BattleParticipantSchema.parse(participant),
      ),
      totals: { strength: [], deaths: [], casualties: [] },
    });
    const american = simulation.armies.find((army) => army.sideId === 'american')!;
    const british = simulation.armies.find((army) => army.sideId === 'british')!;
    expect(american.strength).toBe(9);
    expect(british.strength).toBe(6);
    expect(american.deaths).toBeUndefined();
    expect(british.deaths).toBeUndefined();
    expect(american.casualties).toBeUndefined();
    expect(british.casualties).toBe(6);
    expect(armyLossShares(british, 1)).toEqual({ deaths: 0, withdrawn: 1 });
  });
  it('keeps an explicitly reported zero distinct from an unknown death toll', () => {
    const simulate = (id: 'Q653664' | 'Q311726') =>
      buildBattleSimulation({
        id,
        name: { en: id },
        medium: 'land',
        participants: curatedProfiles.records[id].participants.map((participant) =>
          BattleParticipantSchema.parse(participant),
        ),
        totals: { strength: [], deaths: [], casualties: [] },
      });
    const trenton = simulate('Q653664').armies.find((army) => army.sideId === 'continental')!;
    expect(trenton.deaths).toBe(0);
    expect(trenton.casualties).toBe(5);
    expect(simulate('Q311726').armies.every((army) => army.deaths === undefined)).toBe(true);
  });
  it('keeps reviewed historical camps illustrative when their quantities are unknown', () => {
    const participants = curatedProfiles.records.Q4475946.participants.map((participant) =>
      BattleParticipantSchema.parse(participant),
    );
    const battle = {
      id: 'Q4475946',
      name: { en: 'Loss of Hatsuse and Yashima' },
      medium: 'naval' as const,
      participants,
      totals: { strength: [], deaths: [], casualties: [] },
    };
    const simulation = buildBattleSimulation(battle);
    expect(participants.map((participant) => participant.id)).not.toContain('Q465283');
    expect(new Set(simulation.armies.map((army) => army.sideId)).size).toBe(2);
    expect(hasComparableOpposingForces(battle)).toBe(false);
    for (const army of simulation.armies) {
      expect(army.symbolic).toBe(true);
      expect(army.strength).toBeUndefined();
      expect(army.casualties).toBeUndefined();
    }
  });
  it('scales the Hatteras–Alabama duel by vessels and preserves an explicit surviving ship', () => {
    const simulation = buildBattleSimulation({
      id: 'Q3514809',
      name: { en: 'Hatteras–Alabama' },
      medium: 'naval',
      participants: curatedProfiles.records.Q3514809.participants.map((participant) =>
        BattleParticipantSchema.parse(participant),
      ),
      totals: { strength: [], deaths: [], casualties: [] },
    });
    expect(simulation.armies.map((army) => army.strength)).toEqual([1, 1]);
    const hatteras = simulation.armies.find((army) => army.sideId === 'union')!;
    const alabama = simulation.armies.find((army) => army.sideId === 'confederacy')!;
    expect(hatteras.deaths).toBeUndefined();
    expect(armyLossShares(hatteras, 1)).toEqual({ deaths: 0, withdrawn: 1 });
    expect(alabama.casualties).toBe(0);
    expect(armyLossShares(alabama, 1)).toEqual({ deaths: 0, withdrawn: 0 });
  });
  it('counts the two Havana duellists without inferring crew strengths or disputed casualties', () => {
    const battle = {
      id: 'Q1529375',
      name: { en: 'Battle of Havana' },
      medium: 'naval' as const,
      participants: curatedProfiles.records.Q1529375.participants.map((participant) =>
        BattleParticipantSchema.parse(participant),
      ),
      totals: { strength: [], deaths: [], casualties: [] },
    };
    const simulation = buildBattleSimulation(battle);
    expect(hasComparableOpposingForces(battle)).toBe(true);
    expect(simulation.armies.map((army) => army.strength)).toEqual([1, 1]);
    for (const army of simulation.armies) {
      expect(army.symbolic).toBe(false);
      expect(army.deaths).toBeUndefined();
      expect(army.casualties).toBeUndefined();
    }
  });
  it('preserves uncertain qualified quantities without presenting them as soldiers', () => {
    const statement = claim('+200', { P518: [{ datavalue: { value: { id: 'Q2' } } }] });
    statement.mainsnak.datavalue.value = {
      ...statement.mainsnak.datavalue.value,
      lowerBound: '+150',
      upperBound: '+250',
    } as typeof statement.mainsnak.datavalue.value;
    const result = quantityEvidence({ id: 'Q1' }, statement, 'P1132', 'total');
    expect(result).toMatchObject({
      value: 200,
      min: 150,
      max: 250,
      approximate: true,
      counts: 'unknown',
      renderable: false,
      scope: 'participant',
      participantIds: ['Q2'],
      statementId: 'Q1$test',
    });
    expect(result?.qualifiers).toEqual(statement.qualifiers);
  });
  it('rejects deprecated, negative and non-numeric quantities', () => {
    expect(
      quantityEvidence({ id: 'Q1' }, { ...claim('+2'), rank: 'deprecated' }, 'P1132', 'total'),
    ).toBeUndefined();
    expect(quantityEvidence({ id: 'Q1' }, claim('-2'), 'P1120', 'total')).toBeUndefined();
    expect(quantityEvidence({ id: 'Q1' }, claim('unknown'), 'P1132', 'total')).toBeUndefined();
  });
  it('keeps people separate from armies and does not create camps', () => {
    const entity: Entity = {
      id: 'Q1',
      labels: { en: { value: 'Battle' } },
      claims: { P710: [{ mainsnak: { datavalue: { value: { id: 'Q2' } } } }] },
    };
    const person: Entity = {
      id: 'Q2',
      labels: { en: { value: 'Commander' } },
      claims: { P31: [{ mainsnak: { datavalue: { value: { id: 'Q5' } } } }] },
    };
    const battle = normalizeBattle(
      {
        id: 'Q1',
        name: { en: 'Battle' },
        type: 'battle',
        start: { year: 100 },
        coords: [1, 2],
        era: 'classical',
        region: 'europe',
        belligerents: [],
        importance: 1,
        sources: [source],
        datePrecision: 'year',
      },
      entity,
      new Map([['Q2', person]]),
    );
    expect(battle.participants[0]).toMatchObject({ id: 'Q2', kind: 'person' });
    expect(battle.participants[0]?.sideId).toBeUndefined();
    expect(BattleRecordSchema.safeParse(battle).success).toBe(true);
  });
  it('recognizes explicitly sourced city-states without treating every city as an army', () => {
    const entities = new Map<string, Entity>([
      [
        'Q844930',
        {
          id: 'Q844930',
          claims: { P31: [{ mainsnak: { datavalue: { value: { id: 'Q133442' } } } }] },
        },
      ],
      [
        'Q5690',
        {
          id: 'Q5690',
          claims: { P31: [{ mainsnak: { datavalue: { value: { id: 'Q148837' } } } }] },
        },
      ],
      [
        'Q1524',
        { id: 'Q1524', claims: { P31: [{ mainsnak: { datavalue: { value: { id: 'Q515' } } } }] } },
      ],
    ]);
    const battle = normalizeBattle(
      { id: 'Q1', type: 'battle', name: { en: 'City-state battle' }, sources: [source] },
      {
        id: 'Q1',
        claims: {
          P710: [...entities.keys()].map((id) => ({ mainsnak: { datavalue: { value: { id } } } })),
        },
      },
      entities,
    );
    expect(battle.participants.map((participant) => participant.kind)).toEqual([
      'polity',
      'polity',
      'unknown',
    ]);
    expect(
      battle.participants.every(
        (participant) => !participant.sideId && !participant.strength.length,
      ),
    ).toBe(true);
  });
  it('allows a catalog record without a known date or location', () => {
    expect(
      BattleRecordSchema.safeParse({
        id: 'Q1',
        name: { en: 'Undated battle' },
        type: 'battle',
        medium: 'land',
        participants: [],
        totals: { strength: [], deaths: [], casualties: [] },
        sources: [source],
        missing: ['missing-date', 'missing-coordinates'],
      }).success,
    ).toBe(true);
  });
});
