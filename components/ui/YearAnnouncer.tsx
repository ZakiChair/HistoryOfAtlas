'use client';

import { useEffect, useRef, useState } from 'react';
import { useAtlasStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import { formatYear } from '@/lib/histdate';
import { createYearAnnouncer } from '@/lib/year-announcer';

/**
 * Invisible status line telling screen reader users where a keyboard or timeline change
 * landed, for instance « 1816 · territoires dans la vue : 12 ». Silent during playback.
 */
export default function YearAnnouncer({
  territories,
  muted = false,
}: {
  /** Territories currently drawn in the viewport, as listed in the notebook. */
  territories: number;
  muted?: boolean;
}) {
  const { locale, t } = useI18n();
  const [message, setMessage] = useState('');
  const latest = useRef({ locale, t, territories, muted });
  useEffect(() => {
    latest.current = { locale, t, territories, muted };
  }, [locale, t, territories, muted]);

  useEffect(() => {
    const announcer = createYearAnnouncer({
      getState: useAtlasStore.getState,
      subscribe: (listener) => useAtlasStore.subscribe(listener),
      muted: () => latest.current.muted,
      announce: (year) => {
        const { locale, t, territories } = latest.current;
        const date = formatYear(year, locale);
        setMessage(
          territories
            ? t(
                '{year} · territoires dans la vue : {count}',
                '{year} · territories in view: {count}',
                {
                  year: date,
                  count: territories.toLocaleString(locale),
                },
              )
            : date,
        );
      },
    });
    return announcer.dispose;
  }, []);

  return (
    <div className="sr-only" role="status" aria-atomic="true" data-testid="year-announcer">
      {message}
    </div>
  );
}
