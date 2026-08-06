describe('Auth smoke — public routes', () => {
  it('redirects unauthenticated mobile web users from root to browse', () => {
    cy.visitApp('/');
    cy.url({ timeout: 15_000 }).should('include', '/tabs/home');
    cy.contains('ion-tab-button', 'Login/Create').should('be.visible');
    cy.contains('ion-tab-button', 'Buying').should('not.exist');
  });

  it('redirects unauthenticated desktop web users from root to landing', () => {
    cy.viewport(1280, 800);
    cy.visitApp('/');
    cy.url({ timeout: 15_000 }).should('include', '/welcome');
    cy.contains('h2', 'Community marketplace').should('be.visible');
    cy.viewport(390, 844);
  });

  it('loads the login page', () => {
    cy.visitApp('/login');
    cy.contains('h1', 'Sign in').should('be.visible');
    cy.contains('ion-button', 'Sign in').should('be.visible');
    cy.contains('ion-button', 'Continue with Google').should('be.visible');
    cy.contains('ion-button', 'Create an account').should('be.visible');
  });

  it('loads the register page', () => {
    cy.visitApp('/register');
    cy.contains('ion-title', 'Create account').should('be.visible');
    cy.contains('ion-button', 'Create account').should('be.visible');
    cy.contains('ion-button', 'Continue with Google').should('be.visible');
  });

  it('navigates between login and register', () => {
    cy.visitApp('/login');
    cy.contains('ion-button', 'Create an account').click();
    cy.url().should('include', '/register');
    cy.contains('ion-button', 'Already have an account? Sign in').click();
    cy.url().should('include', '/login');
  });

  it('redirects protected routes to login with redirect query', () => {
    cy.visitApp('/tabs/sell');
    cy.url().should('include', '/login');
    cy.url().should('include', 'redirect');
  });

  it('loads MFA challenge page shell (public route)', () => {
    cy.visitApp('/mfa-challenge');
    cy.contains('ion-title', 'Verify sign-in').should('be.visible');
  });
});
