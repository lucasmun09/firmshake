# Firebase Setup for FirmShake

## 1. Create project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. **Add project** → name it `firmshake` (or `firmshake-dev`)
3. Disable Google Analytics if you don't need it yet

## 2. Enable Authentication

1. **Build → Authentication → Get started**
2. **Sign-in method → Email/Password → Enable**
3. (Later) Enable Google and Apple for mobile

## 3. Create Firestore database

1. **Build → Firestore Database → Create database**
2. Start in **test mode** for development
3. Choose a region close to you (e.g. `us-west2`)

Starter rules for dev:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /listings/{listingId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null
        && request.auth.uid == resource.data.sellerId;
    }
    match /communities/{communityId} {
      allow read: if request.auth != null;
    }
  }
}
```

## 4. Register the web app

1. **Project settings → Your apps → Web** (`</>`)
2. App nickname: `FirmShake Web`
3. Copy the `firebaseConfig` values into `.env.local`

## 5. Register iOS and Android (when ready)

### iOS

1. Add iOS app in Firebase console
2. Bundle ID: match `capacitor.config.ts` → `appId` (`com.firmshake.app`)
3. Download `GoogleService-Info.plist` → `ios/App/App/`

### Android

1. Add Android app in Firebase console
2. Package name: `com.firmshake.app`
3. Download `google-services.json` → `android/app/`

## 6. Environment file

```bash
cp .env.example .env.local
```

| Variable | Where to find it |
|---|---|
| `VITE_FIREBASE_API_KEY` | Project settings → Web app config |
| `VITE_FIREBASE_AUTH_DOMAIN` | same |
| `VITE_FIREBASE_PROJECT_ID` | same |
| `VITE_FIREBASE_STORAGE_BUCKET` | same |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | same |
| `VITE_FIREBASE_APP_ID` | same |
| `VITE_API_BASE_URL` | `http://localhost:5001` or ngrok URL (see firmshake-api) |

## 7. Verify

1. Start API: `cd ../firmshake-api && python app.py`
2. Start app: `npm run dev`
3. Register at `/register`
4. Confirm user in **Authentication → Users**
5. Confirm `users/{uid}` in Firestore
