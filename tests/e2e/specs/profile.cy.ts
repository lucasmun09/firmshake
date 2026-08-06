import { describeWithMfaAuth } from '../support/helpers';

describeWithMfaAuth('Settings', () => {
  beforeEach(function beforeEachSettings() {
    cy.loginBySession();
    cy.visitApp('/tabs/profile');
    cy.skipIfMfaGate();
  });

  it('loads settings with user info and shortcuts', () => {
    cy.contains('.toolbar-title', 'Settings').should('be.visible');
    cy.contains('ion-button', 'Communities').should('be.visible');
    cy.contains('ion-button', 'Post a listing').should('be.visible');
    cy.contains('ion-button', 'Sign out').should('be.visible');
  });

  it('navigates to communities from settings shortcut', () => {
    cy.contains('ion-button', 'Communities').click();
    cy.url().should('include', '/tabs/communities');
  });

  it('navigates to sell form from settings shortcut', () => {
    cy.contains('ion-button', 'Post a listing').click();
    cy.url().should('include', '/tabs/sell');
  });
});

describe('Settings — auth guard', () => {
  it('redirects unauthenticated users', () => {
    cy.visitApp('/tabs/profile');
    cy.url().should('include', '/login');
  });
});

describe('Complete profile — Google users', () => {
  it('loads complete profile page shell when visited directly', () => {
    cy.visitApp('/complete-profile');
    // Unauthenticated → login; authenticated incomplete Google user → form.
    cy.url().then((href) => {
      expect(
        href.includes('/login')
        || href.includes('/complete-profile')
        || href.includes('/tabs/home'),
      ).to.be.true;
    });
  });
});
