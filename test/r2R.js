process.env.TOP = '1';
// Round 25R: doublers and ability sharing, played in a real 2-player game (Georges vs Kim)
const CC = require('./cards');
const WANT = ['Necrotic Ooze', 'Marvin, Murderous Mimic', 'Drana and Linvala', 'Conspicuous Snoop', 'Nicol Bolas, Dragon-God', "Agatha's Soul Cauldron", "Hazel's Brewmaster",
  'Katara, the Fearless', 'Twinflame Travelers', "Wizard's Staff", 'Krang, the All-Powerful', 'Wulfgar of Icewind Dale', 'Felix Five-Boots', 'Windcrag Siege', 'Extraplanar Lens',
  'Roxanne, Starfall Savant', 'Tyvar the Bellicose', 'Aether Refinery', 'Izzet Generatorium', 'Sword of Hours', 'Havengul Lich',
  'Llanowar Elves', 'Elvish Mystic', 'Mother of Runes', 'Krenko, Mob Boss', 'Liliana of the Veil', 'Elvish Visionary', 'Zulaport Cutthroat', 'Mulldrifter', 'Smothering Tithe',
  'Hellrider', 'Reconnaissance Mission', 'Mind Stone', 'Wall of Omens'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, put, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { window.__want = window.__want || null; window.__tgt = window.__tgt || null; window.__num = null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ if (!window.__tgt) return; const re = new RegExp(window.__tgt, 'i'); const c = (m.cands || []).find(x => x.ok && re.test(x.nm)); if (!c) return; m.__done = 1; m.resolve([c]); closeModal(); }
    else if (m.run){ m.__done = 1; const d = window.__num != null ? window.__num : (m.def ?? 1); m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const toGy = (p, n) => p.evaluate(n => { for (const z of ['bf', 'lib', 'hand']){ const c = S[z].find(x => cname(x) === n); if (c){ moveCard(c.id, 'gy', {quiet:true}); commit(); return true; } } return false; }, n);
const activate = (p, n, re) => p.evaluate(async ([n, re]) => { const c = S.bf.find(x => cname(x) === n); if (!c) return 'missing'; c.sk = false; c.tap = false; S.pool = {...emptyPool(), W:6, U:6, B:6, R:6, G:6, C:6}; const ab = abilityList(c).find(a => new RegExp(re, 'i').test(a.eff)); if (!ab) return 'no ability'; await activateAbility(c, ab); return 'ok'; }, [n, re]);
const run = (p, txt, nm, extra) => p.evaluate(async ([txt, nm, extra]) => { const k = [...DICT.values()].find(a => a.n === nm)?.k || null; const sc = S.bf.find(b => info(b.k)?.n === nm); const ctx = {k, name:nm, full:txt, srcId:sc ? sc.id : undefined, ...(extra || {})}; await runEffects(txt, ctx); commit(); return 'ok'; }, [txt, nm, extra]);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails();
  try { await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), 60000))]); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2r');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2r');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const life = p => p.evaluate(() => S.life);
  const cnt = (p, re) => p.evaluate(re => S.bf.filter(c => new RegExp(re).test(cname(c))).reduce((a, c) => a + (c.n || 1), 0), re);
  const after = async () => { await sleep(500); await settle([A, B]); await sleep(1200); await settle([A, B]); await sleep(500); };
  const abs = (p, n) => p.evaluate(n => { const c = S.bf.find(x => cname(x) === n); return c ? {a:abilityList(c).map(x => x.eff), m:manaAbs(c).map(x => x.eff)} : null; }, n);
  const clear = async (p, names) => { for (const n of names) while (await p.evaluate(n => !!S.bf.find(x => cname(x) === n), n)) await toGy(p, n); };
  const kim = await A.evaluate(() => [...OPP.keys()][0]);
  try {
    await step('Necrotic Ooze has the activated abilities of creature cards in all graveyards; Tyvar counts the mana it made', async () => {
      await toGy(A, 'Llanowar Elves'); await toGy(B, 'Mother of Runes'); await sleep(1200);
      await put(A, 'Necrotic Ooze'); await put(A, 'Tyvar the Bellicose'); await after();
      const r = await abs(A, 'Necrotic Ooze');
      check(r && r.m.some(x => /add \{G\}/i.test(x)), 'Ooze has Llanowar Elves\'s "{T}: Add {G}" (Georges\'s graveyard)');
      check(r && r.a.some(x => /protection from the color/i.test(x)), 'Ooze has Mother of Runes\'s ability (Kim\'s graveyard)');
      const g0 = await A.evaluate(() => S.pool.G || 0);
      await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Necrotic Ooze'); c.sk = false; c.tap = false; const ab = manaAbs(c).find(a => /add \{G\}/i.test(a.eff)); await activateMana(c, ab, 0); commit(); }); await after();
      check(await A.evaluate(() => S.pool.G || 0) === g0 + 1 || await A.evaluate(() => S.bf.find(x => cname(x) === 'Necrotic Ooze')?.tap), 'Ooze tapped for {G}');
      check(await A.evaluate(() => S.bf.find(x => cname(x) === 'Necrotic Ooze')?.cp || 0) === 1, 'Tyvar: the mana ability of Ooze resolved — it got one +1/+1 counter');
      await clear(A, ['Necrotic Ooze', 'Tyvar the Bellicose']);
    });
    await step('Marvin has the abilities of my other creatures; Drana and Linvala has the abilities of Kim\'s creatures', async () => {
      await put(A, 'Marvin, Murderous Mimic'); await put(A, 'Elvish Mystic'); await put(A, 'Krenko, Mob Boss'); await after();
      const r = await abs(A, 'Marvin, Murderous Mimic');
      check(r && r.m.some(x => /add \{G\}/i.test(x)) && r.a.some(x => /goblin/i.test(x)), 'Marvin has Elvish Mystic\'s mana ability and Krenko\'s ability');
      const t0 = await cnt(A, 'Goblin'); check(await activate(A, 'Marvin, Murderous Mimic', 'goblin') === 'ok', 'activate Krenko\'s ability on Marvin'); await after();
      check(await cnt(A, 'Goblin') > t0, `Marvin created Goblin tokens (${t0} → ${await cnt(A, 'Goblin')})`);
      await clear(A, ['Marvin, Murderous Mimic', 'Elvish Mystic', 'Krenko, Mob Boss']); await A.evaluate(() => { S.bf.filter(c => c.tok).forEach(c => moveCard(c.id, 'gy', {quiet:true})); commit(); });
      await B.evaluate(() => { const c = S.gy.find(x => cname(x) === 'Mother of Runes'); if (c) moveCard(c.id, 'bf', {quiet:true}); commit(); }); await put(B, 'Llanowar Elves'); await put(A, 'Drana and Linvala'); await after();
      const d = await abs(A, 'Drana and Linvala');
      check(d && d.a.some(x => /protection/i.test(x)) && d.m.some(x => /add \{G\}/i.test(x)), 'Drana and Linvala has Mother of Runes\'s and Llanowar Elves\'s abilities');
      const why = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Mother of Runes'); c.sk = false; return abilityReady(c, abilityList(c)[0], false); });
      check(/can't be activated/i.test(why), `Kim can't activate Mother of Runes (${why})`);
      check(await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Drana and Linvala'); R21CTX = {ab:c, cost:'{G}'}; try { return !payPlan(parseCost('{G}'), {...emptyPool(), R:1}).err; } finally { R21CTX = null; } }), 'Drana can spend {R} as though it were {G} for those abilities');
      await clear(A, ['Drana and Linvala']); await clear(B, ['Mother of Runes', 'Llanowar Elves']);
    });
    await step('Conspicuous Snoop has the abilities of a Goblin on top of the library', async () => {
      await put(A, 'Conspicuous Snoop'); await A.evaluate(() => { for (const z of ['gy', 'bf', 'hand']){ const c = S[z].find(x => cname(x) === 'Krenko, Mob Boss'); if (c){ S[z].splice(S[z].indexOf(c), 1); S.lib.unshift(c); break; } } const i = S.lib.findIndex(x => cname(x) === 'Krenko, Mob Boss'); if (i > 0){ const [c] = S.lib.splice(i, 1); S.lib.unshift(c); } commit(); }); await after();
      check((await abs(A, 'Conspicuous Snoop')).a.some(x => /goblin/i.test(x)), 'Snoop has Krenko\'s ability while Krenko is on top');
      await A.evaluate(() => { const c = S.lib.shift(); S.lib.push(c); commit(); });
      check(!(await abs(A, 'Conspicuous Snoop')).a.some(x => /goblin tokens, where/i.test(x)), 'and loses it when Krenko is no longer on top');
      await clear(A, ['Conspicuous Snoop']);
    });
    await step('Nicol Bolas, Dragon-God has the loyalty abilities of Kim\'s Liliana', async () => {
      await put(B, 'Liliana of the Veil'); await put(A, 'Nicol Bolas, Dragon-God'); await after();
      const n = await A.evaluate(() => loyaltyAbs(S.bf.find(x => cname(x) === 'Nicol Bolas, Dragon-God')).length);
      check(n === 6, `Bolas lists his 3 + Liliana's 3 loyalty abilities (${n})`);
      await clear(A, ['Nicol Bolas, Dragon-God']); await clear(B, ['Liliana of the Veil']);
    });
    await step('Agatha\'s Soul Cauldron: exile a creature card, counter on a creature, which gains its abilities', async () => {
      await toGy(A, 'Llanowar Elves'); await toGy(A, 'Mother of Runes'); await put(A, "Agatha's Soul Cauldron"); await put(A, 'Elvish Visionary'); await after();
      await A.evaluate(() => { window.__tgt = 'Mother of Runes|Elvish Visionary'; }); check(await activate(A, "Agatha's Soul Cauldron", 'exile target card') === 'ok', 'activate Cauldron targeting Mother of Runes in the graveyard');
      await sleep(400); await A.evaluate(() => { window.__tgt = 'Elvish Visionary'; }); await after(); await A.evaluate(() => { window.__tgt = null; });
      check(await A.evaluate(() => S.ex.some(c => cname(c) === 'Mother of Runes')), 'Mother of Runes was exiled');
      check(await A.evaluate(() => S.bf.find(x => cname(x) === 'Elvish Visionary')?.cp || 0) === 1, 'reflexive trigger: Elvish Visionary got a +1/+1 counter');
      check((await abs(A, 'Elvish Visionary')).a.some(x => /protection/i.test(x)), 'Elvish Visionary (with a counter) has Mother of Runes\'s ability');
      await clear(A, ["Agatha's Soul Cauldron", 'Elvish Visionary']);
    });
    await step('Hazel\'s Brewmaster: Foods have the abilities of the exiled creature card', async () => {
      await toGy(A, 'Llanowar Elves'); await A.evaluate(() => { window.__tgt = 'Llanowar'; }); await put(A, "Hazel's Brewmaster"); await after(); await A.evaluate(() => { window.__tgt = null; });
      const f = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Food'); return c ? manaAbs(c).map(x => x.eff) : null; });
      check(f && f.some(x => /add \{G\}/i.test(x)), `a Food has Llanowar Elves's mana ability (${JSON.stringify(f)})`);
      await clear(A, ["Hazel's Brewmaster", 'Food']);
    });
    await step('Katara doubles an Ally\'s trigger; Twinflame Travelers doubles another Elemental\'s', async () => {
      await put(A, 'Zulaport Cutthroat'); await put(A, 'Katara, the Fearless'); await put(A, 'Elvish Visionary'); await after(); const L0 = await life(B);
      await toGy(A, 'Elvish Visionary'); await after();
      check(await life(B) === L0 - 2, `Zulaport Cutthroat triggered twice: Kim ${L0} → ${await life(B)}`);
      await clear(A, ['Zulaport Cutthroat', 'Katara, the Fearless']);
      await put(A, 'Twinflame Travelers'); await after(); const h0 = await A.evaluate(() => S.hand.length); await put(A, 'Mulldrifter'); await after();
      check(await A.evaluate(() => S.hand.length) === h0 + 4, `Mulldrifter's enters trigger happened twice (hand ${h0} → ${await A.evaluate(() => S.hand.length)})`);
      await clear(A, ['Twinflame Travelers', 'Mulldrifter']);
    });
    await step('Wizard\'s Staff doubles the equipped creature\'s triggers', async () => {
      await put(A, 'Zulaport Cutthroat'); await put(A, "Wizard's Staff"); await put(A, 'Wall of Omens'); await after();
      await A.evaluate(() => { const s = S.bf.find(x => cname(x) === "Wizard's Staff"); const z = S.bf.find(x => cname(x) === 'Zulaport Cutthroat'); s.att = {id:z.id, pid:MYPID}; commit(); });
      const L0 = await life(B); await toGy(A, 'Wall of Omens'); await after();
      check(await life(B) === L0 - 2, `equipped Zulaport Cutthroat triggered twice (Kim ${L0} → ${await life(B)})`);
      await clear(A, ['Zulaport Cutthroat', "Wizard's Staff"]);
    });
    await step('Krang doubles a "draws a card" trigger (Smothering Tithe)', async () => {
      await put(A, 'Krang, the All-Powerful'); await put(A, 'Smothering Tithe'); await after();
      await A.evaluate(() => { window.__l0 = new Set(S.log); }); await B.evaluate(() => { draw(1); commit(); }); await sleep(1500); await after();
      const n = await A.evaluate(() => S.log.filter(e => !window.__l0.has(e) && /^trigger: Smothering Tithe/.test(e.s)).length);
      check(n === 2, `Kim drew one card: two Smothering Tithe triggers (${n})`); await clear(A, ['Krang, the All-Powerful', 'Smothering Tithe']);
    });
    await step('Wulfgar and Windcrag Siege (Mardu) each add a trigger for an attacking creature (Hellrider)', async () => {
      await A.evaluate(() => { window.__want = 'Mardu'; }); await put(A, 'Windcrag Siege'); await put(A, 'Wulfgar of Icewind Dale'); await put(A, 'Hellrider'); await after(); await A.evaluate(() => { window.__want = null; });
      check(await A.evaluate(() => S.bf.find(x => cname(x) === 'Windcrag Siege')?.g23mode) === 'Mardu', 'Windcrag Siege: chose Mardu');
      const L0 = await life(B);
      await A.evaluate(pid => { const c = S.bf.find(x => cname(x) === 'Hellrider'); c.atk = 'p:' + pid; c.tap = true; emit({type:'attack', k:c.k, id:c.id}); commit(); }, kim); await after();
      check(await life(B) === L0 - 3, `Hellrider triggered three times (Kim ${L0} → ${await life(B)})`);
      await A.evaluate(() => { S.bf.forEach(c => { delete c.atk; }); commit(); });
      await clear(A, ['Windcrag Siege', 'Wulfgar of Icewind Dale', 'Hellrider']);
    });
    await step('Felix Five-Boots doubles a combat-damage trigger (Reconnaissance Mission)', async () => {
      await put(A, 'Felix Five-Boots'); await put(A, 'Reconnaissance Mission'); await after(); const h0 = await A.evaluate(() => S.hand.length);
      await A.evaluate(pid => { const c = S.bf.find(x => cname(x) === 'Felix Five-Boots'); emit({type:'cdmg', k:c.k, id:c.id, dp:pid, cnt:1, amt:2}); commit(); }, kim); await after();
      check(await A.evaluate(() => S.hand.length) === h0 + 2, `drew two cards (hand ${h0} → ${await A.evaluate(() => S.hand.length)})`);
      await clear(A, ['Felix Five-Boots', 'Reconnaissance Mission']);
    });
    await step('Extraplanar Lens and Roxanne add mana when the matching source is tapped', async () => {
      await put(A, 'Mountain'); await put(A, 'Mountain'); await put(A, 'Mountain'); await A.evaluate(() => { window.__tgt = 'Mountain'; }); await put(A, 'Extraplanar Lens'); await after(); await A.evaluate(() => { window.__tgt = null; });
      check(await A.evaluate(() => !!S.bf.find(x => cname(x) === 'Extraplanar Lens')?.imp), 'Lens imprinted a Mountain');
      const r = await A.evaluate(async () => { S.pool = emptyPool(); const c = S.bf.find(x => cname(x) === 'Mountain' && !x.tap); await activateMana(c, manaAbs(c)[0], 0); commit(); return S.pool.R; });
      check(r === 2, `tapping a Mountain made {R}{R} (${r})`);
      const LK = await life(B); await A.evaluate(() => { window.__tgt = 'Kim'; }); await put(A, 'Roxanne, Starfall Savant'); await after(); await A.evaluate(() => { window.__tgt = null; });
      check(await life(B) === LK - 2, `the Meteorite token entered and dealt 2 damage to Kim (${LK} → ${await life(B)})`);
      const m = await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Meteorite'); if (!c) return 'no Meteorite'; c.tap = false; S.pool = emptyPool(); const ab = manaAbs(c)[0]; if (!ab) return 'no mana ability'; await activateMana(c, ab, 0); commit(); return Object.values(S.pool).reduce((a, b) => a + b, 0); });
      check(m === 2, `tapping the Meteorite token made 2 mana with Roxanne (${m})`);
      await clear(A, ['Extraplanar Lens', 'Roxanne, Starfall Savant', 'Meteorite', 'Mountain']);
    });
    await step('Energy: Aether Refinery doubles, Izzet Generatorium adds one', async () => {
      await put(A, 'Aether Refinery'); await put(A, 'Izzet Generatorium'); await after();
      const e = await A.evaluate(() => { const e0 = (S.pc || {}).energy || 0; addPC('energy', 1); return ((S.pc || {}).energy || 0) - e0; });
      check(e === 3, `getting {E} gave ${e} (1 → 2 → 3)`);
      await clear(A, ['Aether Refinery', 'Izzet Generatorium']);
    });
    await step('Sword of Hours doubles the counters on a 12', async () => {
      await put(A, 'Sword of Hours'); await put(A, 'Wall of Omens'); await after();
      await A.evaluate(() => { const s = S.bf.find(x => cname(x) === 'Sword of Hours'); const w = S.bf.find(x => cname(x) === 'Wall of Omens'); s.att = {id:w.id, pid:MYPID}; w.cp = 3; commit(); });
      await run(A, 'If the result is greater than the damage dealt or the result is 12, double the number of +1/+1 counters on that creature.', 'Sword of Hours', {roll:12, it:{kind:'trigger', evN:5}});
      check(await A.evaluate(() => S.bf.find(x => cname(x) === 'Wall of Omens')?.cp) === 6, 'rolled 12: 3 → 6 counters');
      await run(A, 'If the result is greater than the damage dealt or the result is 12, double the number of +1/+1 counters on that creature.', 'Sword of Hours', {roll:2, it:{kind:'trigger', evN:5}});
      check(await A.evaluate(() => S.bf.find(x => cname(x) === 'Wall of Omens')?.cp) === 6, 'rolled 2 against 5 damage: nothing');
      await clear(A, ['Sword of Hours', 'Wall of Omens']);
    });
    await step('Havengul Lich: cast a creature card from the graveyard, then the Lich has its abilities this turn', async () => {
      await toGy(A, 'Elvish Mystic'); await put(A, 'Havengul Lich'); await after();
      await A.evaluate(() => { window.__tgt = 'Elvish Mystic'; }); check(await activate(A, 'Havengul Lich', 'cast target creature card') === 'ok', 'activate the Lich targeting Elvish Mystic'); await after(); await A.evaluate(() => { window.__tgt = null; });
      const opt = await A.evaluate(() => { const c = S.gy.find(x => cname(x) === 'Elvish Mystic'); return c ? gyOptions(c).map(o => o.kind) : []; });
      check(opt.includes('gycast'), `Elvish Mystic can be cast from the graveyard this turn (${opt})`);
      await A.evaluate(async () => { const c = S.gy.find(x => cname(x) === 'Elvish Mystic'); S.pool = {...emptyPool(), G:3}; const o = gyOptions(c).find(x => x.kind === 'gycast'); await beginCast(c, 'gy', o); commit(); }); await after();
      check(await A.evaluate(() => S.bf.some(x => cname(x) === 'Elvish Mystic')), 'Elvish Mystic was cast from the graveyard');
      check((await abs(A, 'Havengul Lich')).m.some(x => /add \{G\}/i.test(x)), 'the Lich has Elvish Mystic\'s ability until end of turn');
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
