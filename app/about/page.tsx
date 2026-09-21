import type { Metadata } from 'next';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Link from 'next/link';

export const dynamic = 'force-static';
export const metadata: Metadata = {
  title: 'Sources & méthodologie — Atlas Belli',
  description:
    'Comment Atlas Belli documente les événements, les frontières, les dates anciennes et les incertitudes. Sources ouvertes, licences et rapport de couverture.',
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
  const number = (value: number) => new Intl.NumberFormat('fr').format(value);
  const regions: Record<string, string> = {
    europe: 'Europe',
    africa: 'Afrique',
    asia: 'Asie',
    'middle-east': 'Moyen-Orient',
    'north-america': 'Amérique du Nord',
    'south-america': 'Amérique du Sud',
    oceania: 'Océanie',
    global: 'Monde / non attribué',
  };
  return (
    <main className="document-page">
      <header className="document-header">
        <Link className="back-link" href="/">
          ← Revenir à l’atlas
        </Link>
        <span className="eyebrow">LE DESSOUS DES CARTES</span>
        <h1>
          L’histoire mérite
          <br />
          des sources.
        </h1>
        <p>
          Un atlas pour explorer les évolutions territoriales et les conflits documentés. Une carte
          demeure une interprétation : sa provenance et ses limites doivent rester visibles.
        </p>
        <a className="source-link" href="#english" lang="en">
          Read the methodology in English ↓
        </a>
      </header>
      <article className="document-body">
        <div className="document-grid">
          <section className="document-card">
            <span className="eyebrow">01 / ÉVÉNEMENTS</span>
            <h2>{number(quality.geolocatedDatedEvents)}</h2>
            <p>
              Événements géolocalisés et datés dans cette version. {number(quality.withProvenance)}{' '}
              portent une provenance explicite.
            </p>
            <a className="source-link" href="/data/quality.json">
              Ouvrir le rapport de qualité ↗
            </a>
          </section>
          <section className="document-card">
            <span className="eyebrow">02 / TERRITOIRES</span>
            <h2>{number(geography.temporal.records)}</h2>
            <p>
              Géométries politiques datées, pour {number(geography.temporal.entities)} entités
              nommées dans Cliopatria. {geography.snapshots.length} instantanés Historical Basemaps
              offrent une source de référence complémentaire.
            </p>
            <a className="source-link" href="/geo/manifest.json">
              Consulter le manifeste géographique ↗
            </a>
          </section>
        </div>
        {!quality.acceptance.met && (
          <p className="document-notice">
            Le seuil prévu de {number(quality.acceptance.target)} événements valides n’est pas
            atteint dans ce build. Les données manquantes ou rejetées ne sont pas remplacées par des
            événements inventés.
          </p>
        )}
        <section>
          <span className="eyebrow">03 / PROVENANCE</span>
          <h2>Des sources ouvertes, des licences distinctes</h2>
          <div className="document-grid">
            <div className="document-card">
              <h3>Wikidata</h3>
              <p>
                Les événements, dates, lieux, participants et liens vers les conflits proviennent
                des déclarations structurées de Wikidata, sous CC0. Les identifiants QID permettent
                de remonter à chaque fiche et à son historique.
              </p>
              <a className="source-link" href="https://www.wikidata.org/wiki/Wikidata:Licensing">
                Wikidata · licence CC0 ↗
              </a>
            </div>
            {geography.sources.map((source) => (
              <div className="document-card" key={source.label}>
                <h3>{source.label}</h3>
                <p>
                  {source.licence}. Les révisions des dépôts et les empreintes SHA-256 sont
                  verrouillées dans le pipeline. Les données ont été normalisées, les années avant
                  notre ère converties en numérotation astronomique et les géométries simplifiées
                  pour la production de tuiles. Les sources originales restent accessibles.
                </p>
                <a className="source-link" href={source.url}>
                  Consulter la source ↗
                </a>
                <a className="source-link" href={source.licenceUrl}>
                  Lire la licence ↗
                </a>
                {source.citation && (
                  <a className="source-link" href={source.citation}>
                    Publication scientifique ↗
                  </a>
                )}
                {source.correspondingSource && (
                  <a className="source-link" href={source.correspondingSource}>
                    Télécharger le code et les géométries sources correspondants ↓
                  </a>
                )}
              </div>
            ))}
            <div className="document-card">
              <h3>Typographies hébergées localement</h3>
              <p>
                Cormorant est une création des Cormorant Project Authors ; Manrope des Manrope
                Project Authors. Les deux polices sont distribuées avec leur licence SIL Open Font
                License 1.1 et leurs avis de copyright.
              </p>
              <a className="source-link" href="/fonts/cormorantgaramond-OFL.txt">
                Cormorant · copyright et licence ↗
              </a>
              <a className="source-link" href="/fonts/manrope-OFL.txt">
                Manrope · copyright et licence ↗
              </a>
            </div>
            <div className="document-card">
              <h3>Wikipédia & Wikimedia Commons</h3>
              <p>
                Les résumés sont chargés à l’ouverture des fiches, en français avec repli en
                anglais. Les textes sont attribués à Wikipédia et distribués selon les conditions CC
                BY-SA applicables. Chaque image conserve la licence indiquée sur sa page Wikimedia
                Commons.
              </p>
              <a
                className="source-link"
                href="https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use"
              >
                Conditions de réutilisation Wikimedia ↗
              </a>
              <a className="source-link" href="https://creativecommons.org/licenses/by-sa/4.0/">
                CC BY-SA 4.0 ↗
              </a>
            </div>
          </div>
        </section>
        <section>
          <span className="eyebrow">04 / TEMPS & FRONTIÈRES</span>
          <h2>Ne pas confondre précision et certitude</h2>
          <p>
            Les années sont stockées selon la numérotation astronomique : 1 av. J.-C. correspond à
            0, 2 av. J.-C. à −1. L’interface les présente en notation historique. Le calendrier
            julien, grégorien ou non précisé et la précision de la date sont conservés lorsqu’ils
            sont disponibles.
          </p>
          <p>
            Cliopatria décrit des polygones valables sur des intervalles inclusifs entre 3400 av.
            J.-C. et 2024. Le filtrage de ces intervalles fait évoluer la carte. Les contours
            anciens restent approximatifs ; l’absence de polygone ne signifie pas qu’un espace était
            inhabité. Après 2024, les dernières frontières documentées sont conservées et ne
            constituent pas une vérification des changements récents.
          </p>
          <p>
            Les instantanés Historical Basemaps vont ici de 4000 av. J.-C. à 2010 et sont parfois
            séparés de plusieurs siècles. Un éventuel fondu entre instantanés sert à la lecture
            visuelle : il ne crée pas de nouvelles frontières historiques. Les rivières et côtes
            Natural Earth décrivent le monde physique contemporain.
          </p>
          <p>
            Les courbes de superficie mesurent la géométrie des observations. Les premières et
            dernières observations d’un territoire ne sont pas assimilées à sa fondation ou sa
            disparition. Les alliances regroupées dans Cliopatria sont exclues du remplissage
            principal afin de ne pas les représenter comme un État unitaire.
          </p>
          <p>
            La carte synchronise les événements et les territoires par leur date. Elle n’attribue
            pas automatiquement un changement de frontières à une bataille voisine ou contemporaine.
            Les lignes entre événements liés indiquent une chronologie, pas un itinéraire d’armée
            attesté.
          </p>
        </section>
        <section>
          <span className="eyebrow">05 / COUVERTURE</span>
          <h2>Une histoire mondiale, une couverture inégale</h2>
          <p>
            Les sources ouvertes reflètent des déséquilibres géographiques, linguistiques et
            chronologiques. Le nombre de points visibles mesure la documentation disponible, pas la
            quantité de violence d’une région ou d’une époque.
          </p>
          <div className="document-grid">
            {Object.entries(quality.coverage.byRegion).map(([region, count]) => (
              <div className="document-card" key={region}>
                <h3>{regions[region] ?? region}</h3>
                <p>{number(count)} événements dans ce build</p>
              </div>
            ))}
          </div>
          <p>
            Les coordonnées issues du lieu associé indiquent ce lieu ; elles ne prouvent pas
            l’emplacement exact du champ de bataille. Le masque de validation Natural Earth à 1:10m
            est distinct du fond physique à 1:50m. Une tolérance côtière de 25 km tient compte de la
            généralisation de cette géométrie et des petites îles. Les anomalies de dates,
            coordonnées et événements terrestres au large sont consignées dans le rapport.
          </p>
          <p>
            Le score d’importance organise la lisibilité au zoom. Il combine les liens interlangues,
            la sélection éditoriale et le contexte documenté ; il ne constitue pas un jugement moral
            sur les événements.
          </p>
        </section>
        <section>
          <span className="eyebrow">PERSONNES & COMMANDEMENT</span>
          <h2>Biographies, règnes et fonctions documentés</h2>
          <p>
            Les fiches des personnes relient les biographies encyclopédiques aux dates et fonctions
            de Wikidata. Chaque fonction conserve ses bornes temporelles disponibles et ses sources.
            Une date absente reste inconnue ; plusieurs dates concurrentes restent visibles. Une
            fonction politique ou militaire n’est pas systématiquement un règne.
          </p>
          <p>
            Un commandant est lié à un événement lorsque la source indique explicitement son
            commandement, notamment comme qualificatif d’un participant. Une simple participation à
            un conflit ne suffit pas à lui attribuer la direction de ses batailles ou de ses
            conquêtes. Les changements territoriaux ne sont pas attribués automatiquement à ces
            personnes.
          </p>
          <p>
            Les dirigeants proposés depuis un territoire reposent sur une correspondance d’identité
            vérifiée. Les associations ambiguës entre les sources géographiques et Wikidata sont
            écartées. Les listes de personnes, de fonctions et de batailles dépendent des
            déclarations disponibles et ne constituent pas des biographies ou des successions
            exhaustives.
          </p>
          <a className="source-link" href="/data/enrichment.json">
            Consulter la couverture des dossiers ↗
          </a>
        </section>
        <section>
          <span className="eyebrow">06 / CORRECTIONS</span>
          <h2>Faire progresser l’atlas</h2>
          <p>
            Pour signaler une erreur, conservez le lien partagé, le QID de l’événement ou
            l’identifiant de l’observation territoriale, l’année affichée et une référence
            vérifiable. Les corrections de faits doivent d’abord remonter à la source concernée.
          </p>
          <ul>
            <li>
              <a className="source-link" href="https://www.wikidata.org/wiki/Wikidata:Introduction">
                Corriger une déclaration Wikidata ↗
              </a>
            </li>
            <li>
              <a
                className="source-link"
                href="https://github.com/Seshat-Global-History-Databank/cliopatria/issues"
              >
                Signaler une erreur à Cliopatria ↗
              </a>
            </li>
            <li>
              <a
                className="source-link"
                href="https://github.com/aourednik/historical-basemaps/issues"
              >
                Signaler une erreur à Historical Basemaps ↗
              </a>
            </li>
          </ul>
          <p>
            Le ton de l’atlas est documentaire. Les limites et désaccords restent visibles ; les
            noms et revendications de souveraineté présents dans les sources ne constituent pas une
            prise de position.
          </p>
        </section>
        <section id="english" lang="en">
          <span className="eyebrow">METHODOLOGY · ENGLISH</span>
          <h2>An atlas with inspectable evidence</h2>
          <p>
            This build contains {number(quality.geolocatedDatedEvents)} dated, geolocated events
            with Wikidata provenance and {number(geography.temporal.records)} dated polity
            geometries from Cliopatria. Every displayed record links to its source. Event coverage
            is incomplete and uneven across regions and periods; missing data are never filled with
            invented events.
          </p>
          <p>
            Cliopatria is CC BY 4.0, Historical Basemaps is GPL-3.0, Natural Earth is public domain,
            and Wikidata structured data is CC0. Wikipedia summaries retain their attribution and
            applicable CC BY-SA terms; image licences are specified on their Commons pages. Modified
            Historical Basemaps geometry and complete corresponding source are downloadable above.
          </p>
          <p>
            BCE dates use astronomical year numbering internally. Boundary intervals, date precision
            and uncertainty are preserved. Approximate ancient boundaries are not modern sovereignty
            claims. Current physical geography does not reconstruct ancient coastlines. Territorial
            observations end in 2024, and the interface retains the last documented state after that
            date.
          </p>
          <p>
            Playing a conflict shows chronologically linked source events; connecting lines are not
            reconstructed army routes. A battle and a territorial change sharing a date do not
            establish causation. Territory area histories show observations, not asserted founding
            or dissolution dates.
          </p>
          <p>
            Biographical dates and offices retain their statement-level evidence and date variants.
            Participation does not imply command: commanders require an explicit source statement.
            Political offices are not automatically labelled reigns. Links from map territories to
            rulers require a reviewed identity match, and ambiguous cross-references are excluded.
            The people and office lists reflect source coverage, not an exhaustive succession.
          </p>
          <p>
            To report a correction, include the shared view, source identifier, displayed year, and
            a reliable reference. Use the source issue links above. The machine-readable quality
            report discloses coverage, rejections, and whether the event-count acceptance target is
            met.
          </p>
        </section>
        <p className="source-note">
          Rapport produit le {quality.builtAt.slice(0, 10)} · Données téléchargées et transformées
          par un pipeline reproductible.
        </p>
      </article>
    </main>
  );
}
