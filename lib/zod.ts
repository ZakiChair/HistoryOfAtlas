import { config, z } from 'zod';

/**
 * Zod probes for `Function('')` to decide whether to compile its validators. The published atlas
 * is a static export, so its Content-Security-Policy forbids eval and that probe is reported as a
 * violation before Zod falls back on its own. Ask for the interpreted path in the browser; builds
 * and data pipelines keep the faster compiled one.
 *
 * Every schema reads `z` from here rather than from `zod`, so no parse can run unconfigured;
 * tests/unit/zod-config.test.ts holds that line.
 */
if (typeof window !== 'undefined') config({ jitless: true });

export { z };
