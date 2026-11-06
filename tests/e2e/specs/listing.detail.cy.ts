import { browseListingRowSelector, describeWithMfaAuth } from '../support/helpers';

describeWithMfaAuth('Listing detail — browse and view', () => {
  beforeEach(function beforeEachDetail() {
    cy.loginBySession();
    cy.skipIfMfaGate();
  });

  it('opens listing detail from browse feed when listings exist', () => {
    cy.visitApp('/tabs/home');
    cy.get(browseListingRowSelector, { timeout: 20_000 }).then(($items) => {
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
    cy.get(browseListingRowSelector, { timeout: 20_000 }).then(($items) => {
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
  it('allows guests to open listing detail when a listing exists', () => {
    cy.visitApp('/tabs/home');
    cy.get(browseListingRowSelector, { timeout: 20_000 }).then(($items) => {
      if ($items.length === 0) {
        cy.log('No listings in feed');
        return;
      }
      cy.wrap($items.first()).click();
      cy.url({ timeout: 15_000 }).should('match', /\/listing\//);
      cy.url().should('not.include', '/login');
    });
  });

  it('sets document title from listing name when a listing exists', () => {
    cy.visitApp('/tabs/home');
    cy.get(browseListingRowSelector, { timeout: 20_000 }).then(($items) => {
      if ($items.length === 0) {
        cy.log('No listings in feed');
        return;
      }

      cy.wrap($items.first()).click();
      cy.url({ timeout: 15_000 }).should('match', /\/listing\//);
      cy.get('h1', { timeout: 15_000 })
        .should('be.visible')
        .invoke('text')
        .then((listingTitle) => {
          const trimmed = listingTitle.trim();
          expect(trimmed.length).to.be.greaterThan(0);
          cy.title().should('eq', `firm-shake - ${trimmed}`);
        });
    });
  });

  it('redirects unauthenticated users from edit route', () => {
    cy.visitApp('/listing/test-id/edit');
    cy.url().should('include', '/login');
  });
});
