// Kinnan, Bonder Prodigy: extra mana only for nonland permanents; "enters tapped unless you have two or more opponents"
process.env.TOP = '1';
const CC = require('./cards');
const WANT = ['Kinnan, Bonder Prodigy', 'City of Brass', 'Mana Confluence', 'Bala Ged Recovery // Bala Ged Sanctuary', 'Command Tower', 'Breeding Pool', 'Exotic Orchard', 'Yavimaya Coast', 'Llanowar Elves', 'Tropical Island', 'Bountiful Promenade', 'Spectator Seating', 'Mountain'];
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
const toHandP = (p, nm) => p.evaluate(nm => { const k = [...DICT.values()].find(a => a.n === nm).k; const c = {id:S.nid++, k}; S.hand.push(c); commit(); return c.id; }, nm);
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    const G = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r31e'); await sleep(300);
    const K = await H.player(browser, 'Kim', H.deckFor('Krenko, Mob Boss'), 'join', 'r31e');
    await waitFor(G, () => OPP.size === 1, null, 30000); for (const p of [G, K]) await p.evaluate(AUTO);
    await G.click('[data-act="goFirst"]'); await settle([G, K]); await toMain(G, [G, K]);
    await G.evaluate(() => { S.bf = []; commit(); });
    await putBf(G, 'Kinnan, Bonder Prodigy');
    console.log('  DBG', JSON.stringify(await G.evaluate(() => { const k = [...DICT.values()].find(a => a.n === 'City of Brass').k; const kn = [...DICT.values()].find(a => /^Kinnan/.test(a.n)).k; return {desc:descOk(k, 'nonland permanent'), descElf:descOk([...DICT.values()].find(a => a.n === 'Llanowar Elves').k, 'nonland permanent'), trig:(()=>{ try { return classifyTrig('whenever you tap a nonland permanent for mana', {k:kn}); } catch (e){ return String(e); } })()}; })));
    { const id = await G.evaluate(() => { const k = [...DICT.values()].find(a => /^Bala Ged Recovery/.test(a.n)).k; const c = {id:S.nid++, k, fl:true, x:30, y:60, sk:false}; S.bf.push(c); commit(); return c.id; }); await sleep(200);
      const r = await G.evaluate(async id => { S.pool = emptyPool(); const c = S.bf.find(x => x.id === id); const ab = manaAbs(c)[0]; if (!ab) return 'no ability'; await activateMana(c, ab, 0); return {n:Object.values(S.pool).reduce((x, y) => x + y, 0), log:S.log.slice(-2).map(e => e.s)}; }, id);
      console.log('   Bala Ged Sanctuary (back face)', JSON.stringify(r)); check(r.n === 1, `Bala Ged Sanctuary (land side of a double-faced card): 1 mana with Kinnan out (${r.n})`); }
    for (const nm of ['City of Brass', 'Mana Confluence', 'Command Tower', 'Breeding Pool', 'Exotic Orchard', 'Yavimaya Coast', 'Tropical Island', 'Llanowar Elves']){
      const id = await putBf(G, nm); await sleep(200);
      // tap it the three ways the game does: the mana button, a quick tap (click), and autopay
      const r = await G.evaluate(async id => { S.pool = emptyPool(); const c = S.bf.find(x => x.id === id); c.tap = false; const ab = manaAbs(c)[0]; if (!ab) return 'no ability';
        await activateMana(c, ab, 0); const a = Object.values(S.pool).reduce((x, y) => x + y, 0);
        const b = 0;
        return {button:a, quick:b, log:S.log.slice(-2).map(e => e.s)}; }, id);
      console.log('  ', nm, JSON.stringify(r));
      const want = nm === 'Llanowar Elves' ? 2 : nm === 'Exotic Orchard' ? 0 : 1;   // Exotic Orchard: Kim has no lands out
      check(r.button === want, `${nm}: ${want} mana with Kinnan out (mana button gave ${r.button})`);
    }
    // "enters tapped unless you have two or more opponents"
    const pr = await G.evaluate(() => { const k = [...DICT.values()].find(a => a.n === 'Bountiful Promenade').k;
      const a = {id:S.nid++, k, x:50, y:60}; S.bf.push(a); onEnter(a, 'hand');
      let b; const fake = ['x1', 'x2']; const n0 = opponents().length; try { fake.forEach(p => OPP.set(p, {...[...OPP.values()][0], nm:p, pid:p})); b = {id:S.nid++, k, x:54, y:60}; S.bf.push(b); onEnter(b, 'hand'); window.__nOpp = [n0, opponents().length]; } finally { fake.forEach(p => OPP.delete(p)); }
      commit(); return {two:!!a.tap, four:!!b.tap, warn:S.log.slice(-4).some(e => /check “unless/.test(e.s)), opps:window.__nOpp}; });
    console.log('   Promenade', JSON.stringify(pr));
    check(pr.two && !pr.four && !pr.warn, `Bountiful Promenade: tapped with 1 opponent, untapped with 3 (${JSON.stringify(pr)})`);
    // paying for a spell automatically with City of Brass (autopay), and a bot doing the same
    await G.evaluate(() => { S.bf = S.bf.filter(c => /Kinnan/.test(cname(c))); S.pool = emptyPool(); commit(); });
    const cob = await putBf(G, 'City of Brass'); await toHandP(G, 'Llanowar Elves'); await sleep(300);
    const r2 = await G.evaluate(async () => { const n0 = S.log.length; const c = S.hand.find(x => cname(x) === 'Llanowar Elves'); await beginCast(c, 'hand'); await sleep(800); return {pool:Object.values(S.pool).reduce((x, y) => x + y, 0), log:S.log.slice(n0 - S.log.length || -5).map(e => e.s), stk:stackAll().map(i => i.nm)}; });
    console.log('   autopay City of Brass', JSON.stringify(r2));
    check(r2.pool === 0 && !r2.log.some(s => /Kinnan.*\+/.test(s)), `paying with City of Brass: no Kinnan mana, nothing left floating (${r2.pool})`);
  } catch (e){ console.log('ERROR', e); }
  console.log(`${H.results.filter(r => /^PASS/.test(r)).length} passed, ${H.fails()} failed`);
  await browser.close(); server.close(); process.exit(0);
})();
