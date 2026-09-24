import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { commitLabel, gitHead } from '../../scripts/bundle-report.mjs';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function directory(prefix: string) {
  const path = await mkdtemp(join(tmpdir(), prefix));
  directories.push(path);
  return path;
}

const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Atlas',
      '-c',
      'user.email=atlas@example.test',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  ).trim();

async function repository() {
  const path = await directory('atlas-bundle-report-');
  git(path, 'init', '--quiet');
  await writeFile(join(path, 'page.tsx'), 'export default 1;\n');
  git(path, 'add', 'page.tsx');
  git(path, 'commit', '--quiet', '--no-verify', '-m', 'initial');
  return { path, sha: git(path, 'rev-parse', 'HEAD') };
}

describe('bundle report commit label', () => {
  it('names HEAD when the tree is clean', async () => {
    const { path, sha } = await repository();
    expect(gitHead(path)).toBe(sha);
  });

  it('ignores the generated reports and the export', async () => {
    const { path, sha } = await repository();
    await mkdir(join(path, 'data/reports'), { recursive: true });
    await mkdir(join(path, 'out'));
    await writeFile(join(path, 'data/reports/bundle.json'), '{}\n');
    await writeFile(join(path, 'out/index.html'), '<html></html>\n');
    expect(gitHead(path)).toBe(sha);
  });

  it('marks modified and untracked source files as uncommitted', async () => {
    const { path, sha } = await repository();
    await writeFile(join(path, 'page.tsx'), 'export default 2;\n');
    expect(gitHead(path)).toBe(`${sha}-dirty`);

    git(path, 'checkout', '--quiet', '--', 'page.tsx');
    expect(gitHead(path)).toBe(sha);
    await writeFile(join(path, 'panel.tsx'), 'export default 3;\n');
    expect(gitHead(path)).toBe(`${sha}-dirty`);
  });

  it('has no label outside a Git checkout', async () => {
    expect(gitHead(await directory('atlas-no-repository-'))).toBeNull();
  });

  it('keeps the uncommitted marker in the run summary', () => {
    const sha = '9a47d114196421327e10017c13f78b43ab2aba54';
    expect(commitLabel(sha)).toBe('9a47d1141');
    expect(commitLabel(`${sha}-dirty`)).toBe('9a47d1141, uncommitted tree');
    expect(commitLabel(null)).toBe('unknown');
    expect(commitLabel(undefined)).toBe('unknown');
  });
});
