// v34: Phyrexian mana and K'rrik, Imprisoned in the Moon, paid transforms, tokens of any card, picking several modes
process.env.TOP = '1';
const CC = require('./cards');
const WANT = ["Kolaghan's Command", 'Farewell', "Jeska's Will", 'Imprisoned in the Moon', 'Llanowar Elves', 'Cryptic Command', 'Prismari Command', 'Mystic Confluence', 'Edgar Markov', "K'rrik, Son of Yawgmoth", 'Dark Ritual', 'Dismember', 'Swamp', 'Mountain', 'Volcanic Island', 'Ulvenwald Oddity // Ulvenwald Behemoth', 'Gitaxian Probe'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {sleep, waitFor, check} = H;
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    const G = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r34a'); await sleep(300);
    const K = await H.player(browser, 'Kim', H.deckFor('Krenko, Mob Boss'), 'join', 'r34a');
    await waitFor(G, () => OPP.size === 1, null, 30000);
    await G.click('[data-act="goFirst"]'); await sleep(800);
    await G.evaluate(() => { const pn = phaseNow(); if (pn.mine && S.untapN < pn.n) startMyTurn(); });
    for (let i = 0; i < 20 && !(await G.evaluate(() => phaseNow().ph === 3)); i++){ await G.evaluate(() => { if (!stackAll().length && !UI.modal) nextAction(); }); await K.evaluate(() => { if (myBox()) doPass(); }); await sleep(300); }
    await K.evaluate(() => { const k = [...DICT.values()].find(a => a.n === 'Llanowar Elves').k; S.bf.push({id:S.nid++, k, x:30, y:30, sk:false}); commit(); });
    await sleep(800);
    const put = (nm, where = 'hand') => G.evaluate(([nm, where]) => { const a = [...DICT.values()].find(a => a.n === nm); const c = {id:S.nid++, k:a.k, x:40, y:40, sk:false}; S[where].push(c); commit(); return c.id; }, [nm, where]);
    const modal = () => G.evaluate(() => { const m = UI.modal; return m ? {type:m.type, title:m.title, btns:[...document.querySelectorAll('#modal button')].map(b => b.textContent.trim().slice(0, 50))} : null; });
    const R = {};
    const run = async (nm, pool, picks, keep) => {
      const id = await put(nm); await G.evaluate(([id, pool]) => { S.pool = {...emptyPool(), ...pool}; beginCast(S.hand.find(x => x.id === id), 'hand'); }, [id, pool]); await sleep(700);
      const seen = [];
      for (const p of picks){ const m = await modal(); seen.push(m); if (!m) break; const bs = await G.$$('#modal button'); let hit = null; for (const b of bs){ const t = (await b.textContent()).trim(); if (new RegExp(p, 'i').test(t)){ hit = b; break; } } if (!hit){ seen.push('NO BUTTON ' + p); break; } await hit.click(); await sleep(500); }
      seen.push(await modal());
      const r = await G.evaluate(() => ({stk:stackAll().map(i => i.nm + ' ' + JSON.stringify(i.modes || (i.it && i.it.modes) || null)), log:S.log.slice(-3).map(e => e.s), toast:document.querySelector('#toast')?.textContent}));
      console.log('==', nm, JSON.stringify(seen).slice(0, 300), JSON.stringify(r)); R[nm] = r;
      if (!keep) await G.evaluate(() => { if (UI.modal) closeModal(); S.stk = []; commit(); });
    };
    await run("Kolaghan's Command", {B:1, R:1, C:1}, ['discards', 'Destroy target artifact']);
    await run('Farewell', {W:2, C:4}, ['artifacts', 'creatures', '✓ Exile all creatures', 'graveyards', '^Done']);
    await put('Edgar Markov', 'bf'); await G.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Edgar Markov'); c.cmd = true; commit(); });
    await run("Jeska's Will", {R:1, C:2}, ['Add \\{R\\}', 'Exile the top', 'Done']);
    await G.evaluate(() => { S.bf = S.bf.filter(c => cname(c) !== 'Edgar Markov'); commit(); });
    await run('Imprisoned in the Moon', {U:1, C:2}, ['Llanowar', 'Done'], true); for (let i = 0; i < 20; i++){ await K.evaluate(() => { if (myBox()) doPass(); }); await G.evaluate(() => { if (myBox()) doPass(); }); await sleep(300); if (!(await G.evaluate(() => stackAll().length))) break; } await sleep(1500); await K.evaluate(() => { for (let i = 0; i < 8; i++) if (myBox()) doPass(); }); await sleep(2500); await K.evaluate(() => { if (myBox()) doPass(); }); await sleep(2000);
    { const m = await G.evaluate(() => { const a = S.bf.find(c => cname(c) === 'Imprisoned in the Moon'); return a && a.att ? a.att : null; }); const el = await K.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Llanowar Elves'); return c ? {land:/Land/.test(typeOf(c) || ''), cr:isCreatureCard(c)} : null; });
      check(!!m, `Imprisoned in the Moon enchants a creature (${JSON.stringify(m)})`); check(el && el.land, `the enchanted creature is now a land (${JSON.stringify(el)})`); }
    console.log('moon on', JSON.stringify(await K.evaluate(() => S.bf.map(c => cname(c))) ), JSON.stringify(await G.evaluate(() => S.bf.filter(c => c.att).map(c => cname(c) + '->' + JSON.stringify(c.att)))));
    // K'rrik paid from lands: 4 Mountains untapped, empty pool
    await G.evaluate(() => { const k = [...DICT.values()].find(a => a.n === 'Mountain').k; for (let i = 0; i < 4; i++) S.bf.push({id:S.nid++, k, x:5 + i * 4, y:80, sk:false}); S.life = 40; commit(); });
    await run("K'rrik, Son of Yawgmoth", {}, []);
    check(await G.evaluate(() => S.life) === 34, "K'rrik cast with four Mountains: the three {B/P} paid with 6 life");
    await put("K'rrik, Son of Yawgmoth", 'bf'); await sleep(300);
    await G.evaluate(() => { S.bf.forEach(c => { if (cname(c) === 'Mountain') c.tap = true; }); commit(); });
    await run('Dark Ritual', {}, []);
    check(await G.evaluate(() => S.life) === 32, "with K'rrik out, Dark Ritual's {B} paid with 2 life");
    await run('Dismember', {C:1}, ['rrik', 'Done']);
    check(await G.evaluate(() => S.life) === 28, 'Dismember with {1} paid: both {B/P} paid with 4 life');
    // choosing how to pay: K'rrik with 4 Mountains + 3 Swamps → all with mana
    await G.evaluate(() => { S.stk = []; S.bf = S.bf.filter(c => !/K'rrik|Mountain|Swamp/.test(cname(c))); const f = n => [...DICT.values()].find(a => a.n === n).k; for (let i = 0; i < 4; i++) S.bf.push({id:S.nid++, k:f('Mountain'), x:5 + i * 4, y:80, sk:false}); for (let i = 0; i < 3; i++) S.bf.push({id:S.nid++, k:f('Swamp'), x:25 + i * 4, y:80, sk:false}); S.life = 40; commit(); });
    await run("K'rrik, Son of Yawgmoth", {}, ['All with mana']);
    { const r = await G.evaluate(() => ({life:S.life, tapped:S.bf.filter(c => c.tap).length})); check(r.life === 40 && r.tapped === 7, `K'rrik: "All with mana" taps the three Swamps too, no life paid (${JSON.stringify(r)})`); }
    await G.evaluate(() => { S.stk = []; S.bf.forEach(c => { c.tap = false; }); S.life = 40; commit(); });
    await run("K'rrik, Son of Yawgmoth", {}, ['1 with life']);
    { const r = await G.evaluate(() => ({life:S.life, tapped:S.bf.filter(c => c.tap).length})); check(r.life === 38 && r.tapped === 6, `K'rrik: "1 with life" → 2 life and six lands (${JSON.stringify(r)})`); }
    await G.evaluate(() => { S.stk = []; S.bf.forEach(c => { c.tap = false; }); S.life = 40; commit(); });
    await put("K'rrik, Son of Yawgmoth", 'bf'); await sleep(300);
    await run('Dark Ritual', {}, ['All with mana']);
    { const r = await G.evaluate(() => ({life:S.life, sw:S.bf.filter(c => c.tap && cname(c) === 'Swamp').length})); check(r.life === 40 && r.sw === 1, `with K'rrik: Dark Ritual paid with a Swamp when I choose mana (${JSON.stringify(r)})`); }
    await G.evaluate(() => { S.stk = []; S.bf.forEach(c => { c.tap = false; }); commit(); });
    await run('Dark Ritual', {}, ['life']);
    check(await G.evaluate(() => S.life) === 38, 'with K\'rrik: Dark Ritual paid with 2 life when I choose life');
    await G.evaluate(() => { S.stk = []; S.bf = S.bf.filter(c => !/K'rrik|Swamp|Mountain/.test(cname(c))); S.life = 40; commit(); });
    await run('Gitaxian Probe', {U:1}, ['Kim', 'Done', 'All with mana']);
    check(await G.evaluate(() => S.life === 40 && S.pool.U === 0), 'Gitaxian Probe paid with {U} from the pool when I choose mana');
    await G.evaluate(() => { S.stk = []; commit(); });
    await run('Gitaxian Probe', {}, ['Kim', 'Done']);
    check(await G.evaluate(() => S.life === 38), 'with no blue mana, Gitaxian Probe just pays 2 life (no question)');
    await G.evaluate(() => { S.stk = []; commit(); });
    const oid = await put('Ulvenwald Oddity', 'bf');
    console.log('oddity menu', JSON.stringify(await G.evaluate(id => { cardMenu(id, 100, 100); return [...document.querySelectorAll('#menu button')].map(b => b.dataset.act + ':' + b.textContent.trim().slice(0, 40)).slice(0, 4); }, oid)));
    check(!(await G.evaluate(id => { cardMenu(id, 100, 100); return !!document.querySelector('#menu [data-act="flip"]'); }, oid)), 'Ulvenwald Oddity has no free Transform button (it transforms by paying {5}{G}{G})');
    check(!(await G.evaluate(id => { closeMenu(); ACT.flip({dataset:{id}}); return S.bf.find(c => c.id === id).fl; }, oid)), 'the F key does not transform it for free either');
    console.log('flip by key', JSON.stringify(await G.evaluate(id => { ACT.flip({dataset:{id}}); return S.bf.find(c => c.id === id).fl; }, oid)));
    await G.evaluate(() => { closeMenu(); UI.tokQty = 1; openModal({type:'tokens'}); }); await sleep(300);
    await G.fill('#f34name', 'Volcanic Island'); await G.click('[data-form="f34card"] button'); await sleep(1500);
    check(await G.evaluate(() => S.bf.some(c => c.tok && cname(c) === 'Volcanic Island' && manaAbs(c).length === 2)), 'a token copy of Volcanic Island (a land) from the token window');
    console.log('token', JSON.stringify(await G.evaluate(() => S.bf.filter(c => c.tok).map(c => cname(c) + ' ' + (info(c.k)?.t) + ' y=' + c.y + ' mana=' + manaAbs(c).length))));
    check(R["Kolaghan's Command"] && /\[1,2\]/.test(R["Kolaghan's Command"].stk.join()), "Kolaghan's Command: two modes picked");
    check(R['Farewell'] && /\[0,3\]/.test(R['Farewell'].stk.join()), 'Farewell: tick artifacts and creatures, untick creatures, tick graveyards → modes 1 and 4');
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); H.aedes.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
