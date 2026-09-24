import type { Metadata } from 'next';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Link from 'next/link';
import LocaleLink from '@/components/ui/LocaleLink';
import { ERAS } from '@/lib/eras';
import { datasetJsonLd, jsonLdGraph, licenseDatasetParts, serializeJsonLd } from '@/lib/jsonld';
import type { LicenseManifest } from '@/lib/licenses';
import { REPOSITORY_URL, siteOrigin } from '@/lib/seo';

export const dynamic = 'force-static';
export const metadata: Metadata = {
  title: 'Sources & methodology — HistoryOfAtlas',
  description:
    'How HistoryOfAtlas documents events, boundaries, ancient dates and uncertainty. Open sources, licences and coverage reports.',
  alternates: { canonical: '/about/' },
};

type Quality = {
  geolocatedDatedEvents: number;
  withProvenance: number;
  acceptance: { target: number; met: boolean };
  coverage: { byRegion: Record<string, number>; byEra: Record<string, number> };
  rejectionCounts: Record<string, number>;
  builtAt: string;
};
type GeoManifest = {
  snapshots: unknown[];
  temporal: { records: number; entities: number; range: number[] };
  sources: {
    label: string;
    url: string;
    licence: string;
    licenceUrl: string;
    citation?: string;
    correspondingSource?: string;
  }[];
};

type EventManifest = {
  builtAt: string;
  chunks: { path: string; start: number; end: number; count: number }[];
};
type CoverageMatrix = {
  cells: Record<string, Record<string, number>>;
  regions: Record<string, number>;
  eras: Record<string, number>;
  total: number;
  range: [number, number];
};

const DATA = path.join(process.cwd(), 'public');
async function readJson<T>(relative: string): Promise<T> {
  return JSON.parse(await readFile(path.join(DATA, relative), 'utf8')) as T;
}

/** Region × era counts over the same accepted events as the quality report. */
async function readCoverage(): Promise<CoverageMatrix> {
  const manifest = await readJson<EventManifest>('data/manifest.json');
  const chunks = await Promise.all(
    manifest.chunks.map((chunk) =>
      readJson<{ region: string; era: string }[]>(chunk.path.replace(/^\//, '')),
    ),
  );
  const matrix: CoverageMatrix = {
    cells: {},
    regions: {},
    eras: {},
    total: 0,
    range: [
      Math.min(...manifest.chunks.map((chunk) => chunk.start)),
      Math.max(...manifest.chunks.map((chunk) => chunk.end)),
    ],
  };
  for (const event of chunks.flat()) {
    const row = (matrix.cells[event.region] ??= {});
    row[event.era] = (row[event.era] ?? 0) + 1;
    matrix.regions[event.region] = (matrix.regions[event.region] ?? 0) + 1;
    matrix.eras[event.era] = (matrix.eras[event.era] ?? 0) + 1;
    matrix.total += 1;
  }
  return matrix;
}

/** A blank correction form for readers who arrive from this page rather than a record. */
function correctionFormUrl(): string {
  const body = [
    '**Record name and identifier (QID, resource sourceId or territory):**',
    '',
    '**Displayed year:**',
    '',
    '**Link to the page or shared view:**',
    '',
    '**What is wrong?**',
    '',
    '**Verifiable reference (link, publication, page):**',
    '',
  ].join('\n');
  return `${REPOSITORY_URL}/issues/new?${new URLSearchParams({ title: 'Correction: ', body })}`;
}

export default async function AboutPage() {
  const [quality, geography, battles, licenses, religions, coverage] = await Promise.all([
    readFile(path.join(process.cwd(), 'public/data/quality.json'), 'utf8').then(
      (text) => JSON.parse(text) as Quality,
    ),
    readFile(path.join(process.cwd(), 'public/geo/manifest.json'), 'utf8').then(
      (text) => JSON.parse(text) as GeoManifest,
    ),
    readFile(path.join(process.cwd(), 'public/data/battles/index.json'), 'utf8').then(
      (text) =>
        (
          JSON.parse(text) as {
            counts: { total: number; mappable: number; documented: number; unmapped: number };
          }
        ).counts,
    ),
    readJson<LicenseManifest>('data/licenses.json'),
    readJson<{ traditions: unknown[]; milestones: unknown[] }>('data/religions/history.json'),
    readCoverage(),
  ]);
  const number = (value: number) => new Intl.NumberFormat('en').format(value);
  const origin = siteOrigin();
  const resourceSites = licenses.resources.licenses.reduce((sum, group) => sum + group.sites, 0);
  const citedMilestones = licenses.religions.references.reduce(
    (sum, reference) => sum + reference.milestones,
    0,
  );
  const jsonLd = jsonLdGraph(
    datasetJsonLd({
      origin,
      path: '/about/',
      name: 'HistoryOfAtlas — dated, geolocated historical events and boundaries',
      description: `${number(quality.geolocatedDatedEvents)} dated, geolocated battles, sieges, wars, treaties and conquests from Wikidata, with dated polity boundaries, sourced strategic resources and documented religious milestones. Each record keeps its own source and licence.`,
      dateModified: quality.builtAt,
      temporalCoverage: coverage.range,
      keywords: ['history', 'historical atlas', 'battles', 'wars', 'borders', 'Wikidata'],
      repository: REPOSITORY_URL,
      parts: [
        ...licenseDatasetParts(licenses.datasets, origin),
        {
          name: 'Strategic resources',
          description: `${number(resourceSites)} dated resource sites from ${licenses.resources.sources.length} sources, each under its own terms`,
          url: `${origin}/about/#sources`,
        },
        {
          name: 'Religions',
          description: `${religions.traditions.length} traditions and ${religions.milestones.length} dated milestones checked against ${licenses.religions.references.length} references`,
          url: `${origin}/about/#sources`,
          license: licenses.religions.corpus.licenseUrl,
        },
      ],
    }),
  );
  const regions: Record<string, string> = {
    europe: 'Europe',
    africa: 'Africa',
    asia: 'Asia',
    'middle-east': 'Middle East',
    'north-america': 'North America',
    'south-america': 'South America',
    oceania: 'Oceania',
    global: 'Global / unassigned',
  };
  return (
    <main className="document-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <header className="document-header">
        <LocaleLink className="back-link" href="/">
          ← Back to the atlas
        </LocaleLink>
        <span className="eyebrow">BEHIND THE MAPS</span>
        <h1>
          History deserves
          <br />
          sources.
        </h1>
        <p>
          An atlas for exploring territorial change and documented conflicts. A map remains an
          interpretation: its provenance and limits must stay visible.
        </p>
      </header>
      <article className="document-body" id="english">
        <div className="document-grid">
          <section className="document-card">
            <span className="eyebrow">01 / EVENTS</span>
            <h2>{number(quality.geolocatedDatedEvents)}</h2>
            <p>
              Dated, geolocated events in this release. {number(quality.withProvenance)} have
              explicit provenance.
            </p>
            <a className="source-link" href="/data/quality.json">
              Open the quality report ↗
            </a>
          </section>
          <section className="document-card">
            <span className="eyebrow">02 / TERRITORIES</span>
            <h2>{number(geography.temporal.records)}</h2>
            <p>
              Dated polity geometries for {number(geography.temporal.entities)} named entities in
              Cliopatria. {geography.snapshots.length} Historical Basemaps snapshots provide an
              additional reference source.
            </p>
            <a className="source-link" href="/geo/manifest.json">
              View the geography manifest ↗
            </a>
          </section>
        </div>
        {!quality.acceptance.met && (
          <p className="document-notice">
            This build does not meet the target of {number(quality.acceptance.target)} valid events.
            Missing or rejected records are never replaced with invented events.
          </p>
        )}
        <section>
          <span className="eyebrow">BATTLES IN 3D</span>
          <h2>Historical evidence, illustrative movement</h2>
          <p>
            The battle catalogue contains {number(battles.total)} sourced engagements, including
            battles, sieges and naval actions. {number(battles.mappable)} have a usable date and
            location; the remaining {number(battles.unmapped)} stay available as catalogue records.
            This measures the sources ingested, not every battle that has ever happened.
          </p>
          <p>
            Armies are anchored to the event’s recorded coordinates, or its associated place where
            explicitly indicated. Formations, movements and the timing of losses are illustrative.
            Authored 3D equipment models use dated museum references and reviewed participant
            profiles; they do not establish an exact uniform or an army’s composition.
          </p>
          <p>
            Where comparable per-army strengths exist, both sides share one disclosed
            people-per-model or ships-per-model scale, rounded to whole models. Unknown strengths
            use symbolic representatives. Source ranges stay visible; any display midpoint is
            identified. Losses use only reviewed quantities, with deaths treated as a subset of
            casualties. Captured or missing soldiers are identified in the source notes, and
            army-level counts are never inferred by splitting a battle total.
          </p>
          <p>
            {number(battles.documented)} engagements currently have reviewed per-army numbers for
            proportional scenes. The catalogue retains other quantitative source statements with
            their units, qualifiers and references, even when those statements cannot safely
            determine the size of an army.
          </p>
          <a className="source-link" href="/data/battles/coverage.json">
            Battle coverage and limitations ↗
          </a>
          <a className="source-link" href="/data/battles/candidates.json">
            Individual source-candidate audit ↗
          </a>
          <Link className="source-link" href="/?battle=1">
            Open 3D battles ↗
          </Link>
        </section>
        <section>
          <span className="eyebrow">03 / PROVENANCE</span>
          <h2>Open sources, distinct licences</h2>
          <div className="document-grid">
            <div className="document-card">
              <h3>Wikidata</h3>
              <p>
                Events, dates, locations, participants and conflict links come from Wikidata’s
                structured statements, released under CC0. QID identifiers link back to each record
                and its history.
              </p>
              <a className="source-link" href="https://www.wikidata.org/wiki/Wikidata:Licensing">
                Wikidata · CC0 licence ↗
              </a>
            </div>
            <div className="document-card">
              <h3>CDB90 · historical army estimates</h3>
              <p>
                Selected army strengths and casualties come from the CAA Database of Battles,
                Version 1990, maintained as tidy data by Jeffrey B. Arnold. Original US Army
                Concepts Analysis Agency data are public domain; the revised database is licensed
                ODC-BY. Imported records retain their original force designations and uncertainty
                margins. Personnel casualties do not establish a death toll.
              </p>
              <a className="source-link" href="https://github.com/jrnold/CDB90">
                CDB90 · source and attribution ↗
              </a>
              <a className="source-link" href="https://opendatacommons.org/licenses/by/1-0/">
                Open Data Commons Attribution licence ↗
              </a>
            </div>
            {geography.sources.map((source) => (
              <div className="document-card" key={source.label}>
                <h3>{source.label}</h3>
                <p>
                  {source.licence}. Repository revisions and SHA-256 checksums are pinned in the
                  pipeline. Data have been normalized, BCE years converted to astronomical numbering
                  and geometries simplified for tiles. Original sources remain accessible.
                </p>
                <a className="source-link" href={source.url}>
                  View the source ↗
                </a>
                <a className="source-link" href={source.licenceUrl}>
                  Read the licence ↗
                </a>
                {source.citation && (
                  <a className="source-link" href={source.citation}>
                    Research publication ↗
                  </a>
                )}
                {source.correspondingSource && (
                  <a className="source-link" href={source.correspondingSource}>
                    Download the corresponding source code and geometries ↓
                  </a>
                )}
              </div>
            ))}
            <div className="document-card">
              <h3>Locally hosted fonts</h3>
              <p>
                Cormorant is by the Cormorant Project Authors; Manrope is by the Manrope Project
                Authors. Both fonts are distributed with their SIL Open Font License 1.1 and
                copyright notices.
              </p>
              <a className="source-link" href="/fonts/cormorantgaramond-OFL.txt">
                Cormorant · copyright and licence ↗
              </a>
              <a className="source-link" href="/fonts/manrope-OFL.txt">
                Manrope · copyright and licence ↗
              </a>
            </div>
            <div className="document-card">
              <h3>Wikipedia & Wikimedia Commons</h3>
              <p>
                Summaries load when records are opened, in the selected language when available,
                with English as the fallback. Text is attributed to Wikipedia and distributed under
                the applicable CC BY-SA terms. Each image retains the licence specified on its
                Wikimedia Commons page.
              </p>
              <a
                className="source-link"
                href="https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use"
              >
                Wikimedia reuse terms ↗
              </a>
              <a className="source-link" href="https://creativecommons.org/licenses/by-sa/4.0/">
                CC BY-SA 4.0 ↗
              </a>
            </div>
          </div>
        </section>
        <section id="sources" aria-labelledby="sources-title">
          <span className="eyebrow">SOURCES & LICENCES</span>
          <h2 id="sources-title">Sources and licences</h2>
          <p>
            {licenses.notice} The complete list, with every licence and link, is published as a
            manifest regenerated from the data at each release.
          </p>
          <p>
            The application code is released under the {licenses.project.code.license} licence.
            Content written for the atlas (curated reviews and corrections, religion milestones,
            descriptions, generalized regions and diffusion links, map symbology) is released under{' '}
            {licenses.project.content.license}; credit it as “{licenses.project.content.attribution}
            ”. {licenses.project.note}
          </p>
          <a className="source-link" href="/data/licenses.json">
            Open the licence manifest ↗
          </a>
          <a className="source-link" href={licenses.project.code.text}>
            Code licence · {licenses.project.code.license} ↗
          </a>
          <a className="source-link" href={licenses.project.content.text}>
            Content licence · {licenses.project.content.license} ↗
          </a>
          <h3>Strategic resources</h3>
          <p>
            The resources layer places {number(resourceSites)} dated mines, oil and gas fields and
            deposits from {licenses.resources.sources.length} sources. A site appears from its
            documented discovery or earliest attestation; production periods stay separate. Each
            marker names its source and licence.
          </p>
          <div
            className="document-table"
            role="region"
            aria-labelledby="resource-licences-caption"
            tabIndex={0}
          >
            <table>
              <caption id="resource-licences-caption">Resource sites by source licence</caption>
              <thead>
                <tr>
                  <th scope="col">Licence or terms</th>
                  <th scope="col">Sources</th>
                  <th scope="col">Sites</th>
                </tr>
              </thead>
              <tbody>
                {licenses.resources.licenses.map((group) => (
                  <tr key={group.license}>
                    <th scope="row">
                      {group.licenseUrl ? (
                        <a href={group.licenseUrl}>{group.license}</a>
                      ) : (
                        group.license
                      )}
                    </th>
                    <td>{number(group.sources)}</td>
                    <td>{number(group.sites)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="document-details">
            <summary>All {licenses.resources.sources.length} resource sources</summary>
            <ul>
              {licenses.resources.sources.map((source) => (
                <li key={source.id}>
                  <a href={source.url}>{source.name}</a> · {source.license} · {number(source.sites)}{' '}
                  site{source.sites === 1 ? '' : 's'}
                </li>
              ))}
            </ul>
          </details>
          <h3>Religions</h3>
          <p>
            The religions layer follows {religions.traditions.length} traditions through{' '}
            {religions.milestones.length} dated milestones, hand-generalized regions and diffusion
            links written for the atlas. Each milestone cites at least one of{' '}
            {licenses.religions.references.length} references ({number(citedMilestones)} citations
            in total), listed for verification; their content is not redistributed. Regions are
            geographic guides, not exact borders.
          </p>
          <details className="document-details">
            <summary>All {licenses.religions.references.length} religion references</summary>
            <ul>
              {licenses.religions.references.map((reference) => (
                <li key={reference.id}>
                  <a href={reference.url}>{reference.title}</a> · {reference.milestones} milestone
                  {reference.milestones === 1 ? '' : 's'}
                </li>
              ))}
            </ul>
          </details>
        </section>
        <section>
          <span className="eyebrow">04 / TIME & BOUNDARIES</span>
          <h2>Precision is not certainty</h2>
          <p>
            Years are stored using astronomical numbering: 1 BCE is year 0, and 2 BCE is −1. The
            interface displays historical notation. Julian, Gregorian or unspecified calendars and
            date precision are preserved when available.
          </p>
          <p>
            Cliopatria describes polygons valid over inclusive intervals between 3400 BCE and 2024.
            Filtering these intervals changes the map. Ancient boundaries remain approximate; an
            absent polygon does not mean a place was uninhabited. After 2024, the last documented
            boundaries are retained and do not verify recent changes.
          </p>
          <p>
            Historical Basemaps snapshots range from 4000 BCE to 2010 and may be centuries apart.
            Any visual transition between snapshots aids reading; it does not create new historical
            boundaries. Natural Earth rivers and coastlines describe the contemporary physical
            world.
          </p>
          <p>
            Area charts measure the geometry of observations. A territory’s first and last
            observations are not treated as its founding or dissolution. Alliances grouped in
            Cliopatria are excluded from the main fill so they are not presented as unitary states.
          </p>
          <p>
            The map synchronizes events and territories by date. It does not automatically attribute
            a boundary change to a nearby or contemporary battle. Lines between related events
            indicate chronology, not a documented army route.
          </p>
        </section>
        <section>
          <span className="eyebrow">05 / COVERAGE</span>
          <h2>World history, uneven coverage</h2>
          <p>
            Open sources reflect geographic, linguistic and chronological imbalances. The number of
            visible points measures available documentation, not the amount of violence in a region
            or period.
          </p>
          <div
            className="document-table"
            role="region"
            aria-labelledby="coverage-caption"
            tabIndex={0}
          >
            <table>
              <caption id="coverage-caption">
                Events in this build by region and era ({number(coverage.total)} in total)
              </caption>
              <thead>
                <tr>
                  <th scope="col">Region</th>
                  {ERAS.map((era) => (
                    <th scope="col" key={era.id}>
                      {era.name.en}
                    </th>
                  ))}
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(coverage.regions)
                  .sort(([, a], [, b]) => b - a)
                  .map(([region, total]) => (
                    <tr key={region}>
                      <th scope="row">{regions[region] ?? region}</th>
                      {ERAS.map((era) => (
                        <td key={era.id}>{number(coverage.cells[region]?.[era.id] ?? 0)}</td>
                      ))}
                      <td>{number(total)}</td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">All regions</th>
                  {ERAS.map((era) => (
                    <td key={era.id}>{number(coverage.eras[era.id] ?? 0)}</td>
                  ))}
                  <td>{number(coverage.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p>
            Coordinates obtained from an associated place identify that place; they do not establish
            the exact battlefield location. The Natural Earth 1:10m validation mask is separate from
            the 1:50m physical basemap. A 25 km coastal tolerance accounts for generalized geometry
            and small islands. Date anomalies, coordinate problems and offshore land events are
            recorded in the report.
          </p>
          <p>
            The importance score organizes readability at different zoom levels. It combines
            interlanguage links, editorial selection and documented context; it is not a moral
            judgement on events.
          </p>
        </section>
        <section>
          <span className="eyebrow">PEOPLE & COMMAND</span>
          <h2>Documented biographies, reigns and offices</h2>
          <p>
            People’s records connect encyclopedia biographies to Wikidata dates and offices. Each
            office retains its available date bounds and sources. A missing date stays unknown;
            competing dates stay visible. A political or military office is not automatically
            labelled a reign.
          </p>
          <p>
            A commander is linked to an event when the source explicitly records command, including
            as a participant qualifier. Participation in a conflict alone does not establish
            leadership of its battles or conquests. Territorial changes are not automatically
            attributed to these people.
          </p>
          <p>
            Leaders linked from a territory rely on a reviewed identity match. Ambiguous
            associations between geographical sources and Wikidata are excluded. Lists of people,
            offices and battles depend on available statements and are not exhaustive biographies or
            successions.
          </p>
          <a className="source-link" href="/data/enrichment.json">
            View dossier coverage ↗
          </a>
        </section>
        <section>
          <span className="eyebrow">06 / CORRECTIONS</span>
          <h2>Improve the atlas</h2>
          <p>
            To report an error, include the shared link, event QID or territorial observation
            identifier, displayed year and a verifiable reference. Factual corrections should first
            be submitted to the relevant source. Archive pages and event records in the atlas also
            have a “Report an error” link that fills these details in for you.
          </p>
          <ul>
            <li>
              <a className="source-link" href={correctionFormUrl()}>
                Report an error in the atlas ↗
              </a>
            </li>
            <li>
              <a className="source-link" href="https://www.wikidata.org/wiki/Wikidata:Introduction">
                Correct a Wikidata statement ↗
              </a>
            </li>
            <li>
              <a
                className="source-link"
                href="https://github.com/Seshat-Global-History-Databank/cliopatria/issues"
              >
                Report an error to Cliopatria ↗
              </a>
            </li>
            <li>
              <a
                className="source-link"
                href="https://github.com/aourednik/historical-basemaps/issues"
              >
                Report an error to Historical Basemaps ↗
              </a>
            </li>
          </ul>
          <p>
            The atlas takes a documentary approach. Limits and disagreements stay visible; names and
            sovereignty claims in the sources do not imply endorsement.
          </p>
        </section>
        <p className="source-note">
          Report generated on {quality.builtAt.slice(0, 10)} · Data downloaded and transformed by a
          reproducible pipeline.
        </p>
      </article>
    </main>
  );
}
