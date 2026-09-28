import { isChronologicallyPossible, parseWikidataTime } from '../../lib/histdate';
import {
  PolityFactsProfileSchema,
  type FactDate,
  type PolityFactsProfile,
} from '../../lib/polity-facts';
import { LOCALES, type LocalizedName, type Source } from '../../lib/types';
import type { Claim, Entity } from '../normalize';

type Snak = { snaktype?: string; datavalue?: { value: unknown } };
type ObjectValue = Record<string, unknown>;
export type PolityFactRejection = {
  subjectId: string;
  property: string;
  statementId?: string;
  reason: string;
};
const snaks = (value: unknown): Snak[] => (Array.isArray(value) ? value : []);
const object = (value: unknown): ObjectValue | undefined =>
  value !== null && typeof value === 'object' ? (value as ObjectValue) : undefined;
const qid = (value: unknown): string | undefined => {
  const id = object(value)?.id;
  return typeof id === 'string' && /^Q[1-9]\d*$/.test(id) ? id : undefined;
};
const ids = (claim: Claim, property: string) =>
  snaks(claim.qualifiers?.[property]).flatMap((s) => qid(s.datavalue?.value) ?? []);

function name(entity: Entity | undefined): LocalizedName {
  const en =
    entity?.labels?.en?.value ??
    entity?.labels?.fr?.value ??
    Object.values(entity?.labels ?? {})[0]?.value;
  if (!en)
    throw new Error(`Missing polity-facts entity or source label: ${entity?.id ?? 'unknown'}`);
  return {
    en,
    ...Object.fromEntries(
      LOCALES.flatMap((locale) =>
        entity?.labels?.[locale]?.value ? [[locale, entity.labels[locale].value]] : [],
      ),
    ),
  };
}

function evidence(
  entity: Entity,
  property: string,
  statement: Claim,
  entities: Map<string, Entity>,
): Source[] {
  const base = entity.lastrevid
    ? `https://www.wikidata.org/w/index.php?title=${entity.id}&oldid=${entity.lastrevid}`
    : `https://www.wikidata.org/wiki/${entity.id}`;
  const sources: Source[] = [
    { label: `Wikidata · ${property}`, url: `${base}#${statement.id}`, license: 'CC0-1.0' },
  ];
  for (const reference of statement.references ?? []) {
    for (const property of ['P854', 'P4656']) {
      for (const snak of snaks(reference.snaks?.[property])) {
        const url = snak.datavalue?.value;
        if (typeof url === 'string' && /^https?:\/\//i.test(url))
          sources.push({
            label: property === 'P4656' ? 'Wikimedia import revision' : 'Wikidata reference URL',
            url,
          });
      }
    }
    for (const property of ['P248', 'P143']) {
      for (const snak of snaks(reference.snaks?.[property])) {
        const id = qid(snak.datavalue?.value);
        if (id)
          sources.push({
            label: `${property === 'P143' ? 'Imported from' : 'Stated in'} · ${entities.get(id)?.labels?.en?.value ?? id}`,
            url: `https://www.wikidata.org/wiki/${id}`,
          });
      }
    }
  }
  return sources.filter(
    (source, index) => sources.findIndex((other) => other.url === source.url) === index,
  );
}

function dates(claim: Claim, property: string): FactDate[] {
  return snaks(claim.qualifiers?.[property]).map((snak) => {
    const value = object(snak.datavalue?.value);
    if (!value || typeof value.time !== 'string') throw new Error('invalid-date');
    const parsed = parseWikidataTime(value.time, {
      precision: typeof value.precision === 'number' ? value.precision : undefined,
      calendar: typeof value.calendarmodel === 'string' ? value.calendarmodel : undefined,
      encoding: 'json',
    });
    return {
      date: parsed.date,
      precision: parsed.datePrecision,
      calendar: parsed.calendar,
      ...(value.before ||
      value.after ||
      ids(claim, 'P1480').includes('Q5727902') ||
      ['decade', 'century'].includes(parsed.datePrecision)
        ? { approximate: true }
        : {}),
    };
  });
}

function temporal(claim: Claim) {
  const starts = dates(claim, 'P580'),
    ends = dates(claim, 'P582'),
    at = dates(claim, 'P585');
  if (starts.length > 1 || ends.length > 1) throw new Error('ambiguous-date-boundaries');
  if (['P1319', 'P1326'].some((property) => snaks(claim.qualifiers?.[property]).length))
    throw new Error('unsupported-temporal-bounds');
  const start = starts[0],
    end = ends[0];
  if (
    start &&
    end &&
    !isChronologicallyPossible(
      start.date,
      end.date,
      start.calendar === end.calendar ? start.calendar : 'unknown',
    )
  )
    throw new Error('inverted-date-interval');
  if (
    at.some(
      (point) =>
        (start && !isChronologicallyPossible(start.date, point.date, start.calendar)) ||
        (end && !isChronologicallyPossible(point.date, end.date, point.calendar)),
    )
  )
    throw new Error('observation-outside-interval');
  return { ...(start ? { start } : {}), ...(end ? { end } : {}), at };
}

function note(claim: Claim, entities: Map<string, Entity>): LocalizedName | undefined {
  const entries = [
    ['P459', 'Method', 'Méthode'],
    ['P3831', 'Role', 'Rôle'],
    ['P1013', 'Criterion', 'Critère'],
    ['P1480', 'Qualification', 'Qualification'],
  ].flatMap(([property, en, fr]) =>
    ids(claim, property).map((id) => {
      const labels = entities.get(id)?.labels;
      return {
        en: `${en}: ${labels?.en?.value ?? labels?.fr?.value ?? id}`,
        fr: `${fr}: ${labels?.fr?.value ?? labels?.en?.value ?? id}`,
      };
    }),
  );
  return entries.length
    ? { en: entries.map((n) => n.en).join(' · '), fr: entries.map((n) => n.fr).join(' · ') }
    : undefined;
}

/** Normal and preferred historical statements coexist. A preferred latest count cannot erase history. */
export function normalizePolityFacts(
  subjectId: string,
  entities: Map<string, Entity>,
): { profile: PolityFactsProfile; rejected: PolityFactRejection[] } {
  const entity = entities.get(subjectId);
  if (!entity) throw new Error(`Missing polity-facts subject ${subjectId}`);
  const profile: PolityFactsProfile = {
    version: 1,
    subjectId,
    name: name(entity),
    capitals: [],
    populations: [],
  };
  const rejected: PolityFactRejection[] = [];
  for (const property of ['P36', 'P1082'] as const) {
    for (const claim of entity.claims?.[property] ?? []) {
      if (claim.rank === 'deprecated') continue;
      const reject = (reason: string) =>
        rejected.push({ subjectId, property, statementId: claim.id, reason });
      if (!claim.id || !claim.mainsnak?.datavalue) {
        reject('missing-statement-value');
        continue;
      }
      if (
        property === 'P36' &&
        ['P518', 'P1001', 'P3005'].some((p) => snaks(claim.qualifiers?.[p]).length)
      ) {
        reject('partial-capital-scope');
        continue;
      }
      if (
        property === 'P1082' &&
        ['P518', 'P1012', 'P1011', 'P3005', 'P1001'].some(
          (p) => snaks(claim.qualifiers?.[p]).length,
        )
      ) {
        reject('partial-population-scope');
        continue;
      }
      let time: ReturnType<typeof temporal>;
      try {
        time = temporal(claim);
      } catch (error) {
        reject(error instanceof Error ? error.message : 'invalid-date');
        continue;
      }
      const { at, ...interval } = time;
      const sources = evidence(entity, property, claim, entities);
      const annotation = note(claim, entities);
      const common = { ...interval, sources, ...(annotation ? { note: annotation } : {}) };
      if (property === 'P36') {
        const cityId = qid(claim.mainsnak.datavalue.value);
        if (!cityId) {
          reject('invalid-capital');
          continue;
        }
        const city = { id: cityId, name: name(entities.get(cityId)) };
        for (const [index, point] of (at.length ? at : [undefined]).entries())
          profile.capitals.push({
            id: `${claim.id}${at.length > 1 ? `:${index}` : ''}`,
            city,
            ...common,
            ...(point ? { at: point } : {}),
          });
      } else {
        const quantity = object(claim.mainsnak.datavalue.value);
        const value = Number(quantity?.amount);
        const min = quantity?.lowerBound === undefined ? undefined : Number(quantity.lowerBound);
        const max = quantity?.upperBound === undefined ? undefined : Number(quantity.upperBound);
        if (
          quantity?.unit !== '1' ||
          !Number.isSafeInteger(value) ||
          value < 0 ||
          (min !== undefined && (!Number.isSafeInteger(min) || min < 0 || min > value)) ||
          (max !== undefined && (!Number.isSafeInteger(max) || max < value))
        ) {
          reject('invalid-population-quantity');
          continue;
        }
        const approximate = Boolean(
          ids(claim, 'P1480').length ||
          (min !== undefined && min !== value) ||
          (max !== undefined && max !== value) ||
          ids(claim, 'P459').some((id) =>
            /estimat|approx/i.test(entities.get(id)?.labels?.en?.value ?? ''),
          ),
        );
        for (const [index, point] of (at.length ? at : [undefined]).entries())
          profile.populations.push({
            id: `${claim.id}${at.length > 1 ? `:${index}` : ''}`,
            value,
            ...(min !== undefined ? { min } : {}),
            ...(max !== undefined ? { max } : {}),
            approximate,
            ...common,
            ...(point ? { date: point } : {}),
          });
      }
    }
  }
  return { profile: PolityFactsProfileSchema.parse(profile), rejected };
}
