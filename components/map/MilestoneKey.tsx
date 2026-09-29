import { Fragment, useId, useState, type ReactNode } from 'react';
import type { MilestoneEmblem } from './milestone-ids';
import type { Locale } from '@/lib/types';

// SVG twins of the map sprites in components/map/milestone-sprites.ts and the paint in
// milestone-overlay.ts: same ink, radii, stroke widths, dash ratios and emblem variants
// (plain, origin, divided, closing; a closed centre reads at 0.3 opacity), so the panel
// reads exactly like the map. Theme-dependent opacities live in the .religion-key-* CSS rules.
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

export type MilestoneKeyRow =
  'origin' | 'milestone' | 'schism' | 'contraction' | 'closed' | 'age' | 'dot' | 'area' | 'route';

export interface MilestoneKeyTheme {
  color: string;
  symbol: string;
}

function Medallion({
  symbol,
  symbols,
  fallback,
  ink,
  emblem = 'plain',
}: {
  symbol: string;
  symbols: Record<string, readonly string[]>;
  fallback: string;
  ink: string;
  emblem?: MilestoneEmblem;
}) {
  return (
    <g fill="none" stroke="currentColor">
      <circle cx={CENTRE} cy={CENTRE} r={17} fill={ink} fillOpacity={0.9} stroke="none" />
      <circle
        cx={CENTRE}
        cy={CENTRE}
        r={17}
        fill="currentColor"
        fillOpacity={0.16}
        strokeWidth={emblem === 'origin' ? 2.6 : 1.6}
        strokeDasharray={emblem === 'divided' ? '3.2 2.4' : undefined}
      />
      {emblem === 'origin' && (
        <>
          <circle cx={CENTRE} cy={CENTRE} r={20.2} stroke={ink} strokeWidth={3.5} />
          <circle cx={CENTRE} cy={CENTRE} r={20.2} strokeWidth={1.3} />
        </>
      )}
      <g
        transform={`translate(${CENTRE - 11} ${CENTRE - 11}) scale(${22 / 32})`}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {(symbols[symbol] ?? symbols[fallback]!).map((d, index) => (
          <path key={index} d={d} />
        ))}
      </g>
      {emblem === 'closing' && (
        <>
          <line
            x1={CENTRE - 12}
            y1={CENTRE + 12}
            x2={CENTRE + 12}
            y2={CENTRE - 12}
            stroke={ink}
            strokeWidth={3.6}
            strokeLinecap="round"
          />
          <line
            x1={CENTRE - 12}
            y1={CENTRE + 12}
            x2={CENTRE + 12}
            y2={CENTRE - 12}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </>
      )}
    </g>
  );
}

/** A theme's emblem inside the same medallion as its milestones on the map. */
export function ThemeIcon({
  theme,
  symbols,
  fallback,
  ink,
}: {
  theme: MilestoneKeyTheme;
  symbols: Record<string, readonly string[]>;
  fallback: string;
  ink: string;
}) {
  return (
    <svg
      className="religion-icon"
      viewBox="3.5 3.5 37 37"
      aria-hidden="true"
      focusable="false"
      style={{ color: theme.color }}
    >
      <Medallion symbol={theme.symbol} symbols={symbols} fallback={fallback} ink={ink} />
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
 * Map key for a milestone layer's symbols, drawn in one theme's colour and emblem: the
 * filtered one, otherwise the first of the catalogue. `index` is its position in the
 * catalogue, which sets the hatch direction as on the map.
 */
export default function MilestoneKey({
  // The locale is bound inside `text`; callers pass it for symmetry with the panel props.
  theme,
  index,
  symbols,
  fallback,
  ink,
  text,
  rows,
}: {
  locale: Locale;
  theme: MilestoneKeyTheme;
  index: number;
  symbols: Record<string, readonly string[]>;
  fallback: string;
  ink: string;
  text: (key: string) => string;
  rows: readonly MilestoneKeyRow[];
}) {
  const t = text;
  const hatch = `milestone-hatch-${useId().replace(/[^\w-]/g, '')}`;
  // Open on desktop; folded on phones, where the card is short and the filter comes first.
  const [open] = useState(
    () => typeof window === 'undefined' || !window.matchMedia('(max-width: 580px)').matches,
  );
  const { color, symbol } = theme;
  const emblem = (variant: MilestoneEmblem) => (
    <li>
      <Swatch color={color}>
        <g transform={SYMBOL_BOX}>
          <Medallion
            symbol={symbol}
            symbols={symbols}
            fallback={fallback}
            ink={ink}
            emblem={variant}
          />
        </g>
      </Swatch>
      <span>
        {t(
          variant === 'origin'
            ? 'legendOrigin'
            : variant === 'divided'
              ? 'legendSchism'
              : 'legendContraction',
        )}
      </span>
    </li>
  );
  const content: Record<MilestoneKeyRow, ReactNode> = {
    origin: emblem('origin'),
    milestone: (
      <li>
        <Swatch color={color}>
          <g transform={SYMBOL_BOX}>
            <Medallion symbol={symbol} symbols={symbols} fallback={fallback} ink={ink} />
          </g>
        </Swatch>
        <span>{t('legendMilestone')}</span>
      </li>
    ),
    schism: emblem('divided'),
    contraction: emblem('closing'),
    closed: (
      <li>
        <Swatch color={color}>
          {/* Same opacity as a centre a later contraction closed. */}
          <g transform={SYMBOL_BOX} opacity={0.3}>
            <Medallion symbol={symbol} symbols={symbols} fallback={fallback} ink={ink} />
          </g>
        </Swatch>
        <span>{t('legendClosed')}</span>
      </li>
    ),
    age: (
      <li>
        <Swatch color={color}>
          {/* Same opacity as a milestone attested 1,500 years or more before the date. */}
          <g transform={SYMBOL_BOX} opacity={0.45}>
            <Medallion symbol={symbol} symbols={symbols} fallback={fallback} ink={ink} />
          </g>
        </Swatch>
        <span>{t('legendAge')}</span>
      </li>
    ),
    dot: (
      <li>
        <Swatch color={color}>
          <g transform={SYMBOL_BOX}>
            <circle
              cx={CENTRE}
              cy={CENTRE}
              r={7}
              fill="currentColor"
              stroke={ink}
              strokeWidth={2.2}
            />
          </g>
        </Swatch>
        <span>{t('legendDot')}</span>
      </li>
    ),
    area: (
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
    ),
    route: (
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
            stroke={ink}
            strokeWidth={2.5}
            strokeLinejoin="round"
            paintOrder="stroke"
          />
        </Swatch>
        <span>{t('legendRoute')}</span>
      </li>
    ),
  };
  return (
    <details className="religion-key-details" open={open}>
      <summary>
        <h3>{t('legend')}</h3>
      </summary>
      <ul className="religion-key">
        {rows.map((row) => (
          <Fragment key={row}>{content[row]}</Fragment>
        ))}
      </ul>
    </details>
  );
}
