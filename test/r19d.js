// Round 19 helper O: cross-player choices on the right screen, Dargo's cost, Jace's attack tax, Altaïr's memory counters,
// Tevesh Szat −10, exact owners through Aminatou, Master Warcraft's attack half, Mindslaver turns, banned lists, builds,
// engine life changes vs by-hand corrections. Real 2-player (and 3-player) games.
// PTPORT=19420 PTFILE=dev19O.html node r19d.js   (ONLY=<substring>)
process.env.TOP = '1';
const CC = require('./cards');
const X = (name, mana, cmc, type, text, p, t, lg) => ({object:'card', id:'id-x19d-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, mana_cost:mana, cmc, type_line:type, oracle_text:text,
  colors:[...new Set((mana.match(/[WUBRG]/g) || []))], color_identity:[...new Set((mana.match(/[WUBRG]/g) || []))], keywords:[], layout:'normal', set:'tst', collector_number:'19' + cmc, set_name:'Test', released_at:'2024-01-01', power:p, toughness:t, prices:{usd:'1'}, ...(lg ? {legalities:lg} : {})});
const EXTRA = [
  X('Mindslaver', '{6}', 6, 'Legendary Artifact', '{4}, {T}, Sacrifice Mindslaver: You control target player during that player\'s next turn. (You see all cards that player could see and make all decisions for the player.)'),
  X('Donate', '{2}{U}', 3, 'Sorcery', 'Target player gains control of target permanent you control.'),
  X('Test Ox', '{3}', 3, 'Artifact Creature — Ox', '', '3', '3'),
  X('Test Hulk', '{5}{G}', 6, 'Creature — Beast', '', '5', '5'),
  X('Mana Crypt', '{0}', 0, 'Artifact', 'At the beginning of your upkeep, flip a coin. If you lose the flip, Mana Crypt deals 3 damage to you.\n{T}: Add {C}{C}.', undefined, undefined, {commander:'banned', duel:'banned'}),
  X('Test Jace Target', '{2}{U}', 3, 'Legendary Planeswalker — Jace', '+1: Draw a card.', undefined, undefined),
];
const WANT = ['Kroxa, Titan of Death\'s Hunger', 'Acererak the Archlich', 'Tasigur, the Golden Fang', 'Dargo, the Shipwrecker', 'Jace, Multiverse Architect', "Altaïr Ibn-La'Ahad", 'Tevesh Szat, Doom of Fools',
  'Aminatou, the Fateshifter', 'Master Warcraft', 'Royal Assassin', 'Profane Transfusion', 'Grizzly Bears', 'Llanowar Elves', 'Lightning Bolt', 'Murder', 'Island', 'Mountain', 'Swamp', 'Forest', 'Plains',
  'Mind Stone', 'Sol Ring', 'Shivan Dragon', 'Giant Growth', 'Edgar Markov', 'Thalia, Guardian of Thraben', 'Krenko, Mob Boss'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
CC.cards.push(...CC.topCards('top.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
CC.cards.push(...EXTRA.filter(c => !CC.cards.some(x => x.name === c.name)));
{ const sr = CC.cards.find(c => c.name === 'Sol Ring'); if (sr) sr.legalities = {commander:'legal', duel:'banned'}; }
const H = require('./h'); const {check, sleep, waitFor} = H;
// auto-answers; records every modal title; __none: pick nothing; __want: regex preference
const AUTO = () => { window.__titles = []; setInterval(() => { const m = UI.modal; if (!m || m.__done || window.__hold) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try { window.__titles.push(String(m.title || '') + (m.hint ? ' || ' + m.hint : ''));
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; let n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); if (window.__none) n = m.min || 0; const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ const q = window.__tq || []; const ok = (m.cands || []).filter(x => x.ok); let picks = [];
      if (q.length){ const e = q.shift(); const re = new RegExp(e.re, 'i'); picks = ok.filter(x => re.test(x.nm) && (!e.who || (e.who === 'me' ? x.pid === MYPID : e.who === 'opp' ? x.pid !== MYPID : x.pid === e.who))).slice(0, e.n || 1); }
      else picks = m.spec && m.spec.upTo ? ok.slice(0, 1) : ok.filter(x => x.pid !== MYPID).slice(0, 1);
      m.__done = 1; m.resolve(picks); closeModal(); }
    else if (m.run){ m.__done = 1; m.run(window.__num != null ? window.__num : (m.def ?? 1)); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 100); };
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
let ALL = []; const RES = {};
const step = async (name, fn) => { if (process.env.ONLY && !process.env.ONLY.split(',').some(o => name.includes(o))) return; console.log('— ' + name); const f0 = H.fails();
  try { await T(120000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  RES[name] = H.fails() === f0;
  if (H.fails() > f0 || process.env.LOGS) for (const [nm, p] of ALL) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-16).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})).catch(e => e.message))); };
const passAll = async (ps) => { for (let i = 0; i < 5; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(150); } };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const kOf = (p, nm) => p.evaluate(nm => [...DICT.values()].find(a => a.n === nm)?.k, nm);
const putBf = (p, nm, extra) => p.evaluate(([nm, extra]) => { const a = [...DICT.values()].find(a => a.n === nm); if (!a) return null; const c = {id:S.nid++, k:a.k, x:20 + (S.nid % 30) * 3, y:30, sk:false, ...(extra || {})}; S.bf.push(c); commit(); return c.id; }, [nm, extra]);
const toZone = (p, nm, z) => p.evaluate(([nm, z]) => { const a = [...DICT.values()].find(a => a.n === nm); if (!a) return null; const c = {id:S.nid++, k:a.k}; S[z].push(c); commit(); return c.id; }, [nm, z]);
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
    const G = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r19d');
    const K = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r19d');
    ALL = [['Georges', G], ['Kim', K]]; const P2 = [G, K];
    await waitFor(G, () => OPP.size === 1, null, 20000); await G.evaluate(AUTO); await K.evaluate(AUTO);
    await G.click('[data-act="goFirst"]'); await settle(P2);
    const GP = await G.evaluate(() => MYPID), KP = await K.evaluate(() => MYPID);
    const toMain = async (p) => { for (let i = 0; i < 60; i++){ if (await p.evaluate(() => phaseNow().mine && phaseNow().ph === 3 && !stackAll().length)) return true; await p.evaluate(() => { if (!stackAll().length && !UI.modal && phaseNow().mine) nextAction(); }); await passAll(P2); } return false; };
    await toMain(G);
    const after = async () => { await sleep(300); await settle(P2); await sleep(900); await settle(P2); await sleep(400); };
    const wipe = async () => { for (const p of P2) await p.evaluate(() => { UI.modal = null; window.__tq = []; window.__want = null; window.__none = false; window.__num = null; S.bf = []; S.lent = []; S.hand = []; S.gy = []; S.ex = []; S.stk = []; S.prm = []; S.l24myr = []; commit(); }); await sleep(900); };
    const fresh = async () => { await wipe(); if (!(await G.evaluate(() => phaseNow().mine))){ await K.evaluate(() => passTurn()); await sleep(1200); } await toMain(G); await wipe(); await clrTitles(P2); };
    // Georges attacks Kim with one creature (by name), then the combat runs to its end
    const attack = async (A, D, who, defPid) => {
      await A.evaluate(() => setPhase(4));
      for (let i = 0; i < 30 && !(await A.evaluate(() => S.cb && S.cb.step === 'atk')); i++){ await passAll(P2); await A.evaluate(() => { if (S.cb && S.cb.step !== 'atk' && !stackAll().length) nextAction(); }); await sleep(150); }
      await A.evaluate(([w, d]) => { const e = S.bf.find(c => cname(c) === w); e.sk = false; e.tap = false; UI.atkSel = {[e.id]:'p:' + d}; renderCombatPanel(); }, [who, defPid]);
      await A.click('#cbpanel [data-act="atkGo"]').catch(() => {}); await sleep(600); await settle(P2); await sleep(900); await settle(P2);
    };
    const finishCombat = async (A, D) => { if (await waitFor(D, () => !!document.querySelector('#cbpanel [data-act="blkGo"]'), null, 8000)) await D.click('#cbpanel [data-act="blkGo"]');
      for (let i = 0; i < 25; i++){ await passAll(P2); if (await A.evaluate(() => phaseNow().ph === 5)) break; await sleep(100); } await sleep(800); await settle(P2); };

    // ================================================================= 1. opponents' choices on their own screens
    await step('Kroxa: Kim discards a land on her own screen and loses 3; Georges is not asked', async () => {
      await fresh(); await toZone(K, 'Island', 'hand'); await sleep(800); const l0 = await life(K);
      await G.evaluate(() => { const a = [...DICT.values()].find(a => a.n === "Kroxa, Titan of Death's Hunger"); const c = {id:S.nid++, k:a.k}; S.hand.push(c); moveCard(c.id, 'bf'); commit(); });
      await after(); await sleep(800); await after();
      const l1 = await life(K); const kt = await titles(K), gt = await titles(G);
      check(l1 === l0 - 3, `Kim lost 3 life (${l0} → ${l1})`);
      check((await names(K, 'gy')).includes('Island'), 'Island is in Kim\'s graveyard');
      check(!gt.some(t => /did .* discard|nonland/i.test(t)), `Georges was not asked what Kim discarded (${JSON.stringify(gt)})`);
    });
    await step('Kroxa: Kim chooses to discard a nonland card and loses nothing', async () => {
      await fresh(); await toZone(K, 'Island', 'hand'); await toZone(K, 'Lightning Bolt', 'hand'); await set(K, {__want:'Lightning'}); await sleep(800); const l0 = await life(K);
      await G.evaluate(() => { const a = [...DICT.values()].find(a => a.n === "Kroxa, Titan of Death's Hunger"); const c = {id:S.nid++, k:a.k}; S.hand.push(c); moveCard(c.id, 'bf'); commit(); });
      await after(); await sleep(800); await after();
      const kt = await titles(K);
      check(kt.some(t => /Kroxa.*discard a card/i.test(t)), `Kim was asked to discard on her screen (${JSON.stringify(kt.slice(-3))})`);
      check(await life(K) === l0, `Kim's life unchanged (${l0} → ${await life(K)})`);
      check((await names(K, 'gy')).includes('Lightning Bolt') && (await names(K, 'hand')).includes('Island'), 'she discarded Lightning Bolt, kept Island');
    });
    await step('Acererak: Kim declines to sacrifice → Georges gets a Zombie; then Kim sacrifices → no Zombie', async () => {
      await fresh(); await putBf(G, 'Acererak the Archlich'); await putBf(K, 'Grizzly Bears'); await set(K, {__none:true}); await sleep(800);
      await attack(G, K, 'Acererak the Archlich', KP); await sleep(800); await settle(P2);
      const z1 = await G.evaluate(() => S.bf.filter(c => c.tok && /Zombie/.test(typeOf(c))).length);
      check(z1 === 1, `Georges created one Zombie (${z1})`); check((await names(K, 'bf')).includes('Grizzly Bears'), 'Kim kept her Bears');
      const kt = await titles(K), gt = await titles(G);
      check(kt.some(t => /Acererak.*sacrifice a creature\?/i.test(t)), 'Kim was asked on her own screen');
      check(!gt.some(t => /does .* sacrifice/i.test(t)), 'Georges was not asked on her behalf');
      await finishCombat(G, K); await toMain(G).catch(() => {});
      await fresh(); await putBf(G, 'Acererak the Archlich'); await putBf(K, 'Grizzly Bears'); await set(K, {__want:'Grizzly'}); await sleep(800);
      await attack(G, K, 'Acererak the Archlich', KP); await sleep(800); await settle(P2);
      check(await G.evaluate(() => S.bf.filter(c => c.tok && /Zombie/.test(typeOf(c))).length) === 0, 'no Zombie when Kim sacrificed');
      check((await names(K, 'gy')).includes('Grizzly Bears'), 'Grizzly Bears went to Kim\'s graveyard');
      await finishCombat(G, K); await toMain(G).catch(() => {});
    });
    await step('Tasigur: Kim picks the nonland card Georges returns', async () => {
      await fresh(); await putBf(G, 'Tasigur, the Golden Fang'); for (const n of ['Lightning Bolt', 'Murder', 'Giant Growth']) await toZone(G, n, 'gy');
      await G.evaluate(() => { S.lib.unshift(...['Island', 'Island'].map(n => ({id:S.nid++, k:[...DICT.values()].find(a => a.n === n).k}))); commit(); });
      await set(K, {__want:'Murder'}); await sleep(800);
      const r = await G.evaluate(async (FULL) => { const c = S.bf.find(x => cname(x) === 'Tasigur, the Golden Fang'); S.pool = {...emptyPool(), ...FULL}; const ab = abilityList(c).find(a => /mill two/i.test(a.eff)); if (!ab) return 'no ability'; await activateAbility(c, ab); return 'ok'; }, FULL);
      check(r === 'ok', `activated (${r})`); await after(); await sleep(800); await after();
      const kt = await titles(K);
      check(kt.some(t => /return a nonland card/i.test(t)), `Kim chose on her screen (${JSON.stringify(kt.slice(-2))})`);
      check((await names(G, 'hand')).includes('Murder'), `Georges got Murder back (hand: ${await names(G, 'hand')})`);
    });

    // ================================================================= 2. Dargo
    await step('Dargo: the sacrifice prompt shows the cost and the cost after each sacrifice', async () => {
      await fresh(); await putBf(G, 'Grizzly Bears'); await putBf(G, 'Mind Stone'); await sleep(500);
      await G.evaluate(() => { const a = [...DICT.values()].find(a => a.n === 'Dargo, the Shipwrecker'); S.hand.push({id:S.nid++, k:a.k}); S.pool = {...emptyPool(), R:9, C:9}; commit(); });
      await set(G, {__want:'Grizzly'});
      await G.evaluate(async () => { const c = S.hand.find(x => cname(x) === 'Dargo, the Shipwrecker'); await beginCast(c, 'hand'); }); await after();
      const gt = await titles(G); const t = gt.find(x => /Dargo.*costs/.test(x)) || '';
      check(/costs \{6\}\{R\}/.test(t) && /1 → \{4\}\{R\}/.test(t) && /2 → \{2\}\{R\}/.test(t), `prompt shows {6}{R} and the discounts (${t})`);
      check((await names(G, 'bf')).includes('Dargo, the Shipwrecker') && (await names(G, 'gy')).includes('Grizzly Bears'), 'Dargo resolved; the Bears were sacrificed');
    });

    // ================================================================= 3. Jace, Multiverse Architect
    await step('Jace, Multiverse Architect: Kim doesn\'t pay {2} → her creatures can\'t attack Georges\'s Jace, can attack Georges', async () => {
      await fresh(); await putBf(G, 'Jace, Multiverse Architect', {co:4, cnt:{loyalty:4}}); await putBf(K, 'Grizzly Bears'); await putBf(K, 'Llanowar Elves'); await set(K, {__want:"Don't pay"}); await sleep(800);
      await G.evaluate(() => passTurn()); await sleep(1500); await settle(P2);
      await toMain(K); await K.evaluate(() => setPhase(4)); await sleep(800); await settle(P2); await sleep(1500); await settle(P2);
      for (let i = 0; i < 30 && !(await K.evaluate(() => S.cb && S.cb.step === 'atk')); i++){ await passAll(P2); await K.evaluate(() => { if (S.cb && S.cb.step !== 'atk' && !stackAll().length && !UI.modal) nextAction(); }); await sleep(200); }
      const kt = await titles(K); check(kt.some(t => /Jace.*pay \{2\}/i.test(t)), `Kim was asked to pay {2} (${JSON.stringify(kt.slice(-3))})`);
      const r = await K.evaluate(([g]) => { const jace = OPP.get(g).bf.find(c => /Jace, Multiverse/.test(cname(c))); const b = S.bf.find(c => cname(c) === 'Grizzly Bears'), e = S.bf.find(c => cname(c) === 'Llanowar Elves'); b.sk = false; e.sk = false;
        UI.atkSel = {[b.id]:`c:${g}:${jace.id}`, [e.id]:'p:' + g}; declareAttackers(); commit(); return {b:b.atk || '', e:e.atk || ''}; }, [GP]);
      check(!r.b && /^p:/.test(r.e), `Bears couldn't attack Jace; Elves attack Georges (${JSON.stringify(r)})`);
      await finishCombat(K, G).catch(() => {}); await K.evaluate(() => { S.stk = []; passTurn(); }); await sleep(1500); await settle(P2); await toMain(G);
    });

    // ================================================================= 4. Altaïr
    await step("Altaïr: Royal Assassin exiled with a memory counter, a tapped attacking copy, exiled at end of combat", async () => {
      await fresh(); await putBf(G, "Altaïr Ibn-La'Ahad"); await toZone(G, 'Royal Assassin', 'gy'); await G.evaluate(() => { window.__tq = [{re:'Royal Assassin'}]; }); await sleep(600);
      await attack(G, K, "Altaïr Ibn-La'Ahad", KP); await sleep(600);
      const s1 = await G.evaluate(() => ({ex:S.ex.map(c => cname(c) + ':' + ((c.nc || {}).memory || 0)), tok:S.bf.filter(c => c.tok).map(c => cname(c) + (c.tap ? '*' : '') + (c.atk ? '@' + c.atk : ''))}));
      check(s1.ex.includes('Royal Assassin:1'), `Royal Assassin in exile with a memory counter (${s1.ex})`);
      check(s1.tok.length === 1 && /Royal Assassin\*@p:/.test(s1.tok[0]), `one tapped attacking Royal Assassin token (${s1.tok})`);
      await finishCombat(G, K);
      check(await G.evaluate(() => S.bf.filter(c => c.tok).length) === 0, 'the token was exiled at end of combat');
      await toMain(G).catch(() => {});
    });

    // ================================================================= 5. Tevesh Szat −10
    await step('Tevesh Szat −10: Georges gains Kim\'s commander from her battlefield and both commanders from command zones', async () => {
      await fresh();
      // Kim's Thalia on the battlefield as her commander; Georges's Edgar Markov in his command zone
      const thK = await kOf(K, 'Thalia, Guardian of Thraben');
      await K.evaluate(k => { S.cz = S.cz.filter(c => c.k !== k); S.bf.push({id:S.nid++, k, cmd:true, sk:false, x:30, y:30}); commit(); }, thK);
      await G.evaluate(() => { const k = [...DICT.values()].find(a => a.n === 'Edgar Markov').k; if (!S.cz.some(c => c.k === k)) S.cz.push({id:S.nid++, k, cmd:true}); commit(); });
      await putBf(G, 'Tevesh Szat, Doom of Fools', {co:10, cnt:{loyalty:10}}); await sleep(900);
      const r = await G.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Tevesh Szat, Doom of Fools'); c.co = 10; const i = loyaltyAbs(c).findIndex(a => /commanders/i.test(a.eff)); if (i < 0) return 'no -10: ' + loyaltyAbs(c).map(a => a.eff).join('/'); await activateLoyalty(c, i); return 'ok'; });
      check(r === 'ok', `activated −10 (${r})`); await after(); await sleep(1000); await after();
      const g = await G.evaluate(() => S.bf.filter(c => c.cmd).map(c => cname(c) + (c.own ? '(own ' + nameOf(c.own.pid) + ')' : '')));
      check(g.includes('Edgar Markov') && g.includes('Thalia, Guardian of Thraben(own Kim)'), `Georges controls both commanders, still commanders (${g})`);
      check(!(await K.evaluate(k => S.bf.some(c => c.k === k), thK)), 'Thalia left Kim\'s battlefield');
      await G.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Thalia, Guardian of Thraben'); destroyCard(c, 'test'); commit(); }); await after(); await sleep(800);
      const kz = await K.evaluate(k => ({cz:S.cz.some(c => c.k === k), gy:S.gy.some(c => c.k === k)}), thK);
      check(kz.cz || kz.gy, `Thalia died under Georges → back to Kim's command zone or graveyard (${JSON.stringify(kz)})`);
      // second form: Kim's commander in her command zone
      await fresh(); await K.evaluate(k => { if (!S.cz.some(c => c.k === k)) S.cz.push({id:S.nid++, k, cmd:true}); commit(); }, thK);
      await putBf(G, 'Tevesh Szat, Doom of Fools', {co:10}); await sleep(900);
      await G.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Tevesh Szat, Doom of Fools'); c.co = 10; const i = loyaltyAbs(c).findIndex(a => /commanders/i.test(a.eff)); await activateLoyalty(c, i); });
      await after(); await sleep(1000); await after();
      const g2 = await G.evaluate(() => S.bf.filter(c => c.cmd).map(c => cname(c) + (c.own ? '(own ' + nameOf(c.own.pid) + ')' : '')));
      check(g2.includes('Thalia, Guardian of Thraben(own Kim)') && !(await K.evaluate(k => S.cz.some(c => c.k === k), thK)), `Thalia came from Kim's command zone onto Georges's battlefield (${g2})`);
      await K.evaluate(k => { S.lent = []; if (!S.cz.some(c => c.k === k)) S.cz.push({id:S.nid++, k, cmd:true}); commit(); }, thK);
    });

    // ================================================================= 6. Master Warcraft: Georges picks Kim's attackers
    await step('Master Warcraft: cast on Kim\'s turn, Georges chooses which of Kim\'s creatures attack; Kim can\'t declare her own', async () => {
      await fresh(); await putBf(K, 'Grizzly Bears'); await putBf(K, 'Llanowar Elves'); await sleep(600);
      await G.evaluate(() => passTurn()); await sleep(1500); await settle(P2); await toMain(K);
      await K.evaluate(() => setPhase(4)); await sleep(600); await settle(P2);
      // Georges casts it in Kim's beginning of combat
      await set(G, {__want:'Attack you'});
      const r = await G.evaluate(async (FULL) => { const a = [...DICT.values()].find(a => a.n === 'Master Warcraft'); const c = {id:S.nid++, k:a.k}; S.hand.push(c); S.pool = {...emptyPool(), ...FULL}; commit(); await beginCast(c, 'hand'); return S.hand.includes(c) ? 'not cast: ' + (S.log.slice(-1)[0] || {}).s : 'ok'; }, FULL);
      check(r === 'ok', `cast in Kim's beginning of combat (${r})`); await settle(P2); await sleep(800); await settle(P2);
      await set(G, {__hold:true}); await K.evaluate(() => { S.bf.forEach(c => { c.sk = false; }); commit(); });
      for (let i = 0; i < 30 && !(await K.evaluate(() => S.cb && S.cb.step === 'atk')); i++){ await passAll(P2); await K.evaluate(() => { if (S.cb && S.cb.step === 'begin' && !stackAll().length && !UI.modal) nextAction(); }); await sleep(200); }
      const own = await K.evaluate(() => { const b = S.bf.find(c => cname(c) === 'Grizzly Bears'); UI.atkSel = {[b.id]:'p:' + opponents()[0].pid}; const was = S.cb && S.cb.step; declareAttackers(); const r = {was, atk:b.atk || ''}; UI.atkSel = {}; return r; });
      check(own.was === 'atk' && !own.atk, `Kim's own declaration at her declare-attackers step is refused (${JSON.stringify(own)})`);
      await set(G, {__hold:false});
      // Georges's client asks about each of Kim's creatures at her declare-attackers step
      await waitFor(K, () => S.bf.some(c => c.atk), null, 15000); await sleep(800);
      const a = await K.evaluate(() => S.bf.filter(c => c.atk).map(c => cname(c) + '@' + c.atk));
      const gt = await titles(G);
      check(gt.filter(t => /You choose whether Kim's .* attacks/.test(t)).length >= 2, `Georges was asked for each of Kim's creatures (${gt.filter(t => /attacks/.test(t)).length})`);
      check(a.length === 2 && a.every(x => x.endsWith('@p:' + GP)), `both of Kim's creatures attack Georges as he chose (${a})`);
      await finishCombat(K, G).catch(() => {}); await K.evaluate(() => { S.stk = []; passTurn(); }); await sleep(1500); await settle(P2); await toMain(G);
    });

    await step('Master Warcraft on Georges\'s own turn: he chooses how Kim\'s creatures block', async () => {
      await fresh(); await putBf(G, 'Test Hulk'); await putBf(K, 'Grizzly Bears'); await sleep(600); await set(G, {__want:'Block Test Hulk'});
      const r = await G.evaluate(async (FULL) => { const a = [...DICT.values()].find(a => a.n === 'Master Warcraft'); const c = {id:S.nid++, k:a.k}; S.hand.push(c); S.pool = {...emptyPool(), ...FULL}; commit(); await beginCast(c, 'hand'); return S.hand.includes(c) ? 'not cast' : 'ok'; }, FULL);
      check(r === 'ok', `cast in Georges's main phase (${r})`); await after();
      await attack(G, K, 'Test Hulk', KP);
      for (let i = 0; i < 25; i++){ await passAll(P2); if (await G.evaluate(() => phaseNow().ph === 5)) break; await sleep(150); } await sleep(800); await settle(P2);
      const gt = await titles(G); check(gt.some(t => /You choose how Kim's Grizzly Bears blocks/.test(t)), 'Georges was asked how Kim\'s Bears block');
      check((await names(K, 'gy')).includes('Grizzly Bears') && await life(K) >= 0, `the Bears blocked the Hulk as Georges chose and died (Kim gy: ${await names(K, 'gy')})`);
      await toMain(G).catch(() => {});
    });
    // ================================================================= 8. Mindslaver
    await step('Mindslaver: Georges plays Kim\'s turn from his screen — casts, targets, attacks; Kim can\'t act; Georges sees only her hand', async () => {
      await fresh(); await putBf(G, 'Mindslaver'); await putBf(G, 'Shivan Dragon');
      await toZone(K, 'Lightning Bolt', 'hand'); await toZone(K, 'Mountain', 'hand'); await putBf(K, 'Mountain'); await putBf(K, 'Grizzly Bears'); await putBf(K, 'Llanowar Elves'); await sleep(800);
      await G.evaluate(() => { window.__tq = [{re:'Kim', who:'opp'}]; });
      const r = await G.evaluate(async (FULL) => { const c = S.bf.find(x => cname(x) === 'Mindslaver'); S.pool = {...emptyPool(), ...FULL}; const ab = abilityList(c).find(a => /control target player/i.test(a.eff)); if (!ab) return 'no ability'; await activateAbility(c, ab); return 'ok'; }, FULL);
      check(r === 'ok', `Mindslaver activated (${r})`); await after();
      await G.evaluate(() => passTurn()); await sleep(2000); await settle(P2); await sleep(1500);
      const on = await waitFor(G, () => !!document.getElementById('o19slv'), null, 15000); check(on, 'Georges sees the control panel on Kim\'s turn');
      const panel = await G.evaluate(() => (document.getElementById('o19slv') || {}).textContent || '');
      check(/Lightning Bolt/.test(panel) && /Mountain/.test(panel), `the panel shows Kim's hand (${panel.slice(0, 160).replace(/\s+/g, ' ')})`);
      // Kim tries to act on her own
      const self = await K.evaluate(async () => { const c = S.hand.find(x => cname(x) === 'Mountain'); playLand(c); await sleep(200); return S.hand.some(x => cname(x) === 'Mountain'); });
      check(self, 'Kim could not play a land herself');
      // Georges: next until main phase, play Mountain, cast Lightning Bolt (target chosen by Georges: his own Shivan Dragon... he picks Kim's Grizzly Bears)
      for (let i = 0; i < 12 && !(await K.evaluate(() => phaseNow().ph === 3)); i++){ await G.click('#o19slv [data-o19slv="next"]').catch(() => {}); await sleep(500); await passAll(P2); }
      check(await K.evaluate(() => phaseNow().ph === 3), 'Georges moved Kim\'s turn to her main phase');
      await G.click('#o19slv [data-o19slv^="cast:"]:text("Play Mountain")').catch(async () => { await G.evaluate(() => { const b = [...document.querySelectorAll('#o19slv [data-o19slv]')].find(x => /Play Mountain/.test(x.textContent)); b && b.click(); }); });
      await sleep(1500); await settle(P2);
      check(await K.evaluate(() => S.bf.filter(c => cname(c) === 'Mountain').length === 2), 'Kim\'s Mountain was played by Georges');
      await set(G, {__want:'Grizzly Bears'}); await clrTitles([G, K]);
      await G.waitForFunction(() => [...document.querySelectorAll('#o19slv [data-o19slv]')].some(x => /Cast Lightning Bolt/.test(x.textContent)), null, {timeout:8000}).catch(() => {});
      await G.evaluate(() => { const b = [...document.querySelectorAll('#o19slv [data-o19slv]')].find(x => /Cast Lightning Bolt/.test(x.textContent)); b && b.click(); });
      await sleep(2500); await settle(P2); await sleep(1200); await settle(P2);
      const gt = await titles(G), kt = await titles(K);
      check(gt.some(t => /controlling Kim/.test(t)), `the target question came to Georges (${JSON.stringify(gt.slice(-3))})`);
      check(!kt.some(t => /target/i.test(t)), `Kim was not asked for targets (${JSON.stringify(kt.slice(-3))})`);
      check((await names(K, 'gy')).includes('Grizzly Bears') && (await names(K, 'gy')).includes('Lightning Bolt'), `Bolt killed Kim's own Bears (Kim gy: ${await names(K, 'gy')})`);
      // no library leak: Georges's state has nothing of Kim's library
      const leak = await G.evaluate(([k]) => { const st = OPP.get(k); return JSON.stringify(st.q24 || []).length < 5000 && !(st.lib && st.lib.length); }, [KP]);
      check(leak, 'Kim\'s library is not visible to Georges');
      // attack: Georges takes Kim to her declare-attackers step and attacks himself with her Elves
      for (let i = 0; i < 12 && !(await K.evaluate(() => phaseNow().ph === 4 && S.cb && S.cb.step === 'atk')); i++){ await G.click('#o19slv [data-o19slv="next"]').catch(() => {}); await sleep(600); await passAll(P2); }
      check(await K.evaluate(() => phaseNow().ph === 4 && S.cb && S.cb.step === 'atk'), 'Georges took Kim to her declare-attackers step');
      await G.waitForSelector('#o19slv [data-o19atk]', {timeout:8000}).catch(() => {});
      await G.evaluate(() => { document.querySelectorAll('#o19slv [data-o19atk]').forEach(x => { x.checked = true; }); const b = document.querySelector('#o19slv [data-o19slv="atkGo"]'); b && b.click(); });
      await sleep(1500); await settle(P2);
      const atk = await K.evaluate(() => S.bf.filter(c => c.atk).map(c => cname(c) + '@' + c.atk));
      check(atk.length === 1 && atk[0] === 'Llanowar Elves@p:' + GP, `Kim's Elves attack Georges, declared by him (${atk})`);
      const l0 = await life(G); await finishCombat(K, G); check(await life(G) === l0 - 1, `Georges took 1 from Kim's Elves (${l0} → ${await life(G)})`);
      // the turn ends from Georges's panel
      await G.evaluate(() => { const b = document.querySelector('#o19slv [data-o19slv="end"]'); b && b.click(); }); await sleep(2500); await settle(P2);
      check(await K.evaluate(() => phaseNow().ph >= 6 || currentTurn()[1] !== MYPID), `Georges ended Kim's turn (${await K.evaluate(() => phaseNow().ph)})`);
      const glog = await G.evaluate(() => S.log.filter(e => /you control Kim's turn/.test(e.s)).length); check(glog === 1, `one "you control" line, not one per hand change (${glog})`);
      await K.evaluate(() => { S.stk = []; if (currentTurn()[1] === MYPID) passTurn(); }); await sleep(1800); await settle(P2); await toMain(G);
      check(!(await G.evaluate(() => !!document.getElementById('o19slv'))), 'the panel is gone after Kim\'s turn');
    });

    // ================================================================= 9. banned lists
    await step('Deck legality: Mana Crypt flagged as banned in Commander; Sol Ring noted as banned in Duel Commander', async () => {
      const r = await G.evaluate(() => { const d = LOBBY.deck; if (!d) return 'no deck'; return t25Legality(d, 'cmd').map(x => (x.ok ? (x.warn ? 'i ' : 'ok ') : 'X ') + x.text).filter(t => /[Bb]anned/.test(t)); });
      check(Array.isArray(r) && r.some(t => /^X Banned in Commander: .*Mana Crypt/.test(t)), `Mana Crypt is a problem (${JSON.stringify(r)})`);
      check(Array.isArray(r) && r.some(t => /^i Banned in Duel Commander.*Sol Ring/.test(t)), 'Sol Ring is noted for Duel Commander');
      const r2 = await G.evaluate(() => t25Legality(LOBBY.deck, 'duel').filter(x => !x.ok).map(x => x.text).join(' | '));
      check(/Banned in Duel Commander: .*Sol Ring/.test(r2) && /Mana Crypt/.test(r2), `Duel Commander: both banned (${r2.slice(0, 200)})`);
    });

    // ================================================================= 10. builds
    await step('Different builds: everyone sees a warning; private data to an old file is refused, the sender is told', async () => {
      await K.evaluate(() => { O19.bid = '19.otherbuild'; commit(); }); await sleep(2500);
      const b = await G.evaluate(() => (document.getElementById('o19build') || {}).textContent || '');
      check(/Different Proxy Table files/.test(b) && /Kim/.test(b), `Georges sees the banner (${b.slice(0, 120)})`);
      const bk = await K.evaluate(() => (document.getElementById('o19build') || {}).textContent || '');
      check(/Georges/.test(bk), 'Kim sees it too');
      check(await G.evaluate(() => S.log.some(e => /different Proxy Table file/.test(e.s))), 'a warning line in the game log');
      await K.evaluate(() => { O19.bid = (() => { const sc = [...document.scripts].map(x => x.textContent || '').sort((a, b) => b.length - a.length)[0] || ''; let h = 0x811c9dc5; for (let i = 0; i < sc.length; i++){ h ^= sc.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return PT_BUILD + '.' + h.toString(36); })(); commit(); }); await sleep(2500);
      check(!(await G.evaluate(() => !!document.getElementById('o19build'))), 'the banner goes away when the builds match');
      // an old file: no key, no build id
      const res = await G.evaluate(async (kp) => { const st = OPP.get(kp); const keep = {pk:st.r18pk, bid:st.o19bid}; st.r18pk = ''; st.o19bid = '';
        const t0 = Date.now(); const a = await q24Ask(kp, {kind:'choice', title:'secret', opts:['a', 'b']}, 'Test'); const s = r18Seal(kp, 'hand: secret'); const ms = Date.now() - t0;
        st.r18pk = keep.pk; st.o19bid = keep.bid; return {a, s, ms, log:S.log.slice(-3).map(e => e.s).join(' | ')}; }, KP);
      check(res.a === null && res.s === null && res.ms < 2000, `nothing sent in plain text, no wait (${JSON.stringify(res).slice(0, 200)})`);
      check(/couldn't send private information to Kim/.test(res.log), 'the sender is told');
    });

    // ================================================================= 11. engine life changes are not by-hand corrections
    await step('Two players: a loss stands after Profane Transfusion swaps life totals; the life buttons still take it back', async () => {
      await fresh(); await G.evaluate(() => { S.life = 0; commit(); }); await sleep(1500);
      check(await G.evaluate(() => !!S.j18out), 'Georges lost at 0 life');
      await G.evaluate(async (kp) => { const a = [...DICT.values()].find(a => a.n === 'Profane Transfusion'); await runEffects('Two target players exchange life totals.', {k:a.k, name:'Profane Transfusion', full:'Two target players exchange life totals.', tgts:[[{t:'player', pid:MYPID}], [{t:'player', pid:kp}]], it:{kind:'spell'}}); commit(); }, KP);
      await sleep(1500); const s1 = await G.evaluate(() => ({life:S.life, out:S.j18out}));
      check(s1.life > 0 && !!s1.out, `life became ${s1.life} by the exchange, the loss stands (${s1.out})`);
      await G.evaluate(() => { S.life = 0; commit(); }); await sleep(800);
      await G.evaluate(() => { setLife(5); }); await sleep(1200);
      check(await G.evaluate(() => !S.j18out), 'the life buttons (by hand) take the loss back');
      await G.evaluate(() => { S.life = 40; commit(); }); await K.evaluate(() => { S.life = 40; commit(); }); await sleep(800);
    });
  } catch (e){ console.log('FATAL', e); check(false, 'fatal: ' + e.message); }

  // ================================================================= 7. 3 players: Aminatou −6 with a permanent on loan
  if (!process.env.ONLY || /amin|3p/i.test(process.env.ONLY)) try {
    const P = []; const nm3 = ['Georges', 'Kim', 'Ana'];
    for (let i = 0; i < 3; i++){ P.push(await H.player(browser, nm3[i], H.deckFor(['Edgar Markov', 'Thalia, Guardian of Thraben', 'Krenko, Mob Boss'][i]), i ? 'join' : 'host', 'r19d3')); await sleep(300); }
    const [G3, K3, A3] = P; ALL = nm3.map((n, i) => [n, P[i]]);
    await waitFor(G3, () => OPP.size === 2, null, 20000); for (const p of P) await p.evaluate(AUTO);
    await G3.click('[data-act="goFirst"]'); await settle(P);
    const pid = {}; for (let i = 0; i < 3; i++) pid[nm3[i]] = await P[i].evaluate(() => MYPID);
    for (let i = 0; i < 40 && !(await G3.evaluate(() => phaseNow().mine && phaseNow().ph === 3)); i++){ await G3.evaluate(() => { if (!stackAll().length && !UI.modal && phaseNow().mine) nextAction(); }); await passAll(P); }
    for (const p of P) await p.evaluate(() => { S.bf = []; S.lent = []; S.hand = []; commit(); }); await sleep(1000);
    await step('3p Aminatou −6 (left): every nonland permanent moves one seat; a loaned one keeps its real owner', async () => {
      // seat order and "left": computed by the engine; Georges's Test Ox is on loan to Kim (Donate) before the rotation
      await putBf(G3, 'Test Ox'); await putBf(K3, 'Grizzly Bears'); await putBf(A3, 'Test Hulk'); await putBf(G3, 'Mind Stone'); await sleep(1200);
      await G3.evaluate((k) => { window.__tq = [{re:'Kim', who:k}, {re:'Test Ox', who:'me'}]; }, pid.Kim);
      await G3.evaluate(async (FULL) => { const a = [...DICT.values()].find(a => a.n === 'Donate'); const c = {id:S.nid++, k:a.k}; S.hand.push(c); S.pool = {...emptyPool(), ...FULL}; commit(); await beginCast(c, 'hand'); }, FULL);
      await sleep(1000); await settle(P); await sleep(1500); await settle(P);
      check(await K3.evaluate(() => S.bf.some(c => cname(c) === 'Test Ox' && c.own)), 'Kim controls Georges\'s Test Ox (Donate)');
      await putBf(G3, 'Aminatou, the Fateshifter', {co:6}); await sleep(800); await set(G3, {__want:'Left'});
      const next = await G3.evaluate(() => ({left:c2Nearest(MYPID, 'right'), right:c2Nearest(MYPID, 'left')}));
      await G3.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Aminatou, the Fateshifter'); c.co = 6; const i = loyaltyAbs(c).findIndex(a => /left or right/i.test(a.eff)); await activateLoyalty(c, i); });
      await sleep(1500); await settle(P); await sleep(2500); await settle(P); await sleep(1500);
      const view = []; for (let i = 0; i < 3; i++) view.push(await P[i].evaluate(() => S.bf.filter(c => !isLand(c.k)).map(c => cname(c) + (c.own ? '<' + nameOf(c.own.pid) : '')).sort().join(',')));
      console.log('   boards after rotation:', JSON.stringify(view), 'Georges gets from', next.left);
      // whoever ends up with each card: exactly one copy, and the Ox's loan is from Georges
      const where = async (n) => { const out = []; for (let i = 0; i < 3; i++){ const c = await P[i].evaluate(n => { const c = S.bf.find(x => cname(x) === n); return c ? (c.own ? nameOf(c.own.pid) : 'self') : null; }, n); if (c) out.push([nm3[i], c]); } return out; };
      for (const n of ['Test Ox', 'Grizzly Bears', 'Test Hulk', 'Mind Stone']){ const w = await where(n); check(w.length === 1, `${n}: on exactly one battlefield (${JSON.stringify(w)})`); }
      const ox = await where('Test Ox'); check(ox.length === 1 && ox[0][0] !== 'Kim' && (ox[0][1] === 'Georges' || (ox[0][0] === 'Georges' && ox[0][1] === 'self')), `Test Ox moved on from Kim, its owner is still Georges (${JSON.stringify(ox)})`);
      const kl = await K3.evaluate(() => S.lent.filter(l => l.card && cname(l.card) === 'Test Ox').length); check(kl === 0, 'Kim holds no loan record for the Ox');
      const moved = []; for (const [n, o] of [['Grizzly Bears', 'Kim'], ['Test Hulk', 'Ana'], ['Mind Stone', 'Georges']]){ const w = await where(n); moved.push(w.length === 1 && w[0][0] !== o); }
      check(moved.every(Boolean), `every permanent moved exactly one seat (${moved})`);
      // the Ox dies at its new controller → Georges's graveyard
      const holder = ox[0] && P[nm3.indexOf(ox[0][0])];
      if (holder){ await holder.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Test Ox'); destroyCard(c, 'test'); commit(); }); await sleep(1500); await settle(P); await sleep(1000); }
      const gyw = []; for (let i = 0; i < 3; i++) gyw.push(await P[i].evaluate(() => S.gy.filter(c => cname(c) === 'Test Ox').length));
      check(gyw[0] === 1 && gyw[1] === 0 && gyw[2] === 0, `the Ox went to Georges's graveyard only (${gyw})`);
    });
  } catch (e){ console.log('FATAL3', e); check(false, 'fatal3: ' + e.message); }

  const tot = Object.keys(RES).length, okAll = Object.values(RES).filter(Boolean).length;
  console.log(`\nCASES: ${okAll}/${tot} passed`); for (const [k, v] of Object.entries(RES)) if (!v) console.log('   FAILED: ' + k);
  console.log(H.results.filter(r => r.startsWith('FAIL')).length + ' checks failed of ' + H.results.length);
  await browser.close(); process.exit(0);
})();
