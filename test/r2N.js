process.env.TOP = '1';
// Round 24N: costs, cast permissions and mana tracking — in a real 2-player game
const CC = require('./cards');
const WANT = ['Omniscience', 'As Foretold', "Demon of Fate's Design", 'Rooftop Storm', 'Dracogenesis', "Liberator, Urza's Battlethopter", 'Quick Sliver', 'Chromatic Orrery', 'Oath of Nissa',
  'Blossoming Tortoise', "Rogue's Passage", 'Heartstone', 'Bruenor Battlehammer', 'Swiftfoot Boots', 'Skullclamp', 'Defiler of Vigor', 'Deadly Dispute', 'Vile Mutilator', 'Abhorrent Oculus',
  'Path of Annihilation', 'Brightcap Badger', 'Resonating Lute', 'Omnath, Locus of Mana', 'Kruphix, God of Horizons', 'Smaug, Wicked Worm', "Sephara, Sky's Blade", 'Inspiring Statuary',
  'Invasion of Segovia', 'Morophon, the Boundless', 'Llanowar Elves', 'Elvish Mystic', 'Lightning Bolt', 'Counterspell', 'Birds of Paradise', 'Sol Ring', 'Mind Stone', 'Shivan Dragon',
  'Gravecrawler', 'Rhystic Study', 'Eternal Witness', 'Serra Angel', 'Baneslayer Angel', 'Wall of Omens', 'Ponder', 'Brainstorm', 'Arcane Signet', 'Sliver Hivelord', 'Galerider Sliver',
  'Thran Portal', 'Wayfarer\'s Bauble', 'Lady Octopus, Inspired Inventor', 'Toxic Deluge', 'Village Rites', 'Big Score', 'Fling', 'Sunforger'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, put, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { window.__want = window.__want || null; window.__tgt = window.__tgt || null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ if (!window.__tgt) return; const re = new RegExp(window.__tgt, 'i'); const c = (m.cands || []).find(x => x.ok && re.test(x.nm)); if (!c) return; m.__done = 1; m.resolve([c]); closeModal(); }
    else if (m.run){ m.__done = 1; const d = window.__num ?? m.def ?? 1; m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const toHand = (p, n) => p.evaluate(n => { for (const z of ['lib', 'gy', 'ex', 'bf']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.hand.push(c); commit(); return c.id; } } return S.hand.find(c => cname(c) === n)?.id; }, n);
// cast with an exact pool (lands tapped so auto-pay can't help)
const castP = (p, n, pool, zone = 'hand') => p.evaluate(async ([n, pool, zone]) => { const c = S[zone].find(x => cname(x) === n); if (!c) return 'not in ' + zone; S.bf.forEach(b => { if (manaAbs(b).length && !isCreatureCard(b)) b.tap = true; }); S.pool = {...emptyPool(), ...pool}; commit(); await beginCast(c, zone); return S[zone].includes(c) ? 'not cast' : 'ok'; }, [n, pool, zone]);
const toGy = (p, n) => p.evaluate(n => { const c = S.bf.find(x => cname(x) === n); if (c){ S.bf.splice(S.bf.indexOf(c), 1); reset(c); S.gy.push(c); commit(); return true; } return false; }, n);
const clearStack = p => p.evaluate(() => { S.stk = []; commit(); });
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { await fn(); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-12).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Morophon, the Boundless'), 'host', 'r2n');
  const B = await H.player(browser, 'Kim', H.deckFor('Wall of Omens'), 'join', 'r2n');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const after = async () => { await sleep(400); await settle([A, B]); await sleep(900); await settle([A, B]); await sleep(300); };
  const onBf = (p, n) => p.evaluate(n => S.bf.some(c => cname(c) === n), n);
  try {
    await step('Omniscience: spells from hand cost nothing; Liberator sees 0 mana spent', async () => {
      await put(A, 'Omniscience'); await put(A, "Liberator, Urza's Battlethopter"); await toHand(A, 'Wall of Omens');
      if (process.env.DBG) console.log(await A.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Wall of Omens'); S.bf.forEach(b => { b.tap = true; }); S.pool = emptyPool(); return JSON.stringify({alts:altCosts(c, 'hand'), chk:castCheck(c, 'hand'), rules:rulesOn('n24free'), tm:timingOk(c)}); }));
      check(await castP(A, 'Wall of Omens', {}) === 'ok', 'Wall of Omens cast from hand with an empty pool'); await after();
      check(await onBf(A, 'Wall of Omens'), 'Wall of Omens resolved');
      const cp = await A.evaluate(() => S.bf.find(c => cname(c) === "Liberator, Urza's Battlethopter").cp || 0);
      check(cp === 0, `no mana was spent, so Liberator got no counter (${cp})`);
      await toGy(A, 'Omniscience');
      await toHand(A, 'Baneslayer Angel'); check(await castP(A, 'Baneslayer Angel', {W:2, C:3}) === 'ok', 'without Omniscience Baneslayer is paid with 5 mana'); await after();
      const cp2 = await A.evaluate(() => S.bf.find(c => cname(c) === "Liberator, Urza's Battlethopter").cp || 0);
      check(cp2 === 1, `5 mana spent > Liberator's power: +1/+1 counter (${cp2})`);
      await toGy(A, 'Wall of Omens');
    });
    await step('As Foretold: {0} once each turn for mana value ≤ time counters', async () => {
      await put(A, 'As Foretold'); await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'As Foretold'); c.nc = {...(c.nc || {}), time:2}; commit(); });
      await toHand(A, 'Mind Stone'); await toHand(A, 'Sol Ring');
      check(await castP(A, 'Mind Stone', {}) === 'ok', 'Mind Stone (MV 2) cast for {0}'); await after();
      check(await castP(A, 'Sol Ring', {}) !== 'ok', 'a second free spell the same turn is refused');
      const r = await A.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Sol Ring'); S.pool = emptyPool(); return castCheck(c, 'hand'); });
      check(!r.ok, `castCheck says no (${r.why})`);
      await toGy(A, 'As Foretold'); await toGy(A, 'Mind Stone');
    });
    await step("Demon of Fate's Design: pay life equal to mana value for an enchantment", async () => {
      await put(A, "Demon of Fate's Design"); await toHand(A, 'Rhystic Study');
      const l0 = await A.evaluate(() => S.life);
      check(await castP(A, 'Rhystic Study', {}) === 'ok', 'Rhystic Study cast with no mana'); await after();
      const l1 = await A.evaluate(() => S.life);
      check(l0 - l1 === 3, `paid 3 life (${l0} → ${l1})`);
      await toGy(A, "Demon of Fate's Design"); await toGy(A, 'Rhystic Study');
    });
    await step('Dracogenesis and Rooftop Storm: Dragons and Zombies for free', async () => {
      await put(A, 'Dracogenesis'); await toHand(A, 'Shivan Dragon');
      check(await castP(A, 'Shivan Dragon', {}) === 'ok', 'Shivan Dragon cast for free'); await after();
      await toHand(A, 'Eternal Witness'); check(await castP(A, 'Eternal Witness', {}) !== 'ok', 'a non-Dragon still needs mana');
      await toGy(A, 'Dracogenesis'); await toGy(A, 'Shivan Dragon');
      await put(A, 'Rooftop Storm'); await toHand(A, 'Gravecrawler');
      check(await castP(A, 'Gravecrawler', {}) === 'ok', 'Gravecrawler (Zombie) cast for {0}'); await after();
      await toGy(A, 'Rooftop Storm'); await toGy(A, 'Gravecrawler');
    });
    await step('Flash grants: Liberator (artifact/colorless), Quick Sliver (any player)', async () => {
      const r = await A.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Arcane Signet') || S.lib.find(x => cname(x) === 'Arcane Signet'); const s = S.hand.find(x => cname(x) === 'Eternal Witness'); S.stk.push({sid:'dummy', o:nextO(), kind:'trigger', k:c.k, nm:'dummy', txt:'Draw a card.'}); const a = timingOk(c).ok, b = timingOk(s).ok; S.stk = S.stk.filter(x => x.sid !== 'dummy'); return [a, b]; });
      check(r[0] && !r[1], `with the stack busy, Sol Ring may be cast (Liberator) but Eternal Witness may not (${r})`);
      await put(B, 'Quick Sliver'); await after(); await toHand(A, 'Galerider Sliver');
      const q = await A.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Galerider Sliver'); S.stk.push({sid:'dummy', o:nextO(), kind:'trigger', k:c.k, nm:'dummy', txt:'Draw a card.'}); const a = timingOk(c).ok; S.stk = S.stk.filter(x => x.sid !== 'dummy'); return a; });
      check(q, "Kim's Quick Sliver lets Georges cast Galerider Sliver at instant speed");
      await toGy(B, 'Quick Sliver'); await toGy(A, "Liberator, Urza's Battlethopter");
    });
    await step('Chromatic Orrery: colorless mana pays colored costs', async () => {
      await put(A, 'Chromatic Orrery'); await toHand(A, 'Counterspell');
      const r = await A.evaluate(() => { S.pool = {...emptyPool(), C:2}; return payPlan(parseCost('{U}{U}'), S.pool).err || 'ok'; });
      check(r === 'ok', `{C}{C} pays {U}{U} (${r})`);
      await toGy(A, 'Chromatic Orrery');
      const r2 = await A.evaluate(() => { S.pool = {...emptyPool(), C:2}; return payPlan(parseCost('{U}{U}'), S.pool).err || 'ok'; });
      check(r2 !== 'ok', 'without the Orrery it does not');
    });
    await step("Activation costs: Blossoming Tortoise on Rogue's Passage, Heartstone keeps one mana, Bruenor's free equip", async () => {
      await put(A, 'Blossoming Tortoise'); await put(A, "Rogue's Passage"); await after();
      const r = await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === "Rogue's Passage"); c.tap = false; S.bf.forEach(b => { if (isLand(b.k) && b !== c) b.tap = true; }); S.pool = {...emptyPool(), C:3}; window.__tgt = 'Baneslayer'; const ab = abilityList(c).find(a => /can't be blocked/.test(a.eff)); const why = abilityReady(c, ab, false); await activateAbility(c, ab); return [why, S.pool.C, c.tap]; });
      check(r[0] === '' && r[1] === 0 && r[2], `{4},{T} ability paid with 3 mana (ready:'${r[0]}', left ${r[1]}, tapped ${r[2]})`);
      await after(); await toGy(A, 'Blossoming Tortoise');
      await put(A, 'Heartstone'); await put(A, 'Galerider Sliver');
      const h = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Baneslayer Angel'); return [n24adjCost(c, '{2}', {eff:'x'}, false), n24adjCost(c, '{1}', {eff:'x'}, false), n24adjCost(c, '{1}{W}', {eff:'x'}, false)]; });
      check(h[0] === '{1}' && h[1] === '{1}' && h[2] === '{W}', `Heartstone: {2}→{1}, {1} stays {1}, {1}{W}→{W} (${h})`);
      await toGy(A, 'Heartstone');
      const tz = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Baneslayer Angel'); c.col = 'G'; const r = n24adjCost(c, '{3}, {T}', {eff:'Draw two cards. Spend only mana of the chosen color to activate this ability.'}, false); delete c.col; return r; });
      check(tz === '{G}{G}{G}, {T}', `Throne of Eldraine-style ability: only the chosen color pays ({3}, {T} → ${tz})`);
      await put(A, 'Bruenor Battlehammer'); await put(A, 'Skullclamp'); await put(A, 'Swiftfoot Boots');
      const e = await A.evaluate(async () => { S.pool = emptyPool(); S.n24eq = ''; const sc = S.bf.find(x => cname(x) === 'Skullclamp'); const ab = abilityList(sc).find(a => a.equip); const w = abilityReady(sc, ab, false); window.__want = 'Baneslayer'; await activateAbility(sc, ab); const it = S.stk.find(x => x.srcId === sc.id); const sb = S.bf.find(x => cname(x) === 'Swiftfoot Boots'); const ab2 = abilityList(sb).find(a => a.equip); return [w, !!it, abilityReady(sb, ab2, false)]; });
      check(e[0] === '' && e[1], `first equip of the turn costs {0} (ready '${e[0]}', on stack ${e[1]})`);
      check(/Mana/.test(e[2] || ''), `the second equip needs mana again (${e[2]})`);
      await after(); await A.evaluate(() => { window.__want = null; });
      for (const n of ['Bruenor Battlehammer', 'Skullclamp', 'Swiftfoot Boots', 'Galerider Sliver']) await toGy(A, n);
    });
    await step('Defiler of Vigor: 2 life instead of {G}; Morophon: colored reduction', async () => {
      await put(A, 'Defiler of Vigor'); await toHand(A, 'Llanowar Elves'); const l0 = await A.evaluate(() => S.life);
      check(await castP(A, 'Llanowar Elves', {}) === 'ok', 'Llanowar Elves cast with no mana by paying 2 life'); await after();
      const l1 = await A.evaluate(() => S.life); check(l0 - l1 === 2, `paid 2 life (${l0} → ${l1})`);
      await toGy(A, 'Defiler of Vigor');
      await A.evaluate(() => { const z = S.cz.find(x => cname(x) === 'Morophon, the Boundless'); if (z) moveCard(z.id, 'bf', {quiet:true}); const c = S.bf.find(x => cname(x) === 'Morophon, the Boundless'); c.ctype = 'Elf'; commit(); });
      await toHand(A, 'Elvish Mystic'); const sc = await A.evaluate(() => costStr(spellCost(S.hand.find(x => cname(x) === 'Elvish Mystic'), 'hand').cost));
      check(sc === '{0}', `Elvish Mystic costs ${sc} with Morophon naming Elf`);
      check(await castP(A, 'Elvish Mystic', {}) === 'ok', 'Elvish Mystic cast for nothing'); await after();
      await toGy(A, 'Morophon, the Boundless');
    });
    await step('Additional costs: Deadly Dispute, Vile Mutilator, Abhorrent Oculus, Village Rites', async () => {
      await toHand(A, 'Deadly Dispute'); await A.evaluate(() => { window.__want = 'Llanowar'; });
      const h0 = await A.evaluate(() => S.hand.length);
      check(await castP(A, 'Deadly Dispute', {B:1, C:1}) === 'ok', 'Deadly Dispute cast'); await after();
      const r = await A.evaluate(() => [S.gy.some(c => cname(c) === 'Llanowar Elves'), S.bf.some(c => /Treasure/.test(typeOf(c))), S.hand.length]);
      check(r[0], 'Llanowar Elves was sacrificed as the additional cost'); check(r[1] && r[2] === h0 + 1, `drew two and made a Treasure (hand ${h0} → ${r[2]})`);
      await A.evaluate(() => { S.bf.filter(c => isCreatureCard(c) || /Enchantment/.test(typeOf(c))).forEach(c => { S.bf.splice(S.bf.indexOf(c), 1); if (!c.tok){ reset(c); S.gy.push(c); } }); commit(); });
      await toHand(A, 'Vile Mutilator');
      const v = await A.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Vile Mutilator'); S.pool = {...emptyPool(), B:7}; return castCheck(c, 'hand'); });
      check(!v.ok && /additional cost/.test(v.why), `Vile Mutilator can't be cast with nothing to sacrifice (${v.why})`);
      await put(A, 'Elvish Mystic'); await A.evaluate(() => { window.__want = 'Elvish'; });
      check(await castP(A, 'Vile Mutilator', {B:7}) === 'ok', 'with a creature to sacrifice it can'); await after();
      check(await A.evaluate(() => S.gy.some(c => cname(c) === 'Elvish Mystic')), 'Elvish Mystic was sacrificed for it');
      await toGy(A, 'Vile Mutilator');
      await A.evaluate(() => { while (S.gy.length < 7 && S.lib.length) { const c = S.lib.pop(); S.gy.push(c); } commit(); });
      const g0 = await A.evaluate(() => S.gy.length); await toHand(A, 'Abhorrent Oculus');
      await A.evaluate(() => { window.__want = null; }); check(await castP(A, 'Abhorrent Oculus', {U:1, C:2}) === 'ok', 'Abhorrent Oculus cast'); await after();
      const g1 = await A.evaluate(() => S.gy.length); check(g0 - g1 === 6, `six cards exiled from the graveyard (${g0} → ${g1})`);
      await toGy(A, 'Abhorrent Oculus'); await A.evaluate(() => { window.__want = null; });
    });
    await step('Granted mana abilities: Path of Annihilation (Eldrazi Spawn), Resonating Lute (restricted)', async () => {
      await put(A, 'Path of Annihilation'); await after();
      const r = await A.evaluate(async () => { const sp = S.bf.find(c => /Eldrazi/.test(typeOf(c))); if (!sp) return 'no spawn'; sp.sk = false; const ab = manaAbs(sp).find(a => /any color/i.test(a.eff)); if (!ab) return 'no ability'; S.pool = emptyPool(); await activateMana(sp, ab, 4); return poolText(S.pool); });
      check(r === '{G}', `an Eldrazi Spawn taps for one mana of any color (${r})`);
      await toGy(A, 'Path of Annihilation');
      await put(A, 'Resonating Lute');
      const l = await A.evaluate(async () => { const land = S.bf.find(c => isLand(c.k)) || null; if (!land) return 'no land'; land.tap = false; const ab = manaAbs(land).find(a => /two mana of any one color/i.test(a.eff)); if (!ab) return 'no ability'; S.pool = emptyPool(); await activateMana(land, ab, 2); const can = payPlan(parseCost('{1}'), S.pool).err || 'ok'; const ctr = S.hand.find(c => cname(c) === 'Counterspell'); const cast = ctr ? castCheck(ctr, 'hand').ok : null; return [poolText(S.pool), can, cast]; });
      console.log('    lute', JSON.stringify(l));
      check(Array.isArray(l) && l[0] === '{B}{B}' && l[1] !== 'ok', `a land makes two mana of one color that can't pay a generic ability cost (${l})`);
      await A.evaluate(() => { S.pool = emptyPool(); S.r21rm = []; commit(); }); await toGy(A, 'Resonating Lute');
    });
    await step('Unspent mana: Omnath keeps green, Kruphix turns the rest colorless', async () => {
      await put(A, 'Omnath, Locus of Mana');
      const r = await A.evaluate(() => { S.pool = {...emptyPool(), G:3, R:2}; S.seenPh = 'force'; engineTick(); return poolText(S.pool); });
      check(r === '{G}{G}{G}', `green stays, red is lost (${r})`);
      await put(A, 'Kruphix, God of Horizons');
      const r2 = await A.evaluate(() => { S.pool = {...emptyPool(), G:2, R:2}; S.seenPh = 'force'; engineTick(); return poolText(S.pool); });
      check(r2 === '{G}{G}{C}{C}', `with Kruphix the red becomes colorless (${r2})`);
      await A.evaluate(() => { S.pool = emptyPool(); commit(); }); await toGy(A, 'Omnath, Locus of Mana'); await toGy(A, 'Kruphix, God of Horizons');
    });
    await step('Mana spent tracking: Smaug draws when Treasure mana was spent', async () => {
      await put(A, 'Smaug, Wicked Worm'); await after();
      await A.evaluate(() => { const a = addInfo(infoFrom({id:'tok-treasure-n24', name:'Treasure', type_line:'Token Artifact — Treasure', oracle_text:'{T}, Sacrifice this token: Add one mana of any color.', mana_cost:'', layout:'token', colors:[], color_identity:[]})); S.bf.push({id:S.nid++, k:a.k, tok:true, n:1}); commit(); });
      const r = await A.evaluate(async () => { const t = S.bf.find(c => /Treasure/.test(typeOf(c)) && manaAbs(c).length && !c.tap); if (!t) return 'no treasure ' + JSON.stringify(S.bf.filter(c => /Treasure/.test(typeOf(c))).map(c => [c.k, info(c.k)?.o, c.fd])); const ab = manaAbs(t)[0]; S.pool = emptyPool(); await activateMana(t, ab, 3); return poolText(S.pool); });
      check(r === '{R}', `Treasure tapped for {R} (${r})`);
      await toHand(A, 'Lightning Bolt'); await A.evaluate(() => { window.__tgt = 'Kim'; });
      const l0 = await A.evaluate(() => S.life);
      const c1 = await A.evaluate(async () => { const c = S.hand.find(x => cname(x) === 'Lightning Bolt'); await beginCast(c, 'hand'); return S.hand.includes(c) ? 'not cast' : 'ok'; });
      check(c1 === 'ok', 'Lightning Bolt cast with the Treasure mana'); await after();
      const l1 = await A.evaluate(() => S.life); check(l0 - l1 === 1, `Smaug: drew a card and lost 1 life (${l0} → ${l1})`);
      await toHand(A, 'Lightning Bolt');
      check(await castP(A, 'Lightning Bolt', {R:1}) === 'ok', 'Lightning Bolt cast with ordinary mana'); await after();
      const l2 = await A.evaluate(() => S.life); check(l2 === l1, `no Treasure mana: no trigger (${l1} → ${l2})`);
      await toGy(A, 'Smaug, Wicked Worm');
    });
    await step("Sephara: {W} and four untapped fliers instead of its mana cost", async () => {
      for (const n of ['Birds of Paradise', 'Baneslayer Angel', 'Shivan Dragon', "Liberator, Urza's Battlethopter"]){ await toHand(A, n); await put(A, n); }
      await toHand(A, "Sephara, Sky's Blade");
      check(await castP(A, "Sephara, Sky's Blade", {W:1}) === 'ok', 'Sephara cast for {W}'); await after();
      const r = await A.evaluate(() => S.bf.filter(c => ['Birds of Paradise', 'Baneslayer Angel', 'Shivan Dragon', "Liberator, Urza's Battlethopter"].includes(cname(c)) && c.tap).length);
      check(r === 4, `four fliers were tapped (${r})`);
      check(await onBf(A, "Sephara, Sky's Blade"), 'Sephara is on the battlefield');
    });
    await step('Improvise grant: Inspiring Statuary lets artifacts pay for a nonartifact spell', async () => {
      await A.evaluate(() => { S.bf.forEach(c => { c.tap = false; }); commit(); });
      await put(A, 'Inspiring Statuary'); await put(A, 'Sol Ring'); await put(A, 'Arcane Signet'); await toHand(A, 'Eternal Witness');
      await A.evaluate(() => { window.__want = null; });
      const r = await A.evaluate(() => { S.bf.forEach(b => { if (isLand(b.k)) b.tap = true; }); S.pool = {...emptyPool(), G:1}; const c = S.hand.find(x => cname(x) === 'Eternal Witness'); return castCheck(c, 'hand'); });
      check(r.ok, `Eternal Witness ({1}{G}{G}… with {G} + 3 artifacts) is castable (${r.why || 'ok'})`);
      const w = await A.evaluate(async () => { S.pool = {...emptyPool(), G:2}; const c = S.hand.find(x => cname(x) === 'Eternal Witness'); await beginCast(c, 'hand'); return [S.hand.includes(c) ? 'not cast' : 'ok', S.bf.filter(b => /Artifact/.test(typeOf(b)) && b.tap).length]; });
      check(w[0] === 'ok' && w[1] >= 1, `cast with an artifact tapped for improvise (${w})`); await after();
    });
  } finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
