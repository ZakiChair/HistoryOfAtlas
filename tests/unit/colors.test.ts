import { describe, expect, it } from 'vitest';
import { entityColor, entityColorRgb, contrastingTextColor } from '../../lib/colors';

describe('stable polity colors', () => {
  it('maps identifiers deterministically to valid CSS and RGB colors', () => {
    expect(entityColor('Q142')).toBe(entityColor('Q142'));
    expect(entityColor('Q142')).not.toBe(entityColor('Q145'));
    expect(entityColor('Q142')).toMatch(/^#[0-9a-f]{6}$/i);
    expect(entityColorRgb('Q142')).toHaveLength(3);
    for (const value of entityColorRgb('Q142')) expect(value).toBeGreaterThanOrEqual(0);
  });

  it('chooses readable text for both extreme backgrounds', () => {
    expect(contrastingTextColor('#ffffff')).toBe('#0b1220');
    expect(contrastingTextColor('#000000')).toBe('#ffffff');
  });
});
