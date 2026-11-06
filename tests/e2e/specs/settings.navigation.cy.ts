import { describeWithMfaAuth, expectLoginRedirect } from '../support/helpers';

describeWithMfaAuth('Settings — navigation and toolbar', () => {
  beforeEach(function beforeEachSettingsNav() {
    cy.loginBySession();
    cy.skipIfMfaGate();
  });

  it('opens settings from the profile menu without errors', () => {
    cy.visitApp('/tabs/home');
    cy.get('[data-testid="toolbar-profile-menu"]', { timeout: 15_000 }).click();
    cy.get('[data-testid="toolbar-menu-settings"]', { timeout: 10_000 }).click();
    cy.url({ timeout: 15_000 }).should('include', '/tabs/profile');
    cy.url().should('not.include', '/internal-error');
    cy.contains('.toolbar-title', 'FirmShake - Settings').should('be.visible');
    cy.contains('ion-button', 'Sign out').should('be.visible');
  });

  it('shows trimmed AppTopToolbar title on settings sub-pages', () => {
    cy.visitApp('/tabs/blockedusers');
    cy.contains('.toolbar-title', 'FirmShake - Blocked Users').should('be.visible');
    cy.get('ion-back-button').should('exist');
    cy.url().should('not.include', '/internal-error');
  });

  it('navigates to blocked users from settings shortcut', () => {
    cy.visitApp('/tabs/profile');
    cy.contains('ion-button', 'Blocked users').click();
    cy.url().should('include', '/tabs/blockedusers');
    cy.contains('.toolbar-title', 'FirmShake - Blocked Users').should('be.visible');
  });
});

describe('Settings — auth guard', () => {
  it('redirects unauthenticated users with redirect query', () => {
    cy.visitApp('/tabs/profile');
    expectLoginRedirect('/tabs/profile');
  });
});
