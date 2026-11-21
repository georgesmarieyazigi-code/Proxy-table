// Live site + real Scryfall: open Top commanders, load decks from each tab (including ones with split cards), check they load whole.
const {chromium} = require('playwright'); const fs = require('fs');
const URL = process.env.SITE || 'https://georgesmarieyazigi-code.github.io/Proxy-table/';
const PICKS = [['cedh', 0, 0], ['cedh', 1, 1], ['duel', 'Spider-Man 2099', 0], ['duel', 0, 2], ['edhrec', 'Caesar', 0], ['edhrec', 'Wise Mothman', 0], ['edhrec', 0, 0]];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({viewport:{width:1440, height:900}})).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); let fails = 0;
  await p.goto(URL); await p.waitForTimeout(2500); fs.mkdirSync('../out/top', {recursive:true});
  for (const [tab, which, deck] of PICKS){
    await p.evaluate(() => lobbyPage('decks')); await p.click('[data-td-btn]'); await p.waitForSelector('.td-c', {timeout:30000});
    await p.click(`[data-td-tab="${tab}"]`); await p.fill('#tdQ', typeof which === 'string' ? which : ''); await p.waitForTimeout(400);
    const i = typeof which === 'number' ? which : 0;
    const card = p.locator('.td-c').nth(i); const name = await card.locator('b').textContent();
    await card.click(); await p.waitForTimeout(500); if (tab === 'cedh' && i === 0) await p.screenshot({path:'../out/top/picker.png'});
    const loads = p.locator('.td-c.on [data-td-load]'); const n = await loads.count(); await loads.nth(Math.min(deck, n - 1)).click();
    await p.waitForFunction(() => /Deck ready|not found|could not|couldn/i.test(document.querySelector('#deckStatus').textContent), null, {timeout:120000}).catch(() => {});
    await p.waitForTimeout(800);
    const st = (await p.textContent('#deckStatus')).replace(/\s+/g, ' ');
    const r = await p.evaluate(() => ({n:deckCount(LOBBY.deck), cmd:LOBBY.deck.cmd.map(k => info(k)?.n), name:LOBBY.deckName, fmt:LOBBY.fmt}));
    const ok = r.n === 100 && r.cmd.length && !/not found/i.test(st);
    if (!ok) fails++;
    console.log(`${ok ? '✓' : '✗'} ${tab} ${name}: ${r.n} cards, commander ${r.cmd.join(' + ')}, format ${r.fmt}, "${r.name}" — ${st.slice(0, 220)}`);
    await p.screenshot({path:`../out/top/${tab}-${String(name).replace(/[^\w]+/g, '_').slice(0, 30)}.png`});
  }
  console.log(errs.length ? '✗ page errors: ' + errs.join(' | ') : '✓ no page errors'); console.log(fails ? `${fails} FAILED` : 'all decks loaded whole');
  await b.close();
})();
