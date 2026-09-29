'use client';

/**
 * The route boundary, reached when an error escapes the boundaries inside the atlas. Retrying
 * re-renders in place and reloading restarts from the same address, so the selected year,
 * camera and filters are preserved either way.
 *
 * Kept free of the interface catalog: importing it here would copy it into the boundary's own
 * chunk, which every reader downloads. Like the 404 page, this one stays in English.
 */
export default function AtlasError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="section-error-page">
      <div className="section-error" role="alert" data-area="page" data-testid="section-error-page">
        <p className="section-error-title">This view could not be displayed.</p>
        <p className="section-error-note">Your view is preserved in the page address.</p>
        {(error.message || error.digest) && (
          <p className="section-error-detail" dir="ltr" lang="en">
            {error.message || `Reference: ${error.digest}`}
          </p>
        )}
        <div className="section-error-actions">
          <button type="button" className="primary-button" onClick={() => retry()}>
            Try again
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => window.location.reload()}
          >
            Reload the page
          </button>
        </div>
      </div>
    </main>
  );
}
