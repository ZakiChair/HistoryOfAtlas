'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Crosshair,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Search,
  Swords,
} from 'lucide-react';
import { getBattle, getBattleIndex } from '@/lib/battles/client';
import { focusBattle } from '@/lib/battles/navigation';
import { armyLossShares } from '@/lib/battles/simulation';
import { battleText } from '@/lib/battles/i18n';
import type { BattleCopyKey } from '@/lib/battles/i18n';
import type {
  BattleIndex,
  BattleIndexEntry,
  BattleRecord,
  SourcedQuantity,
} from '@/lib/battles/schema';
import { getBattleRenderStatus, type BattleRenderStatus } from '@/lib/battles/status';
import { formatYear } from '@/lib/histdate';
import { localizedName, useI18n } from '@/lib/i18n';
import { useAtlasStore } from '@/lib/store';
import type { Locale } from '@/lib/types';

function titleLanguage(entry: BattleIndexEntry, locale: Locale) {
  if (entry.nameLanguage && (locale === 'en' || !entry.name[locale])) return entry.nameLanguage;
  return entry.name[locale] ? locale : 'en';
}

function battleCategory(entry: BattleIndexEntry) {
  return entry.medium === 'land' ? entry.type : entry.medium;
}

function quantityLabel(quantity: SourcedQuantity, locale: Locale) {
  const number = (value: number) => value.toLocaleString(locale);
  const range =
    quantity.min !== undefined && quantity.max !== undefined && quantity.min !== quantity.max;
  const value = range
    ? `${number(quantity.min!)}–${number(quantity.max!)}`
    : number(quantity.value);
  return `${quantity.approximate && !range ? '≈ ' : ''}${value}${quantity.counts === 'unknown' ? '' : ` ${battleText(locale, quantity.counts)}`}`;
}

function Quantities({ values, locale }: { values: SourcedQuantity[]; locale: Locale }) {
  if (!values.length)
    return <span className="battle-unknown">{battleText(locale, 'unknown')}</span>;
  return (
    <>
      {values.map((quantity, index) => (
        <span key={index} className="battle-quantity">
          <a
            href={quantity.sources[0].url}
            target="_blank"
            rel="noreferrer"
            title={quantity.sources[0].label}
          >
            {quantityLabel(quantity, locale)}
            <ArrowUpRight size={10} aria-hidden="true" />
          </a>
          {quantity.note && <small lang="en">{quantity.note}</small>}
        </span>
      ))}
    </>
  );
}

function BattleDetail({ entry, onBack }: { entry: BattleIndexEntry; onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const playButton = useRef<HTMLButtonElement>(null);
  const { locale } = useI18n();
  const text = (key: BattleCopyKey) => battleText(locale, key);
  const playing = useAtlasStore((state) => state.battlePlaying);
  const speed = useAtlasStore((state) => state.battleSpeed);
  const requestedProgress = useAtlasStore((state) => state.battleProgress);
  const [battle, setBattle] = useState<BattleRecord | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState<BattleRenderStatus | null>(null);
  useEffect(() => {
    const scroller = heading.current?.closest('.exploration-scroll');
    if (scroller) scroller.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, [entry.id]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.code !== 'Space' ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest(
          'input, textarea, select, button, a, [contenteditable="true"], [role="slider"], [role="dialog"]',
        )
      )
        return;
      event.preventDefault();
      playButton.current?.click();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  useEffect(() => {
    let active = true;
    getBattle(entry.id)
      .then((record) => {
        if (active) setBattle(record);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [entry.id, retry]);
  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<BattleRenderStatus>).detail;
      if (detail.eventId === entry.id) setStatus(detail);
    };
    window.addEventListener('atlas:battle-status', update);
    const latest = getBattleRenderStatus();
    setStatus(latest?.eventId === entry.id ? latest : null);
    return () => window.removeEventListener('atlas:battle-status', update);
  }, [entry.id]);
  const progress = status?.progress ?? requestedProgress;
  const canRender = Boolean(entry.start && entry.coords);
  const phase = progress < 0.3 ? 'deployment' : progress < 0.72 ? 'encounter' : 'aftermath';
  const armies =
    battle?.participants.filter(
      (participant) => participant.kind === 'polity' || participant.kind === 'military-unit',
    ) ?? [];
  const armySides = [...new Set(armies.map((army) => army.sideId ?? army.id))];
  const sources = battle
    ? [
        ...new Map(
          [
            ...battle.sources,
            ...battle.participants.flatMap((participant) => [
              ...participant.sources,
              ...participant.strength.flatMap((value) => value.sources),
              ...participant.casualties.flatMap((value) => value.sources),
              ...participant.deaths.flatMap((value) => value.sources),
            ]),
          ].map((source) => [source.url, source]),
        ).values(),
      ]
    : [];

  return (
    <section className="battle-detail" data-testid="battle-detail" data-battle-id={entry.id}>
      <button className="text-button" onClick={onBack}>
        <ArrowLeft size={14} />
        {text('catalogue')}
      </button>
      <div className="battle-kicker">
        <Swords size={14} />
        {text('mode')}
        <span>{entry.id}</span>
      </div>
      <h2 ref={heading} tabIndex={-1} lang={titleLanguage(entry, locale)} dir="auto">
        {localizedName(entry.name, locale)}
      </h2>
      <p className="battle-date">
        {entry.start ? formatYear(entry.start.year, locale) : text('unknown')}
      </p>
      {status?.armycounts?.some((army) => army.symbolic) && (
        <p className="battle-notice" data-testid="battle-unknown-strength-notice">
          {text('symbolic')}
        </p>
      )}
      {canRender ? (
        <>
          <div
            className="battle-playback"
            data-testid="battle-playback"
            data-status={status?.status ?? 'loading'}
          >
            <div className="battle-playback-buttons">
              <button
                className="primary-button"
                data-testid="battle-play"
                ref={playButton}
                disabled={status?.status !== 'ready'}
                onClick={() => {
                  const state = useAtlasStore.getState();
                  if (playing) state.setBattleProgress(progress);
                  else if (progress >= 0.999) state.setBattleProgress(0);
                  state.setBattlePlaying(!playing);
                }}
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
                {text(playing ? 'pause' : 'play')}
              </button>
              <button
                className="icon-button"
                aria-label={text('replay')}
                disabled={status?.status !== 'ready'}
                onClick={() => {
                  useAtlasStore.getState().setBattleProgress(0);
                  useAtlasStore.getState().setBattlePlaying(true);
                }}
              >
                <RotateCcw size={16} />
              </button>
              <select
                aria-label={text('speed')}
                value={speed}
                onChange={(event) =>
                  useAtlasStore.getState().setBattleSpeed(Number(event.target.value) as 0.5 | 1 | 2)
                }
              >
                <option value={0.5}>0.5×</option>
                <option value={1}>1×</option>
                <option value={2}>2×</option>
              </select>
            </div>
            <input
              type="range"
              min={0}
              max={1000}
              step={1}
              value={Math.round(progress * 1000)}
              aria-label={text('progress')}
              disabled={status?.status === 'error' || status?.status === 'empty'}
              aria-valuetext={`${text(phase)} · ${Math.round(progress * 100)}%`}
              onChange={(event) => {
                useAtlasStore.getState().setBattlePlaying(false);
                useAtlasStore.getState().setBattleProgress(Number(event.target.value) / 1000);
              }}
            />
            <div className="battle-phase">
              <span>{text(phase)}</span>
              <output data-testid="battle-progress">{Math.round(progress * 100)}%</output>
            </div>
            {status?.status === 'loading' && (
              <p className="source-note" role="status">
                {text('loadingModels')}
              </p>
            )}
            {status?.status === 'error' && (
              <div role="alert">
                <p>{text('error')}</p>
                <button className="secondary-button" onClick={() => focusBattle(entry)}>
                  {text('retry')}
                </button>
              </div>
            )}
            {status?.status === 'empty' && (
              <p className="source-note" role="status">
                {text('noModel')}
              </p>
            )}
          </div>
          <button className="text-button battle-focus" onClick={() => focusBattle(entry)}>
            <Crosshair size={14} />
            {text('focus')}
          </button>
          <p className="source-note battle-inspect">{text('inspect')}</p>
        </>
      ) : (
        <p className="battle-notice">{text('unmapped')}</p>
      )}
      <p className="battle-notice">{text('illustration')}</p>
      {error ? (
        <div role="alert">
          <p>{text('error')}</p>
          <button
            className="secondary-button"
            onClick={() => {
              setError(false);
              setRetry((value) => value + 1);
            }}
          >
            {text('retry')}
          </button>
        </div>
      ) : !battle ? (
        <p role="status">{text('loading')}</p>
      ) : (
        <>
          {battle.note && (
            <p className="source-note" lang="en">
              {battle.note}
            </p>
          )}
          <section className="battle-armies">
            <h3>{text('armies')}</h3>
            {armies.length === 0 && (
              <>
                <p className="source-note">{text('noParticipants')}</p>
                {status?.armycounts?.some((army) => army.symbolic) && (
                  <p className="battle-scale" data-testid="battle-illustrative-formation">
                    {text('symbolic')} · {status.models.toLocaleString(locale)} {text('models')}
                  </p>
                )}
              </>
            )}
            {armies.length > 0 && !armies.some((army) => army.sideId) && (
              <p className="source-note">{text('unknownSides')}</p>
            )}
            {armies.map((army) => {
              const rendered = status?.armycounts?.find((item) => item.id === army.id);
              const losses =
                rendered?.strength &&
                (rendered.deaths !== undefined || rendered.casualties !== undefined)
                  ? armyLossShares(rendered, progress)
                  : null;
              const percent = (value: number) =>
                value.toLocaleString(locale, { style: 'percent', maximumFractionDigits: 1 });
              return (
                <article key={army.id} className="battle-army" data-testid="battle-army">
                  <h4>
                    <span
                      className={`battle-army-dot army-${armySides.indexOf(army.sideId ?? army.id) % 4}`}
                    />
                    <span lang={army.name[locale] ? locale : 'en'} dir="auto">
                      {localizedName(army.name, locale)}
                    </span>
                  </h4>
                  <dl>
                    {(['strength', 'casualties', 'deaths'] as const).map((key) => (
                      <div key={key}>
                        <dt>{text(key)}</dt>
                        <dd>
                          <Quantities values={army[key]} locale={locale} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {canRender && rendered && (
                    <p className="battle-scale" data-testid="battle-scale">
                      {!rendered.symbolic && rendered.soldiersPerModel ? (
                        <>
                          {text('scale')} ≈{' '}
                          {rendered.soldiersPerModel.toLocaleString(locale, {
                            maximumFractionDigits: 1,
                          })}{' '}
                          {text(rendered.counts ?? 'soldiers')} · {rendered.models} {text('models')}
                        </>
                      ) : (
                        <>
                          {text('symbolic')} · {rendered.models.toLocaleString(locale)}{' '}
                          {text('models')}
                        </>
                      )}
                    </p>
                  )}
                  {rendered?.strength !== undefined &&
                    rendered.soldiersPerModel !== undefined &&
                    rendered.strength > 0 &&
                    rendered.strength < rendered.soldiersPerModel && (
                      <p className="source-note">{text('belowResolution')}</p>
                    )}
                  {rendered?.activeModels !== undefined && (
                    <div className="battle-model-census">
                      <p>{text('visibleModels')}</p>
                      <dl className="battle-model-states" data-testid="battle-model-states">
                        <div>
                          <dt>{text('activeModels')}</dt>
                          <dd>{rendered.activeModels.toLocaleString(locale)}</dd>
                        </div>
                        <div>
                          <dt>{text('withdrawnModels')}</dt>
                          <dd>{(rendered.withdrawnModels ?? 0).toLocaleString(locale)}</dd>
                        </div>
                        <div>
                          <dt>{text('deadModels')}</dt>
                          <dd>{(rendered.deadModels ?? 0).toLocaleString(locale)}</dd>
                        </div>
                      </dl>
                    </div>
                  )}
                  {losses && (
                    <div className="battle-loss-share" data-testid="battle-loss-share">
                      <p>
                        {text('lossShare')} ·{' '}
                        <strong>{percent(losses.deaths + losses.withdrawn)}</strong>
                      </p>
                      <div className="battle-loss-track" aria-hidden="true">
                        <span
                          className="battle-loss-dead"
                          style={{ width: `${losses.deaths * 100}%` }}
                        />
                        <span
                          className="battle-loss-withdrawn"
                          style={{ width: `${losses.withdrawn * 100}%` }}
                        />
                      </div>
                      <p>
                        {text('deaths')} ·{' '}
                        {rendered?.deaths === undefined ? text('unknown') : percent(losses.deaths)}
                      </p>
                    </div>
                  )}
                  {rendered?.profileLabel && (
                    <p className="battle-equipment">
                      <span>
                        {text('equipment')} · {text('representative')}
                      </span>
                      {rendered.profileSources?.[0] ? (
                        <a
                          href={rendered.profileSources[0].url}
                          target="_blank"
                          rel="noreferrer"
                          lang="en"
                        >
                          {rendered.profileLabel}
                          <ArrowUpRight size={10} />
                        </a>
                      ) : (
                        <span lang="en">{rendered.profileLabel}</span>
                      )}
                    </p>
                  )}
                </article>
              );
            })}
            <p className="source-note">{text('lossesNote')}</p>
          </section>
          {Object.values(battle.totals).some((values) => values.length > 0) && (
            <section className="battle-totals">
              <h3>{text('totals')}</h3>
              <dl>
                {(['strength', 'casualties', 'deaths'] as const).map((key) => (
                  <div key={key}>
                    <dt>{text(key)}</dt>
                    <dd>
                      <Quantities values={battle.totals[key]} locale={locale} />
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="source-note">{text('totalsNote')}</p>
            </section>
          )}
          <section className="battle-location">
            <h3>
              <MapPin size={14} />
              {text('location')}
            </h3>
            {battle.coords && (
              <p>
                {battle.coords[1].toFixed(4)}°, {battle.coords[0].toFixed(4)}°
              </p>
            )}
            {battle.coordinateSource?.kind === 'place' && (
              <p className="source-note">{text('placeLocation')}</p>
            )}
            {battle.metadataReview?.coordinateBasis && (
              <p className="source-note">{battle.metadataReview.coordinateBasis}</p>
            )}
            {battle.coordinateSource && (
              <a
                className="text-button"
                href={battle.coordinateSource.url}
                target="_blank"
                rel="noreferrer"
              >
                {battle.coordinateSource.label ?? battle.coordinateSource.entityId}
                <ArrowUpRight size={12} />
              </a>
            )}
          </section>
          {battle.unassigned &&
            Object.values(battle.unassigned).some((values) => values.length > 0) && (
              <details className="battle-sources">
                <summary>{text('unassigned')}</summary>
                <p className="source-note">{text('totalsNote')}</p>
                <dl>
                  {(['strength', 'casualties', 'deaths'] as const).map((key) => (
                    <div key={key}>
                      <dt>{text(key)}</dt>
                      <dd>
                        <Quantities values={battle.unassigned![key]} locale={locale} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
          <details className="battle-sources">
            <summary>
              {text('sources')} · {sources.length}
            </summary>
            <ul>
              {sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.label}
                    <ArrowUpRight size={12} />
                  </a>
                </li>
              ))}
            </ul>
          </details>
          <p className="source-note">{text('accessible')}</p>
        </>
      )}
    </section>
  );
}

export default function BattlePanel() {
  const { locale } = useI18n();
  const text = (key: BattleCopyKey) => battleText(locale, key);
  const selectedEvent = useAtlasStore((state) => state.selectedEvent);
  const [index, setIndex] = useState<BattleIndex | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [documented, setDocumented] = useState(false);
  const [limit, setLimit] = useState(40);
  useEffect(() => {
    let active = true;
    getBattleIndex()
      .then((value) => {
        if (active) setIndex(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  const selected = index?.battles.find((battle) => battle.id === selectedEvent);
  const filtered = useMemo(() => {
    const normalize = (value: string) =>
      value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase(locale);
    const search = normalize(query.trim());
    return (index?.battles ?? [])
      .filter(
        (battle) =>
          (type === 'all' || battleCategory(battle) === type) &&
          (!documented || battle.documented) &&
          (!search ||
            normalize(
              `${battle.id} ${Object.values(battle.name).join(' ')} ${battle.start?.year ?? ''}`,
            ).includes(search)),
      )
      .sort(
        (a, b) =>
          Number(b.documented) - Number(a.documented) ||
          Number(Boolean(b.coords && b.start)) - Number(Boolean(a.coords && a.start)) ||
          (a.start?.year ?? Infinity) - (b.start?.year ?? Infinity) ||
          a.id.localeCompare(b.id),
      );
  }, [index, query, type, documented, locale]);
  if (selected)
    return (
      <BattleDetail
        key={selected.id}
        entry={selected}
        onBack={() => useAtlasStore.getState().selectEvent(null)}
      />
    );
  return (
    <section className="battle-catalogue" data-testid="battle-catalogue">
      <div className="battle-kicker">
        <Swords size={16} />
        {text('mode')}
      </div>
      <h2>{text('title')}</h2>
      <p className="panel-intro">{text('intro')}</p>
      {index && (
        <div className="battle-coverage">
          <strong>{index.counts.total.toLocaleString(locale)}</strong>
          <span>{text('catalogue')}</span>
          <a
            href="/data/battles/coverage.json"
            target="_blank"
            rel="noreferrer"
            aria-label={text('coverage')}
          >
            <ArrowUpRight size={16} />
          </a>
        </div>
      )}
      {index && (
        <p className="source-note battle-catalogue-summary">
          {index.counts.mappable.toLocaleString(locale)} · {text('mapped')}
          <br />
          {index.counts.documented.toLocaleString(locale)} · {text('documented')}
        </p>
      )}
      <label className="battle-search">
        <Search size={15} />
        <input
          value={query}
          placeholder={text('search')}
          aria-label={text('search')}
          onChange={(event) => {
            setQuery(event.target.value);
            setLimit(40);
          }}
        />
      </label>
      <div className="battle-filters">
        <select
          aria-label={text('all')}
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            setLimit(40);
          }}
        >
          {(['all', 'battle', 'siege', 'naval', 'air'] as const).map((key) => (
            <option value={key} key={key}>
              {text(key)}
            </option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={documented}
            onChange={(event) => {
              setDocumented(event.target.checked);
              setLimit(40);
            }}
          />
          {text('documented')}
        </label>
      </div>
      {error ? (
        <div role="alert">
          <p>{text('error')}</p>
          <button
            className="secondary-button"
            onClick={() => {
              setError(false);
              setRetry((value) => value + 1);
            }}
          >
            {text('retry')}
          </button>
        </div>
      ) : !index ? (
        <p role="status">{text('loading')}</p>
      ) : (
        <>
          <p className="battle-result-count" role="status">
            {filtered.length.toLocaleString(locale)} {text('results')}
          </p>
          <ul className="battle-list">
            {filtered.slice(0, limit).map((battle) => (
              <li key={battle.id}>
                <button
                  onClick={() => focusBattle(battle)}
                  data-testid={`battle-open-${battle.id}`}
                >
                  <span className="battle-list-year">
                    {battle.start ? formatYear(battle.start.year, locale) : '—'}
                  </span>
                  <span>
                    <strong lang={titleLanguage(battle, locale)} dir="auto">
                      {localizedName(battle.name, locale)}
                    </strong>
                    <small>
                      {!battle.start || !battle.coords
                        ? text('unmapped')
                        : battle.documented
                          ? text('documented')
                          : text(battleCategory(battle))}
                    </small>
                  </span>
                  <ArrowUpRight size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {!filtered.length && <p>{text('noResults')}</p>}
          {filtered.length > limit && (
            <button
              className="secondary-button battle-more"
              onClick={() => setLimit((value) => value + 40)}
            >
              {text('more')}
            </button>
          )}
        </>
      )}
      <p className="source-note">{text('select')}</p>
    </section>
  );
}
