// Graveyard recursion loops: the same creature dies and comes back again and again; death triggers (Blood Artist / Zulaport) do the damage.
module.exports = async ({A, B, check, sleep, waitFor, after, fresh, putP, toZone, pool, poolOf, act, castH, rec, repeat, life, cnt, noNotes, step}) => {
  const doAll = async (...steps) => { for (const s of steps){ const r = await s(); if (r !== 'ok' && r !== 'mana') return r; await after(); } return true; };
  const kimLife = () => life(B);

  await step('R1 Gravecrawler + Phyrexian Altar (+ a Zombie) + Blood Artist', async () => {
    await fresh(); await B.evaluate(() => { S.life = 30; commit(); }); await sleep(1000);
    for (const p of ['Gravecrawler', 'Phyrexian Altar', 'Blood Artist']) await putP(A, p);
    await A.evaluate(() => { createFromText('Create a 2/2 black Zombie creature token.', {k:null, name:'setup', it:{}}); window.__tgt = 'kim'; window.__want = '^B$|black|\\{B\\}'; commit(); }); await sleep(800);
    const k0 = await kimLife(); await pool(A, {});
    await rec(A);
    const r = await doAll(() => act(A, 'Phyrexian Altar', 'Sacrifice', 2), async () => { await A.evaluate(() => { window.__pickRe = 'Gravecrawler'; }); return 'ok'; },
      () => A.evaluate(() => { const c = S.gy.find(x => cname(x) === 'Gravecrawler'); if (!c) return 'Gravecrawler not in graveyard'; const g = gyOptions(c)[0]; if (!g) return 'no cast-from-graveyard option'; castFromGy(c, g); return 'ok'; }));
    check(r === true, 'one loop: sacrifice Gravecrawler for {B}, cast it from the graveyard (' + r + ')'); await after();
    check(await cnt(A, 'Gravecrawler') === 1, 'Gravecrawler is back');
    const k1 = await kimLife(); check(k0 - k1 === 1, `Blood Artist drained Kim 1 (${k0} → ${k1})`);
    const msg = await repeat(A, 6); check(/repeated the loop 6 times/.test(msg || ''), 'Repeat ×6: ' + msg); await after();
    const k2 = await kimLife(); check(k1 - k2 === 6, `6 more drains (${k1} → ${k2})`);
    check(await cnt(A, 'Gravecrawler') === 1, 'Gravecrawler still on the battlefield after the loops');
    await noNotes('R1');
  });
  await step('R2 Mikaeus, the Unhallowed + Triskelion', async () => {
    await fresh(); await B.evaluate(() => { S.life = 30; commit(); }); await sleep(1000);
    await putP(A, 'Mikaeus, the Unhallowed'); await putP(A, 'Triskelion'); await sleep(500);
    await A.evaluate(() => { window.__tgtQ = ['kim', 'Triskelion', 'Triskelion']; });
    const k0 = await kimLife();
    for (let i = 0; i < 3; i++){ const r = await act(A, 'Triskelion', 'Remove'); check(r === 'ok', 'remove a counter: ' + r); await after(); }
    await after();
    const k1 = await kimLife(); check(k0 - k1 === 1, `one ping at Kim, two at itself (${k0} → ${k1})`);
    check(await waitFor(A, () => { const t = S.bf.find(x => cname(x) === 'Triskelion'); return t && (t.cp || 0) === 4; }, null, 20000), `Triskelion pinged itself, died, came back by undying with 3 + 1 counters (${JSON.stringify(await A.evaluate(() => S.bf.filter(x => cname(x) === 'Triskelion').map(x => [x.cp, x.cm, stats(x)])))})`);
    await noNotes('R2');
  });
  await step('R3 Mikaeus + Murderous Redcap + Viscera Seer', async () => {
    await fresh(); await B.evaluate(() => { S.life = 30; commit(); }); await sleep(1000);
    await putP(A, 'Mikaeus, the Unhallowed'); await putP(A, 'Viscera Seer'); await putP(A, 'Murderous Redcap'); await after();
    await A.evaluate(() => { window.__tgt = 'kim'; window.__pickRe = 'Murderous Redcap'; window.__want = 'Murderous Redcap|bottom|top|keep'; }); await after();
    const k0 = await kimLife();
    await rec(A); const r = await doAll(() => act(A, 'Viscera Seer', 'Sacrifice')); check(r === true, 'sacrifice Redcap: ' + r); await after();
    check(await cnt(A, 'Murderous Redcap') === 1, 'Redcap came back (persist or undying)');
    const k1 = await kimLife(); check(k0 - k1 >= 2, `Redcap's enters trigger hit Kim (${k0} → ${k1})`);
    const msg = await repeat(A, 4); check(/repeated the loop 4 times/.test(msg || ''), 'Repeat ×4: ' + msg); await after();
    const k2 = await kimLife(); check(k1 - k2 >= 8, `four more loops hit Kim each time (${k1} → ${k2})`);
    check(await cnt(A, 'Murderous Redcap') === 1, 'Redcap still on the battlefield');
    await noNotes('R3');
  });
  await step('R4 Kitchen Finks + Melira + Viscera Seer', async () => {
    await fresh(); for (const p of ['Melira, Sylvok Outcast', 'Viscera Seer', 'Kitchen Finks']) await putP(A, p); await after();
    await A.evaluate(() => { window.__pickRe = 'Kitchen Finks'; window.__want = 'Kitchen Finks|bottom|top|keep'; }); const l0 = await life(A);
    await rec(A); const r = await doAll(() => act(A, 'Viscera Seer', 'Sacrifice')); check(r === true, 'sacrifice Finks: ' + r); await after();
    const f = await A.evaluate(() => S.bf.filter(x => cname(x) === 'Kitchen Finks').map(x => x.cm || 0)); check(f.length === 1 && f[0] === 0, `Finks came back with no -1/-1 counter thanks to Melira (${JSON.stringify(f)})`);
    const l1 = await life(A); check(l1 - l0 === 2, `gained 2 (${l0} → ${l1})`);
    const msg = await repeat(A, 5); check(/repeated the loop 5 times/.test(msg || ''), 'Repeat ×5: ' + msg); await after();
    const l2 = await life(A); check(l2 - l1 === 10, `+2 life per loop (${l1} → ${l2})`);
    await noNotes('R4');
  });
  await step('R5 Reveillark + Karmic Guide + Viscera Seer', async () => {
    await fresh(); await A.evaluate(() => { window.__tgt = 'NOTHING'; }); for (const p of ['Viscera Seer', 'Reveillark', 'Karmic Guide']) await putP(A, p); await after();
    await A.evaluate(() => { window.__pickRe = 'Karmic Guide'; window.__want = 'Karmic Guide|yes'; });
    const r1 = await act(A, 'Viscera Seer', 'Sacrifice'); await after();
    await A.evaluate(() => { window.__pickRe = 'Reveillark'; window.__tgtQ = ['Karmic Guide', 'Reveillark']; });
    const r2 = await act(A, 'Viscera Seer', 'Sacrifice'); await after(); await after();
    const s = await A.evaluate(() => ({bf:S.bf.filter(x => /Reveillark|Karmic Guide/.test(cname(x))).map(cname), gy:S.gy.filter(x => /Reveillark|Karmic Guide/.test(cname(x))).map(cname)}));
    check(r1 === 'ok' && r2 === 'ok' && s.bf.length === 2, `sacrifice Guide, then Reveillark: Reveillark returns Guide, Guide returns Reveillark (${JSON.stringify(s)})`);
    await noNotes('R5');
  });
  await step('R6 Animate Dead + Worldgorger Dragon', async () => {
    await fresh(); await toZone(A, 'Worldgorger Dragon', 'gy'); await toZone(A, 'Animate Dead', 'hand'); for (const p of ['Sol Ring', 'Gilded Lotus']) await putP(A, p);
    await A.evaluate(() => { window.__tgt = 'Worldgorger'; }); await pool(A, {B:2});
    check(await castH(A, 'Animate Dead') === 'ok', 'cast Animate Dead on Worldgorger Dragon'); await after(); await sleep(3000); await after();
    check(await waitFor(A, () => S.log.some(e => /stopped an endless loop/.test(e.s)), null, 90000), 'the endless Worldgorger loop is noticed and the table offers to stop it');
    check(await waitFor(A, () => !stackAll().length && !UI.resolving, null, 30000), 'after stopping, the stack is empty and play goes on');
    await noNotes('R6');
  });
};
