import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import curatedBattles from '../../data/curated/battle-profiles.json';
import { AnimationMixer, Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  getUnitProfile,
  resolveUnitProfile,
  UNIT_PROFILES,
  UNIT_ANALOGIES,
} from '../../lib/battles/units';
import { applyBattleEquipment, BattleEquipmentFileSchema } from '../../pipeline/battles/equipment';
import { BattleParticipantSchema, BattleRecordSchema } from '../../lib/battles/schema';
import { buildBattleSimulation } from '../../lib/battles/simulation';

const land = { medium: 'land' as const };

describe('historical unit eligibility', () => {
  it('requires explicit Prussian component evidence in 1870, excluding allied Bavarians', () => {
    const profileId = 'prussian-line-infantry-1870';
    expect(getUnitProfile(profileId)).toMatchObject({
      explicitOnly: true,
      dateRange: [1870, 1870],
      polityIds: ['Q27306'],
      medium: 'land',
    });
    const force = { ...land, participantId: 'Q27306', year: 1870 };
    expect(resolveUnitProfile({ ...force, profileId }).id).toBe(profileId);
    expect(resolveUnitProfile(force).id).not.toBe(profileId);
    const local = {
      ...force,
      participantId: 'local:mixed-german-army',
      equipmentPolityId: 'Q27306',
    };
    expect(resolveUnitProfile({ ...local, profileId }).id).toBe(profileId);
    expect(resolveUnitProfile({ ...local, equipmentPolityId: undefined, profileId }).id).not.toBe(
      profileId,
    );
    for (const year of [1866, 1869, 1871, 1914]) {
      expect(resolveUnitProfile({ ...force, year, profileId }).id).not.toBe(profileId);
    }
    for (const participantId of [
      undefined,
      'Q183',
      'Q43287',
      'Q980',
      'Q150981',
      'local:unreviewed',
    ]) {
      expect(resolveUnitProfile({ ...force, participantId, profileId }).id).not.toBe(profileId);
    }
    for (const medium of ['naval', 'air'] as const) {
      expect(resolveUnitProfile({ ...force, medium, profileId }).id).not.toBe(profileId);
    }
    const rules = UNIT_ANALOGIES as Array<(typeof UNIT_ANALOGIES)[number]>;
    rules.push({
      profileId,
      participantIds: ['Q27306'],
      dateRange: [1870, 1870],
      sources: getUnitProfile(profileId)!.sources,
    });
    try {
      expect(resolveUnitProfile(force).id).not.toBe(profileId);
    } finally {
      rules.pop();
    }
  });

  it('requires a reviewed French line infantry component and 1870 historical regime', () => {
    const profileId = 'french-line-infantry-1870';
    expect(getUnitProfile(profileId)).toMatchObject({
      explicitOnly: true,
      dateRange: [1870, 1870],
      polityIds: ['Q71092', 'Q70802'],
    });
    for (const participantId of ['Q71092', 'Q70802']) {
      const force = { ...land, participantId, year: 1870 };
      expect(resolveUnitProfile(force).id).not.toBe(profileId);
      expect(resolveUnitProfile({ ...force, profileId }).id).toBe(profileId);
      const local = {
        ...force,
        participantId: 'local:reviewed-line-component',
        equipmentPolityId: participantId,
      };
      expect(resolveUnitProfile({ ...local, profileId }).id).toBe(profileId);
      expect(resolveUnitProfile({ ...local, equipmentPolityId: undefined, profileId }).id).not.toBe(
        profileId,
      );
      for (const year of [1866, 1869, 1871, 1914]) {
        expect(resolveUnitProfile({ ...force, year, profileId }).id).not.toBe(profileId);
      }
      for (const medium of ['naval', 'air'] as const) {
        expect(resolveUnitProfile({ ...force, medium, profileId }).id).not.toBe(profileId);
      }
      const rules = UNIT_ANALOGIES as Array<(typeof UNIT_ANALOGIES)[number]>;
      rules.push({
        profileId,
        participantIds: [participantId],
        dateRange: [1870, 1870],
        sources: getUnitProfile(profileId)!.sources,
      });
      try {
        expect(resolveUnitProfile(force).id).not.toBe(profileId);
      } finally {
        rules.pop();
      }
    }
    for (const participantId of [
      undefined,
      'Q142',
      'Q71084',
      'Q58296',
      'Q183',
      'local:unreviewed',
    ]) {
      expect(resolveUnitProfile({ ...land, participantId, year: 1870, profileId }).id).not.toBe(
        profileId,
      );
    }
  });

  it('requires a reviewed Mexican infantry component within 1846–1847', () => {
    const profileId = 'mexican-war-infantry';
    expect(getUnitProfile(profileId)).toMatchObject({
      explicitOnly: true,
      dateRange: [1846, 1847],
      polityIds: ['Q96'],
    });
    for (const year of [1846, 1847]) {
      const force = { ...land, participantId: 'Q96', year };
      expect(resolveUnitProfile(force).id).not.toBe(profileId);
      expect(resolveUnitProfile({ ...force, profileId })).toMatchObject({
        id: profileId,
        dateCompatible: true,
      });
      const local = { ...force, participantId: 'local:mexican-army', equipmentPolityId: 'Q96' };
      expect(resolveUnitProfile({ ...local, profileId }).id).toBe(profileId);
      expect(resolveUnitProfile({ ...local, profileId, equipmentPolityId: undefined }).id).not.toBe(
        profileId,
      );
    }
    for (const year of [1810, 1836, 1845, 1848, 1862]) {
      expect(resolveUnitProfile({ ...land, participantId: 'Q96', year, profileId }).id).not.toBe(
        profileId,
      );
    }
    for (const participantId of [undefined, 'Q30', 'Q142', 'coalition']) {
      expect(resolveUnitProfile({ ...land, participantId, year: 1847, profileId }).id).not.toBe(
        profileId,
      );
    }
    for (const medium of ['naval', 'air'] as const) {
      expect(
        resolveUnitProfile({ medium, participantId: 'Q96', year: 1847, profileId }).id,
      ).not.toBe(profileId);
    }
  });

  it.each([
    ['county-kent-heavy-cruiser', 1941, ['Q145']],
    ['ww2-straight-deck-carrier', 1942, ['Q30', 'Q188712']],
  ] as const)('requires an explicit, dated naval identity for %s', (profileId, year, polities) => {
    expect(getUnitProfile(profileId)).toBeDefined();
    for (const participantId of polities) {
      const force = { medium: 'naval' as const, participantId, year };
      expect(resolveUnitProfile(force).id).not.toBe(profileId);
      expect(resolveUnitProfile({ ...force, profileId })).toMatchObject({
        id: profileId,
        evidence: 'documented-profile',
        dateCompatible: true,
      });
      for (const wrongYear of [year - 1, year + 1]) {
        expect(resolveUnitProfile({ ...force, year: wrongYear, profileId }).id).not.toBe(profileId);
      }
      for (const medium of ['land', 'air'] as const) {
        expect(resolveUnitProfile({ ...force, medium, profileId }).id).not.toBe(profileId);
      }
      const local = {
        ...force,
        participantId: 'local:reviewed-ship',
        equipmentPolityId: participantId,
      };
      expect(resolveUnitProfile(local).id).not.toBe(profileId);
      expect(resolveUnitProfile({ ...local, profileId }).id).toBe(profileId);
      expect(resolveUnitProfile({ ...local, profileId, equipmentPolityId: 'Q183' }).id).not.toBe(
        profileId,
      );
      const rules = UNIT_ANALOGIES as Array<(typeof UNIT_ANALOGIES)[number]>;
      rules.push({
        profileId,
        participantIds: [participantId],
        dateRange: [year, year],
        sources: getUnitProfile(profileId)!.sources,
      });
      try {
        expect(resolveUnitProfile(force).id).not.toBe(profileId);
      } finally {
        rules.pop();
      }
    }
    for (const participantId of [undefined, 'Q183', 'local:unreviewed-ship']) {
      expect(resolveUnitProfile({ medium: 'naval', participantId, year, profileId }).id).not.toBe(
        profileId,
      );
    }
  });

  it('requires a reviewed winter assignment for Russian Mosin 1891 infantry in 1904–1905', () => {
    const profileId = 'russian-russo-war-winter-infantry';
    for (const year of [1904, 1905]) {
      const empire = { ...land, participantId: 'Q34266', year };
      expect(resolveUnitProfile(empire).id).toBe('unclassified-unit');
      expect(resolveUnitProfile({ ...empire, profileId })).toMatchObject({
        id: profileId,
        dateCompatible: true,
        evidence: 'documented-profile',
      });
    }
    for (const year of [1891, 1903, 1906, 1914, 1945]) {
      expect(resolveUnitProfile({ ...land, participantId: 'Q34266', profileId, year }).id).toBe(
        'unclassified-unit',
      );
    }
    for (const participantId of [undefined, 'Q159', 'Q15180', 'Q188712', 'local-russian-army']) {
      expect(resolveUnitProfile({ ...land, participantId, profileId, year: 1905 }).id).toBe(
        'unclassified-unit',
      );
    }
    const local = {
      ...land,
      participantId: 'Q384091:russian-manchurian-armies',
      equipmentPolityId: 'Q34266',
      year: 1905,
    };
    expect(resolveUnitProfile(local).id).toBe('unclassified-unit');
    expect(resolveUnitProfile({ ...local, profileId }).id).toBe(profileId);
    expect(resolveUnitProfile({ ...local, profileId, equipmentPolityId: 'Q159' }).id).toBe(
      'unclassified-unit',
    );
    for (const medium of ['naval', 'air'] as const) {
      expect(resolveUnitProfile({ ...local, medium, profileId }).id).not.toBe(profileId);
    }
  });

  it('requires a reviewed winter assignment for Japanese Type 30 infantry in 1904–1905', () => {
    const profileId = 'japanese-russo-war-winter-infantry';
    for (const year of [1904, 1905]) {
      const empire = { ...land, participantId: 'Q188712', year };
      expect(resolveUnitProfile(empire).id).toBe('unclassified-unit');
      expect(resolveUnitProfile({ ...empire, profileId })).toMatchObject({
        id: profileId,
        dateCompatible: true,
        evidence: 'documented-profile',
      });
    }
    for (const year of [1897, 1903, 1906, 1914, 1945]) {
      expect(resolveUnitProfile({ ...land, participantId: 'Q188712', profileId, year }).id).toBe(
        'unclassified-unit',
      );
    }
    for (const participantId of [undefined, 'Q17', 'Q205662', 'Q159', 'local-japanese-army']) {
      expect(resolveUnitProfile({ ...land, participantId, profileId, year: 1905 }).id).toBe(
        'unclassified-unit',
      );
    }
    const local = {
      ...land,
      participantId: 'Q384091:japanese-manchurian-army',
      equipmentPolityId: 'Q188712',
      year: 1905,
    };
    expect(resolveUnitProfile(local).id).toBe('unclassified-unit');
    expect(resolveUnitProfile({ ...local, profileId }).id).toBe(profileId);
    expect(resolveUnitProfile({ ...local, profileId, equipmentPolityId: 'Q17' }).id).toBe(
      'unclassified-unit',
    );
    for (const medium of ['naval', 'air'] as const) {
      expect(resolveUnitProfile({ ...local, medium, profileId }).id).not.toBe(profileId);
    }
  });

  it.each([
    ['japanese-russo-war-winter-infantry', 'Q188712'],
    ['russian-russo-war-winter-infantry', 'Q34266'],
  ] as const)(
    'does not let a later analogy auto-select seasonal variant %s',
    (profileId, participantId) => {
      const rules = UNIT_ANALOGIES as Array<(typeof UNIT_ANALOGIES)[number]>;
      rules.push({
        profileId,
        participantIds: [participantId],
        dateRange: [1904, 1905],
        sources: getUnitProfile(profileId)!.sources,
      });
      try {
        expect(resolveUnitProfile({ ...land, participantId, year: 1905 }).id).toBe(
          'unclassified-unit',
        );
      } finally {
        rules.pop();
      }
    },
  );

  it('limits Austrian white-coat fusiliers to the Habsburg Seven Years War window', () => {
    const profileId = 'austrian-seven-years-infantry';
    for (const year of [1756, 1757, 1762, 1763]) {
      expect(resolveUnitProfile({ ...land, participantId: 'Q153136', year })).toMatchObject({
        id: profileId,
        evidence: 'representative',
        dateCompatible: true,
      });
    }
    for (const year of [1741, 1755, 1764, 1767, 1796]) {
      expect(
        resolveUnitProfile({ ...land, participantId: 'Q153136', profileId, year }).id,
      ).not.toBe(profileId);
    }
    for (const participantId of [undefined, 'Q40', 'Q131964', 'Q12548', 'Q699964', 'coalition']) {
      expect(resolveUnitProfile({ ...land, participantId, profileId, year: 1757 }).id).not.toBe(
        profileId,
      );
    }
    const local = {
      ...land,
      participantId: 'local-austrian-army',
      equipmentPolityId: 'Q153136',
      year: 1757,
    };
    expect(resolveUnitProfile(local).id).toBe('unclassified-unit');
    expect(resolveUnitProfile({ ...local, profileId }).id).toBe(profileId);
    for (const medium of ['naval', 'air'] as const) {
      expect(
        resolveUnitProfile({ medium, participantId: 'Q153136', profileId, year: 1757 }).id,
      ).not.toBe(profileId);
    }
  });

  it('separates Republican and Imperial cocked-hat identities for automatic and explicit assignments', () => {
    const profileId = 'french-revolution-infantry';
    for (const [participantId, expectedId, years] of [
      ['Q58296', profileId, [1792, 1796, 1803]],
      ['Q71084', 'french-imperial-cocked-hat', [1804, 1805]],
    ] as const) {
      for (const year of years) {
        expect(resolveUnitProfile({ ...land, participantId, year })).toMatchObject({
          id: expectedId,
          evidence: 'representative',
          dateCompatible: true,
        });
      }
    }
    for (const [participantId, year] of [
      ['Q58296', 1791],
      ['Q58296', 1804],
      ['Q58296', 1805],
      ['Q71084', 1796],
      ['Q71084', 1803],
      ['Q71084', 1806],
      ['Q70972', 1792],
      ['Q142', 1800],
    ] as const) {
      expect(resolveUnitProfile({ ...land, participantId, year }).id).not.toBe(profileId);
    }
    for (const [participantId, selectedId, year] of [
      ['Q71084', 'french-imperial-cocked-hat', 1796],
      ['Q58296', profileId, 1805],
      ['Q71084', profileId, 1796],
      ['Q58296', 'french-imperial-cocked-hat', 1805],
    ] as const) {
      expect(resolveUnitProfile({ ...land, participantId, profileId: selectedId, year }).id).toBe(
        'unclassified-unit',
      );
    }
    expect(getUnitProfile('french-imperial-cocked-hat')?.modelUrl).toBe(
      getUnitProfile(profileId)?.modelUrl,
    );
    for (const year of [1791, 1806]) {
      expect(resolveUnitProfile({ ...land, profileId, participantId: 'Q58296', year }).id).not.toBe(
        profileId,
      );
    }
    for (const participantId of [undefined, 'Q142', 'Q70972', 'local-army']) {
      expect(resolveUnitProfile({ ...land, participantId, profileId, year: 1800 }).id).not.toBe(
        profileId,
      );
    }
    const local = { ...land, participantId: 'local-army', equipmentPolityId: 'Q58296', year: 1800 };
    expect(resolveUnitProfile(local).id).toBe('unclassified-unit');
    expect(resolveUnitProfile({ ...local, profileId }).id).toBe(profileId);
    for (const medium of ['naval', 'air'] as const) {
      expect(
        resolveUnitProfile({ medium, participantId: 'Q58296', profileId, year: 1800 }).id,
      ).not.toBe(profileId);
    }
  });

  it('limits the Ottoman cloth-cap and Mauser analogy to the identified empire in 1915–1918', () => {
    const profileId = 'ottoman-ww1-infantry';
    for (const year of [1915, 1917, 1918]) {
      expect(resolveUnitProfile({ ...land, participantId: 'Q12560', year })).toMatchObject({
        id: profileId,
        evidence: 'representative',
        dateCompatible: true,
      });
    }
    for (const year of [1912, 1914, 1919, 2018]) {
      expect(resolveUnitProfile({ ...land, participantId: 'Q12560', profileId, year }).id).toBe(
        'unclassified-unit',
      );
    }
    for (const participantId of [undefined, 'Q43', 'Q19247539', 'unknown-ottoman-unit']) {
      expect(resolveUnitProfile({ ...land, participantId, profileId, year: 1917 }).id).toBe(
        'unclassified-unit',
      );
    }
    for (const medium of ['naval', 'air'] as const) {
      expect(resolveUnitProfile({ medium, participantId: 'Q12560', year: 1917 }).id).not.toBe(
        profileId,
      );
    }
    const scoped = {
      ...land,
      participantId: 'reviewed-local-unit',
      equipmentPolityId: 'Q12560',
      year: 1917,
    };
    expect(resolveUnitProfile(scoped).id).toBe('unclassified-unit');
    expect(resolveUnitProfile({ ...scoped, profileId }).id).toBe(profileId);
  });

  it('keeps the French shako family out of the Revolutionary and Consular period', () => {
    for (const year of [1792, 1800, 1805]) {
      expect(resolveUnitProfile({ ...land, profileId: 'napoleonic-infantry', year }).id).toBe(
        'unclassified-unit',
      );
    }
    expect(
      resolveUnitProfile({ ...land, profileId: 'napoleonic-infantry', year: 1806 }),
    ).toMatchObject({ id: 'napoleonic-infantry', dateCompatible: true });
  });

  it('requires an explicit 1879 assignment for the British Martini-Henry family', () => {
    const profileId = 'british-martini-infantry';
    expect(resolveUnitProfile({ ...land, profileId, year: 1879 })).toMatchObject({
      id: profileId,
      dateCompatible: true,
      evidence: 'documented-profile',
    });
    for (const year of [1878, 1880]) {
      expect(resolveUnitProfile({ ...land, profileId, year }).id).toBe('unclassified-unit');
    }
    expect(resolveUnitProfile({ ...land, year: 1879 }).id).toBe('unclassified-unit');
    expect(resolveUnitProfile({ ...land, participantId: 'Q174193', year: 1879 }).id).toBe(
      'unclassified-unit',
    );
    expect(resolveUnitProfile({ medium: 'naval', profileId, year: 1879 }).id).not.toBe(profileId);
  });

  it('limits Byzantine and pike analogies to independently evidenced armies and periods', () => {
    const cases = [
      ['Q12544', 'byzantine-spearman', 530, 650],
      ['Q766543', 'tercio-pikeman', 1567, 1643],
      ['Q2284765', 'civil-war-pikeman', 1642, 1651],
      ['Q1130553', 'civil-war-pikeman', 1642, 1651],
    ] as const;
    for (const [participantId, id, first, last] of cases) {
      for (const year of [first, Math.floor((first + last) / 2), last]) {
        expect(resolveUnitProfile({ ...land, participantId, year })).toMatchObject({
          id,
          evidence: 'representative',
          dateCompatible: true,
        });
        expect(resolveUnitProfile({ ...land, year }).id).toBe('unclassified-unit');
        expect(resolveUnitProfile({ medium: 'naval', participantId, year }).id).not.toBe(id);
      }
      for (const year of [first - 1, last + 1]) {
        expect(resolveUnitProfile({ ...land, participantId, year }).id).not.toBe(id);
      }
    }
    expect(resolveUnitProfile({ ...land, participantId: 'Q12490507', year: 636 }).id).toBe(
      'unclassified-unit',
    );
    expect(resolveUnitProfile({ ...land, participantId: 'Q142', year: 636 }).id).toBe(
      'unclassified-unit',
    );
    expect(getUnitProfile('tercio-pikeman')?.modelUrl).not.toBe(
      getUnitProfile('civil-war-pikeman')?.modelUrl,
    );
  });

  it('requires dated naval assignments for transport, mines, torpedoes and boarding canoes', () => {
    for (const [id, year] of [
      ['torpedo-boat', 1898],
      ['spar-torpedo-launch', 1877],
      ['auxiliary-cruiser', 1898],
      ['steam-transport', 1904],
      ['steam-minelayer', 1904],
      ['river-boarding-canoe', 1868],
      ['paddle-corvette', 1869],
      ['armoured-cruiser', 1904],
      ['small-steam-gunboat', 1866],
      ['small-steam-gunboat', 1898],
    ] as const) {
      const profile = getUnitProfile(id);
      expect(profile, id).toBeDefined();
      expect(resolveUnitProfile({ medium: 'naval', profileId: id, year })).toMatchObject({
        id,
        dateCompatible: true,
        evidence: 'documented-profile',
      });
      expect(resolveUnitProfile({ medium: 'land', profileId: id, year }).id).not.toBe(id);
      for (const outside of [profile!.dateRange[0] - 1, profile!.dateRange[1] + 1]) {
        expect(resolveUnitProfile({ medium: 'naval', profileId: id, year: outside }).id).not.toBe(
          id,
        );
      }
      expect(resolveUnitProfile({ medium: 'naval', year }).dateCompatible).toBe(false);
    }
    expect(getUnitProfile('steam-transport')?.modelUrl).not.toBe(
      getUnitProfile('auxiliary-cruiser')?.modelUrl,
    );
    expect(getUnitProfile('torpedo-boat')?.modelUrl).not.toBe(
      getUnitProfile('spar-torpedo-launch')?.modelUrl,
    );
    expect(getUnitProfile('river-boarding-canoe')?.modelUrl).toBe(
      getUnitProfile('lake-war-canoe')?.modelUrl,
    );
  });

  it('distinguishes seagoing paddle gunboats and armoured cruisers from riverboats and protected cruisers', () => {
    for (const [id, year] of [
      ['coastal-paddle-gunboat', 1863],
      ['armoured-cruiser', 1898],
    ] as const) {
      const profile = getUnitProfile(id);
      expect(profile, id).toBeDefined();
      expect(resolveUnitProfile({ medium: 'naval', profileId: id, year })).toMatchObject({
        id,
        evidence: 'documented-profile',
        dateCompatible: true,
      });
      for (const outside of [profile!.dateRange[0] - 1, profile!.dateRange[1] + 1]) {
        expect(resolveUnitProfile({ medium: 'naval', profileId: id, year: outside }).id).not.toBe(
          id,
        );
      }
    }
    expect(resolveUnitProfile({ medium: 'naval', year: 1863 }).dateCompatible).toBe(false);
    expect(resolveUnitProfile({ medium: 'naval', year: 1898 }).dateCompatible).toBe(false);
  });

  it('keeps sourced event equipment separate from numerical evidence and respects ship/shore assignments', async () => {
    const file = BattleEquipmentFileSchema.parse(
      JSON.parse(
        await readFile(
          new URL('../../data/curated/battle-equipment.json', import.meta.url),
          'utf8',
        ),
      ),
    );
    expect(file.records.Q2087443.participants).toContainEqual({
      id: 'Q81931',
      kind: 'polity',
      medium: 'land',
    });
    expect(file.records.Q2890974.participants?.map((item) => item.profileId)).toEqual([
      'lake-war-canoe',
      'lake-war-canoe',
    ]);
    for (const [id, patch] of Object.entries(file.records)) {
      const record = BattleRecordSchema.parse(
        JSON.parse(
          await readFile(
            new URL(`../../public/data/battles/events/${id}.json`, import.meta.url),
            'utf8',
          ),
        ),
      );
      const evidence = record.participants.map(({ id, strength, deaths, casualties }) => ({
        id,
        strength,
        deaths,
        casualties,
      }));
      applyBattleEquipment(record, patch);
      if (id === 'Q3514809') {
        const simulation = buildBattleSimulation(record);
        expect(simulation.armies.map((army) => army.profileId).sort()).toEqual([
          'coastal-paddle-gunboat',
          'steam-corvette',
        ]);
      }
      if (id === 'Q2087443') {
        expect(
          buildBattleSimulation(record)
            .armies.map((army) => army.medium)
            .sort(),
        ).toEqual(['land', 'naval']);
      }
      expect(
        record.participants.map(({ id, strength, deaths, casualties }) => ({
          id,
          strength,
          deaths,
          casualties,
        })),
        id,
      ).toEqual(evidence);
      for (const participant of patch.participants ?? []) {
        if (!participant.profileId) continue;
        const profile = resolveUnitProfile({
          participantId: participant.id,
          profileId: participant.profileId,
          equipmentPolityId: participant.equipmentIdentity?.polityId,
          year: record.start!.year,
          medium: participant.medium ?? record.medium,
        });
        expect(profile.id, `${id} / ${participant.id}`).toBe(participant.profileId);
        expect(profile.dateCompatible, `${id} / ${participant.id}`).toBe(true);
      }
      if (patch.profileId) {
        expect(
          resolveUnitProfile({
            profileId: patch.profileId,
            year: record.start!.year,
            medium: record.medium,
          }).id,
          id,
        ).toBe(patch.profileId);
      }
    }
  });
  it('changes equipment with the documented army and period without guessing an unknown identity', () => {
    for (const [participantId, year, id] of [
      ['Q71084', 1812, 'napoleonic-infantry'],
      ['Q174193', 1812, 'napoleonic-infantry'],
      ['Q45670', 1810, 'napoleonic-infantry'],
      ['Q3399982', 1810, 'napoleonic-infantry'],
      ['Q27306', 1815, 'napoleonic-infantry'],
      ['Q161885', 1757, 'flintlock-infantry'],
      ['Q30', 1781, 'flintlock-infantry'],
      ['Q30', 1863, 'musket-infantry'],
      ['Q81931', 1863, 'musket-infantry'],
      ['Q174193', 1917, 'british-rifle'],
      ['Q43287', 1917, 'german-rifle'],
      ['Q70802', 1917, 'french-rifle'],
      ['Q179876', 1415, 'longbow-archer'],
      ['Q70972', 1415, 'medieval-man-at-arms'],
      ['Q389688', -490, 'persian-spearman'],
      ['Q17167', -216, 'republican-infantry'],
    ] as const) {
      const profile = resolveUnitProfile({ ...land, participantId, year });
      expect(profile, `${participantId} / ${year}`).toMatchObject({
        id,
        dateCompatible: true,
        evidence: 'representative',
      });
      expect(profile.sources.length).toBeGreaterThan(0);
    }
    expect(resolveUnitProfile({ ...land, participantId: 'Q30', year: 1600 }).id).toBe(
      'unclassified-unit',
    );
    expect(resolveUnitProfile({ ...land, participantId: 'Q43287', year: 1914 }).id).toBe(
      'unclassified-unit',
    );
    expect(resolveUnitProfile({ ...land, participantId: 'Q70972', year: 1066 }).id).toBe(
      'unclassified-unit',
    );
    expect(resolveUnitProfile({ ...land, year: 1812 }).id).toBe('unclassified-unit');
    expect(
      resolveUnitProfile({
        ...land,
        profileId: 'japanese-matchlock',
        participantId: 'Q234188:east',
        year: 1600,
      }).id,
    ).toBe('japanese-matchlock');
  });

  it('automatically selects reviewed polity equipment only within its period', () => {
    expect(resolveUnitProfile({ ...land, participantId: 'Q844930', year: -490 }).id).toBe(
      'greek-hoplite',
    );
    expect(resolveUnitProfile({ ...land, participantId: 'Q2277', year: 117 })).toMatchObject({
      id: 'roman-infantry',
      evidence: 'representative',
      dateCompatible: true,
    });
    expect(resolveUnitProfile({ ...land, participantId: 'Q2277', year: -216 }).id).toBe(
      'unclassified-unit',
    );
    expect(resolveUnitProfile({ ...land, participantId: 'Q12560', year: 1618 }).id).toBe(
      'ottoman-musketeer',
    );
    expect(resolveUnitProfile({ ...land, participantId: 'Q12560', year: 1453 }).id).toBe(
      'unclassified-unit',
    );
    expect(resolveUnitProfile({ ...land, participantId: 'Q7209', year: -100 }).id).toBe(
      'han-crossbow',
    );
    expect(resolveUnitProfile({ ...land, participantId: 'Q33296', year: 1650 }).id).toBe(
      'mughal-matchlock',
    );
    expect(resolveUnitProfile({ ...land, participantId: 'Q729768', year: 1879 }).id).toBe(
      'zulu-spearman',
    );
    expect(resolveUnitProfile({ ...land, participantId: 'Q729768', year: 1800 }).id).toBe(
      'unclassified-unit',
    );
  });

  it('keeps unknown land equipment neutral instead of imposing a regional costume', () => {
    for (const year of [-1200, 1000, 1500, 1815, 1900, 2020]) {
      expect(resolveUnitProfile({ ...land, year })).toMatchObject({
        id: 'unclassified-unit',
        sources: [],
        evidence: 'representative',
      });
    }
  });

  it('preserves curated profiles and aliases while rejecting incompatible dates and identities', () => {
    expect(resolveUnitProfile({ ...land, profileId: 'napoleonic-line', year: 1815 })).toMatchObject(
      { id: 'napoleonic-infantry', evidence: 'documented-profile' },
    );
    expect(
      resolveUnitProfile({ ...land, profileId: 'roman-infantry', participantId: 'Q30', year: 117 })
        .id,
    ).toBe('unclassified-unit');
    expect(resolveUnitProfile({ ...land, profileId: 'early-tank', year: 1915 }).id).toBe(
      'unclassified-unit',
    );
    expect(
      resolveUnitProfile({ ...land, profileId: 'unclassified-unit', year: -216 }).evidence,
    ).toBe('representative');
    expect(resolveUnitProfile({ ...land, participantId: 'Q205662', year: 1600 }).id).toBe(
      'unclassified-unit',
    );
    expect(resolveUnitProfile({ ...land, participantId: 'Q205662', year: 1615 }).id).toBe(
      'japanese-matchlock',
    );
    expect(resolveUnitProfile({ ...land, participantId: 'Q12557', year: 1500 }).id).toBe(
      'unclassified-unit',
    );
    expect(resolveUnitProfile({ ...land, participantId: 'Q12557', year: 1250 }).id).toBe(
      'steppe-archer',
    );
    expect(getUnitProfile('__proto__')).toBeUndefined();
    expect(getUnitProfile('constructor')).toBeUndefined();
  });

  it('resolves every explicit reviewed profile in its participant medium without an unnoticed fallback', async () => {
    for (const [id, curated] of Object.entries(curatedBattles.records)) {
      const record = JSON.parse(
        await readFile(
          new URL(`../../public/data/battles/events/${id}.json`, import.meta.url),
          'utf8',
        ),
      );
      for (const raw of curated.participants) {
        const participant = BattleParticipantSchema.parse(raw);
        // Reviewing a historical identity does not establish its equipment.
        if (!participant.profileId) continue;
        const result = resolveUnitProfile({
          profileId: participant.profileId,
          participantId: participant.id,
          equipmentPolityId: participant.equipmentIdentity?.polityId,
          year: record.start.year,
          medium: participant.medium ?? record.medium,
        });
        expect(result.id, `${id} / ${participant.id}`).toBe(participant.profileId);
        expect(result.dateCompatible, `${id} / ${participant.id}`).toBe(true);
      }
    }
  });

  it('never substitutes a later airplane or ship for an unsupported date', () => {
    expect(resolveUnitProfile({ medium: 'air', year: 1915 }).id).toBe('biplane-aircraft');
    expect(resolveUnitProfile({ medium: 'air', year: 1940 }).id).toBe('propeller-aircraft');
    expect(resolveUnitProfile({ medium: 'air', year: 1950 }).id).toBe('jet-aircraft');
    expect(resolveUnitProfile({ medium: 'air', year: 1800 }).dateCompatible).toBe(false);
    expect(resolveUnitProfile({ medium: 'air', year: 1935 }).dateCompatible).toBe(false);
    expect(resolveUnitProfile({ medium: 'naval', year: 1805 }).id).toBe('sailing-warship');
    expect(resolveUnitProfile({ medium: 'naval', year: 1900 }).dateCompatible).toBe(false);
    expect(resolveUnitProfile({ medium: 'land', year: Number.NaN }).dateCompatible).toBe(false);
  });

  it('uses the new naval families only for explicit, date-compatible assignments', () => {
    for (const [id, year] of [
      ['new-kingdom-oared-ship', -1177],
      ['lake-war-canoe', 1875],
      ['steam-corvette', 1864],
      ['ironclad-warship', 1866],
      ['casemate-ironclad', 1862],
      ['monitor-warship', 1868],
      ['paddle-steamer', 1864],
      ['protected-cruiser', 1898],
      ['pre-dreadnought', 1904],
    ] as const) {
      const profile = getUnitProfile(id);
      expect(profile, id).toBeDefined();
      expect(resolveUnitProfile({ medium: 'naval', profileId: id, year }), id).toMatchObject({
        id,
        dateCompatible: true,
        evidence: 'documented-profile',
      });
      expect(profile!.sources.length, id).toBeGreaterThan(0);
      expect(
        resolveUnitProfile({ medium: 'naval', profileId: id, year: profile!.dateRange[0] - 1 }).id,
        `${id} before its source window`,
      ).not.toBe(id);
      expect(
        resolveUnitProfile({ medium: 'naval', profileId: id, year: profile!.dateRange[1] + 1 }).id,
        `${id} after its source window`,
      ).not.toBe(id);
    }
    // A nineteenth-century date by itself cannot choose steam propulsion over canoes.
    expect(resolveUnitProfile({ medium: 'naval', year: 1875 }).dateCompatible).toBe(false);
    expect(resolveUnitProfile({ medium: 'naval', year: -1177 }).dateCompatible).toBe(false);
  });
});

describe('authored GLB asset contract', () => {
  it('distinguishes the County cruiser by three funnels and four superfiring twin turrets', async () => {
    const profile = getUnitProfile('county-kent-heavy-cruiser');
    expect(profile).toBeDefined();
    const bytes = await readFile(new URL(`../../public${profile!.modelUrl}`, import.meta.url));
    expect(bytes.byteLength).toBeLessThan(500_000);
    const source = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      '',
    );
    source.scene.updateMatrixWorld(true);
    for (const name of [
      'county_funnel_1',
      'county_funnel_2',
      'county_funnel_3',
      'county_hangar',
      'county_catapult',
    ]) {
      expect(source.scene.getObjectByName(name), name).toBeDefined();
    }
    const boxes = ['A', 'B', 'X', 'Y'].map((name) => {
      const turret = source.scene.getObjectByName(`county_turret_${name}`);
      expect(turret, name).toBeDefined();
      for (const side of ['port', 'starboard'])
        expect(source.scene.getObjectByName(`county_gun_${name}_${side}`)).toBeDefined();
      return new Box3().setFromObject(turret!);
    });
    expect(boxes[1].min.y).toBeGreaterThan(boxes[0].min.y + 0.1);
    expect(boxes[2].min.y).toBeGreaterThan(boxes[3].min.y + 0.1);
    const hull = new Box3()
      .setFromObject(source.scene.getObjectByName('county_hull')!)
      .getSize(new Vector3());
    expect(hull.z / hull.x).toBeGreaterThan(6);
    expect(source.scene.getObjectByName('carrier_flight_deck')).toBeUndefined();
  });

  it('gives the 1942 carrier a continuous straight flight deck above a hangar hull', async () => {
    const profile = getUnitProfile('ww2-straight-deck-carrier');
    expect(profile).toBeDefined();
    const bytes = await readFile(new URL(`../../public${profile!.modelUrl}`, import.meta.url));
    expect(bytes.byteLength).toBeLessThan(500_000);
    const source = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      '',
    );
    source.scene.updateMatrixWorld(true);
    const deckNode = source.scene.getObjectByName('carrier_flight_deck');
    expect(deckNode).toBeDefined();
    const deck = new Box3().setFromObject(deckNode!);
    const size = deck.getSize(new Vector3());
    expect(size.z / size.x).toBeGreaterThan(3.5);
    expect(size.y).toBeLessThan(0.15);
    const hangar = new Box3().setFromObject(source.scene.getObjectByName('carrier_hangar')!);
    expect(deck.min.y).toBeGreaterThan(hangar.max.y - 0.05);
    expect(
      new Box3().setFromObject(source.scene.getObjectByName('carrier_island')!).min.x,
    ).toBeGreaterThan(0.4);
    for (const name of ['carrier_elevator_forward', 'carrier_elevator_aft'])
      expect(source.scene.getObjectByName(name)).toBeDefined();
    for (const name of ['angled_deck', 'ski_jump', 'county_turret_A', 'deck_aircraft'])
      expect(source.scene.getObjectByName(name)).toBeUndefined();
  });

  it('shows a Russian papakha, long greatcoat and Mosin 1891 socket-bayonet rifle', async () => {
    const profile = getUnitProfile('russian-russo-war-winter-infantry');
    expect(profile).toBeDefined();
    const bytes = await readFile(new URL(`../../public${profile!.modelUrl}`, import.meta.url));
    expect(bytes.byteLength).toBeLessThan(500_000);
    const source = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      '',
    );
    const cap = source.scene.getObjectByName('russian_papakha');
    const rifle = source.scene.getObjectByName('mosin_1891_rifle');
    const coat = source.scene.getObjectByName('russian_winter_greatcoat');
    expect(cap).toBeDefined();
    expect(rifle).toBeDefined();
    expect(coat).toBeDefined();
    for (const name of ['mosin_straight_bolt', 'mosin_integral_magazine', 'mosin_socket_bayonet']) {
      expect(source.scene.getObjectByName(name)).toBeDefined();
    }
    for (const name of [
      'type30_hooked_cocking_piece',
      'type30_knife_bayonet',
      'steel_helmet',
      'scope',
    ]) {
      expect(source.scene.getObjectByName(name)).toBeUndefined();
    }
    source.scene.updateMatrixWorld(true);
    const capSize = new Box3().setFromObject(cap!).getSize(new Vector3());
    expect(capSize.y).toBeGreaterThan(0.18);
    expect(capSize.y).toBeLessThan(0.32);
    const coatBox = new Box3().setFromObject(coat!);
    expect(coatBox.min.y).toBeLessThan(0.45);
    expect(coatBox.min.y).toBeGreaterThan(0.3);
    const rifleSize = new Box3().setFromObject(rifle!).getSize(new Vector3());
    expect(rifleSize.z).toBeGreaterThan(1.68);
    expect(rifleSize.z).toBeLessThan(1.85);
  });

  it('shows the Japanese service cap, winter overcoat and long Type 30 knife-bayonet rifle', async () => {
    const profile = getUnitProfile('japanese-russo-war-winter-infantry');
    expect(profile).toBeDefined();
    const bytes = await readFile(new URL(`../../public${profile!.modelUrl}`, import.meta.url));
    expect(bytes.byteLength).toBeLessThan(500_000);
    const source = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      '',
    );
    const cap = source.scene.getObjectByName('japanese_service_cap');
    const rifle = source.scene.getObjectByName('type30_rifle');
    expect(cap).toBeDefined();
    expect(rifle).toBeDefined();
    expect(source.scene.getObjectByName('japanese_winter_overcoat')).toBeDefined();
    expect(source.scene.getObjectByName('type30_bolt')).toBeDefined();
    expect(source.scene.getObjectByName('type30_knife_bayonet')).toBeDefined();
    for (const excluded of [
      'mauser_bolt',
      'martini_underlever',
      'steel_helmet',
      'magazine',
      'bayonet_socket',
    ]) {
      expect(source.scene.getObjectByName(excluded)).toBeUndefined();
    }
    source.scene.updateMatrixWorld(true);
    const capSize = new Box3().setFromObject(cap!).getSize(new Vector3());
    expect(capSize.y).toBeLessThan(0.18);
    expect(capSize.z).toBeGreaterThan(0.23);
    const rifleSize = new Box3().setFromObject(rifle!).getSize(new Vector3());
    expect(rifleSize.z).toBeGreaterThan(1.65);
    expect(rifleSize.z).toBeLessThan(1.75);
  });

  it('shows a leather infantry spiked helmet and three-band Dreyse without later repeating-rifle details', async () => {
    const profile = getUnitProfile('prussian-line-infantry-1870');
    expect(profile).toBeDefined();
    const bytes = await readFile(new URL(`../../public${profile!.modelUrl}`, import.meta.url));
    expect(bytes.byteLength).toBeLessThan(500_000);
    const source = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      '',
    );
    for (const name of [
      'prussian_1870_leather_helmet',
      'prussian_helmet_spike',
      'prussian_blue_waffenrock',
      'dreyse_1862',
      'dreyse_bolt',
      'dreyse_cocking_sleeve',
      'dreyse_trigger_spur',
      'dreyse_band_1',
      'dreyse_band_2',
      'dreyse_band_3',
    ]) {
      expect(source.scene.getObjectByName(name), name).toBeDefined();
    }
    for (const name of [
      'magazine',
      'mauser_bolt',
      'chassepot_cocking_piece',
      'chassepot_sabre_bayonet',
      'flint_cock',
      'steel_helmet',
    ]) {
      expect(source.scene.getObjectByName(name), name).toBeUndefined();
    }
    source.scene.updateMatrixWorld(true);
    const size = (name: string) =>
      new Box3().setFromObject(source.scene.getObjectByName(name)!).getSize(new Vector3());
    expect(size('dreyse_1862').z).toBeGreaterThan(1.34);
    expect(size('dreyse_1862').z).toBeLessThan(1.38);
    expect(size('prussian_1870_leather_helmet').y).toBeGreaterThan(0.24);
    expect(size('prussian_1870_leather_helmet').y).toBeLessThan(0.31);
    expect(size('prussian_helmet_spike').y).toBeGreaterThan(0.09);
    expect(source.animations.map((clip) => clip.name)).toEqual(
      expect.arrayContaining(['March', 'Engage']),
    );
  });

  it('shows a low French kepi, campaign capote and single-shot Chassepot with curved sabre bayonet', async () => {
    const profile = getUnitProfile('french-line-infantry-1870');
    expect(profile).toBeDefined();
    const bytes = await readFile(new URL(`../../public${profile!.modelUrl}`, import.meta.url));
    expect(bytes.byteLength).toBeLessThan(500_000);
    const source = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      '',
    );
    for (const name of [
      'french_1870_kepi',
      'french_1870_capote',
      'chassepot_1866',
      'chassepot_bolt',
      'chassepot_cocking_piece',
      'chassepot_sabre_bayonet',
    ]) {
      expect(source.scene.getObjectByName(name), name).toBeDefined();
    }
    for (const name of [
      'magazine',
      'mauser_bolt',
      'flint_cock',
      'india_pattern_flintlock',
      'mexican_cylindrical_shako',
    ]) {
      expect(source.scene.getObjectByName(name), name).toBeUndefined();
    }
    source.scene.updateMatrixWorld(true);
    const size = (name: string) =>
      new Box3().setFromObject(source.scene.getObjectByName(name)!).getSize(new Vector3());
    expect(size('french_1870_kepi').y).toBeLessThan(0.18);
    expect(size('french_1870_kepi').z).toBeGreaterThan(0.24);
    expect(size('chassepot_1866').z).toBeGreaterThan(1.85);
    expect(size('chassepot_1866').z).toBeLessThan(1.95);
    expect(size('chassepot_sabre_bayonet').z).toBeGreaterThan(0.65);
    // The flat yataghan blade has an observable recurved edge, unlike a socket spike.
    expect(size('chassepot_sabre_bayonet').y).toBeGreaterThan(0.06);
  });

  it('shows a Mexican cylindrical shako and India Pattern flintlock with offset socket bayonet', async () => {
    const profile = getUnitProfile('mexican-war-infantry');
    expect(profile).toBeDefined();
    const bytes = await readFile(new URL(`../../public${profile!.modelUrl}`, import.meta.url));
    expect(bytes.byteLength).toBeLessThan(500_000);
    const source = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      '',
    );
    const shako = source.scene.getObjectByName('mexican_cylindrical_shako');
    const musket = source.scene.getObjectByName('india_pattern_musket');
    expect(shako).toBeDefined();
    expect(musket).toBeDefined();
    for (const name of [
      'india_pattern_flintlock',
      'india_pattern_ramrod_pipes',
      'india_pattern_socket_bayonet',
      'mexican_tailcoat',
    ]) {
      expect(source.scene.getObjectByName(name), name).toBeDefined();
    }
    for (const name of [
      'french_cocked_hat',
      'iron_barrel_band',
      'mauser_bolt',
      'percussion_hammer',
    ]) {
      expect(source.scene.getObjectByName(name), name).toBeUndefined();
    }
    source.scene.updateMatrixWorld(true);
    const shakoSize = new Box3().setFromObject(shako!).getSize(new Vector3());
    // The named group includes the chinstrap below the 21 cm cylinder.
    expect(shakoSize.y).toBeGreaterThan(0.4);
    expect(shakoSize.y).toBeLessThan(0.55);
    const gunSize = new Box3().setFromObject(musket!).getSize(new Vector3());
    expect(gunSize.z).toBeGreaterThan(1.7);
    expect(gunSize.z).toBeLessThan(1.9);
    expect(source.animations.map((clip) => clip.name)).toEqual(
      expect.arrayContaining(['March', 'Engage']),
    );
  });

  it('shows a three-cornered Austrian hat, black gaiters and a distinct pinned flintlock', async () => {
    const profile = getUnitProfile('austrian-seven-years-infantry');
    expect(profile).toBeDefined();
    const bytes = await readFile(new URL(`../../public${profile!.modelUrl}`, import.meta.url));
    expect(bytes.byteLength).toBeLessThan(500_000);
    const source = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      '',
    );
    const hat = source.scene.getObjectByName('austrian_tricorne');
    const musket = source.scene.getObjectByName('austrian_flintlock_musket');
    expect(hat).toBeDefined();
    expect(musket).toBeDefined();
    expect(source.scene.getObjectByName('austrian_flintlock_action')).toBeDefined();
    expect(source.scene.getObjectByName('austrian_gaiters')).toBeDefined();
    expect(source.scene.getObjectByName('french_cocked_hat')).toBeUndefined();
    expect(source.scene.getObjectByName('mauser_bolt')).toBeUndefined();
    source.scene.updateMatrixWorld(true);
    const hatSize = new Box3().setFromObject(hat!).getSize(new Vector3());
    expect(hatSize.x).toBeGreaterThan(0.38);
    expect(hatSize.z).toBeGreaterThan(0.25);
    const musketSize = new Box3().setFromObject(musket!).getSize(new Vector3());
    expect(musketSize.z).toBeGreaterThan(1.7);
    expect(musketSize.z).toBeLessThan(1.9);
  });

  it('shows a wide cocked hat and a full-length flintlock with a socket bayonet', async () => {
    const profile = getUnitProfile('french-revolution-infantry');
    expect(profile).toBeDefined();
    const bytes = await readFile(new URL(`../../public${profile!.modelUrl}`, import.meta.url));
    expect(bytes.byteLength).toBeLessThan(371_040);
    const source = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      '',
    );
    const hat = source.scene.getObjectByName('french_cocked_hat');
    const musket = source.scene.getObjectByName('french_flintlock_musket');
    expect(hat).toBeDefined();
    expect(musket).toBeDefined();
    expect(source.scene.getObjectByName('flintlock_action')).toBeDefined();
    expect(source.scene.getObjectByName('mauser_bolt')).toBeUndefined();
    expect(source.scene.getObjectByName('martini_rifle')).toBeUndefined();
    source.scene.updateMatrixWorld(true);
    const hatSize = new Box3().setFromObject(hat!).getSize(new Vector3());
    expect(hatSize.x).toBeGreaterThan(0.42);
    expect(hatSize.y).toBeLessThan(0.23);
    const musketSize = new Box3().setFromObject(musket!).getSize(new Vector3());
    expect(musketSize.z).toBeGreaterThan(1.88);
    expect(musketSize.z).toBeLessThan(1.98);
  });

  it('shows an Ottoman cloth cap and a full-stock Mauser bolt rifle without a steel helmet or Martini lever', async () => {
    const profile = getUnitProfile('ottoman-ww1-infantry');
    expect(profile).toBeDefined();
    const bytes = await readFile(new URL(`../../public${profile!.modelUrl}`, import.meta.url));
    expect(bytes.byteLength).toBeLessThan(500_000);
    const source = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      '',
    );
    const cap = source.scene.getObjectByName('ottoman_cloth_cap');
    const rifle = source.scene.getObjectByName('mauser_rifle');
    const bolt = source.scene.getObjectByName('mauser_bolt');
    expect(cap).toBeDefined();
    expect(rifle).toBeDefined();
    expect(bolt).toBeDefined();
    expect(source.scene.getObjectByName('foreign_service_helmet')).toBeUndefined();
    expect(source.scene.getObjectByName('martini_rifle')).toBeUndefined();
    source.scene.updateMatrixWorld(true);
    const capSize = new Box3().setFromObject(cap!).getSize(new Vector3());
    expect(capSize.y).toBeGreaterThan(0.18);
    expect(capSize.x).toBeLessThan(0.3);
    const rifleSize = new Box3().setFromObject(rifle!).getSize(new Vector3());
    // The authored long wooden stock and barrel form a roughly 1.25 m rifle,
    // rather than the earlier asset's 1.77 m rifle-and-socket-bayonet assembly.
    expect(rifleSize.z).toBeGreaterThan(1.2);
    expect(rifleSize.z).toBeLessThan(1.3);
    expect(new Box3().setFromObject(bolt!).getSize(new Vector3()).x).toBeGreaterThan(0.08);
  });

  it('distinguishes the 1879 helmet and single-shot breech loader from a forage cap and musket', async () => {
    const profile = getUnitProfile('british-martini-infantry');
    expect(profile).toBeDefined();
    const bytes = await readFile(new URL(`../../public${profile!.modelUrl}`, import.meta.url));
    expect(bytes.byteLength).toBeLessThan(500_000);
    const source = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      '',
    );
    const helmetNode = source.scene.getObjectByName('foreign_service_helmet');
    const rifleNode = source.scene.getObjectByName('martini_rifle');
    expect(helmetNode).toBeDefined();
    expect(rifleNode).toBeDefined();
    source.scene.updateMatrixWorld(true);
    const helmet = new Box3().setFromObject(helmetNode!);
    const face = new Box3().setFromObject(source.scene.getObjectByName('head_geometry')!);
    expect(helmet.getSize(new Vector3()).x).toBeGreaterThan(face.getSize(new Vector3()).x * 1.5);
    // The brimmed helmet projects over the face; the rifle includes the long
    // socket bayonet shown in the contemporary Jenkins study.
    expect(helmet.max.y).toBeGreaterThan(face.max.y + 0.12);
    const rifleSize = new Box3().setFromObject(rifleNode!).getSize(new Vector3());
    expect(rifleSize.z).toBeGreaterThan(1.7);
    expect(rifleSize.z).toBeLessThan(1.9);
  });

  it('preserves full-length pikes and a controlled forward thrust during engagement', async () => {
    for (const id of ['tercio-pikeman', 'civil-war-pikeman']) {
      const profile = getUnitProfile(id);
      expect(profile, id).toBeDefined();
      const bytes = await readFile(new URL(`../../public${profile!.modelUrl}`, import.meta.url));
      const source = await new GLTFLoader().parseAsync(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        '',
      );
      const mixer = new AnimationMixer(source.scene);
      const march = source.animations.find((item) => item.name === 'March')!;
      mixer.clipAction(march).play();
      mixer.setTime(0);
      source.scene.updateMatrixWorld(true);
      const rest = new Box3().setFromObject(source.scene).getSize(new Vector3());
      expect(rest.y, id).toBeGreaterThan(4.9);
      expect(rest.y, id).toBeLessThan(5.3);
      const grip = source.scene.getObjectByName('pike_grip');
      expect(grip, id).toBeDefined();
      mixer.stopAllAction();
      const clip = source.animations.find((item) => item.name === 'Engage')!;
      mixer.clipAction(clip).play();
      for (const phase of [0, 0.3, 0.55, 0.8]) {
        mixer.setTime(clip.duration * phase);
        source.scene.updateMatrixWorld(true);
        const direction = new Vector3(0, 1, 0).transformDirection(grip!.matrixWorld);
        expect(direction.angleTo(new Vector3(0, 0, 1)), `${id} pike ${phase}`).toBeLessThan(0.2);
      }
      mixer.stopAllAction();
      mixer.uncacheRoot(source.scene);
    }
  });

  it('loads every registered model with complete opaque geometry, independent animation clips and stable articulated bounds', async () => {
    let totalBytes = 0;
    const uniqueAssets = new Set<string>();
    for (const profile of Object.values(UNIT_PROFILES)) {
      const bytes = await readFile(new URL(`../../public${profile.modelUrl}`, import.meta.url));
      if (!uniqueAssets.has(profile.modelUrl)) totalBytes += bytes.byteLength;
      uniqueAssets.add(profile.modelUrl);
      expect(bytes.readUInt32LE(0), profile.id).toBe(0x46546c67);
      expect(bytes.readUInt32LE(8), profile.id).toBe(bytes.byteLength);
      const jsonLength = bytes.readUInt32LE(12);
      const gltfJson = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
      expect(gltfJson.images ?? [], profile.id).toHaveLength(0);
      expect(
        gltfJson.buffers.every((buffer: { uri?: string }) => !buffer.uri),
        profile.id,
      ).toBe(true);
      expect(
        gltfJson.materials.every(
          (material: { alphaMode?: string }) =>
            !material.alphaMode || material.alphaMode === 'OPAQUE',
        ),
        profile.id,
      ).toBe(true);
      const triangles = gltfJson.meshes.reduce(
        (sum: number, mesh: { primitives: { indices: number }[] }) =>
          sum +
          mesh.primitives.reduce(
            (n, primitive) => n + gltfJson.accessors[primitive.indices].count / 3,
            0,
          ),
        0,
      );
      expect(triangles, profile.id).toBeGreaterThan(1000);
      expect(triangles, profile.id).toBeLessThan(40000);
      const source = await new GLTFLoader().parseAsync(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        '',
      );
      expect(source.animations.map((clip) => clip.name).sort(), profile.id).toEqual([
        'Engage',
        'March',
      ]);
      source.scene.updateMatrixWorld(true);
      const restBounds = new Box3().setFromObject(source.scene);
      const restSize = restBounds.getSize(new Vector3());
      expect(restSize.y, profile.id).toBeGreaterThan(0.3);
      expect(restSize.length(), profile.id).toBeLessThan(12);
      if (profile.role === 'infantry' || profile.role === 'ranged') {
        expect(restBounds.min.y, `${profile.id} feet`).toBeGreaterThan(-0.25);
        expect(restBounds.max.y, `${profile.id} head`).toBeGreaterThan(1.5);
        const hips = source.scene.getObjectByName('hips');
        expect(hips?.getWorldPosition(new Vector3()).y, `${profile.id} hips`).toBeGreaterThan(0.85);
      }
      if (profile.role === 'cavalry') {
        const rider = source.scene.getObjectByName('rider_head');
        expect(
          rider?.getWorldPosition(new Vector3()).y,
          `${profile.id} mounted rider`,
        ).toBeGreaterThan(2);
      }
      for (const clip of source.animations) {
        const restTransforms = new Map<string, number[]>();
        source.scene.traverse((node) => restTransforms.set(node.uuid, node.matrixWorld.toArray()));
        const mixer = new AnimationMixer(source.scene);
        mixer.clipAction(clip).play();
        mixer.setTime(clip.duration * 0.45);
        source.scene.updateMatrixWorld(true);
        const animatedSize = new Box3().setFromObject(source.scene).getSize(new Vector3());
        let moved = false;
        source.scene.traverse((node) => {
          const previous = restTransforms.get(node.uuid)!;
          if (
            node.matrixWorld.elements.some(
              (value, index) => Math.abs(value - previous[index]) > 0.0001,
            )
          )
            moved = true;
        });
        expect(moved, `${profile.id} ${clip.name} must actually move geometry`).toBe(true);
        expect(animatedSize.length(), `${profile.id} ${clip.name} bounds`).toBeLessThan(
          restSize.length() * 1.6,
        );
        expect(animatedSize.length(), `${profile.id} ${clip.name} collapsed`).toBeGreaterThan(
          restSize.length() * 0.65,
        );
        mixer.stopAllAction();
        mixer.uncacheRoot(source.scene);
      }
    }
    // Profiles load per scene. Each new vessel remains under 500 KB;
    // the authorized 21.5 MB growth guard preserves all existing geometry.
    // A new scene-lazy 1870 infantry family is authorized within this 22 MB catalogue guard.
    expect(totalBytes).toBeLessThan(22_000_000);
  });

  it('bounds the three added land families by their actual lazy scene download cost', async () => {
    let total = 0;
    for (const id of ['byzantine-spearman', 'tercio-pikeman', 'civil-war-pikeman']) {
      const profile = getUnitProfile(id)!;
      const bytes = await readFile(new URL(`../../public${profile.modelUrl}`, import.meta.url));
      expect(bytes.byteLength, id).toBeLessThan(400_000);
      total += bytes.byteLength;
    }
    expect(total).toBeLessThan(1_100_000);
  });

  it('keeps the added naval families small enough for lazy scene loading', async () => {
    let bytes = 0;
    for (const id of [
      'new-kingdom-oared-ship',
      'lake-war-canoe',
      'steam-corvette',
      'ironclad-warship',
      'casemate-ironclad',
      'monitor-warship',
      'paddle-steamer',
      'protected-cruiser',
    ]) {
      const profile = getUnitProfile(id)!;
      const asset = await readFile(new URL(`../../public${profile.modelUrl}`, import.meta.url));
      expect(asset.byteLength, id).toBeLessThan(150_000);
      bytes += asset.byteLength;
    }
    expect(bytes).toBeLessThan(1_000_000);
    expect(getUnitProfile('pre-dreadnought')!.modelUrl).toBe(
      getUnitProfile('steam-warship')!.modelUrl,
    );
    let specialistBytes = 0;
    for (const id of [
      'torpedo-boat',
      'spar-torpedo-launch',
      'auxiliary-cruiser',
      'steam-transport',
      'steam-minelayer',
      'small-steam-gunboat',
    ]) {
      const profile = getUnitProfile(id)!;
      const asset = await readFile(new URL(`../../public${profile.modelUrl}`, import.meta.url));
      expect(asset.byteLength, id).toBeLessThan(180_000);
      specialistBytes += asset.byteLength;
    }
    expect(specialistBytes).toBeLessThan(850_000);
  });

  it('keeps firearm engagement aimed forward instead of swinging it like a sword', async () => {
    for (const id of [
      'prussian-line-infantry-1870',
      'french-line-infantry-1870',
      'mexican-war-infantry',
      'musket-infantry',
      'napoleonic-infantry',
      'modern-rifle',
      'british-rifle',
      'german-rifle',
      'french-rifle',
      'bengal-matchlock',
      'bengal-sepoy',
      'british-martini-infantry',
      'ottoman-ww1-infantry',
      'austrian-seven-years-infantry',
      'french-revolution-infantry',
      'japanese-russo-war-winter-infantry',
      'russian-russo-war-winter-infantry',
    ]) {
      const profile = getUnitProfile(id)!;
      const bytes = await readFile(new URL(`../../public${profile.modelUrl}`, import.meta.url));
      const source = await new GLTFLoader().parseAsync(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        '',
      );
      const hand = source.scene.getObjectByName('hand_r')!;
      const mixer = new AnimationMixer(source.scene);
      const clip = source.animations.find((clip) => clip.name === 'Engage')!;
      mixer.clipAction(clip).play();
      mixer.setTime(0);
      source.scene.updateMatrixWorld(true);
      const direction = new Vector3(0, 0, 1).transformDirection(hand.matrixWorld);
      for (const phase of [0.3, 0.42, 0.55, 0.75]) {
        mixer.setTime(clip.duration * phase);
        source.scene.updateMatrixWorld(true);
        const aimed = new Vector3(0, 0, 1).transformDirection(hand.matrixWorld);
        expect(direction.angleTo(aimed), `${id} recoil angle at ${phase}`).toBeLessThan(0.25);
      }
      mixer.stopAllAction();
      mixer.uncacheRoot(source.scene);
    }
  });
});
