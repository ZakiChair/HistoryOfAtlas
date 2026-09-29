import { splitReligionCoverage, type ReligionCoverageDataset } from '../../lib/religions/coverage';

const text = { fr: 'Zone', en: 'Area' };
export function coverageFixture(): ReligionCoverageDataset {
  return {
    version: 1,
    snapshotMaxAge: 10,
    traditions: [
      { id: 'a', names: text, color: '#ff0000', symbol: 'cross', kind: 'religion' },
      { id: 'b', names: text, color: '#00ff00', symbol: 'crescent', kind: 'religion' },
      { id: 'none', names: text, color: '#888888', symbol: 'none', kind: 'unaffiliated' },
    ],
    sources: [{ id: 's', title: 'Source', url: 'https://example.org/source', license: 'CC0' }],
    geometries: [
      {
        id: 'g',
        sourceIds: ['s'],
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [5, 0],
              [5, 5],
              [0, 0],
            ],
          ],
        },
      },
    ],
    observations: [
      {
        id: 'old',
        regionId: 'r',
        name: text,
        geometryId: 'g',
        time: { kind: 'snapshot', year: 2000 },
        populationScope: text,
        shares: [
          { traditionId: 'a', share: 0.6 },
          { traditionId: 'b', share: 0.2 },
        ],
        sourceIds: ['s'],
      },
    ],
  };
}

export const coverageIndexFixture = () => splitReligionCoverage(coverageFixture()).index;
export const coverageRegionFixture = (regionId = 'r') =>
  splitReligionCoverage(coverageFixture()).regions.find((region) => region.regionId === regionId)!;
