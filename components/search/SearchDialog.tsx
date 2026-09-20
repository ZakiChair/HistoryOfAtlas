'use client';
import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Search, X, Globe2, ArrowUpRight, LoaderCircle } from 'lucide-react';
import { useAtlasStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import { formatYear } from '@/lib/histdate';
import { getEvent } from '@/lib/data-client';
import { openEvent } from '@/lib/navigation';
import { EventIcon } from '../ui/EventIcon';

type Result = {
  id: string;
  kind: 'event' | 'entity';
  name: { en: string; fr?: string };
  year: number;
  coords?: [number, number];
  type: string;
};
export default function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { locale, t } = useI18n();
  const [query, setQuery] = useState(''),
    [results, setResults] = useState<Result[]>([]),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(false),
    [active, setActive] = useState(0);
  const [partial, setPartial] = useState(false);
  const worker = useRef<Worker | null>(null),
    latestQuery = useRef('');
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const instance = new Worker(new URL('./search.worker.ts', import.meta.url));
    worker.current = instance;
    instance.onmessage = (
      message: MessageEvent<{
        type: string;
        query: string;
        results: Result[];
        loaded: number;
        total: number;
      }>,
    ) => {
      if (message.data.type === 'error') {
        setError(true);
        setBusy(false);
      }
      if (message.data.type === 'warning') setPartial(true);
      if (message.data.type === 'results' && message.data.query === latestQuery.current) {
        setResults(message.data.results);
        setBusy(message.data.loaded < message.data.total);
      }
    };
    instance.postMessage({ type: 'init', year: useAtlasStore.getState().year });
    return () => {
      instance.terminate();
    };
  }, []);
  useEffect(() => {
    latestQuery.current = query;
    setActive(0);
    worker.current?.postMessage({ type: 'search', query });
  }, [query]);
  const select = async (result: Result) => {
    if (result.kind === 'entity') {
      const state = useAtlasStore.getState();
      state.patchState({
        selectedEntity: result.id,
        selectedEvent: null,
        year: result.year,
        playing: false,
        ...(result.coords
          ? { camera: { ...state.camera, lon: result.coords[0], lat: result.coords[1], zoom: 3 } }
          : {}),
      });
    } else {
      try {
        openEvent(await getEvent(result.id));
      } catch {
        setError(true);
        return;
      }
    }
    onOpenChange(false);
  };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="search-dialog"
          aria-describedby="search-description"
          onOpenAutoFocus={() => {
            returnFocus.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocus.current?.isConnected) returnFocus.current.focus();
          }}
        >
          <Dialog.Title className="sr-only">
            {t('Rechercher dans l’atlas', 'Search the atlas')}
          </Dialog.Title>
          <div className="search-input-row">
            <Search size={21} />
            <input
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('Une bataille, un empire, un lieu…', 'A battle, an empire, a place…')}
              aria-label={t('Rechercher dans l’atlas', 'Search the atlas')}
              role="combobox"
              aria-controls="atlas-search-results"
              aria-expanded={results.length > 0}
              aria-activedescendant={results[active] ? `result-${results[active].id}` : undefined}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setActive((value) => Math.max(0, Math.min(value + 1, results.length - 1)));
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setActive((value) => Math.max(0, value - 1));
                }
                if (event.key === 'Enter' && results[active]) void select(results[active]);
              }}
            />
            <Dialog.Close className="icon-button" aria-label={t('close')}>
              <X size={18} />
            </Dialog.Close>
          </div>
          <p className="search-description" id="search-description">
            {t(
              'Explorer les noms et les lieux documentés, à travers toutes les époques.',
              'Explore documented names and places across every era.',
            )}
          </p>
          {error && (
            <p role="alert" className="empty-state">
              {t(
                'Une partie de l’index n’a pas pu être chargée. Réessayez en rouvrant la recherche.',
                'Part of the index could not be loaded. Reopen search to try again.',
              )}
            </p>
          )}
          {partial && !error && (
            <p role="status" className="notice">
              {t(
                'Certaines archives n’ont pas pu être chargées : les résultats sont incomplets. Rouvrez la recherche pour réessayer.',
                'Some archives could not be loaded: these results are incomplete. Reopen search to retry.',
              )}
            </p>
          )}
          <ul
            id="atlas-search-results"
            role="listbox"
            aria-label={t('searchResults')}
            className="search-results"
          >
            {results.map((result, index) => (
              <li key={result.id} role="presentation">
                <button
                  id={`result-${result.id}`}
                  role="option"
                  aria-selected={index === active}
                  tabIndex={-1}
                  className={index === active ? 'active' : ''}
                  onClick={() => void select(result)}
                  onMouseEnter={() => setActive(index)}
                >
                  <span className="search-kind">
                    {result.kind === 'entity' ? (
                      <Globe2 size={19} />
                    ) : (
                      <EventIcon type={result.type} size={19} />
                    )}
                  </span>
                  <span>
                    <strong>{result.name[locale] ?? result.name.en}</strong>
                    <small>
                      {formatYear(result.year, locale)}
                      {result.kind === 'entity' && ` · ${t('Territoire', 'Territory')}`}
                    </small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              </li>
            ))}
          </ul>
          {!results.length && query.length > 0 && !busy && (
            <p className="empty-state">
              {t(
                'Aucun résultat. Essayez un autre nom ou son équivalent anglais.',
                'No results. Try another name or its English equivalent.',
              )}
            </p>
          )}
          {!query && (
            <div className="search-suggestions">
              <span>{t('Quelques points de départ', 'Some starting points')}</span>
              {['Rome', 'Napoléon', 'Mongol', 'Waterloo'].map((word) => (
                <button key={word} onClick={() => setQuery(word)}>
                  {word}
                </button>
              ))}
            </div>
          )}
          <div className="search-footer">
            <span>
              {busy ? (
                <>
                  <LoaderCircle className="spin" size={13} />
                  {t('Indexation des archives…', 'Indexing the archives…')}
                </>
              ) : (
                t('Recherche dans les sources chargées', 'Searching the loaded sources')
              )}
            </span>
            <span>
              ↑ ↓ <span>{t('naviguer', 'navigate')}</span> ↵ <span>{t('ouvrir', 'open')}</span>
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
