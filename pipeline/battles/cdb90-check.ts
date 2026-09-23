import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const digest = (value: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(value, null, 2) + '\n')
    .digest('hex');

/** Check committed artifacts offline; raw snapshot checks belong to the Python importer. */
export async function checkCdb90Artifacts(root: string) {
  const [source, review, profiles, report] = await Promise.all(
    [
      'data/curated/battle-cdb90-source.json',
      'data/curated/battle-cdb90-matches.json',
      'data/curated/battle-cdb90-profiles.json',
      'data/reports/battle-cdb90-intake.json',
    ].map(async (path) => JSON.parse(await readFile(join(root, path), 'utf8'))),
  );
  assert.equal(report.status, 'reviewed-import', 'CDB90 import is blocked');
  assert.equal(report.sourceManifestSha256, digest(source), 'CDB90 source manifest changed');
  assert.equal(report.reviewSha256, digest(review), 'CDB90 historical review changed');
  assert.equal(report.profilesSha256, digest(profiles), 'CDB90 generated evidence changed');
  for (const field of ['repository', 'commit', 'license'])
    assert.equal(review.source[field], source[field], `CDB90 review ${field} mismatch`);
  assert.equal(profiles.sourceCommit, source.commit, 'CDB90 profiles revision mismatch');
  assert.equal(report.sourceCommit, source.commit, 'CDB90 report revision mismatch');
  const approved = review.records
    .filter((row: { decision: string }) => row.decision === 'approved')
    .map((row: { battleId: string }) => row.battleId);
  assert.equal(new Set(approved).size, approved.length, 'Duplicate CDB90 approved battle');
  assert.deepEqual(
    Object.keys(profiles.records).sort(),
    approved.sort(),
    'CDB90 approved profiles mismatch',
  );
  assert.equal(report.imported, approved.length, 'CDB90 import count mismatch');
  assert.equal(report.reviewed, review.records.length, 'CDB90 review count mismatch');
  assert.equal(report.sourceBattles, report.records.length, 'CDB90 source row audit incomplete');
  assert.equal(
    new Set(report.records.map((row: { sourceId: number }) => row.sourceId)).size,
    report.sourceBattles,
    'Duplicate CDB90 source audit row',
  );
  const importedRows = report.records
    .filter((row: { status: string }) => row.status === 'imported')
    .map((row: { battleId: string }) => row.battleId);
  assert.deepEqual(importedRows.sort(), approved.sort(), 'CDB90 imported row audit mismatch');
}
