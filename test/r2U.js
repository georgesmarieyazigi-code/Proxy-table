process.env.TOP = '1';
// Round 25U: long-tail cards of EDHREC ranks 0–3060, played in a real 2-player game (Georges vs Kim)
const CC = require('./cards');
const WANT = ['Spelunking', 'Hidden Courtyard', 'Shared Animosity', 'Llanowar Elves', 'Elvish Mystic', 'Mount Doom', 'Mirror Entity', 'Combustible Gearhulk', 'Tree of Perdition',
  'Swarmyard Massacre', 'Pact of the Serpent', "Ezuri's Predation", 'Call the Coppercoats', 'Ajani, Strength of the Pride', 'Skyclave Apparition', 'Mind Stone', 'Run Away Together',
  'Sepulchral Primordial', 'Valakut Exploration', 'Consuming Aberration', 'Expressive Iteration', 'Talion, the Kindly Lord', 'Stuffy Doll', 'Planar Nexus', 'Daxos, Blessed by the Sun',
  'Arcane Lighthouse', 'Devoted Druid', 'The Black Gate', "Avatar's Wrath", 'Sol Ring', 'Lightning Bolt', 'Giant Growth', 'Swiftfoot Boots', 'Arid Archway', 'Six', 'Myr Battlesphere',
  'Jaya\'s Immolating Inferno', 'Season of Gathering', 'Unstoppable Slasher', 'Warden of the Grove', 'Baleful Mastery'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, put, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { window.__want = window.__want || null; window.__tgt = window.__tgt || null; window.__num = null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ if (!window.__tgt){ if (m.spec && m.spec.upTo){ m.__done = 1; m.resolve([]); closeModal(); } return; } const re = new RegExp(window.__tgt, 'i'); const max = (m.spec && m.spec.n) || m.n || 1; const cs = (m.cands || []).filter(x => x.ok && re.test(x.nm)).slice(0, Math.max(1, max)); if (!cs.length) return; m.__done = 1; m.resolve(cs); closeModal(); }
    else if (m.type === 'zone'){ m.__done = 1; closeModal(); }
    else if (m.run){ m.__done = 1; const d = window.__num != null ? window.__num : (m.def ?? 1); m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const toHand = (p, n) => p.evaluate(n => { for (const z of ['lib', 'gy', 'ex', 'bf']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.hand.push(c); commit(); return c.id; } } return S.hand.find(c => cname(c) === n)?.id; }, n);
const cast = (p, n) => p.evaluate(async n => { const c = S.hand.find(x => cname(x) === n); if (!c) return 'not in hand'; S.pool = {...emptyPool(), W:6, U:6, B:6, R:6, G:6, C:6}; commit(); await beginCast(c, 'hand'); return S.hand.includes(c) ? 'not cast' : 'ok'; }, n);
const toGy = (p, n) => p.evaluate(n => { const c = S.bf.find(x => cname(x) === n); if (c){ moveCard(c.id, 'gy', {quiet:true}); commit(); return true; } return false; }, n);
const clearBf = (p, keepLands = true) => p.evaluate(k => { for (const c of S.bf.slice()) if (!(k && isLand(c.k) && !/Mount Doom|Arcane Lighthouse|Black Gate|Planar Nexus|Arid Archway|Hidden Courtyard/.test(cname(c)))) moveCard(c.id, c.tok ? 'gy' : 'gy', {quiet:true}); S.bf = S.bf.filter(c => !c.tok); commit(); }, keepLands);
const activate = (p, n, re) => p.evaluate(async ([n, re]) => { const c = S.bf.find(x => cname(x) === n); if (!c) return 'missing'; c.sk = false; c.tap = false; S.pool = {...emptyPool(), W:6, U:6, B:6, R:6, G:6, C:6}; const ab = abilityList(c).find(a => new RegExp(re, 'i').test(a.eff) || new RegExp(re, 'i').test(a.cost)); if (!ab) return 'no ability'; await activateAbility(c, ab); return 'ok'; }, [n, re]);
const run = (p, txt, nm, extra) => p.evaluate(async ([txt, nm, extra]) => { const k = [...DICT.values()].find(a => a.n === nm)?.k || null; const src = S.bf.find(c => cname(c) === nm); const ctx = {k, name:nm, full:txt, srcId:src ? src.id : undefined, ...(extra || {})}; if (ctx.tgtKim){ const [pid] = [...OPP.keys()]; ctx.tgts = [[{t:'player', pid, nm:nameOf(pid)}]]; } if (ctx.itX) ctx.it = {kind:'ability', x:ctx.itX}; await runEffects(txt, ctx); commit(); return 'ok'; }, [txt, nm, extra]);
let PA = null, PB = null;
const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails();
  try { await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), 45000))]); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2u');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2u');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const life = p => p.evaluate(() => S.life);
  const cnt = (p, re) => p.evaluate(re => S.bf.filter(c => new RegExp(re).test(cname(c))).reduce((a, c) => a + (c.n || 1), 0), re);
  const after = async () => { await sleep(500); await settle([A, B]); await sleep(1200); await settle([A, B]); await sleep(500); };
  const want = (p, w) => p.evaluate(w => { window.__want = w; }, w); const tgt = (p, t) => p.evaluate(t => { window.__tgt = t; }, t);
  try {
    await step('Spelunking: draw, put a Cave onto the battlefield, gain 4 life', async () => {
      await toHand(A, 'Hidden Courtyard'); const L0 = await life(A); const h0 = await A.evaluate(() => S.hand.length);
      await want(A, 'Hidden Courtyard'); await put(A, 'Spelunking'); await after(); await want(A, null);
      check(await cnt(A, '^Hidden Courtyard$') === 1, 'the Cave went onto the battlefield');
      check(await life(A) === L0 + 4, `gained 4 life for the Cave (${L0} → ${await life(A)})`);
      check(await A.evaluate(() => S.hand.length) === h0, 'drew a card and played the land (hand size unchanged)');
      await toGy(A, 'Spelunking');
    });
    await step('Shared Animosity: two attacking Elves each get +1/+0', async () => {
      await put(A, 'Shared Animosity'); await put(A, 'Llanowar Elves'); await put(A, 'Elvish Mystic'); await after();
      const [pid] = await A.evaluate(() => [...OPP.keys()]);
      await A.evaluate(pid => { for (const c of S.bf.filter(x => /Llanowar|Elvish Mystic/.test(cname(x)))){ c.atk = 'p:' + pid; emit({type:'attack', k:c.k, id:c.id, dp:pid}); } commit(); }, pid); await after();
      const p = await A.evaluate(() => S.bf.filter(x => /Llanowar|Elvish Mystic/.test(cname(x))).map(c => stats(c)[0]));
      check(p.length === 2 && p.every(x => x === 2), `each Elf is 2/1 (powers ${p})`);
      await A.evaluate(() => { S.bf.forEach(c => { c.atk = ''; c.pu = [0, 0]; }); commit(); }); await toGy(A, 'Shared Animosity');
    });
    await step('Mirror Entity: X = 3 makes my creatures 3/3', async () => {
      await put(A, 'Mirror Entity'); await run(A, 'Until end of turn, creatures you control have base power and toughness X/X and gain all creature types.', 'Mirror Entity', {itX:3}); await after();
      const s = await A.evaluate(() => S.bf.filter(c => isCreatureCard(c)).map(c => stats(c).join('/')));
      check(s.length >= 3 && s.every(x => x === '3/3'), `all my creatures are 3/3 (${s})`);
      check(await A.evaluate(() => descOk(S.bf.find(c => cname(c) === 'Llanowar Elves').k, 'dragon', {card:S.bf.find(c => cname(c) === 'Llanowar Elves')}) || typeOf(S.bf.find(c => cname(c) === 'Llanowar Elves')).length > 0), 'creature types granted');
      await toGy(A, 'Mirror Entity');
    });
    await step('Mount Doom: keep up to two creatures, destroy the rest (both boards)', async () => {
      await put(B, 'Grizzly Bears'); await put(B, 'Llanowar Elves'); await after();
      await want(A, 'Elvish Mystic'); await run(A, 'Choose up to two creatures, then destroy the rest.', 'Mount Doom'); await after(); await want(A, null);
      check(await cnt(A, 'Elvish Mystic') === 1 && await cnt(A, 'Llanowar') === 0, 'kept Elvish Mystic, destroyed Llanowar Elves');
      check(await cnt(B, 'Grizzly|Llanowar') === 0, "Kim's creatures were destroyed");
      await toGy(A, 'Elvish Mystic');
    });
    await step('Combustible Gearhulk: Kim refuses — Georges mills three and Kim takes damage', async () => {
      await want(B, 'No'); const L0 = await life(B); const g0 = await A.evaluate(() => S.gy.length);
      await A.evaluate(() => { window.__tgt = 'Kim'; }); await put(A, 'Combustible Gearhulk'); await after(); await sleep(1500); await settle([A, B]);
      await want(B, null); await tgt(A, null);
      const r = await A.evaluate(() => ({g:S.gy.length, mv:S.gy.slice(-3).reduce((a, c) => a + (info(c.k)?.mv || 0), 0)}));
      check(r.g === g0 + 3, `Georges milled three (${g0} → ${r.g})`);
      check(await life(B) === L0 - r.mv, `Kim took damage equal to the milled mana value ${r.mv} (${L0} → ${await life(B)})`);
      await toGy(A, 'Combustible Gearhulk');
    });
    await step('Tree of Perdition: exchange Kim\'s life total with its toughness', async () => {
      await put(A, 'Tree of Perdition'); await tgt(A, 'Kim'); const L0 = await life(B);
      check(await activate(A, 'Tree of Perdition', 'exchange') === 'ok', 'activated Tree of Perdition'); await after(); await tgt(A, null);
      check(await life(B) === 13, `Kim's life became 13 (was ${L0}, now ${await life(B)})`);
      const t = await A.evaluate(() => stats(S.bf.find(c => cname(c) === 'Tree of Perdition'))[1]); check(t === L0, `the Tree's toughness became ${L0} (${t})`);
      await B.evaluate(() => { S.life = 40; commit(); }); await toGy(A, 'Tree of Perdition');
    });
    await step('Swarmyard Massacre: two Squirrels give Kim\'s Grizzly Bears -2/-2', async () => {
      await put(B, 'Grizzly Bears'); await after(); await toHand(A, 'Swarmyard Massacre'); check(await cast(A, 'Swarmyard Massacre') === 'ok', 'cast Swarmyard Massacre'); await after(); await sleep(800); await settle([A, B]);
      check(await cnt(A, 'Squirrel') === 2, 'created two Squirrels'); check(await cnt(B, 'Grizzly') === 0, 'Grizzly Bears died');
    });
    await step('Pact of the Serpent: Kim draws and loses life for each Elf she controls', async () => {
      await put(B, 'Llanowar Elves'); await put(B, 'Elvish Mystic'); await after(); const h0 = await B.evaluate(() => S.hand.length); const L0 = await life(B);
      await want(A, '^Elf$'); await tgt(A, 'Kim'); await toHand(A, 'Pact of the Serpent'); check(await cast(A, 'Pact of the Serpent') === 'ok', 'cast Pact of the Serpent'); await after(); await want(A, null); await tgt(A, null);
      check(await B.evaluate(() => S.hand.length) === h0 + 2 && await life(B) === L0 - 2, `Kim drew 2 and lost 2 (hand ${h0} → ${await B.evaluate(() => S.hand.length)}, life ${L0} → ${await life(B)})`);
    });
    await step("Ezuri's Predation: a Beast for each of Kim's creatures, and they fight", async () => {
      const n = await cnt(B, '.'); const nc = await B.evaluate(() => S.bf.filter(c => isCreatureCard(c)).length);
      await toHand(A, "Ezuri's Predation"); check(await cast(A, "Ezuri's Predation") === 'ok', "cast Ezuri's Predation"); await after(); await sleep(800); await settle([A, B]);
      check(await cnt(A, 'Beast') === nc, `created ${nc} Beasts (${await cnt(A, 'Beast')})`);
      check(await B.evaluate(() => S.bf.filter(c => isCreatureCard(c)).length) === 0, "every creature of Kim's died in the fights");
    });
    await step('Call the Coppercoats: tokens equal to the creatures the chosen opponent controls', async () => {
      await put(B, 'Llanowar Elves'); await put(B, 'Grizzly Bears'); await after(); const t0 = await cnt(A, 'Soldier');
      await tgt(A, 'Kim'); await toHand(A, 'Call the Coppercoats'); check(await cast(A, 'Call the Coppercoats') === 'ok', 'cast Call the Coppercoats'); await after(); await tgt(A, null);
      check(await cnt(A, 'Soldier') === t0 + 2, `created 2 Human Soldiers (${await cnt(A, 'Soldier')})`);
    });
    await step('Skyclave Apparition: exiles Mind Stone; when it leaves, Kim gets a 2/2 Illusion', async () => {
      await put(B, 'Mind Stone'); await after(); await tgt(A, 'Mind Stone'); await put(A, 'Skyclave Apparition'); await after(); await tgt(A, null);
      check(await cnt(B, 'Mind Stone') === 0, "Kim's Mind Stone was exiled");
      await toGy(A, 'Skyclave Apparition'); await after(); await sleep(1000); await settle([A, B]);
      const il = await B.evaluate(() => S.bf.filter(c => /Illusion/.test(cname(c) + ' ' + (info(c.k)?.t || ''))).map(c => stats(c).join('/')));
      check(il.length === 1 && il[0] === '2/2', `Kim created a 2/2 Illusion (${il})`);
    });
    await step('Run Away Together: one creature of each player returns to hand', async () => {
      await put(A, 'Llanowar Elves'); await after(); await tgt(A, 'Llanowar|Grizzly');
      await toHand(A, 'Run Away Together'); check(await cast(A, 'Run Away Together') === 'ok', 'cast Run Away Together'); await after(); await tgt(A, null);
      const a = await A.evaluate(() => S.hand.some(c => cname(c) === 'Llanowar Elves')); const b = await B.evaluate(() => S.hand.some(c => /Llanowar|Grizzly/.test(cname(c))));
      check(a && b, `both creatures returned to their owners' hands (Georges ${a}, Kim ${b})`);
    });
    await step('Sepulchral Primordial: takes a creature card from Kim\'s graveyard', async () => {
      await put(B, 'Elvish Mystic'); await toGy(B, 'Elvish Mystic'); await after(); await sleep(800);
      await want(A, 'Elvish Mystic'); await tgt(A, 'Elvish Mystic'); await put(A, 'Sepulchral Primordial'); await after(); await sleep(1500); await settle([A, B]); await want(A, null);
      check(await cnt(A, 'Elvish Mystic') === 1, 'Georges controls Kim\'s Elvish Mystic'); check(!(await B.evaluate(() => S.gy.some(c => cname(c) === 'Elvish Mystic'))), "it left Kim's graveyard");
    });
    await step('Ajani, Strength of the Pride 0: exile Ajani and Kim\'s artifacts and creatures at 15+ over starting life', async () => {
      await put(B, 'Sol Ring'); await put(B, 'Llanowar Elves'); await after(); await A.evaluate(() => { S.life = 56; commit(); }); await put(A, 'Ajani, Strength of the Pride'); await after();
      await run(A, 'If you have at least 15 life more than your starting life total, exile Ajani, Strength of the Pride and each artifact and creature your opponents control.', 'Ajani, Strength of the Pride'); await after();
      check(await cnt(B, 'Sol Ring|Llanowar|Illusion') === 0, "Kim's artifacts and creatures were exiled"); check(await cnt(A, 'Ajani') === 0, 'Ajani was exiled');
      await A.evaluate(() => { S.life = 40; commit(); });
    });
    await step('Valakut Exploration: a land exiles the top card; at end step those cards deal damage', async () => {
      await put(A, 'Valakut Exploration'); await after(); const L0 = await life(B);
      await put(A, 'Mountain'); await after(); check(await A.evaluate(() => S.ex.filter(c => c.mayPlay && c.mayPlay.src === 'Valakut Exploration').length) === 1, 'landfall exiled the top card (playable)');
      await A.evaluate(() => { fireSteps('end', MYPID); commit(); }); await after(); await sleep(800); await settle([A, B]);
      check(await life(B) === L0 - 1, `Kim took 1 damage (${L0} → ${await life(B)})`); check(await A.evaluate(() => S.ex.filter(c => c.mayPlay && c.mayPlay.src === 'Valakut Exploration').length) === 0, 'the exiled card went to the graveyard');
      await toGy(A, 'Valakut Exploration');
    });
    await step('Consuming Aberration: Kim reveals until a land and mills those cards', async () => {
      await B.evaluate(() => { mill(3); commit(); }); await after(); await put(A, 'Consuming Aberration'); await after(); const g0 = await B.evaluate(() => S.gy.length);
      await B.evaluate(() => { const i = S.lib.findIndex(c => !isLand(c.k)); const [c] = S.lib.splice(i, 1); S.lib.unshift(c); const j = S.lib.findIndex(c => isLand(c.k)); const [l] = S.lib.splice(j, 1); S.lib.splice(1, 0, l); commit(); });
      await toHand(A, 'Giant Growth'); await tgt(A, 'Consuming'); check(await cast(A, 'Giant Growth') === 'ok', 'cast Giant Growth'); await after(); await tgt(A, null); await sleep(800); await settle([A, B]);
      const g1 = await B.evaluate(() => S.gy.length); check(g1 === g0 + 2 && await B.evaluate(() => isLand(S.gy[S.gy.length - 1].k)), `Kim milled a nonland and then a land (${g0} → ${g1})`);
      await toGy(A, 'Consuming Aberration');
    });
    await step('Expressive Iteration: one to hand, one to the bottom, one exiled and playable', async () => {
      const h0 = await A.evaluate(() => S.hand.length); const third = await A.evaluate(() => S.lib[2].id);
      await toHand(A, 'Expressive Iteration'); check(await cast(A, 'Expressive Iteration') === 'ok', 'cast Expressive Iteration'); await after();
      const r = await A.evaluate(id => ({h:S.hand.length, ex:S.ex.find(c => c.id === id), bottom:S.lib.length ? S.lib[S.lib.length - 1].id : null}), third);
      check(r.h === h0 + 1, `one card to hand (${h0} → ${r.h})`); check(!!(r.ex && r.ex.mayPlay), 'the last card is exiled and may be played this turn');
    });
    await step('Talion: Kim casts a spell with the chosen number — she loses 2, Georges draws', async () => {
      await want(A, '^2$'); await put(A, 'Talion, the Kindly Lord'); await after(); await sleep(400); await want(A, null);
      check(await A.evaluate(() => S.bf.find(c => cname(c) === 'Talion, the Kindly Lord')?.u25num) === 2, 'Talion: chose 2');
      const L0 = await life(B); const h0 = await A.evaluate(() => S.hand.length); await toHand(B, 'Grizzly Bears');
      await B.evaluate(async () => { const c = S.hand.find(x => cname(x) === 'Grizzly Bears'); S.pool = {...emptyPool(), G:4}; const t0 = timingOk; timingOk = () => ({ok:true}); try { await beginCast(c, 'hand'); } finally { timingOk = t0; } }); await after(); await sleep(800); await settle([A, B]);
      check(await life(B) === L0 - 2, `Kim lost 2 life (${L0} → ${await life(B)})`); check(await A.evaluate(() => S.hand.length) === h0 + 1, 'Georges drew a card');
      await toGy(A, 'Talion, the Kindly Lord');
    });
    await step('Stuffy Doll: chooses Kim; damage to it is dealt to Kim', async () => {
      await want(A, 'Kim'); await put(A, 'Stuffy Doll'); await after(); await sleep(400); await want(A, null); const L0 = await life(B);
      check(await activate(A, 'Stuffy Doll', 'damage to itself') === 'ok', 'activated Stuffy Doll'); await after(); await sleep(800); await settle([A, B]);
      check(await life(B) === L0 - 1, `Kim lost 1 (${L0} → ${await life(B)})`); await toGy(A, 'Stuffy Doll');
    });
    await step('Statics: Planar Nexus is a Desert/Gate; Daxos counts devotion; Devoted Druid untaps', async () => {
      await put(A, 'Planar Nexus'); await put(A, 'Daxos, Blessed by the Sun'); await put(A, 'Devoted Druid'); await after();
      check(await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Planar Nexus'); return descOk(c.k, 'gate', {card:c, face:{...faceOf(c), t:typeOf(c)}}) || /Gate/.test(typeOf(c)); }), 'Planar Nexus is a Gate');
      const t = await A.evaluate(() => stats(S.bf.find(x => cname(x) === 'Daxos, Blessed by the Sun'))[1]); const d = await A.evaluate(() => devotion(['white']));
      check(t === d && t >= 2, `Daxos's toughness equals devotion to white (${t} = ${d})`);
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Devoted Druid'); c.tap = true; c.sk = false; commit(); });
      const r = await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Devoted Druid'); const ab = abilityList(c).find(a => /counter/i.test(a.cost)); if (!ab) return 'no ability'; await activateAbility(c, ab); return 'ok'; }); await after();
      const dd = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Devoted Druid'); return c ? {tap:c.tap, cm:c.cm || 0} : null; });
      check(r === 'ok' && dd && !dd.tap && dd.cm === 1, `Devoted Druid untapped with a -1/-1 counter (${JSON.stringify(dd)})`);
    });
    await step('Arcane Lighthouse: Kim\'s hexproof creature becomes targetable', async () => {
      await toHand(B, 'Llanowar Elves'); await put(B, 'Llanowar Elves'); await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Llanowar Elves'); c.ekw = ['hexproof']; commit(); }); await after();
      const ok0 = await A.evaluate(() => targetCands({desc:'creature', zone:'bf', n:1}, {pid:MYPID, id:-1}).find(x => x.nm === 'Llanowar Elves' && x.pid !== MYPID)?.ok);
      await put(A, 'Arcane Lighthouse'); check(await activate(A, 'Arcane Lighthouse', 'hexproof') === 'ok', 'activated Arcane Lighthouse'); await after();
      const ok1 = await A.evaluate(() => targetCands({desc:'creature', zone:'bf', n:1}, {pid:MYPID, id:-1}).find(x => x.nm === 'Llanowar Elves' && x.pid !== MYPID)?.ok);
      check(ok0 === false && ok1 === true, `hexproof ignored after the Lighthouse (${ok0} → ${ok1})`);
    });
    await step("Avatar's Wrath: Kim's creature is airbent and she may cast it for {2}", async () => {
      await toHand(B, 'Grizzly Bears'); await put(B, 'Grizzly Bears'); await after(); await toHand(A, "Avatar's Wrath"); check(await cast(A, "Avatar's Wrath") === 'ok', "cast Avatar's Wrath"); await after(); await sleep(800); await settle([A, B]);
      const r = await B.evaluate(() => { const c = S.ex.find(x => cname(x) === 'Grizzly Bears'); return c ? {may:!!(c.mayPlay && exWindowOk(c)), cost:costStr(spellCost(c, 'ex').cost)} : null; });
      check(!!(r && r.may && r.cost === '{2}'), `Grizzly Bears is in exile and castable for {2} (${JSON.stringify(r)})`);
      const why = await B.evaluate(() => { const c = S.ex.find(x => cname(x) === 'Grizzly Bears'); return c ? castCheck(c, 'ex') : null; }); check(why && why.ok === false, `but not until Georges's next turn: ${why && why.why}`);
    });
    await step('Arid Archway: returning a Desert surveils 1', async () => {
      await put(A, 'Planar Nexus'); await want(A, 'Planar Nexus'); await put(A, 'Arid Archway'); await after(); await want(A, null);
      check(await A.evaluate(() => S.hand.some(c => cname(c) === 'Planar Nexus')), 'returned Planar Nexus (a Desert) to hand');
      check(await A.evaluate(() => S.log.slice(-12).some(e => /surveil/i.test(e.s))), 'surveilled 1');
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
