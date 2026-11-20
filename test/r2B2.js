process.env.TOP = '1';
// Round 26 B2: long-tail cards (ranks 3301–5080) played in a real 2-player game (Georges vs Kim)
const CC = require('./cards');
const WANT = ["Olórin's Searing Light", 'Nicol Bolas, Dragon-God', 'Burning-Rune Demon', 'Bringer of the Last Gift', "Sphinx's Tutelage", 'Portent', 'The Book of Exalted Deeds', 'Goldberry, River-Daughter',
  'New Blood', 'Reins of Power', 'Oubliette', 'The Irencrag', 'Yes Man, Personal Securitron', 'Combat Calligrapher', 'Zara, Renegade Recruiter', 'Displaced Dinosaurs', 'Khârn the Betrayer', 'Karmic Justice',
  'Spirit Water Revival', 'Verity Circle', 'Satoru, the Infiltrator', 'Flickering Ward', 'Walking Bulwark', 'Bonny Pall, Clearcutter', 'Sin, Unending Cataclysm', 'Assault Suit',
  'Grizzly Bears', 'Llanowar Elves', 'Giant Growth', 'Lightning Bolt', 'Mind Stone', 'Elvish Mystic', 'Wall of Omens', 'Darksteel Ingot', 'Swords to Plowshares', 'Counterspell', 'Swords to Plowshares', 'Baneslayer Angel', 'Craterhoof Behemoth', 'Sol Ring'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { window.__want = window.__want || null; window.__tgt = window.__tgt || null; window.__num = null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ if (!window.__tgt) return; const re = new RegExp(window.__tgt, 'i'); const c = (m.cands || []).find(x => x.ok && re.test(x.nm)); if (!c) return; m.__done = 1; m.resolve([c]); closeModal(); }
    else if (m.run){ m.__done = 1; const d = window.__num != null ? window.__num : (m.def ?? 1); m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const toHand = (p, n) => p.evaluate(n => { for (const z of ['lib', 'gy', 'ex', 'bf']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.hand.push(c); commit(); return c.id; } } return S.hand.find(c => cname(c) === n)?.id; }, n);
const toZone = (p, n, z) => p.evaluate(([n, z]) => { for (const y of ['lib', 'hand', 'gy', 'ex', 'bf']){ const i = S[y].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[y].splice(i, 1); reset(c); S[z].push(c); commit(); return c.id; } } return null; }, [n, z]);
const cast = (p, n, pool) => p.evaluate(async ([n, pool]) => { const c = S.hand.find(x => cname(x) === n); if (!c) return 'not in hand'; S.pool = {...emptyPool(), ...(pool || {W:6, U:6, B:6, R:6, G:6, C:6})}; commit(); await beginCast(c, 'hand'); return S.hand.includes(c) ? 'not cast' : 'ok'; }, [n, pool]);
const toGy = (p, n) => p.evaluate(n => { const c = S.bf.find(x => cname(x) === n); if (c){ moveCard(c.id, 'gy', {quiet:true}); commit(); return true; } return false; }, n);
const activate = (p, n, re) => p.evaluate(async ([n, re]) => { const c = S.bf.find(x => cname(x) === n); if (!c) return 'missing'; c.sk = false; c.tap = false; S.pool = {...emptyPool(), W:6, U:6, B:6, R:6, G:6, C:6}; const ab = abilityList(c).find(a => new RegExp(re, 'i').test(a.eff)); if (!ab) return 'no ability'; await activateAbility(c, ab); return 'ok'; }, [n, re]);
const run = (p, txt, nm, extra) => p.evaluate(async ([txt, nm, extra]) => { const k = [...DICT.values()].find(a => a.n === nm)?.k || null; const src = S.bf.find(c => c.k === k) || S.gy.find(c => c.k === k); const ctx = {k, name:nm, full:txt, srcId:src ? src.id : null, ...(extra || {})}; if (ctx.tgtKim){ const [pid] = [...OPP.keys()]; ctx.tgts = [[{t:'player', pid, nm:nameOf(pid)}]]; } if (ctx.itX != null) ctx.it = {kind:'ability', x:ctx.itX}; await runEffects(txt, ctx); commit(); return 'ok'; }, [txt, nm, extra]);
if (process.env.W2DBG) process.on('unhandledRejection', e => console.log('UR', e));
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { await T(60000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
const runT = (p, txt, nm, tg, it) => p.evaluate(async ([txt, nm, tg, it]) => { const a = [...DICT.values()].find(x => x.n === nm); const k = a ? a.k : null; const src = S.bf.find(c => c.k === k) || S.gy.find(c => c.k === k);
  const kim = [...OPP.keys()][0]; const tgts = (tg || []).map(g => g.map(t => { if (t === 'kim') return {t:'player', pid:kim, nm:nameOf(kim)}; if (t === 'me') return {t:'player', pid:MYPID, nm:nameOf(MYPID)}; const [who, n] = t.split(':'); const bf = who === 'kim' ? (OPP.get(kim)?.bf || []) : S.bf; const c = bf.find(x => x.k && info(x.k)?.n === n); return c ? {t:'card', pid:who === 'kim' ? kim : MYPID, id:c.id, k:c.k, nm:n} : null; }).filter(Boolean));
  const ctx = {k, name:nm, full:txt, srcId:src ? src.id : null, tgts, it:{kind:'ability', sid:rid(6), ...(it || {})}}; if (it && it.evPidKim) ctx.it.evPid = kim; if (it && it.evDpKim) ctx.it.evDp = kim;
  await runEffects(txt, ctx); commit(); return 'ok'; }, [txt, nm, tg, it]);
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2b2');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2b2');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const put = (p, name) => p.evaluate(n => { for (const z of ['lib', 'hand', 'gy', 'ex']){ const c = S[z].find(c => cname(c) === n); if (c){ moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id); if (b) b.sk = false; commit(); return true; } } return false; }, name);
  const cnt = (p, re) => p.evaluate(re => S.bf.filter(c => new RegExp(re).test(cname(c))).reduce((a, c) => a + (c.n || 1), 0), re);
  const has = (p, z, n) => p.evaluate(([z, n]) => S[z].some(c => cname(c) === n), [z, n]);
  const after = async () => { await sleep(500); await settle([A, B]); await sleep(1200); await settle([A, B]); await sleep(500); };
  const hand = p => p.evaluate(() => S.hand.length);
  const clear = async () => { for (const p of [A, B]) await p.evaluate(() => { S.bf.filter(c => !isLand(c.k)).forEach(c => moveCard(c.id, 'gy', {quiet:true})); S.stk = []; commit(); }); await after(); await after(); };
  try {
    await step("Olórin's Searing Light: Kim exiles her most powerful creature and takes that much damage (spell mastery)", async () => {
      await put(B, 'Baneslayer Angel'); await put(B, 'Grizzly Bears'); await toZone(A, 'Lightning Bolt', 'gy'); await toZone(A, 'Giant Growth', 'gy'); await toHand(A, "Olórin's Searing Light"); await after();
      const l0 = await B.evaluate(() => S.life); check(await cast(A, "Olórin's Searing Light") === 'ok', 'cast it'); await after(); await sleep(1500); await after();
      check(await has(B, 'ex', 'Baneslayer Angel') && await has(B, 'bf', 'Grizzly Bears'), 'Kim exiled Baneslayer Angel (the greatest power) and kept Grizzly Bears');
      check(await B.evaluate(() => S.life) === l0 - 5, 'Kim took 5 damage (Baneslayer Angel\'s power)');
    });
    await step('Nicol Bolas, Dragon-God: +1 makes Kim exile a card; −8 makes Kim (no legends) lose', async () => {
      await put(A, 'Nicol Bolas, Dragon-God'); await after(); const h0 = await hand(A); const n0 = await B.evaluate(() => S.hand.length + S.bf.length);
      await runT(A, 'You draw a card. Each opponent exiles a card from their hand or a permanent they control.', 'Nicol Bolas, Dragon-God'); await after(); await sleep(1500); await after();
      check(await hand(A) === h0 + 1, 'Georges drew a card'); check(await B.evaluate(() => S.hand.length + S.bf.length) === n0 - 1, 'Kim exiled a card from hand or battlefield');
      await runT(A, "Each opponent who doesn't control a legendary creature or planeswalker loses the game.", 'Nicol Bolas, Dragon-God'); await after();
      check(await B.evaluate(() => !!S.lost), 'Kim lost the game'); await B.evaluate(() => { S.lost = ''; S.g23lost = 0; commit(); });
      await put(B, 'Khârn the Betrayer'); await after();
      await runT(A, "Each opponent who doesn't control a legendary creature or planeswalker loses the game.", 'Nicol Bolas, Dragon-God'); await after();
      check(await B.evaluate(() => !S.lost), 'with a legendary creature Kim does not lose'); await clear();
    });
    await step('Burning-Rune Demon: two different cards, Kim picks which goes to hand', async () => {
      await toZone(A, 'Counterspell', 'lib'); await toZone(A, 'Swords to Plowshares', 'lib'); await A.evaluate(() => { window.__want = 'Counterspell|Swords to Plowshares'; });
      await put(A, 'Burning-Rune Demon'); await after(); await sleep(1500); await after(); await A.evaluate(() => { window.__want = null; });
      const r = await A.evaluate(() => ({h:S.hand.filter(c => /Counterspell|Swords to Plowshares/.test(cname(c))).map(cname), g:S.gy.filter(c => /Counterspell|Swords to Plowshares/.test(cname(c))).map(cname)}));
      check(r.h.length === 1 && r.g.length === 1 && r.h[0] !== r.g[0], `one went to hand, the other to the graveyard (${JSON.stringify(r)})`); await clear();
    });
    await step('Bringer of the Last Gift: everyone sacrifices, then returns the creatures that were already in the graveyard', async () => {
      await put(A, 'Grizzly Bears'); await toZone(A, 'Wall of Omens', 'gy'); await put(B, 'Llanowar Elves'); await toZone(B, 'Elvish Mystic', 'gy'); await toHand(A, 'Bringer of the Last Gift'); await after();
      check(await cast(A, 'Bringer of the Last Gift') === 'ok', 'cast Bringer'); await after(); await sleep(1500); await after();
      check(await has(A, 'gy', 'Grizzly Bears') && await has(A, 'bf', 'Wall of Omens') && await has(A, 'bf', 'Bringer of the Last Gift'), 'Georges: Bears sacrificed, Wall of Omens returned, Bringer stays');
      check(await has(B, 'gy', 'Llanowar Elves') && await has(B, 'bf', 'Elvish Mystic'), 'Kim: Llanowar Elves sacrificed, Elvish Mystic returned'); await clear();
    });
    await step("Sphinx's Tutelage makes Kim mill; Portent reorders Kim's top three", async () => {
      await put(A, "Sphinx's Tutelage"); const g0 = await B.evaluate(() => S.gy.length);
      await runT(A, 'Target opponent mills two cards. If two nonland cards that share a color were milled this way, repeat this process.', "Sphinx's Tutelage", [['kim']]); await after(); await sleep(1000);
      check(await B.evaluate(() => S.gy.length) >= g0 + 2, 'Kim milled at least two cards');
      const top0 = await B.evaluate(() => S.lib.slice(0, 3).map(c => c.id).sort().join()); await A.evaluate(() => { window.__want = "Don't"; });
      await runT(A, "Look at the top three cards of target player's library, then put them back in any order. You may have that player shuffle.", 'Portent', [['kim']]); await after(); await sleep(1500); await after(); await A.evaluate(() => { window.__want = null; });
      check(await B.evaluate(() => S.lib.slice(0, 3).map(c => c.id).sort().join()) === top0 && await B.evaluate(() => !S.pile), "Kim's top three are the same cards (reordered, not shuffled) and the shared pile was cleared"); await clear();
    });
    await step("The Book of Exalted Deeds: the Angel's controller can't lose", async () => {
      await put(A, 'Baneslayer Angel'); await put(A, 'The Book of Exalted Deeds'); await after();
      await runT(A, 'Put an enlightened counter on target Angel. It gains "You can\'t lose the game and your opponents can\'t win the game."', 'The Book of Exalted Deeds', [['me:Baneslayer Angel']]); await after();
      const L = await A.evaluate(() => S.life); await A.evaluate(() => { S.life = -3; sba(); commit(); });
      check(await A.evaluate(() => !S.lost), 'Georges at −3 life has not lost'); await A.evaluate(L => { S.life = L; commit(); }, L); await clear();
    });
    await step('Goldberry moves counters both ways', async () => {
      await put(A, 'Goldberry, River-Daughter'); await put(A, 'Grizzly Bears'); await A.evaluate(() => { const g = S.bf.find(c => cname(c) === 'Grizzly Bears'); g.cp = 2; addNamed(g, 'shield', 1); commit(); });
      await runT(A, 'Move a counter of each kind not on Goldberry, River-Daughter from another target permanent you control onto Goldberry, River-Daughter.', 'Goldberry, River-Daughter', [['me:Grizzly Bears']]); await after();
      const r = await A.evaluate(() => { const g = S.bf.find(c => cname(c) === 'Goldberry, River-Daughter'); const b = S.bf.find(c => cname(c) === 'Grizzly Bears'); return [g.cp || 0, (g.nc || {}).shield || 0, b.cp, (b.nc || {}).shield || 0]; });
      check(r.join() === '1,1,1,0', `one +1/+1 and one shield counter moved (${r})`);
      const h0 = await hand(A); await A.evaluate(() => { window.__num = 1; });
      await runT(A, 'Move one or more counters from Goldberry, River-Daughter onto another target permanent you control. If you do, draw a card.', 'Goldberry, River-Daughter', [['me:Grizzly Bears']]); await after(); await A.evaluate(() => { window.__num = null; });
      check(await hand(A) === h0 + 1, 'moved counters back and drew a card'); await clear();
    });
    await step('New Blood steals a creature and makes it a Vampire; Reins of Power swaps creatures', async () => {
      await put(B, 'Grizzly Bears'); await after();
      await runT(A, 'Gain control of target creature. Change the text of that creature by replacing all instances of one creature type with Vampire.', 'New Blood', [['kim:Grizzly Bears']]); await after(); await sleep(1500); await after();
      check(await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); return !!c && /Vampire/.test(typeOf(c)) && !/Bear/.test(typeOf(c)); }), 'Georges controls Grizzly Bears and it is a Vampire, not a Bear'); await clear();
      await put(A, 'Llanowar Elves'); await put(B, 'Baneslayer Angel'); await after();
      await runT(A, 'Untap all creatures you control and all creatures target opponent controls. You and that opponent each gain control of all creatures the other controls until end of turn. Those creatures gain haste until end of turn.', 'Reins of Power', [['kim']]); await after(); await sleep(1500); await after();
      check(await has(A, 'bf', 'Baneslayer Angel') && await has(B, 'bf', 'Llanowar Elves'), 'creatures swapped'); await clear();
    });
    await step('Oubliette phases out Kim\'s creature until it leaves; it phases back in tapped', async () => {
      await put(B, 'Baneslayer Angel'); await after(); await A.evaluate(() => { window.__tgt = 'Baneslayer'; });
      await put(A, 'Oubliette'); await after(); await sleep(1500); await after(); await A.evaluate(() => { window.__tgt = null; });
      check(!(await has(B, 'bf', 'Baneslayer Angel')), 'Baneslayer Angel phased out');
      await B.evaluate(() => { turnChanged && 0; }); await toGy(A, 'Oubliette'); await after(); await sleep(1500); await after();
      check(await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Baneslayer Angel'); return !!c && !!c.tap; }), 'Baneslayer Angel phased back in tapped'); await clear();
    });
    await step('The Irencrag becomes Everflame when a legendary creature enters', async () => {
      await put(A, 'The Irencrag'); await after(); await put(A, 'Khârn the Betrayer'); await after(); await sleep(800); await after();
      check(await A.evaluate(() => S.bf.some(c => cname(c) === "Everflame, Heroes' Legacy" && /Equipment/.test(typeOf(c)))), 'The Irencrag is now Everflame, Heroes\' Legacy (Equipment)');
      check(await B.evaluate(() => [...OPP.values()].some(s => (s.bf || []).some(c => c.k && info(c.k)?.n === "Everflame, Heroes' Legacy"))), 'Kim sees Everflame too'); await clear();
    });
    await step('Khârn: damage is prevented, Kim gains control, Georges draws two', async () => {
      await put(A, 'Khârn the Betrayer'); await after(); const h0 = await hand(A);
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Khârn the Betrayer'); damageCard(c, 3); commit(); }); await after(); await sleep(1500); await after();
      check(await has(B, 'bf', 'Khârn the Betrayer'), 'Kim controls Khârn'); check(await hand(A) === h0 + 2, 'Georges drew two cards'); await clear();
    });
    await step('Yes Man goes to Kim with a quest counter; when it leaves, Georges gets a tapped Soldier', async () => {
      await put(A, 'Yes Man, Personal Securitron'); await after(); const h0 = await hand(A);
      await runT(A, 'Target opponent gains control of Yes Man, Personal Securitron. When they do, you draw two cards and put a quest counter on Yes Man, Personal Securitron.', 'Yes Man, Personal Securitron', [['kim']]); await after(); await sleep(1500); await after();
      check(await has(B, 'bf', 'Yes Man, Personal Securitron') && await hand(A) === h0 + 2, 'Kim controls Yes Man; Georges drew two');
      await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Yes Man, Personal Securitron'); moveCard(c.id, 'gy'); commit(); }); await after(); await sleep(1500); await after();
      check(await A.evaluate(() => S.bf.some(c => /Soldier/.test(cname(c)) && c.tap)), 'Georges (the owner) created a tapped Soldier'); await clear();
    });
    await step('Combat Calligrapher and Zara: attacking Kim', async () => {
      await put(A, 'Combat Calligrapher'); await put(A, 'Zara, Renegade Recruiter'); await toHand(B, 'Elvish Mystic'); await after();
      await A.evaluate(() => { const kim = [...OPP.keys()][0]; const z = S.bf.find(c => cname(c) === 'Zara, Renegade Recruiter'); z.atk = 'p:' + kim; z.tap = true; emit({type:'attack', k:z.k, id:z.id, dp:kim}); commit(); });
      await A.evaluate(() => { window.__want = 'Elvish'; }); await after(); await sleep(2500); await after(); await A.evaluate(() => { window.__want = null; });
      check(await A.evaluate(() => S.bf.some(c => /Inkling/.test(cname(c)) && c.tap && /^p:/.test(c.atk || ''))), 'a tapped Inkling token entered attacking Kim');
      check(await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Elvish Mystic'); return !!c && !!c.own && /^p:/.test(c.atk || ''); }), "Zara put Kim's Elvish Mystic onto Georges's battlefield attacking Kim");
      await A.evaluate(() => fireSteps('end', MYPID)); await after(); await sleep(1500);
      check(await has(B, 'hand', 'Elvish Mystic'), 'Elvish Mystic returned to Kim\'s hand at the end step'); await clear();
    });
    await step('Displaced Dinosaurs makes an entering artifact a 7/7 Dinosaur; Karmic Justice answers Kim destroying it', async () => {
      await put(A, 'Displaced Dinosaurs'); await put(A, 'Mind Stone'); await after();
      check(await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Mind Stone'); return isCreatureCard(c) && stats(c)[0] === 7 && /Dinosaur/.test(typeOf(c)); }), 'Mind Stone is a 7/7 Dinosaur creature');
      await toGy(A, 'Displaced Dinosaurs'); await put(A, 'Karmic Justice'); await put(A, 'Sol Ring'); await put(B, 'Darksteel Ingot'); await put(B, 'Wall of Omens'); await after(); await A.evaluate(() => { window.__tgt = 'Wall of Omens'; });
      await B.evaluate(() => { const me = [...OPP.keys()][0]; const c = [...(OPP.get(me).bf || [])].find(x => x.k && info(x.k)?.n === 'Sol Ring'); sendRq(me, 'destroy', 0, 'Kim test', {tid:c.id}); commit(); }); await after(); await sleep(2000); await after(); await A.evaluate(() => { window.__tgt = null; });
      check(await has(A, 'gy', 'Sol Ring'), 'Sol Ring was destroyed'); check(await has(B, 'gy', 'Wall of Omens'), 'Karmic Justice destroyed Kim\'s Wall of Omens'); await clear();
    });
    await step('Spirit Water Revival with waterbend: shuffle graveyard in, draw seven, no maximum hand size', async () => {
      await put(A, 'Grizzly Bears'); await put(A, 'Llanowar Elves'); await toZone(A, 'Swords to Plowshares', 'gy'); await toHand(A, 'Spirit Water Revival'); await after();
      const h0 = await hand(A); check(await cast(A, 'Spirit Water Revival', {U:6, C:6}) === 'ok', 'cast it with waterbend'); await after(); await sleep(800); await after();
      check(await hand(A) === h0 - 1 + 7, `drew seven (${h0} → ${await hand(A)})`); check(await A.evaluate(() => !!S.noMax && S.gy.every(c => cname(c) !== 'Swords to Plowshares')), 'no maximum hand size; graveyard shuffled in'); await clear();
    });
    await step('Verity Circle draws when Kim taps a creature outside of attacking; Satoru draws for a creature put onto the battlefield', async () => {
      await put(A, 'Verity Circle'); await put(B, 'Llanowar Elves'); await after(); const h0 = await hand(A);
      await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Llanowar Elves'); c.tap = true; r8Tick(); commit(); }); await after(); await sleep(1500); await after();
      check(await hand(A) === h0 + 1, 'Georges drew a card');
      await put(A, 'Satoru, the Infiltrator'); await after(); await sleep(800); await after(); check(await hand(A) === h0 + 2, 'Satoru (not cast) drew a card'); await clear();
    });
    await step('Flickering Ward gives protection from the chosen color; Walking Bulwark lets a defender attack', async () => {
      await put(A, 'Wall of Omens'); await A.evaluate(() => { window.__want = 'red'; }); await put(A, 'Flickering Ward'); await A.evaluate(() => { const w = S.bf.find(c => cname(c) === 'Flickering Ward'); const h = S.bf.find(c => cname(c) === 'Wall of Omens'); w.att = {pid:MYPID, id:h.id}; commit(); }); await after(); await A.evaluate(() => { window.__want = null; });
      check(await A.evaluate(() => protFrom(S.bf.find(c => cname(c) === 'Wall of Omens')).includes('red')), 'Wall of Omens has protection from red');
      await put(A, 'Walking Bulwark'); await runT(A, "Until end of turn, target creature with defender gains haste, can attack as though it didn't have defender, and assigns combat damage equal to its toughness rather than its power.", 'Walking Bulwark', [['me:Wall of Omens']]); await after();
      check(await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Wall of Omens'); c.sk = true; return canAttack(c) === '' && toughDmg(c); }), 'Wall of Omens can attack and deals damage by toughness'); await clear();
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
