import { describe, expect, it } from 'vitest';
import { personSearchRecord } from '../../lib/search-records';

describe('person search documents', () => {
  it('makes every sourced translation of a person searchable', () => {
    const result = personSearchRecord({
      id: 'Q10',
      name: { en: 'Example', de: 'Beispiel', es: 'Ejemplo', zh: '示例', ru: 'Пример' },
    });
    for (const name of ['Example', 'Beispiel', 'Ejemplo', '示例', 'Пример']) {
      expect(result.title).toContain(name);
    }
  });

  it('keeps a person separate from an event sharing an identifier', () => {
    const result = personSearchRecord({ id: 'Q10', name: { en: 'Structural name' } });
    expect(result.id).not.toBe('Q10');
    expect(result).toMatchObject({ targetId: 'Q10', kind: 'person' });
  });

  it('does not invent a display year for an undated person', () => {
    const result = personSearchRecord({
      id: 'Q10',
      name: { en: 'Structural name', fr: 'Nom structurel' },
      aliases: 'Alias from source',
    });
    expect(result.year).toBeUndefined();
    expect(result.title).toContain('Nom structurel');
    expect(result.title).toContain('Structural name');
    expect(result.aliases).toBe('Alias from source');
  });

  it('preserves a sourced astronomical zero rather than treating it as missing', () => {
    const result = personSearchRecord({ id: 'Q10', name: { en: 'Structural name' }, year: 0 });
    expect(result.year).toBe(0);
  });
});
