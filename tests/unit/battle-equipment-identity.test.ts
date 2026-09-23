import { describe, expect, it } from 'vitest';
import { BattleRecordSchema } from '../../lib/battles/schema';
import { buildBattleSimulation } from '../../lib/battles/simulation';
import { resolveUnitProfile } from '../../lib/battles/units';
import { applyBattleEquipment, BattleEquipmentFileSchema } from '../../pipeline/battles/equipment';
import { assessBattleReadiness } from '../../pipeline/battles/readiness';

const source = {
  label: 'National Army Museum · Zulu War',
  url: 'https://www.nam.ac.uk/explore/zulu-war',
};
const identity = {
  polityId: 'Q729768',
  note: 'The locally scoped army belongs to the documented Zulu kingdom.',
  sources: [source],
};
const fixture = () =>
  BattleRecordSchema.parse({
    id: 'Q2166177',
    name: { en: 'Ulundi' },
    type: 'battle',
    medium: 'land',
    start: { year: 1879 },
    coords: [31.426, -28.299],
    sources: [source],
    totals: { strength: [], deaths: [], casualties: [] },
    participants: [
      {
        id: 'Q2166177:cdb90:231:attacker',
        name: { en: 'Zulu army' },
        kind: 'military-unit',
        sideId: 'attacker',
        strength: [
          {
            value: 20000,
            counts: 'soldiers',
            scope: 'participant',
            renderable: true,
            sources: [source],
          },
        ],
        deaths: [],
        casualties: [],
        sources: [source],
      },
    ],
  });

describe('sourced equipment identity for a scoped military unit', () => {
  it('keeps the army and counts intact while resolving its reviewed historical equipment', () => {
    const battle = fixture();
    const before = structuredClone(battle.participants[0]);
    applyBattleEquipment(battle, {
      note: 'Equipment and identity review only.',
      sources: [{ title: source.label, url: source.url }],
      participants: [{ id: before.id, profileId: 'zulu-spearman', equipmentIdentity: identity }],
    });
    const parsed = BattleRecordSchema.parse(battle);
    expect(parsed.participants[0]).toMatchObject(before);
    const army = buildBattleSimulation(parsed).armies[0];
    expect(army.participantId).toBe(before.id);
    expect(army.equipmentPolityId).toBe('Q729768');
    expect(resolveUnitProfile({ ...army, year: 1879 }).id).toBe('zulu-spearman');
    expect(assessBattleReadiness(parsed).profiles).toEqual(['zulu-spearman']);
    expect(assessBattleReadiness(parsed).allEquipmentAttributed).toBe(true);
  });

  it('does not infer equipment from an identity alone or bypass date, medium or polity limits', () => {
    const input = {
      participantId: 'local-force',
      equipmentPolityId: 'Q729768',
      year: 1879,
      medium: 'land' as const,
    };
    expect(resolveUnitProfile(input).id).toBe('unclassified-unit');
    expect(resolveUnitProfile({ ...input, profileId: 'zulu-spearman' }).id).toBe('zulu-spearman');
    for (const change of [
      { year: 1878 },
      { equipmentPolityId: 'Q30' },
      { medium: 'naval' as const },
    ])
      expect(resolveUnitProfile({ ...input, profileId: 'zulu-spearman', ...change }).id).not.toBe(
        'zulu-spearman',
      );
  });

  it('requires source evidence and an explicit profile, and never reclassifies a person or polity', () => {
    for (const equipmentIdentity of [
      { ...identity, sources: [] },
      { ...identity, note: '' },
      { ...identity, polityId: 'local' },
    ]) {
      expect(
        BattleEquipmentFileSchema.safeParse({
          version: 1,
          reviewedAt: '2026-09-21',
          policy: 'Reviewed equipment',
          records: {
            Q2166177: {
              note: 'Review',
              sources: [{ title: source.label, url: source.url }],
              participants: [{ id: 'local-force', profileId: 'zulu-spearman', equipmentIdentity }],
            },
          },
        }).success,
      ).toBe(false);
    }
    for (const kind of ['person', 'polity', 'unknown'] as const) {
      const battle = fixture();
      battle.participants[0].kind = kind;
      expect(() =>
        applyBattleEquipment(battle, {
          note: 'Review',
          sources: [{ title: source.label, url: source.url }],
          participants: [
            {
              id: battle.participants[0].id,
              profileId: 'zulu-spearman',
              equipmentIdentity: identity,
            },
          ],
        }),
      ).toThrow(/military unit|person/);
    }
    const battle = fixture();
    expect(() =>
      applyBattleEquipment(battle, {
        note: 'Review',
        sources: [{ title: source.label, url: source.url }],
        participants: [{ id: battle.participants[0].id, equipmentIdentity: identity }],
      }),
    ).toThrow(/explicit profile/);
  });
});
