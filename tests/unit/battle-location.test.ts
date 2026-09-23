import { describe, expect, it } from 'vitest';
import type { FeatureCollection, Polygon } from 'geojson';
import type { Claim, Entity } from '../../pipeline/normalize';
import { battleMedium, resolveBattleCoordinates } from '../../pipeline/battles/normalize';

const land: FeatureCollection<Polygon> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [70.9, 20.65],
            [71.1, 20.65],
            [71.1, 20.8],
            [70.9, 20.8],
            [70.9, 20.65],
          ],
        ],
      },
    },
  ],
};
const point = (longitude: number, latitude: number, id: string, rank = 'normal'): Claim => ({
  id,
  rank,
  mainsnak: {
    datavalue: { value: { longitude, latitude, globe: 'http://www.wikidata.org/entity/Q2' } },
  },
});
const link = (id: string): Claim => ({ mainsnak: { datavalue: { value: { id } } } });

describe('battle source coordinate selection', () => {
  it('recovers the later on-land statement when the first sourced point is in open ocean', () => {
    // Actual competing P625 values for the Second Siege of Diu (Q7443525).
    const entity: Entity = {
      id: 'Q7443525',
      lastrevid: 123,
      claims: {
        P31: [link('Q188055')],
        P625: [
          point(71, 20, 'Q7443525$coarse'),
          point(70.984358333333, 20.714997222222, 'Q7443525$fort'),
        ],
      },
    };
    const result = resolveBattleCoordinates(entity, new Map(), 'land', land);
    expect(result.coords).toEqual([70.984358333333, 20.714997222222]);
    expect(result.coordinateSource).toEqual({
      kind: 'event',
      entityId: 'Q7443525',
      url: 'https://www.wikidata.org/wiki/Q7443525?oldid=123#Q7443525$fort',
    });
    expect(result.missing).toEqual([]);
  });

  it('uses an explicitly linked place after rejecting the event coordinate', () => {
    const entity: Entity = {
      id: 'Q1',
      claims: { P625: [point(71, 20, 'Q1$ocean')], P276: [link('Q2')] },
    };
    entity.claims!.P31 = [link('Q188055')];
    const place: Entity = {
      id: 'Q2',
      lastrevid: 45,
      claims: { P625: [point(71, 20.7, 'Q2$place')] },
    };
    const result = resolveBattleCoordinates(entity, new Map([['Q2', place]]), 'land', land);
    expect(result.coords).toEqual([71, 20.7]);
    expect(result.coordinateSource).toEqual({
      kind: 'place',
      entityId: 'Q2',
      url: 'https://www.wikidata.org/wiki/Q2?oldid=45#Q2$place',
    });
    expect(result.missing).toEqual([]);
  });

  it('keeps naval battle coordinates in open water', () => {
    const entity: Entity = { id: 'Q1', claims: { P625: [point(71, 20, 'Q1$sea')] } };
    expect(resolveBattleCoordinates(entity, new Map(), 'naval', land).coords).toEqual([71, 20]);
  });

  it.each(['Q9430', 'Q204894', 'Q1322134', 'Q165', 'Q37901', 'Q33837'])(
    'does not use a broad water or island region (%s) as the battlefield',
    (placeClass) => {
      const entity: Entity = { id: 'Q1', claims: { P276: [link('Q2')] } };
      const place: Entity = {
        id: 'Q2',
        claims: { P31: [link(placeClass)], P625: [point(71, 20, 'Q2$centroid')] },
      };
      const result = resolveBattleCoordinates(entity, new Map([['Q2', place]]), 'naval', land);
      expect(result.coords).toBeUndefined();
      expect(result.missing).toContain('broad-place-coordinate');
    },
  );

  it('keeps ambiguous offshore battles unresolved instead of moving them to a nearby city', () => {
    const entity: Entity = {
      id: 'Q1',
      claims: { P625: [point(71, 20, 'Q1$offshore')], P276: [link('Q2')] },
    };
    const place: Entity = { id: 'Q2', claims: { P625: [point(71, 20.7, 'Q2$city')] } };
    const result = resolveBattleCoordinates(entity, new Map([['Q2', place]]), 'land', land);
    expect(result.coords).toBeUndefined();
    expect(result.missing).toEqual(['land-event-in-open-ocean']);
  });

  it('does not promote deprecated or lower-ranked coordinates after a preferred point fails', () => {
    const entity: Entity = {
      id: 'Q1',
      claims: {
        P625: [
          point(71, 20, 'Q1$preferred', 'preferred'),
          point(71, 20.7, 'Q1$normal'),
          point(71, 20.7, 'Q1$deprecated', 'deprecated'),
        ],
      },
    };
    const result = resolveBattleCoordinates(entity, new Map(), 'land', land);
    expect(result.coords).toBeUndefined();
    expect(result.missing).toContain('land-event-in-open-ocean');
  });

  it('does not infer a battlefield from a country or participant location', () => {
    const entity: Entity = { id: 'Q1', claims: { P17: [link('Q2')], P710: [link('Q2')] } };
    const country: Entity = { id: 'Q2', claims: { P625: [point(71, 20.7, 'Q2$capital')] } };
    const result = resolveBattleCoordinates(entity, new Map([['Q2', country]]), 'land', land);
    expect(result.coords).toBeUndefined();
    expect(result.missing).toEqual(['missing-coordinates']);
  });

  it('skips non-Earth and invalid points before accepting a valid sourced point', () => {
    const lunar = point(71, 20.7, 'Q1$moon');
    lunar.mainsnak!.datavalue!.value = {
      longitude: 71,
      latitude: 20.7,
      globe: 'http://www.wikidata.org/entity/Q405',
    };
    const entity: Entity = {
      id: 'Q1',
      claims: { P625: [lunar, point(181, 20, 'Q1$invalid'), point(71, 20.7, 'Q1$valid')] },
    };
    const result = resolveBattleCoordinates(entity, new Map(), 'land', land);
    expect(result.coords).toEqual([71, 20.7]);
    expect(result.missing).toEqual([]);
  });
});

describe('explicit source medium descriptions', () => {
  it.each([
    ['fr', 'engagement naval, campagne de Guadalcanal (1942), guerre du Pacifique', 'naval'],
    ['fr', 'incident naval de 1877, opposant la Royal Navy à un navire péruvien', 'naval'],
    ['it', 'battaglia navale del III secolo a.C.', 'naval'],
    ['pt', 'Uma batalha naval da Guerra Civil Espanhola (1936–1939)', 'naval'],
    ['en', '1987 naval conflict', 'naval'],
    ['en', '1989 air battle between Libyan and US aircraft', 'air'],
    ['ru', 'морское сражение русско-японской войны', 'naval'],
    ['pl', 'bitwa morska na Morzu Śródziemnym trakcie II wojny światowej', 'naval'],
    ['cs', 'námořní bitva druhé světové války z roku 1944', 'naval'],
    ['en', 'battle during a naval conflict', 'land'],
    ['en', 'battle of the Russo-Japanese War', 'land'],
  ] as const)('classifies the %s source description %s as %s', (language, description, medium) => {
    expect(
      battleMedium({ id: 'Q1', descriptions: { [language]: { value: description } } }, 'battle'),
    ).toBe(medium);
  });
  it('does not infer the medium from a battle name', () => {
    expect(
      battleMedium({ id: 'Q1', labels: { en: { value: 'Battle off Ulsan' } } }, 'battle'),
    ).toBe('land');
  });
});
