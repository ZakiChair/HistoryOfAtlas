import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BattleIndexSchema, BattleRecordSchema, type BattleRecord } from '../../lib/battles/schema';
import {
  battleOccursInYear,
  buildBattleSimulation,
  hasComparableOpposingForces,
  unitLossState,
} from '../../lib/battles/simulation';
import { getUnitProfile, resolveUnitProfile, UNIT_ANALOGIES } from '../../lib/battles/units';

// These are the focused scene budgets used by the map layer, not arbitrary
// high-budget projections of what could theoretically become visible.
const BUDGETS = { desktop: 80, mobile: 36 } as const;

export function assessBattleReadiness(record: BattleRecord) {
  const simulation = buildBattleSimulation(record, BUDGETS.desktop);
  const year = record.start?.year;
  const mappable = year !== undefined && battleOccursInYear(record, year);
  const sides = new Set(simulation.armies.flatMap((army) => (army.sideId ? [army.sideId] : [])));
  const profiles = simulation.armies.map((army) =>
    resolveUnitProfile({
      profileId: army.profileId,
      participantId: army.participantId,
      equipmentPolityId: army.equipmentPolityId,
      year: year ?? NaN,
      medium: army.medium,
    }),
  );
  const classified = profiles.map(
    (profile) => profile.dateCompatible && profile.id !== 'unclassified-unit',
  );
  const attributed = profiles.map(
    (profile, index) =>
      classified[index] &&
      (profile.evidence === 'documented-profile' ||
        Boolean(profile.polityIds?.includes(simulation.armies[index].participantId ?? '')) ||
        UNIT_ANALOGIES.some(
          (rule) =>
            rule.profileId === profile.id &&
            rule.participantIds.includes(simulation.armies[index].participantId ?? '') &&
            year !== undefined &&
            year >= rule.dateRange[0] &&
            year <= rule.dateRange[1],
        )),
  );
  const requestedProfileDateMismatches = simulation.armies.filter((army) => {
    const requested = getUnitProfile(army.profileId);
    return (
      requested &&
      year !== undefined &&
      (year < requested.dateRange[0] || year > requested.dateRange[1])
    );
  }).length;
  const classifiedArmies = classified.filter(Boolean).length;
  const incompatibleArmies = profiles.filter((profile) => !profile.dateCompatible).length;
  const equipment =
    year === undefined
      ? 'missing-date'
      : incompatibleArmies === profiles.length
        ? 'date-incompatible'
        : classifiedArmies === profiles.length
          ? 'complete'
          : classifiedArmies
            ? 'partial'
            : 'unknown';
  const eligibleLosses = simulation.armies.map((army) => {
    if (army.strength === undefined || army.strength <= 0) return false;
    const eligible = (value: number | undefined) =>
      value !== undefined && value >= 0 && value <= army.strength!;
    return (
      eligible(army.deaths) ||
      (eligible(army.casualties) && (army.deaths === undefined || army.casualties! >= army.deaths))
    );
  });
  const lossSides = new Set(
    simulation.armies.flatMap((army, index) =>
      eligibleLosses[index] && army.sideId ? [army.sideId] : [],
    ),
  );
  const allArmiesQuantified = simulation.armies.every((army) => army.strength !== undefined);
  const allCampsWithCompatibleLossEvidence =
    sides.size >= 2 && [...sides].every((side) => lossSides.has(side));
  const visibleLosses = { desktop: 0, mobile: 0 };
  const campsWithVisibleLosses = { desktop: 0, mobile: 0 };
  for (const device of ['desktop', 'mobile'] as const) {
    const deviceSimulation = buildBattleSimulation(record, BUDGETS[device]);
    const visibleSides = new Set<string>();
    for (const army of deviceSimulation.armies) {
      const profile = resolveUnitProfile({
        profileId: army.profileId,
        participantId: army.participantId,
        equipmentPolityId: army.equipmentPolityId,
        year: year ?? NaN,
        medium: army.medium,
      });
      if (!profile.dateCompatible) continue;
      let losses = 0;
      for (let index = 0; index < army.models; index++)
        if (unitLossState(army, index, 1) !== 'active') losses++;
      visibleLosses[device] += losses;
      if (losses && army.sideId) visibleSides.add(army.sideId);
    }
    campsWithVisibleLosses[device] = visibleSides.size;
  }
  const hasAnyLossEvidence = ['deaths', 'casualties'].some((field) => {
    const key = field as 'deaths' | 'casualties';
    return (
      record.totals[key].length ||
      record.unassigned?.[key].length ||
      record.participants.some((participant) => participant[key].length)
    );
  });
  const comparableOpposingForces = hasComparableOpposingForces(record);
  const allEquipmentAttributed = attributed.every(Boolean);
  const fullEvidenceCombination =
    mappable &&
    simulation.hasOpposingSides &&
    comparableOpposingForces &&
    allArmiesQuantified &&
    equipment === 'complete' &&
    allEquipmentAttributed &&
    eligibleLosses.every(Boolean);
  return {
    id: record.id,
    year: year ?? null,
    medium: record.medium,
    mappable,
    coordinateKind: record.coordinateSource?.kind ?? (record.coords ? 'unspecified' : null),
    armies: simulation.armies.length,
    identifiedArmies: simulation.armies.filter((army) => army.participantId).length,
    identifiedCamps: sides.size,
    opposingCamps: simulation.hasOpposingSides,
    comparableOpposingForces,
    armiesWithKnownStrength: simulation.armies.filter((army) => army.strength !== undefined).length,
    allArmiesQuantified,
    hasAnyLossEvidence,
    armiesWithCompatibleLossEvidence: eligibleLosses.filter(Boolean).length,
    allCampsWithCompatibleLossEvidence,
    visibleLosses,
    campsWithVisibleLosses,
    equipment,
    classifiedArmies,
    incompatibleArmies,
    requestedProfileDateMismatches,
    attributedEquipmentArmies: attributed.filter(Boolean).length,
    allEquipmentAttributed,
    profiles: [...new Set(profiles.map((profile) => profile.id))],
    modelUrls: [
      ...new Set(
        profiles.filter((profile) => profile.dateCompatible).map((profile) => profile.modelUrl),
      ),
    ],
    fullEvidenceCombination,
    fullCombination: fullEvidenceCombination && campsWithVisibleLosses.desktop === sides.size,
    fullCombinationMobile: fullEvidenceCombination && campsWithVisibleLosses.mobile === sides.size,
  };
}

export async function writeBattleReadinessReport() {
  const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
  const input = join(root, 'public/data/battles');
  const sourcePaths = [
    'public/data/battles/index.json',
    'data/curated/battle-profiles.json',
    'data/curated/battle-cdb90-profiles.json',
    'data/curated/battle-cdb90-source.json',
    'data/curated/battle-cdb90-matches.json',
    'data/curated/battle-equipment.json',
    'data/curated/battle-metadata.json',
    'data/curated/battle-inclusions.json',
    'pipeline/battles/inclusions.ts',
    'lib/battles/schema.ts',
    'lib/battles/simulation.ts',
    'lib/battles/units.ts',
    'pipeline/battles/readiness.ts',
    'pipeline/battles/profiles.ts',
    'pipeline/battles/metadata.ts',
  ];
  const hashSource = async (path: string) =>
    createHash('sha256')
      .update(await readFile(join(root, path)))
      .digest('hex');
  const sourceHashes: Record<string, string> = {};
  for (const path of sourcePaths) sourceHashes[path] = await hashSource(path);
  const index = BattleIndexSchema.parse(
    JSON.parse(await readFile(join(input, 'index.json'), 'utf8')),
  );
  const records: ReturnType<typeof assessBattleReadiness>[] = [];
  const corpusDigest = createHash('sha256');
  for (const entry of index.battles) {
    const raw = await readFile(join(input, 'events', `${entry.id}.json`), 'utf8');
    corpusDigest.update(entry.id).update('\0').update(raw).update('\0');
    const record = BattleRecordSchema.parse(JSON.parse(raw));
    if (record.id !== entry.id) throw new Error(`Wrong battle record: ${entry.id}`);
    records.push(assessBattleReadiness(record));
  }
  const modelUrls = [...new Set(records.flatMap((record) => record.modelUrls))].sort();
  const missingModels: string[] = [];
  for (const url of modelUrls) {
    try {
      if (!(await stat(join(root, 'public', url))).isFile()) missingModels.push(url);
    } catch {
      missingModels.push(url);
    }
  }
  const count = (predicate: (record: (typeof records)[number]) => boolean) =>
    records.filter(predicate).length;
  const equipment: Record<string, number> = {};
  for (const record of records)
    equipment[record.equipment] = (equipment[record.equipment] ?? 0) + 1;
  for (const path of sourcePaths)
    if ((await hashSource(path)) !== sourceHashes[path])
      throw new Error(`Audit input changed while scanning battles: ${path}`);
  const report = {
    version: 1,
    kind: 'animation-data-readiness-audit',
    status: 'audited',
    generatedAt: new Date().toISOString(),
    sourceHashes,
    corpusSha256: corpusDigest.digest('hex'),
    focusedModelBudgets: BUDGETS,
    definitions: {
      mappable: 'The runtime date/location gate accepts the battle in its starting year.',
      comparableOpposingForces:
        'At least two documented camps each contain a force with a reviewed strength in the same medium and count unit. Ships, soldiers and aircraft are never compared numerically. Other forces may remain unknown.',
      allArmiesQuantified:
        'Every simulation army, including supplements, has a compatible known strength.',
      compatibleLossEvidence:
        'A per-army death/casualty count has the matching unit and scope, and is within the strength. Source totals are never divided among armies.',
      visibleLosses:
        'Number of models whose runtime unitLossState at progress 1 is dead or withdrawn, at each focused scene budget; not a claim that the browser rendered them.',
      equipmentComplete:
        'Every represented army resolves to a typed, date-compatible profile. This does not establish every weapon, contingent or historical uniform.',
      attributedEquipment:
        'The selected profile has explicit reviewed assignment or a participant/date rule; generic naval/air technology fallbacks do not establish a civilization.',
      fullEvidenceCombination:
        'Mappable, opposing camps, every army quantified, every army equipped with an attributed profile, and compatible loss evidence for every army.',
      fullCombination:
        'The full evidence combination additionally produces visible losses in every opposing camp at the desktop budget; fullCombinationMobile uses the mobile budget.',
    },
    counts: {
      total: records.length,
      mappable: count((record) => record.mappable),
      anyIdentifiedArmy: count((record) => record.identifiedArmies > 0),
      anyIdentifiedCamp: count((record) => record.identifiedCamps > 0),
      opposingCamps: count((record) => record.opposingCamps),
      comparableOpposingForces: count((record) => record.comparableOpposingForces),
      allArmiesQuantified: count((record) => record.allArmiesQuantified),
      anyLossEvidence: count((record) => record.hasAnyLossEvidence),
      anyCompatibleArmyLossEvidence: count((record) => record.armiesWithCompatibleLossEvidence > 0),
      allCampsWithCompatibleLossEvidence: count(
        (record) => record.allCampsWithCompatibleLossEvidence,
      ),
      anyVisibleLossesDesktop: count(
        (record) => record.mappable && record.visibleLosses.desktop > 0,
      ),
      anyVisibleLossesMobile: count((record) => record.mappable && record.visibleLosses.mobile > 0),
      equipment,
      anyAttributedEquipment: count((record) => record.attributedEquipmentArmies > 0),
      allEquipmentAttributed: count((record) => record.allEquipmentAttributed),
      anyRequestedProfileDateMismatch: count((record) => record.requestedProfileDateMismatches > 0),
    },
    combinations: {
      mappableOpposingCamps: count((record) => record.mappable && record.opposingCamps),
      mappableComparableForces: count(
        (record) => record.mappable && record.comparableOpposingForces,
      ),
      mappableComparableForcesCompleteEquipment: count(
        (record) =>
          record.mappable && record.comparableOpposingForces && record.equipment === 'complete',
      ),
      mappableComparableForcesAnyVisibleLosses: count(
        (record) =>
          record.mappable && record.comparableOpposingForces && record.visibleLosses.desktop > 0,
      ),
      fullEvidence: count((record) => record.fullEvidenceCombination),
      fullDesktop: count((record) => record.fullCombination),
      fullMobile: count((record) => record.fullCombinationMobile),
      fullDesktopWithModelFiles: count(
        (record) =>
          record.fullCombination && record.modelUrls.every((url) => !missingModels.includes(url)),
      ),
    },
    modelFiles: { referenced: modelUrls.length, missing: missingModels },
    limitations: [
      'This audit measures the published data and runtime selection logic, not historical exhaustiveness or visual correctness in a browser.',
      'Unknown numbers remain unknown. A symbolic formation does not establish army strength or belligerent sides.',
      'Equipment profiles represent typical units, not a complete order of battle or verified uniforms.',
      'Coordinates inherited from a source place are not surveyed battlefield positions.',
      'Model materials, formation geometry and casualty timing remain illustrative.',
    ],
    records,
  };
  const output = join(root, 'data/reports/battle-readiness.json');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report) + '\n');
  console.log(
    JSON.stringify({
      report: output,
      counts: report.counts,
      combinations: report.combinations,
      modelFiles: report.modelFiles,
    }),
  );
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await writeBattleReadinessReport();
