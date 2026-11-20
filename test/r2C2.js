process.env.TOP = '1';
// Round 26 helper C2: long-tail cards (ranks 5081–6999) played in a real 2-player game (Georges vs Kim)
const CC = require('./cards');
const WANT = ["Krark's Thumb", 'Telepathy', 'Lantern of Insight', 'Enhanced Surveillance', 'Strong, the Brutish Thespian', 'The Wandering Emperor', 'Pramikon, Sky Rampart', 'Teyo, Geometric Tactician',
  'The Ancient One', 'Gornog, the Red Reaper', 'Omo, Queen of Vesuva', 'Lake of the Dead', 'Naban, Dean of Iteration', 'Emry, Lurker of the Loch', 'Sanctum of All', 'Honden of Seeing Winds',
  'Kira, Great Glass-Spinner', 'The Master, Transcendent', 'The Pride of Hull Clade', 'Blitzball Stadium', 'Radiant Lotus', 'Sewer Nemesis', 'Requiem Monolith', 'Tranquil Frillback',
  'Golden Argosy', 'Vronos, Masked Inquisitor', 'Willbreaker', 'Comet, Stellar Pup', 'Out of Time', 'Feather, the Redeemed', "Don't Make a Sound", 'Benevolent Blessing', 'Conspiracy', 'Lifecraft Engine',
  'Narset of the Ancient Way', 'Botanical Brawler', 'Mighty Servant of Leuk-o',
  'Grizzly Bears', 'Llanowar Elves', 'Giant Growth', 'Lightning Bolt', 'Mind Stone', 'Darksteel Ingot', 'Wall of Omens'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, put, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { window.__want = window.__want || null; window.__tgt = window.__tgt || null; window.__num = null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ const re = window.__tgt ? new RegExp(window.__tgt, 'i') : null; const c = re ? (m.cands || []).find(x => x.ok && re.test(x.nm)) : (m.cands || []).find(x => x.ok); if (!c && re) return; m.__done = 1; m.resolve(c ? [c] : []); closeModal(); }
    else if (m.run){ m.__done = 1; const d = window.__num != null ? window.__num : (m.def ?? 1); m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const toZone = (p, n, z) => p.evaluate(([n, z]) => { for (const y of ['lib', 'hand', 'gy', 'ex', 'bf']){ const i = S[y].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[y].splice(i, 1); reset(c); S[z].push(c); commit(); return c.id; } } return null; }, [n, z]);
const cast = (p, n, pool) => p.evaluate(async ([n, pool]) => { const c = S.hand.find(x => cname(x) === n); if (!c) return 'not in hand'; S.pool = {...emptyPool(), ...(pool || {W:6, U:6, B:6, R:6, G:6, C:6})}; commit(); await beginCast(c, 'hand'); return S.hand.includes(c) ? 'not cast' : 'ok'; }, [n, pool]);
const putAny = (p, n) => p.evaluate(n => { for (const z of ['lib', 'hand', 'gy', 'ex']){ const c = S[z].find(c => cname(c) === n); if (c){ moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id); if (b){ b.sk = false; b.tap = false; } commit(); return true; } } return S.bf.some(c => cname(c) === n); }, n);
const toGy = (p, n) => p.evaluate(n => { let k = 0; for (const c of S.bf.filter(x => cname(x) === n)){ moveCard(c.id, 'gy', {quiet:true}); k++; } commit(); return k > 0; }, n);
const activate = (p, n, re) => p.evaluate(async ([n, re]) => { const c = S.bf.find(x => cname(x) === n); if (!c) return 'missing'; c.sk = false; c.tap = false; S.pool = {...emptyPool(), W:6, U:6, B:6, R:6, G:6, C:6}; const ab = abilityList(c).find(a => new RegExp(re, 'i').test(a.eff)); if (!ab) return 'no ability'; await activateAbility(c, ab); return 'ok'; }, [n, re]);
const run = (p, txt, nm, extra) => p.evaluate(async ([txt, nm, extra]) => { const k = [...DICT.values()].find(a => a.n === nm)?.k || null; const src = S.bf.find(c => c.k === k) || S.gy.find(c => c.k === k); const ctx = {k, name:nm, full:txt, srcId:src ? src.id : null, ...(extra || {})}; if (ctx.tgtKim){ const [pid] = [...OPP.keys()]; ctx.tgts = [[{t:'player', pid, nm:nameOf(pid)}]]; } if (ctx.itX != null) ctx.it = {kind:'ability', x:ctx.itX}; await runEffects(txt, ctx); commit(); return 'ok'; }, [txt, nm, extra]);
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !new RegExp(process.env.ONLY).test(name)) return; console.log('— ' + name); const f0 = H.fails(); if (PA) for (const p of [PA, PB]) await p.evaluate(() => { window.__tgt = null; window.__want = null; window.__num = null; if (UI.modal && UI.modal.resolve && !UI.modal.__done){ try { UI.modal.__done = 1; UI.modal.resolve(UI.modal.type === 'target' || UI.modal.type === 'pick' ? [] : null); closeModal(); } catch {} } }); try { await T(60000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2c2');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2c2');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const life = p => p.evaluate(() => S.life);
  const cnt = (p, re) => p.evaluate(re => S.bf.filter(c => new RegExp(re).test(cname(c))).reduce((a, c) => a + (c.n || 1), 0), re);
  const after = async () => { await sleep(500); await settle([A, B]); await sleep(1200); await settle([A, B]); await sleep(500); };
  const lt = p => p.evaluate(() => { window.__lt = []; const o = lookTopAwait; window.__ltO = o; lookTopAwait = (n, ...a) => { window.__lt.push(n); return Promise.resolve(); }; });
  const ltOff = p => p.evaluate(() => { if (window.__ltO) lookTopAwait = window.__ltO; return window.__lt; });
  try {
    await step("Krark's Thumb: a coin flip is two flips, keeping the better one", async () => {
      await put(A, "Krark's Thumb"); await after();
      const r = await A.evaluate(async () => { const R = Math.random; const seq = [0.9, 0.1]; let i = 0; Math.random = () => seq[i++ % 2]; const ctx = {k:null, name:'Test', full:'Flip a coin.'}; try { await runEffects('Flip a coin.', ctx); } finally { Math.random = R; } return ctx.coin; });
      check(r === 'heads', `with the Thumb, rolls 0.9 and 0.1 keep the win (got ${r})`);
      await toGy(A, "Krark's Thumb");
      const r2 = await A.evaluate(async () => { const R = Math.random; Math.random = () => 0.9; const ctx = {k:null, name:'Test', full:'Flip a coin.'}; try { await runEffects('Flip a coin.', ctx); } finally { Math.random = R; } return ctx.coin; });
      check(r2 === 'tails', `without the Thumb a 0.9 roll loses (got ${r2})`);
    });
    await step('Telepathy reveals Kim\'s hand; Lantern of Insight reveals the top of each library', async () => {
      await put(A, 'Telepathy'); await put(A, 'Lantern of Insight'); await after(); await sleep(2000);
      const hr = await A.evaluate(() => { const o = [...OPP.values()][0]; return Array.isArray(o.hr) ? o.hr.length : -1; }); const hc = await B.evaluate(() => S.hand.length);
      check(hr === hc && hc > 0, `Georges sees Kim's revealed hand (${hr} of ${hc} cards)`);
      check(await A.evaluate(() => !S.rh), "Georges's own hand stays hidden");
      check(await B.evaluate(() => S.log.some(e => /top card of library \(revealed\)/.test(e.s))) && await A.evaluate(() => S.log.some(e => /top card of library \(revealed\)/.test(e.s))), 'both players log their revealed top card');
      await toGy(A, 'Telepathy'); await toGy(A, 'Lantern of Insight'); await sleep(2000);
      check(await A.evaluate(() => { const o = [...OPP.values()][0]; return !Array.isArray(o.hr); }), "after Telepathy leaves, Kim's hand is hidden again");
    });
    await step('Enhanced Surveillance: surveil 1 looks at three cards', async () => {
      await put(A, 'Enhanced Surveillance'); await after(); await lt(A);
      await run(A, 'Surveil 1.', 'Test'); const got = await ltOff(A);
      check(JSON.stringify(got) === '[3]', `surveil 1 looked at ${JSON.stringify(got)} cards`); await toGy(A, 'Enhanced Surveillance');
    });
    await step('Strong: rad counters gain life instead of losing it', async () => {
      await put(A, 'Strong, the Brutish Thespian'); await after();
      const r = await A.evaluate(() => { const l0 = S.life; const nl = S.lib.filter(c => !isLand(c.k)).slice(0, 3); nl.forEach(c => { S.lib.splice(S.lib.indexOf(c), 1); S.lib.unshift(c); }); addPC('rad', 3); fireSteps('main1', MYPID); commit(); return [l0, S.life, (S.pc || {}).rad || 0]; });
      check(r[1] === r[0] + 3 && r[2] === 0, `life ${r[0]} → ${r[1]} (rad left ${r[2]})`); await toGy(A, 'Strong, the Brutish Thespian');
    });
    await step('The Wandering Emperor: loyalty abilities at instant speed the turn she entered', async () => {
      await put(A, 'The Wandering Emperor'); await after();
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'The Wandering Emperor'); c.co = 3; const ab = loyaltyAbs(c)[1]; const pn = phaseNow; phaseNow = () => ({...pn(), mine:false}); let a, b; try { a = loyaltyReady(c, ab); c.et = 'old'; b = loyaltyReady(c, ab); } finally { phaseNow = pn; c.et = turnStr(); } return [a, b]; });
      check(r[0] === '' && /Only/.test(r[1]), `entered this turn: ready off-turn ("${r[0]}"); otherwise: "${r[1]}"`); await toGy(A, 'The Wandering Emperor');
    });
    await step('Pramikon / Teyo: attacks only go to the nearest opponent in the chosen direction', async () => {
      await A.evaluate(() => { window.__want = 'Right'; }); await put(A, 'Pramikon, Sky Rampart'); await after(); await sleep(1200); await A.evaluate(() => { window.__want = null; });
      const d = await A.evaluate(() => S.bf.find(x => cname(x) === 'Pramikon, Sky Rampart')?.c2dir); check(d === 'right', `Pramikon chose ${d}`);
      check(await B.evaluate(() => { const o = [...OPP.values()][0]; return (o.bf || []).some(c => c.c2dir === 'right'); }), 'Kim sees the chosen direction');
      check(await B.evaluate(() => defOpts().some(o => o.pid && o.pid !== MYPID)), 'with two players Kim may still attack Georges (the nearest opponent)');
      await toGy(A, 'Pramikon, Sky Rampart');
      await put(A, 'Teyo, Geometric Tactician'); await after(); await A.evaluate(() => { window.__want = 'Left'; });
      await run(A, 'Choose left or right. Until your next turn, each player may attack only the nearest opponent in the last chosen direction and planeswalkers controlled by that opponent.', 'Teyo, Geometric Tactician'); await after(); await sleep(1200);
      await A.evaluate(() => { window.__want = null; });
      check(await B.evaluate(() => { const o = [...OPP.values()][0]; return o.c2teyo && o.c2teyo.dir === 'left'; }), "Kim's client sees Teyo's restriction (left)");
      await toGy(A, 'Teyo, Geometric Tactician');
    });
    await step('The Ancient One: descend 8, and the discard mills Kim by its mana value', async () => {
      await put(A, 'The Ancient One'); await after();
      const r0 = await A.evaluate(() => { const keep = S.gy.splice(0); const c = S.bf.find(x => cname(x) === 'The Ancient One'); c.sk = false; const r = canAttack(c); S.gy.push(...keep); return r; });
      check(/descend 8/.test(r0), `can't attack with an empty graveyard ("${r0}")`);
      const r1 = await A.evaluate(() => { const keep = S.gy.splice(0); const land = S.lib.filter(c => isLand(c.k)).slice(0, 8); land.forEach(c => { S.lib.splice(S.lib.indexOf(c), 1); S.gy.push(c); }); const c = S.bf.find(x => cname(x) === 'The Ancient One'); const r = canAttack(c); land.forEach(c => { S.gy.splice(S.gy.indexOf(c), 1); S.lib.push(c); }); S.gy.push(...keep); return r; });
      check(r1 === '', `with eight permanent cards in the graveyard it can attack ("${r1}")`);
      await toZone(A, 'Grizzly Bears', 'hand'); await A.evaluate(() => { window.__want = 'Grizzly'; window.__tgt = 'Kim'; }); const l0 = await B.evaluate(() => S.lib.length);
      check(await activate(A, 'The Ancient One', 'Draw a card') === 'ok', 'activated The Ancient One'); await after(); await A.evaluate(() => { window.__want = null; window.__tgt = null; });
      const l1 = await B.evaluate(() => S.lib.length); check(l0 - l1 === 2, `discarded Grizzly Bears (MV 2): Kim milled ${l0 - l1}`);
      await toGy(A, 'The Ancient One');
    });
    await step('Gornog: attacking Warriors get +X/+0 for each Coward an opponent controls', async () => {
      await put(A, 'Gornog, the Red Reaper'); await put(B, 'Grizzly Bears'); await after();
      await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); l24addMod(c, {s:'test', u:'', addS:['Coward']}); commit(); }); await sleep(1500);
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Gornog, the Red Reaper'); const p0 = stats(c)[0]; c.atk = (defOpts()[0] || {}).key; const p1 = stats(c)[0]; c.atk = ''; return [p0, p1]; });
      check(r[1] === r[0] + 1, `Gornog's power ${r[0]} → ${r[1]} while attacking`); await toGy(A, 'Gornog, the Red Reaper'); await toGy(B, 'Grizzly Bears');
    });
    await step('Omo: a land with an everything counter is every land type; a creature is every creature type', async () => {
      await put(A, 'Mountain'); await put(A, 'Omo, Queen of Vesuva'); await put(A, 'Llanowar Elves'); await after();
      const r = await A.evaluate(() => { const land = S.bf.find(c => isLand(c.k)); const cr = S.bf.find(c => cname(c) === 'Llanowar Elves'); addNamed(land, 'everything', 1); addNamed(cr, 'everything', 1); l24bust(); return [typeOf(land), descOk(cr.k, 'zombie', {card:cr})]; });
      check(/Island/.test(r[0]) && /Forest/.test(r[0]) && /Swamp/.test(r[0]), `land type line: ${r[0]}`); check(r[1], 'Llanowar Elves counts as a Zombie');
      await toGy(A, 'Omo, Queen of Vesuva'); await toGy(A, 'Llanowar Elves');
    });
    await step('Lake of the Dead: sacrifice a Swamp or it goes to the graveyard', async () => {
      await A.evaluate(() => { S.bf.filter(c => /\bSwamp\b/.test(typeOf(c))).forEach(c => moveCard(c.id, 'gy', {quiet:true})); commit(); });
      await toZone(A, 'Lake of the Dead', 'hand'); await A.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Lake of the Dead'); moveCard(c.id, 'bf'); commit(); }); await after();
      check(await A.evaluate(() => S.gy.some(c => cname(c) === 'Lake of the Dead')), 'with no Swamp it went to the graveyard');
      await A.evaluate(() => { const s = S.lib.find(c => cname(c) === 'Swamp') || S.gy.find(c => cname(c) === 'Swamp'); moveCard(s.id, 'bf', {quiet:true}); commit(); });
      await toZone(A, 'Lake of the Dead', 'hand'); await A.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Lake of the Dead'); moveCard(c.id, 'bf'); commit(); }); await after();
      check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Lake of the Dead') && !S.bf.some(c => cname(c) === 'Swamp')), 'with a Swamp: the Swamp was sacrificed and the Lake stayed');
      await toGy(A, 'Lake of the Dead');
    });
    await step('Naban: a Wizard entering triggers twice (Emry mills eight)', async () => {
      await put(A, 'Naban, Dean of Iteration'); await toZone(A, 'Emry, Lurker of the Loch', 'hand'); await after(); const l0 = await A.evaluate(() => S.lib.length);
      await put(A, 'Emry, Lurker of the Loch'); await after(); const l1 = await A.evaluate(() => S.lib.length);
      check(l0 - l1 === 8, `Emry's enter trigger happened twice: milled ${l0 - l1}`); await toGy(A, 'Naban, Dean of Iteration'); await toGy(A, 'Emry, Lurker of the Loch');
    });
    await step('Sanctum of All puts a Shrine from the graveyard onto the battlefield', async () => {
      await put(A, 'Sanctum of All'); await toZone(A, 'Honden of Seeing Winds', 'gy'); await A.evaluate(() => { window.__want = 'Honden'; });
      await run(A, 'You may search your library and/or graveyard for a Shrine card and put it onto the battlefield. If you search your library this way, shuffle.', 'Sanctum of All'); await after(); await A.evaluate(() => { window.__want = null; });
      check(await cnt(A, 'Honden of Seeing Winds') === 1, 'Honden of Seeing Winds is on the battlefield'); await toGy(A, 'Honden of Seeing Winds'); await toGy(A, 'Sanctum of All');
    });
    await step('Kira counters the first spell that targets a creature each turn', async () => {
      await put(A, 'Kira, Great Glass-Spinner'); await put(A, 'Grizzly Bears'); await after();
      await toZone(B, 'Lightning Bolt', 'hand'); await B.evaluate(() => { window.__tgt = 'Grizzly'; }); check(await cast(B, 'Lightning Bolt') === 'ok', 'Kim casts Lightning Bolt at Grizzly Bears'); await after(); await sleep(1500); await settle([A, B]);
      check(await cnt(A, 'Grizzly Bears') === 1, 'Grizzly Bears survived (Kira countered the Bolt)');
      await toZone(B, 'Lightning Bolt', 'hand'); check(await cast(B, 'Lightning Bolt') === 'ok', 'Kim casts a second Lightning Bolt'); await after(); await sleep(1500); await settle([A, B]); await B.evaluate(() => { window.__tgt = null; });
      check(await cnt(A, 'Grizzly Bears') === 0, 'the second Bolt that turn resolves');
      await toGy(A, 'Kira, Great Glass-Spinner');
    });
    await step('The Master: a creature card Kim milled this turn comes to Georges as a green 3/3 Mutant', async () => {
      await put(A, 'The Master, Transcendent'); await after();
      await A.evaluate(() => { S.gy.filter(c => cname(c) === 'Llanowar Elves').forEach(c => moveCard(c.id, 'ex', {quiet:true})); commit(); });
      await B.evaluate(() => { for (const z of ['hand', 'gy', 'lib', 'ex']){ const i = S[z].findIndex(c => cname(c) === 'Llanowar Elves'); if (i >= 0){ const [c] = S[z].splice(i, 1); S.lib.unshift(c); break; } } mill(1); commit(); }); await after(); await sleep(1200);
      if (process.env.C2DBG) await A.evaluate(() => { const o = doRound26C2Pre; doRound26C2Pre = async (s, l, ctx) => { console.error('SENT ' + l + ' | tg=' + JSON.stringify(ctx.tgts)); return o(s, l, ctx); }; });
      await A.evaluate(() => { window.__tgt = 'Llanowar'; }); check(await activate(A, 'The Master, Transcendent', 'milled this turn') === 'ok', 'activated The Master'); await after(); await sleep(1500); await settle([A, B]); await A.evaluate(() => { window.__tgt = null; });
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Llanowar Elves'); return c ? [stats(c).join('/'), typeOf(c), (l24eff(c) || {}).col] : null; });
      check(r && r[0] === '3/3' && /Mutant/.test(r[1]) && !/Elf/.test(r[1]) && r[2] === 'G', `Kim's milled Llanowar Elves is now Georges's ${JSON.stringify(r)}`);
      await toGy(A, 'The Master, Transcendent'); await A.evaluate(() => { S.bf.filter(c => cname(c) === 'Llanowar Elves').forEach(c => { try { if (c.own) sendBack(c, 'gy'); else moveCard(c.id, 'ex', {quiet:true}); } catch { moveCard(c.id, 'ex', {quiet:true}); } }); commit(); }); await after();
    });
    await step('The Pride of Hull Clade and Blitzball Stadium grant combat-damage card draw', async () => {
      await put(A, 'The Pride of Hull Clade'); await put(A, 'Blitzball Stadium'); await put(A, 'Grizzly Bears'); await after();
      await A.evaluate(() => { window.__tgt = 'Grizzly'; }); check(await activate(A, 'The Pride of Hull Clade', 'toughness') === 'ok', 'activated The Pride of Hull Clade'); await after();
      check(await activate(A, 'Blitzball Stadium', 'kind of counter') === 'ok', 'activated Blitzball Stadium'); await after(); await A.evaluate(() => { window.__tgt = null; });
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); const e = l24eff(c); return {p:stats(c)[0], ab:(e && e.ab || []).map(x => x.t), unbl:(c.ekw || []).includes('unblockable')}; });
      check(r.p === 3 && r.ab.length === 2 && r.unbl, `Grizzly Bears: power ${r.p}, granted ${r.ab.length} abilities, unblockable ${r.unbl}`);
      const h0 = await A.evaluate(() => S.hand.length);
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); modCounters(c, 'cp', 1); handleEvent(MYPID, {type:'cdmg', k:c.k, id:c.id, dp:[...OPP.keys()][0], amt:2, cnt:1}); commit(); }); await after();
      const h1 = await A.evaluate(() => S.hand.length); check(h1 - h0 === 3 + 1, `combat damage drew ${h1 - h0} (toughness 3 + one kind of counter)`);
      for (const n of ['The Pride of Hull Clade', 'Blitzball Stadium', 'Grizzly Bears']) await toGy(A, n);
    });
    await step('Radiant Lotus: sacrifice two artifacts for six mana of one color', async () => {
      await put(A, 'Radiant Lotus'); await put(A, 'Mind Stone'); await put(A, 'Darksteel Ingot'); await after();
      await A.evaluate(() => { window.__want = 'Mind Stone|Darksteel|\\{R\\}'; window.__tgt = 'Georges'; });
      const r = await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Radiant Lotus'); c.tap = false; const ab = abilityList(c).find(a => /three mana/.test(a.eff)); S.pool = emptyPool(); await activateAbility(c, ab); return 'ok'; }); await after();
      await A.evaluate(() => { window.__want = null; window.__tgt = null; });
      const pool = await A.evaluate(() => S.pool.R || 0); check(pool === 6, `added ${pool} red mana`);
      check(await cnt(A, 'Mind Stone|Darksteel Ingot') === 0, 'both artifacts were sacrificed'); await A.evaluate(() => { S.pool = emptyPool(); commit(); }); await toGy(A, 'Radiant Lotus');
    });
    await step('Sewer Nemesis: when the chosen player casts a spell, they mill a card', async () => {
      await A.evaluate(() => { window.__want = 'Kim'; }); await put(A, 'Sewer Nemesis'); await after(); await sleep(800); await A.evaluate(() => { window.__want = null; });
      await toZone(B, 'Lightning Bolt', 'hand'); const l0 = await B.evaluate(() => S.lib.length); await B.evaluate(() => { window.__tgt = 'Georges'; }); check(await cast(B, 'Lightning Bolt') === 'ok', 'Kim casts Lightning Bolt at Georges'); await after(); await sleep(1500); await settle([A, B]);
      await B.evaluate(() => { window.__tgt = null; }); const l1 = await B.evaluate(() => S.lib.length); check(l0 - l1 === 1, `Kim milled ${l0 - l1}`);
      const pt = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Sewer Nemesis'); return c ? stats(c) : null; }); const g = await B.evaluate(() => S.gy.length);
      check(pt && pt[0] === g && pt[1] === g, `Sewer Nemesis is ${pt && pt.join('/')} = cards in Kim's graveyard (${g})`); await toGy(A, 'Sewer Nemesis');
    });
    await step("Requiem Monolith: Kim's creature is dealt 1 damage — Kim draws 1 and loses 1", async () => {
      await put(A, 'Requiem Monolith'); await put(B, 'Grizzly Bears'); await after(); await B.evaluate(() => { window.__want = 'Yes|Deal'; });
      const h0 = await B.evaluate(() => S.hand.length), l0 = await life(B);
      await A.evaluate(() => { window.__tgt = 'Grizzly'; }); check(await activate(A, 'Requiem Monolith', 'dealt damage') === 'ok', 'activated Requiem Monolith'); await after(); await sleep(2500); await settle([A, B]);
      await A.evaluate(() => { window.__tgt = null; }); await B.evaluate(() => { window.__want = null; });
      const h1 = await B.evaluate(() => S.hand.length), l1 = await life(B);
      check(h1 - h0 === 1 && l0 - l1 === 1, `Kim drew ${h1 - h0} and lost ${l0 - l1} life`); await toGy(A, 'Requiem Monolith'); await toGy(B, 'Grizzly Bears');
    });
    await step('Tranquil Frillback: pay {G} once and gain 4 life', async () => {
      const l0 = await life(A); await A.evaluate(() => { window.__want = '^1 time|gain 4 life'; S.pool = {...emptyPool(), G:3}; commit(); });
      await put(A, 'Tranquil Frillback'); await after(); await A.evaluate(() => { window.__want = null; });
      check(await life(A) === l0 + 4, `life ${l0} → ${await life(A)}`); check(await A.evaluate(() => S.pool.G) === 2, 'paid exactly one {G}');
      await A.evaluate(() => { S.pool = emptyPool(); commit(); }); await toGy(A, 'Tranquil Frillback');
    });
    await step('Golden Argosy exiles the creatures that crewed it; Mighty Servant checks for exactly two crew', async () => {
      await put(A, 'Golden Argosy'); await putAny(A, 'Grizzly Bears'); await after();
      await A.evaluate(async () => { const v = S.bf.find(x => cname(x) === 'Golden Argosy'); const e = S.bf.find(x => cname(x) === 'Grizzly Bears'); v.qCrewT = turnStr(); v.qCrewers = [e.id]; e.tap = true;
        await runEffects('Exile each creature that crewed it this turn. Return them to the battlefield tapped under their owner\'s control at the beginning of the next end step.', {k:v.k, name:'Golden Argosy', srcId:v.id, full:info(v.k).o, it:{kind:'trigger'}}); commit(); });
      check(await A.evaluate(() => S.ex.some(c => cname(c) === 'Grizzly Bears') && S.dly.some(d => /Return it/.test(d.eff))), 'Grizzly Bears exiled with a delayed return');
      await A.evaluate(() => { fireSteps('end', MYPID); commit(); }); await after();
      check(await cnt(A, 'Grizzly Bears') === 1, 'Grizzly Bears returned at the end step'); await toGy(A, 'Golden Argosy'); await toGy(A, 'Grizzly Bears');
      const tr = await A.evaluate(() => { const c = info([...DICT.values()].find(a => a.n === 'Mighty Servant of Leuk-o').k); const t = classifyTrig('whenever', '~ becomes crewed for the first time each turn'); return !!(t && t.qf && t.qf({id:5}, {id:5, nth:1, x:2}, MYPID) && !t.qf({id:5}, {id:5, nth:2, x:2}, MYPID)); });
      check(tr, 'Mighty Servant only triggers on the first crew of the turn');
    });
    await step('Vronos −7: an artifact becomes an unblockable 9/9 Construct', async () => {
      await put(A, 'Vronos, Masked Inquisitor'); await put(A, 'Darksteel Ingot'); await putAny(B, 'Test Wall'); await after();
      await A.evaluate(() => { window.__tgt = 'Darksteel'; }); await run(A, 'Target artifact you control becomes a 9/9 Construct artifact creature and gains vigilance, indestructible, and "This creature can\'t be blocked."', 'Vronos, Masked Inquisitor', {tgts:null});
      await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Darksteel Ingot'); const v = S.bf.find(x => cname(x) === 'Vronos, Masked Inquisitor'); await runEffects('Target artifact you control becomes a 9/9 Construct artifact creature and gains vigilance, indestructible, and "This creature can\'t be blocked."', {k:v.k, name:cname(v), srcId:v.id, full:'', tgts:[[{t:'card', pid:MYPID, id:c.id, k:c.k, nm:cname(c)}]], it:{kind:'ability'}}); commit(); });
      await after(); await sleep(1500); await A.evaluate(() => { window.__tgt = null; });
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Darksteel Ingot'); return [isCreatureCard(c), stats(c).join('/'), kwOf(c, 'vigilance')]; });
      check(r[0] && r[1] === '9/9' && r[2], `Darksteel Ingot: ${JSON.stringify(r)}`);
      const blk = await B.evaluate(() => { const o = [...OPP.entries()][0]; const a = o[1].bf.find(x => info(x.k)?.n === 'Darksteel Ingot'); const b = S.bf.find(x => cname(x) === 'Test Wall'); return canBlock(b, a, o[0]); });
      check(/can't be blocked/.test(blk), `Kim's Test Wall can't block it ("${blk}")`);
      await toGy(A, 'Vronos, Masked Inquisitor'); await toGy(A, 'Darksteel Ingot');
    });
    await step('Willbreaker: targeting Kim\'s creature steals it while Willbreaker stays', async () => {
      await put(A, 'Willbreaker'); await putAny(B, 'Test Striker'); await after(); await toZone(A, 'Giant Growth', 'hand'); await A.evaluate(() => { window.__tgt = 'Test Striker'; });
      check(await cast(A, 'Giant Growth') === 'ok', 'Georges casts Giant Growth on Kim\'s Test Striker'); await after(); await sleep(2000); await settle([A, B]); await A.evaluate(() => { window.__tgt = null; });
      check(await cnt(A, 'Test Striker') === 1 && await cnt(B, 'Test Striker') === 0, 'Georges controls Test Striker');
      await toGy(A, 'Willbreaker'); await sleep(2500); await settle([A, B]);
      check(await cnt(B, 'Test Striker') === 1 && await cnt(A, 'Test Striker') === 0, 'Willbreaker left: Test Striker went back to Kim'); await toGy(B, 'Test Striker');
    });
    await step('Comet, Stellar Pup: a 6 gives +1 and two more activations; a 1 makes hasty Squirrels', async () => {
      await put(A, 'Comet, Stellar Pup'); await after(); await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Comet, Stellar Pup'); c.co = 5; commit(); });
      const roll = async v => A.evaluate(async v => { const R = Math.random; Math.random = () => v; const c = S.bf.find(x => cname(x) === 'Comet, Stellar Pup'); try { await runEffects('Roll a six-sided die.', {k:c.k, name:cname(c), srcId:c.id, full:info(c.k).o, it:{kind:'ability'}}); } finally { Math.random = R; } commit(); return c.co; }, v);
      const c6 = await roll(0.99); check(c6 === 6, `rolled 6: loyalty 5 → ${c6}`);
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Comet, Stellar Pup'); c.lu = turnStr(); return loyaltyReady(c, loyaltyAbs(c)[0]); }); check(r === '', `may activate again this turn ("${r}")`);
      const s0 = await cnt(A, 'Squirrel'); const c1 = await roll(0.01); await after();
      check(c1 === 8 && await cnt(A, 'Squirrel') - s0 === 2, `rolled 1: loyalty → ${c1}, Squirrels +${await cnt(A, 'Squirrel') - s0}`);
      await toGy(A, 'Comet, Stellar Pup'); await toGy(A, 'Squirrel');
    });
    await step('Out of Time: all creatures phase out until it leaves', async () => {
      await putAny(A, 'Llanowar Elves'); await putAny(A, 'Grizzly Bears'); await putAny(B, 'Test Wall'); await putAny(B, 'Test Striker'); await after(); await sleep(1000);
      await put(A, 'Out of Time'); await after(); await sleep(2000); await settle([A, B]);
      const t = await A.evaluate(() => (S.bf.find(x => cname(x) === 'Out of Time')?.nc || {}).time || 0);
      check(await cnt(A, 'Llanowar Elves') === 0 && await cnt(B, 'Test Wall') === 0, 'creatures on both sides phased out');
      check(t >= 2, `Out of Time has ${t} time counters`);
      await toGy(A, 'Out of Time'); await sleep(3500);
      check(await cnt(A, 'Llanowar Elves|Grizzly Bears') === 2 && await cnt(B, 'Test Wall|Test Striker') === 2, 'all four phased back in when Out of Time left');
      await toGy(A, 'Llanowar Elves'); await toGy(A, 'Grizzly Bears'); await toGy(B, 'Test Wall'); await toGy(B, 'Test Striker');
    });
    await step('Feather: Giant Growth on my creature is exiled and returns at end step', async () => {
      await put(A, 'Feather, the Redeemed'); await putAny(A, 'Llanowar Elves'); await after(); await toZone(A, 'Giant Growth', 'hand');
      await A.evaluate(() => { window.__tgt = 'Llanowar'; }); check(await cast(A, 'Giant Growth') === 'ok', 'cast Giant Growth on Llanowar Elves'); await after(); await A.evaluate(() => { window.__tgt = null; });
      check(await A.evaluate(() => S.ex.some(c => cname(c) === 'Giant Growth') && !S.gy.some(c => cname(c) === 'Giant Growth')), 'Giant Growth was exiled instead of going to the graveyard');
      await A.evaluate(() => { fireSteps('end', MYPID); commit(); }); await after();
      check(await A.evaluate(() => S.hand.some(c => cname(c) === 'Giant Growth')), 'Giant Growth returned to hand at the end step');
      await toGy(A, 'Feather, the Redeemed'); await toGy(A, 'Llanowar Elves');
    });
    await step("Don't Make a Sound: Kim pays {2}, so Georges surveils 2", async () => {
      await toZone(B, 'Lightning Bolt', 'hand'); await B.evaluate(() => { window.__tgt = 'Georges'; }); const l0 = await life(A); await B.evaluate(async () => { const c = S.hand.find(x => cname(x) === 'Lightning Bolt'); S.pool = {...emptyPool(), R:1}; commit(); await beginCast(c, 'hand'); }); await sleep(1500);
      await toZone(A, "Don't Make a Sound", 'hand'); await A.evaluate(() => { window.__tgt = 'Lightning Bolt'; }); await lt(A);
      await A.evaluate(async () => { const c = S.hand.find(x => cname(x) === "Don't Make a Sound"); S.pool = {...emptyPool(), U:2}; commit(); await beginCast(c, 'hand'); }); await sleep(800);
      for (let i = 0; i < 12; i++){ await passAll([A, B]); const has = await B.evaluate(() => S.prm.some(p => p.type === 'unless')); if (has) break; await sleep(300); }
      const paid = await B.evaluate(() => { const p = S.prm.find(x => x.type === 'unless'); if (!p) return false; S.pool = {...emptyPool(), C:2}; resolvePrompt(p, true); return true; });
      check(paid, 'Kim paid {2}'); await after(); await sleep(1500); await settle([A, B]); const got = await ltOff(A); await A.evaluate(() => { window.__tgt = null; });
      check(JSON.stringify(got) === '[2]', `Georges surveilled ${JSON.stringify(got)}`);
      check(await life(A) === l0 - 3, `Kim's Lightning Bolt resolved (Georges ${l0} → ${await life(A)})`);
    });
    await step('Benevolent Blessing: protection from the chosen color, seen by both players', async () => {
      await putAny(A, 'Llanowar Elves'); await after(); await A.evaluate(() => { window.__want = 'red|\\{R\\}'; window.__tgt = 'Llanowar'; });
      await toZone(A, 'Benevolent Blessing', 'hand'); check(await cast(A, 'Benevolent Blessing') === 'ok', 'cast Benevolent Blessing on Llanowar Elves'); await after(); await sleep(1500);
      await A.evaluate(() => { window.__want = null; window.__tgt = null; });
      const me = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Llanowar Elves'); return protects(c, {col:'R'}) && !protects(c, {col:'U'}); });
      const kim = await B.evaluate(() => { const o = [...OPP.entries()][0]; const c = o[1].bf.find(x => info(x.k)?.n === 'Llanowar Elves'); return !!c && protects(c, {col:'R'}); });
      check(me && kim, `Llanowar Elves has protection from red on both clients (Georges ${me}, Kim ${kim})`);
      await toGy(A, 'Benevolent Blessing'); await toGy(A, 'Llanowar Elves');
    });
    await step('Conspiracy and Lifecraft Engine: the chosen creature type', async () => {
      await A.evaluate(() => { const o = askText; window.__askT = o; askText = async () => 'Goblin'; });
      await put(A, 'Conspiracy'); await putAny(A, 'Llanowar Elves'); await after(); await sleep(800);
      await toZone(A, 'Grizzly Bears', 'hand');
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Llanowar Elves'); const h = S.hand.find(x => cname(x) === 'Grizzly Bears'); return [typeOf(c), descOk(h.k, 'goblin'), descOk(h.k, 'bear')]; });
      check(/Goblin/.test(r[0]) && !/Elf/.test(r[0]) && r[1] && !r[2], `Conspiracy: Llanowar Elves is "${r[0]}", Grizzly Bears in hand is a Goblin (${r[1]}) and not a Bear (${!r[2]})`);
      await toGy(A, 'Conspiracy'); await toGy(A, 'Llanowar Elves');
      await put(A, 'Lifecraft Engine'); await after(); await sleep(800);
      const v = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Lifecraft Engine'); c.anim = 'crew'; c.animPT = [4, 4]; l24bust(); const t = typeOf(c); c.anim = ''; c.animPT = null; l24bust(); return t; });
      check(/Goblin/.test(v), `crewed Lifecraft Engine is "${v}"`); await toGy(A, 'Lifecraft Engine');
      await A.evaluate(() => { askText = window.__askT; });
    });
    await step('Narset −2: discarding a nonland card deals damage equal to its mana value', async () => {
      await putAny(B, 'Test Striker'); await after(); await toZone(A, 'Llanowar Elves', 'hand'); await A.evaluate(() => { window.__want = 'Llanowar'; window.__tgt = 'Test Striker'; });
      await putAny(A, 'Narset of the Ancient Way'); await after();
      await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Narset of the Ancient Way'); c.co = 5; c.lu = ''; await activateLoyalty(c, 1); commit(); });
      await after(); await sleep(1500); await settle([A, B]); await A.evaluate(() => { window.__want = null; window.__tgt = null; });
      const d = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Test Striker'); return c ? c.dmg || 0 : 'died'; }); check(d === 1 || d === 'died', `Kim's Test Striker took 1 damage (the discarded Elves' mana value): ${d}`); await toGy(B, 'Test Striker'); await toGy(A, 'Narset of the Ancient Way');
    });
    await step('Botanical Brawler grows the first time counters go on another permanent each turn', async () => {
      await put(A, 'Botanical Brawler'); await putAny(A, 'Llanowar Elves'); await after();
      const c0 = await A.evaluate(() => S.bf.find(x => cname(x) === 'Botanical Brawler').cp || 0);
      await A.evaluate(() => { const e = S.bf.find(x => cname(x) === 'Llanowar Elves'); modCounters(e, 'cp', 1); commit(); }); await after();
      await A.evaluate(() => { const e = S.bf.find(x => cname(x) === 'Llanowar Elves'); modCounters(e, 'cp', 1); commit(); }); await after();
      const c1 = await A.evaluate(() => S.bf.find(x => cname(x) === 'Botanical Brawler').cp || 0);
      check(c1 - c0 === 1, `Brawler got ${c1 - c0} counter (only the first time this turn)`); await toGy(A, 'Botanical Brawler'); await toGy(A, 'Llanowar Elves');
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
