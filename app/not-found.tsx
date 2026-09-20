import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="document-page">
      <header className="document-header">
        <span className="eyebrow">ATLAS BELLI · 404</span>
        <h1>Hors de nos cartes.</h1>
        <p>
          Cette page ne figure pas dans la version actuelle de l’atlas. La recherche permet de
          retrouver les événements documentés.
        </p>
        <Link className="primary-button" href="/">
          Revenir à l’exploration →
        </Link>
      </header>
    </main>
  );
}
