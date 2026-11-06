import { fillIonInput, getIonInputByLabel } from '../support/helpers';

describe('Auth — register', () => {
  it('renders registration form fields', () => {
    cy.visitApp('/register');
    getIonInputByLabel('First name').should('exist');
    getIonInputByLabel('Last name').should('exist');
    getIonInputByLabel('Email').should('exist');
    getIonInputByLabel('Password').should('exist');
    getIonInputByLabel('Phone number').should('exist');
  });

  it('validates password requirements on submit attempt', () => {
    cy.visitApp('/register');
    fillIonInput('First name', 'E2E');
    fillIonInput('Last name', 'Tester');
    fillIonInput('Email', 'invalid-email');
    fillIonInput('Password', 'short');
    fillIonInput('Phone number', '5551234567');
    cy.contains('ion-button', 'Create account').click();
    cy.url().should('include', '/register');
  });

  // Full registration creates Firebase users and triggers MFA enrollment.
  // Run manually against firmshake-dev with a disposable email when needed.
  it.skip('creates a new email account (manual — disposable email + Firebase test phone)', () => {
    const unique = Date.now();
    cy.visitApp('/register');
    fillIonInput('First name', 'E2E');
    fillIonInput('Last name', 'Tester');
    fillIonInput('Email', `e2e+${unique}@firmshake.dev`);
    fillIonInput('Password', 'TestPass123!');
    cy.contains('ion-button', 'Create account').click();
  });
});

describe('Auth — Google sign-in', () => {
  it('shows Continue with Google on login', () => {
    cy.visitApp('/login');
    cy.contains('ion-button', 'Continue with Google').should('be.visible');
  });

  // Google OAuth popups/redirects cannot be reliably automated in CI without
  // Firebase Auth emulator or a dedicated test Google account + cy.origin.
  it.skip('completes Google popup sign-in (TODO: Auth emulator or cy.origin)', () => {
    cy.visitApp('/login');
    cy.contains('ion-button', 'Continue with Google').click();
  });
});
