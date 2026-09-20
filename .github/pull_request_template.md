## What this changes

<!-- One or two sentences. What is different after this merges? -->

## Why

<!-- The problem it solves, or the issue it closes (Closes #12). -->

## How to check it

<!-- The steps a reviewer follows to see it working. Name the screen. -->

1.
2.

## Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run test:calc` passes
- [ ] `npm run build` passes
- [ ] Works at 320px wide (no horizontal scrolling)
- [ ] Works in Arabic — the layout mirrors and no English leaks in
- [ ] Any new user-facing string is in **both** `en` and `ar` dictionaries
- [ ] Any new table has row level security and a policy per operation
- [ ] Any new number shown to a student is computed in `lib/`, not by the model

## Screenshots

<!-- For anything visual, drop in before/after. Arabic too if the layout moved. -->
