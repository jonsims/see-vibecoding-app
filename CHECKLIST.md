# SEE Vibecoding App — Pre-Workshop Checklist

**Workshop:** Tuesday May 12, 2026 · 3:30–5:00 PM
**App lives at:** `~/Projects/see-vibecoding-app/`
**Repo:** https://github.com/jonsims/see-vibecoding-app
**Production URL:** https://see-vibecoding-app.onrender.com
**Render service ID:** `srv-d80slqvaqgkc73adn3e0`
**Plan:** Standard ($25/mo, zero-downtime deploys, more CPU/RAM — downgrade after Tuesday)
**Persistent disk:** 1 GB at `/data` (mountPath: `dsk-d80um68g4nts7390lorg`) — submissions survive restarts
**Auto-deploy:** **OFF** (re-enable from Render dashboard after Wednesday)
**Health endpoint:** https://see-vibecoding-app.onrender.com/healthz
**Rate-limited:** `/api/submit` 10/min/IP, `/api/admin/*` 60/min/IP

Work through Sections A–F to verify everything works. Section G is open decisions you still need to make. Section H is day-of setup.

---

## A. Start the server

If it's not already running:

```bash
cd ~/Projects/see-vibecoding-app
node server.js
```

You should see:
```
🌱 SEE Vibecoding running at http://localhost:3011
```

- [ ] Server boots without errors
- [ ] `http://localhost:3011/submit` loads in your browser
- [ ] `http://localhost:3011/admin` loads (asks for PIN)
- [ ] `http://localhost:3011/display` loads

---

## B. Form flow (try it on your phone)

To open the form on your phone, both devices need to be on the same Wi-Fi. Use:

> **`http://192.168.4.22:3011/submit`**

(If that doesn't work, your Mac's IP may have changed — `ipconfig getifaddr en0` from Terminal to recheck.)

- [ ] Form renders cleanly on phone Safari
- [ ] All 4 stage buttons (Novice / Curious / Tinkering / Building) tap correctly, subtitle hint visible
- [ ] All 6 discipline buttons tap correctly
- [ ] Character counters update as you type your wish + comfort food
- [ ] "Submit" button briefly shows "Submitting…" then the confirmation appears
- [ ] Confirmation page shows:
  - [ ] Green ✓ "You're in."
  - [ ] "Who's checked in so far" card — your number + horizontal stage bars
  - [ ] "One small thing before Tuesday" card with `claude.ai/download` link
  - [ ] Footer: "Babson College · May 12, 2026"
- [ ] Tapping `claude.ai/download →` opens the Claude download page

---

## C. Admin panel

URL: `http://localhost:3011/admin`
PIN: `1234` (or whatever's in `.env` — `cat ~/Projects/see-vibecoding-app/.env` if 1234 doesn't work)

- [ ] PIN gate accepts the correct PIN
- [ ] Wrong PIN shows "Wrong PIN." error
- [ ] After unlocking, header shows green "connected" dot (top right)
- [ ] Stats row shows current counts (Submissions / Wishes / Build plans / Food pitches)
- [ ] Stage distribution bars visible (after at least 1 submission)
- [ ] Discipline distribution bars visible
- [ ] Display state buttons highlight the currently-active state

---

## D. Cold-open rehearsal (with test data)

In the admin **Danger zone** at the bottom:

- [ ] Click "Load 50 fake submissions"
- [ ] Submission count jumps to 50
- [ ] Stage distribution shows: Tinkering 18 / Curious 14 / Building 10 / Novice 8
- [ ] All 6 disciplines appear in the discipline distribution

Open `http://localhost:3011/display` in a **second** browser window (or on a second monitor). In the admin panel, click each display state button and verify the projector view:

- [ ] **Collection** — big "50" + QR code + URL
- [ ] **Stage chart** — gradient bars, Tinkering on top
- [ ] **Discipline chart** — six bars, Entrepreneurship on top
- [ ] **Wish wall** — list of 50 raw wishes (will get prettier once you synthesize)
- [ ] **Sample build plans** — empty placeholder until you curate (next step)
- [ ] **Food startups 🍕** — empty placeholder until you curate

Now run the synthesis + curation:

- [ ] In "Room-level synthesis," click **Generate** next to "Wish wall" — wait ~5 seconds, status changes to "ready ✓"
- [ ] Flip display to "Wish wall" — now shows dedup'd wishes with colored theme tags (grading, feedback, planning, etc.)
- [ ] In **"Curate sample build plans"**, tick 6–8 of the strongest 3-line plans
- [ ] Click **"Save selection"** — button briefly shows "Saved ✓ (N)"
- [ ] Flip display to "Sample build plans" — your 6–8 selections appear as green-bordered cards
- [ ] In **"Curate food startups"**, tick 6–8 of the funniest pitches
- [ ] Click **"Save selection"**
- [ ] Flip display to "Food startups 🍕" — your selections appear as gold-bordered cards

---

## E. Readability check

The display will be on a projector. Walk 20–30 feet from your screen (or open the display in full-screen on your laptop and stand across the room):

- [ ] Every display state is readable at 20–30 feet
- [ ] Charts (stage + discipline) are readable, including labels
- [ ] Wish-wall text doesn't wrap awkwardly
- [ ] Food-startup card name + tagline lands at a glance from a distance

---

## F. Wipe before going live

When you're ready to accept real submissions, in **Danger zone**:

- [ ] Click "Wipe & start next session"
- [ ] Confirm — submission count drops to 0
- [ ] Curation selections clear
- [ ] Display flips back to the collection state

(After this, real registrants' submissions come in fresh.)

---

## G. Open decisions (NOT verification — things you still need to do)

### G1. Registrant URL — DONE ✓

Deployed to Render Starter plan (no spin-down).

**Public URL:** https://see-vibecoding-app.onrender.com/submit
**Admin URL:** https://see-vibecoding-app.onrender.com/admin (PIN: `1234`)
**Display URL:** https://see-vibecoding-app.onrender.com/display
**Dashboard:** https://dashboard.render.com/web/srv-d80slqvaqgkc73adn3e0

Auto-deploys on push to `main`. Env vars `ANTHROPIC_API_KEY`, `ADMIN_PIN`, `NODE_VERSION=22` are set in Render. Production smoke test passed (form submit, admin auth, load test data, wipe).

### G2. Email the link to registrants

- [ ] Email sent (form URL: https://see-vibecoding-app.onrender.com/submit)
- [ ] Confirm send method (Canvas / email / both)

Workshop is Tue 3:30 PM — registrants need at least a few hours.

### G3. (One-time, takes 30 seconds) Turn on Render email alerts

The per-service alert toggle isn't exposed via API. To get an email if the service ever fails to start or goes unhealthy during the workshop window:

1. https://dashboard.render.com/web/srv-d80slqvaqgkc73adn3e0/settings
2. Scroll to **Notifications**
3. Toggle on: "Deploy failed" + "Service unhealthy"

- [ ] Done (optional but recommended)

### G4. (Optional) HTTPS via Caddy

The Caddy config + entry in the Caddyfile is already in place. To make `https://local.see-vibecoding-app` actually resolve, run once:

```bash
echo "127.0.0.1 local.see-vibecoding-app" | sudo tee -a /etc/hosts
```

This is purely cosmetic — `http://localhost:3011` works without it.

- [ ] Done (optional)

---

## H. Tuesday — day-of setup

- [ ] Verify production is responsive: open https://see-vibecoding-app.onrender.com/submit on your phone
- [ ] Wipe stale data: admin → **Danger zone → "Wipe & start next session"** to clear any test submissions before audience arrives (especially if you submitted real ones for testing during prep)
- [ ] On the presentation laptop: open https://see-vibecoding-app.onrender.com/admin in one browser tab, https://see-vibecoding-app.onrender.com/display in a second tab (drag the display tab to the projector / second screen, fullscreen it with `Cmd+Ctrl+F` in Safari or `Ctrl+Cmd+F` in Chrome)
- [ ] Test the PIN entry on the actual presentation laptop
- [ ] Plan your cold-open sequence — likely cycle:
  1. `collection` (during pre-class intro, while the last stragglers submit)
  2. `stage_chart` (who's in the room by AI stage)
  3. `discipline_chart` (who's in the room by discipline)
  4. `wish_wall` (themed list of wishes)
  5. `sample_build_plans` (your curated picks)
  6. `food_startups 🍕` (closer / laugh state)

---

## Quick reference

| Thing | Where |
| --- | --- |
| **Submit form (production)** | **https://see-vibecoding-app.onrender.com/submit** |
| **Admin (production)** | **https://see-vibecoding-app.onrender.com/admin** (PIN: `1234`) |
| **Display (production)** | **https://see-vibecoding-app.onrender.com/display** |
| Render dashboard | https://dashboard.render.com/web/srv-d80slqvaqgkc73adn3e0 |
| Render logs | `render logs --resources srv-d80slqvaqgkc73adn3e0 --output text` |
| Local submit | http://localhost:3011/submit |
| Local admin | http://localhost:3011/admin |
| Local display | http://localhost:3011/display |
| Code | `~/Projects/see-vibecoding-app/` |
| Repo | https://github.com/jonsims/see-vibecoding-app |
