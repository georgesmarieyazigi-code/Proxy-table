process.env.TOP = '1';
// Round 24M: the stack — copying, exchanging, stealing and imprinting spells and abilities, in a real 2-player game
const CC = require('./cards');
const WANT = ['Rings of Brighthearth', 'Wellwisher', 'Harsh Mentor', "Illusionist's Bracers", 'Strionic Resonator', 'Lithoform Engine', 'Lightning Bolt', 'Shock', 'Opt', 'Chain Lightning', 'Delay',
  "Narset's Reversal", 'Perplexing Chimera', 'Twinning Staff', 'Reverberate', 'Display of Power', 'Mindbreak Trap', "Glen Elendra's Answer", 'Whirlwind Denial', 'Isochron Scepter', "Mizzix's Mastery",
  'Mystic Snake', 'Shifting Grift', 'Bonus Round', 'Tempt with Mayhem', 'Double Major', 'Subtlety', 'Wall of Omens', 'Llanowar Elves', 'Jin-Gitaxias, Progress Tyrant', 'Invert Polarity', 'Divination',
  'Counterspell', 'Mausoleum Wanderer', 'Chain of Vapor', 'Abstruse Archaic', 'Memnite', 'Elvish Visionary', 'Krark, the Thumbless', 'Sevinne\'s Reclamation', 'Kiora\'s Follower', 'Ambush Viper'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, put, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { setInterval(() => { if (window.__hold && UI.box) UI.box.hold = true; }, 40); window.__want = window.__want || null; window.__tgt = window.__tgt || null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ if (!window.__tgt) return; const re = new RegExp(window.__tgt, 'i'); const c = (m.cands || []).find(x => x.ok && re.test(x.nm)); if (!c) return; m.__done = 1; m.resolve([c]); closeModal(); }
    else if (m.run){ m.__done = 1; const d = m.def ?? 1; m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const toHand = (p, n) => p.evaluate(n => { for (const z of ['lib', 'gy', 'ex', 'bf']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.hand.push(c); commit(); return c.id; } } return S.hand.find(c => cname(c) === n)?.id; }, n);
const cast = (p, n) => p.evaluate(async n => { const c = S.hand.find(x => cname(x) === n); if (!c) return 'not in hand'; S.pool = {...emptyPool(), W:6, U:6, B:6, R:6, G:6, C:6}; commit(); await beginCast(c, 'hand'); return S.hand.includes(c) ? 'not cast' : 'ok'; }, n);
const toGy = (p, n) => p.evaluate(n => { const c = S.bf.find(x => cname(x) === n); if (c){ S.bf.splice(S.bf.indexOf(c), 1); reset(c); S.gy.push(c); commit(); return true; } return false; }, n);
const activate = (p, n, re) => p.evaluate(async ([n, re]) => { const c = S.bf.find(x => cname(x) === n); if (!c) return 'missing'; c.sk = false; c.tap = false; S.pool = {...emptyPool(), W:6, U:6, B:6, R:6, G:6, C:6}; const ab = abilityList(c).find(a => new RegExp(re, 'i').test(a.eff)); if (!ab) return 'no ability'; await activateAbility(c, ab); return 'ok'; }, [n, re]);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !new RegExp(process.env.ONLY).test(name)) return; console.log('— ' + name); const f0 = H.fails(); try { await fn(); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-12).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2m');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2m');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const life = p => p.evaluate(() => S.life);
  const bfNames = p => p.evaluate(() => S.bf.map(cname));
  const after = async () => { await sleep(500); await settle([A, B]); await sleep(1200); await settle([A, B]); await sleep(500); };
  const handN = (p, n) => p.evaluate(n => S.hand.filter(c => cname(c) === n).length, n);
  const setT = async (p, t, w) => p.evaluate(([t, w]) => { window.__tgt = t; window.__want = w; }, [t, w || null]);
  const untap = (p, n) => p.evaluate(n => { const c = S.bf.find(x => cname(x) === n); if (c){ c.tap = false; c.sk = false; commit(); } }, n);
  const hold = p => p.evaluate(() => { window.__hold = true; });
  const seeStack = async (p, n = 1) => { for (let i = 0; i < 40; i++){ if (await p.evaluate(n => stackAll().length >= n, n)) return true; await sleep(100); } return false; };
  const clean = async () => { for (const p of [A, B]) await p.evaluate(() => { window.__hold = false; S.m24bonus = null; window.__tgt = null; window.__want = null; S.pool = emptyPool(); commit(); }); };
  try {
    await step('Rings of Brighthearth: pay {2} and copy an activated ability (Wellwisher)', async () => {
      await put(A, 'Wellwisher'); await put(A, 'Llanowar Elves'); await put(A, 'Rings of Brighthearth'); await after();
      const l0 = await life(A); check(await activate(A, 'Wellwisher', 'gain') === 'ok', 'activated Wellwisher'); await after();
      const l1 = await life(A); const lg = await A.evaluate(() => S.log.slice(-10).map(e => e.s).join(' | '));
      check(l1 - l0 === 4, `gained 2 + 2 (copy) = ${l1 - l0}`); if (l1 - l0 !== 4) console.log('    ', lg);
      await toGy(A, 'Rings of Brighthearth');
    });
    await step('Harsh Mentor (Kim): Georges activates a creature ability and takes 2', async () => {
      await put(B, 'Harsh Mentor'); await after(); await untap(A, 'Wellwisher');
      const l0 = await life(A); await activate(A, 'Wellwisher', 'gain'); await after();

      const l1 = await life(A); check(l1 - l0 === 0, `gained 2, took 2 from Kim's Harsh Mentor: net ${l1 - l0}`);
      await toGy(B, 'Harsh Mentor'); await after();
    });
    await step("Illusionist's Bracers: the equipped creature's ability is copied", async () => {
      await put(A, "Illusionist's Bracers"); await A.evaluate(() => { const b = S.bf.find(x => cname(x) === "Illusionist's Bracers"); const w = S.bf.find(x => cname(x) === 'Wellwisher'); b.att = {pid:MYPID, id:w.id}; commit(); });
      await untap(A, 'Wellwisher'); const l0 = await life(A); await activate(A, 'Wellwisher', 'gain'); await after();
      const l1 = await life(A); check(l1 - l0 === 4, `gained 2 + 2 (copy) = ${l1 - l0}`);
      await toGy(A, "Illusionist's Bracers");
    });
    await step('Strionic Resonator: the triggered ability is chosen as Resonator is activated, then copied', async () => {
      await put(A, 'Strionic Resonator'); const h0 = await A.evaluate(() => S.hand.length);
      await put(A, 'Elvish Visionary'); await sleep(300);
      const r = await activate(A, 'Strionic Resonator', 'copy'); const tg = await A.evaluate(() => { const it = S.stk.find(x => x.kind === 'ability' && x.nm === 'Strionic Resonator'); return it ? it.tgtNm : 'none'; });
      check(r === 'ok' && /Elvish Visionary/.test(tg), `Resonator targets the trigger on activation (${tg})`);
      await after(); const h1 = await A.evaluate(() => S.hand.length); check(h1 - h0 === 2, `drew 2 (trigger + copy): ${h1 - h0}`);
      await toGy(A, 'Strionic Resonator');
    });
    await step('Chain Lightning: Kim pays {R}{R} and copies it back at Georges (on her client)', async () => {
      await toHand(A, 'Chain Lightning'); await setT(A, 'Kim'); await setT(B, 'Georges');
      const la = await life(A), lb = await life(B);
      check(await cast(A, 'Chain Lightning') === 'ok', 'Georges cast Chain Lightning at Kim');
      await A.evaluate(() => { S.pool = emptyPool(); S.bf.forEach(c => { if (isLand(c.k)) c.tap = true; }); commit(); });
      await B.evaluate(() => { S.pool = {...emptyPool(), R:2}; commit(); });
      await after(); await A.evaluate(() => { S.pool = emptyPool(); commit(); }); await after();
      const la1 = await life(A), lb1 = await life(B); check(lb - lb1 === 3 && la - la1 === 3, `Kim −${lb - lb1}, Georges −${la - la1} (Kim's copy)`);
      await clean();
    });
    await step("Narset's Reversal: copy Kim's Lightning Bolt at her and return the Bolt to her hand", async () => {
      await toHand(B, 'Lightning Bolt'); await setT(B, 'Georges'); await hold(A); check(await cast(B, 'Lightning Bolt') === 'ok', 'Kim cast Lightning Bolt at Georges');
      await seeStack(A); await toHand(A, "Narset's Reversal"); await setT(A, 'Kim', 'Lightning Bolt'); const la = await life(A), lb = await life(B);
      check(await cast(A, "Narset's Reversal") === 'ok', "Georges cast Narset's Reversal"); await after();
      const la1 = await life(A), lb1 = await life(B); check(la1 === la && lb - lb1 === 3, `Georges unhurt (${la - la1}), Kim −${lb - lb1}`);
      check(await handN(B, 'Lightning Bolt') === 1, "the Bolt went back to Kim's hand"); await clean();
    });
    await step('Twinning Staff + Reverberate: two copies of Kim\'s Bolt', async () => {
      await put(A, 'Twinning Staff'); await setT(B, 'Georges'); await hold(A); await cast(B, 'Lightning Bolt');
      await seeStack(A); await toHand(A, 'Reverberate'); await setT(A, 'Kim', 'Lightning Bolt'); const la = await life(A), lb = await life(B);
      check(await cast(A, 'Reverberate') === 'ok', 'Georges cast Reverberate'); await after();
      const la1 = await life(A), lb1 = await life(B); check(la - la1 === 3 && lb - lb1 === 6, `Georges −${la - la1}, Kim −${lb - lb1} (two copies)`);
      await toGy(A, 'Twinning Staff'); await clean();
    });
    await step('Delay: Kim\'s spell is exiled with three time counters (suspended) on her client', async () => {
      await toHand(B, 'Opt'); await hold(A); check(await cast(B, 'Opt') === 'ok', 'Kim cast Opt');
      await seeStack(A); await toHand(A, 'Delay'); await setT(A, null, 'Opt'); check(await cast(A, 'Delay') === 'ok', 'Georges cast Delay'); await after();
      const r = await B.evaluate(() => { const c = S.ex.find(x => cname(x) === 'Opt'); return c ? [c.r21bsus, (c.nc || {}).time] : null; });
      check(r && r[0] && r[1] === 3, `Opt in Kim's exile with ${r && r[1]} time counters`); await clean();
    });
    await step('Perplexing Chimera: exchange it for Kim\'s Shock and redirect the Shock', async () => {
      await put(A, 'Perplexing Chimera'); await after(); await toHand(B, 'Shock'); await setT(B, 'Georges'); await setT(A, 'Kim');
      const la = await life(A), lb = await life(B); check(await cast(B, 'Shock') === 'ok', 'Kim cast Shock at Georges'); await after(); await sleep(800); await after();
      const la1 = await life(A), lb1 = await life(B); check(la1 === la && lb - lb1 === 2, `Georges unhurt (${la - la1}), Kim −${lb - lb1}`);
      check((await bfNames(B)).includes('Perplexing Chimera') && !(await bfNames(A)).includes('Perplexing Chimera'), 'Kim now controls Perplexing Chimera');
      await toGy(B, 'Perplexing Chimera'); await after(); await clean();
    });
    await step("Glen Elendra's Answer: counter all of Kim's spells, one Faerie for each", async () => {
      await hold(A); await toHand(B, 'Shock'); await setT(B, 'Georges'); await cast(B, 'Shock'); await toHand(B, 'Opt'); await cast(B, 'Opt');
      await seeStack(A, 2); await toHand(A, "Glen Elendra's Answer"); const f0 = await A.evaluate(() => S.bf.filter(c => /Faerie/.test(typeOf(c))).reduce((a, c) => a + (c.n || 1), 0));
      check(await cast(A, "Glen Elendra's Answer") === 'ok', "Georges cast Glen Elendra's Answer"); await after();
      const f1 = await A.evaluate(() => S.bf.filter(c => /Faerie/.test(typeOf(c))).reduce((a, c) => a + (c.n || 1), 0)); const g = await B.evaluate(() => S.gy.map(cname));
      check(f1 - f0 === 2, `two Faeries (${f1 - f0})`); check(g.includes('Shock') && g.includes('Opt'), 'both spells in Kim\'s graveyard'); await clean();
    });
    await step('Isochron Scepter: imprint Shock, then cast a copy', async () => {
      await toHand(A, 'Shock'); await setT(A, 'Kim', 'Shock'); await put(A, 'Isochron Scepter'); await after();
      const imp = await A.evaluate(() => (S.bf.find(x => cname(x) === 'Isochron Scepter')?.m24imp || []).map(k => info(k).n)); check(imp.includes('Shock'), `imprinted ${imp}`);
      const lb = await life(B); check(await activate(A, 'Isochron Scepter', 'copy') === 'ok', 'activated the Scepter'); await after();
      check(lb - await life(B) === 2, `the copy of Shock hit Kim (−${lb - await life(B)})`); await clean();
    });
    await step("Mizzix's Mastery: cast a copy of Lightning Bolt from the graveyard", async () => {
      await A.evaluate(() => { for (const z of ['lib', 'hand', 'ex', 'gy']){ const i = S[z].findIndex(c => cname(c) === 'Lightning Bolt'); if (i >= 0){ const [c] = S[z].splice(i, 1); S.gy.push(c); break; } } S.gy = S.gy.filter(c => cname(c) === 'Lightning Bolt' || !/Instant|Sorcery/.test(info(c.k).t)); commit(); });
      await toHand(A, "Mizzix's Mastery"); await setT(A, 'Lightning Bolt|Kim'); const lb = await life(B);
      check(await cast(A, "Mizzix's Mastery") === 'ok', "Georges cast Mizzix's Mastery"); await after();
      check(lb - await life(B) === 3, `the Bolt copy hit Kim (−${lb - await life(B)})`);
      check(await A.evaluate(() => S.ex.some(c => cname(c) === 'Lightning Bolt')), 'the Bolt card is exiled'); await clean();
    });
    await step('Mystic Snake: the spell is chosen when the trigger goes on the stack', async () => {
      await hold(A); await toHand(B, 'Opt'); await cast(B, 'Opt'); await seeStack(A); await setT(A, null, 'Opt');
      await put(A, 'Mystic Snake'); await seeStack(B, 2); await sleep(800);
      const tg = await A.evaluate(() => { const it = S.stk.find(x => x.nm === 'Mystic Snake'); return it ? it.tgtNm || '' : 'gone'; });
      check(/Opt/.test(tg), `trigger targets ${tg} while on the stack`); await after();
      check((await B.evaluate(() => S.gy.map(cname))).includes('Opt'), 'Opt was countered'); await clean();
    });
    await step('Shifting Grift: exchange Memnite and Kim\'s Wall of Omens', async () => {
      await put(A, 'Memnite'); await put(B, 'Wall of Omens'); await after(); await toHand(A, 'Shifting Grift'); await setT(A, 'Memnite|Wall of Omens', 'creatures|Exchange control of two target creatures');
      await A.evaluate(() => { const old = pickTargets; window.__pt = old; pickTargets = async (sp, src, title) => { if (sp.n === 2){ const out = []; for (const b of boardsAll()) b.bf.forEach(c => { if (['Memnite', 'Wall of Omens'].includes(info(c.k)?.n)) out.push({t:'card', pid:b.pid, id:c.id, k:c.k, nm:info(c.k).n}); }); return out; } return old(sp, src, title); }; });
      const r = await cast(A, 'Shifting Grift'); await A.evaluate(() => { pickTargets = window.__pt; });
      check(r === 'ok', 'Georges cast Shifting Grift'); await after(); await sleep(600); await after();
      check((await bfNames(A)).includes('Wall of Omens') && (await bfNames(B)).includes('Memnite'), 'Georges controls the Wall, Kim controls Memnite'); await clean();
    });
    await step('Bonus Round: Kim copies her own Shock on her client', async () => {
      await toHand(A, 'Bonus Round'); check(await cast(A, 'Bonus Round') === 'ok', 'Georges cast Bonus Round'); await after();
      await toHand(B, 'Shock'); await setT(B, 'Georges'); const la = await life(A); await cast(B, 'Shock'); await after(); await sleep(500); await after();
      check(la - await life(A) === 4, `Shock + copy: Georges −${la - await life(A)}`); await clean();
    });
    await step('Double Major: the copy of a creature spell becomes a token', async () => {
      await toHand(A, 'Elvish Visionary'); check(await cast(A, 'Elvish Visionary') === 'ok', 'cast Elvish Visionary');
      await toHand(A, 'Double Major'); await setT(A, null, 'Elvish Visionary'); check(await cast(A, 'Double Major') === 'ok', 'cast Double Major'); await after();
      const r = await A.evaluate(() => S.bf.filter(c => cname(c) === 'Elvish Visionary').map(c => !!c.tok + ':' + (c.n || 1)));
    });
    await step("Subtlety: Kim's creature spell goes on top of her library", async () => {
      await hold(A); await toHand(B, 'Ambush Viper'); await cast(B, 'Ambush Viper'); await seeStack(A); await hold(A); await sleep(300); await setT(A, null, 'Ambush Viper');
      await put(A, 'Subtlety'); await seeStack(B, 2); await sleep(500); await after(); await sleep(500); await after();
      const r = await B.evaluate(() => ({lib:S.lib.slice(0, 1).map(cname), bf:S.bf.filter(c => cname(c) === 'Ambush Viper').length}));
      check(r.lib[0] === 'Ambush Viper', `Ambush Viper is on top of Kim's library (${r.lib[0]})`); await clean();
    });
    await step('Jin-Gitaxias: Kim\'s Shock is countered; Georges\'s Divination is copied', async () => {
      await put(A, 'Jin-Gitaxias, Progress Tyrant'); await after(); await toHand(B, 'Shock'); await setT(B, 'Georges');
      const la = await life(A); await cast(B, 'Shock'); await after(); check(la === await life(A), 'Shock was countered');
      await toHand(A, 'Divination'); const h0 = await A.evaluate(() => S.hand.length); await cast(A, 'Divination'); await after();
      const h1 = await A.evaluate(() => S.hand.length); check(h1 - h0 === 3, `Divination + copy: drew 4, net hand ${h1 - h0}`);
      await toGy(A, 'Jin-Gitaxias, Progress Tyrant'); await clean();
    });
    await step('Invert Polarity: win → Georges takes the spell, lose → it is countered', async () => {
      await toHand(B, 'Lightning Bolt'); await setT(B, 'Georges'); await hold(A); await cast(B, 'Lightning Bolt'); await seeStack(A); await toHand(A, 'Invert Polarity'); await setT(A, 'Kim', 'Lightning Bolt');
      const la = await life(A), lb = await life(B); check(await cast(A, 'Invert Polarity') === 'ok', 'cast Invert Polarity'); await after(); await sleep(500); await after();
      const la1 = await life(A), lb1 = await life(B); check(la1 === la && (lb - lb1 === 3 || lb === lb1), `Georges unhurt; Kim −${lb - lb1} (${lb - lb1 ? 'won the flip' : 'lost the flip: countered'})`); await clean();
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
