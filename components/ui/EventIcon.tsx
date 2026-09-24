import { Swords, Castle, Anchor, ScrollText, Flag, Route, Crosshair } from 'lucide-react';
import { EVENT_TYPE_COLORS } from '@/lib/colors/semantic';
import type { EventType } from '@/lib/types';
const icons = {
  battle: Swords,
  siege: Castle,
  naval: Anchor,
  treaty: ScrollText,
  war: Flag,
  campaign: Route,
  conquest: Crosshair,
};
export function EventIcon({ type, size = 17 }: { type: string; size?: number }) {
  const Icon = icons[type as keyof typeof icons] ?? Swords;
  return <Icon size={size} strokeWidth={1.5} aria-hidden="true" />;
}

/** The type's dot as drawn on the map; decorative, the adjacent label names the type. */
export function EventSwatch({ type }: { type: string }) {
  return (
    <span
      className="event-swatch"
      style={{ background: EVENT_TYPE_COLORS[type as EventType] ?? EVENT_TYPE_COLORS.battle }}
      aria-hidden="true"
    />
  );
}
