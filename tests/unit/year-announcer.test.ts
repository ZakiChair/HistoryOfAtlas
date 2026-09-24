import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAtlasStore } from '../../lib/store';
import { createYearAnnouncer, YEAR_ANNOUNCEMENT_DELAY_MS } from '../../lib/year-announcer';

const cleanups: (() => void)[] = [];

function mount(muted = () => false) {
  const announce = vi.fn<(year: number) => void>();
  const announcer = createYearAnnouncer({
    getState: useAtlasStore.getState,
    subscribe: (listener) => useAtlasStore.subscribe(listener),
    announce,
    muted,
  });
  cleanups.push(announcer.dispose);
  return announce;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  useAtlasStore.getState().reset();
  useAtlasStore.getState().setYear(1800);
});
afterEach(() => {
  for (const dispose of cleanups.splice(0)) dispose();
  vi.useRealTimers();
});

describe('screen reader year announcements', () => {
  it('waits for keyboard repeats to settle and announces the last year once', () => {
    const announce = mount();
    for (const year of [1801, 1802, 1803]) {
      useAtlasStore.getState().setYear(year);
      vi.advanceTimersByTime(YEAR_ANNOUNCEMENT_DELAY_MS / 3);
    }
    expect(announce).not.toHaveBeenCalled();
    vi.advanceTimersByTime(YEAR_ANNOUNCEMENT_DELAY_MS);
    expect(announce.mock.calls).toEqual([[1803]]);
    vi.advanceTimersByTime(YEAR_ANNOUNCEMENT_DELAY_MS * 5);
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('stays silent through playback and states the year where playback stopped', () => {
    const announce = mount();
    useAtlasStore.getState().setYear(1801);
    useAtlasStore.getState().setPlaying(true);
    for (let year = 1802; year <= 1850; year++) {
      useAtlasStore.getState().setYear(year);
      vi.advanceTimersByTime(YEAR_ANNOUNCEMENT_DELAY_MS * 2);
    }
    expect(announce).not.toHaveBeenCalled();
    useAtlasStore.getState().setPlaying(false);
    vi.advanceTimersByTime(YEAR_ANNOUNCEMENT_DELAY_MS);
    expect(announce.mock.calls).toEqual([[1850]]);
  });

  it('never speaks during campaign or battle playback', () => {
    const announce = mount();
    // Raw flags: the announcer only reads them, whatever started the playback.
    useAtlasStore.setState({ campaignPlaying: true, year: 1805 });
    vi.advanceTimersByTime(YEAR_ANNOUNCEMENT_DELAY_MS * 2);
    useAtlasStore.setState({ year: 1806 });
    vi.advanceTimersByTime(YEAR_ANNOUNCEMENT_DELAY_MS * 2);
    useAtlasStore.setState({ campaignPlaying: false, battlePlaying: true });
    useAtlasStore.setState({ year: 1807 });
    vi.advanceTimersByTime(YEAR_ANNOUNCEMENT_DELAY_MS * 2);
    expect(announce).not.toHaveBeenCalled();
  });

  it('lets the opening tour speak for itself and does not repeat its final year', () => {
    let muted = true;
    const announce = mount(() => muted);
    for (const year of [-3500, -330, 1812]) {
      useAtlasStore.getState().setYear(year);
      vi.advanceTimersByTime(YEAR_ANNOUNCEMENT_DELAY_MS * 2);
    }
    muted = false;
    useAtlasStore.getState().setYear(1812);
    vi.advanceTimersByTime(YEAR_ANNOUNCEMENT_DELAY_MS * 2);
    expect(announce).not.toHaveBeenCalled();
    useAtlasStore.getState().setYear(1813);
    vi.advanceTimersByTime(YEAR_ANNOUNCEMENT_DELAY_MS);
    expect(announce.mock.calls).toEqual([[1813]]);
  });

  it('leaves a year change that opens a record to the record’s own dossier', () => {
    const announce = mount();
    useAtlasStore.getState().patchState({ year: 1815, selectedEvent: 'Q48314' });
    vi.advanceTimersByTime(YEAR_ANNOUNCEMENT_DELAY_MS * 2);
    expect(announce).not.toHaveBeenCalled();
    useAtlasStore.getState().setYear(1816);
    vi.advanceTimersByTime(YEAR_ANNOUNCEMENT_DELAY_MS);
    expect(announce.mock.calls).toEqual([[1816]]);
  });

  it('stops listening once disposed', () => {
    const announce = mount();
    useAtlasStore.getState().setYear(1900);
    for (const dispose of cleanups.splice(0)) dispose();
    vi.advanceTimersByTime(YEAR_ANNOUNCEMENT_DELAY_MS * 2);
    useAtlasStore.getState().setYear(1901);
    vi.advanceTimersByTime(YEAR_ANNOUNCEMENT_DELAY_MS * 2);
    expect(announce).not.toHaveBeenCalled();
  });
});
