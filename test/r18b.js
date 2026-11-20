// Round 18 helper J: BUGS.md 1–5 — leaving the game (4-player table), token stacks, additional-cost sacrifice,
// characteristic-defining P/T, number words (2-player table). PTPORT=18996 node r18b.js
process.env.TOP = '1';
const CC = require('./cards');
const WANT = ['Grizzly Bears', 'Llanowar Elves', 'Divination', 'Deadly Dispute', 'Sol Ring', 'Barrowgoyf', 'Nighthawk Scavenger', 'Gyre Sage', 'Mirrodin Besieged',
  'Lightning Bolt', 'Forest', 'Swamp', 'Island', 'Mountain', 'Plains', 'Psychosis Crawler', 'Adeline, Resplendent Cathar'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, waitFor} = H;
const AUTO = () => { setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want) : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pref = window.__pick ? (m.cards || []).filter(c => window.__pick.test(cname(c))) : []; const n = Math.max(m.min || 0, m.max ? 1 : 0); const ids = (pref.length ? pref : (m.cards || [])).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (w && (m.options || []).find(x => !x.disabled && w.test(x.label))) || (m.options || []).find(x => !x.disabled); m.__done = 1; m.resolve(o ? o.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ const i = (m.cands || []).findIndex(c => c.ok && c.pid !== MYPID); m.__done = 1; m.resolve(i >= 0 ? [m.cands[i]] : []); closeModal(); }
    else if (m.run){ m.__done = 1; m.run(m.def ?? 1); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
let ALL = []; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { await T(120000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 || process.env.LOGS) for (const [nm, p] of ALL) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-12).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})).catch(e => e.message))); };
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const toMain = async (p, ps) => { for (let i = 0; i < 50; i++){ if (await p.evaluate(() => phaseNow().mine && phaseNow().ph === 3)) return true; await p.evaluate(() => { if (!stackAll().length && !UI.modal && phaseNow().mine) nextAction(); }); await passAll(ps); } return false; };
const turnOf = p => p.evaluate(() => currentTurn()[1]);
const keyOf = (p, nm) => p.evaluate(nm => [...DICT.values()].find(a => a.n === nm)?.k, nm);
const putBf = (p, nm, extra) => p.evaluate(([nm, extra]) => { const k = [...DICT.values()].find(a => a.n === nm).k; const c = {id:S.nid++, k, x:20 + (S.nid % 30) * 3, y:30, sk:false, ...(extra || {})}; S.bf.push(c); commit(); return c.id; }, [nm, extra]);
const toHand = (p, nm) => p.evaluate(nm => { const k = [...DICT.values()].find(a => a.n === nm).k; const c = {id:S.nid++, k}; S.hand.push(c); commit(); return c.id; }, nm);

(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    /* ================= 4-player table: leaving the game (CR 800.4a) ================= */
    const names = ['Georges', 'Kim', 'Ana', 'Ben']; const P = [];
    for (let i = 0; i < 4; i++){ P.push(await H.player(browser, names[i], H.deckFor(['Edgar Markov', 'Thalia, Guardian of Thraben', 'Krenko, Mob Boss', 'Edgar Markov'][i]), i ? 'join' : 'host', 'r18b4')); await sleep(300); }
    for (const p of P) await waitFor(p, () => OPP.size === 3, null, 30000);
    ALL = names.map((n, i) => [n, P[i]]);
    const [G, K, A, B] = P; for (const p of P) await p.evaluate(AUTO);
    await G.click('[data-act="goFirst"]'); await settle(P); await toMain(G, P);
    const pid = {}; for (let i = 0; i < 4; i++) pid[names[i]] = await P[i].evaluate(() => MYPID);
    const order = await G.evaluate(() => players().map(p => p.nm)); console.log('    seat order', order.join(' → '));

    await step('#1a before: Kim can be attacked and targeted', async () => {
      check(await G.evaluate(() => defOpts().some(o => o.label === 'Kim')), 'Kim is an attack option');
      check(await G.evaluate(k => targetCands({desc:'player'}, {pid:MYPID}).some(c => c.pid === k), pid.Kim), 'Kim is a legal target player');
    });

    await step('#1b Kim loses at 0 life: her things leave, control effects end, her spell leaves the stack', async () => {
      // Georges lends Kim a Grizzly Bears; Kim lends Georges her Llanowar Elves; Kim has a creature of her own and a spell on the stack
      const bear = await putBf(G, 'Grizzly Bears'); const elf = await putBf(K, 'Llanowar Elves'); await putBf(K, 'Grizzly Bears'); await sleep(800);
      await G.evaluate(([id, k]) => { giveAway(S.bf.find(c => c.id === id), k, {}); commit(); }, [bear, pid.Kim]);
      await K.evaluate(([id, g]) => { giveAway(S.bf.find(c => c.id === id), g, {}); commit(); }, [elf, pid.Georges]);
      check(await waitFor(K, () => S.bf.some(c => c.own && cname(c) === 'Grizzly Bears'), null, 8000), 'Kim controls Georges\'s Bears');
      check(await waitFor(G, () => S.bf.some(c => c.own && cname(c) === 'Llanowar Elves'), null, 8000), 'Georges controls Kim\'s Elves');
      await toHand(K, 'Lightning Bolt'); await K.evaluate(() => { S.pool = {...emptyPool(), R:1}; const c = S.hand.find(x => cname(x) === 'Lightning Bolt'); beginCast(c, 'hand'); });
      check(await waitFor(G, () => stackAll().some(i => i.nm === 'Lightning Bolt'), null, 8000), 'Kim\'s Lightning Bolt is on the stack (Georges sees it)');
      await G.evaluate(k => { sendRq(k, 'life', -45, 'test'); commit(); }, pid.Kim);
      check(await waitFor(K, () => !!S.j18out && S.j18left === 1, null, 10000), 'Kim\'s client latched the loss and left the game');
      const kz = await K.evaluate(() => ({bf:S.bf.length, hand:S.hand.length, lib:S.lib.length, gy:S.gy.length, cz:S.cz.length, stk:S.stk.length, ban:document.querySelector('#topbar .j18ban')?.textContent || ''}));
      check(!kz.bf && !kz.hand && !kz.lib && !kz.gy && !kz.cz && !kz.stk, `every zone Kim owns is empty (${JSON.stringify(kz)})`);
      check(/spectating/.test(kz.ban), `Kim's client shows the spectating banner ("${kz.ban}")`);
      await sleep(2500);
      for (const [nm, p] of [['Georges', G], ['Ana', A], ['Ben', B]]){
        const v = await p.evaluate(k => ({bf:(OPP.get(k).bf || []).length, stk:stackAll().filter(i => i.pid === k).length, lost:!!OPP.get(k).b27lost, att:defOpts().some(o => o.pid === k), tgt:targetCands({desc:'player'}, {pid:MYPID}).some(c => c.pid === k), opp:opponents().some(o => o.pid === k)}), pid.Kim);
        check(v.lost && !v.bf && !v.stk && !v.att && !v.tgt && !v.opp, `${nm}: Kim is out — no permanents, nothing on the stack, not attackable, not targetable, not an opponent (${JSON.stringify(v)})`);
      }
      const g = await G.evaluate(() => ({bear:S.bf.filter(c => cname(c) === 'Grizzly Bears' && !c.own).length, elves:S.bf.some(c => cname(c) === 'Llanowar Elves'), lent:S.lent.length}));
      check(g.bear === 1 && !g.elves && !g.lent, `Georges got his Bears back and Kim's Elves left the game (${JSON.stringify(g)})`);
    });

    await step('#1c gaining life does not bring Kim back', async () => {
      await G.evaluate(k => { sendRq(k, 'life', 10, 'test gain'); commit(); }, pid.Kim); await sleep(2000);
      await K.evaluate(() => { gainLife(5, 'test'); S.life = 12; commit(); }); await sleep(1500);
      const k = await K.evaluate(() => ({lost:S.lost, out:S.j18out, life:S.life}));
      check(!!k.lost && !!k.out, `Kim is still out after life goes back above 0 (${JSON.stringify(k)})`);
      check(await G.evaluate(k => !!OPP.get(k).b27lost && !opponents().some(o => o.pid === k), pid.Kim), 'Georges still sees Kim as lost');
      const tk = await K.evaluate(() => { const k = [...DICT.values()].find(a => /Token/.test(a.t || '') && /Goblin/.test(a.n)).k; createToken(k, 1); return S.bf.length; });
      check(tk === 0, 'a token Kim would create is not created');
    });

    await step('#1d priority no longer waits for Kim: Georges\'s Divination resolves when Ana and Ben pass', async () => {
      await toHand(G, 'Divination'); const h0 = await G.evaluate(() => S.hand.length);
      await G.evaluate(() => { S.pool = {...emptyPool(), U:3}; beginCast(S.hand.find(c => cname(c) === 'Divination'), 'hand'); });
      await sleep(800); await settle([G, A, B]);
      check(await waitFor(G, () => !stackAll().length, null, 8000), 'the stack is empty without Kim passing');
      check(await G.evaluate(() => S.hand.length) === h0 + 1, 'Divination resolved (−1 +2 cards)');
    });

    await step('#1e turn order skips Kim', async () => {
      const kimNext = order.indexOf('Kim') === (order.indexOf('Georges') + 1) % 4;
      await G.evaluate(() => passTurn()); await sleep(2500);
      const want = kimNext ? order[(order.indexOf('Kim') + 1) % 4] : order[(order.indexOf('Georges') + 1) % 4];
      const t = await G.evaluate(() => nameOf(currentTurn()[1]));
      check(t === want && t !== 'Kim', `Georges passes → ${t} (expected ${want})`);
      for (const [nm, p] of [['Ana', A], ['Ben', B], ['Kim', K]]) check(await p.evaluate(() => nameOf(currentTurn()[1])) === t, `${nm}'s client agrees it is ${t}'s turn`);
      // go round to the player before Kim and pass: Kim is skipped again
      for (let i = 0; i < 4; i++){ const cur = await G.evaluate(() => nameOf(currentTurn()[1])); if (order[(order.indexOf(cur) + 1) % 4] === 'Kim') break; const pp = P[names.indexOf(cur)]; await sleep(1200); await pp.evaluate(() => passTurn()); await sleep(1800); }
      const before = await G.evaluate(() => nameOf(currentTurn()[1])); const pp = P[names.indexOf(before)]; await sleep(1200); await pp.evaluate(() => passTurn()); await sleep(2500);
      const after = await G.evaluate(() => nameOf(currentTurn()[1]));
      check(after === order[(order.indexOf('Kim') + 1) % 4], `${before} passes → ${after}, skipping Kim`);
    });

    await step('#1f a player who loses on their own turn passes it on; the last player standing wins', async () => {
      // make it Ben's turn, then Ben loses
      for (let i = 0; i < 4; i++){ const cur = await G.evaluate(() => nameOf(currentTurn()[1])); if (cur === 'Ben') break; await sleep(1200); await P[names.indexOf(cur)].evaluate(() => passTurn()); await sleep(1800); }
      check(await G.evaluate(() => nameOf(currentTurn()[1])) === 'Ben', 'it is Ben\'s turn');
      await B.evaluate(() => { S.life = 0; commit(); });
      check(await waitFor(G, b => !!OPP.get(b).b27lost && currentTurn()[1] !== b, pid.Ben, 10000), 'Ben lost and his turn passed on');
      const t = await G.evaluate(() => nameOf(currentTurn()[1])); check(t === 'Georges' || t === 'Ana', `the turn went to a player still in the game (${t})`);
      await A.evaluate(() => { S.life = 0; commit(); });
      check(await waitFor(G, () => /You won/.test(document.querySelector('#topbar .j18ban')?.textContent || ''), null, 10000), 'Georges\'s client shows that he won');
      check(await G.evaluate(() => opponents().length === 0 && players().length === 1), 'no opponents are left in the game');
    });
    for (const p of P) await p.context().close();

    /* ================= 2-player table ================= */
    const A2 = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r18b2');
    const B2 = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r18b2');
    ALL = [['Georges', A2], ['Kim', B2]]; const P2 = [A2, B2];
    await waitFor(A2, () => OPP.size === 1, null, 20000); await A2.evaluate(AUTO); await B2.evaluate(AUTO);
    await A2.click('[data-act="goFirst"]'); await settle(P2); await toMain(A2, P2);
    const KIM = await A2.evaluate(() => [...OPP.keys()][0]);

    await step('#2 a new token does not make an older token stack summoning sick', async () => {
      const k = await A2.evaluate(() => customToken('Vampire', '1/1', 'B'));
      await A2.evaluate(k => { createToken(k, 1); createToken(k, 1); }, k);
      check(await A2.evaluate(k => { const s = S.bf.filter(c => c.k === k); return s.length === 1 && s[0].n === 2 && s[0].sk; }, k), 'two tokens made this turn share one sick stack');
      // a real turn cycle: Georges → Kim → Georges untaps; the stack is no longer sick
      await A2.evaluate(() => passTurn()); await sleep(1500); await toMain(B2, P2); await B2.evaluate(() => passTurn()); await sleep(1500); await toMain(A2, P2);
      check(await A2.evaluate(k => canAttack(S.bf.find(c => c.k === k)) === '', k), 'after Georges\'s untap the old Vampires can attack');
      await A2.evaluate(k => createToken(k, 1), k);
      const r = await A2.evaluate(k => S.bf.filter(c => c.k === k).map(c => ({n:c.n || 1, sk:!!c.sk, atk:canAttack(c)})), k);
      const old = r.find(x => !x.sk), nw = r.find(x => x.sk);
      check(r.length === 2 && old && old.n === 2 && old.atk === '' && nw && nw.n === 1 && /summoning sick/.test(nw.atk), `old stack of 2 can still attack; the new token is a separate sick stack (${JSON.stringify(r)})`);
      await A2.evaluate(k => { S.bf = S.bf.filter(c => c.k !== k); commit(); }, k);
    });

    await step('#3 Deadly Dispute: sacrificing a noncreature artifact (Sol Ring) is paid; an unpayable cost stops the cast', async () => {
      await A2.evaluate(() => { window.__err = []; const ow = console.warn; console.warn = (...a) => { window.__err.push(a.map(x => x && x.message || String(x)).join(' ').slice(0, 140)); ow(...a); }; });
      await putBf(A2, 'Sol Ring'); await toHand(A2, 'Deadly Dispute');
      const h0 = await A2.evaluate(() => S.hand.length);
      await A2.evaluate(() => { window.__pick = /Sol Ring/; S.pool = {...emptyPool(), B:2}; beginCast(S.hand.find(c => cname(c) === 'Deadly Dispute'), 'hand'); });
      await sleep(1000); await settle(P2); await sleep(500);
      const r = await A2.evaluate(() => ({sol:S.bf.some(c => cname(c) === 'Sol Ring'), gy:S.gy.map(cname), hand:S.hand.length, tre:S.bf.some(c => c.tok && /Treasure/.test(cname(c))), err:window.__err.filter(e => /null|undefined|not iterable/.test(e))}));
      check(!r.sol && r.gy.includes('Sol Ring') && r.gy.includes('Deadly Dispute'), `Sol Ring was sacrificed and Dispute resolved (${r.gy.slice(-3)})`);
      check(r.hand === h0 - 1 + 2 && r.tre, `drew 2 cards and made a Treasure (hand ${h0} → ${r.hand})`);
      check(!r.err.length, `no crash while paying (${r.err})`);
      // nothing to sacrifice: casting is refused, nothing is paid
      await A2.evaluate(() => { S.bf = S.bf.filter(c => isLand(c.k) && !c.tok && !/Artifact|Creature/.test(info(c.k)?.t || '')); window.__pick = null; commit(); });
      await toHand(A2, 'Deadly Dispute'); const s0 = await A2.evaluate(() => ({h:S.hand.length, pool:{...S.pool, B:2}}));
      const why = await A2.evaluate(() => { const c = S.hand.find(c => cname(c) === 'Deadly Dispute'); return castCheck(c, 'hand').why || ''; });
      check(/additional cost/i.test(why), `castCheck refuses it ("${why}")`);
      await A2.evaluate(async () => { S.pool = {...emptyPool(), B:2}; await beginCast(S.hand.find(c => cname(c) === 'Deadly Dispute'), 'hand'); }); await sleep(600);
      const r2 = await A2.evaluate(() => ({stk:S.stk.length, h:S.hand.length, B:S.pool.B}));
      check(r2.stk === 0 && r2.h === s0.h && r2.B === 2, `not cast: stays in hand, mana unspent (${JSON.stringify(r2)})`);
      // the cost becomes unpayable between the check and the payment (the artifact is gone): the cast is undone
      await putBf(A2, 'Sol Ring');
      await A2.evaluate(() => { const pa = n24payAdds; n24payAdds = async function(parts, c, pre){ S.bf = S.bf.filter(b => cname(b) !== 'Sol Ring'); n24payAdds = pa; return pa(parts, c, pre); }; });
      await A2.evaluate(async () => { S.pool = {...emptyPool(), B:2}; await beginCast(S.hand.find(c => cname(c) === 'Deadly Dispute'), 'hand'); }); await sleep(800);
      const r3 = await A2.evaluate(() => ({stk:S.stk.filter(i => i.kind === 'spell').length, inHand:S.hand.some(c => cname(c) === 'Deadly Dispute'), B:S.pool.B, log:S.log.slice(-2).map(e => e.s)}));
      check(r3.stk === 0 && r3.inHand && r3.B === 2, `rewound: Dispute back in hand with {B}{B} back in the pool (${JSON.stringify(r3)})`);
      await A2.evaluate(() => { S.hand = S.hand.filter(c => cname(c) !== 'Deadly Dispute'); S.pool = emptyPool(); commit(); });
    });

    await step('#4 every printed P/T form parses; Barrowgoyf and Nighthawk Scavenger compute their stats', async () => {
      const forms = await A2.evaluate(() => ['*/1+*', '1+*/3', '*/*', '-1/-1', '+1/+0', '*²/*²', '7-*/7-*', '?/?', '∞/5', '½/½', '3½/3½', '2*/2*', 'X/X', '*+1/*+1'].map(p => p + '=' + JSON.stringify(ptOf({p}))));
      check(!forms.some(f => /null/.test(f)), 'ptOf: ' + forms.join(' '));
      // graveyards: Georges has a land and an instant; Kim has a creature and a sorcery
      await A2.evaluate(() => { const k = n => [...DICT.values()].find(a => a.n === n).k; S.gy = [{id:S.nid++, k:k('Swamp')}, {id:S.nid++, k:k('Lightning Bolt')}]; commit(); });
      await B2.evaluate(() => { const k = n => [...DICT.values()].find(a => a.n === n).k; S.gy = [{id:S.nid++, k:k('Grizzly Bears')}, {id:S.nid++, k:k('Divination')}]; commit(); });
      await sleep(1500);
      await putBf(A2, 'Gyre Sage'); await sleep(300);
      await A2.evaluate(() => { window.__err = []; });
      const gid = await A2.evaluate(() => { const k = [...DICT.values()].find(a => a.n === 'Barrowgoyf').k; const c = {id:S.nid++, k}; S.hand.push(c); moveCard(c.id, 'bf'); const b = S.bf.find(x => x.id === c.id); b.sk = false; commit(); return c.id; });
      const nid = await A2.evaluate(() => { const k = [...DICT.values()].find(a => a.n === 'Nighthawk Scavenger').k; const c = {id:S.nid++, k}; S.hand.push(c); moveCard(c.id, 'bf'); commit(); return c.id; });
      await sleep(800);
      const st = await A2.evaluate(([g, n]) => [stats(S.bf.find(c => c.id === g)), stats(S.bf.find(c => c.id === n))], [gid, nid]);
      check(JSON.stringify(st[0]) === '[4,5]', `Barrowgoyf: 4 card types in all graveyards → 4/5 (${JSON.stringify(st[0])})`);
      check(JSON.stringify(st[1]) === '[3,3]', `Nighthawk Scavenger: 1 + 2 types in Kim's graveyard → 3/3 (${JSON.stringify(st[1])})`);
      const ev = await A2.evaluate(() => ({err:window.__err.filter(e => /evolve/.test(e)), cp:(S.bf.find(c => cname(c) === 'Gyre Sage') || {}).cp || 0}));
      check(!ev.err.length && ev.cp >= 1, `Gyre Sage evolved without a warning (${JSON.stringify(ev)})`);
      // combat: Barrowgoyf attacks Kim for 4 (deathtouch, lifelink on Barrowgoyf — Georges gains 4)
      const k0 = await B2.evaluate(() => S.life); const g0 = await A2.evaluate(() => S.life);
      await A2.evaluate(() => setPhase(4));
      for (let i = 0; i < 30 && !(await A2.evaluate(() => S.cb && S.cb.step === 'atk')); i++){ await passAll(P2); await A2.evaluate(() => { if (S.cb && S.cb.step !== 'atk' && !stackAll().length) nextAction(); }); await sleep(200); }
      const why = await A2.evaluate(g => canAttack(S.bf.find(c => c.id === g)), gid); check(why === '', `Barrowgoyf can attack (${why || 'ok'})`);
      await A2.evaluate(([g, k]) => { UI.atkSel = {[g]:'p:' + k}; renderCombatPanel(); }, [gid, KIM]); await A2.click('#cbpanel [data-act="atkGo"]'); await passAll([B2]);
      if (await waitFor(B2, () => !!document.querySelector('#cbpanel [data-act="blkGo"]'), null, 8000)) await B2.click('#cbpanel [data-act="blkGo"]');
      for (let i = 0; i < 20; i++){ await passAll(P2); if (await A2.evaluate(() => phaseNow().ph === 5) || await B2.evaluate(k0 => S.life < k0, k0)) break; }
      await sleep(1000);
      const k1 = await B2.evaluate(() => S.life);
      check(k1 === k0 - 4, `Barrowgoyf dealt 4 combat damage to Kim (${k0} → ${k1})`);
      await A2.evaluate(() => { S.bf = S.bf.filter(c => isLand(c.k)); S.gy = []; commit(); }); await B2.evaluate(() => { S.gy = []; commit(); });
      await settle(P2);
    });

    await step('#5 number words: "fifteen" and beyond', async () => {
      const w = await A2.evaluate(() => [wn('fifteen'), wn('twenty-one'), wn('ninety-nine'), wn('hundred'), wn('one hundred'), wn('thousand'), wn('seventeen'), H23W.sixteen, J_W.fifteen, N24W.twelve, R21_W.eleven]);
      check(JSON.stringify(w) === '[15,21,99,100,100,1000,17,16,15,12,11]', `wn / local tables: ${JSON.stringify(w)}`);
      // Mirrodin Besieged (Phyrexian) at Georges's end step with 0 and with 15 artifact cards in the graveyard
      const go = async (nArt) => {
        await A2.evaluate(n => { const k = [...DICT.values()].find(a => a.n === 'Sol Ring').k; S.gy = []; for (let i = 0; i < n; i++) S.gy.push({id:S.nid++, k}); commit(); }, nArt);
        await toMain(A2, P2);
        await A2.evaluate(() => { window.__want = 'Phyrexian'; const k = [...DICT.values()].find(a => a.n === 'Mirrodin Besieged').k; const c = {id:S.nid++, k}; S.hand.push(c); moveCard(c.id, 'bf'); commit(); });
        await sleep(1000); await settle(P2); await A2.evaluate(() => { window.__want = null; setPhase(6); }); for (let i = 0; i < 8; i++){ await settle(P2); await sleep(300); }
        await sleep(1200);
      };
      await go(0);
      check(!(await B2.evaluate(() => S.lost || S.j18out)), 'with 0 artifact cards in the graveyard Kim does not lose');
      await A2.evaluate(() => { S.bf = S.bf.filter(c => cname(c) !== 'Mirrodin Besieged'); commit(); });
      // back to Georges's main phase
      for (let i = 0; i < 6 && (await turnOf(A2)) !== (await A2.evaluate(() => MYPID)); i++){ await B2.evaluate(() => { if (phaseNow().mine) passTurn(); }); await sleep(1500); }
      await go(15);
      check(await waitFor(B2, () => !!S.j18out, null, 8000), 'with 15 artifact cards Kim loses the game');
      check(await waitFor(A2, () => /You won/.test(document.querySelector('#topbar .j18ban')?.textContent || ''), null, 8000), 'two players: the game is over and Georges is shown as the winner');
      const kb = await B2.evaluate(() => ({ban:document.querySelector('#topbar .j18ban')?.textContent || '', left:S.j18left || 0}));
      check(/game over/.test(kb.ban) && !kb.left, `Kim sees "game over"; with two players nobody leaves (${JSON.stringify(kb)})`);
      await A2.evaluate(k => { sendRq(k, 'life', 30, 'test gain'); commit(); }, KIM); await sleep(2000); await B2.evaluate(() => { gainLife(5, 'test'); commit(); }); await sleep(1200);
      const g = await B2.evaluate(() => ({lost:!!S.lost && !!S.j18out, life:S.life}));
      check(g.lost && g.life > 0, `gaining life (a request and gainLife) does not undo the loss (${JSON.stringify(g)})`);
      await B2.evaluate(() => { setLife(10); }); await sleep(1500);
      check(await B2.evaluate(() => !!S.j18out), 'the life buttons do not undo a loss that was not about life (Mirrodin Besieged)');
      // a 0-life loss in a two-player game: life gain keeps it, the life buttons (a by-hand correction) take it back
      await B2.evaluate(() => { S.lost = ''; S.g23lost = 0; commit(); }); await sleep(1200); await B2.evaluate(() => { S.life = 0; commit(); }); await sleep(1500);
      check(await B2.evaluate(() => /0 life/.test(S.j18out || '')), 'Kim lost at 0 life');
      await B2.evaluate(() => { gainLife(4, 'test'); commit(); }); await sleep(1200);
      check(await B2.evaluate(() => !!S.j18out && S.life === 4), 'gaining 4 life keeps the loss');
      await B2.evaluate(() => { setLife(10); }); await sleep(1500);
      check(await B2.evaluate(() => !S.lost && !S.j18out), 'two players: the life buttons (a by-hand correction) take the 0-life loss back');
    });
  } catch (e){ console.log('FATAL', e.message); check(false, 'test ran'); }
  console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`);
  await browser.close(); server.close(); process.exit(H.fails() ? 1 : 0);
})();
