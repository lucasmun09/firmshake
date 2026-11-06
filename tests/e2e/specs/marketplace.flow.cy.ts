import {
  browseListingRowSelector,
  describeWithMfaAuth,
  stubListingApi,
} from '../support/helpers';

/**
 * Authenticated marketplace chain without payments.
 * Skips cleanly when CYPRESS_TEST_EMAIL_MFA / PASSWORD are unset.
 */
describeWithMfaAuth('Marketplace flow — browse → detail → saved → messaging → sell', () => {
  beforeEach(function beforeEachMarketplace() {
    cy.loginBySession();
    cy.skipIfMfaGate();
  });

  it('browses feed and opens a listing detail', () => {
    cy.visitApp('/tabs/home');
    cy.get(browseListingRowSelector, { timeout: 25_000 }).then(($items) => {
      expect($items.length, 'browse feed should have listings').to.be.greaterThan(0);
      cy.wrap($items.first()).click();
      cy.url({ timeout: 15_000 }).should('match', /\/listing\//);
      cy.get('h1', { timeout: 15_000 }).should('be.visible');
      cy.contains('Seller:', { timeout: 15_000 }).should('be.visible');
    });
  });

  it('toggles save from listing detail and shows the listing on Saved', () => {
    cy.visitApp('/tabs/home');
    cy.get(browseListingRowSelector, { timeout: 25_000 }).then(($items) => {
      if ($items.length === 0) {
        throw new Error('No browse listings available for saved-flow assertion');
      }

      cy.wrap($items.first()).click();
      cy.url({ timeout: 15_000 }).should('match', /\/listing\//);
      cy.get('h1', { timeout: 15_000 })
        .should('be.visible')
        .invoke('text')
        .then((title) => {
          const trimmed = title.trim();

          cy.get(
            'ion-button[aria-label="Save listing"], ion-button[aria-label="Remove from saved listings"]',
            { timeout: 10_000 },
          )
            .first()
            .then(($btn) => {
              const label = $btn.attr('aria-label') ?? '';
              if (label === 'Save listing') {
                cy.wrap($btn).click({ force: true });
                cy.contains('Listing saved', { timeout: 10_000 }).should('be.visible');
              }
            });

          cy.visitApp('/tabs/savedlistings');
          cy.contains('.toolbar-title', 'Saved').should('be.visible');
          cy.contains(trimmed, { timeout: 15_000 }).should('be.visible');
        });
    });
  });

  it('opens messaging composer on another seller listing when available', () => {
    cy.visitApp('/tabs/home');
    cy.get(browseListingRowSelector, { timeout: 25_000 }).then(($items) => {
      if ($items.length === 0) {
        throw new Error('No browse listings available for messaging assertion');
      }

      cy.wrap($items.first()).click();
      cy.url({ timeout: 15_000 }).should('match', /\/listing\//);

      cy.get('body').then(($page) => {
        if ($page.find('ion-footer .composer').length === 0) {
          cy.log('Composer hidden (likely own listing) — skipping send');
          return;
        }

        cy.get('ion-footer .composer ion-input input, ion-footer .composer ion-input')
          .first()
          .type('Marketplace flow e2e ping');
        cy.contains('ion-footer ion-button', 'Send').click();
        cy.contains('Marketplace flow e2e ping', { timeout: 15_000 }).should('be.visible');
      });
    });
  });

  it('loads sell form without payment processor UI', () => {
    stubListingApi();
    cy.visitApp('/tabs/sell');
    cy.contains('.toolbar-title', /Sell/).should('be.visible');
    cy.get('ion-input[label="Title"]').should('exist');
    cy.get('ion-input[label="Price (USD)"]').should('exist');
    cy.contains(/stripe|payment intent|checkout/i).should('not.exist');
    cy.contains('ion-button', 'Post listing').should('exist');
  });

  it('loads selling and inbox tabs after marketplace activity', () => {
    cy.visitApp('/tabs/selling');
    cy.contains('.toolbar-title', 'Selling').should('be.visible');
    cy.get('ion-content', { timeout: 15_000 }).should('exist');

    cy.visitApp('/tabs/inbox');
    cy.contains('.toolbar-title', 'Inbox').should('be.visible');
    cy.get('ion-content', { timeout: 15_000 }).should('exist');
  });
});
