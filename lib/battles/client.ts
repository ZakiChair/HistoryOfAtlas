import { invalidateJson, readJson } from '@/lib/data-client';
import { BattleIndexSchema, BattleRecordSchema } from './schema';
import type { BattleIndex, BattleRecord } from './schema';

let indexPromise: Promise<BattleIndex> | undefined;
const records = new Map<string, Promise<BattleRecord>>();

/** Battle data and validation are only imported when the reconstruction is opened. */
export function getBattleIndex(): Promise<BattleIndex> {
  indexPromise ??= readJson<unknown>('/data/battles/index.json')
    .then((data) => BattleIndexSchema.parse(data))
    .catch((error) => {
      indexPromise = undefined;
      invalidateJson('/data/battles/index.json');
      throw error;
    });
  return indexPromise;
}

export function getBattle(id: string): Promise<BattleRecord> {
  if (!/^Q[1-9]\d*$/.test(id)) return Promise.reject(new Error('Invalid battle identifier'));
  let promise = records.get(id);
  if (!promise) {
    promise = readJson<unknown>(`/data/battles/events/${id}.json`)
      .then((data) => {
        const battle = BattleRecordSchema.parse(data);
        if (battle.id !== id) throw new Error('Battle identifier does not match its record');
        return battle;
      })
      .catch((error) => {
        records.delete(id);
        invalidateJson(`/data/battles/events/${id}.json`);
        throw error;
      });
    records.set(id, promise);
  }
  return promise;
}
