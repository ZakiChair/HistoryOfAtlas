'use client';

import { timelineReadingNote } from '@/lib/i18n/timeline-reading-notes';
import type { Locale } from '@/lib/types';
import styles from './Timeline.module.css';

export default function TimelineReadingNotes({ locale }: { locale: Locale }) {
  return (
    <div className={styles.explanation}>
      <p>{timelineReadingNote(locale, 'scale')}</p>
      <p>{timelineReadingNote(locale, 'bars')}</p>
      <p>{timelineReadingNote(locale, 'periods')}</p>
    </div>
  );
}
