import { readJson } from '@/lib/data-client';
import { DOCUMENTED_BATTLES_PATH, parseDocumentedBattles } from './documented';

/** Short request budget: the list only refines a label, it never blocks the 3D entry. */
const REQUEST = { stallMs: 5_000, retries: 1 } as const;

let loaded: ReadonlySet<string> | null = null;

/** The documented battle list once any dossier has loaded it, so later dossiers label at once. */
export function peekDocumentedBattles(): ReadonlySet<string> | null {
  return loaded;
}

/**
 * Loads /data/battles/documented.json once per page. A malformed list resolves to an empty
 * set, so no scene is ever called sourced without evidence. A network failure rejects and
 * is retried by the next dossier; until then the button keeps its neutral label.
 */
export async function loadDocumentedBattles(): Promise<ReadonlySet<string>> {
  if (loaded) return loaded;
  const data = await readJson<unknown>(DOCUMENTED_BATTLES_PATH, REQUEST);
  let ids: ReadonlySet<string>;
  try {
    ids = parseDocumentedBattles(data);
  } catch {
    ids = new Set();
  }
  loaded = ids;
  return ids;
}
