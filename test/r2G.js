process.env.TOP = '1';
// Round 23G: ranks 2265–3530 — cross-player effects of the cards automated in src/engine23g.js, in a real 2-player game
const CC = require('./cards');
const WANT = ['End the Festivities', 'Slaughter the Strong', 'Winds of Change', 'Tempt with Vengeance', 'Court of Ambition', 'Archfiend of Despair', 'Expel the Interlopers', 'Summon: Yojimbo',
  'Darksteel Colossus', 'Agitator Ant', 'Master of Ceremonies', 'Gilded Drake', 'Lord of the Void', 'Toxrill, the Corrosive', 'Duress', "Teferi's Time Twist", 'Inspiring Leader', 'Spectacular Showdown',
  'Render Silent', 'Keen Duelist', 'Llanowar Elves', 'Elvish Mystic', 'Wall of Omens', 'Craterhoof Behemoth', 'Divination', 'Brainstorm', 'Opt', 'Edgar Markov', 'Birds of Paradise', 'Fangs of Kalonia', 'Burning Inquiry'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name)));
const H = require('./h'); const {check, sleep, put, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
// answer questions: cards/options matching window.__want (else the first legal one); targets matching window.__tgt
const AUTO = () => { window.__want = window.__want || null; window.__tgt = window.__tgt || null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ if (!window.__tgt) return; const re = new RegExp(window.__tgt, 'i'); const c = (m.cands || []).find(x => x.ok && re.test(x.nm)); if (!c) return; m.__done = 1; m.resolve([c]); closeModal(); }
    else if (m.run){ m.__done = 1; const d = m.def ?? 1; m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const toTop = (p, names) => p.evaluate(ns => { const used = new Set(); for (const n of ns.slice().reverse()){ for (const z of ['lib', 'hand', 'gy', 'ex', 'bf']){ const i = S[z].findIndex(c => cname(c) === n && !used.has(c)); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.lib.unshift(c); used.add(c); break; } } } commit(); return S.lib.slice(0, ns.length).map(cname); }, names);
const toHand = (p, n) => p.evaluate(n => { for (const z of ['lib', 'gy', 'ex', 'bf']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.hand.push(c); commit(); return c.id; } } return S.hand.find(c => cname(c) === n)?.id; }, n);
const cast = (p, n, pool) => p.evaluate(async ([n, pool]) => { const c = S.hand.find(x => cname(x) === n); if (!c) return 'not in hand'; S.pool = {...emptyPool(), ...pool}; await beginCast(c, 'hand'); return S.hand.includes(c) ? 'not cast' : 'ok'; }, [n, pool || {C:12, W:4, U:4, B:4, R:4, G:4}]);
const clearBf = p => p.evaluate(() => { S.bf.filter(c => !isLand(c.k) && !c.cmd).forEach(c => { if (c.tok) S.bf.splice(S.bf.indexOf(c), 1); else { S.bf.splice(S.bf.indexOf(c), 1); reset(c); S.lib.push(c); } }); commit(); });
// fire one of a permanent's triggers directly (the trigger condition itself is engine-core; we test the effect)
const trig = (p, name, eff, ev, evPid) => p.evaluate(([name, eff, ev, evPid]) => { const c = S.bf.find(x => cname(x) === name); if (!c) return false; pushTrigger({k:c.k, id:c.id}, {eff, raw:eff}, ev || null, evPid || MYPID); return true; }, [name, eff, ev || null, evPid || null]);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { await fn(); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2g');
  const B = await H.player(browser, 'Kim', H.deckFor('Krenko, Mob Boss'), 'join', 'r2g');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const pidB = await B.evaluate(() => MYPID), pidA = await A.evaluate(() => MYPID);
  const life = p => p.evaluate(() => S.life);
  const names = (p, z) => p.evaluate(z => S[z].map(cname), z);
  const want = (p, w) => p.evaluate(w => { window.__want = w; }, w);
  try {
    await step('End the Festivities: 1 damage to Kim and to each of her creatures', async () => {
      await put(B, 'Llanowar Elves'); await put(B, 'Wall of Omens'); await sleep(500); await settle([A, B]);
      const lb = await life(B);
      await toHand(A, 'End the Festivities'); check(await cast(A, 'End the Festivities') === 'ok', 'Georges cast End the Festivities');
      await settle([A, B]); await sleep(800); await settle([A, B]);
      check(lb - await life(B) === 1, `Kim lost 1 life (${lb} → ${await life(B)})`);
      const bf = await names(B, 'bf'); check(!bf.includes('Llanowar Elves') && bf.includes('Wall of Omens'), "Kim's 1/1 died, her 0/4 wall survived (" + bf.filter(x => !/Mountain|Island|Swamp|Plains/.test(x)).join(', ') + ')');
    });
    await step('Slaughter the Strong: Kim keeps total power 4 or less on her own screen', async () => {
      await clearBf(B); await put(B, 'Craterhoof Behemoth'); await settle([A, B]); await sleep(400); await put(B, 'Elvish Mystic'); await put(B, 'Wall of Omens'); await sleep(400); await settle([A, B]);
      await want(B, 'Elvish Mystic|Wall of Omens');
      await toHand(A, 'Slaughter the Strong'); check(await cast(A, 'Slaughter the Strong') === 'ok', 'Georges cast Slaughter the Strong');
      await settle([A, B]); await sleep(1500); await settle([A, B]);
      const bf = await names(B, 'bf'); check(!bf.includes('Craterhoof Behemoth') && bf.includes('Elvish Mystic') && bf.includes('Wall of Omens'), "Kim kept Mystic + Wall (power 1), sacrificed Craterhoof");
      await want(B, null);
    });
    await step('Winds of Change: each player shuffles their hand in and draws that many', async () => {
      await toHand(A, 'Winds of Change'); const ha = (await names(A, 'hand')).length - 1, hb = (await names(B, 'hand')).length;
      check(await cast(A, 'Winds of Change') === 'ok', 'Georges cast Winds of Change');
      await settle([A, B]); await sleep(800);
      check((await names(A, 'hand')).length === ha && (await names(B, 'hand')).length === hb, `hand sizes kept (Georges ${ha}, Kim ${hb})`);
      check(await B.evaluate(() => S.log.slice(-6).some(e => /shuffled their hand into their library/.test(e.s))), "Kim's client shuffled and redrew");
    });
    await step('Tempt with Vengeance X=2: Kim accepts on her screen, Georges gets 2 + 2', async () => {
      await clearBf(A); await clearBf(B); await want(B, 'Create them');
      await toHand(A, 'Tempt with Vengeance'); await A.evaluate(() => { S.pool = {...emptyPool(), R:3}; commit(); });
      const r = await A.evaluate(async () => { const c = S.hand.find(x => cname(x) === 'Tempt with Vengeance'); UI.__x = 2; const oa = askNumber; askNumber = async () => 2; try { await beginCast(c, 'hand'); } finally { askNumber = oa; } return S.hand.includes(c) ? 'not cast' : 'ok'; });
      check(r === 'ok', 'Georges cast Tempt with Vengeance with X = 2');
      await settle([A, B]); await sleep(2000); await settle([A, B]);
      const ta = await A.evaluate(() => S.bf.filter(c => c.tok && /Elemental/.test(typeOf(c))).reduce((a, c) => a + (c.n || 1), 0)), tb = await B.evaluate(() => S.bf.filter(c => c.tok && /Elemental/.test(typeOf(c))).reduce((a, c) => a + (c.n || 1), 0));
      check(ta === 4 && tb === 2, `Georges has 4 Elementals, Kim has 2 (got ${ta} / ${tb})`); await want(B, null);
    });
    await step('Court of Ambition (not monarch): Kim discards a card instead of losing 3', async () => {
      await A.evaluate(() => { S.mon = 0; commit(); }); await put(A, 'Court of Ambition'); await A.evaluate(() => { S.mon = 0; commit(); }); await sleep(300); await settle([A, B]);
      await A.evaluate(() => { S.mon = 0; commit(); }); await B.evaluate(() => { S.mon = Date.now(); commit(); }); await sleep(600);
      const hb = (await names(B, 'hand')).length, lb = await life(B);
      await trig(A, 'Court of Ambition', 'Each opponent loses 3 life unless they discard a card. If you\'re the monarch, instead each opponent loses 6 life unless they discard two cards.');
      await settle([A, B]); await sleep(1500); await settle([A, B]);
      check((await names(B, 'hand')).length === hb - 1 && await life(B) === lb, `Kim discarded one card (${hb} → ${(await names(B, 'hand')).length}), life unchanged`);
    });
    await step("Archfiend of Despair: Kim loses again what she lost this turn", async () => {
      await put(A, 'Archfiend of Despair'); await B.evaluate(() => { S.life -= 4; commit(); }); await sleep(800);
      const lb = await life(B); await trig(A, 'Archfiend of Despair', 'Each opponent loses life equal to the life that player lost this turn.');
      await settle([A, B]); await sleep(800);
      check(lb - await life(B) >= 4, `Kim lost her life lost this turn again (${lb} → ${await life(B)})`);
      await B.evaluate(() => { S.life = 40; commit(); });
    });
    await step('Expel the Interlopers: choose 3, destroy all creatures with power 3 or more on both boards', async () => {
      await clearBf(A); await clearBf(B); await put(A, 'Llanowar Elves'); await put(B, 'Craterhoof Behemoth'); await settle([A, B]); await sleep(400); await put(B, 'Elvish Mystic'); await sleep(400); await settle([A, B]);
      await want(A, '^3$'); await toHand(A, 'Expel the Interlopers'); check(await cast(A, 'Expel the Interlopers') === 'ok', 'Georges cast Expel the Interlopers');
      await settle([A, B]); await sleep(1000); await want(A, null);
      const bf = await names(B, 'bf'); check(!bf.includes('Craterhoof Behemoth') && bf.includes('Elvish Mystic'), "Kim's 5/5 destroyed, her 1/1 survived");
      check((await names(A, 'bf')).includes('Llanowar Elves'), "Georges's 1/1 survived");
    });
    await step('Summon: Yojimbo II: Kim sees the attack tax of {2} per creature', async () => {
      await put(A, 'Summon: Yojimbo'); await sleep(300); await settle([A, B]);
      await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Summon: Yojimbo'); await runEffects("Until your next turn, creatures can't attack you unless their controller pays {2} for each of those creatures.", {k:c.k, name:cname(c), srcId:c.id, it:{kind:'ability'}}); commit(); });
      await sleep(1000);
      check(await B.evaluate(pid => (OPP.get(pid)?.g23?.tax || {}).n, pidA) === 2, "Kim's client sees Georges's tax of {2}");
    });
    await step('Darksteel Colossus: shuffled into the library instead of the graveyard', async () => {
      await put(A, 'Darksteel Colossus'); const lib0 = (await names(A, 'lib')).length;
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Darksteel Colossus'); moveCard(c.id, 'gy'); commit(); });
      check(!(await names(A, 'gy')).includes('Darksteel Colossus') && (await names(A, 'lib')).length === lib0 + 1, 'it went into the library, not the graveyard');
    });
    await step('Agitator Ant: both players put counters on a creature; each is goaded', async () => {
      await put(A, 'Agitator Ant'); await sleep(300);
      await want(A, 'Llanowar Elves'); await want(B, 'Elvish Mystic');
      await trig(A, 'Agitator Ant', 'Each player may put two +1/+1 counters on a creature they control. Goad each creature that had counters put on it this way.');
      await settle([A, B]); await sleep(2000); await settle([A, B]);
      const kb = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Elvish Mystic'); return c && {cp:c.cp, goad:c.goad && c.goad.by}; });
      check(kb && kb.cp === 2 && kb.goad === pidA, `Kim's Mystic got 2 counters and is goaded by Georges (${JSON.stringify(kb)})`);
      const ka = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Llanowar Elves'); return c && c.cp; }); check(ka === 2, "Georges's Elves got 2 counters");
      await want(A, null); await want(B, null);
    });
    await step('Master of Ceremonies: Kim chooses money on her screen; both create a Treasure', async () => {
      await put(A, 'Master of Ceremonies'); await want(B, 'Money');
      const ta = await A.evaluate(() => S.bf.filter(c => /Treasure/.test(cname(c))).length), tb = await B.evaluate(() => S.bf.filter(c => /Treasure/.test(cname(c))).length);
      await trig(A, 'Master of Ceremonies', 'Each opponent chooses money, friends, or secrets. For each player who chose money, you and that player each create a Treasure token. For each player who chose friends, you and that player each create a 1/1 green and white Citizen creature token. For each player who chose secrets, you and that player each draw a card.');
      await settle([A, B]); await sleep(2000); await settle([A, B]);
      const ta1 = await A.evaluate(() => S.bf.filter(c => /Treasure/.test(cname(c))).reduce((a, c) => a + (c.n || 1), 0)), tb1 = await B.evaluate(() => S.bf.filter(c => /Treasure/.test(cname(c))).reduce((a, c) => a + (c.n || 1), 0));
      check(ta1 === ta + 1 && tb1 === tb + 1, `one Treasure each (Georges ${ta}→${ta1}, Kim ${tb}→${tb1})`); await want(B, null);
    });
    await step('Gilded Drake: exchanges control with Kim\'s creature', async () => {
      await put(B, 'Elvish Mystic'); await settle([A, B]); await sleep(600);
      await A.evaluate(() => { window.__tgt = 'Elvish Mystic'; }); await A.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Gilded Drake') || S.lib.find(x => cname(x) === 'Gilded Drake'); moveCard(c.id, 'bf'); commit(); });
      await waitFor(A, () => S.bf.some(c => cname(c) === 'Elvish Mystic'), null, 15000); await settle([A, B]); await sleep(500);
      check((await names(A, 'bf')).includes('Elvish Mystic') && !(await names(A, 'bf')).includes('Gilded Drake'), 'Georges controls the Mystic, not the Drake');
      check((await names(B, 'bf')).includes('Gilded Drake') && !(await names(B, 'bf')).includes('Elvish Mystic'), 'Kim controls the Drake'); await A.evaluate(() => { window.__tgt = null; });
    });
    await step('Lord of the Void: Kim exiles her top 7; Georges takes a creature from among them', async () => {
      await put(A, 'Lord of the Void'); await settle([A, B]); await sleep(500); await toTop(B, ['Craterhoof Behemoth', 'Island', 'Island']); await want(A, 'Craterhoof'); const ex0 = (await names(B, 'ex')).length;
      const lid = await A.evaluate(() => S.bf.find(x => cname(x) === 'Lord of the Void').id);
      await trig(A, 'Lord of the Void', "Exile the top seven cards of that player's library, then put a creature card from among them onto the battlefield under your control.", {type:'cdmg', id:lid, dp:pidB}, pidA);
      await settle([A, B]); await sleep(2500); await settle([A, B]);
      check((await names(A, 'bf')).includes('Craterhoof Behemoth'), 'Craterhoof Behemoth came under Georges\'s control');
      check((await names(B, 'ex')).length - ex0 === 6, `Kim's exile has the other 6 cards (+${(await names(B, 'ex')).length - ex0})`); await want(A, null);
    });
    await step('Toxrill: Kim\'s creature with a slime counter gets -1/-1 on her client', async () => {
      await put(A, 'Toxrill, the Corrosive'); await put(B, 'Wall of Omens'); await sleep(800);
      const st = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Wall of Omens'); const s0 = stats(c); addNamed(c, 'slime', 1); commit(); return [s0, stats(c)]; });
      check(st[1][0] === st[0][0] - 1 && st[1][1] === st[0][1] - 1, `Wall of Omens ${st[0].join('/')} → ${st[1].join('/')}`);
    });
    await step('Duress: Kim reveals, Georges takes her noncreature, nonland card', async () => {
      await settle([A, B]); await toHand(B, 'Brainstorm'); await toHand(A, 'Duress'); await want(A, 'Brainstorm'); await A.evaluate(() => { window.__tgt = 'Kim'; });
      check(await cast(A, 'Duress') === 'ok', 'Georges cast Duress at Kim');
      await settle([A, B]); await sleep(2500); await settle([A, B]);
      check((await names(B, 'gy')).includes('Brainstorm') && !(await names(B, 'hand')).includes('Brainstorm'), 'Kim discarded Brainstorm');
      await want(A, null); await A.evaluate(() => { window.__tgt = null; });
    });
    await step("Teferi's Time Twist: back at the next end step with a +1/+1 counter", async () => {
      await put(A, 'Birds of Paradise'); await settle([A, B]); await toHand(A, "Teferi's Time Twist"); await A.evaluate(() => { window.__tgt = 'Birds of Paradise'; });
      check(await cast(A, "Teferi's Time Twist") === 'ok', "Georges cast Teferi's Time Twist on his Birds");
      await waitFor(A, () => !stackAll().some(i => /Time Twist/.test(i.nm)) && S.ex.some(c => cname(c) === 'Birds of Paradise'), null, 6000); await A.evaluate(() => { window.__tgt = null; });
      check(await A.evaluate(() => S.ex.some(c => cname(c) === 'Birds of Paradise') || S.dly.some(d => /Birds/.test(d.eff)) || S.bf.some(c => cname(c) === 'Birds of Paradise' && c.cp === 1)), 'the Birds were exiled with a delayed return');
      await A.evaluate(() => { fireSteps('end', MYPID); commit(); }); await settle([A, B]); await sleep(600);
      const c = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Birds of Paradise'); return c && c.cp; });
      check(c === 1, 'they returned at the end step with a +1/+1 counter');
    });
    await step('Inspiring Leader: creature tokens get +2/+2 while my commander is out', async () => {
      await put(A, 'Inspiring Leader'); await A.evaluate(async () => { await createFromText('Create a 1/1 white Soldier creature token', {name:'test', k:null}); commit(); }); await sleep(300);
      const s = await A.evaluate(() => { const cz0 = S.bf.find(c => c.cmd); if (cz0){ S.bf.splice(S.bf.indexOf(cz0), 1); S.cz.push(cz0); } const t = S.bf.filter(c => c.tok && cname(c) === 'Soldier').pop(); if (!t) return null; const a = stats(t); const cz = S.cz.find(c => c.cmd); if (cz){ moveCard(cz.id, 'bf', {quiet:true}); } const b = stats(t); return [a, b, JSON.stringify(t)]; }); console.log('    ', JSON.stringify(s));
      check(s && s[1][0] === s[0][0] + 2 && s[1][1] === s[0][1] + 2, `token ${s && s[0].join('/')} → ${s && s[1].join('/')} with Edgar out`);
    });
    await step('Spectacular Showdown: Kim\'s creature gets a double strike counter and is goaded', async () => {
      await put(B, 'Llanowar Elves'); await sleep(500); await A.evaluate(() => { window.__tgt = 'Llanowar Elves'; });
      await A.evaluate(pid => { window.__tgt = null; window.__tgtPid = pid; }, pidB);
      const id = await B.evaluate(() => S.bf.find(x => cname(x) === 'Llanowar Elves').id);
      await A.evaluate(async ([pid, id]) => { const c = {k:[...DICT.values()].find(a => a.n === 'Spectacular Showdown').k}; await runEffects('Put a double strike counter on target creature, then goad each creature that had a double strike counter put on it this way.', {k:c.k, name:'Spectacular Showdown', it:{kind:'spell'}, tgts:[[{t:'card', pid, id, k:OPP.get(pid).bf.find(b => b.id === id).k, nm:'Llanowar Elves'}]]}); commit(); }, [pidB, id]);
      await sleep(1500);
      const r = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Llanowar Elves'); return c && {ds:kwOf(c, 'double strike'), goad:c.goad && c.goad.by}; });
      check(r && r.ds && r.goad === pidA, `Kim's Elves: double strike ${r && r.ds}, goaded by Georges ${r && r.goad === pidA}`);
    });
    await step('Render Silent: counters Kim\'s spell and she can\'t cast spells this turn', async () => {
      await toHand(B, 'Opt'); await toHand(B, 'Divination'); await B.evaluate(() => { S.pool = {...emptyPool(), U:1}; commit(); });
      check(await cast(B, 'Opt', {U:1}) === 'ok', 'Kim cast Opt');
      await waitFor(A, () => stackAll().some(i => i.nm === 'Opt'));
      await toHand(A, 'Render Silent'); check(await cast(A, 'Render Silent') === 'ok', 'Georges cast Render Silent on it');
      await settle([A, B]); await sleep(1500); await settle([A, B]);
      check((await names(B, 'gy')).includes('Opt'), 'Opt was countered');
      const why = await B.evaluate(() => { S.pool = {...emptyPool(), U:3, C:3}; const c = S.hand.find(x => cname(x) === 'Divination'); return castCheck(c, 'hand'); });
      check(!why.ok && /can't cast spells/.test(why.why), `Kim can't cast Divination now (${why.why})`);
    });
    await step('Keen Duelist: both reveal and lose life equal to the other\'s card', async () => {
      await put(A, 'Keen Duelist'); await settle([A, B]); await toTop(A, ['Divination']); await toTop(B, ['Brainstorm']);
      const la = await life(A), lb = await life(B); const ha = (await names(A, 'hand')).length, hb = (await names(B, 'hand')).length;
      await trig(A, 'Keen Duelist', 'You and target opponent each reveal the top card of your library. You each lose life equal to the mana value of the card revealed by the other player. You each put the card you revealed into your hand.');
      await settle([A, B]); await sleep(2000); await settle([A, B]);
      check(la - await life(A) === 1 && lb - await life(B) === 3, `Georges lost 1 (Brainstorm), Kim lost 3 (Divination): ${la - await life(A)} / ${lb - await life(B)}`);
      check((await names(A, 'hand')).length === ha + 1 && (await names(B, 'hand')).length === hb + 1, 'each put their card into their hand');
    });
    await step('Burning Inquiry: both draw three and discard three at random', async () => {
      await B.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Divination'); }); const ha = (await names(A, 'hand')).length, hb = (await names(B, 'hand')).length; const gb = (await names(B, 'gy')).length;
      await toHand(A, 'Burning Inquiry'); check(await cast(A, 'Burning Inquiry') === 'ok', 'Georges cast Burning Inquiry');
      await settle([A, B]); await sleep(1500);
      check((await names(A, 'hand')).length === ha && (await names(B, 'hand')).length === hb, `hand sizes back to ${ha} / ${hb}`);
      check((await names(B, 'gy')).length === gb + 3, "Kim's graveyard got 3 discards");
    });
  } finally {
    await browser.close(); server.close();
    console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0);
  }
})();
