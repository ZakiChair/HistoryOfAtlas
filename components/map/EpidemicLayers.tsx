'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ArrowLeft, ArrowUpRight, X } from 'lucide-react';
import { useAtlasStore } from '@/lib/store';
import { useEpidemicStore } from '@/lib/epidemics/store';
import { epidemicLanguage, epidemicMilestonesAt } from '@/lib/epidemics/time';
import { epidemicText, type EpidemicCopyKey } from '@/lib/epidemics/i18n';
import type { EpidemicMilestone, EpidemicToll } from '@/lib/epidemics/types';
import { EPIDEMIC_GRACE_YEARS } from '@/lib/epidemics/time';
import { EPIDEMIC_SYMBOLS } from '@/lib/epidemics/icons';
import { formatYear } from '@/lib/histdate';
import Localized from '../ui/Localized';
import MilestoneKey, { ThemeIcon } from './MilestoneKey';
import { EPIDEMIC_INK } from './epidemic-sprites';

const tollText = (toll: EpidemicToll, locale: string, t: (key: EpidemicCopyKey) => string) => {
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  const figure = (value: number) =>
    toll.kind === 'share' ? percent.format(value) : value.toLocaleString(locale);
  const amount =
    toll.value !== undefined
      ? figure(toll.value)
      : toll.min !== undefined && toll.max !== undefined
        ? `${figure(toll.min)} — ${figure(toll.max)}`
        : toll.min !== undefined
          ? `≥ ${figure(toll.min)}`
          : `≤ ${figure(toll.max ?? 0)}`;
  return `${amount} ${toll.kind === 'deaths' ? t('deaths') : toll.kind === 'cases' ? t('cases') : t('share')}`;
};

export default function EpidemicLayers({
  panelId,
  onClose,
}: {
  panelId: string;
  onClose: () => void;
}) {
  const locale = useAtlasStore((state) => state.locale);
  const year = useAtlasStore((state) => state.year);
  const range = useAtlasStore((state) => state.range);
  const filter = useAtlasStore((state) => state.epidemicFilter);
  // Named fields only: the store also carries a retry revision, which must not redraw the panel.
  const { status, dataset, visibleMilestones, selected, panelOpen } = useEpidemicStore(
    useShallow((state) => ({
      status: state.status,
      dataset: state.dataset,
      visibleMilestones: state.visibleMilestones,
      selected: state.selected,
      panelOpen: state.panelOpen,
    })),
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const t = (key: EpidemicCopyKey) => epidemicText(locale, key);
  const horizon = range?.[1] ?? year;
  // Scanning the corpus is the panel's one costly step; the year and range decide its result.
  const allVisible = useMemo(
    () => (dataset ? epidemicMilestonesAt(dataset, year, range) : []),
    [dataset, year, range],
  );
  const disease = dataset?.diseases.find((item) => item.id === (selected?.diseaseId ?? filter));
  // The key draws the filtered disease's symbols, otherwise those of the disease with
  // the most milestones: a stable, frequently seen example rather than catalogue order.
  const mostDocumented = useMemo(
    () =>
      dataset?.diseases.reduce((best, item) => {
        const count = (id: string) =>
          dataset.milestones.filter((stage) => stage.diseaseId === id).length;
        return count(item.id) > count(best.id) ? item : best;
      }),
    [dataset],
  );
  const keyDisease = disease ?? mostDocumented;
  // The outbreak the selection closes, and the earliest eradication closing the selection.
  const closureTarget = selected?.closesId
    ? dataset?.milestones.find((item) => item.id === selected.closesId)
    : undefined;
  const closer = useMemo(() => {
    if (!selected || !dataset) return undefined;
    return dataset.milestones
      .filter((item) => item.closesId === selected.id)
      .sort((a, b) => a.year - b.year)[0];
  }, [dataset, selected]);
  // Earliest eradication year per closed outbreak, for the chronology.
  const closedAt = useMemo(() => {
    const map = new Map<string, number>();
    for (const stage of dataset?.milestones ?? [])
      if (stage.closesId)
        map.set(stage.closesId, Math.min(map.get(stage.closesId) ?? Infinity, stage.year));
    return map;
  }, [dataset]);
  const stages = useMemo(
    () =>
      dataset
        ? (disease
            ? dataset.milestones.filter((item) => item.diseaseId === disease.id)
            : visibleMilestones
          )
            .slice()
            .sort((a, b) => a.year - b.year || a.id.localeCompare(b.id))
        : [],
    [dataset, disease, visibleMilestones],
  );

  useEffect(() => {
    if (panelOpen) {
      if (body.current) body.current.scrollTop = 0;
      heading.current?.focus({ preventScroll: true });
    }
  }, [panelOpen, selected?.id]);

  const visit = (stage: EpidemicMilestone) => {
    if (body.current) body.current.scrollTop = 0;
    const atlas = useAtlasStore.getState();
    atlas.patchState({
      year: stage.year,
      range: null,
      playing: false,
      campaignPlaying: false,
      entityFollowing: false,
      battlePlaying: false,
      camera: {
        ...atlas.camera,
        lon: stage.coordinates[0],
        lat: stage.coordinates[1],
        zoom: Math.max(4.5, atlas.camera.zoom),
      },
    });
    useEpidemicStore.getState().select(stage);
  };

  const stageDates = (stage: EpidemicMilestone) =>
    stage.endYear === undefined
      ? `${formatYear(stage.year, locale)} — ${t('ongoing')}`
      : stage.endYear === stage.year
        ? formatYear(stage.year, locale)
        : `${formatYear(stage.year, locale)} — ${formatYear(stage.endYear, locale)}`;

  return (
    <>
      <div className="religion-layer-note" data-testid="epidemics-status">
        <span>{t('through').replace('{year}', formatYear(horizon, locale))}</span>
        {filter && (
          <span className="religion-active-filter">
            {disease ? <Localized value={disease.names} locale={locale} /> : filter}
          </span>
        )}
        {(status === 'idle' || status === 'loading') && <span role="status">{t('loading')}</span>}
        {status === 'ready' && (
          <span>
            {t(visibleMilestones.length ? 'count' : 'empty').replace(
              '{count}',
              visibleMilestones.length.toLocaleString(locale),
            )}
          </span>
        )}
        {status === 'error' && (
          <span role="alert">
            {t('error')}{' '}
            <button type="button" onClick={() => useEpidemicStore.getState().retry()}>
              {t('retry')}
            </button>
          </span>
        )}
      </div>
      {panelOpen && (
        <section
          id={panelId}
          className="religion-layer-card"
          aria-labelledby={`${panelId}-heading`}
          data-testid={selected ? 'epidemic-detail' : 'epidemics-panel'}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }
          }}
        >
          <div className="religion-card-heading">
            <h2 id={`${panelId}-heading`} ref={heading} tabIndex={-1}>
              {selected ? <Localized value={selected.title} locale={locale} /> : t('title')}
            </h2>
            <button type="button" className="icon-button" aria-label={t('close')} onClick={onClose}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="religion-card-body" ref={body}>
            {selected ? (
              <>
                <button
                  type="button"
                  className="religion-back"
                  onClick={() => useEpidemicStore.getState().select(null)}
                >
                  <ArrowLeft size={14} aria-hidden="true" />
                  {t('back')}
                </button>
                {disease && (
                  <p className="religion-tradition-name">
                    <ThemeIcon
                      theme={disease}
                      symbols={EPIDEMIC_SYMBOLS}
                      fallback="influenza"
                      ink={EPIDEMIC_INK}
                    />
                    <Localized value={disease.names} locale={locale} />
                  </p>
                )}
                <p className="religion-stage-date">
                  {t(selected.kind)} ·{' '}
                  {selected.approximate && <abbr title={t('approximate')}>≈ </abbr>}
                  {stageDates(selected)}
                </p>
                <Localized as="p" value={selected.description} locale={locale} />
                <h3>{t('vectors')}</h3>
                <ul className="religion-mechanisms">
                  {selected.mechanisms.map((vector) => (
                    <li key={vector}>{t(vector)}</li>
                  ))}
                </ul>
                {closureTarget && (
                  <p className="religion-stage-relation">
                    {t('closes')}{' '}
                    <button type="button" onClick={() => visit(closureTarget)}>
                      <Localized value={closureTarget.title} locale={locale} />
                    </button>
                  </p>
                )}
                {closer && (
                  <p className="religion-stage-relation">
                    {t('closedBy').replace('{year}', formatYear(closer.year, locale))}{' '}
                    <button type="button" onClick={() => visit(closer)}>
                      <Localized value={closer.title} locale={locale} />
                    </button>
                  </p>
                )}
                {selected.toll?.length ? (
                  <>
                    <h3>{t('toll')}</h3>
                    <ul className="religion-mechanisms">
                      {selected.toll.map((entry, index) => (
                        <li key={index}>
                          {tollText(entry, locale, t)} —{' '}
                          <Localized value={entry.scope} locale={locale} />
                          {entry.sourceIds.map((sourceId) => {
                            const source = dataset?.sources.find((item) => item.id === sourceId);
                            return source ? (
                              <a
                                key={source.id}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {' '}
                                {source.title}
                                <ArrowUpRight size={13} aria-hidden="true" />
                              </a>
                            ) : null;
                          })}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {selected.area && (
                  <p className="religion-area-caption">
                    {t('legendArea')} · <Localized value={selected.area.label} locale={locale} />
                  </p>
                )}
                <h3>{t('sources')}</h3>
                <ul className="religion-sources">
                  {dataset?.sources
                    .filter((source) => selected.sourceIds.includes(source.id))
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
            ) : (
              <>
                {keyDisease && (
                  <MilestoneKey
                    locale={locale}
                    theme={keyDisease}
                    index={dataset?.diseases.indexOf(keyDisease) ?? 0}
                    symbols={EPIDEMIC_SYMBOLS}
                    fallback="influenza"
                    ink={EPIDEMIC_INK}
                    text={(key) => t(key as EpidemicCopyKey)}
                    rows={['origin', 'milestone', 'contraction', 'age', 'dot', 'area', 'route']}
                  />
                )}
                <h3>{t('filter')}</h3>
                <div className="religion-traditions" role="group" aria-label={t('filter')}>
                  <button
                    type="button"
                    aria-pressed={filter === null}
                    data-testid="epidemic-filter-all"
                    onClick={() => useAtlasStore.getState().setEpidemicFilter(null)}
                  >
                    <span>{t('all')}</span>
                    <span>{allVisible.length}</span>
                  </button>
                  {dataset?.diseases.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      aria-pressed={filter === item.id}
                      data-testid={`epidemic-filter-${item.id}`}
                      onClick={() => useAtlasStore.getState().setEpidemicFilter(item.id)}
                    >
                      <ThemeIcon
                        theme={item}
                        symbols={EPIDEMIC_SYMBOLS}
                        fallback="influenza"
                        ink={EPIDEMIC_INK}
                      />
                      <Localized value={item.names} locale={locale} />
                      <span className="religion-tradition-count">
                        {allVisible.filter((stage) => stage.diseaseId === item.id).length}
                      </span>
                    </button>
                  ))}
                </div>
                {filter && !disease && status === 'ready' && <p>{t('unknown')}</p>}
                {disease && (
                  <Localized
                    as="p"
                    className="religion-tradition-description"
                    value={disease.description}
                    locale={locale}
                  />
                )}
              </>
            )}
            {stages.length > 0 && (
              <>
                <h3>{t('stages')}</h3>
                <ol className="religion-stages" data-testid="epidemic-stages">
                  {stages.map((stage) => {
                    const closed = closedAt.get(stage.id);
                    const isClosed = closed !== undefined && closed <= horizon;
                    return (
                      <li
                        key={stage.id}
                        className={
                          [
                            stage.year > horizon ? 'religion-stage-future' : undefined,
                            isClosed ? 'religion-stage-closed' : undefined,
                          ]
                            .filter(Boolean)
                            .join(' ') || undefined
                        }
                      >
                        <button
                          type="button"
                          data-testid={`epidemic-stage-${stage.id}`}
                          aria-current={selected?.id === stage.id ? 'step' : undefined}
                          title={t('visit')}
                          onClick={() => visit(stage)}
                        >
                          <span className="religion-stage-year">
                            {stage.approximate && '≈ '}
                            {stageDates(stage)}
                          </span>
                          <span>
                            <Localized value={stage.title} locale={locale} />
                            {stage.year > horizon && <small>{t('future')}</small>}
                            {stage.endYear !== undefined &&
                              stage.endYear + EPIDEMIC_GRACE_YEARS < horizon && (
                                <small>
                                  {t('past').replace('{year}', formatYear(stage.endYear, locale))}
                                </small>
                              )}
                            {isClosed && (
                              <small>
                                {t('closedShort').replace('{year}', formatYear(closed, locale))}
                              </small>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
            <p className="religion-coverage">
              {t('coverage')}
              {epidemicLanguage(locale) !== locale && (
                <span data-testid="epidemic-language-note"> {t('englishFallback')}</span>
              )}
            </p>
          </div>
        </section>
      )}
    </>
  );
}
