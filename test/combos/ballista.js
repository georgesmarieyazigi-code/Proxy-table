// Walking Ballista lines and the classic creature-copy combos.
module.exports = async ({A, B, check, sleep, waitFor, after, fresh, putP, toZone, pool, poolOf, act, castH, rec, repeat, life, lost, cnt, noNotes, step}) => {
  const doAll = async (...steps) => { for (const s of steps){ const r = await s(); if (r !== 'ok' && r !== 'mana') return r; await after(); } return true; };

  await step('B1 Heliod, Sun-Crowned + Walking Ballista', async () => {
    await fresh(); await B.evaluate(() => { S.life = 10; commit(); }); await sleep(1000);
    await putP(A, 'Heliod, Sun-Crowned'); await putP(A, 'Walking Ballista', {cp:2});
    await A.evaluate(() => { window.__tgt = 'Walking Ballista'; }); await pool(A, {W:1, C:1});
    const r = await act(A, 'Heliod, Sun-Crowned', 'lifelink'); check(r === 'ok', 'Heliod gives Ballista lifelink: ' + r); await after();
    await A.evaluate(() => { window.__tgt = 'kim'; window.__tgtQ = ['kim', 'Walking Ballista']; });
    const k0 = await life(B);
    const r2 = await act(A, 'Walking Ballista', 'Remove'); check(r2 === 'ok', 'ping: ' + r2); await after(); await after();
    const k1 = await life(B); const cp = await A.evaluate(() => (S.bf.find(x => cname(x) === 'Walking Ballista') || {}).cp);
    check(k0 - k1 === 1 && cp === 2, `ping Kim → lifelink → Heliod puts the counter back (Kim ${k0} → ${k1}, counters ${cp})`);
    await A.evaluate(() => { window.__tgtQ = ['kim', 'Walking Ballista']; }); await rec(A); await act(A, 'Walking Ballista', 'Remove'); await after();
    const msg = await repeat(A, 12); await after();
    check(await waitFor(B, () => S.life <= 0, null, 60000), `the loop kills Kim (${await life(B)}; ${msg})`);
    check(await lost(B), 'Kim has lost the game'); await noNotes('B1');
  });
  await step('B2 Kinnan + Basalt Monolith into a huge Walking Ballista', async () => {
    await fresh(); await B.evaluate(() => { S.life = 12; commit(); }); await sleep(1000);
    await putP(A, 'Kinnan, Bonder Prodigy'); await putP(A, 'Basalt Monolith'); await putP(A, 'Walking Ballista', {cp:1}); await pool(A, {});
    await rec(A); await doAll(() => act(A, 'Basalt Monolith', 'Add \\{C\\}\\{C\\}\\{C\\}'), () => act(A, 'Basalt Monolith', '^\\{3\\}: Untap'));
    const msg = await repeat(A, 16); check(/16 times/.test(msg || ''), 'made 17 colorless: ' + msg); await after();
    const c0 = (await poolOf(A)).C || 0;
    for (let i = 0; i < Math.floor(c0 / 4); i++){ const r = await act(A, 'Walking Ballista', 'Put a \\+1/\\+1 counter'); if (r !== 'ok'){ check(false, 'pump Ballista: ' + r); break; } await after(); }
    const cp = await A.evaluate(() => (S.bf.find(x => cname(x) === 'Walking Ballista') || {}).cp || 0); check(cp >= 4, `Ballista grew to ${cp} counters`);
    await A.evaluate(() => { window.__tgt = 'kim'; }); const k0 = await life(B);
    await rec(A); await act(A, 'Walking Ballista', 'Remove'); await after(); const msg2 = await repeat(A, Math.max(1, cp - 1)); await after();
    const k1 = await life(B); check(k0 - k1 === cp, `Ballista shot all ${cp} counters at Kim (${k0} → ${k1}; ${msg2})`);
    await noNotes('B2');
  });
  await step('C1 Kiki-Jiki + Zealous Conscripts', async () => {
    await fresh(); await A.evaluate(() => { window.__tgt = 'NOTHING'; }); await putP(A, 'Kiki-Jiki, Mirror Breaker'); await putP(A, 'Zealous Conscripts'); await after();
    await A.evaluate(() => { window.__tgtQ = ['Zealous Conscripts', 'Kiki-Jiki']; window.__tgt = 'Kiki-Jiki'; });
    const r = await act(A, 'Kiki-Jiki, Mirror Breaker', 'copy'); check(r === 'ok', 'Kiki copies Conscripts: ' + r); await after(); await after();
    const s = await A.evaluate(() => ({kiki:S.bf.filter(x => cname(x) === 'Kiki-Jiki, Mirror Breaker').map(x => !!x.tap), cons:S.bf.filter(x => cname(x) === 'Zealous Conscripts').length}));
    check(s.cons === 2 && s.kiki.length === 1 && !s.kiki[0], `a hasty Conscripts token untapped Kiki-Jiki (${JSON.stringify(s)})`);
    await A.evaluate(() => { window.__tgtQ = []; window.__tgt = 'Zealous Conscripts'; }); await rec(A); await A.evaluate(() => { window.__tgtQ = ['Zealous Conscripts', 'Kiki-Jiki']; });
    await act(A, 'Kiki-Jiki, Mirror Breaker', 'copy'); await after();
    const msg = await repeat(A, 5); await after();
    const n = await cnt(A, 'Zealous Conscripts'); check(n >= 7, `Repeat ×5 made five more hasty copies (${n} Conscripts; ${msg})`); await noNotes('C1');
  });
  await step('C2 Splinter Twin + Pestermite', async () => {
    await fresh(); const pid = await putP(A, 'Pestermite'); const tid = await putP(A, 'Splinter Twin'); await A.evaluate(([p, t]) => { S.bf.find(x => x.id === t).att = {pid:MYPID, id:p}; commit(); }, [pid, tid]);
    await A.evaluate(() => { window.__tgt = 'Pestermite'; window.__want = '^untap|^yes'; }); await after();
    await rec(A); const r = await act(A, 'Pestermite', 'copy'); check(r === 'ok', 'Twin ability: ' + r); await after(); await after();
    const s = await A.evaluate(() => ({p:S.bf.filter(x => cname(x) === 'Pestermite').map(x => [!!x.tok, !!x.tap])}));
    check(s.p.length === 2 && s.p.some(x => !x[0] && !x[1]), `token Pestermite untapped the enchanted one (${JSON.stringify(s)})`);
    const msg = await repeat(A, 5); await after(); const n = await cnt(A, 'Pestermite'); check(n >= 7, `Repeat ×5 → ${n} Pestermites (${msg})`); await noNotes('C2');
  });
  await step('C3 Dualcaster Mage + Twinflame', async () => {
    await fresh(); await putP(A, 'Grizzly Bears'); await toZone(A, 'Twinflame', 'hand'); await toZone(A, 'Dualcaster Mage', 'hand');
    await A.evaluate(() => { window.__tgt = 'Grizzly Bears'; }); await pool(A, {R:2});
    check(await castH(A, 'Twinflame') === 'ok', 'cast Twinflame'); await sleep(600);
    await A.evaluate(() => { window.__tgt = 'NOTHING-STOP'; window.__tgtQ = ['Dualcaster Mage', 'Dualcaster Mage', 'Dualcaster Mage']; window.__want = 'yes|copy|new targets'; }); await pool(A, {R:3});
    check(await castH(A, 'Dualcaster Mage', {flash:true}) === 'ok', 'flash in Dualcaster Mage copying Twinflame'); await after(); await after(); await after();
    const n = await cnt(A, 'Dualcaster Mage'); check(n >= 4, `each hasty Dualcaster token copies Twinflame again — ${n} Dualcasters after three loops, and the loop stops when I stop choosing targets`); await noNotes('C3');
  });
  await step('C4 Food Chain + Eternal Scourge', async () => {
    await fresh(); await putP(A, 'Food Chain'); await toZone(A, 'Eternal Scourge', 'ex'); await pool(A, {G:1, C:2});
    const castEx = () => A.evaluate(() => { const c = S.ex.find(x => cname(x) === 'Eternal Scourge'); if (!c) return 'not in exile'; const o = (typeof exileCastOptions === 'function' ? exileCastOptions(c) : null); if (typeof castFromExile === 'function'){ castFromExile(c); return 'ok'; } beginCast(c, 'ex', {}); return 'ok'; });
    check(await castEx() === 'ok', 'cast Eternal Scourge from exile'); await after();
    await A.evaluate(() => { window.__pickRe = 'Eternal Scourge'; }); await rec(A);
    const r = await act(A, 'Food Chain', 'Exile'); check(r === 'ok' || r === 'mana', 'Food Chain exiles Scourge: ' + r); await after();
    const p1 = await poolOf(A); check((Object.values(p1).reduce((a, b) => a + (+b || 0), 0)) >= 4, `Food Chain made 4 mana (${JSON.stringify(p1)})`);
    check(await castEx() === 'ok', 'cast it again from exile'); await after();
    const msg = await repeat(A, 5); await after(); const p2 = await poolOf(A);
    check(/5 times/.test(msg || ''), `Repeat ×5: ${msg}; pool ${JSON.stringify(p2)} (+1 creature-only mana each loop)`); await noNotes('C4');
  });
};
