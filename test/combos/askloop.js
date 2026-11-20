// v26: loops ask "how many times?" by themselves — a loop done twice by hand is spotted, and endless trigger loops ask too.
module.exports = async ({A, B, check, sleep, waitFor, after, fresh, putP, toZone, pool, poolOf, act, castH, life, lost, cnt, noNotes, step}) => {
  const doAll = async (...steps) => { for (const s of steps){ const r = await s(); if (r !== 'ok' && r !== 'mana') return r; await after(); } return true; };
  const chosen = () => A.evaluate(() => window.__chosen || []);

  await step('L1 Kinnan + Basalt Monolith done twice by hand → asks how many times', async () => {
    await fresh(); await putP(A, 'Kinnan, Bonder Prodigy'); await putP(A, 'Basalt Monolith'); await pool(A, {});
    await A.evaluate(() => { window.__wantQ = ['how many times']; window.__XQ = [7]; });
    const once = () => doAll(() => act(A, 'Basalt Monolith', 'Add \\{C\\}\\{C\\}\\{C\\}'), () => act(A, 'Basalt Monolith', '^\\{3\\}: Untap'));
    check(await once() === true, 'loop 1 by hand'); check(await once() === true, 'loop 2 by hand'); await after();
    const asked = await waitFor(A, () => (window.__chosen || []).some(s => /looks like a loop/.test(s)), null, 15000);
    check(asked, 'the table spotted the loop and asked (' + JSON.stringify(await chosen()) + ')');
    const ok = await waitFor(A, () => S.log.some(e => /repeated the loop 7 times/.test(e.s)), null, 60000); await after();
    check(ok, 'it repeated the loop 7 times');
    const p = await poolOf(A); check((p.C || 0) === 9, `pool has 2 + 7 = 9 {C} (${JSON.stringify(p)})`);
    await noNotes('L1');
  });

  await step('L2 Gravecrawler + Phyrexian Altar + Blood Artist twice by hand → "until every opponent is dead"', async () => {
    await fresh(); await B.evaluate(() => { S.life = 10; commit(); }); await sleep(1000);
    for (const p of ['Gravecrawler', 'Phyrexian Altar', 'Blood Artist']) await putP(A, p);
    await A.evaluate(() => { createFromText('Create a 2/2 black Zombie creature token.', {k:null, name:'setup', it:{}}); window.__tgt = 'kim'; window.__want = ['every opponent is dead', '^B$|black|\\{B\\}']; window.__pickRe = 'Gravecrawler'; commit(); }); await sleep(800);
    await pool(A, {});
    const once = () => doAll(() => act(A, 'Phyrexian Altar', 'Sacrifice', 2),
      () => A.evaluate(() => { const c = S.gy.find(x => cname(x) === 'Gravecrawler'); if (!c) return 'Gravecrawler not in graveyard'; const g = gyOptions(c)[0]; if (!g) return 'no option'; castFromGy(c, g); return 'ok'; }));
    check(await once() === true, 'loop 1 by hand'); check(await once() === true, 'loop 2 by hand'); await after();
    if (process.env.DBG) console.log(await A.evaluate(() => JSON.stringify(UI.recDone)));
    const ok = await waitFor(B, () => S.life <= 0, null, 90000); await after();
    check(ok, `Kim is drained to 0 by the repeated loop (Kim ${await life(B)}; ${JSON.stringify(await chosen())})`);
    check(await lost(B), 'Kim lost the game');
    await noNotes('L2');
  });

  await step('L3 Sanguine Bond + Exquisite Blood at 40 life → asks, "until every opponent is dead"', async () => {
    await fresh(); await B.evaluate(() => { S.life = 40; commit(); }); await sleep(1000);
    for (const p of ['Sanguine Bond', 'Exquisite Blood']) await putP(A, p);
    await A.evaluate(() => { window.__tgt = 'kim'; window.__want = 'every opponent is dead'; }); await sleep(400);
    await A.evaluate(() => { gainLife(1, 'test'); commit(); }); await after();
    const ok = await waitFor(B, () => S.life <= 0, null, 180000); await after();
    const ch = await chosen();
    check(ch.some(s => /go on forever/.test(s)), 'the trigger loop asked how many times (' + JSON.stringify(ch.slice(-3)) + ')');
    check(ok && await lost(B), `the loop then ran until Kim lost (Kim ${await life(B)})`);
    await noNotes('L3');
  });

  await step('L4 Sanguine Bond + Exquisite Blood → "a number of times" stops after that many', async () => {
    await fresh(); await sleep(6000);   // a chosen loop count lasts until 5 s after the loop's last trigger await B.evaluate(() => { S.life = 40; commit(); }); await sleep(1000);
    for (const p of ['Sanguine Bond', 'Exquisite Blood']) await putP(A, p);
    await A.evaluate(() => { window.__tgt = 'kim'; window.__wantQ = ['number of times']; window.__XQ = [5]; }); await sleep(400);
    await A.evaluate(() => { gainLife(1, 'test'); commit(); }); await after();
    await waitFor(A, () => S.log.some(e => /ran the chosen number of times/.test(e.s)), null, 90000); await after(); await sleep(2000); await after();
    const k = await life(B);
    check(k > 0 && k < 40, `the loop stopped with Kim still alive (Kim ${k})`);
    check(await A.evaluate(() => !stackAll().length && !UI.resolving), 'nothing left on the stack');
  });

  await step('L5 combo memory: Exquisite Blood out, Sanguine Bond in hand → "Combo ready"', async () => {
    await fresh(); await A.evaluate(() => { F25.seen = {}; F25.lastChk = ''; }); await toZone(A, 'Sanguine Bond', 'hand'); await putP(A, 'Exquisite Blood'); await sleep(1500);
    const msg = await A.evaluate(() => (S.log.filter(e => /Combo ready/.test(e.s)).pop() || {}).s || '');
    check(/Exquisite Blood/.test(msg) && /Sanguine Bond/.test(msg), 'the table recognised the combo: ' + msg.slice(0, 120));
    const n = await A.evaluate(() => f25deckCombos().length); check(n >= 1, `Game ▾ → Combos in my deck lists ${n}`);
  });
  await step('L6 Hullbreaker Horror + Sol Ring + Ornithopter twice by hand → asks how many times', async () => {
    await fresh(); await putP(A, 'Hullbreaker Horror'); await putP(A, 'Sol Ring'); await toZone(A, 'Ornithopter', 'hand'); await pool(A, {});
    await A.evaluate(() => { window.__want = ['nonland permanent', 'how many times']; window.__tgtQ = ['Sol Ring', 'Ornithopter', 'Sol Ring', 'Ornithopter']; window.__XQ = [6]; });
    const once = () => doAll(() => act(A, 'Sol Ring', 'Add'), () => castH(A, 'Ornithopter'), () => castH(A, 'Sol Ring'));
    const r1 = await once(); check(r1 === true, 'loop 1 by hand (' + r1 + ')');
    const p1 = await poolOf(A); check((p1.C || 0) === 1, `+1 {C} after one loop (${JSON.stringify(p1)})`);
    const r2 = await once(); check(r2 === true, 'loop 2 by hand (' + r2 + ')'); await after();
    if (process.env.DBG) console.log(await A.evaluate(() => JSON.stringify(F25.sh.map(e => [e.a.t, e.a.k, e.pool, e.tok, e.life, e.lib, e.hand, e.olib, e.sig.length])) + ' find=' + JSON.stringify(f25find() && f25find().k) + ' sigok=' + (F25.sh.length > 2 && F25.sh[F25.sh.length-3].sig === f25sig()) + ' wait=' + UI.f25wait + ' asked=' + JSON.stringify(F25.asked)));
    const ok = await waitFor(A, () => S.log.some(e => /repeated the loop 6 times/.test(e.s)), null, 90000); await after();
    check(ok, 'it spotted the loop and repeated it 6 times (' + JSON.stringify(await chosen()) + ')');
    const p = await poolOf(A); check((p.C || 0) === 8, `pool has 2 + 6 = 8 {C} (${JSON.stringify(p)})`);
    check(await cnt(A, 'Sol Ring') === 1 && await cnt(A, 'Ornithopter', 'hand') === 1, 'Sol Ring on the battlefield, Ornithopter back in hand');
    await noNotes('L6');
  });
  await step('L7 sacrificing three different tokens to Viscera Seer is not a loop', async () => {
    await fresh(); await putP(A, 'Viscera Seer');
    await A.evaluate(() => { createFromText('Create three 1/1 green Squirrel creature tokens.', {k:null, name:'setup', it:{}}); window.__pickRe = 'Squirrel'; commit(); }); await sleep(800);
    for (let i = 0; i < 3; i++){ const r = await act(A, 'Viscera Seer', 'Sacrifice'); check(r === 'ok', 'sacrifice a Squirrel (' + r + ')'); await after(); }
    await sleep(1500);
    const ch = await chosen(); check(!ch.some(s => /looks like a loop/.test(s)), 'no "looks like a loop" question (' + JSON.stringify(ch) + ')');
  });
  await step('L8 Necropotence three times (1 life each) is not a loop', async () => {
    await fresh(); await putP(A, 'Necropotence');
    for (let i = 0; i < 3; i++){ const r = await act(A, 'Necropotence', 'Pay 1 life'); check(r === 'ok', 'activate Necropotence (' + r + ')'); await after(); }
    await sleep(1500);
    const ch = await chosen(); check(!ch.some(s => /looks like a loop/.test(s)), 'no "looks like a loop" question (' + JSON.stringify(ch) + ')');
  });
  await step('L9 Walking Ballista pinging three times (one counter each) is not a loop', async () => {
    await fresh(); await putP(A, 'Walking Ballista', {cp:3}); await A.evaluate(() => { window.__tgt = 'kim'; });
    for (let i = 0; i < 3; i++){ const r = await act(A, 'Walking Ballista', 'Remove'); check(r === 'ok', 'ping (' + r + ')'); await after(); }
    await sleep(1500);
    const ch = await chosen(); check(!ch.some(s => /looks like a loop/.test(s)), 'no "looks like a loop" question (' + JSON.stringify(ch) + ')');
  });
  await step('L10 Rings of Brighthearth + Basalt Monolith (tap Basalt while its untap is still on the stack) twice → asked → repeats', async () => {
    await fresh(); await putP(A, 'Rings of Brighthearth'); await putP(A, 'Basalt Monolith'); await pool(A, {C:2});
    await A.evaluate(() => { F25.asked = {}; F25.sh = []; window.__want = ['^Pay', 'how many times']; window.__XQ = [5]; });
    const depth = () => A.evaluate(() => stackAll().length);
    const downTo = async d => { for (let i = 0; i < 80; i++){ if (await depth() <= d && !(await A.evaluate(() => UI.resolving))) return true; for (const p of [A, B]) await p.evaluate(() => { try { if (myBox()) doPass(); } catch {} }); await sleep(250); } return false; };
    const once = async () => {
      let r = await act(A, 'Basalt Monolith', 'Add \\{C\\}\\{C\\}\\{C\\}'); if (r !== 'ok' && r !== 'mana') return 'tap 1: ' + r;
      r = await act(A, 'Basalt Monolith', '^\\{3\\}: Untap'); if (r !== 'ok') return 'untap: ' + r;
      await sleep(600);
      for (let i = 0; i < 40 && await A.evaluate(() => S.bf.find(c => cname(c) === 'Basalt Monolith').tap); i++){ for (const p of [A, B]) await p.evaluate(() => { try { if (myBox()) doPass(); } catch {} }); await sleep(300); }
      if (await A.evaluate(() => S.bf.find(c => cname(c) === 'Basalt Monolith').tap)) return 'Basalt still tapped after the copy';
      if (await depth() !== 1) return 'the original untap is not on the stack any more (' + await depth() + ')';
      r = await act(A, 'Basalt Monolith', 'Add \\{C\\}\\{C\\}\\{C\\}'); if (r !== 'ok' && r !== 'mana') return 'tap 2: ' + r;
      await after(); return true; };
    const p0 = await poolOf(A);
    const r1 = await once(); check(r1 === true, 'loop 1 by hand (' + r1 + ')'); const p1 = await poolOf(A);
    check((p1.C || 0) - (p0.C || 0) === 1, `+1 {C} per loop (${p0.C} → ${p1.C})`);
    const r2 = await once(); check(r2 === true, 'loop 2 by hand (' + r2 + ')'); await after();
    const ok = await waitFor(A, () => S.log.some(e => /repeated the loop 5 times/.test(e.s)), null, 90000); await after();
    check(ok, 'spotted and repeated 5 times (' + await A.evaluate(() => (S.log.filter(e => /repeated the loop/.test(e.s)).pop() || {}).s) + ')');
    const p = await poolOf(A); check((p.C || 0) === (p0.C || 0) + 7, `pool ${p0.C} + 2 by hand + 5 repeated = ${(p0.C || 0) + 7} (${JSON.stringify(p)})`);
    await noNotes('L10');
  });
  await step('L11 Kinnan + Basalt Monolith: the table asks after the first time round', async () => {
    await A.evaluate(() => { window.__early = 1; }); await fresh(); await putP(A, 'Kinnan, Bonder Prodigy'); await putP(A, 'Basalt Monolith'); await pool(A, {});
    await A.evaluate(() => { F25.asked = {}; F25.sh = []; window.__wantQ = ['how many times']; window.__XQ = [5]; });
    const r = await doAll(() => act(A, 'Basalt Monolith', 'Add \\{C\\}\\{C\\}\\{C\\}'), () => act(A, 'Basalt Monolith', '^\\{3\\}: Untap')); check(r === true, 'one loop by hand (' + r + ')'); await after();
    const ok = await waitFor(A, () => S.log.some(e => /repeated the loop 5 times/.test(e.s)), null, 60000); await after();
    check(ok, 'asked after one time round and repeated 5 times (' + JSON.stringify(await chosen()) + ')');
    const p = await poolOf(A); check((p.C || 0) === 6, `pool 1 + 5 = 6 {C} (${JSON.stringify(p)})`);
    await A.evaluate(() => { window.__early = 0; });
  });
  await step('L12 Niv-Mizzet + Curiosity: the first trigger asks before the loop goes round', async () => {
    await A.evaluate(() => { window.__early = 1; }); await fresh(); await sleep(6000); await B.evaluate(() => { S.life = 40; commit(); }); await sleep(800);
    for (const p of ['Niv-Mizzet, Parun', 'Curiosity']) await putP(A, p);
    await A.evaluate(() => { const n = S.bf.find(c => cname(c) === 'Niv-Mizzet, Parun'), c = S.bf.find(c => cname(c) === 'Curiosity'); c.att = {pid:MYPID, id:n.id}; window.__tgt = 'kim'; window.__want = ['every opponent is dead', '^yes', 'draw']; commit(); }); await sleep(400);
    await A.evaluate(() => { draw(1); commit(); });
    const asked = await waitFor(A, () => (window.__chosen || []).some(s => /go on forever/.test(s)), null, 15000);
    const pings = await A.evaluate(() => (window.__tgts || []).length);
    check(asked && pings <= 1, `asked "how many times" before the loop went round (${pings} ping target${pings === 1 ? '' : 's'} chosen first)`);
    const ok = await waitFor(B, () => S.life <= 0, null, 180000); await after();
    check(ok && await lost(B), `then it ran until Kim lost (Kim ${await life(B)})`);
    await A.evaluate(() => { window.__early = 0; });
  });
};
