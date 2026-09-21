import {
  EventPersonLinkSchema,
  PersonSchema,
  PersonTenureSchema,
  SourcedDateSchema,
  type HistoricalEvent,
  type Person,
  type PersonTenure,
  type EventPersonLink,
  type SourcedDate,
  type PolityLeaders,
} from '../../lib/schema';
import { compareHistDates, histDateBounds, parseWikidataTime } from '../../lib/histdate';
import {
  entityIds,
  label,
  sourceExclusion,
  type Claim,
  type ClaimValue,
  type Entity,
} from './index';

type Source = HistoricalEvent['sources'][number];
type Snak = { datavalue?: { value: ClaimValue } };
export type EnrichmentRejection = {
  personId?: string;
  eventId?: string;
  sourceEntityId?: string;
  statementId?: string;
  property?: string;
  reason: string;
};

/** Preferred rank describes the current office; it must not erase former holders. */
export const historicalClaims = (entity: Entity | undefined, property: string): Claim[] =>
  (entity?.claims?.[property] ?? []).filter(
    (claim) => claim.rank !== 'deprecated' && claim.mainsnak?.datavalue,
  );
const snaks = (value: unknown): Snak[] => (Array.isArray(value) ? (value as Snak[]) : []);
const qid = (value: ClaimValue | undefined): string | undefined =>
  typeof value === 'object' && value && /^Q[1-9]\d*$/.test(value.id ?? '') ? value.id : undefined;
const claimId = (claim: Claim) => qid(claim.mainsnak?.datavalue?.value);
const qualifierIds = (claim: Claim, property: string) => [
  ...new Set(
    snaks(claim.qualifiers?.[property]).flatMap((snak) =>
      qid(snak.datavalue?.value) ? [qid(snak.datavalue?.value)!] : [],
    ),
  ),
];

export function sourceDescription(entity: Entity | undefined): Person['description'] {
  const fr = entity?.descriptions?.fr?.value;
  const en = entity?.descriptions?.en?.value;
  return fr || en ? { ...(fr ? { fr } : {}), ...(en ? { en } : {}) } : undefined;
}

export function compactEvent(event: HistoricalEvent): HistoricalEvent {
  const entry = { ...event };
  for (const property of [
    'summary',
    'description',
    'people',
    'image',
    'strength',
    'casualties',
    'deaths',
  ] as const)
    delete entry[property];
  return entry;
}

function sourceName(
  entity: Entity | undefined,
  fallbackId: string,
): { name: Person['name']; nameLanguage?: string } {
  const original = Object.entries(entity?.labels ?? {}).find(([, label]) => label.value);
  const en = label(entity);
  const fr = label(entity, 'fr');
  return {
    name: { en: en ?? fr ?? original?.[1].value ?? fallbackId, ...(fr ? { fr } : {}) },
    ...(!en && (fr || original) ? { nameLanguage: fr ? 'fr' : original?.[0] } : {}),
  };
}

function entitySource(entity: Entity, property?: string, statement?: Claim): Source {
  return {
    label: `Wikidata · ${property ?? 'CC0'}`,
    license: 'CC0-1.0',
    url: `https://www.wikidata.org/wiki/${entity.id}${entity.lastrevid ? `?oldid=${entity.lastrevid}` : ''}${statement?.id ? `#${statement.id}` : property ? `#${property}` : ''}`,
  };
}

function evidence(
  entity: Entity,
  property: string,
  statement: Claim,
  entities: Map<string, Entity>,
) {
  const sources: Source[] = [entitySource(entity, property, statement)];
  for (const reference of statement.references ?? []) {
    for (const snak of snaks(reference.snaks?.P854)) {
      const url = snak.datavalue?.value;
      if (typeof url === 'string' && /^https?:\/\//i.test(url))
        sources.push({ label: 'Wikidata reference URL', url });
    }
    for (const snak of snaks(reference.snaks?.P248)) {
      const id = qid(snak.datavalue?.value);
      if (id)
        sources.push({
          label: `Wikidata stated in · ${label(entities.get(id)) ?? id}`,
          url: `https://www.wikidata.org/wiki/${id}`,
        });
    }
  }
  return {
    statementId: statement.id!,
    sourceEntityId: entity.id,
    sources: sources.filter(
      (source, index) => sources.findIndex((other) => other.url === source.url) === index,
    ),
  };
}

function wikiLinks(entity: Entity): NonNullable<Person['wikipedia']> {
  const links: NonNullable<Person['wikipedia']> = {};
  for (const language of ['fr', 'en'] as const) {
    const title = entity.sitelinks?.[`${language}wiki`]?.title;
    if (title)
      links[language] =
        `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  }
  return links;
}

/** Reject bad values individually, retaining the other source statements and raw cache. */
function sourcedDates(
  entity: Entity,
  statement: Claim,
  property: string,
  values: Snak[],
  entities: Map<string, Entity>,
  rejected: EnrichmentRejection[],
): SourcedDate[] {
  return values.flatMap((snak) => {
    const value = snak.datavalue?.value;
    if (!statement.id || typeof value !== 'object' || !value.time) return [];
    try {
      const parsed = parseWikidataTime(value.time, {
        precision: value.precision,
        calendar: value.calendarmodel,
        encoding: 'json',
      });
      const approximate = Boolean(
        value.before ||
        value.after ||
        ['P1480', 'P1319', 'P1326', 'P8555', 'P8554', 'P12506'].some(
          (property) => snaks(statement.qualifiers?.[property]).length,
        ) ||
        parsed.datePrecision === 'decade' ||
        parsed.datePrecision === 'century',
      );
      return [
        SourcedDateSchema.parse({
          date: parsed.date,
          precision: parsed.datePrecision,
          calendar: parsed.calendar,
          approximate: approximate || undefined,
          property,
          ...evidence(entity, property, statement, entities),
        }),
      ];
    } catch {
      rejected.push({
        sourceEntityId: entity.id,
        statementId: statement.id,
        property,
        reason: 'invalid-or-unsupported-person-date',
      });
      return [];
    }
  });
}

function yearBounds(dates: SourcedDate[]): { min: number; max: number } | undefined {
  if (!dates.length || dates.some((date) => date.approximate)) return undefined;
  return {
    min: Math.min(...dates.map((date) => date.date.year)),
    max: Math.max(...dates.map((date) => date.date.year)),
  };
}

function definitelyInverted(start: SourcedDate[], end: SourcedDate[]): boolean {
  const starts = yearBounds(start);
  const ends = yearBounds(end);
  if (!starts || !ends) return false;
  const calendars = new Set([...start, ...end].map((date) => date.calendar));
  if (calendars.size > 1) return ends.max < starts.min - 1;
  const earliestStart = start
    .map((date) => histDateBounds(date.date, date.calendar).earliest)
    .sort(compareHistDates)[0]!;
  const latestEnd = end
    .map((date) => histDateBounds(date.date, date.calendar).latest)
    .sort(compareHistDates)
    .at(-1)!;
  return compareHistDates(latestEnd, earliestStart) < 0;
}

/** A dated office/jurisdiction association must cover the whole sourced tenure.
 * A crossing or insufficiently dated tenure remains an office-only observation. */
function relationCoversTenure(
  relationEntity: Entity,
  relation: Claim,
  tenureEntity: Entity,
  tenure: Claim,
  entities: Map<string, Entity>,
  rejected: EnrichmentRejection[],
): boolean {
  if (
    ['P585', 'P1480', 'P1319', 'P1326', 'P8555', 'P8554', 'P12506'].some(
      (property) => snaks(relation.qualifiers?.[property]).length,
    )
  )
    return false;
  for (const property of ['P580', 'P582'] as const) {
    const scopeValues = snaks(relation.qualifiers?.[property]);
    if (!scopeValues.length) continue;
    const scope = sourcedDates(relationEntity, relation, property, scopeValues, entities, rejected);
    const dates = sourcedDates(
      tenureEntity,
      tenure,
      property,
      snaks(tenure.qualifiers?.[property]),
      entities,
      rejected,
    );
    if (!scope.length || !dates.length || [...scope, ...dates].some((date) => date.approximate))
      return false;
    for (const boundary of scope)
      for (const date of dates) {
        // Calendar conversion is not supplied by the source-normalization module.
        if (boundary.calendar !== date.calendar) return false;
        const bound = histDateBounds(boundary.date, boundary.calendar);
        const period = histDateBounds(date.date, date.calendar);
        if (property === 'P580' && compareHistDates(period.earliest, bound.latest) < 0)
          return false;
        if (property === 'P582' && compareHistDates(period.latest, bound.earliest) > 0)
          return false;
      }
  }
  return true;
}

export function buildPeople(
  events: HistoricalEvent[],
  entities: Map<string, Entity>,
  polityIds: Set<string>,
) {
  const rejected: EnrichmentRejection[] = [];
  const people = new Map<string, Person>();
  const invalidPeople = new Set<string>();
  const eventIndex = new Map(events.map((event) => [event.id, event]));
  const getPerson = (personId: string): Person | undefined => {
    if (people.has(personId)) return people.get(personId);
    if (invalidPeople.has(personId)) return undefined;
    const entity = entities.get(personId);
    if (!entity || !entityIds(entity, 'P31').includes('Q5') || sourceExclusion(entity)) {
      rejected.push({ personId, reason: entity ? 'not-human' : 'person-not-in-cache' });
      return undefined;
    }
    const descriptions = Object.values(entity.descriptions ?? {})
      .map((entry) => entry.value)
      .join(' ');
    if (/\bfictional (?:human|character|person)\b|personnage fictif/i.test(descriptions)) {
      rejected.push({ personId, reason: 'explicit-fictional-person' });
      return undefined;
    }
    const wikipedia = wikiLinks(entity);
    const image = historicalClaims(entity, 'P18')[0]?.mainsnak?.datavalue?.value;
    const dates = (property: string) =>
      historicalClaims(entity, property).flatMap((statement) =>
        sourcedDates(entity, statement, property, [statement.mainsnak!], entities, rejected),
      );
    const person = PersonSchema.parse({
      id: personId,
      ...sourceName(entity, personId),
      description: sourceDescription(entity),
      wikipedia,
      image:
        typeof image === 'string'
          ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(image)}?width=960`
          : undefined,
      birth: dates('P569'),
      death: dates('P570'),
      tenures: [],
      events: [],
      sources: [
        entitySource(entity),
        ...Object.entries(wikipedia).map(([language, url]) => ({
          label: `Wikipedia (${language})`,
          url,
          license: 'CC-BY-SA-4.0',
        })),
      ],
    });
    if (definitelyInverted(person.birth ?? [], person.death ?? [])) {
      invalidPeople.add(personId);
      rejected.push({ personId, sourceEntityId: personId, reason: 'life-dates-incoherent' });
      return undefined;
    }
    people.set(personId, person);
    return person;
  };
  const linkEvent = (
    event: HistoricalEvent,
    personId: string,
    property: EventPersonLink['property'],
    sourceEntity: Entity,
    statement: Claim,
    participantId?: string,
  ) => {
    if (!statement.id) {
      rejected.push({
        personId,
        eventId: event.id,
        property,
        reason: 'missing-statement-identifier',
      });
      return;
    }
    const person = getPerson(personId);
    if (!person) return;
    const born = yearBounds(person.birth ?? []);
    const died = yearBounds(person.death ?? []);
    const reason =
      born && born.min > (event.end?.year ?? event.start.year)
        ? 'event-before-person-birth'
        : died && died.max < event.start.year
          ? 'event-after-person-death'
          : undefined;
    if (reason) {
      rejected.push({
        personId,
        eventId: event.id,
        statementId: statement.id,
        sourceEntityId: sourceEntity.id,
        property,
        reason,
      });
      return;
    }
    const role = property === 'P4791' ? 'commander' : 'participant';
    const proof = {
      role,
      property,
      participantId,
      ...evidence(sourceEntity, property, statement, entities),
    };
    const link = EventPersonLinkSchema.parse({ personId, name: person.name, ...proof });
    const existing = event.people ?? [];
    if (
      existing.some(
        (entry) =>
          entry.personId === personId &&
          entry.property === property &&
          entry.statementId === statement.id &&
          entry.participantId === participantId,
      )
    )
      return;
    event.people = [...existing, link];
    person.events.push({
      eventId: event.id,
      name: event.name,
      type: event.type,
      start: event.start,
      end: event.end,
      coords: event.coords,
      role: link.role,
      property: link.property,
      participantId: link.participantId,
      statementId: link.statementId,
      sourceEntityId: link.sourceEntityId,
      sources: link.sources,
    });
  };
  for (const event of events) {
    delete event.people;
    const entity = entities.get(event.id);
    if (!entity) continue;
    for (const statement of historicalClaims(entity, 'P710')) {
      const participant = claimId(statement);
      if (
        participant &&
        entityIds(entities.get(participant) ?? { id: participant }, 'P31').includes('Q5')
      )
        linkEvent(event, participant, 'P710', entity, statement);
      for (const commander of qualifierIds(statement, 'P4791'))
        linkEvent(event, commander, 'P4791', entity, statement, participant);
    }
    for (const statement of historicalClaims(entity, 'P4791')) {
      const commander = claimId(statement);
      if (commander) linkEvent(event, commander, 'P4791', entity, statement);
    }
  }
  const tenures: PersonTenure[] = [];
  const addTenure = (
    personId: string,
    sourceEntity: Entity,
    statement: Claim,
    property: PersonTenure['property'],
    role: PersonTenure['role'],
    polityId?: string,
    officeId?: string,
    extraSources: Source[] = [],
  ) => {
    if (!statement.id) {
      rejected.push({
        personId,
        sourceEntityId: sourceEntity.id,
        property,
        reason: 'missing-statement-identifier',
      });
      return;
    }
    const person = getPerson(personId);
    if (!person) return;
    const start = sourcedDates(
      sourceEntity,
      statement,
      'P580',
      snaks(statement.qualifiers?.P580),
      entities,
      rejected,
    );
    const end = sourcedDates(
      sourceEntity,
      statement,
      'P582',
      snaks(statement.qualifiers?.P582),
      entities,
      rejected,
    );
    if (definitelyInverted(start, end)) {
      rejected.push({
        personId,
        sourceEntityId: sourceEntity.id,
        statementId: statement.id,
        property,
        reason: 'tenure-ends-before-start',
      });
      return;
    }
    const proof = evidence(sourceEntity, property, statement, entities);
    const tenure = PersonTenureSchema.parse({
      id: `${statement.id}/${polityId ?? officeId}/${role}`,
      personId,
      name: person.name,
      role,
      property,
      polity: polityId
        ? { id: polityId, ...sourceName(entities.get(polityId), polityId) }
        : undefined,
      office: officeId
        ? { id: officeId, ...sourceName(entities.get(officeId), officeId) }
        : undefined,
      start: start.length ? start : undefined,
      end: end.length ? end : undefined,
      ...proof,
      sources: [...proof.sources, ...extraSources],
    });
    person.tenures.push(tenure);
    tenures.push(tenure);
  };
  for (const polityId of [...polityIds].sort()) {
    const polity = entities.get(polityId);
    if (!polity) continue;
    for (const property of ['P35', 'P6'] as const)
      for (const statement of historicalClaims(polity, property)) {
        const personId = claimId(statement);
        if (!personId) continue;
        const officeProperty = property === 'P35' ? 'P1906' : 'P1313';
        const officeClaims = historicalClaims(polity, officeProperty).filter((office) =>
          relationCoversTenure(polity, office, polity, statement, entities, rejected),
        );
        const offices = [
          ...new Set(officeClaims.flatMap((office) => (claimId(office) ? [claimId(office)!] : []))),
        ];
        addTenure(
          personId,
          polity,
          statement,
          property,
          property === 'P35' ? 'head-of-state' : 'head-of-government',
          polityId,
          offices.length === 1 ? offices[0] : undefined,
          offices.length === 1
            ? officeClaims
                .filter((office) => claimId(office) === offices[0])
                .flatMap((office) => evidence(polity, officeProperty, office, entities).sources)
            : [],
        );
      }
  }
  // Reverse properties add only explicit participation in already-published events.
  for (const person of [...people.values()]) {
    const entity = entities.get(person.id)!;
    for (const property of ['P607', 'P1344'] as const)
      for (const statement of historicalClaims(entity, property)) {
        const id = claimId(statement);
        const event = id ? eventIndex.get(id) : undefined;
        if (event) linkEvent(event, person.id, property, entity, statement);
      }
    for (const statement of historicalClaims(entity, 'P39')) {
      const officeId = claimId(statement);
      if (!officeId) continue;
      const office = entities.get(officeId);
      const explicit = qualifierIds(statement, 'P1001');
      const jurisdictionClaims = historicalClaims(office, 'P1001').filter(
        (relation) =>
          office && relationCoversTenure(office, relation, entity, statement, entities, rejected),
      );
      const jurisdictions = explicit.length
        ? explicit
        : [
            ...new Set(
              jurisdictionClaims.flatMap((relation) =>
                claimId(relation) ? [claimId(relation)!] : [],
              ),
            ),
          ];
      if (!jurisdictions.length)
        addTenure(person.id, entity, statement, 'P39', 'office-holder', undefined, officeId);
      for (const polityId of jurisdictions) {
        const polity = entities.get(polityId);
        const stateClaims = historicalClaims(polity, 'P1906').filter(
          (relation) =>
            claimId(relation) === officeId &&
            polity &&
            relationCoversTenure(polity, relation, entity, statement, entities, rejected),
        );
        const governmentClaims = historicalClaims(polity, 'P1313').filter(
          (relation) =>
            claimId(relation) === officeId &&
            polity &&
            relationCoversTenure(polity, relation, entity, statement, entities, rejected),
        );
        const state = stateClaims.length > 0;
        const government = governmentClaims.length > 0;
        const role = state ? 'head-of-state' : government ? 'head-of-government' : 'office-holder';
        const extra = [
          ...(!explicit.length && office
            ? jurisdictionClaims
                .filter((relation) => claimId(relation) === polityId)
                .flatMap((relation) => evidence(office, 'P1001', relation, entities).sources)
            : []),
          ...(polity && (state || government)
            ? (state ? stateClaims : governmentClaims).flatMap(
                (relation) =>
                  evidence(polity, state ? 'P1906' : 'P1313', relation, entities).sources,
              )
            : []),
        ];
        addTenure(person.id, entity, statement, 'P39', role, polityId, officeId, extra);
      }
    }
  }
  for (const person of people.values()) {
    person.events.sort(
      (a, b) =>
        compareHistDates(a.start!, b.start!) ||
        a.eventId.localeCompare(b.eventId) ||
        a.statementId.localeCompare(b.statementId),
    );
    person.tenures.sort(
      (a, b) =>
        (a.start?.[0]?.date.year ?? Infinity) - (b.start?.[0]?.date.year ?? Infinity) ||
        a.id.localeCompare(b.id),
    );
  }
  const polities: PolityLeaders[] = [...polityIds].sort().map((polityId) => ({
    polityId,
    leaders: tenures.filter(
      (tenure) => tenure.polity?.id === polityId && tenure.role !== 'office-holder',
    ),
  }));
  return {
    people: [...people.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((person) => PersonSchema.parse(person)),
    polities,
    rejected,
  };
}
