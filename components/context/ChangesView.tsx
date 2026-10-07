'use client';
import { useEffect, useRef } from 'react';
import { changesInPeriod, type ChangesDataset } from '@/lib/context/changes';
import { contextContentLanguage, contextText, type ContextViewProps } from '@/lib/context/types';
import { contextLabel, contextFallback } from '@/lib/context/i18n';
import { formatYear } from '@/lib/histdate';
import styles from './ContextPanel.module.css';

export default function ChangesView({
  dataset,
  year,
  range,
  locale,
  selectedId,
  onSelect,
  onLocate,
}: ContextViewProps & { dataset: ChangesDataset }) {
  const active = new Set(changesInPeriod(dataset.changes, year, range).map((item) => item.id));
  const selectedButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    selectedButton.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [selectedId, year, range]);
  const ordered = [...dataset.changes].sort(
    (a, b) => Number(active.has(b.id)) - Number(active.has(a.id)) || a.year - b.year,
  );
  const text = (key: Parameters<typeof contextLabel>[1]) => contextLabel(locale, key);
  return (
    <div data-testid="context-changes">
      <p className={styles.note}>{text('selection')}</p>
      {locale !== 'fr' && locale !== 'en' && (
        <p className={styles.note}>{contextFallback[locale]}</p>
      )}
      <p className={styles.period}>
        {text(range ? 'period' : 'near')} ·{' '}
        {range
          ? `${formatYear(range[0], locale)} – ${formatYear(range[1], locale)}`
          : formatYear(year, locale)}{' '}
        · {active.size} / {dataset.changes.length}
      </p>
      <ol className={styles.list}>
        {ordered.map((change) => (
          <li key={change.id}>
            <button
              className={styles.item}
              aria-expanded={selectedId === change.id}
              ref={selectedId === change.id ? selectedButton : undefined}
              onClick={() => onSelect(selectedId === change.id ? null : change.id)}
            >
              <span lang={contextContentLanguage(locale)} dir="auto">
                {contextText(change.title, locale)}
              </span>
              <small>
                {active.has(change.id) ? text(range ? 'period' : 'near') : text('outside')}
              </small>
            </button>
            {selectedId === change.id && (
              <div className={styles.detail}>
                {(['mechanism', 'consequence', 'limits'] as const).map((key) => (
                  <section key={key}>
                    <h3>{text(key)}</h3>
                    <p lang={contextContentLanguage(locale)} dir="auto">
                      {contextText(change[key], locale)}
                    </p>
                  </section>
                ))}
                <button
                  className="primary-button"
                  onClick={() => onLocate(change.year, change.coordinates, 3)}
                >
                  {text('locate')} · {formatYear(change.year, locale)}
                </button>
                <p className={styles.note}>{text('boundaries')}</p>
                <h3>{text('sources')}</h3>
                <ul>
                  {change.sources.map((source) => (
                    <li key={source.url}>
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {source.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
