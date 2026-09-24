'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { EVENT_TYPE_LABELS, useI18n } from '@/lib/i18n';
import { EVENT_TYPES, type EventType } from '@/lib/types';
import {
  BATTLE_MODE_COLORS,
  EVENT_GROUP_COLORS,
  EVENT_TYPE_COLORS,
  SELECTION_COLORS,
} from '@/lib/colors/semantic';
import { EVENT_GLYPH_CIRCLES, EVENT_GLYPH_PAINT, EVENT_GLYPHS } from './markers';

/** Paper ring of the map's event dots (WorldMap `event-points`). */
const DOT_RING = '#fff0c8';

/** Dark ring of the 3D battle mode points (battle-overlay.ts). */
const BATTLE_DOT_RING = '#172c35';

function Dot({ color, ring = DOT_RING }: { color: string; ring?: string }) {
  return (
    <svg className="event-key-symbol" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="5.5" fill={color} stroke={ring} strokeOpacity="0.8" />
    </svg>
  );
}

/** The pictogram drawn over each event from zoom 3.5 (components/map/markers.ts). */
function Glyph({ type }: { type: EventType }) {
  const circle = EVENT_GLYPH_CIRCLES[type];
  return (
    <svg
      className="event-key-symbol"
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke={EVENT_GLYPH_PAINT.stroke}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="16" cy="16" r="15" fill={EVENT_GLYPH_PAINT.disc} stroke="none" />
      {EVENT_GLYPHS[type].map((d) => (
        <path key={d} d={d} />
      ))}
      {circle && <circle cx={circle[0]} cy={circle[1]} r={circle[2]} />}
    </svg>
  );
}

export default function EventKey({ panelId, onClose }: { panelId: string; onClose: () => void }) {
  const { t, locale } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section
      id={panelId}
      className="resource-layer-card event-key-card"
      aria-labelledby={`${panelId}-heading`}
      data-testid="events-legend"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="resource-card-heading">
        <h2 id={`${panelId}-heading`} ref={heading} tabIndex={-1}>
          {t('Légende des événements', 'Event key')}
        </h2>
        <button
          type="button"
          className="icon-button"
          aria-label={t('Fermer', 'Close')}
          onClick={onClose}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="resource-card-body">
        <p className="resource-coverage">
          {t(
            'La forme indique la couche ; la couleur précise le type d’événement.',
            'Shape tells the layer; colour tells the type of event.',
          )}
        </p>
        <ul className="event-key-list">
          {EVENT_TYPES.map((type) => (
            <li key={type} data-event-type={type}>
              <Dot color={EVENT_TYPE_COLORS[type]} />
              <Glyph type={type} />
              <span>{EVENT_TYPE_LABELS[type][locale]}</span>
            </li>
          ))}
        </ul>
        <h3 className="resource-period-title">{t('Sur la carte', 'On the map')}</h3>
        <ul className="event-key-list">
          <li>
            <svg
              className="event-key-symbol event-key-group"
              viewBox="0 0 32 32"
              aria-hidden="true"
              focusable="false"
            >
              <circle
                cx="16"
                cy="16"
                r="14"
                fill={EVENT_GROUP_COLORS.fill}
                stroke={EVENT_GROUP_COLORS.ring}
                strokeWidth="1.6"
              />
              <text x="16" y="20" textAnchor="middle" fill="#f6ecd5" fontSize="11">
                12
              </text>
            </svg>
            <span>
              {t(
                'Groupe d’événements proches et leur nombre',
                'Group of nearby events and their count',
              )}
            </span>
          </li>
          <li>
            <svg
              className="event-key-symbol"
              viewBox="0 0 32 32"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="16" cy="16" r="5" fill={EVENT_TYPE_COLORS.battle} />
              <circle
                cx="16"
                cy="16"
                r="12"
                fill="none"
                stroke={SELECTION_COLORS.event}
                strokeWidth="2"
              />
            </svg>
            <span>
              {t(
                'Événement sélectionné : l’ambre signale la sélection',
                'Selected event: amber marks the selection',
              )}
            </span>
          </li>
        </ul>
        <h3 className="resource-period-title">{t('Batailles en 3D', 'Battles in 3D')}</h3>
        <ul className="event-key-list">
          <li>
            <Dot color={BATTLE_MODE_COLORS.documented} ring={BATTLE_DOT_RING} />
            <span>{t('Effectifs sourcés', 'Sourced forces')}</span>
          </li>
          <li>
            <Dot color={BATTLE_MODE_COLORS.undocumented} ring={BATTLE_DOT_RING} />
            <span>
              {t('Effectifs inconnus, 3D illustrative', 'Forces unknown, illustrative 3D')}
            </span>
          </li>
        </ul>
      </div>
    </section>
  );
}
