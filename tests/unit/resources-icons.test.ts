import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import ResourceIcon from '../../components/map/ResourceIcon';
import { RESOURCE_COLORS } from '../../lib/resources/colors';
import { resourceText } from '../../lib/resources/i18n';
import { RESOURCE_CATEGORIES, ResourceCategorySchema } from '../../lib/resources/types';

it.each([
  'barium',
  'chromium',
  'boron',
  'vanadium',
  'fluorite',
  'mineral-sands',
  'platinum-group',
  'titanium',
  'silicon',
  'magnesium',
  'cesium',
  'scandium',
  'selenium',
  'tellurium',
  'indium',
])('renders a localized legend pictogram for the source commodity %s', (value) => {
  const category = ResourceCategorySchema.parse(value);
  const svg = renderToStaticMarkup(createElement(ResourceIcon, { category }));
  expect(svg).toContain(`data-resource-icon="${category}"`);
  expect(svg).toContain(`fill="${RESOURCE_COLORS[category]}"`);
  expect(svg).not.toMatch(/undefined|NaN/);
  expect(svg.match(/<path\b/g)?.length).toBeGreaterThan(1);
  for (const locale of ['en', 'fr', 'de', 'es', 'zh', 'ru'] as const)
    expect(resourceText(locale, category).trim().length).toBeGreaterThan(0);
});

it('provides a color and renderable legend icon for every selectable commodity', () => {
  expect(RESOURCE_CATEGORIES).toHaveLength(45);
  for (const category of RESOURCE_CATEGORIES) {
    expect(RESOURCE_COLORS[category]).toMatch(/^#[a-f\d]{6}$/i);
    const svg = renderToStaticMarkup(createElement(ResourceIcon, { category }));
    expect(svg).toContain('<path');
    expect(svg).not.toMatch(/undefined|NaN/);
  }
});
