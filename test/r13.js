// Mass check: the 7,000 most-played Commander cards (EDHREC rank, fetched from Scryfall 2 Nov 2026)
const H = require('./h'); const {check} = H; const fs = require('fs');
const all = require('./cards').topCards('all.json');
const FROM = +(process.env.FROM || 0), TO = +(process.env.TO || all.length);
(async () => {
  const browser = await H.chromium.launch();
  try {
    const p = await (await browser.newContext()).newPage(); p.on('pageerror', e => console.log('pageerror', e.message));
    await H.route(p); await p.goto(H.FILE);
    await p.evaluate(() => { LOBBY.deck = {main:[], cmd:[], name:'mass check'}; window.__R = {pats:{}, per:[], ok:0, done:0, asks:{}}; { const om = openModal; openModal = m => { if (UI.dry && m && m.type === 'ask' && window.__cur) (window.__R.asks[window.__cur] = window.__R.asks[window.__cur] || []).push(String(m.title || '').slice(0, 140)); return om(m); }; }
      window.__norm = (t, n) => { let x = String(t); [n, n.split(',')[0], n.split(' // ')[0]].sort((a, b) => b.length - a.length).forEach(nm => { if (nm && nm.length > 2) x = x.split(nm).join('~'); }); return x.replace(/\b\d+\b/g, 'N').replace(/\{[^}]+\}/g, '{M}').replace(/\s+/g, ' ').trim(); }; });
    const t0 = Date.now();
    for (let i = FROM; i < TO; i += 100){
      await p.evaluate(async list => { const R = window.__R;
        for (const c of list){ let k; try { const a = addInfo(infoFrom(c)); k = a && a.k; } catch { continue; } if (!k) continue;
          window.__cur = c.name; let r; try { r = await checkCard(k); } catch (e){ r = {name:c.name, issues:[{kind:'crash', text:String(e && e.message)}]}; }
          R.done++; if (!r.issues.length) R.ok++; else R.per.push([r.name, r.issues.map(x => x.kind[0] + ':' + x.text)]);
          for (const x of r.issues){ const pt = x.kind + '|' + window.__norm(x.text, r.name || ''); const v = R.pats[pt] || (R.pats[pt] = {n:0, ex:[]}); v.n++; if (v.ex.length < 3) v.ex.push(r.name); } } }, all.slice(i, Math.min(i + 100, TO)));
      if ((i - FROM) % 1000 === 0) console.log(`  ${i - FROM + 100} checked, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    const R = await p.evaluate(() => window.__R);
    const top = Object.entries(R.pats).sort((a, b) => b[1].n - a[1].n);
    fs.writeFileSync((process.env.OUTP || '/tmp/all') + 'pats.txt', top.map(([k, v]) => `${v.n} | ${k} | ${v.ex.join('; ')}`).join('\n'));
    fs.writeFileSync((process.env.OUTP || '/tmp/all') + 'per.json', JSON.stringify(R.per)); fs.writeFileSync((process.env.OUTP || '/tmp/all') + 'asks.json', JSON.stringify(R.asks, null, 1)); console.log(`   ${Object.keys(R.asks).length} cards asked the player for a number the engine should know`);
    console.log(`   ${R.done} checked, ${R.ok} fully understood (${(100 * R.ok / R.done).toFixed(1)}%), ${R.per.length} with gaps, ${top.length} distinct gap patterns, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    check(R.done >= (TO - FROM) * 0.98, 'all cards checked');
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
