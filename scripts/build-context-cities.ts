import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from '../lib/zod';
import {
  CitiesDatasetSchema,
  CuratedCapitalsSchema,
  documentedFactPeriod,
  type CitiesDataset,
  type CityRecord,
} from '../lib/context/cities';
import { PolityFactsRegistrySchema, PolityFactsProfileSchema } from '../lib/polity-facts';
import { normalizePolityFacts } from '../pipeline/polities/normalize';
import type { Entity } from '../pipeline/normalize';
import type { Source } from '../lib/types';

const ExtractSchema = z.object({
  version: z.literal(1),
  entities: z.record(z.string(), z.unknown()),
});

export function createCitiesDataset(
  registryInput: unknown,
  profilesInput: unknown[],
  extractInput: unknown,
  referenceLocations: Map<string, [number, number]> = new Map(),
  curatedInput?: unknown,
): CitiesDataset {
  const registry = PolityFactsRegistrySchema.parse(registryInput);
  const profiles = profilesInput.map((profile) => PolityFactsProfileSchema.parse(profile));
  const extract = ExtractSchema.parse(extractInput);
  const curated =
    curatedInput === undefined ? undefined : CuratedCapitalsSchema.parse(curatedInput);
  const entities = new Map(
    Object.entries(extract.entities).map(([id, value]) => {
      if (!value || typeof value !== 'object' || !('id' in value) || value.id !== id)
        throw new Error(`Invalid city source identity: ${id}`);
      return [id, value as Entity] as const;
    }),
  );
  const candidates = new Map<string, CityRecord['capitals']>();
  let excludedCapitalAssertions = 0;
  const territories: CitiesDataset['territories'] = [];
  for (const profile of profiles) {
    const mappings = registry.mappings.filter((mapping) => mapping.subjectId === profile.subjectId);
    if (!mappings.length) throw new Error(`Unmapped polity fact profile: ${profile.subjectId}`);
    if (profile.populations.length)
      territories.push({
        subjectId: profile.subjectId,
        name: profile.name,
        mappings,
        populations: profile.populations,
        referenceLocations: mappings.flatMap((mapping) => {
          const coordinates = referenceLocations.get(mapping.polityId);
          return coordinates ? [{ polityId: mapping.polityId, coordinates }] : [];
        }),
      });
    for (const fact of profile.capitals) {
      if (!fact.at && !(fact.start && fact.end)) {
        excludedCapitalAssertions++;
        continue;
      }
      candidates.set(fact.city.id, [
        ...(candidates.get(fact.city.id) ?? []),
        { subjectId: profile.subjectId, subjectName: profile.name, mappings, fact },
      ]);
    }
  }
  for (const addition of curated?.capitals ?? []) {
    const profile = profiles.find((profile) => profile.subjectId === addition.subjectId);
    if (!profile) throw new Error(`Unknown editorial capital subject: ${addition.subjectId}`);
    const mappings = addition.polityIds.map((polityId) => {
      const mapping = registry.mappings.find(
        (mapping) => mapping.polityId === polityId && mapping.subjectId === addition.subjectId,
      );
      if (!mapping) throw new Error(`Unreviewed editorial capital mapping: ${polityId}`);
      return mapping;
    });
    const dates = documentedFactPeriod(addition.fact)!;
    if (
      !mappings.some(
        (mapping) =>
          dates[0] <= (mapping.toYear ?? Infinity) && dates[1] >= (mapping.fromYear ?? -Infinity),
      )
    )
      throw new Error(
        `Editorial capital does not overlap a reviewed identity: ${addition.fact.id}`,
      );
    const capitals = candidates.get(addition.fact.city.id) ?? [];
    if (addition.replacesFactId) {
      const existing = capitals.findIndex(
        (capital) =>
          capital.subjectId === addition.subjectId && capital.fact.id === addition.replacesFactId,
      );
      if (
        existing < 0 ||
        capitals[existing].mappings.some(
          (mapping) => !addition.polityIds.includes(mapping.polityId),
        )
      )
        throw new Error(
          `Editorial capital replacement does not match a complete source role: ${addition.replacesFactId}`,
        );
      capitals.splice(existing, 1);
    }
    capitals.push({
      subjectId: profile.subjectId,
      subjectName: profile.name,
      mappings,
      fact: addition.fact,
    });
    candidates.set(addition.fact.city.id, capitals);
  }
  const cities: CityRecord[] = [];
  const excludedCities: CitiesDataset['coverage']['excludedCities'] = [];
  let rejectedPopulationStatements = 0;
  for (const [id, capitals] of [...candidates].sort(
    ([a], [b]) => Number(a.slice(1)) - Number(b.slice(1)),
  )) {
    const entity = entities.get(id);
    if (!entity) throw new Error(`Source extract does not account for capital place ${id}`);
    const locations = (entity.claims?.P625 ?? [])
      .flatMap((claim) => {
        const raw = claim.mainsnak?.datavalue?.value as
          { longitude?: number; latitude?: number; globe?: string } | undefined;
        if (
          !claim.id ||
          claim.rank === 'deprecated' ||
          !raw ||
          !Number.isFinite(raw.longitude) ||
          !Number.isFinite(raw.latitude) ||
          Math.abs(raw.longitude!) > 180 ||
          Math.abs(raw.latitude!) > 90 ||
          !/^https?:\/\/www\.wikidata\.org\/entity\/Q2$/.test(raw.globe ?? '')
        )
          return [];
        return [{ claim, coordinates: [raw.longitude!, raw.latitude!] as [number, number] }];
      })
      .sort(
        (a, b) =>
          Number(b.claim.rank === 'preferred') - Number(a.claim.rank === 'preferred') ||
          String(a.claim.id).localeCompare(String(b.claim.id)),
      );
    if (!locations.length) {
      excludedCities.push({ id, reason: 'missing-valid-earth-coordinate' });
      continue;
    }
    const normalized = normalizePolityFacts(id, entities);
    rejectedPopulationStatements += normalized.rejected.length;
    const base = entity.lastrevid
      ? `https://www.wikidata.org/w/index.php?title=${id}&oldid=${entity.lastrevid}`
      : `https://www.wikidata.org/wiki/${id}`;
    const coordinateSources: Source[] = locations.map(({ claim }, index) => ({
      label: `Wikidata · P625${index === 0 ? ' · mapped reference point' : ' · alternate source coordinate'}`,
      url: `${base}#${claim.id}`,
      license: 'CC0-1.0',
    }));
    cities.push({
      id,
      name: {
        ...curated?.capitals.find((capital) => capital.fact.city.id === id)?.fact.city.name,
        ...normalized.profile.name,
      },
      coordinates: locations[0].coordinates,
      coordinateSources,
      coordinateVariantCount: new Set(locations.map((location) => location.coordinates.join(',')))
        .size,
      capitals,
      populations: normalized.profile.populations,
    });
  }
  territories.sort((a, b) => Number(a.subjectId.slice(1)) - Number(b.subjectId.slice(1)));
  return CitiesDatasetSchema.parse({
    version: 1,
    cities,
    territories,
    ...(curated
      ? {
          editorial: {
            license: curated.license,
            reviewedAt: curated.reviewedAt,
            capitalFactIds: curated.capitals.map((capital) => capital.fact.id),
          },
        }
      : {}),
    coverage: {
      candidateCities: candidates.size,
      mappedCities: cities.length,
      capitalAssertions: cities.reduce((sum, city) => sum + city.capitals.length, 0),
      excludedCapitalAssertions,
      cityPopulationObservations: cities.reduce((sum, city) => sum + city.populations.length, 0),
      territoryPopulationObservations: territories.reduce(
        (sum, territory) => sum + territory.populations.length,
        0,
      ),
      rejectedPopulationStatements,
      excludedCities,
    },
  });
}

async function main() {
  const root = process.cwd();
  const profileDirectory = join(root, 'public/data/polity-facts');
  const files = (await readdir(profileDirectory))
    .filter((file) => /^Q\d+\.json$/.test(file))
    .sort();
  const readJson = async (file: string) => JSON.parse(await readFile(file, 'utf8')) as unknown;
  const [registry, profiles, extract, geometry, curated] = await Promise.all([
    readJson(join(profileDirectory, 'index.json')),
    Promise.all(files.map((file) => readJson(join(profileDirectory, file)))),
    readJson(join(root, 'data/curated/context-cities-source.json')),
    Promise.all([
      readJson(join(root, 'public/geo/polities.json')),
      readJson(join(root, 'public/geo/entities.json')),
    ]),
    readJson(join(root, 'data/curated/context-capitals.json')),
  ]);
  const locations = z
    .array(z.object({ id: z.string(), center: z.tuple([z.number(), z.number()]).optional() }))
    .parse(geometry.flat());
  const dataset = createCitiesDataset(
    registry,
    profiles,
    extract,
    new Map(
      locations.flatMap((location) =>
        location.center ? [[location.id, location.center] as const] : [],
      ),
    ),
    curated,
  );
  const output = `${JSON.stringify(dataset)}\n`;
  const directory = join(root, 'public/data/context');
  const path = join(directory, 'cities.json');
  if (process.argv.includes('--check')) {
    if ((await readFile(path, 'utf8')) !== output)
      throw new Error(
        'City context data is out of date; rebuild with scripts/build-context-cities.ts',
      );
  } else {
    await mkdir(directory, { recursive: true });
    await writeFile(path, output);
  }
  console.log(
    `City context ${process.argv.includes('--check') ? 'verified' : 'built'}: ${dataset.cities.length} places, ${dataset.coverage.cityPopulationObservations} place-population observations, ${dataset.territories.length} territorial subjects.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
