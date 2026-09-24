import { DEFAULT_LOCALE, isLocale, type Locale } from './types';

// Kept free of the store and the data client: the static document pages import it too.

/**
 * Keeps the chosen interface language on an internal link. The default language stays implicit,
 * as in the header link; external and protocol-relative URLs are returned unchanged.
 */
export function withLocale(href: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE || !href.startsWith('/') || href.startsWith('//')) return href;
  const hashAt = href.indexOf('#');
  const hash = hashAt < 0 ? '' : href.slice(hashAt);
  const base = hashAt < 0 ? href : href.slice(0, hashAt);
  const queryAt = base.indexOf('?');
  const path = queryAt < 0 ? base : base.slice(0, queryAt);
  const query = new URLSearchParams(queryAt < 0 ? '' : base.slice(queryAt + 1));
  query.set('lang', locale);
  return `${path}?${query.toString()}${hash}`;
}

/** The internal link with the page's own `?lang=`, when that is a supported language. */
export function hrefKeepingLang(href: string, search: string): string {
  const locale = new URLSearchParams(search).get('lang');
  return isLocale(locale) ? withLocale(href, locale) : href;
}
