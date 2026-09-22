# Agent guardrails

The rules the agents run under. Numbered, because a guardrail you cannot count
is a guardrail you cannot check.

---

## The rules

1. **An agent answers only from records the student has entered.** Every prompt
   is built from `loadStudentContext`, which reads that student's rows through
   their own session. An agent is never given another student's data, because
   row level security would not serve it to the query that builds the context.

2. **An agent may not invent university facts.** Prerequisites, registration
   rules, room numbers and grading scales are not in UniMate unless a student
   put them there. The prompts say so, and every screen carries the line: *"UniMate
   answers from the records you have added. It does not fill in university
   information it has not been given."*

3. **Every number an agent shows must be traceable to a row.** Screens label
   model output as *UniMate suggestion* and computed output as *From your
   records*, and the Provenance component names where a figure came from. A GPA
   is never generated; it is calculated in `lib/calculations` and tested.

4. **No agent writes to the database on its own.** Agents return data; the
   screen shows it; the student saves it. The study planner proposes dated
   sessions and nothing enters the week until the student presses approve.

5. **Every agent has a deterministic fallback, and the fallback is the default
   when no model is reachable.** Twelve of fifteen agents answer fully without
   a model. The three that cannot are the ones that read a picture.

6. **An agent that cannot answer says so.** `runAgent` records `failed` with the
   reason in `ai_runs`, and the screen shows the word failed and the reason —
   never a spinner that never ends.

7. **Every run is logged before it starts.** A row is written to `ai_runs` with
   the trigger and an input summary *before* the work begins, so an operation
   that crashes mid-flight still leaves a trace.

8. **Self-firing agents are throttled.** The two that run on every dashboard
   open — Dashboard Insight and Daily Coach — will not call a model twice
   inside `throttleHours`; inside the window they take the deterministic path.

9. **Request bodies are capped before parsing:** 32 KB for a syllabus question,
   64 KB for practice and planning, 128 KB for the assistant.

10. **Batch work is capped by count:** at most 3 syllabus files per import,
    30 courses from one timetable scan, 30 readable materials per course, and a
    bounded number of sessions per study plan.

11. **A model never sees a key that is not the caller's own.** The credential is
    resolved per request — deployment environment first, then the student's own
    key — and is never returned to a page.

12. **The model's fallback list is capped at three.** OpenRouter rejects a
    longer `models` array outright.

---

## The tool the agents are allowed to use

**The tool:** the student's own Supabase session, through `loadStudentContext`.

**What it may do:** read the signed-in student's courses, assessments, tasks,
syllabi, study sessions and streak, to build the context a prompt is written
from.

**What it may not do:** read any row belonging to anyone else, write anything at
all, or reach `auth.users`, `admins` or `ai_credentials.api_key`.

**Where the limit is written:** in the database, not in the tool. Every table it
touches has `FORCE ROW LEVEL SECURITY` with a `user_id = auth.uid()` policy, so
the limit holds even if the code asks for more. See
`supabase/migrations/0002_rls.sql`.

---

## The rule a rehearsal changed

**Rule 12 exists because a rehearsal broke.**

Free models are unreliable one at a time, so the client was written to send a
fallback list — try this model, then this one, then the next — and we made the
list as long as the catalogue allowed, on the theory that more fallbacks meant
fewer failures.

Every agent then failed with a valid key. Not slowly, not intermittently:
immediately, on the first call, with a flat `HTTP 400`. Reading
`ai_runs.error_message` gave the real answer:

> `'models' array must have 3 items or fewer`

The provider caps the fallback list at three. A longer list is not a longer
list — it is a rejected request. **Rule 12 was added and the list was capped at
`MAX_FALLBACK_MODELS = 3`** in `lib/ai/models.ts`, with the reason written next
to the constant so nobody raises it again.

The second thing that rehearsal taught: the error was only findable because of
rule 7. The run had been logged before it started, so there was a row to read.
A silent failure would have been guesswork.
