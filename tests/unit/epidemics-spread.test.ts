import { describe, expect, it } from 'vitest';
import { epidemicFixture } from '../fixtures/epidemics';
import { epidemicSpreadFeatures } from '../../components/map/epidemic-spread';
import {
  EPIDEMIC_FRONT_TIME,
  epidemicFrontsAt,
  latestEpidemicFrontIds,
} from '../../lib/epidemics/time';
import { EPIDEMIC_EXTENT_KM } from '../../lib/epidemics/types';

const KM_PER_PIXEL = 40075 / 512;

describe('epidemic spread features', () => {
  const features = epidemicSpreadFeatures(epidemicFixture());
  const feature = (id: string) => features.features.find((item) => item.id === id)!;

  it('draws one halo per milestone and one polygon per front', () => {
    const halos = features.features.filter((item) => item.properties?.shape === 'halo');
    const fronts = features.features.filter((item) => item.properties?.shape === 'front');
    expect(halos).toHaveLength(epidemicFixture().milestones.length);
    expect(fronts).toHaveLength(2);
    expect(feature('plague-london-halo').properties).toMatchObject({
      id: 'plague-london-halo',
      shape: 'halo',
      theme: 'plague',
      color: '#8c5a3c',
      year: 1665,
      endYear: 1666,
    });
    expect(feature('hiv-ongoing-halo').properties).not.toHaveProperty('endYear');
    expect(feature('plague-spread-1347').properties).toMatchObject({
      id: 'plague-spread-1347',
      shape: 'front',
      theme: 'plague',
      year: 1347,
      endYear: 1350,
      group: 'plague-spread',
    });
    expect(feature('plague-spread-1347').geometry.type).toBe('Polygon');
  });

  it('converts schematic extents to zoom-0 pixels at the milestone latitude', () => {
    const at = (id: string) => feature(`${id}-halo`).properties!.r0 as number;
    // plague-emergence sits at latitude 42 with a country (800 km) extent.
    expect(at('plague-emergence')).toBeCloseTo(
      EPIDEMIC_EXTENT_KM.country / (KM_PER_PIXEL * Math.cos((42 * Math.PI) / 180)),
      3,
    );
    // A 400 km region at the equator would be 400 / 78.271484 ≈ 5.110; at 60° ≈ 10.221.
    const km = EPIDEMIC_EXTENT_KM.region;
    expect(km / (KM_PER_PIXEL * Math.cos(0))).toBeCloseTo(5.11, 2);
    expect(km / (KM_PER_PIXEL * Math.cos((60 * Math.PI) / 180))).toBeCloseTo(10.221, 3);
    // Latitudes are clamped to 80° so the cosine never degenerates.
    const data = epidemicFixture();
    const stage = data.milestones.find((item) => item.id === 'hiv-ongoing')!;
    stage.coordinates = [-95, 88];
    stage.extent = 'region';
    const clamped = epidemicSpreadFeatures(data).features.find(
      (item) => item.id === 'hiv-ongoing-halo',
    )!;
    expect(clamped.properties!.r0).toBeCloseTo(
      EPIDEMIC_EXTENT_KM.region / (KM_PER_PIXEL * Math.cos((80 * Math.PI) / 180)),
      3,
    );
  });
});

describe('spread front timing', () => {
  const dataset = epidemicFixture();
  const fronts = dataset.fronts!;

  it('includes fronts within their interval plus the ten-year fade', () => {
    expect(EPIDEMIC_FRONT_TIME.includes(fronts[0]!, 1346)).toBe(false);
    expect(EPIDEMIC_FRONT_TIME.includes(fronts[0]!, 1347)).toBe(true);
    expect(EPIDEMIC_FRONT_TIME.includes(fronts[0]!, 1360)).toBe(true);
    expect(EPIDEMIC_FRONT_TIME.includes(fronts[0]!, 1361)).toBe(false);
  });

  it('fills only the latest front of each group at the horizon', () => {
    expect(latestEpidemicFrontIds(fronts, 1346)).toEqual([]);
    expect(latestEpidemicFrontIds(fronts, 1347)).toEqual(['plague-spread-1347']);
    expect(latestEpidemicFrontIds(fronts, 1348)).toEqual(['plague-spread-1348']);
    expect(latestEpidemicFrontIds(fronts, 1351)).toEqual(['plague-spread-1348']);
    expect(latestEpidemicFrontIds(fronts, 1360)).toEqual(['plague-spread-1348']);
    expect(latestEpidemicFrontIds(fronts, 1364)).toEqual([]);
  });

  it('epidemicFrontsAt filters by disease and sorts chronologically', () => {
    expect(epidemicFrontsAt(dataset, 1348).map((front) => front.id)).toEqual([
      'plague-spread-1347',
      'plague-spread-1348',
    ]);
    expect(epidemicFrontsAt(dataset, 1348, 'plague')).toHaveLength(2);
    expect(epidemicFrontsAt(dataset, 1348, 'smallpox')).toEqual([]);
    expect(epidemicFrontsAt(dataset, 1346)).toEqual([]);
  });
});
