# CLAUDE.md

Guidance for Claude Code working with this repo.

## What This Is

Pre-class form + cold-open display for the **SEE Vibecoding** workshop — Jonathan Sims' 90-minute hands-on session at Babson's 55th Price-Babson SEE on **Tuesday May 12, 2026, 3:30–5:00 PM**. Audience: 48–50 entrepreneurship educators from 11 countries.

The form itself is the workshop's first demo of its thesis: Jon walks in having already vibe-coded the on-ramp. Registrants fill the form on their phones 1–3 days before; on submit each person gets a personalized 3-line build plan + a deliberately silly AI-generated startup pitch built around their comfort food.

Forked from `ai-in-practice` (April 15 mixed-university talk). Same engine, totally different audience and synthesis.

## Commands

```bash
npm start         # Run server (port 3000)
npm run dev       # Run with --watch for auto-reload
```

## Deployment

- **Local:** http://localhost:3000 — and `https://local.see-vibecoding-app` via Caddy.
- **Production:** Render service `see-vibecoding-app` (separate from `ai-in-practice`). `render.yaml` is committed but the service has not been connected yet — Jon needs to add env vars (`ANTHROPIC_API_KEY`, `ADMIN_PIN`) via the Render dashboard before first deploy.

## Environment

`.env` must define `ANTHROPIC_API_KEY`, `ADMIN_PIN`, `PORT=3000`. Model: `claude-sonnet-4-6`.

## Architecture

Single-file Express server (`server.js`) with all state in memory. No database — data resets on restart.

**Three static pages from `public/`:**
- `submit.html` — mobile-first form, 4 fields (2 picks + 2 short texts), 30–45s target completion. On submit, runs two synthesis calls in parallel via `Promise.allSettled` (15s combined timeout); returns a personalized 3-line build plan + a silly comfort-food startup pitch.
- `admin.html` — PIN-protected control panel. 6 display state buttons, 1 room-level synthesis (wish wall), and two curation panels (build plans + food startups).
- `display.html` — full-screen projector view with 6 states, polls `/api/state` every 2 seconds.

**Valid display states (6):** `collection`, `stage_chart`, `discipline_chart`, `wish_wall`, `sample_build_plans`, `food_startups`.

## Data model

Each submission is a structured object (not parallel arrays — keeps generated outputs joined to their respondent):

```js
{
  id, stage, discipline, wish, comfort_food,
  buildPlan: { line1, line2, line3 },
  startupPitch: { name, tagline, pitch },
  ts,
}
```

Caps: `wish` 100, `comfort_food` 50, total submissions 500.

Stages whitelist: `Novice`, `Curious`, `Tinkering`, `Building`.
Disciplines whitelist: `Entrepreneurship`, `Strategy / Management`, `Marketing`, `Finance / Accounting`, `Operations / Tech`, `Other`.

## The cold open (display states 0–5 minutes)

Jon advances via admin. Likely cycle: 4–5 of these in 5 minutes; `food_startups` is the closer/laugh state.

1. `collection` — count + QR (used while still collecting, e.g. day-of stragglers)
2. `stage_chart` — distribution across Novice→Building
3. `discipline_chart` — distribution across 6 disciplines
4. `wish_wall` — dedup'd cluster of `wish` strings, themed
5. `sample_build_plans` — 5–8 curated per-respondent build plans (anonymized)
6. `food_startups` — 5–8 curated comfort-food startup pitches

## Per-submission synthesis (`POST /api/submit`)

Two Anthropic calls fire in parallel via `Promise.allSettled`, each wrapped in `withTimeout(15s)`:

- **Build plan** — derives the 3-line plan from `stage` + `discipline` + `wish`. The wish is the main signal: what they want AI to do becomes the artifact spec.
- **Startup pitch** — silly fake startup founded around their `comfort_food`.

Fallbacks return static content keyed to `stage` (build plan) and a single generic pitch (startup). `parseClaudeJSON` (3-strategy fallback: direct → strip fences → regex extract) handles all model output.

## Room-level synthesis

One admin-triggered endpoint:

- `POST /api/admin/synthesize/wish-wall` — dedups + themes the raw wish list. Needs ≥3 wish entries. 30s timeout via `withTimeout`.

The `wish_wall` display state shows the curated version when synthesis has run, falls back to the raw wish list otherwise.

## Curation endpoints

- `POST /api/admin/curate/build-plans` body `{ ids: [int] }` → updates `selectedBuildPlans`
- `POST /api/admin/curate/food-startups` body `{ ids: [int] }` → updates `selectedFoodStartups`

The display state for `sample_build_plans` and `food_startups` reads only from these curated id lists, so Jon can pick 5–8 of the strongest before the cold open starts.

## Test data

`test-data.js` exports 50 hand-written submissions covering the full stage × discipline grid, each with a pre-generated `buildPlan` and `startupPitch`. Loading test data via `POST /api/admin/load-test-data` is instant and doesn't hit the API — safe to use repeatedly while prepping.

## Key patterns (preserved from parent)

- Admin auth: PIN via `x-admin-pin` header. No session/JWT. PIN persisted in `sessionStorage` after first valid use.
- Display coordination: admin sets `displayState` via POST, display page picks it up on next 2-second poll.
- Between-session reset: `POST /api/admin/next-session` with `{ confirm: true }`.
- Live preview: admin embeds `/display` in a 0.25-scaled iframe.
- All fetch calls use AbortController timeouts (5s display, 8s admin, 20s submit).
- In-flight guards (`refreshInFlight`, `pollInFlight`) prevent overlapping requests.
- Input caps enforced server-side, not just client-side.

## Branding

Warm earthy palette (Babson Events project standard):
- Primary green: `#1a5632`
- Teal accent: `#0d7377`
- Cream background: `#F5EFE0`
- Body ink: `#1A1A1A`

QR code uses `#1a5632` on white. Submit page form uses green for selected states and headers, teal for hints and the copy button. Display page uses big type (1.5rem+ for supporting text, 3rem+ for headlines) to read from 50+ feet.

## What changed from `ai-in-practice`

- Data model flipped from parallel arrays to structured submission objects.
- New whitelists: `VALID_STAGES`, `VALID_DISCIPLINES`.
- 5-field form → 4-field form (stage, discipline, wish, comfort_food).
- `POST /api/submit` now runs two Anthropic calls in parallel and returns personalized output to each respondent (build plan + comfort-food startup pitch).
- 9 display states → 6 (dropped portrait/frontier/clusters/meta_question/outlier/invitation; added `wish_wall`, `sample_build_plans`, `food_startups`).
- 4 synthesis endpoints → 1 (just `wish-wall` dedup; per-respondent synthesis runs inline on submit).
- Two new curation endpoints + admin curation panels.
- Palette swap to warm earthy (was minimal Babson green-only).
- Branding copy dropped the Chatbot→Assistant→Agent→Colleague arc framing.

## Files

```
server.js                  — Express server, all routes, synthesis logic
test-data.js               — 50 pre-generated fake submissions
public/submit.html         — Audience submission form (7 fields) + confirmation panel
public/admin.html          — Presenter control panel (8 states, 3 syntheses, 2 curation panels)
public/display.html        — Projector display (8 states, full-screen)
render.yaml                — Render deployment blueprint (service not yet connected)
.env                       — API key + PIN (gitignored)
```
