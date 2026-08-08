import { defineConfig } from 'cypress';
import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile(filePath: string): void {
  try {
    const absolutePath = path.resolve(filePath);
    const content = fs.readFileSync(absolutePath, 'utf8');

    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }

      const separatorIndex = line.indexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      let value = line.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // Optional env files — ignore when missing.
  }
}

function envOrEmpty(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (value) {
      return value;
    }
  }
  return '';
}

loadEnvFile('.env.local');
loadEnvFile('.env');

export default defineConfig({
  e2e: {
    supportFile: 'tests/e2e/support/e2e.ts',
    specPattern: 'tests/e2e/specs/**/*.cy.ts',
    fixturesFolder: 'tests/e2e/fixtures',
    videosFolder: 'tests/e2e/videos',
    screenshotsFolder: 'tests/e2e/screenshots',
    baseUrl: envOrEmpty('CYPRESS_BASE_URL') || 'http://localhost:5173',
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
      TEST_EMAIL_MFA: envOrEmpty('CYPRESS_TEST_EMAIL_MFA', 'TEST_EMAIL_MFA'),
      TEST_PASSWORD_MFA: envOrEmpty('CYPRESS_TEST_PASSWORD_MFA', 'TEST_PASSWORD_MFA'),
      // Fallback credentials — specs detect MFA redirect if not enrolled.
      TEST_EMAIL: envOrEmpty('CYPRESS_TEST_EMAIL', 'TEST_EMAIL'),
      TEST_PASSWORD: envOrEmpty('CYPRESS_TEST_PASSWORD', 'TEST_PASSWORD'),
      // Super-admin account for moderator management specs (optional).
      SUPER_ADMIN_EMAIL: envOrEmpty('CYPRESS_SUPER_ADMIN_EMAIL', 'SUPER_ADMIN_EMAIL'),
      SUPER_ADMIN_PASSWORD: envOrEmpty('CYPRESS_SUPER_ADMIN_PASSWORD', 'SUPER_ADMIN_PASSWORD'),
      // Existing user email for grant-moderator flow (optional).
      MODERATOR_CANDIDATE_EMAIL: envOrEmpty(
        'CYPRESS_MODERATOR_CANDIDATE_EMAIL',
        'MODERATOR_CANDIDATE_EMAIL',
      ),
    },
    setupNodeEvents(on, config) {
      return config;
    },
  },
});
