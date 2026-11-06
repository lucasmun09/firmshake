import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONTROLPANEL_HOSTING_ORIGIN,
  DEVO_HOSTING_HOSTNAMES,
  PROD_HOSTING_HOSTNAMES,
  PROD_PUBLIC_HOSTNAMES,
} from '@/common/config/stackHosts';

/**
 * CORS catalog lockstep: web host constants ↔ firmshake-api stack_config + Cloud Run YAML.
 * Skips when the sibling API checkout is absent (CI web-only clones).
 */

const webRoot = process.cwd();
const apiRoot = join(webRoot, '..', 'firmshake-api');
const apiStackConfig = join(apiRoot, 'services', 'stack_config.py');
const siblingPresent = existsSync(apiStackConfig);

function yamlCorsOrigins(rel: string): string[] {
  const text = readFileSync(join(apiRoot, rel), 'utf8');
  const match = text.match(/^CORS_ORIGINS:\s*['"]?(.*?)['"]?\s*$/m);
  expect(match, `CORS_ORIGINS missing in ${rel}`).toBeTruthy();
  return (match?.[1] ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

function pythonTupleOrigins(source: string, constName: string): string[] {
  const controlpanelMatch = source.match(/CONTROLPANEL_ORIGIN\s*=\s*"([^"]+)"/);
  const controlpanel = controlpanelMatch?.[1] ?? '';
  const start = source.indexOf(`${constName} = (`);
  expect(start, `${constName} missing`).toBeGreaterThanOrEqual(0);
  const slice = source.slice(start);
  const end = slice.indexOf(')');
  const block = slice.slice(0, end);
  const origins: string[] = [];
  for (const line of block.split('\n')) {
    const lit = line.match(/"(https?:\/\/[^"]+|capacitor:\/\/[^"]+|ionic:\/\/[^"]+)"/);
    if (lit?.[1]) {
      origins.push(lit[1]);
      continue;
    }
    if (/\bCONTROLPANEL_ORIGIN\b/.test(line) && controlpanel) {
      origins.push(controlpanel);
    }
  }
  return origins;
}

function originForHost(host: string): string {
  return `https://${host}`;
}

describe.skipIf(!siblingPresent)('dual-stack CORS catalog lockstep (web ↔ API YAML)', () => {
  const stackPy = readFileSync(apiStackConfig, 'utf8');
  const deovoYaml = yamlCorsOrigins('.cloudrun.env.yaml');
  const prodYaml = yamlCorsOrigins('.cloudrun.env.prod.yaml');
  const deovoCatalog = pythonTupleOrigins(stackPy, 'DEVO_CORS_ORIGINS_TRANSITIONAL');
  const prodCatalog = pythonTupleOrigins(stackPy, 'PROD_CORS_ORIGINS');
  const postCutover = pythonTupleOrigins(stackPy, 'DEVO_CORS_ORIGINS_POST_CUTOVER');

  it('keeps Cloud Run YAML CORS identical to stack_config catalogs', () => {
    expect(deovoYaml).toEqual(deovoCatalog);
    expect(prodYaml).toEqual(prodCatalog);
  });

  it('includes every deovo Hosting hostname in transitional deovo CORS', () => {
    for (const host of DEVO_HOSTING_HOSTNAMES) {
      expect(deovoYaml).toContain(originForHost(host));
      expect(deovoCatalog).toContain(originForHost(host));
    }
  });

  it('includes every prod Hosting + public hostname in prod CORS', () => {
    for (const host of PROD_HOSTING_HOSTNAMES) {
      expect(prodYaml).toContain(originForHost(host));
      expect(prodCatalog).toContain(originForHost(host));
    }
    for (const host of PROD_PUBLIC_HOSTNAMES) {
      expect(prodYaml).toContain(originForHost(host));
      expect(prodCatalog).toContain(originForHost(host));
    }
  });

  it('keeps control panel on deovo CORS only', () => {
    expect(deovoYaml).toContain(CONTROLPANEL_HOSTING_ORIGIN);
    expect(deovoCatalog).toContain(CONTROLPANEL_HOSTING_ORIGIN);
    expect(postCutover).toContain(CONTROLPANEL_HOSTING_ORIGIN);
    expect(prodYaml).not.toContain(CONTROLPANEL_HOSTING_ORIGIN);
    expect(prodCatalog).not.toContain(CONTROLPANEL_HOSTING_ORIGIN);
  });

  it('keeps transitional deovo CORS with prod public domains until cutover', () => {
    for (const host of PROD_PUBLIC_HOSTNAMES) {
      expect(deovoYaml).toContain(originForHost(host));
      expect(postCutover).not.toContain(originForHost(host));
    }
  });

  it('never lists firmshake-dev origins on prod CORS', () => {
    for (const host of DEVO_HOSTING_HOSTNAMES) {
      expect(prodYaml).not.toContain(originForHost(host));
    }
  });
});
