/// <reference types="cypress" />

import {
  assertPostLoginDestination,
  fillIonInput,
  superAdminEmail,
  superAdminPassword,
  testEmail,
  testPassword,
  waitForAuthenticatedApp,
} from './helpers';

Cypress.Commands.add('stubRecaptcha', () => {
  cy.intercept('POST', '**/api/auth/verify-recaptcha', {
    statusCode: 200,
    body: { success: true },
  }).as('verifyRecaptcha');
});

Cypress.Commands.add('visitApp', (path = '/') => {
  cy.visit(path);
  cy.get('ion-app', { timeout: 15_000 }).should('exist');
});

Cypress.Commands.add('loginByUi', (email?: string, password?: string) => {
  const resolvedEmail = email ?? testEmail();
  const resolvedPassword = password ?? testPassword();

  cy.stubRecaptcha();
  cy.visitApp('/login');
  fillIonInput('Email', resolvedEmail);
  fillIonInput('Password', resolvedPassword);
  cy.contains('ion-button', 'Sign in').click();
  waitForAuthenticatedApp();
  assertPostLoginDestination();
});

Cypress.Commands.add('loginBySession', (email?: string, password?: string) => {
  const resolvedEmail = email ?? testEmail();
  const resolvedPassword = password ?? testPassword();
  const sessionId = `firmshake-${resolvedEmail}`;

  cy.session(
    sessionId,
    () => {
      cy.loginByUi(resolvedEmail, resolvedPassword);
    },
    {
      validate() {
        cy.visitApp('/tabs/home');
        cy.url({ timeout: 15_000 }).should('not.include', '/login');
      },
    },
  );
});

Cypress.Commands.add('loginSuperAdminBySession', () => {
  const email = superAdminEmail();
  const password = superAdminPassword();
  const sessionId = `firmshake-super-admin-${email}`;

  cy.session(
    sessionId,
    () => {
      cy.loginByUi(email, password);
    },
    {
      validate() {
        cy.visitApp('/tabs/home');
        cy.url({ timeout: 15_000 }).should('not.include', '/login');
      },
    },
  );
});

Cypress.Commands.add('skipIfMfaGate', function skipIfMfaGate() {
  cy.url().then((href) => {
    const path = new URL(href).pathname;
    if (path.includes('/mfa-enroll') || path.includes('/mfa-challenge')) {
      cy.log('Account requires MFA — skipping test (use MFA-enrolled credentials)');
      this.skip();
    }
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      stubRecaptcha(): Chainable<void>;
      visitApp(path?: string): Chainable<void>;
      loginByUi(email?: string, password?: string): Chainable<void>;
      loginBySession(email?: string, password?: string): Chainable<void>;
      loginSuperAdminBySession(): Chainable<void>;
      skipIfMfaGate(): Chainable<void>;
    }
  }
}

export {};
