'use client';

import { useId } from 'react';
import { ArrowUpRight, Route, Swords, Waypoints, X, type LucideIcon } from 'lucide-react';
import { useAtlasStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import { onboardingText, type OnboardingCopyKey } from '@/lib/i18n/onboarding';
import { getCampaigns, readJson } from '@/lib/data-client';
import { openCampaign } from '@/lib/navigation';
import { focusBattle } from '@/lib/battles/navigation';
import { useReligionStore } from '@/lib/religions/store';
import { PHONE_QUERY, START_DOORS } from '@/lib/first-visit';

type BattleTarget = Parameters<typeof focusBattle>[0];

const phone = () => window.matchMedia(PHONE_QUERY).matches;

const focusTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)?.focus({ preventScroll: true });

/**
 * The card unmounts while it holds focus, which would drop focus to <body>. Like the help sheet,
 * it hands focus back to the help button, which stays in the header.
 */
const focusHelp = () => focusTestId('help-trigger');

/** The campaign panel does not take focus by itself; move it there once it has mounted. */
function focusWhenMounted(selector: string, frames = 120) {
  const panel = document.querySelector<HTMLElement>(selector);
  const target =
    panel?.querySelector<HTMLElement>('[tabindex="-1"]') ??
    panel?.querySelector<HTMLElement>('button');
  if (target) target.focus({ preventScroll: true });
  else if (frames > 0) requestAnimationFrame(() => focusWhenMounted(selector, frames - 1));
  // A slow catalogue: keep focus somewhere useful unless the reader has moved it already.
  else if (!document.activeElement || document.activeElement === document.body) focusHelp();
}

function openNapoleonicWars() {
  getCampaigns()
    .then((campaigns) => {
      const campaign = campaigns.find((item) => item.id === START_DOORS.campaign);
      if (!campaign) throw new Error('Campaign not found');
      openCampaign(campaign);
    })
    // The campaign panel reports an unavailable catalogue itself.
    .catch(() => useAtlasStore.getState().setCampaign(START_DOORS.campaign))
    .finally(() => focusWhenMounted('.campaign-panel'));
}

function enterWaterloo() {
  readJson<BattleTarget>(`/data/battles/events/${START_DOORS.battle}.json`)
    .then((battle) => focusBattle(battle))
    // Without its record the reconstruction still opens at the right date and reports the error.
    .catch(() => focusBattle({ id: START_DOORS.battle, start: { year: 1815 } }));
}

function watchBuddhismSpread() {
  const onPhone = phone();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = useAtlasStore.getState();
  state.patchState({
    religionsVisible: true,
    religionFilter: START_DOORS.religion,
    year: START_DOORS.religionYear,
    range: null,
    battleMode: false,
    selectedEvent: null,
    selectedEntity: null,
    selectedPerson: null,
    selectedWar: null,
    campaignId: null,
    storyId: null,
    mode: 'events',
    speed: 25,
    // Asked-for motion: the chronology runs unless the reader prefers reduced motion.
    playing: !reduced,
    camera: {
      ...state.camera,
      lon: 103,
      lat: 27,
      zoom: onPhone ? 1.9 : 2.5,
      bearing: 0,
      pitch: 0,
    },
  });
  const religions = useReligionStore.getState();
  religions.select(null);
  // On a phone the legend would cover the spread it describes; it stays one tap away, and focus
  // waits on the layer it belongs to (the open legend takes focus itself elsewhere).
  if (!onPhone) religions.setPanelOpen(true);
  else focusTestId('religions-layer-toggle');
}

const DOORS: {
  id: 'campaign' | 'battle' | 'religion';
  icon: LucideIcon;
  title: OnboardingCopyKey;
  detail: OnboardingCopyKey;
  open: () => void;
}[] = [
  {
    id: 'campaign',
    icon: Route,
    title: 'napoleonTitle',
    detail: 'napoleonDetail',
    open: openNapoleonicWars,
  },
  {
    id: 'battle',
    icon: Swords,
    title: 'waterlooTitle',
    detail: 'waterlooDetail',
    open: enterWaterloo,
  },
  {
    id: 'religion',
    icon: Waypoints,
    title: 'buddhismTitle',
    detail: 'buddhismDetail',
    open: watchBuddhismSpread,
  },
];

export default function StartCard({ onDismiss }: { onDismiss: () => void }) {
  const { locale } = useI18n();
  const text = (key: OnboardingCopyKey) => onboardingText(locale, key);
  const titleId = useId();
  // The doors move focus to what they open; closing the card returns it to the header.
  const close = () => {
    focusHelp();
    onDismiss();
  };
  return (
    <section
      className="start-card"
      data-testid="start-card"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        // The atlas-wide Escape would otherwise also clear the reader's selection.
        event.preventDefault();
        close();
      }}
    >
      <div className="start-card-heading">
        <div>
          <span className="edition-label">{text('startEyebrow')}</span>
          <h2 id={titleId}>{text('startTitle')}</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label={text('dismiss')}
          data-testid="start-card-close"
          onClick={close}
        >
          <X size={17} aria-hidden="true" />
        </button>
      </div>
      <p className="start-card-lead">{text('startLead')}</p>
      <ul className="start-doors">
        {DOORS.map(({ id, icon: Icon, title, detail, open }) => (
          <li key={id}>
            <button
              type="button"
              className="start-door"
              data-testid={`start-door-${id}`}
              onClick={() => {
                onDismiss();
                open();
              }}
            >
              <Icon size={20} strokeWidth={1.35} aria-hidden="true" />
              <span>
                <strong>{text(title)}</strong>
                <small>{text(detail)}</small>
              </span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <p className="start-card-help">{text('startHelp')}</p>
    </section>
  );
}
