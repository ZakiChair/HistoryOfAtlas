import { execFileSync } from 'node:child_process';

/** Suffix of a commit label whose measurement includes uncommitted changes. */
export const DIRTY_SUFFIX = '-dirty';

/**
 * Commit that the measured code belongs to: `HEAD`, or `<sha>-dirty` when the working tree has
 * changes outside the generated reports and the export. Untracked files count, because a new
 * source file changes the build. Returns null outside a Git checkout.
 * @param {string} [cwd]
 * @returns {string | null}
 */
export const gitHead = (cwd = process.cwd()) => {
  try {
    /** @param {string[]} args */
    const git = (args) =>
      execFileSync('git', args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        // Reading the status must not take the index lock from a concurrent Git command.
        env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
      }).trim();
    const sha = git(['rev-parse', 'HEAD']);
    const changes = git([
      'status',
      '--porcelain',
      // Independent of a local `status.showUntrackedFiles = no`.
      '--untracked-files=normal',
      '--',
      ':(top)',
      ':(top,exclude)data/reports',
      ':(top,exclude)out',
    ]);
    return changes === '' ? sha : `${sha}${DIRTY_SUFFIX}`;
  } catch {
    return null;
  }
};

/**
 * Short form of a report's commit label for the run summary; keeps the uncommitted marker.
 * @param {string | null | undefined} label
 * @returns {string}
 */
export const commitLabel = (label) => {
  if (!label) return 'unknown';
  if (!label.endsWith(DIRTY_SUFFIX)) return label.slice(0, 9);
  return `${label.slice(0, -DIRTY_SUFFIX.length).slice(0, 9)}, uncommitted tree`;
};
