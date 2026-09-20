export function surroundingSnapshots<T extends { year: number }>(snapshots: T[], year: number) {
  if (!snapshots.length) return null;
  const ordered = [...snapshots].sort((a, b) => a.year - b.year);
  if (year <= ordered[0].year) return { before: ordered[0], after: ordered[0], mix: 0 };
  const index = ordered.findIndex((snapshot) => snapshot.year > year);
  if (index === -1) return { before: ordered.at(-1)!, after: ordered.at(-1)!, mix: 0 };
  const before = ordered[index - 1],
    after = ordered[index];
  return { before, after, mix: (year - before.year) / (after.year - before.year) };
}

export function temporalWindow(speed: number, playing: boolean) {
  return playing ? Math.max(2, Math.ceil(speed / 4)) : 3;
}

type Filterable = {
  id: string;
  type: string;
  start: { year: number };
  end?: { year: number };
  importance: number;
  region: string;
  era: string;
  parentWar?: string;
  belligerents?: { entityId: string }[];
};
export function filterEvents<T extends Filterable>(
  events: T[],
  options: {
    year: number;
    window: number;
    types: string[];
    regions: string[];
    eras: string[];
    minImportance: number;
    entity?: string | null;
    range?: [number, number] | null;
    war?: string | null;
  },
) {
  const [from, to] = options.range ?? [
    options.year - options.window,
    options.year + options.window,
  ];
  return events.filter(
    (event) =>
      (event.end?.year ?? event.start.year) >= from &&
      event.start.year <= to &&
      (!options.types.length || options.types.includes(event.type)) &&
      (!options.regions.length || options.regions.includes(event.region)) &&
      (!options.eras.length || options.eras.includes(event.era)) &&
      event.importance >= options.minImportance &&
      (!options.war || event.parentWar === options.war || event.id === options.war) &&
      (!options.entity || event.belligerents?.some((side) => side.entityId === options.entity)),
  );
}
