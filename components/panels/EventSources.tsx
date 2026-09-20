import { ArrowUpRight, BookOpen } from 'lucide-react';
import type { Source } from '@/lib/schema';
import type { Locale } from '@/lib/types';

export default function EventSources({ sources, locale }: { sources: Source[]; locale: Locale }) {
  const unique = [...new Map(sources.map((source) => [source.url, source])).values()];
  return (
    <section
      className="detail-section"
      aria-label={locale === 'fr' ? 'Sources et provenance' : 'Sources and provenance'}
    >
      <h3>
        <BookOpen size={14} /> {locale === 'fr' ? 'Sources & provenance' : 'Sources & provenance'}
      </h3>
      <ul className="sources-list">
        {unique.map((source) => (
          <li key={source.url}>
            <a className="source-link" href={source.url} target="_blank" rel="noreferrer">
              <span>
                {source.label}
                {source.license && <small>{source.license}</small>}
              </span>
              <ArrowUpRight size={15} aria-hidden="true" />
              <span className="sr-only">{locale === 'fr' ? ' (nouvel onglet)' : ' (new tab)'}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
