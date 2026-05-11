require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const PORT = process.env.PORT || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || '1234';
const MODEL = 'claude-sonnet-4-6';

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.redirect('/submit'));
app.get('/submit', (req, res) => res.sendFile(path.join(__dirname, 'public', 'submit.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/display', (req, res) => res.sendFile(path.join(__dirname, 'public', 'display.html')));

// ─── Whitelists ──────────────────────────────────────────────────────────────

const VALID_STAGES = ['Skeptic', 'Curious', 'Tinkering', 'Building'];
const VALID_DISCIPLINES = [
  'Entrepreneurship',
  'Strategy / Management',
  'Marketing',
  'Finance / Accounting',
  'Operations / Tech',
  'Other',
];
const VALID_STATES = [
  'collection',
  'stage_chart',
  'discipline_chart',
  'wish_wall',
  'sample_build_plans',
  'food_startups',
];

const CAP_WISH = 100;
const CAP_FOOD = 50;
const CAP_TOTAL_SUBMISSIONS = 500;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseClaudeJSON(raw) {
  try { return JSON.parse(raw); } catch {}
  try {
    const stripped = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(stripped);
  } catch {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  console.error('[PARSE FAIL] Raw response:', raw);
  throw new Error('Could not parse Claude response');
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Claude API timeout')), ms)),
  ]);
}

function synthesisErrorMessage(err) {
  const msg = err.message || '';
  if (msg.includes('timeout')) return 'Claude API timed out — try again in 30s';
  if (msg.includes('Could not parse')) return 'Response couldn\'t be parsed — retrying usually works';
  if (err.status) return `Claude API error (${err.status}) — try again in 30s`;
  return 'Unexpected error — check server logs';
}

function distribution(arr, orderHint) {
  const counts = {};
  arr.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  return Object.entries(counts)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      if (orderHint) {
        const ai = orderHint.indexOf(a[0]);
        const bi = orderHint.indexOf(b[0]);
        if (ai !== -1 && bi !== -1) return ai - bi;
      }
      return a[0].localeCompare(b[0]);
    })
    .map(([label, count]) => ({ label, count }));
}

// ─── In-memory session state ────────────────────────────────────────────────

function makeEmptySession() {
  return {
    submissions: [],
    nextId: 1,
    displayState: 'collection',
    wishWallResult: null,
    selectedBuildPlans: [],
    selectedFoodStartups: [],
    synthesizing: { wishWall: false },
  };
}

let session = makeEmptySession();
function resetSession() { session = makeEmptySession(); }

// ─── Fallbacks (used when per-submission synthesis fails) ───────────────────

const FALLBACK_BUILD_PLANS = {
  Skeptic: {
    line1: 'A one-page rubric contradiction checker',
    line2: 'Your existing rubric plus one student paper',
    line3: 'It surfaces a tension you already half-noticed',
  },
  Curious: {
    line1: 'A 5-question concept-check generator from your slides',
    line2: 'One lecture deck plus your learning objectives',
    line3: 'The questions match what you actually wanted them to know',
  },
  Tinkering: {
    line1: 'A draft case-debrief artifact for your hardest case',
    line2: 'The case PDF plus three discussion-question goals',
    line3: 'You leave with something you would hand to a TA',
  },
  Building: {
    line1: 'A reusable scenario-factory for course startup briefs',
    line2: 'Three past briefs plus your industry constraints',
    line3: 'It produces a new one another instructor could teach',
  },
};

function fallbackBuildPlan(stage) {
  return FALLBACK_BUILD_PLANS[stage] || FALLBACK_BUILD_PLANS.Curious;
}

function fallbackStartupPitch() {
  return {
    name: 'TBD Foods',
    tagline: "We'll surprise you Tuesday.",
    pitch:
      "Your comfort food deserves a real pitch. Find Jonathan in the hallway before the workshop and we'll vibe-code one together.",
  };
}

// ─── Per-submission synthesis ───────────────────────────────────────────────

async function generateBuildPlan({ stage, discipline, wish }) {
  const prompt = `You are a workshop facilitator writing one personalized 3-line build plan for an entrepreneurship educator attending a 90-minute hands-on "vibe coding with Claude Cowork" workshop on Tuesday.

Their stage with AI: ${stage}
Their discipline: ${discipline}
What they wish AI could do for their teaching but doesn't yet: "${wish || '(left blank)'}"

Turn their wish into a 3-line build plan they could actually attempt during the workshop:
- Line 1: the artifact to build (one phrase, names the output that addresses the wish)
- Line 2: the input/data they'd give Cowork (one phrase)
- Line 3: the success test (one phrase, how they'll know it worked)

Constraints:
- Total ≤45 words across all 3 lines
- Match their stage (Skeptics get something tiny; Builders get something ambitious)
- Doable in ~35 minutes with dummy data
- Action verbs only: "build," "draft," "prototype," "design" — not "explore" or "consider"
- Peer voice, not coach voice

Return ONLY valid JSON with no extra text, no markdown, no code fences:
{"line1": "...", "line2": "...", "line3": "..."}`;

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });
  return parseClaudeJSON(message.content[0].text.trim());
}

async function generateStartupPitch({ comfort_food }) {
  const prompt = `You are writing a deliberately silly fake startup pitch for an entrepreneurship educator. Their comfort food after a hard teaching day is: "${comfort_food || 'unspecified'}"

Write ONE fictional startup founded around that food. Output:
- A startup name (made up; can be punny)
- A one-line tagline
- A 2-sentence "pitch" describing what the startup does

Tone: dry, absurd, the kind of joke an entrepreneurship professor would laugh at. Lean into the cliches of pitch decks (TAM, unit economics, AI moat, etc.) but make them obviously ridiculous. Stay PG.

Total ≤35 words across name + tagline + pitch.

Return ONLY valid JSON with no extra text, no markdown, no code fences:
{"name": "...", "tagline": "...", "pitch": "..."}`;

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });
  return parseClaudeJSON(message.content[0].text.trim());
}

// ─── Public API ─────────────────────────────────────────────────────────────

app.get('/api/qr', async (req, res) => {
  const url = req.query.url || `${req.protocol}://${req.get('host')}/submit`;
  try {
    const svg = await QRCode.toString(url, { type: 'svg', color: { dark: '#1a5632', light: '#ffffff' }, width: 300 });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (err) {
    res.status(500).send('QR error');
  }
});

app.get('/api/count', (req, res) => {
  res.json({ total: session.submissions.length });
});

app.get('/api/enums', (req, res) => {
  res.json({ stages: VALID_STAGES, disciplines: VALID_DISCIPLINES });
});

function clampText(v, cap) {
  if (!v || typeof v !== 'string') return '';
  return v.trim().slice(0, cap);
}

// Submit form — store immediately, generate build plan + startup pitch in
// the background so the respondent gets an instant confirmation. The
// generated content is reviewed/curated by the admin before the cold open;
// it is never shown to the submitter.
app.post('/api/submit', (req, res) => {
  const { stage, discipline } = req.body;

  if (!stage || !VALID_STAGES.includes(stage)) {
    return res.status(400).json({ error: 'Please pick your stage with AI.' });
  }
  if (!discipline || !VALID_DISCIPLINES.includes(discipline)) {
    return res.status(400).json({ error: 'Please pick your discipline.' });
  }
  if (session.submissions.length >= CAP_TOTAL_SUBMISSIONS) {
    return res.status(429).json({ error: 'Submissions are closed' });
  }

  const sub = {
    id: session.nextId++,
    stage,
    discipline,
    wish: clampText(req.body.wish, CAP_WISH),
    comfort_food: clampText(req.body.comfort_food, CAP_FOOD),
    buildPlan: null,
    startupPitch: null,
    ts: Date.now(),
  };
  session.submissions.push(sub);
  res.json({ ok: true });

  // Fire-and-forget — the respondent has their confirmation, generation
  // populates buildPlan + startupPitch in the background for admin curation.
  Promise.allSettled([
    withTimeout(generateBuildPlan(sub), 15000),
    withTimeout(generateStartupPitch(sub), 15000),
  ]).then(([planRes, pitchRes]) => {
    if (planRes.status === 'fulfilled' && planRes.value && planRes.value.line1) {
      sub.buildPlan = planRes.value;
    } else {
      if (planRes.status === 'rejected') console.error('[build-plan] fallback used:', planRes.reason?.message);
      sub.buildPlan = fallbackBuildPlan(stage);
    }
    if (pitchRes.status === 'fulfilled' && pitchRes.value && pitchRes.value.name) {
      sub.startupPitch = pitchRes.value;
    } else {
      if (pitchRes.status === 'rejected') console.error('[startup-pitch] fallback used:', pitchRes.reason?.message);
      sub.startupPitch = fallbackStartupPitch();
    }
  });
});

// Public polling endpoint — display.html reads this every 2s
app.get('/api/state', (req, res) => {
  const subs = session.submissions;
  const selectedBuildPlans = session.selectedBuildPlans
    .map(id => subs.find(s => s.id === id))
    .filter(Boolean)
    .map(s => ({ ...s.buildPlan, stage: s.stage }));
  const selectedFoodStartups = session.selectedFoodStartups
    .map(id => subs.find(s => s.id === id))
    .filter(Boolean)
    .map(s => s.startupPitch);

  res.json({
    displayState: session.displayState,
    count: subs.length,
    stageDistribution: distribution(subs.map(s => s.stage), VALID_STAGES),
    disciplineDistribution: distribution(subs.map(s => s.discipline), VALID_DISCIPLINES),
    wishes: subs.map(s => s.wish).filter(Boolean),
    wishWallResult: session.wishWallResult,
    selectedBuildPlans,
    selectedFoodStartups,
    synthesizing: session.synthesizing,
  });
});

// ─── Admin API ───────────────────────────────────────────────────────────────

function checkPin(req, res) {
  if (req.headers['x-admin-pin'] !== ADMIN_PIN) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

app.get('/api/admin/data', (req, res) => {
  if (!checkPin(req, res)) return;
  const subs = session.submissions;
  res.json({
    submissions: subs,
    count: subs.length,
    stageDistribution: distribution(subs.map(s => s.stage), VALID_STAGES),
    disciplineDistribution: distribution(subs.map(s => s.discipline), VALID_DISCIPLINES),
    displayState: session.displayState,
    wishWallResult: session.wishWallResult,
    selectedBuildPlans: session.selectedBuildPlans,
    selectedFoodStartups: session.selectedFoodStartups,
    synthesizing: session.synthesizing,
  });
});

app.post('/api/admin/display', (req, res) => {
  if (!checkPin(req, res)) return;
  const { state } = req.body;
  if (!VALID_STATES.includes(state)) return res.status(400).json({ error: 'Invalid state' });
  session.displayState = state;
  res.json({ ok: true, displayState: state });
});

app.delete('/api/admin/submission/:id', (req, res) => {
  if (!checkPin(req, res)) return;
  const id = parseInt(req.params.id);
  session.submissions = session.submissions.filter(s => s.id !== id);
  session.selectedBuildPlans = session.selectedBuildPlans.filter(x => x !== id);
  session.selectedFoodStartups = session.selectedFoodStartups.filter(x => x !== id);
  res.json({ ok: true });
});

app.post('/api/admin/curate/build-plans', (req, res) => {
  if (!checkPin(req, res)) return;
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Number.isFinite) : [];
  const validIds = new Set(session.submissions.map(s => s.id));
  session.selectedBuildPlans = ids.filter(id => validIds.has(id));
  res.json({ ok: true, selected: session.selectedBuildPlans });
});

app.post('/api/admin/curate/food-startups', (req, res) => {
  if (!checkPin(req, res)) return;
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Number.isFinite) : [];
  const validIds = new Set(session.submissions.map(s => s.id));
  session.selectedFoodStartups = ids.filter(id => validIds.has(id));
  res.json({ ok: true, selected: session.selectedFoodStartups });
});

app.post('/api/admin/reset', (req, res) => {
  if (!checkPin(req, res)) return;
  resetSession();
  res.json({ ok: true });
});

app.post('/api/admin/next-session', (req, res) => {
  if (!checkPin(req, res)) return;
  if (!req.body.confirm) return res.status(400).json({ error: 'Confirmation required. Send { confirm: true }.' });
  resetSession();
  res.json({ ok: true, message: 'Ready for next session' });
});

// ─── Room-level synthesis: Wish Wall (dedup + light cluster) ────────────────

app.post('/api/admin/synthesize/wish-wall', async (req, res) => {
  if (!checkPin(req, res)) return;
  if (session.synthesizing.wishWall) return res.status(409).json({ error: 'Synthesis already in progress' });
  const wishes = session.submissions.map(s => s.wish).filter(Boolean);
  if (wishes.length < 3) return res.status(400).json({ error: 'Need at least 3 wish responses' });

  session.synthesizing.wishWall = true;
  try {
    const numbered = wishes.map((w, i) => `${i + 1}. ${w}`).join('\n');

    const prompt = `You are helping a workshop facilitator project a "wish wall" on the screen — a curated list of what entrepreneurship educators wish AI could do for their teaching but doesn't yet.

All submitted wishes:
${numbered}

Do two things:

1. DEDUPLICATE and lightly group near-duplicates (same wish phrased differently → keep the cleanest phrasing). Drop anything vague or generic ("I wish AI was better"). Target 10–18 distinct wishes.

2. For each, pick the cleanest verbatim or near-verbatim phrasing (up to 100 chars) and tag it with a single-word theme (examples: grading, feedback, planning, research, admin, scaling, voice, time).

Return ONLY valid JSON with no extra text, no markdown, no code fences:
{"wishes":[{"text":"...","theme":"..."}, ...]}`;

    const message = await withTimeout(
      anthropic.messages.create({ model: MODEL, max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
      30000
    );

    session.wishWallResult = parseClaudeJSON(message.content[0].text.trim());
    res.json({ ok: true, result: session.wishWallResult });
  } catch (err) {
    console.error('Wish-wall synthesis error:', err);
    res.status(500).json({ error: synthesisErrorMessage(err) });
  } finally {
    session.synthesizing.wishWall = false;
  }
});

// ─── Test data loader ──────────────────────────────────────────────────────

const TEST_SUBMISSIONS = require('./test-data.js');

app.post('/api/admin/load-test-data', (req, res) => {
  if (!checkPin(req, res)) return;
  resetSession();

  TEST_SUBMISSIONS.forEach(t => {
    session.submissions.push({
      id: session.nextId++,
      stage: t.stage,
      discipline: t.discipline,
      wish: t.wish,
      comfort_food: t.comfort_food,
      buildPlan: t.buildPlan,
      startupPitch: t.startupPitch,
      ts: Date.now(),
    });
  });

  res.json({ ok: true, loaded: session.submissions.length });
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🌱 SEE Vibecoding running at http://localhost:${PORT}`);
  console.log(`   Submit:  http://localhost:${PORT}/submit`);
  console.log(`   Admin:   http://localhost:${PORT}/admin   (PIN: ${ADMIN_PIN})`);
  console.log(`   Display: http://localhost:${PORT}/display\n`);
});
