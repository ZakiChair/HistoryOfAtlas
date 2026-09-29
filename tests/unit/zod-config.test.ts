import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(file);
    return /\.tsx?$/.test(file) ? [file] : [];
  });
}

describe('validation under the page policy', () => {
  it('reads Zod through the module that disables its eval probe in the browser', () => {
    const shipped = [...sourceFiles(join(root, 'lib')), ...sourceFiles(join(root, 'components'))];
    const direct = shipped
      .filter((file) => relative(root, file) !== 'lib/zod.ts')
      .filter((file) => /\bfrom '(?:zod)'/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(root, file));
    expect(direct).toEqual([]);
  });

  it('keeps the compiled validators outside the browser', () => {
    const source = readFileSync(join(root, 'lib', 'zod.ts'), 'utf8');
    expect(source).toContain("typeof window !== 'undefined'");
    expect(source).toContain('jitless: true');
  });
});
