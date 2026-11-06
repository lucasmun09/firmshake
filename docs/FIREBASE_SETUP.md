# Firebase Setup for FirmShake

FirmShake uses two Firebase projects: **`firmshake-dev`** (devo/beta) and **`firmshake-prod`** (clean slate). Existing data stays on deovo. Dual-stack decisions and the promote pipeline: [devo-prod-stacks.md](./devo-prod-stacks.md).

Local setup below targets **devo** (`firmshake-dev`).

## What you need to do

Manual steps the CLI cannot perform. Do these once per Firebase project / environment.

### First-time project setup

1. **Terminal:** `firebase login` then `npm run firebase:setup` (creates project, Firestore, `.env.local`).
2. If setup fails with **403 Firestore API not enabled:** [Create Firestore](https://console.firebase.google.com/project/firmshake-dev/firestore) → test mode → region **us-west2** → re-run setup.
3. **Firebase Console → Authentication → Sign-in method:** Enable **Email/Password** and **Google**.
4. **Firebase Console → Authentication → Settings → Authorized domains:** Confirm `localhost` is listed; add Hosting/custom domains when you connect them (see Google OAuth below).
5. **Optional SMS MFA:** Upgrade to **Blaze**, enable **SMS Multi-factor Authentication** under Sign-in method → Advanced, set SMS region policy — see [§4](#4-enable-sms-multi-factor-authentication-optional).
6. **Optional web push:** Project settings → Cloud Messaging → generate Web Push key → paste into `.env.local` as `VITE_FIREBASE_VAPID_KEY`.

### Google OAuth (required for Continue with Google)

If users see **Error 400: redirect_uri_mismatch**, the OAuth client is missing redirect URIs for your Hosting hostname.

1. **Firebase Console → Authentication → Settings → Authorized domains** — add each origin users visit (`firmshake-dev.web.app`, `firm-shake.com`, `www.firm-shake.com`, etc.).
2. **[Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials?project=firmshake-dev)** (match Firebase project) → **Web client (auto created by Google Service)** → **Authorized redirect URIs** — paste:

```
https://firmshake-dev.firebaseapp.com/__/auth/handler
https://firmshake-dev.web.app/__/auth/handler
https://firm-shake.com/__/auth/handler
https://www.firm-shake.com/__/auth/handler
```

For **firmshake-prod**, replace `firmshake-dev` with `firmshake-prod` in the first two lines.

3. **Verify:** Sign in on the affected origin → on failure open `/logs` → `auth` category → check `expectedRedirectUri` on `Google redirect: calling signInWithRedirect`.
4. **Redeploy:** Not required for console OAuth/domain changes. Redeploy hosting only if you change `VITE_*` env vars baked into the build.

Full checklist and troubleshooting: [`docs/google-sign-in-ux.md`](./google-sign-in-ux.md).

---

## Automated setup (recommended)

### 1. Log in to Firebase CLI

In your terminal:

```bash
firebase login
```

### 2. Run the setup script

```bash
npm run firebase:setup
```

If you see a **403 Firestore API not enabled** error, create the database once in Firebase Console first:

1. Open https://console.firebase.google.com/project/firmshake-dev/firestore
2. Click **Create database**
3. Start in **test mode**
4. Choose region **us-west2** (or your preferred region)
5. Re-run `npm run firebase:setup`

This will:

- Create project `firmshake-dev` (override with `FIREBASE_PROJECT_ID=my-id`)
- Create Firestore in `us-west2`
- Deploy `firestore.rules`
- Register a web app and write `.env.local`

### 3. Enable sign-in methods

Open [Authentication → Sign-in method](https://console.firebase.google.com/project/firmshake-dev/authentication/providers):

- **Email/Password** → Enable
- **Google** → Enable (add a support email if prompted)

Ensure **localhost** is in **Authentication → Settings → Authorized domains** (usually added by default).

### 3b. Google Sign-In (redirect by default)

Enable the Google provider (step 3). Same-tab **redirect** is the default and does **not** require `VITE_GOOGLE_WEB_CLIENT_ID`.

Optional: set `VITE_GOOGLE_WEB_CLIENT_ID` for an in-page Google Identity Services button. Details: [`docs/google-sign-in-ux.md`](./google-sign-in-ux.md).

**Custom domains and `redirect_uri_mismatch`:** The app resolves `authDomain` to the current page hostname on Firebase Hosting (e.g. `firm-shake.com`, `firmshake-dev.web.app`) so Google redirect completes same-site. That means OAuth sends `https://<page-host>/__/auth/handler` — you must register every hosting hostname on the Firebase OAuth client:

1. Firebase Console → **Authentication → Settings → Authorized domains** — add each origin (`localhost`, `{projectId}.web.app`, `firm-shake.com`, `www.firm-shake.com`, etc.).
2. [Google Cloud Console](https://console.cloud.google.com/apis/credentials?project=firmshake-dev) → **APIs & Credentials → OAuth 2.0 Client IDs** → open the **Web client (auto created by Google Service)** for this Firebase project → **Authorized redirect URIs**. Add (deovo example):

```
https://firmshake-dev.firebaseapp.com/__/auth/handler
https://firmshake-dev.web.app/__/auth/handler
https://firm-shake.com/__/auth/handler
https://www.firm-shake.com/__/auth/handler
```

Prod (`firmshake-prod`): same pattern with `firmshake-prod.firebaseapp.com` / `firmshake-prod.web.app`.

Localhost keeps the configured `VITE_FIREBASE_AUTH_DOMAIN` (`{projectId}.firebaseapp.com`), so only the `firebaseapp.com` handler URI is required for local dev.

### 4. Enable SMS multi-factor authentication (optional)

Email/password users must enroll SMS MFA before using the app. Google (and other OAuth) sign-in skips FirmShake SMS enrollment — those accounts are treated as already verified by the identity provider.

1. Upgrade the project to the **Blaze (pay as you go)** plan — SMS MFA is not available on the free Spark plan.
2. Open [Authentication → Sign-in method](https://console.firebase.google.com/project/firmshake-dev/authentication/providers).
3. Under **Advanced**, enable **SMS Multi-factor Authentication**.
4. Open [Authentication → Settings](https://console.firebase.google.com/project/firmshake-dev/authentication/settings).
5. Under **SMS region policy**, choose **Allow** and select the countries where your users are (e.g. **United States**).
6. While developing, add **Phone numbers for testing** under Advanced to avoid SMS rate limits.

**SMS region policy alone is not enough.** You must also enable **SMS Multi-factor Authentication** under Sign-in method → Advanced. Without it, enrollment returns `auth/operation-not-allowed` even when the region policy allows your country.

Optional but recommended: enable the **Phone** sign-in provider on the same page (some projects require it for SMS delivery during MFA enrollment).

Until SMS MFA is fully configured, email/password users cannot access the app until they complete phone verification. Google sign-in still works without SMS.

### 5. Enable web push (FCM)

1. Open [Project settings → Cloud Messaging](https://console.firebase.google.com/project/firmshake-dev/settings/cloudmessaging)
2. Under **Web Push certificates**, click **Generate key pair**
3. Copy the key into `.env.local`:

```bash
VITE_FIREBASE_VAPID_KEY=your-web-push-vapid-key
```

4. Re-run setup if needed so `public/firebase-messaging-config.json` exists:

```bash
npm run firebase:setup
```

5. Deploy updated Firestore rules (includes `fcmTokens` subcollection):

```bash
npm run firebase:deploy-rules
```

Push delivery also requires **firmshake-api** running with a Firebase service account (`GOOGLE_APPLICATION_CREDENTIALS`).

### 6. Verify

```bash
# Terminal 1 — API
cd ../firmshake-api && python app.py

# Terminal 2 — App
npm run dev
```

Register at `http://localhost:5173/register` and confirm:

- User appears in **Authentication → Users**
- `users/{uid}` doc appears in Firestore

---

## Optional: seed communities

Admin-curated communities can be seeded with a service account:

1. Firebase Console → **Project settings → Service accounts → Generate new private key**
2. Save the JSON file outside the repo (e.g. `~/firmshake-service-account.json`)
3. Run:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=~/firmshake-service-account.json
export FIREBASE_PROJECT_ID=firmshake-dev
npm run firebase:seed
```

---

## Environment variables

`.env.local` is generated by `npm run firebase:setup`. Template:

| Variable | Description |
|---|---|
| `VITE_FIREBASE_API_KEY` | Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `{projectId}.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID |
| `VITE_FIREBASE_APP_ID` | Web app ID |
| `VITE_FIREBASE_VAPID_KEY` | Web push VAPID key (Cloud Messaging) |
| `VITE_API_BASE_URL` | Staging/local API URL (prod uses a separate Cloud Run URL) |
| `VITE_PAYMENTS_ENABLED` | Deposits; unset/`true` on deovo (mock only), `false` on prod — no processor this phase |

Prod template: `.env.production.example`. Firebase CLI aliases: `devo` → `firmshake-dev`, `prod` → `firmshake-prod` (`.firebaserc`).

---

## Firestore rules

Rules live in `firestore.rules`. Deploy after changes:

```bash
npm run firebase:deploy-rules
```

---

## iOS and Android (later)

### iOS

1. Add iOS app in Firebase console
2. Bundle ID: `com.firmshake.app` (from `capacitor.config.ts`)
3. Download `GoogleService-Info.plist` → `ios/App/App/`

### Android

1. Add Android app in Firebase console
2. Package name: `com.firmshake.app`
3. Download `google-services.json` → `android/app/`

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `Firebase is not configured` | Run `npm run firebase:setup` or fill `.env.local` manually |
| `auth/operation-not-allowed` | Enable Email/Password in Firebase Console |
| `auth/operation-not-allowed` (SMS MFA) | Enable **SMS Multi-factor Authentication** under Authentication → Sign-in method → Advanced (not just SMS region policy); upgrade to Blaze; allow your SMS region in Authentication → Settings; optionally enable the **Phone** sign-in provider |
| `permission-denied` on Firestore | Run `npm run firebase:deploy-rules` |
| Google `redirect_uri_mismatch` | Follow [What you need to do → Google OAuth](./FIREBASE_SETUP.md#google-oauth-required-for-continue-with-google) and [`google-sign-in-ux.md`](./google-sign-in-ux.md#what-you-need-to-do) |
| API images fail | Start firmshake-api: `python app.py` |
