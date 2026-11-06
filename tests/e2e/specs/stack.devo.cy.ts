/**
 * Dual-stack smoke against the served origin (local or CYPRESS_BASE_URL=devo).
 * Does not mutate data. Skips banner assertions when hostname is a prod public domain.
 */
describe('Dual-stack — deovo hosting identity', () => {
  it('serves firmshake-dev messaging config on deovo hostnames', () => {
    cy.request('/firebase-messaging-config.json').then((resp) => {
      expect(resp.status).to.eq(200);
      const body = resp.body as { projectId?: string };
      const host = window.location.hostname;
      const isProdPublic = host === 'firm-shake.com' || host === 'www.firm-shake.com';
      const isDevoHost =
        host.includes('firmshake-dev') || host === 'localhost' || host === '127.0.0.1';

      if (isProdPublic) {
        // Pre-cutover apex may still serve deovo build; do not require prod projectId yet.
        cy.log(`Public prod hostname ${host} — config projectId=${body.projectId}`);
        return;
      }

      if (isDevoHost || !body.projectId) {
        // Local vite may not ship the static JSON; deovo Hosting must.
        if (body.projectId) {
          expect(body.projectId).to.eq('firmshake-dev');
        }
      }
    });
  });

  it('shows DEVO banner on firmshake-dev Hosting only', () => {
    cy.visitApp('/tabs/home');
    cy.location('hostname').then((host) => {
      if (host.includes('firmshake-dev')) {
        cy.contains(/DEVO|deovo|firmshake-dev/i, { timeout: 15_000 }).should('exist');
      } else {
        cy.log(`Hostname ${host} — skipping DEVO banner assertion`);
      }
    });
  });

  it('staging API /health reports ok (stack fields soft until redeploy)', () => {
    const apiBase =
      Cypress.env('API_BASE_URL') ||
      'https://firmshake-api-staging-858269838319.us-central1.run.app';
    cy.request({ url: `${apiBase}/health`, failOnStatusCode: false }).then((resp) => {
      expect(resp.status).to.eq(200);
      const body = resp.body as {
        status?: string;
        service?: string;
        stack?: string;
        firebaseProjectId?: string;
        paymentsEnabled?: boolean;
      };
      expect(body.status).to.eq('ok');
      expect(body.service).to.eq('firmshake-api');
      // New dual-stack fields ship after API staging redeploy; accept either shape.
      if (body.stack !== undefined) {
        expect(body.stack).to.eq('devo');
        expect(body.firebaseProjectId).to.eq('firmshake-dev');
        expect(body.paymentsEnabled).to.eq(true);
      } else {
        cy.log('Legacy /health payload — redeploy firmshake-api staging for stack fields');
      }
    });
  });

  it('staging API /ready reports ready when dual-stack fields are present', () => {
    const apiBase =
      Cypress.env('API_BASE_URL') ||
      'https://firmshake-api-staging-858269838319.us-central1.run.app';
    cy.request({ url: `${apiBase}/ready`, failOnStatusCode: false }).then((resp) => {
      if (resp.status === 404) {
        cy.log('Legacy API without /ready — redeploy firmshake-api staging');
        return;
      }
      expect(resp.status).to.eq(200);
      const body = resp.body as {
        status?: string;
        service?: string;
        stack?: string;
        firebaseProjectId?: string;
        paymentsEnabled?: boolean;
        ready?: boolean;
      };
      expect(body.status).to.eq('ok');
      expect(body.service).to.eq('firmshake-api');
      if (body.stack !== undefined) {
        expect(body.stack).to.eq('devo');
        expect(body.firebaseProjectId).to.eq('firmshake-dev');
        expect(body.paymentsEnabled).to.eq(true);
        expect(body.ready).to.eq(true);
      }
    });
  });
});
