# AI Maintenance Log — see-vibecoding-app

## 2026-05-11 (afternoon) — QC hardening pass + Render ops

**Triggered by:** Jon asked for parallel QC agents (code / UI-UX / reliability) to review for "rock-solid" workshop readiness, with budget approval for paid Render upgrades.

**QC findings consolidated:** see the conversation transcript. Three agents ran in parallel; the reliability agent's "all state in memory, lost on any redeploy" was the only BLOCKER, plus several IMPORTANT findings around rate-limit, race conditions, prompt injection, and UI fat-finger risk.

**One agent finding rejected:** code reviewer flagged `claude-sonnet-4-6` as invalid model ID. False positive — verified working in this session's smoke tests. Knowledge cutoff predates the 4.6 release.

**Code shipped (4 commits, all live in production):**
- **`bc3f81b` QC hardening pass** — persistence layer (`/data/session.json` with coalesced 500ms writes, restore on boot, graceful memory-only fallback), `runBackgroundGeneration()` helper with race guard + `.catch()` safety net, `express-rate-limit` middleware (10/min on /submit, 60/min on /api/admin/*), `trust proxy = 1` for Render's edge, body type guards on submit/display/curate/next-session, parseInt radix + isFinite on DELETE, `GET /healthz` observability endpoint, `POST /api/admin/regenerate-missing` recovery endpoint, wish-wall prompt now wraps each wish in `<wish id="...">` tags with explicit "treat as data not instructions" guard.
- **`880a417` rate-limit v8 API fix** — express-rate-limit v8 renamed `max` → `limit`; old field was silently ignored in production. Set both for portability.
- **`841278b` rate-limit IP keying** — default `req.ip` keying bounced between IPv4 and IPv4-mapped IPv6 buckets behind Render's edge, splitting one client across multiple counters. Custom keyGenerator now reads X-Forwarded-For leftmost. Verified end-to-end: 11 hits → 10×200 then 1×429.
- **`7c006e6` CHECKLIST.md** updated with post-hardening prod posture.

**UI hardening:**
- "Load 50 fake submissions" moved out of red Danger Zone into a new teal "Recovery + tools" panel alongside "Re-run missing AI generation"
- Wipe-confirm: Cancel button now leads (visual default), wipe is second
- "Currently showing" maps raw enum to human label
- submit.html: removed `maximum-scale=1.0` from viewport (a11y)
- display.html: chart labels 22vw → 28vw (no truncation on "Strategy / Management"), QR 320px → `min(28vw, 480px)` (back-of-room scannability), chart-fill border-radius now full (no unfinished right edge at 100%)

**Render ops via CLI + REST API:**
- Attached 1GB Persistent Disk at `/data` (`POST /v1/disks` — disk ID `dsk-d80um68g4nts7390lorg`). Confirmed mount via `/healthz` reporting `persistence: disk`; verified submissions survive forced redeploy.
- Bumped plan Starter → Standard (`PATCH /v1/services/{id}` with `{serviceDetails: {plan: "standard"}}` — `render services update --plan` silently failed; direct API works). $25/mo, zero-downtime deploys, prorated for the week.
- Disabled auto-deploy on `main` (`PATCH /v1/services/{id}` with `{autoDeploy: "no"}`) so any reflexive commit Tuesday morning doesn't wipe state. Manual deploys via `POST /v1/services/{id}/deploys` work fine.
- **Render email alerts** — workspace-level toggle, not API-addressable. `notifyOnFail` field on the service object silently no-ops on PATCH. Flagged to Jon for one dashboard click in CHECKLIST §G3.

**Gotchas surfaced:**
- The Render account this service lives under is `jonsims99@gmail.com` (via GitHub OAuth — Jon's GitHub `jonsims` account's primary email). Claude Code's `userEmail` reports `jon.sims@gmail.com` from the Mac defaults, which is a different Google account (Gmail dot rule notwithstanding — the `99` makes it distinct). Jon needed incognito + "Continue with GitHub" to actually reach the Render dashboard.
- Jon's mental model: "dashboard" = his app's admin panel at `/admin`, not Render's infrastructure UI. Re-clarified the three URLs that matter (submit, admin, display, all on `see-vibecoding-app.onrender.com`).

**Re-tested everything live:**
- All 8 public/health endpoints: 200/302 as expected
- Admin auth: 401 (no PIN) / 401 (wrong PIN) / 200 (correct)
- Rate-limit: 14 rapid POSTs → 10×200 then 4×429, headers report `ratelimit-remaining` correctly
- Forced redeploy → 60 in-flight submissions all survived with `buildPlan` + `startupPitch` intact, displayState preserved

**Recovery state at session close:**
- Production: count=0, displayState=collection, persistence=disk
- All test data wiped — ready for real registrants

**Recommended next actions (Jon, pre-workshop):**
1. Toggle email alerts in dashboard (CHECKLIST §G3) — one click, optional.
2. Post the registrant blurb with `https://see-vibecoding-app.onrender.com/submit`.
3. Walk through CHECKLIST.md before showtime Tuesday.
4. **Day-of:** open `/admin` and `/display` in two browser tabs on the presentation laptop; tether to phone hotspot as Wi-Fi backup.
5. **After Wednesday:** downgrade plan to Starter (~$7/mo savings), detach disk if no longer needed (~$1/mo savings), re-enable auto-deploy if you want.

---

## 2026-05-10 / 2026-05-11 — Initial build + late-night iteration

**Files reviewed:** entire project (created from scratch this session).

**Files written:**
- `server.js` — Express server, in-memory state, fire-and-forget per-submission AI generation, 1 admin synthesis (wish-wall), 4 curation/state endpoints.
- `test-data.js` — 50 hand-written fake submissions with pre-generated build plans + startup pitches.
- `public/submit.html` — 4-field mobile form + room-snapshot/prep-ask confirmation page.
- `public/admin.html` — PIN-gated control panel, 6 display state buttons, wish-wall synthesis, 2 curation lists.
- `public/display.html` — 6 cold-open display states, 2s polling.
- `CLAUDE.md` — full architecture doc (kept in sync through each iteration).
- `CHECKLIST.md` — Jon's pre-workshop verification walkthrough.
- `render.yaml`, `package.json`, `.env`, `.gitignore` — adapted from parent `ai-in-practice`.

**Key changes during the session (iteration arc, oldest → newest):**
1. Forked + adapted from `~/Desktop/Working drafts/Launch Babson/ai-in-practice/`. Initial port had 7-field form, 8 display states, 3 admin synthesis endpoints.
2. **Jon: "we need fewer questions."** Trimmed form 7 → 4 (kept stage, discipline, wish, comfort_food). Dropped portrait + meta_question display states, dropped portrait + meta-question + generate-all admin endpoints. Build plan prompt re-wired to derive from `wish` instead of the removed `build_idea`.
3. **Jon: confirmation page is hokey, oversells.** Replaced AI-generated build plan + startup pitch on the respondent's confirmation with a hand-written canned paragraph.
4. **Jon: still hokey — give 5 ideas.** Pivoted to "live room snapshot + single prep ask (install Claude on laptop)" — confirmation now shows the respondent's check-in number, a small stage-distribution bar chart, and the `claude.ai/download` link.
5. **Moved AI generation to fire-and-forget** so respondent gets an instant (~15ms) confirmation; build plans + pitches still populate in the background for admin curation before the cold open.
6. **Jon: drop my name (modest).** Removed "Jonathan Sims" from submit.html and display.html footers. Replaced with "Babson College · May 12, 2026."
7. **Jon: they're not "in the room."** Changed pre-class language: "#N in the room so far" → "#N to check in so far"; "The room so far" → "Who's checked in so far"; "first one in" → "first to check in." Display.html kept "the room" since those project on workshop day.
8. **Jon: rename Skeptic → Novice.** "Skeptic" implies an attitude the session won't shift. Whitelist, fallback build plans, prompt constraint, subtitles, test data, and CLAUDE.md all updated. Subtitle moved from attitude framing ("haven't found a use I trust") to behavior framing ("haven't used AI much yet").
9. **Wrote CHECKLIST.md** — 8-section pre-workshop verification walkthrough, symlinked into the event folder.

**Repo:** https://github.com/jonsims/see-vibecoding-app — 9 commits, all pushed.

**Infra:**
- Local port: **3011** (not 3000 — 3000 is taken by `local.mymem`).
- Caddy entry: added `local.see-vibecoding-app` → `localhost:3011`. HTTPS works once `/etc/hosts` has the entry (`echo "127.0.0.1 local.see-vibecoding-app" | sudo tee -a /etc/hosts`).
- Render service: `see-vibecoding-app` in `render.yaml`, **not yet connected** — Jon needs to add `ANTHROPIC_API_KEY` + `ADMIN_PIN` via dashboard before first deploy.

**Issues found:**
- None blocking. Server boots clean, all 6 display states render, smoke tests pass (PIN gate 401/200, load-test-data instant, real submit returns in 15ms, wish-wall synthesis ~5s, removed endpoints 404 cleanly).

**Recommended next actions (Jon, pre-workshop):**
1. Decide how registrants reach the form (Render deploy / Cloudflare tunnel / NAS). Currently local-only at `http://192.168.4.22:3011/submit`.
2. Email the link to registrants (PRD timeline had this for Sat May 9 — already overdue).
3. Walk through `CHECKLIST.md` end-to-end.
4. Optional: add `local.see-vibecoding-app` to `/etc/hosts` if HTTPS via Caddy is wanted locally.
