'use client';

import { useState } from 'react';
import { ArrowRight, ArrowUpRight, UsersRound } from 'lucide-react';
import { localizedName, useI18n } from '@/lib/i18n';
import { openPerson } from '@/lib/navigation';
import type { HistoricalEvent } from '@/lib/schema';

/** Participation lists reach several hundred names on world wars: show a first handful. */
const EVENT_PEOPLE_LIMIT = 8;
const EVENT_PEOPLE_STEP = 24;

export default function EventPeople({
  people,
  participants = [],
}: {
  people: NonNullable<HistoricalEvent['people']>;
  participants?: HistoricalEvent['belligerents'];
}) {
  const { locale, t } = useI18n();
  const [participationLimit, setParticipationLimit] = useState(EVENT_PEOPLE_LIMIT);
  if (!people.length) return null;
  // Documented command stays complete; only the long participation list is shortened.
  const commanders = people.filter((person) => person.role === 'commander');
  const others = people.filter((person) => person.role === 'participant');
  return (
    <section className="detail-section" data-testid="event-people">
      <h3>
        <UsersRound size={14} /> {t('Les personnes de cette histoire', 'People in this history')}
      </h3>
      {[
        {
          label: t('Commandement documenté', 'Documented command'),
          entries: commanders,
          hidden: 0,
        },
        {
          label: t('Participations documentées', 'Documented participation'),
          entries: others.slice(0, participationLimit),
          hidden: Math.max(0, others.length - participationLimit),
        },
      ]
        .filter((group) => group.entries.length)
        .map((group) => (
          <div className="people-group" key={group.label}>
            <h4 className="detail-kicker">{group.label}</h4>
            <ul className="people-links">
              {group.entries.map((person, index) => {
                const participant = participants.find(
                  (entry) => entry.entityId === person.participantId,
                );
                const name = localizedName(person.name, locale);
                const sources = [
                  ...new Map(person.sources.map((source) => [source.url, source])).values(),
                ];
                return (
                  <li key={`${person.statementId}-${person.personId}-${index}`}>
                    <button
                      className="person-link"
                      onClick={() => openPerson(person.personId, { preserveContext: true })}
                    >
                      <span>
                        <strong>{name}</strong>
                        {participant && <small>{participant.name}</small>}
                      </span>
                      <ArrowRight size={15} aria-hidden="true" />
                    </button>
                    <a
                      className="person-source"
                      href={sources[0].url}
                      target="_blank"
                      rel="noreferrer"
                      title={sources[0].label}
                      aria-label={`${t('Source du rôle de', 'Source for the role of')} ${name}`}
                    >
                      <ArrowUpRight size={12} aria-hidden="true" />
                    </a>
                    {sources.length > 1 && (
                      <details className="person-references">
                        <summary>
                          {t('Toutes les références', 'All references')} ({sources.length})
                        </summary>
                        {sources.map((source) => (
                          <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                            {source.label} <ArrowUpRight size={10} aria-hidden="true" />
                          </a>
                        ))}
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
            {group.hidden > 0 && (
              <button
                className="text-button people-more"
                onClick={() => setParticipationLimit((count) => count + EVENT_PEOPLE_STEP)}
              >
                {t('Afficher davantage', 'Show more')} ({group.hidden})
              </button>
            )}
          </div>
        ))}
    </section>
  );
}
