import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  documentedBattleIds,
  parseDocumentedBattles,
  DOCUMENTED_BATTLES_PATH,
} from '../../lib/battles/documented';
import type { BattleIndex } from '../../lib/battles/schema';

const read = (path: string) =>
  JSON.parse(readFileSync(new URL(`../../public${path}`, import.meta.url), 'utf8')) as unknown;

describe('documented battle list', () => {
  it('lists exactly the documented battles of the published index', () => {
    const index = read('/data/battles/index.json') as BattleIndex;
    const published = read(DOCUMENTED_BATTLES_PATH);
    expect(published).toEqual(documentedBattleIds(index.battles));
    const ids = parseDocumentedBattles(published);
    expect(ids.size).toBe(index.counts.documented);
    // Waterloo is a sourced reconstruction.
    expect(ids.has('Q48314')).toBe(true);
    expect(index.battles.find((battle) => battle.id === 'Q48314')?.documented).toBe(true);
    for (const battle of index.battles) expect(ids.has(battle.id)).toBe(battle.documented);
  });

  it('stays small enough to load with an event dossier', () => {
    expect(
      readFileSync(new URL('../../public/data/battles/documented.json', import.meta.url)).length,
    ).toBeLessThan(8_000);
  });

  it('rejects malformed lists so the dossier falls back to the illustrative label', () => {
    expect(() => parseDocumentedBattles(null)).toThrow();
    expect(() => parseDocumentedBattles({ version: 2, ids: [] })).toThrow();
    expect(() => parseDocumentedBattles({ version: 1, ids: ['Q0'] })).toThrow();
    expect(() => parseDocumentedBattles({ version: 1, ids: ['<script>'] })).toThrow();
    expect([...parseDocumentedBattles({ version: 1, ids: ['Q7'] })]).toEqual(['Q7']);
  });

  it('orders identifiers numerically for stable diffs', () => {
    expect(
      documentedBattleIds([
        { id: 'Q100', documented: true },
        { id: 'Q9', documented: true },
        { id: 'Q5', documented: false },
      ]),
    ).toEqual({ version: 1, ids: ['Q9', 'Q100'] });
  });
});
