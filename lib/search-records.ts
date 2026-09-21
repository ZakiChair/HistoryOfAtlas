import type { Person } from './schema';

export type PersonIndexRecord = Pick<Person, 'id' | 'name'> & { aliases?: string; year?: number };
export type SearchRecord = {
  id: string;
  targetId?: string;
  kind: 'event' | 'entity' | 'person';
  name: { fr?: string; en: string };
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
    title: `${person.name.fr ?? ''} ${person.name.en}`,
    year: person.year,
    aliases: person.aliases,
    type: 'person',
    importance: 0,
  };
}
