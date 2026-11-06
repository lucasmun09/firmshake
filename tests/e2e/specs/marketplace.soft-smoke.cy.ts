import {
  browseListingRowSelector,
  describeWithMfaAuth,
  expectLoginRedirect,
  selectBrowseView,
  waitForGuestBrowseReady,
} from '../support/helpers';

/**
 * Soft marketplace smoke — no payment processor, no destructive mutations.
 * Guest specs always run; MFA specs skip cleanly without credentials.
 * Mark-sold / block paths cancel confirms so deovo data is not mutated.
 */
describe('Marketplace soft smoke — guest mark-sold / map / blocked', () => {
  it('hides mark-as-sold on listing detail for guests', () => {
    cy.visitApp('/tabs/home');
    waitForGuestBrowseReady();
    cy.get(browseListingRowSelector, { timeout: 25_000 }).then(($items) => {
      expect($items.length, 'browse must have at least one listing').to.be.greaterThan(0);
      cy.wrap($items.first()).click();
      cy.url({ timeout: 15_000 }).should('match', /\/listing\//);
      cy.get('h1', { timeout: 15_000 }).should('be.visible');
      cy.get('[data-testid="mark-sold-button"]').should('not.exist');
      cy.contains('ion-button', 'Mark as sold').should('not.exist');
      cy.contains('ion-button', 'Block user').should('not.exist');
    });
  });

  it('switches browse to map view and shows map chrome when Map is offered', () => {
    cy.viewport(1280, 800);
    cy.visitApp('/tabs/home');
    waitForGuestBrowseReady();
    cy.get('ion-searchbar', { timeout: 15_000 }).should('be.visible');

    cy.get('body').then(($body) => {
      const viewSelect = $body.find('ion-select.view-select[aria-label="Browse view"]');
      if (viewSelect.length === 0) {
        cy.log('Browse view selector missing — skipping map soft smoke');
        return;
      }

      cy.wrap(viewSelect).click({ force: true });
      cy.get('body').then(($open) => {
        const hasMap =
          $open.find('ion-select-option, ion-item, ion-radio, button, .action-sheet-button')
            .filter((_i, el) => /^Map$/i.test((el.textContent ?? '').trim())).length > 0;
        if (!hasMap) {
          cy.log('Map view not enabled (BFF browse off) — soft skip');
          cy.get('body').type('{esc}', { force: true });
          return;
        }
        cy.contains(
          'ion-select-option, ion-item, ion-radio, button, .action-sheet-button',
          /^Map$/i,
        )
          .first()
          .click({ force: true });
        cy.get('.browse-map-wrap', { timeout: 15_000 }).should('be.visible');
        cy.get('#browse-map-address-search').should('exist');
        cy.get('.browse-map-view[aria-label="Listings map"]').should('exist');
        cy.contains('ion-button', 'Go to current location').should('exist');
      });
    });
  });

  it('redirects guests from blocked users settings', () => {
    cy.visitApp('/tabs/blockedusers');
    expectLoginRedirect('/tabs/blockedusers');
  });
});

describeWithMfaAuth('Marketplace soft smoke — mark-sold / blocked / map (MFA)', () => {
  beforeEach(function beforeEachSoftSmoke() {
    cy.loginBySession();
    cy.skipIfMfaGate();
  });

  it('shows mark-as-sold confirm on own active listing and cancels without mutating', () => {
    cy.visitApp('/tabs/selling');
    cy.contains('.toolbar-title', 'Selling', { timeout: 15_000 }).should('be.visible');

    cy.get('ion-content', { timeout: 15_000 }).then(($content) => {
      const text = $content.text();
      if (text.includes('not selling anything yet')) {
        cy.log('No seller listings — soft skip mark-sold confirm');
        return;
      }

      cy.get(
        'ion-item[href*="/listing/"], a[href*="/listing/"], ion-item[router-link*="/listing/"]',
        { timeout: 15_000 },
      )
        .first()
        .click({ force: true });

      cy.url({ timeout: 15_000 }).should('match', /\/(listing|tabs\/selling)/);

      // Selling thread route → open public listing detail for moderation CTAs.
      cy.url().then((href) => {
        const match =
          href.match(/\/tabs\/selling\/listing\/([^/?#]+)/)
          || href.match(/\/listing\/([^/?#]+)/);
        if (match && href.includes('/tabs/selling/listing/')) {
          cy.visitApp(`/listing/${match[1]}`);
        }
      });

      cy.get('body').then(($page) => {
        const hasMarkSold =
          $page.find('[data-testid="mark-sold-button"]').length > 0
          || /Mark as sold/i.test($page.text());
        if (!hasMarkSold) {
          cy.log('Mark as sold not shown (sold/removed or not seller) — soft skip');
          return;
        }

        cy.get('[data-testid="mark-sold-button"]').should('be.visible').click();
        cy.contains('ion-alert', 'Mark as sold?', { timeout: 10_000 }).should('be.visible');
        cy.contains(
          'ion-alert',
          'This removes the listing from browse and tells buyers it is no longer available.',
        ).should('be.visible');
        cy.contains('ion-alert button, .alert-button', 'Cancel').click({ force: true });
        cy.get('[data-testid="mark-sold-button"]').should('be.visible');
        cy.contains('Listing marked as sold').should('not.exist');
        cy.contains(/This listing has been marked as sold/).should('not.exist');
      });
    });
  });

  it('loads blocked users page empty or list state', () => {
    cy.visitApp('/tabs/blockedusers');
    cy.contains('.toolbar-title', 'Blocked Users', { timeout: 15_000 }).should('be.visible');
    cy.get('ion-content', { timeout: 15_000 }).should(($content) => {
      const text = $content.text();
      expect(
        text.includes('You have not blocked anyone')
          || $content.find('ion-item').length > 0,
      ).to.be.true;
    });
  });

  it('offers Block user on another seller listing when composer is present', () => {
    cy.visitApp('/tabs/home');
    cy.get(browseListingRowSelector, { timeout: 25_000 }).then(($items) => {
      expect($items.length).to.be.greaterThan(0);
      cy.wrap($items.first()).click();
      cy.url({ timeout: 15_000 }).should('match', /\/listing\//);

      cy.get('body').then(($page) => {
        if ($page.find('ion-footer .composer').length === 0) {
          cy.log('Own listing or no composer — soft skip block CTA');
          return;
        }
        cy.contains('ion-button', /Block user|Unblock user/).should('be.visible');
      });
    });
  });

  it('switches authenticated browse to map view when Map is offered', () => {
    cy.viewport(1280, 800);
    cy.visitApp('/tabs/home');
    cy.get('ion-searchbar', { timeout: 15_000 }).should('be.visible');

    cy.get('body').then(($body) => {
      if ($body.find('ion-select.view-select[aria-label="Browse view"]').length === 0) {
        cy.log('Browse view selector missing — soft skip');
        return;
      }

      selectBrowseView('Map');
      cy.get('body').then(($after) => {
        if ($after.find('.browse-map-wrap').length === 0) {
          cy.log('Map option unavailable — soft skip');
          return;
        }
        cy.get('.browse-map-wrap').should('be.visible');
        cy.get('#browse-map-address-search').should('exist');
        cy.get('.browse-map-view[aria-label="Listings map"]').should('exist');
      });
    });
  });
});
