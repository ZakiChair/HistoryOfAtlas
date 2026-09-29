import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { localizedName } from '../../lib/i18n';
import { religionTraditionNames } from '../../lib/religions/tradition-names';
import type { LocalizedName } from '../../lib/types';

const publishedNames = ['history', 'coverage'].flatMap((dataset) => {
  const data = JSON.parse(
    readFileSync(new URL(`../../public/data/religions/${dataset}.json`, import.meta.url), 'utf8'),
  ) as { traditions: { names: LocalizedName }[] };
  return data.traditions.map((tradition) => tradition.names);
});

describe('religion interface category names', () => {
  it('translates every published tradition category into Arabic without mutating the source', () => {
    for (const names of publishedNames) {
      const original = { ...names };
      const translated = religionTraditionNames(names);
      expect(translated.ar, names.en).toMatch(/[\u0600-\u06ff]/);
      expect(localizedName(translated, 'ar'), names.en).not.toBe(names.en);
      expect(names).toEqual(original);
    }
  });

  it('preserves the existing French and English names', () => {
    for (const names of publishedNames) {
      const translated = religionTraditionNames(names);
      expect(localizedName(translated, 'fr')).toBe(names.fr);
      expect(localizedName(translated, 'en')).toBe(names.en);
    }
  });

  it('retains an Arabic name already provided by the source', () => {
    const names = { en: 'Christian traditions', ar: 'اسم عربي من المصدر' };
    expect(religionTraditionNames(names)).toBe(names);
    expect(localizedName(religionTraditionNames(names), 'ar')).toBe(names.ar);
  });

  it('uses exact category names and leaves unknown names to the normal source-text fallback', () => {
    for (const en of ['Christianity', 'Christian traditions (regional)', 'Unknown tradition']) {
      const names = { en, fr: 'Nom du document' };
      expect(religionTraditionNames(names)).toBe(names);
      expect(localizedName(religionTraditionNames(names), 'ar')).toBe(en);
    }
    expect(religionTraditionNames({ en: 'Christian traditions' }).ar).toBe('التقاليد المسيحية');
  });
});
