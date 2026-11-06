/**
 * Meetup deposit payments flag (web).
 *
 * This phase ships **without a payment processor**. Prod must bake
 * `VITE_PAYMENTS_ENABLED=false`. Devo may leave the flag enabled so agreement
 * flows can use **mock** deposit confirmation only — never real Stripe/live keys.
 * See docs/devo-prod-stacks.md.
 */

function parseEnvFlag(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }
  return undefined;
}

/**
 * Meetup deposit payments UI / client gate.
 *
 * Default when unset: **enabled** (devo/local mock deposits).
 * Prod builds must set `VITE_PAYMENTS_ENABLED=false` (no processor this phase).
 * Alias: `VITE_STRIPE_PAYMENTS_ENABLED` wins when set.
 */
export function isPaymentsEnabled(options?: {
  paymentsEnabled?: string;
  stripePaymentsEnabled?: string;
}): boolean {
  const stripeAlias = parseEnvFlag(
    options?.stripePaymentsEnabled ??
      (import.meta.env.VITE_STRIPE_PAYMENTS_ENABLED as string | undefined),
  );
  if (stripeAlias !== undefined) {
    return stripeAlias;
  }
  const explicit = parseEnvFlag(
    options?.paymentsEnabled ?? (import.meta.env.VITE_PAYMENTS_ENABLED as string | undefined),
  );
  if (explicit !== undefined) {
    return explicit;
  }
  return true;
}

/** User-facing copy when deposit CTAs are gated off (no processor this phase). */
export const PAYMENTS_DISABLED_USER_MESSAGE = 'Deposit payment is unavailable.';
