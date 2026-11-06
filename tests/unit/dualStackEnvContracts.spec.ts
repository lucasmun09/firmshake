import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

describe('dual-stack env file contracts', () => {
  it('production example disables payments and targets firmshake-prod', () => {
    const env = read('.env.production.example');
    expect(env).toMatch(/VITE_APP_STACK=prod/);
    expect(env).toMatch(/VITE_FIREBASE_PROJECT_ID=firmshake-prod/);
    expect(env).toMatch(/VITE_PAYMENTS_ENABLED=false/);
    expect(env).toMatch(/VITE_API_BASE_URL=.*us-east1/);
    expect(env).not.toMatch(/firmshake-api-staging/);
    // Active assignment must be firmshake-prod (comments may mention deovo).
    expect(env).toMatch(/^VITE_FIREBASE_PROJECT_ID=firmshake-prod$/m);
  });

  it('devo example env pins VITE_APP_STACK=devo', () => {
    const env = read('.env.devo');
    expect(env).toMatch(/VITE_APP_STACK=devo/);
  });

  it('root .env.example documents dual-stack modes and payments default', () => {
    const env = read('.env.example');
    expect(env).toMatch(/VITE_APP_STACK/);
    expect(env).toMatch(/build:devo|mode `devo`/);
    expect(env).toMatch(/VITE_PAYMENTS_ENABLED/);
    expect(env).toMatch(/firmshake-dev/);
    expect(env).toMatch(/firmshake-prod/);
  });

  it('CI soft-gates prod behind PROD_DEPLOY_ENABLED', () => {
    const workflow = read('.github/workflows/deploy-web.yml');
    expect(workflow).toMatch(/vars\.PROD_DEPLOY_ENABLED == 'true'/);
    expect(workflow).toMatch(/assert-baked-stack\.sh deovo/);
    expect(workflow).toMatch(/assert-baked-stack\.sh prod/);
    expect(workflow).toMatch(/VITE_PAYMENTS_ENABLED: \$\{\{ secrets\.VITE_PAYMENTS_ENABLED \|\| 'false' \}\}/);
    // Soft gate must stay unset by default — never hardcode enabled in env blocks.
    // Comments may document "set … PROD_DEPLOY_ENABLED=true"; ignore #-prefixed lines.
    const activeLines = workflow
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n')
      .replace(/vars\.PROD_DEPLOY_ENABLED == 'true'/g, '');
    expect(activeLines).not.toMatch(/PROD_DEPLOY_ENABLED:\s*['"]?true['"]?/);
    expect(activeLines).not.toMatch(/PROD_DEPLOY_ENABLED\s*=\s*['"]?true['"]?/);
  });

  it('package.json exposes dual-stack deploy + assert scripts', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['build:devo']).toMatch(/--mode devo/);
    expect(pkg.scripts['deploy:hosting:devo']).toMatch(/deploy-devo-hosting/);
    expect(pkg.scripts['deploy:prod']).toMatch(/deploy-prod-hosting/);
    expect(pkg.scripts['assert:stack:devo']).toBeTruthy();
    expect(pkg.scripts['assert:stack:prod']).toBeTruthy();
    expect(pkg.scripts['check:prod-readiness']).toMatch(/check-prod-readiness/);
    expect(pkg.scripts['preflight:hosting:devo']).toMatch(/preflight-hosting/);
    expect(pkg.scripts['preflight:hosting:prod']).toMatch(/preflight-hosting/);
  });

  it('keeps dual-stack modules segmented for parallel agents', () => {
    expect(read('src/common/config/stackHosts.ts')).toMatch(/DEVO_FIREBASE_PROJECT_ID/);
    expect(read('src/common/config/appStack.ts')).toMatch(/resolveAppStack/);
    expect(read('src/common/config/paymentsFlag.ts')).toMatch(/isPaymentsEnabled/);
    expect(read('src/common/config/featureFlags.ts')).toMatch(
      /from '@\/common\/config\/paymentsFlag'/,
    );
  });

  it('documents focused dual-stack runbooks', () => {
    const index = read('docs/devo-prod-stacks.md');
    for (const doc of [
      'prod-cutover-runbook.md',
      'typesense-dual-stack.md',
      'ci-promote-pipeline.md',
      'prod-gcp-scaffold.md',
    ]) {
      expect(index).toContain(doc);
      expect(read(`docs/${doc}`).length).toBeGreaterThan(200);
    }
    expect(read('docs/dual-stack-modules.md')).toMatch(/stackHosts\.ts/);
  });
});
