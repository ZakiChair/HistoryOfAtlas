import type { MetadataRoute } from 'next';
import { CRAWL_DISALLOW } from '@/lib/seo';
export const dynamic = 'force-static';
export default function robots(): MetadataRoute.Robots {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://historyofatlas.vercel.app').replace(
    /\/$/,
    '',
  );
  return {
    rules: { userAgent: '*', allow: '/', disallow: CRAWL_DISALLOW },
    sitemap: `${origin}/sitemap.xml`,
  };
}
