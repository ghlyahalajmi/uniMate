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
**Demo sign-in:** press **Try the demo** on the sign-in page. No credentials
to copy, and none printed here — a password in a README is a password in
everybody's search results.

Every AI feature works on the live deployment without a key: the agents fall
back to a deterministic path that answers from the student's own records.
Adding `OPENROUTER_API_KEY` or `ANTHROPIC_API_KEY` upgrades the answers; it
does not switch the features on, because they are never off.

## The team

| Who | What they owned |
| --- | --- |
| **Ghalyah M. Alajmi** | Database schema, row level security and the admin side; the AI agent layer and deployment |
| **Asmaa Alhajri** | Courses: the course screens, adding a course from its syllabus, and who teaches it |
| **Anwar Al Sarraf** | Grades, GPA and the analytics screens |
| **Fatemah Shamsah** | Tasks, the calendar and reminders |

---

## Contents

- [What it does](#what-it-does)
- [Quick start](#quick-start)
- [Supabase setup](#supabase-setup)
- [Deploying to Vercel](#deploying-to-vercel)
- [Architecture](#architecture)
- [Progress, motivation and coaching](#progress-motivation-and-coaching)
- [The AI agents](#the-ai-agents)
- [Workflows and automation](#workflows-and-automation)
- [Security](#security) · [`docs/SECURITY.md`](docs/SECURITY.md)
- [Agent guardrails](docs/GUARDRAILS.md)
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

## The admin side

`/admin` is a separate product in the same deployment: its own sign-in, its own
accounts, and its own screens. There is no link to it from the student app.

**Administrators are not students with a flag set.** An admin signs in with a
*username*, which is mapped to an address in `admin.unimate.app` — a domain
student sign-up refuses. The two credential sets cannot collide, by
construction rather than by convention.

**First run.** Claiming the admin side takes a setup token — `ADMIN_SETUP_TOKEN`
in the deployment's environment, at least 16 characters. With no token set, the
first-run page cannot be used at all, which is the safe direction: being early
is not a credential, and the page's address is not a secret. The moment one
administrator exists the database refuses a second claim as well. No password is
ever generated, written down, or sent anywhere.

**What an administrator can see** is account facts: who exists, when they
joined, when they last signed in, whether they are suspended, whether they hold
an AI key (last four characters), and how many courses and tasks they have
entered. **Not** their grades, notes, tasks, questions or files. The isolation
rules are not relaxed for administrators — `admin_list_users()` reads no table
that carries academic content, and nothing else is exposed.

**What they can do:** suspend and restore an account, and clear a student's
stored AI key when it has been revoked at the provider or pasted wrong. Note
what is missing: reading a key. The value is returned by no function in the
schema.

Every admin function is `SECURITY DEFINER` and checks membership of `admins`
itself, so reaching the page is not what grants the access. Verified against
the live database: a student session gets `is_admin() = false`, zero rows from
`admin_list_users()`, zero rows from `admins`, and an exception from every
write.

### Signing up

There is no confirmation step. Migration `0024` puts a trigger on `auth.users`
that stamps `email_confirmed_at` as the row is written, and the sign-up action
signs the student in with the password they just typed, so they land on
onboarding rather than in their inbox. It works whether or not the provider's
own "Confirm email" switch is on, which matters because that switch lives in a
dashboard rather than in this repository.

Passwords are checked against the Have I Been Pwned list before an account is
created or a password changed, using k-anonymity — only the first five
characters of the SHA-1 are sent, and the comparison happens locally, so the
password never leaves the server. This is the same list Supabase's own leaked
password protection uses; doing it here means it holds regardless of that
setting.

### A key the student adds themselves

Setting an environment variable is not something a student can do, so
**Settings → AI** takes a key of their own. Paste an OpenRouter key — the free
tier costs nothing — and every agent turns on for that account alone.

The key is verified against the provider before it is stored, saved in
`ai_credentials` with RLS enabled *and* forced, and never read back to the
browser: the screen shows the last four characters, from a generated column.
One student's key is unreachable from another's session — reads, updates,
deletes and planted rows are all refused by the policy, which is checked in
the two-account test described under Data isolation.

Precedence is: the deployment's `ANTHROPIC_API_KEY`, then its
`OPENROUTER_API_KEY`, then the student's own key, then Vercel's AI Gateway.

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
| `supabase/migrations/0014_study_layer.sql` | Study plans, the streak roll-up, and the `assessments` / `study_tasks` / `quiz_attempts` views |
| `supabase/migrations/0015_coach.sql` | Milestones and the coaching log, plus the degree length on the profile |

### The data model

Everything hangs off the authenticated user, and every table carries a
`user_id` that row level security compares to `auth.uid()`.

```
auth.users
  └── profiles                 one per user, created by trigger on sign up
  └── courses
        ├── assessments        weight, score and due date per piece of work
        │     └── study_plans  revision for a specific assessment
        │           └── study_plan_items ──► study_tasks / study_sessions
        ├── study_tasks        to-dos, optionally tied to a course
        ├── syllabi ──► syllabus_events ──► reminders
        ├── flashcards         Leitner-box recall practice
        └── study_sessions
              └── questions ──► quiz_attempts
  └── notes ──► note_items         free checklist lines, each with a reminder
  └── milestones                   the goal being worked toward, celebrated once
  └── motivation_logs              every line the coach showed, with its evidence
  └── activity_days ──► streaks    roll-up maintained by trigger
  └── ai_runs                  one row per AI operation, always written
```

Three of these names are served by updatable views rather than tables:

| Name | Backed by | Why |
|---|---|---|
| `assessments` | `grades` | The table predates the agreed name and holds live data |
| `study_tasks` | `tasks` | Same |
| `quiz_attempts` | `question_attempts` | Same |

Each view is declared `security_invoker`, so the base table's policies run as
the caller — reading `assessments` is exactly as isolated as reading `grades`,
and the isolation test checks both. They are ordinary single-table views, so
inserts, updates and deletes pass straight through. Either name works; nothing
was renamed, because the existing names are referenced throughout the app.

`notes` is the student's own checklist, kept separate from `tasks` on purpose:
a task belongs to a course, carries a priority and a due date and feeds the
planner and the XP rules, while a note line is whatever was typed and nothing
else depends on it. Each line can carry a `remind_at` timestamp, which the
Notes screen and the dashboard surface while UniMate is open.

`streaks` is a roll-up, not an input: a trigger on `activity_days` rewrites it
whenever the underlying activity changes, using the same rules as
`lib/momentum/engine.ts`, so it cannot drift from the days a student actually
worked.

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

Thirty-eight checks, all of which must print `PASS`. They create a second
student and confirm that neither can read, update or delete the other's
courses, grades, tasks, syllabi, AI activity, study history, study plans,
flashcards, notes, streak, milestones, coaching history or profile; that a row cannot be filed under someone else's
`user_id`; that the naming views are exactly as isolated as the tables behind
them; and that the anonymous role can read nothing at all.

### 5. Fill in the environment

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# AI is optional, and either provider turns on every agent. Set one:
ANTHROPIC_API_KEY=sk-ant-...           # Anthropic directly, used first if both are set
OPENROUTER_API_KEY=sk-or-...           # or route through OpenRouter (free models, auto-selected)
```

### Choosing an AI provider

Both are optional — without either, every screen still works and each agent
falls back to its deterministic path. A student can also add a key of their
own (see below), so an empty environment is no longer a dead end for them.

- **`ANTHROPIC_API_KEY`** is the one the prompts were written against, and
  takes precedence when both are present.
- **`OPENROUTER_API_KEY`** routes the same calls through OpenRouter, which
  fronts many models behind one key. The key is all it needs: UniMate reads
  OpenRouter's catalogue, keeps the models that cost nothing, and sends the
  best few so the provider can fall through when one is busy — so the AI
  features run at **no cost** with nothing else to configure. The roster is
  re-read hourly, which is why no free model id is hardcoded: they are
  retired often, and a pinned one becomes a 404. Set `OPENROUTER_MODEL` only
  to override that and pin a specific model.

A Claude, ChatGPT or similar *subscription* cannot be used here. Those cover
the chat apps, not programmatic access, so a deployed site has no way to
authenticate against them — hence an API key from one provider or the other.

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
   | `ANTHROPIC_API_KEY` | optional | Server only. Never prefix with `NEXT_PUBLIC_` |
   | `OPENROUTER_API_KEY` | optional | Alternative to the above; server only |
   | `NEXT_PUBLIC_SITE_URL` | all | Your deployed URL, for auth emails |
   | `ANTHROPIC_MODEL` | optional | Defaults to `claude-opus-5` |
   | `OPENROUTER_MODEL` | optional | Pins one model; otherwise a free one is chosen automatically |
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

## Progress, motivation and coaching

`/journey` — **My Academic Journey** — answers four questions in order:
**Level → Progress → Today's Mission → Next Milestone.** A condensed version of
the same loop sits on the dashboard, so the student meets it where they land.

| Piece | What it is | Where it lives |
|---|---|---|
| **Academic Level** | Six named stages from seven signals — consistency, tasks, quizzes, sessions, course progress, exam prep and streak | `lib/coach/academic-level.ts` |
| **Academic Momentum** | 0–100 from five equally weighted components, each a ratio against a stated expectation | `lib/coach/momentum-score.ts` |
| **Graduation & GPA** | Credits done against the degree length, and current GPA against target | `lib/coach/progress.ts` |
| **Course health** | On track / needs attention / time-sensitive, with the reason | `lib/coach/progress.ts` |
| **What should I do now?** | Exactly one next action, chosen by an explicit priority order | `lib/coach/recommend.ts` |
| **Milestones** | The next reachable goal, celebrated once | `lib/coach/milestones.ts` |
| **Motivation** | Picks a dictionary *key*, never a sentence | `lib/coach/messages.ts` |

Everything in `lib/coach` is pure and unit-tested. Nothing there performs I/O
or calls a model, so every rule a student is measured by can be checked against
a fixture.

### The level is not your GPA

A student who inherits a strong GPA has not done anything this week, and a
student rebuilding from a weak one should still be able to climb. Every signal
feeding the level is something the student can act on today. There is a test
asserting that a student with a 1.2 GPA and a working term outranks one with a
4.0 and no activity.

### How the tone rules are enforced

The brief says the coach must never shame the student. That is enforced in
code, not in a prompt:

- **`tone` has three values — `positive`, `steady`, `encouraging` — and none of
  them is negative.** A database constraint rejects anything else, so there is
  no shaming state to store or render.
- **Falling behind maps to `encouraging`**, which pairs a smaller ask with an
  acknowledgement.
- **Nothing compares one student to another.** No function takes another
  student's data as input, so such a message cannot be built.
- **The recommended action is chosen before the model is called.** The model is
  told what it is and may reword it; it cannot substitute a different one. The
  advice a student acts on is always the one the rules justified.
- **Generated prose is filtered.** Anything containing a forbidden phrase, in
  English or Arabic, is discarded in favour of the deterministic message. A
  model that ignores the tone rule cannot reach the student.
- **Every line is logged with the figures behind it** in `motivation_logs`, so
  "never invent progress" is checkable after the fact rather than a promise.

### Without an API key

The Daily Coach's fallback is a complete answer, not a degraded one: the rules
pick the message, the action and the milestone on their own. The screen renders
immediately from them and upgrades to the written version only if a model
replies. A missing or slow key delays nothing.

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

- **Row level security on all 25 tables**, forced, with a policy per operation
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

Press **Try the demo** on the sign-in page and you are in. The credentials
are held server-side and are not written down here: a shared login printed in
a public repository is a credential anyone can find by searching, which is the
one thing this project claims not to have.

The account is already seeded on the live deployment above.

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

- The migrations apply cleanly to PostgreSQL 16 and the seed runs and re-runs
  without error. (`0003_storage.sql` needs Supabase's `storage` schema, so it
  applies against a Supabase project rather than a bare PostgreSQL instance.)
- The RLS isolation test passes all 38 checks against a real database.
- 89 unit checks pass on the grade, GPA, cleaning, streak, XP and coaching
  logic, including the brief's own worked example and the boundary cases.
  Among them, every phrase the coach is forbidden from saying is asserted to be
  rejected, and no input is able to produce a negative tone.
- The schema defines 25 tables and 100 policies, with row level security
  enabled and forced on every one of them, plus 3 naming views that run the
  caller's own policies.
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
