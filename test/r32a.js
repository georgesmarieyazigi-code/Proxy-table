// "Sacrifice this land / this artifact" (new Scryfall wording): fetch lands, Lotus Petal
process.env.TOP = '1';
const CC = require('./cards');
const WANT = ['Bloodstained Mire', 'Volcanic Island', 'Lotus Petal', 'Polluted Delta', 'Steam Vents', 'Kinnan, Bonder Prodigy', 'City of Brass', 'Mana Confluence', 'Bala Ged Recovery // Bala Ged Sanctuary', 'Command Tower', 'Breeding Pool', 'Exotic Orchard', 'Yavimaya Coast', 'Llanowar Elves', 'Tropical Island', 'Bountiful Promenade', 'Spectator Seating', 'Mountain'];
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
    const G = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r32a'); await sleep(300);
    const K = await H.player(browser, 'Kim', H.deckFor('Krenko, Mob Boss'), 'join', 'r32a');
    await waitFor(G, () => OPP.size === 1, null, 30000); for (const p of [G, K]) await p.evaluate(AUTO);
    await G.click('[data-act="goFirst"]'); await settle([G, K]); await toMain(G, [G, K]);
    await G.evaluate(() => { const k = [...DICT.values()].find(a => a.n === 'Volcanic Island').k; S.lib.unshift({id:S.nid++, k}); const k2 = [...DICT.values()].find(a => a.n === 'Steam Vents').k; S.lib.push({id:S.nid++, k:k2}); commit(); });
    const mire = await putBf(G, 'Bloodstained Mire'); await sleep(300);
    const abs = await G.evaluate(id => { const c = S.bf.find(x => x.id === id); return {abs:abilityList(c).map(a => [a.cost, a.eff]), mana:(manaAbs(c) || []).length}; }, mire);
    console.log('  Mire abilities', JSON.stringify(abs));
    await G.evaluate(() => { window.__want = ['Volcanic Island', 'Steam Vents']; });
    const life0 = await G.evaluate(() => S.life);
    await G.evaluate(async id => { const c = S.bf.find(x => x.id === id); await activateAbility(c, abilityList(c)[0]); }, mire);
    await sleep(1500); await settle([G, K]); await sleep(800);
    const r = await G.evaluate(() => ({bf:S.bf.map(cname), life:S.life, gy:S.gy.map(cname).slice(-2), log:S.log.slice(-6).map(e => e.s), modal:UI.modal && UI.modal.title}));
    console.log('  after fetch', JSON.stringify(r));
    check(r.bf.includes('Volcanic Island') && !r.bf.includes('Bloodstained Mire') && r.life === life0 - 1, 'Bloodstained Mire fetches Volcanic Island (paid 1 life, Mire in the graveyard)');
    // the quick action (double-click) on a fetch land uses its ability now
    await G.evaluate(() => { const k = [...DICT.values()].find(a => a.n === 'Steam Vents').k; if (!S.lib.some(c => c.k === k)) S.lib.unshift({id:S.nid++, k}); commit(); });
    const delta = await putBf(G, 'Polluted Delta'); await sleep(300); const l1 = await G.evaluate(() => S.life);
    await G.evaluate(() => { window.__want = ['Steam Vents']; });
    await G.dblclick(`#bf [data-id="${delta}"]`); await sleep(1500); await settle([G, K]); await sleep(1500);
    const q = await G.evaluate(() => ({bf:S.bf.map(cname), life:S.life}));
    console.log('  double-click Polluted Delta:', JSON.stringify(q));
    check(!q.bf.includes('Polluted Delta') && q.bf.length >= 2 && q.life <= l1 - 1, 'double-clicking a fetch land fetches (it used to just tap it)');
    const pet = await putBf(G, 'Lotus Petal'); await sleep(300);
    const p = await G.evaluate(async id => { S.pool = emptyPool(); const c = S.bf.find(x => x.id === id); const abs = manaAbs(c) || []; if (!abs.length) return {abs:0, list:abilityList(c).map(a => [a.cost, a.eff])}; await activateMana(c, abs[0], 0); await sleep(300); return {abs:abs.length, pool:S.pool, gone:!S.bf.some(x => x.id === id), log:S.log.slice(-2).map(e => e.s)}; }, pet);
    console.log('  Lotus Petal', JSON.stringify(p));
    check(p.abs && Object.values(p.pool || {}).reduce((a, b) => a + b, 0) === 1 && p.gone, 'Lotus Petal: one mana, and it goes to the graveyard');
  } catch (e){ console.log('ERROR', e); }
  console.log(`${H.results.filter(r => /^PASS/.test(r)).length} passed, ${H.fails()} failed`);
  await browser.close(); server.close(); process.exit(0);
})();
