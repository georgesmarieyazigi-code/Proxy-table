process.env.TOP = '1';
// Round 26 helper A2: long-tail cards (ranks 0–3300) played in a real 2-player game (Georges vs Kim)
const CC = require('./cards');
const WANT = ['Scroll Rack', 'Ripples of Potential', 'Sword of Hearth and Home', 'Conduit of Worlds', 'The Key to the Vault', "Descendants' Path", 'Nissa, Resurgent Animist', 'Carpet of Flowers',
  'Springheart Nantuko', 'Akiri, Fearless Voyager', 'Scheming Symmetry', 'Wild Magic Surge', 'Goblin Welder', 'Chainer, Nightmare Adept', 'There and Back Again', 'Massacre Girl, Known Killer',
  'Wedding Ring', 'Wild-Magic Sorcerer', 'Imoti, Celebrant of Bounty', 'Pearl-Ear, Imperial Advisor', 'Ugin, the Ineffable', 'Breena, the Demagogue', 'Druid Class', 'The Skullspore Nexus', 'Fraying Sanity',
  'Malcolm, Keen-Eyed Navigator', 'Grafted Exoskeleton', 'The Queen of Dale', 'Multiversal Passage', 'Winter Moon', 'Library of Leng', 'Quilled Greatwurm', 'Toph, Hardheaded Teacher', 'Nissa, Who Shakes the World',
  'Grizzly Bears', 'Llanowar Elves', 'Elvish Mystic', 'Lightning Bolt', 'Mind Stone', 'Darksteel Ingot', 'Wall of Omens', 'Pacifism', 'Baneslayer Angel', 'Craterhoof Behemoth', 'Sol Ring', 'Swiftfoot Boots', 'Divination', 'Rancor', 'Forest', 'Island', 'Command Tower', 'Arcane Signet', 'Opt', 'Hostage Taker', 'Arcane Lighthouse', 'Reliquary Tower', 'Plumb the Forbidden', 'Lethal Scheme', 'Exploration Broodship', 'The Aetherspark', 'Teferi, Master of Time', 'Ichormoon Gauntlet', 'Dionus, Elvish Archdruid', 'Danny Pink', 'Shadrix Silverquill', 'Gwenom, Remorseless', 'Ultima, Origin of Oblivion', 'The Warring Triad', 'Misleading Signpost', "Autumn's Veil", 'Starfield of Nyx', "Biomancer's Familiar", "Tishana's Tidebinder", 'Dance of the Dead', 'Timely Ward', 'Gandalf the White', 'Firebender Ascension', 'Gauntlet of Power', 'Kozilek, the Broken Reality', 'Swiftfoot Boots', 'Baneslayer Angel', 'Lightning Greaves', 'Skullclamp', 'Weathered Sentinels'];
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
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { await T(150000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (PA) for (const p of [PA, PB]) await p.evaluate(() => { try { if (UI.modal){ const m = UI.modal; m.__done = 1; try { m.resolve && m.resolve(null); } catch {} closeModal(); } S.stk = []; UI.resolving = false; UI.casting = false; window.__want = null; window.__tgt = null; commit(); } catch {} }).catch(() => {});
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2a2');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2a2');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO); await A.evaluate(() => { window.__toasts = []; const t0 = toast; toast = (m, ...a) => { window.__toasts.push(String(m)); return t0(m, ...a); }; });
  const life = p => p.evaluate(() => S.life);
  const cnt = (p, re) => p.evaluate(re => S.bf.filter(c => new RegExp(re).test(cname(c))).reduce((a, c) => a + (c.n || 1), 0), re);
  const card = (p, n) => p.evaluate(n => { const c = S.bf.find(x => cname(x) === n); return c ? {cp:c.cp || 0, nc:c.nc || {}, tap:!!c.tap, regen:c.regen || 0} : null; }, n);
  const after = async () => { await sleep(500); await settle([A, B]); await sleep(1200); await settle([A, B]); await sleep(500); };
  const hand = p => p.evaluate(() => S.hand.length);
  const toTop = (p, n) => p.evaluate(n => { for (const z of ['lib', 'hand', 'gy', 'ex', 'bf']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.lib.unshift(c); commit(); return true; } } return false; }, n);
  const gyHas = (p, n) => p.evaluate(n => S.gy.some(c => cname(c) === n), n);
  const handHas = (p, n) => p.evaluate(n => S.hand.some(c => cname(c) === n), n);
  const bfHas = (p, n) => p.evaluate(n => S.bf.some(c => cname(c) === n), n);
  try {
    await step('Scroll Rack swaps hand cards with the top of the library', async () => {
      await put(A, 'Scroll Rack'); await toHand(A, 'Grizzly Bears'); await toHand(A, 'Lightning Bolt'); await after();
      const before = await A.evaluate(() => ({h:S.hand.length, top:S.lib.slice(0, 2).map(c => c.id)}));
      await A.evaluate(() => { window.__want = 'Grizzly|Lightning'; }); check(await activate(A, 'Scroll Rack', 'Exile any number') === 'ok', 'activated Scroll Rack'); await after(); await A.evaluate(() => { window.__want = null; });
      const r = await A.evaluate(top => ({h:S.hand.length, got:top.every(id => S.hand.some(c => c.id === id)), lib:S.lib.slice(0, 2).map(cname)}), before.top);
      check(r.h === before.h && r.got, `hand size unchanged and the two top cards are now in hand (${JSON.stringify(r)})`);
      check(r.lib.includes('Grizzly Bears') && r.lib.includes('Lightning Bolt'), 'the two chosen cards are on top of the library');
      await toGy(A, 'Scroll Rack');
    });
    await step('Ripples of Potential proliferates, then phases out a permanent that got a counter', async () => {
      await put(A, 'Grizzly Bears'); await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); modCounters(c, 'cp', 1); commit(); }); await toHand(A, 'Ripples of Potential'); await after();
      await A.evaluate(() => { window.__want = 'Grizzly'; }); check(await cast(A, 'Ripples of Potential') === 'ok', 'cast Ripples of Potential'); await after(); await A.evaluate(() => { window.__want = null; });
      const r = await A.evaluate(() => { const c = (S.poz || []).find(x => cname(x) === 'Grizzly Bears'); return c ? c.cp : -1; });
      check(r === 2, `Grizzly Bears got a second counter and phased out (cp ${r})`);
      await A.evaluate(() => { const i = (S.poz || []).findIndex(x => cname(x) === 'Grizzly Bears'); if (i >= 0){ const [c] = S.poz.splice(i, 1); S.gy.push(c); } commit(); });
    });
    await step('Sword of Hearth and Home flickers a creature you own and fetches a basic land', async () => {
      await put(A, 'Llanowar Elves'); await after(); const id0 = await A.evaluate(() => S.bf.find(c => cname(c) === 'Llanowar Elves').id);
      const lands0 = await A.evaluate(() => S.bf.filter(c => isLand(c.k)).length);
      await A.evaluate(() => { window.__tgt = 'Llanowar'; });
      await A.evaluate(async id => { const c = S.bf.find(x => x.id === id); await runEffects('Whenever equipped creature deals combat damage to a player, exile up to one target creature you own, then search your library for a basic land card. Put both cards onto the battlefield under your control, then shuffle.'.split(', ').slice(1).join(', '), {k:null, name:'Sword of Hearth and Home', tgts:[[{t:'card', pid:MYPID, id, k:c.k, nm:cname(c)}]]}); commit(); }, id0); await after(); await A.evaluate(() => { window.__tgt = null; });
      const r = await A.evaluate(() => ({elves:S.bf.some(c => cname(c) === 'Llanowar Elves'), sk:!!S.bf.find(c => cname(c) === 'Llanowar Elves')?.sk, lands:S.bf.filter(c => isLand(c.k)).length}));
      check(r.elves && r.lands === lands0 + 1, `Llanowar Elves returned and a basic land entered (${JSON.stringify(r)}, before ${lands0})`);
      await toGy(A, 'Llanowar Elves');
    });
    await step('Conduit of Worlds casts a permanent card from the graveyard, then no more spells', async () => {
      await put(A, 'Conduit of Worlds'); await toZone(A, 'Mind Stone', 'gy'); await after();
      await A.evaluate(() => { S.casts = []; window.__tgt = 'Mind Stone'; }); check(await activate(A, 'Conduit of Worlds', 'Choose target') === 'ok', 'activated Conduit'); await after(); await A.evaluate(() => { window.__tgt = null; });
      check(await bfHas(A, 'Mind Stone'), 'Mind Stone was cast from the graveyard and resolved');
      const why = await A.evaluate(() => { const c = S.hand[0] || S.lib[0]; return castCheck(c, 'hand'); });
      check(why && why.ok === false && /additional spells/.test(why.why), `can't cast another spell this turn (${JSON.stringify(why)})`);
      await A.evaluate(() => { S.a26noCast = null; commit(); }); await toGy(A, 'Conduit of Worlds'); await toGy(A, 'Mind Stone');
    });
    await step("The Key to the Vault: look at that many, exile a nonland card and cast it free", async () => {
      await A.evaluate(() => { const i = S.lib.findIndex(c => cname(c) === 'Divination'); if (i >= 0){ const [c] = S.lib.splice(i, 1); S.lib.unshift(c); } commit(); });
      const h0 = await hand(A);
      await A.evaluate(async () => { await runEffects('look at that many cards from the top of your library. You may exile a nonland card from among them. Put the rest on the bottom of your library in a random order. You may cast the exiled card without paying its mana cost.', {k:null, name:'The Key to the Vault', it:{kind:'trigger', evN:3}}); commit(); }); await after();
      check(await gyHas(A, 'Divination') && (await hand(A)) === h0 + 2, 'Divination was cast for free from the top three and drew two');
    });
    await step("Descendants' Path casts a creature sharing a type for free; Nissa reveals an Elf on the second landfall", async () => {
      await put(A, "Descendants' Path"); await put(A, 'Llanowar Elves'); await A.evaluate(() => { const i = S.lib.findIndex(c => cname(c) === 'Elvish Mystic'); const [c] = S.lib.splice(i, 1); S.lib.unshift(c); commit(); }); await after();
      await A.evaluate(() => fireSteps('upkeep', MYPID)); await after();
      check(await bfHas(A, 'Elvish Mystic'), "Descendants' Path cast Elvish Mystic (an Elf, like Llanowar Elves) for free");
      await toTop(A, 'Baneslayer Angel'); await A.evaluate(() => fireSteps('upkeep', MYPID)); await after();
      check(await A.evaluate(() => cname(S.lib[S.lib.length - 1]) === 'Baneslayer Angel'), 'Baneslayer Angel (no shared type) went to the bottom');
      await toGy(A, "Descendants' Path"); await toGy(A, 'Elvish Mystic');
      await put(A, 'Nissa, Resurgent Animist'); await A.evaluate(() => { const i = S.lib.findIndex(c => cname(c) === 'Elvish Mystic'); if (i >= 0) S.lib.push(S.lib.splice(i, 1)[0]); const j = S.gy.findIndex(c => cname(c) === 'Elvish Mystic'); if (j >= 0) S.lib.push(S.gy.splice(j, 1)[0]); commit(); });
      await put(A, 'Mountain'); await after(); check(!(await handHas(A, 'Elvish Mystic')), 'first landfall: just mana');
      await A.evaluate(() => { const c = S.lib.find(x => isLand(x.k) && /Island|Forest|Swamp|Plains|Mountain/.test(cname(x))); moveCard(c.id, 'bf'); commit(); }); await after();
      const got = await A.evaluate(() => { const c = S.hand[S.hand.length - 1]; return c ? info(c.k).t : ''; });
      check(/\b(Elf|Elemental)\b/.test(got), `second landfall: revealed until an Elf or Elemental and put it into hand (${got})`);
      await toGy(A, 'Nissa, Resurgent Animist'); await toGy(A, 'Llanowar Elves');
    });
    await step('Carpet of Flowers adds mana equal to the Islands Kim controls', async () => {
      await B.evaluate(() => { for (let i = 0; i < 2; i++){ const c = S.lib.find(x => cname(x) === 'Island'); if (c) moveCard(c.id, 'bf'); } commit(); }); await put(A, 'Carpet of Flowers'); await after();
      const n = await B.evaluate(() => S.bf.filter(c => /Island/.test(info(c.k)?.t || '')).length);
      await A.evaluate(() => { S.pool = emptyPool(); window.__want = 'Blue'; commit(); fireSteps('main1', MYPID); }); await after();
      await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Carpet of Flowers'); const [pid] = [...OPP.keys()]; await runEffects('If you haven\'t added mana with this ability this turn, you may add X mana of any one color, where X is the number of Islands target opponent controls.', {k:c.k, name:'Carpet of Flowers', srcId:c.id, it:{kind:'trigger', srcId:c.id}, tgts:[[{t:'player', pid}]]}); window.__want = null; });
      const u = await A.evaluate(() => S.pool.U || 0); check(n >= 2 && u === n, `added ${u} blue mana for Kim's ${n} Islands`);
      await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Carpet of Flowers'); const [pid] = [...OPP.keys()]; S.pool = emptyPool(); await runEffects('If you haven\'t added mana with this ability this turn, you may add X mana of any one color, where X is the number of Islands target opponent controls.', {k:c.k, name:'Carpet of Flowers', srcId:c.id, it:{kind:'trigger', srcId:c.id}, tgts:[[{t:'player', pid}]]}); });
      check(await A.evaluate(() => S.pool.U || 0) === 0, 'only once each turn');
      await A.evaluate(() => { S.pool = emptyPool(); commit(); }); await toGy(A, 'Carpet of Flowers');
    });
    await step('Springheart Nantuko (bestowed) copies the creature on landfall; unattached it makes an Insect', async () => {
      await put(A, 'Grizzly Bears'); await put(A, 'Springheart Nantuko'); await A.evaluate(() => { const s = S.bf.find(c => cname(c) === 'Springheart Nantuko'); const g = S.bf.find(c => cname(c) === 'Grizzly Bears'); s.att = {pid:MYPID, id:g.id}; s.r21bbestow = 1; S.pool = {...emptyPool(), G:2}; commit(); }); await after();
      await A.evaluate(() => { const c = S.lib.find(x => cname(x) === 'Mountain'); moveCard(c.id, 'bf'); commit(); }); await after();
      check(await cnt(A, '^Grizzly Bears$') === 2, `a token copy of Grizzly Bears was created (${await cnt(A, '^Grizzly Bears$')})`);
      await A.evaluate(() => { const s = S.bf.find(c => cname(c) === 'Springheart Nantuko'); delete s.att; s.r21bbestow = 0; commit(); });
      await A.evaluate(() => { const c = S.lib.find(x => cname(x) === 'Swamp' || cname(x) === 'Island'); moveCard(c.id, 'bf'); commit(); }); await after();
      check(await cnt(A, 'Insect') === 1, 'not attached: a 1/1 Insect token instead');
      await A.evaluate(() => { S.bf.filter(c => /Insect|Grizzly|Springheart/.test(cname(c))).forEach(c => moveCard(c.id, 'gy', {quiet:true})); commit(); });
    });
    await step('Akiri unattaches an Equipment: the creature taps and gains indestructible', async () => {
      await put(A, 'Akiri, Fearless Voyager'); await put(A, 'Grizzly Bears'); await put(A, 'Swiftfoot Boots');
      await A.evaluate(() => { const e = S.bf.find(c => cname(c) === 'Swiftfoot Boots'); const g = S.bf.find(c => cname(c) === 'Grizzly Bears'); e.att = {pid:MYPID, id:g.id}; commit(); }); await after();
      check(await activate(A, 'Akiri, Fearless Voyager', 'unattach') === 'ok', 'activated Akiri'); await after();
      const r = await A.evaluate(() => { const e = S.bf.find(c => cname(c) === 'Swiftfoot Boots'); const g = S.bf.find(c => cname(c) === 'Grizzly Bears'); return {att:!!e.att, tap:!!g.tap, ind:!!kwOf(g, 'indestructible')}; });
      check(!r.att && r.tap && r.ind, `Swiftfoot Boots unattached, Bears tapped and indestructible (${JSON.stringify(r)})`);
      await toGy(A, 'Akiri, Fearless Voyager'); await toGy(A, 'Swiftfoot Boots'); await toGy(A, 'Grizzly Bears');
    });
    await step('Scheming Symmetry: both players tutor a card to the top', async () => {
      const b0 = await B.evaluate(() => S.lib[0].id);
      await A.evaluate(async () => { const [pid] = [...OPP.keys()]; await runEffects('Choose two target players. Each of them searches their library for a card, then shuffles and puts that card on top.', {k:null, name:'Scheming Symmetry', it:{kind:'spell'}, tgts:[[{t:'player', pid:MYPID}, {t:'player', pid}]]}); commit(); }); await after(); await sleep(1500); await settle([A, B]);
      check(await A.evaluate(() => S.log.some(e => /searched their library for a card/.test(e.s))), 'Georges searched');
      check(await B.evaluate(() => S.log.some(e => /searched their library for a card/.test(e.s))), 'Kim searched her library (on her own screen)');
    });
    await step('Wild Magic Surge: Kim reveals until a permanent sharing a type and puts it onto the battlefield', async () => {
      const l0 = await B.evaluate(() => S.bf.filter(c => isLand(c.k)).length);
      await toHand(A, 'Wild Magic Surge'); await A.evaluate(() => { window.__tgt = 'Island'; }); check(await cast(A, 'Wild Magic Surge') === 'ok', 'cast Wild Magic Surge on Kim\'s Island'); await after(); await sleep(1500); await settle([A, B]); await A.evaluate(() => { window.__tgt = null; });
      const r = await B.evaluate(() => ({lands:S.bf.filter(c => isLand(c.k)).length, log:S.log.slice(-6).map(e => e.s).join(' | ')}));
      check(r.lands === l0, `Kim lost the Island and got another land from her library (${l0} → ${r.lands}; ${r.log})`);
    });
    await step('Goblin Welder swaps an artifact with an artifact card in the graveyard', async () => {
      await put(A, 'Goblin Welder'); await put(A, 'Sol Ring'); await toZone(A, 'Mind Stone', 'gy'); await after();
      await A.evaluate(() => { window.__tgt = 'Sol Ring|Mind Stone'; window.__want = 'Mind Stone'; }); check(await activate(A, 'Goblin Welder', 'Choose target') === 'ok', 'activated Goblin Welder'); await after(); await A.evaluate(() => { window.__tgt = null; window.__want = null; });
      check(await gyHas(A, 'Sol Ring') && await bfHas(A, 'Mind Stone'), 'Sol Ring went to the graveyard and Mind Stone came back');
      await toGy(A, 'Goblin Welder'); await toGy(A, 'Mind Stone');
    });
    await step('Chainer lets you cast one creature spell from the graveyard this turn; it gets haste', async () => {
      await put(A, 'Chainer, Nightmare Adept'); await toZone(A, 'Grizzly Bears', 'gy'); await toHand(A, 'Opt'); await after();
      const before = await A.evaluate(() => (gyOptions(S.gy.find(c => cname(c) === 'Grizzly Bears')) || []).some(g => g.a26chain));
      check(!before, 'no Chainer option before activating');
      check(await activate(A, 'Chainer, Nightmare Adept', 'creature spell from your graveyard') === 'ok', 'activated Chainer (discarding a card)'); await after();
      const opt = await A.evaluate(() => (gyOptions(S.gy.find(c => cname(c) === 'Grizzly Bears')) || []).find(g => g.a26chain));
      check(!!opt, 'Grizzly Bears can now be cast from the graveyard');
      await A.evaluate(async () => { const c = S.gy.find(x => cname(x) === 'Grizzly Bears'); S.pool = {...emptyPool(), G:2}; await castFromGy(c, (gyOptions(c) || []).find(g => g.a26chain)); }); await after();
      const g = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); return c ? {sk:!!c.sk} : null; });
      check(g && !g.sk, `Grizzly Bears was cast from the graveyard and has haste (${JSON.stringify(g)})`);
      check(await A.evaluate(() => S.a26chain.n) === 0, 'only one creature spell');
      await toGy(A, 'Chainer, Nightmare Adept'); await toGy(A, 'Grizzly Bears');
    });
    await step("There and Back Again: Kim's creature can't block while Georges controls the Saga", async () => {
      await put(B, 'Grizzly Bears'); await put(A, 'Elvish Mystic'); await after(); await sleep(800);
      await A.evaluate(() => { window.__tgt = 'Grizzly Bears'; }); await put(A, 'There and Back Again'); await after(); await sleep(1000); await settle([A, B]); await A.evaluate(() => { window.__tgt = null; });
      const why = await B.evaluate(() => { const [pid] = [...OPP.keys()]; const a = OPP.get(pid).bf.find(c => c.k && cname(c) === 'Elvish Mystic'); return canBlock(S.bf.find(c => cname(c) === 'Grizzly Bears'), a, pid); });
      check(/can't block/.test(why), `Kim's Grizzly Bears can't block (${why})`);
      await toGy(A, 'There and Back Again'); await after(); await sleep(1000);
      const why2 = await B.evaluate(() => { const [pid] = [...OPP.keys()]; const a = OPP.get(pid).bf.find(c => c.k && cname(c) === 'Elvish Mystic'); return canBlock(S.bf.find(c => cname(c) === 'Grizzly Bears'), a, pid); });
      check(!/There and Back/.test(why2), `once the Saga is gone it can block again (${why2 || 'ok'})`);
      await toGy(A, 'Baneslayer Angel');
    });
    await step('Massacre Girl, Known Killer: Georges draws when Kim\'s creature dies with toughness below 1', async () => {
      await put(A, 'Massacre Girl, Known Killer'); await after(); const h0 = await hand(A);
      await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); c.cm = 2; commit(); sba(); commit(); }); await after(); await sleep(1500); await settle([A, B]);
      check(await gyHas(B, 'Grizzly Bears'), 'Kim\'s Grizzly Bears died with -1/-1 counters');
      check(await hand(A) === h0 + 1, 'Georges drew a card');
      await put(B, 'Grizzly Bears'); await after(); const h1 = await hand(A);
      await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); moveCard(c.id, 'gy'); commit(); }); await after(); await sleep(1500); await settle([A, B]);
      check(await hand(A) === h1, 'a creature dying with toughness 2 draws nothing');
      await toGy(A, 'Massacre Girl, Known Killer');
    });
    await step('Pearl-Ear: enchantment spells have affinity for Auras', async () => {
      await put(A, 'Pearl-Ear, Imperial Advisor'); await put(A, 'Rancor'); await toHand(A, 'Fraying Sanity'); await after();
      const g = await A.evaluate(() => spellCost(S.hand.find(c => cname(c) === 'Fraying Sanity'), 'hand').cost.gen);
      check(g === 1, `Fraying Sanity costs {1}{U} with one Aura out (generic ${g})`);
      await toGy(A, 'Pearl-Ear, Imperial Advisor'); await toGy(A, 'Rancor');
    });
    await step('Wild-Magic Sorcerer: the first spell cast from exile each turn cascades; Imoti cascades big spells', async () => {
      await put(A, 'Wild-Magic Sorcerer'); await toZone(A, 'Grizzly Bears', 'ex'); await toZone(A, 'Llanowar Elves', 'ex'); await A.evaluate(() => { S.a26exN = null; commit(); }); await after();
      const n1 = await A.evaluate(async () => { const c = S.ex.find(x => cname(x) === 'Grizzly Bears'); await beginCast(c, 'ex', {free:true}); return S.stk.filter(x => /cascade/.test(x.txt || '')).length; });
      check(n1 === 1, `casting Grizzly Bears from exile put a cascade trigger on the stack (${n1})`);
      await A.evaluate(() => { S.stk = S.stk.filter(x => !/cascade/.test(x.txt || '')); commit(); });
      const n2 = await A.evaluate(async () => { const c = S.ex.find(x => cname(x) === 'Llanowar Elves'); await beginCast(c, 'ex', {free:true}); return S.stk.filter(x => /cascade/.test(x.txt || '')).length; });
      check(n2 === 0, 'the second spell from exile does not cascade');
      await settle([A, B]); await toGy(A, 'Wild-Magic Sorcerer'); await toGy(A, 'Grizzly Bears'); await toGy(A, 'Llanowar Elves');
      await put(A, 'Imoti, Celebrant of Bounty'); await toHand(A, 'Craterhoof Behemoth'); await toHand(A, 'Grizzly Bears'); await after();
      const n3 = await A.evaluate(async () => { S.pool = {...emptyPool(), G:9, C:9}; const c = S.hand.find(x => cname(x) === 'Craterhoof Behemoth'); await beginCast(c, 'hand'); return S.stk.filter(x => /cascade/.test(x.txt || '')).length; });
      check(n3 === 1, `Craterhoof (mana value 8) has cascade from Imoti (${n3})`);
      await A.evaluate(() => { S.stk = S.stk.filter(x => !/cascade/.test(x.txt || '')); commit(); });
      const n4 = await A.evaluate(async () => { S.pool = {...emptyPool(), G:9}; const c = S.hand.find(x => cname(x) === 'Grizzly Bears'); await beginCast(c, 'hand'); return S.stk.filter(x => /cascade/.test(x.txt || '')).length; });
      check(n4 === 0, 'Grizzly Bears (mana value 2) does not cascade');
      await settle([A, B]); for (const n of ['Imoti, Celebrant of Bounty', 'Craterhoof Behemoth', 'Grizzly Bears']) await toGy(A, n);
    });
    await step('Ugin +1: a face-down exiled card returns to hand when the Spirit leaves', async () => {
      await put(A, 'Ugin, the Ineffable'); await toTop(A, 'Wall of Omens'); await after();
      check(await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Ugin, the Ineffable'); const i = loyaltyAbs(c).findIndex(a => /Exile the top card/.test(a.eff)); if (i < 0) return 'no ability'; await activateLoyalty(c, i); return 'ok'; }) === 'ok', 'activated Ugin +1'); await after();
      const r = await A.evaluate(() => { const w = S.ex.find(c => cname(c) === 'Wall of Omens'); const sp = S.bf.find(c => c.a26link); return {fd:!!(w && w.fd), sp:sp ? cname(sp) : null}; });
      check(r.fd && /Spirit/.test(r.sp || ''), `Wall of Omens exiled face down and a linked Spirit token created (${JSON.stringify(r)})`);
      await A.evaluate(() => { const sp = S.bf.find(c => c.a26link); moveCard(sp.id, 'gy'); commit(); }); await after();
      check(await handHas(A, 'Wall of Omens'), 'the Spirit died and Wall of Omens went to hand');
      await toGy(A, 'Ugin, the Ineffable');
    });
    await step('Druid Class level 3 animates a land as big as your land count', async () => {
      await put(A, 'Druid Class'); await after(); const f = await A.evaluate(() => S.bf.find(c => isLand(c.k)).id);
      await A.evaluate(async id => { const s = S.bf.find(c => cname(c) === 'Druid Class'); const l = S.bf.find(c => c.id === id); await runEffects('Target land you control becomes a creature with haste and "This creature\'s power and toughness are each equal to the number of lands you control." It\'s still a land.', {k:s.k, name:'Druid Class', srcId:s.id, tgts:[[{t:'card', pid:MYPID, id, k:l.k}]]}); commit(); }, f); await after();
      const r = await A.evaluate(id => { const c = S.bf.find(x => x.id === id); c.pu = [0, 0]; return {cr:isCreatureCard(c), st:stats(c), n:S.bf.filter(x => isLand(x.k)).length, haste:hasHaste(c)}; }, f);
      check(r.cr && r.st[0] === r.n && r.st[1] === r.n && r.haste, `the land is a ${r.st.join('/')} creature with haste (${r.n} lands)`);
      await toGy(A, 'Druid Class');
    });
    await step('The Skullspore Nexus: a token as big as the total power of the creatures that died together', async () => {
      await put(A, 'The Skullspore Nexus'); await put(A, 'Baneslayer Angel'); await put(A, 'Grizzly Bears'); await after();
      const want = await A.evaluate(() => S.bf.filter(c => /Baneslayer Angel|Grizzly Bears/.test(cname(c))).reduce((a, c) => a + stats(c)[0], 0));
      await A.evaluate(() => { S.bf.filter(c => /Baneslayer Angel|Grizzly Bears/.test(cname(c))).forEach(c => moveCard(c.id, 'gy')); commit(); }); await after();
      const r = await A.evaluate(() => { const c = S.bf.find(x => /Fungus Dinosaur/.test(cname(x))); return c ? stats(c) : null; });
      check(r && r[0] === want && r[1] === want, `one ${want}/${want} Fungus Dinosaur (${JSON.stringify(r)})`);
      await toGy(A, 'The Skullspore Nexus'); await A.evaluate(() => { S.bf.filter(c => /Fungus/.test(cname(c))).forEach(c => moveCard(c.id, 'gy', {quiet:true})); commit(); });
    });
    await step('Fraying Sanity: Kim mills as many cards as went to her graveyard this turn', async () => {
      await A.evaluate(() => { window.__want = 'Kim'; }); await put(A, 'Fraying Sanity'); await after(); await A.evaluate(() => { window.__want = null; const c = S.bf.find(x => cname(x) === 'Fraying Sanity'); const [pid] = [...OPP.keys()]; c.att = {pid}; commit(); });
      await B.evaluate(() => { mill(2); commit(); }); await after(); await sleep(800);
      const r0 = await B.evaluate(() => ({gy:S.gy.length, n:a26GyIn()}));
      await A.evaluate(() => fireSteps('end', MYPID)); await after(); await sleep(1500); await settle([A, B]);
      const g1 = await B.evaluate(() => S.gy.length);
      check(r0.n >= 2 && g1 === r0.gy + r0.n, `Kim milled ${g1 - r0.gy} (cards put into her graveyard this turn: ${r0.n})`);
      await toGy(A, 'Fraying Sanity');
    });
    await step('Grafted Exoskeleton: moving it sacrifices the creature it left', async () => {
      await put(A, 'Grafted Exoskeleton'); await put(A, 'Grizzly Bears'); await put(A, 'Llanowar Elves');
      await A.evaluate(() => { const e = S.bf.find(c => cname(c) === 'Grafted Exoskeleton'); e.att = {pid:MYPID, id:S.bf.find(c => cname(c) === 'Grizzly Bears').id}; commit(); }); await after();
      check(await A.evaluate(() => kwOf(S.bf.find(c => cname(c) === 'Grizzly Bears'), 'infect')), 'equipped Bears has infect');
      await A.evaluate(() => { const e = S.bf.find(c => cname(c) === 'Grafted Exoskeleton'); e.att = {pid:MYPID, id:S.bf.find(c => cname(c) === 'Llanowar Elves').id}; commit(); }); await after();
      check(await gyHas(A, 'Grizzly Bears') && await bfHas(A, 'Llanowar Elves'), 'Grizzly Bears was sacrificed when the Exoskeleton moved');
      await toGy(A, 'Grafted Exoskeleton'); await after();
      check(await gyHas(A, 'Llanowar Elves'), 'the Exoskeleton leaving the battlefield sacrificed Llanowar Elves');
    });
    await step('The Queen of Dale: Kim\'s first noncreature spell makes Georges recruit', async () => {
      await put(A, 'The Queen of Dale'); await toHand(A, 'Lightning Bolt'); await after(); const s0 = await cnt(A, 'Human Soldier'); const h0 = await hand(A);
      await A.evaluate(() => { window.__want = 'Lightning Bolt'; });
      await toHand(B, 'Mind Stone'); await B.evaluate(async () => { S.pool = {...emptyPool(), U:3}; const c = S.hand.find(x => cname(x) === 'Mind Stone'); await beginCast(c, 'hand', {free:true}); }); await after(); await sleep(1500); await settle([A, B]);
      check(await cnt(A, 'Human Soldier') === s0 + 1 && await hand(A) === h0, `Georges drew, discarded Lightning Bolt and made a Human Soldier (${await cnt(A, 'Human Soldier')})`);
      await toHand(B, 'Sol Ring'); await B.evaluate(async () => { const c = S.hand.find(x => cname(x) === 'Sol Ring'); await beginCast(c, 'hand', {free:true}); }); await after(); await sleep(1500); await settle([A, B]);
      check(await cnt(A, 'Human Soldier') === s0 + 1, 'her second noncreature spell does nothing');
      await A.evaluate(() => { window.__want = null; }); await toGy(A, 'The Queen of Dale');
    });
    await step('Multiversal Passage becomes the chosen basic land type; paying 2 life keeps it untapped', async () => {
      const l0 = await life(A); await A.evaluate(() => { window.__want = 'Island|Pay 2'; }); await put(A, 'Multiversal Passage'); await after(); await A.evaluate(() => { window.__want = null; });
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Multiversal Passage'); return {ty:typeOf(c), tap:!!c.tap, u:manaAbs(c).some(o => o.outs.some(x => x.join('') === 'U'))}; });
      check(/Island/.test(r.ty) && r.u && !r.tap && (await life(A)) === l0 - 2, `it is an Island, taps for {U}, entered untapped for 2 life (${JSON.stringify(r)})`);
    });
    await step('Library of Leng: a discarded card can go on top of the library', async () => {
      await put(A, 'Library of Leng'); await toHand(A, 'Wall of Omens'); await after();
      await A.evaluate(() => { window.__want = 'Wall of Omens|Put it on top'; });
      await A.evaluate(async () => { await runEffects('Discard a card.', {k:null, name:'test', it:{kind:'spell'}}); commit(); }); await after(); await sleep(500);
      check(await A.evaluate(() => cname(S.lib[0]) === 'Wall of Omens'), 'the discarded Wall of Omens is on top of the library');
      await A.evaluate(() => { window.__want = null; }); await toGy(A, 'Library of Leng');
    });
    await step('Quilled Greatwurm and Malcolm: combat damage on your turn', async () => {
      await put(A, 'Quilled Greatwurm'); await put(A, 'Grizzly Bears'); await put(A, 'Malcolm, Keen-Eyed Navigator'); await after(); const t0 = await cnt(A, 'Treasure'); const kl = await life(B);
      await A.evaluate(async () => { const [pid] = [...OPP.keys()]; S.bf.filter(c => /Grizzly Bears|Malcolm/.test(cname(c))).forEach(c => { c.atk = 'p:' + pid; }); commit(); await attackerDamage('dmg', new Map()); S.bf.forEach(c => { c.atk = null; }); commit(); }); await after(); await sleep(1500); await settle([A, B]);
      const r = await A.evaluate(() => ({g:(S.bf.find(c => cname(c) === 'Grizzly Bears') || {}).cp || 0, m:(S.bf.find(c => /Malcolm/.test(cname(c))) || {}).cp || 0}));
      check(r.g === 2 && r.m === 2, `Grizzly Bears and Malcolm got +1/+1 counters equal to the damage (${JSON.stringify(r)})`);
      check(await cnt(A, 'Treasure') === t0 + 1, 'Malcolm (a Pirate) dealt damage to one opponent: one Treasure');
      check(await life(B) === kl - 4, `Kim took 4 (${kl} → ${await life(B)})`);
      for (const n of ['Quilled Greatwurm', 'Grizzly Bears', 'Malcolm, Keen-Eyed Navigator']) await toGy(A, n);
    });
    await step('Plumb the Forbidden copies itself for each creature sacrificed; Lethal Scheme makes its convokers connive', async () => {
      await put(A, 'Grizzly Bears'); await put(A, 'Llanowar Elves'); await toHand(A, 'Plumb the Forbidden'); await after(); const h0 = await hand(A); const l0 = await life(A);
      await A.evaluate(() => { window.__want = 'Grizzly|Llanowar|Sacrifice|Yes'; });
      await A.evaluate(async () => { S.pool = {...emptyPool(), B:2, C:1}; const c = S.hand.find(x => cname(x) === 'Plumb the Forbidden'); await beginCast(c, 'hand'); }); await after(); await sleep(500); await settle([A, B]); await A.evaluate(() => { window.__want = null; });
      const r = await A.evaluate(() => ({sac:S.gy.filter(c => /Grizzly Bears|Llanowar Elves/.test(cname(c))).length})); const dh = (await hand(A)) - (h0 - 1), dl = l0 - (await life(A));
      check(r.sac >= 1 && dh === r.sac + 1 && dl === r.sac + 1, `sacrificed ${r.sac}, drew ${dh} and lost ${dl} (original + ${r.sac} copies)`);
      await put(A, 'Elvish Mystic'); await put(A, 'Llanowar Elves'); await toHand(A, 'Lethal Scheme'); await put(B, 'Grizzly Bears'); await after(); await sleep(800);
      await A.evaluate(() => { window.__tgt = 'Grizzly Bears'; window.__want = 'Elvish|Llanowar'; S.bf.forEach(c => { if (isCreatureCard(c)){ c.tap = false; } }); commit(); });
      await A.evaluate(async () => { S.pool = {...emptyPool(), B:2}; const c = S.hand.find(x => cname(x) === 'Lethal Scheme'); await beginCast(c, 'hand'); }); await after(); await sleep(1200); await settle([A, B]); await A.evaluate(() => { window.__tgt = null; window.__want = null; });
      check(await gyHas(B, 'Grizzly Bears'), "Lethal Scheme destroyed Kim's Grizzly Bears");
      check(await A.evaluate(() => S.log.filter(e => /(Elvish Mystic|Llanowar Elves) connives/.test(e.s)).length) >= 2, 'both convoking creatures connived');
      for (const n of ['Elvish Mystic', 'Llanowar Elves']) await toGy(A, n);
    });
    await step('Exploration Broodship: cast a permanent spell from the graveyard by sacrificing a land, once a turn', async () => {
      await put(A, 'Exploration Broodship'); await toZone(A, 'Grizzly Bears', 'gy'); await after();
      const n0 = await A.evaluate(() => S.bf.filter(c => isLand(c.k)).length);
      const ok = await A.evaluate(async () => { S.a26brood = null; const c = S.gy.find(x => cname(x) === 'Grizzly Bears'); const g = (gyOptions(c) || []).find(o => o.a26brood); if (!g) return 'no option'; S.pool = {...emptyPool(), G:2}; await castFromGy(c, g); return 'ok'; }); await after();
      check(ok === 'ok' && await bfHas(A, 'Grizzly Bears'), `Grizzly Bears was cast from the graveyard (${ok})`);
      check(await A.evaluate(() => S.bf.filter(c => isLand(c.k)).length) === n0 - 1, 'a land was sacrificed');
      await toZone(A, 'Llanowar Elves', 'gy'); check(!(await A.evaluate(() => (gyOptions(S.gy.find(x => cname(x) === 'Llanowar Elves')) || []).some(o => o.a26brood))), 'only once each turn');
      for (const n of ['Exploration Broodship', 'Grizzly Bears']) await toGy(A, n);
    });
    await step('The Aetherspark attaches, gains loyalty from combat damage; Ichormoon Gauntlet grants loyalty abilities; Teferi works at instant speed', async () => {
      await put(A, 'The Aetherspark'); await put(A, 'Grizzly Bears'); await after();
      await A.evaluate(() => { window.__tgt = 'Grizzly'; }); const ok = await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'The Aetherspark'); const i = loyaltyAbs(c).findIndex(a => /Attach/.test(a.eff)); await activateLoyalty(c, i); return 'ok'; }); await after(); await A.evaluate(() => { window.__tgt = null; });
      const r = await A.evaluate(() => { const e = S.bf.find(x => cname(x) === 'The Aetherspark'); const g = S.bf.find(x => cname(x) === 'Grizzly Bears'); return {att:!!(e.att && e.att.id === g.id), cp:g.cp || 0, co:e.co}; });
      check(r.att && r.cp === 1, `attached to Grizzly Bears with a +1/+1 counter (${JSON.stringify(r)})`);
      check(await B.evaluate(() => !defOpts().some(o => /Aetherspark/.test(o.label))), "Kim can't attack The Aetherspark while it's attached");
      await A.evaluate(async () => { const [pid] = [...OPP.keys()]; const g = S.bf.find(c => cname(c) === 'Grizzly Bears'); g.atk = 'p:' + pid; commit(); await attackerDamage('dmg', new Map()); g.atk = null; commit(); }); await after();
      const co = await A.evaluate(() => S.bf.find(x => cname(x) === 'The Aetherspark').co);
      check(co === r.co + 3, `3 combat damage → 3 loyalty counters (${r.co} → ${co})`);
      await put(A, 'Ichormoon Gauntlet'); await after();
      check(await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'The Aetherspark'); return loyaltyAbs(c).filter(a => a.a26).map(a => a.raw).join(','); }) === '0,−12', 'The Aetherspark has [0]: Proliferate and [−12] from Ichormoon Gauntlet');
      await put(A, 'Teferi, Master of Time'); await after();
      const why = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Teferi, Master of Time'); const keep = S.ph; S.ph = [S.ph[0], S.ph[1], 4]; const w = loyaltyReady(c, loyaltyAbs(c)[0]); S.ph = keep; return w; });
      check(why === '', `Teferi's loyalty ability can be activated outside the main phase (${why || 'ok'})`);
      for (const n of ['The Aetherspark', 'Ichormoon Gauntlet', 'Teferi, Master of Time', 'Grizzly Bears']) await toGy(A, n);
    });
    await step('Dionus untaps an Elf once each turn; Danny Pink draws the first time counters land on a creature each turn', async () => {
      await put(A, 'Dionus, Elvish Archdruid'); await put(A, 'Llanowar Elves'); await after(); await sleep(300);
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Llanowar Elves'); c.tap = true; commit(); }); await after();
      let r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Llanowar Elves'); return {tap:!!c.tap, cp:c.cp || 0}; });
      check(!r.tap && r.cp === 1, `Llanowar Elves untapped with a +1/+1 counter (${JSON.stringify(r)})`);
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Llanowar Elves'); c.tap = true; commit(); }); await after();
      r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Llanowar Elves'); return {tap:!!c.tap, cp:c.cp || 0}; });
      check(r.tap && r.cp === 1, 'only once each turn');
      await toGy(A, 'Dionus, Elvish Archdruid'); await put(A, 'Danny Pink'); await put(A, 'Grizzly Bears'); await after(); const h0 = await hand(A);
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); modCounters(c, 'cp', 1); commit(); }); await after();
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); modCounters(c, 'cp', 1); commit(); }); await after();
      check(await hand(A) === h0 + 1, `drew exactly one card (${(await hand(A)) - h0})`);
      for (const n of ['Danny Pink', 'Grizzly Bears', 'Llanowar Elves']) await toGy(A, n);
    });
    await step('Shadrix Silverquill: two modes, two different players', async () => {
      await put(A, 'Shadrix Silverquill'); await put(B, 'Grizzly Bears'); await after(); const hb = await hand(B); const lb = await life(B);
      await A.evaluate(() => { window.__want = 'Choose two|Inkling|Georges|draws a card'; });
      await A.evaluate(async () => { let n = 0; const orig = askChoice; askChoice = async m => { n++; if (n === 1) return true; if (n === 2) return 0; if (n === 3) return MYPID; if (n === 4) return 1; if (n === 5) return [...OPP.keys()][0]; return orig(m); }; try { const c = S.bf.find(x => cname(x) === 'Shadrix Silverquill'); await runEffects(info(c.k).o.split('\n').slice(1).join('\n').replace(/^At the beginning of combat on your turn, /, ''), {k:c.k, name:'Shadrix Silverquill', srcId:c.id, it:{kind:'trigger'}}); } finally { askChoice = orig; } commit(); }); await after(); await sleep(1500); await settle([A, B]);
      check(await cnt(A, 'Inkling') === 1, 'Georges created a 2/1 Inkling');
      check(await hand(B) === hb + 1 && await life(B) === lb - 1, `Kim drew a card and lost 1 life (${hb}→${await hand(B)}, ${lb}→${await life(B)})`);
      await toGy(A, 'Shadrix Silverquill'); await A.evaluate(() => { S.bf.filter(c => /Inkling/.test(cname(c))).forEach(c => moveCard(c.id, 'gy', {quiet:true})); commit(); });
    });
    await step('Gwenom lets you cast from the top of the library by paying life', async () => {
      await put(A, 'Gwenom, Remorseless'); await toTop(A, 'Grizzly Bears'); await after(); const l0 = await life(A);
      await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Gwenom, Remorseless'); await runEffects('until end of turn, you may look at the top card of your library any time and you may play cards from the top of your library. If you cast a spell this way, pay life equal to its mana value rather than pay its mana cost.', {k:c.k, name:'Gwenom, Remorseless', srcId:c.id, it:{kind:'trigger'}}); commit(); });
      const ways = await A.evaluate(() => r23fTopWays(S.lib[0]).map(w => !!w.life));
      check(ways.length && ways.every(x => x), `the top card can be cast only by paying life (${JSON.stringify(ways)})`);
      await A.evaluate(async () => { S.pool = emptyPool(); await r23fPlayTop(true); }); await after();
      check(await bfHas(A, 'Grizzly Bears') && await life(A) === l0 - 2, `Grizzly Bears cast from the top for 2 life (${l0} → ${await life(A)})`);
      for (const n of ['Gwenom, Remorseless', 'Grizzly Bears']) await toGy(A, n);
    });
    await step("Ultima blights Kim's land; tapping a land for {C} adds an extra {C}", async () => {
      await put(A, 'Ultima, Origin of Oblivion'); await B.evaluate(() => { const c = S.lib.find(x => cname(x) === 'Plains'); if (c) moveCard(c.id, 'bf'); commit(); }); await after(); await sleep(800);
      await A.evaluate(async () => { const u = S.bf.find(x => cname(x) === 'Ultima, Origin of Oblivion'); const [pid] = [...OPP.keys()]; const p = OPP.get(pid).bf.find(c => c.k && cname(c) === 'Plains'); await runEffects('Put a blight counter on target land. For as long as that land has a blight counter on it, it loses all land types and abilities and has "{T}: Add {C}."', {k:u.k, name:'Ultima, Origin of Oblivion', srcId:u.id, tgts:[[{t:'card', pid, id:p.id, k:p.k, nm:'Plains'}]]}); commit(); }); await after(); await sleep(1200);
      const r = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Plains' && x.a26ult); return c ? {ty:typeOf(c), outs:manaAbs(c).map(o => o.outs.map(x => x.join('')).join('/'))} : null; });
      check(r && !/Plains/.test(r.ty) && r.outs.join() === 'C', `Kim's Plains lost its land type and taps only for {C} (${JSON.stringify(r)})`);
      const ex = await A.evaluate(() => { const c = S.bf.find(x => isLand(x.k)); return r23fTapExtras(c, {cost:'{T}'}, ['C'], false); });
      check(ex.filter(x => x === 'C').length >= 1, `Georges tapping a land for {C} gets an additional {C} (${JSON.stringify(ex)})`);
      await toGy(A, 'Ultima, Origin of Oblivion');
    });
    await step('The Warring Triad is not a creature with fewer than eight cards in the graveyard; Starfield of Nyx animates enchantments', async () => {
      await put(A, 'The Warring Triad'); await after();
      const a = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'The Warring Triad'); const g0 = S.gy.slice(); S.gy = S.gy.slice(0, 3); const g = S.gy.length; const r1 = isCreatureCard(c); S.gy = g0; const keep = S.gy.slice(); while (S.gy.length < 8) S.gy.push({id:990000 + S.gy.length, k:S.lib[0].k}); const r2 = isCreatureCard(c); S.gy = keep; commit(); return {g, r1, r2}; });
      check(a.r2 && !a.r1, `creature only with eight or more cards in the graveyard (${JSON.stringify(a)})`);
      await toGy(A, 'The Warring Triad');
      for (const n of ['Starfield of Nyx', "Descendants' Path", 'Carpet of Flowers', 'Fraying Sanity', 'Pacifism', 'Rancor']) await put(A, n); await after();
      const s = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === "Descendants' Path"); const aur = S.bf.find(x => cname(x) === 'Rancor'); const n = S.bf.filter(b => /Enchantment/.test(info(b.k)?.t || '')).length; return {n, cr:isCreatureCard(c), st:stats(c), aura:aur ? isCreatureCard(aur) : null}; });
      check(s.n < 5 || (s.cr && s.st[0] === 3 && s.st[1] === 3 && s.aura === false), `Descendants' Path is a 3/3 creature, Auras aren't (${JSON.stringify(s)})`);
      for (const n of ['Starfield of Nyx', "Descendants' Path", 'Carpet of Flowers', 'Fraying Sanity', 'Pacifism', 'Rancor']) await toGy(A, n);
    });
    await step("Misleading Signpost redirects an attacker; Autumn's Veil stops blue/black targeting; Biomancer's Familiar resets adapt", async () => {
      await put(A, 'Grizzly Bears'); await put(A, 'Misleading Signpost'); await after();
      await B.evaluate(() => { const c = S.lib.find(x => /Planeswalker/.test(info(x.k)?.t || '')) || S.hand.find(x => /Planeswalker/.test(info(x.k)?.t || '')); if (c){ moveCard(c.id, 'bf', {quiet:true}); commit(); } }); await after(); await sleep(800);
      await A.evaluate(async () => { const [pid] = [...OPP.keys()]; const g = S.bf.find(c => cname(c) === 'Grizzly Bears'); g.atk = 'p:' + pid; const keepPh = S.ph, keepCb = S.cb; const pn0 = phaseNow(); S.ph = [S.ph[0], S.ph[1], 4]; S.cb = {...(S.cb || {}), t:`${pn0.g}.${pn0.n}`, n:(S.cb && S.cb.n) || 1, step:'atkd'}; const s = S.bf.find(c => cname(c) === 'Misleading Signpost'); const orig = askChoice; UI.a26keep = [keepPh, keepCb]; askChoice = async m => { const o = (m.options || []).find(x => /^c:/.test(String(x.value))) || (m.options || [])[0]; return o && o.value; }; try { await runEffects('You may reselect which player or permanent target attacking creature is attacking.', {k:s.k, name:'Misleading Signpost', srcId:s.id, tgts:[[{t:'card', pid:MYPID, id:g.id, k:g.k}]]}); } finally { askChoice = orig; S.ph = UI.a26keep[0]; S.cb = UI.a26keep[1]; } commit(); }); await after();
      const atk = await A.evaluate(() => S.bf.find(c => cname(c) === 'Grizzly Bears').atk);
      check(/^c:/.test(atk || ''), `Grizzly Bears now attacks Kim's planeswalker instead of Kim (${atk})`);
      await A.evaluate(() => { S.bf.forEach(c => { c.atk = null; }); commit(); });
      await put(B, 'Grizzly Bears'); await toHand(B, "Autumn's Veil"); await B.evaluate(async () => { S.pool = {...emptyPool(), G:1}; const c = S.hand.find(x => cname(x) === "Autumn's Veil"); await beginCast(c, 'hand', {free:true}); }); await after(); await sleep(1500); await settle([A, B]);
      const why = await A.evaluate(() => { const [pid] = [...OPP.keys()]; UI.casting = true; try { const out = targetCands(targetSpecs('Destroy target creature.')[0], {pid:MYPID, col:'B', types:'Instant', id:-1}); const g = out.find(o => o.pid === pid); return g ? (g.ok ? 'ok' : g.why) : 'none'; } finally { UI.casting = false; } });
      check(/Autumn's Veil/.test(why), `a black spell can't target Kim's creature (${why})`);
      await put(A, "Biomancer's Familiar"); await after();
      await A.evaluate(async () => { const g = S.bf.find(c => cname(c) === 'Grizzly Bears'); modCounters(g, 'cp', 1); const b = S.bf.find(c => cname(c) === "Biomancer's Familiar"); await runEffects('The next time target creature adapts this turn, it adapts as though it had no +1/+1 counters on it.', {k:b.k, name:"Biomancer's Familiar", srcId:b.id, tgts:[[{t:'card', pid:MYPID, id:g.id, k:g.k}]]}); await runEffects('Adapt 2.', {k:g.k, name:'Grizzly Bears', srcId:g.id}); commit(); });
      check(await A.evaluate(() => S.bf.find(c => cname(c) === 'Grizzly Bears').cp) === 3, 'Grizzly Bears adapted despite having a counter (1 → 3)');
      for (const n of ['Grizzly Bears', 'Misleading Signpost', "Biomancer's Familiar"]) await toGy(A, n);
    });
    await step("Tishana's Tidebinder counters an ability and its source loses all abilities while the Tidebinder stays", async () => {
      await put(A, 'Llanowar Elves'); await after();
      const ok = await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Llanowar Elves'); const it = {sid:rid(6), o:nextO(), kind:'ability', k:c.k, nm:cname(c), txt:'Draw a card.', srcId:c.id}; S.stk.push(it); commit(); await put0('Tishana\'s Tidebinder'); return it.sid; function put0(){} });
      await A.evaluate(async sid => { const t = S.lib.find(x => cname(x) === "Tishana's Tidebinder") || S.hand.find(x => cname(x) === "Tishana's Tidebinder") || S.gy.find(x => cname(x) === "Tishana's Tidebinder"); moveCard(t.id, 'bf', {quiet:true}); const tb = S.bf.find(x => x.id === t.id); S.stk = S.stk.filter(x => x.nm !== "Tishana's Tidebinder"); await runEffects('Counter up to one target activated or triggered ability. If an ability of an artifact, creature, or planeswalker is countered this way, that permanent loses all abilities for as long as this creature remains on the battlefield.', {k:tb.k, name:"Tishana's Tidebinder", srcId:tb.id, it:{kind:'trigger', tgt:sid, srcId:tb.id}}); commit(); }, ok); await after();
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Llanowar Elves'); return {mana:manaAbs(c).length, stk:S.stk.length}; });
      check(r.mana === 0, `Llanowar Elves lost its mana ability (${JSON.stringify(r)})`);
      await toGy(A, "Tishana's Tidebinder"); await after();
      check(await A.evaluate(() => manaAbs(S.bf.find(x => cname(x) === 'Llanowar Elves')).length) > 0, 'with the Tidebinder gone it has its abilities again');
      await toGy(A, 'Llanowar Elves');
    });
    await step('Gandalf the White doubles triggers from artifacts entering; Firebender Ascension counts attack triggers', async () => {
      await put(A, 'Gandalf the White'); await put(A, 'Skullclamp'); await after();
      const n = await A.evaluate(() => { const t = trigsOf(S.bf.find(c => cname(c) === 'Gandalf the White').k); const ev = {type:'enter', k:S.bf.find(c => cname(c) === 'Skullclamp').k, id:1}; return trigMult(ev, {id:S.bf.find(c => cname(c) === 'Gandalf the White').id, k:'x'}); });
      check(n === 2, `an artifact entering makes your permanents' triggers trigger twice (×${n})`);
      const n2 = await A.evaluate(() => trigMult({type:'enter', k:S.lib.find(c => /^Grizzly Bears$/.test(cname(c)))?.k || S.gy.find(c => /^Grizzly Bears$/.test(cname(c))).k, id:1}, {id:S.bf.find(c => cname(c) === 'Gandalf the White').id}));
      check(n2 === 1, 'a nonlegendary creature entering does not');
      for (const n of ['Gandalf the White', 'Skullclamp']) await toGy(A, n);
      await put(A, 'Firebender Ascension'); await after(); await sleep(500); await settle([A, B]);
      const sol = await A.evaluate(() => { const c = S.bf.filter(x => /Soldier/.test(cname(x)) && x.tok).pop(); return c ? c.id : null; });
      check(sol != null, 'Firebender Ascension created a Soldier token');
      await put(A, 'Weathered Sentinels'); await after();
      const w0 = await A.evaluate(() => canAttack(S.bf.find(c => cname(c) === 'Weathered Sentinels')));
      const w1 = await A.evaluate(() => { const [pid] = [...OPP.keys()]; S.a26lt = {...(S.a26lt || {}), [pid]:'t9'}; S.a26am = {...(S.a26am || {}), [pid]:'t9'}; const r = canAttack(S.bf.find(c => cname(c) === 'Weathered Sentinels')); return r; });
      check(w0 === 'defender' && w1 === '', `Weathered Sentinels can attack only if Kim attacked Georges during her last turn (${w0} → ${w1 || 'ok'})`);
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Weathered Sentinels'); const [pid] = [...OPP.keys()]; c.atk = 'p:' + pid; emit({type:'attack', k:c.k, id:c.id, cnt:1, dp:pid}); }); await after();
      check(await A.evaluate(() => (S.bf.find(x => cname(x) === 'Firebender Ascension').nc || {}).quest || 0) === 1, "Weathered Sentinels' attack trigger put a quest counter on Firebender Ascension");
      { const ws = await A.evaluate(() => ({st:stats(S.bf.find(x => cname(x) === 'Weathered Sentinels')), stk:S.stk.map(x => x.nm + ':' + x.txt), log:S.log.slice(-6).map(e => e.s).join(' | ')})); check(ws.st[0] === 5, `and its own attack trigger resolved (+3/+3) (${JSON.stringify(ws)})`); }
      await toGy(A, 'Weathered Sentinels');
      await A.evaluate(() => { S.bf.forEach(c => { c.atk = null; }); commit(); }); await toGy(A, 'Firebender Ascension');
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
