// Round 23J functional test: cards from EDHREC ranks 5293–6159 automated in engine23j.js, played in a real 2-player game
const CC = require('./cards');
const WANT = ["Harmless Offering", "Smallpox", "Karoo", "Oblation", "Rush of Dread", "Clackbridge Troll", "Caltrops", "Sylvan Awakening", "Ivory Tower",
  "Great Unclean One", "Telling Time", "Myrkul's Edict", "Killing Wave", "Kulrath Knight", "Drover of the Mighty", "Raised by Giants", "Hollowhenge Overlord",
  "Archive Trap", "Wheel and Deal", "Zoyowa's Justice", "Gaea's Blessing", "Primal Command", "Liliana, Waker of the Dead", "Change of Fortune", "Grizzly Bears",
  "Colossal Dreadmaw", "Wrong Turn", "Day's Undoing", "Doran, Besieged by Time", "Hellrider", "Kindred Charge",
  "Palace Siege", "Thieving Amalgam", "Emerald Charm", "Tangle", "Abstruse Appropriation", "Aberrant Return", "Ixhel, Scion of Atraxa", "Archetype of Finality", "Grand Warlord Radha", "Rite of Passage", "Ivora, Insatiable Heir", "Karn, Scion of Urza", "Sadistic Shell Game", "Pontiff of Blight", "Jodah, Archmage Eternal", "Sarkhan the Masterless"];
const ALLC = CC.topCards('all.json');
CC.cards.push(...ALLC.filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, give, waitFor} = H;
// a fresh copy of a card straight onto the battlefield (the 1-copy deck runs out of Bears otherwise)
const put = (p, name) => p.evaluate(n => { let c = null; for (const z of ['lib','hand','gy']){ c = S[z].find(x => cname(x) === n); if (c){ moveCard(c.id, 'bf', {quiet:true}); break; } } if (!c){ const k = [...DICT.values()].find(a => a.n === n)?.k; if (!k) return false; c = {id:S.nid++, k, n:1}; place(c); S.bf.push(c); } c = S.bf.find(x => x.id === c.id); if (c) c.sk = false; commit(); return true; }, name);
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(150); } };
const AUTO = () => { window.__want = window.__want || null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.run){ m.__done = 1; const d = window.__text || (m.def ?? 1); m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
// also answer the timed choice prompts (sacrifice / discard requests) automatically: first legal cards
const AUTOPRM = () => setInterval(() => { try { const p = (S.prm || []).find(x => x.type === 'sac' || x.type === 'discard'); if (p && !UI.modal){ const pool = p.type === 'sac' ? S.bf.filter(c => !c.fd && descOk(c.k, p.d || 'permanent', {tok:c.tok, face:faceOf(c)})) : S.hand.slice(); finishChoice(p, pool.slice(0, p.n).map(c => c.id)); } } catch (e){ console.warn(e); } }, 200);
// run card text as the resolving spell/ability would, with chosen targets
const fx = (p, name, text, o = {}) => p.evaluate(async ([n, t, o]) => {
  const c = S.bf.find(x => cname(x) === n) || S.hand.find(x => cname(x) === n); const k = c ? c.k : [...DICT.values()].find(a => a.n === n)?.k;
  const it = {sid:rid(6), kind:o.spell ? 'spell' : 'trigger', k, nm:n, txt:t, srcId:c && S.bf.includes(c) ? c.id : null, x:o.x, ...(o.it || {})};
  const tg = (o.tg || []).map(g => g.map(x => { if (x.me != null){ const pid = x.me ? MYPID : opponents()[0].pid; if (x.player) return {t:'player', pid, nm:nameOf(pid)}; if (x.gy){ if (pid === MYPID){ const g2 = S.gy.find(y => cname(y) === x.gy); return g2 && {t:'gy', pid, id:g2.id, k:g2.k, nm:x.gy}; } const arr = OPP.get(pid).gy || []; const i = arr.findIndex(k2 => info(k2)?.n === x.gy); return i >= 0 && {t:'gy', pid, id:'g' + i, k:arr[i], nm:x.gy}; } const bf = pid === MYPID ? S.bf : OPP.get(pid).bf; const cc = bf.find(y => y.k && info(y.k)?.n === x.card); return cc && {t:'card', pid, id:cc.id, k:cc.k, nm:x.card}; } return x; }).filter(Boolean));
  await runEffects(t, {name:n, k, srcId:it.srcId, it, full:t, tgts:o.tg ? tg : null, roll:o.roll}); commit(); }, [name, text, o]);
let PA = null; const step = async (name, fn) => { console.log('— ' + name); const f0 = H.fails(); try { await fn(); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); } if (H.fails() > f0 && PA) console.log('    LOG:', (await PA.evaluate(() => S.log.slice(-10).map(e => e.s).join(' | ')))); };
const oracle = n => ALLC.find(c => c.name === n).oracle_text;
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2J');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2J');
  PA = A; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  for (let i = 0; i < 20; i++){ await passAll([B]); if (await A.evaluate(() => phaseNow().ph === 3)) break; await A.evaluate(() => { if (!stackAll().length && !UI.modal) nextAction(); }); await sleep(200); }
  await A.evaluate(AUTO); await B.evaluate(AUTO); await A.evaluate(AUTOPRM); await B.evaluate(AUTOPRM);
  const modals = p => p.evaluate(() => (window.__modals || []).splice(0));
  for (const p of [A, B]) await p.evaluate(() => { const om = openModal; openModal = m => { (window.__modals = window.__modals || []).push(m.title || m.type); return om(m); }; });
  const clean = async (p) => { await p.evaluate(() => { S.bf.filter(c => c.k).forEach(c => { if (c.tok || c.emb || c.own) S.bf.splice(S.bf.indexOf(c), 1); else moveCard(c.id, 'lib'); }); S.stk = []; S.prm = []; commit(); }); };
  const sync = () => sleep(1600);
  const noHand = async () => { const a = (await modals(A)).concat(await modals(B)); check(!a.some(t => /by hand/i.test(String(t))), 'no "do it by hand" box'); };
  try {
    await step('Harmless Offering: Kim gains control of my Grizzly Bears', async () => {
      await clean(A); await clean(B); await put(A, 'Grizzly Bears');
      await fx(A, 'Harmless Offering', oracle('Harmless Offering'), {spell:1, tg:[[{me:0, player:1}], [{me:1, card:'Grizzly Bears'}]]}); await sync();
      const a = await A.evaluate(() => S.bf.some(c => cname(c) === 'Grizzly Bears')); const b = await B.evaluate(() => S.bf.some(c => cname(c) === 'Grizzly Bears'));
      check(!a && b, `Bears moved to Kim's battlefield (mine ${a}, Kim ${b})`); await noHand();
    });
    await step('Wrong Turn: Kim gains control of my creature', async () => {
      await clean(A); await clean(B); await put(A, 'Hollowhenge Overlord');
      await fx(A, 'Wrong Turn', oracle('Wrong Turn'), {spell:1, tg:[[{me:0, player:1}], [{me:1, card:'Hollowhenge Overlord'}]]}); await sync();
      check(await B.evaluate(() => S.bf.some(c => cname(c) === 'Hollowhenge Overlord')), 'Overlord is on Kim\'s side');
    });
    await step('Smallpox: each player loses 1, discards, sacrifices a creature and a land', async () => {
      await clean(A); await clean(B);
      for (const p of [A, B]){ await put(p, 'Grizzly Bears'); await p.evaluate(() => { const l = S.lib.find(c => /^(Plains|Island|Swamp|Mountain)$/.test(cname(c))); moveCard(l.id, 'bf', {quiet:true}); while (S.hand.length < 2) draw(1); commit(); }); }
      const b0 = await B.evaluate(() => [S.life, S.hand.length]); const a0 = await A.evaluate(() => [S.life, S.hand.length]);
      await fx(A, 'Smallpox', oracle('Smallpox'), {spell:1}); await sync(); await sleep(1200);
      const b1 = await B.evaluate(() => [S.life, S.hand.length, S.bf.filter(c => c.k && !isLand(c.k)).length, S.bf.filter(c => c.k && isLand(c.k)).length]);
      const a1 = await A.evaluate(() => [S.life, S.hand.length, S.bf.filter(c => c.k && !isLand(c.k)).length, S.bf.filter(c => c.k && isLand(c.k)).length]);
      console.log('    A', a0, '→', a1, ' B', b0, '→', b1);
      check(a1[0] === a0[0] - 1 && b1[0] === b0[0] - 1, 'both lost 1 life');
      check(a1[1] === a0[1] - 1 && b1[1] === b0[1] - 1, 'both discarded a card');
      check(a1[2] === 0 && b1[2] === 0 && a1[3] === 0 && b1[3] === 0, 'both sacrificed their creature and land');
    });
    await step('Karoo: returns an untapped Plains, else it is sacrificed', async () => {
      await clean(A); await A.evaluate(() => { const l = S.lib.find(c => cname(c) === 'Plains'); moveCard(l.id, 'bf', {quiet:true}); commit(); }); await put(A, 'Karoo');
      await fx(A, 'Karoo', 'Sacrifice it unless you return an untapped Plains you control to its owner\'s hand.');
      const r = await A.evaluate(() => [S.bf.some(c => cname(c) === 'Karoo'), S.hand.some(c => cname(c) === 'Plains')]);
      check(r[0] && r[1], 'Karoo stays and Plains went back to hand');
      await fx(A, 'Karoo', 'Sacrifice it unless you return an untapped Plains you control to its owner\'s hand.');
      check(await A.evaluate(() => !S.bf.some(c => cname(c) === 'Karoo') && S.gy.some(c => cname(c) === 'Karoo')), 'with no Plains, Karoo is sacrificed');
    });
    await step('Oblation: Kim\'s Bears shuffled into Kim\'s library, Kim draws two', async () => {
      await clean(A); await clean(B); await put(B, 'Grizzly Bears'); await sync();
      const h0 = await B.evaluate(() => [S.hand.length, S.lib.length]);
      await fx(A, 'Oblation', oracle('Oblation'), {spell:1, tg:[[{me:0, card:'Grizzly Bears'}]]}); await sync();
      const h1 = await B.evaluate(() => [S.hand.length, S.lib.length, S.bf.some(c => cname(c) === 'Grizzly Bears')]);
      check(!h1[2] && h1[0] === h0[0] + 2 && h1[1] === h0[1] - 1, `Bears gone, +2 cards, library +1-2 (${JSON.stringify(h0)} → ${JSON.stringify(h1)})`);
    });
    await step('Rush of Dread: Kim sacrifices half her creatures rounded up (3 → 2)', async () => {
      await clean(B); for (const n of ['Grizzly Bears', 'Drover of the Mighty', 'Kulrath Knight']) await put(B, n); await sync();
      await fx(A, 'Rush of Dread', 'Target opponent sacrifices half the creatures they control of their choice, rounded up.', {spell:1, tg:[[{me:0, player:1}]]}); await sync(); await sleep(800);
      const n = await B.evaluate(() => S.bf.filter(c => c.k && isCreatureCard(c)).length);
      check(n === 1, `Kim has 1 creature left (${n})`);
    });
    await step('Clackbridge Troll ETB: Kim creates three 0/1 Goats', async () => {
      await clean(B); await sync();
      await fx(A, 'Clackbridge Troll', 'Target opponent creates three 0/1 white Goat creature tokens.', {tg:[[{me:0, player:1}]]}); await sync(); await sleep(1000);
      const n = await B.evaluate(() => S.bf.filter(c => c.tok && /Goat/.test(cname(c))).reduce((a, c) => a + (c.n || 1), 0));
      check(n === 3, `Kim has three Goat tokens (${n})`);
    });
    await step('Caltrops: an attacking creature of Kim takes 1 damage', async () => {
      await clean(B); await put(B, 'Grizzly Bears'); await sync(); await put(A, 'Caltrops');
      const id = await B.evaluate(() => S.bf.find(c => cname(c) === 'Grizzly Bears').id); const pid = await B.evaluate(() => MYPID);
      await fx(A, 'Caltrops', 'Caltrops deals 1 damage to it.', {it:{evId:id, evPid:pid}}); await sync();
      check(await B.evaluate(() => S.bf.find(c => cname(c) === 'Grizzly Bears').dmg === 1), 'Bears has 1 damage');
    });
    await step('Sylvan Awakening: my lands become 2/2 reach indestructible haste creatures', async () => {
      await clean(A); await A.evaluate(() => { for (let i = 0; i < 2; i++){ const l = S.lib.find(c => isLand(c.k)); moveCard(l.id, 'bf', {quiet:true}); } commit(); });
      await fx(A, 'Sylvan Awakening', oracle('Sylvan Awakening'), {spell:1});
      const r = await A.evaluate(() => S.bf.filter(c => isLand(c.k)).map(c => [isCreatureCard(c), (stats(c) || []).join('/'), kwOf(c, 'reach'), kwOf(c, 'indestructible'), kwOf(c, 'haste')]));
      check(r.length === 2 && r.every(x => x[0] && x[1] === '2/2' && x[2] && x[3] && x[4]), 'lands are 2/2 creatures with reach, indestructible, haste ' + JSON.stringify(r));
    });
    await step('Ivory Tower: gain life for cards in hand minus 4', async () => {
      await A.evaluate(() => { while (S.hand.length < 7) draw(1); while (S.hand.length > 7) moveCard(S.hand[0].id, 'lib'); commit(); }); await put(A, 'Ivory Tower');
      const [l0, h0] = await A.evaluate(() => [S.life, S.hand.length]); await fx(A, 'Ivory Tower', 'You gain X life, where X is the number of cards in your hand minus 4.');
      const l1 = await A.evaluate(() => S.life); check(l1 === l0 + Math.max(0, h0 - 4), `gained ${l1 - l0} life with ${h0} cards in hand`);
    });
    await step('Great Unclean One: opponent loses 2, I get a Demon token per opponent below my life', async () => {
      await clean(A); await put(A, 'Great Unclean One'); await A.evaluate(() => { S.life = 40; commit(); }); await B.evaluate(() => { S.life = 30; commit(); }); await sync();
      await fx(A, 'Great Unclean One', 'Each opponent loses 2 life. Then for each opponent who has less life than you, create a 1/3 black Demon creature token named Plaguebearer of Nurgle.'); await sync();
      check(await B.evaluate(() => S.life) === 28, 'Kim lost 2');
      check(await A.evaluate(() => S.bf.some(c => c.tok && /Demon|Plaguebearer/.test(cname(c) + typeOf(c)))), 'a 1/3 Demon token was created');
    });
    await step('Telling Time: one to hand, one on top, one on the bottom', async () => {
      const r0 = await A.evaluate(() => [S.hand.length, S.lib.slice(0, 3).map(c => c.id)]);
      await fx(A, 'Telling Time', oracle('Telling Time'), {spell:1});
      const r1 = await A.evaluate(() => [S.hand.length, S.lib[0].id, S.lib[S.lib.length - 1].id, S.hand[S.hand.length - 1].id]);
      check(r1[0] === r0[0] + 1 && r0[1].includes(r1[1]) && r0[1].includes(r1[2]) && r0[1].includes(r1[3]), 'cards split hand/top/bottom');
    });
    await step("Myrkul's Edict (rolled 15): each opponent sacrifices a creature", async () => {
      await clean(B); await put(B, 'Grizzly Bears'); await sync(); console.log('    Kim bf', await B.evaluate(() => S.bf.filter(c => c.k).map(cname)));
      await fx(A, "Myrkul's Edict", oracle("Myrkul's Edict").split('\n').slice(1).join('\n'), {spell:1, roll:15}); await sync(); await sleep(800);
      const kb = await B.evaluate(() => [S.bf.filter(c => c.k).map(cname), S.prm.length, S.log.slice(-4).map(e => e.s)]); console.log('    Kim after', JSON.stringify(kb));
      check(await B.evaluate(() => !S.bf.some(c => cname(c) === 'Grizzly Bears')), 'Kim sacrificed her Bears');
    });
    await step('Killing Wave X=2: Kim pays 2 life per creature (her choice, on her screen)', async () => {
      await clean(B); await put(B, 'Grizzly Bears'); await put(B, 'Kulrath Knight'); await clean(A); await sync(); await B.evaluate(() => { window.__want = 'Pay'; });
      const l0 = await B.evaluate(() => S.life);
      await fx(A, 'Killing Wave', oracle('Killing Wave'), {spell:1, x:2, it:{x:2}}); await sync(); await sleep(1500);
      const r = await B.evaluate(() => [S.life, S.bf.filter(c => c.k && isCreatureCard(c)).length]);
      check(r[0] === l0 - 4 && r[1] === 2, `Kim paid 4 life and kept both (${JSON.stringify(r)})`); await B.evaluate(() => { window.__want = null; });
    });
    await step('Kulrath Knight: Kim\'s creature with a counter can\'t attack or block', async () => {
      await clean(A); await put(A, 'Kulrath Knight'); await clean(B); await put(B, 'Grizzly Bears'); await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); c.cp = 1; c.sk = false; commit(); }); await sync();
      const r = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); return canAttack(c); });
      check(/can't attack/.test(r), `canAttack says: ${r}`);
    });
    await step('Drover of the Mighty: +2/+2 with a Dinosaur', async () => {
      await clean(A); await put(A, 'Drover of the Mighty'); const s0 = await A.evaluate(() => stats(S.bf.find(c => cname(c) === 'Drover of the Mighty')).join('/'));
      await A.evaluate(() => { const k = [...DICT.values()].find(a => /Dinosaur/.test(a.t || '') && /Creature/.test(a.t))?.k; if (k){ createToken(k, 1); } commit(); });
      const s1 = await A.evaluate(() => stats(S.bf.find(c => cname(c) === 'Drover of the Mighty')).join('/'));
      check(s0 === '1/1' && s1 === '3/3', `1/1 → 3/3 (${s0} → ${s1})`);
    });
    await step('Raised by Giants: my commander is a 10/10 Giant', async () => {
      await clean(A); await A.evaluate(() => { const c = S.cz[0]; if (c){ S.cz.splice(0, 1); place(c); S.bf.push(c); } commit(); }); await put(A, 'Raised by Giants');
      const r = await A.evaluate(() => { const c = S.bf.find(x => x.cmd); return c ? [stats(c).join('/'), /Giant/.test(typeOf(c))] : null; });
      check(r && r[0] === '10/10' && r[1], 'commander 10/10 Giant ' + JSON.stringify(r));
      await A.evaluate(() => { const c = S.bf.find(x => x.cmd); if (c){ S.bf.splice(S.bf.indexOf(c), 1); S.cz.push(c); } commit(); });
    });
    await step('Hollowhenge Overlord: a Wolf for each Wolf/Werewolf', async () => {
      await clean(A); await put(A, 'Hollowhenge Overlord');
      await fx(A, 'Hollowhenge Overlord', 'For each creature you control that\'s a Wolf or a Werewolf, create a 2/2 green Wolf creature token.');
      const n = await A.evaluate(() => S.bf.filter(c => c.tok && /Wolf/.test(cname(c))).reduce((a, c) => a + (c.n || 1), 0));
      check(n === 1, `one Wolf token (${n})`);
      await fx(A, 'Hollowhenge Overlord', 'For each creature you control that\'s a Wolf or a Werewolf, create a 2/2 green Wolf creature token.');
      const n2 = await A.evaluate(() => S.bf.filter(c => c.tok && /Wolf/.test(cname(c))).reduce((a, c) => a + (c.n || 1), 0));
      check(n2 === 3, `then two more (${n2})`);
    });
    await step('Archive Trap: Kim mills thirteen', async () => {
      const g0 = await B.evaluate(() => S.gy.length);
      await fx(A, 'Archive Trap', 'Target opponent mills thirteen cards.', {spell:1, tg:[[{me:0, player:1}]]}); await sync();
      check(await B.evaluate(() => S.gy.length) === g0 + 13, 'Kim milled 13');
    });
    await step('Gaea\'s Blessing: Kim shuffles 2 target graveyard cards into her library', async () => {
      const r0 = await B.evaluate(() => [S.gy.length, S.lib.length]); const names = await B.evaluate(() => S.gy.slice(0, 2).map(cname)); await sync();
      await fx(A, "Gaea's Blessing", 'Target player shuffles up to three target cards from their graveyard into their library.', {spell:1, tg:[[{me:0, player:1}], names.map(n => ({me:0, gy:n}))]}); await sync();
      const r1 = await B.evaluate(() => [S.gy.length, S.lib.length]);
      check(r1[0] === r0[0] - 2 && r1[1] === r0[1] + 2, `2 cards moved gy → library (${r0} → ${r1})`);
    });
    await step('Wheel and Deal: Kim discards her hand and draws seven', async () => {
      await B.evaluate(() => { while (S.hand.length > 2) moveCard(S.hand[0].id, 'lib'); commit(); });
      await fx(A, 'Wheel and Deal', 'Any number of target opponents each discard their hands, then draw seven cards.', {spell:1, tg:[[{me:0, player:1}]]}); await sync(); await sleep(800);
      check(await B.evaluate(() => S.hand.length) === 7, 'Kim has 7 cards');
    });
    await step("Zoyowa's Justice: Kim's Dreadmaw shuffled away, Kim discovers 6", async () => {
      await clean(B); await put(B, 'Hollowhenge Overlord'); await sync(); const l0 = await B.evaluate(() => S.log.length);
      await fx(A, "Zoyowa's Justice", oracle("Zoyowa's Justice"), {spell:1, tg:[[{me:0, card:'Hollowhenge Overlord'}]]}); await sync(); await sleep(1500);
      const r = await B.evaluate(l0 => [S.bf.some(c => cname(c) === 'Hollowhenge Overlord'), S.log.slice(l0).map(e => e.s).join(' | ')], l0);
      check(!r[0] && /discover|exiled|cast|put|resolved/i.test(r[1]), 'Overlord gone and Kim discovered 6: ' + r[1].slice(0, 200));
    });
    await step('Primal Command: Kim\'s noncreature permanent goes on top of her library', async () => {
      await clean(B); await put(B, 'Ivory Tower'); await sync();
      await fx(A, 'Primal Command', 'Put target noncreature permanent on top of its owner\'s library.', {spell:1, tg:[[{me:0, card:'Ivory Tower'}]]}); await sync();
      check(await B.evaluate(() => cname(S.lib[0]) === 'Ivory Tower'), 'Ivory Tower is on top of Kim\'s library');
    });
    await step('Liliana, Waker of the Dead +1: Kim with an empty hand loses 3', async () => {
      await B.evaluate(() => { S.lib.push(...S.hand.splice(0)); commit(); }); await A.evaluate(() => { while (S.hand.length < 2) draw(1); commit(); }); await sync();
      const l0 = await B.evaluate(() => S.life); const h0 = await A.evaluate(() => S.hand.length);
      await fx(A, 'Liliana, Waker of the Dead', 'Each player discards a card. Each opponent who can\'t loses 3 life.'); await sync(); await sleep(600);
      check(await B.evaluate(() => S.life) === l0 - 3, 'Kim lost 3 life');
      check(await A.evaluate(() => S.hand.length) === h0 - 1, 'I discarded a card');
    });
    await step('Change of Fortune: discard hand, draw that many', async () => {
      await A.evaluate(() => { while (S.hand.length < 4) draw(1); while (S.hand.length > 4) moveCard(S.hand[0].id, 'lib'); commit(); });
      await fx(A, 'Change of Fortune', oracle('Change of Fortune'), {spell:1});
      const n = await A.evaluate(() => S.hand.length); check(n >= 4, `hand refilled to at least 4 (${n})`);
    });
    await step('Doran: attacking creature gets +X/+X for toughness − power', async () => {
      await clean(A); await put(A, 'Doran, Besieged by Time'); await put(A, 'Kulrath Knight');
      const id = await A.evaluate(() => S.bf.find(c => cname(c) === 'Doran, Besieged by Time').id);
      await fx(A, 'Doran, Besieged by Time', 'It gets +X/+X until end of turn, where X is the difference between its power and toughness.', {it:{evId:id, evPid:await A.evaluate(() => MYPID)}});
      check(await A.evaluate(() => stats(S.bf.find(c => cname(c) === 'Doran, Besieged by Time')).join('/')) === '5/10', 'Doran 0/5 → 5/10');
    });
    await step('Hellrider: 1 damage to the player the creature attacks', async () => {
      await clean(A); await put(A, 'Hellrider'); await put(A, 'Grizzly Bears'); const l0 = await B.evaluate(() => S.life);
      const id = await A.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Grizzly Bears'); c.atk = 'p:' + opponents()[0].pid; commit(); return c.id; });
      await fx(A, 'Hellrider', 'Hellrider deals 1 damage to the player or planeswalker it\'s attacking.', {it:{evId:id, evPid:await A.evaluate(() => MYPID)}}); await sync();
      check(await B.evaluate(() => S.life) === l0 - 1, 'Kim took 1');
      await A.evaluate(() => { S.bf.forEach(c => { c.atk = ''; }); commit(); });
    });
    await step('Kindred Charge: copies of each creature of the chosen type, with haste', async () => {
      await clean(A); await put(A, 'Kulrath Knight'); await put(A, 'Grizzly Bears'); await A.evaluate(() => { window.__want = '^Knight$'; });
      await fx(A, 'Kindred Charge', oracle('Kindred Charge'), {spell:1}); await A.evaluate(() => { window.__want = null; });
      const r = await A.evaluate(() => S.bf.filter(c => c.tok).map(c => [cname(c), kwOf(c, 'haste')]));
      check(r.length === 1 && r[0][0] === 'Kulrath Knight' && r[0][1], 'one hasty token copy of Kulrath Knight (the only Knight) ' + JSON.stringify(r));
    });

    await step('Palace Siege: choose Dragons; at my upkeep Kim loses 2 and I gain 2', async () => {
      await clean(A); await A.evaluate(() => { window.__want = 'Dragons'; }); await put(A, 'Palace Siege');
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Palace Siege'); if (c && !c.jBase && !c.jSiegeAsk) onEnter(c, 'stack', {}); }); await sleep(1200); await A.evaluate(() => { window.__want = null; });
      const k = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Palace Siege'); return c.g23mode ? 'g23:' + c.g23mode : c.k; }); check(/Dragons$/.test(k), 'Dragons chosen: ' + k);
      const l0 = await B.evaluate(() => S.life); const m0 = await A.evaluate(() => S.life);
      await A.evaluate(() => fireSteps('upkeep', MYPID)); for (let i = 0; i < 8; i++){ await passAll([B]); await A.evaluate(() => { const t = stackTop(); if (t && t.pid === MYPID && !UI.resolving) resolveTop(t.it); }); await sleep(300); } await sync();
      check(await B.evaluate(() => S.life) === l0 - 2 && await A.evaluate(() => S.life) === m0 + 2, 'drain 2 at upkeep');
    });
    await step('Thieving Amalgam: manifest the top card of Kim\'s library under my control', async () => {
      await clean(A); const top = await B.evaluate(() => [S.lib.length, cname(S.lib[0])]);
      await fx(A, 'Thieving Amalgam', 'You manifest the top card of that player\'s library.', {it:{evPid:await B.evaluate(() => MYPID)}}); await sync();
      const r = await A.evaluate(() => S.bf.filter(c => c.fd && c.own).map(c => [cname(c), stats(c).join('/')]));
      check(r.length === 1 && r[0][1] === '2/2' && await B.evaluate(() => S.lib.length) === top[0] - 1, `a face-down 2/2 of Kim's (${JSON.stringify(r)}, was ${top[1]})`);
    });
    await step('Emerald Charm: Kim\'s Kulrath Knight loses flying until end of turn (seen on my side too)', async () => {
      await clean(B); await clean(A); await put(B, 'Kulrath Knight'); await sync();
      await fx(A, 'Emerald Charm', 'Target creature loses flying until end of turn.', {spell:1, tg:[[{me:0, card:'Kulrath Knight'}]]}); await sync();
      check(await B.evaluate(() => !kwOf(S.bf.find(c => cname(c) === 'Kulrath Knight'), 'flying')), 'no flying on Kim\'s client');
      check(await A.evaluate(() => { const [pid, st] = [...OPP.entries()][0]; return !kwOf(st.bf.find(c => c.k && info(c.k)?.n === 'Kulrath Knight'), 'flying', pid); }), 'no flying as seen by me');
    });
    await step('Archetype of Finality: Kim\'s creatures lose deathtouch', async () => {
      await clean(A); await put(A, 'Archetype of Finality'); await clean(B); await put(B, 'Grizzly Bears'); await B.evaluate(() => { S.bf.find(c => cname(c) === 'Grizzly Bears').ekw = ['deathtouch']; commit(); }); await sync();
      check(await B.evaluate(() => !kwOf(S.bf.find(c => cname(c) === 'Grizzly Bears'), 'deathtouch')), 'Bears has no deathtouch');
      check(await A.evaluate(() => kwOf(S.bf.find(c => cname(c) === 'Archetype of Finality'), 'deathtouch')), 'my Archetype keeps deathtouch');
    });
    await step('Tangle: Kim\'s attacking creature does not untap in her next untap step', async () => {
      await clean(B); await put(B, 'Grizzly Bears'); await B.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Grizzly Bears'); c.atk = 'p:x'; c.tap = true; commit(); }); await sync();
      await fx(A, 'Tangle', 'Each attacking creature doesn\'t untap during its controller\'s next untap step.', {spell:1}); await sync();
      const r = await B.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Grizzly Bears'); c.atk = ''; const t = currentTurn(); S.ph = [t[2] || 0, t[0], 0]; setPhase(0); return [c.tap, !!c.jNoUntap]; });
      check(r[0] === true && !r[1], 'Bears stayed tapped through the untap step, once ' + JSON.stringify(r));
    });
    await step('Abstruse Appropriation: exile Kim\'s Kulrath Knight; I may cast it from exile', async () => {
      await clean(B); await put(B, 'Kulrath Knight'); await sync();
      await fx(A, 'Abstruse Appropriation', oracle('Abstruse Appropriation'), {spell:1, tg:[[{me:0, card:'Kulrath Knight'}]]}); await sync(); await sleep(1000);
      check(await B.evaluate(() => !S.bf.some(c => cname(c) === 'Kulrath Knight') && S.ex.some(c => cname(c) === 'Kulrath Knight')), 'Angel is in Kim\'s exile');
      check(await A.evaluate(() => S.ex.some(c => cname(c) === 'Kulrath Knight' && c.mayPlay)), 'I may cast it (playable from my exile view)');
    });
    await step('Aberrant Return: Kim\'s Bears from her graveyard to my battlefield with a -1/-1 counter', async () => {
      await B.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Grizzly Bears') || S.lib.find(c => cname(c) === 'Grizzly Bears'); if (c) moveCard(c.id, 'gy', {quiet:true}); commit(); }); await sync();
      await fx(A, 'Aberrant Return', oracle('Aberrant Return'), {spell:1, tg:[[{me:0, gy:'Grizzly Bears'}]]}); await sync(); await sleep(800);
      const r = await A.evaluate(() => S.bf.filter(c => cname(c) === 'Grizzly Bears').map(c => [c.cm || 0, !!c.own]));
      check(r.some(x => x[0] === 1), 'Bears under my control with a -1/-1 counter ' + JSON.stringify(r));
    });
    await step('Ixhel: Kim with 3 poison exiles her top card; I may play it', async () => {
      await B.evaluate(() => { S.psn = 3; commit(); }); await sync(); const top = await B.evaluate(() => cname(S.lib[0]));
      await fx(A, 'Ixhel, Scion of Atraxa', 'Each opponent who has three or more poison counters exiles the top card of their library face down. You may look at and play those cards for as long as they remain exiled, and you may spend mana as though it were mana of any color to cast those spells.'); await sync(); await sleep(800);
      check(await A.evaluate(n => S.ex.some(c => cname(c) === n && c.mayPlay), top), `I may play Kim's ${top}`);
      await B.evaluate(() => { S.psn = 0; commit(); });
    });
    await step('Grand Warlord Radha: mana from attackers survives the end of combat', async () => {
      await clean(A); await put(A, 'Grand Warlord Radha'); await put(A, 'Grizzly Bears'); await A.evaluate(() => { S.bf.filter(c => isCreatureCard(c)).forEach(c => { c.atk = 'p:' + opponents()[0].pid; }); S.pool = emptyPool(); commit(); });
      await fx(A, 'Grand Warlord Radha', 'Add that much mana in any combination of {R} and/or {G}. Until end of turn, you don\'t lose this mana as steps and phases end.');
      const p1 = await A.evaluate(() => poolTotal(S.pool));
      await A.evaluate(() => { S.bf.forEach(c => { c.atk = ''; }); const t = currentTurn(); S.ph = [t[2] || 0, t[0], 5]; S.seenPh = 'x'; commit(); engineTick(); });
      const p2 = await A.evaluate(() => poolTotal(S.pool));
      check(p1 === 2 && p2 === 2, `2 mana added and kept after the phase changed (${p1} → ${p2})`);
      await A.evaluate(() => { S.pool = emptyPool(); S.jKeepMana = null; S.jKeepAmt = 0; const t = currentTurn(); S.ph = [t[2] || 0, t[0], 3]; commit(); });
    });

    const resolveMine = async () => { for (let i = 0; i < 10; i++){ await passAll([B]); await A.evaluate(() => { const t = stackTop(); if (t && t.pid === MYPID && !UI.resolving) resolveTop(t.it); }); await sleep(250); if (!(await A.evaluate(() => stackAll().length))) break; } };
    await step('Rite of Passage: my damaged creature gets a +1/+1 counter', async () => {
      await clean(A); await put(A, 'Rite of Passage'); await put(A, 'Grizzly Bears');
      await A.evaluate(() => { damageCard(S.bf.find(c => cname(c) === 'Grizzly Bears'), 1, {}); commit(); }); await sleep(400); await resolveMine();
      check(await A.evaluate(() => S.bf.find(c => cname(c) === 'Grizzly Bears').cp) === 1, 'Bears got a +1/+1 counter');
    });
    await step('Ivora: "enters and whenever it deals combat damage" — the enter half makes a Blood token', async () => {
      await clean(A); await A.evaluate(() => { const k = [...DICT.values()].find(a => a.n === 'Ivora, Insatiable Heir').k; const c = {id:S.nid++, k, n:1}; place(c); S.bf.push(c); onEnter(c, 'stack', {}); commit(); }); await sleep(500); await resolveMine();
      check(await A.evaluate(() => S.bf.some(c => c.tok && /Blood/.test(cname(c)))), 'a Blood token');
      check(await A.evaluate(() => trigsOf([...DICT.values()].find(a => a.n === 'Ivora, Insatiable Heir').k).some(t => (t.evs || []).includes('cdmg'))), 'the same trigger also listens for combat damage');
    });
    await step('Karn, Scion of Urza +1: Kim chooses on her screen; one card to my hand, the other exiled with a silver counter', async () => {
      await clean(A); await put(A, 'Karn, Scion of Urza'); const h0 = await A.evaluate(() => S.hand.length); const top = await A.evaluate(() => S.lib.slice(0, 2).map(cname));
      await B.evaluate(() => { window.__modals = []; });
      await fx(A, 'Karn, Scion of Urza', 'Reveal the top two cards of your library. An opponent chooses one of them. Put that card into your hand and exile the other with a silver counter on it.'); await sleep(500);
      const r = await A.evaluate(() => [S.hand.length, S.ex.filter(c => (c.nc || {}).silver).map(cname)]); const bm = await B.evaluate(() => (window.__modals || []).join(' / '));
      check(r[0] === h0 + 1 && r[1].length === 1 && top.includes(r[1][0]), 'hand +1 and one silver-counter card in exile ' + JSON.stringify(r));
      check(/Karn/.test(bm), 'Kim was asked on her own screen: ' + bm.slice(0, 120));
      await fx(A, 'Karn, Scion of Urza', 'Put a card you own with a silver counter on it from exile into your hand.');
      check(await A.evaluate(() => S.hand.length) === h0 + 2, '−1 returned the silver-counter card');
    });
    await step('Sadistic Shell Game: Kim and I each choose a creature I don\'t control; both destroyed', async () => {
      await clean(B); await put(B, 'Grizzly Bears'); await put(B, 'Kulrath Knight'); await sync();
      await fx(A, 'Sadistic Shell Game', oracle('Sadistic Shell Game'), {spell:1}); await sync(); await sleep(800);
      const n = await B.evaluate(() => S.bf.filter(c => c.k && isCreatureCard(c)).length);
      check(n <= 1, `Kim lost the chosen creature(s) (${n} left)`);
    });
    await step('Pontiff of Blight: extort when I cast a spell (pay {W/B}: Kim loses 1, I gain 1)', async () => {
      await clean(A); await put(A, 'Pontiff of Blight'); await put(A, 'Grizzly Bears'); await A.evaluate(() => { S.pool = {...emptyPool(), B:2}; commit(); });
      const l0 = await B.evaluate(() => S.life); const m0 = await A.evaluate(() => S.life);
      await A.evaluate(() => { emit({type:'cast', k:S.bf.find(c => cname(c) === 'Grizzly Bears').k, id:0}); }); await sleep(2500); await sync();
      const l1 = await B.evaluate(() => S.life); const m1 = await A.evaluate(() => S.life);
      check(l1 === l0 - 2 && m1 === m0 + 2, `two extort instances (Pontiff + Bears): Kim ${l0}→${l1}, me ${m0}→${m1}`);
      await A.evaluate(() => { S.pool = emptyPool(); commit(); });
    });
    await step('Jodah: every spell in hand offers "{W}{U}{B}{R}{G} instead of its mana cost"', async () => {
      await clean(A); await put(A, 'Jodah, Archmage Eternal'); await give(A, 'Kulrath Knight');
      const r = await A.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Kulrath Knight'); return r21bAlts(c, 'hand').map(o => o.kind + ':' + o.mana); });
      check(r.includes('jwubrg:{W}{U}{B}{R}{G}'), 'alternative cost offered ' + JSON.stringify(r));
    });
    await step('Sarkhan the Masterless +1: my planeswalkers become 4/4 flying Dragons until end of turn', async () => {
      await clean(A); await put(A, 'Sarkhan the Masterless');
      await fx(A, 'Sarkhan the Masterless', 'Until end of turn, each planeswalker you control becomes a 4/4 red Dragon creature and gains flying.');
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Sarkhan the Masterless'); return [isCreatureCard(c), stats(c).join('/'), kwOf(c, 'flying'), /Dragon/.test(typeOf(c))]; });
      check(r[0] && r[1] === '4/4' && r[2] && r[3], 'Sarkhan is a 4/4 flying Dragon ' + JSON.stringify(r));
    });
    await step("Day's Undoing on my turn: hands/graveyards shuffled, seven cards, turn ends", async () => {
      await fx(A, "Day's Undoing", oracle("Day's Undoing"), {spell:1}); await sync(); await sleep(1500);
      const r = await A.evaluate(() => [S.hand.length, phaseNow().ph, currentTurn()[1] === MYPID]); const b = await B.evaluate(() => S.hand.length);
      console.log('    hand/phase/my turn', r, 'Kim hand', b);
      check(r[0] === 7 && b >= 7, 'both players have seven cards (Kim may already have drawn for her turn)');
      check(!r[2] || r[1] === 7, 'my turn ended (cleanup or passed)');
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
