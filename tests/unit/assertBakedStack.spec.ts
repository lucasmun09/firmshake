import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts/assert-baked-stack.sh');

function runAssert(args: string[], cwd?: string): { ok: boolean; out: string } {
  try {
    const out = execFileSync('bash', [SCRIPT, ...args], {
      cwd: cwd ?? process.cwd(),
      encoding: 'utf8',
    });
    return { ok: true, out };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, out: `${e.stdout ?? ''}${e.stderr ?? e.message ?? ''}` };
  }
}

describe('assert-baked-stack.sh', () => {
  it('accepts deovo env pointed at firmshake-dev', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fs-assert-'));
    try {
      const envPath = join(dir, '.env.local');
      writeFileSync(
        envPath,
        [
          'VITE_FIREBASE_PROJECT_ID=firmshake-dev',
          'VITE_API_BASE_URL=https://firmshake-api-staging-858269838319.us-central1.run.app',
        ].join('\n'),
      );
      const result = runAssert(['env-devo', envPath]);
      expect(result.ok, result.out).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects prod env with REPLACE-ME API URL', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fs-assert-'));
    try {
      const envPath = join(dir, '.env.production.local');
      writeFileSync(
        envPath,
        [
          'VITE_FIREBASE_PROJECT_ID=firmshake-prod',
          'VITE_API_BASE_URL=https://REPLACE-ME-firmshake-api-XXXX.us-east1.run.app',
          'VITE_PAYMENTS_ENABLED=false',
        ].join('\n'),
      );
      const result = runAssert(['env-prod', envPath]);
      expect(result.ok).toBe(false);
      expect(result.out).toMatch(/REPLACE|prod Cloud Run/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects prod env when payments are still enabled', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fs-assert-'));
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
      const result = runAssert(['env-prod', envPath]);
      expect(result.ok).toBe(false);
      expect(result.out).toMatch(/VITE_PAYMENTS_ENABLED/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects prod env when VITE_PAYMENTS_ENABLED is unset', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fs-assert-'));
    try {
      const envPath = join(dir, '.env.production.local');
      writeFileSync(
        envPath,
        [
          'VITE_FIREBASE_PROJECT_ID=firmshake-prod',
          'VITE_API_BASE_URL=https://firmshake-api-abc123.us-east1.run.app',
        ].join('\n'),
      );
      const result = runAssert(['env-prod', envPath]);
      expect(result.ok).toBe(false);
      expect(result.out).toMatch(/VITE_PAYMENTS_ENABLED/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('accepts complete prod env with payments disabled', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fs-assert-'));
    try {
      const envPath = join(dir, '.env.production.local');
      writeFileSync(
        envPath,
        [
          'VITE_FIREBASE_PROJECT_ID=firmshake-prod',
          'VITE_API_BASE_URL=https://firmshake-api-abc123.us-east1.run.app',
          'VITE_PAYMENTS_ENABLED=false',
        ].join('\n'),
      );
      const result = runAssert(['env-prod', envPath]);
      expect(result.ok, result.out).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects deovo dist that contains prod Firebase hosts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fs-assert-'));
    try {
      mkdirSync(join(dir, 'assets'), { recursive: true });
      writeFileSync(
        join(dir, 'assets', 'app.js'),
        'authDomain:"firmshake-prod.firebaseapp.com";projectId:"firmshake-prod"',
      );
      const result = runAssert(['deovo', dir]);
      expect(result.ok).toBe(false);
      expect(result.out).toMatch(/firmshake-prod/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('accepts deovo dist with firmshake-dev hosts only', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fs-assert-'));
    try {
      mkdirSync(join(dir, 'assets'), { recursive: true });
      writeFileSync(
        join(dir, 'assets', 'app.js'),
        'authDomain:"firmshake-dev.firebaseapp.com";api:"https://firmshake-api-staging-858269838319.us-central1.run.app"',
      );
      const result = runAssert(['deovo', dir]);
      expect(result.ok, result.out).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects prod dist that still points at staging API', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fs-assert-'));
    try {
      mkdirSync(join(dir, 'assets'), { recursive: true });
      writeFileSync(
        join(dir, 'assets', 'app.js'),
        'authDomain:"firmshake-prod.firebaseapp.com";api:"https://firmshake-api-staging-858269838319.us-central1.run.app";Deposit payment is unavailable.',
      );
      const result = runAssert(['prod', dir]);
      expect(result.ok).toBe(false);
      expect(result.out).toMatch(/staging|placeholder/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects prod dist missing payments-disabled UX copy', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fs-assert-'));
    try {
      mkdirSync(join(dir, 'assets'), { recursive: true });
      writeFileSync(
        join(dir, 'assets', 'app.js'),
        'authDomain:"firmshake-prod.firebaseapp.com";api:"https://firmshake-api-abc.us-east1.run.app"',
      );
      const result = runAssert(['prod', dir]);
      expect(result.ok).toBe(false);
      expect(result.out).toMatch(/payments-disabled|unavailable/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('accepts prod dist with prod hosts, no staging, payments-disabled copy', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fs-assert-'));
    try {
      mkdirSync(join(dir, 'assets'), { recursive: true });
      writeFileSync(
        join(dir, 'assets', 'app.js'),
        [
          'authDomain:"firmshake-prod.firebaseapp.com"',
          'api:"https://firmshake-api-abc.us-east1.run.app"',
          'Deposit payment is unavailable.',
        ].join(';'),
      );
      const result = runAssert(['prod', dir]);
      expect(result.ok, result.out).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
