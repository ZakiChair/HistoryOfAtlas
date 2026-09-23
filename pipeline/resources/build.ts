import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import {
  ResourceDatasetSchema,
  type ResourceSource,
  type ResourceSite,
} from '../../lib/resources/types';
import { normalizeGemSites, type GemRow } from './normalize';
import { reconcileResourceSites, type ResourceReconciliation } from './reconcile';
import { appendResourceObservations, type ResourceObservationUpdate } from './observations';
import { appendResourceKnowledge, type ResourceKnowledgeUpdate } from './knowledge';
import {
  normalizeSodirSites,
  reconcileNorwegianFields,
  type SodirField,
  type SodirProduction,
} from './sodir';

const directory = new URL('./sources/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8')) as {
  downloadedAt: string;
};
function load<T>(name: string): T[] {
  return JSON.parse(
    gunzipSync(readFileSync(new URL(`${name}.json.gz`, directory))).toString('utf8'),
  ) as T[];
}

const sources: ResourceSource[] = [
  {
    id: 'sodir-production',
    name: 'Norwegian Offshore Directorate — annual field production, September 2026',
    url: 'https://factpages.sodir.no/en/field/TableView/Production/Saleable/Yearly',
    license: 'Norwegian Licence for Open Government Data (NLOD) 2.0',
    licenseUrl: 'https://data.norge.no/nlod/en/2.0',
    year: 2026,
    description:
      'Annual positive saleable oil and gas production, joined by official field identifier to WGS84 field centroids from FactMaps. Adjacent observation years are combined only for identical fuel categories. Gaps remain gaps; 2026 is a partial year. No NGL or condensate is relabelled as crude oil. Matching Norwegian GEM fields are replaced using official name and consistent geography.',
  },
  {
    id: 'gem-goget',
    name: 'Global Energy Monitor — Global Oil and Gas Extraction Tracker, March 2026',
    url: 'https://globalenergymonitor.org/projects/global-oil-gas-extraction-tracker',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    year: 2026,
    description:
      'March 2026 public map extract. Published discoveries establish resource knowledge, including non-producing fields. Where discovery is unavailable, documented opening/production or the catalogue snapshot supplies an explicit attestation. Fuel designations classify known resources without proving production. Exploitation spans use published starts or positive observations bounded by closure or dated operating status; these spans are approximate and explicit zero-production years remain excluded. Mixed fields retain fuel-specific production bounds. Country-level positions are excluded. Locations represent fields or assets, not individual wells.',
  },
  {
    id: 'gem-gcmt',
    name: 'Global Energy Monitor — Global Coal Mine Tracker, August 2026',
    url: 'https://globalenergymonitor.org/projects/global-coal-mine-tracker',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    year: 2026,
    description:
      'August 2026 public map extract. Historical opening/production evidence or the 2026 catalogue supplies a knowledge attestation, never an invented discovery. Closed mines and projects may remain known without exploitation periods. Production spans use published opening or first-output years bounded by past closure or dated operating status; these spans are approximate and explicit zero-production years remain excluded. Proposed/future dates do not prove exploitation. Country-level positions are excluded. Geometry duplicates are merged by project ID; location accuracy is otherwise unspecified.',
  },
];

const contributions = [
  'historical',
  'historical-expanded',
  'modern-minerals',
  'west-africa',
  'current-major-mines',
  'current-rare-earths',
  'current-uranium',
  'national-mining',
  'current-us-mines',
  'sodir-discoveries',
  'mineral-occurrences',
  'boem-discoveries',
].map((name) => ({
  name,
  ...(JSON.parse(readFileSync(new URL(`./${name}.json`, import.meta.url), 'utf8')) as {
    sources: ResourceSource[];
    sites: ResourceSite[];
    observationGroups?: { sourceId: string; updates: ResourceObservationUpdate[] }[];
    knowledgeGroups?: { sourceId: string; updates: ResourceKnowledgeUpdate[] }[];
  }),
}));
sources.push(...contributions.flatMap((contribution) => contribution.sources));
const sodir = normalizeSodirSites(
  load<SodirField>('sodir-fields'),
  load<SodirProduction>('sodir-production'),
);
const reconciled = reconcileNorwegianFields(normalizeGemSites(load<GemRow>('goget'), 'goget'), [
  ...sodir,
  ...contributions
    .filter((part) => part.name === 'sodir-discoveries')
    .flatMap((part) => part.sites),
]);
const mineralRules = [
  'reconciliations',
  'current-rare-earths-matches',
  'current-uranium-matches',
].flatMap(
  (name) =>
    JSON.parse(
      readFileSync(new URL(`./${name}.json`, import.meta.url), 'utf8'),
    ) as ResourceReconciliation[],
);
const minerals = reconcileResourceSites(
  contributions.flatMap((part) => part.sites),
  mineralRules,
);
const reported = JSON.parse(
  readFileSync(new URL('./reported-production.json', import.meta.url), 'utf8'),
) as {
  source: ResourceSource;
  updates: ResourceObservationUpdate[];
  audit: unknown[];
  exclusions: Record<string, number>;
};
sources.push(reported.source);
const recentMinerals = appendResourceObservations(
  minerals.sites,
  reported.updates,
  reported.source,
);
// Specific production reports take precedence over qualified registry snapshots.
let observedMinerals = recentMinerals.sites;
const registryObservations = contributions.flatMap((contribution) =>
  (contribution.observationGroups ?? []).map((group) => {
    const source = contribution.sources.find((candidate) => candidate.id === group.sourceId);
    if (!source) throw new Error(`Unknown observation source: ${group.sourceId}`);
    const result = appendResourceObservations(observedMinerals, group.updates, source);
    observedMinerals = result.sites;
    return { contribution: contribution.name, sourceId: source.id, applied: result.applied };
  }),
);
const coordinateCorrections = JSON.parse(
  readFileSync(new URL('./coordinate-corrections.json', import.meta.url), 'utf8'),
) as { siteId: string; coordinates: [number, number]; sourceUrl: string; reason: string }[];
let combinedSites = [
  ...reconciled.sites,
  ...sodir,
  ...normalizeGemSites(load<GemRow>('gcmt'), 'gcmt'),
  ...observedMinerals,
];
const knowledgeObservations = contributions.flatMap((contribution) =>
  (contribution.knowledgeGroups ?? []).map((group) => {
    const source = contribution.sources.find((candidate) => candidate.id === group.sourceId);
    if (!source) throw new Error(`Unknown discovery source: ${group.sourceId}`);
    const result = appendResourceKnowledge(combinedSites, group.updates, source);
    combinedSites = result.sites;
    return { contribution: contribution.name, sourceId: source.id, applied: result.applied };
  }),
);
const discoveryReconciliations = reconcileResourceSites(
  combinedSites,
  ['norwegian-discovery-matches', 'known-resource-matches'].flatMap(
    (name) =>
      JSON.parse(
        readFileSync(new URL(`./${name}.json`, import.meta.url), 'utf8'),
      ) as ResourceReconciliation[],
  ),
);
combinedSites = discoveryReconciliations.sites;
const corrections = new Map(
  coordinateCorrections.map((correction) => [correction.siteId, correction]),
);
if (
  corrections.size !== coordinateCorrections.length ||
  coordinateCorrections.some(
    (correction) => !combinedSites.some((site) => site.id === correction.siteId),
  )
)
  throw new Error('Duplicate or unknown coordinate correction identity');

const countryAliases: Record<string, string> = {
  "Cote d'Ivoire": 'Côte d’Ivoire',
  "Côte d'Ivoire": 'Côte d’Ivoire',
  'DR Congo': 'Democratic Republic of the Congo',
  'Russian Federation': 'Russia',
  Türkiye: 'Turkey',
  'United States of America': 'United States',
};

const dataset = ResourceDatasetSchema.parse({
  version: 1,
  downloadedAt: manifest.downloadedAt,
  description:
    'Resources appear from their documented discovery or earliest available attestation and remain known thereafter, including unexploited or closed deposits. Where discovery is unknown, a dated catalogue or first exploitation observation supplies an explicitly labelled attestation, never an invented discovery. Production periods remain separate and preserve documented shutdowns. Coverage, remaining reserves and historical political control are not inferred from marker presence.',
  sources,
  sites: combinedSites
    .map((site) => {
      const correction = corrections.get(site.id);
      return {
        ...site,
        country: countryAliases[site.country ?? ''] ?? site.country,
        ...(correction
          ? {
              coordinates: correction.coordinates,
              coordinateSourceUrl: correction.sourceUrl,
              accuracy: 'approximate' as const,
            }
          : {}),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id, 'en')),
});
const destination = fileURLToPath(new URL('../../public/data/resources/', import.meta.url));
mkdirSync(destination, { recursive: true });
writeFileSync(`${destination}/sites.json`, `${JSON.stringify(dataset)}\n`);
writeFileSync(
  `${destination}/source-audit.json`,
  `${JSON.stringify(
    {
      downloadedAt: manifest.downloadedAt,
      rule: 'Same Norwegian official field name after removing GEM fuel/type/country suffixes (or an individually cited official alias), and coordinates within 50 km. SODIR annual observations replace GEM observations; missing years are never interpolated.',
      norwegianFieldReplacements: reconciled.matches,
      mineralReconciliations: minerals.matches,
      reportedProduction: {
        applied: recentMinerals.applied,
        evidence: reported.audit,
        exclusions: reported.exclusions,
      },
      registryObservations,
      knowledgeObservations,
      discoveryReconciliations: discoveryReconciliations.matches,
      contributions: contributions.map(({ name, sites }) => ({ name, inputSites: sites.length })),
      countryLabelAliases: countryAliases,
      coordinateCorrections,
    },
    null,
    2,
  )}\n`,
);
console.log(
  `Built ${dataset.sites.length.toLocaleString('en')} resource sites from ${sources.length} sources.`,
);
