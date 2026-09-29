import { beforeEach, describe, expect, it } from 'vitest';
import {
  createInitialAtlasState,
  parseAtlasUrl,
  serializeAtlasUrl,
  useAtlasStore,
} from '../../lib/store';

const defaults = { epidemicsVisible: false, epidemicFilter: null };

describe('shareable epidemic layer preferences', () => {
  beforeEach(() => useAtlasStore.getState().reset());

  it('keeps legacy links unchanged and omits default epidemic parameters', () => {
    const state = parseAtlasUrl('?y=-500&resources=1&battles=0&play=1');
    expect(state).toMatchObject({ ...defaults, year: -500, playing: true });
    const query = new URLSearchParams(serializeAtlasUrl(state));
    for (const key of ['epidemics', 'epidemic']) expect(query.has(key)).toBe(false);
    expect(query.get('resources')).toBe('1');
    expect(query.get('battles')).toBe('0');
  });

  it('uses exact URL flags and falls back safely for malformed values', () => {
    expect(parseAtlasUrl('?epidemics=1')).toMatchObject({ epidemicsVisible: true });
    for (const value of ['', 'invalid', 'true', 'false', '2'])
      expect(parseAtlasUrl(`?epidemics=${value}`)).toMatchObject(defaults);
  });

  it('accepts syntactically valid disease IDs without loading a dataset', () => {
    for (const id of ['a', 'future-disease-2', `a${'b'.repeat(63)}`]) {
      useAtlasStore.getState().setEpidemicFilter(id);
      const query = serializeAtlasUrl(useAtlasStore.getState());
      expect(new URLSearchParams(query).get('epidemic')).toBe(id);
      expect(parseAtlasUrl(query).epidemicFilter).toBe(id);
      expect(parseAtlasUrl(query).epidemicsVisible).toBe(false);
    }
  });

  it('rejects invalid IDs through URLs, actions, patches and serialization', () => {
    for (const id of [
      '',
      'Plague',
      '1-disease',
      '-disease',
      'two words',
      'a/b',
      'a_b',
      'é',
      'a'.repeat(65),
    ]) {
      expect(parseAtlasUrl(`?epidemic=${encodeURIComponent(id)}`).epidemicFilter).toBeNull();
      useAtlasStore.getState().setEpidemicFilter(id);
      expect(useAtlasStore.getState().epidemicFilter).toBeNull();
      useAtlasStore.getState().patchState({ epidemicFilter: id });
      expect(useAtlasStore.getState().epidemicFilter).toBeNull();
      expect(
        new URLSearchParams(
          serializeAtlasUrl({ ...createInitialAtlasState(), epidemicFilter: id }),
        ).has('epidemic'),
      ).toBe(false);
    }
  });

  it.each([true, false])('restores all preferences when layer visibility is %s', (visible) => {
    const actions = useAtlasStore.getState();
    actions.setEpidemicsVisible(visible);
    actions.setEpidemicFilter('plague');
    const query = serializeAtlasUrl(useAtlasStore.getState());
    const params = new URLSearchParams(query);
    expect(params.get('epidemics')).toBe(visible ? '1' : null);
    expect(params.get('epidemic')).toBe('plague');
    actions.reset();
    actions.hydrateFromUrl(query);
    expect(useAtlasStore.getState()).toMatchObject({
      epidemicsVisible: visible,
      epidemicFilter: 'plague',
    });
  });

  it('keeps preferences when toggled off, across years, and when toggled on again', () => {
    const actions = useAtlasStore.getState();
    actions.patchState({ epidemicsVisible: true, epidemicFilter: 'plague' });
    actions.setEpidemicsVisible(false);
    actions.setYear(1400);
    actions.setRange([1300, 1500]);
    actions.setEpidemicsVisible(true);
    expect(useAtlasStore.getState()).toMatchObject({
      epidemicsVisible: true,
      epidemicFilter: 'plague',
      year: 1400,
      range: [1300, 1500],
    });
    actions.setEpidemicFilter(null);
    expect(useAtlasStore.getState()).toMatchObject({
      ...defaults,
      epidemicsVisible: true,
    });
  });

  it('reset and URL restoration both clear previously customized preferences', () => {
    const actions = useAtlasStore.getState();
    const customize = () =>
      actions.patchState({ epidemicsVisible: true, epidemicFilter: 'plague' });
    customize();
    actions.reset();
    expect(useAtlasStore.getState()).toMatchObject(defaults);
    customize();
    actions.hydrateFromUrl('?y=700');
    expect(useAtlasStore.getState()).toMatchObject({ ...defaults, year: 700 });
  });
});
