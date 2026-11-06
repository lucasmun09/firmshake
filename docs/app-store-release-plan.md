> **Captured from planning session 2026-08-08.** Device testing & store publish plan (iOS first).  
> **Progress update (2026-08-08):** Phase 1A bootstrap started in-repo — Capacitor iOS/Android packages, native projects, sync scripts, and permission strings are in place. Account/signing/Firebase native config still need you.

# FirmShake — Device Testing & Store Publish Plan (iOS first)

**Date context:** Aug 8, 2026  
**Scope:** Plan + Phase 1A bootstrap progress (platforms/scripts). Account enrollment, signing, and store upload remain manual.

---

## Repo snapshot (what exists vs missing)

### Already in place

| Item | Location / notes |
|---|---|
| Capacitor config | `capacitor.config.ts` — `appId: com.firmshake.app`, `appName: FirmShake`, `webDir: dist` |
| Ionic + Capacitor wiring | `ionic.config.json` (`type: vue-vite`, capacitor integration) |
| Capacitor core + plugins | `@capacitor/core` **8.4**, plus `app`, `camera`, `geolocation`, `haptics`, `keyboard`, `push-notifications`, `status-bar` (`package.json`) |
| Capacitor platforms | `@capacitor/ios` **8.4.0**, `@capacitor/android` **8.4.0** (exact); native projects `ios/` + `android/` |
| CLI | `@capacitor/cli` 8.4 (devDependency) |
| Convenience scripts | `build:native`, `cap:sync`, `cap:ios`, `cap:android` in `package.json` |
| Native permission strings | iOS `Info.plist` camera/photo/location (+ remote-notification background mode); Android camera/location/`POST_NOTIFICATIONS` in `AndroidManifest.xml` |
| Native-aware app code | `src/utils/platform.ts`, `src/router/rootRoute.ts`, Firestore single-tab cache on native (`firebase.ts`), camera/photos, geolocation, FCM push (`pushNotifications.ts`), auth redirect-only on native |
| Guest routing (native) | Unauthenticated native → **`/login`** (`NATIVE_ENTRY_PATH` in `rootRoute.ts`) — not guest browse |
| Mobile API testing note | README § “Mobile testing against local API” (ngrok + `VITE_API_BASE_URL`) |
| Firebase native checklist (stub) | `docs/FIREBASE_SETUP.md` § “iOS and Android (later)” |
| Brand assets (web) | `public/logo.png`, `public/favicon.png` |
| Web hosting / staging API | Firebase project `firmshake-dev`; default API in `.env.example` = staging Cloud Run |
| App version | `package.json` → `0.1.0` |

### Missing (blockers before any store binary)

| Item | Status |
|---|---|
| Full **Xcode** app (not only CLT) | **Blocked on machine** — `xcode-select` points at Command Line Tools; install Xcode + `sudo xcode-select -s /Applications/Xcode.app` before USB iOS runs |
| **JDK** + Android SDK / Android Studio | **Blocked on machine** — Gradle sync warned “Unable to locate a Java Runtime” |
| Native icons / splash | **No** `resources/` / Capacitor Assets pipeline yet (default Capacitor icons) |
| Signing / provisioning | Needs Apple Team in Xcode / Play signing |
| `GoogleService-Info.plist` / `google-services.json` | Not present (Firebase native apps not registered yet) |
| Deep links / universal links / App Links | Not configured |
| Privacy manifests / ATT / Play Data safety | Not started |
| Store listing docs | None under `docs/` |
| Native CI | Only `.github/workflows/deploy-web.yml` (web hosting) |
| Production Firebase / production API | Still on **firmshake-dev** + **staging** API |

`docs/MILESTONES.md` Phase 0: `ios/` + `android/` scaffold marked done.

---

## Decisions you must make first (estimated blockers)

Resolve these before Phase 1 archive/upload:

1. **Bundle / application ID** — keep `com.firmshake.app` or change once (changing after first upload is painful).
2. **Apple account type** — Individual vs Organization (Organization needs DUNS; required for some company branding).
3. **Google Play account** — personal vs organization; one-time Play Console fee.
4. **Production vs staging backends for store builds**
   - Today: web → `firmshake-dev` + staging API.
   - Store apps should eventually use a **production** Firebase project + production API (or a deliberate “beta uses staging” policy).
5. **Privacy policy URL** + support URL (App Store + Play require them) — host on `firm-shake.com` or Firebase hosting.
6. **Payments story for review** — deposits are still mock/pre-Stripe in code (`docs/MILESTONES.md` Phase 6). **Product intent (updated):** ship **real deposits in v1** via Stripe when ready; mock only as review fallback if Stripe slips. Architecture: [`docs/deposit-escrow-payment-plan.md`](./deposit-escrow-payment-plan.md). Presence / no-show anti-fraud (do not rely on GPS-only 15 ft rules): [`docs/deposit-presence-anti-fraud-brainstorm.md`](./deposit-presence-anti-fraud-brainstorm.md).
7. **MFA / SMS** — App Store reviewers need a demo account; SMS MFA can block review if they can’t receive codes — prepare a **reviewer bypass or fixed MFA test account**.
8. **Push notifications for v1** — native FCM needs APNs key + Firebase iOS/Android apps; decide if push is required for first store submission or can follow in 1.1.
9. **Tablet support** — iPad screenshots required if you declare iPad; Android tablets optional but recommended for your device matrix.
10. **Deep linking** — needed for password-reset email links / share-listing if those must open the app (not only Safari). Can defer to post-1.0 if web fallback is OK.

---

## Recommended order of operations (milestones)

| Week | Focus |
|---|---|
| **Week 0** | Phase 0 accounts + decisions (bundle ID, backends, privacy URL) |
| **Week 1** | Generate `ios/` + `android/`, icons/splash, Firebase native config, first USB builds |
| **Week 1–2** | Phase 1 device QA matrix (iPhone → iPad → Android phone → Android tablet) |
| **Week 2–3** | Phase 2 TestFlight internal; fix crash/permission issues |
| **Week 3–4** | Phase 3 App Store listing + submit iOS |
| **Week 4–5** | Phase 4 Android internal testing → production (after iOS is stable or submitted) |
| **Ongoing** | Phase 5 versioning, env discipline, optional native CI |

---

## Phase 0 — Prerequisites / accounts

### Apple (do first)

- [ ] Enroll in **Apple Developer Program** ($99/yr) — Individual or Organization.
- [ ] Mac with recent **Xcode** (Capacitor 8 needs a current Xcode; install from App Store).
- [ ] Apple ID added to Xcode → Settings → Accounts.
- [ ] Decide Team + bundle ID (`com.firmshake.app` recommended unless already taken).
- [ ] Register physical devices in developer portal (or let Xcode auto-manage on first run).
- [ ] Create **App Store Connect** app record (name, bundle ID, SKU) when ready for TestFlight — can wait until first archive works.
- [ ] Create **APNs Auth Key** (`.p8`) if shipping push — upload to Firebase Cloud Messaging.

### Google

- [ ] Create **Google Play Console** account (one-time fee).
- [ ] Install **Android Studio** + SDK + platform tools (`adb`).
- [ ] Enable Developer options + USB debugging on test phones/tablets.
- [ ] Create Play app listing (package `com.firmshake.app`) when ready for internal track.

### Shared

- [ ] Confirm Firebase project strategy: stay on `firmshake-dev` for TestFlight beta vs create `firmshake-prod`.
- [ ] Confirm API URL for native builds (`VITE_API_BASE_URL` baked in at `vite build` time).
- [ ] Draft/host **Privacy Policy** + **Terms** (marketplace + location + deposits + messaging).
- [ ] Prepare **demo accounts** for store review (buyer + seller; MFA-friendly).
- [ ] Ensure CORS on firmshake-api will allow Capacitor origins when needed (`docs/BFF_PLAN.md` notes Capacitor origins in `CORS_ORIGINS` checklist).

---

## Phase 1 — Local native builds & device testing (before stores)

### 1A. One-time Capacitor platform bootstrap (repo work)

Checklist of what must be done in this repo before first USB install:

- [x] `npm i @capacitor/ios @capacitor/android --save-exact` (match Capacitor 8.4).
- [x] `npm run build` → produces `dist/` (`webDir`).
- [x] `npx cap add ios` → creates `ios/`.
- [x] `npx cap add android` → creates `android/`.
- [x] Add convenience scripts: `build:native`, `cap:sync`, `cap:ios`, `cap:android`.
- [ ] Generate icons/splash from `public/logo.png` (Capacitor Assets / `@capacitor/assets`) — deferred; default Capacitor icons OK for first USB.
- [x] iOS Info.plist usage strings for **Camera**, **Photo Library**, **Location** (When In Use), plus remote-notification background mode.
- [x] Android permissions in `AndroidManifest.xml` (camera, location, notifications / POST_NOTIFICATIONS).
- [ ] Firebase Console: add iOS + Android apps with `com.firmshake.app`; drop `GoogleService-Info.plist` / `google-services.json` per `docs/FIREBASE_SETUP.md`.
- [ ] Auth authorized domains / OAuth redirect URIs for native if using Google Sign-In on device.
- [ ] Build native binary against **reachable API** (staging Cloud Run is fine for early QA; do **not** leave `localhost` or a dead ngrok URL in the baked env).
- [ ] **Machine:** install full Xcode (not only CLT) and select it with `xcode-select`; install JDK + Android Studio/SDK for Gradle.
**Standard sync loop (every web change you want on device):**

```bash
npm run build:native   # build + cap sync
npm run cap:ios        # or: npm run cap:android
```

Equivalent: `npm run build` → `npx cap sync` → `npx cap open ios` / `android`.

For live reload against Vite during early UI work, Capacitor live-reload / `server.url` is optional; for store-like QA, always test a **production `vite build`** embedded in the shell.

**Local API on phone (optional):** README already documents ngrok → set `VITE_API_BASE_URL` → rebuild. Prefer staging API for multi-day device testing so tunnels don’t expire.

### 1B. iOS — physical iPhone + iPad (USB / wireless)

- [ ] Open `ios/App/App.xcworkspace` via `npx cap open ios`.
- [ ] Set Signing Team; unique bundle ID; Debug provisioning (Automatic recommended).
- [ ] Connect iPhone → Trust computer → select device as run destination → Run.
- [ ] Enable **wireless debugging** in Xcode once USB works (Window → Devices).
- [ ] Repeat on **iPad** (same project; pick iPad destination).
- [ ] First launch: accept permission prompts (camera, location, notifications) and confirm they match Info.plist strings.

### 1C. Android — physical phone + tablet

- [ ] `npx cap open android` → Android Studio.
- [ ] Sync Gradle; fix JDK/SDK if prompted.
- [ ] `adb devices` shows phone/tablet.
- [ ] Run → install debug APK.
- [ ] Verify 16 KB page-size / target SDK requirements current for Play (Android Studio will warn on upload later).

### 1D. FirmShake-specific QA checklist

**Guest / auth (critical — differs by platform)**

| Surface | Expected |
|---|---|
| Capacitor native, logged out | Root → **`/login`** (`resolveGuestRootPath`) — **not** `/welcome`, **not** guest browse |
| Mobile web guest | Browse `/tabs/home` + limited tabs (product rule) |
| Desktop web guest | `/welcome` landing |
| Signed-in any platform | `/tabs/home` |

**Phone vs tablet**

- [ ] Browse list + map layout; filter sidebar / mobile filter drawer.
- [ ] Tab bar + toolbar (profile/settings/notifications).
- [ ] Listing create photo picker (native camera path in `ListingPhotoPicker.vue` / `photos.ts`).
- [ ] Listing detail gallery; messaging keyboard insets (`@capacitor/keyboard`).
- [ ] Meetup flow + location permission (`locationTracking.ts`).
- [ ] Push permission + token saved under `users/{uid}/fcmTokens` (if APNs/FCM configured).
- [ ] MFA challenge / password-reset email link behavior on device (Safari vs in-app).
- [ ] Landscape on tablets; safe areas / notch / Dynamic Island.
- [ ] Cold start vs resume; offline Firestore cache (native uses single-tab persistence).

**Env sanity**

- [ ] Images load from API (not broken relative URLs).
- [ ] Browse BFF search works (staging API).
- [ ] Google Maps key allows the native WebView origin / HTTP referrer restrictions updated if map fails.

### 1E. Device matrix (minimum)

| Device | Build | Must-pass |
|---|---|---|
| iPhone (recent iOS) | Debug via Xcode | Login, browse, create listing + camera, message, meetup location |
| iPad | Debug via Xcode | Same + landscape/layout |
| Android phone | Debug via Studio | Same |
| Android tablet | Debug via Studio | Same + landscape |

---

## Phase 2 — TestFlight (iOS internal testing)

Prereqs: Phase 1 stable on your devices; App Store Connect app record created.

- [ ] Bump marketing/build version (Xcode + align with `package.json` later).
- [ ] Archive in Xcode (Any iOS Device) → Distribute App → App Store Connect.
- [ ] Wait for processing; appear in **TestFlight**.
- [ ] Add yourself (+ testers) to **Internal Testing** (App Store Connect users on the team — fastest).
- [ ] Install via TestFlight on iPhone **and** iPad; re-run Phase 1D checklist on a **Release** build (not Debug).
- [ ] Optional: **External Testing** (Beta App Review) if you want non-team testers before production.
- [ ] Capture crash logs / permission regressions before App Store submit.

**Coverage tip:** Internal TestFlight is enough for you alone; use external only if you need wider beta.

---

## Phase 3 — App Store release (iOS first)

### Listing & assets

- [ ] App name, subtitle, description, keywords, category (Shopping / Lifestyle).
- [ ] Support URL + Privacy Policy URL.
- [ ] Screenshots: **iPhone** required; **iPad** if iPad is supported (you plan tablet testing — include iPad shots).
- [ ] App icon (1024×1024) — generate from brand `logo.png`.
- [ ] Age rating questionnaire (user-generated content, messaging → expect 17+ or similar depending on answers).

### Privacy & review hotspots (marketplace / meetup / deposit)

- [ ] App Privacy “nutrition label”: location, photos, contacts? (likely no), user content, identifiers, diagnostics.
- [ ] **Location:** used for meetup ETA / browse geo — justify “when in use”; don’t claim background unless you actually need it.
- [ ] **ATT:** only if you use tracking (IDFA / cross-app ads). FirmShake likely **does not** need ATT unless you add ad SDKs — don’t add ATT prompts “just in case.”
- [ ] **User-generated content:** listings + chat → need reporting/blocking (you already have block users) — document moderation path in review notes.
- [ ] **Payments / deposits:** **v1 intent is live deposits** (Stripe escrow); if a build still mocks payment, say so clearly in review notes. Live money → justify external payments for physical-goods meetups (not digital IAP), refresh Privacy nutrition + Terms. See [`deposit-escrow-payment-plan.md`](./deposit-escrow-payment-plan.md) (App Store section) and [`deposit-presence-anti-fraud-brainstorm.md`](./deposit-presence-anti-fraud-brainstorm.md) (§ H v1 anti-fraud floor).
- [ ] **Account deletion:** Apple requires a way to initiate account deletion in-app or clear link — confirm you have this before submit.
- [ ] **Sign in with Apple:** required if you offer other third-party social logins (e.g. Google) on iOS — verify current Google Sign-In surface and compliance.
- [ ] Reviewer demo: username/password; MFA instructions; sample listing community; test meetup path.

### Submit

- [ ] Select build from TestFlight-processed archive.
- [ ] Submit for Review → address rejections (common: incomplete privacy strings, login issues, broken links, UGC policy).
- [ ] After approval: release manually or automatic; smoke-test production install.

---

## Phase 4 — Android device testing → Play Console

Do after iOS path is proven (or at least TestFlight-stable), so you don’t dual-debug store issues.

### Pre-Play

- [ ] Re-run Phase 1C/1D on Release/`assembleRelease` or Play App Bundle.
- [ ] Create upload keystore; enable **Play App Signing**.
- [ ] Build **AAB** (`bundleRelease`), not only APK.

### Tracks

- [ ] **Internal testing** track — upload AAB; add your Google accounts as testers; install via Play internal link.
- [ ] Fix issues → promote to **Closed** (optional) → **Production**.
- [ ] Complete Play **Data safety**, content rating, target audience, store listing (phone + tablet screenshots recommended).
- [ ] Declare sensitive permissions (location, camera, notifications) with justifications matching Info.plist-equivalents.

### Tablets

- [ ] Ensure layouts aren’t phone-only; declare tablet support honestly in Play Console form factors.

---

## Phase 5 — Ongoing

### Versioning

- [ ] Keep `package.json` version, iOS `CFBundleShortVersionString` / `CFBundleVersion`, and Android `versionName` / `versionCode` in sync each release.
- [ ] Store updates require new binaries for native shell/plugin changes.

### firmshake-dev vs production

| Channel | Firebase | API |
|---|---|---|
| Web daily (`npm run deploy:hosting` / `:devo`) | `firmshake-dev` | Staging Cloud Run |
| CI promote (green integration) | `firmshake-prod` | Prod Cloud Run (us-east1) |
| TestFlight / Play internal (early) | OK to use **dev/staging** if labeled Beta | Staging API |
| App Store / Play production | **production** Firebase + prod API | Production Cloud Run |

Dual-stack plan: [devo-prod-stacks.md](./devo-prod-stacks.md). Prod payments stay **disabled** until explicitly enabled.

Remember: `VITE_*` values are **compile-time**. Changing API/Firebase for a shipped app = new store build (unless you add a remote config layer later).

### OTA vs store updates (Capacitor)

- [ ] **Web-only content** inside the Capacitor WebView can theoretically be updated via a hosted live-update product (Capawesome, Ionic Appflow, etc.) — **not set up today**.
- [ ] **Native plugins, permissions, splash, push entitlements** always need a store binary.
- [ ] Default recommendation for FirmShake now: **store releases for anything user-facing**; keep web Firebase Hosting for browser users. Revisit OTA only after iOS/Android pipelines are boringly reliable.

### Optional CI

- [ ] Later: GitHub Actions to build iOS (macOS runners + certs) and Android (AAB) on tags.
- [ ] Today: local Xcode/Android Studio is enough for first ship.
- [ ] Existing CI (`.github/workflows/deploy-web.yml`) remains web-only.

---

## Concrete “first commands” cheat sheet (when you implement)

```bash
# From firmshake/
npm ci
# set .env.local for the backend you want baked into the native binary
npm i @capacitor/ios @capacitor/android --save-exact
npm run build
npx cap add ios
npx cap add android
npx cap sync
npx cap open ios      # USB install to iPhone/iPad
npx cap open android  # USB install to Android devices
```

After every meaningful frontend change for device QA:

```bash
npm run build && npx cap sync
```

---

## Success criteria by phase

| Phase | Done when |
|---|---|
| 0 | Apple + Play accounts live; bundle ID + privacy URL + backend strategy decided |
| 1 | Debug builds run on all 4 device classes; native guest → `/login`; core marketplace flows work against staging |
| 2 | TestFlight install on your iPhone + iPad; no critical crashes |
| 3 | App Store approved (or clearly understood rejection → fixed) |
| 4 | Play internal → production live |
| 5 | Repeatable version bump + env policy documented |

---

## Bottom line

You are **Capacitor-ready in JS** (`capacitor.config.ts`, plugins, native guest routing) but **not yet store-ready**: there are **no `ios/` or `android/` trees**, no native Firebase config files, no icons/splash pipeline, and no cap sync scripts. Sequence: **accounts → generate platforms → USB QA (iOS then Android devices) → TestFlight → App Store → Play internal → Play production**, keeping **iOS first** end-to-end before investing in Play production.