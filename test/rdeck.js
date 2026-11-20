// Deck page: load, edit (add / remove / change counts / commander), test (hands, mulligan, draw, simulation)
process.env.ALL = '1';
const H = require('./h'); const {check, sleep} = H; const fs = require('fs');
const clean = t => t.split('\n').map(l => l.replace(/\s*\([A-Z0-9]{2,6}\)\s*[\w★-]*\s*(\*F\*)?\s*$/, '')).join('\n');
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch(); const ctx = await browser.newContext({viewport:{width:1300, height:900}});
  await ctx.addInitScript((port) => { window.PT_BROKERS = ['ws://localhost:' + port]; }, H.PORT);
  const p = await ctx.newPage(); await H.route(p); p.on('pageerror', e => check(false, 'page error: ' + e.message));
  await p.goto(H.FILE);
  check(await p.isVisible('#deckIn') && await p.isVisible('#lobbyNav [data-page="decks"]'), 'the Decks page has the saved list and the load box together');
  await p.fill('#deckIn', clean(fs.readFileSync(__dirname + '/../decks/edgar.txt', 'utf8'))); await p.click('#loadBtn');
  await p.waitForFunction(() => /Deck ready/.test(document.querySelector('#deckStatus').textContent), null, {timeout:20000});
  await p.click('#lobbyNav [data-page="check"]'); await sleep(300);
  check(await p.isVisible('#deckEdit'), 'Edit & test page shows the editor');
  const n0 = await p.evaluate(() => deckCount(LOBBY.deck));
  check(await p.isVisible('#d29hero') && await p.isVisible('#d29tabs'), 'workshop header and Build / Deck / Test tabs');
  check(await p.evaluate(() => document.querySelectorAll('#deckEdit .d29card').length) > 30, 'deck area shows the cards as images, grouped by type');
  await p.click('[data-d29tab="build"]'); await sleep(200);
  // add a card that is not in the deck yet, by typing its name
  await p.fill('#deAddIn', 'Counterspell'); await p.fill('#deAddQ', '2'); await p.click('#deckEdit [data-de="add"]'); await sleep(800);
  const r1 = await p.evaluate(() => ({n:deckCount(LOBBY.deck), has:LOBBY.deck.main.find(e => info(e.k)?.n === 'Counterspell')?.q, st:document.querySelector('#deStatus')?.textContent}));
  console.log('   ', JSON.stringify(r1));
  check(r1.has === 2 && r1.n === n0 + 2, 'added 2 Counterspell from Scryfall by name');
  // suggestions while typing
  await p.fill('#deAddIn', 'Lightning'); await p.dispatchEvent('#deAddIn', 'input'); await sleep(700);
  const sugg = await p.evaluate(() => DE.sugg); check(sugg.some(n => /Lightning/.test(n)), 'name suggestions while typing (' + sugg.slice(0, 3).join(', ') + ')');
  // plus / minus / remove
  await p.click('[data-d29tab="deck"]'); await sleep(200);
  await p.click('#deckEdit [data-de="plus"][data-k="' + await p.evaluate(() => LOBBY.deck.main.find(e => info(e.k)?.n === 'Swamp').k) + '"]');
  check(await p.evaluate(() => LOBBY.deck.main.find(e => info(e.k)?.n === 'Swamp').q) === 5, 'plus button: 4 → 5 Swamps');
  await p.click('[data-d29view="list"]'); await sleep(100); check(await p.evaluate(() => document.querySelectorAll('#deckEdit .de-row').length) > 30, 'list view');
  await p.click('[data-d29view="visual"]'); await sleep(100);
  const sk = await p.evaluate(() => LOBBY.deck.main.find(e => info(e.k)?.n === 'Skullclamp').k);
  await p.click(`#deckEdit [data-de="del"][data-k="${sk}"]`); await sleep(400);
  check(!(await p.evaluate(() => LOBBY.deck.main.some(e => info(e.k)?.n === 'Skullclamp'))), 'remove button takes Skullclamp out');
  const ck = await p.evaluate(() => LOBBY.deck.main.find(e => info(e.k)?.n === 'Counterspell').k);
  await p.click(`#deckEdit [data-de="minus"][data-k="${ck}"]`); await sleep(100); await p.click(`#deckEdit [data-de="minus"][data-k="${await p.evaluate(() => LOBBY.deck.main.find(e => info(e.k)?.n === 'Counterspell')?.k)}"]`);
  await sleep(400); check(!(await p.evaluate(() => LOBBY.deck.main.some(e => info(e.k)?.n === 'Counterspell'))), 'minus to 0 removes the card');
  // commander swap
  const vito = await p.evaluate(() => LOBBY.deck.main.find(e => info(e.k)?.n === 'Vito, Thorn of the Dusk Rose')?.k);
  await p.click(`#deckEdit [data-de="cmd"][data-k="${vito}"]`); await sleep(200);
  check(await p.evaluate(() => LOBBY.deck.cmd.map(k => info(k).n).includes('Vito, Thorn of the Dusk Rose')), '★ makes Vito a commander');
  await p.click(`#deckEdit [data-de="uncmd"][data-k="${vito}"]`); await sleep(200);
  check(await p.evaluate(() => !LOBBY.deck.cmd.map(k => info(k).n).includes('Vito, Thorn of the Dusk Rose')), '↓ moves Vito back into the deck');
  // save the edited deck and reload it from the Decks page
  await p.click('[data-act="saveDeck"]'); await sleep(300);
  const saved = await p.evaluate(() => savedDecks()[0]); check(saved && saved.deck.main.find(e => saved.dict.find(a => a.k === e.k)?.n === 'Swamp').q === 5, 'Save keeps the edits (5 Swamps)');
  await p.click('[data-d29tab="test"]'); await sleep(200);
  // test: opening hand, mulligan, draw, simulation
  await p.click('#deckEdit [data-de="hand"]'); await sleep(200);
  check(await p.evaluate(() => DE.test.hand.length) === 7, 'opening hand of 7');
  await p.click('#deckEdit [data-de="mull"]'); await sleep(100); check(await p.evaluate(() => DE.test.mull) === 1, 'mulligan counts 1');
  await p.click('#deckEdit [data-de="draw"]'); check(await p.evaluate(() => DE.test.hand.length) === 8, 'draw a card → 8');
  await p.click('#deckEdit [data-de="sim"]'); await sleep(300);
  const sim = await p.evaluate(() => DE.sim); console.log('    sim', JSON.stringify(sim)); check(sim && sim.keep > 0.3 && sim.avg > 1.5, 'simulation gives sensible land odds');
  const curve = await p.evaluate(() => deStats(LOBBY.deck)); console.log('    stats', JSON.stringify(curve));
  check(curve.lands >= 30 && curve.curve.reduce((a, b) => a + b, 0) === curve.nonland, 'curve and land count add up');
  await p.screenshot({path:'/tmp/s-deck.png', fullPage:true});
  console.log(`\n${H.results.filter(r => r.startsWith('PASS')).length}/${H.results.length} passed`);
  await browser.close(); server.close(); process.exit(H.fails() ? 1 : 0);
})();
