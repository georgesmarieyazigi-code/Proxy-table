// Lobby: same code typed differently, clock skew, switching tables, duplicated tab ids
const H = require('./h'); const {check, sleep, waitFor} = H;
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'host', 'goblin-1234');
  // Georges: phone-style input (capitals, en dash, Arabic-Indic digits, trailing space) and a clock 9 minutes fast
  const ctx = await browser.newContext({viewport:{width:1400, height:900}});
  await ctx.addInitScript((port) => { window.PT_BROKERS = ['ws://localhost:' + port]; window.PT_RESP_MS = 1500; const d = Date.now; Date.now = () => d() + 9 * 60 * 1000; }, H.PORT);
  const B = await ctx.newPage(); await H.route(B); await B.goto(H.FILE);
  await B.fill('#deckIn', H.deckFor('Edgar Markov')); await B.click('#loadBtn');
  await B.waitForFunction(() => /Deck ready/.test(document.querySelector('#deckStatus').textContent));
  await B.fill('#nameIn', 'Georges'); await B.fill('#codeIn', 'Goblin–١٢٣٤ '); await B.click('#joinBtn');
  await B.waitForSelector('#game:not([hidden])');
  check(await B.evaluate(() => NET.code) === 'goblin-1234', 'phone-typed code (capitals, en dash, Arabic digits) becomes goblin-1234');
  check(await waitFor(A, () => OPP.size === 1, null, 8000), 'Kim sees Georges despite his clock being 9 minutes off');
  check(await waitFor(B, () => OPP.size === 1, null, 8000), 'Georges sees Kim');
  // Noor is seated at another table, then goes back to the lobby and joins goblin-1234
  const C = await H.player(browser, 'Noor', H.deckFor('Krenko, Mob Boss'), 'host', 'other-table');
  await C.evaluate(() => showLobby()); await C.fill('#codeIn', 'goblin-1234'); await C.click('#joinBtn');
  await C.waitForSelector('#game:not([hidden])');
  check(await C.evaluate(() => NET.code) === 'goblin-1234', 'a player already seated elsewhere moves to the new code when joining it');
  check(await waitFor(C, () => OPP.size === 2, null, 8000) && await waitFor(A, () => OPP.size === 2, null, 8000), 'all three are at one table');
  // duplicated tab: same sessionStorage must not mean same player id
  const ids = await Promise.all([A, B, C].map(p => p.evaluate(() => MYPID)));
  check(new Set(ids).size === 3, 'every page has its own player id');
  console.log(`\n${H.results.filter(r => r.startsWith('PASS')).length}/${H.results.length} passed`);
  await browser.close(); server.close(); process.exit(H.fails() ? 1 : 0);
})();
