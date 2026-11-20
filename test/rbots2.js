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
const LBL = {easy:'Easy', intermediate:'Intermediate', hard:'Hard', veryhard:'Very hard'};

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

/* ---------------------------------------------------------------- 1. hidden information */
async function hidden(browser){
  console.log('\n== hidden information (stage 2a files)');
  const files = ['botlevels2.js', 'cardroles.js'];
  const code = files.map(f => fs.readFileSync(path.join(__dirname, '../src/' + f), 'utf8')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const FORBID = [[/\bparent\b/, 'window.parent'], [/\btop\s*\.|\btop\b(?=\s*[\[)])/, 'window.top'], [/\bframes\b/, 'frames'], [/\bopener\b/, 'opener'], [/localStorage|sessionStorage|indexedDB|store\.get/, 'storage'],
    [/postMessage|BroadcastChannel/, 'messaging'], [/BOTHOST|PTLOOP|\.cfg\.deck\b/, 'the host / other bots'], [/S\.lib\s*\[|S\.lib\.(?!length)/, 'my library order'], [/OPP\.get\([^)]*\)\s*\.\s*(?:hand|lib)\b|\.hand\b(?=[^\n]*\bOPP\b)/, "another player's hand or library"],
    [/\.lib\b(?!\.length|N)/, 'a library'], [/\bhr\b/, "a revealed-hand list"]];
  for (const [re, what] of FORBID){ const m = code.match(re); H.check(!m, `hidden info (structural, ${files.join(' + ')}): never touches ${what}${m ? ' — found "' + m[0] + '"' : ''}`); }
  // the only OPP fields the stage-2a code reads are public ones
  const oppUses = [...code.matchAll(/OPP\.get\([^)]*\)\??\.(\w+)/g)].map(m => m[1]);
  H.check(oppUses.every(f => ['cdt', 'bf', 'cmd', 'life', 'psn', 'hc'].includes(f)), `hidden info: OPP fields read are public (${[...new Set(oppUses)].join(', ') || 'none'})`);
  // scry/surveil reads only the cards the dialog shows
  H.check(/\(m\.ids \|\| \[\]\)\.map\(id => find\(id\)\[2\]\)/.test(code), 'hidden info: scry/surveil decides from the ids the dialog shows');
}

/* ---------------------------------------------------------------- 2. scenarios through botAdvise (the trainer API) on real 2- and 3-player tables */
const BODIES = ['Memnite', 'Phyrexian Walker', 'Indomitable Ancients', 'Gigantosaurus', 'Quakestrider Ceratops', 'Ornithopter', 'Typhoid Rats', 'Llanowar Elves', 'Elvish Mystic'];
const SPELLS = ['Counterspell', 'Opt', 'Swords to Plowshares', 'Murder', 'Giant Growth', 'Isochron Scepter', 'Dramatic Reversal', 'Craterhoof Behemoth', 'Kiki-Jiki, Mirror Breaker', 'Watery Grave', 'Evolving Wilds', 'Lightning Bolt'];
const scenDeck = cmd => `Commander\n1 ${cmd}\n\nDeck\n` + [...BODIES, ...SPELLS].map(n => '1 ' + n).join('\n') + '\n20 Island\n20 Forest\n15 Swamp\n';
// put a card on my battlefield with exact P/T and keywords (pump counters / extra keywords: public, so the other side sees them too)
const PLACE = `window.__place = (n, o = {}) => { const z = ['lib', 'hand', 'gy'].find(z => S[z].some(c => cname(c) === n)); if (!z) return null; const c0 = S[z].find(c => cname(c) === n);
  moveCard(c0.id, 'bf', {quiet:true}); const c = S.bf.find(x => x.id === c0.id); c.sk = false; c.tap = !!o.tap; c.dmg = 0;
  if (o.p != null){ const b = ptOf(faceOf(c)) || [0, 0]; c.pu = [o.p - b[0], o.t - b[1]]; } if (o.kw) c.ekw = o.kw.slice(); commit(); return c.id; };
  window.__reset = () => { S.bf.slice().forEach(c => { if (c.tok) S.bf.splice(S.bf.indexOf(c), 1); else moveCard(c.id, 'lib', {quiet:true}); }); S.hand.slice().forEach(c => moveCard(c.id, 'lib', {quiet:true}));
    S.stk = []; S.bf.forEach(c => { c.atk = ''; c.blk = null; }); S.life = 20; S.psn = 0; S.landT = ['', 0]; commit(); };
  window.__hand = n => { const c = S.lib.find(c => cname(c) === n) || S.gy.find(c => cname(c) === n); if (!c) return false; moveCard(c.id, 'hand', {quiet:true}); commit(); return true; };`;
async function scen(browser){
  console.log('\n== scenarios (botAdvise on real tables)');
  const code = 'rb2-' + (Date.now() % 100000);
  const A = await H.player(browser, 'Ana', scenDeck('Krenko, Mob Boss'), 'host', code);
  const B = await H.player(browser, 'Ben', scenDeck('Thalia, Guardian of Thraben'), 'join', code);
  for (const p of [A, B]) await p.evaluate(PLACE);
  H.check(await H.waitFor(A, () => OPP.size === 1, null, 20000), 'scen: two players seated');
  await A.click('[data-act="goFirst"]'); await H.sleep(800);
  await A.evaluate(() => { S.untapN = currentTurn()[0]; setPhase(3); commit(); });
  const bpid = await B.evaluate(() => MYPID), apid = await A.evaluate(() => MYPID);
  const sync = () => H.sleep(1200);
  const reset = async () => { for (const p of [A, B]) await p.evaluate(() => __reset()); await sync(); };
  const adv = (p, lv, st) => p.evaluate(([l, s]) => botAdvise(l, s), [lv, st || {}]);
  const show = r => `${r.reason}${r.detail ? ' — ' + r.detail : ''}`;
  try {
    // --- combat a step ahead
    await step('scen double block', 60000, async () => {
      await reset();
      await A.evaluate(() => { __place('Indomitable Ancients', {p:3, t:3}); });
      await B.evaluate(() => { __place('Memnite', {p:2, t:2}); __place('Phyrexian Walker', {p:2, t:2}); });
      await sync();
      for (const lv of ['hard', 'veryhard']){ const r = await adv(A, lv, {point:'attack'});
        H.check(r.move && r.move.attacks.length === 0, `scen ${LBL[lv]}: a 3/3 does not attack into two untapped 2/2s (double block loses it) → ${JSON.stringify(r.move && r.move.attacks.map(a => a.name))} [${show(r)}]`); }
      // and with only one 2/2 back, attacking is fine
      await B.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Phyrexian Walker'); moveCard(c.id, 'lib', {quiet:true}); commit(); }); await sync();
      const r2 = await adv(A, 'hard', {point:'attack'});
      H.check(r2.move && r2.move.attacks.length === 1, `scen Hard: the same 3/3 attacks when only one 2/2 can block [${show(r2)}]`);
    });
    await step('scen lethal trample + evasion', 60000, async () => {
      await reset();
      await A.evaluate(() => { __place('Gigantosaurus', {p:6, t:6, kw:['trample']}); __place('Ornithopter', {p:4, t:4}); });
      await B.evaluate(() => { __place('Memnite', {p:1, t:1}); __place('Phyrexian Walker', {p:0, t:3}); S.life = 6; commit(); });
      await sync();
      for (const lv of ['hard', 'veryhard']){ const r = await adv(A, lv, {point:'attack'});
        H.check(r.move && r.move.attacks.length === 2 && r.reason === 'attack_lethal', `scen ${LBL[lv]}: finds lethal (6/6 trample + 4/4 flier vs 6 life, a 1/1 and a 0/3: the best blocks still let 6 through) → ${JSON.stringify(r.move && r.move.attacks.map(a => a.name))} [${show(r)}]`); }
      const ri = await A.evaluate(() => { const v = botView(); return Object.keys(BOT_LEVELS.intermediate.attack.call(BOT_LEVELS.intermediate, v)).length; });
      console.log(`  (info) Intermediate on the same board attacks with ${ri}`);
    });
    await step('scen chump only when needed', 60000, async () => {
      await reset();
      await B.evaluate(() => { __place('Memnite', {p:1, t:1}); });
      await A.evaluate(pid => { const id = __place('Gigantosaurus', {p:6, t:6}); S.bf.find(c => c.id === id).atk = 'p:' + pid; commit(); }, bpid);
      await sync();
      let r = await adv(B, 'hard', {point:'block'});
      H.check(r.move && r.move.blocks.length === 0, `scen Hard: at 20 life it does not chump a 6/6 with its 1/1 [${show(r)}]`);
      await B.evaluate(() => { S.life = 5; commit(); }); await sync();
      r = await adv(B, 'hard', {point:'block'});
      H.check(r.move && r.move.blocks.length === 1, `scen Hard: at 5 life it chump-blocks the 6/6 [${show(r)}]`);
      r = await adv(B, 'veryhard', {point:'block'});
      H.check(r.move && r.move.blocks.length === 1, `scen Very hard: at 5 life it chump-blocks the 6/6 [${show(r)}]`);
      // a good block: my 2/10 wall eats a 6/6 attacker with nothing lost
      await B.evaluate(() => { S.life = 20; __place('Indomitable Ancients', {p:2, t:10}); }); await sync();
      r = await adv(B, 'hard', {point:'block'});
      H.check(r.move && r.move.blocks.length === 1 && r.move.blocks[0].name === 'Indomitable Ancients', `scen Hard: blocks the 6/6 with the 2/10 (safe block) [${show(r)}]`);
      // deathtouch: a 1/1 deathtouch trades up with the 6/6
      await B.evaluate(() => { const w = S.bf.find(c => cname(c) === 'Indomitable Ancients'); moveCard(w.id, 'lib', {quiet:true}); __place('Typhoid Rats', {p:1, t:1}); }); await sync();
      r = await adv(B, 'hard', {point:'block'});
      H.check(r.move && r.move.blocks.some(b => b.name === 'Typhoid Rats'), `scen Hard: blocks the 6/6 with a deathtouch 1/1 (kills it) [${show(r)}]`);
      await A.evaluate(() => { S.bf.forEach(c => { c.atk = ''; }); commit(); });
    });
    await step('scen first strike', 60000, async () => {
      await reset();
      await A.evaluate(() => { __place('Indomitable Ancients', {p:3, t:2, kw:['first strike']}); });
      await B.evaluate(() => { __place('Memnite', {p:3, t:3}); });
      await sync();
      const r = await adv(A, 'hard', {point:'attack'});
      H.check(r.move && r.move.attacks.length === 1, `scen Hard: a 3/2 first striker attacks into an untapped 3/3 (it kills the blocker before it strikes back) → ${JSON.stringify(r.move.attacks.map(a => a.name))} [${show(r)}]`);
    });
    // --- sequencing: cantrip before the land drop only when the land choice depends on it
    await step('scen sequencing', 60000, async () => {
      await reset();
      await A.evaluate(() => { __place('Island'); __hand('Opt'); __hand('Island'); __hand('Evolving Wilds'); S.landT = ['', 0]; commit(); });
      let r = await adv(A, 'hard', {point:'main'});
      H.check(r.move && r.move.how === 'cast' && r.move.card.name === 'Opt' && r.reason === 'cantrip_first', `scen Hard: with Opt and two different lands in hand, casts Opt before the land drop [${r.move && r.move.how} ${r.move && r.move.card && r.move.card.name}; ${show(r)}]`);
      await A.evaluate(() => { const w = S.hand.find(c => cname(c) === 'Evolving Wilds'); moveCard(w.id, 'lib', {quiet:true}); commit(); });
      r = await adv(A, 'hard', {point:'main'});
      H.check(r.move && r.move.how === 'land' && r.reason === 'land_first', `scen Hard: with Opt and one basic in hand, plays the land first [${r.move && r.move.how} ${r.move && r.move.card && r.move.card.name}; ${show(r)}]`);
      // creatures wait for main phase 2 when they don't change this combat
      await A.evaluate(() => { const l = S.hand.find(c => cname(c) === 'Island'); moveCard(l.id, 'bf', {quiet:true}); S.landT = [turnStr(), 1]; __place('Swamp'); __place('Memnite', {p:2, t:2}); __hand('Typhoid Rats'); const o = S.hand.find(c => cname(c) === 'Opt'); moveCard(o.id, 'lib', {quiet:true}); commit(); });
      r = await adv(A, 'hard', {point:'main'});
      H.check(r.move && r.move.how !== 'cast', `scen Hard: in main phase 1 it holds a creature that doesn't matter for combat [${r.move && r.move.how}; ${show(r)}]`);
      await A.evaluate(() => { setPhase(5); commit(); });
      r = await adv(A, 'hard', {point:'main'});
      H.check(r.move && r.move.how === 'cast' && r.move.card.name === 'Typhoid Rats', `scen Hard: in main phase 2 it casts the creature [${r.move && r.move.how} ${r.move && r.move.card && r.move.card.name}; ${show(r)}]`);
      await A.evaluate(() => { setPhase(3); commit(); });
    });
    // --- holding a counterspell for a real threat
    await step('scen counterspell', 60000, async () => {
      await reset();
      await B.evaluate(() => { __place('Island'); __place('Island'); __hand('Counterspell'); });
      const push = n => A.evaluate(n => { const a = [...DICT.values()].find(x => x.n === n); S.stk.push({sid:rid(6), o:nextO(), kind:'spell', k:a.k, nm:a.n, txt:a.o, mv:a.mv || 0, ty:a.t, tgt:null, hold:true}); commit(); }, n);
      await push('Llanowar Elves'); await sync();
      let r = await adv(B, 'hard', {point:'respond'});
      H.check(r.move && r.move.how === 'pass', `scen Hard: does not counter Llanowar Elves [${show(r)}]`);
      await A.evaluate(() => { S.stk = []; commit(); }); await push('Craterhoof Behemoth'); await sync();
      r = await adv(B, 'hard', {point:'respond'});
      H.check(r.move && r.move.how === 'cast' && r.move.card.name === 'Counterspell' && r.reason === 'counter_threat', `scen Hard: counters Craterhoof Behemoth [${show(r)}]`);
      // combo: Dramatic Reversal with Isochron Scepter on the caster's battlefield
      await A.evaluate(() => { S.stk = []; __place('Isochron Scepter'); commit(); }); await push('Dramatic Reversal'); await sync();
      r = await adv(B, 'veryhard', {point:'respond'});
      H.check(r.move && r.move.how === 'cast' && r.reason === 'combo_stop', `scen Very hard: counters Dramatic Reversal when Isochron Scepter is out (known combo) [${show(r)}]`);
      const rh = await adv(B, 'hard', {point:'respond'});
      console.log(`  (info) Hard on the same stack: ${rh.move && rh.move.how} [${show(rh)}]`);
      await A.evaluate(() => { S.stk = []; commit(); });
      // main phase: keep UU up instead of tapping out for a small creature
      await B.evaluate(() => { __hand('Llanowar Elves'); });
      await A.evaluate(() => { __hand('Opt'); __hand('Murder'); }); await sync();
      // (it's Ana's turn: ask Ben's advice as if it were his main phase)
      r = await B.evaluate(() => { const pn = phaseNow; phaseNow = () => ({...pn(), mine:true, pid:MYPID, ph:5}); try { return botAdvise('hard', {point:'main'}); } finally { phaseNow = pn; } });
      H.check(r.move && r.move.how !== 'cast', `scen Hard: holds Counterspell mana instead of casting Llanowar Elves with its last lands (opponent has cards) [${r.move && r.move.how} ${r.move && r.move.card && r.move.card.name}; ${show(r)}]`);
    });
    // --- scry
    await step('scen scry', 30000, async () => {
      await reset();
      const r = await A.evaluate(() => { for (let i = 0; i < 6; i++) __place(i % 2 ? 'Island' : 'Forest'); const ids = S.lib.slice(0, 2).map(c => c.id); return {adv:botAdvise('hard', {point:'zone', m:{type:'zone', ids, dests:['lib', 'libb']}}), names:ids.map(id => cname(find(id)[2]))}; });
      H.check(r.adv.move && Array.isArray(r.adv.move.moves) && r.adv.move.moves.length === 2, `scen Hard: scry 2 sends every card somewhere (${r.names.join(', ')} → ${r.adv.move && r.adv.move.moves.map(x => x.to).join(', ')})`);
    });
    // --- advice is side-effect free and fast
    await step('scen advice purity', 30000, async () => {
      const r = await A.evaluate(() => { const before = JSON.stringify({bf:S.bf.map(c => [c.id, c.tap]), hand:S.hand.length, pool:S.pool, stk:S.stk.length}); const t0 = performance.now(); const out = botAdviseLevels().map(l => botAdvise(l)); const ms = performance.now() - t0;
        return {same:before === JSON.stringify({bf:S.bf.map(c => [c.id, c.tap]), hand:S.hand.length, pool:S.pool, stk:S.stk.length}), ms, out:out.map(o => o.level + ':' + o.point + ':' + o.reason)}; });
      H.check(r.same, `botAdvise changes nothing on the page (${r.out.join(' | ')})`);
      H.check(r.ms < 3000, `botAdvise for every level takes ${Math.round(r.ms)} ms`);
    });
  } finally { await A.context().close(); await B.context().close(); }

  // ---------- three players: Very hard's multiplayer judgement
  const code3 = 'rb3-' + (Date.now() % 100000);
  const P = await H.player(browser, 'Pia', scenDeck('Krenko, Mob Boss'), 'host', code3);
  const Q = await H.player(browser, 'Quin', scenDeck('Thalia, Guardian of Thraben'), 'join', code3);
  const R = await H.player(browser, 'Ray', scenDeck('Krenko, Mob Boss'), 'join', code3);
  try {
    for (const p of [P, Q, R]) await p.evaluate(PLACE);
    H.check(await H.waitFor(P, () => OPP.size === 2, null, 20000) && await H.waitFor(Q, () => OPP.size === 2, null, 20000), 'scen3: three players seated');
    await P.click('[data-act="goFirst"]'); await H.sleep(800);
    await step('scen3 leader', 60000, async () => {
      // Pia is the leader: big board, full hand, combo pieces out. Ray has the same creature but nothing else.
      await P.evaluate(() => { __place('Gigantosaurus', {p:5, t:5}); __place('Kiki-Jiki, Mirror Breaker'); __place('Isochron Scepter'); __place('Llanowar Elves'); __place('Elvish Mystic'); for (const n of ['Forest', 'Forest', 'Forest', 'Island', 'Island']) __place(n); ['Opt', 'Murder', 'Giant Growth', 'Lightning Bolt', 'Counterspell'].forEach(__hand); });
      await R.evaluate(() => { __place('Gigantosaurus', {p:5, t:5}); });
      await Q.evaluate(() => { __place('Swamp'); __place('Swamp'); __hand('Murder'); __place('Quakestrider Ceratops', {p:4, t:4, kw:['flying']}); });
      await H.sleep(1500);
      const r = await Q.evaluate(() => { const cands = []; for (const [pid, o] of OPP) (o.bf || []).forEach(c => { if (c.k && /Gigantosaurus/.test(info(c.k).n)) cands.push({t:'card', pid, id:c.id, k:c.k, nm:info(c.k).n + ' (' + o.nm + ')', ok:true}); });
        const m = {type:'target', title:'Murder', spec:{n:1, desc:'creature'}, cands};
        const pick = l => { const a = botAdvise(l, {point:'target', m}); return {lv:l, who:(cands[a.move.indices[0]] || {}).nm, reason:a.reason}; };
        return {vh:pick('veryhard'), h:pick('hard'), att:botAdvise('veryhard', {point:'attack'})}; });
      H.check(/Pia/.test(r.vh.who || ''), `scen3 Very hard: Murder targets the leader's creature, not the same creature of a player with nothing else (${r.vh.who}; Hard: ${r.h.who})`);
      H.check(r.att.move && r.att.move.attacks.length && r.att.move.attacks.every(a => a.atName === 'Pia' || a.at === undefined), `scen3 Very hard: attacks the leader (${JSON.stringify(r.att.move && r.att.move.attacks)}) [${r.att.reason}]`);
    });
  } finally { for (const p of [P, Q, R]) await p.context().close(); }
}

/* ---------------------------------------------------------------- 3. smoke: a scripted human vs Hard / Very hard, then a pod */
async function runTurns(page, turns, maxS){
  const t0 = Date.now(); let last = 0, lastT = Date.now(), status = '';
  while (true){
    await H.sleep(2000);
    const x = await page.evaluate(() => ({turn:currentTurn()[0], lost:!!(S.lost || S.j18out), opps:[...OPP.values()].map(o => !!o.b27lost)})).catch(() => ({turn:0}));
    if (x.turn !== last){ last = x.turn; lastT = Date.now(); process.stdout.write(` t${last}`); }
    if (last >= turns){ status = 'done'; break; }
    if (x.lost || (x.opps && x.opps.length && x.opps.every(Boolean))){ status = 'game over'; break; }
    if (Date.now() - lastT > 120000){ status = 'stalled'; break; }
    if (Date.now() - t0 > maxS * 1000){ status = 'time limit'; break; }
  }
  process.stdout.write('\n'); return {turn:last, status};
}
async function collect(page){
  const out = {viol:[], cerr:[], bot:[]};
  for (const c of [page, ...botFrames(page)]){
    const d = await c.evaluate(() => ({nm:S && S.nm, viol:window.__FZ ? __FZ.viol : [], cerr:window.__FZ ? Object.values(__FZ.cerr) : [],
      bot:typeof BOT !== 'undefined' && BOT.cfg ? {nm:S.nm, level:BOT.cfg.level, tally:BOT.tally, errs:BOT.errs.slice(0, 5), peeks:BOT.peeks.slice(0, 5), n:BOT.n, acts:BOT.acts.slice(-30)} : null})).catch(e => ({err:e.message}));
    if (d.err) continue;
    d.viol.forEach(v => out.viol.push({who:d.nm, ...v})); d.cerr.forEach(e => out.cerr.push({who:d.nm, ...e})); if (d.bot) out.bot.push(d.bot);
  }
  return out;
}
function judge(tag, page, c, res){
  const conserv = c.viol.filter(v => v.kind === 'conservation'); const stuck = c.viol.filter(v => v.kind === 'stuck');
  const uncaught = c.cerr.filter(e => e.kind === 'uncaught' || e.kind === 'rejection');
  H.check(page.__errs.length === 0 && uncaught.length === 0, `${tag}: 0 page errors (${page.__errs.length} + ${uncaught.length} in frames${uncaught[0] ? ': ' + uncaught[0].msg : ''})`);
  H.check(conserv.length === 0, `${tag}: 0 card-conservation violations${conserv[0] ? ' — ' + conserv[0].msg : ''}`);
  H.check(stuck.length === 0 && res.status !== 'stalled', `${tag}: no stalls (${res.status}${stuck[0] ? ', ' + stuck[0].msg : ''})`);
  const be = c.bot.flatMap(b => b.errs.map(e => b.nm + ': ' + e));
  H.check(be.length === 0, `${tag}: bots made no internal errors${be[0] ? ' — ' + be[0].slice(0, 200) : ''}`);
  H.check(c.bot.every(b => !b.peeks.length), `${tag}: no bot looked outside its own seat (runtime trap)`);
}
async function smoke(browser){
  for (const [lv, seed] of [['hard', 51], ['veryhard', 61]]){
    console.log(`\n== smoke 1v1: scripted human vs ${LBL[lv]}`);
    const p2 = await newPage(browser);
    const ids2 = await step('decks', 120000, async () => ({human:await loadSave(p2, 'Elminster', realDeck('elminster')), bot:await loadSave(p2, 'Edgar', realDeck('edgar'))}));
    if (!ids2){ await p2.context().close(); continue; }
    await p2.evaluate(id => ACT.loadSaved({dataset:{id}}), ids2.human);
    await p2.fill('#nameIn', 'Georges');
    await p2.evaluate(([lv, id, sd]) => botsStartGame([{level:lv, deck:'saved:' + id, name:'Bot ' + lv, speed:0.15}], {seed:sd}), [lv, ids2.bot, seed]);
    const seated = await H.waitFor(p2, () => BOTHOST.bots.length === 1 && BOTHOST.bots[0].st.kept && OPP.size === 1, null, 60000);
    H.check(seated, `smoke ${LBL[lv]}: the bot sat down and kept a hand`);
    H.check(await p2.evaluate(() => BOTHOST.bots[0] && BOTHOST.bots[0].cfg.level) === lv, `smoke ${LBL[lv]}: the bot runs the ${LBL[lv]} level`);
    await injectCheckers(p2, seed, true);
    await p2.click('[data-act="goFirst"]');
    const res = await runTurns(p2, 10, 600);
    const c = await collect(p2); const b = c.bot[0] || {tally:{}};
    H.check(res.turn >= 9 || res.status === 'game over', `smoke ${LBL[lv]}: ran ${res.turn} turns (${res.status})`);
    console.log('  bot tally: ' + JSON.stringify(b.tally));
    H.check((b.tally.land || 0) > 0 && (b.tally.cast || 0) > 0, `smoke ${LBL[lv]}: played lands (${b.tally.land}) and cast spells (${b.tally.cast})`);
    // a prompt on the bot's screen gets an answer
    const fr = botFrames(p2)[0]; const bpid = await fr.evaluate(() => MYPID);
    await p2.evaluate(() => { if (window.__FZ) __FZ.on = false; });
    const t0 = Date.now(); const paid = await step('rhystic', 70000, () => p2.evaluate(pid => askOpponentPay(pid, '{1}', 'Rhystic Study'), bpid));
    H.check(paid !== null && Date.now() - t0 < 20000, `smoke ${LBL[lv]}: answered "pay {1}?" on its own screen in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    judge('smoke ' + LBL[lv], p2, c, res);
    if (process.env.DUMP) console.log(b.acts.join('\n'));
    await p2.context().close();
  }
  console.log('\n== smoke pod: scripted human + Very hard + Hard + Intermediate');
  const page = await newPage(browser);
  const ids = await step('decks', 180000, async () => ({edgar:await loadSave(page, 'Edgar', realDeck('edgar')), elm:await loadSave(page, 'Elminster', realDeck('elminster')), gaa:await loadSave(page, 'GAA', realDeck('gaa')), bf:await loadSave(page, 'Blue Farm', realDeck('bluefarm'))}));
  if (!ids){ await page.context().close(); return; }
  await page.evaluate(id => ACT.loadSaved({dataset:{id}}), ids.edgar); await page.fill('#nameIn', 'Georges');
  await page.evaluate(i => botsStartGame([{level:'veryhard', deck:'saved:' + i.elm, name:'VeryHard', speed:0.1}, {level:'hard', deck:'saved:' + i.gaa, name:'Hard', speed:0.1}, {level:'intermediate', deck:'saved:' + i.bf, name:'Inter', speed:0.1}]), ids);
  H.check(await H.waitFor(page, () => BOTHOST.bots.length === 3 && BOTHOST.bots.every(b => b.st.kept && b.st.pid) && OPP.size >= 3, null, 90000), 'smoke pod: three bots sat down');
  await injectCheckers(page, 71, true);
  await page.click('[data-act="goFirst"]');
  const res = await runTurns(page, 14, 900);
  const c = await collect(page);
  H.check(res.turn >= 8 || res.status === 'game over', `smoke pod: ran ${res.turn} turns (${res.status})`);
  c.bot.forEach(b => H.check(b.n > 15, `smoke pod: ${b.nm} (${b.level}) took part (${b.n} actions)`));
  judge('smoke pod', page, c, res);
  await page.context().close();
}

/* ---------------------------------------------------------------- 4. strength: seeded bot-only games */
async function match(browser, seatsFn, games, tag, opts = {}){
  const par = +(process.env.PAR || 2), fmt = opts.fmt || process.env.FMT || 'duel', cap = opts.cap || +(process.env.CAP || 40);
  const DECKS = (opts.decks || process.env.SDECKS || 'elminster,gaa,bluefarm,edgar').split(',');
  const OFF = +(process.env.GOFF || 0);
  console.log(`\n== strength: ${tag}, ${games} games (${fmt}), same deck for every seat, seeded${opts.pairs ? ', each seed played twice with the seats swapped (same libraries, so draw luck cancels)' : ''}, think delay 0, ${par} at a time`);
  const wins = {}; const TALLY = {}; let done = 0, draws = 0; const T0 = Date.now(); const turnsA = [];
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
      await page.evaluate(([s, seed, f]) => botsStartGame(s.map(x => ({...x, deck:'mine', speed:0})), {watch:true, seed, fmt:f, first:0}), [seats, seed, fmt]);
      if (process.env.DUMP){ await H.sleep(4000); for (const f of botFrames(page)) await f.evaluate(() => { BOT.acts.shift = () => {}; }).catch(() => {}); }
      let winner = null, turn = 0, why = '', lastMove = Date.now(), stalled = false;
      const deadline = Date.now() + (opts.maxMs || 900000);
      while (Date.now() < deadline){
        await H.sleep(1500);
        const st = await page.evaluate(() => BOTHOST.bots.map(b => ({nm:b.cfg.name, lv:b.cfg.level, lost:b.st.lost, turn:b.st.turn || 0, life:b.st.life})));
        const t2 = Math.max(...st.map(x => x.turn)); if (t2 !== turn){ turn = t2; lastMove = Date.now(); }
        if (Date.now() - lastMove > 180000){ why = 'STALLED'; stalled = true;
          for (const f of botFrames(page)){ const d = await f.evaluate(() => ({nm:S.nm, pid:MYPID.slice(0, 4), res:!!UI.resolving, cast:!!UI.casting, busy:BOT.busy, mystk:S.stk.length, top:S.stk.length ? {hold:!!S.stk[S.stk.length - 1].hold, nm:S.stk[S.stk.length - 1].nm, w:waitingOn(prioKey()).map(p => p.pid.slice(0, 4))} : null, lv:BOT.cfg.level, acts:BOT.acts.slice(-6), modal:UI.modal ? UI.modal.type + ':' + (UI.modal.title || '') : '', prm:S.prm.map(p => p.type), box:!!myBox(), ph:phaseNow(), stk:stackAll().length, cb:(cbOf(phaseNow()) || {}).step, lost:!!(S.lost || S.j18out), key:prioKey(), pass:S.pass, op:[...OPP].map(([p, o]) => [p.slice(0, 4), o.pass, o.v, isLive(p), (o.stk || []).length]), bad:NET.sanBad || [], resv:UI.f23it ? [UI.f23it.sid, UI.f23it.nm, UI.f23it.txt, Date.now() - UI.f23it.at] : null, waits:[...(UI.f23w || new Map()).values()].map(w => [Date.now() - w.at, w.st]), dry:!!UI.dry, my:S.stk.slice(-4).map(i => [i.sid, i.o, i.nm, i.kind, i.op || '', i.hold ? 'H' : '', i.m19wait ? 'W' : '', short(i.txt || '', 70)]), all:stackAll().slice(-5).map(i => [i.sid, i.o, i.pid.slice(0, 4), i.nm]), seen:[...NET.seen].map(([p, v]) => [p.slice(0, 4), v.sv, Date.now() - v.at])})).catch(e => ({err:e.message})); console.log('    STALL ' + JSON.stringify(d).slice(0, 3000)); }
          break; }
        const alive = st.filter(x => !x.lost);
        if (alive.length === 1){ winner = alive[0]; why = st.filter(x => x.lost).map(x => x.nm + ' ' + x.life).join(', '); break; }
        if (st.length === 2 && st.some(x => x.lost)){ winner = alive[0] || null; break; }
        if (turn > cap){ why = 'turn cap, life ' + st.map(x => x.nm + ' ' + x.life).join(' / '); break; }
      }
      if (process.env.DUMP) for (const f of botFrames(page)){ const d = await f.evaluate(() => ({lv:BOT.cfg.level, acts:BOT.acts, log:S.log.map(e => e.s)})).catch(() => null); if (d) fs.writeFileSync(`/tmp/dump_${seed}_g${i}_${d.lv}.txt`, d.acts.join('\n') + '\n\n---- log\n' + d.log.join('\n')); }
      for (const f of botFrames(page)){ const d = await f.evaluate(() => ({lv:BOT.cfg.level, T:BOT.tally})).catch(() => null); if (!d) continue; const t = TALLY[d.lv] = TALLY[d.lv] || {}; for (const k in d.T) t[k] = (t[k] || 0) + d.T[k]; }
      const errs = await page.evaluate(() => BOTHOST.bots.reduce((s, b) => s + (b.st.errs || 0), 0));
      const peeks = await page.evaluate(() => BOTHOST.bots.reduce((s, b) => s + (b.st.peeks || 0), 0));
      if (winner){ wins[winner.lv] = (wins[winner.lv] || 0) + 1; turnsA.push(turn); } else draws++;
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
  return {wins, done, draws};
}
async function strength(browser, which){
  const G = +(process.env.GAMES || 20);
  if (which === 'x'){ const [a, b] = process.env.XL.split(','); LBL[a] = LBL[a] || a; LBL[b] = LBL[b] || b;
    const r = await match(browser, i => i % 2 === 0 ? [{level:a, name:'A'}, {level:b, name:'B'}] : [{level:b, name:'B'}, {level:a, name:'A'}], G, a + ' vs ' + b, {seed0:+(process.env.XSEED || 3000), pairs:true}); }
  if (which === 'h1v1'){
    const r = await match(browser, i => i % 2 === 0 ? [{level:'hard', name:'Hard'}, {level:'intermediate', name:'Inter'}] : [{level:'intermediate', name:'Inter'}, {level:'hard', name:'Hard'}], G, 'Hard vs Intermediate', {seed0:3000, pairs:true});
    const w = r.wins.hard || 0; H.check(r.done >= Math.min(20, G) && w / r.done >= 0.65, `strength: Hard beats Intermediate in >= 65% of ${r.done} games (${w}/${r.done} = ${(100 * w / r.done).toFixed(0)}%)`);
  }
  if (which === 'vh1v1'){
    const r = await match(browser, i => i % 2 === 0 ? [{level:'veryhard', name:'VeryHard'}, {level:'hard', name:'Hard'}] : [{level:'hard', name:'Hard'}, {level:'veryhard', name:'VeryHard'}], G, 'Very hard vs Hard', {seed0:4000, pairs:true});
    const w = r.wins.veryhard || 0; H.check(r.done >= Math.min(20, G) && w / r.done >= 0.6, `strength: Very hard beats Hard in >= 60% of ${r.done} games (${w}/${r.done} = ${(100 * w / r.done).toFixed(0)}%)`);
  }
  if (which === 'pod'){
    const PG = +(process.env.PGAMES || 12);
    const lv = ['veryhard', 'hard', 'intermediate', 'easy'];
    const r = await match(browser, i => lv.map((_, j) => lv[(j + i) % 4]).map(l => ({level:l, name:LBL[l].replace(' ', '')})), PG, '4-pod Very hard / Hard / Intermediate / Easy', {fmt:'cmd', cap:+(process.env.PCAP || 160), seed0:5000, maxMs:1500000, rot:4, decks:process.env.PDECKS || 'random,edgar,random,gaa'});
    const w = r.wins.veryhard || 0; H.check(r.done >= Math.min(12, PG) && w / r.done >= 0.35, `strength: Very hard wins >= 35% of ${r.done} 4-pod games (${w}/${r.done} = ${(100 * w / r.done).toFixed(0)}%; Hard ${r.wins.hard || 0}, Intermediate ${r.wins.intermediate || 0}, Easy ${r.wins.easy || 0})`);
  }
}

(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch({headless:!process.env.HEADFUL});
  try {
    if (ONLY.includes('hidden')) await hidden(browser);
    if (ONLY.includes('scen')) await scen(browser);
    if (ONLY.includes('smoke')) await smoke(browser);
    for (const w of ['x', 'h1v1', 'vh1v1', 'pod']) if (ONLY.includes(w)) await strength(browser, w);
  } catch (e){ H.check(false, 'harness: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close();
  console.log(`\n${H.results.filter(r => r.startsWith('PASS')).length} passed, ${H.fails()} failed`);
  process.exit(H.fails() ? 1 : 0);
})();
