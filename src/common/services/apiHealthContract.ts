/**
 * Dual-stack /health + /ready JSON contract (no secrets).
 * Pure validators — usable by unit tests and Cypress soft checks.
 */

export type ApiStackIdentity = 'devo' | 'prod' | 'unknown';

export interface ApiHealthPayload {
  status: string;
  service: string;
  stack?: ApiStackIdentity | string;
  firebaseProjectId?: string;
  paymentsEnabled?: boolean;
  ready?: boolean;
}

export const API_HEALTH_REQUIRED_FIELDS = [
  'status',
  'service',
  'stack',
  'firebaseProjectId',
  'paymentsEnabled',
] as const;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseApiHealthPayload(raw: unknown): ApiHealthPayload | null {
  if (!isRecord(raw)) {
    return null;
  }
  if (typeof raw.status !== 'string' || typeof raw.service !== 'string') {
    return null;
  }
  const payload: ApiHealthPayload = {
    status: raw.status,
    service: raw.service,
  };
  if (typeof raw.stack === 'string') {
    payload.stack = raw.stack;
  }
  if (typeof raw.firebaseProjectId === 'string') {
    payload.firebaseProjectId = raw.firebaseProjectId;
  }
  if (typeof raw.paymentsEnabled === 'boolean') {
    payload.paymentsEnabled = raw.paymentsEnabled;
  }
  if (typeof raw.ready === 'boolean') {
    payload.ready = raw.ready;
  }
  return payload;
}

export function hasDualStackHealthFields(payload: ApiHealthPayload): boolean {
  return (
    typeof payload.stack === 'string' &&
    typeof payload.firebaseProjectId === 'string' &&
    typeof payload.paymentsEnabled === 'boolean'
  );
}

export function assertDevoHealthContract(payload: ApiHealthPayload): string[] {
  const errors: string[] = [];
  if (payload.status !== 'ok') errors.push(`status=${payload.status}`);
  if (payload.service !== 'firmshake-api') errors.push(`service=${payload.service}`);
  if (!hasDualStackHealthFields(payload)) {
    return errors;
  }
  if (payload.stack !== 'devo') errors.push(`stack=${payload.stack}`);
  if (payload.firebaseProjectId !== 'firmshake-dev') {
    errors.push(`firebaseProjectId=${payload.firebaseProjectId}`);
  }
  if (payload.paymentsEnabled !== true) errors.push(`paymentsEnabled=${payload.paymentsEnabled}`);
  return errors;
}

export function assertProdHealthContract(payload: ApiHealthPayload): string[] {
  const errors: string[] = [];
  if (payload.status !== 'ok') errors.push(`status=${payload.status}`);
  if (payload.service !== 'firmshake-api') errors.push(`service=${payload.service}`);
  if (!hasDualStackHealthFields(payload)) {
    return errors;
  }
  if (payload.stack !== 'prod') errors.push(`stack=${payload.stack}`);
  if (payload.firebaseProjectId !== 'firmshake-prod') {
    errors.push(`firebaseProjectId=${payload.firebaseProjectId}`);
  }
  if (payload.paymentsEnabled !== false) errors.push(`paymentsEnabled=${payload.paymentsEnabled}`);
  return errors;
}

export function assertReadyContract(payload: ApiHealthPayload): string[] {
  const errors = payload.stack === 'prod'
    ? assertProdHealthContract(payload)
    : assertDevoHealthContract(payload);
  if (payload.ready !== true) {
    errors.push(`ready=${String(payload.ready)}`);
  }
  return errors;
}
