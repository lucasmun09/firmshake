import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts/check-prod-readiness.sh');

function runReadiness(env: Record<string, string>): { ok: boolean; out: string; code: number } {
  try {
    const out = execFileSync('bash', [SCRIPT], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, ...env },
    });
    return { ok: true, out, code: 0 };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string; message?: string };
    return {
      ok: false,
      out: `${e.stdout ?? ''}${e.stderr ?? e.message ?? ''}`,
      code: typeof e.status === 'number' ? e.status : 1,
    };
  }
}

function writeCompleteWebEnv(path: string) {
  writeFileSync(
    path,
    [
      'VITE_FIREBASE_PROJECT_ID=firmshake-prod',
      'VITE_API_BASE_URL=https://firmshake-api-abc123.us-east1.run.app',
      'VITE_PAYMENTS_ENABLED=false',
      'VITE_RECAPTCHA_SITE_KEY=6LeFakeWebKey',
    ].join('\n'),
  );
}

function writeCompleteApiEnv(path: string) {
  writeFileSync(
    path,
    [
      'FIREBASE_PROJECT_ID: firmshake-prod',
      'GCS_BUCKET: firmshake-prod-images',
      "CORS_ORIGINS: 'https://firm-shake.com,https://www.firm-shake.com,https://firmshake-prod.web.app,https://firmshake-prod.firebaseapp.com,capacitor://localhost,ionic://localhost'",
      "PAYMENTS_ENABLED: 'false'",
      "RECAPTCHA_SITE_KEY: '6LeFakeProdKeyForAssertTestsOnly'",
      "# TYPESENSE_HOST: 'https://YOUR-PROD-TYPESENSE-HOST'",
    ].join('\n'),
  );
}

describe('check-prod-readiness.sh', () => {
  it('reports ALL blockers including RECAPTCHA + REPLACE-ME API URL', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fs-ready-'));
    try {
      const webEnv = join(dir, 'web.env');
      const apiRoot = join(dir, 'firmshake-api');
      const apiScripts = join(apiRoot, 'scripts');
      mkdirSync(apiScripts, { recursive: true });
      const apiEnv = join(apiRoot, '.cloudrun.env.prod.yaml');

      writeFileSync(
        webEnv,
        [
          'VITE_FIREBASE_PROJECT_ID=firmshake-prod',
          'VITE_API_BASE_URL=https://REPLACE-ME-firmshake-api-XXXX.us-east1.run.app',
          'VITE_PAYMENTS_ENABLED=false',
        ].join('\n'),
      );
      writeFileSync(
        apiEnv,
        [
          'FIREBASE_PROJECT_ID: firmshake-prod',
          'GCS_BUCKET: firmshake-prod-images',
          "CORS_ORIGINS: 'https://firm-shake.com,https://www.firm-shake.com,https://firmshake-prod.web.app,https://firmshake-prod.firebaseapp.com,capacitor://localhost,ionic://localhost'",
          "PAYMENTS_ENABLED: 'false'",
          "RECAPTCHA_SITE_KEY: 'REPLACE_ME_PROD_RECAPTCHA_SITE_KEY'",
        ].join('\n'),
      );
      // Minimal stub assert so readiness can call it without depending on real sibling layout.
      writeFileSync(
        join(apiScripts, 'assert-cloudrun-env.sh'),
        "#!/usr/bin/env bash\necho 'stub assert fail' >&2\nexit 1\n",
      );
      chmodSync(join(apiScripts, 'assert-cloudrun-env.sh'), 0o755);

      const result = runReadiness({
        FIRMSHAKE_PROD_ENV: webEnv,
        FIRMSHAKE_API_ROOT: apiRoot,
        FIRMSHAKE_API_PROD_ENV: apiEnv,
      });

      expect(result.ok).toBe(false);
      expect(result.out).toMatch(/VITE_API_BASE_URL/);
      expect(result.out).toMatch(/RECAPTCHA_SITE_KEY/);
      expect(result.out).toMatch(/REPLACE_ME_PROD_RECAPTCHA_SITE_KEY/);
      expect(result.out).toMatch(/NOT READY/);
      // Collect-all: both blockers present in one run.
      expect(result.out).toMatch(/BLOCKER:.*VITE_API_BASE_URL/s);
      expect(result.out).toMatch(/BLOCKER:.*RECAPTCHA_SITE_KEY/s);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exits 0 when web + API prod envs are complete', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fs-ready-ok-'));
    try {
      const webEnv = join(dir, 'web.env');
      const apiRoot = join(dir, 'firmshake-api');
      const apiScripts = join(apiRoot, 'scripts');
      mkdirSync(apiScripts, { recursive: true });
      const apiEnv = join(apiRoot, '.cloudrun.env.prod.yaml');

      writeCompleteWebEnv(webEnv);
      writeCompleteApiEnv(apiEnv);
      writeFileSync(
        join(apiScripts, 'assert-cloudrun-env.sh'),
        "#!/usr/bin/env bash\necho 'OK: stub prod'\nexit 0\n",
      );
      chmodSync(join(apiScripts, 'assert-cloudrun-env.sh'), 0o755);

      const result = runReadiness({
        FIRMSHAKE_PROD_ENV: webEnv,
        FIRMSHAKE_API_ROOT: apiRoot,
        FIRMSHAKE_API_PROD_ENV: apiEnv,
      });

      expect(result.ok, result.out).toBe(true);
      expect(result.out).toMatch(/READY/);
      expect(result.out).not.toMatch(/^BLOCKER:/m);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('live workspace currently blocks on known placeholders', () => {
    // Integration against real sibling files when present — documents the human gate.
    const result = runReadiness({});
    expect(result.ok).toBe(false);
    expect(result.out).toMatch(/RECAPTCHA_SITE_KEY|REPLACE/);
    expect(result.out).toMatch(/NOT READY/);
  });
});
