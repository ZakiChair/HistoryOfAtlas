'use client';
import { useEffect, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useAtlasStore } from '@/lib/store';
import { useI18n, EVENT_TYPE_LABELS, REGION_LABELS } from '@/lib/i18n';
import { EVENT_TYPES, REGION_IDS } from '@/lib/types';
import { ERAS } from '@/lib/eras';
import { getEventsInRange } from '@/lib/data-client';
import { temporalWindow } from '@/lib/map-time';
import { isEventLayerVisible } from '@/lib/event-visibility';
import type { HistoricalEvent } from '@/lib/schema';
import { EventIcon, EventSwatch } from '../ui/EventIcon';

export default function Filters() {
  const filters = useAtlasStore((s) => s.filters),
    setFilters = useAtlasStore((s) => s.setFilters);
  const year = useAtlasStore((s) => s.year),
    range = useAtlasStore((s) => s.range);
  const speed = useAtlasStore((s) => s.speed),
    playing = useAtlasStore((s) => s.playing);
  const battlesVisible = useAtlasStore((s) => s.battlesVisible);
  const { locale, t } = useI18n();
  const [events, setEvents] = useState<HistoricalEvent[]>([]);
  const [participantsStatus, setParticipantsStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const from = range?.[0] ?? year - temporalWindow(speed, playing),
    to = range?.[1] ?? year + temporalWindow(speed, playing);
  const firstBucket = Math.floor(from / (from >= 1800 ? 10 : 100)) * (from >= 1800 ? 10 : 100);
  const lastBucket = Math.floor(to / (to >= 1800 ? 10 : 100)) * (to >= 1800 ? 10 : 100);
  const lastBucketEnd = lastBucket + (lastBucket >= 1800 ? 9 : 99);
  useEffect(() => {
    let active = true;
    setParticipantsStatus('loading');
    getEventsInRange(firstBucket, lastBucketEnd)
      .then((data) => {
        if (active) {
          setEvents(data);
          setParticipantsStatus('ready');
        }
      })
      .catch(() => {
        if (active) setParticipantsStatus('error');
      });
    return () => {
      active = false;
    };
  }, [firstBucket, lastBucketEnd]);
  const participants = useMemo(() => {
    const names = new Map<string, string>();
    for (const event of events) {
      if (!isEventLayerVisible(event.type, battlesVisible)) continue;
      if (event.start.year > to || (event.end?.year ?? event.start.year) < from) continue;
      for (const participant of event.belligerents) {
        const existing = names.get(participant.entityId);
        if (!existing || existing === participant.entityId)
          names.set(participant.entityId, participant.name);
      }
    }
    return [...names].sort((a, b) => a[1].localeCompare(b[1], locale));
  }, [events, from, to, locale, battlesVisible]);
  return (
    <section className="filters-panel" aria-label={t('Filtres', 'Filters')}>
      <div className="section-heading">
        <h2>{t('Affiner l’exploration', 'Refine your exploration')}</h2>
        <button
          className="icon-button"
          aria-label={t('Réinitialiser les filtres', 'Reset filters')}
          onClick={() => useAtlasStore.getState().resetFilters()}
        >
          <RotateCcw size={16} />
        </button>
      </div>
      <fieldset>
        <legend>{t('Type d’événement', 'Event type')}</legend>
        <div className="type-filters">
          {EVENT_TYPES.map((type) => (
            <button
              key={type}
              aria-pressed={filters.types.includes(type)}
              onClick={() =>
                setFilters({
                  types: filters.types.includes(type)
                    ? filters.types.filter((item) => item !== type)
                    : [...filters.types, type],
                })
              }
            >
              <EventSwatch type={type} />
              <EventIcon type={type} />
              <span>{EVENT_TYPE_LABELS[type][locale]}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <label className="field-label">
        {t('Région du monde', 'World region')}
        <select
          value={filters.regions[0] ?? ''}
          onChange={(event) =>
            setFilters({
              regions: event.target.value
                ? [event.target.value as (typeof REGION_IDS)[number]]
                : [],
            })
          }
        >
          <option value="">{t('Toutes les régions', 'All regions')}</option>
          {REGION_IDS.map((region) => (
            <option key={region} value={region}>
              {REGION_LABELS[region][locale]}
            </option>
          ))}
        </select>
      </label>
      <label className="field-label">
        {t('Période', 'Era')}
        <select
          value={filters.eras[0] ?? ''}
          onChange={(event) =>
            setFilters({
              eras: event.target.value ? [event.target.value as (typeof ERAS)[number]['id']] : [],
            })
          }
        >
          <option value="">{t('Toutes les époques', 'All eras')}</option>
          {ERAS.map((era) => (
            <option key={era.id} value={era.id}>
              {era.name[locale]}
            </option>
          ))}
        </select>
      </label>
      <label className="field-label">
        {t('Entité impliquée', 'Participant')}
        <select
          value={filters.entity ?? ''}
          aria-describedby="participant-filter-note"
          onChange={(event) => setFilters({ entity: event.target.value || null })}
        >
          <option value="">{t('Tous les participants', 'All participants')}</option>
          {filters.entity && !participants.some(([id]) => id === filters.entity) && (
            <option value={filters.entity}>{filters.entity}</option>
          )}
          {participants.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <p className="detail-precision" id="participant-filter-note" role="status">
        {participantsStatus === 'loading'
          ? t('Lecture des participants…', 'Loading participants…')
          : participantsStatus === 'error'
            ? t(
                'La liste des participants n’a pas pu être chargée.',
                'The participant list could not be loaded.',
              )
            : t(
                'Participants documentés dans la période affichée.',
                'Documented participants in the displayed period.',
              )}
      </p>
      <label className="field-label">
        {t('Importance minimale', 'Minimum importance')}
        <span className="range-value">{filters.minImportance} / 100</span>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={filters.minImportance}
          onChange={(event) => setFilters({ minImportance: Number(event.target.value) })}
        />
      </label>
      {filters.entity && (
        <p className="filter-active">
          {t('Entité sélectionnée', 'Selected entity')} : {filters.entity}
          <button className="text-button" onClick={() => setFilters({ entity: null })}>
            {t('Retirer', 'Remove')}
          </button>
        </p>
      )}
    </section>
  );
}
