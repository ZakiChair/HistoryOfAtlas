import {
  compareHistDates,
  histDateBounds,
  parseWikidataTime,
  type HistDate,
} from '../../lib/histdate';
import type { HistoricalEvent } from '../../lib/schema';
import { entityIds, sourceExclusion, values, type Entity } from '../normalize';
import excludedGroups from '../../data/curated/excluded-war-groups.json';

type Bounds = { earliest: HistDate; latest: HistDate };
type Window = { start: Bounds; end?: Bounds };
type Relation = {
  child: string;
  parent: string;
  property: 'P361' | 'P527';
  declaration: string;
  source: string;
};
export type RelationRejection = Relation & { reason: string; eventId?: string; path?: string[] };
export type WarGroups = {
  wars: Map<string, HistoricalEvent[]>;
  directParents: Map<string, string[]>;
  rejected: RelationRejection[];
};

/** Retain source precision. Coarse dates use a conservative surrounding interval. */
function sourceWindow(entity: Entity | undefined): Window | undefined {
  if (!entity) return undefined;
  const dates = (property: string): Bounds[] =>
    values(entity, property).flatMap((value) => {
      if (typeof value !== 'object' || !value.time) return [];
      try {
        const parsed = parseWikidataTime(value.time, {
          precision: value.precision,
          calendar: value.calendarmodel,
          encoding: 'json',
        });
        const bounds = histDateBounds(parsed.date, parsed.calendar);
        const tolerance =
          parsed.datePrecision === 'century' ? 99 : parsed.datePrecision === 'decade' ? 9 : 0;
        bounds.earliest.year -= tolerance;
        bounds.latest.year += tolerance;
        return [bounds];
      } catch {
        return [];
      }
    });
  const combine = (records: Bounds[]): Bounds | undefined =>
    records.length
      ? {
          earliest: records.map((record) => record.earliest).sort(compareHistDates)[0]!,
          latest: records
            .map((record) => record.latest)
            .sort(compareHistDates)
            .at(-1)!,
        }
      : undefined;
  const beginnings = dates('P580');
  const points = beginnings.length ? [] : dates('P585');
  const start = combine(beginnings.length ? beginnings : points);
  if (!start) return undefined;
  return { start, end: combine(dates('P582')) ?? (points.length ? combine(points) : undefined) };
}

function incompatibility(
  child: Window | undefined,
  parent: Window | undefined,
): string | undefined {
  if (!parent) return 'parent-without-source-date';
  if (!child) return 'child-without-source-date';
  if (compareHistDates(child.start.latest, parent.start.earliest) < 0)
    return 'child-starts-before-parent';
  if (parent.end && compareHistDates(child.start.earliest, parent.end.latest) > 0)
    return 'child-starts-after-parent';
  if (parent.end && child.end && compareHistDates(child.end.earliest, parent.end.latest) > 0)
    return 'child-ends-after-parent';
  return undefined;
}

/** Explicit P361/P527 membership is evidence to validate, not an unconditional ancestry graph. */
export function buildWarGroups(
  events: HistoricalEvent[],
  entities: Map<string, Entity>,
  militaryClasses: Set<string>,
  invalidEntityIds: Set<string> = new Set(),
): WarGroups {
  const isMilitary = (id: string) => {
    const entity = entities.get(id);
    return (
      entity &&
      !sourceExclusion(entity) &&
      entityIds(entity, 'P31').some((classId) => militaryClasses.has(classId))
    );
  };
  const windows = new Map<string, Window | undefined>();
  const window = (id: string) => {
    if (!windows.has(id)) windows.set(id, sourceWindow(entities.get(id)));
    return windows.get(id);
  };
  const rejected: RelationRejection[] = [];
  const edges = new Map<string, Relation[]>();
  const seen = new Set<string>();
  const connect = (
    child: string,
    parent: string,
    property: Relation['property'],
    declaration: string,
  ) => {
    if (!isMilitary(child)) return;
    const key = `${child}/${parent}/${property}/${declaration}`;
    if (seen.has(key)) return;
    seen.add(key);
    const relation: Relation = {
      child,
      parent,
      property,
      declaration,
      source: `https://www.wikidata.org/wiki/${declaration}${entities.get(declaration)?.lastrevid ? `?oldid=${entities.get(declaration)!.lastrevid}` : ''}`,
    };
    const reason = invalidEntityIds.has(parent)
      ? 'invalid-parent-record'
      : invalidEntityIds.has(child)
        ? 'invalid-child-record'
        : !isMilitary(parent)
          ? 'parent-outside-requested-military-classes'
          : (excludedGroups.records.find((record) => record.id === parent)?.reason ??
            incompatibility(window(child), window(parent)));
    if (reason) {
      rejected.push({ ...relation, reason });
      return;
    }
    const parents = edges.get(child) ?? [];
    parents.push(relation);
    edges.set(child, parents);
  };
  for (const entity of entities.values()) {
    if (!isMilitary(entity.id)) continue;
    for (const parent of entityIds(entity, 'P361')) connect(entity.id, parent, 'P361', entity.id);
    for (const child of entityIds(entity, 'P527')) connect(child, entity.id, 'P527', entity.id);
  }
  // Tarjan components identify actual directed cycles, including equal-date groups.
  const indices = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const active = new Set<string>();
  const component = new Map<string, number>();
  let index = 0;
  let componentId = 0;
  const visit = (id: string) => {
    indices.set(id, index);
    low.set(id, index++);
    stack.push(id);
    active.add(id);
    for (const edge of edges.get(id) ?? []) {
      if (!indices.has(edge.parent)) {
        visit(edge.parent);
        low.set(id, Math.min(low.get(id)!, low.get(edge.parent)!));
      } else if (active.has(edge.parent))
        low.set(id, Math.min(low.get(id)!, indices.get(edge.parent)!));
    }
    if (low.get(id) === indices.get(id)) {
      let member: string;
      do {
        member = stack.pop()!;
        active.delete(member);
        component.set(member, componentId);
      } while (member !== id);
      componentId++;
    }
  };
  for (const id of edges.keys()) if (!indices.has(id)) visit(id);
  for (const [id, parents] of edges)
    edges.set(
      id,
      parents.filter((edge) => {
        if (component.get(id) !== component.get(edge.parent)) return true;
        rejected.push({ ...edge, reason: 'cyclic-military-relation' });
        return false;
      }),
    );
  const wars = new Map<string, HistoricalEvent[]>();
  const directParents = new Map<string, string[]>();
  for (const event of events) {
    const direct = [...new Set((edges.get(event.id) ?? []).map((edge) => edge.parent))];
    directParents.set(event.id, direct);
    if (!event.coords) continue;
    const visited = new Set([event.id]);
    const queue = (edges.get(event.id) ?? []).map((edge) => ({
      edge,
      path: [event.id, edge.parent],
    }));
    while (queue.length) {
      const { edge, path } = queue.pop()!;
      const parent = edge.parent;
      if (visited.has(parent)) continue;
      visited.add(parent);
      const reason = incompatibility(window(event.id), window(parent));
      if (reason) {
        rejected.push({ ...edge, eventId: event.id, path, reason });
        continue;
      }
      const members = wars.get(parent) ?? [];
      members.push(event);
      wars.set(parent, members);
      queue.push(
        ...(edges.get(parent) ?? []).map((ancestor) => ({
          edge: ancestor,
          path: [...path, ancestor.parent],
        })),
      );
    }
  }
  return {
    wars,
    directParents,
    rejected: rejected.sort((a, b) =>
      `${a.child}/${a.parent}/${a.eventId ?? ''}/${a.property}`.localeCompare(
        `${b.child}/${b.parent}/${b.eventId ?? ''}/${b.property}`,
      ),
    ),
  };
}
