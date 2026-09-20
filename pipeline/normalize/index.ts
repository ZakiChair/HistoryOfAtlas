import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { HistoricalEventSchema, type HistoricalEvent } from '../../lib/schema';
import { classifyEra } from '../../lib/eras';
import { compareHistDates, parseWikidataTime } from '../../lib/histdate';
import type { EventType, RegionId } from '../../lib/types';

type ClaimValue =
  | string
  | number
  | {
      id?: string;
      time?: string;
      precision?: number;
      calendarmodel?: string;
      latitude?: number;
      longitude?: number;
      globe?: string;
      amount?: string;
    };
type Claim = { rank?: string; mainsnak?: { datavalue?: { value: ClaimValue } } };
export type Entity = {
  id: string;
  lastrevid?: number;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  claims?: Record<string, Claim[]>;
  sitelinks?: Record<string, { title: string; url?: string }>;
};
export type Rejection = { id: string; reasons: string[]; details?: string };
const ROOT_TYPES: Record<string, EventType> = {
  Q178561: 'battle',
  Q188055: 'siege',
  Q1261499: 'naval',
  Q198: 'war',
  Q831663: 'campaign',
  Q625298: 'treaty',
  Q1361229: 'conquest',
};
const PRIORITY: EventType[] = ['naval', 'siege', 'campaign', 'conquest', 'treaty', 'battle', 'war'];

export function values(entity: Entity, property: string): ClaimValue[] {
  const claims = (entity.claims?.[property] ?? []).filter(
    (claim) => claim.rank !== 'deprecated' && claim.mainsnak?.datavalue,
  );
  const preferred = claims.filter((claim) => claim.rank === 'preferred');
  return (preferred.length ? preferred : claims).map((claim) => claim.mainsnak!.datavalue!.value);
}
export function entityIds(entity: Entity, property: string): string[] {
  return values(entity, property).flatMap((value) =>
    typeof value === 'object' && value.id ? [value.id] : [],
  );
}
export function label(entity: Entity | undefined, language = 'en'): string | undefined {
  return entity?.labels?.[language]?.value;
}

/** Broad display regions are navigation bins, not claims about historical borders. */
export function classifyRegion(coords?: [number, number]): RegionId {
  if (!coords) return 'global';
  const [lon, lat] = coords;
  if ((lon > 110 && lat < -10) || (lon < -130 && lat < 30)) return 'oceania';
  if (lon < -25 && lat > 12) return 'north-america';
  if (lon < -25 && lat <= 12) return 'south-america';
  if (lon >= -20 && lon < 52 && lat < 36) return 'africa';
  if (lon >= 26 && lon < 65 && lat >= 12 && lat < 43) return 'middle-east';
  if (lon >= -25 && lon < 60 && lat >= 35) return 'europe';
  return 'asia';
}

export async function loadEntities(rawDirectory: string): Promise<Map<string, Entity>> {
  const entities = new Map<string, Entity>();
  for (const name of (await readdir(rawDirectory))
    .filter((name) => /^entities-.*\.json$/.test(name) && !name.endsWith('.meta.json'))
    .sort()) {
    const document = JSON.parse(await readFile(join(rawDirectory, name), 'utf8')) as {
      entities: Record<string, Entity>;
    };
    for (const entity of Object.values(document.entities))
      if (entity.id) entities.set(entity.id, entity);
  }
  return entities;
}

export async function normalize(
  rawDirectory: string,
): Promise<{ events: HistoricalEvent[]; rejected: Rejection[]; entities: Map<string, Entity> }> {
  const entities = await loadEntities(rawDirectory);
  const taxonomy = JSON.parse(await readFile(join(rawDirectory, 'taxonomy.json'), 'utf8')) as {
    results: { bindings: { class: { value: string }; root: { value: string } }[] };
  };
  const classes = new Map<string, Set<EventType>>();
  for (const row of taxonomy.results.bindings) {
    const id = row.class.value.split('/').pop()!;
    const root = row.root.value.split('/').pop()!;
    const set = classes.get(id) ?? new Set<EventType>();
    if (ROOT_TYPES[root]) set.add(ROOT_TYPES[root]);
    classes.set(id, set);
  }
  const candidateIds = new Set<string>(
    JSON.parse(await readFile(join(rawDirectory, 'candidate-ids.json'), 'utf8')),
  );
  let eligibleIds: Set<string> | undefined;
  try {
    eligibleIds = new Set<string>(
      JSON.parse(await readFile(join(rawDirectory, 'eligible-ids.json'), 'utf8')),
    );
  } catch {
    /* Older cached acquisitions remain usable in explicit partial mode. */
  }
  const events: HistoricalEvent[] = [];
  const rejected: Rejection[] = [];
  for (const id of candidateIds) {
    const entity = entities.get(id);
    if (!entity) {
      rejected.push({
        id,
        reasons: [
          eligibleIds && !eligibleIds.has(id)
            ? 'missing-source-date-or-coordinate'
            : 'not-yet-fetched',
        ],
      });
      continue;
    }
    const types = entityIds(entity, 'P31').flatMap((id) => [...(classes.get(id) ?? [])]);
    const type = PRIORITY.find((type) => types.includes(type));
    if (!type) {
      rejected.push({ id, reasons: ['unsupported-class'] });
      continue;
    }
    try {
      const starts = values(entity, 'P580').length
        ? values(entity, 'P580')
        : values(entity, 'P585');
      const parseTime = (value: ClaimValue) => {
        if (typeof value !== 'object' || !value.time) throw new Error('No Wikibase time value');
        return parseWikidataTime(value.time, {
          precision: value.precision,
          calendar: value.calendarmodel,
          encoding: 'json',
        });
      };
      if (!starts.length) {
        rejected.push({ id, reasons: ['missing-date'] });
        continue;
      }
      const times = starts.map(parseTime).sort((a, b) => compareHistDates(a.date, b.date));
      const start = times[0]!;
      const end = values(entity, 'P582')
        .map(parseTime)
        .sort((a, b) => compareHistDates(b.date, a.date))[0]?.date;
      const points = values(entity, 'P625').filter(
        (value) =>
          typeof value === 'object' &&
          typeof value.longitude === 'number' &&
          typeof value.latitude === 'number',
      );
      let point: ClaimValue | undefined = points[0];
      let pointEntity = id;
      let pointKind: 'event' | 'place' = 'event';
      const placeIds = entityIds(entity, 'P276');
      if (!point)
        for (const placeId of placeIds) {
          const place = entities.get(placeId);
          if (!place) continue;
          point = values(place, 'P625').find(
            (value) =>
              typeof value === 'object' &&
              typeof value.longitude === 'number' &&
              typeof value.latitude === 'number',
          );
          if (point) {
            pointEntity = placeId;
            pointKind = 'place';
            break;
          }
        }
      const coords: [number, number] | undefined =
        point &&
        typeof point === 'object' &&
        point.longitude !== undefined &&
        point.latitude !== undefined
          ? [point.longitude, point.latitude]
          : undefined;
      const source = {
        label: 'Wikidata · CC0',
        url: `https://www.wikidata.org/wiki/${id}${entity.lastrevid ? `?oldid=${entity.lastrevid}` : ''}`,
        license: 'CC0-1.0',
      };
      const wikipedia: { en?: string; fr?: string } = {};
      for (const language of ['en', 'fr'] as const) {
        const title = entity.sitelinks?.[`${language}wiki`]?.title;
        if (title)
          wikipedia[language] =
            `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
      }
      const english = label(entity) ?? label(entity, 'fr');
      if (!english) {
        rejected.push({ id, reasons: ['missing-label'] });
        continue;
      }
      const name = { en: english, ...(label(entity, 'fr') ? { fr: label(entity, 'fr')! } : {}) };
      const victorId = entityIds(entity, 'P1346')[0];
      const strengthValue = values(entity, 'P1132')[0];
      const strength =
        typeof strengthValue === 'object' && strengthValue.amount
          ? Number(strengthValue.amount)
          : undefined;
      const event = HistoricalEventSchema.parse({
        id,
        type,
        name,
        start: start.date,
        end,
        coords,
        parentWar: entityIds(entity, 'P361')[0],
        belligerents: entityIds(entity, 'P710').map((entityId) => ({
          side: 'other',
          entityId,
          name: label(entities.get(entityId)) ?? entityId,
        })),
        victor: victorId ? (label(entities.get(victorId)) ?? victorId) : undefined,
        importance: 0,
        era: classifyEra(start.date.year),
        region: classifyRegion(coords),
        sources: [
          source,
          ...(pointKind === 'place'
            ? [
                {
                  label: 'Wikidata · source du lieu',
                  url: `https://www.wikidata.org/wiki/${pointEntity}`,
                  license: 'CC0-1.0',
                },
              ]
            : []),
        ],
        datePrecision: start.datePrecision,
        calendar: start.calendar,
        dateApproximate: start.datePrecision === 'decade' || start.datePrecision === 'century',
        disputed:
          (times.length > 1 &&
            times.some((time) => compareHistDates(time.date, start.date) !== 0)) ||
          points.length > 1,
        wikipedia,
        place: placeIds[0]
          ? { id: placeIds[0], name: label(entities.get(placeIds[0])) ?? placeIds[0] }
          : undefined,
        sitelinks: Object.keys(entity.sitelinks ?? {}).length,
        strength: Number.isFinite(strength) ? strength : undefined,
        coordinateSource: coords
          ? {
              kind: pointKind,
              entityId: pointEntity,
              url: `https://www.wikidata.org/wiki/${pointEntity}#P625`,
            }
          : undefined,
      });
      events.push(event);
    } catch (error) {
      rejected.push({
        id,
        reasons: ['invalid-record'],
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { events, rejected, entities };
}
