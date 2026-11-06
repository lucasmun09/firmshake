import { isLogsInitialPath } from '@/router/logsRoute';

/**
 * Entry split: /logs opens a minimal app (debug UI only). Everything else loads the full app.
 * Must not statically import Firebase, auth, or the main router — those compete for Firestore
 * IndexedDB leases and auth state when a second tab is open on the same origin.
 */
if (isLogsInitialPath()) {
  void import('./main-logs');
} else {
  void import('./main');
}
