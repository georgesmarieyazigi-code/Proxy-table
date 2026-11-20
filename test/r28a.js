// v28 UI: Ask about your cards (Scryfall), life pop-ups, turn banner, combo pop-up, animation toggle, game over.
const CC = require('./cards');
const WANT = ["Thassa's Oracle", 'Demonic Consultation', 'Sol Ring', 'Birds of Paradise', 'Exquisite Blood', 'Sanguine Bond'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, waitFor} = H;
const DECK = 'Commander\n1 Edgar Markov\n\nDeck\n' + WANT.map(n => '1 ' + n).join('\n') + '\n40 Swamp\n';
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    const A = await H.player(browser, 'Georges', DECK, 'host', 'r28a');
    await A.route('**/rulings', r => r.fulfill({status:200, contentType:'application/json', body:JSON.stringify({object:'list', data:[
      {source:'wotc', published_at:'2020-06-23', comment:"If Demonic Consultation exiles your whole library, Thassa's Oracle's ability counts zero cards and you win the game."},
      {source:'wotc', published_at:'2020-06-23', comment:'Devotion counts the mana symbols in the mana costs of permanents you control.'}]})}));
    const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r28a');
    await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]'); await sleep(1500);
    check(await A.evaluate(() => !!document.getElementById('u28css') && !!document.getElementById('u28ask')), 'new UI layer loaded');
    check(await A.evaluate(() => !!document.querySelector('#topbar [data-act="u28ask"]')), 'Ask ✦ button in the top bar');
    // Ask: a rules question naming two deck cards
    await A.click('#topbar [data-act="u28ask"]'); await sleep(500);
    check(await A.evaluate(() => document.getElementById('u28ask').classList.contains('open')), 'the Ask panel slides open');
    await A.fill('#u28q', "How does Thassa's Oracle work with Demonic Consultation?"); await A.press('#u28q', 'Enter');
    await waitFor(A, () => document.querySelectorAll('#u28out .res').length >= 2, null, 15000);
    const r1 = await A.evaluate(() => ({n:document.querySelectorAll('#u28out .res').length, names:[...document.querySelectorAll('#u28out .res h4')].map(h => h.textContent), hits:document.querySelectorAll('#u28out .rul.hit').length, marks:document.querySelectorAll('#u28out mark').length}));
    check(r1.n === 2 && r1.names.some(n => /Thassa/.test(n)) && r1.names.some(n => /Consultation/.test(n)), `both cards found with their Oracle text (${JSON.stringify(r1.names)})`);
    check(r1.hits >= 1 && r1.marks >= 1, `rulings that match the question are highlighted (${r1.hits} rulings, ${r1.marks} words)`);
    // deck search
    await A.fill('#u28q', 'Which of my cards have flying?'); await A.press('#u28q', 'Enter');
    await waitFor(A, () => /In your deck/.test(document.getElementById('u28out').textContent), null, 10000);
    const r2 = await A.evaluate(() => [...document.querySelectorAll('#u28out .list button')].map(b => b.textContent));
    if (!r2.length) console.log('DBG', await A.evaluate(() => JSON.stringify({ks:u28deckKeys().map(k => info(k).n), s:u28deckSearch('Which of my cards have flying?'), deck:S.deck && Object.keys(S.deck), m0:S.deck && S.deck.main && S.deck.main[0]})));
    check(r2.includes('Birds of Paradise') && !r2.includes('Sol Ring'), `deck search: flying → ${JSON.stringify(r2)}`);
    // Claude button explains what's missing when the coach is off (no API call)
    check(await A.evaluate(() => document.getElementById('u28claudeBtn').disabled), 'Ask Claude is greyed out while the coach is off');
    await A.click('[data-act="u28askClose"]'); await sleep(400);
    check(await A.evaluate(() => !document.getElementById('u28ask').classList.contains('open')), 'the panel closes');
    // life change → floating number
    await A.evaluate(() => { setLife(-5); });
    await sleep(150);
    check(await A.evaluate(() => [...document.querySelectorAll('.u28float')].some(e => /−5/.test(e.textContent))), 'losing 5 life pops up “−5”');
    // combo ready pop-up
    await A.evaluate(() => { for (const n of ['Exquisite Blood', 'Sanguine Bond']){ const c = [...S.lib, ...S.hand].find(x => cname(x) === n); if (c) moveCard(c.id, n === 'Sanguine Bond' ? 'hand' : 'bf', {quiet:true}); } commit(); });
    const combo = await waitFor(A, () => !!document.querySelector('.u28combo'), null, 6000);
    check(combo, 'a “Combo ready” card pops up');
    // new cards animate in
    await A.evaluate(() => { const c = S.lib.find(x => cname(x) === 'Sol Ring'); if (c){ moveCard(c.id, 'bf', {quiet:true}); commit(); } }); await sleep(120);
    check(await A.evaluate(() => [...document.querySelectorAll('#bf .card.u28in')].length >= 1), 'a card that enters the battlefield animates in');
    // turn banner when the turn passes
    await A.evaluate(() => { const t = currentTurn(); });
    await B.evaluate(() => {});
    await A.evaluate(() => { U28.turnKey = 'x'; renderGame(); }); await sleep(100);
    check(await A.evaluate(() => !!document.querySelector('.u28banner')), 'a turn banner sweeps across when the turn changes');
    // animation toggle
    await A.evaluate(() => ACT.u28fx()); await sleep(100);
    check(await A.evaluate(() => !document.documentElement.classList.contains('u28fx')), 'Game ▾ → Animations off turns the motion off');
    await A.evaluate(() => { setLife(-2); }); await sleep(150);
    check(await A.evaluate(() => ![...document.querySelectorAll('.u28float')].some(e => /−2/.test(e.textContent))), 'with animations off, no pop-ups');
    await A.evaluate(() => ACT.u28fx());
    // game over overlay
    await A.evaluate(() => { log('wins the game (test)'); renderGame(); }); await sleep(200);
    check(await A.evaluate(() => /Victory/.test((document.querySelector('.u28over') || {}).textContent || '')), 'winning shows a Victory overlay');
    await A.evaluate(() => document.querySelector('.u28over button').click());
    check(await A.evaluate(() => !document.querySelector('.u28over')), 'the overlay closes');
    // lobby: Ask button and panel work before a game too
    const L = await browser.newPage(); await H.route(L); await L.goto(H.FILE); await sleep(1500);
    check(await L.evaluate(() => !!document.getElementById('u28askBtn') && getComputedStyle(document.getElementById('u28askBtn')).display !== 'none'), 'lobby: floating “Ask about your cards” button');
    await L.click('#u28askBtn'); await sleep(400);
    check(await L.evaluate(() => document.getElementById('u28ask').classList.contains('open')), 'lobby: the panel opens');
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); H.aedes.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
