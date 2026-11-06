# Google Sign-In

FirmShake signs users in with Firebase Auth + the Google provider. **Same-tab redirect is the default and works without any GIS client ID.** Google Identity Services (GIS) is an optional in-page enhancement.

## What you need to do

Complete these steps in **Firebase Console** and **Google Cloud Console** before Google sign-in works on each origin you serve from. The agent cannot do this for you.

### 1. Enable Google sign-in (Firebase)

1. Open [Firebase Console → Authentication → Sign-in method](https://console.firebase.google.com/project/firmshake-dev/authentication/providers) (use `firmshake-prod` for production).
2. Click **Google** → **Enable** → add a support email if prompted → **Save**.

### 2. Add Authorized domains (Firebase)

Do this **per Firebase project**. Open Authentication → Settings → Authorized domains for that project.

**firmshake-dev (deovo / beta) — desired after domain cutover:**

| Hostname | When |
|---|---|
| `localhost` | Local dev (usually present by default) |
| `firmshake-dev.web.app` | Devo Hosting |
| `firmshake-dev.firebaseapp.com` | Alternate Firebase Hosting hostname |

**Transitional (keep while `firm-shake.com` still serves firmshake-dev Hosting):** also add `firm-shake.com` and `www.firm-shake.com` on **devo**. Remove them from deovo after cutover (see [`docs/devo-prod-stacks.md`](./devo-prod-stacks.md)).

**firmshake-prod (production):**

| Hostname | When |
|---|---|
| `localhost` | Local prod builds / testing |
| `firmshake-prod.web.app` | Prod Hosting (pre-cutover URL) |
| `firmshake-prod.firebaseapp.com` | Alternate Firebase Hosting hostname |
| `firm-shake.com` | Production apex |
| `www.firm-shake.com` | Production www |

### 3. Register OAuth redirect URIs (Google Cloud)

The app resolves `authDomain` to the **page hostname** on Hosting (see `firebaseAuthDomain.ts`). Google OAuth then sends:

```
redirect_uri=https://<page-host>/__/auth/handler
```

Each origin must be registered on the Firebase auto-created OAuth client **for that GCP project**.

1. Open [Google Cloud Console → APIs & Credentials](https://console.cloud.google.com/apis/credentials?project=firmshake-dev) (switch project to `firmshake-prod` for prod).
2. Confirm the project matches your Firebase project (`firmshake-dev` or `firmshake-prod`).
3. Under **OAuth 2.0 Client IDs**, open **Web client (auto created by Google Service)**.
4. Under **Authorized redirect URIs**, click **Add URI** and paste **every** URI for your stack (one per line):

**firmshake-dev — desired after cutover:**

```
https://firmshake-dev.firebaseapp.com/__/auth/handler
https://firmshake-dev.web.app/__/auth/handler
```

**firmshake-dev — transitional (while apex still on deovo Hosting):** also add:

```
https://firm-shake.com/__/auth/handler
https://www.firm-shake.com/__/auth/handler
```

**firmshake-prod — copy/paste block:**

```
https://firmshake-prod.firebaseapp.com/__/auth/handler
https://firmshake-prod.web.app/__/auth/handler
https://firm-shake.com/__/auth/handler
https://www.firm-shake.com/__/auth/handler
```

**localhost** — app keeps `{projectId}.firebaseapp.com` as authDomain locally (use the deovo or prod firebaseapp.com handler for whichever project your `.env` points at):

```
https://firmshake-dev.firebaseapp.com/__/auth/handler
```

5. Click **Save**. Google can take **1–2 minutes** to propagate URI changes.

### 4. Verify sign-in works

1. Open the app on the origin you fixed (e.g. `https://firm-shake.com/login` or `https://firmshake-dev.web.app/login`).
2. Click **Continue with Google** and complete the Google account chooser.
3. On failure, open **`/logs`** in another tab and search category **`auth`** for:
   - `Google redirect: calling signInWithRedirect` → note `expectedRedirectUri` (must match a URI from step 3).
   - `getRedirectResult.done` → `hasResultUser: true` means success.
4. If Google shows **Error 400: redirect_uri_mismatch**, compare the error’s `redirect_uri` parameter to your **Authorized redirect URIs** list — they must match **exactly** (scheme, host, path `/__/auth/handler`).

### 5. When to redeploy

| Change | Redeploy? |
|---|---|
| Firebase Authorized domains | **No** — takes effect immediately |
| Google OAuth redirect URIs | **No** — takes effect after ~1–2 min |
| `.env.local` / `VITE_GOOGLE_WEB_CLIENT_ID` / Firebase web config | **Yes** — `npm run deploy:hosting` (or rebuild locally and restart dev server) |
| Custom domain added to Firebase Hosting | **Yes** — connect domain in Hosting first, then repeat steps 2–3 for the new hostname |

**You do not need** `VITE_GOOGLE_WEB_CLIENT_ID` for redirect sign-in on staging or production.

---

## Honest constraint

Google hosts the account chooser / consent UI. A custom FirmShake overlay that collects Google email/password is **not allowed**.

## What happens when the user clicks Continue with Google

| Setup | UI | Flow |
|---|---|---|
| **Default** (no `VITE_GOOGLE_WEB_CLIENT_ID`) | Ionic outline **Continue with Google** button | `loginWithGoogle` → Firebase `signInWithRedirect` (same tab) → return to app → `getRedirectResult` completes session |
| Optional GIS client ID set | Official Google GIS button (when script loads) | GIS credential → `loginWithGoogleIdToken` → Firebase `signInWithCredential`. If GIS fails to mount, Ionic fallback still uses redirect |
| Capacitor native | Same Ionic button | Same-tab / WebView redirect |

Popup windows are **not** the default. Popup is only used if code explicitly opts in via `allowPopupFallback`.

```
Click Google
  ├─ GIS button mounted?  → ID token → loginWithGoogleIdToken → Firebase credential
  └─ else (default)       → loginWithGoogle → signInWithRedirect → boot getRedirectResult
```

## Recommended setup (firmshake-dev / production)

Follow **[What you need to do](#what-you-need-to-do)** above for console steps.

The client **overrides** `VITE_FIREBASE_AUTH_DOMAIN` at runtime to the current hostname when that host is an allowed FirmShake / Firebase Hosting origin (`src/common/services/firebaseAuthDomain.ts`). This avoids empty `getRedirectResult` on custom domains under Chrome third-party storage restrictions.

## Optional: in-page GIS button

Set `VITE_GOOGLE_WEB_CLIENT_ID` only if you want Google’s hosted button / FedCM instead of the Ionic fallback.

### What you need to do (GIS only)

1. **Firebase Console** → Authentication → Sign-in method → Google → copy **Web client ID**.
2. Add to `.env.local` (and GitHub Environment secret `VITE_GOOGLE_WEB_CLIENT_ID` for CI builds):

```bash
VITE_GOOGLE_WEB_CLIENT_ID=1234567890-xxxx.apps.googleusercontent.com
```

3. **Google Cloud Console** → Credentials → that Web client → **Authorized JavaScript origins** — add each origin (GIS only; redirect still uses handler URIs from [What you need to do](#what-you-need-to-do)):

```
http://localhost:5173
https://firmshake-dev.web.app
https://firmshake-prod.web.app
https://firm-shake.com
https://www.firm-shake.com
```

(Use deovo origins on the deovo GIS client; prod origins on the prod client. Do not mix stacks.)

4. **Redeploy** hosting (or restart dev server) after changing `VITE_GOOGLE_WEB_CLIENT_ID`.

## MFA

Google / OAuth accounts **skip FirmShake SMS MFA enrollment**. Email/password accounts still enroll SMS when required (`postAuthFlow.decideMfaEnrollment` → reason `oauth-provider`).

## Troubleshooting: Error 400 `redirect_uri_mismatch`

Google blocks sign-in **before** returning to FirmShake when the OAuth redirect URI is not registered.

**Root cause:** `resolveFirebaseAuthDomain()` sets Firebase `authDomain` to the page hostname (e.g. `firm-shake.com`). `signInWithRedirect` sends `redirect_uri=https://<page-host>/__/auth/handler`. The auto-created Firebase Web OAuth client often only lists `https://{projectId}.firebaseapp.com/__/auth/handler`.

**Fix:** Work through **[What you need to do](#what-you-need-to-do)** steps 2–4. Compare Google’s error `redirect_uri` parameter (or `/logs` → `expectedRedirectUri`) against your **Authorized redirect URIs** list — must match exactly.

## Troubleshooting: “Google sign-in did not complete…”

Shown when a redirect was started (`firmshake:googleRedirectPending` in session/local storage) but boot recovery found neither a `getRedirectResult` user nor `auth.currentUser`.

| Likely cause | What to check |
|---|---|
| **authDomain ≠ page host (common on mobile Chrome)** | Logs show `pageOrigin: https://firm-shake.com` with `authDomain: *.firebaseapp.com`, then `getRedirectResult.done` with `hasResultUser: false` in ~ms (not a timeout). Fix: app resolves `authDomain` to the current hosting hostname (`firebaseAuthDomain.ts`) so `/__/auth/handler` is same-site. Confirm Firebase Hosting custom domain is connected and authorized. |
| User cancelled Google consent | Try again; message clears on next successful attempt |
| Authorized domain missing | Firebase Authentication → Settings → Authorized domains must include the page host |
| Slow handshake timed out | Open `/logs` — look for `getRedirectResult timed out` or `Google redirect failed: no user…` with `timedOut: true` |
| Stale pending flag | Clear site data for the origin and retry |

### Log note (2026-08-10, Android Chrome on firm-shake.com)

Timeline: sign-out → Continue with Google (`strategy: redirect`, `gisConfigured: false`) → pending flag set → return to `/login` → `getRedirectResult` empty in 26ms → `waitForAuthUser` timeout → incomplete message. Root cause: cross-origin `authDomain` (`firmshake-dev.firebaseapp.com`) vs page (`firm-shake.com`) under third-party storage partitioning.

Debug categories: `auth` messages prefixed `Google redirect:` and `loginWithGoogle:`. Look for `authDomainCrossOrigin` / `Firebase authDomain resolved to page hostname`.

## Code map

| File | Role |
|---|---|
| `src/common/services/firebase.ts` / `firebaseAuthDomain.ts` | Resolves same-site `authDomain` on custom hosting domains |
| `src/features/auth/services/auth.ts` | `loginWithGoogle` (redirect), `loginWithGoogleIdToken` (GIS), boot `getRedirectResult` recovery |
| `src/features/auth/services/googleRedirectRecovery.ts` | Pending / outcome helpers for redirect boot |
| `src/features/auth/services/googleIdentity.ts` | Optional GIS loader + strategy helper |
| `src/features/auth/components/GoogleSignInButton.vue` | GIS button when configured; else Ionic redirect fallback |
| `LoginPage.vue` / `RegisterPage.vue` | Wire credential vs fallback handlers |
| `src/features/auth/services/postAuthFlow.ts` | OAuth skips SMS MFA |
