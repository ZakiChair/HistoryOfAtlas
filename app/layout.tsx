import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://historyofatlas.vercel.app'),
  title: 'HistoryOfAtlas — History through maps',
  description:
    'Explore the world’s military and territorial history. An interactive atlas, a 5,500-year timeline and documented historical events.',
  applicationName: 'HistoryOfAtlas',
  openGraph: {
    title: 'HistoryOfAtlas',
    description: 'History through maps',
    siteName: 'HistoryOfAtlas',
    type: 'website',
    // Pages are rendered in English; declare other locales only once they have their own URLs.
    locale: 'en_US',
    images: ['/opengraph-image'],
  },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#071b29' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
