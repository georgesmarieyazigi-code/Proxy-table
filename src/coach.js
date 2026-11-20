/* ===================== coach.js — the optional Claude-powered coach (stage 3b) =====================
   Uses the player's OWN Anthropic API key, typed into the Trainer panel → "Claude coach" tab.
   - The key lives only in this browser's localStorage under 'pt.coach.key' (and a closure variable). It is never put in S,
     never published, never logged, never in exports or the game file, and is sent only to api.anthropic.com in the
     x-api-key header of a direct browser request (anthropic-dangerous-direct-browser-access: true).
   - What is sent: the built-in trainer's privacy-safe record (trCoachRecord → proxy-table/decisions@1: only what you could
     see; opponents anonymised, hand SIZES only), compacted, with names / table code scrubbed once more.
   - Per-turn notes (Quiet / Live modes, at most one request per turn of yours), a post-game review that builds on the
     coaching profile and the focus Claude set last time, and an "Ask the coach" box. Monthly budget cap + cost meter.
   - Any failure (no key, offline, 401/402/429/5xx, budget) leaves the built-in trainer exactly as it was.
   Verified 8 Nov 2026 on platform.claude.com: POST /v1/messages, anthropic-version 2026-10-21 (temperature/top_p/top_k
   removed), model ids claude-haiku-5-5 / claude-sonnet-5-5 / claude-opus-5-5, prices below (editable in the panel).
   ============================================================================================================ */
const CO_URL = 'https://api.anthropic.com/v1/messages';
const CO_VER = '2026-10-21';
const CO_KEYK = 'pt.coach.key', CO_CFGK = 'pt.coach';
// USD per million tokens (platform.claude.com/docs/en/about-claude/pricing, 8 Nov 2026). Haiku 5.5 is tiered: prompts over
// 100k tokens cost 5×. cacheRead = cache-hit price as a fraction of input; 5-minute cache writes are 1.25× input.
const CO_MODELS = {
  'claude-haiku-5-5':{label:'Claude Haiku 5.5 (cheapest, fast)', pin:0.10, pout:0.50, tierOver:100000, tierX:5, cacheRead:0.1, think:{type:'disabled'}},
  'claude-sonnet-5-5':{label:'Claude Sonnet 5.5 (stronger, ~20× the price)', pin:2, pout:10, cacheRead:0.05, think:{type:'between_tools'}},
  'claude-opus-5-5':{label:'Claude Opus 5.5 (strongest, ~40× the price)', pin:4, pout:20, cacheRead:0.05, think:null},
};
const CO_DEF_MODEL = 'claude-haiku-5-5';
// request shapes per kind: max output tokens (thinking counts as output), effort, whether to switch thinking down
const CO_KIND = {turn:{max:600, effort:'low', lean:true}, ask:{max:900, effort:'low', lean:true}, review:{max:3000, effort:'medium', lean:false}};
const CO_PRICE_DATE = '8 Nov 2026';
const CO = {cfg:{on:false, model:CO_DEF_MODEL, style:'direct', budget:2, perTurn:true, autoReview:true, prices:{}},
  usage:{month:'', usd:0, inTok:0, outTok:0, n:0, kinds:{}}, mem:{focus:[]}, games:{}, msg:null, busy:'', pauseUntil:0, pauseWhy:'',
  keyBad:false, lastAsk:0, draft:'', log:[], errs:[]};
let coKey = '', coKeyDraft = '';

/* ---- storage: settings / usage / notes in 'pt.coach', the key alone in 'pt.coach.key' ---- */
function coMonth(){ const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function coLoad(){
  try { const d = JSON.parse(localStorage.getItem(CO_CFGK) || 'null');
    if (d && typeof d === 'object'){ if (d.cfg) Object.assign(CO.cfg, d.cfg); if (d.usage) CO.usage = {...CO.usage, ...d.usage}; if (d.mem && Array.isArray(d.mem.focus)) CO.mem = d.mem; if (d.games && typeof d.games === 'object') CO.games = d.games; } } catch {}
  if (!CO_MODELS[CO.cfg.model]) CO.cfg.model = CO_DEF_MODEL;
  try { coKey = localStorage.getItem(CO_KEYK) || ''; } catch { coKey = ''; }
  coRollMonth();
}
function coSave(){ try { const ids = Object.keys(CO.games).sort((a, b) => (CO.games[a].at || 0) - (CO.games[b].at || 0)); ids.slice(0, -4).forEach(id => delete CO.games[id]);
  localStorage.setItem(CO_CFGK, JSON.stringify({cfg:CO.cfg, usage:CO.usage, mem:CO.mem, games:CO.games})); } catch {} }
function coRollMonth(){ const m = coMonth(); if (CO.usage.month !== m) CO.usage = {month:m, usd:0, inTok:0, outTok:0, n:0, kinds:{}}; }
function coSetKey(k){ k = String(k || '').trim(); coKey = k; CO.keyBad = false; CO.pauseUntil = 0; try { if (k) localStorage.setItem(CO_KEYK, k); else localStorage.removeItem(CO_KEYK); } catch {} }
function coErr(e){ CO.errs.push(coRedact(String(e && e.stack || e)).slice(0, 300)); if (CO.errs.length > 20) CO.errs.shift(); }
// belt and braces: nothing the coach shows, stores or reports may contain the key
function coRedact(s){ s = String(s ?? ''); if (coKey && coKey.length >= 8) s = s.split(coKey).join('[key]'); return s.replace(/sk-ant-[A-Za-z0-9_\-]{6,}/g, '[key]'); }

/* ---- prices and cost ---- */
function coPrice(model){ const m = CO_MODELS[model] || CO_MODELS[CO_DEF_MODEL]; const o = CO.cfg.prices && CO.cfg.prices[model] || {};
  const pin = +o.pin >= 0 && o.pin !== '' && o.pin != null ? +o.pin : m.pin, pout = +o.pout >= 0 && o.pout !== '' && o.pout != null ? +o.pout : m.pout;
  return {pin, pout, tierOver:m.tierOver || 0, tierX:m.tierX || 1, cacheRead:m.cacheRead}; }
function coCost(model, u){
  const p = coPrice(model); const inT = +u.input_tokens || 0, cw = +u.cache_creation_input_tokens || 0, cr = +u.cache_read_input_tokens || 0, out = +u.output_tokens || 0;
  const x = p.tierOver && inT + cw + cr > p.tierOver ? p.tierX : 1;
  return (inT * p.pin + cw * p.pin * 1.25 + cr * p.pin * p.cacheRead + out * p.pout) * x / 1e6;
}
const coTokEst = s => Math.ceil(String(s).length / 3);   // newer tokenizer: ~3 characters per token for this JSON-heavy text
const coUsd = v => v < 0.01 ? '$' + v.toFixed(4) : v < 1 ? '$' + v.toFixed(3) : '$' + v.toFixed(2);
// average measured tokens per request kind in this browser (falls back to typical sizes measured in tests)
const CO_TYPICAL = {turn:{inTok:2100, outTok:150}, review:{inTok:9000, outTok:900}, ask:{inTok:6000, outTok:200}};
function coAvg(kind){ const k = CO.usage.kinds[kind]; return k && k.n ? {inTok:k.inTok / k.n, outTok:k.outTok / k.n, measured:true} : {...CO_TYPICAL[kind], measured:false}; }
function coEstimate(model = CO.cfg.model){
  const c = kind => { const a = coAvg(kind); return {usd:coCost(model, {input_tokens:a.inTok, output_tokens:a.outTok}), measured:a.measured}; };
  const t = c('turn'), r = c('review');
  return {turn:t.usd, review:r.usd, game:t.usd * 12 + r.usd, measured:t.measured || r.measured};
}

/* ---- the system prompt ---- */
function coSystem(){
  const tone = CO.cfg.style === 'gentle'
    ? 'Tone: encouraging and calm. Start with one thing they did well when there is one, then frame each mistake as the next step to learn. Never harsh.'
    : 'Tone: direct, like a strong friend at the table. Name the mistake plainly and say what to do instead. No softening phrases, no praise padding, but never rude.';
  return `You are the coach built into Proxy Table, a browser table for playtesting Magic: The Gathering Commander decks. You coach one player — called "you" in the data — and your job is to make them a better decision-maker over many games.

WHAT YOU RECEIVE
- Decision records (format proxy-table/decisions@1, compacted). Each decision has: turn, phase, yourTurn (whether it was the player's own turn), kind (land = played a land, cast, ab = activated an ability, attack, block, keep / ship = kept or mulliganed a hand, pass = let an opponent's spell resolve, end = ended the turn, choice = answered a prompt), did (what the player did), sometimes saw (what the player could see at that moment: their own hand, mana and board; each opponent's life, hand SIZE and board), bot (what the game's strongest bot would have done, with its reason) and flags.
- flags come from the built-in trainer. Each was verified by the game engine against the real game state (mana, legal targets, combat maths). Treat them as facts: never contradict a flag and don't just repeat it word for word — explain why it matters or which habit fixes it. The bot's suggestion is a strong opinion, not ground truth.
- Opponents are anonymised as Opponent 1, Opponent 2… You never see opponents' hands or libraries. Don't guess what they hold beyond public facts (hand size, untapped mana, cards already played).
- A coaching profile: the player's recurring weaknesses over recent games, their stage (1 = basics: land drops, mana use, mulligans; 2 = sequencing; 3 = decision-making: combat maths, holding interaction, threat assessment), recent accuracy, and the focus you set after earlier games.

HOW TO COACH
- Be concrete: name the actual cards, turns and numbers from the record ("Turn 4: you cast Test Ogre before combat…"). No generic advice that would fit any game.
- Prioritise by impact: the decision that cost the most first, then sequencing, then small things. Skip trivia.
- Coach at the player's stage. At stage 1 don't lecture about table politics; at stage 3 don't dwell on basics unless they slipped.
- Rules: only state a rules interaction you are sure of. If it depends on exact Oracle text or a rule you are not certain about, say "I'm not sure how X interacts with Y — check the card's rulings" rather than guessing. Never invent card text. The game engine applied the rules: if the record shows something happened, it happened.
- Commander context: 40 life, 3–5 players, threat assessment across the table, commander tax ({2} more per recast), 21 commander damage.
- If they played well, say so in one line and give one thing to try next. Never invent mistakes to have something to say. If the data is too thin to judge, say so briefly.
- Keep it short. Plain text only: no markdown headings, tables or bold. Use "- " at the start of a line for each point. No preamble ("Great question", "Here are…") and no sign-off.
- ${tone}`;
}
function coProfile(){
  try { const c = trCoach();
    return {gamesTracked:c.N, stage:c.stage, stageMeans:c.stageText, recurringWeaknesses:c.weak.map(x => ({label:TR_CATS[x.cat].label, recentGames:`${x.g5} of last ${x.n5}`, earlierGames:x.np ? `${x.gp} of ${x.np}` : undefined})),
      recentAccuracy:c.accs, builtInFocus:c.focus, yourEarlierFocus:CO.mem.focus.slice(-3).map(f => f.text)}; } catch (e){ coErr(e); return {}; }
}

/* ---- compacting and scrubbing the trainer's record ---- */
function coSaw(s, full){ if (!s) return undefined; if (full) return s;
  return {you:s.you && {life:s.you.life, hand:s.you.hand, mana:s.you.mana, battlefield:s.you.battlefield}, opponents:(s.opponents || []).map(o => ({who:o.who, life:o.life, hand:o.hand, lands:o.lands, battlefield:o.battlefield}))}; }
function coDec(d, saw){
  const o = {n:d.n, turn:d.turn, phase:d.phase, yourTurn:d.yourTurn, kind:d.kind, did:d.did};
  if (d.bot && d.bot.move) o.bot = d.bot.move + (d.bot.reason ? ' — ' + d.bot.reason : '');
  if (d.flags && d.flags.length) o.flags = d.flags.map(f => `${f.severity} (${f.label}): ${f.message}${f.better ? ' Better: ' + f.better : ''}`);
  if (saw) o.saw = saw; return o;
}
function coDigest(rec, limit){
  const ds = rec.decisions || []; const last = ds[ds.length - 1];
  let list = ds.map(d => coDec(d, d.flags && d.flags.length ? coSaw(d.saw, false) : undefined));
  const out = {game:rec.game, decisions:list, finalBoard:last ? coSaw(last.saw, true) : undefined};
  // too long: drop the oldest decisions with no flags (then their boards) until it fits
  let omitted = 0;
  while (JSON.stringify(out).length > limit){
    let i = out.decisions.findIndex(d => !d.flags); if (i < 0){ i = out.decisions.findIndex(d => d.saw); if (i < 0) break; delete out.decisions[i].saw; continue; }
    out.decisions.splice(i, 1); omitted++;
  }
  if (omitted) out.omittedUnflaggedDecisions = omitted;
  return out;
}
// replace any player name / table code that slipped through with neutral labels (the record already anonymises opponents)
function coScrub(text, g){
  let t = String(text);
  const lab = new Map(Object.entries((g && g.opp) || {}));
  const reps = [];
  try { for (const [pid, o] of OPP) if (o && o.nm) reps.push([o.nm, lab.get(pid) || 'another player']); } catch {}
  try { if (S && S.nm) reps.push([S.nm, 'you']); } catch {}
  reps.sort((a, b) => b[0].length - a[0].length);
  for (const [nm, to] of reps){ if (String(nm).length < 3) continue; t = t.replace(new RegExp('(^|[^A-Za-z0-9])' + escRe(nm) + '(?![A-Za-z0-9])', 'g'), (m, p) => p + to); }
  try { if (NET.code && NET.code.length >= 3) t = t.split(NET.code).join('the table'); } catch {}
  return coRedact(t);
}

/* ---- the request ---- */
function coGate(kind){
  if (BOTMODE) return 'bot';
  if (!CO.cfg.on) return 'The Claude coach is off.';
  if (!coKey) return 'No API key saved.';
  if (CO.keyBad) return 'Anthropic rejected the saved key — save a new one.';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'You are offline — the built-in trainer keeps working.';
  if (CO.busy) return 'Claude is still answering the previous request.';
  if (CO.pauseUntil > Date.now()) return CO.pauseWhy || 'Paused for a moment.';
  coRollMonth();
  if (CO.usage.usd >= (+CO.cfg.budget || 0)) return `Monthly budget reached (${coUsd(CO.usage.usd)} of ${coUsd(+CO.cfg.budget || 0)}). Raise it in the settings below, or wait for next month.`;
  return '';
}
function coBody(kind, user, lean){
  const m = CO_MODELS[CO.cfg.model] || CO_MODELS[CO_DEF_MODEL]; const K = CO_KIND[kind];
  const body = {model:CO.cfg.model, max_tokens:K.max, system:[{type:'text', text:coSystem(), cache_control:{type:'ephemeral'}}], messages:[{role:'user', content:user}]};
  if (lean !== false){ body.output_config = {effort:K.effort}; if (K.lean && m.think) body.thinking = {...m.think}; }
  return body;
}
async function coSend(kind, user){
  const gate = coGate(kind); if (gate) return {ok:false, why:gate, gate:true};
  const model = CO.cfg.model;
  let body = coBody(kind, user);
  const est = coCost(model, {input_tokens:coTokEst(JSON.stringify(body.system) + user), output_tokens:body.max_tokens});
  if (CO.usage.usd + est > (+CO.cfg.budget || 0)) return {ok:false, gate:true, why:`This request could cost up to ${coUsd(est)}, which would pass your monthly budget (${coUsd(CO.usage.usd)} of ${coUsd(+CO.cfg.budget || 0)} used).`};
  CO.busy = kind; coRenderSoon();
  try {
    for (let attempt = 0; attempt < 2; attempt++){
      const ac = typeof AbortController === 'function' ? new AbortController() : null; const tm = setTimeout(() => { try { ac && ac.abort(); } catch {} }, 60000);
      let res;
      try {
        res = await fetch(CO_URL, {method:'POST', mode:'cors', credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer', signal:ac ? ac.signal : undefined,
          headers:{'content-type':'application/json', 'x-api-key':coKey, 'anthropic-version':CO_VER, 'anthropic-dangerous-direct-browser-access':'true'}, body:JSON.stringify(body)});
      } catch (e){ clearTimeout(tm); return coFail(0, null, e && e.name === 'AbortError' ? 'timeout' : 'network'); }
      clearTimeout(tm);
      let j = null; try { j = await res.json(); } catch {}
      if (res.ok && j){
        const text = coRedact((j.content || []).filter(b => b && b.type === 'text').map(b => b.text).join('\n').trim());
        const u = j.usage || {}; const usd = coCost(model, u);
        coRollMonth(); const U = CO.usage; U.usd += usd; U.n++; const inT = (+u.input_tokens || 0) + (+u.cache_creation_input_tokens || 0) + (+u.cache_read_input_tokens || 0), outT = +u.output_tokens || 0; U.inTok += inT; U.outTok += outT;
        const K = U.kinds[kind] || (U.kinds[kind] = {n:0, usd:0, inTok:0, outTok:0}); K.n++; K.usd += usd; K.inTok += inT; K.outTok += outT;
        CO.log.push({kind, at:Date.now(), model, inTok:inT, outTok:outT, usd, stop:j.stop_reason || ''}); if (CO.log.length > 50) CO.log.shift();
        CO.msg = null; coSave();
        if (!text) return {ok:false, why:'Claude returned an empty answer' + (j.stop_reason === 'max_tokens' ? ' (it ran out of room).' : '.'), usd};
        return {ok:true, text, usd, inTok:inT, outTok:outT};
      }
      // a 400 about the thinking / effort settings: retry once without them (model ids and options change over time)
      const et = j && j.error ? String(j.error.type || '') : '', em = j && j.error ? String(j.error.message || '') : '';
      if (res.status === 400 && attempt === 0 && (body.thinking || body.output_config) && /thinking|effort|output_config/i.test(em)){ body = coBody(kind, user, false); continue; }
      return coFail(res.status, {type:et, message:em}, '', res.headers && res.headers.get ? res.headers.get('retry-after') : null);
    }
    return coFail(400, null, '');
  } finally { CO.busy = ''; coRenderSoon(); }
}
function coFail(status, err, net, retryAfter){
  const m = coRedact(err && err.message || '').slice(0, 220); let why;
  if (net === 'network'){ why = 'Could not reach api.anthropic.com (offline or blocked). The built-in trainer keeps working.'; CO.pauseUntil = Date.now() + 20000; CO.pauseWhy = 'Network problem — will try again shortly.'; }
  else if (net === 'timeout') why = 'Claude took too long to answer (60 s). Try again later.';
  else if (status === 401 && /CORS requests are not allowed/i.test(m)){ why = 'Your Anthropic organization does not allow requests straight from a browser (zero data retention or Compliance API settings). The coach can\'t work with this key.'; CO.keyBad = true; }
  else if (status === 401){ why = 'Anthropic rejected the API key (401). Check it in the Claude Console and save it again.'; CO.keyBad = true; }
  else if (status === 402){ why = 'No API credits left on this Anthropic account (402 billing). Top up or check your linked plan credits in the Claude Console.'; CO.pauseUntil = Date.now() + 10 * 60000; CO.pauseWhy = 'Paused: the account is out of credits (try again in a few minutes, or press Try again).'; }
  else if (status === 403){ why = 'This key is not allowed to use that model (403). Pick another model or check the key\'s workspace.'; }
  else if (status === 429){ const s = Math.min(600, Math.max(30, +retryAfter || 60)); why = `Rate limited by Anthropic (429). Pausing the coach for ${s} s.`; CO.pauseUntil = Date.now() + s * 1000; CO.pauseWhy = 'Paused after a rate limit (429).'; }
  else if (status === 529 || status >= 500){ why = `Anthropic is busy or had an error (${status}). Try again in a minute.`; CO.pauseUntil = Date.now() + 30000; CO.pauseWhy = 'Paused: Anthropic was overloaded.'; }
  else if (status === 404 || (status === 400 && /model/i.test(m))) why = `The model "${CO.cfg.model}" was not accepted (${status}${m ? ': ' + m : ''}). Pick another model.`;
  else why = `Request failed (${status || 'no response'})${m ? ': ' + m : ''}.`;
  CO.msg = {err:true, text:why, at:Date.now()};
  coSave(); return {ok:false, why, status};
}

/* ---- per-game coach state ---- */
function coG(g){ if (!g) return null; return CO.games[g.id] || (CO.games[g.id] = {at:g.at || Date.now(), notes:[], review:null, qa:[], sentTo:-1, turns:[], auto:0}); }

/* ---- (a) after each of your turns ---- */
function coAfterTurn(){
  if (BOTMODE || !CO.cfg.on || !CO.cfg.perTurn || !coKey || !['quiet', 'live'].includes(TR.mode)) return;
  const g = TR.g; if (!g || g.done) return; const G = coG(g); const key = turnStr();
  if (G.turns.includes(key) || G.auto >= 40) return;                 // at most one per turn of yours, 40 a game
  G.turns.push(key); G.auto++;
  setTimeout(() => { coTurn(g, key).catch(coErr); }, 0);            // outside the trainer's judging span; never blocks play
}
async function coTurn(g, key){
  const G = coG(g); const rec = trCoachRecord(g); if (!rec) return;
  const fresh = rec.decisions.filter(d => d.n > G.sentTo); if (!fresh.some(d => d.yourTurn && d.kind !== 'keep' && d.kind !== 'ship')) return;
  const win = fresh.slice(-30); const last = win[win.length - 1]; const turn = last.turn;
  const data = {game:rec.game, turn, decisionsSinceLastNote:win.map(d => coDec(d, undefined)), boardAtEndOfTurn:coSaw(last.saw, true), profile:coProfile()};
  const user = coScrub(`Turn ${turn} (your turn) just ended. Give 1–3 short points (one or two sentences each, under 80 words in total) on decision-making and sequencing in these decisions: the order of plays, mana use, attacks and blocks, what to hold up. Use the built-in trainer's flags as facts. If the turn was clean, say so in one line and name one thing to watch next turn.\n\n${JSON.stringify(data)}`, g);
  const r = await coSend('turn', user);
  if (!r.ok){ if (!r.gate) G.notes.push({t:turn, err:r.why}); else G.turns.splice(G.turns.indexOf(key), 1); coRenderSoon(); return; }
  G.sentTo = last.n; G.notes.push({t:turn, text:r.text, usd:r.usd}); coSave();
  if (TR.mode === 'live' || TR.mode === 'quiet'){ try { trToast({sev:'tip', summary:true, msg:'Claude coach, turn ' + turn + ': ' + short(r.text.replace(/^\s*-\s*/, '').split('\n')[0], 150)}); } catch {} }
  coRenderSoon();
}

/* ---- (b) after the game ---- */
function coAfterGame(g){
  if (BOTMODE || !g || !CO.cfg.on || !CO.cfg.autoReview || !coKey || TR.mode === 'off') return;
  if (g.result === 'unfinished') return;
  if (g.recs.filter(r => TR_JUDGED.has(r.kind)).length < 3) return;
  const G = coG(g); if (G.review || G.reviewTried) return; G.reviewTried = true;
  setTimeout(() => { coReview(g).catch(coErr); }, 0);
}
async function coReview(g){
  g = g || TR.last || TR.g; if (!g) return {ok:false, why:'No game to review yet.'};
  const G = coG(g); const rec = trCoachRecord(g); if (!rec) return {ok:false, why:'No game to review yet.'};
  const data = {game:coDigest(rec, 42000), profile:coProfile(), yourTurnNotesThisGame:G.notes.filter(n => n.text).slice(-4).map(n => `T${n.t}: ${n.text}`)};
  const user = coScrub(`The game is over (result: ${rec.game.result}). Review it in exactly this shape, under 230 words:\nWhat decided the game: one or two sentences.\nTurning points:\n- Turn N: what you did, what would have been better and why. (exactly 3, your own three most important decisions, biggest impact first)\nPattern: one sentence linking this game to the recurring weaknesses in the profile, or to the earlier focus (did you improve?).\nFOCUS: one concrete habit to practise next game, in one sentence.\n\n${JSON.stringify(data)}`, g);
  const r = await coSend('review', user);
  if (!r.ok){ G.reviewErr = r.why; coRenderSoon(); return r; }
  G.review = {text:r.text, usd:r.usd, at:Date.now()}; G.reviewErr = '';
  const f = r.text.match(/^\s*FOCUS:\s*(.+)$/mi); if (f){ CO.mem.focus.push({at:Date.now(), text:short(f[1], 200)}); CO.mem.focus = CO.mem.focus.slice(-6); }
  coSave(); if (TR.open){ TR.tab = 'claude'; } coRenderSoon();
  return r;
}

/* ---- (c) ask the coach ---- */
async function coAsk(q){
  q = String(q || '').trim().slice(0, 600); if (!q) return {ok:false, pre:true, why:'Type a question first.'};
  if (Date.now() - CO.lastAsk < 4000) return {ok:false, pre:true, why:'One question at a time — wait a few seconds.'};
  const g = TR.g && TR.g.recs.length ? TR.g : TR.last; if (!g) return {ok:false, pre:true, why:'Play a game with the trainer on first: the coach answers about your current or last game.'};
  const gate = coGate('ask'); if (gate) return {ok:false, pre:true, why:gate};
  const G = coG(g); const rec = trCoachRecord(g);
  const data = {game:coDigest(rec, 30000), profile:coProfile(), review:G.review ? G.review.text : undefined, earlierQuestions:G.qa.filter(x => x.a).slice(-3).map(x => ({q:x.q, a:x.a}))};
  CO.lastAsk = Date.now();
  const user = coScrub(`The player asks about ${g.done ? 'their last game' : 'the game in progress'}: "${q}"\nAnswer in at most 120 words, using the record below. If the record doesn't show what they ask about, say so. If it's a rules question you aren't sure of, say so and suggest checking the card's rulings.\n\n${JSON.stringify(data)}`, g);
  const item = {q:coRedact(q), a:'', at:Date.now()}; G.qa.push(item); G.qa = G.qa.slice(-8); coRenderSoon();
  const r = await coSend('ask', user);
  if (r.ok){ item.a = r.text; item.usd = r.usd; } else item.err = r.why;
  coSave(); coRenderSoon(); return r;
}

/* ---- UI: a "Claude coach" tab in the Trainer panel ---- */
const CO_CSS = `#trPanel .cobox{border-left:3px solid #c08552;background:var(--panel-2);border-radius:6px;padding:6px 9px;margin:6px 0;white-space:pre-wrap}
#trPanel .cobox small{white-space:normal}
#trPanel .coerr{border-left-color:var(--bad, #e3705b)}
#trPanel .cogrid{display:grid;grid-template-columns:auto 1fr;gap:6px 8px;align-items:center}
#trPanel .cogrid input[type=number]{width:90px}
#trPanel textarea#coAsk{width:100%;min-height:52px;box-sizing:border-box}
#trPanel .comtr{height:6px;background:var(--line);border-radius:3px;overflow:hidden;margin:4px 0}
#trPanel .comtr i{display:block;height:100%;background:var(--brass)}`;
const coTxt = s => esc(coRedact(s));
function coNoteHTML(n){ return n.err ? `<div class="cobox coerr"><small>Turn ${n.t} · not sent</small>\n${coTxt(n.err)}</div>` : `<div class="cobox"><small>Claude · turn ${n.t}${n.usd != null ? ' · ' + coUsd(n.usd) : ''}</small>\n${coTxt(n.text)}</div>`; }
function coStatus(){
  if (!CO.cfg.on) return 'Off — the built-in trainer works on its own.';
  if (!coKey) return 'On, but no API key saved yet.';
  if (CO.busy) return `Asking Claude (${CO.busy === 'turn' ? 'turn notes' : CO.busy === 'review' ? 'game review' : 'your question'})…`;
  const gate = coGate('ask'); return gate ? gate : `Ready · ${CO_MODELS[CO.cfg.model].label.replace(/ \(.*$/, '')} · ${CO.cfg.style}.`;
}
function coTabHTML(){
  coRollMonth();
  const g = TR.g && TR.g.recs.length ? TR.g : (TR.last || TR.g); const G = g ? CO.games[g.id] : null;
  const U = CO.usage, cap = +CO.cfg.budget || 0, pct = cap ? Math.min(100, Math.round(100 * U.usd / cap)) : 100; const E = coEstimate();
  let h = `<div class="trrow"><b>Claude coach</b><small class="hint">${coTxt(coStatus())}</small></div>`;
  if (CO.msg && CO.msg.err) h += `<div class="cobox coerr">${coTxt(CO.msg.text)}\n<small>The built-in trainer's notes (This game / Review tabs) are unaffected.</small> <button type="button" class="btn small" data-act="coRetry">Try again</button></div>`;
  if (G && G.review) h += `<div class="cobox"><small>Game review${G.review.usd != null ? ' · ' + coUsd(G.review.usd) : ''}</small>\n${coTxt(G.review.text)}</div>`;
  else if (G && G.reviewErr) h += `<div class="cobox coerr"><small>Game review not available</small>\n${coTxt(G.reviewErr)}</div>`;
  if (g) h += `<div class="trrow"><button type="button" class="btn small" data-act="coReview" ${CO.busy ? 'disabled' : ''}>${G && G.review ? 'Review this game again' : 'Review ' + (g.done ? 'the last game' : 'the game so far')}</button></div>`;
  if (G && G.notes.length) h += `<details ${G.review ? '' : 'open'}><summary>Turn notes (${G.notes.length})</summary>${G.notes.slice().reverse().slice(0, 12).map(coNoteHTML).join('')}</details>`;
  h += `<div style="margin-top:8px"><label class="hint" for="coAsk">Ask the coach about ${g && !g.done ? 'this game' : 'your last game'}</label><textarea id="coAsk" maxlength="600" placeholder="e.g. Should I have attacked Opponent 2 on turn 6?"></textarea>
    <div class="trrow" style="margin-top:4px"><button type="button" class="btn small" data-act="coAsk" ${CO.busy ? 'disabled' : ''}>Ask</button><small class="hint">One question at a time. Answers use only what you could see.</small></div></div>`;
  if (G && G.qa.length) h += G.qa.slice().reverse().slice(0, 5).map(x => `<div class="cobox ${x.err ? 'coerr' : ''}"><small>You asked: ${coTxt(short(x.q, 140))}</small>\n${x.a ? coTxt(x.a) : x.err ? coTxt(x.err) : '…'}</div>`).join('');
  // settings
  const models = Object.entries(CO_MODELS).map(([id, m]) => `<option value="${id}" ${CO.cfg.model === id ? 'selected' : ''}>${esc(m.label)}</option>`).join('');
  const P = coPrice(CO.cfg.model);
  h += `<details id="coSet" ${!CO.cfg.on || !coKey ? 'open' : ''} style="margin-top:10px"><summary><b>Settings</b> · this month ${coUsd(U.usd)} of ${coUsd(cap)}</summary>
    <div class="trrow"><label><input type="checkbox" id="coOn" ${CO.cfg.on ? 'checked' : ''}> Use the Claude coach</label></div>
    <div class="cogrid">
      <label for="coKey">API key</label><span><input type="password" id="coKey" autocomplete="off" spellcheck="false" placeholder="${coKey ? 'a key is saved — paste a new one to replace it' : 'sk-ant-…'}" style="width:100%"></span>
      <span></span><span class="trrow" style="margin:0"><button type="button" class="btn small" data-act="coKeySave">Save key</button>${coKey ? '<button type="button" class="btn small" data-act="coKeyDel">Remove key</button>' : ''}<small class="hint">${coKey ? 'Key saved in this browser.' : 'No key saved.'}</small></span>
      <label for="coModel">Model</label><select id="coModel">${models}</select>
      <label for="coStyle">Style</label><select id="coStyle"><option value="gentle" ${CO.cfg.style === 'gentle' ? 'selected' : ''}>Gentle</option><option value="direct" ${CO.cfg.style === 'direct' ? 'selected' : ''}>Direct</option></select>
      <label for="coBudget">Monthly budget</label><span>$ <input type="number" id="coBudget" min="0" step="0.5" value="${esc(String(cap))}"> <small class="hint">the coach stops when it is reached</small></span>
    </div>
    <div class="trrow"><label><input type="checkbox" id="coPerTurn" ${CO.cfg.perTurn ? 'checked' : ''}> Notes after each of my turns (trainer Quiet / Live)</label></div>
    <div class="trrow"><label><input type="checkbox" id="coAutoRev" ${CO.cfg.autoReview ? 'checked' : ''}> Review each game when it ends</label></div>
    <div class="comtr" title="${pct}% of the monthly budget"><i style="width:${pct}%"></i></div>
    <small class="hint">This month (${esc(U.month)}): ${coUsd(U.usd)} · ${U.n} request${U.n === 1 ? '' : 's'} · ${U.inTok.toLocaleString()} tokens in / ${U.outTok.toLocaleString()} out. Estimated with ${esc(CO_MODELS[CO.cfg.model].label.replace(/ \(.*$/, ''))}: ~${coUsd(E.turn)} per turn note, ~${coUsd(E.review)} per review, ~${coUsd(E.game)} per 12-turn game${E.measured ? ' (from your own requests)' : ' (typical sizes)'}. The meter is this browser's estimate; the Claude Console shows the real bill.</small>
    <details style="margin-top:6px"><summary class="hint">Prices (USD per million tokens, ${CO_PRICE_DATE})</summary><div class="cogrid" style="margin-top:6px">
      <label for="coPin">Input</label><span><input type="number" id="coPin" min="0" step="0.01" value="${P.pin}"></span>
      <label for="coPout">Output</label><span><input type="number" id="coPout" min="0" step="0.01" value="${P.pout}"></span></div>
      <small class="hint">From Anthropic's pricing page on ${CO_PRICE_DATE}${P.tierOver ? `; prompts over ${P.tierOver.toLocaleString()} tokens cost ${P.tierX}×` : ''}. Edit if they change. <button type="button" class="btn small" data-act="coPriceReset">Reset</button></small></details>
    <p class="hint">The key is stored only in this browser and sent only to api.anthropic.com, straight from this page. It is never shared with other players or bots, never saved in game files or the trainer export, and never logged. Anyone using this browser profile could read it: give the key a low spending limit in the Claude Console. What is sent: your decisions with what you could see (opponents anonymised, their hands never included).</p>
  </details>`;
  return h;
}
let coRT = 0;
function coRenderSoon(){ if (coRT) return; coRT = setTimeout(() => { coRT = 0; try { if (TR.open) trRender(); } catch (e){ coErr(e); } }, 30); }

if (!BOTMODE){
  coLoad();
  { const st = document.createElement('style'); st.textContent = CO_CSS; document.head.appendChild(st); }
  // the panel: add the tab, the tab's body, and the latest turn note on "This game"; keep typing / focus across re-renders
  { const tr = trRender; trRender = function(){
      const p0 = document.getElementById('trPanel'); if (!p0 || p0.hidden) return tr.apply(this, arguments);
      const ae = document.activeElement; const fid = ae && ae.id && p0.contains(ae) ? ae.id : ''; let sel = null; try { if (fid && ae.selectionStart != null) sel = [ae.selectionStart, ae.selectionEnd]; } catch {}
      const openSet = !!(p0.querySelector('#coSet') && p0.querySelector('#coSet').open); const hadSet = !!p0.querySelector('#coSet');
      const want = TR.tab; if (want === 'claude') TR.tab = 'game';
      let r; try { r = tr.apply(this, arguments); } finally { TR.tab = want; }
      try {
        const p = document.getElementById('trPanel'); const tabs = p && p.querySelector('.trtabs'); if (!tabs) return r;
        tabs.insertAdjacentHTML('beforeend', `<button type="button" class="btn small" data-act="trTab" data-t="claude" aria-pressed="${want === 'claude'}">Claude coach</button>`);
        if (want === 'claude'){
          tabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.t === 'claude')));
          while (tabs.nextSibling) tabs.nextSibling.remove();
          const d = document.createElement('div'); d.id = 'coTab'; d.innerHTML = coTabHTML(); p.appendChild(d);
          const s = p.querySelector('#coSet'); if (s && hadSet) s.open = openSet;
          const ta = p.querySelector('#coAsk'); if (ta) ta.value = CO.draft;
          const kk = p.querySelector('#coKey'); if (kk) kk.value = coKeyDraft;
          if (fid){ const f = p.querySelector('#' + fid); if (f){ f.focus(); try { if (sel) f.setSelectionRange(sel[0], sel[1]); } catch {} } }
        } else if (want === 'game' && CO.cfg.on){
          const g = TR.g && TR.g.recs.length ? TR.g : (TR.last || TR.g); const G = g ? CO.games[g.id] : null; const n = G && G.notes[G.notes.length - 1];
          const busy = CO.busy === 'turn' ? '<div class="cobox"><small>Claude is looking at your turn…</small></div>' : '';
          if (n || busy) tabs.insertAdjacentHTML('afterend', busy + (n ? coNoteHTML(n) : ''));
        }
      } catch (e){ coErr(e); }
      return r; }; }
  { const te = trEndTurn; trEndTurn = function(){ const r = te.apply(this, arguments); try { coAfterTurn(); } catch (e){ coErr(e); } return r; }; }
  { const tf = trFinish; trFinish = function(){ const g = TR.g; const was = !!(g && !g.done); const r = tf.apply(this, arguments); try { if (was && g.done) coAfterGame(g); } catch (e){ coErr(e); } return r; }; }
  document.addEventListener('input', e => { const id = e.target && e.target.id; if (id === 'coAsk') CO.draft = e.target.value; else if (id === 'coKey') coKeyDraft = e.target.value; });
  document.addEventListener('change', e => { const t = e.target, id = t && t.id; if (!id || !/^co/.test(id)) return;
    if (id === 'coOn') CO.cfg.on = t.checked; else if (id === 'coPerTurn') CO.cfg.perTurn = t.checked; else if (id === 'coAutoRev') CO.cfg.autoReview = t.checked;
    else if (id === 'coModel'){ if (CO_MODELS[t.value]) CO.cfg.model = t.value; CO.keyBad = false; CO.msg = null; }
    else if (id === 'coStyle') CO.cfg.style = t.value === 'gentle' ? 'gentle' : 'direct';
    else if (id === 'coBudget') CO.cfg.budget = Math.max(0, +t.value || 0);
    else if (id === 'coPin' || id === 'coPout'){ const o = CO.cfg.prices[CO.cfg.model] || (CO.cfg.prices[CO.cfg.model] = {}); o[id === 'coPin' ? 'pin' : 'pout'] = Math.max(0, +t.value || 0); }
    else return;
    coSave(); coRenderSoon(); });
  document.addEventListener('keydown', e => { if (e.target && e.target.id === 'coAsk' && e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); ACT.coAsk(); } if (e.target && e.target.id === 'coKey' && e.key === 'Enter'){ e.preventDefault(); ACT.coKeySave(); } });
  window.addEventListener('online', () => { if (/Network/.test(CO.pauseWhy)) CO.pauseUntil = 0; coRenderSoon(); });
  Object.assign(ACT, {
    coKeySave(){ const el = document.getElementById('coKey'); const k = String((el && el.value) || coKeyDraft || '').trim(); if (el) el.value = ''; coKeyDraft = '';
      if (!k){ CO.msg = {err:true, text:'Paste a key first.'}; coRenderSoon(); return; }
      if (/\s/.test(k) || k.length < 20){ CO.msg = {err:true, text:'That does not look like an API key.'}; coRenderSoon(); return; }
      coSetKey(k); CO.cfg.on = true; CO.msg = {err:false, text:'Key saved in this browser.'}; coSave(); toast(/^sk-ant-/.test(k) ? 'Claude coach: key saved in this browser' : 'Key saved — Anthropic keys usually start with sk-ant-'); coRenderSoon(); },
    coKeyDel(){ coSetKey(''); coKeyDraft = ''; CO.msg = null; coSave(); toast('Claude coach: key removed from this browser'); coRenderSoon(); },
    coAsk(){ const ta = document.getElementById('coAsk'); const q = (ta && ta.value) || CO.draft; coAsk(q).then(r => { if (r && r.ok){ CO.draft = ''; } else if (r && r.pre && r.why){ CO.msg = {err:true, text:r.why}; } coRenderSoon(); }).catch(coErr); },
    coReview(){ const g = TR.g && TR.g.recs.length ? TR.g : TR.last; coReview(g).then(r => { if (r && !r.ok && r.why){ CO.msg = {err:true, text:r.why}; coRenderSoon(); } }).catch(coErr); },
    coRetry(){ CO.pauseUntil = 0; CO.msg = null; if (CO.keyBad && coKey) CO.keyBad = false; coRenderSoon(); },
    coPriceReset(){ delete CO.cfg.prices[CO.cfg.model]; coSave(); coRenderSoon(); },
  });
}
