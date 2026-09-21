import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  dictionaries,
  EVENT_TYPE_LABELS,
  REGION_LABELS,
  PRECISION_LABELS,
  interpolate,
  localizedName,
  localizedLanguage,
  translate,
  translateCopy,
} from '../../lib/i18n';
import { additionalCopy } from '../../lib/i18n/copy';
import { LOCALES } from '../../lib/types';

function componentFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? componentFiles(file) : /\.tsx?$/.test(file) ? [file] : [];
  });
}

describe('six-language UI', () => {
  it('covers every keyed label, event type, region and date precision', () => {
    const labels = [
      ...Object.values(dictionaries.en),
      ...Object.values(EVENT_TYPE_LABELS).map((label) => label.en),
      ...Object.values(REGION_LABELS).map((label) => label.en),
      ...Object.values(PRECISION_LABELS).map((label) => label.en),
    ];
    for (const label of labels) {
      expect(additionalCopy[label], `Missing catalog entry: ${label}`).toBeDefined();
      for (const locale of ['de', 'es', 'zh', 'ru'] as const) {
        expect(additionalCopy[label][locale], `${locale}: ${label}`).toBeTruthy();
      }
    }
    for (const locale of LOCALES) {
      expect(Object.keys(dictionaries[locale])).toEqual(Object.keys(dictionaries.en));
      expect(translate(locale, 'year')).toBeTruthy();
    }
  });

  it('covers all editorial copy actually used by components', () => {
    const missing: string[] = [];
    for (const file of componentFiles(join(process.cwd(), 'components'))) {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      function visit(node: ts.Node) {
        if (ts.isCallExpression(node)) {
          const call = node.expression.getText(source);
          const english = node.arguments[call === 't' ? 1 : call === 'translateCopy' ? 2 : -1];
          if (english && ts.isStringLiteralLike(english) && !additionalCopy[english.text]) {
            missing.push(`${file}: ${english.text}`);
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    expect(missing).toEqual([]);
  });

  it('preserves named interpolation placeholders in all translations', () => {
    for (const [english, translations] of Object.entries(additionalCopy)) {
      const placeholders = [...english.matchAll(/\{\w+\}/g)].map(([value]) => value).sort();
      for (const text of Object.values(translations)) {
        expect([...text.matchAll(/\{\w+\}/g)].map(([value]) => value).sort()).toEqual(placeholders);
      }
    }
    expect(
      translateCopy('zh', 'Voir les {count} événements', 'View all {count} events', { count: 42 }),
    ).toBe('查看全部 42 个事件');
    expect(interpolate('{name} / {name}: {count}', { name: '$&', count: 0 })).toBe('$& / $&: 0');
    expect(interpolate('{missing}', {})).toBe('{missing}');
    expect(interpolate('{toString}', {})).toBe('{toString}');
  });

  it('falls back to documented English names and never invents historical translations', () => {
    const name = { en: 'English source title', fr: 'Titre français', de: 'Deutscher Titel' };
    expect(localizedName(name, 'de')).toBe('Deutscher Titel');
    expect(localizedName(name, 'ru')).toBe('English source title');
    expect(localizedLanguage(name, 'de')).toBe('de');
    expect(localizedLanguage(name, 'fr')).toBe('fr');
    expect(localizedLanguage(name, 'ru')).toBe('en');
    expect(localizedLanguage(name, 'zh')).toBe('en');
    expect(translateCopy('de', 'Texte futur', 'Future copy')).toBe('Future copy');
    expect(translateCopy('fr', 'Texte futur', 'Future copy')).toBe('Texte futur');
  });
});
