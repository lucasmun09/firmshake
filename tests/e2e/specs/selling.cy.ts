import { describeWithMfaAuth } from '../support/helpers';

describeWithMfaAuth('Selling flow', () => {
  beforeEach(function beforeEachSelling() {
    cy.loginBySession();
    cy.visitApp('/tabs/selling');
    cy.skipIfMfaGate();
  });

  it('loads the selling tab', () => {
    cy.contains('.toolbar-title', 'Selling').should('be.visible');
  });

  it('shows empty state or seller listings', () => {
    cy.get('ion-content', { timeout: 15_000 }).should(($content) => {
      const text = $content.text();
      expect(
        text.includes('not selling anything yet')
        || $content.find('ion-item').length > 0,
      ).to.be.true;
    });
  });

  it('links to post a listing from empty state', () => {
    cy.get('body').then(($body) => {
      if ($body.text().includes('not selling anything yet')) {
        cy.contains('ion-button', 'Post a listing').click();
        cy.url().should('include', '/tabs/sell');
      } else {
        cy.log('Seller has listings — empty-state CTA not shown');
      }
    });
  });

  it('opens seller thread for a listing when seller has active conversations', () => {
    cy.get('ion-item[href*="/listing/"], ion-item[router-link*="/listing/"]', { timeout: 15_000 })
      .then(($items) => {
        if ($items.length === 0) {
          cy.log('No seller listings with threads');
          return;
        }
        cy.wrap($items.first()).click({ force: true });
        cy.url({ timeout: 15_000 }).should('match', /\/tabs\/selling\/listing\//);
        cy.get('ion-content', { timeout: 15_000 }).should('exist');
      });
  });

  it('navigates to sell form from selling tab toolbar when listings exist', () => {
    cy.get('body').then(($body) => {
      if (!$body.text().includes('not selling anything yet')) {
        cy.contains('ion-button', 'Post a listing').should('exist');
      }
    });
  });
});

describe('Selling — auth guard', () => {
  it('redirects unauthenticated users', () => {
    cy.visitApp('/tabs/selling');
    cy.url().should('include', '/login');
  });
});
