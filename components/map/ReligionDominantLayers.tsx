'use client';

import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ArrowLeft, ArrowUpRight, X } from 'lucide-react';
import { useAtlasStore } from '@/lib/store';
import { formatYear } from '@/lib/histdate';
import { localizedName } from '@/lib/i18n';
import { useReligionStore } from '@/lib/religions/store';
import { useReligionCoverageStore } from '@/lib/religions/coverage-store';
import { useReligionPolityStore } from '@/lib/religions/polities-store';
import { religionPolitiesAt, religionPolityFamilies } from '@/lib/religions/polities';
import {
  religionCoverageClasses,
  type ReligionCoverageEntry,
  type ReligionCoverageShare,
} from '@/lib/religions/coverage';
import { religionCoverageText, type ReligionCoverageCopyKey } from '@/lib/religions/coverage-i18n';
import { religionText } from '@/lib/religions/i18n';
import { religionLabel } from '@/lib/religions/time';
import { religionTraditionNames } from '@/lib/religions/tradition-names';
import type { Locale, LocalizedName } from '@/lib/types';
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

export default function ReligionDominantLayers({
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
  // Named fields only: the stores also carry retry revisions, which must not redraw the panel.
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
  const {
    status: polityStatus,
    dataset: polityDataset,
    selectedEntity,
    retry: retryPolities,
    select: selectPolity,
  } = useReligionPolityStore(
    useShallow((state) => ({
      status: state.status,
      dataset: state.dataset,
      selectedEntity: state.selectedEntity,
      retry: state.retry,
      select: state.select,
    })),
  );
  const retryDetail = useReligionCoverageStore((state) => state.retryDetail);
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const t = (key: ReligionCoverageCopyKey) => religionCoverageText(locale, key);
  const horizon = range ? Math.max(...range) : year;
  const spansAt = useMemo(
    () => (polityDataset ? religionPolitiesAt(polityDataset, horizon, filter) : new Map()),
    [polityDataset, horizon, filter],
  );
  const familiesAt = useMemo(
    () => (polityDataset ? religionPolityFamilies(polityDataset, horizon) : new Map()),
    [polityDataset, horizon],
  );
  const polity = useMemo(
    () =>
      selectedEntity && polityDataset
        ? (polityDataset.polities.find((item) => item.entityId === selectedEntity.entityId) ?? null)
        : null,
    [selectedEntity, polityDataset],
  );
  const politySpan = polity?.spans.find((span) => span.from <= horizon && horizon <= span.to);
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
  const regionFamilyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!dataset) return counts;
    for (const row of visibleObservations) {
      const groups = religionCoverageClasses(dataset, row);
      for (const id of [groups.majority, ...groups.substantial])
        if (id && (!filter || id === filter)) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [dataset, visibleObservations, filter]);
  const familyUnion = useMemo(() => {
    const rows = new Map<string, { names: LocalizedName; color: string }>();
    for (const item of polityDataset?.families ?? [])
      rows.set(item.id, { names: item.names, color: item.color });
    for (const item of dataset?.traditions ?? [])
      if (!rows.has(item.id))
        rows.set(item.id, { names: religionTraditionNames(item.names), color: item.color });
    return rows;
  }, [polityDataset, dataset]);
  const legendFamilies = useMemo(
    () =>
      [...familyUnion.entries()]
        .filter(([id]) => familiesAt.has(id) || regionFamilyCounts.has(id))
        .map(([id, item]) => ({ id, ...item })),
    [familyUnion, familiesAt, regionFamilyCounts],
  );
  const referenceYears = useMemo(
    () =>
      visibleObservations.flatMap((row) => (row.time.kind === 'snapshot' ? [row.time.year] : [])),
    [visibleObservations],
  );
  const firstReferenceYear = Math.min(...referenceYears);
  const lastReferenceYear = Math.max(...referenceYears);
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
  }, [panelOpen, selected?.id, selectedEntity?.entityId]);

  const close = () => {
    select(null);
    selectPolity(null);
    onClose();
  };
  const polityFamily = (id: string) => familyUnion.get(id);
  const polityDetail = selectedEntity && (
    <div data-testid="religion-polity-detail">
      <button type="button" className="religion-back" onClick={() => selectPolity(null)}>
        <ArrowLeft size={14} aria-hidden="true" />
        {t('back')}
      </button>
      {politySpan ? (
        <>
          <p className="religion-coverage-majority">
            <span
              className="religion-color-chip"
              style={colorStyle(polityFamily(politySpan.familyId)?.color ?? '#a0b1b9')}
              aria-hidden="true"
            />
            <Localized
              value={polityFamily(politySpan.familyId)?.names ?? politySpan.label}
              locale={locale}
            />
          </p>
          <p className="source-note">
            {polityDataset?.evidence[politySpan.evidence] && (
              <Localized value={polityDataset.evidence[politySpan.evidence]} locale={locale} />
            )}
          </p>
          <p className="source-note">
            {t(
              politySpan.basis === 'seshat'
                ? 'basisSeshat'
                : politySpan.basis === 'wikidata'
                  ? 'basisWikidata'
                  : 'basisEditorial',
            )}
          </p>
          <p className="religion-coverage-date">
            {t('period')} : {formatYear(politySpan.from, locale)} —{' '}
            {formatYear(politySpan.to, locale)}
          </p>
          <Localized as="p" value={politySpan.label} locale={locale} />
          {politySpan.note && (
            <Localized as="p" className="source-note" value={politySpan.note} locale={locale} />
          )}
          {politySpan.state && (
            <p className="source-note">
              {t('stateReligion').replace(
                '{family}',
                localizedName(
                  polityFamily(politySpan.state.familyId)?.names ?? politySpan.state.label,
                  locale,
                ),
              )}
            </p>
          )}
          {politySpan.others && politySpan.others.length > 0 && (
            <>
              <h3>{t('othersWidespread')}</h3>
              <ul className="religion-shares">
                {politySpan.others.map((other, index) => (
                  <li key={index}>
                    <span
                      className="religion-color-chip"
                      style={colorStyle(polityFamily(other.familyId)?.color ?? '#a0b1b9')}
                      aria-hidden="true"
                    />
                    <Localized value={other.label} locale={locale} /> —{' '}
                    {t(
                      other.evidence === 'majority'
                        ? 'otherMajority'
                        : other.evidence === 'substantial'
                          ? 'otherSubstantial'
                          : 'otherPresence',
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {politySpan.ambiguous && (
            <p className="source-note">
              {t('ambiguousWikidata')}
              {politySpan.alternatives?.length
                ? ` : ${politySpan.alternatives
                    .map((item) => localizedName(item.label, locale))
                    .join(', ')}`
                : ''}
            </p>
          )}
          {politySpan.sourceIds.length > 0 && (
            <>
              <h3>{religionText(locale, 'sources')}</h3>
              <ul className="religion-sources">
                {(polityDataset?.sources ?? [])
                  .filter((source) => politySpan.sourceIds.includes(source.id))
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
          {politySpan.links && politySpan.links.length > 0 && (
            <ul className="religion-sources">
              {politySpan.links.map((link, index) => (
                <li key={index}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.label}
                    <ArrowUpRight size={13} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p>
          {t('noAttribution')
            .replace('{name}', selectedEntity.name)
            .replace('{year}', formatYear(horizon, locale))}
        </p>
      )}
      {polity && polity.spans.filter((s) => s !== politySpan).length > 0 && (
        <ul>
          {polity.spans
            .filter((s) => s !== politySpan)
            .map((s, index) => (
              <li key={index} className="source-note">
                {t('otherDates')
                  .replace('{from}', formatYear(s.from, locale))
                  .replace('{to}', formatYear(s.to, locale))
                  .replace(
                    '{family}',
                    localizedName(polityFamily(s.familyId)?.names ?? s.label, locale),
                  )}
              </li>
            ))}
        </ul>
      )}
      {polity?.wikidata && polity.wikidata.length > 0 && (
        <>
          <h3>{t('wikidataList')}</h3>
          <ul>
            {polity.wikidata.map((entry, index) => (
              <li key={index} className="source-note">
                <Localized value={entry.label} locale={locale} />
                {entry.from !== undefined || entry.to !== undefined
                  ? ` (${formatYear(entry.from ?? year, locale)}–${formatYear(entry.to ?? year, locale)})`
                  : ''}
              </li>
            ))}
          </ul>
        </>
      )}
      {polity?.secular?.map((entry, index) => (
        <p key={index} className="source-note">
          {t('secular')
            .replace('{label}', localizedName(entry.label, locale))
            .replace('{from}', formatYear(entry.from, locale))
            .replace('{to}', formatYear(entry.to, locale))}
        </p>
      ))}
      <button
        type="button"
        onClick={() =>
          useAtlasStore.getState().patchState({
            selectedEntity: selectedEntity.entityId,
            selectedEvent: null,
            selectedPerson: null,
          })
        }
      >
        {t('openEntity')}
      </button>
    </div>
  );
  return (
    <>
      <div className="religion-layer-note" data-testid="religions-status">
        <span>{t('selectedYear').replace('{year}', formatYear(horizon, locale))}</span>
        {(polityStatus === 'idle' || polityStatus === 'loading') && (
          <span role="status">{t('loading')}</span>
        )}
        {polityStatus === 'ready' && (
          <span>{t('politiesCount').replace('{count}', spansAt.size.toLocaleString(locale))}</span>
        )}
        {status === 'ready' && (
          <span>
            {visibleObservations.length
              ? t('coverageCount').replace(
                  '{count}',
                  visibleObservations.length.toLocaleString(locale),
                )
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
        {(status === 'error' || polityStatus === 'error') && (
          <span role="alert">
            {religionText(locale, 'error')}{' '}
            <button type="button" onClick={status === 'error' ? retry : retryPolities}>
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
              {selectedEntity ? (
                selectedEntity.name
              ) : selected ? (
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
            {!selected && !selectedEntity && <ReligionViewSwitch />}
            {selectedEntity ? (
              polityDetail
            ) : selected && dataset ? (
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
                    <span className="religion-coverage-swatch dominant" aria-hidden="true" />
                    {t('majorityPolityKey')}
                  </li>
                  <li>
                    <span className="religion-coverage-swatch predominant" aria-hidden="true" />
                    {t('predominantKey')}
                  </li>
                  <li>
                    <span className="religion-coverage-swatch state" aria-hidden="true" />
                    {t('stateKey')}
                  </li>
                  <li>
                    <span className="religion-coverage-swatch" aria-hidden="true" />
                    {t('quantitativeMajorityKey')}
                  </li>
                  <li>
                    <span className="religion-coverage-swatch hatched" aria-hidden="true" />
                    {t('quantitativeMinorityKey')}
                  </li>
                  <li>
                    <span className="religion-coverage-swatch neutral" aria-hidden="true" />
                    {t('undocumentedKey')}
                  </li>
                </ul>
                {legendFamilies.length > 0 && (
                  <ul className="religion-coverage-colours" aria-label={t('colours')}>
                    {legendFamilies.map((item) => (
                      <li key={item.id}>
                        <span
                          className="religion-color-chip"
                          style={colorStyle(item.color)}
                          aria-hidden="true"
                        />
                        <Localized value={item.names} locale={locale} />{' '}
                        <small>
                          {t('familyCounts')
                            .replace(
                              '{polities}',
                              String(
                                (familiesAt.get(item.id)?.majority ?? 0) +
                                  (familiesAt.get(item.id)?.predominant ?? 0) +
                                  (familiesAt.get(item.id)?.state ?? 0),
                              ),
                            )
                            .replace('{regions}', String(regionFamilyCounts.get(item.id) ?? 0))}
                        </small>
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
                    {[...familyUnion.entries()].map(([id, item]) => (
                      <option key={id} value={id}>
                        {localizedName(item.names, locale)}
                      </option>
                    ))}
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
                          onClick={() => {
                            selectPolity(null);
                            select(row);
                          }}
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
            {(selected || selectedEntity) && <ReligionViewSwitch />}
            <p className="source-note religion-coverage-note">{t('note')}</p>
            <p className="source-note religion-coverage-note">{t('polityNote')}</p>
          </div>
        </section>
      )}
    </>
  );
}
