import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import SectionFallback, { type SectionArea } from '../../components/ui/SectionFallback';
import { loadEditorialCopy, translateCopy } from '../../lib/i18n';
import { additionalCopy } from '../../lib/i18n/copy';
import { LOCALES } from '../../lib/types';

const render = (props: Parameters<typeof SectionFallback>[0]): string =>
  renderToStaticMarkup(createElement(SectionFallback, props));

const AREAS: SectionArea[] = ['map', 'layers', 'notebook', 'detail'];

describe('contained rendering error', () => {
  beforeAll(() => loadEditorialCopy());

  it.each(AREAS)('announces the failing %s and offers to try again', (area) => {
    const markup = render({ area, error: new Error('layer source missing'), retry: () => {} });
    expect(markup).toContain('role="alert"');
    expect(markup).toContain(`data-area="${area}"`);
    expect(markup).toContain('layer source missing');
    expect(markup).toContain('Try again');
    expect(markup).not.toMatch(/undefined|NaN|\[object/);
  });

  it('names a distinct part of the atlas for each boundary', () => {
    const titles = AREAS.map(
      (area) =>
        /class="section-error-title">([^<]+)</.exec(
          render({ area, error: new Error('x'), retry: () => {} }),
        )?.[1],
    );
    expect(new Set(titles).size).toBe(AREAS.length);
    expect(titles.every((title) => Boolean(title))).toBe(true);
  });

  it('renders the complementary action only where one is offered', () => {
    const plain = render({ area: 'notebook', error: new Error('x'), retry: () => {} });
    expect(plain).not.toContain('secondary-button');
    const withAction = render({
      area: 'detail',
      error: new Error('x'),
      retry: () => {},
      action: { label: 'Close the record', onClick: () => {} },
    });
    expect(withAction).toContain('Close the record');
  });

  it('survives a thrown value that is not an Error, without inventing a message', () => {
    const markup = render({ area: 'map', error: 'not an Error', retry: () => {} });
    expect(markup).not.toContain('section-error-detail');
    expect(markup).not.toContain('not an Error');
    expect(markup).toContain('Try again');
  });

  it('draws every rendered sentence from the catalog, in each offered language', () => {
    // Server rendering reads the store's initial state, so the rendered English text is compared
    // against the catalog rather than re-rendered once per language.
    const sentences = AREAS.flatMap((area) =>
      [
        ...render({ area, error: new Error('x'), retry: () => {} }).matchAll(
          /class="section-error-(?:title|note)">([^<]+)</g,
        ),
      ].map((match) => match[1]!),
    );
    expect(sentences.length).toBe(AREAS.length * 2);
    for (const sentence of new Set(sentences)) {
      expect(additionalCopy[sentence], sentence).toBeDefined();
      for (const locale of LOCALES)
        expect(translateCopy(locale, '—', sentence).trim(), `${locale}: ${sentence}`).toBeTruthy();
    }
  });
});
