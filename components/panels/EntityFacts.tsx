'use client';

import { useEffect, useState } from 'react';
import { invalidateJson, readJson } from '@/lib/data-client';
import { formatHistDate, formatYear } from '@/lib/histdate';
import { localizedName, useI18n } from '@/lib/i18n';
import {
  factsAtYear,
  parsePolityFacts,
  populationFactsInScope,
  PolityFactsRegistrySchema,
  resolveFactsMapping,
  type CapitalFact,
  type FactDate,
  type PolityFactsProfile,
  type PopulationFact,
} from '@/lib/polity-facts';
import { polityFactsText } from '@/lib/polity-facts-i18n';
import type { Source } from '@/lib/schema';
import type { Locale, LocalizedName } from '@/lib/types';
import type { z } from 'zod';

const REGISTRY_PATH = '/data/polity-facts/index.json';
type Registry = z.infer<typeof PolityFactsRegistrySchema>;
type Entity = { id: string; name: string; wikidataId?: string };

function nameLanguage(name: LocalizedName, locale: Locale): Locale {
  return name[locale] ? locale : 'en';
}

function dateLabel(date: FactDate, locale: Locale) {
  return formatHistDate(date.date, locale, {
    precision: date.precision,
    calendar: date.calendar,
    approximate: date.approximate,
    showCalendar: date.precision === 'day' || date.precision === 'month',
  });
}

function FactSources({ sources }: { sources: Source[] }) {
  const { locale } = useI18n();
  return (
    <details className="polity-fact-sources">
      <summary>
        {polityFactsText(locale, 'sources')} ({sources.length})
      </summary>
      <ul>
        {sources.map((source, index) => (
          <li key={`${source.url}-${index}`}>
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.label}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Capital({ fact }: { fact: CapitalFact }) {
  const { locale } = useI18n();
  const text = (key: Parameters<typeof polityFactsText>[1]) => polityFactsText(locale, key);
  const period = fact.at
    ? dateLabel(fact.at, locale)
    : fact.start || fact.end
      ? `${fact.start ? dateLabel(fact.start, locale) : text('unknownStart')} — ${fact.end ? dateLabel(fact.end, locale) : text('unknownEnd')}`
      : text('undatedPeriod');
  return (
    <li className="polity-fact-record">
      <strong className="polity-fact-value">
        <a
          href={`https://www.wikidata.org/wiki/${fact.city.id}`}
          target="_blank"
          rel="noreferrer"
          lang={nameLanguage(fact.city.name, locale)}
        >
          {localizedName(fact.city.name, locale)}
        </a>
      </strong>
      <span className="polity-fact-date">{period}</span>
      {fact.note && (
        <p lang={nameLanguage(fact.note, locale)}>{localizedName(fact.note, locale)}</p>
      )}
      <FactSources sources={fact.sources} />
    </li>
  );
}

function Population({ fact }: { fact: PopulationFact }) {
  const { locale } = useI18n();
  const text = (key: Parameters<typeof polityFactsText>[1]) => polityFactsText(locale, key);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const hasRange =
    fact.min !== undefined &&
    fact.max !== undefined &&
    (fact.min !== fact.max || fact.value === undefined);
  const value = hasRange
    ? `${number.format(fact.min!)} – ${number.format(fact.max!)}`
    : `${fact.approximate ? '≈ ' : ''}${number.format(fact.value!)}`;
  const period = fact.date
    ? dateLabel(fact.date, locale)
    : fact.start || fact.end
      ? `${fact.start ? dateLabel(fact.start, locale) : text('unknownStart')} — ${fact.end ? dateLabel(fact.end, locale) : text('unknownEnd')}`
      : text('undatedObservation');
  return (
    <li className="polity-fact-record">
      <strong className="polity-fact-value">{value}</strong>
      <span className="polity-fact-date">
        {text('inhabitants')} · {period}
      </span>
      {!hasRange && (fact.min !== undefined || fact.max !== undefined) && (
        <span className="polity-fact-date">
          {fact.min !== undefined && `${text('minimum')} ${number.format(fact.min)}`}
          {fact.min !== undefined && fact.max !== undefined && ' · '}
          {fact.max !== undefined && `${text('maximum')} ${number.format(fact.max)}`}
        </span>
      )}
      {fact.note && (
        <p lang={nameLanguage(fact.note, locale)}>{localizedName(fact.note, locale)}</p>
      )}
      <FactSources sources={fact.sources} />
    </li>
  );
}

/** The map's geometry and the historical fact have independent dated evidence. */
export default function EntityFacts({ entity, year }: { entity: Entity; year: number }) {
  const { locale } = useI18n();
  const text = (key: Parameters<typeof polityFactsText>[1]) => polityFactsText(locale, key);
  const [registry, setRegistry] = useState<Registry | null>(null);
  const [profile, setProfile] = useState<PolityFactsProfile | null>(null);
  const [failed, setFailed] = useState<'registry' | 'profile' | null>(null);
  const [retry, setRetry] = useState(0);
  const mapping = registry ? resolveFactsMapping(registry, entity, year) : null;
  const subjectId = mapping?.subjectId;

  useEffect(() => {
    let live = true;
    readJson<unknown>(REGISTRY_PATH)
      .then((value) => PolityFactsRegistrySchema.parse(value))
      .then((value) => {
        if (live) setRegistry(value);
      })
      .catch(() => {
        invalidateJson(REGISTRY_PATH);
        if (live) setFailed('registry');
      });
    return () => {
      live = false;
    };
  }, [retry]);

  useEffect(() => {
    let live = true;
    setProfile(null);
    setFailed((previous) => (previous === 'profile' ? null : previous));
    if (!subjectId) return;
    const path = `/data/polity-facts/${subjectId}.json`;
    readJson<unknown>(path)
      .then((value) => parsePolityFacts(value, subjectId))
      .then((value) => {
        if (live) {
          setProfile(value);
          setFailed(null);
        }
      })
      .catch(() => {
        invalidateJson(path);
        if (live) setFailed('profile');
      });
    return () => {
      live = false;
    };
  }, [subjectId, retry]);

  const loaded = subjectId && profile?.subjectId === subjectId ? profile : null;
  const facts = loaded ? factsAtYear(loaded, year, mapping ?? undefined) : null;
  const loading = !failed && (!registry || (mapping && !loaded));
  const undatedCapitals =
    facts?.otherCapitals.filter((fact) => !fact.start && !fact.end && !fact.at) ?? [];
  const shownCapitals = facts?.capitals.length ? facts.capitals : undatedCapitals;
  const otherCapitals = facts?.otherCapitals.filter((fact) => !shownCapitals.includes(fact)) ?? [];
  const shownPopulations = facts?.populations.length
    ? facts.populations
    : (facts?.referencePopulations ?? []);
  const populationHistory = loaded
    ? populationFactsInScope(loaded, mapping ?? undefined).filter(
        (fact) => !shownPopulations.includes(fact),
      )
    : [];

  return (
    <section
      className="entity-facts"
      data-testid="entity-facts"
      aria-labelledby="entity-facts-title"
    >
      <h3 id="entity-facts-title">{text('title')}</h3>
      <p className="polity-facts-year">
        {text('selectedYear')} {formatYear(year, locale)}
      </p>
      {loading && <p role="status">{text('loading')}</p>}
      {failed && (
        <div role="status">
          <p>{text('unavailable')}</p>
          <button
            className="secondary-button"
            onClick={() => {
              setFailed(null);
              setRetry((value) => value + 1);
            }}
          >
            {text('retry')}
          </button>
        </div>
      )}
      {!loading && !failed && (
        <>
          <div className="polity-fact-group" data-testid="capital-facts">
            <h4>{text('capital')}</h4>
            {!facts?.capitals.length && (
              <p className="source-note">
                {text('noCapital')} {formatYear(year, locale)}.
              </p>
            )}
            {!facts?.capitals.length && undatedCapitals.length > 0 && (
              <p className="polity-fact-caption">{text('undatedCapitals')}</p>
            )}
            {shownCapitals.length > 0 && (
              <ul className="polity-fact-list">
                {shownCapitals.map((fact) => (
                  <Capital key={fact.id} fact={fact} />
                ))}
              </ul>
            )}
            {otherCapitals.length > 0 && (
              <details className="polity-fact-history">
                <summary>
                  {text('otherCapitals')} ({otherCapitals.length})
                </summary>
                <ul className="polity-fact-list">
                  {otherCapitals.map((fact) => (
                    <Capital key={fact.id} fact={fact} />
                  ))}
                </ul>
              </details>
            )}
          </div>
          <div className="polity-fact-group" data-testid="population-facts">
            <h4>{text('population')}</h4>
            {!facts?.populations.length && (
              <p className="source-note">
                {text('noPopulation')} {formatYear(year, locale)}.
              </p>
            )}
            {shownPopulations.length > 0 && (
              <div
                data-testid={
                  facts?.populations.length ? 'population-current' : 'population-reference'
                }
              >
                {!facts?.populations.length && (
                  <p className="polity-fact-caption">{text('closestObservation')}</p>
                )}
                {shownPopulations.length > 1 && (
                  <p className="source-note">{text('alternatives')}</p>
                )}
                <ul className="polity-fact-list">
                  {shownPopulations.map((fact) => (
                    <Population key={fact.id} fact={fact} />
                  ))}
                </ul>
              </div>
            )}
            {shownPopulations.length > 0 && (
              <p className="source-note">{text('noInterpolation')}</p>
            )}
            {populationHistory.length > 0 && (
              <details className="polity-fact-history">
                <summary>{text('populationHistory')}</summary>
                <ul className="polity-fact-list">
                  {populationHistory.map((fact) => (
                    <Population key={fact.id} fact={fact} />
                  ))}
                </ul>
              </details>
            )}
          </div>
          {mapping && loaded && (
            <p className="source-note polity-facts-subject">
              {text('subject')}{' '}
              <a
                href={`https://www.wikidata.org/wiki/${mapping.subjectId}`}
                target="_blank"
                rel="noreferrer"
                lang={nameLanguage(mapping.label, locale)}
              >
                {localizedName(mapping.label, locale)}
              </a>
              . {text('scope')}
            </p>
          )}
        </>
      )}
    </section>
  );
}
