process.env.TOP = '1';
// Round 23K: ranks 6160–6999 — cross-player effects, statics and replacement effects in a real 2-player game
const CC = require('./cards');
const WANT = ['Kudo, King Among Bears', 'Steel Golem', 'Bedlam', 'Darksteel Angel', 'Sleep', 'Kalitas, Traitor of Ghet', 'Necrotic Hex', 'Dire Fleet Ravager', 'Hunted Bonebrute',
  'Kibo, Uktabi Prince', 'Rendmaw, Creaking Nest', 'Through the Forest Gate', 'Space-Time Anomaly', 'Imposing Grandeur', 'Cone of Cold', 'Benevolent Offering', 'Memory Jar', 'Grief',
  'Progenitus', 'Werebear', 'Llanowar Elves', 'Elvish Mystic', 'Wall of Omens', 'Fyndhorn Elves', 'Birds of Paradise', 'Edgar Markov', 'Pitiless Carnage', 'Gix\'s Command', 'Scalelord Reckoner', 'Gift of Paradise', 'Lightning Bolt'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, put, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { window.__want = window.__want || null; window.__tgt = window.__tgt || null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ if (!window.__tgt) return; const re = new RegExp(window.__tgt, 'i'); const c = (m.cands || []).find(x => x.ok && re.test(x.nm)); if (!c) return; m.__done = 1; m.resolve([c]); closeModal(); }
    else if (m.run){ m.__done = 1; const d = m.def ?? 1; m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const toHand = (p, n) => p.evaluate(n => { for (const z of ['lib', 'gy', 'ex', 'bf']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.hand.push(c); commit(); return c.id; } } return S.hand.find(c => cname(c) === n)?.id; }, n);
const cast = (p, n) => p.evaluate(async n => { const c = S.hand.find(x => cname(x) === n); if (!c) return 'not in hand'; S.pool = {...emptyPool(), W:6, U:6, B:6, R:6, G:6, C:6}; commit(); await beginCast(c, 'hand'); return S.hand.includes(c) ? 'not cast' : 'ok'; }, n);
const toGy = (p, n) => p.evaluate(n => { const c = S.bf.find(x => cname(x) === n); if (c){ S.bf.splice(S.bf.indexOf(c), 1); reset(c); S.gy.push(c); commit(); return true; } return false; }, n);
const activate = (p, n, re) => p.evaluate(async ([n, re]) => { const c = S.bf.find(x => cname(x) === n); if (!c) return 'missing'; c.sk = false; c.tap = false; S.pool = {...emptyPool(), W:6, U:6, B:6, R:6, G:6, C:6}; const ab = abilityList(c).find(a => new RegExp(re, 'i').test(a.eff)); if (!ab) return 'no ability'; await activateAbility(c, ab); return 'ok'; }, [n, re]);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { await fn(); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-12).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2k');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2k');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const life = p => p.evaluate(() => S.life);
  const bfNames = p => p.evaluate(() => S.bf.map(cname));
  const after = async () => { await sleep(500); await settle([A, B]); await sleep(1200); await settle([A, B]); await sleep(500); };
  try {
    await step('Kudo, King Among Bears: Kim\'s creatures are base 2/2 Bears on her own client', async () => {
      await put(B, 'Wall of Omens'); await put(B, 'Llanowar Elves'); await put(A, 'Darksteel Angel'); await put(A, 'Kudo, King Among Bears'); await after();
      const r = await B.evaluate(() => { commit(); return S.bf.filter(c => ['Wall of Omens', 'Llanowar Elves'].includes(cname(c))).map(c => [cname(c), stats(c).join('/'), /Bear/.test(typeOf(c))]); });
      console.log('    ', JSON.stringify(r));
      check(r.length === 2 && r.every(x => x[1] === '2/2' && x[2]), 'Wall of Omens (0/4) and Llanowar Elves (1/1) are 2/2 Bears');
      const k = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Darksteel Angel'); return stats(c).join('/'); });
      check(k === '2/2', `Georges's own Darksteel Angel (3/4) is a 2/2 too (${k})`);
      await toGy(A, 'Darksteel Angel');
      await toGy(A, 'Kudo, King Among Bears'); await after();
    });
    await step('Steel Golem: Georges can\'t cast creature spells', async () => {
      await put(A, 'Steel Golem'); await toHand(A, 'Elvish Mystic');
      const r = await A.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Elvish Mystic'); return castCheck(c, 'hand'); });
      check(!r.ok && /Steel Golem/.test(r.why), `cast blocked: ${r.why}`);
      await toHand(A, 'Sleep'); const s = await A.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Sleep'); return castCheck(c, 'hand'); });
      check(s.ok || !/Steel Golem/.test(s.why), 'noncreature spells are not blocked by Steel Golem (' + (s.why || 'ok') + ')');
      await toGy(A, 'Steel Golem');
    });
    await step('Bedlam: creatures can\'t block (on the other player\'s client too)', async () => {
      await put(B, 'Bedlam'); await put(A, 'Fyndhorn Elves'); await after();
      const r = await A.evaluate(() => { const b = S.bf.find(x => cname(x) === 'Fyndhorn Elves'); const [pid, st] = [...OPP][0]; const a = st.bf.find(x => info(x.k)?.n === 'Llanowar Elves'); return canBlock(b, a, pid); });
      check(/Bedlam/.test(r || ''), 'Georges\'s Fyndhorn Elves can\'t block while Kim controls Bedlam');
      await toGy(B, 'Bedlam'); await after();
      const r2 = await A.evaluate(() => { const b = S.bf.find(x => cname(x) === 'Fyndhorn Elves'); const [pid, st] = [...OPP][0]; const a = st.bf.find(x => info(x.k)?.n === 'Llanowar Elves'); return canBlock(b, a, pid); });
      check(!/Bedlam/.test(r2 || ''), 'blocking is possible again once Bedlam is gone');
    });
    await step('Darksteel Angel: no -1/-1 counters on Georges\'s creatures', async () => {
      await put(A, 'Darksteel Angel');
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Fyndhorn Elves'); modCounters(c, 'cm', 2); return c.cm || 0; });
      check(r === 0, 'the Elves got no -1/-1 counters');
      await toGy(A, 'Darksteel Angel');
    });
    await step('Sleep: all of Kim\'s creatures tap and stay tapped through her next untap step', async () => {
      await A.evaluate(() => { window.__tgt = 'Kim'; }); await toHand(A, 'Sleep');
      check(await cast(A, 'Sleep') === 'ok', 'Georges cast Sleep targeting Kim'); await after();
      const r = await B.evaluate(() => S.bf.filter(c => isCreatureCard(c)).map(c => [cname(c), !!c.tap, c.skipUntap || 0]));
      console.log('    Kim', JSON.stringify(r));
      check(r.length >= 2 && r.every(x => x[1] && x[2] === 1), 'every creature Kim controls is tapped and marked to skip her next untap');
      await B.evaluate(() => { S.bf.forEach(c => { c.tap = false; c.skipUntap = 0; }); commit(); });
    });
    await step('Kalitas: Kim\'s creature that dies is exiled and Georges gets a 2/2 Zombie', async () => {
      await put(A, 'Kalitas, Traitor of Ghet'); await after();
      const z0 = await A.evaluate(() => S.bf.filter(c => /Zombie/.test(typeOf(c))).reduce((a, c) => a + (c.n || 1), 0));
      await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Llanowar Elves'); destroyCard(c, 'test'); commit(); }); await after();
      const b = await B.evaluate(() => ({gy:S.gy.map(cname), ex:S.ex.map(cname)}));
      check(b.ex.includes('Llanowar Elves') && !b.gy.includes('Llanowar Elves'), 'Kim\'s Llanowar Elves was exiled instead of dying to the graveyard');
      const z1 = await A.evaluate(() => S.bf.filter(c => /Zombie/.test(typeOf(c))).reduce((a, c) => a + (c.n || 1), 0));
      check(z1 === z0 + 1, `Georges got a Zombie token (${z0} → ${z1})`);
      await toGy(A, 'Kalitas, Traitor of Ghet');
    });
    await step('Dire Fleet Ravager: each player loses a third of their life, rounded up', async () => {
      const la = await life(A), lb = await life(B);
      await put(A, 'Dire Fleet Ravager'); await after();
      check(la - await life(A) === Math.ceil(la / 3), `Georges ${la} → ${await life(A)}`);
      check(lb - await life(B) === Math.ceil(lb / 3), `Kim ${lb} → ${await life(B)} (on her own client)`);
    });
    await step('Hunted Bonebrute: target opponent creates two 1/1 Dogs', async () => {
      await A.evaluate(() => { window.__tgt = 'Kim'; }); const n0 = (await bfNames(B)).filter(x => /Dog/.test(x)).length;
      await put(A, 'Hunted Bonebrute'); await after();
      const n1 = await B.evaluate(() => S.bf.filter(c => /Dog/.test(cname(c))).reduce((a, c) => a + (c.n || 1), 0));
      check(n1 - n0 === 2, `Kim has ${n1} Dog tokens`);
    });
    await step('Kibo, Uktabi Prince: each player creates a Banana with its mana ability', async () => {
      await put(A, 'Kibo, Uktabi Prince');
      check(await activate(A, 'Kibo, Uktabi Prince', 'Banana') === 'ok', 'activated Kibo'); await after();
      const a = await A.evaluate(() => S.bf.filter(c => cname(c) === 'Banana').map(c => info(c.k)?.o));
      const b = await B.evaluate(() => S.bf.filter(c => cname(c) === 'Banana').map(c => info(c.k)?.o));
      console.log('    ', JSON.stringify(a), JSON.stringify(b));
      check(a.length === 1 && b.length === 1, 'both players have a Banana');
      check(/Sacrifice this token: Add \{R\} or \{G\}/.test(b[0] || ''), 'Kim\'s Banana has "{T}, Sacrifice this token: Add {R} or {G}. You gain 2 life."');
      const mana = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Banana'); return manaAbs(c).length; });
      check(mana > 0, 'the Banana\'s mana ability is usable');
    });
    await step('Rendmaw, Creaking Nest: each player gets a tapped 2/2 Bird, goaded for the rest of the game', async () => {
      await put(A, 'Rendmaw, Creaking Nest'); await after();
      const pa = await A.evaluate(() => MYPID);
      const b = await B.evaluate(() => S.bf.filter(c => /Bird/.test(typeOf(c)) && c.tok).map(c => ({tap:!!c.tap, by:c.goad && c.goad.by, n:c.goad && c.goad.n})));
      console.log('    Kim birds', JSON.stringify(b));
      check(b.length >= 1 && b[0].tap && b[0].by === pa && b[0].n >= 1e6, 'Kim\'s Bird is tapped and goaded by Georges permanently');
      const a = await A.evaluate(() => S.bf.filter(c => /Bird/.test(typeOf(c)) && c.tok).length);
      check(a >= 1, 'Georges got a Bird too');
    });
    await step('Through the Forest Gate: lands from the top twenty onto the battlefield tapped, gain 8', async () => {
      const l0 = await A.evaluate(() => S.bf.filter(c => isLand(c.k)).length); const la = await life(A);
      await A.evaluate(() => { const ls = S.lib.filter(c => isLand(c.k)).slice(0, 2); ls.forEach(c => { S.lib.splice(S.lib.indexOf(c), 1); S.lib.splice(5, 0, c); }); commit(); }); await toHand(A, 'Through the Forest Gate'); check(await cast(A, 'Through the Forest Gate') === 'ok', 'cast'); await after(); await waitFor(A, () => S.gy.some(c => cname(c) === 'Through the Forest Gate') && !UI.modal, null, 15000); await settle([A, B]);
      const l1 = await A.evaluate(() => S.bf.filter(c => isLand(c.k)).map(c => !!c.tap));
      check(l1.length > l0 && l1.slice(l0).every(Boolean), `put ${l1.length - l0} land(s) onto the battlefield tapped`);
      check(await life(A) - la === 8, 'gained 8 life');
    });
    await step('Space-Time Anomaly: Kim mills cards equal to Georges\'s life total', async () => {
      await A.evaluate(() => { window.__tgt = 'Kim'; }); const la = await life(A); const lib0 = await B.evaluate(() => S.lib.length);
      await toHand(A, 'Space-Time Anomaly'); check(await cast(A, 'Space-Time Anomaly') === 'ok', 'cast'); await after();
      const lib1 = await B.evaluate(() => S.lib.length);
      check(lib0 - lib1 === Math.min(la, lib0), `Kim milled ${lib0 - lib1} (Georges has ${la} life)`);
    });
    await step('Imposing Grandeur: each player may discard their hand and draw their commander\'s mana value', async () => {
      await toHand(A, 'Imposing Grandeur'); check(await cast(A, 'Imposing Grandeur') === 'ok', 'cast'); await after(); await sleep(1500);
      const ha = await A.evaluate(() => S.hand.length), hb = await B.evaluate(() => S.hand.length);
      check(ha === 6, `Georges drew 6 for Edgar Markov (${ha})`);
      check(hb === 2, `Kim drew 2 for Thalia, on her own screen (${hb})`);
    });
    await step('Cone of Cold: roll a d20, all of Kim\'s creatures tap', async () => {
      await B.evaluate(() => { S.bf.forEach(c => { c.tap = false; }); commit(); }); await after();
      await toHand(A, 'Cone of Cold'); check(await cast(A, 'Cone of Cold') === 'ok', 'cast'); await after();
      const r = await B.evaluate(() => S.bf.filter(c => isCreatureCard(c)).map(c => !!c.tap));
      const roll = await A.evaluate(() => (S.log.map(e => e.s).reverse().find(s => /rolled a/.test(s)) || ''));
      console.log('    ', roll, JSON.stringify(r));
      check(r.length > 0 && r.every(Boolean), 'every creature Kim controls is tapped');
    });
    await step('Benevolent Offering: both players create three Spirits, then gain 2 life per creature', async () => {
      const sa = await A.evaluate(() => S.bf.filter(c => /Spirit/.test(typeOf(c))).reduce((a, c) => a + (c.n || 1), 0)), sb = await B.evaluate(() => S.bf.filter(c => /Spirit/.test(typeOf(c))).reduce((a, c) => a + (c.n || 1), 0));
      const la = await life(A), lb = await life(B);
      await toHand(A, 'Benevolent Offering'); check(await cast(A, 'Benevolent Offering') === 'ok', 'cast'); await after();
      const sa1 = await A.evaluate(() => S.bf.filter(c => /Spirit/.test(typeOf(c))).reduce((a, c) => a + (c.n || 1), 0)), sb1 = await B.evaluate(() => S.bf.filter(c => /Spirit/.test(typeOf(c))).reduce((a, c) => a + (c.n || 1), 0));
      check(sa1 - sa === 3 && sb1 - sb === 3, `three Spirits each (Georges +${sa1 - sa}, Kim +${sb1 - sb})`);
      const ca = await A.evaluate(() => S.bf.filter(c => isCreatureCard(c)).reduce((a, c) => a + (c.n || 1), 0)), cb = await B.evaluate(() => S.bf.filter(c => isCreatureCard(c)).reduce((a, c) => a + (c.n || 1), 0));
      check(await life(A) - la === 2 * ca, `Georges gained ${await life(A) - la} = 2 × ${ca} creatures`);
      check(await life(B) - lb === 2 * cb, `Kim gained ${await life(B) - lb} = 2 × ${cb} creatures`);
    });
    await step('Memory Jar: each player exiles their hand face down and draws seven', async () => {
      await put(A, 'Memory Jar'); const ha = await A.evaluate(() => S.hand.length), hb = await B.evaluate(() => S.hand.length);
      check(await activate(A, 'Memory Jar', 'seven') === 'ok', 'activated Memory Jar'); await after();
      const a = await A.evaluate(() => ({h:S.hand.length, j:(S.r23kJar || []).length})), b = await B.evaluate(() => ({h:S.hand.length, j:(S.r23kJar || []).length}));
      check(a.h === 7 && a.j === ha, `Georges: 7 cards, ${a.j} set aside`);
      check(b.h === 7 && b.j === hb, `Kim: 7 cards, ${b.j} set aside on her own client`);
    });
    await step('Grief: Kim reveals her hand, Georges picks a nonland card, Kim discards it', async () => {
      await A.evaluate(() => { window.__tgt = 'Kim'; }); const g0 = await B.evaluate(() => S.gy.length);
      await B.evaluate(() => { if (!S.hand.some(c => !isLand(c.k))){ const i = S.lib.findIndex(c => !isLand(c.k)); if (i >= 0) S.hand.push(S.lib.splice(i, 1)[0]); } commit(); });
      await put(A, 'Grief'); await after(); await sleep(1500); await settle([A, B]);
      const g = await B.evaluate(() => S.gy.slice(-1).map(c => [cname(c), isLand(c.k)])[0]);
      check(await B.evaluate(() => S.gy.length) === g0 + 1 && g && !g[1], `Kim discarded a nonland card (${g && g[0]})`);
    });
    await step('Progenitus: goes into the library instead of the graveyard', async () => {
      await put(A, 'Progenitus');
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Progenitus'); moveCard(c.id, 'gy'); return {gy:S.gy.some(x => cname(x) === 'Progenitus'), lib:S.lib.some(x => cname(x) === 'Progenitus')}; });
      check(!r.gy && r.lib, 'Progenitus was shuffled into the library');
    });
    await step('Werebear: +3/+3 with seven or more cards in the graveyard', async () => {
      await put(A, 'Werebear');
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Werebear'); S.lib.push(...S.gy.splice(0)); const s0 = stats(c).join('/'); while (S.gy.length < 7 && S.lib.length) S.gy.push(S.lib.shift()); return [s0, stats(c).join('/')]; });
      check(r[0] === '1/1' && r[1] === '4/4', `Werebear ${r[0]} → ${r[1]}`);
    });
    await step('Pitiless Carnage: sacrifice any number of permanents, draw that many', async () => {
      await A.evaluate(() => { window.__want = 'Banana'; }); const h0 = await A.evaluate(() => S.hand.length);
      await toHand(A, 'Pitiless Carnage'); check(await cast(A, 'Pitiless Carnage') === 'ok', 'cast'); await after();
      const r = await A.evaluate(() => ({h:S.hand.length, ban:S.bf.some(c => cname(c) === 'Banana')}));
      check(!r.ban && r.h === h0 + 1, `sacrificed the Banana and drew 1 (hand ${h0} → ${r.h})`);
      await A.evaluate(() => { window.__want = null; });
    });
    await step('Scalelord Reckoner: Georges targets Kim\'s Dragon, Kim\'s client destroys a permanent Georges controls', async () => {
      await put(B, 'Scalelord Reckoner'); await after();
      await B.evaluate(() => { window.__tgt = 'Werebear'; });
      await A.evaluate(() => { window.__tgt = 'Scalelord'; }); await toHand(A, 'Lightning Bolt');
      check(await cast(A, 'Lightning Bolt') === 'ok', 'Georges cast Lightning Bolt at Scalelord Reckoner'); await after(); await sleep(1500); await settle([A, B]);
      const r = await A.evaluate(() => ({bf:S.bf.some(c => cname(c) === 'Werebear'), gy:S.gy.some(c => cname(c) === 'Werebear')}));
      check(!r.bf && r.gy, 'Kim\'s trigger destroyed Georges\'s Werebear');
      await A.evaluate(() => { window.__tgt = null; }); await B.evaluate(() => { window.__tgt = null; });
    });
    await step('Gift of Paradise: the enchanted land taps for two mana of one color', async () => {
      await put(A, 'Gift of Paradise');
      const r = await A.evaluate(() => { const land = S.bf.find(c => isLand(c.k)); const g = S.bf.find(c => cname(c) === 'Gift of Paradise'); g.att = {pid:MYPID, id:land.id}; commit(); return manaAbs(land).filter(a => /two mana/.test(a.eff)).map(a => a.outs.map(o => o.join('')).join(',')); });
      check(r.length === 1 && /GG/.test(r[0]) && /WW/.test(r[0]), `granted ability: ${r[0]}`);
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
