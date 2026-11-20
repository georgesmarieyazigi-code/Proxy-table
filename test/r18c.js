process.env.TOP = '1';
// Round 18 helper K: fuzzer bugs 6–15 (BUGS.md) and the "do by hand" gaps — real 2-player games (Georges vs Kim)
const CC = require('./cards');
const WANT = ['Lórien Revealed', 'Mental Journey', 'Ravenform', 'Entreat the Angels', 'Electrodominance', 'Hidden Strings', 'Cut Your Losses', 'Collective Resistance',
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
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r18c');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r18c');
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
    const KIM = await A.evaluate(() => [...OPP.keys()][0]);
    await A.evaluate(() => { for (let i = 0; i < 4; i++){ const c = S.lib.find(x => cname(x) === 'Plains'); if (c) moveCard(c.id, 'bf', {quiet:true}); } commit(); });

    await step('#6 keyword lines on instants and sorceries are not run as effects (typecycling, foretell, miracle)', async () => {
      await reset(A); await reset(B); await put(B, 'Llanowar Elves'); await sleep(800);
      for (const n of ['Lórien Revealed', 'Mental Journey']){ await toHand(A, n); const h0 = await A.evaluate(() => S.hand.length); await cast(A, n, {U:9, C:9}); await after();
        check(await A.evaluate(() => S.hand.length) === h0 + 2, `${n}: drew three cards (hand ${h0} → ${await A.evaluate(() => S.hand.length)})`); }
      await toHand(A, 'Ravenform'); await A.evaluate(() => { window.__tgt = 'Llanowar'; }); await cast(A, 'Ravenform', {U:9, C:9}); await after();
      check(await count(B, 'Llanowar Elves') === 0 && await B.evaluate(() => S.bf.some(c => c.tok && /Bird/.test(typeOf(c)))), 'Ravenform: exiled the Elves, Kim got a Bird');
      await toHand(A, 'Entreat the Angels'); await A.evaluate(() => { window.__X = 1; }); await cast(A, 'Entreat the Angels', {W:9, C:9}); await after();
      check(await A.evaluate(() => S.bf.filter(c => c.tok && /Angel/.test(typeOf(c))).reduce((a, c) => a + (c.n || 1), 0)) === 1, 'Entreat the Angels (X = 1): one Angel');
      await noNotes('typecycling / foretell / miracle lines');
      await clear(A); await clear(B);
    });

    await step('#6 the deck checker runs a spell keyword line the way resolution does', async () => {
      const r = await A.evaluate(async () => { const out = {};
        for (const n of ['Lórien Revealed', 'Mental Journey', 'Entreat the Angels', 'Hidden Strings', "Vona's Hunger", 'Into the Flood Maw', 'Cut Your Losses', 'Perch Protection', 'Summons of Saruman', 'Collective Effort']){ const a = [...DICT.values()].find(x => x.n === n); out[n] = a ? (await checkCard(a.k)).issues.map(i => i.text) : 'missing'; }
        // a made-up sorcery whose "Amass" line (accepted as keyword-only text) hides an effect the engine can't do
        const k = 'r18kfake'; DICT.set(k, {k, n:'Fake Muster', m:'{1}{B}', t:'Sorcery', o:'Draw a card.\nAmass Zombies 1. Frobnicate the zorb.', p:'', c:'B', toks:[], kw:[], mv:2});
        out.fake = (await checkCard(k)).issues.map(i => i.text); return out; });
      const clean = Object.entries(r).filter(([n]) => n !== 'fake');
      check(clean.every(([, v]) => Array.isArray(v) && !v.length), `real keyword spells are fully understood (${JSON.stringify(clean.filter(([, v]) => !Array.isArray(v) || v.length))})`);
      check(r.fake.some(t => /Frobnicate/i.test(t)), `a keyword-looking line that would become a note in play is reported (${JSON.stringify(r.fake)})`);
    });

    await step('#6 gift: the chosen opponent gets the gift (a card, a tapped Fish)', async () => {
      await reset(A); await reset(B); const h0 = await B.evaluate(() => S.hand.length);
      await toHand(A, "Dawn's Truce"); await A.evaluate(() => { window.__want = '^Promise'; }); await cast(A, "Dawn's Truce", {W:9, C:9}); await after();
      check(await B.evaluate(() => S.hand.length) === h0 + 1, `Gift a card: Kim drew a card (${h0} → ${await B.evaluate(() => S.hand.length)})`);
      await put(B, 'Llanowar Elves'); await sleep(800);
      await toHand(A, 'Into the Flood Maw'); await A.evaluate(() => { window.__want = '^Promise'; window.__tgt = 'opp'; }); await cast(A, 'Into the Flood Maw', {U:9, C:9}); await after();
      const fish = await B.evaluate(() => { const f = S.bf.find(c => c.tok && /Fish/.test(typeOf(c))); return f ? {tap:!!f.tap, st:stats(f), cr:isCreatureCard(f)} : null; });
      check(fish && fish.tap && fish.cr && fish.st && fish.st[0] === 1 && fish.st[1] === 1, `Gift a tapped Fish: Kim has a tapped 1/1 Fish (${JSON.stringify(fish)})`);
      const h1 = await B.evaluate(() => S.hand.length); await toHand(A, "Dawn's Truce"); await A.evaluate(() => { window.__want = '^No gift'; }); await cast(A, "Dawn's Truce", {W:9, C:9}); await after();
      check(await B.evaluate(() => S.hand.length) === h1, 'no gift promised: Kim draws nothing');
      await noNotes('gift spells'); await clear(A); await clear(B);
    });

    await step('#6 ascend on a sorcery: ten permanents give the city\'s blessing', async () => {
      await reset(A); await reset(B); await A.evaluate(() => { const k = customToken('Soldier', '1/1', 'W'); createToken(k, 8); S.cityB = false; commit(); });
      await put(B, 'Llanowar Elves'); await sleep(800); await toHand(A, "Vona's Hunger"); await cast(A, "Vona's Hunger", {B:9, C:9}); await after();
      check(await A.evaluate(() => !!S.cityB), 'Georges has the city\'s blessing'); check(await count(B, 'Llanowar Elves') === 0, 'Kim sacrificed the Elves');
      await noNotes("Vona's Hunger"); await clear(A); await clear(B); await A.evaluate(() => { S.cityB = false; commit(); });
    });

    await step('#6 cipher: Hidden Strings is encoded on a creature and cast again when it deals combat damage', async () => {
      await reset(A); await reset(B); await put(A, 'Grizzly Bears'); await put(B, 'Llanowar Elves'); await sleep(800);
      await toHand(A, 'Hidden Strings'); await A.evaluate(() => { window.__tgt = 'Llanowar'; window.__want = 'Tap'; }); await cast(A, 'Hidden Strings', {U:9, C:9}); await after();
      const r = await A.evaluate(() => ({ex:S.ex.some(c => cname(c) === 'Hidden Strings'), gy:S.gy.some(c => cname(c) === 'Hidden Strings'), enc:(S.r18kCiph || []).length}));
      check(r.ex && !r.gy && r.enc === 1, `Hidden Strings is exiled, encoded on the Bears (${JSON.stringify(r)})`);
      await B.evaluate(() => { S.bf.forEach(c => { c.tap = false; }); commit(); });
      await A.evaluate(() => { window.__want = '^(Cast the copy|Tap)'; window.__titles = []; }); await combat('Grizzly Bears'); await after();
      const t = await A.evaluate(() => ({titles:window.__titles, log:S.log.slice(-30).map(e => e.s).filter(s => /copy|Cipher|Hidden/i.test(s))}));
      check(t.titles.some(x => /Cipher: cast a copy of Hidden Strings/.test(x)), `the cipher trigger offered a free copy (${JSON.stringify(t)})`);
      check(t.log.some(s => /Hidden Strings \(copy\)/.test(s)), 'a copy of Hidden Strings was cast');
      await noNotes('cipher'); await A.evaluate(() => { setPhase(3); commit(); }); await clear(A); await clear(B);
    });

    await step('#6 casualty: Cut Your Losses sacrifices a creature and is copied', async () => {
      await reset(A); await reset(B); await put(A, 'Grizzly Bears'); await sleep(500); const l0 = await B.evaluate(() => S.lib.length);
      await toHand(A, 'Cut Your Losses'); await A.evaluate(() => { window.__tgt = 'kim'; window.__pick = 1; }); await cast(A, 'Cut Your Losses', {U:9, C:9}); await after();
      const l1 = await B.evaluate(() => S.lib.length); const want = Math.floor(l0 / 2) - Math.floor(Math.floor(l0 / 2) / 2);
      check(await A.evaluate(() => S.gy.some(c => cname(c) === 'Grizzly Bears')), 'the Bears were sacrificed');
      check(l1 === l0 - Math.floor(l0 / 2) - Math.floor((l0 - Math.floor(l0 / 2)) / 2), `Kim milled half twice (${l0} → ${l1})`);
      await noNotes('casualty'); await clear(A); void want;
    });

    await step('#6 escalate: each extra mode adds the escalate cost', async () => {
      await reset(A); await reset(B); await put(B, 'Sol Ring'); await put(B, 'Wild Growth'); await put(A, 'Grizzly Bears'); await sleep(800);
      await toHand(A, 'Collective Resistance');
      await A.evaluate(() => { window.__tgt = 'opp'; }); await cast(A, 'Collective Resistance', {G:2, C:1}); await after();
      check(await A.evaluate(() => S.hand.some(c => cname(c) === 'Collective Resistance')), 'three modes with {1}{G}{G}: not enough mana (it costs {1}{G}{G}{G}), still in hand');
      await A.evaluate(() => { window.__tgt = null; }); await A.evaluate(() => { window.__tgt = 'opp'; });
      await cast(A, 'Collective Resistance', {G:3, C:1}); await after();
      const r = await B.evaluate(() => ({sol:S.bf.some(c => cname(c) === 'Sol Ring'), wg:S.bf.some(c => cname(c) === 'Wild Growth')})); const pool = await A.evaluate(() => poolTotal(S.pool));
      check(!r.sol && !r.wg && pool === 0, `{1}{G}{G}{G}: destroyed Sol Ring and Wild Growth, pool spent (${JSON.stringify(r)}, pool ${pool})`);
      await noNotes('escalate'); await clear(A); await clear(B);
    });

    await step('#7 X = 0 is a real value (Electrodominance); miracle {X} asks for X', async () => {
      await reset(A); await toHand(A, 'Electrodominance'); await A.evaluate(() => { window.__X = 0; window.__tgt = 'kim'; window.__want = "^(Don't|No)"; }); await cast(A, 'Electrodominance', {R:2}); await after();
      const asks = await A.evaluate(() => window.__asks);
      check(asks.length === 1 && /Choose X/.test(asks[0]), `only "Choose X" was asked (${JSON.stringify(asks)})`);
      await reset(A); await toHand(A, 'Entreat the Angels'); await A.evaluate(() => { window.__X = 2; });
      await A.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Entreat the Angels'); S.pool = {...emptyPool(), W:2, C:2}; beginCast(c, 'hand', {gy:{mana:'{X}{W}{W}', extra:[], label:'Miracle'}}); }); await after();
      const n = await A.evaluate(() => S.bf.filter(c => c.tok && /Angel/.test(typeOf(c))).reduce((a, c) => a + (c.n || 1), 0)); const asks2 = await A.evaluate(() => window.__asks);
      check(n === 2 && asks2.length === 1 && /Choose X/.test(asks2[0]), `miracle cost {X}{W}{W} with X = 2: two Angels, one X question (${n}, ${JSON.stringify(asks2)})`);
      await noNotes('X spells'); await clear(A);
    });

    await step('#8 Three Tree City counts creatures of the chosen type', async () => {
      await reset(A); await A.evaluate(() => { window.__X = 'Elf'; }); const id = await put(A, 'Three Tree City'); await put(A, 'Llanowar Elves'); await sleep(800);
      await A.evaluate(() => { const e = S.lib.find(x => cname(x) === 'Llanowar Elves') || S.hand.find(x => cname(x) === 'Llanowar Elves'); const c = S.bf.find(x => cname(x) === 'Three Tree City'); c.ctype = 'Elf'; c.tap = false; commit(); }); await A.evaluate(() => createFromText('Create a 1/1 green Elf Warrior creature token', {k:null, name:'test'}));
      await A.evaluate(() => { window.__asks = []; window.__want = 'G'; S.pool = {...emptyPool(), C:2}; const c = S.bf.find(x => cname(x) === 'Three Tree City'); const ab = abilityList(c).find(a => /amount of mana/i.test(a.eff)); activateAbility(c, ab); }); await after();
      const r = await A.evaluate(() => ({G:S.pool.G, asks:window.__asks}));
      const elves = await A.evaluate(() => S.bf.filter(c => /Elf/.test(typeOf(c))).map(c => cname(c) + ':' + typeOf(c)));
      check(r.G === 2 && !r.asks.length, `added {G}{G} for 2 Elves without asking (${JSON.stringify(r)} ${JSON.stringify(elves)})`); void id;
      await noNotes('Three Tree City'); await clear(A); await A.evaluate(() => { S.pool = emptyPool(); commit(); });
    });

    await step('#9 fallback tokens are the real predefined tokens; creature tokens get P/T and keywords', async () => {
      const r = await A.evaluate(async () => { const out = {};
        for (const n of ['Treasure', 'Food', 'Clue', 'Map', 'Blood', 'Gold', 'Powerstone', 'Junk', 'Lander', 'Shard', 'Mutagen', 'Walker']){ const before = new Set(S.bf.map(c => c.id)); await createFromText(`Create a ${n} token`, {k:null, name:'test'}); const t = S.bf.find(c => !before.has(c.id) || (c.tok && cname(c) === n)); out[n] = t ? {t:typeOf(t), cr:isCreatureCard(t), st:stats(t), ab:abilityList(t).length + manaAbs(t).length} : null; }
        const b0 = new Set(S.bf.map(c => c.id)); await createFromText('Create two 1/1 white Human Soldier creature tokens with vigilance', {k:null, name:'test'}); const s = S.bf.find(c => !b0.has(c.id));
        out.soldier = s ? {t:typeOf(s), st:stats(s), vig:kwOf(s, 'vigilance'), n:s.n} : null;
        const b1 = new Set(S.bf.map(c => c.id)); await createFromText('Create a Monster Role token attached to target creature you control', {k:null, name:'test'}); const ro = S.bf.find(c => !b1.has(c.id)); out.role = ro ? typeOf(ro) : null;
        return out; });
      for (const n of ['Treasure', 'Food', 'Clue', 'Map', 'Blood', 'Gold', 'Powerstone', 'Junk', 'Lander', 'Mutagen']) check(r[n] && !r[n].cr && new RegExp('Artifact — ' + n).test(r[n].t) && r[n].ab >= 1, `${n}: ${JSON.stringify(r[n])}`);
      check(r.Shard && /Enchantment — Shard/.test(r.Shard.t) && r.Shard.ab >= 1, `Shard: ${JSON.stringify(r.Shard)}`);
      check(r.Walker && r.Walker.cr && r.Walker.st && r.Walker.st[0] === 2 && /Zombie/.test(r.Walker.t), `Walker: 2/2 Zombie (${JSON.stringify(r.Walker)})`);
      check(r.soldier && r.soldier.st && r.soldier.st[0] === 1 && r.soldier.vig && /Human Soldier/.test(r.soldier.t), `Human Soldier tokens: ${JSON.stringify(r.soldier)}`);
      check(/Role/.test(r.role || ''), `Monster Role: ${r.role}`);
      // the Treasure taps for mana
      const m = await A.evaluate(() => { S.pool = emptyPool(); const t = S.bf.find(c => cname(c) === 'Treasure'); const ab = manaAbs(t)[0]; return {ab:!!ab, outs:ab && ab.outs.length}; });
      check(m.ab && m.outs === 5, `Treasure: a mana ability for any color (${JSON.stringify(m)})`);
      await clear(A);
    });

    await step('#10 Map token: "Target creature you control explores"', async () => {
      await reset(A); await put(A, 'Grizzly Bears'); await A.evaluate(() => createFromText('Create a Map token', {k:null, name:'test'})); await sleep(500);
      const b0 = await A.evaluate(() => { const g = S.bf.find(c => cname(c) === 'Grizzly Bears'); return {cp:g.cp || 0, hand:S.hand.length, gy:S.gy.length}; });
      await A.evaluate(() => { window.__tgt = 'Grizzly'; window.__want = 'graveyard|Keep|Leave'; S.pool = {...emptyPool(), C:1}; const m = S.bf.find(c => cname(c) === 'Map'); const ab = abilityList(m)[0]; activateAbility(m, ab); }); await after();
      const b1 = await A.evaluate(() => { const g = S.bf.find(c => cname(c) === 'Grizzly Bears'); return {cp:g.cp || 0, hand:S.hand.length, gy:S.gy.length, map:S.bf.some(c => cname(c) === 'Map')}; });
      check(!b1.map && (b1.cp === b0.cp + 1 || b1.hand === b0.hand + 1), `the Bears explored (${JSON.stringify(b0)} → ${JSON.stringify(b1)})`);
      await noNotes('Map token'); await clear(A);
    });

    await step('#11 melee (Tifa, Martial Artist) is automated; no "R26self" in any note', async () => {
      await reset(A); await reset(B); await put(A, 'Tifa, Martial Artist'); await sleep(500);
      await combat('Tifa, Martial Artist');
      const r = await A.evaluate(() => ({log:S.log.slice(-40).map(e => e.s).filter(s => /melee|R26self/.test(s))}));
      check(r.log.some(s => /Tifa.*\+1\/\+1.*melee/.test(s)), `Tifa got +1/+1 from melee (${JSON.stringify(r.log)})`);
      const all = (await notes(A)).join(' '); check(!/R26self/.test(all), 'no placeholder text'); await noNotes('melee');
      await A.evaluate(() => { setPhase(3); commit(); }); await clear(A);
    });

    await step('#12 Jace, the Mind Sculptor +2 on an opponent: see their top card, put it on the bottom', async () => {
      await reset(A); await reset(B); await put(A, 'Jace, the Mind Sculptor'); await sleep(800);
      const top0 = await B.evaluate(() => ({k:S.lib[0].k, n:cname(S.lib[0]), len:S.lib.length}));
      await A.evaluate(() => { window.__tgt = 'kim'; window.__pick = 1; const j = S.bf.find(c => cname(c) === 'Jace, the Mind Sculptor'); activateLoyalty(j, 0); }); await after(); await sleep(1500); await settle([A, B]);
      const top1 = await B.evaluate(() => ({k:S.lib[0].k, last:S.lib[S.lib.length - 1].k, len:S.lib.length}));
      const seen = await A.evaluate(() => window.__titles.filter(t => /top card/i.test(t)));
      check(top1.last === top0.k && top1.k !== top0.k && top1.len === top0.len, `Kim's top card (${top0.n}) went to the bottom`);
      check(seen.length >= 1, `Georges was shown the card (${JSON.stringify(seen)})`);
      const pub = await A.evaluate(pid => JSON.stringify(OPP.get(pid).r18kPeek || {}), KIM);
      check(!pub.includes(top0.k), 'the card key is not readable in Kim\'s public state (sealed)');
      await noNotes('Jace +2'); await clear(A);
    });

    await step('#13 Karn, the Great Creator −2: saying No leaves no note', async () => {
      await reset(A); await put(A, 'Karn, the Great Creator'); await sleep(800);
      await A.evaluate(() => { window.__want = '^No'; const k = S.bf.find(c => cname(c) === 'Karn, the Great Creator'); activateLoyalty(k, 1); }); await after();
      await noNotes('Karn −2 declined'); await clear(A);
    });

    await step('#14 Flickerwisp exiling an opponent\'s permanent: it comes back at the next end step, under its owner\'s control', async () => {
      await reset(A); await reset(B); await put(B, 'Sol Ring'); await sleep(800);
      await toHand(A, 'Flickerwisp'); await A.evaluate(() => { window.__tgt = 'Sol Ring'; }); await cast(A, 'Flickerwisp', {W:9, C:9}); await after();
      check(!(await count(B, 'Sol Ring')) && await B.evaluate(() => S.ex.some(c => cname(c) === 'Sol Ring')), 'Sol Ring is in Kim\'s exile');
      await A.evaluate(() => setPhase(6)); for (let i = 0; i < 8; i++){ await passAll([A, B]); await sleep(300); } await settle([A, B]);
      check(await count(B, 'Sol Ring') === 1, 'Sol Ring returned to Kim\'s battlefield at the end step');
      await noNotes('Flickerwisp'); await myTurn(); await clear(A); await clear(B);
    });

    await step('#15 Claim Jumper repeats its search; Skittering Cicada; Level Up draws', async () => {
      await myTurn(); await reset(A); await reset(B);
      await A.evaluate(() => { S.bf.filter(c => isLand(c.k)).forEach(c => moveCard(c.id, 'lib', {quiet:true})); commit(); });
      await B.evaluate(() => { for (let i = 0; i < 6; i++){ const c = S.lib.find(x => isLand(x.k)); if (c) moveCard(c.id, 'bf', {quiet:true}); } commit(); }); await sleep(1200);
      await toHand(A, 'Claim Jumper'); await A.evaluate(() => { window.__want = '^Yes'; window.__pick = 1; }); await cast(A, 'Claim Jumper', {W:9, C:9}); await after();
      const pl = await A.evaluate(() => S.bf.filter(c => cname(c) === 'Plains').reduce((a, c) => a + (c.n || 1), 0));
      check(pl === 2, `Claim Jumper: two Plains (Kim still had more lands after the first) — ${pl}`);
      await noNotes('Claim Jumper');
      await reset(A); await put(A, 'Skittering Cicada'); await toHand(A, 'Sol Ring'); await cast(A, 'Sol Ring', {C:1}); await after();
      const ci = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Skittering Cicada'); return {st:stats(c), tr:kwOf(c, 'trample')}; });
      check(ci.st[0] === 3 && ci.st[1] === 3 && ci.tr, `Skittering Cicada +1/+1 and trample from a mana value 1 colorless spell (${JSON.stringify(ci)})`);
      await noNotes('Skittering Cicada');
      await reset(A); await A.evaluate(() => { S.bf.filter(c => cname(c) === 'Skittering Cicada').forEach(c => moveCard(c.id, 'lib', {quiet:true})); commit(); });
      await put(A, 'Grizzly Bears'); await A.evaluate(() => { const g = S.bf.find(c => cname(c) === 'Grizzly Bears'); g.cp = 4; commit(); });
      await toHand(A, 'Level Up'); await A.evaluate(() => { window.__tgt = 'Grizzly'; }); await cast(A, 'Level Up', {G:9, C:9}); await after();
      const h0 = await A.evaluate(() => S.hand.length); await combat('Grizzly Bears'); await after();
      const lv = await A.evaluate(() => { const g = S.bf.find(c => cname(c) === 'Grizzly Bears'); return {cp:g && g.cp, hand:S.hand.length}; });
      check(lv.cp === 10 && lv.hand === h0 + 1, `Level Up: counters doubled to 10, power 12 → drew a card (${JSON.stringify(lv)}, hand was ${h0})`);
      await noNotes('Level Up'); await A.evaluate(() => { setPhase(3); commit(); }); await clear(A); await clear(B);
    });

    await step('#15 Dovin, Hand of Control −1: damage to and by Kim\'s creature is prevented until Georges\'s next turn', async () => {
      await myTurn(); await reset(A); await reset(B); await put(A, 'Dovin, Hand of Control'); await put(B, 'Llanowar Elves'); await put(A, 'Grizzly Bears'); await A.evaluate(() => { const g = S.bf.find(c => cname(c) === 'Grizzly Bears'); g.cp = 0; g.dmg = 0; commit(); }); await sleep(1000);
      await A.evaluate(() => { window.__tgt = 'Llanowar'; const d = S.bf.find(c => cname(c) === 'Dovin, Hand of Control'); activateLoyalty(d, 0); }); await after(); await sleep(800);
      await toHand(A, 'Lightning Bolt'); await A.evaluate(() => { window.__tgt = 'Llanowar'; }); await cast(A, 'Lightning Bolt', {R:1}); await after();
      check(await count(B, 'Llanowar Elves') === 1 && await B.evaluate(() => (S.bf.find(c => cname(c) === 'Llanowar Elves').dmg || 0) === 0), 'Lightning Bolt\'s damage to the Elves is prevented');
      const r = await B.evaluate(async () => { const a = S.bf.find(c => cname(c) === 'Llanowar Elves'); const pid = [...OPP.keys()][0]; const g = (OPP.get(pid).bf || []).find(c => cname(c) === 'Grizzly Bears');
        dealDamage({t:'card', pid, id:g.id, k:g.k}, 1, a.k, a); dealDamage({t:'player', pid}, 1, a.k, a); return true; }); await after();
      check(await count(A, 'Grizzly Bears') === 1 && await A.evaluate(() => S.life) === 40, `damage dealt by the Elves is prevented (Bears alive, Georges at ${await A.evaluate(() => S.life)})`);
      await noNotes('Dovin'); await clear(A); await clear(B); void r;
    });

    await step('#15 Noggle the Mind: the creature is a colorless 1/1 Noggle with no abilities', async () => {
      await reset(A); await reset(B); await put(B, 'Birds of Paradise'); await sleep(800);
      await toHand(A, 'Noggle the Mind'); await A.evaluate(() => { window.__tgt = 'Birds'; }); await cast(A, 'Noggle the Mind', {U:9, C:9}); await after(); await sleep(800);
      const r = await B.evaluate(() => { const a = S.bf.find(c => cname(c) === 'Birds of Paradise'); return {st:stats(a), fly:kwOf(a, 'flying'), t:typeOf(a)}; });
      check(r.st && r.st[0] === 1 && r.st[1] === 1 && !r.fly && /Noggle/.test(r.t), `Kim's Birds of Paradise is a 1/1 Noggle without flying (${JSON.stringify(r)})`);
      const ck = await A.evaluate(async () => (await checkCard([...DICT.values()].find(x => x.n === 'Noggle the Mind').k)).issues);
      check(!ck.length, `the checker understands Noggle the Mind (${JSON.stringify(ck)})`);
      await clear(A); await clear(B);
    });

    await step('#6 Summons of Saruman: cast an instant or sorcery with MV ≤ X from among the milled cards', async () => {
      await myTurn(); await reset(A); await A.evaluate(() => { const c = S.lib.find(x => cname(x) === 'Divination'); S.lib.splice(S.lib.indexOf(c), 1); S.lib.unshift(c); commit(); });
      await toHand(A, 'Summons of Saruman'); await A.evaluate(() => { window.__X = 3; window.__pick = 1; }); const h0 = await A.evaluate(() => S.hand.length);
      await cast(A, 'Summons of Saruman', {U:9, R:9, C:9}); await after(); await after();
      const r = await A.evaluate(() => ({log:S.log.slice(-25).map(e => e.s).filter(s => /Divination/.test(s)), hand:S.hand.length, orc:S.bf.some(c => /Orc Army/.test(cname(c)))}));
      check(r.log.some(s => /cast Divination/.test(s)) && r.hand === h0 - 1 + 2, `milled Divination was cast for free and drew 2 (${JSON.stringify(r)}, hand ${h0})`);
      await noNotes('Summons of Saruman'); await clear(A);
    });

    await step('#6 Gift an extra turn (Perch Protection): Kim takes the next turn, then play goes on', async () => {
      await myTurn(); await reset(A); await reset(B); await toHand(A, 'Perch Protection'); await A.evaluate(() => { window.__want = '^Promise'; }); await cast(A, 'Perch Protection', {W:9, U:9, C:9}); await after();
      const n0 = await A.evaluate(() => currentTurn()[0]);
      await A.evaluate(() => passTurn()); await sleep(2500); await settle([A, B]);
      const t1 = await A.evaluate(() => [currentTurn()[0], nameOf(currentTurn()[1])]);
      check(t1[0] === n0 + 1 && t1[1] === 'Kim', `after Georges's turn: Kim's extra turn (${t1})`);
      await B.evaluate(() => passTurn()); await sleep(2500); await settle([A, B]);
      const t2 = await A.evaluate(() => [currentTurn()[0], nameOf(currentTurn()[1])]);
      check(t2[0] === n0 + 2 && t2[1] === 'Kim', `then Kim's normal turn (the turn after Georges's) (${t2})`);
      await B.evaluate(() => passTurn()); await sleep(2500);
      const t3 = await A.evaluate(() => [currentTurn()[0], nameOf(currentTurn()[1])]);
      check(t3[0] === n0 + 3 && t3[1] === 'Georges', `then Georges again (${t3})`);
      await noNotes('Perch Protection');
      check(await A.evaluate(() => !S.tpLock && !(S.poz || []).length && S.bf.some(c => c.tok && /Bird/.test(typeOf(c)))), 'Georges\'s permanents phased back in at his next turn');
    });
  } catch (e){ console.log('FATAL', e); check(false, 'test ran'); }
  console.log(`\n${H.results.filter(r => r.startsWith('PASS')).length} passed, ${H.fails()} failed`);
  await browser.close(); server.close(); process.exit(H.fails() ? 1 : 0);
})();
