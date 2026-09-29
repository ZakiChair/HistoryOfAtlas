import { RELIGION_SYMBOLS } from '@/lib/religions/icons';
import { religionText } from '@/lib/religions/i18n';
import type { ReligionTradition } from '@/lib/religions/types';
import type { Locale } from '@/lib/types';
import MilestoneKey, { ThemeIcon, type MilestoneKeyRow } from './MilestoneKey';
import { RELIGION_INK } from './religion-sprites';

const ROWS: readonly MilestoneKeyRow[] = [
  'origin',
  'milestone',
  'schism',
  'contraction',
  'closed',
  'age',
  'dot',
  'area',
  'route',
];

type Sample = Pick<ReligionTradition, 'color' | 'symbol'>;

/** A tradition's emblem inside the same medallion as its milestones on the map. */
export function TraditionIcon({ tradition }: { tradition: Sample }) {
  return (
    <ThemeIcon
      theme={tradition}
      symbols={RELIGION_SYMBOLS}
      fallback="confucian"
      ink={RELIGION_INK}
    />
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
  return (
    <MilestoneKey
      locale={locale}
      theme={tradition}
      index={index}
      symbols={RELIGION_SYMBOLS}
      fallback="confucian"
      ink={RELIGION_INK}
      text={(key) => religionText(locale, key as Parameters<typeof religionText>[1])}
      rows={ROWS}
    />
  );
}
