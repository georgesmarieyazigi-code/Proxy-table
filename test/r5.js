const H = require('./h'); const {check, sleep, ev, st, give, put, setPool, handId, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 5; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    const names = [['Georges','Krenko, Mob Boss'],['Kim','Thalia, Guardian of Thraben'],['Neil','Kaalia of the Vast'],['Fez','Kinnan, Bonder Prodigy'],['Noelle','Grand Arbiter Augustin IV']];
    const P = [];
    for (const [i, [n, c]] of names.entries()) P.push(await H.player(browser, n, H.deckFor(c), i ? 'join' : 'host', 'five'));
    const [A, ...O] = P;
    check(await waitFor(A, () => OPP.size === 4, null, 10000) && await waitFor(O[3], () => OPP.size === 4, null, 10000), 'five players at one table');
    await A.click('[data-act="goFirst"]');
    check(await waitFor(O[2], () => !!myBox(), null, 5000), 'every opponent gets the upkeep window');
    check(await waitFor(A, () => phaseNow().ph === 3, null, 15000), 'timers auto-pass all four windows → main phase');
    await A.screenshot({path:'shot-5p.png'});
    await put(A, 'Zulaport Cutthroat'); await put(A, 'Grizzly Bears');
    const lives = await Promise.all(O.map(p => st(p).then(s => s.life)));
    await A.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Grizzly Bears'); moveCard(c.id, 'gy'); });
    for (let i = 0; i < 10 && (await A.evaluate(() => stackAll().length)); i++){ await passAll(O); await sleep(200); }
    await sleep(800);
    const after = await Promise.all(O.map(p => st(p).then(s => s.life)));
    check(after.every((l, i) => l === lives[i] - 1), `Zulaport drains all four opponents: ${after.join(', ')}`);
    await give(A, 'Lightning Bolt'); await setPool(A, {R:1});
    const id = await handId(A, 'Lightning Bolt'); await H.menuClick(A, id, /^Cast/);
    await A.waitForSelector('#modal [data-act="tgtT"]');
    const players = await A.evaluate(() => UI.modal.cands.filter(c => c.t === 'player').length);
    check(players === 5, 'Bolt can target any of the five players');
    for (const b of await A.$$('#modal [data-act="tgtT"]')) if (/Target Noelle/.test(await b.innerText())){ await b.click(); break; }
    await A.click('#modal [data-act="tgtDone"]');
    const t0 = Date.now();
    for (let i = 0; i < 10 && (await A.evaluate(() => stackAll().length)); i++){ await passAll(O); }
    check(await waitFor(O[3], l => S.life === l - 3, after[3]), `Noelle takes 3 once all four passed (${Date.now() - t0} ms)`);
    await put(A, 'Shivan Dragon'); await put(A, 'Goblin Warchief');
    await A.evaluate(() => S.bf.forEach(c => c.sk = false));
    await A.evaluate(() => nextAction()); await waitFor(A, () => phaseNow().ph === 4);
    for (let i = 0; i < 10 && !(await A.evaluate(() => S.cb.step === 'atk')); i++){ await passAll(O); await A.evaluate(() => { if (S.cb.step === 'begin' && S.pass !== prioKey()) nextAction(); }); }
    await A.evaluate(() => { const o = opponents(); const s = S.bf.find(c => cname(c) === 'Shivan Dragon'), w = S.bf.find(c => cname(c) === 'Goblin Warchief'); UI.atkSel = {[s.id]:'p:' + o[1].pid, [w.id]:'p:' + o[3].pid}; renderCombatPanel(); });
    await A.screenshot({path:'shot-5p-attack.png'});
    await A.evaluate(() => declareAttackers());
    for (let i = 0; i < 30 && (await A.evaluate(() => phaseNow().ph === 4)); i++){ for (const p of O) await p.evaluate(() => { if (myBox()) doPass(); const pn = phaseNow(); const cb = cbOf(pn); if (cb && cb.step === 'blk' && (S.bd || '') !== cbKey(pn, cb)) confirmBlocks(false); }); await sleep(250); }
    check(await waitFor(A, () => phaseNow().ph === 5, null, 8000), 'attacked two different players; combat done');
    const ls = await Promise.all(O.map(p => st(p).then(s => s.life)));
    check(ls[1] === after[1] - 5 && ls[3] === after[3] - 3 - 2, `Neil −5 (Shivan), Noelle −2 (Warchief): ${ls.join(', ')}`);
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); H.aedes.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
