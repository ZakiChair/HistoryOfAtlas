import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const nginx = readFileSync(join(root, 'nginx.conf'), 'utf8');
const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};

/** Headers the `server` block sends with every document nginx serves. */
function nginxHeader(name: string): string | undefined {
  const match = new RegExp(`add_header ${name} (?:"([^"]*)"|(\\S+?)) always;`, 'i').exec(nginx);
  return match ? (match[1] ?? match[2]) : undefined;
}

/** Headers Vercel attaches to every path. */
function vercelHeader(name: string): string | undefined {
  return vercel.headers
    .find((rule) => rule.source === '/(.*)')
    ?.headers.find((header) => header.key === name)?.value;
}

const policy = nginxHeader('Content-Security-Policy') ?? '';
const directives = new Map(
  policy
    .split(';')
    .map((directive) => directive.trim().split(/\s+/))
    .filter(([name]) => name)
    .map(([name, ...values]) => [name!, values]),
);

describe('security headers', () => {
  it('sends the same policy from the container and from Vercel', () => {
    for (const name of [
      'Content-Security-Policy',
      'Referrer-Policy',
      'X-Frame-Options',
      'X-Content-Type-Options',
    ]) {
      expect(nginxHeader(name), `nginx.conf: ${name}`).toBeTruthy();
      expect(vercelHeader(name), `vercel.json: ${name}`).toBe(nginxHeader(name));
    }
  });

  it('confines the atlas to its own origin', () => {
    expect(directives.get('default-src')).toEqual(["'self'"]);
    expect(directives.get('base-uri')).toEqual(["'self'"]);
    expect(directives.get('form-action')).toEqual(["'self'"]);
    expect(directives.get('object-src')).toEqual(["'none'"]);
    expect(directives.get('frame-src')).toEqual(["'none'"]);
    expect(directives.get('frame-ancestors')).toEqual(["'self'"]);
    expect(directives.has('upgrade-insecure-requests')).toBe(true);
  });

  it('names every remote source the atlas reads, and no other', () => {
    // Wikipedia summaries and the Commons credits behind them are the only remote reads.
    expect(directives.get('connect-src')).toEqual([
      "'self'",
      'https://commons.wikimedia.org',
      'https://*.wikipedia.org',
    ]);
    expect(directives.get('img-src')).toEqual([
      "'self'",
      'data:',
      'blob:',
      'https://upload.wikimedia.org',
      'https://commons.wikimedia.org',
    ]);
    // The search and clustering workers, and the map's own worker, all come from this origin.
    expect(directives.get('worker-src')).toEqual(["'self'", 'blob:']);
  });

  it('admits no remote script and no dynamic evaluation', () => {
    const scripts = directives.get('script-src') ?? [];
    expect(scripts.filter((source) => source.startsWith('http'))).toEqual([]);
    expect(scripts).not.toContain("'unsafe-eval'");
    expect(scripts).not.toContain("'wasm-unsafe-eval'");
    // The server-rendered payload travels in inline scripts that change with every build, and a
    // static export has no nonce to sign them with.
    expect(scripts).toEqual(["'self'", "'unsafe-inline'"]);
  });
});
