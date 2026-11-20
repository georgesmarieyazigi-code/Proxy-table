// Top combos, slice A: each loop is done by hand (twice, or three times for a one-action loop); the table must spot it, ask how many times, and repeat it.
module.exports = async ({A, B, check, sleep, waitFor, after, fresh, putP, toZone, pool, poolOf, act, castH, life, lost, cnt, noNotes, step}) => {
  const doAll = async (...steps) => { for (const s of steps){ const r = await s(); if (r !== 'ok' && r !== 'mana') return r; await after(); } return true; };
  const chosen = () => A.evaluate(() => window.__chosen || []);
  const tot = p => Object.values(p).reduce((a, b) => a + (+b || 0), 0);
  const set = o => A.evaluate(o => Object.assign(window, o), o);
  const mkTok = (txt) => A.evaluate(t => { createFromText(t, {k:null, name:'setup', it:{}}); commit(); }, txt);
  const tokN = (nm) => A.evaluate(nm => S.bf.filter(c => (c.tok || c.token) && new RegExp(nm, 'i').test(cname(c))).reduce((a, c) => a + (c.n || 1), 0), nm);
  const handN = () => A.evaluate(() => S.hand.length);
  // activate an ability of a card in my graveyard (Reassembling Skeleton …)
  const gyAct = (nm, re) => A.evaluate(async ([nm, re]) => { const c = S.gy.find(x => cname(x) === nm); if (!c) return nm + ' not in graveyard'; const L = r21bGyAbils(c); const o = L.find(x => new RegExp(re, 'i').test(x.label)); if (!o) return 'no gy ability ' + JSON.stringify(L.map(x => x.label)); if (o.why) return o.why; await o.run(); return 'ok'; }, [nm, re]);
  const gyCast = (nm) => A.evaluate(nm => { const c = S.gy.find(x => cname(x) === nm); if (!c) return nm + ' not in graveyard'; const g = gyOptions(c)[0]; if (!g) return 'no option'; castFromGy(c, g); return 'ok'; }, nm);
  const zoneCast = (nm, z) => A.evaluate(([nm, z]) => { const c = S[z].find(x => cname(x) === nm); if (!c) return nm + ' not in ' + z; beginCast(c, z, {}); return 'ok'; }, [nm, z]);
  const kimDrain = async (pieces, kick) => {
    await B.evaluate(() => { S.life = 12; commit(); }); await sleep(1500);
    for (const p of pieces) check(!!(await putP(A, p)), `${p} on the battlefield`);
    await set({__tgt:'kim', __want:['every opponent is dead']}); await sleep(500);
    await kick(); await after();
    const ok = await waitFor(B, () => S.life <= 0, null, 150000); await after();
    check(ok && await lost(B), `the loop drains Kim to 0 and she loses (Kim ${await life(B)}, Georges ${await life(A)})`);
    check(await waitFor(A, () => !stackAll().length && !UI.resolving, null, 30000), 'the loop stops once nobody is left');
  };
  const kimLoses1 = () => B.evaluate(() => { damageMe(1, {}, 'test'); commit(); });
  const iGain1 = () => A.evaluate(() => { gainLife(1, 'test'); commit(); });
  // a hand loop: do it `reps` times by hand, the table asks, repeat n more; measure() before the 2nd-to-last by-hand loop and at the end
  const handLoop = async (name, once, n, measure, expect, reps = 2) => {
    await set({__wantQ:['how many times'], __XQ:[n]}); await A.evaluate(() => { F25.asked = {}; F25.sh = []; });   // each step is a new situation in the same test turn
    let m0 = null;
    for (let i = 0; i < reps; i++){ if (i === reps - 1) m0 = await measure(); const r = await once(); check(r === true, `${name}: loop ${i + 1} by hand (${r})`); if (r !== true) return; }
    await after();
    const ok = await waitFor(A, n => S.log.some(e => new RegExp('repeated the loop ' + n + ' times').test(e.s)), n, 120000); await after();
    if (!ok && process.env.DBG) console.log('    ANS:', await A.evaluate(() => JSON.stringify(F25.sh.slice(-6).map(e => [e.a.t, f25ans(e).slice(0, 300)]))));
    if (!ok) console.log('    F25:', await A.evaluate(() => JSON.stringify({sh:F25.sh.slice(-9).map(e => [e.a.t, info(e.a.k)?.n, e.a.ai, e.pool, e.tok, e.life, e.hand, e.sig.length, Object.keys(e.loss).length]), sig:f25sig().length, asked:F25.asked, find:!!f25find()})));
    check(ok, `${name}: the table spotted the loop and repeated it ${n} times (${JSON.stringify((await chosen()).slice(-3))}; ${await A.evaluate(() => (S.log.filter(e => /repeated the loop/.test(e.s)).pop() || {}).s)})`);
    const m1 = await measure(); expect(m0, m1, n + 1);
    await noNotes(name);
  };

  // ---------------------------------------------------------------- life-drain trigger loops
  await step('A15 Sanguine Bond + Bloodthirsty Conqueror', async () => { await fresh(); await kimDrain(['Sanguine Bond', 'Bloodthirsty Conqueror'], iGain1); await noNotes('A15'); });
  await step('A18 Exquisite Blood + Enduring Tenacity', async () => { await fresh(); await kimDrain(['Exquisite Blood', 'Enduring Tenacity'], kimLoses1); await noNotes('A18'); });
  await step('A24 Enduring Tenacity + Bloodthirsty Conqueror', async () => { await fresh(); await kimDrain(['Enduring Tenacity', 'Bloodthirsty Conqueror'], iGain1); await noNotes('A24'); });
  await step('A40 Marauding Blight-Priest + Bloodthirsty Conqueror', async () => { await fresh(); await kimDrain(['Marauding Blight-Priest', 'Bloodthirsty Conqueror'], iGain1); await noNotes('A40'); });
  await step('A170 Starscape Cleric + Bloodthirsty Conqueror', async () => { await fresh(); await kimDrain(['Starscape Cleric', 'Bloodthirsty Conqueror'], kimLoses1); await noNotes('A170'); });

  // ---------------------------------------------------------------- mana loops
  await step('A01 Hullbreaker Horror + Sol Ring (+ a free spell)', async () => {
    await fresh(); await putP(A, 'Hullbreaker Horror'); await putP(A, 'Sol Ring'); await toZone(A, 'Ornithopter', 'hand'); await pool(A, {});
    await set({__want:['nonland permanent'], __tgtQ:['Sol Ring', 'Ornithopter', 'Sol Ring', 'Ornithopter']});
    await handLoop('A01', () => doAll(() => act(A, 'Sol Ring', 'Add'), () => castH(A, 'Ornithopter'), () => castH(A, 'Sol Ring')), 5,
      async () => tot(await poolOf(A)), (a, b, k) => check(b - a === k, `A01: +1 {C} per loop (${a} → ${b})`));
  });
  await step('A43 Kinnan + Basalt Monolith', async () => {
    await fresh(); await putP(A, 'Kinnan, Bonder Prodigy'); await putP(A, 'Basalt Monolith'); await pool(A, {});
    await handLoop('A43', () => doAll(() => act(A, 'Basalt Monolith', 'Add \\{C\\}\\{C\\}\\{C\\}'), () => act(A, 'Basalt Monolith', '^\\{3\\}: Untap')), 5,
      async () => (await poolOf(A)).C || 0, (a, b, k) => check(b - a === k, `A43: +1 {C} per loop (${a} → ${b})`));
  });
  await step("A21 Pitiless Plunderer + Ashnod's Altar + Reassembling Skeleton", async () => {
    await fresh(); for (const p of ['Pitiless Plunderer', "Ashnod's Altar", 'Reassembling Skeleton']) await putP(A, p); await pool(A, {});
    await set({__pickRe:'Reassembling', __want:['^B$|black|\\{B\\}']});
    await handLoop('A21', () => doAll(() => act(A, "Ashnod's Altar", 'Sacrifice'), () => act(A, 'Treasure', 'Add', 2), () => gyAct('Reassembling Skeleton', 'Return')), 5,
      async () => ({p:tot(await poolOf(A)), t:await tokN('Treasure')}), (a, b, k) => { check(b.p - a.p === k, `A21: +1 mana per loop (${a.p} → ${b.p})`); check(b.t === a.t, `A21: Treasures made and spent (${a.t} → ${b.t})`);  }, 3);
    check(await cnt(A, 'Reassembling Skeleton') === 1, 'A21: Skeleton is back on the battlefield');
  });
  await step('A87 Staff of Domination + Marwyn, the Nurturer (power 5)', async () => {
    await fresh(); await putP(A, 'Staff of Domination'); await putP(A, 'Marwyn, the Nurturer', {cp:4}); await pool(A, {});
    await set({__tgt:'Marwyn'});
    await handLoop('A87', () => doAll(() => act(A, 'Marwyn, the Nurturer', 'Add'), () => act(A, 'Staff of Domination', '\\{3\\}, \\{T\\}: Untap target creature'), () => act(A, 'Staff of Domination', '^\\{1\\}: Untap')), 5,
      async () => (await poolOf(A)).G || 0, (a, b, k) => check(b - a === k, `A87: +1 {G} per loop (${a} → ${b})`));
  });
  await step('A167 Staff of Domination + Selvala, Heart of the Wilds (+ a 7-power creature)', async () => {
    await fresh(); await putP(A, 'Staff of Domination'); await putP(A, 'Selvala, Heart of the Wilds'); await putP(A, 'Hullbreaker Horror'); await pool(A, {G:1});
    await set({__tgt:'Selvala', __want:['^G$|green|\\{G\\}']});
    await handLoop('A167', () => doAll(() => act(A, 'Selvala, Heart of the Wilds', 'Add X'), () => act(A, 'Staff of Domination', '\\{3\\}, \\{T\\}: Untap target creature'), () => act(A, 'Staff of Domination', '^\\{1\\}: Untap')), 5,
      async () => tot(await poolOf(A)), (a, b, k) => check(b - a === 2 * k, `A167: +2 mana per loop (${a} → ${b})`));
  });
  await step('A75 Squee, the Immortal + Food Chain', async () => {
    await fresh(); await putP(A, 'Food Chain'); await putP(A, 'Squee, the Immortal'); await pool(A, {});
    await set({__pickRe:'Squee', __want:['^R$|red|\\{R\\}']});
    await handLoop('A75', () => doAll(() => act(A, 'Food Chain', 'Exile'), () => zoneCast('Squee, the Immortal', 'ex')), 5,
      async () => tot(await poolOf(A)), (a, b, k) => check(b - a === k, `A75: +1 creature-only mana per loop (${a} → ${b})`));
    check(await cnt(A, 'Squee, the Immortal') === 1, 'A75: Squee is back on the battlefield');
  });

  // ---------------------------------------------------------------- token / draw loops
  await step('A27 Peregrin Took + Nuka-Cola Vending Machine', async () => {
    await fresh(); await mkTok('Create three Food tokens.'); await putP(A, 'Nuka-Cola Vending Machine'); await putP(A, 'Peregrin Took'); await pool(A, {});
    await set({__pick:3, __pickRe:'Food'});
    await handLoop('A27', () => doAll(() => act(A, 'Peregrin Took', 'Sacrifice three Foods')), 4,
      async () => ({t:await tokN('Treasure'), f:await tokN('Food'), h:await handN()}), (a, b, k) => { check(b.t - a.t === 3 * k, `A27: +3 Treasures per loop (${a.t} → ${b.t})`); check(b.h - a.h === k, `A27: +1 card per loop (${a.h} → ${b.h})`); check(b.f === a.f, `A27: Foods stay at ${a.f} (${b.f})`); }, 3);
  });
  await step('A46 Experimental Confectioner + Peregrin Took', async () => {
    await fresh(); await mkTok('Create three Food tokens.'); await putP(A, 'Experimental Confectioner'); await putP(A, 'Peregrin Took'); await pool(A, {});
    await set({__pick:3, __pickRe:'Food'});
    await handLoop('A46', () => doAll(() => act(A, 'Peregrin Took', 'Sacrifice three Foods')), 4,
      async () => ({r:await tokN('Rat'), f:await tokN('Food'), h:await handN()}), (a, b, k) => { check(b.r - a.r === 3 * k, `A46: +3 Rats per loop (${a.r} → ${b.r})`); check(b.h - a.h === k, `A46: +1 card per loop (${a.h} → ${b.h})`); check(b.f === a.f, `A46: Foods stay at ${a.f} (${b.f})`); }, 3);
  });
  await step('A112 Kiki-Jiki + Zealous Conscripts', async () => {
    await fresh(); await putP(A, 'Kiki-Jiki, Mirror Breaker'); await putP(A, 'Zealous Conscripts'); await pool(A, {});
    await set({__tgtQ:Array.from({length:30}, (_, i) => i % 2 ? 'Kiki-Jiki' : 'Zealous')});
    await handLoop('A112', () => doAll(() => act(A, 'Kiki-Jiki, Mirror Breaker', 'Create a token')), 4,
      async () => await tokN('Zealous'), (a, b, k) => check(b - a === k, `A112: +1 hasty Conscripts token per loop (${a} → ${b})`), 3);
  });
  await step('A67 Chatterfang + Zulaport Cutthroat + Warren Soultrader', async () => {
    await fresh(); await mkTok('Create a 1/1 green Squirrel creature token.'); for (const p of ['Chatterfang, Squirrel General', 'Zulaport Cutthroat', 'Warren Soultrader']) await putP(A, p); await pool(A, {});
    await set({__pickRe:'^Squirrel', __tgt:'kim'});
    await handLoop('A67', () => doAll(() => act(A, 'Warren Soultrader', 'Sacrifice')), 5,
      async () => ({t:await tokN('Treasure'), k:await life(B), me:await life(A)}), (a, b, k) => { check(b.t - a.t === k, `A67: +1 Treasure per loop (${a.t} → ${b.t})`); check(a.k - b.k === k, `A67: Kim loses 1 per loop (${a.k} → ${b.k})`); check(b.me === a.me, `A67: my life stays (${a.me} → ${b.me})`); }, 3);
  });
  await step('A78 Chatterfang + Blood Artist + Warren Soultrader', async () => {
    await fresh(); await mkTok('Create a 1/1 green Squirrel creature token.'); for (const p of ['Chatterfang, Squirrel General', 'Blood Artist', 'Warren Soultrader']) await putP(A, p); await pool(A, {});
    await set({__pickRe:'^Squirrel', __tgt:'kim'});
    await handLoop('A78', () => doAll(() => act(A, 'Warren Soultrader', 'Sacrifice')), 5,
      async () => ({t:await tokN('Treasure'), k:await life(B), me:await life(A)}), (a, b, k) => { check(b.t - a.t === k, `A78: +1 Treasure per loop (${a.t} → ${b.t})`); check(a.k - b.k === k, `A78: Kim loses 1 per loop (${a.k} → ${b.k})`); check(b.me === a.me, `A78: my life stays (${a.me} → ${b.me})`); }, 3);
  });
  await step('A152 Warren Soultrader + Gravecrawler + Ayara', async () => {
    await fresh(); for (const p of ['Warren Soultrader', 'Gravecrawler', 'Ayara, First of Locthwain']) await putP(A, p); await pool(A, {});
    await set({__pickRe:'^Gravecrawler', __tgt:'kim', __want:['^B$|black|\\{B\\}']});
    await handLoop('A152', () => doAll(() => act(A, 'Warren Soultrader', 'Sacrifice'), () => act(A, 'Treasure', 'Add', 2), () => gyCast('Gravecrawler')), 5,
      async () => ({t:await tokN('Treasure'), k:await life(B), me:await life(A)}), (a, b, k) => { check(b.t === a.t, `A152: Treasures made and spent (${a.t} → ${b.t})`); check(a.k - b.k === k, `A152: Kim loses 1 per loop (${a.k} → ${b.k})`); check(b.me === a.me, `A152: my life stays (${a.me} → ${b.me})`); });
    check(await cnt(A, 'Gravecrawler') === 1, 'A152: Gravecrawler is back');
  });
  await step("A156 Sensei's Divining Top + Etherium Sculptor + Mystic Forge", async () => {
    await fresh(); for (const p of ["Sensei's Divining Top", 'Etherium Sculptor', 'Mystic Forge']) await putP(A, p); await pool(A, {});
    await handLoop('A156', () => doAll(() => act(A, "Sensei's Divining Top", 'Draw a card'), () => zoneCast("Sensei's Divining Top", 'lib')), 5,
      async () => ({h:await handN()}), (a, b, k) => check(b.h - a.h === k, `A156: +1 card per loop (${a.h} → ${b.h})`));
  });

  // ---------------------------------------------------------------- one-shots and trigger loops
  await step('A37 Sheoldred, the Apocalypse + Peer into the Abyss', async () => {
    await fresh(); await B.evaluate(() => { S.life = 40; commit(); }); await sleep(800);
    await putP(A, 'Sheoldred, the Apocalypse'); await toZone(A, 'Peer into the Abyss', 'hand'); await pool(A, {B:3, C:4}); await set({__tgt:'kim'});
    const L = await B.evaluate(() => S.lib.length);
    check(await castH(A, 'Peer into the Abyss') === 'ok', 'cast Peer into the Abyss at Kim'); await after();
    const d = Math.ceil(L / 2); const ok = await waitFor(B, () => S.life <= 0, null, 60000); await after();
    const L2 = await B.evaluate(() => S.lib.length);
    check(L - L2 === d, `A37: Kim drew half her library, ${d} cards (${L} → ${L2})`);
    check(ok && await lost(B), `A37: Kim loses half her life and 2 per card drawn — she loses (Kim ${await life(B)})`);
    await noNotes('A37');
  });
  await step('A63 Niv-Mizzet, Parun + Ophidian Eye', async () => {
    await fresh(); await B.evaluate(() => { S.life = 40; commit(); }); await sleep(800);
    await putP(A, 'Niv-Mizzet, Parun'); const id = await putP(A, 'Ophidian Eye'); await A.evaluate(id => { const a = S.bf.find(x => x.id === id), n = S.bf.find(x => cname(x) === 'Niv-Mizzet, Parun'); a.att = {pid:MYPID, id:n.id}; commit(); }, id);
    await set({__tgt:'kim', __want:['every opponent is dead', '^(yes|draw)']});
    await A.evaluate(() => { draw(1); commit(); }); await after();
    const ok = await waitFor(B, () => S.life <= 0, null, 180000); await after();
    check(ok && await lost(B), `A63: draw → ping → draw … until Kim is dead (Kim ${await life(B)}; ${JSON.stringify((await chosen()).slice(-3))})`);
    await noNotes('A63');
  });
  await step('A122 Scurry Oak + Rosie Cotton of South Lane', async () => {
    await fresh(); await putP(A, 'Scurry Oak'); await putP(A, 'Rosie Cotton of South Lane'); await set({__tgt:'Scurry', __want:['number of times', '^(yes|create)'], __XQ:[10]});
    await after(); await A.evaluate(() => { F25.kAsk = {}; F25.bud = {}; UI.f24blk = {}; window.__chosen = []; });   // Rosie's own Food already started (and asked about) the loop during setup
    await mkTok('Create a Food token.'); await after();
    const asked = await waitFor(A, () => (window.__chosen || []).some(s => /go on forever/.test(s)), null, 120000);
    await waitFor(A, () => S.log.some(e => /ran the chosen number of times/.test(e.s)), null, 90000); await after(); await sleep(6000); await after();
    const n = await tokN('Squirrel');
    check(asked, `A122: the endless loop asked how many times (${JSON.stringify((await chosen()).slice(-2))})`);
    check(n >= 9, `A122: at least the chosen 10 more Squirrels (${n} Squirrels)`);
    check(await A.evaluate(() => !stackAll().length && !UI.resolving), 'A122: the loop stopped');
    await noNotes('A122');
  });
  // ---------------------------------------------------------------- more
  await step("A57 Pitiless Plunderer + Reassembling Skeleton + Phyrexian Altar (Record a loop → Repeat)", async () => {
    await fresh(); await B.evaluate(() => { S.life = 40; commit(); }); for (const p of ['Pitiless Plunderer', 'Phyrexian Altar', 'Reassembling Skeleton', 'Blood Artist']) await putP(A, p); await pool(A, {});
    await set({__pickRe:'Reassembling', __tgt:'kim', __want:['^B$|black|\\{B\\}']});
    const loop = () => doAll(() => act(A, 'Phyrexian Altar', 'Sacrifice', 2), () => act(A, 'Treasure', 'Add', 2), () => gyAct('Reassembling Skeleton', 'Return'));
    check(await loop() === true, 'A57: loop once by hand (Skeleton comes back tapped)'); await after();
    const k0 = await life(B); await A.evaluate(() => startRecording());
    check(await loop() === true, 'A57: recorded loop by hand'); await after();
    const k1 = await life(B); check(k0 - k1 === 1, `A57: Blood Artist drains 1 per death (${k0} → ${k1})`);
    await A.evaluate(() => { window.__wantQ = ['number of times']; window.__XQ = [6]; askRepeat(); }); await sleep(800); await after();
    const ok = await waitFor(A, () => S.log.some(e => /repeated the loop 6 times/.test(e.s)), null, 120000); await after();
    check(ok, `A57: Repeat ×6 ran (${await A.evaluate(() => (S.log.filter(e => /repeated the loop/.test(e.s)).pop() || {}).s)})`);
    const k2 = await life(B); check(k1 - k2 === 6, `A57: 6 more deaths (${k1} → ${k2})`);
    check(await cnt(A, 'Reassembling Skeleton') === 1 && tot(await poolOf(A)) === 0 && await tokN('Treasure') === 0, 'A57: Skeleton back, no mana or Treasures left over (the loop nets nothing but death triggers)');
    await noNotes('A57');
  });
  await step("A138 Devoted Druid + Hazel's Brewmaster", async () => {
    await fresh(); await toZone(A, 'Devoted Druid', 'gy'); await toZone(A, "Hazel's Brewmaster", 'hand'); await pool(A, {B:1, C:3}); await set({__tgt:'Devoted'});
    check(await castH(A, "Hazel's Brewmaster") === 'ok', 'A138: cast Hazel\'s Brewmaster'); await after();
    check(await A.evaluate(() => S.ex.some(c => cname(c) === 'Devoted Druid')), 'A138: Devoted Druid exiled with the Brewmaster');
    check(await tokN('Food') >= 1, 'A138: a Food was made'); await pool(A, {});
    await handLoop('A138', () => doAll(() => act(A, 'Food', 'Add \\{G\\}'), () => act(A, 'Food', 'Untap')), 6,
      async () => (await poolOf(A)).G || 0, (a, b, k) => check(b - a === k, `A138: +1 {G} per loop from the Food (${a} → ${b})`));
  });
  await step('A53 Sprout Swarm + Witherbloom, the Balancer', async () => {
    await fresh(); await putP(A, 'Witherbloom, the Balancer'); await mkTok('Create four 1/1 green Saproling creature tokens.'); await toZone(A, 'Sprout Swarm', 'hand'); await pool(A, {});
    await set({__want:['^Pay it'], __pickRe:'Saproling', __pick:1});
    await handLoop('A53', () => doAll(() => castH(A, 'Sprout Swarm')), 5,
      async () => ({s:await tokN('Saproling'), h:await A.evaluate(() => S.hand.filter(c => cname(c) === 'Sprout Swarm').length)}), (a, b, k) => { check(b.s - a.s === k, `A53: +1 Saproling per cast (${a.s} → ${b.s})`); check(b.h === 1, 'A53: buyback keeps Sprout Swarm in hand'); }, 3);
  });
  // the loop adds a counter to Carrion Feeder each time, so the board never "comes back": the table can't spot it — use Record a loop
  await step('A93 Carrion Feeder + Rooftop Storm + Gravecrawler (Record a loop → Repeat)', async () => {
    await fresh(); for (const p of ['Carrion Feeder', 'Rooftop Storm', 'Gravecrawler']) await putP(A, p); await pool(A, {});
    await set({__pickRe:'^Gravecrawler', __want:['Rooftop']});
    const loop = () => doAll(() => act(A, 'Carrion Feeder', 'Sacrifice'), () => gyCast('Gravecrawler'));
    const cp = () => A.evaluate(() => (S.bf.find(c => cname(c) === 'Carrion Feeder') || {}).cp || 0);
    await A.evaluate(() => startRecording()); check(await loop() === true, 'A93: loop once by hand (Gravecrawler cast for {0})'); await after();
    const c1 = await cp(); check(c1 === 1 && await cnt(A, 'Gravecrawler') === 1, `A93: Feeder has 1 counter, Gravecrawler is back (${c1})`);
    await A.evaluate(() => { window.__wantQ = ['number of times']; window.__XQ = [5]; askRepeat(); }); await sleep(800); await after();
    const ok = await waitFor(A, () => S.log.some(e => /repeated the loop 5 times/.test(e.s)), null, 120000); await after();
    check(ok, `A93: Repeat ×5 ran (${await A.evaluate(() => (S.log.filter(e => /repeated the loop/.test(e.s)).pop() || {}).s)})`);
    const c2 = await cp(); check(c2 - c1 === 5, `A93: +1 counter per loop (${c1} → ${c2})`);
    await noNotes('A93');
  });
  await step('A126 Ghostly Flicker + Peregrine Drake + Archaeomancer', async () => {
    await fresh(); const nI = await A.evaluate(() => S.bf.filter(c => cname(c) === 'Island').length); for (let i = nI; i < 5; i++) await putP(A, 'Island');
    await putP(A, 'Peregrine Drake'); await putP(A, 'Archaeomancer'); await after(); await toZone(A, 'Ghostly Flicker', 'hand'); await pool(A, {});
    await A.evaluate(() => { window.__f27iv = setInterval(() => { const m = UI.modal; if (m && m.type === 'target' && !m.__done && m.resolve && /Ghostly Flicker/.test(m.title || '')){ const ok = m.cands.filter(c => c.ok && /Peregrine Drake|Archaeomancer/.test(c.nm)); m.__done = 1; m.resolve(ok.slice(0, 2)); closeModal(); } }, 20); });
    await set({__pick:5, __pickRe:'Island', __tgt:'Ghostly Flicker'});
    const tapAll = () => A.evaluate(async () => { for (const c of S.bf.filter(x => cname(x) === 'Island' && !x.tap)){ const ab = manaAbs(c)[0]; await activateMana(c, ab, 0); } commit(); return 'mana'; });
    await handLoop('A126', () => doAll(tapAll, () => castH(A, 'Ghostly Flicker')), 5,
      async () => tot(await poolOf(A)), (a, b, k) => check(b - a === 2 * k, `A126: +2 {U} per loop (${a} → ${b})`));
    check(await A.evaluate(() => S.hand.some(c => cname(c) === 'Ghostly Flicker')), 'A126: Ghostly Flicker back in hand');
    await A.evaluate(() => clearInterval(window.__f27iv));
  });
};
