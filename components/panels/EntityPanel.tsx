'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Pause, Play, Shield, X } from 'lucide-react';
import { readJson } from '@/lib/data-client';
import { formatYear } from '@/lib/histdate';
import { useI18n } from '@/lib/i18n';
import { useAtlasStore } from '@/lib/store';

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

export function areaPath(observations: readonly Observation[]) {
  if (!observations.length) return { path: '', points: [], minimum: 0, maximum: 0, peak: 1 };
  const minimum = Math.min(...observations.map((point) => point.fromYear));
  const maximum = Math.max(...observations.map((point) => point.toYear));
  const peak = Math.max(1, ...observations.map((point) => point.areaKm2));
  const x = (year: number) => 12 + ((year - minimum) / Math.max(1, maximum - minimum)) * 316;
  const y = (area: number) => 104 - (area / peak) * 88;
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
  };
}

function safeSource(url: string | undefined): string | undefined {
  return url && /^https:\/\//.test(url) ? url : undefined;
}

export default function EntityPanel() {
  const selectedEntity = useAtlasStore((state) => state.selectedEntity);
  const selectEntity = useAtlasStore((state) => state.selectEntity);
  const year = useAtlasStore((state) => state.year);
  const setYear = useAtlasStore((state) => state.setYear);
  const { locale, t } = useI18n();
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
    if (!entity?.wikidataId) return;
    let live = true;
    readJson<EntityWar[]>('/data/wars.json')
      .then((catalog) => {
        if (live)
          setWars(
            catalog.filter((war) =>
              war.belligerents?.some((party) => party.entityId === entity.wikidataId),
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

  useEffect(
    () => () => {
      useAtlasStore.getState().setEntityFollowing(false);
    },
    [],
  );

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
  const observations = normalizeObservations(visible?.observations ?? []);
  const chart = observations.length ? areaPath(observations) : null;
  const activeObservation = observations.find(
    (observation) => observation.fromYear <= year && observation.toYear >= year,
  );
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
            <div className="territory-stat">
              <span>{t('Superficie observée', 'Observed area')}</span>
              <strong>
                {activeObservation
                  ? `≈ ${number.format(activeObservation.areaKm2)} km²`
                  : t('Non documentée cette année', 'Not documented for this year')}
              </strong>
            </div>
            {chart && (
              <section aria-labelledby="area-title">
                <h3 id="area-title">{t('L’évolution du territoire', 'Territorial change')}</h3>
                <svg
                  className="area-chart"
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
                      onClick={() => setYear(point.year)}
                      style={{ cursor: 'pointer' }}
                    >
                      <title>{`${formatYear(point.year, locale)} · ${number.format(point.areaKm2)} km²`}</title>
                    </circle>
                  ))}
                  <text x="12" y="123" fill="currentColor" fontSize="10">
                    {formatYear(chart.minimum, locale)}
                  </text>
                  <text x="328" y="123" textAnchor="end" fill="currentColor" fontSize="10">
                    {formatYear(chart.maximum, locale)}
                  </text>
                </svg>
                <label className="observation-select">
                  {t('Aller à une observation', 'Go to an observation')}
                  <select
                    aria-label={t('Observation territoriale', 'Territorial observation')}
                    value=""
                    onChange={(event) => {
                      if (event.target.value) setYear(Number(event.target.value));
                    }}
                  >
                    <option value="">{t('Choisir une date…', 'Choose a date…')}</option>
                    {observations.map((observation, index) => (
                      <option key={`${observation.fromYear}-${index}`} value={observation.fromYear}>
                        {formatYear(observation.fromYear, locale)} · ≈{' '}
                        {number.format(observation.areaKm2)} km²
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
            {wars.length > 0 && (
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
                        {war.name[locale] ?? war.name.en}
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
