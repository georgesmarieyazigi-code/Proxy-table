process.env.TOP = '1';
// Round 27 helper A: the last one-offs, played in a real 2-player game (Georges vs Kim). Run with PTPORT=18921.
const CC = require('./cards');
const WANT = ['Brave the Sands', 'Fallen Shinobi', 'Wand of Wonder', 'Duplicant', 'Xantcha, Sleeper Agent', 'Yedora, Grave Gardener', 'Ensnared by the Mara', 'Jeweled Amulet',
  "Neyali, Suns' Vanguard", 'Lux Artillery', 'Satoru Umezawa', 'The Master, Multiplied', 'The Necrobloom', "Illusionist's Gambit", 'Avenger of the Fallen', 'Noble Heritage',
  'Invoke Calamity', 'Locke, Treasure Hunter', 'Dance with Calamity', 'Joraga Treespeaker',
  'Solemn Simulacrum', 'Llanowar Elves', 'Elvish Mystic', 'Lightning Bolt', 'Divination', 'Opt', 'Baneslayer Angel', 'Wall of Omens', 'Mind Stone', 'Forest', 'Island'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, put, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { window.__want = window.__want || null; window.__tgt = window.__tgt || null; window.__num = null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ if (!window.__tgt) return; const re = new RegExp(window.__tgt, 'i'); const c = (m.cands || []).find(x => x.ok && re.test(x.nm)); if (!c) return; m.__done = 1; m.resolve([c]); closeModal(); }
    else if (m.type === 'split' && m.resolve){ m.__done = 1; window.__split = (window.__split || 0) + 1; m.resolve(m.plan); closeModal(); }
    else if (m.run){ m.__done = 1; const d = window.__num != null ? window.__num : (m.def ?? 1); m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const toHand = (p, n) => p.evaluate(n => { for (const z of ['lib', 'gy', 'ex', 'bf']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.hand.push(c); commit(); return c.id; } } return S.hand.find(c => cname(c) === n)?.id; }, n);
const toZone = (p, n, z) => p.evaluate(([n, z]) => { for (const y of ['lib', 'hand', 'gy', 'ex', 'bf']){ const i = S[y].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[y].splice(i, 1); reset(c); if (z === 'libtop') S.lib.unshift(c); else S[z].push(c); commit(); return c.id; } } return null; }, [n, z]);
const cast = (p, n, pool) => p.evaluate(async ([n, pool]) => { const c = S.hand.find(x => cname(x) === n); if (!c) return 'not in hand'; S.pool = {...emptyPool(), ...(pool || {W:6, U:6, B:6, R:6, G:6, C:6})}; commit(); await beginCast(c, 'hand'); return S.hand.includes(c) ? 'not cast' : 'ok'; }, [n, pool]);
const toGy = (p, n) => p.evaluate(n => { const c = S.bf.find(x => cname(x) === n); if (c){ moveCard(c.id, 'gy', {quiet:true}); commit(); return true; } return false; }, n);
const activate = (p, n, re, pool) => p.evaluate(async ([n, re, pool]) => { const c = S.bf.find(x => cname(x) === n); if (!c) return 'missing'; c.sk = false; c.tap = false; S.pool = {...emptyPool(), ...(pool || {W:6, U:6, B:6, R:6, G:6, C:6})}; const ab = abilityList(c).find(a => new RegExp(re, 'i').test(a.eff)); if (!ab) return 'no ability'; const why = abilityReady(c, ab, false); if (why) return why; await activateAbility(c, ab); return 'ok'; }, [n, re, pool]);
const run = (p, txt, nm, extra) => p.evaluate(async ([txt, nm, extra]) => { const k = [...DICT.values()].find(a => a.n === nm)?.k || null; const src = S.bf.find(c => c.k === k) || S.gy.find(c => c.k === k); const it = {kind:'trigger', ...(extra && extra.it || {})}; const ctx = {k, name:nm, full:txt, srcId:src ? src.id : null, it, ...(extra || {}), it}; await runEffects(txt, ctx); commit(); return 'ok'; }, [txt, nm, extra]);
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !new RegExp(process.env.ONLY).test(name)) return; console.log('— ' + name); const f0 = H.fails(); try { await T(120000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (PA) for (const p of [PA, PB]) await p.evaluate(() => { try { if (UI.modal){ const m = UI.modal; m.__done = 1; try { m.resolve && m.resolve(null); } catch {} closeModal(); } S.stk = []; UI.resolving = false; UI.casting = false; window.__want = null; window.__tgt = null; commit(); } catch {} }).catch(() => {});
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-16).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2a3');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2a3');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const kimPid = await B.evaluate(() => MYPID); const geoPid = await A.evaluate(() => MYPID);
  const life = p => p.evaluate(() => S.life);
  const after = async () => { await sleep(500); await settle([A, B]); await sleep(1000); await settle([A, B]); await sleep(400); };
  const hand = p => p.evaluate(() => S.hand.length);
  const bfHas = (p, n) => p.evaluate(n => S.bf.some(c => cname(c) === n), n);
  const clean = async () => { for (const p of [A, B]) await p.evaluate(() => { S.bf.filter(c => !isLand(c.k) && !c.cmd).forEach(c => { if (c.tok) S.bf.splice(S.bf.indexOf(c), 1); else moveCard(c.id, 'gy', {quiet:true}); }); S.bf.forEach(c => { c.atk = ''; c.blk = null; c.tap = false; }); S.stk = []; commit(); }); await sleep(600); };
  // A attacks B with the named creatures; B blocks with blk ({blocker: attacker}) and extra ({blocker:[attackers]}); opt.atBlkd runs on B when A reaches "blockers declared"
  const combat = async (atk, blk = {}, extra = {}, opt = {}) => {
    await A.evaluate(() => { if (phaseNow().ph !== 3) setPhase(3); if (S.cb) S.cb.step = 'end'; S.bf.forEach(c => { c.atk = ''; }); commit(); }); await sleep(400);
    await A.click('#phasebar [data-act="next"]').catch(() => {}); await waitFor(A, () => phaseNow().ph === 4, null, 8000); await passAll([B]);
    if (!(await A.evaluate(() => S.cb && S.cb.step === 'atk'))) await A.evaluate(() => nextAction());
    await waitFor(A, () => S.cb && S.cb.step === 'atk', null, 8000);
    await A.evaluate(names => { UI.atkSel = {}; S.bf.filter(c => names.includes(cname(c))).forEach(c => { c.sk = false; c.tap = false; UI.atkSel[c.id] = 'p:' + opponents()[0].pid; }); renderCombatPanel(); }, atk);
    if (process.env.CBDBG) console.log('    atkSel', JSON.stringify(await A.evaluate(() => ({sel:UI.atkSel, step:S.cb && S.cb.step, why:S.bf.filter(c => isCreatureCard(c)).map(c => cname(c) + ':' + canAttack(c)), plan:p24AtkPlan()}))));
    await A.click('#cbpanel [data-act="atkGo"]'); await sleep(300); if (opt.afterAtk) await opt.afterAtk(); await passAll([B]);
    const okB = await waitFor(B, () => !!document.querySelector('#cbpanel [data-act="blkGo"]'), null, 8000);
    if (!okB) console.log('    no block panel', JSON.stringify(await B.evaluate(() => ({pn:phaseNow(), log:S.log.slice(-6).map(e => e.s)}))));
    await B.evaluate(([blk, extra]) => { const pn = phaseNow(); const atts = attackersOnMe(pn); const id = n => (atts.find(a => info(a.k)?.n === n) || {}).id;
      for (const [b, a] of Object.entries(blk)){ const x = S.bf.find(c => cname(c) === b); if (x) UI.blkSel[x.id] = id(a); }
      for (const [b, list] of Object.entries(extra)){ const x = S.bf.find(c => cname(c) === b); if (x) UI.a27blk2[x.id] = list.map(id); } renderCombatPanel(); }, [blk, extra]);
    if (opt.beforeBlk) await opt.beforeBlk();
    await B.click('#cbpanel [data-act="blkGo"]');
    if (opt.atBlkd){ await waitFor(A, () => S.cb && S.cb.step === 'blkd', null, 8000); await opt.atBlkd(); }
    for (let i = 0; i < 12; i++){ await passAll([A, B]); if (await A.evaluate(() => phaseNow().ph === 5 || (S.cb && S.cb.step === 'end'))) break; }
    await sleep(1500); await passAll([A, B]); await sleep(800);
  };
  try {
    await step('Joraga Treespeaker levels up: P/T and abilities follow its level; level 5 gives Elves "{T}: Add {G}{G}"', async () => {
      await put(A, 'Joraga Treespeaker'); await after();
      const r0 = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Joraga Treespeaker'); return {st:stats(c), lv:abilityList(c).some(a => a.a27lv), gg:manaAbs(c).some(m => /\{G\}\{G\}/.test(m.eff))}; });
      check(r0.st[0] === 1 && r0.st[1] === 1 && r0.lv && !r0.gg, `level 0: 1/1, has Level up, no {G}{G} ability (${JSON.stringify(r0)})`);
      check(await activate(A, 'Joraga Treespeaker', 'level counter', {G:2, C:2}) === 'ok', 'activated level up'); await after();
      const r1 = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Joraga Treespeaker'); return {lvl:(c.nc || {}).level, st:stats(c), gg:manaAbs(c).some(m => /\{G\}\{G\}/.test(m.eff))}; });
      check(r1.lvl === 1 && r1.st[0] === 1 && r1.st[1] === 2 && r1.gg, `level 1: 1/2 with "{T}: Add {G}{G}" (${JSON.stringify(r1)})`);
      const sorc = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Joraga Treespeaker'); return abilityList(c).find(a => a.a27lv).sorc; }); check(sorc === true, 'level up is sorcery-speed');
      await put(A, 'Llanowar Elves'); await after();
      const e0 = await A.evaluate(() => manaAbs(S.bf.find(x => cname(x) === 'Llanowar Elves')).filter(m => /\{G\}\{G\}/.test(m.eff)).length);
      await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Joraga Treespeaker'); addNamed(c, 'level', 4); commit(); });
      const r5 = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Joraga Treespeaker'); const e = S.bf.find(x => cname(x) === 'Llanowar Elves'); return {st:stats(c), elf:manaAbs(e).filter(m => /\{G\}\{G\}/.test(m.eff)).map(m => m.outs)}; });
      check(e0 === 0 && r5.st[1] === 4 && r5.elf.length === 1 && JSON.stringify(r5.elf[0]) === '[["G","G"]]', `level 5: 1/4 and Llanowar Elves taps for {G}{G} (${JSON.stringify(r5)}, before ${e0})`);
      await sleep(1500); const kimSees = await B.evaluate(() => { const o = [...OPP.values()][0]; const c = (o.bf || []).find(x => info(x.k)?.n === 'Joraga Treespeaker'); return c ? stats(c, [...OPP.keys()][0]) : null; });
      check(kimSees && kimSees[1] === 4, `Kim sees Joraga as 1/4 (${JSON.stringify(kimSees)})`);
      await clean();
    });
    await step('Duplicant exiles Kim\'s Baneslayer Angel and becomes a 5/5 Angel Shapeshifter', async () => {
      await put(B, 'Baneslayer Angel'); await toHand(A, 'Duplicant'); await after();
      await A.evaluate(() => { window.__tgt = 'Baneslayer'; window.__want = 'Exile'; }); check(await cast(A, 'Duplicant') === 'ok', 'cast Duplicant'); await after(); await after();
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Duplicant'); return c && {st:stats(c), ty:typeOf(c)}; });
      check(!(await bfHas(B, 'Baneslayer Angel')) && await B.evaluate(() => S.ex.some(c => cname(c) === 'Baneslayer Angel')), 'Baneslayer Angel is in Kim\'s exile');
      check(r && r.st[0] === 5 && r.st[1] === 5 && /Angel/.test(r.ty) && /Shapeshifter/.test(r.ty), `Duplicant is a 5/5 Angel Shapeshifter (${JSON.stringify(r)})`);
      const kimSees = await B.evaluate(() => { const o = [...OPP.values()][0]; const c = (o.bf || []).find(x => info(x.k)?.n === 'Duplicant'); return c ? stats(c, [...OPP.keys()][0]) : null; });
      check(kimSees && kimSees[0] === 5, `Kim sees Duplicant as 5/5 (${JSON.stringify(kimSees)})`);
      await clean();
    });
    await step('Xantcha enters under Kim\'s control; Georges activates it from Kim\'s board; it can\'t attack its owner', async () => {
      await toHand(A, 'Xantcha, Sleeper Agent'); await after();
      check(await cast(A, 'Xantcha, Sleeper Agent') === 'ok', 'cast Xantcha'); await after();
      const onB = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Xantcha, Sleeper Agent'); return c ? {own:c.own && c.own.pid} : null; });
      check(!(await bfHas(A, 'Xantcha, Sleeper Agent')) && onB && onB.own === geoPid, `Xantcha is on Kim's battlefield, owned by Georges (${JSON.stringify(onB)})`);
      const why = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Xantcha, Sleeper Agent'); c.sk = false; return canAttack(c); });
      check(/can't attack its owner/.test(why), `Kim's Xantcha can't attack Georges, its owner (${why})`);
      const btn = await A.evaluate(() => !!document.querySelector('#opps [data-act="a27any"]')); check(btn, 'Georges sees an "activate" button for Xantcha under Kim\'s board');
      const kl = await life(B), gh = await hand(A);
      const res = await A.evaluate(async pid => { S.pool = {...emptyPool(), C:3}; const c = (OPP.get(pid).bf || []).find(x => info(x.k)?.n === 'Xantcha, Sleeper Agent'); const ab = a27AnyAbs(c)[0]; return a27ActivateOther(pid, c.id, ab.i); }, kimPid);
      check(res === 'ok', `Georges activated Kim's Xantcha (${res})`); await after();
      check(await life(B) === kl - 2 && await hand(A) === gh + 1, `Kim (its controller) lost 2 life and Georges drew (${kl}→${await life(B)}, hand ${gh}→${await hand(A)})`);
      const kl2 = await life(B), kh = await hand(B);
      check(await activate(B, 'Xantcha, Sleeper Agent', 'controller loses', {C:3}) === 'ok', 'Kim activates it herself'); await after();
      check(await life(B) === kl2 - 2 && await hand(B) === kh + 1, `Kim lost 2 life and drew (${kl2}→${await life(B)}, hand ${kh}→${await hand(B)})`);
      await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Xantcha, Sleeper Agent'); if (c) moveCard(c.id, 'gy'); commit(); }); await after();
      check(await A.evaluate(() => S.gy.some(c => cname(c) === 'Xantcha, Sleeper Agent')), 'when it dies it goes to Georges\'s graveyard');
      await clean();
    });
    await step('Yedora returns a dead creature face down as a Forest land; it taps for {G}; bounced it is the creature card again', async () => {
      await put(A, 'Yedora, Grave Gardener'); await put(A, 'Wall of Omens'); await after();
      await A.evaluate(() => { window.__want = 'Return it'; }); await toGy(A, 'Wall of Omens'); await after();
      const r = await A.evaluate(() => { const c = S.bf.find(x => x.k === A27FD); return c ? {land:isLand(c.k), cr:isCreatureCard(c), ty:typeOf(c), mana:manaAbs(c).map(m => m.outs), real:info(c.a27real)?.n} : null; });
      check(r && r.land && !r.cr && /Forest/.test(r.ty) && JSON.stringify(r.mana).includes('"G"') && r.real === 'Wall of Omens', `a face-down Forest land is on the battlefield (${JSON.stringify(r)})`);
      check(!(await A.evaluate(() => S.gy.some(c => cname(c) === 'Wall of Omens'))), 'Wall of Omens left the graveyard');
      await A.evaluate(() => { const c = S.bf.find(x => x.k === A27FD); moveCard(c.id, 'hand'); commit(); });
      check(await A.evaluate(() => S.hand.some(c => cname(c) === 'Wall of Omens')), 'bounced, it is Wall of Omens in hand');
      await clean();
    });
    await step('Fallen Shinobi: Kim exiles her top two; Georges may play them free this turn', async () => {
      await put(A, 'Fallen Shinobi'); await after();
      const kl = await B.evaluate(() => S.lib.length);
      await run(A, 'That player exiles the top two cards of their library. Until end of turn, you may play those cards without paying their mana costs.', 'Fallen Shinobi', {it:{kind:'trigger', evDp:kimPid}}); await after();
      const r = await A.evaluate(pid => S.ex.filter(c => c.own && c.own.pid === pid && c.mayPlay && c.mayPlay.free && exWindowOk(c)).length, kimPid);
      check(await B.evaluate(() => S.lib.length) === kl - 2, 'Kim\'s library lost two cards');
      check(r === 2, `Georges may play both, free, this turn (${r})`);
      await clean();
    });
    await step('Wand of Wonder: the d20 row sets X for the free instants/sorceries', async () => {
      await put(A, 'Wand of Wonder'); await after();
      await A.evaluate(() => { window.__cn = []; window.__cn0 = r21CastNow; r21CastNow = async (ctx, o) => { window.__cn.push({max:o.max, n:(ctx.r21ids || []).length}); }; window.__rnd = Math.random; Math.random = () => 0.99; });
      check(await activate(A, 'Wand of Wonder', 'Roll a d20', {C:4}) === 'ok', 'activated Wand of Wonder'); await after();
      const r = await A.evaluate(() => { Math.random = window.__rnd; r21CastNow = window.__cn0; return window.__cn; });
      check(r.length === 1 && r[0].max === 3, `rolled 20 → may cast up to three (${JSON.stringify(r)})`);
      check(await B.evaluate(() => S.ex.some(c => /\b(Instant|Sorcery)\b/.test(info(c.k)?.t || ''))) || r[0].n === 0, 'Kim exiled until an instant or sorcery');
      await clean();
    });
    await step('Ensnared by the Mara: Kim picks the four cards — damage equals their total mana value', async () => {
      await toHand(A, 'Ensnared by the Mara'); await B.evaluate(() => { window.__want = '^No'; });
      const kl = await life(B); const ex0 = await B.evaluate(() => S.ex.length);
      check(await cast(A, 'Ensnared by the Mara') === 'ok', 'cast Ensnared by the Mara'); await after(); await after();
      const r = await B.evaluate(n => { const x = S.ex.slice(n); return {n:x.length, mv:x.reduce((a, c) => a + (info(c.k)?.mv || 0), 0)}; }, ex0);
      check(r.n === 4 && await life(B) === kl - r.mv, `Kim exiled 4 cards (mana value ${r.mv}) and took that much damage (${kl}→${await life(B)})`);
      await B.evaluate(() => { window.__want = null; }); await toHand(A, 'Ensnared by the Mara'); await B.evaluate(() => { window.__want = '^Yes'; }); await A.evaluate(() => { window.__want = '^No'; });
      const kl2 = await life(B);
      check(await cast(A, 'Ensnared by the Mara') === 'ok', 'cast it again'); await after(); await after();
      const lent = await A.evaluate(pid => S.ex.filter(c => c.own && c.own.pid === pid && !isLand(c.k)).length, kimPid);
      check(await life(B) === kl2 && lent >= 1, `Kim chose to exile until a nonland card; Georges was offered it (lent ${lent}), no damage`);
      await B.evaluate(() => { window.__want = null; }); await clean();
    });
    await step('Jeweled Amulet notes the mana type spent and later adds that type', async () => {
      await put(A, 'Jeweled Amulet'); await after();
      check(await activate(A, 'Jeweled Amulet', 'charge counter', {U:1}) === 'ok', 'activated with {U}'); await after();
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Jeweled Amulet'); return {note:c.a27note, ch:(c.nc || {}).charge, outs:manaAbs(c).map(m => m.outs)}; });
      check(r.note === 'U' && r.ch === 1 && JSON.stringify(r.outs).includes('[["U"]]'), `noted {U}, has a charge counter, makes {U} (${JSON.stringify(r)})`);
      const m = await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Jeweled Amulet'); c.tap = false; S.pool = emptyPool(); const ab = manaAbs(c).find(a => /noted/.test(a.line)); await activateMana(c, ab, 0); return {U:S.pool.U, ch:(c.nc || {}).charge || 0}; });
      check(m.U === 1 && m.ch === 0, `tapping it removes the counter and adds {U} (${JSON.stringify(m)})`);
      await clean();
    });
    await step('Lux Artillery: an artifact creature spell gains sunburst (4 colors → 4 counters)', async () => {
      await put(A, 'Lux Artillery'); await toHand(A, 'Solemn Simulacrum'); await after();
      check(await cast(A, 'Solemn Simulacrum', {W:1, U:1, B:1, G:1}) === 'ok', 'cast Solemn Simulacrum with four colors'); await after(); await after();
      const cp = await A.evaluate(() => (S.bf.find(x => cname(x) === 'Solemn Simulacrum') || {}).cp);
      check(cp === 4, `Solemn Simulacrum entered with four +1/+1 counters (${cp})`);
      await clean();
    });
    await step('The Master, Multiplied: my triggered ability can\'t exile my creature token; an activated one can', async () => {
      await put(A, 'The Master, Multiplied'); await A.evaluate(() => { createFromText('Create a 1/1 red Goblin creature token.', {}); commit(); }); await after();
      const res = await A.evaluate(async () => { const tok = S.bf.find(c => c.tok && isCreatureCard(c)); const t = [[{t:'card', pid:MYPID, id:tok.id, k:tok.k}]];
        await resolveTop((S.stk.push({sid:rid(6), o:nextO(), kind:'trigger', k:null, nm:'Test trigger', txt:'Exile target creature.', tgts:t}), S.stk[S.stk.length - 1]));
        const kept = S.bf.includes(tok);
        await resolveTop((S.stk.push({sid:rid(6), o:nextO(), kind:'ability', k:null, nm:'Test ability', txt:'Exile target creature.', tgts:t}), S.stk[S.stk.length - 1]));
        return {kept, gone:!S.bf.includes(tok)}; });
      check(res.kept && res.gone, `trigger couldn't exile the token, an activated ability could (${JSON.stringify(res)})`);
      await clean();
    });
    await step('The Necrobloom: a land card in the graveyard has dredge 2', async () => {
      await put(A, 'The Necrobloom'); await toZone(A, 'Forest', 'gy'); await after();
      const r0 = await A.evaluate(() => ({lib:S.lib.length, gy:S.gy.length}));
      await A.evaluate(() => { window.__want = 'Dredge Forest'; draw(1); }); await sleep(800); await after();
      const r = await A.evaluate(() => ({lib:S.lib.length, gy:S.gy.length, forest:S.hand.some(c => cname(c) === 'Forest')}));
      check(r.forest && r.lib === r0.lib - 2 && r.gy === r0.gy + 1, `dredged Forest: milled 2, Forest to hand (${JSON.stringify(r0)} → ${JSON.stringify(r)})`);
      await A.evaluate(() => { window.__want = 'Draw normally'; }); const h0 = await hand(A); await A.evaluate(() => draw(1)); await sleep(800); await after();
      check(await hand(A) === h0 + 1, 'choosing "Draw normally" draws');
      await toZone(A, 'Forest', 'gy'); await A.evaluate(() => { window.__want = 'Dredge Forest'; }); const q0 = await A.evaluate(() => ({lib:S.lib.length, h:S.hand.length}));
      await run(A, 'Draw two cards.', 'Divination'); await after();
      const q1 = await A.evaluate(() => ({lib:S.lib.length, h:S.hand.length}));
      check(q1.h === q0.h + 2 && q1.lib === q0.lib - 3, `"Draw two cards": dredged Forest for the first, drew the second (${JSON.stringify(q0)} → ${JSON.stringify(q1)})`);
      await clean();
    });
    await step('Noble Heritage: Kim puts counters → Georges has protection from Kim (targets and damage)', async () => {
      await put(B, 'Wall of Omens'); await put(A, 'Llanowar Elves'); await after(); await B.evaluate(() => { window.__want = null; });
      await run(A, 'Each player may put two +1/+1 counters on a creature they control. For each opponent who does, you gain protection from that player until your next turn.', 'Noble Heritage'); await after();
      const p = await A.evaluate(() => S.a27prot && S.a27prot.p); check(Array.isArray(p) && p.includes(kimPid), `Georges has protection from Kim (${JSON.stringify(p)})`);
      await sleep(800);
      const tc = await B.evaluate(pid => { const sp = targetSpecs('Lightning Bolt deals 3 damage to any target.')[0]; const c = targetCands(sp, {pid:MYPID}).find(x => x.t === 'player' && x.pid === pid); return c ? c.ok : 'none'; }, geoPid);
      check(tc === false, `Kim can't target Georges (${tc})`);
      const gl = await life(A); await B.evaluate(pid => { dealDamage({t:'player', pid}, 3, null, null); commit(); }, geoPid); await after();
      check(await life(A) === gl, `damage from Kim's source is prevented (${gl}→${await life(A)})`);
      await A.evaluate(() => { S.a27prot = null; commit(); }); await clean();
    });
    await step('Invoke Calamity casts Lightning Bolt (graveyard) and Divination (hand) free; both are exiled afterwards', async () => {
      await toZone(A, 'Lightning Bolt', 'gy'); await toHand(A, 'Divination'); await toHand(A, 'Invoke Calamity'); await after();
      await A.evaluate(() => { window.__want = 'Lightning|Divination'; window.__tgt = 'Kim'; });
      const kl = await life(B);
      check(await cast(A, 'Invoke Calamity', {R:4, C:1}) === 'ok', 'cast Invoke Calamity'); await after(); await after(); await after();
      const r = await A.evaluate(() => ({ex:S.ex.filter(c => /^(Lightning Bolt|Divination|Invoke Calamity)$/.test(cname(c))).map(cname), gy:S.gy.filter(c => /^(Lightning Bolt|Divination|Invoke Calamity)$/.test(cname(c))).map(cname)}));
      check(await life(B) === kl - 3, `Lightning Bolt hit Kim (${kl}→${await life(B)})`);
      check(r.ex.length === 3 && !r.gy.length, `Bolt, Divination and Invoke Calamity are all exiled (${JSON.stringify(r)})`);
      await clean();
    });
    await step('Locke (Mug): each player mills; a land → Treasure; Georges may cast one spell from among the milled cards', async () => {
      await put(A, 'Locke, Treasure Hunter'); await toZone(A, 'Forest', 'libtop'); await toZone(B, 'Lightning Bolt', 'libtop'); await after();
      await run(A, 'Each player mills a card. If a land card was milled this way, create a Treasure token. Until end of turn, you may cast a spell from among those cards.', 'Locke, Treasure Hunter'); await after();
      const r = await A.evaluate(pid => ({tr:S.bf.some(c => /Treasure/.test(cname(c))), bolt:S.ex.filter(c => cname(c) === 'Lightning Bolt' && c.own && c.own.pid === pid && exWindowOk(c)).length}), kimPid);
      check(r.tr, 'Georges milled Forest and created a Treasure');
      check(r.bolt === 1 && await B.evaluate(() => S.gy.some(c => cname(c) === 'Lightning Bolt')), `Kim milled Lightning Bolt and Georges may cast it (${JSON.stringify(r)})`);
      await clean();
    });
    await step('Dance with Calamity: exile two cards one at a time (total ≤ 13) and offer them free', async () => {
      await toHand(A, 'Dance with Calamity'); await after();
      await A.evaluate(() => { window.__dn = 2; const ay = askYes; window.__ay0 = ay; window.__cn0 = r21CastNow; askYes = async (t, y, n) => /exile the top card/i.test(t) ? (window.__dn-- > 0) : ay(t, y, n); window.__cn = []; r21CastNow = async (ctx, o) => { window.__cn.push({n:(ctx.r21ids || []).length, free:o.free}); }; });
      const ex0 = await A.evaluate(() => S.ex.length);
      check(await cast(A, 'Dance with Calamity', {R:8}) === 'ok', 'cast Dance with Calamity'); await after(); await after();
      const r = await A.evaluate(n => { askYes = window.__ay0; r21CastNow = window.__cn0; return {ex:S.ex.length - n, cn:window.__cn}; }, ex0);
      check(r.ex === 2 && r.cn.length === 1 && r.cn[0].n === 2 && r.cn[0].free, `exiled two cards and was offered both free (${JSON.stringify(r)})`);
      await clean();
    });
    await step('Avenger of the Fallen: mobilize X with two creature cards in the graveyard; Neyali grants play rights after a token attacked', async () => {
      await A.evaluate(() => { const cr = S.gy.filter(c => isCreatureCard(c)); S.gy = S.gy.filter(c => !isCreatureCard(c)); S.lib.push(...cr); commit(); });
      await toZone(A, 'Wall of Omens', 'gy'); await toZone(A, 'Elvish Mystic', 'gy'); await put(A, 'Avenger of the Fallen'); await after();
      const trig = await A.evaluate(() => trigsOf(S.bf.find(c => cname(c) === 'Avenger of the Fallen').k).some(t => t.ev === 'attack' && /mobilize x/i.test(t.eff)));
      check(trig, 'the attack trigger is detected');
      let w = -1; await combat(['Avenger of the Fallen'], {}, {}, {afterAtk:async () => { await after(); w = await A.evaluate(() => S.bf.filter(c => c.tok && /Warrior/.test(cname(c) + typeOf(c)) && c.atk).reduce((a, c) => a + (c.n || 1), 0)); }});
      check(w === 2, `attacking made two tapped and attacking Warrior tokens (${w})`);
      await A.evaluate(() => { S.bf.forEach(c => { c.atk = ''; }); S.bf.filter(c => c.tok).forEach(c => S.bf.splice(S.bf.indexOf(c), 1)); commit(); });
      await put(A, "Neyali, Suns' Vanguard"); await after();
      await run(A, 'Exile the top card of your library. During any turn you attacked with a token, you may play that card.', "Neyali, Suns' Vanguard"); await after();
      const n0 = await A.evaluate(() => S.ex.filter(c => c.mayPlay && c.mayPlay.a27ney).map(c => exWindowOk(c)));
      await A.evaluate(() => { createFromText('Create a 1/1 red Goblin creature token.', {}); commit(); }); await after();
      await combat(['Goblin']);
      const n1 = await A.evaluate(() => S.ex.filter(c => c.mayPlay && c.mayPlay.a27ney).map(c => exWindowOk(c)));
      check(n0.length === 1 && n0[0] === false && n1[0] === true, `Neyali's card is playable only after a token attacked this turn (${JSON.stringify(n0)} → ${JSON.stringify(n1)})`);
      await clean();
    });
    await step('Brave the Sands: Baneslayer blocks two attackers and divides its damage', async () => {
      await put(B, 'Brave the Sands'); await toHand(B, 'Baneslayer Angel'); await put(B, 'Baneslayer Angel'); await put(A, 'Llanowar Elves'); await put(A, 'Elvish Mystic'); await after();
      await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Baneslayer Angel'); c.tap = false; c.dmg = 0; commit(); });
      await combat(['Llanowar Elves', 'Elvish Mystic'], {'Baneslayer Angel':'Llanowar Elves'}, {'Baneslayer Angel':['Elvish Mystic']});
      const r = await A.evaluate(() => ({le:S.bf.some(c => cname(c) === 'Llanowar Elves'), em:S.bf.some(c => cname(c) === 'Elvish Mystic')}));
      const kl = await B.evaluate(() => ({life:S.life, split:window.__split || 0}));
      check(!r.le && !r.em, `both attackers died to the one blocker (${JSON.stringify(r)})`);
      check(kl.split >= 1, `Kim divided Baneslayer's damage (${JSON.stringify(kl)})`);
      await clean();
    });
    await step('Satoru Umezawa: a creature card in hand has ninjutsu {2}{U}{B}; activating it triggers Satoru', async () => {
      await put(A, 'Satoru Umezawa'); await put(A, 'Llanowar Elves'); await toHand(A, 'Elvish Mystic'); await after();
      const nj = await A.evaluate(() => ninjutsuOf(S.hand.find(c => cname(c) === 'Elvish Mystic')));
      check(nj && nj.cost === '{2}{U}{B}', `Elvish Mystic has ninjutsu {2}{U}{B} (${JSON.stringify(nj)})`);
      const h0 = await hand(A);
      await A.evaluate(() => { window.__want = null; });
      await combat(['Llanowar Elves'], {}, {}, {atBlkd:async () => { await A.evaluate(async () => { S.pool = {...emptyPool(), U:1, B:1, C:2}; await doNinjutsu(S.hand.find(c => cname(c) === 'Elvish Mystic'), 'hand'); commit(); }); await after(); }});
      const r = await A.evaluate(() => ({wall:S.bf.some(c => cname(c) === 'Elvish Mystic'), elves:S.hand.some(c => cname(c) === 'Llanowar Elves'), log:S.log.slice(-25).map(e => e.s).filter(s => /Satoru/.test(s))}));
      check(r.wall && r.elves, 'ninjutsu swapped Elvish Mystic in for Llanowar Elves');
      check(await hand(A) === h0 + 1 && r.log.length >= 1, `Satoru triggered: one of the top three went to hand (hand ${h0}→${await hand(A)}; ${JSON.stringify(r.log)})`);
      await clean();
    });
    await step('Illusionist\'s Gambit: Kim removes Georges\'s attackers; they must attack again but not her', async () => {
      await put(A, 'Llanowar Elves'); await toHand(B, "Illusionist's Gambit"); await after();
      const early = await B.evaluate(() => castCheck(S.hand.find(c => cname(c) === "Illusionist's Gambit"), 'hand'));
      check(early && early.ok === false, `can't be cast outside the declare blockers step (${JSON.stringify(early)})`);
      const kl = await life(B);
      await combat(['Llanowar Elves'], {}, {}, {atBlkd:async () => { const r = await cast(B, "Illusionist's Gambit", {U:2, C:2}); check(r === 'ok', `Kim cast Illusionist's Gambit during declare blockers (${r})`); await after(); }});
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Llanowar Elves'); return {atk:c.atk, tap:c.tap, xc:S.xc || 0, g:!!c.a27g, why:canAttack(c)}; });
      check(await life(B) === kl, `no combat damage to Kim (${kl}→${await life(B)})`);
      check(!r.atk && !r.tap && r.xc > 0, `Llanowar Elves was removed from combat and untapped, and an additional combat was added (the attack restriction applies in that combat, since v20) (${JSON.stringify(r)})`);
      await clean();
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
