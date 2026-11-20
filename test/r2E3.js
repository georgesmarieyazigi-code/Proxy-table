process.env.TOP = '1';
// Round 27E: the last one-offs (mostly back faces of double-faced cards) — real 2-player game (Georges vs Kim)
const CC = require('./cards');
const WANT = ['Bramble Familiar // Fetch Quest', 'Sorin of House Markov // Sorin, Ravenous Neonate', 'Expansion // Explosion', "Tarrian's Journal // The Tomb of Aclazotz", 'Mirrorhall Mimic // Ghastly Mimicry',
  'The Legend of Yangchen // Avatar Yangchen', 'Ajani, Nacatl Pariah // Ajani, Nacatl Avenger', 'Secret Arcade // Dusty Parlor', 'Grist, Voracious Larva // Grist, the Plague Swarm', "Azusa's Many Journeys // Likeness of the Seeker",
  'Tithing Blade // Consuming Sepulcher', 'The Kami War // O-Kagachi Made Manifest', 'Rush of Inspiration // Crackling Falls', 'Cosima, God of the Voyage // The Omenkeel', 'Welcome to . . . // Jurassic Park',
  "Jill, Shiva's Dominant // Shiva, Warden of Ice", 'Scavenger Regent // Exude Toxin', 'Revival // Revenge', 'Valki, God of Lies // Tibalt, Cosmic Impostor', 'Tlincalli Hunter // Retrieve Prey',
  'Reidane, God of the Worthy // Valkmira, Protector\'s Shield', 'The Rise of Sozin // Fire Lord Sozin', 'The Enigma Jewel // Locus of Enlightenment', 'Poppet Stitcher // Poppet Factory', 'Wedding Announcement // Wedding Festivity',
  'Invasion of Fiora // Marchesa, Resolute Monarch', 'Polluted Cistern // Dim Oubliette', 'Eccentric Pestfinder // Turn Stones', 'Jennifer Walters // The Sensational She-Hulk',
  'Mind Stone', 'Llanowar Elves', 'Elvish Mystic', 'Wall of Omens', 'Pacifism', 'Craterhoof Behemoth', 'Divination', 'Lightning Bolt', 'Rimewood Falls', 'Ghalta, Primal Hunger', 'Swords to Plowshares'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { window.__want = window.__want || null; window.__tgt = window.__tgt || null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ if (!window.__tgt) return; const re = new RegExp(window.__tgt, 'i'); const c = (m.cands || []).filter(x => x.ok && re.test(x.nm)); if (!c.length){ if (m.spec && m.spec.upTo){ m.__done = 1; m.resolve([]); closeModal(); } return; } m.__done = 1; m.resolve(c.slice(0, 1)); closeModal(); }
    else if (m.run){ m.__done = 1; m.run(m.def ?? 1); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { await T(60000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if ((H.fails() > f0 || process.env.LOGS) && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
// helpers that find cards by (part of) their full name, any zone
const bring = (p, re, z, o = {}) => p.evaluate(([re, z, o]) => { const R = new RegExp(re, 'i'); for (const y of ['lib', 'hand', 'gy', 'ex', 'bf']){ const i = S[y].findIndex(c => R.test(info(c.k)?.n || '') && !c.own && !c.tok); if (i >= 0){ const [c] = S[y].splice(i, 1); if (y === 'bf') reset(c); if (z === 'bf'){ S.bf.push(c); place(c); c.sk = false; if (o.fl) c.fl = true; if (o.enter) { S.bf.pop(); S[y === 'bf' ? 'gy' : y].push(c); moveCard(c.id, 'bf'); } } else if (z === 'libtop') S.lib.unshift(c); else S[z].push(c); commit(); return c.id; } } return null; }, [re, z, o]);
const run = (p, txt, nmRe, extra) => p.evaluate(async ([txt, nmRe, extra]) => { const R = new RegExp(nmRe, 'i'); const src = S.bf.find(c => R.test(info(c.k)?.n || '')) || S.ex.find(c => R.test(info(c.k)?.n || '')) || S.gy.find(c => R.test(info(c.k)?.n || '')); const d = [...DICT.values()].find(a => R.test(a.n || '')); const k = src ? src.k : (d ? d.k : null); const nm = src ? (faceOf(src)?.n || cname(src)) : (d ? String(d.n).split(' // ').pop() : 'x');
  const ctx = {k, name:nm, full:txt, srcId:src ? src.id : null, ...(extra || {})}; const opp = [...OPP.keys()][0];
  if (ctx.tgtKim){ ctx.tgts = [[{t:'player', pid:opp, nm:nameOf(opp)}]]; delete ctx.tgtKim; }
  if (ctx.tgtCard){ const [who, re] = ctx.tgtCard; const pid = who === 'kim' ? opp : MYPID; const b = boardOf(pid).find(c => new RegExp(re, 'i').test(info(c.k)?.n || '')); ctx.tgts = b ? [[{t:'card', pid, id:b.id, k:b.k, nm:info(b.k)?.n}]] : [[]]; delete ctx.tgtCard; }
  if (ctx.tgtGy){ const c = S.gy.find(c => new RegExp(ctx.tgtGy, 'i').test(info(c.k)?.n || '')); ctx.tgts = c ? [[{t:'gy', pid:MYPID, id:c.id, k:c.k, nm:cname(c)}]] : [[]]; delete ctx.tgtGy; }
  const it = {sid:rid(6), kind:'trigger', k, nm, txt, srcId:ctx.srcId, ...(extra && extra.it || {})}; if (it.evDp === 'KIM') it.evDp = opp; ctx.it = it; await runEffects(txt, ctx); commit(); return 'ok'; }, [txt, nmRe, extra]);
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2e3');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2e3');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const after = async () => { await sleep(500); await settle([A, B]); await sleep(1200); await settle([A, B]); await sleep(400); };
  const want = (p, re) => p.evaluate(re => { window.__want = re; }, re);
  const zoneOf = (p, re) => p.evaluate(re => { const R = new RegExp(re, 'i'); for (const z of ['bf', 'ex', 'gy', 'hand', 'lib']) if (S[z].some(c => R.test(info(c.k)?.n || ''))) return z; return 'none'; }, re);
  const count = (p, z, re) => p.evaluate(([z, re]) => S[z].filter(c => new RegExp(re, 'i').test(info(c.k)?.n || '')).reduce((a, c) => a + (c.n || 1), 0), [z, re]);
  const clear = p => p.evaluate(() => { S.bf.filter(c => !isLand(c.k)).forEach(c => { if (c.own) moveCard(c.id, 'gy', {quiet:true}); else if (c.tok) S.bf.splice(S.bf.indexOf(c), 1); else { S.bf.splice(S.bf.indexOf(c), 1); reset(c); S.lib.push(c); } }); S.stk = []; S.bf.forEach(c => { c.tap = false; }); commit(); });
  try {
    const KIM = await A.evaluate(() => [...OPP.keys()][0]);

    await step('Revenge doubles life; Shiva taps all of Kim\'s lands; Exude Toxin spares Dragons', async () => {
      await A.evaluate(() => { S.life = 17; commit(); }); await run(A, 'Double your life total.', 'Revival'); check(await A.evaluate(() => S.life) === 34, 'Revenge: 17 → 34 life');
      await B.evaluate(() => { for (let i = 0; i < 3; i++){ const c = S.lib.find(x => isLand(x.k)); if (c) moveCard(c.id, 'bf', {quiet:true}); } S.bf.filter(c => isLand(c.k)).forEach(c => { c.tap = false; }); commit(); }); await sleep(600);
      const n = await B.evaluate(() => S.bf.filter(c => isLand(c.k)).length);
      await run(A, 'Tap all lands your opponents control.', 'Jill'); await after();
      check(n > 0 && await B.evaluate(() => S.bf.filter(c => isLand(c.k)).every(c => c.tap)), `Shiva: all ${n} of Kim's lands are tapped`);
      await bring(B, '^Grizzly Bears$', 'bf'); await bring(A, '^Wall of Omens$', 'bf'); await bring(A, '^Scavenger Regent', 'bf'); await after();
      await run(A, 'Each non-Dragon creature gets -X/-X until end of turn.', 'Scavenger', {it:{x:2}}); await after();
      check(await zoneOf(B, '^Grizzly Bears$') === 'gy', 'Exude Toxin X=2: Kim\'s Grizzly Bears died');
      check(await A.evaluate(() => { const c = S.bf.find(x => /Wall of Omens/.test(cname(x))); return c && stats(c)[1] === 2; }), 'Georges\'s Wall of Omens is 0/2 (got -2/-2)');
      check(await A.evaluate(() => { const c = S.bf.find(x => /Scavenger/.test(cname(x))); return c && stats(c)[0] === 4; }), 'Scavenger Regent (a Dragon) is unaffected');
      await clear(A); await clear(B);
    });
    await step('Fetch Quest mills seven and puts a creature/enchantment/land onto the battlefield', async () => {
      await A.evaluate(() => { const ns = ['Lightning Bolt', 'Divination', 'Pacifism']; ns.forEach(n => { const i = S.lib.findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S.lib.splice(i, 1); S.lib.unshift(c); } }); commit(); });
      const g0 = await A.evaluate(() => S.gy.length); await want(A, 'Pacifism');
      await run(A, 'Mill seven cards. Then put a creature, enchantment, or land card from among the milled cards onto the battlefield.', 'Bramble'); await after(); await want(A, null);
      check(await A.evaluate(() => S.gy.length) === g0 + 6, 'six of the seven milled cards stay in the graveyard');
      check(await zoneOf(A, '^Pacifism$') === 'bf', 'Pacifism (an enchantment from among them) is on the battlefield');
      await clear(A);
    });
    await step('Wedding Announcement: two attackers → draw, otherwise a Human; Marchesa checks combat damage since my last turn', async () => {
      const h0 = await A.evaluate(() => S.hand.length);
      await A.evaluate(() => { S.r23atk = {t:turnStr(), ids:[101, 102]}; commit(); });
      await run(A, 'If you attacked with two or more creatures this turn, draw a card. Otherwise, create a 1/1 white Human creature token.', 'Wedding');
      check(await A.evaluate(() => S.hand.length) === h0 + 1 && await count(A, 'bf', 'Human') === 0, 'attacked with two → drew a card, no Human');
      await A.evaluate(() => { S.r23atk = {t:turnStr(), ids:[101]}; commit(); });
      await run(A, 'If you attacked with two or more creatures this turn, draw a card. Otherwise, create a 1/1 white Human creature token.', 'Wedding');
      check(await A.evaluate(() => S.hand.length) === h0 + 1 && await A.evaluate(() => S.bf.some(c => c.tok && /Human/.test(typeOf(c)))), 'attacked with one → a Human token, no card');
      const h1 = await A.evaluate(() => S.hand.length); const l1 = await A.evaluate(() => S.life);
      await run(A, "If you haven't been dealt combat damage since your last turn, you draw a card and you lose 1 life.", 'Invasion of Fiora');
      check(await A.evaluate(() => S.hand.length) === h1 + 1 && await A.evaluate(() => S.life) === l1 - 1, 'Marchesa: no combat damage yet → drew a card and lost 1 life');
      await B.evaluate(() => { const c = {id:S.nid++, k:[...DICT.values()].find(a => a.n === 'Grizzly Bears').k, sk:false}; S.bf.push(c); place(c); hitDefender({t:'player', pid:[...OPP.keys()][0]}, 2, c, {}); S.bf.splice(S.bf.indexOf(c), 1); commit(); }); await after();
      check(await A.evaluate(() => S.life) === l1 - 3, 'Kim\'s creature dealt 2 combat damage to Georges');
      await run(A, "If you haven't been dealt combat damage since your last turn, you draw a card and you lose 1 life.", 'Invasion of Fiora');
      check(await A.evaluate(() => S.hand.length) === h1 + 1, 'Marchesa: after combat damage → no card');
      await clear(A);
    });
    await step('Polluted Cistern counts card types; Turn Stones makes one Pest per opponent; Likeness untaps three lands', async () => {
      const ids = await A.evaluate(() => { const ns = ['Lightning Bolt', 'Divination', 'Wall of Omens', 'Mind Stone']; const out = []; ns.forEach(n => { const c = S.lib.find(x => cname(x) === n) || S.hand.find(x => cname(x) === n) || S.gy.find(x => cname(x) === n); if (c){ if (!S.gy.includes(c)) moveCard(c.id, 'gy', {quiet:true}); out.push(c.id); } }); commit(); return out; });
      const kl = await B.evaluate(() => S.life);
      await run(A, 'Each opponent loses 1 life for each card type among those cards.', 'Polluted', {it:{qids:ids}}); await after();
      check(await B.evaluate(() => S.life) === kl - 4, `Kim lost 4 life (instant, sorcery, creature, artifact) (lost ${kl - await B.evaluate(() => S.life)})`);
      await run(A, 'For each opponent, you create a 1/1 black and green Pest creature token with "When this creature dies, you gain 1 life."', 'Pestfinder');
      check(await A.evaluate(() => S.bf.filter(c => c.tok && /Pest/.test(typeOf(c))).reduce((a, c) => a + (c.n || 1), 0)) === 1, 'one Pest token (one opponent)');
      await A.evaluate(() => { for (let i = 0; i < 4; i++){ const c = S.lib.find(x => isLand(x.k) && !/Rimewood/.test(cname(x))); if (c) moveCard(c.id, 'bf', {quiet:true}); } S.bf.filter(c => isLand(c.k)).forEach(c => { c.tap = false; }); S.bf.filter(c => isLand(c.k)).slice(0, 4).forEach(c => { c.tap = true; }); commit(); });
      await want(A, '.'); await run(A, 'Untap up to three lands you control.', 'Azusa'); await want(A, null);
      check(await A.evaluate(() => S.bf.filter(c => isLand(c.k) && c.tap).length) === 1, 'three of the four tapped lands were untapped');
      await clear(A);
    });
    await step('Rush of Inspiration: pay {E}{E} or discard at random', async () => {
      await A.evaluate(() => { S.pc = {...(S.pc || {}), energy:2}; commit(); }); const h0 = await A.evaluate(() => S.hand.length); await want(A, 'Pay 2 energy');
      await run(A, 'Discard a card at random unless you pay {E}{E}.', 'Rush of'); await want(A, null);
      check(await A.evaluate(() => S.hand.length) === h0 && await A.evaluate(() => S.pc.energy) === 0, 'paid two energy, kept the hand');
      await run(A, 'Discard a card at random unless you pay {E}{E}.', 'Rush of');
      check(await A.evaluate(() => S.hand.length) === h0 - 1, 'no energy → discarded a card at random');
    });
    await step('The Sensational She-Hulk: deals that much damage, only once each turn', async () => {
      const kl = await B.evaluate(() => S.life);
      await run(A, 'You may have The Sensational She-Hulk deal that much damage to any target. Do this only once each turn.', 'Jennifer', {tgtKim:1, it:{evN:3}}); await after();
      check(await B.evaluate(() => S.life) === kl - 3, 'Kim took 3');
      await run(A, 'You may have The Sensational She-Hulk deal that much damage to any target. Do this only once each turn.', 'Jennifer', {tgtKim:1, it:{evN:3}}); await after();
      check(await B.evaluate(() => S.life) === kl - 3, 'second time this turn: nothing');
    });
    await step('Sorin −6: gains Kim\'s creature, it becomes a Vampire with a lifelink counter (Georges controls a white permanent)', async () => {
      await bring(B, '^Grizzly Bears$', 'bf'); await bring(A, '^Wall of Omens$', 'bf'); await bring(A, '^Sorin of House', 'bf', {fl:1}); await after();
      await run(A, 'Gain control of target creature. It becomes a Vampire in addition to its other types. Put a lifelink counter on it if you control a white permanent other than that creature or Sorin.', 'Sorin of House', {tgtCard:['kim', '^Grizzly Bears$']}); await after();
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); return c ? {v:descOk(c.k, 'vampire') || /Vampire/.test(typeOf(c)), ll:(c.nc || {}).lifelink || 0, kw:kwOf(c, 'lifelink')} : null; });
      check(r && r.v && r.ll === 1 && r.kw, `Georges controls Grizzly Bears: Vampire, lifelink counter, lifelink (${JSON.stringify(r)})`);
      await clear(A); await clear(B);
    });
    await step('Expansion copies an instant/sorcery spell with mana value 4 or less only', async () => {
      const r = await A.evaluate(async () => { const kb = [...DICT.values()].find(a => a.n === 'Lightning Bolt').k, kh = [...DICT.values()].find(a => a.n === 'Divination').k;
        const s1 = {sid:rid(6), o:nextO(), kind:'spell', k:kb, nm:'Lightning Bolt', txt:'Lightning Bolt deals 3 damage to any target.', pid:MYPID, srcId:null}; S.stk.push(s1);
        const ok1 = copyLegal(s1, {kind:'spell', what:'instant or sorcery'}).ok; E27.copyMv = 0; const ok2 = copyLegal(s1, {kind:'spell', what:'instant or sorcery'}).ok; E27.copyMv = null;
        const n0 = S.stk.length; const k = [...DICT.values()].find(a => /^Expansion/.test(a.n)).k;
        await runEffects('Copy target instant or sorcery spell with mana value 4 or less.', {k, name:'Expansion', full:'', it:{kind:'spell', tgt:s1.sid}, tgts:null}); const copied = S.stk.length === n0 + 1 && /copy/.test(S.stk[S.stk.length - 1].nm);
        S.stk = []; commit(); return {ok1, ok2, copied}; });
      check(r.ok1 && !r.ok2 && r.copied, `copy legality honours the mana value limit and the copy goes on the stack (${JSON.stringify(r)})`);
      await after();
    });
    await step('The Tomb of Aclazotz: a creature cast from the graveyard enters with a finality counter and is a Vampire', async () => {
      await bring(A, "^Tarrian's Journal", 'bf', {fl:1}); await bring(A, '^Wall of Omens$', 'gy');
      const r = await A.evaluate(async () => { const t = S.bf.find(c => /Tarrian/.test(info(c.k)?.n || '')); t.tap = false; const ab = abilityList(t).find(a => /cast a creature spell from your graveyard/i.test(a.eff)); if (!ab) return 'no ability'; await activateAbility(t, ab); return 'ok'; });
      check(r === 'ok', 'activated the Tomb'); await after();
      const cast = await A.evaluate(async () => { const c = S.gy.find(x => cname(x) === 'Wall of Omens'); const g = gyOptions(c).find(o => o.a26chain); if (!g) return 'no option'; S.pool = {...emptyPool(), W:4, C:4}; await castFromGy(c, g); return 'ok'; });
      check(cast === 'ok', 'cast Wall of Omens from the graveyard'); await after();
      const w = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Wall of Omens'); return c ? {fin:(c.nc || {}).finality || 0, v:/Vampire/.test(typeOf(c)) || (c.xty || []).includes('vampire')} : null; });
      check(w && w.fin === 1 && w.v, `Wall of Omens: finality counter and Vampire (${JSON.stringify(w)})`);
      await clear(A);
    });
    await step('Ghastly Mimicry copies the enchanted (Kim\'s) creature as a Spirit', async () => {
      await bring(B, '^Grizzly Bears$', 'bf'); await after();
      await A.evaluate(() => { const opp = [...OPP.keys()][0]; const b = OPP.get(opp).bf.find(c => info(c.k)?.n === 'Grizzly Bears'); const m = S.lib.find(c => /Mirrorhall/.test(info(c.k)?.n || '')); S.lib.splice(S.lib.indexOf(m), 1); m.fl = true; m.att = {pid:opp, id:b.id}; S.bf.push(m); place(m); commit(); });
      await run(A, "Create a token that's a copy of enchanted creature, except it's a Spirit in addition to its other types.", 'Mirrorhall');
      const r = await A.evaluate(() => { const c = S.bf.find(x => x.tok && /Grizzly Bears/.test(cname(x))); return c ? typeOf(c) + ' / ' + info(c.k).t + ' / ' + c.k : null; });
      check(r && /Spirit/.test(r) && /Bear/.test(r), `a Grizzly Bears token that is also a Spirit (${r})`);
      await clear(A); await clear(B);
    });
    await step('The Legend of Yangchen: each player chooses, then exile; II: Kim draws three, then Georges draws three', async () => {
      await bring(B, '^Craterhoof', 'bf'); await bring(B, '^Grizzly Bears$', 'bf'); await bring(B, '^Wall of Omens$', 'bf'); await after();
      await want(A, 'Craterhoof');
      await run(A, 'Starting with you, each player chooses up to one permanent with mana value 3 or greater from among permanents your opponents control. Exile those permanents.', 'Yangchen'); await after(); await want(A, null);
      check(await zoneOf(B, '^Craterhoof') === 'ex', 'Craterhoof Behemoth (MV 8) was exiled');
      check(await zoneOf(B, '^Grizzly Bears$') === 'bf' && await zoneOf(B, '^Wall of Omens$') === 'bf', 'MV 2 permanents stayed');
      const ha = await A.evaluate(() => S.hand.length), hb = await B.evaluate(() => S.hand.length);
      await run(A, 'You may have target opponent draw three cards. If you do, draw three cards.', 'Yangchen', {tgtKim:1}); await after();
      check(await A.evaluate(() => S.hand.length) === ha + 3 && await B.evaluate(() => S.hand.length) === hb + 3, 'both drew three');
    });
    await step('Ajani −4: Kim keeps one of each type, sacrifices the rest', async () => {
      await bring(B, '^Pacifism$', 'bf'); await bring(B, '^Mind Stone$', 'bf'); await after();
      await run(A, 'Each opponent chooses an artifact, a creature, an enchantment, and a planeswalker from among the nonland permanents they control, then sacrifices the rest.', 'Ajani'); await after();
      const r = await B.evaluate(() => S.bf.filter(c => !isLand(c.k)).map(cname).sort());
      check(r.length === 3 && r.includes('Pacifism') && r.includes('Mind Stone'), `Kim kept an artifact, a creature and an enchantment (${r.join(', ')})`);
      await clear(B);
    });
    await step('Secret Arcade makes my nonland permanents and permanent spells enchantments; Dusty Parlor adds counters', async () => {
      await bring(A, '^Secret Arcade', 'bf'); await bring(A, '^Wall of Omens$', 'bf');
      const r = await A.evaluate(() => { const room = S.bf.find(c => /Secret Arcade/.test(info(c.k)?.n || '')); r26SetKey(room, r26RoomKey(r26Base(room), [true, false])); commit(); l24bust();
        const w = S.bf.find(c => cname(c) === 'Wall of Omens'); const kb = [...DICT.values()].find(a => a.n === 'Grizzly Bears').k; let spell = null; E27.encK = null;
        const he = handleEvent; return {wall:typeOf(w), on:e27ArcadeOn(), spell:(() => { const prev = E27.encK; E27.encK = kb; const v = descOk(kb, 'enchantment'); E27.encK = prev; return v; })()}; });
      check(/Enchantment/.test(r.wall) && r.on && r.spell, `Wall of Omens is an enchantment creature; a creature spell counts as an enchantment spell (${JSON.stringify(r)})`);
      await bring(A, '^Grizzly Bears$', 'bf');
      const kp = await A.evaluate(() => [...DICT.values()].find(a => a.n === 'Pacifism').k);
      await run(A, "Put a number of +1/+1 counters equal to that spell's mana value on up to one target creature.", 'Secret Arcade', {tgtCard:['me', '^Grizzly Bears$'], it:{evk:kp}}); await after();
      check(await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); return c && c.cp === 2; }), 'Dusty Parlor: Pacifism (MV 2) → two +1/+1 counters');
      await clear(A);
    });
    await step('Grist: knows what came from my graveyard; +1 Insect gets a deathtouch counter if a black card was milled', async () => {
      await bring(A, '^Grizzly Bears$', 'gy'); await bring(A, '^Grizzly Bears$', 'bf', {enter:1}); await bring(A, '^Wall of Omens$', 'bf', {enter:1});
      const f = await A.evaluate(() => S.bf.filter(c => ['Grizzly Bears', 'Wall of Omens'].includes(cname(c))).map(c => [cname(c), !!c.e27gyE]));
      check(JSON.stringify(f) === JSON.stringify([['Grizzly Bears', true], ['Wall of Omens', false]]), `entered from the graveyard: ${JSON.stringify(f)}`);
      await bring(A, '^Grist', 'bf', {fl:1});
      await A.evaluate(() => { const c = S.lib.find(x => /Sorin of House/.test(info(x.k)?.n || '')) || S.hand.find(x => /Sorin of House/.test(info(x.k)?.n || '')); if (c){ for (const z of ['lib', 'hand']){ const i = S[z].indexOf(c); if (i >= 0) S[z].splice(i, 1); } reset(c); S.lib.unshift(c); } commit(); });
      await run(A, 'Create a 1/1 black and green Insect creature token, then mill two cards. Put a deathtouch counter on the token if a black card was milled this way.', 'Grist');
      const t = await A.evaluate(() => { const c = S.bf.find(x => x.tok && /Insect/.test(typeOf(x))); return c ? {dt:(c.nc || {}).deathtouch || 0, kw:kwOf(c, 'deathtouch')} : null; });
      check(t && t.dt === 1 && t.kw, `Insect token with a deathtouch counter (${JSON.stringify(t)})`);
      await clear(A);
    });
    await step('O-Kagachi: Kim chooses a nonland card in Georges\'s graveyard; it returns and gives +X/+0', async () => {
      await bring(A, '^Divination$', 'gy'); await bring(A, '^The Kami War', 'bf', {fl:1});
      await B.evaluate(() => { window.__want = 'Divination'; });
      await run(A, 'Defending player chooses a nonland card in your graveyard. Return that card to your hand. This creature gets +X/+0 until end of turn, where X is the mana value of that card.', 'Kami War', {it:{evDp:'KIM'}}); await after();
      await B.evaluate(() => { window.__want = null; });
      check(await zoneOf(A, '^Divination$') === 'hand', 'Divination returned to Georges\'s hand');
      check(await A.evaluate(() => { const c = S.bf.find(x => /Kami War/.test(info(x.k)?.n || '')); return c && stats(c)[0] === 9; }), 'O-Kagachi got +3/+0 (9/6)');
      await clear(A);
    });
    await step('Retrieve Prey exiles a creature card; Georges may cast it until the end of his next turn', async () => {
      await bring(A, '^Grizzly Bears$', 'gy');
      await run(A, 'Exile target creature card from your graveyard. Until the end of your next turn, you may cast that card.', 'Tlincalli', {tgtGy:'^Grizzly Bears$'});
      const r = await A.evaluate(() => { const c = S.ex.find(x => cname(x) === 'Grizzly Bears'); return c ? {mp:!!c.mayPlay, next:!!(c.mayPlay || {}).next, ok:exWindowOk(c)} : null; });
      check(r && r.mp && r.next && r.ok, `Grizzly Bears is exiled and castable (${JSON.stringify(r)})`);
    });
    await step('Reidane: Georges\'s snow land enters tapped', async () => {
      await bring(B, '^Reidane', 'bf'); await after(); await sleep(800);
      await bring(A, '^Rimewood Falls', 'bf', {enter:1}); await bring(A, '^Llanowar Elves$', 'bf', {enter:1});
      check(await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Rimewood Falls'); return c && c.tap; }), 'Rimewood Falls (snow) entered tapped');
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Rimewood Falls'); if (c){ S.bf.splice(S.bf.indexOf(c), 1); reset(c); S.lib.push(c); } commit(); });
      await clear(A); await clear(B);
    });
    await step('The Rise of Sozin II exiles every card with the chosen name from Kim\'s zones (up to four); Fire Lord Sozin takes creatures', async () => {
      await B.evaluate(() => { const ns = ['Grizzly Bears']; const k = [...DICT.values()].find(a => a.n === 'Grizzly Bears').k; S.hand.push({id:S.nid++, k}); S.gy.push({id:S.nid++, k}); commit(); }); await after();
      const before = await B.evaluate(() => ['hand', 'lib', 'gy'].map(z => S[z].filter(c => cname(c) === 'Grizzly Bears').length));
      await want(A, '^Grizzly Bears$');
      await run(A, "Choose a card name. Search target opponent's graveyard, hand, and library for up to four cards with that name and exile them. Then that player shuffles.", 'Rise of Sozin', {tgtKim:1}); await after(); await want(A, null);
      const aft = await B.evaluate(() => ['hand', 'lib', 'gy'].map(z => S[z].filter(c => cname(c) === 'Grizzly Bears').length));
      check(before.reduce((a, b) => a + b) >= 2 && aft.reduce((a, b) => a + b) === Math.max(0, before.reduce((a, b) => a + b) - 4), `Grizzly Bears exiled from Kim's zones: ${before} → ${aft}`);
      await B.evaluate(() => { S.gy = S.gy.filter(c => cname(c) !== 'Wall of Omens'); ['Wall of Omens', 'Craterhoof Behemoth'].forEach(n => { const k = [...DICT.values()].find(a => a.n === n).k; S.gy.push({id:S.nid++, k}); }); commit(); }); await after();
      const wg0 = await count(B, 'gy', '^Wall of Omens$');
      await A.evaluate(() => { S.pool = {...emptyPool(), C:5}; commit(); }); await want(A, 'Pay \\{2\\}|Wall of Omens');
      await run(A, "You may pay {X}. When you do, put any number of target creature cards with total mana value X or less from that player's graveyard onto the battlefield under your control.", 'Rise of Sozin', {it:{evDp:'KIM'}}); await after(); await want(A, null);
      check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Wall of Omens')) && await count(B, 'gy', '^Wall of Omens$') === wg0 - 1, 'Wall of Omens (MV 2) came from Kim\'s graveyard under Georges\'s control');
      check(await A.evaluate(() => (S.pool || {}).C) === 3, 'paid {2}');
      check(await zoneOf(B, '^Craterhoof') !== 'bf' && !(await A.evaluate(() => S.bf.some(c => /Craterhoof/.test(cname(c))))), 'Craterhoof (MV 8) stayed');
      await clear(A); await clear(B);
    });
    await step('Valki exiles a creature card from Kim\'s hand until it leaves, becomes a copy of it, and the card returns to Kim\'s hand', async () => {
      await B.evaluate(() => { const k = [...DICT.values()].find(a => a.n === 'Llanowar Elves').k; S.hand.push({id:S.nid++, k}); commit(); }); await after();
      await bring(A, '^Valki', 'bf'); await want(A, 'Llanowar');
      await run(A, 'Each opponent reveals their hand. For each opponent, exile a creature card they revealed this way until Valki leaves the battlefield.', 'Valki'); await after(); await want(A, null);
      const e = await A.evaluate(() => { const c = S.ex.find(x => cname(x) === 'Llanowar Elves' && x.own); return c ? {until:c.r21until != null, back:!!c.e27toHand} : null; });
      check(e && e.until, `Kim's Llanowar Elves is exiled, linked to Valki (${JSON.stringify(e)})`);
      check(await count(B, 'hand', '^Llanowar Elves$') === 0, 'it left Kim\'s hand');
      await run(A, 'Choose a creature card exiled with Valki with mana value X. Valki becomes a copy of that card.', 'Valki', {it:{x:1}});
      check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Llanowar Elves' && !c.own)), 'Valki became a copy of Llanowar Elves');
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Llanowar Elves' && !x.own); moveCard(c.id, 'gy'); commit(); }); await after();
      check(await count(B, 'hand', '^Llanowar Elves$') === 1, 'Valki left → Llanowar Elves returned to Kim\'s hand');
      await clear(A);
    });
    await step('Welcome to . . . turns Kim\'s artifact into a 0/4 Wall while Georges has the Saga; Jurassic Park gives Dinosaurs escape', async () => {
      await bring(B, '^Mind Stone$', 'bf'); await after(); await bring(A, '^Welcome to', 'bf');
      await run(A, 'For each opponent, up to one target noncreature artifact they control becomes a 0/4 Wall artifact creature with defender for as long as you control this Saga.', 'Welcome to', {tgtCard:['kim', '^Mind Stone$']}); await after();
      const r = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Mind Stone'); return c ? {cr:isCreatureCard(c), st:stats(c), ty:typeOf(c), d:kwOf(c, 'defender')} : null; });
      check(r && r.cr && r.st[0] === 0 && r.st[1] === 4 && /Wall/.test(r.ty) && r.d, `Mind Stone is a 0/4 Wall artifact creature with defender (${JSON.stringify(r)})`);
      await A.evaluate(() => { const c = S.bf.find(x => /Welcome to/.test(info(x.k)?.n || '')); moveCard(c.id, 'gy'); commit(); }); await after(); await sleep(800);
      check(await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Mind Stone'); l24bust(); return c && !isCreatureCard(c); }), 'Saga gone → Mind Stone is no longer a creature');
      await bring(A, '^Welcome to', 'bf', {fl:1}); await bring(A, '^Ghalta, Primal', 'gy');
      check(await A.evaluate(() => { const c = S.gy.find(x => /Ghalta/.test(cname(x))); return gyOptions(c).some(o => o.kind === 'escape'); }), 'Ghalta (a Dinosaur) has escape from the graveyard');
      await clear(A); await clear(B);
    });
    await step('The Omenkeel: Kim exiles the top cards; Georges may play lands from among them', async () => {
      await B.evaluate(() => { const lands = S.lib.filter(c => isLand(c.k)).slice(0, 1); const spells = S.lib.filter(c => !isLand(c.k)).slice(0, 2); [...spells, ...lands].forEach(c => { S.lib.splice(S.lib.indexOf(c), 1); S.lib.unshift(c); }); commit(); }); await after();
      await bring(A, '^Cosima', 'bf', {fl:1});
      await run(A, 'That player exiles that many cards from the top of their library. You may play lands from among those cards for as long as they remain exiled.', 'Cosima', {it:{evDp:'KIM', evN:3}}); await after();
      const r = await A.evaluate(() => S.ex.filter(c => c.own).map(c => [isLand(c.k), !!c.mayPlay]));
      check(r.length === 3 && r.every(([l, m]) => l === m), `three of Kim's cards are exiled for Georges, only the land is playable (${JSON.stringify(r)})`);
      await clear(A);
    });
    await step('Cosima\'s voyage: exiled at upkeep, voyage counter per land, then returns with counters and draws', async () => {
      await bring(A, '^Cosima', 'bf');
      await run(A, 'You may exile Cosima. If you do, it gains "Whenever a land you control enters, if Cosima is exiled, you may put a voyage counter on it. If you don\'t, return Cosima to the battlefield with X +1/+1 counters on it and draw X cards, where X is the number of voyage counters on it."', 'Cosima');
      check(await zoneOf(A, '^Cosima') === 'ex', 'Cosima is exiled');
      await want(A, 'Voyage counter'); await bring(A, '^Rimewood Falls', 'bf', {enter:1}); await after(); await want(A, null);
      check(await A.evaluate(() => { const c = S.ex.find(x => /Cosima/.test(info(x.k)?.n || '')); return c && (c.nc || {}).voyage === 1; }), 'a land entered → one voyage counter');
      const h0 = await A.evaluate(() => S.hand.length);
      await want(A, 'Return now'); await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Rimewood Falls'); S.bf.splice(S.bf.indexOf(c), 1); reset(c); S.hand.push(c); commit(); }); await bring(A, '^Rimewood Falls', 'bf', {enter:1}); await after(); await want(A, null);
      const c = await A.evaluate(() => { const c = S.bf.find(x => /Cosima/.test(info(x.k)?.n || '')); return c ? c.cp : null; });
      check(c === 1 && await A.evaluate(() => S.hand.length) === h0 + 1, `Cosima returned with one +1/+1 counter and drew one (${c})`);
      await clear(A);
    });
    await step('Craft: Tithing Blade exiles itself and a creature card, returns as Consuming Sepulcher', async () => {
      await bring(A, '^Tithing Blade', 'bf'); await bring(A, '^Grizzly Bears$', 'gy'); await want(A, '^Grizzly Bears$');
      const r = await A.evaluate(async () => { const c = S.bf.find(x => /Tithing Blade/.test(info(x.k)?.n || '')); S.pool = {...emptyPool(), B:2, C:4}; const ab = abilityList(c).find(a => a.e27craft); if (!ab) return 'no craft'; const why = abilityReady(c, ab, false); if (why) return why; await activateAbility(c, ab); return 'ok'; });
      check(r === 'ok', `activated Craft (${r})`); await after(); await want(A, null);
      check(await A.evaluate(() => { const c = S.bf.find(x => /Tithing Blade/.test(info(x.k)?.n || '')); return c && c.fl && /Consuming Sepulcher/.test(faceOf(c).n); }), 'Consuming Sepulcher is on the battlefield');
      check(await zoneOf(A, '^Grizzly Bears$') === 'ex', 'Grizzly Bears (the material) is exiled');
      await clear(A);
    });
    await step('Craft: The Enigma Jewel with four nonlands with activated abilities; Locus has their abilities once each turn', async () => {
      await bring(A, '^The Enigma Jewel', 'bf'); for (const n of ['^Mind Stone$', '^Llanowar Elves$', '^Elvish Mystic$', '^Bramble Familiar']) await bring(A, n, 'bf');
      const r = await A.evaluate(async () => { const c = S.bf.find(x => /Enigma Jewel/.test(info(x.k)?.n || '')); S.pool = {...emptyPool(), U:2, C:8}; const ab = abilityList(c).find(a => a.e27craft); if (!ab) return 'no craft'; const why = abilityReady(c, ab, false); if (why) return why; await activateAbility(c, ab); return 'ok'; });
      check(r === 'ok', `activated Craft (${r})`); await after();
      const l = await A.evaluate(() => { const c = S.bf.find(x => /Enigma Jewel/.test(info(x.k)?.n || '')); if (!c) return null; return {face:faceOf(c).n, abs:abilityList(c).filter(a => a.e27once).map(a => a.cost), mana:manaAbs(c).filter(a => a.e27once).length}; });
      check(l && /Locus/.test(l.face) && l.abs.length === 2 && l.mana === 4, `Locus of Enlightenment has the materials' activated abilities: 2 others + 4 mana abilities (${JSON.stringify(l)})`);
      const mn = await A.evaluate(async () => { const c = S.bf.find(x => /Enigma Jewel/.test(info(x.k)?.n || '')); c.tap = false; const ab = manaAbs(c).find(a => a.e27once && /\{G\}/.test(a.eff)); const g0 = (S.pool || {}).G || 0; await activateMana(c, ab, 0); const g1 = (S.pool || {}).G || 0; c.tap = false; return {g:g1 - g0, why:abilityReady(c, ab, true), other:abilityReady(c, manaAbs(c).filter(a => a.e27once && /\{G\}/.test(a.eff))[1], true)}; });
      check(mn.g === 1 && mn.why === 'Only once each turn' && !mn.other, `Llanowar Elves's mana ability made {G} once; it can't be used again this turn, Elvish Mystic's still can (${JSON.stringify(mn)})`);
      const d = await A.evaluate(async () => { const c = S.bf.find(x => /Enigma Jewel/.test(info(x.k)?.n || '')); c.tap = false; S.pool = {...emptyPool(), C:6}; const ab = abilityList(c).find(a => a.e27once && /draw/i.test(a.eff)); const h0 = S.hand.length; await activateAbility(c, ab); return {h0}; });
      await after();
      check(await A.evaluate(() => S.hand.length) >= d.h0 + 1 && await zoneOf(A, '^The Enigma Jewel') === 'gy', "Mind Stone's ability (now Locus's): sacrificed Locus and drew a card");
      await clear(A);
    });
    await step('Poppet Factory: creature tokens lose all abilities and are 3/3', async () => {
      await bring(A, '^Poppet Stitcher', 'bf', {fl:1});
      await A.evaluate(async () => { await createFromText('Create a 1/1 white Spirit creature token with flying', {k:null, name:'t'}); commit(); }); await sleep(300);
      const r = await A.evaluate(() => { l24bust(); const c = S.bf.find(x => x.tok && /Spirit/.test(typeOf(x))); return c ? {st:stats(c), fly:kwOf(c, 'flying')} : null; });
      check(r && r.st[0] === 3 && r.st[1] === 3 && !r.fly, `the Spirit token is a 3/3 without flying (${JSON.stringify(r)})`);
      await clear(A);
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
