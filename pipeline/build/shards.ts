import type { HistDate } from '../../lib/histdate';

type TimedEvent = { id: string; start: HistDate; end?: HistDate };

/** Nominal bins exist only where a sourced event begins; long events are copied by overlap. */
export function temporalShards<T extends TimedEvent>(events: T[]) {
  const bins = new Map<number, number>();
  for (const event of events) {
    const width = event.start.year >= 1800 ? 10 : 100;
    const start = Math.floor(event.start.year / width) * width;
    bins.set(start, start + width - 1);
  }
  return [...bins.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([start, end]) => {
      const validFrom = start - 25;
      const validTo = end + 25;
      const members = events.filter(
        (event) =>
          event.start.year <= validTo && (event.end?.year ?? event.start.year) >= validFrom,
      );
      return {
        key: String(start),
        start,
        end,
        validFrom,
        validTo,
        path: `/data/event-shards/${start}.pmtiles`,
        count: members.length,
        events: members,
      };
    });
}
