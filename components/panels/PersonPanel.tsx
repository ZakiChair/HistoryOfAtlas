'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Link as LinkIcon,
  UserRound,
  X,
} from 'lucide-react';
import { useJson } from '@/lib/data-client/hooks';
import { formatHistDate, formatYear } from '@/lib/histdate';
import { localizedName, useI18n, translateCopy } from '@/lib/i18n';
import { createEventNavigation } from '@/lib/navigation';
import type { Person, PersonEventLink, PersonTenure, Source, SourcedDate } from '@/lib/schema';
import { serializeAtlasUrl, useAtlasStore } from '@/lib/store';
import type { Locale } from '@/lib/types';
import EncyclopediaContent from './EncyclopediaContent';
import EventSources from './EventSources';

function EvidenceLinks({ sources }: { sources: Source[] }) {
  return (
    <span className="person-evidence">
      {[...new Map(sources.map((source) => [source.url, source])).values()].map((source) => (
        <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
          {source.label}
          <ArrowUpRight size={11} aria-hidden="true" />
        </a>
      ))}
    </span>
  );
}

function SourceDates({
  label,
  dates,
  locale,
}: {
  label: string;
  dates?: SourcedDate[];
  locale: Locale;
}) {
  if (!dates?.length) return null;
  return (
    <div className="person-dates">
      <span className="detail-kicker">{label}</span>
      {dates.length > 1 && (
        <p className="detail-precision">
          {translateCopy(
            locale,
            'Plusieurs indications de date dans les sources',
            'Multiple date statements in the sources',
          )}
        </p>
      )}
      <ul>
        {dates.map((value, index) => (
          <li key={`${value.statementId}-${index}`}>
            <span>
              {formatHistDate(value.date, locale, {
                precision: value.precision,
                calendar: value.calendar,
                approximate: value.approximate,
                showCalendar: Boolean(value.date.month || value.date.day),
              })}
            </span>
            <EvidenceLinks sources={value.sources} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tenure({ tenure, locale }: { tenure: PersonTenure; locale: Locale }) {
  const { t } = useI18n();
  const title = tenure.office
    ? localizedName(tenure.office.name, locale)
    : tenure.role === 'head-of-state'
      ? t('Chef de l’État', 'Head of state')
      : tenure.role === 'head-of-government'
        ? t('Chef du gouvernement', 'Head of government')
        : t('Fonction documentée', 'Documented office');
  return (
    <li className="person-tenure">
      <h4>
        {tenure.office ? (
          <a
            href={`https://www.wikidata.org/wiki/${tenure.office.id}`}
            target="_blank"
            rel="noreferrer"
          >
            {title}
            <ArrowUpRight size={12} aria-hidden="true" />
          </a>
        ) : (
          title
        )}
      </h4>
      {tenure.polity && (
        <a
          className="person-polity"
          href={`https://www.wikidata.org/wiki/${tenure.polity.id}`}
          target="_blank"
          rel="noreferrer"
        >
          {localizedName(tenure.polity.name, locale)}
          <ArrowUpRight size={12} aria-hidden="true" />
        </a>
      )}
      <SourceDates
        label={t('Début documenté', 'Documented start')}
        dates={tenure.start}
        locale={locale}
      />
      <SourceDates
        label={t('Fin documentée', 'Documented end')}
        dates={tenure.end}
        locale={locale}
      />
      {!tenure.start?.length && !tenure.end?.length && (
        <p className="detail-precision">
          {t('Dates non renseignées dans ce relevé.', 'Dates are not specified in this record.')}
        </p>
      )}
      <EvidenceLinks sources={tenure.sources} />
    </li>
  );
}

function RelatedEvents({
  events,
  title,
  locale,
  eventNavigation,
  personId,
}: {
  events: PersonEventLink[];
  title: string;
  locale: Locale;
  eventNavigation: ReturnType<typeof createEventNavigation>;
  personId: string;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(12);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  async function navigate(id: string) {
    setError(null);
    setOpening(id);
    try {
      await eventNavigation.open(id, {
        isCurrent: () => useAtlasStore.getState().selectedPerson === personId,
      });
    } catch {
      setError(id);
    } finally {
      setOpening((current) => (current === id ? null : current));
    }
  }
  if (!events.length) return null;
  return (
    <section className="detail-section person-events">
      <h3>{title}</h3>
      <ul className="people-links">
        {events.slice(0, visible).map((event, index) => (
          <li key={`${event.eventId}-${event.statementId}-${index}`}>
            <div>
              <button
                className="person-link"
                onClick={() => void navigate(event.eventId)}
                disabled={opening === event.eventId}
              >
                <span>
                  <strong>{localizedName(event.name, locale)}</strong>
                  <small>
                    {event.start && `${formatYear(event.start.year, locale)} · `}
                    {event.role === 'commander'
                      ? t('Commandement documenté', 'Documented command')
                      : t('Participation documentée', 'Documented participation')}
                  </small>
                </span>
                <ArrowRight size={15} aria-hidden="true" />
              </button>
              <EvidenceLinks sources={event.sources} />
              {error === event.eventId && (
                <p role="status" className="notice">
                  {t(
                    'La fiche ne peut pas être chargée pour le moment.',
                    'The event details could not currently be loaded.',
                  )}{' '}
                  <a
                    href={`https://www.wikidata.org/wiki/${event.eventId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Wikidata
                  </a>
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
      {events.length > visible && (
        <button className="text-button" onClick={() => setVisible((count) => count + 12)}>
          {t('Afficher davantage', 'Show more')} ({events.length - visible})
        </button>
      )}
    </section>
  );
}

function PersonDetail({ person }: { person: Person }) {
  const { locale, t } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null);
  const eventNavigation = useMemo(() => createEventNavigation(), []);
  useEffect(() => () => eventNavigation.cancel(), [eventNavigation]);
  const [tenureLimit, setTenureLimit] = useState(12);
  const [share, setShare] = useState<'idle' | 'copied' | 'manual'>('idle');
  const [shareUrl, setShareUrl] = useState('');
  const hasSource = useAtlasStore((state) =>
    Boolean(state.selectedEvent || state.selectedEntity || state.campaignId || state.storyId),
  );
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [person.id]);
  const description =
    person.description?.[locale] ?? person.description?.en ?? person.description?.fr;
  const descriptionLanguage = person.description?.[locale]
    ? locale
    : person.description?.en
      ? 'en'
      : 'fr';
  const titleLanguage =
    locale !== 'en' && person.name[locale] ? locale : (person.nameLanguage ?? 'en');
  const conquests = person.events.filter((event) => event.type === 'conquest');
  const otherEvents = person.events.filter((event) => event.type !== 'conquest');
  async function sharePerson() {
    const url = `${location.origin}${location.pathname}${serializeAtlasUrl(useAtlasStore.getState())}`;
    setShareUrl(url);
    try {
      await window.navigator.clipboard.writeText(url);
      setShare('copied');
    } catch {
      setShare('manual');
    }
  }
  return (
    <>
      <header className="panel-header">
        <span className="detail-kicker">
          <UserRound size={15} aria-hidden="true" />
          {t('PERSONNAGE', 'HISTORICAL FIGURE')}
        </span>
        <button
          className="icon-button"
          aria-label={t('Fermer la fiche du personnage', 'Close person panel')}
          onClick={() => useAtlasStore.getState().selectPerson(null)}
        >
          <X size={18} />
        </button>
      </header>
      <div className="panel-body">
        <h2
          className="detail-title"
          id="person-panel-title"
          ref={heading}
          tabIndex={-1}
          lang={titleLanguage}
          dir="auto"
        >
          {localizedName(person.name, locale)}
        </h2>
        {person.nameLanguage && (
          <p className="badge">
            {t('Intitulé d’origine', 'Original title')} : {person.nameLanguage}
          </p>
        )}
        {description && (
          <p className="detail-description" lang={descriptionLanguage}>
            {description}
            <a
              className="description-source"
              href={`https://www.wikidata.org/wiki/${person.id}`}
              target="_blank"
              rel="noreferrer"
            >
              Wikidata · CC0 <ArrowUpRight size={10} aria-hidden="true" />
            </a>
          </p>
        )}
        <section
          className="person-life"
          aria-label={t('Dates biographiques sourcées', 'Sourced biographical dates')}
        >
          <SourceDates label={t('Naissance', 'Birth')} dates={person.birth} locale={locale} />
          <SourceDates label={t('Mort', 'Death')} dates={person.death} locale={locale} />
        </section>
        <EncyclopediaContent key={`${person.id}-${locale}`} subject={person} locale={locale} />
        <section className="detail-section">
          <h3>{t('Fonctions et règnes documentés', 'Documented offices and reigns')}</h3>
          {person.tenures.length ? (
            <>
              <ol className="person-tenures">
                {person.tenures.slice(0, tenureLimit).map((tenure, index) => (
                  <Tenure key={`${tenure.id}-${index}`} tenure={tenure} locale={locale} />
                ))}
              </ol>
              {person.tenures.length > tenureLimit && (
                <button
                  className="text-button"
                  onClick={() => setTenureLimit((count) => count + 12)}
                >
                  {t('Afficher davantage', 'Show more')} ({person.tenures.length - tenureLimit})
                </button>
              )}
            </>
          ) : (
            <p className="detail-precision">
              {t(
                'Aucun mandat documenté dans ce corpus.',
                'No tenure is documented in this corpus.',
              )}
            </p>
          )}
        </section>
        <RelatedEvents
          events={conquests}
          title={t(
            'Participations à des conquêtes documentées',
            'Participation in documented conquests',
          )}
          locale={locale}
          eventNavigation={eventNavigation}
          personId={person.id}
        />
        <RelatedEvents
          events={otherEvents}
          title={t(
            'Batailles et autres événements associés',
            'Battles and other associated events',
          )}
          locale={locale}
          eventNavigation={eventNavigation}
          personId={person.id}
        />
        <p className="detail-precision">
          {t(
            'Une participation à un conflit ne suffit pas à attribuer une conquête ou une modification de frontière à cette personne.',
            'Participation in a conflict does not establish that this person caused a conquest or boundary change.',
          )}
        </p>
        <EventSources sources={person.sources} locale={locale} />
      </div>
      <footer className="panel-footer">
        {hasSource && (
          <button
            className="text-button"
            onClick={() => useAtlasStore.getState().selectPerson(null)}
          >
            <ArrowLeft size={14} />
            {t('Revenir au contexte', 'Back to context')}
          </button>
        )}
        <button className="secondary-button" onClick={() => void sharePerson()}>
          {share === 'copied' ? <Check size={14} /> : <LinkIcon size={14} />}
          {share === 'copied'
            ? t('Lien copié', 'Link copied')
            : t('Partager cette fiche', 'Share this profile')}
        </button>
        <span className="sr-only" role="status">
          {share === 'copied' ? t('Le lien a été copié.', 'The link has been copied.') : ''}
        </span>
        {share === 'manual' && (
          <input
            aria-label={t('Lien à copier', 'Link to copy')}
            value={shareUrl}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
        )}
      </footer>
    </>
  );
}

export default function PersonPanel() {
  const { t } = useI18n();
  const selected = useAtlasStore((state) => state.selectedPerson);
  const { data, loading, error } = useJson<Person>(
    selected ? `/data/people/${selected}.json` : null,
  );
  if (!selected) return null;
  return (
    <aside
      className="event-panel person-panel"
      aria-labelledby="person-panel-title"
      data-testid="person-panel"
    >
      {data?.id === selected ? (
        <PersonDetail key={data.id} person={data} />
      ) : (
        <>
          <header className="panel-header">
            <span id="person-panel-title" className="detail-kicker">
              {t('Personnage', 'Historical figure')}
            </span>
            <button
              className="icon-button"
              aria-label={t('Fermer la fiche du personnage', 'Close person panel')}
              onClick={() => useAtlasStore.getState().selectPerson(null)}
            >
              <X size={18} />
            </button>
          </header>
          <div className="panel-body" role="status" aria-live="polite">
            {loading || !error ? (
              <p>{t('Chargement de la fiche…', 'Loading profile…')}</p>
            ) : (
              <>
                <p className="notice">
                  {t('Cette fiche ne peut pas être chargée.', 'This profile could not be loaded.')}
                </p>
                <a
                  className="source-link"
                  href={`https://www.wikidata.org/wiki/${selected}`}
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
