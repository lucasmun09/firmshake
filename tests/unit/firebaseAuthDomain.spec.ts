import { describe, expect, it } from 'vitest';

import {
  buildAllowedFirebaseAuthHostnames,
  buildFirebaseAuthRedirectUri,
  isAuthDomainCrossOrigin,
  listRequiredGoogleOAuthRedirectUris,
  resolveFirebaseAuthDomain,
} from '@/common/services/firebaseAuthDomain';

describe('resolveFirebaseAuthDomain', () => {
  it('keeps configured authDomain on localhost', () => {
    expect(
      resolveFirebaseAuthDomain({
        configuredAuthDomain: 'firmshake-dev.firebaseapp.com',
        pageHostname: 'localhost',
        projectId: 'firmshake-dev',
      }),
    ).toBe('firmshake-dev.firebaseapp.com');
  });

  it('uses custom production hostname so redirect is same-site', () => {
    expect(
      resolveFirebaseAuthDomain({
        configuredAuthDomain: 'firmshake-dev.firebaseapp.com',
        pageHostname: 'firm-shake.com',
        projectId: 'firmshake-dev',
      }),
    ).toBe('firm-shake.com');
  });

  it('uses www custom domain when that is the page host', () => {
    expect(
      resolveFirebaseAuthDomain({
        configuredAuthDomain: 'firmshake-dev.firebaseapp.com',
        pageHostname: 'www.firm-shake.com',
        projectId: 'firmshake-dev',
      }),
    ).toBe('www.firm-shake.com');
  });

  it('uses project web.app host when the app is served from Hosting', () => {
    expect(
      resolveFirebaseAuthDomain({
        configuredAuthDomain: 'firmshake-dev.firebaseapp.com',
        pageHostname: 'firmshake-dev.web.app',
        projectId: 'firmshake-dev',
      }),
    ).toBe('firmshake-dev.web.app');
  });

  it('falls back to configured domain for unknown hosts', () => {
    expect(
      resolveFirebaseAuthDomain({
        configuredAuthDomain: 'firmshake-dev.firebaseapp.com',
        pageHostname: 'evil.example.com',
        projectId: 'firmshake-dev',
      }),
    ).toBe('firmshake-dev.firebaseapp.com');
  });
});

describe('buildAllowedFirebaseAuthHostnames', () => {
  it('includes project hosting hosts and custom domains', () => {
    const allowed = buildAllowedFirebaseAuthHostnames({
      configuredAuthDomain: 'firmshake-dev.firebaseapp.com',
      projectId: 'firmshake-dev',
    });
    expect(allowed.has('firmshake-dev.firebaseapp.com')).toBe(true);
    expect(allowed.has('firmshake-dev.web.app')).toBe(true);
    expect(allowed.has('firm-shake.com')).toBe(true);
    expect(allowed.has('www.firm-shake.com')).toBe(true);
  });
});

describe('isAuthDomainCrossOrigin', () => {
  it('detects authDomain vs page origin mismatch', () => {
    expect(
      isAuthDomainCrossOrigin({
        authDomain: 'firmshake-dev.firebaseapp.com',
        pageOrigin: 'https://firm-shake.com',
      }),
    ).toBe(true);
  });

  it('is false when authDomain matches page host', () => {
    expect(
      isAuthDomainCrossOrigin({
        authDomain: 'firm-shake.com',
        pageOrigin: 'https://firm-shake.com/login',
      }),
    ).toBe(false);
  });
});

describe('buildFirebaseAuthRedirectUri', () => {
  it('builds the Firebase auth handler URL', () => {
    expect(buildFirebaseAuthRedirectUri('firm-shake.com')).toBe(
      'https://firm-shake.com/__/auth/handler',
    );
    expect(buildFirebaseAuthRedirectUri('https://firmshake-dev.web.app/')).toBe(
      'https://firmshake-dev.web.app/__/auth/handler',
    );
  });
});

describe('listRequiredGoogleOAuthRedirectUris', () => {
  it('lists project and custom domain handlers for deovo', () => {
    const uris = listRequiredGoogleOAuthRedirectUris({ projectId: 'firmshake-dev' });
    expect(uris).toContain('https://firmshake-dev.firebaseapp.com/__/auth/handler');
    expect(uris).toContain('https://firmshake-dev.web.app/__/auth/handler');
    expect(uris).toContain('https://firm-shake.com/__/auth/handler');
    expect(uris).toContain('https://www.firm-shake.com/__/auth/handler');
  });
});
