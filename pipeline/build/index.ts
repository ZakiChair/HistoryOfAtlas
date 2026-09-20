import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import {
  CampaignSchema,
  DataManifestSchema,
  StorySchema,
  type Campaign,
  type HistoricalEvent,
} from '../../lib/schema';
import { compareHistDates, formatHistDate } from '../../lib/histdate';
import { CURRENT_YEAR } from '../../lib/eras';
import { coordinateIssues, isNearLand, validateChronology } from '../validate';
import { dedupeEvents } from '../normalize/helpers';
import { entityIds, label, normalize, type Entity } from '../normalize';
import { scoreImportance } from '../score';

const SOURCE = { label: 'Wikidata', url: 'https://www.wikidata.org/', license: 'CC0-1.0' };
function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const value = key(item);
    groups.set(value, [...(groups.get(value) ?? []), item]);
  }
  return groups;
}
const json = (path: string, value: unknown, pretty = false) =>
  writeFile(path, `${JSON.stringify(value, null, pretty ? 2 : undefined)}\n`);
const chronological = (a: HistoricalEvent, b: HistoricalEvent) =>
  compareHistDates(a.start, b.start) || a.id.localeCompare(b.id);
const countBy = (events: HistoricalEvent[], property: 'type' | 'era' | 'region') =>
  events.reduce<Record<string, number>>(
    (counts, event) => ({ ...counts, [event[property]]: (counts[event[property]] ?? 0) + 1 }),
    {},
  );
function compact(event: HistoricalEvent): HistoricalEvent {
  const entry = { ...event };
  delete entry.summary;
  delete entry.image;
  delete entry.strength;
  delete entry.casualties;
  return entry;
}

async function curate(events: HistoricalEvent[], directory: string): Promise<Set<string>> {
  await mkdir(directory, { recursive: true });
  const path = join(directory, 'events.json');
  try {
    return new Set(
      (JSON.parse(await readFile(path, 'utf8')) as { events: { id: string }[] }).events.map(
        (entry) => entry.id,
      ),
    );
  } catch {
    /* Bootstrap a reviewable, versioned selection from sourced records only. */
  }
  const ranked = [...events].sort(
    (a, b) => (b.sitelinks ?? 0) - (a.sitelinks ?? 0) || a.id.localeCompare(b.id),
  );
  const ids = new Set<string>();
  const groups = groupBy(ranked, (event) => `${event.region}/${event.era}`);
  for (const group of groups.values()) for (const event of group.slice(0, 4)) ids.add(event.id);
  for (const event of ranked) {
    if (ids.size >= 240) break;
    ids.add(event.id);
  }
  const selected = ranked.filter((event) => ids.has(event.id));
  await json(
    path,
    {
      version: 1,
      status: 'source-verified-editorial-seed',
      method:
        'Wikidata sitelink ranking, with four records per populated region/era stratum. This is a reproducible editorial starting selection, not an expert historical canon.',
      events: selected.map((event) => ({
        id: event.id,
        name: event.name,
        source: event.sources[0]!.url,
        reason: `${event.region} / ${event.era}`,
      })),
    },
    true,
  );
  return ids;
}

function buildSequences(
  events: HistoricalEvent[],
  entities: Map<string, Entity>,
): { wars: Map<string, HistoricalEvent[]>; campaigns: Campaign[] } {
  const byId = new Map(events.map((event) => [event.id, event]));
  const wars = new Map<string, HistoricalEvent[]>();
  for (const event of events) {
    if (event.parentWar && event.coords)
      wars.set(event.parentWar, [...(wars.get(event.parentWar) ?? []), event]);
  }
  for (const entity of entities.values()) {
    const children = entityIds(entity, 'P527').flatMap((id) =>
      byId.get(id)?.coords ? [byId.get(id)!] : [],
    );
    if (children.length >= 2)
      wars.set(entity.id, dedupeEvents([...(wars.get(entity.id) ?? []), ...children]));
  }
  for (const [id, children] of wars) wars.set(id, children.sort(chronological));
  const eligible = [...wars.entries()]
    .filter(([id, children]) => children.length >= 3 && label(entities.get(id)))
    .sort((a, b) => {
      const campaignA = byId.get(a[0])?.type === 'campaign' ? 100 : 0;
      const campaignB = byId.get(b[0])?.type === 'campaign' ? 100 : 0;
      return (
        campaignB +
        b[1].reduce((sum, event) => sum + event.importance, 0) -
        (campaignA + a[1].reduce((sum, event) => sum + event.importance, 0))
      );
    });
  const selected = new Map<string, [string, HistoricalEvent[]]>();
  const strata = new Set<string>();
  for (const entry of eligible) {
    const counts = countBy(entry[1], 'region');
    const dominantRegion = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]![0];
    const stratum = `${dominantRegion}/${entry[1][0]!.era}`;
    if (!strata.has(stratum) && selected.size < 40) {
      strata.add(stratum);
      selected.set(entry[0], entry);
    }
  }
  for (const entry of eligible) {
    if (selected.size >= 40) break;
    selected.set(entry[0], entry);
  }
  const campaigns: Campaign[] = [...selected.values()].map(([id, children]) => {
    const entity = entities.get(id)!;
    const polity = entityIds(entity, 'P710')
      .map((id) => label(entities.get(id)))
      .filter(Boolean)
      .join(' · ');
    return CampaignSchema.parse({
      id,
      name: { en: label(entity)!, ...(label(entity, 'fr') ? { fr: label(entity, 'fr') } : {}) },
      polity: polity || '—',
      description: {
        fr: 'Suite chronologique de lieux attestés par Wikidata (P361 ou P527). Les lignes relient les événements ; elles ne reconstituent pas le trajet suivi par une armée. Les frontières affichées fournissent un contexte daté, sans attribuer un changement territorial à une bataille.',
        en: 'Chronological sequence of places linked by Wikidata (P361 or P527). Connecting lines do not reconstruct an army’s actual route. Dated borders provide context without attributing territorial changes to a battle.',
      },
      sources: [
        {
          label: 'Wikidata · P361/P527',
          url: `https://www.wikidata.org/wiki/${id}`,
          license: 'CC0-1.0',
        },
      ],
      steps: [...children]
        .sort((a, b) => b.importance - a.importance || chronological(a, b))
        .slice(0, 40)
        .sort(chronological)
        .map((event) => ({
          eventId: event.id,
          coords: event.coords!,
          date: event.start,
          label: event.name.fr ?? event.name.en,
          sources: event.sources,
        })),
    });
  });
  return { wars, campaigns };
}

export async function buildEvents(
  root: string,
  options: { partial?: boolean; skipTiles?: boolean } = {},
): Promise<void> {
  const output = join(root, 'public/data');
  const reports = join(root, 'data/reports');
  if (!options.partial) {
    const acquisition = JSON.parse(
      await readFile(join(root, 'data/raw/wikidata/acquisition.json'), 'utf8'),
    ) as { status: string };
    if (acquisition.status !== 'complete')
      throw new Error(
        'Wikidata acquisition is incomplete. Resume data:build or explicitly use --partial.',
      );
  }
  for (const directory of [
    output,
    reports,
    'chunks',
    'events',
    'wars',
    'search',
    'on-this-day',
  ].map((name) => (name.includes('/') ? name : join(output, name))))
    await mkdir(directory, { recursive: true });
  const {
    events: normalized,
    rejected,
    entities,
  } = await normalize(join(root, 'data/raw/wikidata'));
  const land = JSON.parse(
    await readFile(join(root, 'data/raw/geography/ne_50m_land.geojson'), 'utf8'),
  ) as FeatureCollection<Polygon | MultiPolygon>;
  const accepted: HistoricalEvent[] = [];
  const context: HistoricalEvent[] = [];
  for (const event of dedupeEvents(normalized)) {
    const issues = [
      ...coordinateIssues(event.coords),
      ...validateChronology(event.start, event.end),
    ];
    if (event.start.year < -3500 || event.start.year > CURRENT_YEAR)
      issues.push('outside-atlas-period');
    if (
      !issues.length &&
      ['battle', 'siege', 'conquest'].includes(event.type) &&
      !isNearLand(event.coords!, land)
    )
      issues.push('land-event-in-open-ocean');
    if (issues.length) {
      rejected.push({ id: event.id, reasons: issues });
      if (
        issues.length === 1 &&
        issues[0] === 'missing-coordinates' &&
        ['war', 'campaign', 'treaty'].includes(event.type)
      )
        context.push(event);
    } else accepted.push(event);
  }
  const curated = options.partial
    ? new Set<string>()
    : await curate(accepted, join(root, 'data/curated'));
  const parentCounts = new Map<string, number>();
  for (const event of accepted)
    if (event.parentWar)
      parentCounts.set(event.parentWar, (parentCounts.get(event.parentWar) ?? 0) + 1);
  for (const event of [...accepted, ...context])
    event.importance = scoreImportance({
      sitelinks: event.sitelinks ?? 0,
      curated: curated.has(event.id),
      parentSize: parentCounts.get(event.parentWar ?? '') ?? 0,
      strength: event.strength,
    });
  accepted.sort(chronological);
  const groups = new Map<string, HistoricalEvent[]>();
  for (const event of accepted) {
    const width = event.start.year >= 1800 ? 10 : 100;
    const key = String(Math.floor(event.start.year / width) * width);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  const chunks = [];
  for (const [key, events] of groups) {
    const records = events.map(compact);
    await json(join(output, `chunks/${key}.json`), records);
    await json(
      join(output, `search/${key}.json`),
      records.map((event) => ({
        id: event.id,
        name: event.name,
        start: event.start,
        coords: event.coords,
        type: event.type,
        region: event.region,
        importance: event.importance,
        aliases: [
          event.place?.name,
          ...event.belligerents.map((participant) => participant.name),
          label(entities.get(event.parentWar ?? '')),
        ]
          .filter(Boolean)
          .join(' '),
      })),
    );
    chunks.push({
      key,
      path: `/data/chunks/${key}.json`,
      start: Math.min(...events.map((event) => event.start.year)),
      end: Math.max(...events.map((event) => event.end?.year ?? event.start.year)),
      count: events.length,
    });
  }
  for (const event of [...accepted, ...context])
    await json(join(output, `events/${event.id}.json`), event);
  const { wars, campaigns } = buildSequences([...accepted, ...context], entities);
  const warCatalog = [];
  for (const [id, events] of wars) {
    await json(join(output, `wars/${id}.json`), events.map(compact));
    const entity = entities.get(id);
    warCatalog.push({
      id,
      name: {
        en: label(entity) ?? id,
        ...(label(entity, 'fr') ? { fr: label(entity, 'fr') } : {}),
      },
      count: events.length,
      start: events[0]!.start,
      end: events.at(-1)!.end ?? events.at(-1)!.start,
      belligerents: entity
        ? entityIds(entity, 'P710').map((entityId) => ({
            entityId,
            name: label(entities.get(entityId)) ?? entityId,
          }))
        : [],
      path: `/data/wars/${id}.json`,
      source: `https://www.wikidata.org/wiki/${id}`,
    });
  }
  await json(join(output, 'wars.json'), warCatalog);
  await json(join(output, 'campaigns.json'), campaigns);
  for (const [key, events] of groupBy(
    accepted.filter((event) => event.start.month && event.start.day),
    (event) =>
      `${String(event.start.month).padStart(2, '0')}-${String(event.start.day).padStart(2, '0')}`,
  )) {
    await json(
      join(output, 'on-this-day', `${key}.json`),
      events.sort((a, b) => b.importance - a.importance).map(compact),
    );
  }
  const storyDirectory = join(root, 'content/stories');
  await mkdir(storyDirectory, { recursive: true });
  const previousStories = (await readdir(storyDirectory)).filter((name) => name.endsWith('.json'));
  const eventIndex = new Map(accepted.map((event) => [event.id, event]));
  const regional = new Map<string, Campaign>();
  for (const campaign of campaigns) {
    const counts = new Map<string, number>();
    for (const step of campaign.steps) {
      const region = eventIndex.get(step.eventId ?? '')?.region;
      if (region) counts.set(region, (counts.get(region) ?? 0) + 1);
    }
    const region = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'global';
    if (!regional.has(region)) regional.set(region, campaign);
  }
  const selectedStories = [
    ...new Map(
      [...regional.values(), ...campaigns].map((campaign) => [campaign.id, campaign]),
    ).values(),
  ].slice(0, 10);
  const generatedStories = selectedStories.map((campaign) =>
    StorySchema.parse({
      id: campaign.id,
      title: campaign.name,
      description: {
        fr: 'Un parcours de lieux et de dates documentés. Chaque étape conserve sa source ; les frontières montrent le contexte de la période.',
        en: 'A journey through documented places and dates. Each step retains its source; borders show the context of the period.',
      },
      sources: campaign.sources,
      steps: campaign.steps.slice(0, 40).map((step) => {
        const event = eventIndex.get(step.eventId!);
        return {
          eventId: step.eventId,
          text: {
            fr: `${event?.name.fr ?? event?.name.en ?? step.label} — ${formatHistDate(step.date, 'fr')}. ${event?.place ? `Lieu indiqué par la source : ${event.place.name}.` : 'Localisation indiquée par Wikidata.'}`,
            en: `${event?.name.en ?? step.label} — ${formatHistDate(step.date, 'en')}. ${event?.place ? `Place recorded by the source: ${event.place.name}.` : 'Location recorded by Wikidata.'}`,
          },
        };
      }),
    }),
  );
  let stories = generatedStories;
  if (previousStories.length)
    stories = await Promise.all(
      previousStories
        .sort()
        .map(async (name) =>
          StorySchema.parse(JSON.parse(await readFile(join(storyDirectory, name), 'utf8'))),
        ),
    );
  else if (!options.partial)
    for (const story of generatedStories)
      await json(join(storyDirectory, `${story.id}.json`), story, true);
  await json(join(output, 'stories.json'), stories.sort((a, b) => a.id.localeCompare(b.id)));
  if (!options.partial)
    await json(
      join(root, 'data/curated/campaigns.json'),
      {
        method:
          'Chronological P361/P527 event links, source-verified; not reconstructed military routes.',
        campaigns: campaigns.map((campaign) => ({
          id: campaign.id,
          name: campaign.name,
          eventIds: campaign.steps.map((step) => step.eventId),
          sources: campaign.sources,
        })),
      },
      true,
    );
  const coverage = {
    byType: countBy(accepted, 'type'),
    byEra: countBy(accepted, 'era'),
    byRegion: countBy(accepted, 'region'),
  };
  const density = [...groupBy(accepted, (event) => event.start.year)]
    .map(([year, events]) => ({ year, count: events.length }))
    .sort((a, b) => a.year - b.year);
  const geojson = {
    type: 'FeatureCollection',
    features: accepted.map((event) => ({
      type: 'Feature',
      id: Number(event.id.slice(1)),
      geometry: { type: 'Point', coordinates: event.coords },
      properties: {
        id: event.id,
        start: event.start.year,
        end: event.end?.year ?? event.start.year,
        importance: event.importance,
        type: event.type,
        era: event.era,
        region: event.region,
        parentWar: event.parentWar ?? '',
        entities: `|${event.belligerents.map((participant) => participant.entityId).join('|')}|`,
        name_fr: event.name.fr ?? event.name.en,
        name_en: event.name.en,
      },
    })),
  };
  await json(join(root, 'data/events.geojson'), geojson);
  if (!options.skipTiles && accepted.length) {
    const result = spawnSync(
      'tippecanoe',
      [
        '--force',
        '--output',
        join(output, 'events.pmtiles'),
        '--layer',
        'events',
        '--minimum-zoom',
        '0',
        '--maximum-zoom',
        '8',
        '--base-zoom',
        '0',
        '--drop-rate',
        '1',
        '--no-feature-limit',
        '--no-tile-size-limit',
        join(root, 'data/events.geojson'),
      ],
      { encoding: 'utf8' },
    );
    if (result.status !== 0)
      throw new Error(`tippecanoe failed: ${result.error?.message ?? result.stderr}`);
  }
  const metadataFiles = (await readdir(join(root, 'data/raw/wikidata'))).filter((name) =>
    name.endsWith('.meta.json'),
  );
  const timestamps = await Promise.all(
    metadataFiles.map(
      async (name) =>
        (
          JSON.parse(await readFile(join(root, 'data/raw/wikidata', name), 'utf8')) as {
            fetchedAt: string;
          }
        ).fetchedAt,
    ),
  );
  const builtAt = timestamps.sort().at(-1) ?? 'unknown';
  const manifest = DataManifestSchema.parse({
    version: 1,
    builtAt,
    totalEvents: accepted.length,
    chunks,
    density,
    coverage,
    sources: [
      SOURCE,
      {
        label: 'Natural Earth · validation des côtes',
        url: 'https://www.naturalearthdata.com/about/terms-of-use/',
        license: 'Public domain',
      },
    ],
    eventsPmtiles: '/data/events.pmtiles',
    searchIndex: '/data/search-manifest.json',
    campaigns: '/data/campaigns.json',
  });
  await json(join(output, 'manifest.json'), manifest);
  await json(join(output, 'search-manifest.json'), {
    chunks: chunks.map((chunk) => ({ ...chunk, path: `/data/search/${chunk.key}.json` })),
  });
  await json(
    join(output, 'curated.json'),
    (options.partial
      ? [...accepted].sort((a, b) => b.importance - a.importance).slice(0, 240)
      : accepted.filter((event) => curated.has(event.id))
    )
      .sort((a, b) => b.importance - a.importance)
      .map(compact),
  );
  const reasons: Record<string, number> = {};
  for (const rejection of rejected)
    for (const reason of rejection.reasons) reasons[reason] = (reasons[reason] ?? 0) + 1;
  const report = {
    builtAt,
    status: options.partial ? 'partial-acquisition' : 'complete-acquisition',
    totalCandidates: accepted.length + rejected.length,
    normalized: normalized.length,
    geolocatedDatedEvents: accepted.length,
    contextRecords: context.length,
    uniqueQids: new Set(accepted.map((event) => event.id)).size,
    withProvenance: accepted.filter((event) => event.sources.length > 0).length,
    editorialSelection: curated.size,
    chronologicalSequences: campaigns.length,
    coverage,
    rejectionCounts: reasons,
    rejected: rejected.sort((a, b) => a.id.localeCompare(b.id)),
    acceptance: {
      target: 20000,
      met: accepted.length >= 20000,
      note: 'Coverage is measured, not inflated. Wikidata does not supply valid dates and coordinates for every military event.',
    },
    limitations: [
      'Wikidata coverage differs greatly by period, region and language.',
      'Dates and coordinates are community assertions, not independently verified historical findings.',
      'P276 coordinates locate the named place; they do not establish the exact battlefield location.',
      'Region categories are broad navigation bins based on coordinates; they do not imply modern or historical sovereignty.',
      'P710 participants are not assigned invented opposing sides.',
      'P361/P527 chronological links are not reconstructed army routes.',
      'A 25 km coastline tolerance accommodates Natural Earth generalization and small islands.',
      'Editorial seeds balance available region/era groups; scholarly editorial review remains necessary.',
    ],
  };
  await json(join(reports, 'quality.json'), report, true);
  await json(join(output, 'quality.json'), { ...report, rejected: undefined });
  console.log(
    `Built ${accepted.length} dated, geolocated events; ${context.length} context records; ${campaigns.length} sequences. Rejections: ${JSON.stringify(reasons)}`,
  );
}
