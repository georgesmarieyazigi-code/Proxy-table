const H = require('./h'); const {check, sleep, ev, st, give, put, setPool, bfId, handId, menuClick, choose, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const settle = async (A, ps) => { for (let i = 0; i < 25; i++){ await passAll(ps); if (!(await A.evaluate(() => stackAll().length || UI.resolving))) return; await sleep(150); } };
const pickTarget = async (p, re) => { try { await p.waitForSelector('#modal [data-act="tgtT"]', {timeout:3000}); } catch { return; } for (const b of await p.$$('#modal [data-act="tgtT"]')) if (re.test(await b.innerText())){ await b.click(); break; } await p.click('#modal [data-act="tgtDone"]'); };
const cast = async (p, name, pool, re = /^Cast/) => { await give(p, name); await setPool(p, pool); const id = await handId(p, name); return menuClick(p, id, re); };
const step = async (name, fn) => { console.log('— ' + name); try { await fn(); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); } };
const toTop = (p, names) => p.evaluate(ns => { const got = ns.map(n => { for (const z of ['lib','hand','gy','ex','bf']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const c = S[z].splice(i, 1)[0]; reset(c); return c; } } }).filter(Boolean); S.lib.unshift(...got); commit(); }, names);
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Krenko, Mob Boss'), 'host', 'r9');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r9');
  await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle(A, [B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  const BPID = await B.evaluate(() => MYPID);
  try {
    await step('Monarch', async () => {
      await put(A, 'Test Monarch'); await settle(A, [B]);
      check(await waitFor(A, () => holderOf('mon') === MYPID), 'Georges is the monarch');
      check(await waitFor(B, () => holderOf('mon') && holderOf('mon') !== MYPID), 'Kim sees Georges as the monarch');
      check(await A.evaluate(() => /monarch/.test(document.querySelector('#topbar').innerText)), 'top bar shows the crown');
    });
    await step('Emblem', async () => {
      await put(A, 'Grizzly Bears'); await cast(A, 'Test Emblem', {W:1, C:1}); await settle(A, [B]);
      check(await waitFor(A, () => S.bf.some(c => c.emb) && stats(S.bf.find(c => cname(c) === 'Grizzly Bears'))[0] === 3), 'emblem: Bears 3/3');
    });
    await step('Adventure', async () => {
      const kl = (await st(B)).life;
      check(await cast(A, 'Test Giant // Stomp Test', {R:2}, /Stomp Test/) === 'ok', 'menu offers the adventure');
      await pickTarget(A, /Target Kim/); await settle(A, [B]);
      check(await waitFor(B, l => S.life === l - 2, kl), 'Stomp Test dealt 2');
      check(await A.evaluate(() => S.ex.some(c => /Test Giant/.test(cname(c)) && exWindowOk(c))), 'card is on an adventure in exile, castable');
      await setPool(A, {R:1, C:2});
      await A.evaluate(() => ACT.viewZone({dataset:{z:'ex'}})); await A.waitForSelector('#modal [data-act="exCast"]');
      await A.evaluate(() => { const b = [...document.querySelectorAll('#modal [data-act="exCast"]')].find(b => b.closest('.vitem').innerText.includes('Test Giant')); b.click(); });
      await settle(A, [B]);
      check(await waitFor(A, () => S.bf.some(c => /Test Giant/.test(cname(c)) && (stats(c) || [])[0] >= 4)), 'Test Giant cast from exile as a creature');
    });
    await step('Split card', async () => {
      const h0 = (await st(A)).hand.length;
      check(await cast(A, 'Test Fire // Test Ice', {U:1, C:1}, /Cast Test Ice/) === 'ok', 'menu offers each half');
      await settle(A, [B]);
      check(await waitFor(A, h => S.hand.length === h + 1, h0), 'Test Ice drew a card');
      check(await A.evaluate(() => S.gy.some(c => /Test Fire/.test(cname(c)))), 'split card in the graveyard with its full name');
    });
    await step('Foretell', async () => {
      check(await cast(A, 'Test Foretell', {C:2}, /Foretell/) === 'ok', 'foretell offered');
      check(await waitFor(A, () => S.ex.some(c => c.fore && c.fd)), 'exiled face down');
      await A.evaluate(() => { S.ex.find(c => c.fore).fore = 'earlier'; });
      const l0 = (await st(A)).life; await setPool(A, {W:1});
      await A.evaluate(() => ACT.viewZone({dataset:{z:'ex'}})); await A.waitForSelector('#modal [data-act="foreCast"]'); await A.click('#modal [data-act="foreCast"]');
      await settle(A, [B]);
      check(await waitFor(A, l => S.life === l + 5, l0), 'cast for the foretell cost {W}: +5 life');
    });
    await step('Morph', async () => {
      check(await cast(A, 'Test Morph', {C:3}, /face down/) === 'ok', 'cast face down offered');
      await settle(A, [B]);
      check(await waitFor(A, () => { const c = S.bf.find(c => c.fd && c.fdc); return c && stats(c)[0] === 3; }), 'a 2/2 face-down creature (3/3 with the emblem)');
      check(await waitFor(B, () => [...OPP.values()].some(s => (s.bf || []).some(c => c.fd && c.fdc))), 'Kim sees a face-down 2/2');
      const h0 = (await st(A)).hand.length; await setPool(A, {G:1, C:2});
      await A.evaluate(() => turnFaceUp(S.bf.find(c => c.fd && c.fdc))); await settle(A, [B]);
      check(await waitFor(A, () => stats(S.bf.find(c => cname(c) === 'Test Morph'))[0] === 6), 'turned face up: 5/5 (+1 emblem)');
      check(await waitFor(A, h => S.hand.length === h + 1, h0), '“when turned face up” drew a card');
    });
    await step('Cascade', async () => {
      await toTop(A, ['Mountain', 'Divination']);
      const h0 = (await st(A)).hand.length;
      await cast(A, 'Test Cascade', {R:1, C:3}); await passAll([B]);
      const okc = await waitFor(A, () => UI.modal && UI.modal.type === 'choice' && /Cascade/.test(UI.modal.title), null, 8000); if (!okc) console.log('   ', await A.evaluate(() => [JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title}), S.log.slice(-6).map(e => e.s).join(' | '), S.lib.slice(0,3).map(cname).join(',')]));
      check(okc, 'cascade offers Divination');
      await choose(A, /Cast it/); await settle(A, [B]);
      check(await waitFor(A, h => S.hand.length === h + 2, h0, 8000), 'Divination cast for free: drew 2');
      check(await A.evaluate(() => S.lib[S.lib.length - 1] && cname(S.lib[S.lib.length - 1]) === 'Mountain'), 'Mountain went to the bottom');
    });
    await step('Storm', async () => {
      const n = await A.evaluate(() => (S.casts || []).filter(x => x.t === turnStr()).length);
      const kl = (await st(B)).life;
      await cast(A, 'Test Grapeshot', {R:1, C:1}); await pickTarget(A, /Target Kim/); await passAll([B]);
      if (await waitFor(A, () => UI.modal && UI.modal.type === 'choice' && /copies/.test(UI.modal.title), null, 6000)) await choose(A, /Same targets/);
      await settle(A, [B]);
      check(await waitFor(B, x => S.life === x, kl - 1 - n, 8000), `storm ${n}: Kim lost ${kl - (await st(B)).life} (expected ${1 + n})`);
    });
    await step('Cast trigger', async () => {
      const h0 = (await st(A)).hand.length;
      await cast(A, 'Test Titan', {C:7}); await settle(A, [B]);
      check(await waitFor(A, h => S.hand.length === h + 2, h0, 12000), '“when you cast this spell” drew 2');
    });
    await step('Thoughtseize', async () => {
      await give(B, 'Lightning Bolt');
      await cast(A, 'Test Seize', {B:1}); await pickTarget(A, /Target Kim/); await passAll([B]);
      check(await waitFor(A, () => UI.modal && UI.modal.type === 'choice' && /choose a nonland/.test(UI.modal.title), null, 15000), 'Georges sees Kim’s hand');
      await A.screenshot({path:'shot-seize.png'});
      await choose(A, /Lightning Bolt/); await settle(A, [B]);
      check(await waitFor(B, () => S.gy.some(c => cname(c) === 'Lightning Bolt') && !S.rh), 'Kim discarded Bolt and the hand is hidden again');
    });
    await step('Fact or Fiction', async () => {
      const s0 = await st(A);
      await cast(A, 'Test Fiction', {U:1, C:3}); await passAll([B]);
      check(await waitFor(B, () => UI.modal && UI.modal.type === 'pick' && /piles/.test(UI.modal.title), null, 15000), 'Kim is asked to split the piles');
      await B.click('#modal [data-act="pickT"] >> nth=0'); await B.click('#modal [data-act="pickT"] >> nth=1'); await B.click('#modal [data-act="pickDone"]');
      check(await waitFor(A, () => UI.modal && UI.modal.type === 'choice' && /which pile/.test(UI.modal.title), null, 15000), 'Georges picks a pile');
      await choose(A, /Pile 2/); await settle(A, [B]);
      const s1 = await st(A);
      check(s1.hand.length === s0.hand.length + 3 && s1.gy.length >= s0.gy.length + 3, `3 to hand, 2 + the spell to graveyard (hand +${s1.hand.length - s0.hand.length}, gy +${s1.gy.length - s0.gy.length})`);
    });
    await step('Stifle', async () => {
      const t0 = await A.evaluate(() => S.bf.filter(c => c.tok && !c.emb).reduce((a, c) => a + (c.n || 1), 0));
      await put(A, 'Siege-Gang Commander');
      await waitFor(B, () => stackAll().some(i => i.kind === 'trigger'));
      await give(B, 'Test Stifle'); await setPool(B, {U:1}); const id = await handId(B, 'Test Stifle'); await menuClick(B, id, /^Cast/);
      check(await choose(B, /Siege-Gang/), 'Stifle targets the trigger');
      await settle(A, [B]); await settle(B, [A]); await sleep(800);
      check(await A.evaluate(t => S.bf.filter(c => c.tok && !c.emb).reduce((a, c) => a + (c.n || 1), 0) === t, t0), 'no Goblin tokens: trigger countered');
    });
    await step('Path to Exile', async () => {
      await put(B, 'Grizzly Bears'); await sleep(600);
      const lands = await B.evaluate(() => S.bf.filter(c => isLand(c.k)).length);
      await cast(A, 'Test Path', {W:1}); await A.waitForSelector('#modal [data-act="tgtT"]');
      await A.evaluate(() => { const i = UI.modal.cands.findIndex(c => c.pid !== MYPID && c.ok && /Bears/.test(c.nm)); UI.modal.sel = [i]; renderModal(); }); await A.click('#modal [data-act="tgtDone"]');
      await settle(A, [B]);
      check(await waitFor(B, () => UI.modal && UI.modal.type === 'choice' && /search your library/.test(UI.modal.title), null, 10000), 'Kim is offered the land search');
      await choose(B, /Search/); await B.waitForSelector('#modal [data-act="pickT"]'); await B.click('#modal [data-act="pickT"] >> nth=0'); await B.click('#modal [data-act="pickDone"]');
      check(await waitFor(B, n => S.bf.filter(c => isLand(c.k)).length === n + 1 && S.bf.some(c => isLand(c.k) && c.tap), lands), 'Kim got a tapped basic land');
    });
    await step('Rest in Peace', async () => {
      await put(B, 'Test Rest'); await sleep(800);
      await A.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Grizzly Bears'); moveCard(c.id, 'gy'); });
      check(await A.evaluate(() => S.ex.some(c => cname(c) === 'Grizzly Bears') && !S.gy.some(c => cname(c) === 'Grizzly Bears')), 'Bears exiled instead of dying');
      await B.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Test Rest'); moveCard(c.id, 'hand', {quiet:true}); }); await sleep(600);
    });
    await step('Damage trigger', async () => {
      await put(A, 'Test Fan'); const l0 = (await st(A)).life;
      await cast(A, 'Lightning Bolt', {R:1}); await pickTarget(A, /Target Kim/); await settle(A, [B]); await settle(A, [B]);
      check(await waitFor(A, l => S.life === l + 1, l0), 'Test Fan: +1 life when my Bolt hit Kim');
    });
    await step('Switch power and toughness', async () => {
      await cast(A, 'Test Switch', {R:1}); await settle(A, [B]);
      check(await waitFor(A, () => { const s = stats(S.bf.find(c => /Test Giant/.test(cname(c)))); return s[0] === 4 && s[1] === 5; }), 'Test Giant 4/3 (+1/+1 emblem → 5/4) is now 4/5');
    });
    await step('Extra turn', async () => {
      const n0 = await A.evaluate(() => currentTurn()[0]);
      await cast(A, 'Test Time Walk', {U:1, C:1}); await settle(A, [B]);
      check(await A.evaluate(() => S.xt === 1), 'extra turn queued');
      await A.evaluate(() => passTurn());
      check(await waitFor(A, n => currentTurn()[0] === n + 1 && currentTurn()[1] === MYPID, n0), 'the next turn is Georges again');
      check(await waitFor(B, () => currentTurn()[1] !== MYPID), 'Kim agrees');
    });
    await step('Initiative and Undercity', async () => {
      await A.evaluate(() => { S.dg = null; });
      await put(A, 'Test Initiative'); await settle(A, [B]);
      check(await waitFor(A, () => holderOf('ini') === MYPID && S.dg && S.dg.d === 'Undercity'), 'took the initiative and entered Undercity');
      await settle(A, [B]);
      if (await waitFor(A, () => UI.modal && UI.modal.type === 'pick', null, 4000)){ await A.click('#modal [data-act="pickT"] >> nth=0'); await A.click('#modal [data-act="pickDone"]'); }
      await settle(A, [B]);
      check(await A.evaluate(() => S.log.some(e => /Secret Entrance/.test(e.s))), 'Secret Entrance room ability');
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); H.aedes.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
