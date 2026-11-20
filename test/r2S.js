process.env.TOP = '1';
// Round 25S: cross-player protocols, played in a real 3-player game (Georges, Kim, Mo)
const CC = require('./cards');
const WANT = ["Hunter's Insight", 'Great Train Heist', 'Odric, Master Tactician', 'Brutal Hordechief', 'Minds Aglow', 'Collective Voyage', "Selvala's Stampede", 'Tenuous Truce',
  'Faramir, Prince of Ithilien', 'The Eternal Wanderer', 'Tragic Arrogance', 'Winnowing', 'Combustible Gearhulk', 'Reflector Mage', 'Meathook Massacre II', 'Champions of Minas Tirith',
  'Arcbond', 'Tamiyo, Field Researcher', 'Summon: Leviathan', 'Master Warcraft', 'Gix, Yawgmoth Praetor', 'Gift of Immortality', 'Grave Betrayal', "Avatar's Wrath",
  'Grizzly Bears', 'Llanowar Elves', 'Elvish Mystic', 'Wall of Omens', 'Mind Stone', 'Darksteel Ingot', 'Giant Growth', 'Elvish Visionary', 'Lightning Bolt', 'Sol Ring', 'Rhystic Study', 'Serra Angel'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, put, waitFor} = H;
const AUTO = () => { window.__want = window.__want || null; window.__tgt = window.__tgt || null; window.__num = null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ if (!window.__tgt) return; const re = new RegExp(window.__tgt, 'i'); const c = (m.cands || []).find(x => x.ok && re.test(x.nm)); if (!c) return; m.__done = 1; m.resolve([c]); closeModal(); }
    else if (m.type === 'split' && m.resolve){ m.__done = 1; m.resolve(m.plan); closeModal(); }
    else if (m.run){ m.__done = 1; const d = window.__num != null ? window.__num : (m.def ?? 1); m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
let ALL = [];
const passAll = async (ps = ALL) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(150); } };
const settle = async (ps = ALL) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const after = async () => { await sleep(500); await settle(); await sleep(1200); await settle(); await sleep(500); };
const toHand = (p, n) => p.evaluate(n => { for (const z of ['lib', 'gy', 'ex', 'bf']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.hand.push(c); commit(); return c.id; } } return S.hand.find(c => cname(c) === n)?.id; }, n);
const cast = (p, n) => p.evaluate(async n => { const c = S.hand.find(x => cname(x) === n); if (!c) return 'not in hand'; S.pool = {...emptyPool(), W:6, U:6, B:6, R:6, G:6, C:6}; commit(); await beginCast(c, 'hand'); return S.hand.includes(c) ? 'not cast' : 'ok'; }, n);
const toGy = (p, n) => p.evaluate(n => { const c = S.bf.find(x => cname(x) === n); if (c){ moveCard(c.id, 'gy', {quiet:true}); commit(); return true; } return false; }, n);
const run = (p, txt, nm, extra) => p.evaluate(async ([txt, nm, extra]) => { const k = [...DICT.values()].find(a => a.n === nm)?.k || null; const ctx = {k, name:nm, full:txt, ...(extra || {})};
  if (extra && extra.tgtName){ const [who, card] = extra.tgtName; const pid = who === 'me' ? MYPID : [...OPP.keys()].find(x => nameOf(x) === who); const c = (pid === MYPID ? S.bf : OPP.get(pid).bf).find(b => b.k && info(b.k)?.n === card); ctx.tgts = [[{t:'card', pid, id:c.id, k:c.k, nm:card}]]; }
  if (extra && extra.tgtPlayer){ const pid = [...OPP.keys()].find(x => nameOf(x) === extra.tgtPlayer); ctx.tgts = [[{t:'player', pid, nm:extra.tgtPlayer}]]; }
  if (extra && extra.src){ const c = S.bf.find(b => cname(b) === extra.src); if (c){ ctx.srcId = c.id; ctx.k = c.k; } }
  await runEffects(txt, ctx); commit(); return 'ok'; }, [txt, nm, extra]);
const pidOf = (p, nm) => p.evaluate(nm => nm === S.nm ? MYPID : [...OPP.keys()].find(x => nameOf(x) === nm), nm);
const cnt = (p, re) => p.evaluate(re => S.bf.filter(c => new RegExp(re).test(cname(c))).reduce((a, c) => a + (c.n || 1), 0), re);
const handN = p => p.evaluate(() => S.hand.length);
const life = p => p.evaluate(() => S.life);
const clean = async (p) => { await p.evaluate(() => { S.bf.filter(c => !isLand(c.k)).forEach(c => { S.bf.splice(S.bf.indexOf(c), 1); if (!c.tok && !c.emb){ reset(c); S.lib.push(c); } }); S.stk = []; S.dly = []; commit(); }); await sleep(300); };
let PA = null, PB = null, PC = null;
const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails();
  try { await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), 90000))]); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB], ['Mo', PC]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2s');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2s');
  const C = await H.player(browser, 'Mo', H.deckFor('Krenko, Mob Boss'), 'join', 'r2s');
  PA = A; PB = B; PC = C; ALL = [A, B, C];
  await waitFor(A, () => OPP.size === 2, null, 15000); await A.click('[data-act="goFirst"]');
  await settle(); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  for (const p of ALL) await p.evaluate(AUTO);
  const KIM = await pidOf(A, 'Kim'), MO = await pidOf(A, 'Mo'), GEO = await A.evaluate(() => MYPID);
  // Georges attacks the given player with the named creatures; blocks are left to the defenders (or to whoever controls them)
  const combat = async (atk, defName, opt = {}) => {
    await A.evaluate(() => { if (phaseNow().ph !== 3) setPhase(3); if (S.cb) S.cb.step = 'end'; S.bf.forEach(c => { c.atk = ''; c.tap = isLand(c.k) ? c.tap : false; c.sk = false; }); commit(); }); await sleep(400);
    await A.click('#phasebar [data-act="next"]').catch(() => {}); await waitFor(A, () => phaseNow().ph === 4, null, 8000); await passAll([B, C]);
    if (!(await A.evaluate(() => S.cb && S.cb.step === 'atk'))) await A.evaluate(() => nextAction());
    await waitFor(A, () => S.cb && S.cb.step === 'atk', null, 8000);
    if (opt.beforeAtk) await opt.beforeAtk();
    await A.evaluate(([names, def]) => { UI.atkSel = {}; const pid = [...OPP.keys()].find(x => nameOf(x) === def); S.bf.filter(c => names.includes(cname(c))).forEach(c => { UI.atkSel[c.id] = 'p:' + pid; }); renderCombatPanel(); declareAttackers(); }, [atk, defName]);
    await sleep(300); await after();
    const D = defName === 'Kim' ? B : C;
    if (!opt.noBlockConfirm){ for (let i = 0; i < 20; i++){ await passAll(); const st = await A.evaluate(() => S.cb && S.cb.step); if (st !== 'atk' && st !== 'atkd' && st !== 'blk') break; if (st === 'blk' && !opt.ctl){ await D.evaluate(() => { const pn = phaseNow(); const cb = cbOf(pn); if (cb && cb.step === 'blk' && (S.bd || '') !== cbKey(pn, cb)){ UI.blkSel = {}; confirmBlocks(false); } }); } await sleep(300); } }
    const blk = await D.evaluate(() => S.bf.filter(c => c.blk != null).map(c => cname(c)));
    for (let i = 0; i < 20; i++){ await passAll(); if (await A.evaluate(() => phaseNow().ph === 5)) break; await sleep(200); }
    await sleep(1000); await after();
    return {blk};
  };
  try {
    await step("Hunter's Insight: the chosen creature hits Kim — Georges draws that many cards", async () => {
      await put(A, 'Grizzly Bears'); await after();
      await A.evaluate(() => { window.__tgt = 'Grizzly'; }); await toHand(A, "Hunter's Insight"); check(await cast(A, "Hunter's Insight") === 'ok', "cast Hunter's Insight on Grizzly Bears"); await after(); await A.evaluate(() => { window.__tgt = null; });
      check(await A.evaluate(() => S.bf.some(c => c.r25 && c.r25.exp === 'eot')), 'a delayed trigger bound to Grizzly Bears is waiting this turn');
      const h0 = await handN(A); const L0 = await life(B);
      await combat(['Grizzly Bears'], 'Kim');
      const h1 = await handN(A); const L1 = await life(B);
      check(L1 === L0 - 2, `Kim took 2 combat damage (${L0} → ${L1})`);
      check(h1 === h0 + 2, `Georges drew 2 cards — that many (${h0} → ${h1})`);
    });
    await step('Great Train Heist mode: whenever a creature deals combat damage to Kim this turn, a tapped Treasure', async () => {
      await run(A, 'Choose target opponent. Whenever a creature you control deals combat damage to that player this turn, create a tapped Treasure token.', 'Great Train Heist', {tgtPlayer:'Kim'});
      const t0 = await cnt(A, 'Treasure');
      await combat(['Grizzly Bears'], 'Kim');
      check(await cnt(A, 'Treasure') === t0 + 1, `Georges created a Treasure when Grizzly Bears hit Kim (${t0} → ${await cnt(A, 'Treasure')})`);
      const mo0 = await cnt(A, 'Treasure'); await combat(['Grizzly Bears'], 'Mo'); check(await cnt(A, 'Treasure') === mo0, 'no Treasure for hitting Mo (only Kim was chosen)');
    });
    await step('Delayed triggers end with the turn', async () => {
      const n = await A.evaluate(kim => { const c = S.bf.filter(c => c.r25).length; const was = currentTurn; const t = currentTurn(); currentTurn = () => [t[0] + 1, kim, t[2] || 0]; try { turnChanged(); } finally { currentTurn = was; } commit(); return [c, S.bf.filter(c => c.r25).length]; }, KIM);
      check(n[0] >= 1 && n[1] === 0, `the "this turn" delayed triggers are gone after the turn changes (${n[0]} → ${n[1]})`);
    });
    await step('Odric: Georges chooses how Kim\'s creatures block', async () => {
      await put(B, 'Wall of Omens'); await put(B, 'Llanowar Elves'); await after();
      await A.evaluate(() => { window.__want = 'Block Grizzly'; });
      await run(A, 'You choose which creatures block this combat and how those creatures block.', 'Odric, Master Tactician');
      await sleep(800);
      check(await B.evaluate(() => !!(S.r25ctlBy && S.r25ctlBy.t === turnStr())), "Kim's client knows Georges chooses her blocks");
      const L0 = await life(B);
      const r = await combat(['Grizzly Bears'], 'Kim', {ctl:true});
      const lg = await B.evaluate(() => S.log.map(e => e.s).filter(x => /chosen by Georges/.test(x)).pop() || '');
      check(/Wall of Omens → Grizzly Bears/.test(lg) && /Llanowar Elves → Grizzly Bears/.test(lg), `Kim's Wall of Omens and Llanowar Elves block as Georges chose (${lg})`);
      check(await life(B) === L0, 'Kim took no damage (Grizzly Bears was blocked)');
      await A.evaluate(() => { window.__want = null; });
    });
    await step('Brutal Hordechief: Mo\'s creatures must block and Georges chooses how', async () => {
      await put(C, 'Elvish Mystic'); await put(C, 'Elvish Visionary'); await after();
      await A.evaluate(() => { S.r25ctl = null; commit(); });
      await run(A, 'Creatures your opponents control block this turn if able, and you choose how those creatures block.', 'Brutal Hordechief'); await sleep(600);
      check(await C.evaluate(() => !!(S.r25ctlBy && S.r25ctlBy.must)), "Mo's client knows its creatures must block");
      const r = await combat(['Grizzly Bears'], 'Mo', {ctl:true});
      const lg = await C.evaluate(() => S.log.map(e => e.s).filter(x => /chosen by Georges/.test(x)).pop() || '');
      check(/Elvish Mystic → Grizzly Bears/.test(lg) && /Elvish Visionary → Grizzly Bears/.test(lg), `both of Mo's untapped creatures blocked (no "doesn't block" option): ${lg}`);
    });
    await step('Join forces (3 players): Minds Aglow — Georges pays 2, Kim 1, Mo 0 → everyone draws 3', async () => {
      await A.evaluate(() => { window.__want = 'Pay \\{2\\}'; }); await B.evaluate(() => { window.__want = 'Pay \\{1\\}'; S.pool = {...emptyPool(), C:3}; commit(); }); await C.evaluate(() => { window.__want = 'Pay nothing'; S.pool = {...emptyPool(), C:3}; commit(); });
      await toHand(A, 'Minds Aglow'); const h = [await handN(A), await handN(B), await handN(C)]; check(await cast(A, 'Minds Aglow') === 'ok', 'cast Minds Aglow'); await after(); await sleep(1500); await settle();
      const h2 = [await handN(A), await handN(B), await handN(C)];
      check(h2[0] === h[0] - 1 + 3, `Georges drew 3 (${h[0]} → ${h2[0]}, Minds Aglow left his hand)`);
      check(h2[1] === h[1] + 3 && h2[2] === h[2] + 3, `Kim and Mo drew 3 each (${h[1]} → ${h2[1]}, ${h[2]} → ${h2[2]})`);
      const pools = [await B.evaluate(() => poolTotal(S.pool)), await C.evaluate(() => poolTotal(S.pool))];
      check(pools[0] === 2 && pools[1] === 3, `Kim paid 1 from her own pool, Mo paid nothing (left ${pools.join(', ')})`);
      for (const p of ALL) await p.evaluate(() => { window.__want = null; });
    });
    await step('Join forces: Collective Voyage — 2 paid → each player fetches up to 2 basic lands tapped', async () => {
      await A.evaluate(() => { window.__want = 'Pay \\{1\\}|Plains|Island|Swamp|Mountain|Forest'; }); await B.evaluate(() => { window.__want = 'Pay \\{1\\}|Plains|Island|Swamp|Mountain|Forest'; S.pool = {...emptyPool(), C:3}; commit(); }); await C.evaluate(() => { window.__want = 'Pay nothing|Plains|Island|Swamp|Mountain|Forest'; });
      const l = []; for (const p of ALL) l.push(await p.evaluate(() => S.bf.filter(c => isLand(c.k)).length));
      await toHand(A, 'Collective Voyage'); await cast(A, 'Collective Voyage'); await after(); await sleep(1500); await settle();
      const l2 = []; for (const p of ALL) l2.push(await p.evaluate(() => S.bf.filter(c => isLand(c.k)).length));
      check(l2.every((n, i) => n === l[i] + 2), `each player put 2 basic lands onto the battlefield (${l.join('/')} → ${l2.join('/')})`);
      for (const p of ALL) await p.evaluate(() => { window.__want = null; });
    });
    await step("Council's dilemma (3 voters): Selvala's Stampede — 2 wild, 1 free", async () => {
      await A.evaluate(() => { window.__want = 'Wild'; }); await B.evaluate(() => { window.__want = 'Free'; }); await C.evaluate(() => { window.__want = 'Wild'; });
      await toHand(A, 'Sol Ring'); await A.evaluate(() => { window.__want = 'Wild|Sol Ring'; });
      // stack the library: land, Grizzly Bears, land, Llanowar Elves, … so the 2 wild votes reveal exactly those two vanilla-ish creatures
      await clean(A);
      await A.evaluate(() => { const take = n => { for (const z of ['lib', 'hand', 'gy', 'ex']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); return c; } } return null; }; const land = () => { const i = S.lib.findIndex(c => isLand(c.k)); return S.lib.splice(i, 1)[0]; };
        const top = [land(), take('Grizzly Bears'), land(), take('Llanowar Elves')].filter(Boolean); S.lib.unshift(...top); commit(); });
      const c0 = await A.evaluate(() => S.bf.filter(c => isCreatureCard(c)).length);
      await toHand(A, "Selvala's Stampede"); await cast(A, "Selvala's Stampede"); await after(); await sleep(1500); await settle();
      const c1 = await A.evaluate(() => S.bf.filter(c => isCreatureCard(c)).length);
      const rev = await A.evaluate(() => (S.log.map(e => e.s).filter(x => /revealed \d+ cards/.test(x)).pop() || ''));
      check(/revealed \d+ cards — [^,]+, [^,]+$/.test(rev) || (rev.match(/,/g) || []).length >= 1, `2 creature cards revealed for 2 wild votes (${rev})`);
      check(c1 === c0 + 2 && await A.evaluate(() => ['Grizzly Bears', 'Llanowar Elves'].every(n => S.bf.some(c => cname(c) === n))), `Grizzly Bears and Llanowar Elves entered (${c0} → ${c1})`);
      const lands = await A.evaluate(() => S.bf.filter(c => isLand(c.k)).length + ':' + S.ex.filter(c => isLand(c.k)).length);
      check(/:0$/.test(lands), `the two revealed lands went back into the library, not exile (${lands})`);
      check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Sol Ring')), 'Sol Ring (1 free vote) was put onto the battlefield from hand: ' + await A.evaluate(() => S.log.slice(-12).map(e => e.s).join(' | ')));
      for (const p of ALL) await p.evaluate(() => { window.__want = null; });
    });
    await step("Tenuous Truce: at Kim's end step Georges and Kim each draw", async () => {
      await clean(A); await put(A, 'Tenuous Truce'); await A.evaluate(kim => { const c = S.bf.find(x => cname(x) === 'Tenuous Truce'); c.att = {pid:kim, id:null}; commit(); }, KIM); await after();
      const h = [await handN(A), await handN(B)];
      await A.evaluate(mo => { fireSteps('end', mo); commit(); }, MO); await after();
      check(await handN(A) === h[0], "nothing at Mo's end step");
      await A.evaluate(kim => { fireSteps('end', kim); commit(); }, KIM); await after();
      check(await handN(A) === h[0] + 1 && await handN(B) === h[1] + 1, `both drew at Kim's end step (${h.join('/')} → ${await handN(A)}/${await handN(B)})`);
      await toGy(A, 'Tenuous Truce');
    });
    await step("Faramir: at Kim's next end step — draw if she didn't attack Georges, otherwise three Soldiers", async () => {
      await A.evaluate(() => { window.__want = 'Kim'; });
      const txt = "Choose an opponent. At the beginning of that player's next end step, you draw a card if they didn't attack you that turn. Otherwise, create three 1/1 white Human Soldier creature tokens.";
      await run(A, txt, 'Faramir, Prince of Ithilien'); await after();
      const h0 = await handN(A);
      await A.evaluate(mo => { fireSteps('end', mo); commit(); }, MO); await after();
      check(await handN(A) === h0, "not at Mo's end step");
      await A.evaluate(kim => { fireSteps('end', kim); commit(); }, KIM); await after();
      check(await handN(A) === h0 + 1, `Kim didn't attack: Georges drew (${h0} → ${await handN(A)})`);
      await run(A, txt, 'Faramir, Prince of Ithilien'); await after();
      await B.evaluate(geo => { const c = S.bf.find(x => isCreatureCard(x)) || S.bf[0]; emit({type:'attack', k:c.k, id:c.id, dp:geo}); commit(); }, GEO); await sleep(1200);
      const s0 = await cnt(A, 'Soldier'); await A.evaluate(kim => { fireSteps('end', kim); commit(); }, KIM); await after();
      check(await cnt(A, 'Soldier') === s0 + 3, `Kim attacked Georges: three Human Soldiers instead (${s0} → ${await cnt(A, 'Soldier')})`);
      await A.evaluate(() => { window.__want = null; });
    });
    await step("The Eternal Wanderer +1: Kim's creature returns at the beginning of Kim's next end step", async () => {
      await put(B, 'Grizzly Bears'); await after();
      await run(A, "Exile up to one target artifact or creature. Return that card to the battlefield under its owner's control at the beginning of that player's next end step.", 'The Eternal Wanderer', {tgtName:['Kim', 'Grizzly Bears']}); await after();
      check(await B.evaluate(() => S.ex.some(c => cname(c) === 'Grizzly Bears')), "Kim's Grizzly Bears is exiled");
      await B.evaluate(geo => { fireSteps('end', geo); commit(); }, GEO); await after();
      check(await B.evaluate(() => S.ex.some(c => cname(c) === 'Grizzly Bears')), "still exiled after Georges's end step");
      await B.evaluate(() => { fireSteps('end', MYPID); commit(); }); await after();
      check(await B.evaluate(() => S.bf.some(c => cname(c) === 'Grizzly Bears')), "returned at Kim's own end step");
    });
    await step('Tragic Arrogance (3 players): Georges picks what each player keeps', async () => {
      await clean(A); await clean(B); await clean(C);
      await put(A, 'Grizzly Bears'); await put(A, 'Llanowar Elves'); await put(A, 'Mind Stone');
      await put(B, 'Wall of Omens'); await put(B, 'Elvish Mystic'); await put(B, 'Sol Ring'); await put(B, 'Darksteel Ingot'); await put(B, 'Rhystic Study');
      await put(C, 'Elvish Visionary'); await put(C, 'Grizzly Bears'); await after();
      await A.evaluate(() => { window.__want = 'Grizzly|Mind Stone|Wall of Omens|Sol Ring|Rhystic|Elvish Visionary'; });
      await toHand(A, 'Tragic Arrogance'); await cast(A, 'Tragic Arrogance'); await after(); await sleep(1500); await settle();
      const nl = p => p.evaluate(() => S.bf.filter(c => !isLand(c.k) && !c.emb).map(cname).sort().join(','));
      const a = await nl(A), b = await nl(B), c = await nl(C);
      check(a === 'Grizzly Bears,Mind Stone', `Georges kept Grizzly Bears + Mind Stone (${a})`);
      check(b === 'Rhystic Study,Sol Ring,Wall of Omens', `Kim kept Wall of Omens, Sol Ring, Rhystic Study — chosen by Georges (${b})`);
      check(c === 'Elvish Visionary', `Mo kept Elvish Visionary (${c})`);
      await A.evaluate(() => { window.__want = null; });
    });
    await step('Combustible Gearhulk: Kim refuses — Georges mills 3, Kim takes damage equal to their total mana value', async () => {
      await B.evaluate(() => { window.__want = '^No$'; });
      const L0 = await life(B); const g0 = await A.evaluate(() => S.gy.length); const h0 = await handN(A);
      await run(A, 'Target opponent may have you draw three cards. If the player doesn\'t, you mill three cards, then Combustible Gearhulk deals damage to that player equal to the total mana value of those cards.', 'Combustible Gearhulk', {tgtPlayer:'Kim'});
      await after();
      const mv = await A.evaluate(() => S.gy.slice(-3).reduce((a, c) => a + (info(c.k)?.mv || 0), 0)); const L1 = await life(B);
      check(await A.evaluate(() => S.gy.length) === g0 + 3 && await handN(A) === h0, 'Georges milled 3 and drew nothing');
      check(L1 === L0 - mv, `Kim took ${mv} damage (${L0} → ${L1})`);
      await B.evaluate(() => { window.__want = '^Yes$'; });
      const h1 = await handN(A); await run(A, 'Target opponent may have you draw three cards. If the player doesn\'t, you mill three cards, then Combustible Gearhulk deals damage to that player equal to the total mana value of those cards.', 'Combustible Gearhulk', {tgtPlayer:'Kim'}); await after();
      check(await handN(A) === h1 + 3 && await life(B) === L1, 'Kim accepts: Georges draws 3, no damage');
      await B.evaluate(() => { window.__want = null; });
    });
    await step("Reflector Mage: Kim can't cast Grizzly Bears until Georges's next turn", async () => {
      await clean(B); await put(B, 'Grizzly Bears'); await after();
      await run(A, "Return target creature an opponent controls to its owner's hand. That creature's owner can't cast spells with the same name as that creature until your next turn.", 'Reflector Mage', {tgtName:['Kim', 'Grizzly Bears']}); await after();
      // judge it on Kim's own main phase, so sorcery timing isn't what refuses it (the name rule may live in castCheck or castLimit)
      const r = await B.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Grizzly Bears'); if (!c) return null; const was = currentTurn; const t = was(); const ph = S.ph; currentTurn = () => [t[0], MYPID, t[2] || 0]; S.ph = [t[2] || 0, t[0], 3]; try { return castCheck(c, 'hand'); } finally { currentTurn = was; S.ph = ph; } });
      check(r && !r.ok && /Reflector|spells named Grizzly Bears/.test(r.why), `on her own main phase, Kim's castCheck refuses Grizzly Bears by name (${r && r.why})`);
      const ok2 = await B.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Lightning Bolt') || S.hand.find(x => !isLand(x.k) && cname(x) !== 'Grizzly Bears'); if (!c) return {ok:true}; const was = currentTurn; const t = was(); const ph = S.ph; currentTurn = () => [t[0], MYPID, t[2] || 0]; S.ph = [t[2] || 0, t[0], 3]; try { return castCheck(c, 'hand'); } finally { currentTurn = was; S.ph = ph; } });
      check(!/spells named|Reflector/.test(ok2.why || ''), 'other spells are not affected by the name rule');
      const r2 = await B.evaluate(geo => { const was = currentTurn; currentTurn = () => [99, geo, 0]; const c = S.hand.find(x => cname(x) === 'Grizzly Bears'); try { return castCheck(c, 'hand'); } finally { currentTurn = was; } }, GEO);
      check(r2 && !/Reflector|spells named/.test(r2.why || ''), "the restriction ends on Georges's next turn");
    });
    await step("Meathook Massacre II: Kim's creature dies, she won't pay 3 life — Georges gets it with a finality counter", async () => {
      await clean(A); await clean(B); await put(A, 'Meathook Massacre II'); await after(); await B.evaluate(() => { window.__want = "Don't"; }); await put(B, 'Elvish Mystic'); await after();
      const L0 = await life(B);
      await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Elvish Mystic'); moveCard(c.id, 'gy'); commit(); }); await after(); await sleep(1500); await settle();
      const c = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Elvish Mystic'); return c ? (c.nc || {}).finality || 0 : -1; });
      check(c === 1, `Georges controls Elvish Mystic with a finality counter (${c})`);
      check(await life(B) === L0, 'Kim kept her life');
      await B.evaluate(() => { window.__want = null; }); await toGy(A, 'Meathook Massacre II');
    });
    await step("Champions of Minas Tirith: Kim doesn't pay — she can't attack Georges this combat", async () => {
      await A.evaluate(() => { becomeMonarch('test'); });
      await B.evaluate(() => { window.__want = "Don't"; while (S.hand.length < 2) draw(1); commit(); });
      const kimTrig = {it:{kind:'trigger', evPid:KIM}};
      await A.evaluate(async kim => { const ctx = {name:'Champions of Minas Tirith', full:"if you're the monarch, that opponent may pay {X}, where X is the number of cards in their hand. If they don't, they can't attack you this combat.", it:{kind:'trigger', evPid:kim}}; await runEffects(ctx.full, ctx); commit(); }, KIM); await after();
      const opts = await B.evaluate(() => defOpts().map(o => o.label));
      check(!opts.includes('Georges') && opts.includes('Mo'), `Kim can attack Mo but not Georges (${opts.join(', ')})`);
      await B.evaluate(() => { window.__want = null; });
    });
    await step("Arcbond on Kim's creature: when it is dealt damage (on Kim's client), it deals that much to each other creature and each player", async () => {
      await clean(A); await clean(B); await clean(C); await put(B, 'Wall of Omens'); await put(C, 'Grizzly Bears'); await put(A, 'Llanowar Elves'); await after();
      await run(A, 'Choose target creature. Whenever that creature is dealt damage this turn, it deals that much damage to each other creature and each player.', 'Arcbond', {tgtName:['Kim', 'Wall of Omens']}); await after();
      const L = [await life(A), await life(B), await life(C)];
      await A.evaluate(() => { window.__tgt = 'Wall of Omens'; }); await toHand(A, 'Lightning Bolt'); check(await cast(A, 'Lightning Bolt') === 'ok', 'Georges bolts the Wall'); await after(); await sleep(1500); await settle(); await A.evaluate(() => { window.__tgt = null; });
      const L2 = [await life(A), await life(B), await life(C)];
      check(L2.every((v, i) => v === L[i] - 3), `each player lost 3 (${L.join('/')} → ${L2.join('/')})`);
      check(!(await A.evaluate(() => S.bf.some(c => cname(c) === 'Llanowar Elves'))) && !(await C.evaluate(() => S.bf.some(c => cname(c) === 'Grizzly Bears'))), "Georges's Elves and Mo's Bears died; the Wall itself wasn't hit again");
      check(await B.evaluate(() => (S.bf.find(c => cname(c) === 'Wall of Omens') || {}).dmg === 3), 'Wall of Omens has only the 3 Bolt damage');
    });
    await step('Duskmantle Guildmage: this turn, whenever a card goes to an opponent\'s graveyard, that player loses 1 life', async () => {
      await run(A, 'Whenever a card is put into an opponent\'s graveyard from anywhere this turn, that player loses 1 life.', 'Duskmantle Guildmage'); await after();
      const L0 = await life(C); await C.evaluate(() => { mill(2); commit(); }); await after(); await sleep(800); await settle();
      const L1 = await life(C); check(L1 === L0 - 2, `Mo milled 2 cards and lost 1 life per card (${L0} → ${L1})`);
    });
    await step('Grave Betrayal: Kim\'s creature dies — at the next end step Georges gets it with a +1/+1 counter as a black Zombie', async () => {
      await clean(A); await clean(B); await put(A, 'Grave Betrayal'); await put(B, 'Grizzly Bears'); await after();
      await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); moveCard(c.id, 'gy'); commit(); }); await after(); await sleep(800);
      check(await A.evaluate(() => S.dly.some(d => d.op === 'r25gb')), 'a delayed return is waiting for the end step');
      await A.evaluate(() => { fireSteps('end', MYPID); commit(); }); await after(); await sleep(1500); await settle();
      const r = await A.evaluate(() => { const c = S.bf.find(x => /Grizzly Bears/.test(cname(x))); return c ? {cp:c.cp || 0, t:typeOf(c), col:info(c.k)?.c} : null; });
      check(r && r.cp === 1 && /Zombie/.test(r.t), `Georges controls Grizzly Bears with a +1/+1 counter, a Zombie (${JSON.stringify(r)})`);
      check(!(await B.evaluate(() => S.gy.some(c => cname(c) === 'Grizzly Bears'))), "it left Kim's graveyard");
    });
    await step('Gift of Immortality: returns attached to the creature at the next end step', async () => {
      await clean(A); await put(A, 'Grizzly Bears'); await put(A, 'Gift of Immortality'); await A.evaluate(() => { const g = S.bf.find(x => cname(x) === 'Gift of Immortality'); const b = S.bf.find(x => cname(x) === 'Grizzly Bears'); g.att = {pid:MYPID, id:b.id}; commit(); }); await after();
      await A.evaluate(() => { const b = S.bf.find(x => cname(x) === 'Grizzly Bears'); moveCard(b.id, 'gy'); commit(); }); await after(); await sleep(1500); await settle();
      check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Grizzly Bears')), 'Grizzly Bears returned');
      await A.evaluate(() => { fireSteps('end', MYPID); commit(); }); await after();
      const r = await A.evaluate(() => { const g = S.bf.find(x => cname(x) === 'Gift of Immortality'); const b = S.bf.find(x => cname(x) === 'Grizzly Bears'); return g && b && g.att && g.att.id === b.id; });
      check(r, 'Gift of Immortality is back, attached to Grizzly Bears');
    });
    await step('Gix: Georges\'s creature hits Kim — Georges may pay 1 life and draw', async () => {
      await clean(A); await put(A, 'Gix, Yawgmoth Praetor'); await put(A, 'Grizzly Bears'); await after(); await A.evaluate(() => { window.__want = 'Pay'; });
      const h0 = await handN(A), L0 = await life(A);
      await combat(['Grizzly Bears'], 'Kim');
      check(await handN(A) === h0 + 1 && await life(A) === L0 - 1, `paid 1 life and drew (${h0} → ${await handN(A)}, life ${L0} → ${await life(A)})`);
      await A.evaluate(() => { window.__want = null; });
    });
    await step('Breach the Multiverse (3 players): a creature card from each graveyard comes to Georges', async () => {
      await clean(A); await clean(B); await clean(C);
      for (const [p, n] of [[A, 'Wall of Omens'], [B, 'Llanowar Elves'], [C, 'Elvish Visionary']]) await p.evaluate(n => { const i = S.lib.findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S.lib.splice(i, 1); S.gy.push(c); commit(); } }, n);
      await sleep(800); await A.evaluate(() => { window.__want = 'Wall of Omens|Llanowar|Elvish Visionary'; });
      await run(A, "For each player, choose a creature or planeswalker card in that player's graveyard. Put those cards onto the battlefield under your control.", 'Breach the Multiverse'); await after(); await sleep(2500); await settle();
      const mine = await A.evaluate(() => S.bf.filter(c => isCreatureCard(c)).map(cname));
      check(mine.length === 3 && mine.includes('Elvish Visionary'), `Georges controls one creature card from each player's graveyard (${mine.join(', ')})`);
      check(!(await C.evaluate(() => S.gy.some(c => cname(c) === 'Elvish Visionary'))), "Elvish Visionary left Mo's graveyard");
      check(!(await B.evaluate(() => S.gy.some(c => cname(c) === 'Llanowar Elves'))), "Llanowar Elves left Kim's graveyard");
      await A.evaluate(() => { window.__want = null; });
    });
    await step('Disorienting Choice: Kim exiles her chosen artifact, Mo keeps his — Georges searches for 1 land', async () => {
      await clean(A); await clean(B); await clean(C); await put(B, 'Sol Ring'); await put(C, 'Mind Stone'); await after();
      await B.evaluate(() => { window.__want = 'Exile it'; }); await C.evaluate(() => { window.__want = 'Keep it'; }); await A.evaluate(() => { window.__want = 'Sol Ring|Mind Stone|Plains|Island|Swamp|Mountain|Forest'; });
      const l0 = await A.evaluate(() => S.bf.filter(c => isLand(c.k)).length);
      await run(A, 'For each opponent, choose up to one target artifact or enchantment that player controls. For each permanent chosen this way, its controller may exile it. Then if one or more of the chosen permanents are still on the battlefield, you search your library for up to that many land cards, put them onto the battlefield tapped, then shuffle.', 'Disorienting Choice'); await after(); await sleep(2000); await settle();
      check(await B.evaluate(() => S.ex.some(c => cname(c) === 'Sol Ring')), 'Kim chose to exile Sol Ring');
      check(await C.evaluate(() => S.bf.some(c => cname(c) === 'Mind Stone')), 'Mo kept Mind Stone');
      const l1 = await A.evaluate(() => S.bf.filter(c => isLand(c.k)).length); check(l1 === l0 + 1, `Georges searched for 1 land (${l0} → ${l1})`);
      for (const p of ALL) await p.evaluate(() => { window.__want = null; });
    });
    await step("Vivien −2: the next creature spell this turn fetches a cheaper creature (once)", async () => {
      await clean(A); await run(A, 'When you next cast a creature spell this turn, search your library for a creature card with lesser mana value, put it onto the battlefield, then shuffle.', "Vivien, Monsters' Advocate"); await after();
      await A.evaluate(() => { window.__want = 'Llanowar Elves|Elvish Mystic'; });
      await toHand(A, 'Grizzly Bears'); check(await cast(A, 'Grizzly Bears') === 'ok', 'cast Grizzly Bears (mana value 2)'); await after(); await sleep(800); await settle();
      const r = await A.evaluate(() => S.bf.map(cname)); check(r.includes('Grizzly Bears') && (r.includes('Llanowar Elves') || r.includes('Elvish Mystic')), `a mana value 1 creature came from the library (${r.filter(n => !/Plains|Island|Swamp|Mountain|Forest/.test(n)).join(', ')})`);
      check(await A.evaluate(() => !S.bf.some(c => c.r25)), 'the one-shot trigger is used up');
      await A.evaluate(() => { window.__want = null; });
    });
    await step('Master Warcraft: only before attackers are declared', async () => {
      await toHand(A, 'Master Warcraft');
      const ok = await A.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Master Warcraft'); const ph = S.ph; S.ph = [ph[0], ph[1], 3]; try { return castCheck(c, 'hand'); } finally { S.ph = ph; } });
      const bad = await A.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Master Warcraft'); const ph = S.ph; S.ph = [ph[0], ph[1], 5]; try { return castCheck(c, 'hand'); } finally { S.ph = ph; } });
      check(!/before attackers/.test(ok.why || '') && bad && !bad.ok && /before attackers/i.test(bad.why), `allowed in main 1, refused after combat (${bad && bad.why})`);
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
