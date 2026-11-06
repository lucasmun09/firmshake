import { describeWithMfaAuth, fillIonInput, isOnPath } from '../support/helpers';

describeWithMfaAuth('Auth — email login', () => {
  it('signs in with email and password', () => {
    cy.loginByUi();
    cy.url({ timeout: 30_000 }).should('include', '/tabs/home');
    cy.contains('ion-tab-button', 'Browse').should('be.visible');
  });

  it('persists session via cy.session', () => {
    cy.loginBySession();
    cy.visitApp('/tabs/home');
    cy.url().should('include', '/tabs/home');
    cy.get('ion-searchbar').should('be.visible');
  });

  it('signs out from settings', () => {
    cy.loginBySession();
    cy.visitApp('/tabs/profile');
    cy.contains('ion-button', 'Sign out').click();
    cy.url({ timeout: 15_000 }).should('include', '/login');
  });
});

describe('Auth — email login (MFA gate detection)', () => {
  it('attempts login and documents MFA redirect when account is not enrolled', function attemptLogin() {
    const email = Cypress.env('TEST_EMAIL');
    const password = Cypress.env('TEST_PASSWORD');
    if (!email || !password) {
      this.skip();
    }

    cy.loginByUi(String(email), String(password));
    cy.url({ timeout: 30_000 }).then((href) => {
      if (isOnPath(href, '/mfa-enroll')) {
        cy.contains('Verify phone number').should('be.visible');
        cy.log('Account hit MFA enrollment — use CYPRESS_TEST_EMAIL_MFA for full authenticated specs');
      } else {
        cy.url().should('include', '/tabs/home');
      }
    });
  });
});

describe('Auth — invalid credentials', () => {
  it('shows an error for wrong password', () => {
    cy.visitApp('/login');
    fillIonInput('Email', 'not-a-real-user@firmshake.dev');
    fillIonInput('Password', 'wrong-password-xyz');
    cy.contains('ion-button', 'Sign in').click();
    cy.get('.error', { timeout: 15_000 }).should('be.visible');
    cy.url().should('include', '/login');
  });
});
