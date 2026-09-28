import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  CapitalFactSchema,
  PopulationFactSchema,
  PolityFactsProfileSchema,
  PolityFactsRegistrySchema,
} from '../../lib/polity-facts';
import { QidSchema } from '../../lib/schema';
import type { Entity } from '../normalize';
import { normalizePolityFacts, type PolityFactRejection } from './normalize';

const SupplementSchema = z.object({
  version: z.literal(1),
  subjects: z.array(
    z.object({
      subjectId: QidSchema,
      populations: z.array(PopulationFactSchema),
      capitals: z.array(CapitalFactSchema).optional(),
    }),
  ),
});
const ExtractSchema = z.object({
  version: z.literal(1),
  entities: z.record(QidSchema, z.unknown()),
});
const json = (value: unknown) => `${JSON.stringify(value)}\n`;
const hash = (value: unknown) => createHash('sha256').update(json(value)).digest('hex');

/** Build every artifact in memory before publishing anything; missing data aborts the build. */
export function createPolityFactsArtifacts(
  registryInput: unknown,
  extractInput: unknown,
  supplementInput?: unknown,
): Record<string, string> {
  const registry = PolityFactsRegistrySchema.parse(registryInput);
  const extract = ExtractSchema.parse(extractInput);
  const supplement =
    supplementInput === undefined ? undefined : SupplementSchema.parse(supplementInput);
  const subjects = [...new Set(registry.mappings.map((row) => row.subjectId))].sort(
    (a, b) => Number(a.slice(1)) - Number(b.slice(1)),
  );
  const entities = new Map<string, Entity>(
    Object.entries(extract.entities).map(([id, raw]) => {
      if (!raw || typeof raw !== 'object' || !('id' in raw) || raw.id !== id)
        throw new Error(`Invalid extracted entity ${id}`);
      return [id, raw as Entity];
    }),
  );
  const extra = new Map((supplement?.subjects ?? []).map((row) => [row.subjectId, row]));
  if (extra.size !== (supplement?.subjects.length ?? 0))
    throw new Error('Duplicate supplemental subject');
  for (const id of extra.keys())
    if (!subjects.includes(id)) throw new Error(`Supplement has unmapped subject ${id}`);
  const rejected: PolityFactRejection[] = [];
  const profiles = subjects.map((subjectId) => {
    const normalized = normalizePolityFacts(subjectId, entities);
    rejected.push(...normalized.rejected);
    const additions = extra.get(subjectId);
    return PolityFactsProfileSchema.parse({
      ...normalized.profile,
      capitals: [...normalized.profile.capitals, ...(additions?.capitals ?? [])],
      populations: [...normalized.profile.populations, ...(additions?.populations ?? [])],
    });
  });
  const byReason: Record<string, number> = {};
  for (const item of rejected) byReason[item.reason] = (byReason[item.reason] ?? 0) + 1;
  const coverage = {
    version: 1,
    reviewedAt: registry.reviewedAt,
    mappings: registry.mappings.length,
    excludedMappings: registry.excluded?.length ?? 0,
    subjects: profiles.length,
    subjectsWithCapitals: profiles.filter((profile) => profile.capitals.length).length,
    subjectsWithPopulation: profiles.filter((profile) => profile.populations.length).length,
    capitalStatements: profiles.reduce((sum, profile) => sum + profile.capitals.length, 0),
    populationStatements: profiles.reduce((sum, profile) => sum + profile.populations.length, 0),
    undatedCapitalStatements: profiles
      .flatMap((p) => p.capitals)
      .filter((c) => !c.at && !c.start && !c.end).length,
    undatedPopulationStatements: profiles
      .flatMap((p) => p.populations)
      .filter((p) => !p.date && !p.start && !p.end).length,
    supplementaryPopulationStatements: [...extra.values()].reduce(
      (sum, row) => sum + row.populations.length,
      0,
    ),
    rejectedCount: rejected.length,
    rejectedByReason: byReason,
    rejected,
    inputHashes: {
      registry: hash(registryInput),
      extract: hash(extractInput),
      ...(supplement ? { supplement: hash(supplementInput) } : {}),
    },
    policy:
      'Values are attributed source observations, not interpolated annual populations. Normal and preferred statements are retained, including conflicting estimates. Undated capitals remain undated. Partial population scopes and invalid statements are rejected. Reviewed identity bounds do not change fact dates.',
  };
  return {
    'index.json': json(registry),
    ...Object.fromEntries(profiles.map((profile) => [`${profile.subjectId}.json`, json(profile)])),
    'coverage.json': json(coverage),
  };
}

async function readJson(path: string, optional = false) {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch (error) {
    if (optional && (error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function main() {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const [registry, extract, supplement] = await Promise.all([
    readJson(join(root, 'data/curated/polity-facts-mappings.json')),
    readJson(join(root, 'data/curated/polity-facts-wikidata.json')),
    readJson(join(root, 'data/curated/polity-facts-supplement.json'), true),
  ]);
  const artifacts = createPolityFactsArtifacts(registry, extract, supplement);
  const output = join(root, 'public/data/polity-facts');
  const report = join(root, 'data/reports/polity-facts.json');
  const check = process.argv.includes('--check');
  if (check) {
    const actual = (await readdir(output)).filter((name) => name.endsWith('.json')).sort();
    if (actual.join('|') !== Object.keys(artifacts).sort().join('|'))
      throw new Error('Polity fact output file set is stale');
    for (const [name, body] of Object.entries(artifacts))
      if ((await readFile(join(output, name), 'utf8')) !== body)
        throw new Error(`Polity fact output is stale: ${name}`);
    if ((await readFile(report, 'utf8')) !== artifacts['coverage.json'])
      throw new Error('Polity fact coverage report is stale');
  } else {
    await mkdir(output, { recursive: true });
    for (const [name, body] of Object.entries(artifacts)) {
      const path = join(output, name);
      await writeFile(`${path}.tmp`, body);
      await rename(`${path}.tmp`, path);
    }
    for (const name of await readdir(output))
      if (/^Q\d+\.json$/.test(name) && !(name in artifacts)) await rm(join(output, name));
    await mkdir(join(root, 'data/reports'), { recursive: true });
    await writeFile(report, artifacts['coverage.json']);
  }
  const coverage = JSON.parse(artifacts['coverage.json']);
  console.log(
    `Polity facts ${check ? 'verified' : 'built'}: ${coverage.subjects} subjects, ${coverage.capitalStatements} capital statements, ${coverage.populationStatements} population observations, ${coverage.rejectedCount} rejected statements.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
