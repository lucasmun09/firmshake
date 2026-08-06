import { describeWithMfaAuth, fillIonInput, isOnPath } from '../support/helpers';

describe('MFA enrollment and challenge', () => {
  it('loads MFA enrollment page shell when visited directly (redirects if unauthenticated)', () => {
    cy.visitApp('/mfa-enroll');
    cy.url().then((href) => {
      if (isOnPath(href, '/mfa-enroll')) {
        cy.contains('ion-title', 'Verify phone number').should('be.visible');
        cy.contains('Send verification code').should('be.visible');
      } else {
        cy.url().should('include', '/login');
      }
    });
  });

  it('loads MFA challenge page with verification UI shell', () => {
    cy.visitApp('/mfa-challenge');
    cy.contains('ion-title', 'Verify sign-in').should('be.visible');
  });
});

describeWithMfaAuth('MFA — enrolled account bypasses enrollment gate', () => {
  it('lands on home after login without MFA enrollment redirect', () => {
    cy.loginBySession();
    cy.visitApp('/tabs/home');
    cy.url({ timeout: 30_000 }).should('include', '/tabs/home');
    cy.url().should('not.include', '/mfa-enroll');
  });
});

describe('MFA — SMS flows (manual / Firebase test phones)', () => {
  // Real SMS MFA cannot run in CI without Firebase test phone numbers.
  // Configure in Firebase Console → Authentication → Settings → Phone numbers for testing.
  it.skip('enrolls SMS MFA with Firebase test phone (+1 650-555-3434 / code 123456)', () => {
    cy.loginBySession();
    cy.visitApp('/mfa-enroll');
    fillIonInput('Phone number', '+16505553434');
    cy.contains('Send verification code').click();
    fillIonInput('Verification code', '123456');
    cy.contains('Verify and continue').click();
    cy.url({ timeout: 30_000 }).should('include', '/tabs/home');
  });

  it.skip('completes MFA challenge on login with test phone OTP', () => {
    cy.visitApp('/login');
    // Use an account with MFA enrolled + matching Firebase test phone mapping.
  });
});
