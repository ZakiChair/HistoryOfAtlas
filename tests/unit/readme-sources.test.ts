import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);
const readme = readFileSync(new URL('README.md', root), 'utf8');
const table = readme.slice(
  readme.indexOf('## Sources and licences'),
  readme.indexOf('Do not treat this mixed collection'),
);
const links = [...table.matchAll(/\]\(([^)\s]+)\)/g)].map((match) => match[1]!);

/** Every URL the licence manifest records, from its source, licence and reference fields. */
function manifestUrls(value: unknown, urls = new Set<string>()): Set<string> {
  if (typeof value === 'string' && /^https?:\/\//.test(value)) urls.add(value.replace(/\/$/, ''));
  else if (Array.isArray(value)) for (const item of value) manifestUrls(item, urls);
  else if (value && typeof value === 'object')
    for (const item of Object.values(value)) manifestUrls(item, urls);
  return urls;
}
const manifest = manifestUrls(
  JSON.parse(readFileSync(new URL('public/data/licenses.json', root), 'utf8')),
);

/** Licensing pages that document a source's terms without being one of its records. */
const TERMS_PAGES = new Set(['https://www.wikidata.org/wiki/Wikidata:Licensing']);

describe('README sources and licences table', () => {
  it('links every source to a URL the licence manifest records, or to its landing page', () => {
    const external = links.filter((link) => /^https?:\/\//.test(link));
    expect(external.length).toBeGreaterThan(15);
    const untraceable = external.filter((link) => {
      const url = link.replace(/\/$/, '');
      if (manifest.has(url) || TERMS_PAGES.has(link)) return false;
      // A landing page stops at a path boundary; a URL cut inside a segment (a figshare article
      // id, a page slug) opens another page or none.
      return ![...manifest].some(
        (recorded) => /^[/?#]/.test(recorded.slice(url.length)) && recorded.startsWith(url),
      );
    });
    expect(untraceable).toEqual([]);
  });

  it('points repository links at files that exist', () => {
    const local = links.filter((link) => !/^[a-z]+:/.test(link) && !link.startsWith('#'));
    expect(local.length).toBeGreaterThan(0);
    for (const link of local) expect(existsSync(new URL(link, root)), link).toBe(true);
  });
});
