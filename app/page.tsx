import type { Metadata } from 'next';
import AtlasApp from '@/components/AtlasApp';

export const metadata: Metadata = { alternates: { canonical: '/' } };

export default function Home() {
  return <AtlasApp />;
}
