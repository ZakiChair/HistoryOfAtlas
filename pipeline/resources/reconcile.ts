import type { ResourceSite } from '../../lib/resources/types';

export type ResourceReconciliation = {
  duplicateId: string;
  canonicalId: string;
  mode: 'replace' | 'append-observations';
  fromYear?: number;
  reason: string;
  sourceUrl: string;
};

/** Only reviewed identities merge. Nearby deposits and district markers remain distinct. */
export function reconcileResourceSites(input: ResourceSite[], rules: ResourceReconciliation[]) {
  const sites = new Map(input.map((site) => [site.id, site]));
  if (sites.size !== input.length) throw new Error('Duplicate input resource identifier');
  const matches = rules.map((rule) => {
    const duplicate = sites.get(rule.duplicateId);
    const canonical = sites.get(rule.canonicalId);
    if (!duplicate || !canonical || duplicate.id === canonical.id)
      throw new Error(`Invalid resource reconciliation: ${rule.duplicateId} → ${rule.canonicalId}`);
    if (rule.mode === 'append-observations') {
      const additional = duplicate.periods
        .filter((period) => rule.fromYear === undefined || period.toYear >= rule.fromYear)
        .map((period) => ({
          ...period,
          fromYear: Math.max(period.fromYear, rule.fromYear ?? period.fromYear),
          // A category absent from an older observation must not leak backwards
          // when the mine's overall category list expands.
          categories: period.categories ?? duplicate.categories,
        }));
      if (additional.some((period) => period.toYear > canonical.sourceYear))
        throw new Error(`Canonical source is older than appended evidence: ${canonical.id}`);
      if (duplicate.knowledge?.some((item) => item.fromYear > canonical.sourceYear))
        throw new Error(`Canonical source is older than discovery evidence: ${canonical.id}`);
      sites.set(canonical.id, {
        ...canonical,
        categories: [
          ...new Set([
            ...canonical.categories,
            ...additional.flatMap((p) => p.categories),
            ...(duplicate.knowledge ?? []).flatMap((item) => item.categories),
          ]),
        ],
        periods: [
          ...canonical.periods.map((period) => ({
            ...period,
            categories: period.categories ?? canonical.categories,
          })),
          ...additional,
        ].sort((a, b) => a.fromYear - b.fromYear || a.toYear - b.toYear),
        ...(duplicate.knowledge?.length
          ? { knowledge: [...(canonical.knowledge ?? []), ...duplicate.knowledge] }
          : {}),
      });
    }
    sites.delete(duplicate.id);
    return { ...rule, duplicateName: duplicate.name, canonicalName: canonical.name };
  });
  return { sites: [...sites.values()], matches };
}
