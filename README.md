# UniMate

**Your AI-powered university companion.**
Plan smarter. Study better. Graduate stronger.

UniMate is a full-stack academic workspace: it holds a student's courses,
assessments, syllabi, tasks and study history, and answers the questions those
records imply — what is on today, what is coming, how am I doing, what do I
need on what is left, and what should I study next.

It is built on Next.js 15, Supabase (PostgreSQL, Auth, Storage, row level
security) and the Anthropic API, in English and Arabic with full RTL.

**Live:** https://unimate-pied.vercel.app
**Demo sign-in:** `dana.hamad@demo.unimate.app` / `UniMateDemo2026!`

The deployment runs against a Supabase project seeded with the demo data
below. AI features are off there until an `ANTHROPIC_API_KEY` is added — the
rest of the app works without one.

---

## Contents

- [What it does](#what-it-does)
- [Quick start](#quick-start)
- [Supabase setup](#supabase-setup)
- [Deploying to Vercel](#deploying-to-vercel)
- [Architecture](#architecture)
- [The AI agents](#the-ai-agents)
- [Workflows and automation](#workflows-and-automation)
- [Security](#security)
- [Testing](#testing)
- [Demo account](#demo-account)
- [Project structure](#project-structure)
- [What is verified, and what is not](#what-is-verified-and-what-is-not)

---

## What it does

| Area | What you get |
|---|---|
| **Dashboard** | Today's classes, tasks due or overdue, the next 30 days of deadlines, a GPA snapshot, per-course grade progress, and one grounded AI insight. |
| **Timetable scanner** | Photograph or upload a schedule. The courses read out of it appear as editable cards with per-field confidence flags. Nothing is saved until you confirm. |
| **Courses** | Full CRUD. A detail page that walks course → assessments → tasks → syllabus → syllabus events on one screen. |
| **Grades** | Live weighted grade, the exact average needed on what remains, and a plain statement when a target is out of reach plus what is still achievable. GPA calculator with row-by-row working. Editable grading scale. |
| **Study groups** | Matching, not a noticeboard. UniMate already holds every student's timetable, so it computes the hours a group is *all* free — an interval intersection over the members' classes, unit-tested, ranked by how full and how long each window is — and books one as a meeting. Attendance is recorded per person, and each member's turn-up rate is derived from it. Discovery is scoped to your own university; timetables cross between students as anonymous blocks through a security-definer function, never as rows. |
| **Study AI** | Practice questions written from your own course and syllabus topics, in four modes and four difficulty settings, including adaptive, and in the question style you pick — multiple choice, true/false, or mixed. Every answer is recorded and feeds the next set's difficulty. |
| **Flashcards** | Reached from a course's Practice tab, alongside the two written question styles. Cards you write, scheduled by Leitner boxes: recall one and it climbs a box and waits 1, 2, 4, 9 then 21 days; miss it and it drops to box 1 and returns the same day. A finished deck run counts as a practice session, so it feeds the streak. |
| **Notes** | Checklists with reminders, and a note you would want to open: four paper patterns, seven tints tuned separately for light and dark, and twelve drawn stickers you drag anywhere on the page (or nudge with the arrow keys). Paper and stickers are stored as keys, never CSS, and validated on the way in and the way out. |
| **Syllabus centre** | Upload a PDF, Word file or photo. Topics, assessment weights and dated deadlines are extracted, and you can ask the document questions. |
| **Planner** | Light, balanced and intensive semester plans side by side, each stating its trade-off. Timetable conflicts are computed, not guessed. |
| **Tasks** | Manual and AI-generated tasks, grouped by urgency. |
| **Calendar** | Classes, assessments, tasks and reminders in a month grid and an agenda. |
| **Analytics** | Five charts drawn from your own rows, each with a data table. |
| **Records** | Every table UniMate holds, with real delete, plus the AI activity log and the data cleaning log. |
| **Momentum** | A daily streak, XP and levels, an activity heatmap, 18 achievements and a Pomodoro focus timer — all earned from work that leaves a record. Plus a Semester Wrapped card you can save as an image. |
| **Assistant** | A chat that answers from your records, and says so when the answer is not in them. |
| **Hub** | Your own launch page: projects, university pages and anything else you keep hunting for, grouped and pinnable. Rows in your database, so you edit it in the app rather than in a deploy. Addresses are constrained to https by the database, not only the form. |
| **Automation** | The five workflows laid out in the order they happen, each showing what triggers it, what it produces, and its real run history from `ai_runs`. Plus the webhook endpoints and whether they are switched on. |

### Two rules the whole product is built around

1. **Grade arithmetic is never delegated to the model.** Every weighted grade,
   required score and GPA is computed in `lib/calculations`, unit-tested, and
   handed to the agents as fact. A model slip cannot produce a wrong grade
   requirement.
2. **Recorded facts and AI suggestions are visually separate, always.** The
   agents are instructed to answer only from the student's records and to say
   when something is not recorded. They never invent an exam date, a
   prerequisite, a grade or a university policy.
3. **Momentum is earned, and the rules are on screen.** A day counts when you
   complete a task, finish a practice set, log ten focus minutes or enter a
   mark — opening the app earns nothing. XP is capped at 150 a day so showing
   up regularly beats one heroic session, and the full table of what each
   action is worth is printed on the Momentum page rather than hidden.

---

## Quick start

```bash
git clone https://github.com/ghlyahalajmi/uniMate.git
cd uniMate
npm install
cp .env.example .env.local     # then fill it in — see below
npm run dev                     # http://localhost:3000
```

**Requirements:** Node 20+ and a Supabase project. An Anthropic API key is
optional — see the next note.

### Running without an AI key

UniMate works without `ANTHROPIC_API_KEY`. Grades, GPA, the target calculator,
tasks, reminders, the calendar and every chart are computed locally. The
agents that have a deterministic equivalent fall back to it and log the run as
computed offline; the ones that genuinely need a model (question generation,
document reading, chat) show a panel explaining what to add. Nothing silently
breaks.

---

## Supabase setup

### 1. Create a project

At [supabase.com/dashboard](https://supabase.com/dashboard), create a project
and note its URL and publishable (anon) key from **Project Settings → API**.

### 2. Apply the schema

Either paste each file into the SQL editor in order, or use the CLI:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Run in this order if applying by hand:

| File | What it creates |
|---|---|
| `supabase/migrations/0001_schema.sql` | 15 tables, enums, foreign keys, indexes, the new-user trigger |
| `supabase/migrations/0002_rls.sql` | Row level security on every table, forced, with anon grants revoked |
| `supabase/migrations/0003_storage.sql` | Two private buckets with per-user folder policies |
| `supabase/migrations/0004_momentum.sql` | Activity days, achievements and the streak columns on `profiles` |
| `supabase/migrations/0005_flashcards.sql` | The flashcards table, its Leitner columns, and the same forced RLS |
| `supabase/migrations/0006_hub.sql` | The hub links table, an https-only check on the address, and the same forced RLS |
| `supabase/migrations/0009_notes.sql` | Notes and their checklist lines, with per-line reminders |

### 3. Seed the demo data (optional)

```bash
psql "$DATABASE_URL" -f supabase/seed/seed.sql
```

This creates Dana Hamad's account and a full semester of coherent records.
It is safe to re-run — it deletes the demo user first. Every row it writes is
flagged `is_demo = true`, and the interface labels it as demonstration data.

### 4. Prove the isolation

```bash
psql "$DATABASE_URL" -f supabase/tests/rls_isolation_test.sql
```

Eleven checks, all of which must print `PASS`. They create a second student and
confirm that neither can read, update or delete the other's courses, grades,
tasks, syllabi, AI activity, study history or profile, and that the anonymous
role can read nothing at all.

### 5. Fill in the environment

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
ANTHROPIC_API_KEY=sk-ant-...          # optional
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Local Supabase (optional)

`supabase/config.toml` is committed and points the CLI at the seed file, so
`npx supabase start` brings up a complete local stack with the schema and demo
data already loaded. It needs Docker.

---

## Deploying to Vercel

1. Push this repository to GitHub.
2. In Vercel, **Add New → Project** and import it. The framework preset is
   detected automatically; no build command override is needed.
3. Add the environment variables under **Settings → Environment Variables**:

   | Variable | Scope | Notes |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | all | |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | all | Safe in the browser; RLS is the boundary |
   | `ANTHROPIC_API_KEY` | all | Server only. Never prefix with `NEXT_PUBLIC_` |
   | `NEXT_PUBLIC_SITE_URL` | all | Your deployed URL, for auth emails |
   | `ANTHROPIC_MODEL` | optional | Defaults to `claude-opus-5` |
   | `WORKFLOW_WEBHOOK_SECRET` | optional | Enables the automation webhooks |
   | `SUPABASE_SERVICE_ROLE_KEY` | optional | Required only by those webhooks |

4. In Supabase, add your Vercel URL under **Authentication → URL Configuration
   → Redirect URLs**, including `https://your-app.vercel.app/auth/callback`.
5. Deploy.

---

## Architecture

```
Browser ──► Next.js App Router
             ├── Server Components ──► Supabase (as the signed-in user, RLS enforced)
             ├── Server Actions ─────► validated writes (zod) + cleaning_log
             └── Route Handlers ─────► lib/workflows ──► lib/ai/agents ──► Anthropic API
                                              │
                                              └──► ai_runs (every run, always)
```

- **`lib/calculations`** — the arithmetic. No I/O, no model, fully unit-tested.
- **`lib/ai/agents`** — ten agents, each with an explicit input, output,
  trigger and failure state.
- **`lib/ai/run.ts`** — the wrapper every agent goes through. It writes an
  `ai_runs` row *before* the work starts and updates it after, so an operation
  that crashes mid-flight still leaves a trace.
- **`lib/workflows`** — composes agents with the database writes that follow
  them. This is also the seam an external automation platform plugs into.
- **`lib/momentum`** — streak, XP, level and achievement logic as pure
  functions, unit-tested against boundary cases (a missed day, a gap, a
  month rollover, the daily cap). Recording is deliberately forgiving: if the
  momentum write fails, the task the student actually completed still saves.
- **`lib/i18n`** — the Arabic dictionary is typed against the English one, so a
  missing translation is a build error rather than an English word leaking into
  an Arabic screen.

---

## The AI agents

Every agent declares a trigger, an input, an output and what happens when it
fails. "Offline" is what it does with no API key.

| Agent | Trigger | Offline behaviour |
|---|---|---|
| Academic Analyst | student asks | Deterministic pass over completed courses by subject prefix |
| Study Question Generator | practice session starts | None — writing subject questions needs the model |
| Course Planner | student asks | Credit-capped light / balanced / intensive splits |
| Syllabus Analyst | syllabus uploaded | None — reading the document needs the model |
| Grade Coach | grade entered | Full arithmetic, without the written advice |
| Task Planner | student asks | One preparation task per upcoming deadline |
| Study Reminder Agent | exam approaching | Full revision ramp — deterministic by design |
| UniMate Assistant | chat message | None — declines rather than guessing |
| Setup Scanner | timetable uploaded | None — reading an image needs vision |
| Dashboard Insight | dashboard opens | Nearest recorded deadline plus a proportionate nudge |

The revision ramp scales to the time available: fourteen days out it schedules
five steps, a week out three, two days out two.

### Grounding

Every prompt inherits the rules in `lib/ai/prompts.ts`: answer only from the
records provided, say when something is not recorded, mark suggestions as
suggestions, never claim an outcome is guaranteed, and cite the record behind
each recommendation.

---

## Workflows and automation

Five workflows, each logged end to end:

| Workflow | Chain |
|---|---|
| **A — Schedule scan** | image → vision → normalise → **preview** → student confirms → insert → `ai_runs` + `cleaning_log` |
| **B — Syllabus processing** | upload → store → extract → identify dates and weights → store → create reminders → `ai_runs` |
| **C — Grade analysis** | grade entered → recompute → target requirement → coaching → `ai_runs` |
| **D — Upcoming exam** | exam approaching → days remaining → revision ramp → reminders → `ai_runs` |
| **E — Study questions** | request → course context → syllabus topics → weak areas → generate → save session and questions |

### Webhooks

`POST /api/workflows/{reminders|tasks|grade-analysis|analysis}` lets an
external scheduler (n8n, Make, a cron job) drive the same code paths the UI
uses.

```bash
curl -X POST https://your-app.vercel.app/api/workflows/reminders \
  -H "x-unimate-secret: $WORKFLOW_WEBHOOK_SECRET" \
  -H "content-type: application/json" \
  -d '{"user_id":"<uuid>","horizon_days":60}'
```

They are **disabled and return 404** unless `WORKFLOW_WEBHOOK_SECRET` is set,
compare the secret in constant time, and require `SUPABASE_SERVICE_ROLE_KEY`.
This is a trusted server-to-server channel — never expose the secret to a
browser. `GET` on the same path lists the available workflows.

---

## Security

- **Row level security on all 15 tables**, forced, with a policy per operation
  comparing `user_id` to `auth.uid()`. Blanket `anon` grants are revoked so a
  missing policy cannot become an accidental read.
- **Storage** is two private buckets. Objects live under a `<user-id>/` prefix
  and the policies check that prefix, so one student cannot fetch another's
  upload.
- **Auth** uses `getUser()` rather than `getSession()`, so the token is
  validated against the auth server instead of trusted from a cookie.
- **Route protection** runs in middleware *and* in RLS. A missed route leaks
  nothing.
- **API routes authenticate themselves** and answer in JSON — they are excluded
  from the middleware redirect so a 401 never arrives as an HTML page.
- **No secret reaches the browser.** `ANTHROPIC_API_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` and `WORKFLOW_WEBHOOK_SECRET` are read server-side
  only. The settings page reports *whether* AI is configured and which model,
  never the key.
- **Uploads** are validated on type and size (10 MB) on both sides.
- **Errors** are human-readable. Technical detail goes to the server log; the
  student sees "We couldn't load your courses right now. Please try again."

---

## Testing

```bash
npm run typecheck        # strict TypeScript across the project
npm run build            # production build
npm run test:calc        # 47 unit checks: arithmetic, cleaners, streaks and XP
npm run check:responsive # browser checks at 7 widths × 2 locales
```

And against a live database:

```bash
psql "$DATABASE_URL" -f supabase/tests/rls_isolation_test.sql
```

`npm run test:e2e` signs in as the demo student and walks every authenticated
screen; it needs the app running and network access to your Supabase project.

`npm run check:responsive` needs the app running (`PORT=3100 npm start`) and
fails on horizontal overflow, text under 12px, or any interactive target under
32px tall — in both English and Arabic, because RTL reflows the header and is
where those bugs actually appeared.

There is a full manual checklist in [`docs/TESTING.md`](docs/TESTING.md).

---

## Demo account

If you ran the seed:

- **Email** `dana.hamad@demo.unimate.app`
- **Password** `UniMateDemo2026!`

This account is already seeded on the live deployment above.

Dana Hamad, Computer Engineering at Kuwait University, year 3. Eight
completed courses, five active, 22 assessments, two syllabi, seven logged AI
runs and seven cleaning decisions. Her record has a deliberate shape — strong
in programming and digital-systems courses, weaker in pure maths — so the
Academic Analyst has something real to find.

Every row is flagged `is_demo` and labelled in the interface as demonstration
data. It is not real university data and does not describe a real student.

---

## Project structure

```
unimate/
├── app/
│   ├── (app)/              dashboard, courses, grades, study, planner,
│   │                       syllabi, tasks, calendar, analytics, records,
│   │                       assistant, settings, onboarding
│   ├── auth/               sign-in, sign-up, reset, callback, sign-out
│   ├── api/
│   │   ├── ai/             insight, analyst, study, assistant, planner,
│   │   │                   tasks, grade-coach, scan, syllabus
│   │   ├── export/         CSV
│   │   ├── workflows/      automation webhooks
│   │   └── health/
│   ├── globals.css         design tokens, light and dark
│   └── layout.tsx
├── components/
│   ├── ui/                 primitives, forms, toast, modal, states
│   ├── charts/             frame, bar, line
│   ├── shell/              sidebar, mobile nav, icons
│   └── <feature>/          dashboard, courses, grades, study, …
├── lib/
│   ├── supabase/           browser, server and middleware clients
│   ├── calculations/       grades, GPA  (+ unit tests)
│   ├── validation/         zod schemas, data cleaners (+ unit tests)
│   ├── i18n/               en/ar dictionaries, formatters, provider
│   ├── ai/                 client, agents, context, prompts, run
│   ├── workflows/          A–E orchestration
│   └── data/               queries, server actions, CSV
├── supabase/
│   ├── migrations/         0001 schema · 0002 RLS · 0003 storage
│   ├── seed/               demo data
│   └── tests/              RLS isolation test
├── scripts/                responsive check
├── types/                  database types
└── docs/                   setup, architecture, testing
```

---

## What is verified, and what is not

Being straight about this, because "it builds" is not the same as "it works".

**Verified in this repository:**

- The three migrations apply cleanly to PostgreSQL 16, and the seed runs and
  re-runs without error.
- The RLS isolation test passes all 11 checks against a real database.
- 47 unit checks pass on the grade, GPA, cleaning, streak and XP logic,
  including the brief's own worked example and the boundary cases.
- The live database carries 17 tables, 68 policies, and row level security
  enabled and forced on every one of them.
- `npm run build` and `npm run typecheck` are clean, and `npm audit` reports
  zero vulnerabilities.
- Server-side rendering, the locale cookie, full Arabic RTL with no English
  leakage, route protection on all 14 protected paths, JSON 401s from every
  API route, and the webhook's auth paths were all exercised against a running
  production server.
- The responsive check passes at 320/375/390/430/768/1024/1440 in both locales.
- The chart palette passes the six-check colour gate in light and dark.

**Not verified here, and worth doing first:**

- **The authenticated app in a browser.** This session's network policy blocks
  `*.supabase.co` and `*.vercel.app` outright, so neither the local server nor
  any fetch from here could reach the database or the deployment. The schema,
  the policies, the seeded rows and the demo credential were all verified
  directly against the live database, and `scripts/e2e-smoke.mjs` is ready to
  walk the signed-in screens the moment it runs somewhere with network access.
- **The AI agents against the live API.** No key was configured here. The
  prompts, schemas and fallbacks are in place and the offline paths were
  exercised, but the model's actual output has not been seen.
- **Authenticated screens in a browser.** The responsive check covers the
  public pages; the signed-in screens need a session.

---

Built as a student project. UniMate organises the academic information you
give it. It is not an official university system and does not replace your
registrar.
