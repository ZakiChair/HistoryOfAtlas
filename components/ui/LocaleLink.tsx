'use client';

import Link from 'next/link';
import { useEffect, useState, type ComponentProps } from 'react';
import { hrefKeepingLang } from '@/lib/locale-href';

type LocaleLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & { href: string };

/**
 * An atlas link on the static document pages that keeps the reader's `?lang=`. The static HTML
 * and the first client render use the plain href, so hydration matches; the language is added
 * once the page has mounted.
 */
export default function LocaleLink({ href, ...props }: LocaleLinkProps) {
  const [target, setTarget] = useState(href);
  useEffect(() => {
    setTarget(hrefKeepingLang(href, window.location.search));
  }, [href]);
  return <Link {...props} href={target} />;
}
