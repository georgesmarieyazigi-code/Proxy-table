// hh23: Hoard Hauler hits a player who has artifacts, with Stridehangar Automaton out — does the trigger repeat?
process.env.TOP = '1'; const CC = require('./cards'); const WANT = ['Hoard Hauler', 'Stridehangar Automaton', 'Edgar Markov'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {sleep, waitFor} = H;
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', 'Commander\n1 Edgar Markov\n\nDeck\n1 Hoard Hauler\n1 Stridehangar Automaton\n40 Mountain\n', 'host', 'hh23');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'hh23');
  await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]'); await sleep(3000);
  const passB = setInterval(() => B.evaluate(() => { if (myBox()) doPass(); }).catch(() => {}), 300);
  try {
    for (const nm of (process.env.NOSTRIDE ? ['Hoard Hauler'] : ['Hoard Hauler', 'Stridehangar Automaton'])){ const ok = await H.put(A, nm); console.log('put', nm, ok); }
    await B.evaluate(async () => { for (let i = 0; i < 6; i++) await createFromText('Create a Treasure token', {k:null, name:'setup'}); commit(); });
    await sleep(2000);
    const bp = await B.evaluate(() => MYPID); await A.evaluate(() => { window.HHN = 0; Error.stackTraceLimit = 100; const lg = log; log = function(t){ if (/^trigger: Hoard Hauler/.test(t)){ HHN++; (window.HHS ||= []).push(String(new Error().stack).split('\n').slice(2, 60).filter(x => !/pushTrigger/.test(x)).slice(0, 8).map(x => x.trim().replace(/\(.*:(\d+):\d+\)/, ':$1')).join(' < ')); } return lg.apply(this, arguments); }; });
    await A.evaluate(bp => { const hh = S.bf.find(c => info(c.k).n === 'Hoard Hauler'); const ot = S.bf.find(c => c !== hh && isCreatureCard(c)) || S.bf.find(c => c !== hh); emit({type:'cdmg', k:ot.k, id:ot.id, dp:bp, cnt:1, amt:2}); emit({type:'cdmg', k:hh.k, id:hh.id, dp:bp, cnt:1, amt:5}); emit({type:'cdmg', k:ot.k, id:ot.id, dp:bp, cnt:1, amt:2}); }, bp);
    for (let t = 0; t < 40; t++){
      await sleep(1500);
      const s = await A.evaluate(() => ({stk:S.stk.map(i => i.nm), res:!!UI.resolving, tok:S.bf.reduce((a, c) => a + (c.tok ? (c.n || 1) : 0), 0), hh:S.log.filter(e => /^trigger: Hoard Hauler/.test(e.s)).length, HHN, toks:Object.entries(S.bf.filter(c => c.tok).reduce((m, c) => (m[cname(c)] = (m[cname(c)] || 0) + (c.n || 1), m), {}))}));
      console.log(t, JSON.stringify(s));
      if (!s.stk.length && !s.res && t > 3) break;
      if (t === 0) console.log('stack names', s.stk);
    }
    console.log((await A.evaluate(() => window.HHS || [])).join('\n'));
  } catch (e){ console.log('ERROR', e.message); }
  finally { clearInterval(passB); await browser.close(); server.close(); process.exit(0); }
})();
