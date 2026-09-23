import { expect, test } from '@playwright/test';
import type { BattleIndex, BattleRecord } from '../../lib/battles/schema';

type ReviewedBattleCase = {
  id: string;
  search: string;
  title: string;
  start: NonNullable<BattleRecord['start']>;
  end: BattleRecord['end'] | null;
  coords: [number, number];
  visibleLocation: string;
  sourceUrl: string;
  sourceLocationKind?: 'event' | 'place';
  reviewedLocation?: {
    sourceUrl: string;
    basis: RegExp;
  };
};

// Expectations come from the reviewed historical sources, independently of the
// published index. Exact date objects reject invented month/day precision.
const cases: ReviewedBattleCase[] = [
  {
    id: 'Q699758',
    search: 'Maxen',
    title: 'Battle of Maxen',
    start: { year: 1759, month: 11, day: 20 },
    end: { year: 1759, month: 11, day: 21 },
    coords: [13.80277778, 50.92361111],
    visibleLocation: '50.9236°, 13.8028°',
    sourceLocationKind: 'event',
    sourceUrl:
      'https://gup.unige.it/sites/gup.unige.it/files/pagine/Carteggio_con_Daniele_Florio.pdf',
  },
  {
    id: 'Q1054868',
    search: 'Hondschoote',
    title: 'Battle of Hondschoote',
    start: { year: 1793, month: 9, day: 6 },
    end: { year: 1793, month: 9, day: 8 },
    coords: [2.5861, 50.9803],
    visibleLocation: '50.9803°, 2.5861°',
    sourceLocationKind: 'event',
    sourceUrl:
      'https://www.gendarmerie.interieur.gouv.fr/gendinfo/histoire/un-peu-de-terre-de-france-sur-le-drapeau',
  },
  {
    id: 'Q2889112',
    search: 'Las Piedras',
    title: 'Battle of Las Piedras',
    start: { year: 1811, month: 5, day: 18 },
    end: { year: 1811, month: 5, day: 18 },
    coords: [-56.2014, -34.726],
    visibleLocation: '-34.7260°, -56.2014°',
    sourceUrl: 'https://www.impo.com.uy/bases/resoluciones/326-2013/1',
    reviewedLocation: {
      sourceUrl:
        'https://www.museos.gub.uy/index.php/museos/museos-por-localidad/canelones/item/985-museo-a-cielo-abierto-batalla-de-las-piedras',
      basis: /representative point within the protected battlefield park/i,
    },
  },
  {
    id: 'Q4872580',
    search: 'Toverud',
    title: 'Battle of Toverud',
    start: { year: 1808, month: 4, day: 19 },
    end: { year: 1808, month: 4, day: 20 },
    coords: [11.4878, 59.9182],
    visibleLocation: '59.9182°, 11.4878°',
    sourceUrl: 'https://snl.no/Toverud',
    reviewedLocation: {
      sourceUrl:
        'https://www.aurskog-holand.kommune.no/innhold/naring-etablering-og-landbruk/turisme/opplevaurskogholand/',
      basis: /representative site locator/i,
    },
  },
  {
    id: 'Q4872585',
    search: 'Trangen',
    title: 'Battle of Trangen',
    start: { year: 1808, month: 4, day: 25 },
    end: null,
    coords: [12.1368, 60.6534],
    visibleLocation: '60.6534°, 12.1368°',
    sourceUrl:
      'https://www.asnes.kommune.no/_f/p1/i932152e9-25c2-4701-b401-60709772c64d/kulturminneplan-asnes-030225-med-innholdsfortegnelse.pdf',
    reviewedLocation: {
      sourceUrl: 'https://api.kartverket.no/stedsnavn/v1/sted?stedsnummer=796072&utkoordsys=4258',
      basis: /gazetteer's valley reference point/i,
    },
  },
  {
    id: 'Q4872624',
    search: 'Ugeumchi',
    title: 'Battle of Ugeumchi',
    start: { year: 1894, month: 12, day: 4 },
    end: { year: 1894, month: 12, day: 7 },
    coords: [127.1123, 36.4332],
    visibleLocation: '36.4332°, 127.1123°',
    sourceUrl: 'https://contents.history.go.kr/mobile/kc/view.do?levelId=kc_i402520',
    reviewedLocation: {
      sourceUrl:
        'https://www.heritage.go.kr/heri/cul/culSelectDetail.do?ccbaCpno=1333403870000&pageNo=1_1_2_0',
      basis: /designated battlefield sector/i,
    },
  },
  {
    id: 'Q18500027',
    search: 'Casa Forte',
    title: 'Battle of Casa Forte',
    start: { year: 1645, month: 8, day: 17 },
    end: null,
    coords: [-34.9201, -8.0358],
    visibleLocation: '-8.0358°, -34.9201°',
    sourceUrl: 'https://www2.recife.pe.gov.br/node/26901',
    reviewedLocation: {
      sourceUrl:
        'https://parcerias.recife.pe.gov.br/wp-content/uploads/2023/08/LOCALIZACOES_DOS_PONTOS_DE_INTERESSE_PARA_FINS_DE_MODELAGEM_ECONOMICO__1_.pdf',
      basis: /broad historic sector only/i,
    },
  },
  {
    id: 'Q4677388',
    search: 'Action of 8 May',
    title: 'Action of 8 May 1941',
    start: { year: 1941, month: 5, day: 8 },
    end: null,
    coords: [57.8, 3.5],
    visibleLocation: '3.5000°, 57.8000°',
    sourceLocationKind: 'event',
    sourceUrl: 'https://www.awm.gov.au/collection/C48238',
  },
  {
    id: 'Q2237342',
    search: 'Bemis Heights',
    title: 'Battle of Bemis Heights',
    start: { year: 1777, month: 10, day: 7 },
    end: null,
    coords: [-73.64, 43.009],
    visibleLocation: '43.0090°, -73.6400°',
    sourceUrl: 'https://irma.nps.gov/DataStore/Reference/Profile/1023142',
    reviewedLocation: {
      sourceUrl: 'https://irma.nps.gov/DataStore/Reference/Profile/1023142',
      basis: /fortification-sector locator/i,
    },
  },
  {
    id: 'Q208127',
    search: 'Tsushima',
    title: 'Battle of Tsushima',
    start: { year: 1905, month: 5, day: 27 },
    end: { year: 1905, month: 5, day: 28 },
    coords: [130.15, 34.45],
    visibleLocation: '34.4500°, 130.1500°',
    sourceLocationKind: 'event',
    sourceUrl: 'https://www.jacar.go.jp/wp/ennews/contents/2282/',
  },
  {
    id: 'Q111947056',
    search: 'Bloody Angle',
    title: 'Bloody Angle',
    start: { year: 1775, month: 4, day: 19 },
    end: null,
    coords: [-71.298, 42.4553],
    visibleLocation: '42.4553°, -71.2980°',
    sourceUrl: 'https://www.nps.gov/places/elm-brook-hill.htm',
    reviewedLocation: {
      sourceUrl: 'https://www.nps.gov/places/elm-brook-hill.htm',
      basis: /historic road bend/i,
    },
  },
  {
    id: 'Q4872162',
    search: 'Rangiriri',
    title: 'Battle of Rangiriri',
    start: { year: 1863, month: 11, day: 20 },
    end: { year: 1863, month: 11, day: 21 },
    coords: [175.129, -37.428],
    visibleLocation: '-37.4280°, 175.1290°',
    sourceUrl: 'https://www.doc.govt.nz/documents/science-and-technical/sap261entire.pdf',
    reviewedLocation: {
      sourceUrl: 'https://www.doc.govt.nz/documents/science-and-technical/sap261entire.pdf',
      basis: /southwest site corner/i,
    },
  },
  {
    id: 'Q5251295',
    search: 'Pukekohe',
    title: 'Defence of Pukekohe East 1863',
    start: { year: 1863, month: 9, day: 14 },
    end: { year: 1863, month: 9, day: 14 },
    coords: [174.9461, -37.1886],
    visibleLocation: '-37.1886°, 174.9461°',
    sourceUrl: 'https://www.heritage.org.nz/list-details/483/483',
    reviewedLocation: {
      sourceUrl: 'https://www.heritage.org.nz/list-details/483/483',
      basis: /fortified church/i,
    },
  },
  {
    id: 'Q700530',
    search: 'Cape St. George',
    title: 'Battle of Cape St. George',
    start: { year: 1943, month: 11, day: 25 },
    end: null,
    coords: [153.741667, -5.272222],
    visibleLocation: '-5.2722°, 153.7417°',
    sourceUrl:
      'https://www.govinfo.gov/content/pkg/GOVPUB-D221-PURL-gpo172671/pdf/GOVPUB-D221-PURL-gpo172671.pdf',
    reviewedLocation: {
      sourceUrl:
        'https://www.govinfo.gov/content/pkg/GOVPUB-D221-PURL-gpo172671/pdf/GOVPUB-D221-PURL-gpo172671.pdf',
      basis: /American approach position at 0143, not the first radar contact at 0141/i,
    },
  },
  {
    id: 'Q4090309',
    search: 'Michelsberg',
    title: 'Battle of Michelsberg',
    start: { year: 1805, month: 10, day: 15 },
    end: null,
    coords: [9.983, 48.411],
    visibleLocation: '48.4110°, 9.9830°',
    sourceUrl: 'https://hdbg.eu/koenigreich/index.php/objekte/index/id/277',
    reviewedLocation: {
      sourceUrl:
        'https://tourismus.ulm.de/de/entdecken/sehen-und-erleben/sehenswuerdigkeiten/bundesfestung/wilhelmsburg-ulm',
      basis: /approximate summit-sector marker, not a surveyed battlefield point/i,
    },
  },
  {
    id: 'Q4872070',
    search: 'Point Judith',
    title: 'Battle of Point Judith',
    start: { year: 1945, month: 5, day: 5 },
    end: { year: 1945, month: 5, day: 6 },
    coords: [-71.416944, 41.317222],
    visibleLocation: '41.3172°, -71.4169°',
    sourceUrl: 'https://vesselhistory.marad.dot.gov/ShipHistory/Detail/6993',
    reviewedLocation: {
      sourceUrl: 'https://vesselhistory.marad.dot.gov/ShipHistory/Detail/6993',
      basis: /opening attack location, not a surveyed battle center or the U-853 wreck position/i,
    },
  },
  {
    id: 'Q384091',
    search: 'Mukden',
    title: 'Battle of Mukden',
    start: { year: 1905, month: 2, day: 19 },
    end: { year: 1905, month: 3, day: 10 },
    coords: [123.43333333, 41.78333333],
    visibleLocation: '41.7833°, 123.4333°',
    sourceLocationKind: 'event',
    sourceUrl: 'https://www.prlib.ru/section/683596',
  },
  {
    id: 'Q1989637',
    search: 'Festubert',
    title: 'Battle of Festubert',
    start: { year: 1915, month: 5, day: 15 },
    end: { year: 1915, month: 5, day: 25 },
    coords: [2.73611111, 50.54388889],
    visibleLocation: '50.5439°, 2.7361°',
    sourceLocationKind: 'event',
    sourceUrl:
      'https://www.canada.ca/en/department-national-defence/services/military-history/history-heritage/battle-honours-honorary-distinctions/festubert-1915.html',
  },
  {
    id: 'Q637320',
    search: 'Third Battle of the Isonzo',
    title: 'Third Battle of the Isonzo',
    start: { year: 1915, month: 10, day: 18 },
    end: { year: 1915, month: 11, day: 4 },
    coords: [13.4003, 45.8567],
    visibleLocation: '45.8567°, 13.4003°',
    sourceLocationKind: 'event',
    sourceUrl: 'https://www.difesa.it/assets/allegati/26653/milite_ignoto.pdf',
  },
  {
    id: 'Q2791318',
    search: 'First Battle of Gaza',
    title: 'First Battle of Gaza',
    start: { year: 1917, month: 3, day: 26 },
    end: { year: 1917, month: 3, day: 27 },
    coords: [34.4737, 31.4893],
    visibleLocation: '31.4893°, 34.4737°',
    sourceLocationKind: 'event',
    sourceUrl: 'https://www.awm.gov.au/visit/exhibitions/anzac-voices/sinai-palestine',
  },
  {
    id: 'Q913821',
    search: 'Herbsthausen',
    title: 'Battle of Herbsthausen',
    start: { year: 1645, month: 5, day: 5 },
    end: null,
    coords: [9.829, 49.402],
    visibleLocation: '49.4020°, 9.8290°',
    sourceLocationKind: 'event',
    sourceUrl:
      'https://www.bad-mergentheim.de/de/verwaltung/stadtteile/bad-mergentheimer-stadtteil-herbsthausen-id_436/',
  },
  {
    id: 'Q109065540',
    search: 'Ovčím vrchu',
    title: 'Bitva na Ovčím vrchu',
    start: { year: 1680, month: 5, day: 6 },
    end: null,
    coords: [12.931085, 49.887941],
    visibleLocation: '49.8879°, 12.9311°',
    sourceUrl: 'https://www.kokasice.cz/obec/historie/ovci-vrch/ovci-vrch-14cs.html',
    reviewedLocation: {
      sourceUrl:
        'https://www.otrocin.eu/volny-cas/turisticke-cile/kopce-priroda/ovci-vrch-kaple-a-pomnik-0_58.html',
      basis: /landmark precision; neither combat extent nor survey accuracy is established/i,
    },
  },
  {
    id: 'Q118593994',
    search: 'Ghent',
    title: 'Siege of Ghent (1678)',
    start: { year: 1678, month: 3 },
    end: { year: 1678 },
    coords: [3.725277777777778, 51.05361111111111],
    visibleLocation: '51.0536°, 3.7253°',
    sourceUrl:
      'https://www.servicehistorique.sga.defense.gouv.fr/sites/default/files/2019-10/SHD%20bataille%20inventaire%2089-194.pdf',
  },
  {
    id: 'Q123739799',
    search: 'Mscislaŭ',
    title: 'Siege of Mscislaŭ',
    start: { year: 1658 },
    end: { year: 1659, month: 4 },
    coords: [31.7247, 54.0196],
    visibleLocation: '54.0196°, 31.7247°',
    sourceUrl: 'https://elar.urfu.ru/bitstream/10995/23374/1/iurg-2004-33-19.pdf',
  },
  {
    id: 'Q700860',
    search: 'Eckmühl',
    title: 'Battle of Eckmühl',
    start: { year: 1809, month: 4, day: 22 },
    end: null,
    coords: [12.183163, 48.843924],
    visibleLocation: '48.8439°, 12.1832°',
    sourceUrl:
      'https://www.schierling.de/kultur-freizeit/kultur-termine/2111-gedenkveranstaltung-zu-215-jahre-schlacht-bei-eggmuehl',
    reviewedLocation: {
      sourceUrl:
        'https://pages.destination.one/de/landkreis-regensburg/streaming/detail/POI/p_100003509/schloss-eggmuehl',
      basis: /official site POI point, not a surveyed battle center/i,
    },
  },
  {
    id: 'Q699238',
    search: 'Spicheren',
    title: 'Battle of Spicheren',
    start: { year: 1870, month: 8, day: 6 },
    end: null,
    coords: [6.9666, 49.2043],
    visibleLocation: '49.2043°, 6.9666°',
    sourceUrl: 'https://paysdeforbach.com/decouvrir/les-incontournables/hauteurs-de-spicheren/',
    reviewedLocation: {
      sourceUrl:
        'https://www.cirkwi.com/fr/point-interet/1627601-site-historique-des-hauteurs-de-spicheren',
      basis: /Hauteurs sector reference point/i,
    },
  },
];

for (const reviewed of cases) {
  test(`catalogue opens ${reviewed.title} at its sourced date and location`, async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const response = await request.get(`/data/battles/events/${reviewed.id}.json`);
    expect(response.ok()).toBe(true);
    const battle: BattleRecord = await response.json();
    const indexResponse = await request.get('/data/battles/index.json');
    expect(indexResponse.ok()).toBe(true);
    const index: BattleIndex = await indexResponse.json();
    const entry = index.battles.find((candidate) => candidate.id === reviewed.id);
    expect(entry).toBeDefined();
    for (const published of [battle, entry!]) {
      expect(published.start).toEqual(reviewed.start);
      expect(published.end ?? null).toEqual(reviewed.end);
      expect(published.coords).toEqual(reviewed.coords);
    }
    expect(battle.sources.map((source) => source.url)).toContain(reviewed.sourceUrl);

    // Start without a selected event or supplied camera coordinates: catalogue
    // navigation itself must find the recovered record and focus the right site.
    await page.goto('/?battle=1&lang=en');
    await page.getByRole('textbox', { name: 'Search all battles…' }).fill(reviewed.search);
    const result = page.getByTestId(`battle-open-${reviewed.id}`);
    await expect(result).toContainText(reviewed.title);
    await expect(result.locator('.battle-list-year')).toHaveText(String(reviewed.start.year));
    await expect(result).not.toContainText('Date or location missing');
    await result.click();

    const detail = page.getByTestId('battle-detail');
    await expect(detail).toHaveAttribute('data-battle-id', reviewed.id);
    await expect(detail.getByRole('heading', { name: reviewed.title, exact: true })).toBeVisible();
    await expect(detail.locator('.battle-date')).toHaveText(String(reviewed.start.year));
    await expect(page.getByTestId('year-slider')).toHaveAttribute(
      'aria-valuetext',
      String(reviewed.start.year),
    );
    const location = detail.locator('.battle-location');
    await expect(location).toContainText(reviewed.visibleLocation);

    const map = page.locator('[data-battle-status]');
    await expect(map).toHaveAttribute('data-battle-event', reviewed.id);
    await expect(map).toHaveAttribute('data-battle-status', 'ready', { timeout: 45_000 });
    await expect(map).toHaveAttribute('data-battle-rendered', 'true');
    expect(Number(await map.getAttribute('data-battle-models'))).toBeGreaterThan(0);
    await expect(page.getByTestId('battle-play')).toBeEnabled();
    await expect
      .poll(() => Number(new URL(page.url()).searchParams.get('lon')))
      .toBeCloseTo(reviewed.coords[0], 3);
    await expect
      .poll(() => Number(new URL(page.url()).searchParams.get('lat')))
      .toBeCloseTo(reviewed.coords[1], 3);

    if (reviewed.reviewedLocation) {
      expect(battle.coordinateSource?.url).toBe(reviewed.reviewedLocation.sourceUrl);
      await expect(location).toContainText(reviewed.reviewedLocation.basis);
      await expect(
        location.locator(`a[href="${reviewed.reviewedLocation.sourceUrl}"]`),
      ).toBeVisible();
    } else {
      expect(battle.coordinateSource?.kind).toBe(reviewed.sourceLocationKind ?? 'place');
      if (reviewed.sourceLocationKind !== 'event') {
        await expect(location).toContainText('the precise battlefield is not established');
      }
    }

    const sources = detail.locator('details.battle-sources').filter({
      has: page.locator('summary', { hasText: /^Sources ·/ }),
    });
    await sources.locator('summary').click();
    await expect(sources.locator(`a[href="${reviewed.sourceUrl}"]`)).toBeVisible();
  });
}
