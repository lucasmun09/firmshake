import { describeWithMfaAuth } from '../support/helpers';

describeWithMfaAuth('Messages — inbox and threads', () => {
  beforeEach(function beforeEachMessages() {
    cy.loginBySession();
    cy.skipIfMfaGate();
  });

  it('loads the inbox tab', () => {
    cy.visitApp('/tabs/inbox');
    cy.contains('.toolbar-title', 'Inbox').should('be.visible');
    cy.get('ion-content').should('exist');
  });

  it('shows empty state or thread list', () => {
    cy.visitApp('/tabs/inbox');
    cy.get('ion-content', { timeout: 15_000 }).should(($content) => {
      const text = $content.text();
      expect(
        text.includes('No messages yet')
        || text.includes('buyer')
        || text.includes('seller')
        || $content.find('ion-item').length > 0,
      ).to.be.true;
    });
  });

  it('navigates to browse from inbox empty state CTA', () => {
    cy.visitApp('/tabs/inbox');
    cy.get('body').then(($body) => {
      if ($body.text().includes('No messages yet')) {
        cy.contains('ion-button', 'Browse listings').click();
        cy.url().should('include', '/tabs/home');
      }
    });
  });

  it('sends a message from a listing detail when another seller listing exists', () => {
    cy.visitApp('/tabs/home');
    cy.get('ion-item[href*="/listing/"]', { timeout: 20_000 }).then(($items) => {
      if ($items.length === 0) {
        cy.log('No browse listings — post one via listing.upload spec first');
        return;
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
          .type('Hi from Cypress e2e');
        cy.contains('ion-footer ion-button', 'Send').click();
        cy.contains('Hi from Cypress e2e', { timeout: 15_000 }).should('be.visible');
      });
    });
  });

  it('opens an inbox thread when conversations exist', () => {
    cy.visitApp('/tabs/inbox');
    cy.get('ion-item[href*="/listing/"]', { timeout: 15_000 }).then(($items) => {
      if ($items.length === 0) {
        cy.log('No inbox threads yet');
        return;
      }
      cy.wrap($items.first()).click();
      cy.url().should('match', /\/tabs\/inbox\/listing\//);
    });
  });
});

describe('Messages — auth guard', () => {
  it('redirects unauthenticated users from inbox', () => {
    cy.visitApp('/tabs/inbox');
    cy.url().should('include', '/login');
  });
});
