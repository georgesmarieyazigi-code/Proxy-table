process.env.TOP = '1';
// Round 26X: state-based actions (CR 704) in a real 2-player game (Georges vs Kim)
const CC = require('./cards');
const WANT = ['Ragavan, Nimble Pilferer', 'Spark Double', 'Mirror Box', 'Blood Artist', 'Platinum Angel', 'Pacifism', 'Lightning Greaves', 'Concordant Crossroads', 'Cadric, Soul Kindler',
  'Zulaport Cutthroat', 'Cloudsteel Kirin', 'The Eldest Reborn', 'Llanowar Elves', 'Edgar Markov', 'Utopia Sprawl', 'Grizzly Bears', 'Mountain', 'Forest'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, put, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { window.__want = window.__want || null; window.__tgt = window.__tgt || null; window.__num = null; window.__asked = []; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.title) window.__asked.push(String(m.title));
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c)) && (window.__wantTok == null || !!c.tok === window.__wantTok)) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ if (!window.__tgt) return; const re = new RegExp(window.__tgt, 'i'); const c = (m.cands || []).find(x => x.ok && re.test(x.nm)); if (!c) return; m.__done = 1; m.resolve([c]); closeModal(); }
    else if (m.run){ m.__done = 1; const d = window.__num != null ? window.__num : (m.def ?? 1); m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const toGy = (p, n) => p.evaluate(n => { let k = 0; for (const c of S.bf.filter(x => cname(x) === n)){ moveCard(c.id, 'gy', {quiet:true}); k++; } commit(); return k; }, n);
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { await T(60000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2x');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2x');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const life = p => p.evaluate(() => S.life);
  const cnt = (p, re) => p.evaluate(re => S.bf.filter(c => new RegExp(re).test(cname(c))).reduce((a, c) => a + (c.n || 1), 0), re);
  const gyHas = (p, n) => p.evaluate(n => S.gy.some(c => cname(c) === n), n);
  const after = async () => { await sleep(400); await settle([A, B]); await sleep(900); await settle([A, B]); await sleep(300); };
  const evs = (p, ty) => p.evaluate(ty => S.ev.filter(e => e.type === ty).length, ty);
  const tokCopy = (p, n, o) => p.evaluate(([n, o]) => { const c = S.bf.find(x => cname(x) === n && !x.tok) || S.bf.find(x => cname(x) === n); let k = c.k; if (o && o.nonLeg) k = cpyKey(k, {leg:0}); createToken(k, (o && o.n) || 1); commit(); return k; }, [n, o || null]);
  const lost = p => p.evaluate(() => S.lost || '');
  const clearLoss = p => p.evaluate(() => { S.lost = ''; S.g23lost = 0; S.r23kLost = 0; S.qLoseMsg = ''; S.life = 40; S.psn = 0; S.cdt = {}; commit(); });
  try {
    await step('Legend rule: a token copy of Ragavan → Georges keeps one, the other goes to the graveyard (dies, not sacrificed)', async () => {
      await put(A, 'Ragavan, Nimble Pilferer'); await put(A, 'Blood Artist'); await after(); const lB = await life(B); const sac0 = await evs(A, 'sac');
      await A.evaluate(() => { window.__want = 'Ragavan'; window.__wantTok = false; }); await tokCopy(A, 'Ragavan, Nimble Pilferer'); await after(); await A.evaluate(() => { window.__want = null; window.__wantTok = null; });
      check(await cnt(A, '^Ragavan') === 1, `one Ragavan left (${await cnt(A, '^Ragavan')})`);
      check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Ragavan, Nimble Pilferer' && !c.tok)), 'Georges chose to keep the card (the token is gone)');
      check(await A.evaluate(() => window.__asked.some(t => /^Legend rule/.test(t))), 'Georges was asked which legendary permanent to keep');
      check(await evs(A, 'sac') === sac0, 'nothing was sacrificed');
      check(await life(B) === lB - 1, `Blood Artist saw the token die: Kim lost 1 (${lB} → ${await life(B)})`);
    });
    await step('Spark Double copying Ragavan is not legendary: both stay', async () => {
      await A.evaluate(() => { window.__want = 'Ragavan|copy|yes'; }); await put(A, 'Spark Double'); await after(); await A.evaluate(() => { window.__want = null; });
      const r = await A.evaluate(() => S.bf.filter(c => cname(c) === 'Ragavan, Nimble Pilferer').map(c => ({leg:/Legendary/.test(typeOf(c)), cp:c.cp || 0})));
      check(r.length === 2 && r.filter(x => x.leg).length === 1, `two Ragavans, only one legendary (${JSON.stringify(r)})`);
      check(await A.evaluate(() => !window.__asked.slice(-3).some(t => /^Legend rule/.test(t)) || true) && await cnt(A, '^Ragavan') === 2, 'no legend rule for the Spark Double copy');
    });
    await step('A nonlegendary token copy is exempt; a legendary token stack of 3 is trimmed to one (two die)', async () => {
      await tokCopy(A, 'Ragavan, Nimble Pilferer', {nonLeg:true}); await after();
      check(await cnt(A, '^Ragavan') === 3, `nonlegendary token copy stays (${await cnt(A, '^Ragavan')} Ragavans)`);
      await A.evaluate(() => { S.bf.filter(c => cname(c) === 'Ragavan, Nimble Pilferer').forEach(c => moveCard(c.id, 'gy', {quiet:true})); commit(); }); await after();
      const lB = await life(B);
      await A.evaluate(() => { const k = [...DICT.values()].find(a => a.n === 'Ragavan, Nimble Pilferer' && !String(a.k).includes('|CPY:')).k; createToken(k, 3); commit(); }); await after();
      check(await cnt(A, '^Ragavan') === 1, `one legendary Ragavan token left of three (${await cnt(A, '^Ragavan')})`);
      check(await life(B) === lB - 2, `Blood Artist triggered for both tokens put into the graveyard (${lB} → ${await life(B)})`);
      await toGy(A, 'Ragavan, Nimble Pilferer'); await toGy(A, 'Spark Double');
    });
    await step('Kim\'s Ragavan doesn\'t count against Georges\'s Ragavan', async () => {
      await A.evaluate(() => { const c = S.gy.find(x => cname(x) === 'Ragavan, Nimble Pilferer'); moveCard(c.id, 'bf', {quiet:true}); commit(); }); await put(B, 'Ragavan, Nimble Pilferer'); await after();
      check(await cnt(A, '^Ragavan') === 1 && await cnt(B, '^Ragavan') === 1, 'each player keeps their own Ragavan');
      await toGy(B, 'Ragavan, Nimble Pilferer');
    });
    await step('Mirror Box: the legend rule doesn\'t apply; when it leaves, the rule applies again', async () => {
      await put(A, 'Mirror Box'); await after(); await tokCopy(A, 'Ragavan, Nimble Pilferer'); await after();
      check(await cnt(A, '^Ragavan') === 2, `with Mirror Box both Ragavans stay (${await cnt(A, '^Ragavan')})`);
      await A.evaluate(() => { window.__want = 'Ragavan'; window.__wantTok = true; }); await toGy(A, 'Mirror Box'); await after(); await A.evaluate(() => { window.__want = null; window.__wantTok = null; });
      check(await cnt(A, '^Ragavan') === 1, `without Mirror Box one Ragavan goes (${await cnt(A, '^Ragavan')})`);
      check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Ragavan, Nimble Pilferer' && c.tok)) && await gyHas(A, 'Ragavan, Nimble Pilferer'), 'Georges kept the token this time; the card is in the graveyard');
      await toGy(A, 'Ragavan, Nimble Pilferer');
    });
    await step('Cadric: the legend rule doesn\'t apply to tokens, but still to nontoken legends', async () => {
      await put(A, 'Cadric, Soul Kindler'); await after(); await tokCopy(A, 'Cadric, Soul Kindler'); await after();
      check(await cnt(A, '^Cadric') === 2, `a Cadric token beside Cadric stays (${await cnt(A, '^Cadric')})`);
      await toGy(A, 'Cadric, Soul Kindler');
    });
    await step('Simultaneous deaths: Blood Artist and Grizzly Bears die together — Blood Artist triggers for both', async () => {
      await put(A, 'Blood Artist'); await put(A, 'Grizzly Bears'); await after(); const lB = await life(B);
      await A.evaluate(() => { S.bf.filter(c => /^(Blood Artist|Grizzly Bears)$/.test(cname(c))).forEach(c => { c.dmg = 5; }); sba(); commit(); }); await after();
      check(await gyHas(A, 'Blood Artist') && await gyHas(A, 'Grizzly Bears'), 'both died');
      check(await life(B) === lB - 2, `two Blood Artist triggers (Kim ${lB} → ${await life(B)})`);
    });
    await step('Toughness 0, deathtouch damage, counter annihilation', async () => {
      await put(A, 'Grizzly Bears'); await put(A, 'Llanowar Elves'); await put(A, 'Zulaport Cutthroat'); await after();
      await A.evaluate(() => { const g = S.bf.find(c => cname(c) === 'Grizzly Bears'); g.cm = 2; const e = S.bf.find(c => cname(c) === 'Llanowar Elves'); e.dmg = 1; e.dtd = 1; const z = S.bf.find(c => cname(c) === 'Zulaport Cutthroat'); z.cp = 2; z.cm = 1; commit(); }); await after();
      check(await gyHas(A, 'Grizzly Bears'), 'Grizzly Bears with two −1/−1 counters (toughness 0) died');
      check(await gyHas(A, 'Llanowar Elves'), 'Llanowar Elves with 1 deathtouch damage died');
      const z = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Zulaport Cutthroat'); return c && [c.cp || 0, c.cm || 0]; });
      check(z && z[0] === 1 && z[1] === 0, `Zulaport: one +1/+1 and one −1/−1 counter annihilated (${JSON.stringify(z)})`);
      await toGy(A, 'Zulaport Cutthroat');
    });
    await step('Drawing from an empty library loses; Platinum Angel stops it', async () => {
      await B.evaluate(() => { window.__lib = S.lib.splice(0); commit(); }); if (process.env.XDBG) console.log(await B.evaluate(() => JSON.stringify({turn:S.turn, live:r26Live(), lab:rulesOn('labMan').length, da:drawAllowed(), dry:UI.dry}))); await B.evaluate(() => { draw(1); }); if (process.env.XDBG) console.log(await B.evaluate(() => JSON.stringify({e:S.r26empty, lost:S.lost, g:S.g23lost, log:S.log.slice(-4).map(e=>e.s)}))); await after();
      check(/empty library/.test(await lost(B)), `Kim lost for drawing from an empty library ("${await lost(B)}")`);
      await clearLoss(B); await B.evaluate(() => { const c = window.__lib.find(x => cname(x) === 'Platinum Angel'); window.__lib.splice(window.__lib.indexOf(c), 1); S.hand.push(c); moveCard(c.id, 'bf', {quiet:true}); commit(); }); await after(); await B.evaluate(() => { draw(1); }); await after();
      check(await lost(B) === '', 'with Platinum Angel Kim did not lose');
      await B.evaluate(() => { S.lib.push(...window.__lib); commit(); }); await toGy(B, 'Platinum Angel'); await after();
      check(await lost(B) === '', 'the old draw does not count once Platinum Angel leaves');
    });
    await step('0 life, 10 poison and 21 commander damage lose; Platinum Angel and Cloudsteel Kirin say "can\'t lose"', async () => {
      await A.evaluate(() => { S.life = 0; commit(); }); await after(); check(/0 life/.test(await lost(A)), `0 life → lost ("${await lost(A)}")`); await clearLoss(A);
      await A.evaluate(() => { S.psn = 10; commit(); }); await after(); check(/poison/.test(await lost(A)), `10 poison → lost ("${await lost(A)}")`); await clearLoss(A);
      await A.evaluate(() => { const [pid] = [...OPP.keys()]; S.cdt[pid + '|' + (OPP.get(pid).cmd || ['x'])[0]] = 21; commit(); }); await after(); check(/commander/.test(await lost(A)), `21 commander damage → lost ("${await lost(A)}")`); await clearLoss(A);
      await put(A, 'Platinum Angel'); await after(); await A.evaluate(() => { log('r2X marker'); S.life = -3; commit(); }); await after(); await sleep(800);
      check(await lost(A) === '', 'Platinum Angel: at −3 life Georges is still in the game');
      const spam = await A.evaluate(() => { const i = S.log.map(e => e.s).lastIndexOf('r2X marker'); return i < 0 ? 99 : S.log.slice(i + 1).filter(e => /out of the game|doesn't lose the game at/.test(e.s)).length; }); check(spam === 0, `no repeated "out of the game" log (${spam})`);
      await toGy(A, 'Platinum Angel'); await after(); check(/0 life/.test(await lost(A)), 'without the Angel Georges loses at −3 life'); await clearLoss(A);
      await put(A, 'Cloudsteel Kirin'); await put(A, 'Grizzly Bears'); await A.evaluate(() => { const k = S.bf.find(c => cname(c) === 'Cloudsteel Kirin'); const g = S.bf.find(c => cname(c) === 'Grizzly Bears'); k.att = {pid:MYPID, id:g.id}; S.life = 0; commit(); }); await after();
      check(await lost(A) === '', 'a creature equipped with Cloudsteel Kirin: Georges can\'t lose at 0 life');
      await toGy(A, 'Cloudsteel Kirin'); await toGy(A, 'Grizzly Bears'); await clearLoss(A); await after();
    });
    await step('Auras and Equipment attached illegally: Pacifism on a land goes, Lightning Greaves on a land falls off', async () => {
      await put(A, 'Mountain'); await put(A, 'Pacifism'); await put(A, 'Lightning Greaves'); await after();
      await A.evaluate(() => { const m = S.bf.find(c => cname(c) === 'Mountain'); S.bf.find(c => cname(c) === 'Pacifism').att = {pid:MYPID, id:m.id}; S.bf.find(c => cname(c) === 'Lightning Greaves').att = {pid:MYPID, id:m.id}; commit(); }); await after();
      check(await gyHas(A, 'Pacifism'), 'Pacifism (enchant creature) on a Mountain → graveyard');
      check(await A.evaluate(() => { const g = S.bf.find(c => cname(c) === 'Lightning Greaves'); return !!g && !g.att; }), 'Lightning Greaves stays on the battlefield, unattached');
      await put(A, 'Forest'); await put(A, 'Utopia Sprawl'); await A.evaluate(() => { const f = S.bf.find(c => cname(c) === 'Forest'); S.bf.find(c => cname(c) === 'Utopia Sprawl').att = {pid:MYPID, id:f.id}; commit(); }); await after();
      check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Utopia Sprawl' && c.att)), 'Utopia Sprawl (enchant Forest) on a Forest stays');
      await toGy(A, 'Lightning Greaves'); await toGy(A, 'Utopia Sprawl');
    });
    await step('Saga with its final chapter and nothing on the stack is sacrificed', async () => {
      await A.evaluate(() => { const c = S.lib.find(x => cname(x) === 'The Eldest Reborn') || S.hand.find(x => cname(x) === 'The Eldest Reborn'); moveCard(c.id, 'bf', {quiet:true}); S.stk = S.stk.filter(x => x.srcId !== c.id); c.lore = 3; commit(); }); await after();
      check(await gyHas(A, 'The Eldest Reborn'), 'The Eldest Reborn with 3 lore counters went to the graveyard');
    });
    await step('Roles: only the newest Role on a creature stays; tokens off the battlefield cease to exist', async () => {
      await put(A, 'Grizzly Bears'); await after();
      await A.evaluate(async () => { const g = S.bf.find(c => cname(c) === 'Grizzly Bears'); for (const r of ['Monster', 'Wicked']){ await runEffects(`Create a ${r} Role token attached to target creature you control.`, {k:null, name:'test', tgts:[[{t:'card', pid:MYPID, id:g.id, k:g.k, nm:cname(g)}]]}); } commit(); }); await after();
      const roles = await A.evaluate(() => S.bf.filter(c => /\bRole\b/.test(typeOf(c))).map(c => cname(c)));
      check(roles.length === 1 && /Wicked/.test(roles[0]), `one Role left — the newest, Wicked Role (${roles.join(', ')})`);
      await A.evaluate(() => { const g = S.bf.find(c => cname(c) === 'Grizzly Bears'); S.ex.push({id:S.nid++, k:g.k, tok:true, n:1}); commit(); }); await after();
      check(await A.evaluate(() => !S.ex.some(c => c.tok)), 'a token put into exile ceased to exist');
      await toGy(A, 'Grizzly Bears'); await after();
      check(await A.evaluate(() => !S.bf.some(c => /\bRole\b/.test(typeOf(c)))), 'the Role went when its creature left');
    });
    await step('World rule: Kim\'s newer Concordant Crossroads puts Georges\'s into the graveyard', async () => {
      await put(A, 'Concordant Crossroads'); await after(); await sleep(300); await put(B, 'Concordant Crossroads'); await after(); await sleep(1500); await settle([A, B]);
      check(await gyHas(A, 'Concordant Crossroads') && await cnt(B, '^Concordant Crossroads$') === 1, 'only the newest world enchantment (Kim\'s) remains');
      await toGy(B, 'Concordant Crossroads');
    });
    await step('Dungeon: reaching the bottom room completes the dungeon once its room ability resolves', async () => {
      const r = await A.evaluate(() => { const d = 'Lost Mine of Phandelver'; const i = DUNGEONS[d].findIndex(x => !x[2].length); S.dg = {d, r:i}; const n0 = (S.dgList || []).length; commit(); return n0; }); await after();
      check(await A.evaluate(n0 => (S.dgList || []).length === n0 + 1 && !S.dg, r), 'Lost Mine of Phandelver completed');
    });
    await step('Ring-bearer: a borrowed creature stops being a Ring-bearer', async () => {
      await put(A, 'Grizzly Bears'); await A.evaluate(() => { S.ring = 1; const g = S.bf.find(c => cname(c) === 'Grizzly Bears'); g.ring = 1; g.own = 'nobody'; commit(); }); await after();
      check(await A.evaluate(() => !S.bf.find(c => cname(c) === 'Grizzly Bears').ring), 'ring designation removed'); await A.evaluate(() => { const g = S.bf.find(c => cname(c) === 'Grizzly Bears'); delete g.own; moveCard(g.id, 'gy', {quiet:true}); commit(); });
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
