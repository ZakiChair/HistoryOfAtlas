import { readJson } from './index';

export type CommonsFile = {
  filename: string;
  title: string;
  creditUrl: string;
};

export type CommonsImageCredit = CommonsFile & {
  author?: string;
  credit?: string;
  /** When provided by Commons, display this instead of composing author + credit. */
  attribution?: string;
  license?: string;
  licenseUrl?: string;
};

/** Accept Commons repositories only; local Wikipedia files can have different rights. */
export function getCommonsFile(image: string): CommonsFile | null {
  try {
    if (!/^(?:https?:)?\/\//i.test(image)) return null;
    const url = new URL(image, 'https://commons.wikimedia.org');
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port) return null;
    let encodedFilename: string | undefined;
    if (url.hostname === 'upload.wikimedia.org') {
      const match = url.pathname.match(
        /^\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)(?:\/[^/]+)?$/i,
      );
      encodedFilename = match?.[1];
    } else if (url.hostname === 'commons.wikimedia.org') {
      const path = decodeURIComponent(url.pathname);
      const title = path.startsWith('/wiki/')
        ? path.slice(6)
        : path === '/w/index.php'
          ? url.searchParams.get('title')
          : null;
      const filename = title?.match(
        /^(?:File:|Image:|Special:FilePath\/|Special:Redirect\/file\/)(.+)$/i,
      )?.[1];
      if (filename) encodedFilename = encodeURIComponent(filename);
    }
    if (!encodedFilename) return null;
    const filename = decodeURIComponent(encodedFilename).replaceAll('_', ' ').trim();
    if (
      !filename ||
      /[|<>\[\]{}#]/.test(filename) ||
      [...filename].some((character) => character.charCodeAt(0) < 32)
    )
      return null;
    return {
      filename,
      title: `File:${filename}`,
      creditUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(filename.replaceAll(' ', '_'))}`,
    };
  } catch {
    return null;
  }
}

const entities: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  copy: '©',
  reg: '®',
  ndash: '–',
  mdash: '—',
  hellip: '…',
};

/** Formatting is discarded; the result is text for React children, never an HTML fragment. */
export function creditText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const withoutTags = value
    .replace(/<!--[^]*?-->/g, ' ')
    .replace(/<(script|style)\b[^>]*>[^]*?<\/\1\s*>/gi, ' ')
    .replace(/<\/?(?:br|p|div|li|tr)\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '');
  let text: string;
  if (typeof DOMParser !== 'undefined') {
    // Escaping every remaining '<' prevents elements or subresource requests in the detached document.
    text =
      new DOMParser().parseFromString(withoutTags.replaceAll('<', '&lt;'), 'text/html').body
        .textContent ?? '';
  } else {
    // The server-side fallback handles the XML/numeric entities used in API fixtures.
    text = withoutTags.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
      if (!entity.startsWith('#')) return entities[entity] ?? match;
      const code =
        entity[1].toLowerCase() === 'x'
          ? Number.parseInt(entity.slice(2), 16)
          : Number(entity.slice(1));
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code)
        : '�';
    });
  }
  return text.replace(/\s+/g, ' ').trim() || undefined;
}

function safeWebUrl(value: unknown): string | undefined {
  const text = creditText(value);
  if (!text) return undefined;
  try {
    const url = new URL(text.startsWith('//') ? `https:${text}` : text);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

type ImageInfoResponse = {
  query?: {
    pages?: {
      imageinfo?: {
        descriptionurl?: string;
        extmetadata?: Record<string, { value?: unknown }>;
      }[];
    }[];
  };
};

/**
 * One file, fetched only when its image is shown; readJson deduplicates concurrent requests.
 * https://www.mediawiki.org/wiki/API:Imageinfo
 * https://www.mediawiki.org/wiki/Extension:CommonsMetadata#Returned_data
 * Missing metadata never becomes an inferred author, licence, or public-domain declaration.
 */
export async function getCommonsImageCredit(
  image: string,
  locale: 'fr' | 'en' = 'fr',
): Promise<CommonsImageCredit | null> {
  const file = getCommonsFile(image);
  if (!file) return null;
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    prop: 'imageinfo',
    titles: file.title,
    redirects: '1',
    iilimit: '1',
    iiprop: 'url|extmetadata',
    iiextmetadatalanguage: locale,
    iiextmetadatafilter: 'Artist|Credit|Attribution|LicenseShortName|LicenseUrl|UsageTerms',
  });
  try {
    const response = await readJson<ImageInfoResponse>(
      `https://commons.wikimedia.org/w/api.php?${params}`,
    );
    const info = response.query?.pages?.[0]?.imageinfo?.[0];
    const metadata = info?.extmetadata;
    const canonicalFile = info?.descriptionurl ? getCommonsFile(info.descriptionurl) : null;
    return {
      ...file,
      creditUrl: canonicalFile?.creditUrl ?? file.creditUrl,
      author: creditText(metadata?.Artist?.value),
      credit: creditText(metadata?.Credit?.value),
      attribution: creditText(metadata?.Attribution?.value),
      license:
        creditText(metadata?.LicenseShortName?.value) ?? creditText(metadata?.UsageTerms?.value),
      licenseUrl: safeWebUrl(metadata?.LicenseUrl?.value),
    };
  } catch {
    // The file description remains immediately available, including offline/API-failure cases.
    return file;
  }
}
