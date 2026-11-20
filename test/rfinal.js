// FINAL TEST — a 4-player bracket-4 Commander game with real decks and real Oracle text:
// Georges: Grand Arbiter Augustin IV stax · Kim: Elminster · Noor: Edgar Markov · Sam: Kraum + Tymna (Blue Farm)
process.env.ALL = '1';
const H = require('./h'); const {check, sleep, waitFor} = H; const fs = require('fs');
const clean = t => t.split('\n').map(l => l.replace(/\s*\([A-Z0-9]{2,6}\)\s*[\w★-]*\s*(\*F\*)?\s*$/, '')).join('\n');
const deck = n => clean(fs.readFileSync(__dirname + '/../decks/' + n + '.txt', 'utf8'));
const AUTO = () => { window.__want = window.__want || null; window.__modals = []; const om = openModal; openModal = m => { window.__modals.push({t:m.title || m.type, n:(m.cards || []).length, type:m.type}); return om(m); };
  setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ /* answered by the test */ }
    else if (m.type === 'zone' && (m.eng || m.dests)){ m.__done = 1; setTimeout(() => { if (UI.modal === m) closeModal(); }, 250); }
    else if (m.run){ m.__done = 1; const d = m.def ?? 1; m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
let P = {}; let ALLP = [];
const passAll = async (ps = ALLP) => { for (let i = 0; i < 4; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }).catch(() => {}); await sleep(150); } };
const settle = async () => { for (let i = 0; i < 25; i++){ await passAll(); const busy = await Promise.all(ALLP.map(p => p.evaluate(() => stackAll().length || UI.resolving ? 1 : 0))); if (!busy.some(Boolean)) return; await sleep(150); }
  const st = await Promise.all(ALLP.map(p => p.evaluate(() => ({nm:S.nm, stack:stackAll().map(i => i.nm + '/' + (i.pid === MYPID ? 'me' : nameOf(i.pid))), modal:UI.modal && (UI.modal.type + ':' + (UI.modal.title || '')), box:!!myBox(), res:!!UI.resolving}))));
  console.log('    [stuck]', JSON.stringify(st)); };
const active = async () => { for (const [n, p] of Object.entries(P)) if (await p.evaluate(() => currentTurn()[1] === MYPID)) return n; return null; };
async function toMain(n){ const p = P[n]; for (let i = 0; i < 40; i++){ const ph = await p.evaluate(() => phaseNow().ph); if (ph === 3) return true; if (ph < 3) await p.evaluate(() => { if (!stackAll().length && !UI.modal) nextAction(); }).catch(() => {}); await passAll(); await sleep(200); } return false; }
async function toTurn(n){ for (let i = 0; i < 12; i++){ const a = await active(); if (a === n) break; if (!a){ await sleep(500); continue; } await P[a].evaluate(() => passTurn()); await sleep(700); } await settle(); return toMain(n); }
const cardFrom = (p, name, zones = ['lib', 'hand', 'gy', 'cz', 'ex']) => p.evaluate(([n, zs]) => { for (const z of zs){ const c = S[z].find(c => cname(c) === n || cname(c).startsWith(n + ' //')); if (c) return {z, id:c.id}; } return null; }, [name, zones]);
async function put(p, name){ const r = await p.evaluate(n => { for (const z of ['lib', 'hand', 'gy', 'cz', 'ex']){ const c = S[z].find(c => cname(c) === n); if (c){ moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id); if (b) b.sk = false; commit(); return true; } } return false; }, name); if (!r) console.log('    (put: no ' + name + ')'); return r; }
async function give(p, name){ return p.evaluate(n => { for (const z of ['lib', 'gy', 'ex', 'bf', 'cz']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.hand.push(c); commit(); return true; } } return false; }, name); }
const lands = (p, list) => p.evaluate(ls => { for (const n of ls){ const c = S.lib.find(c => cname(c) === n) || S.hand.find(c => cname(c) === n); if (c){ moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id); if (b){ b.tap = false; b.sk = false; } } } commit(); }, list);
const castChk = (p, name, zone = 'hand') => p.evaluate(([n, z]) => { const c = S[z].find(c => cname(c) === n); if (!c) return {ok:false, why:'not in ' + z}; const r = castCheck(c, z); const sc = spellCost(c, z); return {ok:r.ok, why:r.why || '', gen:sc.cost.gen, cost:costStr(sc.cost), notes:sc.notes}; }, [name, zone]);
async function cast(p, name, want){ const id = await p.evaluate(n => S.hand.find(c => cname(c) === n)?.id, name); if (id == null) return 'not in hand'; if (want) await p.evaluate(w => { window.__want = w; }, want); const r = await H.menuClick(p, id, /^Cast/); await sleep(600); await settle(); await sleep(400); await settle(); if (want) await p.evaluate(() => { window.__want = null; }); return r; }
const tap = (p, names) => p.evaluate(ns => { S.bf.forEach(c => { if (ns === '*' || ns.includes(cname(c))) c.tap = true; }); commit(); }, names);
const mana = (p, pool) => p.evaluate(pl => { S.pool = {...emptyPool(), ...pl}; commit(); }, pool);
const modalsOf = p => p.evaluate(() => { const m = window.__modals.slice(); window.__modals.length = 0; return m; });
const logTail = (p, n = 8) => p.evaluate(k => S.log.slice(-k).map(e => e.s).join(' | '), n);
let PA = null; const step = async (name, fn) => { console.log('— ' + name); const f0 = H.fails(); try { await fn(); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); } };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const t0 = Date.now();
  P.Georges = await H.player(browser, 'Georges', deck('gaa'), 'host', 'final-stax');
  P.Kim = await H.player(browser, 'Kim', deck('elminster'), 'join', 'final-stax');
  P.Noor = await H.player(browser, 'Noor', deck('edgar'), 'join', 'final-stax');
  P.Sam = await H.player(browser, 'Sam', deck('bluefarm'), 'join', 'final-stax');
  ALLP = Object.values(P); const {Georges:G, Kim:K, Noor:N, Sam:Sm} = P;
  await step('Four players at one table with real decks', async () => {
    for (const [n, p] of Object.entries(P)) check(await waitFor(p, () => OPP.size === 3, null, 15000), `${n} sees all three opponents`);
    const cmds = await Promise.all(ALLP.map(p => p.evaluate(() => S.cz.map(cname).join(' + '))));
    console.log('    commanders:', cmds.join(' | '));
    check(cmds[0] === 'Grand Arbiter Augustin IV' && cmds[1] === 'Elminster' && cmds[2] === 'Edgar Markov' && /Kraum/.test(cmds[3]) && /Tymna/.test(cmds[3]), 'each player has the right commander(s)');
    const sizes = await Promise.all(ALLP.map(p => p.evaluate(() => S.lib.length + S.hand.length + S.cz.length)));
    console.log('    deck sizes:', sizes.join(', '));
  });
  for (const p of ALLP) await p.evaluate(AUTO);
  await G.click('[data-act="goFirst"]'); await settle(); await toMain('Georges');

  /* ---------------- Part 1: automatic effects, before the lock ---------------- */
  await step('Approach of the Second Sun (Georges): 7 life, 7th from the top, no prompt', async () => {
    await lands(G, ['Island', 'Plains', 'Command Tower', 'Glacial Fortress']); await give(G, 'Approach of the Second Sun'); await mana(G, {W:7});
    const life0 = await G.evaluate(() => S.life);
    const r = await cast(G, 'Approach of the Second Sun');
    const st = await G.evaluate(() => [S.life, S.lib.findIndex(c => cname(c) === 'Approach of the Second Sun'), (S.castHist || []).length]);
    console.log('    cast:', r, 'life', life0, '→', st[0], 'library position', st[1]);
    check(st[0] === life0 + 7, 'gained 7 life'); check(st[1] === 6, 'Approach is 7th from the top');
  });
  await step('Rhystic Study (Sam) + Mystic Remora (Sam): Georges casts a noncreature spell → taxes asked on Georges’s screen, Sam draws if unpaid', async () => {
    await put(Sm, 'Rhystic Study'); await put(Sm, 'Mystic Remora'); await sleep(800);
    const h0 = await Sm.evaluate(() => S.hand.length);
    await give(G, 'Preordain'); await mana(G, {U:1}); await G.evaluate(() => { window.__want = "Don't|No|Decline|not"; });
    await cast(G, 'Preordain'); await sleep(2500); await settle();
    const h1 = await Sm.evaluate(() => S.hand.length); const gm = await modalsOf(G);
    console.log('    Georges prompts:', gm.map(m => m.t).join(' / '), '| Sam hand', h0, '→', h1);
    check(gm.some(m => /Rhystic/i.test(m.t)), 'Georges was asked about Rhystic Study on his own screen');
    check(gm.some(m => /Remora/i.test(m.t)), 'Georges was asked about Mystic Remora on his own screen');
    check(h1 - h0 >= 2, `Sam drew for both (+${h1 - h0})`);
    await G.evaluate(() => { window.__want = null; });
  });
  await step('Necropotence (Noor): pay 1 life → card exiled face down, comes to hand at end step', async () => {
    await put(N, 'Necropotence'); await lands(N, ['Swamp']);
    const r = await N.evaluate(async () => { const c = S.bf.find(c => cname(c) === 'Necropotence'); const ab = abilityList(c).find(a => /pay 1 life/i.test(a.cost || a.line || '')); if (!ab) return 'no ability: ' + JSON.stringify(abilityList(c).map(a => a.line || a.cost)); const l0 = S.life, e0 = S.ex.length; await activateAbility(c, ab); return [l0, S.life, e0, S.ex.length, (S.necro || []).length]; });
    await settle(); const after = await N.evaluate(() => [S.life, S.ex.length, (S.necro || []).length]);
    console.log('    necro:', JSON.stringify(r), JSON.stringify(after));
    check(Array.isArray(r) && after[2] >= 1, 'a card was set aside face down for the end step');
  });
  await step('Kim’s turn — Elminster +2 draws and scries 2, then the next instant costs 2 less', async () => {
    await toTurn('Kim'); await lands(K, ['Island', 'Island', 'Plains', 'Tundra']);
    await put(K, 'Elminster'); await sleep(400);
    const r = await K.evaluate(() => ({h0:S.hand.length, id:S.bf.find(c => cname(c) === 'Elminster').id}));
    await K.dblclick(`.card[data-id="${r.id}"]`); await K.waitForSelector('#modal [data-act="pwGo"]', {timeout:5000}); await K.click('#modal [data-act="pwGo"][data-i="0"]');
    await settle(); await sleep(800); await settle();
    const st = await K.evaluate(() => ({hand:S.hand.length, red:(S.nextRed || []).map(r => r.n), loy:(S.bf.find(c => cname(c) === 'Elminster') || {}).co}));
    console.log('    elminster:', JSON.stringify(r), JSON.stringify(st));
    check(st.hand === r.h0 + 1, 'drew a card'); check(st.red.includes(2), 'next instant or sorcery costs {2} less (scry 2)');
  });
  await step('Kraum (Sam): Kim casts her second spell this turn → Sam draws automatically', async () => {
    await put(Sm, "Kraum, Ludevic's Opus"); await sleep(600);
    const h0 = await Sm.evaluate(() => S.hand.length);
    await give(K, 'Brainstorm'); await give(K, 'Ponder'); await mana(K, {U:4});
    await cast(K, 'Brainstorm'); await cast(K, 'Ponder'); await sleep(1500); await settle();
    const h1 = await Sm.evaluate(() => S.hand.length);
    console.log('    Sam hand', h0, '→', h1, '|', await logTail(Sm, 4));
    check(h1 > h0, 'Sam drew a card off Kraum');
  });
  await step('Noor’s turn — Edgar’s eminence: casting a Vampire makes a 1/1 Vampire token from the command zone', async () => {
    await toTurn('Noor'); await lands(N, ['Swamp', 'Swamp', 'Plains']);
    await give(N, 'Knight of the Ebon Legion'); await mana(N, {B:1});
    const t0 = await N.evaluate(() => S.bf.filter(c => c.tok).reduce((a, c) => a + (c.n || 1), 0));
    await cast(N, 'Knight of the Ebon Legion'); await sleep(1200); await settle();
    const t1 = await N.evaluate(() => S.bf.filter(c => c.tok).reduce((a, c) => a + (c.n || 1), 0));
    console.log('    tokens', t0, '→', t1, '|', await logTail(N, 4));
    check(t1 === t0 + 1, 'one Vampire token created by Edgar from the command zone');
  });
  await step('Noor’s end step — the Necropotence card comes to her hand by itself', async () => {
    const h0 = await N.evaluate(() => [S.hand.length, (S.necro || []).length]);
    await N.evaluate(() => setPhase(6)); await sleep(1500); await settle();
    const h1 = await N.evaluate(() => [S.hand.length, (S.necro || []).length]);
    console.log('    hand/necro', JSON.stringify(h0), '→', JSON.stringify(h1));
    const lg = await N.evaluate(() => S.log.slice(-12).map(e => e.s).join(' | ')); check(h1[1] === 0 && /into their hand \(Necropotence\)/.test(lg), 'the face-down card went to her hand at the end step');
  });

  /* ---------------- Part 2: the Grand Arbiter lock ---------------- */
  const LOCK = ['Grand Arbiter Augustin IV', 'Thalia, Guardian of Thraben', 'Thalia, the Survivor', 'Sphere of Resistance', 'Thorn of Amethyst', 'Rule of Law', 'Archon of Emeria', 'Static Orb', 'Hushbringer', 'Blind Obedience', 'Drannith Magistrate', 'Narset, Parter of Veils', 'Propaganda', 'Ghostly Prison', 'Grand Abolisher', 'Lavinia, Azorius Renegade', 'Spelltithe Enforcer', 'Aven Mindcensor', 'Damping Sphere', 'Aura of Silence'];
  await step('Georges’s turn — the lock comes down: ' + LOCK.length + ' stax pieces', async () => {
    await toTurn('Georges');
    for (const n of LOCK) await put(G, n);
    await sleep(2500);
    const seen = await K.evaluate(l => { const s = [...OPP.values()].find(x => x.nm === 'Georges'); return l.filter(n => (s.bf || []).some(b => info(b.k)?.n === n)).length; }, LOCK);
    check(seen === LOCK.length, `Kim's screen sees all ${LOCK.length} pieces on Georges's board (${seen})`);
    const eff = await K.evaluate(() => staticRules().length); console.log('    rules Kim’s engine reads:', eff);
  });
  await step('Grand Abolisher: Kim can’t cast an instant during Georges’s turn', async () => {
    await give(K, 'Swords to Plowshares'); await mana(K, {W:9});
    const r = await castChk(K, 'Swords to Plowshares'); console.log('    ', JSON.stringify(r));
    check(!r.ok, 'casting is blocked on Kim’s client');
  });
  await step('Georges’s own spells: Thalia +1, Sphere +1, Thorn +1, Grand Arbiter −1 (white)', async () => {
    await give(G, 'Swords to Plowshares'); const r = await castChk(G, 'Swords to Plowshares'); console.log('    ', JSON.stringify(r));
    check(r.gen === 2, `Swords costs {2}{W} for Georges (${r.cost})`);
  });
  await step('Kim’s turn — Static Orb: only two of her permanents untap', async () => {
    await tap(K, '*'); await sleep(500);
    await toTurn('Kim');
    const r = await K.evaluate(() => ({untapped:S.bf.filter(c => !c.tap && (isLand(c.k) || /Artifact|Creature/.test(typeOf(c)))).length, total:S.bf.length}));
    console.log('    ', JSON.stringify(r)); check(r.untapped <= 2, `at most two untapped (${r.untapped})`);
  });
  await step('Kim’s turn — taxes: a 1-mana instant costs {U} + 5 more (Arbiter, Thalia, Thalia the Survivor, Sphere, Thorn)', async () => {
    await give(K, 'Brainstorm'); await give(K, 'Mystic Sanctuary');
    const r = await castChk(K, 'Brainstorm'); console.log('    ', JSON.stringify(r));
    check(r.gen === 5, `Brainstorm costs ${r.cost} (${(r.notes || []).join(', ')})`);
  });
  await step('Lavinia: Kim can’t cast a noncreature spell with mana value above her land count', async () => {
    await give(K, 'Approach of the Second Sun'); await mana(K, {W:20});
    const r = await castChk(K, 'Approach of the Second Sun'); console.log('    ', JSON.stringify(r));
    check(!r.ok && /lavinia|lands/i.test(r.why), 'blocked by Lavinia');
  });
  await step('Rule of Law + Spelltithe Enforcer: Kim casts one spell (asked to pay {1} or sacrifice on her screen), then can’t cast a second', async () => {
    await mana(K, {U:12}); await K.evaluate(() => { window.__want = 'Pay|Yes'; });
    const r = await cast(K, 'Brainstorm'); await sleep(2500); await settle();
    const km = await modalsOf(K); console.log('    cast:', r, '| Kim prompts:', km.map(m => m.t).join(' / '));
    check(km.some(m => /Spelltithe/i.test(m.t)), 'Spelltithe Enforcer asked Kim on her own screen');
    await give(K, 'Ponder'); await mana(K, {U:12});
    const r2 = await castChk(K, 'Ponder'); console.log('    second spell:', JSON.stringify(r2));
    check(!r2.ok && /rule of law|one spell|archon/i.test(r2.why), 'second spell this turn is blocked');
    await K.evaluate(() => { window.__want = null; });
  });
  await step('Noor’s turn — Blind Obedience + Hushbringer + Archon: creature enters tapped with no ETB trigger; nonbasic land enters tapped', async () => {
    await toTurn('Noor');
    const r = await N.evaluate(() => { const fz = n => { for (const z of ['lib','hand','gy','ex']){ const c = S[z].find(c => cname(c) === n); if (c) return c; } }; const c = fz('Moonshaker Cavalry'); const l = fz('Isolated Chapel'); const s0 = stackAll().length; moveCard(c.id, 'bf'); moveCard(l.id, 'bf'); commit(); return s0; });
    await sleep(1200);
    const st = await N.evaluate(() => ({cav:S.bf.find(c => cname(c) === 'Moonshaker Cavalry')?.tap, chapel:S.bf.find(c => cname(c) === 'Isolated Chapel')?.tap, stack:stackAll().map(i => i.nm), trig:(S.prm || []).length, toks:S.bf.filter(c => c.tok && /Spirit/.test(cname(c))).length}));
    console.log('    ', JSON.stringify(st));
    check(st.cav === true, 'Moonshaker Cavalry entered tapped (Blind Obedience)');
    check(!st.stack.some(n => /Moonshaker/.test(n)) && st.toks === 0, 'no ETB trigger (Hushbringer)');
    check(st.chapel === true, 'Isolated Chapel entered tapped (Archon of Emeria)');
  });
  await step('Propaganda + Ghostly Prison: Noor can’t attack Georges without paying {4} per creature', async () => {
    await N.evaluate(() => { S.bf.filter(c => isCreatureCard(c)).forEach(c => { c.tap = false; c.sk = false; }); S.pool = emptyPool(); commit(); });
    const r = await N.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Knight of the Ebon Legion'); const g = opponents().find(p => p.nm === 'Georges'); const ca = canAttack(c); return {can:ca, tax:typeof attackTax === 'function' ? attackTax(g.pid) : null}; });
    console.log('    ', JSON.stringify(r));
    await N.click('#phasebar [data-act="next"]').catch(() => {}); await waitFor(N, () => phaseNow().ph === 4, null, 8000); await passAll();
    if (!(await N.evaluate(() => S.cb && S.cb.step === 'atk'))) await N.evaluate(() => nextAction());
    await waitFor(N, () => S.cb && S.cb.step === 'atk', null, 8000);
    await N.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Knight of the Ebon Legion'); const g = opponents().find(p => p.nm === 'Georges'); UI.atkSel = {[c.id]:'p:' + g.pid}; renderCombatPanel(); });
    await N.evaluate(() => { S.bf.forEach(c => { if (isLand(c.k) || /Artifact/.test(typeOf(c))) c.tap = true; }); commit(); });
    await N.click('#cbpanel [data-act="atkGo"]').catch(e => console.log('    atkGo:', e.message.split('\n')[0])); await sleep(1200);
    const r2 = await N.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Knight of the Ebon Legion'); return {atk:c.atk || '', log:S.log.slice(-4).map(e => e.s), modal:UI.modal && UI.modal.title}; });
    console.log('    declare:', JSON.stringify(r2));
    check(r2 && typeof r2 === 'object' && !r2.atk, 'the attack is refused with no mana for the {4} tax');
    // with her lands untapped, the engine taps them to pay the {4} by itself and the attack goes through
    await N.evaluate(() => { S.bf.forEach(c => { if (isLand(c.k)) c.tap = false; }); const c = S.bf.find(c => cname(c) === 'Knight of the Ebon Legion'); const g = opponents().find(p => p.nm === 'Georges'); UI.atkSel = {[c.id]:'p:' + g.pid}; commit(); renderCombatPanel(); });
    await N.click('#cbpanel [data-act="atkGo"]').catch(e => console.log('    atkGo2:', e.message.split('\n')[0])); await sleep(1200);
    const r3 = await N.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Knight of the Ebon Legion'); return {atk:c.atk || '', log:S.log.slice(-4).map(e => e.s)}; });
    console.log('    with lands:', JSON.stringify(r3));
    check(!!r3.atk && r3.log.some(l => /auto-tapped/.test(l)) && r3.log.some(l => /paid \{4\}/.test(l)), 'with lands untapped, the {4} is paid by auto-tapping and the attack goes through');
  });
  await step('Sam’s turn — Narset: Sam can’t draw a second card this turn', async () => {
    await toTurn('Sam');
    const r = await Sm.evaluate(() => { const h0 = S.hand.length; draw(1); return [h0, S.hand.length, S.drawnT === turnStr() ? S.drawn : '?']; });
    console.log('    ', JSON.stringify(r)); check(r[1] === r[0], 'the extra draw was stopped');
  });
  await step('Drannith Magistrate: Sam can’t cast Tymna from the command zone', async () => {
    await mana(Sm, {W:9, B:9});
    const r = await castChk(Sm, 'Tymna the Weaver', 'cz'); console.log('    ', JSON.stringify(r));
    check(!r.ok && /drannith|anywhere other than/i.test(r.why), 'blocked by Drannith Magistrate');
  });
  await step('Aven Mindcensor: Sam’s Demonic Tutor only searches the top four cards', async () => {
    await lands(Sm, ['Swamp', 'Underground Sea', 'Badlands', 'Blood Crypt']); await give(Sm, 'Demonic Tutor'); await mana(Sm, {B:20}); await Sm.evaluate(() => { window.__modals.length = 0; });
    const r = await cast(Sm, 'Demonic Tutor'); await sleep(1500); await settle();
    const ms = await modalsOf(Sm); console.log('    cast:', r, '| search windows:', JSON.stringify(ms.filter(m => m.type === 'pick')));
    const srch = ms.filter(m => m.type === 'pick' && /search|tutor/i.test(m.t));
    check(srch.length && srch.every(m => m.n <= 4), 'the search shows at most four cards');
  });
  await step('No page errors and nothing left for anyone to do by hand', async () => {
    const hw = await Promise.all(ALLP.map(p => p.evaluate(() => S.log.filter(e => /by hand|⚠|check it yourself/i.test(e.s)).map(e => e.s))));
    hw.forEach((l, i) => l.length && console.log('    ' + Object.keys(P)[i] + ' by-hand notes:', l.slice(-8).join(' | ')));
    check(hw.every(l => !l.length), 'no “do it by hand” notes in any log');
  });
  console.log(`\n${H.results.filter(r => r.startsWith('PASS')).length}/${H.results.length} passed in ${Math.round((Date.now() - t0) / 1000)}s`);
  fs.writeFileSync(process.env.OUTF || '/tmp/final.txt', H.results.join('\n'));
  await browser.close(); server.close(); process.exit(H.fails() ? 1 : 0);
})();
