// Round 20 helper Q: taking opponents' cards — the rest. Real 2-player and 3-player games:
// Etali (both), Expropriate, Laughing Jasper Flint, Dack Fayden's emblem, Coveted Jewel, Assault Suit, Inevitable Betrayal,
// Oft-Nabbed Goat, Varchild; overlapping control effects in timestamp order (CR 613.7); Auras / Equipment keep their
// attachment when someone gains control of them (CR 301.5c, 303.4).
// PTPORT=19710 PTFILE=dev20Q.html node r20b.js   (ONLY=<substring> to run some cases, NO3=1 to skip 3-player)
process.env.TOP = '1';
const CC = require('./cards');
const X = (name, mana, cmc, type, text, p, t) => ({object:'card', id:'id-x20-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, mana_cost:mana, cmc, type_line:type, oracle_text:text,
  colors:[...new Set((mana.match(/[WUBRG]/g) || []))], color_identity:[...new Set((mana.match(/[WUBRG]/g) || []))], keywords:[], layout:'normal', set:'tst', collector_number:'20' + cmc, set_name:'Test', released_at:'2024-01-01', power:p, toughness:t, prices:{usd:'1'}});
const EXTRA = [
  X('Confiscate', '{4}{U}{U}', 6, 'Enchantment — Aura', 'Enchant permanent\nYou control enchanted permanent.'),
  X('Test Hulk', '{5}{G}', 6, 'Creature — Beast', '', '5', '5'),
  X('Test Might', '{G}', 1, 'Enchantment — Aura', 'Enchant creature\nEnchanted creature gets +2/+2.'),
  X('Test Ox', '{3}', 3, 'Artifact Creature — Ox', '{T}: Add {C}.', '3', '3'),
];
const WANT = ['Etali, Primal Storm', 'Etali, Primal Conqueror // Etali, Primal Sickness', 'Expropriate', 'Laughing Jasper Flint', 'Dack Fayden', 'Coveted Jewel', 'Assault Suit',
  'Inevitable Betrayal', 'Oft-Nabbed Goat', 'Varchild, Betrayer of Kjeldor', 'Reins of Power', 'Agent of Treachery', 'Act of Treason', 'Sower of Temptation', 'Swiftfoot Boots',
  'Grizzly Bears', 'Llanowar Elves', 'Mind Stone', 'Giant Growth', 'Lightning Bolt', 'Island', 'Forest', 'Mountain', 'Plains', 'Swamp', 'Sol Ring', 'Shivan Dragon', 'Opt', 'Viscera Seer',
  'Edgar Markov', 'Thalia, Guardian of Thraben', 'Krenko, Mob Boss', 'Treasure', 'Darksteel Ingot', 'Arcane Signet'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
CC.cards.push(...EXTRA.filter(c => !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, waitFor} = H;
const AUTO = () => { setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (window.__dbg) console.error('MODAL', m.type, m.title, JSON.stringify((m.options || []).map(o => o.label)));
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){
      const q = window.__tq || []; const ok = (m.cands || []).filter(x => x.ok); let picks = [];
      const q0n = q.length; const want = (m.spec && m.spec.n > 1 && m.spec.n < 99) ? m.spec.n : 1;
      while (q.length && picks.length < want){ const e = q[0]; const re = new RegExp(e.re, 'i'); const got = ok.filter(x => !picks.includes(x) && re.test(x.nm) && (!e.who || (e.who === 'me' ? x.pid === MYPID : e.who === 'opp' ? x.pid !== MYPID : x.pid === e.who))).slice(0, e.n || 1); picks.push(...got); q.shift(); if ((e.n || 1) > 1) break; }
      if (q0n && !picks.length) console.error('AUTO nopick', m.title, JSON.stringify((m.cands || []).map(x => [x.nm, x.ok, x.why, x.pid === MYPID])));
      if (!q0n) picks = m.spec && m.spec.upTo ? [] : ok.filter(x => x.pid !== MYPID).slice(0, 1);
      m.__done = 1; m.resolve(picks); closeModal(); }
    else if (m.type === 'zone' && m.onClose){ m.__done = 1; closeModal(); }
    else if (m.type === 'yes' && m.resolve){ m.__done = 1; m.resolve(window.__no ? false : true); closeModal(); }
    else if (m.run){ m.__done = 1; const d = window.__num != null ? window.__num : (m.def ?? 1); m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 100); };
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
let ALL = []; const RES = {};
const step = async (name, fn) => { if (process.env.ONLY && !process.env.ONLY.split(',').some(o => name.includes(o))) return; console.log('— ' + name); const f0 = H.fails();
  try { await T(120000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  RES[name] = H.fails() === f0;
  if (H.fails() > f0 || process.env.LOGS) for (const [nm, p] of ALL) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-16).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})).catch(e => e.message))); };
const passAll = async (ps) => { for (let i = 0; i < 5; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(150); } };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const kOf = (p, nm) => p.evaluate(nm => [...DICT.values()].find(a => a.n === nm || String(a.n).split(' // ')[0] === nm)?.k, nm);
const putBf = (p, nm, extra) => p.evaluate(([nm, extra]) => { const a = [...DICT.values()].find(a => a.n === nm) || [...DICT.values()].find(a => String(a.n).split(' // ')[0] === nm.split(' // ')[0]); if (!a) return null; const c = {id:S.nid++, k:a.k, x:20 + (S.nid % 30) * 3, y:30, sk:false, ...(extra || {})}; S.bf.push(c); commit(); return c.id; }, [nm, extra]);
const libTop = (p, names) => p.evaluate(names => { for (const nm of names.slice().reverse()){ const a = [...DICT.values()].find(a => a.n === nm); S.lib.unshift({id:S.nid++, k:a.k}); } commit(); }, names);
const FULL = {W:9, U:9, B:9, R:9, G:9, C:9};
const cast = (p, nm, o = {}) => p.evaluate(async ([nm, o, FULL]) => { let c = S.hand.find(x => cname(x) === nm); if (!c){ const a = [...DICT.values()].find(a => a.n === nm || String(a.n).split(' // ')[0] === nm); c = {id:S.nid++, k:a.k}; S.hand.push(c); }
  S.pool = {...emptyPool(), ...FULL}; commit(); await beginCast(c, 'hand', o.x != null ? {x:o.x} : (o.free ? {free:true} : undefined)); return S.hand.includes(c) ? 'not cast' : 'ok'; }, [nm, o, FULL]);
const activate = (p, nm, re) => p.evaluate(async ([nm, re, FULL]) => { const c = S.bf.find(x => cname(x) === nm); if (!c) return 'missing'; c.sk = false; c.tap = false; S.pool = {...emptyPool(), ...FULL}; const ab = (abilityList(c) || []).find(a => new RegExp(re, 'i').test(a.eff || a.text || '')); if (!ab) return 'no ability: ' + (abilityList(c) || []).map(a => a.eff).join(' / '); const n0 = S.stk.length, l0 = S.log.length; const why = abilityReady(c, ab); await activateAbility(c, ab); return S.stk.length > n0 || S.log.length > l0 ? 'ok' : 'not activated: ' + why; }, [nm, re, FULL]);
const where = async (k) => { const out = []; for (const [nm, p] of ALL) out.push(await p.evaluate(([k, nm]) => { const r = []; for (const z of ['bf', 'gy', 'hand', 'ex', 'cz', 'lib']) for (const c of S[z]) if (c.k === k) r.push(nm + ':' + z + (c.own ? '(own ' + nameOf(c.own.pid) + ')' : '')); return r; }, [k, nm])); return out.flat(); };
const tq = (p, q) => p.evaluate(q => { window.__tq = q; }, q);
const want = (p, w) => p.evaluate(w => { window.__want = w; }, w);
const logHas = (p, re) => p.evaluate(re => S.log.slice(-40).some(e => new RegExp(re, 'i').test(e.s)), re);

(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    if (!process.env.ONLY3){
    const G = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r20b');
    const K = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r20b');
    ALL = [['Georges', G], ['Kim', K]]; const P2 = [G, K]; if (process.env.DBG) for (const p of P2) await p.evaluate(() => { window.__dbg = 1; });
    await waitFor(G, () => OPP.size === 1, null, 20000); await G.evaluate(AUTO); await K.evaluate(AUTO);
    await G.click('[data-act="goFirst"]'); await settle(P2);
    const GP = await G.evaluate(() => MYPID), KP = await K.evaluate(() => MYPID);
    const PL = {Georges:G, Kim:K}, PID = {Georges:GP, Kim:KP};
    const toMain = async (p) => { for (let i = 0; i < 60; i++){ if (await p.evaluate(() => phaseNow().mine && phaseNow().ph === 3 && !stackAll().length)) return true; await p.evaluate(() => { if (!stackAll().length && !UI.modal && phaseNow().mine) nextAction(); }); await passAll(P2); } return false; };
    await toMain(G);
    const after = async () => { await sleep(300); await settle(P2); await sleep(900); await settle(P2); await sleep(400); };
    const wipe = async () => { for (const p of P2) await p.evaluate(() => { UI.modal = null; window.__tq = []; window.__want = null; window.__no = false; window.__num = null; S.bf = []; S.lent = []; S.hand = []; S.gy = []; S.ex = []; S.stk = []; S.prm = []; S.xt = 0; commit(); }); await sleep(900); };
    const fresh = async () => { await wipe(); if (!(await G.evaluate(() => phaseNow().mine))){ await K.evaluate(() => passTurn()); await sleep(1200); } await toMain(G); await wipe(); };
    const gPass = async () => { await G.evaluate(() => passTurn()); await sleep(1500); await settle(P2); await sleep(500); };
    const kPass = async () => { await toMain(K); await K.evaluate(() => passTurn()); await sleep(1500); await settle(P2); await toMain(G); await sleep(500); };
    // nm is on ctl's battlefield (owned by owner), nowhere else, and both clients agree
    const expectCtl = async (nm, ctl, owner, msg) => {
      const k = await kOf(G, nm); const cp = PL[ctl], ownPid = PID[owner], ctlPid = PID[ctl], same = owner === ctl;
      await waitFor(cp, ([k, op, same]) => S.bf.some(c => c.k === k && (same ? !c.own : c.own && c.own.pid === op)), [k, ownPid, same], 7000); await sleep(500);
      const onCtl = await cp.evaluate(([k, op, same]) => S.bf.filter(c => c.k === k && (same ? !c.own : (c.own && c.own.pid === op))).length, [k, ownPid, same]);
      const views = []; for (const [, p] of ALL) views.push(await p.evaluate(([k]) => { const r = {}; r[MYPID] = S.bf.filter(c => c.k === k).length; for (const [pid, st] of OPP) r[pid] = (st.bf || []).filter(c => c.k === k).length; return r; }, [k]));
      const seen = views.every(v => Object.entries(v).every(([p, n]) => n === (p === ctlPid ? 1 : 0)));
      const w = (await where(k)).filter(x => /:bf/.test(x));
      check(onCtl === 1 && seen && w.length === 1, `${msg || nm + ': ' + ctl + ' controls ' + owner + "'s card"} (ctl=${onCtl} bf=[${w}] views=${JSON.stringify(views)})`); return onCtl === 1;
    };
    const attackWith = async (A, D, names, dpid) => {
      await A.evaluate(() => setPhase(4));
      for (let i = 0; i < 30 && !(await A.evaluate(() => S.cb && S.cb.step === 'atk')); i++){ await passAll(P2); await A.evaluate(() => { if (S.cb && S.cb.step !== 'atk' && !stackAll().length) nextAction(); }); await sleep(150); }
      await A.evaluate(([names, dpid]) => { const sel = {}; for (const nm of names){ const c = S.bf.find(x => cname(x) === nm); if (c) sel[c.id] = 'p:' + dpid; } UI.atkSel = sel; renderCombatPanel(); }, [names, dpid]);
      await A.click('#cbpanel [data-act="atkGo"]').catch(e => console.log('atkGo', e.message)); await sleep(400); await passAll(P2);
      if (await waitFor(D, () => !!document.querySelector('#cbpanel [data-act="blkGo"]'), null, 8000)) await D.click('#cbpanel [data-act="blkGo"]');
      for (let i = 0; i < 12; i++){ await passAll(P2); await sleep(150); }
      await settle(P2); await sleep(800); await settle(P2);
    };
    const runT = (p, txt, nm, tg) => p.evaluate(async ([txt, nm, tg]) => { const src = S.bf.find(x => cname(x) === nm); const k = src ? src.k : [...DICT.values()].find(a => a.n === nm)?.k;
      const tgts = (tg || []).map(g => g.map(re => { if (re === 'opp'){ const [pid] = [...OPP.keys()]; return {t:'player', pid, nm:nameOf(pid)}; } for (const b of boardsAll()) for (const c of b.bf) if (new RegExp(re).test(cname(c))) return {t:'card', pid:b.pid, id:c.id, k:c.k, nm:cname(c)}; return null; }).filter(Boolean));
      await runEffects(txt, {k, name:nm, srcId:src ? src.id : undefined, full:txt, tgts, it:{kind:'spell'}}); commit(); return 'ok'; }, [txt, nm, tg]);

    // ================= 1. the cards
    await step('Etali, Primal Storm attacks: exiles the top card of each library, Georges casts Kim\'s creature and his own for free', async () => {
      await fresh(); await libTop(G, ['Mind Stone']); await libTop(K, ['Grizzly Bears']); await putBf(G, 'Etali, Primal Storm'); await sleep(800);
      const l0 = await K.evaluate(() => S.lib.length);
      await attackWith(G, K, ['Etali, Primal Storm'], KP); await sleep(1500); await settle(P2);
      await expectCtl('Grizzly Bears', 'Georges', 'Kim', 'Etali: Georges cast Kim\'s Grizzly Bears — it is his, owned by Kim');
      await expectCtl('Mind Stone', 'Georges', 'Georges', 'Etali: Georges cast his own Mind Stone');
      check(await K.evaluate(l0 => S.lib.length === l0 - 1, l0), 'Kim\'s library lost exactly its top card');
      await G.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); destroyCard(c, 'test'); commit(); }); await after();
      check(await K.evaluate(() => S.gy.some(c => cname(c) === 'Grizzly Bears')) && !(await G.evaluate(() => S.gy.some(c => cname(c) === 'Grizzly Bears'))), 'the Bears died → Kim\'s graveyard');
      await G.evaluate(() => { if (S.cb) setPhase(5); }); await settle(P2); await toMain(G).catch(() => {});
    });
    await step('Etali, Primal Conqueror enters: each player exiles until a nonland card; Georges casts both free', async () => {
      await fresh(); await libTop(G, ['Forest', 'Mind Stone']); await libTop(K, ['Island', 'Grizzly Bears']); await sleep(600);
      check(await cast(G, 'Etali, Primal Conqueror') === 'ok', 'Etali cast'); await after(); await sleep(1500); await after();
      await expectCtl('Grizzly Bears', 'Georges', 'Kim', 'Etali, Primal Conqueror: Georges cast Kim\'s Grizzly Bears');
      await expectCtl('Mind Stone', 'Georges', 'Georges', 'Etali, Primal Conqueror: Georges cast his Mind Stone');
      check(await K.evaluate(() => S.ex.some(c => cname(c) === 'Island')), 'Kim\'s Island stays in her exile');
    });
    await step('Dack Fayden\'s emblem: a spell that targets Kim\'s permanent → Georges gains control of it', async () => {
      await fresh(); await putBf(G, 'Dack Fayden', {co:6}); await putBf(K, 'Grizzly Bears'); await putBf(K, 'Mind Stone'); await sleep(800);
      const r = await G.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Dack Fayden'); const i = loyaltyAbs(c).findIndex(a => /emblem/i.test(a.eff)); if (i < 0) return 'no -6'; await activateLoyalty(c, i); return 'ok'; });
      check(r === 'ok', 'Dack −6 activated'); await after();
      check(await G.evaluate(() => S.bf.some(c => c.emb)), 'Georges has the emblem');
      await tq(G, [{re:'Grizzly Bears', who:'opp'}]); check(await cast(G, 'Giant Growth') === 'ok', 'Giant Growth on Kim\'s Bears'); await after(); await sleep(800); await after();
      await expectCtl('Grizzly Bears', 'Georges', 'Kim', 'Dack emblem: Georges controls Kim\'s Bears');
      check(await G.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); return c && stats(c)[0] === 5; }), 'and the Giant Growth still resolved on it (5/5)');
      await gPass(); await kPass(); await expectCtl('Grizzly Bears', 'Georges', 'Kim', 'Dack emblem: still Georges\'s a turn cycle later (no duration)');
      await tq(G, [{re:'Kim', who:'opp'}]); await cast(G, 'Opt'); await after(); await sleep(500);
      await expectCtl('Mind Stone', 'Kim', 'Kim', 'a spell that targets only a player takes nothing');
    });
    await step('Coveted Jewel: Kim attacks Georges unblocked → Kim draws three and gains control of the Jewel, untapped', async () => {
      await fresh(); await putBf(G, 'Coveted Jewel', {tap:true}); await sleep(500); await gPass(); await toMain(K); await putBf(K, 'Grizzly Bears'); await sleep(800);
      const h0 = await K.evaluate(() => S.hand.length);
      await attackWith(K, G, ['Grizzly Bears'], GP); await sleep(1500); await settle(P2);
      await expectCtl('Coveted Jewel', 'Kim', 'Georges', 'Coveted Jewel: Kim controls Georges\'s Jewel');
      check(await K.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Coveted Jewel'); return c && !c.tap; }), 'the Jewel is untapped');
      check(await K.evaluate(h0 => S.hand.length === h0 + 3, h0), `Kim drew three (${h0} → ${await K.evaluate(() => S.hand.length)})`);
      await K.evaluate(() => { if (S.cb) setPhase(5); }); await settle(P2); await K.evaluate(() => passTurn()); await sleep(1500); await settle(P2); await toMain(G);
      await expectCtl('Coveted Jewel', 'Kim', 'Georges', 'Coveted Jewel: still Kim\'s on Georges\'s turn (no duration)');
    });
    await step('Assault Suit: at Kim\'s upkeep she gains control of the equipped creature until end of turn; the Suit stays on it; can\'t attack Georges or be sacrificed', async () => {
      await fresh(); const hid = await putBf(G, 'Test Hulk', {tap:true}); await putBf(G, 'Assault Suit'); await G.evaluate(hid => { const s = S.bf.find(x => cname(x) === 'Assault Suit'); s.att = {pid:MYPID, id:hid}; commit(); }, hid); await sleep(800);
      const mine = await G.evaluate(kp => { const c = S.bf.find(x => cname(x) === 'Test Hulk'); c.sk = false; c.tap = false; UI.atkSel = {[c.id]:'p:' + kp}; const e = p24AtkPlan(); UI.atkSel = {}; const can = canAttack(c); c.tap = true; commit(); return {can, plan:e, st:stats(c), haste:hasHaste(c)}; }, KP);
      check(!mine.can && !mine.plan && mine.st[0] === 7, `on Georges's side the equipped Hulk may attack Kim (${JSON.stringify(mine)})`);
      await G.evaluate(() => passTurn()); await sleep(2500); await settle(P2); await sleep(800); await settle(P2);
      await expectCtl('Test Hulk', 'Kim', 'Georges', 'Assault Suit: Kim controls Georges\'s Test Hulk in her turn');
      const kid = await K.evaluate(() => S.bf.find(x => cname(x) === 'Test Hulk')?.id);
      const att = await G.evaluate(() => S.bf.find(x => cname(x) === 'Assault Suit')?.att);
      check(att && att.pid === KP && att.id === kid, `the Suit (Georges's) stays attached to the Hulk on Kim's side (${JSON.stringify(att)})`);
      const s = await K.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Test Hulk'); return {tap:!!c.tap, st:stats(c), haste:hasHaste(c)}; });
      check(!s.tap && s.st[0] === 7 && s.haste, `untapped, 7/7 with haste on Kim's side (${JSON.stringify(s)})`);
      const sac = await K.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Test Hulk'); sacrificeOne(c); commit(); return S.bf.includes(c); });
      check(sac, 'Kim can\'t sacrifice the equipped Hulk');
      const atk = await K.evaluate(gp => { const c = S.bf.find(x => cname(x) === 'Test Hulk'); UI.atkSel = {[c.id]:'p:' + gp}; const e = p24AtkPlan(); UI.atkSel = {}; return {can:canAttack(c), plan:e}; }, GP);
      check(!atk.can && /can't attack/.test(atk.plan), `the Hulk can attack in general but not Georges (${JSON.stringify(atk)})`);
      const own = await G.evaluate(() => 0);
      await K.evaluate(() => { if (S.cb) setPhase(5); }); await settle(P2); await K.evaluate(() => passTurn()); await sleep(1800); await settle(P2); await toMain(G);
      await expectCtl('Test Hulk', 'Georges', 'Georges', 'Assault Suit: the Hulk came back to Georges at end of turn');
      const att2 = await G.evaluate(() => { const s = S.bf.find(x => cname(x) === 'Assault Suit'); const h = S.bf.find(x => cname(x) === 'Test Hulk'); return s && h && s.att && s.att.pid === MYPID && s.att.id === h.id; });
      check(att2, 'and the Suit is still attached to it');
    });
    await step('Laughing Jasper Flint: a stolen creature is a Mercenary (outlaw); at upkeep X of Kim\'s cards are exiled and Georges may cast them with any mana', async () => {
      await fresh(); await putBf(G, 'Laughing Jasper Flint'); await putBf(K, 'Grizzly Bears'); await sleep(800);
      await tq(G, [{re:'Grizzly Bears', who:'opp'}]); await cast(G, 'Agent of Treachery'); await after();
      await expectCtl('Grizzly Bears', 'Georges', 'Kim');
      check(await G.evaluate(() => /Mercenary/.test(typeOf(S.bf.find(x => cname(x) === 'Grizzly Bears')))), 'the stolen Bears is a Mercenary');
      check(await G.evaluate(() => !/Mercenary/.test(typeOf(S.bf.find(x => cname(x) === 'Agent of Treachery')))), 'Georges\'s own Agent is not');
      await gPass(); await toMain(K); await libTop(K, ['Lightning Bolt', 'Shivan Dragon', 'Opt']); await tq(G, [{re:'Kim', who:'opp'}]); await kPass(); await sleep(1500); await settle(P2);
      const ex = await G.evaluate(() => S.ex.filter(c => c.own).map(c => ({n:cname(c), play:!!c.mayPlay})));
      check(ex.length === 3 && ex.every(x => x.play), `three of Kim's cards exiled (outlaws: Jasper, the Agent (Rogue), the Bears (Mercenary)), playable (${JSON.stringify(ex)})`);
      const l0 = await K.evaluate(() => S.life); await tq(G, [{re:'Kim', who:'opp'}]);
      const r = await G.evaluate(async () => { const c = S.ex.find(x => cname(x) === 'Lightning Bolt'); if (!c) return 'no bolt'; S.pool = {...emptyPool(), U:1}; commit(); await beginCast(c, 'ex'); return S.ex.includes(c) ? 'not cast' : 'ok'; });
      check(r === 'ok', `Georges cast Kim's Lightning Bolt with blue mana (${r})`); await after();
      check(await K.evaluate(l0 => S.life === l0 - 3, l0), 'Kim took 3');
    });
    await step('Inevitable Betrayal: Kim\'s creature card from her library enters under Georges\'s control', async () => {
      await fresh(); await K.evaluate(() => { S.lib = S.lib.filter(c => !isCreatureCard(c)); commit(); }); await libTop(K, ['Island', 'Shivan Dragon']); await sleep(500);
      await want(G, 'Shivan Dragon'); await tq(G, [{re:'Kim', who:'opp'}]);
      await G.evaluate(async () => { const a = [...DICT.values()].find(a => a.n === 'Inevitable Betrayal'); const c = {id:S.nid++, k:a.k}; S.hand.push(c); commit(); await beginCast(c, 'hand', {free:true}); });
      await after(); await sleep(1500); await after();
      await expectCtl('Shivan Dragon', 'Georges', 'Kim', 'Inevitable Betrayal: Georges controls Kim\'s Shivan Dragon');
    });
    await step('Oft-Nabbed Goat: Georges activates Kim\'s Goat, draws, gains control with a -1/-1 counter', async () => {
      await fresh(); await putBf(K, 'Oft-Nabbed Goat'); await sleep(900); const h0 = await G.evaluate(() => S.hand.length);
      const r = await G.evaluate(async () => { const x = c27OppAbs().find(x => /Goat/.test(x.nm)); if (!x) return 'none'; S.pool = {...emptyPool(), C:3}; commit(); await c27OppActivate(x.pid, x.c.id); return 'ok'; });
      console.log('    goat activation:', r); await after(); await sleep(800); await after();
      await expectCtl('Oft-Nabbed Goat', 'Georges', 'Kim', 'Oft-Nabbed Goat: Georges controls Kim\'s Goat');
      check(await G.evaluate(() => S.bf.find(x => cname(x) === 'Oft-Nabbed Goat')?.cm === 1), 'with a -1/-1 counter');
      check(await G.evaluate(h0 => S.hand.length === h0 + 1, h0), 'Georges drew a card');
    });
    await step('Varchild: combat damage → Kim gets Survivors; Varchild leaves → Georges gains control of all Survivors', async () => {
      await fresh(); await putBf(G, 'Varchild, Betrayer of Kjeldor'); await sleep(700);
      await attackWith(G, K, ['Varchild, Betrayer of Kjeldor'], KP); await sleep(1200); await settle(P2);
      const n = await K.evaluate(() => S.bf.filter(c => /Survivor/.test(cname(c))).reduce((a, c) => a + (c.n || 1), 0)); check(n === 3, `Kim has 3 Survivor tokens (${n})`);
      await G.evaluate(() => { if (S.cb) setPhase(5); }); await settle(P2); await toMain(G).catch(() => {});
      await G.evaluate(() => { const c = S.bf.find(x => /Varchild/.test(cname(x))); moveCard(c.id, 'gy'); commit(); }); await after(); await sleep(1000); await after();
      const g = await G.evaluate(() => S.bf.filter(c => /Survivor/.test(cname(c)) && c.own).reduce((a, c) => a + (c.n || 1), 0)); check(g === 3, `Georges controls the 3 Survivors (${g})`);
      check(await K.evaluate(() => !S.bf.some(c => /Survivor/.test(cname(c)))), 'Kim has none left');
    });

    // ================= 2. overlapping control effects (CR 613.7)
    await step('Timestamps: Georges steals Kim\'s Bears for good; Kim\'s Reins of Power takes Georges\'s creatures until end of turn; at end of turn the Bears go back to Georges', async () => {
      await fresh(); await putBf(K, 'Grizzly Bears'); await putBf(G, 'Test Hulk'); await sleep(800);
      await tq(G, [{re:'Grizzly Bears', who:'opp'}]); await cast(G, 'Agent of Treachery'); await after();
      await expectCtl('Grizzly Bears', 'Georges', 'Kim');
      await gPass(); await toMain(K);
      await tq(K, [{re:'Georges', who:'opp'}]); check(await cast(K, 'Reins of Power') === 'ok', 'Kim casts Reins of Power'); await after(); await sleep(800);
      await expectCtl('Grizzly Bears', 'Kim', 'Kim', 'Reins: Kim controls her Bears until end of turn');
      await expectCtl('Test Hulk', 'Kim', 'Georges', 'Reins: Kim controls Georges\'s Test Hulk');
      await expectCtl('Agent of Treachery', 'Kim', 'Georges', 'Reins: Kim controls Georges\'s Agent');
      await K.evaluate(() => passTurn()); await sleep(1800); await settle(P2); await toMain(G);
      await expectCtl('Grizzly Bears', 'Georges', 'Kim', 'end of turn: the Bears go back to Georges (his earlier, permanent effect applies again)');
      await expectCtl('Test Hulk', 'Georges', 'Georges', 'end of turn: the Hulk goes back to Georges');
      await gPass(); await kPass(); await expectCtl('Grizzly Bears', 'Georges', 'Kim', 'a turn cycle later the Bears are still Georges\'s');
    });
    await step('Timestamps: Act of Treason, then Agent of Treachery on the same creature → Georges keeps it after end of turn', async () => {
      await fresh(); await putBf(K, 'Grizzly Bears'); await sleep(700);
      await tq(G, [{re:'Grizzly Bears', who:'opp'}]); await cast(G, 'Act of Treason'); await after(); await expectCtl('Grizzly Bears', 'Georges', 'Kim');
      await tq(G, [{re:'Grizzly Bears', who:'me'}]); await cast(G, 'Agent of Treachery'); await after();
      await gPass(); await expectCtl('Grizzly Bears', 'Georges', 'Kim', 'after end of turn the Bears stay with Georges (the later effect has no duration)'); await kPass();
    });
    await step('Timestamps: Sower of Temptation steals; Reins hands it back to Kim until end of turn; it returns to Georges; then Sower leaves → back to Kim', async () => {
      await fresh(); await putBf(K, 'Grizzly Bears'); await sleep(700);
      await tq(G, [{re:'Grizzly Bears', who:'opp'}]); await cast(G, 'Sower of Temptation'); await after(); await expectCtl('Grizzly Bears', 'Georges', 'Kim');
      await gPass(); await toMain(K); await tq(K, [{re:'Georges', who:'opp'}]); await cast(K, 'Reins of Power'); await after(); await sleep(800);
      await expectCtl('Grizzly Bears', 'Kim', 'Kim', 'Reins: the Bears are Kim\'s until end of turn');
      await K.evaluate(() => passTurn()); await sleep(1800); await settle(P2); await toMain(G);
      await expectCtl('Sower of Temptation', 'Georges', 'Georges', 'the Sower is back with Georges');
      await expectCtl('Grizzly Bears', 'Georges', 'Kim', 'the Bears are back with Georges (Sower still there)');
      await G.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Sower of Temptation'); moveCard(c.id, 'gy'); commit(); }); await after(); await sleep(800);
      await expectCtl('Grizzly Bears', 'Kim', 'Kim', 'Sower left: the Bears go home to Kim');
    });

    // ================= 3. Auras / Equipment keep their attachment
    await step('Dack −2 takes Kim\'s Swiftfoot Boots while they equip her Bears: the Boots stay on the Bears', async () => {
      await fresh(); const bid = await putBf(K, 'Grizzly Bears'); await putBf(K, 'Swiftfoot Boots'); await K.evaluate(id => { const b = S.bf.find(x => cname(x) === 'Swiftfoot Boots'); b.att = {pid:MYPID, id}; commit(); }, bid); await sleep(800);
      await putBf(G, 'Dack Fayden', {co:3}); await tq(G, [{re:'Swiftfoot Boots', who:'opp'}]);
      await G.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Dack Fayden'); const i = loyaltyAbs(c).findIndex(a => /gain control/i.test(a.eff)); await activateLoyalty(c, i); }); await after(); await sleep(800);
      await expectCtl('Swiftfoot Boots', 'Georges', 'Kim', 'Georges controls Kim\'s Boots');
      const att = await G.evaluate(() => S.bf.find(x => cname(x) === 'Swiftfoot Boots')?.att);
      check(att && att.pid === KP && att.id === bid, `the Boots stay attached to Kim's Bears (${JSON.stringify(att)})`);
      check(await K.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); return kwOf(c, 'hexproof') && hasHaste(c); }), 'Kim\'s Bears still have hexproof and haste');
    });
    await step('Confiscate takes Kim\'s Aura on her Bears: the Aura stays on the Bears; Confiscate leaves → the Aura goes back, still attached', async () => {
      await fresh(); const bid = await putBf(K, 'Grizzly Bears'); await putBf(K, 'Test Might'); await K.evaluate(id => { const b = S.bf.find(x => cname(x) === 'Test Might'); b.att = {pid:MYPID, id}; commit(); }, bid); await sleep(800);
      await tq(G, [{re:'Test Might', who:'opp'}]); check(await cast(G, 'Confiscate') === 'ok', 'Confiscate cast'); await after(); await sleep(800);
      await expectCtl('Test Might', 'Georges', 'Kim', 'Georges controls Kim\'s Test Might');
      const att = await G.evaluate(() => S.bf.find(x => cname(x) === 'Test Might')?.att);
      check(att && att.pid === KP && att.id === bid, `Test Might stays attached to Kim's Bears (${JSON.stringify(att)})`);
      check(await K.evaluate(() => stats(S.bf.find(x => cname(x) === 'Grizzly Bears'))[0] === 4), 'Kim\'s Bears are still 4/4');
      await G.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Confiscate'); moveCard(c.id, 'gy'); commit(); }); await after(); await sleep(800);
      await expectCtl('Test Might', 'Kim', 'Kim', 'Confiscate left: Test Might is Kim\'s again');
      check(await K.evaluate(() => { const a = S.bf.find(x => cname(x) === 'Test Might'); const b = S.bf.find(x => cname(x) === 'Grizzly Bears'); return a && b && a.att && a.att.pid === MYPID && a.att.id === b.id; }), 'and still on her Bears');
    });

    const ok = Object.values(RES).filter(Boolean).length; console.log(`\n2-player cases: ${ok}/${Object.keys(RES).length} fully passed`);
    for (const [k, v] of Object.entries(RES)) if (!v) console.log('   FAILED: ' + k);
    for (const p of P2) await p.context().close();
    }

    // ================= 3-player
    if (!process.env.NO3){
      const names = ['Georges', 'Kim', 'Ana']; const P = [];
      for (let i = 0; i < 3; i++){ P.push(await H.player(browser, names[i], H.deckFor(['Edgar Markov', 'Thalia, Guardian of Thraben', 'Krenko, Mob Boss'][i]), i ? 'join' : 'host', 'r20b3')); await sleep(300); }
      for (const p of P) await waitFor(p, () => OPP.size === 2, null, 30000);
      ALL = names.map((n, i) => [n, P[i]]); const [G3, K3, A3] = P; for (const p of P) await p.evaluate(AUTO);
      await G3.click('[data-act="goFirst"]'); await settle(P);
      const pid = {}; for (let i = 0; i < 3; i++) pid[names[i]] = await P[i].evaluate(() => MYPID);
      const toMain3 = async () => { for (let i = 0; i < 60; i++){ if (await G3.evaluate(() => phaseNow().mine && phaseNow().ph === 3 && !stackAll().length)) return true; await G3.evaluate(() => { if (!stackAll().length && !UI.modal && phaseNow().mine) nextAction(); }); await passAll(P); } return false; };
      await toMain3();
      const wipe3 = async () => { for (const p of P) await p.evaluate(() => { UI.modal = null; window.__tq = []; window.__want = null; S.bf = []; S.lent = []; S.hand = []; S.gy = []; S.ex = []; S.stk = []; S.prm = []; S.xt = 0; commit(); }); await sleep(1000); };
      const after3 = async () => { await sleep(300); await settle(P); await sleep(1000); await settle(P); await sleep(500); };
      const on3 = async (nm, who, owner) => {
        const k = await kOf(G3, nm); const wp = P[names.indexOf(who)]; const op = pid[owner];
        await waitFor(wp, ([k, op, same]) => S.bf.some(c => c.k === k && (same ? !c.own : c.own && c.own.pid === op)), [k, op, who === owner], 7000); await sleep(700);
        const views = []; for (const p of P) views.push(await p.evaluate(([k]) => { const r = {}; r[MYPID] = S.bf.filter(c => c.k === k).length; for (const [pid, st] of OPP) r[pid] = (st.bf || []).filter(c => c.k === k).length; return r; }, [k]));
        const good = views.every(v => Object.entries(v).every(([p, n]) => n === (p === pid[who] ? 1 : 0)));
        check(good, `${nm} is on ${who}'s battlefield (owner ${owner}) on all 3 clients (${JSON.stringify(views)})`);
      };
      const st3 = async (name, fn) => { await step(name, async () => { await wipe3(); await fn(); }); };
      await st3('3p Expropriate: Georges votes money, Kim time, Ana money → one extra turn; Georges takes a permanent Ana owns (and keeps his own)', async () => {
        await putBf(K3, 'Grizzly Bears'); await putBf(A3, 'Mind Stone'); await putBf(A3, 'Llanowar Elves'); await putBf(G3, 'Sol Ring'); await sleep(1000);
        await want(G3, '^money|Mind Stone'); await want(K3, '^time'); await want(A3, '^money');
        check(await cast(G3, 'Expropriate') === 'ok', 'Expropriate cast'); await after3(); await sleep(2500); await after3();
        check(await G3.evaluate(() => S.xt === 1), `Georges will take one extra turn (${await G3.evaluate(() => S.xt)})`);
        await on3('Mind Stone', 'Georges', 'Ana'); await on3('Llanowar Elves', 'Ana', 'Ana'); await on3('Grizzly Bears', 'Kim', 'Kim'); await on3('Sol Ring', 'Georges', 'Georges');
        check(await G3.evaluate(() => S.ex.some(c => cname(c) === 'Expropriate')), 'Expropriate is exiled');
        for (const p of P) await want(p, null);
      });
      await st3('3p Expropriate: everyone votes money → Georges takes a permanent from Kim and one from Ana', async () => {
        await putBf(K3, 'Grizzly Bears'); await putBf(A3, 'Mind Stone'); await sleep(1000);
        await want(G3, '^money|Grizzly|Mind Stone'); await want(K3, '^money'); await want(A3, '^money');
        await cast(G3, 'Expropriate'); await after3(); await sleep(2500); await after3();
        check(await G3.evaluate(() => !S.xt), 'no extra turn');
        await on3('Grizzly Bears', 'Georges', 'Kim'); await on3('Mind Stone', 'Georges', 'Ana');
        for (const p of P) await want(p, null);
      });
      await st3('3p Assault Suit: Kim gets Georges\'s equipped creature in her upkeep; she may attack Ana but not Georges', async () => {
        const hid = await putBf(G3, 'Test Hulk'); await putBf(G3, 'Assault Suit'); await G3.evaluate(hid => { const s = S.bf.find(x => cname(x) === 'Assault Suit'); s.att = {pid:MYPID, id:hid}; commit(); }, hid); await sleep(800);
        await want(G3, 'Kim|yes'); await G3.evaluate(() => passTurn()); await sleep(2500); await settle(P); await sleep(1000); await settle(P);
        await on3('Test Hulk', 'Kim', 'Georges');
        const r = await K3.evaluate(([gp, ap]) => { const c = S.bf.find(x => cname(x) === 'Test Hulk'); if (!c) return null; UI.atkSel = {[c.id]:'p:' + gp}; const toG = p24AtkPlan(); UI.atkSel = {[c.id]:'p:' + ap}; const toA = p24AtkPlan(); UI.atkSel = {}; return {toG, toA, can:canAttack(c)}; }, [pid.Georges, pid.Ana]);
        check(r && /can't attack/.test(r.toG) && !r.toA && !r.can, `Kim's borrowed Hulk: not Georges, yes Ana (${JSON.stringify(r)})`);
        const att = await G3.evaluate(() => S.bf.find(x => cname(x) === 'Assault Suit')?.att); check(att && att.pid === pid.Kim, `the Suit stays on it (${JSON.stringify(att)})`);
        await K3.evaluate(() => passTurn()); await sleep(2500); await settle(P); await sleep(800);
        await on3('Test Hulk', 'Ana', 'Georges');   // back to Georges at Kim's end of turn, then Ana's upkeep: Georges hands it to Ana
        await A3.evaluate(() => passTurn()); await sleep(2500); await settle(P); await sleep(800);
        await on3('Test Hulk', 'Georges', 'Georges'); await G3.evaluate(() => { window.__no = true; });
        await G3.evaluate(() => passTurn()); await sleep(2500); await settle(P); await K3.evaluate(() => passTurn()); await sleep(2500); await settle(P); await G3.evaluate(() => { window.__no = false; });
        await A3.evaluate(() => passTurn()); await sleep(2500); await settle(P); await toMain3(); await want(G3, null);
      });
      await st3('3p timestamps: Georges takes Ana\'s creature for good; Kim\'s Reins takes Georges\'s creatures until end of turn; then it goes back to Georges', async () => {
        await putBf(A3, 'Grizzly Bears'); await sleep(800); await tq(G3, [{re:'Grizzly Bears', who:pid.Ana}]); await cast(G3, 'Agent of Treachery'); await after3();
        await on3('Grizzly Bears', 'Georges', 'Ana');
        await tq(K3, [{re:'Georges', who:pid.Georges}]); check(await cast(K3, 'Reins of Power') === 'ok', 'Kim casts Reins of Power (instant) targeting Georges'); await after3(); await sleep(800);
        await on3('Grizzly Bears', 'Kim', 'Ana'); await on3('Agent of Treachery', 'Kim', 'Georges');
        await G3.evaluate(() => passTurn()); await sleep(2500); await settle(P); await sleep(800);
        await on3('Grizzly Bears', 'Georges', 'Ana'); await on3('Agent of Treachery', 'Georges', 'Georges');
        await K3.evaluate(() => passTurn()); await sleep(2000); await settle(P); await A3.evaluate(() => passTurn()); await sleep(2500); await settle(P); await toMain3();
        await on3('Grizzly Bears', 'Georges', 'Ana');
      });
      await st3('3p Etali, Primal Storm: exiles the top card of all three libraries; Georges casts Kim\'s and Ana\'s cards', async () => {
        for (const [p, n] of [[G3, 'Mind Stone'], [K3, 'Grizzly Bears'], [A3, 'Llanowar Elves']]) await p.evaluate(nm => { const a = [...DICT.values()].find(a => a.n === nm); S.lib.unshift({id:S.nid++, k:a.k}); commit(); }, n);
        await putBf(G3, 'Etali, Primal Storm'); await sleep(900);
        await G3.evaluate(() => { const e = S.bf.find(c => /Etali/.test(cname(c))); const pid = opponents()[0].pid; emit({type:'attack', k:e.k, id:e.id, dp:pid, cnt:1}); commit(); });
        await after3(); await sleep(2000); await after3();
        await on3('Grizzly Bears', 'Georges', 'Kim'); await on3('Llanowar Elves', 'Georges', 'Ana'); await on3('Mind Stone', 'Georges', 'Georges');
      });
    }
  } catch (e){ console.log('FATAL', e); check(false, 'fatal: ' + e.message); }
  const tot = Object.keys(RES).length, okAll = Object.values(RES).filter(Boolean).length;
  console.log(`\nCASES: ${okAll}/${tot} passed`); console.log(H.results.filter(r => r.startsWith('FAIL')).length + ' checks failed of ' + H.results.length);
  await browser.close(); process.exit(0);
})();
