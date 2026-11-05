'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Info } from 'lucide-react';
import type { GeographyManifest } from '@/lib/geography';
import { formatYear } from '@/lib/histdate';
import { useI18n } from '@/lib/i18n';
import { mapReadingText } from '@/lib/i18n/map-reading';
import { boundaryPresentation } from '@/lib/map-boundaries';
import { withLocale } from '@/lib/navigation';
import { useAtlasStore } from '@/lib/store';
import SectionBoundary from '../ui/SectionBoundary';
import styles from './MapCaption.module.css';

const MapReadingCard = dynamic(() => import('./MapReadingCard'), { ssr: false });

export default function MapCaption({
  geo,
  failed,
}: {
  geo: GeographyManifest | null;
  /** The manifest could not be read: no boundary is drawn and none is on its way. */
  failed: boolean;
}) {
  const year = useAtlasStore((s) => s.year);
  const projection = useAtlasStore((s) => s.projection);
  const camera = useAtlasStore((s) => s.camera);
  const boundarySource = useAtlasStore((s) => s.boundarySource);
  const { locale, t } = useI18n();
  const details = useRef<HTMLDetailsElement>(null);
  const [opened, setOpened] = useState(false);
  const text = (key: Parameters<typeof mapReadingText>[1]) => mapReadingText(locale, key);
  const presentation = geo ? boundaryPresentation(geo, year, boundarySource) : null;
  const dates = presentation?.years.map((value) => formatYear(value, locale)).join(' / ');
  const status = presentation?.status ?? (failed ? 'unavailable' : undefined);
  const statusLabel = `${status ? text(status) : t('loading')}${dates ? ` · ${dates}` : ''}`;
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
          onToggle={(event) => {
            if (event.currentTarget.open) setOpened(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && event.currentTarget.open) {
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
            <span data-testid="boundary-status" data-status={status}>
              {statusLabel}
            </span>
          </summary>
          {opened && (
            <SectionBoundary area="detail">
              <MapReadingCard dates={dates} presentation={presentation} onClose={close} />
            </SectionBoundary>
          )}
        </details>
        <Link prefetch={false} href={withLocale('/about/', locale)}>
          {source && `${source} · `}Natural Earth
        </Link>
      </div>
    </>
  );
}
