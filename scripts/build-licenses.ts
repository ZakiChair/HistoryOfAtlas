/**
 * Writes public/data/licenses.json from the committed source manifests:
 * resource sources, religion references, the geography manifest, CDB90, Seshat and Wikidata,
 * plus the project's own licences declared in LICENSE and DATA-LICENSE.md.
 *
 *   pnpm data:licenses           regenerate the manifest
 *   pnpm data:licenses --check   fail when a source lacks a licence or URL, or the file is stale
 *
 * `pnpm data:resources:check` runs the same check.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildLicenseManifest, licenseIssues, type LicenseInputs } from '../lib/licenses';
import { REPOSITORY_URL } from '../lib/seo';
import type { ReligionCoverageIndex } from '../lib/religions/coverage';

const root = new URL('../', import.meta.url);
const OUTPUT = new URL('public/data/licenses.json', root);

function readJson<T>(relative: string): T {
  return JSON.parse(readFileSync(new URL(relative, root), 'utf8')) as T;
}

/** Licence texts recognised by their title line; any other LICENSE must be added here first. */
const CODE_LICENSES: Record<string, { license: string; licenseUrl: string }> = {
  'MIT License': { license: 'MIT', licenseUrl: 'https://opensource.org/license/mit' },
};

/** Reads the licences the project grants from LICENSE and DATA-LICENSE.md (linked on GitHub: root files are not served by the site). */
export function readProjectLicenses(): LicenseInputs['project'] {
  const title = readFileSync(new URL('LICENSE', root), 'utf8').split('\n', 1)[0]!.trim();
  const code = CODE_LICENSES[title];
  if (!code) throw new Error(`LICENSE: unrecognised licence "${title}".`);
  const content = readFileSync(new URL('DATA-LICENSE.md', root), 'utf8');
  const creativeCommons =
    /\]\((https:\/\/creativecommons\.org\/licenses\/([a-z-]+)\/(\d\.\d)\/)\)/.exec(content);
  const attribution = /Attribute it as "([^"]+)"/.exec(content)?.[1];
  if (!creativeCommons || !attribution)
    throw new Error(
      'DATA-LICENSE.md must link a Creative Commons licence and name an attribution.',
    );
  return {
    code: { ...code, text: `${REPOSITORY_URL}/blob/main/LICENSE` },
    content: {
      license: `CC ${creativeCommons[2]!.toUpperCase()} ${creativeCommons[3]}`,
      licenseUrl: creativeCommons[1]!,
      text: `${REPOSITORY_URL}/blob/main/DATA-LICENSE.md`,
      attribution,
    },
  };
}

export function readLicenseInputs(): LicenseInputs {
  const resources = readJson<LicenseInputs['resources']>('public/data/resources/sites.json');
  const religions = readJson<LicenseInputs['religions']>('public/data/religions/history.json');
  // The epidemic corpus is authored separately; until it lands the manifest simply omits it.
  const epidemics = existsSync(new URL('public/data/epidemics/history.json', root))
    ? readJson<{
        sources: { id: string; title: string; url: string }[];
        milestones: { id: string; sourceIds: string[]; toll?: { sourceIds: string[] }[] }[];
      }>('public/data/epidemics/history.json')
    : undefined;
  const coverage = readJson<ReligionCoverageIndex>('public/data/religions/coverage-index.json');
  const geography = readJson<LicenseInputs['geography']>('public/geo/manifest.json');
  const events = readJson<LicenseInputs['events']>('public/data/manifest.json');
  const cdb90 = readJson<LicenseInputs['cdb90']>('data/curated/battle-cdb90-source.json');
  const polityFacts = readJson<NonNullable<LicenseInputs['polityFacts']>>(
    'data/curated/polity-facts-seshat-source.json',
  );
  return {
    project: readProjectLicenses(),
    resources: {
      sources: resources.sources,
      sites: resources.sites.map((site) => ({ sourceId: site.sourceId })),
    },
    religions: {
      sources: religions.sources,
      milestones: religions.milestones.map((milestone) => ({
        id: milestone.id,
        sourceIds: milestone.sourceIds,
      })),
    },
    ...(epidemics
      ? {
          epidemics: {
            sources: epidemics.sources,
            milestones: epidemics.milestones.map((milestone) => ({
              id: milestone.id,
              sourceIds: milestone.sourceIds,
              toll: milestone.toll?.map((toll) => ({ sourceIds: toll.sourceIds })),
            })),
          },
        }
      : {}),
    religionCoverage: coverage.sources.map((source) => ({
      id: `religion-coverage-${source.id}`,
      name: source.title,
      url: source.url,
      license: source.license,
      ...(source.licenseUrl ? { licenseUrl: source.licenseUrl } : {}),
      scope:
        'Religious composition and geographic study areas; selected and transformed source observations',
      attribution: source.citation ?? source.title,
    })),
    ...(existsSync(new URL('public/data/religions/polities.json', root))
      ? {
          religionPolities: readJson<{
            sources: {
              id: string;
              title: string;
              url: string;
              license: string;
              licenseUrl?: string;
            }[];
          }>('public/data/religions/polities.json').sources.map((source) => ({
            id: `religion-polities-${source.id}`,
            name: source.title,
            url: source.url,
            license: source.license,
            ...(source.licenseUrl ? { licenseUrl: source.licenseUrl } : {}),
            scope: 'Dominant or state religion attributed to a dated polity outline',
          })),
        }
      : {}),
    geography: { sources: geography.sources },
    events: { sources: events.sources },
    cdb90,
    polityFacts: {
      sourceUrl: polityFacts.sourceUrl,
      license: polityFacts.license,
      licenseUrl: polityFacts.licenseUrl,
      attribution: polityFacts.attribution,
      modifications: polityFacts.modifications,
      retrievedOn: polityFacts.retrievedOn,
    },
  };
}

export function renderLicenseManifest(inputs = readLicenseInputs()): string {
  return `${JSON.stringify(buildLicenseManifest(inputs), null, 2)}\n`;
}

/** Throws when a source is untraceable or the committed manifest no longer matches the data. */
export function checkLicenseManifest(): string {
  const inputs = readLicenseInputs();
  const issues = licenseIssues(inputs);
  if (issues.length) throw new Error(`Licence manifest is incomplete:\n${issues.join('\n')}`);
  let committed = '';
  try {
    committed = readFileSync(OUTPUT, 'utf8');
  } catch {
    throw new Error('public/data/licenses.json is missing: run `pnpm data:licenses`.');
  }
  if (committed !== renderLicenseManifest(inputs))
    throw new Error('public/data/licenses.json is out of date: run `pnpm data:licenses`.');
  return `Verified licences for ${inputs.resources.sources.length} resource sources, ${inputs.religions.sources.length} religion references, ${inputs.epidemics?.sources.length ?? 0} epidemic references and ${inputs.geography.sources.length} geography sources.`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--check')) console.log(checkLicenseManifest());
  else {
    writeFileSync(OUTPUT, renderLicenseManifest());
    console.log(`Wrote ${fileURLToPath(OUTPUT)}`);
  }
}
