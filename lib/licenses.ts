/**
 * Licence manifest for every source the atlas redistributes or cites.
 * Pure functions: scripts/build-licenses.ts reads the data files and writes
 * public/data/licenses.json; the /about page renders that file.
 */

export interface LicenseDataset {
  id: string;
  name: string;
  url: string;
  license: string;
  licenseUrl?: string;
  /** What this source supplies to the atlas. */
  scope: string;
  revision?: string;
  attribution?: string;
}

export interface ResourceLicenseSource {
  id: string;
  name: string;
  url: string;
  license: string;
  licenseUrl?: string;
  year: number;
  sites: number;
}

export interface ResourceLicenseGroup {
  license: string;
  licenseUrl?: string;
  sources: number;
  sites: number;
}

export interface ReligionReference {
  id: string;
  title: string;
  url: string;
  milestones: number;
}

/** A licence the project itself grants, as declared by a file at the repository root. */
export interface ProjectLicense {
  /** Short licence name, e.g. `MIT` or `CC BY 4.0`. */
  license: string;
  licenseUrl: string;
  /** The licence file in the repository. */
  text: string;
}

export interface LicenseManifest {
  version: 1;
  notice: string;
  project: {
    code: ProjectLicense;
    content: ProjectLicense & { scope: string; attribution: string };
    note: string;
  };
  datasets: LicenseDataset[];
  resources: {
    sources: ResourceLicenseSource[];
    licenses: ResourceLicenseGroup[];
  };
  religions: {
    corpus: { scope: string; license: string; licenseUrl: string; note: string };
    references: ReligionReference[];
  };
}

export interface LicenseInputs {
  /** Read from LICENSE and DATA-LICENSE.md at the repository root. */
  project: {
    code: ProjectLicense;
    content: ProjectLicense & { attribution: string };
  };
  events: { sources: { label: string; url: string; license: string }[] };
  cdb90: {
    repository: string;
    commit: string;
    license: string;
    licenseUrl: string;
    originalDataLicense: string;
    attribution: string;
  };
  geography: {
    sources: {
      label: string;
      url: string;
      licence: string;
      licenceUrl: string;
      commit?: string;
      citation?: string;
    }[];
  };
  resources: {
    sources: {
      id: string;
      name: string;
      url: string;
      license: string;
      licenseUrl?: string;
      year: number;
    }[];
    sites: { sourceId: string }[];
  };
  religions: {
    sources: { id: string; title: string; url: string }[];
    milestones: { id: string; sourceIds: string[] }[];
  };
}

const KNOWN_LICENSE_URLS: Record<string, string> = {
  'CC0-1.0': 'https://creativecommons.org/publicdomain/zero/1.0/',
  'Public domain': 'https://www.naturalearthdata.com/about/terms-of-use/',
};

const EVENT_SOURCES = [
  {
    match: /^https:\/\/www\.wikidata\.org\//,
    id: 'wikidata',
    name: 'Wikidata',
    scope: 'Events, dates, coordinates, participants, people, offices and conflict links',
  },
  {
    match: /^https:\/\/www\.naturalearthdata\.com\//,
    id: 'natural-earth-coastline-validation',
    name: 'Natural Earth · coastline validation',
    scope: 'Validation mask for event coordinates',
  },
];

const slug = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const isHttpUrl = (value: string | undefined) => Boolean(value && /^https?:\/\/\S+$/.test(value));
/** Same-origin paths (e.g. a licence text shipped under /geo/) are valid links too. */
const isLink = (value: string | undefined) => isHttpUrl(value) || Boolean(value?.startsWith('/'));

/** Every cited or redistributed source must be traceable to a licence statement and a URL. */
export function licenseIssues(inputs: LicenseInputs): string[] {
  const issues: string[] = [];
  const resourceSources = new Map(inputs.resources.sources.map((source) => [source.id, source]));
  if (resourceSources.size !== inputs.resources.sources.length)
    issues.push('Duplicate resource source identifier');
  for (const source of inputs.resources.sources) {
    if (!source.license.trim()) issues.push(`Resource source ${source.id} has no licence`);
    if (!isHttpUrl(source.url)) issues.push(`Resource source ${source.id} has no URL`);
    if (source.licenseUrl !== undefined && !isHttpUrl(source.licenseUrl))
      issues.push(`Resource source ${source.id} has an invalid licence URL`);
  }
  const missingResources = new Set(
    inputs.resources.sites
      .map((site) => site.sourceId)
      .filter((sourceId) => !resourceSources.has(sourceId)),
  );
  for (const sourceId of missingResources)
    issues.push(`Resource sourceId ${sourceId} has no declared source`);
  const religionSources = new Map(inputs.religions.sources.map((source) => [source.id, source]));
  for (const source of inputs.religions.sources)
    if (!isHttpUrl(source.url)) issues.push(`Religion source ${source.id} has no URL`);
  for (const milestone of inputs.religions.milestones)
    for (const sourceId of milestone.sourceIds)
      if (!religionSources.has(sourceId))
        issues.push(`Religion milestone ${milestone.id} cites unknown source ${sourceId}`);
  for (const source of inputs.geography.sources) {
    if (!source.licence.trim()) issues.push(`Geography source ${source.label} has no licence`);
    if (!isHttpUrl(source.url)) issues.push(`Geography source ${source.label} has no URL`);
    if (!isLink(source.licenceUrl))
      issues.push(`Geography source ${source.label} has no licence URL`);
  }
  for (const source of inputs.events.sources) {
    if (!source.license.trim()) issues.push(`Event source ${source.label} has no licence`);
    if (!isHttpUrl(source.url)) issues.push(`Event source ${source.label} has no URL`);
  }
  if (!inputs.cdb90.license || !isHttpUrl(inputs.cdb90.licenseUrl) || !inputs.cdb90.attribution)
    issues.push('CDB90 requires a licence, a licence URL and an attribution');
  for (const [part, declared] of Object.entries(inputs.project)) {
    if (!declared.license.trim()) issues.push(`Project ${part} has no licence`);
    if (!isHttpUrl(declared.licenseUrl) || !isHttpUrl(declared.text))
      issues.push(`Project ${part} licence needs a licence URL and a licence file URL`);
  }
  if (!inputs.project.content.attribution.trim())
    issues.push('Project content licence needs an attribution');
  return issues;
}

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'en');

export function buildLicenseManifest(inputs: LicenseInputs): LicenseManifest {
  const issues = licenseIssues(inputs);
  if (issues.length) throw new Error(`Licence manifest is incomplete:\n${issues.join('\n')}`);

  const eventSources: LicenseDataset[] = inputs.events.sources.map((source) => {
    const known = EVENT_SOURCES.find((candidate) => candidate.match.test(source.url));
    return {
      id: known?.id ?? `events-${slug(source.label)}`,
      name: known?.name ?? source.label,
      url: source.url,
      license: source.license,
      ...(KNOWN_LICENSE_URLS[source.license]
        ? { licenseUrl: KNOWN_LICENSE_URLS[source.license] }
        : {}),
      scope: known?.scope ?? 'Event records',
    };
  });
  const geography: LicenseDataset[] = inputs.geography.sources.map((source) => ({
    id: `geo-${slug(source.label.split('·')[0])}`,
    name: source.label,
    url: source.url,
    license: source.licence,
    licenseUrl: source.licenceUrl,
    scope: /cliopatria/i.test(source.label)
      ? 'Dated polity boundaries'
      : /natural earth/i.test(source.label)
        ? 'Coastlines, rivers and physical basemap'
        : 'Historical boundary snapshots (secondary reference)',
    ...(source.commit ? { revision: source.commit } : {}),
    ...(source.citation ? { attribution: source.citation } : {}),
  }));
  const datasets: LicenseDataset[] = [
    ...eventSources,
    {
      id: 'cdb90',
      name: 'CDB90 · CAA Database of Battles, Version 1990',
      url: inputs.cdb90.repository,
      license: inputs.cdb90.license,
      licenseUrl: inputs.cdb90.licenseUrl,
      scope: `Selected army strengths and casualties (original data: ${inputs.cdb90.originalDataLicense})`,
      revision: inputs.cdb90.commit,
      attribution: inputs.cdb90.attribution,
    },
    ...geography,
    {
      id: 'wikipedia',
      name: 'Wikipedia',
      url: 'https://www.wikipedia.org/',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      scope: 'Summaries loaded on demand and attributed in each record',
    },
    {
      id: 'wikimedia-commons',
      name: 'Wikimedia Commons',
      url: 'https://commons.wikimedia.org/',
      license: 'Licence stated on each file page',
      licenseUrl: 'https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use',
      scope: 'Illustrations loaded from Commons, each under its own licence',
    },
    {
      id: 'font-cormorant',
      name: 'Cormorant',
      url: 'https://github.com/CatharsisFonts/Cormorant',
      license: 'SIL Open Font License 1.1',
      licenseUrl: '/fonts/cormorantgaramond-OFL.txt',
      scope: 'Display typeface, hosted locally',
    },
    {
      id: 'font-manrope',
      name: 'Manrope',
      url: 'https://github.com/googlefonts/manrope',
      license: 'SIL Open Font License 1.1',
      licenseUrl: '/fonts/manrope-OFL.txt',
      scope: 'Interface typeface, hosted locally',
    },
  ];

  const siteCounts = new Map<string, number>();
  for (const site of inputs.resources.sites)
    siteCounts.set(site.sourceId, (siteCounts.get(site.sourceId) ?? 0) + 1);
  const resourceSources: ResourceLicenseSource[] = inputs.resources.sources
    .map((source) => ({
      id: source.id,
      name: source.name,
      url: source.url,
      license: source.license,
      ...(source.licenseUrl ? { licenseUrl: source.licenseUrl } : {}),
      year: source.year,
      sites: siteCounts.get(source.id) ?? 0,
    }))
    .sort(byName);
  const groups = new Map<string, ResourceLicenseGroup>();
  for (const source of resourceSources) {
    const group = groups.get(source.license) ?? {
      license: source.license,
      ...(source.licenseUrl ? { licenseUrl: source.licenseUrl } : {}),
      sources: 0,
      sites: 0,
    };
    if (!group.licenseUrl && source.licenseUrl) group.licenseUrl = source.licenseUrl;
    group.sources += 1;
    group.sites += source.sites;
    groups.set(source.license, group);
  }

  const citations = new Map<string, number>();
  for (const milestone of inputs.religions.milestones)
    for (const sourceId of new Set(milestone.sourceIds))
      citations.set(sourceId, (citations.get(sourceId) ?? 0) + 1);

  return {
    version: 1,
    notice:
      'The atlas combines sources under different terms; it is not a single CC0 dataset. Each record keeps its own attribution and links back to its source.',
    project: {
      code: inputs.project.code,
      content: {
        ...inputs.project.content,
        scope:
          'Content written for the atlas: curated reviews and corrections, religion milestones, descriptions, generalized regions and diffusion links, map symbology',
      },
      note: 'Third-party data keeps its original licence. 3D models whose origin is not documented in their own metadata are not covered until their provenance has been confirmed.',
    },
    datasets,
    resources: {
      sources: resourceSources,
      licenses: [...groups.values()].sort(
        (a, b) => b.sites - a.sites || a.license.localeCompare(b.license, 'en'),
      ),
    },
    religions: {
      corpus: {
        scope:
          'Tradition descriptions, milestone texts and hand-generalized regions written for the atlas',
        license: inputs.project.content.license,
        licenseUrl: inputs.project.content.licenseUrl,
        note: 'Project content. Cited references are listed for verification only; their content is not redistributed.',
      },
      references: inputs.religions.sources
        .map((source) => ({
          id: source.id,
          title: source.title,
          url: source.url,
          milestones: citations.get(source.id) ?? 0,
        }))
        .sort((a, b) => a.title.localeCompare(b.title, 'en')),
    },
  };
}
