'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, MapPin, Search } from 'lucide-react';
import { CURRENT_YEAR, MIN_YEAR } from '@/lib/eras';
import { formatHistDate, formatYear } from '@/lib/histdate';
import { localizedLanguage, localizedName } from '@/lib/i18n';
import { polityFactsText } from '@/lib/polity-facts-i18n';
import type { CapitalFact, FactDate, PopulationFact } from '@/lib/polity-facts';
import type { Locale, Source } from '@/lib/types';
import { citiesText, type CitiesCopyKey } from '@/lib/context/cities-i18n';
import {
  cityEvidenceInPeriod,
  cityObservationYear,
  previousPopulationReferences,
  territoryPopulationsInPeriod,
  visibleCities,
  type CitiesDataset,
  type TerritoryPopulation,
} from '@/lib/context/cities';
import type { ContextViewProps } from '@/lib/context/types';
import styles from './CitiesView.module.css';

const PAGE_SIZE = 20;
const recordedYear = (fact: PopulationFact | CapitalFact) =>
  ('date' in fact ? fact.date : undefined)?.date.year ??
  ('at' in fact ? fact.at : undefined)?.date.year ??
  fact.start?.date.year ??
  fact.end?.date.year;
const navigable = (year: number | undefined): year is number =>
  year !== undefined && year >= MIN_YEAR && year <= CURRENT_YEAR;

function dateText(date: FactDate, locale: Locale) {
  return formatHistDate(date.date, locale, {
    precision: date.precision,
    calendar: date.calendar,
    approximate: date.approximate,
    showCalendar: date.precision === 'day' || date.precision === 'month',
  });
}

function periodText(fact: PopulationFact | CapitalFact, locale: Locale) {
  const point = ('date' in fact ? fact.date : undefined) ?? ('at' in fact ? fact.at : undefined);
  return point
    ? dateText(point, locale)
    : fact.start || fact.end
      ? `${fact.start ? dateText(fact.start, locale) : polityFactsText(locale, 'unknownStart')} — ${fact.end ? dateText(fact.end, locale) : polityFactsText(locale, 'unknownEnd')}`
      : polityFactsText(locale, 'undatedObservation');
}

function Sources({ sources, locale }: { sources: Source[]; locale: Locale }) {
  return (
    <details className={styles.sources}>
      <summary>
        {polityFactsText(locale, 'sources')} ({sources.length})
      </summary>
      <ul>
        {sources.map((source, index) => (
          <li key={`${source.url}-${index}`}>
            <a href={source.url} target="_blank" rel="noreferrer" lang="en" dir="auto">
              {source.label}
              <ArrowUpRight size={11} aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

function PopulationRecord({
  fact,
  locale,
  onLocate,
  canLocate,
}: {
  fact: PopulationFact;
  locale: Locale;
  onLocate?: (year: number) => void;
  canLocate?: (year: number) => boolean;
}) {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const hasRange =
    fact.min !== undefined &&
    fact.max !== undefined &&
    (fact.min !== fact.max || fact.value === undefined);
  const quantity = hasRange
    ? `${number.format(fact.min!)} – ${number.format(fact.max!)}`
    : number.format(fact.value ?? fact.min!);
  const year = recordedYear(fact);
  return (
    <li className={styles.observation}>
      <strong>
        {fact.approximate && '≈ '}
        {quantity} <span>{polityFactsText(locale, 'inhabitants')}</span>
      </strong>
      {onLocate && navigable(year) && (!canLocate || canLocate(year)) ? (
        <button
          type="button"
          className={styles.dateButton}
          onClick={() => onLocate(year)}
          aria-label={`${citiesText(locale, 'locate')} · ${periodText(fact, locale)}`}
        >
          <MapPin size={12} aria-hidden="true" />
          {periodText(fact, locale)}
        </button>
      ) : (
        <span className={styles.date}>{periodText(fact, locale)}</span>
      )}
      {!hasRange &&
        ((fact.min !== undefined && fact.min !== fact.value) ||
          (fact.max !== undefined && fact.max !== fact.value)) && (
          <span className={styles.date}>
            {fact.min !== undefined &&
              `${polityFactsText(locale, 'minimum')} ${number.format(fact.min)}`}{' '}
            {fact.max !== undefined &&
              `${polityFactsText(locale, 'maximum')} ${number.format(fact.max)}`}
          </span>
        )}
      {fact.note && (
        <p lang={localizedLanguage(fact.note, locale)} dir="auto">
          {localizedName(fact.note, locale)}
        </p>
      )}
      <Sources sources={fact.sources} locale={locale} />
    </li>
  );
}

function PopulationEvidence({
  facts,
  current,
  year,
  locale,
  onLocate,
  canLocate,
}: {
  facts: PopulationFact[];
  current: PopulationFact[];
  year: number;
  locale: Locale;
  onLocate?: (year: number) => void;
  canLocate?: (year: number) => boolean;
}) {
  const references = current.length ? [] : previousPopulationReferences(facts, year);
  const ordered = [...facts].sort(
    (a, b) =>
      (recordedYear(a) ?? Infinity) - (recordedYear(b) ?? Infinity) || a.id.localeCompare(b.id),
  );
  return (
    <>
      <h4>{citiesText(locale, 'current')}</h4>
      {!current.length && <p className={styles.note}>{citiesText(locale, 'noCurrent')}</p>}
      {current.length > 0 && (
        <ol className={styles.observations}>
          {current.map((fact) => (
            <PopulationRecord
              key={fact.id}
              fact={fact}
              locale={locale}
              onLocate={onLocate}
              canLocate={canLocate}
            />
          ))}
        </ol>
      )}
      {references.length > 0 && (
        <section className={styles.reference}>
          <h4>{citiesText(locale, 'reference')}</h4>
          <ol className={styles.observations}>
            {references.map((fact) => (
              <PopulationRecord
                key={fact.id}
                fact={fact}
                locale={locale}
                onLocate={onLocate}
                canLocate={canLocate}
              />
            ))}
          </ol>
        </section>
      )}
      <p className={styles.note}>{polityFactsText(locale, 'noInterpolation')}</p>
      {facts.length > 0 && (
        <details className={styles.history}>
          <summary>
            {citiesText(locale, 'history')} ({facts.length})
          </summary>
          <ol className={styles.observations}>
            {ordered.map((fact) => (
              <PopulationRecord
                key={fact.id}
                fact={fact}
                locale={locale}
                onLocate={onLocate}
                canLocate={canLocate}
              />
            ))}
          </ol>
        </details>
      )}
    </>
  );
}

function territoryLocation(
  territory: TerritoryPopulation,
  year: number,
  sourceId: ContextViewProps['sourceId'],
) {
  const mapping = territory.mappings.find(
    (mapping) =>
      mapping.polityId.startsWith(sourceId === 'cliopatria' ? 'clio-' : 'hb-') &&
      year >= (mapping.fromYear ?? -Infinity) &&
      year <= (mapping.toYear ?? Infinity),
  );
  return mapping
    ? territory.referenceLocations?.find((location) => location.polityId === mapping.polityId)
        ?.coordinates
    : undefined;
}

export default function CitiesView({
  dataset,
  year,
  range,
  locale,
  sourceId,
  selectedId,
  onSelect,
  onLocate,
}: ContextViewProps & { dataset: CitiesDataset }) {
  const [mode, setMode] = useState<'cities' | 'territories'>('cities');
  const [search, setSearch] = useState('');
  const [onlyPeriod, setOnlyPeriod] = useState(true);
  const [page, setPage] = useState(0);
  const [territoryId, setTerritoryId] = useState<string | null>(null);
  const text = (key: CitiesCopyKey) => citiesText(locale, key);
  const options = useMemo(() => ({ year, range, sourceId }), [year, range, sourceId]);
  useEffect(() => {
    if (selectedId) setMode('cities');
  }, [selectedId]);
  const selectedCity = dataset.cities.find((city) => city.id === selectedId);
  const selectedTerritory = dataset.territories.find(
    (territory) => territory.subjectId === territoryId,
  );
  const query = search.trim().toLocaleLowerCase(locale);
  const namesMatch = (name: { en: string } & Partial<Record<Locale, string>>) =>
    Object.values(name).some((value) => value?.toLocaleLowerCase(locale).includes(query));
  const cityList = (onlyPeriod ? visibleCities(dataset, options) : dataset.cities)
    .filter((city) => namesMatch(city.name))
    .sort((a, b) =>
      localizedName(a.name, locale).localeCompare(localizedName(b.name, locale), locale),
    );
  const territoryList = dataset.territories
    .filter(
      (territory) =>
        namesMatch(territory.name) &&
        (!onlyPeriod || territoryPopulationsInPeriod(territory, options).length > 0),
    )
    .sort((a, b) =>
      localizedName(a.name, locale).localeCompare(localizedName(b.name, locale), locale),
    );
  const total = mode === 'cities' ? cityList.length : territoryList.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const showDetail = mode === 'cities' ? Boolean(selectedCity) : Boolean(selectedTerritory);

  return (
    <section className={styles.view} data-testid="context-cities-view">
      <h3>{text('title')}</h3>
      <p className={styles.note}>{text('intro')}</p>
      <p className={styles.separation}>{text('separation')}</p>
      <div className={styles.tabs} role="group" aria-label={text('title')}>
        {(['cities', 'territories'] as const).map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={mode === value}
            onClick={() => {
              setMode(value);
              setPage(0);
              if (value === 'territories') onSelect(null);
            }}
          >
            {text(value)}
          </button>
        ))}
      </div>
      {showDetail ? (
        <>
          <button
            type="button"
            className={styles.back}
            onClick={() => (mode === 'cities' ? onSelect(null) : setTerritoryId(null))}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            {text('back')}
          </button>
          {mode === 'cities' && selectedCity && (
            <article data-testid="context-city-detail">
              <h4
                className={styles.subject}
                lang={localizedLanguage(selectedCity.name, locale)}
                dir="auto"
              >
                {localizedName(selectedCity.name, locale)}
              </h4>
              <p className={styles.note}>{text('coordinateNote')}</p>
              <Sources sources={selectedCity.coordinateSources} locale={locale} />
              <h4>{text('cityPopulation')}</h4>
              <PopulationEvidence
                facts={selectedCity.populations}
                current={cityEvidenceInPeriod(selectedCity, options).populations}
                year={range?.[0] ?? year}
                locale={locale}
                onLocate={(date) => onLocate(date, selectedCity.coordinates, 5)}
              />
              <h4>{text('capitalHistory')}</h4>
              <ol className={styles.observations}>
                {[...selectedCity.capitals]
                  .sort(
                    (a, b) =>
                      (recordedYear(a.fact) ?? Infinity) - (recordedYear(b.fact) ?? Infinity),
                  )
                  .map((capital) => {
                    const date = recordedYear(capital.fact);
                    return (
                      <li
                        className={styles.observation}
                        key={`${capital.subjectId}-${capital.fact.id}`}
                      >
                        <strong lang={localizedLanguage(capital.subjectName, locale)} dir="auto">
                          {localizedName(capital.subjectName, locale)}
                        </strong>
                        <button
                          type="button"
                          className={styles.dateButton}
                          disabled={!navigable(date)}
                          onClick={() => {
                            if (navigable(date)) onLocate(date, selectedCity.coordinates, 5);
                          }}
                        >
                          <MapPin size={12} aria-hidden="true" />
                          {periodText(capital.fact, locale)}
                        </button>
                        {capital.fact.note && (
                          <p lang={localizedLanguage(capital.fact.note, locale)} dir="auto">
                            {localizedName(capital.fact.note, locale)}
                          </p>
                        )}
                        <Sources sources={capital.fact.sources} locale={locale} />
                      </li>
                    );
                  })}
              </ol>
            </article>
          )}
          {mode === 'territories' && selectedTerritory && (
            <article data-testid="context-territory-population-detail">
              <h4
                className={styles.subject}
                lang={localizedLanguage(selectedTerritory.name, locale)}
                dir="auto"
              >
                {localizedName(selectedTerritory.name, locale)}
              </h4>
              <p className={styles.note}>{text('referencePoint')}</p>
              <PopulationEvidence
                facts={selectedTerritory.populations}
                current={territoryPopulationsInPeriod(selectedTerritory, options)}
                year={range?.[0] ?? year}
                locale={locale}
                canLocate={(date) => Boolean(territoryLocation(selectedTerritory, date, sourceId))}
                onLocate={(date) => {
                  const coordinates = territoryLocation(selectedTerritory, date, sourceId);
                  if (coordinates) onLocate(date, coordinates, 3);
                }}
              />
            </article>
          )}
        </>
      ) : (
        <>
          <label className={styles.search}>
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              aria-label={text('search')}
              placeholder={text('search')}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <label className={styles.filter}>
            <input
              type="checkbox"
              checked={onlyPeriod}
              onChange={(event) => {
                setOnlyPeriod(event.target.checked);
                setPage(0);
              }}
            />
            {text('onlyPeriod')}
          </label>
          <p className={styles.count}>
            {new Intl.NumberFormat(locale).format(total)} ·{' '}
            {range
              ? `${formatYear(range[0], locale)} — ${formatYear(range[1], locale)}`
              : formatYear(year, locale)}
          </p>
          {!total && <p className={styles.note}>{text('empty')}</p>}
          <ul className={styles.catalogue}>
            {mode === 'cities'
              ? cityList
                  .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
                  .map((city) => (
                    <li key={city.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(city.id);
                          const date = cityObservationYear(city, options);
                          if (navigable(date ?? undefined)) onLocate(date!, city.coordinates, 5);
                        }}
                      >
                        <span lang={localizedLanguage(city.name, locale)} dir="auto">
                          {localizedName(city.name, locale)}
                        </span>
                        <ArrowUpRight size={14} aria-hidden="true" />
                      </button>
                    </li>
                  ))
              : territoryList
                  .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
                  .map((territory) => (
                    <li key={territory.subjectId}>
                      <button type="button" onClick={() => setTerritoryId(territory.subjectId)}>
                        <span lang={localizedLanguage(territory.name, locale)} dir="auto">
                          {localizedName(territory.name, locale)}
                        </span>
                        <span>
                          {territory.populations.length} {text('observations')}
                        </span>
                      </button>
                    </li>
                  ))}
          </ul>
          {pageCount > 1 && (
            <div className={styles.pagination}>
              <button
                type="button"
                aria-label={text('previousPage')}
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <span>
                {currentPage + 1} / {pageCount}
              </span>
              <button
                type="button"
                aria-label={text('nextPage')}
                disabled={currentPage >= pageCount - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}
        </>
      )}
      <p className={styles.coverage}>
        {dataset.coverage.mappedCities} / {dataset.coverage.candidateCities} {text('coverage')}.{' '}
        {text('incomplete')}
      </p>
    </section>
  );
}
