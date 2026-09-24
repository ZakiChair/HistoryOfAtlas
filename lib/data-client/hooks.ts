'use client';
import { useEffect, useState } from 'react';
import { onJsonRecovered, readJson } from './index';

export function useJson<T>(path: string | null) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: Boolean(path),
  });
  useEffect(() => {
    let live = true;
    if (!path) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    setState({ data: null, error: null, loading: true });
    const read = () =>
      readJson<T>(path)
        .then((data) => {
          if (live) setState({ data, error: null, loading: false });
        })
        .catch((error: Error) => {
          if (live) setState({ data: null, error: error.message, loading: false });
        });
    void read();
    // Another reader's retry (the map's Try again) fixes this copy too, without a reload.
    const unsubscribe = onJsonRecovered(path, read);
    return () => {
      live = false;
      unsubscribe();
    };
  }, [path]);
  return state;
}
