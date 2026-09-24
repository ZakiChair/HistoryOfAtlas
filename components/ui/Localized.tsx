import type { HTMLAttributes } from 'react';
import { localizedName } from '@/lib/i18n';
import type { Locale, LocalizedName } from '@/lib/types';

type LocalizedTag = 'span' | 'strong' | 'p';

/** Language of the text that `localizedName` shows. */
function shownLanguage(value: LocalizedName, locale: Locale, enLanguage?: string): string {
  return locale !== 'en' && value[locale] !== undefined ? locale : (enLanguage ?? 'en');
}

/**
 * Shows a record's text in the reader's language when a translation is sourced, otherwise
 * its English text, and declares the language actually shown so that screen readers
 * pronounce an English fallback as English inside a Chinese or Russian interface.
 */
export default function Localized({
  value,
  locale,
  enLanguage,
  as: Tag = 'span',
  ...props
}: {
  value: LocalizedName;
  locale: Locale;
  /** Language of the `en` slot when the source had no English label (`nameLanguage`). */
  enLanguage?: string;
  as?: LocalizedTag;
} & Omit<HTMLAttributes<HTMLElement>, 'children' | 'lang' | 'dir'>) {
  return (
    <Tag {...props} lang={shownLanguage(value, locale, enLanguage)} dir="auto">
      {localizedName(value, locale)}
    </Tag>
  );
}
