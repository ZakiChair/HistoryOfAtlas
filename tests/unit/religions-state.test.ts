import { beforeEach, describe, expect, it } from 'vitest';
import {
  createInitialAtlasState,
  parseAtlasUrl,
  serializeAtlasUrl,
  useAtlasStore,
} from '../../lib/store';

const defaults = {
  religionsVisible: false,
  religionFilter: null,
  religionRoutesVisible: true,
  religionAreasVisible: true,
};

describe('shareable religion layer preferences', () => {
  beforeEach(() => useAtlasStore.getState().reset());

  it('keeps legacy links unchanged and omits default religion parameters', () => {
    const state = parseAtlasUrl('?y=-500&resources=1&battles=0&play=1');
    expect(state).toMatchObject({ ...defaults, year: -500, playing: true });
    const query = new URLSearchParams(serializeAtlasUrl(state));
    for (const key of ['religions', 'religion', 'rpaths', 'rareas'])
      expect(query.has(key)).toBe(false);
    expect(query.get('resources')).toBe('1');
    expect(query.get('battles')).toBe('0');
  });

  it('uses exact URL flags and falls back safely for malformed values', () => {
    expect(parseAtlasUrl('?religions=1&rpaths=0&rareas=0')).toMatchObject({
      ...defaults,
      religionsVisible: true,
      religionRoutesVisible: false,
      religionAreasVisible: false,
    });
    for (const value of ['', 'invalid', 'true', 'false', '2'])
      expect(parseAtlasUrl(`?religions=${value}&rpaths=${value}&rareas=${value}`)).toMatchObject(
        defaults,
      );
  });

  it('accepts syntactically valid tradition IDs without loading a dataset', () => {
    for (const id of ['a', 'future-tradition-2', `a${'b'.repeat(63)}`]) {
      useAtlasStore.getState().setReligionFilter(id);
      const query = serializeAtlasUrl(useAtlasStore.getState());
      expect(new URLSearchParams(query).get('religion')).toBe(id);
      expect(parseAtlasUrl(query).religionFilter).toBe(id);
      expect(parseAtlasUrl(query).religionsVisible).toBe(false);
    }
  });

  it('rejects invalid IDs through URLs, actions, patches and serialization', () => {
    for (const id of [
      '',
      'Buddhism',
      '1-faith',
      '-faith',
      'two words',
      'a/b',
      'a_b',
      'é',
      'a'.repeat(65),
    ]) {
      expect(parseAtlasUrl(`?religion=${encodeURIComponent(id)}`).religionFilter).toBeNull();
      useAtlasStore.getState().setReligionFilter(id);
      expect(useAtlasStore.getState().religionFilter).toBeNull();
      useAtlasStore.getState().patchState({ religionFilter: id });
      expect(useAtlasStore.getState().religionFilter).toBeNull();
      expect(
        new URLSearchParams(
          serializeAtlasUrl({ ...createInitialAtlasState(), religionFilter: id }),
        ).has('religion'),
      ).toBe(false);
    }
  });

  it.each([true, false])('restores all preferences when layer visibility is %s', (visible) => {
    const actions = useAtlasStore.getState();
    actions.setReligionsVisible(visible);
    actions.setReligionFilter('early-buddhism');
    actions.setReligionRoutesVisible(false);
    actions.setReligionAreasVisible(false);
    const query = serializeAtlasUrl(useAtlasStore.getState());
    const params = new URLSearchParams(query);
    expect(params.get('religions')).toBe(visible ? '1' : null);
    expect(params.get('religion')).toBe('early-buddhism');
    expect(params.get('rpaths')).toBe('0');
    expect(params.get('rareas')).toBe('0');
    actions.reset();
    actions.hydrateFromUrl(query);
    expect(useAtlasStore.getState()).toMatchObject({
      religionsVisible: visible,
      religionFilter: 'early-buddhism',
      religionRoutesVisible: false,
      religionAreasVisible: false,
    });
  });

  it('keeps preferences when toggled off, across years, and when toggled on again', () => {
    const actions = useAtlasStore.getState();
    actions.patchState({
      religionsVisible: true,
      religionFilter: 'early-buddhism',
      religionRoutesVisible: false,
      religionAreasVisible: false,
    });
    actions.setReligionsVisible(false);
    actions.setYear(-300);
    actions.setRange([-600, -200]);
    actions.setReligionsVisible(true);
    expect(useAtlasStore.getState()).toMatchObject({
      religionsVisible: true,
      religionFilter: 'early-buddhism',
      religionRoutesVisible: false,
      religionAreasVisible: false,
      year: -300,
      range: [-600, -200],
    });
    actions.setReligionFilter(null);
    actions.setReligionRoutesVisible(true);
    actions.setReligionAreasVisible(true);
    expect(useAtlasStore.getState()).toMatchObject({ ...defaults, religionsVisible: true });
  });

  it.each(['timeline', 'battle', 'campaign', 'entity'] as const)(
    'does not disturb %s playback or the other map layers',
    (clock) => {
      const actions = useAtlasStore.getState();
      actions.setResourcesVisible(true);
      actions.setFilters({ types: ['treaty'], regions: ['asia'] });
      if (clock === 'timeline') actions.setPlaying(true);
      if (clock === 'battle') {
        actions.setBattleMode(true);
        actions.selectEvent('Q48314');
        actions.setBattlePlaying(true);
      }
      if (clock === 'campaign') {
        actions.setCampaign('Q123');
        actions.setCampaignPlaying(true);
      }
      if (clock === 'entity') {
        actions.selectEntity('test-empire');
        actions.setEntityFollowing(true);
      }
      const before = useAtlasStore.getState();
      actions.setReligionsVisible(true);
      actions.setReligionFilter('early-buddhism');
      actions.setReligionRoutesVisible(false);
      actions.setReligionAreasVisible(false);
      actions.setReligionsVisible(false);
      const after = useAtlasStore.getState();
      for (const key of Object.keys(before) as (keyof typeof before)[])
        if (!Object.hasOwn(defaults, key)) expect(after[key], key).toEqual(before[key]);
    },
  );

  it('reset and URL restoration both clear previously customized preferences', () => {
    const actions = useAtlasStore.getState();
    const customize = () =>
      actions.patchState({
        religionsVisible: true,
        religionFilter: 'early-buddhism',
        religionRoutesVisible: false,
        religionAreasVisible: false,
      });
    customize();
    actions.reset();
    expect(useAtlasStore.getState()).toMatchObject(defaults);
    customize();
    actions.hydrateFromUrl('?y=700');
    expect(useAtlasStore.getState()).toMatchObject({ ...defaults, year: 700 });
  });
});
