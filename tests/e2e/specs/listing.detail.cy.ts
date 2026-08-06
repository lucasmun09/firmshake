import { describeWithMfaAuth } from '../support/helpers';

describeWithMfaAuth('Listing detail — browse and view', () => {
  beforeEach(function beforeEachDetail() {
    cy.loginBySession();
    cy.skipIfMfaGate();
  });

  it('opens listing detail from browse feed when listings exist', () => {
    cy.visitApp('/tabs/home');
    cy.get('ion-item[href*="/listing/"]', { timeout: 20_000 }).then(($items) => {
      if ($items.length === 0) {
        cy.log('No listings in feed');
        return;
      }
      cy.wrap($items.first()).click();
      cy.url({ timeout: 15_000 }).should('match', /\/listing\//);
      cy.get('h1', { timeout: 15_000 }).should('be.visible');
    });
  });

  it('shows listing metadata on detail page when feed has listings', () => {
    cy.visitApp('/tabs/home');
    cy.get('ion-item[href*="/listing/"]', { timeout: 20_000 }).then(($items) => {
      if ($items.length === 0) {
        cy.log('No listings in feed');
        return;
      }
      cy.wrap($items.first()).click();
      cy.contains('Seller:', { timeout: 15_000 }).should('be.visible');
      cy.get('.description').should('exist');
    });
  });
});

describe('Listing detail — auth guards', () => {
  it('redirects unauthenticated users from listing detail', () => {
    cy.visitApp('/listing/not-a-real-id');
    cy.url().should('include', '/login');
  });

  it('redirects unauthenticated users from edit route', () => {
    cy.visitApp('/listing/test-id/edit');
    cy.url().should('include', '/login');
  });
});
