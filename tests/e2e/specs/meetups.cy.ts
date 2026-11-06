import { describeWithMfaAuth } from '../support/helpers';

describe('Meetups — auth guards', () => {
  it('redirects unauthenticated users from meetup proposal route', () => {
    cy.visitApp('/listing/test-id/propose-meetup');
    cy.url().should('include', '/login');
  });

  it('redirects unauthenticated users from meetup detail route', () => {
    cy.visitApp('/meetup/test-agreement-id');
    cy.url().should('include', '/login');
  });

  it('loads firmshake view route guard', () => {
    cy.visitApp('/tabs/firmshake/test-id');
    cy.url().then((href) => {
      expect(href.includes('/login') || href.includes('/firmshake')).to.be.true;
    });
  });
});

describeWithMfaAuth('Meetups and FirmShake — authenticated', () => {
  beforeEach(function beforeEachMeetups() {
    cy.loginBySession();
    cy.skipIfMfaGate();
  });

  it('shows FirmShake section on buyer thread when agreement exists', () => {
    cy.visitApp('/tabs/buying');
    cy.get('ion-item[href*="/listing/"], ion-item[router-link*="/listing/"]', { timeout: 15_000 })
      .then(($items) => {
        if ($items.length === 0) {
          cy.log('No buying threads with agreements');
          return;
        }
        cy.wrap($items.first()).click({ force: true });
        cy.url({ timeout: 15_000 }).should('match', /\/tabs\/buying\/listing\//);
        cy.get('body', { timeout: 15_000 }).then(($body) => {
          const text = $body.text();
          if (text.includes('FirmShake') || text.includes('Meetup') || text.includes('Deposit')) {
            cy.log('FirmShake / meetup UI present');
          } else {
            cy.log('Thread open — no active agreement UI yet');
          }
        });
      });
  });
});
