export function parsePoint(value: string): [number, number] | undefined {
  const match = /^Point\(([-+.\deE]+) ([-+.\deE]+)\)$/.exec(value);
  return match ? [Number(match[1]), Number(match[2])] : undefined;
}

export function dedupeEvents<T extends { id: string; importance: number }>(events: T[]): T[] {
  const unique = new Map<string, T>();
  for (const event of events) {
    const previous = unique.get(event.id);
    if (!previous || event.importance > previous.importance) unique.set(event.id, event);
  }
  return [...unique.values()];
}
