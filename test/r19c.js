// Round 19 helper N (GAPS19 "N — rules and mechanics"): real 2-player games (Georges vs Kim).
// PTPORT=19410 PTFILE=dev19N.html node r19c.js   (ONLY=<substring> runs some steps)
process.env.TOP = '1';
const CC = require('./cards');
const WANT = ['Wall of Omens', 'Clever Concealment', 'Hunted Bonebrute', 'Earthbending Lesson', 'Plea for Power', "Urza's Saga", "Sunbird's Invocation", 'Glimpse the Impossible',
  'Dihada, Binder of Wills', 'Hordewing Skaab', 'Knollspine Dragon', 'The Enigma Jewel // Locus of Enlightenment', 'Jace Beleren', 'Yedora, Grave Gardener', 'Satoru Umezawa',
  'Ninja of the Deep Hours', 'The Rise of Sozin // Fire Lord Sozin', 'Invasion of Fiora // Marchesa, Resolute Monarch', 'Hydroelectric Specimen // Hydroelectric Laboratory',
  'Psychic Paper', 'Gift of Doom', 'Kefka, Court Mage // Kefka, Ruler of Ruin', 'Shock', 'Ornithopter', 'Field of the Dead', 'Think Twice', 'Fling', 'Abrade', 'Divination', 'Gravecrawler', 'Zombie Master'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
// a creature card that isn't in either deck: Psychic Paper may name it (found through Scryfall's autocomplete / named endpoints)
CC.cards.push({object:'card', id:'id-x19n-faraway', name:'Faraway Test Beast', mana_cost:'{4}{G}', cmc:5, type_line:'Creature — Beast', oracle_text:'Trample', colors:['G'], color_identity:['G'], keywords:[], layout:'normal', set:'tst', collector_number:'919', set_name:'Test', released_at:'2024-01-01', power:'5', toughness:'5', prices:{usd:'1'}});
const H = require('./h'); const {check, sleep, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }).catch(() => {}); await sleep(200); } };
const AUTO = () => { setInterval(() => { const m = UI.modal; if (!m || m.__done) return; (window.__titles = window.__titles || []).push(m.title || m.type);
  try {
    if (m.type === 'pick' && m.resolve){ const want = window.__pick ?? 1; const n = Math.max(m.min || 0, Math.min(want, m.max ?? 1)); m.__done = 1; m.resolve((m.cards || []).slice(0, n).map(c => c.id)); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ if (m.f19s) (window.__f19s = window.__f19s || []).push({t:m.title, n:(m.f19s.all || []).length, opts:m.options.length});
      if (m.f19s && (window.__type || (window.__typeQ || []).length)){ let q = window.__type, want = window.__want; if ((window.__typeQ || []).length){ const e = window.__typeQ.shift(); q = e.type; want = e.want; } window.__type = null; m.__done = 1; const el = document.getElementById('f19nq'); if (el){ el.value = q; el.dispatchEvent(new Event('input', {bubbles:true})); }
        setTimeout(() => { const w = new RegExp(want || '.', 'i'); const o = (m.options || []).find(x => w.test(x.label)); m.onClose = null; closeModal(); m.resolve(o ? o.value : null); }, 1200); return; }
      const w = window.__want ? new RegExp(window.__want, 'i') : null; const os = (m.options || []).filter(x => !x.disabled); const o = (w && os.find(x => w.test(x.label))) || os[0]; m.__done = 1; m.resolve(o ? o.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ const t = window.__tgt || 'opp'; const ok = (m.cands || []).filter(c => c.ok !== false);
      const pick = t === 'opp' ? ok.find(c => c.pid && c.pid !== MYPID) : t === 'me' ? ok.find(c => c.pid === MYPID && c.t !== 'player') : t === 'kim' ? ok.find(c => c.t === 'player' && c.pid !== MYPID) : t === 'oppcard' ? ok.find(c => c.t === 'card' && c.pid !== MYPID) : ok.find(c => new RegExp(t, 'i').test(c.nm || c.label || ''));
      m.__done = 1; m.resolve(pick ? [pick] : []); closeModal(); }
    else if (m.run){ (window.__asks = window.__asks || []).push(m.title); m.__done = 1; m.run(window.__X ?? m.def ?? 1); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120);
  // choice prompts other players made me (discard / sacrifice) — answer them quickly
  setInterval(() => { try { if (S && S.prm && S.prm.length && !UI.modal){ const p = S.prm[0]; if (p.type === 'discard' || p.type === 'sac'){ const pool = p.type === 'sac' ? S.bf.filter(c => !c.fd) : S.hand.slice(); const pick = window.__disc ? pool.filter(c => new RegExp(window.__disc).test(cname(c))) : pool; finishChoice(p, pick.slice(0, p.n).map(c => c.id)); } } } catch {} }, 400); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !process.env.ONLY.split(",").some(o => name.startsWith(o + " "))) return; console.log('— ' + name); const f0 = H.fails(); try { await T(150000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if ((H.fails() > f0 || process.env.LOGS) && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-18).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r19c');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r19c');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const after = async () => { await sleep(500); await settle([A, B]); await sleep(1200); await settle([A, B]); await sleep(500); };
  const reset = p => p.evaluate(() => { if (currentTurn()[1] === MYPID && phaseNow().ph !== 3 && !stackAll().length){ if (S.cb) S.cb.step = 'end'; setPhase(3); } UI.notes = []; window.__asks = []; window.__titles = []; window.__want = null; window.__pick = null; window.__tgt = null; window.__X = null; window.__f19s = []; window.__type = null; window.__disc = null; });
  const notes = p => p.evaluate(() => (UI.notes || []).map(x => x.name + ': ' + x.text));
  const noNotes = async (what) => { const a = await notes(A), b = await notes(B); check(!a.length && !b.length, `${what}: no "do by hand" notes (${JSON.stringify(a.concat(b))})`); };
  const noAsks = async (what) => { const a = await A.evaluate(() => window.__asks || []), b = await B.evaluate(() => window.__asks || []); check(!a.length && !b.length, `${what}: no number was asked (${JSON.stringify(a.concat(b))})`); };
  const toHand = (p, nm) => p.evaluate(nm => { for (const z of ['lib', 'gy', 'ex', 'bf', 'hand']){ const c = S[z].find(x => cname(x) === nm || (info(x.k)?.full || '').startsWith(nm)); if (c){ if (z !== 'hand'){ S[z].splice(S[z].indexOf(c), 1); reset(c); S.hand.push(c); } commit(); return c.id; } } return null; }, nm);
  const put = (p, nm) => p.evaluate(nm => { for (const z of ['lib', 'hand', 'gy', 'ex']){ const c = S[z].find(x => cname(x) === nm || (info(x.k)?.full || '').startsWith(nm)); if (c){ moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id); if (b){ b.sk = false; b.tap = false; } commit(); return c.id; } } return null; }, nm);
  const cast = (p, nm, pool, o) => p.evaluate(([nm, pool, o]) => { const c = S.hand.find(x => cname(x) === nm); if (!c) return 'not in hand'; S.pool = {...emptyPool(), ...pool}; beginCast(c, 'hand', o || {}); return 'ok'; }, [nm, pool, o || null]);
  const clear = p => p.evaluate(() => { S.bf.filter(c => !isLand(c.k) || c.tok || c.fd || c.anim).forEach(c => { if (c.tok || c.emb) S.bf.splice(S.bf.indexOf(c), 1); else { c.fd = false; delete c.fdc; c.anim = null; moveCard(c.id, 'lib', {quiet:true}); } }); S.stk = []; S.dly = []; S.r21bd = []; S.pool = emptyPool(); commit(); });
  const count = (p, nm) => p.evaluate(nm => S.bf.filter(c => cname(c) === nm).reduce((a, c) => a + (c.n || 1), 0), nm);
  const tapLands = p => p.evaluate(() => { S.bf.forEach(c => { if (isLand(c.k)) c.tap = true; }); S.pool = emptyPool(); commit(); });
  const untapLands = p => p.evaluate(() => { S.bf.forEach(c => { if (isLand(c.k)) c.tap = false; }); commit(); });
  const myTurn = async () => { for (let i = 0; i < 6; i++){ if (await A.evaluate(() => currentTurn()[1] === MYPID)) break; await B.evaluate(() => { if (currentTurn()[1] === MYPID){ S.stk = []; passTurn(); } }); await sleep(2500); await settle([A, B]); }
    await A.evaluate(() => { if (phaseNow().ph !== 3) setPhase(3); commit(); }); await sleep(600); await settle([A, B]); };
  // Georges attacks Kim with `who`; o.blocks(B) sets Kim's blocks; o.atBlkd(A) runs after blockers are declared
  const combat = async (who, o = {}) => {
    await A.evaluate(() => { if (phaseNow().ph !== 3) setPhase(3); if (S.cb) S.cb.step = 'end'; S.bf.forEach(c => { c.atk = ''; if (!isLand(c.k)) c.tap = false; c.sk = false; }); commit(); }); await sleep(400);
    await settle([A, B]); await A.click('#phasebar [data-act="next"]').catch(() => {}); if (!(await waitFor(A, () => phaseNow().ph === 4, null, 8000))) console.log('    (combat: not in combat phase)', await A.evaluate(() => JSON.stringify({ph:phaseNow(), stk:stackAll().map(i => i.nm), pass:S.pass, modal:UI.modal && UI.modal.title})));
    await passAll([B]);
    if (!(await A.evaluate(() => S.cb && S.cb.step === 'atk'))) await A.evaluate(() => nextAction());
    if (!(await waitFor(A, () => S.cb && S.cb.step === 'atk', null, 8000))) console.log('    (combat: no attack step)', await A.evaluate(() => JSON.stringify({ph:phaseNow(), cb:S.cb, stk:stackAll().map(i => i.nm), modal:UI.modal && UI.modal.title})));
    await A.evaluate((w) => { const e = S.bf.find(c => cname(c) === w); e.sk = false; e.tap = false; S.bf.forEach(c => { if (c !== e) c.atk = ''; }); UI.atkSel = {[e.id]:'p:' + opponents()[0].pid}; renderCombatPanel(); }, who);
    await A.click('#cbpanel [data-act="atkGo"]'); await passAll([A, B]);
    await waitFor(B, () => !!document.querySelector('#cbpanel [data-act="blkGo"]'), null, 8000);
    if (o.blocks) await o.blocks(B);
    await B.click('#cbpanel [data-act="blkGo"]').catch(() => {});
    if (o.atBlkd){ await waitFor(A, () => S.cb && S.cb.step === 'blkd', null, 8000); await o.atBlkd(A); await sleep(600); }
    for (let i = 0; i < 14; i++){ await passAll([A, B]); if (await A.evaluate(() => phaseNow().ph === 5)) break; }
    await sleep(1200); await settle([A, B]); await sleep(600);
  };
  try {
    const KIM = await A.evaluate(() => [...OPP.keys()][0]);
    await A.evaluate(() => { for (let i = 0; i < 4; i++){ const c = S.lib.find(x => cname(x) === 'Plains'); if (c) moveCard(c.id, 'bf', {quiet:true}); } commit(); });

    await step('N1 the Ring: level 1 (greater power can\'t block) and level 3 (blockers sacrificed at end of combat)', async () => {
      await reset(A); await reset(B); await put(A, 'Grizzly Bears'); await sleep(400);
      await A.evaluate(async () => { for (let i = 0; i < 3; i++) await ringTempts({name:'test'}); });
      await sleep(400); await settle([A, B]); await sleep(800);
      await put(B, 'Wall of Omens'); await put(B, 'Shivan Dragon'); await sleep(1200);
      const r = await B.evaluate(() => { const pid = [...OPP.keys()][0]; const a = OPP.get(pid).bf.find(c => cname(c) === 'Grizzly Bears'); const w = S.bf.find(c => cname(c) === 'Wall of Omens'), d = S.bf.find(c => cname(c) === 'Shivan Dragon');
        return {ring:a && a.ring, lvl:OPP.get(pid).ring, wall:canBlock(w, a, pid), dragon:canBlock(d, a, pid)}; });
      check(r.ring && r.lvl >= 3, `Kim sees the Bears as Georges's Ring-bearer (level ${r.lvl})`);
      check(r.wall === '' && /greater power/.test(r.dragon), `the 0/4 Wall can block, the 5/5 Dragon can't (${JSON.stringify(r)})`);
      check(await A.evaluate(() => r26IsLegend(S.bf.find(c => cname(c) === 'Grizzly Bears'))), 'the Ring-bearer is legendary');
      await combat('Grizzly Bears', {blocks:async (B) => B.evaluate(() => { const pid = [...OPP.keys()][0]; const a = OPP.get(pid).bf.find(c => c.atk); const w = S.bf.find(c => cname(c) === 'Wall of Omens'), d = S.bf.find(c => cname(c) === 'Shivan Dragon'); UI.blkSel = {[w.id]:a.id, [d.id]:a.id}; })});
      await after(); await sleep(1500); await settle([A, B]);
      const k = await B.evaluate(() => ({wall:S.bf.some(c => cname(c) === 'Wall of Omens'), wallGy:S.gy.some(c => cname(c) === 'Wall of Omens'), dragon:S.bf.find(c => cname(c) === 'Shivan Dragon')?.blk ?? null, log:S.log.slice(-12).map(e => e.s).filter(s => /Ring|sacrific|block/i.test(s))}));
      check(!k.wall && k.wallGy, `the Wall that blocked the Ring-bearer was sacrificed at end of combat (${JSON.stringify(k)})`);
      await noNotes('the Ring'); await A.evaluate(() => { setPhase(3); S.bf.forEach(c => { c.ring = 0; }); commit(); }); await clear(A); await clear(B);
    });

    await step('N2 convoke: creatures pay coloured mana of their colour', async () => {
      await reset(A); await reset(B); await tapLands(A);
      for (const n of ['Thalia, Guardian of Thraben', 'Giada, Font of Hope', 'Llanowar Elves', 'Grizzly Bears']) await put(A, n);
      await toHand(A, 'Clever Concealment'); await sleep(400);
      const ok = await A.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Clever Concealment'); return castCheck(c, 'hand'); });
      check(ok && ok.ok, `with no mana, four creatures (two white) can pay {2}{W}{W} — castCheck ${JSON.stringify(ok)}`);
      await A.evaluate(() => { window.__pick = 4; window.__tgt = 'me'; }); await cast(A, 'Clever Concealment', {}); await after();
      const r = await A.evaluate(() => ({gy:S.gy.some(c => cname(c) === 'Clever Concealment'), hand:S.hand.some(c => cname(c) === 'Clever Concealment'), tapped:S.bf.filter(c => isCreatureCard(c) && c.tap).map(cname), log:S.log.slice(-10).map(e => e.s).filter(s => /convok/.test(s))}));
      check(r.gy && !r.hand && r.tapped.length === 4, `Clever Concealment was cast by tapping four creatures (${JSON.stringify(r)})`);
      check(r.log.some(s => /\{W\}\{W\}/.test(s)), 'the white creatures paid {W}{W}');
      await noNotes('convoke'); await untapLands(A); await clear(A);
    });

    await step('N3 disguise: a face-down disguise creature has ward {2}', async () => {
      await reset(A); await reset(B);
      await B.evaluate(() => { const c = S.lib.find(x => cname(x) === 'Hunted Bonebrute') || S.hand.find(x => cname(x) === 'Hunted Bonebrute'); moveCard(c.id, 'bf', {quiet:true, fd:true}); const b = S.bf.find(x => x.id === c.id); b.fd = true; b.fdc = 'disguise'; b.sk = false; commit(); }); await sleep(1200);
      await tapLands(A); await toHand(A, 'Lightning Bolt'); await A.evaluate(() => { window.__tgt = 'oppcard'; window.__want = "^Don't"; }); await cast(A, 'Lightning Bolt', {R:1, C:2}); await after();
      const t1 = await A.evaluate(() => (window.__titles || []).filter(t => /ward/i.test(t)));
      check(t1.length >= 1 && /\{2\}/.test(t1[0]), `Georges was asked to pay ward {2} (${JSON.stringify(t1)})`);
      check(await B.evaluate(() => S.bf.some(c => c.fd)), 'not paying: the Bolt is countered, the face-down creature survives');
      await reset(A); await toHand(A, 'Lightning Bolt'); await A.evaluate(() => { window.__tgt = 'oppcard'; window.__want = '^Pay'; }); await cast(A, 'Lightning Bolt', {R:1, C:2}); await after();
      check(await B.evaluate(() => !S.bf.some(c => c.fd)), 'paying {2}: the Bolt resolves and the 2/2 face-down creature dies');
      await noNotes('disguise'); await untapLands(A); await clear(B);
    });

    await step('N4 earthbend: the land returns tapped when it dies or is exiled', async () => {
      await reset(A); await reset(B); await toHand(A, 'Earthbending Lesson'); await A.evaluate(() => { window.__pick = 1; }); await cast(A, 'Earthbending Lesson', {G:1, C:3}); await after();
      const land = await A.evaluate(() => { const c = S.bf.find(x => x.anim === 'eb'); return c ? {id:c.id, nm:cname(c), cp:c.cp, cr:isCreatureCard(c)} : null; });
      if (process.env.DBG) console.log('    cands', await A.evaluate(() => JSON.stringify(targetCands({desc:'creature', zone:'bf', n:1}, {pid:MYPID, id:-1}).map(c => c.nm + ':' + c.ok))));
      check(land && land.cp === 4 && land.cr, `a land became a 0/0 creature with four +1/+1 counters (${JSON.stringify(land)})`);
      await toHand(A, 'Murder'); await A.evaluate(() => { window.__tgt = 'me'; }); await cast(A, 'Murder', {B:2, C:1}); await after();
      const back = await A.evaluate((id) => { const c = S.bf.find(x => x.id === id); return c ? {tap:!!c.tap, anim:c.anim || null, cp:c.cp || 0} : null; }, land && land.id);
      check(back && back.tap && !back.anim && !back.cp, `the land died and returned to the battlefield tapped, as a plain land (${JSON.stringify(back)})`);
      // exiled this time
      await reset(A); await toHand(A, 'Earthbending Lesson'); await cast(A, 'Earthbending Lesson', {G:1, C:3}); await after();
      const l2 = await A.evaluate(() => { const c = S.bf.find(x => x.anim === 'eb'); return c ? {id:c.id, nm:cname(c)} : null; });
      await toHand(A, 'Swords to Plowshares'); await A.evaluate(() => { window.__tgt = 'me'; }); await cast(A, 'Swords to Plowshares', {W:1}); await after();
      const b2 = await A.evaluate((id) => { const c = S.bf.find(x => x.id === id); return c ? {tap:!!c.tap} : null; }, l2 && l2.id);
      check(b2 && b2.tap, `exiled with Swords to Plowshares: it returned tapped too (${JSON.stringify(b2)})`);
      await noNotes('earthbend'); await A.evaluate(() => { S.bf.forEach(c => { if (isLand(c.k)) c.tap = false; }); commit(); });
    });

    await step('N5 votes: three options, each player votes on their own screen; two-option Plea for Power still works', async () => {
      await reset(A); await reset(B); const h0 = await A.evaluate(() => S.hand.length);
      await A.evaluate(() => { window.__want = 'Beta'; }); await B.evaluate(() => { window.__want = 'Beta'; });
      const v = await A.evaluate(async () => { const ctx = {name:'Test Council', k:null, full:'Starting with you, each player votes for alpha, beta, or gamma. For each beta vote, draw a card.'}; await runEffects(ctx.full, ctx); return ctx.votes; });
      await after();
      const kt = await B.evaluate(() => (window.__titles || []).filter(t => /vote/i.test(t)));
      check(v && v.alpha === 0 && v.beta === 2 && v.gamma === 0, `votes counted: ${JSON.stringify(v)}`);
      check(kt.length === 1 && /Alpha, Beta, Gamma/.test(kt[0]), `Kim voted on her own screen with all three options (${JSON.stringify(kt)})`);
      check(await A.evaluate(() => S.hand.length) === h0 + 2, 'for each beta vote: drew two cards');
      await reset(A); await reset(B); await A.evaluate(() => { window.__want = '^Kim'; }); await B.evaluate(() => { window.__want = '^Kim'; });
      await A.evaluate((k) => { window.KIM_PID = () => k; }, KIM); const pv = await A.evaluate(async () => { const ctx = {name:'Test Ballot', k:null, full:'Starting with you, each player votes for a player.'}; await runEffects(ctx.full, ctx); return ctx.votes; });
      check(pv && pv[KIM] === 2 && Object.keys(pv).length === 2, `voting for a player: both voted Kim (${JSON.stringify(pv)})`);
      await reset(A); await reset(B); const h1 = await A.evaluate(() => S.hand.length);
      await A.evaluate(() => { window.__want = 'Knowledge'; }); await B.evaluate(() => { window.__want = 'Knowledge'; });
      await toHand(A, 'Plea for Power'); await cast(A, 'Plea for Power', {U:1, C:3}); await after();
      check(await A.evaluate(() => S.hand.length) === h1 + 3, `Plea for Power: knowledge wins, drew three (${h1} → ${await A.evaluate(() => S.hand.length)})`);
      await noNotes('votes');
    });

    await step('N6 the cards that asked for a number compute it', async () => {
      await reset(A); await reset(B);
      // Urza's Saga's Construct
      await put(A, 'Sol Ring'); await put(A, 'Ornithopter');
      await A.evaluate(async () => { const k = [...DICT.values()].find(a => a.n === "Urza's Saga").k; await runEffects("Create a 0/0 colorless Construct artifact creature token with 'This token gets +1/+1 for each artifact you control.'", {name:"Urza's Saga", k, full:''}); });
      await after(); const con = await A.evaluate(() => S.bf.filter(c => c.tok && /Construct/.test(typeOf(c))).map(c => ({n:c.n || 1, st:stats(c)})));
      check(con.length === 1 && con[0].n === 1 && con[0].st[0] === 3, `one Construct token, 3/3 with three artifacts (${JSON.stringify(con)})`);
      await noAsks("Urza's Saga"); await clear(A);
      // Sunbird's Invocation: X = the cast spell's mana value
      await reset(A); await put(A, "Sunbird's Invocation"); await toHand(A, 'Divination'); await A.evaluate(() => { window.__want = "^(Don't|No|None|Cast nothing)"; window.__pick = 0; }); await cast(A, 'Divination', {U:1, C:2}); await after();
      const sb = await A.evaluate(() => S.log.slice(-25).map(e => e.s).filter(s => /Sunbird|reveal/i.test(s)));
      check(sb.some(s => /3/.test(s)), `Sunbird's Invocation revealed three cards for a mana value 3 spell (${JSON.stringify(sb)})`);
      await noAsks("Sunbird's Invocation"); await clear(A);
      // Dihada −3: four cards, none legendary kept → four Treasures
      await reset(A); await put(A, 'Dihada, Binder of Wills'); await A.evaluate(() => { const d = S.bf.find(c => cname(c) === 'Dihada, Binder of Wills'); d.co = 5; S.lib.slice(0, 4).forEach(c => {}); commit(); window.__pick = 0; });
      const g0 = await A.evaluate(() => S.gy.length); const top4 = await A.evaluate(() => S.lib.slice(0, 4).filter(c => /Legendary/.test(info(c.k)?.t || '')).length);
      await A.evaluate(() => { const d = S.bf.find(c => cname(c) === 'Dihada, Binder of Wills'); activateLoyalty(d, 1); }); await after();
      const tr = await A.evaluate(() => S.bf.filter(c => c.tok && cname(c) === 'Treasure').reduce((a, c) => a + (c.n || 1), 0)); const g1 = await A.evaluate(() => S.gy.length);
      check(tr === g1 - g0 && tr === 4 - Math.min(top4, 0), `Dihada: ${g1 - g0} cards went to the graveyard, ${tr} Treasures`);
      await noAsks('Dihada'); await clear(A);
      // Knollspine Dragon: damage dealt to Kim this turn
      await reset(A); await reset(B); await toHand(A, 'Lightning Bolt'); await A.evaluate(() => { window.__tgt = 'kim'; }); await cast(A, 'Lightning Bolt', {R:1}); await after();
      await toHand(A, 'Shock'); await A.evaluate(() => { window.__tgt = 'kim'; }); await cast(A, 'Shock', {R:1}); await after(); await sleep(800);
      const dmg = await B.evaluate(() => S.f19dmg && S.f19dmg.t === turnStr() ? S.f19dmg.n : 0);
      await toHand(A, 'Knollspine Dragon'); await A.evaluate(() => { window.__tgt = 'kim'; window.__want = '^Discard'; }); await cast(A, 'Knollspine Dragon', {R:3, C:4}); await after();
      const kn = await A.evaluate(() => ({hand:S.hand.length, log:S.log.slice(-10).map(e => e.s).filter(s => /Knollspine/.test(s))}));
      check(dmg >= 5 && kn.hand === dmg, `Knollspine Dragon: discarded the hand and drew ${dmg} (the damage Kim was dealt this turn, Bolt 3 + Shock 2 included) — hand ${kn.hand} ${JSON.stringify(kn.log)}`);
      await noAsks('Knollspine Dragon'); await clear(A);
    });

    await step('N6b Glimpse the Impossible makes a Spawn for each card put into the graveyard', async () => {
      await myTurn(); await reset(A); await reset(B); const top3 = await A.evaluate(() => S.lib.slice(0, 3).map(c => c.id));
      await toHand(A, 'Glimpse the Impossible'); await cast(A, 'Glimpse the Impossible', {R:1, C:2}); await after();
      await A.evaluate(() => setPhase(6)); for (let i = 0; i < 8; i++){ await passAll([A, B]); await sleep(300); } await settle([A, B]); await sleep(800);
      const sp = await A.evaluate(() => { const t = S.bf.find(c => c.tok && /Spawn/.test(typeOf(c))); return {n:S.bf.filter(c => c.tok && /Spawn/.test(typeOf(c))).reduce((a, c) => a + (c.n || 1), 0), mana:t ? manaAbs(t).length : 0}; }); const inGy = await A.evaluate((ids) => ids.filter(id => S.gy.some(c => c.id === id)).length, top3);
      check(sp.n === 3 && inGy === 3 && sp.mana >= 1, `the three exiled cards went to the graveyard and made three Eldrazi Spawn with a mana ability (${JSON.stringify(sp)}, ${inGy} in graveyard)`);
      await noAsks('Glimpse the Impossible'); await noNotes('Glimpse'); await myTurn(); await clear(A);
    });

    await step('N6c Hordewing Skaab draws for each opponent dealt damage', async () => {
      await myTurn(); await reset(A); await reset(B); await put(A, 'Hordewing Skaab'); await sleep(500);
      const h0 = await A.evaluate(() => ({h:S.hand.length, g:S.gy.length})); await A.evaluate(() => { window.__want = '^Draw'; window.__pick = 1; });
      await combat('Hordewing Skaab'); await after();
      const h1 = await A.evaluate(() => ({h:S.hand.length, g:S.gy.length, t:(window.__titles || []).filter(t => /Skaab/.test(t))}));
      check(h1.h === h0.h && h1.g === h0.g + 1 && h1.t.some(t => /draw 1 card/.test(t)), `drew 1 and discarded 1 (${JSON.stringify(h0)} → ${JSON.stringify(h1)})`);
      await noAsks('Hordewing Skaab'); await A.evaluate(() => { setPhase(3); commit(); }); await clear(A);
    });

    await step('N7 Locus of Enlightenment has the crafted planeswalker\'s loyalty abilities', async () => {
      await reset(A); await reset(B); const id = await put(A, 'The Enigma Jewel');
      await A.evaluate((id) => { const c = S.bf.find(x => x.id === id); c.fl = true; S.e27mat = S.e27mat || {}; S.e27mat[id] = [[...DICT.values()].find(a => a.n === 'Jace Beleren').k, [...DICT.values()].find(a => a.n === 'Sol Ring').k]; commit(); }, id);
      const r = await A.evaluate((id) => { const c = S.bf.find(x => x.id === id); return {abs:loyaltyAbs(c).map(a => a.raw + ': ' + a.eff), why:loyaltyAbs(c).map(a => loyaltyReady(c, a)), menu:round4MenuItems(c).includes('pwOpen')}; }, id);
      check(r.abs.length === 3 && r.why[0] === '' && /Needs 1 loyalty/.test(r.why[1]) && r.menu, `Jace Beleren's three loyalty abilities; −1 needs loyalty; menu offers them (${JSON.stringify(r)})`);
      const h0 = await A.evaluate(() => S.hand.length), k0 = await B.evaluate(() => S.hand.length);
      await A.evaluate((id) => { const c = S.bf.find(x => x.id === id); activateLoyalty(c, 0); }, id); await after();
      const h1 = await A.evaluate(() => S.hand.length), k1 = await B.evaluate(() => S.hand.length);
      const again = await A.evaluate((id) => { const c = S.bf.find(x => x.id === id); return {co:c.co, why:loyaltyReady(c, loyaltyAbs(c)[0])}; }, id);
      check(h1 >= h0 + 1 && k1 === k0 + 1 && again.co === 2, `+2: each player drew; Locus has 2 loyalty (${h0}→${h1}, Kim ${k0}→${k1}, ${JSON.stringify(again)})`);
      check(/once|Already/.test(again.why), `only one loyalty ability per turn (${again.why})`);
      await noNotes('Locus'); await clear(A);
    });

    await step('N8 Yedora\'s face-down land has no name', async () => {
      await reset(A); const r = await A.evaluate(() => { for (let i = 0; i < 2; i++){ const c = S.lib.find(x => isCreatureCard(x)); a27FaceDownForest(c, 'Yedora'); }
        const f = S.lib.find(x => cname(x) === 'Forest'); if (f) moveCard(f.id, 'bf', {quiet:true});
        return {n:countOf('lands you control with different names', {}), plains:S.bf.some(c => cname(c) === 'Plains'), opts:r21NameOptions('').includes('Face-down land')}; });
      check(r.n === (r.plains ? 2 : 1) && !r.opts, `face-down lands don't count as a name, and aren't offered as a card name (${JSON.stringify(r)})`);
      await A.evaluate(() => { S.bf.filter(c => c.a27real).forEach(c => moveCard(c.id, 'lib', {quiet:true})); commit(); });
    });

    await step('N9 Satoru Umezawa: a ninja can use its own ninjutsu or the granted {2}{U}{B}', async () => {
      await myTurn(); await reset(A); await reset(B); await put(A, 'Satoru Umezawa'); await put(A, 'Grizzly Bears'); await toHand(A, 'Ninja of the Deep Hours'); await sleep(400);
      const m = await A.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Ninja of the Deep Hours'); return r8HandItems(c, 'hand'); });
      check(/data-act="ninjutsu"/.test(m) && /data-act="f19nj"/.test(m), 'the hand menu offers both ninjutsu costs');
      await combat('Grizzly Bears', {atBlkd:async (A) => A.evaluate(async () => { S.pool = {...emptyPool(), U:1, B:1, C:2}; const c = S.hand.find(x => cname(x) === 'Ninja of the Deep Hours'); await f19NinjutsuGranted(c, 'hand'); })});
      const r = await A.evaluate(() => ({ninja:S.bf.some(c => cname(c) === 'Ninja of the Deep Hours'), bears:S.hand.some(c => cname(c) === 'Grizzly Bears'), log:S.log.slice(-30).map(e => e.s).filter(s => /ninjutsu/.test(s))}));
      check(r.ninja && r.bears, `ninjutsu with the granted cost returned the Bears and put the Ninja in (${JSON.stringify(r)})`);
      await A.evaluate(() => { setPhase(3); commit(); }); await clear(A);
    });

    await step('N10 The Rise of Sozin II: the searcher chooses how many and which', async () => {
      await reset(A); await reset(B);
      await B.evaluate(() => { const k = [...DICT.values()].find(a => a.n === 'Lightning Bolt').k; S.hand.push({id:S.nid++, k}); S.lib.splice(3, 0, {id:S.nid++, k}); S.lib.splice(9, 0, {id:S.nid++, k}); commit(); }); await sleep(1200);
      const before = await B.evaluate(() => ['hand', 'lib', 'gy'].map(z => S[z].filter(c => cname(c) === 'Lightning Bolt').length));
      await A.evaluate(() => { window.__type = 'Lightning'; window.__want = 'Lightning Bolt'; window.__pick = 2; window.__tgt = 'kim'; });
      await A.evaluate(async () => { const a = [...DICT.values()].find(x => x.n === 'The Rise of Sozin'); const t = "Choose a card name. Search target opponent's graveyard, hand, and library for up to four cards with that name and exile them. Then that player shuffles."; await runEffects(t, {name:'The Rise of Sozin', k:a.k, full:t, tgts:[[{t:'player', pid:[...OPP.keys()][0], nm:'Kim'}]], it:{kind:'trigger'}}); });
      await after(); await sleep(1000);
      const aft = await B.evaluate(() => ['hand', 'lib', 'gy'].map(z => S[z].filter(c => cname(c) === 'Lightning Bolt').length).concat(S.ex.filter(c => cname(c) === 'Lightning Bolt').length));
      const tot0 = before.reduce((a, b) => a + b, 0), tot1 = aft.slice(0, 3).reduce((a, b) => a + b, 0);
      check(tot0 >= 3 && tot1 === tot0 - 2 && aft[3] >= 2, `chose to exile two of Kim's ${tot0} Lightning Bolts (${JSON.stringify(before)} → ${JSON.stringify(aft)})`);
      await noNotes('Rise of Sozin');
    });

    await step('N11 Marchesa: combat damage during your previous turn counts as "since your last turn"', async () => {
      await reset(A); const r = await A.evaluate(async () => { const t = "At the beginning of your upkeep, if you haven't been dealt combat damage since your last turn, you draw a card and you lose 1 life.";
        const a = [...DICT.values()].find(x => x.n === 'Invasion of Fiora'); const run = async () => { const h = S.hand.length; await doSentence("If you haven't been dealt combat damage since your last turn, you draw a card", {name:'Marchesa, Resolute Monarch', k:a.k, full:t}); return S.hand.length - h; };
        const save = [S.e27hitK, S.e27prevMy]; S.e27prevMy = 100; S.e27hitK = 100; const during = await run(); S.e27hitK = 90; const before = await run(); S.e27hitK = 120; const after = await run(); S.e27hitK = save[0]; S.e27prevMy = save[1]; return {during, before, after}; });
      check(r.during === 0 && r.before === 1 && r.after === 0, `hit during my last turn: no draw; hit before it: draw; hit after it: no draw (${JSON.stringify(r)})`);
    });

    await step('N12 Hydroelectric Specimen uses the targets actually chosen', async () => {
      await myTurn(); await reset(A); await reset(B); await put(B, 'Llanowar Elves'); await put(A, 'Grizzly Bears'); await sleep(800);
      // Kim casts Fling? no — Georges's own spells on the stack: Abrade with one mode / one target vs a two-target spell
      const r = await A.evaluate(async () => { const out = {};
        const mk = (nm, tgts) => { const a = [...DICT.values()].find(x => x.n === nm); const it = {sid:rid(6), o:nextO(), kind:'spell', card:{id:S.nid++, k:a.k}, k:a.k, nm, txt:a.o, ty:a.t, tgts, tgtNm:'x'}; S.stk.push(it); return it; };
        const kp = [...OPP.keys()][0]; const el = OPP.get(kp).bf.find(c => cname(c) === 'Llanowar Elves');
        const one = mk('Think Twice', [[{t:'card', pid:kp, id:el.id, k:el.k, nm:'Llanowar Elves'}]]);
        const two = mk('Lightning Bolt', [[{t:'card', pid:kp, id:el.id, k:el.k, nm:'Llanowar Elves'}, {t:'player', pid:kp, nm:'Kim'}]]);
        out.one = f19SingleTarget({...pubItem(one), pid:MYPID, it:one}); out.two = f19SingleTarget({...pubItem(two), pid:MYPID, it:two});
        commit(); S.stk = S.stk.filter(x => x !== one && x !== two); commit(); return out; });
      check(r.one === true && r.two === false, `a spell with one chosen target qualifies, one with two chosen targets doesn't (${JSON.stringify(r)})`);
      // across players: Kim's spell with one target is published with its target count
      await B.evaluate(() => { const a = [...DICT.values()].find(x => x.n === 'Lightning Bolt'); const pid = [...OPP.keys()][0]; S.stk.push({sid:'kimbolt', o:nextO(), kind:'spell', card:{id:S.nid++, k:a.k}, k:a.k, nm:'Lightning Bolt', txt:a.o, ty:a.t, tgts:[[{t:'player', pid, nm:'Georges'}]], tgtNm:'Georges'}); commit(); }); await sleep(1500);
      const x = await A.evaluate(() => { const it = stackAll().find(i => i.sid === 'kimbolt'); return it ? {n:it.f19n, single:f19SingleTarget(it)} : null; });
      check(x && x.n === 1 && x.single, `Kim's Bolt is seen with one chosen target (${JSON.stringify(x)})`);
      await B.evaluate(() => { S.stk = S.stk.filter(i => i.sid !== 'kimbolt'); commit(); }); await clear(A); await clear(B);
    });

    await step('N13 Psychic Paper: any creature card name (Scryfall) and every creature type', async () => {
      await reset(A); await put(A, 'Grizzly Bears'); await sleep(300);
      await A.evaluate(() => { window.__typeQ = [{type:'Faraway', want:'Faraway Test Beast'}, {type:'Time L', want:'Time Lord'}]; });
      const types = await A.evaluate(() => c27CreatureTypes().length);
      const pp = await put(A, 'Psychic Paper'); await A.evaluate((id) => { const p = S.bf.find(x => x.id === id); const g = S.bf.find(x => cname(x) === 'Grizzly Bears'); p.att = {pid:MYPID, id:g.id}; commit(); }, pp);
      await sleep(5000); await after();
      const r = await A.evaluate(() => { const g = S.bf.find(x => (info(x.c27ppOrig || x.k)?.n) === 'Grizzly Bears' || cname(x) === 'Faraway Test Beast'); return {nm:g && cname(g), ty:g && typeOf(g), f19s:window.__f19s}; });
      check(types > 250 && /Time Lord/.test(r.ty || ''), `every creature type from CR 205.3m is offered (${types}); the typed search found Time Lord (${r.ty})`);
      check(r.nm === 'Faraway Test Beast', `the equipped Bears are named Faraway Test Beast — a card that isn't loaded, found on Scryfall (${JSON.stringify(r)})`);
      await clear(A);
    });

    await step('N14 Kefka: card types among everyone\'s discarded cards, computed', async () => {
      await myTurn(); await reset(A); await reset(B);
      await A.evaluate(() => { const keep = S.hand.find(c => cname(c) === 'Sol Ring') || S.lib.find(c => cname(c) === 'Sol Ring'); S.lib.push(...S.hand.splice(0)); if (keep){ S.lib.splice(S.lib.indexOf(keep), 1); S.hand.push(keep); } commit(); });
      await B.evaluate(() => { const k = S.lib.find(c => cname(c) === 'Lightning Bolt') || S.hand.find(c => cname(c) === 'Lightning Bolt'); const g = S.lib.find(c => cname(c) === 'Grizzly Bears'); S.lib.push(...S.hand.splice(0)); [k, g].forEach(c => { if (c){ const i = S.lib.indexOf(c); if (i >= 0) S.lib.splice(i, 1); S.hand.push(c); } }); window.__disc = 'Grizzly'; commit(); });
      await sleep(1000); const h0 = await A.evaluate(() => S.hand.length);
      await toHand(A, 'Kefka, Court Mage'); await cast(A, 'Kefka, Court Mage', {U:1, B:1, R:1, C:2}); await after(); await sleep(3000); await settle([A, B]);
      const r = await A.evaluate(() => ({hand:S.hand.length, log:S.log.slice(-14).map(e => e.s).filter(s => /Kefka|card type|discard/i.test(s))}));
      check(r.hand === 2, `Sol Ring (Artifact) + Kim's Grizzly Bears (Creature): drew 2 (hand ${h0} → ${r.hand}) ${JSON.stringify(r.log)}`);
      await noAsks('Kefka'); await noNotes('Kefka');
    });
  } catch (e){ console.log('ERROR', e); check(false, 'no crash: ' + e.message); }
  console.log(`\n${H.results.filter(r => r.startsWith('PASS')).length} passed, ${H.fails()} failed`);
  await browser.close(); server.close(); process.exit(H.fails() ? 1 : 0);
})();
