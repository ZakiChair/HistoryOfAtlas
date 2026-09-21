import { beforeEach, describe, expect, it } from 'vitest';
import { openEvent, openPerson } from '../../lib/navigation';
import * as navigation from '../../lib/navigation';
import { useAtlasStore } from '../../lib/store';

describe('person navigation', () => {
  beforeEach(() => useAtlasStore.getState().reset());

  it('keeps the sourced battle and exact view when consulting one of its people', () => {
    useAtlasStore
      .getState()
      .patchState({ selectedEvent: 'Q10', campaignId: 'Q20', campaignStep: 2, year: 0 });
    const camera = useAtlasStore.getState().camera;
    openPerson('Q30', { preserveContext: true });
    expect(useAtlasStore.getState()).toMatchObject({
      selectedPerson: 'Q30',
      selectedEvent: 'Q10',
      campaignId: 'Q20',
      campaignStep: 2,
      year: 0,
    });
    expect(useAtlasStore.getState().camera).toBe(camera);
    useAtlasStore.getState().selectPerson(null);
    expect(useAtlasStore.getState().selectedEvent).toBe('Q10');
  });

  it('search opens a person without carrying an unrelated event or campaign context', () => {
    useAtlasStore.getState().patchState({
      selectedEvent: 'Q10',
      selectedEntity: 'clio-ab12',
      campaignId: 'Q20',
      selectedWar: 'Q40',
      storyId: 'story',
      year: 0,
    });
    openPerson('Q30', { preserveContext: false });
    expect(useAtlasStore.getState()).toMatchObject({
      selectedPerson: 'Q30',
      selectedEvent: null,
      selectedEntity: null,
      campaignId: null,
      selectedWar: null,
      storyId: null,
      year: 0,
    });
    openEvent({ id: 'Q10', start: { year: 1 } });
    expect(useAtlasStore.getState()).toMatchObject({ selectedPerson: null, selectedEvent: 'Q10' });
  });

  it('ignores a malformed person identifier without changing the current selection', () => {
    useAtlasStore.getState().selectEvent('Q10');
    const before = useAtlasStore.getState();
    openPerson('../../other');
    expect(useAtlasStore.getState()).toBe(before);
  });

  it('a slower previous event request cannot replace the latest chosen event', async () => {
    expect(navigation.createEventNavigation).toBeTypeOf('function');
    const pending = new Map<string, (value: { id: string; start: { year: number } }) => void>();
    const navigator = navigation.createEventNavigation(
      (id) => new Promise((resolve) => pending.set(id, resolve)),
    );
    const previous = navigator.open('Q10');
    const latest = navigator.open('Q20');
    pending.get('Q20')!({ id: 'Q20', start: { year: 2 } });
    expect(await latest).toBe(true);
    pending.get('Q10')!({ id: 'Q10', start: { year: 1 } });
    expect(await previous).toBe(false);
    expect(useAtlasStore.getState()).toMatchObject({ selectedEvent: 'Q20', year: 2 });
  });

  it('leaving the person context prevents a pending event from reopening a detail', async () => {
    expect(navigation.createEventNavigation).toBeTypeOf('function');
    let resolve!: (value: { id: string; start: { year: number } }) => void;
    const navigator = navigation.createEventNavigation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    openPerson('Q30');
    const pending = navigator.open('Q10', {
      isCurrent: () => useAtlasStore.getState().selectedPerson === 'Q30',
    });
    useAtlasStore.getState().selectPerson(null);
    resolve({ id: 'Q10', start: { year: 1 } });
    expect(await pending).toBe(false);
    expect(useAtlasStore.getState().selectedEvent).toBeNull();
  });

  it('cancellation silences stale errors and permits a later remount request', async () => {
    expect(navigation.createEventNavigation).toBeTypeOf('function');
    let reject!: (error: Error) => void;
    const navigator = navigation.createEventNavigation((id) =>
      id === 'Q10'
        ? new Promise((_resolve, fail) => {
            reject = fail;
          })
        : Promise.resolve({ id, start: { year: 2 } }),
    );
    const previous = navigator.open('Q10');
    navigator.cancel();
    reject(new Error('Old request failed'));
    expect(await previous).toBe(false);
    expect(await navigator.open('Q20')).toBe(true);
    expect(useAtlasStore.getState().selectedEvent).toBe('Q20');
  });
});
