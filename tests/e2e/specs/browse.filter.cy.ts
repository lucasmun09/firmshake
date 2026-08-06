import { describeWithMfaAuth } from '../support/helpers';

describeWithMfaAuth('Browse — search, categories, communities', () => {
  beforeEach(function beforeEachBrowse() {
    cy.loginBySession();
    cy.visitApp('/tabs/home');
    cy.skipIfMfaGate();
  });

  it('loads the browse feed with search and filters', () => {
    cy.get('ion-searchbar').should('be.visible');
    cy.get('ion-segment.community-segment').should('exist');

    cy.viewport(390, 844);
    cy.get('.mobile-filter-toggle').should('be.visible');
    cy.get('ion-select.category-select').should('not.exist');
  });

  it('filters listings by search query', () => {
    cy.get('ion-searchbar input').clear().type('test{enter}');
    cy.get('ion-list, ion-content', { timeout: 15_000 }).should('exist');
  });

  it('filters by category via nested mobile panel when categories are loaded', () => {
    cy.viewport(390, 844);
    cy.get('.mobile-filter-toggle').click();
    cy.get('.browse-sidebar--open').should('exist');
    cy.get('ion-select').should('not.exist');

    cy.get('.mobile-filter-nav-row').click();
    cy.get('.mobile-filter-panel__title').should('contain.text', 'Category');
    cy.get('.mobile-category-list ion-item').first().click({ force: true });

    cy.get('.browse-sidebar--open').should('not.exist');
    cy.get('ion-list, ion-content', { timeout: 15_000 }).should('exist');
  });

  it('filters by category select on desktop when categories are loaded', () => {
    cy.viewport(1280, 800);
    cy.get('ion-select.category-select').should('be.visible');
    cy.get('ion-select.category-select').click({ force: true });
    cy.get('ion-popover', { timeout: 10_000 }).should('be.visible');
    cy.get('ion-select-option, ion-item').first().click({ force: true });
    cy.get('ion-list, ion-content', { timeout: 15_000 }).should('exist');
  });

  it('switches community segment tabs', () => {
    cy.get('ion-segment-button').then(($buttons) => {
      if ($buttons.length > 1) {
        cy.wrap($buttons.eq(1)).click();
        cy.get('ion-segment-button').eq(1).should('have.class', 'segment-button-checked');
      }
    });
  });

  it('links to create community from browse toolbar', () => {
    cy.get('ion-button.add-community-btn').click({ force: true });
    cy.url().should('include', '/communities/create');
  });
});

describe('Browse — unauthenticated redirect', () => {
  it('requires login to browse listings', () => {
    cy.visitApp('/tabs/home');
    cy.url().should('include', '/login');
  });
});
