import { describe, expect, it } from 'vitest';
import { buildLicenseManifest, licenseIssues, type LicenseInputs } from '@/lib/licenses';
import { REPOSITORY_URL } from '@/lib/seo';
import { checkLicenseManifest, readProjectLicenses } from '../../scripts/build-licenses';

function inputs(): LicenseInputs {
  return {
    project: {
      code: {
        license: 'MIT',
        licenseUrl: 'https://opensource.org/license/mit',
        text: 'https://github.com/example/atlas/blob/main/LICENSE',
      },
      content: {
        license: 'CC BY 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        text: 'https://github.com/example/atlas/blob/main/DATA-LICENSE.md',
        attribution: 'Atlas contributors',
      },
    },
    events: {
      sources: [{ label: 'Wikidata', url: 'https://www.wikidata.org/', license: 'CC0-1.0' }],
    },
    cdb90: {
      repository: 'https://github.com/jrnold/CDB90',
      commit: 'abc',
      license: 'ODC-BY-1.0',
      licenseUrl: 'https://opendatacommons.org/licenses/by/1-0/',
      originalDataLicense: 'Public Domain',
      attribution: 'CDB90',
    },
    geography: {
      sources: [
        {
          label: 'Cliopatria · Seshat',
          url: 'https://github.com/Seshat-Global-History-Databank/cliopatria',
          licence: 'CC-BY-4.0',
          licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
        },
        {
          label: 'Historical Basemaps',
          url: 'https://github.com/aourednik/historical-basemaps',
          licence: 'GPL-3.0-only',
          licenceUrl: '/geo/HISTORICAL-BASEMAPS-LICENSE.txt',
        },
      ],
    },
    resources: {
      sources: [
        {
          id: 'usgs',
          name: 'USGS',
          url: 'https://mrdata.usgs.gov/',
          license: 'Public domain',
          year: 2005,
        },
        {
          id: 'gem',
          name: 'Global Energy Monitor',
          url: 'https://globalenergymonitor.org/',
          license: 'CC BY 4.0',
          licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
          year: 2024,
        },
        {
          id: 'gem-coal',
          name: 'GEM coal',
          url: 'https://globalenergymonitor.org/coal',
          license: 'CC BY 4.0',
          year: 2024,
        },
      ],
      sites: [
        { sourceId: 'usgs' },
        { sourceId: 'gem' },
        { sourceId: 'gem' },
        { sourceId: 'gem-coal' },
      ],
    },
    religions: {
      sources: [{ id: 'ref-a', title: 'Reference A', url: 'https://example.org/a' }],
      milestones: [
        { id: 'm1', sourceIds: ['ref-a'] },
        { id: 'm2', sourceIds: ['ref-a', 'ref-a'] },
      ],
    },
  };
}

describe('licence manifest', () => {
  it('accepts complete inputs, including same-origin licence texts', () => {
    expect(licenseIssues(inputs())).toEqual([]);
  });

  it('reports every untraceable source', () => {
    const broken = inputs();
    broken.resources.sources[0]!.license = ' ';
    broken.resources.sources[1]!.url = 'not a url';
    broken.resources.sources[1]!.licenseUrl = 'ftp://example.org';
    broken.resources.sites.push({ sourceId: 'missing' });
    broken.religions.milestones.push({ id: 'm3', sourceIds: ['unknown'] });
    broken.religions.sources[0]!.url = '';
    broken.geography.sources[0]!.licenceUrl = '';
    broken.events.sources[0]!.license = '';
    broken.cdb90.attribution = '';
    broken.project.code.license = '';
    broken.project.content.text = 'DATA-LICENSE.md';
    broken.project.content.attribution = ' ';
    expect(licenseIssues(broken)).toEqual([
      'Resource source usgs has no licence',
      'Resource source gem has no URL',
      'Resource source gem has an invalid licence URL',
      'Resource sourceId missing has no declared source',
      'Religion source ref-a has no URL',
      'Religion milestone m3 cites unknown source unknown',
      'Geography source Cliopatria · Seshat has no licence URL',
      'Event source Wikidata has no licence',
      'CDB90 requires a licence, a licence URL and an attribution',
      'Project code has no licence',
      'Project content licence needs a licence URL and a licence file URL',
      'Project content licence needs an attribution',
    ]);
    expect(() => buildLicenseManifest(broken)).toThrow(/incomplete/);
  });

  it('counts sites per source and groups resource sources by licence', () => {
    const manifest = buildLicenseManifest(inputs());
    expect(manifest.resources.sources.map((source) => [source.id, source.sites])).toEqual([
      ['gem-coal', 1],
      ['gem', 2],
      ['usgs', 1],
    ]);
    expect(manifest.resources.licenses).toEqual([
      {
        license: 'CC BY 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        sources: 2,
        sites: 3,
      },
      { license: 'Public domain', sources: 1, sites: 1 },
    ]);
    expect(manifest.religions.references).toEqual([
      { id: 'ref-a', title: 'Reference A', url: 'https://example.org/a', milestones: 2 },
    ]);
  });

  it('declares the project licences and names every dataset', () => {
    const manifest = buildLicenseManifest(inputs());
    expect(manifest.project.code.license).toBe('MIT');
    expect(manifest.project.content).toMatchObject({
      license: 'CC BY 4.0',
      attribution: 'Atlas contributors',
    });
    expect(manifest.religions.corpus).toMatchObject({
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    });
    expect(manifest.datasets.map((dataset) => dataset.id)).toEqual([
      'wikidata',
      'cdb90',
      'geo-cliopatria',
      'geo-historical-basemaps',
      'wikipedia',
      'wikimedia-commons',
      'font-cormorant',
      'font-manrope',
    ]);
    for (const dataset of manifest.datasets) {
      expect(dataset.license, dataset.id).toBeTruthy();
      expect(dataset.url, dataset.id).toMatch(/^https:\/\//);
    }
  });

  it('reads the licences declared at the repository root', () => {
    expect(readProjectLicenses()).toEqual({
      code: {
        license: 'MIT',
        licenseUrl: 'https://opensource.org/license/mit',
        text: `${REPOSITORY_URL}/blob/main/LICENSE`,
      },
      content: {
        license: 'CC BY 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        text: `${REPOSITORY_URL}/blob/main/DATA-LICENSE.md`,
        attribution: 'HistoryOfAtlas contributors',
      },
    });
  });

  it('matches the committed public/data/licenses.json', () => {
    expect(checkLicenseManifest()).toMatch(/^Verified licences for \d+ resource sources/);
  });
});
