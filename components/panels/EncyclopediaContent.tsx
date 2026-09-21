'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { getWikipediaSummary, type WikiSummary } from '@/lib/data-client';
import { getCommonsImageCredit, type CommonsImageCredit } from '@/lib/data-client/image-credit';
import { localizedName } from '@/lib/i18n';
import type { HistoricalEvent } from '@/lib/schema';
import type { Locale } from '@/lib/types';

function imageCreditUrl(image: string): string {
  try {
    const url = new URL(image);
    if (url.hostname === 'commons.wikimedia.org' && /Special:FilePath\//.test(url.pathname)) {
      return `https://commons.wikimedia.org/wiki/File:${url.pathname.split('Special:FilePath/')[1]}`;
    }
    if (url.hostname === 'upload.wikimedia.org') {
      const segments = url.pathname.split('/');
      const name = segments.includes('thumb') ? segments.at(-2) : segments.at(-1);
      const repository = segments[2];
      if (name && segments[1] === 'wikipedia') {
        if (repository === 'commons') return `https://commons.wikimedia.org/wiki/File:${name}`;
        if (/^[a-z][a-z-]*$/.test(repository))
          return `https://${repository}.wikipedia.org/wiki/File:${name}`;
      }
    }
    return image;
  } catch {
    return image;
  }
}

function ImageCredits({ image, locale }: { image: string; locale: Locale }) {
  const [credit, setCredit] = useState<CommonsImageCredit | null>(null);
  useEffect(() => {
    let active = true;
    getCommonsImageCredit(image, locale).then((result) => {
      if (active) setCredit(result);
    });
    return () => {
      active = false;
    };
  }, [image, locale]);
  const attribution =
    credit?.attribution ??
    [...new Set([credit?.author, credit?.credit].filter(Boolean))].join(' · ');
  const source = credit?.creditUrl ?? imageCreditUrl(image);
  return (
    <figcaption>
      {attribution && (
        <span>
          {attribution}
          {' · '}
        </span>
      )}
      {credit?.license && (
        <>
          <a href={credit.licenseUrl ?? source} target="_blank" rel="noreferrer">
            {credit.license}
          </a>
          {' · '}
        </>
      )}
      <a href={source} target="_blank" rel="noreferrer">
        {locale === 'fr'
          ? 'Image : source, crédits et licence'
          : 'Image: source, credits and license'}{' '}
        <ArrowUpRight size={10} />
      </a>
    </figcaption>
  );
}

export default function EncyclopediaContent({
  subject: event,
  locale,
}: {
  subject: Pick<HistoricalEvent, 'name' | 'sources' | 'wikipedia' | 'summary' | 'image'>;
  locale: Locale;
}) {
  const [summary, setSummary] = useState<WikiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    getWikipediaSummary(event, locale)
      .then((result) => {
        if (active) {
          setSummary(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [event, locale]);
  const text = summary?.text ?? event.summary?.[locale] ?? event.summary?.en ?? event.summary?.fr;
  const textLanguage =
    summary?.language ?? (event.summary?.[locale] ? locale : event.summary?.en ? 'en' : 'fr');
  const articleUrl = summary?.url ?? event.wikipedia?.[textLanguage as 'fr' | 'en'];
  const image = summary?.image ?? event.image;
  return (
    <>
      {image && (
        <figure className="detail-image">
          {/* Remote image dimensions and hosts are source-dependent; a native lazy image keeps the static export independent of an image server. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={
              summary?.imageDescription ??
              (locale === 'fr'
                ? `Illustration associée à ${localizedName(event.name, locale)}`
                : `Illustration associated with ${localizedName(event.name, locale)}`)
            }
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
          <ImageCredits key={`${image}-${locale}`} image={image} locale={locale} />
        </figure>
      )}
      {text ? (
        <section className="detail-section">
          <h3>{locale === 'fr' ? 'En quelques mots' : 'In context'}</h3>
          <p className="detail-summary" lang={textLanguage}>
            {text}
          </p>
          {articleUrl && (
            <p className="detail-attribution">
              <a href={articleUrl} target="_blank" rel="noreferrer">
                {locale === 'fr' ? 'Wikipédia' : 'Wikipedia'}
                {textLanguage !== locale ? ` (${textLanguage.toUpperCase()})` : ''}
              </a>
              {' · '}
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                target="_blank"
                rel="noreferrer"
              >
                CC BY-SA
              </a>
            </p>
          )}
        </section>
      ) : loading ? (
        <p className="detail-summary-loading" role="status">
          {locale === 'fr' ? 'Lecture du résumé Wikipédia…' : 'Loading the Wikipedia summary…'}
        </p>
      ) : (
        <p className="notice">
          {locale === 'fr'
            ? 'Résumé indisponible. Les sources ci-dessous permettent de poursuivre la lecture.'
            : 'Summary unavailable. The sources below provide further information.'}
        </p>
      )}
    </>
  );
}
