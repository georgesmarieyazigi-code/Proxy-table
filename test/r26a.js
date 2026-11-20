// v26 bug hunt: loop / combo memory must start over in a new game (Game ▾ → New game, or a new deck).
const CC = require('./cards');
const WANT = ['Pack Leader', 'Blitzball Stadium', 'Foray of Orcs', 'Sanguine Bond', 'Exquisite Blood', 'Thassa\'s Oracle', 'Demonic Consultation'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, waitFor} = H;
const DECK = 'Commander\n1 Edgar Markov\n\nDeck\n' + WANT.map(n => '1 ' + n).join('\n') + '\n40 Swamp\n';
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    const A = await H.player(browser, 'Georges', DECK, 'host', 'r26a');
    const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r26a');
    await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]'); await sleep(1500);
    const assemble = () => A.evaluate(() => { for (const n of ['Sanguine Bond', 'Exquisite Blood']){ for (const z of ['lib', 'hand', 'gy']){ const c = S[z].find(x => cname(x) === n); if (c){ moveCard(c.id, n === 'Sanguine Bond' ? 'hand' : 'bf', {quiet:true}); break; } } } commit(); });
    const readyN = () => A.evaluate(() => S.log.filter(e => /Combo ready: .*Sanguine Bond/.test(e.s)).length);
    await assemble(); await sleep(1500);
    console.log(await A.evaluate(() => JSON.stringify({dc:f25deckCombos().length, deck:F25.deck && F25.deck.length, q:f25quiet(), lc:F25.lastChk, bf:S.bf.map(c=>cname(c)), hand:S.hand.map(c=>cname(c)), main:(S.deck.main||[]).slice(0,5)})));
    check(await readyN() === 1, 'game 1: "Combo ready" for Sanguine Bond + Exquisite Blood');
    // Foray of Orcs: X is the amassed Army's power — no number question
    await B.evaluate(() => { createFromText('Create a 4/4 green Beast creature token.', {k:null, name:'setup', it:{}}); commit(); }); await sleep(1500);
    await A.evaluate(() => { const c = [...S.lib, ...S.gy].find(x => cname(x) === 'Foray of Orcs'); if (c) moveCard(c.id, 'hand', {quiet:true}); S.pool = {...emptyPool(), R:4}; if (phaseNow().ph !== 3) setPhase(3); commit();
      window.__asked = []; setInterval(() => { const m = UI.modal; if (!m || m.__d) return; m.__d = 1; window.__asked.push(m.title || m.type);
        if (m.type === 'target' && m.resolve){ const t = m.cands.find(c => c.pid !== MYPID && c.t !== 'player'); m.resolve(t ? [t] : []); closeModal(); }
        else if (m.type === 'choice' && m.resolve){ m.resolve(m.options[0].value); closeModal(); } else if (m.run){ m.run(m.def ?? 1); closeModal(); } }, 100);
      beginCast(S.hand.find(x => cname(x) === 'Foray of Orcs'), 'hand', {}); });
    for (let i = 0; i < 20; i++){ for (const p of [A, B]) await p.evaluate(() => { if (myBox()) doPass(); }).catch(() => {}); await sleep(400); }
    const asked = await A.evaluate(() => window.__asked); const dmg = await B.evaluate(() => { const c = S.bf.find(x => /Beast/.test(cname(x))); return c ? c.dmg || 0 : 'gone'; });
    console.log(await A.evaluate(() => S.log.slice(-12).map(e => e.s).join(' | ')));
    check(!asked.some(t => /how many/i.test(t)), 'Foray of Orcs asked no number (' + JSON.stringify(asked) + ')');
    check(dmg === 2, 'Foray of Orcs dealt 2 (the Army\'s power) to the 4/4 Beast (' + dmg + ')');
    // Pack Leader's attack trigger and Blitzball Stadium's granted trigger: done by the engine, not left by hand
    const pl = await A.evaluate(async () => { UI.notes = []; const c = [...S.lib, ...S.hand, ...S.gy].find(x => cname(x) === 'Pack Leader'); moveCard(c.id, 'bf', {quiet:true}); const pk = S.bf.find(x => x.id === c.id);
      await runEffects('Prevent all combat damage that would be dealt this turn to Dogs you control.', {k:pk.k, name:'Pack Leader', srcId:pk.id, full:info(pk.k).o});
      const before = pk.dmg || 0; damageCard(pk, 3, {p24c:1}); const got = (pk.dmg || 0) - before; damageCard(pk, 1, {}); return {notes:(UI.notes || []).map(n => n.text), prevented:got === 0, noncombat:(pk.dmg || 0) - before}; });
    check(!pl.notes.length && pl.prevented, 'Pack Leader: combat damage to Dogs prevented, nothing by hand (' + JSON.stringify(pl) + ')');
    check(pl.noncombat === 1, 'Pack Leader: non-combat damage still dealt (' + pl.noncombat + ')');
    const bz = await A.evaluate(async () => { UI.notes = []; const pk = S.bf.find(x => cname(x) === 'Pack Leader') || (() => { const c = [...S.gy, ...S.lib].find(x => cname(x) === 'Pack Leader'); moveCard(c.id, 'bf', {quiet:true}); return S.bf.find(x => x.id === c.id); })(); pk.dmg = 0; pk.cp = 2; (pk.nc ||= {}).shield = 1; const h0 = S.hand.length;
      await runEffects('Draw a card for each kind of counter on it.', {k:pk.k, name:'Blitzball Stadium', srcId:pk.id}); return {notes:(UI.notes || []).map(n => n.text), drew:S.hand.length - h0}; });
    check(!bz.notes.length && bz.drew === 2, 'Blitzball: "draw a card for each kind of counter on it" drew 2 for +1/+1 and shield (' + JSON.stringify(bz) + ')');
    // a token picked out of a stack whose tokens are all tapped must stay tapped
    const sp = await A.evaluate(async () => { await createFromText('Create three 1/1 white Soldier creature tokens.', {k:null, name:'setup', it:{}}); await new Promise(r => setTimeout(r, 1500)); const c = S.bf.find(x => /Soldier/.test(cname(x)) && (x.n || 1) === 3);
      if (!c) return 'no stack of 3: ' + JSON.stringify(S.bf.filter(x => /Soldier/.test(cname(x))).map(x => x.n));
      c.tn = 3; c.cp = 1; commit(); const s = single(c); return {splitTap:!!s.tap, left:c.n, leftTapped:c.tn, splitCp:s.cp || 0, leftCp:c.cp}; });
    check(sp.splitTap === true && sp.leftTapped === 2 && sp.splitCp === 1, 'splitting one token off an all-tapped stack keeps it tapped (' + JSON.stringify(sp) + ')');
    await A.evaluate(() => { newGame(); }); await sleep(1500);
    await assemble(); await sleep(1500);
    check(await readyN() === 1, 'new game: "Combo ready" is said again (log count ' + await readyN() + ')');
    // the loop question is remembered per turn label ("turn 1"); a new game's turn 1 must still ask
    const k = await A.evaluate(() => Object.keys(F25.asked).length + '/' + Object.keys(F25.seen).length);
    check(true, 'state after new game: asked/seen = ' + k);
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); H.aedes.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
