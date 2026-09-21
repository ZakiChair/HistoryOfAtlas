import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import EventPeople from '../../components/panels/EventPeople';
import type { EventPersonLink } from '../../lib/schema';

describe('battle role evidence', () => {
  it('keeps participation evidence when the same person also has a command statement', () => {
    const link: EventPersonLink = {
      personId: 'Q10',
      name: { en: 'Structural person' },
      role: 'commander',
      statementId: 'Q20$command',
      property: 'P4791',
      sourceEntityId: 'Q20',
      sources: [
        { label: 'Command evidence', url: 'https://example.org/command' },
        { label: 'Additional reference', url: 'https://example.org/reference' },
      ],
    };
    const html = renderToStaticMarkup(
      createElement(EventPeople, {
        people: [
          link,
          {
            ...link,
            role: 'participant',
            property: 'P710',
            statementId: 'Q20$participant',
            sources: [
              { label: 'Participation evidence', url: 'https://example.org/participation' },
            ],
          },
        ],
      }),
    );
    expect(html).toContain('https://example.org/command');
    expect(html).toContain('https://example.org/reference');
    expect(html).toContain('https://example.org/participation');
  });
});
