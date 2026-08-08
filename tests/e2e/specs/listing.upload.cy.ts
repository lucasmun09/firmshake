import { describeWithMfaAuth, fillIonInput, selectIonOption, stubListingApi, attachListingPhoto } from '../support/helpers';

describeWithMfaAuth('Listing upload — create listing', () => {
  beforeEach(function beforeEachListing() {
    cy.loginBySession();
    stubListingApi();
    cy.visitApp('/tabs/sell');
    cy.skipIfMfaGate();
  });

  it('loads the sell form with required fields', () => {
    cy.contains('.toolbar-title', 'FirmShake - Sell on FirmShake').should('be.visible');
    cy.get('ion-input[label="Title"]').should('exist');
    cy.get('ion-textarea[label="Description"]').should('exist');
    cy.get('ion-input[label="Price (USD)"]').should('exist');
    cy.get('ion-select[label="Category"]').should('exist');
    cy.get('ion-select[label="Communities"]').should('exist');
  });

  it('shows backend wait modal when API health check is slow', () => {
    cy.intercept('GET', '**/health', (req) => {
      req.reply({
        delay: 2500,
        statusCode: 200,
        body: { ok: true },
      });
    }).as('slowApiHealth');

    cy.visitApp('/tabs/sell');
    cy.get('ion-modal.backend-wait-modal', { timeout: 10_000 }).should('be.visible');
    cy.contains('Connecting to FirmShake').should('be.visible');
    cy.wait('@slowApiHealth');
    cy.get('ion-modal.backend-wait-modal', { timeout: 10_000 }).should('not.be.visible');
  });

  it('validates submit stays disabled until required fields are filled', () => {
    cy.contains('ion-button', 'Post listing').should('be.disabled');
    fillIonInput('Title', 'E2E Draft Listing');
    fillIonInput('Description', 'Created by Cypress — delete if seen.');
    fillIonInput('Price (USD)', '25');
    cy.contains('ion-button', 'Post listing').should('be.disabled');
  });

  it('posts a listing end-to-end with stubbed image upload API', () => {
    cy.fixture('test-data').then((data) => {
      fillIonInput('Title', `${data.listingTitle} ${Date.now()}`);
      fillIonInput('Description', data.listingDescription);
      fillIonInput('Price (USD)', String(data.listingPrice));
      selectIonOption('Category', 'General');
      attachListingPhoto();
      cy.contains('ion-button', 'Post listing', { timeout: 15_000 }).should('not.be.disabled');
      cy.contains('ion-button', 'Post listing').click();
      cy.wait('@imageUpload');
      cy.url({ timeout: 30_000 }).should('match', /\/listing\//);
      cy.contains('Listing posted!', { timeout: 10_000 }).should('be.visible');
    });
  });
});

describe('Listing upload — auth guard', () => {
  it('redirects unauthenticated users from sell page', () => {
    cy.visitApp('/tabs/sell');
    cy.url().should('include', '/login');
  });
});
