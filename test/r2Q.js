process.env.TOP = '1';
// Round 24Q: missing events and rare whole mechanics, played in a real 2-player game (Georges vs Kim)
const CC = require('./cards');
const WANT = ['Waste Not', 'Bone Miser', 'It That Betrays', 'Mazirek, Kraul Death Priest', 'Soulherder', 'Hedge Shredder', 'Glowing One', 'Patrolling Peacemaker', 'Krang, the All-Powerful',
  'Harsh Mentor', 'Venerated Rotpriest', 'Treasure Nabber', 'Tavern Scoundrel', 'Curse of Opulence', 'Curse of Verbosity', 'Gemrazer', 'Hanweir Battlements', 'Hanweir Garrison',
  'Final Fortune', 'Ob Nixilis Reignited', 'Chandra, Awakened Inferno', 'Incarnation Technique', 'Mindslaver', 'Liliana of the Veil', 'Wheel of Misfortune', 'Mind Grind', 'Lonis, Cryptozoologist',
  'Wandertale Mentor', 'Fell Stinger', 'The Celestus', "Curtains' Call", 'Aboleth Spawn', 'Wall of Omens', 'Llanowar Elves', 'Grizzly Bears', 'Mind Stone', 'Giant Growth', 'Mother of Runes',
  'Elvish Visionary', 'Elvish Mystic', 'Darksteel Ingot', 'Make an Example', 'Seize the Spotlight', 'Thada Adel, Acquisitor', 'Dream Harvest', 'Sorin, Lord of Innistrad', 'Darien, King of Kjeldor'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
// the meld result is fetched by name from Scryfall when the meld happens
CC.cards.push({object:'card', id:'id-hanweir-writhing-township', name:'Hanweir, the Writhing Township', mana_cost:'', cmc:0, type_line:'Legendary Creature — Eldrazi Ooze',
  oracle_text:'Trample, haste\nWhenever Hanweir, the Writhing Township attacks, create two 3/2 colorless Eldrazi Horror creature tokens that are tapped and attacking.', colors:['R'], color_identity:['R'], keywords:['Trample', 'Haste'], layout:'meld', set:'tst', collector_number:'990', power:'7', toughness:'4', prices:{usd:'1'}});
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
const cast = (p, n) => p.evaluate(async n => { const c = S.hand.find(x => cname(x) === n); if (!c) return 'not in hand'; S.pool = {...emptyPool(), W:6, U:6, B:6, R:6, G:6, C:6}; commit(); await beginCast(c, 'hand'); return S.hand.includes(c) ? 'not cast' : 'ok'; }, n);
const toGy = (p, n) => p.evaluate(n => { const c = S.bf.find(x => cname(x) === n); if (c){ moveCard(c.id, 'gy', {quiet:true}); commit(); return true; } return false; }, n);
const activate = (p, n, re) => p.evaluate(async ([n, re]) => { const c = S.bf.find(x => cname(x) === n); if (!c) return 'missing'; c.sk = false; c.tap = false; S.pool = {...emptyPool(), W:6, U:6, B:6, R:6, G:6, C:6}; const ab = abilityList(c).find(a => new RegExp(re, 'i').test(a.eff)); if (!ab) return 'no ability'; await activateAbility(c, ab); return 'ok'; }, [n, re]);
const run = (p, txt, nm, extra) => p.evaluate(async ([txt, nm, extra]) => { const k = [...DICT.values()].find(a => a.n === nm)?.k || null; const ctx = {k, name:nm, full:txt, ...(extra || {})}; if (ctx.tgtKim){ const [pid] = [...OPP.keys()]; ctx.tgts = [[{t:'player', pid, nm:nameOf(pid)}]]; } if (ctx.itX) ctx.it = {kind:'ability', x:ctx.itX}; if (ctx.evDpKim){ ctx.it = {kind:'trigger', evDp:[...OPP.keys()][0]}; } await runEffects(txt, ctx); commit(); return 'ok'; }, [txt, nm, extra]);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { await fn(); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2q');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2q');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const life = p => p.evaluate(() => S.life);
  const cnt = (p, re) => p.evaluate(re => S.bf.filter(c => new RegExp(re).test(cname(c))).reduce((a, c) => a + (c.n || 1), 0), re);
  const after = async () => { await sleep(500); await settle([A, B]); await sleep(1200); await settle([A, B]); await sleep(500); };
  const discard = (p, n) => p.evaluate(n => { const c = S.hand.find(x => cname(x) === n); if (!c) return false; UI.discarding = []; moveCard(c.id, 'gy'); UI.discarding = null; commit(); return true; }, n);
  try {
    await step('Discards by card type: Waste Not (opponent) and Bone Miser (you)', async () => {
      await put(A, 'Waste Not'); await put(A, 'Bone Miser'); await after();
      const z0 = await cnt(A, 'Zombie'); await toHand(B, 'Grizzly Bears'); check(await discard(B, 'Grizzly Bears'), 'Kim discards Grizzly Bears'); await after();
      check(await cnt(A, 'Zombie') === z0 + 1, 'Waste Not: Georges creates a 2/2 Zombie');
      const h0 = await A.evaluate(() => S.hand.length); await toHand(B, 'Giant Growth'); await discard(B, 'Giant Growth'); await after();
      const h1 = await A.evaluate(() => S.hand.length); check(h1 === h0 + 1, `Waste Not: Kim discarded a noncreature, nonland card — Georges drew (${h0} → ${h1})`);
      await toHand(A, 'Mind Grind'); await discard(A, 'Mind Grind'); await after(); const h2 = await A.evaluate(() => S.hand.length);
      check(h2 === h1 + 1, `Bone Miser: Georges discarded a noncreature, nonland card and drew one (hand ${h1 + 1} → ${h2 - 1} → ${h2})`);
      for (const n of ['Waste Not', 'Bone Miser']) await toGy(A, n);
    });
    await step('Sacrifices: It That Betrays takes Kim\'s sacrificed card; Mazirek counts every sacrifice', async () => {
      await put(A, 'It That Betrays'); await put(A, 'Mazirek, Kraul Death Priest'); await put(B, 'Mind Stone'); await after();
      await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Mind Stone'); moveCard(c.id, 'gy', {sac:true}); commit(); }); await after(); await sleep(1500); await settle([A, B]);
      check((await cnt(A, '^Mind Stone$')) === 1, 'Georges now controls Kim\'s sacrificed Mind Stone');
      const m = await A.evaluate(() => S.bf.find(c => cname(c) === 'It That Betrays')?.cp || 0); check(m >= 1, `Mazirek put a +1/+1 counter on each creature Georges controls (It That Betrays has ${m})`);
      await toGy(A, 'It That Betrays'); await toGy(A, 'Mazirek, Kraul Death Priest');
    });
    await step('Exile from the battlefield: Soulherder', async () => {
      await put(A, 'Soulherder'); await put(B, 'Llanowar Elves'); await after();
      await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Llanowar Elves'); moveCard(c.id, 'ex'); commit(); }); await after();
      check(await A.evaluate(() => S.bf.find(c => cname(c) === 'Soulherder')?.cp || 0) === 1, 'Soulherder got a +1/+1 counter when Kim\'s creature was exiled');
      await toGy(A, 'Soulherder');
    });
    await step('Library → graveyard: Hedge Shredder returns milled lands; Glowing One sees Kim mill a nonland card', async () => {
      await put(A, 'Hedge Shredder'); await put(A, 'Glowing One'); await after();
      const l0 = await A.evaluate(() => S.bf.filter(c => isLand(c.k)).length);
      await A.evaluate(() => { const i = S.lib.findIndex(c => isLand(c.k)); const [c] = S.lib.splice(i, 1); S.lib.unshift(c); mill(1); commit(); }); await after();
      const r = await A.evaluate(() => ({lands:S.bf.filter(c => isLand(c.k)).length, tapped:S.bf.filter(c => isLand(c.k) && c.tap).length}));
      check(r.lands === l0 + 1, `Hedge Shredder put the milled land onto the battlefield (${l0} → ${r.lands})`);
      const L0 = await life(A); await B.evaluate(() => { const i = S.lib.findIndex(c => !isLand(c.k)); const [c] = S.lib.splice(i, 1); S.lib.unshift(c); mill(1); commit(); }); await after();
      check(await life(A) === L0 + 1, 'Glowing One: Georges gains 1 life when Kim mills a nonland card');
      await toGy(A, 'Hedge Shredder'); await toGy(A, 'Glowing One');
    });
    await step('Crime and second draw: Patrolling Peacemaker, King T\'Challa', async () => {
      await put(A, 'Patrolling Peacemaker'); await put(A, 'Krang, the All-Powerful'); await after();
      const c0 = await A.evaluate(() => S.bf.find(c => cname(c) === 'Patrolling Peacemaker')?.cp || 0);
      await B.evaluate(() => { window.__tgt = 'Patrolling'; }); await toHand(B, 'Lightning Bolt'); await B.evaluate(async () => { S.pool = {...emptyPool(), R:3}; const c = S.hand.find(x => cname(x) === 'Lightning Bolt'); await beginCast(c, 'hand'); }); await sleep(800);
      await A.evaluate(() => { window.__want = 'Patrolling'; }); await after(); await A.evaluate(() => { window.__want = null; }); await B.evaluate(() => { window.__tgt = null; });
      const log = await A.evaluate(() => S.log.slice(-30).map(e => e.s).join(' | '));
      check(/Patrolling Peacemaker/.test(log) && /prolif/i.test(log), 'Kim committed a crime (targeted Georges\'s creature): Patrolling Peacemaker proliferated');
      await B.evaluate(() => { draw(2); }); await after();
      { const r = await A.evaluate(() => ({cp:S.bf.find(c => cname(c) === 'Krang, the All-Powerful')?.cp || 0, dbl:typeof rulesOn === 'function' && rulesOn('r25trigEv').some(x => x.ev === 'draw') ? 1 : 0}));
        // Krang's own static ("a player drawing a card causes a trigger … triggers an additional time") doubles its own second-draw trigger once that static is implemented
        check(r.cp === 1 + r.dbl, `Krang: Kim drew her second card this turn — Krang's trigger put ${r.cp} +1/+1 counter(s) (expected ${1 + r.dbl}${r.dbl ? ', its own doubler applies' : ''})`); }
      await toGy(A, 'Krang, the All-Powerful');
    });
    await step('Activated abilities: Harsh Mentor punishes Kim for activating a creature ability', async () => {
      await put(A, 'Harsh Mentor'); await put(B, 'Mother of Runes'); await after(); const L0 = await life(B);
      await B.evaluate(() => { window.__tgt = 'Mother'; }); { const ar = await activate(B, 'Mother of Runes', 'protection'); check(ar === 'ok', 'Kim activates Mother of Runes (' + ar + ')'); } await after(); await B.evaluate(() => { window.__tgt = null; });
      check(await life(B) === L0 - 2, `Harsh Mentor dealt 2 damage to Kim (${L0} → ${await life(B)})`);
      await toGy(A, 'Harsh Mentor');
    });
    await step('Becoming the target: Venerated Rotpriest gives Kim a poison counter', async () => {
      await put(A, 'Venerated Rotpriest'); await after(); const p0 = await B.evaluate(() => S.psn || 0);
      await A.evaluate(() => { window.__tgt = 'Rotpriest'; }); await toHand(A, 'Giant Growth'); check(await cast(A, 'Giant Growth') === 'ok', 'Georges casts Giant Growth on his Rotpriest');
      await A.evaluate(() => { window.__tgt = 'Kim'; }); await after(); await A.evaluate(() => { window.__tgt = null; });
      check(await B.evaluate(() => S.psn || 0) === p0 + 1, 'Kim got a poison counter');
      await toGy(A, 'Venerated Rotpriest');
    });
    await step('Tapped for mana: Treasure Nabber steals Kim\'s Mind Stone', async () => {
      await put(A, 'Treasure Nabber'); await B.evaluate(() => { for (const z of ['gy', 'lib', 'hand']){ const c = S[z].find(x => cname(x) === 'Darksteel Ingot'); if (c){ moveCard(c.id, 'bf'); break; } } commit(); }); await after();
      await B.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Darksteel Ingot'); const ab = manaAbs(c)[0]; await activateMana(c, ab, 'W'); commit(); }); await after(); await sleep(1500); await settle([A, B]);
      check(await cnt(A, 'Darksteel Ingot') === 1, 'Georges gained control of Kim\'s Darksteel Ingot');
      check(await A.evaluate(() => S.bf.find(c => cname(c) === 'Darksteel Ingot')?.qBackN != null), 'it is marked to go back at the end of Georges\'s next turn');
      await toGy(A, 'Treasure Nabber');
    });
    await step('Coin flips: Tavern Scoundrel', async () => {
      await put(A, 'Tavern Scoundrel'); await after(); const t0 = await cnt(A, 'Treasure');
      const wins = await A.evaluate(async () => { let w = 0; for (let i = 0; i < 6; i++){ const ctx = {name:'test', k:null}; await doSentence('Flip a coin.', ctx); if (ctx.coin === 'heads') w++; } commit(); return w; }); await after();
      check(await cnt(A, 'Treasure') === t0 + 2 * wins, `won ${wins} of 6 flips → ${2 * wins} Treasures`);
      await toGy(A, 'Tavern Scoundrel');
    });
    await step('Curses: Curse of Opulence and Curse of Verbosity attach to Kim and trigger when she is attacked', async () => {
      await A.evaluate(() => { window.__want = 'Kim'; }); await put(A, 'Curse of Opulence'); await sleep(800); await put(A, 'Curse of Verbosity'); await after(); await A.evaluate(() => { window.__want = null; });
      const att = await A.evaluate(() => S.bf.filter(c => /Curse/.test(cname(c))).map(c => c.att && c.att.id == null && c.att.pid !== MYPID));
      check(att.length === 2 && att.every(Boolean), 'both curses enchant Kim');
      await put(A, 'Grizzly Bears'); const g0 = await cnt(A, 'Gold'); const h0 = await A.evaluate(() => S.hand.length);
      await A.evaluate(() => { const [pid] = [...OPP.keys()]; const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); c.sk = false; S.cb = {t:turnStr(), n:9, step:'atk'}; c.atk = 'p:' + pid; setStep('atkd'); }); await after();
      check(await cnt(A, 'Gold') === g0 + 1, 'Curse of Opulence: Georges created a Gold token');
      check(await A.evaluate(() => S.hand.length) === h0 + 1, 'Curse of Verbosity: Georges drew a card');
      await A.evaluate(() => { S.bf.forEach(c => { c.atk = ''; }); S.cb = null; commit(); }); for (const n of ['Curse of Opulence', 'Curse of Verbosity']) await toGy(A, n);
    });
    await step('Mutate: Gemrazer mutates onto Grizzly Bears and destroys Kim\'s artifact', async () => {
      await put(B, 'Mind Stone'); await after(); await toHand(A, 'Gemrazer');
      await A.evaluate(() => { window.__want = 'Mutate|Grizzly|On top'; window.__tgt = 'Mind Stone'; }); check(await cast(A, 'Gemrazer') === 'ok', 'Georges casts Gemrazer for its mutate cost'); await after(); await sleep(1500); await settle([A, B]);
      await A.evaluate(() => { window.__want = null; window.__tgt = null; });
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Gemrazer'); return c ? {id:c.id, n:(c.qMutObjs || []).length, st:stats(c).join('/'), bears:S.bf.some(x => cname(x) === 'Grizzly Bears')} : null; });
      check(r && r.n === 1 && !r.bears, `Gemrazer merged with Grizzly Bears into one creature (${JSON.stringify(r)})`);
      check(await cnt(B, 'Mind Stone') === 0, 'the mutate trigger destroyed Kim\'s Mind Stone');
      await toGy(A, 'Gemrazer'); const g = await A.evaluate(() => S.gy.map(cname)); check(g.includes('Gemrazer') && g.includes('Grizzly Bears'), 'when it dies, both cards go to the graveyard');
    });
    await step('Meld: Hanweir Battlements + Hanweir Garrison → Hanweir, the Writhing Township', async () => {
      await put(A, 'Hanweir Battlements'); await put(A, 'Hanweir Garrison'); await after();
      check(await activate(A, 'Hanweir Battlements', 'meld') === 'ok', 'activated the meld ability'); await after(); await sleep(1000); await settle([A, B]);
      const r = await A.evaluate(() => ({t:S.bf.some(c => cname(c) === 'Hanweir, the Writhing Township'), b:S.bf.some(c => cname(c) === 'Hanweir Battlements'), g:S.bf.some(c => cname(c) === 'Hanweir Garrison')}));
      check(r.t && !r.b && !r.g, `melded (${JSON.stringify(r)})`);
      check(await B.evaluate(() => [...OPP.values()][0].bf.some(c => info(c.k)?.n === 'Hanweir, the Writhing Township')), 'Kim sees Hanweir, the Writhing Township');
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Hanweir, the Writhing Township'); moveCard(c.id, 'hand'); commit(); });
      const h = await A.evaluate(() => S.hand.map(cname)); check(h.includes('Hanweir Battlements') && h.includes('Hanweir Garrison'), 'bounced: both original cards return to hand');
    });
    await step('Emblems for opponents: Ob Nixilis Reignited −8 and Chandra +2', async () => {
      await run(A, 'Target opponent gets an emblem with "Whenever a player draws a card, you lose 2 life."', 'Ob Nixilis Reignited', {tgtKim:true});
      await run(A, 'Each opponent gets an emblem with "At the beginning of your upkeep, this emblem deals 1 damage to you."', 'Chandra, Awakened Inferno'); await after();
      const e = await B.evaluate(() => S.bf.filter(c => c.emb).map(c => info(c.k)?.o)); check(e.length >= 2, `Kim has the emblems: ${JSON.stringify(e)}`);
      const L0 = await life(B); await B.evaluate(() => { draw(1); }); await after(); check(await life(B) === L0 - 2, 'Kim drew a card and lost 2 life from her emblem');
    });
    await step('Demonstrate: Incarnation Technique is copied by Georges and by Kim', async () => {
      const g0 = await B.evaluate(() => S.gy.length); await toHand(A, 'Incarnation Technique'); await A.evaluate(() => { window.__want = 'Copy'; });
      check(await cast(A, 'Incarnation Technique') === 'ok', 'cast Incarnation Technique'); await after(); await sleep(1500); await settle([A, B]); await A.evaluate(() => { window.__want = null; });
      const log = await A.evaluate(() => S.log.slice(-40).map(e => e.s).join(' | ')); check(/made 1 copy/.test(log), 'Georges copied it');
      check(await B.evaluate(() => S.gy.length) > g0, 'Kim\'s copy resolved: she milled five cards');
    });
    await step('Piles: Liliana of the Veil −6 — Kim chooses which pile to sacrifice', async () => {
      await put(B, 'Elvish Mystic'); await after(); const n0 = await B.evaluate(() => S.bf.length);
      await A.evaluate(() => { window.__want = 'Elvish Mystic'; });
      await run(A, 'Separate all permanents target player controls into two piles. That player sacrifices all permanents in the pile of their choice.', 'Liliana of the Veil', {tgtKim:true}); await after(); await A.evaluate(() => { window.__want = null; });
      const r = await B.evaluate(() => ({el:S.bf.some(c => cname(c) === 'Elvish Mystic'), n:S.bf.length}));
      check(!r.el && r.n === n0 - 1, `Kim chose pile 1 (Elvish Mystic) and sacrificed it, keeping the other ${r.n} permanents of pile 2 (${JSON.stringify(r)})`);
    });
    await step('Secret numbers: Wheel of Misfortune', async () => {
      await B.evaluate(() => { S.bf.filter(c => c.emb).forEach(c => { S.bf.splice(S.bf.indexOf(c), 1); }); commit(); }); for (const n of ['Bone Miser', 'It That Betrays', 'Wall of Omens']) await toGy(A, n); await after();
      await A.evaluate(() => { window.__num = 3; }); await B.evaluate(() => { window.__num = 1; }); const L0 = await life(A), K0 = await life(B); const kh = await B.evaluate(() => S.hand.length);
      await toHand(A, 'Wheel of Misfortune'); check(await cast(A, 'Wheel of Misfortune') === 'ok', 'cast Wheel of Misfortune'); await after(); await sleep(1500); await settle([A, B]);
      check(await life(A) === L0 - 3 && await life(B) === K0, `only Georges chose the highest number (3): he takes 3 (${L0} → ${await life(A)}), Kim takes none`);
      check(await A.evaluate(() => S.hand.length) === 7, 'Georges didn\'t choose the lowest number: he discarded his hand and drew seven');
      check(await B.evaluate(() => S.hand.length) === kh, 'Kim chose the lowest: her hand is unchanged');
      await A.evaluate(() => { window.__num = null; }); await B.evaluate(() => { window.__num = null; });
    });
    await step('Opponent libraries: Mind Grind and Lonis', async () => {
      const g0 = await B.evaluate(() => S.gy.length); await run(A, 'Each opponent reveals cards from the top of their library until they reveal X land cards, then puts all cards revealed this way into their graveyard.', 'Mind Grind', {it:{kind:'spell', x:2}}); await after();
      const r = await B.evaluate(g0 => S.gy.slice(g0).filter(c => isLand(c.k)).length, g0); check(r === 2, `Kim milled until two lands (${r} lands milled)`);
      const where = await B.evaluate(() => { const b = S.bf.find(c => cname(c) === 'Grizzly Bears'); if (b){ moveCard(b.id, 'lib', {quiet:true}); commit(); return 'bf'; } for (const z of ['lib', 'gy', 'hand', 'ex']){ const i = S[z].findIndex(c => cname(c) === 'Grizzly Bears'); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.lib.unshift(c); commit(); return z; } } return 'none'; }); await after();
      console.log('    Grizzly Bears was in Kim\'s', where);
      await A.evaluate(() => { window.__want = 'Grizzly'; });
      await run(A, 'Target opponent reveals the top X cards of their library. You may put a nonland permanent card with mana value X or less from among them onto the battlefield under your control. That player puts the rest on the bottom of their library in a random order.', 'Lonis, Cryptozoologist', {tgtKim:true, itX:3}); await after(); await sleep(1500); await settle([A, B]);
      await A.evaluate(() => { window.__want = null; });
      check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Grizzly Bears' && c.id >= 0)), 'Lonis: Georges put Kim\'s Grizzly Bears onto the battlefield');
    });
    await step('Expend: Wandertale Mentor grows on the 4th mana spent', async () => {
      await put(A, 'Wandertale Mentor'); await A.evaluate(() => { S.qExp = null; }); await after();
      for (const n of ["Curtains' Call"]) await toHand(A, n);
      const cost = await A.evaluate(() => { const c = S.hand.find(x => cname(x) === "Curtains' Call"); return costStr(spellCost(c, 'hand').cost); });
      check(cost === '{4}{B}', `Undaunted: Curtains' Call costs ${cost} with one opponent`);
      await A.evaluate(() => { window.__tgt = 'Grizzly|Wall'; }); check(await cast(A, "Curtains' Call") === 'ok', "cast Curtains' Call (5 mana)"); await after(); await A.evaluate(() => { window.__tgt = null; });
      check(await A.evaluate(() => S.bf.find(c => cname(c) === 'Wandertale Mentor')?.cp || 0) === 1, 'Wandertale Mentor got a +1/+1 counter (expend 4)');
    });
    await step('Exploit: Fell Stinger sacrifices a creature and its exploit trigger resolves', async () => {
      await put(A, 'Llanowar Elves'); await A.evaluate(() => { window.__want = 'Llanowar'; window.__tgt = 'Kim'; }); const h0 = await B.evaluate(() => S.hand.length);
      await put(A, 'Fell Stinger'); await after(); await A.evaluate(() => { window.__want = null; window.__tgt = null; });
      check(await A.evaluate(() => S.gy.some(c => cname(c) === 'Llanowar Elves')), 'Fell Stinger exploited Llanowar Elves');
      check(await B.evaluate(() => S.hand.length) === h0 + 2, 'target player (Kim) drew two cards');
    });
    await step('Day and night: The Celestus', async () => {
      await put(A, 'The Celestus'); await after(); check(await A.evaluate(() => S.qDN) === 'day', 'it became day as The Celestus entered');
      check(await B.evaluate(() => q24DN()) === 'day', 'Kim\'s client knows it is day');
      const L0 = await life(A); check(await activate(A, 'The Celestus', 'night') === 'ok', 'activate: it becomes night'); await after();
      check(await A.evaluate(() => S.qDN) === 'night' && await life(A) === L0 + 1, 'night — and the day/night trigger gained Georges 1 life');
    });
    await step('Aboleth Spawn copies the enters ability of Kim\'s creature', async () => {
      await put(A, 'Aboleth Spawn'); await after(); const h0 = await A.evaluate(() => S.hand.length);
      await put(B, 'Elvish Visionary'); await after(); await sleep(1000); await settle([A, B]);
      check(await A.evaluate(() => S.hand.length) >= h0 + 1, 'Georges copied Elvish Visionary\'s "draw a card"');
    });
    await step('Mindslaver: Kim\'s decisions go to Georges\'s screen', async () => {
      await A.evaluate(() => { window.__tgt = 'Kim'; }); await run(A, 'You control target player during that player\'s next turn.', 'Mindslaver', {tgtKim:true}); await after(); await A.evaluate(() => { window.__tgt = null; });
      check(await B.evaluate(() => !!S.qSlave), 'Kim\'s client knows Georges controls her next turn');
      await A.evaluate(() => { window.__want = 'Second'; });
      const v = await B.evaluate(async () => { const q = S.qSlave; const was = currentTurn; currentTurn = () => [q.after + 1, MYPID, 0]; try { return await askChoice({title:'test question', options:[{label:'First', value:1}, {label:'Second', value:2}]}); } finally { currentTurn = was; } });
      check(v === 2, `a choice during the controlled turn was answered on Georges's screen (${v})`); await A.evaluate(() => { window.__want = null; });
    });
    await step('Final Fortune: lose at the end step of the extra turn', async () => {
      await toHand(A, 'Final Fortune'); check(await cast(A, 'Final Fortune') === 'ok', 'cast Final Fortune'); await after();
      const r = await A.evaluate(() => ({xt:S.xt || 0, after:S.qLoseAfter})); check(r.xt >= 1 && r.after != null, `extra turn queued and the loss is scheduled (${JSON.stringify(r)})`);
      const lost = await A.evaluate(() => { const was = currentTurn; currentTurn = () => [S.qLoseAfter + 1, MYPID, 0]; try { fireSteps('end', MYPID); sba(); } finally { currentTurn = was; } return S.lost; });
      check(/Final Fortune/.test(lost || ''), `Georges lost at that end step (${lost})`);
      await A.evaluate(() => { S.lost = ''; S.g23lost = 0; S.life = 40; commit(); });
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
