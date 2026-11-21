// The "Top commanders" picker: tabs, search, a commander's decks, loading one into the deck box.
process.env.ALL = '1';
const H = require('./h'); const fs = require('fs'); const {check, sleep} = H;
const DATA = fs.readFileSync(process.env.TDJSON || '/tmp/td-sample.json', 'utf8');
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch(); const ctx = await browser.newContext({viewport:{width:1400, height:900}});
  await ctx.addInitScript(port => { window.PT_BROKERS = ['ws://localhost:' + port]; }, H.PORT);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await H.route(p); await p.route('**/topdecks.json', r => r.fulfill({status:200, contentType:'application/json', body:DATA}));
  await p.goto(H.FILE); await sleep(800);
  check(await p.isVisible('[data-td-btn]'), 'the Decks page has a "Top commanders" button');
  await p.click('[data-td-btn]'); await p.waitForSelector('.td-c', {timeout:10000});
  const n = await p.evaluate(() => document.querySelectorAll('.td-c').length); check(n >= 3, `cEDH tab lists commanders (${n})`);
  await p.screenshot({path:'/tmp/td-1.png'});
  await p.click('.td-c[data-td-open="0"]'); await sleep(400);
  const dk = await p.evaluate(() => document.querySelectorAll('.td-c.on [data-td-load]').length); check(dk >= 1, `opening a commander shows its decks (${dk})`);
  await p.screenshot({path:'/tmp/td-2.png'});
  await p.click('[data-td-tab="duel"]'); await sleep(300); check(await p.evaluate(() => TD.tab === 'duel' && document.querySelectorAll('.td-c').length > 0), 'Duel Commander tab');
  await p.click('[data-td-tab="edhrec"]'); await sleep(300); check(await p.evaluate(() => document.querySelectorAll('.td-c').length > 0), 'EDHREC tab');
  await p.fill('#tdQ', 'edgar'); await sleep(300);
  const names = await p.evaluate(() => [...document.querySelectorAll('.td-c b')].map(b => b.textContent)); check(names.length === 1 && /Edgar/.test(names[0]), `search finds Edgar (${names})`);
  await p.click('.td-c'); await sleep(300); await p.click('.td-c.on [data-td-load]'); await sleep(500);
  const ta = await p.inputValue('#deckIn'); check(/^Commander\n1 Edgar Markov\n\nDeck\n/.test(ta) && ta.split('\n').length > 60, 'the deck box gets the Edgar average deck with its commander');
  check(!(await p.$('.td-ov')), 'the picker closes');
  await p.waitForFunction(() => /Deck ready|not found|could not/i.test(document.querySelector('#deckStatus').textContent), null, {timeout:60000}).catch(() => {});
  console.log('  status:', (await p.textContent('#deckStatus')).slice(0, 160));
  check(await p.evaluate(() => LOBBY.deck && LOBBY.deck.cmd.some(k => info(k)?.n === 'Edgar Markov')), 'Edgar is the commander of the loaded deck');
  check(await p.evaluate(() => /EDHREC/.test(LOBBY.deckName)), `deck is named after where it came from (${await p.evaluate(() => LOBBY.deckName)})`);
  // a Duel deck switches the format
  await p.evaluate(() => lobbyPage('decks')); await p.click('[data-td-btn]'); await sleep(400); await p.click('[data-td-tab="duel"]'); await p.fill('#tdQ', ''); await sleep(200); await p.click('.td-c[data-td-open="0"]'); await sleep(300); await p.click('.td-c.on [data-td-load]'); await sleep(800);
  check(await p.evaluate(() => LOBBY.fmt === 'duel'), 'loading a Duel Commander deck switches the format to Duel Commander');
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  console.log(H.results ? '' : ''); await browser.close(); server.close(); process.exit(0);
})();
