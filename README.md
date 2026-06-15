# FirmShake

Community-first marketplace with binding in-person meetups, privacy-preserving proximity, and deposit-backed accountability.

**Ionic Vue + Capacitor** client for web, iOS, and Android.

The Flask API lives in a **separate repo**: [`firmshake-api`](../firmshake-api) (sibling directory).

## Stack

| Layer | Technology | Repo |
|---|---|---|
| Mobile + Web | Ionic Vue + Capacitor | **firmshake** (this repo) |
| Auth | Firebase Authentication | this repo |
| Database | Cloud Firestore | this repo |
| API + Images | Flask | **firmshake-api** |
| Payments (later) | Stripe | firmshake-api |

## Quick start

### 1. Firebase

Follow [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md), then:

```bash
cp .env.example .env.local
```

### 2. API server (separate repo)

```bash
cd ../firmshake-api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

API runs at `http://localhost:5001`.

### 3. Run the app

```bash
./start.sh
```

Or:

```bash
npm start
```

Web dev server: `http://localhost:5173`.

### 4. Mobile testing against local API

Phones cannot reach `localhost`. Tunnel the API and update `.env.local`:

```bash
# In firmshake-api directory
ngrok http 5001
```

```bash
# firmshake/.env.local
VITE_API_BASE_URL=https://your-tunnel.ngrok.io
```

## Current milestone focus

1. **Login** — Firebase Auth (email/password)
2. **Marketplace** — browse/create listings with placeholder + uploaded images
3. **API images** — upload via firmshake-api `POST /api/images`

See [docs/MILESTONES.md](docs/MILESTONES.md).

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Milestones](docs/MILESTONES.md)
- [Firebase setup](docs/FIREBASE_SETUP.md)

## Related repo

| Repo | Path | Purpose |
|---|---|---|
| **firmshake** | this repo | Ionic Vue client |
| **firmshake-api** | `../firmshake-api` | Flask API + image storage |
