# AI Maintenance Log — see-vibecoding-app

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
