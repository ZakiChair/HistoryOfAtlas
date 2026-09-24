import { compareHistDates } from '@/lib/histdate';
import type { HistDate, Story } from '@/lib/schema';

export interface StoryRange {
  start: HistDate;
  end: HistDate;
}

/** Event ids that date a story: its first and last documented steps. */
export function storyBoundaryEvents(story: Pick<Story, 'steps'>): string[] {
  const first = story.steps[0]?.eventId;
  const last = story.steps.at(-1)?.eventId;
  return [...new Set([first, last].filter((id): id is string => Boolean(id)))];
}

/** The earliest and latest start among the loaded events, whatever their step order. */
export function storyRange(events: readonly { start: HistDate }[]): StoryRange | null {
  if (!events.length) return null;
  const starts = events.map((event) => event.start).sort(compareHistDates);
  return { start: starts[0]!, end: starts.at(-1)! };
}

/** Dated stories first, oldest first; undated stories keep their published order after them. */
export function sortStoriesChronologically<T extends Pick<Story, 'id'>>(
  stories: readonly T[],
  ranges: ReadonlyMap<string, StoryRange>,
): T[] {
  return stories
    .map((story, index) => ({ story, index, range: ranges.get(story.id) }))
    .sort((a, b) => {
      if (a.range && b.range)
        return (
          compareHistDates(a.range.start, b.range.start) ||
          compareHistDates(a.range.end, b.range.end) ||
          a.index - b.index
        );
      if (a.range || b.range) return a.range ? -1 : 1;
      return a.index - b.index;
    })
    .map((entry) => entry.story);
}
