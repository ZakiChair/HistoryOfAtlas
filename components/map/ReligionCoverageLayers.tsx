'use client';

import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ArrowLeft, ArrowUpRight, X } from 'lucide-react';
import { useAtlasStore } from '@/lib/store';
import { formatYear } from '@/lib/histdate';
import { localizedName } from '@/lib/i18n';
import { useReligionStore } from '@/lib/religions/store';
import { useReligionCoverageStore } from '@/lib/religions/coverage-store';
import {
  religionCoverageAt,
  religionCoverageClasses,
  type ReligionCoverageEntry,
  type ReligionCoverageShare,
} from '@/lib/religions/coverage';
import { religionCoverageText, type ReligionCoverageCopyKey } from '@/lib/religions/coverage-i18n';
import { religionText } from '@/lib/religions/i18n';
import { religionLabel } from '@/lib/religions/time';
import { religionTraditionNames } from '@/lib/religions/tradition-names';
import type { Locale } from '@/lib/types';
import Localized from '../ui/Localized';
import ReligionViewSwitch from './ReligionViewSwitch';

const colorStyle = (color: string): CSSProperties =>
  ({ '--religion-color': color }) as CSSProperties;

function observationDate(entry: Pick<ReligionCoverageEntry, 'time'>, year: number, locale: Locale) {
  const time = entry.time;
  return time.kind === 'snapshot'
    ? religionCoverageText(locale, time.year === year ? 'estimate' : 'datedReference').replace(
        '{year}',
        formatYear(time.year, locale),
      )
    : `${religionCoverageText(locale, 'interval')} : ${formatYear(time.fromYear, locale)} — ${formatYear(time.toYear, locale)}`;
}

function shareOrder(part: ReligionCoverageShare): number {
  return part.share ?? { majority: 0.8, substantial: 0.3, presence: 0.1 }[part.prevalence!] ?? 0;
}

function formatShare(share: number, formatter: Intl.NumberFormat): string {
  // Keep an estimate on the correct side of the map's thresholds after rounding.
  for (const threshold of [0.2, 0.5]) {
    if (share !== threshold && Math.round(share * 1000) === threshold * 1000)
      return `${share > threshold ? '>' : '<'} ${formatter.format(threshold)}`;
  }
  return formatter.format(share);
}

export default function ReligionCoverageLayers({
  panelId,
  onClose,
}: {
  panelId: string;
  onClose: () => void;
}) {
  const locale = useAtlasStore((state) => state.locale);
  const year = useAtlasStore((state) => state.year);
  const range = useAtlasStore((state) => state.range);
  const filter = useAtlasStore((state) => state.religionFilter);
  const panelOpen = useReligionStore((state) => state.panelOpen);
  // Named fields only: the store also carries a retry revision, which must not redraw the panel.
  const { status, dataset, visibleObservations, selected, detail, detailStatus, retry, select } =
    useReligionCoverageStore(
      useShallow((state) => ({
        status: state.status,
        dataset: state.dataset,
        visibleObservations: state.visibleObservations,
        selected: state.selected,
        detail: state.detail,
        detailStatus: state.detailStatus,
        retry: state.retry,
        select: state.select,
      })),
    );
  const retryDetail = useReligionCoverageStore((state) => state.retryDetail);
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const t = (key: ReligionCoverageCopyKey) => religionCoverageText(locale, key);
  const horizon = range ? Math.max(...range) : year;
  // Scanning the dataset is the panel's one costly step; the year and range decide its result.
  const all = useMemo(
    () => (dataset ? religionCoverageAt(dataset, year, range) : []),
    [dataset, year, range],
  );
  const classes = dataset && selected ? religionCoverageClasses(dataset, selected) : null;
  const majority = dataset?.traditions.find((item) => item.id === classes?.majority);
  const selectedGeometry = dataset?.geometries.find((item) => item.id === selected?.geometryId);
  const sourceIds = new Set([
    ...(detail?.sourceIds ?? []),
    ...(selectedGeometry?.sourceIds ?? []),
    ...(detail?.shares.flatMap((share) => share.sourceIds ?? []) ?? []),
  ]);
  const regionNames = useMemo(
    () => new Map((dataset?.regions ?? []).map((row) => [row.id, row.name])),
    [dataset],
  );
  const percent = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }),
    [locale],
  );
  const mappedTraditionIds = useMemo(
    () =>
      new Set(
        dataset
          ? visibleObservations.flatMap((row) => {
              const groups = religionCoverageClasses(dataset, row);
              return [groups.majority, ...groups.substantial].flatMap((id) =>
                id && (!filter || id === filter) ? [id] : [],
              );
            })
          : [],
      ),
    [dataset, visibleObservations, filter],
  );
  const referenceYears = useMemo(
    () =>
      visibleObservations.flatMap((row) => (row.time.kind === 'snapshot' ? [row.time.year] : [])),
    [visibleObservations],
  );
  const firstReferenceYear = Math.min(...referenceYears);
  const lastReferenceYear = Math.max(...referenceYears);
  const traditions = useMemo(
    () =>
      dataset?.traditions.filter((item) => all.some((row) => row.present.includes(item.id))) ?? [],
    [dataset, all],
  );
  const regions = useMemo(
    () =>
      visibleObservations
        .slice()
        .sort((a, b) =>
          religionLabel(regionNames.get(a.regionId)!, locale).localeCompare(
            religionLabel(regionNames.get(b.regionId)!, locale),
            locale,
          ),
        ),
    [visibleObservations, regionNames, locale],
  );

  useEffect(() => {
    if (panelOpen) {
      if (body.current) body.current.scrollTop = 0;
      heading.current?.focus({ preventScroll: true });
    }
  }, [panelOpen, selected?.id]);

  const close = () => {
    select(null);
    onClose();
  };
  return (
    <>
      <div className="religion-layer-note" data-testid="religions-status">
        <span>{t('selectedYear').replace('{year}', formatYear(horizon, locale))}</span>
        {(status === 'idle' || status === 'loading') && <span role="status">{t('loading')}</span>}
        {status === 'ready' && (
          <span>
            {visibleObservations.length
              ? t('count').replace('{count}', visibleObservations.length.toLocaleString(locale))
              : t('empty')}
          </span>
        )}
        {status === 'ready' && referenceYears.length > 0 && firstReferenceYear < horizon && (
          <span>
            {t('referenceYears').replace(
              '{years}',
              firstReferenceYear === lastReferenceYear
                ? formatYear(firstReferenceYear, locale)
                : `${formatYear(firstReferenceYear, locale)} — ${formatYear(lastReferenceYear, locale)}`,
            )}
          </span>
        )}
        {status === 'error' && (
          <span role="alert">
            {religionText(locale, 'error')}{' '}
            <button type="button" onClick={retry}>
              {religionText(locale, 'retry')}
            </button>
          </span>
        )}
      </div>
      {panelOpen && (
        <section
          id={panelId}
          className="religion-layer-card"
          aria-labelledby={`${panelId}-heading`}
          data-testid={selected ? 'religion-coverage-detail' : 'religions-panel'}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
          }}
        >
          <div className="religion-card-heading">
            <h2 id={`${panelId}-heading`} ref={heading} tabIndex={-1}>
              {selected ? (
                <Localized value={regionNames.get(selected.regionId)!} locale={locale} />
              ) : (
                t('title')
              )}
            </h2>
            <button
              type="button"
              className="icon-button"
              aria-label={religionText(locale, 'close')}
              onClick={close}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="religion-card-body" ref={body}>
            {!selected && <ReligionViewSwitch />}
            {selected && dataset ? (
              <>
                <button type="button" className="religion-back" onClick={() => select(null)}>
                  <ArrowLeft size={14} aria-hidden="true" />
                  {t('back')}
                </button>
                <p className="religion-coverage-date">
                  {observationDate(selected, horizon, locale)}
                </p>
                <p className="source-note">
                  {t('selectedYear').replace('{year}', formatYear(horizon, locale))}
                </p>
                <p className="religion-coverage-majority" data-testid="religion-majority-summary">
                  {majority ? (
                    <>
                      <span
                        className="religion-color-chip"
                        style={colorStyle(majority.color)}
                        aria-hidden="true"
                      />
                      <Localized value={religionTraditionNames(majority.names)} locale={locale} />
                      {' · '}
                      {t('majority')}
                    </>
                  ) : (
                    t('noMajority')
                  )}
                </p>
                {detailStatus === 'loading' && (
                  <p role="status" className="source-note">
                    {t('detailLoading')}
                  </p>
                )}
                {detailStatus === 'error' && (
                  <p role="alert" className="source-note">
                    {t('detailError')}{' '}
                    <button type="button" onClick={retryDetail}>
                      {religionText(locale, 'retry')}
                    </button>
                  </p>
                )}
                {detail && (
                  <>
                    <h3>{t('shares')}</h3>
                    <ul className="religion-shares">
                      {detail.shares
                        .slice()
                        .sort((a, b) => shareOrder(b) - shareOrder(a))
                        .map((part) => {
                          const tradition = dataset.traditions.find(
                            (item) => item.id === part.traditionId,
                          )!;
                          const substantial = classes?.substantial.includes(part.traditionId);
                          return (
                            <li key={part.traditionId} style={colorStyle(tradition.color)}>
                              <div className="religion-share-heading">
                                <span>
                                  <span className="religion-color-chip" aria-hidden="true" />
                                  <Localized
                                    value={religionTraditionNames(tradition.names)}
                                    locale={locale}
                                  />
                                </span>
                                <strong>
                                  {part.share !== undefined
                                    ? formatShare(part.share, percent)
                                    : t(part.prevalence!)}
                                </strong>
                              </div>
                              {part.share !== undefined && (
                                <div className="religion-share-track" aria-hidden="true">
                                  <span style={{ width: `${part.share * 100}%` }} />
                                </div>
                              )}
                              {part.share === undefined && (
                                <p className="source-note">{t('qualitative')}</p>
                              )}
                              {tradition.kind !== 'religion' ? (
                                <p className="source-note">{t(tradition.kind)}</p>
                              ) : (
                                substantial && <p className="source-note">{t('substantial')}</p>
                              )}
                              {part.note && (
                                <Localized
                                  as="p"
                                  className="source-note"
                                  value={part.note}
                                  locale={locale}
                                />
                              )}
                            </li>
                          );
                        })}
                    </ul>
                    <h3>{t('scope')}</h3>
                    <Localized as="p" value={detail.populationScope} locale={locale} />
                    {detail.note && (
                      <Localized
                        as="p"
                        className="source-note"
                        value={detail.note}
                        locale={locale}
                      />
                    )}
                    <h3>{religionText(locale, 'sources')}</h3>
                    <ul className="religion-sources">
                      {dataset.sources
                        .filter((source) => sourceIds.has(source.id))
                        .map((source) => (
                          <li key={source.id}>
                            <a href={source.url} target="_blank" rel="noopener noreferrer">
                              {source.title}
                              <ArrowUpRight size={13} aria-hidden="true" />
                            </a>
                          </li>
                        ))}
                    </ul>
                  </>
                )}
              </>
            ) : (
              <>
                <h3>{religionText(locale, 'legend')}</h3>
                <ul className="religion-coverage-key">
                  <li>
                    <span className="religion-coverage-swatch" aria-hidden="true" />
                    {t('majorityKey')}
                  </li>
                  <li>
                    <span className="religion-coverage-swatch hatched" aria-hidden="true" />
                    {t('minorityKey')}
                  </li>
                  <li>
                    <span className="religion-coverage-swatch neutral" aria-hidden="true" />
                    {t('neutralKey')}
                  </li>
                </ul>
                {dataset && mappedTraditionIds.size > 0 && (
                  <ul className="religion-coverage-colours" aria-label={t('colours')}>
                    {dataset.traditions
                      .filter((item) => mappedTraditionIds.has(item.id))
                      .map((item) => (
                        <li key={item.id}>
                          <span
                            className="religion-color-chip"
                            style={colorStyle(item.color)}
                            aria-hidden="true"
                          />
                          <Localized value={religionTraditionNames(item.names)} locale={locale} />
                        </li>
                      ))}
                  </ul>
                )}
                <p className="source-note">{t('qualitativeKey')}</p>
                <p className="source-note">{t('unknownKey')}</p>
                {dataset && (
                  <p className="source-note">
                    {t('freshness').replace('{years}', String(dataset.snapshotMaxAge))}
                  </p>
                )}
                <label className="religion-coverage-filter">
                  {t('filter')}
                  <select
                    value={filter ?? ''}
                    onChange={(event) =>
                      useAtlasStore.getState().setReligionFilter(event.target.value || null)
                    }
                  >
                    <option value="">{t('all')}</option>
                    {traditions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {localizedName(religionTraditionNames(item.names), locale)}
                      </option>
                    ))}
                    {filter && !traditions.some((item) => item.id === filter) && (
                      <option value={filter}>
                        {dataset?.traditions.find((item) => item.id === filter)
                          ? localizedName(
                              religionTraditionNames(
                                dataset.traditions.find((item) => item.id === filter)!.names,
                              ),
                              locale,
                            )
                          : filter}
                      </option>
                    )}
                  </select>
                </label>
                <h3>
                  {t('regions')} ({visibleObservations.length})
                </h3>
                {status === 'ready' && visibleObservations.length === 0 && <p>{t('empty')}</p>}
                <ul className="religion-coverage-regions">
                  {regions.map((row) => {
                    const group = dataset ? religionCoverageClasses(dataset, row).majority : null;
                    const tradition = dataset?.traditions.find((item) => item.id === group);
                    return (
                      <li key={row.id}>
                        <button
                          type="button"
                          data-testid={`religion-region-${row.id}`}
                          onClick={() => select(row)}
                        >
                          <span
                            className="religion-color-chip"
                            style={colorStyle(tradition?.color ?? '#a0b1b9')}
                            aria-hidden="true"
                          />
                          <span>
                            <Localized value={regionNames.get(row.regionId)!} locale={locale} />
                            <small>{observationDate(row, horizon, locale)}</small>
                          </span>
                          <ArrowUpRight size={13} aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            {selected && <ReligionViewSwitch />}
            <p className="source-note religion-coverage-note">{t('note')}</p>
          </div>
        </section>
      )}
    </>
  );
}
