import { isChronologicallyPossible } from '@/lib/histdate';
import type { PersonTenure, SourcedDate } from '@/lib/schema';
import { PolityLeadersSchema } from '@/lib/schema';

export function parsePolityLeaders(value: unknown, polityId: string) {
  const parsed = PolityLeadersSchema.parse(value);
  if (parsed.polityId !== polityId || parsed.leaders.some((item) => item.polity?.id !== polityId))
    throw new Error('Political offices do not match the reviewed map identity.');
  return parsed;
}

function uniqueEndpoint(values: readonly SourcedDate[] | undefined): SourcedDate | null {
  if (!values?.length || values.some((value) => value.approximate)) return null;
  const identity = (value: SourcedDate) =>
    JSON.stringify([
      value.date.year,
      value.date.month,
      value.date.day,
      value.precision,
      value.calendar,
    ]);
  const unique = new Map(values.map((value) => [identity(value), value]));
  return unique.size === 1 ? [...unique.values()][0] : null;
}

/** Annual overlap is only asserted when both source endpoints agree at year precision or finer. */
export function tenureAtYear(
  tenure: Pick<PersonTenure, 'start' | 'end'>,
  year: number,
): 'documented' | 'outside' | 'uncertain' {
  const start = uniqueEndpoint(tenure.start);
  const end = uniqueEndpoint(tenure.end);
  if (
    !start ||
    !end ||
    ['decade', 'century'].includes(start.precision) ||
    ['decade', 'century'].includes(end.precision) ||
    !isChronologicallyPossible(start.date, end.date)
  )
    return 'uncertain';
  return year >= start.date.year && year <= end.date.year ? 'documented' : 'outside';
}
