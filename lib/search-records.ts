import type { Campaign, Person } from './schema';
import type { ReligionDataset } from './religions/types';
import { LOCALES, type LocalizedName } from './types';

export const SEARCH_KINDS = ['event', 'entity', 'person', 'religion', 'campaign'] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

export type PersonIndexRecord = Pick<Person, 'id' | 'name'> & { aliases?: string; year?: number };
export type SearchRecord = {
  id: string;
  /** The identifier the destination understands when `id` carries a kind prefix. */
  targetId?: string;
  /** The tradition of a religious milestone, applied as the map's religion filter. */
  parentId?: string;
  kind: SearchKind;
  name: LocalizedName;
  title: string;
  year?: number;
  /** The source gives this year as approximate. */
  approximate?: boolean;
  coords?: [number, number];
  type: string;
  importance: number;
  aliases?: string;
  /** A secondary label shown beside the name, such as the tradition of a milestone. */
  context?: LocalizedName;
};

type ReligionSource = {
  traditions: Pick<ReligionDataset['traditions'][number], 'id' | 'names'>[];
  milestones: Pick<
    ReligionDataset['milestones'][number],
    'id' | 'traditionId' | 'kind' | 'year' | 'approximate' | 'title' | 'coordinates' | 'area'
  >[];
};
type CampaignSource = Pick<Campaign, 'id' | 'name' | 'polity'> & {
  steps: Pick<Campaign['steps'][number], 'coords' | 'date'>[];
};

const titleOf = (name: Partial<Record<string, string>>) =>
  [...new Set(LOCALES.map((locale) => name[locale]).filter(Boolean))].join(' ');
/** Catalogue identifiers such as `yoruba-orisha` double as common English names. */
const slugWords = (id: string) => id.replace(/-/g, ' ');

export function personSearchRecord(person: PersonIndexRecord): SearchRecord {
  return {
    id: `person-${person.id}`,
    targetId: person.id,
    kind: 'person',
    name: person.name,
    title: titleOf(person.name),
    year: person.year,
    aliases: person.aliases,
    type: 'person',
    importance: 0,
  };
}

/** Traditions and their dated milestones, in the two languages the catalogue is written in. */
export function religionSearchRecords(dataset: ReligionSource): SearchRecord[] {
  const traditions = new Map(dataset.traditions.map((tradition) => [tradition.id, tradition]));
  const origins = new Map<string, ReligionSource['milestones'][number]>();
  for (const stage of dataset.milestones) {
    const known = origins.get(stage.traditionId);
    if (stage.kind === 'origin' && (!known || stage.year < known.year))
      origins.set(stage.traditionId, stage);
  }
  const records: SearchRecord[] = dataset.traditions.map((tradition) => {
    const origin = origins.get(tradition.id);
    const names = titleOf(tradition.names);
    const slug = slugWords(tradition.id);
    return {
      id: `tradition-${tradition.id}`,
      targetId: tradition.id,
      kind: 'religion',
      name: tradition.names,
      title: names.toLowerCase().includes(slug) ? names : `${names} ${slug}`,
      // The first attestation places the map; it is not shown as a founding date.
      year: origin?.year,
      approximate: origin?.approximate,
      coords: origin?.coordinates,
      type: 'tradition',
      importance: 0,
    };
  });
  for (const stage of dataset.milestones) {
    const tradition = traditions.get(stage.traditionId);
    if (!tradition) continue;
    records.push({
      id: `milestone-${stage.id}`,
      targetId: stage.id,
      parentId: tradition.id,
      kind: 'religion',
      name: stage.title,
      title: titleOf(stage.title),
      year: stage.year,
      approximate: stage.approximate,
      coords: stage.coordinates,
      type: 'milestone',
      importance: 0,
      aliases: [
        titleOf(tradition.names),
        slugWords(tradition.id),
        stage.area ? titleOf(stage.area.label) : '',
      ]
        .filter(Boolean)
        .join(' '),
      context: tradition.names,
    });
  }
  return records;
}

export function campaignSearchRecord(campaign: CampaignSource): SearchRecord {
  const first = campaign.steps[0];
  return {
    id: `campaign-${campaign.id}`,
    targetId: campaign.id,
    kind: 'campaign',
    name: campaign.name,
    title: titleOf(campaign.name),
    year: first?.date.year,
    coords: first?.coords,
    type: 'campaign',
    importance: 0,
    aliases: campaign.polity,
  };
}

/** Typos are tolerated only in longer words: short ones otherwise match unrelated names
 * ("oil" found "Wil"). */
export const searchFuzziness = (term: string): number | false => (term.length < 6 ? false : 0.2);

/** Relevance multiplier: sourced importance orders events, a guided route or a tradition
 * comes before the many events or milestones that share its words, and people and
 * territories, which have no comparable score, stay neutral. */
export function searchBoost(stored: { kind?: unknown; type?: unknown; importance?: unknown }) {
  if (stored.kind === 'event')
    return 1 + ((typeof stored.importance === 'number' ? stored.importance : 50) - 50) / 200;
  if (stored.kind === 'campaign') return 1.15;
  if (stored.kind === 'religion') return stored.type === 'tradition' ? 1.25 : 1;
  if (stored.kind === 'entity') return 1.05;
  return 1;
}
