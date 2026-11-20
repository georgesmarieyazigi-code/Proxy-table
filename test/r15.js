process.env.TOP = '1';
const CC = require('./cards'); const WANT = ['Etali, Primal Conqueror // Etali, Primal Sickness', 'Mystic Remora', 'Rhystic Study', 'Beast Within', 'Gray Merchant of Asphodel', 'Propaganda', 'Seedborn Muse', 'Blood Moon', 'Urborg, Tomb of Yawgmoth'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name)));
// Round 9: the real Oracle text of the top commanders, played for real
const H = require('./h'); const {check, sleep, give, put, setPool, handId, menuClick, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
// answer any question the game asks: picks the cards/options whose name matches `want`, else the first legal ones; “yes” by default
const AUTO = () => { window.__want = window.__want || null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ /* targets are answered by the test */ }
    else if (m.run){ m.__done = 1; const d = m.def ?? 1; m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (A, ps) => { for (let i = 0; i < 30; i++){ await passAll(ps); if (!(await A.evaluate(() => stackAll().length || UI.resolving))) return; await sleep(150); } };
const keyOf = (p, name) => p.evaluate(n => [...DICT.values()].find(a => a.n === n || a.n.startsWith(n + ' //'))?.k, name);
// run a card's text the way a resolving trigger would
const fx = (p, name, text, extra = {}) => p.evaluate(async ([n, t, ex]) => { const c = S.bf.find(x => cname(x) === n) || S.cz.find(x => cname(x) === n); const k = c ? c.k : [...DICT.values()].find(a => a.n === n)?.k;
  const it = {sid:rid(6), kind:'trigger', k, nm:n, txt:t, srcId:c ? c.id : null, ...ex}; await runEffects(t, {name:n, k, srcId:it.srcId, it, full:t}); commit(); }, [name, text, extra]);
let PA = null; const step = async (name, fn) => { console.log('— ' + name); const f0 = H.fails(); try { await fn(); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); } if (H.fails() > f0 && PA) console.log('    LOG:', (await PA.evaluate(() => S.log.slice(-10).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r12');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r12');
  PA = A; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle(A, [B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const hand = p => p.evaluate(() => S.hand.length); const life = p => p.evaluate(() => S.life);
  const clean = async () => { await A.evaluate(() => { S.bf.filter(c => !isLand(c.k)).forEach(c => { if (c.tok || c.emb) S.bf.splice(S.bf.indexOf(c), 1); else moveCard(c.id, 'lib'); }); S.stk = []; commit(); }); await sleep(300); };
  const modals = [];
  for (const p of [A, B]) await p.evaluate(() => { const om = openModal; openModal = m => { (window.__modals = window.__modals || []).push(m.title || m.type); return om(m); }; });
  const combat = async (blocker) => {
    await A.click('#phasebar [data-act="next"]').catch(() => {}); await waitFor(A, () => phaseNow().ph === 4, null, 8000); await passAll([B]);
    if (!(await A.evaluate(() => S.cb && S.cb.step === 'atk'))) await A.evaluate(() => nextAction());
    await waitFor(A, () => S.cb && S.cb.step === 'atk', null, 8000);
    await A.evaluate(() => { const e = S.bf.find(c => /Etali/.test(cname(c))); e.sk = false; UI.atkSel = {[e.id]:'p:' + opponents()[0].pid}; renderCombatPanel(); });
    await A.click('#cbpanel [data-act="atkGo"]'); await passAll([B]);
    await waitFor(B, () => !!document.querySelector('#cbpanel [data-act="blkGo"]'), null, 8000);
    if (blocker) await B.evaluate(n => { const pn = phaseNow(); const a = attackersOnMe(pn)[0]; const b = S.bf.find(c => cname(c) === n); UI.blkSel[b.id] = a.id; renderCombatPanel(); }, blocker);
    await B.click('#cbpanel [data-act="blkGo"]');
    for (let i = 0; i < 10; i++){ await passAll([B]); if (await A.evaluate(() => phaseNow().ph === 5)) break; }
    await sleep(1500); await passAll([B]); await sleep(800);
  };
  try {
    await step('Etali, Primal Sickness unblocked: Kim gets 11 poison automatically, no prompt', async () => {
      await A.evaluate(() => { window.__want = "^(Don't|No)"; });   // decline Etali's free casts: this test is about its poison
      await put(A, 'Etali, Primal Conqueror'); await sleep(2500); await settle(A, [B]); await A.evaluate(() => { window.__want = null; }); await A.evaluate(() => { const e = S.bf.find(c => /Etali/.test(cname(c))); e.fl = true; e.sk = false; TRIG_CACHE.clear(); window.__modals = []; commit(); });
      await B.evaluate(() => { window.__modals = []; });
      await combat(null);
      const r = await B.evaluate(() => [S.psn, S.life, window.__modals]); const am = await A.evaluate(() => window.__modals);
      console.log('    Kim poison/life', r[0], r[1], '| modals A', JSON.stringify(am), 'B', JSON.stringify(r[2]));
      check(r[0] === 11, `Kim has 11 poison counters (${r[0]})`);
      check(!am.concat(r[2]).some(t => /poison|by hand/i.test(String(t))), 'no poison prompt for either player');
    });
    await step('Etali blocked by a 2/2: trample → 9 to Kim → 9 more poison; nothing on the blocker', async () => {
      
      // Kim lost the 2-player game to 11 poison in the first scenario: take that back (fresh game state for this one).
      await B.evaluate(() => { S.psn = 0; S.lost = ''; commit(); }); await sleep(400);
      // A fresh turn for Georges, deterministically: Georges passes the turn, Kim passes it back, then Georges goes to HIS main phase.
      // (The old loop called nextAction from Georges's second main phase, which ran his turn out; Kim's own passes then moved HER turn on,
      //  and the loop stopped at phase 3 of Kim's turn whenever her client got there first — that was the flake.)
      if (await A.evaluate(() => currentTurn()[1] === MYPID)){ await A.evaluate(() => { S.stk = []; passTurn(); }); await waitFor(B, () => currentTurn()[1] === MYPID, null, 8000); }
      if (await B.evaluate(() => currentTurn()[1] === MYPID)){ await B.evaluate(() => { S.stk = []; passTurn(); }); await waitFor(A, () => currentTurn()[1] === MYPID, null, 8000); }
      for (let i = 0; i < 40; i++){ if (await A.evaluate(() => phaseNow().mine && phaseNow().ph === 3 && !stackAll().length)) break; await A.evaluate(() => { if (phaseNow().mine && !stackAll().length && !UI.modal) nextAction(); }); await passAll([B]); await sleep(250); }
      check(await A.evaluate(() => phaseNow().mine && phaseNow().ph === 3), "Georges is in his own main phase before the second attack");
      const p0 = await B.evaluate(() => S.psn);
      await put(B, 'Grizzly Bears'); await sleep(500);
      await A.evaluate(() => { const e = S.bf.find(c => /Etali/.test(cname(c))); e.tap = false; e.atk = ''; window.__modals = []; commit(); });
      await combat('Grizzly Bears');
      const r = await B.evaluate(() => [S.psn, S.gy.map(cname), window.__modals]);
      console.log('    Kim poison', r[0], 'gy', r[1], 'modals', JSON.stringify(r[2]), '| A modals', JSON.stringify(await A.evaluate(() => window.__modals)));
      check(r[0] - p0 === 9, `only the trample damage to Kim became poison (+${r[0] - p0})`);
      check(r[1].includes('Grizzly Bears'), 'the blocker took normal damage and died');
    });
    await step('Mystic Remora: cumulative upkeep {1}, then {2}', async () => {
      await put(A, 'Mystic Remora'); await A.evaluate(() => { S.pool = {...emptyPool(), C:1}; window.__want = 'Yes|Pay'; commit(); });
      await A.evaluate(() => fireSteps('upkeep', MYPID)); await settle(A, [B]); await sleep(800);
      const r1 = await A.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Mystic Remora'); return [!!c, c && (c.nc || {}).age, S.pool.C || 0]; });
      check(r1[0] && r1[1] === 1 && r1[2] === 0, 'first upkeep: 1 age counter, paid {1}, Remora stays ' + JSON.stringify(r1));
      await A.evaluate(() => { S.pool = emptyPool(); commit(); });
      await A.evaluate(() => fireSteps('upkeep', MYPID)); await settle(A, [B]); await sleep(800);
      const r2 = await A.evaluate(() => [S.bf.some(c => cname(c) === 'Mystic Remora'), S.gy.some(c => cname(c) === 'Mystic Remora')]);
      check(!r2[0] && r2[1], 'second upkeep with no mana for {2}: Remora is sacrificed');
      await A.evaluate(() => { window.__want = null; });
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
