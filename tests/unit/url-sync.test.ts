import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseAtlasUrl, useAtlasStore } from '../../lib/store';
import { createAtlasUrlSync } from '../../lib/store/url-sync';

const cleanups: (() => void)[] = [];

function mount(query = '?y=1800&play=1&speed=100') {
  let search = query;
  const writtenAt: number[] = [];
  useAtlasStore.getState().hydrateFromUrl(search);
  const writeQuery = vi.fn((next: string) => {
    search = next;
    writtenAt.push(performance.now());
  });
  const sync = createAtlasUrlSync({
    getState: useAtlasStore.getState,
    subscribe: (listener) => useAtlasStore.subscribe(listener),
    readQuery: () => search,
    writeQuery,
    hydrateQuery: (next) => useAtlasStore.getState().hydrateFromUrl(next),
  });
  cleanups.push(sync.dispose);
  return {
    ...sync,
    writeQuery,
    writtenAt,
    search: () => search,
    navigate: (next: string) => {
      search = next;
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  useAtlasStore.getState().reset();
});
afterEach(() => {
  for (const dispose of cleanups.splice(0)) dispose();
  vi.useRealTimers();
});

describe('live URL synchronization', () => {
  it('keeps advancing the shareable year during uninterrupted 100-year-per-second playback', () => {
    const sync = mount();
    try {
      for (let year = 1801; year <= 1900; year++) {
        useAtlasStore.getState().setYear(year);
        vi.advanceTimersByTime(10);
      }
      expect(parseAtlasUrl(sync.search()).year).toBe(1900);
      expect(sync.writtenAt.length).toBeGreaterThan(2);
      expect(sync.writtenAt.length).toBeLessThanOrEqual(5);
      for (let index = 1; index < sync.writtenAt.length; index++)
        expect(sync.writtenAt[index]! - sync.writtenAt[index - 1]!).toBeGreaterThanOrEqual(250);
    } finally {
      sync.dispose();
    }
  });
  it('publishes the latest camera and year at the existing deadline without postponing it', () => {
    const sync = mount();
    useAtlasStore.getState().setYear(1801);
    vi.advanceTimersByTime(50);
    useAtlasStore.getState().setYear(1850);
    vi.advanceTimersByTime(100);
    useAtlasStore.getState().setCamera({ lon: 43.125, lat: 12.25 });
    vi.advanceTimersByTime(99);
    expect(sync.writeQuery).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(parseAtlasUrl(sync.search())).toMatchObject({
      year: 1850,
      camera: { lon: 43.125, lat: 12.25 },
    });
    expect(sync.writtenAt).toEqual([0, 250]);
  });

  it('flushes the final year immediately when the timeline pauses and cancels its pending write', () => {
    const sync = mount();
    useAtlasStore.getState().setYear(1801);
    vi.advanceTimersByTime(50);
    useAtlasStore.getState().setYear(1850);
    useAtlasStore.getState().setPlaying(false);
    expect(parseAtlasUrl(sync.search())).toMatchObject({ year: 1850, playing: false });
    expect(sync.writtenAt).toEqual([0, 50]);
    vi.advanceTimersByTime(1000);
    expect(sync.writeQuery).toHaveBeenCalledTimes(2);
  });

  it('also publishes a campaign pause immediately with its final step', () => {
    const sync = mount('?campaign=Q10&cplay=1&step=0');
    useAtlasStore.getState().setCampaignStep(1);
    vi.advanceTimersByTime(50);
    useAtlasStore.getState().setCampaignStep(2);
    useAtlasStore.getState().setCampaignPlaying(false);
    expect(parseAtlasUrl(sync.search())).toMatchObject({
      campaignId: 'Q10',
      campaignStep: 2,
      campaignPlaying: false,
    });
    expect(sync.writtenAt).toEqual([0, 50]);
  });

  it('does not overwrite a popstate destination with a pending state or hydration notification', () => {
    const sync = mount();
    useAtlasStore.getState().setYear(1801);
    vi.advanceTimersByTime(50);
    useAtlasStore.getState().setYear(1850);
    const destination = '?y=-330&lang=en&lon=12.5&lat=4';
    sync.navigate(destination);
    sync.restore();
    expect(useAtlasStore.getState()).toMatchObject({
      year: -330,
      locale: 'en',
      camera: { lon: 12.5, lat: 4 },
    });
    vi.advanceTimersByTime(1000);
    expect(sync.search()).toBe(destination);
    expect(sync.writeQuery).toHaveBeenCalledTimes(1);
    useAtlasStore.getState().setYear(-329);
    expect(parseAtlasUrl(sync.search())).toMatchObject({ year: -329, locale: 'en' });
  });

  it('cancels pending writes and ignores later changes after cleanup', () => {
    const sync = mount();
    useAtlasStore.getState().setYear(1801);
    vi.advanceTimersByTime(50);
    useAtlasStore.getState().setYear(1850);
    sync.dispose();
    vi.advanceTimersByTime(1000);
    useAtlasStore.getState().setYear(1900);
    vi.advanceTimersByTime(1000);
    expect(sync.writeQuery).toHaveBeenCalledTimes(1);
    expect(parseAtlasUrl(sync.search()).year).toBe(1801);
  });

  it('does not replace an unchanged URL for repeated equal store values', () => {
    const sync = mount();
    useAtlasStore.getState().setYear(1801);
    vi.advanceTimersByTime(250);
    useAtlasStore.getState().setYear(1801);
    vi.advanceTimersByTime(500);
    expect(sync.writeQuery).toHaveBeenCalledTimes(1);
  });
});
