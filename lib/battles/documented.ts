/**
 * Battles whose 3D scene uses sourced, comparable opposing forces. Published as
 * /data/battles/documented.json (a few kilobytes) so an event dossier can name its
 * 3D view honestly without downloading the full battle index.
 */
export const DOCUMENTED_BATTLES_PATH = '/data/battles/documented.json';

export type DocumentedBattles = { version: 1; ids: string[] };

const QID = /^Q[1-9]\d*$/;

export function documentedBattleIds(
  index: readonly { id: string; documented: boolean }[],
): DocumentedBattles {
  const ids = index
    .filter((entry) => entry.documented)
    .map((entry) => entry.id)
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  return { version: 1, ids };
}

/** Throws on a malformed file so callers fall back to the illustrative label. */
export function parseDocumentedBattles(value: unknown): ReadonlySet<string> {
  const data = value as Partial<DocumentedBattles> | null;
  if (
    !data ||
    data.version !== 1 ||
    !Array.isArray(data.ids) ||
    !data.ids.every((id) => typeof id === 'string' && QID.test(id))
  )
    throw new Error('Invalid documented battle list');
  return new Set(data.ids);
}
