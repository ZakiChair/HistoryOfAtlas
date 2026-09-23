import type {
  ResourceCategory,
  ResourceKnowledge,
  ResourcePeriod,
  ResourceSite,
} from '../../lib/resources/types';

export interface MineralRow {
  id: string;
  name: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  commodities: string[];
}

export interface GemRow {
  id: string;
  name: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: string;
  url: string;
  status: string;
  discoveryYear?: string | number | null;
  startYear?: string | number | null;
  endYear?: string | number | null;
  production?: {
    category: 'oil' | 'gas' | 'coal';
    year: string | number | null;
    value: string | number | null;
  }[];
}

/** GEM's published unit designation, not company-name keywords or production evidence. */
function namedGemFuels(name: string): ResourceCategory[] {
  const designation = name
    .replace(/\s*\([^()]*\)\s*$/, '')
    .match(
      /\b(Oil and Gas|Gas and Oil|Gas and Condensate|Oil|Gas)\s+(?:Field|Asset|Pool|Phase)\s*$/i,
    );
  if (!designation) return [];
  const fuel = designation[1].toLowerCase();
  // Condensate is not silently relabelled as crude oil.
  return [
    ...(fuel.includes('oil') ? (['oil'] as const) : []),
    ...(fuel.includes('gas') ? (['gas'] as const) : []),
  ];
}

const GEM_YEAR = 2026;

function coordinates(row: {
  latitude: number | null;
  longitude: number | null;
}): [number, number] | undefined {
  const { latitude, longitude } = row;
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    (latitude === 0 && longitude === 0)
  )
    return;
  return [longitude, latitude];
}

function pastYear(value: string | number | null | undefined): number | undefined {
  if (!/^\d{4}(?:\.0)?$/.test(String(value))) return;
  const year = Number(value);
  if (year < 1000 || year > GEM_YEAR) return;
  return year;
}

/** The USGS archive has occurrence coordinates but no exploitation chronology. */
export function normalizeMineralSites(rows: MineralRow[]): ResourceSite[] {
  void rows;
  return [];
}

function periodsFor(row: GemRow, tracker: 'goget' | 'gcmt', sourceUrl: string): ResourcePeriod[] {
  const accepted =
    tracker === 'goget'
      ? ['operating', 'mothballed', 'abandoned', 'decommissioning', 'closed']
      : ['operating', 'mothballed', 'closed'];
  if (!accepted.includes(row.status)) return [];
  const periods: ResourcePeriod[] = [];
  const opening = pastYear(row.startYear);
  const closure = pastYear(row.endYear);
  const futureOpening =
    /^\d{4}(?:\.0)?$/.test(String(row.startYear)) && Number(row.startYear) > GEM_YEAR;
  const observations = new Map<ResourceCategory, Map<number, number>>();
  for (const record of row.production ?? []) {
    const year = pastYear(record.year);
    const amount =
      typeof record.value === 'number'
        ? record.value
        : typeof record.value === 'string' && /^\d+(?:\.\d+)?$/.test(record.value.trim())
          ? Number(record.value)
          : NaN;
    if (year === undefined || !Number.isFinite(amount) || amount < 0) continue;
    if (tracker === 'gcmt' ? record.category !== 'coal' : record.category === 'coal') continue;
    const years = observations.get(record.category) ?? new Map<number, number>();
    years.set(year, Math.max(years.get(year) ?? 0, amount));
    observations.set(record.category, years);
  }
  const categories: ResourceCategory[] =
    tracker === 'gcmt'
      ? ['coal']
      : [...observations]
          .filter(([, years]) => [...years.values()].some((amount) => amount > 0))
          .map(([category]) => category);
  const release = tracker === 'goget' ? 'March 2026 GOGET' : 'August 2026 GCMT';
  for (const category of categories) {
    const years = observations.get(category) ?? new Map<number, number>();
    const positive = [...years]
      .filter(([, amount]) => amount > 0)
      .map(([year]) => year)
      .sort((a, b) => a - b);
    const first = positive[0];
    const last = positive.at(-1);
    // GOGET publishes the field's start, not separate oil/gas starts. Mixed
    // fields therefore keep each fuel's first attestation as its own bound.
    const canUseOpening = tracker === 'gcmt' || categories.length === 1;
    const fromYear =
      canUseOpening && opening !== undefined ? Math.min(opening, first ?? opening) : first;
    const toYear = row.status === 'operating' ? GEM_YEAR : (closure ?? last);
    // Contradictory past closure/current operation does not justify bridging
    // an unknown shutdown; retain direct observations in that case.
    const conflictingClosure =
      row.status === 'operating' && closure !== undefined && closure < GEM_YEAR;
    if (!futureOpening && !conflictingClosure && toYear !== undefined) {
      const start =
        fromYear ?? (row.status === 'operating' && tracker === 'gcmt' ? GEM_YEAR : undefined);
      if (start !== undefined && start <= toYear) {
        const openingUsed = canUseOpening && opening !== undefined && start === opening;
        const startEvidence = openingUsed
          ? `Published ${tracker === 'gcmt' ? 'mine opening' : 'field production-start'} year ${opening}`
          : first !== undefined
            ? `First positive ${category} production observation retained in this extract (${first}); the true start may be earlier`
            : `Operating coal mine in the ${release} status snapshot; no earlier start is inferred`;
        const endEvidence =
          row.status === 'operating'
            ? `The ${release} release attests operating status; 2026 is the evidence endpoint, not a closure or future projection`
            : closure !== undefined
              ? `Published cessation year ${closure}`
              : `The last positive observation (${last}) bounds this inactive asset; it is not extended to the release year`;
        const description = `${startEvidence}. ${endEvidence}. Approximate operating-life evidence does not establish uninterrupted annual extraction. Explicit zero-production years for this fuel are excluded; mixed fields do not inherit another fuel's start.`;
        let runStart = start;
        const zeroYears = [...years]
          .filter(([year, amount]) => amount === 0 && year >= start && year <= toYear)
          .map(([year]) => year)
          .sort((a, b) => a - b);
        for (const boundary of [...zeroYears, toYear + 1]) {
          if (runStart < boundary)
            periods.push({
              fromYear: runStart,
              toYear: boundary - 1,
              sourceUrl,
              categories: [category],
              approximate: true,
              description,
            });
          runStart = boundary + 1;
        }
      }
    }
    for (const year of positive) {
      if (
        periods.some(
          (period) =>
            period.categories?.includes(category) &&
            year >= period.fromYear &&
            year <= period.toYear,
        )
      )
        continue;
      periods.push({
        fromYear: year,
        toYear: year,
        sourceUrl,
        categories: [category],
        description: `Positive ${category} production reported for ${year} in the ${release} extract. This direct observation is retained independently of absent or conflicting lifetime dates.`,
      });
    }
  }
  return periods.sort((a, b) => a.fromYear - b.fromYear || a.toYear - b.toYear);
}

export function normalizeGemSites(rows: GemRow[], tracker: 'goget' | 'gcmt'): ResourceSite[] {
  const sites = new Map<string, ResourceSite>();
  for (const row of rows) {
    const position = coordinates(row);
    if (!position || row.accuracy.toLowerCase() === 'country-level only') continue;
    const sourceUrl = /^https?:\/\//.test(row.url)
      ? row.url
      : tracker === 'gcmt'
        ? 'https://globalenergymonitor.org/projects/global-coal-mine-tracker'
        : 'https://globalenergymonitor.org/projects/global-oil-gas-extraction-tracker';
    const periods = periodsFor(row, tracker, sourceUrl);
    const designated: ResourceCategory[] = tracker === 'gcmt' ? ['coal'] : namedGemFuels(row.name);
    const categories = [
      ...new Set([...designated, ...periods.flatMap((period) => period.categories ?? [])]),
    ];
    if (!categories.length) continue;
    // The pinned GEM record transposes Mad Dog's discovery year to 1989.
    // BOEM GC826 and Woodside's SEC-filed history independently give 1998.
    // Correct only that reviewed value; exploitation observations stay untouched.
    const madDogCorrection =
      tracker === 'goget' && row.id === 'L100000314393' && pastYear(row.discoveryYear) === 1989;
    const discovery =
      tracker === 'goget' ? (madDogCorrection ? 1998 : pastYear(row.discoveryYear)) : undefined;
    const knowledge: ResourceKnowledge[] = [];
    if (discovery !== undefined && designated.length) {
      knowledge.push({
        fromYear: discovery,
        kind: 'discovery',
        categories: designated,
        sourceUrl: madDogCorrection
          ? 'https://www.sec.gov/Archives/edgar/data/844551/000119312522100529/d559567d425.htm'
          : sourceUrl,
        ...(designated.length > 1 ? { approximate: true } : {}),
        description:
          (madDogCorrection
            ? 'The pinned GOGET value 1989 is corrected to 1998 using Woodside’s SEC-filed Mad Dog history (section 5.2.4), corroborated by BOEM field GC826. '
            : 'Published field discovery year in the March 2026 GOGET extract. ') +
          `Resource types come from GEM's explicit unit designation at the end of its published name, not from the operator's name or inferred output. ` +
          (designated.length > 1
            ? 'The date applies to the combined field; separate oil and gas discovery dates are not documented. '
            : '') +
          'Discovery does not establish commercial production or continuing reserves after closure.',
      });
    }
    const opening = pastYear(row.startYear);
    if (
      discovery === undefined &&
      opening !== undefined &&
      ['operating', 'mothballed', 'abandoned', 'decommissioning', 'closed'].includes(row.status) &&
      (tracker === 'gcmt' || designated.length === 1)
    ) {
      knowledge.push({
        fromYear: opening,
        kind: 'attestation',
        categories: designated,
        sourceUrl,
        approximate: true,
        description:
          'The published opening/production-start year establishes that this resource was already known. It is not a discovery date. Unknown closure dates do not justify inventing an exploitation interval; planned projects do not use this rule.',
      });
    }
    const undated = categories.filter(
      (category) => !knowledge.some((item) => item.categories.includes(category)),
    );
    if (undated.length) {
      knowledge.push({
        fromYear: GEM_YEAR,
        kind: 'attestation',
        categories: undated,
        sourceUrl,
        approximate: true,
        description:
          `Known ${tracker === 'gcmt' ? 'coal deposit associated with the mine or project in the August 2026 GCMT' : 'resource explicitly designated in the March 2026 GOGET'} inventory. ` +
          'No discovery year is available for these resource types; 2026 is the dated source attestation, not a discovery or production date. Earlier independently documented extraction remains separate evidence. Planned starts, cancellation and closure do not create or erase discovery evidence.',
      });
    }
    const existing = sites.get(row.id);
    if (existing) {
      const keys = new Set(existing.periods.map((period) => JSON.stringify(period)));
      existing.periods.push(...periods.filter((period) => !keys.has(JSON.stringify(period))));
      existing.periods.sort((a, b) => a.fromYear - b.fromYear || a.toYear - b.toYear);
      existing.categories = [...new Set([...existing.categories, ...categories])];
      const knowledgeKeys = new Set((existing.knowledge ?? []).map((item) => JSON.stringify(item)));
      existing.knowledge = [
        ...(existing.knowledge ?? []),
        ...knowledge.filter((item) => !knowledgeKeys.has(JSON.stringify(item))),
      ];
      continue;
    }
    sites.set(row.id, {
      id: `${tracker}:${row.id}`,
      name: row.name,
      coordinates: position,
      categories,
      country: row.country,
      sourceId: `gem-${tracker}`,
      sourceUrl,
      sourceYear: GEM_YEAR,
      accuracy:
        row.accuracy === 'exact' || row.accuracy === 'approximate' ? row.accuracy : 'unknown',
      periods,
      knowledge,
    });
  }
  return [...sites.values()];
}
