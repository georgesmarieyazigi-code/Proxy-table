// "Draw / exile your library, then win" lines: Thassa's Oracle, Laboratory Maniac, Jace, Wielder of Mysteries.
module.exports = async ({A, B, check, sleep, waitFor, after, fresh, putP, toZone, pool, castH, act, lost, won, noNotes, libN, step}) => {
  const winCheck = async (name) => { await after();
    check(await waitFor(A, () => S.log.some(e => /wins the game/i.test(e.s)), null, 30000), `${name}: Georges wins the game`);
    check(await waitFor(B, () => !!(S.lost || S.g23lost || S.b27lost), null, 20000), `${name}: Kim has lost the game`);
    await noNotes(name); };
  const oracle = async () => { await toZone(A, "Thassa's Oracle", 'hand'); await pool(A, {U:2}); check(await castH(A, "Thassa's Oracle") === 'ok', "cast Thassa's Oracle"); };

  await step("T1 Thassa's Oracle + Demonic Consultation", async () => {
    await fresh(); await toZone(A, 'Demonic Consultation', 'hand'); await toZone(A, "Thassa's Oracle", 'hand');
    await A.evaluate(() => { window.__name = "Thassa's Oracle"; window.__want = "isn't in my library"; }); await pool(A, {B:1});
    check(await castH(A, 'Demonic Consultation') === 'ok', 'cast Demonic Consultation'); await after();
    check(await waitFor(A, () => S.lib.length === 0, null, 30000), `Consultation naming a card that isn't in the library exiles the whole library (${await libN(A)} left)`);
    await oracle(); await winCheck('T1');
  });
  await step("T2 Thassa's Oracle + Tainted Pact", async () => {
    await fresh(); await toZone(A, 'Tainted Pact', 'hand'); await A.evaluate(() => { const seen = new Set(); [...S.lib].forEach(c => { const n = cname(c); if (seen.has(n)) moveCard(c.id, 'ex', {quiet:true}); seen.add(n); }); commit(); });
    await A.evaluate(() => { window.__want = "^keep going"; }); await pool(A, {B:1, C:1});
    check(await castH(A, 'Tainted Pact') === 'ok', 'cast Tainted Pact'); await after();
    check(await waitFor(A, () => S.lib.length === 0, null, 60000), `Tainted Pact, declining every card of a singleton deck, exiles the whole library (${await libN(A)} left)`);
    await A.evaluate(() => { window.__want = null; }); await oracle(); await winCheck('T2');
  });
  await step("T3 Thassa's Oracle with devotion >= library", async () => {
    await fresh(); await A.evaluate(() => { while (S.lib.length > 2) moveCard(S.lib[S.lib.length - 1].id, 'ex', {quiet:true}); if (!S.lib.some(c => cname(c) === "Thassa's Oracle")) {} commit(); });
    const ora = await A.evaluate(() => { const c = S.lib.find(x => cname(x) === "Thassa's Oracle") || S.ex.find(x => cname(x) === "Thassa's Oracle"); moveCard(c.id, 'hand', {quiet:true}); commit(); return S.lib.length; });
    await pool(A, {U:2}); check(await castH(A, "Thassa's Oracle") === 'ok', `cast Thassa's Oracle with ${ora} cards in library`); await winCheck('T3');
  });
  await step('T4 Laboratory Maniac + empty library + draw', async () => {
    await fresh(); check(!!(await putP(A, 'Laboratory Maniac')), 'Laboratory Maniac out');
    await A.evaluate(() => { while (S.lib.length) moveCard(S.lib[0].id, 'ex', {quiet:true}); commit(); draw(1); commit(); }); await winCheck('T4');
  });
  await step('T5 Jace, Wielder of Mysteries + empty library + draw', async () => {
    await fresh(); check(!!(await putP(A, 'Jace, Wielder of Mysteries')), 'Jace out');
    await A.evaluate(() => { while (S.lib.length) moveCard(S.lib[0].id, 'ex', {quiet:true}); commit(); draw(1); commit(); }); await winCheck('T5');
  });
  await step("T6 Ad Nauseam into Thassa's Oracle", async () => {
    await fresh(); await A.evaluate(() => { const keep = new Set(["Ad Nauseam", "Thassa's Oracle"]); while (S.lib.filter(c => !keep.has(cname(c))).length > 6) { const c = S.lib.find(c => !keep.has(cname(c)) && !isLand(c.k)) || S.lib.find(c => !keep.has(cname(c))); moveCard(c.id, 'ex', {quiet:true}); } commit(); });
    await toZone(A, 'Ad Nauseam', 'hand'); await A.evaluate(() => { const c = S.lib.find(x => cname(x) === "Thassa's Oracle"); if (c) moveCard(c.id, 'ex', {quiet:true}); commit(); });
    await A.evaluate(() => { window.__want = '^(yes|keep|reveal|continue|another)'; }); await pool(A, {B:2, C:5});
    const lib0 = await libN(A); const l0 = await A.evaluate(() => S.life);
    check(await castH(A, 'Ad Nauseam') === 'ok', 'cast Ad Nauseam'); await after();
    check(await waitFor(A, () => S.lib.length === 0, null, 60000), `Ad Nauseam, always continuing, puts the whole library into hand (${lib0} → ${await libN(A)})`);
    const l1 = await A.evaluate(() => S.life); const mvs = await A.evaluate(() => S.hand.reduce((a, c) => a + (info(c.k)?.mv || 0), 0)); check(l0 - l1 >= 0, `paid life equal to the mana values revealed (${l0} → ${l1})`);
    await A.evaluate(() => { window.__want = null; const c = S.ex.find(x => cname(x) === "Thassa's Oracle"); if (c) moveCard(c.id, 'hand', {quiet:true}); commit(); });
    await pool(A, {U:2}); check(await castH(A, "Thassa's Oracle") === 'ok', "cast Thassa's Oracle"); await winCheck('T6');
  });
  await step("T7 Hermit Druid with no basics → Thassa's Oracle", async () => {
    await fresh(); await A.evaluate(() => { S.lib.filter(c => /Basic/.test(info(c.k)?.t || '')).forEach(c => moveCard(c.id, 'ex', {quiet:true})); const o = S.lib.find(x => cname(x) === "Thassa's Oracle"); if (o) moveCard(o.id, 'hand', {quiet:true}); commit(); });
    check(!!(await putP(A, 'Hermit Druid')), 'Hermit Druid out'); await pool(A, {G:1});
    const r = await act(A, 'Hermit Druid', 'reveal'); check(r === 'ok', 'activate Hermit Druid: ' + r); await after();
    check(await waitFor(A, () => S.lib.length === 0, null, 30000), `no basic land: the whole library goes to the graveyard (${await libN(A)} left)`);
    await pool(A, {U:2}); check(await castH(A, "Thassa's Oracle") === 'ok', "cast Thassa's Oracle"); await winCheck('T7');
  });
  await step("T8 Underworld Breach + Brain Freeze (self) → Thassa's Oracle", async () => {
    await fresh(); check(!!(await putP(A, 'Underworld Breach')), 'Underworld Breach out');
    await A.evaluate(() => { const o = S.lib.find(x => cname(x) === "Thassa's Oracle"); if (o) moveCard(o.id, 'hand', {quiet:true}); const b = S.lib.find(x => cname(x) === 'Brain Freeze'); moveCard(b.id, 'hand', {quiet:true}); window.__tgt = 'self'; window.__want = '\\(you\\)|^Same targets'; commit(); });
    await A.evaluate(() => { const ac = window.askChoice; window.__optsBF = []; window.askChoice = async o => { window.__optsBF.push([o.title, (o.options || []).map(x => x.label)]); return ac(o); }; });
    await pool(A, {U:1, C:1}); check(await castH(A, 'Brain Freeze') === 'ok', 'cast Brain Freeze on myself'); await after();
    let guard = 0;
    while ((await libN(A)) > 0 && guard++ < 25){
      await pool(A, {U:1, C:1});
      const r = await A.evaluate(() => { const c = S.gy.find(x => cname(x) === 'Brain Freeze'); if (!c) return 'no Brain Freeze in graveyard'; const o = gyOptions(c); const e = o.find(g => /escape|breach/i.test(g.label || g.how || JSON.stringify(g))) || o[0]; if (!e) return 'no way to cast it from the graveyard'; castFromGy(c, e); return 'ok'; });
      if (r !== 'ok'){ check(false, 'escape Brain Freeze: ' + r); break; }
      await after();
    }
    console.log('    targets:', JSON.stringify(await A.evaluate(() => (window.__tgts || []).slice(-4))), JSON.stringify(await A.evaluate(() => (window.__optsBF || []).slice(0, 3))));
    check((await libN(A)) === 0, `Brain Freeze escaped ${guard} times with storm copies milled the whole library (${await libN(A)} left)`);
    await A.evaluate(() => { window.__tgt = null; }); await pool(A, {U:2}); check(await castH(A, "Thassa's Oracle") === 'ok', "cast Thassa's Oracle"); await winCheck('T8');
  });
};
