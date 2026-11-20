// rbots2.js: bot players stage 2a: Hard and Very hard (+ botAdvise for the trainer). Playwright, real games.
// Usage: cd test && PTFILE=devHard.html PTPORT=19970 node rbots2.js
//        ONLY=hidden,scen,smoke,h1v1,vh1v1,pod   GAMES=20 PGAMES=12 PAR=2 FMT=duel
process.env.ALL = '1';
const H = require('./h'); const fs = require('fs'); const path = require('path');
const ONLY = (process.env.ONLY || 'hidden,scen,smoke,h1v1,vh1v1,pod').split(',');
const clean = t => t.split('\n').map(l => l.replace(/\s*\([A-Z0-9]{2,6}\)\s*[\w★-]*\s*(\*F\*)?\s*$/, '')).join('\n');
const realDeck = n => clean(fs.readFileSync(path.join(__dirname, '../decks/' + n + '.txt'), 'utf8'));
H.cards.forEach(c => { if (c.set === 'top' && !c.edhrec_rank) c.edhrec_rank = +c.collector_number - 999; });
const FZSRC = fs.readFileSync(path.join(__dirname, 'fuzz.js'), 'utf8');
const BOTSRC = FZSRC.slice(FZSRC.indexOf('function BOT(arg){'), FZSRC.indexOf('\n// ---------- Scryfall token search mock')).replace('try { await step(); }', 'try { if (!window.__FZNOSTEP) await step(); }');
const {tokenSearch} = new Function(FZSRC.slice(FZSRC.indexOf('const PRE = {'), FZSRC.indexOf('\n// ---------- one game')) + '\nreturn {tokenSearch};')();
const {randomDeck, rng} = new Function('H', FZSRC.slice(FZSRC.indexOf('function rng(seed)'), FZSRC.indexOf('// ---------- the bot and the invariant checker')) + '\nreturn {randomDeck, rng};')(H);
const withT = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout: ' + what)), ms))]);
const step = async (what, ms, fn) => { try { return await withT(fn(), ms, what); } catch (e){ H.check(false, what + ': ' + e.message.split('\n')[0]); return null; } };
const botFrames = p => p.frames().filter(f => /[?&]ptbot=/.test(f.url()));
const LBL = {easy:'Easy', intermediate:'Intermediate', hard:'Hard', veryhard:'Very hard', master:'Master'};

async function newPage(browser){
  const ctx = await browser.newContext({viewport:{width:1400, height:900}});
  await ctx.addInitScript(port => { window.PT_BROKERS = ['ws://localhost:' + port]; window.PT_RESP_MS = 1500; }, H.PORT);
  const page = await ctx.newPage(); page.__errs = [];
  page.on('pageerror', e => { page.__errs.push(e.message); console.log('  [pageerror]', e.message); });
  await H.route(page); await page.route('**/api.scryfall.com/cards/search**', tokenSearch);
  await page.goto(H.FILE);
  return page;
}
async function loadSave(page, name, text){
  await page.evaluate(() => lobbyPage('decks'));
  await page.fill('#deckIn', text); await page.click('#loadBtn');
  await page.waitForFunction(() => /Deck ready/.test(document.querySelector('#deckStatus').textContent), null, {timeout:60000});
  await page.evaluate(n => { LOBBY.deckName = n; const i = document.querySelector('#deckNameIn'); if (i) i.value = n; }, name);
  await page.evaluate(() => saveDeck());
  return page.evaluate(n => savedDecks().find(r => r.name === n)?.id, name);
}
async function injectCheckers(page, seed, human){
  if (human) await page.evaluate(`(${BOTSRC})(${JSON.stringify({seed})})`);
  for (const f of botFrames(page)) await f.evaluate(`window.__FZNOSTEP = 1; (${BOTSRC})(${JSON.stringify({seed:seed + 1})})`);
}

/* ---------------------------------------------------------------- 4. strength: seeded bot-only games */
async function match(browser, seatsFn, games, tag, opts = {}){
  const par = +(process.env.PAR || 2), fmt = opts.fmt || process.env.FMT || 'duel', cap = opts.cap || +(process.env.CAP || 40);
  const DECKS = (opts.decks || process.env.SDECKS || 'elminster,gaa,bluefarm,edgar').split(',');
  const OFF = +(process.env.GOFF || 0);
  console.log(`\n== strength: ${tag}, ${games} games (${fmt}), same deck for every seat, seeded${opts.pairs ? ', each seed played twice with the seats swapped (same libraries, so draw luck cancels)' : ''}, think delay 0, ${par} at a time`);
  const wins = {}; const TALLY = {}; const MST = {searches:0, ms:0, maxMs:0, dev:0, roll:0, cpu:0, maxSlice:0, errs:0, by:{}, gameMs:0}; let done = 0, draws = 0; const T0 = Date.now(); const turnsA = [];
  async function game(i){
    i += OFF; const pair = opts.pairs ? Math.floor(i / 2) : opts.rot ? Math.floor(i / opts.rot) : i; const deck = DECKS[pair % DECKS.length]; const seed = (opts.seed0 || 2000) + pair; const seats = seatsFn(i);
    const page = await newPage(browser);
    try {
      await page.evaluate(f => setFmt(f), fmt);
      const rd = deck === 'random' ? randomDeck(rng(seed * 7919 + 1)) : null;
      await loadSave(page, rd ? rd.name : deck, rd ? rd.txt : realDeck(deck));
      await page.evaluate(() => ACT.loadSaved({dataset:{id:savedDecks()[0].id}}));
      await page.evaluate(f => setFmt(f), fmt);
      const t0 = Date.now();
      if (process.env.MB) await page.evaluate(b => { MS.hostBudget = b; }, +process.env.MB);
      await page.evaluate(([s, seed, f]) => botsStartGame(s.map(x => ({...x, deck:'mine', speed:0})), {watch:true, seed, fmt:f, first:0}), [seats, seed, fmt]);
      if (process.env.DUMP){ await H.sleep(4000); for (const f of botFrames(page)) await f.evaluate(() => { BOT.acts.shift = () => {}; }).catch(() => {}); }
      let winner = null, turn = 0, why = '', lastMove = Date.now(), stalled = false;
      const deadline = Date.now() + (opts.maxMs || 900000);
      while (Date.now() < deadline){
        await H.sleep(1500);
        const st = await page.evaluate(() => BOTHOST.bots.map(b => ({nm:b.cfg.name, lv:b.cfg.level, lost:b.st.lost, turn:b.st.turn || 0, life:b.st.life})));
        const t2 = Math.max(...st.map(x => x.turn)); if (t2 !== turn){ turn = t2; lastMove = Date.now(); }
        if (Date.now() - lastMove > 180000){ why = 'STALLED'; stalled = true;
          for (const f of botFrames(page)){ const d = await f.evaluate(() => ({nm:S.nm, pid:MYPID.slice(0, 4), res:!!UI.resolving, cast:!!UI.casting, busy:BOT.busy, mystk:S.stk.length, top:S.stk.length ? {hold:!!S.stk[S.stk.length - 1].hold, nm:S.stk[S.stk.length - 1].nm, w:waitingOn(prioKey()).map(p => p.pid.slice(0, 4))} : null, lv:BOT.cfg.level, acts:BOT.acts.slice(-6), ms:typeof MS !== 'undefined' && BOT.cfg.level === 'master' ? {busy:MS.busy, trace:(MS.trace || []).slice(-6), per:Object.entries(MS.perTurn).slice(-3), cache:MS.cache.size, kick:!!MS.kick} : null, modal:UI.modal ? UI.modal.type + ':' + (UI.modal.title || '') : '', prm:S.prm.map(p => p.type), box:!!myBox(), ph:phaseNow(), stk:stackAll().length, cb:(cbOf(phaseNow()) || {}).step, lost:!!(S.lost || S.j18out)})).catch(e => ({err:e.message})); console.log('    STALL ' + JSON.stringify(d).slice(0, 1400)); }
          break; }
        const alive = st.filter(x => !x.lost);
        if (alive.length === 1){ winner = alive[0]; why = st.filter(x => x.lost).map(x => x.nm + ' ' + x.life).join(', '); break; }
        if (st.length === 2 && st.some(x => x.lost)){ winner = alive[0] || null; break; }
        if (turn > cap){ why = 'turn cap, life ' + st.map(x => x.nm + ' ' + x.life).join(' / '); break; }
      }
      if (process.env.DUMP) for (const f of botFrames(page)){ const d = await f.evaluate(() => ({lv:BOT.cfg.level, acts:BOT.acts, log:S.log.map(e => e.s)})).catch(() => null); if (d) fs.writeFileSync(`/tmp/dump_${seed}_${d.lv}.txt`, d.acts.join('\n') + '\n\n---- log\n' + d.log.join('\n')); }
      for (const f of botFrames(page)){ const d = await f.evaluate(() => ({lv:BOT.cfg.level, T:BOT.tally, M:BOT.cfg.level === 'master' && typeof MS !== 'undefined' ? MS.stats : null})).catch(() => null); if (!d) continue; const t = TALLY[d.lv] = TALLY[d.lv] || {}; for (const k in d.T) t[k] = (t[k] || 0) + d.T[k];
        if (d.M){ MST.searches += d.M.searches; MST.ms += d.M.ms; MST.maxMs = Math.max(MST.maxMs, d.M.maxMs); MST.dev += d.M.deviations; MST.roll += d.M.rollouts; MST.cpu += d.M.cpu; MST.maxSlice = Math.max(MST.maxSlice, d.M.maxSlice); MST.errs += d.M.errs || 0;
          for (const [p, x] of Object.entries(d.M.byPoint || {})){ const b = MST.by[p] = MST.by[p] || {n:0, ms:0, dev:0}; b.n += x.n; b.ms += x.ms; b.dev += x.dev; } } }
      const errs = await page.evaluate(() => BOTHOST.bots.reduce((s, b) => s + (b.st.errs || 0), 0));
      const peeks = await page.evaluate(() => BOTHOST.bots.reduce((s, b) => s + (b.st.peeks || 0), 0));
      if (winner){ wins[winner.lv] = (wins[winner.lv] || 0) + 1; turnsA.push(turn); } else draws++;
      MST.gameMs += Date.now() - t0; RESULTS.push({tag, i, seed, deck, seats:seats.map(s => s.level), winner:winner ? winner.lv : null, turn});
      done++;
      console.log(`  game ${i + 1} (${rd ? rd.name : deck}, seats ${seats.map(s => s.level).join('/')}, seed ${seed}): ${winner ? LBL[winner.lv] + ' won' : 'no winner'} at turn ${turn} in ${Math.round((Date.now() - t0) / 1000)}s — ${why}${errs ? ` (${errs} bot errors)` : ''}${peeks ? ` (${peeks} PEEKS)` : ''}${page.__errs.length ? ' PAGE ERRORS: ' + page.__errs[0] : ''}`);
      H.check(!page.__errs.length && !peeks, `${tag} game ${i + 1}: no page errors, no peeks`);
      H.check(!stalled, `${tag} game ${i + 1}: no stall (turn advanced within 3 minutes)`);
      if (errs) { const e = await Promise.all(botFrames(page).map(f => f.evaluate(() => BOT.errs.slice(0, 2)).catch(() => []))); console.log('    bot errors:', JSON.stringify(e).slice(0, 400)); }
    } catch (e){ console.log('  game', i + 1, 'harness error', e.message.split('\n')[0]); draws++; done++; }
    finally { await page.context().close().catch(() => {}); }
  }
  let next = 0; await Promise.all(Array.from({length:par}, async () => { while (next < games){ const i = next++; await game(i); } }));
  console.log(`  RESULT ${tag}: ${Object.entries(wins).map(([k, n]) => `${LBL[k]} ${n}`).join(' · ')} · no winner ${draws} — of ${done}; avg ${(turnsA.reduce((s, x) => s + x, 0) / Math.max(1, turnsA.length)).toFixed(1)} turns; wall ${Math.round((Date.now() - T0) / 1000)} s`);
  console.log('  per level: ' + Object.entries(TALLY).map(([k, t]) => `${LBL[k]}: ${JSON.stringify(t)}`).join(' · '));
  if (MST.searches) console.log(`  Master search: ${MST.searches} searches, avg ${(MST.ms / MST.searches).toFixed(0)} ms (max ${MST.maxMs.toFixed(0)} ms), ${MST.dev} deviations from Very hard, ${MST.roll} rollouts, CPU ${(MST.cpu / 1000).toFixed(1)} s, longest slice ${MST.maxSlice.toFixed(1)} ms, model errors ${MST.errs}; by point ${JSON.stringify(Object.fromEntries(Object.entries(MST.by).map(([p, x]) => [p, `${x.n} / ${(x.ms / Math.max(1, x.n)).toFixed(0)} ms / ${x.dev} dev`])))}`);
  return {wins, done, draws, MST};
}

const RESULTS = [];
// the label shown in the lobby must match the measurement: "(beta)" exactly when the level misses its target
async function labelOf(browser, lv){ const p = await newPage(browser); try { return await p.evaluate(l => BOT_LEVELS[l].label, lv); } finally { await p.context().close(); } }
async function strength(browser, which){
  const G = +(process.env.GAMES || 40);
  const nm = l => LBL[l].replace(' ', '');
  const pair = (a, b) => i => i % 2 === 0 ? [{level:a, name:nm(a)}, {level:b, name:nm(b)}] : [{level:b, name:nm(b)}, {level:a, name:nm(a)}];
  const judgeRate = async (lv, w, r, target, what) => {
    const rate = w / Math.max(1, r.done); const lab = await labelOf(browser, lv); const beta = /\(beta\)/.test(lab);
    console.log(`  RATE ${what}: ${w}/${r.done} = ${(100 * rate).toFixed(1)}% (target ${Math.round(target * 100)}%; no winner ${r.draws}) — label "${lab}"`);
    H.check(r.done >= Math.min(G, 16) && (rate >= target) === !beta, `strength: ${what} ${w}/${r.done} = ${(100 * rate).toFixed(0)}% vs target ${Math.round(target * 100)}% and the label "${lab}" ${beta ? 'keeps' : 'has no'} "(beta)"`);
  };
  if (which === 'x'){ const [a, b] = process.env.XL.split(','); await match(browser, pair(a, b), G, LBL[a] + ' vs ' + LBL[b], {seed0:+(process.env.XSEED || 6000), pairs:true}); }
  if (which === 'm1v1'){ const r = await match(browser, pair('master', 'veryhard'), G, 'Master vs Very hard', {seed0:+(process.env.XSEED || 6000), pairs:true}); await judgeRate('master', r.wins.master || 0, r, 0.6, 'Master beats Very hard (1v1)'); }
  if (which === 'vh1v1'){ const r = await match(browser, pair('veryhard', 'hard'), G, 'Very hard vs Hard', {seed0:+(process.env.XSEED || 4000), pairs:true}); await judgeRate('veryhard', r.wins.veryhard || 0, r, 0.55, 'Very hard beats Hard (1v1)'); }
  if (which === 'h1v1'){ const r = await match(browser, pair('hard', 'intermediate'), G, 'Hard vs Intermediate', {seed0:+(process.env.XSEED || 3000), pairs:true}); await judgeRate('hard', r.wins.hard || 0, r, 0.6, 'Hard beats Intermediate (1v1)'); }
  if (which === 'mpod'){
    const PG = +(process.env.PGAMES || 16); const lv = ['master', 'veryhard', 'hard', 'intermediate'];
    const r = await match(browser, i => lv.map((_, j) => lv[(j + i) % 4]).map(l => ({level:l, name:nm(l)})), PG, '4-pod Master / Very hard / Hard / Intermediate', {fmt:'cmd', cap:+(process.env.PCAP || 160), seed0:7000, maxMs:1800000, rot:4, decks:process.env.PDECKS || 'random,edgar,random,gaa'});
    const w = r.wins.master || 0; const lab = await labelOf(browser, 'master');
    console.log(`  RATE Master in 4-pods: ${w}/${r.done} = ${(100 * w / Math.max(1, r.done)).toFixed(1)}% (Very hard ${r.wins.veryhard || 0}, Hard ${r.wins.hard || 0}, Intermediate ${r.wins.intermediate || 0}, no winner ${r.draws})`);
    H.check(r.done >= Math.min(PG, 8) && w / r.done >= 0.35 || /\(beta\)/.test(lab), `strength: Master wins ${w}/${r.done} 4-pods (target 35%; label "${lab}")`);
  }
}

/* ---------------------------------------------------------------- 1. hidden information */
async function hidden(browser){
  console.log('\n== hidden information (master.js)');
  const files = ['master.js'];
  const code = files.map(f => fs.readFileSync(path.join(__dirname, '../src/' + f), 'utf8')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const FORBID = [[/\bparent\b/, 'window.parent'], [/\btop\s*\.|\btop\b(?=\s*[\[)])/, 'window.top'], [/\bframes\b/, 'frames'], [/\bopener\b/, 'opener'], [/localStorage|sessionStorage|indexedDB|store\.get/, 'storage'],
    [/postMessage|BroadcastChannel/, 'messaging'], [/BOTHOST|PTLOOP|\.cfg\.deck\b/, 'the host / other bots'], [/S\.lib\s*\[|S\.lib\.(?!length)/, 'my library order'], [/OPP\.get\([^)]*\)\s*\.\s*(?:hand|lib)\b|\.hand\b(?=[^\n]*\bOPP\b)/, "another player's hand or library"],
    [/\.lib\b(?!\.length|N)/, 'a library'], [/\bhr\b/, 'a revealed-hand list']];
  for (const [re, what] of FORBID){ const m = code.match(re); H.check(!m, `hidden info (structural, master.js): never touches ${what}${m ? ' — found "' + m[0] + '"' : ''}`); }
  const oppUses = [...code.matchAll(/OPP\.get\([^)]*\)\??\.(\w+)/g)].map(m => m[1]);
  H.check(oppUses.every(f => ['cdt', 'bf', 'cmd', 'life', 'psn', 'hc', 'ex'].includes(f)), `hidden info: OPP fields master.js reads are public (${[...new Set(oppUses)].join(', ') || 'none'})`);
  H.check(/MS\.determinize = /.test(code) && !/\.hand\b[^\n]*OPP|OPP[^\n]*\.hand\b/.test(code), 'hidden info: opponents\' hands are filled by sampling (MS.determinize), never read');
  H.check(/BOT\.deciding = true;\s*\n?\s*try \{ MS\.step/.test(code), 'hidden info: the runtime trap is armed while the search runs (BOT.deciding during every slice)');
}

/* ---------------------------------------------------------------- 2. scenarios: where search beats Very hard's heuristics (botAdvise on real tables) */
const PLACE = `window.__place = (n, o = {}) => { const z = ['lib', 'hand', 'gy'].find(z => S[z].some(c => cname(c) === n)); if (!z) return null; const c0 = S[z].find(c => cname(c) === n);
  moveCard(c0.id, 'bf', {quiet:true}); const c = S.bf.find(x => x.id === c0.id); c.sk = false; c.tap = !!o.tap; c.dmg = 0;
  if (o.p != null){ const b = ptOf(faceOf(c)) || [0, 0]; c.pu = [o.p - b[0], o.t - b[1]]; } if (o.kw) c.ekw = o.kw.slice(); if (o.co != null) c.co = o.co; commit(); return c.id; };
  window.__reset = () => { S.bf.slice().forEach(c => { if (c.tok) S.bf.splice(S.bf.indexOf(c), 1); else moveCard(c.id, 'lib', {quiet:true}); }); S.hand.slice().forEach(c => moveCard(c.id, 'lib', {quiet:true}));
    S.stk = []; S.bf.forEach(c => { c.atk = ''; c.blk = null; }); S.life = 20; S.psn = 0; S.landT = ['', 0]; commit(); };
  window.__hand = n => { const c = S.lib.find(c => cname(c) === n) || S.gy.find(c => cname(c) === n); if (!c) return false; moveCard(c.id, 'hand', {quiet:true}); commit(); return true; };
  window.__lands = (n, k) => { for (let i = 0; i < k; i++) __place(n); };`;
const ANA = ['Feed the Swarm', 'Memnite', 'Phyrexian Walker', 'Indomitable Ancients', 'Typhoid Rats', 'Llanowar Elves', 'Ornithopter', 'Quakestrider Ceratops', 'Baneslayer Angel', 'Ravenous Chupacabra', 'Gigantosaurus'];
const BIG = ['Gigantosaurus', 'Quakestrider Ceratops', 'Baneslayer Angel', 'Massacre Wurm', 'Liliana of the Veil', 'Memnite', 'Phyrexian Walker', 'Typhoid Rats', 'Garruk Wildspeaker', 'Elspeth, Sun\'s Champion'];
const WIPES = ['Day of Judgment', 'Doomskar', 'Sunfall', 'Supreme Verdict', 'Damnation', 'Hour of Revelation', 'Memnite', 'Baneslayer Angel', 'Phyrexian Walker', 'Indomitable Ancients'];
const deckOf = (cmd, list, lands) => `Commander\n1 ${cmd}\n\nDeck\n` + list.map(n => '1 ' + n).join('\n') + '\n' + lands + '\n';
async function table(browser, tag, deckA, deckB){
  const code = tag + '-' + (Date.now() % 100000);
  const A = await H.player(browser, 'Ana', deckA, 'host', code);
  const B = await H.player(browser, 'Ben', deckB, 'join', code);
  for (const p of [A, B]) await p.evaluate(PLACE);
  H.check(await H.waitFor(A, () => OPP.size === 1, null, 20000), `${tag}: two players seated`);
  await A.click('[data-act="goFirst"]'); await H.sleep(800);
  await A.evaluate(() => { S.untapN = currentTurn()[0]; setPhase(3); commit(); });
  return {A, B, close:async () => { await A.context().close(); await B.context().close(); }};
}
const sync = () => H.sleep(1300);
const adv = (p, lv, st) => p.evaluate(([l, s]) => botAdvise(l, s), [lv, st || {}]);
const show = r => `${r.reason}${r.detail ? ' — ' + String(r.detail).slice(0, 160) : ''}`;
const altStr = r => (r.alts || []).map(a => `${a.move} ${a.score} (${a.reason}, z ${a.z})`).join(" | ");
async function scen(browser){
  const SC = (process.env.SCEN || 'pw,hold,wipe').split(',');
  console.log('\n== scenarios: Master vs Very hard on the same position (botAdvise, 1.5 s budget)');
  const BUD = +(process.env.SBUD || 1500);
  let T = await table(browser, 'rb3a', deckOf('Krenko, Mob Boss', ANA, '12 Swamp\n12 Forest\n12 Plains'), deckOf('Thalia, Guardian of Thraben', BIG, '12 Forest\n12 Plains\n12 Swamp'));
  const {A, B} = T; const reset = async () => { for (const p of [A, B]) await p.evaluate(() => __reset()); await sync(); };
  try {
    // ---- 1. attack the planeswalker (Very hard never attacks planeswalkers)
    if (SC.includes('pw')) await step('scen planeswalker', 90000, async () => {
      await reset();
      await A.evaluate(() => { __place('Memnite', {p:3, t:3}); __place('Phyrexian Walker', {p:3, t:3}); __lands('Forest', 3); });
      await B.evaluate(() => { __place('Liliana of the Veil', {co:3}); __lands('Swamp', 3); });
      await sync();
      const vh = await adv(A, 'veryhard', {point:'attack'}); const ms = await adv(A, 'master', {point:'attack', budget:BUD, seed:11});
      const atPw = r => (r.move && r.move.attacks || []).filter(a => /^c:/.test(a.at)).length;
      console.log(`  (info) Very hard: ${JSON.stringify(vh.move && vh.move.attacks.map(a => a.name + '→' + (a.atName || a.at)))} [${show(vh)}]`);
      H.check(atPw(vh) === 1 && vh.move.attacks.length === 2, `scen planeswalker: Very hard now sends one 3/3 at Liliana and one at Ben (v22 gap: bots never attacked planeswalkers) → ${JSON.stringify(vh.move && vh.move.attacks.map(a => a.name + '→' + (a.atName || a.at)))}`);
      const hd = await adv(A, 'hard', {point:'attack'}); H.check(atPw(hd) === 1, `scen planeswalker: Hard does too (${JSON.stringify(hd.move && hd.move.attacks.map(a => a.at))})`);
      H.check(atPw(ms) >= 1 && ms.move.attacks.length === 2, `scen planeswalker: Master kills Liliana of the Veil (3 loyalty) with one 3/3 and hits Ben with the other → ${JSON.stringify(ms.move && ms.move.attacks.map(a => a.name + '→' + (a.atName || a.at)))} [${show(ms)}] alts: ${altStr(ms)}`);
      H.check((ms.alts || []).length >= 2 && ms.alts.every(a => typeof a.score === 'number' && a.reason), `scen planeswalker: botAdvise('master') ranks alternatives with scores and reasons (${(ms.alts || []).length})`);
    });
    // ---- 2. hold the only removal spell for the bigger threat that is coming
    if (SC.includes('hold')) await step('scen hold removal', 90000, async () => {
      await reset();
      await A.evaluate(() => { __lands('Swamp', 2); __lands('Forest', 2); __hand('Feed the Swarm'); __hand('Indomitable Ancients'); });
      await B.evaluate(() => { __place('Typhoid Rats', {p:3, t:3}); __lands('Forest', 6); ['Gigantosaurus', 'Quakestrider Ceratops', 'Baneslayer Angel', 'Massacre Wurm', 'Garruk Wildspeaker'].forEach(__hand); });
      await sync();
      const vh = await adv(A, 'veryhard', {point:'main'}); const ms = await adv(A, 'master', {point:'main', budget:BUD, seed:11});
      const mv = r => r.move ? (r.move.how === 'pass' ? 'pass' : r.move.how + ' ' + (r.move.card && r.move.card.name) + (r.move.target ? ' at ' + r.move.target.name : '')) : '?';
      console.log(`  (info) Very hard: ${mv(vh)} [${show(vh)}]`);
      H.check(/Feed the Swarm/.test(mv(vh)), `scen hold removal: Very hard fires Feed the Swarm at the 3/3 deathtouch Rats now (${mv(vh)})`);
      H.check(!/Feed the Swarm/.test(mv(ms)), `scen hold removal: Master keeps Feed the Swarm for the 10/10s in Ben's deck (5 cards in hand, 6 lands) → ${mv(ms)} [${show(ms)}] alts: ${altStr(ms)}`);
      // hidden information: Ben's real hand and library order don't change Master's answer
      const before = JSON.stringify(ms.alts);
      await B.evaluate(() => { S.hand.slice().forEach(c => moveCard(c.id, 'lib', {quiet:true})); for (let i = 0; i < 5; i++){ const c = S.lib.find(c => /Memnite|Phyrexian Walker|Forest|Swamp|Plains/.test(cname(c)) && !S.hand.includes(c)); if (c) moveCard(c.id, 'hand', {quiet:true}); } S.lib.reverse(); commit(); });
      await sync();
      const ms2 = await adv(A, 'master', {point:'main', budget:BUD, seed:11});
      H.check(await B.evaluate(() => S.hand.length) === 5 && JSON.stringify(ms2.alts) === before, `hidden info: replacing Ben's actual hand (same size) and reversing his library changes nothing in Master's advice (${altStr(ms2)})`);
    });
  } finally { await T.close(); }
  // ---- 3. don't overextend into a deck full of wipes
  T = await table(browser, 'rb3b', deckOf('Krenko, Mob Boss', ANA, '12 Swamp\n12 Forest\n12 Plains'), deckOf('Thalia, Guardian of Thraben', WIPES, '12 Plains\n12 Island\n12 Swamp'));
  try {
    const {A, B} = T;
    if (SC.includes('wipe')) await step('scen wipe', 90000, async () => {
      for (const p of [A, B]) await p.evaluate(() => __reset()); await sync();
      await A.evaluate(() => { __place('Memnite', {p:3, t:3}); __place('Phyrexian Walker', {p:3, t:3}); __lands('Forest', 2); __lands('Swamp', 2); __lands('Plains', 2); ['Typhoid Rats', 'Llanowar Elves', 'Indomitable Ancients'].forEach(__hand); setPhase(5); commit(); });
      await B.evaluate(() => { __place('Memnite'); __lands('Plains', 5); ['Day of Judgment', 'Doomskar', 'Sunfall', 'Supreme Verdict', 'Damnation'].forEach(__hand); });
      await sync();
      const vh = await adv(A, 'veryhard', {point:'main'}); const ms = await adv(A, 'master', {point:'main', budget:BUD, seed:11});
      const mv = r => r.move ? (r.move.how === 'pass' ? 'pass' : r.move.how + ' ' + (r.move.card && r.move.card.name) + (r.move.target ? ' at ' + r.move.target.name : '')) : '?';
      console.log(`  (info) Very hard: ${mv(vh)} [${show(vh)}]; Master: ${mv(ms)} alts: ${altStr(ms)}`);
      H.check(/^cast (Typhoid Rats|Llanowar Elves|Indomitable Ancients)/.test(mv(vh)), `scen wipe: Very hard adds a creature to a winning board (${mv(vh)})`);
      H.check(!/^cast (Typhoid Rats|Llanowar Elves|Indomitable Ancients)/.test(mv(ms)), `scen wipe: Master keeps its creatures in hand: Ben has 5 cards, 5 open mana and a deck full of wipes, and Ana is already ahead → ${mv(ms)} [${show(ms)}]`);
      await A.evaluate(() => { setPhase(3); commit(); });
    });
  } finally { await T.close(); }
}

/* ---------------------------------------------------------------- 3. time budget, CPU and UI responsiveness with 3 Master bots in one tab */
async function lagRun(browser, level, budget, secs){
  const page = await newPage(browser);
  const ids = await step('decks', 180000, async () => ({edgar:await loadSave(page, 'Edgar', realDeck('edgar')), gaa:await loadSave(page, 'GAA', realDeck('gaa')), elm:await loadSave(page, 'Elminster', realDeck('elminster'))}));
  if (!ids){ await page.context().close(); return null; }
  await page.evaluate(id => ACT.loadSaved({dataset:{id}}), ids.edgar);
  await page.evaluate(() => setFmt('cmd'));
  if (budget) await page.evaluate(b => { MS.hostBudget = b; }, budget);
  // the page's own event loop: how late does a 16 ms timer fire while the bots play?
  await page.evaluate(() => { window.__lag = []; let t = performance.now(); setInterval(() => { const n = performance.now(); window.__lag.push(n - t - 16); t = n; }, 16); });
  await page.evaluate(([lv, i]) => botsStartGame([{level:lv, deck:'saved:' + i.edgar, name:'B1', speed:0}, {level:lv, deck:'saved:' + i.gaa, name:'B2', speed:0}, {level:lv, deck:'saved:' + i.elm, name:'B3', speed:0}], {watch:true, seed:77, fmt:'cmd', first:0}), [level, ids]);
  const t0 = Date.now(); await H.waitFor(page, () => BOTHOST.bots.length === 3 && BOTHOST.bots.every(b => b.st.kept), null, 90000);
  await page.evaluate(() => { window.__lag = []; });
  const w0 = Date.now(); await H.sleep(secs * 1000); const wall = Date.now() - w0;
  const lag = await page.evaluate(() => { const a = window.__lag.slice().sort((x, y) => x - y); const q = p => a[Math.min(a.length - 1, Math.floor(p * a.length))] || 0; return {n:a.length, p50:q(0.5), p95:q(0.95), p99:q(0.99), max:a[a.length - 1] || 0}; });
  const st = []; for (const f of botFrames(page)){ const d = await f.evaluate(() => ({lv:BOT.cfg.level, turn:phaseNow().n, errs:BOT.errs.slice(0, 2), peeks:BOT.peeks.length, M:typeof MS !== 'undefined' ? {...MS.stats, byPoint:undefined} : null})).catch(() => null); if (d) st.push(d); }
  const turn = Math.max(0, ...st.map(x => x.turn));
  await page.context().close();
  return {lag, st, wall, turn};
}
async function budget(browser){
  const SECS = +(process.env.LAGS || 90);
  console.log(`\n== budget and responsiveness: 3 bots in one tab, instant speed, ${SECS} s each`);
  const vh = await lagRun(browser, 'veryhard', 0, SECS);
  const ms = await lagRun(browser, 'master', 0, SECS);
  if (!vh || !ms){ H.check(false, 'budget: games started'); return; }
  const f = r => `timer lateness p50 ${r.lag.p50.toFixed(0)} / p95 ${r.lag.p95.toFixed(0)} / p99 ${r.lag.p99.toFixed(0)} / max ${r.lag.max.toFixed(0)} ms over ${r.lag.n} ticks, reached turn ${r.turn}`;
  console.log(`  (info) 3 × Very hard: ${f(vh)}`); console.log(`  (info) 3 × Master:    ${f(ms)}`);
  const M = ms.st.map(x => x.M).filter(Boolean);
  const tot = k => M.reduce((s, x) => s + (x[k] || 0), 0); const mx = k => Math.max(0, ...M.map(x => x[k] || 0));
  const searches = tot('searches'), cpu = tot('cpu');
  console.log(`  (info) Master search: ${searches} searches, avg ${(tot('ms') / Math.max(1, searches)).toFixed(0)} ms, max ${mx('maxMs').toFixed(0)} ms, longest slice ${mx('maxSlice').toFixed(1)} ms, ${tot('rollouts')} rollouts; search CPU ${(cpu / 1000).toFixed(1)} s in ${(ms.wall / 1000).toFixed(0)} s = ${(100 * cpu / ms.wall).toFixed(1)}% of one core for 3 bots`);
  H.check(searches > 5, `budget: the Master bots searched (${searches} searches)`);
  H.check(mx('maxMs') <= 4000 + 60, `budget: no search ran past the 4 s hard cap (longest ${mx('maxMs').toFixed(0)} ms)`);
  H.check(mx('maxSlice') <= 40, `budget: the search yields to the page at least every ~12 ms (longest uninterrupted slice ${mx('maxSlice').toFixed(1)} ms)`);
  H.check(ms.lag.p95 <= vh.lag.p95 + 25, `budget: the page stays as responsive with 3 Master bots as with 3 Very hard bots (p95 timer lateness ${ms.lag.p95.toFixed(0)} vs ${vh.lag.p95.toFixed(0)} ms)`);
  H.check(ms.st.every(x => !x.peeks) && ms.st.every(x => !x.errs.length), `budget: no peeks, no bot errors (${JSON.stringify(ms.st.map(x => x.errs))})`);
  // a tight budget is respected
  const tight = await lagRun(browser, 'master', 150, 40);
  if (tight){ const T = tight.st.map(x => x.M).filter(Boolean); const mm = Math.max(0, ...T.map(x => x.maxMs || 0));
    H.check(T.reduce((s, x) => s + x.searches, 0) > 0 && mm <= 150 + 45, `budget: a 150 ms budget is honoured (longest search ${mm.toFixed(0)} ms over ${T.reduce((s, x) => s + x.searches, 0)} searches)`); }
}

(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch({headless:!process.env.HEADFUL});
  try {
    if (ONLY.includes('hidden')) await hidden(browser);
    if (ONLY.includes('scen')) await scen(browser);
    if (ONLY.includes('budget')) await budget(browser);
    for (const w of ['x', 'm1v1', 'mpod', 'h1v1', 'vh1v1']) if (ONLY.includes(w)) await strength(browser, w);
  } catch (e){ console.log(e.stack); H.check(false, 'harness: ' + e.message.split('\n')[0]); }
  if (process.env.RESOUT) fs.writeFileSync(process.env.RESOUT, JSON.stringify(RESULTS));
  await browser.close(); server.close();
  console.log(`\n${H.results.filter(r => r.startsWith('PASS')).length} passed, ${H.fails()} failed`);
  process.exit(H.fails() ? 1 : 0);
})();
