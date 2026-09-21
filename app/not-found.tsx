import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="document-page">
      <header className="document-header">
        <span className="eyebrow">HISTORYOFATLAS · 404</span>
        <h1>Beyond our maps.</h1>
        <p>
          This page is not part of the current atlas. Use search to find documented historical
          events.
        </p>
        <Link className="primary-button" href="/">
          Back to exploring →
        </Link>
      </header>
    </main>
  );
}
