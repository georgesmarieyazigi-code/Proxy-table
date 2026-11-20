process.env.TOP = '1';
// Round 27 helper B: the last one-offs, played in a real 2-player game (Georges vs Kim)
const CC = require('./cards');
const WANT = ['Blast-Furnace Hellkite', 'Aminatou, the Fateshifter', 'Conspiracy Theorist', 'Umbra Mystic', 'Kitesail Larcenist', 'Cayth, Famed Mechanist', 'Tato Farmer', 'Shadowgrange Archfiend', 'Balor',
  'Senu, Keen-Eyed Protector', 'Guff Rewrites History', 'Sokrates, Athenian Teacher', 'Jeska, Thrice Reborn', 'Breeches, Brazen Plunderer', 'Triple Triad', 'Astor, Bearer of Blades', 'Professor Hojo',
  'Pendant of Prosperity', 'Share the Spoils', "Greymond, Avacyn's Stalwart",
  'Mind Stone', 'Darksteel Ingot', 'Llanowar Elves', 'Lightning Bolt', 'Rancor', 'Loxodon Warhammer', 'Skysovereign, Consul Flagship', 'Champion of the Parish', 'Spider Umbra', 'Mulldrifter', 'Sol Ring', 'Wall of Omens', 'Phyrexian Arena'];
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
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2b3');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2b3');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const after = async () => { await sleep(500); await settle([A, B]); await sleep(1200); await settle([A, B]); await sleep(500); };
  const kimPid = await A.evaluate(() => [...OPP.keys()][0]); const gPid = await B.evaluate(() => [...OPP.keys()][0]);
  const want = (p, w) => p.evaluate(w => { window.__want = w; }, w);
  const top = (p, n) => p.evaluate(n => { for (const z of ['hand', 'gy', 'ex', 'bf', 'lib']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.lib.unshift(c); commit(); return true; } } return false; }, n);
  const wipe = async p => { await p.evaluate(() => { S.bf.filter(c => !isLand(c.k)).forEach(c => { if (c.tok) S.bf.splice(S.bf.indexOf(c), 1); else { const i = S.bf.indexOf(c); S.bf.splice(i, 1); reset(c); delete c.att; S.lib.push(c); } }); S.stk = []; S.pool = emptyPool(); commit(); }); await sleep(300); };
  const combat = async (who) => {
    await A.evaluate(() => { if (phaseNow().ph !== 3) setPhase(3); if (S.cb) S.cb.step = 'end'; S.bf.forEach(c => { c.atk = ''; c.tap = false; c.sk = false; }); commit(); }); await sleep(400);
    await A.click('#phasebar [data-act="next"]').catch(() => {}); await waitFor(A, () => phaseNow().ph === 4, null, 8000); await passAll([B]);
    if (!(await A.evaluate(() => S.cb && S.cb.step === 'atk'))) await A.evaluate(() => nextAction());
    await waitFor(A, () => S.cb && S.cb.step === 'atk', null, 8000);
    await A.evaluate((w) => { const e = S.bf.find(c => cname(c).startsWith(w)); e.sk = false; e.tap = false; UI.atkSel = {[e.id]:'p:' + opponents()[0].pid}; renderCombatPanel(); }, who);
    await A.click('#cbpanel [data-act="atkGo"]'); await passAll([B]);
    await waitFor(B, () => !!document.querySelector('#cbpanel [data-act="blkGo"]'), null, 8000);
    await B.click('#cbpanel [data-act="blkGo"]');
    for (let i = 0; i < 12; i++){ await passAll([A, B]); if (await A.evaluate(() => phaseNow().ph === 5)) break; }
    await sleep(1500); await settle([A, B]); await sleep(800); await settle([A, B]);
  };
  try {
    await step('Astor: Equipment get equip {1}, Vehicles get crew 1', async () => {
      await put(A, 'Astor, Bearer of Blades'); await after(); await wipe(A);
      await A.evaluate(() => { window.__want = '.'; });
      for (const n of ['Astor, Bearer of Blades', 'Loxodon Warhammer', 'Skysovereign, Consul Flagship', 'Llanowar Elves']) await putAny(A, n);
      await after();
      const r = await A.evaluate(() => { const w = S.bf.find(c => cname(c) === 'Loxodon Warhammer'); const v = S.bf.find(c => /Skysovereign/.test(cname(c))); return [abilityList(w).filter(a => a.equip).map(a => a.cost), abilityList(v).filter(a => a.crew).map(a => a.crew)]; });
      check(r[0].includes('{3}') && r[0].includes('{1}'), 'Warhammer has equip {3} and equip {1} ' + JSON.stringify(r[0]));
      check(r[1].includes(3) && r[1].includes(1), 'Skysovereign has crew 3 and crew 1 ' + JSON.stringify(r[1]));
      await A.evaluate(() => { window.__tgt = 'Llanowar'; });
      const res = await A.evaluate(async () => { const w = S.bf.find(c => cname(c) === 'Loxodon Warhammer'); S.pool = {...emptyPool(), C:1}; const ab = abilityList(w).find(a => a.equip && a.cost === '{1}'); window.__why = [abilityReady(w, ab, false), stackAll().length, UI.casting]; await activateAbility(w, ab); return S.pool.C; });
      console.log('    why', JSON.stringify(await A.evaluate(() => window.__why)));
      await after();
      const att = await A.evaluate(() => { const w = S.bf.find(c => cname(c) === 'Loxodon Warhammer'); const e = S.bf.find(c => cname(c) === 'Llanowar Elves'); return !!(w.att && w.att.id === e.id); });
      check(res === 0 && att, `equip {1} paid with one mana and attached the Warhammer (${res}, ${att})`);
    });
    await step("Greymond: Humans get the two chosen abilities (seen by both players)", async () => {
      await wipe(A); await want(A, 'First strike \\+ lifelink');
      await putAny(A, 'Champion of the Parish'); await putAny(A, "Greymond, Avacyn's Stalwart"); await after();
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Champion of the Parish'); return ['first strike', 'lifelink', 'vigilance'].map(k => !!kwOf(c, k)); });
      check(r[0] && r[1] && !r[2], 'Champion has first strike and lifelink, not vigilance ' + JSON.stringify(r));
      await sleep(1500);
      const rb = await B.evaluate(pid => { const c = (OPP.get(pid).bf || []).find(x => cname(x) === 'Champion of the Parish'); return c ? ['first strike', 'lifelink', 'vigilance'].map(k => !!kwOf(c, k, pid)) : null; }, gPid);
      check(rb && rb[0] && rb[1] && !rb[2], "Kim's client sees the same abilities " + JSON.stringify(rb));
    });
    await step('Jeska enters with a loyalty counter per commander cast from the command zone', async () => {
      await wipe(A); await A.evaluate(() => { S.tax = {...S.tax}; const k = S.cz[0] ? S.cz[0].k : 'x'; S.tax[k] = 2; commit(); });
      await putAny(A, 'Jeska, Thrice Reborn'); await after();
      const co = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Jeska, Thrice Reborn'); return c ? c.co : -1; });
      check(co === 2, `Jeska has 2 loyalty (${co})`);
      await A.evaluate(() => { S.tax = {}; commit(); });
    });
    await step('Pendant of Prosperity enters under Kim\'s control; its ability also draws for its owner', async () => {
      await wipe(A); await toZone(A, 'Pendant of Prosperity', 'hand'); const r0 = await cast(A, 'Pendant of Prosperity'); await after(); await sleep(1500);
      const onB = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Pendant of Prosperity'); return c ? !!c.own : null; });
      check(r0 === 'ok' && onB === true && await A.evaluate(() => !S.bf.some(x => cname(x) === 'Pendant of Prosperity')), `Pendant is on Kim's battlefield, owned by Georges (${r0}, ${onB})`);
      const hA = await A.evaluate(() => S.hand.length); const hB = await B.evaluate(() => S.hand.length);
      await A.evaluate(() => { const l = S.lib.find(c => isLand(c.k)); if (l){ S.lib.splice(S.lib.indexOf(l), 1); S.hand.push(l); } commit(); });
      await want(B, "Don't"); await want(A, '.');
      const ra = await activate(B, 'Pendant of Prosperity', 'Draw a card'); await after(); await sleep(2000); await settle([A, B]);
      const hA2 = await A.evaluate(() => S.hand.length); const hB2 = await B.evaluate(() => S.hand.length);
      const land = await A.evaluate(() => S.log.some(e => /Pendant of Prosperity: put .+ from their hand onto the battlefield/.test(e.s)));
      const kimDrew = await B.evaluate(() => S.log.slice(-8).some(e => /^drew a card$/.test(e.s)));
      check(ra === 'ok' && kimDrew, `Kim (controller) drew a card (and may have put a land: ${hB} → ${hB2})`);
      check(land && hA2 === hA + 1, `Georges (owner) drew a card and put a land from hand onto the battlefield (${hA} → ${hA2}, land ${land})`);
    });
    await step('Triple Triad: each player exiles their top card; my card and lesser ones are free this turn', async () => {
      await wipe(A); await putAny(A, 'Triple Triad'); await top(A, 'Mulldrifter'); await top(B, 'Lightning Bolt'); await sleep(800);
      await A.evaluate(() => fireSteps('upkeep', MYPID)); await after(); await sleep(1500);
      const r = await A.evaluate(() => S.ex.filter(c => c.mayPlay && c.mayPlay.src === 'Triple Triad').map(c => [cname(c), !!c.mayPlay.free, !!c.own]));
      check(r.some(x => x[0] === 'Mulldrifter' && x[1] && !x[2]), 'my Mulldrifter may be played free ' + JSON.stringify(r));
      check(r.some(x => x[0] === 'Lightning Bolt' && x[1] && x[2]), "Kim's Lightning Bolt (MV 1 < 5) may be cast free by me " + JSON.stringify(r));
      await A.evaluate(() => { const c = S.ex.find(x => cname(x) === 'Lightning Bolt' && x.mayPlay); window.__tgt = 'Kim'; return c && beginCast(c, 'ex', {free:true}); });
      const l0 = await B.evaluate(() => S.life); await after(); await sleep(1000); const l1 = await B.evaluate(() => S.life);
      check(l1 === l0 - 3, `the borrowed Bolt hit Kim for 3 (${l0} → ${l1})`);
    });
    await step('Balor dies: chosen mode makes Kim draw three, then discard three at random', async () => {
      await wipe(A); await putAny(A, 'Balor'); await after(); const h0 = await B.evaluate(() => S.hand.length);
      await want(A, 'draws three'); await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Balor'); moveCard(c.id, 'gy'); commit(); }); await after(); await sleep(1500);
      const r = await B.evaluate(() => [S.hand.length, S.log.filter(e => /discarded .+ at random \(Balor\)/.test(e.s)).length]);
      check(r[0] === h0 && r[1] === 3, `Kim drew 3 and discarded 3 at random (${h0} → ${r[0]}, ${r[1]} random discards)`);
      await want(A, 'deals damage'); await putAny(A, 'Balor'); await after(); const l0 = await B.evaluate(() => S.life); const hc = await B.evaluate(() => S.hand.length);
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Balor'); moveCard(c.id, 'gy'); commit(); }); await after(); await sleep(1000);
      const l1 = await B.evaluate(() => S.life); check(l1 === l0 - hc, `Balor dealt damage equal to Kim's hand (${hc}): ${l0} → ${l1}`);
    });
    await step('Tato Farmer: a land milled this turn from Kim\'s graveyard onto my battlefield tapped', async () => {
      await wipe(A); await putAny(A, 'Tato Farmer');
      const land = await B.evaluate(() => { const l = S.lib.find(c => isLand(c.k)); S.lib.splice(S.lib.indexOf(l), 1); S.lib.unshift(l); mill(1); commit(); return cname(l); }); await sleep(1500);
      await A.evaluate(n => { window.__tgt = n; }, land);
      const r = await activate(A, 'Tato Farmer', 'milled this turn'); await after(); await sleep(1500);
      const got = await A.evaluate(n => { const c = S.bf.filter(x => cname(x) === n && x.own === undefined && x.tap); return S.bf.some(x => cname(x) === n && x.tap && S.log.some(e => /takes .+ graveyard onto the battlefield tapped|gained control of/.test(e.s))); }, land);
      const gone = await B.evaluate(n => !S.gy.some(c => cname(c) === n), land);
      check(r === 'ok' && got && gone, `${land} moved from Kim's graveyard to my battlefield, tapped (${r}, ${got}, ${gone})`);
    });
    await step('Conspiracy Theorist: discarding a nonland card lets me exile it and cast it this turn', async () => {
      await wipe(A); await putAny(A, 'Conspiracy Theorist'); await toZone(A, 'Lightning Bolt', 'hand'); await want(A, 'Lightning Bolt');
      await A.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Lightning Bolt'); UI.discarding = []; moveCard(c.id, 'gy'); UI.discarding = null; commit(); }); await after(); await sleep(800);
      const r = await A.evaluate(() => { const c = S.ex.find(x => cname(x) === 'Lightning Bolt'); return c ? [!!c.mayPlay, exWindowOk(c)] : null; });
      check(r && r[0] && r[1], 'Lightning Bolt is exiled and castable this turn ' + JSON.stringify(r));
      await A.evaluate(() => { const c = S.ex.find(x => cname(x) === 'Lightning Bolt'); if (c){ delete c.mayPlay; moveCard(c.id, 'lib'); } commit(); });
    });
    await step('Fabricate: Cayth fabricates, and grants fabricate 1 to my other nontoken creatures', async () => {
      await wipe(A); await want(A, 'counter'); await putAny(A, 'Cayth, Famed Mechanist'); await after();
      const cp = await A.evaluate(() => S.bf.find(x => /Cayth/.test(cname(x))).cp || 0); check(cp === 1, `Cayth chose a +1/+1 counter (${cp})`);
      await want(A, 'Servo'); await putAny(A, 'Wall of Omens'); await after();
      const sv = await A.evaluate(() => S.bf.filter(x => /Servo/.test(cname(x))).reduce((a, c) => a + (c.n || 1), 0)); check(sv === 1, `Wall of Omens's granted fabricate made a Servo (${sv})`);
    });
    await step('Umbra armor: Spider Umbra saves the creature; Umbra Mystic gives Rancor umbra armor', async () => {
      await wipe(A); await putAny(A, 'Llanowar Elves'); await putAny(A, 'Spider Umbra');
      await A.evaluate(() => { const e = S.bf.find(x => cname(x) === 'Llanowar Elves'); const u = S.bf.find(x => cname(x) === 'Spider Umbra'); u.att = {pid:MYPID, id:e.id}; commit(); }); await after();
      await A.evaluate(() => { const e = S.bf.find(x => cname(x) === 'Llanowar Elves'); destroyCard(e, 'test'); sba(); commit(); }); await after();
      const r = await A.evaluate(() => [S.bf.some(x => cname(x) === 'Llanowar Elves'), S.gy.some(x => cname(x) === 'Spider Umbra')]);
      check(r[0] && r[1], 'destroy: the Elves survive, Spider Umbra is destroyed ' + JSON.stringify(r));
      await putAny(A, 'Umbra Mystic'); await putAny(A, 'Rancor');
      await A.evaluate(() => { const e = S.bf.find(x => cname(x) === 'Llanowar Elves'); const u = S.bf.find(x => cname(x) === 'Rancor'); u.att = {pid:MYPID, id:e.id}; commit(); }); await after();
      await A.evaluate(() => { const e = S.bf.find(x => cname(x) === 'Llanowar Elves'); e.dmg = 9; commit(); sba(); commit(); }); await after();
      const r2 = await A.evaluate(() => [S.bf.some(x => cname(x) === 'Llanowar Elves'), (S.bf.find(x => cname(x) === 'Llanowar Elves') || {}).dmg, S.bf.some(x => cname(x) === 'Rancor')]);
      check(r2[0] && !r2[1] && !r2[2], 'lethal damage: the Elves survive with no damage, Rancor is destroyed instead ' + JSON.stringify(r2));
    });
    await step('Blast-Furnace Hellkite: artifact offering', async () => {
      await wipe(A); await putAny(A, 'Darksteel Ingot'); await toZone(A, 'Blast-Furnace Hellkite', 'hand');
      const html = await A.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Blast-Furnace Hellkite'); return r8HandItems(c, 'hand'); });
      check(/artifact offering/.test(html) && !/b27off[^>]*disabled/.test(html), 'hand menu offers the artifact offering');
      const r = await A.evaluate(async () => { S.bf.filter(b => isLand(b.k)).forEach(b => { b.tap = true; }); const c = S.hand.find(x => cname(x) === 'Blast-Furnace Hellkite'); S.pool = {...emptyPool(), R:2, C:4}; commit(); await b27CastOffering(c); return [S.stk.some(i => i.nm === 'Blast-Furnace Hellkite'), S.gy.some(x => cname(x) === 'Darksteel Ingot'), poolTotal(S.pool)]; });
      check(r[0] && r[1] && r[2] === 0, `cast for {4}{R}{R} by sacrificing Darksteel Ingot ({3}) ${JSON.stringify(r)}`);
      await after(); await A.evaluate(() => { S.bf.forEach(b => { b.tap = false; }); commit(); });
    });
    await step('Professor Hojo: the first targeted ability on my creature costs {2} less this turn', async () => {
      await wipe(A); for (const n of ['Professor Hojo', 'Loxodon Warhammer', 'Llanowar Elves']) await putAny(A, n); await A.evaluate(() => { window.__tgt = 'Llanowar'; S.b27hojo = ''; S.bf.forEach(b => { if (isLand(b.k)) b.tap = true; }); commit(); });
      const r = await A.evaluate(async () => { const w = S.bf.find(c => cname(c) === 'Loxodon Warhammer'); S.pool = {...emptyPool(), C:1}; const ab = abilityList(w).find(a => a.equip); await activateAbility(w, ab); return [S.pool.C, S.stk.some(i => i.nm === 'Loxodon Warhammer')]; });
      check(r[0] === 0 && r[1], `equip {3} cost {1} (${JSON.stringify(r)})`);
      await after();
      const r2 = await A.evaluate(async () => { const w = S.bf.find(c => cname(c) === 'Loxodon Warhammer'); S.pool = {...emptyPool(), C:1}; const ab = abilityList(w).find(a => a.equip); const n0 = S.stk.length; await activateAbility(w, ab); return [S.pool.C, S.stk.length > n0]; });
      check(r2[0] === 1 && !r2[1], `the second equip costs the full {3} again (${JSON.stringify(r2)})`);
      await A.evaluate(() => { S.bf.forEach(b => { b.tap = false; }); commit(); });
    });
    await step('Sokrates: combat damage to a player is prevented and both draw half', async () => {
      await wipe(A); await putAny(A, 'Sokrates, Athenian Teacher'); await putAny(A, 'Champion of the Parish'); await A.evaluate(() => { window.__tgt = 'Champion'; });
      const r = await activate(A, 'Sokrates, Athenian Teacher', 'target creature gains'); await after();
      const hA = await A.evaluate(() => S.hand.length); const hB = await B.evaluate(() => S.hand.length); const l0 = await B.evaluate(() => S.life);
      await A.evaluate(pid => { const c = S.bf.find(x => cname(x) === 'Champion of the Parish'); UI.r23cmb = true; try { dealDamage({t:'player', pid}, 5, c.k, c); } finally { UI.r23cmb = false; } commit(); }, kimPid); await after(); await sleep(1500);
      const r2 = [await A.evaluate(() => S.hand.length), await B.evaluate(() => S.hand.length), await B.evaluate(() => S.life)];
      check(r === 'ok' && r2[2] === l0 && r2[0] === hA + 2 && r2[1] === hB + 2, `5 combat damage prevented; each drew 2 (${hA}→${r2[0]}, ${hB}→${r2[1]}, life ${l0}→${r2[2]})`);
    });
    await step('Kitesail Larcenist: Kim\'s creature becomes a Treasure while Larcenist stays', async () => {
      await wipe(A); await wipe(B); await putAny(B, 'Wall of Omens'); await putAny(A, 'Mind Stone'); await sleep(1200);
      await want(A, 'Wall of Omens|Mind Stone'); await putAny(A, 'Kitesail Larcenist'); await after(); await sleep(1500);
      const r = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Wall of Omens'); return [typeOf(c), isCreatureCard(c), manaAbs(c).length]; });
      check(/Treasure/.test(r[0]) && !r[1] && r[2] > 0, `Kim's Wall of Omens is a Treasure artifact with a mana ability ${JSON.stringify(r)}`);
      const rm = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Mind Stone'); return typeOf(c); }); check(/Treasure/.test(rm), 'my Mind Stone is a Treasure too: ' + rm);
      await toGy(A, 'Kitesail Larcenist'); await sleep(2000);
      const r2 = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Wall of Omens'); return [typeOf(c), isCreatureCard(c)]; });
      check(!/Treasure/.test(r2[0]) && r2[1], 'after Larcenist leaves, the Wall is a creature again ' + JSON.stringify(r2));
    });
    await step('Guff Rewrites History: both targets shuffled away; each player reveals to a nonland card and may cast it free', async () => {
      await wipe(A); await wipe(B); await putAny(A, 'Mind Stone'); await putAny(B, 'Wall of Omens'); await top(A, 'Sol Ring'); await top(B, 'Phyrexian Arena');
      for (const [p, keep] of [[A, 'Sol Ring'], [B, 'Phyrexian Arena']]) await p.evaluate(keep => { const out = S.lib.filter(c => !isLand(c.k) && cname(c) !== keep); S.lib = S.lib.filter(c => !out.includes(c)); S.gy.push(...out); commit(); }, keep);
      await sleep(1200);
      await want(A, 'Cast it'); await want(B, 'Cast it'); await toZone(A, 'Guff Rewrites History', 'hand');
      const r0 = await cast(A, 'Guff Rewrites History'); await after(); await sleep(3000); await settle([A, B]); await sleep(1500);
      const ra = await A.evaluate(() => [S.log.some(e => /Mind Stone was shuffled into its owner's library/.test(e.s)), S.bf.filter(c => /^(Sol Ring|Mind Stone)$/.test(cname(c))).map(cname), S.log.some(e => /cast (Sol Ring|Mind Stone) without paying its mana cost/.test(e.s)), S.lib.length]);
      const rb = await B.evaluate(() => [S.log.some(e => /Wall of Omens was shuffled into its owner's library/.test(e.s)), S.bf.filter(c => /^(Phyrexian Arena|Wall of Omens)$/.test(cname(c))).map(cname), S.log.some(e => /cast (Phyrexian Arena|Wall of Omens) without paying its mana cost/.test(e.s))]);
      check(r0 === 'ok' && ra[0] && ra[1].length === 1 && ra[2], `Georges's Mind Stone was shuffled in; he revealed to a nonland card and cast it free ${JSON.stringify(ra)}`);
      check(rb[0] && rb[1].length === 1 && rb[2], `Kim's Wall of Omens was shuffled in; she revealed to a nonland card and cast it free ${JSON.stringify(rb)}`);
    });
    await step('Share the Spoils: everyone exiles; on my turn I may play one of them (any mana), then exile my next top card', async () => {
      await wipe(A); await wipe(B); await top(A, 'Mulldrifter'); await top(B, 'Lightning Bolt'); await sleep(800);
      await putAny(A, 'Share the Spoils'); await after(); await sleep(2500);
      const r = await A.evaluate(() => S.ex.filter(c => c.mayPlay && /^StS\|/.test(c.mayPlay.src || '')).map(c => [cname(c), !!c.own, exWindowOk(c)]));
      check(r.some(x => x[0] === 'Mulldrifter' && !x[1] && x[2]) && r.some(x => x[0] === 'Lightning Bolt' && x[1] && x[2]), 'my Mulldrifter and Kim\'s Lightning Bolt are both playable by me now ' + JSON.stringify(r));
      const kb = await B.evaluate(() => S.ex.filter(c => c.mayPlay && /^StS\|/.test(c.mayPlay.src || '')).map(c => [cname(c), exWindowOk(c)]));
      check(kb.length >= 2 && kb.every(x => !x[1]), "Kim sees them too but can't play them on my turn " + JSON.stringify(kb));
      await A.evaluate(() => { window.__tgt = 'Kim'; S.pool = {...emptyPool(), U:1}; const c = S.ex.find(x => cname(x) === 'Lightning Bolt' && x.mayPlay); commit(); return beginCast(c, 'ex'); });
      const l0 = await B.evaluate(() => S.life); await after(); await sleep(1500); const l1 = await B.evaluate(() => S.life);
      const r2 = await A.evaluate(() => [S.pool.U || 0, S.ex.filter(c => c.mayPlay && /^StS\|/.test(c.mayPlay.src || '') && !c.own).length, S.ex.filter(c => c.mayPlay && /^StS\|/.test(c.mayPlay.src || '')).some(c => exWindowOk(c))]);
      check(l1 === l0 - 3 && r2[0] === 0, `cast Kim's Bolt with blue mana: Kim ${l0} → ${l1}`);
      check(r2[1] >= 2 && !r2[2], `I exiled my next top card with it, and nothing more is playable this turn ${JSON.stringify(r2)}`);
    });
    await step('Shadowgrange Archfiend: madness {2}{B} and 8 life', async () => {
      await wipe(A); await toZone(A, 'Shadowgrange Archfiend', 'hand'); await want(A, 'Cast it'); const l0 = await A.evaluate(() => S.life);
      await A.evaluate(() => { S.pool = {...emptyPool(), B:1, C:2}; const c = S.hand.find(x => cname(x) === 'Shadowgrange Archfiend'); UI.discarding = []; moveCard(c.id, 'gy'); UI.discarding = null; commit(); }); await after(); await sleep(1000);
      const r = await A.evaluate(() => [S.life, S.bf.some(c => cname(c) === 'Shadowgrange Archfiend') || S.stk.some(i => i.nm === 'Shadowgrange Archfiend'), poolTotal(S.pool)]);
      check(r[1] && r[0] === l0 - 8 + 0 && r[2] === 0, `cast for madness, paying {2}{B} and 8 life (${l0} → ${r[0]}) ${JSON.stringify(r)}`);
    });
    await step('Combat: Senu returns from exile attacking with legendary Breeches; Breeches exiles Kim\'s top card to play', async () => {
      await wipe(A); await wipe(B); await putAny(A, 'Breeches, Brazen Plunderer'); await toZone(A, 'Senu, Keen-Eyed Protector', 'ex'); await top(B, 'Mind Stone'); await want(A, '.');
      const l0 = await B.evaluate(() => S.life);
      await combat('Breeches');
      const r = await A.evaluate(() => [S.bf.some(c => /Senu/.test(cname(c))), S.ex.filter(c => c.own && c.mayPlay && /Breeches/.test(c.mayPlay.src || '')).map(c => [cname(c), !!c.mayPlay.any])]);
      const l1 = await B.evaluate(() => S.life);
      check(r[0], 'Senu came back onto the battlefield');
      check(l1 === l0 - 5, `Kim took 3 + 2 combat damage (${l0} → ${l1})`);
      check(r[1].some(x => x[0] === 'Mind Stone' && x[1]), "Kim's top card is exiled and I may play it with any mana " + JSON.stringify(r[1]));
    });
    await step('Aminatou −6: each player gains control of the next player\'s nonland permanents', async () => {
      await wipe(A); await wipe(B); await putAny(A, 'Aminatou, the Fateshifter'); await putAny(A, 'Mind Stone'); await putAny(B, 'Wall of Omens'); await sleep(1200);
      await A.evaluate(() => { const c = S.bf.find(x => /Aminatou/.test(cname(x))); c.co = 7; commit(); });
      await want(A, 'Left');
      const r = await A.evaluate(async () => { const c = S.bf.find(x => /Aminatou/.test(cname(x))); const ab = loyaltyAbs ? null : null; return 'x'; });
      await A.evaluate(async () => { const c = S.bf.find(x => /Aminatou/.test(cname(x))); await runEffects('Choose left or right. Each player gains control of all nonland permanents other than Aminatou controlled by the next player in the chosen direction.', {k:c.k, name:cname(c), srcId:c.id, full:'', it:{kind:'ability', srcId:c.id}}); commit(); });
      await after(); await sleep(2500);
      const ra = await A.evaluate(() => S.bf.filter(c => !isLand(c.k)).map(c => cname(c) + (c.own ? '*' : '')));
      const rb = await B.evaluate(() => S.bf.filter(c => !isLand(c.k)).map(c => cname(c) + (c.own ? '*' : '')));
      check(ra.includes('Wall of Omens*') && ra.some(x => /Aminatou/.test(x)) && !ra.includes('Mind Stone'), 'Georges keeps Aminatou and controls Kim\'s Wall ' + JSON.stringify(ra));
      check(rb.includes('Mind Stone*') && !rb.includes('Wall of Omens'), 'Kim controls Georges\'s Mind Stone ' + JSON.stringify(rb));
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
