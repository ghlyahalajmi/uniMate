# Security

What protects UniMate, what we attacked it with, and what we found.

---

## Blast radius, in one sentence

**If an attacker got everything they could possibly get from the browser, they
would reach one student's own courses, grades, tasks, notes and study history —
their own, and nobody else's — because every table refuses to serve a row whose
`user_id` is not the signed-in session's, and the database enforces that with
`FORCE ROW LEVEL SECURITY`, not the application.**

What they would *not* reach, even with a stolen session: another student's
anything, any password (none is stored in readable form anywhere), any AI key
(the column is write-only from the browser's side and only its last four
characters are ever returned), and the service-role key (server-side, never
sent to a page).

---

## The three biggest threats, and what we did

### 1. One student reading another student's record

The whole product is private academic data. A student's grades are the single
most sensitive thing here, and the most obvious thing to try: sign in as
yourself, put someone else's record ID in the address bar.

**What we did.** Row level security is enabled *and forced* on all 33 tables in
`public`, so even the table's owner cannot bypass a policy. Every policy is
`user_id = auth.uid()`. The `anon` role has no grants at all — a request
without a session is refused before any policy is consulted. Nothing in the
app fetches a list and filters it in the browser; the filter is in the
database.

*Evidence:* `supabase/migrations/0002_rls.sql`, and the stranger test below.

### 2. A key ending up somewhere a browser can read it

UniMate calls a model, so it holds a credential. The two ways that goes wrong
are a key committed to the repository, and a key written into a table a student
can read out of their own row.

**What we did.** Three things, all after the audit:

- `ai_credentials.api_key` is never selected by any page. What Settings reads is
  `hint`, a *generated column* defined as `right(api_key, 4)` — the full value
  cannot be returned by asking for it.
- The admin panel used to write one key onto every student's row. That action is
  deleted. A key for everyone lives in `OPENROUTER_API_KEY` in the deployment's
  environment, which the server reads and no session can.
- A database trigger, `reject_credential_on_demo_account`, refuses to store a
  credential against the demonstration account — the one login that is
  deliberately shared with the public. Refused in the database, so it holds
  whatever the page does.

*Evidence:* `supabase/migrations/0023_ai_credentials.sql`,
`supabase/migrations/0029_no_keys_on_demo_accounts.sql`.

### 3. Someone claiming the administrator account

The admin side can suspend accounts and clear keys. Whoever creates the first
administrator owns it, so the first-run page is the door.

**What we did.** Two independent locks:

- `/admin/first-run` requires `ADMIN_SETUP_TOKEN` from the environment, compared
  in constant time. Under 16 characters, or absent, and the page refuses to work
  at all — a deployment nobody set a token on is a deployment nobody can claim.
- `admin_bootstrap()` raises if any administrator already exists. That check is
  in the function, in the database, so calling the RPC directly does not help.

Every other `admin_*` function checks `is_admin()` inside itself. The admin
screens are a view onto those functions, not the authority.

*Evidence:* `lib/admin/actions.ts`, `supabase/migrations/0026_admin_side.sql`.

---

## What is open to anyone, and why that is safe

| Path | Why it is open |
| --- | --- |
| `/` | The landing page. Marketing copy and a sign-in link; reads no table. |
| `/how-it-works` | Static explanation of the agents. No data. |
| `/auth/*` | Sign in, sign up, reset. Cannot be behind a sign-in wall. |
| `/admin/sign-in`, `/admin/first-run` | The admin door. First-run needs the setup token; sign-in needs a password, and being an admin is decided by the `admins` table, not by reaching the page. |

Everything else redirects to sign-in in `lib/supabase/middleware.ts` — and if a
route were ever missed, row level security still returns nothing.

One function is callable without signing in: `admin_exists()`. It returns a
single boolean, and it is the same fact that makes `admin_bootstrap()` refuse.
Knowing an administrator exists gains an attacker nothing.

---

## What we attacked it with

### The stranger test — run live, from a machine outside the project

Twelve tables requested straight from the REST API with the public anon key and
no session:

| Requested | Answer |
| --- | --- |
| `profiles`, `courses`, `grades`, `tasks`, `notes` | `401` permission denied |
| `ai_credentials`, `admins` | `401` permission denied |
| `hub_links`, `study_sessions`, `flashcards`, `syllabi`, `ai_runs` | `401` permission denied |

Then the functions:

| Called | Answer |
| --- | --- |
| `admin_list_users`, `admin_ai_summary`, `streak_leaderboard`, `session_state` | `401` permission denied |
| `admin_exists` | `200` → `true` (intentional, see above) |

Not one row came back.

### The guessed address

Signed in as account B, open a record ID belonging to account A. The page
renders its not-found state: the query returns zero rows because the policy
compares `user_id` to `auth.uid()`, and there is nothing to render.

### The Inspector and the hidden field

Every mutation goes through a server action or an API route that re-reads the
session and re-validates with Zod. Editing a form's hidden fields changes what
is *sent*, not what is *accepted* — the server never trusts a `user_id` from the
browser. The one place a client used to pass an identifier that mattered,
practice on a course material, now fetches the file path from the row itself
rather than accepting it from the request.

### What the audit found, and what changed because of it

The full audit returned one Red, four Orange and three Yellow. Two of the fixes
are live and pointable-at:

1. **A key on the demonstration account.** The demo login is public, so a
   credential stored against it was a credential handed to the internet.
   Fixed by migration `0029`: a trigger refuses the row, and the existing rows
   were deleted. *Point at:* Settings on the demo account — saving a key is
   refused by the database, with a sentence explaining why.
2. **One shared key written to every student's row.** The admin panel's bulk
   write is gone, and `admin_set_ai_key_for_all` was dropped from the database.
   *Point at:* `components/admin/admin-ai-key.tsx` — the panel now has a count
   and a *Clear all stored keys* button, and no field to type a key into.

---

## What is never stored

- **Passwords.** Supabase Auth holds a bcrypt hash in `auth.users`. There is no
  password column in any table this app created, and no screen displays one.
  New passwords are checked against Have I Been Pwned first, by k-anonymity —
  five characters of a SHA-1 prefix leave the server, never the password.
- **Full AI keys, client-side.** Only the last four characters are ever
  returned to a page.
- **Anything about a student on another student's screen.** The streak board
  crosses a streak, study hours, tasks done and a name the student chose to
  show — and only for students who switched it on.

---

## Input handling

Every field is validated on the server with Zod before it is used: 42 explicit
length and range rules in `lib/validation/schemas.ts`. Request bodies are capped
before parsing (32–128 KB depending on the route), uploads are capped by count
and size, and a field given five thousand characters is refused with a message —
nothing is truncated silently and no row is created.
