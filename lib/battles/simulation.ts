import type { LocalizedName } from '../types';
import type { BattleMedium, UnitRole } from './units';

/** Undated/unlocated records remain in the catalogue but cannot anchor a reconstruction. */
export function battleOccursInYear(
  battle: { coords?: [number, number]; start?: { year: number }; end?: { year: number } },
  year: number,
): boolean {
  if (!battle.coords || !battle.start || !Number.isFinite(year)) return false;
  const [longitude, latitude] = battle.coords;
  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return false;
  const end = battle.end?.year ?? battle.start.year;
  return year >= battle.start.year && year <= end;
}

type Quantity = {
  value: number;
  counts: string;
  scope: string;
  renderable: boolean;
};
type Quantities = {
  strength?: readonly Quantity[];
  casualties?: readonly Quantity[];
  deaths?: readonly Quantity[];
};
type Participant = Quantities & {
  id: string;
  name: LocalizedName;
  kind: string;
  sideId?: string;
  profileId?: string;
  equipmentIdentity?: { polityId: string };
  medium?: BattleMedium;
};
export type BattleSimulationInput = {
  id: string;
  name: LocalizedName;
  medium: BattleMedium;
  profileId?: string;
  participants: readonly Participant[];
  totals: Quantities;
};
export type SimulationArmy = {
  id: string;
  name: LocalizedName;
  participantId?: string;
  sideId?: string;
  profileId?: string;
  equipmentPolityId?: string;
  medium: BattleMedium;
  strength?: number;
  casualties?: number;
  deaths?: number;
  models: number;
  soldiersPerModel?: number;
  symbolic: boolean;
};
export type BattleSimulation = {
  armies: SimulationArmy[];
  hasOpposingSides: boolean;
  models: number;
};

/** Known armies share a population scale; unknown armies get unscaled illustrative groups. */
export function allocateBattleModels(
  armies: readonly { id: string; strength?: number }[],
  budget: number,
  referencePerModel = 1,
): { id: string; models: number; soldiersPerModel?: number }[] {
  const limit = Number.isFinite(budget) ? Math.max(0, Math.floor(budget)) : 0;
  const known = (army: (typeof armies)[number]) =>
    army.strength !== undefined && Number.isFinite(army.strength) && army.strength >= 0;
  const unknownCount = armies.filter((army) => !known(army)).length;
  const nonemptyCount = armies.filter((army) => known(army) && army.strength! > 0).length;
  const knownTotal = armies.reduce((total, army) => total + (known(army) ? army.strength! : 0), 0);
  const reference = Number.isFinite(referencePerModel) ? Math.max(1, referencePerModel) : 1;
  const desiredKnown = Math.min(
    Math.floor(knownTotal),
    Math.max(nonemptyCount, Math.ceil(knownTotal / reference)),
  );
  // Keep one illustrative figure per unknown force when capacity permits, then
  // preserve the documented forces' reference scale before expanding unknown
  // groups. Otherwise a few known ships could be reduced to one per camp while
  // unquantified formations occupy most of a mobile scene.
  const minimumUnknown = Math.min(unknownCount, Math.max(0, limit - nonemptyCount));
  const reservedKnown = Math.min(desiredKnown, limit - minimumUnknown);
  const unknownBudget = Math.min(unknownCount * 10, Math.max(0, limit - reservedKnown));
  const unknownPerArmy = unknownCount ? Math.floor(unknownBudget / unknownCount) : 0;
  let extraUnknown = unknownCount ? unknownBudget % unknownCount : 0;
  const available = limit - unknownBudget;
  const target = Math.min(available, desiredKnown);
  const scale = target > 0 ? knownTotal / target : undefined;
  const rows = armies.map((army, index) => {
    if (!known(army))
      return {
        id: army.id,
        models: unknownPerArmy + (extraUnknown-- > 0 ? 1 : 0),
        index,
        remainder: 0,
      };
    const ideal = scale ? army.strength! / scale : 0;
    return {
      id: army.id,
      models: Math.floor(ideal),
      soldiersPerModel: scale,
      index,
      remainder: ideal - Math.floor(ideal),
    };
  });
  let remaining =
    target - rows.reduce((sum, row, index) => sum + (known(armies[index]) ? row.models : 0), 0);
  for (const row of [...rows]
    .filter((row) => known(armies[row.index]) && armies[row.index].strength! > 0)
    .sort((a, b) => b.remainder - a.remainder || a.id.localeCompare(b.id))) {
    if (remaining-- <= 0) break;
    row.models += 1;
  }
  // A small documented opponent must remain visible. Move a representative from
  // the least-underrepresented donor; the UI discloses counts below this scale.
  if (target >= nonemptyCount && scale) {
    for (const row of rows) {
      if (!known(armies[row.index]) || !armies[row.index].strength || row.models > 0) continue;
      const donor = rows
        .filter((other) => known(armies[other.index]) && other.models > 1)
        .sort(
          (a, b) =>
            b.models -
              armies[b.index].strength! / scale -
              (a.models - armies[a.index].strength! / scale) || a.id.localeCompare(b.id),
        )[0];
      if (donor) {
        donor.models--;
        row.models++;
      }
    }
  }
  return rows.map(({ id, models, soldiersPerModel }) =>
    soldiersPerModel === undefined ? { id, models } : { id, models, soldiersPerModel },
  );
}

/** Conflicting, unscoped or non-comparable quantities cannot determine a formation size. */
function quantity(
  values: readonly Quantity[] | undefined,
  scope: string,
  counts: readonly string[],
): number | undefined {
  const accepted = (values ?? []).filter(
    (item) =>
      item.renderable &&
      item.scope === scope &&
      counts.includes(item.counts) &&
      Number.isFinite(item.value) &&
      item.value >= 0,
  );
  const distinct = [...new Set(accepted.map((item) => item.value))];
  return distinct.length === 1 ? distinct[0] : undefined;
}

export function buildBattleSimulation(
  battle: BattleSimulationInput,
  budget = 80,
): BattleSimulation {
  const counts = (medium: BattleMedium) =>
    medium === 'naval' ? ['ships'] : medium === 'air' ? ['aircraft'] : ['soldiers'];
  const participants = battle.participants.filter(
    (participant) => participant.kind === 'polity' || participant.kind === 'military-unit',
  );
  const base = participants.length
    ? participants.map((participant) => ({
        id: participant.id,
        name: participant.name,
        participantId: participant.id,
        sideId: participant.sideId,
        profileId: participant.profileId,
        equipmentPolityId: participant.equipmentIdentity?.polityId,
        medium: participant.medium ?? battle.medium,
        strength: quantity(
          participant.strength,
          'participant',
          counts(participant.medium ?? battle.medium),
        ),
        casualties: quantity(
          participant.casualties,
          'participant',
          counts(participant.medium ?? battle.medium),
        ),
        deaths: quantity(
          participant.deaths,
          'participant',
          counts(participant.medium ?? battle.medium),
        ),
      }))
    : [
        {
          id: `${battle.id}-total`,
          name: battle.name,
          medium: battle.medium,
          profileId: battle.profileId,
          strength: quantity(battle.totals.strength, 'total', counts(battle.medium)),
          casualties: quantity(battle.totals.casualties, 'total', counts(battle.medium)),
          deaths: quantity(battle.totals.deaths, 'total', counts(battle.medium)),
        },
      ];
  // One shared reference density makes small battles visibly smaller. Large
  // engagements retain a disclosed common scale when the device budget is reached.
  const media = [...new Set(base.map((army) => army.medium))];
  const reference = (medium: BattleMedium) => (medium === 'land' ? 1000 : 1);
  // Device capacity is apportioned in miniature counts, never by adding people
  // to ships. Each medium then receives its own shared historical quantity scale.
  const quotas =
    media.length > 1
      ? allocateBattleModels(
          base.map((army) => ({
            id: army.id,
            strength:
              army.strength === undefined
                ? undefined
                : Math.ceil(army.strength / reference(army.medium)),
          })),
          budget,
        )
      : [];
  const allocation = new Map(
    media.flatMap((medium) => {
      const cohort = base.filter((army) => army.medium === medium);
      const cohortBudget =
        media.length === 1
          ? budget
          : quotas.reduce(
              (sum, quota, index) => sum + (base[index].medium === medium ? quota.models : 0),
              0,
            );
      return allocateBattleModels(cohort, cohortBudget, reference(medium)).map(
        (row) => [row.id, row] as const,
      );
    }),
  );
  const armies: SimulationArmy[] = base.map((army) => ({
    ...army,
    ...allocation.get(army.id)!,
    symbolic: army.strength === undefined,
  }));
  return {
    armies,
    hasOpposingSides: new Set(armies.map((army) => army.sideId).filter(Boolean)).size >= 2,
    models: armies.reduce((total, army) => total + army.models, 0),
  };
}

/** Comparisons require opposing camps and a common unit (people, ships or aircraft). */
export function hasComparableOpposingForces(battle: BattleSimulationInput): boolean {
  const { armies } = buildBattleSimulation(battle, 0);
  return (['land', 'naval', 'air'] as const).some(
    (medium) =>
      new Set(
        armies.flatMap((army) =>
          army.medium === medium && army.sideId && army.strength !== undefined ? [army.sideId] : [],
        ),
      ).size >= 2,
  );
}

export type FormationUnit = {
  id: string;
  armyId: string;
  index: number;
  x: number;
  z: number;
  heading: number;
  phase: number;
  side: -1 | 0 | 1;
};

function stableFraction(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++)
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0) / 0x1_0000_0000;
}

/** Illustrative local formations, never invented geographic troop positions or attack routes. */
export function formationPositions(
  armies: readonly { id: string; models: number; sideId?: string; medium?: BattleMedium }[],
  medium: 'land' | 'naval' | 'air' = 'land',
): FormationUnit[] {
  const sides = [
    ...new Set(armies.map((army) => army.sideId).filter((id): id is string => Boolean(id))),
  ];
  return armies.flatMap((army, armyIndex) => {
    const unitMedium = army.medium ?? medium;
    const spacing = unitMedium === 'land' ? 1 : unitMedium === 'naval' ? 2.8 : 2.5;
    const side =
      sides.length >= 2 && army.sideId ? (sides.indexOf(army.sideId) % 2 === 0 ? -1 : 1) : 0;
    const colleagues = armies.filter((other) => other.sideId === army.sideId);
    const groupIndex = colleagues.findIndex((other) => other.id === army.id);
    const columns = Math.max(1, Math.ceil(Math.sqrt(army.models)));
    return Array.from({ length: army.models }, (_, index) => {
      const id = `${army.id}-${index}`;
      const column = index % columns;
      const row = Math.floor(index / columns);
      const spread = (column - (columns - 1) / 2) * 2.2;
      return {
        id,
        armyId: army.id,
        index,
        x:
          (side ? side * (12 + row * 2.8) : spread + (armyIndex - (armies.length - 1) / 2) * 15) *
          spacing,
        z: (side ? spread + (groupIndex - (colleagues.length - 1) / 2) * 20 : row * 2.8) * spacing,
        heading: side ? (-side * Math.PI) / 2 : 0,
        phase: stableFraction(id),
        side,
      };
    });
  });
}

/** Visual weapon reach, not a claim about historical deployment or engagement distance. */
export function unitAdvanceDistance(
  medium: 'land' | 'naval' | 'air',
  role: UnitRole | undefined,
  progress: number,
  opposingSides: boolean,
): number {
  if (!opposingSides || !Number.isFinite(progress)) return 0;
  const approach = Math.max(0, Math.min(1, progress / 0.3));
  if (medium !== 'land') return approach * 7;
  const distance = role === 'infantry' ? 11 : role === 'cavalry' ? 10 : role === 'chariot' ? 9 : 7;
  return approach * distance;
}

function lossProgress(progress: number): number {
  return Math.max(0, Math.min(1, (progress - 0.2) / 0.8));
}

/** Continuous losses for both the illustrated scene and its numerical indicators. */
export function armyLossShares(
  army: { strength?: number; casualties?: number; deaths?: number },
  progress: number,
): { deaths: number; withdrawn: number } {
  if (
    !army.strength ||
    army.strength < 0 ||
    !Number.isFinite(army.strength) ||
    progress <= 0 ||
    Number.isNaN(progress)
  )
    return { deaths: 0, withdrawn: 0 };
  const ratio = lossProgress(progress);
  const eligible = (number: number | undefined) =>
    number !== undefined && Number.isFinite(number) && number >= 0 && number <= army.strength!;
  const deaths = eligible(army.deaths) ? (army.deaths! / army.strength) * ratio : 0;
  const totalLosses =
    eligible(army.casualties) && (army.deaths === undefined || army.casualties! >= army.deaths)
      ? (army.casualties! / army.strength) * ratio
      : deaths;
  return { deaths, withdrawn: totalLosses - deaths };
}

/** Deaths are a subset of casualties; preserve separate rounding of deaths and total losses. */
export function unitLossState(
  army: { models: number; strength?: number; casualties?: number; deaths?: number },
  index: number,
  progress: number,
): 'active' | 'withdrawn' | 'dead' {
  const shares = armyLossShares(army, progress);
  // Shares determine which observations are usable. Retain the original
  // multiply-then-divide order for integer poses: 25 * 58 / 100 is exactly
  // 14.5, whereas 25 * (58 / 100) falls just below that rounding boundary.
  const rounded = (share: number, observation: number | undefined) =>
    share > 0
      ? Math.round(((army.models * observation!) / army.strength!) * lossProgress(progress))
      : 0;
  const deaths = rounded(shares.deaths, army.deaths);
  const totalLosses = rounded(
    shares.deaths + shares.withdrawn,
    shares.withdrawn > 0 ? army.casualties : army.deaths,
  );
  if (index < deaths) return 'dead';
  if (index < totalLosses) return 'withdrawn';
  return 'active';
}
