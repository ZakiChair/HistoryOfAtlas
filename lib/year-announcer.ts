import type { AtlasState } from './store';

/** Long enough to let keyboard repeats and the opening year tour settle into one message. */
export const YEAR_ANNOUNCEMENT_DELAY_MS = 900;

export interface YearAnnouncerOptions {
  getState: () => AtlasState;
  subscribe: (listener: (state: AtlasState, previous: AtlasState) => void) => () => void;
  /** Called with the settled year; the caller words the message with its latest context. */
  announce: (year: number) => void;
  /** True while something else narrates the year, such as the opening tour. */
  muted?: () => boolean;
  delay?: number;
}

const playingSomething = (state: AtlasState) =>
  state.playing || state.campaignPlaying || state.battlePlaying;

/** Opening a record moves focus to its dossier, which already states its date. */
const selectionKey = (state: AtlasState) =>
  [
    state.selectedEvent,
    state.selectedEntity,
    state.selectedPerson,
    state.campaignId,
    state.campaignStep,
    state.storyId,
    state.storyStep,
  ].join('|');

/**
 * Announces a year once it has settled after a change the reader made: never during
 * playback, once when playback stops, and not when the same change opened a record.
 */
export function createYearAnnouncer({
  getState,
  subscribe,
  announce,
  muted = () => false,
  delay = YEAR_ANNOUNCEMENT_DELAY_MS,
}: YearAnnouncerOptions) {
  let announced = getState().year;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const unsubscribe = subscribe((state, previous) => {
    if (playingSomething(state)) {
      cancel();
      return;
    }
    if (muted() || selectionKey(state) !== selectionKey(previous)) {
      cancel();
      announced = state.year;
      return;
    }
    if (state.year === previous.year && !playingSomething(previous)) return;
    cancel();
    timer = setTimeout(() => {
      timer = undefined;
      const current = getState();
      if (playingSomething(current)) return;
      if (muted()) {
        announced = current.year;
        return;
      }
      if (current.year === announced) return;
      announced = current.year;
      announce(current.year);
    }, delay);
  });
  return {
    dispose() {
      cancel();
      unsubscribe();
    },
  };
}
