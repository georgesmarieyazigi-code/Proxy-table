process.env.TOP = '1';
// Round 27 helper D: the last one-offs (mostly back faces of double-faced cards), played in a real 2-player game (Georges vs Kim)
const CC = require('./cards');
const WANT = ['Birgi, God of Storytelling // Harnfel, Horn of Bounty', 'Valakut Awakening // Valakut Stoneforge', 'Hydroelectric Specimen // Hydroelectric Laboratory',
  "Agadeem's Awakening // Agadeem, the Undercrypt", 'Legion Leadership // Legion Stronghold', 'Wandering Archaic // Explore the Vastlands', "Tergrid, God of Fright // Tergrid's Lantern",
  'Murderous Rider // Swift End', 'Dazzling Theater // Prop Room', 'Urabrask // The Great Work', 'Monster Manual // Zoological Study', 'Ojer Kaslem, Deepest Growth // Temple of Cultivation',
  'Thousand Moons Smithy // Barracks of the Thousand', 'Jidoor, Aristocratic Capital // Overture', 'Halvar, God of Battle // Sword of the Realms', "Dollmaker's Shop // Porcelain Gallery",
  'Aclazotz, Deepest Betrayal // Temple of the Dead', 'Bloodsoaked Insight // Sanguine Morass', 'Venat, Heart of Hydaelyn // Hydaelyn, the Mothercrystal', 'Jin-Gitaxias // The Great Synthesis',
  'Vorinclex // The Grand Evolution', 'Vincent Valentine // Galian Beast', 'Decadent Dragon // Expensive Taste', 'Heliod, the Radiant Dawn // Heliod, the Warped Eclipse',
  'Rona, Herald of Invasion // Rona, Tolarian Obliterator', 'Ral, Monsoon Mage // Ral, Leyline Prodigy', 'Invasion of Zendikar // Awakened Skyclave', "Joshua, Phoenix's Dominant // Phoenix, Warden of Fire",
  'Varragoth, Bloodsky Sire', 'Rhystic Study', 'Swiftfoot Boots',
  'Grizzly Bears', 'Llanowar Elves', 'Giant Growth', 'Lightning Bolt', 'Mind Stone', 'Darksteel Ingot', 'Wall of Omens'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)).map(c => { if (['split', 'adventure'].includes(c.layout) && c.card_faces) c.card_faces.forEach(f => { delete f.image_uris; }); return c; }));
const H = require('./h'); const {check, sleep, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { window.__want = window.__want || null; window.__tgt = window.__tgt || null; window.__num = null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []).filter(c => !m.filter || m.filter(c)); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ const re = window.__tgt ? new RegExp(window.__tgt, 'i') : null; const c = re ? (m.cands || []).find(x => x.ok && re.test(x.nm)) : (m.cands || []).find(x => x.ok); if (!c && re) return; m.__done = 1; m.resolve(c ? [c] : []); closeModal(); }
    else if (m.run){ m.__done = 1; const d = window.__num != null ? window.__num : (m.def ?? 1); m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
// any face name finds the card
const FN = () => { window.__is = (c, n) => { const a = c && info(c.k); if (!a) return false; return a.n === n || cname(c) === n || (a.back && a.back.n === n) || (a.faces || []).some(f => f.n === n) || String(a.full || '').split(' // ').includes(n) || (info(c.origK || '') || {}).n === n; }; };
const toZone = (p, n, z) => p.evaluate(([n, z]) => { for (const y of ['lib', 'hand', 'gy', 'ex', 'bf']){ const i = S[y].findIndex(c => __is(c, n)); if (i >= 0){ const [c] = S[y].splice(i, 1); reset(c); S[z].push(c); commit(); return c.id; } } return null; }, [n, z]);
const toTop = (p, n) => p.evaluate(n => { for (const y of ['lib', 'hand', 'gy', 'ex', 'bf']){ const i = S[y].findIndex(c => __is(c, n)); if (i >= 0){ const [c] = S[y].splice(i, 1); reset(c); S.lib.unshift(c); commit(); return c.id; } } return null; }, n);
const putAny = (p, n, fl) => p.evaluate(([n, fl]) => { for (const z of ['lib', 'hand', 'gy', 'ex']){ const c = S[z].find(c => __is(c, n)); if (c){ if (fl) c.fl = true; moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id); if (b){ b.sk = false; b.tap = false; } commit(); return b ? b.id : null; } } const b = S.bf.find(c => __is(c, n)); return b ? b.id : null; }, [n, !!fl]);
const toGy = (p, n) => p.evaluate(n => { let k = 0; for (const c of S.bf.filter(x => __is(x, n))){ moveCard(c.id, 'gy', {quiet:true}); k++; } commit(); return k > 0; }, n);
const cast = (p, n, pool) => p.evaluate(async ([n, pool]) => { const c = S.hand.find(x => __is(x, n)); if (!c) return 'not in hand'; S.pool = {...emptyPool(), ...(pool || {W:6, U:6, B:6, R:6, G:6, C:6})}; commit(); await beginCast(c, 'hand'); return S.hand.includes(c) ? 'not cast' : 'ok'; }, [n, pool]);
const activate = (p, n, re) => p.evaluate(async ([n, re]) => { const c = S.bf.find(x => __is(x, n)); if (!c) return 'missing'; c.sk = false; c.tap = false; S.pool = {...emptyPool(), W:6, U:6, B:6, R:6, G:6, C:6}; const ab = abilityList(c).find(a => new RegExp(re, 'i').test(a.eff)); if (!ab) return 'no ability'; await activateAbility(c, ab); return 'ok'; }, [n, re]);
// run effect text as a card's ability; tg: list of target groups: 'kim' | 'me' | ['card', 'A'|'B', name]
const run = (p, txt, nm, extra) => p.evaluate(async ([txt, nm, extra]) => { const src = S.bf.find(c => __is(c, nm)) || S.gy.find(c => __is(c, nm)); const k = src ? src.k : ([...DICT.values()].find(a => a.n === nm)?.k || null); const ctx = {k, name:nm, full:txt, srcId:src ? src.id : null, it:{kind:'ability', ...((extra || {}).it || {})}}; if (extra && extra.tgts) ctx.tgts = extra.tgts; await runEffects(txt, ctx); commit(); return 'ok'; }, [txt, nm, extra]);
const tPlayer = async (p, who) => p.evaluate(who => { const pid = who === 'me' ? MYPID : [...OPP.keys()][0]; return {t:'player', pid, id:null, k:null, nm:nameOf(pid)}; }, who);
const tCard = async (owner, n) => owner.evaluate(n => { const c = S.bf.find(x => __is(x, n)); return c ? {t:'card', pid:MYPID, id:c.id, k:c.k, nm:cname(c)} : null; }, n);
const tGy = async (owner, n) => owner.evaluate(n => { const c = S.gy.find(x => __is(x, n)); return c ? {t:'gy', pid:MYPID, id:c.id, k:c.k, nm:cname(c)} : null; }, n);
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !new RegExp(process.env.ONLY).test(name)) return; console.log('— ' + name); const f0 = H.fails(); if (PA) for (const p of [PA, PB]) await p.evaluate(() => { window.__tgt = null; window.__want = null; window.__num = null; if (UI.modal && UI.modal.resolve && !UI.modal.__done){ try { UI.modal.__done = 1; UI.modal.resolve(UI.modal.type === 'target' || UI.modal.type === 'pick' ? [] : null); closeModal(); } catch {} } }); try { await T(60000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2d3');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2d3');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO); await A.evaluate(FN); await B.evaluate(FN);
  const life = p => p.evaluate(() => S.life);
  const cnt = (p, n) => p.evaluate(n => S.bf.filter(c => __is(c, n)).reduce((a, c) => a + (c.n || 1), 0), n);
  const after = async () => { await sleep(500); await settle([A, B]); await sleep(1200); await settle([A, B]); await sleep(500); };
  const want = (p, w, t) => p.evaluate(([w, t]) => { window.__want = w; window.__tgt = t; }, [w || null, t || null]);
  const clearBf = async p => { await p.evaluate(() => { S.bf.filter(c => !c.cmd).forEach(c => moveCard(c.id, c.tok ? 'gy' : 'lib', {quiet:true, bottom:true})); commit(); }); };
  try {
    await step('Valakut Awakening: put cards from hand on the bottom, draw that many plus one', async () => {
      await toZone(A, 'Grizzly Bears', 'hand'); await toZone(A, 'Llanowar Elves', 'hand');
      const h0 = await A.evaluate(() => S.hand.length); await want(A, 'Grizzly|Llanowar');
      await run(A, 'Put any number of cards from your hand on the bottom of your library, then draw that many cards plus one.', 'Valakut Awakening'); await after();
      const r = await A.evaluate(() => [S.hand.length, S.lib.slice(-2).map(cname).sort().join(',')]);
      check(r[0] === h0 + 1 && r[1] === 'Grizzly Bears,Llanowar Elves', `hand ${h0} → ${r[0]}, bottom two: ${r[1]}`);
    });
    await step('Legion Leadership doubles power and grants first strike', async () => {
      await putAny(A, 'Grizzly Bears'); await toZone(A, 'Legion Leadership', 'hand'); await want(A, null, 'Grizzly');
      check(await cast(A, 'Legion Leadership') === 'ok', 'cast Legion Leadership'); await after();
      const r = await A.evaluate(() => { const c = S.bf.find(x => __is(x, 'Grizzly Bears')); return [stats(c).join('/'), kwOf(c, 'first strike')]; });
      check(r[0] === '4/2' && r[1], `Grizzly Bears is ${r[0]}, first strike ${r[1]}`); await toGy(A, 'Grizzly Bears');
    });
    await step('Hydroelectric Specimen redirects Kim\'s Lightning Bolt to itself', async () => {
      await putAny(A, 'Hydroelectric Specimen'); await toZone(B, 'Lightning Bolt', 'hand'); await want(B, null, 'Georges'); const l0 = await life(A);
      check(await cast(B, 'Lightning Bolt') === 'ok', 'Kim casts Lightning Bolt at Georges'); await sleep(1500);
      await run(A, 'You may change the target of target instant or sorcery spell with a single target to Hydroelectric Specimen.', 'Hydroelectric Specimen'); await after(); await sleep(1000); await settle([A, B]);
      const r = await A.evaluate(() => { const c = S.bf.find(x => __is(x, 'Hydroelectric Specimen')); return [S.life, c ? c.dmg || 0 : 'gone']; });
      check(r[0] === l0 && r[1] === 3, `Georges's life ${l0} → ${r[0]}; the Specimen took ${r[1]} damage`); await toGy(A, 'Hydroelectric Specimen');
    });
    await step('Wandering Archaic: Kim doesn\'t pay {2}, so Georges copies her Bolt at her', async () => {
      await putAny(A, 'Wandering Archaic'); await after(); await toZone(B, 'Lightning Bolt', 'hand'); await want(B, null, 'Georges'); await want(A, null, 'Kim');
      const la = await life(A), lb = await life(B);
      await B.evaluate(() => { S.bf.forEach(c => { if (isLand(c.k)) c.tap = true; }); commit(); });
      check(await B.evaluate(async () => { const c = S.hand.find(x => __is(x, 'Lightning Bolt')); S.pool = {...emptyPool(), R:1}; commit(); await beginCast(c, 'hand'); return !S.hand.includes(c); }), 'Kim casts Lightning Bolt with exactly {R}');
      await after(); await sleep(2500); await settle([A, B]); await sleep(1500); await settle([A, B]);
      const la1 = await life(A), lb1 = await life(B);
      check(la - la1 === 3 && lb - lb1 === 3, `Georges ${la} → ${la1}, Kim ${lb} → ${lb1} (the copy hit Kim)`); await toGy(A, 'Wandering Archaic');
    });
    await step('Explore the Vastlands: each player takes a land and an instant from their top five and gains 3 life', async () => {
      for (const p of [A, B]){ await toTop(p, 'Mountain'); await toTop(p, 'Giant Growth'); await toTop(p, 'Grizzly Bears'); }
      const la = await life(A), lb = await life(B); const ha = await A.evaluate(() => S.hand.length), hb = await B.evaluate(() => S.hand.length);
      await want(A, 'Mountain|Giant Growth'); await want(B, 'Mountain|Giant Growth');
      await run(A, 'Each player looks at the top five cards of their library and may reveal a land card and/or an instant or sorcery card from among them. Each player puts the cards they revealed this way into their hand and the rest on the bottom of their library in a random order. Each player gains 3 life.', 'Wandering Archaic'); await after(); await sleep(1500);
      const ra = await A.evaluate(() => [S.hand.length, S.hand.slice(-2).map(cname).sort().join(','), S.life, S.lib.slice(-3).some(c => cname(c) === 'Grizzly Bears')]);
      const rb = await B.evaluate(() => [S.hand.length, S.hand.slice(-2).map(cname).sort().join(','), S.life, S.lib.slice(-3).some(c => cname(c) === 'Grizzly Bears')]);
      check(ra[0] === ha + 2 && ra[1] === 'Giant Growth,Mountain' && ra[2] === la + 3 && ra[3], `Georges: ${JSON.stringify(ra)}`);
      check(rb[0] === hb + 2 && rb[1] === 'Giant Growth,Mountain' && rb[2] === lb + 3 && rb[3], `Kim (on her own client): ${JSON.stringify(rb)}`);
    });
    await step("Tergrid's Lantern: Kim chooses to lose 3 life", async () => {
      await putAny(A, "Tergrid's Lantern", true); await want(A, null, 'Kim'); await want(B, 'Lose 3'); const lb = await life(B);
      check(await activate(A, "Tergrid's Lantern", 'loses 3 life') === 'ok', "activated Tergrid's Lantern"); await after(); await sleep(1500);
      check(await life(B) === lb - 3, `Kim ${lb} → ${await life(B)}`);
      await want(B, 'Discard'); const hb = await B.evaluate(() => S.hand.length);
      check(await activate(A, "Tergrid's Lantern", 'loses 3 life') === 'ok', 'activated it again'); await after(); await sleep(1500);
      check(await B.evaluate(() => S.hand.length) === hb - 1 && await life(B) === lb - 3, 'the second time Kim discarded a card instead'); await toGy(A, "Tergrid's Lantern");
    });
    await step('Murderous Rider goes to the bottom of its owner\'s library when it dies', async () => {
      await putAny(A, 'Murderous Rider'); await after(); await toGy(A, 'Murderous Rider'); await after();
      check(await A.evaluate(() => __is(S.lib[S.lib.length - 1], 'Murderous Rider') && !S.gy.some(c => __is(c, 'Murderous Rider'))), 'Murderous Rider is on the bottom of the library');
    });
    await step('Prop Room: Georges untaps his creatures during Kim\'s untap step', async () => {
      const id = await putAny(A, 'Dazzling Theater'); await A.evaluate(id => { const c = S.bf.find(x => x.id === id); r26SetKey(c, r26RoomKey(r26Base(c), [false, true])); l24bust(); UI.srMemo = null; commit(); }, id);
      check(await A.evaluate(() => rulesOn('crSeedborn').length > 0), 'Prop Room (unlocked) gives the untap rule ' + await A.evaluate(id => { const c = S.bf.find(x => x.id === id); const a = info(c.k); return JSON.stringify([c.k, a && a.n, a && a.o, a && a.lay, (info(r26Base(c)) || {}).faces && info(r26Base(c)).faces.length, r26IsRoom(r26Base(c)), staticRules().filter(r => r.pid === MYPID).map(r => r.kind), staticRulesOf(c.k, c.fl), tname(a.o, a.n)]); }, id));
      await A.evaluate(id => { const c = S.bf.find(x => x.id === id); r26SetKey(c, r26RoomKey(r26Base(c), [true, false])); l24bust(); UI.srMemo = null; commit(); }, id);
      check(await A.evaluate(() => rulesOn('crSeedborn').length === 0), 'with only Dazzling Theater unlocked there is no untap rule');
      await A.evaluate(id => { const c = S.bf.find(x => x.id === id); moveCard(c.id, 'lib', {bottom:true, quiet:true}); commit(); }, id);
    });
    await step('The Great Work I: 3 damage to Kim and each creature she controls; III: cast Kim\'s Bolt from her graveyard', async () => {
      await putAny(B, 'Grizzly Bears'); await putAny(B, 'Wall of Omens'); await after(); const lb = await life(B);
      const kim = await tPlayer(A, 'kim');
      await run(A, 'The Great Work deals 3 damage to target opponent and each creature they control.', 'The Great Work', {tgts:[[kim]]}); await after(); await sleep(1500);
      const r = await B.evaluate(() => [S.life, S.bf.some(c => cname(c) === 'Grizzly Bears'), (S.bf.find(c => cname(c) === 'Wall of Omens') || {}).dmg]);
      check(r[0] === lb - 3 && !r[1] && r[2] === 3, `Kim ${lb} → ${r[0]}, Grizzly Bears died ${!r[1]}, Wall of Omens has ${r[2]} damage`); await toGy(B, 'Wall of Omens');
      await run(A, 'Until end of turn, you may cast instant and sorcery spells from any graveyard. If a spell cast this way would be put into a graveyard, exile it instead.', 'The Great Work'); await after();
      await toZone(A, 'Giant Growth', 'gy'); check(await A.evaluate(() => { const c = S.gy.find(x => cname(x) === 'Giant Growth'); return gyOptions(c).some(o => o.kind === 'gycast' && o.after === 'ex'); }), 'Giant Growth in Georges\'s graveyard can be cast (and is exiled after)');
      await toZone(B, 'Lightning Bolt', 'gy'); await sleep(1500); const lb2 = await life(B); await want(A, null, 'Kim');
      const ok = await A.evaluate(async () => { const [pid] = [...OPP.keys()]; S.pool = {...emptyPool(), R:3}; return d27CastOppGy(pid, (OPP.get(pid).gy || []).find(k => info(k)?.n === 'Lightning Bolt')); });
      check(ok, "Georges cast Kim's Lightning Bolt from her graveyard"); await after(); await sleep(1500); await settle([A, B]);
      const r2 = await B.evaluate(() => [S.life, S.gy.some(c => cname(c) === 'Lightning Bolt'), S.ex.some(c => cname(c) === 'Lightning Bolt')]);
      check(r2[0] === lb2 - 3 && !r2[1] && r2[2], `Kim ${lb2} → ${r2[0]}; her Bolt was exiled (gy ${r2[1]}, exile ${r2[2]})`);
    });
    await step('Zoological Study returns a creature card milled this way', async () => {
      await toTop(A, 'Mountain'); await toTop(A, 'Llanowar Elves'); await toTop(A, 'Mountain');
      await run(A, 'Mill five cards, then return a creature card milled this way to your hand.', 'Zoological Study'); await after();
      check(await A.evaluate(() => cname(S.hand[S.hand.length - 1]) === 'Llanowar Elves'), 'Llanowar Elves went to Georges\'s hand');
    });
    await step('Ojer Kaslem: reveal three, put a creature and a land onto the battlefield', async () => {
      await toTop(A, 'Giant Growth'); await toTop(A, 'Grizzly Bears'); await toTop(A, 'Mountain');
      const n0 = await A.evaluate(() => S.bf.length);
      await run(A, 'Reveal that many cards from the top of your library. You may put a creature card and/or a land card from among them onto the battlefield. Put the rest on the bottom in a random order.', 'Ojer Kaslem, Deepest Growth', {it:{evN:3}}); await after();
      const r = await A.evaluate(() => [S.bf.some(c => cname(c) === 'Grizzly Bears'), S.bf.filter(c => cname(c) === 'Mountain').length, cname(S.lib[S.lib.length - 1])]);
      check(r[0] && r[1] >= 1 && r[2] === 'Giant Growth', `Grizzly Bears on the battlefield ${r[0]}, Mountain ${r[1]}, Giant Growth on the bottom (${r[2]})`); await clearBf(A);
    });
    await step('Thousand Moons Smithy: Gnome Soldier P/T = artifacts and/or creatures; tap five', async () => {
      await putAny(A, 'Mind Stone'); await putAny(A, 'Darksteel Ingot'); await putAny(A, 'Grizzly Bears');
      await putAny(A, 'Thousand Moons Smithy'); await after(); await sleep(800);
      const r = await A.evaluate(() => { const g = S.bf.find(c => /Gnome Soldier/.test(cname(c))); const n = S.bf.filter(c => isCreatureCard(c) || /\bArtifact\b/.test(typeOf(c))).length; return g ? [stats(g).join('/'), n, typeOf(g)] : null; });
      check(r && r[0] === `${r[1]}/${r[1]}` && /Artifact Creature/.test(r[2]), `Gnome Soldier ${JSON.stringify(r)}`);
      await run(A, 'You may tap five untapped artifacts and/or creatures you control.', 'Thousand Moons Smithy'); await after();
      check(await A.evaluate(() => S.bf.filter(c => c.tap).length) === 5, 'five artifacts/creatures got tapped'); await clearBf(A);
    });
    await step('Overture: Kim mills half her library, rounded down', async () => {
      const n0 = await B.evaluate(() => S.lib.length); const kim = await tPlayer(A, 'kim');
      await run(A, 'Target opponent mills half their library, rounded down.', 'Overture', {tgts:[[kim]]}); await after(); await sleep(1200);
      const n1 = await B.evaluate(() => S.lib.length); check(n1 === n0 - Math.floor(n0 / 2), `Kim's library ${n0} → ${n1}`);
    });
    await step('Halvar moves Swiftfoot Boots; Sword of the Realms returns the dead creature to hand', async () => {
      const e = await putAny(A, 'Swiftfoot Boots'); const g = await putAny(A, 'Grizzly Bears'); const w = await putAny(A, 'Wall of Omens');
      await A.evaluate(([e, g]) => { S.bf.find(x => x.id === e).att = {pid:MYPID, id:g}; commit(); }, [e, g]);
      const te = await tCard(A, 'Swiftfoot Boots'), tw = await tCard(A, 'Wall of Omens');
      await run(A, 'You may attach target Aura or Equipment attached to a creature you control to target creature you control.', 'Halvar, God of Battle', {tgts:[[te], [tw]]}); await after();
      check(await A.evaluate(([e, w]) => (S.bf.find(x => x.id === e).att || {}).id === w, [e, w]), 'Swiftfoot Boots is now on Wall of Omens');
      const s = await putAny(A, 'Sword of the Realms', true); await A.evaluate(([s, g]) => { S.bf.find(x => x.id === s).att = {pid:MYPID, id:g}; commit(); }, [s, g]);
      await A.evaluate(g => { moveCard(g, 'gy'); commit(); }, g); await after();
      check(await A.evaluate(() => S.hand.some(c => cname(c) === 'Grizzly Bears') && S.bf.some(c => __is(c, 'Sword of the Realms'))), 'Grizzly Bears returned to hand; the Sword stayed'); await clearBf(A);
    });
    await step('Porcelain Gallery: creatures have base P/T equal to the number of creatures', async () => {
      await putAny(A, 'Grizzly Bears'); await putAny(A, 'Llanowar Elves'); await putAny(A, 'Wall of Omens');
      const id = await putAny(A, "Dollmaker's Shop"); await A.evaluate(id => { const c = S.bf.find(x => x.id === id); r26SetKey(c, r26RoomKey(r26Base(c), [false, true])); l24bust(); UI.srMemo = null; commit(); }, id);
      const r = await A.evaluate(() => S.bf.filter(c => isCreatureCard(c)).map(c => cname(c) + ' ' + stats(c).join('/')).sort());
      check(JSON.stringify(r) === JSON.stringify(['Grizzly Bears 3/3', 'Llanowar Elves 3/3', 'Wall of Omens 3/3']), `with Porcelain Gallery: ${r.join(', ')}`);
      await toGy(A, 'Llanowar Elves'); const r2 = await A.evaluate(() => stats(S.bf.find(c => cname(c) === 'Grizzly Bears')).join('/')); check(r2 === '2/2', `one fewer creature → Grizzly Bears ${r2}`);
      await clearBf(A);
    });
    await step('Aclazotz: Kim discards; when she has no cards, Georges draws instead', async () => {
      await putAny(A, 'Aclazotz, Deepest Betrayal'); const hb = await B.evaluate(() => S.hand.length);
      await run(A, "Each opponent discards a card. For each opponent who can't, you draw a card.", 'Aclazotz, Deepest Betrayal'); await after(); await sleep(1200);
      await B.evaluate(() => { const p = S.prm.find(x => x.type === 'discard'); if (p) finishChoice(p, [S.hand[0].id]); }); await sleep(1200);
      check(await B.evaluate(() => S.hand.length) === hb - 1, 'Kim discarded a card');
      const keep = await B.evaluate(() => { const n = S.hand.length; S.lib.push(...S.hand.splice(0)); commit(); return n; }); await sleep(1500);
      const ha = await A.evaluate(() => S.hand.length);
      await run(A, "Each opponent discards a card. For each opponent who can't, you draw a card.", 'Aclazotz, Deepest Betrayal'); await after();
      check(await A.evaluate(() => S.hand.length) === ha + 1, "Kim couldn't — Georges drew a card");
      await B.evaluate(n => { S.hand.push(...S.lib.splice(S.lib.length - n, n)); commit(); }, keep); await toGy(A, 'Aclazotz, Deepest Betrayal');
    });
    await step('Bloodsoaked Insight / Expensive Taste: Kim\'s top cards are exiled for Georges', async () => {
      const kim = await tPlayer(A, 'kim'); const n0 = await B.evaluate(() => S.lib.length);
      await run(A, 'Target opponent exiles the top three cards of their library. Until the end of your next turn, you may play those cards. If you cast a spell this way, mana of any type can be spent to cast it.', 'Bloodsoaked Insight', {tgts:[[kim]]}); await after(); await sleep(1200);
      const r = await A.evaluate(() => S.ex.filter(c => c.own && c.mayPlay && c.mayPlay.src === 'Bloodsoaked Insight').map(c => [c.mayPlay.next, c.mayPlay.any, c.mayPlay.cast]));
      check(r.length === 3 && r.every(x => x[0] && x[1] && !x[2]) && await B.evaluate(() => S.lib.length) === n0 - 3, `three of Kim's cards playable until Georges's next turn with any mana: ${JSON.stringify(r)}`);
      await run(A, "Exile the top two cards of target opponent's library face down. You may look at and play those cards for as long as they remain exiled.", 'Expensive Taste', {tgts:[[kim]]}); await after(); await sleep(1200);
      const r2 = await A.evaluate(() => S.ex.filter(c => c.own && c.mayPlay && c.mayPlay.src === 'Expensive Taste').map(c => c.mayPlay.adv));
      check(r2.length === 2 && r2.every(Boolean), `two cards playable for as long as they remain exiled: ${JSON.stringify(r2)}`);
    });
    await step('Hydaelyn: a legendary target draws a card', async () => {
      await A.evaluate(() => { for (const x of S.bf) if (x.fl && /Aclazotz/.test(info(x.k)?.n || '')){ x.fl = false; x.tap = false; } commit(); });   // an earlier Aclazotz died and correctly returned transformed as a land (v17): show its creature face again
      await putAny(A, 'Hydaelyn, the Mothercrystal', true); await putAny(A, 'Aclazotz, Deepest Betrayal'); const t = await tCard(A, 'Aclazotz, Deepest Betrayal'); const h0 = await A.evaluate(() => S.hand.length);
      await run(A, 'Put a +1/+1 counter on another target creature you control. Until your next turn, it gains indestructible. If that creature is legendary, draw a card.', 'Hydaelyn, the Mothercrystal', {tgts:[[t]]}); await after();
      const r = await A.evaluate(() => { const c = S.bf.find(x => __is(x, 'Aclazotz, Deepest Betrayal')); return [c.cp || 0, S.hand.length]; });
      check(r[0] === 1 && r[1] === h0 + 1, `counter ${r[0]}, hand ${h0} → ${r[1]}`); await clearBf(A);
    });
    await step('The Great Synthesis: no maximum hand size while it is on the battlefield', async () => {
      await putAny(A, 'The Great Synthesis', true); check(await A.evaluate(() => noMaxHand()), 'no maximum hand size with the Saga'); await toGy(A, 'The Great Synthesis');
      check(await A.evaluate(() => !noMaxHand()), 'maximum hand size is back once it is gone');
    });
    await step('The Grand Evolution: mill ten and put two creatures; distribute seven counters; fight ability', async () => {
      await toTop(A, 'Grizzly Bears'); await toTop(A, 'Wall of Omens'); await toTop(A, 'Llanowar Elves');
      await want(A, 'Grizzly|Wall'); await run(A, 'Mill ten cards. Put up to two creature cards from among the milled cards onto the battlefield.', 'The Grand Evolution'); await after(); await want(A, null);
      check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Grizzly Bears') && S.bf.some(c => cname(c) === 'Wall of Omens') && S.gy.some(c => cname(c) === 'Llanowar Elves')), 'Grizzly Bears and Wall of Omens came back; Llanowar Elves stayed in the graveyard');
      const g = await tCard(A, 'Grizzly Bears'), w = await tCard(A, 'Wall of Omens');
      await run(A, 'Distribute seven +1/+1 counters among any number of target creatures you control.', 'The Grand Evolution', {tgts:[[g, w]]}); await after();
      const r = await A.evaluate(() => S.bf.filter(c => isCreatureCard(c)).reduce((a, c) => a + (c.cp || 0), 0)); check(r === 7, `seven counters distributed (${r})`);
      await putAny(B, 'Llanowar Elves'); await after();
      await run(A, 'Until end of turn, creatures you control gain "{1}: This creature fights target creature you don\'t control."', 'The Grand Evolution'); await after();
      await want(A, null, 'Llanowar'); check(await activate(A, 'Grizzly Bears', 'fights') === 'ok', 'Grizzly Bears has the fight ability and activates it'); await after(); await sleep(1500); await settle([A, B]);
      check(await B.evaluate(() => !S.bf.some(c => cname(c) === 'Llanowar Elves')), "Kim's Llanowar Elves died in the fight"); await clearBf(A);
    });
    await step('Vincent Valentine grows by the power of Kim\'s creature that died', async () => {
      await putAny(A, 'Vincent Valentine'); await putAny(B, 'Grizzly Bears'); await after();
      await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); modCounters(c, 'cp', 1); commit(); }); await sleep(800);
      await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); moveCard(c.id, 'gy'); commit(); }); await after(); await sleep(1500); await settle([A, B]);
      check(await A.evaluate(() => (S.bf.find(x => __is(x, 'Vincent Valentine')) || {}).cp) === 3, 'Vincent got three +1/+1 counters (Grizzly Bears with a counter was 3/3)'); await clearBf(A);
    });
    await step('Heliod: the enters trigger targets a non-God enchantment card in the graveyard', async () => {
      await toZone(A, 'Rhystic Study', 'gy'); const sp = await A.evaluate(() => targetSpecs("Return target enchantment card that isn't a God from your graveyard to your hand."));
      check(sp.length === 1 && sp[0].zone === 'gy', `target is in the graveyard: ${JSON.stringify(sp)}`);
      const t = await tGy(A, 'Rhystic Study'); await putAny(A, 'Heliod, the Radiant Dawn');
      await run(A, "Return target enchantment card that isn't a God from your graveyard to your hand.", 'Heliod, the Radiant Dawn', {tgts:[[t]]}); await after();
      check(await A.evaluate(() => S.hand.some(c => cname(c) === 'Rhystic Study')), 'Rhystic Study is back in hand'); await clearBf(A);
    });
    await step('Rona: Kim\'s Bolt hits Rona, Kim exiles a land from her hand at random, Georges puts it onto the battlefield', async () => {
      await putAny(A, 'Rona, Tolarian Obliterator', true); await after();
      const keep = await B.evaluate(() => { const others = S.hand.splice(0); S.lib.push(...others); for (const n of ['Lightning Bolt', 'Plains']){ for (const z of ['lib', 'ex', 'gy']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.hand.push(c); break; } } } commit(); return others.length; });
      await want(B, null, 'Rona'); await B.evaluate(() => { S.bf.forEach(c => { if (isLand(c.k)) c.tap = true; }); commit(); });
      check(await cast(B, 'Lightning Bolt', {R:1}) === 'ok', 'Kim bolts Rona'); await after(); await sleep(2500); await settle([A, B]); await sleep(1500); await settle([A, B]);
      const r = await A.evaluate(() => [S.bf.some(c => cname(c) === 'Plains'), (S.bf.find(c => __is(c, 'Rona, Tolarian Obliterator')) || {}).dmg]);
      check(r[0] && r[1] === 3, `Georges controls Kim's Plains (${r[0]}); Rona has ${r[1]} damage`);
      check(await B.evaluate(() => !S.hand.some(c => cname(c) === 'Plains')), 'the Plains left Kim\'s hand');
      // a nonland card: Georges may cast it without paying its mana cost
      await A.evaluate(() => { const c = S.bf.find(x => __is(x, 'Rona, Tolarian Obliterator')); c.dmg = 0; commit(); });
      await B.evaluate(() => { S.lib.push(...S.hand.splice(0)); for (const n of ['Lightning Bolt', 'Giant Growth']){ for (const z of ['lib', 'ex', 'gy']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.hand.push(c); break; } } } commit(); });
      await want(A, null, 'Rona'); check(await cast(B, 'Lightning Bolt', {R:1}) === 'ok', 'Kim bolts Rona again'); await after(); await sleep(2500); await settle([A, B]); await sleep(1500); await settle([A, B]);
      const g = await A.evaluate(() => S.log.some(e => /cast Giant Growth/.test(e.s)) && stats(S.bf.find(c => __is(c, 'Rona, Tolarian Obliterator')))[0]);
      check(g === 8, `Georges cast Kim's Giant Growth for free on Rona (power ${g})`);
      check(await B.evaluate(() => S.gy.some(c => cname(c) === 'Giant Growth') && !S.hand.length), "Kim's Giant Growth ended in her graveyard");
      await B.evaluate(n => { S.hand.push(...S.lib.splice(S.lib.length - n, n)); commit(); }, keep); await clearBf(A);
    });
    await step('Ral: lose the flip → 1 damage; Leyline Prodigy loyalty, +1 discount, −2 blue draw, −8', async () => {
      await putAny(A, 'Ral, Monsoon Mage'); const l0 = await life(A);
      await A.evaluate(async () => { const c = S.bf.find(x => __is(x, 'Ral, Monsoon Mage')); const ctx = {k:c.k, name:'Ral, Monsoon Mage', full:'', srcId:c.id, coin:'tails'}; await runEffects('If you lose the flip, Ral, Monsoon Mage deals 1 damage to you.', ctx); commit(); });
      check(await life(A) === l0 - 1, `lost the flip: ${l0} → ${await life(A)}`); await toGy(A, 'Ral, Monsoon Mage');
      await A.evaluate(() => { const t = turnStr(); const bolt = [...DICT.values()].find(a => a.n === 'Lightning Bolt').k; S.casts = [{k:bolt, t}, {k:bolt, t}]; commit(); });
      const id = await putAny(A, 'Ral, Leyline Prodigy', true); await A.evaluate(id => { const c = S.bf.find(x => x.id === id); c.co = 0; onEnter(c, 'ex'); commit(); }, id);
      check(await A.evaluate(id => S.bf.find(x => x.id === id).co, id) === 4, 'Ral, Leyline Prodigy entered with 2 + 2 loyalty');
      await run(A, 'Until your next turn, instant and sorcery spells you cast cost {1} less to cast.', 'Ral, Leyline Prodigy');
      console.log('   cost mods', await A.evaluate(() => JSON.stringify(costMods({k:[...DICT.values()].find(a => a.n === 'Valakut Awakening').k}, MYPID))));
      const r = await A.evaluate(() => { const gg = [...DICT.values()].find(a => a.n === 'Giant Growth').k; const wl = [...DICT.values()].find(a => a.n === 'Wall of Omens').k; return [spellCost({k:wl}, 'hand').cost.gen, spellCost({k:[...DICT.values()].find(a => a.n === 'Valakut Awakening').k}, 'hand').cost.gen]; });
      check(r[0] === 1 && r[1] === 1, `Wall of Omens generic ${r[0]} (unchanged), Valakut Awakening generic ${r[1]} (2 − 1)`);
      const h0 = await A.evaluate(() => S.hand.length);
      await run(A, 'Draw a card if you control a blue permanent other than Ral, Leyline Prodigy.', 'Ral, Leyline Prodigy'); await after();
      const h1 = await A.evaluate(() => S.hand.length); await putAny(A, 'Hydroelectric Specimen'); await after(); const h2 = await A.evaluate(() => S.hand.length);
      await run(A, 'Draw a card if you control a blue permanent other than Ral, Leyline Prodigy.', 'Ral, Leyline Prodigy'); await after();
      const h3 = await A.evaluate(() => S.hand.length); check(h1 === h0 && h3 === h2 + 1, `no blue permanent: drew ${h1 - h0}; with Hydroelectric Specimen: drew ${h3 - h2}`);
      await toTop(A, 'Giant Growth'); await toTop(A, 'Grizzly Bears');
      await run(A, 'Exile the top eight cards of your library. You may cast instant and sorcery spells from among them this turn without paying their mana costs.', 'Ral, Leyline Prodigy'); await after();
      const r8 = await A.evaluate(() => [S.ex.filter(c => c.mayPlay && c.mayPlay.src === 'Ral, Leyline Prodigy').map(cname), (S.ex.find(c => cname(c) === 'Grizzly Bears') || {}).mayPlay]);
      check(r8[0].includes('Giant Growth') && !r8[1], `castable for free: ${r8[0].join(', ')}; Grizzly Bears is not`); await clearBf(A);
    });
    await step('Awakened Skyclave is a land in addition to a creature', async () => {
      await putAny(A, 'Awakened Skyclave', true); const r = await A.evaluate(() => { const c = S.bf.find(x => __is(x, 'Awakened Skyclave')); return [typeOf(c), isLand(c.k) || /\bLand\b/.test(typeOf(c))]; });
      check(/Land/.test(r[0]) && /Creature/.test(r[0]), `type line: ${r[0]}`); await clearBf(A);
    });
    await step("Agadeem's Awakening (X = 3) and Phoenix III (total 6) respect their limits", async () => {
      await A.evaluate(() => { S.gy.splice(0).forEach(c => S.lib.push(c)); commit(); });
      for (const n of ['Grizzly Bears', 'Llanowar Elves', 'Wall of Omens', 'Murderous Rider', 'Vincent Valentine']) await toZone(A, n, 'gy');
      check(await A.evaluate(() => targetSpecs("Return from your graveyard to the battlefield any number of target creature cards that each have a different mana value X or less.").length === 0), 'no bogus battlefield targeting at cast');
      await A.evaluate(async () => { const ctx = {k:null, name:"Agadeem's Awakening", full:'', it:{kind:'spell', x:3}}; await runEffects("Return from your graveyard to the battlefield any number of target creature cards that each have a different mana value X or less.", ctx); commit(); }); await after();
      const r = await A.evaluate(() => S.bf.filter(c => isCreatureCard(c)).map(c => info(c.k).mv).sort());
      check(r.length === 3 && new Set(r).size === 3 && r.every(x => x <= 3), `returned mana values ${JSON.stringify(r)}`); await clearBf(A);
      await A.evaluate(() => { S.gy.splice(0).forEach(c => S.lib.push(c)); commit(); });
      for (const n of ['Grizzly Bears', 'Llanowar Elves', 'Wall of Omens', 'Murderous Rider', 'Vincent Valentine']) await toZone(A, n, 'gy');
      await run(A, 'Return any number of target creature cards with total mana value 6 or less from your graveyard to the battlefield.', 'Phoenix, Warden of Fire'); await after();
      const r2 = await A.evaluate(() => S.bf.filter(c => isCreatureCard(c)).map(c => info(c.k).mv));
      check(r2.length >= 2 && r2.reduce((a, b) => a + b, 0) <= 6, `returned mana values ${JSON.stringify(r2)} (total ≤ 6)`); await clearBf(A);
    });
    await step('Boast: only after attacking, once a turn — twice with Birgi', async () => {
      const id = await putAny(A, 'Varragoth, Bloodsky Sire');
      const ready = () => A.evaluate(id => { const c = S.bf.find(x => x.id === id); S.pool = {...emptyPool(), B:6, C:6}; const ab = abilityList(c).find(a => a.boast); return ab ? abilityReady(c, ab, false) : 'no boast ability'; }, id);
      const r0 = await ready(); check(/attacked/.test(r0), `before attacking: "${r0}"`);
      await A.evaluate(id => { if (!S.r23atk || S.r23atk.t !== turnStr()) S.r23atk = {t:turnStr(), ids:[]}; S.r23atk.ids.push(id); commit(); }, id);
      const r1 = await ready(); check(r1 === '', `after attacking: ready ("${r1}")`);
      await want(A, null, 'Georges'); check(await activate(A, 'Varragoth, Bloodsky Sire', 'searches') === 'ok', 'boasted once'); await after();
      await A.evaluate(id => { const c = S.bf.find(x => x.id === id); c.tap = false; commit(); }, id);
      const r2 = await ready(); check(/once/.test(r2), `second boast without Birgi: "${r2}"`);
      await putAny(A, 'Birgi, God of Storytelling'); await after(); const r3 = await ready(); check(r3 === '', `with Birgi: ready again ("${r3}")`);
      await clearBf(A);
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
