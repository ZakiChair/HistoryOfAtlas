import { describe, expect, it } from 'vitest';
import { coverageFixture } from '../fixtures/religion-coverage';
import { buildReligionCoverage } from '../../pipeline/religions/build';

describe('independently sourced religion coverage publication', () => {
  it('shares identical geography and traditions while keeping independently dated observations', () => {
    const first = coverageFixture();
    const second = coverageFixture();
    second.observations[0].id = 'later';
    second.observations[0].time = { kind: 'snapshot', year: 2010 };
    const combined = buildReligionCoverage([first, second]);
    expect(combined.geometries).toHaveLength(1);
    expect(combined.traditions).toHaveLength(3);
    expect(combined.observations.map((row) => row.id)).toEqual(['old', 'later']);
  });
  it('does not silently choose one of two incompatible definitions of a source or geometry', () => {
    const first = coverageFixture();
    const second = coverageFixture();
    second.sources[0].url = 'https://example.org/another-source';
    expect(() => buildReligionCoverage([first, second])).toThrow(/Conflicting sources/);
  });
  it('refuses two observations for the same region and year even if their IDs differ', () => {
    const first = coverageFixture();
    const second = coverageFixture();
    second.observations[0].id = 'alternative';
    second.observations[0].shares[0].share = 0.55;
    expect(() => buildReligionCoverage([first, second])).toThrow(/region\/time/);
  });
});
