import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withLocale } from '../../lib/navigation';
import { hrefKeepingLang } from '../../lib/locale-href';
import { useAtlasStore } from '../../lib/store';
import { bindDocumentTitle, documentTitle } from '../../lib/use-document-title';
import { religionLabel, religionLanguage } from '../../lib/religions/time';

describe('internal links keep the chosen language', () => {
  it('leaves the default language implicit and external links untouched', () => {
    expect(withLocale('/about/', 'en')).toBe('/about/');
    expect(withLocale('https://example.org/about/', 'fr')).toBe('https://example.org/about/');
    expect(withLocale('//example.org/about/', 'fr')).toBe('//example.org/about/');
    expect(withLocale('#atlas-explore', 'fr')).toBe('#atlas-explore');
  });

  it('adds or replaces the language while keeping the query and the fragment', () => {
    expect(withLocale('/about/', 'fr')).toBe('/about/?lang=fr');
    expect(withLocale('/', 'zh')).toBe('/?lang=zh');
    expect(withLocale('/?y=1815&e=Q48314', 'de')).toBe('/?y=1815&e=Q48314&lang=de');
    expect(withLocale('/?lang=en&y=1815', 'ru')).toBe('/?lang=ru&y=1815');
    expect(withLocale('/about/#sources', 'es')).toBe('/about/?lang=es#sources');
  });
});

describe('the static pages lead back to the atlas in the reader’s language', () => {
  const source = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

  it('keeps a supported ?lang= from the page address and nothing else', () => {
    expect(hrefKeepingLang('/', '?lang=fr')).toBe('/?lang=fr');
    expect(hrefKeepingLang('/', '?utm_source=news&lang=zh')).toBe('/?lang=zh');
    expect(hrefKeepingLang('/', '?lang=en')).toBe('/');
    expect(hrefKeepingLang('/', '?lang=xx')).toBe('/');
    expect(hrefKeepingLang('/', '')).toBe('/');
  });

  it('uses it for “Back to the atlas” without pulling atlas code into those pages', () => {
    // The document pages load no store, data client or map code.
    const imports = [...source('lib/locale-href.ts').matchAll(/from '([^']+)'/g)].map(
      (match) => match[1],
    );
    expect(imports).toEqual(['./types']);
    for (const page of ['app/about/page.tsx', 'app/event/[id]/page.tsx', 'app/war/[id]/page.tsx'])
      expect(source(page), page).toMatch(/<LocaleLink className="back-link" href="\/">/);
  });
});

describe('tab title', () => {
  it('names the open record and its year in the reader’s language', () => {
    expect(documentTitle('en')).toBe('HistoryOfAtlas — History through maps');
    expect(documentTitle('fr')).toBe('HistoryOfAtlas — L’histoire à travers les cartes');
    expect(documentTitle('fr', { name: 'Bataille de Waterloo', year: 1815 })).toBe(
      'Bataille de Waterloo · 1815 — HistoryOfAtlas',
    );
    expect(documentTitle('en', { name: 'Roman Empire' })).toBe('Roman Empire — HistoryOfAtlas');
    expect(documentTitle('en', null)).toBe(documentTitle('en'));
  });

  it('follows the language and leaves the next page’s title alone once unbound', () => {
    const initial = useAtlasStore.getState();
    const tab = { title: 'HistoryOfAtlas' };
    const unbind = bindDocumentTitle(tab);
    try {
      expect(tab.title).toBe(documentTitle(initial.locale));
      useAtlasStore.getState().setLocale('fr');
      expect(tab.title).toBe(documentTitle('fr'));
      // A client-side navigation to /about/ writes its own title before the atlas unmounts.
      tab.title = 'Sources & methodology — HistoryOfAtlas';
      unbind();
      expect(tab.title).toBe('Sources & methodology — HistoryOfAtlas');
      useAtlasStore.getState().setLocale('de');
      expect(tab.title).toBe('Sources & methodology — HistoryOfAtlas');
    } finally {
      unbind();
      useAtlasStore.setState(initial, true);
    }
  });
});

describe('religion texts', () => {
  const text = { en: 'The early Upanishads', fr: 'Les premières Upanishad' };
  it('declares English wherever the French text is not shown', () => {
    expect(religionLanguage('fr')).toBe('fr');
    for (const locale of ['en', 'de', 'es', 'zh', 'ru'] as const) {
      expect(religionLanguage(locale)).toBe('en');
      expect(religionLabel(text, locale)).toBe(text.en);
    }
    expect(religionLabel(text, 'fr')).toBe(text.fr);
  });
});
