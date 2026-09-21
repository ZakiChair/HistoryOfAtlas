import { rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';

/** Publish a complete generated directory; omitted records cannot survive a rebuild. */
export async function publishDirectory(staging: string, destination: string): Promise<void> {
  const backup = join(dirname(staging), `.events-previous-${randomUUID()}`);
  let previous = false;
  try {
    await rename(destination, backup);
    previous = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  try {
    await rename(staging, destination);
  } catch (error) {
    if (previous) await rename(backup, destination);
    throw error;
  }
  if (previous) await rm(backup, { recursive: true, force: true });
}
