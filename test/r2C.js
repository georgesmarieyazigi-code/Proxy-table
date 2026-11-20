process.env.TOP = '1';
// Round 21C functional test: tap real mana cards in a real 2-player game (one double-click = quick tap) and check the pool every time.
const CC = require('./cards');
const WANT = ['Command Tower', 'Arcane Signet', 'Mystic Gate', 'Gilded Lotus', 'Mana Vault', 'Lotus Petal', 'Chrome Mox', 'Cabal Ritual', 'Birds of Paradise', 'Selvala, Heart of the Wilds',
  'Nykthos, Shrine to Nyx', "Gaea's Cradle", 'Ancient Tomb', 'Cabal Coffers', 'Urborg, Tomb of Yawgmoth', 'Nyxbloom Ancient', 'Llanowar Elves', 'Pillar of Origins'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name)));
const H = require('./h'); const {check, sleep, give, put, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { window.__want = window.__want || null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.run){ m.__done = 1; const d = m.def ?? 1; m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (A, ps) => { for (let i = 0; i < 30; i++){ await passAll(ps); if (!(await A.evaluate(() => stackAll().length || UI.resolving))) return; await sleep(150); } };
let PA = null; const step = async (name, fn) => { console.log('— ' + name); const f0 = H.fails(); try { await fn(); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); } if (H.fails() > f0 && PA) console.log('    LOG:', (await PA.evaluate(() => S.log.slice(-8).map(e => e.s).join(' | ')))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2C');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2C');
  PA = A; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle(A, [B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  await A.evaluate(() => { window.__modals = []; const om = openModal; openModal = m => { window.__modals.push(m.title || m.type); return om(m); }; });
  const pool = () => A.evaluate(() => { const p = S.pool; return ['W', 'U', 'B', 'R', 'G', 'C'].map(x => x.repeat(p[x] || 0)).join(''); });
  const fresh = async (pl = {}) => { await A.evaluate(pl => { S.pool = {...emptyPool(), ...pl}; S.bf.forEach(c => { c.tap = false; c.tn = 0; c.sk = false; }); window.__modals = []; closeMenu(); commit(); }, pl); await sleep(250); };
  const onBf = async name => { await put(A, name); await A.evaluate(n => { const c = S.bf.find(x => cname(x) === n); if (c){ c.sk = false; c.tap = false; } commit(); }, name); await sleep(300); return A.evaluate(n => S.bf.find(x => cname(x) === n)?.id, name); };
  const dbl = async id => { for (let i = 0; i < 40; i++){ const busy = await A.evaluate(() => !!(stackAll().length || UI.modal)); if (!busy) break; await A.evaluate(() => { try { if (UI.modal && UI.modal.resolve){ UI.modal.resolve(null); closeModal(); } } catch {} }); await sleep(250); } await A.dblclick(`.card[data-id="${id}"]`); await sleep(400); };
  // click the quick-tap menu entry that adds exactly `want`
  const pickMenu = async want => { const ok = await A.evaluate(w => { const btns = [...document.querySelectorAll('#menu:not([hidden]) button[data-act="manaGo"]')]; const sort = s => s.split('').sort().join('');
      for (const b of btns){ const c = S.bf.find(x => x.id === +b.dataset.id); const ab = manaAbs(c)[+b.dataset.ab]; const o = ab && (ab.outs[+b.dataset.ch] || []); if (sort(o.join('')) === sort(w)){ b.click(); return true; } } return false; }, want); await sleep(400); return ok; };
  const menuCount = () => A.evaluate(() => document.querySelector('#menu:not([hidden])') ? document.querySelectorAll('#menu button[data-act="manaGo"]').length : 0);
  const modals = () => A.evaluate(() => window.__modals.slice());
  const castFromHand = async name => { await settle(A, [B]); await A.evaluate(() => { closeMenu(); if (UI.modal) closeModal(); }); await give(A, name); await sleep(300); const id = await A.evaluate(n => S.hand.find(c => cname(c) === n)?.id, name); await A.click(`.card[data-id="${id}"]`); await A.waitForSelector('#menu:not([hidden])'); await A.click('#menu button[data-act="cast"]'); await sleep(500); await settle(A, [B]); await sleep(400); };
  try {
    await step('Sol Ring: one double-click → {C}{C}, no prompt', async () => {
      const id = await onBf('Sol Ring'); await fresh(); await dbl(id);
      check(await pool() === 'CC', `pool ${await pool()}`); check(!(await modals()).length && !(await menuCount()), 'no prompt, no menu');
    });
    await step('Command Tower: menu offers only Edgar Markov\'s colours (R W B); pick {W}', async () => {
      const id = await onBf('Command Tower'); await fresh(); await dbl(id);
      const n = await menuCount(); check(n === 3, `3 colour choices (${n})`); check(await pickMenu('W'), 'clicked {W}'); check(await pool() === 'W', `pool ${await pool()}`);
    });
    await step('Arcane Signet: pick {B}', async () => {
      const id = await onBf('Arcane Signet'); await fresh(); await dbl(id); check(await menuCount() === 3, 'R/W/B only'); await pickMenu('B'); check(await pool() === 'B', `pool ${await pool()}`);
    });
    await step('Mystic Gate (filter land): {W/U},{T} with {W} in pool → {U}{U}', async () => {
      const id = await onBf('Mystic Gate'); await fresh(); await dbl(id); check(await pool() === 'C', 'empty pool: one click → {C}');
      await fresh({W:1}); await dbl(id);
      const n = await menuCount(); check(n === 4, `menu: {C}, {W}{W}, {W}{U}, {U}{U} (${n})`); check(await pickMenu('UU'), 'clicked {U}{U}'); check(await pool() === 'UU', `the {W} paid the filter, pool ${await pool()}`);
    });
    await step('Gilded Lotus: three mana of one colour → {G}{G}{G}', async () => {
      const id = await onBf('Gilded Lotus'); await fresh(); await dbl(id); check(await menuCount() === 5, 'five colour choices'); await pickMenu('GGG'); check(await pool() === 'GGG', `pool ${await pool()}`);
    });
    await step('Mana Vault: {C}{C}{C}, and it stays tapped in the untap step', async () => {
      const id = await onBf('Mana Vault'); await fresh(); await dbl(id); check(await pool() === 'CCC', `pool ${await pool()}`); check(!(await modals()).length, 'no prompt');
      const t = await A.evaluate(id => { untapAll(true); return S.bf.find(c => c.id === id).tap; }, id); check(t, 'Mana Vault does not untap');
    });
    await step('Lotus Petal: tap + sacrifice in one go → {R}, Petal in the graveyard', async () => {
      const id = await onBf('Lotus Petal'); await fresh(); await dbl(id); check(await menuCount() === 5, 'five colours'); await pickMenu('R');
      check(await pool() === 'R', `pool ${await pool()}`); check(await A.evaluate(() => S.gy.some(c => cname(c) === 'Lotus Petal')), 'Lotus Petal was sacrificed');
    });
    await step('Chrome Mox imprinting Lightning Bolt → {R} with no prompt', async () => {
      await give(A, 'Lightning Bolt'); await A.evaluate(() => { window.__want = 'Lightning Bolt'; });
      const id = await onBf('Chrome Mox'); await settle(A, [B]); await sleep(500); await A.evaluate(() => { window.__want = null; });
      check(await A.evaluate(id => info(S.bf.find(x => x.id === id).imp)?.n, id) === 'Lightning Bolt', 'the imprint trigger exiled Lightning Bolt');
      await fresh(); await dbl(id); check(await pool() === 'R', `pool ${await pool()}`); check(!(await menuCount()) && !(await modals()).length, 'one colour: no menu');
    });
    await step('Dark Ritual cast for {B} → {B}{B}{B}', async () => {
      await fresh({B:1}); await castFromHand('Dark Ritual'); check(await pool() === 'BBB', `pool ${await pool()}`);
    });
    await step('Cabal Ritual with 7 cards in the graveyard → {B}{B}{B}{B}{B}', async () => {
      await A.evaluate(() => { while (S.gy.length < 7) moveCard(S.lib[0].id, 'gy'); commit(); }); await fresh({B:1, C:1});
      await castFromHand('Cabal Ritual'); check(await pool() === 'BBBBB', `pool ${await pool()} (graveyard ${await A.evaluate(() => S.gy.length)})`);
    });
    await step('Birds of Paradise: pick {U}', async () => {
      const id = await onBf('Birds of Paradise'); await fresh(); await dbl(id); await pickMenu('U'); check(await pool() === 'U', `pool ${await pool()}`);
    });
    await step('Selvala: {G},{T} → X mana in any combination, X = greatest power', async () => {
      const id = await onBf('Selvala, Heart of the Wilds'); await onBf('Llanowar Elves'); await fresh({G:1});
      const x = await A.evaluate(() => Math.max(...S.bf.filter(c => isCreatureCard(c)).map(c => stats(c)[0])));
      await A.evaluate(() => { window.__want = 'red'; }); await dbl(id); await sleep(800); await A.evaluate(() => { window.__want = null; });
      check(await pool() === 'R'.repeat(x), `pool ${await pool()} (X = ${x})`); check((await modals()).length === 1, 'one colour question: ' + JSON.stringify(await modals()));
    });
    await step('Nykthos: {2},{T} → choose a colour → devotion to green in {G}', async () => {
      const id = await onBf('Nykthos, Shrine to Nyx'); await fresh({C:2});
      const dv = await A.evaluate(() => S.bf.reduce((a, b) => a + ((faceOf(b)?.m || '').match(/\{[^}]+\}/g) || []).filter(s => s.includes('G')).length, 0));
      await dbl(id); const n = await menuCount(); check(n >= 2, `menu has {C} and the devotion choices (${n})`); await pickMenu('G'.repeat(dv));
      check(await pool() === 'G'.repeat(dv), `pool ${await pool()} (devotion to green ${dv})`);
    });
    await step("Gaea's Cradle → {G} for each creature", async () => {
      const id = await onBf("Gaea's Cradle"); await fresh(); const n = await A.evaluate(() => S.bf.filter(c => isCreatureCard(c)).length); await dbl(id);
      check(await pool() === 'G'.repeat(n), `pool ${await pool()} (${n} creatures)`); check(!(await modals()).length && !(await menuCount()), 'no prompt');
    });
    await step('Ancient Tomb → {C}{C} and 2 damage', async () => {
      const id = await onBf('Ancient Tomb'); await fresh(); const l0 = await A.evaluate(() => S.life); await dbl(id);
      check(await pool() === 'CC', `pool ${await pool()}`); check(await A.evaluate(() => S.life) === l0 - 2, 'lost 2 life');
    });
    await step('Cabal Coffers + Urborg: {2},{T} → {B} for each land (all are Swamps)', async () => {
      await onBf('Urborg, Tomb of Yawgmoth'); const id = await onBf('Cabal Coffers'); await fresh({C:2}); const n = await A.evaluate(() => S.bf.filter(c => isLand(c.k)).length); await dbl(id);
      check(await pickMenu('B'.repeat(n)), 'menu: {B} (Urborg) or {2},{T}: {B} per Swamp'); check(await pool() === 'B'.repeat(n), `pool ${await pool()} (${n} lands)`);
    });
    await step('Nyxbloom Ancient: Sol Ring → six {C}; Gilded Lotus → nine of one colour', async () => {
      await onBf('Nyxbloom Ancient'); await fresh(); const sr = await A.evaluate(() => S.bf.find(c => cname(c) === 'Sol Ring').id); await dbl(sr);
      check(await pool() === 'CCCCCC', `Sol Ring: pool ${await pool()}`);
      await fresh(); const gl = await A.evaluate(() => S.bf.find(c => cname(c) === 'Gilded Lotus').id); await dbl(gl); await pickMenu('WWW'); check(await pool() === 'WWWWWWWWW', `Gilded Lotus: pool ${await pool()}`);
      await A.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Nyxbloom Ancient'); moveCard(c.id, 'gy'); commit(); });
    });
    await step('Pillar of Origins: its mana casts only a creature of the chosen type', async () => {
      const id = await onBf('Pillar of Origins'); await A.evaluate(id => { S.bf.find(c => c.id === id).ctype = 'Elf'; commit(); }, id); await fresh(); await dbl(id); await pickMenu('G');
      await give(A, 'Llanowar Elves'); await give(A, 'Test Census');
      const r = await A.evaluate(() => [castCheck(S.hand.find(c => cname(c) === 'Llanowar Elves'), 'hand').ok, castCheck(S.hand.find(c => cname(c) === 'Test Census'), 'hand').ok]);
      check(r[0] && !r[1], `Elf castable ${r[0]}, a {G} sorcery not castable ${r[1]}`);
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
