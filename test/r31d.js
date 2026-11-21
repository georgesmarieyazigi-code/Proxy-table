// Reiterate (buyback) + Jeska's Will: a spell held on the stack, copied again and again
process.env.TOP = '1';
const CC = require('./cards');
const WANT = ['Reiterate', "Jeska's Will", 'Mountain'];
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
const toHand = (p, nm) => p.evaluate(nm => { const k = [...DICT.values()].find(a => a.n === nm).k; const c = {id:S.nid++, k}; S.hand.push(c); commit(); return c.id; }, nm);
// pass priority only until the stack is down to `depth` items (the player holds Jeska's Will on the stack)
const passTo = async (G, K, depth) => { const c0 = await G.evaluate(() => S.log.filter(e => /\(copy\) resolved/.test(e.s)).length); for (let i = 0; i < 80; i++){ if (await G.evaluate(c0 => S.log.filter(e => /\(copy\) resolved/.test(e.s)).length > c0 && stackAll().length <= 1 && !UI.resolving, c0)) return true; if (i % 15 === 5) console.log('      passTo', i, JSON.stringify(await G.evaluate(() => ({stk:stackAll().map(x => x.nm + ':' + (x.pid === MYPID ? 'me' : 'kim')), key:prioKey(), pass:S.pass, box:!!myBox(), res:!!UI.resolving, modal:UI.modal && [UI.modal.type, UI.modal.title]}))), 'K', JSON.stringify(await K.evaluate(() => ({key:prioKey(), pass:S.pass, box:!!myBox(), modal:UI.modal && UI.modal.title})))); await K.evaluate(() => { if (myBox()) doPass(); }); await G.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } return false; };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    const G = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r31d'); await sleep(300);
    const K = await H.player(browser, 'Kim', H.deckFor('Krenko, Mob Boss'), 'join', 'r31d');
    await waitFor(G, () => OPP.size === 1, null, 30000); for (const p of [G, K]) await p.evaluate(AUTO);
    await G.click('[data-act="goFirst"]'); await settle([G, K]); await toMain(G, [G, K]);
    await G.evaluate(() => { S.bf = S.bf.filter(c => !isCreatureCard(c)); const cm = S.cz[0]; if (cm){ S.cz.splice(0, 1); S.bf.push({...cm, sk:false}); } commit(); });   // control your commander (Jeska's Will: both modes)
    await ensureLand(G, 9); await toHand(G, "Jeska's Will"); await toHand(G, 'Reiterate');
    await K.evaluate(() => { for (let i = 0; i < 3 && S.lib.length; i++) S.hand.push(S.lib.shift()); commit(); });
    console.log('  Kim hand', await K.evaluate(() => S.hand.length));
    await G.evaluate(() => { window.__titles = []; window.__want = ['^Add \\{R\\}', 'Repeat it', '^yes', 'buyback', 'Kim', '^no']; window.__num = 5; window.__f25twice = true; });
    await G.evaluate(() => { const c = S.hand.find(x => cname(x) === "Jeska's Will"); return beginCast(c, 'hand'); }); await sleep(800);
    console.log('  stack:', JSON.stringify(await G.evaluate(() => stackAll().map(i => i.nm))), 'pool', JSON.stringify(await G.evaluate(() => S.pool)));
    const pool = () => G.evaluate(() => Object.values(S.pool).reduce((a, b) => a + b, 0));
    for (let r = 1; r <= 2; r++){
      await G.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Reiterate'); return beginCast(c, 'hand'); }); await sleep(800);
      console.log('  round', r, 'stack:', JSON.stringify(await G.evaluate(() => stackAll().map(i => i.nm))));
      await passTo(G, K, 1); await sleep(500);
      console.log('    after: stack', JSON.stringify(await G.evaluate(() => stackAll().map(i => i.nm))), 'pool', await pool(), 'Reiterate in hand', await G.evaluate(() => S.hand.some(x => cname(x) === 'Reiterate')));
    }
    for (let i = 0; i < 8; i++){ await sleep(300); console.log('      hold', i, JSON.stringify(await G.evaluate(() => ({stk:stackAll().map(x => x.nm), key:prioKey(), pass:S.pass, held:UI.f31held, quiet:f25quiet(), sh:F25.sh.length, lastSd:F25.sh.length && F25.sh[F25.sh.length - 1].a.sd, hit:!!f25find(), hold:F31C.hold, sh2:F25.sh.slice(-3).map(e => [e.a.t, info(e.a.k)?.n, e.a.zone, e.a.sd, e.pool, e.T, e.sig === f25sig()]), box:UI.box && UI.box.hold, T:turnStr(), log:S.log.slice(-1)[0].s}))), 'K pass', await K.evaluate(() => S.pass)); }
    for (let i = 0; i < 60; i++){ await sleep(500); const lg = await G.evaluate(() => S.log.slice(-3).map(e => e.s).join(' | ')); if (/repeated the loop/.test(lg)) break; }
    await sleep(800);
    const r = await G.evaluate(() => ({titles:(window.__titles || []).filter(t => /loop/i.test(t)), log:S.log.slice(-30).map(e => e.s).filter(s => /loop|Reiterate|copy|add/i.test(s)).slice(-8), stk:stackAll().map(i => i.nm)}));
    const p1 = await pool();
    console.log('  REITERATE:', JSON.stringify(r, null, 1).slice(0, 2000), 'pool', p1);
    check(r.titles.length >= 1, 'the table spotted the Reiterate loop');
    check(r.log.some(s => /repeated the loop 5 times$/.test(s)), 'it repeated 5 times');
    check(r.stk.includes("Jeska's Will"), "Jeska's Will is still on the stack afterwards");
  } catch (e){ console.log('ERROR', e); }
  console.log(`${H.results.filter(r => /^PASS/.test(r)).length} passed, ${H.fails()} failed`);
  await browser.close(); server.close(); process.exit(0);
})();
