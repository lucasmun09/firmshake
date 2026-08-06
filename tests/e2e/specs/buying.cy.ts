import { describeWithMfaAuth } from '../support/helpers';

describeWithMfaAuth('Buying flow', () => {
  beforeEach(function beforeEachBuying() {
    cy.loginBySession();
    cy.visitApp('/tabs/buying');
    cy.skipIfMfaGate();
  });

  it('loads the buying tab', () => {
    cy.contains('.toolbar-title', 'Buying').should('be.visible');
  });

  it('shows empty state or active buying threads', () => {
    cy.get('ion-content', { timeout: 15_000 }).should(($content) => {
      const text = $content.text();
      expect(
        text.includes('No active buying conversations')
        || $content.find('ion-item').length > 0,
      ).to.be.true;
    });
  });

  it('links to browse from buying empty state', () => {
    cy.get('body').then(($body) => {
      if ($body.text().includes('No active buying conversations')) {
        cy.contains('ion-button', 'Browse listings').click();
        cy.url().should('include', '/tabs/home');
      }
    });
  });

  it('opens buyer thread and shows chat when buying conversations exist', () => {
    cy.get('ion-item[href*="/listing/"], ion-item[router-link*="/listing/"]', { timeout: 15_000 })
      .then(($items) => {
        if ($items.length === 0) {
          cy.log('No buying threads — message a listing first');
          return;
        }
        cy.wrap($items.first()).click({ force: true });
        cy.url({ timeout: 15_000 }).should('match', /\/tabs\/buying\/listing\//);
        cy.get('ion-content', { timeout: 15_000 }).should('exist');
      });
  });
});

describe('Buying — auth guard', () => {
  it('redirects unauthenticated users', () => {
    cy.visitApp('/tabs/buying');
    cy.url().should('include', '/login');
  });
});
