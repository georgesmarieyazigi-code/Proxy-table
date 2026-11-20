process.env.TOP = '';
const CC = require('./cards');
const WANT = ['Grand Arbiter Augustin IV', 'Rule of Law', 'Torpor Orb', 'Static Orb', 'Thalia, Guardian of Thraben', 'Opt', 'Solemn Simulacrum', 'Sol Ring', 'Island', 'Lavinia, Azorius Renegade', 'Silence', 'Knowledge Pool', 'Ghostly Prison', 'Grizzly Bears'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name)));
// cards whose current Oracle text is only in extra.json
{ const raw = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'extra.json'), 'utf8')).filter(r => ['Spelltithe Enforcer', 'Strict Proctor'].includes(r.n));
  CC.cards.push(...raw.map((r, i) => { const [p, t] = (r.p || '').split('/'); return {object:'card', id:'x21d-' + i, name:r.n, keywords:[], set:'x', collector_number:String(9100 + i), set_name:'X', released_at:'2025-01-01', prices:{usd:'1'}, image_uris:{normal:''}, mana_cost:r.m, cmc:3, type_line:r.t, oracle_text:r.o, layout:'normal', colors:['W'], color_identity:['W'], power:p, toughness:t}; })); }
// Round 21D: stax pieces controlled by Georges are enforced on Kim's own client
const H = require('./h'); const {check, sleep, put, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { setInterval(() => { const m = UI.modal; if (!m || m.__done) return;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const n = Math.max(m.min || 0, Math.min(m.max || 0, (m.min || 0) || (m.max ? 1 : 0))); m.__done = 1; m.resolve(pool.slice(0, n).map(c => c.id)); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); m.__done = 1; m.resolve(o[0] ? o[0].value : null); closeModal(); }
    else if (m.run){ m.__done = 1; m.run(m.def ?? 1); closeModal(); }
    else if (m.type === 'zone'){ m.__done = 1; closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (P, ps) => { for (let i = 0; i < 30; i++){ await passAll(ps); if (!(await P.evaluate(() => stackAll().length || UI.resolving))) return; await sleep(150); } };
let PB = null; const step = async (name, fn) => { console.log('— ' + name); const f0 = H.fails(); try { await fn(); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); } if (H.fails() > f0 && PB) console.log('    KIM LOG:', (await PB.evaluate(() => S.log.slice(-12).map(e => e.s).join(' | ')))); };
const toMain = async (P, ps) => { for (let i = 0; i < 25; i++){ if (await P.evaluate(() => phaseNow().mine && phaseNow().ph === 3 && !stackAll().length)) return true; await P.evaluate(() => { if (!stackAll().length) nextAction(); }); await passAll(ps); } return false; };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Grand Arbiter Augustin IV'), 'host', 'r2d');
  const B = await H.player(browser, 'Kim', H.deckFor('Krenko, Mob Boss'), 'join', 'r2d');
  PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle(A, [B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  try {
    await step('Georges puts out Grand Arbiter, Rule of Law, Torpor Orb, Static Orb and Thalia', async () => {
      await A.evaluate(() => { const c = S.cz.find(c => cname(c) === 'Grand Arbiter Augustin IV'); S.cz.splice(S.cz.indexOf(c), 1); S.hand.push(c); moveCard(c.id, 'bf', {quiet:true}); commit(); });
      for (const n of ['Rule of Law', 'Torpor Orb', 'Static Orb', 'Thalia, Guardian of Thraben']) await put(A, n);
      check(await waitFor(B, () => { const s = [...OPP.values()][0]; return s && ['Grand Arbiter Augustin IV', 'Rule of Law', 'Torpor Orb', 'Static Orb', 'Thalia, Guardian of Thraben'].every(n => (s.bf || []).some(b => info(b.k)?.n === n)); }, null, 8000), "Kim's client sees all five stax pieces");
      // Kim's board: four Islands and a Sol Ring, all tapped
      await B.evaluate(() => { for (let i = 0; i < 4; i++){ const c = S.lib.find(x => cname(x) === 'Island'); if (c) moveCard(c.id, 'bf', {quiet:true}); } const r = S.lib.find(x => cname(x) === 'Sol Ring'); if (r) moveCard(r.id, 'bf', {quiet:true}); S.bf.forEach(c => { c.tap = true; }); commit(); });
      check(await B.evaluate(() => S.bf.filter(c => c.tap).length === 5), 'Kim has 5 tapped permanents');
    });
    await step('Static Orb: Kim untaps only two permanents in her untap step', async () => {
      await A.evaluate(() => passTurn());
      await waitFor(B, () => currentTurn()[1] === MYPID && S.untapN === currentTurn()[0], null, 10000);
      await sleep(1500);
      const r = await B.evaluate(() => [S.bf.filter(c => !c.tap).map(cname), S.bf.filter(c => c.tap).length, S.log.slice(-8).map(e => e.s)]);
      console.log('    untapped:', JSON.stringify(r[0]), 'still tapped:', r[1]);
      check(r[0].length === 2 && r[1] === 3, `exactly two permanents untapped (${r[0].length}), three stay tapped (${r[1]})`);
      check(r[2].some(s => /Static Orb/.test(s)), 'the log names Static Orb');
    });
    await step('Grand Arbiter + Thalia tax Kim\'s noncreature spell: Opt costs {2}{U}', async () => {
      check(await toMain(B, [A]), 'Kim reaches her main phase');
      await B.evaluate(() => { const c = S.lib.find(x => cname(x) === 'Opt'); if (c){ S.lib.splice(S.lib.indexOf(c), 1); S.hand.push(c); } const s = S.lib.find(x => cname(x) === 'Solemn Simulacrum'); if (s){ S.lib.splice(S.lib.indexOf(s), 1); S.hand.push(s); } S.pool = {...emptyPool(), U:1, C:1}; commit(); });
      const r1 = await B.evaluate(() => { S.bf.forEach(b => { if (manaAbs(b).length) b.tap = true; }); const c = S.hand.find(x => cname(x) === 'Opt'); const sc = spellCost(c, 'hand'); return [costStr(sc.cost), sc.notes, castCheck(c, 'hand')]; });
      console.log('    Opt on Kim\'s client:', JSON.stringify(r1));
      check(r1[0] === '{2}{U}' && r1[1].some(n => /Grand Arbiter/.test(n)) && r1[1].some(n => /Thalia/.test(n)), 'Opt costs {2}{U} with both taxes listed');
      check(!r1[2].ok, 'with only {U}{1} in the pool Kim cannot cast it');
      await B.evaluate(() => { S.pool = {...emptyPool(), U:1, C:2}; commit(); beginCast(S.hand.find(x => cname(x) === 'Opt'), 'hand'); });
      check(await waitFor(B, () => stackAll().some(i => i.nm === 'Opt')), 'with {2}{U} Opt is cast');
      check(await B.evaluate(() => poolTotal(S.pool) === 0), 'all three mana were spent');
      await settle(B, [A, B]);
      check(await waitFor(B, () => S.gy.some(c => cname(c) === 'Opt'), null, 8000), 'Opt resolved');
    });
    await step('Rule of Law: Kim cannot cast a second spell this turn', async () => {
      await B.evaluate(() => { S.pool = {...emptyPool(), C:9}; commit(); });
      const r = await B.evaluate(() => castCheck(S.hand.find(x => cname(x) === 'Solemn Simulacrum'), 'hand'));
      console.log('    castCheck:', JSON.stringify(r));
      check(!r.ok && /Rule of Law/.test(r.why), 'the cast button is disabled because of Rule of Law');
      await B.evaluate(() => beginCast(S.hand.find(x => cname(x) === 'Solemn Simulacrum'), 'hand'));
      await sleep(600);
      const r2 = await B.evaluate(() => [stackAll().length, S.hand.some(c => cname(c) === 'Solemn Simulacrum'), S.pool.C]);
      check(r2[0] === 0 && r2[1] && r2[2] === 9, 'casting it anyway (drag / direct) is refused: still in hand, no mana spent');
    });
    await step('Next Kim turn: Solemn Simulacrum enters, Torpor Orb stops its ETB trigger', async () => {
      await B.evaluate(() => passTurn());
      await waitFor(A, () => currentTurn()[1] === MYPID, null, 10000); await sleep(800);
      await settle(A, [A, B]);
      await A.evaluate(() => passTurn());
      await waitFor(B, () => currentTurn()[1] === MYPID && S.untapN === currentTurn()[0], null, 10000); await sleep(1500);
      check(await toMain(B, [A]), 'Kim reaches her main phase again');
      const r0 = await B.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Solemn Simulacrum'); const sc = spellCost(c, 'hand'); return [costStr(sc.cost), sc.notes]; });
      check(r0[0] === '{5}' && r0[1].length === 1, `creature spell: only Grand Arbiter taxes it, Thalia doesn't (${r0[0]} ${JSON.stringify(r0[1])})`);
      const lib0 = await B.evaluate(() => S.lib.length);
      await B.evaluate(() => { S.pool = {...emptyPool(), C:5}; commit(); beginCast(S.hand.find(x => cname(x) === 'Solemn Simulacrum'), 'hand'); });
      check(await waitFor(B, () => stackAll().some(i => i.nm === 'Solemn Simulacrum')), 'Solemn Simulacrum is cast');
      await settle(B, [A, B]); await sleep(800); await settle(B, [A, B]);
      const r = await B.evaluate(() => [S.bf.some(c => cname(c) === 'Solemn Simulacrum'), S.stk.map(i => i.nm), S.log.slice(-10).map(e => e.s), S.lib.length]);
      console.log('    stack:', JSON.stringify(r[1]));
      check(r[0], 'Solemn Simulacrum is on the battlefield');
      check(!r[1].length && r[3] === lib0, 'no enter trigger went on the stack and no land was searched for');
      check(r[2].some(s => /doesn't trigger \(Torpor Orb\)/.test(s)), 'the log says Torpor Orb stopped the trigger');
    });

    const clearA = async () => { await A.evaluate(() => { S.bf.filter(c => !isLand(c.k)).forEach(c => { if (c.cmd){ S.bf.splice(S.bf.indexOf(c), 1); S.cz.push(c); } else moveCard(c.id, 'lib', {quiet:true}); }); S.stk = []; commit(); }); await sleep(800); };
    const kimHand = n => B.evaluate(n => { const c = S.lib.find(x => cname(x) === n) || S.gy.find(x => cname(x) === n) || S.ex.find(x => cname(x) === n); if (c){ const z = find(c.id)[0]; S[z].splice(S[z].indexOf(c), 1); delete c.r21kp; S.hand.push(c); commit(); } return !!S.hand.find(x => cname(x) === n); }, n);
    await step('Spelltithe Enforcer: Kim casts a spell, has no mana for {1}, sacrifices a permanent on her own client', async () => {
      await clearA(); await put(A, 'Spelltithe Enforcer'); await waitFor(B, () => [...OPP.values()][0].bf.some(b => info(b.k)?.n === 'Spelltithe Enforcer'), null, 6000);
      await kimHand('Opt'); const n0 = await B.evaluate(() => S.bf.length);
      await B.evaluate(() => { S.pool = {...emptyPool(), U:1}; commit(); beginCast(S.hand.find(x => cname(x) === 'Opt'), 'hand'); });
      await settle(B, [A, B]); await settle(A, [A, B]);
      check(await waitFor(B, () => S.prm.some(p => p.type === 'sac' && /Spelltithe/.test(p.src || '')), null, 10000), "a 'sacrifice a permanent' choice for Spelltithe Enforcer appears on Kim's client");
      await B.evaluate(() => choosePrompt(S.prm.find(p => p.type === 'sac'))); await sleep(800);
      check(await B.evaluate(n => S.bf.length === n - 1, n0), 'Kim sacrificed one permanent');
    });
    await step('Strict Proctor: Kim\'s enter trigger is countered unless she pays {2}', async () => {
      await clearA(); await put(A, 'Strict Proctor'); await waitFor(B, () => [...OPP.values()][0].bf.some(b => info(b.k)?.n === 'Strict Proctor'), null, 6000);
      await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Solemn Simulacrum'); if (c) moveCard(c.id, 'lib', {quiet:true}); commit(); });
      await kimHand('Solemn Simulacrum');
      await B.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Solemn Simulacrum'); moveCard(c.id, 'bf'); });
      check(await waitFor(B, () => S.prm.some(p => p.type === 'unless' && p.n === 2) && S.stk.some(i => i.nm === 'Solemn Simulacrum' && i.hold), null, 6000), 'the Solemn trigger is held with a “pay {2}” prompt on Kim\'s client');
      await B.evaluate(() => { S.pool = {...emptyPool(), C:2}; resolvePrompt(S.prm.find(p => p.type === 'unless'), true); });
      check(await B.evaluate(() => poolTotal(S.pool) === 0 && S.stk.some(i => i.nm === 'Solemn Simulacrum' && !i.hold)), 'paying {2} keeps the trigger');
      await settle(B, [A, B]);
    });
    await step('Lavinia: a spell Kim casts without spending mana is countered', async () => {
      await clearA(); await put(A, 'Lavinia, Azorius Renegade'); await waitFor(B, () => [...OPP.values()][0].bf.some(b => info(b.k)?.n === 'Lavinia, Azorius Renegade'), null, 6000);
      await kimHand('Opt');
      await B.evaluate(() => { S.pool = emptyPool(); commit(); beginCast(S.hand.find(x => cname(x) === 'Opt'), 'hand', {free:true}); });
      await settle(B, [A, B]); await settle(A, [A, B]); await settle(B, [A, B]);
      check(await waitFor(B, () => S.log.some(e => /Opt was countered/.test(e.s)), null, 10000), 'Opt was countered by Lavinia on Kim\'s client');
    });
    await step('Silence: Kim can\'t cast spells for the rest of the turn', async () => {
      await clearA(); await A.evaluate(() => { const c = S.lib.find(x => cname(x) === 'Silence'); S.lib.splice(S.lib.indexOf(c), 1); S.hand.push(c); S.pool = {...emptyPool(), W:1}; commit(); beginCast(c, 'hand'); });
      await settle(A, [A, B]);
      check(await waitFor(B, () => (S.r21ban || []).some(b => b.t === turnStr()), null, 8000), 'Kim received the Silence restriction');
      await kimHand('Opt'); await B.evaluate(() => { S.pool = {...emptyPool(), U:3}; commit(); });
      const r = await B.evaluate(() => castCheck(S.hand.find(x => cname(x) === 'Opt'), 'hand'));
      check(!r.ok && /Silence/.test(r.why), 'Opt is not castable: ' + r.why);
    });
    await step('Ghostly Prison: Georges must pay {2} per creature attacking Kim', async () => {
      await clearA(); await put(B, 'Ghostly Prison');
      await B.evaluate(() => passTurn()); await waitFor(A, () => currentTurn()[1] === MYPID && S.untapN === currentTurn()[0], null, 10000); await sleep(800);
      await toMain(A, [B]); await put(A, 'Grizzly Bears');
      const r = await A.evaluate(() => { setPhase(4); return new Promise(res => setTimeout(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); c.sk = false; S.cb = S.cb || {}; S.cb.step = 'atk'; UI.atkSel = {[c.id]:'p:' + opponents()[0].pid}; S.pool = emptyPool(); declareAttackers(); res([c.tap, S.log.slice(-3).map(e => e.s)]); }, 300)); });
      check(!r[0], 'without {2} the Bears cannot attack Kim');
      const r2 = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); S.pool = {...emptyPool(), C:2}; UI.atkSel = {[c.id]:'p:' + opponents()[0].pid}; declareAttackers(); return [c.tap, poolTotal(S.pool)]; });
      check(r2[0] && r2[1] === 0, 'with {2} paid the Bears attack');
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); H.aedes.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
