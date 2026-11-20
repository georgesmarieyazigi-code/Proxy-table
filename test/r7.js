const H = require('./h'); const {check, sleep, ev, st, give, put, setPool, bfId, handId, menuClick, choose, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const settle = async (A, ps) => { for (let i = 0; i < 25; i++){ await passAll(ps); if (!(await A.evaluate(() => stackAll().length || UI.resolving))) return; await sleep(150); } };
const toTop = (p, names) => p.evaluate(ns => { const got = ns.map(n => { for (const z of ['lib','hand','gy','bf']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const c = S[z].splice(i, 1)[0]; reset(c); return c; } } }); S.lib.unshift(...got); commit(); }, names);
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    const A = await H.player(browser, 'Georges', H.deckFor('Krenko, Mob Boss'), 'host', 'r7');
    const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r7');
    await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
    await settle(A, [B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);

    console.log('— Deck checker from the lobby');
    { const ctx = await browser.newContext({viewport:{width:1300, height:900}}); const L = await ctx.newPage();
      L.on('pageerror', e => check(false, 'lobby page error: ' + e.message));
      await H.route(L); await L.goto(H.FILE); await L.fill('#deckIn', H.deckFor('Krenko, Mob Boss')); await L.click('#loadBtn');
      await L.waitForFunction(() => /Deck ready/.test(document.querySelector('#deckStatus').textContent), null, {timeout:10000});
      await L.click('#lobbyNav [data-page="check"]'); await L.click('[data-act="checkDeck"]');
      check(await waitFor(L, () => UI.modal && UI.modal.finished, null, 60000), 'checker runs from the lobby');
      check(await L.evaluate(() => S === null && /Odd Sorcery/.test(UI.modal.report)), 'lobby check leaves no game behind and flags Odd Sorcery');
      await L.screenshot({path:'shot-lobbycheck.png'}); await ctx.close(); }
    console.log('— Strict rules');
    let h0 = (await st(A)).hand.length;
    await A.keyboard.press('d'); await sleep(200);
    check((await st(A)).hand.length === h0, 'pressing D does not draw');
    await A.click('#libPile, [data-act="libMenu"]').catch(() => {});
    const blocked = await A.evaluate(() => { const before = S.hand.length; ACT.draw(); return S.hand.length === before; });
    check(blocked, 'library menu “Draw” is blocked');
    let id = await A.evaluate(() => S.hand[0].id);
    const mvBlocked = await A.evaluate(id => { ACT.mv({dataset:{id, to:'gy'}}); return S.hand.some(c => c.id === id); }, id);
    check(mvBlocked, 'moving a hand card to the graveyard is blocked');
    await A.evaluate(() => ACT.fixStart());
    await A.evaluate(() => ACT.draw());
    check((await st(A)).hand.length === h0 + 1, 'Fix by hand unlocks it');
    check(await waitFor(B, () => [...OPP.values()].some(s => (s.log || []).some(e => /fixed by hand: drawing a card/.test(e.s)))) || await A.evaluate(() => S.log.some(e => /fixed by hand: drawing/.test(e.s))), 'the fix is logged for the table');
    await A.evaluate(() => ACT.fixStop());

    console.log('— Narset (on Kim’s side) limits my draws');
    await put(B, 'Narset, Parter of Veils');
    await waitFor(A, () => [...OPP.values()].some(s => (s.bf || []).some(b => /Narset/.test(info(b.k)?.n || ''))));
    h0 = (await st(A)).hand.length;
    const got = await A.evaluate(() => { S.drawn = 0; S.drawnT = turnStr(); draw(2); return S.drawn; });
    check((await st(A)).hand.length === h0 + 1, `draw 2 with Narset out draws only 1 (drew ${got})`);
    check(await A.evaluate(() => !drawAllowed().ok && /Narset/.test(drawAllowed().why)), 'a further draw is refused, naming Narset');
    check(await B.evaluate(() => drawAllowed().ok), 'Kim (Narset’s controller) is not limited');

    console.log('— Narset −2: look at four, take a noncreature nonland, rest on the bottom');
    await put(A, 'Narset, Parter of Veils');
    await toTop(A, ['Lightning Bolt', 'Mountain', 'Grizzly Bears', 'Divination']);
    id = await bfId(A, 'Narset, Parter of Veils');
    await A.dblclick(`.card[data-id="${id}"]`); await A.waitForSelector('#modal [data-act="pwGo"]');
    await A.click('#modal [data-act="pwGo"][data-i="0"]');
    await passAll([B]);
    check(await waitFor(A, () => UI.modal && UI.modal.type === 'pick'), 'pick dialog opens');
    const pk = await A.evaluate(() => ({c:UI.modal.cards.map(cname), x:(UI.modal.extra || []).map(cname), hint:UI.modal.hint}));
    check(pk.c.join() === 'Lightning Bolt,Divination' && pk.x.join() === 'Mountain,Grizzly Bears', `only Bolt and Divination can be taken (${pk.c} | greyed ${pk.x})`);
    await A.screenshot({path:'shot-dig.png'});
    await A.click('#modal [data-act="pickT"]'); await A.click('#modal [data-act="pickDone"]');
    check(await waitFor(A, () => UI.modal && UI.modal.type === 'pick' && /bottom/.test(UI.modal.title)), 'then asks the order for the bottom (no other choice)');
    for (let i = 0; i < 3; i++){ await A.click(`#modal [data-act="pickT"]:not(.chosen) >> nth=0`); await sleep(100); } await A.screenshot({path:'shot-order.png'}); await A.click('#modal [data-act="pickDone"]');
    await settle(A, [B]);
    const lib = await A.evaluate(() => ({top:S.lib.slice(0, 3).map(cname), bot:S.lib.slice(-3).map(cname), hand:S.hand.map(cname)}));
    check(lib.hand.includes('Lightning Bolt') && lib.bot.join() === 'Mountain,Grizzly Bears,Divination' && !lib.top.includes('Mountain'), `Bolt to hand, rest on the bottom: ${lib.bot}`);

    console.log('— Elminster’s scry discount');
    await A.evaluate(() => { S.bf.filter(c => /Narset/.test(cname(c))).forEach(c => moveCard(c.id, 'gy', {quiet:true})); commit(); });
    await put(A, 'Elminster'); id = await bfId(A, 'Elminster');
    await A.dblclick(`.card[data-id="${id}"]`); await A.waitForSelector('#modal [data-act="pwGo"]');
    await A.click('#modal [data-act="pwGo"][data-i="0"]');
    await settle(A, [B]);
    await waitFor(A, () => UI.modal && UI.modal.type === 'zone'); await A.keyboard.press('Escape');
    await settle(A, [B]);
    check(await waitFor(A, () => (S.nextRed || []).some(r => r.n === 2)), 'scry 2 → next instant/sorcery costs {2} less');
    await give(A, 'Divination');
    const cost = await A.evaluate(() => { const c = S.hand.find(c => cname(c) === 'Divination'); const sc = spellCost(c, 'hand'); return [costStr(sc.cost), sc.notes.join()]; });
    check(cost[0] === '{U}', `Divination now costs ${cost[0]} (${cost[1]})`);
    await setPool(A, {U:1}); id = await handId(A, 'Divination'); await menuClick(A, id, /^Cast/); await settle(A, [B]);
    check(await A.evaluate(() => !(S.nextRed || []).length), 'discount used up after casting');

    console.log('— Rule of Law and “can’t gain life” on Kim’s side');
    await put(B, 'Rule of Law'); await put(B, 'Test Erebos'); await sleep(800);
    await give(A, 'Lightning Bolt'); await setPool(A, {R:1});
    const rol = await A.evaluate(() => castCheck(S.hand.find(c => cname(c) === 'Lightning Bolt'), 'hand'));
    check(!rol.ok && /Rule of Law/.test(rol.why), 'second spell this turn blocked: ' + rol.why);
    const life = (await st(A)).life;
    await A.evaluate(() => runEffects('You gain 3 life.', {name:'Test', full:'You gain 3 life.'}));
    check((await st(A)).life === life, 'gain 3 life does nothing with Test Erebos out');

    console.log('— Deck checker');
    const snap0 = await A.evaluate(() => JSON.stringify([S.lib.map(c => c.id), S.hand.map(c => c.id), S.bf.map(c => c.id), S.life, S.gy.length, S.stk.length]));
    await A.evaluate(() => runDeckCheck(S.deck));
    check(await waitFor(A, () => UI.modal && UI.modal.finished, null, 60000), 'checker finished');
    const rep = await A.evaluate(() => UI.modal.report);
    console.log(rep.split('\n').map(l => '    | ' + l).join('\n'));
    check(/Odd Sorcery/.test(rep), 'flags Odd Sorcery');
    check(!/^Narset|^Elminster|^Tifa|^Lightning Bolt|^Counterspell/m.test(rep), 'Narset, Elminster, Tifa, Bolt, Counterspell fully understood');
    await sleep(2000); check(await A.evaluate(s0 => JSON.stringify([S.lib.map(c => c.id), S.hand.map(c => c.id), S.bf.map(c => c.id), S.life, S.gy.length, S.stk.length]) === s0, snap0), 'real game state untouched by the dry run');
    await A.screenshot({path:'shot-check.png'});
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); H.aedes.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
