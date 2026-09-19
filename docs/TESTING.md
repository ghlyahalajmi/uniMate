# Testing checklist

Automated checks first, then the manual walk. Anything marked **must** is a
bug if it fails, not a preference.

## Automated

```bash
npm run typecheck        # strict TypeScript, whole project
npm run build            # production build
npm run test:calc        # 24 arithmetic and data-cleaning checks
npm run lint             # Next.js lint
npm audit                # must report 0 vulnerabilities

PORT=3100 npm start &
npm run check:responsive # 7 widths × 3 pages × 2 locales

psql "$DATABASE_URL" -f supabase/tests/rls_isolation_test.sql   # 11 × PASS
```

## Database

- [ ] All three migrations apply to a fresh project without error
- [ ] `supabase/seed/seed.sql` runs, and runs a second time without error
- [ ] Each seeded course's assessment weights total exactly 100
- [ ] A new sign-up automatically gets a profile row and an 11-entry grade scale
- [ ] Deleting a course cascades to its grades, syllabus events and reminders
- [ ] Deleting a course sets its tasks' `course_id` to null rather than deleting them

## Row level security — **must**

- [ ] Student A cannot read B's courses, grades, tasks, syllabi, AI runs,
      study history or profile
- [ ] Student A cannot insert a row carrying B's `user_id`
- [ ] Student A cannot update or delete any of B's rows
- [ ] The anonymous role can read nothing
- [ ] A signed-in student cannot fetch another student's file from storage

## Authentication

- [ ] Sign up → confirmation (if enabled) → onboarding → dashboard
- [ ] Sign in with the wrong password shows readable copy, not an API string
- [ ] Sign out returns to the home page and clears the session
- [ ] Password reset sends the same response whether or not the address exists
- [ ] A signed-out visitor hitting `/dashboard` lands on sign-in with `?next=`
- [ ] After signing in, that `next` destination is honoured
- [ ] A signed-in student visiting `/auth/sign-in` is sent to the dashboard
- [ ] Two accounts in two browsers show entirely separate data
- [ ] A brand-new account sees the welcome panel, never a blank dashboard

## Screens

- [ ] Every sidebar and bottom-bar link resolves — no dead ends
- [ ] Dashboard shows today's classes in time order
- [ ] Dashboard's upcoming list merges syllabus events and unscored assessments
      without duplicating the same item
- [ ] Course detail shows assessments, tasks, syllabus and events together
- [ ] Grades states the required remaining average and its assumptions
- [ ] An unreachable target says so, and names the best still reachable
- [ ] Editing the grading scale changes the letters and GPA everywhere
- [ ] The GPA calculator's row-by-row working adds up to its headline figure
- [ ] Calendar shows classes, assessments, tasks and reminders, with a legend
- [ ] Records lists every table and deletes a row for real
- [ ] The cleaning log shows original, cleaned and reason

## CRUD

- [ ] Create, edit and delete a course; refresh; the change persisted
- [ ] Same for an assessment, a task, a reminder and a schedule
- [ ] Every delete asks first
- [ ] Saving with a duplicate course code shows a field error, not a crash
- [ ] A score above its maximum is rejected with a readable message
- [ ] Data survives a browser restart and appears in a second browser

## AI

With a key configured:

- [ ] Timetable scan reads a photo and shows editable cards
- [ ] Low-confidence fields are flagged individually
- [ ] **Nothing is written until save is pressed** — check the database
- [ ] Cleaning decisions from the scan land in `cleaning_log`
- [ ] Syllabus upload extracts topics, weights and dates
- [ ] Asking the syllabus something it does not contain returns the
      "not in your syllabus" answer rather than an invention
- [ ] Study questions are about the subject, not about the student's grades
- [ ] Explanations teach the reasoning rather than restating the answer
- [ ] Adaptive difficulty shifts after a run of wrong answers
- [ ] The assistant answers "what do I need on my final" with the figure from
      `lib/calculations`, not its own arithmetic
- [ ] The assistant says so when something is not in the records
- [ ] Planner produces several plans and labels none of them best

Without a key:

- [ ] The app loads and every non-AI feature works
- [ ] Grade, GPA, task, reminder and chart features are unaffected
- [ ] AI screens explain what is missing instead of failing silently
- [ ] Offline agent runs still appear in `ai_runs`, marked as computed locally

## Logging — **must**

- [ ] Every AI operation creates an `ai_runs` row
- [ ] A failed run is recorded as `failed` with a readable message
- [ ] A run interrupted mid-flight still leaves its `running` row
- [ ] No automated process runs without a row

## Internationalisation

- [ ] The switcher changes the whole interface, not a few labels
- [ ] Arabic sets `dir="rtl"` and the layout mirrors
- [ ] Sidebar, cards, forms and buttons all mirror correctly
- [ ] Dates and numbers are localised
- [ ] No English leaks into an Arabic screen
- [ ] The choice survives a reload

## Responsive — **must**

At 320, 375, 390, 430, tablet and desktop:

- [ ] No horizontal scrolling anywhere
- [ ] No text under 12px
- [ ] Every interactive target at least 32px tall
- [ ] Tables become cards on a phone
- [ ] Charts resize without overflowing
- [ ] The upload and camera flows work on a phone

## Accessibility

- [ ] Every action is reachable by Tab and triggerable by Enter
- [ ] Focus is always visible
- [ ] Every input has a label; every icon-only button has an accessible name
- [ ] Errors are announced (`role="alert"`)
- [ ] Status is never carried by colour alone
- [ ] Every chart has a data table with the same figures
- [ ] Modals trap Escape and restore scrolling on close

## Export

- [ ] "Export my data" downloads a CSV
- [ ] It contains only the signed-in student's rows
- [ ] Arabic text opens correctly in Excel (the BOM is there for this)
- [ ] Per-table export works

## Performance

- [ ] The dashboard renders without a visible stall on a mid-range phone
- [ ] Skeletons match the real layout so nothing jumps on arrival
- [ ] AI operations show staged progress rather than freezing
