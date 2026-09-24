'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Search,
  X,
  Globe2,
  UserRound,
  ArrowUpRight,
  LoaderCircle,
  Landmark,
  Route,
} from 'lucide-react';
import { useAtlasStore } from '@/lib/store';
import { EVENT_TYPE_LABELS, localizedName, useI18n } from '@/lib/i18n';
import { formatYear } from '@/lib/histdate';
import { getCampaigns } from '@/lib/data-client';
import { createEventNavigation, openCampaign, openPerson } from '@/lib/navigation';
import { useReligionStore } from '@/lib/religions/store';
import { SEARCH_KINDS, type SearchKind, type SearchRecord } from '@/lib/search-records';
import type { Locale } from '@/lib/types';
import { EventIcon } from '../ui/EventIcon';

type Result = Pick<
  SearchRecord,
  | 'id'
  | 'targetId'
  | 'parentId'
  | 'kind'
  | 'name'
  | 'year'
  | 'approximate'
  | 'coords'
  | 'type'
  | 'context'
>;
type Counts = Record<SearchKind, number>;

/** Where keyboard focus lands once the dialog has closed on a result. */
const DESTINATIONS: Record<SearchKind, string> = {
  event: '[data-testid="event-panel"]',
  entity: '[data-testid="entity-panel"]',
  person: '[data-testid="person-panel"]',
  religion: '[data-testid="religion-detail"], [data-testid="religions-panel"]',
  campaign: '.campaign-panel',
};

/** Show a tradition or one of its milestones on the map with the religion layer filtered to it. */
function showReligion(result: Result) {
  const tradition = result.type === 'tradition' ? result.targetId : result.parentId;
  if (!tradition) return;
  const atlas = useAtlasStore.getState();
  const horizon = atlas.range ? Math.max(...atlas.range) : atlas.year;
  // A milestone sets the date; a tradition only moves forward to its first attestation, so a
  // later date keeps showing everything attested by then.
  const moveYear =
    result.year !== undefined && (result.type !== 'tradition' || horizon < result.year);
  atlas.patchState({
    religionsVisible: true,
    religionFilter: tradition,
    playing: false,
    campaignPlaying: false,
    entityFollowing: false,
    battlePlaying: false,
    ...(moveYear ? { year: result.year, range: null } : {}),
    ...(result.coords
      ? {
          camera: {
            ...atlas.camera,
            lon: result.coords[0],
            lat: result.coords[1],
            zoom: result.type === 'tradition' ? 3 : Math.max(4.5, atlas.camera.zoom),
          },
        }
      : {}),
  });
  const religions = useReligionStore.getState();
  religions.select(null);
  religions.setPanelOpen(true);
  if (result.type === 'tradition') return;
  const milestone = result.targetId;
  void import('@/lib/religions/client')
    .then(({ getReligionDataset }) => getReligionDataset())
    .then((dataset) => {
      const stage = dataset.milestones.find((item) => item.id === milestone);
      const state = useAtlasStore.getState();
      // The reader may have moved on while the catalogue was loading.
      if (stage && state.religionsVisible && state.religionFilter === stage.traditionId)
        useReligionStore.getState().select(stage);
    })
    .catch(() => {
      /* The religion layer reports its own loading error and offers a retry. */
    });
}

export default function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { locale, t } = useI18n();
  const eventNavigation = useMemo(() => createEventNavigation(), []);
  useEffect(() => () => eventNavigation.cancel(), [eventNavigation]);
  const [query, setQuery] = useState(''),
    [kind, setKind] = useState<SearchKind | null>(null),
    [results, setResults] = useState<Result[]>([]),
    [counts, setCounts] = useState<Counts | null>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(false),
    [active, setActive] = useState(0);
  const [partial, setPartial] = useState(false);
  const worker = useRef<Worker | null>(null),
    latestQuery = useRef(''),
    latestKind = useRef<SearchKind | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const destination = useRef<string | null>(null);
  // Later choices, and closing the dialog, supersede a campaign still loading.
  const selection = useRef(0);
  useEffect(
    () => () => {
      selection.current += 1;
    },
    [],
  );
  useEffect(() => {
    let instance: Worker;
    try {
      instance = new Worker(new URL('./search.worker.ts', import.meta.url));
    } catch {
      setError(true);
      setBusy(false);
      return;
    }
    worker.current = instance;
    instance.onerror = () => {
      setError(true);
      setBusy(false);
    };
    instance.onmessage = (
      message: MessageEvent<{
        type: string;
        query: string;
        kind: SearchKind | null;
        results: Result[];
        counts: Counts;
        loaded: number;
        total: number;
      }>,
    ) => {
      if (message.data.type === 'error') {
        setError(true);
        setBusy(false);
      }
      if (message.data.type === 'warning') setPartial(true);
      if (
        message.data.type === 'results' &&
        message.data.query === latestQuery.current &&
        message.data.kind === latestKind.current
      ) {
        setResults(message.data.results);
        setCounts(message.data.counts);
        setBusy(message.data.loaded < message.data.total);
      }
    };
    instance.postMessage({ type: 'init', year: useAtlasStore.getState().year });
    return () => {
      instance.terminate();
      worker.current = null;
    };
  }, []);
  useEffect(() => {
    latestQuery.current = query;
    latestKind.current = kind;
    setActive(0);
    worker.current?.postMessage({ type: 'search', query, kind });
  }, [query, kind]);
  const select = async (result: Result) => {
    eventNavigation.cancel();
    const request = ++selection.current;
    if (result.kind === 'person') {
      openPerson(result.targetId ?? result.id, { preserveContext: false });
    } else if (result.kind === 'entity') {
      const state = useAtlasStore.getState();
      state.patchState({
        selectedEntity: result.id,
        selectedEvent: null,
        ...(result.year !== undefined ? { year: result.year } : {}),
        playing: false,
        ...(result.coords
          ? { camera: { ...state.camera, lon: result.coords[0], lat: result.coords[1], zoom: 3 } }
          : {}),
      });
    } else if (result.kind === 'religion') {
      showReligion(result);
    } else if (result.kind === 'campaign') {
      let campaigns: Awaited<ReturnType<typeof getCampaigns>>;
      try {
        campaigns = await getCampaigns();
      } catch {
        if (request === selection.current) setError(true);
        return;
      }
      if (request !== selection.current) return;
      const campaign = campaigns.find((item) => item.id === result.targetId);
      if (!campaign) {
        setError(true);
        return;
      }
      openCampaign(campaign);
    } else {
      try {
        if (!(await eventNavigation.open(result.id))) return;
      } catch {
        setError(true);
        return;
      }
    }
    destination.current = DESTINATIONS[result.kind];
    onOpenChange(false);
  };
  const kindLabel = (value: SearchKind | null) => {
    switch (value) {
      case 'event':
        return t('Événements', 'Events');
      case 'entity':
        return t('Territoires', 'Territories');
      case 'person':
        return t('Personnages', 'People');
      case 'religion':
        return t('Religions', 'Religions');
      case 'campaign':
        return t('Campagnes', 'Campaigns');
      default:
        return t('Tous les types', 'All types');
    }
  };
  const typeLabel = (result: Result) => {
    switch (result.kind) {
      case 'person':
        return t('Personnage historique', 'Historical figure');
      case 'entity':
        return t('Territoire', 'Territory');
      case 'religion':
        return result.type === 'tradition'
          ? t('Tradition religieuse', 'Religious tradition')
          : t('Étape religieuse attestée', 'Attested religious milestone');
      case 'campaign':
        return t('Campagne étape par étape', 'Campaign, step by step');
      default:
        return (EVENT_TYPE_LABELS as Record<string, Record<Locale, string> | undefined>)[
          result.type
        ]?.[locale];
    }
  };
  const kindsWithResults = counts ? SEARCH_KINDS.filter((value) => counts[value] > 0) : [];
  // Filters appear once a query spans several kinds, and stay while one is applied.
  const filters =
    query.trim() && (kindsWithResults.length > 1 || kind)
      ? [
          null,
          ...SEARCH_KINDS.filter((value) => value === kind || kindsWithResults.includes(value)),
        ]
      : [];
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
            if (destination.current) {
              // The destination may already be mounted; its mount effect will not run again.
              const panel = document.querySelector<HTMLElement>(destination.current);
              const target =
                panel?.querySelector<HTMLElement>('[tabindex="-1"]') ??
                panel?.querySelector<HTMLElement>('button');
              if (target) {
                target.focus({ preventScroll: true });
                return;
              }
            }
            // A destination that mounts later focuses itself; until then focus stays reachable.
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
              onChange={(event) => {
                setQuery(event.target.value);
                if (!event.target.value.trim()) setKind(null);
              }}
              placeholder={t(
                'Une bataille, un dirigeant, un empire…',
                'A battle, a leader, an empire…',
              )}
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
          {filters.length > 0 && counts && (
            <div
              className="search-kinds"
              role="group"
              aria-label={t('Filtrer par type', 'Filter by type')}
              data-testid="search-kinds"
            >
              {filters.map((value) => (
                <button
                  key={value ?? 'all'}
                  type="button"
                  aria-pressed={kind === value}
                  data-testid={`search-kind-${value ?? 'all'}`}
                  onClick={() => setKind(value)}
                >
                  {kindLabel(value)}
                  {value && <span>{counts[value].toLocaleString(locale)}</span>}
                </button>
              ))}
            </div>
          )}
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
                    {result.kind === 'person' ? (
                      <UserRound size={19} />
                    ) : result.kind === 'entity' ? (
                      <Globe2 size={19} />
                    ) : result.kind === 'religion' ? (
                      <Landmark size={19} />
                    ) : result.kind === 'campaign' ? (
                      <Route size={19} />
                    ) : (
                      <EventIcon type={result.type} size={19} />
                    )}
                  </span>
                  <span>
                    <strong>{localizedName(result.name, locale)}</strong>
                    <small>
                      {[
                        // A tradition's first attestation is not a founding date.
                        result.year !== undefined && result.type !== 'tradition'
                          ? `${result.approximate ? '≈ ' : ''}${formatYear(result.year, locale)}`
                          : null,
                        typeLabel(result),
                        result.context ? localizedName(result.context, locale) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
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
              {['Rome', locale === 'fr' ? 'Napoléon' : 'Napoleon', 'Mongol', 'Waterloo'].map(
                (word) => (
                  <button key={word} onClick={() => setQuery(word)}>
                    {word}
                  </button>
                ),
              )}
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
