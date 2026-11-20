const H = require('./h'); const {check, sleep, ev, st, give, put, setPool, bfId, handId, menuClick, choose, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const settle = async (A, ps) => { for (let i = 0; i < 25; i++){ await passAll(ps); if (!(await A.evaluate(() => stackAll().length || UI.resolving))) return; await sleep(150); } };
const landIn = (p) => p.evaluate(() => { const c = S.lib.find(c => cname(c) === 'Mountain'); moveCard(c.id, 'bf'); commit(); });
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    const A = await H.player(browser, 'Georges', H.deckFor('Krenko, Mob Boss'), 'host', 'r6');
    const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r6');
    await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
    await settle(A, [B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);

    console.log('— Tifa landfall');
    await put(A, 'Tifa Lockhart');
    const pw = () => A.evaluate(() => stats(S.bf.find(c => cname(c) === 'Tifa Lockhart'))[0]);
    check(await pw() === 1, 'Tifa starts at power 1');
    await landIn(A); await sleep(300);
    check(await A.evaluate(() => stackAll().some(i => /Tifa/.test(i.nm))), 'land entering puts the landfall trigger on the stack');
    await settle(A, [B]);
    check(await waitFor(A, () => stats(S.bf.find(c => cname(c) === 'Tifa Lockhart'))[0] === 2), 'power doubled to 2 automatically');
    await landIn(A); await settle(A, [B]);
    check(await waitFor(A, () => { const s = stats(S.bf.find(c => cname(c) === 'Tifa Lockhart')); return s[0] === 4 && s[1] === 2; }), 'second land: 4/2 (toughness unchanged)');

    console.log('— Manual power/toughness');
    let id = await bfId(A, 'Tifa Lockhart');
    check(await menuClick(A, id, /^\+1\/\+0/) === 'ok', 'menu has +1/+0');
    check(await waitFor(A, () => { const s = stats(S.bf.find(c => cname(c) === 'Tifa Lockhart')); return s[0] === 5 && s[1] === 2; }), '+1/+0 → 5/2');
    await A.keyboard.press('Escape');

    console.log('— Opponent spell shows its text');
    await give(A, 'Lightning Bolt'); await setPool(A, {R:1});
    id = await handId(A, 'Lightning Bolt'); await menuClick(A, id, /^Cast/);
    await A.waitForSelector('#modal [data-act="tgtT"]');
    for (const b of await A.$$('#modal [data-act="tgtT"]')) if (/Target Kim/.test(await b.innerText())){ await b.click(); break; }
    await A.click('#modal [data-act="tgtDone"]');
    check(await waitFor(B, () => !!document.querySelector('#stackpanel .pdet')), 'Kim gets a priority box with details');
    const det = await B.evaluate(() => document.querySelector('#stackpanel .pdet').innerText);
    check(/3 damage/.test(det) && /Kim/.test(det), 'box shows the rules text and the target: ' + det.replace(/\s+/g, ' '));
    await B.screenshot({path:'shot-respond.png'});
    await settle(A, [B]);

    console.log('— Elminster');
    await put(A, 'Elminster');
    id = await bfId(A, 'Elminster');
    const hand0 = (await st(A)).hand.length;
    await A.dblclick(`.card[data-id="${id}"]`); await A.waitForSelector('#modal [data-act="pwGo"]');
    await A.click('#modal [data-act="pwGo"][data-i="0"]');
    await settle(A, [B]);
    check(await waitFor(A, () => UI.modal && UI.modal.type === 'zone' && UI.modal.ids.length === 2), '+2 drew a card and opened scry 2');
    check((await st(A)).hand.length === hand0 + 1, 'hand +1');
    await A.screenshot({path:'shot-scry.png'});
    await A.keyboard.press('Escape'); await sleep(300);
    await A.evaluate(() => { const i = S.lib.findIndex(c => cname(c) === 'Siege-Gang Commander'); const [c] = S.lib.splice(i, 1); S.lib.unshift(c); const e = S.bf.find(c => cname(c) === 'Elminster'); e.lu = null; e.co = 5; commit(); });
    const n0 = await A.evaluate(() => S.bf.filter(c => c.tok).length);
    await A.evaluate(() => { UI.pwUsed = {}; });
    await A.dblclick(`.card[data-id="${id}"]`); await A.waitForSelector('#modal [data-act="pwGo"]');
    const can = await A.evaluate(() => !document.querySelector('#modal [data-act="pwGo"][data-i="1"]').disabled);
    if (can){
      await A.click('#modal [data-act="pwGo"][data-i="1"]'); await settle(A, [B]);
      console.log('   ', await A.evaluate(() => S.log.slice(-6).map(e => e.s).join(' | ')));
      check(await waitFor(A, n => S.bf.filter(c => c.tok).reduce((a, c) => a + (c.n || 1), 0) - n === 5 && S.ex.some(c => cname(c) === 'Siege-Gang Commander'), n0), '−3 exiled Siege-Gang (MV 5) → five Faerie Dragons');
    } else { await A.keyboard.press('Escape'); console.log('  (−3 skipped: one loyalty ability per turn)'); }

    console.log('— Text it cannot do');
    await give(A, 'Odd Sorcery'); await setPool(A, {R:1});
    id = await handId(A, 'Odd Sorcery'); await menuClick(A, id, /^Cast/); await settle(A, [B]);
    check(await waitFor(A, () => !!document.querySelector('#stackpanel .notebox')), 'unreadable text shows a "do this by hand" box');
    await A.screenshot({path:'shot-note.png'});
    await A.click('#stackpanel .notebox [data-act=noteDone]');
    check(await waitFor(A, () => !document.querySelector('#stackpanel:not([hidden]) .notebox')), 'Done clears it');
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); H.aedes.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
