# CareerDNA Assessment (Quick Site)

A standalone career discovery assessment with **Google Sign-In** and first-login mobile number collection.

## Setup

1. Create Google OAuth credentials at [Google Cloud Console](https://console.cloud.google.com/):
   - APIs & Services → Credentials → Create OAuth client ID → **Web application**
   - Authorized JavaScript origins: `http://localhost:3456`
2. Copy `.env.example` to `.env` and set your values:

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
SESSION_SECRET=your-random-secret
```

3. Install and run:

```bash
cd CareerDNACursor
npm install
npm start
```

Open **http://localhost:3456**

## Auth flow

1. **Sign in with Google** — Gmail SSO required to access the app
2. **First login** — User must provide a 10-digit mobile number
3. **Returning users** — Skip mobile step; go straight to assessment
4. **Student details** — Name and email pre-filled from Google profile

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/config` | Returns Google Client ID |
| `GET /api/auth/session` | Current logged-in user |
| `POST /api/auth/google` | Verify Google ID token, create session |
| `POST /api/auth/profile` | Save mobile number (first login) |
| `POST /api/auth/logout` | End session |
| `GET /api/assessment` | Assessment JSON |
| `POST /api/submit` | Save result JSON (requires auth) |

## Data files

- `data/users.json` — User profiles (email, mobile, Google info)
- `results/` — Assessment result JSON files

## Note

The Python static server (`python -m http.server`) does **not** support Google auth. Use `npm start`.
