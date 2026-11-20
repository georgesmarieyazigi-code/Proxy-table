// Top combos, slice B (combodata/slice_b.txt): each loop is done twice by hand (or started once for trigger loops);
// the table must spot it, ask how many times, and run it to the exact result.
module.exports = async ({A, B, check, sleep, waitFor, after, fresh, putP, toZone, pool, poolOf, act, castH, life, lost, cnt, noNotes, step}) => {
  const doAll = async (...steps) => { for (const s of steps){ const r = await s(); if (r !== 'ok' && r !== 'mana' && r !== true) return r; await after(); } return true; };
  const chosen = () => A.evaluate(() => window.__chosen || []);
  const W = (o) => A.evaluate(o => Object.assign(window, o), o);
  const tot = p => Object.values(p).reduce((a, b) => a + (+b || 0), 0);
  const gyCast = nm => () => A.evaluate(nm => { const c = S.gy.find(x => cname(x) === nm); if (!c) return nm + ' not in graveyard'; const g = gyOptions(c)[0]; if (!g) return 'no gy option for ' + nm; castFromGy(c, g); return 'ok'; }, nm);
  const libCast = nm => () => A.evaluate(nm => { const c = S.lib[0]; if (!c || cname(c) !== nm) return nm + ' not on top (' + (c && cname(c)) + ')'; beginCast(c, 'lib', {}); return 'ok'; }, nm);
  const kimTo = n => B.evaluate(n => { S.life = n; commit(); }, n);
  const zombie = () => A.evaluate(() => { createFromText('Create a 2/2 black Zombie creature token.', {k:null, name:'setup', it:{}}); commit(); });
  const st = () => A.evaluate(() => ({pool:{...S.pool}, life:S.life, lib:S.lib.length, hand:S.hand.length, tok:S.bf.filter(c => c.tok).reduce((a, c) => a + (c.n || 1), 0)}));
  const repN = () => A.evaluate(() => { S.log.forEach(e => { e.__b0 = 1; }); return 0; });   // the log keeps 40 lines: mark what is old
  const waitRep = (n, L0) => waitFor(A, n => S.log.some(e => !e.__b0 && new RegExp('repeated the loop ' + n + ' times?$').test(e.s)), n, 150000);
  const lastRep = () => A.evaluate(() => (S.log.filter(e => /repeated the loop/.test(e.s) && !e.__b0).pop() || {}).s || 'no repeat');
  // a hand loop: setup → once ×2 → expect the question → n repeats → verify(before, after)
  const hand = (name, setup, once, n, verify, o = {}) => step(name, async () => {
    await fresh(); if (o.kim) { await kimTo(o.kim); await sleep(1000); }
    await setup(); await after(); await pool(A, o.pool || {});
    await A.evaluate(() => { F25.asked = {}; F25.sh = []; }); const L0 = await repN();   // a new combo: forget what was asked before (same turn in this test)
    await W({__wantQ:[o.dead ? 'every opponent is dead' : 'how many times'], __XQ:[n], ...(o.w || {})});
    const r1 = await once(); check(r1 === true, `${name}: loop 1 by hand (${r1})`); await after();
    const s1 = await st();
    if (o.w2) await W(o.w2);
    for (let i = 2; i <= (o.times || 2); i++){ const r2 = await once(); check(r2 === true, `${name}: loop ${i} by hand (${r2})`); await after(); }
    const s2 = await st();
    const asked = await waitFor(A, () => (window.__chosen || []).some(s => /looks like a loop/.test(s)), null, 20000);
    check(asked, `${name}: the table spotted the loop and asked (${JSON.stringify((await chosen()).slice(-3))})`);
    if (o.dead){ const ok = await waitFor(B, () => S.life <= 0, null, 150000); await after(); check(ok && await lost(B), `${name}: repeated until Kim is dead (Kim ${await life(B)}; ${await lastRep()})`); }
    else { const ok = await waitRep(n, L0); await after(); check(ok, `${name}: repeated the loop ${n} times (${await lastRep()})`); }
    await after(); const s3 = await st();
    await verify(s1, s2, s3);
    await noNotes(name);
  });
  // a mandatory trigger loop: setup → kick → "would go on forever" → choice
  const trig = (name, setup, kick, verify, o = {}) => step(name, async () => {
    await fresh(); if (o.kim) { await kimTo(o.kim); await sleep(1000); }
    await setup(); await after(); await sleep(6000);
    await W({__want:[o.n ? 'A number of times' : 'every opponent is dead'], __XQ:o.n ? [o.n] : null, ...(o.w || {})}); await sleep(300);
    if (o.lc) await A.evaluate(re => { window.__lc = 0; window.__lcRe = new RegExp(re); if (!window.__lcw){ window.__lcw = 1; const lg = log; log = function(s){ try { if (window.__lcRe && window.__lcRe.test(String(s))) window.__lc++; } catch {} return lg.apply(this, arguments); }; } }, o.lc);   // count lines (the log keeps only 40)
    const s0 = await st(); await kick(); await after();
    const ok = await waitFor(A, () => (window.__chosen || []).some(s => /go on forever/.test(s)) || (window.__chosen || []).some(s => /looks like a loop/.test(s)), null, 150000);
    check(ok, `${name}: the loop asked how many times (${JSON.stringify((await chosen()).slice(-3))})`);
    if (o.n) await waitFor(A, () => S.log.some(e => /ran the chosen number of times/.test(e.s)), null, 150000);
    else await waitFor(B, () => S.life <= 0, null, 150000);
    await after(); await sleep(2000); await after();
    await verify(s0, await st());
    check(await waitFor(A, () => !stackAll().length && !UI.resolving, null, 30000), `${name}: the stack is empty afterwards`);
    await noNotes(name);
  });

  // #4 Sanguine Bond + Exquisite Blood
  await trig('B04 Sanguine Bond + Exquisite Blood', async () => { await putP(A, 'Sanguine Bond'); await putP(A, 'Exquisite Blood'); },
    () => A.evaluate(() => { gainLife(1, 'test'); commit(); }),
    async () => check(await lost(B), `B04: Kim drained out (Kim ${await life(B)})`), {kim:20, w:{__tgt:'kim'}});

  // #16 Gravecrawler + Phyrexian Altar (a Zombie to cast from the graveyard; Blood Artist as the payoff)
  await hand('B16 Gravecrawler + Phyrexian Altar', async () => { for (const p of ['Gravecrawler', 'Phyrexian Altar', 'Blood Artist']) await putP(A, p); await zombie(); },
    () => doAll(() => act(A, 'Phyrexian Altar', 'Sacrifice', 2), gyCast('Gravecrawler')), 0,
    async () => check(await cnt(A, 'Gravecrawler') === 1, 'B16: Gravecrawler back on the battlefield'), {kim:10, dead:1, w:{__tgt:'kim', __pickRe:'Gravecrawler'}});

  // #22 Basalt Monolith + Forsaken Monument: 3 + 1 per tap, untap for 3 → +1 each loop
  await hand('B22 Basalt Monolith + Forsaken Monument', async () => { await putP(A, 'Basalt Monolith'); await putP(A, 'Forsaken Monument'); },
    () => doAll(() => act(A, 'Basalt Monolith', 'Add'), () => act(A, 'Basalt Monolith', 'Untap')), 7,
    async (s1, s2, s3) => check(s1.pool.C === 1 && s3.pool.C === 9, `B22: +1 {C} per loop (${s1.pool.C} → ${s3.pool.C} after 1 + 7 more)`));

  // #41 / #55 / #117 Warren Soultrader + Gravecrawler + a drain payoff
  for (const [id, pay] of [['B41', 'Blood Artist'], ['B55', 'Zulaport Cutthroat'], ['B117', 'Bastion of Remembrance']])
    await hand(`${id} Warren Soultrader + Gravecrawler + ${pay}`, async () => { for (const p of ['Warren Soultrader', 'Gravecrawler', pay]) await putP(A, p); },
      () => doAll(() => act(A, 'Warren Soultrader', 'Sacrifice'), () => act(A, 'Treasure', 'Add', 2), gyCast('Gravecrawler')), 0,
      async (s1, s2, s3) => { check(await cnt(A, 'Gravecrawler') === 1, `${id}: Gravecrawler back`); check(s3.life === s1.life + 0 || s3.life >= s2.life, `${id}: life does not drop (${s1.life}, ${s2.life} → ${s3.life})`); },
      {kim:8, dead:1, w:{__tgt:'kim', __pickRe:'Gravecrawler'}});

  // #61 Gravecrawler + Pitiless Plunderer + Ashnod's Altar: +{C}{C} per loop
  await hand("B61 Gravecrawler + Pitiless Plunderer + Ashnod's Altar", async () => { for (const p of ['Gravecrawler', 'Pitiless Plunderer', "Ashnod's Altar"]) await putP(A, p); await zombie(); },
    () => doAll(() => act(A, "Ashnod's Altar", 'Sacrifice'), () => act(A, 'Treasure', 'Add', 2), gyCast('Gravecrawler')), 6,
    async (s1, s2, s3) => check(s1.pool.C === 2 && s3.pool.C === 16, `B61: +2 {C} per loop (${s1.pool.C} → ${s3.pool.C} after 1 + 6 more; ${JSON.stringify(s3.pool)})`), {w:{__pickRe:'Gravecrawler'}});

  // #131 Ashnod's Altar + Cathars' Crusade (+ a persist creature): +{C}{C} and +2 life per loop
  await hand("B131 Ashnod's Altar + Cathars' Crusade + Kitchen Finks", async () => { for (const p of ['Kitchen Finks', "Ashnod's Altar", "Cathars' Crusade"]) await putP(A, p); },
    () => doAll(() => act(A, "Ashnod's Altar", 'Sacrifice')), 5,
    async (s1, s2, s3) => { check(s3.pool.C === s1.pool.C + 14, `B131: +2 {C} per loop (${s1.pool.C} → ${s3.pool.C})`); check(s3.life === s1.life + 14, `B131: +2 life per loop (${s1.life} → ${s3.life})`);
      const f = await A.evaluate(() => S.bf.filter(x => cname(x) === 'Kitchen Finks').map(x => [x.cp || 0, x.cm || 0])); check(f.length === 1 && f[0][0] === 0 && f[0][1] === 0, `B131: Finks back with no counters (${JSON.stringify(f)})`); },
    {times:3, w:{__pickRe:'Kitchen Finks'}});

  // #35 Heliod, Sun-Crowned + Walking Ballista (lifelink from Heliod), done by hand
  await hand('B35 Heliod, Sun-Crowned + Walking Ballista', async () => { await putP(A, 'Heliod, Sun-Crowned'); await putP(A, 'Walking Ballista', {cp:2}); await W({__tgt:'Walking Ballista'}); await pool(A, {W:1, C:1});
      check(await act(A, 'Heliod, Sun-Crowned', 'lifelink') === 'ok', 'B35: Ballista gains lifelink'); await after(); },
    () => doAll(() => act(A, 'Walking Ballista', 'Remove')), 0,
    async () => check(await A.evaluate(() => (S.bf.find(x => cname(x) === 'Walking Ballista') || {}).cp) === 2, 'B35: Ballista still has 2 counters'),
    {kim:10, dead:1, times:3, w:{__tgt:'Walking Ballista', __tgtQ:['kim', 'Walking Ballista', 'kim', 'Walking Ballista', 'kim', 'Walking Ballista']}});

  // ---- Sensei's Divining Top + Mystic Forge lines: tap Top (draw, Top goes on top), cast it again from the top
  const topSetup = (...more) => async () => { await putP(A, "Sensei's Divining Top"); for (const p of more) await putP(A, p); };
  const topOnce = (cost) => () => doAll(() => act(A, "Sensei's Divining Top", 'Draw a card'), libCast("Sensei's Divining Top"));
  const drew = id => async (s1, s2, s3) => { check(s3.hand - s1.hand === 7, `${id}: drew one card per loop (hand ${s1.hand} → ${s3.hand})`); check(await cnt(A, "Sensei's Divining Top") === 1, `${id}: Top back on the battlefield`); };
  await hand("B28 Sensei's Divining Top + Foundry Inspector + Mystic Forge", topSetup('Foundry Inspector', 'Mystic Forge'), topOnce(), 6, drew('B28'));
  await hand("B150 Sensei's Divining Top + Mystic Forge + Jhoira's Familiar", topSetup("Jhoira's Familiar", 'Mystic Forge'), topOnce(), 6, drew('B150'));
  await hand("B68 Sensei's Divining Top + Mystic Forge + Cloud Key", async () => { await topSetup('Mystic Forge')(); await toZone(A, 'Cloud Key', 'hand'); await pool(A, {C:3}); await W({__want:'^artifact'});
      check(await castH(A, 'Cloud Key') === 'ok', 'B68: cast Cloud Key naming artifact'); await after(); await W({__want:null}); },
    topOnce(), 6, drew('B68'));
  // Glaring Fleshraker: casting Top makes a Spawn (which pays for the next Top) and the Spawn entering pings each opponent
  await hand("B146 Sensei's Divining Top + Glaring Fleshraker + Mystic Forge", topSetup('Glaring Fleshraker', 'Mystic Forge'),
    () => doAll(() => act(A, "Sensei's Divining Top", 'Draw a card'), libCast("Sensei's Divining Top"), () => act(A, 'Eldrazi Spawn', 'Add')), 0,
    async (s1, s2, s3) => check(s3.hand > s1.hand, `B146: drew cards (hand ${s1.hand} → ${s3.hand})`), {kim:8, dead:1, pool:{C:1}, w:{__tgt:'kim'}});
  // Bolas's Citadel: Top costs 1 life from the top of the library, Sheoldred gives 2 per draw
  await hand("B139 Sensei's Divining Top + Bolas's Citadel + Sheoldred, the Apocalypse", topSetup("Bolas's Citadel", 'Sheoldred, the Apocalypse'),
    () => doAll(() => act(A, "Sensei's Divining Top", 'Draw a card'), () => A.evaluate(() => { if (cname(S.lib[0]) !== "Sensei's Divining Top") return 'Top not on top'; r23fPlayTop(true); return 'ok'; })), 6,
    async (s1, s2, s3) => { check(s3.hand - s1.hand === 7, `B139: +1 card per loop (${s1.hand} → ${s3.hand})`); check(s3.life - s1.life === 7, `B139: +2 −1 = +1 life per loop (${s1.life} → ${s3.life})`); });

  const teferi3 = () => A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Teferi, Time Raveler'); if (!c) return 'no Teferi'; const i = loyaltyAbs(c).findIndex(a => /^[−-]3$/.test(a.raw)); const w = loyaltyReady(c, loyaltyAbs(c)[i]); if (w) return 'Teferi: ' + w; activateLoyalty(c, i); return 'ok'; });
  // ---- Teferi, Time Raveler + Displacer Kitten + a cheap artifact: −3 bounces it (draw), recasting it blinks Teferi
  await hand('B120 Teferi, Time Raveler + Displacer Kitten + Mana Vault', async () => { for (const p of ['Teferi, Time Raveler', 'Displacer Kitten', 'Mana Vault']) await putP(A, p); },
    () => doAll(() => act(A, 'Mana Vault', 'Add'), teferi3, () => castH(A, 'Mana Vault')), 5,
    async (s1, s2, s3) => { check(s3.pool.C - s1.pool.C === 12, `B120: +2 {C} per loop (${s1.pool.C} → ${s3.pool.C})`); check(s3.hand - s1.hand === 6, `B120: +1 card per loop (${s1.hand} → ${s3.hand})`); },
    {w:{__tgtQ:['Mana Vault', 'Teferi', 'Mana Vault', 'Teferi', 'Mana Vault', 'Teferi']}});
  await hand('B168 Teferi, Time Raveler + Displacer Kitten + Mox Opal', async () => { for (const p of ['Teferi, Time Raveler', 'Displacer Kitten', 'Mox Opal', 'Sol Ring', 'Basalt Monolith']) await putP(A, p); },
    () => doAll(() => act(A, 'Mox Opal', 'Add'), teferi3, () => castH(A, 'Mox Opal')), 5,
    async (s1, s2, s3) => { check(tot(s3.pool) - tot(s1.pool) === 6, `B168: +1 mana per loop (${JSON.stringify(s1.pool)} → ${JSON.stringify(s3.pool)})`); check(s3.hand - s1.hand === 6, `B168: +1 card per loop (${s1.hand} → ${s3.hand})`); },
    {w:{__tgtQ:['Mox Opal', 'Teferi', 'Mox Opal', 'Teferi', 'Mox Opal', 'Teferi']}});

  // ---- Walking Ballista + Hardened Scales + Gatta and Luzzu: pinging Ballista itself adds 2, pinging Kim costs 1
  await hand('B98 Walking Ballista + Hardened Scales + Gatta and Luzzu', async () => { await putP(A, 'Hardened Scales'); await putP(A, 'Walking Ballista', {cp:2}); await toZone(A, 'Gatta and Luzzu', 'hand'); await pool(A, {W:1, C:2}); await W({__tgt:'Walking Ballista'});
      check(await castH(A, 'Gatta and Luzzu', {flash:true}) === 'ok', 'B98: flash in Gatta and Luzzu on Ballista'); await after(); },
    () => doAll(() => act(A, 'Walking Ballista', 'Remove'), () => act(A, 'Walking Ballista', 'Remove')), 0,
    async () => check(await A.evaluate(() => (S.bf.find(x => cname(x) === 'Walking Ballista') || {}).cp) >= 1, 'B98: Ballista keeps its counters'),
    {kim:6, dead:1, w:{__tgtQ:['Walking Ballista', 'kim', 'Walking Ballista', 'kim']}});

  // ---- Forsaken Miner: Blood Artist targeting Kim is a crime → pay {B} (from the Treasure) and Miner comes back
  for (const [id, pay] of [['B102', 'Blood Artist'], ['B171', 'Sephiroth, Fabled SOLDIER']])
    await hand(`${id} Warren Soultrader + Forsaken Miner + ${pay}`, async () => { for (const p of [pay, 'Warren Soultrader', 'Forsaken Miner']){ await putP(A, p); await after(); } },
      () => doAll(() => act(A, 'Warren Soultrader', 'Sacrifice'), () => act(A, 'Treasure', 'Add', 2)), 0,
      async () => check(await cnt(A, 'Forsaken Miner') === 1, `${id}: Forsaken Miner back`), {kim:8, dead:1, pool:{B:1}, w:{__tgt:'kim', __pickRe:'Forsaken Miner', __want:['^yes|^pay']}});
  await hand('B136 Warren Soultrader + Gravecrawler + Sephiroth, Fabled SOLDIER', async () => { for (const p of ['Sephiroth, Fabled SOLDIER', 'Warren Soultrader', 'Gravecrawler']){ await putP(A, p); await after(); } },
    () => doAll(() => act(A, 'Warren Soultrader', 'Sacrifice'), () => act(A, 'Treasure', 'Add', 2), gyCast('Gravecrawler')), 0,
    async () => check(await cnt(A, 'Gravecrawler') === 1, 'B136: Gravecrawler back'), {kim:8, dead:1, w:{__tgt:'kim', __pickRe:'Gravecrawler'}});
  // #73 Gravecrawler + Pitiless Plunderer + Viscera Seer (Blood Artist as the payoff: the loop itself gains nothing countable)
  await hand('B73 Gravecrawler + Pitiless Plunderer + Viscera Seer (+ Blood Artist)', async () => { for (const p of ['Gravecrawler', 'Pitiless Plunderer', 'Viscera Seer', 'Blood Artist']) await putP(A, p); await zombie(); },
    () => doAll(() => act(A, 'Viscera Seer', 'Sacrifice'), () => act(A, 'Treasure', 'Add', 2), gyCast('Gravecrawler')), 0,
    async () => check(await cnt(A, 'Gravecrawler') === 1, 'B73: Gravecrawler back'), {kim:8, dead:1, w:{__tgt:'kim', __pickRe:'Gravecrawler', __want:['keep|top']}});
  // #165 Reassembling Skeleton + Phyrexian Altar + Pawn of Ulamog (+ Blood Artist)
  await hand('B165 Reassembling Skeleton + Phyrexian Altar + Pawn of Ulamog (+ Blood Artist)', async () => { await putP(A, 'Reassembling Skeleton', {tap:true}); for (const p of ['Phyrexian Altar', 'Pawn of Ulamog', 'Blood Artist']) await putP(A, p); },   // the Skeleton comes back tapped: start it tapped
    () => doAll(() => act(A, 'Phyrexian Altar', 'Sacrifice', 2), () => act(A, 'Eldrazi Spawn', 'Add'),
      () => A.evaluate(async () => { const c = S.gy.find(x => cname(x) === 'Reassembling Skeleton'); if (!c) return 'Skeleton not in graveyard'; const o = f27aGyRet(c)[0]; if (!o) return 'no gy ability'; await o.run(); return 'ok'; })), 0,
    async () => check(await cnt(A, 'Reassembling Skeleton') === 1, 'B165: Skeleton back'), {kim:8, dead:1, w:{__tgt:'kim', __pickRe:'Reassembling Skeleton', __want:['^yes|create']}});
  // #109 Ashaya + Quirion Ranger (+ Nissa, Resurgent Animist so each landfall makes a mana)
  await hand('B109 Ashaya, Soul of the Wild + Quirion Ranger (+ Nissa)', async () => { for (const p of ['Ashaya, Soul of the Wild', 'Quirion Ranger', 'Nissa, Resurgent Animist']) await putP(A, p); },
    () => doAll(() => act(A, 'Ashaya, Soul of the Wild', 'Add'), () => act(A, 'Quirion Ranger', 'Return a Forest'), () => castH(A, 'Quirion Ranger')), 4,
    async (s1, s2, s3) => check(tot(s3.pool) - tot(s1.pool) === 5, `B109: +1 mana per loop (${JSON.stringify(s1.pool)} → ${JSON.stringify(s3.pool)})`),
    {w:{__pickRe:'Quirion Ranger', __tgtQ:['Ashaya', 'Ashaya', 'Ashaya'], __want:['^\\{G\\}|^G$|green']}});

  // ---- trigger loops
  await trig('B31 Restoration Angel + Felidar Guardian', async () => { await putP(A, 'Felidar Guardian'); await toZone(A, 'Restoration Angel', 'hand'); },
    async () => { await W({__tgt:'Felidar|Restoration'}); await pool(A, {W:1, C:3}); return castH(A, 'Restoration Angel', {flash:true}); },
    async () => { const n = await A.evaluate(() => window.__lc || 0); check(n >= 5, `B31: Felidar and Angel blinked each other the chosen 5 times or more (${n})`);
      check(await cnt(A, 'Restoration Angel') === 1 && await cnt(A, 'Felidar Guardian') === 1, 'B31: both still on the battlefield'); }, {n:5, lc:'^trigger: Felidar Guardian', w:{__want:['A number of times', '^yes|exile']}});
  await trig('B105 Scurry Oak + Ivy Lane Denizen', async () => { await putP(A, 'Scurry Oak'); await putP(A, 'Ivy Lane Denizen'); },
    () => A.evaluate(() => { window.__tgt = 'Scurry Oak'; createFromText('Create a 1/1 green Squirrel creature token.', {k:null, name:'setup', it:{}}); commit(); }),
    async (s0, s1) => { check(s1.tok - s0.tok >= 5, `B105: Squirrels for the chosen rounds (${s0.tok} → ${s1.tok})`); }, {n:5, w:{__want:['A number of times', '^yes|create']}});
  // B47: needs simultaneous triggers ordered (token maker first)
  await trig('B47 Hapatra, Vizier of Poisons + Blowfly Infestation', async () => { await putP(A, 'Hapatra, Vizier of Poisons'); await putP(A, 'Blowfly Infestation');
      await A.evaluate(() => { createFromText('Create two 1/1 green Snake creature tokens with deathtouch.', {k:null, name:'setup', it:{}}); commit(); }); },
    () => A.evaluate(() => { window.__tgt = 'Snake'; const sn = S.bf.find(x => cname(x) === 'Snake'); modCounters(single(sn), 'cm', 1); commit(); return 'ok'; }),
    async () => { const n = await A.evaluate(() => window.__lc || 0); check(n >= 5, `B47: Blowfly went round the chosen 5 times or more (${n})`); }, {n:5, lc:'^trigger: Blowfly Infestation', w:{__want:['A number of times', '^yes']}});
  await trig('B82 Tandem Lookout + Niv-Mizzet, Parun', async () => { await putP(A, 'Niv-Mizzet, Parun'); await toZone(A, 'Tandem Lookout', 'hand'); await pool(A, {U:1, C:2}); await W({__want:['^pair|^yes']});
      check(await castH(A, 'Tandem Lookout') === 'ok', 'B82: cast Tandem Lookout'); await after(); await after();
      check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Tandem Lookout' && c.r26pair != null)), 'B82: Lookout paired with Niv-Mizzet'); },
    () => A.evaluate(() => { draw(1); commit(); }),
    async () => check(await lost(B), `B82: Niv pinged Kim to death (Kim ${await life(B)})`), {kim:10, w:{__tgt:'kim'}});
  for (const [id, sp, tg] of [['B19', 'Twinflame', 'Grizzly Bears'], ['B38', 'Molten Duplication', 'Grizzly Bears'], ['B113', 'Electroduplicate', 'Grizzly Bears'], ['B123', 'Heat Shimmer', 'Grizzly Bears']])
    await trig(`${id} Dualcaster Mage + ${sp}`, async () => { await putP(A, tg); await toZone(A, sp, 'hand'); await toZone(A, 'Dualcaster Mage', 'hand'); },
      async () => { await W({__tgt:tg}); await pool(A, {R:3, C:1}); check(await castH(A, sp) === 'ok', `${id}: cast ${sp}`); await sleep(800);
        await W({__tgt:'Dualcaster Mage', __want:['A number of times', 'yes|copy|new targets']}); await pool(A, {R:2, C:1}); return castH(A, 'Dualcaster Mage', {flash:true}); },
      async () => { const n = await cnt(A, 'Dualcaster Mage'); check(n >= 5, `${id}: hasty Dualcaster copies for the chosen rounds (${n})`); }, {n:5});

  // ---- more
  // #44 Mikaeus, the Unhallowed + Ashnod's Altar (+ Walking Ballista to shed the undying counter): +{C}{C} and 1 damage per loop
  await hand("B44 Mikaeus, the Unhallowed + Ashnod's Altar (+ Walking Ballista)", async () => { await putP(A, 'Mikaeus, the Unhallowed'); await putP(A, "Ashnod's Altar"); await putP(A, 'Walking Ballista', {cp:1}); },
    () => doAll(() => act(A, 'Walking Ballista', 'Remove'), () => act(A, "Ashnod's Altar", 'Sacrifice')), 0,
    async (s1, s2, s3) => { check(s3.pool.C > s1.pool.C, `B44: colorless mana piled up (${s1.pool.C} → ${s3.pool.C})`); },
    {kim:6, dead:1, w:{__tgt:'kim', __pickRe:'Walking Ballista'}});
  // #94 Academy Manufactor + Warren Soultrader + Chatterfang (+ Blood Artist so each sacrifice is paid back)
  await hand('B94 Academy Manufactor + Warren Soultrader + Chatterfang (+ Blood Artist)', async () => { for (const p of ['Academy Manufactor', 'Warren Soultrader', 'Chatterfang, Squirrel General', 'Blood Artist']) await putP(A, p);
      await A.evaluate(() => { createFromText('Create a 1/1 green Squirrel creature token.', {k:null, name:'setup', it:{}}); commit(); }); },
    () => doAll(() => act(A, 'Warren Soultrader', 'Sacrifice')), 0,
    async (s1, s2, s3) => check(s3.tok > s1.tok + 10, `B94: tokens pile up (${s1.tok} → ${s3.tok})`), {kim:6, dead:1, times:3, w:{__tgt:'kim', __pickRe:'^Squirrel$'}});
  // #127 Peregrin Took + Warren Soultrader + Chatterfang (+ Blood Artist)
  await hand('B127 Peregrin Took + Warren Soultrader + Chatterfang (+ Blood Artist)', async () => { for (const p of ['Peregrin Took', 'Warren Soultrader', 'Chatterfang, Squirrel General', 'Blood Artist']) await putP(A, p);
      await A.evaluate(() => { createFromText('Create a 1/1 green Squirrel creature token.', {k:null, name:'setup', it:{}}); commit(); }); },
    () => doAll(() => act(A, 'Warren Soultrader', 'Sacrifice')), 0,
    async (s1, s2, s3) => check(s3.tok > s1.tok + 10, `B127: tokens pile up (${s1.tok} → ${s3.tok})`), {kim:6, dead:1, times:3, w:{__tgt:'kim', __pickRe:'^Squirrel$'}});
  // #50 Orcish Bowmasters + Peer into the Abyss: not a loop — Kim draws half the library and Bowmasters fires for each card
  await step('B50 Orcish Bowmasters + Peer into the Abyss', async () => {
    await fresh(); await putP(A, 'Orcish Bowmasters'); await after(); await toZone(A, 'Peer into the Abyss', 'hand'); await pool(A, {B:3, C:4});
    const n0 = await B.evaluate(() => S.lib.length); const h0 = await B.evaluate(() => S.hand.length); const want = Math.ceil(n0 / 2);
    const a0 = await A.evaluate(() => S.bf.filter(c => /\bArmy\b/.test(typeOf(c))).reduce((a, c) => a + (c.cp || 0), 0));
    await W({__tgt:'kim'}); check(await castH(A, 'Peer into the Abyss') === 'ok', 'B50: cast Peer into the Abyss on Kim'); await after();
    await waitFor(B, n => S.hand.length >= n, h0 + want, 60000); await sleep(3000); await after(); await sleep(3000); await after();
    const h1 = await B.evaluate(() => S.hand.length); check(h1 - h0 === want, `B50: Kim drew half the library (${want}; hand ${h0} → ${h1})`);
    const armyN = () => A.evaluate(() => S.bf.filter(c => /\bArmy\b/.test(typeOf(c))).reduce((a, c) => a + (c.cp || 0), 0));
    await waitFor(B, () => S.life <= 0, null, 150000); await after(); await sleep(2000); await after();
    const army = await armyN(); check(await lost(B), `B50: Peer took half of Kim's life, then a Bowmasters ping per card drawn finished Kim (Kim ${await life(B)})`);
    check(army - a0 >= 19, `B50: one Bowmasters trigger (amass 1) per card drawn until Kim died — the Army got ${army - a0} counters`);
    await noNotes('B50');
  });

  // #153 The Gitrog Monster + The Necrobloom: lands in the graveyard have dredge 2; each draw is dredged, milling lands, which draws again
  await step('B153 The Gitrog Monster + The Necrobloom', async () => {
    await fresh(); await putP(A, 'The Gitrog Monster'); await putP(A, 'The Necrobloom'); await after();
    await A.evaluate(() => { const lands = S.lib.filter(c => isLand(c.k)); lands.forEach(c => { S.lib.splice(S.lib.indexOf(c), 1); S.lib.unshift(c); });
      const l = lands.pop(); moveCard(l.id, 'hand', {quiet:true}); commit(); });
    await W({__want:['^Dredge', 'A number of times'], __XQ:[40], __pickRe:'Forest|Island|Swamp|Plains|Mountain'}); const l0 = await A.evaluate(() => S.lib.length);
    await A.evaluate(() => { const c = S.hand.find(x => isLand(x.k)); moveCard(c.id, 'gy'); commit(); });   // discard a land
    await after(); await sleep(4000); await after(); await waitFor(A, () => !stackAll().length && !UI.resolving && !UI.modal, null, 120000); await after();
    const s = await A.evaluate(() => ({lib:S.lib.length, gyL:S.gy.filter(c => isLand(c.k)).length, ch:(window.__chosen || []).filter(x => /dredge/i.test(x)).length}));
    check(l0 - s.lib >= 20, `B153: the dredge chain milled the library (${l0} → ${s.lib}; ${s.ch} dredges, ${s.gyL} lands in the graveyard)`);
    await noNotes('B153');
  });
};
