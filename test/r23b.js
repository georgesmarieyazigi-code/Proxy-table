// r23b: the five cards from the v23 bot games — nothing by hand, no number questions
process.env.TOP = '1'; const CC = require('./cards'); const WANT = ['Nylea, Keen-Eyed', 'Wall of Frost', 'Chandra, Flameshaper', 'Lathiel, the Bounteous Dawn', 'Mutavault', 'Court of Ire', 'Grow from the Ashes', 'Forest', 'Fire Covenant', 'Mirrorworks', 'Crumb and Get It', 'Sol Ring', 'The Mycotyrant', 'Bronzebeak Foragers', 'Suspended Sentence', 'Tail Swipe', 'The Aetherspark', 'Tangled Colony', 'Burakos, Party Leader', "Cruelclaw's Heist", 'Grizzly Bears', 'Edgar Markov'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {sleep, waitFor} = H;
let pass = 0, fail = 0; const ok = (c, m) => { if (c){ pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const deck = 'Commander\n1 Edgar Markov\n\nDeck\n1 The Aetherspark\n1 Tangled Colony\n1 Burakos, Party Leader\n1 Cruelclaw\'s Heist\n1 Grizzly Bears\n1 Tail Swipe\n1 Suspended Sentence\n1 Bronzebeak Foragers\n1 The Mycotyrant\n1 Sol Ring\n1 Fire Covenant\n1 Crumb and Get It\n1 Court of Ire\n1 Mutavault\n1 Lathiel, the Bounteous Dawn\n1 Chandra, Flameshaper\n1 Wall of Frost\n1 Nylea, Keen-Eyed\n1 Grow from the Ashes\n10 Forest\n30 Mountain\n';
  const A = await H.player(browser, 'Georges', deck, 'host', 'r23b');
  const B = await H.player(browser, 'Kim', 'Commander\n1 Edgar Markov\n\nDeck\n60 Mountain\n', 'join', 'r23b');
  await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]'); await sleep(3000);
  const stub = p => p.evaluate(() => { window.askChoice = async o => { if (/cast one of them/.test(o.title || '')){ window.LAIR = o.options.length; return 'none'; } const v = o.options.find(x => x.value !== 'none'); return v ? v.value : null; }; window.askYes = async () => true; UI.notes = []; });
  await stub(A); await stub(B);
  try {
    console.log('— The Aetherspark: −10 adds ten mana of one color');
    const r1 = await A.evaluate(async () => { const tot = () => Object.values(S.pool || {}).reduce((a, b) => a + (+b || 0), 0); const n0 = tot(); await doSentence('Add ten mana of any one color.', {k:null, name:'The Aetherspark'}); return {added:tot() - n0, notes:(UI.notes || []).length}; });
    ok(r1.added === 10 && !r1.notes, 'added ten mana, nothing by hand ' + JSON.stringify(r1));
    console.log('— Tangled Colony: dies with 3 damage → 3 Rats');
    await H.put(A, 'Tangled Colony'); await sleep(500);
    await A.evaluate(() => { const c = S.bf.find(x => info(x.k).n === 'Tangled Colony'); c.dmg = 3; commit(); });
    await sleep(2500); await A.evaluate(() => { for (let i = 0; i < 10; i++) if (myBox()) doPass(); });
    await waitFor(A, () => S.bf.filter(c => c.tok && /Rat/.test(cname(c))).reduce((a, c) => a + (c.n || 1), 0) >= 1 && !S.stk.length, 30000).catch(() => {});
    for (let i = 0; i < 20; i++){ await sleep(500); await B.evaluate(() => { if (myBox()) doPass(); }); await A.evaluate(() => { if (myBox()) doPass(); }); }
    const r2 = await A.evaluate(() => ({rats:S.bf.filter(c => c.tok && /Rat/.test(cname(c))).reduce((a, c) => a + (c.n || 1), 0), asks:(UI.notes || []).length, gy:S.gy.some(c => info(c.k).n === 'Tangled Colony')}));
    ok(r2.gy && r2.rats === 3 && !r2.asks, 'three Rats, no number asked ' + JSON.stringify(r2));
    console.log('— Burakos: party size counted');
    await H.put(A, 'Burakos, Party Leader'); await sleep(500);
    const r3 = await A.evaluate(() => countOf('the number of creatures in your party', {k:null, name:'Burakos'}));
    ok(r3 === 1, 'Burakos alone is a party of 1 (' + r3 + ')');
    console.log("— Mad Wizard's Lair: draw three, reveal, cast one free");
    const r4 = await A.evaluate(async () => { const h0 = S.hand.length; const ctx = {k:null, name:"Mad Wizard's Lair"}; await doSentence('Draw three cards and reveal them.', ctx); const h1 = S.hand.length; await doSentence('You may cast one of them without paying its mana cost.', ctx); return {drew:h1 - h0, ids:(ctx.f23drawn || []).length, notes:(UI.notes || []).length}; });
    ok(r4.drew === 3 && r4.ids === 3 && !r4.notes, 'drew three, handled the free cast, nothing by hand ' + JSON.stringify(r4));
    console.log("— Cruelclaw's Heist: opponent has no nonland card → nothing by hand");
    const r5 = await A.evaluate(async () => { const ctx = {k:S.hand.concat(S.lib).find(c => /Cruelclaw/.test(info(c.k).n))?.k, name:"Cruelclaw's Heist", revealed:{pid:[...OPP.keys()][0]}, chosenK:null, it:{}}; await doSentence('Exile that card.', ctx); await doSentence('If the gift was promised, you may cast that card for as long as it remains exiled, and mana of any type can be spent to cast it.', ctx); return {notes:(UI.notes || []).map(n => n.text)}; });
    ok(!r5.notes.length, 'no by-hand note ' + JSON.stringify(r5));

    console.log('— X filled in: Hydra Broodmaster trigger (event X), Sylvan Offering for an opponent (spell X), Notorious Throng count');
    const r6 = await A.evaluate(async () => { const n0 = S.bf.filter(c => c.tok && /Hydra/.test(cname(c))).reduce((a, c) => a + (c.n || 1), 0); await createFromText('Create X X/X green Hydra creature tokens.', {k:null, name:'Hydra Broodmaster', it:{evX:3}}); const hs = S.bf.filter(c => c.tok && /Hydra/.test(cname(c))); return {n:hs.reduce((a, c) => a + (c.n || 1), 0) - n0, pt:hs[0] ? stats(hs[0]).join('/') : '', notes:(UI.notes || []).length}; });
    ok(r6.n === 3 && r6.pt === '3/3' && !r6.notes, 'three 3/3 Hydras ' + JSON.stringify(r6));
    await A.evaluate(async () => { await r23kTokFor([...OPP.keys()][0], 'X 1/1 green Elf Warrior creature tokens', {k:null, name:'Sylvan Offering', it:{x:2, xSet:true}}); commit(); });
    await waitFor(B, () => S.bf.filter(c => c.tok && /Elf/.test(cname(c))).reduce((a, c) => a + (c.n || 1), 0) >= 2, 15000).catch(() => {});
    const r7 = await B.evaluate(() => ({elves:S.bf.filter(c => c.tok && /Elf/.test(cname(c))).reduce((a, c) => a + (c.n || 1), 0), notes:(UI.notes || []).length}));
    ok(r7.elves === 2 && !r7.notes, "Kim gets two Elf Warriors without being asked " + JSON.stringify(r7));
    await B.evaluate(() => { damageMe(4, {}, 'test'); commit(); }); await sleep(2500);
    const r8 = await A.evaluate(() => countOf('the damage dealt to your opponents this turn', {k:null, name:'Notorious Throng'}));
    ok(r8 === 4, 'Notorious Throng counts 4 damage dealt to opponents (' + r8 + ')');

    console.log("— Kefnet's Monument: Kim's creature doesn't untap during her next untap step");
    const bid = await B.evaluate(async () => { await createFromText('Create a 2/2 black Zombie creature token.', {k:null, name:'test'}); const c = S.bf.find(x => x.tok && /Zombie/.test(cname(x))); c.tap = true; commit(); return c.id; });
    await sleep(2000);
    const r9 = await A.evaluate(async bid => { const ctx = {k:null, name:"Kefnet's Monument", tgts:[[(() => { const p = [...OPP.keys()][0]; const b = boardOf(p).find(x => x.id === bid); return {t:'card', pid:p, id:bid, k:b && b.k, nm:'Zombie'}; })()]]}; await doSentence("Target creature an opponent controls doesn't untap during its controller's next untap step.", ctx); return [(UI.notes || []).length, S.log.slice(-3).map(e => e.s), JSON.stringify(S.rq.slice(-1))]; }, bid); console.log(JSON.stringify(r9));
    await waitFor(B, id => S.bf.find(x => x.id === id)?.skipUntap, bid, 15000);
    const r9b = await B.evaluate(id => !!S.bf.find(x => x.id === id)?.skipUntap, bid); console.log('B', JSON.stringify(await B.evaluate(id => [S.bf.filter(x => x.tok).map(x => [x.id, cname(x), x.skipUntap]), S.log.slice(-4).map(e => e.s)], bid)));
    ok(r9b && !r9[0], 'the Zombie is marked to skip its next untap, nothing by hand');

    console.log('— Tail Swipe: +1/+1 in a main phase, then fight');
    await H.put(A, 'Grizzly Bears'); await sleep(800);
    const r10 = await A.evaluate(async bid => { const p = [...OPP.keys()][0]; const bear = S.bf.find(x => info(x.k).n === 'Grizzly Bears'); const z = boardOf(p).find(x => x.id === bid);
      const ts = S.hand.concat(S.lib).find(c => info(c.k).n === 'Tail Swipe');
      UI.notes = []; const ph = phaseNow();
      await runEffects(info(ts.k).o, {k:ts.k, name:'Tail Swipe', it:{}, tgts:[[{t:'card', pid:MYPID, id:bear.id, k:bear.k, nm:'Grizzly Bears'}], [{t:'card', pid:p, id:bid, k:z && z.k, nm:'Zombie'}]]});
      await new Promise(r => setTimeout(r, 1500)); return {ph:ph && (ph.step || ph.name), mine:ph && ph.pid === MYPID, notes:(UI.notes || []).map(n => n.text), pt:S.bf.find(x => x.id === bear.id) ? stats(S.bf.find(x => x.id === bear.id)).join('/') : 'gone'}; }, bid);
    ok(!r10.notes.length, 'Tail Swipe: nothing by hand ' + JSON.stringify(r10));

    console.log('— Suspended Sentence with no creature target: nothing by hand');
    const r11 = await A.evaluate(async () => { const c = S.hand.concat(S.lib).find(x => info(x.k).n === 'Suspended Sentence'); UI.notes = []; await doSentence('Destroy target creature an opponent controls.', {k:c.k, name:'Suspended Sentence', it:{}, tgts:[]}); const ctx = {k:c.k, name:'Suspended Sentence', it:{}, tgts:[]}; await doSentence('That player loses 3 life.', ctx); return (UI.notes || []).map(n => n.text); });
    ok(!r11.length, 'no by-hand note ' + JSON.stringify(r11));

    console.log('— Bronzebeak Foragers: X of the ability (0) is used, not asked');
    const r12 = await A.evaluate(async () => { const c = S.hand.concat(S.lib).find(x => info(x.k).n === 'Bronzebeak Foragers'); let asked = 0; const an = window.askNumber; window.askNumber = async () => { asked++; return 5; }; const n = await numOf('x', {k:c.k, name:'Bronzebeak Foragers', it:{kind:'ability', k:c.k, x:0}}, 'life'); window.askNumber = an; return {n, asked}; });
    ok(r12.n === 0 && !r12.asked, 'X = 0 used ' + JSON.stringify(r12));

    console.log('— Loyal Inventor: search declined → nothing by hand');
    const r13b = await A.evaluate(async () => { UI.notes = []; const ctx = {k:null, name:'Loyal Inventor', it:{}}; await doSentence('Put that card into your hand if you control an Assassin.', ctx); await doSentence('Otherwise, put that card on top of your library.', ctx); return (UI.notes || []).map(n => n.text); });
    ok(!r13b.length, 'no by-hand note ' + JSON.stringify(r13b));

    console.log('— Shadow: opponents lose life equal to the sacrificed permanent\'s mana value; Lonis with X = 0');
    const l0 = await B.evaluate(() => S.life);
    const r14 = await A.evaluate(async () => { UI.notes = []; const c = S.hand.concat(S.lib, S.bf, S.gy, S.ex).find(x => info(x.k).n === 'Bronzebeak Foragers'); await doSentence('Each opponent loses life equal to the mana value of the sacrificed permanent.', {k:null, name:'Shadow', it:{}, sacd:c}); const ctx2 = {k:S.hand.concat(S.lib).find(x => /Lonis/.test(info(x.k).n))?.k || null, name:'Lonis', it:{x:0}}; return {mv:info(c.k).mv, notes:(UI.notes || []).map(n => n.text)}; });
    await sleep(3000); const l1 = await B.evaluate(() => S.life);
    ok(l0 - l1 === r14.mv && r14.mv > 0 && !r14.notes.length, `Kim lost ${l0 - l1} (mana value ${r14.mv}), nothing by hand`);

    console.log('— Peerless Recycling (gift promised): two graveyard cards come back');
    const r15 = await A.evaluate(async () => { UI.notes = []; const cs = S.lib.filter(c => !isLand(c.k)).slice(0, 2).concat(S.lib.filter(c => isLand(c.k)).slice(0, 2)).slice(0, 2); cs.forEach(c => moveCard(c.id, 'gy', {quiet:true})); const h0 = S.hand.length;
      await doSentence('Return two target permanent cards from your graveyard to your hand.', {k:null, name:'Peerless Recycling', it:{}, tgts:[cs.map(c => ({t:'gy', pid:MYPID, id:c.id, k:c.k, nm:cname(c)}))]}); return {back:S.hand.length - h0, notes:(UI.notes || []).length}; });
    ok(r15.back === 2 && !r15.notes, 'two cards returned ' + JSON.stringify(r15));

    console.log('— The Mycotyrant counts itself (a Fungus)');
    await H.put(A, 'The Mycotyrant'); await sleep(1500);
    const r16 = await A.evaluate(() => { const c = S.bf.find(x => info(x.k).n === 'The Mycotyrant'); return c ? stats(c).join('/') : 'missing'; });
    ok(r16 === '1/1', 'The Mycotyrant is 1/1 alone (' + r16 + ')');

    console.log('— Mirrorworks copies the artifact; Crumb and Get It indestructible; Throne of the Dead Three');
    const r17 = await A.evaluate(async () => { UI.notes = []; const sr = S.hand.concat(S.lib).find(x => info(x.k).n === 'Sol Ring'); moveCard(sr.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === sr.id);
      const n0 = S.bf.filter(x => x.tok && info(x.k).n === 'Sol Ring').length;
      await doSentence("Create a token that's a copy of that artifact.", {k:null, name:'Mirrorworks', it:{evk:b.k, evId:b.id}});
      const n1 = S.bf.filter(x => x.tok && info(x.k).n === 'Sol Ring').reduce((a, c) => a + (c.n || 1), 0);
      const bear = S.bf.find(x => info(x.k).n === 'Grizzly Bears') || S.bf.find(x => isCreatureCard(x));
      const ctx = {k:null, name:'Crumb and Get It', it:{}, lastT:[{t:'card', pid:MYPID, id:bear.id, k:bear.k, nm:cname(bear)}]};
      await doSentence('That creature also gains indestructible until end of turn.', ctx);
      const ind = hasKw(S.bf.find(x => x.id === bear.id), 'indestructible');
      const cr = S.lib.concat(S.hand, S.gy).filter(c => isCreatureCard(c)).slice(0, 1); if (cr[0]){ for (const z of [S.lib, S.hand, S.gy]){ const i = z.indexOf(cr[0]); if (i >= 0) z.splice(i, 1); } S.lib.unshift(cr[0]); }
      const ctx2 = {k:null, name:'Throne of the Dead Three', it:{}}; await doSentence('Put a creature card from among them onto the battlefield with three +1/+1 counters on it.', ctx2); await doSentence('It gains hexproof until your next turn.', ctx2);
      const t = cr[0] && S.bf.find(x => x.id === cr[0].id);
      return {tok:n1 - n0, ind, throne:t ? [t.cp, hasKw(t, 'hexproof')] : null, notes:(UI.notes || []).map(n => n.text)}; });
    ok(r17.tok === 1 && r17.ind && r17.throne && r17.throne[0] === 3 && r17.throne[1] && !r17.notes.length, 'all three handled ' + JSON.stringify(r17));

    console.log('— Fire Covenant with X = 0 life paid: X is known');
    const r18 = await A.evaluate(async () => { const c = S.hand.concat(S.lib, S.gy).find(x => info(x.k).n === 'Fire Covenant'); return xKnown({it:{kind:'spell', k:c.k, x:0}}); });
    ok(r18 === true, 'X = 0 counts as known');

    console.log("— Gadwick-style ETB X from the cast; Gossip's Talent unblockable");
    const r19 = await A.evaluate(async () => { UI.notes = []; let c = S.bf.find(x => info(x.k).n === 'Bronzebeak Foragers'); if (!c){ const z = S.hand.concat(S.lib, S.gy, S.ex).find(x => info(x.k).n === 'Bronzebeak Foragers'); moveCard(z.id, 'bf', {quiet:true}); c = S.bf.find(x => x.id === z.id); } c.xv = 3; let asked = 0; const an = window.askNumber; window.askNumber = async () => { asked++; return 9; };
      const n = await numOf('x', {k:c.k, name:'Gadwick', it:{kind:'trigger', srcId:c.id, k:c.k, txt:'Draw X cards.'}}, 'cards'); window.askNumber = an;
      await doSentence("Target attacking creature with power 3 or less can't be blocked this turn.", {k:null, name:"Gossip's Talent", it:{}, tgts:[[{t:'card', pid:MYPID, id:c.id, k:c.k, nm:cname(c)}]]});
      return {n, asked, notes:(UI.notes || []).map(x => x.text)}; });
    ok(r19.n === 3 && !r19.asked && !r19.notes.length, 'X from the cast, unblockable handled ' + JSON.stringify(r19));

    console.log('— Court of Ire (monarch → 7), Grow from the Ashes kicked (two lands), Alesha, Oubliette, Mirri, Rock');
    const kl0 = await B.evaluate(() => S.life);
    const r20 = await A.evaluate(async () => { UI.notes = []; becomeMonarch('test'); const ct = S.hand.concat(S.lib, S.gy).find(x => info(x.k).n === 'Court of Ire'); const p = [...OPP.keys()][0];
      await runEffects('Court of Ire deals 2 damage to any target. If you\'re the monarch, it deals 7 damage instead.', {k:ct.k, name:'Court of Ire', it:{kind:'trigger', k:ct.k}, tgts:[[{t:'player', pid:p, nm:nameOf(p)}]]});
      const gr = S.hand.concat(S.lib, S.gy).find(x => info(x.k).n === 'Grow from the Ashes'); const gt = info(gr.k).o.split('\n').slice(1).join('\n');
      const gctx = {k:gr.k, name:'Grow from the Ashes', it:{kind:'spell', k:gr.k, kicked:true}}; const rew = gt.replace(F23_INST, (w, a, x, cond, y) => { const on = f23Cond(cond, gctx); return on == null ? w : a + (on ? y : x) + '.'; }); F23_INST.lastIndex = 0;
      const lands = /two basic land cards/.test(rew) && !/a basic land card/.test(rew) ? 2 : rew;
      const cr = S.lib.concat(S.hand, S.gy, S.bf.filter(c => !c.tok)).find(c => isCreatureCard(c)); let al = null; if (cr){ moveCard(cr.id, 'gy', {quiet:true}); await doSentence('Return target creature card with power 2 or less from your graveyard to the battlefield tapped and attacking.', {k:null, name:'Alesha', it:{kind:'trigger'}, tgts:[[{t:'gy', pid:MYPID, id:cr.id, k:cr.k, nm:cname(cr)}]]}); const b = S.bf.find(x => x.id === cr.id); al = b ? !!b.tap : null; }
      await doSentence("Rock deals 2 damage to any target'", {k:null, name:'Rock', it:{}, tgts:[[{t:'player', pid:p, nm:nameOf(p)}]]});
      return {lands, al, notes:(UI.notes || []).map(n => n.name + ': ' + n.text)}; });
    await sleep(3000); const kl1 = await B.evaluate(() => S.life);
    ok(kl0 - kl1 === 9 && r20.lands === 2 && r20.al === true && !r20.notes.length, `Kim lost ${kl0 - kl1} (7 + 2), ` + JSON.stringify(r20));

    console.log('— Mutable Explorer: a Mutavault token is a land (copy of Mutavault)');
    const r21 = await A.evaluate(async () => { await createFromText('Create a tapped Mutavault token.', {k:null, name:'Mutable Explorer', it:{}}); const t = S.bf.filter(c => c.tok && /Mutavault/.test(cname(c))).pop(); return t ? {land:isLand(t.k), cr:isCreatureCard(t), tap:!!t.tap} : null; });
    ok(r21 && r21.land && !r21.cr && r21.tap, 'Mutavault token ' + JSON.stringify(r21));

    console.log('— Aven Interrupter with no spell; Rikku on the event creature; a renamed creature leaving the battlefield');
    const r22 = await A.evaluate(async () => { UI.notes = []; await doSentence('It becomes plotted.', {k:null, name:'Aven Interrupter', it:{}});
      const c = S.bf.find(x => isCreatureCard(x) && !x.tok); await doSentence("Until end of turn, that creature can't be blocked by creatures your opponents control.", {k:null, name:'Rikku', it:{kind:'trigger', evId:c.id, evPid:MYPID}});
      const base = c.k; c.c27ppOrig = base; c.k = base + '|p27|zz'; moveCard(c.id, 'gy'); const g = S.gy.find(x => x.id === c.id);
      return {notes:(UI.notes || []).map(n => n.name + ': ' + n.text), back:g && g.k === base && !g.c27ppOrig}; });
    ok(!r22.notes.length && r22.back, 'handled ' + JSON.stringify(r22));

    console.log('— Lathiel: distribute as many counters as life gained this turn');
    const r23 = await A.evaluate(async () => { UI.notes = []; const g0 = lifeT().g; gainLife(2, 'test'); commit(); const n = lifeT().g; const la = S.hand.concat(S.lib, S.gy, S.bf, S.ex, S.cz).find(x => /Lathiel/.test(info(x.k)?.n || '')); if (!la) return {miss:'lathiel', zones:[S.lib.length, S.hand.length]}; const c = S.bf.find(x => isCreatureCard(x) && !x.tok) || S.bf.find(x => isCreatureCard(x)); const cp0 = c.cp || 0;
      await doSentence('Distribute up to that many +1/+1 counters among any number of other target creatures.', {k:la.k, name:'Lathiel', it:{kind:'trigger', k:la.k}, tgts:[[{t:'card', pid:MYPID, id:c.id, k:c.k, nm:cname(c)}]]});
      return {n, added:(S.bf.find(x => x.id === c.id).cp || 0) - cp0, notes:(UI.notes || []).map(x => x.text)}; });
    ok(r23.added === r23.n && r23.n > 0 && !r23.notes.length, 'counters = life gained ' + JSON.stringify(r23));

    console.log('— Communal Brewing: the cast creature enters with extra counters; Dragonhawk delayed damage');
    const kd0 = await B.evaluate(() => S.life);
    const r24 = await A.evaluate(async () => { UI.notes = []; const cr = S.lib.concat(S.hand, S.gy).find(c => isCreatureCard(c) && !/Nylea/.test(info(c.k).n)); if (!cr) return {miss:1};
      await doSentence('That creature enters with 2 additional +1/+1 counters on it.', {k:null, name:'Communal Brewing', it:{kind:'trigger', evk:cr.k}});
      moveCard(cr.id, 'bf'); const b = S.bf.find(x => x.id === cr.id);
      const e = S.lib.slice(0, 2); e.forEach(c => { moveCard(c.id, 'ex', {quiet:true}); const x = S.ex.find(y => y.id === c.id); x.mayPlay = {t:turnStr(), src:"Dragonhawk, Fate's Tempest"}; });
      await doSentence("Dragonhawk, Fate's Tempest deals 2 damage to each opponent for each of those cards that are still exiled.", {k:null, name:"Dragonhawk, Fate's Tempest", it:{}});
      return {cp:b && b.cp, notes:(UI.notes || []).map(x => x.text)}; });
    await sleep(3000); const kd1 = await B.evaluate(() => S.life);
    ok(r24.cp === 2 && kd0 - kd1 === 4 && !r24.notes.length, `counters ${r24.cp}, Kim lost ${kd0 - kd1} ` + JSON.stringify(r24));

    console.log('— Minsc & Boo −2 (sacrificed creature power), Akroma keyword pump');
    const km0 = await B.evaluate(() => S.life);
    const r25 = await A.evaluate(async () => { UI.notes = []; await createFromText('Create a 3/3 green Beast creature token with trample and haste.', {k:null, name:'test', it:{}}); const bst = S.bf.filter(c => c.tok && /Beast/.test(cname(c))).pop(); const pw = stats(bst)[0];
      const p = [...OPP.keys()][0]; const ctx = {k:null, name:'Minsc & Boo', it:{}, sacd:bst, tgts:[[{t:'player', pid:p, nm:nameOf(p)}]]};
      await doSentence("Minsc & Boo, Timeless Heroes deals X damage to any target, where X is that creature's power.", ctx); await doSentence('If the sacrificed creature was a Hamster, draw X cards.', ctx);
      const p0 = stats(bst).slice(); await doSentence('Until end of turn, each other creature you control gets +1/+1 if it has flying, +1/+1 if it has first strike, and so on for double strike, deathtouch, haste, hexproof, indestructible, lifelink, menace, protection, reach, trample, vigilance, and partner.', {k:null, name:'Akroma', it:{}});
      await new Promise(r => setTimeout(r, 500)); return {pw, before:p0, after:stats(S.bf.find(x => x.id === bst.id)), notes:(UI.notes || []).map(x => x.text)}; });
    await sleep(3000); const km1 = await B.evaluate(() => S.life);
    ok(km0 - km1 === r25.pw && r25.after[0] === r25.before[0] + 2 && !r25.notes.length, `Kim lost ${km0 - km1}; Beast ${JSON.stringify(r25)}`);

    console.log('— Chandra, Flameshaper +2: choose one of the three exiled cards');
    const r26 = await A.evaluate(async () => { UI.notes = []; const ch = S.hand.concat(S.lib, S.gy, S.bf).find(x => /Chandra, Flameshaper/.test(info(x.k)?.n || '')); const ctx = {k:ch.k, name:'Chandra, Flameshaper', it:{kind:'ability', k:ch.k}};
      const ex0 = S.ex.length; await doSentence('Exile the top three cards of your library.', ctx); await doSentence('Choose one.', ctx); await doSentence('You may play that card this turn.', ctx);
      const newEx = S.ex.slice(ex0); return {ex:newEx.length, playable:newEx.filter(c => c.mayPlay).length, notes:(UI.notes || []).map(x => x.text)}; });
    ok(r26.ex === 3 && r26.playable === 1 && !r26.notes.length, 'one of three playable ' + JSON.stringify(r26));

    console.log("— Wall of Frost: the creature it blocked doesn't untap");
    const zid = await B.evaluate(async () => { await createFromText('Create a 2/2 black Zombie creature token.', {k:null, name:'t2', it:{}}); const c = S.bf.filter(x => x.tok && /Zombie/.test(cname(x))).pop(); commit(); return c.id; });
    await sleep(2000);
    const r27 = await A.evaluate(async zid => { UI.notes = []; const wf = S.hand.concat(S.lib, S.gy, S.ex, S.bf).find(x => info(x.k)?.n === 'Wall of Frost'); if (!S.bf.includes(wf)) moveCard(wf.id, 'bf', {quiet:true}); const w = S.bf.find(x => x.id === wf.id); w.blk = zid;
      const ph = phaseNow; window.phaseNow = () => ({...ph(), pid:[...OPP.keys()][0]});
      await doSentence("That creature doesn't untap during its controller's next untap step.", {k:w.k, name:'Wall of Frost', it:{kind:'trigger', k:w.k, srcId:w.id}}); window.phaseNow = ph; w.blk = null; return (UI.notes || []).map(x => x.text); }, zid);
    await waitFor(B, id => S.bf.find(x => x.id === id)?.skipUntap, zid, 15000);
    const r27b = await B.evaluate(id => !!S.bf.find(x => x.id === id)?.skipUntap, zid);
    ok(r27b && !r27.length, 'the blocked Zombie skips its next untap');

    console.log('— Nylea, Keen-Eyed: the revealed noncreature card goes to the graveyard');
    const r28 = await A.evaluate(async () => { UI.notes = []; const ny = S.hand.concat(S.lib, S.gy, S.ex, S.bf).find(x => info(x.k)?.n === 'Nylea, Keen-Eyed'); const top = S.lib[0];
      await doSentence('Put it into your graveyard.', {k:ny.k, name:'Nylea, Keen-Eyed', it:{kind:'ability', k:ny.k}}); return {gy:S.gy.includes(top), notes:(UI.notes || []).map(x => x.text)}; });
    ok(r28.gy && !r28.notes.length, 'top card to graveyard ' + JSON.stringify(r28));

    console.log("— Citadel of Pain: damage equal to that player's untapped lands");
    const kc0 = await B.evaluate(() => S.life); const kl = await B.evaluate(() => S.bf.filter(b => isLand(b.k) && !b.tap).length);
    await A.evaluate(async () => { UI.notes = []; const p = [...OPP.keys()][0]; await doSentence('Citadel of Pain deals X damage to that player, where X is the number of untapped lands they control.', {k:null, name:'Citadel of Pain', it:{kind:'trigger', evPid:p}}); });
    await sleep(3000); const kc1 = await B.evaluate(() => S.life); const nts = await A.evaluate(() => (UI.notes || []).length);
    ok(kc0 - kc1 === kl && !nts, `Kim lost ${kc0 - kc1} for ${kl} untapped lands`);
  } catch (e){ fail++; console.log('  ERROR ' + e.message); }
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close(); server.close(); process.exit(0);
})();
