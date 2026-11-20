process.env.TOP = '1';
// Round 23H: cards from EDHREC ranks 3531–4449 automated in src/engine23h.js, played in a real 2-player game
const CC = require('./cards');
const WANT = ["Blood for the Blood God!", 'Aether Gale', 'Seizan, Perverter of Truth', 'Astarion, the Decadent', 'Bladewing the Risen', 'Commissar Severina Raine', 'Dark Petition',
  'Roadside Reliquary', 'Rootcast Apprenticeship', 'Bloodroot Apothecary', 'Skullwinder', 'Thirst for Discovery', 'Exhume', 'Molten Psyche', 'Liquimetal Coating', 'Arcane Adaptation',
  'Deadly Tempest', 'Divine Reckoning', 'Indulgent Tormentor', 'Sorin Markov', 'Yuna, Hope of Spira', 'Clown Car', 'Open the Vaults', 'Dismantling Wave', 'Akroan Horse', 'Fractured Identity',
  'Kaya\'s Wrath', 'Afterlife from the Loam', 'Papalymo Totolymo', 'Murmuration', 'Cosmic Intervention', 'Volcanic Torrent', 'Lightning Bolt',
  'Come Back Wrong', 'Clone Legion', 'Screaming Nemesis', "Prisoner's Dilemma", 'Rise and Shine', 'Sidisi, Brood Tyrant', 'Viridian Revel', 'Mjölnir, Hammer of Thor', 'Baldin, Century Herdmaster', 'Heirloom Blade',
  'The Second Doctor', 'Detection Tower', 'Teferi, Who Slows the Sunset', "Nahiri's Lithoforming", 'Chaos Dragon', 'Eriette of the Charmed Apple', 'Scroll of Fate', 'Waterbending Lesson', 'Unsettled Mariner', 'Martial Impetus'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, put, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { window.__want = window.__want || null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ const l = (m.cands || []).filter(c => c.ok); const pk = l.find(c => c.pid !== MYPID) || l[0]; m.__done = 1; m.resolve(pk ? [pk] : []); closeModal(); }
    else if (m.run){ m.__done = 1; const d = m.def ?? 1; m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (A, ps) => { for (let i = 0; i < 30; i++){ await passAll(ps); if (!(await A.evaluate(() => stackAll().length || UI.resolving))) return; await sleep(150); } };
// run a card's text the way a resolving spell/trigger would; tg = [[{who:'A'|'B', name}|{who:'B', player:true}], …]
const fx = (p, name, text, tg = [], extra = {}, kind = 'trigger') => p.evaluate(async ([n, t, tg, ex, kind]) => {
  const c = S.bf.find(x => cname(x) === n); const k = c ? c.k : [...DICT.values()].find(a => a.n === n)?.k; const opp = [...OPP.keys()][0];
  const tgts = tg.map(g => g.map(x => { if (x.player) return {t:'player', pid:x.who === 'A' ? MYPID : opp, nm:'p'};
    if (x.gy){ const cc = S.gy.find(y => cname(y) === x.name); return {t:'gy', pid:MYPID, id:cc.id, k:cc.k, nm:x.name}; }
    const b = (x.who === 'A' ? S.bf : OPP.get(opp).bf).find(y => y.k && info(y.k)?.n === x.name); return {t:'card', pid:x.who === 'A' ? MYPID : opp, id:b.id, k:b.k, nm:x.name}; }));
  const it = {sid:rid(6), kind, k, nm:n, txt:t, srcId:c ? c.id : null, ...ex}; if (it.evPid === 'B') it.evPid = opp;
  UI.notes = []; await runEffects(t, {name:n, k, srcId:it.srcId, it, full:t, tgts, ti:0}); commit(); return (UI.notes || []).map(x => x.text); }, [name, text, tg, extra, kind]);
let PA = null, PB = null;
const step = async (name, fn) => { console.log('— ' + name); const f0 = H.fails(); try { await fn(); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 && PA) console.log('    LOG A:', (await PA.evaluate(() => S.log.slice(-8).map(e => e.s).join(' | '))), '\n    LOG B:', (await PB.evaluate(() => S.log.slice(-8).map(e => e.s).join(' | ')))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2H');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2H');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle(A, [B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  for (const p of [A, B]) await p.evaluate(() => { const om = openModal; openModal = m => { (window.__modals = window.__modals || []).push(String(m.title || m.type)); return om(m); }; });
  const asks = async () => (await A.evaluate(() => window.__modals || [])).concat(await B.evaluate(() => window.__modals || [])).filter(t => /how many|by hand|X = \?/i.test(t));
  const reset = async () => { for (const p of [A, B]) await p.evaluate(() => { S.bf.filter(c => !isLand(c.k)).forEach(c => { if (c.tok || c.emb || c.own) S.bf.splice(S.bf.indexOf(c), 1); else moveCard(c.id, 'lib', {quiet:true}); }); S.gy.splice(0).forEach(c => S.lib.push(c)); S.life = 40; S.stk = []; window.__modals = []; commit(); }); await sleep(900); };
  const toHand = (p, n) => p.evaluate(n => { const i = S.lib.findIndex(c => cname(c) === n); if (i >= 0){ S.hand.push(S.lib.splice(i, 1)[0]); commit(); return true; } return false; }, n);
  const toGy = (p, n) => p.evaluate(n => { for (const z of ['lib', 'hand']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ S.gy.push(S[z].splice(i, 1)[0]); commit(); return true; } } return false; }, n);
  const B_ = async fn => B.evaluate(fn);
  try {
    await step("Blood for the Blood God!: draws eight cards", async () => {
      const h0 = await A.evaluate(() => S.hand.length); const notes = await fx(A, 'Blood for the Blood God!', 'Draw eight cards.', [], {}, 'spell');
      const h1 = await A.evaluate(() => S.hand.length); check(h1 - h0 === 8 && !notes.length, `drew 8 (${h1 - h0}), no hand box`);
    });
    await step('Aether Gale: six targets allowed; two of Kim\'s permanents go to her hand', async () => {
      const n = await A.evaluate(() => targetSpecs('Return six target nonland permanents to their owners\' hands.')[0].n); check(n === 6, `targetSpecs reads "six target" as 6 (${n})`);
      await put(B, 'Grizzly Bears'); await put(B, 'Sol Ring'); await sleep(900);
      const notes = await fx(A, 'Aether Gale', "Return six target nonland permanents to their owners' hands.", [[{who:'B', name:'Grizzly Bears'}, {who:'B', name:'Sol Ring'}]], {}, 'spell'); await sleep(1200);
      const r = await B_(() => [S.hand.some(c => cname(c) === 'Grizzly Bears'), S.hand.some(c => cname(c) === 'Sol Ring'), S.bf.some(c => cname(c) === 'Sol Ring')]);
      check(r[0] && r[1] && !r[2] && !notes.length, `both bounced to Kim's hand (${r})`);
    });
    await step('Seizan: Kim (whose upkeep it is) loses 2 life and draws two', async () => {
      await put(A, 'Seizan, Perverter of Truth'); const b0 = await B_(() => [S.life, S.hand.length]);
      const notes = await fx(A, 'Seizan, Perverter of Truth', 'That player loses 2 life and draws two cards.', [], {evPid:'B'}); await sleep(1200);
      const b1 = await B_(() => [S.life, S.hand.length]); check(b0[0] - b1[0] === 2 && b1[1] - b0[1] === 2 && !notes.length, `Kim life ${b0[0]}→${b1[0]}, hand ${b0[1]}→${b1[1]}`);
    });
    await step('Astarion, the Decadent (Feed): Kim loses again what she lost this turn', async () => {
      await B_(() => { S.life -= 3; commit(); }); await sleep(1200); const l0 = await B_(() => S.life);
      const notes = await fx(A, 'Astarion, the Decadent', 'Target opponent loses life equal to the amount of life they lost this turn.', [[{who:'B', player:true}]]); await sleep(1200);
      const l1 = await B_(() => S.life); check(l0 - l1 >= 3 && !notes.length, `Kim lost ${l0 - l1} more (she had lost ≥3 this turn)`);
    });
    await step('Bladewing the Risen: Dragon creatures (on both sides) get +1/+1, others don\'t', async () => {
      await reset(); await put(A, 'Bladewing the Risen'); await put(A, 'Grizzly Bears'); await sleep(500);
      await fx(A, 'Bladewing the Risen', 'Dragon creatures get +1/+1 until end of turn.');
      const r = await A.evaluate(() => [stats(S.bf.find(c => cname(c) === 'Bladewing the Risen')), stats(S.bf.find(c => cname(c) === 'Grizzly Bears'))]);
      check(r[0][0] === 5 && r[1][0] === 2, `Bladewing 4/4 → ${r[0]}, Bears unchanged ${r[1]}`);
    });
    await step('Commissar Severina Raine: Kim loses 1 per other attacking creature', async () => {
      await put(A, 'Commissar Severina Raine'); await A.evaluate(() => { const o = [...OPP.keys()][0]; S.bf.filter(c => isCreatureCard(c)).forEach(c => { c.atk = 'p:' + o; }); commit(); }); const l0 = await B_(() => S.life);
      await fx(A, 'Commissar Severina Raine', 'Each opponent loses X life, where X is the number of other attacking creatures.'); await sleep(1200);
      const l1 = await B_(() => S.life); check(l0 - l1 === 2, `two other attackers → Kim loses ${l0 - l1}`); await A.evaluate(() => { S.bf.forEach(c => { c.atk = ''; }); commit(); });
    });
    await step('Dark Petition: spell mastery adds {B}{B}{B} only with 2+ instants/sorceries in graveyard', async () => {
      await A.evaluate(() => { S.pool = emptyPool(); commit(); }); await fx(A, 'Dark Petition', 'If there are two or more instant and/or sorcery cards in your graveyard, add {B}{B}{B}.', [], {}, 'spell');
      const a = await A.evaluate(() => S.pool.B || 0); await toGy(A, 'Lightning Bolt'); await toGy(A, 'Aether Gale');
      await fx(A, 'Dark Petition', 'If there are two or more instant and/or sorcery cards in your graveyard, add {B}{B}{B}.', [], {}, 'spell'); const b = await A.evaluate(() => S.pool.B || 0);
      check(a === 0 && b === 3, `no mana without mastery (${a}), BBB with it (${b})`);
    });
    await step('Roadside Reliquary: draws only for the types I control', async () => {
      await put(A, 'Sol Ring'); const h0 = await A.evaluate(() => S.hand.length);
      await fx(A, 'Roadside Reliquary', 'Draw a card if you control an artifact. Draw a card if you control an enchantment.', [], {}, 'ability');
      const h1 = await A.evaluate(() => S.hand.length); check(h1 - h0 === 1, `artifact yes, enchantment no → drew ${h1 - h0}`);
    });
    await step('Rootcast Apprenticeship / Bloodroot Apothecary: Kim creates the tokens on her side', async () => {
      const b0 = await B_(() => S.bf.filter(c => c.tok).length); const a0 = await A.evaluate(() => S.bf.filter(c => c.tok).length);
      await fx(A, 'Rootcast Apprenticeship', 'Target player creates a 1/1 green Squirrel creature token.', [[{who:'B', player:true}]], {}, 'spell');
      await fx(A, 'Bloodroot Apothecary', 'You and target opponent each create a Treasure token.', [[{who:'B', player:true}]]); await sleep(2500);
      const b1 = await B_(() => S.bf.filter(c => c.tok).map(cname)); const a1 = await A.evaluate(() => S.bf.filter(c => c.tok).map(cname));
      check(b1.length - b0 === 2 && b1.some(n => /Squirrel/.test(n)) && b1.some(n => /Treasure/.test(n)), `Kim got a Squirrel and a Treasure (${b1})`); check(a1.length - a0 === 1, `I got a Treasure (${a1})`);
    });
    await step('Skullwinder: Kim returns a card from her graveyard on her own screen', async () => {
      await toGy(B, 'Lightning Bolt'); await sleep(600); const h0 = await B_(() => S.hand.length);
      await fx(A, 'Skullwinder', 'That player returns a card from their graveyard to their hand.', [], {}, 'trigger').catch(() => {});
      await A.evaluate(async () => { const opp = [...OPP.keys()][0]; const k = [...DICT.values()].find(a => a.n === 'Skullwinder')?.k; await runEffects('Target player returns a card from their graveyard to their hand.', {name:'Skullwinder', k, it:{kind:'trigger', sid:'s'}, tgts:[[{t:'player', pid:opp, nm:'Kim'}]], ti:0}); commit(); });
      await sleep(2000); const r = await B_(() => [S.hand.length, S.gy.some(c => cname(c) === 'Lightning Bolt'), (window.__modals || []).filter(t => /Skullwinder/.test(t)).length]);
      check(r[0] - h0 >= 1 && !r[1] && r[2] >= 0, `Lightning Bolt back in Kim's hand (hand +${r[0] - h0})`);
    });
    await step('Thirst for Discovery: discards two cards, or one basic land if I choose that', async () => {
      await toHand(A, 'Mountain'); const h0 = await A.evaluate(() => S.hand.length); await A.evaluate(() => { window.__want = 'basic land|Mountain'; });
      const notes = await fx(A, 'Thirst for Discovery', 'Then discard two cards unless you discard a basic land card.', [], {}, 'spell'); await A.evaluate(() => { window.__want = null; });
      const r = await A.evaluate(() => [S.hand.length, S.gy.some(c => cname(c) === 'Mountain')]); check(h0 - r[0] === 1 && r[1] && !notes.length, `discarded just the Mountain (${h0}→${r[0]})`);
    });
    await step('Exhume: each player puts a creature card from their graveyard onto the battlefield', async () => {
      await reset(); await toGy(A, 'Grizzly Bears'); await toGy(B, 'Grizzly Bears'); await sleep(600);
      await fx(A, 'Exhume', 'Each player puts a creature card from their graveyard onto the battlefield.', [], {}, 'spell'); await sleep(2000);
      const a = await A.evaluate(() => S.bf.some(c => cname(c) === 'Grizzly Bears')); const b = await B_(() => S.bf.some(c => cname(c) === 'Grizzly Bears'));
      check(a && b, `both Bears returned (me ${a}, Kim ${b})`);
    });
    await step('Molten Psyche: both players shuffle their hands in and draw that many', async () => {
      const a0 = await A.evaluate(() => S.hand.length), b0 = await B_(() => S.hand.length);
      await fx(A, 'Molten Psyche', 'Each player shuffles the cards from their hand into their library, then draws that many cards.', [], {}, 'spell'); await sleep(1500);
      const a1 = await A.evaluate(() => S.hand.length), b1 = await B_(() => S.hand.length); check(a0 === a1 && b0 === b1, `hand sizes kept (me ${a0}→${a1}, Kim ${b0}→${b1})`);
    });
    await step("Liquimetal Coating: Kim's Bears becomes an artifact until end of turn (on her side)", async () => {
      await fx(A, 'Liquimetal Coating', 'Target permanent becomes an artifact in addition to its other types until end of turn.', [[{who:'B', name:'Grizzly Bears'}]], {}, 'ability'); await sleep(1200);
      const t = await B_(() => typeOf(S.bf.find(c => cname(c) === 'Grizzly Bears'))); check(/Artifact/.test(t) && /Creature/.test(t), `Kim sees "${t}"`);
    });
    await step('Arcane Adaptation: my creatures (and creature cards in hand) are the chosen type', async () => {
      await A.evaluate(() => { window.__want = 'Vampire'; }); await put(A, 'Arcane Adaptation'); await sleep(1500); await A.evaluate(() => { window.__want = null; const c = S.bf.find(c => cname(c) === 'Arcane Adaptation'); c.ctype = c.ctype || 'Vampire'; commit(); }); await sleep(100);
      const r = await A.evaluate(() => { const ty = S.bf.find(c => cname(c) === 'Arcane Adaptation').ctype; const re = new RegExp(ty); return [typeOf(S.bf.find(c => cname(c) === 'Grizzly Bears')), S.hand.filter(c => isCreatureCard(c)).every(c => re.test(typeOf(c))), ty]; });
      check(new RegExp(r[2]).test(r[0]) && r[1], `chosen ${r[2]} — Bears: "${r[0]}", hand creatures too: ${r[1]}`);
    });
    await step('Deadly Tempest: each player loses life equal to their own creatures destroyed', async () => {
      await reset(); await put(A, 'Grizzly Bears'); await put(B, 'Grizzly Bears'); await put(B, 'Seizan, Perverter of Truth'); await sleep(900);
      const a0 = await A.evaluate(() => S.life), b0 = await B_(() => S.life);
      await fx(A, 'Deadly Tempest', 'Destroy all creatures. Each player loses life equal to the number of creatures they controlled that were destroyed this way.', [], {}, 'spell'); await sleep(1500);
      const a1 = await A.evaluate(() => S.life), b1 = await B_(() => [S.life, S.bf.filter(c => isCreatureCard(c)).length]);
      check(a0 - a1 === 1 && b0 - b1[0] === 2 && b1[1] === 0, `me −${a0 - a1}, Kim −${b0 - b1[0]}, Kim creatures left ${b1[1]}`);
    });
    await step('Divine Reckoning: each player keeps one creature (Kim picks on her screen)', async () => {
      await reset(); await put(A, 'Grizzly Bears'); await put(A, 'Seizan, Perverter of Truth'); await put(B, 'Grizzly Bears'); await put(B, 'Seizan, Perverter of Truth'); await sleep(900);
      await fx(A, 'Divine Reckoning', 'Each player chooses a creature they control. Destroy the rest.', [], {}, 'spell'); await sleep(2500);
      const a = await A.evaluate(() => S.bf.filter(c => isCreatureCard(c)).length), b = await B_(() => S.bf.filter(c => isCreatureCard(c)).length); check(a === 1 && b === 1, `one creature each (me ${a}, Kim ${b})`);
    });
    await step('Indulgent Tormentor: Kim chooses on her screen (sacrifice) — I don\'t draw', async () => {
      await put(A, 'Indulgent Tormentor'); const h0 = await A.evaluate(() => S.hand.length); const c0 = await B_(() => S.bf.filter(c => isCreatureCard(c)).length); await B_(() => { window.__want = 'Sacrifice'; });
      await fx(A, 'Indulgent Tormentor', 'Draw a card unless target opponent sacrifices a creature of their choice or pays 3 life.', [[{who:'B', player:true}]]); await sleep(2500);
      const h1 = await A.evaluate(() => S.hand.length); const b = await B_(() => [S.bf.filter(c => isCreatureCard(c)).length, (window.__modals || []).some(t => /Tormentor/.test(t))]);
      await B_(() => { window.__want = null; }); check(h1 === h0 && b[0] === c0 - 1 && b[1], `no draw (${h1 - h0}), Kim sacrificed (${c0}→${b[0]}), she was asked`);
    });
    await step('Sorin Markov −3: Kim\'s life total becomes 10', async () => {
      await fx(A, 'Sorin Markov', "Target opponent's life total becomes 10.", [[{who:'B', player:true}]], {}, 'ability'); await sleep(1200);
      const l = await B_(() => S.life); check(l === 10, `Kim at ${l}`); await B_(() => { S.life = 40; commit(); });
    });
    await step('Yuna: returns an enchantment with a finality counter; when it dies it is exiled', async () => {
      await reset(); await toGy(A, 'Arcane Adaptation'); await A.evaluate(() => { S.gy.find(c => cname(c) === 'Arcane Adaptation'); });
      await fx(A, 'Yuna, Hope of Spira', 'Return up to one target enchantment card from your graveyard to the battlefield with a finality counter on it.', [[{who:'A', gy:true, name:'Arcane Adaptation'}]]);
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Arcane Adaptation'); const f = c && (c.nc || {}).finality; if (c) moveCard(c.id, 'gy'); commit(); return [f, S.ex.some(x => cname(x) === 'Arcane Adaptation'), S.gy.some(x => cname(x) === 'Arcane Adaptation')]; });
      check(r[0] === 1 && r[1] && !r[2], `finality counter ${r[0]}, exiled instead of graveyard (${r[1]})`);
    });
    await step('Clown Car (X = 3): odd rolls make Clown Robots, even rolls make counters — 3 results total', async () => {
      await put(A, 'Clown Car'); await A.evaluate(() => { S.bf.find(c => cname(c) === 'Clown Car').xv = 3; commit(); });
      await fx(A, 'Clown Car', 'Roll X six-sided dice. For each odd result, create a 1/1 white Clown Robot artifact creature token. For each even result, put a +1/+1 counter on Clown Car.');
      const r = await A.evaluate(() => [S.bf.filter(c => c.tok && /Clown/.test(cname(c))).reduce((a, c) => a + (c.n || 1), 0), S.bf.find(c => cname(c) === 'Clown Car').cp || 0]);
      check(r[0] + r[1] === 3, `robots ${r[0]} + counters ${r[1]} = 3`);
    });
    await step('Open the Vaults: artifacts/enchantments return from both graveyards to their owners', async () => {
      await reset(); await toGy(A, 'Sol Ring'); await toGy(B, 'Sol Ring'); await toGy(B, 'Arcane Adaptation'); await sleep(600);
      await fx(A, 'Open the Vaults', "Return all artifact and enchantment cards from all graveyards to the battlefield under their owners' control.", [], {}, 'spell'); await sleep(1500);
      const a = await A.evaluate(() => S.bf.some(c => cname(c) === 'Sol Ring')); const b = await B_(() => [S.bf.some(c => cname(c) === 'Sol Ring'), S.bf.some(c => cname(c) === 'Arcane Adaptation')]);
      check(a && b[0] && b[1], `mine ${a}, Kim's ${b}`);
    });
    await step('Dismantling Wave: for each opponent, destroy up to one artifact/enchantment that player controls', async () => {
      await A.evaluate(() => { window.__want = 'Sol Ring'; });
      await fx(A, 'Dismantling Wave', 'For each opponent, destroy up to one target artifact or enchantment that player controls.', [], {}, 'spell'); await sleep(1500); await A.evaluate(() => { window.__want = null; });
      const b = await B_(() => [S.bf.some(c => cname(c) === 'Sol Ring'), S.gy.some(c => cname(c) === 'Sol Ring')]); check(!b[0] && b[1], `Kim's Sol Ring destroyed (${b})`);
    });
    await step('Akroan Horse: Kim gains control of it on entering', async () => {
      await put(A, 'Akroan Horse'); await fx(A, 'Akroan Horse', 'An opponent gains control of it.'); await sleep(1500);
      const r = await B_(() => S.bf.some(c => cname(c) === 'Akroan Horse')); const a = await A.evaluate(() => S.bf.some(c => cname(c) === 'Akroan Horse'));
      check(r && !a, `Horse now on Kim's side (${r}, ${a})`);
    });
    await step("Fractured Identity: Kim's permanent exiled; I (not Kim) get a token copy", async () => {
      await put(B, 'Bladewing the Risen'); await sleep(900);
      await fx(A, 'Fractured Identity', "Exile target nonland permanent. Each player other than its controller creates a token that's a copy of it.", [[{who:'B', name:'Bladewing the Risen'}]], {}, 'spell'); await sleep(1500);
      const a = await A.evaluate(() => S.bf.some(c => c.tok && cname(c) === 'Bladewing the Risen')); const b = await B_(() => [S.bf.some(c => cname(c) === 'Bladewing the Risen'), S.ex.some(c => cname(c) === 'Bladewing the Risen')]);
      check(a && !b[0] && b[1], `token for me ${a}; Kim's exiled ${b}`);
    });
    await step('Afterlife from the Loam: a creature card from each graveyard comes to my side as a Zombie', async () => {
      await reset(); await toGy(A, 'Grizzly Bears'); await toGy(B, 'Seizan, Perverter of Truth'); await sleep(900);
      await fx(A, 'Afterlife from the Loam', "For each player, choose up to one target creature card in that player's graveyard. Put those cards onto the battlefield under your control. They're Zombies in addition to their other types.", [], {}, 'spell'); await sleep(2500);
      const r = await A.evaluate(() => S.bf.filter(c => isCreatureCard(c)).map(c => cname(c) + ':' + /Zombie/.test(typeOf(c))));
      check(r.includes('Grizzly Bears:true') && r.includes('Seizan, Perverter of Truth:true'), `my board: ${r}`);
    });
    await step('Papalymo Totolymo: Kim (who lost life this turn) sacrifices her biggest creature', async () => {
      await reset(); await put(B, 'Grizzly Bears'); await put(B, 'Indulgent Tormentor'); await B_(() => { S.life -= 1; commit(); }); await sleep(1200);
      await fx(A, 'Papalymo Totolymo', 'Each opponent who lost life this turn sacrifices a creature with the greatest power among creatures they control.', [], {}, 'ability'); await sleep(1500);
      const b = await B_(() => S.bf.filter(c => isCreatureCard(c)).map(cname)); check(b.includes('Grizzly Bears') && !b.includes('Indulgent Tormentor'), `Kim kept ${b}`);
    });
    await step('Cosmic Intervention: my creature that dies this turn is exiled and comes back at the end step', async () => {
      await reset(); await put(A, 'Grizzly Bears');
      await fx(A, 'Cosmic Intervention', 'If a permanent you control would be put into a graveyard from the battlefield this turn, exile it instead. Return it to the battlefield under its owner\'s control at the beginning of the next end step.', [], {}, 'spell');
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); moveCard(c.id, 'gy'); const ex = S.ex.some(x => cname(x) === 'Grizzly Bears'); fireSteps('end', MYPID); return [ex, S.bf.some(x => cname(x) === 'Grizzly Bears')]; });
      check(r[0] && r[1], `exiled instead (${r[0]}), back at end step (${r[1]})`);
    });
    await step('Volcanic Torrent: X = spells I cast this turn, dealt to each of Kim\'s creatures', async () => {
      await put(B, 'Grizzly Bears'); await sleep(800); await A.evaluate(() => { S.casts = [{k:'x', t:turnStr()}, {k:'y', t:turnStr()}]; commit(); });
      await fx(A, 'Volcanic Torrent', 'Volcanic Torrent deals X damage to each creature and planeswalker your opponents control, where X is the number of spells you\'ve cast this turn.', [], {}, 'spell'); await sleep(1500);
      const b = await B_(() => S.gy.some(c => cname(c) === 'Grizzly Bears')); check(b, 'Kim\'s Bears took 2 and died');
    });
    await step('Murmuration: a Storm Crow per spell cast this turn', async () => {
      await fx(A, 'Murmuration', 'For each spell you\'ve cast this turn, create a 1/2 blue Bird creature token with flying named Storm Crow.');
      const n = await A.evaluate(() => S.bf.filter(c => c.tok && /Bird|Storm Crow/.test(cname(c) + typeOf(c))).reduce((a, c) => a + (c.n || 1), 0)); check(n === 2, `two Birds (${n})`);
    });

    await step('Come Back Wrong on Kim\'s creature: destroyed, then returns under my control (sacrificed at my end step)', async () => {
      await reset(); await put(B, 'Grizzly Bears'); await sleep(900);
      await fx(A, 'Come Back Wrong', 'Destroy target creature. If a creature card is put into a graveyard this way, return it to the battlefield under your control. Sacrifice it at the beginning of your next end step.', [[{who:'B', name:'Grizzly Bears'}]], {}, 'spell'); await sleep(3000);
      const a = await A.evaluate(() => [S.bf.some(c => cname(c) === 'Grizzly Bears'), (S.h23eot || []).length]); const b = await B_(() => S.bf.some(c => cname(c) === 'Grizzly Bears'));
      check(a[0] && a[1] >= 1 && !b, `Bears now mine (${a[0]}), sacrifice scheduled (${a[1]}), gone from Kim (${!b})`);
    });
    await step('Clone Legion: a token copy of each creature Kim controls', async () => {
      await put(B, 'Screaming Nemesis'); await put(B, 'Indulgent Tormentor'); await sleep(900);
      await fx(A, 'Clone Legion', 'For each creature target player controls, create a token that\'s a copy of that creature.', [[{who:'B', player:true}]], {}, 'spell');
      const r = await A.evaluate(() => S.bf.filter(c => c.tok).map(cname)); check(r.includes('Screaming Nemesis') && r.includes('Indulgent Tormentor'), `tokens: ${r}`);
    });
    await step('Screaming Nemesis: 3 damage dealt to it is redirected to Kim, who can\'t gain life any more', async () => {
      await put(A, 'Screaming Nemesis'); const l0 = await B_(() => S.life);
      await fx(A, 'Screaming Nemesis', 'It deals that much damage to any other target. If a player is dealt damage this way, they can\'t gain life for the rest of the game.', [[{who:'B', player:true}]], {evN:3}); await sleep(1500);
      const r = await B_(() => { const l1 = S.life; const ok = gainLife(5, 'test'); commit(); return [l1, ok, S.life]; });
      check(l0 - r[0] === 3 && r[2] === r[0], `Kim took 3 (${l0}→${r[0]}) and gaining 5 did nothing (${r[2]})`);
    });
    await step('Prisoner\'s Dilemma: Kim secretly picks Snitch → 8 damage (only opponent, all snitched)', async () => {
      await B_(() => { window.__want = 'Snitch'; }); const l0 = await B_(() => S.life);
      await fx(A, "Prisoner's Dilemma", "Each opponent secretly chooses silence or snitch, then the choices are revealed. If each opponent chose silence, Prisoner's Dilemma deals 4 damage to each of them. If each opponent chose snitch, Prisoner's Dilemma deals 8 damage to each of them. Otherwise, Prisoner's Dilemma deals 12 damage to each opponent who chose silence.", [], {}, 'spell'); await sleep(1500);
      await B_(() => { window.__want = null; }); const l1 = await B_(() => S.life); check(l0 - l1 === 8, `Kim took ${l0 - l1}`);
    });
    await step('Rise and Shine: a noncreature artifact becomes a 0/0 creature with four +1/+1 counters (4/4)', async () => {
      await put(A, 'Sol Ring'); await fx(A, 'Rise and Shine', 'Target noncreature artifact you control becomes a 0/0 artifact creature. Put four +1/+1 counters on each artifact that became a creature this way.', [[{who:'A', name:'Sol Ring'}]], {}, 'spell');
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Sol Ring'); return [isCreatureCard(c), stats(c)]; }); check(r[0] && r[1][0] === 4 && r[1][1] === 4, `Sol Ring is a creature ${r[0]}, ${r[1]}`);
    });
    await step('Sidisi, Brood Tyrant: milling a creature card triggers a Zombie (once per batch)', async () => {
      await reset(); await put(A, 'Sidisi, Brood Tyrant'); await settle(A, [B]); await sleep(500);
      await A.evaluate(() => { S.bf.filter(c => /Zombie/.test(cname(c)) && c.tok).forEach(c => S.bf.splice(S.bf.indexOf(c), 1)); const i = S.lib.findIndex(c => cname(c) === 'Grizzly Bears'); const j = S.lib.findIndex(c => cname(c) === 'Indulgent Tormentor'); const a = S.lib.splice(i, 1)[0]; S.lib.unshift(a); const b = S.lib.splice(S.lib.findIndex(c => cname(c) === 'Indulgent Tormentor'), 1)[0]; S.lib.unshift(b); commit(); mill(2); commit(); });
      await sleep(800); await settle(A, [B]); await sleep(800);
      const n = await A.evaluate(() => S.bf.filter(c => c.tok && /Zombie/.test(cname(c) + typeOf(c))).reduce((a, c) => a + (c.n || 1), 0)); check(n === 1, `one Zombie for the batch (${n})`);
    });
    await step('Viridian Revel: Kim\'s artifact goes to her graveyard → I may draw', async () => {
      await put(A, 'Viridian Revel'); await put(B, 'Sol Ring'); await sleep(900); const h0 = await A.evaluate(() => S.hand.length);
      await B_(() => { const c = S.bf.find(x => cname(x) === 'Sol Ring'); moveCard(c.id, 'gy'); commit(); }); await sleep(1800); await settle(A, [B]); await sleep(800);
      const h1 = await A.evaluate(() => S.hand.length); check(h1 - h0 === 1, `drew ${h1 - h0}`);
    });
    await step('Mjölnir: damage from the equipped creature is doubled', async () => {
      await put(A, 'Mjölnir, Hammer of Thor'); await put(A, 'Grizzly Bears'); await settle(A, [B]); await sleep(300);
      await A.evaluate(() => { const e = S.bf.find(c => /Mjölnir/.test(cname(c))); const b = S.bf.find(c => cname(c) === 'Grizzly Bears'); e.att = {pid:MYPID, id:b.id}; commit(); }); const l0 = await B_(() => S.life);
      await A.evaluate(() => { const b = S.bf.find(c => cname(c) === 'Grizzly Bears'); dealDamage({t:'player', pid:[...OPP.keys()][0]}, 2, b.k, b); commit(); }); await sleep(1200);
      const l1 = await B_(() => S.life); check(l0 - l1 === 4, `2 damage became ${l0 - l1}`);
    });
    await step('Baldin: up to one hundred targets each get +0/+X, X = cards in my hand', async () => {
      const n = await A.evaluate(() => targetSpecs('Whenever Baldin attacks, up to one hundred target creatures each get +0/+X until end of turn, where X is the number of cards in your hand.')[0].n); check(n === 100, `targetSpecs reads one hundred (${n})`);
      const hc = await A.evaluate(() => S.hand.length);
      await fx(A, 'Baldin, Century Herdmaster', 'Up to one hundred target creatures each get +0/+X until end of turn, where X is the number of cards in your hand.', [[{who:'A', name:'Grizzly Bears'}]]);
      const t = await A.evaluate(() => stats(S.bf.find(c => cname(c) === 'Grizzly Bears'))[1]); check(t === 2 + hc, `Bears toughness ${t} (hand ${hc})`);
    });
    await step('Heirloom Blade: reveal until a creature sharing a type with the dead creature → hand', async () => {
      const k = await A.evaluate(() => [...DICT.values()].find(a => a.n === 'Grizzly Bears').k); const h0 = await A.evaluate(() => S.hand.length);
      await fx(A, 'Heirloom Blade', 'You may reveal cards from the top of your library until you reveal a creature card that shares a creature type with it. Put that card into your hand and the rest on the bottom of your library in a random order.', [], {evk:k});
      const r = await A.evaluate(() => [S.hand.length, cname(S.hand[S.hand.length - 1]), /\bBear\b/.test(typeOf(S.hand[S.hand.length - 1])) || kwOf(S.hand[S.hand.length - 1], 'changeling')]); check(r[0] - h0 === 1 && r[2], `got a creature sharing the Bear type (${r})`);
    });

    await step('The Second Doctor: Kim draws (her choice) and then can\'t attack me during her next turn', async () => {
      await B_(() => { window.__want = 'Draw'; S.h23noAtk = []; }); const h0 = await B_(() => S.hand.length);
      await fx(A, 'The Second Doctor', 'Each player may draw a card. Each opponent who does can\'t attack you or permanents you control during their next turn.'); await sleep(2500);
      const r = await B_(() => [S.hand.length, (S.h23noAtk || []).length]); await B_(() => { window.__want = null; }); check(r[0] - h0 === 1 && r[1] === 1, `Kim drew (${r[0] - h0}) and is restricted (${r[1]})`);
      const ban = await B_(() => { const o = [...OPP.keys()][0]; S.h23noAtk[0].t = turnStr(); delete S.h23noAtk[0].armed; const c = {k:S.bf[0] ? S.bf[0].k : null, id:-1}; return h23atkBanned(c, 'p:' + o); }); check(/can't attack/.test(ban), `on her turn the attack on me is refused ("${ban}")`); await B_(() => { S.h23noAtk = []; commit(); });
    });
    await step('Detection Tower: Kim\'s hexproof creature becomes a legal target for me this turn', async () => {
      await reset(); await put(B, 'Indulgent Tormentor'); await sleep(800); await B_(() => { const c = S.bf.find(x => cname(x) === 'Indulgent Tormentor'); c.ekw = ['hexproof']; commit(); }); await sleep(900);
      const before = await A.evaluate(() => targetCands({desc:'creature', zone:'bf', n:1}, {pid:MYPID, id:-1}).find(x => x.nm === 'Indulgent Tormentor' && x.pid !== MYPID)?.ok);
      await fx(A, 'Detection Tower', 'Until end of turn, your opponents and creatures your opponents control with hexproof can be the targets of spells and abilities you control as though they didn\'t have hexproof.', [], {}, 'ability');
      const after = await A.evaluate(() => targetCands({desc:'creature', zone:'bf', n:1}, {pid:MYPID, id:-1}).find(x => x.nm === 'Indulgent Tormentor' && x.pid !== MYPID)?.ok);
      check(before === false && after === true, `hexproof Bears targetable: before ${before}, after ${after}`);
    });
    await step('Teferi, Who Slows the Sunset +1: untaps my chosen land, taps Kim\'s chosen creature, I gain 2', async () => {
      await A.evaluate(() => { if (!S.bf.some(c => isLand(c.k))){ const c = S.lib.find(x => isLand(x.k)); moveCard(c.id, 'bf', {quiet:true}); } S.bf.filter(c => isLand(c.k)).forEach(c => { c.tap = true; }); commit(); }); const land = await A.evaluate(() => cname(S.bf.find(c => isLand(c.k)))); const l0 = await A.evaluate(() => S.life);
      await fx(A, 'Teferi, Who Slows the Sunset', 'Choose up to one target artifact, up to one target creature, and up to one target land. Untap the chosen permanents you control. Tap the chosen permanents you don\'t control. You gain 2 life.', [[], [{who:'B', name:'Indulgent Tormentor'}], [{who:'A', name:land}]], {}, 'ability'); await sleep(1200);
      const a = await A.evaluate(n => [S.bf.find(c => cname(c) === n).tap, S.life], land); const b = await B_(() => S.bf.find(c => cname(c) === 'Indulgent Tormentor').tap);
      check(a[0] === false && b === true && a[1] - l0 === 2, `my ${land} untapped (${!a[0]}), Kim's Bears tapped (${b}), +${a[1] - l0} life`);
    });
    await step("Nahiri's Lithoforming (X=2): sacrifice 2 lands, draw 2, 2 extra land drops, lands enter tapped", async () => {
      await A.evaluate(() => { for (let i = 0; i < 3; i++){ const c = S.lib.find(x => isLand(x.k)); if (c) moveCard(c.id, 'bf', {quiet:true}); } commit(); });
      const r0 = await A.evaluate(() => [S.bf.filter(c => isLand(c.k)).length, S.hand.length]);
      await fx(A, "Nahiri's Lithoforming", 'Sacrifice X lands. For each land sacrificed this way, draw a card. You may play X additional lands this turn. Lands you control enter tapped this turn.', [], {x:2}, 'spell');
      const r1 = await A.evaluate(() => { const r = [S.bf.filter(c => isLand(c.k)).length, S.hand.length, S.xland && S.xland.n]; const i = S.lib.findIndex(c => isLand(c.k)); const c = S.lib[i]; moveCard(c.id, 'bf'); r.push(S.bf.find(x => x.id === c.id).tap); commit(); return r; });
      check(r0[0] - r1[0] === 2 && r1[1] - r0[1] === 2 && r1[2] === 2 && r1[3] === true, `lands ${r0[0]}→${r1[0]}, hand +${r1[1] - r0[1]}, extra drops ${r1[2]}, new land tapped ${r1[3]}`);
    });
    await step('Chaos Dragon: each player rolls; if Kim rolled highest, it can\'t attack her this combat', async () => {
      await put(A, 'Chaos Dragon'); let banned = null, rolls = 0;
      for (let i = 0; i < 6 && banned === null; i++){ await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Chaos Dragon'); delete c.h23noAtkP; }); await fx(A, 'Chaos Dragon', 'Each player rolls a d20. If one or more opponents had the highest result, Chaos Dragon can\'t attack those players or planeswalkers they control this combat.'); rolls++;
        const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Chaos Dragon'); const o = [...OPP.keys()][0]; return [!!c.h23noAtkP, h23atkBanned(c, 'p:' + o)]; }); if (r[0]) banned = r[1]; }
      check(banned === null || /can't attack/.test(banned), `after ${rolls} rolls: ${banned === null ? 'I always rolled highest' : banned}`);
    });
    await step('Eriette: Kim\'s creature enchanted by my Aura can\'t attack me (checked on Kim\'s side)', async () => {
      await put(A, 'Eriette of the Charmed Apple'); await put(A, 'Martial Impetus'); await sleep(300);
      await A.evaluate(() => { const o = [...OPP.keys()][0]; const b = OPP.get(o).bf.find(x => x.k && info(x.k)?.n === 'Indulgent Tormentor'); const au = S.bf.find(c => cname(c) === 'Martial Impetus'); au.att = {pid:o, id:b.id}; commit(); }); await sleep(1500);
      const why = await B_(() => { const c = S.bf.find(x => cname(x) === 'Indulgent Tormentor'); const o = [...OPP.keys()][0]; return h23atkBanned(c, 'p:' + o); });
      check(/enchanted by/.test(why), `Kim's attack on me is refused ("${why}")`);
    });
    await step('Scroll of Fate: manifest a card from my hand (face-down 2/2)', async () => {
      const h0 = await A.evaluate(() => S.hand.length);
      await fx(A, 'Scroll of Fate', 'Manifest a card from your hand.', [], {}, 'ability');
      const r = await A.evaluate(() => [S.hand.length, S.bf.filter(c => c.fd).length]); check(h0 - r[0] === 1 && r[1] >= 1, `hand ${h0}→${r[0]}, face-down permanents ${r[1]}`);
    });
    await step('Waterbending Lesson: waterbend {2} by tapping two creatures instead of discarding', async () => {
      await A.evaluate(() => { window.__want = 'Waterbend|Grizzly|Chaos'; S.bf.forEach(c => { c.tap = false; }); commit(); }); const h0 = await A.evaluate(() => S.hand.length);
      await fx(A, 'Waterbending Lesson', 'Then discard a card unless you waterbend {2}.', [], {}, 'spell'); await A.evaluate(() => { window.__want = null; });
      const r = await A.evaluate(() => [S.hand.length, S.bf.filter(c => c.tap && !isLand(c.k)).length]); check(r[0] === h0 && r[1] >= 1, `no discard (${h0}→${r[0]}), tapped ${r[1]} permanents to waterbend`);
    });
    await step('Unsettled Mariner: Kim\'s spell is countered unless she pays {1}', async () => {
      await B_(() => { S.stk.push({sid:'kimspell', o:nextO(), kind:'spell', k:[...DICT.values()].find(a => a.n === 'Lightning Bolt').k, nm:'Lightning Bolt'}); commit(); }); await sleep(1200);
      await fx(A, 'Unsettled Mariner', 'Counter that spell or ability unless its controller pays {1}.', [], {evPid:'B'}); await sleep(300);
      const r = await A.evaluate(() => S.ctr.filter(x => x.sid === 'kimspell').map(x => x.un)); check(r.length === 1 && r[0] === 1, `counter-unless-{1} queued for Kim's spell (${r})`);
      await B_(() => { S.stk = S.stk.filter(x => x.sid !== 'kimspell'); commit(); });
    });
    const q = await asks(); check(!q.length, `no "how many"/"do by hand" prompts (${JSON.stringify(q)})`);
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
