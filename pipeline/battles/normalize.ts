import {
  BattleRecordSchema,
  type BattleRecord,
  type BattleParticipant,
  type SourcedQuantity,
} from '../../lib/battles/schema';
import type { HistoricalEvent, Source } from '../../lib/schema';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { coordinateIssues, isNearLand } from '../validate';
import {
  entityIds,
  label,
  sourceBattleMedium,
  type Claim,
  type ClaimValue,
  type Entity,
} from '../normalize';

type Snak = { datavalue?: { value: ClaimValue } };
const snaks = (value: unknown): Snak[] => (Array.isArray(value) ? (value as Snak[]) : []);
const ids = (value: unknown) =>
  snaks(value).flatMap((snak) => {
    const value = snak.datavalue?.value;
    return typeof value === 'object' && value.id ? [value.id] : [];
  });
const numbers = (value: string | undefined) =>
  value !== undefined && Number.isSafeInteger(Number(value)) && Number(value) >= 0
    ? Number(value)
    : undefined;

export function entitySources(entity: Entity, claim?: Claim): Source[] {
  const sources: Source[] = [
    {
      label: 'Wikidata · CC0',
      url: `https://www.wikidata.org/wiki/${entity.id}${entity.lastrevid ? `?oldid=${entity.lastrevid}` : ''}${claim?.id ? `#${claim.id}` : ''}`,
      license: 'CC0-1.0',
    },
  ];
  for (const reference of claim?.references ?? []) {
    for (const prop of ['P854', 'P4656'])
      for (const snak of snaks(reference.snaks?.[prop])) {
        const value = snak.datavalue?.value;
        if (typeof value === 'string' && /^https?:\/\//.test(value))
          sources.push({ label: 'Statement reference', url: value });
      }
    for (const id of ids(reference.snaks?.P248))
      sources.push({
        label: `Referenced work · ${id}`,
        url: `https://www.wikidata.org/wiki/${id}`,
      });
  }
  return sources;
}

/** Description rules refer to the engagement itself, never its name or its parent war. */
export function battleMedium(entity: Entity, type: BattleRecord['type']): BattleRecord['medium'] {
  if (type === 'naval') return 'naval';
  const known = sourceBattleMedium(entity);
  if (known) return known;
  const description = (language: string) => entity.descriptions?.[language]?.value ?? '';
  if (/^(?:\d{4}\s+)?air battle\b/i.test(description('en'))) return 'air';
  if (
    /^(?:\d{4}\s+)?naval (?:conflict|engagement|action|skirmish)\b/i.test(description('en')) ||
    /^(?:engagement|incident|combat) naval\b/i.test(description('fr')) ||
    /^battaglia navale\b/i.test(description('it')) ||
    /^(?:uma\s+)?batalha naval\b/i.test(description('pt')) ||
    /^морское сражение(?:\s|$)/i.test(description('ru')) ||
    /^bitwa morska\b/i.test(description('pl')) ||
    /^námořní bitva\b/i.test(description('cs'))
  )
    return 'naval';
  return 'land';
}

// These source places describe an expanse, not the position of an engagement.
// QIDs verified through wbgetentities; no centroid can locate a battle in that expanse.
const broadWaterPlaceClasses = new Set([
  'Q9430', // Ocean.
  'Q165', // Sea.
  'Q204894', // Marginal sea.
  'Q1322134', // Gulf.
  'Q39594', // Bay.
  'Q37901', // Strait.
  'Q33837', // Archipelago.
  'Q1402592', // Island group.
]);

/** Validate each source position before choosing it; a bad first point must not hide a valid one. */
export function resolveBattleCoordinates(
  entity: Entity,
  entities: Map<string, Entity>,
  medium: BattleRecord['medium'],
  land: FeatureCollection<Polygon | MultiPolygon>,
): Pick<HistoricalEvent, 'coords' | 'coordinateSource'> & { missing: string[] } {
  const missing = new Set<string>();
  // A generic "battle" class does not establish land combat. Retrying a nearby
  // on-land place would move misclassified naval battles onto the coast.
  const siege = entityIds(entity, 'P31').includes('Q188055');
  for (const location of [
    entity,
    ...entityIds(entity, 'P276')
      .map((id) => entities.get(id))
      .filter((place): place is Entity => Boolean(place)),
  ]) {
    if (
      location.id !== entity.id &&
      entityIds(location, 'P31').some((id) => broadWaterPlaceClasses.has(id))
    ) {
      missing.add('broad-place-coordinate');
      continue;
    }
    const claims = (location.claims?.P625 ?? []).filter(
      (claim) => claim.rank !== 'deprecated' && claim.mainsnak?.datavalue,
    );
    const preferred = claims.filter((claim) => claim.rank === 'preferred');
    for (const claim of preferred.length ? preferred : claims) {
      const point = claim.mainsnak!.datavalue!.value;
      if (
        !point ||
        typeof point !== 'object' ||
        point.longitude === undefined ||
        point.latitude === undefined
      )
        continue;
      if (point.globe && !point.globe.endsWith('/Q2')) {
        missing.add('non-earth-coordinate');
        continue;
      }
      const coords: [number, number] = [point.longitude, point.latitude];
      if (coordinateIssues(coords).length) {
        missing.add('invalid-coordinate');
        continue;
      }
      if (medium === 'land' && !isNearLand(coords, land)) {
        missing.add('land-event-in-open-ocean');
        if (!siege) return { missing: [...missing] };
        continue;
      }
      return {
        coords,
        coordinateSource: {
          kind: location.id === entity.id ? 'event' : 'place',
          entityId: location.id,
          url: entitySources(location, claim)[0]!.url,
        },
        missing: [],
      };
    }
  }
  if (!missing.has('land-event-in-open-ocean')) missing.add('missing-coordinates');
  return { missing: [...missing] };
}

export function quantityEvidence(
  entity: Entity,
  claim: Claim,
  property: string,
  defaultScope: SourcedQuantity['scope'],
  explicitParticipant?: string,
): SourcedQuantity | undefined {
  if (claim.rank === 'deprecated') return undefined;
  const raw = claim.mainsnak?.datavalue?.value;
  if (!raw || typeof raw !== 'object' || !raw.amount) return undefined;
  const value = numbers(raw.amount);
  if (value === undefined) return undefined;
  const min = numbers(raw.lowerBound);
  const max = numbers(raw.upperBound);
  if ((min !== undefined && min > value) || (max !== undefined && max < value)) return undefined;
  const qualifiers = claim.qualifiers ?? {};
  const targets = explicitParticipant
    ? [explicitParticipant]
    : [...new Set(['P518', 'P6001', 'P17'].flatMap((property) => ids(qualifiers[property])))];
  return {
    value,
    ...(min !== undefined ? { min } : {}),
    ...(max !== undefined ? { max } : {}),
    approximate: Boolean(
      (min !== undefined && min !== value) ||
      (max !== undefined && max !== value) ||
      qualifiers.P1480 ||
      qualifiers.P5102,
    ),
    counts: 'unknown',
    scope: targets.length
      ? 'participant'
      : Object.keys(qualifiers).some((key) => !['P1480', 'P5102'].includes(key))
        ? 'subset'
        : defaultScope,
    ...(targets.length ? { participantIds: targets } : {}),
    renderable: false,
    statementId: claim.id,
    property,
    ...(raw.unit && raw.unit !== '1'
      ? {
          rawUnit: raw.unit,
          note: 'The source uses an unrecognized quantity unit. This evidence is preserved without interpreting it as a count of people or military units.',
        }
      : {}),
    ...(Object.keys(qualifiers).length ? { qualifiers } : {}),
    sources: entitySources(entity, claim),
  };
}

function participantKind(entity: Entity | undefined): BattleParticipant['kind'] {
  if (!entity) return 'unknown';
  const classes = entityIds(entity, 'P31');
  if (classes.includes('Q5')) return 'person';
  if (
    classes.some((id) =>
      [
        'Q176799',
        'Q37726',
        'Q781132', // Military branch, https://www.wikidata.org/wiki/Q781132
        'Q772547', // Armed forces, https://www.wikidata.org/wiki/Q772547
      ].includes(id),
    )
  )
    return 'military-unit';
  if (
    classes.some((id) =>
      [
        'Q6256',
        'Q7275',
        'Q3624078',
        'Q3024240',
        'Q133156',
        'Q179164',
        'Q417175',
        'Q48349',
        'Q133442', // Explicit city-state; an ordinary city is not sufficient.
        'Q148837', // Polis, the ancient Greek city-state category.
        'Q99541706', // Historical unrecognized state; still a political participant.
        'Q10711424', // State with limited recognition; classification is not recognition.
      ].includes(id),
    )
  )
    return 'polity';
  return 'unknown';
}

type BattleInput = Pick<HistoricalEvent, 'id' | 'name' | 'type' | 'sources'> &
  Partial<HistoricalEvent>;
export function normalizeBattle(
  event: BattleInput,
  entity: Entity,
  entities: Map<string, Entity>,
): BattleRecord {
  if (!['battle', 'siege', 'naval'].includes(event.type))
    throw new Error('Only engagements belong in the battle catalog');
  const participants: BattleParticipant[] = [];
  for (const claim of entity.claims?.P710 ?? []) {
    if (claim.rank === 'deprecated') continue;
    const raw = claim.mainsnak?.datavalue?.value;
    if (!raw || typeof raw !== 'object' || !raw.id) continue;
    const participant = entities.get(raw.id);
    const entry: BattleParticipant = {
      id: raw.id,
      name: {
        en: label(participant) ?? raw.id,
        ...(label(participant, 'fr') ? { fr: label(participant, 'fr') } : {}),
      },
      kind: participantKind(participant),
      strength: [],
      deaths: [],
      casualties: [],
      sources: [
        ...entitySources(entity, claim),
        ...(participant ? entitySources(participant) : []),
      ],
    };
    for (const [property, field] of [
      ['P1132', 'strength'],
      ['P1120', 'deaths'],
      ['P1590', 'casualties'],
      ['P1114', 'strength'],
    ] as const)
      for (const snak of snaks(claim.qualifiers?.[property])) {
        const quantity = quantityEvidence(
          entity,
          { ...claim, mainsnak: snak },
          property,
          'participant',
          raw.id,
        );
        if (quantity) entry[field].push(quantity);
      }
    const existing = participants.find((item) => item.id === entry.id);
    if (existing) {
      for (const field of ['strength', 'deaths', 'casualties'] as const)
        existing[field].push(...entry[field]);
    } else participants.push(entry);
  }
  const totals: BattleRecord['totals'] = { strength: [], deaths: [], casualties: [] };
  const unassigned: BattleRecord['totals'] = { strength: [], deaths: [], casualties: [] };
  for (const [property, field] of [
    ['P1132', 'strength'],
    ['P1120', 'deaths'],
    ['P1590', 'casualties'],
  ] as const)
    for (const claim of entity.claims?.[property] ?? []) {
      const quantity = quantityEvidence(entity, claim, property, 'total');
      if (!quantity) continue;
      const target =
        quantity.participantIds?.length === 1
          ? participants.find((entry) => entry.id === quantity.participantIds![0])
          : undefined;
      if (target) target[field].push(quantity);
      else if (quantity.scope === 'total') totals[field].push(quantity);
      else unassigned[field].push(quantity);
    }
  return BattleRecordSchema.parse({
    id: event.id,
    name: event.name,
    nameLanguage: event.nameLanguage,
    type: event.type,
    start: event.start,
    end: event.end,
    coords: event.coords,
    coordinateSource: event.coordinateSource,
    region: event.region,
    era: event.era,
    medium: battleMedium(entity, event.type as BattleRecord['type']),
    participants,
    totals,
    unassigned,
    sources: event.sources,
  });
}
