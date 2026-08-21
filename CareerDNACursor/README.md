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

## Persistent Supabase storage

1. Create a Supabase project.
2. In its SQL Editor, run [supabase-schema.sql](supabase-schema.sql).
3. In Supabase Project Settings > API, copy the project URL and **service_role** key.
4. Add these server-side environment variables locally and in Render:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

With those variables present, Google profiles are stored in `students` and completed assessments are stored in `assessment_results`. Without them, the app uses local JSON files for development only.

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
| `POST /api/auth/theme` | Save the user's preferred theme (footer slider) |
| `POST /api/auth/logout` | End session |
| `GET /api/assessment` | Version 4 assessment JSON |
| `GET /api/assessment/resume` | Returns the current v4 assessment for a signed-in user |
| `POST /api/submit` | Save result JSON (requires auth) |

## Data files

- `data/users.json` — User profiles (email, mobile, Google info)
- `data/assessment-v4.json` — Expanded assessment (displayed as Version 4.0)
- `results/` — Assessment result JSON files

## Database migration

Run the updated `supabase-schema.sql` before deploying this change. Assessment progress is stored against version 4 and must be saved explicitly from the assessment screen. The migration also adds a `theme` column to `students` so each user's footer-slider theme choice is persisted server-side and restored on sign-in (falls back to `localStorage` for anonymous visitors).

## Theming

The footer slider switches between 8 themes (Day, Sunset, Light Pink, Light Blue, Neon, Emerald, Sapphire, Night). For signed-in users the choice is saved to `students.theme` via `POST /api/auth/theme` and re-applied on the next login; anonymous users keep it in `localStorage` (`careerdna-theme`).

## Note

The Python static server (`python -m http.server`) does **not** support Google auth. Use `npm start`.
