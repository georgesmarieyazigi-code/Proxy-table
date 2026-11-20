// rcoach.js: the optional Claude coach (stage 3b). The Anthropic API is MOCKED with Playwright route interception: no real key,
// no real request ever leaves the machine (anything not mocked is aborted by h.js's router).
// A real 3-player game over a local MQTT broker: Georges (trainer + coach), Kim and Lee (decks of unique cards, so their hidden
// hands can be checked against every request body).
// Usage: cd test && PTFILE=devCoach.html PTPORT=20020 node rcoach.js
process.env.ALL = '1';
const CARDS = require('./cards');
const fs = require('fs'); const path = require('path');
const withT = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout: ' + what)), ms))]);
const step = async (what, ms, fn) => { console.log('— ' + what); try { return await withT(fn(), ms, what); } catch (e){ H.check(false, what + ': ' + e.message.split('\n')[0]); return null; } };
let cn = 0; const mk = (name, mana, cmc, type, text, p, t) => ({object:'card', id:'id-coach-' + (++cn), name, mana_cost:mana, cmc, type_line:type, oracle_text:text, colors:[...new Set(mana.match(/[WUBRG]/g) || [])], color_identity:[...new Set(mana.match(/[WUBRG]/g) || [])], keywords:[], layout:'normal', set:'tco', collector_number:String(cn), set_name:'Coach test', released_at:'2024-01-01', power:p, toughness:t, prices:{usd:'0.1'}, image_uris:{normal:''}});
const MINE = ['Test Squire', 'Test Knight', 'Test Ogre', 'Test Pebble'];
const SECRET = ['Hidden Gnome', 'Secret Yeti', 'Veiled Sprite', 'Masked Golem', 'Quiet Hydra', 'Covert Wurm', 'Unseen Lynx', 'Shrouded Bear'];
CARDS.cards.push(mk('Test Squire', '{1}{W}', 2, 'Creature — Human Soldier', '', '2', '2'), mk('Test Knight', '{2}{W}', 3, 'Creature — Human Knight', '', '3', '2'),
  mk('Test Ogre', '{2}{R}', 3, 'Creature — Ogre', '', '3', '3'), mk('Test Pebble', '{2}', 2, 'Artifact Creature — Construct', '', '1', '1'),
  ...SECRET.map((n, i) => mk(n, '{3}{G}', 4, 'Creature — Beast', '', String(2 + i % 3), '3')));
const H = require('./h'); const sleep = H.sleep;
const list = o => Object.entries(o).map(([n, q]) => q + ' ' + n).join('\n');
const DECK_A = 'Commander\n1 Kenrith, the Returned King\n\nDeck\n' + list({'Plains':30, 'Island':20, 'Mountain':10, 'Forest':10, 'Test Squire':8, 'Test Knight':6, 'Test Ogre':8, 'Test Pebble':6, 'Counterspell':1});
const DECK_B = 'Commander\n1 Thalia, Guardian of Thraben\n\nDeck\n' + list({'Forest':40, ...Object.fromEntries(SECRET.slice(0, 4).map(n => [n, 15]))});
const DECK_C = 'Commander\n1 Krenko, Mob Boss\n\nDeck\n' + list({'Forest':40, ...Object.fromEntries(SECRET.slice(4).map(n => [n, 15]))});
const KEY = 'sk-ant-api03-TESTONLY-' + 'x9QmZ7rPfake'.repeat(4) + '-NOTREAL';
const URL_API = 'https://api.anthropic.com/v1/messages';

// ---- the mock Anthropic API
const MOCK = {mode:'ok', reqs:[], bigUsage:0, retryAfter:'30'};
function mockText(user){
  if (/^The game is over/.test(user)) return 'What decided the game: you fell behind on mana in the early turns (mock).\nTurning points:\n- Turn 2: you passed with mana open; casting Test Squire would have used it.\n- Turn 3: fine.\n- Turn 4: fine.\nPattern: unused mana again.\nFOCUS: Count your untapped mana before you press End turn.';
  if (/^The player asks/.test(user)) return 'Mock answer: on that turn holding up Counterspell was fine.';
  const t = (user.match(/^Turn (\d+)/) || [])[1]; return `- Turn ${t}: mock note — you used all your mana with Test Squire.\n- Keep playing a land first.`;
}
async function anthropicRoute(route){
  const req = route.request(); const body = req.postData() || ''; let j = null; try { j = JSON.parse(body); } catch {}
  MOCK.reqs.push({url:req.url(), method:req.method(), headers:req.headers(), body, j, mode:MOCK.mode, at:Date.now()});
  const cors = {'access-control-allow-origin':'*', 'access-control-allow-headers':'*', 'access-control-expose-headers':'retry-after, request-id', 'content-type':'application/json'};
  const err = (status, type, message, extra = {}) => route.fulfill({status, headers:{...cors, ...extra}, body:JSON.stringify({type:'error', error:{type, message}, request_id:'req_mock'})});
  if (MOCK.mode === 'down') return route.abort('internetdisconnected');
  if (MOCK.mode === '401') return err(401, 'authentication_error', 'invalid x-api-key');
  if (MOCK.mode === '402') return err(402, 'billing_error', 'Your credit balance is too low.');
  if (MOCK.mode === '429') return err(429, 'rate_limit_error', 'Number of requests has exceeded your rate limit.', {'retry-after':MOCK.retryAfter});
  if (MOCK.mode === '529') return err(529, 'overloaded_error', 'Overloaded');
  if (MOCK.mode === '400think' && j && (j.thinking || j.output_config)) return err(400, 'invalid_request_error', 'thinking.type: disabled is not supported for this model');
  const user = j && j.messages && j.messages[0] && j.messages[0].content || '';
  const input = MOCK.bigUsage || Math.ceil(body.length / 3);
  return route.fulfill({status:200, headers:cors, body:JSON.stringify({id:'msg_mock', type:'message', role:'assistant', model:j && j.model, content:[{type:'text', text:mockText(user)}], stop_reason:'end_turn', usage:{input_tokens:input, output_tokens:150, cache_creation_input_tokens:0, cache_read_input_tokens:0}})});
}
const nreq = () => MOCK.reqs.length;
async function waitReq(n, ms = 8000){ const t0 = Date.now(); while (Date.now() - t0 < ms){ if (MOCK.reqs.length >= n) return true; await sleep(100); } return false; }

// ---- game helpers (as in rtrainer.js)
const AUTO = () => { if (window.__auto) return; window.__auto = 1; setInterval(() => { const m = UI.modal; if (!m || m.__done) return;
  try {
    if (m.type === 'pick' && m.resolve){ const ids = (m.cards || []).slice(0, m.min || 0).map(c => c.id); m.__done = 1; m.sel = ids; ACT.pickDone(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); m.__done = 1; m.onClose = null; closeModal(); m.resolve(o[0] ? o[0].value : null); }
    else if (m.type === 'target' && m.resolve){ const i = (m.cands || []).findIndex(c => c.ok); if (i < 0) return; m.__done = 1; m.onClose = null; closeModal(); m.resolve([m.cands[i]]); }
    else if (m.type === 'bottom'){ m.__done = 1; m.sel = S.hand.slice(0, m.need).map(c => c.id); ACT.doBottom(); }
    else if (m.type === 'zone' || m.type === 'card'){ m.__done = 1; closeModal(); }
    else if (m.run){ m.__done = 1; m.run(m.def ?? 1); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 100); };
const DRIVE = (stopAfter) => { if (!S || UI.modal || UI.casting || UI.resolving) return 'busy'; const pn = phaseNow();
  if (stopAfter != null && pn.mine && pn.ph === 3 && S.untapN === pn.n && pn.n > stopAfter && !stackAll().length) return 'arrived';
  if (myBox()){ doPass(); return 'pass'; }
  if (!pn.mine){ const cb = cbOf(pn); if (pn.ph === 4 && cb && cb.step === 'blk' && attackersOnMe(pn).length && (S.bd || '') !== cbKey(pn, cb)){ UI.blkSel = {}; confirmBlocks(false); return 'noblock'; } return 'wait'; }
  if (stackAll().length) return 'stack';
  if (S.untapN < pn.n){ startMyTurn(); return 'start'; }
  if (pn.ph === 4 && S.cb && S.cb.step === 'atk'){ UI.atkSel = {}; declareAttackers(); return 'noattack'; }
  if (pn.ph >= 6 && S.hand.length > 7) return 'cleanup';
  nextAction(); return 'next'; };
const SETUP = (spec) => {
  const back = c => { reset(c); c.atk = ''; c.blk = null; S.lib.push(c); };
  for (const c of S.bf.slice()){ S.bf.splice(S.bf.indexOf(c), 1); if (c.tok) continue; if (c.cmd){ reset(c); S.cz.push(c); continue; } back(c); }
  for (const z of ['hand', 'gy', 'ex']) for (const c of S[z].slice()){ S[z].splice(S[z].indexOf(c), 1); if (c.cmd){ reset(c); S.cz.push(c); continue; } back(c); }
  const take = n => { const i = S.lib.findIndex(c => cname(c) === n); if (i < 0) throw new Error('no ' + n + ' in library'); const [c] = S.lib.splice(i, 1); reset(c); return c; };
  (spec.bf || []).forEach(n => { const c = take(n); c.tap = false; c.sk = false; place(c); S.bf.push(c); });
  (spec.hand || []).forEach(n => S.hand.push(take(n)));
  S.life = 40; S.pool = emptyPool(); S.landT = spec.landPlayed ? [turnStr(), 1] : ['', 0]; S.stk = []; S.lost = ''; S.cdt = {};
  commit(); return true; };
let A, B, C; const pages = () => [A, B, C];
async function drive(target, ms = 90000){
  const from = await target.evaluate(() => phaseNow().n); const t0 = Date.now();
  while (Date.now() - t0 < ms){ for (const p of pages()){ const r = await p.evaluate(`(${DRIVE})(${p === target ? from : 'null'})`).catch(e => 'err ' + e.message); if (p === target && r === 'arrived') return true; } await sleep(120); }
  return false;
}
const setup = (p, spec) => p.evaluate(`(${SETUP})(${JSON.stringify(spec)})`);
const id = (p, name) => p.evaluate(n => S.hand.find(c => cname(c) === n)?.id, name);
async function cast(p, name){ const cid = await id(p, name); if (!cid) throw new Error(name + ' not in hand'); const r = await H.menuClick(p, cid, /^Cast/); if (r !== 'ok') throw new Error('cast ' + name + ': ' + r); await H.waitFor(p, n => !UI.casting && !S.hand.some(c => cname(c) === n), name, 8000); }
async function playLand(p, name){ const cid = await id(p, name); const r = await H.menuClick(p, cid, /^Play land/); if (r !== 'ok') throw new Error('play ' + name + ': ' + r); await sleep(200); }
async function settle(ms = 15000){ const t0 = Date.now(); while (Date.now() - t0 < ms){ for (const p of pages()) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(250); if (!(await A.evaluate(() => stackAll().length > 0 || !!UI.resolving))) return true; } return false; }
async function myMain(){ if (await A.evaluate(() => phaseNow().mine && phaseNow().ph === 3 && !stackAll().length && S.untapN === phaseNow().n)) return true; return drive(A); }
// one of Georges's turns: a land and a 2-drop, then end the turn (one judged land + cast + end)
async function playTurn(extra){
  if (!(await myMain())) throw new Error('could not reach my main phase');
  await setup(A, {bf:['Plains', 'Plains'], hand:['Plains', 'Test Squire', ...(extra || [])]}); await sleep(300);
  await playLand(A, 'Plains'); await cast(A, 'Test Squire'); await settle();
  await A.evaluate(() => endTurnFlow()); await sleep(600);
}
// opponents' real hidden hands right now (names not in my deck and not public anywhere)
async function hiddenNow(){
  const out = [];
  for (const p of [B, C]){ const h = await p.evaluate(() => ({hand:S.hand.map(cname), pub:[...S.bf, ...S.gy, ...S.ex].map(cname)})); h.hand.forEach(n => { if (SECRET.includes(n) && !h.pub.includes(n)) out.push(n); }); }
  return [...new Set(out)];
}
const userOf = r => r.j && r.j.messages && r.j.messages[0] && r.j.messages[0].content || '';
const jsonOf = u => { const i = u.indexOf('{'); try { return JSON.parse(u.slice(i)); } catch { return null; } };
const panelText = () => A.evaluate(() => document.getElementById('trPanel') ? document.getElementById('trPanel').innerText : '');
const openTab = t => A.evaluate(t => { TR.tab = t; trOpen(true); trRender(); }, t);
function privacyCheck(r, hidden, tag){
  const u = userOf(r); const all = r.body;
  const leak = hidden.filter(n => all.includes(n));
  H.check(hidden.length > 0 && !leak.length, `${tag}: none of the opponents' ${hidden.length} hidden hand cards is in the request${leak.length ? ' — LEAK ' + leak.join(', ') : ''}`);
  const names = ['Kim', 'Lee', 'Georges'].filter(n => new RegExp('\\b' + n + '\\b').test(all));
  H.check(!names.length && !all.includes(MOCK.code) && !all.includes(KEY), `${tag}: no player names, table code or key in the body${names.length ? ' — found ' + names : ''}`);
  const keys = Object.keys(r.j || {}).sort(); const okKeys = keys.every(k => ['max_tokens', 'messages', 'model', 'output_config', 'system', 'thinking'].includes(k));
  H.check(okKeys && r.j.messages.length === 1 && r.j.messages[0].role === 'user' && typeof u === 'string', `${tag}: body has only model/max_tokens/system/messages(+thinking/output_config) — ${keys.join(',')}`);
}

async function main(browser){
  console.log('\n== a 3-player table: Georges (trainer + Claude coach), Kim, Lee');
  MOCK.code = 'coach-' + (Date.now() % 100000);
  A = await H.player(browser, 'Georges', DECK_A, 'host', MOCK.code);
  const reqLog = []; const consoleLog = [];
  A.on('request', r => reqLog.push({url:r.url(), headers:r.headers(), post:r.postData() || ''}));
  A.on('console', m => consoleLog.push(m.text()));
  await A.route('https://api.anthropic.com/**', anthropicRoute);
  B = await H.player(browser, 'Kim', DECK_B, 'join', MOCK.code); C = await H.player(browser, 'Lee', DECK_C, 'join', MOCK.code);
  H.check(await H.waitFor(A, () => OPP.size === 2, null, 20000), 'three players seated');
  for (const p of pages()) await p.evaluate(AUTO);
  await A.evaluate(() => { UI.cmdz = false; trSetMode('quiet'); });
  await A.click('[data-act="goFirst"]').catch(() => {}); await sleep(1200);

  await step('coach off: the trainer works alone, nothing is sent', 90000, async () => {
    H.check(await A.evaluate(() => typeof coAsk === 'function' && CO.cfg.on === false && !coKey), 'coach loaded, off, no key');
    if (!(await myMain())) throw new Error('no main phase');
    await setup(A, {bf:['Plains', 'Plains', 'Plains', 'Plains'], hand:['Test Squire'], landPlayed:true});
    const f0 = await A.evaluate(() => TR.g.finds.length);
    await A.evaluate(() => endTurnFlow()); await sleep(1200);
    const f = await A.evaluate(f0 => TR.g.finds.slice(f0).map(x => x.cat), f0);
    H.check(f.includes('unused_mana'), `the built-in trainer still flags (${f.join(',')})`);
    H.check(nreq() === 0, 'no request to Anthropic with the coach off');
  });

  await step('settings: save the key, it stays out of the page and the stored settings', 30000, async () => {
    await openTab('claude'); await sleep(200);
    H.check(/Claude coach/.test(await panelText()) && await A.evaluate(() => !!document.querySelector('#trPanel #coKey') && document.querySelector('#coKey').type === 'password'), 'the Claude coach tab has a password-type key field');
    await A.fill('#coKey', KEY); await A.click('#trPanel [data-act="coKeySave"]'); await sleep(300);
    const s = await A.evaluate(() => ({ls:localStorage.getItem('pt.coach.key'), on:CO.cfg.on, field:document.querySelector('#coKey') && document.querySelector('#coKey').value, cfg:localStorage.getItem('pt.coach') || ''}));
    H.check(s.ls === KEY && s.on, 'the key is saved under its own localStorage key and the coach is switched on');
    H.check(s.field === '' && !s.cfg.includes(KEY), 'the field is cleared after saving; the settings entry (pt.coach) does not contain the key');
    H.check(!(await A.content()).includes(KEY) && !(await panelText()).includes(KEY), 'the key is not in the page HTML / panel text');
    H.check(await A.evaluate(() => CO.cfg.model === 'claude-haiku-5-5'), 'default model: claude-haiku-5-5');
    await A.selectOption('#coStyle', 'gentle'); await sleep(100);
    H.check(await A.evaluate(() => CO.cfg.style === 'gentle' && JSON.parse(localStorage.getItem('pt.coach')).cfg.style === 'gentle'), 'style setting saved');
    await A.selectOption('#coStyle', 'direct');
  });

  let turnReq = null;
  await step('after my turn: one request, right endpoint / headers / body, rendered in the panel', 90000, async () => {
    const n0 = nreq(); if (!(await drive(A))) throw new Error('no next turn');
    await playTurn();
    H.check(await waitReq(n0 + 1), 'a per-turn request was sent when the turn ended');
    const hidden = await hiddenNow();
    const r = turnReq = MOCK.reqs[n0];
    H.check(r.url === URL_API && r.method === 'POST', `endpoint: POST ${r.url}`);
    const h = r.headers;
    H.check(h['x-api-key'] === KEY && h['anthropic-version'] === '2026-10-21' && h['anthropic-dangerous-direct-browser-access'] === 'true' && /application\/json/.test(h['content-type']), `headers: x-api-key, anthropic-version ${h['anthropic-version']}, direct-browser-access ${h['anthropic-dangerous-direct-browser-access']}`);
    H.check(!('authorization' in h) && !('cookie' in h), 'no Authorization / cookie headers');
    const j = r.j; H.check(j.model === 'claude-haiku-5-5' && j.max_tokens === 600 && Array.isArray(j.system) && /Commander coach|coach built into Proxy Table/.test(j.system[0].text) && j.system[0].cache_control && j.system[0].cache_control.type === 'ephemeral', 'body: model, max_tokens 600, cached system prompt');
    H.check(j.thinking && j.thinking.type === 'disabled' && j.output_config && j.output_config.effort === 'low' && !('temperature' in j), 'per-turn: Haiku thinking off, effort low, no temperature');
    H.check(/Tone: direct/.test(j.system[0].text) && /not certain|not sure/.test(j.system[0].text) && /flags come from the built-in trainer/.test(j.system[0].text), 'system prompt: style, rules-uncertainty and trust-the-flags instructions');
    privacyCheck(r, hidden, 'per-turn');
    const d = jsonOf(userOf(r));
    H.check(d && Array.isArray(d.decisionsSinceLastNote) && d.decisionsSinceLastNote.some(x => x.kind === 'cast' && x.did && x.did.card === 'Test Squire') && d.decisionsSinceLastNote.some(x => x.kind === 'end'), `per-turn data: this turn's decisions (${d && d.decisionsSinceLastNote.map(x => x.kind).join(',')})`);
    H.check(d && d.decisionsSinceLastNote.some(x => x.flags && x.flags.some(f => /unused mana/i.test(f))), 'per-turn data carries the built-in trainer\'s flags (the earlier unused-mana turn)');
    const opp = d && d.boardAtEndOfTurn && d.boardAtEndOfTurn.opponents || [];
    H.check(opp.length === 2 && opp.every(o => /^Opponent \d$/.test(o.who) && typeof o.hand === 'number'), `opponents anonymised, hand = a count (${JSON.stringify(opp.map(o => [o.who, o.hand]))})`);
    H.check(d && d.profile && 'stage' in d.profile, 'the coaching profile is included');
    await sleep(500); await openTab('game'); await sleep(200);
    H.check(/mock note — you used all your mana/.test(await panelText()), 'the note is shown in the Trainer panel (This game tab)');
    H.check(await A.evaluate(() => [...document.querySelectorAll('#trToasts .trT')].some(t => /Claude coach, turn/.test(t.textContent))), 'a non-blocking toast shows the first point (Quiet mode)');
    const n1 = nreq(); await A.evaluate(() => { coAfterTurn(); coAfterTurn(); trEndTurn(6); }); await sleep(800);
    H.check(nreq() === n1, 'rate limit: no second request for the same turn');
  });

  await step('next turn: only the new decisions are sent; cost meter adds up', 90000, async () => {
    const n0 = nreq(); if (!(await drive(A))) throw new Error('no next turn');
    await playTurn(); H.check(await waitReq(n0 + 1), 'second turn → second request');
    const d0 = jsonOf(userOf(turnReq)), d1 = jsonOf(userOf(MOCK.reqs[n0]));
    const max0 = Math.max(...d0.decisionsSinceLastNote.map(x => x.n)); H.check(d1.decisionsSinceLastNote.every(x => x.n > max0), 'the second request has only decisions after the first');
    privacyCheck(MOCK.reqs[n0], await hiddenNow(), 'per-turn 2');
    await sleep(300);
    const u = await A.evaluate(() => ({usd:CO.usage.usd, n:CO.usage.n, inTok:CO.usage.inTok, outTok:CO.usage.outTok, log:CO.log.map(x => ({inTok:x.inTok, outTok:x.outTok, usd:x.usd}))}));
    const exp = MOCK.reqs.filter(r => r.mode === 'ok').reduce((s, r) => s + (Math.ceil(r.body.length / 3) * 0.10 + 150 * 0.50) / 1e6, 0);
    H.check(u.n === 2 && Math.abs(u.usd - exp) < 1e-9, `cost meter: ${u.n} requests, ${u.inTok} in / ${u.outTok} out tokens = $${u.usd.toFixed(6)} (expected $${exp.toFixed(6)})`);
    console.log('  per-turn requests (mock usage = body chars / 3): ' + JSON.stringify(u.log));
    await openTab('claude'); await A.evaluate(() => { document.querySelector('#coSet').open = true; }); await sleep(100); const t = await panelText();
    H.check(/This month \(\d{4}-\d\d\): \$0\.0\d+ · 2 requests/.test(t) && /per turn note/.test(t), 'the settings show the running cost and the estimate per turn / game');
  });

  await step('ask the coach', 30000, async () => {
    const n0 = nreq(); await openTab('claude'); await sleep(150);
    await A.fill('#coAsk', 'Should I have held Counterspell mana on turn 3?'); await A.click('#trPanel [data-act="coAsk"]');
    H.check(await waitReq(n0 + 1), 'the question is sent'); await sleep(400);
    const r = MOCK.reqs[n0]; H.check(r.j.max_tokens === 900 && /^The player asks about the game in progress: "Should I have held Counterspell/.test(userOf(r)), 'ask body: the question + the game record');
    privacyCheck(r, await hiddenNow(), 'ask');
    H.check(/Mock answer: on that turn/.test(await panelText()), 'the answer is shown under the question');
    await A.fill('#coAsk', 'And another?'); await A.click('#trPanel [data-act="coAsk"]'); await sleep(500);
    H.check(nreq() === n0 + 1 && /wait a few seconds/.test(await panelText()), 'rate limit: a second question within 4 s is refused locally');
  });

  await step('errors fall back cleanly (401, 402, 429, 529, network down, 400 on thinking)', 90000, async () => {
    const ask = async q => { await A.evaluate(() => { CO.lastAsk = 0; }); await A.evaluate(q => { CO.draft = q; }, q); await openTab('claude'); await A.click('#trPanel [data-act="coAsk"]'); await sleep(700); return panelText(); };
    MOCK.mode = '401'; let n0 = nreq(); let t = await ask('q401');
    H.check(nreq() === n0 + 1 && /rejected the API key/.test(t) && /built-in trainer/.test(t), '401: "rejected the API key", trainer still named as working');
    t = await ask('q401b'); H.check(nreq() === n0 + 1, '401: no more requests until a new key is saved');
    await A.evaluate(k => { coSetKey(k); }, KEY);
    MOCK.mode = '402'; n0 = nreq(); t = await ask('q402');
    H.check(nreq() === n0 + 1 && /No API credits left/.test(t), '402: "no API credits left"');
    await ask('q402b'); H.check(nreq() === n0 + 1, '402: paused, nothing more sent');
    await A.evaluate(() => ACT.coRetry());
    MOCK.mode = '429'; n0 = nreq(); t = await ask('q429');
    H.check(nreq() === n0 + 1 && /Rate limited by Anthropic \(429\)\. Pausing the coach for 30 s/.test(t), '429: pauses for the retry-after time');
    // a turn while paused: the trainer records, the coach sends nothing
    const r0 = await A.evaluate(() => TR.g.recs.length); if (!(await drive(A))) throw new Error('no next turn'); await playTurn(); await sleep(800);
    H.check(nreq() === n0 + 1 && await A.evaluate(r0 => TR.g.recs.length > r0, r0), '429: during the pause the trainer keeps recording and no turn request is sent');
    await A.evaluate(() => ACT.coRetry());
    MOCK.mode = '529'; n0 = nreq(); t = await ask('q529'); H.check(nreq() === n0 + 1 && /busy or had an error \(529\)/.test(t), '529: "Anthropic is busy"');
    await A.evaluate(() => ACT.coRetry());
    MOCK.mode = 'down'; n0 = nreq(); t = await ask('qdown'); H.check(/Could not reach api\.anthropic\.com/.test(t), 'network down: "Could not reach api.anthropic.com"');
    await A.evaluate(() => ACT.coRetry());
    MOCK.mode = '400think'; n0 = nreq(); t = await ask('q400');
    const two = MOCK.reqs.slice(n0); H.check(two.length === 2 && two[0].j.thinking && !two[1].j.thinking && !two[1].j.output_config && /Mock answer/.test(t), '400 about thinking/effort: retried once without those fields, answer shown');
    MOCK.mode = 'ok';
    const e = await A.evaluate(() => ({tr:TR.errs.length, co:CO.errs.slice()})); H.check(!e.tr && !e.co.length, `no trainer / coach errors (${JSON.stringify(e.co).slice(0, 200)})`);
  });

  await step('budget cap stops requests', 90000, async () => {
    await A.evaluate(() => { ACT.coRetry(); CO.lastAsk = 0; CO.cfg.budget = CO.usage.usd + 0.002; coSave(); });
    MOCK.bigUsage = 150000; let n0 = nreq();          // a prompt over 100k tokens: Haiku's higher tier → $0.075 + output
    await A.evaluate(() => { CO.draft = 'big one'; }); await openTab('claude'); await A.click('#trPanel [data-act="coAsk"]'); await waitReq(n0 + 1); await sleep(500);
    const u = await A.evaluate(() => ({usd:CO.usage.usd, cap:CO.cfg.budget, last:CO.log[CO.log.length - 1].usd}));
    H.check(Math.abs(u.last - (150000 * 0.5 + 150 * 2.5) / 1e6) < 1e-9, `tiered price: a 150k-token prompt costs $${u.last.toFixed(4)} (5× rates)`);
    MOCK.bigUsage = 0; n0 = nreq();
    await A.evaluate(() => { CO.lastAsk = 0; CO.draft = 'over budget?'; }); await A.click('#trPanel [data-act="coAsk"]'); await sleep(600);
    H.check(nreq() === n0 && /Monthly budget reached/.test(await panelText()), `over the cap ($${u.usd.toFixed(4)} of $${u.cap.toFixed(4)}): nothing sent, "Monthly budget reached"`);
    if (!(await drive(A))) throw new Error('no next turn'); await playTurn(); await sleep(800);
    H.check(nreq() === n0, 'over the cap: no per-turn request either');
    // a cap the next request might cross is refused before sending
    await A.evaluate(() => { CO.cfg.budget = CO.usage.usd + 0.00005; CO.lastAsk = 0; CO.draft = 'near cap'; });
    await A.click('#trPanel [data-act="coAsk"]'); await sleep(500);
    H.check(nreq() === n0 && /would pass your monthly budget/.test(await panelText()), 'a request whose worst case would pass the cap is refused before sending');
    await A.evaluate(() => { CO.cfg.budget = 2; coSave(); ACT.coRetry(); });
  });

  await step('post-game review: requested once, uses the profile, stores the focus', 60000, async () => {
    const n0 = nreq(); const hidden = await hiddenNow();
    await A.evaluate(() => trFinish('lost')); H.check(await waitReq(n0 + 1), 'the game ended → one review request'); await sleep(600);
    const r = MOCK.reqs[n0]; const j = r.j;
    H.check(j.max_tokens === 3000 && j.output_config && j.output_config.effort === 'medium' && !j.thinking, 'review: max_tokens 3000, effort medium, adaptive thinking');
    H.check(/^The game is over \(result: lost\)/.test(userOf(r)) && /Turning points/.test(userOf(r)) && /FOCUS:/.test(userOf(r)), 'review prompt: what decided it, 3 turning points, 1 focus');
    const d = jsonOf(userOf(r)); H.check(d && d.game && d.game.decisions.length > 5 && d.profile && Array.isArray(d.yourTurnNotesThisGame), `review data: ${d && d.game.decisions.length} decisions + profile + this game's turn notes`);
    privacyCheck(r, hidden, 'review');
    console.log(`  review request: ${r.body.length} chars ≈ ${Math.ceil(r.body.length / 3)} tokens`);
    const t = await panelText(); H.check(/What decided the game: you fell behind/.test(t), 'the review is shown in the Claude coach tab');
    H.check(await A.evaluate(() => CO.mem.focus.some(f => /Count your untapped mana/.test(f.text)) && coProfile().yourEarlierFocus.some(x => /Count your untapped mana/.test(x))), 'the FOCUS line is remembered and goes into the next prompts (coaching builds across games)');
    await A.evaluate(() => trFinish('lost')); await sleep(500); H.check(nreq() === n0 + 1, 'no second automatic review');
    const n1 = nreq(); await A.evaluate(() => { CO.lastAsk = 0; }); await A.click('#trPanel [data-act="coReview"]'); H.check(await waitReq(n1 + 1), 'explicit "Review again" sends one more');
  });

  await step('privacy: the key never leaves this browser except to api.anthropic.com', 40000, async () => {
    const withKey = reqLog.filter(r => JSON.stringify(r.headers).includes(KEY) || r.post.includes(KEY) || r.url.includes(KEY));
    H.check(withKey.length > 0 && withKey.every(r => r.url === URL_API) && reqLog.filter(r => r.url.includes('anthropic')).every(r => r.url === URL_API), `the key was sent ${withKey.length}× — only to ${URL_API}`);
    H.check(!MOCK.reqs.some(r => r.body.includes(KEY)), 'the key is never in a request body');
    H.check(PUBS.length > 20 && !PUBS.some(p => p.includes(KEY)), `the key is in none of the ${PUBS.length} messages published to the table`);
    const opp = await B.evaluate(() => JSON.stringify([...OPP.values()])); H.check(!opp.includes(KEY) && !/coach/i.test(opp.replace(/coach-\d+/g, '')), 'other players\' view of Georges has no key and no coach data');
    const leaks = await A.evaluate(k => Object.keys(localStorage).filter(x => x !== 'pt.coach.key' && String(localStorage.getItem(x)).includes(k)), KEY);
    H.check(!leaks.length, `no other localStorage entry (saved game pt.save, trainer, settings) contains the key${leaks.length ? ' — ' + leaks : ''}`);
    await A.evaluate(() => saveNow());
    const ex = await A.evaluate(() => JSON.stringify(trExport())); H.check(!ex.includes(KEY) && !/pt\.coach/.test(ex), 'the trainer export has no key');
    H.check(!(await A.content()).includes(KEY), 'the page HTML has no key');
    H.check(!consoleLog.some(l => l.includes(KEY)), `the console never shows the key (${consoleLog.length} console lines)`);
    const st = await A.evaluate(k => JSON.stringify({CO:{...CO}, S, log:typeof LOGS !== 'undefined' ? [...LOGS.values ? LOGS.values() : []] : []}).includes(k), KEY);
    H.check(!st, 'the key is not in the game state S, the game log or the coach state object');
    // remove the key
    await openTab('claude'); await A.evaluate(() => { const d = document.querySelector('#coSet'); if (d) d.open = true; });
    await A.click('#trPanel [data-act="coKeyDel"]'); await sleep(200);
    H.check(await A.evaluate(() => localStorage.getItem('pt.coach.key') === null && !coKey), 'Remove key: gone from localStorage and memory');
    const n0 = nreq(); await A.evaluate(() => { CO.lastAsk = 0; CO.draft = 'no key'; }); await A.click('#trPanel [data-act="coAsk"]'); await sleep(400);
    H.check(nreq() === n0 && /No API key saved/.test(await panelText()), 'without a key nothing is sent ("No API key saved")');
  });

  await step('structural: coach.js only fetches the API URL, never publishes, never reads other players\' hands', 5000, async () => {
    let code = fs.readFileSync(path.join(__dirname, '../src/coach.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
    const fetches = code.match(/\bfetch\s*\(/g) || [];
    H.check(fetches.length === 1 && /fetch\(CO_URL,/.test(code) && /const CO_URL = 'https:\/\/api\.anthropic\.com\/v1\/messages'/.test(code), 'one fetch, to the constant https://api.anthropic.com/v1/messages');
    for (const [re, what] of [[/console\.(log|info|warn|error|debug)/, 'console logging'], [/mqPublish|\bpublish\s*\(|sendRq|postMessage|BroadcastChannel|commit\s*\(/, 'publishing / messaging'], [/OPP\.get\([^)]*\)\s*\.\s*(?:hand|lib)\b|\.lib\b/, 'hands / libraries'], [/XMLHttpRequest|sendBeacon|WebSocket|new Image/, 'other network calls']])
      { const m = code.match(re); H.check(!m, `coach.js has no ${what}${m ? ' — found ' + m[0] : ''}`); }
    const keyUses = (code.match(/\bcoKey\b/g) || []).length; console.log('  coKey referenced ' + keyUses + ' times');
  });
}

const PUBS = [];
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  H.aedes.on('publish', (packet) => { try { PUBS.push(String(packet.payload || '')); } catch {} });
  const browser = await H.chromium.launch({headless:!process.env.HEADFUL});
  try { await main(browser); } catch (e){ H.check(false, 'harness: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close();
  console.log(`\n${H.results.filter(r => r.startsWith('PASS')).length} passed, ${H.fails()} failed`);
  process.exit(H.fails() ? 1 : 0);
})();
