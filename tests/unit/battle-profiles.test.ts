import { describe, expect, it } from 'vitest';
import { mergeBattleProfiles } from '../../pipeline/battles/profiles';

describe('battle evidence precedence', () => {
  it('keeps manual reviews authoritative while adding separately imported battles', () => {
    const result = mergeBattleProfiles(
      {
        version: 1,
        records: {
          Q1: { participants: [], note: 'Imported' },
          Q2: { participants: [], note: 'Additional' },
        },
      },
      { version: 1, records: { Q1: { participants: [], note: 'Manually corrected scope' } } },
    );
    expect(result.records.Q1.note).toBe('Manually corrected scope');
    expect(result.records.Q2.note).toBe('Additional');
  });

  it('rejects imported evidence that could scale armies from an unreviewed unit', () => {
    expect(() =>
      mergeBattleProfiles(
        {
          version: 1,
          records: {
            Q1: {
              note: 'Invalid unit',
              participants: [
                {
                  id: 'force',
                  name: { en: 'Force' },
                  kind: 'military-unit',
                  strength: [
                    {
                      value: 100,
                      counts: 'unknown',
                      scope: 'participant',
                      renderable: true,
                      sources: [{ label: 'Source', url: 'https://example.org' }],
                    },
                  ],
                  deaths: [],
                  casualties: [],
                  sources: [{ label: 'Source', url: 'https://example.org' }],
                },
              ],
            },
          },
        },
        { version: 1, records: {} },
      ),
    ).toThrow('Only reviewed military quantities');
  });
});
