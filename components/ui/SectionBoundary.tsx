'use client';

import { Component, Fragment, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import type { SectionFallbackProps } from './SectionFallback';

// The boundary is in the shell because it wraps the atlas; its message is not, because most
// readers never see it. `catchError` from `next/error` does the same work, but costs 2.7 kB
// gzip in the initial shell, which `pnpm measure:bundle` does not have to spare.
const SectionFallback = dynamic(() => import('./SectionFallback'));

/** Next signals `notFound()` and `redirect()` by throwing; the router owns those, not this. */
function isRouterError(value: unknown): boolean {
  const digest = (value as { digest?: unknown } | null | undefined)?.digest;
  return typeof digest === 'string' && digest.startsWith('NEXT_');
}

type SectionBoundaryState = { caught: { value: unknown } | null; attempt: number };

/**
 * Contains a rendering error to the children it wraps, so the rest of the atlas keeps its year,
 * camera and layers. Give it a `key` to clear a previous error on a new selection.
 */
export default class SectionBoundary extends Component<
  SectionFallbackProps & { children?: ReactNode },
  SectionBoundaryState
> {
  state: SectionBoundaryState = { caught: null, attempt: 0 };

  static getDerivedStateFromError(error: unknown): Partial<SectionBoundaryState> {
    if (isRouterError(error)) throw error;
    return { caught: { value: error } };
  }

  private retry = () => this.setState((state) => ({ caught: null, attempt: state.attempt + 1 }));

  render() {
    const { children, ...props } = this.props;
    if (this.state.caught)
      return <SectionFallback {...props} error={this.state.caught.value} retry={this.retry} />;
    // A retry remounts the children, so their effects run again from a clean state.
    return <Fragment key={this.state.attempt}>{children}</Fragment>;
  }
}
