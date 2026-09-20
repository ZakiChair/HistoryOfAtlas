export type ImportanceInputs = {
  sitelinks: number;
  curated: boolean;
  parentSize: number;
  strength?: number;
};

/** Display priority, deliberately bounded; this is not a measure of suffering. */
export function scoreImportance({
  sitelinks,
  curated,
  parentSize,
  strength = 0,
}: ImportanceInputs): number {
  const coverage = Math.min(55, Math.log2(Math.max(0, sitelinks) + 1) * 8);
  const context = Math.min(15, Math.log2(Math.max(0, parentSize) + 1) * 2.5);
  const documentedScale = Math.min(10, Math.log10(Math.max(0, strength) + 1) * 1.5);
  return Math.min(
    100,
    Math.max(0, Math.round(10 + coverage + context + documentedScale + (curated ? 15 : 0))),
  );
}
