import {
  ResourcePeriodSchema,
  type ResourcePeriod,
  type ResourceSite,
  type ResourceSource,
} from '../../lib/resources/types';

export type ResourceObservationUpdate = { siteId: string; periods: ResourcePeriod[] };

/** Extend reviewed identities with observations, never with inferred intervening years. */
export function appendResourceObservations(
  input: ResourceSite[],
  updates: ResourceObservationUpdate[],
  source: ResourceSource,
) {
  const sites = new Map(input.map((site) => [site.id, site]));
  if (sites.size !== input.length) throw new Error('Duplicate input resource identifier');
  const applied: { siteId: string; year: number; categories: string[]; sourceUrl: string }[] = [];
  for (const update of updates) {
    let site = sites.get(update.siteId);
    if (!site) throw new Error(`Unknown resource observation identity: ${update.siteId}`);
    for (const candidate of update.periods) {
      const parsed = ResourcePeriodSchema.safeParse(candidate);
      if (
        !parsed.success ||
        candidate.fromYear !== candidate.toYear ||
        candidate.toYear > source.year ||
        !candidate.categories?.length ||
        site.sourceYear > source.year
      )
        throw new Error(`Invalid annual resource observation: ${site.id}`);
      const categories = [...new Set(candidate.categories)].filter(
        (category) =>
          !site!.periods.some(
            (period) =>
              period.fromYear <= candidate.fromYear &&
              period.toYear >= candidate.toYear &&
              (period.categories ?? site!.categories).includes(category),
          ),
      );
      if (!categories.length) continue;
      site = {
        ...site,
        coordinateSourceUrl: site.coordinateSourceUrl ?? site.sourceUrl,
        sourceId: source.id,
        sourceYear: source.year,
        sourceUrl: source.url,
        categories: [...new Set([...site.categories, ...categories])],
        periods: [
          ...site.periods.map((period) => ({
            ...period,
            categories: period.categories ?? site!.categories,
          })),
          { ...parsed.data, categories },
        ].sort((a, b) => a.fromYear - b.fromYear || a.toYear - b.toYear),
      };
      applied.push({
        siteId: site.id,
        year: candidate.fromYear,
        categories,
        sourceUrl: candidate.sourceUrl,
      });
    }
    sites.set(site.id, site);
  }
  return { sites: [...sites.values()], applied };
}
