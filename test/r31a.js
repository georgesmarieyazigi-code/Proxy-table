// Combat loops: Aggravated Assault + Sword of Feast and Famine, Combat Celebrant + Helm of the Host
process.env.TOP = '1';
const CC = require('./cards');
const WANT = ['Aggravated Assault', 'Sword of Feast and Famine', 'Combat Celebrant', 'Helm of the Host', 'Aurelia, the Warleader', 'Grizzly Bears', 'Mountain'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, waitFor} = H;
const AUTO = () => { setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want || [];
  try { (window.__titles = window.__titles || []).push((m.title || '') + ' :: ' + (m.options || []).map(o => o.label).join(' / '));
    if (m.type === 'pick' && m.resolve){ const pref = (m.cards || []).filter(c => /Bears/.test(cname(c))); const n = Math.max(m.min || 0, m.max ? 1 : 0); const ids = (pref.length ? pref : (m.cards || [])).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = w.map(r => (m.options || []).find(x => !x.disabled && new RegExp(r, 'i').test(x.label))).find(Boolean) || (m.options || []).find(x => !x.disabled); m.__done = 1; m.resolve(o ? o.value : null); closeModal(); }
    else if (m.type === 'modes' && m.resolve){ m.__done = 1; m.resolve(window.__modes || [0, 2]); closeModal(); }
    else if (m.type === 'target' && m.resolve){ const i = (m.cands || []).findIndex(c => c.ok && c.pid !== MYPID); m.__done = 1; m.resolve(i >= 0 ? [m.cands[i]] : []); closeModal(); }
    else if (m.run){ m.__done = 1; m.run(m.def ?? 1); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const toMain = async (p, ps) => { for (let i = 0; i < 50; i++){ if (await p.evaluate(() => phaseNow().mine && phaseNow().ph === 3)) return true; await p.evaluate(() => { if (!stackAll().length && !UI.modal && phaseNow().mine) nextAction(); }); await passAll(ps); } return false; };
const putBf = (p, nm, extra) => p.evaluate(([nm, extra]) => { const k = [...DICT.values()].find(a => a.n === nm).k; const c = {id:S.nid++, k, x:20 + (S.nid % 30) * 3, y:30, sk:false, ...(extra || {})}; S.bf.push(c); commit(); return c.id; }, [nm, extra]);
const ensureLand = (p, n) => p.evaluate(n => { const k = [...DICT.values()].find(a => a.n === 'Mountain').k; const have = S.bf.filter(c => cname(c) === 'Mountain').length; for (let i = have; i < n; i++) S.bf.push({id:S.nid++, k, x:5 + i * 4, y:60, sk:false}); S.bf.forEach(c => { if (cname(c) === 'Mountain') c.tap = false; }); commit(); }, n);
const toAtk = async (G, K) => { await G.evaluate(() => setPhase(4)); for (let i = 0; i < 40 && !(await G.evaluate(() => S.cb && S.cb.step === 'atk')); i++){ await passAll([G, K]); await G.evaluate(() => { if (S.cb && S.cb.step !== 'atk' && !stackAll().length) nextAction(); }); await sleep(150); } };
const blocker = () => setInterval(() => { try { const b = document.querySelector('#cbpanel [data-act="blkGo"]'); if (b) b.click(); if (myBox() && !UI.modal) doPass(); } catch {} }, 300);
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    const G = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r31a'); await sleep(300);
    const K = await H.player(browser, 'Kim', H.deckFor('Krenko, Mob Boss'), 'join', 'r31a');
    await waitFor(G, () => OPP.size === 1, null, 30000); for (const p of [G, K]) await p.evaluate(AUTO);
    await G.click('[data-act="goFirst"]'); await settle([G, K]); await toMain(G, [G, K]); await K.evaluate(blocker);
    const KIM = await K.evaluate(() => MYPID);
    // ---------- A: Aggravated Assault + Sword of Feast and Famine ----------
    await G.evaluate(() => { S.bf = S.bf.filter(c => !isCreatureCard(c)); commit(); });
    await ensureLand(G, 6);
    const bear = await putBf(G, 'Grizzly Bears'); const sw = await putBf(G, 'Sword of Feast and Famine'); await putBf(G, 'Aggravated Assault');
    await G.evaluate(([s, b]) => { const c = S.bf.find(x => x.id === s); c.att = {pid:MYPID, id:b}; commit(); }, [sw, bear]); await sleep(500);
    await K.evaluate(() => { S.life = 40; for (let i = 0; i < 20; i++) if (S.lib.length) S.hand.push(S.lib.shift()); commit(); });
    await G.evaluate(() => { window.__titles = []; window.__want = ['Until every opponent', '^yes', 'Kim']; }); await sleep(600);
    const kh0 = await K.evaluate(() => S.hand.length);
    await G.evaluate(() => { window.__t0 = S.lastTurn; });
    await toAtk(G, K);
    await G.evaluate(([b, k]) => { UI.atkSel = {[b]:'p:' + k}; renderCombatPanel(); }, [bear, KIM]); await G.click('#cbpanel [data-act="atkGo"]');
    for (let i = 0; i < 60 && !(await G.evaluate(() => phaseNow().ph === 5 && !stackAll().length)); i++){ await passAll([G, K]); await sleep(200); }
    await sleep(1500); const k1 = await K.evaluate(() => S.life); console.log('  after combat 1: Kim', k1, 'lands untapped', await G.evaluate(() => S.bf.filter(c => cname(c) === 'Mountain' && !c.tap).length));
    // main phase 2: activate Aggravated Assault (as the player would)
    await G.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Aggravated Assault'); const ab = abilityList(c)[0]; activateAbility(c, ab); });
    await sleep(800); await settle([G, K]);
    const xc = await G.evaluate(() => S.xc); console.log('  extra combats after Assault:', xc);
    for (let i = 0; i < 40 && !(await G.evaluate(() => phaseNow().ph === 4 && S.cb && ['atk', 'atkd', 'blk', 'blkd', 'end'].includes(S.cb.step) || S.lp)); i++){ await G.evaluate(() => { if (!UI.modal && !stackAll().length) nextAction(); }); await passAll([G, K]); await sleep(300); }
    console.log('  combat 2 started:', await G.evaluate(() => ({ph:phaseNow().ph, cb:S.cb && S.cb.n + ':' + S.cb.step, lp:S.lp})));
    const t0 = Date.now(); let r;
    for (let i = 0; i < 600; i++){ await sleep(500); r = await G.evaluate(() => ({ph:phaseNow().ph, lp:S.lp, log:S.log.slice(-1)[0]?.s})); const kl = await K.evaluate(() => S.life); if (kl <= 0 || (/combat loop: ran/.test(r.log || '') )) break; }
    await sleep(2500);
    const kEnd = await K.evaluate(() => ({life:S.life, hand:S.hand.length}));
    const g = await G.evaluate(() => ({titles:(window.__titles || []).filter(t => /Combat loop/.test(t)), log:S.log.slice(-30).map(e => e.s).filter(s => /combat loop|repeated|stopped|Kim/.test(s))}));
    console.log('  A:', JSON.stringify(g, null, 1).slice(0, 1500), 'Kim', kEnd, ((Date.now() - t0) / 1000).toFixed(0) + 's');
    check(g.titles.length >= 1, 'A: the table offered the combat loop (Aggravated Assault + Sword)');
    check(kEnd.life <= 0, `A: the loop ran until Kim was dead (life ${kEnd.life})`);
    check(g.log.some(s => /combat loop: ran \d+ combats?/.test(s)), 'A: the loop reported how many combats it ran');

    // ---------- B: Combat Celebrant + Helm of the Host (next turn) ----------
    for (let i = 0; i < 120; i++){ if (await G.evaluate(() => phaseNow().mine && phaseNow().ph === 3 && S.lastTurn !== window.__t0)) break; await G.evaluate(() => { if (!stackAll().length && !UI.modal && phaseNow().mine) nextAction(); }); await K.evaluate(() => { if (!stackAll().length && !UI.modal && phaseNow().mine) nextAction(); }); await passAll([G, K]); }
    await K.evaluate(() => { S.life = 40; S.lost = 0; S.g23lost = 0; commit(); }); await sleep(800);
    console.log('  B turn', await G.evaluate(() => turnStr()), 'Kim', await K.evaluate(() => S.life));
    await G.evaluate(() => { S.bf = S.bf.filter(c => !isCreatureCard(c) && !/Sword|Aggravated/.test(cname(c))); commit(); });
    const cel = await putBf(G, 'Combat Celebrant'); const helm = await putBf(G, 'Helm of the Host');
    await G.evaluate(([h, c]) => { const x = S.bf.find(b => b.id === h); x.att = {pid:MYPID, id:c}; commit(); }, [helm, cel]); await sleep(600);
    await G.evaluate(() => { window.__titles = []; window.__want = ['Until every opponent', '^yes', 'exert', 'Kim']; });
    await toAtk(G, K);
    const atk1 = await G.evaluate(k => { const sel = {}; S.bf.filter(c => isCreatureCard(c) && !canAttack(c)).forEach(c => sel[c.id] = 'p:' + k); UI.atkSel = sel; renderCombatPanel(); return Object.keys(sel).length; }, KIM);
    console.log('  B combat 1 attackers:', atk1); await G.click('#cbpanel [data-act="atkGo"]');
    const tB = Date.now();
    for (let i = 0; i < 360; i++){ await sleep(500); if (i === 40) console.log('    DEBUG', JSON.stringify(await G.evaluate(() => ({key:prioKey(), pass:S.pass, opPass:[...OPP.values()].map(o => o.pass), stk:stackAll().length, res:UI.resolving, cbBusy:UI.cbBusy, can:S.bf.filter(c => isCreatureCard(c)).map(c => cname(c) + ':' + (canAttack(c) || 'ok') + (c.tap ? ':T' : '')), win:typeof WIN !== 'undefined' && WIN[4], at:S.cb && S.cb.at}))));
      if (i % 20 === 0) console.log('    B t' + i, JSON.stringify(await G.evaluate(() => ({ph:phaseNow().ph, cb:S.cb && S.cb.n + ':' + S.cb.step, lp:S.lp, xc:S.xc, modal:UI.modal && UI.modal.title, last:S.log.slice(-2).map(e => e.s)}))), 'Kim', await K.evaluate(() => S.life)); const kl = await K.evaluate(() => S.life); const lg = await G.evaluate(() => S.log.slice(-1)[0]?.s || ''); if (kl <= 0 && !(await G.evaluate(() => S.lp))) break; if (/combat loop: ran/.test(lg)) break;
      if (!(await G.evaluate(() => S.lp))) { await G.evaluate(() => { if (!UI.modal && !stackAll().length && (phaseNow().ph !== 4 || (S.cb && S.cb.step === 'begin'))) nextAction(); }); await passAll([G, K]); } }
    await sleep(2000);
    const b = await G.evaluate(() => ({titles:(window.__titles || []).filter(t => /Combat loop/.test(t)).length, cel:S.bf.filter(c => cname(c) === 'Combat Celebrant').reduce((x, c) => x + (c.n || 1), 0), log:S.log.slice(-70).map(e => e.s).filter(s => /combat loop|exert|untap|attacks|additional|created|can't|Celebrant/i.test(s)).slice(-40)}));
    const kB = await K.evaluate(() => S.life);
    console.log('  B:', JSON.stringify(b, null, 1), 'Kim', kB, ((Date.now() - tB) / 1000).toFixed(0) + 's');
    check(b.titles >= 1, 'B: the table offered the combat loop (Combat Celebrant + Helm of the Host)');
    check(kB <= 0, `B: the loop ran until Kim was dead (life ${kB}, ${b.cel} Celebrants)`);
  } catch (e){ console.log('ERROR', e); }
  console.log(`${H.results.filter(r => /^PASS/.test(r)).length} passed, ${H.fails()} failed`);
  await browser.close(); server.close(); process.exit(0);
})();
