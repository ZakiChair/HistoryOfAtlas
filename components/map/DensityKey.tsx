'use client';

import { useI18n } from '@/lib/i18n';
import { HEAT_COLOR_STOPS } from './heat-style';

const RAMP = `linear-gradient(to right, transparent, ${HEAT_COLOR_STOPS.map(
  ([density, color]) => `${color} ${density * 100}%`,
).join(', ')})`;

/** Key for the event heatmap: brighter always means more events, weighted by importance. */
export default function DensityKey() {
  const { t } = useI18n();
  return (
    <figure className="density-key" data-testid="density-key">
      <figcaption>
        {t('Densité d’événements pondérée par importance', 'Event density weighted by importance')}
      </figcaption>
      <div className="density-key-ramp" style={{ background: RAMP }} aria-hidden="true" />
      <div className="density-key-scale">
        <span>{t('Moins', 'Fewer')}</span>
        <span>{t('Plus', 'More')}</span>
      </div>
      <p>
        {t(
          'Compte tous les événements au-dessus du seuil d’importance choisi, quel que soit le zoom.',
          'Counts every event above the chosen importance threshold, at any zoom.',
        )}
      </p>
    </figure>
  );
}
