// Commander recast loop: Krenko, Mob Boss + Skirk Prospector + Goblin Warchief
process.env.TOP = '1';
const CC = require('./cards');
const WANT = ['Krenko, Mob Boss', 'Skirk Prospector', 'Goblin Warchief', 'Mountain'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, waitFor} = H;
const AUTO = () => { setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want || [];
  try { (window.__titles = window.__titles || []).push((m.title || '') + ' :: ' + (m.options || []).map(o => o.label).join(' / '));
    if (m.type === 'pick' && m.resolve){ const pref = (m.cards || []).filter(c => /Bears/.test(cname(c))); const n = Math.max(m.min || 0, m.max ? 1 : 0); const ids = (pref.length ? pref : (m.cards || [])).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = w.map(r => (m.options || []).find(x => !x.disabled && new RegExp(r, 'i').test(x.label))).find(Boolean) || (m.options || []).find(x => !x.disabled); m.__done = 1; m.resolve(o ? o.value : null); closeModal(); }
    else if (m.type === 'modes' && m.resolve){ m.__done = 1; m.resolve(window.__modes || [0, 2]); closeModal(); }
    else if (m.type === 'target' && m.resolve){ const i = (m.cands || []).findIndex(c => c.ok && c.pid !== MYPID); m.__done = 1; m.resolve(i >= 0 ? [m.cands[i]] : []); closeModal(); }
    else if (m.run){ m.__done = 1; m.run(window.__num || m.def || 1); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const toMain = async (p, ps) => { for (let i = 0; i < 50; i++){ if (await p.evaluate(() => phaseNow().mine && phaseNow().ph === 3)) return true; await p.evaluate(() => { if (!stackAll().length && !UI.modal && phaseNow().mine) nextAction(); }); await passAll(ps); } return false; };
const putBf = (p, nm, extra) => p.evaluate(([nm, extra]) => { const k = [...DICT.values()].find(a => a.n === nm).k; const c = {id:S.nid++, k, x:20 + (S.nid % 30) * 3, y:30, sk:false, ...(extra || {})}; S.bf.push(c); commit(); return c.id; }, [nm, extra]);
const ensureLand = (p, n) => p.evaluate(n => { const k = [...DICT.values()].find(a => a.n === 'Mountain').k; const have = S.bf.filter(c => cname(c) === 'Mountain').length; for (let i = have; i < n; i++) S.bf.push({id:S.nid++, k, x:5 + i * 4, y:60, sk:false}); S.bf.forEach(c => { if (cname(c) === 'Mountain') c.tap = false; }); commit(); }, n);
const toAtk = async (G, K) => { await G.evaluate(() => setPhase(4)); for (let i = 0; i < 40 && !(await G.evaluate(() => S.cb && S.cb.step === 'atk')); i++){ await passAll([G, K]); await G.evaluate(() => { if (S.cb && S.cb.step !== 'atk' && !stackAll().length) nextAction(); }); await sleep(150); } };
const blocker = () => setInterval(() => { try { const b = document.querySelector('#cbpanel [data-act="blkGo"]'); if (b) b.click(); if (myBox() && !UI.modal) doPass(); } catch {} }, 300);
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    const G = await H.player(browser, 'Georges', H.deckFor('Krenko, Mob Boss'), 'host', 'r31b'); await sleep(300);
    const K = await H.player(browser, 'Kim', H.deckFor('Edgar Markov'), 'join', 'r31b');
    await waitFor(G, () => OPP.size === 1, null, 30000); for (const p of [G, K]) await p.evaluate(AUTO);
    await G.click('[data-act="goFirst"]'); await settle([G, K]); await toMain(G, [G, K]); await K.evaluate(blocker);
    await G.evaluate(() => { S.bf = S.bf.filter(c => !isCreatureCard(c)); commit(); });
    await ensureLand(G, 5); await putBf(G, 'Skirk Prospector'); await putBf(G, 'Goblin Warchief');
    await G.evaluate(() => { const k = [...DICT.values()].find(a => /Token/.test(a.t || '') && /Goblin/.test(a.n)).k; S.bf.push({id:S.nid++, k, tok:true, n:8, sk:false, x:40, y:40}); commit(); });
    const kr = await G.evaluate(() => { const c = S.cz.find(x => cname(x) === 'Krenko, Mob Boss'); return c ? c.id : null; });
    console.log('  Krenko in command zone:', kr);
    await G.evaluate(() => { window.__titles = []; window.__want = ['^Command zone', 'A number of rounds']; window.__num = 3; });
    // round 1 by hand: cast Krenko (3 mana: {2}{R}{R} − 1 for Warchief)
    const cast = () => G.evaluate(() => { const c = S.cz.find(x => cname(x) === 'Krenko, Mob Boss'); return beginCast(c, 'cz'); });
    await cast(); await settle([G, K]); await sleep(500);
    // tap Krenko, sacrifice tokens + Krenko to Prospector, recast (by hand, as the player would)
    await G.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Krenko, Mob Boss'); const ab = abilityList(c).find(a => /create x/i.test(a.eff)); await activateAbility(c, ab); });
    await settle([G, K]); await sleep(500);
    const toks1 = await G.evaluate(() => S.bf.filter(c => c.tok).reduce((x, c) => x + (c.n || 1), 0)); console.log('  tokens after the first tap:', toks1);
    await G.evaluate(async () => { UI.cmdz = true; const o = S.bf.find(x => cname(x) === 'Skirk Prospector'); const ab = manaAbs(o)[0];
      for (const id of [S.bf.find(x => x.tok).id, S.bf.find(x => cname(x) === 'Krenko, Mob Boss').id]){ UI.replay = {ans:[[id]]}; await activateMana(o, ab, 0); UI.replay = null; await sleep(100); } UI.cmdz = false; });
    await sleep(500); console.log('  pool before the 2nd cast:', JSON.stringify(await G.evaluate(() => S.pool)), 'Krenko in cz:', await G.evaluate(() => S.cz.some(x => cname(x) === 'Krenko, Mob Boss')));
    await G.evaluate(() => { S.bf.forEach(c => { if (cname(c) === 'Mountain') c.tap = false; }); commit(); });
    await cast(); await settle([G, K]);
    for (let i = 0; i < 120; i++){ await sleep(500); const lg = await G.evaluate(() => S.log.slice(-1)[0]?.s || ''); if (/loop: went round/.test(lg)) break; await passAll([G, K]); }
    await sleep(1000);
    const r = await G.evaluate(() => ({titles:(window.__titles || []).filter(t => /Krenko, Mob Boss loop/.test(t)).length, tax:S.tax[S.cz.concat(S.bf).find(x => cname(x) === 'Krenko, Mob Boss')?.k], toks:S.bf.filter(c => c.tok).reduce((x, c) => x + (c.n || 1), 0), onBf:S.bf.some(x => cname(x) === 'Krenko, Mob Boss'), log:S.log.slice(-40).map(e => e.s).filter(s => /loop|commander zone|command zone|created/.test(s)).slice(-12)}));
    console.log('  K:', JSON.stringify(r, null, 1));
    check(r.titles === 1, 'the table offered the Krenko loop after the 2nd cast from the command zone');
    check(r.tax === 5, `three more rounds: commander tax went 2 → 5 (tax ${r.tax})`);
    check(r.toks >= 40, `the rounds made lots of goblins (${r.toks} tokens)`);
    check(r.log.some(s => /went round 3 times/.test(s)), 'the loop went round 3 times');
  } catch (e){ console.log('ERROR', e); }
  console.log(`${H.results.filter(r => /^PASS/.test(r)).length} passed, ${H.fails()} failed`);
  await browser.close(); server.close(); process.exit(0);
})();
