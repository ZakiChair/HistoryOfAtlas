'use client';

import { useEffect, useId, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowUpRight, Check, ChevronDown, Gem, Swords, Waypoints, X } from 'lucide-react';
import { useAtlasStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import { formatYear } from '@/lib/histdate';
import { useResourceStore } from '@/lib/resources/store';
import { resourceText, type ResourceCopyKey } from '@/lib/resources/i18n';
import { RESOURCE_CATEGORIES } from '@/lib/resources/categories';
import { resourceKnowledge, resourcePeriodMatches } from '@/lib/resources/time';
import ResourceIcon from './ResourceIcon';
import { useReligionStore } from '@/lib/religions/store';

const ReligionLayers = dynamic(() => import('./ReligionLayers'), { ssr: false });
const religionLabels = {
  fr: ['Religions', 'Explorer les religions'],
  en: ['Religions', 'Explore religions'],
  de: ['Religionen', 'Religionen erkunden'],
  es: ['Religiones', 'Explorar religiones'],
  zh: ['宗教', '探索宗教'],
  ru: ['Религии', 'Изучить религии'],
};

export default function MapLayers() {
  const { locale } = useI18n();
  const text = (key: ResourceCopyKey) => resourceText(locale, key);
  const battlesVisible = useAtlasStore((state) => state.battlesVisible);
  const resourcesVisible = useAtlasStore((state) => state.resourcesVisible);
  const religionsVisible = useAtlasStore((state) => state.religionsVisible);
  const religionPanelOpen = useReligionStore((state) => state.panelOpen);
  const year = useAtlasStore((state) => state.year);
  const range = useAtlasStore((state) => state.range);
  const status = useResourceStore((state) => state.status);
  const sitesCount = useResourceStore((state) => state.sitesCount);
  const filteredSitesCount = useResourceStore((state) => state.filteredSitesCount);
  const categoryFilter = useResourceStore((state) => state.categoryFilter);
  const totalSitesCount = useResourceStore((state) => state.totalSitesCount);
  const selected = useResourceStore((state) => state.selected);
  const sources = useResourceStore((state) => state.sources);
  const categoryCounts = useResourceStore((state) => state.categoryCounts);
  const [legendOpen, setLegendOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const legendButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const religionLegendButton = useRef<HTMLButtonElement>(null);
  const religionPanelId = useId();
  const panelId = useId();
  const headingId = useId();
  const source = sources.find((item) => item.id === selected?.sourceId);
  const detailsOpen = resourcesVisible && !religionPanelOpen && (legendOpen || selected !== null);
  const formatYears = (fromYear: number, toYear: number) =>
    fromYear === toYear
      ? formatYear(fromYear, locale)
      : `${formatYear(fromYear, locale)} — ${formatYear(toYear, locale)}`;
  const currentPeriod = formatYears(range?.[0] ?? year, range?.[1] ?? year);
  const knownSince = selected
    ? resourceKnowledge(selected).filter((evidence) => evidence.fromYear <= (range?.[1] ?? year))
    : [];
  const exploitationAttested = selected?.periods.some((period) =>
    resourcePeriodMatches(period, year, range),
  );

  useEffect(() => {
    if (detailsOpen) heading.current?.focus({ preventScroll: true });
  }, [detailsOpen, selected?.id]);

  useEffect(() => {
    const element = container.current;
    const atlas = element?.closest<HTMLElement>('.atlas-app');
    if (!element || !atlas) return;
    const measure = () => {
      // The absolute detail cards do not contribute to the controls' height.
      atlas.style.setProperty(
        '--map-layers-bottom',
        `${element.offsetTop + element.offsetHeight}px`,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => {
      observer.disconnect();
      atlas.style.removeProperty('--map-layers-bottom');
    };
  }, []);

  useEffect(() => {
    const unsubscribeReligions = useReligionStore.subscribe((state, previous) => {
      if (state.panelOpen && !previous.panelOpen) {
        setLegendOpen(false);
        useResourceStore.getState().select(null);
      }
    });
    const unsubscribeResources = useResourceStore.subscribe((state, previous) => {
      if (state.selected && state.selected !== previous.selected)
        useReligionStore.getState().setPanelOpen(false);
    });
    return () => {
      unsubscribeReligions();
      unsubscribeResources();
    };
  }, []);

  const closeDetails = () => {
    useResourceStore.getState().select(null);
    setLegendOpen(false);
    legendButton.current?.focus();
  };
  const closeReligions = () => {
    useReligionStore.getState().setPanelOpen(false);
    religionLegendButton.current?.focus();
  };

  return (
    <div className="map-layers" data-testid="map-layers" ref={container}>
      <div className="map-layer-controls" role="group" aria-label={text('layers')}>
        <button
          type="button"
          className="map-layer-toggle"
          aria-pressed={battlesVisible}
          data-testid="battles-layer-toggle"
          onClick={() => useAtlasStore.getState().setBattlesVisible(!battlesVisible)}
        >
          <Swords size={15} aria-hidden="true" />
          <span>{text('battles')}</span>
          <span className="map-layer-check" aria-hidden="true">
            {battlesVisible && <Check size={11} />}
          </span>
        </button>
        <div className="map-layer-group">
          <button
            type="button"
            className="map-layer-toggle"
            aria-pressed={resourcesVisible}
            data-testid="resources-layer-toggle"
            onClick={() => {
              useAtlasStore.getState().setResourcesVisible(!resourcesVisible);
              if (resourcesVisible) {
                useResourceStore.getState().select(null);
                setLegendOpen(false);
              }
            }}
          >
            <Gem size={15} aria-hidden="true" />
            <span>{text('resources')}</span>
            <span className="map-layer-check" aria-hidden="true">
              {resourcesVisible && <Check size={11} />}
            </span>
          </button>
          {resourcesVisible && (
            <button
              type="button"
              className="map-layer-legend-toggle"
              aria-label={text('legend')}
              aria-expanded={detailsOpen}
              aria-controls={panelId}
              data-testid="resources-legend-toggle"
              ref={legendButton}
              onClick={() => {
                if (detailsOpen) closeDetails();
                else {
                  useReligionStore.getState().setPanelOpen(false);
                  setLegendOpen(true);
                }
              }}
            >
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="map-layer-group">
          <button
            type="button"
            className="map-layer-toggle"
            data-testid="religions-layer-toggle"
            aria-pressed={religionsVisible}
            onClick={() => {
              useAtlasStore.getState().setReligionsVisible(!religionsVisible);
              if (religionsVisible) useReligionStore.getState().setPanelOpen(false);
            }}
          >
            <Waypoints size={15} aria-hidden="true" />
            <span>{religionLabels[locale][0]}</span>
            <span className="map-layer-check" aria-hidden="true">
              {religionsVisible && <Check size={11} />}
            </span>
          </button>
          {religionsVisible && (
            <button
              type="button"
              className="map-layer-legend-toggle"
              data-testid="religions-legend-toggle"
              aria-label={religionLabels[locale][1]}
              aria-expanded={religionPanelOpen}
              aria-controls={religionPanelId}
              ref={religionLegendButton}
              onClick={() => {
                if (religionPanelOpen) closeReligions();
                else useReligionStore.getState().setPanelOpen(true);
              }}
            >
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {resourcesVisible && (
        <div className="resource-layer-note" data-testid="resources-status">
          <span data-testid="resource-current-period">
            {text('reference')} · {currentPeriod}
          </span>
          {categoryFilter && (
            <span className="resource-active-filter" data-testid="resources-active-filter">
              {text('activeFilter')} · {text(categoryFilter)}
            </span>
          )}
          {(status === 'idle' || status === 'loading') && (
            <span role="status" data-testid="resources-loading">
              {text('loading')}
            </span>
          )}
          {status === 'ready' && filteredSitesCount === 0 && (
            <span role="status" data-testid="resources-empty">
              {text(categoryFilter ? 'filteredEmpty' : 'empty')}
            </span>
          )}
          {status === 'error' && (
            <span role="alert" className="resource-load-error">
              {text('error')}
              <button type="button" onClick={() => useResourceStore.getState().retry()}>
                {text('retry')}
              </button>
            </span>
          )}
        </div>
      )}
      {religionsVisible && <ReligionLayers panelId={religionPanelId} onClose={closeReligions} />}
      {detailsOpen && (
        <section
          id={panelId}
          className="resource-layer-card"
          aria-labelledby={headingId}
          data-testid={selected ? 'resource-detail' : 'resource-legend'}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              closeDetails();
            }
          }}
        >
          <div className="resource-card-heading">
            <h2 id={headingId} ref={heading} tabIndex={-1}>
              {selected ? selected.name : text('legend')}
            </h2>
            <button
              type="button"
              className="icon-button"
              aria-label={text('close')}
              onClick={closeDetails}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="resource-card-body">
            {selected ? (
              <>
                <ul className="resource-categories">
                  {selected.categories.map((category) => (
                    <li key={category}>
                      <ResourceIcon category={category} />
                      {text(category)}
                    </li>
                  ))}
                </ul>
                <p
                  className="resource-exploitation-status"
                  data-testid="resource-exploitation-status"
                  data-exploitation={exploitationAttested ? 'attested' : 'unattested'}
                >
                  {text(
                    exploitationAttested ? 'exploitationAttested' : 'exploitationUnattested',
                  ).replace('{period}', currentPeriod)}
                </p>
                <dl className="resource-facts">
                  {selected.country && (
                    <div>
                      <dt>{text('location')}</dt>
                      <dd>{selected.country}</dd>
                    </div>
                  )}
                  <div>
                    <dt>{text('sourceYear')}</dt>
                    <dd>{selected.sourceYear}</dd>
                  </div>
                  {selected.accuracy && (
                    <div>
                      <dt>{text('accuracy')}</dt>
                      <dd>{text(selected.accuracy)}</dd>
                    </div>
                  )}
                </dl>
                <h3 className="resource-period-title">{text('knowledge')}</h3>
                <ol
                  className="resource-periods resource-knowledge"
                  data-testid="resource-knowledge"
                >
                  {knownSince.map((evidence, index) => (
                    <li key={`${evidence.kind}-${evidence.fromYear}-${index}`}>
                      <span className="resource-period-dates">
                        {text(evidence.kind)} ·{' '}
                        {evidence.approximate && <abbr title={text('approximateDates')}>≈ </abbr>}
                        {formatYear(evidence.fromYear, locale)}
                      </span>
                      <span className="resource-period-categories">
                        {evidence.categories.map((category) => text(category)).join(' · ')}
                      </span>
                      {evidence.description && (
                        <p className="resource-period-description">{evidence.description}</p>
                      )}
                      <a
                        className="resource-source-link"
                        href={evidence.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${text('knowledgeSource')} · ${text(evidence.kind)} · ${formatYear(evidence.fromYear, locale)}`}
                      >
                        {text('knowledgeSource')}
                        <ArrowUpRight size={13} aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ol>
                <h3 className="resource-period-title">{text('periods')}</h3>
                {!selected.periods.length && (
                  <p className="resource-coverage" data-testid="resource-no-exploitation">
                    {text('noExploitationPeriods')}
                  </p>
                )}
                <ol className="resource-periods" data-testid="resource-periods">
                  {selected.periods.map((period, index) => (
                    <li
                      key={`${period.fromYear}-${period.toYear}-${index}`}
                      className={
                        resourcePeriodMatches(period, year, range)
                          ? 'resource-period-current'
                          : undefined
                      }
                      aria-current={resourcePeriodMatches(period, year, range) ? 'date' : undefined}
                    >
                      <span className="resource-period-dates">
                        {period.approximate && <abbr title={text('approximateDates')}>≈ </abbr>}
                        {formatYears(period.fromYear, period.toYear)}
                      </span>
                      {period.categories && (
                        <span className="resource-period-categories">
                          {period.categories.map((category) => text(category)).join(' · ')}
                        </span>
                      )}
                      {period.description && (
                        <p className="resource-period-description">{period.description}</p>
                      )}
                      <a
                        className="resource-source-link"
                        href={period.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${text('periodSource')} · ${formatYears(period.fromYear, period.toYear)}`}
                      >
                        {text('periodSource')}
                        <ArrowUpRight size={13} aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ol>
                <a
                  className="resource-source-link"
                  href={selected.coordinateSourceUrl ?? selected.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {text('coordinateSource')}
                  <ArrowUpRight size={13} aria-hidden="true" />
                </a>
                {source && (
                  <p className="resource-source-license">
                    {source.name} ·{' '}
                    {source.licenseUrl ? (
                      <a href={source.licenseUrl} target="_blank" rel="noopener noreferrer">
                        {source.license}
                      </a>
                    ) : (
                      source.license
                    )}
                  </p>
                )}
                <p className="resource-coverage">{text('chronologyNote')}</p>
                <p className="resource-coverage">{text('coverage')}</p>
              </>
            ) : (
              <>
                {status === 'ready' && (
                  <>
                    {categoryFilter && (
                      <p className="resource-count" data-testid="resource-filtered-count">
                        {text('filteredSites')
                          .replace('{count}', filteredSitesCount.toLocaleString(locale))
                          .replace('{category}', text(categoryFilter))}
                      </p>
                    )}
                    <p className="resource-count" data-testid="resource-visible-count">
                      {text('sites').replace('{count}', sitesCount.toLocaleString(locale))}
                    </p>
                    <p className="resource-total-count" data-testid="resource-total-count">
                      {text('totalSites').replace(
                        '{count}',
                        totalSitesCount.toLocaleString(locale),
                      )}
                    </p>
                    {filteredSitesCount === 0 && (
                      <p className="resource-coverage">{text('emptyDetail')}</p>
                    )}
                  </>
                )}
                <div role="group" aria-label={text('filterResource')}>
                  <h3 className="resource-filter-title">{text('filterResource')}</h3>
                  <button
                    type="button"
                    className="resource-category-filter resource-filter-all"
                    data-testid="resource-filter-all"
                    aria-pressed={categoryFilter === null}
                    onClick={() => useResourceStore.getState().setCategoryFilter(null)}
                  >
                    <Gem size={16} aria-hidden="true" />
                    <span>{text('allResources')}</span>
                    {status === 'ready' && (
                      <span className="resource-category-count">
                        {sitesCount.toLocaleString(locale)}
                      </span>
                    )}
                  </button>
                  <ul className="resource-legend-list">
                    {RESOURCE_CATEGORIES.map((category) => (
                      <li key={category}>
                        <button
                          type="button"
                          className="resource-category-filter"
                          data-testid={`resource-filter-${category}`}
                          aria-pressed={categoryFilter === category}
                          onClick={() => useResourceStore.getState().setCategoryFilter(category)}
                        >
                          <ResourceIcon category={category} />
                          <span>{text(category)}</span>
                          {status === 'ready' && (
                            <span className="resource-category-count">
                              {(categoryCounts[category] ?? 0).toLocaleString(locale)}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="resource-coverage">{text('choose')}</p>
                <p className="resource-coverage">{text('clusters')}</p>
                <p className="resource-coverage">{text('chronologyNote')}</p>
                <p className="resource-coverage">{text('coverage')}</p>
                <details className="resource-sources">
                  <summary>{text('sources')}</summary>
                  <ul>
                    {sources.map((item) => (
                      <li key={item.id}>
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          {item.name} · {item.year}
                          <ArrowUpRight size={12} aria-hidden="true" />
                        </a>
                        {item.licenseUrl ? (
                          <a href={item.licenseUrl} target="_blank" rel="noopener noreferrer">
                            {item.license}
                          </a>
                        ) : (
                          <span>{item.license}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
