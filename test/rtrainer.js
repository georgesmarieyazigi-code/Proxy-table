// rtrainer.js: the trainer / coach (bots stage 2). Real 3-player games over a local MQTT broker: Georges (the trainer's human)
// deliberately makes each kind of mistake, then plays the clean version; Live toasts, the Review timeline, the coaching profile
// across a reload, and the hidden-information rules.
// Usage: cd test && PTFILE=devTrainer.html PTPORT=19990 node rtrainer.js          ONLY=game,profile,hidden,bots
process.env.ALL = '1';
const CARDS = require('./cards');   // test cards must be in the pool before h.js indexes it
 const fs = require('fs'); const path = require('path');
const ONLY = (process.env.ONLY || 'game,profile,hidden,bots').split(',');
const withT = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout: ' + what)), ms))]);
const step = async (what, ms, fn) => { console.log('— ' + what); try { return await withT(fn(), ms, what); } catch (e){ H.check(false, what + ': ' + e.message.split('\n')[0]); return null; } };
// test-only vanilla cards
let cn = 0; const mk = (name, mana, cmc, type, text, p, t) => ({object:'card', id:'id-trn-' + (++cn), name, mana_cost:mana, cmc, type_line:type, oracle_text:text, colors:[...new Set(mana.match(/[WUBRG]/g) || [])], color_identity:[...new Set(mana.match(/[WUBRG]/g) || [])], keywords:[], layout:'normal', set:'trn', collector_number:String(cn), set_name:'Trainer test', released_at:'2024-01-01', power:p, toughness:t, prices:{usd:'0.1'}, image_uris:{normal:''}});
CARDS.cards.push(mk('Test Squire', '{1}{W}', 2, 'Creature — Human Soldier', '', '2', '2'), mk('Test Knight', '{2}{W}', 3, 'Creature — Human Knight', '', '3', '2'),
  mk('Test Ogre', '{2}{R}', 3, 'Creature — Ogre', '', '3', '3'), mk('Test Brute', '{3}{G}', 4, 'Creature — Beast', '', '5', '5'), mk('Test Drake', '{2}{U}', 3, 'Creature — Drake', 'Flying', '2', '2'),
  mk('Test Pebble', '{2}', 2, 'Artifact Creature — Construct', '', '1', '1'), mk('Test Wall', '{1}{W}', 2, 'Creature — Wall', '', '0', '4'));
const H = require('./h'); const sleep = H.sleep;
const list = o => Object.entries(o).map(([n, q]) => q + ' ' + n).join('\n');
const DECK_A = 'Commander\n1 Kenrith, the Returned King\n\nDeck\n' + list({'Plains':20, 'Island':20, 'Swamp':5, 'Mountain':5, 'Forest':5, 'Test Squire':4, 'Test Knight':2, 'Test Ogre':6, 'Test Brute':2, 'Test Drake':2, 'Test Pebble':2, 'Test Wall':2,
  'Counterspell':1, 'Sol Ring':1, 'Preordain':1, 'Evolving Wilds':1, 'Swords to Plowshares':1, 'Temple of Enlightenment':1, 'Lightning Bolt':1, 'Divination':1, 'Arcane Signet':1, 'Giant Growth':1});
const DECK_B = 'Commander\n1 Thalia, Guardian of Thraben\n\nDeck\n' + list({'Plains':20, 'Island':15, 'Forest':5, 'Test Ogre':6, 'Test Brute':2, 'Test Squire':3, 'Test Pebble':2, 'Llanowar Elves':1, 'Consecrated Sphinx':1, "Thassa's Oracle":1, 'Wrath of God':1, 'Memnite':1});
const DECK_C = 'Commander\n1 Krenko, Mob Boss\n\nDeck\n' + list({'Mountain':30, 'Plains':10, 'Test Squire':4, 'Test Ogre':2});

// answer every question: card picks (min), yes/no by window.__want, targets by window.__tgt (a card name), scry/look windows closed
const AUTO = () => { if (window.__auto) return; window.__auto = 1; window.__want = null; window.__tgt = null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return;
  try {
    const w = window.__want ? new RegExp(window.__want, 'i') : null;
    if (m.type === 'pick' && m.resolve){ const ids = (m.cards || []).slice(0, m.min || 0).map(c => c.id); m.__done = 1; m.sel = ids; ACT.pickDone(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const p = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.onClose = null; closeModal(); m.resolve(p ? p.value : null); }
    else if (m.type === 'target' && m.resolve){ const t = window.__tgt; const i = (m.cands || []).findIndex(c => c.ok && (!t || (c.nm || '') === t || (c.k && info(c.k)?.n === t))); if (i < 0) return; m.__done = 1; m.sel = [i]; renderModal(); const d = document.querySelector('#modal [data-act="tgtDone"]'); if (d) d.click(); else { m.onClose = null; closeModal(); m.resolve([m.cands[i]]); } }
    else if (m.type === 'bottom'){ m.__done = 1; m.sel = S.hand.slice(0, m.need).map(c => c.id); ACT.doBottom(); }
    else if (m.type === 'zone' || m.type === 'card'){ m.__done = 1; closeModal(); }
    else if (m.run){ m.__done = 1; m.run(m.def ?? 1); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 100); };
// one step of "a player who just keeps the game moving" (no attacks, no blocks, passes priority)
const DRIVE = (stopAfter) => { if (!S || UI.modal || UI.casting || UI.resolving) return 'busy'; const pn = phaseNow();
  if (stopAfter != null && pn.mine && pn.ph === 3 && S.untapN === pn.n && pn.n > stopAfter && !stackAll().length) return 'arrived';
  if (myBox()){ doPass(); return 'pass'; }
  if (!pn.mine){ const cb = cbOf(pn); if (pn.ph === 4 && cb && cb.step === 'blk' && attackersOnMe(pn).length && (S.bd || '') !== cbKey(pn, cb)){ UI.blkSel = {}; confirmBlocks(false); return 'noblock'; } return 'wait'; }
  if (stackAll().length) return 'stack';
  if (S.untapN < pn.n){ startMyTurn(); return 'start'; }
  if (pn.ph === 4 && S.cb && S.cb.step === 'atk'){ UI.atkSel = {}; declareAttackers(); return 'noattack'; }
  if (pn.ph >= 6 && S.hand.length > 7) return 'cleanup';
  nextAction(); return 'next'; };
// a page's board, set directly for a scenario (setup is not a decision, so nothing is recorded)
const SETUP = (spec) => {
  const back = c => { reset(c); c.atk = ''; c.blk = null; S.lib.push(c); };
  for (const c of S.bf.slice()){ S.bf.splice(S.bf.indexOf(c), 1); if (c.tok) continue; if (c.cmd){ reset(c); S.cz.push(c); continue; } back(c); }
  for (const z of ['hand', 'gy', 'ex']) for (const c of S[z].slice()){ S[z].splice(S[z].indexOf(c), 1); if (c.cmd){ reset(c); S.cz.push(c); continue; } back(c); }
  const take = n => { const i = S.lib.findIndex(c => cname(c) === n); if (i < 0) throw new Error('no ' + n + ' in library'); const [c] = S.lib.splice(i, 1); reset(c); return c; };
  (spec.bf || []).forEach(n => { const tap = n.startsWith('*'); const c = take(n.replace(/^\*/, '')); c.tap = tap; c.sk = false; place(c); S.bf.push(c); });
  (spec.hand || []).forEach(n => S.hand.push(take(n)));
  S.life = spec.life ?? 40; S.psn = 0; S.pool = emptyPool(); S.landT = spec.landPlayed ? [turnStr(), 1] : ['', 0]; S.stk = []; S.lost = ''; S.cdt = {};
  commit(); return true; };

let A, B, C;
const pages = () => [A, B, C];
async function drive(target, ms = 90000){
  const from = await target.evaluate(() => phaseNow().n);
  const t0 = Date.now();
  while (Date.now() - t0 < ms){
    for (const p of pages()){
      const r = await p.evaluate(`(${DRIVE})(${p === target ? from : 'null'})`).catch(e => 'err ' + e.message);
      if (p === target && r === 'arrived') return true;
    }
    await sleep(120);
  }
  return false;
}
// the trainer's findings since a mark
const mark = () => A.evaluate(() => ({f:TR.g ? TR.g.finds.length : 0, r:TR.g ? TR.g.recs.length : 0}));
const since = (m) => A.evaluate(m => ({finds:TR.g.finds.slice(m.f).map(f => ({cat:f.cat, sev:f.sev, msg:f.msg, better:f.better})), recs:TR.g.recs.slice(m.r).map(r => r.kind)}), m);
const setup = (p, spec) => p.evaluate(`(${SETUP})(${JSON.stringify(spec)})`);
const id = (p, name, zone = 'hand') => p.evaluate(([n, z]) => S[z].find(c => cname(c) === n)?.id, [name, zone]);
const ids = (p, name, zone = 'bf') => p.evaluate(([n, z]) => S[z].filter(c => cname(c) === n).map(c => c.id), [name, zone]);
async function cast(p, name, tgt){
  await p.evaluate(t => { window.__tgt = t || null; }, tgt || null);
  const cid = await id(p, name); if (!cid) throw new Error(name + ' not in hand');
  const r = await H.menuClick(p, cid, /^Cast/); if (r !== 'ok') throw new Error('cast ' + name + ': ' + r);
  await H.waitFor(p, n => !UI.casting && !S.hand.some(c => cname(c) === n), name, 8000);
}
async function playLand(p, name){ const cid = await id(p, name); const r = await H.menuClick(p, cid, /^Play land/); if (r !== 'ok') throw new Error('play ' + name + ': ' + r); await sleep(200); }
// let everything on the stack resolve (all pages pass)
async function settle(ms = 20000){ const t0 = Date.now(); while (Date.now() - t0 < ms){ for (const p of pages()) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(250);
  const busy = await A.evaluate(() => stackAll().length > 0 || !!UI.resolving); if (!busy) return true; } return false; }
// end Georges's turn cleanly: nothing left to judge (hand emptied, lands tapped, land drop counted)
async function endClean(keep = []){
  await A.evaluate(k => { S.hand.slice().forEach(c => { S.hand.splice(S.hand.indexOf(c), 1); reset(c); S.lib.push(c); }); S.bf.forEach(c => { if (!k.includes(cname(c))) c.tap = true; }); S.landT = [turnStr(), 1]; S.pool = emptyPool(); commit(); }, keep);
  await A.evaluate(() => endTurnFlow());
}
// a scenario on Georges's own main phase 1: set boards, act, collect what the trainer said
async function myTurn(){ if (await A.evaluate(() => phaseNow().mine && phaseNow().ph === 3 && !stackAll().length)) return true; return drive(A); }
async function nextTurn(keep){ await endClean(keep); await sleep(300); const ok = await drive(A); if (!ok) throw new Error('could not reach my next main phase'); }
const RES = {mistake:[], clean:[]};
function expect(tag, got, cat){ const cats = got.finds.map(f => f.cat); const ok = cats.includes(cat); RES.mistake.push({tag, cat, ok});
  H.check(ok, `${tag}: flagged as ${cat}${ok ? ' — "' + got.finds.find(f => f.cat === cat).msg.slice(0, 150) + '"' : ' (got ' + JSON.stringify(got.finds.map(f => f.cat + '/' + f.sev)) + ', recs ' + got.recs.join(',') + ')'}`); }
function clean(tag, got){ const ok = !got.finds.length && got.recs.length > 0; RES.clean.push({tag, ok}); H.check(ok, `${tag}: no flags (correct play; judged ${got.recs.join(', ')})${ok ? '' : ' — got ' + JSON.stringify(got.finds.map(f => f.cat + ': ' + f.msg.slice(0, 100)))}`); }

async function game(browser){
  console.log('\n== a 3-player table: Georges (trainer on), Kim, Lee');
  const code = 'trn-' + (Date.now() % 100000);
  A = await H.player(browser, 'Georges', DECK_A, 'host', code); B = await H.player(browser, 'Kim', DECK_B, 'join', code); C = await H.player(browser, 'Lee', DECK_C, 'join', code);
  H.check(await H.waitFor(A, () => OPP.size === 2, null, 20000), 'three players seated');
  for (const p of pages()) await p.evaluate(AUTO);
  await A.evaluate(() => { UI.cmdz = false; trSetMode('quiet'); });
  H.check(await A.evaluate(() => TR.mode === 'quiet' && typeof trCoachRecord === 'function'), 'the trainer is loaded on the human page (Quiet)');

  // ---------------- pregame: mulligans
  await step('mulligan: shipping a 0-lander is right (clean)', 30000, async () => {
    await A.evaluate(() => trWatch()); const m = await mark();
    await setup(A, {hand:['Test Squire', 'Test Knight', 'Test Ogre', 'Test Brute', 'Test Drake', 'Test Pebble', 'Test Wall']});
    await A.click('[data-act="mull"]'); await sleep(500);
    const g = await since(m); H.check(g.recs.includes('ship'), 'the mulligan was recorded'); clean('ship a 0-land hand', g);
  });
  await step('mulligan: shipping a good 7 (mistake)', 30000, async () => {
    const m = await mark();
    await setup(A, {hand:['Plains', 'Island', 'Plains', 'Test Squire', 'Test Knight', 'Sol Ring', 'Test Ogre']});
    await A.click('[data-act="mull"]'); await sleep(800);
    expect('ship a 3-land 7', await since(m), 'mulligan');
  });
  await step('keep: a hand with no lands (blunder)', 40000, async () => {
    await sleep(500); const m = await mark();
    await setup(A, {hand:['Test Squire', 'Test Knight', 'Test Ogre', 'Test Brute', 'Test Drake', 'Test Pebble']});
    await A.click('[data-act="goFirst"]'); await sleep(1500);
    const g = await since(m); expect('keep 0 lands', g, 'mulligan');
    H.check(g.finds.some(f => f.sev === 'blunder'), 'a no-land keep is a blunder');
  });
  await step('reach my main phase', 60000, async () => { H.check(await myTurn(), 'Georges is in main phase 1'); });

  // ---------------- turn-by-turn scenarios
  const SC = process.env.SCEN ? new RegExp(process.env.SCEN, 'i') : null;
  const scen = async (name, fn, ms = 60000) => (SC && !SC.test(name)) ? null : step(name, ms, fn);
  await scen('clean: land, then spend all the mana', async () => {
    await setup(A, {bf:['Plains'], hand:['Plains', 'Test Squire']}); await setup(B, {}); await setup(C, {}); await sleep(600);
    const m = await mark(); await playLand(A, 'Plains'); await cast(A, 'Test Squire'); await settle();
    await A.evaluate(() => endTurnFlow()); await sleep(800);
    clean('land + spend mana + pass', await since(m)); const ok = await drive(A); if (!ok) throw new Error('no next turn');
  });
  await scen('missed land drop (mistake)', async () => {
    await setup(A, {bf:['Plains', 'Plains'], hand:['Island']}); const m = await mark();
    await A.evaluate(() => endTurnFlow()); await sleep(800);
    expect('end turn holding a land', await since(m), 'land_drop'); if (!(await drive(A))) throw new Error('no next turn');
  });
  await scen('unused mana (mistake/inaccuracy)', async () => {
    await setup(A, {bf:['Plains', 'Plains', 'Plains', 'Plains'], hand:['Test Squire'], landPlayed:true}); const m = await mark();
    await A.evaluate(() => endTurnFlow()); await sleep(800);
    expect('pass with 4 mana and a castable creature', await since(m), 'unused_mana'); if (!(await drive(A))) throw new Error('no next turn');
  });
  await scen('clean: holding up Counterspell is not "unused mana"', async () => {
    await setup(A, {bf:['Island', 'Island'], hand:['Counterspell', 'Test Pebble'], landPlayed:true}); const m = await mark();
    await A.evaluate(() => endTurnFlow()); await sleep(800);
    clean('pass with UU open and Counterspell in hand', await since(m)); if (!(await drive(A))) throw new Error('no next turn');
  });
  await scen('discarding to hand size with mana open (mistake)', async () => {
    await setup(A, {bf:['Plains', 'Plains'], hand:['Test Squire', 'Island', 'Island', 'Island', 'Island', 'Plains', 'Plains', 'Plains'], landPlayed:true}); const m = await mark();
    await A.evaluate(() => endTurnFlow()); await sleep(1500);
    expect('8 cards at cleanup, Squire castable', await since(m), 'hand_size'); if (!(await drive(A))) throw new Error('no next turn');
  });
  await scen('mana left floating (inaccuracy)', async () => {
    await setup(A, {bf:['Plains', 'Plains'], hand:['Test Squire'], landPlayed:true}); const m = await mark();
    for (const pid of await ids(A, 'Plains')) await A.evaluate(i => quickTap(i), pid);
    await sleep(200); await A.evaluate(() => nextAction()); await sleep(800);
    expect('tap two Plains, then go to combat', await since(m), 'mana_float');
    await nextTurn();
  });
  await scen('tapping the wrong colours (mistake)', async () => {
    await setup(A, {bf:['Island', 'Island', 'Plains', 'Plains'], hand:['Counterspell', 'Test Squire'], landPlayed:true}); await sleep(300); const m = await mark();
    const isl = (await ids(A, 'Island'))[0], pl = (await ids(A, 'Plains'))[0];
    await A.evaluate(i => quickTap(i), isl); await A.evaluate(i => quickTap(i), pl); await sleep(200);
    await cast(A, 'Test Squire'); await settle();
    expect('pay {1}{W} with Island + Plains holding Counterspell', await since(m), 'color_tap');
    await nextTurn();
  });
  await scen('clean: paying with the right lands', async () => {
    await setup(A, {bf:['Island', 'Island', 'Plains', 'Plains'], hand:['Counterspell', 'Test Squire'], landPlayed:true}); await sleep(300); const m = await mark();
    for (const pid of await ids(A, 'Plains')) await A.evaluate(i => quickTap(i), pid);
    await cast(A, 'Test Squire'); await settle();
    clean('pay {1}{W} with Plains + Plains, UU still open', await since(m));
    await nextTurn();
  });
  await scen('tapping out instead of holding up a counter (tip)', async () => {
    await setup(A, {bf:['Island', 'Island'], hand:['Counterspell', 'Test Pebble'], landPlayed:true}); await setup(B, {hand:[]}); await sleep(600); const m = await mark();
    await cast(A, 'Test Pebble'); await settle();
    expect('cast a 1/1 for {2} with Counterspell in hand', await since(m), 'hold_up');
    await nextTurn();
  });
  await scen('mana rock after the spell (mistake)', async () => {
    await setup(A, {bf:['Island', 'Island', 'Island'], hand:['Sol Ring', 'Test Drake'], landPlayed:true}); const m = await mark();
    await cast(A, 'Test Drake'); await settle(); await A.evaluate(() => endTurnFlow()); await sleep(800);
    expect('Drake first, Sol Ring stuck in hand', await since(m), 'ramp_first'); if (!(await drive(A))) throw new Error('no next turn');
  });
  await scen('clean: mana rock first', async () => {
    await setup(A, {bf:['Island', 'Island', 'Island'], hand:['Sol Ring', 'Test Drake'], landPlayed:true}); const m = await mark();
    await cast(A, 'Sol Ring'); await settle(); await cast(A, 'Test Drake'); await settle(); await A.evaluate(() => { S.bf.forEach(c => { c.tap = true; }); commit(); endTurnFlow(); }); await sleep(800);
    clean('Sol Ring, then Drake', await since(m)); if (!(await drive(A))) throw new Error('no next turn');
  });
  await scen('land before the cantrip, with a land choice (tip)', async () => {
    await setup(A, {bf:['Island'], hand:['Preordain', 'Plains', 'Swamp']}); const m = await mark();
    await playLand(A, 'Plains'); await cast(A, 'Preordain'); await settle();
    expect('Plains, then Preordain (holding Plains + Swamp)', await since(m), 'cantrip_first');
    await nextTurn();
  });
  await scen('clean: land then cantrip with no land choice', async () => {
    await setup(A, {bf:['Island'], hand:['Preordain', 'Island', 'Island']}); const m = await mark();
    await playLand(A, 'Island'); await cast(A, 'Preordain'); await settle();
    clean('Island, then Preordain (only Islands in hand)', await since(m));
    await nextTurn();
  });
  await scen('tapped land when the untapped one would cast a spell (mistake)', async () => {
    await setup(A, {bf:['Plains', 'Plains'], hand:['Temple of Enlightenment', 'Plains', 'Test Knight']}); const m = await mark();
    await playLand(A, 'Temple of Enlightenment'); await settle(); await sleep(300); await A.evaluate(() => endTurnFlow()); await sleep(800); H.check((await since(m)).recs.includes('end'), 'the turn ended (recorded)');
    expect('Temple instead of Plains, one short of Test Knight', await since(m), 'land_choice'); if (!(await drive(A))) throw new Error('no next turn');
  });
  await scen('clean: tapped land on a turn the mana is not needed', async () => {
    await setup(A, {bf:['Plains', 'Plains'], hand:['Temple of Enlightenment', 'Plains']}); const m = await mark();
    await playLand(A, 'Temple of Enlightenment'); await settle(); await sleep(300); await A.evaluate(() => endTurnFlow()); await sleep(800); H.check((await since(m)).recs.includes('end'), 'the turn ended (recorded)');
    clean('Temple with nothing to cast', await since(m)); if (!(await drive(A))) throw new Error('no next turn');
  });
  // combat on my turn
  const attack = async (sel) => {
    await A.evaluate(() => nextAction()); await H.waitFor(A, () => phaseNow().ph === 4, null, 8000);
    for (let i = 0; i < 30 && !(await A.evaluate(() => S.cb && S.cb.step === 'atk')); i++){ for (const p of [B, C]) await p.evaluate(() => { if (myBox()) doPass(); }); await A.evaluate(() => { if (!UI.modal && !stackAll().length && !(S.cb && S.cb.step === 'atk')) nextAction(); }); await sleep(200); }
    await A.evaluate(s => { UI.atkSel = {}; for (const [nm, who] of s){ const c = S.bf.find(x => cname(x) === nm && !UI.atkSel[x.id] && !canAttack(x)); const p = players().find(p => p.nm === who); if (c && p) UI.atkSel[c.id] = 'p:' + p.pid; } renderCombatPanel(); }, sel);
    await A.click('#cbpanel [data-act="atkGo"]');
    await sleep(500);
    // let the defenders not block, damage happen, reach main 2
    for (let i = 0; i < 60 && !(await A.evaluate(() => phaseNow().ph === 5)); i++){ for (const p of [B, C]) await p.evaluate(`(${DRIVE})(null)`); await A.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); }
  };
  await scen('plain creature cast before attacking (tip)', async () => {
    await setup(A, {bf:['Plains', 'Plains', 'Test Ogre'], hand:['Test Squire'], landPlayed:true}); await setup(B, {}); await setup(C, {}); await sleep(600); const m = await mark();
    await cast(A, 'Test Squire'); await settle(); await attack([['Test Ogre', 'Kim']]); await A.evaluate(() => { S.bf.forEach(c => { if (isLand(c.k)) c.tap = true; }); commit(); endTurnFlow(); }); await sleep(800);
    expect('Squire in main 1, then attack with Ogre', await since(m), 'precombat'); if (!(await drive(A))) throw new Error('no next turn');
  }, 90000);
  await scen('clean: attack first, creature after combat', async () => {
    await setup(A, {bf:['Plains', 'Plains', 'Test Ogre'], hand:['Test Squire'], landPlayed:true}); await setup(B, {bf:['Memnite']}); await sleep(600); const m = await mark();
    await attack([['Test Ogre', 'Kim']]); await cast(A, 'Test Squire'); await settle(); await A.evaluate(() => endTurnFlow()); await sleep(800);
    clean('Ogre attacks into a 1/1, Squire in main 2', await since(m)); if (!(await drive(A))) throw new Error('no next turn');
  }, 90000);
  await scen('attack into a blocker that eats it (mistake)', async () => {
    await setup(A, {bf:['Plains', 'Test Ogre'], landPlayed:true}); await setup(B, {bf:['Test Brute']}); await sleep(700); const m = await mark();
    await attack([['Test Ogre', 'Kim']]);
    expect('3/3 into an untapped 5/5', await since(m), 'bad_attack');
    await nextTurn();
  }, 90000);
  await scen('missed lethal (blunder)', async () => {
    await setup(A, {bf:['Test Ogre', 'Test Ogre', 'Test Ogre'], landPlayed:true}); await setup(B, {bf:['Test Squire'], life:5}); await sleep(700); const m = await mark();
    await attack([['Test Ogre', 'Kim']]);
    expect('three 3/3s, Kim at 5 with one blocker, only one attacks', await since(m), 'lethal');
    await B.evaluate(() => { S.life = 40; S.lost = ''; commit(); }); await nextTurn();
  }, 90000);
  await scen('dead on the crack-back (blunder)', async () => {
    await setup(A, {bf:['Test Squire', 'Test Squire'], life:6, landPlayed:true}); await setup(B, {bf:['Test Ogre', 'Test Ogre']}); await setup(C, {}); await sleep(700); const m = await mark();
    await attack([['Test Squire', 'Lee'], ['Test Squire', 'Lee']]); await A.evaluate(() => endTurnFlow()); await sleep(800);
    expect('both blockers attack Lee at 6 life, Kim has 6 power', await since(m), 'crack_back');
    await setup(B, {}); await A.evaluate(() => { S.life = 40; commit(); }); if (!(await drive(A))) throw new Error('no next turn');
  }, 90000);
  await scen('feeding the leader (tip)', async () => {
    await setup(A, {bf:['Test Squire'], landPlayed:true}); await setup(B, {bf:['*Test Ogre', '*Test Ogre', '*Test Ogre', '*Test Ogre', '*Test Brute']}); await setup(C, {}); await sleep(800); const m = await mark();
    await attack([['Test Squire', 'Lee']]);
    expect('attack Lee (empty board) while Kim runs away with it', await since(m), 'feed_leader');
    await setup(B, {}); await nextTurn();
  }, 90000);
  await scen('overextending into a wipe (tip)', async () => {
    await setup(A, {bf:['Plains', 'Plains', 'Plains', 'Plains', 'Test Ogre', 'Test Ogre', 'Test Ogre', 'Test Ogre'], hand:['Test Squire', 'Test Squire'], landPlayed:true}); await setup(B, {hand:['Plains', 'Plains', 'Island', 'Island']}); await setup(C, {}); await sleep(700); const m = await mark();
    await cast(A, 'Test Squire'); await settle(); await cast(A, 'Test Squire'); await settle(); await A.evaluate(() => endTurnFlow()); await sleep(800);
    expect('dump two more creatures while far ahead', await since(m), 'overextend'); if (!(await drive(A))) throw new Error('no next turn');
  }, 90000);
  await scen('removal on a small target (mistake)', async () => {
    await setup(A, {bf:['Plains'], hand:['Swords to Plowshares'], landPlayed:true}); await setup(B, {bf:['Llanowar Elves', 'Consecrated Sphinx']}); await sleep(700); const m = await mark();
    await cast(A, 'Swords to Plowshares', 'Llanowar Elves'); await settle();
    expect('Swords on Llanowar Elves, Consecrated Sphinx out', await since(m), 'removal_target');
    await nextTurn();
  });
  await scen('clean: removal on the biggest threat', async () => {
    await setup(A, {bf:['Plains'], hand:['Swords to Plowshares'], landPlayed:true}); await setup(B, {bf:['Llanowar Elves', 'Consecrated Sphinx']}); await sleep(700); const m = await mark();
    await cast(A, 'Swords to Plowshares', 'Consecrated Sphinx'); await settle();
    clean('Swords on Consecrated Sphinx', await since(m));
    await nextTurn();
  });
  await scen("ignoring a combo piece (mistake)", async () => {
    await setup(A, {bf:['Plains'], hand:['Swords to Plowshares'], landPlayed:true}); await setup(B, {bf:["Thassa's Oracle", 'Test Ogre']}); await sleep(700); const m = await mark();
    await cast(A, 'Swords to Plowshares', 'Test Ogre'); await settle();
    expect("Swords on an Ogre with Thassa's Oracle out", await since(m), 'combo_piece');
    await setup(B, {}); await nextTurn();
  });
  await scen('commander left in the graveyard (mistake)', async () => {
    await setup(A, {bf:['Plains'], landPlayed:true}); await A.evaluate(() => { const c = S.cz[0]; S.cz.splice(0, 1); c.sk = false; place(c); S.bf.push(c); commit(); }); await sleep(300); const m = await mark();
    await A.evaluate(() => { window.__want = '^Leave'; const c = S.bf.find(x => x.cmd); moveCard(c.id, 'gy'); });
    await sleep(1500); await A.evaluate(() => { window.__want = null; });
    expect('Kenrith destroyed, "leave it in the graveyard"', await since(m), 'commander');
    await nextTurn();
  });
  await scen('fetch land left uncracked (inaccuracy)', async () => {
    await setup(A, {bf:['Plains', 'Evolving Wilds'], landPlayed:true}); const m = await mark();
    await endClean(['Evolving Wilds']); await sleep(300); if (!(await drive(A))) throw new Error('no next turn');
    expect('Evolving Wilds held through the opponents\' turns', await since(m), 'fetch');
  }, 90000);
  // opponents' turns: blocks and priority
  const toOpp = async (P) => { await endClean(); await sleep(300); const ok = await drive(P); if (!ok) throw new Error('could not reach the opponent\'s main phase'); };
  const oppAttack = async (P, names) => {
    await P.evaluate(() => nextAction()); await H.waitFor(P, () => phaseNow().ph === 4, null, 8000);
    for (let i = 0; i < 30 && !(await P.evaluate(() => S.cb && S.cb.step === 'atk')); i++){ for (const p of pages()) if (p !== P) await p.evaluate(() => { if (myBox()) doPass(); }); await P.evaluate(() => { if (!UI.modal && !stackAll().length && !(S.cb && S.cb.step === 'atk')) nextAction(); }); await sleep(200); }
    await P.evaluate(n => { UI.atkSel = {}; const me = players().find(p => p.nm === 'Georges'); S.bf.filter(c => n.includes(cname(c))).forEach(c => { if (!canAttack(c)) UI.atkSel[c.id] = 'p:' + me.pid; }); declareAttackers(); }, names);
    await H.waitFor(A, () => !!document.querySelector('#cbpanel [data-act="blkGo"]'), null, 15000);
  };
  const block = async (pairs) => { await A.evaluate(pr => { const pn = phaseNow(); const atts = attackersOnMe(pn); UI.blkSel = {}; const used = new Set(); for (const [b, a] of pr){ const bc = S.bf.find(x => cname(x) === b && !(x.id in UI.blkSel)); const ac = atts.find(x => cname(x) === a && !used.has(x.id)); if (bc && ac){ UI.blkSel[bc.id] = ac.id; used.add(ac.id); } } renderCombatPanel(); }, pairs); await A.click('#cbpanel [data-act="blkGo"]'); await sleep(600); };
  const finishOppTurn = async (P) => { await P.evaluate(() => { S.bf.forEach(c => { c.tap = true; }); commit(); }); if (!(await drive(A))) throw new Error('no next turn'); };
  await scen('needless chump block (mistake)', async () => {
    await toOpp(B); await setup(A, {bf:['Test Squire']}); await setup(B, {bf:['Test Ogre']}); await sleep(600); const m = await mark();
    await oppAttack(B, ['Test Ogre']); await block([['Test Squire', 'Test Ogre']]);
    expect('Squire chumps an Ogre at 40 life', await since(m), 'chump');
    await finishOppTurn(B);
  }, 120000);
  await scen('clean: a chump block that saves your life', async () => {
    await toOpp(B); await setup(A, {bf:['Test Squire'], life:3}); await setup(B, {bf:['Test Ogre']}); await sleep(600); const m = await mark();
    await oppAttack(B, ['Test Ogre']); await block([['Test Squire', 'Test Ogre']]);
    clean('Squire chumps an Ogre at 3 life', await since(m));
    await A.evaluate(() => { S.life = 40; commit(); }); await finishOppTurn(B);
  }, 120000);
  await scen('clean: a block that kills the attacker', async () => {
    await toOpp(B); await setup(A, {bf:['Test Brute']}); await setup(B, {bf:['Test Ogre']}); await sleep(600); const m = await mark();
    await oppAttack(B, ['Test Ogre']); await block([['Test Brute', 'Test Ogre']]);
    clean('Brute blocks and kills an Ogre', await since(m));
    await finishOppTurn(B);
  }, 120000);
  await scen('letting a board wipe resolve while holding a counter (mistake)', async () => {
    await toOpp(B); await setup(A, {bf:['Island', 'Island', 'Test Ogre', 'Test Ogre'], hand:['Counterspell']}); await setup(B, {bf:['Plains', 'Plains', 'Plains', 'Plains'], hand:['Wrath of God']}); await sleep(700); const m = await mark();
    await B.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Wrath of God'); beginCast(c, 'hand', {}); });
    await H.waitFor(A, () => !!myBox() && stackAll().some(i => i.nm === 'Wrath of God'), null, 10000);
    if (process.env.DBG) console.log(JSON.stringify(await A.evaluate(() => { const tos = stackTop(); const c = S.hand[0]; const a = info(c.k); return {tosKind:tos.kind, pid:tos.pid === MYPID, cc:castCheck(c, 'hand'), cl:counterLegal(tos, counterSpec(tname(a.o, a.n))), roles:[...trR(tos.k).roles], cr:botCreatures(S.bf, MYPID).length, key:prioKey(), pass:S.pass}; })));
    await A.click('#stackpanel [data-act="passPrio"]'); await settle();
    if (process.env.DBG) console.log(JSON.stringify(await A.evaluate(m => ({errs:TR.errs.slice(-3), cr:botCreatures(S.bf, MYPID).length, bf:S.bf.map(cname), recs:TR.g.recs.slice(m.r).map(r => ({k:r.kind, bf:r.saw.you.battlefield}))}), m)));
    expect('pass on Wrath of God with Counterspell and two creatures', await since(m), 'let_resolve');
    await finishOppTurn(B);
  }, 120000);
  await scen('clean: letting a small spell resolve', async () => {
    await toOpp(B); await setup(A, {bf:['Island', 'Island'], hand:['Counterspell']}); await setup(B, {bf:['Plains', 'Plains'], hand:['Test Pebble']}); await sleep(700); const m = await mark();
    await B.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Test Pebble'); beginCast(c, 'hand', {}); });
    await H.waitFor(A, () => !!myBox() && stackAll().some(i => i.nm === 'Test Pebble'), null, 10000);
    await A.click('#stackpanel [data-act="passPrio"]'); await settle();
    clean('pass on a 1/1 artifact', await since(m));
    await finishOppTurn(B);
  }, 120000);

  // ---------------- Live mode: a toast right after the flagged move, and it never blocks play
  await scen('Live mode: toast after a flagged move, play not blocked', async () => {
    await A.evaluate(() => trSetMode('live'));
    await setup(A, {bf:['Plains', 'Test Ogre'], landPlayed:true}); await setup(B, {bf:['Test Brute']}); await sleep(700);
    await A.evaluate(() => nextAction()); await H.waitFor(A, () => phaseNow().ph === 4, null, 8000);
    for (let i = 0; i < 30 && !(await A.evaluate(() => S.cb && S.cb.step === 'atk')); i++){ for (const p of [B, C]) await p.evaluate(() => { if (myBox()) doPass(); }); await A.evaluate(() => { if (!UI.modal && !stackAll().length && !(S.cb && S.cb.step === 'atk')) nextAction(); }); await sleep(200); }
    await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Test Ogre'); const kim = players().find(p => p.nm === 'Kim'); UI.atkSel = {[c.id]:'p:' + kim.pid}; renderCombatPanel(); });
    const t0 = Date.now(); await A.click('#cbpanel [data-act="atkGo"]');
    const shown = await H.waitFor(A, () => document.querySelectorAll('#trToasts .trT').length > 0, null, 3000);
    H.check(shown, `Live: a toast appeared ${Date.now() - t0} ms after the flagged attack`);
    const blocking = await A.evaluate(() => { const t = document.querySelector('#trToasts .trT'); if (!t) return 'none'; const r = t.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return getComputedStyle(t).pointerEvents + '|' + (el && el.closest('#trToasts') ? 'toast' : (el ? el.tagName : 'nothing')); });
    H.check(/^none\|(?!toast)/.test(blocking), `Live: the toast lets clicks through to the table (${blocking})`);
    const txt = await A.evaluate(() => document.querySelector('#trToasts .trT')?.textContent || '');
    H.check(/Mistake|Inaccuracy/.test(txt) && /Test Brute/.test(txt), `Live: the toast explains it ("${txt.slice(0, 120)}")`);
    // play goes on underneath: Kim declares no blocks and combat finishes while the toast is up
    for (let i = 0; i < 60 && !(await A.evaluate(() => phaseNow().ph === 5)); i++){ for (const p of [B, C]) await p.evaluate(`(${DRIVE})(null)`); await A.evaluate(() => { if (myBox()) doPass(); }); await sleep(150); }
    H.check(await A.evaluate(() => phaseNow().ph === 5), 'Live: combat finished while the toast was showing');
    await A.click('#phasebar [data-act="next"]').catch(() => {}); await sleep(300);
    await A.evaluate(() => trSetMode('quiet')); await nextTurn();
  }, 120000);
  // ---------------- Quiet mode: an end-of-turn summary
  await scen('Quiet mode: a summary at the end of the turn', async () => {
    await A.evaluate(() => { document.getElementById('trToasts').innerHTML = ''; });
    await setup(A, {bf:['Plains', 'Plains'], hand:['Island']}); await A.evaluate(() => endTurnFlow()); await sleep(800);
    const t = await A.evaluate(() => [...document.querySelectorAll('#trToasts .trT')].map(x => x.textContent));
    H.check(t.some(x => /^Trainer\s*Turn \d+: 1 mistake\. You ended your turn without playing a land/.test(x)), `Quiet: end-of-turn summary (${JSON.stringify(t).slice(0, 160)})`);
    if (!(await drive(A))) throw new Error('no next turn');
  });

  // ---------------- the last scenario ends the game: not blocking lethal → Review opens with the timeline
  await scen('not blocking when lethal is coming (blunder) — and the game ends', async () => {
    await A.evaluate(() => trSetMode('review'));
    await toOpp(B); await setup(A, {bf:['Test Wall'], life:5}); await setup(B, {bf:['Test Ogre', 'Test Ogre']}); await sleep(600); const m = await mark();
    await oppAttack(B, ['Test Ogre']); await block([]);
    const g = await since(m); expect('no blocks against 6 damage at 5 life (a Wall could block)', g, 'no_block');
    H.check(g.finds.some(f => f.cat === 'no_block' && f.sev === 'blunder' && /Test Wall/.test(f.better)), 'the better line names the block that saves you');
    for (let i = 0; i < 60 && !(await A.evaluate(() => !!(TR.g && TR.g.done))); i++){ for (const p of [B, C]) await p.evaluate(`(${DRIVE})(null)`); await A.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); }
  }, 120000);
  await step('Review: the timeline after the game', 30000, async () => {
    const r = await A.evaluate(() => ({done:!!(TR.g && TR.g.done), result:TR.g && TR.g.result, open:!document.getElementById('trPanel').hidden, tab:TR.tab, rows:document.querySelectorAll('#trTimeline .trd').length, flagged:document.querySelectorAll('#trTimeline .trf').length, recs:TR.g.recs.length, score:trScore(TR.g)}));
    H.check(r.done && r.result === 'lost', `the game ended for Georges (${r.result}) and was finished in the trainer`);
    H.check(r.open && r.tab === 'review', 'Review mode opened the panel on the Review tab when the game ended');
    H.check(r.rows >= 30 && r.flagged >= 12, `Review: timeline shows ${r.rows} decisions with ${r.flagged} flags (score ${r.score}%)`);
    await A.selectOption('#trFilter', 'flagged'); await sleep(200);
    const f = await A.evaluate(() => [...document.querySelectorAll('#trTimeline .trd')].every(d => d.querySelector('.trf')) && document.querySelectorAll('#trTimeline .trd').length);
    H.check(f > 0, `Review: the "Flagged only" filter shows only flagged decisions (${f})`);
    await A.selectOption('#trFilter', 'blunder'); await sleep(200);
    const bl = await A.evaluate(() => [...document.querySelectorAll('#trTimeline .trf .sev')].map(x => x.textContent));
    H.check(bl.length && bl.includes('Blunder'), `Review: severity filter (${bl.length} entries incl. blunders)`);
    const adv = await A.evaluate(() => TR.g.recs.filter(r => r.adv && r.adv.move).length);
    H.check(adv >= 10, `the advice level's move is recorded next to ${adv} decisions`);
    await A.screenshot({path:path.join(__dirname, 'shot-trainer-review.png')});
    await A.click('#trPanel [data-act="trTab"][data-t="coach"]'); await sleep(200);
    await A.screenshot({path:path.join(__dirname, 'shot-trainer-coach.png')});
  });
  await step('summary, hidden information and performance on the human page', 30000, async () => {
    const mk = RES.mistake.filter(x => x.ok).map(x => x.cat); const cats = [...new Set(mk)];
    H.check(cats.length >= 12, `${cats.length} different mistake types flagged in real play: ${cats.join(', ')}`);
    H.check(RES.clean.length >= 10 && RES.clean.every(x => x.ok), `${RES.clean.filter(x => x.ok).length} of ${RES.clean.length} clean scenarios produced no flags`);
    const d = await A.evaluate(() => ({peeks:TR.peeks.slice(), errs:TR.errs.slice(), perf:TR.perf, pub:JSON.stringify(publicState())}));
    H.check(!d.peeks.length, `runtime trap: the trainer never looked into a bot window or other saved data (${JSON.stringify(d.peeks).slice(0, 120)})`);
    H.check(!d.errs.length, `the trainer made no internal errors${d.errs.length ? ': ' + d.errs[0].slice(0, 200) : ''}`);
    H.check(!/trainer|Blunder|Mistake|accuracy/i.test(d.pub), 'nothing about the trainer is in the state published to other players');
    const avg = d.perf.ms / Math.max(1, d.perf.n);
    H.check(avg < 25 && d.perf.max < 400, `cost per judged action: ${avg.toFixed(1)} ms average, ${d.perf.max.toFixed(0)} ms max over ${d.perf.n} calls`);
    const rec = await A.evaluate(() => trCoachRecord(TR.g));
    const opp0 = rec.decisions.find(x => x.saw && x.saw.opponents && x.saw.opponents.length)?.saw.opponents[0] || {};
    H.check(rec.format === 'proxy-table/decisions@1' && rec.decisions.length > 30 && typeof opp0.hand === 'number' && !/Kim|Lee/.test(JSON.stringify(rec)) && !/trn-/.test(JSON.stringify(rec)),
      `stage-3 decision record: ${rec.decisions.length} decisions, opponents anonymised, opponents' hands as counts only (keys: ${Object.keys(opp0).join(', ')})`);
    fs.writeFileSync('/tmp/trainer-record-sample.json', JSON.stringify({...rec, decisions:rec.decisions.filter(x => x.flags.length).slice(0, 4)}, null, 1));
    // the other players' pages never got the trainer's data
    // Georges's findings that name Kim / Lee could only be on Kim's / Lee's page if trainer data travelled; his game id likewise
    const mine = await A.evaluate(() => ({id:TR.g.id, msgs:TR.g.finds.map(f => f.msg)}));
    const others = await Promise.all([[B, 'Kim'], [C, 'Lee']].map(([p, nm]) => p.evaluate(([d, nm]) => { const all = JSON.stringify([TR.g, TR.last, TR.prof, localStorage.getItem('pt.trainer'), localStorage.getItem('pt.trainer.cur')]); return (all.includes(d.id) ? 1 : 0) + d.msgs.filter(m => m.includes(nm) && all.includes(m)).length; }, [mine, nm])));
    H.check(others.every(n => n === 0), `the other players' pages hold none of Georges's trainer data (${others.join(', ')} matches; ${mine.msgs.length} findings checked)`);
  });
}

async function profile(browser){
  console.log('\n== the coaching profile: persists across a reload; the Coach tab picks the top weaknesses');
  const ctx = await browser.newContext({viewport:{width:1400, height:900}}); const page = await ctx.newPage();
  await ctx.addInitScript(port => { window.PT_BROKERS = ['ws://localhost:' + port]; }, H.PORT); await H.route(page);
  page.on('pageerror', e => H.check(false, 'profile page error: ' + e.message));
  await page.goto(H.FILE);
  await step('a real finished game is saved, and survives a reload', 60000, async () => {
    // play a short goldfish game: a few land drops (one missed), then a new game finishes it
    await page.fill('#deckIn', DECK_A); await page.click('#loadBtn'); await page.waitForFunction(() => /Deck ready/.test(document.querySelector('#deckStatus').textContent), null, {timeout:20000});
    await page.fill('#nameIn', 'Georges'); await page.click('#soloBtn').catch(async () => { await page.evaluate(() => sitDown('solo')); });
    await page.waitForSelector('#game:not([hidden])', {timeout:10000}).catch(() => {});
    if (await page.evaluate(() => $('#game').hidden)) await page.evaluate(() => sitDown('solo'));
    await page.evaluate(AUTO); await page.evaluate(() => trSetMode('quiet'));
    await page.click('[data-act="goFirst"]'); await sleep(800);
    for (let t = 0; t < 6; t++){
      await page.evaluate(() => { for (let i = 0; i < 20 && !(phaseNow().mine && phaseNow().ph === 3 && S.untapN === phaseNow().n); i++){ if (S.untapN < phaseNow().n) startMyTurn(); else nextAction(); } });
      await sleep(200);
      await page.evaluate(t => { const l = S.hand.find(c => isLand(c.k)) || S.lib.find(c => isLand(c.k)); if (t !== 2 && l){ if (!S.hand.includes(l)){ S.lib.splice(S.lib.indexOf(l), 1); S.hand.push(l); } playLand(l); } if (t === 2 && !S.hand.some(c => isLand(c.k))){ const x = S.lib.find(c => isLand(c.k)); S.lib.splice(S.lib.indexOf(x), 1); S.hand.push(x); } S.hand.filter(c => !isLand(c.k)).forEach(c => { S.hand.splice(S.hand.indexOf(c), 1); S.lib.push(c); }); S.bf.forEach(c => { c.tap = true; }); commit(); }, t);
      await page.evaluate(() => endTurnFlow()); await sleep(400);
      await page.evaluate(() => { for (let i = 0; i < 10 && phaseNow().mine && phaseNow().ph >= 6; i++) nextAction(); }); await sleep(300);
    }
    const before = await page.evaluate(() => ({id:TR.g.id, recs:TR.g.recs.length, land:TR.g.finds.filter(f => f.cat === 'land_drop').length}));
    H.check(before.recs >= 6 && before.land >= 1, `goldfish game recorded (${before.recs} decisions, ${before.land} missed land drop)`);
    await page.evaluate(() => ACT.restart());   // "New game, same deck": the old game is finished and saved
    await sleep(500);
    const saved = await page.evaluate(id => TR.prof.games.some(g => g.id === id && (g.cats || {}).land_drop), before.id);
    H.check(saved, 'the finished game is in the profile with its mistake categories');
    await page.reload(); await sleep(1500);
    const after = await page.evaluate(id => ({has:TR.prof.games.some(g => g.id === id && (g.cats || {}).land_drop), mode:TR.mode, last:!!(TR.last && TR.last.recs.length)}), before.id);
    H.check(after.has && after.last, `after a reload the profile still has that game (and its timeline for Review) — mode ${after.mode}`);
  });
  await step('the Coach tab: top 3 weaknesses, lessons, focus and progress', 40000, async () => {
    // ten earlier games: missed land drops went from 4 of 5 games to 1 of 5; recent games show attack / crack-back mistakes
    await page.evaluate(() => {
      const G = (cats, acc) => ({id:rid(6), at:Date.now(), acc, n:40, turns:10, np:4, fmt:'cmd', result:'lost', cats, sev:{}});
      TR.prof.games = [G({land_drop:2, unused_mana:1}, 61), G({land_drop:1}, 66), G({land_drop:1, unused_mana:2}, 64), G({unused_mana:1}, 70), G({land_drop:3}, 58),
        G({bad_attack:2}, 72), G({bad_attack:1, crack_back:1}, 75), G({land_drop:1, bad_attack:1}, 77), G({crack_back:1, bad_attack:2}, 74), G({crack_back:1}, 80)];
      trSaveProf(); });
    await page.reload(); await sleep(1500);
    await page.evaluate(() => { TR.tab = 'coach'; trOpen(true); }); await sleep(200);
    const c = await page.evaluate(() => { const x = trCoach(); return {stage:x.stage, top:x.weak.map(t => t.cat), focus:x.focus, html:document.getElementById('trPanel').innerText}; });
    H.check(JSON.stringify(c.top) === JSON.stringify(['bad_attack', 'crack_back', 'land_drop']), `Coach: top 3 weaknesses ${JSON.stringify(c.top)}`);
    H.check(c.stage === 3 && /Decision-making/.test(c.html), `Coach: the basics improved, so lessons moved on to decision-making (stage ${c.stage})`);
    H.check(/4 of 5 earlier games → 1 of 5 recent games/.test(c.html), 'Coach: progress for missed land drops reads "4 of 5 earlier games → 1 of 5 recent games"');
    H.check(/Focus for your next game/.test(c.html) && c.focus.length > 20, `Coach: a focus for the next game ("${c.focus.slice(0, 80)}")`);
    // a beginner profile stays on basics
    const b = await page.evaluate(() => { const keep = TR.prof.games; TR.prof.games = Array.from({length:4}, () => ({id:rid(4), acc:60, n:30, cats:{land_drop:1, bad_attack:1}})); const x = trCoach(); TR.prof.games = keep; return {stage:x.stage, top:x.weak.map(t => t.cat)}; });
    H.check(b.stage === 1 && b.top[0] === 'land_drop', `Coach: a player still missing land drops is coached on basics first (${JSON.stringify(b)})`);
    const ex = await page.evaluate(() => { const d = trExport(); return {games:d.profile.games.length, fmt:d.lastGame && d.lastGame.format}; });
    H.check(ex.games === 10 && ex.fmt === 'proxy-table/decisions@1', `Export: profile + the last game's decision record (${JSON.stringify(ex)})`);
    await page.click('#trPanel [data-act="trReset"]'); await page.click('#trPanel [data-act="trReset"]'); await sleep(200);
    await page.reload(); await sleep(1200);
    H.check(await page.evaluate(() => TR.prof.games.length === 0 && !TR.last), 'Reset (two clicks) erases the profile, also after a reload');
  });
  await ctx.close();
}

async function hidden(){
  console.log('\n== hidden information (structural)');
  const src = fs.readFileSync(path.join(__dirname, '../src/trainer.js'), 'utf8');
  let code = src.replace(/\/\* ---- trap:[\s\S]*?\/\* ---- end trap ---- \*\//, '').replace(/\/\* ---- storage[\s\S]*?\/\* ---- end storage ---- \*\//, '');
  code = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const FORBID = [[/\bparent\b/, 'window.parent'], [/(?<![.\w-])top\b(?!:)/, 'window.top'], [/\bframes\b/, 'frames'], [/\bopener\b/, 'opener'], [/contentWindow|contentDocument/, 'a bot frame'],
    [/localStorage|sessionStorage|indexedDB|store\.get/, 'storage outside the trainer\'s own keys'], [/postMessage|BroadcastChannel|mqPublish|sendRq/, 'messaging'], [/BOTHOST|PTLOOP|\.cfg\.deck\b/, 'the host / the bots'],
    [/S\.lib\s*\[|S\.lib\.(?!length)/, 'my library order'], [/\.(?:hand|lib)\b(?=[^\n]*\bOPP\b)|OPP\.get\([^)]*\)\s*\.\s*(?:hand|lib)\b/, "another player's hand or library"], [/\bpublish\s*\(/, 'publishing']];
  for (const [re, what] of FORBID){ const m = code.match(re); H.check(!m, `hidden info (structural): the trainer never touches ${what}${m ? ' — found "' + m[0] + '"' : ''}`); }
}

async function bots(browser){
  console.log('\n== vs bots: the trainer in Live mode on the human page; bots run nothing of it');
  const ctx = await browser.newContext({viewport:{width:1400, height:900}}); const page = await ctx.newPage(); page.__errs = [];
  await ctx.addInitScript(port => { window.PT_BROKERS = ['ws://localhost:' + port]; }, H.PORT); await H.route(page);
  page.on('pageerror', e => { page.__errs.push(e.message); console.log('  [pageerror]', e.message); });
  await page.goto(H.FILE);
  await step('a 3-player offline game vs two Intermediate bots, Georges plays with a simple script', 300000, async () => {
    await page.fill('#deckIn', DECK_A); await page.click('#loadBtn'); await page.waitForFunction(() => /Deck ready/.test(document.querySelector('#deckStatus').textContent), null, {timeout:20000});
    await page.evaluate(() => saveDeck()); await page.fill('#nameIn', 'Georges');
    await page.evaluate(() => { lobbyPage('play'); trSetMode('live'); });
    H.check(await page.evaluate(() => !!document.querySelector('#botPanel #trLobbyMode') && document.querySelector('#trLobbyMode').value === 'live'), 'the bots lobby has the trainer mode selector');
    await page.evaluate(() => botsStartGame([{level:'intermediate', deck:'mine', name:'Bot A', speed:0}, {level:'intermediate', deck:'mine', name:'Bot B', speed:0}]));
    await page.waitForFunction(() => BOTHOST.bots.length === 2 && BOTHOST.bots.every(b => b.st && b.st.kept) && OPP.size === 2, null, {timeout:90000});
    await page.evaluate(AUTO); await page.click('[data-act="goFirst"]');
    // the "human": plays a land, casts the first castable thing, attacks with everything at the first opponent, never blocks
    const HUMAN = () => { if (!S || UI.modal || UI.casting) return; const pn = phaseNow();
      if (myBox()){ doPass(); return; }
      if (!pn.mine){ const cb = cbOf(pn); if (cb && cb.step === 'blk' && attackersOnMe(pn).length && (S.bd || '') !== cbKey(pn, cb)){ UI.blkSel = {}; confirmBlocks(false); } return; }
      if (stackAll().length) return; if (S.untapN < pn.n){ startMyTurn(); return; }
      if (pn.ph === 4 && S.cb && S.cb.step === 'atk'){ const o = defOpts().find(x => x.key.startsWith('p:')); UI.atkSel = {}; if (o) S.bf.forEach(c => { if (!canAttack(c)) UI.atkSel[c.id] = o.key; }); declareAttackers(); return; }
      if (pn.ph === 3 && !(S.landT && S.landT[0] === turnStr())){ const l = S.hand.find(c => isLand(c.k) && castCheck(c, 'hand').ok); if (l){ playLand(l); return; } }
      if (pn.ph === 3 && !window.__castT){ const x = S.hand.find(c => !isLand(c.k) && castCheck(c, 'hand').ok); window.__castT = turnStr(); if (x){ beginCast(x, 'hand', {}); return; } }
      if (window.__castT !== turnStr()) window.__castT = null;
      nextAction(); };
    await page.evaluate(h => { window.__H = setInterval(new Function('(' + h + ')()'), 250); }, HUMAN.toString());
    const t0 = Date.now(); let turn = 0;
    while (Date.now() - t0 < 150000){ await sleep(2000); turn = await page.evaluate(() => currentTurn()[0]); if (turn >= 10 || await page.evaluate(() => !!S.lost)) break; }
    await page.evaluate(() => clearInterval(window.__H));
    const d = await page.evaluate(() => ({recs:TR.g ? TR.g.recs.length : 0, kinds:TR.g ? [...new Set(TR.g.recs.map(r => r.kind))] : [], finds:TR.g ? TR.g.finds.length : 0, errs:TR.errs.slice(), peeks:TR.peeks.slice(), perf:TR.perf, adv:TR.g ? TR.g.recs.filter(r => r.adv).length : 0}));
    console.log(`  ran to turn ${turn}; trainer: ${d.recs} decisions (${d.kinds.join(', ')}), ${d.finds} findings, advice on ${d.adv}`);
    H.check(d.recs >= 8 && d.kinds.includes('land') && d.kinds.includes('end') && d.kinds.includes('keep'), 'the trainer recorded the human\'s decisions in a game vs bots (' + d.kinds.join(', ') + ')');
    H.check(!d.errs.length && !page.__errs.length, `no trainer errors and no page errors${d.errs[0] ? ': ' + d.errs[0].slice(0, 160) : ''}${page.__errs[0] ? ' / ' + page.__errs[0] : ''}`);
    H.check(!d.peeks.length, 'runtime trap: no look into the bots\' windows while judging');
    const ctl = await page.evaluate(() => { const n0 = TR.peeks.length; TR.judging = true; try { void document.querySelector('iframe').contentWindow; localStorage.getItem('pt.save'); localStorage.getItem('pt.trainer'); } finally { TR.judging = false; } const n = TR.peeks.length - n0; TR.peeks.splice(n0); return n; });
    H.check(ctl === 2, `runtime trap: positive control — a deliberate peek into a bot frame and saved games is caught (${ctl} of 2; the trainer's own key is allowed)`);
    const lv = await page.evaluate(() => ({lv:trAdvLevel(), levels:[...new Set(TR.g.recs.filter(r => r.adv).map(r => r.adv.level))]}));
    console.log('  advice level: ' + JSON.stringify(lv));
    const avg = d.perf.ms / Math.max(1, d.perf.n); H.check(avg < 25, `cost per judged action vs bots: ${avg.toFixed(1)} ms average, ${d.perf.max.toFixed(0)} ms max`);
    const fr = page.frames().filter(f => /[?&]ptbot=/.test(f.url()) || f !== page.mainFrame());
    const bf = await Promise.all(fr.map(f => f.evaluate(() => ({bot:typeof BOTMODE !== 'undefined' && BOTMODE, g:!!TR.g, recs:TR.g ? TR.g.recs.length : 0})).catch(() => null)));
    H.check(bf.filter(Boolean).length === 2 && bf.filter(Boolean).every(x => x.bot && !x.g), `the bot frames run no trainer (${JSON.stringify(bf)})`);
  });
  await ctx.close();
}

(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch({headless:!process.env.HEADFUL});
  try {
    if (ONLY.includes('game')) await game(browser);
    if (ONLY.includes('profile')) await profile(browser);
    if (ONLY.includes('hidden')) await hidden();
    if (ONLY.includes('bots')) await bots(browser);
  } catch (e){ H.check(false, 'harness: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close();
  console.log(`\n${H.results.filter(r => r.startsWith('PASS')).length} passed, ${H.fails()} failed`);
  process.exit(H.fails() ? 1 : 0);
})();
