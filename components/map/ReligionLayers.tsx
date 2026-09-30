'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ArrowLeft, ArrowUpRight, X } from 'lucide-react';
import { useAtlasStore } from '@/lib/store';
import { useReligionStore } from '@/lib/religions/store';
import { religionLanguage, religionMilestonesAt } from '@/lib/religions/time';
import { religionText } from '@/lib/religions/i18n';
import { religionTraditionNames } from '@/lib/religions/tradition-names';
import type { ReligionMilestone } from '@/lib/religions/types';
import { formatYear } from '@/lib/histdate';
import Localized from '../ui/Localized';
import ReligionKey, { TraditionIcon } from './ReligionKey';
import ReligionDominantLayers from './ReligionDominantLayers';
import ReligionViewSwitch from './ReligionViewSwitch';

export default function ReligionLayers(props: { panelId: string; onClose: () => void }) {
  const view = useAtlasStore((state) => state.religionView);
  return view === 'history' ? (
    <ReligionHistoryLayers {...props} />
  ) : (
    <ReligionDominantLayers {...props} />
  );
}

function ReligionHistoryLayers({ panelId, onClose }: { panelId: string; onClose: () => void }) {
  const locale = useAtlasStore((state) => state.locale);
  const year = useAtlasStore((state) => state.year);
  const range = useAtlasStore((state) => state.range);
  const filter = useAtlasStore((state) => state.religionFilter);
  const routes = useAtlasStore((state) => state.religionRoutesVisible);
  const areas = useAtlasStore((state) => state.religionAreasVisible);
  // Named fields only: the store also carries a retry revision, which must not redraw the panel.
  const { status, dataset, visibleMilestones, selected, panelOpen } = useReligionStore(
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
  const t = (key: Parameters<typeof religionText>[1]) => religionText(locale, key);
  const horizon = range?.[1] ?? year;
  // Scanning the corpus is the panel's one costly step; the year and range decide its result.
  const allVisible = useMemo(
    () => (dataset ? religionMilestonesAt(dataset, year, range) : []),
    [dataset, year, range],
  );
  const tradition = dataset?.traditions.find(
    (item) => item.id === (selected?.traditionId ?? filter),
  );
  // The key draws the filtered tradition's symbols, otherwise those of the tradition with
  // the most milestones: a stable, frequently seen example rather than catalogue order.
  const mostDocumented = useMemo(
    () =>
      dataset?.traditions.reduce((best, item) => {
        const count = (id: string) =>
          dataset.milestones.filter((stage) => stage.traditionId === id).length;
        return count(item.id) > count(best.id) ? item : best;
      }),
    [dataset],
  );
  const keyTradition = tradition ?? mostDocumented;
  // The milestone the selection closes, and the earliest contraction closing the selection.
  const closureTarget = selected?.closesId
    ? dataset?.milestones.find((item) => item.id === selected.closesId)
    : undefined;
  const closer = useMemo(() => {
    if (!selected || !dataset) return undefined;
    return dataset.milestones
      .filter((item) => item.closesId === selected.id)
      .sort((a, b) => a.year - b.year)[0];
  }, [dataset, selected]);
  // Earliest contraction year per closed centre, for the chronology.
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
        ? (tradition
            ? dataset.milestones.filter((item) => item.traditionId === tradition.id)
            : visibleMilestones
          )
            .slice()
            .sort((a, b) => a.year - b.year || a.id.localeCompare(b.id))
        : [],
    [dataset, tradition, visibleMilestones],
  );

  useEffect(() => {
    if (panelOpen) {
      if (body.current) body.current.scrollTop = 0;
      heading.current?.focus({ preventScroll: true });
    }
  }, [panelOpen, selected?.id]);

  const visit = (stage: ReligionMilestone) => {
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
    useReligionStore.getState().select(stage);
  };

  return (
    <>
      <div className="religion-layer-note" data-testid="religions-status">
        <span>{t('through').replace('{year}', formatYear(horizon, locale))}</span>
        {filter && (
          <span className="religion-active-filter">
            {tradition ? (
              <Localized value={religionTraditionNames(tradition.names)} locale={locale} />
            ) : (
              filter
            )}
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
            <button type="button" onClick={() => useReligionStore.getState().retry()}>
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
          data-testid={selected ? 'religion-detail' : 'religions-panel'}
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
            <ReligionViewSwitch />
            {selected ? (
              <>
                <button
                  type="button"
                  className="religion-back"
                  onClick={() => useReligionStore.getState().select(null)}
                >
                  <ArrowLeft size={14} aria-hidden="true" />
                  {t('back')}
                </button>
                {tradition && (
                  <p className="religion-tradition-name">
                    <TraditionIcon tradition={tradition} />
                    <Localized value={religionTraditionNames(tradition.names)} locale={locale} />
                  </p>
                )}
                <p className="religion-stage-date">
                  {t(selected.kind)} ·{' '}
                  {selected.approximate && <abbr title={t('approximate')}>≈ </abbr>}
                  {formatYear(selected.year, locale)}
                </p>
                <Localized as="p" value={selected.description} locale={locale} />
                <h3>{t('mechanisms')}</h3>
                <ul className="religion-mechanisms">
                  {selected.mechanisms.map((mechanism) => (
                    <li key={mechanism}>{t(mechanism)}</li>
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
                {selected.area && (
                  <p className="religion-area-caption">
                    {t('areas')} · <Localized value={selected.area.label} locale={locale} />
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
                <div className="religion-display-options" role="group" aria-label={t('title')}>
                  <label>
                    <input
                      type="checkbox"
                      data-testid="religions-routes-toggle"
                      checked={routes}
                      onChange={(event) =>
                        useAtlasStore.getState().setReligionRoutesVisible(event.target.checked)
                      }
                    />
                    {t('routes')}
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      data-testid="religions-areas-toggle"
                      checked={areas}
                      onChange={(event) =>
                        useAtlasStore.getState().setReligionAreasVisible(event.target.checked)
                      }
                    />
                    {t('areas')}
                  </label>
                </div>
                {keyTradition && (
                  <ReligionKey
                    locale={locale}
                    tradition={keyTradition}
                    index={dataset?.traditions.indexOf(keyTradition) ?? 0}
                  />
                )}
                <h3>{t('filter')}</h3>
                <div className="religion-traditions" role="group" aria-label={t('filter')}>
                  <button
                    type="button"
                    aria-pressed={filter === null}
                    data-testid="religion-filter-all"
                    onClick={() => useAtlasStore.getState().setReligionFilter(null)}
                  >
                    <span>{t('all')}</span>
                    <span>{allVisible.length}</span>
                  </button>
                  {dataset?.traditions.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      aria-pressed={filter === item.id}
                      data-testid={`religion-filter-${item.id}`}
                      onClick={() => useAtlasStore.getState().setReligionFilter(item.id)}
                    >
                      <TraditionIcon tradition={item} />
                      <Localized value={religionTraditionNames(item.names)} locale={locale} />
                      <span className="religion-tradition-count">
                        {allVisible.filter((stage) => stage.traditionId === item.id).length}
                      </span>
                    </button>
                  ))}
                </div>
                {filter && !tradition && status === 'ready' && <p>{t('unknown')}</p>}
                {tradition && (
                  <Localized
                    as="p"
                    className="religion-tradition-description"
                    value={tradition.description}
                    locale={locale}
                  />
                )}
              </>
            )}
            {stages.length > 0 && (
              <>
                <h3>{t('stages')}</h3>
                <ol className="religion-stages" data-testid="religion-stages">
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
                          data-testid={`religion-stage-${stage.id}`}
                          aria-current={selected?.id === stage.id ? 'step' : undefined}
                          title={t('visit')}
                          onClick={() => visit(stage)}
                        >
                          <span className="religion-stage-year">
                            {stage.approximate && '≈ '}
                            {formatYear(stage.year, locale)}
                          </span>
                          <span>
                            <Localized value={stage.title} locale={locale} />
                            {stage.year > horizon && <small>{t('future')}</small>}
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
              {religionLanguage(locale) !== locale && (
                <span data-testid="religion-language-note"> {t('englishFallback')}</span>
              )}
            </p>
          </div>
        </section>
      )}
    </>
  );
}
