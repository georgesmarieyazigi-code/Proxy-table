process.env.TOP = '1';
// Round 27 helper C (v17): the last one-off cards played in a real 2-player game (Georges vs Kim)
const CC = require('./cards');
const WANT = ['Oft-Nabbed Goat', 'Crypt Rats', 'Gemcutter Buccaneer', 'Ramses, Assassin Lord', "Cruelclaw's Heist", "River Song's Diary", 'Kíli the Resourceful', 'Osteomancer Adept', 'Brighthearth Banneret', 'Into the Pit', 'Hot Pursuit', 'Psychic Paper', 'Calamity, Galloping Inferno', 'Dawnhand Dissident', 'Gift of Doom', 'Elsha of the Infinite', 'Xanathar, Guild Kingpin', 'Grothama, All-Devouring', 'Hellish Rebuke',
  'Grizzly Bears', 'Llanowar Elves', 'Lightning Bolt', 'Mind Stone', 'Darksteel Ingot', 'Skullclamp', 'Swiftfoot Boots', 'Divination', 'Sol Ring', 'Arcane Signet', 'Shock'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, put, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { window.__want = window.__want || null; window.__tgt = window.__tgt || null; window.__num = null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ const re = window.__tgt ? new RegExp(window.__tgt, 'i') : null; const c = re ? (m.cands || []).find(x => x.ok && re.test(x.nm)) : (m.cands || []).find(x => x.ok); if (!c && re) return; m.__done = 1; m.resolve(c ? [c] : []); closeModal(); }
    else if (m.run){ m.__done = 1; const d = window.__num != null ? window.__num : (m.def ?? 1); m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const toZone = (p, n, z) => p.evaluate(([n, z]) => { for (const y of ['lib', 'hand', 'gy', 'ex', 'bf']){ const i = S[y].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[y].splice(i, 1); reset(c); S[z].push(c); commit(); return c.id; } } return null; }, [n, z]);
const cast = (p, n, pool) => p.evaluate(async ([n, pool]) => { const c = S.hand.find(x => cname(x) === n); if (!c) return 'not in hand'; S.pool = {...emptyPool(), ...(pool || {W:6, U:6, B:6, R:6, G:6, C:6})}; commit(); await beginCast(c, 'hand'); return S.hand.includes(c) ? 'not cast' : 'ok'; }, [n, pool]);
const putAny = (p, n) => p.evaluate(n => { for (const z of ['lib', 'hand', 'gy', 'ex']){ const c = S[z].find(c => cname(c) === n); if (c){ moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id); if (b){ b.sk = false; b.tap = false; } commit(); return true; } } return S.bf.some(c => cname(c) === n); }, n);
const toGy = (p, n) => p.evaluate(n => { let k = 0; for (const c of S.bf.filter(x => cname(x) === n)){ moveCard(c.id, 'gy', {quiet:true}); k++; } commit(); return k > 0; }, n);
const activate = (p, n, re) => p.evaluate(async ([n, re]) => { const c = S.bf.find(x => cname(x) === n); if (!c) return 'missing'; c.sk = false; c.tap = false; S.pool = {...emptyPool(), W:6, U:6, B:6, R:6, G:6, C:6}; const ab = abilityList(c).find(a => new RegExp(re, 'i').test(a.eff)); if (!ab) return 'no ability'; await activateAbility(c, ab); return 'ok'; }, [n, re]);
const run = (p, txt, nm, extra) => p.evaluate(async ([txt, nm, extra]) => { const k = [...DICT.values()].find(a => a.n === nm)?.k || null; const src = S.bf.find(c => c.k === k) || S.gy.find(c => c.k === k); const ctx = {k, name:nm, full:txt, srcId:src ? src.id : null, ...(extra || {})}; if (ctx.tgtKim){ const [pid] = [...OPP.keys()]; ctx.tgts = [[{t:'player', pid, nm:nameOf(pid)}]]; } if (ctx.itX != null) ctx.it = {kind:'ability', x:ctx.itX}; await runEffects(txt, ctx); commit(); return 'ok'; }, [txt, nm, extra]);
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !new RegExp(process.env.ONLY).test(name)) return; console.log('— ' + name); const f0 = H.fails(); if (PA) for (const p of [PA, PB]) await p.evaluate(() => { window.__tgt = null; window.__want = null; window.__num = null; if (UI.modal && UI.modal.resolve && !UI.modal.__done){ try { UI.modal.__done = 1; UI.modal.resolve(UI.modal.type === 'target' || UI.modal.type === 'pick' ? [] : null); closeModal(); } catch {} } }); try { await T(60000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2c3');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2c3');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const life = p => p.evaluate(() => S.life);
  const cnt = (p, re) => p.evaluate(re => S.bf.filter(c => new RegExp(re).test(cname(c))).reduce((a, c) => a + (c.n || 1), 0), re);
  const after = async () => { await sleep(500); await settle([A, B]); await sleep(1200); await settle([A, B]); await sleep(500); };
  const lt = p => p.evaluate(() => { window.__lt = []; const o = lookTopAwait; window.__ltO = o; lookTopAwait = (n, ...a) => { window.__lt.push(n); return Promise.resolve(); }; });
  const ltOff = p => p.evaluate(() => { if (window.__ltO) lookTopAwait = window.__ltO; return window.__lt; });
  const tapLands = p => p.evaluate(() => { S.bf.forEach(c => { if (isLand(c.k) || manaAbs(c).length) c.tap = true; }); S.pool = emptyPool(); commit(); });
  await A.evaluate(() => { window.tapLandsNow = async () => { S.bf.forEach(c => { if (isLand(c.k) || manaAbs(c).length) c.tap = true; }); }; });
  const untapAll = p => p.evaluate(() => { S.bf.forEach(c => { c.tap = false; c.tn = 0; }); commit(); });
  try {
    await step('Oft-Nabbed Goat: Kim can’t activate her own Goat; Georges pays {1} at sorcery speed, draws and takes it with a -1/-1 counter', async () => {
      await put(B, 'Oft-Nabbed Goat'); await after(); await sleep(1500);
      const own = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Oft-Nabbed Goat'); S.pool = {...emptyPool(), C:3}; return abilityReady(c, abilityList(c)[0], false); });
      check(/only your opponents/i.test(own), `Kim's own Goat: "${own}"`);
      const chip = await A.evaluate(() => r7Chips()); check(/c27oppAb/.test(chip) && /Oft-Nabbed Goat/.test(chip), 'Georges sees an activation button for Kim\'s Goat');
      const h0 = await A.evaluate(() => S.hand.length);
      await A.evaluate(async () => { S.pool = {...emptyPool(), C:1}; const x = c27OppAbs()[0]; await c27OppActivate(x.pid, x.c.id); }); await after(); await sleep(1500); await settle([A, B]);
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Oft-Nabbed Goat'); return c ? [c.cm || 0, S.hand.length, S.pool.C] : null; });
      check(r && r[0] === 1, `Georges controls the Goat with ${r && r[0]} -1/-1 counter`); check(r && r[1] === h0 + 1, `Georges drew a card (${h0} → ${r && r[1]})`); check(r && r[2] === 0, 'the {1} was paid');
      check(await B.evaluate(() => !S.bf.some(x => cname(x) === 'Oft-Nabbed Goat')), 'Kim no longer has the Goat');
      const why = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Oft-Nabbed Goat'); S.pool = {...emptyPool(), C:3}; return abilityReady(c, abilityList(c)[0], false); });
      check(/only your opponents/i.test(why), 'now Georges (its controller) can’t activate it');
      const kimWhy = await B.evaluate(() => { const x = c27OppAbs()[0]; return x ? c27OppAbWhy(x) : 'none'; }); check(/sorcery/i.test(kimWhy), `Kim can take it back only as a sorcery (now: "${kimWhy}")`);
      await A.evaluate(() => { S.pool = emptyPool(); commit(); });
    });
    await step('Crypt Rats: X can only be paid with black mana', async () => {
      await put(A, 'Crypt Rats'); await put(B, 'Grizzly Bears'); await after(); await tapLands(A);
      await A.evaluate(() => { S.pool = {...emptyPool(), B:2, R:5}; commit(); window.__num = 3; });
      const l0 = await life(B);
      await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Crypt Rats'); c.sk = false; await activateAbility(c, abilityList(c)[0]); }); await after();
      check(await A.evaluate(() => S.pool.B === 2 && !S.stk.length), 'X = 3 with only two black mana is refused');
      await A.evaluate(() => { window.__num = 2; }); await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Crypt Rats'); await activateAbility(c, abilityList(c)[0]); }); await after(); await sleep(1500); await settle([A, B]);
      const l1 = await life(B); check(l0 - l1 === 2, `X = 2 (black): Kim lost ${l0 - l1}`);
      check(await A.evaluate(() => S.pool.B === 0 && S.pool.R === 5), 'the red mana was not spent');
      check(await B.evaluate(() => !S.bf.some(x => cname(x) === 'Grizzly Bears')), "Kim's Grizzly Bears died");
      await A.evaluate(() => { window.__num = null; S.pool = emptyPool(); commit(); }); await toGy(A, 'Crypt Rats'); await untapAll(A);
    });
    await step('Brighthearth Banneret: reinforce 1 from hand', async () => {
      await toZone(A, 'Brighthearth Banneret', 'hand'); await put(A, 'Llanowar Elves'); await after();
      const r = await A.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Brighthearth Banneret'); return handAbilities(c).map(a => a.cost + ' | ' + a.eff); });
      check(r.some(x => /^\{1\}\{R\}, Discard ~ \| Put 1 \+1\/\+1 counter on target creature/.test(x)), `hand ability: ${r.join(' / ')}`);
      await A.evaluate(() => { window.__tgt = 'Llanowar'; S.pool = {...emptyPool(), R:2}; commit(); });
      await A.evaluate(async () => { const c = S.hand.find(x => cname(x) === 'Brighthearth Banneret'); await useHandAbility(c, handAbilities(c).find(a => a.c27reinforce)); }); await after();
      check(await A.evaluate(() => (S.bf.find(x => cname(x) === 'Llanowar Elves') || {}).cp === 1 && S.gy.some(x => cname(x) === 'Brighthearth Banneret')), 'Llanowar Elves got a +1/+1 counter and the Banneret was discarded');
      await toGy(A, 'Llanowar Elves');
    });
    await step('Kíli: enduring story, then the first equip each turn costs {0}', async () => {
      await put(A, 'Kíli the Resourceful'); await put(A, 'Swiftfoot Boots'); await after();
      check(await A.evaluate(() => !S.c27story), 'no enduring story with only Kíli and one artifact');
      await put(A, 'Mind Stone'); await after(); check(await A.evaluate(() => !!S.c27story), 'Kíli + Swiftfoot Boots + Mind Stone: enduring story');
      await tapLands(A);
      await A.evaluate(async () => { window.__tgt = 'Kíli'; const c = S.bf.find(x => cname(x) === 'Swiftfoot Boots'); await activateAbility(c, abilityList(c).find(a => a.equip)); }); await after();
      check(await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Swiftfoot Boots'); return c.att && cname(S.bf.find(x => x.id === c.att.id)) === 'Kíli the Resourceful'; }), 'Swiftfoot Boots equipped for {0}');
      const why = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Swiftfoot Boots'); return abilityReady(c, abilityList(c).find(a => a.equip), false); }); check(/mana/i.test(why), `second equip this turn needs mana ("${why}")`);
      await toGy(A, 'Mind Stone'); await toGy(A, 'Swiftfoot Boots'); await after();
      check(await A.evaluate(() => !!S.c27story), 'the enduring story is kept after the artifacts leave');
      await toGy(A, 'Kíli the Resourceful'); await untapAll(A);
    });
    await step('Gemcutter Buccaneer: Treasures are Equipment (+2/+0, equip Pirate {1}, equip {3})', async () => {
      await put(A, 'Gemcutter Buccaneer'); await after(); await sleep(500);
      // the offline card data has no token parts, so the trigger made a generic Treasure: swap in a real Treasure artifact token
      await A.evaluate(async () => { S.bf.filter(x => /Treasure/.test(cname(x))).forEach(x => { S.bf.splice(S.bf.indexOf(x), 1); }); const a = addInfo(infoFrom({object:'card', id:'tok-treasure', name:'Treasure', mana_cost:'', cmc:0, type_line:'Token Artifact — Treasure', oracle_text:'{T}, Sacrifice this token: Add one mana of any color.', colors:[], color_identity:[], keywords:[], layout:'token', set:'tst', collector_number:'999', set_name:'Test', released_at:'2024-01-01', prices:{}})); await createToken(a.k, 1); commit(); });
      const r = await A.evaluate(() => { const t = S.bf.find(x => /Treasure/.test(cname(x))); return t ? [typeOf(t), abilityList(t).map(a => a.line).join(' / ')] : null; });
      check(r && /Equipment/.test(r[0]), `the Treasure's type: ${r && r[0]}`); check(r && /Equip Pirate \{1\}/.test(r[1]) && /Equip \{3\}/.test(r[1]), `abilities: ${r && r[1]}`);
      const p0 = await A.evaluate(() => stats(S.bf.find(x => cname(x) === 'Gemcutter Buccaneer'))[0]);
      await A.evaluate(async () => { window.__tgt = 'Gemcutter'; S.pool = {...emptyPool(), C:1}; const t = S.bf.find(x => /Treasure/.test(cname(x))); t.tap = false; await activateAbility(t, abilityList(t).find(a => /Pirate/.test(a.line))); }); await after();
      const p1 = await A.evaluate(() => stats(S.bf.find(x => cname(x) === 'Gemcutter Buccaneer'))[0]);
      check(p1 === p0 + 2, `Gemcutter's power ${p0} → ${p1} when equipped with the Treasure`);
      await sleep(1500); const kp = await B.evaluate(() => { const [pid, o] = [...OPP.entries()][0]; const g = o.bf.find(c => c.k && info(c.k)?.n === 'Gemcutter Buccaneer'); return g ? (stats(g, pid) || [])[0] : null; }); check(kp === p0 + 2, `Kim's client also sees power ${kp}`);
      await toGy(A, 'Gemcutter Buccaneer'); await after();
      check(await A.evaluate(() => { const t = S.bf.find(x => /Treasure/.test(cname(x))); return t && !t.att && !/Equipment/.test(typeOf(t)); }), 'without the Buccaneer the Treasure is no longer an Equipment and unattaches');
      await A.evaluate(() => { S.bf.filter(x => /Treasure/.test(cname(x))).forEach(x => moveCard(x.id, 'gy', {quiet:true})); commit(); });
    });
    await step('Elsha: noncreature spells from the top of the library as though they had flash', async () => {
      await put(A, 'Elsha of the Infinite'); await after();
      const r = await A.evaluate(() => { const mv = n => { for (const z of [S.lib, S.gy, S.hand, S.ex]){ const i = z.findIndex(c => cname(c) === n); if (i >= 0){ const [c] = z.splice(i, 1); S.lib.unshift(c); return; } } throw new Error('no ' + n); }; const pn = phaseNow; phaseNow = () => ({...pn(), mine:false}); let a, b; try { mv('Divination'); a = timingOk(S.lib[0]).ok; mv('Llanowar Elves'); b = timingOk(S.lib[0]).ok; } finally { phaseNow = pn; } return [a, b, r23fTopWays(S.lib[0]).length]; });
      check(r[0] === true, 'Divination on top can be cast on Kim\'s turn'); check(r[1] === false, 'a creature on top still can\'t');
      await toGy(A, 'Elsha of the Infinite');
      const r2 = await A.evaluate(() => { const i = S.lib.findIndex(c => cname(c) === 'Divination'); const [c] = S.lib.splice(i, 1); S.lib.unshift(c); const pn = phaseNow; phaseNow = () => ({...pn(), mine:false}); try { return timingOk(S.lib[0]).ok; } finally { phaseNow = pn; } });
      check(r2 === false, 'without Elsha, no flash');
    });
    const kimPid = () => A.evaluate(() => [...OPP.keys()][0]);
    const attack = (p, n) => p.evaluate(n => { const [pid] = [...OPP.keys()]; const c = S.bf.find(x => cname(x) === n); c.sk = false; c.atk = 'p:' + pid; c.tap = true; emit({type:'attack', k:c.k, id:c.id, dp:pid}); commit(); }, n);
    const noAtk = p => p.evaluate(() => { S.bf.forEach(c => { c.atk = ''; c.tap = false; }); commit(); });
    await step('Ramses: when a player who was attacked by my Assassin this turn loses, I win', async () => {
      await put(A, 'Ramses, Assassin Lord'); await after();
      await B.evaluate(() => { S.life = 0; commit(); }); await sleep(2500); await settle([A, B]);
      check(await A.evaluate(() => !S.log.some(e => /wins the game/.test(e.s))), 'Kim lost without being attacked by an Assassin: no win');
      await B.evaluate(() => { setLife(40 - S.life); /* the life buttons: a by-hand correction since v20 */ }); await sleep(2000);
      await attack(A, 'Ramses, Assassin Lord'); await after();
      check(await A.evaluate(() => S.c27atk && S.c27atk.by.length === 1), 'Ramses (an Assassin) attacked Kim');
      await B.evaluate(() => { S.life = 0; commit(); }); await sleep(2500); await settle([A, B]); await sleep(800);
      check(await A.evaluate(() => S.log.some(e => /wins the game/.test(e.s))), 'Kim lost after the Assassin attacked her: Georges wins');
      await B.evaluate(() => { setLife(40 - S.life); /* the life buttons: a by-hand correction since v20 */ }); await noAtk(A); await toGy(A, 'Ramses, Assassin Lord'); await sleep(1500);
    });
    await step('Hot Pursuit: suspect + goad Kim\'s creature; with two players out, take all goaded/suspected creatures', async () => {
      await put(B, 'Grizzly Bears'); await after(); await A.evaluate(() => { window.__tgt = 'Grizzly'; });
      await put(A, 'Hot Pursuit'); await after(); await sleep(1500); await settle([A, B]); await A.evaluate(() => { window.__tgt = null; });
      const r = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); return c ? [!!c.jSus, !!(c.goad && goadOn(c))] : null; });
      check(r && r[0], 'Kim\'s Grizzly Bears is suspected'); check(r && r[1], 'and goaded while Hot Pursuit remains');
      await A.evaluate(() => { window.__lc = c27LostCount; c27LostCount = () => 2; });
      await run(A, 'If two or more players have lost the game, gain control of all goaded and/or suspected creatures until end of turn. Untap them. They gain haste until end of turn.', 'Hot Pursuit'); await after(); await sleep(1500);
      await A.evaluate(() => { c27LostCount = window.__lc; });
      const g = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); return c ? [!c.tap, !!(c.ekw || []).includes('haste'), !!c.eot] : null; });
      check(g && g[0] && g[1] && g[2], `Georges controls the Bears until end of turn, untapped with haste (${JSON.stringify(g)})`);
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); if (c && c.own) sendBack(c, 'bf'); commit(); }); await sleep(2000);
      await toGy(A, 'Hot Pursuit'); await sleep(2000);
      check(await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); return c && !c.c27hpg; }), 'with Hot Pursuit gone the goad from it ends');
      await toGy(B, 'Grizzly Bears');
    });
    await step('Hellish Rebuke: Kim\'s permanent damages Georges → it is sacrificed and Kim loses 2', async () => {
      await put(B, 'Grizzly Bears'); await after(); await toZone(A, 'Hellish Rebuke', 'hand');
      check(await cast(A, 'Hellish Rebuke') === 'ok', 'Georges casts Hellish Rebuke'); await after(); await sleep(1500);
      const la = await life(A), lb = await life(B);
      await B.evaluate(() => { const [pid] = [...OPP.keys()]; const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); dealDamage({t:'player', pid}, 2, c.k, c); commit(); }); await sleep(1500); await settle([A, B]); await sleep(1000);
      check(await life(A) === la - 2, 'Georges took the 2 damage');
      check(await B.evaluate(() => !S.bf.some(x => cname(x) === 'Grizzly Bears') && S.gy.some(x => cname(x) === 'Grizzly Bears')), 'Kim\'s Grizzly Bears was sacrificed');
      check(await life(B) === lb - 2, `Kim lost 2 life (${lb} → ${await life(B)})`);
    });
    await step('Grothama: an attacker may fight it; when it leaves, each player draws for the damage their sources dealt to it', async () => {
      await put(B, 'Grothama, All-Devouring'); await put(A, 'Llanowar Elves'); await after(); await sleep(1200);
      const n0 = await A.evaluate(() => S.stk.length); await A.evaluate(() => { window.__want = 'Fight'; });
      await attack(A, 'Llanowar Elves'); await sleep(300);
      const trig = await A.evaluate(() => S.stk.filter(it => /fight Grothama/i.test(it.txt)).length); check(trig === 1, `one fight trigger (${trig})`);
      await after(); await sleep(1500); await settle([A, B]); await A.evaluate(() => { window.__want = null; });
      check(await A.evaluate(() => !S.bf.some(x => cname(x) === 'Llanowar Elves')), 'the Elves fought Grothama and died');
      check(await B.evaluate(() => (S.bf.find(x => cname(x) === 'Grothama, All-Devouring') || {}).dmg === 1), 'Grothama took 1 damage');
      const h0 = await A.evaluate(() => S.hand.length); const hb = await B.evaluate(() => S.hand.length);
      await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grothama, All-Devouring'); moveCard(c.id, 'gy'); commit(); }); await after(); await sleep(2000); await settle([A, B]);
      const h1 = await A.evaluate(() => S.hand.length); check(h1 === h0 + 1, `Georges drew 1 (${h0} → ${h1})`); check(await B.evaluate(() => S.hand.length) === hb, 'Kim drew nothing');
      await noAtk(A);
    });
    await step("Cruelclaw's Heist: exile Kim's chosen nonland card; with the gift promised Georges may cast it with any mana", async () => {
      await toZone(B, 'Divination', 'hand'); await A.evaluate(() => { window.__want = 'Divination'; });
      await run(A, "Target opponent reveals their hand. You choose a nonland card from it. Exile that card. If the gift was promised, you may cast that card for as long as it remains exiled, and mana of any type can be spent to cast it.", "Cruelclaw's Heist", {tgtKim:true, gift:true}); await after(); await sleep(1500);
      await A.evaluate(() => { window.__want = null; });
      check(await B.evaluate(() => S.ex.some(x => cname(x) === 'Divination') && !S.hand.some(x => cname(x) === 'Divination')), 'Kim\'s Divination is exiled');
      const r = await A.evaluate(() => { const c = S.ex.find(x => cname(x) === 'Divination' && x.own); return c ? JSON.stringify(c.mayPlay) : null; });
      check(r && /"any":true/.test(r) && /"adv":true/.test(r), `Georges may cast it (${r})`);
      const cst = await A.evaluate(async () => { const c = S.ex.find(x => cname(x) === 'Divination' && x.own); await tapLandsNow(); S.pool = {...emptyPool(), R:3}; commit(); const h0 = S.hand.length; await beginCast(c, 'ex'); return [S.stk.some(it => it.nm === 'Divination'), S.pool.R]; }).catch(e => String(e));
      check(Array.isArray(cst) && cst[0] && cst[1] === 0, `cast it from exile with red mana (${JSON.stringify(cst)})`);
      await after(); await sleep(1500);
      check(await B.evaluate(() => S.gy.some(x => cname(x) === 'Divination')), 'after resolving, it went to Kim\'s graveyard');
      await toZone(B, 'Shock', 'hand'); await A.evaluate(() => { window.__want = 'Shock'; });
      await run(A, "Target opponent reveals their hand. You choose a nonland card from it. Exile that card. If the gift was promised, you may cast that card for as long as it remains exiled, and mana of any type can be spent to cast it.", "Cruelclaw's Heist", {tgtKim:true}); await after(); await sleep(1500);
      await A.evaluate(() => { window.__want = null; });
      check(await B.evaluate(() => S.ex.some(x => cname(x) === 'Shock')), 'without the gift, Shock is exiled too');
      check(await A.evaluate(() => !S.ex.some(x => cname(x) === 'Shock')), '…but Georges gets no permission to cast it');
    });
    const clearCreatures = p => p.evaluate(() => { S.bf.filter(c => isCreatureCard(c) && !c.fd).forEach(c => moveCard(c.id, 'gy', {quiet:true})); commit(); });
    await step('Saddle + Calamity: two tapped-and-attacking copies of the creature that saddled it, sacrificed at end step', async () => {
      await clearCreatures(A); await put(A, 'Calamity, Galloping Inferno'); await put(A, 'Grizzly Bears'); await after();
      await A.evaluate(() => { window.__want = 'Grizzly'; });
      const r = await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Calamity, Galloping Inferno'); const ab = abilityList(c).find(a => a.saddle); if (!ab) return 'no saddle'; const why = abilityReady(c, ab, false); await activateAbility(c, ab); return why; }); await settle([A, B]); await sleep(500); await settle([A, B]);
      const r2 = await A.evaluate((why) => { const c = S.bf.find(x => cname(x) === 'Calamity, Galloping Inferno'); return [why, c.saddled === turnStr(), (c.saddledBy || []).length, S.bf.find(x => cname(x) === 'Grizzly Bears').tap]; }, r);   // saddle uses the stack since v20
      check(Array.isArray(r2) && r2[0] === '' && r2[1] && r2[2] === 1 && r2[3], `saddled Calamity with Grizzly Bears (${JSON.stringify(r2)})`);
      await A.evaluate(() => { window.__want = null; }); await attack(A, 'Calamity, Galloping Inferno'); await after(); await sleep(800); await settle([A, B]);
      const t = await A.evaluate(() => { const toks = S.bf.filter(x => x.tok && cname(x) === 'Grizzly Bears'); return [toks.length, toks.every(x => x.tap && /^p:/.test(x.atk || '')), S.dly.filter(d => d.op === 'sac' && toks.some(x => x.id === d.srcId)).length]; });
      check(t[0] === 2 && t[1], `two tapped and attacking Grizzly Bears tokens (${JSON.stringify(t)})`); check(t[2] === 2, 'both are sacrificed at the next end step');
      await A.evaluate(() => { S.dly = S.dly.filter(d => !(d.op === 'sac')); S.bf.filter(x => x.tok && cname(x) === 'Grizzly Bears').forEach(x => moveCard(x.id, 'gy', {quiet:true})); commit(); }); await noAtk(A); await clearCreatures(A);
    });
    await step('Osteomancer Adept: cast a creature from the graveyard by foraging; it enters with a finality counter', async () => {
      await put(A, 'Osteomancer Adept'); await after();
      check(await activate(A, 'Osteomancer Adept', 'foraging') === 'ok', 'activated Osteomancer Adept'); await after();
      await toZone(A, 'Grizzly Bears', 'gy'); await A.evaluate(() => { S.lib.filter(c => isLand(c.k)).slice(0, 3).forEach(c => { S.lib.splice(S.lib.indexOf(c), 1); S.gy.unshift(c); }); commit(); });
      const g0 = await A.evaluate(() => S.gy.length);
      const r = await A.evaluate(async () => { const c = S.gy.find(x => cname(x) === 'Grizzly Bears'); const opt = gyOptions(c).find(o => o.kind === 'c27osteo'); if (!opt) return 'no option'; S.pool = {...emptyPool(), G:2}; commit(); await castFromGy(c, opt); return S.stk.some(it => it.nm === 'Grizzly Bears') ? 'ok' : 'not cast'; });
      check(r === 'ok', `Grizzly Bears cast from the graveyard (${r})`); await after();
      const b = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); return c ? (c.nc || {}).finality || 0 : -1; });
      check(b === 1, `it entered with a finality counter (${b})`); check(await A.evaluate(() => S.gy.length) === g0 - 4, 'three other cards were exiled to forage');
      await toGy(A, 'Grizzly Bears'); check(await A.evaluate(() => S.ex.some(x => cname(x) === 'Grizzly Bears')), 'with the finality counter it is exiled instead of dying');
      await toGy(A, 'Osteomancer Adept');
    });
    await step('Into the Pit: cast the top card of the library by sacrificing a nonland permanent', async () => {
      await put(A, 'Into the Pit'); await put(A, 'Mind Stone'); await after(); await tapLands(A);
      await A.evaluate(() => { for (const z of ['lib', 'hand', 'gy', 'ex']){ const i = S[z].findIndex(c => cname(c) === 'Divination'); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.lib.unshift(c); break; } } S.pool = {...emptyPool(), U:1, C:2}; window.__want = 'Mind Stone'; commit(); });
      await A.evaluate(async () => { await c27PitCast(); }); await sleep(300);
      check(await A.evaluate(() => S.stk.some(it => it.nm === 'Divination')), 'Divination was cast from the top of the library');
      check(await A.evaluate(() => S.gy.some(x => cname(x) === 'Mind Stone')), 'Mind Stone was sacrificed for it');
      await A.evaluate(() => { window.__want = null; }); await after(); await toGy(A, 'Into the Pit'); await untapAll(A);
    });
    await step('Dawnhand Dissident: exile a card I own, then cast it by removing three counters', async () => {
      await clearCreatures(A); await put(A, 'Dawnhand Dissident'); await put(A, 'Llanowar Elves'); await toZone(A, 'Grizzly Bears', 'gy'); await after();
      await A.evaluate(async () => { const d = S.bf.find(x => cname(x) === 'Dawnhand Dissident'); const g = S.gy.find(x => cname(x) === 'Grizzly Bears'); await runEffects('Exile target card from a graveyard.', {k:d.k, name:'Dawnhand Dissident', srcId:d.id, full:'Exile target card from a graveyard.', tgts:[[{t:'gy', pid:MYPID, id:g.id, k:g.k, nm:'Grizzly Bears'}]]}); commit(); });
      check(await A.evaluate(() => { const c = S.ex.find(x => cname(x) === 'Grizzly Bears'); return !!(c && c.c27dd); }), 'Grizzly Bears is exiled with the Dissident');
      const why0 = await A.evaluate(() => c27DdWhy(S.ex.find(x => cname(x) === 'Grizzly Bears'))); check(/three counters/.test(why0), `without counters: "${why0}"`);
      await A.evaluate(() => { const e = S.bf.find(x => cname(x) === 'Llanowar Elves'); e.cp = 3; S.pool = {...emptyPool(), G:2}; commit(); });
      await A.evaluate(async () => { const c = S.ex.find(x => cname(x) === 'Grizzly Bears'); ACT.c27ddCast({dataset:{id:String(c.id)}}); }); await sleep(2500);
      check(await A.evaluate(() => (S.stk.some(it => it.nm === 'Grizzly Bears') || S.bf.some(x => cname(x) === 'Grizzly Bears')) && !S.ex.some(x => cname(x) === 'Grizzly Bears') && S.log.some(e => /cast Grizzly Bears \(dawnhand dissident\)/.test(e.s))), 'Grizzly Bears was cast from exile');
      check(await A.evaluate(() => (S.bf.find(x => cname(x) === 'Llanowar Elves') || {}).cp === 0), 'three +1/+1 counters were removed from Llanowar Elves');
      await after(); await clearCreatures(A);
    });
    await step('Psychic Paper: the equipped creature gets the chosen name and creature type', async () => {
      await put(A, 'Psychic Paper'); await put(A, 'Llanowar Elves'); await after();
      await A.evaluate(() => { window.__tgt = 'Llanowar'; window.__want = '^(Grizzly Bears|Ninja)$'; });
      await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Psychic Paper'); S.pool = {...emptyPool(), C:2}; await activateAbility(c, abilityList(c).find(a => a.equip)); }); await after(); await sleep(2500);
      await A.evaluate(() => { window.__tgt = null; window.__want = null; });
      const r = await A.evaluate(() => { const p = S.bf.find(x => info(x.k)?.n === 'Psychic Paper'); const h = p && p.att && S.bf.find(x => x.id === p.att.id); return h ? [cname(h), typeOf(h)] : null; });
      check(r && r[0] === 'Grizzly Bears' && /Creature — Ninja$/.test(r[1]), `equipped Llanowar Elves is now ${JSON.stringify(r)}`);
      await sleep(1500); const kb = await B.evaluate(() => { const o = [...OPP.values()][0]; return o.bf.map(c => c.k && info(c.k)?.n).filter(Boolean); });
      check(kb.includes('Grizzly Bears') && !kb.includes('Llanowar Elves'), `Kim sees the new name (${kb.join(', ')})`);
      await toGy(A, 'Psychic Paper'); await after();
      check(await A.evaluate(() => S.bf.some(x => cname(x) === 'Llanowar Elves' && /Elf/.test(typeOf(x)))), 'without the Paper it is Llanowar Elves again');
      await clearCreatures(A);
    });
    await step('Gift of Doom: morph cost "sacrifice another creature"; as it turns face up it may attach to a creature', async () => {
      await clearCreatures(A); await put(A, 'Grizzly Bears'); await put(A, 'Llanowar Elves'); await put(A, 'Gift of Doom'); await after();
      await A.evaluate(() => { const c = S.bf.find(x => info(x.k)?.n === 'Gift of Doom'); c.fd = true; c.fdc = 'morph'; commit(); window.__want = 'Llanowar'; });
      const tu = await A.evaluate(() => JSON.stringify(turnUpCost(S.bf.find(x => info(x.k)?.n === 'Gift of Doom')))); check(/Sacrifice another creature/i.test(tu), `turn-up cost: ${tu}`);
      await A.evaluate(async () => { const c = S.bf.find(x => info(x.k)?.n === 'Gift of Doom'); const p = turnFaceUp(c); await new Promise(r => setTimeout(r, 800)); window.__want = 'Grizzly'; await p; }); await after(); await sleep(1500);
      await A.evaluate(() => { window.__want = null; });
      const r = await A.evaluate(() => { const g = S.bf.find(x => info(x.k)?.n === 'Gift of Doom'); const h = g && g.att && S.bf.find(x => x.id === g.att.id); return [!!g && !g.fd, h ? cname(h) : null, S.gy.some(x => cname(x) === 'Llanowar Elves'), h ? kwOf(h, 'indestructible') : null]; });
      check(r[0] && r[2], `face up after sacrificing Llanowar Elves (${JSON.stringify(r)})`); check(r[1] === 'Grizzly Bears', 'attached to Grizzly Bears'); check(!!r[3], 'the Bears have indestructible');
      await toGy(A, 'Gift of Doom'); await clearCreatures(A);
    });
    await step('Xanathar: Kim can\'t cast spells; Georges casts the top card of her library with any mana', async () => {
      await put(A, 'Xanathar, Guild Kingpin'); await after();
      await run(A, "Until end of turn, target player can't cast spells, you may look at the top card of their library any time, you may play the top card of their library, and you may spend mana as though it were mana of any color to cast spells this way.", 'Xanathar, Guild Kingpin', {tgtKim:true}); await after(); await sleep(1500);
      await toZone(B, 'Shock', 'hand'); const kc = await B.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Shock'); S.pool = {...emptyPool(), R:3}; return castCheck(c, 'hand'); });
      check(!kc.ok && /can't cast spells/.test(kc.why), `Kim can't cast Shock ("${kc.why}")`);
      await B.evaluate(() => { const i = S.lib.findIndex(c => cname(c) === 'Divination'); if (i >= 0){ const [c] = S.lib.splice(i, 1); S.lib.unshift(c); } else { const g = S.gy.find(c => cname(c) === 'Divination'); if (g){ S.gy.splice(S.gy.indexOf(g), 1); S.lib.unshift(g); } } commit(); }); await sleep(2000);
      const chip = await A.evaluate(() => r7Chips()); check(/c27xanPlay/.test(chip) && /Divination/.test(chip), "Georges sees the top card of Kim's library");
      const h0 = await A.evaluate(() => S.hand.length);
      await tapLands(A); await A.evaluate(() => { S.pool = {...emptyPool(), R:3}; commit(); }); await A.evaluate(async () => { await c27XanPlay(); }); await sleep(500);
      check(await A.evaluate(() => S.stk.some(it => it.nm === 'Divination') && S.pool.R === 0), 'Georges cast Divination from Kim\'s library paying {R}{R}{R}');
      await after(); await sleep(1500); await settle([A, B]);
      check(await A.evaluate(() => S.hand.length) === h0 + 2, 'Divination drew Georges two cards');
      check(await B.evaluate(() => S.gy.some(x => cname(x) === 'Divination') && !S.lib.some(x => cname(x) === 'Divination')), "it went to Kim's graveyard");
      await A.evaluate(() => { S.landT = [turnStr(), 0]; commit(); }); await B.evaluate(() => { const i = S.lib.findIndex(c => cname(c) === 'Swamp'); const [c] = S.lib.splice(i, 1); S.lib.unshift(c); commit(); }); await sleep(2000);
      await A.evaluate(async () => { await c27XanPlay(); }); await after(); await sleep(1500);
      check(await A.evaluate(() => S.bf.some(x => cname(x) === 'Swamp' && x.own) && S.landT[1] === 1), "Georges played Kim's top Swamp as his land for the turn");
      check(await B.evaluate(() => S.lib[0] && cname(S.lib[0]) !== 'Swamp' || !S.lib.length), "it left Kim's library");
      await toGy(A, 'Xanathar, Guild Kingpin'); await A.evaluate(() => { S.c27xan = null; commit(); }); await untapAll(A); await sleep(1500);
    });
    await step("River Song's Diary: instants/sorceries cast from hand are exiled with it; with four, cast one at random for free", async () => {
      await put(A, "River Song's Diary"); await after(); await sleep(1200);
      for (const n of ['Lightning Bolt', 'Shock']){ await A.evaluate(n => { for (const z of ['gy', 'ex']){ const c = S[z].find(x => cname(x) === n); if (c){ S[z].splice(S[z].indexOf(c), 1); S.hand.push(c); } } commit(); }, n); await toZone(A, n, 'hand'); }
      for (const n of ['Lightning Bolt', 'Shock']){ await B.evaluate(n => { for (const z of ['gy', 'ex', 'lib']){ const c = S[z].find(x => cname(x) === n); if (c){ S[z].splice(S[z].indexOf(c), 1); S.hand.push(c); } } commit(); }, n); }
      await A.evaluate(() => { window.__tgt = 'Kim'; }); await B.evaluate(() => { window.__tgt = 'Georges'; });
      for (const n of ['Lightning Bolt', 'Shock']){ check(await cast(A, n) === 'ok', `Georges casts ${n}`); await after(); check(await cast(B, n) === 'ok', `Kim casts ${n}`); await after(); }
      await sleep(1500);
      const r = await A.evaluate(() => { const d = S.bf.find(x => info(x.k)?.n === "River Song's Diary"); return c27DiaryCards(MYPID, d.id).map(e => (e.pid === MYPID ? 'G:' : 'K:') + info(e.k)?.n); });
      check(r.length === 4, `four cards are exiled with the Diary: ${r.join(', ')}`);
      check(await B.evaluate(() => !S.gy.some(x => cname(x) === 'Shock') && S.ex.some(x => cname(x) === 'Shock')), "Kim's Shock went to exile, not her graveyard");
      const l0 = await life(B);
      await A.evaluate(async () => { const d = S.bf.find(x => info(x.k)?.n === "River Song's Diary"); const R = Math.random; Math.random = () => 0.99; try { await runEffects("If there are four or more cards exiled with River Song's Diary, choose one of them at random. You may cast it without paying its mana cost.", {k:d.k, name:"River Song's Diary", srcId:d.id, full:"At the beginning of your upkeep, if there are four or more cards exiled with this artifact, choose one of them at random. You may cast it without paying its mana cost."}); } finally { Math.random = R; } commit(); });
      await after(); await sleep(2000); await settle([A, B]);
      check(await B.evaluate(() => S.gy.some(x => cname(x) === 'Shock')), "Georges cast Kim's Shock for free; it went to her graveyard afterwards");
      check(await life(B) === l0 - 2, `the Shock hit Kim (${l0} → ${await life(B)})`);
      await A.evaluate(() => { window.__tgt = null; }); await B.evaluate(() => { window.__tgt = null; }); await toGy(A, "River Song's Diary");
    });
//STEPS
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
