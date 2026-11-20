process.env.TOP = '1';
// v19 (fix18d): no free face-down cards; untapping by hand only undoes an unspent mana tap; attackers stay tapped
const CC = require('./cards');
const WANT = ['Forest', 'Serra Angel', 'Lórien Revealed', 'Mental Journey', 'Ravenform', 'Entreat the Angels', 'Electrodominance', 'Hidden Strings', 'Cut Your Losses', 'Collective Resistance',
  'Collective Effort', "Vona's Hunger", 'Perch Protection', "Dawn's Truce", 'Into the Flood Maw', 'Three Tree City', 'Llanowar Elves', 'Tifa, Martial Artist',
  'Jace, the Mind Sculptor', 'Karn, the Great Creator', 'Flickerwisp', 'Claim Jumper', 'Skittering Cicada', 'Level Up', 'Dovin, Hand of Control', 'Noggle the Mind',
  'Sol Ring', 'Shock', 'Summons of Saruman', 'Grizzly Bears', 'Plains', 'Lightning Bolt', 'Birds of Paradise', 'Arcane Signet', 'Wild Growth', 'Divination'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
CC.cards.push(...CC.topCards('extra.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }).catch(() => {}); await sleep(200); } };
// answers prompts: choice → first enabled option matching window.__want (else the first); pick → window.__pick (count) or 1;
// target → window.__tgt ('opp' | 'me' | a name regex); number → window.__X ?? its default. Every title is recorded.
const AUTO = () => { setInterval(() => { const m = UI.modal; if (!m || m.__done) return; (window.__titles = window.__titles || []).push(m.title || m.type);
  try {
    if (m.type === 'pick' && m.resolve){ const want = window.__pick ?? 1; const n = Math.max(m.min || 0, Math.min(want, m.max ?? 1)); m.__done = 1; m.resolve((m.cards || []).slice(0, n).map(c => c.id)); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const w = window.__want ? new RegExp(window.__want, 'i') : null; const os = (m.options || []).filter(x => !x.disabled); const o = (w && os.find(x => w.test(x.label))) || os[0]; m.__done = 1; m.resolve(o ? o.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ const t = window.__tgt || 'opp'; const ok = (m.cands || []).filter(c => c.ok !== false);
      const pick = t === 'opp' ? ok.find(c => c.pid && c.pid !== MYPID) : t === 'me' ? ok.find(c => c.pid === MYPID && c.t !== 'player') : t === 'kim' ? ok.find(c => c.t === 'player' && c.pid !== MYPID) : ok.find(c => new RegExp(t, 'i').test(c.nm || c.label || ''));
      m.__done = 1; m.resolve(pick ? [pick] : []); closeModal(); }
    else if (m.run){ (window.__asks = window.__asks || []).push(m.title); m.__done = 1; m.run(window.__X ?? m.def ?? 1); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { await T(120000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if ((H.fails() > f0 || process.env.LOGS) && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-16).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r18d');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r18d');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const after = async () => { await sleep(500); await settle([A, B]); await sleep(1200); await settle([A, B]); await sleep(500); };
  const reset = p => p.evaluate(() => { UI.notes = []; window.__asks = []; window.__titles = []; window.__want = null; window.__pick = null; window.__tgt = null; window.__X = null; });
  const notes = p => p.evaluate(() => (UI.notes || []).map(x => x.name + ': ' + x.text));
  const noNotes = async (what) => { const a = await notes(A), b = await notes(B); check(!a.length && !b.length, `${what}: no "do by hand" notes (${JSON.stringify(a.concat(b))})`); };
  // a card from anywhere in my zones into my hand / onto the battlefield (not summoning sick)
  const toHand = (p, nm) => p.evaluate(nm => { for (const z of ['lib', 'gy', 'ex', 'bf', 'hand']){ const c = S[z].find(x => cname(x) === nm); if (c){ if (z !== 'hand'){ S[z].splice(S[z].indexOf(c), 1); reset(c); S.hand.push(c); } commit(); return c.id; } } return null; }, nm);
  const put = (p, nm) => p.evaluate(nm => { for (const z of ['lib', 'hand', 'gy', 'ex']){ const c = S[z].find(x => cname(x) === nm); if (c){ moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id); if (b){ b.sk = false; b.tap = false; } commit(); return c.id; } } return null; }, nm);
  const cast = (p, nm, pool, o) => p.evaluate(([nm, pool, o]) => { const c = S.hand.find(x => cname(x) === nm); if (!c) return 'not in hand'; S.pool = {...emptyPool(), ...pool}; beginCast(c, 'hand', o || {}); return 'ok'; }, [nm, pool, o || null]);
  const clear = p => p.evaluate(() => { S.bf.filter(c => !isLand(c.k) || c.tok).forEach(c => { if (c.tok || c.emb) S.bf.splice(S.bf.indexOf(c), 1); else moveCard(c.id, 'lib', {quiet:true}); }); S.stk = []; S.dly = []; commit(); });
  const count = (p, nm) => p.evaluate(nm => S.bf.filter(c => cname(c) === nm).reduce((a, c) => a + (c.n || 1), 0), nm);
  // back to Georges's precombat main phase (an end step passes the turn to Kim)
  const myTurn = async () => { for (let i = 0; i < 6; i++){ if (await A.evaluate(() => currentTurn()[1] === MYPID)) break; await B.evaluate(() => { if (currentTurn()[1] === MYPID){ S.stk = []; passTurn(); } }); await sleep(2500); await settle([A, B]); }
    await A.evaluate(() => { if (phaseNow().ph !== 3) setPhase(3); commit(); }); await sleep(600); await settle([A, B]); };
  const combat = async (who) => {
    await A.evaluate(() => { if (phaseNow().ph !== 3) setPhase(3); if (S.cb) S.cb.step = 'end'; S.bf.forEach(c => { c.atk = ''; c.tap = false; c.sk = false; }); commit(); }); await sleep(400);
    await A.click('#phasebar [data-act="next"]').catch(() => {}); await waitFor(A, () => phaseNow().ph === 4, null, 8000); await passAll([B]);
    if (!(await A.evaluate(() => S.cb && S.cb.step === 'atk'))) await A.evaluate(() => nextAction());
    await waitFor(A, () => S.cb && S.cb.step === 'atk', null, 8000);
    await A.evaluate((w) => { const e = S.bf.find(c => cname(c) === w); e.sk = false; e.tap = false; S.bf.forEach(c => { if (c !== e) c.atk = ''; }); UI.atkSel = {[e.id]:'p:' + opponents()[0].pid}; renderCombatPanel(); }, who);
    await A.click('#cbpanel [data-act="atkGo"]'); await passAll([A, B]);
    await waitFor(B, () => !!document.querySelector('#cbpanel [data-act="blkGo"]'), null, 8000);
    await B.click('#cbpanel [data-act="blkGo"]').catch(() => {});
    for (let i = 0; i < 12; i++){ await passAll([A, B]); if (await A.evaluate(() => phaseNow().ph === 5)) break; }
    await sleep(1200); await settle([A, B]); await sleep(600);
  };
  try {
    await A.evaluate(() => { UI.strict = true; UI.fixUntil = 0; for (let i = 0; i < 2; i++){ const c = S.lib.find(x => cname(x) === 'Plains'); if (c) moveCard(c.id, 'bf', {quiet:true}); } commit(); });
    await put(A, 'Grizzly Bears'); await sleep(400);
    const bearId = await A.evaluate(() => S.bf.find(c => cname(c) === 'Grizzly Bears').id);
    const landId = await A.evaluate(() => S.bf.find(c => cname(c) === 'Plains' && !c.tap).id);

    await step('face down: no "Play face down" / "Turn face down" without a card that allows it', async () => {
      await toHand(A, 'Shock');
      const h = await A.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Shock'); cardMenu(c.id, 100, 100); const s = $('#menu').innerHTML; closeMenu(); return s; });
      check(!/Play face down/.test(h), 'hand menu has no "Play face down"');
      const b = await A.evaluate(id => { cardMenu(id, 100, 100); const s = $('#menu').innerHTML; closeMenu(); return s; }, bearId);
      check(!/Turn face down/.test(b), 'battlefield menu has no "Turn face down"');
      await A.evaluate(id => { const el = document.createElement('button'); el.dataset.id = id; ACT.fd(el); }, bearId);
      check(await A.evaluate(id => !find(id)[2].fd, bearId), 'the face-down action is refused (Bears stay face up)');
      await A.evaluate(id => { UI.fixUntil = Date.now() + 60000; const el = document.createElement('button'); el.dataset.id = id; ACT.fd(el); }, bearId);
      check(await A.evaluate(id => !!find(id)[2].fd, bearId), '"Fix something by hand" still allows it');
      await A.evaluate(id => { find(id)[2].fd = false; UI.fixUntil = 0; commit(); }, bearId);
    });

    await step('untapping a land whose mana is still in the pool takes the mana back', async () => {
      await A.evaluate(async id => { S.pool = emptyPool(); const c = find(id)[2]; c.tap = false; const o = tapOptions(c)[0]; await activateMana(c, o.ab, o.ci); }, landId);
      check(await A.evaluate(id => find(id)[2].tap && S.pool.W === 1, landId), 'tapped Plains for {W}');
      const m = await A.evaluate(id => { cardMenu(id, 100, 100); const s = $('#menu').innerHTML; closeMenu(); return s; }, landId);
      check(/undo, takes back/.test(m), 'its menu says Untap is an undo that takes the mana back');
      await A.evaluate(id => tapToggle(id), landId);
      check(await A.evaluate(id => !find(id)[2].tap && S.pool.W === 0, landId), 'untapped it and the {W} left the pool');
    });

    await step('a land whose mana was spent stays tapped', async () => {
      await A.evaluate(async id => { S.pool = emptyPool(); const c = find(id)[2]; const o = tapOptions(c)[0]; await activateMana(c, o.ab, o.ci); S.pool.W = 0; commit(); }, landId);
      await A.evaluate(id => tapToggle(id), landId);
      check(await A.evaluate(id => find(id)[2].tap && S.pool.W === 0, landId), 'still tapped, no mana regained');
      const m = await A.evaluate(id => { cardMenu(id, 100, 100); const s = $('#menu').innerHTML; closeMenu(); return s; }, landId);
      check(/only a card or the untap step/.test(m), 'its menu says only a card or the untap step can untap it');
    });

    await step('a creature tapped by attacking stays tapped (during and after combat)', async () => {
      await A.evaluate(id => { const c = find(id)[2]; c.tap = true; c.atk = 'p:' + opponents()[0].pid; commit(); }, bearId);
      await A.evaluate(id => tapToggle(id), bearId);
      check(await A.evaluate(id => find(id)[2].tap, bearId), 'attacking Bears: Untap refused');
      await A.evaluate(id => { find(id)[2].atk = ''; commit(); }, bearId);
      await A.evaluate(id => tapToggle(id), bearId);
      check(await A.evaluate(id => find(id)[2].tap, bearId), 'after combat: still refused');
      await A.evaluate(id => { UI.fixUntil = Date.now() + 60000; tapToggle(id); }, bearId);
      check(await A.evaluate(id => !find(id)[2].tap, bearId), '"Fix something by hand" can untap it (logged)');
      check(await A.evaluate(() => S.log.slice(-3).some(e => /fixed by hand/.test(e.s))), 'the fix is in the log for the table');
      await A.evaluate(() => { UI.fixUntil = 0; });
    });

    await step('tapping by hand and the untap step still work', async () => {
      await A.evaluate(id => tapToggle(id), bearId);
      check(await A.evaluate(id => find(id)[2].tap, bearId), 'Tap (no mana) still taps');
      await A.evaluate(() => { passTurn(); }); await sleep(1500);
      await B.evaluate(() => { passTurn(); }); await sleep(2500); await settle([A, B]);
      check(await A.evaluate(id => !find(id)[2].tap, bearId), 'the untap step untapped the Bears');
    });

    await step('a vigilance creature does not tap to attack', async () => {
      await A.evaluate(id => { const c = find(id)[2]; c.tap = false; c.sk = false; c.kwx = (c.kwx || []).concat('vigilance'); commit(); }, bearId);
      const vig = await A.evaluate(id => kwOf(find(id)[2], 'vigilance'), bearId);
      if (vig){ await combat('Grizzly Bears'); check(await A.evaluate(id => !find(id)[2].tap, bearId), 'Bears with vigilance attacked and stayed untapped'); }
      else console.log('    (skipped: no vigilance grant in this harness — vigilance attackers are untouched by fix18d)');
    });
  } catch (e){ console.log('FATAL', e); check(false, 'test ran'); }
  console.log(`\n${H.results.filter(r => r.startsWith('PASS')).length} passed, ${H.fails()} failed`);
  await browser.close(); server.close(); process.exit(H.fails() ? 1 : 0);
})();
