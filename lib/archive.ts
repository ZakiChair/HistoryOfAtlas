/**
 * Build-time readers for the static archive pages (/event, /war, /about, sitemap).
 * Server-only: it reads public/data from disk and must never be imported by client code.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { HistDate } from '@/lib/histdate';
import type { HistoricalEvent } from '@/lib/schema';

export interface WarRecord {
  id: string;
  name: { fr?: string; en: string };
  start: HistDate;
  end?: HistDate;
  count: number;
  path: string;
  source: string;
}

const DATA = path.join(process.cwd(), 'public/data');
const shared = new Map<string, Promise<unknown>>();

/** Small indexes are read once per build worker instead of once per exported page. */
function readShared<T>(relative: string): Promise<T> {
  let pending = shared.get(relative) as Promise<T> | undefined;
  if (!pending) {
    pending = readFile(path.join(DATA, relative), 'utf8').then((text) => JSON.parse(text) as T);
    shared.set(relative, pending);
  }
  return pending;
}

export const QID = /^Q[1-9]\d*$/;

export async function readWars(): Promise<WarRecord[]> {
  return readShared<WarRecord[]>('wars.json');
}

export async function readWarIds(): Promise<ReadonlySet<string>> {
  return new Set((await readWars()).map((war) => war.id));
}

export async function readCuratedIds(): Promise<ReadonlySet<string>> {
  const curated = await readShared<{ id: string }[]>('curated.json');
  return new Set(curated.map((event) => event.id));
}

/** Build date of the event data, used for sitemap and Dataset freshness. */
export async function readDataBuiltAt(): Promise<string> {
  return (await readShared<{ builtAt: string }>('manifest.json')).builtAt;
}

export async function readEvent(id: string): Promise<HistoricalEvent | null> {
  if (!QID.test(id)) return null;
  try {
    return JSON.parse(
      await readFile(path.join(DATA, 'events', `${id}.json`), 'utf8'),
    ) as HistoricalEvent;
  } catch {
    return null;
  }
}

/** Chronological members of a conflict, as listed on its archive page. */
export async function readWarEvents(id: string): Promise<HistoricalEvent[] | null> {
  if (!QID.test(id)) return null;
  try {
    return JSON.parse(
      await readFile(path.join(DATA, 'wars', `${id}.json`), 'utf8'),
    ) as HistoricalEvent[];
  } catch {
    return null;
  }
}

export interface WarNeighbours<T> {
  previous?: T;
  next?: T;
  /** One-based position in the conflict's list. */
  position: number;
  total: number;
}

/** Previous and next records around `id` in a conflict's chronological list. */
export function warNeighbours<T extends { id: string }>(
  events: readonly T[],
  id: string,
): WarNeighbours<T> | null {
  const index = events.findIndex((event) => event.id === id);
  if (index < 0) return null;
  return {
    ...(index > 0 ? { previous: events[index - 1] } : {}),
    ...(index < events.length - 1 ? { next: events[index + 1] } : {}),
    position: index + 1,
    total: events.length,
  };
}
