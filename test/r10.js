const H = require('./h'); const {check, sleep, ev, st, give, put, setPool, bfId, handId, menuClick, choose, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const settle = async (A, ps) => { for (let i = 0; i < 25; i++){ await passAll(ps); if (!(await A.evaluate(() => stackAll().length || UI.resolving))) return; await sleep(150); } };
const pickTarget = async (p, re) => { try { await p.waitForSelector('#modal [data-act="tgtT"]', {timeout:3000}); } catch { return; } for (const b of await p.$$('#modal [data-act="tgtT"]')) if (re.test(await b.innerText())){ await b.click(); break; } await p.click('#modal [data-act="tgtDone"]'); };
const cast = async (p, name, pool, re = /^Cast/) => { await give(p, name); await setPool(p, pool); const id = await handId(p, name); return menuClick(p, id, re); };
let PA = null; const step = async (name, fn) => { console.log('— ' + name); const f0 = H.fails(); try { await fn(); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); } if (H.fails() > f0 && PA) console.log('    LOG:', (await PA.evaluate(() => S.log.slice(-8).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
const CMDS = /^(Edgar Markov|The Ur-Dragon|Atraxa|Giada|Lathril|Jodah|Yuriko|Nekusar|Miirym|Chatterfang|Muldrotha|Animar|Meren|Teysa|Korvold|Gishath|Isshin|Kenrith|Magda|Urza|Pantlaza|Oloro|Queen Marchesa|Breya|Rin and Seri|Niv-Mizzet|Azusa|Yawgmoth|Baral|Sheoldred|Kraum|Winota|Chulane|Najeela|Aminatou)/;
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r10');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r10');
  PA = A; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle(A, [B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  try {
    await step('Checker on popular commanders', async () => {
      await A.evaluate(() => runDeckCheck(S.deck));
      check(await waitFor(A, () => UI.modal && UI.modal.finished, null, 90000), 'checker finished');
      const rep = await A.evaluate(() => UI.modal.report); await A.keyboard.press('Escape');
      const blocks = rep.split('\n\n').filter(b => CMDS.test(b));
      console.log(blocks.map(b => b.split('\n').map(l => '    | ' + l).join('\n')).join('\n'));
      check(blocks.length <= 6, `${blocks.length} of 35 commanders still have gaps`);
    });

    const cnt = (p, f) => p.evaluate(f);
    const toks = n => A.evaluate(nm => S.bf.filter(c => c.tok && new RegExp(nm).test(cname(c))).reduce((a, c) => a + (c.n || 1), 0), n);
    await step('Edgar Markov eminence (from the command zone)', async () => {
      const t0 = await toks('Vampire');
      await cast(A, 'Test Vampire', {B:1, C:1}); await settle(A, [B]);
      check(await waitFor(A, t => S.bf.filter(c => c.tok && /Vampire/.test(cname(c))).reduce((a, c) => a + (c.n || 1), 0) === t + 1, t0), 'casting a Vampire made a 1/1 Vampire token while Edgar is in the command zone');
    });
    await step('The Ur-Dragon eminence cost reduction', async () => {
      await A.evaluate(() => { const i = S.lib.findIndex(c => cname(c) === 'The Ur-Dragon'); S.cz.push(S.lib.splice(i, 1)[0]); commit(); });
      await give(A, 'Miirym, Sentinel Wyrm');
      const c = await A.evaluate(() => costStr(spellCost(S.hand.find(c => cname(c) === 'Miirym, Sentinel Wyrm'), 'hand').cost));
      check(/\{2\}/.test(c), 'Miirym costs {1} less with The Ur-Dragon in the command zone: ' + c);
    });
    await step('Giada', async () => {
      await put(A, 'Giada, Font of Hope'); await put(A, 'Test Angel'); await settle(A, [B]);
      check(await A.evaluate(() => S.bf.find(c => cname(c) === 'Test Angel').cp === 1), 'Test Angel enters with 1 extra counter (one Angel already)');
    });
    await step('Lathril: create that many', async () => {
      await put(A, 'Lathril, Blade of the Elves'); const t0 = await toks('Elf');
      await A.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Lathril, Blade of the Elves'); emit({type:'cdmg', k:c.k, id:c.id, dp:opponents()[0].pid, cnt:1, amt:3}); });
      await settle(A, [B]);
      check(await waitFor(A, t => S.bf.filter(c => c.tok && /Elf/.test(cname(c))).reduce((a, c) => a + (c.n || 1), 0) === t + 3, t0), '3 combat damage → 3 Elf Warriors');
    });
    await step('Korvold: sacrifice and draw', async () => {
      const h0 = (await st(A)).hand.length;
      await put(A, 'Korvold, Fae-Cursed King'); await passAll([B]);
      if (await waitFor(A, () => UI.modal && UI.modal.type === 'pick', null, 5000)){ await A.click('#modal [data-act="pickT"] >> nth=0'); await A.click('#modal [data-act="pickDone"]'); }
      await settle(A, [B]);
      check(await waitFor(A, h => S.hand.length === h + 1 && S.bf.find(c => cname(c) === 'Korvold, Fae-Cursed King').cp === 1, h0), 'sacrificed a permanent: Korvold +1/+1 counter and a card');
    });
    await step('Magda: becomes tapped', async () => {
      await put(A, 'Magda, Brazen Outlaw'); await put(A, 'Test Dwarf'); await sleep(300);
      const t0 = await toks('Treasure');
      await A.evaluate(() => { S.bf.find(c => cname(c) === 'Test Dwarf').tap = true; commit(); });
      await settle(A, [B]);
      check(await waitFor(A, t => S.bf.filter(c => c.tok && /Treasure/.test(cname(c))).reduce((a, c) => a + (c.n || 1), 0) === t + 1, t0), 'tapping a Dwarf made a Treasure');
    });
    await step('Chatterfang', async () => {
      await put(A, 'Chatterfang, Squirrel General'); const s0 = await toks('Squirrel');
      await A.evaluate(() => createToken(customToken('Soldier', '1/1', 'W'), 2));
      check(await waitFor(A, t => S.bf.filter(c => c.tok && /Squirrel/.test(cname(c))).reduce((a, c) => a + (c.n || 1), 0) === t + 2, s0), '2 tokens → plus 2 Squirrels');
    });
    await step('Jodah anthem', async () => {
      await put(A, 'Jodah, the Unifier'); await put(A, 'Tifa Lockhart');
      const n = await A.evaluate(() => S.bf.filter(c => /Legendary/.test(typeOf(c)) && isCreatureCard(c)).length);
      check(await A.evaluate(n => stats(S.bf.find(c => cname(c) === 'Jodah, the Unifier'))[0] === 5 + n, n), `Jodah gets +X/+X for ${n} legendary creatures`);
    });
    await step('Animar cost', async () => {
      await put(A, 'Animar, Soul of Elements'); await A.evaluate(() => { S.bf.find(c => /Animar/.test(cname(c))).cp = 2; commit(); });
      await give(A, 'Grizzly Bears');
      const c = await A.evaluate(() => costStr(spellCost(S.hand.find(c => cname(c) === 'Grizzly Bears'), 'hand').cost));
      check(c === '{G}', 'Grizzly Bears costs {G} with 2 counters on Animar: ' + c);
    });
    await step('Muldrotha', async () => {
      await put(A, 'Muldrotha, the Gravetide');
      await A.evaluate(() => { for (const n of ['Grizzly Bears', 'Goblin Warchief']){ const c = [...S.hand, ...S.lib, ...S.bf].find(c => cname(c) === n); if (c) moveCard(c.id, 'gy', {quiet:true}); } });
      const o = await A.evaluate(() => gyOptions(S.gy.find(c => cname(c) === 'Grizzly Bears')).map(g => g.kind));
      check(o.includes('mul'), 'Grizzly Bears castable from the graveyard: ' + o);
      await setPool(A, {G:1, C:1}); await A.evaluate(() => { const c = S.gy.find(c => cname(c) === 'Grizzly Bears'); castFromGy(c, gyOptions(c).find(g => g.kind === 'mul')); });
      await settle(A, [B]);
      check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Grizzly Bears') && !gyOptions(S.gy.find(c => cname(c) === 'Goblin Warchief')).some(g => g.kind === 'mul')), 'cast it; no second creature from the graveyard this turn');
    });
    await step('Azusa extra lands', async () => {
      await put(A, 'Azusa, Lost but Seeking');
      await A.evaluate(() => { S.landT = [turnStr(), 1]; commit(); });
      check(await A.evaluate(() => canPlayLand(S.hand.find(c => isLand(c.k)) || {k:''}).ok), 'can play a second land');
      await A.evaluate(() => { S.landT = [turnStr(), 3]; });
      check(await A.evaluate(() => !canPlayLand({k:''}).ok), 'not a fourth');
    });
    await step('Nekusar and Sheoldred punish opponents drawing', async () => {
      await put(A, 'Nekusar, the Mindrazer'); await put(A, 'Sheoldred, the Apocalypse'); await sleep(600);
      const l0 = (await st(B)).life;
      await B.evaluate(() => { S.drawn = 0; draw(1); });
      await settle(A, [B]); await settle(B, [A]); await sleep(500); await settle(A, [B]);
      check(await waitFor(B, l => S.life === l - 3, l0, 8000), `Kim drew: −1 (Nekusar) −2 (Sheoldred): ${l0} → ${(await st(B)).life}`);
    });
    await step('Oloro: may pay {1}, if you do', async () => {
      await put(A, 'Oloro, Ageless Ascetic'); await setPool(A, {C:1});
      const h0 = (await st(A)).hand.length, l0 = (await st(B)).life;
      await A.evaluate(() => runEffects('You gain 3 life.', {name:'Test', full:'You gain 3 life.'}));
      await passAll([B]);
      if (await waitFor(A, () => UI.modal && UI.modal.type === 'choice', null, 5000)) await choose(A, /^Yes/);
      await settle(A, [B]);
      check(await waitFor(A, h => S.hand.length === h + 1, h0) && await waitFor(B, l => S.life === l - 1, l0), 'paid {1}: drew and drained 1');
      await A.evaluate(() => { S.bf.filter(c => /Oloro|Sheoldred|Nekusar/.test(cname(c))).forEach(c => moveCard(c.id, 'hand', {quiet:true})); commit(); });
      await A.evaluate(() => { S.bf.filter(c => /Oloro|Sheoldred|Nekusar/.test(cname(c))).forEach(c => moveCard(c.id, 'hand', {quiet:true})); commit(); });
    });
    await step('Pantlaza discover', async () => {
      for (let i = 0; i < 6; i++){ await settle(A, [B]); if (await A.evaluate(() => UI.modal && UI.modal.type === 'choice' && /Oloro/.test(UI.modal.title))) await choose(A, /^No/); else break; }
      await A.evaluate(() => { for (const n of ['Mountain', 'Lightning Bolt']){ for (const z of ['hand','gy','bf','ex']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const c = S[z].splice(i, 1)[0]; reset(c); S.lib.unshift(c); break; } } } commit(); });
      const h0 = (await st(A)).hand.length;
      await put(A, 'Pantlaza, Sun-Favored'); await passAll([B]);
      if (await waitFor(A, () => UI.modal && UI.modal.type === 'choice' && /discover/i.test(UI.modal.title), null, 5000)) await choose(A, /^Yes/);
      check(await waitFor(A, () => UI.modal && UI.modal.type === 'choice' && /Discover [0-9]+/.test(UI.modal.title), null, 6000), 'discover X finds a card');
      await choose(A, /hand/); await settle(A, [B]);
      check(await waitFor(A, () => S.log.some(e => /into their hand \(discover\)/.test(e.s))), 'took it into hand');
    });
    await step('Ninjutsu', async () => {
      check(await A.evaluate(() => { const c = [...S.lib, ...S.hand].find(c => /Yuriko/.test(cname(c))); return JSON.stringify(ninjutsuOf(c)); }) === '{"cmd":true,"cost":"{U}{B}"}', 'Yuriko: commander ninjutsu {U}{B} recognised');
    });
    await step('Urza construct', async () => {
      await put(A, 'Urza, Lord High Artificer'); await settle(A, [B]);
      console.log('    dbg', await A.evaluate(() => { const ks = [...DICT.keys()].filter(k => /construct/i.test(k)); return ks.map(k => [k, DICT.get(k).o, JSON.stringify(xAnthemRules(k))]); }));
      const r = await A.evaluate(() => { const c = S.bf.find(c => c.tok && /Construct/.test(cname(c))); const arts = S.bf.filter(b => /Artifact/.test(typeOf(b))).reduce((a, b) => a + (b.n || 1), 0); return c ? [stats(c)[0], arts] : null; });
      check(r && r[0] === r[1], `Construct is ${r && r[0]}/${r && r[0]} with ${r && r[1]} artifacts`);
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); H.aedes.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
