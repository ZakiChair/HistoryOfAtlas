import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
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
import { compareHistDates, formatHistDate, histDateBounds } from '../../lib/histdate';
import { CURRENT_YEAR } from '../../lib/eras';
import { coordinateIssues, isNearLand, validateChronology } from '../validate';
import { dedupeEvents } from '../normalize/helpers';
import { entityIds, label, normalize, sourceBattleMedium, type Entity } from '../normalize';
import { scoreImportance } from '../score';
import { publishDirectory } from './publish';
import { sourcedRegion } from '../normalize/region';
import { ERA_IDS, REGION_IDS } from '../../lib/types';
import { buildWarGroups } from './war-groups';
import { verifyIdenticalTrees } from './verify';
import { temporalShards } from './shards';
import { buildPeople, compactEvent as compact } from '../normalize/enrichment';

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
async function curate(events: HistoricalEvent[], directory: string): Promise<Set<string>> {
  await mkdir(directory, { recursive: true });
  const path = join(directory, 'events.json');
  try {
    const ids = new Set(
      (JSON.parse(await readFile(path, 'utf8')) as { events: { id: string }[] }).events.map(
        (entry) => entry.id,
      ),
    );
    const available = new Set(events.map((event) => event.id));
    for (const id of ids)
      if (!available.has(id))
        throw new Error(
          `Curated event ${id} is no longer a valid sourced record. Review data/curated/events.json.`,
        );
    return ids;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
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
        nameLanguage: event.nameLanguage,
        source: event.sources[0]!.url,
        reason: `${event.region} / ${event.era}`,
      })),
    },
    true,
  );
  return ids;
}

function buildSequences(
  wars: Map<string, HistoricalEvent[]>,
  entities: Map<string, Entity>,
  selection: { id: string }[],
  editorial?: { id: string; eventIds: string[] }[],
): Campaign[] {
  for (const [id, children] of wars) wars.set(id, children.sort(chronological));
  const selected = new Map<string, [string, HistoricalEvent[]]>();
  for (const entry of editorial ?? selection) {
    const available = wars.get(entry.id) ?? [];
    const ids = 'eventIds' in entry ? (entry.eventIds as string[]) : undefined;
    const children = ids
      ? ids.map((id) => {
          const event = available.find((event) => event.id === id);
          if (!event)
            throw new Error(
              `Curated sequence ${entry.id}: ${id} is no longer a valid sourced child. Review the selection explicitly with --refresh-editorial.`,
            );
          return event;
        })
      : available;
    if (children.length < 2 || !label(entities.get(entry.id)))
      throw new Error(
        `Documentary sequence ${entry.id} has only ${children.length} valid sourced steps. Review data/curated/campaign-selection.json.`,
      );
    selected.set(entry.id, [entry.id, children]);
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
        fr: 'Suite chronologique de lieux attestés par Wikidata (P361 ou P527, directement ou via une campagne intermédiaire). Les lignes relient les événements ; elles ne reconstituent pas le trajet suivi par une armée. Les frontières affichées fournissent un contexte daté, sans attribuer un changement territorial à une bataille.',
        en: 'Chronological sequence of places linked by Wikidata (P361 or P527, directly or through an intermediate campaign). Connecting lines do not reconstruct an army’s actual route. Dated borders provide context without attributing territorial changes to a battle.',
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
  return campaigns;
}

export async function buildEvents(
  root: string,
  options: {
    partial?: boolean;
    skipTiles?: boolean;
    verify?: boolean;
    refreshEditorial?: boolean;
  } = {},
): Promise<void> {
  if (options.verify && options.refreshEditorial)
    throw new Error('Verification cannot refresh the editorial selection.');
  const published = join(root, 'public/data');
  const output = join(root, 'data', `.events-build-${randomUUID()}`);
  try {
    const reports = join(root, 'data/reports');
    if (!options.partial) {
      const acquisition = JSON.parse(
        await readFile(join(root, 'data/raw/wikidata/acquisition.json'), 'utf8'),
      ) as { status: string; schemaVersion?: number };
      if (acquisition.status !== 'complete' || acquisition.schemaVersion !== 2)
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
      'event-shards',
      'people',
      'polity-leaders',
    ].map((name) => (name.includes('/') ? name : join(output, name))))
      await mkdir(directory, { recursive: true });
    const {
      events: normalized,
      rejected,
      entities,
    } = await normalize(join(root, 'data/raw/wikidata'));
    const enrichmentAcquisition = !options.partial
      ? (JSON.parse(
          await readFile(join(root, 'data/raw/wikidata/enrichment-acquisition.json'), 'utf8'),
        ) as {
          schemaVersion: number;
          status: string;
          inputs: Record<string, string>;
          requiredIds: string[];
          polityIds: string[];
          peopleCandidates: number;
          offices: number;
          unavailableIds: string[];
        })
      : undefined;
    if (enrichmentAcquisition) {
      if (enrichmentAcquisition.schemaVersion !== 1 || enrichmentAcquisition.status !== 'complete')
        throw new Error(
          'People enrichment acquisition is incomplete; resume data:build before publication.',
        );
      for (const [path, digest] of Object.entries(enrichmentAcquisition.inputs)) {
        if (
          createHash('sha256')
            .update(await readFile(join(root, path)))
            .digest('hex') !== digest
        )
          throw new Error(`Enrichment source inputs changed: ${path}. Resume data:build.`);
      }
      const unavailable = new Set(enrichmentAcquisition.unavailableIds);
      if (enrichmentAcquisition.requiredIds.some((id) => !entities.has(id) && !unavailable.has(id)))
        throw new Error('A required person or office cache entry is missing. Resume data:build.');
    }
    if (!options.partial && rejected.some((entry) => entry.reasons.includes('not-yet-fetched'))) {
      throw new Error(
        'The cache is missing eligible Wikidata records. Resume data:build before publishing a full acquisition.',
      );
    }
    const land = JSON.parse(
      await readFile(join(root, 'data/raw/geography/ne_10m_land.geojson'), 'utf8'),
    ) as FeatureCollection<Polygon | MultiPolygon>;
    const accepted: HistoricalEvent[] = [];
    const countries = JSON.parse(
      await readFile(join(root, 'data/raw/geography/ne_50m_admin_0_countries.geojson'), 'utf8'),
    );
    const context: HistoricalEvent[] = [];
    for (const event of dedupeEvents(normalized)) {
      const issues = [
        ...coordinateIssues(event.coords),
        ...validateChronology(event.start, event.end, event.calendar),
      ];
      if (event.start.year < -3500 || event.start.year > CURRENT_YEAR)
        issues.push('outside-atlas-period');
      if (
        !issues.length &&
        ['battle', 'siege', 'conquest'].includes(event.type) &&
        sourceBattleMedium(entities.get(event.id)) !== 'air' &&
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
      } else {
        event.region = sourcedRegion(event.coords!, countries);
        accepted.push(event);
      }
    }
    const curated = options.partial
      ? new Set<string>()
      : await curate(accepted, join(root, 'data/curated'));
    const taxonomy = JSON.parse(
      await readFile(join(root, 'data/raw/wikidata/taxonomy.json'), 'utf8'),
    ) as { results: { bindings: { class: { value: string } }[] } };
    const militaryClasses = new Set(
      taxonomy.results.bindings.map((row) => row.class.value.split('/').pop()!),
    );
    const relations = buildWarGroups(
      [...accepted, ...context],
      entities,
      militaryClasses,
      new Set(
        rejected
          .filter((entry) => entry.reasons.includes('invalid-record'))
          .map((entry) => entry.id),
      ),
    );
    const wars = relations.wars;
    for (const event of [...accepted, ...context]) {
      const valid = relations.directParents.get(event.id) ?? [];
      if (!valid.includes(event.parentWar ?? '')) {
        if (valid.length) event.parentWar = valid[0];
        else delete event.parentWar;
      }
    }
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
    const enrichment = buildPeople(
      [...accepted, ...context],
      entities,
      new Set(enrichmentAcquisition?.polityIds ?? []),
    );
    for (const person of enrichment.people)
      await json(join(output, `people/${person.id}.json`), person);
    await json(
      join(output, 'people-index.json'),
      enrichment.people.map((person) => ({
        id: person.id,
        name: person.name,
        year: person.birth?.[0]?.date.year,
        aliases: [
          person.description?.fr,
          person.description?.en,
          ...person.tenures.map((tenure) => tenure.office?.name.en),
        ]
          .filter(Boolean)
          .join(' '),
      })),
    );
    for (const polity of enrichment.polities)
      await json(join(output, `polity-leaders/${polity.polityId}.json`), polity);
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
    let editorialCampaigns: { id: string; eventIds: string[] }[] | undefined;
    try {
      if (options.refreshEditorial || options.partial) {
        const error = new Error('Explicit editorial refresh') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        throw error;
      }
      editorialCampaigns = JSON.parse(
        await readFile(join(root, 'data/curated/campaigns.json'), 'utf8'),
      ).campaigns;
      if (!Array.isArray(editorialCampaigns))
        throw new Error('Invalid campaign editorial selection.');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const selection = JSON.parse(
      await readFile(join(root, 'data/curated/campaign-selection.json'), 'utf8'),
    ) as { campaigns: { id: string }[]; storyIds: string[] };
    const campaigns = buildSequences(
      wars,
      entities,
      options.partial
        ? selection.campaigns.filter(
            (entry) => (wars.get(entry.id)?.length ?? 0) >= 2 && label(entities.get(entry.id)),
          )
        : selection.campaigns,
      editorialCampaigns,
    );
    const warCatalog = [];
    for (const [id, events] of wars) {
      await json(join(output, `wars/${id}.json`), events.map(compact));
      const entity = entities.get(id);
      const latest = events.reduce((latest, event) =>
        compareHistDates(
          histDateBounds(event.end ?? event.start, event.calendar).latest,
          histDateBounds(latest.end ?? latest.start, latest.calendar).latest,
        ) > 0
          ? event
          : latest,
      );
      warCatalog.push({
        id,
        name: {
          en: label(entity) ?? id,
          ...(label(entity, 'fr') ? { fr: label(entity, 'fr') } : {}),
        },
        count: events.length,
        start: events[0]!.start,
        end: latest.end ?? latest.start,
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
    for (const campaign of campaigns) {
      const notice = [...accepted, ...context].find((event) => event.id === campaign.id);
      if (notice?.people?.length) campaign.people = notice.people;
    }
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
    const previousStories = (await readdir(storyDirectory)).filter((name) =>
      name.endsWith('.json'),
    );
    const eventIndex = new Map(accepted.map((event) => [event.id, event]));
    const selectedStories = selection.storyIds
      .filter((id) => !options.partial || campaigns.some((entry) => entry.id === id))
      .map((id) => {
        const campaign = campaigns.find((entry) => entry.id === id);
        if (!campaign)
          throw new Error(`Story selection ${id} is not an available documentary sequence.`);
        return campaign;
      });
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
    if (previousStories.length && !options.refreshEditorial && !options.partial)
      stories = await Promise.all(
        previousStories
          .sort()
          .map(async (name) =>
            StorySchema.parse(JSON.parse(await readFile(join(storyDirectory, name), 'utf8'))),
          ),
      );
    else if (!options.partial) {
      if (options.refreshEditorial)
        for (const name of previousStories) await rm(join(storyDirectory, name));
      for (const story of generatedStories)
        await json(join(storyDirectory, `${story.id}.json`), story, true);
    }
    for (const story of stories)
      for (const step of story.steps)
        if (step.eventId && !eventIndex.has(step.eventId))
          throw new Error(
            `Story ${story.id}: ${step.eventId} is no longer a valid event. Review the versioned story.`,
          );
    await json(
      join(output, 'stories.json'),
      stories.sort((a, b) => a.id.localeCompare(b.id)),
    );
    if (!options.partial && !editorialCampaigns)
      await json(
        join(root, 'data/curated/campaigns.json'),
        {
          status: 'source-verified-documentary-selection',
          method:
            'Forty explicit QIDs reviewed from the sourced catalog in campaign-selection.json, with geographically and chronologically varied coverage. P361/P527 membership is checked against source date precision and cycles are quarantined. The forty most documented eligible steps per sequence are retained. Lines are not reconstructed military routes. Future builds preserve this selection; refresh requires --refresh-editorial.',
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
    const warMemberships = new Map<string, string[]>();
    for (const [id, children] of wars)
      for (const event of children)
        warMemberships.set(event.id, [...(warMemberships.get(event.id) ?? []), id]);
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
          wars: `|${(warMemberships.get(event.id) ?? []).sort().join('|')}|`,
          entities: `|${event.belligerents.map((participant) => participant.entityId).join('|')}|`,
          name_fr: event.name.fr ?? event.name.en,
          name_en: event.name.en,
        },
      })),
    };
    await json(join(root, 'data/events.geojson'), geojson);
    const eventPartitions = temporalShards(accepted);
    const eventShards = eventPartitions.map(
      ({ key, start, end, validFrom, validTo, path, count }) => ({
        key,
        start,
        end,
        validFrom,
        validTo,
        path,
        count,
      }),
    );
    if (!options.skipTiles && accepted.length) {
      const compileTiles = (destination: string, input: string, name: string) => {
        const result = spawnSync(
          'tippecanoe',
          [
            '--force',
            '--output',
            destination,
            '--name',
            name,
            '--description',
            'Dated and geolocated military events; Wikidata CC0',
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
            input,
          ],
          { encoding: 'utf8', cwd: output },
        );
        if (result.status !== 0)
          throw new Error(`tippecanoe failed: ${result.error?.message ?? result.stderr}`);
      };
      compileTiles('events.pmtiles', '../../data/events.geojson', 'Atlas Belli · Wikidata events');
      const featureById = new Map(
        geojson.features.map((feature) => [feature.properties.id, feature]),
      );
      for (const shard of eventPartitions) {
        await json(join(output, '.shard-input.geojson'), {
          type: 'FeatureCollection',
          features: shard.events.map((event) => featureById.get(event.id)!),
        });
        compileTiles(
          `event-shards/${shard.key}.pmtiles`,
          '.shard-input.geojson',
          `Atlas Belli · Wikidata events · ${shard.key}`,
        );
      }
      await rm(join(output, '.shard-input.geojson'));
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
    const notices = [...accepted, ...context];
    const peopleLinks = notices.flatMap((event) => event.people ?? []);
    const tenures = enrichment.people.flatMap((person) => person.tenures);
    const enrichmentReport = {
      version: 1,
      builtAt,
      totalPeople: enrichment.people.length,
      totalEventNotices: notices.length,
      geolocatedEvents: accepted.length,
      eventsWithDescription: notices.filter(
        (event) => event.description?.fr || event.description?.en,
      ).length,
      descriptionsByLanguage: {
        fr: notices.filter((event) => event.description?.fr).length,
        en: notices.filter((event) => event.description?.en).length,
      },
      eventsWithPeople: notices.filter((event) => event.people?.length).length,
      commanderLinks: peopleLinks.filter((link) => link.role === 'commander').length,
      participantLinks: peopleLinks.filter((link) => link.role === 'participant').length,
      tenures: tenures.length,
      tenuresWithBothBounds: tenures.filter((tenure) => tenure.start?.length && tenure.end?.length)
        .length,
      peopleWithBirth: enrichment.people.filter((person) => person.birth?.length).length,
      peopleWithDeath: enrichment.people.filter((person) => person.death?.length).length,
      polityCatalogs: enrichment.polities.length,
      polityCatalogsWithLeaders: enrichment.polities.filter((polity) => polity.leaders.length)
        .length,
      acquisition: enrichmentAcquisition
        ? {
            peopleCandidates: enrichmentAcquisition.peopleCandidates,
            offices: enrichmentAcquisition.offices,
            unavailableIds: enrichmentAcquisition.unavailableIds,
          }
        : { status: 'partial' },
      rejections: enrichment.rejected.length,
      rejectionCounts: enrichment.rejected.reduce<Record<string, number>>((counts, entry) => {
        counts[entry.reason] = (counts[entry.reason] ?? 0) + 1;
        return counts;
      }, {}),
      methods: [
        'Descriptions are copied from Wikidata and remain separate from Wikipedia summaries fetched only when a dossier is opened.',
        'Command requires explicit P4791, including qualifiers of a P710 participant. P710, P607 and P1344 alone only establish participation.',
        'All non-deprecated P35, P6 and P39 statements are retained, including historical normal-rank office holders when a preferred current holder exists.',
        'Office jurisdiction requires P1001; head-of-state/government classification of P39 requires the polity to explicitly identify that office with P1906/P1313.',
        'People must have a sourced human classification. Invalid dates, nonhuman candidates and definitely incompatible event/lifetime links are quarantined.',
        'No reign, command role, conquest or territorial consequence is inferred from birth country, name similarity, political position or chronological proximity.',
        'Each date and relation retains its Wikidata statement and available bibliographic references. Community assertions without external references are not independent historical verification.',
      ],
    };
    await json(join(output, 'enrichment.json'), enrichmentReport);
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
      eventsPmtiles: options.skipTiles ? undefined : '/data/events.pmtiles',
      eventShards: options.skipTiles ? [] : eventShards,
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
      originalLanguageFallbacks: accepted.filter((event) => event.nameLanguage).length,
      editorialSelection: curated.size,
      chronologicalSequences: campaigns.length,
      temporalTilePartitions: options.skipTiles ? 0 : eventShards.length,
      militaryRelations: {
        rejected: relations.rejected.length,
        byReason: relations.rejected.reduce<Record<string, number>>((counts, relation) => {
          counts[relation.reason] = (counts[relation.reason] ?? 0) + 1;
          return counts;
        }, {}),
        note: 'Relations are quarantined independently of event records. Missing source dates, incompatible intervals, cycles and political waves are not treated as chronological military membership.',
      },
      editorialCoverage: {
        byRegion: countBy(
          accepted.filter((event) => curated.has(event.id)),
          'region',
        ),
        byEra: countBy(
          accepted.filter((event) => curated.has(event.id)),
          'era',
        ),
      },
      sequenceCoverage: (() => {
        const steps = dedupeEvents(
          campaigns.flatMap((campaign) =>
            campaign.steps.flatMap((step) =>
              step.eventId && eventIndex.has(step.eventId) ? [eventIndex.get(step.eventId)!] : [],
            ),
          ),
        );
        const byRegion = countBy(steps, 'region');
        const byEra = countBy(steps, 'era');
        return {
          byRegion,
          byEra,
          regionsWithoutSteps: REGION_IDS.filter(
            (region) => region !== 'global' && !byRegion[region],
          ),
          erasWithoutSteps: ERA_IDS.filter((era) => !byEra[era]),
          note: 'Coverage counts distinct sourced event steps. Empty cells identify documentary gaps, not an absence of historical conflict.',
        };
      })(),
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
        'Region categories use Natural Earth geographic regions with a coordinate fallback offshore; they do not imply modern or historical sovereignty.',
        'P710 participants are not assigned invented opposing sides.',
        'P361/P527 chronological links are not reconstructed army routes.',
        'A 25 km coastline tolerance accommodates Natural Earth generalization and small islands.',
        'The event editorial seed balances available region/era groups; the forty documentary sequences are selected from the sourced catalog. Scholarly editorial review remains necessary.',
        'Undated parent groups are quarantined, including Q1258062 (Roman conquest of Britain). No campaign dates are invented to fill coverage gaps.',
      ],
    };
    await json(join(output, 'quality.json'), { ...report, rejected: undefined });
    if (options.verify) {
      const verification = await verifyIdenticalTrees(output, published);
      await json(
        join(reports, 'idempotence.json'),
        { status: 'identical', sourceBuiltAt: builtAt, ...verification },
        true,
      );
      await rm(output, { recursive: true, force: true });
      console.log(`Idempotence verified: ${verification.files} files have identical bytes.`);
    } else {
      await publishDirectory(output, published);
      await json(join(reports, 'quality.json'), report, true);
      await json(
        join(reports, 'enrichment.json'),
        { ...enrichmentReport, rejected: enrichment.rejected },
        true,
      );
      await json(
        join(reports, 'relations.json'),
        { method: report.militaryRelations.note, rejected: relations.rejected },
        true,
      );
    }
    console.log(
      `Built ${accepted.length} dated, geolocated events; ${context.length} context records; ${campaigns.length} sequences. Rejections: ${JSON.stringify(reasons)}`,
    );
  } catch (error) {
    await rm(output, { recursive: true, force: true });
    throw error;
  }
}
