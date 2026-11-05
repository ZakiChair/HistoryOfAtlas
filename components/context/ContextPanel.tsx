'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { useAtlasStore } from '@/lib/store';
import { ensureContext, retryContext, useContextStore } from '@/lib/context/store';
import { CONTEXT_VIEWS, rangeForYear, type ContextViewProps } from '@/lib/context/types';
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
  const recordOpen = useAtlasStore((state) =>
    Boolean(
      state.selectedPerson || state.selectedEntity || (!state.battleMode && state.selectedEvent),
    ),
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const collapseButton = useRef<HTMLButtonElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  // Choosing something on the map asks to read about it.
  useEffect(() => {
    if (selectedId) setCollapsed(false);
  }, [selectedId]);
  useEffect(() => {
    if (view) void ensureContext(view);
  }, [view, revision]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  if (!view) return null;
  // On a phone the sheet covers the map, so an action that shows something there steps aside.
  // The control only takes up room on those layouts, which is what this reads.
  const revealMap = () => {
    if (!collapseButton.current?.offsetParent) return;
    setCollapsed(true);
    collapseButton.current.focus({ preventScroll: true });
  };
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
    onLocate: (target, coordinates, zoom = 3, options) => {
      const state = useAtlasStore.getState();
      state.patchState({
        playing: false,
        campaignPlaying: false,
        entityFollowing: false,
        battleMode: false,
        selectedEvent: null,
        selectedEntity: null,
        selectedPerson: null,
        range: rangeForYear(state.range, target),
      });
      state.setYear(target);
      state.setCamera({ lon: coordinates[0], lat: coordinates[1], zoom, bearing: 0, pitch: 0 });
      if (!options?.keepOpen) revealMap();
    },
    onCenter: (coordinates, zoom) => {
      const state = useAtlasStore.getState();
      state.patchState({ playing: false, campaignPlaying: false, entityFollowing: false });
      state.setCamera({ lon: coordinates[0], lat: coordinates[1], zoom, bearing: 0, pitch: 0 });
      revealMap();
    },
    onYear: (target) => {
      const state = useAtlasStore.getState();
      state.patchState({
        playing: false,
        campaignPlaying: false,
        entityFollowing: false,
        range: rangeForYear(state.range, target),
      });
      state.setYear(target);
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
      data-collapsed={collapsed || undefined}
      data-record-open={recordOpen || undefined}
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
        <div className={styles.headerActions}>
          <button
            ref={collapseButton}
            className={`icon-button ${styles.collapse}`}
            aria-label={contextLabel(locale, collapsed ? 'expand' : 'collapse')}
            aria-expanded={!collapsed}
            aria-controls="context-panel-body"
            data-testid="context-collapse"
            onClick={() => setCollapsed((value) => !value)}
          >
            <ChevronDown size={18} aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            aria-label={contextLabel(locale, 'close')}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
      </header>
      <div id="context-panel-body" className={styles.body}>
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
            <button
              className="primary-button"
              onClick={() => {
                retryContext(view);
                heading.current?.focus({ preventScroll: true });
              }}
            >
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
      </div>
    </section>
  );
}
