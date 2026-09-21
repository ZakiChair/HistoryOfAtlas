import type { Person } from './schema';
import { LOCALES, type LocalizedName } from './types';

export type PersonIndexRecord = Pick<Person, 'id' | 'name'> & { aliases?: string; year?: number };
export type SearchRecord = {
  id: string;
  targetId?: string;
  kind: 'event' | 'entity' | 'person';
  name: LocalizedName;
  title: string;
  year?: number;
  coords?: [number, number];
  type: string;
  importance: number;
  aliases?: string;
};

export function personSearchRecord(person: PersonIndexRecord): SearchRecord {
  return {
    id: `person-${person.id}`,
    targetId: person.id,
    kind: 'person',
    name: person.name,
    title: [...new Set(LOCALES.map((locale) => person.name[locale]).filter(Boolean))].join(' '),
    year: person.year,
    aliases: person.aliases,
    type: 'person',
    importance: 0,
  };
}
