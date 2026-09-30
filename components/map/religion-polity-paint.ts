import type { ExpressionSpecification } from 'maplibre-gl';
import type { ReligionPolityDataset } from '@/lib/religions/polities';
import { religionPolitiesAt } from '@/lib/religions/polities';

export const RELIGION_NEUTRAL = '#879196';
export const EVIDENCE_OPACITY = {
  dark: { majority: 0.78, predominant: 0.6, state: 0.42, none: 0.12 },
  light: { majority: 0.7, predominant: 0.52, state: 0.36, none: 0.18 },
} as const;

/** Per-entity fill colour/opacity expressions and the state-only entity list at `horizon`. */
export function religionPolityPaint(
  dataset: ReligionPolityDataset | null,
  horizon: number,
  family: string | null,
  theme: 'dark' | 'light',
): {
  fillColor: ExpressionSpecification | string;
  fillOpacity: ExpressionSpecification | number;
  stateIds: string[];
} {
  const opacity = EVIDENCE_OPACITY[theme];
  if (!dataset) {
    return { fillColor: RELIGION_NEUTRAL, fillOpacity: opacity.none, stateIds: [] };
  }
  const attributed = religionPolitiesAt(dataset, horizon, family);
  if (!attributed.size) {
    return { fillColor: RELIGION_NEUTRAL, fillOpacity: opacity.none, stateIds: [] };
  }
  const byColour = new Map<string, string[]>();
  const byEvidence: Record<'majority' | 'predominant' | 'state', string[]> = {
    majority: [],
    predominant: [],
    state: [],
  };
  const stateIds: string[] = [];
  const families = new Map(dataset.families.map((item) => [item.id, item]));
  for (const [entityId, span] of attributed) {
    const colour = families.get(span.familyId)?.color ?? RELIGION_NEUTRAL;
    const ids = byColour.get(colour) ?? [];
    ids.push(entityId);
    byColour.set(colour, ids);
    byEvidence[span.evidence].push(entityId);
    if (span.evidence === 'state') stateIds.push(entityId);
  }
  const fillColor: unknown[] = ['match', ['get', 'entityId']];
  for (const [colour, ids] of byColour) fillColor.push(ids, colour);
  fillColor.push(RELIGION_NEUTRAL);
  const fillOpacity: unknown[] = ['match', ['get', 'entityId']];
  for (const evidence of ['majority', 'predominant', 'state'] as const) {
    if (byEvidence[evidence].length) fillOpacity.push(byEvidence[evidence], opacity[evidence]);
  }
  fillOpacity.push(opacity.none);
  return {
    fillColor: fillColor as ExpressionSpecification,
    fillOpacity: fillOpacity as ExpressionSpecification,
    stateIds,
  };
}
