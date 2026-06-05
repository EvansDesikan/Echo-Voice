# ECHO Voice — Production Deployment on Railway.app

> **Goal:** Run the full ECHO Voice stack with a real backend — FastAPI, PostgreSQL, MinIO, and the React frontend served via Vercel — so that the onboarding flow, voice cloning, and family chat all work end-to-end.

---

## Architecture Overview

```
Vercel (React frontend)
        │
        │ HTTPS API calls
        ▼
Railway.app
  ├── api      (FastAPI + Whisper — Docker image from your repo)
  ├── postgres (Railway managed PostgreSQL)
  └── minio    (MinIO for audio file storage)
```

---

## Step 1 — Push your code to GitHub (already done)

Your repo is at: https://github.com/EvansDesikan/Echo-Voice

Make sure the latest commits are pushed before deploying.

---

## Step 2 — Create a Railway project

1. Go to https://railway.app and sign in (GitHub login works)
2. Click **New Project → Deploy from GitHub repo**
3. Select `EvansDesikan/Echo-Voice`
4. Railway will auto-detect the root — you'll configure services manually next

---

## Step 3 — Add PostgreSQL

1. In your Railway project, click **+ New** → **Database** → **PostgreSQL**
2. Railway provisions it instantly and gives you a `DATABASE_URL` variable
3. Copy it — you'll paste it into the API service env vars

---

## Step 4 — Add MinIO (via Docker image)

1. Click **+ New** → **Docker Image**
2. Image: `minio/minio`
3. Start command: `server /data --console-address ":9001"`
4. Add env vars:
   ```
   MINIO_ROOT_USER=minioadmin
   MINIO_ROOT_PASSWORD=minioadmin
   ```
5. Note the internal Railway hostname (e.g. `minio.railway.internal`) — use this as `MINIO_ENDPOINT`

---

## Step 5 — Deploy the FastAPI backend

1. Click **+ New** → **GitHub Repo** → select `EvansDesikan/Echo-Voice`
2. Set **Root Directory** to `/` (the Dockerfile.api is at `docker/Dockerfile.api`)
3. Set **Dockerfile Path** to `docker/Dockerfile.api`
4. Set **Port** to `8000`

### Environment variables to set on the API service:

```
ANTHROPIC_API_KEY=sk-ant-...
ELEVENLABS_API_KEY=...
DATABASE_URL=<paste from Step 3>
MINIO_ENDPOINT=minio.railway.internal:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
WHISPER_MODEL=base          # use "base" on Railway free tier (less RAM); large-v3 needs 10GB+
WHISPER_DEVICE=cpu
SECRET_KEY=<generate a long random string>
DEBUG=false
CLAUDE_MODEL=claude-haiku-4-5-20251001
CLAUDE_MAX_TOKENS=256
ELEVENLABS_MODEL=eleven_turbo_v2_5
```

> **Whisper note:** `large-v3` requires ~10GB RAM. Railway's free tier gives 512MB–8GB depending on plan. Use `base` (74MB) for initial deployment; upgrade to `small` or `medium` as the plan allows.

6. Click **Deploy**

---

## Step 6 — Run database migrations

Once the API service is running, open a Railway shell:

1. Go to your API service → **Shell** tab
2. Run:
   ```bash
   python -m alembic upgrade head
   ```
   (or whatever migration command is set up in `scripts/`)

---

## Step 7 — Update the Vercel frontend to point to Railway

The frontend needs to know the Railway API URL instead of `/api` (which was the local proxy).

### Option A — CORS proxy via Vercel rewrites (recommended)

In `frontend/vercel.json` (create if missing):
```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://your-api-service.up.railway.app/api/$1"
    }
  ]
}
```

Replace `your-api-service.up.railway.app` with your actual Railway API public URL.

The frontend code in `client.ts` already uses `/api/...` paths — this rewrite makes Vercel proxy those calls to Railway without CORS issues.

### Option B — Set VITE_API_BASE env var (alternative)

In Vercel dashboard → Environment Variables:
```
VITE_API_BASE=https://your-api-service.up.railway.app
```

Then update `client.ts`:
```ts
const BASE = import.meta.env.VITE_API_BASE || '/api'
```

---

## Step 8 — Remove `import.meta.env.PROD` demo mode override

Once the real backend is live, the frontend should NOT force demo mode in production.

In `frontend/src/api/client.ts`, change:
```ts
export const DEMO_MODE =
  import.meta.env.PROD ||           // ← remove this line
  import.meta.env.VITE_DEMO_MODE === 'true' ||
  ...
```

To:
```ts
export const DEMO_MODE =
  import.meta.env.VITE_DEMO_MODE === 'true' ||
  new URLSearchParams(location.search).get('demo') === 'true' ||
  localStorage.getItem('echo_demo_mode') === 'true'
```

Then redeploy on Vercel. Demo mode can still be activated manually via `?demo=true` in the URL.

---

## Step 9 — Test the full pipeline

1. Open the Vercel URL
2. Go through onboarding — consent → voice recordings → questionnaire → phrases → memories
3. At the end, the `/onboard/build-personality` call triggers ElevenLabs voice clone creation
4. Use the returned `client_id` as the family access code at `/family`
5. Start a session and send a text message — you should get a real Claude response in the cloned voice

---

## Cost estimate (per active month)

| Service | Cost |
|---|---|
| Railway Hobby plan | ~$5/month |
| PostgreSQL on Railway | ~$5/month |
| MinIO storage (audio files) | ~$0.02/GB |
| Anthropic API (Haiku, ~100 sessions) | ~$2–5 |
| ElevenLabs Starter plan | $5/month (30 min TTS) |
| **Total** | **~$17–20/month** |

---

## What stays on Vercel

The React frontend stays on Vercel (free tier). No change needed except the API URL rewrite in Step 7.

---

## Checklist

- [ ] Repo pushed to GitHub
- [ ] Railway project created
- [ ] PostgreSQL provisioned
- [ ] MinIO service running
- [ ] API service deployed with all env vars
- [ ] DB migrations run
- [ ] Vercel rewrite pointing to Railway API URL
- [ ] `import.meta.env.PROD` demo override removed from `client.ts`
- [ ] End-to-end test: onboarding → session → voice response
