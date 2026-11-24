// Cascade and extra turns, with real card text, at a 3-player table (Georges → Kim → Lee)
process.env.TOP = '1';
const CC = require('./cards');
const WANT = ['Bloodbraid Elf', 'Maelstrom Wanderer', 'Apex Devastator', 'Lightning Bolt', 'Craterhoof Behemoth', 'Stomping Ground', 'Opt', 'Divination', 'Ponder', 'Brainstorm', 'Sol Ring',
  'Time Warp', 'Nexus of Fate', 'Temporal Manipulation', 'Time Stretch', 'Brazen Borrower // Petty Theft', 'Valki, God of Lies // Tibalt, Cosmic Impostor', 'Ugin, the Spirit Dragon', 'Counterspell', 'Swords to Plowshares'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, waitFor} = H;
const AUTO = () => { setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want || [];
  try { (window.__titles = window.__titles || []).push((m.title || '') + ' :: ' + (m.options || []).map(o => o.label).join(' / '));
    if (m.type === 'pick' && m.resolve){ const n = Math.max(m.min || 0, m.max ? 1 : 0); const ids = (m.cards || []).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = w.map(r => (m.options || []).find(x => !x.disabled && new RegExp(r, 'i').test(x.label))).find(Boolean) || (m.options || []).find(x => !x.disabled); m.__done = 1; m.resolve(o ? o.value : null); closeModal(); }
    else if (m.type === 'modes' && m.resolve){ m.__done = 1; m.resolve([0]); closeModal(); }
    else if (m.type === 'target' && m.resolve){ const want = window.__tgt; const i = (m.cands || []).findIndex(c => c.ok && (want ? c.t === 'player' && c.pid === (want === 'me' ? MYPID : want) : c.pid !== MYPID)); m.__done = 1; m.resolve(i >= 0 ? [m.cands[i]] : []); closeModal(); }
    else if (m.type === 'zone'){ m.__done = 1; closeModal(); }
    else if (m.run){ m.__done = 1; m.run(window.__num || m.def || 0); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const settle = async (ps) => { for (let i = 0; i < 50; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting || UI.modal)); if (!busy) return; await sleep(150); } };
const kOf = (p, nm) => p.evaluate(nm => [...DICT.values()].find(a => a.n === nm).k, nm);
const toHand = (p, nm) => p.evaluate(nm => { const k = [...DICT.values()].find(a => a.n === nm).k; const c = {id:S.nid++, k}; S.hand.push(c); commit(); return c.id; }, nm);
const libTop = (p, names) => p.evaluate(ns => { const cs = ns.map(nm => ({id:S.nid++, k:[...DICT.values()].find(a => a.n === nm || a.n === nm.split(' // ')[0]).k})); S.lib.unshift(...cs); commit(); }, names);
const castFree = (p, id) => p.evaluate(id => { const c = S.hand.find(x => x.id === id); S.pool = {...emptyPool(), C:20, R:5, G:5, U:5, W:5, B:5}; beginCast(c, 'hand'); }, id);
const who = p => p.evaluate(() => { const t = currentTurn(); return [t[0], nameOf(t[1])]; });
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    const G = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r33a'); await sleep(300);
    const K = await H.player(browser, 'Kim', H.deckFor('Krenko, Mob Boss'), 'join', 'r33a'); await sleep(300);
    const L = await H.player(browser, 'Lee', H.deckFor('Krenko, Mob Boss'), 'join', 'r33a');
    const ALL = [G, K, L];
    await waitFor(G, () => OPP.size === 2, null, 30000); await waitFor(L, () => OPP.size === 2, null, 30000); for (const p of ALL) await p.evaluate(AUTO);
    await G.click('[data-act="goFirst"]'); await sleep(800);
    console.log('  seats', JSON.stringify(await G.evaluate(() => players().map(p => p.nm))));
    const P = {Georges:G, Kim:K, Lee:L};
    // end the current turn and start the next one on whoever's client it is; returns [turn number, name]
    const next = async () => { await settle(ALL); const [n, nm] = await who(G); await P[nm].evaluate(() => { S.stk = []; passTurn(); });
      for (let i = 0; i < 40; i++){ const t = await who(G); if (t[0] > n){ const [, nm2] = t; await sleep(300); await P[nm2].evaluate(() => { const pn = phaseNow(); if (pn.mine && S.untapN < pn.n) startMyTurn(); }); await sleep(400); await toMain(); return await who(G); } await sleep(150); }
      return await who(G); };
    const startCur = async () => { const [, nm] = await who(G); await P[nm].evaluate(() => { const pn = phaseNow(); if (pn.mine && S.untapN < pn.n) startMyTurn(); }); await sleep(400); };
    await startCur();
    console.log('  missing', JSON.stringify(await G.evaluate(W => W.filter(n => ![...DICT.values()].some(a => a.n === n)), WANT)), await G.evaluate(() => S.deck.main.length));
    const toMain = async () => { for (let i = 0; i < 30; i++){ const [, nm] = await who(G); const p = P[nm]; if (await p.evaluate(() => phaseNow().ph === 3)) return; await p.evaluate(() => { if (!stackAll().length && !UI.modal && phaseNow().mine) nextAction(); }); await passAll(ALL); } };
    await toMain();
    const opp = await G.evaluate(() => [...OPP.values()].map(s => s.life));

    /* ---------- cascade ---------- */
    await G.evaluate(() => { window.__want = ['Cast it']; window.__tgt = null; });
    await libTop(G, ['Stomping Ground', 'Craterhoof Behemoth', 'Lightning Bolt', 'Divination']);
    let id = await toHand(G, 'Bloodbraid Elf'); await castFree(G, id); await settle(ALL); await sleep(500); await settle(ALL);
    let r = await G.evaluate(() => ({bf:S.bf.map(cname), gy:S.gy.map(cname), ex:S.ex.map(cname), top:cname(S.lib[0]), bottom:S.lib.slice(-2).map(cname), log:S.log.slice(-12).map(e => e.s), lives:[...OPP.values()].map(s => s.life)}));
    console.log('   Bloodbraid', JSON.stringify(r));
    check(r.gy.includes('Lightning Bolt') && r.bf.includes('Bloodbraid Elf'), 'Bloodbraid Elf cascaded into Lightning Bolt (skipping the land and the 8-drop) and was cast for free');
    check(r.lives.some((x, i) => x === opp[i] - 3), 'the free Bolt dealt 3');
    check(r.bottom.includes('Stomping Ground') && r.bottom.includes('Craterhoof Behemoth') && !r.ex.length, 'the land and Craterhoof went to the bottom, nothing left in exile');
    check(r.top === 'Divination', 'the card under the hit was not touched');
    { const iB = r.log.findIndex(s => /Lightning Bolt.*resolved|resolved.*Lightning Bolt|Bolt.*deals? 3|dealt 3/.test(s)), iE = r.log.findIndex(s => /^Bloodbraid Elf resolved/.test(s)); check(iB >= 0 && (iE < 0 || iB < iE), `the Bolt resolved before Bloodbraid Elf (${iB} vs ${iE})`); }

    await G.evaluate(() => { window.__want = ['^No']; });
    await libTop(G, ['Opt', 'Divination']);
    id = await toHand(G, 'Bloodbraid Elf'); await castFree(G, id); await settle(ALL); await sleep(500);
    r = await G.evaluate(() => ({ex:S.ex.map(cname), top:cname(S.lib[0]), bottom:cname(S.lib[S.lib.length - 1]), hand:S.hand.map(cname)}));
    check(r.bottom === 'Opt' && !r.ex.includes('Opt') && r.top === 'Divination', `declining the cascade puts the hit on the bottom too (${JSON.stringify(r)})`);

    await G.evaluate(() => { window.__want = ['Cast it']; window.__tgt = null; });
    await libTop(G, ['Opt', 'Sol Ring', 'Ponder']);
    const c0 = await G.evaluate(() => S.log.filter(e => /^cascade: exiled/.test(e.s)).length);
    id = await toHand(G, 'Maelstrom Wanderer'); await castFree(G, id); await settle(ALL); await sleep(800); await settle(ALL);
    r = await G.evaluate(c0 => ({n:S.log.filter(e => /^cascade: exiled/.test(e.s)).length - c0, bf:S.bf.map(cname), gy:S.gy.map(cname), log:S.log.slice(-14).map(e => e.s)}), c0);
    console.log('   Wanderer', JSON.stringify(r));
    check(r.n === 2, `Maelstrom Wanderer cascades twice (${r.n})`);
    check(r.log.filter(x => /without paying its mana cost/.test(x)).length >= 2, 'both cascades cast their card for free');

    await libTop(G, ['Opt', 'Divination', 'Ponder', 'Brainstorm']);
    const c1 = await G.evaluate(() => Date.now());
    id = await toHand(G, 'Apex Devastator'); await castFree(G, id); for (let i = 0; i < 4; i++){ await settle(ALL); await sleep(800); }
    r = await G.evaluate(t0 => [...LOGS.values()].filter(e => e.pid === MYPID && e.t >= t0 && /^cascade: exiled/.test(e.s)).length, c1);
    check(r === 4, `Apex Devastator cascades four times (${r})`);

    await G.evaluate(() => { window.__want = ['^No']; window.__titles = []; });
    const dfcOk = await G.evaluate(() => [...DICT.values()].some(a => /^Valki/.test(a.n)));
    if (dfcOk){ await libTop(G, ['Valki, God of Lies // Tibalt, Cosmic Impostor', 'Opt']);
    id = await toHand(G, 'Bloodbraid Elf'); await castFree(G, id); await settle(ALL); await sleep(500);
    r = await G.evaluate(() => (window.__titles || []).filter(t => /Cascade/.test(t)));
    check(r.some(t => /Valki/.test(t)), `cascade offers a double-faced card by its front (Valki, mana value 2) ${JSON.stringify(r)}`);
    await G.evaluate(() => { window.__titles = []; });
    await libTop(G, ['Brazen Borrower // Petty Theft']);
    id = await toHand(G, 'Bloodbraid Elf'); await castFree(G, id); await settle(ALL); await sleep(500);
    r = await G.evaluate(() => (window.__titles || []).filter(t => /Cascade/.test(t)));
    check(r.some(t => /Brazen Borrower/.test(t)), `cascade offers an adventure card (Brazen Borrower) ${JSON.stringify(r)}`);
    } else console.log('   (double-faced and adventure cards are checked on the real-card run)');
    await G.evaluate(() => { window.__want = ['Cast it']; });

    /* ---------- extra turns ---------- */
    const seq = []; const log = t => seq.push(t[1]);
    // 1. Time Warp on myself
    await G.evaluate(() => { window.__tgt = 'me'; });
    id = await toHand(G, 'Time Warp'); await castFree(G, id); await settle(ALL);
    log(await next()); log(await next()); log(await next());
    console.log('   Time Warp on me →', seq.join(' → '));
    check(seq.join() === 'Georges,Kim,Lee', `Time Warp on myself: Georges → Georges (extra) → Kim → Lee (${seq.join(' → ')})`);
    // now it's Lee's turn → next Georges
    let t = await next(); check(t[1] === 'Georges', 'back to Georges');
    // 2. two Time Warps
    seq.length = 0;
    for (let i = 0; i < 2; i++){ id = await toHand(G, 'Time Warp'); await castFree(G, id); await settle(ALL); }
    log(await next()); log(await next()); log(await next());
    check(seq.join() === 'Georges,Georges,Kim', `two Time Warps: two extra turns (${seq.join(' → ')})`);
    // Kim's turn now → Lee → Georges
    await next(); t = await next(); check(t[1] === 'Georges', 'back to Georges');
    // 3. Time Warp on Kim, cast on my turn: Kim takes the next turn, then Kim again (her normal turn), then Lee
    seq.length = 0;
    await G.evaluate(() => { window.__tgt = [...OPP.entries()].find(([, s]) => s.nm === 'Kim')[0]; });
    id = await toHand(G, 'Time Warp'); await castFree(G, id); await settle(ALL);
    log(await next()); log(await next()); log(await next());
    check(seq.join() === 'Kim,Kim,Lee', `Time Warp on Kim: Kim (extra) → Kim → Lee (${seq.join(' → ')})`);
    t = await next(); check(t[1] === 'Georges', 'back to Georges');
    // 4. Nexus of Fate cast during Kim's turn: my extra turn comes right after Kim's, then Lee
    seq.length = 0;
    t = await next(); check(t[1] === 'Kim', "Kim's turn");
    await G.evaluate(() => { window.__tgt = 'me'; });
    id = await toHand(G, 'Nexus of Fate'); await castFree(G, id); await settle(ALL); await sleep(600);
    console.log('   x33', JSON.stringify(await G.evaluate(() => ({x33:S.x33, xt:S.xt, log:S.log.slice(-5).map(e => e.s)}))), JSON.stringify(await K.evaluate(() => [...OPP.values()].map(s => [s.nm, s.x33]))));
    log(await next()); log(await next()); log(await next());
    console.log('   Nexus on Kim\'s turn →', seq.join(' → '));
    check(seq.join() === 'Georges,Lee,Georges', `Nexus of Fate on Kim's turn: Georges (extra) → Lee → Georges (${seq.join(' → ')})`);
    // 5. Time Stretch on myself: two extra turns
    seq.length = 0;
    id = await toHand(G, 'Time Stretch'); await castFree(G, id); await settle(ALL);
    log(await next()); log(await next()); log(await next());
    check(seq.join() === 'Georges,Georges,Kim', `Time Stretch: two extra turns (${seq.join(' → ')})`);
    // the extra turn is a real turn: untap and draw
    check(await G.evaluate(() => !S.bf.some(c => c.tap && /Bloodbraid/.test(cname(c)))), 'permanents untapped during the extra turns');
  } catch (e){ console.log('ERROR', e.message, e.stack); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); H.aedes.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
