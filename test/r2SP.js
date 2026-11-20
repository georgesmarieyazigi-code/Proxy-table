process.env.TOP = '1';
// Round 26 SP: speed — "Start your engines!" / "Max speed" (CR 702.178, 702.179, 704.5z) — real 2-player game (Georges vs Kim)
const CC = require('./cards');
const WANT = ['Muraganda Raceway', 'Amonkhet Raceway', 'Avishkar Raceway', 'Howlsquad Heavy', 'Vnwxt, Verbose Host', 'Mendicant Core, Guidelight', 'The Speed Demon', "Racers' Scoreboard",
  'Lightning Bolt', 'Grizzly Bears', 'Sol Ring', 'Mind Stone', 'Shock', 'Divination'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, put, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { window.__want = window.__want || null; window.__tgt = window.__tgt || null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ if (!window.__tgt) return; const re = new RegExp(window.__tgt, 'i'); const c = (m.cands || []).filter(x => x.ok && re.test(x.nm)); if (!c.length) return; m.__done = 1; m.resolve(c.slice(0, 1)); closeModal(); }
    else if (m.run){ m.__done = 1; m.run(m.def ?? 1); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const toHand = (p, n) => p.evaluate(n => { for (const z of ['lib', 'gy', 'ex', 'bf']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.hand.push(c); commit(); return c.id; } } return S.hand.find(c => cname(c) === n)?.id; }, n);
const run = (p, txt, nm, extra) => p.evaluate(async ([txt, nm, extra]) => { const k = [...DICT.values()].find(a => a.n === nm)?.k || null; const src = S.bf.find(c => c.k === k); const ctx = {k, name:nm, full:txt, srcId:src ? src.id : null, ...(extra || {})}; if (ctx.tgtKim){ const [pid] = [...OPP.keys()]; ctx.tgts = [[{t:'player', pid, nm:nameOf(pid)}]]; delete ctx.tgtKim; } const it = {sid:rid(6), kind:'trigger', k, nm, txt, srcId:ctx.srcId}; ctx.it = it; await runEffects(txt, ctx); commit(); return 'ok'; }, [txt, nm, extra]);
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { await T(90000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if ((H.fails() > f0 || process.env.LOGS) && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2sp');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2sp');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const after = async () => { await sleep(500); await settle([A, B]); await sleep(1000); await settle([A, B]); await sleep(300); };
  const speedA = () => A.evaluate(() => S.speed ?? null);
  const kimSees = () => B.evaluate(() => { const [pid] = [...OPP.keys()]; return OPP.get(pid).spd || 0; });
  const bolt = async () => { await run(A, 'Lightning Bolt deals 3 damage to any target.', 'Lightning Bolt', {tgtKim:1}); await after(); };
  const passTo = async (from, to) => { await from.evaluate(() => { try { endCombat(); } catch {} passTurn(); }); await after(); await waitFor(to, () => phaseNow().mine, null, 10000); await after(); };
  const manaOf = (n) => A.evaluate(n => { const c = S.bf.find(x => cname(x) === n); return c ? manaAbs(c).map(a => a.outs.map(o => o.join('')).join('/') || a.eff) : null; }, n);
  const ready = (n, re) => A.evaluate(([n, re]) => { const c = S.bf.find(x => cname(x) === n); if (!c) return 'missing'; c.sk = false; c.tap = false; S.pool = {...emptyPool(), C:9, R:9, W:9, U:9}; const ab = abilityList(c).find(a => new RegExp(re, 'i').test(a.eff)); return ab ? abilityReady(c, ab, false) || 'ready' : 'no ability'; }, [n, re]);
  const solCost = () => A.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Sol Ring'); return c ? spellCost(c, 'hand').cost.gen : null; });
  const drawOne = () => A.evaluate(() => { const h = S.hand.length; draw(1); commit(); return S.hand.length - h; });
  const solCount = () => A.evaluate(() => S.bf.filter(c => cname(c) === 'Sol Ring').length);
  const castSol = async () => { await A.evaluate(async () => { const c = S.hand.find(x => cname(x) === 'Sol Ring'); S.pool = {...emptyPool(), C:3}; commit(); await beginCast(c, 'hand', {}); }); await after(); await sleep(500); await after(); };
  const clearSol = () => A.evaluate(() => { S.bf.filter(c => cname(c) === 'Sol Ring').forEach(c => { if (c.tok) S.bf.splice(S.bf.indexOf(c), 1); else moveCard(c.id, 'lib', {quiet:true}); }); commit(); });
  try {
    await step('no speed before any start-your-engines permanent', async () => {
      check(await speedA() === null, 'Georges has no speed');
      await bolt(); check(await speedA() === null, 'an opponent losing life does nothing without speed');
    });
    await step('Start your engines! → speed 1 (704.5z); Kim sees it', async () => {
      await put(A, 'Muraganda Raceway'); await after();
      check(await speedA() === 1, 'Muraganda Raceway on the battlefield → Georges\'s speed is 1');
      check(await kimSees() === 1, 'Kim\'s client sees Georges\'s speed 1');
      check(await B.evaluate(() => /Speed: Georges <b>1<\/b>/.test(r7Chips())), 'Kim\'s status chip shows Georges speed 1');
      check(await B.evaluate(() => /speed <b>1<\/b>/.test(document.querySelector('#opps .opp header .meta')?.innerHTML || '')), 'Kim\'s view of Georges\'s seat shows speed 1');
      await put(A, 'Amonkhet Raceway'); await after(); check(await speedA() === 1, 'a second start-your-engines permanent does not change it');
    });
    await step('below max speed: max speed abilities do not exist', async () => {
      for (const n of ['Avishkar Raceway', "Racers' Scoreboard", 'Vnwxt, Verbose Host', 'Mendicant Core, Guidelight', 'Howlsquad Heavy']) await put(A, n);
      await after(); await toHand(A, 'Sol Ring');
      const m = await manaOf('Muraganda Raceway'); check(JSON.stringify(m) === '["C"]', `Muraganda Raceway taps only for {C} (${JSON.stringify(m)})`);
      const hw = await manaOf('Howlsquad Heavy'); check(hw && hw.length === 0, `Howlsquad Heavy has no mana ability yet (${JSON.stringify(hw)})`);
      check(/^Max speed only/.test(await ready('Amonkhet Raceway', 'haste')), 'Amonkhet Raceway\'s haste ability is unavailable');
      check(/^Max speed only/.test(await ready('Avishkar Raceway', 'draw a card')), 'Avishkar Raceway\'s draw ability is unavailable');
      const blocked = await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Avishkar Raceway'); const ab = abilityList(c).find(a => /draw a card/i.test(a.eff)); const h = S.hand.length; await activateAbility(c, ab); return S.hand.length === h && !c.tap; });
      check(blocked, 'activating it anyway is refused (nothing tapped, nothing drawn)');
      check(await solCost() === 1, 'Racers\' Scoreboard does not reduce Sol Ring yet (costs {1})');
      check(await drawOne() === 1, 'Vnwxt: drawing a card draws one');
      await castSol(); check(await solCount() === 1, 'Mendicant Core: casting an artifact makes no copy');
      await clearSol(); await toHand(A, 'Sol Ring');
    });
    await step('speed rises once per turn, only on Georges\'s turn', async () => {
      const t0 = await A.evaluate(() => turnStr());
      await bolt(); check(await speedA() === 2, 'Kim lost life during Georges\'s turn → speed 2');
      await bolt(); check(await speedA() === 2, 'a second life loss the same turn → still 2 (once each turn)');
      check(await kimSees() === 2, 'Kim sees speed 2');
      await passTo(A, B);
      await bolt(); check(await speedA() === 2, 'Kim lost life during her own turn → no increase');
      await B.evaluate(() => { S.life -= 1; commit(); }); await after(); check(await speedA() === 2, 'Kim paying life on her turn → no increase');
      await passTo(B, A);
      check(await A.evaluate(t => turnStr() !== t, t0), 'a new turn for Georges');
      await A.evaluate(() => { S.life -= 2; commit(); }); await after(); check(await speedA() === 2, 'Georges losing life himself does not count');
      await B.evaluate(() => { S.life -= 1; commit(); }); await after(); check(await speedA() === 3, 'Kim lost life on Georges\'s next turn → speed 3');
      await passTo(A, B); await passTo(B, A);
      await bolt(); check(await speedA() === 4, 'next turn → speed 4 (max speed)');
      check(await kimSees() === 4, 'Kim sees speed 4');
      check(await B.evaluate(() => /Georges <b>4<\/b> \(max\)/.test(r7Chips())), 'Kim\'s chip says Georges is at max speed');
      await passTo(A, B); await passTo(B, A);
      await bolt(); check(await speedA() === 4, 'speed caps at 4');
      await run(A, 'Increase your speed by 1.', 'Muraganda Raceway'); check(await speedA() === 4, '"increase your speed" cannot pass 4');
    });
    await step('max speed abilities unlock at 4', async () => {
      const m = await manaOf('Muraganda Raceway'); check(m && m.includes('C') && m.includes('CC'), `Muraganda Raceway now also taps for {C}{C} (${JSON.stringify(m)})`);
      const pool = await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Muraganda Raceway'); c.tap = false; S.pool = emptyPool(); const ab = manaAbs(c).find(a => a.outs.some(o => o.join('') === 'CC')); await activateMana(c, ab, 0); commit(); return S.pool.C; });
      check(pool === 2, `tapped Muraganda Raceway for {C}{C} (pool C=${pool})`);
      check(await ready('Amonkhet Raceway', 'haste') === 'ready', 'Amonkhet Raceway\'s haste ability is available');
      await A.evaluate(() => { window.__tgt = 'Grizzly'; });
      check(await ready('Avishkar Raceway', 'draw a card') === 'ready', 'Avishkar Raceway\'s draw ability is available');
      const av = await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Avishkar Raceway'); const ab = abilityList(c).find(a => /draw a card/i.test(a.eff)); const h = S.hand.length; S.pool = {...emptyPool(), C:3}; await activateAbility(c, ab); return {tap:!!c.tap}; });
      await after(); check(av.tap, 'Avishkar Raceway activated (tapped)');
      const gob = await A.evaluate(() => S.bf.filter(c => /Goblin/.test(typeOf(c))).length);
      const hw = await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Howlsquad Heavy'); c.sk = false; c.tap = false; S.pool = emptyPool(); const ab = manaAbs(c)[0]; if (!ab) return -1; await activateMana(c, ab, 0); commit(); return S.pool.R; });
      await after(); const hr = await A.evaluate(() => S.pool.R);
      check(hw !== -1 && hr === gob, `Howlsquad Heavy taps for {R} per Goblin (${hr} for ${gob} Goblins)`);
      check(await solCost() === 0, 'Racers\' Scoreboard: Sol Ring costs {0}');
      check(await drawOne() === 2, 'Vnwxt: drawing a card draws two');
      await castSol(); check(await solCount() === 2, 'Mendicant Core: paid {1} to copy the Sol Ring spell (two Sol Rings)');
    });
    await step('The Speed Demon: end step draws and loses X = speed', async () => {
      await put(A, 'The Speed Demon'); await after();
      const s0 = await A.evaluate(() => ({h:S.hand.length, l:S.life}));
      await A.evaluate(() => fireSteps('end', MYPID)); await after(); await sleep(600); await after();
      const s1 = await A.evaluate(() => ({h:S.hand.length, l:S.life}));
      // Vnwxt is still out at max speed: each of the 4 draws becomes two
      check(s1.l === s0.l - 4, `lost 4 life (${s0.l} → ${s1.l})`);
      check(s1.h - s0.h === 8, `drew 4 cards, doubled by Vnwxt to 8 (${s1.h - s0.h})`);
    });
    await step('Kim\'s own start-your-engines permanent gives Kim her own speed', async () => {
      await put(B, 'Avishkar Raceway'); await after();
      check(await B.evaluate(() => S.speed) === 1, 'Kim\'s speed is 1');
      check(await A.evaluate(() => { const [pid] = [...OPP.keys()]; return OPP.get(pid).spd; }) === 1, 'Georges sees Kim\'s speed 1');
      await bolt(); check(await B.evaluate(() => S.speed) === 1, 'Kim losing life does not raise her speed');
      const r = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Avishkar Raceway'); c.tap = false; S.pool = {...emptyPool(), C:9}; const ab = abilityList(c).find(a => /draw a card/i.test(a.eff)); return abilityReady(c, ab, false); });
      check(/^Max speed only/.test(r), `Kim's Avishkar Raceway is locked while Georges is at max speed (${r})`);
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  console.log(`\n${H.results.filter(r => r.startsWith('PASS')).length} passed, ${H.fails()} failed`);
  await browser.close(); process.exit(H.fails() ? 1 : 0);
})();
