# Architecture

## Why the arithmetic is not in the model

Everything numeric — weighted grade, required remaining score, semester and
cumulative GPA, credits, conflict detection — is computed in
`lib/calculations`, which has no I/O and no model dependency, and is covered by
24 unit checks including the boundary cases.

The agents receive those figures as pre-computed fact and are told not to
recompute them. The Grade Coach, for instance, gets a JSON block of correct
numbers and is only allowed to write the advice around them. The consequence is
that a model slip can produce clumsy prose, but it cannot tell a student they
need 72% when they need 96%.

## The agent contract

```ts
interface AgentDefinition<TInput, TOutput> {
  name: string;
  trigger: string;
  workflow?: string;
  describe: string;
  run(input, ctx): Promise<TOutput>;          // the AI path; may throw
  fallback(input, ctx): TOutput | null;       // deterministic; null = cannot
  summariseInput(input): string;              // for the activity log
  summariseOutput(output): string;
}
```

`runAgent` is the only way an agent is invoked. It:

1. Writes an `ai_runs` row with status `running` **before** the work starts, so
   an operation that crashes mid-flight still leaves a trace.
2. With no API key, goes straight to `fallback` and records the run as
   completed offline.
3. On success, updates the row to `completed` with an output summary.
4. On failure, tries `fallback` first; if that also declines, records `failed`
   with a readable message.

Logging failures never block the work — a database hiccup while writing the log
must not lose the student's question.

## Grounding

`lib/ai/prompts.ts` holds the rules every agent inherits:

1. The student's records are the only source of facts about their university.
2. Recorded facts and suggestions are stated differently, and the interface
   renders them in separate labelled blocks.
3. No outcome is ever presented as guaranteed.
4. Every recommendation cites the record it follows from.
5. Brevity — a student reads this between classes.

`lib/ai/context.ts` renders the student's records as a factual dossier. Its
shape matters: anything absent from it is something the model must decline to
state rather than fill in.

## Adaptive difficulty

`weakTopics()` aggregates practice sessions per topic into a correct/total
ratio. Below 55% overall the next set opens easier; above 85% it opens harder.
The prompt is also told to start one step below the resolved level and climb,
which is what "rebuild the foundation first" means in practice.

## Row level security

Every table carries `user_id` — including the child tables where a join would
have done — so each policy is a single `user_id = auth.uid()` comparison rather
than a subquery. It is simpler to read and faster to plan. RLS is `FORCE`d, and
the blanket `anon` grants Supabase hands the API roles are revoked, so a table
added later without a policy denies by default instead of leaking.

## Internationalisation

`lib/i18n/dictionaries.ts` exports `en` as the source of truth and types `ar`
against its shape:

```ts
export type Dictionary = {
  [K in keyof typeof en]: { [P in keyof (typeof en)[K]]: string };
};
export const ar: Dictionary = { /* … */ };
```

A missing Arabic key fails the build. Direction is set server-side from a
cookie so the first paint is already correct, and the CSS uses logical
properties (`ms`/`me`, `start`/`end`) so nothing needs a mirrored stylesheet.

Arabic uses Latin digits (`ar-KW-u-nu-latn`) for grades and GPA, which is how
those figures are printed on Kuwaiti transcripts.

## Charts

Custom SVG rather than a charting library, for three reasons: the design system
controls every mark, the bundle stays small, and the data table that
accompanies each chart is part of the component rather than an afterthought.

The categorical palette went through the six-check gate — lightness band,
chroma floor, colour-vision separation, normal-vision floor, contrast — against
both the light and dark chart surfaces, and passes in both. The slot **order**
is the colour-vision safety mechanism, so it is documented in `globals.css` as
not reorderable. Axes start at zero.

## Data cleaning

`lib/validation/cleaning.ts` normalises scanned values and returns the reason
for each change, so the caller can write a `cleaning_log` row. Nothing is
cleaned silently. The scanner shows the student its decisions before they are
committed.

The cleaners handle what OCR actually produces: `CE 301` → `CE301`,
`10.00 AM` → `10:00`, `3 Credits` → `3`, `٣` → `3`, `lab b2` → `Lab B2`,
`الأحد والثلاثاء` → `['sunday','tuesday']` — including the fused waw prefix,
which is how Arabic writes "and Tuesday".
