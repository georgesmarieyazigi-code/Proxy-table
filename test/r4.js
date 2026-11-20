const H = require('./h'); const {check, sleep, ev, st, give, put, setPool, bfId, handId, menuClick, choose, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const settle = async (A, ps) => { for (let i = 0; i < 25; i++){ await passAll(ps); if (!(await A.evaluate(() => stackAll().length || UI.resolving))) return; await sleep(150); } };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    const A = await H.player(browser, 'Georges', H.deckFor('Krenko, Mob Boss'), 'host', 'r4');
    const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r4');
    await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
    await settle(A, [B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);

    console.log('— Planeswalker');
    await give(A, 'Test Walker'); await setPool(A, {R:4});
    let id = await handId(A, 'Test Walker'); await H.menuClick(A, id, /^Cast/); await settle(A, [B]);
    check(await waitFor(A, () => S.bf.some(c => cname(c) === 'Test Walker' && c.co === 4 && c.pw)), 'enters with 4 loyalty');
    id = await bfId(A, 'Test Walker'); await A.dblclick(`.card[data-id="${id}"]`);
    check(await waitFor(A, () => UI.modal && UI.modal.type === 'pw'), 'double-click opens the loyalty abilities');
    const dis = await A.evaluate(() => [...document.querySelectorAll('#modal [data-act="pwGo"]')].map(b => b.disabled));
    check(dis[0] === false && dis[1] === false && dis[2] === true, '−7 greyed out with 4 loyalty');
    await A.click('#modal [data-act="pwGo"][data-i="1"]');
    await A.waitForSelector('#modal [data-act="tgtT"]'); 
    for (const b of await A.$$('#modal [data-act="tgtT"]')) if (/Target Kim/.test(await b.innerText())){ await b.click(); break; }
    await A.click('#modal [data-act="tgtDone"]');
    const lifeB = (await st(B)).life; await settle(A, [B]);
    check(await waitFor(B, l => S.life === l - 3, lifeB), '−2: 3 damage to Kim through the stack');
    check(await A.evaluate(() => S.bf.find(c => cname(c) === 'Test Walker').co === 2), 'loyalty now 2');
    await A.dblclick(`.card[data-id="${id}"]`); await A.waitForSelector('#modal [data-act="pwGo"]');
    check(await A.evaluate(() => [...document.querySelectorAll('#modal [data-act="pwGo"]')].every(b => b.disabled)), 'only one loyalty ability per turn');
    await A.keyboard.press('Escape');

    console.log('— Doublers');
    await put(A, 'Hardened Scales'); await put(A, 'Doubling Season'); await put(A, 'Grizzly Bears');
    await give(A, 'Battlegrowth'); await setPool(A, {G:1});
    id = await handId(A, 'Battlegrowth'); await H.menuClick(A, id, /^Cast/);
    await A.waitForSelector('#modal [data-act="tgtT"]'); for (const b of await A.$$('#modal [data-act="tgtT"]')) if (/Grizzly/.test(await b.innerText())){ await b.click(); break; } await A.click('#modal [data-act="tgtDone"]');
    await settle(A, [B]);
    check(await waitFor(A, () => S.bf.find(c => cname(c) === 'Grizzly Bears').cp === 4), 'Hardened Scales then Doubling Season: 1 → (1+1)×2 = 4 counters');
    await put(A, 'Parallel Lives');
    await A.evaluate(() => { S.bf.filter(c => c.tok).forEach(c => S.bf.splice(S.bf.indexOf(c), 1)); commit(); });
    await give(A, 'History of Benalia'); await setPool(A, {W:3});
    id = await handId(A, 'History of Benalia'); await H.menuClick(A, id, /^Cast/); await settle(A, [B]);
    check(await waitFor(A, () => S.bf.find(c => cname(c) === 'History of Benalia')?.lore === 2), 'Doubling Season doubles the saga lore counter (enters with 2)');
    check(await waitFor(A, () => S.bf.filter(c => c.tok).reduce((a, c) => a + (c.n || 1), 0) === 8), 'chapters I and II each make 1 Knight ×4 (Doubling Season and Parallel Lives) = 8');
    const walkerLoyalty = await A.evaluate(() => { S.bf.splice(S.bf.findIndex(c => cname(c) === 'Test Walker'), 1); const c = S.hand.find(c => cname(c) === 'Test Walker') || S.lib.find(c => cname(c) === 'Test Walker'); return 0; });

    console.log('— Vorinclex halving an opponent\'s counters');
    await put(B, 'Vorinclex, Monstrous Raider'); await put(B, 'Grizzly Bears');
    await waitFor(A, () => [...OPP.values()][0].bf.some(b => info(b.k)?.n === 'Vorinclex, Monstrous Raider'));
    const half = await A.evaluate(() => { const c = {k:S.bf.find(c => cname(c) === 'Grizzly Bears').k, cp:0}; const n = modCounters(c, 'cp', 3, MYPID, [...OPP.keys()][0]); return n; });
    check(half === 1, `I put 3 counters with Kim's Vorinclex out: halved to ${half}`);

    console.log('— Proliferate');
    await B.evaluate(() => { S.psn = 2; S.bf.find(c => cname(c) === 'Grizzly Bears').cm = 1; commit(); });
    await sleep(500);
    await give(A, 'Contentious Plan'); await setPool(A, {U:2});
    id = await handId(A, 'Contentious Plan'); await H.menuClick(A, id, /^Cast/);
    await waitFor(B, () => stackAll().length === 1); await passAll([B]);
    // proliferate is automatic now: it picks the helpful choices by itself (my counters, Kim's −1/−1 and poison) with no dialog
    await settle(A, [B]);
    check(!(await A.evaluate(() => UI.modal && UI.modal.type === 'prolif')), 'proliferate needs no dialog');
    check(await waitFor(A, () => S.bf.find(c => cname(c) === 'Grizzly Bears').cp === 6), 'my Bears 4 → 6 (+1 doubled by Doubling Season)');
    check(await waitFor(B, () => S.psn === 2 && S.bf.find(c => cname(c) === 'Grizzly Bears').cm === 1), "Kim's counters: my proliferate is halved by Vorinclex (1 → 0)");

    console.log('— Battle');
    await give(A, 'Invasion of Test'); await setPool(A, {G:3});
    const lifeA = (await st(A)).life;
    id = await handId(A, 'Invasion of Test'); await H.menuClick(A, id, /^Cast/); await settle(A, [B]);
    await sleep(800); console.log('   battle:', await A.evaluate(() => JSON.stringify(S.bf.filter(c => /Invasion/.test(cname(c))).map(c => ({bt:c.bt, co:c.co, prot:c.prot, fl:c.fl}))))); check(await waitFor(A, () => { const c = S.bf.find(c => /Invasion/.test(cname(c))); return c && c.bt && c.co === 4 && !!c.prot; }), 'battle: 4 defense, doubled by Doubling Season then halved by Kim\'s Vorinclex = 4, protected by Kim');
    check(await waitFor(A, l => S.life === l + 3, lifeA), 'its enter trigger gained 3 life');
    check(await A.evaluate(() => defOpts().some(o => /battle/.test(o.label))), 'I can attack my own battle');
    await A.evaluate(() => { const c = S.bf.find(c => /Invasion/.test(cname(c))); damageCard(c, 8, {}); commit(); });
    check(await choose(A, /Cast it/), 'defeated: offered to cast the back face');
    await settle(A, [B]);
    check(await waitFor(A, () => S.bf.some(c => /Invasion/.test(cname(c)) && c.fl)), 'Test Reborn is on the battlefield transformed');

    console.log('— Commander zone, hand size, undo');
    await A.evaluate(() => { const c = S.cz[0]; moveCard(c.id, 'bf', {quiet:true, manual:true}); });
    await give(A, 'Murder'); await setPool(A, {B:3});
    id = await handId(A, 'Murder'); await H.menuClick(A, id, /^Cast/);
    await A.waitForSelector('#modal [data-act="tgtT"]'); for (const b of await A.$$('#modal [data-act="tgtT"]')) if (/Krenko/.test(await b.innerText())){ await b.click(); break; } await A.click('#modal [data-act="tgtDone"]');
    await settle(A, [B]);
    check(await waitFor(A, () => S.cz.some(c => c.cmd) && !S.gy.some(c => c.cmd)), 'setting on: destroyed commander goes to the command zone');
    const before = await A.evaluate(() => { S.landT = ['', 0]; const m = S.lib.find(c => cname(c) === 'Mountain'); S.lib.splice(S.lib.indexOf(m), 1); S.hand.push(m); commit(); return m.id; });
    await H.menuClick(A, before, /^Play land/); const mId = before;
    await A.dblclick(`.card[data-id="${mId}"]`);
    check((await st(A)).pool.R === 1, 'tapped Mountain for {R}');
    await A.click('[data-act="undo"]');
    const u = await st(A);
    check(u.pool.R === 0 && u.bf.includes('Mountain'), 'Undo untaps it and removes the mana');
    await A.click('[data-act="undo"]');
    check((await st(A)).hand.includes('Mountain'), 'Undo again takes the land back to hand');
    await A.click('#phasebar [data-act="draw"]').catch(() => {}); await A.keyboard.press('d');
    check(await A.evaluate(() => UI.undo.length === 0), 'drawing a card clears the undo history');
    await A.evaluate(() => { while (S.hand.length < 10) S.hand.push(S.lib.shift()); commit(); });
    await A.evaluate(() => endTurnFlow()); await settle(A, [B]);
    await A.evaluate(() => { if (phaseNow().ph === 6 && !myBox()) nextAction(); }); await passAll([B]);
    check(await waitFor(A, () => UI.modal && UI.modal.type === 'pick' && /maximum hand size/.test(UI.modal.title), null, 10000), 'cleanup asks to discard down to 7');
    await A.evaluate(() => { const m = UI.modal; m.sel = S.hand.slice(0, m.min).map(c => c.id); renderModal(); }); await A.click('#modal [data-act="pickDone"]');
    check(await waitFor(B, () => phaseNow().mine, null, 8000), "then the turn passes to Kim");
    check((await st(A)).hand.length === 7, 'hand is 7');
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); H.aedes.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
