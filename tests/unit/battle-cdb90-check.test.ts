import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { checkCdb90Artifacts } from '../../pipeline/battles/cdb90-check';

it('rejects stale generated evidence independently of raw source availability', async () => {
  const root = await mkdtemp(join(tmpdir(), 'atlas-cdb90-'));
  const source = {
    repository: 'https://github.com/jrnold/CDB90',
    commit: 'a'.repeat(40),
    license: 'ODC-BY-1.0',
  };
  const review = { source, records: [{ sourceId: 1, battleId: 'Q1', decision: 'approved' }] };
  const profiles = { sourceCommit: source.commit, records: { Q1: { note: 'Reviewed' } } };
  const digest = (value: unknown) =>
    createHash('sha256')
      .update(JSON.stringify(value, null, 2) + '\n')
      .digest('hex');
  const report = {
    status: 'reviewed-import',
    sourceCommit: source.commit,
    sourceManifestSha256: digest(source),
    reviewSha256: digest(review),
    profilesSha256: digest(profiles),
    imported: 1,
    reviewed: 1,
    sourceBattles: 1,
    records: [{ sourceId: 1, battleId: 'Q1', status: 'imported' }],
  };
  const save = (path: string, data: unknown) => writeFile(join(root, path), JSON.stringify(data));
  try {
    await mkdir(join(root, 'data/curated'), { recursive: true });
    await mkdir(join(root, 'data/reports'), { recursive: true });
    await Promise.all([
      save('data/curated/battle-cdb90-source.json', source),
      save('data/curated/battle-cdb90-matches.json', review),
      save('data/curated/battle-cdb90-profiles.json', profiles),
      save('data/reports/battle-cdb90-intake.json', report),
    ]);
    await checkCdb90Artifacts(root);
    await save('data/curated/battle-cdb90-profiles.json', { ...profiles, records: {} });
    await expect(checkCdb90Artifacts(root)).rejects.toThrow('generated evidence changed');
    await save('data/curated/battle-cdb90-profiles.json', profiles);
    await save('data/curated/battle-cdb90-matches.json', {
      ...review,
      source: { ...source, commit: 'b'.repeat(40) },
    });
    await expect(checkCdb90Artifacts(root)).rejects.toThrow('historical review changed');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
