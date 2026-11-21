// Caesar, Legion's Emperor: "Whenever you attack, you may sacrifice another creature. When you do, choose two — …"
process.env.TOP = '1';
const CC = require('./cards');
const WANT = ["Caesar, Legion's Emperor", 'Grizzly Bears', 'Llanowar Elves', 'Plains', 'Mountain', 'Swamp'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, waitFor} = H;
const AUTO = () => { setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want || [];
  try { (window.__titles = window.__titles || []).push((m.title || '') + ' :: ' + (m.options || []).map(o => o.label).join(' / '));
    if (m.type === 'pick' && m.resolve){ const pref = (m.cards || []).filter(c => /Bears/.test(cname(c))); const n = Math.max(m.min || 0, m.max ? 1 : 0); const ids = (pref.length ? pref : (m.cards || [])).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = w.map(r => (m.options || []).find(x => !x.disabled && new RegExp(r, 'i').test(x.label))).find(Boolean) || (m.options || []).find(x => !x.disabled); m.__done = 1; m.resolve(o ? o.value : null); closeModal(); }
    else if (m.type === 'modes' && m.resolve){ m.__done = 1; m.resolve(window.__modes || [0, 2]); closeModal(); }
    else if (m.type === 'target' && m.resolve){ const i = (m.cands || []).findIndex(c => c.ok && c.pid !== MYPID); m.__done = 1; m.resolve(i >= 0 ? [m.cands[i]] : []); closeModal(); }
    else if (m.run){ m.__done = 1; m.run(m.def ?? 1); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const toMain = async (p, ps) => { for (let i = 0; i < 50; i++){ if (await p.evaluate(() => phaseNow().mine && phaseNow().ph === 3)) return true; await p.evaluate(() => { if (!stackAll().length && !UI.modal && phaseNow().mine) nextAction(); }); await passAll(ps); } return false; };
const putBf = (p, nm, extra) => p.evaluate(([nm, extra]) => { const k = [...DICT.values()].find(a => a.n === nm).k; const c = {id:S.nid++, k, x:20 + (S.nid % 30) * 3, y:30, sk:false, ...(extra || {})}; S.bf.push(c); commit(); return c.id; }, [nm, extra]);
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    const G = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r30c'); await sleep(300);
    const K = await H.player(browser, 'Kim', H.deckFor('Krenko, Mob Boss'), 'join', 'r30c');
    await waitFor(G, () => OPP.size === 1, null, 30000); for (const p of [G, K]) await p.evaluate(AUTO);
    await G.click('[data-act="goFirst"]'); await settle([G, K]); await toMain(G, [G, K]);
    const KIM = await K.evaluate(() => MYPID);
    for (const [modes, label] of [[[0, 2], 'tokens + damage'], [[0, 1], 'tokens + draw']]){
      const cz = await putBf(G, "Caesar, Legion's Emperor"); await putBf(G, 'Grizzly Bears'); await putBf(G, 'Llanowar Elves'); await sleep(600);
      const k0 = await K.evaluate(() => S.life), h0 = await G.evaluate(() => [S.hand.length, S.life]);
      await G.evaluate(m => { window.__titles = []; window.__want = m.includes(2) ? ['^yes', 'Create two', 'deals damage'] : ['^yes', 'Create two', 'You draw']; window.__modes = m; }, modes);
      await G.evaluate(() => setPhase(4));
      for (let i = 0; i < 30 && !(await G.evaluate(() => S.cb && S.cb.step === 'atk')); i++){ await passAll([G, K]); await G.evaluate(() => { if (S.cb && S.cb.step !== 'atk' && !stackAll().length) nextAction(); }); await sleep(200); }
      await G.evaluate(([c, k]) => { UI.atkSel = {[c]:'p:' + k}; renderCombatPanel(); }, [cz, KIM]); await G.click('#cbpanel [data-act="atkGo"]');
      await sleep(1500); await settle([G, K]); await sleep(1500);
      const r = await G.evaluate(() => ({bf:S.bf.filter(c => !isLand(c.k)).map(c => cname(c) + (c.atk ? '(atk)' : '') + (c.tap ? '(T)' : '') + ((c.n || 1) > 1 ? 'x' + c.n : '')), hand:S.hand.length, life:S.life, gy:S.gy.map(cname), log:S.log.slice(-14).map(e => e.s), titles:window.__titles}));
      const k1 = await K.evaluate(() => S.life);
      console.log(label, JSON.stringify(r, null, 1), 'Kim', k0, '→', k1);
      check(r.gy.includes('Grizzly Bears') || r.gy.includes('Llanowar Elves'), `${label}: a creature was sacrificed`);
      const toks = r.bf.filter(s => /Soldier/.test(s));
      check(toks.length && toks.every(s => /\(atk\)/.test(s) && /\(T\)/.test(s)), `${label}: two Soldier tokens tapped and attacking (${toks.join(', ')})`);
      if (modes.includes(2)) check(k1 <= k0 - 2, `${label}: Caesar dealt damage equal to the tokens (Kim ${k0} → ${k1})`);
      if (modes.includes(1)) check(r.hand === h0[0] + 1 && r.life === h0[1] - 1, `${label}: drew a card and lost 1 life`);
      await G.evaluate(() => { S.bf = S.bf.filter(c => isLand(c.k)); S.gy = []; commit(); }); 
      for (let i = 0; i < 60; i++){ if (await G.evaluate(() => phaseNow().mine && phaseNow().ph === 3 )) break; await G.evaluate(() => { if (!stackAll().length && !UI.modal) nextAction(); }); await passAll([G, K]); await K.evaluate(() => { if (!stackAll().length && !UI.modal && phaseNow().mine) nextAction(); }); }
    }
  } catch (e){ console.log('ERROR', e); }
  console.log(`${H.results.filter(r => /^PASS/.test(r)).length} passed, ${H.fails()} failed`); await browser.close(); server.close(); process.exit(0);
})();
