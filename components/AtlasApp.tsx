'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useId, useState } from 'react';
import { AnimatePresence, LazyMotion, domAnimation, m, MotionConfig } from 'framer-motion';
import {
  Search,
  Globe2,
  Map as MapIcon,
  Layers3,
  List,
  Sun,
  Moon,
  Plus,
  Minus,
  Compass,
  Shuffle,
  CalendarDays,
  ArrowUpRight,
  X,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  BookOpen,
  Route,
  Expand,
  Info,
  Footprints,
  History,
} from 'lucide-react';
import { useAtlasStore } from '@/lib/store';
import { createAtlasUrlSync } from '@/lib/store/url-sync';
import { useI18n } from '@/lib/i18n';
import { CURRENT_YEAR, getEra } from '@/lib/eras';
import { formatYear } from '@/lib/histdate';
import { useJson } from '@/lib/data-client/hooks';
import { getManifest, readJson, type DataManifest } from '@/lib/data-client';
import type { GeographyManifest } from '@/lib/geography';
import type { HistoricalEvent } from '@/lib/schema';
import { openEvent } from '@/lib/navigation';
import { surroundingSnapshots } from '@/lib/map-time';
import Timeline from './timeline/Timeline';
import { IconButton } from './ui/IconButton';

const WorldMap = dynamic(() => import('./map/WorldMap'), { ssr: false });
const EventList = dynamic(() => import('./panels/EventList'));
const EventPanel = dynamic(() => import('./panels/EventPanel'));
const EntityPanel = dynamic(() => import('./panels/EntityPanel'));
const PersonPanel = dynamic(() => import('./panels/PersonPanel'));
const Filters = dynamic(() => import('./panels/Filters'));
const CampaignPanel = dynamic(() => import('./panels/CampaignPanel'));
const StoryPanel = dynamic(() => import('./story/StoryPanel'));
const SearchDialog = dynamic(() => import('./search/SearchDialog'));

type Territory = { id: string; name: string; color: string; areaKm2: number };

function CompassRose({ small = false }: { small?: boolean }) {
  return (
    <svg
      viewBox="0 0 60 60"
      fill="none"
      aria-hidden="true"
      className={small ? 'brand-compass' : 'compass-rose'}
    >
      <circle cx="30" cy="30" r="22" stroke="currentColor" strokeWidth=".6" />
      <circle cx="30" cy="30" r="17" stroke="currentColor" strokeWidth=".4" />
      <path
        d="M30 2L34 26L58 30L34 34L30 58L26 34L2 30L26 26L30 2Z"
        stroke="currentColor"
        strokeWidth=".8"
      />
      <path
        d="M30 2L30 30L34 26Z M58 30L30 30L34 34Z M30 58L30 30L26 34Z M2 30L30 30L26 26Z"
        fill="currentColor"
      />
      <circle cx="30" cy="30" r="3" fill="currentColor" />
    </svg>
  );
}

function DeferredEventList() {
  const [visible, setVisible] = useState(false);
  const { t } = useI18n();
  const id = useId();
  return (
    <div>
      <button
        className="text-button list-more"
        aria-expanded={visible}
        aria-controls={id}
        onClick={() => setVisible((value) => !value)}
      >
        {visible
          ? t('Masquer les événements de cette période', 'Hide events in this period')
          : t('Voir les événements de cette période', 'View events in this period')}
        <ArrowUpRight size={14} aria-hidden="true" />
      </button>
      <div id={id}>{visible && <EventList />}</div>
    </div>
  );
}

function Overview({
  manifest,
  territories,
}: {
  manifest: DataManifest | null;
  territories: Territory[];
}) {
  const { locale, t } = useI18n();
  const year = useAtlasStore((s) => s.year);
  return (
    <>
      <div className="overview-heading">
        <span className="edition-label">{t('Un atlas du temps', 'An atlas of time')}</span>
        <h2>{t('Le monde change\nde frontières.', 'The world changes\nits borders.')}</h2>
        <p>
          {t(
            'Voyagez à travers les siècles. Découvrez les territoires, les conflits et les événements qui les ont façonnés.',
            'Travel across the centuries. Discover territories, conflicts and the events that shaped them.',
          )}
        </p>
      </div>
      <div className="current-era">
        <span style={{ background: getEra(year).color }} />
        <span>{getEra(year).name[locale]}</span>
        <span className="era-rule" />
      </div>
      <section className="territory-overview">
        <div className="section-heading">
          <h2>{t('Territoires dans la vue', 'Territories in view')}</h2>
          <span className="count-badge">{territories.length || '—'}</span>
        </div>
        <ul className="territory-list">
          {territories.slice(0, 5).map((item) => (
            <li key={item.id}>
              <button
                onClick={() =>
                  useAtlasStore
                    .getState()
                    .patchState({
                      selectedEntity: item.id,
                      selectedEvent: null,
                      selectedPerson: null,
                    })
                }
              >
                <span className="territory-color" style={{ background: item.color }} />
                <span>{item.name}</span>
                <ArrowUpRight size={13} />
              </button>
            </li>
          ))}
        </ul>
        {!territories.length && (
          <p className="source-note">
            {t(
              'Les territoires apparaissent avec les données disponibles à cette date.',
              'Territories appear as documented for this date.',
            )}
          </p>
        )}
      </section>
      <DeferredEventList />
      <div className="archive-note">
        <BookOpen size={15} />
        <span>
          {manifest
            ? `${manifest.totalEvents.toLocaleString(locale)} ${t('événements sourcés', 'sourced events')}`
            : t(
                'Des archives ouvertes, des sources consultables',
                'Open archives, accessible sources',
              )}
          <Link prefetch={false} href="/about/">
            {t('Comprendre les données', 'Understand the data')}
            <ArrowUpRight size={11} />
          </Link>
        </span>
      </div>
    </>
  );
}

function MapCaption({ geo }: { geo: GeographyManifest | null }) {
  const year = useAtlasStore((s) => s.year),
    projection = useAtlasStore((s) => s.projection),
    camera = useAtlasStore((s) => s.camera);
  const boundarySource = useAtlasStore((s) => s.boundarySource);
  const { locale, t } = useI18n();
  const cliopatria =
    boundarySource === 'cliopatria' && geo?.temporal && year >= geo.temporal.range[0];
  const sourceYear = Math.min(
    year,
    cliopatria ? geo!.temporal!.range[1] : (geo?.snapshots.at(-1)?.year ?? year),
  );
  const snapshots = !cliopatria && geo ? surroundingSnapshots(geo.snapshots, year) : null;
  const sourceDates = snapshots
    ? `${formatYear(snapshots.before.year, locale)}${snapshots.after.year !== snapshots.before.year ? ` / ${formatYear(snapshots.after.year, locale)}` : ''}`
    : year > sourceYear
      ? formatYear(sourceYear, locale)
      : '';
  const source = cliopatria ? 'Cliopatria / Seshat' : 'Historical Basemaps';
  return (
    <>
      <div className="map-coordinate">
        <span>
          {Math.abs(camera.lat).toFixed(1)}° {camera.lat >= 0 ? 'N' : 'S'} &nbsp;{' '}
          {Math.abs(camera.lon).toFixed(1)}° {camera.lon >= 0 ? 'E' : t('O', 'W')}
        </span>
        <span>{projection === 'globe' ? t('Vue globe', 'Globe view') : 'Mercator'}</span>
      </div>
      <div className="map-attribution">
        <Info size={12} />
        <span>
          {t('Contours approximatifs', 'Approximate boundaries')}
          {sourceDates && ` · ${t('sources', 'sources')} ${sourceDates}`}
        </span>
        <Link prefetch={false} href="/about/">
          {source} · Natural Earth
        </Link>
      </div>
    </>
  );
}

export default function AtlasApp() {
  const { locale, t, setLocale, dir } = useI18n();
  const theme = useAtlasStore((s) => s.theme),
    projection = useAtlasStore((s) => s.projection),
    mode = useAtlasStore((s) => s.mode),
    trails = useAtlasStore((s) => s.trails);
  const boundarySource = useAtlasStore((s) => s.boundarySource);
  const selectedEvent = useAtlasStore((s) => s.selectedEvent),
    selectedEntity = useAtlasStore((s) => s.selectedEntity),
    selectedPerson = useAtlasStore((s) => s.selectedPerson),
    selectedWar = useAtlasStore((s) => s.selectedWar);
  const campaignId = useAtlasStore((s) => s.campaignId),
    storyId = useAtlasStore((s) => s.storyId);
  const { data: manifest } = useJson<DataManifest>('/data/manifest.json'),
    { data: geo } = useJson<GeographyManifest>('/geo/manifest.json');
  const [hydrated, setHydrated] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [sidebarOpen, setSidebarOpen] = useState(true);
  const [tab, setTab] = useState<'explore' | 'campaigns' | 'stories'>('explore'),
    [showFilters, setShowFilters] = useState(false);
  const [territories, setTerritories] = useState<Territory[]>([]),
    [toast, setToast] = useState(''),
    [intro, setIntro] = useState(false);

  useEffect(() => {
    useAtlasStore.getState().hydrateFromUrl(window.location.search);
    setHydrated(true);
    const urlSync = createAtlasUrlSync({
      getState: useAtlasStore.getState,
      subscribe: (listener) => useAtlasStore.subscribe(listener),
      readQuery: () => window.location.search,
      writeQuery: (query) => history.replaceState(null, '', `${location.pathname}${query}`),
      hydrateQuery: (query) => useAtlasStore.getState().hydrateFromUrl(query),
    });
    window.addEventListener('popstate', urlSync.restore);
    const listener = (event: Event) => setTerritories((event as CustomEvent<Territory[]>).detail);
    window.addEventListener('atlas:territories', listener);
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
      if (event.key === 'Escape') {
        if (useAtlasStore.getState().selectedPerson) {
          useAtlasStore.getState().selectPerson(null);
          return;
        }
        useAtlasStore.setState({
          selectedEvent: null,
          selectedEntity: null,
          selectedPerson: null,
          playing: false,
          campaignPlaying: false,
          entityFollowing: false,
        });
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      urlSync.dispose();
      window.removeEventListener('popstate', urlSync.restore);
      window.removeEventListener('atlas:territories', listener);
      window.removeEventListener('keydown', key);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [theme, locale, dir]);
  useEffect(() => {
    if (campaignId) {
      setTab('campaigns');
      setSidebarOpen(true);
    } else if (storyId) {
      setTab('stories');
      setSidebarOpen(true);
    }
  }, [campaignId, storyId]);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      if (
        location.search ||
        sessionStorage.getItem('atlas-intro') ||
        matchMedia('(prefers-reduced-motion: reduce)').matches
      )
        return;
      sessionStorage.setItem('atlas-intro', 'seen');
      setIntro(true);
      const years = [-3500, -2300, -330, 117, 800, 1206, 1492, 1812, 1914, 1945, CURRENT_YEAR];
      let step = 0;
      useAtlasStore.getState().setYear(years[step]);
      timer = setInterval(() => {
        step++;
        if (step >= years.length) {
          clearInterval(timer);
          setIntro(false);
          return;
        }
        const state = useAtlasStore.getState();
        state.patchState({ year: years[step], camera: { ...state.camera, lon: -30 + step * 4.8 } });
      }, 220);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        setIntro(false);
      }
    };
    window.addEventListener('atlas:ready', start);
    window.addEventListener('pointerdown', stop);
    window.addEventListener('keydown', stop);
    return () => {
      clearInterval(timer);
      window.removeEventListener('atlas:ready', start);
      window.removeEventListener('pointerdown', stop);
      window.removeEventListener('keydown', stop);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  const surprise = useCallback(
    async (today = false) => {
      try {
        if (today) {
          const parts = new Intl.DateTimeFormat('en', {
            month: '2-digit',
            day: '2-digit',
          }).formatToParts();
          const month = parts.find((part) => part.type === 'month')?.value,
            day = parts.find((part) => part.type === 'day')?.value;
          const matches = await readJson<HistoricalEvent[]>(
            `/data/on-this-day/${month}-${day}.json`,
          );
          if (!matches.length) {
            setToast(
              locale === 'fr'
                ? 'Aucun événement daté de ce jour dans les archives disponibles.'
                : 'No event dated to this day in the available archives.',
            );
            return;
          }
          openEvent(matches[Math.floor(Math.random() * matches.length)]);
        } else {
          const data = await getManifest();
          let selection = Math.random() * data.totalEvents;
          const chunk =
            data.chunks.find((item) => {
              selection -= item.count;
              return selection < 0;
            }) ?? data.chunks[0];
          const events = await readJson<HistoricalEvent[]>(chunk.path);
          openEvent(events[Math.floor(Math.random() * events.length)]);
        }
      } catch {
        setToast(
          locale === 'fr'
            ? 'Cette archive n’est pas disponible pour le moment.'
            : 'This archive is currently unavailable.',
        );
      }
    },
    [locale],
  );

  const changeZoom = (amount: number) => {
    const state = useAtlasStore.getState();
    state.setCamera({ zoom: Math.max(0, Math.min(18, state.camera.zoom + amount)) });
  };
  const hasDetail = Boolean(selectedPerson || selectedEntity || selectedEvent);
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation}>
        <main
          className={`atlas-app ${sidebarOpen ? 'sidebar-is-open' : ''} ${hasDetail ? 'detail-is-open' : ''}`}
        >
          <h1 className="sr-only">
            Atlas Belli — {t('L’histoire à travers les cartes', 'History through maps')}
          </h1>
          <a className="skip-link" href="#atlas-explore">
            {t('skipToContent')}
          </a>
          {hydrated && <WorldMap />}
          <header className="atlas-header">
            <Link href="/" className="brand">
              <CompassRose small />
              <span>
                Atlas Belli
                <span className="brand-subtitle">
                  {t('L’histoire à travers les cartes', 'History through maps')}
                </span>
              </span>
            </Link>
            <nav className="primary-nav" aria-label={t('Navigation principale', 'Main navigation')}>
              {(['explore', 'campaigns', 'stories'] as const).map((item) => (
                <button
                  key={item}
                  className={tab === item ? 'active' : ''}
                  onClick={() => {
                    setTab(item);
                    setSidebarOpen(true);
                  }}
                >
                  {t(item)}
                </button>
              ))}
            </nav>
            <div className="header-actions">
              <div className="search-shortcut">
                <button
                  className="search-trigger"
                  onClick={() => setSearchOpen(true)}
                  aria-label={t('Rechercher dans l’atlas', 'Search the atlas')}
                >
                  <Search size={17} />
                  <span>{t('Rechercher', 'Search')}</span>
                </button>
                <kbd aria-hidden="true">⌘ K</kbd>
              </div>
              <button
                className="language-toggle"
                aria-label={
                  locale === 'fr' ? 'FR EN — Passer en anglais' : 'EN FR — Switch to French'
                }
                onClick={() => setLocale(locale === 'fr' ? 'en' : 'fr')}
              >
                {locale.toUpperCase()} <span>{locale === 'fr' ? 'EN' : 'FR'}</span>
              </button>
              <Link prefetch={false} href="/about/" className="about-link" aria-label={t('about')}>
                <Info size={18} />
              </Link>
            </div>
          </header>
          <div className="map-topline">
            <span className="live-dot" />
            {t('5 500 ans de territoires en mouvement', '5,500 years of changing territories')}
            <span className="topline-rule" />
          </div>
          <AnimatePresence initial={false}>
            {sidebarOpen && (
              <m.aside
                key="exploration"
                id="atlas-explore"
                className={`exploration-panel ${mode === 'list' ? 'list-panel' : ''}`}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
                aria-label={t('Carnet d’exploration', 'Exploration notebook')}
              >
                <div className="exploration-top">
                  <span className="notebook-label">
                    <span />
                    {tab === 'explore'
                      ? t('Explorer l’atlas', 'Explore the atlas')
                      : tab === 'campaigns'
                        ? t('campaigns')
                        : t('stories')}
                  </span>
                  <button
                    className="icon-button panel-collapse"
                    aria-label={t('Replier le carnet', 'Collapse notebook')}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                </div>
                <div className="mobile-tabs">
                  {(['explore', 'campaigns', 'stories'] as const).map((item) => (
                    <button
                      className={tab === item ? 'active' : ''}
                      key={item}
                      onClick={() => setTab(item)}
                    >
                      {t(item)}
                    </button>
                  ))}
                </div>
                <div className="exploration-scroll">
                  {tab === 'explore' ? (
                    <>
                      {mode === 'list' ? (
                        <>
                          <button
                            className="text-button"
                            onClick={() => useAtlasStore.getState().setMode('events')}
                          >
                            <ChevronLeft size={14} />
                            {t('Retour à l’atlas', 'Back to the atlas')}
                          </button>
                          <Filters />
                          <EventList full />
                        </>
                      ) : (
                        <>
                          {showFilters ? (
                            <Filters />
                          ) : (
                            <Overview manifest={manifest} territories={territories} />
                          )}
                          <button
                            className={`filter-toggle ${showFilters ? 'active' : ''}`}
                            onClick={() => setShowFilters(!showFilters)}
                          >
                            <SlidersHorizontal size={15} />
                            {showFilters
                              ? t('Revenir à l’exploration', 'Back to exploration')
                              : t('Filtres & sélection', 'Filters & selection')}
                          </button>
                        </>
                      )}
                    </>
                  ) : tab === 'campaigns' ? (
                    <CampaignPanel />
                  ) : (
                    <StoryPanel />
                  )}
                </div>
                <div className="discovery-actions">
                  <button onClick={() => void surprise()}>
                    <Shuffle size={15} />
                    {t('Au hasard', 'Surprise me')}
                  </button>
                  <button onClick={() => void surprise(true)}>
                    <CalendarDays size={15} />
                    {t('Ce jour-là', 'On this day')}
                  </button>
                </div>
              </m.aside>
            )}
          </AnimatePresence>
          {!sidebarOpen && (
            <button
              className="reopen-panel"
              onClick={() => setSidebarOpen(true)}
              aria-label={t('Ouvrir le carnet', 'Open notebook')}
            >
              <BookOpen size={18} />
              <ChevronRight size={14} />
            </button>
          )}
          <div
            className="map-tools"
            role="toolbar"
            aria-label={t('Commandes de la carte', 'Map controls')}
          >
            <div className="tool-group">
              <IconButton
                label={projection === 'globe' ? t('flatMap') : t('globe')}
                onClick={() =>
                  useAtlasStore
                    .getState()
                    .setProjection(projection === 'globe' ? 'mercator' : 'globe')
                }
                className={projection === 'globe' ? 'active' : ''}
              >
                {projection === 'globe' ? <Globe2 size={20} /> : <MapIcon size={20} />}
              </IconButton>
              <IconButton
                label={
                  boundarySource === 'cliopatria'
                    ? t('Comparer les instantanés historiques', 'Compare historical snapshots')
                    : t('Afficher les territoires datés', 'Show dated territories')
                }
                aria-pressed={boundarySource === 'historical-basemaps'}
                className={boundarySource === 'historical-basemaps' ? 'active' : ''}
                onClick={() =>
                  useAtlasStore
                    .getState()
                    .setBoundarySource(
                      boundarySource === 'cliopatria' ? 'historical-basemaps' : 'cliopatria',
                    )
                }
              >
                <History size={19} />
              </IconButton>
              <IconButton
                label={t('heatmap')}
                aria-pressed={mode === 'heatmap'}
                className={mode === 'heatmap' ? 'active' : ''}
                onClick={() =>
                  useAtlasStore.getState().setMode(mode === 'heatmap' ? 'events' : 'heatmap')
                }
              >
                <Layers3 size={20} />
              </IconButton>
              <IconButton
                label={t('listView')}
                aria-pressed={mode === 'list'}
                onClick={() => {
                  useAtlasStore.getState().setMode(mode === 'list' ? 'events' : 'list');
                  setTab('explore');
                  setSidebarOpen(true);
                }}
              >
                <List size={20} />
              </IconButton>
              <IconButton
                label={t('traces')}
                aria-pressed={trails}
                className={trails ? 'active' : ''}
                onClick={() => useAtlasStore.getState().setTrails(!trails)}
              >
                <Footprints size={19} />
              </IconButton>
            </div>
            <div className="tool-group">
              <IconButton label={t('Zoom avant', 'Zoom in')} onClick={() => changeZoom(0.8)}>
                <Plus size={20} />
              </IconButton>
              <IconButton label={t('Zoom arrière', 'Zoom out')} onClick={() => changeZoom(-0.8)}>
                <Minus size={20} />
              </IconButton>
              <IconButton
                label={t('Recentrer le monde', 'Reset the world view')}
                onClick={() =>
                  useAtlasStore
                    .getState()
                    .setCamera({ lon: 18, lat: 32, zoom: 1.8, bearing: 0, pitch: 0 })
                }
              >
                <Compass size={20} />
              </IconButton>
            </div>
            <div className="tool-group">
              <IconButton
                label={t(theme === 'dark' ? 'lightTheme' : 'darkTheme')}
                onClick={() =>
                  useAtlasStore.getState().setTheme(theme === 'dark' ? 'light' : 'dark')
                }
              >
                {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
              </IconButton>
              <IconButton
                label={t('Plein écran', 'Fullscreen')}
                onClick={() => {
                  if (document.fullscreenElement) void document.exitFullscreen();
                  else
                    void document.documentElement
                      .requestFullscreen()
                      .catch(() =>
                        setToast(
                          t('Le plein écran n’est pas disponible.', 'Fullscreen is unavailable.'),
                        ),
                      );
                }}
              >
                <Expand size={18} />
              </IconButton>
            </div>
          </div>
          <div className="world-compass">
            <span>N</span>
            <CompassRose />
          </div>
          {selectedWar && (
            <div className="war-context">
              <Route size={14} />
              {t('Conflit sélectionné', 'Selected conflict')}
              <button
                aria-label={t('Quitter le conflit', 'Leave conflict')}
                onClick={() => useAtlasStore.setState({ selectedWar: null, range: null })}
              >
                <X size={14} />
              </button>
            </div>
          )}
          {selectedPerson ? (
            <PersonPanel key={selectedPerson} />
          ) : selectedEntity ? (
            <EntityPanel key={selectedEntity} />
          ) : selectedEvent ? (
            <EventPanel key={selectedEvent} />
          ) : null}
          <MapCaption geo={geo} />
          <Timeline density={manifest?.density} territorialDensity={geo?.temporal?.density} />
          {intro && (
            <div className="intro-note">
              {t('Un monde, des milliers de frontières.', 'One world, thousands of borders.')}
              <button onClick={() => setIntro(false)}>{t('Explorer', 'Explore')}</button>
            </div>
          )}
          {toast && (
            <div className="toast" role="status">
              {toast}
              <button aria-label={t('close')} onClick={() => setToast('')}>
                <X size={15} />
              </button>
            </div>
          )}
          {searchOpen && <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />}
        </main>
      </LazyMotion>
    </MotionConfig>
  );
}
