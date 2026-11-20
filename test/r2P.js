process.env.TOP = '1';
// Round 24P: replacement / prevention effects and combat requirements in a real 2-player game (each player's part on their own client)
const CC = require('./cards');
const WANT = ['Pariah', 'Llanowar Elves', 'Fyndhorn Elves', 'Wall of Omens', 'Elvish Mystic', 'Lightning Bolt', 'Selfless Squire', 'Comeuppance', 'Vigor', 'Phyrexian Vindicator', 'Wolverine, Best There Is',
  'Everlasting Torment', 'The Mindskinner', 'Mechanized Warfare', 'Fall of Cair Andros', 'Vnwxt, Verbose Host', 'Alms Collector', 'Underrealm Lich', 'Phial of Galadriel', 'Queen Allenal of Ruadach',
  'Stridehangar Automaton', 'The Darkness Crystal', 'The Water Crystal', 'Whip of Erebos', 'Lure', 'Goblin Rabblemaster', 'Ensnaring Bridge', 'Sphinx of the Second Sun', 'Birds of Paradise',
  'Doran, the Siege Tower', 'Collective Restraint', 'Anti-Venom, Horrifying Healer', 'Shock', 'Mogg War Marshal', 'Skirk Prospector', 'Edgar Markov', 'Thalia, Guardian of Thraben', 'Anzrag, the Quake-Mole',
  'Ancient Adamantoise', 'Rith, Liberated Primeval'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, waitFor} = H;
const put = (p, n) => p.evaluate(n => { for (const z of ['lib','hand','gy','ex']){ const c = S[z].find(c => cname(c) === n); if (c){ if (z === 'ex'){ S.ex.splice(S.ex.indexOf(c), 1); reset(c); S.hand.push(c); } moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id); if (b){ b.sk = false; delete b.p24exLeave; } commit(); return true; } } return false; }, n);
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { window.__want = window.__want || null; window.__tgt = window.__tgt || null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ if (!window.__tgt) return; const re = new RegExp(window.__tgt, 'i'); const c = (m.cands || []).find(x => x.ok && re.test(x.nm)); if (!c) return; m.__done = 1; m.resolve([c]); closeModal(); }
    else if (m.type === 'split' && m.resolve){ m.__done = 1; m.onClose = null; const plan = m.plan; closeModal(); m.resolve(plan); }
    else if (m.run){ m.__done = 1; const d = m.def ?? 1; m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const toHand = (p, n) => p.evaluate(n => { for (const z of ['lib', 'gy', 'ex', 'bf']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.hand.push(c); commit(); return c.id; } } return S.hand.find(c => cname(c) === n)?.id; }, n);
const cast = (p, n) => p.evaluate(async n => { const c = S.hand.find(x => cname(x) === n); if (!c) return 'not in hand'; S.pool = {...emptyPool(), W:6, U:6, B:6, R:6, G:6, C:6}; commit(); await beginCast(c, 'hand'); return S.hand.includes(c) ? 'not cast' : 'ok'; }, n);
const off = (p, n) => p.evaluate(n => { const c = S.bf.find(x => cname(x) === n); if (c){ S.bf.splice(S.bf.indexOf(c), 1); reset(c); S.lib.push(c); commit(); return true; } return false; }, n);
const activate = (p, n, re) => p.evaluate(async ([n, re]) => { const c = S.bf.find(x => cname(x) === n); if (!c) return 'missing'; c.sk = false; c.tap = false; S.pool = {...emptyPool(), W:6, U:6, B:6, R:6, G:6, C:6}; const ab = abilityList(c).find(a => new RegExp(re, 'i').test(a.eff)); if (!ab) return 'no ability'; await activateAbility(c, ab); return 'ok'; }, [n, re]);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), 90000))]); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2p');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2p');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const life = p => p.evaluate(() => S.life);
  const after = async () => { await sleep(500); await settle([A, B]); await sleep(1200); await settle([A, B]); await sleep(500); };
  const bolt = async (p, tgt, card = 'Lightning Bolt') => { await p.evaluate(t => { window.__tgt = t; }, tgt); await toHand(p, card); const r = await cast(p, card); await after(); await p.evaluate(() => { window.__tgt = null; }); return r; };
  const zone = (p, n) => p.evaluate(n => { for (const z of ['bf', 'gy', 'ex', 'hand', 'lib']) if (S[z].some(c => cname(c) === n)) return z; return ''; }, n);
  const clean = async (p) => { await p.evaluate(() => { S.bf.filter(c => !isLand(c.k)).forEach(c => { S.bf.splice(S.bf.indexOf(c), 1); if (!c.tok){ reset(c); S.lib.push(c); } }); S.stk = []; commit(); }); await sleep(300); };
  // drive a real combat: Georges attacks Kim with the named creatures, Kim confirms blocks (sel = {blocker: attacker})
  const combat = async (atk, sel = {}, opt = {}) => {
    await A.evaluate(() => { if (phaseNow().ph !== 3) setPhase(3); if (S.cb) S.cb.step = 'end'; S.bf.forEach(c => { c.atk = ''; c.tap = isLand(c.k) ? c.tap : false; c.sk = false; }); commit(); }); await sleep(400);
    await A.click('#phasebar [data-act="next"]').catch(() => {}); await waitFor(A, () => phaseNow().ph === 4, null, 8000); await passAll([B]);
    if (!(await A.evaluate(() => S.cb && S.cb.step === 'atk'))) await A.evaluate(() => nextAction());
    await waitFor(A, () => S.cb && S.cb.step === 'atk', null, 8000);
    const pre = await A.evaluate(() => Object.entries(UI.atkSel).filter(([, v]) => v).map(([id]) => cname(S.bf.find(c => c.id === +id))));
    if (opt.onAtk){ const r = await opt.onAtk(pre); if (r === 'stop') return {pre}; }
    await A.evaluate((names) => { UI.atkSel = {}; S.bf.filter(c => names.includes(cname(c))).forEach(c => { UI.atkSel[c.id] = 'p:' + opponents()[0].pid; }); renderCombatPanel(); }, atk);
    await A.evaluate(() => declareAttackers()); await passAll([B]);
    await waitFor(B, () => !!document.querySelector('#cbpanel [data-act="blkGo"]'), null, 8000);
    await B.evaluate(sel => { const pn = phaseNow(); const atts = attackersOnMe(pn); UI.blkSel = {}; for (const [b, a] of Object.entries(sel)){ const bc = S.bf.find(c => cname(c) === b); const ac = atts.find(x => info(x.k)?.n === a); if (bc && ac) UI.blkSel[bc.id] = ac.id; } renderCombatPanel(); }, sel);
    await B.evaluate(() => confirmBlocks(false)); await sleep(200);
    const forced = await B.evaluate(() => { const pn = phaseNow(); const atts = attackersOnMe(pn); return Object.entries(UI.blkSel).filter(([, v]) => v !== '' && v != null).map(([id, a]) => [cname(S.bf.find(c => c.id === +id)), info((atts.find(x => x.id === +a) || {}).k)?.n]); });
    const done = await B.evaluate(() => { const pn = phaseNow(); const cb = cbOf(pn); return (S.bd || '') === cbKey(pn, cb); });
    if (!done) await B.evaluate(() => confirmBlocks(false));
    for (let i = 0; i < 12; i++){ await passAll([A, B]); if (await A.evaluate(() => phaseNow().ph === 5)) break; }
    await sleep(1200); await passAll([A, B]); await sleep(600);
    return {pre, forced, firstTry:done};
  };
  try {
    await step('Pariah: Kim bolts Georges — the 3 damage is dealt to the enchanted Llanowar Elves instead', async () => {
      await put(A, 'Llanowar Elves'); await put(A, 'Pariah'); await A.evaluate(() => { const e = S.bf.find(c => cname(c) === 'Llanowar Elves'); const p = S.bf.find(c => cname(c) === 'Pariah'); p.att = {pid:MYPID, id:e.id}; commit(); }); await after();
      const la = await life(A); check(await bolt(B, 'Georges') === 'ok', 'Kim cast Lightning Bolt at Georges');
      check(await life(A) === la, `Georges took no damage (${la} → ${await life(A)})`);
      check(await zone(A, 'Llanowar Elves') === 'gy', 'the enchanted Llanowar Elves took the damage and died');
      await clean(A);
    });
    await step('Comeuppance + Selfless Squire: the prevented bolt hits Kim, and the Squire grows', async () => {
      await put(A, 'Selfless Squire'); await toHand(A, 'Comeuppance'); check(await cast(A, 'Comeuppance') === 'ok', 'Georges cast Comeuppance'); await after();
      const la = await life(A), lb = await life(B);
      await bolt(B, 'Georges');
      check(await life(A) === la, `Georges took no damage (${la} → ${await life(A)})`);
      check(await life(B) === lb - 3, `Comeuppance dealt 3 to Kim, the controller of the noncreature source (${lb} → ${await life(B)})`);
      const cp = await A.evaluate(() => S.bf.find(c => cname(c) === 'Selfless Squire')?.cp || 0); check(cp === 3, `Selfless Squire got 3 +1/+1 counters (${cp})`);
      await A.evaluate(() => { S.p24comeup = null; commit(); }); await clean(A);
    });
    await step('Vigor and Anti-Venom: damage to them is prevented, +1/+1 counters instead', async () => {
      await A.evaluate(() => { window.__tgt = '.'; }); await put(A, 'Vigor'); await put(A, 'Fyndhorn Elves'); await put(A, 'Anti-Venom, Horrifying Healer'); await after(); await A.evaluate(() => { window.__tgt = null; });
      await bolt(B, 'Fyndhorn');
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Fyndhorn Elves'); return c ? c.cp || 0 : -1; }); check(r === 3, `Fyndhorn Elves survived with 3 +1/+1 counters (${r})`);
      await off(A, 'Vigor'); await after();
      const a0 = await A.evaluate(() => S.bf.find(x => /Anti-Venom/.test(cname(x)))?.cp || 0); await bolt(B, 'Anti-Venom');
      const a1 = await A.evaluate(() => S.bf.find(x => /Anti-Venom/.test(cname(x)))?.cp || 0); check(a1 === a0 + 3, `Anti-Venom got 3 +1/+1 counters instead of damage (${a0} → ${a1})`);
      await clean(A);
    });
    await step('Phyrexian Vindicator: the prevented damage is dealt to another target (Kim)', async () => {
      await put(A, 'Phyrexian Vindicator'); await after(); const lb = await life(B);
      await A.evaluate(() => { window.__tgt = 'Kim'; }); await bolt(B, 'Vindicator'); await after(); await A.evaluate(() => { window.__tgt = null; });
      check(await zone(A, 'Phyrexian Vindicator') === 'bf', 'Vindicator is still alive');
      check(await life(B) === lb - 3, `Vindicator dealt 3 to Kim (${lb} → ${await life(B)})`);
      await clean(A);
    });
    await step('Wolverine doubles its damage; Mechanized Warfare adds 1; The Mindskinner turns damage into milling', async () => {
      await put(A, 'Wolverine, Best There Is'); await after(); let lb = await life(B);
      await A.evaluate(() => { const w = S.bf.find(c => /Wolverine/.test(cname(c))); dealDamage({t:'player', pid:opponents()[0].pid}, 2, w.k, w); commit(); }); await after();
      check(await life(B) === lb - 4, `Wolverine's 2 damage became 4 (${lb} → ${await life(B)})`); await clean(A);
      await put(A, 'Mechanized Warfare'); await after(); lb = await life(B); await bolt(A, 'Kim');
      check(await life(B) === lb - 4, `Lightning Bolt (red) dealt 3 + 1 = 4 to Kim (${lb} → ${await life(B)})`); await clean(A);
      await put(A, 'The Mindskinner'); await after(); lb = await life(B); const l0 = await B.evaluate(() => S.lib.length); await bolt(A, 'Kim');
      const l1 = await B.evaluate(() => S.lib.length);
      check(await life(B) === lb, `Kim took no damage (${lb} → ${await life(B)})`); check(l0 - l1 === 3, `Kim milled 3 instead (${l0} → ${l1})`);
      await clean(A);
    });
    await step('Everlasting Torment: Georges\'s bolt gives Kim\'s Wall of Omens -1/-1 counters (wither) on her client', async () => {
      await put(B, 'Wall of Omens'); await put(A, 'Everlasting Torment'); await after();
      await bolt(A, 'Wall of Omens');
      const r = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Wall of Omens'); return c ? [c.cm || 0, c.dmg || 0] : null; });
      check(r && r[0] === 3 && r[1] === 0, `Wall of Omens has 3 -1/-1 counters and no damage (${JSON.stringify(r)})`);
      await clean(A); await clean(B);
    });
    await step('Excess damage: Fall of Cair Andros amasses 2 when Kim\'s 1/1 is bolted; Rith sees it', async () => {
      await put(A, 'Fall of Cair Andros'); await put(B, 'Llanowar Elves'); await after();
      await A.evaluate(() => { window.__want = null; }); await bolt(A, 'Llanowar'); await after();
      const r = await A.evaluate(() => { const a = S.bf.find(c => /Army/.test(typeOf(c))); return {army:a ? a.cp || 0 : -1, seen:!!(S.p24exSeen && S.p24exSeen.pids.length)}; });
      check(r.army === 2, `Georges amassed Orcs 2 (Army counters: ${r.army})`); check(r.seen, 'excess damage to an opponent\'s creature this turn is recorded (Rith)');
      await clean(A); await clean(B);
    });
    await step('Draw replacements: Vnwxt doubles, Alms Collector (Kim) cuts a 3-card draw to 1 + 1, Underrealm Lich digs', async () => {
      await put(A, 'Vnwxt, Verbose Host'); await after(); let h0 = await A.evaluate(() => S.hand.length);
      await A.evaluate(() => { S.speed = 1; commit(); draw(1); }); await after(); check(await A.evaluate(() => S.hand.length) === h0 + 1, 'Vnwxt below max speed (speed 1): drew just 1');
      h0 = await A.evaluate(() => S.hand.length); await A.evaluate(() => { S.speed = 4; commit(); draw(1); }); await after(); check(await A.evaluate(() => S.hand.length) === h0 + 2, 'Vnwxt at max speed (speed 4): drew 2 instead of 1');
      await A.evaluate(() => { S.speed = 0; commit(); }); await clean(A);
      await put(B, 'Alms Collector'); await after(); h0 = await A.evaluate(() => S.hand.length); const hb = await B.evaluate(() => S.hand.length);
      await A.evaluate(() => draw(3)); await after();
      check(await A.evaluate(() => S.hand.length) === h0 + 1, 'Georges drew only 1 of 3'); check(await B.evaluate(() => S.hand.length) === hb + 1, 'Kim drew 1 on her own client');
      await clean(B); await put(A, 'Underrealm Lich'); await after(); h0 = await A.evaluate(() => S.hand.length); const g0 = await A.evaluate(() => S.gy.length);
      await A.evaluate(() => draw(1)); await after(); await sleep(800);
      check(await A.evaluate(() => S.hand.length) === h0 + 1 && await A.evaluate(() => S.gy.length) === g0 + 2, 'Underrealm Lich: one card to hand, two to the graveyard');
      await clean(A);
    });
    await step('Token replacements: Queen Allenal adds a Soldier, Stridehangar Automaton adds a Thopter to an artifact token', async () => {
      await put(A, 'Queen Allenal of Ruadach'); await after();
      const cnt = re => A.evaluate(re => S.bf.filter(c => c.tok && new RegExp(re).test(cname(c))).reduce((a, c) => a + (c.n || 1), 0), re);
      const s0 = await cnt('Soldier'); await A.evaluate(() => createFromText('Create a 2/2 black Zombie creature token', {name:'test', k:null, it:{}})); await after();
      check(await cnt('Soldier') === s0 + 1 && await cnt('Zombie') >= 1, 'a Zombie plus an extra 1/1 Soldier'); await clean(A);
      await put(A, 'Stridehangar Automaton'); await after(); const t0 = await cnt('Thopter');
      await A.evaluate(() => createFromText('Create a 1/1 colorless Servo artifact creature token', {name:'test', k:null, it:{}})); await after();
      console.log('    dbg', JSON.stringify(await A.evaluate(() => S.bf.filter(c => c.tok).map(c => [cname(c), info(c.k)?.t, c.n || 1])))); check(await cnt('Thopter') === t0 + 1 && await cnt('Servo') >= 1, 'a Servo (artifact) plus an extra Thopter'); await clean(A);
    });
    await step('The Darkness Crystal: Kim\'s dying creature is exiled, Georges gains 2, then reanimates it', async () => {
      await put(A, 'The Darkness Crystal'); await put(B, 'Elvish Mystic'); await after(); const la = await life(A);
      await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Elvish Mystic'); destroyCard(c, 'test'); commit(); }); await after();
      check(await zone(B, 'Elvish Mystic') === 'ex', 'Kim\'s Elvish Mystic was exiled instead of dying'); check(await life(A) === la + 2, `Georges gained 2 (${la} → ${await life(A)})`);
      check(await activate(A, 'The Darkness Crystal', 'exiled with') === 'ok', 'activated the Crystal'); await after();
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Elvish Mystic'); return c ? [!!c.tap, c.cp || 0] : null; });
      check(r && r[0] && r[1] === 2, `Georges controls Elvish Mystic, tapped, with two +1/+1 counters (${JSON.stringify(r)})`);
      await clean(A);
    });
    await step('The Water Crystal: Kim mills 1 → mills 5', async () => {
      await put(A, 'The Water Crystal'); await after(); const l0 = await B.evaluate(() => S.lib.length);
      await B.evaluate(() => mill(1)); await after(); const l1 = await B.evaluate(() => S.lib.length);
      check(l0 - l1 === 5, `Kim milled ${l0 - l1}`); await clean(A);
    });
    await step('Whip of Erebos: the returned creature is exiled if it would leave the battlefield', async () => {
      await put(A, 'Whip of Erebos'); await A.evaluate(() => { const i = S.lib.findIndex(c => cname(c) === 'Llanowar Elves'); if (i >= 0){ const [c] = S.lib.splice(i, 1); S.gy.push(c); } commit(); }); await A.evaluate(() => { window.__tgt = 'Llanowar'; });
      check(await activate(A, 'Whip of Erebos', 'Return target creature') === 'ok', 'activated Whip'); await after(); await A.evaluate(() => { window.__tgt = null; });
      check(await zone(A, 'Llanowar Elves') === 'bf', 'Llanowar Elves returned');
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Llanowar Elves'); destroyCard(c, 'test'); commit(); }); await after();
      check(await zone(A, 'Llanowar Elves') === 'ex', 'destroyed → exiled instead of the graveyard'); await clean(A);
    });
    await step('Phial of Galadriel: empty hand → draw 2; at 5 or less life, gain twice as much', async () => {
      await put(A, 'Phial of Galadriel'); await after();
      const keep = await A.evaluate(() => { const h = S.hand.splice(0); S.lib.push(...h); commit(); return h.length; });
      await A.evaluate(() => draw(1)); await after(); check(await A.evaluate(() => S.hand.length) === 2, 'drew 2 with an empty hand');
      const r = await A.evaluate(() => { const l = S.life; S.life = 4; gainLife(3, 'test'); const g = S.life - 4; S.life = l; commit(); return g; }); check(r === 6, `gained ${r} instead of 3 at 4 life`);
      await clean(A);
    });
    await step('Lure: every creature Kim can block with must block the lured attacker', async () => {
      await put(A, 'Llanowar Elves'); await put(A, 'Lure'); await A.evaluate(() => { const e = S.bf.find(c => cname(c) === 'Llanowar Elves'); const p = S.bf.find(c => cname(c) === 'Lure'); p.att = {pid:MYPID, id:e.id}; commit(); });
      await put(B, 'Fyndhorn Elves'); await put(B, 'Birds of Paradise'); await after();
      const r = await combat(['Llanowar Elves'], {});
      console.log('    forced blocks', JSON.stringify(r.forced), 'first confirm accepted:', r.firstTry);
      check(r.forced.length === 2 && r.forced.every(x => x[1] === 'Llanowar Elves'), 'Kim\'s Fyndhorn Elves and Birds of Paradise were made to block the lured Elves');
      check(!r.firstTry, 'Kim\'s "no blocks" was not accepted');
      await clean(A); await clean(B);
    });
    await step('Anzrag: must be blocked if able', async () => {
      await put(A, 'Anzrag, the Quake-Mole'); await put(B, 'Wall of Omens'); await after();
      await A.evaluate(() => { const c = S.bf.find(x => /Anzrag/.test(cname(x))); c.ekw = ['p24mbb']; commit(); });
      const r = await combat(['Anzrag, the Quake-Mole'], {});
      console.log('    forced', JSON.stringify(r.forced));
      check(r.forced.length === 1 && r.forced[0][0] === 'Wall of Omens', 'Kim\'s Wall of Omens was made to block Anzrag');
      await clean(A); await clean(B);
    });
    await step('Goblin Rabblemaster: other Goblins must attack (preselected, can\'t be cleared)', async () => {
      await put(A, 'Goblin Rabblemaster'); await put(A, 'Skirk Prospector'); await put(A, 'Llanowar Elves'); await after();
      let refused = null;
      const r = await combat(['Llanowar Elves'], {}, {onAtk: async (pre) => {
        await A.evaluate(() => { UI.atkSel = {}; const e = S.bf.find(c => cname(c) === 'Llanowar Elves'); UI.atkSel[e.id] = 'p:' + opponents()[0].pid; declareAttackers(); });
        refused = await A.evaluate(() => S.cb.step === 'atk'); return 'stop'; }});
      console.log('    preselected', JSON.stringify(r.pre));
      check(r.pre.includes('Skirk Prospector') && !r.pre.includes('Goblin Rabblemaster'), 'Skirk Prospector was preselected to attack (Rabblemaster itself was not)');
      check(refused === true, 'attacking without the Goblin was refused');
      await A.evaluate(() => { S.bf.filter(c => !canAttack(c) && /Goblin/.test(typeOf(c)) && cname(c) !== 'Goblin Rabblemaster').forEach(c => { UI.atkSel[c.id] = 'p:' + opponents()[0].pid; }); declareAttackers(); });
      check(await A.evaluate(() => S.cb.step !== 'atk'), 'attacking with every other Goblin (Skirk Prospector and the new token) is accepted');
      for (let i = 0; i < 12; i++){ await passAll([A, B]); await B.evaluate(() => { const pn = phaseNow(); const cb = cbOf(pn); if (cb && cb.step === 'blk' && (S.bd || '') !== cbKey(pn, cb)) confirmBlocks(false); }); if (await A.evaluate(() => phaseNow().ph === 5)) break; }
      await clean(A);
    });
    await step('Ensnaring Bridge (Kim): Georges\'s creatures with power greater than Kim\'s hand size can\'t attack', async () => {
      await put(B, 'Ensnaring Bridge'); await put(A, 'Edgar Markov'); await B.evaluate(() => { while (S.hand.length > 2) S.lib.push(S.hand.pop()); commit(); }); await after();
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Edgar Markov') || S.cz.find(x => cname(x) === 'Edgar Markov'); if (!S.bf.includes(c)){ S.cz.splice(S.cz.indexOf(c), 1); S.bf.push(c); } c.sk = false; c.tap = false; return [canAttack(c), [...OPP.values()][0].hc]; });
      check(r[1] === 2 && /Ensnaring Bridge/.test(r[0]), `Edgar Markov (power 4) vs Kim's hand ${r[1]}: "${r[0]}"`);
      await B.evaluate(() => { while (S.hand.length < 6 && S.lib.length) S.hand.push(S.lib.shift()); commit(); }); await after();
      const r2 = await A.evaluate(() => canAttack(S.bf.find(x => cname(x) === 'Edgar Markov'))); check(!r2, `with 6 cards in Kim's hand Edgar can attack ("${r2}")`);
      await clean(B);
    });
    await step('Collective Restraint (Kim): attacking costs {X} per creature, X = basic land types among Kim\'s lands', async () => {
      await put(B, 'Collective Restraint'); await B.evaluate(() => { for (const n of ['Plains', 'Island']){ const c = S.lib.find(x => cname(x) === n); if (c) moveCard(c.id, 'bf', {quiet:true}); } commit(); }); await after();
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Edgar Markov'); const pid = opponents()[0].pid; UI.atkSel = {[c.id]:'p:' + pid}; const t = r23fTaxFor(pid, 1); const ty = new Set(); ([...OPP.values()][0].bf || []).forEach(l => { if (l.k && isLand(l.k)) (info(l.k).t || '').split(/[\s—]+/).forEach(w => { if (['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'].includes(w)) ty.add(w); }); }); UI.atkSel = {}; return [t.gen, ty.size]; });
      check(r[1] >= 2 && r[0] === r[1], `tax {${r[0]}} for one attacker = ${r[1]} basic land types`);
      await clean(A); await clean(B);
    });
    await step('Doran: every creature assigns combat damage equal to its toughness (Kim\'s client too)', async () => {
      await put(A, 'Doran, the Siege Tower'); await put(B, 'Wall of Omens'); await after();
      const r = await B.evaluate(() => toughDmg(S.bf.find(c => cname(c) === 'Wall of Omens'))); check(r === true, 'Kim\'s Wall of Omens assigns damage by toughness');
      await clean(A); await clean(B);
    });
    await step('Additional beginning phase (Sphinx of the Second Sun): untap, upkeep and draw again, then the end step', async () => {
      await A.evaluate(() => { if (phaseNow().ph !== 5) setPhase(5); }); await sleep(300);
      await A.evaluate(async () => { await runEffects('There is an additional beginning phase after this phase.', {k:null, name:'Sphinx of the Second Sun', full:'At the beginning of your postcombat main phase, there is an additional beginning phase after this phase.', it:{}, tgts:null}); });
      const h0 = await A.evaluate(() => { S.bf.filter(c => isLand(c.k)).forEach(c => { c.tap = true; }); commit(); return S.hand.length; });
      await A.evaluate(() => setPhase(6)); await sleep(300);
      const r0 = await A.evaluate(() => [phaseNow().ph, S.bf.filter(c => isLand(c.k)).every(c => !c.tap)]);
      check(r0[0] === 1 && r0[1], `went to the upkeep with lands untapped (${JSON.stringify(r0)})`);
      for (let i = 0; i < 30 && await A.evaluate(() => phaseNow().ph < 3); i++){ await passAll([A, B]); await A.evaluate(() => { if (!stackAll().length && phaseNow().ph < 3) advancePhase(); }); await sleep(200); }
      const r1 = await A.evaluate(() => { const L = S.log.map(e => e.s); const i = L.lastIndexOf('additional beginning phase (untap, upkeep, draw)'); const tail = L.slice(i); return {drew:tail.some(x => /^drew a card/.test(x)), main:tail.some(x => /main phase 1|precombat main/i.test(x)), ph:phaseNow(), tail:tail.slice(0, 8)}; });
      console.log('    ', JSON.stringify(r1.tail));
      check(r1.drew && (r1.ph.mine ? r1.ph.ph >= 6 : true) && !r1.main, 'drew a card in the extra beginning phase, then went on to the end step (no extra main phase)');
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
