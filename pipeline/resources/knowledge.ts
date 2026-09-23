import {
  ResourceKnowledgeSchema,
  type ResourceKnowledge,
  type ResourceSite,
  type ResourceSource,
} from '../../lib/resources/types';

export type ResourceKnowledgeUpdate = { siteId: string; knowledge: ResourceKnowledge[] };

/** Attach independently sourced discovery evidence without changing any production dates. */
export function appendResourceKnowledge(
  input: ResourceSite[],
  updates: ResourceKnowledgeUpdate[],
  source: ResourceSource,
) {
  const sites = new Map(input.map((site) => [site.id, site]));
  if (sites.size !== input.length) throw new Error('Duplicate resource knowledge identity');
  const applied: { siteId: string; fromYear: number; kind: string; categories: string[] }[] = [];
  for (const update of updates) {
    const site = sites.get(update.siteId);
    if (!site) throw new Error(`Unknown resource knowledge identity: ${update.siteId}`);
    const knowledge = update.knowledge.map((item) => ResourceKnowledgeSchema.parse(item));
    if (knowledge.some((item) => item.fromYear > source.year))
      throw new Error(`Future resource knowledge: ${site.id}`);
    const previous = site.knowledge ?? [];
    const keys = new Set(previous.map((item) => JSON.stringify(item)));
    const additional = knowledge.filter((item) => !keys.has(JSON.stringify(item)));
    if (!additional.length) continue;
    // The evidence URL belongs to each observation. A more recent source can
    // update the snapshot, but an older catalogue must never lower its year.
    sites.set(site.id, {
      ...site,
      ...(source.year > site.sourceYear
        ? { sourceId: source.id, sourceUrl: source.url, sourceYear: source.year }
        : {}),
      coordinateSourceUrl: site.coordinateSourceUrl ?? site.sourceUrl,
      categories: [
        ...new Set([...site.categories, ...additional.flatMap((item) => item.categories)]),
      ],
      periods: site.periods.map((period) => ({
        ...period,
        categories: period.categories ?? site.categories,
      })),
      knowledge: [...previous, ...additional].sort((a, b) => a.fromYear - b.fromYear),
    });
    applied.push(
      ...additional.map(({ fromYear, kind, categories }) => ({
        siteId: site.id,
        fromYear,
        kind,
        categories,
      })),
    );
  }
  return { sites: [...sites.values()], applied };
}
