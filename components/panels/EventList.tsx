'use client';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, LoaderCircle } from 'lucide-react';
import { useAtlasStore } from '@/lib/store';
import { useI18n, REGION_LABELS } from '@/lib/i18n';
import { getEventsInRange, readJson } from '@/lib/data-client';
import { formatYear } from '@/lib/histdate';
import { filterEvents, temporalWindow } from '@/lib/map-time';
import { openEvent } from '@/lib/navigation';
import type { HistoricalEvent } from '@/lib/schema';
import { EventIcon } from '../ui/EventIcon';

export default function EventList({ full = false }: { full?: boolean }) {
  const year = useAtlasStore((s) => s.year),
    range = useAtlasStore((s) => s.range),
    filters = useAtlasStore((s) => s.filters);
  const speed = useAtlasStore((s) => s.speed),
    playing = useAtlasStore((s) => s.playing),
    war = useAtlasStore((s) => s.selectedWar);
  const { locale, t } = useI18n();
  const [events, setEvents] = useState<HistoricalEvent[]>([]),
    [loading, setLoading] = useState(true),
    [failed, setFailed] = useState(false);
  const from = range?.[0] ?? year - temporalWindow(speed, playing),
    to = range?.[1] ?? year + temporalWindow(speed, playing);
  // Source partitions are decades after 1800, centuries before; never fetch a whole
  // modern century just to render one year, and never refetch on each playback frame.
  const firstCentury = Math.floor(from / (from >= 1800 ? 10 : 100)) * (from >= 1800 ? 10 : 100);
  const lastCentury = Math.floor(to / (to >= 1800 ? 10 : 100)) * (to >= 1800 ? 10 : 100);
  const lastBucketEnd = lastCentury + (lastCentury >= 1800 ? 9 : 99);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setFailed(false);
    setEvents([]);
    const request = war
      ? readJson<HistoricalEvent[]>(`/data/wars/${war}.json`)
      : getEventsInRange(firstCentury, lastBucketEnd);
    request
      .then((data) => {
        if (live) {
          setEvents(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (live) {
          setFailed(true);
          setLoading(false);
        }
      });
    return () => {
      live = false;
    };
  }, [firstCentury, lastBucketEnd, war]);
  const visible = useMemo(
    () =>
      filterEvents(events, {
        year,
        window: temporalWindow(speed, playing),
        ...filters,
        types: [...filters.types],
        regions: [...filters.regions],
        eras: [...filters.eras],
        range,
        // The war archive already includes validated descendants through campaigns.
        // Filtering again by the immediate parent would remove those indirect battles.
      }).sort((a, b) => b.importance - a.importance),
    [events, year, speed, playing, filters, range],
  );
  const [limit, setLimit] = useState(30);
  return (
    <section
      className={`event-list ${full ? 'event-list-full' : ''}`}
      aria-label={t('Événements de la période', 'Events in this period')}
    >
      <div className="section-heading">
        <h2>{t('Autour de cette année', 'Around this year')}</h2>
        <span className="count-badge" aria-live="polite">
          {visible.length}
        </span>
      </div>
      <p className="list-window">
        {formatYear(from, locale)} — {formatYear(to, locale)}
      </p>
      {loading && (
        <p className="loading-line">
          <LoaderCircle size={16} className="spin" />
          {t('Consultation des archives…', 'Opening the archives…')}
        </p>
      )}
      {failed && (
        <p className="empty-state">
          {t(
            'Les événements ne sont pas disponibles. Les frontières restent explorables.',
            'Events are unavailable. You can still explore the borders.',
          )}
        </p>
      )}
      {!loading && !failed && !visible.length && (
        <p className="empty-state">
          {t(
            'Aucun événement documenté pour ces filtres. Déplacez la frise ou élargissez la période.',
            'No documented events match these filters. Move the timeline or widen the period.',
          )}
        </p>
      )}
      <ol className="event-rows">
        {visible.slice(0, full ? limit : 6).map((event) => (
          <li key={event.id}>
            <button onClick={() => openEvent(event)} className="event-row">
              <span className={`event-type-icon type-${event.type}`}>
                <EventIcon type={event.type} />
              </span>
              <span className="event-row-copy">
                <strong>{event.name[locale] ?? event.name.en}</strong>
                <span>
                  {formatYear(event.start.year, locale)}
                  <span className="event-row-region">{REGION_LABELS[event.region]?.[locale]}</span>
                </span>
              </span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
      {full && visible.length > limit && (
        <button className="text-button" onClick={() => setLimit((value) => value + 30)}>
          {t('Afficher plus', 'Show more')}
        </button>
      )}
      {!full && visible.length > 6 && (
        <button
          className="text-button list-more"
          onClick={() => useAtlasStore.setState({ mode: 'list' })}
        >
          {t('Voir les', 'View all')} {visible.length} {t('événements', 'events')}
          <ArrowUpRight size={14} />
        </button>
      )}
    </section>
  );
}
