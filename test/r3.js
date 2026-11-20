const H = require('./h'); const {check, sleep, ev, st, give, put, setPool, bfId, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(250); } };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    const A = await H.player(browser, 'Georges', H.deckFor('Krenko, Mob Boss'), 'host', 'r3');
    const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r3');
    const C = await H.player(browser, 'Neil', H.deckFor('Kaalia of the Vast'), 'join', 'r3');
    const all = [A, B, C];
    check(await waitFor(A, () => OPP.size === 2) && await waitFor(C, () => OPP.size === 2), 'three players at the table');
    await A.click('[data-act="goFirst"]');
    await passAll([B, C]); await passAll([B, C]);
    check(await waitFor(A, () => phaseNow().ph === 3, null, 10000), 'main phase');
    for (const n of ['Grizzly Bears','Paladin en-Vec','Shivan Dragon']) await put(A, n);
    await A.evaluate(() => { const c = S.cz[0]; moveCard(c.id, 'bf', {quiet:true}); const k = S.bf.find(x => x.cmd); k.sk = false; const t = cards => 0; createToken('tok-goblin', 3); S.bf.forEach(c => c.sk = false); commit(); });
    for (const n of ['Llanowar Elves','Darksteel Myr']) await put(B, n);
    for (const n of ['Grizzly Bears','Young Wolf']) await put(C, n);
    await sleep(600);
    await A.click('#phasebar [data-act="next"]');
    check(await waitFor(A, () => phaseNow().ph === 4), 'combat: beginning of combat');
    await passAll([B, C]);
    await waitFor(A, () => S.pass === prioKey() || (S.cb && S.cb.step === 'atk'), null, 1000);
    if (!(await A.evaluate(() => S.cb.step === 'atk'))) await A.evaluate(() => nextAction());
    check(await waitFor(A, () => S.cb && S.cb.step === 'atk'), 'declare attackers panel');
    const ids = await A.evaluate(() => Object.fromEntries(S.bf.map(c => [c.tok ? 'Goblins' : cname(c), c.id])));
    const oppKey = await A.evaluate(() => Object.fromEntries(opponents().map(p => [p.nm, 'p:' + p.pid])));
    await A.evaluate(([ids, k]) => { UI.atkSel = {[ids['Shivan Dragon']]:k.Kim, [ids['Paladin en-Vec']]:k.Kim, [ids['Krenko, Mob Boss']]:k.Kim, [ids['Grizzly Bears']]:k.Neil, [ids['Goblins']]:k.Neil}; renderCombatPanel(); }, [ids, oppKey]);
    await A.click('#cbpanel [data-act="atkGo"]');
    check(await waitFor(A, () => S.bf.filter(c => c.atk).length === 5), 'five attackers (one is a stack of 3 goblins)');
    await passAll([B, C]);
    check(await waitFor(B, () => !!document.querySelector('#cbpanel [data-act="blkGo"]'), null, 8000), 'Kim gets the block panel');
    check(await waitFor(C, () => !!document.querySelector('#cbpanel [data-act="blkGo"]'), null, 8000), 'Neil gets the block panel at the same time');
    const flyBlock = await B.evaluate(() => { const e = S.bf.find(c => cname(c) === 'Llanowar Elves'); const a = attackersOnMe(phaseNow()).find(a => info(a.k).n === 'Shivan Dragon'); return canBlock(e, a, phaseNow().pid); });
    check(flyBlock === 'flying', 'Elves cannot block the flying Shivan Dragon');
    await B.evaluate(() => { const pn = phaseNow(); const atts = attackersOnMe(pn); const e = S.bf.find(c => cname(c) === 'Llanowar Elves'); UI.blkSel[e.id] = atts.find(a => info(a.k).n === 'Paladin en-Vec').id; renderCombatPanel(); });
    await B.click('#cbpanel [data-act="blkGo"]');
    await C.evaluate(() => { const pn = phaseNow(); const atts = attackersOnMe(pn); const b = S.bf.find(c => cname(c) === 'Grizzly Bears'); const w = S.bf.find(c => cname(c) === 'Young Wolf');
      UI.blkSel[b.id] = atts.find(a => info(a.k).n === 'Grizzly Bears').id; UI.blkSel[w.id] = atts.find(a => a.tok).id; renderCombatPanel(); });
    await C.click('#cbpanel [data-act="blkGo"]');
    check(await waitFor(A, () => S.cb.step === 'blkd' || S.cb.step === 'fs' || S.cb.step === 'dmg' || phaseNow().ph === 5, null, 8000), 'blocks are in');
    for (let i = 0; i < 6; i++){ await passAll([B, C]); if (await A.evaluate(() => phaseNow().ph === 5)) break; }
    check(await waitFor(A, () => phaseNow().ph === 5, null, 15000), 'combat finished, main phase 2');
    await sleep(1500); await passAll(all); await sleep(1000);
    const sb = await st(B), sc = await st(C), sa = await st(A);
    console.log('   Kim', sb.life, sb.gy, sb.bf, '| Neil', sc.life, sc.gy, sc.bf, '| me', sa.bf, sa.gy);
    check(sb.life === 32, `Kim took 5 (Shivan) + 3 (Krenko) = 8 → ${sb.life}`);
    check(await B.evaluate(() => Object.values(S.cdt)[0] === 3), 'Krenko dealt 3 commander damage to Kim');
    check(sb.gy.includes('Llanowar Elves') && !sa.gy.includes('Paladin en-Vec'), 'first strike: Paladin killed the Elves and took no damage');
    check(sc.life === 38, `Neil took 2 from the two unblocked goblins → ${sc.life}`);
    check(sc.gy.includes('Grizzly Bears') && sa.gy.includes('Grizzly Bears'), 'Bears traded');
    check(sc.bf.some(x => /Young Wolf\+1/.test(x)), 'Young Wolf died to a goblin and came back (undying)');
    check(sa.bf.some(x => /Goblinx2/.test(x)), 'one goblin token died, two remain');
    await A.screenshot({path:'shot-r3.png'});
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); H.aedes.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
