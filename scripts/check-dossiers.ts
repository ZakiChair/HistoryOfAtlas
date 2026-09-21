import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { HistoricalEventSchema, PersonSchema, PolityLeadersSchema } from '../lib/schema';

const directory = join(process.cwd(), 'public/data');
async function records<T>(folder: string, parse: (record: unknown) => T): Promise<T[]> {
  const files = (await readdir(join(directory, folder))).filter((file) =>
    /^Q[1-9]\d*\.json$/.test(file),
  );
  const pending = [...files];
  const output: T[] = [];
  await Promise.all(
    Array.from({ length: 16 }, async () => {
      while (pending.length) {
        const file = pending.pop()!;
        const record = parse(JSON.parse(await readFile(join(directory, folder, file), 'utf8')));
        output.push(record);
      }
    }),
  );
  return output;
}

const [events, people, polities] = await Promise.all([
  records('events', (value) => HistoricalEventSchema.parse(value)),
  records('people', (value) => PersonSchema.parse(value)),
  records('polity-leaders', (value) => PolityLeadersSchema.parse(value)),
]);
if (!people.length) throw new Error('No sourced person dossiers were published.');
const peopleById = new Map(people.map((person) => [person.id, person]));
const eventsById = new Map(events.map((event) => [event.id, event]));
const issues: string[] = [];
let links = 0;
for (const event of events) {
  for (const link of event.people ?? []) {
    links++;
    const person = peopleById.get(link.personId);
    if (!person) issues.push(`${event.id}: missing person ${link.personId}`);
    else if (
      !person.events.some(
        (reverse) =>
          reverse.eventId === event.id &&
          reverse.statementId === link.statementId &&
          reverse.role === link.role &&
          reverse.property === link.property,
      )
    )
      issues.push(`${event.id}: missing reciprocal evidence in ${person.id}`);
  }
}
for (const person of people) {
  for (const link of person.events) {
    const event = eventsById.get(link.eventId);
    if (!event) issues.push(`${person.id}: missing event ${link.eventId}`);
    else if (
      !event.people?.some(
        (reverse) =>
          reverse.personId === person.id &&
          reverse.statementId === link.statementId &&
          reverse.role === link.role &&
          reverse.property === link.property,
      )
    )
      issues.push(`${person.id}: missing reciprocal evidence in ${event.id}`);
  }
  for (const tenure of person.tenures)
    if (tenure.personId !== person.id)
      issues.push(`${person.id}: office assigned to ${tenure.personId}`);
}
for (const polity of polities) {
  for (const tenure of polity.leaders) {
    const person = peopleById.get(tenure.personId);
    if (
      !person?.tenures.some(
        (record) => record.id === tenure.id && record.statementId === tenure.statementId,
      )
    )
      issues.push(`${polity.polityId}: missing office evidence for ${tenure.personId}`);
  }
}
const report = JSON.parse(await readFile(join(directory, 'enrichment.json'), 'utf8'));
if (report.totalPeople !== people.length)
  issues.push('Person count does not match the coverage report.');
if (issues.length)
  throw new Error(
    `${issues.length} dossier integrity failures:\n${issues.slice(0, 30).join('\n')}`,
  );
console.log(
  JSON.stringify({
    events: events.length,
    people: people.length,
    eventPersonLinks: links,
    polityCatalogs: polities.length,
    provenance: 'validated',
    reciprocalLinks: 'validated',
  }),
);
