// v20 helper R (GAPS20 section R): Mindslaver — the controller activates the controlled player's non-mana activated abilities
// (tap ability with a target, loyalty +N and −X, equip, a sacrifice cost, a mana-cost ability, cycling from hand, scry);
// Kefka, Court Mage's late-discard top-up. Real 2-player games.
// PTPORT=19720 PTFILE=dev20R.html node r20c.js   (ONLY=<substring>)
process.env.TOP = '1';
const CC = require('./cards');
const X = (name, mana, cmc, type, text, p, t, extra) => ({object:'card', id:'id-x20c-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, mana_cost:mana, cmc, type_line:type, oracle_text:text,
  colors:[...new Set((mana.match(/[WUBRG]/g) || []))], color_identity:[...new Set((mana.match(/[WUBRG]/g) || []))], keywords:[], layout:'normal', set:'tst', collector_number:'20' + cmc, set_name:'Test', released_at:'2024-01-01', power:p, toughness:t, prices:{usd:'1'}, ...(extra || {})});
const EXTRA = [
  X('Mindslaver', '{6}', 6, 'Legendary Artifact', '{4}, {T}, Sacrifice Mindslaver: You control target player during that player\'s next turn. (You see all cards that player could see and make all decisions for the player.)'),
  X('Test Walker Alpha', '{2}{W}', 3, 'Legendary Planeswalker — Ajani', '+1: You gain 2 life.', undefined, undefined, {loyalty:'3'}),
  X('Test Walker Beta', '{2}{B}', 3, 'Legendary Planeswalker — Liliana', '−X: You gain X life.', undefined, undefined, {loyalty:'5'}),
  X('Test Splitter', '{1}', 1, 'Artifact — Equipment', 'Equipped creature gets +2/+0.\nEquip {1}'),
  X('Test Cycler', '{3}{U}', 4, 'Creature — Fish', 'Cycling {1}', '2', '2'),
];
const WANT = ['Royal Assassin', 'Viscera Seer', 'Mind Stone', 'Sol Ring', 'Kefka, Court Mage // Kefka, Ruler of Ruin', 'Lightning Bolt', 'Grizzly Bears', 'Shivan Dragon', 'Edgar Markov', 'Thalia, Guardian of Thraben', 'Island', 'Mountain', 'Swamp', 'Plains', 'Forest'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
CC.cards.push(...CC.topCards('top.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
CC.cards.push(...EXTRA.filter(c => !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, waitFor} = H;
const AUTO = () => { window.__titles = []; setInterval(() => { const m = UI.modal; if (!m || m.__done || window.__hold) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try { window.__titles.push(String(m.title || '') + (m.hint ? ' || ' + m.hint : ''));
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; let n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); if (window.__none) n = m.min || 0; const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ const ok = (m.cands || []).filter(x => x.ok); const pref = w ? ok.filter(x => w.test(x.nm)) : []; m.__done = 1; m.resolve((pref.length ? pref : ok).slice(0, 1)); closeModal(); }
    else if (m.type === 'zone' && m.onClose){ m.__done = 1; closeModal(); }
    else if (m.run){ m.__done = 1; m.run(window.__num != null ? window.__num : (m.def ?? 1)); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 100); };
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
let ALL = []; const RES = {};
const step = async (name, fn) => { if (process.env.ONLY && !process.env.ONLY.split(',').some(o => name.includes(o))) return; console.log('— ' + name); const f0 = H.fails();
  try { await T(240000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  RES[name] = H.fails() === f0;
  if (H.fails() > f0 || process.env.LOGS) for (const [nm, p] of ALL) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-22).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})).catch(e => e.message))); };
const passAll = async (ps) => { for (let i = 0; i < 5; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(150); } };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const dictK = (nm) => [...DICT.values()].find(a => a.n === nm || String(a.n).startsWith(nm + ' //'));
const putBf = (p, nm, extra) => p.evaluate(([nm, extra]) => { const a = [...DICT.values()].find(a => a.n === nm || String(a.n).startsWith(nm + ' //')); if (!a) return null; const c = {id:S.nid++, k:a.k, x:20 + (S.nid % 30) * 3, y:30, sk:false, ...(extra || {})}; S.bf.push(c); if (/Planeswalker/.test(a.t || '') && !c.co){ c.pw = 1; c.co = parseInt(String(a.p || '').replace(/^L/, ''), 10) || 3; } commit(); return c.id; }, [nm, extra]);
const toZone = (p, nm, z) => p.evaluate(([nm, z]) => { const a = [...DICT.values()].find(a => a.n === nm || String(a.n).startsWith(nm + ' //')); if (!a) return null; const c = {id:S.nid++, k:a.k}; S[z].push(c); commit(); return c.id; }, [nm, z]);
const FULL = {W:9, U:9, B:9, R:9, G:9, C:9};
const titles = p => p.evaluate(() => (window.__titles || []).slice());
const clrTitles = ps => Promise.all(ps.map(p => p.evaluate(() => { window.__titles = []; })));
const set = (p, o) => p.evaluate(o => { for (const [k, v] of Object.entries(o)) window[k] = v; }, o);
const life = p => p.evaluate(() => S.life);
const names = (p, z) => p.evaluate(z => S[z].map(cname), z);

(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    const G = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r20c');
    const K = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r20c');
    ALL = [['Georges', G], ['Kim', K]]; const P2 = [G, K];
    await waitFor(G, () => OPP.size === 1, null, 20000); await G.evaluate(AUTO); await K.evaluate(AUTO);
    await G.click('[data-act="goFirst"]'); await settle(P2);
    const GP = await G.evaluate(() => MYPID), KP = await K.evaluate(() => MYPID);
    const toMain = async (p) => { for (let i = 0; i < 60; i++){ if (await p.evaluate(() => phaseNow().mine && phaseNow().ph === 3 && !stackAll().length)) return true; await p.evaluate(() => { if (!stackAll().length && !UI.modal && phaseNow().mine) nextAction(); }); await passAll(P2); } return false; };
    await toMain(G);
    const after = async () => { await sleep(300); await settle(P2); await sleep(900); await settle(P2); await sleep(400); };
    const wipe = async () => { for (const p of P2) await p.evaluate(() => { UI.modal = null; window.__want = null; window.__none = false; window.__num = null; S.bf = []; S.lent = []; S.hand = []; S.gy = []; S.ex = []; S.stk = []; S.prm = []; S.pool = emptyPool(); commit(); }); await sleep(900); };
    const fresh = async () => { await wipe(); if (!(await G.evaluate(() => phaseNow().mine))){ await K.evaluate(() => { S.stk = []; passTurn(); }); await sleep(1200); } await toMain(G); await wipe(); await clrTitles(P2); };
    // the controller's panel: click the ability button whose text matches re
    const abBtn = (re) => G.evaluate(re => { const b = [...document.querySelectorAll('#o19slv [data-r20act]')].find(x => new RegExp(re, 'i').test(x.textContent)); if (!b) return 'missing: ' + [...document.querySelectorAll('#o19slv [data-r20act]')].map(x => x.textContent).join(' / '); if (b.disabled) return 'disabled: ' + b.textContent; b.click(); return 'ok'; }, re);
    const waitBtn = (re, ms = 8000) => G.waitForFunction(re => [...document.querySelectorAll('#o19slv [data-r20act]')].some(x => new RegExp(re, 'i').test(x.textContent) && !x.disabled), re, {timeout:ms}).then(() => true).catch(() => false);
    const kimLands = () => K.evaluate(() => S.bf.filter(c => isLand(c.k) && c.tap).length);

    // ================================================================= 1. Mindslaver: the controller activates Kim's abilities
    await step("Mindslaver: Georges activates Kim's tap, loyalty (+1 and −X), equip, sacrifice-cost, mana-cost and cycling abilities; Kim pays, Georges chooses", async () => {
      await fresh(); await putBf(G, 'Mindslaver'); await putBf(G, 'Shivan Dragon', {tap:true});
      for (const n of ['Swamp', 'Swamp', 'Mountain', 'Mountain', 'Island', 'Island']) await putBf(K, n);
      for (const n of ['Royal Assassin', 'Test Walker Alpha', 'Test Walker Beta', 'Test Splitter', 'Grizzly Bears', 'Viscera Seer', 'Mind Stone']) await putBf(K, n);
      await toZone(K, 'Test Cycler', 'hand');
      await K.evaluate(() => { for (let i = 0; i < 6; i++) S.lib.unshift({id:S.nid++, k:[...DICT.values()].find(a => a.n === 'Island').k}); commit(); });
      await sleep(800);
      await set(G, {__want:'Kim'});
      const r = await G.evaluate(async (FULL) => { const c = S.bf.find(x => cname(x) === 'Mindslaver'); S.pool = {...emptyPool(), ...FULL}; const ab = abilityList(c).find(a => /control target player/i.test(a.eff)); if (!ab) return 'no ability'; await activateAbility(c, ab); return 'ok'; }, FULL);
      check(r === 'ok', `Mindslaver activated (${r})`); await after(); await set(G, {__want:null});
      await G.evaluate(() => { S.stk = []; passTurn(); }); await sleep(2000); await settle(P2); await sleep(1500);
      const on = await waitFor(G, () => !!document.getElementById('o19slv'), null, 15000); check(on, 'Georges sees the control panel on Kim\'s turn');
      for (let i = 0; i < 14 && !(await K.evaluate(() => phaseNow().ph === 3)); i++){ await G.click('#o19slv [data-o19slv="next"]').catch(() => {}); await sleep(500); await passAll(P2); }
      check(await K.evaluate(() => phaseNow().mine && phaseNow().ph === 3), "Georges moved Kim's turn to her main phase");
      await waitBtn('Royal Assassin', 10000);
      const panel = await G.evaluate(() => [...document.querySelectorAll('#o19slv [data-r20act]')].map(x => x.textContent.replace(/\s+/g, ' ').trim()));
      console.log('   panel abilities:', JSON.stringify(panel));
      for (const re of ['Royal Assassin.*Destroy target tapped creature', 'Test Walker Alpha.*\\+1.*gain 2 life', 'Test Walker Beta.*X.*gain X life', 'Test Splitter.*Attach', 'Viscera Seer.*Sacrifice a creature.*Scry 1', 'Mind Stone.*Draw a card', 'Test Cycler.*Cycling'])
        check(panel.some(t => new RegExp(re, 'i').test(t)), `the panel lists ${re.split('.*')[0]} (${re.split('.*').slice(1).join(' … ')})`);
      check(!panel.some(t => /Add \{C\}/.test(t)), 'mana abilities are not listed (costs are paid automatically)');
      // Kim can't use them herself
      const self = await K.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Test Walker Alpha'); const co = c.co; await activateLoyalty(c, 0); const a = S.bf.find(x => cname(x) === 'Royal Assassin'); await activateAbility(a, abilityList(a)[0]); await sleep(200); return c.co === co && !a.tap && !S.stk.length; });
      check(self, 'Kim could not activate her loyalty or tap abilities herself');
      await clrTitles(P2);
      // a. tap ability with a target: Royal Assassin destroys Georges's tapped Shivan Dragon — target chosen by Georges
      await set(G, {__want:'Shivan'}); check(await abBtn('Royal Assassin') === 'ok', 'clicked Royal Assassin'); await after();
      check(await K.evaluate(() => S.bf.find(x => cname(x) === 'Royal Assassin').tap), "Kim's Royal Assassin is tapped (its {T} cost was paid by Kim)");
      check((await names(G, 'gy')).includes('Shivan Dragon'), `Georges's tapped Shivan Dragon was destroyed (gy: ${await names(G, 'gy')})`);
      // b. loyalty +1
      const l0 = await life(K); await waitBtn('Test Walker Alpha'); check(await abBtn('Test Walker Alpha') === 'ok', 'clicked Test Walker Alpha +1'); await after();
      const wa = await K.evaluate(() => S.bf.find(x => cname(x) === 'Test Walker Alpha').co);
      check(wa === 4 && await life(K) === l0 + 2, `Alpha +1: loyalty 3 → ${wa}, Kim gained 2 (${l0} → ${await life(K)})`);
      // c. loyalty −X: X is chosen by Georges
      await set(G, {__num:3}); const l1 = await life(K); await waitBtn('Test Walker Beta'); check(await abBtn('Test Walker Beta') === 'ok', 'clicked Test Walker Beta −X'); await after(); await set(G, {__num:null});
      const wb = await K.evaluate(() => S.bf.find(x => cname(x) === 'Test Walker Beta').co);
      check(wb === 2 && await life(K) === l1 + 3, `Beta −X with X = 3 chosen by Georges: loyalty 5 → ${wb}, Kim gained 3 (${l1} → ${await life(K)})`);
      // d. equip {1}: paid from Kim's lands, attached to the creature Georges chose
      const t0 = await kimLands(); await set(G, {__want:'Grizzly'}); await waitBtn('Test Splitter'); check(await abBtn('Test Splitter') === 'ok', 'clicked Test Splitter equip'); await after();
      const eq = await K.evaluate(() => { const e = S.bf.find(x => cname(x) === 'Test Splitter'); const b = S.bf.find(x => cname(x) === 'Grizzly Bears'); return {att:e.att && e.att.id === b.id, p:stats(b)[0]}; });
      check(eq.att && eq.p === 4, `Test Splitter is attached to Kim's Grizzly Bears (4 power): ${JSON.stringify(eq)}`);
      check(await kimLands() === t0 + 1, `equip {1} was paid with one of Kim's lands (${t0} → ${await kimLands()} tapped)`);
      // e. sacrifice cost: Georges chooses which of Kim's creatures, then the scry
      await set(G, {__want:'Royal Assassin'}); await waitBtn('Viscera Seer'); check(await abBtn('Viscera Seer') === 'ok', 'clicked Viscera Seer'); await after();
      check((await names(K, 'gy')).includes('Royal Assassin'), `the creature Georges chose (Royal Assassin) was sacrificed (Kim gy: ${await names(K, 'gy')})`);
      // f. mana-cost ability: Mind Stone {1}, {T}, sacrifice: draw — Kim pays and draws
      const h0 = await K.evaluate(() => S.hand.length), t1 = await kimLands(); await set(G, {__want:null}); await waitBtn('Mind Stone'); check(await abBtn('Mind Stone') === 'ok', 'clicked Mind Stone'); await after();
      check((await names(K, 'gy')).includes('Mind Stone') && await K.evaluate(() => S.hand.length) === h0 + 1 && await kimLands() === t1 + 1, `Mind Stone: sacrificed, Kim drew a card, {1} came from her land (hand ${h0} → ${await K.evaluate(() => S.hand.length)})`);
      // g. cycling from Kim's hand
      const t2 = await kimLands(); await waitBtn('Test Cycler'); check(await abBtn('Test Cycler') === 'ok', 'clicked Test Cycler cycling'); await after();
      check((await names(K, 'gy')).includes('Test Cycler') && await kimLands() === t2 + 1, `Test Cycler cycled from Kim's hand, {1} paid by Kim (gy: ${await names(K, 'gy')})`);
      const gt = await titles(G), kt = await titles(K);
      check(gt.filter(t => /controlling Kim/.test(t)).length >= 4, `the choices came to Georges (${JSON.stringify(gt.filter(t => /controlling Kim/.test(t)).map(t => t.slice(0, 70)))})`);
      check(!kt.length, `Kim was asked nothing (${JSON.stringify(kt)})`);
      // end Kim's turn from the panel
      await G.evaluate(() => { const b = document.querySelector('#o19slv [data-o19slv="end"]'); b && b.click(); }); await sleep(2500); await settle(P2);
      await K.evaluate(() => { S.stk = []; if (currentTurn()[1] === MYPID) passTurn(); }); await sleep(1800); await settle(P2); await toMain(G);
      check(!(await G.evaluate(() => !!document.getElementById('o19slv'))), "the panel is gone after Kim's turn");
      const after2 = await K.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Test Walker Alpha'); return !!c; }); void after2;
    });

    // ================================================================= 2. Kefka: the late discard tops up the draw
    const kefka = async (kimCards, kimPick) => {
      await fresh();
      await G.evaluate(() => { const a = [...DICT.values()].find(a => a.n === 'Sol Ring'); S.hand.push({id:S.nid++, k:a.k}); for (let i = 0; i < 8; i++) S.lib.unshift({id:S.nid++, k:[...DICT.values()].find(a => a.n === 'Island').k}); commit(); });
      for (const n of kimCards) await toZone(K, n, 'hand');
      await sleep(800); const h0 = await G.evaluate(() => S.hand.length);
      await G.evaluate(async (FULL) => { const a = [...DICT.values()].find(a => String(a.n).startsWith('Kefka, Court Mage')); const c = {id:S.nid++, k:a.k}; S.hand.push(c); S.pool = {...emptyPool(), ...FULL}; commit(); await beginCast(c, 'hand'); }, FULL);
      // Kim does not answer yet: the stack resolves without her
      await sleep(400); await settle(P2);
      const waiting = await waitFor(G, () => S.log.some(e => /Kefka.*waiting for Kim/.test(e.s)), null, 15000);
      const h1 = await G.evaluate(() => S.hand.length);
      check(waiting && h1 === h0, `Kefka resolved while Kim was still choosing; Georges drew 1 for his Artifact (hand ${h0} → ${h1}, Sol Ring discarded)`);
      const prm = await K.evaluate(() => S.prm.filter(p => p.type === 'discard').length); check(prm === 1, `Kim has her discard prompt on her own screen (${prm})`);
      await K.evaluate(re => { const p = S.prm.find(p => p.type === 'discard'); const c = S.hand.find(x => new RegExp(re).test(cname(x))); finishChoice(p, [c.id]); }, kimPick);
      await sleep(2500); await settle(P2); await sleep(800);
      return {h0, h1, h2:await G.evaluate(() => S.hand.length), log:await G.evaluate(() => S.log.slice(-8).map(e => e.s).filter(s => /Kefka/.test(s)))};
    };
    await step("Kefka, Court Mage: Kim discards late a card of a new type (Instant) → Georges draws one more", async () => {
      const r = await kefka(['Lightning Bolt', 'Grizzly Bears'], 'Lightning Bolt');
      check(r.h2 === r.h1 + 1, `one more card for the Instant (hand ${r.h1} → ${r.h2}) ${JSON.stringify(r.log)}`);
      check(r.log.some(s => /1 more card type.*Kim's discard.*drew 1/.test(s)), 'the log says why');
      check((await names(K, 'gy')).includes('Lightning Bolt'), 'Lightning Bolt is in Kim\'s graveyard');
    });
    await step("Kefka, Court Mage: Kim discards late a card of a type already counted (Artifact) → no extra draw", async () => {
      const r = await kefka(['Mind Stone', 'Grizzly Bears'], 'Mind Stone');
      check(r.h2 === r.h1, `no extra card (hand ${r.h1} → ${r.h2}) ${JSON.stringify(r.log)}`);
      check(r.log.some(s => /Kim discarded a card \(artifact\)/i.test(s)) && !r.log.some(s => /more card type/.test(s)), 'Kim\'s Artifact was counted once');
    });
  } catch (e){ console.log('FATAL', e); check(false, 'fatal: ' + e.message); }
  const tot = Object.keys(RES).length, okAll = Object.values(RES).filter(Boolean).length;
  console.log(`\nCASES: ${okAll}/${tot} passed`); for (const [k, v] of Object.entries(RES)) if (!v) console.log('   FAILED: ' + k);
  console.log(H.results.filter(r => r.startsWith('FAIL')).length + ' checks failed of ' + H.results.length);
  await browser.close(); process.exit(0);
})();
