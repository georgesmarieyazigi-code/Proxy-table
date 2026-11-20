process.env.TOP = '1';
// Round 23 helper I (ranks 4450–5292): real 2-player game, the automated cards' text resolved as it would on the stack.
// Effects that touch Kim's cards travel as requests to Kim's own client; Kim's choices are made on Kim's screen.
const CC = require('./cards');
const WANT = ['Swashbuckler Extraordinaire', "Tifa's Limit Break", 'Terisian Mindbreaker', 'Galvanic Blast', 'Hunted Horror', 'Éomer, King of Rohan', 'Kiora Bests the Sea God',
  'Uchuulon', 'Oblivion Ring', 'Snort', 'Planetary Annihilation', 'Relic of Progenitus', 'Goblin Chainwhirler', 'Wave of Reckoning', 'Engulf the Shore', 'Fecundity', 'Bounty Board',
  'Valley Mightcaller', 'Claim Jumper', 'Tinybones, Trinket Thief', 'Sol Ring', 'Skullclamp', "Wayfarer's Bauble", 'Endless Evil', 'God-Eternal Rhonas', 'Keep Watch', 'Hammers of Moradin',
  'Soul of Windgrace', 'Fumulus, the Infestation', 'Nicol Bolas, God-Pharaoh', 'Summon: Valefor', 'Yorion, Sky Nomad', 'Klothys, God of Destiny', 'Ancient Animus', 'Prophet of the Scarab', 'Labyrinth of Skophos', 'Serum Snare'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name)));
const H = require('./h'); const {check, sleep, put, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { window.__want = window.__want || null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ if (!window.__tgt) return; const re = new RegExp(window.__tgt, 'i'); const c = (m.cands || []).find(x => x.ok && re.test(x.nm)); if (!c) return; m.__done = 1; m.resolve([c]); closeModal(); }
    else if (m.run){ m.__done = 1; const d = m.def ?? 1; m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
// resolve `text` as card `src`'s effect on Georges's client. tg: list of target groups; each entry 'me' | 'kim' | 'A:<card>' | 'B:<card>' | 'AG:<card>' (my graveyard) | 'BG:<card>' (Kim's graveyard)
const fx = (p, src, text, tg = [], it = {}) => p.evaluate(async ([n, t, tg, ex]) => {
  const kim = opponents()[0].pid; const c = S.bf.find(x => cname(x) === n); const k = c ? c.k : [...DICT.values()].find(a => a.n === n)?.k;
  const one = d => { if (d === 'me') return {t:'player', pid:MYPID, nm:'me'}; if (d === 'kim') return {t:'player', pid:kim, nm:'Kim'};
    const [z, nm] = d.split(':'); if (z === 'A'){ const x = S.bf.find(b => cname(b) === nm); return x && {t:'card', pid:MYPID, id:x.id, k:x.k, nm}; }
    if (z === 'B'){ const x = (OPP.get(kim).bf || []).find(b => b.k && info(b.k)?.n === nm); return x && {t:'card', pid:kim, id:x.id, k:x.k, nm}; }
    if (z === 'AG'){ const x = S.gy.find(b => cname(b) === nm); return x && {t:'gy', pid:MYPID, id:x.id, k:x.k, nm}; }
    if (z === 'BG'){ const g = OPP.get(kim).gy || []; const i = g.findIndex(k => info(k)?.n === nm); return i >= 0 && {t:'gy', pid:kim, id:'g' + i, k:g[i], nm}; } };
  const tgts = tg.map(g => g.map(one).filter(Boolean));
  const x = {...ex}; if (x.evPid === 'kim') x.evPid = kim; if (x.evDp === 'kim') x.evDp = kim;
  const itm = {sid:rid(6), kind:x.kind || 'trigger', k, nm:n, txt:t, srcId:c ? c.id : null, ...x};
  await runEffects(t, {name:n, k, srcId:itm.srcId, it:itm, full:t, tgts, ti:0}); commit(); return true; }, [src, text, tg, it]);
const toZone = (p, n, z) => p.evaluate(([n, z]) => { for (const zz of ['lib', 'hand', 'gy', 'ex', 'bf']){ const i = S[zz].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[zz].splice(i, 1); reset(c); S[z].push(c); commit(); return c.id; } } return null; }, [n, z]);
const clear = p => p.evaluate(() => { S.bf.filter(c => !isLand(c.k)).forEach(c => { if (c.tok) S.bf.splice(S.bf.indexOf(c), 1); else moveCard(c.id, 'lib', {quiet:true}); }); S.stk = []; commit(); });
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { await fn(); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-12).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2i');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2i');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const life = p => p.evaluate(() => S.life);
  const z = p => p.evaluate(() => ({gy:S.gy.map(cname), ex:S.ex.map(cname), hand:S.hand.length, lib:S.lib.length, bf:S.bf.map(c => cname(c) + (c.n > 1 ? 'x' + c.n : '') + (c.tap ? '*' : '')), mon:S.mon || 0}));
  const sync = async () => { await sleep(900); await settle([A, B]); await sleep(600); };
  const modalsB = () => B.evaluate(() => (window.__mB || []).splice(0));
  await B.evaluate(() => { const om = openModal; openModal = m => { (window.__mB = window.__mB || []).push(String(m.title || m.type)); return om(m); }; });
  try {
    await step('Swashbuckler Extraordinaire: up to two target creatures gain double strike', async () => {
      await put(A, 'Grizzly Bears'); await put(A, 'Llanowar Elves'); await sleep(300);
      await fx(A, 'Swashbuckler Extraordinaire', 'Up to two target creatures gain double strike until end of turn.', [['A:Grizzly Bears', 'A:Llanowar Elves']]);
      const r = await A.evaluate(() => S.bf.filter(c => /Grizzly|Llanowar/.test(cname(c))).map(c => (c.ekw || []).includes('double strike')));
      check(r.length === 2 && r.every(Boolean), 'both creatures have double strike ' + JSON.stringify(r));
    });
    await step("Tifa's Limit Break: triple a 2/2 → 6/6", async () => {
      await fx(A, "Tifa's Limit Break", "Triple target creature's power and toughness until end of turn.", [['A:Grizzly Bears']], {kind:'spell'});
      const st = await A.evaluate(() => stats(S.bf.find(c => cname(c) === 'Grizzly Bears')));
      check(st[0] === 6 && st[1] === 6, 'Grizzly Bears is 6/6 ' + JSON.stringify(st));
    });
    await step("Terisian Mindbreaker: defending player mills half their library, rounded up (Kim's client mills)", async () => {
      await B.evaluate(() => { S.gy.push(...S.lib.splice(81)); commit(); }); await sleep(400);
      const b0 = await z(B);
      await fx(A, 'Terisian Mindbreaker', 'Defending player mills half their library, rounded up.', [], {evDp:'kim'}); await sync();
      const b1 = await z(B);
      console.log('    Kim library', b0.lib, '→', b1.lib);
      check(b1.lib === Math.floor(b0.lib / 2), `Kim's library halved (${b0.lib} → ${b1.lib})`);
      check(b1.gy.length - b0.gy.length === Math.ceil(b0.lib / 2), 'the milled cards are in Kim\'s graveyard');
    });
    await step('Galvanic Blast with metalcraft: 4 damage to Kim', async () => {
      for (const n of ['Sol Ring', 'Skullclamp', "Wayfarer's Bauble"]) await put(A, n);
      const l0 = await life(B);
      await fx(A, 'Galvanic Blast', 'Galvanic Blast deals 2 damage to any target.\nMetalcraft — Galvanic Blast deals 4 damage instead if you control three or more artifacts.', [['kim']], {kind:'spell'}); await sync();
      check(l0 - await life(B) === 4, `Kim lost 4 (${l0} → ${await life(B)})`);
    });
    await step('Hunted Horror: target opponent (Kim) creates two 3/3 Centaurs on her side', async () => {
      await fx(A, 'Hunted Horror', 'Target opponent creates two 3/3 green Centaur creature tokens with protection from black.', [['kim']]); await sync();
      const b = await z(B); console.log('    Kim bf', b.bf.filter(x => /Centaur/.test(x)));
      check(b.bf.some(x => /Centaur/.test(x)) && (await B.evaluate(() => S.bf.filter(c => /Centaur/.test(cname(c))).reduce((a, c) => a + (c.n || 1), 0))) === 2, 'Kim has two Centaur tokens');
      check(!(await z(A)).bf.some(x => /Centaur/.test(x)), 'Georges has none');
    });
    await step('Éomer: target player (Kim) becomes the monarch', async () => {
      await fx(A, 'Éomer, King of Rohan', 'Target player becomes the monarch.', [['kim']]); await sync();
      check(await A.evaluate(() => holderOf('mon') === opponents()[0].pid), 'Kim is the monarch (seen from Georges)');
    });
    await step("Kiora Bests the Sea God II: tap all Kim's nonland permanents; they stay tapped through her untap step", async () => {
      await put(B, 'Grizzly Bears'); await B.evaluate(() => { S.bf.forEach(c => { c.tap = false; }); commit(); }); await sleep(500);
      await fx(A, 'Kiora Bests the Sea God', "Tap all nonland permanents target opponent controls. They don't untap during their controller's next untap step.", [['kim']]); await sync();
      const r = await B.evaluate(() => S.bf.filter(c => !isLand(c.k)).map(c => [cname(c), !!c.tap, !!c.skipUntap]));
      console.log('    Kim nonland', JSON.stringify(r));
      check(r.length > 0 && r.every(x => x[1] && x[2]), 'every nonland permanent of Kim is tapped and marked to skip her next untap');
      const lands = await B.evaluate(() => S.bf.filter(c => isLand(c.k) && c.tap).length); check(lands === 0, 'her lands are untouched');
      await B.evaluate(() => { S.bf.forEach(c => { c.tap = false; c.skipUntap = 0; }); commit(); });
    });
    await step("Uchuulon: exile a creature card from Kim's graveyard (it goes to KIM's exile, not to Georges), then a token copy", async () => {
      await toZone(B, 'Grizzly Bears', 'gy'); await sleep(300); await put(A, 'Uchuulon'); await sleep(800);
      await fx(A, 'Uchuulon', "Exile up to one target creature card from an opponent's graveyard. If you do, create a token that's a copy of this creature.", [['BG:Grizzly Bears']]); await sync();
      const b = await z(B), a = await z(A);
      check(b.ex.includes('Grizzly Bears') && !b.gy.includes('Grizzly Bears'), "Kim's Grizzly Bears moved to her exile");
      check(a.bf.filter(x => x === 'Grizzly Bears').length === 1, 'Georges did not get Kim\'s Bears onto his battlefield ' + JSON.stringify(a.bf));
      check(a.bf.filter(x => /^Uchuulon/.test(x)).length === 2 || a.bf.some(x => x === 'Uchuulonx2'), 'Georges has a token copy of Uchuulon ' + JSON.stringify(a.bf));
    });
    await step("Relic of Progenitus: target player (Kim) exiles a card from her graveyard — chosen on Kim's screen", async () => {
      await modalsB(); const b0 = await z(B);
      await fx(A, 'Relic of Progenitus', 'Target player exiles a card from their graveyard.', [['kim']]); await sync();
      const b1 = await z(B); const mb = await modalsB();
      check(b1.gy.length === b0.gy.length - 1 && b1.ex.length === b0.ex.length + 1, `one card moved from Kim's graveyard to exile (${b0.gy.length}→${b1.gy.length})`);
      check(mb.some(t => /Relic/.test(t)), 'Kim got the choice on her screen ' + JSON.stringify(mb));
    });
    await step('Oblivion Ring: exiles Kim\'s creature; when O-Ring leaves, it comes back', async () => {
      await toZone(A, 'Llanowar Elves', 'lib'); await put(B, 'Llanowar Elves'); await sleep(600); await A.evaluate(() => { window.__tgt = 'Llanowar'; });
      await put(A, 'Oblivion Ring'); await sync(); await sync(); await A.evaluate(() => { window.__tgt = null; });
      check(!(await z(B)).bf.includes('Llanowar Elves'), "Kim's Llanowar Elves left the battlefield");
      await A.evaluate(() => { const o = S.bf.find(c => cname(c) === 'Oblivion Ring'); moveCard(o.id, 'gy'); commit(); }); await sync();
      check((await z(B)).bf.includes('Llanowar Elves'), "after O-Ring left, Kim's Llanowar Elves is back");
    });
    await step('Goblin Chainwhirler: 1 damage to Kim and each of her creatures', async () => {
      await put(B, 'Young Wolf'); await sleep(500); const l0 = await life(B);
      await fx(A, 'Goblin Chainwhirler', 'It deals 1 damage to each opponent and each creature and planeswalker they control.'); await sync();
      check(l0 - await life(B) === 1, 'Kim lost 1 life');
      check(await B.evaluate(() => (S.bf.find(c => cname(c) === 'Young Wolf') || {}).cp === 1), "Kim's 1/1 Young Wolf died (and came back with undying)");
    });
    await step('Engulf the Shore: creatures with toughness ≤ my Islands go back to hand (both boards)', async () => {
      await put(B, 'Grizzly Bears').catch(() => {}); await toZone(B, 'Grizzly Bears', 'hand'); await put(B, 'Grizzly Bears'); await sleep(400);
      const isl = await A.evaluate(() => S.bf.filter(c => cname(c) === 'Island').length); for (let i = isl; i < 2; i++) await put(A, 'Island');
      await fx(A, 'Engulf the Shore', "Return to their owners' hands all creatures with toughness less than or equal to the number of Islands you control.", [], {kind:'spell'}); await sync();
      check(!(await z(B)).bf.includes('Grizzly Bears'), "Kim's 2/2 returned to her hand");
    });
    await step('Wave of Reckoning: each creature deals damage to itself equal to its power (Kim\'s 2/2 dies, a 0/4 survives)', async () => {
      await toZone(B, 'Grizzly Bears', 'hand'); await put(B, 'Grizzly Bears'); await sleep(400);
      await fx(A, 'Wave of Reckoning', 'Each creature deals damage to itself equal to its power.', [], {kind:'spell'}); await sync();
      check(!(await z(B)).bf.includes('Grizzly Bears'), "Kim's Grizzly Bears died");
    });
    await step('Snort: each player may discard their hand and draw five — Kim says yes on her screen and takes 5', async () => {
      await A.evaluate(() => { window.__want = "^(No|Don't)"; }); await B.evaluate(() => { window.__want = '^Yes'; });
      const l0 = await life(B);
      await fx(A, 'Snort', 'Each player may discard their hand and draw five cards. Then Snort deals 5 damage to each opponent who discarded their hand this way.', [], {kind:'spell'}); await sync();
      const b = await z(B); check(b.hand === 5, `Kim has 5 cards (${b.hand})`); check(l0 - await life(B) === 5, `Kim took 5 (${l0} → ${await life(B)})`);
      await A.evaluate(() => { window.__want = null; }); await B.evaluate(() => { window.__want = null; });
    });
    await step('Planetary Annihilation: Kim keeps six lands (her choice), sacrifices the rest', async () => {
      const n8 = await B.evaluate(() => { let n = S.bf.filter(c => isLand(c.k)).length; for (const c of S.lib.slice().concat(S.gy.slice())){ if (n >= 8) break; if (isLand(c.k)){ moveCard(c.id, 'bf', {quiet:true}); n++; } } commit(); return n; }); await sleep(500); check(n8 === 8, `Kim starts with 8 lands (${n8})`);
      await fx(A, 'Planetary Annihilation', 'Each player chooses six lands they control, then sacrifices the rest.', [], {kind:'spell'}); await sync();
      const n = await B.evaluate(() => S.bf.filter(c => isLand(c.k)).length); check(n === 6, `Kim has 6 lands (${n})`);
    });
    await step('Fecundity: when Kim\'s creature dies, Kim may draw (asked on her screen)', async () => {
      const h0 = (await z(B)).hand;
      await fx(A, 'Fecundity', "That creature's controller may draw a card.", [], {evPid:'kim'}); await sync();
      check((await z(B)).hand === h0 + 1, 'Kim drew a card');
    });
    await step("Bounty Board: Kim's creature with a bounty dies → each of its controller's opponents (Georges) draws and gains 2", async () => {
      const a0 = await z(A), l0 = await life(A);
      await fx(A, 'Bounty Board', "Each of its controller's opponents draws a card and gains 2 life.", [], {evPid:'kim'}); await sync();
      check((await z(A)).hand === a0.hand + 1 && await life(A) === l0 + 2, 'Georges drew 1 and gained 2');
    });
    await step('Tinybones: Kim discarded this turn → Georges draws', async () => {
      await B.evaluate(() => { const c = S.hand[0]; if (c) moveCard(c.id, 'gy'); commit(); }); await sync();
      const h0 = (await z(A)).hand;
      await fx(A, 'Tinybones, Trinket Thief', 'If an opponent discarded a card this turn, you draw a card and you lose 1 life.'); await sync();
      check((await z(A)).hand === h0 + 1, 'Georges drew (Kim discarded this turn)');
    });
    await step('Valley Mightcaller: another Rabbit enters → +1/+1 counter (real trigger)', async () => {
      await clear(A); await put(A, 'Valley Mightcaller'); await sleep(500); await put(A, 'Claim Jumper'); await sleep(800); await settle([A, B]); await sleep(800); await settle([A, B]);
      const cp = await A.evaluate(() => S.bf.find(c => cname(c) === 'Valley Mightcaller')?.cp || 0); check(cp === 1, `Valley Mightcaller has a +1/+1 counter (${cp})`);
    });
    await step('God-Eternal Rhonas: double the power of each other creature you control, vigilance', async () => {
      await put(A, 'Grizzly Bears'); await sleep(300);
      await fx(A, 'God-Eternal Rhonas', 'Double the power of each other creature you control until end of turn. Those creatures gain vigilance until end of turn.');
      const r = await A.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Grizzly Bears'); return [stats(c), (c.ekw || []).includes('vigilance')]; });
      check(r[0][0] === 4 && r[1], 'Grizzly Bears is 4/2 with vigilance ' + JSON.stringify(r));
    });
    await step('Hammers of Moradin: for each opponent, tap up to one target creature that player controls', async () => {
      await put(B, 'Llanowar Elves').catch(() => {}); await B.evaluate(() => { S.bf.forEach(c => { c.tap = false; }); commit(); }); await sleep(600);
      await A.evaluate(() => { window.__want = 'Llanowar'; });
      await fx(A, 'Hammers of Moradin', 'For each opponent, tap up to one target creature that player controls.'); await sync();
      const t = await B.evaluate(() => S.bf.find(c => cname(c) === 'Llanowar Elves')?.tap); check(t === true, "Kim's Llanowar Elves is tapped");
      await A.evaluate(() => { window.__want = null; });
    });
    await step('Soul of Windgrace: a land from Kim\'s graveyard comes to Georges tapped', async () => {
      await B.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Swamp') || S.lib.find(c => isLand(c.k)); if (c) moveCard(c.id, 'gy'); commit(); }); await sync();
      await A.evaluate(() => { S.gy.filter(c => isLand(c.k)).forEach(c => moveCard(c.id, 'lib', {quiet:true})); window.__want = null; commit(); });
      const a0 = await A.evaluate(() => S.bf.filter(c => isLand(c.k)).length); const g0 = (await z(B)).gy.length;
      await fx(A, 'Soul of Windgrace', 'Put a land card from a graveyard onto the battlefield tapped under your control.'); await sync();
      const a1 = await A.evaluate(() => [S.bf.filter(c => isLand(c.k)).length, S.bf.filter(c => isLand(c.k) && c.own == null).length, S.bf.slice(-1).map(c => [cname(c), !!c.tap])]);
      console.log('    Georges lands', a0, '→', JSON.stringify(a1));
      check(a1[0] === a0 + 1, 'Georges has one more land'); check(a1[2][0] && a1[2][0][1], 'it entered tapped');
      check((await z(B)).gy.length === g0 - 1, "it left Kim's graveyard");
    });
    await step('Keep Watch: draw a card for each attacking creature', async () => {
      await A.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Grizzly Bears'); c.atk = 'p:x'; commit(); });
      const h0 = (await z(A)).hand; await fx(A, 'Keep Watch', 'Draw a card for each attacking creature.', [], {kind:'spell'});
      check((await z(A)).hand === h0 + 1, 'drew 1 (one attacker)');
      await A.evaluate(() => { S.bf.forEach(c => { c.atk = ''; }); commit(); });
    });
    await step("Summon: Valefor I: Kim returns her creature with the greatest mana value (her choice, her screen)", async () => {
      await clear(B); await put(B, 'Grizzly Bears'); await put(B, 'Llanowar Elves'); await sleep(600); await modalsB();
      await fx(A, 'Summon: Valefor', "Each opponent chooses a creature with the greatest mana value among creatures they control. Return those creatures to their owners' hands."); await sync();
      const b = await z(B); check(!b.bf.includes('Grizzly Bears') && b.bf.includes('Llanowar Elves'), "Kim's 2-mana Grizzly Bears went back, the 1-mana Elves stayed " + JSON.stringify(b.bf.filter(x => !/Mountain|Island|Swamp|Plains/.test(x))));
    });
    await step('Ancient Animus: +1/+1 counter only if legendary, then it fights', async () => {
      await clear(A); await put(A, 'Grizzly Bears'); await toZone(B, 'Llanowar Elves', 'hand'); await put(B, 'Llanowar Elves'); await sleep(600);
      await fx(A, 'Ancient Animus', "Put a +1/+1 counter on target creature you control if it's legendary. Then it fights target creature an opponent controls.", [['A:Grizzly Bears'], ['B:Llanowar Elves']], {kind:'spell'}); await sync();
      const a = await A.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Grizzly Bears'); return c && [c.cp || 0, c.dmg || 0]; });
      check(a && a[0] === 0 && a[1] === 1, 'Grizzly Bears got no counter (not legendary) and took 1 from the Elves ' + JSON.stringify(a));
      check(!(await z(B)).bf.includes('Llanowar Elves'), "Kim's Llanowar Elves died in the fight");
    });
    await step('Klothys: exiles a nonland card from Kim\'s graveyard → Georges gains 2, Kim takes 2', async () => {
      const g = await B.evaluate(() => { const c = S.gy.find(c => !isLand(c.k)); return c && cname(c); }); const la = await life(A), lb = await life(B);
      await fx(A, 'Klothys, God of Destiny', "Exile target card from a graveyard. If it was a land card, add {R} or {G}. Otherwise, you gain 2 life and Klothys deals 2 damage to each opponent.", [['BG:' + g]]); await sync();
      check(await life(A) === la + 2 && await life(B) === lb - 2, `Georges +2 (${la}→${await life(A)}), Kim −2 (${lb}→${await life(B)})`);
      check((await z(B)).ex.includes(g), `Kim's ${g} is in her exile`);
    });
    await step('Yorion: exile my permanents, they return at the beginning of the next end step', async () => {
      await clear(A); await put(A, 'Sol Ring'); await put(A, 'Grizzly Bears'); await put(A, 'Yorion, Sky Nomad'); await sleep(800); await settle([A, B]); await sleep(600);
      await A.evaluate(() => { window.__want = 'Sol Ring|Grizzly'; });
      await fx(A, 'Yorion, Sky Nomad', 'Exile any number of other nonland permanents you own and control. Return those cards to the battlefield at the beginning of the next end step.'); await sync();
      await A.evaluate(() => { window.__want = null; });
      const mid = await z(A); check(!mid.bf.includes('Sol Ring') && mid.ex.includes('Sol Ring'), 'Sol Ring is in exile for now ' + JSON.stringify(mid.ex));
      await A.evaluate(() => fireSteps('end', MYPID)); await sync();
      const end = await z(A); check(end.bf.includes('Sol Ring') && end.bf.includes('Grizzly Bears'), 'both came back at the end step ' + JSON.stringify(end.bf.filter(x => !/Mountain|Island|Swamp|Plains/.test(x))));
    });
    await step("Nicol Bolas, God-Pharaoh −12: exile each nonland permanent Kim controls (her lands stay)", async () => {
      await put(B, 'Grizzly Bears').catch(() => {}); await sleep(400);
      await fx(A, 'Nicol Bolas, God-Pharaoh', 'Exile each nonland permanent your opponents control.'); await sync();
      const r = await B.evaluate(() => [S.bf.filter(c => !isLand(c.k)).length, S.bf.filter(c => isLand(c.k)).length]);
      check(r[0] === 0 && r[1] > 0, `Kim has no nonland permanents left and still has her lands ${JSON.stringify(r)}`);
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
