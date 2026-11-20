process.env.TOP = '1';
// Round 26Z: "exiled with this card" across players (rule 607) and casting/playing cards you don't own — real 2-player game (Georges vs Kim)
const CC = require('./cards');
const WANT = ['Banishing Light', 'Hostage Taker', 'Skyclave Apparition', 'Oubliette', 'Ghost Vacuum', 'Nautiloid Ship', 'Bronzebeak Foragers', 'Mechtitan Core', 'Sothera, the Supervoid', 'Theater of Horrors',
  'Evendo Brushrazer', "Colfenor's Urn", 'Black Cat, Cunning Thief', 'Crabomination', 'Gonti, Night Minister', 'Gonti, Lord of Luxury', 'Rev, Tithe Extractor', 'Nashi, Moon Sage\'s Scion', 'Silent-Blade Oni',
  'Tinybones, the Pickpocket', 'Tinybones, Bauble Burglar', 'Gix, Yawgmoth Praetor', 'Valgavoth, Terror Eater', 'Mari, the Killing Quill', 'Diluvian Primordial', 'Tasha, the Witch Queen', 'Inti, Seneschal of the Sun',
  "Dragonhawk, Fate's Tempest", 'Opera Love Song', 'Rakdos, the Muscle', 'Grolnok, the Omnivore', 'Eternal Scourge', 'Rocco, Street Chef',
  'Angel of Serenity', 'Shelob, Dread Weaver', 'Gisa, Glorious Resurrector', 'Kefka, Dancing Mad', 'Elder Brain', 'Arvinox, the Mind Flail', 'Rogue Class', 'Soul Partition', 'Out of Time', 'Intrepid Paleontologist', "Colfenor's Urn",
  'Grizzly Bears', 'Llanowar Elves', 'Giant Growth', 'Lightning Bolt', 'Mind Stone', 'Elvish Mystic', 'Wall of Omens', 'Darksteel Ingot', 'Swords to Plowshares', 'Counterspell', 'Pacifism', 'Wall of Omens', 'Craterhoof Behemoth', 'Divination', 'Ponder', 'Shock'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, put, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { window.__want = window.__want || null; window.__tgt = window.__tgt || null; window.__num = null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ if (!window.__tgt) return; const re = new RegExp(window.__tgt, 'i'); const c = (m.cands || []).filter(x => x.ok && re.test(x.nm)); if (!c.length){ if (m.spec && m.spec.upTo){ m.__done = 1; m.resolve([]); closeModal(); } return; } m.__done = 1; m.resolve(c.slice(0, Math.max(1, m.max || 1) > 1 ? 1 : 1)); closeModal(); }
    else if (m.run){ m.__done = 1; const d = window.__num != null ? window.__num : (m.def ?? 1); m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const toHand = (p, n) => p.evaluate(n => { for (const z of ['lib', 'gy', 'ex', 'bf']){ const i = S[z].findIndex(c => cname(c) === n && !c.own); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.hand.push(c); commit(); return c.id; } } return S.hand.find(c => cname(c) === n)?.id; }, n);
const toZone = (p, n, z) => p.evaluate(([n, z]) => { for (const y of ['lib', 'hand', 'gy', 'ex', 'bf']){ const i = S[y].findIndex(c => cname(c) === n && !c.own); if (i >= 0){ const [c] = S[y].splice(i, 1); reset(c); if (z === 'libtop') S.lib.unshift(c); else S[z].push(c); commit(); return c.id; } } return null; }, [n, z]);
const toGy = (p, n) => p.evaluate(n => { const c = S.bf.find(x => cname(x) === n); if (c){ moveCard(c.id, 'gy', {quiet:true}); commit(); return true; } return false; }, n);
const activate = (p, n, re) => p.evaluate(async ([n, re]) => { const c = S.bf.find(x => cname(x) === n); if (!c) return 'missing'; c.sk = false; c.tap = false; S.pool = {...emptyPool(), W:9, U:9, B:9, R:9, G:9, C:9}; const ab = abilityList(c).find(a => new RegExp(re, 'i').test(a.eff + ' ' + (a.cost || ''))); if (!ab) return 'no ability'; await activateAbility(c, ab); return 'ok'; }, [n, re]);
const run = (p, txt, nm, extra) => p.evaluate(async ([txt, nm, extra]) => { const k = [...DICT.values()].find(a => a.n === nm)?.k || null; const src = S.bf.find(c => c.k === k) || S.gy.find(c => c.k === k); const ctx = {k, name:nm, full:txt, srcId:src ? src.id : null, ...(extra || {})}; if (ctx.tgtKim){ const [pid] = [...OPP.keys()]; ctx.tgts = [[{t:'player', pid, nm:nameOf(pid)}]]; delete ctx.tgtKim; } const it = {sid:rid(6), kind:'trigger', k, nm, txt, srcId:ctx.srcId, ...(extra && extra.it || {})}; ctx.it = it; await runEffects(txt, ctx); commit(); return 'ok'; }, [txt, nm, extra]);
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { await T(60000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if ((H.fails() > f0 || process.env.LOGS) && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2z');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2z');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const after = async () => { await sleep(500); await settle([A, B]); await sleep(1200); await settle([A, B]); await sleep(500); };
  const where = (p, n) => p.evaluate(n => { for (const z of ['bf', 'ex', 'gy', 'hand', 'lib']) if (S[z].some(c => cname(c) === n)) return z; return 'none'; }, n);
  const kimHas = n => where(B, n); const life = p => p.evaluate(() => S.life);
  try {


    const KIM = await A.evaluate(() => [...OPP.keys()][0]); const GEO = await B.evaluate(() => [...OPP.keys()][0]);
    const exCard = (p, n) => p.evaluate(n => { const c = S.ex.find(x => cname(x) === n); return c ? {own:c.own ? c.own.pid : null, mp:!!c.mayPlay, ok:exWindowOk(c), zBy:c.zBy ?? null, nc:c.nc || {}, fd:!!c.zFd} : null; }, n);
    const castEx = (p, n, pool) => p.evaluate(async ([n, pool]) => { const c = S.ex.find(x => cname(x) === n); if (!c) return 'missing'; if (!exWindowOk(c)) return 'not allowed'; S.pool = {...emptyPool(), ...(pool || {C:9})}; commit(); if (isLand(c.k)){ playLand(c, {}); commit(); return S.ex.includes(c) ? 'not played' : 'ok'; } await beginCast(c, 'ex', c.mayPlay && c.mayPlay.free ? {free:true} : {}); return S.ex.includes(c) ? 'not cast' : 'ok'; }, [n, pool]);
    const clearA = () => A.evaluate(() => { S.bf.filter(c => !isLand(c.k)).forEach(c => { if (c.own){ moveCard(c.id, 'gy', {quiet:true}); } else if (c.tok) S.bf.splice(S.bf.indexOf(c), 1); else moveCard(c.id, 'lib', {quiet:true}); }); S.stk = []; commit(); });
    const clearB = () => B.evaluate(() => { S.bf.filter(c => !isLand(c.k)).forEach(c => { if (c.tok || c.own) S.bf.splice(S.bf.indexOf(c), 1); else moveCard(c.id, 'lib', {quiet:true}); }); S.stk = []; commit(); });
    const tgt = (p, re) => p.evaluate(re => { window.__tgt = re; }, re);
    const want = (p, re) => p.evaluate(re => { window.__want = re; }, re);

    await step('Banishing Light exiles Kim\'s creature until it leaves; Kim gets it back', async () => {
      await toHand(B, 'Grizzly Bears'); await put(B, 'Grizzly Bears'); await after();
      await tgt(A, 'Grizzly'); await put(A, 'Banishing Light'); await after(); await tgt(A, null);
      check(await kimHas('Grizzly Bears') === 'ex', 'Kim\'s Grizzly Bears is in Kim\'s exile');
      const e = await exCard(A, 'Grizzly Bears'); check(e && e.own === KIM && e.zBy != null && !e.ok, `Georges's record links it to Banishing Light, owner Kim, no play permission (${JSON.stringify(e)})`);
      await toGy(A, 'Banishing Light'); await after();
      check(await kimHas('Grizzly Bears') === 'bf', 'Banishing Light left → Grizzly Bears returned to the battlefield under Kim\'s control');
      check(!(await exCard(A, 'Grizzly Bears')), 'the linked record is gone on Georges\'s side');
      await clearB(); await clearA();
    });
    await step('Hostage Taker: the stolen card stays linked; leaving returns it, casting it makes it Georges\'s until it dies', async () => {
      await toHand(B, 'Wall of Omens'); await put(B, 'Wall of Omens'); await after();
      await tgt(A, 'Wall of'); await put(A, 'Hostage Taker'); await after(); await tgt(A, null);
      let e = await exCard(A, 'Wall of Omens'); check(e && e.own === KIM && e.ok, `Georges may cast Kim's exiled Wall of Omens (${JSON.stringify(e)})`);
      await toGy(A, 'Hostage Taker'); await after();
      check(await kimHas('Wall of Omens') === 'bf', 'Hostage Taker left before it was cast → Wall of Omens back under Kim\'s control');
      await clearA();
      await tgt(A, 'Wall of'); await put(A, 'Hostage Taker'); await after(); await tgt(A, null);
      check(await castEx(A, 'Wall of Omens', {C:9}) === 'ok', 'Georges cast Wall of Omens from exile with mana of any type'); await after();
      check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Wall of Omens' && c.own)), 'Wall of Omens is on Georges\'s battlefield (Kim owns it)');
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Wall of Omens'); destroyCard(c); commit(); }); await after();
      check(await kimHas('Wall of Omens') === 'gy', 'Wall of Omens died → it went to its owner Kim\'s graveyard');
      await clearA(); await clearB();
    });
    await step('Oubliette: Kim\'s creature phases out until it leaves, then phases in tapped', async () => {
      await toHand(B, 'Grizzly Bears'); await put(B, 'Grizzly Bears'); await after();
      await tgt(A, 'Grizzly'); await put(A, 'Oubliette'); await after(); await tgt(A, null);
      check(await kimHas('Grizzly Bears') === 'none', 'Grizzly Bears phased out (not on the battlefield, not exiled)');
      await B.evaluate(() => { turnChanged && 0; }); 
      await toGy(A, 'Oubliette'); await after();
      const r = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); return c ? {tap:!!c.tap} : null; });
      check(r && r.tap, `Oubliette left → Grizzly Bears phased in tapped (${JSON.stringify(r)})`);
      await clearA(); await clearB();
    });
    await step('Ghost Vacuum: exile from Kim\'s graveyard, later put it onto Georges\'s battlefield as a flying 1/1 Spirit', async () => {
      await toZone(B, 'Grizzly Bears', 'gy'); await after();
      await put(A, 'Ghost Vacuum'); await after(); await tgt(A, 'Grizzly');
      check(await activate(A, 'Ghost Vacuum', '^exile target card from a graveyard') === 'ok', 'activated the {T} ability'); await after(); await tgt(A, null);
      check(await kimHas('Grizzly Bears') === 'ex', 'Grizzly Bears left Kim\'s graveyard for exile');
      check(await activate(A, 'Ghost Vacuum', 'flying counter') === 'ok', 'activated the {6} ability'); await after(); await sleep(800);
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); return c ? {own:!!c.own, fly:kwOf(c, 'flying'), st:stats(c)} : null; });
      check(r && r.own && r.fly && r.st[0] === 1 && r.st[1] === 1, `Grizzly Bears is Georges's, flying, 1/1 (${JSON.stringify(r)})`);
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); destroyCard(c); commit(); }); await after();
      check(await kimHas('Grizzly Bears') === 'gy', 'it died → back in Kim\'s graveyard');
      await clearA(); await clearB();
    });
    await step('Nautiloid Ship: exile Kim\'s graveyard; on combat damage put a creature card exiled with it onto the battlefield', async () => {
      await toZone(B, 'Wall of Omens', 'gy'); await toZone(B, 'Lightning Bolt', 'gy'); await after();
      await tgt(A, 'Kim'); await put(A, 'Nautiloid Ship'); await after(); await tgt(A, null);
      check(await kimHas('Wall of Omens') === 'ex' && await kimHas('Lightning Bolt') === 'ex', 'Kim\'s graveyard was exiled');
      const sid = await A.evaluate(() => S.bf.find(c => cname(c) === 'Nautiloid Ship').id);
      await want(A, 'Wall of'); await run(A, 'You may put a creature card exiled with Nautiloid Ship onto the battlefield under your control.', 'Nautiloid Ship', {it:{evDp:KIM}}); await after(); await want(A, null);
      check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Wall of Omens' && c.own)), 'Wall of Omens entered under Georges\'s control (Kim owns it)');
      check(await kimHas('Wall of Omens') === 'none', 'Kim no longer has Wall of Omens in exile');
      await clearA(); await after();
      check(await kimHas('Wall of Omens') === 'gy' || await kimHas('Wall of Omens') === 'hand' || await kimHas('Wall of Omens') === 'lib', 'it went back to Kim when it left Georges\'s battlefield');
      await A.evaluate(() => { S.ex.filter(c => c.own).forEach(c => r21Drop(c, 'gy')); commit(); }); await after(); await clearB();
      check(await kimHas('Grizzly Bears') === 'gy' && await kimHas('Lightning Bolt') === 'gy', 'cleanup: the other linked cards went to Kim\'s graveyard through the lend');
    });
    await step('Sothera: Kim exiles a creature of her choice; at the end step Georges takes it with two extra +1/+1 counters', async () => {
      await toHand(B, 'Grizzly Bears'); await put(B, 'Grizzly Bears'); await put(A, 'Sothera, the Supervoid'); await toHand(A, 'Llanowar Elves'); await put(A, 'Llanowar Elves'); await after();
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Llanowar Elves'); destroyCard(c); commit(); }); await after(); await sleep(800); await after();
      check(await kimHas('Grizzly Bears') === 'ex', 'Kim chose and exiled Grizzly Bears');
      await A.evaluate(() => fireSteps('end', MYPID)); await after(); await sleep(800); await after();
      const r = await A.evaluate(() => ({soth:S.bf.some(c => cname(c) === 'Sothera, the Supervoid'), b:(c => c ? {own:!!c.own, st:stats(c)} : null)(S.bf.find(c => cname(c) === 'Grizzly Bears'))}));
      check(!r.soth && r.b && r.b.own && r.b.st[0] === 4, `Kim controls no creatures → Sothera sacrificed, Grizzly Bears entered under Georges with +2 counters (${JSON.stringify(r)})`);
      await clearA(); await clearB();
    });
    await step('Bronzebeak Foragers: one of Kim\'s permanents exiled; {X}{W} puts it into Kim\'s graveyard', async () => {
      await toHand(B, 'Mind Stone'); await put(B, 'Mind Stone'); await after();
      await tgt(A, 'Mind Stone'); await put(A, 'Bronzebeak Foragers'); await after(); await tgt(A, null);
      check(await kimHas('Mind Stone') === 'ex', 'Kim\'s Mind Stone exiled until Bronzebeak leaves');
      const l0 = await life(A);
      await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Bronzebeak Foragers'); const ab = abilityList(c).find(a => /into its owner's graveyard/i.test(a.eff)); S.pool = {...emptyPool(), W:5, C:5}; const it = {sid:rid(6), kind:'ability', k:c.k, nm:cname(c), txt:ab.eff, srcId:c.id, x:2}; await runEffects(ab.eff, {k:c.k, name:cname(c), srcId:c.id, it, full:ab.eff}); commit(); }); await after();
      check(await kimHas('Mind Stone') === 'gy', 'Mind Stone (mana value 2) went to Kim\'s graveyard');
      check(await life(A) === l0 + 2, 'Georges gained 2 life');
      await toGy(A, 'Bronzebeak Foragers'); await after();
      check(await kimHas('Mind Stone') === 'gy', 'it does not come back when Bronzebeak leaves');
      await clearA(); await clearB();
    });

    const discardB = n => B.evaluate(n => { const c = S.hand.find(x => cname(x) === n); if (!c) return false; moveCard(c.id, 'gy'); emit({type:'discard', k:c.k, id:c.id, cnt:1}); commit(); return true; }, n);
    await step('Tinybones, Bauble Burglar: Kim\'s discarded card is exiled with a stash counter; Georges casts it on his turn with any mana', async () => {
      await put(A, 'Tinybones, Bauble Burglar'); await toHand(B, 'Lightning Bolt'); await after();
      check(await discardB('Lightning Bolt'), 'Kim discarded Lightning Bolt'); await after(); await sleep(600); await after();
      const k = await B.evaluate(() => { const c = S.ex.find(x => cname(x) === 'Lightning Bolt'); return c ? (c.nc || {}).stash || 0 : -1; });
      check(k === 1, `Lightning Bolt is in Kim's exile with a stash counter (${k})`);
      const e = await exCard(A, 'Lightning Bolt'); check(e && e.ok && e.own === KIM, `Georges may play it during his turn (${JSON.stringify(e)})`);
      const kl = await life(B); await tgt(A, 'Kim'); check(await castEx(A, 'Lightning Bolt', {G:1}) === 'ok', 'cast with green mana (mana of any type)'); await after(); await tgt(A, null);
      check(await life(B) === kl - 3, 'Bolt hit Kim for 3'); check(await kimHas('Lightning Bolt') === 'gy', 'Bolt went to its owner Kim\'s graveyard');
      await clearA();
    });
    await step('Valgavoth: Kim\'s dying creature is exiled instead; Georges plays it on his turn paying life', async () => {
      await put(A, 'Valgavoth, Terror Eater'); await toHand(B, 'Grizzly Bears'); await put(B, 'Grizzly Bears'); await after();
      await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); destroyCard(c); commit(); }); await after(); await sleep(600); await after();
      check(await kimHas('Grizzly Bears') === 'ex', 'Grizzly Bears was exiled instead of going to Kim\'s graveyard');
      const e = await exCard(A, 'Grizzly Bears'); check(e && e.ok && e.zBy != null, `exiled with Valgavoth: Georges may play it on his turn (${JSON.stringify(e)})`);
      const l0 = await life(A); check(await castEx(A, 'Grizzly Bears', {}) === 'ok', 'cast without mana'); await after();
      check(await life(A) === l0 - 2, 'paid 2 life instead of the mana cost');
      check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Grizzly Bears' && c.own)), 'Grizzly Bears is on Georges\'s battlefield');
      await clearA(); await after(); await clearB();
    });
    await step('Tasha, the Witch Queen: +1 exiles from Kim\'s graveyard with a page counter; −3 casts it free; Demon for a spell Georges doesn\'t own', async () => {
      await toZone(B, 'Divination', 'gy'); await put(A, 'Tasha, the Witch Queen'); await after();
      const h0 = await A.evaluate(() => S.hand.length);
      await want(A, 'Divination'); await run(A, 'Draw a card. For each opponent, exile up to one target instant or sorcery card from that player\'s graveyard and put a page counter on it.', 'Tasha, the Witch Queen'); await after();
      const k = await B.evaluate(() => { const c = S.ex.find(x => cname(x) === 'Divination'); return c ? (c.nc || {}).page || 0 : -1; }); check(k === 1, `Divination is in Kim's exile with a page counter (${k})`);
      await want(A, null); await run(A, 'You may cast a spell from among cards in exile with page counters on them without paying its mana cost.', 'Tasha, the Witch Queen'); await after(); await sleep(500); await after();
      check(await A.evaluate(() => S.hand.length) === h0 + 3, 'drew 1 (+1) and 2 (Divination)');
      check(await A.evaluate(() => S.bf.some(c => c.tok && /Demon/.test(cname(c) + typeOf(c)))), 'Tasha made a 3/3 Demon for casting a spell Georges doesn\'t own');
      check(await kimHas('Divination') === 'gy', 'Divination went to Kim\'s graveyard');
      await clearA();
    });
    await step('Gonti, Night Minister: Kim\'s top card exiled face down for Georges; casting it makes a Treasure', async () => {
      await put(A, 'Gonti, Night Minister'); await toZone(B, 'Shock', 'libtop'); await after();
      await run(A, "Its controller looks at the top card of that opponent's library and exiles it face down. They may play that card for as long as it remains exiled. Mana of any type can be spent to cast a spell this way.", 'Gonti, Night Minister', {it:{evPid:await A.evaluate(() => MYPID), evDp:KIM}}); await after();
      const e = await exCard(A, 'Shock'); check(e && e.ok && e.fd, `Georges may play Kim's face-down Shock (${JSON.stringify(e)})`);
      const t0 = await A.evaluate(() => S.bf.filter(c => /Treasure/.test(cname(c))).length);
      await tgt(A, 'Kim'); check(await castEx(A, 'Shock', {G:1}) === 'ok', 'cast Shock with green mana'); await after(); await tgt(A, null);
      check(await A.evaluate(() => S.bf.filter(c => /Treasure/.test(cname(c))).length) === t0 + 1, 'Gonti: a player cast a spell they don\'t own → Treasure');
      await clearA();
    });
    await step('Black Cat: two of Kim\'s top nine exiled face down, playable for as long as they remain exiled', async () => {
      await toZone(B, 'Ponder', 'libtop'); await toZone(B, 'Giant Growth', 'libtop'); await want(A, 'Ponder|Giant Growth'); await tgt(A, 'Kim');
      await put(A, 'Black Cat, Cunning Thief'); await after(); await want(A, null); await tgt(A, null);
      check(await kimHas('Ponder') === 'ex' && await kimHas('Giant Growth') === 'ex', 'Ponder and Giant Growth are in Kim\'s exile');
      const e = await exCard(A, 'Ponder'); check(e && e.ok && e.fd, `Georges may play them (${JSON.stringify(e)})`);
      check(await castEx(A, 'Ponder', {G:1}) === 'ok', 'cast Ponder with green mana'); await after();
      check(await kimHas('Ponder') === 'gy', 'Ponder went to Kim\'s graveyard'); await clearA();
    });
    await step('Crabomination: library, graveyard, hand → cast one free', async () => {
      await toZone(B, 'Divination', 'gy'); await toHand(B, 'Shock'); const hk = await B.evaluate(() => S.hand.length);
      await tgt(A, 'Kim'); await want(A, '^Cast it'); await put(A, 'Crabomination'); await after(); await sleep(500); await after(); await tgt(A, null); await want(A, null);
      const kex = await B.evaluate(() => S.ex.length); check(await B.evaluate(() => S.hand.length) === hk - 1, 'Kim lost a card from her hand');
      check(await A.evaluate(() => S.casts.filter(x => x.t === turnStr()).length) > 0, 'Georges cast one of them');
      await clearA();
    });
    await step('Nashi: one of the exiled cards, paying life', async () => {
      await toZone(B, 'Shock', 'libtop'); await toZone(A, 'Ponder', 'libtop');
      await run(A, "Exile the top card of each player's library. Until end of turn, you may play one of those cards. If you cast a spell this way, pay life equal to its mana value rather than paying its mana cost.", "Nashi, Moon Sage's Scion"); await after();
      check((await exCard(A, 'Shock') || {}).ok && (await exCard(A, 'Ponder') || {}).ok, 'both Kim\'s Shock and Georges\'s Ponder are playable');
      const l0 = await life(A); await tgt(A, 'Kim'); check(await castEx(A, 'Shock', {}) === 'ok', 'cast Shock without mana'); await after(); await tgt(A, null);
      check(await life(A) === l0 - 1, 'paid 1 life');
      check(!(await exCard(A, 'Ponder') || {}).ok, 'Ponder is no longer playable (only one of those cards)');
    });
    await step('Rev: Kim\'s top card face down, castable for as long as it remains exiled', async () => {
      await toZone(B, 'Divination', 'libtop');
      await run(A, "Look at the top card of that player's library and exile it face down. You may cast that card for as long as it remains exiled.", 'Rev, Tithe Extractor', {it:{evDp:KIM}}); await after();
      const e = await exCard(A, 'Divination'); check(e && e.ok && e.fd && e.own === KIM, `Divination exiled face down for Georges (${JSON.stringify(e)})`);
    });
    await step('Silent-Blade Oni: cast a spell from Kim\'s hand; a declined one stays in her hand', async () => {
      await toHand(B, 'Divination'); const h0 = await A.evaluate(() => S.hand.length);
      await want(A, '^(Divination|Cast it)'); await run(A, "Look at that player's hand. You may cast a spell from among those cards without paying its mana cost.", 'Silent-Blade Oni', {it:{evDp:KIM}}); await after(); await want(A, null);
      check(await A.evaluate(() => S.hand.length) === h0 + 2, 'Georges cast Kim\'s Divination for free and drew 2');
      check(await kimHas('Divination') === 'gy', 'Divination went to Kim\'s graveyard');
      await toHand(B, 'Ponder'); await want(A, '^(Ponder|No)$');
      await run(A, "Look at that player's hand. You may cast a spell from among those cards without paying its mana cost.", 'Silent-Blade Oni', {it:{evDp:KIM}}); await after(); await want(A, null);
      check(await kimHas('Ponder') === 'hand', 'declined: Ponder is back in Kim\'s hand');
    });
    await step('Tinybones, the Pickpocket / Diluvian Primordial: cast from Kim\'s graveyard', async () => {
      await toZone(B, 'Mind Stone', 'gy'); await after(); await A.evaluate(() => { S.pool = {...emptyPool(), G:3}; commit(); });
      await want(A, 'Mind Stone|Cast it'); await run(A, "You may cast target nonland permanent card from that player's graveyard, and mana of any type can be spent to cast that spell.", 'Tinybones, the Pickpocket', {it:{evDp:KIM}}); await after(); await want(A, null);
      console.log('    A bf:', JSON.stringify(await A.evaluate(() => S.bf.filter(c => !isLand(c.k)).map(c => cname(c) + (c.own ? '*' : '')))));
      check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Mind Stone' && c.own)), 'Georges cast Kim\'s Mind Stone from her graveyard with green mana');
      await toZone(B, 'Lightning Bolt', 'gy'); const kl = await life(B); await tgt(A, 'Lightning Bolt|Kim'); await want(A, 'Lightning Bolt|Cast it');
      await put(A, 'Diluvian Primordial'); await A.evaluate(() => { S.stk = S.stk.filter(x => x.nm !== 'Diluvian Primordial'); if (UI.modal && UI.modal.resolve){ UI.modal.resolve(null); closeModal(); } commit(); }); await after();
      await run(A, "For each opponent, you may cast up to one target instant or sorcery card from that player's graveyard without paying its mana cost. If a spell cast this way would be put into a graveyard, exile it instead.", 'Diluvian Primordial'); await after(); await sleep(500); await after(); await tgt(A, null); await want(A, null);
      check(await life(B) === kl - 3, 'Diluvian Primordial: Kim\'s Lightning Bolt cast for free at Kim');
      check(await kimHas('Lightning Bolt') === 'ex', 'the Bolt was exiled instead of going to a graveyard');
      await clearA(); await after();
    });
    await step('Mari: Kim\'s dying creature is exiled with a hit counter (counted on Kim\'s side)', async () => {
      await put(A, 'Mari, the Killing Quill'); await toHand(B, 'Grizzly Bears'); await put(B, 'Grizzly Bears'); await after();
      await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); destroyCard(c); commit(); }); await after(); await sleep(500); await after();
      const r = await B.evaluate(() => { const c = S.ex.find(x => cname(x) === 'Grizzly Bears'); return c ? {hit:(c.nc || {}).hit || 0, p:!!c.p24hit} : null; });
      check(r && r.hit === 1 && r.p, `Grizzly Bears in Kim's exile with a hit counter (${JSON.stringify(r)})`);
      check(!!(await exCard(A, 'Grizzly Bears')), 'Georges\'s record links it to Mari');
      await A.evaluate(() => { S.ex.filter(c => c.own).forEach(c => { c.zBy = null; r21Drop(c, 'gy'); }); commit(); }); await after(); await clearA();
    });
    await step('Theater of Horrors: exiled with it, playable only if an opponent lost life this turn', async () => {
      await put(A, 'Theater of Horrors'); await toZone(A, 'Ponder', 'libtop'); await after();
      await run(A, 'Exile the top card of your library.', 'Theater of Horrors'); await after();
      await A.evaluate(() => { S.r21blife = null; S.r21blost = null; commit(); });
      let e = await exCard(A, 'Ponder'); check(e && e.zBy != null && !e.ok, `Ponder exiled with Theater, not playable yet (${JSON.stringify(e)})`);
      await A.evaluate(() => { S.r21blost = turnStr(); commit(); });
      e = await exCard(A, 'Ponder'); check(e && e.ok, 'after an opponent lost life it is playable');
      await A.evaluate(() => { const c = S.ex.find(x => cname(x) === 'Ponder' && !x.own); if (c){ S.ex.splice(S.ex.indexOf(c), 1); S.lib.push(c); } commit(); }); await clearA();
    });
    await step('Grolnok: a milled permanent card is exiled with a croak counter and is playable', async () => {
      await put(A, 'Grolnok, the Omnivore'); await toZone(A, 'Grizzly Bears', 'libtop'); await after();
      await A.evaluate(() => { mill(1); commit(); }); await after(); await sleep(500); await after();
      await A.evaluate(() => { const c = S.ex.find(x => cname(x) === 'Grizzly Bears' && x.own); if (c){ c.zBy = null; r21Drop(c, 'gy'); } commit(); }); await after();
      const e = await exCard(A, 'Grizzly Bears'); check(e && e.ok && (e.nc.croak || 0) === 1, `Grizzly Bears exiled with a croak counter, playable (${JSON.stringify(e)})`);
      await clearA();
    });

    await step('Angel of Serenity: Kim\'s creature and a card from her graveyard; they return to Kim\'s hand when the Angel leaves', async () => {
      await toHand(B, 'Grizzly Bears'); await put(B, 'Grizzly Bears'); await toZone(B, 'Llanowar Elves', 'gy'); await after();
      await tgt(A, 'Grizzly Bears|Llanowar'); await put(A, 'Angel of Serenity'); await passAll([A, B]); await sleep(2500); if (process.env.DBGZ) console.log('MODAL', await A.evaluate(() => JSON.stringify(UI.modal && {max:UI.modal.max, min:UI.modal.min, cands:(UI.modal.cands || []).map(c => [c.nm, c.ok, c.t])}))); await after(); await tgt(A, null);
      const r1 = [await kimHas('Grizzly Bears'), await kimHas('Llanowar Elves')]; check(r1.includes('ex'), `exiled (${r1})`);
      await toGy(A, 'Angel of Serenity'); await after();
      const r2 = [await kimHas('Grizzly Bears'), await kimHas('Llanowar Elves')]; check(r2.filter(x => x === 'hand').length === r1.filter(x => x === 'ex').length, `the exiled cards went to Kim's hand (${r2})`);
      await clearA(); await clearB();
    });
    await step('Shelob: Kim\'s dead creature exiled with it; {X}{1}{B} puts it onto Georges\'s battlefield tapped', async () => {
      await put(A, 'Shelob, Dread Weaver'); await toHand(B, 'Grizzly Bears'); await put(B, 'Grizzly Bears'); await after();
      await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); destroyCard(c); commit(); }); await after(); await sleep(500); await after();
      check(await kimHas('Grizzly Bears') === 'ex', 'Grizzly Bears exiled from Kim\'s graveyard');
      await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Shelob, Dread Weaver'); const t = "Put target creature card with mana value X exiled with Shelob, Dread Weaver onto the battlefield tapped under your control."; await runEffects(t, {k:c.k, name:cname(c), srcId:c.id, it:{sid:rid(6), kind:'ability', k:c.k, srcId:c.id, x:2}, full:t}); commit(); }); await after();
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); return c ? {own:!!c.own, tap:!!c.tap} : null; });
      check(r && r.own && r.tap, `Grizzly Bears entered tapped under Georges's control (${JSON.stringify(r)})`);
      await clearA(); await after(); await clearB();
    });
    await step('Gisa: Kim\'s creature exiled instead of dying; at upkeep it comes in under Georges with decayed', async () => {
      await put(A, 'Gisa, Glorious Resurrector'); await toHand(B, 'Grizzly Bears'); await put(B, 'Grizzly Bears'); await after();
      await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); destroyCard(c); commit(); }); await after(); await sleep(500); await after();
      check(await kimHas('Grizzly Bears') === 'ex', 'Grizzly Bears exiled instead of dying');
      if (process.env.DBGZ) console.log('GISA', await B.evaluate(() => JSON.stringify([staticRules().filter(r => /Gisa/.test(r.src)), S.lent.length, (S.r21L || []).length])));
      await A.evaluate(() => fireSteps('upkeep', MYPID)); await after(); await sleep(500); await after();
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); return c ? {own:!!c.own, dec:kwOf(c, 'decayed') || (c.ekw || []).includes('decayed')} : null; });
      check(r && r.own && r.dec, `Grizzly Bears is Georges's with decayed (${JSON.stringify(r)})`);
      await clearA(); await after(); await clearB();
    });
    await step('Kefka: a random card from Kim\'s graveyard, cast free; Kim loses life equal to its mana value', async () => {
      await B.evaluate(() => { S.gy.splice(0).forEach(c => S.lib.push(c)); commit(); }); await toZone(B, 'Divination', 'gy'); await after();
      const kl = await life(B); await want(A, '^Cast it');
      await run(A, "Exile a card at random from each opponent's graveyard. You may cast any number of spells from among cards exiled this way without paying their mana costs. Then each player who owns a spell you cast this way loses life equal to its mana value.", 'Kefka, Dancing Mad'); await after(); await want(A, null);
      check(await life(B) === kl - 3, `Kim lost 3 life for Divination (${kl} → ${await life(B)})`);
      check(await kimHas('Divination') === 'gy', 'Divination back in Kim\'s graveyard');
    });
    await step('Elder Brain: Kim\'s hand exiled, she draws that many; Georges may play them', async () => {
      await toHand(B, 'Ponder'); const h = await B.evaluate(() => S.hand.length);
      await run(A, "Exile all cards from that player's hand, then they draw that many cards. You may play lands and cast spells from among the exiled cards for as long as they remain exiled. If you cast a spell this way, you may spend mana as though it were mana of any color to cast it.", 'Elder Brain', {it:{evDp:KIM}}); await after();
      check(await B.evaluate(() => S.hand.length) === h && await kimHas('Ponder') !== 'hand', `Kim's hand was exiled and she drew ${h}`);
      const e = await exCard(A, 'Ponder'); check(e && e.ok, `Georges may play Kim's Ponder (${JSON.stringify(e)})`);
      check(await castEx(A, 'Ponder', {G:1}) === 'ok', 'cast Ponder with green mana'); await after();
      await A.evaluate(() => { S.ex.filter(c => c.own).forEach(c => { c.zBy = null; r21Drop(c, 'gy'); }); commit(); }); await after();
    });
    await step('Arvinox: the bottom card of Kim\'s library face down; only permanent spells; Arvinox is a creature only with three permanents Georges doesn\'t own', async () => {
      await put(A, 'Arvinox, the Mind Flail'); await B.evaluate(() => { const i = S.lib.findIndex(c => cname(c) === 'Mind Stone'); if (i >= 0){ const [c] = S.lib.splice(i, 1); S.lib.push(c); } else { const j = S.gy.findIndex(c => cname(c) === 'Mind Stone'); if (j >= 0){ const [c] = S.gy.splice(j, 1); S.lib.push(c); } } commit(); }); await after();
      check(!(await A.evaluate(() => isCreatureCard(S.bf.find(c => cname(c) === 'Arvinox, the Mind Flail')))), 'Arvinox is not a creature (no permanents Georges doesn\'t own)');
      await run(A, "Exile the bottom card of each opponent's library face down. For as long as those cards remain exiled, you may look at them, you may cast permanent spells from among them, and you may spend mana as though it were mana of any color to cast those spells.", 'Arvinox, the Mind Flail'); await after();
      const e = await exCard(A, 'Mind Stone'); check(e && e.ok && e.fd, `Kim's Mind Stone is castable (${JSON.stringify(e)})`);
      await toZone(B, 'Shock', 'lib'); await B.evaluate(() => { const i = S.lib.findIndex(c => cname(c) === 'Shock'); const [c] = S.lib.splice(i, 1); S.lib.push(c); commit(); }); await after();
      await run(A, "Exile the bottom card of each opponent's library face down. For as long as those cards remain exiled, you may look at them, you may cast permanent spells from among them, and you may spend mana as though it were mana of any color to cast those spells.", 'Arvinox, the Mind Flail'); await after();
      const e2 = await exCard(A, 'Shock'); check(e2 && !e2.ok, 'Shock (not a permanent spell) is not castable');
      await A.evaluate(() => { S.ex.filter(c => c.own).forEach(c => { c.zBy = null; r21Drop(c, 'libb'); }); commit(); }); await after(); await clearA();
    });
    await step('Soul Partition: Kim\'s permanent exiled; Kim may play it for {2} more', async () => {
      await toHand(B, 'Mind Stone'); await put(B, 'Mind Stone'); await after(); await tgt(A, 'Mind Stone');
      await A.evaluate(async () => { const t = 'Exile target nonland permanent. For as long as that card remains exiled, its owner may play it. A spell cast by an opponent this way costs {2} more to cast.'; const pid = [...OPP.keys()][0]; const c = OPP.get(pid).bf.find(x => x.k && info(x.k)?.n === 'Mind Stone'); await runEffects(t, {k:null, name:'Soul Partition', full:t, tgts:[[{t:'card', pid, id:c.id, k:c.k, nm:'Mind Stone'}]], it:{sid:rid(6), kind:'spell'}}); commit(); }); await after(); await tgt(A, null);
      const r = await B.evaluate(() => { const c = S.ex.find(x => cname(x) === 'Mind Stone'); if (!c) return null; const sc = spellCost(c, 'ex'); return {ok:exWindowOk(c), gen:sc.cost.gen}; });
      check(r && r.ok && r.gen === 4, `Kim may play Mind Stone from exile for {4} (${JSON.stringify(r)})`);
      if (process.env.DBGZ) console.log('SOUL', await B.evaluate(() => { const c = S.ex.find(x => cname(x) === 'Mind Stone'); S.pool = {...emptyPool(), C:4}; return JSON.stringify({cc:castCheck(c, 'ex'), t:timingOk(c), mp:c.mayPlay, turn:currentTurn()}); }));
      check(await B.evaluate(() => /sorcery speed/i.test(castCheck(S.ex.find(x => cname(x) === 'Mind Stone'), 'ex').why || '')), 'on Georges\'s turn Kim still needs sorcery timing for it');
      await B.evaluate(() => { const c = S.ex.find(x => cname(x) === 'Mind Stone'); if (c){ S.ex.splice(S.ex.indexOf(c), 1); delete c.mayPlay; S.lib.push(c); } commit(); }); await clearB();
    });
    await step('Rogue Class: Kim\'s top card face down, linked; playable at level 3', async () => {
      await put(A, 'Rogue Class'); await toZone(B, 'Ponder', 'libtop'); await after();
      await run(A, "Exile the top card of that player's library face down. You may look at it for as long as it remains exiled.", 'Rogue Class', {it:{evDp:KIM}}); await after();
      let e = await exCard(A, 'Ponder'); check(e && e.fd && e.zBy != null && !e.ok, `exiled with Rogue Class, not playable at level 1 (${JSON.stringify(e)})`);
      await A.evaluate(() => { S.bf.find(c => cname(c) === 'Rogue Class').lvl = 3; commit(); });
      e = await exCard(A, 'Ponder'); check(e && e.ok, 'playable at level 3');
      check(await castEx(A, 'Ponder', {G:1}) === 'ok', 'cast with green mana'); await after(); await clearA();
    });
    await step('Mechtitan Core: the token leaving returns the cards exiled with it, tapped', async () => {
      await put(A, 'Mechtitan Core'); await toHand(A, 'Darksteel Ingot'); await put(A, 'Darksteel Ingot'); await toHand(A, 'Mind Stone'); await put(A, 'Mind Stone'); await after();
      await A.evaluate(async () => { const core = S.bf.find(c => cname(c) === 'Mechtitan Core'); const ab = abilityList(core).find(a => /Mechtitan/.test(a.eff)); ['Darksteel Ingot', 'Mind Stone'].forEach(n => { const c = S.bf.find(x => cname(x) === n); moveCard(c.id, 'ex', {quiet:true}); zTag(S.ex.find(x => x.id === c.id), core.id); });
        moveCard(core.id, 'ex', {quiet:true}); zTag(S.ex.find(x => x.id === core.id), core.id); await runEffects(ab.eff, {k:core.k, name:cname(core), srcId:core.id, it:{sid:rid(6), kind:'ability', k:core.k, srcId:core.id}, full:ab.eff}); commit(); }); await after();
      const tk = await A.evaluate(() => S.bf.filter(c => c.tok).map(c => cname(c) + ':' + stats(c).join('/'))); check(tk.some(n => /10\/10/.test(n)), `the 10/10 Mechtitan token was created (${tk})`);
      await A.evaluate(() => { const t = S.bf.filter(c => c.tok).pop(); destroyCard(t); commit(); }); await after();
      const r = await A.evaluate(() => ['Darksteel Ingot', 'Mind Stone', 'Mechtitan Core'].map(n => { const c = S.bf.find(x => cname(x) === n); return c ? (c.tap ? 'tapped' : 'untapped') : 'gone'; }));
      check(r[0] === 'tapped' && r[1] === 'tapped' && r[2] === 'gone', `the two artifacts returned tapped, the Core stays exiled (${r})`);
      await clearA();
    });
    await step('Skyclave Apparition: Kim\'s permanent exiled; when it leaves Kim gets an X/X Illusion', async () => {
      await toHand(B, 'Mind Stone'); await put(B, 'Mind Stone'); await after(); await tgt(A, 'Mind Stone'); await put(A, 'Skyclave Apparition'); await after(); await tgt(A, null);
      check(await kimHas('Mind Stone') === 'ex', 'Mind Stone exiled');
      await toGy(A, 'Skyclave Apparition'); await after(); await sleep(500); await after();
      check(await B.evaluate(() => S.bf.some(c => c.tok && /Illusion/.test(cname(c) + typeOf(c)) && stats(c)[0] === 2)), 'Kim created a 2/2 Illusion');
      check(await kimHas('Mind Stone') === 'ex', 'Mind Stone stays exiled'); await clearB();
    });

    await step('Out of Time: every creature phases out until it leaves, with a time counter each; all come back', async () => {
      await toHand(A, 'Grizzly Bears'); await toHand(B, 'Llanowar Elves'); await put(A, 'Grizzly Bears'); await put(B, 'Llanowar Elves'); await after();
      await put(A, 'Out of Time'); await after(); await sleep(500); await after();
      const r = [await where(A, 'Grizzly Bears'), await kimHas('Llanowar Elves'), await A.evaluate(() => (S.bf.find(c => cname(c) === 'Out of Time')?.nc || {}).time || 0)];
      check(r[0] === 'none' && r[1] === 'none' && r[2] === 2, `both creatures phased out, 2 time counters (${r})`);
      await toGy(A, 'Out of Time'); await after();
      check(await where(A, 'Grizzly Bears') === 'bf' && await kimHas('Llanowar Elves') === 'bf', 'Out of Time left → both phased in');
      await clearA(); await clearB();
    });
    await step("Colfenor's Urn: big creatures exiled with it come back at the end step once three are there", async () => {
      await put(A, "Colfenor's Urn"); await toHand(A, 'Wall of Omens'); await put(A, 'Wall of Omens'); await toHand(A, 'Craterhoof Behemoth'); await put(A, 'Craterhoof Behemoth'); await after();
      await want(A, '^Exile it');
      for (const n of ['Wall of Omens', 'Craterhoof Behemoth']) { await A.evaluate(n => { const c = S.bf.find(x => cname(x) === n); destroyCard(c); commit(); }, n); await after(); await sleep(400); await after(); }
      await want(A, null);
      check(await A.evaluate(() => S.ex.filter(c => c.zBy != null && ['Wall of Omens', 'Craterhoof Behemoth'].includes(cname(c))).length) === 2, 'both were exiled with the Urn');
      await A.evaluate(() => fireSteps('end', MYPID)); await after(); await sleep(400); await after();
      check(await where(A, "Colfenor's Urn") === 'bf', 'with only two exiled, the Urn stays');
      await A.evaluate(() => { const u = S.bf.find(c => cname(c) === "Colfenor's Urn"); const g = S.lib.find(c => cname(c) === 'Grizzly Bears') || S.gy.find(c => cname(c) === 'Grizzly Bears') || S.ex.find(c => cname(c) === 'Grizzly Bears' && !c.own) || S.hand.find(c => cname(c) === 'Grizzly Bears'); const z = find(g.id)[0]; S[z].splice(S[z].indexOf(g), 1); S.ex.push(g); zTag(g, u.id); commit(); });
      await A.evaluate(() => fireSteps('end', MYPID)); await after(); await sleep(400); await after();
      const r = await A.evaluate(() => [S.bf.some(c => cname(c) === "Colfenor's Urn"), ['Wall of Omens', 'Craterhoof Behemoth', 'Grizzly Bears'].filter(n => S.bf.some(c => cname(c) === n)).length]);
      check(!r[0] && r[1] === 3, `three exiled → Urn sacrificed, the three returned (${r})`);
      await clearA();
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  console.log(`\n${H.results.filter(r => r.startsWith('PASS')).length} passed, ${H.fails()} failed`);
  await browser.close(); process.exit(H.fails() ? 1 : 0);
})();
