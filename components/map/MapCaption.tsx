'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { Info, X } from 'lucide-react';
import type { GeographyManifest } from '@/lib/geography';
import { formatYear } from '@/lib/histdate';
import { useI18n } from '@/lib/i18n';
import { mapReadingText } from '@/lib/i18n/map-reading';
import { boundaryPresentation } from '@/lib/map-boundaries';
import { withLocale } from '@/lib/navigation';
import { useAtlasStore } from '@/lib/store';
import styles from './MapCaption.module.css';

export default function MapCaption({ geo }: { geo: GeographyManifest | null }) {
  const year = useAtlasStore((s) => s.year);
  const range = useAtlasStore((s) => s.range);
  const projection = useAtlasStore((s) => s.projection);
  const camera = useAtlasStore((s) => s.camera);
  const boundarySource = useAtlasStore((s) => s.boundarySource);
  const { locale, t } = useI18n();
  const details = useRef<HTMLDetailsElement>(null);
  const text = (key: Parameters<typeof mapReadingText>[1]) => mapReadingText(locale, key);
  const presentation = geo ? boundaryPresentation(geo, year, boundarySource) : null;
  const dates = presentation?.years.map((value) => formatYear(value, locale)).join(' / ');
  const statusLabel = `${presentation ? text(presentation.status) : t('loading')}${dates ? ` · ${dates}` : ''}`;
  const source =
    presentation?.source === 'cliopatria'
      ? 'Cliopatria / Seshat'
      : presentation?.source === 'historical-basemaps'
        ? 'Historical Basemaps'
        : null;
  const close = () => {
    if (!details.current) return;
    details.current.open = false;
    details.current.querySelector('summary')?.focus();
  };

  return (
    <>
      <div className="map-coordinate">
        <span>
          {Math.abs(camera.lat).toFixed(1)}° {camera.lat >= 0 ? 'N' : 'S'} &nbsp;{' '}
          {Math.abs(camera.lon).toFixed(1)}° {camera.lon >= 0 ? 'E' : t('O', 'W')}
        </span>
        <span>{projection === 'globe' ? t('Vue globe', 'Globe view') : 'Mercator'}</span>
      </div>
      <div className={`map-attribution ${styles.attribution}`}>
        <details
          ref={details}
          className={styles.reading}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              close();
            }
          }}
        >
          <summary
            aria-label={`${statusLabel} · ${text('read')}`}
            title={text('read')}
            data-testid="map-reading-toggle"
          >
            <Info size={13} aria-hidden="true" />
            <span data-testid="boundary-status" data-status={presentation?.status}>
              {statusLabel}
            </span>
          </summary>
          <section className={styles.card} aria-label={text('read')} data-testid="map-reading">
            <header>
              <h2>{text('read')}</h2>
              <button type="button" className="icon-button" aria-label={t('close')} onClick={close}>
                <X size={16} aria-hidden="true" />
              </button>
            </header>
            <dl>
              <div>
                <dt>{text('selectedYear')}</dt>
                <dd>{formatYear(year, locale)}</dd>
              </div>
              <div>
                <dt>{text('displayedDates')}</dt>
                <dd>{dates || '—'}</dd>
              </div>
            </dl>
            {presentation?.status === 'transition' && (
              <p className={styles.notice}>{text('transitionNote')}</p>
            )}
            {(presentation?.status === 'latest' || presentation?.status === 'earliest') && (
              <p className={styles.notice}>{text('retainedNote')}</p>
            )}
            {presentation?.fallback && <p className={styles.notice}>{text('fallback')}</p>}
            {range && <p className={styles.notice}>{text('range')}</p>}
            <p>{text('coverage')}</p>
            <p>{text('selection')}</p>
            <p>{text('physical')}</p>
            <Link prefetch={false} href={withLocale('/about/', locale)}>
              {t('Comprendre les données', 'Understand the data')}
            </Link>
          </section>
        </details>
        <Link prefetch={false} href={withLocale('/about/', locale)}>
          {source && `${source} · `}Natural Earth
        </Link>
      </div>
    </>
  );
}
