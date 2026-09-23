import { describe, expect, it } from 'vitest';
import { normalizeBattle } from '../../pipeline/battles/normalize';
import { buildBattleSimulation } from '../../lib/battles/simulation';
import type { Claim, Entity } from '../../pipeline/normalize';

const item = (id: string, rank = 'normal'): Claim => ({
  rank,
  mainsnak: { datavalue: { value: { id } } },
});
const record = (classes: Claim[]) => {
  const participant: Entity = {
    id: 'Q2',
    lastrevid: 123,
    labels: { en: { value: 'Source participant' } },
    claims: { P31: classes },
  };
  return normalizeBattle(
    {
      id: 'Q1',
      type: 'battle',
      name: { en: 'Source event' },
      sources: [{ label: 'Source', url: 'https://www.wikidata.org/wiki/Q1' }],
    },
    { id: 'Q1', claims: { P710: [item('Q2')] } },
    new Map([['Q2', participant]]),
  );
};

describe('source-typed battle participants', () => {
  it.each([
    ['Q781132', 'military-unit'], // military branch
    ['Q772547', 'military-unit'], // combined armed forces
    ['Q99541706', 'polity'], // historical unrecognized state
    ['Q10711424', 'polity'], // state with limited recognition
  ])(
    'retains an explicitly typed %s as a force without inventing strength or sides',
    (classId, kind) => {
      const battle = record([item(classId, 'preferred')]);
      expect(battle.participants[0].kind).toBe(kind);
      expect(battle.participants[0].sources).toContainEqual(
        expect.objectContaining({ url: 'https://www.wikidata.org/wiki/Q2?oldid=123' }),
      );
      const army = buildBattleSimulation(battle).armies[0];
      expect(army.participantId).toBe('Q2');
      expect(army.strength).toBeUndefined();
      expect(army.sideId).toBeUndefined();
      expect(army.symbolic).toBe(true);
    },
  );

  it.each(['Q5', 'Q4830453', 'Q15642541'])(
    'never infers a force from a person, company or district class %s',
    (classId) => {
      expect(
        buildBattleSimulation(record([item(classId)])).armies[0].participantId,
      ).toBeUndefined();
    },
  );

  it('respects preferred source types instead of reviving deprecated military classifications', () => {
    const battle = record([
      item('Q5', 'preferred'),
      item('Q781132'),
      item('Q772547', 'deprecated'),
    ]);
    expect(battle.participants[0].kind).toBe('person');
    expect(buildBattleSimulation(battle).armies[0].participantId).toBeUndefined();
  });
});
