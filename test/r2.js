const H = require('./h'); const {check, sleep, ev, st, give, put, setPool, bfId, handId, menuClick, choose, pass, waitFor} = H;
const oppBf = (p, name) => ev(p, n => { for (const s of OPP.values()) { const c = s.bf.find(b => info(b.k)?.n === n); if (c) return c; } return null; }, name);
const tgtClick = async (p, re) => { await p.waitForSelector('#modal [data-act="tgtT"]', {timeout:4000}); const bs = await p.$$('#modal [data-act="tgtT"]'); for (const b of bs){ if (re.test(await b.innerText()) && !(await b.isDisabled())){ await b.click(); await p.click('#modal [data-act="tgtDone"]'); return true; } } return false; };
const tgtState = (p) => ev(p, () => UI.modal && UI.modal.type === 'target' ? UI.modal.cands.map(c => `${c.nm}:${c.ok ? 'ok' : c.why}`) : null);
const drain = async (p) => { for (let i = 0; i < 8; i++){ if (!(await ev(p, () => stackAll().length))) return; if (await ev(p, () => !!document.querySelector('#stackpanel [data-act="passPrio"]'))) await p.click('#stackpanel [data-act="passPrio"]').catch(() => {}); await sleep(250); } };
const settle = async (A, B) => { for (let i = 0; i < 20; i++){ await drain(A); await drain(B); if (!(await ev(A, () => stackAll().length)) && !(await ev(B, () => stackAll().length))) return; await sleep(150); } };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    const A = await H.player(browser, 'Georges', H.deckFor('Krenko, Mob Boss'), 'host', 'r2');
    const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2');
    await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
    await waitFor(A, () => phaseNow().ph >= 1); await settle(A, B);
    await waitFor(A, () => phaseNow().ph === 3, null, 8000); await settle(A, B);
    for (const n of ['Slippery Bogle','Paladin en-Vec','Ward Bear','Darksteel Myr','Grizzly Bears']) await put(B, n);
    await waitFor(A, () => [...OPP.values()][0].bf.length >= 5);

    console.log('— Targeting legality');
    await give(A, 'Lightning Bolt'); await setPool(A, {R:1});
    let id = await handId(A, 'Lightning Bolt'); await menuClick(A, id, /^Cast/);
    await A.waitForSelector('#modal [data-act="tgtT"]');
    const ts = await tgtState(A); console.log('   ', ts.join(' | '));
    check(ts.includes('Slippery Bogle:hexproof') && ts.includes('Paladin en-Vec:protection') && ts.some(t => /^Kim:ok/.test(t)), 'hexproof and protection greyed, players targetable');
    await tgtClick(A, /Grizzly Bears/);
    await waitFor(B, () => stackAll().length === 1); await pass(B);
    check(await waitFor(B, () => !S.bf.some(c => cname(c) === 'Grizzly Bears') && S.gy.some(c => cname(c) === 'Grizzly Bears')), 'Bolt kills Grizzly Bears on Kim\'s side (damage + state-based action)');

    await give(A, 'Murder'); await setPool(A, {B:3});
    id = await handId(A, 'Murder'); await menuClick(A, id, /^Cast/); await tgtClick(A, /Darksteel Myr/);
    await waitFor(B, () => stackAll().length === 1); await pass(B); await settle(A, B);
    check(await waitFor(B, () => S.bf.some(c => cname(c) === 'Darksteel Myr')), 'indestructible survives Murder');

    console.log('— Ward');
    await give(A, 'Swords to Plowshares'); await setPool(A, {W:1, C:2});
    const lifeB = (await st(B)).life;
    id = await handId(A, 'Swords to Plowshares'); await menuClick(A, id, /^Cast/); await tgtClick(A, /Ward Bear/);
    check(await choose(A, /^Pay \{2\}/), 'asked to pay ward {2}');
    await waitFor(B, () => stackAll().length === 1); await pass(B);
    check(await waitFor(B, l => S.ex.some(c => cname(c) === 'Ward Bear') && S.life === l + 2, lifeB), 'Swords exiles Ward Bear, Kim gains 2');

    console.log('— Pump, Threaten, anthem');
    await put(A, 'Glorious Anthem'); await put(A, 'Goblin Warchief');
    const pt = await ev(A, () => livePT(S.bf.find(c => cname(c) === 'Goblin Warchief')));
    check(pt === '3/3', 'Glorious Anthem: Warchief shows 3/3 (' + pt + ')');
    await put(B, 'Goblin King'); await sleep(500);
    const pt2 = await ev(A, () => livePT(S.bf.find(c => cname(c) === 'Goblin Warchief')));
    check(pt2 === '4/4', "Kim's Goblin King pumps my Goblin too: " + pt2);
    await give(A, 'Threaten'); await setPool(A, {R:3});
    id = await handId(A, 'Threaten'); await menuClick(A, id, /^Cast/); await tgtClick(A, /Goblin King/);
    await waitFor(B, () => stackAll().length === 1); await pass(B);
    check(await waitFor(A, () => S.bf.some(c => cname(c) === 'Goblin King' && c.own && !c.tap && hasHaste(c))), 'Threaten: I control Goblin King, untapped with haste');
    check(await waitFor(B, () => !S.bf.some(c => cname(c) === 'Goblin King')), "it left Kim's board");

    console.log('— Other players choose: Fleshbag, Mind Rot');
    await give(A, 'Fleshbag Marauder'); await setPool(A, {B:3});
    id = await handId(A, 'Fleshbag Marauder'); await menuClick(A, id, /^Cast/);
    await waitFor(B, () => stackAll().length === 1); await pass(B); await settle(A, B);
    check(await waitFor(B, () => S.prm.some(p => p.type === 'sac')), 'Kim gets a "sacrifice a creature" box');
    await B.click('[data-act="choosePrm"]'); await B.waitForSelector('#modal [data-act="pickT"]'); await B.click('#modal [data-act="pickT"]'); await B.click('#modal [data-act="pickDone"]');
    check(await waitFor(A, () => S.prm.some(p => p.type === 'sac') || S.log.some(e => /sacrificed/.test(e.s))), 'I also have to sacrifice (each player)');
    if (await ev(A, () => S.prm.some(p => p.type === 'sac'))){ await A.click('[data-act="choosePrm"]'); await A.waitForSelector('#modal [data-act="pickT"]'); await A.click('#modal [data-act="pickT"]'); await A.click('#modal [data-act="pickDone"]'); }
    const handB = (await st(B)).hand.length;
    await give(A, 'Mind Rot'); await setPool(A, {B:3});
    id = await handId(A, 'Mind Rot'); await menuClick(A, id, /^Cast/);
    await waitFor(B, () => stackAll().length === 1); await pass(B);
    check(await waitFor(B, () => S.prm.some(p => p.type === 'discard')), 'Mind Rot targets Kim automatically and Kim gets a discard box');
    await B.evaluate(() => { const p = S.prm.find(p => p.type === 'discard'); p.left = 100; });
    check(await waitFor(B, n => S.hand.length === n - 2, handB), 'timeout discards 2 at random');

    console.log('— Wrath');
    await give(A, 'Wrath of God'); await setPool(A, {W:4});
    await settle(A, B);
    id = await handId(A, 'Wrath of God'); await menuClick(A, id, /^Cast/);
    await waitFor(B, () => stackAll().length === 1); await pass(B); await settle(A, B);
    await sleep(800);
    const wa = await ev(A, () => S.bf.filter(c => isCreatureCard(c)).map(cname)), wb = await ev(B, () => S.bf.filter(c => isCreatureCard(c)).map(cname));
    check(!wa.length || wa.every(n => n === 'Goblin King') , 'my creatures destroyed: ' + wa.join(','));
    check(wb.length === 1 && wb[0] === 'Darksteel Myr', "Kim's creatures destroyed except the indestructible Myr: " + wb.join(','));

    console.log('— Graveyard: flashback, unearth, Zombify');
    await give(A, 'Think Twice'); await setPool(A, {U:2});
    id = await handId(A, 'Think Twice'); await menuClick(A, id, /^Cast/); await waitFor(B, () => stackAll().length === 1); await pass(B); await settle(A, B);
    await setPool(A, {U:3});
    const opts = await ev(A, () => { const c = S.gy.find(c => cname(c) === 'Think Twice'); return gyOptions(c).map(g => g.label); });
    check(opts[0] === 'Flashback {2}{U}', 'flashback offered: ' + opts);
    await ev(A, () => { const c = S.gy.find(c => cname(c) === 'Think Twice'); castFromGy(c, gyOptions(c)[0]); });
    await waitFor(B, () => stackAll().length === 1); await pass(B); await settle(A, B);
    check(await waitFor(A, () => S.ex.some(c => cname(c) === 'Think Twice')), 'flashback card is exiled after resolving');
    await ev(A, () => { const c = S.lib.find(c => cname(c) === 'Dregscape Zombie'); S.lib.splice(S.lib.indexOf(c), 1); S.gy.push(c); S.pool = {...emptyPool(), B:1}; commit(); });
    await ev(A, () => { const c = S.gy.find(c => cname(c) === 'Dregscape Zombie'); castFromGy(c, gyOptions(c)[0]); });
    await waitFor(B, () => stackAll().length === 1); await pass(B); await settle(A, B);
    check(await waitFor(A, () => S.bf.some(c => cname(c) === 'Dregscape Zombie' && hasHaste(c))), 'unearth returns it with haste');

    console.log('— Loops');
    await put(A, 'Kinnan, Bonder Prodigy'); await put(A, 'Basalt Monolith');
    await setPool(A, {});
    await A.click('[data-act="gameMenu"]'); await A.click('[data-act="recLoop"]');
    id = await bfId(A, 'Basalt Monolith'); await A.dblclick(`.card[data-id="${id}"]`);
    check((await st(A)).pool.C === 4, 'Basalt + Kinnan = 4 colorless');
    await menuClick(A, id, /Untap/); await waitFor(B, () => stackAll().length === 1); await pass(B); await settle(A, B);
    check((await st(A)).pool.C === 1 && !(await ev(A, i => S.bf.find(c => c.id === i).tap, id)), 'paid {3} to untap: 1 left, Monolith untapped');
    await A.click('[data-act="gameMenu"]'); await A.click('[data-act="repeatLoop"]');
    await choose(A, /number of times/); await A.fill('#askIn', '5'); await A.press('#askIn', 'Enter');
    await waitFor(B, () => stackAll().some(i => /Repeat/.test(i.nm))); await pass(B);
    check(await waitFor(A, () => S.log.some(e => /repeated the loop 5 times/.test(e.s)), null, 30000), 'loop ran 5 times');
    check((await st(A)).pool.C === 6, 'net +1 colorless per loop: pool C = ' + (await st(A)).pool.C);

    await setPool(A, {}); await put(A, 'Walking Ballista'); await ev(A, () => { S.bf.find(c => cname(c) === 'Walking Ballista').cp = 10; commit(); });
    const kimLife = (await st(B)).life;
    await A.click('[data-act="gameMenu"]'); await A.click('[data-act="recLoop"]');
    id = await bfId(A, 'Walking Ballista'); await menuClick(A, id, /deals 1 damage/);
    await tgtClick(A, /Target Kim/);
    await waitFor(B, () => stackAll().length === 1); await pass(B); await settle(A, B);
    check(await waitFor(B, l => S.life === l - 1, kimLife), 'Ballista pings Kim for 1');
    await A.click('[data-act="gameMenu"]'); await A.click('[data-act="repeatLoop"]');
    await choose(A, /number of times/); await A.fill('#askIn', '3'); await A.press('#askIn', 'Enter');
    await waitFor(B, () => stackAll().some(i => /Repeat/.test(i.nm))); await pass(B);
    check(await waitFor(B, l => S.life === l - 4, kimLife, 30000), 'repeat ×3 reuses the target: Kim down 4 in total');
    await A.screenshot({path:'shot-r2.png'});
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); H.aedes.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
