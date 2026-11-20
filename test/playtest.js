// playtest.js: real Scryfall, real art. Loads the four real decks, walks the Deck Workshop, the Ask panel, saves screenshots.
// Usage: REAL=1 PTFILE=dev30.html PTPORT=9700 SHOTDIR=/tmp/shots node playtest.js
process.env.ALL = '1';
const H = require('./h'); const fs = require('fs'); const path = require('path'); const {sleep} = H;
const SHOT = process.env.SHOTDIR || '/tmp/shots'; fs.mkdirSync(SHOT, {recursive:true});
const clean = t => t.split('\n').map(l => l.replace(/\s*\([A-Z0-9]{2,6}\)\s*[\w★-]*\s*(\*F\*)?\s*$/, '')).join('\n');
const DECKS = (process.env.DECKS || 'edgar,gaa,elminster,bluefarm').split(',');
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
  const ctx = await browser.newContext({viewport:{width:1440, height:900}});
  await ctx.addInitScript(port => { window.PT_BROKERS = ['ws://localhost:' + port]; }, H.PORT);
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => { errs.push(e.message); console.log('  [pageerror]', e.message); });
  p.on('console', m => { if (/error|warn/.test(m.type()) && !/Failed to load resource/.test(m.text())) console.log('  [console]', m.text().slice(0, 300)); });
  await H.route(p); await p.goto(H.FILE); await sleep(1500);
  await p.screenshot({path:`${SHOT}/00-lobby.png`});
  for (const [i, n] of DECKS.entries()){
    const t0 = Date.now();
    await p.evaluate(() => lobbyPage('decks'));
    await p.fill('#deckIn', clean(fs.readFileSync(path.join(__dirname, '../decks/' + n + '.txt'), 'utf8'))); await p.click('#loadBtn');
    await p.waitForFunction(() => /Deck ready|could not|not found/i.test(document.querySelector('#deckStatus').textContent), null, {timeout:120000}).catch(() => {});
    const st = await p.textContent('#deckStatus'); console.log(`${n}: ${st.replace(/\s+/g, ' ').slice(0, 200)} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    H.check(/Deck ready/.test(st), `${n} loads from real Scryfall`);
    await p.evaluate(() => lobbyPage('check')); await sleep(i ? 2500 : 6000);
    const vid = await p.evaluate(() => { const v = document.querySelector('#d29vid'); return v ? {on:v.classList.contains('on'), t:v.currentTime, ready:v.readyState, err:v.error && v.error.code} : null; });
    const banner = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--d29banner').length > 0);
    console.log(`  video: ${JSON.stringify(vid)} banner loaded: ${banner}`);
    if (!i){ H.check(vid && vid.ready >= 2, 'header video loads'); H.check(banner, 'header banner loads'); }
    const imgs = await p.evaluate(() => { const a = [...document.querySelectorAll('#deckEdit .d29card img')]; return {n:a.length, ok:a.filter(x => x.complete && x.naturalWidth > 0).length}; });
    console.log(`  deck images: ${imgs.ok}/${imgs.n}`);
    await p.screenshot({path:`${SHOT}/${i + 1}${n}-a-deck-top.png`});
    await p.evaluate(() => document.querySelector('#d29tabs').scrollIntoView({block:'start'})); await sleep(1500);
    const imgs2 = await p.evaluate(() => { const a = [...document.querySelectorAll('#deckEdit .d29card img')]; return {n:a.length, ok:a.filter(x => x.complete && x.naturalWidth > 0).length}; });
    H.check(imgs2.ok >= imgs2.n * 0.9 && imgs2.n > 20, `${n}: deck area shows real card images (${imgs2.ok}/${imgs2.n})`);
    await p.screenshot({path:`${SHOT}/${i + 1}${n}-b-deck-area.png`});
    await p.screenshot({path:`${SHOT}/${i + 1}${n}-c-deck-full.png`, fullPage:true});
    if (!i){
      const c = await p.$('.d29card:nth-child(4)'); if (c){ const b = await c.boundingBox(); await p.mouse.move(b.x + 40, b.y + 14); await sleep(600); await p.screenshot({path:`${SHOT}/${i + 1}${n}-d-hover.png`}); }
      await p.click('[data-d29view="list"]'); await sleep(500); await p.screenshot({path:`${SHOT}/${i + 1}${n}-e-list.png`}); await p.click('[data-d29view="visual"]');
      await p.click('[data-d29tab="build"]'); await p.fill('#deAddIn', 'vampire'); await p.dispatchEvent('#deAddIn', 'input'); await sleep(4000);
      const r = await p.evaluate(() => ({n:DE29.res.length, total:DE29.total})); console.log('  build search "vampire":', JSON.stringify(r));
      H.check(r.n > 5, 'Build search returns real results');
      await p.screenshot({path:`${SHOT}/${i + 1}${n}-f-build.png`});
      const c0 = await p.evaluate(() => deckCount(LOBBY.deck)); const res = await p.$('.d29res:nth-child(2)');
      if (res){ await res.hover(); await sleep(300); await p.click('.d29res:nth-child(2) .add'); await sleep(250); await p.screenshot({path:`${SHOT}/${i + 1}${n}-g-flying.png`}); await sleep(1200); }
      H.check(await p.evaluate(() => deckCount(LOBBY.deck)) === c0 + 1, 'adding from Build search works');
      await p.click('[data-d29type="creature"]'); await sleep(3000); await p.screenshot({path:`${SHOT}/${i + 1}${n}-h-build-creature.png`});
      await p.click('[data-d29tab="test"]'); await sleep(300); await p.click('#deckEdit [data-de="hand"]'); await sleep(1500);
      await p.screenshot({path:`${SHOT}/${i + 1}${n}-i-test.png`, fullPage:true});
      await p.click('[data-d29tab="deck"]'); await sleep(300);
      const pk = await p.$('.d29card [data-de="peek"]'); if (pk){ await pk.click({force:true}); await sleep(800); await p.screenshot({path:`${SHOT}/${i + 1}${n}-j-peek.png`}); await p.keyboard.press('Escape'); }
      // Ask panel with a real question
      const ask = await p.$('[data-u28ask], #u28askBtn, .u28askfab'); if (ask){ await ask.click(); await sleep(500); const q = await p.$('#u28q');
        if (q){ await q.fill('Does Edgar Markov eminence work from the command zone?'); await q.press('Enter'); await sleep(5000); await p.screenshot({path:`${SHOT}/${i + 1}${n}-k-ask.png`}); } }
    }
  }
  H.check(!errs.length, 'no page errors (' + errs.slice(0, 3).join(' | ') + ')');
  fs.writeFileSync(`${SHOT}/results.txt`, H.results.join('\n'));
  console.log(H.results.filter(r => /FAIL/.test(r)).join('\n') || 'all passed');
  await browser.close(); server.close(); process.exit(0);
})().catch(e => { console.log('FATAL', e); process.exit(1); });
