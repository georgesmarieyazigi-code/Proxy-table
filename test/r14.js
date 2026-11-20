process.env.TOP = '1';
const CC = require('./cards'); const WANT = ['Rhystic Study', 'Beast Within', 'Gray Merchant of Asphodel', 'Propaganda', 'Seedborn Muse', 'Blood Moon', 'Urborg, Tomb of Yawgmoth'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name)));
// Round 9: the real Oracle text of the top commanders, played for real
const H = require('./h'); const {check, sleep, give, put, setPool, handId, menuClick, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
// answer any question the game asks: picks the cards/options whose name matches `want`, else the first legal ones; “yes” by default
const AUTO = () => { window.__want = window.__want || null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ /* targets are answered by the test */ }
    else if (m.run){ m.__done = 1; const d = m.def ?? 1; m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (A, ps) => { for (let i = 0; i < 30; i++){ await passAll(ps); if (!(await A.evaluate(() => stackAll().length || UI.resolving))) return; await sleep(150); } };
const keyOf = (p, name) => p.evaluate(n => [...DICT.values()].find(a => a.n === n || a.n.startsWith(n + ' //'))?.k, name);
// run a card's text the way a resolving trigger would
const fx = (p, name, text, extra = {}) => p.evaluate(async ([n, t, ex]) => { const c = S.bf.find(x => cname(x) === n) || S.cz.find(x => cname(x) === n); const k = c ? c.k : [...DICT.values()].find(a => a.n === n)?.k;
  const it = {sid:rid(6), kind:'trigger', k, nm:n, txt:t, srcId:c ? c.id : null, ...ex}; await runEffects(t, {name:n, k, srcId:it.srcId, it, full:t}); commit(); }, [name, text, extra]);
let PA = null; const step = async (name, fn) => { console.log('— ' + name); const f0 = H.fails(); try { await fn(); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); } if (H.fails() > f0 && PA) console.log('    LOG:', (await PA.evaluate(() => S.log.slice(-10).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r12');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r12');
  PA = A; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle(A, [B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const hand = p => p.evaluate(() => S.hand.length); const life = p => p.evaluate(() => S.life);
  const clean = async () => { await A.evaluate(() => { S.bf.filter(c => !isLand(c.k)).forEach(c => { if (c.tok || c.emb) S.bf.splice(S.bf.indexOf(c), 1); else moveCard(c.id, 'lib'); }); S.stk = []; commit(); }); await sleep(300); };
  try {
    await step('Rhystic Study: Kim chooses on her own screen whether to pay', async () => {
      await put(A, 'Rhystic Study'); const h0 = await hand(A);
      await B.evaluate(() => { window.__want = "Don't pay"; });
      await fx(A, 'Rhystic Study', 'You may draw a card unless that player pays {1}.', {evPid:await B.evaluate(() => MYPID)});
      await sleep(600);
      check(await hand(A) === h0 + 1, 'Kim didn\'t pay → Georges drew');
      await B.evaluate(() => { window.__want = 'Pay'; S.pool = {...emptyPool(), C:1}; commit(); }); const h1 = await hand(A);
      await fx(A, 'Rhystic Study', 'You may draw a card unless that player pays {1}.', {evPid:await B.evaluate(() => MYPID)});
      await sleep(600);
      check(await hand(A) === h1 && await B.evaluate(() => (S.pool.C || 0) === 0), 'Kim paid {1} from her pool → no draw');
      await B.evaluate(() => { window.__want = null; });
    });
    await step('Beast Within on Kim’s creature: Kim gets the 3/3 Beast', async () => {
      await put(B, 'Grizzly Bears'); await sleep(500);
      const bid = await B.evaluate(() => S.bf.find(c => cname(c) === 'Grizzly Bears').id); const k = await B.evaluate(() => S.bf.find(c => cname(c) === 'Grizzly Bears').k);
      await A.evaluate(async ([pid, id, k]) => { const it = {sid:rid(6), kind:'spell', k:null, nm:'Beast Within', txt:'x'}; await runEffects('Destroy target permanent. Its controller creates a 3/3 green Beast creature token.', {name:'Beast Within', k:null, it, tgts:[[{t:'card', pid, id, k, nm:'Grizzly Bears'}]], full:''}); commit(); }, [await B.evaluate(() => MYPID), bid, k]);
      check(await waitFor(B, () => S.bf.some(c => /Beast/.test(cname(c))), null, 6000), 'Kim has a Beast token');
    });
    await step('Devotion, Blood Moon, Propaganda tax', async () => {
      await put(A, 'Gray Merchant of Asphodel'); const d = await A.evaluate(() => devotion(['black']));
      check(d >= 2, 'devotion to black counts Gray Merchant’s {B}{B}: ' + d);
      await put(B, 'Propaganda'); await sleep(800);
      const r = await A.evaluate(() => { const g = S.bf.find(c => isCreatureCard(c) && !c.tok); if (!g) return 'no creature'; g.sk = false; S.pool = emptyPool(); return 'ok'; });
      const tax = await A.evaluate(() => { const out = []; for (const [pid, st] of OPP){ out.push((st.bf || []).some(e => e.k && /creatures can't attack you unless/i.test(info(e.k)?.o || ''))); } return out.join(','); });
      check(/true/.test(tax), 'Georges sees Kim’s Propaganda (attack tax applies when declaring)');
    });
    await step('Self-exiling spell and Seedborn Muse', async () => {
      await give(A, 'Seedborn Muse'); await put(A, 'Seedborn Muse');
      check(await A.evaluate(() => rulesOn('seedborn').length === 1), 'Seedborn Muse rule is on');
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
