# Where are Aifert & Hogan

Password-gated adventure map for the Nov 2026–Jan 2027 trip. One FastAPI
process serves `/api` and the static Next.js export.

## Render deploy (exact settings)

Create from this Blueprint:

[https://dashboard.render.com/blueprint/new?repo=https://github.com/Aifert/where-are-aifert-and-hogan](https://dashboard.render.com/blueprint/new?repo=https://github.com/Aifert/where-are-aifert-and-hogan)

If the dedicated repo could not be created and this folder lives in
`Aifert/Aifert` on branch `trip-map`:

[https://dashboard.render.com/blueprint/new?repo=https://github.com/Aifert/Aifert](https://dashboard.render.com/blueprint/new?repo=https://github.com/Aifert/Aifert)

Then set **Root Directory** to `trip-map`.

### Web service

| Setting | Value |
| --- | --- |
| Type | Web service |
| Runtime | Docker |
| Region | Singapore |
| Instance | Starter |
| Branch | `main` (or `trip-map` if deploying the fallback folder) |
| Root directory | repo root, or `trip-map` on the fallback repo |
| Dockerfile path | `./Dockerfile` |
| Docker context | `.` |
| Health check path | `/api/health` |
| Auto-deploy | On commit |

There is no separate build/start command. The image builds the Next.js
export, then starts:

```text
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### Postgres

| Setting | Value |
| --- | --- |
| Plan | Basic (`basic-256mb`) |
| Database name | `tripmap` |
| Postgres | 16 |
| Region | Singapore (same as the web service) |

Wire `DATABASE_URL` from the database **internal** connection string
(`fromDatabase` in `render.yaml`).

### Environment variables

| Name | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | From the Render Postgres instance |
| `APP_PASSWORD` | yes | Set to `CONQUERTHEWORLD` |
| `SESSION_SECRET` | yes | Blueprint generates one; or paste a long random string |
| `PORT` | set by Render | Bind `0.0.0.0:$PORT` |
| `STATIC_DIR` | optional | Defaults to `/app/static` in the image |

Do not commit the password. Tables and seed data are created on first
boot if the `stops` table is empty.

## Local run

```bash
# Postgres
docker compose up -d db
# or any Postgres 16 with DATABASE_URL

cd frontend && npm ci && npm run build && cd ..
python3 -m venv .venv && . .venv/bin/activate
pip install -r backend/requirements.txt
export DATABASE_URL=postgresql://trip:trip@127.0.0.1:5432/trip
export APP_PASSWORD=CONQUERTHEWORLD
export SESSION_SECRET=dev-secret-change-me
export STATIC_DIR="$PWD/frontend/out"
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Open http://127.0.0.1:8000/login/ and sign in with `CONQUERTHEWORLD`.

```bash
cd backend
DATABASE_URL=postgresql://trip:trip@127.0.0.1:5432/trip \
APP_PASSWORD=CONQUERTHEWORLD \
SESSION_SECRET=dev-secret-change-me \
pytest -q
```
