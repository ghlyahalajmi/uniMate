# Setup

Step by step, from an empty machine to a deployed app.

## 1. Local

```bash
git clone https://github.com/ghlyahalajmi/uniMate.git
cd uniMate
npm install
cp .env.example .env.local
```

Node 20 or newer.

## 2. Supabase

### Create the project

[supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
Pick a region near your users; `eu-central-1` is a reasonable default for
Kuwait. Note the database password — you will need it for `psql`.

From **Project Settings → API**, copy:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **Publishable / anon key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The anon key belongs in the browser. Row level security, not key secrecy, is
what keeps one student's data away from another's.

### Apply the schema

**Option A — SQL editor.** Paste each file's contents and run, in order:

1. `supabase/migrations/0001_schema.sql`
2. `supabase/migrations/0002_rls.sql`
3. `supabase/migrations/0003_storage.sql`

**Option B — CLI.**

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### Seed the demo data

Get the connection string from **Project Settings → Database → Connection
string → URI**, then:

```bash
export DATABASE_URL='postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres'
psql "$DATABASE_URL" -f supabase/seed/seed.sql
```

Sign in afterwards as `sara.alajmi@demo.unimate.app` / `UniMateDemo2026!`.

Skip this if you want an empty project — the app handles a fresh account
properly and shows a welcome panel rather than an empty dashboard.

### Verify the isolation

```bash
psql "$DATABASE_URL" -f supabase/tests/rls_isolation_test.sql
```

All eleven lines must read `PASS`. If any reads `FAIL`, stop and fix it before
putting real student data in.

### Auth settings

Under **Authentication → URL Configuration**, set the site URL and add these
redirect URLs:

```
http://localhost:3000/auth/callback
https://your-app.vercel.app/auth/callback
```

For a quicker first run, turn off **Confirm email** under
**Authentication → Providers → Email**.

## 3. Anthropic (optional)

Get a key at [console.anthropic.com](https://console.anthropic.com) and add it
as `ANTHROPIC_API_KEY`. It is read server-side only.

Without it the app still runs: everything numeric is computed locally, the
agents that have a deterministic equivalent use it, and the rest explain what
is missing.

## 4. Run it

```bash
npm run dev     # http://localhost:3000
```

Check `http://localhost:3000/api/health` — it reports which integrations are
configured, without exposing any values.

## 5. Local Supabase stack (optional)

`supabase/config.toml` is committed and points at the seed file:

```bash
npx supabase start     # needs Docker
```

It prints a local URL and anon key for `.env.local`, and loads the schema and
demo data automatically. `npx supabase stop` when you are done.

## 6. GitHub

```bash
git remote add origin https://github.com/<you>/uniMate.git
git push -u origin main
```

`.gitignore` already excludes `.env.local`. Check before your first push that
no key is staged:

```bash
git diff --cached | grep -iE "sk-ant|service_role|SUPABASE_ANON"
```

## 7. Vercel

1. **Add New → Project**, import the repository. No build overrides needed.
2. Add the environment variables from the table in the README.
3. Deploy.
4. Add the deployed URL to Supabase's redirect URLs.
5. Open `/api/health` on the deployed URL and confirm what is configured.

## 8. Automation (optional)

To let n8n, Make or a cron job drive the workflows, set both:

- `WORKFLOW_WEBHOOK_SECRET` — a long random string
- `SUPABASE_SERVICE_ROLE_KEY` — from **Project Settings → API**

Then:

```bash
curl -X POST https://your-app.vercel.app/api/workflows/reminders \
  -H "x-unimate-secret: $WORKFLOW_WEBHOOK_SECRET" \
  -H "content-type: application/json" \
  -d '{"user_id":"<student-uuid>","horizon_days":60}'
```

The service role key bypasses row level security. Keep it server-side, and
never put either value anywhere a browser can reach.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Every page redirects to sign-in | Supabase URL or anon key wrong in `.env.local` |
| "Invalid API key" | The `service_role` key was used where the anon key belongs |
| Sign-up succeeds but sign-in fails | Email confirmation is on and the address is unconfirmed |
| AI screens say "not switched on" | No key anywhere: set `ANTHROPIC_API_KEY` or `OPENROUTER_API_KEY` for everyone (not with a `NEXT_PUBLIC_` prefix), or paste a free OpenRouter key in Settings → AI for one account |
| Webhooks return 404 | `WORKFLOW_WEBHOOK_SECRET` is unset — they are disabled by design |
| Webhooks return 500 | `SUPABASE_SERVICE_ROLE_KEY` is missing |
| Seed fails on `auth.users` | Run it against the database directly, not through PostgREST |
| Sign-up email links point at localhost | Set the Site URL and Redirect URLs in Supabase → Authentication → URL Configuration to the deployed origin. Password sign-in (including the demo account) works without this; only emailed links need it |
| Charts are empty | There are no rows yet — this is the intended empty state, not a bug |
