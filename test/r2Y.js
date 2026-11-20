process.env.TOP = '1';
// Round 26Y: keyword mechanics — Rooms, Cases, soulbond, exert, bargain, splice, harness, granted keywords, sneak, time travel, manifest/cloak, becomes tapped — in a real 2-player game (Georges vs Kim)
const CC = require('./cards');
const WANT = ['Funeral Room // Awakening Hall', 'Mirror Room // Fractured Realm', 'Entity Tracker', 'Ghostly Dancers', 'Case of the Locked Hothouse', 'Case of the Ransacked Lab', 'Tandem Lookout', 'Deadeye Navigator',
  'Combat Celebrant', 'Beseech the Mirror', "Kodama's Reach", 'Desperate Ritual', 'The Soul Stone', 'Imoti, Celebrant of Bounty', 'Maelstrom Nexus', 'Sami, Wildcat Captain', 'Pearl-Ear, Imperial Advisor', 'Tannuk, Steadfast Second',
  'Aminatou, Veil Piercer', 'Sliver Gravemother', 'Sliver Hivelord', 'Dream Devourer', 'Raphael, the Nightwatcher', 'The Tenth Doctor', 'Kozilek, the Broken Reality', 'Unexplained Absence', 'Captain America, Living Legend',
  'Hylda of the Icy Crown', 'Aven Interrupter', 'Path of the Pyromancer', 'Timeline Culler', 'Dionus, Elvish Archdruid',
  'Grizzly Bears', 'Llanowar Elves', 'Lightning Bolt', 'Mind Stone', 'Wall of Omens', 'Darksteel Ingot', 'Sol Ring', 'Pacifism', 'Serra Angel', 'Craterhoof Behemoth', 'Counterspell', 'Giant Growth', 'Forest', 'Swamp'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
// real Scryfall split cards (Rooms) carry one image for the whole card, not one per face
CC.cards.forEach(c => { if (c.layout === 'split' && c.card_faces) c.card_faces.forEach(f => { delete f.image_uris; }); });
const H = require('./h'); const {check, sleep, put, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { window.__want = window.__want || null; window.__tgt = window.__tgt || null; window.__num = null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ if (!window.__tgt) return; const re = new RegExp(window.__tgt, 'i'); const c = (m.cands || []).find(x => x.ok && re.test(x.nm)); if (!c) return; m.__done = 1; m.resolve([c]); closeModal(); }
    else if (m.run){ m.__done = 1; const d = window.__num != null ? window.__num : (m.def ?? 1); m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const toHand = (p, n) => p.evaluate(n => { for (const z of ['lib', 'gy', 'ex', 'bf']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.hand.push(c); commit(); return c.id; } } return S.hand.find(c => cname(c) === n)?.id; }, n);
const toZone = (p, n, z) => p.evaluate(([n, z]) => { for (const y of ['lib', 'hand', 'gy', 'ex', 'bf']){ const i = S[y].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[y].splice(i, 1); reset(c); if (z === 'lib') S[z].unshift(c); else S[z].push(c); commit(); return c.id; } } return null; }, [n, z]);
const cast = (p, n, pool) => p.evaluate(async ([n, pool]) => { const c = S.hand.find(x => cname(x) === n); if (!c) return 'not in hand'; S.pool = {...emptyPool(), ...(pool || {W:6, U:6, B:6, R:6, G:6, C:6})}; commit(); await beginCast(c, 'hand'); return S.hand.includes(c) ? 'not cast' : 'ok'; }, [n, pool]);
const toGy = (p, n) => p.evaluate(n => { const c = S.bf.find(x => cname(x) === n); if (c){ moveCard(c.id, 'gy', {quiet:true}); commit(); return true; } return false; }, n);
const activate = (p, n, re) => p.evaluate(async ([n, re]) => { const c = S.bf.find(x => cname(x) === n); if (!c) return 'missing'; c.sk = false; c.tap = false; S.pool = {...emptyPool(), W:8, U:8, B:8, R:8, G:8, C:8}; const ab = abilityList(c).find(a => new RegExp(re, 'i').test(a.eff)); if (!ab) return 'no ability'; await activateAbility(c, ab); return 'ok'; }, [n, re]);
const run = (p, txt, nm, extra) => p.evaluate(async ([txt, nm, extra]) => { const k = [...DICT.values()].find(a => a.n === nm)?.k || null; const src = S.bf.find(c => c.k === k || c.origK === k) || S.gy.find(c => c.k === k); const ctx = {k, name:nm, full:txt, srcId:src ? src.id : null, ...(extra || {})}; if (ctx.tgtKim){ const [pid] = [...OPP.keys()]; ctx.tgts = [[{t:'player', pid, nm:nameOf(pid)}]]; } if (ctx.tgtBoth){ const [pid] = [...OPP.keys()]; ctx.tgts = [[{t:'player', pid:MYPID, nm:nameOf(MYPID)}, {t:'player', pid, nm:nameOf(pid)}]]; } await runEffects(txt, ctx); commit(); return 'ok'; }, [txt, nm, extra]);
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { await T(60000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2y');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2y');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const cnt = (p, re) => p.evaluate(re => S.bf.filter(c => new RegExp(re).test(cname(c))).reduce((a, c) => a + (c.n || 1), 0), re);
  const after = async () => { await sleep(500); await settle([A, B]); await sleep(1200); await settle([A, B]); await sleep(500); };
  const want = (p, w, t) => p.evaluate(([w, t]) => { window.__want = w; window.__tgt = t; }, [w || null, t || null]);
  const kimPid = await A.evaluate(() => [...OPP.keys()][0]);
  try {
    await step('Room: cast one door, unlock the other (Funeral Room // Awakening Hall), Entity Tracker sees the full unlock', async () => {
      await toHand(A, 'Funeral Room // Awakening Hall'); await toZone(A, 'Grizzly Bears', 'gy'); await put(A, 'Entity Tracker'); await after();
      await A.evaluate(async () => { const c = S.hand.find(x => /Funeral Room/.test(cname(x))); S.pool = {...emptyPool(), B:3, C:3}; await castFace(c, 'hand', '0'); }); await after();
      let r = await A.evaluate(() => { const c = S.bf.find(x => /Funeral Room/.test(cname(x))); return c ? {d:r26Doors(c), t:textOf(c)} : null; });
      check(r && r.d[0] && !r.d[1] && /creature you control dies/.test(r.t) && !/return all creature/.test(r.t), `Funeral Room entered with only its cast door unlocked (${JSON.stringify(r && r.d)})`);
      const h0 = await A.evaluate(() => S.hand.length);
      const ok = await A.evaluate(async () => { const c = S.bf.find(x => /Funeral Room/.test(cname(x))); S.pool = {...emptyPool(), B:8, C:8}; return await r26DoUnlock(c, 1); }); await after();
      r = await A.evaluate(() => { const c = S.bf.find(x => /Funeral Room/.test(cname(x))); return {d:r26Doors(c), bears:S.bf.some(b => cname(b) === 'Grizzly Bears'), hand:S.hand.length}; });
      check(ok && r.d[0] && r.d[1], 'unlocked Awakening Hall by paying its cost (now fully unlocked)');
      check(r.bears, 'Awakening Hall\'s "when you unlock this door" returned Grizzly Bears from the graveyard');
      check(r.hand === h0 + 1, `Entity Tracker (eerie) drew a card for the full unlock (${h0} → ${r.hand})`);
      const sorc = await A.evaluate(() => { const c = S.bf.find(x => /Funeral Room/.test(cname(x))); return r26UnlockOpts(c).length; }); check(sorc === 0, 'no door left to unlock');
    });
    await step('Room put onto the battlefield is fully locked; Ghostly Dancers unlocks Mirror Room (copy of Grizzly Bears)', async () => {
      await put(A, 'Mirror Room // Fractured Realm'); await after();
      let d = await A.evaluate(() => r26Doors(S.bf.find(x => /Mirror Room/.test(cname(x))))); check(d && !d[0] && !d[1], `both doors locked (${JSON.stringify(d)})`);
      const n0 = await cnt(A, '^Grizzly Bears$'); await want(A, 'Unlock|^Mirror Room', 'Grizzly'); await put(A, 'Ghostly Dancers'); await after(); await want(A);
      d = await A.evaluate(() => r26Doors(S.bf.find(x => /Mirror Room/.test(cname(x))))); check(d && d[0] && !d[1], `Ghostly Dancers unlocked the Mirror Room door (${JSON.stringify(d)})`);
      check(await cnt(A, '^Grizzly Bears$') === n0 + 1, 'Mirror Room\'s unlock trigger made a token copy of Grizzly Bears');
      for (const n of ['Mirror Room // Fractured Realm', 'Ghostly Dancers', 'Funeral Room // Awakening Hall', 'Entity Tracker']) await toGy(A, n);
      await A.evaluate(() => { S.bf.filter(c => cname(c) === 'Grizzly Bears').forEach(c => moveCard(c.id, 'gy', {quiet:true})); commit(); });
    });
    await step('Cases: Locked Hothouse is solved at the end step with seven lands; Ransacked Lab is not', async () => {
      await put(A, 'Case of the Locked Hothouse'); await put(A, 'Case of the Ransacked Lab');
      await A.evaluate(() => { while (S.bf.filter(c => isLand(c.k)).length < 7){ const c = S.lib.find(x => isLand(x.k)); if (!c) break; moveCard(c.id, 'bf', {quiet:true}); } commit(); }); await after();
      const before = await A.evaluate(() => rulesOn('r23fTop').filter(r => /Hothouse/.test(r.src)).length); check(before === 0, 'unsolved: the Solved ability does nothing yet');
      await A.evaluate(() => fireSteps('end', MYPID)); await after();
      const r = await A.evaluate(() => ({h:r26CaseSolved(S.bf.find(c => /Hothouse/.test(cname(c)))), l:r26CaseSolved(S.bf.find(c => /Ransacked/.test(cname(c)))), top:rulesOn('r23fTop').filter(r => /Hothouse/.test(r.src)).length}));
      check(r.h && r.top === 1, `Case of the Locked Hothouse is solved and lets Georges play from the top (${JSON.stringify(r)})`);
      check(!r.l, 'Case of the Ransacked Lab (fewer than four instants/sorceries this turn) stays unsolved');
      await toGy(A, 'Case of the Locked Hothouse'); await toGy(A, 'Case of the Ransacked Lab');
    });
    await step('Soulbond: Tandem Lookout pairs with Grizzly Bears; Deadeye Navigator grants the flicker ability and re-pairs', async () => {
      await put(A, 'Grizzly Bears'); await after(); await want(A, 'Pair|Grizzly'); await put(A, 'Tandem Lookout'); await after();
      let r = await A.evaluate(() => { const b = S.bf.find(c => cname(c) === 'Grizzly Bears'); const t = S.bf.find(c => cname(c) === 'Tandem Lookout'); const e = l24eff(b); return {bp:b.r26pair === t.id, tp:t.r26pair === b.id, ab:e ? e.ab.map(x => x.t) : []}; });
      check(r.bp && r.tp && r.ab.some(x => /deals damage to an opponent, draw a card/.test(x)), `paired; Bears has "whenever this creature deals damage to an opponent, draw a card" (${JSON.stringify(r)})`);
      const h0 = await A.evaluate(() => S.hand.length);
      await A.evaluate(([pid]) => { const b = S.bf.find(c => cname(c) === 'Grizzly Bears'); emit({type:'dmg', k:b.k, id:b.id, dp:pid, amt:2}); }, [kimPid]); await after();
      check(await A.evaluate(() => S.hand.length) === h0 + 1, 'the paired Grizzly Bears dealing damage to Kim drew a card');
      await toGy(A, 'Tandem Lookout'); await after();
      check(await A.evaluate(() => S.bf.find(c => cname(c) === 'Grizzly Bears').r26pair == null), 'pair broken when Tandem Lookout left');
      await want(A, 'Pair|Grizzly'); await put(A, 'Deadeye Navigator'); await after();
      check(await A.evaluate(() => S.bf.find(c => cname(c) === 'Grizzly Bears').r26pair != null), 'Deadeye Navigator paired with Grizzly Bears');
      const id0 = await A.evaluate(() => S.bf.find(c => cname(c) === 'Grizzly Bears').id);
      check(await activate(A, 'Grizzly Bears', 'Exile') === 'ok', 'activated the granted "{1}{U}: Exile this creature, then return it" on Grizzly Bears'); await after();
      r = await A.evaluate(() => { const b = S.bf.find(c => cname(c) === 'Grizzly Bears'); const d = S.bf.find(c => cname(c) === 'Deadeye Navigator'); return {on:!!b, pair:b && b.r26pair === d.id && d.r26pair === b.id}; });
      check(r.on && r.pair, `Grizzly Bears flickered and Deadeye re-paired with it as it entered (${JSON.stringify(r)})`);
      await want(A); await toGy(A, 'Deadeye Navigator'); await toGy(A, 'Grizzly Bears');
    });
    await step('Exert: Combat Celebrant untaps the others, adds a combat, and stays tapped next untap step', async () => {
      await put(A, 'Combat Celebrant'); await put(A, 'Grizzly Bears'); await after(); await want(A, 'Exert');
      await A.evaluate(([pid]) => { const c = S.bf.find(x => cname(x) === 'Combat Celebrant'); const b = S.bf.find(x => cname(x) === 'Grizzly Bears'); c.tap = true; c.atk = 'p:' + pid; b.tap = true; commit(); emit({type:'attack', k:c.k, id:c.id}); }, [kimPid]); await after(); await want(A);
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Combat Celebrant'); const b = S.bf.find(x => cname(x) === 'Grizzly Bears'); return {ex:!!c.exert, b:b.tap, xc:S.xc || 0}; });
      check(r.ex && !r.b && r.xc === 1, `exerted: Grizzly Bears untapped and one additional combat (${JSON.stringify(r)})`);
      const r2 = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Combat Celebrant'); c.atk = ''; S.xc = 0; const ph = S.ph.slice(); setPhase(0); const t = c.tap; S.ph = ph; return t; }); await after();
      check(r2, 'Combat Celebrant did not untap during the next untap step');
      await toGy(A, 'Combat Celebrant'); await toGy(A, 'Grizzly Bears');
    });
    await step('Bargain: Beseech the Mirror sacrifices Sol Ring and casts the found card for free', async () => {
      await put(A, 'Sol Ring'); await toZone(A, 'Llanowar Elves', 'lib'); await toHand(A, 'Beseech the Mirror'); await want(A, 'Pay it|Llanowar|Cast it');
      check(await cast(A, 'Beseech the Mirror') === 'ok', 'cast Beseech the Mirror'); await after(); await want(A);
      const r = await A.evaluate(() => ({sol:S.gy.some(c => cname(c) === 'Sol Ring'), elf:S.bf.some(c => cname(c) === 'Llanowar Elves')}));
      check(r.sol && r.elf, `bargained (Sol Ring sacrificed) and Llanowar Elves was cast free (${JSON.stringify(r)})`);
      await toGy(A, 'Llanowar Elves');
      await toZone(A, 'Counterspell', 'lib'); await toHand(A, 'Beseech the Mirror'); await want(A, "Don't pay|Counterspell");
      check(await cast(A, 'Beseech the Mirror') === 'ok', 'cast Beseech the Mirror without bargaining'); await after(); await want(A);
      check(await A.evaluate(() => S.hand.some(c => cname(c) === 'Counterspell')), 'not bargained: the exiled Counterspell went to hand');
    });
    await step("Splice onto Arcane: Desperate Ritual spliced onto Kodama's Reach adds {R}{R}{R}", async () => {
      await toHand(A, "Kodama's Reach"); await toHand(A, 'Desperate Ritual'); await want(A, 'Pay it|Forest|Swamp');
      check(await cast(A, "Kodama's Reach", {G:3, R:2, C:2}) === 'ok', "cast Kodama's Reach"); const r0 = await A.evaluate(() => S.pool.R || 0);
      await after(); await want(A); const r1 = await A.evaluate(() => S.pool.R || 0);
      check(r1 - r0 === 3, `the spliced Desperate Ritual text added {R}{R}{R} (${r0} → ${r1})`);
      check(await A.evaluate(() => S.hand.some(c => cname(c) === 'Desperate Ritual')), 'Desperate Ritual stayed in hand');
    });
    await step('Harness: The Soul Stone is harnessed, then its ∞ upkeep ability reanimates', async () => {
      await put(A, 'The Soul Stone'); await put(A, 'Grizzly Bears'); await toZone(A, 'Wall of Omens', 'gy'); await after();
      let n = await A.evaluate(() => { const n0 = S.stk.length; fireSteps('upkeep', MYPID); const n1 = S.stk.length; S.stk.splice(n0); return n1 - n0; }); check(n === 0, 'unharnessed: no upkeep trigger');
      await want(A, 'Grizzly'); check(await activate(A, 'The Soul Stone', 'Harness') === 'ok', 'activated Harness'); await after();
      check(await A.evaluate(() => /#H1$/.test(S.bf.find(c => /Soul Stone/.test(cname(c))).k) && S.ex.some(c => cname(c) === 'Grizzly Bears')), 'The Soul Stone is harnessed (Grizzly Bears exiled as the cost)');
      await want(A, null, 'Wall of Omens'); await A.evaluate(() => fireSteps('upkeep', MYPID)); await after(); await want(A);
      check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Wall of Omens')), '∞ — upkeep trigger returned Wall of Omens');
      await toGy(A, 'The Soul Stone'); await toGy(A, 'Wall of Omens');
    });
    await step('Granted cascade (Imoti mana value 6+) and affinity (Sami)', async () => {
      await put(A, 'Imoti, Celebrant of Bounty'); await put(A, 'Maelstrom Nexus'); await toHand(A, 'Craterhoof Behemoth'); await toHand(A, 'Giant Growth'); await after();
      await want(A, 'Keep|Don|No|Decline');
      await A.evaluate(async () => { const c = S.hand.find(x => cname(x) === 'Craterhoof Behemoth'); S.pool = {...emptyPool(), G:10}; window.__nC = S.stk.length; await beginCast(c, 'hand'); window.__cas = S.stk.filter(x => /cascade/.test(x.txt || '')).length; });
      check(await A.evaluate(() => window.__cas) === 1, 'Craterhoof Behemoth (mana value 8) got one cascade trigger from Imoti; Maelstrom Nexus gave none (not the first spell this turn)');
      await after(); await want(A); await A.evaluate(() => { S.bf.filter(c => !isLand(c.k) && !/Imoti|Nexus/.test(cname(c))).forEach(c => moveCard(c.id, 'gy', {quiet:true})); commit(); });
      await toGy(A, 'Imoti, Celebrant of Bounty'); await toGy(A, 'Maelstrom Nexus');
      await put(A, 'Sami, Wildcat Captain'); await put(A, 'Sol Ring'); await put(A, 'Mind Stone'); await put(A, 'Darksteel Ingot'); await A.evaluate(() => { S.bf.filter(c => /Artifact/.test(typeOf(c)) && !/Mind Stone|Sol Ring|Darksteel Ingot/.test(cname(c))).forEach(c => moveCard(c.id, 'gy', {quiet:true})); commit(); }); await toHand(A, "Kodama's Reach"); await after();
      const g = await A.evaluate(() => { const c = S.hand.find(c => cname(c) === "Kodama's Reach"); return c ? spellCost(c, 'hand').cost.gen : 'missing'; }); check(g === 0, `Kodama's Reach's {2} is paid by affinity for artifacts (generic left ${g})`);
      for (const n of ['Sami, Wildcat Captain', 'Sol Ring', 'Mind Stone', 'Darksteel Ingot']) await toGy(A, n);
    });
    await step('Granted keywords: Tannuk warp, Aminatou miracle, Sliver Gravemother encore, Dream Devourer foretell', async () => {
      await put(A, 'Tannuk, Steadfast Second'); await toHand(A, 'Mind Stone'); await after();
      check(await A.evaluate(() => r21bAlts(S.hand.find(c => cname(c) === 'Mind Stone'), 'hand').some(o => o.kind === 'warp' && /\{2\}\{R\}/.test(o.label))), 'Mind Stone in hand has warp {2}{R} (Tannuk)');
      await toGy(A, 'Tannuk, Steadfast Second');
      await put(A, 'Aminatou, Veil Piercer'); await toZone(A, 'Pacifism', 'lib'); await want(A, 'Keep');
      const mir = await A.evaluate(() => { S.drawn = 0; S.drawnT = turnStr(); const n0 = S.stk.length; draw(1); return S.stk.slice(n0).some(x => x.r21b === 'miracle' && /\{W\}/.test(x.cost) && !/\{1\}/.test(x.cost)); }); await after(); await want(A);
      check(mir, 'drawing Pacifism as the first card gave a miracle trigger for {W} ({1}{W} reduced by {4})');
      await toGy(A, 'Aminatou, Veil Piercer');
      await put(A, 'Sliver Gravemother'); await toZone(A, 'Sliver Hivelord', 'gy'); await after();
      check(await A.evaluate(() => r21bGyAbils(S.gy.find(c => cname(c) === 'Sliver Hivelord')).some(o => /Encore \{5\}/.test(o.label))), 'Sliver Hivelord in the graveyard has encore {5}');
      await toGy(A, 'Sliver Gravemother');
      await put(A, 'Dream Devourer'); await toHand(A, 'Grizzly Bears'); await after();
      await A.evaluate(async () => { S.pool = {...emptyPool(), C:2}; const c = S.hand.find(x => cname(x) === 'Grizzly Bears'); const o = r21bHandOpts(c).find(x => /Foretell/.test(x.label)); if (o && !o.why) await o.run(); }); await after();
      const r = await A.evaluate(() => { const c = S.ex.find(x => cname(x) === 'Grizzly Bears'); const d = S.bf.find(x => cname(x) === 'Dream Devourer'); return {fd:!!(c && c.fd), cost:c && c.r26fore, p:d && stats(d)[0], pu:d && d.pu, log:S.log.slice(-4).map(e => e.s).join(' | ')}; });
      check(r.fd && r.cost === '{G}' && r.p === 2, `Grizzly Bears foretold (cast later for {G}); Dream Devourer got +2/+0 (${JSON.stringify(r)})`);
      await toGy(A, 'Dream Devourer');
    });
    await step('Sneak: Raphael is cast by returning an unblocked attacker and enters tapped and attacking', async () => {
      await put(A, 'Llanowar Elves'); await toHand(A, 'Raphael, the Nightwatcher'); await after();
      const r = await A.evaluate(async ([pid]) => { const e = S.bf.find(x => cname(x) === 'Llanowar Elves'); const ph = S.ph.slice(); S.ph[2] = 4; S.cb = {t:turnStr(), n:1, step:'blkd'}; e.atk = 'p:' + pid; e.tap = true; S.pool = {...emptyPool(), R:3, C:2};
        const c = S.hand.find(x => cname(x) === 'Raphael, the Nightwatcher'); const o = r21bHandOpts(c).find(x => /Sneak/.test(x.label)); const why = o ? o.why : 'no option'; if (o && !o.why) await o.run();
        const it = S.stk.find(x => x.card && cname(x.card) === 'Raphael, the Nightwatcher'); if (it) await resolveTop(it);
        const rb = S.bf.find(x => cname(x) === 'Raphael, the Nightwatcher'); const out = {why, elfHand:S.hand.some(x => cname(x) === 'Llanowar Elves'), atk:rb && rb.atk, tap:rb && rb.tap};
        if (rb) rb.atk = ''; S.ph = ph; S.cb = null; commit(); return out; }, [kimPid]);
      check(r.elfHand && r.atk === 'p:' + kimPid && r.tap, `sneak returned Llanowar Elves; Raphael entered tapped and attacking Kim (${JSON.stringify(r)})`);
      await toGy(A, 'Raphael, the Nightwatcher');
    });
    await step('Time travel: The Tenth Doctor adds a time counter to a suspended card', async () => {
      await put(A, 'The Tenth Doctor'); await A.evaluate(() => { const c = S.lib.find(x => cname(x) === 'Lightning Bolt') || S.hand.find(x => cname(x) === 'Lightning Bolt'); moveCard(c.id, 'ex', {quiet:true}); c.r21bsus = 1; c.nc = {time:2}; c.co = 2; commit(); });
      await want(A, 'Add a time'); await activate(A, 'The Tenth Doctor', 'Time travel'); await after(); await want(A);
      check(await A.evaluate(() => S.ex.find(c => cname(c) === 'Lightning Bolt').nc.time) === 5, 'time travel three times: 2 → 5 time counters');
      await toGy(A, 'The Tenth Doctor');
    });
    await step('Manifest from hand (Kozilek) and cloak (Unexplained Absence) on both boards', async () => {
      const kh0 = await B.evaluate(() => S.hand.length); const h0 = await A.evaluate(() => S.hand.length); const fd0 = await A.evaluate(() => S.bf.filter(c => c.fd).length);
      await want(A, 'Grizzly|Serra'); await run(A, 'Up to two target players each manifest two cards from their hands. For each card manifested this way, you draw a card.', 'Kozilek, the Broken Reality', {tgtBoth:true}); await after(); await sleep(1500); await after(); await want(A);
      const fd1 = await A.evaluate(() => S.bf.filter(c => c.fd).length); const kfd = await B.evaluate(() => S.bf.filter(c => c.fd).length); const h1 = await A.evaluate(() => S.hand.length);
      check(fd1 - fd0 === 2 && kfd >= 2, `Georges manifested 2 from hand, Kim manifested ${kfd}`);
      check(h1 === h0 - 2 + 4, `Georges drew 4 (one per manifested card): hand ${h0} → ${h1}`);
      await put(B, 'Wall of Omens'); await after(); const kid = await B.evaluate(() => S.bf.find(c => cname(c) === 'Wall of Omens').id); const kfd0 = await B.evaluate(() => S.bf.filter(c => c.fd).length);
      await A.evaluate(async ([pid, id]) => { const ctx = {k:null, name:'Unexplained Absence', full:'', tgts:[[{t:'card', pid, id, k:OPP.get(pid).bf.find(b => b.id === id).k, nm:'Wall of Omens'}]]}; await runEffects('For each player, exile up to one target nonland permanent that player controls. For each permanent exiled this way, its controller cloaks the top card of their library.', ctx); commit(); }, [kimPid, kid]); await after(); await sleep(1000); await after();
      const k = await B.evaluate(() => ({wall:S.ex.some(c => cname(c) === 'Wall of Omens'), fd:S.bf.filter(c => c.fd).length, ward:S.bf.some(c => c.fd && c.r26cloak && (c.ekw || []).includes('ward {2}'))}));
      check(k.wall && k.fd === kfd0 + 1 && k.ward, `Kim's Wall of Omens exiled and Kim cloaked the top card (ward {2}) (${JSON.stringify(k)})`);
    });
    await step('Becomes tapped: Captain America untaps a creature the first time; Hylda triggers when Georges taps Kim\'s creature', async () => {
      await put(A, 'Captain America, Living Legend'); await toHand(A, 'Grizzly Bears'); await put(A, 'Grizzly Bears'); await after();
      await A.evaluate(() => { const b = S.bf.find(c => cname(c) === 'Grizzly Bears'); b.tap = true; commit(); }); await after();
      check(await A.evaluate(() => !S.bf.find(c => cname(c) === 'Grizzly Bears').tap), 'Grizzly Bears untapped (first time tapped this turn)');
      await A.evaluate(() => { const b = S.bf.find(c => cname(c) === 'Grizzly Bears'); b.tap = true; commit(); }); await after();
      check(await A.evaluate(() => S.bf.find(c => cname(c) === 'Grizzly Bears').tap), 'the second tap stays');
      await toGy(A, 'Captain America, Living Legend');
      await put(A, 'Hylda of the Icy Crown'); const sid = await B.evaluate(() => { const c = [...S.hand, ...S.lib].find(x => cname(x) === 'Serra Angel') || [...S.hand, ...S.lib].find(x => isCreatureCard(x)); moveCard(c.id, 'bf', {quiet:true}); c.tap = false; window.__hyl = c.id; commit(); return c.id; }); await after();
      await want(A, 'Pay|Create'); const tok0 = await A.evaluate(() => S.bf.length);
      await A.evaluate(async ([pid, id]) => { S.pool = {...emptyPool(), C:1}; const k = OPP.get(pid).bf.find(b => b.id === id).k; await runEffects('Tap target creature.', {k:null, name:'test', full:'Tap target creature.', tgts:[[{t:'card', pid, id, k, nm:'Serra Angel'}]]}); commit(); }, [kimPid, sid]); await after(); await want(A);
      const r = await A.evaluate(() => ({tok:S.bf.some(c => c.tok && /Elemental/.test(cname(c))), log:S.log.slice(-6).map(e => e.s).join(' | ')}));
      check(r.tok, `Hylda triggered: Georges paid {1} and created a 4/4 Elemental (${r.log})`);
      check(await B.evaluate(() => S.bf.find(c => c.id === window.__hyl).tap), "Kim's creature is tapped");
      await toGy(A, 'Hylda of the Icy Crown');
    });
    await step('Aven Interrupter exiles Kim\'s spell and it becomes plotted', async () => {
      await B.evaluate(() => { const c = S.lib.find(x => cname(x) === 'Giant Growth') || S.hand.find(x => cname(x) === 'Giant Growth'); if (c && !S.hand.includes(c)){ S.lib.splice(S.lib.indexOf(c), 1); S.hand.push(c); } commit(); });
      await put(B, 'Grizzly Bears');
      await B.evaluate(async () => { const c = S.hand.find(x => cname(x) === 'Giant Growth'); S.pool = {...emptyPool(), G:1}; window.__tgt = 'Grizzly'; UI.r21bany = true; try { await beginCast(c, 'hand'); } finally { UI.r21bany = false; } window.__tgt = null; });
      await sleep(800);
      const r0 = await A.evaluate(() => stackAll().map(x => x.nm));
      await A.evaluate(async () => { const it = stackAll().find(x => x.nm === 'Giant Growth'); const k = [...DICT.values()].find(a => a.n === 'Aven Interrupter').k; const ctx = {k, name:'Aven Interrupter', full:'Exile target spell. It becomes plotted.', it:{kind:'trigger', k, nm:'Aven Interrupter', tgt:it && it.sid}}; await runEffects('Exile target spell. It becomes plotted.', ctx); commit(); });
      await sleep(1500); await after();
      const k = await B.evaluate(() => { const c = S.ex.find(x => cname(x) === 'Giant Growth'); return c ? {plot:c.r21bplot} : null; });
      check(r0.includes('Giant Growth') && k && k.plot, `Giant Growth was exiled from the stack and is plotted in Kim's exile (${JSON.stringify(k)})`);
    });
    await step('Path of the Pyromancer: planeswalk / chaos are no-ops outside Planechase (logged, no by-hand box)', async () => {
      const hw = await A.evaluate(async () => { let n = 0; const h = handWarn; handWarn = (...a) => { n++; return h(...a); }; await runEffects('Planeswalk. Chaos ensues.', {k:null, name:'Path of the Pyromancer', full:''}); handWarn = h; return n; });
      check(hw === 0, 'no "do this by hand" for planeswalk / chaos ensues');
    });
  } catch (e){ console.log('ERROR', e); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
