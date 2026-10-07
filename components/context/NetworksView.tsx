'use client';

import { ChevronDown, LocateFixed } from 'lucide-react';
import { formatYear } from '@/lib/histdate';
import { networksInPeriod, type NetworkDataset } from '@/lib/context/networks';
import { networkCamera } from '@/lib/context/network-geography';
import { networkText, type NetworkCopyKey } from '@/lib/context/networks-i18n';
import { contextContentLanguage, contextText, type ContextViewProps } from '@/lib/context/types';
import styles from './NetworksView.module.css';

export default function NetworksView({
  dataset,
  year,
  range,
  locale,
  selectedId,
  onSelect,
  onLocate,
}: ContextViewProps & { dataset: NetworkDataset }) {
  const text = (key: NetworkCopyKey) => networkText(locale, key);
  const language = contextContentLanguage(locale);
  const active = new Set(networksInPeriod(dataset.networks, year, range).map((item) => item.id));
  const displayedPeriod = range
    ? `${formatYear(range[0], locale)} – ${formatYear(range[1], locale)}`
    : formatYear(year, locale);

  return (
    <div className={styles.root} data-testid="networks-view">
      <p className={styles.lead}>{text('schematic')}</p>
      <details className={styles.coverage}>
        <summary>{text('reading')}</summary>
        <p lang={language} dir="auto">
          {contextText(dataset.coverage, locale)}
        </p>
      </details>
      {locale !== 'fr' && locale !== 'en' && <p className={styles.fallback}>{text('fallback')}</p>}
      <p className={styles.period}>
        {text('period')} : <bdi>{displayedPeriod}</bdi>
        <span>
          {text('within')} : {active.size} / {dataset.networks.length}
        </span>
      </p>
      {active.size === 0 && <p className={styles.empty}>{text('empty')}</p>}

      <ul className={styles.list}>
        {dataset.networks.map((network) => {
          const selected = network.id === selectedId;
          const inPeriod = active.has(network.id);
          const titleId = `context-network-title-${network.id}`;
          const detailsId = `context-network-details-${network.id}`;
          return (
            <li
              key={network.id}
              className={`${styles.item} ${selected ? styles.selected : ''}`}
              data-testid={`network-${network.id}`}
              data-in-period={inPeriod}
            >
              <button
                type="button"
                className={styles.select}
                aria-expanded={selected}
                aria-controls={selected ? detailsId : undefined}
                onClick={() => onSelect(selected ? null : network.id)}
              >
                <span className={styles.itemTitle} id={titleId} lang={language} dir="auto">
                  {contextText(network.title, locale)}
                </span>
                <ChevronDown size={14} aria-hidden="true" className={styles.chevron} />
                <span className={styles.meta}>
                  <span className={styles.kind} data-kind={network.kind}>
                    {text(network.kind)}
                  </span>
                  <bdi>
                    {network.approximate ? '≈ ' : ''}
                    {formatYear(network.fromYear, locale)} – {formatYear(network.toYear, locale)}
                  </bdi>
                </span>
                <span className={`${styles.status} ${inPeriod ? styles.inPeriod : ''}`}>
                  {text(inPeriod ? 'within' : 'outside')}
                </span>
              </button>

              {selected && (
                <div
                  className={styles.detail}
                  id={detailsId}
                  role="region"
                  aria-labelledby={titleId}
                >
                  <p lang={language} dir="auto">
                    {contextText(network.description, locale)}
                  </p>
                  <button
                    type="button"
                    className={styles.locate}
                    onClick={() => {
                      const camera = networkCamera(network.coordinates);
                      onLocate(network.fromYear, camera.coordinates, camera.zoom);
                    }}
                  >
                    <LocateFixed size={14} aria-hidden="true" />
                    {text('show')}
                  </button>
                  <section>
                    <h3>{text('mechanisms')}</h3>
                    <p lang={language} dir="auto">
                      {contextText(network.mechanisms, locale)}
                    </p>
                  </section>
                  <section>
                    <h3>
                      {text('dates')}
                      {network.approximate && (
                        <span className={styles.approximate}>{text('approximate')}</span>
                      )}
                    </h3>
                    <p lang={language} dir="auto">
                      {contextText(network.temporalBasis, locale)}
                    </p>
                  </section>
                  <section>
                    <h3>{text('anchors')}</h3>
                    <ol className={styles.anchors} dir="ltr">
                      {network.waypoints.map((point, index) => (
                        <li key={index}>
                          <span lang={language}>{contextText(point.name, locale)}</span>
                          {index < network.waypoints.length - 1 && (
                            <span aria-hidden="true">
                              {network.direction === 'both' ? '↔' : '→'}
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </section>
                  <section>
                    <h3>{text('direction')}</h3>
                    <p lang={language} dir="auto">
                      {contextText(network.directionNote, locale)}
                    </p>
                  </section>
                  <section className={styles.limits}>
                    <h3>{text('limits')}</h3>
                    <p lang={language} dir="auto">
                      {contextText(network.limits, locale)}
                    </p>
                  </section>
                  <section className={styles.sources}>
                    <h3>{text('sources')}</h3>
                    <ul>
                      {network.sources.map((source) => (
                        <li key={source.url}>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            lang="en"
                            dir="auto"
                          >
                            {source.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
