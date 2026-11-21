// Kinnan, Bonder Prodigy: extra mana only for nonland permanents; "enters tapped unless you have two or more opponents"
process.env.TOP = '1';
const CC = require('./cards');
const WANT = ['Kinnan, Bonder Prodigy', 'City of Brass', 'Mana Confluence', 'Bala Ged Recovery // Bala Ged Sanctuary', 'Command Tower', 'Breeding Pool', 'Exotic Orchard', 'Yavimaya Coast', 'Llanowar Elves', 'Tropical Island', 'Bountiful Promenade', 'Spectator Seating', 'Mountain'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, waitFor} = H;
const AUTO = () => { setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want || [];
  try { (window.__titles = window.__titles || []).push((m.title || '') + ' :: ' + (m.options || []).map(o => o.label).join(' / '));
    if (m.type === 'pick' && m.resolve){ const pref = (m.cards || []).filter(c => /Bears/.test(cname(c))); const n = Math.max(m.min || 0, m.max ? 1 : 0); const ids = (pref.length ? pref : (m.cards || [])).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = w.map(r => (m.options || []).find(x => !x.disabled && new RegExp(r, 'i').test(x.label))).find(Boolean) || (m.options || []).find(x => !x.disabled); m.__done = 1; m.resolve(o ? o.value : null); closeModal(); }
    else if (m.type === 'modes' && m.resolve){ m.__done = 1; m.resolve(window.__modes || [0, 2]); closeModal(); }
    else if (m.type === 'target' && m.resolve){ const i = (m.cands || []).findIndex(c => c.ok && c.pid !== MYPID); m.__done = 1; m.resolve(i >= 0 ? [m.cands[i]] : []); closeModal(); }
    else if (m.run){ m.__done = 1; m.run(window.__num || m.def || 1); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const toMain = async (p, ps) => { for (let i = 0; i < 50; i++){ if (await p.evaluate(() => phaseNow().mine && phaseNow().ph === 3)) return true; await p.evaluate(() => { if (!stackAll().length && !UI.modal && phaseNow().mine) nextAction(); }); await passAll(ps); } return false; };
const putBf = (p, nm, extra) => p.evaluate(([nm, extra]) => { const k = [...DICT.values()].find(a => a.n === nm).k; const c = {id:S.nid++, k, x:20 + (S.nid % 30) * 3, y:30, sk:false, ...(extra || {})}; S.bf.push(c); commit(); return c.id; }, [nm, extra]);
const ensureLand = (p, n) => p.evaluate(n => { const k = [...DICT.values()].find(a => a.n === 'Mountain').k; const have = S.bf.filter(c => cname(c) === 'Mountain').length; for (let i = have; i < n; i++) S.bf.push({id:S.nid++, k, x:5 + i * 4, y:60, sk:false}); S.bf.forEach(c => { if (cname(c) === 'Mountain') c.tap = false; }); commit(); }, n);
const toAtk = async (G, K) => { await G.evaluate(() => setPhase(4)); for (let i = 0; i < 40 && !(await G.evaluate(() => S.cb && S.cb.step === 'atk')); i++){ await passAll([G, K]); await G.evaluate(() => { if (S.cb && S.cb.step !== 'atk' && !stackAll().length) nextAction(); }); await sleep(150); } };
const blocker = () => setInterval(() => { try { const b = document.querySelector('#cbpanel [data-act="blkGo"]'); if (b) b.click(); if (myBox() && !UI.modal) doPass(); } catch {} }, 300);
const toGy = (p, nm) => p.evaluate(nm => { const k = [...DICT.values()].find(a => a.n === nm).k; const c = {id:S.nid++, k}; S.gy.push(c); commit(); return c.id; }, nm);
const toHand = (p, nm) => p.evaluate(nm => { const k = [...DICT.values()].find(a => a.n === nm).k; const c = {id:S.nid++, k}; S.hand.push(c); commit(); return c.id; }, nm);
// pass priority only until the stack is down to `depth` items (the player holds Jeska's Will on the stack)
const passTo = async (G, K, depth) => { const c0 = await G.evaluate(() => S.log.filter(e => /\(copy\) resolved/.test(e.s)).length); for (let i = 0; i < 80; i++){ if (await G.evaluate(c0 => S.log.filter(e => /\(copy\) resolved/.test(e.s)).length > c0 && stackAll().length <= 1 && !UI.resolving, c0)) return true; if (i % 15 === 5) console.log('      passTo', i, JSON.stringify(await G.evaluate(() => ({stk:stackAll().map(x => x.nm + ':' + (x.pid === MYPID ? 'me' : 'kim')), key:prioKey(), pass:S.pass, box:!!myBox(), res:!!UI.resolving, modal:UI.modal && [UI.modal.type, UI.modal.title]}))), 'K', JSON.stringify(await K.evaluate(() => ({key:prioKey(), pass:S.pass, box:!!myBox(), modal:UI.modal && UI.modal.title})))); await K.evaluate(() => { if (myBox()) doPass(); }); await G.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } return false; };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    const G = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'rsnd'); await sleep(300);
    const K = await H.player(browser, 'Kim', H.deckFor('Krenko, Mob Boss'), 'join', 'rsnd');
    await waitFor(G, () => OPP.size === 1, null, 30000); await G.click('[data-act="goFirst"]'); await sleep(1500);
    check(await G.isVisible('#sndBtn'), 'the top bar has a sound button');
    await G.click('#sndBtn'); await sleep(300); check(await G.isVisible('#sndPanel'), 'it opens the sound panel');
    await G.click('#sndPanel [data-snd="music"]'); await G.fill('#sndPanel [data-snd="mvol"]', '20'); await G.dispatchEvent('#sndPanel [data-snd="mvol"]', 'input');
    await G.fill('#sndPanel [data-snd="vol"]', '80'); await G.dispatchEvent('#sndPanel [data-snd="vol"]', 'input');
    const st = await G.evaluate(() => ({music:SND.music, mvol:SND.mvol, vol:SND.vol, saved:JSON.parse(localStorage.getItem('pt.snd')), musVol:SND.mus && SND.mus.volume, src:SND.mus && SND.mus.src}));
    console.log('  ', JSON.stringify(st));
    check(st.music && Math.abs(st.mvol - 0.2) < 0.01 && Math.abs(st.vol - 0.8) < 0.01 && st.saved.mvol === 0.2, 'music on, music volume 20 %, effects 80 %, remembered');
    check(st.musVol > 0 && st.musVol <= 0.13, `music plays quietly (element volume ${st.musVol})`);
    await G.mouse.click(5, 300); await sleep(200); check(!(await G.$('#sndPanel')), 'clicking elsewhere closes the panel');
    const m = await G.evaluate(() => { const me = MYPID; const t = s => sndFor({pid:me, s}); return {
      draw:t('drew a card'), play:t('played Forest'), cast:t('cast Lightning Bolt for {R}'), tap:t('tapped Forest for {G}'), atk:t('attacks Kim with Grizzly Bears'), tok:t('created 3 Goblin tokens'),
      ctr:t('put 2 +1/+1 counters on Grizzly Bears'), dice:t('🎲 Chaos Dragon: rolled 4 and 6'), turn:t('untapped — turn 3'), loss:t('life 40 → 37'), gain:t('life 37 → 40'), shuf:t('shuffled their library'), countered:t('Lightning Bolt was countered by Kim') }; });
    console.log('  ', JSON.stringify(m));
    check(m.draw === 'draw' && m.play === 'play' && m.cast === 'cast' && m.tap === 'tap' && m.atk === 'attack' && m.tok === 'token' && m.ctr === 'counter' && m.dice === 'dice' && m.turn === 'turn' && m.loss === 'hit' && m.gain === 'gain' && m.shuf === 'shuffle' && m.countered !== 'counter', 'each kind of log line picks the right sound (and "countered" is not a counter)');
    check(await G.evaluate(() => typeof sndPlay === 'function' && !SND.frame), 'the player page makes sound; bot frames don\'t');
  } catch (e){ console.log('ERROR', e); }
  console.log(`${H.results.filter(r => /^PASS/.test(r)).length} passed, ${H.fails()} failed`);
  await browser.close(); server.close(); process.exit(0);
})();
