'use client';

import { useI18n } from '@/lib/i18n';

/** The part of the atlas a boundary protects; it names what failed in the message. */
export type SectionArea = 'map' | 'layers' | 'notebook' | 'detail';

export type SectionAction = { label: string; onClick: () => void };

export type SectionFallbackProps = {
  area: SectionArea;
  /** A way out when retrying does not help: opening the list, closing the panel. */
  action?: SectionAction;
};

/**
 * Shown in place of the failing part only. The surrounding atlas keeps its state, so the year,
 * the camera and the other layers survive a rendering error in one component. Loaded on demand:
 * a reader who meets no error never downloads it.
 */
export default function SectionFallback({
  area,
  action,
  error,
  retry,
}: SectionFallbackProps & { error: unknown; retry: () => void }) {
  const { t } = useI18n();
  const title =
    area === 'map'
      ? t('La carte n’a pas pu s’afficher.', 'The map could not be displayed.')
      : area === 'layers'
        ? t(
            'Les commandes de calques n’ont pas pu s’afficher.',
            'The layer controls could not be displayed.',
          )
        : area === 'notebook'
          ? t(
              'Cette partie du carnet n’a pas pu s’afficher.',
              'This part of the notebook could not be displayed.',
            )
          : t('Ce dossier n’a pas pu s’afficher.', 'This record could not be displayed.');
  // Client errors keep their original message; a server digest arrives without one.
  const detail = error instanceof Error ? error.message : '';
  return (
    <div
      className="section-error"
      role="alert"
      data-area={area}
      data-testid={`section-error-${area}`}
    >
      <p className="section-error-title">{title}</p>
      <p className="section-error-note">
        {t('Le reste de l’atlas continue de fonctionner.', 'The rest of the atlas keeps working.')}
      </p>
      {detail && (
        <p className="section-error-detail" dir="ltr" lang="en">
          {detail}
        </p>
      )}
      <div className="section-error-actions">
        <button type="button" className="primary-button" onClick={() => retry()}>
          {t('Réessayer', 'Try again')}
        </button>
        {action && (
          <button type="button" className="secondary-button" onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
