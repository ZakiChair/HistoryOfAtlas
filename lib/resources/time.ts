import type {
  ResourceCategory,
  ResourceDataset,
  ResourceKnowledge,
  ResourcePeriod,
  ResourceSite,
} from './types';

export function resourcePeriodMatches(
  period: ResourcePeriod,
  year: number,
  range: [number, number] | null = null,
): boolean {
  const [from, to] = range ?? [year, year];
  return period.fromYear <= to && period.toYear >= from;
}

/** No interpolation across production years or documented shutdowns. */
export function exploitedResourcesInPeriod(
  dataset: ResourceDataset,
  year: number,
  range: [number, number] | null = null,
): ResourceSite[] {
  return dataset.sites.flatMap((site) => {
    const periods = site.periods.filter((period) => resourcePeriodMatches(period, year, range));
    if (!periods.length) return [];
    const categories = [
      ...new Set(periods.flatMap((period) => period.categories ?? site.categories)),
    ];
    return [{ ...site, categories }];
  });
}

const knowledgeCache = new WeakMap<ResourceSite, ResourceKnowledge[]>();

/** Earliest sourced knowledge per commodity; an output date is not a discovery date. */
export function resourceKnowledge(site: ResourceSite): ResourceKnowledge[] {
  const cached = knowledgeCache.get(site);
  if (cached) return cached;
  const candidates: ResourceKnowledge[] = [
    ...(site.knowledge ?? []),
    ...site.periods.map((period): ResourceKnowledge => ({
      fromYear: period.fromYear,
      kind: 'attestation',
      categories: period.categories ?? site.categories,
      sourceUrl: period.sourceUrl,
      approximate: true,
      description:
        'Known by this documented exploitation date; the actual discovery may be earlier.',
    })),
  ];
  const earliest = new Map<ResourceCategory, ResourceKnowledge>();
  for (const evidence of candidates)
    for (const category of evidence.categories) {
      const previous = earliest.get(category);
      if (
        !previous ||
        evidence.fromYear < previous.fromYear ||
        (evidence.fromYear === previous.fromYear &&
          evidence.kind === 'discovery' &&
          previous.kind !== 'discovery')
      )
        earliest.set(category, evidence);
    }
  const groups = new Map<ResourceKnowledge, ResourceCategory[]>();
  for (const category of site.categories) {
    const evidence = earliest.get(category);
    if (evidence) groups.set(evidence, [...(groups.get(evidence) ?? []), category]);
  }
  const result = [...groups]
    .map(([evidence, categories]) => ({ ...evidence, categories }))
    .sort((a, b) => a.fromYear - b.fromYear);
  knowledgeCache.set(site, result);
  return result;
}

/** A known resource remains known through shutdowns; future commodities stay hidden. */
export function resourcesInPeriod(
  dataset: ResourceDataset,
  year: number,
  range: [number, number] | null = null,
): ResourceSite[] {
  const throughYear = range?.[1] ?? year;
  return dataset.sites.flatMap((site) => {
    const categories = new Set(
      resourceKnowledge(site)
        .filter((evidence) => evidence.fromYear <= throughYear)
        .flatMap((evidence) => evidence.categories),
    );
    return categories.size
      ? [{ ...site, categories: site.categories.filter((category) => categories.has(category)) }]
      : [];
  });
}
