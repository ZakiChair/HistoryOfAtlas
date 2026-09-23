import { z } from 'zod';

import { RESOURCE_CATEGORIES } from './categories';

export { RESOURCE_CATEGORIES } from './categories';

export const ResourceCategorySchema = z.enum(RESOURCE_CATEGORIES);
export type ResourceCategory = z.infer<typeof ResourceCategorySchema>;

export const ResourcePeriodSchema = z
  .object({
    fromYear: z.number().int(),
    toYear: z.number().int(),
    sourceUrl: z.url(),
    description: z.string().optional(),
    categories: z.array(ResourceCategorySchema).min(1).optional(),
    approximate: z.boolean().optional(),
  })
  .refine((period) => period.toYear >= period.fromYear, {
    message: 'An exploitation period cannot end before it starts',
    path: ['toYear'],
  });
export type ResourcePeriod = z.infer<typeof ResourcePeriodSchema>;

export const ResourceKnowledgeSchema = z.object({
  fromYear: z.number().int(),
  kind: z.enum(['discovery', 'attestation']),
  categories: z.array(ResourceCategorySchema).min(1),
  sourceUrl: z.url(),
  description: z.string().optional(),
  approximate: z.boolean().optional(),
});
export type ResourceKnowledge = z.infer<typeof ResourceKnowledgeSchema>;

export const ResourceSourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.url(),
  license: z.string().min(1),
  licenseUrl: z.url().optional(),
  year: z.number().int(),
  description: z.string().optional(),
});
export type ResourceSource = z.infer<typeof ResourceSourceSchema>;

export const ResourceSiteSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
    categories: z.array(ResourceCategorySchema).min(1),
    country: z.string().optional(),
    sourceId: z.string().min(1),
    sourceUrl: z.url(),
    sourceYear: z.number().int(),
    coordinateSourceUrl: z.url().optional(),
    accuracy: z.enum(['exact', 'approximate', 'unknown']).optional(),
    periods: z.array(ResourcePeriodSchema),
    knowledge: z.array(ResourceKnowledgeSchema).optional(),
  })
  .refine((site) => site.periods.length > 0 || !!site.knowledge?.length, {
    message: 'A resource needs a dated discovery, attestation or exploitation observation',
    path: ['knowledge'],
  });
export type ResourceSite = z.infer<typeof ResourceSiteSchema>;

export const ResourceDatasetSchema = z
  .object({
    version: z.literal(1),
    downloadedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    description: z.string(),
    sources: z.array(ResourceSourceSchema).min(1),
    sites: z.array(ResourceSiteSchema).min(1),
  })
  .superRefine((dataset, context) => {
    const sources = new Map(dataset.sources.map((source) => [source.id, source]));
    if (sources.size !== dataset.sources.length)
      context.addIssue({
        code: 'custom',
        message: 'Duplicate resource source identifier',
        path: ['sources'],
      });
    const identifiers = new Set<string>();
    dataset.sites.forEach((site, index) => {
      if (identifiers.has(site.id))
        context.addIssue({
          code: 'custom',
          message: 'Duplicate resource site identifier',
          path: ['sites', index, 'id'],
        });
      identifiers.add(site.id);
      const source = sources.get(site.sourceId);
      if (!source || source.year !== site.sourceYear)
        context.addIssue({
          code: 'custom',
          message: 'Missing or inconsistent resource source',
          path: ['sites', index, 'sourceId'],
        });
      if (new Set(site.categories).size !== site.categories.length)
        context.addIssue({
          code: 'custom',
          message: 'Duplicate resource category',
          path: ['sites', index, 'categories'],
        });
      site.periods.forEach((period, periodIndex) => {
        if (period.toYear > site.sourceYear)
          context.addIssue({
            code: 'custom',
            message: 'Exploitation cannot extend beyond its source attestation year',
            path: ['sites', index, 'periods', periodIndex, 'toYear'],
          });
        if (period.categories?.some((category) => !site.categories.includes(category)))
          context.addIssue({
            code: 'custom',
            message: 'Period categories must belong to the site',
            path: ['sites', index, 'periods', periodIndex, 'categories'],
          });
      });
      site.knowledge?.forEach((evidence, evidenceIndex) => {
        if (evidence.fromYear > site.sourceYear)
          context.addIssue({
            code: 'custom',
            message: 'Resource knowledge cannot start after its evidence snapshot',
            path: ['sites', index, 'knowledge', evidenceIndex, 'fromYear'],
          });
        if (evidence.categories.some((category) => !site.categories.includes(category)))
          context.addIssue({
            code: 'custom',
            message: 'Knowledge categories must belong to the site',
            path: ['sites', index, 'knowledge', evidenceIndex, 'categories'],
          });
      });
    });
  });
export type ResourceDataset = z.infer<typeof ResourceDatasetSchema>;
