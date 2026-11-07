import Link from 'next/link';
import { X } from 'lucide-react';
import { formatYear } from '@/lib/histdate';
import { useI18n } from '@/lib/i18n';
import { mapReadingText } from '@/lib/i18n/map-reading';
import { mapReadingNote } from '@/lib/i18n/map-reading-notes';
import type { boundaryPresentation } from '@/lib/map-boundaries';
import { withLocale } from '@/lib/navigation';
import { useAtlasStore } from '@/lib/store';
import styles from './MapCaption.module.css';

export default function MapReadingCard({
  dates,
  presentation,
  onClose,
}: {
  dates: string | undefined;
  presentation: ReturnType<typeof boundaryPresentation> | null;
  onClose: () => void;
}) {
  const year = useAtlasStore((s) => s.year);
  const range = useAtlasStore((s) => s.range);
  const { locale, t } = useI18n();
  const note = (key: Parameters<typeof mapReadingNote>[1]) => mapReadingNote(locale, key);
  const title = mapReadingText(locale, 'read');
  return (
    <section className={styles.card} aria-label={title} data-testid="map-reading">
      <header>
        <h2>{title}</h2>
        <button type="button" className="icon-button" aria-label={t('close')} onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <dl>
        <div>
          <dt>{note('selectedYear')}</dt>
          <dd>{formatYear(year, locale)}</dd>
        </div>
        <div>
          <dt>{note('displayedDates')}</dt>
          <dd>{dates || '—'}</dd>
        </div>
      </dl>
      {presentation?.status === 'transition' && (
        <p className={styles.notice}>{note('transitionNote')}</p>
      )}
      {(presentation?.status === 'latest' || presentation?.status === 'earliest') && (
        <p className={styles.notice}>{note('retainedNote')}</p>
      )}
      {presentation?.fallback && <p className={styles.notice}>{note('fallback')}</p>}
      {range && <p className={styles.notice}>{note('range')}</p>}
      <p>{note('coverage')}</p>
      <p>{note('selection')}</p>
      <p>{note('physical')}</p>
      <Link prefetch={false} href={withLocale('/about/', locale)}>
        {t('Comprendre les données', 'Understand the data')}
      </Link>
    </section>
  );
}
