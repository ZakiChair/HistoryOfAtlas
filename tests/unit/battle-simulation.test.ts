import { describe, expect, it } from 'vitest';
import {
  allocateBattleModels,
  armyLossShares,
  battleOccursInYear,
  buildBattleSimulation,
  formationPositions,
  hasComparableOpposingForces,
  unitAdvanceDistance,
  unitLossState,
} from '../../lib/battles/simulation';

describe('sourced battle formations', () => {
  it('only compares reviewed forces across different camps with matching count units', () => {
    const force = (id: string, sideId: string, medium: 'land' | 'naval') => ({
      id,
      sideId,
      medium,
      name: { en: id },
      kind: 'military-unit',
      strength: [
        {
          value: 10,
          counts: medium === 'land' ? 'soldiers' : 'ships',
          scope: 'participant',
          renderable: true,
        },
      ],
    });
    const record = {
      id: 'Q1',
      name: { en: 'Coastal battle' },
      medium: 'naval' as const,
      totals: {},
      participants: [force('fleet', 'a', 'naval'), force('shore', 'b', 'land')],
    };
    expect(hasComparableOpposingForces(record)).toBe(false);
    record.participants.push(force('allied fleet', 'a', 'naval'));
    expect(hasComparableOpposingForces(record)).toBe(false);
    record.participants.push(force('opposing fleet', 'b', 'naval'));
    expect(hasComparableOpposingForces(record)).toBe(true);
    record.participants[3].strength[0].renderable = false;
    expect(hasComparableOpposingForces(record)).toBe(false);
  });

  it('uses an event equipment profile only for an anonymous formation', () => {
    const battle = {
      id: 'Q1',
      name: { en: 'Naval action' },
      medium: 'naval' as const,
      profileId: 'steam-corvette',
      participants: [],
      totals: {},
    };
    expect(buildBattleSimulation(battle).armies[0]).toMatchObject({
      profileId: 'steam-corvette',
      medium: 'naval',
      symbolic: true,
      models: 10,
    });
    const identified = buildBattleSimulation({
      ...battle,
      participants: [{ id: 'A', name: { en: 'Known polity' }, kind: 'polity' }],
    });
    expect(identified.armies[0].profileId).toBeUndefined();
  });
  it('keeps coastal troops and fleets in separate quantity scales and loss units', () => {
    const force = (id: string, medium: 'land' | 'naval', value: number) => ({
      id,
      name: { en: id },
      kind: 'military-unit',
      medium,
      strength: [
        {
          value,
          counts: medium === 'naval' ? 'ships' : 'soldiers',
          scope: 'participant',
          renderable: true,
        },
        {
          value: 98765,
          counts: medium === 'naval' ? 'soldiers' : 'ships',
          scope: 'participant',
          renderable: true,
        },
      ],
      deaths: [
        {
          value: medium === 'naval' ? 3 : 300,
          counts: medium === 'naval' ? 'ships' : 'soldiers',
          scope: 'participant',
          renderable: true,
        },
      ],
    });
    const battle = {
      id: 'Q1',
      name: { en: 'Coastal action' },
      medium: 'naval' as const,
      totals: {},
      participants: [
        force('fleet-a', 'naval', 9),
        force('fleet-b', 'naval', 18),
        force('shore', 'land', 3000),
      ],
    };
    const result = buildBattleSimulation(battle);
    expect(
      result.armies.map(({ medium, strength, deaths, models, soldiersPerModel }) => ({
        medium,
        strength,
        deaths,
        models,
        soldiersPerModel,
      })),
    ).toEqual([
      { medium: 'naval', strength: 9, deaths: 3, models: 9, soldiersPerModel: 1 },
      { medium: 'naval', strength: 18, deaths: 3, models: 18, soldiersPerModel: 1 },
      { medium: 'land', strength: 3000, deaths: 300, models: 3, soldiersPerModel: 1000 },
    ]);
    for (const budget of [3, 8, 18, 36]) {
      const limited = buildBattleSimulation(battle, budget);
      expect(limited.models).toBeLessThanOrEqual(budget);
      expect(limited.armies.every((army) => army.models > 0)).toBe(true);
      expect(limited.armies[0].soldiersPerModel).toBe(limited.armies[1].soldiersPerModel);
    }
  });
  it('requires an actual place and date and rejects scenes outside their historical period', () => {
    const battle = { coords: [4.4, 50.6] as [number, number], start: { year: 1815 } };
    expect(battleOccursInYear(battle, 1815)).toBe(true);
    expect(battleOccursInYear(battle, 1814)).toBe(false);
    expect(battleOccursInYear(battle, 1816)).toBe(false);
    expect(battleOccursInYear({ ...battle, end: { year: 1817 } }, 1816)).toBe(true);
    expect(battleOccursInYear({ coords: battle.coords }, 1815)).toBe(false);
    expect(battleOccursInYear({ start: battle.start }, 1815)).toBe(false);
    expect(battleOccursInYear({ ...battle, coords: [NaN, 50] }, 1815)).toBe(false);
  });
  it('uses one population scale for unequal armies without changing their ratio', () => {
    expect(
      allocateBattleModels(
        [
          { id: 'A', strength: 10_000 },
          { id: 'B', strength: 20_000 },
        ],
        60,
      ),
    ).toEqual([
      { id: 'A', models: 20, soldiersPerModel: 500 },
      { id: 'B', models: 40, soldiersPerModel: 500 },
    ]);
  });
  it('preserves battle magnitude below the scene budget using a shared reference density', () => {
    const battle = (multiplier: number) => ({
      id: 'Q1',
      name: { en: 'Example' },
      medium: 'land' as const,
      participants: [10_000, 20_000].map((value, index) => ({
        id: String(index),
        name: { en: String(index) },
        kind: 'military-unit',
        sideId: String(index),
        strength: [
          { value: value * multiplier, counts: 'soldiers', scope: 'participant', renderable: true },
        ],
      })),
      totals: {},
    });
    const smaller = buildBattleSimulation(battle(1));
    const larger = buildBattleSimulation(battle(2));
    expect(smaller.armies.map((army) => army.models)).toEqual([10, 20]);
    expect(larger.armies.map((army) => army.models)).toEqual([20, 40]);
    expect(
      [...smaller.armies, ...larger.armies].every((army) => army.soldiersPerModel === 1000),
    ).toBe(true);
    const massive = buildBattleSimulation(battle(100));
    expect(massive.models).toBe(80);
    expect(massive.armies.every((army) => army.soldiersPerModel === 37_500)).toBe(true);
  });
  it('does not apply the infantry density to fleets or eliminate small known forces', () => {
    for (const medium of ['naval', 'air', 'land'] as const) {
      const counts = medium === 'naval' ? 'ships' : medium === 'air' ? 'aircraft' : 'soldiers';
      const result = buildBattleSimulation({
        id: 'Q1',
        name: { en: 'Example' },
        medium,
        participants: [
          {
            id: 'A',
            name: { en: 'A' },
            kind: 'military-unit',
            strength: [{ value: 27, counts, scope: 'participant', renderable: true }],
          },
        ],
        totals: {},
      });
      expect(result.models).toBe(medium === 'land' ? 1 : 27);
      expect(result.armies[0].symbolic).toBe(false);
    }
  });
  it('shows unknown strength as an illustrative group and preserves real zero', () => {
    const result = allocateBattleModels(
      [{ id: 'unknown' }, { id: 'empty', strength: 0 }, { id: 'known', strength: 100 }],
      21,
    );
    expect(result).toEqual([
      { id: 'unknown', models: 1 },
      { id: 'empty', models: 0, soldiersPerModel: 5 },
      { id: 'known', models: 20, soldiersPerModel: 5 },
    ]);
  });
  it('gives unknown armies groups without assigning them the documented armies population scale', () => {
    const armies = [
      { id: 'A', strength: 10_000 },
      { id: 'B', strength: 20_000 },
      { id: 'unknown' },
    ];
    const result = allocateBattleModels(armies, 80, 1000);
    expect(result).toEqual([
      { id: 'A', models: 10, soldiersPerModel: 1000 },
      { id: 'B', models: 20, soldiersPerModel: 1000 },
      { id: 'unknown', models: 10 },
    ]);
    const mobile = allocateBattleModels(armies, 36, 1000);
    expect(mobile.map((army) => army.models)).toEqual([10, 20, 6]);
    expect(mobile[0].soldiersPerModel).toBe(1000);
    expect(mobile[1].soldiersPerModel).toBe(1000);
    expect(mobile[2].soldiersPerModel).toBeUndefined();
  });
  it('reduces illustrative groups fairly under small budgets while preserving known forces', () => {
    const armies = [
      { id: 'unknown-A' },
      { id: 'small', strength: 30 },
      { id: 'unknown-B' },
      { id: 'large', strength: 100_000 },
    ];
    expect(allocateBattleModels(armies, 6).map((army) => army.models)).toEqual([1, 1, 1, 3]);
    expect(allocateBattleModels(armies, 3).map((army) => army.models)).toEqual([1, 1, 0, 1]);
    expect(allocateBattleModels(armies, 2).map((army) => army.models)).toEqual([0, 1, 0, 1]);
    expect(allocateBattleModels(armies, 1).reduce((sum, army) => sum + army.models, 0)).toBe(1);
    expect(allocateBattleModels(armies, 0).every((army) => army.models === 0)).toBe(true);
    for (const budget of [4, 8, 36, 80]) {
      const groups = allocateBattleModels(
        Array.from({ length: 7 }, (_, i) => ({ id: String(i) })),
        budget,
      );
      const counts = groups.map((army) => army.models);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
      expect(Math.max(...counts)).toBeLessThanOrEqual(10);
      expect(counts.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(budget);
      expect(groups.every((army) => army.soldiersPerModel === undefined)).toBe(true);
    }
  });
  it('keeps a small opposing army visible instead of rounding it out of the battle', () => {
    const armies = [
      { id: 'defenders', strength: 150 },
      { id: 'attackers', strength: 4000 },
    ];
    const allocated = allocateBattleModels(armies, 80, 1000);
    expect(allocated.map((army) => army.models)).toEqual([1, 4]);
    expect(allocated.every((army) => army.soldiersPerModel === 830)).toBe(true);
    const tiny = allocateBattleModels(
      [
        { id: 'A', strength: 30 },
        { id: 'B', strength: 100 },
      ],
      80,
      1000,
    );
    expect(tiny.map((army) => army.models)).toEqual([1, 1]);
    expect(tiny.every((army) => army.soldiersPerModel === 65)).toBe(true);
  });
  it('keeps documented ship counts and losses visible beside unknown naval and air forces on mobile', () => {
    const carriers = (id: string, value: number, lost: number) => ({
      id,
      name: { en: id },
      kind: 'military-unit',
      medium: 'naval' as const,
      strength: [{ value, counts: 'ships', scope: 'participant', renderable: true }],
      casualties: [{ value: lost, counts: 'ships', scope: 'participant', renderable: true }],
    });
    const result = buildBattleSimulation(
      {
        id: 'Q1',
        name: { en: 'Carrier and air action' },
        medium: 'naval',
        totals: {},
        participants: [
          carriers('a-carriers', 3, 1),
          carriers('b-carriers', 4, 4),
          ...(['naval', 'air'] as const).flatMap((medium) =>
            ['a', 'b'].map((side) => ({
              id: `${side}-${medium}`,
              name: { en: `${side}-${medium}` },
              kind: 'military-unit',
              medium,
            })),
          ),
        ],
      },
      36,
    );
    expect(result.models).toBeLessThanOrEqual(36);
    expect(result.armies.slice(0, 2).map((army) => army.models)).toEqual([3, 4]);
    expect(result.armies.slice(0, 2).every((army) => army.soldiersPerModel === 1)).toBe(true);
    expect(
      result.armies
        .slice(0, 2)
        .map(
          (army) =>
            Array.from({ length: army.models }, (_, i) => unitLossState(army, i, 1)).filter(
              (state) => state !== 'active',
            ).length,
        ),
    ).toEqual([1, 4]);
    for (const army of result.armies.slice(2)) {
      expect(army.models).toBeGreaterThan(0);
      expect(army.models).toBeLessThanOrEqual(10);
      expect(army.symbolic).toBe(true);
      expect(army.soldiersPerModel).toBeUndefined();
      expect(unitLossState(army, 0, 1)).toBe('active');
    }
  });
  it('preserves documented ship scale before expanding unknown groups in another medium', () => {
    const participants = ['a', 'b'].flatMap((sideId) => [
      {
        id: `${sideId}-ships`,
        name: { en: `${sideId} ships` },
        kind: 'military-unit',
        sideId,
        medium: 'naval' as const,
        strength: [{ value: 12, counts: 'ships', scope: 'participant', renderable: true }],
      },
      {
        id: `${sideId}-air`,
        name: { en: `${sideId} aviation` },
        kind: 'military-unit',
        sideId,
        medium: 'air' as const,
        strength: [],
      },
    ]);
    const battle = {
      id: 'Q1',
      name: { en: 'Known fleets and unknown aviation' },
      medium: 'naval' as const,
      totals: {},
      participants,
    };
    const mobile = buildBattleSimulation(battle, 36);
    expect(mobile.armies.map((army) => army.models)).toEqual([12, 6, 12, 6]);
    expect(
      mobile.armies.filter((army) => army.medium === 'naval').map((army) => army.soldiersPerModel),
    ).toEqual([1, 1]);
    for (const budget of [0, 1, 2, 3, 4, 8, 26, 36, 80]) {
      const result = buildBattleSimulation(battle, budget);
      expect(result.models).toBeLessThanOrEqual(budget);
      expect(result.armies.every((army) => Number.isInteger(army.models) && army.models >= 0)).toBe(
        true,
      );
      if (budget >= 4) expect(result.armies.every((army) => army.models > 0)).toBe(true);
      for (const army of result.armies.filter((army) => army.medium === 'air')) {
        expect(army.symbolic).toBe(true);
        expect(army.models).toBeLessThanOrEqual(10);
        expect(army.strength).toBeUndefined();
        expect(army.soldiersPerModel).toBeUndefined();
      }
    }
  });
  it('keeps the model cap even when many forces fall below its resolution', () => {
    const armies = Array.from({ length: 9 }, (_, index) => ({ id: String(index), strength: 10 }));
    armies.push({ id: 'large', strength: 100_000 });
    const allocated = allocateBattleModels(armies, 20, 1000);
    expect(allocated.every((army) => army.models >= 1)).toBe(true);
    expect(allocated.reduce((sum, army) => sum + army.models, 0)).toBe(20);
  });
  it('never turns human participants or unsourced quantities into fighting armies', () => {
    const simulation = buildBattleSimulation(
      {
        id: 'Q1',
        name: { en: 'Example' },
        medium: 'land',
        participants: [
          { id: 'Q2', name: { en: 'Commander' }, kind: 'person', strength: [] },
          {
            id: 'Q3',
            name: { en: 'Polity' },
            kind: 'polity',
            strength: [
              { value: 1000, renderable: false, counts: 'soldiers', scope: 'participant' },
            ],
          },
        ],
        totals: {},
      },
      60,
    );
    expect(simulation.armies).toHaveLength(1);
    expect(simulation.armies[0]).toMatchObject({ id: 'Q3', models: 10, symbolic: true });
    expect(simulation.armies[0].strength).toBeUndefined();
    expect(simulation.armies[0].soldiersPerModel).toBeUndefined();
    expect(simulation.armies[0].profileId).toBeUndefined();
    expect(simulation.armies[0].sideId).toBeUndefined();
    expect(simulation.hasOpposingSides).toBe(false);
  });
  it('does not redistribute aggregate battle losses or confuse personnel with ship counts', () => {
    const simulation = buildBattleSimulation(
      {
        id: 'Q1',
        name: { en: 'Example' },
        medium: 'naval',
        participants: [
          {
            id: 'Q3',
            name: { en: 'Fleet' },
            kind: 'military-unit',
            strength: [{ value: 1000, renderable: true, counts: 'soldiers', scope: 'participant' }],
          },
        ],
        totals: { deaths: [{ value: 500, renderable: true, counts: 'people', scope: 'total' }] },
      },
      30,
    );
    expect(simulation.armies[0]).toMatchObject({ models: 10, symbolic: true });
    expect(simulation.armies[0].deaths).toBeUndefined();
  });
  it('animates only evidenced loss ratios and never adds deaths to total casualties', () => {
    const army = { id: 'A', models: 20, strength: 1000, casualties: 300, deaths: 100 };
    const losses = Array.from({ length: 20 }, (_, index) => unitLossState(army, index, 1));
    expect(losses.filter((state) => state === 'dead')).toHaveLength(2);
    expect(losses.filter((state) => state === 'withdrawn')).toHaveLength(4);
    expect(unitLossState({ ...army, strength: undefined }, 0, 1)).toBe('active');
    expect(unitLossState({ ...army, casualties: 2000, deaths: undefined }, 0, 1)).toBe('active');
    expect(unitLossState(army, 0, 0)).toBe('active');
  });
  it('reports continuous loss shares even when no complete figurine is lost', () => {
    expect(typeof armyLossShares).toBe('function');
    const army = { strength: 150, deaths: 17 };
    expect(armyLossShares(army, 1)).toEqual({ deaths: 17 / 150, withdrawn: 0 });
    expect(armyLossShares(army, 0.6).deaths).toBeCloseTo(17 / 300);
    expect(unitLossState({ ...army, models: 1 }, 0, 1)).toBe('active');
    expect(armyLossShares({ strength: 1000, deaths: 100, casualties: 300 }, 1)).toEqual({
      deaths: 0.1,
      withdrawn: 0.3 - 0.1,
    });
  });
  it('keeps loss shares bounded, reversible and consistent with incomplete observations', () => {
    expect(typeof armyLossShares).toBe('function');
    const army = { strength: 1000, deaths: 100, casualties: 300 };
    for (const progress of [-Infinity, -1, 0, 0.2, NaN])
      expect(armyLossShares(army, progress)).toEqual({ deaths: 0, withdrawn: 0 });
    expect(armyLossShares(army, 5)).toEqual(armyLossShares(army, 1));
    expect(armyLossShares(army, Infinity)).toEqual(armyLossShares(army, 1));
    expect(armyLossShares(army, 0.6).deaths).toBeCloseTo(0.05);
    expect(armyLossShares(army, 0.6).withdrawn).toBeCloseTo(0.1);
    expect(armyLossShares(army, 0)).toEqual({ deaths: 0, withdrawn: 0 });
    for (const strength of [undefined, NaN, Infinity, 0, -5])
      expect(armyLossShares({ ...army, strength }, 1)).toEqual({ deaths: 0, withdrawn: 0 });
    expect(armyLossShares({ ...army, casualties: 50 }, 1)).toEqual({ deaths: 0.1, withdrawn: 0 });
    expect(armyLossShares({ ...army, casualties: 1001 }, 1)).toEqual({ deaths: 0.1, withdrawn: 0 });
    expect(armyLossShares({ ...army, deaths: 1001 }, 1)).toEqual({ deaths: 0, withdrawn: 0 });
    expect(armyLossShares({ ...army, deaths: NaN }, 1)).toEqual({ deaths: 0, withdrawn: 0 });
    expect(armyLossShares({ ...army, deaths: undefined }, 1)).toEqual({
      deaths: 0,
      withdrawn: 0.3,
    });
    expect(armyLossShares({ ...army, deaths: -1 }, 1)).toEqual({ deaths: 0, withdrawn: 0.3 });
  });
  it('rounds deaths and all casualties separately rather than rounding withdrawals independently', () => {
    const army = { models: 3, strength: 100, deaths: 10, casualties: 50 };
    const states = [0, 1, 2].map((index) => unitLossState(army, index, 1));
    expect(states).toEqual(['withdrawn', 'withdrawn', 'active']);
    expect(
      [0, 1, 2].map((index) => unitLossState({ ...army, deaths: 50, casualties: 67 }, index, 1)),
    ).toEqual(['dead', 'dead', 'active']);
    // A ratio-first multiplication can turn the exact 14.5 threshold into
    // 14.499999999999998 and silently remove a casualty after this refactor.
    const threshold = { models: 25, strength: 100, deaths: 22, casualties: 58 };
    const thresholdStates = Array.from({ length: 25 }, (_, index) =>
      unitLossState(threshold, index, 1),
    );
    expect(thresholdStates.filter((state) => state === 'dead')).toHaveLength(6);
    expect(thresholdStates.filter((state) => state === 'withdrawn')).toHaveLength(9);
  });
  it('keeps formations deterministic across rerenders and disjoint between armies', () => {
    const armies = [
      { id: 'A', models: 4, sideId: 'one' },
      { id: 'B', models: 8, sideId: 'two' },
    ];
    const first = formationPositions(armies);
    expect(formationPositions(armies)).toEqual(first);
    expect(first).toHaveLength(12);
    expect(new Set(first.map((unit) => unit.id)).size).toBe(12);
    expect(first.filter((unit) => unit.armyId === 'A').every((unit) => unit.x < 0)).toBe(true);
    expect(first.filter((unit) => unit.armyId === 'B').every((unit) => unit.x > 0)).toBe(true);
    const fleet = formationPositions(armies, 'naval');
    const firstFleet = fleet.filter((unit) => unit.armyId === 'A');
    for (let a = 0; a < firstFleet.length; a++)
      for (let b = a + 1; b < firstFleet.length; b++) {
        expect(
          Math.hypot(firstFleet[a].x - firstFleet[b].x, firstFleet[a].z - firstFleet[b].z),
        ).toBeGreaterThan(5);
      }
  });
  it('brings melee formations into contact while preserving room for cavalry and ranged units', () => {
    const front = formationPositions([
      { id: 'A', models: 1, sideId: 'one' },
      { id: 'B', models: 1, sideId: 'two' },
    ]);
    const distance = (role: 'infantry' | 'cavalry' | 'ranged' | 'artillery') => {
      const advance = unitAdvanceDistance('land', role, 0.3, true);
      const positions = front.map((unit) => unit.x - unit.side * advance);
      return Math.abs(positions[1] - positions[0]);
    };
    expect(distance('infantry')).toBe(2);
    expect(distance('cavalry')).toBe(4);
    expect(distance('ranged')).toBe(10);
    expect(distance('artillery')).toBe(10);
    expect(unitAdvanceDistance('land', 'infantry', 0, true)).toBe(0);
    expect(unitAdvanceDistance('land', 'infantry', 0.15, true)).toBe(5.5);
    expect(unitAdvanceDistance('land', 'infantry', 1, true)).toBe(11);
    expect(unitAdvanceDistance('land', 'infantry', 1, false)).toBe(0);
    expect(unitAdvanceDistance('naval', 'ship', 1, true)).toBe(7);
    expect(unitAdvanceDistance('air', 'aircraft', 1, true)).toBe(7);
  });
});
