import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts/preflight-hosting.sh');

function runPreflight(args: string[]): { ok: boolean; out: string } {
  try {
    const out = execFileSync('bash', [SCRIPT, ...args], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    return { ok: true, out };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, out: `${e.stdout ?? ''}${e.stderr ?? e.message ?? ''}` };
  }
}

describe('preflight-hosting.sh', () => {
  it('passes for a valid deovo env file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fs-preflight-'));
    try {
      const envPath = join(dir, '.env.local');
      writeFileSync(
        envPath,
        [
          'VITE_FIREBASE_PROJECT_ID=firmshake-dev',
          'VITE_API_BASE_URL=https://firmshake-api-staging-858269838319.us-central1.run.app',
        ].join('\n'),
      );
      const result = runPreflight(['devo', envPath]);
      expect(result.ok, result.out).toBe(true);
      expect(result.out).toMatch(/Preflight OK/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails for prod env with payments still enabled', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fs-preflight-'));
    try {
      const envPath = join(dir, '.env.production.local');
      writeFileSync(
        envPath,
        [
          'VITE_FIREBASE_PROJECT_ID=firmshake-prod',
          'VITE_API_BASE_URL=https://firmshake-api-abc123.us-east1.run.app',
          'VITE_PAYMENTS_ENABLED=true',
        ].join('\n'),
      );
      const result = runPreflight(['prod', envPath]);
      expect(result.ok).toBe(false);
      expect(result.out).toMatch(/VITE_PAYMENTS_ENABLED/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects unknown stack aliases', () => {
    const result = runPreflight(['staging']);
    expect(result.ok).toBe(false);
    expect(result.out).toMatch(/Unknown stack/i);
  });
});
