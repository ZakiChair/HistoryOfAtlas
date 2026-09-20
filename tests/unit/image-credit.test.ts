import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { creditText, getCommonsFile } from '../../lib/data-client/image-credit';

// URL/parser fixtures only; they are never added to the historical corpus.
const original = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Illustration_%C3%A9tude.svg';
const thumbnail =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Illustration_%C3%A9tude.svg/960px-Illustration_%C3%A9tude.svg.png';
const description = 'https://commons.wikimedia.org/wiki/File:Illustration_%C3%A9tude.svg';

describe('Commons image provenance URLs', () => {
  it.each([
    original,
    thumbnail,
    'http://commons.wikimedia.org/wiki/Special:FilePath/Illustration%20%C3%A9tude.svg?width=640',
    description,
    'https://commons.wikimedia.org/wiki/Special:Redirect/file/Illustration_%C3%A9tude.svg',
    'https://commons.wikimedia.org/w/index.php?title=File%3AIllustration_%C3%A9tude.svg',
    '//upload.wikimedia.org/wikipedia/commons/a/ab/Illustration_%C3%A9tude.svg',
  ])('extracts the original file, including converted thumbnails: %s', (image) => {
    expect(getCommonsFile(image)).toEqual({
      filename: 'Illustration étude.svg',
      title: 'File:Illustration étude.svg',
      creditUrl: description,
    });
  });
  it.each([
    'https://upload.wikimedia.org/wikipedia/en/a/ab/Local_file.jpg',
    'https://upload.wikimedia.org/wikipedia/fr/thumb/a/ab/Local_file.jpg/640px-Local_file.jpg',
    'https://upload.wikimedia.org.example.com/wikipedia/commons/a/ab/Image.jpg',
    'https://commons.wikimedia.org@example.com/wiki/File:Image.jpg',
    'https://example.com/Image.jpg',
    '/wiki/File:Image.jpg',
    'javascript:alert(1)',
    'https://commons.wikimedia.org/wiki/Special:FilePath/%ZZ',
    'https://commons.wikimedia.org/wiki/File:One.jpg%7CFile:Two.jpg',
  ])('does not assign Commons provenance to invalid or different repositories: %s', (image) => {
    expect(getCommonsFile(image)).toBeNull();
  });
  it('preserves percent signs in filenames without decoding twice', () => {
    expect(
      getCommonsFile('https://commons.wikimedia.org/wiki/Special:FilePath/100%25%20original.jpg')
        ?.filename,
    ).toBe('100% original.jpg');
  });
  it('extracts plain text without scripts, styles, markup or collapsed author names', () => {
    expect(
      creditText(
        '<a href="/wiki/User:Creator">Named creator</a><br/>Second &#233;dition &amp; archive<script>unwanted()</script><style>bad</style>',
      ),
    ).toBe('Named creator Second édition & archive');
    expect(creditText(null)).toBeUndefined();
    expect(creditText('<span> </span>')).toBeUndefined();
  });
});

describe('on-demand image credits', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it('requests one current file, shares duplicate requests, and returns attributed text', async () => {
    const fetchMock = vi.fn<(input: string) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            query: {
              pages: [
                {
                  imageinfo: [
                    {
                      descriptionurl: description,
                      user: 'Uploader is not the author',
                      extmetadata: {
                        Artist: { value: '<b>Named creator</b>' },
                        Credit: { value: 'Museum &amp; archive' },
                        Attribution: { value: 'Custom <i>credit line</i>' },
                        LicenseShortName: { value: 'CC BY-SA 4.0' },
                        LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' },
                      },
                    },
                  ],
                },
              ],
            },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { getCommonsImageCredit } = await import('../../lib/data-client/image-credit');
    const results = await Promise.all([
      getCommonsImageCredit(original, 'fr'),
      getCommonsImageCredit(thumbnail, 'fr'),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin).toBe('https://commons.wikimedia.org');
    expect(url.searchParams.get('titles')).toBe('File:Illustration étude.svg');
    expect(url.searchParams.get('iilimit')).toBe('1');
    expect(url.searchParams.get('iiprop')).toBe('url|extmetadata');
    expect(url.searchParams.get('iiextmetadatalanguage')).toBe('fr');
    expect(results[0]).toMatchObject({
      author: 'Named creator',
      credit: 'Museum & archive',
      attribution: 'Custom credit line',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      creditUrl: description,
    });
    expect(results[1]).toEqual(results[0]);
  });

  it('keeps the file link on failures and retries without inventing an author or licence', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ query: { pages: [{ missing: true }] } })),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { getCommonsImageCredit } = await import('../../lib/data-client/image-credit');
    const failed = await getCommonsImageCredit(original);
    expect(failed).toEqual(getCommonsFile(original));
    const missing = await getCommonsImageCredit(original);
    expect(missing?.creditUrl).toBe(description);
    expect(missing?.author).toBeUndefined();
    expect(missing?.license).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refuses unsafe licence links and never uses the uploader as an author', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              query: {
                pages: [
                  {
                    imageinfo: [
                      {
                        descriptionurl: 'javascript:alert(1)',
                        user: 'Uploader',
                        extmetadata: {
                          LicenseUrl: { value: 'javascript:alert(1)' },
                          UsageTerms: { value: 'Terms supplied by the source' },
                        },
                      },
                    ],
                  },
                ],
              },
            }),
          ),
      ),
    );
    const { getCommonsImageCredit } = await import('../../lib/data-client/image-credit');
    expect(await getCommonsImageCredit(original)).toMatchObject({
      creditUrl: description,
      license: 'Terms supplied by the source',
      author: undefined,
      licenseUrl: undefined,
    });
  });

  it('does not issue a Commons request for a local Wikipedia image', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { getCommonsImageCredit } = await import('../../lib/data-client/image-credit');
    expect(
      await getCommonsImageCredit('https://upload.wikimedia.org/wikipedia/en/a/ab/Local_file.jpg'),
    ).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
