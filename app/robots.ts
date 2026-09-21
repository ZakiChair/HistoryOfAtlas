import type { MetadataRoute } from 'next';
export const dynamic = 'force-static';
export default function robots(): MetadataRoute.Robots {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://historyofatlas.vercel.app').replace(
    /\/$/,
    '',
  );
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/data/', '/geo/', '/glyphs/'] },
    sitemap: `${origin}/sitemap.xml`,
  };
}
