process.env.TOP = '1';
// Round 24O: characteristic-changing effects (layers 4–7) and granted abilities, played in a real 2-player game
const CC = require('./cards');
const WANT = ['Oko, Thief of Crowns', 'Birds of Paradise', 'Llanowar Elves', 'Elvish Archdruid', 'Wall of Omens', 'Dress Down', 'Song of the Dryads', 'Sudden Spoiling', 'Polymorphist\'s Jest',
  'Lavabelly Sliver', 'Hibernation Sliver', 'Crypt Sliver', 'Muscle Sliver', 'Candlekeep Sage', 'Supernatural Stamina', 'Feign Death', 'Behind the Scenes', 'Marchesa, the Black Rose', 'Cyberman Patrol',
  'Cover of Darkness', 'Maskwood Nexus', 'Gornog, the Red Reaper', 'Liquimetal Torque', 'Tam, Mindful First-Year', 'Imprisoned in the Moon', 'Witness Protection', 'Amoeboid Changeling', 'Zombie Master',
  'Gravecrawler', 'Lightning Bolt', 'Sol Ring', 'Fyndhorn Elves', 'Elvish Mystic', 'Serra Angel', 'Glorious Sunrise', 'Song of Freyalise', 'Flayer of Loyalties', 'Exalted Angel', 'Akrasan Squire', 'Sublime Archangel', 'Noble Hierarch',
  'Vraska, Betrayal\'s Sting', 'Xu-Ifit, Osteoharmonist', 'Sludge Monster', 'Bootleggers\' Stash', 'Unable to Scream', 'Swamp', 'Forest'];
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
const toGy = (p, n) => p.evaluate(n => { const c = S.bf.find(x => cname(x) === n); if (c){ moveCard(c.id, 'gy', {quiet:true}); commit(); return true; } return false; }, n);
const activate = (p, n, re) => p.evaluate(async ([n, re]) => { const c = S.bf.find(x => cname(x) === n); if (!c) return 'missing'; c.sk = false; c.tap = false; S.pool = {...emptyPool(), W:6, U:6, B:6, R:6, G:6, C:6}; const ab = abilityList(c).find(a => new RegExp(re, 'i').test(a.eff)); if (!ab) return 'no ability'; await activateAbility(c, ab); return 'ok'; }, [n, re]);
const loyalty = (p, n, i) => p.evaluate(async ([n, i]) => { const c = S.bf.find(x => cname(x) === n); if (!c) return 'missing'; c.lu = ''; await activateLoyalty(c, i); return 'ok'; }, [n, i]);
const oppView = (p, n) => p.evaluate(n => { const [pid, st] = [...OPP][0]; const c = (st.bf || []).find(x => info(x.k)?.n === n); if (!c) return null; return {t:typeOf(c), cre:isCreatureCard(c), st:stats(c, pid), fly:kwOf(c, 'flying', pid), badge:attachBadge(c, pid)}; }, n);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name, new Date().toISOString().slice(11,19)); const f0 = H.fails(); try { await fn(); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-12).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Marchesa, the Black Rose'), 'host', 'r2o');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2o');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const life = p => p.evaluate(() => S.life);
  const after = async () => { await sleep(500); await settle([A, B]); await sleep(1200); await settle([A, B]); await sleep(500); };
  const mine = (p, n, fn) => p.evaluate(([n, f]) => { const c = S.bf.find(x => cname(x) === n); if (!c) return null; return (new Function('c', 'return (' + f + ')(c)'))(c); }, [n, String(fn)]);
  try {
    await step('Oko +1: Kim\'s Birds of Paradise becomes a green 3/3 Elk with no abilities (both screens)', async () => {
      await put(B, 'Birds of Paradise'); await put(A, 'Oko, Thief of Crowns'); await after();
      await A.evaluate(() => { window.__tgt = 'Birds of Paradise'; });
      check(await loyalty(A, 'Oko, Thief of Crowns', 1) === 'ok', 'activated Oko\'s +1'); await after();
      const k = await mine(B, 'Birds of Paradise', c => ({t:typeOf(c), st:stats(c), fly:kwOf(c, 'flying'), mana:manaAbs(c).length, green:descOk(c.k, 'green creature', {card:c}), elk:descOk(c.k, 'elk', {card:c})}));
      console.log('    Kim sees', JSON.stringify(k));
      check(k && /Creature — Elk$/.test(k.t) && k.st.join('/') === '3/3', 'on Kim\'s client it is a 3/3 Elk creature');
      check(k && !k.fly && k.mana === 0, 'it lost flying and its mana ability');
      check(k && k.green && k.elk, 'it is green and an Elk for "green creature" / "Elk" checks');
      const g = await oppView(A, 'Birds of Paradise'); console.log('    Georges sees', JSON.stringify(g));
      check(g && /Elk/.test(g.t) && g.st.join('/') === '3/3' && !g.fly && /no abilities/.test(g.badge), 'Georges sees the same 3/3 Elk with no abilities');
    });
    await step('Dress Down: creatures lose all abilities (anthems and keywords too), on both screens', async () => {
      await put(B, 'Elvish Archdruid'); await put(B, 'Llanowar Elves'); await put(A, 'Noble Hierarch'); await after();
      const s0 = await mine(B, 'Llanowar Elves', c => stats(c).join('/'));
      check(s0 === '2/2', `Llanowar Elves is 2/2 with Elvish Archdruid (${s0})`);
      await put(A, 'Dress Down'); await after();
      const s1 = await mine(B, 'Llanowar Elves', c => [stats(c).join('/'), manaAbs(c).length]);
      check(s1 && s1[0] === '1/1' && s1[1] === 0, `Elvish Archdruid's anthem and the Elves' mana ability are gone (${JSON.stringify(s1)})`);
      const a = await mine(A, 'Noble Hierarch', c => [kwOf(c, 'exalted'), manaAbs(c).length]);
      check(a && !a[0] && !a[1], `Georges's Noble Hierarch has no exalted and no mana ability (${JSON.stringify(a)})`);
      const g = await oppView(A, 'Llanowar Elves'); check(g && g.st.join('/') === '1/1', 'Georges sees Kim\'s Elves as 1/1');
      await toGy(A, 'Dress Down'); await after();
      const s2 = await mine(B, 'Llanowar Elves', c => stats(c).join('/')); check(s2 === '2/2', 'abilities come back when Dress Down leaves');
    });
    await step('Song of the Dryads: Kim\'s Elvish Archdruid becomes a colorless Forest land', async () => {
      await put(A, 'Song of the Dryads'); await after();
      const tid = await B.evaluate(() => S.bf.find(x => cname(x) === 'Elvish Archdruid').id); const pb = await B.evaluate(() => MYPID);
      await A.evaluate(([pid, id]) => { const s = S.bf.find(x => cname(x) === 'Song of the Dryads'); s.att = {pid, id}; commit(); }, [pb, tid]); await after();
      const r = await mine(B, 'Elvish Archdruid', c => ({t:typeOf(c), cre:isCreatureCard(c), mana:manaAbs(c).map(a => a.outs.map(o => o.join('')).join('')), ab:abilityList(c).length}));
      console.log('    ', JSON.stringify(r));
      check(r && r.t === 'Land — Forest' && !r.cre, 'it is a Forest land, not a creature');
      check(r && r.mana.join(',') === 'G' && r.ab === 0, 'it taps for {G} and has no other abilities');
      const s = await mine(B, 'Llanowar Elves', c => stats(c).join('/')); check(s === '1/1', 'its anthem no longer applies');
      await toGy(A, 'Song of the Dryads'); await after();
    });
    await step('Sudden Spoiling: Kim\'s creatures are 0/2 with no abilities until end of turn', async () => {
      await A.evaluate(() => { window.__tgt = 'Kim'; }); await toHand(A, 'Sudden Spoiling');
      check(await cast(A, 'Sudden Spoiling') === 'ok', 'cast Sudden Spoiling targeting Kim'); await after();
      const r = await B.evaluate(() => S.bf.filter(c => isCreatureCard(c) && cname(c) !== 'Birds of Paradise').map(c => [cname(c), stats(c).join('/'), manaAbs(c).length]));
      console.log('    ', JSON.stringify(r));
      check(r.length >= 2 && r.every(x => x[1] === '0/2' && x[2] === 0), 'every creature Kim controls is 0/2 with no mana ability');
      const g = await oppView(A, 'Llanowar Elves'); check(g && g.st.join('/') === '0/2', 'Georges sees 0/2 too');
    });
    await step('Lavabelly Sliver: granted enters trigger on every Sliver (1 damage to Kim, Georges gains 1)', async () => {
      await A.evaluate(() => { window.__tgt = 'Kim'; }); const la = await life(A), lb = await life(B);
      await put(A, 'Lavabelly Sliver'); await after(); await put(A, 'Muscle Sliver'); await after();
      const da = await life(A) - la, db = lb - await life(B);
      check(da === 2 && db === 2, `two triggers: Georges +${da}, Kim −${db}`);
    });
    await step('Hibernation / Crypt Sliver: granted activated abilities appear on other Slivers', async () => {
      await put(A, 'Hibernation Sliver'); await put(A, 'Crypt Sliver'); await after();
      const r = await mine(A, 'Muscle Sliver', c => abilityList(c).map(a => a.cost + ': ' + a.eff));
      console.log('    ', JSON.stringify(r));
      check(r && r.some(x => /Pay 2 life: Return ~ to its owner's hand/i.test(x)) && r.some(x => /^\{T\}: Regenerate target Sliver/i.test(x)), 'Muscle Sliver has both granted abilities');
      const la = await life(A);
      check(await activate(A, 'Muscle Sliver', 'owner') === 'ok', 'activated the granted ability'); await after();
      const h = await A.evaluate(() => S.hand.some(c => cname(c) === 'Muscle Sliver'));
      check(h && la - await life(A) === 2, 'paid 2 life and Muscle Sliver returned to hand');
    });
    await step('Candlekeep Sage: Georges\'s commander has "When this creature enters or leaves the battlefield, draw a card"', async () => {
      await put(A, 'Candlekeep Sage'); await after(); const h0 = await A.evaluate(() => S.hand.length);
      await A.evaluate(() => { const c = S.cz.find(x => cname(x) === 'Marchesa, the Black Rose'); if (c){ S.cz.splice(S.cz.indexOf(c), 1); c.cmd = true; S.hand.push(c); moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id); if (b){ b.cmd = true; b.sk = false; } commit(); } }); await after();
      const h1 = await A.evaluate(() => S.hand.length);
      check(h1 === h0 + 1 - 0, `the commander entered and Georges drew (${h0} → ${h1})`);
    });
    await step('Supernatural Stamina: the creature gains a dies trigger and comes back tapped', async () => {
      await put(A, 'Fyndhorn Elves'); await A.evaluate(() => { window.__tgt = 'Fyndhorn Elves'; }); await toHand(A, 'Supernatural Stamina');
      check(await cast(A, 'Supernatural Stamina') === 'ok', 'cast Supernatural Stamina on Fyndhorn Elves'); await after();
      const p = await mine(A, 'Fyndhorn Elves', c => stats(c).join('/')); check(p === '3/1', `Fyndhorn Elves is 3/1 (${p})`);
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Fyndhorn Elves'); destroyCard(c, 'test'); commit(); }); await after();
      const r = await mine(A, 'Fyndhorn Elves', c => ({tap:!!c.tap}));
      check(r && r.tap, 'Fyndhorn Elves returned to the battlefield tapped');
    });
    await step('Behind the Scenes (skulk) and Zombie Master (swampwalk): Kim can\'t block', async () => {
      await put(A, 'Behind the Scenes'); await put(A, 'Elvish Mystic'); await put(B, 'Wall of Omens'); await B.evaluate(() => { window.__tgt = 'Birds of Paradise'; }); await put(B, 'Sludge Monster'); await after();
      const pa = await A.evaluate(() => MYPID); const bid = await A.evaluate(() => S.bf.find(x => cname(x) === 'Elvish Mystic').id);
      const r = await B.evaluate(([pid, id]) => { const a = OPP.get(pid).bf.find(x => x.id === id); const w = S.bf.find(x => cname(x) === 'Wall of Omens'); const l = S.bf.find(x => cname(x) === 'Sludge Monster'); return [canBlock(w, a, pid), canBlock(l, a, pid)]; }, [pa, bid]);
      check(!r[0] && r[1] === 'skulk', `Wall of Omens (power 0) can block the 1/1 skulker, Kim's 5/5 Sludge Monster can't (${JSON.stringify(r)})`);
      await toGy(A, 'Behind the Scenes'); await put(A, 'Zombie Master'); await put(A, 'Gravecrawler'); await put(B, 'Swamp'); await after();
      const gid = await A.evaluate(() => S.bf.find(x => cname(x) === 'Gravecrawler').id);
      const z = await B.evaluate(([pid, id]) => { const a = OPP.get(pid).bf.find(x => x.id === id); const l = S.bf.find(x => cname(x) === 'Llanowar Elves'); return canBlock(l, a, pid); }, [pa, gid]);
      check(z === 'swampwalk', `Gravecrawler has swampwalk from Zombie Master and Kim controls a Swamp (${z})`);
    });
    await step('Marchesa (dethrone) and exalted: attacking the player with the most life', async () => {
      await B.evaluate(() => { S.life = 60; commit(); }); await after();
      await A.evaluate(() => { S.bf.forEach(c => { c.sk = false; c.tap = false; }); setPhase(4); startCombat(); S.cb.step = 'atk'; const g = S.bf.find(x => cname(x) === 'Elvish Mystic'); UI.atkSel = {[g.id]:'p:' + [...OPP.keys()][0]}; declareAttackers(); });
      await after();
      const r = await mine(A, 'Elvish Mystic', c => ({cp:c.cp || 0, pu:(c.pu || [0, 0])[0], st:stats(c).join('/')}));
      check(r && r.cp === 1, `Elvish Mystic got a +1/+1 counter from dethrone (${JSON.stringify(r)})`);
      check(r && r.pu === 1 && r.st === '3/3', `…and +1/+1 until end of turn from Noble Hierarch's exalted (it attacked alone): ${r && r.st}`);
      await A.evaluate(() => { try { endCombat(); } catch {} });
    });
    await step('Turn passes: "until end of turn" records expire', async () => {
      await A.evaluate(() => { try { endCombat(); } catch {} passTurn(); }); await after(); await waitFor(B, () => phaseNow().mine, null, 8000); await after();
      const r = await mine(B, 'Llanowar Elves', c => [stats(c).join('/'), manaAbs(c).length, (c.lx || []).length]);
      check(r && r[0] === '2/2' && r[1] === 1 && r[2] === 0, `Llanowar Elves is back to 2/2 (Archdruid's anthem works again) with its mana ability (${JSON.stringify(r)})`);
      const o = await mine(B, 'Birds of Paradise', c => typeOf(c)); check(/Elk/.test(o || ''), 'Oko\'s Elk effect is permanent');
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
