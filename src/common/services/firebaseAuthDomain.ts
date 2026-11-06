/**
 * Resolve Firebase `authDomain` so Google `signInWithRedirect` can complete on
 * custom hosting domains.
 *
 * Redirect uses a hidden iframe against `authDomain`. When the page origin is
 * `https://firm-shake.com` but `authDomain` is `*.firebaseapp.com`, mobile Chrome
 * third-party storage partitioning often makes `getRedirectResult` return null
 * even after a successful OAuth round-trip.
 *
 * Prefer the current hostname when it is a known FirmShake / Firebase Hosting
 * origin so `/__/auth/handler` is same-site with the app.
 */

function isLocalDevHostname(hostname: string): boolean {
  return (
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '[::1]'
    || hostname.endsWith('.localhost')
  );
}

export function buildAllowedFirebaseAuthHostnames(options: {
  configuredAuthDomain?: string | null;
  projectId?: string | null;
}): Set<string> {
  const allowed = new Set<string>();
  const configured = options.configuredAuthDomain?.trim().toLowerCase();
  if (configured) {
    allowed.add(configured);
  }

  const projectId = options.projectId?.trim().toLowerCase();
  if (projectId) {
    allowed.add(`${projectId}.web.app`);
    allowed.add(`${projectId}.firebaseapp.com`);
  }

  // Production custom domains attached to Firebase Hosting.
  allowed.add('firm-shake.com');
  allowed.add('www.firm-shake.com');

  return allowed;
}

export function resolveFirebaseAuthDomain(options: {
  configuredAuthDomain?: string | null;
  pageHostname?: string | null;
  projectId?: string | null;
}): string | undefined {
  const configured = options.configuredAuthDomain?.trim() || undefined;
  const hostname = options.pageHostname?.trim().toLowerCase() || undefined;

  if (!hostname || isLocalDevHostname(hostname)) {
    return configured;
  }

  const allowed = buildAllowedFirebaseAuthHostnames({
    configuredAuthDomain: configured,
    projectId: options.projectId,
  });

  if (allowed.has(hostname)) {
    return hostname;
  }

  return configured;
}

/** OAuth redirect URI Firebase sends to Google for signInWithRedirect. */
export function buildFirebaseAuthRedirectUri(authDomain: string): string {
  const host = authDomain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  return `https://${host}/__/auth/handler`;
}

/**
 * Redirect URIs that must exist on the Firebase auto-created OAuth 2.0 Web client
 * when the app resolves authDomain to each hosting hostname (see resolveFirebaseAuthDomain).
 *
 * Custom domains (`firm-shake.com` / `www`) belong on the **prod** OAuth client after
 * Hosting cutover. Pass `includeCustomDomains: true` for deovo only while those domains
 * still serve firmshake-dev.
 */
export function listRequiredGoogleOAuthRedirectUris(options: {
  projectId?: string | null;
  includeCustomDomains?: boolean;
}): string[] {
  const uris = new Set<string>();
  const projectId = options.projectId?.trim().toLowerCase();

  if (projectId) {
    uris.add(buildFirebaseAuthRedirectUri(`${projectId}.firebaseapp.com`));
    uris.add(buildFirebaseAuthRedirectUri(`${projectId}.web.app`));
  }

  const includeCustom =
    options.includeCustomDomains === true
    || (options.includeCustomDomains !== false && projectId === 'firmshake-prod');

  if (includeCustom) {
    uris.add(buildFirebaseAuthRedirectUri('firm-shake.com'));
    uris.add(buildFirebaseAuthRedirectUri('www.firm-shake.com'));
  }

  return [...uris].sort();
}

export function isAuthDomainCrossOrigin(options: {
  authDomain?: string | null;
  pageOrigin?: string | null;
}): boolean {
  const authDomain = options.authDomain?.trim().toLowerCase();
  const pageOrigin = options.pageOrigin?.trim();
  if (!authDomain || !pageOrigin) {
    return false;
  }

  try {
    const pageHost = new URL(pageOrigin).hostname.toLowerCase();
    return pageHost !== authDomain;
  } catch {
    return false;
  }
}
