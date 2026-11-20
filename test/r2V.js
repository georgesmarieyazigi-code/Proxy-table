process.env.TOP = '1';
// Round 25V: long-tail gaps among ranks 3061–5010, played in a real 2-player game (Georges vs Kim)
const CC = require('./cards');
const WANT = ['Sigarda, Font of Blessings', 'Thundermane Dragon', 'Karmic Guide', 'Putrid Imp', 'Platinum Emperion', 'Grievous Wound', 'The Sound of Drums', 'Marisi, Breaker of the Coil',
  'Phyrexian Censor', 'Soulless Jailer', 'Chandra, Awakened Inferno', 'Master of Cruelties', 'Cerulean Wisps', 'Fireball', 'Treasure Chest', 'Transmute Artifact', 'Reflector Mage',
  'Fear of Sleep Paralysis', 'Harbinger of the Seas', 'Calamity of the Titans', 'Birthing Ritual', 'Creative Technique', 'Archetype of Courage', 'Elenda, Saint of Dusk', 'Hooded Hydra',
  'Mission Briefing', 'Titania, Nature\'s Force', 'Baeloth Barrityl, Entertainer', 'Hithlain Rope', 'Cyber Conversion', 'Tower Winder', 'Command Tower',
  'Llanowar Elves', 'Grizzly Bears', 'Mind Stone', 'Giant Growth', 'Lightning Bolt', 'Sol Ring', 'Wall of Omens', 'Darksteel Ingot', 'Elvish Mystic', 'Kozilek\'s Command', 'Wurmcoil Engine',
  'Ornithopter', 'Steel Overseer', 'Opt', 'Exotic Orchard', 'Forest', 'Hedron Archive', 'Inkmoth Nexus', 'Ancestral Recall', 'Healing Salve'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, put, waitFor} = H;
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { window.__want = window.__want || null; window.__tgt = window.__tgt || null; window.__num = null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ if (!window.__tgt) return; const re = new RegExp(window.__tgt, 'i'); const c = (m.cands || []).find(x => x.ok && re.test(x.nm)); if (!c) return; m.__done = 1; m.resolve([c]); closeModal(); }
    else if (m.type === 'zone'){ m.__done = 1; closeModal(); }
    else if (m.run){ m.__done = 1; const d = window.__num != null ? window.__num : (m.def ?? 1); m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const toHand = (p, n) => p.evaluate(n => { for (const z of ['lib', 'gy', 'ex', 'bf']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.hand.push(c); commit(); return c.id; } } return S.hand.find(c => cname(c) === n)?.id; }, n);
const toTop = (p, n) => p.evaluate(n => { for (const z of ['lib', 'gy', 'ex', 'hand', 'bf']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.lib.unshift(c); commit(); return true; } } return false; }, n);
const putAny = (p, n) => p.evaluate(n => { for (const z of ['lib', 'gy', 'ex', 'hand']){ const c = S[z].find(x => cname(x) === n); if (c){ if (z === 'ex'){ S.ex.splice(S.ex.indexOf(c), 1); reset(c); S.hand.push(c); } moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id); if (b) b.sk = false; commit(); return true; } } return false; }, n);
const toGy = (p, n) => p.evaluate(n => { const c = S.bf.find(x => cname(x) === n) || S.hand.find(x => cname(x) === n); if (c){ moveCard(c.id, 'gy', {quiet:true}); commit(); return true; } return false; }, n);
const cast = (p, n) => p.evaluate(async n => { const c = S.hand.find(x => cname(x) === n); if (!c) return 'not in hand'; S.pool = {...emptyPool(), W:6, U:6, B:6, R:6, G:6, C:6}; commit(); await beginCast(c, 'hand'); return S.hand.includes(c) ? 'not cast' : 'ok'; }, n);
const run = (p, txt, nm, extra) => p.evaluate(async ([txt, nm, extra]) => { const k = [...DICT.values()].find(a => a.n === nm)?.k || null; const sc = S.bf.find(c => cname(c) === nm); const ctx = {k, name:nm, full:txt, srcId:sc ? sc.id : undefined, ...(extra || {})};
  const kim = [...OPP.keys()][0];
  if (ctx.tgtKimCards){ ctx.tgts = ctx.tgtKimCards.map(n => { const c = (OPP.get(kim).bf || []).find(b => b.k && info(b.k)?.n === n); return c ? [{t:'card', pid:kim, id:c.id, k:c.k, nm:n}] : []; }); delete ctx.tgtKimCards; }
  if (ctx.tgtMine){ ctx.tgts = ctx.tgtMine.map(n => { const c = S.bf.find(b => cname(b) === n); return c ? [{t:'card', pid:MYPID, id:c.id, k:c.k, nm:n}] : []; }); delete ctx.tgtMine; }
  if (ctx.itX) ctx.it = {kind:'spell', x:ctx.itX}; if (ctx.evDpKim) ctx.it = {kind:'trigger', evDp:kim};
  await runEffects(txt, ctx); commit(); return 'ok'; }, [txt, nm, extra]);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { await T(60000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  for (const p of [PA, PB]) if (p) await p.evaluate(() => { const m = UI.modal; if (m && !m.__done){ m.__done = 1; try { m.resolve && m.resolve(m.type === 'pick' ? [] : null); } catch {} closeModal(); } });
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2v');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2v');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const life = p => p.evaluate(() => S.life);
  const has = (p, n, z = 'bf') => p.evaluate(([n, z]) => S[z].some(c => cname(c) === n), [n, z]);
  const after = async () => { await sleep(500); await settle([A, B]); await sleep(1200); await settle([A, B]); await sleep(500); };
  try {
    await step('Casting from the top of the library: Sigarda (Angels), Thundermane Dragon (power 4+, haste)', async () => {
      await putAny(A, 'Sigarda, Font of Blessings'); check(await toTop(A, 'Karmic Guide'), 'Karmic Guide is on top of Georges\'s library'); await after();
      const w = await A.evaluate(() => r23fTopWays(S.lib[0]).length); check(w >= 1, `Sigarda lets Georges cast the Angel on top (${w} way)`);
      await A.evaluate(() => { window.__tgt = '.'; }); await A.evaluate(async () => { S.pool = {...emptyPool(), W:6, C:6}; await r23fPlayTop(false); }); await after(); await A.evaluate(() => { window.__tgt = null; });
      check(await has(A, 'Karmic Guide'), 'Karmic Guide was cast from the top of the library and resolved');
      await toTop(A, 'Grizzly Bears'); check(await A.evaluate(() => r23fTopWays(S.lib[0]).length) === 0, 'Grizzly Bears (not an Angel or Human) can\'t be cast from the top');
      await toGy(A, 'Sigarda, Font of Blessings');
      await putAny(A, 'Thundermane Dragon'); await toTop(A, 'Wurmcoil Engine'); await after();
      await A.evaluate(async () => { S.pool = {...emptyPool(), C:6}; await r23fPlayTop(false); }); await after();
      const wc = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Wurmcoil Engine'); return c ? kwOf(c, 'haste') : null; });
      check(wc === true, `Wurmcoil Engine was cast from the top with Thundermane Dragon and has haste (${wc})`);
      await toTop(A, 'Llanowar Elves'); check(await A.evaluate(() => r23fTopWays(S.lib[0]).length) === 0, 'a 1-power creature can\'t be cast from the top with Thundermane');
      for (const n of ['Thundermane Dragon', 'Wurmcoil Engine', 'Karmic Guide']) await toGy(A, n);
    });
    await step('Self-conditional P/T: Putrid Imp (threshold) and Elenda (life above starting)', async () => {
      await putAny(A, 'Putrid Imp'); await after();
      const s0 = await A.evaluate(() => stats(S.bf.find(c => cname(c) === 'Putrid Imp')));
      await A.evaluate(() => { for (let i = 0; i < 8; i++){ const c = S.lib[S.lib.length - 1]; moveCard(c.id, 'gy', {quiet:true}); } commit(); });
      const s1 = await A.evaluate(() => stats(S.bf.find(c => cname(c) === 'Putrid Imp')));
      const cb = await A.evaluate(() => canBlock(S.bf.find(c => cname(c) === 'Putrid Imp'), (OPP.values().next().value.bf || [])[0] || {k:S.bf[0].k}, [...OPP.keys()][0]));
      check(s1[0] === s0[0] + 1 && s1[1] === s0[1] + 1 && /can't block/.test(cb), `Putrid Imp ${s0.join('/')} → ${s1.join('/')} with 7+ cards in graveyard and can't block (${cb})`);
      await putAny(A, 'Elenda, Saint of Dusk'); await A.evaluate(() => { S.life = 52; commit(); });
      const e = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Elenda, Saint of Dusk'); return {st:stats(c), men:kwOf(c, 'menace')}; });
      check(e.st[0] === 10 && e.st[1] === 10 && e.men, `Elenda at 52 life (starting 40) is ${e.st.join('/')} with menace`);
      await A.evaluate(() => { S.life = 40; commit(); }); await toGy(A, 'Putrid Imp'); await toGy(A, 'Elenda, Saint of Dusk');
    });
    await step('Life: Platinum Emperion locks Georges\'s life; Grievous Wound stops Kim gaining life', async () => {
      await putAny(A, 'Platinum Emperion'); await after(); const L0 = await life(A);
      await toHand(B, 'Lightning Bolt'); await B.evaluate(() => { window.__tgt = 'Georges'; }); await B.evaluate(async () => { S.pool = {...emptyPool(), R:3}; const c = S.hand.find(x => cname(x) === 'Lightning Bolt'); await beginCast(c, 'hand'); }); await after(); await B.evaluate(() => { window.__tgt = null; });
      check(await life(A) === L0, `Lightning Bolt didn't change Georges's life (${L0} → ${await life(A)})`);
      await toGy(A, 'Platinum Emperion'); await after();
      await A.evaluate(() => { window.__want = 'Kim'; const c = S.lib.find(x => cname(x) === 'Grievous Wound') || S.hand.find(x => cname(x) === 'Grievous Wound'); moveCard(c.id, 'bf', {quiet:true}); commit(); }); await after();
      await A.evaluate(() => { window.__want = null; const c = S.bf.find(x => cname(x) === 'Grievous Wound'); c.att = {pid:[...OPP.keys()][0], id:null}; commit(); }); await sleep(800);
      const k0 = await life(B); await B.evaluate(() => { gainLife(5, 'test'); commit(); }); await sleep(300);
      check(await life(B) === k0, `Kim can't gain life while enchanted by Grievous Wound (${k0} → ${await life(B)}) ${await B.evaluate(() => JSON.stringify([...OPP.values()][0].bf.filter(b => b.k && /Grievous/.test(info(b.k)?.n || '')).map(b => ({att:b.att, t:v25txt(b).slice(0, 60)}))))}`);
      await toGy(A, 'Grievous Wound');
    });
    await step('Static goad: The Sound of Drums on Kim\'s creature; Baeloth goads Kim\'s small creatures', async () => {
      await putAny(B, 'Grizzly Bears'); await after();
      await A.evaluate(() => { const kim = [...OPP.keys()][0]; const g = OPP.get(kim).bf.find(b => b.k && info(b.k)?.n === 'Grizzly Bears'); const c = S.lib.find(x => cname(x) === 'The Sound of Drums') || S.hand.find(x => cname(x) === 'The Sound of Drums'); moveCard(c.id, 'bf', {quiet:true}); c.att = {pid:kim, id:g.id}; commit(); }); await after(); await B.evaluate(() => commit()); await sleep(300);
      const g = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); return c && c.goad && goadOn(c) && mustAttack(c); });
      check(g === true, 'Kim\'s Grizzly Bears is goaded (must attack) while enchanted by The Sound of Drums');
      await toGy(A, 'The Sound of Drums'); await after(); await B.evaluate(() => commit());
      check(await B.evaluate(() => !S.bf.find(x => cname(x) === 'Grizzly Bears').goad), 'the goad ends when the Aura leaves');
      await putAny(A, 'Baeloth Barrityl, Entertainer'); await after(); await B.evaluate(() => commit());
      await putAny(B, 'Elvish Mystic'); await after(); await B.evaluate(() => commit()); await sleep(300);
      const r = await B.evaluate(() => ({bears:!!S.bf.find(x => cname(x) === 'Grizzly Bears').goad, mystic:!!S.bf.find(x => cname(x) === 'Elvish Mystic').goad}));
      check(r.mystic && !r.bears, `Baeloth (power 2) goads Kim's Elvish Mystic (power 1) but not Grizzly Bears (power 2) (${JSON.stringify(r)})`);
      await toGy(A, 'Baeloth Barrityl, Entertainer'); await toGy(B, 'Elvish Mystic'); await toGy(B, 'Grizzly Bears');
    });
    await step('Casting restrictions: Marisi (no spells during combat), Phyrexian Censor, Reflector Mage', async () => {
      await putAny(A, 'Marisi, Breaker of the Coil'); await after();
      await A.evaluate(() => { S.ph = [S.ph[0], S.ph[1], 4]; commit(); }); await sleep(600);
      await toHand(B, 'Giant Growth'); const why = await B.evaluate(() => castLimit(S.hand.find(c => cname(c) === 'Giant Growth'), 'hand').why || 'ok');
      check(/during combat/.test(why), `Kim can't cast Giant Growth during Georges's combat (${why})`);
      await A.evaluate(() => { S.ph = [S.ph[0], S.ph[1], 3]; commit(); }); await sleep(600); await toGy(A, 'Marisi, Breaker of the Coil');
      await putAny(A, 'Phyrexian Censor'); await after(); await putAny(B, 'Llanowar Elves'); await after();
      check(await B.evaluate(() => S.bf.find(c => cname(c) === 'Llanowar Elves')?.tap === true), 'Kim\'s non-Phyrexian Llanowar Elves entered tapped (Phyrexian Censor)');
      await toGy(A, 'Phyrexian Censor');
      await A.evaluate(() => { window.__tgt = 'Llanowar'; }); await toHand(A, 'Reflector Mage'); check(await cast(A, 'Reflector Mage') === 'ok', 'cast Reflector Mage'); await after(); await A.evaluate(() => { window.__tgt = null; });
      check(await has(B, 'Llanowar Elves', 'hand'), 'Llanowar Elves returned to Kim\'s hand');
      const w2 = await B.evaluate(() => castLimit(S.hand.find(c => cname(c) === 'Llanowar Elves'), 'hand').why || 'ok');
      check(/can't cast spells named Llanowar Elves/.test(w2), `Kim can't cast Llanowar Elves until Georges's next turn (${w2})`);
      await toGy(A, 'Reflector Mage');
    });
    await step('Soulless Jailer stops Kim reanimating; Calamity of the Titans exiles low mana values on both sides', async () => {
      await putAny(A, 'Soulless Jailer'); await after(); await toGy(B, 'Grizzly Bears');
      await B.evaluate(() => { const c = S.gy.find(x => cname(x) === 'Grizzly Bears'); moveCard(c.id, 'bf'); commit(); }); await sleep(300);
      check(await has(B, 'Grizzly Bears', 'gy'), 'Kim\'s Grizzly Bears could not enter the battlefield from the graveyard');
      await toGy(A, 'Soulless Jailer'); await putAny(B, 'Wall of Omens'); await putAny(A, 'Llanowar Elves'); await toHand(A, 'Wurmcoil Engine'); await after();
      await toHand(A, 'Calamity of the Titans'); await A.evaluate(() => { window.__want = 'Wurmcoil'; }); check(await cast(A, 'Calamity of the Titans') === 'ok', 'cast Calamity of the Titans'); await after(); await A.evaluate(() => { window.__want = null; });
      check(!(await has(B, 'Wall of Omens')) && !(await has(A, 'Llanowar Elves')), 'Wall of Omens (Kim) and Llanowar Elves (Georges) were exiled (mana value < 6)');
    });
    await step('Damage: Chandra −3 hits non-Elementals; Fireball splits X evenly; Master of Cruelties sets life to 1', async () => {
      await putAny(B, 'Grizzly Bears'); await putAny(A, 'Elvish Mystic'); await after();
      await run(A, '~ deals 3 damage to each non-Elemental creature.', 'Chandra, Awakened Inferno'); await after();
      check(!(await has(B, 'Grizzly Bears')) && !(await has(A, 'Elvish Mystic')), 'Chandra −3 killed Kim\'s Grizzly Bears and Georges\'s Elvish Mystic');
      await putAny(B, 'Wall of Omens'); await putAny(B, 'Grizzly Bears'); await after();
      await run(A, '~ deals X damage divided evenly, rounded down, among any number of targets.', 'Fireball', {itX:5, tgtKimCards:['Wall of Omens', 'Grizzly Bears']}); await after();
      const r = await B.evaluate(() => ({w:S.bf.find(c => cname(c) === 'Wall of Omens')?.dmg || 0, g:S.bf.some(c => cname(c) === 'Grizzly Bears')}));
      check(r.w === 2 && !r.g, `Fireball X=5 on two targets: 2 damage each (Wall ${r.w} damage, Bears dead=${!r.g})`);
      await run(A, 'Whenever this creature attacks a player and isn\'t blocked, that player\'s life total becomes 1.', 'Master of Cruelties', {evDpKim:true}); await sleep(300);
      await run(A, 'That player\'s life total becomes 1.', 'Master of Cruelties', {evDpKim:true}); await after();
      check(await life(B) === 1, `Kim's life total became 1 (${await life(B)})`); await B.evaluate(() => { S.life = 40; commit(); });
    });
    await step('Colour change and face down: Cerulean Wisps, Cyber Conversion', async () => {
      await A.evaluate(() => { window.__tgt = 'Wall'; }); await toHand(A, 'Cerulean Wisps'); check(await cast(A, 'Cerulean Wisps') === 'ok', 'cast Cerulean Wisps'); await after();
      const col = await A.evaluate(() => { const kim = [...OPP.keys()][0]; const c = OPP.get(kim).bf.find(b => b.k && info(b.k)?.n === 'Wall of Omens'); return typeof l24colorOf === 'function' ? l24colorOf(c) : (c.lx || []).map(x => x.col).join(''); });
      check(/U/.test(String(col)), `Kim's Wall of Omens is blue until end of turn (${col})`);
      await B.evaluate(() => { S.bf.forEach(c => { c.dmg = 0; }); commit(); }); await sleep(500);   // the Wall still has 2 damage from Fireball; a 2/2 face-down with 2 damage would rightly die (CR 120.6)
      await toHand(A, 'Cyber Conversion'); check(await cast(A, 'Cyber Conversion') === 'ok', 'cast Cyber Conversion'); await after(); await A.evaluate(() => { window.__tgt = null; });
      const fd = await B.evaluate(() => { const c = S.bf.find(x => x.fd); return c ? stats(c) : null; });
      check(fd && fd[0] === 2 && fd[1] === 2, `Kim's Wall of Omens is face down as a 2/2 (${JSON.stringify(fd)}) ${fd ? '' : await B.evaluate(() => S.log.slice(-4).map(e => e.s).join(' | ')) + ' // ' + await A.evaluate(() => S.log.slice(-6).map(e => e.s).join(' | '))}`);
    });
    await step('Stun counters: a stunned creature stays tapped; Fear of Sleep Paralysis keeps the counter on', async () => {
      await putAny(B, 'Grizzly Bears'); await after();
      await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); c.tap = true; addNamed(c, 'stun', 1); commit(); });
      await B.evaluate(() => { const was = currentTurn; S.ph = [0, 99, 0]; setPhase(0); }); await sleep(300);
      const r1 = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); return {tap:c.tap, stun:(c.nc || {}).stun || 0}; });
      check(r1.tap && r1.stun === 0, `untap step: Grizzly Bears stayed tapped and lost its stun counter (${JSON.stringify(r1)})`);
      await A.evaluate(() => { window.__tgt = 'Grizzly'; }); await putAny(A, 'Fear of Sleep Paralysis'); await after(); await A.evaluate(() => { window.__tgt = null; });
      await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); addNamed(c, 'stun', 1); commit(); }); await B.evaluate(() => { setPhase(0); }); await sleep(300);
      const r2 = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); return {tap:c.tap, stun:(c.nc || {}).stun || 0}; });
      check(r2.tap && r2.stun === 1, `with Fear of Sleep Paralysis the stun counter can't be removed (${JSON.stringify(r2)})`);
      await toGy(A, 'Fear of Sleep Paralysis'); await toGy(B, 'Grizzly Bears');
    });
    await step('Harbinger of the Seas: Kim\'s nonbasic land taps for {U} only; Archetype of Courage removes Kim\'s first strike', async () => {
      await putAny(B, 'Exotic Orchard'); await putAny(A, 'Harbinger of the Seas'); await after();
      const m = await B.evaluate(() => manaAbs(S.bf.find(c => cname(c) === 'Exotic Orchard')).map(a => a.outs.map(o => o.join('')).join('/')));
      check(m.length === 1 && m[0] === 'U', `Exotic Orchard makes only {U} (${JSON.stringify(m)})`); await toGy(A, 'Harbinger of the Seas');
      await putAny(B, 'Steel Overseer'); await putAny(A, 'Archetype of Courage'); await after();
      const fs = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Steel Overseer'); c.ekw = ['first strike']; return kwOf(c, 'first strike'); });
      const mine = await A.evaluate(() => kwOf(S.bf.find(x => cname(x) === 'Archetype of Courage'), 'first strike'));
      check(fs === false && mine === true, `Kim's creature can't have first strike (${fs}); Georges's creatures do (${mine})`); await toGy(A, 'Archetype of Courage');
    });
    await step('Platinum-like "can\'t be sacrificed": Hithlain Rope', async () => {
      await putAny(A, 'Hithlain Rope'); await after(); await A.evaluate(() => { sacrificeOne(S.bf.find(c => cname(c) === 'Hithlain Rope')); commit(); });
      check(await has(A, 'Hithlain Rope'), 'Hithlain Rope could not be sacrificed');
    });
    await step('Whole abilities: Treasure Chest (20), Transmute Artifact, Tower Winder, Creative Technique, Birthing Ritual', async () => {
      await A.evaluate(() => { window.__want = 'Hedron Archive'; });
      await run(A, 'Search your library for a card. If it\'s an artifact card, you may put it onto the battlefield. Otherwise, put that card into your hand. Then shuffle.', 'Treasure Chest'); await after();
      check(await has(A, 'Hedron Archive'), 'Treasure Chest (20): found Hedron Archive and put it onto the battlefield');
      await putAny(A, 'Ornithopter'); await A.evaluate(() => { window.__want = 'Ornithopter|Wurmcoil'; });
      await toHand(A, 'Transmute Artifact'); await A.evaluate(() => { const i = S.bf.findIndex(c => cname(c) === 'Hedron Archive'); if (i >= 0) moveCard(S.bf[i].id, 'gy', {quiet:true}); commit(); });
      await A.evaluate(() => { const c = S.gy.find(x => cname(x) === 'Wurmcoil Engine') || S.bf.find(x => cname(x) === 'Wurmcoil Engine') || S.hand.find(x => cname(x) === 'Wurmcoil Engine') || S.ex.find(x => cname(x) === 'Wurmcoil Engine'); if (c){ const z = find(c.id)[0]; S[z].splice(S[z].indexOf(c), 1); reset(c); S.lib.push(c); } commit(); });
      check(await cast(A, 'Transmute Artifact') === 'ok', 'cast Transmute Artifact'); await A.evaluate(() => { S.pool = {...emptyPool(), C:6}; commit(); }); await after();
      const tr = await A.evaluate(() => ({orn:S.gy.some(c => cname(c) === 'Ornithopter'), wurm:S.bf.some(c => cname(c) === 'Wurmcoil Engine') ? 'bf' : S.gy.some(c => cname(c) === 'Wurmcoil Engine') ? 'gy' : '?'}));
      check(tr.orn && (tr.wurm === 'bf' || tr.wurm === 'gy'), `Transmute Artifact sacrificed Ornithopter and Wurmcoil Engine went to the ${tr.wurm} (paid the difference or not)`);
      await A.evaluate(() => { window.__want = null; });
      await toGy(A, 'Command Tower'); await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Command Tower') || S.hand.find(x => cname(x) === 'Command Tower'); if (c){ moveCard(c.id, 'gy', {quiet:true}); commit(); } });
      await putAny(A, 'Tower Winder'); await after();
      check(await has(A, 'Command Tower', 'hand'), 'Tower Winder put Command Tower into Georges\'s hand');
      await A.evaluate(() => { window.__tgt = '.'; window.__want = '^No$'; }); const lib0 = await A.evaluate(() => S.lib.length); await toHand(A, 'Creative Technique'); check(await cast(A, 'Creative Technique') === 'ok', 'cast Creative Technique'); await after();
      const ct = await A.evaluate(() => S.log.slice(-12).map(e => e.s).join(' | ')); check(/revealed \d+ card/.test(ct), 'Creative Technique revealed until a nonland card and offered it for free');
      const ex = await A.evaluate(() => S.log.slice(-8).map(e => e.s).find(x => /Creative Technique: revealed/.test(x)) || ''); const nm = (ex.match(/exiled (.+?);/) || [])[1];
      if (nm) check(await has(A, nm, 'ex'), `declined the free cast: ${nm} stays in exile`);
      await A.evaluate(() => { window.__tgt = null; window.__want = null; }); await putAny(A, 'Grizzly Bears'); await putAny(A, 'Birthing Ritual'); await toTop(A, 'Steel Overseer'); await A.evaluate(() => { window.__want = 'Grizzly|Sacrifice|Steel'; });
      await run(A, 'Look at the top seven cards of your library. Then you may sacrifice a creature. If you do, you may put a creature card with mana value X or less from among those cards onto the battlefield, where X is 1 plus the sacrificed creature\'s mana value. Put the rest on the bottom of your library in a random order.', 'Birthing Ritual'); await after();
      await A.evaluate(() => { window.__want = null; });
      console.log('    bf:', await A.evaluate(() => S.bf.map(cname).join(', ')), '// gy:', await A.evaluate(() => S.gy.slice(-4).map(cname).join(', ')));
      check(await has(A, 'Steel Overseer') && !(await has(A, 'Grizzly Bears')), 'Birthing Ritual: sacrificed Grizzly Bears (MV 2) and put Steel Overseer (MV 2 ≤ 3) onto the battlefield');
    });
    await step('Hooded Hydra turned face up gets five +1/+1 counters; Mission Briefing lets you cast from the graveyard', async () => {
      await A.evaluate(() => { const c = ['lib', 'hand', 'gy', 'ex'].map(z => S[z].find(x => cname(x) === 'Hooded Hydra')).find(Boolean); const z = find(c.id)[0]; S[z].splice(S[z].indexOf(c), 1); c.fd = true; c.fdc = 1; S.bf.push(c); S.pool = {...emptyPool(), G:6, C:6}; commit(); turnFaceUp(c); }); await after();
      check(await A.evaluate(() => S.bf.find(c => cname(c) === 'Hooded Hydra')?.cp) === 5, 'Hooded Hydra has five +1/+1 counters after turning face up');
      await A.evaluate(() => { const c = ['hand', 'lib', 'ex'].map(z => S[z].find(x => cname(x) === 'Opt')).find(Boolean); if (c) moveCard(c.id, 'gy', {quiet:true}); commit(); });
      await A.evaluate(() => { window.__want = 'Opt'; }); await toHand(A, 'Mission Briefing'); check(await cast(A, 'Mission Briefing') === 'ok', 'cast Mission Briefing'); await after(); await A.evaluate(() => { window.__want = null; });
      const g = await A.evaluate(() => { const c = S.gy.find(x => cname(x) === 'Opt'); return c ? gyOptions(c).map(o => o.label + '|' + o.after) : []; });
      check(g.some(x => /Mission Briefing/.test(x) && /\|ex$/.test(x)), `Opt can be cast from the graveyard this turn, exiled afterwards (${JSON.stringify(g)})`);
    });
    await step('Titania: Forests can be played from the graveyard', async () => {
      await putAny(A, 'Titania, Nature\'s Force'); await A.evaluate(() => { const c = S.lib.find(x => cname(x) === 'Forest'); moveCard(c.id, 'gy', {quiet:true}); commit(); });
      const g = await A.evaluate(() => { const c = S.gy.find(x => cname(x) === 'Forest'); return gyOptions(c).map(o => o.kind); });
      check(g.includes('gyland'), `Forest in the graveyard has a "play land" option (${JSON.stringify(g)})`);
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
