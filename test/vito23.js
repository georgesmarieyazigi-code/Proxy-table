// vito23: Vito + Bloodthirsty Conqueror loop in a 3-player game — the loop must run to the end (opponents at 0), not stall
process.env.TOP = '1'; const CC = require('./cards'); const WANT = ['Vito, Thorn of the Dusk Rose', 'Bloodthirsty Conqueror', 'Edgar Markov'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {sleep, waitFor} = H;
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', "Commander\n1 Edgar Markov\n\nDeck\n1 Vito, Thorn of the Dusk Rose\n1 Bloodthirsty Conqueror\n40 Swamp\n", 'host', 'vito23');
  const B = await H.player(browser, 'Kim', 'Commander\n1 Edgar Markov\n\nDeck\n60 Swamp\n', 'join', 'vito23');
  const C = await H.player(browser, 'Cy', 'Commander\n1 Edgar Markov\n\nDeck\n60 Swamp\n', 'join', 'vito23');
  await waitFor(A, () => OPP.size === 2, null, 30000); await A.click('[data-act="goFirst"]'); await sleep(3000);
  for (const p of [A, B, C]) await p.evaluate(() => { window.askChoice = async o => { const v = o.options.find(x => x.value !== 'none'); return v ? v.value : null; }; window.askYes = async () => true;
    setInterval(() => { try { const m = UI.modal; if (m && m.type === 'target'){ const ok = (m.cands || []).map((c, i) => [c, i]).filter(([c]) => c.ok).map(([, i]) => i); m.sel = ok.slice(0, (m.spec || {n:1}).n); renderModal(); const d = document.querySelector('#modal [data-act="tgtDone"]'); if (d && !d.disabled) d.click(); return; } if (myBox()) doPass(); } catch {} }, 150); });
  // target picking: first opponent offered
  await A.evaluate(() => { window.__pick = 0; });
  try {
    for (const nm of WANT.slice(0, 2)) await H.put(A, nm);
    await sleep(1500);
    await B.evaluate(() => { S.life = 6; commit(); }); await C.evaluate(() => { S.life = 6; commit(); }); await sleep(1500);
    const t0 = Date.now();
    await B.evaluate(() => { damageMe(1, {}, 'test'); commit(); });
    let last = '';
    for (let i = 0; i < 90; i++){ await sleep(2000);
      const s = await Promise.all([A, B, C].map(p => p.evaluate(() => ({life:S.life, stk:stackAll().length, wait:(stackAll().slice(-1)[0] || {}).w || [], key:prioKey(), pass:S.pass, prm:(UI.prm || []).length, modal:UI.modal && UI.modal.type}))));
      const line = JSON.stringify(s.map(x => [x.life, x.stk, x.prm, x.modal]));
      if (i % 5 === 0 || line !== last) console.log(Math.round((Date.now() - t0) / 1000) + 's', line); last = line;
      if (s[1].life <= 0 && s[2].life <= 0 && !s[0].stk) break;
    }
    console.log('lost?', JSON.stringify(await Promise.all([B, C].map(p => p.evaluate(() => [S.life, !!S.lost, !!S.j18out, !!S.j18left])))), JSON.stringify(await A.evaluate(() => S.log.slice(-12).map(e => e.s))));
  } catch (e){ console.log('ERROR', e.message); }
  await browser.close(); server.close(); process.exit(0);
})();
