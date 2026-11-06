import {
  browseListingRowSelector,
  waitForGuestBrowseReady,
} from '../support/helpers';

/**
 * Guest-safe marketplace path (no payments, no auth secrets required):
 * browse → detail → auth walls for saved / messaging / sell.
 */
describe('Marketplace flow — guest browse → detail → auth walls', () => {
  it('loads browse feed for guests', () => {
    cy.visitApp('/tabs/home');
    waitForGuestBrowseReady();
    cy.get('ion-searchbar').should('be.visible');
    cy.url().should('include', '/tabs/home');
  });

  it('opens listing detail from browse without forcing login', () => {
    cy.visitApp('/tabs/home');
    waitForGuestBrowseReady();
    cy.get(browseListingRowSelector, { timeout: 25_000 }).then(($items) => {
      expect($items.length, 'deovo/local browse must have at least one listing').to.be.greaterThan(
        0,
      );
      cy.wrap($items.first()).click();
      cy.url({ timeout: 15_000 }).should('match', /\/listing\//);
      cy.url().should('not.include', '/login');
      cy.get('h1', { timeout: 15_000 }).should('be.visible');
      cy.contains('Seller:', { timeout: 15_000 }).should('be.visible');
    });
  });

  it('allows guests to open saved listings (local-only bookmarks)', () => {
    // Intentional: route meta guestAccessible — sync stays signed-in-only.
    cy.visitApp('/tabs/savedlistings');
    cy.url().should('include', '/tabs/savedlistings');
    cy.url().should('not.include', '/login');
    cy.get('ion-content', { timeout: 15_000 }).should(($content) => {
      const text = $content.text();
      expect(
        text.includes('No saved listings yet')
          || $content.find('ion-item, a[href*="/listing/"]').length > 0,
      ).to.be.true;
    });
    cy.contains('ion-tab-button', 'Saved').should('have.class', 'tab-selected');
  });

  it('redirects guests from sell create to login', () => {
    cy.visitApp('/tabs/sell');
    cy.url().should('include', '/login');
  });

  it('redirects guests from inbox to login', () => {
    cy.visitApp('/tabs/inbox');
    cy.url().should('include', '/login');
  });

  it('redirects guests from buying and selling tabs to login', () => {
    cy.visitApp('/tabs/buying');
    cy.url().should('include', '/login');
    cy.visitApp('/tabs/selling');
    cy.url().should('include', '/login');
  });
});
