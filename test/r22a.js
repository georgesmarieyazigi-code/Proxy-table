// fix22a (helper Y): the target-dependent gaps the v22 bot games found, in real 2-player games.
// Treebeard ("target Halfling or Treefolk", life-gain amount), Biosynthic Burst ("Untap it"), Varragoth (target player searches
// … on the opponent's own screen), plus other cards of each family and the cards the stricter deck checker found.
// PTPORT=20030 PTFILE=devY.html node r22a.js   (ONLY=<substring> runs matching steps)
process.env.TOP = '1';
const CC = require('./cards');
const WANT = ['Treebeard, Gracious Host', 'Meriadoc Brandybuck', 'Sanguine Bond', 'Vito, Thorn of the Dusk Rose', 'Bloodline Necromancer', 'Vampire Nighthawk', 'Biosynthic Burst', 'Shore Up', 'Gift of the Viper', 'Dream Trawler',
  'Varragoth, Bloodsky Sire', 'Time Warp', 'Beacon of Unrest', 'Rottenmouth Viper', "Mishra's Bauble", 'Noxious Revival', 'Restless Vinestalk', 'Zealous Conscripts', 'Cleric Class', 'Greenwarden of Murasa',
  'Two-Handed Axe', 'Compulsive Research', 'Valki, God of Lies', "Hashaton, Scarab's Fist", 'Strength of Will', 'Esper Origins', 'Firion, Wild Rose Warrior', 'Sol Ring', 'Shock', 'Llanowar Elves', 'Divination', 'Island', 'Swamp', 'Mountain', 'Forest', 'Plains', 'Grizzly Bears'];
CC.cards.push(...CC.topCards('all.json').filter(c => (WANT.includes(c.name) || WANT.some(w => c.name.startsWith(w + ' //'))) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, waitFor} = H;
const AUTO = () => { window.__seen = []; window.__notes0 = 0; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want) : null;
  try {
    window.__seen.push(String(m.title || '')); if (window.__seen.length > 200) window.__seen.shift();
    if (window.__manual) return;
    if (m.type === 'pick' && m.resolve){ const P = window.__pick ? new RegExp(window.__pick) : null; const pref = P ? (m.cards || []).filter(c => P.test(cname(c))) : [];
      const n = pref.length ? Math.min(pref.length, m.max || 1) : Math.max(m.min || 0, 0); const ids = (pref.length ? pref : (m.cards || [])).slice(0, Math.max(n, m.min || 0)).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (w && (m.options || []).find(x => !x.disabled && w.test(x.label))) || (m.options || []).find(x => !x.disabled); m.__done = 1; m.resolve(o ? o.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ const P = window.__pick ? new RegExp(window.__pick) : null; const pref = P ? (m.cands || []).filter(c => c.ok && P.test(c.nm || '')).slice(0, (m.spec && m.spec.n) || 1) : [];
      const i = (m.cands || []).findIndex(c => c.ok && c.pid !== MYPID); m.__done = 1; m.resolve(pref.length ? pref : i >= 0 ? [m.cands[i]] : []); closeModal(); }
    else if (m.type === 'ask' && m.run){ m.__done = 1; m.run(window.__num != null ? window.__num : (m.def ?? 1)); closeModal(); }
    else if (m.run){ m.__done = 1; m.run(m.def ?? 1); closeModal(); }
    else if (m.resolve){ m.__done = 1; m.resolve(true); closeModal(); }
    else if (m.type === 'zone'){ m.__done = 1; closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
let ALL = []; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { await T(90000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 || process.env.LOGS) for (const [nm, p] of ALL) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})).catch(e => e.message))); };
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting || UI.modal)); if (!busy) return; await sleep(150); } };
const toMain = async (p, ps) => { for (let i = 0; i < 50; i++){ if (await p.evaluate(() => phaseNow().mine && phaseNow().ph === 3)) return true; await p.evaluate(() => { if (!stackAll().length && !UI.modal && phaseNow().mine) nextAction(); }); await passAll(ps); } return false; };
const keyOf = 'const a = [...DICT.values()].find(a => a.n === nm || (a.n || "").startsWith(nm + " //"));';
const putBf = (p, nm, extra) => p.evaluate(([nm, extra]) => { const a = [...DICT.values()].find(a => a.n === nm || (a.n || '').startsWith(nm + ' //')); const c = {id:S.nid++, k:a.k, x:20 + (S.nid % 30) * 3, y:30, sk:false, ...(extra || {})}; S.bf.push(c); commit(); return c.id; }, [nm, extra]);
const toZone = (p, nm, z) => p.evaluate(([nm, z]) => { const a = [...DICT.values()].find(a => a.n === nm || (a.n || '').startsWith(nm + ' //')); const c = {id:S.nid++, k:a.k}; if (z === 'lib') S.lib.unshift(c); else S[z].push(c); commit(); return c.id; }, [nm, z]);
const toHand = (p, nm) => toZone(p, nm, 'hand');
const etb = async (p, nm, extra) => { const id = await toHand(p, nm); await p.evaluate(([id, extra]) => { moveCard(id, 'bf'); const c = S.bf.find(x => x.id === id); if (c && extra) Object.assign(c, extra); commit(); }, [id, extra || null]); return id; };
const clean = async (ps) => { for (const p of ps) await p.evaluate(() => { S.bf = []; S.hand = []; S.gy = []; S.ex = []; S.stk = []; S.pool = emptyPool(); S.life = 40; S.psn = 0; S.prm = [];
  window.__want = null; window.__pick = null; window.__num = null; window.__manual = 0; window.__seen = []; UI.notes = []; commit(); }); await sleep(700); };
const logs = (p, n = 30) => p.evaluate(n => S.log.slice(-n).map(e => e.s), n);
const noHand = async (p, who, label) => { const n = await p.evaluate(() => (UI.notes || []).map(x => x.text)); check(!n.length, `${label}: no "do by hand" box on ${who}'s screen${n.length ? ' (' + n.join(' / ') + ')' : ''}`); };
const cast = (p, nm, pool) => p.evaluate(([nm, pool]) => { S.pool = {...emptyPool(), ...(pool || {})}; const c = S.hand.find(x => cname(x) === nm || cname(x).startsWith(nm)); beginCast(c, 'hand'); }, [nm, pool]);
const card = (p, nm) => p.evaluate(nm => { const c = S.bf.find(x => cname(x) === nm); return c ? {id:c.id, tap:!!c.tap, cp:c.cp || 0, ekw:c.ekw || [], st:stats(c)} : null; }, nm);
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r22a');
    const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r22a');
    ALL = [['Georges', A], ['Kim', B]]; const P2 = [A, B];
    await waitFor(A, () => OPP.size === 1, null, 20000); await A.evaluate(AUTO); await B.evaluate(AUTO);
    await A.click('[data-act="goFirst"]'); await settle(P2); await toMain(A, P2);
    const KIM = await A.evaluate(() => [...OPP.keys()][0]);
    const ME = await A.evaluate(() => MYPID);

    // ---------- family 1: "target <type> or <type>" (and the life-gain amount) ----------
    await step('Treebeard: whenever you gain life, that many +1/+1 counters on target Halfling or Treefolk', async () => {
      await clean(P2); await putBf(A, 'Treebeard, Gracious Host'); await putBf(A, 'Meriadoc Brandybuck'); await putBf(A, 'Grizzly Bears');
      const cands = await A.evaluate(() => { const sp = targetSpecs('put that many +1/+1 counters on target Halfling or Treefolk')[0]; return targetCands(sp, {pid:MYPID, id:-1}).filter(c => c.ok).map(c => c.nm); });
      check(cands.includes('Meriadoc Brandybuck') && cands.includes('Treebeard, Gracious Host') && !cands.includes('Grizzly Bears'), `only Halflings and Treefolk can be chosen (${cands.join(', ')})`);
      await A.evaluate(() => { window.__pick = 'Meriadoc'; gainLife(3, 'test'); commit(); }); await sleep(800); await settle(P2); await sleep(500);
      const m = await card(A, 'Meriadoc Brandybuck'); check(m && m.cp === 3, `gained 3 life → Meriadoc Brandybuck got 3 +1/+1 counters (${m && m.cp})`);
      await A.evaluate(() => { window.__pick = 'Treebeard'; gainLife(2, 'test'); commit(); }); await sleep(800); await settle(P2); await sleep(500);
      const t = await card(A, 'Treebeard, Gracious Host'); check(t && t.cp === 2, `gained 2 life → Treebeard (a Treefolk) got 2 counters (${t && t.cp})`);
      await noHand(A, 'Georges', 'Treebeard');
    });
    await step('Sanguine Bond: whenever you gain life, target opponent loses that much life', async () => {
      await clean(P2); await putBf(A, 'Sanguine Bond'); await sleep(300);
      await A.evaluate(() => { gainLife(4, 'test'); commit(); }); await sleep(800); await settle(P2); await sleep(1200);
      const l = await B.evaluate(() => S.life); check(l === 36, `Kim lost 4 life (life ${l})`); await noHand(A, 'Georges', 'Sanguine Bond');
    });
    await step('Bloodline Necromancer: return target Vampire or Wizard creature card from your graveyard to the battlefield', async () => {
      await clean(P2); await toZone(A, 'Vampire Nighthawk', 'gy'); await toZone(A, 'Grizzly Bears', 'gy');
      await A.evaluate(() => { window.__pick = 'Nighthawk'; }); await etb(A, 'Bloodline Necromancer'); await sleep(800); await settle(P2); await sleep(500);
      check(!!(await card(A, 'Vampire Nighthawk')), 'the Vampire came back'); await noHand(A, 'Georges', 'Bloodline Necromancer');
    });

    // ---------- family 2: "untap it / that creature" after a targeted effect ----------
    const untapSpell = async (nm, pool, extra) => {
      await clean(P2); await putBf(A, 'Grizzly Bears', {tap:true}); await toHand(A, nm); await A.evaluate(() => { window.__pick = 'Grizzly'; });
      await cast(A, nm, pool); await sleep(1000); await settle(P2); await sleep(600);
      const c = await card(A, 'Grizzly Bears'); check(c && !c.tap, `${nm}: the tapped target was untapped`); if (extra) await extra(c); await noHand(A, 'Georges', nm);
    };
    await step('Biosynthic Burst: +1/+1 counter, reach, trample and indestructible, untap it', () => untapSpell('Biosynthic Burst', {G:2}, async c => {
      check(c.cp === 1, `a +1/+1 counter (${c.cp})`); check(['reach', 'trample', 'indestructible'].every(k => c.ekw.includes(k)) && !c.ekw.some(k => /^and /.test(k)), `reach, trample, indestructible (${c.ekw.join(', ')})`); }));
    await step('Shore Up: +1/+1 and hexproof, untap it', () => untapSpell('Shore Up', {U:1}, async c => check(c.ekw.includes('hexproof'), 'hexproof')));
    await step('Gift of the Viper: counters, untap it', () => untapSpell('Gift of the Viper', {G:1}));
    await step('Untap an opponent\'s creature (Biosynthic Burst wording on Kim\'s side via the untap op)', async () => {
      await clean(P2); const id = await putBf(B, 'Grizzly Bears', {tap:true}); await sleep(900);
      await A.evaluate(([id, kim]) => { const k = OPP.get(kim).bf.find(c => c.id === id).k; const t = {t:'card', pid:kim, id, k, nm:'Grizzly Bears'}; return runEffects('Untap it.', {k:null, name:'Test', full:'Target creature gains reach until end of turn. Untap it.', it:{kind:'spell'}, tgts:[[t]], lastT:[t], ti:1}); }, [id, KIM]);
      await sleep(1500); const c = await card(B, 'Grizzly Bears'); check(c && !c.tap, 'Kim\'s creature was untapped on Kim\'s side'); await noHand(A, 'Georges', 'untap opponent');
    });
    await step('Dream Trawler: "~ gains hexproof until end of turn. Tap it." (it = the source)', async () => {
      await clean(P2); const id = await putBf(A, 'Dream Trawler'); await toHand(A, 'Island');
      await A.evaluate(id => { const c = S.bf.find(x => x.id === id); const ab = abilityList(c).find(a => /hexproof/i.test(a.eff)); activateAbility(c, ab); }, id); await sleep(800); await settle(P2); await sleep(500);
      const c = await card(A, 'Dream Trawler'); check(c && c.tap, 'Dream Trawler is tapped'); await noHand(A, 'Georges', 'Dream Trawler');
    });

    // ---------- family 3: "target player searches their library …" on the opponent's own screen ----------
    const varr = async (who) => {
      await clean(P2); const id = await putBf(A, 'Varragoth, Bloodsky Sire'); await toZone(B, 'Divination', 'lib'); await B.evaluate(() => { const i = S.lib.findIndex(c => cname(c) === 'Divination'); const [c] = S.lib.splice(i, 1); S.lib.splice(Math.floor(S.lib.length / 2), 0, c); window.__pick = 'Divination'; window.__seen = []; commit(); });
      await A.evaluate(() => { window.__pick = 'Shock'; }); if (who === 'me') await toZone(A, 'Shock', 'lib');
      await A.evaluate(([id, pid]) => { const c = S.bf.find(x => x.id === id); const it = {sid:rid(6), o:nextO(), kind:'ability', k:c.k, nm:cname(c), txt:'Target player searches their library for a card, then shuffles and puts that card on top.', srcId:c.id, tgts:[[{t:'player', pid, nm:nameOf(pid)}]], tgtNm:nameOf(pid)}; S.stk.push(it); S.pass = 's:' + it.sid; commit(); }, [id, who === 'me' ? ME : KIM]);
      await sleep(800); await settle(P2); await sleep(2500);
    };
    await step('Varragoth boast targeting Kim: Kim searches on Kim\'s screen, the card goes on top of Kim\'s library', async () => {
      await varr('kim');
      const top = await B.evaluate(() => S.lib[0] && cname(S.lib[0])); const seen = await B.evaluate(() => window.__seen.filter(t => /Varragoth/.test(t)));
      check(seen.length > 0, `Kim was asked on Kim's screen (${seen.join(' / ')})`); check(top === 'Divination', `Kim's chosen card is on top of Kim's library (${top})`);
      check(!(await A.evaluate(() => window.__seen.some(t => /search your library/i.test(t)))), 'Georges was not asked to search');
      await noHand(A, 'Georges', 'Varragoth'); await noHand(B, 'Kim', 'Varragoth');
    });
    await step('Varragoth boast targeting myself', async () => {
      await varr('me'); const top = await A.evaluate(() => S.lib[0] && cname(S.lib[0])); check(top === 'Shock', `my chosen card is on top (${top})`); await noHand(A, 'Georges', 'Varragoth self');
    });

    // ---------- cards the stricter checker found ----------
    await step('Time Warp targeting Kim: Kim takes the next turn, then Kim\'s own turn', async () => {
      await clean(P2); await toHand(A, 'Time Warp'); await A.evaluate(() => { window.__pick = 'Kim'; }); await cast(A, 'Time Warp', {U:5}); await sleep(1000); await settle(P2); await sleep(500);
      await noHand(A, 'Georges', 'Time Warp');
      const xt = await A.evaluate(() => (S.r18kGiveXt || []).slice()); check(xt.length === 1 && xt[0] === KIM, 'Kim is queued for the extra turn');
      const n0 = await A.evaluate(() => currentTurn()[0]);
      await A.evaluate(() => { passTurn(); commit(); }); await sleep(1500);
      const t1 = await B.evaluate(() => currentTurn()); check(t1[1] === KIM && t1[0] === n0 + 1, `Kim has the next turn (${JSON.stringify(t1)})`);
      await B.evaluate(() => { passTurn(); commit(); }); await sleep(1500);
      const t2 = await A.evaluate(() => currentTurn()); check(t2[0] === n0 + 2, `after the extra turn play goes on from Georges: Kim again in 2 players (${JSON.stringify(t2)}, Kim=${t2[1] === KIM})`);
      await B.evaluate(() => { passTurn(); commit(); }); await sleep(1500); await settle(P2); await toMain(A, P2);
      check(await A.evaluate(() => currentTurn()[1] === MYPID), 'then back to Georges');
    });
    await step('Beacon of Unrest: a creature card from Kim\'s graveyard onto my battlefield', async () => {
      await clean(P2); await toZone(B, 'Llanowar Elves', 'gy'); await sleep(900); await toHand(A, 'Beacon of Unrest'); await A.evaluate(() => { window.__pick = 'Llanowar'; });
      await cast(A, 'Beacon of Unrest', {B:5}); await sleep(1000); await settle(P2); await sleep(2000);
      check(!!(await card(A, 'Llanowar Elves')), 'Llanowar Elves is on my battlefield'); check(!(await B.evaluate(() => S.gy.some(c => cname(c) === 'Llanowar Elves'))), 'and gone from Kim\'s graveyard');
      await noHand(A, 'Georges', 'Beacon of Unrest');
    });
    await step('Rottenmouth Viper: each opponent loses 4 life unless they sacrifice or discard — Kim chooses on Kim\'s screen', async () => {
      await clean(P2); await B.evaluate(() => { window.__want = 'Lose 4'; }); await etb(A, 'Rottenmouth Viper'); await sleep(800); await settle(P2); await sleep(2500);
      const l = await B.evaluate(() => S.life); check(l === 36, `Kim chose to lose 4 life (${l})`); await noHand(A, 'Georges', 'Rottenmouth Viper');
    });
    await step('Mishra\'s Bauble on Kim: I see the top card of Kim\'s library', async () => {
      await clean(P2); await toZone(B, 'Divination', 'lib'); const id = await putBf(A, "Mishra's Bauble"); await A.evaluate(() => { window.__pick = 'Kim'; window.__seen = []; });
      await A.evaluate(id => { const c = S.bf.find(x => x.id === id); activateAbility(c, abilityList(c).find(a => /top card/.test(a.eff))); }, id); await sleep(800); await settle(P2); await sleep(2500);
      const seen = await A.evaluate(() => window.__seen.filter(t => /top card of Kim/.test(t))); check(seen.length > 0, `Georges saw Kim's top card (${seen.join(' / ')})`); await noHand(A, 'Georges', "Mishra's Bauble");
    });
    await step('Noxious Revival: a card in Kim\'s graveyard on top of Kim\'s library', async () => {
      await clean(P2); await toZone(B, 'Llanowar Elves', 'gy'); await sleep(900); await toHand(A, 'Noxious Revival'); await A.evaluate(() => { window.__pick = 'Llanowar'; });
      await cast(A, 'Noxious Revival', {G:1}); await sleep(1000); await settle(P2); await sleep(1500);
      check(await B.evaluate(() => S.lib[0] && cname(S.lib[0]) === 'Llanowar Elves'), 'Llanowar Elves is on top of Kim\'s library'); await noHand(A, 'Georges', 'Noxious Revival');
    });
    await step('Zealous Conscripts: gain control of target permanent until end of turn. Untap that permanent.', async () => {
      await clean(P2); await putBf(B, 'Grizzly Bears', {tap:true}); await sleep(900); await A.evaluate(() => { window.__pick = 'Grizzly'; }); await etb(A, 'Zealous Conscripts'); await sleep(800); await settle(P2); await sleep(2000);
      const c = await card(A, 'Grizzly Bears'); check(c && !c.tap, 'I control Kim\'s Grizzly Bears, untapped'); await noHand(A, 'Georges', 'Zealous Conscripts');
    });
    await step('Greenwarden of Murasa: when it dies, you may exile it; if you do, return target card from your graveyard', async () => {
      await clean(P2); await toZone(A, 'Divination', 'gy'); const id = await putBf(A, 'Greenwarden of Murasa'); await A.evaluate(() => { window.__pick = 'Divination'; });
      await A.evaluate(id => { moveCard(id, 'gy'); commit(); }, id); await sleep(800); await settle(P2); await sleep(800);
      check(await A.evaluate(() => S.ex.some(c => cname(c) === 'Greenwarden of Murasa')), 'Greenwarden was exiled'); check(await A.evaluate(() => S.hand.some(c => cname(c) === 'Divination')), 'Divination returned to hand');
      await noHand(A, 'Georges', 'Greenwarden');
    });
    await step('Compulsive Research targeting Kim: Kim draws three, then chooses the discard on Kim\'s screen', async () => {
      await clean(P2); await toHand(B, 'Island'); await toHand(B, 'Divination'); await sleep(800); await B.evaluate(() => { window.__seen = []; }); await toHand(A, 'Compulsive Research'); await A.evaluate(() => { window.__pick = 'Kim'; window.__seen = []; });
      await cast(A, 'Compulsive Research', {U:3}); await sleep(1000); await settle(P2); await sleep(3000);
      const h = await B.evaluate(() => S.hand.length); const asked = await B.evaluate(() => window.__seen.filter(t => /Compulsive/.test(t)));
      check(h === 3 || h === 4, `Kim drew 3 and discarded a land or two cards (hand ${h})`); check(asked.length > 0, `Kim chose on Kim's screen (${asked.join(' / ')})`);
      check(!(await A.evaluate(() => window.__seen.some(t => /discard/i.test(t)))), 'Georges was not asked about the discard');
      await noHand(A, 'Georges', 'Compulsive Research'); await noHand(B, 'Kim', 'Compulsive Research');
    });
    await step('Tibalt, Cosmic Impostor +2: exile the top card of each library; I may play both (Kim\'s from Kim\'s exile)', async () => {
      await clean(P2); await toZone(A, 'Shock', 'lib'); await toZone(B, 'Llanowar Elves', 'lib'); await sleep(800);
      const id = await putBf(A, 'Valki, God of Lies', {fl:true, co:5}); await A.evaluate(id => { const c = S.bf.find(x => x.id === id); activateLoyalty(c, 0); }, id).catch(e => console.log('   act', e.message));
      await sleep(800); await settle(P2); await sleep(3000);
      const ex = await A.evaluate(() => S.ex.map(c => ({n:cname(c), own:!!c.own, may:!!c.mayPlay})));
      check(ex.some(e => e.n === 'Shock' && e.may), `my Shock is exiled and playable (${JSON.stringify(ex)})`);
      check(ex.some(e => e.n === 'Llanowar Elves' && e.own && e.may), 'Kim\'s Llanowar Elves is exiled for me and playable');
      check(await B.evaluate(() => S.ex.some(c => cname(c) === 'Llanowar Elves')), 'it is in Kim\'s exile (the owner\'s)');
      await A.evaluate(() => { S.pool = {...emptyPool(), R:1}; const c = S.ex.find(x => cname(x) === 'Llanowar Elves'); beginCast(c, 'ex'); }); await sleep(1000); await settle(P2); await sleep(2500);
      check(!!(await card(A, 'Llanowar Elves')), 'I cast Kim\'s Llanowar Elves with red mana (any color)'); check(!(await B.evaluate(() => S.ex.some(c => cname(c) === 'Llanowar Elves'))), 'it left Kim\'s exile');
      await noHand(A, 'Georges', 'Tibalt'); await noHand(B, 'Kim', 'Tibalt');
    });
    await step('Hashaton: whenever you discard a creature card, pay {2}{U}: a tapped 4/4 black Zombie copy of it', async () => {
      await clean(P2); await putBf(A, "Hashaton, Scarab's Fist"); await toHand(A, 'Grizzly Bears'); await A.evaluate(() => { S.pool = {...emptyPool(), U:3}; window.__pick = 'Grizzly'; window.__want = 'Pay|Yes'; });
      await A.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Grizzly Bears'); UI.discarding = []; moveCard(c.id, 'gy'); UI.discarding = null; commit(); }); await sleep(1000); await settle(P2); await sleep(1000);
      const t = await A.evaluate(() => S.bf.filter(c => c.tok).map(c => ({n:cname(c), st:stats(c), tap:!!c.tap, ty:typeOf(c)})));
      check(t.some(x => x.n === 'Grizzly Bears' && x.st[0] === 4 && x.st[1] === 4 && x.tap), `a tapped 4/4 copy of Grizzly Bears (${JSON.stringify(t)})`); await noHand(A, 'Georges', 'Hashaton');
    });
    await step('life Kim gives me fires my "whenever you gain life" triggers with the amount', async () => {
      await clean(P2); await putBf(A, 'Sanguine Bond'); await putBf(A, 'Treebeard, Gracious Host'); await putBf(A, 'Meriadoc Brandybuck'); await A.evaluate(() => { window.__pick = 'Meriadoc|Kim'; }); await sleep(800);
      const l0 = await A.evaluate(() => S.life); await B.evaluate(me => { sendRq(me, 'life', 3, 'Kim gift'); commit(); }, ME); await sleep(1500); await settle(P2); await sleep(2000);
      check(await A.evaluate(() => S.life) === l0 + 3, 'I gained 3'); const m = await card(A, 'Meriadoc Brandybuck'); check(m && m.cp === 3, `Treebeard: 3 counters (${m && m.cp})`);
      check(await B.evaluate(() => S.life) === 37, `Sanguine Bond: Kim lost 3 (${await B.evaluate(() => S.life)})`); await noHand(A, 'Georges', 'life gift');
    });
    await step('"target player\'s library" lists only players', async () => {
      await clean(P2); await putBf(A, 'Grizzly Bears'); await putBf(B, 'Grizzly Bears'); await sleep(800);
      const c = await A.evaluate(() => { const sp = targetSpecs("Look at the top card of target player's library.")[0]; return targetCands(sp, {pid:MYPID, id:-1}).map(c => c.t + ':' + c.nm); });
      check(c.length === 2 && c.every(x => x.startsWith('player:')), `only the two players (${c.join(', ')})`);
    });
    await step('Strength of Will: indestructible and damage becomes +1/+1 counters', async () => {
      await clean(P2); const id = await putBf(A, 'Grizzly Bears'); await toHand(A, 'Strength of Will'); await A.evaluate(() => { window.__pick = 'Grizzly'; });
      await cast(A, 'Strength of Will', {G:2}); await sleep(1000); await settle(P2); await sleep(500);
      await B.evaluate(([me, id]) => { const k = [...DICT.values()].find(a => a.n === 'Shock').k; dealDamage({t:'card', pid:me, id}, 2, k, null); commit(); }, [ME, id]); await sleep(1500); await settle(P2); await sleep(1000);
      const c = await card(A, 'Grizzly Bears'); check(c && c.cp === 2, `survived with 2 +1/+1 counters (${JSON.stringify(c)})`); await noHand(A, 'Georges', 'Strength of Will');
    });
    await step('Esper Origins: from hand (surveil 2, gain 2), then flashback: exiled and back transformed with a finality counter', async () => {
      await clean(P2); await toHand(A, 'Esper Origins'); const l0 = await A.evaluate(() => S.life); await cast(A, 'Esper Origins', {G:2}); await sleep(1000); await settle(P2); await sleep(500);
      check(await A.evaluate(() => S.life) === l0 + 2, 'gained 2'); check(await A.evaluate(() => S.gy.some(c => /Esper Origins/.test(cname(c)))), 'in the graveyard after the hand cast'); await noHand(A, 'Georges', 'Esper Origins (hand)');
      await A.evaluate(() => { S.pool = {...emptyPool(), G:4}; const c = S.gy.find(x => /Esper Origins/.test(cname(x))); castFromGy(c, gyOptions(c).find(g => g.kind === 'flashback')); }); await sleep(1000); await settle(P2); await sleep(1000);
      const b = await A.evaluate(() => S.bf.filter(c => /Esper/.test(info(c.k)?.n || '')).map(c => ({fl:!!c.fl, n:cname(c), fin:(c.nc || {}).finality || 0})));
      check(b.length === 1 && b[0].fl && b[0].fin === 1, `flashback: on the battlefield transformed with a finality counter (${JSON.stringify(b)})`); await noHand(A, 'Georges', 'Esper Origins (flashback)');
    });
    await step('Firion: a nontoken Equipment enters → token copy that costs {2} less to equip, sacrificed next upkeep', async () => {
      await clean(P2); await putBf(A, 'Firion, Wild Rose Warrior'); await etb(A, 'Two-Handed Axe'); await sleep(1000); await settle(P2); await sleep(800);
      const t = await A.evaluate(() => S.bf.filter(c => c.tok).map(c => cname(c))); check(t.includes('Two-Handed Axe'), `a token copy of Two-Handed Axe (${t.join(', ')})`); await noHand(A, 'Georges', 'Firion');
    });
    await step('Two-Handed Axe: whenever equipped creature attacks, double its power until end of turn', async () => {
      await clean(P2); await settle(P2); await toMain(A, P2); const bid = await putBf(A, 'Grizzly Bears'); const ax = await putBf(A, 'Two-Handed Axe'); await A.evaluate(([b, a]) => { S.bf.find(x => x.id === a).att = {pid:MYPID, id:b}; S.bf.find(x => x.id === b).sk = false; commit(); }, [bid, ax]);
      await A.evaluate(() => { for (let i = 0; i < 10 && phaseNow().ph < 4; i++) nextAction(); }); await sleep(600);
      await A.evaluate(([b, kim]) => { attackWith(b); const c = S.bf.find(x => x.id === b); if (c) c.atk = kim; commit(); }, [bid, KIM]); await sleep(1000); await settle(P2); await sleep(500);
      const c = await card(A, 'Grizzly Bears'); check(c && c.st[0] === 4, `Grizzly Bears' power doubled to 4 (${c && c.st})`); await noHand(A, 'Georges', 'Two-Handed Axe');
    });
    await step('deck checker: the three cards are understood now, and the strict pass catches the old gaps', async () => {
      const r = await A.evaluate(async () => { const out = {}; for (const off of [true, false]){ Y22.off = off; for (const n of ['Treebeard, Gracious Host', 'Biosynthic Burst', 'Varragoth, Bloodsky Sire']){ const a = [...DICT.values()].find(a => a.n === n); out[(off ? 'old ' : 'now ') + n] = (await checkCard(a.k)).issues.map(x => x.text); } } Y22.off = false; return out; });
      for (const n of ['Treebeard, Gracious Host', 'Biosynthic Burst', 'Varragoth, Bloodsky Sire']){ check(r['old ' + n].length > 0, `with the fixes switched off the checker flags ${n} (${JSON.stringify(r['old ' + n])})`); check(!r['now ' + n].length, `${n} is understood with the fixes (${JSON.stringify(r['now ' + n])})`); }
    });
  } catch (e){ console.log('FATAL', e.message); check(false, 'test ran'); }
  console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`);
  await browser.close(); server.close(); process.exit(H.fails() ? 1 : 0);
})();
