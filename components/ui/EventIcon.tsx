import { Swords, Castle, Anchor, ScrollText, Flag, Route, Crosshair } from 'lucide-react';
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
