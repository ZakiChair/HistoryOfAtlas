import { describe, expect, it } from 'vitest';
import { coverageFixture } from '../fixtures/religion-coverage';
import { buildReligionCoverage, religionCoverageArtifacts } from '../../pipeline/religions/build';

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

describe('coverage publication artifacts', () => {
  it('emits the index, the report and one file per region, sorted and stable', () => {
    const dataset = coverageFixture();
    dataset.observations.push({
      ...dataset.observations[0],
      id: 'later',
      time: { kind: 'snapshot', year: 2010 },
    });
    const artifacts = religionCoverageArtifacts(dataset, [{ path: 'input.json', hash: 'sha' }]);
    const paths = Object.keys(artifacts);
    expect(paths).toEqual([
      'public/data/religions/coverage-index.json',
      'public/data/religions/coverage-report.json',
      'public/data/religions/coverage/r.json',
    ]);
    const index = JSON.parse(artifacts[paths[0]]);
    expect(index.version).toBe(2);
    expect(index.observations.map((row: { id: string }) => row.id)).toEqual(['old', 'later']);
    const report = JSON.parse(artifacts[paths[1]]);
    expect(report.regionFiles).toBe(1);
    expect(report.indexObservations).toBe(2);
    const region = JSON.parse(artifacts[paths[2]]);
    expect(region.regionId).toBe('r');
    expect(region.observations).toHaveLength(2);
    expect(religionCoverageArtifacts(dataset, [{ path: 'input.json', hash: 'sha' }])).toEqual(
      artifacts,
    );
  });
});
