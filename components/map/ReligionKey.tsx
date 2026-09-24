import { useId, useState, type ReactNode } from 'react';
import { RELIGION_SYMBOLS } from '@/lib/religions/icons';
import { religionText, type ReligionCopyKey } from '@/lib/religions/i18n';
import type { ReligionTradition } from '@/lib/religions/types';
import type { Locale } from '@/lib/types';
import { RELIGION_INK as INK } from './religion-sprites';

// SVG twins of the map sprites in components/map/religion-sprites.ts and the paint in
// religion-overlay.ts: same ink, radii, stroke widths and dash ratios, so the panel reads
// exactly like the map. Theme-dependent opacities live in the .religion-key-* CSS rules.
/** Centre of the 44 px medallion sprite; dots share its scale on the map. */
const CENTRE = 22;
/** Key swatches are 30 × 24 px; point symbols are drawn at 24 px, about their world-view size. */
const SYMBOL_BOX = `translate(3 0) scale(${24 / 44})`;
const ZONE =
  'M5 12.5 C4.5 6.5 10 3.5 16 4 C22.5 4.5 26.5 7.5 26 13 C25.5 18.5 19.5 20.5 13.5 20 C8.5 19.5 5.5 17 5 12.5 Z';
/** A gentle arc whose midpoint (15, 12) and horizontal tangent carry the arrow. */
const ROUTE = 'M2 16 Q15 8 28 16';
/** Route, casing, outline and arrow at about zoom 2; dash arrays scale with width as on the map. */
const ROUTE_WIDTH = 1.8;
const OUTLINE_WIDTH = 1.6;

type Sample = Pick<ReligionTradition, 'color' | 'symbol'>;

function Medallion({ symbol, origin = false }: { symbol: string; origin?: boolean }) {
  return (
    <g fill="none" stroke="currentColor">
      <circle cx={CENTRE} cy={CENTRE} r={17} fill={INK} fillOpacity={0.9} stroke="none" />
      <circle
        cx={CENTRE}
        cy={CENTRE}
        r={17}
        fill="currentColor"
        fillOpacity={0.16}
        strokeWidth={origin ? 2.6 : 1.6}
      />
      {origin && (
        <>
          <circle cx={CENTRE} cy={CENTRE} r={20.2} stroke={INK} strokeWidth={3.5} />
          <circle cx={CENTRE} cy={CENTRE} r={20.2} strokeWidth={1.3} />
        </>
      )}
      <g
        transform={`translate(${CENTRE - 11} ${CENTRE - 11}) scale(${22 / 32})`}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {(RELIGION_SYMBOLS[symbol] ?? RELIGION_SYMBOLS.confucian).map((d, index) => (
          <path key={index} d={d} />
        ))}
      </g>
    </g>
  );
}

/** A tradition's emblem inside the same medallion as its milestones on the map. */
export function TraditionIcon({ tradition }: { tradition: Sample }) {
  return (
    <svg
      className="religion-icon"
      viewBox="3.5 3.5 37 37"
      aria-hidden="true"
      focusable="false"
      style={{ color: tradition.color }}
    >
      <Medallion symbol={tradition.symbol} />
    </svg>
  );
}

function Swatch({ color, children }: { color: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 30 24"
      width="30"
      height="24"
      aria-hidden="true"
      focusable="false"
      style={{ color }}
    >
      {children}
    </svg>
  );
}

/**
 * Map key for the religion symbols, drawn in one tradition's colour and emblem: the filtered
 * one, otherwise the first of the catalogue. `index` is its position in the catalogue, which
 * sets the hatch direction as on the map.
 */
export default function ReligionKey({
  locale,
  tradition,
  index,
}: {
  locale: Locale;
  tradition: Sample;
  index: number;
}) {
  const t = (key: ReligionCopyKey) => religionText(locale, key);
  const hatch = `religion-hatch-${useId().replace(/[^\w-]/g, '')}`;
  // Open on desktop; folded on phones, where the card is short and the filter comes first.
  const [open] = useState(
    () => typeof window === 'undefined' || !window.matchMedia('(max-width: 580px)').matches,
  );
  const { color, symbol } = tradition;
  return (
    <details className="religion-key-details" open={open}>
      <summary>
        <h3>{t('legend')}</h3>
      </summary>
      <ul className="religion-key">
        <li>
          <Swatch color={color}>
            <g transform={SYMBOL_BOX}>
              <Medallion symbol={symbol} origin />
            </g>
          </Swatch>
          <span>{t('legendOrigin')}</span>
        </li>
        <li>
          <Swatch color={color}>
            <g transform={SYMBOL_BOX}>
              <Medallion symbol={symbol} />
            </g>
          </Swatch>
          <span>{t('legendMilestone')}</span>
        </li>
        <li>
          <Swatch color={color}>
            <g transform={SYMBOL_BOX}>
              <circle
                cx={CENTRE}
                cy={CENTRE}
                r={7}
                fill="currentColor"
                stroke={INK}
                strokeWidth={2.2}
              />
            </g>
          </Swatch>
          <span>{t('legendDot')}</span>
        </li>
        <li>
          <Swatch color={color}>
            <defs>
              <pattern id={hatch} width="10" height="10" patternUnits="userSpaceOnUse">
                <path
                  d={
                    index % 2
                      ? 'M-10 0 L0 10 M0 0 L10 10 M10 0 L20 10'
                      : 'M-10 10 L0 0 M0 10 L10 0 M10 10 L20 0'
                  }
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.4}
                  strokeLinecap="square"
                />
              </pattern>
            </defs>
            <path d={ZONE} className="religion-key-hatch" fill={`url(#${hatch})`} />
            <path
              d={ZONE}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.9}
              strokeWidth={OUTLINE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${0.2 * OUTLINE_WIDTH} ${2.2 * OUTLINE_WIDTH}`}
            />
          </Swatch>
          <span>{t('legendArea')}</span>
        </li>
        <li>
          <Swatch color={color}>
            <path
              d={ROUTE}
              className="religion-key-casing"
              fill="none"
              strokeWidth={ROUTE_WIDTH + 1.2}
              strokeLinecap="round"
            />
            <path
              d={ROUTE}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.95}
              strokeWidth={ROUTE_WIDTH}
              strokeLinecap="round"
              strokeDasharray={`${2.5 * ROUTE_WIDTH} ${1.5 * ROUTE_WIDTH}`}
            />
            <path
              d="M5 5 L21 12 L5 19 L9 12 Z"
              transform="translate(15 12) scale(0.75) translate(-12 -12)"
              fill="currentColor"
              stroke={INK}
              strokeWidth={2.5}
              strokeLinejoin="round"
              paintOrder="stroke"
            />
          </Swatch>
          <span>{t('legendRoute')}</span>
        </li>
      </ul>
    </details>
  );
}
