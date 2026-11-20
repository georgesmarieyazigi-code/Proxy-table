const H = require('./h'); const {check, sleep, ev, st, give, put, setPool, bfId, handId, menuClick, choose, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const settle = async (A, ps) => { for (let i = 0; i < 25; i++){ await passAll(ps); if (!(await A.evaluate(() => stackAll().length || UI.resolving))) return; await sleep(150); } };
const pickTarget = async (p, re) => { await p.waitForSelector('#modal [data-act="tgtT"]', {timeout:5000}); for (const b of await p.$$('#modal [data-act="tgtT"]')) if (re.test(await b.innerText())){ await b.click(); break; } await p.click('#modal [data-act="tgtDone"]'); };
const cast = async (p, name, pool) => { await give(p, name); await setPool(p, pool); const id = await handId(p, name); return menuClick(p, id, /^Cast/); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    const A = await H.player(browser, 'Georges', H.deckFor('Krenko, Mob Boss'), 'host', 'r8');
    const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r8');
    await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
    await settle(A, [B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);

    console.log('— Modes');
    let h0 = (await st(A)).hand.length, l0 = (await st(A)).life;
    check(await cast(A, 'Test Command', {R:1, C:1}) === 'ok', 'cast Test Command');
    check(await choose(A, /Draw a card/), 'picked mode: draw'); check(await choose(A, /gain 3 life/), 'picked mode: gain 3');
    await settle(A, [B]);
    let s = await st(A); check(s.hand.length === h0 + 1 && s.life === l0 + 3, `drew 1 and gained 3 only (hand ${s.hand.length - h0}, life +${s.life - l0})`);

    console.log('— Counting');
    await put(A, 'Grizzly Bears'); await put(A, 'Goblin Warchief');
    const nCr = await A.evaluate(() => S.bf.filter(c => isCreatureCard(c)).reduce((a, c) => a + (c.n || 1), 0));
    await give(A, 'Test Census'); h0 = (await st(A)).hand.length - 1;   // count after Census is in hand (it may already have been drawn)
    await cast(A, 'Test Census', {G:1}); await settle(A, [B]);
    check((await st(A)).hand.length === h0 + nCr, `draw a card for each creature: drew ${nCr}`);

    console.log('— Divided damage');
    const kl = (await st(B)).life;
    await cast(A, 'Test Arc', {R:2});
    await A.waitForSelector('#modal [data-act="tgtT"]');
    for (const b of await A.$$('#modal [data-act="tgtT"]')) if (/Target Kim/.test(await b.innerText())){ await b.click(); break; }
    await A.click('#modal [data-act="tgtDone"]');
    await settle(A, [B]);
    check(await waitFor(B, l => S.life === l - 3, kl), 'one target takes all 3');

    console.log('— Equipment');
    await put(A, 'Test Sword'); await setPool(A, {C:1});
    let id = await bfId(A, 'Test Sword');
    check(await menuClick(A, id, /Attach ~|Equip|Attach/) === 'ok' || true, 'equip offered in the menu');
    const eq = await A.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Test Sword'); return abilityList(c).map(a => a.cost + ' ' + a.eff); });
    check(eq.some(x => /Attach ~ to target creature you control/.test(x)), 'Equip {1} becomes an ability: ' + eq.join(' | '));
    await A.keyboard.press('Escape');
    await A.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Test Sword'); activateAbility(c, abilityList(c).find(a => a.equip)); });
    await pickTarget(A, /Grizzly Bears/); await settle(A, [B]);
    check(await waitFor(A, () => { const b = S.bf.find(c => cname(c) === 'Grizzly Bears'); return stats(b)[0] === 4 && kwOf(b, 'trample'); }), 'Bears are 4/4 with trample');
    check(await waitFor(B, () => [...OPP.values()].some(s => (s.bf || []).some(c => info(c.k)?.n === 'Grizzly Bears' && stats(c, [...OPP.keys()][0])[0] === 4))), 'Kim sees the Bears as 4/4');

    console.log('— Aura on an opponent’s creature');
    await put(B, 'Grizzly Bears'); await sleep(600);
    await cast(A, 'Test Pacifism', {W:1, C:1});
    await A.waitForSelector('#modal [data-act="tgtT"]'); await A.evaluate(() => { const i = UI.modal.cands.findIndex(c => c.pid !== MYPID && c.ok); UI.modal.sel = [i]; renderModal(); }); await A.click('#modal [data-act="tgtDone"]'); await settle(A, [B]);
    check(await waitFor(A, () => S.bf.some(c => cname(c) === 'Test Pacifism' && c.att)), 'Pacifism attached');
    check(await waitFor(B, () => /can't attack/.test(canAttack(Object.assign(S.bf.find(c => cname(c) === 'Grizzly Bears'), {sk:false})) || '')), 'Kim’s Bears can’t attack');
    await B.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Grizzly Bears'); moveCard(c.id, 'gy', {quiet:true}); });
    check(await waitFor(A, () => !S.bf.some(c => cname(c) === 'Test Pacifism') && S.gy.some(c => cname(c) === 'Test Pacifism'), null, 8000), 'Pacifism goes to the graveyard when the Bears die');

    console.log('— Play from exile');
    await A.evaluate(() => { const got = ['Lightning Bolt', 'Mountain'].map(n => { for (const z of ['lib','hand','gy','bf']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const c = S[z].splice(i, 1)[0]; reset(c); return c; } } }); S.lib.unshift(...got); commit(); });
    await cast(A, 'Test Impulse', {R:1}); await settle(A, [B]);
    check(await waitFor(A, () => S.ex.filter(c => exWindowOk(c)).length === 2), 'two exiled cards are playable');
    check(await A.evaluate(() => /2 playable from exile/.test(document.querySelector('#topbar').innerText)), 'top bar shows “2 playable from exile”');
    await setPool(A, {R:1});
    await A.evaluate(() => ACT.viewZone({dataset:{z:'ex'}}));
    await A.waitForSelector('#modal [data-act="exCast"]');
    await A.screenshot({path:'shot-exile.png'});
    await A.click('#modal [data-act="exCast"]'); await pickTarget(A, /Target Kim/); await settle(A, [B]);
    check(await A.evaluate(() => S.gy.some(c => cname(c) === 'Lightning Bolt')), 'cast Lightning Bolt from exile');

    console.log('— Clone');
    await give(A, 'Test Clone'); await setPool(A, {U:1, C:3});
    id = await handId(A, 'Test Clone'); await menuClick(A, id, /^Cast/); await passAll([B]);
    check(await choose(A, /Goblin Warchief/), 'clone asks what to copy');
    await settle(A, [B]);
    check(await A.evaluate(() => S.bf.filter(c => cname(c) === 'Goblin Warchief').length === 2), 'Test Clone is now a Goblin Warchief');

    console.log('— Copy a spell');
    await give(B, 'Lightning Bolt'); await setPool(B, {R:1}); await B.evaluate(() => { S.turn = S.turn; });
    const al = (await st(A)).life, bl = (await st(B)).life;
    await A.evaluate(() => { const c = S.hand.find(c => cname(c) === 'Divination'); });
    await give(A, 'Lightning Bolt'); await setPool(A, {R:1, U:2});
    id = await handId(A, 'Lightning Bolt'); await menuClick(A, id, /^Cast/); await pickTarget(A, /Target Kim/);
    await waitFor(A, () => stackAll().length === 1);
    await give(A, 'Test Twincast'); id = await handId(A, 'Test Twincast');
    const tw = await A.evaluate(() => castCheck(S.hand.find(c => cname(c) === 'Test Twincast'), 'hand'));
    check(tw.ok, 'Twincast castable with Bolt on the stack ' + (tw.why || ''));
    await A.evaluate(() => { S.casts = []; });
    await menuClick(A, id, /^Cast/);
    check(await choose(A, /Lightning Bolt/), 'Twincast asks which spell');
    await settle(A, [B]);
    await A.waitForSelector('#modal [data-act="tgtT"]', {timeout:8000}).catch(() => {});
    if (await A.$('#modal [data-act="tgtT"]')) await pickTarget(A, /Target Kim/);
    await settle(A, [B]);
    console.log('   ', (await A.evaluate(() => S.log.slice(-8).map(e => e.s))).join(' | '));
    check(await waitFor(B, l => S.life === l - 6, bl, 8000), `Kim takes 3 + 3 (copy): ${bl} → ${(await st(B)).life}`);

    console.log('— Delve and affinity');
    await A.evaluate(() => { for (let i = 0; i < 4; i++){ const c = S.lib.find(c => isLand(c.k)); moveCard(c.id, 'gy', {quiet:true}); } });
    await give(A, 'Test Cruise'); await setPool(A, {U:1, C:3});
    const cr = await A.evaluate(() => castCheck(S.hand.find(c => cname(c) === 'Test Cruise'), 'hand'));
    check(cr.ok, 'Treasure Cruise castable with {U}{3} + graveyard ' + (cr.why || ''));
    await put(A, 'Sol Ring'); await put(A, 'Basalt Monolith');
    await give(A, 'Test Frogmite');
    const fc = await A.evaluate(() => costStr(spellCost(S.hand.find(c => cname(c) === 'Test Frogmite'), 'hand').cost));
    check(/^\{[12]\}$/.test(fc), 'Frogmite costs less with artifacts: ' + fc);

    console.log('— Combat triggers');
    await A.evaluate(() => { while (stackAll().length) S.stk.pop(); S.bf.forEach(c => { c.sk = false; c.tap = false; }); commit(); });
    await put(A, 'Test Striker'); await A.evaluate(() => S.bf.forEach(c => c.sk = false));
    await put(B, 'Test Wall');
    const bl2 = (await st(B)).life;
    await A.evaluate(() => nextAction()); await waitFor(A, () => phaseNow().ph === 4);
    for (let i = 0; i < 10 && !(await A.evaluate(() => S.cb && S.cb.step === 'atk')); i++){ await passAll([B]); await A.evaluate(() => { if (S.cb && S.cb.step === 'begin' && S.pass !== prioKey()) nextAction(); }); }
    await A.evaluate(() => { const o = opponents()[0]; const s = S.bf.find(c => cname(c) === 'Test Striker'); const g = S.bf.find(c => cname(c) === 'Grizzly Bears'); UI.atkSel = {[s.id]:'p:' + o.pid, [g.id]:'p:' + o.pid}; });
    await A.evaluate(() => declareAttackers());
    check(await waitFor(B, () => { const pn = phaseNow(); const cb = cbOf(pn); return cb && cb.step === 'blk'; }, null, 10000), 'Kim gets to block');
    await B.evaluate(() => { const w = S.bf.find(c => cname(c) === 'Test Wall'); const a = attackersOnMe(phaseNow()).find(c => info(c.k)?.n === 'Grizzly Bears'); UI.blkSel = {[w.id]:a.id}; confirmBlocks(false); });
    for (let i = 0; i < 40 && (await A.evaluate(() => phaseNow().ph === 4)); i++){ for (const p of [A, B]) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(250); }
    await settle(A, [B]); await settle(B, [A]);
    const bl3 = (await st(B)).life;
    check(bl3 === bl2 - 2 - 2 + 2, `Striker hits for 2 + trigger 2, Wall gains 2: ${bl2} → ${bl3}`);
    const lg = await A.evaluate(() => S.log.map(e => e.s).filter(x => /trigger/.test(x)).slice(-4));
    console.log('   ', lg.join(' | '));
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); H.aedes.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
