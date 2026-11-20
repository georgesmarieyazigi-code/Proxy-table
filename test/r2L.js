process.env.TOP = '1';
// Round 24L: copy effects (rule 707) in a real 2-player game — enter as a copy, becomes a copy, copies with exceptions,
// copies of copies, token copies, spell copies that become tokens, and what the other player sees
const CC = require('./cards');
const WANT = ['Clone', 'Spark Double', 'Phantasmal Image', 'Vesuva', "Thespian's Stage", 'Mirage Mirror', 'Saw in Half', 'Nanogene Conversion', 'Double Major', 'Mystic Reflection',
  'Superior Spider-Man', 'Body Double', 'Kalitas, Traitor of Ghet', 'Llanowar Elves', 'Wall of Omens', 'Werebear', 'Darksteel Angel', 'Steel Golem', 'Gemstone Caverns', 'Command Tower',
  'Brudiclad, Telchor Engineer', 'Sakashima of a Thousand Faces', 'Echoing Assault', 'Preston, the Vanisher', 'Elvish Mystic', 'Fyndhorn Elves', 'Imposter Mech', 'Moritte of the Frost'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, put, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { window.__want = window.__want || null; window.__tgt = window.__tgt || null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ if (!window.__tgt) return; const re = new RegExp(window.__tgt, 'i'); const c = (m.cands || []).find(x => x.ok && re.test(x.nm)); if (!c) return; m.__done = 1; m.resolve([c]); closeModal(); }
    else if (m.run){ m.__done = 1; const d = m.def ?? 1; m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const TO = (pr) => Promise.race([new Promise(r => setTimeout(() => r('timeout'), 20000)), pr]);
const toHand = (p, n) => p.evaluate(n => { for (const z of ['lib', 'gy', 'ex', 'bf']){ const i = S[z].findIndex(c => cname(c) === n || info(c.origK)?.n === n); if (i >= 0){ const [c] = S[z].splice(i, 1); if (c.origK){ c.k = c.origK; delete c.origK; } reset(c); S.hand.push(c); commit(); return c.id; } } return S.hand.find(c => cname(c) === n)?.id; }, n);
const cast = (p, n) => TO(p.evaluate(async n => { const c = S.hand.find(x => cname(x) === n); if (!c) return 'not in hand'; S.pool = {...emptyPool(), W:9, U:9, B:9, R:9, G:9, C:9}; commit(); await beginCast(c, 'hand'); return S.hand.includes(c) ? 'not cast' : 'ok'; }, n));
const toGy = (p, n) => p.evaluate(n => { const c = S.bf.find(x => cname(x) === n || info(x.origK)?.n === n); if (c){ moveCard(c.id, 'gy', {quiet:true}); commit(); return true; } return false; }, n);
const activate = (p, n, re) => TO(p.evaluate(async ([n, re]) => { const c = S.bf.find(x => cname(x) === n); if (!c) return 'missing'; c.sk = false; c.tap = false; S.pool = {...emptyPool(), W:9, U:9, B:9, R:9, G:9, C:9}; const ab = abilityList(c).find(a => new RegExp(re, 'i').test(a.eff)); if (!ab) return 'no ability: ' + abilityList(c).map(a => a.eff).join(' / '); await activateAbility(c, ab); return 'ok'; }, [n, re]));
const want = (p, w, t) => p.evaluate(([w, t]) => { window.__want = w; window.__tgt = t; }, [w, t]);
const oppView = (p, id) => p.evaluate(id => { const [, st] = [...OPP][0]; const c = (st.bf || []).find(x => x.id === id); const a = c && info(c.k); return a ? {n:a.n, t:a.t, p:a.p, o:a.o} : null; }, id);
const mine = (p, n) => p.evaluate(n => { const c = S.bf.find(x => cname(x) === n || info(x.origK)?.n === n); if (!c) return null; const a = info(c.k); return {id:c.id, n:a.n, t:a.t, o:a.o, p:a.p, st:stats(c), cp:c.cp || 0, tap:!!c.tap, k:c.k, origK:info(c.origK)?.n || null, tok:!!c.tok}; }, n);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { await fn(); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2l');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2l');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const after = async () => { await sleep(500); await settle([A, B]); await sleep(1200); await settle([A, B]); await sleep(500); };
  try {
    await step('Clone (cast) enters as a copy of Kim\'s Wall of Omens; Kim sees a Wall of Omens on Georges\'s side', async () => {
      await put(B, 'Wall of Omens'); await put(B, 'Werebear'); await after();
      await want(A, 'Wall of Omens', null); await toHand(A, 'Clone'); check(await cast(A, 'Clone') === 'ok', 'cast Clone'); await after();
      const c = await mine(A, 'Clone'); check(c && c.n === 'Wall of Omens' && c.st.join('/') === '0/4', `Clone is a 0/4 Wall of Omens (${c && c.n} ${c && c.st})`);
      const v = await oppView(B, c.id); check(v && v.n === 'Wall of Omens', `Kim's screen shows Georges's Clone as ${v && v.n}`);
    });
    await step('Spark Double copies Georges\'s legendary Kalitas: +1/+1 counter and not legendary', async () => {
      await put(A, 'Kalitas, Traitor of Ghet'); await want(A, 'Kalitas', null); await toHand(A, 'Spark Double'); check(await cast(A, 'Spark Double') === 'ok', 'cast Spark Double'); await after();
      const c = await mine(A, 'Spark Double'); check(c && c.n === 'Kalitas, Traitor of Ghet' && c.cp === 1 && !/Legendary/.test(c.t), `Spark Double: ${c && c.n}, +1/+1 counters ${c && c.cp}, type "${c && c.t}"`);
      const v = await oppView(B, c.id); check(v && v.n === 'Kalitas, Traitor of Ghet' && !/Legendary/.test(v.t), `Kim sees a nonlegendary Kalitas (${v && v.t})`);
      await toGy(A, 'Kalitas, Traitor of Ghet'); await toGy(A, 'Spark Double'); await after();
      const g = await A.evaluate(() => S.gy.map(cname)); check(g.includes('Spark Double'), 'in the graveyard it is Spark Double again');
    });
    await step('Phantasmal Image put onto the battlefield (not cast) copies Kim\'s Werebear with the Illusion exceptions', async () => {
      await want(A, 'Werebear', null); await put(A, 'Phantasmal Image'); await after();
      const c = await mine(A, 'Phantasmal Image'); check(c && c.n === 'Werebear' && /Illusion/.test(c.t) && /becomes the target of a spell or ability, sacrifice it/i.test(c.o), `Image is ${c && c.n} — ${c && c.t}; text has the sacrifice ability`);
      const v = await oppView(B, c.id); check(v && /Illusion/.test(v.t) && /Werebear/.test(v.n), `Kim sees ${v && v.n} — ${v && v.t}`);
    });
    await step('Copy of a copy: Body-less Clone copying the Phantasmal Image copies its exceptions too (707.3)', async () => {
      await toHand(A, 'Clone'); await want(A, 'Werebear \\(yours', null); check(await cast(A, 'Clone') === 'ok', 'cast Clone again'); await after();
      const c = await mine(A, 'Clone'); check(c && c.n === 'Werebear' && /Illusion/.test(c.t), `Clone is ${c && c.n} — ${c && c.t}`);
      await toGy(A, 'Clone'); await toGy(A, 'Phantasmal Image'); await after();
    });
    await step('Vesuva played as a land enters tapped as a copy of Command Tower', async () => {
      await put(A, 'Command Tower'); await want(A, 'Command Tower', null); await toHand(A, 'Vesuva');
      await A.evaluate(() => { S.landT = ['', 0]; const c = S.hand.find(x => cname(x) === 'Vesuva'); playLand(c); commit(); }); await after();
      const c = await mine(A, 'Vesuva'); check(c && c.n === 'Command Tower' && c.tap, `Vesuva is a tapped ${c && c.n}`);
    });
    await step('Thespian\'s Stage becomes a copy of Kim\'s land but keeps its copy ability', async () => {
      await put(B, 'Gemstone Caverns'); await after(); await put(A, "Thespian's Stage"); await want(A, null, 'Gemstone Caverns');
      check(await activate(A, "Thespian's Stage", 'becomes a copy') === 'ok', 'activated Thespian\'s Stage'); await after();
      const c = await mine(A, "Thespian's Stage"); check(c && c.n === 'Gemstone Caverns' && /becomes a copy of target land, except it has this ability/i.test(c.o), `Stage is ${c && c.n} and still has the copy ability`);
    });
    await step('Mirage Mirror becomes a copy of Werebear until end of turn, then is Mirage Mirror again', async () => {
      await put(B, 'Werebear'); await put(A, 'Mirage Mirror'); await want(A, null, 'Werebear'); await after();
      check(await activate(A, 'Mirage Mirror', 'becomes a copy') === 'ok', 'activated Mirage Mirror'); await after();
      const c = await mine(A, 'Mirage Mirror'); check(c && c.n === 'Werebear' && c.st.join('/') === '1/1', `Mirror is ${c && c.n} ${c && c.st}`);
      await A.evaluate(() => turnChanged()); const d = await mine(A, 'Mirage Mirror'); check(d && d.n === 'Mirage Mirror', `after the turn it is ${d && d.n}`);
    });
    await step('Saw in Half on Kim\'s Wall of Omens: Kim\'s client destroys it and creates two 0/2 copies', async () => {
      await want(A, null, 'Wall of Omens'); await toHand(A, 'Saw in Half'); check(await cast(A, 'Saw in Half') === 'ok', 'cast Saw in Half'); await after(); await sleep(800); await settle([A, B]);
      const r = await B.evaluate(() => S.bf.filter(c => info(c.k)?.n === 'Wall of Omens').map(c => [!!c.tok, stats(c).join('/'), c.n || 1]));
      const n = r.filter(x => x[0]).reduce((a, x) => a + x[2], 0); check(n === 2 && r.filter(x => x[0]).every(x => x[1] === '0/2'), `Kim has ${n} Wall of Omens tokens: ${JSON.stringify(r)}`);
      const v = await A.evaluate(() => { const [, st] = [...OPP][0]; return (st.bf || []).filter(c => c.tok && info(c.k)?.n === 'Wall of Omens').map(c => info(c.k).p); });
      check(v.length >= 1 && v.every(p => p === '0/2'), `Georges sees Kim's tokens as ${JSON.stringify(v)}`);
    });
    await step('Nanogene Conversion: every other creature (Kim\'s too) becomes a copy of Georges\'s Werebear copy until end of turn', async () => {
      await put(A, 'Llanowar Elves'); await want(A, null, 'Llanowar'); await toHand(A, 'Nanogene Conversion'); check(await cast(A, 'Nanogene Conversion') === 'ok', 'cast Nanogene Conversion'); await after(); await sleep(800); await settle([A, B]);
      const r = await B.evaluate(() => S.bf.filter(c => isCreatureCard(c)).map(c => cname(c)));
      check(r.length >= 2 && r.every(n => n === 'Llanowar Elves'), `Kim's creatures: ${r.join(', ')}`);
      await B.evaluate(() => turnChanged()); const r2 = await B.evaluate(() => S.bf.filter(c => isCreatureCard(c)).map(c => cname(c)));
      check(r2.includes('Werebear'), `after the turn Kim has ${r2.join(', ')}`);
    });
    await step('Double Major copies Kalitas: the copy resolves into a nonlegendary token', async () => {
      await A.evaluate(() => { S.pass = ''; });
      await toHand(A, 'Kalitas, Traitor of Ghet'); await toHand(A, 'Double Major');
      await A.evaluate(async () => { const c = S.hand.find(x => cname(x) === 'Kalitas, Traitor of Ghet'); S.pool = {...emptyPool(), W:9, U:9, B:9, R:9, G:9, C:9}; await beginCast(c, 'hand'); });
      await sleep(300); await A.evaluate(() => { window.__tgt = 'Kalitas'; }); const r0 = await cast(A, 'Double Major'); check(r0 === 'ok', 'cast Double Major targeting the Kalitas spell'); await after();
      const r = await A.evaluate(() => S.bf.filter(c => /Kalitas/.test(cname(c))).map(c => [!!c.tok, typeOf(c)]));
      check(r.length === 2 && r.some(x => x[0] && !/Legendary/.test(x[1])) && r.some(x => !x[0] && /Legendary/.test(x[1])), `Kalitas card + nonlegendary token: ${JSON.stringify(r)}`);
      await A.evaluate(() => { S.bf.filter(c => /Kalitas/.test(cname(c))).forEach(c => moveCard(c.id, 'gy', {quiet:true})); commit(); }); await after();
    });
    await step('Mystic Reflection: the next creature to enter (on Kim\'s side) enters as a copy of the chosen creature', async () => {
      await want(A, null, 'Werebear'); await toHand(A, 'Mystic Reflection'); check(await cast(A, 'Mystic Reflection') === 'ok', 'cast Mystic Reflection'); await after(); await sleep(800);
      await put(B, 'Elvish Mystic'); await after();
      const r = await B.evaluate(() => S.bf.filter(c => info(c.origK)?.n === 'Elvish Mystic').map(cname)); check(r.length === 1 && r[0] === 'Werebear', `Kim's Elvish Mystic entered as ${r[0]}`);
      await put(B, 'Fyndhorn Elves'); await after(); const r2 = await B.evaluate(() => S.bf.some(c => cname(c) === 'Fyndhorn Elves')); check(r2, 'only the next creature was affected (Fyndhorn Elves is itself)');
    });
    await step('Superior Spider-Man enters as a copy of a creature card in Kim\'s graveyard, named Superior Spider-Man, 4/4, and exiles that card', async () => {
      await toGy(B, 'Fyndhorn Elves'); await after(); await want(A, 'Fyndhorn', null); await put(A, 'Superior Spider-Man'); await after(); await sleep(800); await settle([A, B]);
      const c = await mine(A, 'Superior Spider-Man'); check(c && c.n === 'Superior Spider-Man' && c.st.join('/') === '4/4' && /Elf/.test(c.t) && /Spider/.test(c.t) && /Add \{G\}/.test(c.o), `Spider-Man: ${c && c.n} ${c && c.st} — ${c && c.t}`);
      const g = await B.evaluate(() => ({gy:S.gy.map(cname), ex:S.ex.map(cname)})); check(!g.gy.includes('Fyndhorn Elves') && g.ex.includes('Fyndhorn Elves'), 'Kim\'s Fyndhorn Elves was exiled');
    });
    await step('Imposter Mech copies Kim\'s creature as a noncreature Vehicle with crew 3', async () => {
      await want(A, 'Werebear', null); await put(A, 'Imposter Mech'); await after();
      const c = await mine(A, 'Imposter Mech'); check(c && c.n === 'Werebear' && /^Artifact — Vehicle$/.test(c.t) && /Crew 3/i.test(c.o), `Mech: ${c && c.n} — ${c && c.t}`);
    });
    await step('Brudiclad: each other token becomes a copy of the chosen token', async () => {
      await A.evaluate(() => { S.bf.filter(c => c.tok).forEach(c => { S.bf.splice(S.bf.indexOf(c), 1); }); createToken(info([...DICT.keys()].find(k => info(k)?.n === 'Werebear')) ? [...DICT.keys()].find(k => info(k)?.n === 'Werebear') : null, 1); commit(); });
      await A.evaluate(() => { const k = [...DICT.keys()].find(k => info(k)?.n === 'Llanowar Elves'); createToken(k, 1); commit(); });
      await want(A, 'Werebear', null);
      await A.evaluate(async () => { const c = {k:[...DICT.keys()].find(k => info(k)?.n === 'Brudiclad, Telchor Engineer'), id:-5}; await runEffects('Choose a token you control. If you do, each other token you control becomes a copy of that token.', {k:c.k, name:'Brudiclad, Telchor Engineer', full:'Then you may choose a token you control. If you do, each other token you control becomes a copy of that token.'}); commit(); });
      await after(); const r = await A.evaluate(() => S.bf.filter(c => c.tok).map(cname)); check(r.length >= 2 && r.every(n => n === 'Werebear'), `tokens: ${r.join(', ')}`);
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
