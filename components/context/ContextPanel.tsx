'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useAtlasStore } from '@/lib/store';
import { ensureContext, retryContext, useContextStore } from '@/lib/context/store';
import { CONTEXT_VIEWS, type ContextViewProps } from '@/lib/context/types';
import { contextLabel } from '@/lib/context/i18n';
import { contextTitle } from '@/lib/context/title';
import ChangesView from './ChangesView';
import CoverageView from './CoverageView';
import NetworksView from './NetworksView';
import CitiesView from './CitiesView';
import styles from './ContextPanel.module.css';

export default function ContextPanel({ onClose }: { onClose: () => void }) {
  const view = useAtlasStore((state) => state.contextView);
  const year = useAtlasStore((state) => state.year);
  const range = useAtlasStore((state) => state.range);
  const locale = useAtlasStore((state) => state.locale);
  const sourceId = useAtlasStore((state) => state.boundarySource);
  const selectedId = useAtlasStore((state) => state.contextSelection);
  const { loaded, status, revision } = useContextStore();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (view) void ensureContext(view);
  }, [view, revision]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  if (!view) return null;
  const props: ContextViewProps = {
    year,
    range,
    locale,
    sourceId,
    selectedId,
    onSelect: (id) =>
      useAtlasStore
        .getState()
        .patchState({ contextSelection: id, playing: false, campaignPlaying: false }),
    onLocate: (target, coordinates, zoom = 3) => {
      const state = useAtlasStore.getState();
      state.patchState({
        playing: false,
        campaignPlaying: false,
        entityFollowing: false,
        battleMode: false,
        selectedEvent: null,
        selectedEntity: null,
        selectedPerson: null,
        range: null,
      });
      state.setYear(target);
      state.setCamera({ lon: coordinates[0], lat: coordinates[1], zoom, bearing: 0, pitch: 0 });
    },
  };
  // The overlay also sets loading while its module imports. Keep the validated reader
  // mounted so that late map initialization cannot discard its search and filters.
  const ready = loaded?.view === view;
  return (
    <section
      className={styles.panel}
      aria-labelledby="context-heading"
      data-testid="context-panel"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className={styles.header}>
        <h2 id="context-heading" tabIndex={-1} ref={heading}>
          {contextTitle[locale]}
        </h2>
        <button
          className="icon-button"
          aria-label={contextLabel(locale, 'close')}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <div className={styles.tabs} role="group" aria-label={contextTitle[locale]}>
        {CONTEXT_VIEWS.map((item) => (
          <button
            key={item}
            aria-pressed={view === item}
            data-testid={`context-tab-${item}`}
            onClick={() =>
              useAtlasStore.getState().patchState({ contextView: item, contextSelection: null })
            }
          >
            {contextLabel(locale, item)}
          </button>
        ))}
      </div>
      {status === 'error' ? (
        <div role="alert">
          <p>{contextLabel(locale, 'error')}</p>
          <button className="primary-button" onClick={() => retryContext(view)}>
            {contextLabel(locale, 'retry')}
          </button>
        </div>
      ) : !ready ? (
        <p role="status">{contextLabel(locale, 'loading')}</p>
      ) : (
        <>
          {loaded.view === 'changes' && <ChangesView {...props} dataset={loaded.dataset} />}
          {loaded.view === 'coverage' && <CoverageView {...props} dataset={loaded.dataset} />}
          {loaded.view === 'networks' && <NetworksView {...props} dataset={loaded.dataset} />}
          {loaded.view === 'cities' && <CitiesView {...props} dataset={loaded.dataset} />}
        </>
      )}
    </section>
  );
}
