// Rules check of the four final-test decks with real Oracle text
process.env.ALL = '1';
const H = require('./h'); const fs = require('fs');
const clean = t => t.split('\n').map(l => l.replace(/\s*\([A-Z0-9]{2,6}\)\s*[\w★-]*\s*(\*F\*)?\s*$/, '')).join('\n');
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch(); const out = {};
  for (const d of ['gaa', 'elminster', 'edgar', 'bluefarm']){
    const ctx = await browser.newContext(); const p = await ctx.newPage(); await H.route(p); await p.goto(H.FILE);
    await p.fill('#deckIn', clean(fs.readFileSync('../decks/' + d + '.txt', 'utf8'))); await p.click('#loadBtn');
    await p.waitForFunction(() => /Deck ready/.test(document.querySelector('#deckStatus').textContent), null, {timeout:20000});
    const st = await p.evaluate(() => document.querySelector('#deckStatus').textContent);
    const res = await p.evaluate(async () => { const d = LOBBY.deck; const keys = [...new Set([...d.cmd, ...d.main.map(e => e.k)])]; const rows = []; for (const k of keys){ if (isLand(k) && (info(k)?.o || '').length <= 40) continue; rows.push(await checkCard(k)); } return {cmd:d.cmd.map(k => info(k)?.n), n:keys.length, rows:rows.filter(r => r.issues.length).map(r => ({n:r.name, i:r.issues.map(i => i.kind + ': ' + i.text)})), total:rows.length}; });
    out[d] = res; console.log(`${d}: ${st} commander=${res.cmd.join(' + ')}  ${res.total - res.rows.length}/${res.total} fully understood`);
    await ctx.close();
  }
  fs.writeFileSync(process.env.OUTD || '/tmp/decks_check.json', JSON.stringify(out, null, 1));
  await browser.close(); server.close(); process.exit(0);
})();
