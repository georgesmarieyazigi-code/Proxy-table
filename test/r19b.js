// Round 19 helper M: timing and choice order (GAPS19 section M) in real 2- and 3-player games.
// PTPORT=19400 PTFILE=dev19M.html node r19b.js   (ONLY=<substring> runs matching steps)
process.env.TOP = '1';
const CC = require('./cards');
const WANT = ['Balor', 'Guff Rewrites History', 'Kitesail Larcenist', "Agadeem's Awakening", 'Joshua, Phoenix\'s Dominant', 'The Rise of Sozin', "Vona's Hunger", 'Into the Flood Maw', "Dawn's Truce",
  'Share the Spoils', 'Osteomancer Adept', 'Into the Pit', 'Dawnhand Dissident', 'Senu, Keen-Eyed Protector', "Illusionist's Gambit", 'Sokrates, Athenian Teacher', "Smuggler's Copter", 'Hangarback Walker', 'Endless One',
  'Gnarlid Colony', 'Llanowar Elves', 'Memnite', 'Ornithopter', 'Sol Ring', 'Lightning Bolt', 'Shock', 'Dismantling Wave', 'Grasp of Fate', 'Collective Effort', 'Collective Resistance', 'Caustic Bronco', 'Bulwark Ox',
  'Torbran, Thane of Red Fell', 'Fiendish Duo', 'Long River Lurker', 'Ravenous Chupacabra', 'Rhystic Study', 'Calamity, Galloping Inferno', 'Young Pyromancer', 'The Rise of Sozin', 'Deadly Dispute', 'Divination', 'Duress', 'Thrill of Possibility', 'Island', 'Swamp', 'Mountain', 'Forest', 'Plains', 'Stoneforge Mystic', 'Gilded Goose'];
CC.cards.push(...CC.topCards('all.json').filter(c => (WANT.includes(c.name) || WANT.some(w => c.name.startsWith(w + ' //'))) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, waitFor} = H;
// auto-answer: window.__want (regex for choice labels), window.__pick (regex for card names), window.__num (number for askNumber)
const AUTO = () => { window.__seen = []; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want) : null;
  try {
    window.__seen.push(String(m.title || '')); if (window.__seen.length > 200) window.__seen.shift();
    if (window.__manual) return;
    if (m.type === 'pick' && m.resolve){ const P = window.__pick ? new RegExp(window.__pick) : null; const pref = P ? (m.cards || []).filter(c => P.test(cname(c))) : [];
      const n = pref.length ? Math.min(pref.length, m.max || 1) : Math.max(m.min || 0, 0); const ids = (pref.length ? pref : (m.cards || [])).slice(0, Math.max(n, m.min || 0)).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (w && (m.options || []).find(x => !x.disabled && w.test(x.label))) || (m.options || []).find(x => !x.disabled); m.__done = 1; m.resolve(o ? o.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ const i = (m.cands || []).findIndex(c => c.ok && c.pid !== MYPID); m.__done = 1; m.resolve(i >= 0 ? [m.cands[i]] : []); closeModal(); }
    else if (m.type === 'ask' && m.run){ m.__done = 1; m.run(window.__num != null ? window.__num : (m.def ?? 1)); closeModal(); }
    else if (m.run){ m.__done = 1; m.run(m.def ?? 1); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
let ALL = []; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { await T(150000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 || process.env.LOGS) for (const [nm, p] of ALL) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-16).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})).catch(e => e.message))); };
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting || UI.modal)); if (!busy) return; await sleep(150); } };
const toMain = async (p, ps) => { for (let i = 0; i < 50; i++){ if (await p.evaluate(() => phaseNow().mine && phaseNow().ph === 3)) return true; await p.evaluate(() => { if (!stackAll().length && !UI.modal && phaseNow().mine) nextAction(); }); await passAll(ps); } return false; };
const putBf = (p, nm, extra) => p.evaluate(([nm, extra]) => { const a = [...DICT.values()].find(a => a.n === nm || (a.n || '').startsWith(nm + ' //')); const c = {id:S.nid++, k:a.k, x:20 + (S.nid % 30) * 3, y:30, sk:false, ...(extra || {})}; S.bf.push(c); commit(); return c.id; }, [nm, extra]);
const toZone = (p, nm, z) => p.evaluate(([nm, z]) => { const a = [...DICT.values()].find(a => a.n === nm || (a.n || '').startsWith(nm + ' //')); const c = {id:S.nid++, k:a.k}; if (z === 'lib') S.lib.unshift(c); else S[z].push(c); commit(); return c.id; }, [nm, z]);
const toHand = (p, nm) => toZone(p, nm, 'hand');
const cast = (p, nm, pool) => p.evaluate(([nm, pool]) => { S.pool = {...emptyPool(), ...(pool || {})}; const c = S.hand.find(x => cname(x) === nm || cname(x).startsWith(nm)); beginCast(c, 'hand'); }, [nm, pool]);
const clean = async (ps) => { for (const p of ps) await p.evaluate(() => { S.bf = S.bf.filter(c => isLand(c.k) && !c.tok); S.hand = []; S.gy = []; S.ex = []; S.stk = []; S.pool = emptyPool(); window.__want = null; window.__pick = null; window.__num = null; window.__manual = 0; commit(); }); await sleep(600); };
const seen = (p, re) => p.evaluate(re => window.__seen.filter(t => new RegExp(re).test(t)), re);
const logs = (p, n = 30) => p.evaluate(n => S.log.slice(-n).map(e => e.s), n);

(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r19b2');
    const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r19b2');
    ALL = [['Georges', A], ['Kim', B]]; const P2 = [A, B];
    await waitFor(A, () => OPP.size === 1, null, 20000); await A.evaluate(AUTO); await B.evaluate(AUTO);
    await A.click('[data-act="goFirst"]'); await settle(P2); await toMain(A, P2);
    const KIM = await A.evaluate(() => [...OPP.keys()][0]); const GEO = await A.evaluate(() => MYPID);


    const kimSees = (re, ms = 10000) => waitFor(B, re => stackAll().some(i => new RegExp(re).test(i.nm + ' → ' + (i.tgtNm || ''))), re, ms);
    const hc = p => p.evaluate(() => S.hand.length);

    await step('#1a Balor: the mode and its opponent are chosen as the trigger goes on the stack', async () => {
      await toHand(B, 'Memnite'); await toHand(B, 'Ornithopter'); await sleep(600); const h = await hc(B); const k0 = await B.evaluate(() => S.life);
      const bid = await putBf(A, 'Balor'); await A.evaluate(() => { window.__want = 'deals damage'; window.__seen = []; });
      await A.evaluate(id => { destroyCard(S.bf.find(x => x.id === id)); commit(); }, bid);
      check(await kimSees('^Balor → Kim: damage'), 'Kim sees Balor\'s dies trigger on the stack already targeting her with the damage mode');
      check(await A.evaluate(() => S.stk.some(i => i.nm === 'Balor' && !i.hold && Array.isArray(i.m19balor))), 'the trigger is waiting for priority with its choices stored');
      await settle(P2); await sleep(1500);
      const k1 = await B.evaluate(() => S.life);
      check(k1 === k0 - h, `Balor dealt damage equal to Kim's hand size (${h}): ${k0} → ${k1}`);
      check((await seen(A, 'Balor')).length >= 1 && !(await logs(A, 12)).some(l => /choose one or more modes/.test(l)), 'no further prompt while it resolved');
      await clean(P2);
    });

    await step('#1b Kitesail Larcenist: targets on the trigger; ward of a target is paid then (or the trigger is countered)', async () => {
      await putBf(B, 'Sol Ring'); const lur = await putBf(B, 'Long River Lurker'); await sleep(700);
      // 1: refuse to pay ward → the trigger is countered
      await A.evaluate(() => { window.__pick = 'Long River Lurker'; window.__want = "Don't pay"; S.pool = {...emptyPool(), U:1}; });
      let id = await toHand(A, 'Kitesail Larcenist'); await A.evaluate(id => { moveCard(id, 'bf'); commit(); }, id); await sleep(2500);
      check(await A.evaluate(() => !S.stk.some(i => i.nm === 'Kitesail Larcenist')) && (await logs(A, 6)).some(l => /countered by ward/.test(l)), 'not paying ward {1} counters the trigger as it is put on the stack');
      await settle(P2); check(!(await B.evaluate(id => /Treasure/.test(typeOf(S.bf.find(c => c.id === id))), lur)), 'the Lurker stays a creature');
      await A.evaluate(() => { S.bf = S.bf.filter(c => cname(c) !== 'Kitesail Larcenist'); window.__want = 'Pay'; S.pool = {...emptyPool(), U:1}; commit(); });
      // 2: pay ward
      id = await toHand(A, 'Kitesail Larcenist'); await A.evaluate(id => { moveCard(id, 'bf'); commit(); }, id);
      check(await kimSees('^Kitesail Larcenist → .*Long River Lurker'), 'Kim sees the trigger targeting her Long River Lurker before it resolves');
      check(await waitFor(A, () => S.log.slice(-8).some(e => /paid ward \{1\}/.test(e.s)) && S.stk.some(i => i.nm === 'Kitesail Larcenist'), null, 6000), 'ward {1} was paid when the target was chosen, while the trigger waits on the stack');
      await settle(P2); await sleep(1200);
      check(await B.evaluate(id => /Treasure/.test(typeOf(S.bf.find(c => c.id === id))), lur), 'Long River Lurker became a Treasure on Kim\'s client');
      await clean(P2);
    });

    await step('#1c Guff Rewrites History: one target per player, chosen while casting', async () => {
      await putBf(A, 'Memnite'); await putBf(B, 'Sol Ring'); await sleep(700);
      await A.evaluate(() => { window.__want = "Don't"; }); await B.evaluate(() => { window.__want = "Don't"; });
      await toHand(A, 'Guff Rewrites History'); await cast(A, 'Guff Rewrites History', {R:3});
      check(await kimSees("^Guff Rewrites History → .*Memnite.*Sol Ring|^Guff Rewrites History → .*Sol Ring.*Memnite"), 'Kim sees Guff on the stack targeting Memnite and her Sol Ring');
      await settle(P2); await sleep(2500);
      check(!(await B.evaluate(() => S.bf.some(c => cname(c) === 'Sol Ring'))) && !(await A.evaluate(() => S.bf.some(c => cname(c) === 'Memnite'))), 'both targets were shuffled away on resolution');
      await clean(P2);
    });

    await step("#1d Agadeem's Awakening: X first, then the target cards, all while casting", async () => {
      for (const n of ['Memnite', 'Ornithopter', 'Llanowar Elves']) await toZone(A, n, 'gy');
      await A.evaluate(() => { window.__num = 1; window.__pick = 'Memnite|Llanowar|Ornithopter'; window.__seen = []; });
      await toHand(A, "Agadeem's Awakening"); await cast(A, "Agadeem's Awakening", {B:4});
      check(await kimSees("^Agadeem's Awakening → (?=.*Memnite)(?=.*Llanowar Elves)"), 'Kim sees the spell targeting Memnite and Llanowar Elves (different mana values) before it resolves');
      const sx = await seen(A, '^Choose X'); check(sx.length === 1, `X was asked once (${sx.length})`);
      await settle(P2); await sleep(1000);
      const r = await A.evaluate(() => ({bf:S.bf.map(cname), gy:S.gy.map(cname)}));
      check(r.bf.includes('Memnite') && r.bf.includes('Llanowar Elves') && r.gy.includes('Ornithopter'), `returned the two chosen cards (${JSON.stringify(r)})`);
      await clean(P2);
    });

    await step('#1e Phoenix, Warden of Fire III: target cards chosen as the chapter triggers', async () => {
      for (const n of ['Memnite', 'Llanowar Elves']) await toZone(A, n, 'gy');
      const ph = await putBf(A, "Joshua, Phoenix's Dominant", {fl:true, lore:2}); await A.evaluate(() => { window.__pick = 'Memnite|Llanowar'; });
      await A.evaluate(id => { const c = S.bf.find(x => x.id === id); c.lore = 3; sagaReached(c, 2, 3); commit(); }, ph);
      check(await kimSees('chapter III.* → (?=.*Memnite)(?=.*Llanowar)'), 'Kim sees chapter III targeting Memnite and Llanowar Elves');
      await settle(P2); await sleep(1000);
      check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Memnite') && S.bf.some(c => cname(c) === 'Llanowar Elves')), 'both returned to the battlefield');
      await clean(P2);
    });

    await step('#1f Fire Lord Sozin: paying {X} puts a reflexive trigger with its targets on the stack', async () => {
      for (const n of ['Memnite', 'Llanowar Elves']) await toZone(B, n, 'gy'); await sleep(800);
      const fs = await putBf(A, 'The Rise of Sozin', {fl:true}); await A.evaluate(() => { window.__want = 'Pay \\{2\\}'; window.__pick = 'Memnite|Llanowar'; S.pool = {...emptyPool(), B:2}; });
      await A.evaluate(([id, k]) => { const c = S.bf.find(x => x.id === id); emit({type:'cdmg', k:c.k, id:c.id, dp:k, cnt:1, amt:5}); commit(); }, [fs, KIM]);
      for (let i = 0; i < 40 && !(await A.evaluate(() => S.stk.some(i => i.m19soz))); i++){ await B.evaluate(() => { if (myBox() && !stackAll().some(i => i.tgtNm && /Memnite/.test(i.tgtNm))) doPass(); }); await sleep(250); }
      check(await kimSees('Fire Lord Sozin → (?=.*Memnite)(?=.*Llanowar)', 15000), 'after {X} is paid, a separate trigger targeting the two cards in Kim\'s graveyard is on the stack');
      await settle(P2); await sleep(1500);
      check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Memnite') && S.bf.some(c => cname(c) === 'Llanowar Elves')), 'Georges gets both creatures');
      check(await B.evaluate(() => !S.gy.some(c => /Memnite|Llanowar/.test(cname(c)))), 'they left Kim\'s graveyard');
      await clean(P2);
    });

    await step('#1g "For each opponent, … up to one target …": chosen while casting / triggering, resolution asks nothing', async () => {
      await putBf(B, 'Sol Ring'); await sleep(700); await A.evaluate(() => { window.__seen = []; });
      await toHand(A, 'Dismantling Wave'); await cast(A, 'Dismantling Wave', {W:3});
      check(await kimSees("^Dismantling Wave → Kim's Sol Ring"), 'Kim sees Dismantling Wave targeting her Sol Ring');
      const n0 = (await seen(A, '.')).length; await settle(P2); await sleep(1000);
      check(!(await B.evaluate(() => S.bf.some(c => cname(c) === 'Sol Ring'))), 'Sol Ring destroyed');
      const nw = (await seen(A, '.')).slice(n0); check(!nw.length, `no prompt while it resolved (${nw})`);
      await putBf(B, 'Memnite'); await sleep(600);
      const gid = await toHand(A, 'Grasp of Fate'); await A.evaluate(id => { moveCard(id, 'bf'); commit(); }, gid);
      check(await kimSees("^Grasp of Fate → Kim's Memnite"), 'Grasp of Fate\'s trigger shows its target to Kim');
      const n1 = (await seen(A, '.')).length; await settle(P2); await sleep(1500);
      check(await B.evaluate(() => S.ex.some(c => cname(c) === 'Memnite') && !S.bf.some(c => cname(c) === 'Memnite')), 'Memnite exiled until Grasp leaves');
      check((await seen(A, '.')).length === n1, 'no prompt while it resolved');
      await clean(P2);
    });

    await step('#1h any other targeted trigger: target chosen as it goes on the stack (Ravenous Chupacabra)', async () => {
      await putBf(B, 'Memnite'); await sleep(600);
      const id = await toHand(A, 'Ravenous Chupacabra'); await A.evaluate(id => { moveCard(id, 'bf'); commit(); }, id);
      check(await kimSees("^Ravenous Chupacabra → Kim's Memnite"), 'Kim sees the trigger targeting her Memnite before it resolves');
      await settle(P2); await sleep(800);
      check(await B.evaluate(() => !S.bf.some(c => cname(c) === 'Memnite') && S.gy.some(c => cname(c) === 'Memnite')), 'Memnite destroyed');
      await clean(P2);
    });

    await step('#4 Into the Flood Maw: only the targets of the chosen branch', async () => {
      await putBf(B, 'Memnite'); await putBf(B, 'Sol Ring'); await sleep(700);
      await A.evaluate(() => { window.__want = 'No gift'; window.__seen = []; });
      await toHand(A, 'Into the Flood Maw'); await cast(A, 'Into the Flood Maw', {U:1}); await sleep(1200);
      let t = await seen(A, 'choose target'); check(t.length === 1 && /creature an opponent controls/.test(t[0]), `no gift: one target prompt, a creature (${t})`);
      await settle(P2); await sleep(1000);
      check(await B.evaluate(() => S.hand.some(c => cname(c) === 'Memnite') && S.bf.some(c => cname(c) === 'Sol Ring')), 'Memnite returned, Sol Ring stays');
      await B.evaluate(() => { S.hand = []; S.bf = S.bf.filter(c => isLand(c.k) || cname(c) === 'Sol Ring'); commit(); }); await sleep(600);
      await A.evaluate(() => { window.__want = 'Promise'; window.__seen = []; });
      await toHand(A, 'Into the Flood Maw'); await cast(A, 'Into the Flood Maw', {U:1}); await sleep(1200);
      t = await seen(A, 'choose target'); check(t.length === 1 && /nonland permanent/.test(t[0]), `gift promised: one target prompt, a nonland permanent (${t})`);
      check(await kimSees('^Into the Flood Maw → .*Sol Ring.*gift → Kim'), 'Kim sees the target and that the gift goes to her');
      await settle(P2); await sleep(1500);
      const k = await B.evaluate(() => ({hand:S.hand.map(cname), bf:S.bf.filter(c => !isLand(c.k)).map(cname)}));
      check(k.hand.includes('Sol Ring') && k.bf.includes('Fish'), `Kim got the Fish first and Sol Ring returned (${JSON.stringify(k)})`);
      await clean(P2);
    });

    await step('#3 Escalate: the creature is tapped while casting', async () => {
      await putBf(A, 'Memnite'); await putBf(A, 'Ornithopter'); await putBf(B, 'Rhystic Study'); await putBf(B, 'Llanowar Elves'); await sleep(700);
      await A.evaluate(() => { window.__want = 'enchantment|Put a|That’s all'; window.__pick = 'Memnite'; });
      await toHand(A, 'Collective Effort'); await cast(A, 'Collective Effort', {W:3});
      check(await kimSees('^Collective Effort'), 'Collective Effort is on the stack');
      const r = await A.evaluate(() => ({tap:S.bf.filter(c => c.tap && !isLand(c.k)).map(cname), stk:S.stk.length}));
      check(r.stk === 1 && r.tap.length === 1 && r.tap[0] === 'Memnite', `Memnite was tapped as the cost, before anyone could respond (${JSON.stringify(r)})`);
      await settle(P2); await sleep(1500);
      check(await A.evaluate(() => S.bf.filter(c => c.tap && !isLand(c.k)).length === 1), 'no second creature was tapped later');
      check(!(await B.evaluate(() => S.bf.some(c => cname(c) === 'Rhystic Study'))), 'both modes resolved (Rhystic Study destroyed)');
      await clean(P2);
    });

    await step('#7 a spell whose additional cost fails leaves no cast triggers behind', async () => {
      await putBf(A, 'Young Pyromancer'); await putBf(A, 'Sol Ring'); await putBf(B, 'Rhystic Study'); await sleep(800);
      const c0 = await A.evaluate(() => (S.casts || []).length); const kl0 = (await logs(B, 40)).filter(l => /Rhystic/.test(l)).length;
      await A.evaluate(() => { window.__pick = 'Sol Ring'; const pa = n24payAdds; n24payAdds = async function(parts, c, pre){ n24payAdds = pa; return {sac:[], n:0, fail:'the cost could not be paid'}; }; });
      await toHand(A, 'Deadly Dispute'); await A.evaluate(async () => { S.pool = {...emptyPool(), B:2}; await beginCast(S.hand.find(c => cname(c) === 'Deadly Dispute'), 'hand'); }); await sleep(2500);
      const r = await A.evaluate(() => ({stk:S.stk.map(i => i.nm), tok:S.bf.filter(c => c.tok).length, casts:(S.casts || []).length, hand:S.hand.some(c => cname(c) === 'Deadly Dispute')}));
      check(r.hand && !r.stk.length && r.tok === 0, `not cast: back in hand, no Young Pyromancer trigger or token (${JSON.stringify(r)})`);
      check(r.casts === c0, 'the cast count did not change');
      check(await B.evaluate(() => !stackAll().some(i => /Rhystic/.test(i.nm))) && (await logs(B, 40)).filter(l => /Rhystic/.test(l)).length === kl0, 'Kim\'s Rhystic Study did not trigger');
      // control: a normal cast does trigger both
      await putBf(A, 'Sol Ring'); await A.evaluate(async () => { S.pool = {...emptyPool(), B:2}; await beginCast(S.hand.find(c => cname(c) === 'Deadly Dispute'), 'hand'); }); await sleep(1500);
      check(await A.evaluate(() => S.stk.some(i => i.nm === 'Young Pyromancer')) && await waitFor(B, () => stackAll().some(i => /Rhystic/.test(i.nm)) || S.log.slice(-10).some(e => /Rhystic/.test(e.s)), null, 6000), 'a paid cast triggers Young Pyromancer and Rhystic Study');
      await B.evaluate(() => { window.__want = "Don't|No"; }); await A.evaluate(() => { window.__want = 'Pay|Don'; }); await settle(P2); await sleep(1500);
      await clean(P2);
    });

    await step('#8 extra-cost routes still ask for X (Osteomancer Adept forage, Into the Pit)', async () => {
      await putBf(A, 'Osteomancer Adept'); for (const n of ['Hangarback Walker', 'Memnite', 'Ornithopter', 'Sol Ring']) await toZone(A, n, 'gy');
      await A.evaluate(() => { window.__num = 2; window.__seen = []; window.__want = 'Exile three'; window.__pick = 'Memnite|Ornithopter|Sol Ring'; S.c27osteo = turnStr(); S.pool = {...emptyPool(), C:4}; const c = S.gy.find(x => cname(x) === 'Hangarback Walker'); const g = gyOptions(c).find(o => o.kind === 'c27osteo'); beginCast(c, 'gy', {gy:g}); });
      await sleep(1500); await settle(P2); await sleep(800);
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Hangarback Walker'); return c ? {cp:c.cp || 0, fin:(c.nc || {}).finality || 0} : null; });
      check((await seen(A, '^Choose X')).length === 1 && r && r.cp === 2 && r.fin === 1, `X asked; Hangarback Walker entered with 2 +1/+1 counters and a finality counter (${JSON.stringify(r)})`);
      await clean(P2);
      await putBf(A, 'Into the Pit'); await putBf(A, 'Memnite'); await toZone(A, 'Gnarlid Colony', 'lib'); await sleep(500);
      await A.evaluate(() => { window.__seen = []; window.__want = 'Pay it'; window.__pick = 'Memnite'; S.pool = {...emptyPool(), G:5}; c27PitCast(); }); await sleep(2000); await settle(P2);
      const g = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Gnarlid Colony'); return c ? c.cp || 0 : -1; });
      check((await seen(A, 'Kicker')).length === 1 && g === 2, `Into the Pit: kicker asked and paid — Gnarlid Colony has 2 counters (${g})`);
      await clean(P2);
    });

    await step('#6 saddle goes on the stack', async () => {
      const br = await putBf(A, 'Caustic Bronco'); await putBf(A, 'Memnite'); await putBf(A, 'Llanowar Elves'); await putBf(A, 'Gilded Goose'); await putBf(A, 'Ornithopter');
      await A.evaluate(() => { window.__pick = 'Memnite|Llanowar|Gilded|Ornithopter'; }); await sleep(500);
      const pw = await A.evaluate(() => S.bf.filter(c => /Memnite|Llanowar|Gilded|Ornithopter/.test(cname(c))).reduce((a, c) => a + stats(c)[0], 0));
      if (pw < 3) await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Memnite'); c.pu = [3, 0]; commit(); });
      await A.evaluate(id => { const c = S.bf.find(x => x.id === id); const ab = abilityList(c).find(a => a.saddle); activateAbility(c, ab); }, br);
      check(await kimSees("^Caustic Bronco"), 'Kim sees the saddle ability on the stack');
      check(await A.evaluate(id => { const c = S.bf.find(x => x.id === id); return c.saddled !== turnStr() && S.bf.filter(x => x.tap && !isLand(x.k)).length >= 1; }, br), 'the creatures are tapped (cost) but the Bronco is not saddled yet');
      await settle(P2); await sleep(600);
      check(await A.evaluate(id => S.bf.find(x => x.id === id).saddled === turnStr(), br), 'saddled once the ability resolved');
      await clean(P2);
      // Calamity: the creature that saddled it is remembered through the stack
      const cal = await putBf(A, 'Calamity, Galloping Inferno'); await putBf(A, 'Memnite', {pu:[1, 0]}); await A.evaluate(() => { window.__pick = 'Memnite'; window.__want = 'Memnite'; }); await sleep(400);
      await A.evaluate(id => { const c = S.bf.find(x => x.id === id); activateAbility(c, abilityList(c).find(a => a.saddle)); }, cal); await sleep(800); await settle(P2);
      await A.evaluate(([id, k]) => { const c = S.bf.find(x => x.id === id); c.sk = false; c.atk = 'p:' + k; c.tap = true; emit({type:'attack', k:c.k, id:c.id, dp:k}); commit(); }, [cal, KIM]); await sleep(800); await settle(P2); await sleep(800);
      const tk = await A.evaluate(() => S.bf.filter(x => x.tok && cname(x) === 'Memnite').length);
      check(tk === 2, `Calamity attacked while saddled: two Memnite token copies (${tk})`);
      await A.evaluate(() => { S.dly = []; S.bf.forEach(c => { c.atk = ''; }); commit(); }); await clean(P2);
    });

    await step('#11 Sokrates + Torbran: the damaged player chooses the order', async () => {
      const yp = await putBf(A, 'Young Pyromancer'); await A.evaluate(id => { S.bf.find(x => x.id === id).b27sok = turnStr(); commit(); }, yp);
      const go = async () => { const h0 = [await hc(A), await hc(B)]; const l0 = await B.evaluate(() => S.life);
        await A.evaluate(([id, k]) => { hitDefender({t:'player', pid:k}, 2, S.bf.find(x => x.id === id), {}); commit(); }, [yp, KIM]); await sleep(4000);
        return {da:(await hc(A)) - h0[0], db:(await hc(B)) - h0[1], dl:(await B.evaluate(() => S.life)) - l0}; };
      await B.evaluate(() => { window.__seen = []; });
      let r = await go(); check(r.da === 1 && r.db === 1 && r.dl === 0 && !(await seen(B, 'Sokratic')).length, `no increase: 2 prevented, each draws 1, no question (${JSON.stringify(r)})`);
      await putBf(A, 'Torbran, Thane of Red Fell'); await B.evaluate(() => { window.__want = '^Yes'; }); await sleep(400);
      r = await go(); check((await seen(B, 'Sokratic|increase')).length >= 1, 'Kim (the damaged player) was asked which applies first');
      check(r.da === 2 && r.db === 2 && r.dl === 0, `Kim chose the increase first: 4 prevented, each draws 2 (${JSON.stringify(r)})`);
      await B.evaluate(() => { window.__want = '^No'; }); r = await go();
      check(r.da === 1 && r.db === 1 && r.dl === 0, `Kim chose the prevention first: each draws 1 (${JSON.stringify(r)})`);
      await clean(P2); await B.evaluate(() => { S.hand = []; commit(); }); await A.evaluate(() => { S.hand = []; commit(); });
    });

    await step("#10 Illusionist's Gambit restricts only the additional combat", async () => {
      // it's Kim's turn, in her first combat; Georges's Gambit reaches her client
      await A.evaluate(() => passTurn()); await sleep(2000); await toMain(B, P2);
      const m = await putBf(B, 'Memnite');
      await B.evaluate(() => { startCombat(); commit(); }); await sleep(300);
      await B.evaluate(id => { S.bf.find(x => x.id === id).atk = 'p:' + [...OPP.keys()][0]; S.bf.find(x => x.id === id).tap = true; commit(); }, m);
      await A.evaluate(k => { sendRq(k, 'a27gambit', 0, "Illusionist's Gambit", {d:MYPID}); commit(); }, KIM); await sleep(2000);
      let r = await B.evaluate(id => { const c = S.bf.find(x => x.id === id); return {atk:c.atk, tap:c.tap, must:p24MustAtk(c), can:canAttack(c), xc:S.xc}; }, m);
      check(!r.atk && !r.tap && r.xc >= 1, `removed from combat, untapped, an additional combat follows (${JSON.stringify(r)})`);
      check(!r.must && !/Gambit/.test(r.can), `still in the first combat: no Gambit requirement yet (${JSON.stringify(r)})`);
      await B.evaluate(() => { startCombat(); commit(); });
      r = await B.evaluate(id => { const c = S.bf.find(x => x.id === id); return {n:S.cb.n, must:p24MustAtk(c), can:canAttack(c)}; }, m);
      check(r.n === 2 && /Gambit/.test(r.must) && /Gambit/.test(r.can), `additional combat: must attack if able, can't attack Georges (${JSON.stringify(r)})`);
      await B.evaluate(() => { startCombat(); commit(); });
      r = await B.evaluate(id => { const c = S.bf.find(x => x.id === id); return {n:S.cb.n, must:p24MustAtk(c), can:canAttack(c)}; }, m);
      check(r.n === 3 && !/Gambit/.test(r.must) && !/Gambit/.test(r.can), `a later combat: no restriction (${JSON.stringify(r)})`);
      await B.evaluate(() => { S.cb = null; S.xc = 0; commit(); });
      await clean(P2); await B.evaluate(() => passTurn()); await sleep(2000); await toMain(A, P2);
    });

    await step('#5 Share the Spoils: "when they do" is a trigger on the stack', async () => {
      await toZone(A, 'Memnite', 'lib'); await toZone(B, 'Ornithopter', 'lib'); await toZone(B, 'Memnite', 'lib'); await sleep(600);
      const id = await toHand(A, 'Share the Spoils'); await A.evaluate(id => { moveCard(id, 'bf'); commit(); }, id); await sleep(1200); await settle(P2); await sleep(1500);
      check(await B.evaluate(() => S.ex.some(c => cname(c) === 'Memnite' && c.b27sts)), 'Kim\'s top card (Memnite) was exiled with Share the Spoils');
      await A.evaluate(() => passTurn()); await sleep(2000); await toMain(B, P2);
      await B.evaluate(() => { const c = S.ex.find(x => cname(x) === 'Memnite' && x.b27sts); beginCast(c, 'ex'); }); await sleep(1500);
      check(await waitFor(A, () => S.stk.some(i => i.m19sts), null, 8000), 'Georges (Share the Spoils\' controller) has the "when they do" trigger on his stack');
      check(await kimSees('^Share the Spoils → Kim'), 'Kim sees it, targeting her library');
      check(await B.evaluate(() => !S.ex.some(c => cname(c) === 'Ornithopter')), 'her next card is not exiled before the trigger resolves');
      await settle(P2); await sleep(2000);
      check(await B.evaluate(() => S.ex.filter(c => c.b27sts).length >= 1 && S.log.slice(-6).some(e => /Share the Spoils: exiled .+ from the top of my library/.test(e.s))), 'once it resolved, Kim exiled her new top card with it');
      await clean(P2); await B.evaluate(() => passTurn()); await sleep(2000); await toMain(A, P2);
    });

    for (const p of P2) await p.context().close();

    /* ================= 3 players ================= */
    const names = ['Georges', 'Kim', 'Ana']; const P = [];
    for (let i = 0; i < 3; i++){ P.push(await H.player(browser, names[i], H.deckFor(['Edgar Markov', 'Thalia, Guardian of Thraben', 'Krenko, Mob Boss'][i]), i ? 'join' : 'host', 'r19b3')); await sleep(300); }
    for (const p of P) await waitFor(p, () => OPP.size === 2, null, 30000);
    ALL = names.map((n, i) => [n, P[i]]); const [G, K, N] = P; for (const p of P) await p.evaluate(AUTO);
    await G.click('[data-act="goFirst"]'); await settle(P); await toMain(G, P);
    const pid = {}; for (let i = 0; i < 3; i++) pid[names[i]] = await P[i].evaluate(() => MYPID);
    const sees = (p, re, ms = 10000) => waitFor(p, re => stackAll().some(i => new RegExp(re).test(i.nm + ' → ' + (i.tgtNm || ''))), re, ms);

    await step('#1a3 Balor with two opponents: two modes, each to a different opponent', async () => {
      await K.evaluate(() => { S.hand = []; commit(); }); await toHand(K, 'Memnite'); await toHand(K, 'Memnite'); await sleep(800);
      const k0 = await K.evaluate(() => S.life); const nh0 = await N.evaluate(() => S.hand.length + S.gy.length);
      await G.evaluate(k => { window.__want = 'deals damage|^Kim$'; }, 0);
      const bid = await putBf(G, 'Balor'); await G.evaluate(id => { destroyCard(S.bf.find(x => x.id === id)); commit(); }, bid);
      check(await sees(N, '^Balor → (?=.*Kim: damage)(?=.*Ana: draws 3)'), 'Ana sees Balor targeting Kim (damage) and Ana (draw 3, discard 3)');
      await settle(P); await sleep(2500);
      const k1 = await K.evaluate(() => S.life); const nh1 = await N.evaluate(() => S.hand.length + S.gy.length);
      check(k1 === k0 - 2, `Kim took 2 (her hand) (${k0} → ${k1})`); check(nh1 >= nh0 + 3, `Ana drew three and discarded three (${nh0} → ${nh1} cards in hand + graveyard)`);
      await clean(P);
    });

    await step('#2 the gift recipient is chosen while casting (Into the Flood Maw)', async () => {
      await putBf(K, 'Sol Ring'); await sleep(700);
      await G.evaluate(() => { window.__want = 'Promise|^Ana$'; window.__seen = []; });
      await toHand(G, 'Into the Flood Maw'); await cast(G, 'Into the Flood Maw', {U:1});
      check(await sees(K, '^Into the Flood Maw → .*gift → Ana'), 'Kim sees on the stack that the gift goes to Ana');
      const sq = await G.evaluate(() => window.__seen.slice()); check(sq.findIndex(t => /who gets the gift/.test(t)) >= 0 && sq.findIndex(t => /who gets the gift/.test(t)) < sq.findIndex(t => /choose target/.test(t)), `asked who gets the gift before the target (${sq.join(' / ')})`);
      await settle(P); await sleep(2000);
      check(await N.evaluate(() => S.bf.some(c => cname(c) === 'Fish')) && !(await K.evaluate(() => S.bf.some(c => cname(c) === 'Fish'))), 'Ana got the Fish');
      check(!(await G.evaluate(() => S.log.slice(-8).some(e => /who gets the gift/.test(e.s)))) && (await G.evaluate(() => window.__seen.filter(t => /who gets the gift/.test(t)).length)) === 1, 'nobody was asked again on resolution');
      await clean(P);
    });

    await step('#1c3 Guff with three players', async () => {
      await putBf(G, 'Memnite'); await putBf(K, 'Sol Ring'); await putBf(N, 'Ornithopter'); await sleep(800);
      for (const p of P) await p.evaluate(() => { window.__want = "Don't"; });
      await toHand(G, 'Guff Rewrites History'); await cast(G, 'Guff Rewrites History', {R:3});
      check(await sees(N, '^Guff Rewrites History → (?=.*Memnite)(?=.*Sol Ring)(?=.*Ornithopter)'), 'Ana sees all three targets on the stack');
      await settle(P); await sleep(3000);
      check(!(await N.evaluate(() => S.bf.some(c => cname(c) === 'Ornithopter'))) && !(await K.evaluate(() => S.bf.some(c => cname(c) === 'Sol Ring'))), 'all three were shuffled away');
      await clean(P);
    });

    await step('#9 Senu: its controller chooses which player it attacks', async () => {
      await G.evaluate(() => { setPhase(4); startCombat(); commit(); }); await sleep(500);
      await toZone(G, 'Senu, Keen-Eyed Protector', 'ex');
      const tor = await putBf(G, 'Torbran, Thane of Red Fell'); await G.evaluate(([id, k]) => { const c = S.bf.find(x => x.id === id); c.atk = 'p:' + k; c.tap = true; commit(); }, [tor, pid.Kim]);
      await G.evaluate(() => { window.__want = '^Ana'; window.__seen = []; });
      await G.evaluate(id => { const c = S.bf.find(x => x.id === id); emit({type:'b27unbl', k:c.k, id:c.id}); commit(); }, tor); await sleep(1000);
      await settle(P); await sleep(1000);
      const r = await G.evaluate(() => { const s = S.bf.find(c => cname(c) === 'Senu, Keen-Eyed Protector'); return s ? s.atk : null; });
      check(r === 'p:' + pid.Ana, `Senu entered attacking Ana, not Kim (${r})`);
      check((await seen(G, 'attack which player')).length === 1, 'Georges was asked');
      await G.evaluate(() => { S.bf.forEach(c => { c.atk = ''; }); S.cb = null; commit(); }); await clean(P);
    });
  } catch (e){ console.log('FATAL', e.message); check(false, 'test ran'); }
  console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`);
  await browser.close(); server.close(); process.exit(H.fails() ? 1 : 0);
})();
