/** One map update in flight; superseded playback years never accumulate. */
export function createRenderQueue<T>(options: {
  apply: (value: T) => void;
  isReady: () => boolean;
  requestRender: () => void;
}) {
  let active = false;
  let pending: { value: T } | undefined;
  let disposed = false;

  const apply = (value: T) => {
    active = true;
    options.apply(value);
    options.requestRender();
  };

  return {
    submit(value: T, interrupt = false) {
      if (disposed) return;
      if (active && !interrupt) {
        pending = { value };
        return;
      }
      pending = undefined;
      apply(value);
    },
    rendered() {
      if (disposed || !active || !options.isReady()) return;
      active = false;
      if (pending) {
        const { value } = pending;
        pending = undefined;
        apply(value);
      }
    },
    dispose() {
      disposed = true;
      pending = undefined;
    },
  };
}
