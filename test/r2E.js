process.env.TOP = '1';
// Round 21E: exile-and-cast other players' cards, copy / retarget spells, counter-unless paid on the other player's screen
const CC = require('./cards');
const WANT = ['Etali, Primal Conqueror // Etali, Primal Sickness', 'Divination', "Night's Whisper", 'Lightning Bolt', 'Twincast', 'Shock', 'Bolt Bend', 'Ragavan, Nimble Pilferer', 'Hostage Taker', 'Remand', 'Gonti, Lord of Luxury', 'Commandeer', 'Corrupted Conscience', 'Spellskite'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name)), ...CC.topCards('extra.json').filter(c => ['Force Spike'].includes(c.name)));
const H = require('./h'); const {check, sleep, put, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
// answer questions: cards/options matching window.__want (else the first legal one); targets matching window.__tgt
const AUTO = () => { window.__want = window.__want || null; window.__tgt = window.__tgt || null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ if (!window.__tgt) return; const re = new RegExp(window.__tgt, 'i'); const c = (m.cands || []).find(x => x.ok && re.test(x.nm)); if (!c) return; m.__done = 1; m.resolve([c]); closeModal(); }
    else if (m.run){ m.__done = 1; const d = m.def ?? 1; m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
// move a named card (from any zone) to the top of the library
const toTop = (p, names) => p.evaluate(ns => { const used = new Set(); for (const n of ns.slice().reverse()){ for (const z of ['lib', 'hand', 'gy', 'ex', 'bf']){ const i = S[z].findIndex(c => cname(c) === n && !used.has(c)); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.lib.unshift(c); used.add(c); break; } } } commit(); return S.lib.slice(0, ns.length).map(cname); }, names);
const toHand = (p, n) => p.evaluate(n => { for (const z of ['lib', 'gy', 'ex', 'bf']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.hand.push(c); commit(); return c.id; } } return S.hand.find(c => cname(c) === n)?.id; }, n);
const cast = (p, n) => p.evaluate(async n => { const c = S.hand.find(x => cname(x) === n); if (!c) return 'not in hand'; await beginCast(c, 'hand'); return S.hand.includes(c) ? 'not cast' : 'ok'; }, n);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { await fn(); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-12).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2e');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2e');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const life = p => p.evaluate(() => S.life);
  const zones = p => p.evaluate(() => ({gy:S.gy.map(cname), ex:S.ex.map(cname), hand:S.hand.length, lib:S.lib.length, bf:S.bf.map(cname), lent:S.lent.length, r21L:(S.r21L || []).length}));
  try {
    await step("Etali, Primal Conqueror enters: both players exile until a nonland card; Georges casts Kim's spell for free; it ends in Kim's graveyard", async () => {
      console.log('    Georges top:', await toTop(A, ['Island', "Night's Whisper"]), '| Kim top:', await toTop(B, ['Island', 'Island', 'Divination']));
      const a0 = await zones(A), b0 = await zones(B), lifeA0 = await life(A);
      await put(A, 'Etali, Primal Conqueror');
      await sleep(400); await settle([A, B]); await sleep(1500); await settle([A, B]); await sleep(800);
      const a1 = await zones(A), b1 = await zones(B);
      console.log('    Georges', JSON.stringify(a1), '\n    Kim', JSON.stringify(b1));
      check(b1.ex.filter(x => x === 'Island').length >= 2, "Kim's client exiled her lands from the top until a nonland card (Island, Island)");
      check(b1.gy.includes('Divination'), "Kim's Divination, cast by Georges, ended in KIM's graveyard");
      check(!b1.ex.includes('Divination'), "Kim's exiled original is gone from her exile (not duplicated)");
      check(!a1.gy.includes('Divination') && !a1.ex.includes('Divination') && !a1.hand.toString().includes('Divination'), 'Georges has no copy of Divination left anywhere');
      check(a1.gy.includes("Night's Whisper"), "Georges's own Night's Whisper was cast free and is in his graveyard");
      check(a1.hand - a0.hand === 4, `Georges drew 2 (Divination, under his control) + 2 (Night's Whisper): +${a1.hand - a0.hand}`);
      check(lifeA0 - await life(A) === 2, "Night's Whisper cost Georges 2 life");
      check(b1.hand === b0.hand, 'Kim drew nothing (Georges controlled her spell)');
      check(b1.lent === 0 && b1.r21L === 0, 'no lend left open on Kim\'s side');
    });
    await step('Copy target spell: Kim Bolts Georges, Georges Twincasts it at Kim', async () => {
      const la = await life(A), lb = await life(B);
      await toHand(B, 'Lightning Bolt'); await B.evaluate(() => { S.pool = {...emptyPool(), R:1}; window.__tgt = 'Georges'; commit(); });
      check(await cast(B, 'Lightning Bolt') === 'ok', 'Kim cast Lightning Bolt at Georges');
      await waitFor(A, () => stackAll().some(i => i.nm === 'Lightning Bolt'));
      await toHand(A, 'Twincast'); await A.evaluate(() => { S.pool = {...emptyPool(), U:2}; window.__tgt = 'Kim'; commit(); });
      check(await cast(A, 'Twincast') === 'ok', 'Georges cast Twincast targeting the Bolt');
      await settle([A, B]); await sleep(1200); await settle([A, B]);
      console.log('    life Georges', la, '→', await life(A), '| Kim', lb, '→', await life(B));
      check(la - await life(A) === 3, 'the original Bolt hit Georges for 3');
      check(lb - await life(B) === 3, 'the copy (new target) hit Kim for 3');
      await A.evaluate(() => { window.__tgt = null; }); await B.evaluate(() => { window.__tgt = null; });
    });
    await step('Change the target: Kim Shocks Georges, Georges Bolt Bends it onto Kim', async () => {
      const la = await life(A), lb = await life(B);
      await toHand(B, 'Shock'); await B.evaluate(() => { S.pool = {...emptyPool(), R:1}; window.__tgt = 'Georges'; commit(); });
      check(await cast(B, 'Shock') === 'ok', 'Kim cast Shock at Georges');
      await waitFor(A, () => stackAll().some(i => i.nm === 'Shock'));
      await toHand(A, 'Bolt Bend'); await A.evaluate(() => { S.pool = {...emptyPool(), R:4}; window.__tgt = 'Kim'; commit(); });
      check(await cast(A, 'Bolt Bend') === 'ok', 'Georges cast Bolt Bend on the Shock');
      await settle([A, B]); await sleep(1200); await settle([A, B]);
      console.log('    life Georges', la, '→', await life(A), '| Kim', lb, '→', await life(B));
      check(await life(A) === la, 'Georges took no damage');
      check(lb - await life(B) === 2, 'the Shock hit Kim instead (her own client changed its target)');
      await A.evaluate(() => { window.__tgt = null; }); await B.evaluate(() => { window.__tgt = null; });
    });
    await step("Force Spike: Kim pays {1} on her own screen", async () => {
      const la = await life(A);
      await toHand(B, 'Lightning Bolt'); await B.evaluate(() => { S.pool = {...emptyPool(), R:1, C:1}; window.__tgt = 'Georges'; commit(); });
      check(await cast(B, 'Lightning Bolt') === 'ok', 'Kim cast Lightning Bolt at Georges ({1} left floating)');
      await waitFor(A, () => stackAll().some(i => i.nm === 'Lightning Bolt'));
      await toHand(A, 'Force Spike'); await A.evaluate(() => { S.pool = {...emptyPool(), U:1}; commit(); });
      check(await cast(A, 'Force Spike') === 'ok', 'Georges cast Force Spike on it');
      await settle([A]); await sleep(300); await passAll([B]);
      const got = await waitFor(B, () => !!document.querySelector('#stackpanel [data-act="unlessPay"]'), null, 8000);
      check(got, "the pay-or-be-countered prompt appeared on KIM's screen");
      const onA = await A.evaluate(() => !!document.querySelector('#stackpanel [data-act="unlessPay"]'));
      check(!onA, "…and not on Georges's");
      if (got) await B.click('#stackpanel [data-act="unlessPay"]');
      await settle([A, B]); await sleep(1000); await settle([A, B]);
      check(la - await life(A) === 3, `Kim paid, so the Bolt resolved: Georges ${la} → ${await life(A)}`);
      check((await B.evaluate(() => S.pool.C || 0)) === 0, 'her floating {1} was spent');
      await B.evaluate(() => { window.__tgt = null; });
    });
    await step("Ragavan: Kim's top card is exiled for Georges, who casts it this turn; it goes to Kim's graveyard", async () => {
      await toTop(B, ['Divination']); await put(A, 'Ragavan, Nimble Pilferer');
      const kim = await B.evaluate(() => MYPID);
      await A.evaluate(async pid => { const c = S.bf.find(x => cname(x) === 'Ragavan, Nimble Pilferer'); const t = trigsOf(c.k).find(t => t.ev === 'cdmg'); pushTrigger({k:c.k, id:c.id}, t, {k:c.k, id:c.id, dp:pid}, MYPID); }, kim);
      await settle([A, B]); await sleep(1200);
      const ex = await A.evaluate(() => S.ex.filter(c => c.r21).map(c => [cname(c), !!c.mayPlay, exWindowOk(c)]));
      console.log('    Georges exile (lent):', JSON.stringify(ex));
      check(ex.some(x => x[0] === 'Divination' && x[2]), "Georges may cast Kim's Divination from his exile this turn");
      const r = await A.evaluate(async () => { const c = S.ex.find(x => x.r21 && cname(x) === 'Divination'); S.pool = {...emptyPool(), U:1, C:2}; await beginCast(c, 'ex'); return S.ex.includes(c) ? 'not cast' : 'ok'; });
      check(r === 'ok', 'Georges cast it, paying its cost');
      await settle([A, B]); await sleep(1200);
      const b1 = await zones(B);
      check(b1.gy.includes('Divination') && !b1.ex.includes('Divination'), "it went to Kim's graveyard, and her exile no longer has it");
    });
    await step("Hostage Taker: Kim's creature is exiled for Georges; he casts it with any mana; when it dies it goes to Kim's graveyard", async () => {
      const cr = await B.evaluate(() => { const c = S.lib.find(x => isCreatureCard(x) && !x.cmd && (info(x.k)?.mv || 0) >= 2 && !/Legendary/.test(info(x.k)?.t || '') && !/protection|ward|hexproof|shroud|copy|when .{0,40}enters|sacrifice/i.test(info(x.k)?.o || ''));   /* a plain creature Hostage Taker can legally take (pro-black / ward picks made the test random) */ return c && cname(c); });
      await put(B, cr); await sleep(800);
      await A.evaluate(n => { window.__tgt = n; }, cr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      await put(A, 'Hostage Taker'); await sleep(400); await settle([A, B]); await sleep(1500);
      const ex = await A.evaluate(() => S.ex.filter(c => c.r21).map(c => [cname(c), !!(c.mayPlay && c.mayPlay.adv), !!(c.mayPlay && c.mayPlay.any)]));
      console.log('    creature:', cr, '| Georges lent exile:', JSON.stringify(ex), '| Kim exile:', JSON.stringify((await zones(B)).ex));
      check(ex.some(x => x[0] === cr && x[1] && x[2]), `Georges may cast ${cr} for as long as it's exiled, with mana of any type`);
      check((await zones(B)).ex.includes(cr) && !(await zones(B)).bf.includes(cr), `${cr} left Kim's battlefield into her exile`);
      const r = await A.evaluate(async n => { const c = S.ex.find(x => x.r21 && cname(x) === n); S.pool = {...emptyPool(), C:(info(c.k)?.mv || 0)}; await beginCast(c, 'ex'); return S.ex.includes(c) ? 'not cast' : 'ok'; }, cr);
      check(r === 'ok', `Georges cast ${cr} using only colorless mana`);
      await settle([A, B]); await sleep(1200);
      check((await zones(A)).bf.includes(cr) && !(await zones(B)).ex.includes(cr), `${cr} is on Georges's battlefield; Kim's exile no longer has it`);
      await A.evaluate(n => { const c = S.bf.find(x => cname(x) === n); moveCard(c.id, 'gy'); }, cr); await sleep(1500);
      check((await zones(B)).gy.includes(cr) && !(await zones(A)).gy.includes(cr), `when it died it went to Kim's graveyard`);
      await A.evaluate(() => { window.__tgt = null; });
    });
    await step("Gonti: Georges looks at Kim's top four on her client, exiles one face down for himself, the rest go to the bottom", async () => {
      const top = await toTop(B, ['Island', 'Lightning Bolt', 'Island', 'Island']); const lib0 = (await zones(B)).lib;
      await A.evaluate(() => { window.__tgt = 'Kim'; window.__want = 'Lightning Bolt'; });
      await put(A, 'Gonti, Lord of Luxury'); await sleep(400); await settle([A, B]); await sleep(1800);
      const ex = await A.evaluate(() => S.ex.filter(c => c.r21).map(c => [cname(c), !!(c.mayPlay && c.mayPlay.adv), !!(c.mayPlay && c.mayPlay.any)]));
      const b = await B.evaluate(() => ({top:S.lib.slice(0, 3).map(cname), bottom:S.lib.slice(-3).map(cname), ex:S.ex.map(cname)}));
      console.log('    Georges lent exile:', JSON.stringify(ex), '| Kim:', JSON.stringify(b));
      check(ex.some(x => x[0] === 'Lightning Bolt' && x[1] && x[2]), 'Georges may cast the Bolt for as long as it remains exiled, with any mana');
      check(b.ex.includes('Lightning Bolt') && b.bottom.filter(x => x === 'Island').length === 3 && (await zones(B)).lib === lib0 - 1, 'Kim exiled it; her three Islands went to the bottom');
      await A.evaluate(() => { window.__tgt = null; window.__want = null; });
    });
    await step("Remand: Kim's Bolt goes back to her hand, not her graveyard", async () => {
      const la = await life(A);
      await toHand(B, 'Shock'); await B.evaluate(() => { S.pool = {...emptyPool(), R:1}; window.__tgt = 'Georges'; commit(); });
      check(await cast(B, 'Shock') === 'ok', 'Kim cast Shock at Georges');
      await waitFor(A, () => stackAll().some(i => i.nm === 'Shock'));
      await toHand(A, 'Remand'); await A.evaluate(() => { S.pool = {...emptyPool(), U:1, C:1}; commit(); });
      check(await cast(A, 'Remand') === 'ok', 'Georges cast Remand on it');
      await settle([A, B]); await sleep(1200); await settle([A, B]);
      const b = await B.evaluate(() => ({hand:S.hand.map(cname), gy:S.gy.map(cname)}));
      check(b.hand.includes('Shock') && await life(A) === la, "Shock is back in Kim's hand and Georges took no damage");
      await B.evaluate(() => { window.__tgt = null; });
    });
    await step("Commandeer: Georges takes Kim's Bolt and points it at her; it ends in Kim's graveyard", async () => {
      const la = await life(A), lb = await life(B);
      await toHand(B, 'Lightning Bolt'); await B.evaluate(() => { S.pool = {...emptyPool(), R:1}; window.__tgt = 'Georges'; commit(); });
      check(await cast(B, 'Lightning Bolt') === 'ok', 'Kim cast Lightning Bolt at Georges');
      await waitFor(A, () => stackAll().some(i => i.nm === 'Lightning Bolt'));
      await toHand(A, 'Commandeer'); await A.evaluate(() => { S.pool = {...emptyPool(), U:7}; window.__tgt = 'Kim'; window.__want = 'Pay|Choose new targets|Lightning Bolt'; commit(); });
      check(await cast(A, 'Commandeer') === 'ok', 'Georges cast Commandeer');
      await settle([A, B]); await sleep(1500); await settle([A, B]); await sleep(800);
      console.log('    life Georges', la, '→', await life(A), '| Kim', lb, '→', await life(B), '| Kim gy', JSON.stringify((await zones(B)).gy.slice(-3)));
      check(await life(A) === la && lb - await life(B) === 3, 'the Bolt hit Kim, not Georges');
      check((await zones(B)).gy.includes('Lightning Bolt') && !(await zones(A)).gy.includes('Lightning Bolt'), "the Bolt went to Kim's graveyard");
      await A.evaluate(() => { window.__tgt = null; window.__want = null; }); await B.evaluate(() => { window.__tgt = null; });
    });
    await step("Corrupted Conscience: Georges controls Kim's creature; when the Aura leaves, Kim gets it back", async () => {
      const cr = await B.evaluate(() => { const c = S.lib.find(x => isCreatureCard(x) && !x.cmd && !/Legendary/.test(info(x.k)?.t || '')); return c && cname(c); });
      await put(B, cr); await sleep(800);
      await toHand(A, 'Corrupted Conscience'); await A.evaluate(n => { S.pool = {...emptyPool(), U:5}; window.__tgt = n; commit(); }, cr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      check(await cast(A, 'Corrupted Conscience') === 'ok', `Georges cast Corrupted Conscience on Kim's ${cr}`);
      await settle([A, B]); await sleep(1500);
      const a1 = await A.evaluate(n => { const c = S.bf.find(x => cname(x) === n); const au = S.bf.find(x => cname(x) === 'Corrupted Conscience'); return {mine:!!c, own:!!(c && c.own), att:!!(au && c && au.att && au.att.pid === MYPID && au.att.id === c.id)}; }, cr);
      console.log('    Georges:', JSON.stringify(a1), '| Kim bf has it:', (await zones(B)).bf.includes(cr));
      check(a1.mine && a1.own && !(await zones(B)).bf.includes(cr), `Georges controls ${cr} (Kim still owns it)`);
      check(a1.att, 'the Aura stays attached to it on Georges\'s side');
      await A.evaluate(() => { const au = S.bf.find(x => cname(x) === 'Corrupted Conscience'); moveCard(au.id, 'gy'); }); await sleep(1500);
      check((await zones(B)).bf.includes(cr) && !(await zones(A)).bf.includes(cr), `the Aura left: ${cr} went back to Kim`);
      await A.evaluate(() => { window.__tgt = null; });
    });
    await step("Spellskite: its activated ability redirects Kim's Shock to itself", async () => {
      const la = await life(A);
      await put(A, 'Spellskite'); await sleep(500);
      await toHand(B, 'Shock'); await B.evaluate(() => { S.pool = {...emptyPool(), R:1}; window.__tgt = 'Georges'; commit(); });
      check(await cast(B, 'Shock') === 'ok', 'Kim cast Shock at Georges');
      await waitFor(A, () => stackAll().some(i => i.nm === 'Shock'));
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Spellskite'); S.pool = {...emptyPool(), U:1}; const ab = abilityList(c)[0]; activateAbility(c, ab); });
      await waitFor(A, () => S.stk.some(x => x.kind === 'ability'), null, 6000);
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Spellskite'); const it = S.stk.find(x => x.srcId === c.id); return it ? it.tgtNm : 'not activated: ' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title}) + S.log.slice(-3).map(e => e.s).join('|'); });
      check(r === 'Shock', `Spellskite's ability targets the Shock (${r})`);
      await settle([A, B]); await sleep(1200); await settle([A, B]);
      const sk = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Spellskite'); return c ? c.dmg || 0 : 'gone'; });
      check(await life(A) === la && sk === 2, `Georges took no damage; Spellskite took 2 (${sk})`);
      await B.evaluate(() => { window.__tgt = null; });
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
