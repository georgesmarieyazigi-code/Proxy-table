process.env.TOP = '1';
// Round 21B: recurring costs, delayed effects, durations; alternative costs, other zones and hand abilities — real 2-player games
const CC = require('./cards');
const WANT = ['Glacial Chasm', 'Mogg War Marshal', 'Dreamtide Whale', 'Search for Tomorrow', 'Faithless Looting', 'Otawara, Soaring City', 'Necrogoyf', 'Lórien Revealed', 'Shark Typhoon', 'Ragavan, Nimble Pilferer', 'Tear Asunder', 'Everflowing Chalice', 'Grizzly Bears', 'Weftstalker Ardent', 'Springheart Nantuko', 'Steel Seraph', 'Highway Robbery', 'Light Up the Stage'];
const EXTRA = ['Mental Journey', 'Triumph of Saint Katherine', 'Stasis', 'Sphere of Resistance'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name)), ...CC.topCards('extra.json').filter(c => EXTRA.includes(c.name)));
const H = require('./h'); const {check, sleep, give, put, setPool, handId, menuClick, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(150); } };
const AUTO = () => { window.__want = window.__want || null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ const l = (m.cands || []).filter(c => c.ok); const pk = (window.__tgt && l.find(c => new RegExp(window.__tgt).test(c.nm))) || l.find(c => c.pid !== MYPID) || l[0]; m.__done = 1; m.resolve(pk ? [pk] : []); closeModal(); }
    else if (m.run){ m.__done = 1; const d = m.def ?? 1; m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 100); };
const settle = async (A, ps) => { for (let i = 0; i < 30; i++){ await passAll(ps); if (!(await A.evaluate(() => stackAll().length || UI.resolving || UI.casting))) return; await sleep(150); } };
let PA = null; const step = async (name, fn) => { console.log('— ' + name); const f0 = H.fails(); try { await fn(); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); } if (H.fails() > f0 && PA) console.log('    LOG:', (await PA.evaluate(() => S.log.slice(-12).map(e => e.s).join(' | ')))); };
const zoneOf = (p, n) => p.evaluate(n => { for (const z of ['hand', 'bf', 'gy', 'ex', 'lib', 'cz']) if (S[z].some(c => cname(c) === n)) return z; return null; }, n);
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2b');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2b');
  PA = A; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle(A, [B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const up = async () => { await A.evaluate(() => fireSteps('upkeep', MYPID)); await settle(A, [B]); await sleep(500); };
  const want = (p, w) => p.evaluate(w => { window.__want = w; }, w);
  try {
    await step('Cumulative upkeep with a non-mana cost: Glacial Chasm costs 2, then 4 life', async () => {
      await put(A, 'Mountain'); await want(A, 'Mountain'); await put(A, 'Glacial Chasm'); await settle(A, [B]); await sleep(400); await want(A, 'Pay'); const l0 = await A.evaluate(() => S.life);
      await up(); const l1 = await A.evaluate(() => S.life); await up(); const l2 = await A.evaluate(() => S.life);
      const age = await A.evaluate(() => (S.bf.find(c => cname(c) === 'Glacial Chasm')?.nc || {}).age);
      check(l0 - l1 === 2 && l1 - l2 === 4 && age === 2, `paid 2 then 4 life, 2 age counters (${l0}→${l1}→${l2}, age ${age})`);
      await want(A, 'Sacrifice'); await up();
      check(await zoneOf(A, 'Glacial Chasm') === 'gy', 'declining the third payment sacrifices it');
      await want(A, null);
    });
    await step('Echo: Mogg War Marshal asks for {1}{R} on the next upkeep only; unpaid → sacrificed', async () => {
      await put(A, 'Mogg War Marshal'); await settle(A, [B]); await setPool(A, {R:1, C:1}); await want(A, 'Pay');
      await up(); check(await zoneOf(A, 'Mogg War Marshal') === 'bf' && (await A.evaluate(() => S.pool.R + S.pool.C)) === 0, 'paid echo {1}{R}: it stays');
      const st = await A.evaluate(() => S.stk.length); await up(); check(await zoneOf(A, 'Mogg War Marshal') === 'bf', 'no echo on the following upkeep');
      await A.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Mogg War Marshal'); moveCard(c.id, 'hand', {quiet:true}); }); await put(A, 'Mogg War Marshal'); await settle(A, [B]);
      await A.evaluate(() => { S.pool = emptyPool(); commit(); }); await want(A, 'Sacrifice'); await up();
      check(await zoneOf(A, 'Mogg War Marshal') === 'gy', 're-entered, echo unpaid: sacrificed');
      await want(A, null);
    });
    await step('Vanishing 2: Dreamtide Whale enters with 2 time counters and is sacrificed when the last one goes', async () => {
      await put(A, 'Dreamtide Whale'); const t0 = await A.evaluate(() => (S.bf.find(c => cname(c) === 'Dreamtide Whale')?.nc || {}).time);
      await up(); const t1 = await A.evaluate(() => (S.bf.find(c => cname(c) === 'Dreamtide Whale')?.nc || {}).time);
      await up(); const z = await zoneOf(A, 'Dreamtide Whale');
      check(t0 === 2 && t1 === 1 && z === 'gy', `2 → 1 → sacrificed (${t0}, ${t1}, ${z})`);
    });
    await step('Suspend 2—{G}: Search for Tomorrow from hand, two upkeeps, cast for free', async () => {
      await give(A, 'Search for Tomorrow'); await setPool(A, {G:1}); const id = await handId(A, 'Search for Tomorrow');
      const r = await menuClick(A, id, /Suspend 2/); check(r === 'ok', 'one-click “Suspend 2—{G}” in the hand menu (' + r + ')');
      await sleep(300); const s0 = await A.evaluate(() => { const c = S.ex.find(c => cname(c) === 'Search for Tomorrow'); return c && c.nc.time; });
      check(s0 === 2, 'exiled with 2 time counters');
      const lands0 = await A.evaluate(() => S.bf.filter(c => isLand(c.k)).length);
      await want(A, 'Cast|Forest|Mountain|Island|Plains|Swamp'); await up(); await up(); await settle(A, [B]); await sleep(600); await settle(A, [B]);
      const r2 = await A.evaluate(() => [S.bf.filter(c => isLand(c.k)).length, S.gy.some(c => cname(c) === 'Search for Tomorrow')]);
      check(r2[0] === lands0 + 1 && r2[1], `cast for free when the last counter left: a basic land entered (${lands0}→${r2[0]}), card in graveyard`);
      await want(A, null);
    });
    await step('Delayed trigger: exiled creature returns at the beginning of the next end step', async () => {
      await put(A, 'Grizzly Bears');
      await A.evaluate(async () => { const c = S.bf.find(c => cname(c) === 'Grizzly Bears'); const t = 'Exile target creature you control. Return it to the battlefield under its owner\'s control at the beginning of the next end step.'; await runEffects(t, {name:'Flicker Test', k:c.k, it:{kind:'spell', sid:'x'}, tgts:[[{t:'card', pid:MYPID, id:c.id, k:c.k, nm:'Grizzly Bears'}]], full:t}); commit(); });
      const z0 = await zoneOf(A, 'Grizzly Bears');
      await A.evaluate(() => fireSteps('end', MYPID)); await settle(A, [B]); await sleep(400);
      check(z0 === 'ex' && await zoneOf(A, 'Grizzly Bears') === 'bf', `exiled now (${z0}), back at the end step`);
      await A.evaluate(async () => { const c = S.bf.find(c => cname(c) === 'Grizzly Bears'); const t = 'At the beginning of your next upkeep, put a +1/+1 counter on Grizzly Bears.'; await runEffects(t, {name:'Grizzly Bears', k:c.k, srcId:c.id, it:{kind:'trigger', sid:'y', srcId:c.id}, full:t}); commit(); });
      const cp0 = await A.evaluate(() => S.bf.find(c => cname(c) === 'Grizzly Bears').cp || 0); await up();
      check(cp0 === 0 && await A.evaluate(() => S.bf.find(c => cname(c) === 'Grizzly Bears').cp) === 1, '“at the beginning of your next upkeep” waits for the upkeep');
    });
    await step('“Until your next turn” lasts through the opponent\'s turn and ends when my turn starts', async () => {
      await put(B, 'Grizzly Bears'); await sleep(600);
      await A.evaluate(async () => { const t = 'Creatures you control gain indestructible until your next turn.'; await runEffects(t, {name:'Shield Test', k:S.bf[0].k, it:{kind:'spell', sid:'z'}, full:t}); const o = opponents()[0]; const b = OPP.get(o.pid).bf.find(c => c.k && cname(c) === 'Grizzly Bears'); const t2 = 'Target creature gets -2/-0 until your next turn.'; await runEffects(t2, {name:'Weaken Test', k:b.k, it:{kind:'spell', sid:'w'}, tgts:[[{t:'card', pid:o.pid, id:b.id, k:b.k, nm:'Grizzly Bears'}]], full:t2}); commit(); });
      await sleep(1200);
      const ind = () => A.evaluate(() => (S.bf.find(c => cname(c) === 'Grizzly Bears').ekw || []).includes('indestructible'));
      const bp = () => B.evaluate(() => stats(S.bf.find(c => cname(c) === 'Grizzly Bears'))[0]);
      const i0 = await ind(), p0 = await bp();
      await A.evaluate(() => { S.stk = []; passTurn(); }); await sleep(1500); await settle(B, [A]);
      const i1 = await ind(), p1 = await bp(); const who = await A.evaluate(() => phaseNow().pid === MYPID);
      check(i0 && i1 && p0 === 0 && p1 === 0 && !who, `during Kim's turn: still indestructible (${i0}/${i1}), Kim's Bears still 0 power (${p0}/${p1})`);
      await B.evaluate(() => { S.stk = []; passTurn(); }); await sleep(1500);
      const i2 = await ind(), p2 = await bp();
      check(!i2 && p2 === 2, `my next turn: both effects ended (indestructible ${i2}, Kim's Bears power ${p2})`);
      await waitFor(A, () => phaseNow().ph >= 1, null, 5000); await settle(A, [B]);
    });
    await step('Cycling and basic landcycling (Mental Journey) as hand buttons; “when you cycle” (Shark Typhoon)', async () => {
      await waitFor(A, () => phaseNow().mine && phaseNow().ph === 3, null, 8000);
      await give(A, 'Mental Journey'); await setPool(A, {U:1, C:1}); await want(A, 'Island|Forest|Plains|Mountain|Swamp');
      const h0 = await A.evaluate(() => S.hand.length); let r = await menuClick(A, await handId(A, 'Mental Journey'), /Basic landcycling/);
      check(r === 'ok', 'one-click “Basic landcycling {1}{U}” (' + r + ')'); await settle(A, [B]); await sleep(400);
      const r1 = await A.evaluate(() => [S.hand.length, S.gy.some(c => cname(c) === 'Mental Journey'), isLand(S.hand[S.hand.length - 1].k) && /Basic/.test(info(S.hand[S.hand.length - 1].k).t)]);
      check(r1[0] === h0 && r1[1] && r1[2], `discarded it, found a basic land (hand ${h0}→${r1[0]})`);
      await give(A, 'Shark Typhoon'); await setPool(A, {U:1, C:3}); await want(A, null);
      await A.evaluate(() => { const om = askNumber; window.__an = om; askNumber = () => Promise.resolve(2); });
      const h1 = await A.evaluate(() => S.hand.length);
      r = await menuClick(A, await handId(A, 'Shark Typhoon'), /^Cycling/); check(r === 'ok', 'one-click “Cycling {X}{1}{U}” (' + r + ')'); await settle(A, [B]); await sleep(400);
      await A.evaluate(() => { askNumber = window.__an; });
      const r2 = await A.evaluate(() => { const t = S.bf.find(c => c.tok && /Shark/.test(cname(c))); return [S.hand.length, t ? stats(t) : null, S.pool.C + S.pool.U]; });
      if (!r2[1]) console.log('    tokens:', await A.evaluate(() => JSON.stringify(S.bf.filter(c => c.tok).map(c => [cname(c), c.k, stats(c)]))));
      check(r2[0] === h1 && r2[1] && r2[1][0] === 2 && r2[2] === 0, `paid {2}{1}{U}, drew a card, and a 2/2 Shark was made (${JSON.stringify(r2)})`);
    });
    await step('Miracle: Triumph of Saint Katherine drawn first this turn → cast for {1}{W}', async () => {
      await A.evaluate(() => { const i = S.hand.findIndex(c => cname(c) === 'Triumph of Saint Katherine'); const j = S.lib.findIndex(c => cname(c) === 'Triumph of Saint Katherine'); const z = i >= 0 ? S.hand : S.lib; const k = i >= 0 ? i : j; const [c] = z.splice(k, 1); S.lib.unshift(c); S.drawn = 0; S.drawnT = ''; S.pool = {...emptyPool(), W:1, C:1}; commit(); });
      await want(A, 'Cast'); await A.evaluate(() => draw(1)); await settle(A, [B]); await sleep(500); await settle(A, [B]);
      const r = await A.evaluate(() => [S.bf.some(c => cname(c) === 'Triumph of Saint Katherine'), S.pool.W + S.pool.C]);
      check(r[0] && r[1] === 0, `cast for its miracle cost and resolved (${JSON.stringify(r)})`);
      await A.evaluate(() => { const c = S.lib.find(c => !isLand(c.k)); S.lib.splice(S.lib.indexOf(c), 1); S.lib.unshift(c); }); const n0 = await A.evaluate(() => S.stk.length);
      await A.evaluate(() => draw(1)); await sleep(300); check(await A.evaluate(n => S.stk.length === n, n0), 'the second draw of the turn offers nothing');
      await want(A, null);
    });
    await step('Flashback with Sphere of Resistance: costs {2}{R} + {1}, card is exiled afterwards', async () => {
      await put(B, 'Sphere of Resistance'); await sleep(800);
      await A.evaluate(() => { const c = S.lib.find(c => cname(c) === 'Faithless Looting') || S.hand.find(c => cname(c) === 'Faithless Looting'); moveCard(c.id, 'gy', {quiet:true}); S.pool = {...emptyPool(), R:1, C:3}; commit(); });
      const why = await A.evaluate(() => { const c = S.gy.find(c => cname(c) === 'Faithless Looting'); const g = gyOptions(c).find(o => o.kind === 'flashback'); const sc = spellCost(c, 'gy', {alt:{mana:g.mana}}); return costStr(sc.cost); });
      check(/3/.test(why) && /R/.test(why), `flashback costs ${why} with Sphere`);
      await A.evaluate(() => { const c = S.gy.find(c => cname(c) === 'Faithless Looting'); castFromGy(c, gyOptions(c).find(o => o.kind === 'flashback')); }); await sleep(500); await settle(A, [B]); await sleep(500);
      check(await zoneOf(A, 'Faithless Looting') === 'ex' && await A.evaluate(() => S.pool.R + S.pool.C) === 0, 'cast from the graveyard, then exiled; mana spent');
    });
    await step('Channel: Otawara bounces a creature from hand', async () => {
      await give(A, 'Otawara, Soaring City'); await setPool(A, {U:1, C:3}); await A.evaluate(() => { window.__tgt = 'Sphere'; });
      const r = await menuClick(A, await handId(A, 'Otawara, Soaring City'), /discard|Channel/i); check(r === 'ok', 'channel button in hand menu (' + r + ')');
      await settle(A, [B]); await sleep(1200); await settle(A, [B]);
      const kb = await B.evaluate(() => S.hand.some(c => cname(c) === 'Sphere of Resistance') && !S.bf.some(c => cname(c) === 'Sphere of Resistance'));
      check(kb && await zoneOf(A, 'Otawara, Soaring City') === 'gy', 'Kim\'s Sphere of Resistance returned to hand, Otawara in graveyard');
      await A.evaluate(() => { window.__tgt = null; });
    });
    await step('Madness: Necrogoyf discarded → exiled → cast for {1}{B}{B}', async () => {
      await give(A, 'Necrogoyf'); await setPool(A, {B:2, C:1}); await want(A, 'Cast');
      await A.evaluate(() => { const c = S.hand.find(c => cname(c) === 'Necrogoyf'); UI.discarding = []; moveCard(c.id, 'gy'); UI.discarding = null; });
      await sleep(300); await settle(A, [B]); await sleep(500); await settle(A, [B]);
      const r = await A.evaluate(() => [S.bf.some(c => cname(c) === 'Necrogoyf'), S.pool.B + S.pool.C]);
      check(r[0] && r[1] === 0, `cast for its madness cost and resolved (${JSON.stringify(r)})`);
      await give(A, 'Necrogoyf'); await want(A, 'graveyard'); await A.evaluate(() => { const c = S.hand.find(c => cname(c) === 'Necrogoyf'); moveCard(c.id, 'gy'); }); await sleep(300); await settle(A, [B]);
      check(await zoneOf(A, 'Necrogoyf') === 'gy', 'declining madness puts it into the graveyard');
      await want(A, null);
    });
    await step('Adventure: Stomp from hand → exile → cast Bonecrusher Giant from exile', async () => {
      await give(A, 'Test Giant // Stomp Test'); await setPool(A, {R:1, C:2});
      const r = await A.evaluate(() => { const c = S.hand.find(c => /Test Giant/.test(cname(c))); const ok = /Stomp Test \(adventure\)/.test(castMenuItems(c, 'hand')); castFace(c, 'hand', '1'); return ok; }); check(r, 'adventure option in the hand menu');
      await sleep(400); await settle(A, [B]); await sleep(400);
      const z = await zoneOf(A, 'Test Giant // Stomp Test'); check(z === 'ex', 'went on an adventure (exile): ' + z);
      await setPool(A, {R:1, C:2}); await A.evaluate(() => { const c = S.ex.find(c => /Test Giant/.test(cname(c))); beginCast(c, 'ex', {}); }); await sleep(400); await settle(A, [B]); await sleep(400);
      check(await A.evaluate(() => S.bf.some(c => /Test Giant/.test(cname(c)))), 'the creature was cast from exile');
    });
    await step('Dash and kicker as one-click options', async () => {
      await give(A, 'Ragavan, Nimble Pilferer'); await setPool(A, {R:1, C:1});
      let r = await menuClick(A, await handId(A, 'Ragavan, Nimble Pilferer'), /Dash/); check(r === 'ok', 'dash button (' + r + ')');
      await sleep(300); await settle(A, [B]); await sleep(300);
      const d = await A.evaluate(() => { const c = S.bf.find(c => /Ragavan/.test(cname(c))); return c ? [hasHaste(c), S.dly.some(x => x.srcId === c.id)] : null; });
      check(d && d[0] && d[1], 'dashed Ragavan has haste and returns at end step ' + JSON.stringify(d));
      await A.evaluate(() => fireSteps('end', MYPID)); await settle(A, [B]); await sleep(300);
      check(await zoneOf(A, 'Ragavan, Nimble Pilferer') === 'hand', 'back in hand at the end step');
      await give(A, 'Everflowing Chalice'); await setPool(A, {C:4}); await want(A, '2 times');
      await A.evaluate(() => { const c = S.hand.find(c => cname(c) === 'Everflowing Chalice'); beginCast(c, 'hand', {}); }); await sleep(500); await settle(A, [B]); await sleep(400);
      const ch = await A.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Everflowing Chalice'); return c ? [(c.nc || {}).charge, S.pool.C] : null; }); if (!ch) console.log('    chalice:', await zoneOf(A, 'Everflowing Chalice'), await A.evaluate(() => S.log.slice(-6).map(e => e.s).join(' | ')));
      check(ch && ch[0] === 2 && ch[1] === 0, 'multikicker ×2: paid {4}, Chalice has 2 charge counters ' + JSON.stringify(ch));
      await want(A, null);
    });

    await step('Warp, prototype, bestow, plot, spectacle as one-click hand options', async () => {
      await give(A, 'Weftstalker Ardent'); await setPool(A, {R:1});
      let r = await menuClick(A, await handId(A, 'Weftstalker Ardent'), /Warp/); check(r === 'ok', 'warp button (' + r + ')'); await sleep(300); await settle(A, [B]); await sleep(300);
      check(await zoneOf(A, 'Weftstalker Ardent') === 'bf', 'cast for its warp cost {R}');
      await A.evaluate(() => fireSteps('end', MYPID)); await settle(A, [B]); await sleep(300);
      const w = await A.evaluate(() => { const c = S.ex.find(c => cname(c) === 'Weftstalker Ardent'); return c ? [!!c.mayPlay, exWindowOk(c)] : null; });
      check(w && w[0] && !w[1], 'exiled at the end step; castable from exile, but only on a later turn ' + JSON.stringify(w));
      await give(A, 'Steel Seraph'); await setPool(A, {W:2, C:1});
      r = await menuClick(A, await handId(A, 'Steel Seraph'), /Prototype/); check(r === 'ok', 'prototype button (' + r + ')'); await sleep(300); await settle(A, [B]); await sleep(300);
      const ss = await A.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Steel Seraph'); return c ? stats(c) : null; });
      check(ss && ss[0] === 3 && ss[1] === 3, 'prototyped Steel Seraph is 3/3 ' + JSON.stringify(ss));
      await A.evaluate(() => { if (!S.bf.some(c => cname(c) === 'Grizzly Bears')) { const c = S.lib.find(c => cname(c) === 'Grizzly Bears') || S.hand.find(c => cname(c) === 'Grizzly Bears') || S.gy.find(c => cname(c) === 'Grizzly Bears'); if (c) moveCard(c.id, 'bf', {quiet:true}); } window.__tgt = 'Grizzly'; commit(); });
      await give(A, 'Springheart Nantuko'); await setPool(A, {G:1, C:1}); const gp0 = await A.evaluate(() => stats(S.bf.find(c => cname(c) === 'Grizzly Bears'))[0]);
      r = await menuClick(A, await handId(A, 'Springheart Nantuko'), /Bestow/); check(r === 'ok', 'bestow button (' + r + ')'); await sleep(500); await settle(A, [B]); await sleep(300);
      const bw = await A.evaluate(() => { const n = S.bf.find(c => cname(c) === 'Springheart Nantuko'); const g = S.bf.find(c => cname(c) === 'Grizzly Bears'); return n && g ? [isCreatureCard(n), stats(g)[0], n.att && n.att.id === g.id] : null; });
      check(bw && !bw[0] && bw[1] === gp0 + 1 && bw[2], `bestowed: Nantuko is an Aura on Grizzly Bears (+1 power: ${gp0}→${bw && bw[1]}), not a creature ` + JSON.stringify(bw));
      await A.evaluate(() => { const g = S.bf.find(c => cname(c) === 'Grizzly Bears'); moveCard(g.id, 'gy'); window.__tgt = null; }); await sleep(300);
      check(await A.evaluate(() => { const n = S.bf.find(c => cname(c) === 'Springheart Nantuko'); return !!n && isCreatureCard(n); }), 'its creature left: Nantuko stays as a creature');
      await give(A, 'Highway Robbery'); await setPool(A, {R:1, C:1});
      r = await menuClick(A, await handId(A, 'Highway Robbery'), /Plot/); check(r === 'ok', 'plot button (' + r + ')'); await sleep(300);
      const pl = await A.evaluate(() => { const c = S.ex.find(c => cname(c) === 'Highway Robbery'); return c ? [c.r21bplot === turnStr(), /disabled/.test(r7ExButtons(c))] : null; });
      check(pl && pl[0] && pl[1], 'plotted into exile; casting it is disabled until a later turn ' + JSON.stringify(pl));
      await give(A, 'Light Up the Stage'); await setPool(A, {R:1});
      const sp0 = await A.evaluate(() => { const c = S.hand.find(c => cname(c) === 'Light Up the Stage'); const o = r21bAlts(c, 'hand').find(o => o.kind === 'spectacle'); return o.why; });
      await A.evaluate(() => { loseLife(opponents()[0].pid, 1, 'test'); }); await sleep(1500);
      const sp1 = await A.evaluate(() => { const c = S.hand.find(c => cname(c) === 'Light Up the Stage'); const o = r21bAlts(c, 'hand').find(o => o.kind === 'spectacle'); return o.why; });
      check(!!sp0 && !sp1, `spectacle is offered only after an opponent lost life (before: “${sp0}”, after: “${sp1}”)`);
    });
    await step('Stasis: “sacrifice unless you pay {U}” at upkeep', async () => {
      await put(A, 'Stasis'); await setPool(A, {U:1}); await want(A, 'Pay'); await up();
      check(await zoneOf(A, 'Stasis') === 'bf' && await A.evaluate(() => S.pool.U) === 0, 'paid {U}: Stasis stays');
      await setPool(A, {}); await want(A, 'Sacrifice'); await up();
      check(await zoneOf(A, 'Stasis') === 'gy', 'no {U}: sacrificed'); await want(A, null);
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
