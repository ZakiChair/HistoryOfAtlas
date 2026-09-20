import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Atlas Belli — L’histoire à travers les cartes', description: 'Explorez l’histoire militaire et territoriale du monde. Un atlas interactif, une frise de 5 500 ans et des événements sourcés.', applicationName: 'Atlas Belli', openGraph: { title: 'Atlas Belli', description: 'L’histoire à travers les cartes', type: 'website', locale: 'fr_FR', images: ['/og.svg'] } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#071b29' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="fr"><body>{children}</body></html>; }
