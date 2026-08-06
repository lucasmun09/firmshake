import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    supportFile: 'tests/e2e/support/e2e.ts',
    specPattern: 'tests/e2e/specs/**/*.cy.ts',
    fixturesFolder: 'tests/e2e/fixtures',
    videosFolder: 'tests/e2e/videos',
    screenshotsFolder: 'tests/e2e/screenshots',
    baseUrl: process.env.CYPRESS_BASE_URL ?? 'http://localhost:5173',
    viewportWidth: 390,
    viewportHeight: 844,
    defaultCommandTimeout: 12_000,
    requestTimeout: 15_000,
    responseTimeout: 15_000,
    pageLoadTimeout: 30_000,
    // Lower memory use when many specs run in parallel (Cypress Dashboard / CI shards).
    numTestsKeptInMemory: 0,
    experimentalRunAllSpecs: true,
    retries: {
      runMode: 1,
      openMode: 0,
    },
    env: {
      // MFA-enrolled account — required for authenticated specs (preferred).
      TEST_EMAIL_MFA: '',
      TEST_PASSWORD_MFA: '',
      // Fallback credentials — specs detect MFA redirect if not enrolled.
      TEST_EMAIL: '',
      TEST_PASSWORD: '',
      // Super-admin account for moderator management specs (optional).
      SUPER_ADMIN_EMAIL: '',
      SUPER_ADMIN_PASSWORD: '',
      // Existing user email for grant-moderator flow (optional).
      MODERATOR_CANDIDATE_EMAIL: '',
    },
    setupNodeEvents(on, config) {
      return config;
    },
  },
});
