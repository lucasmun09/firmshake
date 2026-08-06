import './commands';

// Stub reCAPTCHA verification for all specs unless a test overrides the intercept.
beforeEach(() => {
  cy.stubRecaptcha();
});
