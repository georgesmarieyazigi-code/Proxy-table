// Round 21 helper S: intervening "if" triggered abilities (CR 603.4) in real 2-player games.
// For each card: (a) condition false when the event happens → nothing triggers, nothing is asked;
// (b) true → the trigger goes on the stack with its targets already chosen, and the other player sees them;
// (c) the condition becomes false before it resolves → it does nothing (one log line, no "do it by hand").
// PTPORT=19900 PTFILE=dev21S.html node r21a.js   (ONLY=<substring> runs matching steps)
process.env.TOP = '1';
const CC = require('./cards');
const WANT = ['Animate Dead', 'Necromancy', 'Dance of the Dead', 'Minthara, Merciless Soul', 'Ishkanah, Grafwidow', 'Gray Merchant of Asphodel', "Moseo, Vein's New Dean", 'Zurzoth, Chaos Rider', 'Oversold Cemetery', 'Emeria, the Sky Ruin', 'Alesha, Who Laughs at Fate', 'Golbez, Crystal Collector', 'Grave Venerations', 'Aerith, Last Ancient', "Raiders' Wake", 'Reaper from the Abyss',
  'Airbender Ascension', "Proft's Eidetic Memory", 'The Ozolith', 'Ironwill Forger', 'Keeper of the Accord', 'Ghirapur Orrery', 'Howling Mine', 'Contaminant Grafter', 'Queen Marchesa', 'Land Tax',
  'Felidar Sovereign', 'Valakut, the Molten Pinnacle', 'Redemption Choir', 'Nullpriest of Oblivion', 'Blowfly Infestation', 'Vampire Socialite', 'Kederekt Parasite', 'Scytheclaw Raptor',
  'Kozilek, the Great Distortion', "Garruk's Uprising", 'Mana Vault', 'Pyrohemia', 'Defense of the Heart', 'Goblin Welder', 'Angel of Serenity', 'Rot Hulk', "Staff of Eden, Vault's Key", 'Triskaidekaphile',
  'Memnite', 'Sol Ring', 'Mind Stone', 'Arcane Signet', "Wayfarer's Bauble", 'Shock', 'Llanowar Elves', 'Elvish Mystic', 'Fyndhorn Elves', 'Ravenous Chupacabra', 'Divination', 'Island', 'Swamp', 'Mountain', 'Forest', 'Plains'];
CC.cards.push(...CC.topCards('all.json').filter(c => (WANT.includes(c.name) || WANT.some(w => c.name.startsWith(w + ' //'))) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, waitFor} = H;
const AUTO = () => { window.__seen = []; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want) : null;
  try {
    window.__seen.push(String(m.title || '')); if (window.__seen.length > 200) window.__seen.shift();
    if (window.__manual) return;
    if (m.type === 'pick' && m.resolve && /^Delve/.test(String(m.title || ''))){ m.__done = 1; m.resolve([]); closeModal(); }
    else if (m.type === 'pick' && m.resolve){ const P = window.__pick ? new RegExp(window.__pick) : null; const pref = P ? (m.cards || []).filter(c => P.test(cname(c))) : [];
      const n = pref.length ? Math.min(pref.length, m.max || 1) : Math.max(m.min || 0, 0); const ids = (pref.length ? pref : (m.cards || [])).slice(0, Math.max(n, m.min || 0)).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (w && (m.options || []).find(x => !x.disabled && w.test(x.label))) || (m.options || []).find(x => !x.disabled); m.__done = 1; m.resolve(o ? o.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ const P = window.__pick ? new RegExp(window.__pick) : null; const pref = P ? (m.cands || []).filter(c => c.ok && P.test(c.nm || '')).slice(0, (m.spec && m.spec.n) || 1) : [];
      const i = (m.cands || []).findIndex(c => c.ok && c.pid !== MYPID); m.__done = 1; m.resolve(pref.length ? pref : i >= 0 ? [m.cands[i]] : []); closeModal(); }
    else if (m.type === 'ask' && m.run){ m.__done = 1; m.run(window.__num != null ? window.__num : (m.def ?? 1)); closeModal(); }
    else if (m.run){ m.__done = 1; m.run(m.def ?? 1); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
let ALL = []; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails();
  // a win now really ends the game (v25): bring every player back before the next card is checked
  for (const [, p] of ALL) await p.evaluate(() => { if (S.lost || S.g23lost || S.j18out){ S.lost = ''; S.g23lost = 0; S.j18out = ''; S.j18left = ''; S.b27lost = 0; if (S.life <= 0) S.life = 40; commit(); } UI.f24over = 0; }).catch(() => {}); if (ALL.length) await sleep(1500);
  try { await T(120000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 || process.env.LOGS) for (const [nm, p] of ALL) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})).catch(e => e.message))); };
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting || UI.modal)); if (!busy) return; await sleep(150); } };
const toMain = async (p, ps) => { for (let i = 0; i < 50; i++){ if (await p.evaluate(() => phaseNow().mine && phaseNow().ph === 3)) return true; await p.evaluate(() => { if (!stackAll().length && !UI.modal && phaseNow().mine) nextAction(); }); await passAll(ps); } return false; };
const find1 = 'const a = [...DICT.values()].find(a => a.n === nm || (a.n || "").startsWith(nm + " //"));';
const putBf = (p, nm, extra) => p.evaluate(([nm, extra]) => { const a = [...DICT.values()].find(a => a.n === nm || (a.n || '').startsWith(nm + ' //')); const c = {id:S.nid++, k:a.k, x:20 + (S.nid % 30) * 3, y:30, sk:false, ...(extra || {})}; S.bf.push(c); commit(); return c.id; }, [nm, extra]);
const toZone = (p, nm, z) => p.evaluate(([nm, z]) => { const a = [...DICT.values()].find(a => a.n === nm || (a.n || '').startsWith(nm + ' //')); const c = {id:S.nid++, k:a.k}; if (z === 'lib') S.lib.unshift(c); else S[z].push(c); commit(); return c.id; }, [nm, z]);
const toHand = (p, nm) => toZone(p, nm, 'hand');
const etb = async (p, nm, extra) => { const id = await toHand(p, nm); await p.evaluate(([id, extra]) => { moveCard(id, 'bf'); const c = S.bf.find(x => x.id === id); if (c && extra) Object.assign(c, extra); commit(); }, [id, extra || null]); return id; };
const clean = async (ps) => { for (const p of ps) await p.evaluate(() => { S.bf = []; S.hand = []; S.gy = []; S.ex = []; S.stk = []; S.pool = emptyPool(); S.life = 40; S.psn = 0; S.mon = 0; S.lt = null; S.r23atk = null; S.r19d = null; S.drawn = 0; S.drawnT = null;
  window.__want = null; window.__pick = null; window.__num = null; window.__manual = 0; window.__seen = []; commit(); }); await sleep(700); };
const seen = (p, re) => p.evaluate(re => window.__seen.filter(t => new RegExp(re, 'i').test(t)), re);
const logs = (p, n = 30) => p.evaluate(n => S.log.slice(-n).map(e => e.s), n);
const mine = (p, nm) => p.evaluate(nm => S.stk.filter(i => i.nm === nm).map(i => ({w:!!i.m19wait, h:!!i.hold, t:i.tgtNm || '', s21:!!i.s21})), nm);
const fireStep = (p, step, who) => p.evaluate(([step, who]) => { fireSteps(step, who === 'me' ? MYPID : who); commit(); }, [step, who]);
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r21a');
    const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r21a');
    ALL = [['Georges', A], ['Kim', B]]; const P2 = [A, B];
    await waitFor(A, () => OPP.size === 1, null, 20000); await A.evaluate(AUTO); await B.evaluate(AUTO);
    await A.click('[data-act="goFirst"]'); await settle(P2); await toMain(A, P2);
    const KIM = await A.evaluate(() => [...OPP.keys()][0]);
    const kimSees = (re, ms = 10000) => waitFor(B, re => stackAll().some(i => new RegExp(re).test(i.nm + ' → ' + (i.tgtNm || ''))), re, ms);
    const ready = (nm, ms = 10000) => waitFor(A, nm => S.stk.some(i => i.nm === nm && !i.m19wait && !i.hold), nm, ms);
    const stats = {cards:new Set(), a:0, b:0, c:0};

    // one card, three checks. cfg: {src (put the source on the battlefield: true), on(true/false), fire(), tgt (regex the stack shows), pick, ev (event fact: no (c)), res (check after resolving true)}
    const iff = async (name, cfg) => {
      await clean(P2); stats.cards.add(name);
      const sid = cfg.src === false ? null : await putBf(A, name, cfg.srcExtra); await sleep(300);
      if (cfg.pre) await cfg.pre(sid);
      // (a) false → no trigger, no question
      if (!cfg.noA){
      await cfg.on(false, sid); await sleep(500);
      await A.evaluate(p => { window.__seen = []; window.__pick = p || null; }, cfg.pick || null); const l0 = (await logs(A, 40)).length;
      await cfg.fire(sid); await sleep(1800);
      const st0 = await mine(A, name); const asked = await seen(A, '.'); const lg = await logs(A, 12);
      check(!st0.length, `${name} (a): condition false → nothing on the stack`);
      check(!asked.length, `${name} (a): nothing was asked${asked.length ? ' (' + asked.join(' / ') + ')' : ''}`);
      check(!lg.some(s => s.startsWith(`trigger: ${name} — `)), `${name} (a): no "trigger" line in the log`);
      if (!st0.length) stats.a++;
      await settle(P2);
      }
      // (b) true → on the stack, targets already chosen
      await cfg.on(true, sid); await sleep(500); await A.evaluate(() => { window.__seen = []; });
      await cfg.fire(sid);
      const ok = await ready(name); check(ok, `${name} (b): condition true → it triggers`);
      if (!ok && process.env.LOGS) console.log('    state:', await A.evaluate(nm => { const c = S.bf.find(x => cname(x) === nm); const t = c && trigsOf(c.k, false)[0]; const sp = t && s21Split(t.eff); return JSON.stringify([S.gy.map(c => cname(c)), sp, c && s21Cond(sp.cond, {k:c.k, name:nm, srcId:c.id, it:{evId:c.id, srcId:c.id, k:c.k}}), (UI.dbg21 || []).slice(-5)]); }, name), await A.evaluate(() => JSON.stringify(S.bf.map(c => [cname(c), stats(c), c.id, info(c.k).p, info(c.k).t, ptOf(info(c.k)), c]))), await A.evaluate(nm => { const c = S.bf.find(x => cname(x) === nm); return c ? JSON.stringify(trigsOf(c.k, false).map(t => [t.ev, t.subj, t.eff.slice(0, 50)])) : 'no src'; }, name));
      if (cfg.tgt){ check(await kimSees(`^${name.replace(/[()]/g, '.')} → .*${cfg.tgt}`), `${name} (b): Kim sees it on the stack targeting ${cfg.tgt} before anyone passes`); const t = await mine(A, name); console.log(`    stack: ${JSON.stringify(t)}`); }
      else check(await kimSees(`^${name.replace(/[()]/g, '.')}`), `${name} (b): Kim sees it on the stack`);
      if (ok) stats.b++;
      if (cfg.res){ const n0 = (await seen(A, '.')).length; await settle(P2); await sleep(1200); const nw = (await seen(A, '.')).slice(n0).filter(t => cfg.tgt && /^[^?]*\bchoose\b[^?]*$/i.test(t)); check(!nw.length, `${name} (b): no target question while it resolved${nw.length ? ' (' + nw.join(' / ') + ')' : ''}`); await cfg.res(sid); }
      // (c) becomes false before it resolves → nothing happens
      if (cfg.ev){ if (!cfg.res) await settle(P2); return; }
      if (cfg.res){ await cfg.on(true, sid); await sleep(300); await cfg.fire(sid); await ready(name); }
      await cfg.on(false, sid); await sleep(800);
      await settle(P2); await sleep(800);
      const lg2 = await logs(A, 20);
      const said = lg2.some(s => s.startsWith(`${name}: “if `) && /no longer true — the ability does nothing/.test(s));
      check(said, `${name} (c): condition false on resolution → "no longer true — the ability does nothing"`);
      check(!lg2.some(s => /by hand|⚠/.test(s)), `${name} (c): no do-by-hand note`);
      check(!(await mine(A, name)).length, `${name} (c): it left the stack`);
      if (cfg.none) await cfg.none(sid);
      if (said) stats.c++;
    };
    const set = (p, fn, arg) => p.evaluate(fn, arg);
    const gyN = (p, n, nm = 'Memnite') => p.evaluate(([n, nm]) => { const a = [...DICT.values()].find(a => a.n === nm); S.gy = S.gy.filter(c => cname(c) !== nm); for (let i = 0; i < n; i++) S.gy.push({id:S.nid++, k:a.k}); commit(); }, [n, nm]);
    const bfN = (p, n, nm) => p.evaluate(([n, nm]) => { const a = [...DICT.values()].find(a => a.n === nm); S.bf = S.bf.filter(c => cname(c) !== nm); for (let i = 0; i < n; i++) S.bf.push({id:S.nid++, k:a.k, x:40 + i * 4, y:60, sk:false}); commit(); }, [n, nm]);

    await step('an opponent lost life this turn (their published state): Vampire Socialite', async () => {
      await iff('Vampire Socialite', {src:false, on:async on => { await B.evaluate(on => { lifeT().l = on ? 3 : 0; commit(); }, on); await sleep(1000); await A.evaluate(() => { S.bf = S.bf.filter(c => !(cname(c) === 'Vampire Socialite' && !S.stk.some(i => i.srcId === c.id))); commit(); }); },
        fire:() => etb(A, 'Vampire Socialite')});
    });
    await step('upkeep / graveyard count: Oversold Cemetery (four or more creature cards in your graveyard; target chosen on the trigger)', async () => {
      await iff('Oversold Cemetery', {pick:'Fyndhorn', tgt:'Fyndhorn Elves',
        on:async on => { await gyN(A, on ? 3 : 2); await A.evaluate(() => { if (!S.gy.some(c => cname(c) === 'Fyndhorn Elves')){ const a = [...DICT.values()].find(a => a.n === 'Fyndhorn Elves'); S.gy.push({id:S.nid++, k:a.k}); commit(); } }); },
        fire:() => fireStep(A, 'upkeep', 'me'),
        res:async () => { check(await A.evaluate(() => S.hand.some(c => cname(c) === 'Fyndhorn Elves')), 'Oversold Cemetery: the chosen Fyndhorn Elves returned to hand'); await A.evaluate(() => { S.hand = []; commit(); }); },
        none:async () => check(await A.evaluate(() => !S.hand.some(c => cname(c) === 'Fyndhorn Elves')), 'Oversold Cemetery (c): nothing returned')});
    });
    await step('you control N or more <type>: Emeria, the Sky Ruin (seven or more Plains)', async () => {
      await iff('Emeria, the Sky Ruin', {pick:'Fyndhorn', tgt:'Fyndhorn Elves', pre:async () => { await gyN(A, 1, 'Fyndhorn Elves'); },
        on:on => bfN(A, on ? 7 : 6, 'Plains'), fire:() => fireStep(A, 'upkeep', 'me'),
        none:async () => check(await A.evaluate(() => !S.bf.some(c => cname(c) === 'Fyndhorn Elves')), 'Emeria (c): nothing returned')});
    });
    await step('raid (you attacked this turn): Alesha, Who Laughs at Fate (end step, target in graveyard)', async () => {
      await iff('Alesha, Who Laughs at Fate', {pick:'Memnite', tgt:'Memnite', pre:() => gyN(A, 1),
        on:(on, sid) => A.evaluate(([on, sid]) => { S.r23atk = on ? {t:turnStr(), ids:[sid]} : null; S.ev = S.ev.filter(e => e.type !== 'attack'); if (on) S.ev.push({type:'attack', k:S.bf.find(c => c.id === sid).k, id:sid, n:++S.evn}); commit(); }, [on, sid]), fire:() => fireStep(A, 'end', 'me'),
        res:async () => { check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Memnite')), 'Alesha: the chosen Memnite returned to the battlefield'); await A.evaluate(() => { S.bf = S.bf.filter(c => cname(c) !== 'Memnite'); commit(); }); await gyN(A, 1); }});
    });
    await step('raid: Raiders\' Wake (target opponent discards)', async () => {
      await iff("Raiders' Wake", {tgt:'Kim', pre:async () => { await toHand(B, 'Divination'); },
        on:(on, sid) => A.evaluate(([on, sid]) => { S.r23atk = on ? {t:turnStr(), ids:[sid]} : null; commit(); }, [on, sid]), fire:() => fireStep(A, 'end', 'me')});
    });
    await step('you control four or more artifacts: Golbez, Crystal Collector', async () => {
      await iff('Golbez, Crystal Collector', {pick:'Memnite', tgt:'Memnite', pre:() => gyN(A, 1),
        on:on => bfN(A, on ? 4 : 3, 'Sol Ring'), fire:() => fireStep(A, 'end', 'me')});
    });
    await step('monarch: Grave Venerations (you\'re the monarch)', async () => {
      await iff('Grave Venerations', {pick:'Memnite', tgt:'Memnite', pre:() => gyN(A, 1),
        on:on => A.evaluate(on => { if (on) becomeMonarch('test'); else S.mon = 0; commit(); }, on), fire:() => fireStep(A, 'end', 'me')});
    });
    await step('monarch: Queen Marchesa (an opponent is the monarch)', async () => {
      await iff('Queen Marchesa', {
        on:async on => { await B.evaluate(on => { if (on) becomeMonarch('test'); else S.mon = 0; commit(); }, on); await sleep(900); }, fire:() => fireStep(A, 'upkeep', 'me')});
    });
    await step('you gained life this turn: Aerith, Last Ancient (target chosen on the trigger)', async () => {
      await iff('Aerith, Last Ancient', {pick:'Memnite', tgt:'Memnite', pre:() => gyN(A, 1),
        on:on => A.evaluate(on => { lifeT().g = on ? 2 : 0; commit(); }, on), fire:() => fireStep(A, 'end', 'me')});
    });
    await step('X from the life gained: Moseo, Vein\'s New Dean (only cards with mana value ≤ the life gained can be chosen)', async () => {
      await iff("Moseo, Vein's New Dean", {pick:'Ravenous|Memnite', tgt:'Memnite', pre:async () => { await gyN(A, 1, 'Ravenous Chupacabra'); await gyN(A, 1, 'Memnite'); },
        on:on => A.evaluate(on => { lifeT().g = on ? 2 : 0; commit(); }, on), fire:() => fireStep(A, 'end', 'me')});
      check(!(await A.evaluate(() => S.stk.some(i => /Chupacabra/.test(i.tgtNm || '')))), 'Moseo: the Chupacabra (mana value 4 > 2 life gained) could not be chosen');
    });
    await step('a quoted ability\'s "any target" is not a target: Zurzoth, Chaos Rider (Kim draws on Georges\' turn)', async () => {
      await iff('Zurzoth, Chaos Rider', {ev:true, noA:true, on:async () => {}, fire:async () => { await B.evaluate(() => { S.jfirstDraw = null; draw(1); commit(); }); await sleep(800); }});
      const asked = await seen(A, 'target'); check(!asked.length, `Zurzoth: no target was asked for (${asked.join(' / ')})`);
    });
    await step('a creature died this turn: Reaper from the Abyss (destroy target non-Demon creature)', async () => {
      await iff('Reaper from the Abyss', {tgt:'Ravenous Chupacabra', pre:async () => { await putBf(B, 'Ravenous Chupacabra'); await sleep(800); },
        on:on => A.evaluate(on => { S.r19d = on ? {t:turnStr(), n:1} : null; commit(); }, on), fire:() => fireStep(A, 'end', 'me'),
        res:async () => { await sleep(800); check(await B.evaluate(() => !S.bf.some(c => cname(c) === 'Ravenous Chupacabra')), 'Reaper: the chosen Chupacabra was destroyed'); await putBf(B, 'Ravenous Chupacabra'); await sleep(800); },
        none:async () => check(await B.evaluate(() => S.bf.some(c => cname(c) === 'Ravenous Chupacabra')), 'Reaper (c): the Chupacabra survives')});
    });
    await step('counters on ~: Airbender Ascension (four or more quest counters)', async () => {
      await iff('Airbender Ascension', {pick:'Memnite', tgt:'Memnite', pre:() => putBf(A, 'Memnite'),
        on:(on, sid) => A.evaluate(([on, sid]) => { const c = S.bf.find(x => x.id === sid); c.nc = {...(c.nc || {}), quest:on ? 4 : 3}; commit(); }, [on, sid]), fire:() => fireStep(A, 'end', 'me')});
    });
    await step('cards drawn this turn: Proft\'s Eidetic Memory (beginning of combat)', async () => {
      await iff("Proft's Eidetic Memory", {pick:'Memnite', tgt:'Memnite', pre:() => putBf(A, 'Memnite'),
        on:on => A.evaluate(on => { S.drawnT = turnStr(); S.drawn = on ? 3 : 1; commit(); }, on), fire:() => fireStep(A, 'combat', 'me')});
    });
    await step('~ has counters on it: The Ozolith (move them onto target creature)', async () => {
      await iff('The Ozolith', {pick:'Memnite', tgt:'Memnite', pre:() => putBf(A, 'Memnite'),
        on:(on, sid) => A.evaluate(([on, sid]) => { const c = S.bf.find(x => x.id === sid); c.cp = on ? 2 : 0; commit(); }, [on, sid]), fire:() => fireStep(A, 'combat', 'me')});
    });
    await step('you control your commander: Ironwill Forger (target nonlegendary creature you control)', async () => {
      let cid = null;
      await iff('Ironwill Forger', {pick:'Memnite', tgt:'Memnite', pre:async () => { await putBf(A, 'Memnite'); cid = await putBf(A, 'Llanowar Elves'); },
        on:on => A.evaluate(([on, id]) => { const c = S.bf.find(x => x.id === id); c.cmd = on; commit(); }, [on, cid]), fire:() => fireStep(A, 'combat', 'me')});
    });
    await step('that player (opponent\'s end step) controls more creatures than you: Keeper of the Accord', async () => {
      await iff('Keeper of the Accord', {on:async on => { await bfN(B, on ? 2 : 0, 'Memnite'); await sleep(900); }, fire:() => fireStep(A, 'end', KIM)});
    });
    await step('that player has no cards in hand (opponent\'s upkeep): Ghirapur Orrery', async () => {
      await iff('Ghirapur Orrery', {on:async on => { await B.evaluate(on => { S.hand = on ? [] : [{id:S.nid++, k:[...DICT.values()].find(a => a.n === 'Island').k}]; commit(); }, on); await sleep(900); }, fire:() => fireStep(A, 'upkeep', KIM)});
    });
    await step('~ is untapped: Howling Mine (each player\'s draw step)', async () => {
      await iff('Howling Mine', {on:(on, sid) => A.evaluate(([on, sid]) => { S.bf.find(x => x.id === sid).tap = !on; commit(); }, [on, sid]), fire:() => fireStep(A, 'draw', 'me')});
    });
    await step('~ is tapped: Mana Vault (your draw step)', async () => {
      await iff('Mana Vault', {on:(on, sid) => A.evaluate(([on, sid]) => { S.bf.find(x => x.id === sid).tap = on; commit(); }, [on, sid]), fire:() => fireStep(A, 'draw', 'me')});
    });
    await step('poison: Contaminant Grafter (an opponent has three or more poison counters)', async () => {
      await iff('Contaminant Grafter', {on:async on => { await B.evaluate(on => { S.psn = on ? 3 : 2; commit(); }, on); await sleep(900); }, fire:() => fireStep(A, 'end', 'me')});
    });
    await step('an opponent controls more lands: Land Tax', async () => {
      await iff('Land Tax', {on:async on => { await bfN(B, on ? 2 : 0, 'Island'); await sleep(900); }, fire:() => fireStep(A, 'upkeep', 'me')});
    });
    await step('an opponent controls three or more creatures: Defense of the Heart', async () => {
      await iff('Defense of the Heart', {on:async on => { await bfN(B, on ? 3 : 2, 'Memnite'); await sleep(900); }, fire:() => fireStep(A, 'upkeep', 'me')});
    });
    await step('life total: Felidar Sovereign (40 or more life; never resolved while true)', async () => {
      await iff('Felidar Sovereign', {on:on => A.evaluate(on => { S.life = on ? 40 : 39; commit(); }, on), fire:() => fireStep(A, 'upkeep', 'me')});
    });
    await step('cards in hand: Triskaidekaphile (exactly thirteen cards)', async () => {
      await iff('Triskaidekaphile', {on:on => A.evaluate(on => { const k = [...DICT.values()].find(a => a.n === 'Island').k; S.hand = Array.from({length:on ? 13 : 12}, () => ({id:S.nid++, k})); commit(); }, on), fire:() => fireStep(A, 'upkeep', 'me')});
    });
    await step('no creatures on the battlefield: Pyrohemia (each end step)', async () => {
      await iff('Pyrohemia', {on:on => bfN(A, on ? 0 : 1, 'Memnite'), fire:() => fireStep(A, 'end', 'me')});
    });
    await step('landfall with "five other Mountains": Valakut, the Molten Pinnacle (any target)', async () => {
      await iff('Valakut, the Molten Pinnacle', {tgt:'Kim',
        on:on => bfN(A, on ? 5 : 4, 'Mountain'), fire:() => etb(A, 'Mountain')});
    });
    await step('coven (three different powers): Redemption Choir enters (target permanent card in graveyard)', async () => {
      await iff('Redemption Choir', {src:false, pick:'Sol Ring', tgt:'Sol Ring', pre:async () => { await gyN(A, 1, 'Sol Ring'); await putBf(A, 'Llanowar Elves'); },
        on:on => A.evaluate(on => { const a = [...DICT.values()].find(a => a.n === 'Ravenous Chupacabra'); S.bf = S.bf.filter(c => cname(c) !== 'Ravenous Chupacabra' && !(cname(c) === 'Redemption Choir' && !S.stk.some(i => i.srcId === c.id))); if (on) S.bf.push({id:S.nid++, k:a.k, x:50, y:60}); commit(); }, on),
        fire:() => etb(A, 'Redemption Choir'),
        res:async () => check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Sol Ring')), 'Redemption Choir: Sol Ring returned to the battlefield')});
    });
    await step('it was kicked (event fact): Nullpriest of Oblivion', async () => {
      await iff('Nullpriest of Oblivion', {src:false, ev:true, pick:'Ravenous', tgt:'Ravenous Chupacabra', pre:() => gyN(A, 1, 'Ravenous Chupacabra'),
        on:async on => { await A.evaluate(on => { window.__kick = on ? 1 : 0; }, on); }, fire:() => A.evaluate(async () => { const a = [...DICT.values()].find(a => a.n === 'Nullpriest of Oblivion'); const c = {id:S.nid++, k:a.k, kicked:window.__kick}; S.hand.push(c); moveCard(c.id, 'bf'); const b = S.bf.find(x => x.id === c.id); if (b) b.kicked = window.__kick; commit(); }),
        res:async () => { await sleep(1500); check(await A.evaluate(() => S.bf.filter(c => cname(c) === 'Ravenous Chupacabra').length >= 1), 'Nullpriest: the chosen Chupacabra came back'); }});
    });
    await step('it had a -1/-1 counter on it (event fact): Blowfly Infestation', async () => {
      let gid = null;
      await iff('Blowfly Infestation', {ev:true, tgt:'Memnite', pre:async () => { await putBf(B, 'Memnite'); await sleep(800); },
        on:async on => { gid = await putBf(A, 'Llanowar Elves', {cm:on ? 1 : 0}); }, fire:() => A.evaluate(id => { moveCard(id, 'gy'); commit(); }, gid)});
    });
    await step('an opponent draws, if you control a red permanent: Kederekt Parasite', async () => {
      await iff('Kederekt Parasite', {on:on => bfN(A, on ? 1 : 0, 'Goblin Welder'), fire:async () => { await B.evaluate(() => { draw(1); commit(); }); await sleep(800); }});
    });
    await step('it\'s not their turn (a spell cast by Kim on Georges\' turn): Scytheclaw Raptor', async () => {
      await iff('Scytheclaw Raptor', {ev:true,
        on:async on => { await A.evaluate(on => { window.__who = on ? 'kim' : 'me'; }, on); },
        fire:async () => { const who = await A.evaluate(() => window.__who); if (who === 'me'){ await toHand(A, 'Divination'); await A.evaluate(() => { S.pool = {...emptyPool(), U:3}; beginCast(S.hand.find(c => cname(c) === 'Divination'), 'hand'); }); }
          else { await toHand(B, 'Shock'); await B.evaluate(() => { S.pool = {...emptyPool(), R:1}; beginCast(S.hand.find(c => cname(c) === 'Shock'), 'hand'); }); } await sleep(1500); }});
    });
    await step('cast trigger: Kozilek, the Great Distortion (fewer than seven cards in hand)', async () => {
      await iff('Kozilek, the Great Distortion', {src:false,
        on:on => A.evaluate(on => { const k = [...DICT.values()].find(a => a.n === 'Island').k; S.hand = S.hand.filter(c => /Kozilek/.test(cname(c))); for (let i = 0; i < (on ? 2 : 7); i++) S.hand.push({id:S.nid++, k}); commit(); }, on),
        fire:async () => { await toHand(A, 'Kozilek, the Great Distortion'); await A.evaluate(async () => { window.__want = 'Cast|Pay|normal|Yes|Return'; S.pool = {...emptyPool(), C:10}; await beginCast(S.hand.find(c => /Kozilek/.test(cname(c))), 'hand'); }); await sleep(1500); }});
    });
    await step('you control a creature with power 4 or greater: Garruk\'s Uprising enters', async () => {
      await iff("Garruk's Uprising", {src:false, on:on => A.evaluate(on => { S.bf = S.bf.filter(c => !(cname(c) === "Garruk's Uprising" && !S.stk.some(i => i.srcId === c.id))); commit(); return on; }, on).then(on => bfN(A, on ? 1 : 0, 'Ravenous Chupacabra').then(() => on ? putBf(A, 'Contaminant Grafter') : A.evaluate(() => { S.bf = S.bf.filter(c => cname(c) !== 'Contaminant Grafter'); commit(); }))),
        fire:() => etb(A, "Garruk's Uprising")});
    });

    await step('delirium (four card types in your graveyard): Ishkanah, Grafwidow enters', async () => {
      await iff('Ishkanah, Grafwidow', {src:false,
        on:async on => { await A.evaluate(() => { S.bf = S.bf.filter(c => !(cname(c) === 'Ishkanah, Grafwidow' && !S.stk.some(i => i.srcId === c.id))); S.gy = []; commit(); }); for (const n of (on ? ['Memnite', 'Divination', 'Island', 'Grizzly Bears'] : ['Memnite', 'Island', 'Grizzly Bears'])) await gyN(A, 1, n); },
        fire:() => etb(A, 'Ishkanah, Grafwidow')});
    });
    await step('revolt-like (a permanent you controlled left the battlefield this turn): Minthara, Merciless Soul', async () => {
      await iff('Minthara, Merciless Soul', {on:on => A.evaluate(on => { S.r23IleftMine = on ? turnStr() : null; commit(); }, on), fire:() => fireStep(A, 'end', 'me')});
    });
    await step('r20a SWEEP_SKIP cards with a targeted trigger: targets are chosen as it goes on the stack', async () => {
      // Redemption Choir is the only one of the eight with an intervening "if" (tested above); Back in Town (a spell with X), Chandra (loyalty),
      // Terra and Alesha, Who Smiles at Death ("you may pay … when you do / if you do") have no triggered ability whose targets are chosen on the trigger.
      // Staff of Eden's target (a legendary permanent card in any graveyard) is still chosen on resolution — not an intervening "if"; left to the targeting owner.
      for (const [nm, setup, re] of [['Angel of Serenity', async () => { await putBf(B, 'Memnite'); }, "Kim's Memnite"], ['Rot Hulk', async () => { await gyN(A, 1, 'Gray Merchant of Asphodel'); }, 'Gray Merchant']]){
        await clean(P2); await setup(); await sleep(900); await A.evaluate(re => { window.__pick = re; window.__seen = []; }, re.replace(/^Kim's /, ''));
        await etb(A, nm); check(await kimSees(`^${nm} → .*${re}`, 15000), `${nm}: Kim sees it on the stack targeting ${re} before anyone passes`);
        const n0 = (await seen(A, '.')).length; await settle(P2); await sleep(1200); const nw = (await seen(A, '.')).slice(n0).filter(t => /^[^?]*\bchoose\b[^?]*$/i.test(t)); check(!nw.length, `${nm}: no target question while it resolved${nw.length ? ' (' + nw.join(' / ') + ')' : ''}`);
      }
    });
    await step('"if it\'s on the battlefield" (Animate Dead, Dance of the Dead, Necromancy): the creature comes back attached; gone before it resolves → nothing', async () => {
      for (const [nm, pool] of [['Animate Dead', {B:2}], ['Dance of the Dead', {B:2}], ['Necromancy', {B:4}]]){
        await clean(P2); await toZone(B, 'Ravenous Chupacabra', 'gy'); await sleep(900);
        await A.evaluate(() => { window.__pick = 'Ravenous'; window.__want = 'Ravenous|Yes|Cast'; window.__seen = []; });
        await toHand(A, nm); await A.evaluate(([nm, pool]) => { S.pool = {...emptyPool(), ...pool}; beginCast(S.hand.find(c => cname(c) === nm), 'hand'); }, [nm, pool]);
        await sleep(1500); await settle(P2); await sleep(1500); await settle(P2);
        const st = await A.evaluate(nm => { const c = S.bf.find(x => cname(x) === 'Ravenous Chupacabra'); const au = S.bf.find(x => cname(x) === nm); return {c:!!c, att:!!(c && au && au.att && au.att.id === c.id), hand:S.log.slice(-10).some(e => /by hand/.test(e.s))}; }, nm);
        check(st.c && st.att && !st.hand, `${nm}: Kim's Ravenous Chupacabra is on Georges's battlefield with ${nm} attached, nothing by hand ${JSON.stringify(st)}`);
      }
      // the Aura leaves before its trigger resolves → "if it's on the battlefield" is false → nothing returns
      await clean(P2); await toZone(B, 'Ravenous Chupacabra', 'gy'); await sleep(900);
      await A.evaluate(() => { window.__pick = 'Ravenous'; window.__want = 'Ravenous|Yes|Cast'; });
      await toHand(A, 'Animate Dead'); await A.evaluate(() => { S.pool = {...emptyPool(), B:2}; beginCast(S.hand.find(c => cname(c) === 'Animate Dead'), 'hand'); });
      await sleep(1200); for (let i = 0; i < 30 && !(await A.evaluate(() => S.stk.some(i => i.kind === 'trigger' && i.nm === 'Animate Dead'))); i++){ await A.evaluate(() => { if (myBox() && !S.stk.some(i => i.kind === 'trigger')) doPass(); }); await B.evaluate(() => { if (myBox()) doPass(); }); await sleep(250); }
      check(await A.evaluate(() => S.stk.some(i => i.kind === 'trigger' && i.nm === 'Animate Dead')), 'Animate Dead: its enters trigger is on the stack');
      await A.evaluate(() => { const au = S.bf.find(x => cname(x) === 'Animate Dead'); if (au) moveCard(au.id, 'gy'); commit(); }); await sleep(800);
      await settle(P2); await sleep(1200);
      const lg = await logs(A, 15);
      check(lg.some(s => /^Animate Dead: “if it's on the battlefield” is no longer true/.test(s)), 'Animate Dead left first: the trigger does nothing');
      check(!(await A.evaluate(() => S.bf.some(c => cname(c) === 'Ravenous Chupacabra'))) && !lg.some(s => /by hand/.test(s)), 'nothing returned, nothing by hand');
    });
    // the deck checker
    await step('deck checker: a condition the evaluator doesn\'t know is a gap, a known one is not', async () => {
      const r = await A.evaluate(async () => { const mk = (id, name, o) => addInfo(infoFrom({object:'card', id, name, mana_cost:'{1}', cmc:1, type_line:'Artifact', oracle_text:o, layout:'normal', keywords:[], colors:[], color_identity:[], image_uris:{normal:''}})); const a = mk('t21-moon', 'Test Moon Watcher', 'At the beginning of your upkeep, if the moon is blue, draw a card.'); const b = mk('t21-life', 'Test Life Watcher', 'At the beginning of your upkeep, if you have 30 or more life, draw a card.');
        const r1 = await checkCard(a.k); const r2 = await checkCard(b.k); return [r1.issues.map(x => x.text), r2.issues.map(x => x.text)]; });
      check(r[0].some(t => /isn't evaluated/.test(t)), `unknown condition reported (${JSON.stringify(r[0])})`);
      check(!r[1].some(t => /isn't evaluated/.test(t)), `a known condition isn't reported as unevaluated (${JSON.stringify(r[1])})`);
    });
    console.log(`\n  cards: ${stats.cards.size} — (a) no trigger: ${stats.a}, (b) on the stack: ${stats.b}, (c) did nothing on resolution: ${stats.c}`);
  } catch (e){ console.log('FATAL', e.message); check(false, 'test ran'); }
  console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`);
  await browser.close(); server.close(); process.exit(H.fails() ? 1 : 0);
})();
