process.env.TOP = '1';
// Round 27 helper F: transform / convert / prepared / day & night — real 2-player games
const CC = require('./cards');
const WANT = ['Grave Researcher // Reanimate', 'Emeritus of Woe // Demonic Tutor', 'Ojer Pakpatiq, Deepest Epoch // Temple of Cyclical Time', 'Slicer, Hired Muscle // Slicer, High-Speed Antagonist',
  'Search for Azcanta // Azcanta, the Sunken Ruin', 'Journey to Eternity // Atzal, Cave of Eternity', 'Harmonized Trio // Brainstorm', 'Elesh Norn // The Argent Etchings', 'Stensian Sanguinist // Exsanguinate',
  'Zenos yae Galvus // Shinryu, Transcendent Rival', 'Aang, at the Crossroads // Aang, Destined Savior', 'Cryptolith Fragment // Aurora of Emrakul', 'Emeritus of Ideation // Ancestral Recall',
  'Ashling, Rekindled // Ashling, Rimebound', 'Esper Origins // Summon: Esper Maduin', 'The Everflowing Well // The Myriad Pools', 'Dowsing Device // Geode Grotto', 'Duskwatch Recruiter // Krallenhorde Howler',
  "Hadana's Climb // Winged Temple of Orazca", 'Eiganjo Dynastorian // Replenish', 'Emeritus of Truce // Swords to Plowshares', 'Emeritus of Conflict // Lightning Bolt', 'Thing in the Ice // Awoken Horror',
  'Sidequest: Raise a Chocobo // Black Chocobo', 'Starscream, Power Hungry // Starscream, Seeker Leader', 'Outland Liberator // Frenzied Trapbreaker', 'Ojer Taq, Deepest Foundation // Temple of Civilization',
  'Fable of the Mirror-Breaker // Reflection of Kiki-Jiki', 'Ral, Monsoon Mage // Ral, Leyline Prodigy', 'Thousand Moons Smithy // Barracks of the Thousand', 'Lightning Bolt', 'Grizzly Bears', 'Llanowar Elves', 'Elvish Mystic', 'Memnite', 'Sol Ring', 'Opt', 'Counterspell', 'Ornithopter', 'Divination'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)), ...CC.topCards('extra.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, put, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || (window.__no && o.find(x => x.value === false)) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ if (!window.__tgt) return; const re = new RegExp(window.__tgt, 'i'); const c = (m.cands || []).find(x => x.ok && re.test(x.nm)); if (!c) return; m.__done = 1; m.resolve([c]); closeModal(); }
    else if (m.type === 'zone'){ m.__done = 1; closeModal(); }
    else if (m.run){ m.__done = 1; const d = window.__num != null ? window.__num : (m.def ?? 1); m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
let PA = null, PB = null;
const settle = async () => { for (let i = 0; i < 40; i++){ await passAll([PA, PB]); let busy = false; for (const p of [PA, PB]) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const toHand = (p, n) => p.evaluate(n => { for (const z of ['lib', 'gy', 'ex', 'bf']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.hand.push(c); commit(); return c.id; } } return S.hand.find(c => cname(c) === n)?.id; }, n);
const toZone = (p, n, z2) => p.evaluate(([n, z2]) => { for (const z of ['lib', 'hand', 'gy', 'ex', 'bf']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); if (z2 === 'lib') S.lib.unshift(c); else S[z2].push(c); commit(); return c.id; } } return null; }, [n, z2]);
const cast = (p, n) => p.evaluate(async n => { const c = S.hand.find(x => cname(x) === n); if (!c) return 'not in hand'; await beginCast(c, 'hand'); return S.hand.includes(c) ? 'not cast' : 'ok'; }, n);
const clearBf = p => p.evaluate(() => { for (const c of S.bf.slice()){ const i = S.bf.indexOf(c); S.bf.splice(i, 1); if (!c.tok){ reset(c); S.lib.push(c); } } S.ex = S.ex.filter(c => !c.tok && c.prepOf == null); commit(); });
const run = (p, card, txt, extra = {}) => p.evaluate(async ([card, txt, extra]) => { const c = S.bf.find(x => cname(x) === card || info(x.k)?.n === card); const n0 = S.log.length; try { await runEffects(txt, {k:c ? c.k : null, name:card, srcId:c ? c.id : null, full:txt, it:{kind:'ability', ...(extra.it || {})}, tgts:extra.tgts || null}); } catch (e){ return 'ERR ' + e.message; } commit(); return !!c; }, [card, txt, extra]);
const withTimeout = (pr, ms) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { await withTimeout(fn(), 45000); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-16).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2f3');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2f3');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle(); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const KIM = await B.evaluate(() => MYPID), GEO = await A.evaluate(() => MYPID);
  const zones = p => p.evaluate(() => ({gy:S.gy.map(cname), ex:S.ex.map(cname), hand:S.hand.map(cname), bf:S.bf.map(c => (faceOf(c) || {}).n), life:S.life}));
  const card = (p, n) => p.evaluate(n => { const c = S.bf.find(x => (faceOf(x) || {}).n === n); return c ? {id:c.id, nm:(faceOf(c) || {}).n, fl:!!c.fl, tap:!!c.tap, prep:!!c.prep, cp:c.cp || 0, nc:c.nc || {}, pu:c.pu || [0, 0], goad:!!c.goad, own:!!c.own} : null; }, n);
  const reset2 = async () => { await settle(); await clearBf(A); await clearBf(B); for (const p of [A, B]) await p.evaluate(() => { S.pool = emptyPool(); window.__tgt = null; window.__want = null; window.__num = null; window.__no = false; S.life = 40; commit(); }); await sleep(600); };
  try {
    await step('Emeritus of Woe enters prepared: a Demonic Tutor copy waits in exile; it ceases to exist when Woe leaves', async () => {
      await reset2(); await put(A, 'Emeritus of Woe'); await sleep(300);
      let c = await card(A, 'Emeritus of Woe'); let z = await zones(A);
      check(c && c.prep && z.ex.includes('Demonic Tutor'), `prepared, copy in exile (${z.ex.join(',')})`);
      const cast1 = await A.evaluate(() => { const x = S.ex.find(e => e.prepOf != null); return x ? exWindowOk(x) : false; });
      check(cast1, 'the prepare copy is castable from exile');
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Emeritus of Woe'); moveCard(c.id, 'gy'); commit(); }); await sleep(300);
      z = await zones(A); check(!z.ex.includes('Demonic Tutor'), `Woe died: the copy is gone from exile (${z.ex.join(',')})`);
    });
    await step('Emeritus of Conflict becomes prepared; casting the Lightning Bolt copy (paying {R}) hits Kim and unprepares it; the copy leaves no card behind', async () => {
      await reset2(); await put(A, 'Emeritus of Conflict'); await run(A, 'Emeritus of Conflict', '~ becomes prepared.');
      check((await card(A, 'Emeritus of Conflict')).prep, 'Emeritus of Conflict is prepared');
      await A.evaluate(() => { S.bf.forEach(b => { if (manaAbs(b).length) b.tap = true; }); S.pool = {...emptyPool(), R:1}; window.__tgt = 'Kim'; commit(); });
      const r = await A.evaluate(async () => { const x = S.ex.find(e => e.prepOf != null); if (!x) return 'no copy'; await beginCast(x, 'ex'); return S.ex.includes(x) ? 'not cast' : 'ok'; });
      check(r === 'ok', `cast the copy from exile: ${r}`);
      check(!(await card(A, 'Emeritus of Conflict')).prep, 'casting it unprepared Emeritus of Conflict (601.2i)');
      await settle(); await sleep(800);
      const zb = await zones(B), za = await zones(A); check(zb.life === 37, `Kim took 3 (life ${zb.life})`);
      check(!za.gy.includes('Lightning Bolt') && !za.ex.includes('Lightning Bolt'), `the copy ceased to exist (gy ${za.gy.join(',')})`);
      await A.evaluate(() => { S.pool = emptyPool(); commit(); });
    });
    await step('Grave Researcher: upkeep surveil, then with three creature cards in the graveyard it becomes prepared', async () => {
      await reset2(); await put(A, 'Grave Researcher'); for (const n of ['Grizzly Bears', 'Llanowar Elves', 'Elvish Mystic']) await toZone(A, n, 'gy');
      await A.evaluate(() => { fireSteps('upkeep', MYPID); commit(); }); await settle(); await sleep(500);
      const z = await zones(A); check((await card(A, 'Grave Researcher')).prep && z.ex.includes('Reanimate'), `prepared with a Reanimate copy (${z.ex.join(',')})`);
    });
    await step('Emeritus of Ideation attacks: exile eight cards from the graveyard → prepared (Ancestral Recall copy)', async () => {
      await reset2(); await put(A, 'Emeritus of Ideation'); await A.evaluate(() => { S.lib.filter(c => !isLand(c.k)).slice(0, 8).forEach(c => moveCard(c.id, 'gy', {quiet:true})); commit(); });
      const g0 = (await zones(A)).gy.length;
      await A.evaluate(() => { S.ex = S.ex.filter(e => e.prepOf == null); const c = S.bf.find(x => cname(x) === 'Emeritus of Ideation'); delete c.prep; commit(); });
      await run(A, 'Emeritus of Ideation', 'You may exile eight cards from your graveyard. If you do, ~ becomes prepared.');
      const z = await zones(A); check(z.gy.length === g0 - 8 && (await card(A, 'Emeritus of Ideation')).prep && z.ex.includes('Ancestral Recall'), `exiled 8 (gy ${g0}→${z.gy.length}); prepared`);
      await A.evaluate(() => { S.ex = S.ex.filter(e => e.prepOf == null); const c = S.bf.find(x => cname(x) === 'Emeritus of Ideation'); delete c.prep; S.lib.push(...S.gy.splice(0, S.gy.length)); S.lib.push(...S.ex.filter(e => e.prepOf == null && !e.tok)); S.ex = S.ex.filter(e => e.prepOf != null); commit(); });
      await run(A, 'Emeritus of Ideation', 'You may exile eight cards from your graveyard. If you do, ~ becomes prepared.');
      check(!(await card(A, 'Emeritus of Ideation')).prep, 'with an empty graveyard it does not become prepared');
    });
    await step('Emeritus of Truce: Kim creates the Inkling; Kim now has more creatures → prepared', async () => {
      await reset2(); await put(B, 'Grizzly Bears'); await sleep(600); await A.evaluate(() => { window.__tgt = 'Kim'; });
      await put(A, 'Emeritus of Truce'); await settle(); await sleep(1500); await settle();
      const zb = await zones(B); check(zb.bf.some(n => /Inkling/.test(n)), `Kim got the Inkling (${zb.bf.join(',')})`);
      check((await card(A, 'Emeritus of Truce')).prep, 'Emeritus of Truce became prepared (Kim controls more creatures)');
    });
    await step('Stensian Sanguinist: the deathtouch creature deals combat damage to a player this combat → prepared', async () => {
      await reset2(); await put(A, 'Stensian Sanguinist'); await put(A, 'Grizzly Bears');
      const bid = (await card(A, 'Grizzly Bears')).id; const bk = await A.evaluate(id => S.bf.find(b => b.id === id).k, bid);
      await run(A, 'Stensian Sanguinist', 'Target creature gains deathtouch until end of turn. Whenever that creature deals combat damage to a player this combat, ~ becomes prepared.', {tgts:[[{t:'card', pid:GEO, id:bid, k:bk, nm:'Grizzly Bears'}]]}).then(r => console.log('    run:', r));
      check(!(await card(A, 'Stensian Sanguinist')).prep, 'not prepared yet'); console.log('   ', JSON.stringify(await A.evaluate(() => [S.f27sang, S.bf.map(cname), S.log.slice(-4).map(e => e.s)])));
      await A.evaluate(([bid, kim]) => { const c = S.bf.find(b => b.id === bid); emit({type:'cdmg', k:c.k, id:c.id, dp:kim, amt:2}); }, [bid, KIM]); await settle(); await sleep(400);
      check((await card(A, 'Stensian Sanguinist')).prep, 'prepared after the Bears hit Kim');
    });
    await step('Thing in the Ice: the last ice counter comes off → it transforms → Awoken Horror bounces all non-Horror creatures', async () => {
      await reset2(); await put(B, 'Grizzly Bears'); await put(A, 'Llanowar Elves'); await put(A, 'Thing in the Ice'); await sleep(600);
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Thing in the Ice'); c.nc = {ice:1}; c.co = 1; commit(); });
      await toHand(A, 'Opt'); await A.evaluate(() => { S.pool = {...emptyPool(), U:1}; commit(); }); check(await cast(A, 'Opt') === 'ok', 'cast Opt');
      await settle(); await sleep(1500); await settle(); await sleep(800);
      const c = await card(A, 'Awoken Horror'); check(c && c.fl, `transformed into Awoken Horror (${JSON.stringify(c)})`);
      const za = await zones(A), zb = await zones(B);
      check(za.hand.includes('Llanowar Elves') && zb.hand.includes('Grizzly Bears'), `non-Horror creatures went back to their owners' hands (A bf ${za.bf.join(',')} / B bf ${zb.bf.join(',')})`);
      const kimLog = await B.evaluate(() => S.log.slice(-20).map(e => e.s).join(' | '));
      check(!/Awoken Horror.*enters|entered/.test(kimLog), 'Kim saw a transform, not an enter');
    });
    await step('Ojer Taq / Ojer Pakpatiq die → return tapped and transformed (Pakpatiq with three time counters)', async () => {
      await reset2(); await put(A, 'Ojer Pakpatiq, Deepest Epoch'); await put(A, 'Ojer Taq, Deepest Foundation');
      await A.evaluate(() => { for (const n of ['Ojer Pakpatiq, Deepest Epoch', 'Ojer Taq, Deepest Foundation']){ const c = S.bf.find(x => cname(x) === n); destroyCard(c); } commit(); });
      await settle(); await sleep(800); await settle();
      const t = await card(A, 'Temple of Cyclical Time'), t2 = await card(A, 'Temple of Civilization');
      check(t && t.fl && t.tap && t.nc.time === 3, `Temple of Cyclical Time, tapped, 3 time counters (${JSON.stringify(t)})`);
      check(t2 && t2.fl && t2.tap, `Temple of Civilization, tapped (${JSON.stringify(t2)})`);
    });
    await step('Ojer Pakpatiq: an instant cast from hand gains rebound (exiled, offered again next upkeep)', async () => {
      await reset2(); await put(A, 'Ojer Pakpatiq, Deepest Epoch'); await toHand(A, 'Opt'); await A.evaluate(() => { S.pool = {...emptyPool(), U:1}; commit(); });
      check(await cast(A, 'Opt') === 'ok', 'cast Opt'); await settle(); await sleep(600); await settle();
      const z = await zones(A); const reb = await A.evaluate(() => (S.r19reb || []).map(x => cname(find(x.id)[2])));
      check(z.ex.includes('Opt') && !z.gy.includes('Opt') && reb.includes('Opt'), `Opt exiled with rebound (ex ${z.ex.join(',')}; rebound ${reb.join(',')})`);
      await A.evaluate(() => { S.r19reb = []; commit(); });
    });
    await step('Journey to Eternity: enchanted creature dies → it returns, then Journey returns as Atzal, Cave of Eternity', async () => {
      await reset2(); await put(A, 'Grizzly Bears'); await put(A, 'Journey to Eternity');
      await A.evaluate(() => { const b = S.bf.find(x => cname(x) === 'Grizzly Bears'); const j = S.bf.find(x => cname(x) === 'Journey to Eternity'); j.att = {pid:MYPID, id:b.id}; commit(); destroyCard(b); commit(); });
      await settle(); await sleep(1000); await settle();
      const z = await zones(A); check(z.bf.includes('Grizzly Bears') && z.bf.includes('Atzal, Cave of Eternity'), `Bears back and Atzal on the battlefield (${z.bf.join(',')})`);
    });
    await step('Esper Origins cast with flashback: onto the battlefield transformed with a finality counter', async () => {
      await reset2(); await toZone(A, 'Esper Origins', 'gy'); await A.evaluate(() => { S.pool = {...emptyPool(), G:4}; commit(); });
      const r = await A.evaluate(async () => { const c = S.gy.find(x => cname(x) === 'Esper Origins'); const g = gyOptions(c).find(o => o.kind === 'flashback'); if (!g) return 'no flashback'; await castFromGy(c, g); return S.gy.includes(c) ? 'not cast' : 'ok'; });
      check(r === 'ok', `flashback cast: ${r}`); await settle(); await sleep(800); await settle();
      const c = await card(A, 'Summon: Esper Maduin'); check(c && c.fl && (c.nc.finality || 0) === 1, `Summon: Esper Maduin with a finality counter (${JSON.stringify(c)})`);
    });
    await step('The Argent Etchings chapter I: incubate 2 five times, then all Incubators transform', async () => {
      await reset2(); await put(A, 'Elesh Norn'); await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Elesh Norn'); c.fl = true; commit(); });
      await run(A, 'Elesh Norn', 'Incubate 2 five times, then transform all Incubator tokens you control.');
      const r = await A.evaluate(() => S.bf.filter(c => c.tok && /Phyrexian/.test(cname(c))).map(c => [c.n || 1, c.cp || 0]));
      const n = r.reduce((a, x) => a + x[0], 0); check(n === 5 && r.every(x => x[1] === 2), `five 2-counter Phyrexian tokens (${JSON.stringify(r)})`);
    });
    await step("Elesh Norn: Kim's Lightning Bolt hits Georges → Kim loses 2 life unless she pays {1} (she has no mana)", async () => {
      await reset2(); await put(A, 'Elesh Norn'); await sleep(600);
      await B.evaluate(() => { S.bf.forEach(b => { if (manaAbs(b).length) b.tap = true; }); S.pool = {...emptyPool(), R:1}; window.__tgt = 'Georges'; commit(); });
      await toHand(B, 'Lightning Bolt'); check(await cast(B, 'Lightning Bolt') === 'ok', 'Kim casts Lightning Bolt at Georges');
      await settle(); await sleep(2500); await settle(); await sleep(1500);
      const la = (await zones(A)).life, lb = (await zones(B)).life; check(la === 37 && lb === 38, `Georges 37, Kim 38 (${la}/${lb})`);
    });
    await step('Zenos yae Galvus: chosen creature spared from -2/-2; it leaves → Zenos transforms; Shinryu chooses Kim; Kim loses → Georges wins', async () => {
      await reset2(); await put(B, 'Grizzly Bears'); await put(B, 'Elvish Mystic'); await put(A, 'Llanowar Elves'); await sleep(800);
      await A.evaluate(() => { window.__want = 'Grizzly'; }); await put(A, 'Zenos yae Galvus'); await settle(); await sleep(1500); await settle(); await sleep(800);
      const za = await zones(A), zb = await zones(B);
      check(!za.bf.includes('Llanowar Elves') && !zb.bf.includes('Elvish Mystic') && zb.bf.includes('Grizzly Bears'), `Elves and Mystic died, Bears spared (A ${za.bf.join(',')} / B ${zb.bf.join(',')})`);
      await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); destroyCard(c); commit(); }); await sleep(1500); await settle(); await sleep(800);
      const s = await card(A, 'Shinryu, Transcendent Rival'); check(s && s.fl, `Zenos transformed into Shinryu (${JSON.stringify(s)})`);
      check(await A.evaluate(kim => S.bf.some(c => c.f27opp === kim), KIM), 'Shinryu chose Kim');
      await B.evaluate(() => { S.life = 0; commit(); }); await sleep(1500); await settle(); await sleep(500);
      check(/wins the game/.test(await A.evaluate(() => S.log.slice(-12).map(e => e.s).join(' | '))), 'Kim lost → Georges wins the game');
      await B.evaluate(() => { S.life = 40; S.lost = ''; commit(); });
    });
    await step('Starscream, Seeker Leader: becoming the monarch converts it', async () => {
      await reset2(); await put(A, 'Starscream, Power Hungry'); await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Starscream, Power Hungry'); c.fl = true; S.mon = 0; S.f27monH = 0; commit(); });
      await B.evaluate(() => { S.mon = 0; commit(); }); await sleep(500);
      await A.evaluate(() => { becomeMonarch('test'); }); await settle(); await sleep(500);
      const c = await card(A, 'Starscream, Power Hungry'); check(c && !c.fl, `converted back to Starscream, Power Hungry (${JSON.stringify(c)})`);
    });
    await step('Cryptolith Fragment: each player at 10 or less → transforms at upkeep; Search for Azcanta with 7 cards in graveyard', async () => {
      await reset2(); await put(A, 'Cryptolith Fragment'); await put(A, 'Search for Azcanta');
      for (const p of [A, B]) await p.evaluate(() => { S.life = 10; commit(); }); await sleep(600);
      await A.evaluate(() => { S.lib.slice(0, 7).forEach(c => moveCard(c.id, 'gy', {quiet:true})); commit(); });
      await A.evaluate(() => { fireSteps('upkeep', MYPID); commit(); }); await settle(); await sleep(800); await settle();
      check(!!(await card(A, 'Aurora of Emrakul')), 'Cryptolith Fragment became Aurora of Emrakul');
      check(!!(await card(A, 'Azcanta, the Sunken Ruin')), 'Search for Azcanta became Azcanta, the Sunken Ruin');
      for (const p of [A, B]) await p.evaluate(() => { S.life = 40; commit(); });
    });
    await step("Hadana's Climb: third +1/+1 counter at beginning of combat → Winged Temple of Orazca", async () => {
      await reset2(); await put(A, 'Grizzly Bears'); await put(A, "Hadana's Climb"); await A.evaluate(() => { const b = S.bf.find(x => cname(x) === 'Grizzly Bears'); b.cp = 2; window.__tgt = 'Grizzly'; commit(); });
      await A.evaluate(() => { fireSteps('combat', MYPID); commit(); }); await settle(); await sleep(800); await settle();
      check((await card(A, 'Grizzly Bears')).cp === 3 && !!(await card(A, 'Winged Temple of Orazca')), "Bears at 3 counters; Hadana's Climb transformed");
    });
    await step('Dowsing Device: transforms when the fourth artifact enters', async () => {
      await reset2(); await A.evaluate(() => { window.__tgt = 'Grizzly'; }); await put(A, 'Grizzly Bears'); await put(A, 'Dowsing Device'); await put(A, 'Sol Ring'); await settle(); await sleep(400);
      check(!(await card(A, 'Geode Grotto')), 'two artifacts: not yet');
      await put(A, 'Memnite'); await settle(); await put(A, 'Ornithopter'); await settle(); await sleep(800); await settle();
      check(!!(await card(A, 'Geode Grotto')), 'four artifacts: Dowsing Device became Geode Grotto');
    });
    await step('Aang: another creature leaves → transform at the beginning of the next upkeep', async () => {
      await reset2(); await put(A, 'Grizzly Bears'); await put(A, 'Aang, at the Crossroads'); await settle(); await sleep(400);
      await A.evaluate(() => { const b = S.bf.find(x => cname(x) === 'Grizzly Bears'); destroyCard(b); commit(); }); await settle(); await sleep(500);
      check(!(await card(A, 'Aang, Destined Savior')), 'not transformed yet');
      await A.evaluate(() => { fireSteps('upkeep', MYPID); commit(); }); await settle(); await sleep(800); await settle();
      check(!!(await card(A, 'Aang, Destined Savior')), 'transformed at the upkeep');
    });
    await step('Ashling: paying {U} transforms it; the Rimebound transform trigger adds two mana of one color; Brigid-style enter-or-transform', async () => {
      await reset2(); await put(A, 'Ashling, Rekindled'); await settle(); await A.evaluate(() => { window.__want = 'Red|^R'; S.pool = emptyPool(); commit(); });
      await run(A, 'Ashling, Rekindled', 'Transform ~.'); await settle(); await sleep(600); await settle();
      const pool = await A.evaluate(() => poolTotal(S.pool)); check(!!(await card(A, 'Ashling, Rimebound')) && pool === 2, `Rimebound with 2 mana in pool (${pool})`);
      await A.evaluate(() => { S.pool = emptyPool(); commit(); });
    });
    await step('Sidequest: Raise a Chocobo → Black Chocobo transform trigger fetches a land', async () => {
      await reset2(); await put(A, 'Sidequest: Raise a Chocobo'); await settle();
      const l0 = await A.evaluate(() => S.bf.filter(c => isLand(c.k)).length); await A.evaluate(() => { window.__want = 'Forest|Mountain|Island'; });
      await run(A, 'Sidequest: Raise a Chocobo', 'Transform ~.'); await settle(); await sleep(800); await settle();
      const l1 = await A.evaluate(() => S.bf.filter(c => isLand(c.k)).length); check(!!(await card(A, 'Black Chocobo')) && l1 === l0 + 1, `Black Chocobo; lands ${l0}→${l1}`);
    });
    await step('The Myriad Pools: a permanent spell paid with its mana → another permanent becomes a copy until end of turn', async () => {
      await reset2(); await put(A, 'Grizzly Bears'); await put(A, 'The Everflowing Well'); await settle(); await sleep(300);
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'The Everflowing Well'); c.fl = true; c.tap = false; S.bf.forEach(b => { if (b !== c && manaAbs(b).length) b.tap = true; }); S.pool = emptyPool(); window.__tgt = 'Grizzly'; commit(); });
      await toHand(A, 'Sol Ring'); check(await cast(A, 'Sol Ring') === 'ok', 'Sol Ring cast with The Myriad Pools\' mana');
      await settle(); await sleep(800); await settle();
      const z = await zones(A); check(z.bf.filter(n => n === 'Sol Ring').length === 2 && !z.bf.includes('Grizzly Bears'), `Grizzly Bears is a Sol Ring until end of turn (${z.bf.join(',')})`);
      await reset2(); await put(A, 'Llanowar Elves'); await put(A, 'The Everflowing Well'); await put(A, 'Sol Ring');
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'The Everflowing Well'); c.fl = true; c.tap = true; S.pool = {...emptyPool(), C:1}; commit(); });
      await settle(); await toHand(A, 'Ornithopter'); check(await cast(A, 'Ornithopter') === 'ok', 'Ornithopter cast without the Pools'); await settle(); await sleep(500);
      check((await zones(A)).bf.includes('Llanowar Elves') && !(await A.evaluate(() => stackAll().length)), 'no copy without its mana');
    });
    await step('Fable of the Mirror-Breaker III: exile the Saga, then it returns transformed (a real exile: leaves-the-battlefield event)', async () => {
      await reset2(); await put(A, 'Fable of the Mirror-Breaker'); await settle(); await sleep(300);
      await A.evaluate(() => { window.__lv = 0; const he = handleEvent; window.__he = he; handleEvent = function(pid, ev){ if (ev && ev.type === 'leave') window.__lv++; return he(pid, ev); }; });
      await run(A, 'Fable of the Mirror-Breaker', 'Exile this Saga, then return it to the battlefield transformed under your control.'); await settle(); await sleep(400);
      const c = await card(A, 'Reflection of Kiki-Jiki'); const lv = await A.evaluate(() => { handleEvent = window.__he; return window.__lv; });
      check(c && c.fl && !(await A.evaluate(() => S.bf.find(x => (faceOf(x) || {}).n === 'Reflection of Kiki-Jiki').lore || 0)), `Reflection of Kiki-Jiki, no lore counters (${JSON.stringify(c)})`);
      check(lv >= 1, `it really left the battlefield (${lv} leave events)`);
    });
    await step('Ral, Monsoon Mage won flip: exile him → he returns transformed as Ral, Leyline Prodigy; declining keeps him', async () => {
      await reset2(); await put(A, 'Ral, Monsoon Mage'); await A.evaluate(() => { window.__no = true; });
      await run(A, 'Ral, Monsoon Mage', 'You may exile Ral. If you do, return him to the battlefield transformed under his owner\'s control.'); await settle();
      check(!!(await card(A, 'Ral, Monsoon Mage')), 'declined: Ral stays front face up');
      await A.evaluate(() => { window.__no = false; });
      await run(A, 'Ral, Monsoon Mage', 'You may exile Ral. If you do, return him to the battlefield transformed under his owner\'s control.'); await settle(); await sleep(400);
      const c = await card(A, 'Ral, Leyline Prodigy'); check(c && c.fl, `Ral, Leyline Prodigy on the battlefield (${JSON.stringify(c)})`);
    });
    await step('Thousand Moons Smithy: tap five artifacts/creatures → transforms (needs helper D)', async () => {
      if (!(await A.evaluate(() => typeof d27UntilNext === 'function'))){ console.log('    (skipped: engine27d not in this build)'); return; }
      await reset2(); for (const n of ['Sol Ring', 'Memnite', 'Ornithopter', 'Llanowar Elves', 'Grizzly Bears', 'Thousand Moons Smithy']) await put(A, n); await settle(); await sleep(300);
      await A.evaluate(() => { S.bf.forEach(c => { c.tap = false; }); commit(); });
      await run(A, 'Thousand Moons Smithy', 'You may tap five untapped artifacts and/or creatures you control. If you do, transform Thousand Moons Smithy.'); await settle(); await sleep(400);
      check(!!(await card(A, 'Barracks of the Thousand')), 'Smithy became Barracks of the Thousand');
      await reset2(); await put(A, 'Sol Ring'); await put(A, 'Thousand Moons Smithy'); await settle();
      await run(A, 'Thousand Moons Smithy', 'You may tap five untapped artifacts and/or creatures you control. If you do, transform Thousand Moons Smithy.'); await settle(); await sleep(400);
      check(!!(await card(A, 'Thousand Moons Smithy')), 'only three untapped: it stays a Smithy');
    });
    await step('Day/night: Outland Liberator makes it day; Georges casts nothing → night at Kim\'s untap (Liberator transforms; Duskwatch transforms); Kim casts two → day again', async () => {
      await reset2(); await put(A, 'Outland Liberator'); await put(A, 'Duskwatch Recruiter'); await sleep(1500);
      check(await B.evaluate(() => f27dnNow()) === 'day', 'it became day (Kim sees it too)');
      check(await A.evaluate(() => { const c = S.bf.find(x => info(x.k)?.n === 'Outland Liberator'); return { a: !!c && !c.fl, b: (() => { const r = []; return r; })() }.a; }), 'Liberator is front face up');
      const blocked = await A.evaluate(async () => { const c = S.bf.find(x => info(x.k)?.n === 'Outland Liberator'); await runEffects('Transform ~.', {k:c.k, name:'test', srcId:c.id, it:{kind:'ability'}}); return !c.fl; });
      check(blocked, "an outside 'transform' can't flip a daybound permanent");
      // earlier steps cast spells this turn; start the day/night history fresh on both clients
      for (const p of [A, B]) await p.evaluate(() => { S.f27cc = {}; commit(); }); await sleep(800);
      await A.evaluate(() => passTurn()); await waitFor(B, () => currentTurn()[1] === MYPID, null, 10000); await sleep(2500); await settle(); await sleep(1500); await settle();
      check(await B.evaluate(() => f27dnNow()) === 'night', 'night: Georges cast no spells on his turn');
      const lib = await card(A, 'Frenzied Trapbreaker'); check(lib && lib.fl, `Outland Liberator transformed into Frenzied Trapbreaker (${JSON.stringify(lib)})`);
      check(!!(await card(A, 'Krallenhorde Howler')), 'Duskwatch Recruiter transformed at the upkeep (no spells last turn)');
      await B.evaluate(() => { S.bf.forEach(b => { if (manaAbs(b).length) b.tap = true; }); S.pool = {...emptyPool(), U:2}; commit(); });
      await toHand(B, 'Opt'); await cast(B, 'Opt'); await settle(); await sleep(400); await toHand(B, 'Divination'); await B.evaluate(() => { S.pool = {...emptyPool(), U:3}; commit(); }); await cast(B, 'Divination'); await settle(); await sleep(400);
      await B.evaluate(() => passTurn()); await waitFor(A, () => currentTurn()[1] === MYPID, null, 10000); await sleep(2500); await settle(); await sleep(1500); await settle();
      check(await A.evaluate(() => f27dnNow()) === 'day', 'day again: Kim cast two spells on her turn');
      const l2 = await card(A, 'Outland Liberator'); check(l2 && !l2.fl, 'Frenzied Trapbreaker transformed back');
      check(!!(await card(A, 'Duskwatch Recruiter')), 'Krallenhorde Howler transformed back (a player cast two spells last turn)');
    });
    await step("Slicer: at Kim's upkeep Georges gives it to her until end of turn — untapped, goaded, can't be sacrificed", async () => {
      await reset2(); await put(A, 'Slicer, Hired Muscle'); await A.evaluate(() => { S.bf.find(x => cname(x) === 'Slicer, Hired Muscle').tap = true; commit(); }); await sleep(500);
      await A.evaluate(() => passTurn()); await waitFor(B, () => currentTurn()[1] === MYPID, null, 10000); await sleep(2500); await settle(); await sleep(2000); await settle();
      const c = await card(B, 'Slicer, Hired Muscle'); check(c && c.own && !c.tap && c.goad, `Kim controls Slicer, untapped and goaded (${JSON.stringify(c)})`);
      check(await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Slicer, Hired Muscle'); return v25noSac(c); }), "Slicer can't be sacrificed this turn");
      await B.evaluate(() => passTurn()); await waitFor(A, () => currentTurn()[1] === MYPID, null, 10000); await sleep(2500); await settle();
      check(!!(await card(A, 'Slicer, Hired Muscle')), 'Slicer came back to Georges at end of turn');
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
