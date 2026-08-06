/** Shared helpers for FirmShake Cypress specs. */

export function hasTestCredentials(): boolean {
  return Boolean(Cypress.env('TEST_EMAIL') && Cypress.env('TEST_PASSWORD'));
}

export function hasMfaEnrolledCredentials(): boolean {
  return Boolean(
    Cypress.env('TEST_EMAIL_MFA')
    && Cypress.env('TEST_PASSWORD_MFA'),
  );
}

export function hasSuperAdminCredentials(): boolean {
  return Boolean(
    Cypress.env('SUPER_ADMIN_EMAIL')
    && Cypress.env('SUPER_ADMIN_PASSWORD'),
  );
}

/** Run describe block only when email/password test credentials are configured. */
export function describeWithAuth(title: string, fn: () => void): void {
  if (hasTestCredentials()) {
    describe(title, fn);
  } else {
    describe.skip(`${title} (skipped — set CYPRESS_TEST_EMAIL / CYPRESS_TEST_PASSWORD)`, fn);
  }
}

/** Run describe block only when MFA-enrolled test credentials are configured. */
export function describeWithMfaAuth(title: string, fn: () => void): void {
  if (hasMfaEnrolledCredentials()) {
    describe(title, fn);
  } else {
    describe.skip(
      `${title} (skipped — set CYPRESS_TEST_EMAIL_MFA / CYPRESS_TEST_PASSWORD_MFA)`,
      fn,
    );
  }
}

/** Run describe block only when super-admin credentials are configured. */
export function describeWithSuperAdmin(title: string, fn: () => void): void {
  if (hasSuperAdminCredentials()) {
    describe(title, fn);
  } else {
    describe.skip(
      `${title} (skipped — set CYPRESS_SUPER_ADMIN_EMAIL / CYPRESS_SUPER_ADMIN_PASSWORD)`,
      fn,
    );
  }
}

export function testEmail(): string {
  return String(Cypress.env('TEST_EMAIL_MFA') ?? Cypress.env('TEST_EMAIL'));
}

export function testPassword(): string {
  return String(Cypress.env('TEST_PASSWORD_MFA') ?? Cypress.env('TEST_PASSWORD'));
}

export function superAdminEmail(): string {
  return String(Cypress.env('SUPER_ADMIN_EMAIL'));
}

export function superAdminPassword(): string {
  return String(Cypress.env('SUPER_ADMIN_PASSWORD'));
}

/** Pathname from a Cypress URL (ignores redirect query params). */
export function urlPathname(href: string): string {
  return new URL(href).pathname;
}

/** Whether the current path includes a route segment (not query string). */
export function isOnPath(href: string, segment: string): boolean {
  return urlPathname(href).includes(segment);
}

/** Find an Ionic input/textarea by its visible stacked label text (Ionic 8+). */
export function getIonInputByLabel(label: string): Cypress.Chainable<JQuery<HTMLElement>> {
  return cy
    .get('ion-input, ion-textarea')
    .filter((_index, el) => el.querySelector('.label-text')?.textContent?.trim() === label)
    .first();
}

/** Type into an Ionic stacked-label input by its visible label text. */
export function fillIonInput(label: string, value: string): Cypress.Chainable<JQuery<HTMLElement>> {
  return getIonInputByLabel(label)
    .should('exist')
    .find('input, textarea')
    .first()
    .clear()
    .type(value, { delay: 0 });
}

/** Choose an option from an Ionic select (popover interface). */
export function selectIonOption(selectLabel: string, optionText: string): void {
  cy.get(`ion-select[label="${selectLabel}"]`).click({ force: true });
  cy.get('ion-popover', { timeout: 10_000 }).should('be.visible');
  cy.contains('ion-select-option, ion-item, ion-radio', optionText).click({ force: true });
}

/** Wait until auth bootstrap finishes and URL leaves login/register. */
export function waitForAuthenticatedApp(): void {
  cy.url({ timeout: 30_000 }).should('not.match', /\/(login|register)$/);
}

/** Assert post-login destination: home or MFA enrollment (SMS not automated). */
export function assertPostLoginDestination(): void {
  cy.url({ timeout: 30_000 }).should('satisfy', (href: string) => {
    const path = urlPathname(href);
    return (
      path.includes('/tabs/home')
      || path.includes('/mfa-enroll')
      || path.includes('/complete-profile')
      || path.includes('/mfa-challenge')
    );
  });
}

/** Stub Flask API health + image upload for listing create flows. */
export function stubListingApi(): void {
  cy.intercept('GET', '**/health', { statusCode: 200, body: { ok: true } }).as('apiHealth');
  cy.intercept('POST', '**/api/images', {
    statusCode: 200,
    body: { url: 'https://firmshake-dev.web.app/e2e-fixture.jpg' },
  }).as('imageUpload');
}

/** Attach a fixture photo via the hidden file input on the sell form. */
export function attachListingPhoto(fixturePath = 'sample-listing.png'): void {
  cy.get('input[type="file"].hidden-input')
    .first()
    .selectFile(`tests/e2e/fixtures/${fixturePath}`, { force: true });
  cy.contains('.photo-grid .photo-card', { timeout: 15_000 }).should('exist');
}
