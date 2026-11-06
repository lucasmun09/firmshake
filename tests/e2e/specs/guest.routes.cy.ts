import { browseListingRowSelector, waitForGuestBrowseReady } from '../support/helpers';

describe('Guest routes — desktop tab shell', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);
  });

  afterEach(() => {
    cy.viewport(390, 844);
  });

  it('keeps the tab shell when a guest clicks Buying', () => {
    cy.visitApp('/tabs/home');
    waitForGuestBrowseReady();
    cy.contains('ion-tab-button', 'Buying').click();
    cy.get('ion-alert', { timeout: 10_000 }).should('be.visible');
    cy.contains('ion-alert', 'Sign in required').should('be.visible');
    cy.url().should('include', '/tabs/home');
    cy.get('ion-tab-bar').should('exist');
    cy.contains('ion-alert button', /continue browsing/i).click();
    cy.get('ion-alert').should('not.exist');
  });

  it('keeps the tab shell when a guest clicks Selling', () => {
    cy.visitApp('/tabs/home');
    waitForGuestBrowseReady();
    cy.contains('ion-tab-button', 'Selling').click();
    cy.get('ion-alert', { timeout: 10_000 }).should('be.visible');
    cy.url().should('include', '/tabs/home');
    cy.get('ion-tab-bar').should('exist');
    cy.contains('ion-alert button', /continue browsing/i).click();
  });

  it('keeps the tab shell when a guest clicks Inbox', () => {
    cy.visitApp('/tabs/home');
    waitForGuestBrowseReady();
    cy.contains('ion-tab-button', 'Inbox').click();
    cy.get('ion-alert', { timeout: 10_000 }).should('be.visible');
    cy.url().should('include', '/tabs/home');
    cy.get('ion-tab-bar').should('exist');
    cy.contains('ion-alert button', /continue browsing/i).click();
  });

  it('opens listing detail for guests without forcing login', () => {
    cy.visitApp('/tabs/home');
    waitForGuestBrowseReady();
    cy.get(browseListingRowSelector, { timeout: 20_000 }).then(($items) => {
      if ($items.length === 0) {
        cy.log('No listings in feed — skipping guest listing detail check');
        return;
      }

      cy.wrap($items.first()).click();
      cy.url({ timeout: 15_000 }).should('match', /\/listing\//);
      cy.url().should('not.include', '/login');
      cy.get('h1', { timeout: 15_000 }).should('be.visible');
    });
  });
});

describe('Guest routes — mobile tab bar', () => {
  it('shows Login/Create instead of protected tabs for guests', () => {
    cy.visitApp('/tabs/home');
    cy.contains('ion-tab-button', 'Login/Create').should('be.visible');
    cy.contains('ion-tab-button', 'Buying').should('not.exist');
  });
});
