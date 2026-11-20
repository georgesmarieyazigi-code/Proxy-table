process.env.TOP = '1';
// Round 18 helper I: fixes from the wrapper-architecture audit (AUDIT.md) — real 2-player game (Georges vs Kim)
const CC = require('./cards');
const WANT = ["Akroma's Memorial", 'Grizzly Bears', 'Llanowar Elves', 'Questing Beast', 'Languish', 'Golgari Charm', 'Massacre Girl', 'Vizkopa Guildmage', 'Surge to Victory',
  'Summon: Leviathan', 'Waltz of Rage', 'Duskmantle Guildmage', 'Summon: Good King Mog XII', 'Wild Growth', 'Forest', 'Quandrix Command', 'The Eternal Wanderer', 'Xanathar, Guild Kingpin',
  'Mindslaver', 'Divination', 'Lord of Atlantis', 'Lightning Bolt', 'Counterspell', 'Goldspan Dragon', 'Tam, Mindful First-Year', 'Call the Spirit Dragons'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, put, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { setInterval(() => { const m = UI.modal; if (!m || m.__done) return;
  try {
    if (m.type === 'pick' && m.resolve){ const n = Math.max(m.min || 0, m.max ? 1 : 0); m.__done = 1; m.resolve((m.cards || []).slice(0, n).map(c => c.id)); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); m.__done = 1; m.resolve(o[0] ? o[0].value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ m.__done = 1; m.resolve([]); closeModal(); }
    else if (m.run){ m.__done = 1; m.run(m.def ?? 1); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails();
  // a player at 0 life really ends the game now (v25): bring both players back before each step
  for (const p of [PA, PB]) if (p) { const was = await p.evaluate(() => { const w = S.lost || S.g23lost || S.j18out || ''; if (w){ S.lost = ''; S.g23lost = 0; S.j18out = ''; S.j18left = ''; S.b27lost = 0; if (S.life <= 0) S.life = 40; commit(); } UI.f24over = 0; return w; }).catch(() => ''); if (was) console.log('    (revived a player who had lost: ' + was + ')'); }
  try { await T(90000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if ((H.fails() > f0 || process.env.LOGS) && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r18a');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r18a');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const after = async () => { await sleep(500); await settle([A, B]); await sleep(1200); await settle([A, B]); await sleep(500); };
  const life = p => p.evaluate(() => S.life);
  // n copies of a card straight onto a battlefield (unstacked, so each is its own permanent)
  const spawn = (p, nm, n) => p.evaluate(([nm, n]) => { const k = [...DICT.values()].find(a => a.n === nm).k; for (let i = 0; i < n; i++) S.bf.push({id:S.nid++, k, x:10 + (i % 40) * 3, y:10 + Math.floor(i / 40) * 10}); commit(); }, [nm, n]);
  const count = (p, nm) => p.evaluate(nm => S.bf.filter(c => cname(c) === nm).reduce((a, c) => a + (c.n || 1), 0), nm);
  const clear = p => p.evaluate(() => { S.bf = S.bf.filter(c => isLand(c.k) && !c.tok && !c.emb); S.stk = []; S.dly = []; commit(); });
  const run = (p, txt, nm, extra) => p.evaluate(async ([txt, nm, extra]) => { const k = [...DICT.values()].find(a => a.n === nm)?.k || null; const src = S.bf.find(c => c.k === k);
    const ctx = {k, name:nm, full:info(k)?.o || txt, srcId:src ? src.id : null, ...(extra || {})}; ctx.it = {sid:rid(6), kind:'ability', k, nm, txt, srcId:ctx.srcId}; await runEffects(txt, ctx); commit(); return 'ok'; }, [txt, nm, extra]);
  try {
    const KIM = await A.evaluate(() => [...OPP.keys()][0]); const GEO = await B.evaluate(() => [...OPP.keys()][0]);

    await step('#1 a burst of 60 cross-player requests all arrive', async () => {
      const b0 = await life(B);
      await A.evaluate(pid => { for (let i = 0; i < 60; i++) sendRq(pid, 'life', -1, 'burst test'); commit(); }, KIM);
      await sleep(2500);
      check(await life(B) === b0 - 60, `Kim loses 60 life, one per request (${b0} → ${await life(B)})`);
      await B.evaluate(() => { S.life = 40; commit(); });
    });

    await step('#1b Massacre Wurm-style -2/-2 against 45 of Kim\'s creatures kills all of them', async () => {
      await spawn(B, 'Grizzly Bears', 45); await sleep(2000);
      await run(A, 'Creatures your opponents control get -2/-2 until end of turn.', 'Massacre Wurm'); await sleep(3000);
      check(await count(B, 'Grizzly Bears') === 0, `all 45 Bears died (${await count(B, 'Grizzly Bears')} left)`);
      await clear(B); await B.evaluate(() => { S.gy = S.gy.filter(c => cname(c) !== 'Grizzly Bears'); commit(); });
    });

    await step('#5 a burst of 60 events all reach the opponent', async () => {
      await B.evaluate(() => { window.__n = 0; const he = handleEvent; handleEvent = function(pid, ev){ if (pid !== MYPID && ev && ev.type === 'gain' && ev.amt === 7) window.__n++; return he.apply(this, arguments); }; });
      await A.evaluate(() => { for (let i = 0; i < 60; i++) emit({type:'gain', k:null, id:0, cnt:1, amt:7}); commit(); });
      await sleep(2500);
      check(await B.evaluate(() => window.__n) === 60, `Kim's client processed 60 of 60 remote gain events (${await B.evaluate(() => window.__n)})`);
    });

    await step('#2 kwOf on an opponent\'s creature uses that player\'s anthems', async () => {
      await put(B, "Akroma's Memorial"); await put(B, 'Grizzly Bears'); await sleep(1500);
      const r = await A.evaluate(pid => { const g = (OPP.get(pid).bf || []).find(c => cname(c) === 'Grizzly Bears'); return g ? [kwOf(g, 'flying', pid), kwOf(g, 'first strike', pid)] : null; }, KIM);
      check(r && r[0] && r[1], `Georges sees Kim's Bears with flying and first strike from Kim's Akroma's Memorial (${r})`);
      const mine = await B.evaluate(() => { const g = S.bf.find(c => cname(c) === 'Grizzly Bears'); return kwOf(g, 'flying'); });
      check(mine, 'Kim\'s own view agrees');
      await put(A, 'Grizzly Bears'); await sleep(800);
      const geo = await B.evaluate(pid => { const g = (OPP.get(pid).bf || []).find(c => cname(c) === 'Grizzly Bears'); return g ? kwOf(g, 'flying', pid) : 'none'; }, GEO);
      check(geo === false, `Kim's Memorial does not give Georges's Bears flying on Kim's client (${geo})`);
      await clear(A); await clear(B); await sleep(800);
    });

    await step('#3 Languish ("All creatures get -4/-4") and Golgari Charm hit every creature', async () => {
      await spawn(B, 'Grizzly Bears', 5); await spawn(A, 'Grizzly Bears', 2); await sleep(1500);
      await run(A, 'All creatures get -4/-4 until end of turn.', 'Languish'); await sleep(3000);
      check(await count(B, 'Grizzly Bears') === 0, `Kim's 5 Bears died (${await count(B, 'Grizzly Bears')} left)`);
      check(await count(A, 'Grizzly Bears') === 0, `Georges's 2 Bears died (${await count(A, 'Grizzly Bears')} left)`);
      await spawn(B, 'Llanowar Elves', 3); await sleep(1500);
      await run(A, 'All creatures get -1/-1 until end of turn.', 'Golgari Charm'); await sleep(3000);
      check(await count(B, 'Llanowar Elves') === 0, `Golgari Charm: Kim's 3 Elves died (${await count(B, 'Llanowar Elves')} left)`);
      await clear(A); await clear(B);
    });

    await step('#4 "whenever … this turn" lines whose own handler needs the source: Vizkopa Guildmage, Massacre Girl, Surge to Victory', async () => {
      await put(A, 'Vizkopa Guildmage'); await sleep(500);
      await run(A, 'Whenever you gain life this turn, each opponent loses that much life.', 'Vizkopa Guildmage'); await sleep(300);
      const b0 = await life(B); await A.evaluate(() => { gainLife(3, 'test'); commit(); }); await after();
      check(await life(B) === b0 - 3, `Vizkopa: Georges gains 3 → Kim loses 3 (${b0} → ${await life(B)})`);
      await clear(A); await B.evaluate(() => { S.life = 40; commit(); });
      for (const n of ['Llanowar Elves', 'Grizzly Bears', 'Questing Beast']) await put(B, n); await sleep(1000);
      await put(A, 'Massacre Girl'); await after(); await sleep(1500); await after();
      const bst = await B.evaluate(() => S.bf.filter(c => isCreatureCard(c)).map(c => cname(c) + ' ' + (stats(c) || []).join('/')));
      check(!bst.some(x => /Grizzly/.test(x)) && bst.some(x => x === 'Questing Beast 1/1'), `Massacre Girl: Elves die → Bears die → Questing Beast left at 1/1 (${bst})`);
      check(!(await A.evaluate(() => S.log.some(e => /do by hand: .*other than Massacre Girl/.test(e.s)))), 'no "do by hand" for the death chain');
      await clear(A); await clear(B);
      await run(A, 'Whenever a creature you control deals combat damage to a player this turn, copy the exiled card.', 'Surge to Victory', {m24exK:[await A.evaluate(() => [...DICT.values()].find(a => a.n === 'Lightning Bolt').k)]});
      const sv = await A.evaluate(() => ({surge:!!(S.m24surge && S.m24surge.t === turnStr()), emb:S.bf.some(c => c.emb && /Surge/.test(info(c.k)?.n || ''))}));
      check(sv.surge && !sv.emb, `Surge to Victory uses its own linked-card handler, not a free-standing delayed trigger (${JSON.stringify(sv)})`);
      await A.evaluate(() => { S.m24surge = null; commit(); }); await clear(A);
    });

    await step('#4b generic delayed triggers still work: Summon: Leviathan, Waltz of Rage, Duskmantle Guildmage', async () => {
      await run(A, 'Until end of turn, whenever a Kraken, Leviathan, Merfolk, Octopus, or Serpent attacks, draw a card.', 'Summon: Leviathan');
      const h0 = await A.evaluate(() => S.hand.length);
      await A.evaluate(() => { const k = [...DICT.values()].find(a => a.n === 'Lord of Atlantis').k; const c = {id:S.nid++, k, x:50, y:50}; S.bf.push(c); emit({type:'attack', k:c.k, id:c.id, cnt:1}); commit(); }); await after();
      check(await A.evaluate(() => S.hand.length) === h0 + 1, `Leviathan: a Merfolk attacks → Georges draws a card`);
      await run(A, 'Until end of turn, whenever a creature you control dies, exile the top card of your library.', 'Waltz of Rage');
      const e0 = await A.evaluate(() => S.ex.length);
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Lord of Atlantis'); moveCard(c.id, 'gy'); commit(); }); await after();
      check(await A.evaluate(() => S.ex.length) === e0 + 1, 'Waltz of Rage: a creature dies → top card exiled');
      await run(A, "Whenever a card is put into an opponent's graveyard from anywhere this turn, that player loses 1 life.", 'Duskmantle Guildmage');
      const b0 = await life(B); await B.evaluate(() => { mill(2); commit(); }); await after();
      check(await life(B) === b0 - 2, `Duskmantle: Kim mills 2 → loses 2 (${b0} → ${await life(B)})`);
      await clear(A); await B.evaluate(() => { S.life = 40; commit(); });
    });

    await step('#6 Wild Growth: activating an already tapped Forest adds nothing', async () => {
      await A.evaluate(() => { const k = [...DICT.values()].find(a => a.n === 'Forest').k; S.bf.push({id:S.nid++, k, x:80, y:80, r18f:1}); commit(); }); await put(A, 'Wild Growth'); await sleep(300);
      const r = await A.evaluate(async () => { const f = S.bf.find(c => c.r18f); const w = S.bf.find(c => cname(c) === 'Wild Growth'); w.att = {pid:MYPID, id:f.id}; S.pool = emptyPool(); commit();
        let mt = 0; const he = handleEvent; handleEvent = function(pid, ev){ if (pid === MYPID && ev && ev.type === 'manatap') mt++; return he.apply(this, arguments); };
        const ab = manaAbs(f)[0]; await activateMana(f, ab, 0); const g1 = S.pool.G;
        await activateMana(f, ab, 0); await new Promise(r => setTimeout(r, 300)); handleEvent = he; return {g1, g2:S.pool.G, mt}; });
      check(r.g1 === 2, `first activation: {G}{G} (${r.g1})`);
      check(r.g2 === 2, `second activation on the tapped Forest adds no Wild Growth mana (${r.g2})`);
      check(r.mt === 1, `one manatap event, not two (${r.mt})`);
      await A.evaluate(() => { S.pool = emptyPool(); S.bf = S.bf.filter(c => !c.r18f && cname(c) !== 'Wild Growth'); commit(); });
    });

    await step('#7 Quandrix Command shuffles all three of Kim\'s graveyard cards (real 36-character keys)', async () => {
      await B.evaluate(() => { const b = [...DICT.values()].find(a => a.n === 'Grizzly Bears'); for (let i = 0; i < 3; i++){ const k = `0b6f${i}c2e-5d1a-4f8e-9a3b-${String(i).repeat(12)}`; DICT.set(k, {...b, k}); S.gy.push({id:S.nid++, k}); } commit(); });
      await sleep(2000);
      const n0 = await B.evaluate(() => S.gy.length);
      await A.evaluate(async pid => { const gy = targetCands({zone:'gy', desc:'card', whose:'opp'}).filter(t => t.pid === pid && t.k.length === 36);
        const ctx = {name:'Quandrix Command', k:null, tgts:[[{t:'player', pid, nm:nameOf(pid)}], gy.slice(0, 3)]}; await runEffects('Target player shuffles up to three target cards from their graveyard into their library.', ctx); commit(); }, KIM);
      await sleep(2500);
      check(await B.evaluate(() => S.gy.length) === n0 - 3, `Kim's graveyard lost all 3 cards (${n0} → ${await B.evaluate(() => S.gy.length)})`);
      // the live build routes this line to engine23j (one jShufGy per card); engine23h's shadowed handler had the 80-char d bug — drive it directly
      await B.evaluate(() => { const b = [...DICT.values()].find(a => a.n === 'Grizzly Bears'); for (let i = 3; i < 6; i++){ const k = `0b6f${i}c2e-5d1a-4f8e-9a3b-${String(i).repeat(12)}`; DICT.set(k, {...b, k}); S.gy.push({id:S.nid++, k}); } commit(); });
      await sleep(2000); const n1 = await B.evaluate(() => S.gy.length);
      await A.evaluate(async pid => { const gy = targetCands({zone:'gy', desc:'card', whose:'opp'}).filter(t => t.pid === pid && t.k.length === 36);
        const s = 'Target player shuffles up to three target cards from their graveyard into their library'; const ctx = {name:'Quandrix Command', k:null, tgts:[[{t:'player', pid, nm:nameOf(pid)}], gy.slice(0, 3)]};
        await doRound23HPre5(s, s.toLowerCase(), ctx); commit(); }, KIM);
      await sleep(2500);
      check(await B.evaluate(() => S.gy.length) === n1 - 3, `engine23h's own handler also moves all 3 (${n1} → ${await B.evaluate(() => S.gy.length)})`);
    });

    await step('#8 "each opponent sacrifices the creatures in their chosen pile" with 30 creatures (long id list)', async () => {
      await B.evaluate(() => { S.nid = Math.max(S.nid, 10000); commit(); }); await spawn(B, 'Llanowar Elves', 30); await sleep(2000);
      await A.evaluate(async pid => { const ids = (OPP.get(pid).bf || []).filter(c => cname(c) === 'Llanowar Elves').map(c => [c.id, 'Llanowar Elves']);
        const ctx = {name:'Pile test', k:null, qOppPiles:{[pid]:[ids, []]}, qOppPick:{[pid]:0}}; await runEffects('Each opponent sacrifices the creatures in their chosen pile.', ctx); commit(); }, KIM);
      await sleep(3000);
      check(await count(B, 'Llanowar Elves') === 0, `all 30 Elves sacrificed (${await count(B, 'Llanowar Elves')} left)`);
      await clear(B);
    });

    await step('#9 l24older probing no longer swaps the global handWarn', async () => {
      const r = await A.evaluate(async () => { const old = L24.dsOld; const hw = handWarn; let other = false;
        L24.dsOld = async (s, ctx) => { await new Promise(r => setTimeout(r, 300)); handWarn(s, ctx); };
        const n0 = S.log.length;
        const p1 = l24older('probe one', {name:'P1'}); await new Promise(r => setTimeout(r, 50)); const p2 = l24older('probe two', {name:'P2'});
        await new Promise(r => setTimeout(r, 100)); handWarn('an unrelated warning', {name:'Other'}); other = S.log.slice(-3).some(e => /do by hand: an unrelated warning/.test(e.s));
        const [a, b] = await Promise.all([p1, p2]); L24.dsOld = old;
        handWarn('after both probes', {name:'Later'}); const later = S.log.slice(-2).some(e => /do by hand: after both probes/.test(e.s));
        return {a, b, other, later, same:handWarn === hw, probesLogged:S.log.slice(-8).some(e => /probe (one|two)/.test(e.s))}; });
      check(r.a === false && r.b === false, `both probes report "not handled" (${r.a}, ${r.b})`);
      check(r.other, 'a warning from another flow during the probe is shown');
      check(r.later && r.same, 'handWarn works normally after overlapping probes');
      check(!r.probesLogged, 'the probed sentences themselves are not shown as warnings');
    });

    await step('#10 request n is not clamped to 99; r25dly carries the card id and source key', async () => {
      await B.evaluate(() => { S.life = 300; commit(); }); await sleep(800);
      await A.evaluate(pid => { sendRq(pid, 'life', -150, 'big drain'); commit(); }, KIM); await sleep(2000);
      check(await life(B) === 150, `Kim loses 150 life (${await life(B)})`);
      await B.evaluate(() => { S.life = 40; S.dly = []; commit(); });
      const wk = await A.evaluate(() => [...DICT.values()].find(a => a.n === 'The Eternal Wanderer').k);
      await run(A, "Return that card to the battlefield under its owner's control at the beginning of that player's next end step.", 'The Eternal Wanderer', {lastT:[{t:'card', pid:KIM, id:1500, nm:'Test card'}]});
      await sleep(2000);
      const d = await B.evaluate(() => S.dly.filter(x => x.op === 'r16ret').map(x => ({srcId:x.srcId, k:x.k})));
      check(d.length === 1 && d[0].srcId === 1500 && d[0].k === wk, `Kim's delayed return points at id 1500 with The Eternal Wanderer as source (${JSON.stringify(d)})`);
      await B.evaluate(() => { S.dly = []; commit(); });
    });

    await step('#11 Xanathar\'s top card and a Mindslaver hand are not readable from the public state', async () => {
      await A.evaluate(pid => { S.c27xan = {t:turnStr(), pid, src:'Xanathar, Guild Kingpin'}; commit(); }, KIM);
      await waitFor(B, () => !!c27XanOn(), null, 6000); await B.evaluate(() => commit()); await sleep(1500);   // Kim's board goes out on Kim's next commit
      const top = await B.evaluate(() => S.lib[0].k);
      check(await waitFor(A, ([pid, top]) => (OPP.get(pid).c27xtop || {}).k === top, [KIM, top], 8000), 'Georges (the Xanathar player) still sees the top card');
      const raw = await B.evaluate(() => JSON.stringify(publicState().c27xtop || null));
      check(!raw.includes(top) && /"e":"/.test(raw), `Kim's published state carries the top card only sealed (${raw.slice(0, 60)})`);
      await A.evaluate(() => { S.c27xan = null; commit(); }); await sleep(800);
      const hand = await B.evaluate(() => S.hand.map(c => c.k));
      await B.evaluate(async pid => { q24Pub('slavehand', 'hand', S.hand.map(c => c.k), pid); await r18PubReady('slavehand'); sendRq(pid, 'qslaveAsk', 0, 'Mindslaver', {ref:'slavehand'}); commit(); }, GEO);
      await sleep(2500);
      const raw2 = await B.evaluate(() => JSON.stringify(publicState()));
      check(hand.length && !hand.some(k => raw2.includes(k)), 'Kim\'s published state does not list the hand keys');
      const seen = await A.evaluate(() => UI.q24slaveHand && UI.q24slaveHand.hand);
      const names = await B.evaluate(() => S.hand.map(cname));
      check(seen && names.every(n => seen.includes(n)), `Georges (the controller) sees Kim's hand (${seen})`);
      check(!(await A.evaluate(names => S.log.some(e => names.some(n => e.s.includes('Their hand') && e.s.includes(n))), names)), 'the hand is not written to Georges\'s (public) log');
      await B.evaluate(() => { S.q24pub = []; commit(); });
      // a sealed question still round-trips (q24Ask → Kim answers → Georges gets the answer)
      const ans = await A.evaluate(async pid => q24Ask(pid, {kind:'choice', title:'pick one', opts:['first', 'second']}, 'Test'), KIM);
      check(ans === '0', `q24Ask round trip through a sealed entry (${ans})`);
    });

    await step('#12/#13 die events keep their counters cross-player; no dead flip/g23ctrOther events', async () => {
      await A.evaluate(() => { window.__cm = null; const he = handleEvent; handleEvent = function(pid, ev){ if (pid !== MYPID && ev && ev.type === 'die' && ev.k && /Llanowar/.test(info(ev.k)?.n || '')) window.__cm = [ev.cp || 0, ev.cm || 0]; return he.apply(this, arguments); }; });
      await spawn(B, 'Llanowar Elves', 1); await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Llanowar Elves'); c.cm = 1; c.cp = 2; moveCard(c.id, 'gy'); commit(); }); await sleep(2000);
      const cm = await A.evaluate(() => window.__cm);
      check(cm && cm[0] === 2 && cm[1] === 1, `Georges sees Kim's dying Elves had 2 +1/+1 and 1 -1/-1 counters (${cm})`);
      await run(A, 'Flip a coin until you lose a flip.', 'Mana Crypt');
      check(!(await A.evaluate(() => S.ev.some(e => e.type === 'flip' || e.type === 'g23ctrOther'))), 'no events of unknown type are emitted');
      const dead = await A.evaluate(() => ['pwdmg', 'tempted', 'pois2', 'r21psnSet', 'r23fShuf', 'g23pick', 'r25ask', 'r25draw', 'd27ronaAns', 'd27gyCast', 'd27gyCastAns'].filter(o => RQ_OPS.includes(o)));
      check(!dead.length, `dead request ops removed from RQ_OPS (${dead})`);
    });
    await step('#15 Call the Spirit Dragons sees colour-changing effects', async () => {
      await put(A, 'Goldspan Dragon'); await sleep(300);
      const id = await A.evaluate(() => S.bf.find(c => cname(c) === 'Goldspan Dragon').id);
      await A.evaluate(id => { l24addMod(S.bf.find(c => c.id === id), {s:'Tam, Mindful First-Year', u:'', col:'WUBRG'}); commit(); }, id);   // a layer-5 "is all colors" record, as Tam / Fallaji Wayfarer make
      const col = await A.evaluate(id => d27Col(S.bf.find(c => c.id === id)), id);
      await run(A, 'For each color, put a +1/+1 counter on a Dragon you control of that color.', 'Call the Spirit Dragons');
      const cp = await A.evaluate(id => S.bf.find(c => c.id === id).cp || 0, id);
      check(col.length === 5 && cp === 5, `an all-colours Goldspan Dragon gets a counter for each of the five colours (colours ${col}, counters ${cp})`);
      await clear(A);
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  console.log(`\n${H.results.filter(r => r.startsWith('PASS')).length} passed, ${H.fails()} failed`);
  await browser.close(); process.exit(H.fails() ? 1 : 0);
})();
