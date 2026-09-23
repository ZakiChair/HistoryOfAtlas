import { readFile, readdir, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  BattleIndexSchema,
  BattleRecordSchema,
  type BattleRecord,
  type BattleIndexEntry,
} from '../../lib/battles/schema';
import type { HistoricalEvent } from '../../lib/schema';
import {
  loadEntities,
  entityIds,
  values,
  sourceExclusion,
  label,
  type ClaimValue,
} from '../normalize';
import {
  normalizeBattle,
  entitySources,
  resolveBattleCoordinates,
  battleMedium,
} from './normalize';
import { hasComparableOpposingForces } from '../../lib/battles/simulation';
import { applyBattleEquipment, BattleEquipmentFileSchema } from './equipment';
import { loadBattleProfiles } from './profiles';
import { applyBattleMetadata, BattleMetadataFileSchema } from './metadata';
import { BattleInclusionsFileSchema, battleCandidateIds, reviewedBattleKind } from './inclusions';
import { publishDirectory } from '../build/publish';
import { classifyEra } from '../../lib/eras';
import { parseWikidataTime } from '../../lib/histdate';
import { validateChronology } from '../validate';
import { classifyRegion } from '../normalize/region';
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const rawDirectory = join(root, 'data/raw/wikidata');
const output = join(root, 'public/data/battles');
const staged = join(root, 'public/data/.battles-next');
const json = async (path: string, value: unknown) => writeFile(path, JSON.stringify(value) + '\n');
const entities = await loadEntities(rawDirectory);
const inclusions = BattleInclusionsFileSchema.parse(
  JSON.parse(await readFile(join(root, 'data/curated/battle-inclusions.json'), 'utf8')),
);
const discoveredCandidates = JSON.parse(
  await readFile(join(rawDirectory, 'candidate-ids.json'), 'utf8'),
) as string[];
const candidates = battleCandidateIds(discoveredCandidates, inclusions);
let acquisition: { status: string; candidateIdsSha256: string; completedAt: string } | undefined;
try {
  acquisition = JSON.parse(await readFile(join(rawDirectory, 'battle-acquisition.json'), 'utf8'));
} catch {
  /* A partial catalog remains useful while acquisition continues. */
}
const sourceDigest = createHash('sha256')
  .update(await readFile(join(rawDirectory, 'candidate-ids.json')))
  .digest('hex');
const unresolvedLinks = [
  ...new Set(
    candidates.flatMap((id) => {
      const entity = entities.get(id);
      return entity
        ? [...entityIds(entity, 'P276'), ...entityIds(entity, 'P710')].filter(
            (linked) => !entities.has(linked),
          )
        : [];
    }),
  ),
].sort();
const acquisitionComplete =
  acquisition?.status === 'complete' &&
  acquisition.candidateIdsSha256 === sourceDigest &&
  unresolvedLinks.length === 0;
const taxonomy = JSON.parse(await readFile(join(rawDirectory, 'taxonomy.json'), 'utf8')) as {
  results: { bindings: { class: { value: string }; root: { value: string } }[] };
};
const types = new Map<string, Set<string>>();
for (const row of taxonomy.results.bindings) {
  const id = row.class.value.split('/').pop()!;
  const roots = types.get(id) ?? new Set<string>();
  roots.add(row.root.value.split('/').pop()!);
  types.set(id, roots);
}
const land = JSON.parse(
  await readFile(join(root, 'data/raw/geography/ne_10m_land.geojson'), 'utf8'),
) as FeatureCollection<Polygon | MultiPolygon>;
const curated = await loadBattleProfiles(root);
const battles = new Map<string, BattleRecord>();
const equipment = BattleEquipmentFileSchema.parse(
  JSON.parse(await readFile(join(root, 'data/curated/battle-equipment.json'), 'utf8')),
);
for (const file of (await readdir(join(root, 'public/data/events'))).sort()) {
  const event = JSON.parse(
    await readFile(join(root, 'public/data/events', file), 'utf8'),
  ) as HistoricalEvent;
  if (['battle', 'siege', 'naval'].includes(event.type))
    battles.set(
      event.id,
      normalizeBattle(event, entities.get(event.id) ?? { id: event.id }, entities),
    );
}
const existingCount = battles.size;
const rejected: { id: string; reasons: string[] }[] = [];
const notFetched: string[] = [];
const candidateAudit: { id: string; classification: string; reasons?: string[] }[] = [];
const date = (value: ClaimValue | undefined) => {
  if (!value || typeof value !== 'object' || !value.time) return undefined;
  try {
    return parseWikidataTime(value.time, {
      precision: value.precision,
      calendar: value.calendarmodel,
      encoding: 'json',
    });
  } catch {
    return undefined;
  }
};
for (const id of candidates) {
  if (battles.has(id)) {
    if (inclusions.records[id])
      throw new Error(`Inclusion ${id} already exists in the original atlas`);
    candidateAudit.push({ id, classification: 'published-battle' });
    continue;
  }
  const entity = entities.get(id);
  if (!entity) {
    notFetched.push(id);
    candidateAudit.push({ id, classification: 'not-fetched' });
    continue;
  }
  const roots = entityIds(entity, 'P31').flatMap((classId) => [...(types.get(classId) ?? [])]);
  const kind = inclusions.records[id]
    ? reviewedBattleKind(entity, inclusions.records[id], types)
    : roots.includes('Q1261499')
      ? 'naval'
      : roots.includes('Q188055')
        ? 'siege'
        : roots.includes('Q178561') &&
            !roots.some((id) => ['Q831663', 'Q1361229', 'Q625298'].includes(id))
          ? 'battle'
          : undefined;
  if (!kind) {
    candidateAudit.push({ id, classification: 'outside-engagement-classes' });
    continue;
  }
  const excluded = sourceExclusion(entity);
  if (excluded) {
    rejected.push({ id, reasons: [excluded] });
    candidateAudit.push({ id, classification: 'excluded', reasons: [excluded] });
    continue;
  }
  const start = date(values(entity, 'P580')[0] ?? values(entity, 'P585')[0]);
  const end = date(values(entity, 'P582')[0]);
  const missing: string[] = [];
  if (!start)
    missing.push(
      values(entity, 'P580').length || values(entity, 'P585').length
        ? 'invalid-date'
        : 'missing-date',
    );
  else if (start.date.year < -3500 || start.date.year > new Date().getUTCFullYear())
    missing.push('outside-atlas-period');
  if (start && end) missing.push(...validateChronology(start.date, end.date, start.calendar));
  const location = resolveBattleCoordinates(entity, entities, battleMedium(entity, kind), land);
  const { coords, coordinateSource } = location;
  missing.push(...location.missing);
  const original = Object.entries(entity.labels ?? {}).find(([, item]) => item.value);
  const english = label(entity) ?? label(entity, 'fr') ?? original?.[1].value;
  if (!english) {
    rejected.push({ id, reasons: ['missing-label'] });
    candidateAudit.push({ id, classification: 'excluded', reasons: ['missing-label'] });
    continue;
  }
  const battle = normalizeBattle(
    {
      id,
      name: { en: english, ...(label(entity, 'fr') ? { fr: label(entity, 'fr') } : {}) },
      nameLanguage: label(entity) ? undefined : label(entity, 'fr') ? 'fr' : original?.[0],
      type: kind,
      start: start?.date,
      end: end?.date,
      coords,
      coordinateSource,
      region: coords ? classifyRegion(coords) : undefined,
      era: start ? classifyEra(start.date.year) : undefined,
      sources: [
        ...entitySources(entity),
        ...(coordinateSource?.kind === 'place'
          ? [
              {
                label: 'Wikidata · source of linked place coordinates',
                url: coordinateSource.url,
                license: 'CC0-1.0',
              },
            ]
          : []),
      ],
    },
    entity,
    entities,
  );
  if (missing.some((reason) => ['end-before-start', 'outside-atlas-period'].includes(reason)))
    delete battle.coords;
  if (missing.length) battle.missing = [...new Set(missing)];
  battles.set(id, battle);
  candidateAudit.push({
    id,
    classification:
      battle.start && battle.coords ? 'additional-mappable-battle' : 'unmapped-battle',
    ...(missing.length ? { reasons: battle.missing } : {}),
  });
}
for (const [id, patch] of Object.entries(curated.records)) {
  const battle = battles.get(id);
  if (!battle) throw new Error(`Curated battle ${id} is absent`);
  for (const previous of battle.participants) {
    const reviewed = patch.participants.find((participant) => participant.id === previous.id);
    for (const field of ['strength', 'deaths', 'casualties'] as const) {
      if (reviewed) reviewed[field].push(...previous[field]);
      else {
        battle.unassigned ??= { strength: [], deaths: [], casualties: [] };
        battle.unassigned[field].push(...previous[field]);
      }
    }
  }
  battle.participants = patch.participants;
  battle.note = patch.note;
  for (const field of ['strength', 'deaths', 'casualties'] as const) {
    battle.totals[field].unshift(...(patch.totals?.[field] ?? []));
    if (patch.unassigned?.[field].length) {
      battle.unassigned ??= { strength: [], deaths: [], casualties: [] };
      battle.unassigned[field].unshift(...patch.unassigned[field]);
    }
  }
  battle.sources = [
    ...battle.sources,
    ...patch.participants.flatMap((participant) => participant.sources),
    ...['strength', 'deaths', 'casualties']
      .flatMap((field) => [
        ...(patch.totals?.[field as keyof BattleRecord['totals']] ?? []),
        ...(patch.unassigned?.[field as keyof BattleRecord['totals']] ?? []),
      ])
      .flatMap((quantity) => quantity.sources),
  ].filter(
    (source, index, list) => list.findIndex((candidate) => candidate.url === source.url) === index,
  );
}
for (const [id, patch] of Object.entries(equipment.records)) {
  const battle = battles.get(id);
  if (!battle) throw new Error(`Equipment battle ${id} is absent`);
  applyBattleEquipment(battle, patch);
}
const metadata = BattleMetadataFileSchema.parse(
  JSON.parse(await readFile(join(root, 'data/curated/battle-metadata.json'), 'utf8')),
);
for (const [id, patch] of Object.entries(metadata.records)) {
  const battle = battles.get(id);
  if (!battle) throw new Error(`Metadata battle ${id} is absent`);
  applyBattleMetadata(battle, patch, metadata.reviewedAt, land);
  const audit = candidateAudit.find((candidate) => candidate.id === id);
  if (audit) {
    if (audit.classification !== 'published-battle')
      audit.classification =
        battle.start && battle.coords ? 'additional-mappable-battle' : 'unmapped-battle';
    if (battle.missing?.length) audit.reasons = battle.missing;
    else delete audit.reasons;
  }
}
for (const [id, review] of Object.entries(inclusions.records)) {
  const battle = battles.get(id);
  if (!battle) throw new Error(`Reviewed inclusion ${id} is absent`);
  battle.inclusionReview = { ...review, reviewedAt: inclusions.reviewedAt };
  battle.note = [battle.note, review.note].filter(Boolean).join(' ');
  battle.sources = [...battle.sources, ...review.sources].filter(
    (source, index, list) => list.findIndex((item) => item.url === source.url) === index,
  );
}
await rm(staged, { recursive: true, force: true });
await mkdir(join(staged, 'events'), { recursive: true });
const ordered = [...battles.values()].sort(
  (a, b) => (a.start?.year ?? Infinity) - (b.start?.year ?? Infinity) || a.id.localeCompare(b.id),
);
const index: BattleIndexEntry[] = [];
for (const battle of ordered) {
  const verified = BattleRecordSchema.parse(battle);
  await json(join(staged, 'events', `${battle.id}.json`), verified);
  const documented = hasComparableOpposingForces(battle);
  index.push({
    id: battle.id,
    name: battle.name,
    nameLanguage: battle.nameLanguage,
    type: battle.type,
    start: battle.start,
    end: battle.end,
    coords: battle.coords,
    region: battle.region,
    era: battle.era,
    medium: battle.medium,
    documented,
  });
}
const mappable = index.filter((entry) => entry.start && entry.coords).length;
const counts = {
  total: index.length,
  mappable,
  documented: index.filter((entry) => entry.documented).length,
  unmapped: index.length - mappable,
};
await json(
  join(staged, 'index.json'),
  BattleIndexSchema.parse({ version: 1, counts, battles: index, unmapped: counts.unmapped }),
);
await json(join(staged, 'candidates.json'), { version: 1, candidates: candidateAudit });
const reasonCounts: Record<string, number> = {};
for (const battle of ordered)
  for (const reason of battle.missing ?? []) reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
const withEvidence = (battle: BattleRecord, field: 'strength' | 'deaths' | 'casualties') =>
  battle.totals[field].length > 0 ||
  (battle.unassigned?.[field].length ?? 0) > 0 ||
  battle.participants.some((participant) => participant[field].length > 0);
const evidenceCoverage = {
  withParticipants: ordered.filter((battle) => battle.participants.length > 0).length,
  withStrengthEvidence: ordered.filter((battle) => withEvidence(battle, 'strength')).length,
  withDeathEvidence: ordered.filter((battle) => withEvidence(battle, 'deaths')).length,
  withCasualtyEvidence: ordered.filter((battle) => withEvidence(battle, 'casualties')).length,
  withComparableArmies: counts.documented,
  inheritedPlaceCoordinates: ordered.filter(
    (battle) => battle.coords && battle.coordinateSource?.kind === 'place',
  ).length,
};
await json(join(staged, 'coverage.json'), {
  version: 1,
  status: notFetched.length
    ? 'candidate-acquisition-incomplete'
    : acquisitionComplete
      ? 'all-cached-candidates-audited'
      : 'linked-acquisition-incomplete',
  acquisition,
  unresolvedLinks,
  candidates: candidates.length,
  discoveredCandidates: discoveredCandidates.length,
  cachedCandidates: candidates.length - notFetched.length,
  notFetched,
  existingMappedBattles: existingCount,
  ...counts,
  reasonCounts,
  rejected,
  reviewedParticipantProfiles: Object.keys(curated.records),
  reviewedMetadata: Object.keys(metadata.records),
  reviewedInclusions: Object.keys(inclusions.records),
  quantitativeEvidence: {
    rawCountsNotAutomaticallyTroops: true,
    reviewedBattles: index
      .filter((entry) => entry.documented && entry.id in curated.records)
      .map((entry) => entry.id),
    coverage: evidenceCoverage,
  },
  limitations: [
    'The catalog covers sourced Wikidata classes, not every battle that has ever occurred.',
    'Unknown dates and coordinates are retained as unknown and cannot animate on the map.',
    'Historical positions and movements are illustrative unless separately documented.',
    'Source quantities retain their unit, scope and uncertainty. People, ships and groups are not interchangeable.',
  ],
});
await publishDirectory(staged, output);
console.log(
  JSON.stringify({ ...counts, candidates: candidates.length, notFetched: notFetched.length }),
);
