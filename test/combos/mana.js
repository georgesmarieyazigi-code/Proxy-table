// Infinite mana: one loop by hand (recorded), then "Repeat the loop" — the pool must grow by the right amount every time.
module.exports = async ({A, B, check, sleep, waitFor, after, fresh, putP, toZone, pool, poolOf, act, castH, rec, repeat, noNotes, step}) => {
  const tot = p => Object.values(p).reduce((a, b) => a + (+b || 0), 0);
  const loop = async (name, setup, once, n, perLoop, color) => step(name, async () => {
    await fresh(); await setup(); await pool(A, {});
    await rec(A); const r = await once(); check(r === true, `${name}: one loop by hand (${r})`); await after();
    const p1 = await poolOf(A); const v1 = color ? p1[color] || 0 : tot(p1);
    const msg = await repeat(A, n); check(new RegExp(`repeated the loop ${n} times`).test(msg || ''), `${name}: Repeat ×${n} ran every time (${msg})`); await after();
    const p2 = await poolOf(A); const v2 = color ? p2[color] || 0 : tot(p2);
    check(v2 - v1 === perLoop * n, `${name}: +${perLoop} ${color || 'mana'} per loop (${v1} → ${v2} after ${n} loops; pool ${JSON.stringify(p2)})`);
    await noNotes(name);
  });
  const doAll = async (...steps) => { for (const s of steps){ const r = await s(); if (r !== 'ok' && r !== 'mana') return r; await after(); } return true; };

  await loop('M1 Kinnan + Basalt Monolith', async () => { await putP(A, 'Kinnan, Bonder Prodigy'); await putP(A, 'Basalt Monolith'); },
    () => doAll(() => act(A, 'Basalt Monolith', 'Add \\{C\\}\\{C\\}\\{C\\}'), () => act(A, 'Basalt Monolith', '^\\{3\\}: Untap')), 8, 1, 'C');
  await loop('M2 Grim Monolith + Power Artifact', async () => { await putP(A, 'Grim Monolith'); const id = await putP(A, 'Power Artifact'); await A.evaluate(id => { const a = S.bf.find(x => x.id === id), g = S.bf.find(x => cname(x) === 'Grim Monolith'); a.att = {pid:MYPID, id:g.id}; commit(); }, id); },
    () => doAll(() => act(A, 'Grim Monolith', 'Add \\{C\\}\\{C\\}\\{C\\}'), () => act(A, 'Grim Monolith', 'Untap')), 8, 1, 'C');
  await loop('M3 Basalt Monolith + Power Artifact', async () => { await putP(A, 'Basalt Monolith'); const id = await putP(A, 'Power Artifact'); await A.evaluate(id => { const a = S.bf.find(x => x.id === id), g = S.bf.find(x => cname(x) === 'Basalt Monolith'); a.att = {pid:MYPID, id:g.id}; commit(); }, id); },
    () => doAll(() => act(A, 'Basalt Monolith', 'Add \\{C\\}\\{C\\}\\{C\\}'), () => act(A, 'Basalt Monolith', 'Untap')), 8, 2, 'C');
  await loop('M4 Devoted Druid + Vizier of Remedies', async () => { await putP(A, 'Devoted Druid'); await putP(A, 'Vizier of Remedies'); },
    () => doAll(() => act(A, 'Devoted Druid', 'Add \\{G\\}'), () => act(A, 'Devoted Druid', 'Untap')), 10, 1, 'G');
  await loop('M5 Bloom Tender + Freed from the Real', async () => { await putP(A, 'Bloom Tender'); const id = await putP(A, 'Freed from the Real'); await A.evaluate(id => { const a = S.bf.find(x => x.id === id), g = S.bf.find(x => cname(x) === 'Bloom Tender'); a.att = {pid:MYPID, id:g.id}; commit(); }, id); },
    () => doAll(() => act(A, 'Bloom Tender', 'Add'), () => act(A, 'Freed from the Real', 'Untap')), 8, 1, 'G');
  await loop("M6 Bloom Tender + Pemmin's Aura", async () => { await putP(A, 'Bloom Tender'); const id = await putP(A, "Pemmin's Aura"); await A.evaluate(id => { const a = S.bf.find(x => x.id === id), g = S.bf.find(x => cname(x) === 'Bloom Tender'); a.att = {pid:MYPID, id:g.id}; commit(); }, id); },
    () => doAll(() => act(A, 'Bloom Tender', 'Add'), () => act(A, "Pemmin's Aura", 'Untap')), 8, 1, 'G');
  await loop('M7 Isochron Scepter + Dramatic Reversal + Sol Ring + Gilded Lotus', async () => {
      await putP(A, 'Sol Ring'); await putP(A, 'Gilded Lotus'); await toZone(A, 'Dramatic Reversal', 'hand'); await toZone(A, 'Isochron Scepter', 'hand');
      await A.evaluate(() => { window.__pickRe = 'Dramatic Reversal'; window.__pick = 1; window.__want = 'Dramatic Reversal|imprint|yes'; }); await pool(A, {C:2});
      check(await castH(A, 'Isochron Scepter') === 'ok', 'cast Isochron Scepter'); await after();
      check(await A.evaluate(() => S.ex.some(x => cname(x) === 'Dramatic Reversal')), 'Dramatic Reversal is exiled (imprinted) by the Scepter');
      await A.evaluate(() => { window.__want = '^(yes|cast|copy)'; }); },
    () => doAll(() => act(A, 'Sol Ring', 'Add'), () => act(A, 'Gilded Lotus', 'Add'), () => act(A, 'Isochron Scepter', 'copy')), 6, 3);
};
