process.env.TOP = '1';
// Round 25W: long-tail cards (ranks 5011–6999) played in a real 2-player game (Georges vs Kim)
const CC = require('./cards');
const WANT = ['Arwen, Mortal Queen', 'Infesting Radroach', 'Genesis', 'Lightning Runner', "Valkyrie's Call", 'Rakdos, the Muscle', 'Doomsday', 'Batwing Brume', 'Wolverine, Best There Is',
  'Mutagen Man, Living Ooze', 'Evercoat Ursine', 'Will, Scion of Peace', 'Fallaji Wayfarer', 'Hithlain Rope', 'Angel of Jubilation', 'Sigarda, Host of Herons', 'Eternal Scourge', 'Instill Energy',
  'Wild Ride', 'Dig Up', 'The Master of Keys', 'Iroh, Grand Lotus', 'Rhet-Tomb Mystic', 'Zuko, Firebending Master', 'Watchful Radstag', 'Mindblade Render', 'Mikey & Leo, Chaos & Order',
  'Earthshape', 'Rocco, Street Chef', 'Kellan, the Kid', 'Oona, Queen of the Fae', 'Observed Stasis', 'Disorder in the Court', 'Omnath, Locus of All', 'Varchild, Betrayer of Kjeldor', 'Soul Immolation',
  'Halo Forager', 'Xolatoyac, the Smiling Flood', 'Grizzly Bears', 'Llanowar Elves', 'Giant Growth', 'Lightning Bolt', 'Mind Stone', 'Elvish Mystic', 'Wall of Omens', 'Darksteel Ingot', 'Swords to Plowshares', 'Counterspell', 'Pacifism', 'Serra Angel', 'Craterhoof Behemoth'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
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
const toZone = (p, n, z) => p.evaluate(([n, z]) => { for (const y of ['lib', 'hand', 'gy', 'ex', 'bf']){ const i = S[y].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[y].splice(i, 1); reset(c); S[z].push(c); commit(); return c.id; } } return null; }, [n, z]);
const cast = (p, n, pool) => p.evaluate(async ([n, pool]) => { const c = S.hand.find(x => cname(x) === n); if (!c) return 'not in hand'; S.pool = {...emptyPool(), ...(pool || {W:6, U:6, B:6, R:6, G:6, C:6})}; commit(); await beginCast(c, 'hand'); return S.hand.includes(c) ? 'not cast' : 'ok'; }, [n, pool]);
const toGy = (p, n) => p.evaluate(n => { const c = S.bf.find(x => cname(x) === n); if (c){ moveCard(c.id, 'gy', {quiet:true}); commit(); return true; } return false; }, n);
const activate = (p, n, re) => p.evaluate(async ([n, re]) => { const c = S.bf.find(x => cname(x) === n); if (!c) return 'missing'; c.sk = false; c.tap = false; S.pool = {...emptyPool(), W:6, U:6, B:6, R:6, G:6, C:6}; const ab = abilityList(c).find(a => new RegExp(re, 'i').test(a.eff)); if (!ab) return 'no ability'; await activateAbility(c, ab); return 'ok'; }, [n, re]);
const run = (p, txt, nm, extra) => p.evaluate(async ([txt, nm, extra]) => { const k = [...DICT.values()].find(a => a.n === nm)?.k || null; const src = S.bf.find(c => c.k === k) || S.gy.find(c => c.k === k); const ctx = {k, name:nm, full:txt, srcId:src ? src.id : null, ...(extra || {})}; if (ctx.tgtKim){ const [pid] = [...OPP.keys()]; ctx.tgts = [[{t:'player', pid, nm:nameOf(pid)}]]; } if (ctx.itX != null) ctx.it = {kind:'ability', x:ctx.itX}; await runEffects(txt, ctx); commit(); return 'ok'; }, [txt, nm, extra]);
if (process.env.W2DBG) process.on('unhandledRejection', e => console.log('UR', e));
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { await T(60000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2w');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2w');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO); await A.evaluate(() => { window.__toasts = []; const t0 = toast; toast = (m, ...a) => { window.__toasts.push(String(m)); return t0(m, ...a); }; });
  const life = p => p.evaluate(() => S.life);
  const cnt = (p, re) => p.evaluate(re => S.bf.filter(c => new RegExp(re).test(cname(c))).reduce((a, c) => a + (c.n || 1), 0), re);
  const card = (p, n) => p.evaluate(n => { const c = S.bf.find(x => cname(x) === n); return c ? {cp:c.cp || 0, nc:c.nc || {}, tap:!!c.tap, regen:c.regen || 0} : null; }, n);
  const after = async () => { await sleep(500); await settle([A, B]); await sleep(1200); await settle([A, B]); await sleep(500); };
  const hand = p => p.evaluate(() => S.hand.length);
  try {
    await step('Arwen enters with an indestructible counter; her ability gives counters to both', async () => {
      await put(A, 'Arwen, Mortal Queen'); await put(A, 'Grizzly Bears'); await after();
      let a = await card(A, 'Arwen, Mortal Queen'); check((a.nc.indestructible || 0) === 1, `Arwen has an indestructible counter (${JSON.stringify(a.nc)})`);
      await A.evaluate(() => { window.__tgt = 'Grizzly'; }); check(await activate(A, 'Arwen, Mortal Queen', 'indestructible') === 'ok', 'activated Arwen'); await after(); await A.evaluate(() => { window.__tgt = null; });
      a = await card(A, 'Arwen, Mortal Queen'); const g = await card(A, 'Grizzly Bears');
      check(a.cp === 1 && (a.nc.lifelink || 0) === 1 && g.cp === 1 && (g.nc.lifelink || 0) === 1, `+1/+1 and lifelink counters on both (Arwen ${a.cp}/${JSON.stringify(a.nc)}, Bears ${g.cp}/${JSON.stringify(g.nc)})`);
      await toGy(A, 'Arwen, Mortal Queen'); await toGy(A, 'Grizzly Bears');
    });
    await step('Graveyard triggers: Infesting Radroach returns when Kim mills a nonland card; Genesis works from the graveyard', async () => {
      await toZone(A, 'Infesting Radroach', 'gy'); await after();
      await B.evaluate(() => { const i = S.lib.findIndex(c => !isLand(c.k)); const [c] = S.lib.splice(i, 1); S.lib.unshift(c); mill(1); commit(); }); await after();
      check(await A.evaluate(() => S.hand.some(c => cname(c) === 'Infesting Radroach')), 'Infesting Radroach returned from the graveyard to Georges\'s hand');
      await toZone(A, 'Genesis', 'gy'); await toZone(A, 'Grizzly Bears', 'gy'); await A.evaluate(() => { window.__tgt = 'Grizzly'; S.pool = {...emptyPool(), G:3}; });
      await A.evaluate(() => fireSteps('upkeep', MYPID)); await after(); await A.evaluate(() => { window.__tgt = null; });
      check(await A.evaluate(() => S.hand.some(c => cname(c) === 'Grizzly Bears')), 'Genesis (in the graveyard) paid {2}{G} and returned Grizzly Bears to hand');
      const onBf = await A.evaluate(() => { const c = S.gy.find(x => cname(x) === 'Genesis'); moveCard(c.id, 'bf', {quiet:true}); const n0 = S.stk.length; fireSteps('upkeep', MYPID); const n1 = S.stk.length; moveCard(c.id, 'gy', {quiet:true}); commit(); return n1 - n0; });
      check(onBf === 0, 'Genesis on the battlefield does not trigger its graveyard ability');
    });
    await step('Lightning Runner pays eight energy', async () => {
      await put(A, 'Lightning Runner'); await A.evaluate(() => { addPC('energy', 6); commit(); }); await after();
      await run(A, 'You get {E}{E}, then you may pay eight {E}. If you pay, untap all creatures you control, and after this phase, there is an additional combat phase.', 'Lightning Runner'); await after();
      check(await A.evaluate(() => (S.pc || {}).energy || 0) === 0, 'paid eight energy (6 + 2 → 0)');
      await run(A, 'You get {E}{E}, then you may pay eight {E}.', 'Lightning Runner'); await after();
      check(await A.evaluate(() => (S.pc || {}).energy || 0) === 2, 'with only 2 energy nothing is paid');
      await toGy(A, 'Lightning Runner');
    });
    await step("Valkyrie's Call returns a dying creature as a flying Angel with a +1/+1 counter", async () => {
      await put(A, "Valkyrie's Call"); await put(A, 'Grizzly Bears'); await after();
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); c.dmg = 5; sba(); commit(); }); await after();
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); return c ? {cp:c.cp || 0, fly:kwOf(c, 'flying'), angel:/Angel/.test(typeOf(c))} : null; });
      check(r && r.cp === 1 && r.fly && r.angel, `Grizzly Bears came back with a counter, flying and Angel (${JSON.stringify(r)})`);
      await toGy(A, "Valkyrie's Call"); await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); if (c) moveCard(c.id, 'gy', {quiet:true}); commit(); });
    });
    await step('Rakdos, the Muscle: sacrificing exiles cards from Kim\'s library that Georges may play', async () => {
      await put(A, 'Rakdos, the Muscle'); await put(A, 'Wall of Omens'); await after();
      await A.evaluate(() => { window.__tgt = 'Kim'; }); const e0 = await B.evaluate(() => S.ex.length);
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Wall of Omens'); sacrificeOne(c); commit(); }); await after(); await sleep(1500); await settle([A, B]); await A.evaluate(() => { window.__tgt = null; });
      const e1 = await B.evaluate(() => S.ex.length); const lent = await A.evaluate(() => S.ex.filter(c => c.own && c.mayPlay).length);
      check(e1 - e0 === 2 && lent === 2, `Wall of Omens (mana value 2) → 2 cards exiled from Kim's library, playable by Georges (${e1 - e0}, ${lent})`);
      await toGy(A, 'Rakdos, the Muscle');
    });
    await step('Doomsday builds a five-card library and costs half the life', async () => {
      await toHand(A, 'Doomsday'); const l0 = await life(A); check(await cast(A, 'Doomsday') === 'ok', 'cast Doomsday'); await after();
      const r = await A.evaluate(() => ({lib:S.lib.length, gy:S.gy.length, life:S.life}));
      check(r.lib === 5 && r.life === l0 - Math.ceil(l0 / 2), `library is 5 cards, life ${l0} → ${r.life} (${JSON.stringify(r)})`);
      await A.evaluate(() => { const ex = S.ex.filter(c => !c.own); ex.forEach(c => { S.ex.splice(S.ex.indexOf(c), 1); S.lib.push(c); }); S.life = 40; commit(); });
    });
    await step('Batwing Brume with {B}: each player loses 1 life per attacking creature', async () => {
      await put(A, 'Grizzly Bears'); await put(A, 'Llanowar Elves'); await A.evaluate(() => { S.bf.filter(c => /Grizzly|Llanowar/.test(cname(c))).forEach(c => { c.atk = 'x'; }); commit(); });
      await toHand(A, 'Batwing Brume'); const l0 = await life(A); check(await cast(A, 'Batwing Brume', {B:2, C:1}) === 'ok', 'cast Batwing Brume with black mana'); await after();
      check(await life(A) === l0 - 2, `Georges (2 attackers) lost 2 life (${l0} → ${await life(A)})`);
      await A.evaluate(() => { S.bf.forEach(c => { c.atk = ''; }); S.life = 40; commit(); }); await toGy(A, 'Grizzly Bears'); await toGy(A, 'Llanowar Elves');
    });
    await step('Wolverine grows at the end step only after damaging another creature', async () => {
      await put(A, 'Wolverine, Best There Is'); await put(B, 'Wall of Omens'); await after();
      await A.evaluate(() => fireSteps('end', MYPID)); await after(); check((await card(A, 'Wolverine, Best There Is')).cp === 0, 'no damage dealt → no counter');
      await A.evaluate(() => { const w = S.bf.find(c => cname(c) === 'Wolverine, Best There Is'); const [pid] = [...OPP.keys()]; const t = OPP.get(pid).bf.find(c => cname(c) === 'Wall of Omens'); dealDamage({t:'card', pid, id:t.id}, 1, w.k, w); commit(); }); await after();
      await A.evaluate(() => fireSteps('end', MYPID)); await after(); check((await card(A, 'Wolverine, Best There Is')).cp === 1, 'after damaging Wall of Omens → one +1/+1 counter');
      await toGy(A, 'Wolverine, Best There Is'); await toGy(B, 'Wall of Omens');
    });
    await step('Mutagen Man creates X Mutagen tokens', async () => {
      await A.evaluate(() => { const c = S.lib.find(x => cname(x) === 'Mutagen Man, Living Ooze'); c.xv = 3; }); await put(A, 'Mutagen Man, Living Ooze'); await after();
      check(await cnt(A, '^Mutagen$') === 3, `three Mutagen tokens (${await cnt(A, '^Mutagen$')})`); await toGy(A, 'Mutagen Man, Living Ooze');
    });
    await step('Evercoat Ursine: two hideaway triggers, then plays a hidden card free', async () => {
      const e0 = await A.evaluate(() => S.ex.filter(c => c.fdEx).length); await put(A, 'Evercoat Ursine'); await after();
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Evercoat Ursine'); return {hid:(c.w25hid || []).length, fd:S.ex.filter(x => x.fdEx).length}; });
      check(r.hid === 2 && r.fd - e0 === 2, `two cards hidden (${JSON.stringify(r)})`);
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Evercoat Ursine'); const h = S.ex.find(x => x.id === c.w25hid[0]); h.k = [...DICT.values()].find(a => a.n === 'Grizzly Bears').k; commit(); });
      await A.evaluate(() => { window.__want = 'Grizzly'; }); await run(A, 'If there are cards exiled with it, you may play one of them without paying its mana cost.', 'Evercoat Ursine'); await after(); await A.evaluate(() => { window.__want = null; });
      check(await cnt(A, '^Grizzly Bears$') === 1, 'played the hidden Grizzly Bears for free'); await toGy(A, 'Evercoat Ursine'); await toGy(A, 'Grizzly Bears');
    });
    await step('Will, Scion of Peace: white/blue spells cost less by the life gained this turn', async () => {
      await A.evaluate(() => { gainLife(3, 'test'); commit(); }); await put(A, 'Will, Scion of Peace'); await after();
      check(await activate(A, 'Will, Scion of Peace', 'cost') === 'ok', 'activated Will'); await after();
      const r = await A.evaluate(() => { const k = [...DICT.values()].find(a => a.n === 'Wall of Omens').k; const sc = spellCost({id:-5, k}, 'hand'); return sc.cost.gen; });
      check(r === 0, `Wall of Omens ({1}{W}) now has generic cost ${r}`); await toGy(A, 'Will, Scion of Peace');
    });
    await step('Fallaji Wayfarer is all colors; Hithlain Rope can\'t be sacrificed', async () => {
      await put(A, 'Fallaji Wayfarer'); await put(A, 'Hithlain Rope'); await after();
      check(await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Fallaji Wayfarer'); return ['white', 'blue', 'black', 'red', 'green'].every(w => descOk(c.k, w) || (l24eff(c, MYPID) || {}).col === 'WUBRG'); }), 'Fallaji Wayfarer counts as every color');
      await A.evaluate(() => { sacrificeOne(S.bf.find(x => cname(x) === 'Hithlain Rope')); commit(); }); check(await cnt(A, '^Hithlain Rope$') === 1, 'Hithlain Rope stayed on the battlefield');
      await toGy(A, 'Fallaji Wayfarer'); await toGy(A, 'Hithlain Rope');
    });
    await step('Angel of Jubilation: neither player can pay life for costs; Sigarda stops Kim\'s edicts', async () => {
      await put(A, 'Angel of Jubilation'); await after(); await sleep(800);
      const wA = await A.evaluate(() => extraFeasible({t:'life', n:2, label:'pay 2 life'}, {id:-1})); const wB = await B.evaluate(() => extraFeasible({t:'life', n:2, label:'pay 2 life'}, {id:-1}));
      check(/can't pay life/.test(wA) && /can't pay life/.test(wB), `paying life is blocked for both players ("${wA}" / "${wB}")`); await toGy(A, 'Angel of Jubilation');
      await put(A, 'Sigarda, Host of Herons'); await put(A, 'Grizzly Bears'); await after();
      await B.evaluate(() => { const [pid] = [...OPP.keys()]; sendRq(pid, 'sac', 1, 'Fleshbag test', {d:'creature'}); commit(); }); await after();
      check(await A.evaluate(() => !(UI.modal && /sacrific/i.test(UI.modal.title || '')) && S.bf.some(c => cname(c) === 'Grizzly Bears')), 'Georges was not made to sacrifice');
      await toGy(A, 'Sigarda, Host of Herons'); await toGy(A, 'Grizzly Bears');
    });
    await step('Eternal Scourge can be cast from exile; Instill Energy lets a new creature attack', async () => {
      await toZone(A, 'Eternal Scourge', 'ex'); check(await A.evaluate(() => exWindowOk(S.ex.find(c => cname(c) === 'Eternal Scourge'))), 'Eternal Scourge is castable from exile');
      await put(A, 'Grizzly Bears'); await put(A, 'Instill Energy'); await A.evaluate(() => { const g = S.bf.find(c => cname(c) === 'Grizzly Bears'); g.sk = true; const e = S.bf.find(c => cname(c) === 'Instill Energy'); e.att = {pid:MYPID, id:g.id}; commit(); });
      check(await A.evaluate(() => canAttack(S.bf.find(c => cname(c) === 'Grizzly Bears'))) === '', 'summoning-sick Grizzly Bears can attack');
      await toGy(A, 'Instill Energy'); await toGy(A, 'Grizzly Bears');
    });
    await step('Harmonize (Wild Ride) and Cleave (Dig Up)', async () => {
      await toZone(A, 'Wild Ride', 'gy'); await put(A, 'Craterhoof Behemoth'); await after(); await A.evaluate(() => { S.bf.find(c => cname(c) === 'Craterhoof Behemoth').tap = false; commit(); });
      check(await A.evaluate(() => gyOptions(S.gy.find(c => cname(c) === 'Wild Ride')).some(g => g.kind === 'harmonize')), 'Wild Ride offers Harmonize from the graveyard');
      await A.evaluate(() => { window.__want = 'Craterhoof'; window.__tgt = 'Craterhoof'; });
      await A.evaluate(async () => { S.pool = {...emptyPool(), R:1}; const c = S.gy.find(x => cname(x) === 'Wild Ride'); const g = gyOptions(c).find(x => x.kind === 'harmonize'); await castFromGy(c, g); }); await after();
      await A.evaluate(() => { window.__want = null; window.__tgt = null; });
      const r = await A.evaluate(() => ({ex:S.ex.some(c => cname(c) === 'Wild Ride'), tap:S.bf.find(c => cname(c) === 'Craterhoof Behemoth').tap, t:window.__toasts}));
      check(r.ex && r.tap, `harmonized for {R} by tapping Craterhoof (power 5); Wild Ride exiled (${JSON.stringify(r)})`); await toGy(A, 'Craterhoof Behemoth');
      await toHand(A, 'Dig Up'); check(await A.evaluate(() => altCosts(S.hand.find(c => cname(c) === 'Dig Up')).some(a => a.w25cleave)), 'Dig Up offers its cleave cost');
      await A.evaluate(() => { window.__want = 'Cleave'; }); const h0 = await hand(A);
      await A.evaluate(async () => { S.pool = {...emptyPool(), B:2, G:1, C:1}; const c = S.hand.find(x => cname(x) === 'Dig Up'); const lib = S.lib.find(x => cname(x) === 'Lightning Bolt'); if (lib){ S.lib.splice(S.lib.indexOf(lib), 1); S.lib.push(lib); } window.__want = 'Cleave'; await beginCast(c, 'hand'); window.__want = 'Lightning Bolt'; }); await after(); await A.evaluate(() => { window.__want = null; });
      check(await A.evaluate(() => S.hand.some(c => cname(c) === 'Lightning Bolt')), 'cleaved Dig Up found a nonland card (Lightning Bolt)');
    });
    await step('Graveyard casting granted: The Master of Keys (escape), Iroh (flashback); Rhet-Tomb Mystic (cycling)', async () => {
      await put(A, 'The Master of Keys'); await put(A, 'Iroh, Grand Lotus'); await put(A, 'Rhet-Tomb Mystic'); await after();
      await toZone(A, 'Pacifism', 'gy'); await toZone(A, 'Giant Growth', 'gy');
      check(await A.evaluate(() => gyOptions(S.gy.find(c => cname(c) === 'Pacifism')).some(g => g.kind === 'escape')), 'Pacifism in the graveyard has escape');
      check(await A.evaluate(() => gyOptions(S.gy.find(c => cname(c) === 'Giant Growth')).some(g => g.kind === 'flashback' && g.mana === '{G}')), 'Giant Growth has flashback {G} during Georges\'s turn');
      await toHand(A, 'Grizzly Bears'); check(await A.evaluate(() => r21bCycles(S.hand.find(c => cname(c) === 'Grizzly Bears')).some(x => /1.*U|U.*1/i.test(x.cost.label))), 'Grizzly Bears in hand has cycling {1}{U}');
      for (const n of ['The Master of Keys', 'Iroh, Grand Lotus', 'Rhet-Tomb Mystic']) await toGy(A, n);
    });
    await step('Zuko: firebending X adds {R} per experience counter', async () => {
      await put(A, 'Zuko, Firebending Master'); await A.evaluate(() => { addPC('experience', 3); S.pool = emptyPool(); commit(); });
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Zuko, Firebending Master'); emit({type:'attack', k:c.k, id:c.id, cnt:1}); }); await after();
      check(await A.evaluate(() => S.pool.R) === 3, `added {R}{R}{R} (${await A.evaluate(() => S.pool.R)})`); await toGy(A, 'Zuko, Firebending Master');
    });
    await step('Evolve: Watchful Radstag evolves and copies itself; Mikey & Leo draw on counters', async () => {
      await put(A, 'Watchful Radstag'); await put(A, 'Mikey & Leo, Chaos & Order'); await after(); const h0 = await hand(A);
      await put(A, 'Craterhoof Behemoth'); await after(); await sleep(800); await settle([A, B]); await after();
      check(await cnt(A, '^Watchful Radstag$') === 2, `Radstag evolved and a token copy was created (${await cnt(A, '^Watchful Radstag$')})`);
      check(await hand(A) === h0 + 1, `Mikey & Leo drew once for the counter (${h0} → ${await hand(A)})`);
      await A.evaluate(() => { S.bf.filter(c => /Radstag|Mikey|Craterhoof/.test(cname(c))).forEach(c => moveCard(c.id, 'gy', {quiet:true})); commit(); });
    });
    await step('Mindblade Render draws when a Warrior deals combat damage to Kim', async () => {
      await put(A, 'Mindblade Render'); await put(A, 'Lightning Runner'); await after(); const h0 = await hand(A); const l0 = await life(A);
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Lightning Runner'); const [pid] = [...OPP.keys()]; emit({type:'cdmg', k:c.k, id:c.id, dp:pid, cnt:1, amt:2}); }); await after();
      check(await hand(A) === h0 + 1 && await life(A) === l0 - 1, `drew a card and lost 1 life (${h0}→${await hand(A)}, ${l0}→${await life(A)})`);
      await toGy(A, 'Mindblade Render'); await toGy(A, 'Lightning Runner');
    });
    await step('Earthshape gives Georges hexproof: Kim can\'t target him', async () => {
      await run(A, 'You gain hexproof until end of turn.', 'Earthshape'); await after(); await sleep(1000);
      const ok = await B.evaluate(() => { const c = targetCands({desc:'player', player:true, any:false}, {pid:MYPID}).find(x => x.t === 'player' && x.pid !== MYPID); return c ? c.ok : 'none'; });
      check(ok === false, `Kim's targeting sees Georges as hexproof (${ok})`);
    });
    await step('Rocco: each player exiles the top card and may play it', async () => {
      await run(A, 'Each player exiles the top card of their library. Until your next end step, each player may play the card they exiled this way.', 'Rocco, Street Chef'); await after(); await sleep(800);
      const a = await A.evaluate(() => S.ex.filter(c => c.mayPlay && c.mayPlay.src === 'Rocco, Street Chef').length); const b = await B.evaluate(() => S.ex.filter(c => c.mayPlay && c.mayPlay.src === 'Rocco, Street Chef').length);
      check(a === 1 && b === 1, `each player may play their exiled card (${a}, ${b})`);
    });
    await step('Kellan, the Kid: a spell cast from exile lets Georges cast a cheaper permanent free', async () => {
      await put(A, 'Kellan, the Kid'); await toHand(A, 'Grizzly Bears'); await after();
      await A.evaluate(() => { window.__want = 'Grizzly'; });
      await A.evaluate(async () => { const k = [...DICT.values()].find(a => a.n === 'Craterhoof Behemoth').k; await runEffects('You may cast a permanent spell with equal or lesser mana value from your hand without paying its mana cost. If you don\'t, you may put a land card from your hand onto the battlefield.', {k:S.bf.find(c => cname(c) === 'Kellan, the Kid').k, name:'Kellan, the Kid', srcId:S.bf.find(c => cname(c) === 'Kellan, the Kid').id, it:{kind:'trigger', evk:k}}); }); await after();
      await A.evaluate(() => { window.__want = null; });
      check(await cnt(A, '^Grizzly Bears$') === 1, 'Grizzly Bears cast for free'); await toGy(A, 'Kellan, the Kid'); await toGy(A, 'Grizzly Bears');
    });
    await step('Oona: Kim exiles the top X, Georges gets Faeries for the chosen color', async () => {
      await B.evaluate(() => { const bolt = [...DICT.values()].find(a => a.n === 'Lightning Bolt').k; S.lib.slice(0, 3).forEach(c => { c.k = bolt; }); commit(); });
      await A.evaluate(() => { window.__want = 'Red'; }); const f0 = await cnt(A, 'Faerie');
      await run(A, 'Choose a color. Target opponent exiles the top X cards of their library. For each card of the chosen color exiled this way, create a 1/1 blue and black Faerie Rogue creature token with flying.', 'Oona, Queen of the Fae', {tgtKim:true, itX:3}); await after();
      await A.evaluate(() => { window.__want = null; }); check(await cnt(A, 'Faerie') - f0 === 3, `three red cards exiled → three Faerie Rogues (${await cnt(A, 'Faerie') - f0})`);
    });
    await step('Varchild leaves: Georges gains control of all Survivors', async () => {
      await B.evaluate(async () => { await createFromText('Create two 1/1 red Survivor creature tokens', {name:'test', k:null}); commit(); }); await after();
      await run(A, 'Gain control of all Survivors.', 'Varchild, Betrayer of Kjeldor'); await after(); await sleep(1000); await settle([A, B]);
      check(await cnt(A, 'Survivor') === 2 && await cnt(B, 'Survivor') === 0, `both Survivor tokens moved to Georges (${await cnt(A, 'Survivor')})`);
    });
    await step('Halo Forager casts Lightning Bolt from the graveyard for X = 1, then exiles it', async () => {
      await put(A, 'Halo Forager'); await after(); const bolt = await toZone(A, 'Lightning Bolt', 'gy'); const l0 = await life(B);
      await A.evaluate(() => { window.__num = 1; window.__tgt = 'Kim'; S.pool = {...emptyPool(), C:1}; commit(); });
      await A.evaluate(async (id) => { const c = S.gy.find(x => x.id === id); const h = S.bf.find(x => cname(x) === 'Halo Forager'); await runEffects('You may pay {X}. When you do, you may cast target instant or sorcery card with mana value X from a graveyard without paying its mana cost. If that spell would be put into a graveyard, exile it instead.', {k:h.k, name:'Halo Forager', srcId:h.id, full:info(h.k).o, tgts:[[{t:'gy', pid:MYPID, id:c.id, k:c.k, nm:cname(c)}]], it:{kind:'trigger'}}); }, bolt);
      await after(); await A.evaluate(() => { window.__num = null; window.__tgt = null; });
      check(await life(B) === l0 - 3, `Kim took 3 from the free Lightning Bolt (${l0} → ${await life(B)})`);
      check(await A.evaluate(() => S.ex.some(c => cname(c) === 'Lightning Bolt') && !S.gy.some(c => cname(c) === 'Lightning Bolt')), 'Lightning Bolt was exiled instead of going to the graveyard');
      await toGy(A, 'Halo Forager');
    });
    await step('Xolatoyac: a land with a flood counter is an Island until the counter is gone', async () => {
      await put(A, 'Mountain'); await after(); await A.evaluate(() => { window.__tgt = 'Mountain'; });
      await put(A, 'Xolatoyac, the Smiling Flood'); await after(); await A.evaluate(() => { window.__tgt = null; });
      const land = await A.evaluate(() => { const c = S.bf.find(x => isLand(x.k) && (x.nc || {}).flood > 0); return c && c.id; });
      check(land != null, 'Xolatoyac put a flood counter on the Mountain');
      check(await A.evaluate(id => !!id && /Island/.test(typeOf(S.bf.find(c => c.id === id))), land), 'the Mountain is also an Island');
      await A.evaluate(id => { const l = S.bf.find(c => c.id === id); if (l) l.nc.flood = 0; commit(); }, land);
      check(await A.evaluate(id => !!id && !/Island/.test(typeOf(S.bf.find(c => c.id === id))), land), 'without the flood counter it is no longer an Island');
      await toGy(A, 'Xolatoyac, the Smiling Flood');
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
