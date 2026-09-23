import type { ResourceCategory } from './types';

export type ResourceIconPaint = 'color' | 'ink' | 'paper' | 'none';

export interface ResourceIconPath {
  d: string;
  fill?: ResourceIconPaint;
  stroke?: ResourceIconPaint;
  strokeWidth?: number;
}

// Shared 32 × 32 drawings for the map sprites and the accessible HTML legend.
// Paint defaults: no fill, ink stroke, 1.6-unit width; round caps and joins.
export const RESOURCE_ICONS: Record<ResourceCategory, ResourceIconPath[]> = {
  oil: [
    {
      d: 'M16 3C13 8 6 14 6 20a10 10 0 0 0 20 0C26 14 19 8 16 3Z',
      fill: 'color',
    },
    { d: 'M10 19c-1 4 2 7 5 7', stroke: 'paper', strokeWidth: 2.3 },
  ],
  gas: [
    {
      d: 'M17 3c2 7-5 9-3 14 3-1 6-4 7-7 2 3 6 6 6 10a11 10 0 0 1-22 0c0-4 3-7 5-10-1 5 1 6 2 7-1-6 3-9 5-14Z',
      fill: 'color',
    },
    {
      d: 'M17 18c0 4-5 5-5 8a4 4 0 0 0 8 0c0-3-1-5-3-8Z',
      fill: 'paper',
      stroke: 'none',
    },
  ],
  coal: [
    { d: 'm11 6 8-2 6 5-2 9-9 3-7-6Z', fill: 'color' },
    { d: 'm5 15 9-2 5 7-4 8H5l-3-6Z', fill: 'color' },
    { d: 'm21 15 7 3 2 7-7 4-8-3 2-7Z', fill: 'color' },
    { d: 'm12 8 3 4 6-3M6 19l4 3 4-5m6 4 4 2 3-3' },
  ],
  uranium: [
    {
      d: 'm13.5 12.7-4-6.9a13 13 0 0 1 13 0l-4 6.9a5 5 0 0 0-5 0ZM21 17h8a13 13 0 0 1-6.5 11.2l-4-6.9A5 5 0 0 0 21 17ZM13.5 21.3l-4 6.9A13 13 0 0 1 3 17h8a5 5 0 0 0 2.5 4.3Z',
      fill: 'color',
    },
    { d: 'M18.5 17a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z', fill: 'color' },
  ],
  iron: [
    {
      d: 'M3 8h16V5h10v9c-4 0-8 2-8 6v3l5 3v2H8v-2l5-3v-5C8 17 4 13 3 8Z',
      fill: 'color',
    },
    { d: 'M5 11h22M13 23h8' },
    { d: 'M21 8h5', stroke: 'paper', strokeWidth: 2 },
  ],
  copper: [
    { d: 'M7 8h18v16H7Z', fill: 'color' },
    { d: 'M12 9v14m4-14v14m4-14v14' },
    {
      d: 'M8 5C2 5 2 27 8 27c4 0 4-22 0-22Zm16 0c-4 0-4 22 0 22 6 0 6-22 0-22Z',
      fill: 'color',
    },
    { d: 'M8 11v10m16-10v10', stroke: 'paper', strokeWidth: 2.3 },
    { d: 'M27 23h2v5h-6' },
  ],
  gold: [
    { d: 'm6 18 9-2 3 9-15 2Z', fill: 'color' },
    { d: 'm19 16 8 2 3 9-14-2Z', fill: 'color' },
    { d: 'm12 6 9 1 4 10-18-1Z', fill: 'color' },
    { d: 'm12 6 2 6 11 5m-11-5-7 4m12 0 2 6 9 5M6 18l3 5 9 2' },
    { d: 'm14 8 5 1', stroke: 'paper', strokeWidth: 1.9 },
  ],
  lithium: [
    { d: 'M12 3h8v4h-8Z', fill: 'color' },
    { d: 'M9 7h14a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z', fill: 'color' },
    { d: 'm18 10-7 10h5l-2 6 8-11h-6Z', fill: 'ink', stroke: 'none' },
  ],
  'rare-earths': [
    { d: 'm4 14 5-6 5 6-1 14-8-2Z', fill: 'color' },
    { d: 'm19 16 6-7 5 7-3 10-9 3Z', fill: 'color' },
    { d: 'm11 9 6-7 6 7-2 18-6 3-5-8Z', fill: 'color' },
    { d: 'm11 9 6 4 6-4m-6 4-2 17M9 9v14m16-13-1 13' },
    { d: 'm17 5 3 4', stroke: 'paper', strokeWidth: 1.8 },
  ],
  bauxite: [
    { d: 'm7 8 11-4 10 8 1 10-9 7-15-4-3-9Z', fill: 'color' },
    { d: 'm7 8 5 9 16-5m-16 5 8 12m-8-12-7 8' },
    { d: 'm17 8 5 4m-6 9 4 3', stroke: 'paper', strokeWidth: 2.4 },
    { d: 'm7 17 2 3m13-2 2 3' },
  ],
  nickel: [
    { d: 'M4 19v7c0 5 21 5 21 0v-7Z', fill: 'color' },
    { d: 'M25 19c0 5-21 5-21 0s21-5 21 0Z', fill: 'color' },
    { d: 'M4 23c4 3 16 3 21 0' },
    { d: 'M28 11a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', fill: 'color' },
    { d: 'M24 11a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z', stroke: 'paper', strokeWidth: 1.9 },
  ],
  phosphate: [
    { d: 'm3 22 5-8 11-2 9 8-3 8H8Z', fill: 'color' },
    { d: 'm8 14 6 7 11 7m-11-7-6 7' },
    { d: 'M13 18C8 9 17 3 29 4c-1 11-6 17-16 14Z', fill: 'color' },
    { d: 'M10 23 24 9m-6 6 1-6m-1 6 6-1', stroke: 'ink', strokeWidth: 1.8 },
    { d: 'M17 9c2-1 4-2 7-2', stroke: 'paper', strokeWidth: 1.8 },
  ],
  silver: [
    { d: 'm7 14 14-5 8 13-18 7-8-7Z', fill: 'color' },
    { d: 'm7 14 8 7 14 1m-14-1-4 8' },
    { d: 'm12 14 8-3', stroke: 'paper', strokeWidth: 2.1 },
    { d: 'm7 2 1.4 3.6L12 7l-3.6 1.4L7 12 5.6 8.4 2 7l3.6-1.4Z', fill: 'paper', strokeWidth: 1.2 },
  ],
  tin: [
    { d: 'M9 5h15a5 5 0 0 1 5 5v4H14v14H3V11a6 6 0 0 1 6-6Z', fill: 'color' },
    { d: 'M14 14v-3a6 6 0 0 0-6-6m6 9h10a4 4 0 0 0 0-8' },
    { d: 'M7 12v11h3', stroke: 'paper', strokeWidth: 2.1 },
    { d: 'M19 18h8v10H17V18Z', fill: 'color' },
    { d: 'M20 21h4m-4 4h4' },
  ],
  salt: [
    { d: 'm3 10 8-5 8 5v10l-8 5-8-5Z', fill: 'color' },
    { d: 'm3 10 8 5 8-5m-8 5v10' },
    { d: 'm15 19 8-5 7 5v8l-7 4-8-4Z', fill: 'color' },
    { d: 'm15 19 8 4 7-4m-7 4v8' },
    { d: 'm22 3 5 2-2 6-5-2Z', fill: 'paper' },
  ],
  zinc: [
    { d: 'm3 12 6-8 20 7-6 17-20-7Z', fill: 'color' },
    { d: 'm8 10 16 6M6 15l17 6M10 7l16 6M5 19l17 6' },
    { d: 'm12 9 8 3', stroke: 'paper', strokeWidth: 2 },
  ],
  lead: [
    { d: 'M16 3 28 8v9c0 6-6 10-12 13C10 27 4 23 4 17V8Z', fill: 'color' },
    { d: 'M16 7v18M8 11h16M8 16h16M11 21h10', strokeWidth: 1.4 },
  ],
  cobalt: [
    { d: 'M5 5h9v23H3V8h2Zm15 4h8v19H17V12h3Z', fill: 'color' },
    { d: 'M7 3h5v3H7Zm15 4h4v3h-4Z', fill: 'paper' },
    { d: 'm9 11-3 7h4l-2 6m16-10-4 6h4l-2 5', stroke: 'paper', strokeWidth: 2 },
  ],
  manganese: [
    {
      d: 'm13 3 6 0 1 4 4 2 4-1 3 5-3 3v4l3 3-3 5-4-1-4 2-1 3h-6l-1-3-4-2-4 1-3-5 3-3v-4l-3-3 3-5 4 1 4-2Z',
      fill: 'color',
    },
    { d: 'm11 13 5-3 5 3v7l-5 3-5-3Z', fill: 'ink' },
  ],
  molybdenum: [
    { d: 'm4 7 10-3 15 7v14l-10 4L4 22Z', fill: 'color' },
    { d: 'm4 7 15 8 10-4m-10 4v14M6 12l10 5M6 17l10 5' },
    { d: 'm22 16 4-1v5l-4 2Z', fill: 'paper', stroke: 'none' },
  ],
  graphite: [
    { d: 'm5 20 16-16 7 7-16 16-10 3Z', fill: 'color' },
    { d: 'm5 20 7 7m6-20 7 7M8 23 22 9' },
    { d: 'm2 30 3-10 7 7Z', fill: 'paper' },
    { d: 'm2 30 2-6 4 4Z', fill: 'ink', stroke: 'none' },
  ],
  diamond: [
    { d: 'm8 4 16 0 6 9-14 17L2 13Z', fill: 'color' },
    { d: 'M2 13h28M8 4l3 9 5 17 5-17 3-9m-13 9 5-9 5 9' },
    { d: 'm5 11 4-5', stroke: 'paper', strokeWidth: 2 },
  ],
  potash: [
    { d: 'M8 3h16l-2 6c5 5 7 10 7 16 0 3-26 3-26 0 0-6 2-11 7-16Z', fill: 'color' },
    { d: 'M10 8h12M10 18v6m0-3 5-5m-5 5 5 4' },
    { d: 'M18 22c-1-6 2-9 8-9-1 6-4 10-8 9Z', fill: 'paper' },
  ],
  platinum: [
    { d: 'M7 8h18v17H7Z', fill: 'color' },
    { d: 'M3 13h4v7H3Zm22 0h4v7h-4Z', fill: 'color' },
    { d: 'M11 12v9m5-9v9m5-9v9M10 16h12' },
    { d: 'M13 3h6', stroke: 'paper', strokeWidth: 2 },
  ],
  palladium: [
    { d: 'm7 5 17 3 5 18-22 2-5-14Z', fill: 'color' },
    { d: 'm8 12 3-2 3 2v4l-3 2-3-2Zm8 5 3-2 3 2v4l-3 2-3-2Z', fill: 'paper' },
    { d: 'm7 5 3 5m14-2-3 6M7 28l2-7' },
  ],
  tungsten: [
    { d: 'M16 2a11 11 0 0 1 8 19l-3 4H11l-3-4A11 11 0 0 1 16 2Z', fill: 'color' },
    { d: 'M11 25h10v5H11Zm2-1V14l3 3 3-3v10' },
    { d: 'M8 11c0-3 2-5 5-6', stroke: 'paper', strokeWidth: 2 },
  ],
  antimony: [
    { d: 'm3 26 1-16 5 3 6 14Z', fill: 'color' },
    { d: 'm13 29-4-21 4-6 5 5 3 20Z', fill: 'color' },
    { d: 'm17 28 5-20 6-4 2 7-7 18Z', fill: 'color' },
    { d: 'm13 7 3 17m10-15-6 15', stroke: 'paper', strokeWidth: 1.8 },
  ],
  niobium: [
    { d: 'M4 28V13a12 12 0 0 1 24 0v15h-7V13a5 5 0 0 0-10 0v15Z', fill: 'color' },
    { d: 'M4 22h7m10 0h7M6 12l6 2M9 6l5 5m4 0 5-5m-3 8 6-2' },
    { d: 'M6 25h3m14 0h3', stroke: 'paper', strokeWidth: 2 },
  ],
  tantalum: [
    { d: 'M8 3h16l3 6v14H5V9Z', fill: 'color' },
    { d: 'M9 23v7m14-7v7M5 9h22M21 12v8' },
    { d: 'M11 13v6m-3-3h6', stroke: 'paper', strokeWidth: 2 },
  ],
  mercury: [
    { d: 'M11 3h10v4h-2v7l9 11c2 4-26 4-24 0l9-11V7h-2Z', fill: 'paper' },
    { d: 'M8 21h16l4 4c2 4-26 4-24 0Z', fill: 'color' },
    { d: 'M16 10c-4 5-5 8 0 8s4-3 0-8Z', fill: 'color', strokeWidth: 1.2 },
  ],
  barium: [
    { d: 'm3 16 2-8 7 2 8 18-6 2Z', fill: 'color' },
    { d: 'm11 7 5-5 5 5-1 21-6 2Z', fill: 'color' },
    { d: 'm19 15 8-8 3 7-10 14-6 2Z', fill: 'color' },
    { d: 'm16 7 1 18M7 12l9 15m10-14-8 13', stroke: 'paper', strokeWidth: 1.8 },
  ],
  chromium: [
    { d: 'm4 12 16-7 9 8v12l-17 5-8-7Z', fill: 'color' },
    { d: 'm4 12 8 8 17-7m-17 7v10' },
    { d: 'm15 22 10-3', stroke: 'paper', strokeWidth: 2.2 },
    { d: 'm10 2 1.5 4.5L16 8l-4.5 1.5L10 14 8.5 9.5 4 8l4.5-1.5Z', fill: 'paper' },
  ],
  boron: [
    { d: 'M4 9 21 3l7 20-17 6Z', fill: 'color' },
    { d: 'm9 11 9-3 5 13-9 3Z', fill: 'paper' },
    { d: 'm13 11 6 8m-8-2 3 4', stroke: 'color', strokeWidth: 2 },
    { d: 'm25 5 3 8M5 24l2 5', stroke: 'paper', strokeWidth: 2 },
  ],
  vanadium: [
    { d: 'm3 7 10-4 16 4v5l-8 3v7l8 3v4l-16 1-10-4v-5l7-2v-6l-7-1Z', fill: 'color' },
    { d: 'm3 7 10 4 16-4M13 11v5l5-1v9l-5 2v4m-3-11 8 5M3 21l10 5' },
    { d: 'm21 9 5-1', stroke: 'paper', strokeWidth: 1.8 },
  ],
  fluorite: [
    { d: 'm3 12 11-6 11 6v12l-11 6-11-6Z', fill: 'color' },
    { d: 'm3 12 11 6 11-6m-11 6v12' },
    { d: 'm16 4 7-2 7 5v8l-7 3-7-5Z', fill: 'color' },
    { d: 'm16 4 7 6 7-3m-7 3v8M7 12l6-3', stroke: 'paper', strokeWidth: 1.5 },
  ],
  'mineral-sands': [
    { d: 'M2 27c3-3 6-14 14-14s11 11 14 14Z', fill: 'color' },
    { d: 'M6 22c5-5 15-5 20 0M4 25c7-4 17-4 24 0' },
    { d: 'm5 10 2-4 4 2-1 4Zm15-4 4-3 3 4-4 3Zm-7 1 2-3 3 3-2 4Z', fill: 'color' },
    { d: 'm11 16 1 1m5-1 1 1m3 2 1 1', stroke: 'paper', strokeWidth: 2.2 },
  ],
  'platinum-group': [
    { d: 'M20 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z', fill: 'color' },
    { d: 'M30 19a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z', fill: 'color' },
    { d: 'M17 23a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z', fill: 'color' },
    {
      d: 'M8 10a4 4 0 0 1 4-4m6 13a4 4 0 0 1 4-4M6 23a4 4 0 0 1 4-4',
      stroke: 'paper',
      strokeWidth: 2,
    },
  ],
  titanium: [
    { d: 'M15 2h3l2 11 10 7v3l-10-3-1 7 4 2v2l-7-2-7 2v-2l4-2-1-7-10 3v-3l10-7Z', fill: 'color' },
    { d: 'M16 6v18', stroke: 'paper', strokeWidth: 1.8 },
  ],
  silicon: [
    { d: 'M7 7h18v18H7Z', fill: 'color' },
    { d: 'M11 11h10v10H11Z', fill: 'ink' },
    {
      d: 'M11 2v5m5-5v5m5-5v5M11 25v5m5-5v5m5-5v5M2 11h5m-5 5h5m-5 5h5m18-10h5m-5 5h5m-5 5h5',
      stroke: 'color',
      strokeWidth: 2,
    },
    { d: 'M14 14h4v4h-4Z', fill: 'paper' },
  ],
  magnesium: [
    { d: 'm12 3 4 7 7-4-2 8 9 2-8 4 4 8-9-3-4 6-2-8-9 1 6-7-4-6 8 1Z', fill: 'color' },
    { d: 'm13 13 6 1 1 6-7-1Z', fill: 'paper' },
  ],
  cesium: [
    { d: 'M16 3a13 13 0 1 1 0 26 13 13 0 0 1 0-26Z', fill: 'color' },
    { d: 'M16 7v9l6 4M6 16h2m16 0h2M16 24v2', stroke: 'ink', strokeWidth: 2 },
    { d: 'M11 8c-2 1-3 2-4 4', stroke: 'paper', strokeWidth: 2 },
  ],
  scandium: [
    {
      d: 'M13 23a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm18 0a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z',
      fill: 'color',
    },
    { d: 'm7 23 6-12 6 12H7m6-12h9l3 12M10 8h6m4-4h5l-3 7', stroke: 'paper', strokeWidth: 2 },
  ],
  selenium: [
    { d: 'M9 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z', fill: 'color' },
    { d: 'm11 10 16-3 4 19-20 4-4-17Z', fill: 'color' },
    { d: 'm13 12 3 14m4-16 3 15m-13-8 17-3m-16 9 18-3', stroke: 'paper', strokeWidth: 1.4 },
  ],
  tellurium: [
    { d: 'M3 5h26v5H3Zm0 17h26v5H3Z', fill: 'color' },
    { d: 'M6 10h6v12H6Zm14 0h6v12h-6Z', fill: 'color' },
    { d: 'M9 13v6m14-6v6', stroke: 'paper', strokeWidth: 2.2 },
    { d: 'M3 7H1v9h3m25 9h2v-9h-3', stroke: 'color', strokeWidth: 1.5 },
  ],
  indium: [
    { d: 'M7 2h18a2 2 0 0 1 2 2v24a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z', fill: 'color' },
    { d: 'M9 6h14v17H9Z', fill: 'ink' },
    { d: 'm12 10 7 8m-7-3 3 4M14 26h4', stroke: 'paper', strokeWidth: 2 },
  ],
};
