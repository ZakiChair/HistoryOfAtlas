'use client';

import { ArrowUpRight, LocateFixed } from 'lucide-react';
import { REGION_LABELS } from '@/lib/i18n';
import { coverageText } from '@/lib/i18n/context-coverage';
import { formatYear } from '@/lib/histdate';
import { MIN_YEAR, MAX_YEAR } from '@/lib/eras';
import {
  COVERAGE_REGION_CENTERS,
  snapshotNeighbours,
  summarizeCoverage,
  type CoverageDataset,
} from '@/lib/context/coverage';
import type { ContextViewProps } from '@/lib/context/types';
import styles from './CoverageView.module.css';

export default function CoverageView({
  dataset,
  year,
  range,
  locale,
  sourceId,
  selectedId,
  onSelect,
  onLocate,
}: ContextViewProps & { dataset: CoverageDataset }) {
  const text = (key: Parameters<typeof coverageText>[1]) => coverageText(locale, key);
  const [fromYear, toYear] = range ?? [year, year];
  const summary = summarizeCoverage(dataset, { sourceId, fromYear, toYear });
  const neighbours = snapshotNeighbours(dataset, sourceId, year);
  const selectedRegion = summary.regions.find((region) => region.id === selectedId);
  const number = new Intl.NumberFormat(locale);
  const dates = (from: number, to: number) =>
    from === to
      ? formatYear(from, locale)
      : `${formatYear(from, locale)} — ${formatYear(to, locale)}`;
  const locateYear = (targetYear: number) =>
    onLocate(
      targetYear,
      selectedRegion ? COVERAGE_REGION_CENTERS[selectedRegion.id] : [10, 25],
      selectedRegion ? 2 : 1,
    );

  return (
    <section className={styles.view} lang={locale} data-testid="context-coverage">
      <h3>{text('title')}</h3>
      <p className={styles.source}>{summary.source.label}</p>
      <p>
        {text('period')} : <strong>{dates(fromYear, toYear)}</strong>
      </p>
      <div className={styles.totals}>
        <div>
          <strong>{number.format(summary.entities)}</strong>
          <span>{text('entries')}</span>
        </div>
        <div>
          <strong>{number.format(summary.observations)}</strong>
          <span>{text('observations')}</span>
        </div>
      </div>
      <p>{text('inventory')}</p>
      {summary.outsideSourceRange && <p className={styles.notice}>{text('outside')}</p>}
      {!range && sourceId === 'cliopatria' && year > summary.source.range[1] && (
        <button
          type="button"
          className={styles.action}
          onClick={() => locateYear(summary.source.range[1])}
        >
          {text('latest')} · {formatYear(summary.source.range[1], locale)}
        </button>
      )}
      {!range && sourceId === 'historical-basemaps' && !neighbours.exact && (
        <div className={styles.notice}>
          <p>{text('noSnapshot')}</p>
          <div className={styles.snapshotNavigation}>
            {(
              [
                ['previous', neighbours.previous],
                ['next', neighbours.next],
              ] as const
            ).map(([key, targetYear]) =>
              targetYear === undefined ? null : (
                <button
                  key={key}
                  type="button"
                  className={styles.action}
                  disabled={targetYear < MIN_YEAR || targetYear > MAX_YEAR}
                  onClick={() => locateYear(targetYear)}
                >
                  {text(key)} · {formatYear(targetYear, locale)}
                </button>
              ),
            )}
          </div>
        </div>
      )}
      {range && sourceId === 'historical-basemaps' && (
        <p className={styles.notice}>{text('snapshotPeriod')}</p>
      )}
      {!summary.observations && <p>{text('empty')}</p>}

      <table className={styles.table}>
        <caption>{text('table')}</caption>
        <thead>
          <tr>
            <th scope="col">{text('regions')}</th>
            <th scope="col">{text('entries')}</th>
            <th scope="col">{text('observations')}</th>
          </tr>
        </thead>
        <tbody>
          {summary.regions.map((region) => (
            <tr key={region.id} data-selected={selectedId === region.id || undefined}>
              <th scope="row">
                <button
                  type="button"
                  aria-pressed={selectedId === region.id}
                  onClick={() => onSelect(selectedId === region.id ? null : region.id)}
                >
                  {region.id === 'global'
                    ? text('outsideRegions')
                    : REGION_LABELS[region.id][locale]}
                </button>
              </th>
              <td>{number.format(region.entities)}</td>
              <td>{number.format(region.observations)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {selectedRegion && (
        <div className={styles.regionActions}>
          <button type="button" className={styles.action} onClick={() => onSelect(null)}>
            {text('clear')}
          </button>
          <button
            type="button"
            className={styles.action}
            onClick={() => onLocate(year, COVERAGE_REGION_CENTERS[selectedRegion.id], 2)}
          >
            <LocateFixed size={14} aria-hidden="true" />
            {text('locate')}
          </button>
        </div>
      )}
      <div className={styles.legend}>
        <span>
          <i className={styles.documented} aria-hidden="true" />
          {text('documented')}
        </span>
        <span>
          <i className={styles.undocumented} aria-hidden="true" />
          {text('undocumented')}
        </span>
      </div>
      <p>{text('anchors')}</p>
      <details className={styles.method}>
        <summary>{text('method')}</summary>
        <p>{text('identities')}</p>
        <p>{text('regionMethod')}</p>
        <p>{text('approximate')}</p>
        <p>
          {text('sourceRange')} : {dates(...summary.source.range)}
        </p>
        <p>{text('alternate')}</p>
        <a href={summary.source.url} target="_blank" rel="noreferrer">
          {text('sourceLink')} <ArrowUpRight size={13} aria-hidden="true" />
        </a>
        <p>{summary.source.license}</p>
      </details>
    </section>
  );
}
