import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { HistoricalEventSchema, type HistoricalEvent } from '../../lib/schema';
import { classifyEra } from '../../lib/eras';
import { compareHistDates, parseWikidataTime } from '../../lib/histdate';
import { LOCALES, type EventType } from '../../lib/types';
import { classifyRegion } from './region';
export { classifyRegion } from './region';
import exclusions from '../../data/curated/excluded-classes.json';
import recordExclusions from '../../data/curated/excluded-records.json';
import media from '../../data/curated/medium-classes.json';

export type ClaimValue =
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
      unit?: string;
      lowerBound?: string;
      upperBound?: string;
      before?: number;
      after?: number;
    };
export type Claim = {
  id?: string;
  rank?: string;
  qualifiers?: Record<string, unknown>;
  references?: { snaks?: Record<string, unknown> }[];
  mainsnak?: { datavalue?: { value: ClaimValue } };
};
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
/** A scalar field cannot faithfully represent competing estimates or per-side counts. */
export function scalarQuantity(entity: Entity, property: string): number | undefined {
  const claims = (entity.claims?.[property] ?? []).filter(
    (claim) => claim.rank !== 'deprecated' && claim.mainsnak?.datavalue,
  );
  const preferred = claims.filter((claim) => claim.rank === 'preferred');
  const chosen = preferred.length ? preferred : claims;
  if (!chosen.length || chosen.some((claim) => Object.keys(claim.qualifiers ?? {}).length))
    return undefined;
  const amounts = chosen.map((claim) => claim.mainsnak!.datavalue!.value);
  if (
    amounts.some(
      (value) =>
        typeof value !== 'object' ||
        !value.amount ||
        (value.unit && value.unit !== '1') ||
        (value.lowerBound !== undefined && Number(value.lowerBound) !== Number(value.amount)) ||
        (value.upperBound !== undefined && Number(value.upperBound) !== Number(value.amount)),
    )
  )
    return undefined;
  const numbers = new Set(amounts.map((value) => Number((value as { amount: string }).amount)));
  const number = [...numbers][0]!;
  return numbers.size === 1 && Number.isSafeInteger(number) && number >= 0 ? number : undefined;
}
export function label(entity: Entity | undefined, language = 'en'): string | undefined {
  return entity?.labels?.[language]?.value;
}
export function sourceExclusion(entity: Entity): string | undefined {
  const reviewed = recordExclusions.records.find((record) => record.id === entity.id);
  if (reviewed) return reviewed.reason;
  const instanceClasses = entityIds(entity, 'P31');
  return (
    exclusions.classes.find((entry) => instanceClasses.includes(entry.id)) ??
    exclusions.properties.find((entry) => values(entity, entry.id).length > 0)
  )?.reason;
}

/** Explicit source evidence only: a battle in a naval war need not itself be naval. */
export function sourceBattleMedium(entity: Entity | undefined): 'air' | 'naval' | undefined {
  if (!entity) return undefined;
  const airClasses = media.air.map((entry) => entry.id);
  if (entityIds(entity, 'P31').some((id) => airClasses.includes(id))) return 'air';
  if (
    /\bnaval battle\b/i.test(entity.descriptions?.en?.value ?? '') ||
    /\bbataille navale\b/i.test(entity.descriptions?.fr?.value ?? '')
  )
    return 'naval';
  return undefined;
}

export async function loadEntities(rawDirectory: string): Promise<Map<string, Entity>> {
  const entities = new Map<string, Entity>();
  for (const name of (await readdir(rawDirectory))
    .filter((name) => /^entities-.*\.json$/.test(name) && !name.endsWith('.meta.json'))
    .sort()) {
    const document = JSON.parse(await readFile(join(rawDirectory, name), 'utf8')) as {
      entities: Record<string, Entity>;
    };
    for (const entity of Object.values(document.entities)) {
      if (!entity.id) continue;
      const previous = entities.get(entity.id);
      if (!previous) entities.set(entity.id, entity);
      else {
        const [older, newer] =
          (entity.lastrevid ?? 0) >= (previous.lastrevid ?? 0)
            ? [previous, entity]
            : [entity, previous];
        entities.set(entity.id, {
          ...older,
          ...newer,
          labels: { ...older.labels, ...newer.labels },
        });
      }
    }
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
    const instanceClasses = entityIds(entity, 'P31');
    const exclusion = sourceExclusion(entity);
    if (exclusion) {
      rejected.push({ id, reasons: [exclusion] });
      continue;
    }
    const types = instanceClasses.flatMap((id) => [...(classes.get(id) ?? [])]);
    const sourceType = PRIORITY.find((type) => types.includes(type));
    if (!sourceType) {
      rejected.push({ id, reasons: ['unsupported-class'] });
      continue;
    }
    const navalDescription = sourceType === 'battle' && sourceBattleMedium(entity) === 'naval';
    const type = navalDescription ? 'naval' : sourceType;
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
      if (
        points.some(
          (value) => typeof value === 'object' && value.globe && !value.globe.endsWith('/Q2'),
        )
      ) {
        rejected.push({ id, reasons: ['non-earth-coordinate'] });
        continue;
      }
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
      if (point && typeof point === 'object' && point.globe && !point.globe.endsWith('/Q2')) {
        rejected.push({ id, reasons: ['non-earth-coordinate'] });
        continue;
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
      const wikipedia: NonNullable<HistoricalEvent['wikipedia']> = {};
      for (const language of LOCALES) {
        const title = entity.sitelinks?.[`${language}wiki`]?.title;
        if (title)
          wikipedia[language] =
            `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
      }
      const original = Object.entries(entity.labels ?? {})
        .filter(([, label]) => label.value)
        .sort(([a], [b]) => (a === 'mul' ? -1 : b === 'mul' ? 1 : a.localeCompare(b)))[0];
      const english = label(entity) ?? label(entity, 'fr') ?? original?.[1].value;
      if (!english) {
        rejected.push({ id, reasons: ['missing-label'] });
        continue;
      }
      const name = { en: english, ...(label(entity, 'fr') ? { fr: label(entity, 'fr')! } : {}) };
      const victorId = entityIds(entity, 'P1346')[0];
      const imageValue = values(entity, 'P18')[0];
      const displayPlaceId = pointKind === 'place' ? pointEntity : placeIds[0];
      const event = HistoricalEventSchema.parse({
        id,
        type,
        name,
        description:
          entity.descriptions?.fr?.value || entity.descriptions?.en?.value
            ? { fr: entity.descriptions?.fr?.value, en: entity.descriptions?.en?.value }
            : undefined,
        nameLanguage: label(entity) ? undefined : label(entity, 'fr') ? 'fr' : original?.[0],
        start: start.date,
        end,
        coords,
        parentWar: entityIds(entity, 'P361').find((id) => {
          const parent = entities.get(id);
          return (
            parent &&
            !sourceExclusion(parent) &&
            entityIds(parent, 'P31').some((classId) => classes.has(classId))
          );
        }),
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
          ...Object.entries(wikipedia).map(([language, url]) => ({
            label: `Wikipedia (${language})`,
            url,
            license: 'CC-BY-SA-4.0',
          })),
          ...(navalDescription
            ? [
                {
                  ...source,
                  label: 'Wikidata · classification navale explicite dans la description',
                },
              ]
            : []),
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
          new Set(
            points.map((value) =>
              typeof value === 'object' ? `${value.longitude},${value.latitude}` : '',
            ),
          ).size > 1,
        wikipedia,
        place: displayPlaceId
          ? { id: displayPlaceId, name: label(entities.get(displayPlaceId)) ?? displayPlaceId }
          : undefined,
        sitelinks: Object.keys(entity.sitelinks ?? {}).length,
        strength: scalarQuantity(entity, 'P1132'),
        deaths: scalarQuantity(entity, 'P1120'),
        casualties: scalarQuantity(entity, 'P1590'),
        image:
          typeof imageValue === 'string'
            ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageValue)}?width=960`
            : undefined,
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
