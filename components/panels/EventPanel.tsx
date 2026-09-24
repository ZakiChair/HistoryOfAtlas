'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Anchor,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleAlert,
  Flag,
  Link as LinkIcon,
  MapPin,
  Route,
  ScrollText,
  Shield,
  Swords,
  X,
} from 'lucide-react';
import { getEvent } from '@/lib/data-client';
import { useJson } from '@/lib/data-client/hooks';
import { compareHistDates, formatDateRange, formatYear } from '@/lib/histdate';
import {
  EVENT_TYPE_LABELS,
  PRECISION_LABELS,
  localizedName,
  useI18n,
  translateCopy,
} from '@/lib/i18n';
import { openEvent, withLocale } from '@/lib/navigation';
import {
  errorReportUrl,
  getEventMapUrl,
  getEventPermalink,
  hasStaticEventPage,
  siteOrigin,
} from '@/lib/seo';
import { serializeAtlasUrl, useAtlasStore } from '@/lib/store';
import type { HistoricalEvent } from '@/lib/schema';
import type { Locale } from '@/lib/types';
import EventSources from './EventSources';
import EncyclopediaContent from './EncyclopediaContent';
import EventPeople from './EventPeople';
import { focusBattle } from '@/lib/battles/navigation';
import { battleText } from '@/lib/battles/i18n';
import { loadDocumentedBattles, peekDocumentedBattles } from '@/lib/battles/documented-client';

const TYPE_ICONS = {
  battle: Swords,
  siege: Shield,
  naval: Anchor,
  war: Flag,
  campaign: Route,
  treaty: ScrollText,
  conquest: Flag,
};

function WarNavigation({ event, locale }: { event: HistoricalEvent; locale: Locale }) {
  const warId = event.parentWar ?? (event.type === 'war' ? event.id : null);
  const { data: catalog } = useJson<{ id: string; name: HistoricalEvent['name']; path: string }[]>(
    warId ? '/data/wars.json' : null,
  );
  const parent = catalog?.find((entry) => entry.id === warId);
  const { data: siblings } = useJson<HistoricalEvent[]>(parent?.path ?? null);
  const [navigationError, setNavigationError] = useState(false);
  if (!warId || !parent) return null;
  const ordered = siblings ? [...siblings].sort((a, b) => compareHistDates(a.start, b.start)) : [];
  const index = ordered.findIndex((item) => item.id === event.id);
  const previous = index > 0 ? ordered[index - 1] : undefined;
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : undefined;
  const timelineStart = Math.max(0, Math.min(ordered.length - 9, index - 4));
  const timelineEvents = ordered.slice(timelineStart, timelineStart + 9);

  async function navigate(target: HistoricalEvent) {
    setNavigationError(false);
    try {
      openEvent(await getEvent(target.id), { preserveContext: true });
    } catch {
      openEvent(target, { preserveContext: true });
    }
  }

  function showWar() {
    const state = useAtlasStore.getState();
    state.selectWar(warId);
    state.setPlaying(false);
    if (!ordered.length) {
      setNavigationError(true);
      return;
    }
    const first = ordered[0]!;
    const lastYear = Math.max(...ordered.map((item) => item.end?.year ?? item.start.year));
    const points = ordered.flatMap((item) => (item.coords ? [item.coords] : []));
    let camera = state.camera;
    if (points.length) {
      const lons = points.map((point) => point[0]);
      const lats = points.map((point) => point[1]);
      const width = Math.max(...lons) - Math.min(...lons);
      const height = Math.max(...lats) - Math.min(...lats);
      camera = {
        ...state.camera,
        lon: (Math.min(...lons) + Math.max(...lons)) / 2,
        lat: (Math.min(...lats) + Math.max(...lats)) / 2,
        zoom: Math.max(1.3, Math.min(6, Math.log2(300 / Math.max(width, height, 1)))),
        bearing: 0,
        pitch: 0,
      };
    }
    state.patchState({
      year: first.start.year,
      range: [first.start.year, lastYear],
      camera,
      mode: 'events',
      projection: 'mercator',
      campaignId: null,
      storyId: null,
    });
  }

  return (
    <section className="detail-section detail-war">
      <h3>{translateCopy(locale, 'Dans le même conflit', 'Within this conflict')}</h3>
      <button className="text-button detail-parent" onClick={showWar}>
        {parent
          ? localizedName(parent.name, locale)
          : event.type === 'war'
            ? localizedName(event.name, locale)
            : warId}
        <ArrowUpRight size={14} />
      </button>
      {timelineEvents.length > 1 && (
        <div
          className="war-mini-timeline"
          role="group"
          aria-label={translateCopy(locale, 'Chronologie du conflit', 'Conflict timeline')}
        >
          {timelineEvents.map((item) => (
            <button
              key={item.id}
              className={item.id === event.id ? 'current' : ''}
              aria-current={item.id === event.id ? 'step' : undefined}
              title={localizedName(item.name, locale)}
              aria-label={`${localizedName(item.name, locale)}, ${formatYear(item.start.year, locale)}`}
              onClick={() => void navigate(item)}
            >
              <span className="war-timeline-dot" aria-hidden="true" />
              <time>{formatYear(item.start.year, locale)}</time>
            </button>
          ))}
        </div>
      )}
      <div className="detail-war-navigation">
        <button
          className="secondary-button"
          disabled={!previous}
          onClick={() => previous && void navigate(previous)}
          title={previous ? localizedName(previous.name, locale) : undefined}
        >
          <ArrowLeft size={13} />
          {translateCopy(locale, 'Précédent', 'Previous')}
        </button>
        <button
          className="secondary-button"
          disabled={!next}
          onClick={() => next && void navigate(next)}
          title={next ? localizedName(next.name, locale) : undefined}
        >
          {translateCopy(locale, 'Suivant', 'Next')}
          <ArrowRight size={13} />
        </button>
      </div>
      <button className="primary-button" onClick={showWar}>
        <Route size={14} />
        {translateCopy(locale, 'Voir tout le conflit', 'View the whole conflict')}
        {ordered.length > 0 && <span>{ordered.length}</span>}
      </button>
      {navigationError && (
        <p className="notice" role="status">
          {translateCopy(
            locale,
            'La chronologie détaillée de ce conflit n’est pas disponible dans ce corpus.',
            'A detailed chronology of this conflict is not available in this corpus.',
          )}
        </p>
      )}
    </section>
  );
}

/** Names the 3D scene for what it is: sourced forces, or an illustration with unknown forces. */
function BattleSceneButton({ event, locale }: { event: HistoricalEvent; locale: Locale }) {
  // Synchronous once any dossier has loaded the list, so the label never changes after paint.
  const [ids, setIds] = useState(peekDocumentedBattles);
  useEffect(() => {
    if (ids) return;
    let live = true;
    loadDocumentedBattles().then(
      (next) => {
        if (live) setIds(next);
      },
      () => {
        /* Unknown stays neutral: never mislabel a sourced scene, never hide the 3D entry. */
      },
    );
    return () => {
      live = false;
    };
  }, [ids]);
  const documented = ids ? ids.has(event.id) : null;
  return (
    <button
      className={`${documented ? 'primary-button' : 'secondary-button'} event-battle-button`}
      data-testid="event-battle-button"
      data-documented={documented ?? undefined}
      onClick={() => focusBattle(event)}
    >
      <Swords size={16} aria-hidden="true" />
      {battleText(
        locale,
        documented === null ? 'view' : documented ? 'viewSourced' : 'viewIllustrative',
      )}
    </button>
  );
}

function EventDetail({ event }: { event: HistoricalEvent }) {
  const { locale, t } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const [shareUrl, setShareUrl] = useState('');
  const [shareKind, setShareKind] = useState<'record' | 'view'>('record');
  const Icon = TYPE_ICONS[event.type];
  const name = localizedName(event.name, locale);
  const titleLanguage =
    locale !== 'en' && event.name[locale] ? locale : (event.nameLanguage ?? 'en');
  let originalLanguage = event.nameLanguage;
  if (originalLanguage) {
    try {
      originalLanguage =
        new Intl.DisplayNames([locale], { type: 'language' }).of(originalLanguage) ??
        originalLanguage;
    } catch {
      /* Preserve the source language code when Intl does not recognize it. */
    }
  }
  const date = formatDateRange(event.start, event.end, locale, {
    precision: event.datePrecision,
    approximate: event.dateApproximate,
    calendar: event.calendar,
    showCalendar: Boolean(event.calendar && (event.start.day || event.start.month)),
  });
  const groups = (['A', 'B', 'other'] as const)
    .map((side) => ({ side, members: event.belligerents.filter((member) => member.side === side) }))
    .filter((group) => group.members.length > 0);

  /** The record link opens its archive page and illustrated preview; a view link restores everything. */
  const recordPath = hasStaticEventPage(event)
    ? `/event/${event.id}/`
    : withLocale(getEventMapUrl(event), locale);
  const reportUrl = errorReportUrl({
    name: event.name.en || name,
    id: event.id,
    kind: 'event',
    year: event.start.year,
    url: `${siteOrigin()}${getEventPermalink(event)}`,
  });
  async function share(kind: 'record' | 'view') {
    const path =
      kind === 'record'
        ? recordPath
        : `${window.location.pathname}${serializeAtlasUrl(useAtlasStore.getState())}`;
    const url = `${window.location.origin}${path}`;
    setShareKind(kind);
    setShareUrl(url);
    try {
      await navigator.clipboard.writeText(url);
      setShareState('copied');
    } catch {
      setShareState('manual');
    }
  }

  return (
    <>
      <header className="panel-header">
        <div className="detail-kicker">
          <Icon size={15} />
          {EVENT_TYPE_LABELS[event.type][locale]}
          <span>·</span>
          <a href={`https://www.wikidata.org/wiki/${event.id}`} target="_blank" rel="noreferrer">
            {event.id}
          </a>
        </div>
        <button
          className="icon-button"
          aria-label={t('close')}
          onClick={() => useAtlasStore.getState().selectEvent(null)}
        >
          <X size={18} />
        </button>
      </header>
      <div className="panel-body">
        <h2
          ref={heading}
          tabIndex={-1}
          className="detail-title"
          id="event-panel-title"
          lang={titleLanguage}
          dir="auto"
        >
          {name}
        </h2>
        {originalLanguage && (
          <p className="badge">
            {t('Intitulé d’origine', 'Original title')} : {originalLanguage}
          </p>
        )}
        <div className="detail-meta">
          <CalendarDays size={14} />
          <span>{date}</span>
        </div>
        <div className="detail-precision">
          {t('Précision', 'Precision')} : {PRECISION_LABELS[event.datePrecision][locale]}
        </div>
        {(['battle', 'siege', 'naval'] as string[]).includes(event.type) && event.coords && (
          <BattleSceneButton event={event} locale={locale} />
        )}
        {(event.place?.name || event.coords) && (
          <div className="detail-meta">
            <MapPin size={14} />
            <span>
              {event.place?.name ??
                event.coords
                  ?.map(
                    (coordinate, index) =>
                      `${Math.abs(coordinate).toFixed(3)}° ${index === 0 ? (coordinate < 0 ? t('O', 'W') : 'E') : coordinate < 0 ? 'S' : 'N'}`,
                  )
                  .reverse()
                  .join(' · ')}
            </span>
          </div>
        )}
        {event.coordinateSource?.kind === 'place' && (
          <p className="detail-precision">
            <a href={event.coordinateSource.url} target="_blank" rel="noreferrer">
              {t(
                'Localisation du lieu associé à l’événement',
                'Location of the place associated with the event',
              )}
              <ArrowUpRight size={10} />
            </a>
          </p>
        )}
        {event.disputed && (
          <p className="badge badge-warning">
            <CircleAlert size={13} />
            {t('Plusieurs dates ou lieux dans la source', 'Multiple source dates or locations')}
          </p>
        )}
        {(event.description?.[locale] ?? event.description?.en ?? event.description?.fr) && (
          <div className="detail-description">
            <p lang={event.description?.[locale] ? locale : event.description?.en ? 'en' : 'fr'}>
              {event.description?.[locale] ?? event.description?.en ?? event.description?.fr}
            </p>
            <a href={event.sources[0].url} target="_blank" rel="noreferrer">
              Wikidata · CC0 <ArrowUpRight size={10} />
            </a>
          </div>
        )}
        <EncyclopediaContent key={`${event.id}-${locale}`} subject={event} locale={locale} />
        {event.people && <EventPeople people={event.people} participants={event.belligerents} />}
        {groups.length > 0 && (
          <section className="detail-section">
            <h3>{t('Belligérants documentés', 'Documented participants')}</h3>
            <div className="belligerents">
              {groups.map((group) => (
                <div className={`belligerent-side belligerent-side-${group.side}`} key={group.side}>
                  <span className="detail-kicker">
                    {group.side === 'other'
                      ? t('Participants', 'Participants')
                      : `${t('Camp', 'Side')} ${group.side}`}
                  </span>
                  <ul>
                    {group.members.map((member) => (
                      <li key={`${group.side}-${member.entityId}`}>
                        <a
                          href={`https://www.wikidata.org/wiki/${member.entityId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {member.name}
                          <ArrowUpRight size={10} />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {groups.some((group) => group.side === 'other') && (
              <p className="detail-precision">
                {t(
                  'Les alliances ne sont pas précisées par la source.',
                  'Alliances are not specified by the source.',
                )}
              </p>
            )}
          </section>
        )}
        {(event.outcome ||
          event.victor ||
          event.strength !== undefined ||
          event.casualties !== undefined ||
          event.deaths !== undefined) && (
          <section className="detail-section">
            <h3>{t('Issue et effectifs', 'Outcome and forces')}</h3>
            <dl className="detail-facts">
              {event.outcome && (
                <div>
                  <dt>{t('Issue', 'Outcome')}</dt>
                  <dd>{event.outcome}</dd>
                </div>
              )}
              {event.victor && (
                <div>
                  <dt>{t('Vainqueur indiqué', 'Recorded victor')}</dt>
                  <dd>
                    {/^Q\d+$/.test(event.victor) ? (
                      <a
                        href={`https://www.wikidata.org/wiki/${event.victor}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {event.victor}
                      </a>
                    ) : (
                      event.victor
                    )}
                  </dd>
                </div>
              )}
              {event.strength !== undefined && (
                <div>
                  <dt>{t('Effectifs rapportés', 'Reported forces')}</dt>
                  <dd>{event.strength.toLocaleString(locale)}</dd>
                </div>
              )}
              {event.casualties !== undefined && (
                <div>
                  <dt>{t('Pertes rapportées', 'Reported casualties')}</dt>
                  <dd>{event.casualties.toLocaleString(locale)}</dd>
                </div>
              )}
              {event.deaths !== undefined && (
                <div>
                  <dt>{t('Morts rapportés', 'Reported deaths')}</dt>
                  <dd>{event.deaths.toLocaleString(locale)}</dd>
                </div>
              )}
            </dl>
          </section>
        )}
        <WarNavigation key={event.id} event={event} locale={locale} />
        <EventSources sources={event.sources} locale={locale} />
        <p className="detail-precision">
          {t('Importance cartographique', 'Map display importance')} :{' '}
          {Math.round(event.importance)}/100 ·{' '}
          <a href={withLocale('/about/', locale)}>{t('Méthode de calcul', 'Scoring method')}</a>
        </p>
        <p className="detail-precision">
          <a href={reportUrl} target="_blank" rel="noreferrer" data-testid="event-report-error">
            {t('Signaler une erreur', 'Report an error')}
            <span className="sr-only">{t(' (GitHub, nouvel onglet)', ' (GitHub, new tab)')}</span>
            <ArrowUpRight size={11} aria-hidden="true" />
          </a>
        </p>
      </div>
      <footer className="panel-footer">
        <button className="secondary-button" onClick={() => void share('record')}>
          {shareState === 'copied' && shareKind === 'record' ? (
            <Check size={14} />
          ) : (
            <LinkIcon size={14} />
          )}
          {shareState === 'copied' && shareKind === 'record'
            ? t('Lien copié', 'Link copied')
            : t('Partager cette fiche', 'Share this record')}
        </button>
        <button className="text-button" onClick={() => void share('view')}>
          {shareState === 'copied' && shareKind === 'view'
            ? t('Vue copiée', 'View copied')
            : t('Copier cette vue exacte', 'Copy this exact view')}
        </button>
        <a className="text-button" href={withLocale(getEventPermalink(event), locale)}>
          {t('Fiche permanente', 'Permanent page')}
          <ArrowUpRight size={14} />
        </a>
        <span role="status" className="sr-only">
          {shareState === 'copied'
            ? t(
                'Le lien a été copié dans le presse-papiers.',
                'The link was copied to the clipboard.',
              )
            : ''}
        </span>
        {shareState === 'manual' && (
          <input
            aria-label={t('Lien à copier', 'Link to copy')}
            readOnly
            value={shareUrl}
            onFocus={(event) => event.currentTarget.select()}
          />
        )}
      </footer>
    </>
  );
}

export default function EventPanel() {
  const { t } = useI18n();
  const selectedEvent = useAtlasStore((state) => state.selectedEvent);
  const { data, loading, error } = useJson<HistoricalEvent>(
    selectedEvent ? `/data/events/${selectedEvent}.json` : null,
  );
  if (!selectedEvent) return null;
  return (
    <aside className="event-panel" aria-labelledby="event-panel-title" data-testid="event-panel">
      {data?.id === selectedEvent ? (
        <EventDetail key={data.id} event={data} />
      ) : (
        <>
          <header className="panel-header">
            <span id="event-panel-title" className="detail-kicker">
              {t('Événement', 'Event')}
            </span>
            <button
              className="icon-button"
              aria-label={t('close')}
              onClick={() => useAtlasStore.getState().selectEvent(null)}
            >
              <X size={18} />
            </button>
          </header>
          <div className="panel-body" role="status" aria-live="polite">
            {loading || !error ? (
              <p>{t('Chargement de la fiche…', 'Loading event details…')}</p>
            ) : (
              <>
                <p className="notice">
                  {t(
                    'La fiche ne peut pas être chargée.',
                    'The event details could not be loaded.',
                  )}
                </p>
                <a
                  className="source-link"
                  href={`https://www.wikidata.org/wiki/${selectedEvent}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('Consulter la source Wikidata', 'Read the Wikidata source')}
                  <ArrowUpRight size={15} />
                </a>
              </>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
