# Contributing to UniMate

Thanks for helping build this. This page gets you from a fresh clone to a
running app, and explains the few conventions worth keeping.

---

## Getting set up

### 1. Clone and install

```bash
git clone https://github.com/ghlyahalajmi/uniMate.git
cd uniMate
npm install
cp .env.example .env.local
```

You need **Node 22 or newer**.

### 2. Get a database

You have two options, and the second is usually the right one.

**Option A — your own Supabase project (recommended).**
Free, takes five minutes, and you can break it without affecting anyone. Follow
[`docs/SETUP.md`](docs/SETUP.md): create a project, run the four migrations in
`supabase/migrations/` in order, then run `supabase/seed/seed.sql` for the demo
student.

**Option B — share the project the team already uses.**
Ask whoever set it up for the project URL and the **anon** key. Row level
security means your account only ever sees your own rows, so sharing a database
does not mean sharing data — sign up your own account and you get an empty
workspace.

Never ask for, share, or commit the **service role** key. It bypasses row level
security entirely.

### 3. Run it

```bash
npm run dev      # http://localhost:3000
```

`http://localhost:3000/api/health` tells you which integrations are configured.

### AI features are optional

Without `ANTHROPIC_API_KEY`, everything except the AI screens works —
grades, GPA, tasks, reminders, the calendar, the charts and the whole momentum
layer are computed locally. The AI screens explain what is missing rather than
erroring. Don't feel you need a key to contribute.

---

## Before you push

```bash
npm run typecheck
npm run test:calc
npm run build
```

CI runs all of these plus lint, an audit, and the responsive checks. Running
them locally first saves a round trip.

To run the responsive checks yourself:

```bash
PORT=3100 npm start &
BASE=http://localhost:3100 npm run check:responsive
```

---

## How we work

- **Branch off the default branch.** Name it after what it does:
  `feature/course-notes`, `fix/arabic-calendar-overflow`.
- **One thing per pull request.** A small PR gets reviewed today; a large one
  gets reviewed eventually.
- **Write the commit message for the person reading it in six months.** A
  subject line under ~72 characters saying what changed, then a body saying
  why, if why is not obvious.
- **Fill in the PR template.** The checklist is short and every item on it has
  caught a real bug at some point.

---

## Conventions that matter

These are not style preferences. Each one exists because breaking it produces a
specific, real problem.

### Numbers are computed in `lib/`, never by the model

Every grade, weighted average, required score, GPA, streak and XP total is
computed by a pure function in `lib/calculations/` or `lib/momentum/`, unit
tested, and handed to the AI agents as fact. A model that does its own
arithmetic will eventually tell a student they need 72% when they need 96%.

If you add a calculation, add it there and add a test.

### Every user-facing string goes in both dictionaries

`lib/i18n/dictionaries.ts` exports `en` as the source of truth and types `ar`
against its shape. A missing Arabic key is a **build error**, not a runtime
surprise. Add both, and use the existing interpolation (`{n}`, `{course}`)
rather than string concatenation — word order differs between the languages.

### Arabic is not an afterthought

Check your screen with the language switcher. Use logical CSS properties
(`ms-*`, `me-*`, `start`, `end`) rather than `left`/`right`, so the layout
mirrors on its own.

### Every table needs row level security

A new table gets `user_id`, RLS enabled *and* forced, and a policy per
operation comparing `user_id` to `auth.uid()`. Copy the pattern in
`supabase/migrations/0002_rls.sql`. Then prove it:

```bash
psql "$DATABASE_URL" -f supabase/tests/rls_isolation_test.sql
```

Every line must read `PASS`.

### Migrations are append-only

Add `0005_whatever.sql`; never edit a migration that has already been applied
to a shared database. Others have already run it.

### Errors are readable

The student sees "We couldn't load your courses right now. Please try again."
The console sees the actual error. Never put a Postgres error code or an API
message on screen.

### Recorded fact and AI suggestion look different

If you surface something a model produced, render it through the `Provenance`
component so it is visibly a suggestion. Never let a model's guess read as a
statement from the university.

---

## Where things live

```
app/(app)/      the signed-in screens
app/auth/       sign in, sign up, reset
app/api/        AI routes, CSV export, automation webhooks
components/     ui/ primitives, charts/, shell/, then one folder per feature
lib/calculations/  grade and GPA maths        (pure, tested)
lib/momentum/      streaks, XP, achievements  (pure, tested)
lib/ai/            agents, prompts, context
lib/workflows/     the sequences that compose agents with database writes
lib/i18n/          en + ar dictionaries
supabase/          migrations, seed, RLS test
```

Adding a screen usually means: a page in `app/(app)/`, a view component in
`components/<feature>/`, strings in both dictionaries, and an entry in
`components/shell/nav-config.ts`.

---

## Good first tasks

- A new achievement in `lib/momentum/achievements.ts` (add the catalogue entry,
  the unlock condition, the two dictionary strings, and a test)
- Course colour picker on the course form
- Export the calendar as `.ics`
- Extra grading scales as presets (many universities do not use 4.0)
- Keyboard shortcuts for the focus timer

---

## Questions

Open an issue. A question is a perfectly good issue — if something was unclear
to you it is unclear in the docs, and that is worth fixing.
