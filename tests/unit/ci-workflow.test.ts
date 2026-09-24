import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');

/** Keys of the workflow-level `concurrency:` block, comments excluded. */
function concurrency(): Record<string, string> {
  const block = /^concurrency:\n((?: +.*\n)+)/m.exec(workflow)?.[1] ?? '';
  return Object.fromEntries(
    block
      .split('\n')
      .map((line) => /^ {2}([\w-]+):\s*(.+)$/.exec(line))
      .filter((match) => match !== null)
      .map((match) => [match[1], match[2].trim()]),
  );
}

interface Run {
  event_name: 'push' | 'pull_request' | 'workflow_dispatch';
  ref: string;
  sha: string;
}

const format = (template: string, ...values: unknown[]) =>
  template.replace(/\{(\d+)\}/g, (_, index: string) => String(values[Number(index)]));

/**
 * Interpolates `${{ … }}` for the operators the concurrency block uses. On strings, GitHub's
 * `==`, `!=`, `&&` and `||` (which return an operand) match JavaScript's strict operators.
 */
function evaluate(template: string, github: Run): string {
  return template.replace(/\$\{\{(.+?)\}\}/g, (_, expression: string) => {
    const script = expression.replace(/([!=])=/g, '$1==');
    return String(new Function('github', 'format', `return (${script});`)(github, format));
  });
}

const group = (run: Run) => evaluate(concurrency().group, run);
const cancels = (run: Run) => evaluate(concurrency()['cancel-in-progress'], run) === 'true';

const main = (sha: string, event_name: Run['event_name'] = 'push'): Run => ({
  event_name,
  ref: 'refs/heads/main',
  sha,
});
const pullRequest = (number: number, sha: string): Run => ({
  event_name: 'pull_request',
  ref: `refs/pull/${number}/merge`,
  sha,
});

describe('CI concurrency', () => {
  it('declares a group and a cancellation rule', () => {
    expect(concurrency().group).toBeTruthy();
    expect(concurrency()['cancel-in-progress']).toBeTruthy();
  });

  it('gives every main commit its own group, so a later merge never replaces a pending run', () => {
    // The default `queue: single` cancels a pending run when another joins the same group.
    const runs = [main('a1'), main('b2'), main('c3')];
    expect(new Set(runs.map(group)).size).toBe(runs.length);
    expect(runs.some(cancels)).toBe(false);
  });

  it('keeps a manual run on main apart from the push run of the same commit', () => {
    expect(group(main('a1', 'workflow_dispatch'))).not.toBe(group(main('a1')));
  });

  it('supersedes older runs of the same pull request only', () => {
    expect(group(pullRequest(7, 'a1'))).toBe(group(pullRequest(7, 'b2')));
    expect(group(pullRequest(7, 'a1'))).not.toBe(group(pullRequest(8, 'a1')));
    expect(cancels(pullRequest(7, 'b2'))).toBe(true);
  });
});
