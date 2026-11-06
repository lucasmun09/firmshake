import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Lockstep contracts between web stackHosts and firmshake-api stack_config
 * when the sibling repo is checked out next to this one (local/agent machines).
 * Skips cleanly in CI clones that only have the web repo.
 */

const webRoot = process.cwd();
const apiStackConfig = join(webRoot, '..', 'firmshake-api', 'services', 'stack_config.py');
const apiPaymentsFlag = join(webRoot, '..', 'firmshake-api', 'services', 'payments_flag.py');

const siblingPresent = existsSync(apiStackConfig);

describe.skipIf(!siblingPresent)('dual-stack cross-repo lockstep (web ↔ API)', () => {
  const stackHosts = readFileSync(join(webRoot, 'src/common/config/stackHosts.ts'), 'utf8');
  const paymentsFlag = readFileSync(join(webRoot, 'src/common/config/paymentsFlag.ts'), 'utf8');
  const apiStack = readFileSync(apiStackConfig, 'utf8');
  const apiPayments = readFileSync(apiPaymentsFlag, 'utf8');

  it('shares Firebase project IDs', () => {
    expect(stackHosts).toMatch(/DEVO_FIREBASE_PROJECT_ID = 'firmshake-dev'/);
    expect(stackHosts).toMatch(/PROD_FIREBASE_PROJECT_ID = 'firmshake-prod'/);
    expect(apiStack).toMatch(/DEVO_FIREBASE_PROJECT_ID = "firmshake-dev"/);
    expect(apiStack).toMatch(/PROD_FIREBASE_PROJECT_ID = "firmshake-prod"/);
  });

  it('keeps control panel on deovo only', () => {
    expect(stackHosts).toMatch(/firmshake-controlpanel\.web\.app/);
    expect(apiStack).toMatch(/firmshake-controlpanel\.web\.app/);
    expect(apiStack).toMatch(/PROD_CORS_ORIGINS = \(/);
    const prodBlock = apiStack.slice(apiStack.indexOf('PROD_CORS_ORIGINS'));
    const prodTuple = prodBlock.slice(0, prodBlock.indexOf(')'));
    expect(prodTuple).not.toMatch(/controlpanel/);
  });

  it('lists the same prod public hostnames in CORS + web denylist', () => {
    expect(stackHosts).toMatch(/firm-shake\.com/);
    expect(stackHosts).toMatch(/www\.firm-shake\.com/);
    expect(apiStack).toMatch(/https:\/\/firm-shake\.com/);
    expect(apiStack).toMatch(/https:\/\/www\.firm-shake\.com/);
    expect(apiStack).toMatch(/https:\/\/firmshake-prod\.web\.app/);
  });

  it('uses matching payments-disabled user copy prefix', () => {
    expect(paymentsFlag).toMatch(/Deposit payment is unavailable/);
    expect(apiPayments).toMatch(/Deposit payment is unavailable/);
  });

  it('keeps API health + smoke scripts aligned with stack field names', () => {
    const healthPayload = readFileSync(
      join(webRoot, '..', 'firmshake-api', 'services', 'health_payload.py'),
      'utf8',
    );
    const smoke = readFileSync(
      join(webRoot, '..', 'firmshake-api', 'scripts', 'smoke-health.sh'),
      'utf8',
    );
    for (const field of ['stack', 'firebaseProjectId', 'paymentsEnabled']) {
      expect(healthPayload).toContain(field);
      expect(smoke).toContain(field);
    }
  });

  it('keeps API CI soft-gated and payments-off on prod env YAML', () => {
    const apiWorkflow = readFileSync(
      join(webRoot, '..', 'firmshake-api', 'docs/ci-workflows/deploy-api.yml'),
      'utf8',
    );
    const prodYaml = readFileSync(
      join(webRoot, '..', 'firmshake-api', '.cloudrun.env.prod.yaml'),
      'utf8',
    );
    expect(apiWorkflow).toMatch(/vars\.PROD_DEPLOY_ENABLED == 'true'/);
    expect(prodYaml).toMatch(/PAYMENTS_ENABLED:\s*'false'/);
    expect(prodYaml).not.toMatch(/^STRIPE_/m);
  });
});
