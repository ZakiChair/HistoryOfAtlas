import { describe, expect, it } from 'vitest';
import { createRenderQueue } from '../../components/map/render-queue';

describe('temporal map backpressure', () => {
  it('lets an archive finish rendering instead of restarting its work every year', () => {
    const applied: number[] = [];
    let ready = false;
    const queue = createRenderQueue<number>({
      apply: (year) => applied.push(year),
      isReady: () => ready,
      requestRender: () => {},
    });
    queue.submit(1799);
    queue.submit(1800);
    queue.submit(1801);
    queue.rendered();
    expect(applied).toEqual([1799]);
    ready = true;
    queue.rendered();
    expect(applied).toEqual([1799, 1801]);
    queue.submit(1802);
    expect(applied).toEqual([1799, 1801]);
    queue.rendered();
    expect(applied).toEqual([1799, 1801, 1802]);
  });

  it('applies a manual jump or pause immediately and discards older queued years', () => {
    const applied: number[] = [];
    const queue = createRenderQueue<number>({
      apply: (year) => applied.push(year),
      isReady: () => true,
      requestRender: () => {},
    });
    queue.submit(1799);
    queue.submit(1801);
    queue.submit(1500, true);
    queue.rendered();
    expect(applied).toEqual([1799, 1500]);
    queue.submit(1501);
    queue.submit(1502);
    queue.dispose();
    queue.rendered();
    queue.submit(1503);
    expect(applied).toEqual([1799, 1500, 1501]);
  });
});
