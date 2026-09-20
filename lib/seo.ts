import type { HistoricalEvent } from '@/lib/schema';

type IndexableEvent = Pick<HistoricalEvent, 'id' | 'importance' | 'type'>;

/** Shared static-export eligibility; the browser need not load an editorial index. */
export function hasStaticEventPage(
  event: IndexableEvent,
  curatedIds?: ReadonlySet<string>,
): boolean {
  return (
    event.importance >= 60 ||
    Boolean(curatedIds?.has(event.id)) ||
    ['war', 'campaign', 'treaty'].includes(event.type)
  );
}

/** Less prominent records still have a permanent, valid URL opening their map detail. */
export function getEventPermalink(
  event: Pick<HistoricalEvent, 'id' | 'importance' | 'type' | 'start' | 'coords'>,
): string {
  if (hasStaticEventPage(event)) return `/event/${event.id}/`;
  const query = new URLSearchParams({ y: String(event.start.year), e: event.id });
  if (event.coords) {
    query.set('lon', String(event.coords[0]));
    query.set('lat', String(event.coords[1]));
    query.set('z', '5');
  }
  return `/?${query.toString()}`;
}
