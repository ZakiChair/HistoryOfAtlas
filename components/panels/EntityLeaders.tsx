'use client';

import { useEffect, useState } from 'react';
import { readJson } from '@/lib/data-client';
import { formatHistDate, formatYear } from '@/lib/histdate';
import { useI18n } from '@/lib/i18n';
import { openPerson } from '@/lib/navigation';
import type { PolityIdentity } from '@/lib/polity-identities';
import { parsePolityLeaders, tenureAtYear } from '@/lib/polity-leaders';
import type { PersonTenure, SourcedDate } from '@/lib/schema';

function LeaderCard({ tenure }: { tenure: PersonTenure }) {
  const { locale, t } = useI18n();
  const name = tenure.name[locale] ?? tenure.name.en;
  const endpoint = (values: readonly SourcedDate[] | undefined, unknown: string) => {
    if (!values?.length) return unknown;
    return [
      ...new Set(
        values.map((value) =>
          formatHistDate(value.date, locale, {
            precision: value.precision,
            calendar: value.calendar,
            approximate: value.approximate,
            showCalendar: true,
          }),
        ),
      ),
    ].join(t(' ou ', ' or '));
  };
  const sources = [
    ...new Map(
      [
        ...tenure.sources,
        ...(tenure.start ?? []).flatMap((date) => date.sources),
        ...(tenure.end ?? []).flatMap((date) => date.sources),
      ].map((source) => [source.url, source]),
    ).values(),
  ];
  const role =
    tenure.role === 'head-of-state'
      ? t('Chef d’État', 'Head of state')
      : tenure.role === 'head-of-government'
        ? t('Chef de gouvernement', 'Head of government')
        : t('Fonction exercée', 'Office held');

  return (
    <li className="leader-card">
      <button
        className="leader-person"
        onClick={() => openPerson(tenure.personId, { preserveContext: true })}
      >
        {name}
      </button>
      <p className="leader-role">
        {role}
        {tenure.office && (
          <>
            {' · '}
            <a
              href={`https://www.wikidata.org/wiki/${tenure.office.id}`}
              target="_blank"
              rel="noreferrer"
            >
              {tenure.office.name[locale] ?? tenure.office.name.en}
            </a>
          </>
        )}
      </p>
      <p className="leader-period">
        {endpoint(tenure.start, t('Début non documenté', 'Start not documented'))}
        {' — '}
        {endpoint(tenure.end, t('Fin non documentée', 'End not documented'))}
      </p>
      <div className="leader-sources">
        <a href={tenure.sources[0].url} target="_blank" rel="noreferrer">
          {t('Source de cette fonction', 'Source for this office')}
        </a>
        {sources.length > 1 && (
          <details>
            <summary>
              {t('Toutes les références', 'All references')} ({sources.length})
            </summary>
            {sources.map((source) => (
              <a href={source.url} key={source.url} target="_blank" rel="noreferrer">
                {source.label}
              </a>
            ))}
          </details>
        )}
      </div>
    </li>
  );
}

export default function EntityLeaders({
  identity,
  year,
}: {
  identity: PolityIdentity;
  year: number;
}) {
  const { locale, t } = useI18n();
  const [data, setData] = useState<{ polityId: string; leaders: PersonTenure[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const polityId = identity.wikidataId;

  useEffect(() => {
    let live = true;
    setFailed(false);
    setData(null);
    readJson<unknown>(`/data/polity-leaders/${polityId}.json`)
      .then((value) => parsePolityLeaders(value, polityId))
      .then((value) => {
        if (live) setData(value);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [polityId, retry]);

  const loaded = data?.polityId === polityId ? data : null;
  const sorted = [...(loaded?.leaders ?? [])].sort(
    (a, b) =>
      (a.start?.[0]?.date.year ?? Number.MAX_SAFE_INTEGER) -
        (b.start?.[0]?.date.year ?? Number.MAX_SAFE_INTEGER) ||
      a.personId.localeCompare(b.personId) ||
      a.id.localeCompare(b.id),
  );
  const current = sorted.filter((tenure) => tenureAtYear(tenure, year) === 'documented');
  const others = sorted.filter((tenure) => tenureAtYear(tenure, year) !== 'documented');

  return (
    <section
      className="entity-leaders"
      aria-labelledby="entity-leaders-title"
      data-testid="entity-leaders"
    >
      <h3 id="entity-leaders-title">{t('Dirigeants et fonctions', 'Leaders and offices')}</h3>
      <p className="source-note">
        {t('Identité vérifiée : ', 'Reviewed identity: ')}
        <a href={`https://www.wikidata.org/wiki/${polityId}`} target="_blank" rel="noreferrer">
          {identity.label[locale] ?? identity.label.en}
        </a>
        .{' '}
        {t(
          'Les dates qualifient les fonctions citées ; elles ne datent pas les frontières.',
          'Dates describe the cited offices; they do not date the boundaries.',
        )}
      </p>
      {!loaded && !failed && (
        <p role="status">
          {t('Chargement des fonctions documentées…', 'Loading documented offices…')}
        </p>
      )}
      {failed && (
        <>
          <p role="status">
            {t(
              'Les fonctions documentées sont indisponibles pour le moment.',
              'Documented offices are currently unavailable.',
            )}
          </p>
          <button className="primary-button" onClick={() => setRetry((value) => value + 1)}>
            {t('Réessayer', 'Try again')}
          </button>
        </>
      )}
      {loaded && (
        <>
          {current.length > 0 ? (
            <>
              <h4>
                {t('Périodes documentées en ', 'Documented periods in ')}
                {formatYear(year, locale)}
              </h4>
              <ul className="leader-list">
                {current.map((tenure) => (
                  <LeaderCard key={tenure.id} tenure={tenure} />
                ))}
              </ul>
            </>
          ) : (
            <p className="source-note">
              {loaded.leaders.length
                ? t(
                    'Aucune période certaine documentée pour l’année sélectionnée dans ce corpus.',
                    'No definite period is documented for the selected year in this corpus.',
                  )
                : t(
                    'Ce corpus ne contient pas encore de fonction sourcée pour cette entité.',
                    'This corpus does not yet contain a sourced office for this entity.',
                  )}
            </p>
          )}
          {others.length > 0 && (
            <details className="other-leaders">
              <summary>
                {t('Autres périodes et dates incertaines', 'Other periods and uncertain dates')} (
                {others.length})
              </summary>
              <ul className="leader-list">
                {others.map((tenure) => (
                  <LeaderCard key={tenure.id} tenure={tenure} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
