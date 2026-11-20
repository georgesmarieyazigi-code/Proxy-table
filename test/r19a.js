// Round 19 helper L: taking opponents' permanents and cards — gain control (every duration), exchange control, donate,
// steal triggers (Treasure Nabber, Willbreaker), library/exile steals (Bribery, Praetor's Grasp, Hostage Taker), in real
// 2-player and 3-player games. Verifies BOTH clients: the permanent left the owner's board, is on the controller's board
// (and only there), can be used by the new controller, returns when the duration ends, and goes to its owner's
// graveyard / hand on death / bounce. PTPORT=19300 PTFILE=dev19L.html node r19a.js   (ONLY=<substring> to run some cases)
process.env.TOP = '1';
const CC = require('./cards');
const X = (name, mana, cmc, type, text, p, t) => ({object:'card', id:'id-x19-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, mana_cost:mana, cmc, type_line:type, oracle_text:text,
  colors:[...new Set((mana.match(/[WUBRG]/g) || []))], color_identity:[...new Set((mana.match(/[WUBRG]/g) || []))], keywords:[], layout:'normal', set:'tst', collector_number:'19' + cmc, set_name:'Test', released_at:'2024-01-01', power:p, toughness:t, prices:{usd:'1'}});
// real Oracle text of classics that aren't among the 7,000 most played
const EXTRA = [
  X('Control Magic', '{2}{U}{U}', 4, 'Enchantment — Aura', 'Enchant creature\nYou control enchanted creature.'),
  X('Mind Control', '{3}{U}{U}', 5, 'Enchantment — Aura', 'Enchant creature\nYou control enchanted creature.'),
  X('Confiscate', '{4}{U}{U}', 6, 'Enchantment — Aura', 'Enchant permanent\nYou control enchanted permanent.'),
  X('Treachery', '{3}{U}{U}', 5, 'Enchantment — Aura', 'Enchant creature\nWhen Treachery enters, untap up to five lands.\nYou control enchanted creature.'),
  X('Steal Artifact', '{2}{U}{U}', 4, 'Enchantment — Aura', 'Enchant artifact\nYou control enchanted artifact.'),
  X('Dominate', '{X}{1}{U}{U}', 3, 'Instant', 'Gain control of target creature with mana value X or less. (This effect lasts indefinitely.)'),
  X('Vedalken Shackles', '{3}', 3, 'Artifact', 'You may choose not to untap Vedalken Shackles during your untap step.\n{2}, {T}: Gain control of target creature with power less than or equal to the number of Islands you control for as long as Vedalken Shackles remains tapped.'),
  X('Old Man of the Sea', '{1}{U}{U}', 3, 'Creature — Djinn', "You may choose not to untap Old Man of the Sea during your untap step.\n{T}: Gain control of target creature with power less than or equal to Old Man of the Sea's power for as long as Old Man of the Sea remains tapped and that creature's power remains less than or equal to Old Man of the Sea's power.", '2', '3'),
  X('Rubinia Soulsinger', '{2}{G}{W}{U}', 5, 'Legendary Creature — Faerie', 'You may choose not to untap Rubinia Soulsinger during your untap step.\n{T}: Gain control of target creature for as long as you control Rubinia Soulsinger and Rubinia Soulsinger remains tapped.', '2', '3'),
  X('Switcheroo', '{4}{U}', 5, 'Sorcery', 'Exchange control of two target creatures.'),
  X('Shifting Loyalties', '{5}{U}', 6, 'Sorcery', 'Exchange control of two target permanents that share a card type. (Artifact, creature, enchantment, land, and planeswalker are card types.)'),
  X('Juxtapose', '{3}{U}', 4, 'Sorcery', 'You and target player exchange control of the creature you each control with the highest mana value. Then exchange control of artifacts the same way. If two or more permanents a player controls are tied for highest mana value, their controller chooses one of them.'),
  X('Donate', '{2}{U}', 3, 'Sorcery', 'Target player gains control of target permanent you control.'),
  X('Political Trickery', '{2}{U}', 3, 'Sorcery', 'Exchange control of target land you control and target land an opponent controls. (This effect lasts indefinitely.)'),
  X("Puca's Mischief", '{3}{U}', 4, 'Enchantment', 'At the beginning of your upkeep, you may exchange control of target nonland permanent you control and target nonland permanent an opponent controls with an equal or lesser mana value.'),
  X('Spawnbroker', '{2}{U}', 3, 'Creature — Human Wizard', "When Spawnbroker enters, you may exchange control of target creature you control and target creature with power less than or equal to that creature's power an opponent controls.", '1', '1'),
  X('Avarice Totem', '{1}', 1, 'Artifact', '{5}: Exchange control of Avarice Totem and target nonland permanent.'),
  X('Cultural Exchange', '{4}{U}{U}', 6, 'Sorcery', 'Choose any number of creatures target player controls and choose the same number of creatures another target player controls. Those players exchange control of those creatures. (This effect lasts indefinitely.)'),
  X('Zedruu the Greathearted', '{1}{R}{W}{U}', 4, 'Legendary Creature — Minotaur Monk', 'At the beginning of your upkeep, you gain X life and draw X cards, where X is the number of permanents you own that your opponents control.\n{R}{W}{U}: Target opponent gains control of target permanent you control.', '2', '4'),
  X('Steal Artifact Bear', '{1}{G}', 2, 'Creature — Bear', '', '2', '2'),
  X('Test Ox', '{3}', 3, 'Artifact Creature — Ox', '{T}: Add {C}.', '3', '3'),
  X('Test Hulk', '{5}{G}', 6, 'Creature — Beast', '', '5', '5'),
  X('Test Charm', '{1}{W}', 2, 'Enchantment', 'At the beginning of your end step, you gain 1 life.'),
];
const WANT = ['Agent of Treachery', 'Act of Treason', 'Mob Rule', 'Insurrection', 'Mass Manipulation', 'Expropriate', 'Hellkite Tyrant', 'Sower of Temptation', 'Gilded Drake',
  'Willbreaker', 'Treasure Nabber', 'Thieving Skydiver', 'Captivating Crew', 'Zealous Conscripts', 'Bribery', "Praetor's Grasp", 'Hostage Taker', 'Ragavan, Nimble Pilferer',
  'Gonti, Lord of Luxury', 'Dack Fayden', 'Steal Enchantment', 'Perplexing Chimera', 'Thada Adel, Acquisitor', 'Grenzo, Havoc Raiser', 'Harmless Offering', 'Wrong Turn',
  'Claim the Firstborn', 'Involuntary Employment', 'Kari Zev\'s Expertise', 'Furnace Reins', 'Dragonlord Silumgar', 'Mind Flayer', 'Roil Elemental', 'Corrupted Conscience',
  'Blatant Thievery', 'Archmage\'s Charm', 'Blue Sun\'s Twilight', 'Keiga, the Tide Star', 'Kiora Bests the Sea God', 'Molten Primordial', 'Hideous Taskmaster', 'Flayer of Loyalties',
  'Firbolg Flutist', 'Coercive Recruiter', 'Reins of Power', 'Mutinous Massacre', 'Oko, Thief of Crowns', 'Shifting Grift', 'Volatile Stormdrake', 'Bazaar Trader', 'Stiltzkin, Moogle Merchant',
  'Humble Defector', 'Akroan Horse', 'Captivating Vampire', 'Piper of the Swarm', 'Sliver Overlord', 'Olivia Voldaren', 'Kellogg, Dangerous Mind', 'Yuffie, Materia Hunter', 'Scroll of Isildur',
  'New Blood', 'Inevitable Betrayal', 'Homeward Path', 'Wishclaw Talisman', 'Hithlain Rope', 'Pendant of Prosperity', 'Xantcha, Sleeper Agent', 'Oft-Nabbed Goat', 'Yes Man, Personal Securitron',
  'Dihada, Binder of Wills', 'Seize the Spotlight', 'Emrakul, the World Anew', 'Varchild, Betrayer of Kjeldor', 'Alexios, Deimos of Kosmos', 'Assault Suit', 'Coveted Jewel',
  'Demonic Tutor', 'Elvish Visionary', 'Khârn the Betrayer', 'Alexios, Deimos of Kosmos', 'Opposition Agent', 'Sliver Overlord', 'Muscle Sliver', 'Tergrid, God of Fright // Tergrid\'s Lantern', 'Vampire Nighthawk', 'Viscera Seer', 'Rat Colony',
  'Grizzly Bears', 'Llanowar Elves', 'Mind Stone', 'Darksteel Ingot', 'Rhystic Study', 'Command Tower', 'Lightning Bolt', 'Giant Growth', 'Murder', 'Unsummon', 'Swords to Plowshares',
  'Swiftfoot Boots', 'Sol Ring', 'Arcane Signet', 'Island', 'Forest', 'Plains', 'Mountain', 'Swamp', 'Treasure', 'Shivan Dragon', 'Blood Artist', 'Mirri, Weatherlight Duelist'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
CC.cards.push(...EXTRA.filter(c => !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, waitFor} = H;
const AUTO = () => { setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){
      const q = window.__tq || []; const e = q.length ? q[0] : null;
      const ok = (m.cands || []).filter(x => x.ok);
      let picks = [];
      const q0n = q.length; const want = (m.spec && m.spec.n > 1 && m.spec.n < 99) ? m.spec.n : 1;
      while (q.length && picks.length < want){ const e = q[0]; const re = new RegExp(e.re, 'i'); const got = ok.filter(x => !picks.includes(x) && re.test(x.nm) && (!e.who || (e.who === 'me' ? x.pid === MYPID : e.who === 'opp' ? x.pid !== MYPID : x.pid === e.who))).slice(0, e.n || 1); picks.push(...got); q.shift(); if ((e.n || 1) > 1) break; }
      if (window.__dbg) console.error('AUTO', m.title, JSON.stringify(picks.map(x => x.nm)), JSON.stringify((m.cands || []).map(x => [x.nm, x.ok]))); if (q0n && !picks.length) console.error('AUTO nopick', m.title, JSON.stringify((m.cands || []).map(x => [x.nm, x.ok, x.why, x.pid === MYPID])));
      if (!q0n) picks = m.spec && m.spec.upTo ? [] : ok.filter(x => x.pid !== MYPID).slice(0, 1);
      m.__done = 1; m.resolve(picks); closeModal(); }
    else if (m.type === 'zone' && m.onClose){ m.__done = 1; closeModal(); }
    else if (m.type === 'yes' && m.resolve){ m.__done = 1; m.resolve(window.__no ? false : true); closeModal(); }
    else if (m.run){ m.__done = 1; const d = window.__num != null ? window.__num : (m.def ?? 1); m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 100); };
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
let ALL = []; const RES = {}; let curCase = null; const T0 = Date.now();
// v20c (helper R): this file runs ~100 real games' worth of cases. The suite runner gives each file `timeout 1200` (20 min); when it
// fires, SIGTERM makes Playwright close the browser, and every case still to come failed with "Target page … has been closed" —
// that was the "Captivating Vampire / Piper / Sliver Overlord / Scroll of Isildur time out late in a long run" report (they were simply
// the cases running at minute 20 under two parallel streams: 25½ min). The waits below are now event-driven where they were fixed
// sleeps, each case prints its time, and a SIGTERM or a closed browser is reported as what it is instead of as case failures.
let STOPPED = '';
process.on('SIGTERM', () => { STOPPED = `stopped by SIGTERM after ${((Date.now() - T0) / 60000).toFixed(1)} min, during “${curCase}” (the runner's time limit?)`; console.log('\n!! r19a ' + STOPPED); });
const step = async (name, fn) => { if (process.env.ONLY && !process.env.ONLY.split(',').some(o => name.includes(o))) return; if (STOPPED) return; console.log('— ' + name); const f0 = H.fails(); curCase = name; const t0 = Date.now();
  try { await T(90000, fn()); } catch (e){ if (/has been closed/.test(e.message)){ STOPPED = STOPPED || `the browser was closed during “${name}” after ${((Date.now() - T0) / 60000).toFixed(1)} min`; console.log('  !! ' + STOPPED); return; } console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (process.env.TIMES) console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  RES[name] = H.fails() === f0;
  if (H.fails() > f0 || process.env.LOGS) for (const [nm, p] of ALL) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})).catch(e => e.message))); };
const passAll = async (ps) => { for (let i = 0; i < 5; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(150); } };
const busyOf = async (ps) => { for (const p of ps) if (await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting))) return true; return false; };
const pass1 = async (ps) => { for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); };
// idle: one round of passes, then idle again 150 ms later → done (was: five rounds of passes every time, ~1 s even with nothing to do)
const settle = async (ps) => { for (let i = 0; i < 40; i++){ if (!(await busyOf(ps))){ await pass1(ps); await sleep(150); if (!(await busyOf(ps))) return; } await passAll(ps); if (!(await busyOf(ps))) return; await sleep(150); } };
// every client sees every other client's empty battlefield and stack (then a short margin for late requests), at most ~3 s
const seenEmpty = async (ps) => { const t = Date.now(); while (Date.now() - t < 3000){ let ok = true; for (const p of ps) ok = ok && await p.evaluate(() => [...OPP.values()].every(o => !(o.bf || []).length && !(o.stk || []).length)).catch(() => true); if (ok) break; await sleep(100); } await sleep(250); };
// quiet: no client's state (its own zones, the stack, its requests, and what it sees of the others) changed for `ms` (at most `max`)
const SIG = () => JSON.stringify([S.log.length, S.stk.length, S.bf.length, S.hand.length, S.gy.length, S.ex.length, (S.rq || []).length, S.life, !!UI.resolving, !!UI.casting, [...OPP.values()].map(o => [(o.bf || []).length, (o.stk || []).length, (o.rq || []).length, (o.gy || []).length, o.life])]);
const quiet = async (ps, ms = 600, max = 3000) => { let last = '', since = Date.now(); const t = Date.now(); while (Date.now() - t < max){ const sig = (await Promise.all(ps.map(p => p.evaluate(SIG).catch(() => 'x')))).join('|'); if (sig !== last){ last = sig; since = Date.now(); } else if (Date.now() - since >= ms) return; await sleep(100); } };
const kOf = (p, nm) => p.evaluate(nm => [...DICT.values()].find(a => a.n === nm)?.k, nm);
const putBf = (p, nm, extra) => p.evaluate(([nm, extra]) => { const a = [...DICT.values()].find(a => a.n === nm) || [...DICT.values()].find(a => a.n === nm.split(' // ')[0] || String(a.n).split(' // ')[0] === nm.split(' // ')[0]); if (!a) return null; const c = {id:S.nid++, k:a.k, x:20 + (S.nid % 30) * 3, y:30, sk:false, ...(extra || {})}; S.bf.push(c); commit(); return c.id; }, [nm, extra]);
const toHand = (p, nm) => p.evaluate(nm => { const a = [...DICT.values()].find(a => a.n === nm); if (!a) return null; const c = {id:S.nid++, k:a.k}; S.hand.push(c); commit(); return c.id; }, nm);
const FULL = {W:9, U:9, B:9, R:9, G:9, C:9};
const VICT = ['Grizzly Bears', 'Llanowar Elves', 'Mind Stone', 'Rhystic Study', 'Sol Ring', 'Blood Artist', 'Command Tower', 'Muscle Sliver', 'Test Hulk', 'Darksteel Ingot', 'Test Ox', 'Steal Artifact Bear', 'Shivan Dragon', 'Lightning Bolt'];
const cast = (p, nm, o = {}) => p.evaluate(async ([nm, o, FULL]) => { let c = S.hand.find(x => cname(x) === nm); if (!c){ const a = [...DICT.values()].find(a => a.n === nm); c = {id:S.nid++, k:a.k}; S.hand.push(c); }
  S.pool = {...emptyPool(), ...FULL}; commit(); await beginCast(c, 'hand', o.x != null ? {x:o.x} : undefined); return S.hand.includes(c) ? 'not cast' : 'ok'; }, [nm, o, FULL]);
const activate = (p, nm, re) => p.evaluate(async ([nm, re, FULL]) => { const c = S.bf.find(x => cname(x) === nm); if (!c) return 'missing'; c.sk = false; c.tap = false; S.pool = {...emptyPool(), ...FULL}; const ab = (abilityList(c) || []).find(a => new RegExp(re, 'i').test(a.eff || a.text || '')); if (!ab) return 'no ability: ' + (abilityList(c) || []).map(a => a.eff).join(' / '); const n0 = S.stk.length, l0 = S.log.length; const why = abilityReady(c, ab); await activateAbility(c, ab); return S.stk.length > n0 || S.log.length > l0 ? 'ok' : 'not activated: ' + why; }, [nm, re, FULL]);
// where is the card with key k: per client, which zone, controller / owner
const where = async (P, k) => { const out = []; for (const [nm, p] of ALL) out.push(await p.evaluate(([k, nm]) => { const r = []; for (const z of ['bf', 'gy', 'hand', 'ex', 'cz']) for (const c of S[z]) if (c.k === k) r.push(nm + ':' + z + (c.own ? '(own ' + nameOf(c.own.pid) + ')' : '') + ((c.n || 1) > 1 ? 'x' + c.n : '')); return r; }, [k, nm])); return out.flat(); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    const G = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r19a');
    const K = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r19a');
    ALL = [['Georges', G], ['Kim', K]]; const P2 = [G, K]; if (process.env.DBG) for (const p of P2) await p.evaluate(() => { window.__dbg = 1; const t0 = toast; toast = (...a) => { console.error('TOAST', ...a); return t0(...a); }; });
    await waitFor(G, () => OPP.size === 1, null, 20000); await G.evaluate(AUTO); await K.evaluate(AUTO);
    await G.click('[data-act="goFirst"]'); await settle(P2);
    const GP = await G.evaluate(() => MYPID), KP = await K.evaluate(() => MYPID);
    // one step at a time with one round of passes (was five rounds, ~1 s, after every step)
    const toMain = async (p) => { for (let i = 0; i < 300; i++){ if (await p.evaluate(() => phaseNow().mine && phaseNow().ph === 3 && !stackAll().length)) return true; await p.evaluate(() => { const pn = phaseNow(); if (pn.mine && pn.ph !== 3 && !stackAll().length && !UI.modal) nextAction(); }); await pass1(P2); await sleep(120); } return false; };
    // the cases count every copy of a victim card on every client: a copy the decks hold and a player happens to draw in a turn cycle
    // (Blatant Thievery's "a turn cycle later" saw Georges:hand Grizzly Bears) is not the stolen card. Victims come from putBf / the
    // cases' own library inserts, never from the decks.
    await Promise.all(P2.map(p => p.evaluate(v => { S.lib = S.lib.filter(c => !v.includes(cname(c))); commit(); }, VICT)));
    await toMain(G);
    const after = async () => { await sleep(200); await settle(P2); await quiet(P2, 700, 3000); await settle(P2); await quiet(P2, 300, 1500); };
    const wipe = async () => { await Promise.all(P2.map(p => p.evaluate(() => { UI.modal = null; window.__tq = []; window.__want = null; window.__no = false; window.__num = null; S.bf = []; S.lent = []; S.hand = []; S.gy = []; S.ex = []; S.stk = []; S.prm = []; commit(); }))); await seenEmpty(P2); };
    // Georges's turn, main phase, clean boards
    const fresh = async () => { await wipe(); if (!(await G.evaluate(() => phaseNow().mine))){ await K.evaluate(() => passTurn()); await waitFor(G, () => phaseNow().mine, null, 5000); await quiet(P2, 400, 2000); } await toMain(G); await wipe(); };
    // turn cycles
    const gPass = async () => { await G.evaluate(() => passTurn()); await waitFor(K, () => phaseNow().mine, null, 5000); await quiet(P2, 700, 3000); await settle(P2); await quiet(P2, 300, 1500); };
    const kPass = async () => { await toMain(K); await K.evaluate(() => passTurn()); await waitFor(G, () => phaseNow().mine, null, 5000); await quiet(P2, 700, 3000); await settle(P2); await toMain(G); await quiet(P2, 300, 1500); };
    // --- verification helpers ---
    const ctlBy = async (k, ctl, owner) => { // k is on ctl's battlefield (owned by owner), nowhere else, and both clients agree
      const own = owner === 'Georges' ? G : K, cp = ctl === 'Georges' ? G : K; const ownPid = owner === 'Georges' ? GP : KP, ctlPid = ctl === 'Georges' ? GP : KP;
      await waitFor(cp, ([k, op, same]) => S.bf.some(c => c.k === k && (same ? !c.own : c.own && c.own.pid === op)), [k, ownPid, owner === ctl], 7000);
      await quiet(P2, 400, 2500);
      const onCtl = await cp.evaluate(([k, op, same]) => S.bf.filter(c => c.k === k && (same ? !c.own : (c.own && c.own.pid === op))).length, [k, ownPid, owner === ctl]);
      const w = await where(P2, k);
      const views = []; for (const [nm, p] of ALL) views.push(await p.evaluate(([k, cpid]) => { const mine = S.bf.filter(c => c.k === k).length; const opp = [...OPP.entries()].map(([pid, st]) => [pid, (st.bf || []).filter(c => c.k === k).length]); return {me:MYPID, mine, opp}; }, [k, ctlPid]));
      const seen = views.every(v => { const tot = (v.me === ctlPid ? v.mine : (v.opp.find(o => o[0] === ctlPid) || [0, 0])[1]); const else_ = (v.me === ctlPid ? 0 : v.mine) + v.opp.filter(o => o[0] !== ctlPid).reduce((a, o) => a + o[1], 0); return tot === 1 && else_ === 0; });
      return {ok:onCtl === 1 && w.length === 1 && seen, info:`ctl=${onCtl} where=[${w}] views=${JSON.stringify(views.map(v => [v.mine, v.opp.map(o => o[1])]))}`};
    };
    const expectCtl = async (nm, ctl, owner, msg) => { const k = await kOf(G, nm); const r = await ctlBy(k, ctl, owner); check(r.ok, `${msg || nm + ': ' + ctl + ' controls ' + owner + "'s card"} (${r.info})`); return r.ok; };
    const canUse = (p, nm) => p.evaluate(nm => { const c = S.bf.find(x => cname(x) === nm); if (!c) return 'missing'; if (isCreatureCard(c)) return canAttack(c) || 'ok'; if (manaAbs(c).length) return c.tap ? 'tapped' : 'ok'; return 'ok'; }, nm);
    const lentN = p => p.evaluate(() => S.lent.length);
    const gyHas = (p, nm) => p.evaluate(nm => S.gy.some(c => cname(c) === nm), nm);
    const handHas = (p, nm) => p.evaluate(nm => S.hand.some(c => cname(c) === nm), nm);
    const destroyOn = (p, nm) => p.evaluate(nm => { const c = S.bf.find(x => cname(x) === nm); if (c){ destroyCard(c, 'test'); commit(); return true; } return false; }, nm);
    const bounceOn = (p, nm) => p.evaluate(nm => { const c = S.bf.find(x => cname(x) === nm); if (c){ moveCard(c.id, 'hand'); commit(); return true; } return false; }, nm);
    const leaveOn = (p, nm, z = 'gy') => p.evaluate(([nm, z]) => { const c = S.bf.find(x => cname(x) === nm); if (c){ moveCard(c.id, z); commit(); return true; } return false; }, [nm, z]);
    const tq = (p, q) => p.evaluate(q => { window.__tq = q; }, q);
    const want = (p, w) => p.evaluate(w => { window.__want = w; }, w);

    // =================================================================== 2-player cases
    // A generic "steal one thing" case: Kim has the victim; Georges casts/activates/puts the card; verify; then duration.
    const stealCase = (card, o) => step(`${card}${o.label ? ' — ' + o.label : ''}`, async () => {
      await fresh();
      const victim = o.victim || 'Grizzly Bears';
      for (const v of [].concat(victim, o.kimAlso || [])) await putBf(K, v, o.vtap ? {tap:true} : {});
      for (const v of (o.geo || [])) await putBf(G, v);
      await quiet(P2, 400, 2000);   // every client has seen the boards (was a fixed 900 ms)
      if (o.pre) await o.pre();
      await tq(G, o.tq || [{re:'^' + [].concat(victim)[0].replace(/[()]/g, '.') + '$', who:'opp'}]); if (o.want) await want(G, o.want); if (o.num != null) await G.evaluate(n => { window.__num = n; }, o.num);
      let r;
      if (o.how === 'act'){ await putBf(G, card); await sleep(400); r = await activate(G, card, o.ab || 'control'); }
      else if (o.how === 'custom') r = await o.act();
      else r = await cast(G, card, {x:o.x});
      check(r === 'ok', `${card}: ${o.how === 'act' ? 'activated' : 'cast'} (${r})`);
      await after(); if (o.after2) await o.after2(); await after();
      for (const v of [].concat(victim)) if (!(await expectCtl(v, 'Georges', 'Kim', `${card}: Georges controls Kim's ${v}`))) return;
      const v0 = [].concat(victim)[0];
      if (o.use !== false){ const u = await canUse(G, v0); const want_ = o.haste ? 'ok' : (o.sick === false ? 'ok' : /summoning sick|ok/); check(typeof want_ === 'string' ? u === want_ : want_.test(u), `${card}: ${v0} is usable as expected by Georges (${u})`); }
      if (o.untapped) check(await G.evaluate(nm => !S.bf.find(x => cname(x) === nm)?.tap, v0), `${card}: ${v0} was untapped`);
      if (o.dur === 'eot'){ await gPass(); await expectCtl(v0, 'Kim', 'Kim', `${card}: after Georges's turn ends ${v0} is back with Kim`); check(await lentN(K) === 0, `${card}: Kim has no outstanding loans`); }
      else if (o.dur === 'src'){ await leaveOn(G, o.src || card); await after(); await expectCtl(v0, 'Kim', 'Kim', `${card}: the source left — ${v0} is back with Kim`); }
      else if (o.dur === 'perm'){ await gPass(); await kPass(); await expectCtl(v0, 'Georges', 'Kim', `${card}: a turn cycle later Georges still controls ${v0}`);
        if (o.die !== false){ await destroyOn(G, v0); await after(); check(await gyHas(K, v0) && !(await gyHas(G, v0)), `${card}: ${v0} destroyed under Georges → Kim's graveyard`); const w = await where(P2, await kOf(G, v0)); check(w.length === 1, `${card}: one copy left in the game (${w})`); } }
      else if (o.dur === 'bounce'){ await bounceOn(G, v0); await after(); check(await handHas(K, v0) && !(await handHas(G, v0)), `${card}: ${v0} bounced under Georges → Kim's hand`); }
      if (o.post) await o.post();
    });

    // ---- until end of turn (untap + haste) ----
    await stealCase('Act of Treason', {dur:'eot', haste:true, untapped:true, vtap:true});
    await stealCase('Threaten', {dur:'eot', haste:true, untapped:true, vtap:true});
    await stealCase('Claim the Firstborn', {dur:'eot', haste:true, untapped:true});
    await stealCase('Involuntary Employment', {dur:'eot', haste:true, post:async () => check(await G.evaluate(() => S.bf.some(c => /Treasure/.test(cname(c)))), 'Involuntary Employment: made a Treasure')});
    await stealCase("Kari Zev's Expertise", {dur:'eot', haste:true, want:'^no|decline|don|skip|cancel'});
    await stealCase('Furnace Reins', {dur:'eot', haste:true});
    await stealCase('Zealous Conscripts', {dur:'eot', haste:true, victim:'Mind Stone', use:false, label:'artifact'});
    await stealCase('Zealous Conscripts', {dur:'eot', haste:true, label:'creature'});
    await stealCase('Captivating Crew', {how:'act', ab:'gain control', dur:'eot', haste:true});
    await stealCase('Firbolg Flutist', {dur:'eot', haste:true});
    await stealCase('Coercive Recruiter', {dur:'eot', haste:true});
    await stealCase('Molten Primordial', {dur:'eot', haste:true});
    await stealCase('Hideous Taskmaster', {dur:'eot', haste:true});
    await stealCase('Flayer of Loyalties', {dur:'eot', haste:true, post:async () => {}});
    // ---- permanent ----
    await stealCase('Agent of Treachery', {dur:'perm'});
    await stealCase('Agent of Treachery', {dur:'perm', victim:'Rhystic Study', use:false, label:'enchantment', die:false});
    await stealCase('Dominate', {dur:'perm', x:2, num:2});
    await stealCase('Blue Sun\'s Twilight', {dur:'perm', x:2, num:2});
    await stealCase('Archmage\'s Charm', {dur:'perm', victim:'Sol Ring', want:'control', use:false, die:false});
    await stealCase('Dack Fayden', {how:'custom', victim:'Mind Stone', use:false, dur:'perm', die:false, act:async () => { await putBf(G, 'Dack Fayden', {co:3}); return G.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Dack Fayden'); const i = loyaltyAbs(c).findIndex(a => /control/i.test(a.eff)); if (i < 0) return 'no -2'; await activateLoyalty(c, i); return 'ok'; }); }});
    await stealCase('Mass Manipulation', {x:2, victim:['Grizzly Bears', 'Llanowar Elves'], tq:[{re:'Grizzly Bears|Llanowar Elves', who:'opp', n:2}], dur:'perm', die:false});
    await stealCase('Blatant Thievery', {dur:'perm', die:false});
    await stealCase('New Blood', {dur:'perm', geo:['Edgar Markov'], die:false, pre:async () => {}});
    await stealCase('Steal Enchantment', {victim:'Rhystic Study', use:false, dur:'bounce', tq:[{re:'Rhystic Study', who:'opp'}]});
    // ---- auras: as long as the aura stays ----
    await stealCase('Control Magic', {dur:'src', src:'Control Magic'});
    await stealCase('Mind Control', {dur:'perm', die:true});
    await stealCase('Confiscate', {victim:'Mind Stone', dur:'src', use:false});
    await stealCase('Treachery', {dur:'src'});
    await stealCase('Steal Artifact', {victim:'Mind Stone', dur:'src', use:false});
    await stealCase('Corrupted Conscience', {dur:'src'});
    // ---- for as long as the source stays / you control it ----
    await stealCase('Sower of Temptation', {dur:'src'});
    await stealCase('Dragonlord Silumgar', {dur:'src'});
    await stealCase('Mind Flayer', {dur:'src'});
    await stealCase('Vedalken Shackles', {how:'act', geo:['Island', 'Island', 'Island'], dur:'custom', post:async () => { await G.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Vedalken Shackles'); c.tap = false; commit(); }); await after(); await sleep(800); await expectCtl('Grizzly Bears', 'Kim', 'Kim', 'Vedalken Shackles untapped: Grizzly Bears goes back to Kim'); }});
    await stealCase('Old Man of the Sea', {how:'act', ab:'control', post:async () => { await G.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Old Man of the Sea'); c.tap = false; commit(); }); await after(); await sleep(800); await expectCtl('Grizzly Bears', 'Kim', 'Kim', 'Old Man of the Sea untapped: Grizzly Bears goes back to Kim'); }});
    await stealCase('Rubinia Soulsinger', {how:'act', ab:'control', post:async () => { await leaveOn(G, 'Rubinia Soulsinger'); await after(); await sleep(800); await expectCtl('Grizzly Bears', 'Kim', 'Kim', 'Rubinia left: Grizzly Bears goes back to Kim'); }});
    await stealCase('Olivia Voldaren', {how:'act', ab:'gain control', victim:'Blood Artist', dur:'src', src:'Olivia Voldaren', tq:[{re:'Blood Artist', who:'opp'}]});
    await stealCase('Kellogg, Dangerous Mind', {how:'custom', act:async () => { await putBf(G, 'Kellogg, Dangerous Mind'); for (let i = 0; i < 5; i++) await putBf(G, 'Treasure'); await sleep(300); return activate(G, 'Kellogg, Dangerous Mind', 'control'); }, dur:'src', src:'Kellogg, Dangerous Mind'});
    await stealCase('Yuffie, Materia Hunter', {victim:'Mind Stone', use:false, dur:'src', src:'Yuffie, Materia Hunter'});
    await stealCase('Roil Elemental', {how:'custom', act:async () => { await putBf(G, 'Roil Elemental'); await sleep(400); return G.evaluate(() => { const a = [...DICT.values()].find(a => a.n === 'Forest'); const c = {id:S.nid++, k:a.k}; S.hand.push(c); moveCard(c.id, 'bf'); commit(); return 'ok'; }); }, dur:'src', src:'Roil Elemental'});
    // ---- steal triggers ----
    await stealCase('Willbreaker', {how:'custom', act:async () => { await putBf(G, 'Willbreaker'); await sleep(300); await tq(G, [{re:'Grizzly Bears', who:'opp'}]); return cast(G, 'Giant Growth'); }, dur:'src', src:'Willbreaker'});
    await stealCase('Treasure Nabber', {how:'custom', victim:'Mind Stone', use:false, act:async () => { await putBf(G, 'Treasure Nabber'); await sleep(900); await K.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Mind Stone'); await activateMana(c, manaAbs(c)[0], 'C'); commit(); }); return 'ok'; },
      post:async () => { // until the end of Georges's NEXT turn: stays through Kim's turn, back after Georges's next turn
        await gPass(); await expectCtl('Mind Stone', 'Georges', 'Kim', 'Treasure Nabber: still Georges\'s during Kim\'s turn');
        await kPass(); await expectCtl('Mind Stone', 'Georges', 'Kim', 'Treasure Nabber: still Georges\'s on his next turn');
        await gPass(); await expectCtl('Mind Stone', 'Kim', 'Kim', 'Treasure Nabber: back to Kim after Georges\'s next turn'); }});
    await stealCase('Hellkite Tyrant', {how:'custom', victim:'Mind Stone', kimAlso:['Darksteel Ingot'], use:false, act:async () => { await putBf(G, 'Hellkite Tyrant'); await sleep(300); return G.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Hellkite Tyrant'); const [pid] = [...OPP.keys()]; emit({type:'cdmg', k:c.k, id:c.id, dp:pid, cnt:1, amt:6}); commit(); return 'ok'; }); },
      after2:async () => { const got = await G.evaluate(() => S.bf.filter(c => c.own).length); if (!got) await G.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Hellkite Tyrant'); const [pid] = [...OPP.keys()]; await runEffects('Gain control of all artifacts that player controls.', {k:c.k, name:cname(c), srcId:c.id, full:info(c.k).o, it:{kind:'trigger', evDp:pid, evPid:pid}}); commit(); }); },
      post:async () => expectCtl('Darksteel Ingot', 'Georges', 'Kim', 'Hellkite Tyrant: also took Darksteel Ingot')});
    // ---- exchanges ----
    await stealCase('Gilded Drake', {how:'custom', act:async () => cast(G, 'Gilded Drake'), post:async () => expectCtl('Gilded Drake', 'Kim', 'Georges', 'Gilded Drake: Kim controls Georges\'s Drake')});
    await stealCase('Switcheroo', {geo:['Test Hulk'], tq:[{re:'Test Hulk', who:'me'}, {re:'Grizzly Bears', who:'opp'}], post:async () => expectCtl('Test Hulk', 'Kim', 'Georges', 'Switcheroo: Kim controls Georges\'s Test Hulk'), dur:'perm', die:false});
    await stealCase('Shifting Loyalties', {victim:'Mind Stone', geo:['Test Ox'], use:false, tq:[{re:'Test Ox', who:'me'}, {re:'Mind Stone', who:'opp'}], post:async () => expectCtl('Test Ox', 'Kim', 'Georges', 'Shifting Loyalties: Kim controls Georges\'s Test Ox (both artifacts)')});
    await stealCase('Political Trickery', {victim:'Command Tower', geo:['Island'], use:false, tq:[{re:'Island', who:'me'}, {re:'Command Tower', who:'opp'}], post:async () => expectCtl('Island', 'Kim', 'Georges', 'Political Trickery: Kim controls Georges\'s Island')});
    await stealCase('Juxtapose', {victim:['Test Hulk', 'Darksteel Ingot'], geo:['Grizzly Bears', 'Mind Stone'], use:false, tq:[{re:'Kim', who:'opp'}], post:async () => { await expectCtl('Grizzly Bears', 'Kim', 'Georges', 'Juxtapose: Kim controls Georges\'s Grizzly Bears'); await expectCtl('Mind Stone', 'Kim', 'Georges', 'Juxtapose: Kim controls Georges\'s Mind Stone'); }});
    await stealCase('Shifting Grift', {geo:['Test Hulk'], want:'creatures', tq:[{re:'Test Hulk', who:'me'}, {re:'Grizzly Bears', who:'opp'}], post:async () => expectCtl('Test Hulk', 'Kim', 'Georges', 'Shifting Grift: Kim controls Georges\'s Test Hulk')});
    await stealCase('Spawnbroker', {geo:['Test Hulk'], tq:[{re:'Test Hulk', who:'me'}, {re:'Grizzly Bears', who:'opp'}], post:async () => expectCtl('Test Hulk', 'Kim', 'Georges', 'Spawnbroker: Kim controls Georges\'s Test Hulk')});
    await stealCase('Oko, Thief of Crowns', {how:'custom', geo:['Test Ox'], act:async () => { await putBf(G, 'Oko, Thief of Crowns', {co:6}); await tq(G, [{re:'Test Ox', who:'me'}, {re:'Grizzly Bears', who:'opp'}]); return G.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Oko, Thief of Crowns'); const i = loyaltyAbs(c).findIndex(a => /exchange/i.test(a.eff)); if (i < 0) return 'no -5'; if (window.__dbg){ const ab = loyaltyAbs(c)[i]; console.error('OKO specs', JSON.stringify(targetSpecs(ab.eff))); window.__tq = [{re:'Test Ox', who:'me'}, {re:'Grizzly Bears', who:'opp'}]; const r = await chooseTargets(ab.eff, {pid:MYPID, col:'G', types:typeOf(c), id:c.id}, 'dbg'); console.error('OKO ct', JSON.stringify(r)); window.__tq = [{re:'Test Ox', who:'me'}, {re:'Grizzly Bears', who:'opp'}]; } await activateLoyalty(c, i); if (window.__dbg) console.error('OKO stk', JSON.stringify(S.stk.map(x => [x.nm, x.tgts]))); return 'ok'; }); }, post:async () => expectCtl('Test Ox', 'Kim', 'Georges', 'Oko −5: Kim controls Georges\'s Test Ox')});
    await stealCase('Avarice Totem', {how:'act', ab:'exchange', victim:'Mind Stone', use:false, post:async () => expectCtl('Avarice Totem', 'Kim', 'Georges', 'Avarice Totem: Kim controls the Totem')});
    await stealCase('Volatile Stormdrake', {post:async () => expectCtl('Volatile Stormdrake', 'Kim', 'Georges', 'Volatile Stormdrake: Kim controls the Drake'), use:false});
    await stealCase('Reins of Power', {geo:['Test Hulk'], haste:true, tq:[{re:'Kim', who:'opp'}], dur:'eot', post:async () => expectCtl('Test Hulk', 'Georges', 'Georges', 'Reins of Power: Test Hulk came back to Georges')});
    // ---- mass, until end of turn ----
    await stealCase('Insurrection', {victim:['Grizzly Bears', 'Llanowar Elves'], haste:true, vtap:true, untapped:true, dur:'eot'});
    await stealCase('Mob Rule', {victim:'Test Hulk', want:'4 or greater|power 4', haste:true, dur:'eot', kimAlso:['Llanowar Elves'], post:async () => expectCtl('Llanowar Elves', 'Kim', 'Kim', 'Mob Rule: the 1-power Elves stayed with Kim')});
    await stealCase('Mutinous Massacre', {victim:'Test Hulk', want:'odd', haste:true, dur:'eot'});
    // ---- library / exile steals ----
    await step('Bribery: a creature from Kim\'s library enters under Georges\'s control; it dies into Kim\'s graveyard', async () => {
      await fresh(); await K.evaluate(() => { const a = [...DICT.values()].find(a => a.n === 'Shivan Dragon'); S.lib.unshift({id:S.nid++, k:a.k}); commit(); }); await sleep(800);
      await want(G, 'Shivan Dragon'); await tq(G, [{re:'Kim', who:'opp'}]); check(await cast(G, 'Bribery') === 'ok', 'Bribery cast'); await after(); await sleep(1500); await after();
      const k = await kOf(G, 'Shivan Dragon'); const g = await G.evaluate(k => S.bf.filter(c => c.k === k).map(c => ({own:c.own ? nameOf(c.own.pid) : '', sk:!!c.sk})), k);
      check(g.length === 1, `Georges has Shivan Dragon on the battlefield (${JSON.stringify(g)})`);
      check(await K.evaluate(k => (OPP.get([...OPP.keys()][0]).bf || []).some(c => c.k === k), k), 'Kim sees the Dragon on Georges\'s side');
      await destroyOn(G, 'Shivan Dragon'); await after(); check(await gyHas(K, 'Shivan Dragon') && !(await gyHas(G, 'Shivan Dragon')), 'the stolen Dragon died → Kim\'s graveyard (she owns it)');
    });
    await step('Praetor\'s Grasp: exile a card from Kim\'s library face down; Georges may play it', async () => {
      await fresh(); await K.evaluate(() => { const a = [...DICT.values()].find(a => a.n === 'Lightning Bolt'); S.lib.unshift({id:S.nid++, k:a.k}); commit(); }); await sleep(800);
      await want(G, 'Lightning Bolt'); await tq(G, [{re:'Kim', who:'opp'}]); check(await cast(G, "Praetor's Grasp") === 'ok', "Praetor's Grasp cast"); await after(); await sleep(1500);
      const ex = await G.evaluate(() => S.ex.filter(c => cname(c) === 'Lightning Bolt').map(c => ({own:c.own ? nameOf(c.own.pid) : '', play:!!c.mayPlay})));
      check(ex.length === 1 && ex[0].play, `Georges has Kim's Lightning Bolt in exile, playable (${JSON.stringify(ex)})`);
      const l0 = await K.evaluate(() => S.life); await tq(G, [{re:'Kim', who:'opp'}]);
      await G.evaluate(async () => { const c = S.ex.find(x => cname(x) === 'Lightning Bolt'); S.pool = {...emptyPool(), R:1}; await beginCast(c, 'ex'); }); await after(); await sleep(1000);
      check(await K.evaluate(() => S.life) === l0 - 3, 'Georges cast the Bolt at Kim');
      check(await gyHas(K, 'Lightning Bolt') && !(await gyHas(G, 'Lightning Bolt')), 'the Bolt went to Kim\'s graveyard (she owns it)');
    });
    await step('Hostage Taker: exiles Kim\'s creature; Georges casts it; it is his until it leaves; dies → Kim\'s graveyard', async () => {
      await fresh(); await putBf(K, 'Grizzly Bears'); await sleep(800); await tq(G, [{re:'Grizzly Bears', who:'opp'}]);
      check(await cast(G, 'Hostage Taker') === 'ok', 'Hostage Taker cast'); await after(); await sleep(1500);
      const ex = await G.evaluate(() => S.ex.filter(c => cname(c) === 'Grizzly Bears').map(c => ({own:c.own ? nameOf(c.own.pid) : '', play:!!c.mayPlay})));
      check(ex.length === 1 && ex[0].play, `Grizzly Bears is exiled with Hostage Taker, castable by Georges (${JSON.stringify(ex)})`);
      check(!(await K.evaluate(() => S.bf.some(c => cname(c) === 'Grizzly Bears'))), 'Kim no longer has Grizzly Bears');
      await G.evaluate(async () => { const c = S.ex.find(x => cname(x) === 'Grizzly Bears'); S.pool = {...emptyPool(), C:2}; await beginCast(c, 'ex'); }); await after(); await sleep(1500);
      await expectCtl('Grizzly Bears', 'Georges', 'Kim', 'Hostage Taker: Georges cast Kim\'s Grizzly Bears');
      await destroyOn(G, 'Grizzly Bears'); await after(); check(await gyHas(K, 'Grizzly Bears') && !(await gyHas(G, 'Grizzly Bears')), 'it died → Kim\'s graveyard');
    });
    await step('Hostage Taker leaves before the card is cast: the creature returns to Kim', async () => {
      await fresh(); await putBf(K, 'Grizzly Bears'); await sleep(800); await tq(G, [{re:'Grizzly Bears', who:'opp'}]);
      await cast(G, 'Hostage Taker'); await after(); await sleep(1200); await leaveOn(G, 'Hostage Taker'); await after(); await sleep(1500);
      await expectCtl('Grizzly Bears', 'Kim', 'Kim', 'Hostage Taker left: Grizzly Bears back on Kim\'s battlefield');
    });
    await step('Gonti, Lord of Luxury: exiles one of Kim\'s top four face down; Georges may cast it', async () => {
      await fresh(); await K.evaluate(() => { const a = [...DICT.values()].find(a => a.n === 'Lightning Bolt'); S.lib.unshift({id:S.nid++, k:a.k}); commit(); }); await sleep(800);
      await want(G, 'Lightning Bolt'); await tq(G, [{re:'Kim', who:'opp'}]); await cast(G, 'Gonti, Lord of Luxury'); await after(); await sleep(1500);
      const ex = await G.evaluate(() => S.ex.filter(c => c.own).map(c => ({n:cname(c), play:!!c.mayPlay})));
      check(ex.length === 1 && ex[0].play, `Georges has one of Kim's cards exiled, castable (${JSON.stringify(ex)})`);
    });
    // ---- donating ----
    await step('Harmless Offering: Kim gains control of Georges\'s permanent; it is still his (dies → his graveyard)', async () => {
      await fresh(); await putBf(G, 'Test Charm'); await sleep(800); await tq(G, [{re:'Kim', who:'opp'}, {re:'Test Charm', who:'me'}]);
      check(await cast(G, 'Harmless Offering') === 'ok', 'Harmless Offering cast'); await after();
      await expectCtl('Test Charm', 'Kim', 'Georges', 'Harmless Offering: Kim controls Georges\'s Test Charm');
      await gPass(); await kPass(); await expectCtl('Test Charm', 'Kim', 'Georges', 'Harmless Offering: still Kim\'s a turn cycle later');
      await K.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Test Charm'); destroyCard(c, 'test'); commit(); }); await after();
      check(await gyHas(G, 'Test Charm') && !(await gyHas(K, 'Test Charm')), 'destroyed under Kim → Georges\'s graveyard');
    });
    await step('Donate / Wrong Turn: target player gains control of a permanent', async () => {
      await fresh(); await putBf(G, 'Test Charm'); await sleep(800); await tq(G, [{re:'Kim', who:'opp'}, {re:'Test Charm', who:'me'}]);
      check(await cast(G, 'Donate') === 'ok', 'Donate cast'); await after(); await expectCtl('Test Charm', 'Kim', 'Georges', 'Donate: Kim controls Test Charm');
      await fresh(); await putBf(G, 'Grizzly Bears'); await sleep(800); await tq(G, [{re:'Kim', who:'opp'}, {re:'Grizzly Bears', who:'me'}]);
      check(await cast(G, 'Wrong Turn') === 'ok', 'Wrong Turn cast'); await after(); await expectCtl('Grizzly Bears', 'Kim', 'Georges', 'Wrong Turn: Kim controls Georges\'s Grizzly Bears');
    });
    await step('Zedruu / Bazaar Trader / Stiltzkin: activated donations', async () => {
      for (const [card, re] of [['Zedruu the Greathearted', 'gains control'], ['Bazaar Trader', 'gains control'], ['Stiltzkin, Moogle Merchant', 'gains control']]){
        await fresh(); await putBf(G, 'Test Charm'); await putBf(G, 'Grizzly Bears'); await sleep(600);
        await tq(G, [{re:'Kim', who:'opp'}, {re:card === 'Stiltzkin, Moogle Merchant' ? 'Test Charm' : 'Grizzly Bears', who:'me'}]);
        await putBf(G, card); await sleep(300); const r = await activate(G, card, re); check(r === 'ok', `${card}: activated (${r})`); await after();
        await expectCtl(card === 'Stiltzkin, Moogle Merchant' ? 'Test Charm' : 'Grizzly Bears', 'Kim', 'Georges', `${card}: Kim controls Georges's permanent`);
      }
    });
    await step('Humble Defector / Akroan Horse / Xantcha: the card changes controller itself', async () => {
      await fresh(); await tq(G, [{re:'Kim', who:'opp'}]); await putBf(G, 'Humble Defector'); await sleep(300); const h0 = await G.evaluate(() => S.hand.length);
      check(await activate(G, 'Humble Defector', 'draw') === 'ok', 'Humble Defector activated'); await after();
      check(await G.evaluate(() => S.hand.length) === h0 + 2, 'Georges drew two'); await expectCtl('Humble Defector', 'Kim', 'Georges', 'Humble Defector: now Kim controls it');
      await fresh(); await cast(G, 'Akroan Horse'); await after(); await expectCtl('Akroan Horse', 'Kim', 'Georges', 'Akroan Horse: enters, then Kim gains control');
      await fresh(); await cast(G, 'Xantcha, Sleeper Agent'); await after(); await expectCtl('Xantcha, Sleeper Agent', 'Kim', 'Georges', 'Xantcha: enters under Kim\'s control');
    });
    // ---- summoning sickness, Auras/Equipment, counters, ownership details ----
    await step('A stolen creature keeps its counters, is summoning sick, and equipment stays with its controller', async () => {
      await fresh(); const id = await putBf(K, 'Grizzly Bears'); await K.evaluate(id => { const c = S.bf.find(x => x.id === id); c.cp = 2; commit(); }, id);
      await putBf(K, 'Swiftfoot Boots'); await K.evaluate(id => { const b = S.bf.find(x => cname(x) === 'Swiftfoot Boots'); b.att = {pid:MYPID, id}; commit(); }, id); await sleep(900);
      await tq(G, [{re:'Grizzly Bears', who:'opp'}]); // hexproof from Boots stops targeting: unattach first (Boots is Kim's) — Agent can't target; use Insurrection-free path: Mind Control after unattaching
      await K.evaluate(() => { const b = S.bf.find(x => cname(x) === 'Swiftfoot Boots'); b.att = null; commit(); }); await sleep(700);
      await cast(G, 'Mind Control'); await after();
      await expectCtl('Grizzly Bears', 'Georges', 'Kim');
      const s = await G.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); return {cp:c.cp, atk:canAttack(c)}; });
      check(s.cp === 2, `counters kept (+${s.cp})`); check(/summoning sick/.test(s.atk), `summoning sick under its new controller (${s.atk})`);
      check(await K.evaluate(() => S.bf.some(x => cname(x) === 'Swiftfoot Boots')), 'the Boots stay with Kim');
    });
    await step('Equipment stays attached across the control change (Kim\'s Swiftfoot Boots on her creature, Insurrection)', async () => {
      await fresh(); const id = await putBf(K, 'Grizzly Bears', {tap:true}); await putBf(K, 'Swiftfoot Boots'); await K.evaluate(id => { const b = S.bf.find(x => cname(x) === 'Swiftfoot Boots'); b.att = {pid:MYPID, id}; commit(); }, id); await sleep(900);
      await cast(G, 'Insurrection'); await after(); await sleep(800);
      await expectCtl('Grizzly Bears', 'Georges', 'Kim');
      const gid = await G.evaluate(() => S.bf.find(x => cname(x) === 'Grizzly Bears')?.id);
      const katt = await K.evaluate(() => S.bf.find(x => cname(x) === 'Swiftfoot Boots')?.att);
      check(katt && katt.pid === GP && katt.id === gid, `Kim's Boots are attached to the Bears on Georges's side (${JSON.stringify(katt)} → ${GP}/${gid})`);
      check(await G.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); return kwOf(c, 'hexproof') && hasHaste(c); }), 'the Bears have hexproof and haste from Kim\'s Boots on Georges\'s client');
      await gPass(); await sleep(800);
      const back = await K.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); const b = S.bf.find(x => cname(x) === 'Swiftfoot Boots'); return c && b && b.att && b.att.pid === MYPID && b.att.id === c.id; });
      check(back, 'after the turn the Bears are back with Kim and the Boots still equip them');
      await kPass();
    });
    await step('Gaining control is not entering: a stolen creature\'s "when this enters" does not trigger', async () => {
      await fresh(); await putBf(K, 'Elvish Visionary'); await sleep(800); const h0 = await G.evaluate(() => S.hand.length);
      await tq(G, [{re:'Elvish Visionary', who:'opp'}]); await cast(G, 'Act of Treason'); await after(); await sleep(600);
      await expectCtl('Elvish Visionary', 'Georges', 'Kim');
      check(await G.evaluate(() => S.hand.length) === h0, `Georges drew nothing from Elvish Visionary (hand ${h0} → ${await G.evaluate(() => S.hand.length)})`);
    });
    await step('The owner steals it back (Kim casts Control Magic on her own Bears that Georges took): it is simply hers again', async () => {
      await fresh(); await putBf(K, 'Grizzly Bears'); await sleep(800); await tq(G, [{re:'Grizzly Bears', who:'opp'}]); await cast(G, 'Agent of Treachery'); await after();
      await expectCtl('Grizzly Bears', 'Georges', 'Kim');
      await gPass(); await toMain(K); await tq(K, [{re:'Grizzly Bears', who:'opp'}]);
      check(await cast(K, 'Control Magic') === 'ok', 'Kim casts Control Magic on her Bears'); await after(); await sleep(800);
      await expectCtl('Grizzly Bears', 'Kim', 'Kim', 'Kim controls her own Bears again (not a loan from Georges)');
      check(await G.evaluate(() => S.lent.length) === 0 && await K.evaluate(() => S.lent.length) === 0, 'no loans are left on either side');
      await leaveOn(K, 'Control Magic'); await after(); await sleep(600);
      await expectCtl('Grizzly Bears', 'Kim', 'Kim', 'Control Magic left: the Bears stay with Kim (she owns them)');
      await K.evaluate(() => passTurn()); await sleep(1500); await settle(P2); await toMain(G);
    });
    await step('Khârn the Betrayer: damage is prevented and an opponent gains control; its controller draws two', async () => {
      await fresh(); await putBf(G, 'Khârn the Betrayer'); await sleep(800); const h0 = await G.evaluate(() => S.hand.length);
      await tq(K, [{re:'Khârn', who:'opp'}]); await K.evaluate(async () => { const a = [...DICT.values()].find(a => a.n === 'Lightning Bolt'); const c = {id:S.nid++, k:a.k}; S.hand.push(c); S.pool = {...emptyPool(), R:1}; commit(); await beginCast(c, 'hand'); });
      await after(); await sleep(1200); await after();
      await expectCtl('Khârn the Betrayer', 'Kim', 'Georges', 'Khârn: Kim gained control of Georges\'s Khârn');
      const k = await K.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Khârn the Betrayer'); return c ? (c.dmg || 0) : -1; }); check(k === 0, `the damage was prevented (${k})`);
      check(await G.evaluate(() => S.hand.length) === h0 + 2, `Georges drew two when he lost control (${h0} → ${await G.evaluate(() => S.hand.length)})`);
    });
    await step('Alexios, Deimos of Kosmos: each player gains control of it in their upkeep, and it comes home on its owner\'s', async () => {
      await fresh(); await putBf(G, 'Alexios, Deimos of Kosmos'); await sleep(800);
      await gPass(); await sleep(1500); await settle(P2);
      await expectCtl('Alexios, Deimos of Kosmos', 'Kim', 'Georges', 'Alexios: Kim gains control in her upkeep');
      check(await K.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Alexios, Deimos of Kosmos'); return c && c.cp >= 1 && !c.tap && hasHaste(c); }), 'Alexios is untapped with a +1/+1 counter and haste on Kim\'s side');
      await kPass(); await sleep(1000);
      await expectCtl('Alexios, Deimos of Kosmos', 'Georges', 'Georges', 'Alexios: back with Georges (its owner) in his upkeep');
      check(await G.evaluate(() => S.lent.length) === 0 && await K.evaluate(() => S.lent.length) === 0, 'no loans left');
    });
    await step('Stolen commander: dies under Georges → goes to Kim\'s command zone (owner\'s choice)', async () => {
      await fresh(); const cid = await K.evaluate(() => { const c = S.cz.find(x => x.cmd) || null; if (!c) return null; S.cz.splice(S.cz.indexOf(c), 1); c.sk = false; S.bf.push(c); commit(); return cname(c); });
      if (!cid){ check(false, 'Kim has a commander in her command zone'); return; }
      await sleep(900); await tq(G, [{re:cid, who:'opp'}]); await cast(G, 'Agent of Treachery'); await after();
      await expectCtl(cid, 'Georges', 'Kim', 'Georges controls Kim\'s commander');
      await destroyOn(G, cid); await after(); await sleep(1200); await settle(P2);
      const z = await where(P2, await kOf(G, cid)); check(z.length === 1 && /Kim:(cz|gy)/.test(z[0]), `Kim's commander went to her command zone or graveyard (${z})`);
      check(!(await G.evaluate(() => S.cz.some(c => c.cmd && cname(c) !== 'Edgar Markov'))), 'it is not in Georges\'s command zone');
    });
    await step('Stolen token: until end of turn, comes back; permanently, dies → ceases to exist', async () => {
      await fresh(); await K.evaluate(() => { const k = [...DICT.values()].find(a => /Token/.test(a.t || '') && /Goblin/.test(a.n)).k; createToken(k, 1); const t = S.bf.find(c => c.tok); t.sk = false; commit(); }); await sleep(900);
      await tq(G, [{re:'Goblin', who:'opp'}]); await cast(G, 'Act of Treason'); await after();
      check(await G.evaluate(() => S.bf.some(c => c.tok && c.own && /Goblin/.test(cname(c)))), 'Georges controls Kim\'s Goblin token');
      await gPass(); check(await K.evaluate(() => S.bf.some(c => c.tok && /Goblin/.test(cname(c)))), 'the token came back to Kim'); await kPass();
      await tq(G, [{re:'Goblin', who:'opp'}]); await cast(G, 'Agent of Treachery'); await after();
      await G.evaluate(() => { const c = S.bf.find(c => c.tok && c.own); destroyCard(c, 'test'); commit(); }); await after();
      const w = []; for (const [, p] of ALL) w.push(await p.evaluate(() => [...S.bf, ...S.gy, ...S.hand].filter(c => /Goblin/.test(cname(c)) && (c.tok || /Token/.test(info(c.k)?.t || ''))).length));
      check(w[0] + w[1] === 0, `the dead token is gone everywhere (${w})`);
    });
    await step('Opponent\'s "whenever a creature you control dies" sees a stolen creature dying under Georges', async () => {
      await fresh(); await putBf(G, 'Blood Artist'); await putBf(K, 'Grizzly Bears'); await sleep(800); await tq(G, [{re:'Grizzly Bears', who:'opp'}]);
      await cast(G, 'Agent of Treachery'); await after(); const l0 = await K.evaluate(() => S.life);
      await destroyOn(G, 'Grizzly Bears'); await after(); await sleep(800); await settle(P2);
      // Blood Artist: whenever a creature dies, target player loses 1 — fires for Georges once
      const l1 = await K.evaluate(() => S.life); check(l1 === l0 - 1, `Blood Artist fired once for the stolen Bears (Kim ${l0} → ${l1})`);
    });
    await step('A stolen creature can attack its owner and deals damage', async () => {
      await fresh(); await putBf(K, 'Test Hulk'); await sleep(800); await tq(G, [{re:'Test Hulk', who:'opp'}]); await cast(G, 'Act of Treason'); await after();
      const l0 = await K.evaluate(() => S.life);
      await G.evaluate(() => setPhase(4));
      for (let i = 0; i < 30 && !(await G.evaluate(() => S.cb && S.cb.step === 'atk')); i++){ await passAll(P2); await G.evaluate(() => { if (S.cb && S.cb.step !== 'atk' && !stackAll().length) nextAction(); }); await sleep(150); }
      const hid = await G.evaluate(() => S.bf.find(c => cname(c) === 'Test Hulk')?.id);
      await G.evaluate(([h, k]) => { UI.atkSel = {[h]:'p:' + k}; renderCombatPanel(); }, [hid, KP]); await G.click('#cbpanel [data-act="atkGo"]').catch(() => {}); await passAll([K]);
      if (await waitFor(K, () => !!document.querySelector('#cbpanel [data-act="blkGo"]'), null, 8000)) await K.click('#cbpanel [data-act="blkGo"]');
      for (let i = 0; i < 20; i++){ await passAll(P2); if (await K.evaluate(l0 => S.life < l0, l0)) break; }
      await sleep(800); const l1 = await K.evaluate(() => S.life); check(l1 === l0 - 5, `Kim took 5 from her own Test Hulk (${l0} → ${l1})`);
      await settle(P2); await toMain(G).catch(() => {});
    });


    // ======================= batch 2: more wordings
    const runT = (p, txt, nm, tg) => p.evaluate(async ([txt, nm, tg]) => { const src = S.bf.find(x => cname(x) === nm); const k = src ? src.k : [...DICT.values()].find(a => a.n === nm)?.k;
      const tgts = (tg || []).map(g => g.map(re => { if (re === 'opp') { const [pid] = [...OPP.keys()]; return {t:'player', pid, nm:nameOf(pid)}; } for (const b of boardsAll()) for (const c of b.bf) if (new RegExp(re).test(cname(c)) && (b.pid !== MYPID || /^me:/.test(re) === false)) return {t:'card', pid:b.pid, id:c.id, k:c.k, nm:cname(c)}; return null; }).filter(Boolean));
      await runEffects(txt, {k, name:nm, srcId:src ? src.id : undefined, full:txt, tgts, it:{kind:'trigger'}}); commit(); return 'ok'; }, [txt, nm, tg]);
    const hit = (p, nm) => p.evaluate(nm => { const c = S.bf.find(x => cname(x) === nm); const [pid] = [...OPP.keys()]; emit({type:'cdmg', k:c.k, id:c.id, dp:pid, cnt:1, amt:2}); commit(); return 'ok'; }, nm);
    await stealCase('Keiga, the Tide Star', {how:'custom', act:async () => { await putBf(G, 'Keiga, the Tide Star'); await sleep(300); await destroyOn(G, 'Keiga, the Tide Star'); return 'ok'; }, dur:'perm', die:false});
    await stealCase('Kiora Bests the Sea God', {how:'custom', vtap:true, untapped:true, act:async () => { await putBf(G, 'Kiora Bests the Sea God'); return runT(G, 'Gain control of target permanent an opponent controls. Untap it.', 'Kiora Bests the Sea God', [['Grizzly Bears']]); }, dur:'perm', die:false, label:'chapter III'});
    await stealCase('Scroll of Isildur', {how:'custom', victim:'Mind Stone', use:false, act:async () => { await putBf(G, 'Scroll of Isildur'); return runT(G, 'Gain control of up to one target artifact for as long as you control this Saga.', 'Scroll of Isildur', [['Mind Stone']]); }, dur:'src', src:'Scroll of Isildur', label:'chapter I'});
    await stealCase('Captivating Vampire', {how:'custom', act:async () => { await putBf(G, 'Captivating Vampire'); for (let i = 0; i < 4; i++) await putBf(G, 'Vampire Nighthawk'); await sleep(300); return activate(G, 'Captivating Vampire', 'gain control'); }, dur:'perm', die:false,
      post:async () => check(await G.evaluate(() => /Vampire/.test(typeOf(S.bf.find(x => cname(x) === 'Grizzly Bears')))), 'Captivating Vampire: the stolen Bears is a Vampire')});
    await stealCase('Piper of the Swarm', {how:'custom', act:async () => { await putBf(G, 'Piper of the Swarm'); await G.evaluate(async () => { await runEffects('Create three 1/1 black Rat creature tokens.', {name:'test', k:null, full:''}); S.bf.filter(c => c.tok).forEach(c => c.sk = false); commit(); if (window.__dbg) console.error('RATS', JSON.stringify(S.bf.map(c => [cname(c), c.n, descOk(c.k, 'rat', {tok:c.tok}), info(c.k)?.t, sing('rats')]))); }); await sleep(300); return activate(G, 'Piper of the Swarm', 'gain control'); }, dur:'perm', die:false,
      post:async () => check(await G.evaluate(() => !S.bf.some(c => c.tok && /Rat/.test(cname(c)))), 'Piper of the Swarm: three Rats were sacrificed')});
    await stealCase('Sliver Overlord', {how:'act', ab:'gain control', victim:'Muscle Sliver', tq:[{re:'Muscle Sliver', who:'opp'}], dur:'perm', die:false});
    await stealCase('Emrakul, the World Anew', {victim:['Grizzly Bears', 'Llanowar Elves'], tq:[{re:'Kim', who:'opp'}], label:'cast trigger; leaves → sacrifice all',
      post:async () => { await leaveOn(G, 'Emrakul, the World Anew'); await after(); await sleep(800); await after(); check(await gyHas(K, 'Grizzly Bears') && await gyHas(K, 'Llanowar Elves') && !(await gyHas(G, 'Grizzly Bears')), 'Emrakul left: the stolen creatures were sacrificed into Kim\'s graveyard'); }});
    await stealCase('Dihada, Binder of Wills', {how:'custom', victim:['Grizzly Bears', 'Mind Stone'], haste:true, act:async () => { await putBf(G, 'Dihada, Binder of Wills', {co:11}); return G.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Dihada, Binder of Wills'); const i = loyaltyAbs(c).findIndex(a => /gain control/i.test(a.eff)); if (i < 0) return 'no -11'; await activateLoyalty(c, i); return 'ok'; }); }, dur:'eot'});
    await stealCase('Seize the Spotlight', {how:'custom', haste:true, act:async () => { await K.evaluate(() => { window.__want = 'fame'; }); const r = await cast(G, 'Seize the Spotlight'); return r; }, dur:'eot', post:async () => K.evaluate(() => { window.__want = null; })});
    await stealCase('Thieving Skydiver', {how:'custom', victim:'Mind Stone', use:false, act:async () => { await G.evaluate(() => { window.__num = 2; window.__want = '^2 time'; }); return cast(G, 'Thieving Skydiver', {x:2}); }, dur:'perm', die:false});
    await stealCase('Tergrid, God of Fright', {how:'custom', victim:'Mind Stone', use:false, act:async () => { await putBf(G, "Tergrid, God of Fright // Tergrid's Lantern"); await sleep(800); await K.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Mind Stone'); sacrificeOne(c); commit(); }); return 'ok'; },
      post:async () => { await destroyOn(G, 'Mind Stone'); await after(); check(await gyHas(K, 'Mind Stone') && !(await gyHas(G, 'Mind Stone')), 'Tergrid: the taken Mind Stone dies → Kim\'s graveyard (she owns it)'); }});
    await stealCase('Homeward Path', {how:'custom', act:async () => { await cast(G, 'Agent of Treachery'); await after(); await putBf(K, 'Homeward Path'); await sleep(600); return 'ok'; }, label:'Kim activates it',
      post:async () => { await K.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Homeward Path'); const ab = abilityList(c).find(a => /gains control/i.test(a.eff)); await activateAbility(c, ab); }); await after(); await sleep(1000); await after(); await expectCtl('Grizzly Bears', 'Kim', 'Kim', 'Homeward Path (Kim): Kim gets her Bears back from Georges'); }});
    await step('Ragavan / Thada Adel / Grenzo: combat damage → cast a card from Kim\'s library', async () => {
      for (const [card, top, mode] of [['Ragavan, Nimble Pilferer', 'Lightning Bolt'], ['Thada Adel, Acquisitor', 'Sol Ring'], ['Grenzo, Havoc Raiser', 'Lightning Bolt', 'Exile']]){
        await fresh(); await K.evaluate(t => { const a = [...DICT.values()].find(a => a.n === t); S.lib.unshift({id:S.nid++, k:a.k}); commit(); }, top); await putBf(G, card); await sleep(800);
        if (mode) await want(G, mode); else await want(G, top); await hit(G, card); await after(); await sleep(1200); await after();
        const ex = await G.evaluate(() => S.ex.map(c => ({n:cname(c), own:c.own ? nameOf(c.own.pid) : '', play:!!c.mayPlay})));
        check(ex.some(x => x.n === top && x.own === 'Kim' && x.play), `${card}: Georges may play Kim's ${top} from exile (${JSON.stringify(ex)})`);
        await G.evaluate(() => { window.__want = null; });
      }
    });
    await step('Opposition Agent: Kim searches → the card is exiled and Georges may play it', async () => {
      await fresh(); await putBf(G, 'Opposition Agent'); await sleep(800);
      await G.evaluate(() => { window.__want = 'Sol Ring'; }); await toMain(G);
      console.log('    rules on Kim:', await K.evaluate(() => JSON.stringify([rulesOn('r21agent'), rulesOn('r21agent2'), (OPP.get([...OPP.keys()][0]).bf || []).map(c => info(c.k)?.n)])));
      const r = await K.evaluate(async () => { const sr = [...DICT.values()].find(a => a.n === 'Sol Ring'); S.lib.splice(5, 0, {id:S.nid++, k:sr.k}); const a = [...DICT.values()].find(a => a.n === 'Demonic Tutor'); const c = {id:S.nid++, k:a.k}; S.hand.push(c); S.pool = {...emptyPool(), B:2}; commit(); await runEffects('Search your library for a card, put that card into your hand, then shuffle.', {k:a.k, name:'Demonic Tutor', full:'Search your library for a card, put that card into your hand, then shuffle.'}); commit(); return S.hand.some(x => cname(x) === 'Sol Ring'); });
      await after(); await sleep(1000);
      check(!r, 'Kim did not get the card');
      const ex = await G.evaluate(() => S.ex.filter(c => c.own).map(c => ({n:cname(c), play:!!c.mayPlay})));
      check(ex.some(x => x.n === 'Sol Ring' && x.play), `Georges may play the Sol Ring Kim found (${JSON.stringify(ex)})`);
      await G.evaluate(() => { window.__want = null; });
    });
    await step('Giving away my own: Wishclaw Talisman / Hithlain Rope / Pendant of Prosperity / Yes Man', async () => {
      await fresh(); await putBf(G, 'Wishclaw Talisman', {co:3}); await sleep(400); await want(G, 'Sol Ring');
      check(await activate(G, 'Wishclaw Talisman', 'search') === 'ok', 'Wishclaw activated'); await after(); await expectCtl('Wishclaw Talisman', 'Kim', 'Georges', 'Wishclaw Talisman: an opponent (Kim) gains control of it');
      await fresh(); await putBf(G, 'Hithlain Rope'); await sleep(400); check(await activate(G, 'Hithlain Rope', 'draw') === 'ok', 'Hithlain Rope activated'); await after(); await expectCtl('Hithlain Rope', 'Kim', 'Georges', 'Hithlain Rope: the player to the right (Kim) gains control');
      await fresh(); await cast(G, 'Pendant of Prosperity'); await after(); await expectCtl('Pendant of Prosperity', 'Kim', 'Georges', 'Pendant of Prosperity: enters under Kim\'s control');
      await fresh(); await tq(G, [{re:'Kim', who:'opp'}]); await putBf(G, 'Yes Man, Personal Securitron'); await sleep(400); const h0 = await G.evaluate(() => S.hand.length);
      check(await activate(G, 'Yes Man, Personal Securitron', 'gains control') === 'ok', 'Yes Man activated'); await after(); await sleep(800); await after();
      await expectCtl('Yes Man, Personal Securitron', 'Kim', 'Georges', 'Yes Man: Kim controls it'); check(await G.evaluate(() => S.hand.length) === h0 + 2, 'Yes Man: Georges drew two');
    });
    await step('Perplexing Chimera: Kim casts a spell, Georges exchanges the Chimera for it', async () => {
      await fresh(); await putBf(G, 'Perplexing Chimera'); await sleep(900); await want(G, 'yes|exchange'); 
      await K.evaluate(async () => { const a = [...DICT.values()].find(a => a.n === 'Opt'); const c = {id:S.nid++, k:a.k}; S.hand.push(c); S.pool = {...emptyPool(), U:3}; commit(); await beginCast(c, 'hand'); });
      await after(); await sleep(1500); await after();
      await expectCtl('Perplexing Chimera', 'Kim', 'Georges', 'Perplexing Chimera: Kim controls the Chimera');
      const d = await G.evaluate(() => S.log.slice(-15).map(e => e.s).join(' | ')); check(/Opt/.test(d), 'Georges took Kim\'s Opt');
    });

    // =================================================================== summary 2p
    const ok = Object.values(RES).filter(Boolean).length; console.log(`\n2-player cases: ${ok}/${Object.keys(RES).length} fully passed`);
    for (const [k, v] of Object.entries(RES)) if (!v) console.log('   FAILED: ' + k);
    for (const p of P2) await p.context().close();

    // =================================================================== 3-player cases
    if (!process.env.NO3){
      const RES3 = {};
      const names = ['Georges', 'Kim', 'Ana']; const P = [];
      for (let i = 0; i < 3; i++){ P.push(await H.player(browser, names[i], H.deckFor(['Edgar Markov', 'Thalia, Guardian of Thraben', 'Krenko, Mob Boss'][i]), i ? 'join' : 'host', 'r19a3')); await sleep(300); }
      for (const p of P) await waitFor(p, () => OPP.size === 2, null, 30000);
      ALL = names.map((n, i) => [n, P[i]]); const [G3, K3, A3] = P; for (const p of P) await p.evaluate(AUTO); await Promise.all(P.map(p => p.evaluate(v => { S.lib = S.lib.filter(c => !v.includes(cname(c))); commit(); }, VICT)));
      await G3.click('[data-act="goFirst"]'); await settle(P);
      const pid = {}; for (let i = 0; i < 3; i++) pid[names[i]] = await P[i].evaluate(() => MYPID);
      const toMain3 = async () => { for (let i = 0; i < 300; i++){ if (await G3.evaluate(() => phaseNow().mine && phaseNow().ph === 3 && !stackAll().length)) return true; await G3.evaluate(() => { const pn = phaseNow(); if (pn.mine && pn.ph !== 3 && !stackAll().length && !UI.modal) nextAction(); }); await pass1(P); await sleep(120); } return false; };
      await toMain3();
      const wipe3 = async () => { await Promise.all(P.map(p => p.evaluate(() => { UI.modal = null; window.__tq = []; window.__want = null; S.bf = []; S.lent = []; S.hand = []; S.gy = []; S.ex = []; S.stk = []; S.prm = []; commit(); }))); await seenEmpty(P); };
      const after3 = async () => { await sleep(200); await settle(P); await quiet(P, 800, 3000); await settle(P); await quiet(P, 300, 1500); };
      const on3 = async (nm, who, owner) => { // nm is on who's battlefield and owned by owner, seen the same by all 3 clients
        const k = await kOf(G3, nm); const wp = P[names.indexOf(who)]; const op = pid[owner];
        await waitFor(wp, ([k, op, same]) => S.bf.some(c => c.k === k && (same ? !c.own : c.own && c.own.pid === op)), [k, op, who === owner], 7000); await sleep(700);
        const views = []; for (const p of P) views.push(await p.evaluate(([k, wpid]) => { const r = {}; r[MYPID] = S.bf.filter(c => c.k === k).length; for (const [pid, st] of OPP) r[pid] = (st.bf || []).filter(c => c.k === k).length; return r; }, [k, pid[who]]));
        const good = views.every(v => Object.entries(v).every(([p, n]) => n === (p === pid[who] ? 1 : 0)));
        const w = []; for (const p of P) w.push(...await p.evaluate(k => ['bf', 'gy', 'hand', 'ex', 'cz'].flatMap(z => S[z].filter(c => c.k === k).map(c => nameOf(MYPID) + ':' + z)), k));
        check(good && w.length === 1, `${nm} is on ${who}'s battlefield (owner ${owner}) on all 3 clients (${JSON.stringify(views)} ${w})`);
      };
      const st3 = async (name, fn) => { await step(name, async () => { await wipe3(); await fn(); }); RES3[name] = RES[name]; };
      await st3('3p Shifting Loyalties: exchange two permanents both controlled by opponents (Kim ↔ Ana)', async () => {
        await putBf(K3, 'Mind Stone'); await putBf(A3, 'Darksteel Ingot'); await sleep(1000);
        await tq(G3, [{re:'Mind Stone', who:pid.Kim}, {re:'Darksteel Ingot', who:pid.Ana}]); check(await cast(G3, 'Shifting Loyalties') === 'ok', 'cast'); await after3();
        await on3('Mind Stone', 'Ana', 'Kim'); await on3('Darksteel Ingot', 'Kim', 'Ana');
      });
      await st3('3p Switcheroo: Kim\'s creature ↔ Ana\'s creature', async () => {
        await putBf(K3, 'Grizzly Bears'); await putBf(A3, 'Test Hulk'); await sleep(1000);
        await tq(G3, [{re:'Grizzly Bears', who:pid.Kim}, {re:'Test Hulk', who:pid.Ana}]); await cast(G3, 'Switcheroo'); await after3();
        await on3('Grizzly Bears', 'Ana', 'Kim'); await on3('Test Hulk', 'Kim', 'Ana');
      });
      await st3('3p Cultural Exchange: Kim\'s creature ↔ Ana\'s creature', async () => {
        await putBf(K3, 'Grizzly Bears'); await putBf(A3, 'Test Hulk'); await sleep(1000);
        await tq(G3, [{re:'Kim', who:pid.Kim}, {re:'Ana', who:pid.Ana}]); await want(G3, 'Grizzly Bears|Test Hulk|1'); await cast(G3, 'Cultural Exchange'); await after3();
        await on3('Grizzly Bears', 'Ana', 'Kim'); await on3('Test Hulk', 'Kim', 'Ana');
      });
      await st3('3p Blatant Thievery: one permanent from each opponent', async () => {
        await putBf(K3, 'Grizzly Bears'); await putBf(A3, 'Mind Stone'); await sleep(1000);
        await tq(G3, [{re:'Grizzly Bears', who:pid.Kim}, {re:'Mind Stone', who:pid.Ana}]); await cast(G3, 'Blatant Thievery'); await after3();
        await on3('Grizzly Bears', 'Georges', 'Kim'); await on3('Mind Stone', 'Georges', 'Ana');
      });
      await st3('3p Molten Primordial: one creature from each opponent until end of turn', async () => {
        await putBf(K3, 'Grizzly Bears'); await putBf(A3, 'Test Hulk'); await sleep(1000);
        await tq(G3, [{re:'Grizzly Bears', who:pid.Kim}, {re:'Test Hulk', who:pid.Ana}]); await cast(G3, 'Molten Primordial'); await after3();
        await on3('Grizzly Bears', 'Georges', 'Kim'); await on3('Test Hulk', 'Georges', 'Ana');
      });
      await st3('3p Harmless Offering to Ana; Agent of Treachery then takes it from Ana (owner stays Georges → goes home)', async () => {
        await putBf(G3, 'Test Charm'); await sleep(800); await tq(G3, [{re:'Ana', who:pid.Ana}, {re:'Test Charm', who:'me'}]); await cast(G3, 'Harmless Offering'); await after3();
        await on3('Test Charm', 'Ana', 'Georges');
        await tq(K3, [{re:'Test Charm', who:pid.Ana}]); await K3.evaluate(async () => { const a = [...DICT.values()].find(a => a.n === 'Agent of Treachery'); const c = {id:S.nid++, k:a.k}; S.hand.push(c); S.pool = {...emptyPool(), U:9, C:9}; commit(); });
        // Kim acts at instant speed? Agent is a creature: put it onto the battlefield on Kim's side to fire the ETB
        await K3.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Agent of Treachery'); moveCard(c.id, 'bf'); commit(); }); await after3(); await sleep(800); await after3();
        await on3('Test Charm', 'Kim', 'Georges');
        await K3.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Test Charm'); destroyCard(c, 'test'); commit(); }); await after3(); await sleep(800); await after3();
        const z = []; for (const p of P) z.push(await p.evaluate(() => ['bf', 'gy', 'hand', 'ex'].flatMap(k => S[k].filter(c => cname(c) === 'Test Charm').map(() => k)).join(',')));
        check(z[0] === 'gy' && !z[1] && !z[2], `destroyed under Kim (passed on by Ana) → Georges's graveyard, nowhere else (${JSON.stringify(z)})`);
        check(!(await A3.evaluate(() => S.lent.length)) && !(await G3.evaluate(() => S.lent.length)), 'no loans left on Ana or Georges');
      });
      await st3('3p Insurrection: every creature of both opponents until end of turn', async () => {
        await putBf(K3, 'Grizzly Bears'); await putBf(A3, 'Test Hulk'); await sleep(1000); await cast(G3, 'Insurrection'); await after3();
        await on3('Grizzly Bears', 'Georges', 'Kim'); await on3('Test Hulk', 'Georges', 'Ana');
        await G3.evaluate(() => passTurn()); await sleep(2000); await settle(P);
        await on3('Grizzly Bears', 'Kim', 'Kim'); await on3('Test Hulk', 'Ana', 'Ana');
      });
      const ok3 = Object.values(RES3).filter(Boolean).length; console.log(`\n3-player cases: ${ok3}/${Object.keys(RES3).length} fully passed`);
      for (const [k, v] of Object.entries(RES3)) if (!v) console.log('   FAILED: ' + k);
    }
  } catch (e){ console.log('FATAL', e); check(false, 'fatal: ' + e.message); }
  const tot = Object.keys(RES).length, okAll = Object.values(RES).filter(Boolean).length;
  console.log(`\nCASES: ${okAll}/${tot} passed in ${((Date.now() - T0) / 60000).toFixed(1)} min`);
  if (STOPPED){ console.log(`!! INCOMPLETE: ${STOPPED} — the cases after it did not run`); check(false, 'the whole file ran (' + STOPPED + ')'); }
  console.log(H.results.filter(r => r.startsWith('FAIL')).length + ' checks failed of ' + H.results.length);
  await browser.close().catch(() => {}); process.exit(0);
})();
