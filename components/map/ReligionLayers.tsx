'use client';

import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowUpRight, X } from 'lucide-react';
import { useAtlasStore } from '@/lib/store';
import { useReligionStore } from '@/lib/religions/store';
import { religionLabel, religionMilestonesAt } from '@/lib/religions/time';
import { religionText } from '@/lib/religions/i18n';
import { RELIGION_SYMBOLS } from '@/lib/religions/icons';
import type { ReligionMilestone, ReligionTradition } from '@/lib/religions/types';
import { formatYear } from '@/lib/histdate';

function TraditionIcon({ tradition }: { tradition: ReligionTradition }) {
  return (
    <svg
      className="religion-icon"
      viewBox="0 0 32 32"
      aria-hidden="true"
      style={{ color: tradition.color }}
    >
      {(RELIGION_SYMBOLS[tradition.symbol] ?? []).map((path, index) => (
        <path
          key={index}
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

export default function ReligionLayers({
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
  const routes = useAtlasStore((state) => state.religionRoutesVisible);
  const areas = useAtlasStore((state) => state.religionAreasVisible);
  const { status, dataset, visibleMilestones, selected, panelOpen } = useReligionStore();
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const t = (key: Parameters<typeof religionText>[1]) => religionText(locale, key);
  const horizon = range?.[1] ?? year;
  const allVisible = dataset ? religionMilestonesAt(dataset, year, range) : [];
  const tradition = dataset?.traditions.find(
    (item) => item.id === (selected?.traditionId ?? filter),
  );
  const stages = dataset
    ? (tradition
        ? dataset.milestones.filter((item) => item.traditionId === tradition.id)
        : visibleMilestones
      )
        .slice()
        .sort((a, b) => a.year - b.year || a.id.localeCompare(b.id))
    : [];

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
            {tradition ? religionLabel(tradition.names, locale) : filter}
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
              {selected ? religionLabel(selected.title, locale) : t('title')}
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
                  onClick={() => useReligionStore.getState().select(null)}
                >
                  <ArrowLeft size={14} aria-hidden="true" />
                  {t('back')}
                </button>
                {tradition && (
                  <p className="religion-tradition-name">
                    <TraditionIcon tradition={tradition} />
                    {religionLabel(tradition.names, locale)}
                  </p>
                )}
                <p className="religion-stage-date">
                  {t(selected.kind)} ·{' '}
                  {selected.approximate && <abbr title={t('approximate')}>≈ </abbr>}
                  {formatYear(selected.year, locale)}
                </p>
                <p>{religionLabel(selected.description, locale)}</p>
                <h3>{t('mechanisms')}</h3>
                <ul className="religion-mechanisms">
                  {selected.mechanisms.map((mechanism) => (
                    <li key={mechanism}>{t(mechanism)}</li>
                  ))}
                </ul>
                {selected.area && (
                  <p className="religion-area-caption">
                    {t('areas')} · {religionLabel(selected.area.label, locale)}
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
                      <span>{religionLabel(item.names, locale)}</span>
                      <span className="religion-tradition-count">
                        {allVisible.filter((stage) => stage.traditionId === item.id).length}
                      </span>
                    </button>
                  ))}
                </div>
                {filter && !tradition && status === 'ready' && <p>{t('unknown')}</p>}
                {tradition && (
                  <p className="religion-tradition-description">
                    {religionLabel(tradition.description, locale)}
                  </p>
                )}
              </>
            )}
            {stages.length > 0 && (
              <>
                <h3>{t('stages')}</h3>
                <ol className="religion-stages" data-testid="religion-stages">
                  {stages.map((stage) => (
                    <li
                      key={stage.id}
                      className={stage.year > horizon ? 'religion-stage-future' : undefined}
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
                          {religionLabel(stage.title, locale)}
                          {stage.year > horizon && <small>{t('future')}</small>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </>
            )}
            <p className="religion-coverage">{t('coverage')}</p>
          </div>
        </section>
      )}
    </>
  );
}
