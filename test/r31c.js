// Underworld Breach + Lion's Eye Diamond + Brain Freeze: escape exiles different cards each round, storm grows
process.env.TOP = '1';
const CC = require('./cards');
const WANT = ['Underworld Breach', "Lion's Eye Diamond", 'Brain Freeze', 'Mountain', 'Island', 'Grizzly Bears'];
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
const toGy = (p, nm) => p.evaluate(nm => { const k = [...DICT.values()].find(a => a.n === nm).k; const c = {id:S.nid++, k}; S.gy.push(c); commit(); return c.id; }, nm);
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    const G = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r31c'); await sleep(300);
    const K = await H.player(browser, 'Kim', H.deckFor('Krenko, Mob Boss'), 'join', 'r31c');
    await waitFor(G, () => OPP.size === 1, null, 30000); for (const p of [G, K]) await p.evaluate(AUTO);
    await G.click('[data-act="goFirst"]'); await settle([G, K]); await toMain(G, [G, K]); await K.evaluate(blocker);
    const KIM = await K.evaluate(() => MYPID);
    await G.evaluate(() => { S.bf = S.bf.filter(c => !isCreatureCard(c)); commit(); });
    await ensureLand(G, 4); await putBf(G, 'Underworld Breach');
    // a graveyard to escape with: 40 cards, plus the two loop pieces
    await G.evaluate(() => { for (let i = 0; i < 40 && S.lib.length; i++) S.gy.push(S.lib.shift()); commit(); });
    await toGy(G, "Lion's Eye Diamond"); await toGy(G, 'Brain Freeze');
    const lib0 = await K.evaluate(() => S.lib.length); console.log('  Kim library', lib0);
    await G.evaluate(() => { window.__titles = []; window.__want = ['^R', 'red', 'Until every', 'Repeat it', 'Kim']; window.__num = 30; window.__f25twice = false; });
    // two rounds by hand: escape LED (exile 3), sac it for UUU, escape Brain Freeze (exile 3) at Kim
    const round = async () => {
      await G.evaluate(async () => { const c = S.gy.find(x => cname(x) === "Lion's Eye Diamond"); const g = gyOptions(c).find(o => /escape/i.test(o.label || o.kind || JSON.stringify(o))); await castFromGy(c, g); });
      await settle([G, K]); await waitFor(G, () => S.bf.some(x => cname(x) === "Lion's Eye Diamond"), null, 10000);
      await G.evaluate(async () => { const c = S.bf.find(x => cname(x) === "Lion's Eye Diamond"); await activateMana(c, manaAbs(c)[0], 1); });
      await sleep(300);
      await G.evaluate(async () => { const c = S.gy.find(x => cname(x) === 'Brain Freeze'); const g = gyOptions(c).find(o => /escape/i.test(o.label || o.kind || JSON.stringify(o))); await castFromGy(c, g); });
      await settle([G, K]); await sleep(400);
    };
    console.log('  gy options for LED:', await G.evaluate(() => JSON.stringify(gyOptions(S.gy.find(x => cname(x) === "Lion's Eye Diamond")).map(o => o.label || o.kind))));
    await round(); console.log('  after round 1: Kim library', await K.evaluate(() => S.lib.length), 'G pool', JSON.stringify(await G.evaluate(() => S.pool)), 'gy', await G.evaluate(() => S.gy.length));
    await round(); console.log('  after round 2: Kim library', await K.evaluate(() => S.lib.length), 'gy', await G.evaluate(() => S.gy.length));
    for (let i = 0; i < 160; i++){ await sleep(500); const lg = await G.evaluate(() => S.log.slice(-3).map(e => e.s).join(' | ')); if (/repeated the loop/.test(lg)) break; await passAll([G, K]); }
    await sleep(1500);
    const r = await G.evaluate(() => ({titles:(window.__titles || []).filter(t => /loop/i.test(t)), log:S.log.slice(-60).map(e => e.s).filter(s => /loop|escape|stopped|mills/i.test(s)).slice(-10), gy:S.gy.length, led:find(([...S.gy, ...S.bf, ...S.ex, ...S.hand].find(x => cname(x) === "Lion's Eye Diamond") || {}).id)[0], bfz:find(([...S.gy, ...S.bf, ...S.ex, ...S.hand].find(x => cname(x) === 'Brain Freeze') || {}).id)[0], stk:stackAll().map(i => i.nm), pool:S.pool, hand:S.hand.length}));
    const kl = await K.evaluate(() => S.lib.length);
    console.log('  BREACH:', JSON.stringify(r, null, 1).slice(0, 2500), 'Kim library', lib0, '→', kl);
    check(r.titles.length >= 1, 'the table spotted the Breach loop');
    check(kl < lib0 - 100, `the repeat milled Kim a lot (${lib0} → ${kl})`);
    check(r.log.some(s => /stopped: not enough other cards in your graveyard/.test(s)), 'it stopped with the reason: no spare graveyard cards to exile');
    check(!r.log.some(s => /repeated the loop 1 time$/.test(s)), 'no per-round noise in the log');
  } catch (e){ console.log('ERROR', e); }
  console.log(`${H.results.filter(r => /^PASS/.test(r)).length} passed, ${H.fails()} failed`);
  await browser.close(); server.close(); process.exit(0);
})();
