import { describe, expect, it } from 'vitest';
import {
  assertDevoHealthContract,
  assertProdHealthContract,
  assertReadyContract,
  hasDualStackHealthFields,
  parseApiHealthPayload,
} from '@/common/services/apiHealthContract';

describe('apiHealthContract', () => {
  it('parses dual-stack /health payloads', () => {
    const payload = parseApiHealthPayload({
      status: 'ok',
      service: 'firmshake-api',
      stack: 'devo',
      firebaseProjectId: 'firmshake-dev',
      paymentsEnabled: true,
    });
    expect(payload).toEqual({
      status: 'ok',
      service: 'firmshake-api',
      stack: 'devo',
      firebaseProjectId: 'firmshake-dev',
      paymentsEnabled: true,
    });
    expect(hasDualStackHealthFields(payload!)).toBe(true);
    expect(assertDevoHealthContract(payload!)).toEqual([]);
  });

  it('accepts legacy payloads without stack fields', () => {
    const payload = parseApiHealthPayload({ status: 'ok', service: 'firmshake-api' });
    expect(payload).toEqual({ status: 'ok', service: 'firmshake-api' });
    expect(hasDualStackHealthFields(payload!)).toBe(false);
    expect(assertDevoHealthContract(payload!)).toEqual([]);
  });

  it('rejects invalid JSON shapes', () => {
    expect(parseApiHealthPayload(null)).toBeNull();
    expect(parseApiHealthPayload('nope')).toBeNull();
    expect(parseApiHealthPayload({ status: 1, service: 'x' })).toBeNull();
  });

  it('asserts prod payments-disabled contract', () => {
    const payload = parseApiHealthPayload({
      status: 'ok',
      service: 'firmshake-api',
      stack: 'prod',
      firebaseProjectId: 'firmshake-prod',
      paymentsEnabled: false,
    })!;
    expect(assertProdHealthContract(payload)).toEqual([]);
    expect(
      assertProdHealthContract({
        ...payload,
        paymentsEnabled: true,
      }),
    ).toContain('paymentsEnabled=true');
  });

  it('requires ready=true for /ready contract', () => {
    const base = {
      status: 'ok',
      service: 'firmshake-api',
      stack: 'devo',
      firebaseProjectId: 'firmshake-dev',
      paymentsEnabled: true,
    } as const;
    expect(assertReadyContract({ ...base, ready: true })).toEqual([]);
    expect(assertReadyContract({ ...base })).toContain('ready=undefined');
  });
});
