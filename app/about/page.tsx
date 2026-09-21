import type { Metadata } from 'next';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Link from 'next/link';

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

export default async function AboutPage() {
  const [quality, geography] = await Promise.all([
    readFile(path.join(process.cwd(), 'public/data/quality.json'), 'utf8').then(
      (text) => JSON.parse(text) as Quality,
    ),
    readFile(path.join(process.cwd(), 'public/geo/manifest.json'), 'utf8').then(
      (text) => JSON.parse(text) as GeoManifest,
    ),
  ]);
  const number = (value: number) => new Intl.NumberFormat('en').format(value);
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
      <header className="document-header">
        <Link className="back-link" href="/">
          ← Back to the atlas
        </Link>
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
          <div className="document-grid">
            {Object.entries(quality.coverage.byRegion).map(([region, count]) => (
              <div className="document-card" key={region}>
                <h3>{regions[region] ?? region}</h3>
                <p>{number(count)} events in this build</p>
              </div>
            ))}
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
            be submitted to the relevant source.
          </p>
          <ul>
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
