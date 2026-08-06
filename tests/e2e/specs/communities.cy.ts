import {
  describeWithMfaAuth,
  describeWithSuperAdmin,
  fillIonInput,
} from '../support/helpers';

describeWithMfaAuth('Communities — join, create, moderators', () => {
  beforeEach(function beforeEachCommunities() {
    cy.loginBySession();
    cy.visitApp('/tabs/communities');
    cy.skipIfMfaGate();
  });

  it('loads communities page sections', () => {
    cy.contains('h3', 'Find a community').should('be.visible');
    cy.contains('h3', 'My communities').should('be.visible');
    cy.contains('h3', 'Create a community').should('be.visible');
    cy.contains('ion-button', 'Create community').should('be.visible');
  });

  it('searches for a community by name', () => {
    fillIonInput('Community name', 'ALL');
    cy.contains('ion-button', 'Search').click();
    cy.get('.search-result', { timeout: 15_000 }).should('exist');
  });

  it('opens create community form', () => {
    cy.contains('ion-button', 'Create community').first().click();
    cy.url().should('include', '/communities/create');
    cy.get('ion-input[label="Name"]').should('exist');
    cy.get('ion-textarea[label="Description"]').should('exist');
  });

  it('creates a user community with a unique name', () => {
    const name = `Cypress ${Date.now()}`;
    cy.visitApp('/communities/create');
    fillIonInput('Name', name);
    fillIonInput('Description', 'Temporary e2e community — safe to delete.');
    cy.contains('ion-button', 'Create community').click();
    cy.url({ timeout: 20_000 }).should('include', '/tabs/communities');
    cy.contains(name, { timeout: 15_000 }).should('be.visible');
  });

  it('joins an existing community from search results when available', () => {
    fillIonInput('Community name', 'Bay');
    cy.contains('ion-button', 'Search').click();
    cy.get('body', { timeout: 15_000 }).then(($body) => {
      const text = $body.text();
      if (text.includes('Join ') && $body.find('.search-result ion-button').length > 0) {
        cy.get('.search-result ion-button').contains('Join').first().click();
        cy.contains('Joined community', { timeout: 15_000 }).should('exist');
      } else {
        cy.log('No joinable community matched search — skipping join assertion');
      }
    });
  });
});

describeWithSuperAdmin('Communities — moderator management (super admin)', () => {
  beforeEach(function beforeEachModerators() {
    cy.loginSuperAdminBySession();
    cy.visitApp('/tabs/communities');
    cy.skipIfMfaGate();
  });

  it('shows moderator panel on the ALL community for super admins', () => {
    cy.get('.moderator-panel', { timeout: 15_000 }).should('exist');
    cy.contains('Grant moderator').should('be.visible');
  });

  it('grants moderator by email when candidate exists', function grantModerator() {
    const candidateEmail = Cypress.env('MODERATOR_CANDIDATE_EMAIL');
    if (!candidateEmail) {
      cy.log('Set CYPRESS_MODERATOR_CANDIDATE_EMAIL to run grant flow');
      this.skip();
    }

    cy.get('.moderator-panel').first().within(() => {
      fillIonInput('User email', String(candidateEmail));
      cy.contains('ion-button', 'Grant moderator').click();
    });
    cy.contains('Moderator access granted', { timeout: 15_000 }).should('be.visible');
  });
});

describe('Communities — auth guard', () => {
  it('redirects unauthenticated users', () => {
    cy.visitApp('/tabs/communities');
    cy.url().should('include', '/login');
  });
});
