'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play, Shield, X } from 'lucide-react';
import { readJson } from '@/lib/data-client';
import { formatYear } from '@/lib/histdate';
import { CURRENT_YEAR, MIN_YEAR } from '@/lib/eras';
import { localizedName, useI18n } from '@/lib/i18n';
import { territoryObservationText } from '@/lib/i18n/territory-observations';
import { useAtlasStore } from '@/lib/store';
import { resolvePolityIdentity } from '@/lib/polity-identities';
import EntityLeaders from './EntityLeaders';
import EntityFacts from './EntityFacts';
import styles from './EntityPanel.module.css';

export type ObservationInput = {
  year?: number;
  fromYear?: number;
  toYear?: number;
  areaKm2: number;
  source?: string;
  sourceUrl?: string;
};
export type Observation = { fromYear: number; toYear: number; areaKm2: number; source?: string };
type EntityDetail = {
  id: string;
  name: string;
  color: string;
  center?: [number, number];
  wikidataId?: string;
  wikipedia?: string;
  firstObserved: number;
  lastObserved: number;
  observations: ObservationInput[];
  source?: string;
  sourceCitation?: string;
  licence?: string;
};
type EntityWar = {
  id: string;
  name: { fr?: string; en: string };
  start: { year: number };
  end?: { year: number };
  belligerents?: { entityId: string }[];
};

export function normalizeObservations(values: readonly ObservationInput[]): Observation[] {
  return values
    .flatMap((value) => {
      const fromYear = value.fromYear ?? value.year;
      const toYear = value.toYear ?? fromYear;
      if (
        fromYear === undefined ||
        toYear === undefined ||
        !Number.isFinite(fromYear) ||
        !Number.isFinite(toYear) ||
        fromYear > toYear ||
        !Number.isFinite(value.areaKm2) ||
        value.areaKm2 < 0
      )
        return [];
      const source = value.source ?? value.sourceUrl;
      return [{ fromYear, toYear, areaKm2: value.areaKm2, ...(source ? { source } : {}) }];
    })
    .sort((a, b) => a.fromYear - b.fromYear || a.toYear - b.toYear);
}

function observationDestination(observation: Observation): number | null {
  if (observation.toYear < MIN_YEAR || observation.fromYear > CURRENT_YEAR) return null;
  return Math.max(MIN_YEAR, observation.fromYear);
}

export function observationNavigation(history: readonly Observation[], year: number) {
  const observations = history.filter(
    (observation) => observationDestination(observation) !== null,
  );
  const activeIndex = observations.findIndex(
    (observation) => observation.fromYear <= year && observation.toYear >= year,
  );
  return {
    active: activeIndex >= 0 ? observations[activeIndex] : undefined,
    previous:
      activeIndex >= 0
        ? observations[activeIndex - 1]
        : observations.filter((observation) => observation.toYear < year).at(-1),
    next:
      activeIndex >= 0
        ? observations[activeIndex + 1]
        : observations.find((observation) => observation.fromYear > year),
  };
}

export function selectTerritorialObservation(observation: Observation) {
  const year = observationDestination(observation);
  if (year === null) return;
  const state = useAtlasStore.getState();
  state.patchState({
    year,
    playing: false,
    entityFollowing: false,
    campaignPlaying: false,
    ...(state.range && (year < state.range[0] || year > state.range[1]) ? { range: null } : {}),
  });
}

export function areaPath(observations: readonly Observation[], year?: number) {
  if (!observations.length)
    return { path: '', points: [], minimum: 0, maximum: 0, peak: 1, current: null };
  const minimum = Math.min(...observations.map((point) => point.fromYear));
  const maximum = Math.max(...observations.map((point) => point.toYear));
  const peak = Math.max(1, ...observations.map((point) => point.areaKm2));
  const x = (year: number) => 12 + ((year - minimum) / Math.max(1, maximum - minimum)) * 316;
  const y = (area: number) => 104 - (area / peak) * 88;
  const active = year === undefined ? undefined : observationNavigation(observations, year).active;
  // Source intervals are steps. Separate subpaths preserve genuinely unobserved gaps.
  const path = observations
    .map((point, index) => {
      const previous = observations[index - 1];
      const command = previous && previous.toYear + 1 >= point.fromYear ? 'L' : 'M';
      return `${command}${x(point.fromYear).toFixed(2)},${y(point.areaKm2).toFixed(2)} L${x(point.toYear).toFixed(2)},${y(point.areaKm2).toFixed(2)}`;
    })
    .join(' ');
  return {
    path,
    points: observations.map((point) => ({
      x: x(point.fromYear),
      y: y(point.areaKm2),
      year: point.fromYear,
      areaKm2: point.areaKm2,
    })),
    minimum,
    maximum,
    peak,
    current:
      year !== undefined && year >= minimum && year <= maximum
        ? { x: x(year), y: active ? y(active.areaKm2) : null }
        : null,
  };
}

function safeSource(url: string | undefined): string | undefined {
  return url && /^https:\/\//.test(url) ? url : undefined;
}

export default function EntityPanel() {
  const selectedEntity = useAtlasStore((state) => state.selectedEntity);
  const selectEntity = useAtlasStore((state) => state.selectEntity);
  const year = useAtlasStore((state) => state.year);
  const { locale, t } = useI18n();
  const text = (key: Parameters<typeof territoryObservationText>[1]) =>
    territoryObservationText(locale, key);
  const [entity, setEntity] = useState<EntityDetail | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [wars, setWars] = useState<EntityWar[]>([]);
  const following = useAtlasStore((state) => state.entityFollowing);
  const setFollowing = useAtlasStore((state) => state.setEntityFollowing);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let live = true;
    setEntity(null);
    setError(false);
    setWars([]);
    if (!selectedEntity || !/^(?:clio|hb)-[a-f0-9]+$/.test(selectedEntity)) {
      if (selectedEntity) setError(true);
      useAtlasStore.getState().setEntityFollowing(false);
      return;
    }
    const request = selectedEntity.startsWith('hb-')
      ? readJson<EntityDetail[]>('/geo/entities.json').then(
          (entities) => entities.find((candidate) => candidate.id === selectedEntity) ?? null,
        )
      : readJson<EntityDetail>(`/geo/polities/${selectedEntity}.json`);
    request
      .then((result) => {
        if (!live) return;
        if (!result) {
          setError(true);
          useAtlasStore.getState().setEntityFollowing(false);
          return;
        }
        setEntity(result);
      })
      .catch(() => {
        if (live) {
          setError(true);
          useAtlasStore.getState().setEntityFollowing(false);
        }
      });
    return () => {
      live = false;
    };
  }, [selectedEntity, retry]);

  useEffect(() => {
    if (entity) heading.current?.focus({ preventScroll: true });
  }, [entity]);

  useEffect(() => {
    const identity = entity ? resolvePolityIdentity(entity) : null;
    if (!identity) return;
    let live = true;
    readJson<EntityWar[]>('/data/wars.json')
      .then((catalog) => {
        if (live)
          setWars(
            catalog.filter((war) =>
              war.belligerents?.some((party) => party.entityId === identity.wikidataId),
            ),
          );
      })
      .catch(() => {
        if (live) setWars([]);
      });
    return () => {
      live = false;
    };
  }, [entity]);

  // Selection actions stop contextual playback in the store. Effect cleanup here
  // would also stop URL-restored following during React's development remount.
  useEffect(() => {
    if (!following || !entity || entity.id !== selectedEntity) return;
    const values = normalizeObservations(entity.observations);
    if (!values.length) {
      setFollowing(false);
      return;
    }
    const first = values[0].fromYear;
    const last = Math.max(...values.map((item) => item.toYear));
    const state = useAtlasStore.getState();
    if (state.year < first) state.setYear(first);
    if (state.year >= last) {
      state.setYear(last);
      setFollowing(false);
      return;
    }
    return useAtlasStore.subscribe((next) => {
      if (!next.playing || next.year >= last || next.selectedEntity !== selectedEntity) {
        if (next.year > last) next.setYear(last);
        if (next.entityFollowing) next.setEntityFollowing(false);
      }
    });
  }, [entity, following, selectedEntity, setFollowing]);

  if (!selectedEntity) return null;
  const visible = entity?.id === selectedEntity ? entity : null;
  const reviewedIdentity = visible ? resolvePolityIdentity(visible) : null;
  const observations = normalizeObservations(visible?.observations ?? []);
  const chart = observations.length ? areaPath(observations, year) : null;
  const { active: activeObservation, previous, next } = observationNavigation(observations, year);
  const observationPeriod = (observation: Observation) =>
    observation.fromYear === observation.toYear
      ? formatYear(observation.fromYear, locale)
      : `${formatYear(observation.fromYear, locale)} — ${formatYear(observation.toYear, locale)}`;
  const first = observations[0]?.fromYear;
  const last = observations.length
    ? Math.max(...observations.map((observation) => observation.toYear))
    : undefined;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const sources = [
    ...new Set(
      [
        visible?.source,
        visible?.sourceCitation,
        ...observations.map((observation) => observation.source),
      ].filter((source): source is string => Boolean(safeSource(source))),
    ),
  ];

  const follow = () => {
    if (following) {
      setFollowing(false);
      return;
    }
    if (first === undefined || last === undefined) return;
    const state = useAtlasStore.getState();
    state.setYear(first);
    if (visible?.center)
      state.setCamera({
        lon: visible.center[0],
        lat: visible.center[1],
        zoom: Math.max(2.5, state.camera.zoom),
      });
    if (first !== last) setFollowing(true);
  };

  return (
    <aside
      className="entity-panel side-panel"
      aria-labelledby="entity-title"
      data-testid="entity-panel"
    >
      <div className="panel-header">
        <span className="eyebrow">
          <Shield size={14} aria-hidden="true" /> {t('TERRITOIRE', 'TERRITORY')}
        </span>
        <button
          className="icon-button"
          onClick={() => selectEntity(null)}
          aria-label={t('Fermer la fiche du territoire', 'Close territory panel')}
        >
          <X size={20} />
        </button>
      </div>
      <div className="panel-body">
        {!visible && (
          <h2 id="entity-title">
            {error
              ? t('Source indisponible', 'Source unavailable')
              : t('Chargement du territoire…', 'Loading territory…')}
          </h2>
        )}
        {error && (
          <>
            <p>
              {t(
                'Cette observation ne peut pas être chargée pour le moment.',
                'This observation cannot currently be loaded.',
              )}
            </p>
            <button className="primary-button" onClick={() => setRetry((value) => value + 1)}>
              {t('Réessayer', 'Try again')}
            </button>
          </>
        )}
        {visible && (
          <>
            <h2 id="entity-title" ref={heading} tabIndex={-1}>
              {visible.name}
            </h2>
            <div className="detail-meta">
              {first !== undefined && last !== undefined
                ? `${formatYear(first, locale)} — ${formatYear(last, locale)}`
                : t('Période non précisée', 'Period unspecified')}
            </div>
            <p className="source-note">
              {t(
                'Période couverte par les observations disponibles. Ces bornes ne désignent pas nécessairement la création et la disparition de cet État.',
                'Period covered by available observations. These bounds do not necessarily indicate the founding and dissolution of this state.',
              )}
            </p>
            <EntityFacts key={visible.id} entity={visible} year={year} />
            <div className="territory-stat">
              <span>{t('Superficie observée', 'Observed area')}</span>
              <strong>
                {activeObservation
                  ? `≈ ${number.format(activeObservation.areaKm2)} km²`
                  : t('Non documentée cette année', 'Not documented for this year')}
              </strong>
              {activeObservation && (
                <span data-testid="territory-active-observation">
                  {text('documentedInterval')} : {observationPeriod(activeObservation)}
                </span>
              )}
            </div>
            {reviewedIdentity && (
              <EntityLeaders key={visible.id} identity={reviewedIdentity} year={year} />
            )}
            {chart && (
              <section aria-labelledby="area-title">
                <h3 id="area-title">{t('L’évolution du territoire', 'Territorial change')}</h3>
                <svg
                  className="area-chart"
                  style={{ direction: 'ltr' }}
                  viewBox="0 0 340 128"
                  role="img"
                  aria-label={t(
                    'Superficie aux dates documentées ; choisissez une observation dans la liste ci-dessous.',
                    'Area at documented dates; choose an observation in the list below.',
                  )}
                >
                  <line
                    x1="12"
                    y1="104"
                    x2="328"
                    y2="104"
                    stroke="currentColor"
                    strokeOpacity=".15"
                  />
                  <line
                    x1="12"
                    y1="16"
                    x2="328"
                    y2="16"
                    stroke="currentColor"
                    strokeOpacity=".08"
                  />
                  <path
                    d={chart.path}
                    fill="none"
                    stroke={visible.color}
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                  {chart.points.map((point, index) => (
                    <circle
                      key={`${point.year}-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r="3.5"
                      fill={visible.color}
                      onClick={() => selectTerritorialObservation(observations[index])}
                      style={{
                        cursor:
                          observationDestination(observations[index]) === null
                            ? 'default'
                            : 'pointer',
                      }}
                    >
                      <title>{`${formatYear(point.year, locale)} · ${number.format(point.areaKm2)} km²`}</title>
                    </circle>
                  ))}
                  {chart.current && (
                    <g aria-hidden="true" pointerEvents="none">
                      <line
                        data-testid="territory-current-cursor"
                        x1={chart.current.x}
                        y1="12"
                        x2={chart.current.x}
                        y2="108"
                        stroke="currentColor"
                        strokeDasharray="3 3"
                      />
                      {chart.current.y !== null && (
                        <circle
                          data-testid="territory-current-area"
                          cx={chart.current.x}
                          cy={chart.current.y}
                          r="5"
                          fill={visible.color}
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      )}
                    </g>
                  )}
                  <text x="12" y="123" fill="currentColor" fontSize="10">
                    {formatYear(chart.minimum, locale)}
                  </text>
                  <text x="328" y="123" textAnchor="end" fill="currentColor" fontSize="10">
                    {formatYear(chart.maximum, locale)}
                  </text>
                </svg>
                <p className={styles.currentYear}>
                  {text('selectedYear')} : <strong>{formatYear(year, locale)}</strong>
                </p>
                <div className={styles.navigation} role="group" aria-label={text('navigation')}>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!previous}
                    onClick={() => previous && selectTerritorialObservation(previous)}
                  >
                    <ChevronLeft size={14} aria-hidden="true" />
                    {text('previous')}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!next}
                    onClick={() => next && selectTerritorialObservation(next)}
                  >
                    {text('next')}
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                </div>
                <label className="observation-select">
                  {t('Aller à une observation', 'Go to an observation')}
                  <select
                    aria-label={t('Observation territoriale', 'Territorial observation')}
                    value={activeObservation ? String(activeObservation.fromYear) : ''}
                    onChange={(event) => {
                      const observation = observations.find(
                        (item) => String(item.fromYear) === event.target.value,
                      );
                      if (observation) selectTerritorialObservation(observation);
                    }}
                  >
                    <option value="">{t('Choisir une date…', 'Choose a date…')}</option>
                    {observations.map((observation, index) => (
                      <option
                        key={`${observation.fromYear}-${index}`}
                        value={observation.fromYear}
                        disabled={observationDestination(observation) === null}
                      >
                        {observationPeriod(observation)} · ≈ {number.format(observation.areaKm2)}{' '}
                        km²
                        {observationDestination(observation) === null &&
                          ` · ${text('outsideTimeline')}`}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
            )}
            {observations.length > 0 && (
              <button className="primary-button" onClick={follow} data-testid="follow-entity">
                {following ? <Pause size={16} /> : <Play size={16} />}{' '}
                {following
                  ? t('Arrêter le parcours', 'Stop following')
                  : t('Suivre ce territoire', 'Follow this territory')}
              </button>
            )}
            <p className="source-note">
              {t(
                'Contours approximatifs. Les évolutions cartographiques ne sont pas attribuées automatiquement aux batailles contemporaines.',
                'Approximate boundaries. Mapped changes are not automatically attributed to contemporary battles.',
              )}
            </p>
            {reviewedIdentity && wars.length > 0 && (
              <section>
                <h3>
                  {t('Conflits associés dans les sources', 'Conflicts associated in the sources')}
                </h3>
                <ul className="entity-wars">
                  {wars.map((war) => (
                    <li key={war.id}>
                      <button
                        onClick={() => {
                          const state = useAtlasStore.getState();
                          state.selectWar(war.id);
                          state.selectEvent(war.id);
                          state.setYear(war.start.year);
                          state.selectEntity(null);
                        }}
                      >
                        {localizedName(war.name, locale)}
                        <span>{formatYear(war.start.year, locale)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="entity-sources">
              <h3>{t('Sources', 'Sources')}</h3>
              {sources.map((source, index) => (
                <a
                  className="source-link"
                  href={source}
                  key={source}
                  target="_blank"
                  rel="noreferrer"
                >
                  {source.includes('doi.org')
                    ? t('Publication scientifique', 'Research paper')
                    : selectedEntity.startsWith('clio-')
                      ? 'Cliopatria · Seshat'
                      : `Historical Basemaps · ${index + 1}`}
                  <ArrowUpRight size={14} />
                </a>
              ))}
              {visible.wikidataId && (
                <a
                  className="source-link"
                  href={`https://www.wikidata.org/wiki/${visible.wikidataId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Wikidata · {visible.wikidataId}
                  <ArrowUpRight size={14} />
                </a>
              )}
              <p className="source-note">{visible.licence ?? 'GPL-3.0 · Historical Basemaps'}</p>
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
