'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import * as Slider from '@radix-ui/react-slider';
import { ChevronLeft, ChevronRight, Pause, Play, SlidersHorizontal, X } from 'lucide-react';
import { CURRENT_YEAR, ERAS, MIN_YEAR, getEra, positionToYear, yearToPosition } from '@/lib/eras';
import { formatYear, parseHistoricalYear } from '@/lib/histdate';
import { useTranslation } from '@/lib/i18n';
import { advancePlayback, buildDensityBins, type DensityYear } from '@/lib/playback';
import { useAtlasStore } from '@/lib/store';

const EMPTY_DENSITY: DensityYear[] = [];
const SPEEDS = [1, 5, 25, 100] as const;
const TICKS = [-3500, -800, 476, 1492, 1800, 1900, CURRENT_YEAR];

export interface TimelineProps {
  density?: DensityYear[];
  territorialDensity?: DensityYear[];
}

function useTimelinePlayback(density: readonly DensityYear[]): void {
  const countByYear = useMemo(
    () => new Map(density.map((item) => [item.year, item.count])),
    [density],
  );
  useEffect(() => {
    let frame = 0;
    let previous = 0;
    let remainder = 0;
    function tick(time: number) {
      const state = useAtlasStore.getState();
      if (!state.playing) return;
      const density =
        (countByYear.get(state.year - 1) ?? 0) +
        (countByYear.get(state.year) ?? 0) +
        (countByYear.get(state.year + 1) ?? 0);
      const maxYear = state.range?.[1] ?? CURRENT_YEAR;
      const position = advancePlayback(
        { year: state.year, remainder },
        previous ? time - previous : 0,
        state.speed,
        density,
        maxYear,
      );
      previous = time;
      remainder = position.remainder;
      if (position.year !== state.year) state.setYear(position.year);
      if (position.finished) state.setPlaying(false);
      else frame = requestAnimationFrame(tick);
    }
    function start(playing: boolean) {
      cancelAnimationFrame(frame);
      previous = 0;
      remainder = 0;
      if (playing) frame = requestAnimationFrame(tick);
    }
    const unsubscribe = useAtlasStore.subscribe((state) => state.playing, start);
    start(useAtlasStore.getState().playing);
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
    };
  }, [countByYear]);
}

const DensityHistogram = memo(function DensityHistogram({
  density,
  label,
}: {
  density: readonly DensityYear[];
  label: string;
}) {
  const bins = useMemo(() => buildDensityBins(density), [density]);
  const maximum = Math.max(1, ...bins);
  return (
    <svg
      className="timeline-histogram"
      viewBox="0 0 900 46"
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      {bins.map((count, index) => {
        const height = count ? Math.max(2, (Math.log1p(count) / Math.log1p(maximum)) * 43) : 0;
        return (
          <rect key={index} x={index * 5} y={46 - height} width="3.5" height={height} rx="0.6" />
        );
      })}
    </svg>
  );
});

export default function Timeline({
  density = EMPTY_DENSITY,
  territorialDensity = EMPTY_DENSITY,
}: TimelineProps) {
  const { locale, t } = useTranslation();
  const year = useAtlasStore((state) => state.year);
  const playing = useAtlasStore((state) => state.playing);
  const speed = useAtlasStore((state) => state.speed);
  const range = useAtlasStore((state) => state.range);
  const setYear = useAtlasStore((state) => state.setYear);
  const setPlaying = useAtlasStore((state) => state.setPlaying);
  const setSpeed = useAtlasStore((state) => state.setSpeed);
  const setRange = useAtlasStore((state) => state.setRange);
  const [editing, setEditing] = useState(false);
  const [yearText, setYearText] = useState('');
  const [yearError, setYearError] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const era = getEra(year);
  const position = yearToPosition(year);
  const histogramDensity = density.length ? density : territorialDensity;

  useTimelinePlayback(density);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          'input, textarea, select, button, [contenteditable="true"], [role="slider"], [role="dialog"]',
        )
      )
        return;
      const state = useAtlasStore.getState();
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        state.setPlaying(false);
        state.setYear(state.year + (event.key === 'ArrowRight' ? 1 : -1));
      } else if (event.code === 'Space') {
        event.preventDefault();
        state.setPlaying(!state.playing);
      }
    }
    window.addEventListener('keydown', onKey);
    const element = rootRef.current;
    let lastWheel = 0;
    function onWheel(event: WheelEvent) {
      if (
        event.ctrlKey ||
        event.metaKey ||
        (event.target instanceof Element && event.target.closest('input'))
      )
        return;
      event.preventDefault();
      if (performance.now() - lastWheel < 45 || Math.abs(event.deltaY) < 1) return;
      lastWheel = performance.now();
      const state = useAtlasStore.getState();
      state.setPlaying(false);
      state.setYear(state.year + Math.sign(event.deltaY));
    }
    element?.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', onKey);
      element?.removeEventListener('wheel', onWheel);
    };
  }, []);

  function togglePlaying() {
    if (!playing && year >= (range?.[1] ?? CURRENT_YEAR)) setYear(range?.[0] ?? MIN_YEAR);
    setPlaying(!playing);
  }

  function submitYear() {
    const parsed = parseHistoricalYear(yearText);
    if (parsed === null || parsed < MIN_YEAR || parsed > CURRENT_YEAR) {
      setYearError(true);
      return;
    }
    setYear(parsed);
    setPlaying(false);
    setEditing(false);
    setYearError(false);
  }

  return (
    <section className="timeline" aria-label={t('timeline')} ref={rootRef} data-testid="timeline">
      <div className="timeline-toolbar">
        <div className="timeline-date">
          <span className="timeline-eyebrow">
            {t('LE FIL DE L’HISTOIRE', 'THE THREAD OF HISTORY')}
          </span>
          {editing ? (
            <form
              className="timeline-year-form"
              onSubmit={(event) => {
                event.preventDefault();
                submitYear();
              }}
            >
              <input
                autoFocus
                aria-label={t('year')}
                aria-invalid={yearError}
                aria-describedby={yearError ? 'timeline-year-error' : undefined}
                value={yearText}
                onChange={(event) => {
                  setYearText(event.target.value);
                  setYearError(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setEditing(false);
                }}
              />
              <button
                type="submit"
                className="timeline-year-submit"
                aria-label={t('Valider l’année', 'Apply year')}
              >
                <ChevronRight size={18} />
              </button>
              {yearError && (
                <span id="timeline-year-error" role="alert" className="timeline-error">
                  {t('Année invalide', 'Invalid year')}
                </span>
              )}
            </form>
          ) : (
            <button
              className="timeline-year"
              onClick={() => {
                setYearText(formatYear(year, locale));
                setEditing(true);
              }}
              aria-label={`${t('Modifier l’année', 'Edit year')} : ${formatYear(year, locale)}`}
            >
              {formatYear(year, locale)} <span className="timeline-edit-hint">↗</span>
            </button>
          )}
          <span className="timeline-era-name">{era.name[locale]}</span>
        </div>
        <div className="timeline-controls">
          <div className="timeline-playback">
            <button
              className="timeline-step"
              aria-label={t('previousYear')}
              onClick={() => {
                setPlaying(false);
                setYear(year - 1);
              }}
              disabled={year <= MIN_YEAR}
            >
              <ChevronLeft size={19} />
            </button>
            <button
              className="timeline-play"
              aria-label={t(playing ? 'pause' : 'play')}
              onClick={togglePlaying}
              data-testid="timeline-play"
            >
              {playing ? (
                <Pause size={18} fill="currentColor" />
              ) : (
                <Play size={18} fill="currentColor" />
              )}
            </button>
            <button
              className="timeline-step"
              aria-label={t('nextYear')}
              onClick={() => {
                setPlaying(false);
                setYear(year + 1);
              }}
              disabled={year >= CURRENT_YEAR}
            >
              <ChevronRight size={19} />
            </button>
          </div>
          <div className="timeline-speeds" role="group" aria-label={t('speed')}>
            {SPEEDS.map((value) => (
              <button
                key={value}
                aria-pressed={speed === value}
                aria-label={`${value}× — ${value} ${t('ans par seconde', 'years per second')}`}
                className={speed === value ? 'active' : ''}
                onClick={() => setSpeed(value)}
              >
                {value}×
              </button>
            ))}
          </div>
          <button
            className={`timeline-range-toggle ${range ? 'active' : ''}`}
            aria-label={t('range')}
            aria-pressed={!!range}
            onClick={() =>
              setRange(
                range ? null : [Math.max(MIN_YEAR, year - 50), Math.min(CURRENT_YEAR, year + 50)],
              )
            }
          >
            <SlidersHorizontal size={14} />
            <span>{t('range')}</span>
          </button>
        </div>
        <div className="timeline-context">
          <span className="timeline-status-dot" />
          {playing
            ? t('Lecture · rythme adaptatif', 'Playing · adaptive pace')
            : t('Glissez pour voyager dans le temps', 'Drag to travel through time')}
        </div>
      </div>
      <div className="timeline-visual">
        <DensityHistogram
          density={histogramDensity}
          label={
            density.length
              ? t(
                  'Densité des événements sourcés au fil du temps',
                  'Density of sourced events over time',
                )
              : t(
                  'Densité des territoires documentés au fil du temps',
                  'Density of documented territories over time',
                )
          }
        />
        <div
          className="timeline-cursor-line"
          style={{ left: `${position * 100}%` }}
          aria-hidden="true"
        />
        <Slider.Root
          className="timeline-track"
          min={0}
          max={10000}
          step={1}
          value={[Math.round(position * 10000)]}
          onValueChange={(values) => {
            setPlaying(false);
            setYear(positionToYear((values[0] ?? 0) / 10000));
          }}
          onKeyDown={(event) => {
            if (
              event.key === 'ArrowLeft' ||
              event.key === 'ArrowDown' ||
              event.key === 'ArrowRight' ||
              event.key === 'ArrowUp'
            ) {
              event.preventDefault();
              setPlaying(false);
              setYear(year + (event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : -1));
            }
          }}
        >
          <Slider.Track className="timeline-rail">
            <Slider.Range className="timeline-progress" />
          </Slider.Track>
          <Slider.Thumb
            className="timeline-thumb"
            aria-label={t('year')}
            aria-valuetext={formatYear(year, locale)}
            data-testid="year-slider"
          />
        </Slider.Root>
      </div>
      <div className="timeline-era-bands">
        {ERAS.map((item) => (
          <button
            key={item.id}
            className={`timeline-era ${item.id === era.id ? 'active' : ''}`}
            style={{ flex: item.weight, borderColor: item.color }}
            title={`${item.name[locale]} · ${formatYear(item.start, locale)}`}
            onClick={() => {
              setPlaying(false);
              setYear(item.start);
            }}
          >
            {item.short[locale]}
          </button>
        ))}
      </div>
      <div className="timeline-ticks" aria-hidden="true">
        {TICKS.map((tick, index) => (
          <span
            key={tick}
            style={{
              left: `${yearToPosition(tick) * 100}%`,
              transform:
                index === 0
                  ? 'none'
                  : index === TICKS.length - 1
                    ? 'translateX(-100%)'
                    : 'translateX(-50%)',
            }}
          >
            {tick <= 0 ? `−${1 - tick}` : tick}
          </span>
        ))}
      </div>
      {range && (
        <div className="timeline-range">
          <span>{formatYear(range[0], locale)}</span>
          <Slider.Root
            className="timeline-range-slider"
            min={0}
            max={10000}
            step={1}
            minStepsBetweenThumbs={0}
            value={range.map((value) => Math.round(yearToPosition(value) * 10000))}
            onValueChange={(values) =>
              setRange([
                positionToYear((values[0] ?? 0) / 10000),
                positionToYear((values[1] ?? 10000) / 10000),
              ])
            }
          >
            <Slider.Track className="timeline-range-rail">
              <Slider.Range className="timeline-range-fill" />
            </Slider.Track>
            <Slider.Thumb
              className="timeline-range-thumb"
              aria-label={t('Début de la période', 'Start of period')}
              aria-valuetext={formatYear(range[0], locale)}
            />
            <Slider.Thumb
              className="timeline-range-thumb"
              aria-label={t('Fin de la période', 'End of period')}
              aria-valuetext={formatYear(range[1], locale)}
            />
          </Slider.Root>
          <span>{formatYear(range[1], locale)}</span>
          <button aria-label={t('clearRange')} onClick={() => setRange(null)}>
            <X size={14} />
          </button>
        </div>
      )}
    </section>
  );
}
