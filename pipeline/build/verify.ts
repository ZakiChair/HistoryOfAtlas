import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function files(directory: string, prefix = ''): Promise<string[]> {
  const paths: string[] = [];
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) paths.push(...(await files(directory, path)));
    else if (entry.isFile()) paths.push(path);
    else throw new Error(`Unexpected generated file type: ${path}`);
  }
  return paths.sort();
}

/** Compare every output byte without replacing the corpus used by concurrent audits. */
export async function verifyIdenticalTrees(
  staging: string,
  published: string,
): Promise<{ files: number; sha256: string }> {
  const [expected, actual] = await Promise.all([files(published), files(staging)]);
  if (JSON.stringify(expected) !== JSON.stringify(actual))
    throw new Error('Idempotence failed: generated file lists differ.');
  const digest = createHash('sha256');
  for (let offset = 0; offset < actual.length; offset += 32) {
    const hashes = await Promise.all(
      actual.slice(offset, offset + 32).map(async (path) => {
        const [a, b] = await Promise.all([
          readFile(join(published, path)),
          readFile(join(staging, path)),
        ]);
        if (!a.equals(b)) throw new Error(`Idempotence failed: ${path} differs.`);
        return [path, createHash('sha256').update(a).digest('hex')] as const;
      }),
    );
    for (const [path, hash] of hashes) digest.update(`${path}\0${hash}\n`);
  }
  return { files: actual.length, sha256: digest.digest('hex') };
}
