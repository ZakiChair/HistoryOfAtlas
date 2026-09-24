import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { BattleIndexSchema, BattleRecordSchema } from '../../lib/battles/schema';
import { documentedBattleIds } from '../../lib/battles/documented';
import { loadBattleProfiles } from './profiles';
import { checkCdb90Artifacts } from './cdb90-check';
import { BattleMetadataFileSchema } from './metadata';
import { BattleInclusionsFileSchema, verifyBattleInclusion } from './inclusions';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
await checkCdb90Artifacts(root);
const output = join(root, 'public/data/battles');
const index = BattleIndexSchema.parse(
  JSON.parse(await readFile(join(output, 'index.json'), 'utf8')),
);
const coverage = JSON.parse(await readFile(join(output, 'coverage.json'), 'utf8')) as {
  notFetched: string[];
  status: string;
  candidates: number;
  total: number;
  mappable: number;
  documented: number;
  unmapped: number;
  reasonCounts: Record<string, number>;
  reviewedParticipantProfiles: string[];
  reviewedMetadata: string[];
  reviewedInclusions: string[];
  quantitativeEvidence: {
    reviewedBattles: string[];
    coverage: Record<string, number>;
  };
};
const audit = JSON.parse(await readFile(join(output, 'candidates.json'), 'utf8')) as {
  candidates: { id: string; classification: string }[];
};
const auditById = new Map(audit.candidates.map((candidate) => [candidate.id, candidate]));
assert.equal(
  audit.candidates.length,
  coverage.candidates,
  'Every discovered candidate must be classified',
);
assert.equal(
  new Set(audit.candidates.map((candidate) => candidate.id)).size,
  coverage.candidates,
  'Duplicate candidate audit IDs',
);
if (!process.argv.includes('--partial'))
  assert.equal(coverage.notFetched.length, 0, 'Candidate acquisition is incomplete');
if (!process.argv.includes('--partial'))
  assert.equal(
    coverage.status,
    'all-cached-candidates-audited',
    'Linked entities or source-language labels are not fully acquired',
  );
const ids = new Set(index.battles.map((battle) => battle.id));
const metadata = BattleMetadataFileSchema.parse(
  JSON.parse(await readFile(join(root, 'data/curated/battle-metadata.json'), 'utf8')),
);
const inclusions = BattleInclusionsFileSchema.parse(
  JSON.parse(await readFile(join(root, 'data/curated/battle-inclusions.json'), 'utf8')),
);
assert.deepEqual(
  [...coverage.reviewedInclusions].sort(),
  Object.keys(inclusions.records).sort(),
  'Inclusion review coverage mismatch',
);
for (const id of coverage.reviewedInclusions)
  assert(
    ids.has(id) && auditById.has(id),
    `Reviewed inclusion ${id} must be catalogued and audited`,
  );
assert.deepEqual(
  [...coverage.reviewedMetadata].sort(),
  Object.keys(metadata.records).sort(),
  'Metadata review coverage mismatch',
);
for (const id of coverage.reviewedMetadata) assert(ids.has(id), `Metadata review ${id} is absent`);
for (const candidate of audit.candidates)
  assert.equal(
    ids.has(candidate.id),
    ['published-battle', 'additional-mappable-battle', 'unmapped-battle'].includes(
      candidate.classification,
    ),
    `Candidate classification mismatch: ${candidate.id}`,
  );
assert.equal(ids.size, index.battles.length, 'Duplicate catalog IDs');
const reviewedProfiles = new Set(coverage.reviewedParticipantProfiles);
const curatedProfiles = await loadBattleProfiles(root);
assert.deepEqual(
  [...coverage.reviewedParticipantProfiles].sort(),
  Object.keys(curatedProfiles.records).sort(),
  'Participant review coverage does not match the curated profiles',
);
assert.equal(
  reviewedProfiles.size,
  coverage.reviewedParticipantProfiles.length,
  'Duplicate reviewed participant profile IDs',
);
for (const id of reviewedProfiles)
  assert(ids.has(id), `Reviewed participant profile ${id} is absent from the catalog`);
for (const id of coverage.quantitativeEvidence.reviewedBattles)
  assert(reviewedProfiles.has(id), `Quantitative review ${id} has no reviewed participant profile`);
assert.equal(
  (await readdir(join(output, 'events'))).length,
  ids.size,
  'Index/detail file count mismatch',
);
let mapped = 0;
let documented = 0;
const quantitativeReviews: string[] = [];
const reasons: Record<string, number> = {};
const evidence = {
  withParticipants: 0,
  withStrengthEvidence: 0,
  withDeathEvidence: 0,
  withCasualtyEvidence: 0,
  withComparableArmies: 0,
  inheritedPlaceCoordinates: 0,
};
for (const entry of index.battles) {
  const record = BattleRecordSchema.parse(
    JSON.parse(await readFile(join(output, 'events', `${entry.id}.json`), 'utf8')),
  );
  const patch = metadata.records[entry.id];
  verifyBattleInclusion(record, inclusions);
  if (patch) {
    assert.deepEqual(
      record.metadataReview,
      {
        reviewedAt: patch.reviewedAt ?? metadata.reviewedAt,
        fields: (['start', 'end', 'coords'] as const).filter((field) => patch[field] !== undefined),
        before: patch.expected,
        note: patch.note,
        sources: patch.sources,
        ...(patch.coordinateBasis ? { coordinateBasis: patch.coordinateBasis } : {}),
      },
      `${entry.id}: metadata review provenance mismatch`,
    );
    for (const field of ['start', 'end', 'coords'] as const)
      assert.deepEqual(
        record[field] ?? null,
        patch[field] !== undefined ? patch[field] : patch.expected[field],
        `${entry.id}: reviewed ${field} mismatch`,
      );
    for (const source of patch.sources)
      assert(
        record.sources.some((item) => item.url === source.url),
        `${entry.id}: missing metadata source`,
      );
    if (patch.coords === null) {
      assert.equal(
        record.coordinateSource,
        undefined,
        `${entry.id}: withdrawn coordinate source remains`,
      );
      assert.equal(record.region, undefined, `${entry.id}: withdrawn coordinate region remains`);
      assert(
        record.missing?.includes('missing-coordinates'),
        `${entry.id}: withdrawn coordinates lack a missing reason`,
      );
    } else if (patch.coords) {
      const source = patch.sources.find((source) => source.url === patch.coordinateSourceUrl)!;
      assert.deepEqual(
        record.coordinateSource,
        {
          kind: 'reviewed',
          entityId: record.id,
          url: source.url,
          label: source.label,
        },
        `${entry.id}: reviewed coordinate source mismatch`,
      );
    }
  } else
    assert.equal(record.metadataReview, undefined, `${entry.id}: unregistered metadata review`);
  for (const field of [
    'id',
    'coords',
    'start',
    'end',
    'name',
    'nameLanguage',
    'type',
    'medium',
    'region',
    'era',
  ] as const)
    assert.deepEqual(record[field], entry[field], `${entry.id}: index/detail ${field} mismatch`);
  assert.equal(
    new Set(record.participants.map((participant) => participant.id)).size,
    record.participants.length,
    `${entry.id}: duplicate participants would double-count forces`,
  );
  if (record.start && record.coords) mapped++;
  const candidate = auditById.get(record.id);
  if (candidate && candidate.classification !== 'published-battle')
    assert.equal(
      candidate.classification,
      record.start && record.coords ? 'additional-mappable-battle' : 'unmapped-battle',
      `${record.id}: mapped classification mismatch`,
    );
  const measured = (['land', 'naval', 'air'] as const).some((medium) => {
    const unit = medium === 'naval' ? 'ships' : medium === 'air' ? 'aircraft' : 'soldiers';
    return (
      new Set(
        record.participants
          .filter(
            (participant) =>
              ['polity', 'military-unit'].includes(participant.kind) &&
              (participant.medium ?? record.medium) === medium &&
              participant.sideId &&
              new Set(
                participant.strength
                  .filter(
                    (quantity) =>
                      quantity.renderable &&
                      quantity.scope === 'participant' &&
                      quantity.counts === unit,
                  )
                  .map((quantity) => quantity.value),
              ).size === 1,
          )
          .map((participant) => participant.sideId),
      ).size >= 2
    );
  });
  assert.equal(measured, entry.documented, `${entry.id}: documentation badge mismatch`);
  if (measured) documented++;
  if (measured && reviewedProfiles.has(record.id)) quantitativeReviews.push(record.id);
  for (const reason of record.missing ?? []) reasons[reason] = (reasons[reason] ?? 0) + 1;
  if (record.participants.length) evidence.withParticipants++;
  for (const [field, key] of [
    ['strength', 'withStrengthEvidence'],
    ['deaths', 'withDeathEvidence'],
    ['casualties', 'withCasualtyEvidence'],
  ] as const)
    if (
      record.totals[field].length ||
      record.unassigned?.[field].length ||
      record.participants.some((participant) => participant[field].length)
    )
      evidence[key]++;
  if (record.coords && record.coordinateSource?.kind === 'place')
    evidence.inheritedPlaceCoordinates++;
  if (coverage.quantitativeEvidence.reviewedBattles.includes(record.id))
    assert(measured, `${entry.id}: reviewed battle has no comparable opposing forces`);
}
let originalBattles = 0;
const reviewedOriginalMetadataCorrections: string[] = [];
for (const file of await readdir(join(root, 'public/data/events'))) {
  const event = JSON.parse(await readFile(join(root, 'public/data/events', file), 'utf8'));
  if (!['battle', 'siege', 'naval'].includes(event.type)) continue;
  originalBattles++;
  assert(ids.has(event.id), `Published battle ${event.id} missing from catalog`);
  const entry = index.battles.find((battle) => battle.id === event.id)!;
  const patch = metadata.records[event.id];
  for (const field of ['coords', 'start', 'end'] as const) {
    if (patch?.[field] !== undefined) {
      assert.deepEqual(
        patch.expected[field],
        event[field] ?? null,
        `Original ${field} changed after review: ${event.id}`,
      );
      assert.deepEqual(
        entry[field] ?? null,
        patch[field],
        `Reviewed original ${field} mismatch: ${event.id}`,
      );
    } else
      assert.deepEqual(
        entry[field],
        event[field],
        `Published ${field} altered without review: ${event.id}`,
      );
  }
  if (patch) reviewedOriginalMetadataCorrections.push(event.id);
}
assert.equal(index.counts.total, ids.size);
assert.equal(index.counts.mappable, mapped);
assert.equal(index.counts.documented, documented);
assert.equal(index.counts.unmapped, ids.size - mapped);
assert.equal(index.unmapped, index.counts.unmapped);
assert.deepEqual(
  [...coverage.quantitativeEvidence.reviewedBattles].sort(),
  quantitativeReviews.sort(),
  'Quantitative review coverage does not match the comparable reviewed forces',
);
for (const field of ['total', 'mappable', 'documented', 'unmapped'] as const)
  assert.equal(coverage[field], index.counts[field], `Coverage/index ${field} mismatch`);
assert.deepEqual(
  JSON.parse(await readFile(join(output, 'documented.json'), 'utf8')),
  documentedBattleIds(index.battles),
  'documented.json must list exactly the documented battles of the index',
);
evidence.withComparableArmies = documented;
assert.deepEqual(coverage.reasonCounts, reasons, 'Coverage reasons do not match the catalog');
assert.deepEqual(
  coverage.quantitativeEvidence.coverage,
  evidence,
  'Evidence coverage does not match the catalog',
);
const result = {
  status:
    coverage.status === 'all-cached-candidates-audited' ? 'passed' : 'passed-partial-acquisition',
  records: ids.size,
  originalBattlesPreserved: originalBattles,
  reviewedOriginalMetadataCorrections,
  mappable: mapped,
  documented,
  candidatesStillMissing: coverage.notFetched.length,
};
await writeFile(join(output, 'verification.json'), JSON.stringify(result) + '\n');
console.log(JSON.stringify(result));
