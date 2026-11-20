// Round 20 helper P: choosing at the right time (GAPS20 section P) in real 2- and 3-player games.
// PTPORT=19700 PTFILE=dev20P.html node r20a.js   (ONLY=<substring> runs matching steps)
process.env.TOP = '1';
const CC = require('./cards');
const WANT = ['Ancient Brass Dragon', 'Rampaging Yao Guai', 'Sepulchral Primordial', 'Diluvian Primordial', 'Tasha, the Witch Queen', 'Afterlife from the Loam', 'Glissa Sunslayer', 'Charming Prince',
  'Elder Gargaroth', 'Monument to Endurance', 'Knight of Autumn', 'Reunion of the House', 'Behold the Sinister Six!', 'Sun Titan', 'Memnite', 'Ornithopter', 'Sol Ring', 'Llanowar Elves', 'Grizzly Bears',
  'Lightning Bolt', 'Shock', 'Divination', 'Duress', 'Mind Stone', 'Arcane Signet', 'Swiftfoot Boots', 'Wayfarer\'s Bauble', 'Rhystic Study', 'Phyrexian Arena', 'Ravenous Chupacabra', 'Gray Merchant of Asphodel',
  'Cloud\'s Limit Break', 'Life from the Loam', 'Island', 'Swamp', 'Mountain', 'Forest', 'Plains', 'Elvish Mystic', 'Fyndhorn Elves', 'Siege Rhino', 'Kozilek\'s Command', 'Junji, the Midnight Sky', 'Black Market Connections', 'Hullbreaker Horror', 'Goblin Welder', 'Mind Stone', 'Wayfarer\'s Bauble',
  'Sun Titan', "Sevinne's Reclamation", 'Life from the Loam', 'Unearth', 'Goblin Engineer', 'Mantle of the Ancients', 'Shigeki, Jukai Visionary', "Teshar, Ancestor's Apostle", 'Bow of Nylea', 'Peerless Recycling', "Archenemy's Charm", 'Angel of Indemnity', 'Squall, SeeD Mercenary', 'Pit of Offerings', 'Smile at Death', 'Reveillark', 'Court of Ardenvale', 'Unfinished Business', 'Season of the Burrow', 'Gixian Puppeteer', 'The Restoration of Eiganjo', 'Helping Hand', "Marshal's Anthem", 'Back in Town', 'Terra, Herald of Hope', 'Macabre Waltz', 'Rot Hulk', 'Quintorius Kand', 'Cavalier of Night', 'Fight On!', 'Find', 'Chandra, Acolyte of Flame', 'Aberrant Return', 'Pre-War Formalwear', 'Lorehold Charm', 'Lord Windgrace', 'Revival', 'Redemption Choir', "Erebos's Intervention", 'Alesha, Who Smiles at Death', 'Angel of Serenity', "Staff of Eden, Vault's Key"];
const SWEEP_SKIP = /^(Back in Town|Rot Hulk|Terra, Herald of Hope|Chandra, Acolyte of Flame|Redemption Choir|Alesha, Who Smiles at Death|Angel of Serenity|Staff of Eden, Vault.s Key)$/;   // need X, an outlaw/Zombie, a mana payment, an intervening "if", or a second cast flow; the last two have no changed line
const SWEEP = ['Sun Titan', "Sevinne's Reclamation", 'Life from the Loam', 'Unearth', 'Goblin Engineer', 'Mantle of the Ancients', 'Shigeki, Jukai Visionary', "Teshar, Ancestor's Apostle", 'Bow of Nylea', 'Peerless Recycling', "Archenemy's Charm", 'Angel of Indemnity', 'Squall, SeeD Mercenary', 'Pit of Offerings', 'Smile at Death', 'Reveillark', 'Court of Ardenvale', 'Unfinished Business', 'Season of the Burrow', 'Gixian Puppeteer', 'The Restoration of Eiganjo', 'Helping Hand', "Marshal's Anthem", 'Back in Town', 'Terra, Herald of Hope', 'Macabre Waltz', 'Rot Hulk', 'Quintorius Kand', 'Cavalier of Night', 'Fight On!', 'Find', 'Chandra, Acolyte of Flame', 'Aberrant Return', 'Pre-War Formalwear', 'Lorehold Charm', 'Lord Windgrace', 'Revival', 'Redemption Choir', "Erebos's Intervention", 'Alesha, Who Smiles at Death', 'Angel of Serenity', "Staff of Eden, Vault's Key"];
CC.cards.push(...CC.topCards('all.json').filter(c => (WANT.includes(c.name) || WANT.some(w => c.name.startsWith(w + ' //'))) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, waitFor} = H;
// auto-answer: window.__want (regex for choice labels), window.__pick (regex for card names), window.__num (number for askNumber)
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
let ALL = []; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { await T(150000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 || process.env.LOGS) for (const [nm, p] of ALL) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-16).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})).catch(e => e.message))); };
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting || UI.modal)); if (!busy) return; await sleep(150); } };
const toMain = async (p, ps) => { for (let i = 0; i < 50; i++){ if (await p.evaluate(() => phaseNow().mine && phaseNow().ph === 3)) return true; await p.evaluate(() => { if (!stackAll().length && !UI.modal && phaseNow().mine) nextAction(); }); await passAll(ps); } return false; };
const putBf = (p, nm, extra) => p.evaluate(([nm, extra]) => { const a = [...DICT.values()].find(a => a.n === nm || (a.n || '').startsWith(nm + ' //')); const c = {id:S.nid++, k:a.k, x:20 + (S.nid % 30) * 3, y:30, sk:false, ...(extra || {})}; S.bf.push(c); commit(); return c.id; }, [nm, extra]);
const toZone = (p, nm, z) => p.evaluate(([nm, z]) => { const a = [...DICT.values()].find(a => a.n === nm || (a.n || '').startsWith(nm + ' //')); const c = {id:S.nid++, k:a.k}; if (z === 'lib') S.lib.unshift(c); else S[z].push(c); commit(); return c.id; }, [nm, z]);
const toHand = (p, nm) => toZone(p, nm, 'hand');
const cast = (p, nm, pool) => p.evaluate(([nm, pool]) => { S.pool = {...emptyPool(), ...(pool || {})}; const c = S.hand.find(x => cname(x) === nm || cname(x).startsWith(nm)); beginCast(c, 'hand'); }, [nm, pool]);
const clean = async (ps) => { for (const p of ps) await p.evaluate(() => { S.bf = S.bf.filter(c => isLand(c.k) && !c.tok); S.hand = []; S.gy = []; S.ex = []; S.stk = []; S.pool = emptyPool(); window.__want = null; window.__pick = null; window.__num = null; window.__manual = 0; commit(); }); await sleep(600); };
const seen = (p, re) => p.evaluate(re => window.__seen.filter(t => new RegExp(re).test(t)), re);
const logs = (p, n = 30) => p.evaluate(n => S.log.slice(-n).map(e => e.s), n);

const stk = p => p.evaluate(() => stackAll().map(i => i.nm + ' → ' + (i.tgtNm || '') + (i.hold ? ' [hold]' : '')));
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r20a');
    const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r20a');
    ALL = [['Georges', A], ['Kim', B]]; const P2 = [A, B];
    await waitFor(A, () => OPP.size === 1, null, 20000); await A.evaluate(AUTO); await B.evaluate(AUTO);
    await A.click('[data-act="goFirst"]'); await settle(P2); await toMain(A, P2);
    const KIM = await A.evaluate(() => [...OPP.keys()][0]); const GEO = await A.evaluate(() => MYPID);
    const kimSees = (re, ms = 10000) => waitFor(B, re => stackAll().some(i => new RegExp(re).test(i.nm + ' → ' + (i.tgtNm || ''))), re, ms);
    const geoSees = (re, ms = 10000) => waitFor(A, re => stackAll().some(i => new RegExp(re).test(i.nm + ' → ' + (i.tgtNm || ''))), re, ms);
    // titles asked while the item is on the stack before anyone passes vs. while resolving
    const probe = async (label, fire) => { await A.evaluate(() => { window.__seen = []; }); await fire(); await sleep(2500);
      const s1 = await seen(A, '.'); const st = await stk(A); await settle(P2); await sleep(1500); const s2 = (await seen(A, '.')).slice(s1.length);
      console.log(`  [${label}] before resolving: ${JSON.stringify(s1)}\n    stack: ${JSON.stringify(st)}\n    while resolving: ${JSON.stringify(s2)}`); return {s1, s2, st}; };
    // no prompt for Georges while the item resolves (its choices were made when it went on the stack)
    const quietResolve = async (label) => { const n0 = (await seen(A, '.')).length; await settle(P2); await sleep(1500); const nw = (await seen(A, '.')).slice(n0); check(!nw.length, `${label}: nothing was asked while it resolved${nw.length ? ' (' + nw.join(' / ') + ')' : ''}`); };
    const etb = async (p, nm) => { const id = await toHand(p, nm); await p.evaluate(id => { moveCard(id, 'bf'); commit(); }, id); return id; };
    const onBf = (p, re) => p.evaluate(re => S.bf.filter(c => new RegExp(re).test(cname(c))).map(cname), re);

    await step('#1a Rampaging Yao Guai: targets chosen as it triggers, total mana value kept within X', async () => {
      for (const n of ['Sol Ring', 'Mind Stone', 'Swiftfoot Boots']) await putBf(B, n); await sleep(700);
      await A.evaluate(() => { window.__num = 3; window.__pick = 'Sol Ring|Mind Stone|Swiftfoot Boots'; window.__seen = []; });
      await toHand(A, 'Rampaging Yao Guai'); await cast(A, 'Rampaging Yao Guai', {G:6});
      check(await kimSees("^Rampaging Yao Guai → (?=.*Sol Ring)(?=.*Mind Stone)", 15000), 'Kim sees the trigger on the stack targeting Sol Ring and Mind Stone (1 + 2 = 3)');
      const st = (await stk(B)).find(x => /^Rampaging Yao Guai →/.test(x)) || ''; check(!/Swiftfoot/.test(st), `Swiftfoot Boots could not be added (it would make 5): ${st}`);
      await quietResolve('Yao Guai');
      const r = await onBf(B, 'Sol Ring|Mind Stone|Swiftfoot'); check(r.length === 1 && r[0] === 'Swiftfoot Boots', `Sol Ring and Mind Stone destroyed, the Boots stay (${r})`);
      await clean(P2);
    });

    await step('#1b Ancient Brass Dragon: the d20 is rolled, then a reflexive trigger with targets (total ≤ roll) goes on the stack', async () => {
      for (const n of ['Grizzly Bears', 'Ravenous Chupacabra', 'Memnite']) await toZone(B, n, 'gy'); await sleep(800);
      const g = await putBf(A, 'Ancient Brass Dragon'); await A.evaluate(() => { window.__R = Math.random; Math.random = () => 0.2; window.__pick = 'Grizzly|Ravenous|Memnite'; window.__seen = []; });
      await A.evaluate(([id, k]) => { const c = S.bf.find(x => x.id === id); emit({type:'cdmg', k:c.k, id:c.id, dp:k, cnt:1, amt:7}); commit(); }, [g, KIM]);
      check(await kimSees('^Ancient Brass Dragon'), 'the combat damage trigger is on the stack');
      check(!(await seen(A, 'total mana value')).length, 'no targets were asked for before the roll');
      for (let i = 0; i < 40 && !(await A.evaluate(() => S.stk.some(i => i.p20abd))); i++){ for (const p of P2) await p.evaluate(() => { if (myBox() && !S.stk.some(i => i.p20abd) && !stackAll().some(i => i.p20abd)) doPass(); }); await sleep(250); }
      await A.evaluate(() => { Math.random = window.__R; });
      check(await kimSees("^Ancient Brass Dragon → (?=.*Grizzly Bears)(?=.*Memnite)"), 'after rolling 5, a second trigger targeting Grizzly Bears (2) and Memnite (0) from Kim\'s graveyard is on the stack');
      check(!(await stk(B)).some(x => /Chupacabra/.test(x)), 'Ravenous Chupacabra (4) could not be added: 2 + 4 > 5');
      await quietResolve('Brass Dragon reflexive trigger');
      check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Grizzly Bears') && S.bf.some(c => cname(c) === 'Memnite')), 'Georges gets Grizzly Bears and Memnite');
      check(await B.evaluate(() => S.gy.some(c => cname(c) === 'Ravenous Chupacabra') && !S.gy.some(c => /Grizzly|Memnite/.test(cname(c)))), 'they left Kim\'s graveyard; the Chupacabra stayed');
      await clean(P2);
    });

    await step('#2a Sepulchral Primordial: the graveyard target is chosen on the trigger, and is checked again on resolution', async () => {
      await toZone(B, 'Grizzly Bears', 'gy'); await toZone(B, 'Memnite', 'gy'); await sleep(800);
      await A.evaluate(() => { window.__pick = 'Grizzly'; window.__seen = []; });
      await etb(A, 'Sepulchral Primordial');
      check(await kimSees("^Sepulchral Primordial → Kim's Grizzly Bears"), 'Kim sees the trigger targeting the Grizzly Bears in her graveyard');
      await quietResolve('Sepulchral');
      check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Grizzly Bears')), 'Georges put the Grizzly Bears onto the battlefield');
      // the target leaves the graveyard in response → nothing happens
      await A.evaluate(() => { S.bf = S.bf.filter(c => !/Sepulchral|Grizzly/.test(cname(c))); window.__pick = 'Memnite'; commit(); });
      await etb(A, 'Sepulchral Primordial');
      check(await kimSees("^Sepulchral Primordial → Kim's Memnite"), 'second trigger targets Memnite');
      await B.evaluate(() => { const c = S.gy.find(x => cname(x) === 'Memnite'); moveCard(c.id, 'ex'); commit(); }); await sleep(800);
      await quietResolve('Sepulchral (illegal target)');
      check(await A.evaluate(() => !S.bf.some(c => cname(c) === 'Memnite') && S.log.slice(-6).some(e => /no longer in the graveyard|fizzled/.test(e.s))), 'Memnite left the graveyard: the trigger does nothing');
      await clean(P2);
    });

    await step('#2b Diluvian Primordial: the instant is chosen on the trigger, then cast for free', async () => {
      await toZone(B, 'Divination', 'gy'); await sleep(800); const h0 = await A.evaluate(() => S.hand.length);
      await A.evaluate(() => { window.__pick = 'Divination'; window.__want = 'Cast'; window.__seen = []; });
      await etb(A, 'Diluvian Primordial'); const h1 = await A.evaluate(() => S.hand.length);
      check(await kimSees("^Diluvian Primordial → Kim's Divination"), 'Kim sees the trigger targeting Divination in her graveyard');
      await settle(P2); await sleep(2500); await settle(P2);
      const h2 = await A.evaluate(() => S.hand.length); check(h2 === h1 + 2, `Georges cast Divination for free and drew two (${h1} → ${h2})`);
      check(await B.evaluate(() => S.ex.some(c => cname(c) === 'Divination') && !S.gy.some(c => cname(c) === 'Divination')), 'Divination was exiled instead of going back to Kim\'s graveyard');
      check(!(await seen(A, 'cast up to one')).length, 'no "which card?" question on resolution');
      await clean(P2);
    });

    await step("#2c Tasha's +1: the card in each opponent's graveyard is chosen as it is activated", async () => {
      await toZone(B, 'Lightning Bolt', 'gy'); await sleep(800);
      await A.evaluate(() => { window.__pick = 'Lightning Bolt'; window.__seen = []; });
      const t = await putBf(A, 'Tasha, the Witch Queen', {co:4}); await A.evaluate(id => { const c = S.bf.find(x => x.id === id); activateLoyalty(c, 0); }, t);
      check(await kimSees("^Tasha, the Witch Queen → Kim's Lightning Bolt"), 'Kim sees the ability targeting Lightning Bolt in her graveyard');
      await quietResolve('Tasha +1');
      check(await B.evaluate(() => !S.gy.some(c => cname(c) === 'Lightning Bolt')), 'Lightning Bolt left Kim\'s graveyard');
      check(await A.evaluate(() => S.ex.some(c => cname(c) === 'Lightning Bolt' && (c.nc || {}).page > 0) || S.log.slice(-8).some(e => /page counter/.test(e.s))), 'it is in exile with a page counter');
      await clean(P2);
    });

    await step('#2d Afterlife from the Loam: one target per player, chosen while casting', async () => {
      await toZone(A, 'Memnite', 'gy'); await toZone(B, 'Grizzly Bears', 'gy'); await sleep(800);
      await A.evaluate(() => { window.__pick = 'Memnite|Grizzly'; window.__seen = []; });
      await toHand(A, 'Afterlife from the Loam'); await A.evaluate(() => { window.__pick = 'Memnite|Grizzly'; }); await cast(A, 'Afterlife from the Loam', {B:8});
      check(await kimSees("^Afterlife from the Loam → (?=.*Memnite)(?=.*Kim's Grizzly Bears)"), 'Kim sees the spell targeting Memnite and her Grizzly Bears');
      await quietResolve('Afterlife');
      const r = await onBf(A, 'Memnite|Grizzly'); check(r.length === 2, `both are on Georges's battlefield (${r})`);
      await clean(P2);
    });

    await step('#3a Glissa Sunslayer: the mode and its target are chosen as the trigger goes on the stack', async () => {
      await putBf(B, 'Phyrexian Arena'); await sleep(700);
      await A.evaluate(() => { window.__want = 'Destroy target enchantment'; window.__seen = []; });
      const g = await putBf(A, 'Glissa Sunslayer'); await A.evaluate(([id, k]) => { const c = S.bf.find(x => x.id === id); emit({type:'cdmg', k:c.k, id:c.id, dp:k, cnt:1, amt:3}); commit(); }, [g, KIM]);
      check(await kimSees("^Glissa Sunslayer → Destroy target enchantment.*Kim's Phyrexian Arena"), 'Kim sees the mode and its target on the stack');
      const sq = await seen(A, 'Glissa'); check(sq.findIndex(t => /choose one/.test(t)) === 0, `the mode was asked first, then the target (${sq.join(' / ')})`);
      await quietResolve('Glissa');
      check(await B.evaluate(() => !S.bf.some(c => cname(c) === 'Phyrexian Arena')), 'Phyrexian Arena destroyed');
      await clean(P2);
    });

    await step('#3b Junji: a mode that targets a graveyard card; Monument to Endurance: a mode already chosen this turn is not offered', async () => {
      await toZone(B, 'Grizzly Bears', 'gy'); await sleep(700); const l0 = await A.evaluate(() => S.life);
      await A.evaluate(() => { window.__want = 'Put target non-Dragon'; window.__pick = 'Grizzly'; window.__seen = []; });
      const j = await putBf(A, 'Junji, the Midnight Sky'); await A.evaluate(id => { destroyCard(S.bf.find(x => x.id === id)); commit(); }, j);
      check(await kimSees("^Junji, the Midnight Sky → Put target non-Dragon.*Kim's Grizzly Bears"), 'Kim sees Junji\'s dies trigger with its mode and target');
      await quietResolve('Junji');
      check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Grizzly Bears')), 'Georges gets the Grizzly Bears');
      const l1 = await A.evaluate(() => S.life); check(l1 === l0 - 2, `Georges lost 2 life (${l0} → ${l1})`);
      // Monument to Endurance
      const mon = await putBf(A, 'Monument to Endurance'); const k0 = await B.evaluate(() => S.life);
      await A.evaluate(() => { window.__want = 'loses 3 life'; window.__pick = null; window.__seen = []; });
      const disc = async () => { const id = await toHand(A, 'Memnite'); await A.evaluate(id => { const c = S.hand.find(x => x.id === id); moveCard(c.id, 'gy'); emit({type:'discard', k:c.k, id:c.id, cnt:1}); commit(); }, id); await sleep(1500); await settle(P2); await sleep(1200); };
      await disc(); const k1 = await B.evaluate(() => S.life); check(k1 === k0 - 3, `first discard: each opponent loses 3 (${k0} → ${k1})`);
      const h0 = await A.evaluate(() => S.hand.length); await disc(); const k2 = await B.evaluate(() => S.life); const h1 = await A.evaluate(() => S.hand.length);
      check(k2 === k1 && h1 === h0 + 1, `second discard: "lose 3" was not offered again, the first other mode (draw) was taken (Kim ${k1} → ${k2}, hand ${h0} → ${h1})`);
      await clean(P2);
    });

    await step('#4a Sun Titan / Life from the Loam: graveyard targets written with a qualifier or in the plural are chosen when it triggers / is cast', async () => {
      for (const n of ['Sol Ring', 'Ravenous Chupacabra']) await toZone(A, n, 'gy');
      await A.evaluate(() => { window.__pick = 'Sol Ring|Ravenous'; window.__want = 'Yes|Return|Do it'; window.__seen = []; });
      await etb(A, 'Sun Titan');
      check(await geoSees('^Sun Titan → Sol Ring$'), 'Sun Titan\'s trigger targets Sol Ring (Ravenous Chupacabra, mana value 4, is not a legal target)');
      await settle(P2); await sleep(1500);
      check(await A.evaluate(() => S.bf.some(c => cname(c) === 'Sol Ring') && S.gy.some(c => cname(c) === 'Ravenous Chupacabra')), 'Sol Ring returned to the battlefield');
      for (let i = 0; i < 3; i++) await toZone(A, 'Mountain', 'gy');
      await A.evaluate(() => { window.__pick = 'Mountain'; window.__seen = []; }); const h0 = await A.evaluate(() => S.hand.length);
      await toHand(A, 'Life from the Loam'); await cast(A, 'Life from the Loam', {G:2});
      check(await kimSees('^Life from the Loam → Mountain, Mountain, Mountain'), 'Kim sees Life from the Loam targeting three Mountains');
      await quietResolve('Life from the Loam');
      const h1 = await A.evaluate(() => S.hand.filter(c => cname(c) === 'Mountain').length); check(h1 === 3, `three Mountains returned to hand (${h1})`);
      await clean(P2);
    });

    await step('#4b Reunion of the House (total power 10) and Behold the Sinister Six! (different names)', async () => {
      for (const n of ['Sun Titan', 'Elder Gargaroth', 'Grizzly Bears']) await toZone(A, n, 'gy');
      await A.evaluate(() => { window.__pick = 'Sun Titan|Elder Gargaroth|Grizzly'; window.__seen = []; });
      await toHand(A, 'Reunion of the House'); await cast(A, 'Reunion of the House', {W:7});
      check(await kimSees('^Reunion of the House → (?=.*Sun Titan)(?=.*Grizzly Bears)'), 'Kim sees Reunion targeting Sun Titan (6) and Grizzly Bears (2)');
      check(!(await stk(B)).some(x => /Reunion.*Gargaroth/.test(x)), 'Elder Gargaroth could not be added (6 + 6 = 12)');
      await settle(P2); await sleep(1500);
      check((await onBf(A, 'Elder Gargaroth|Sun Titan|Grizzly')).length === 2, 'the two targets returned');
      await clean(P2);
      for (const n of ['Memnite', 'Memnite', 'Ornithopter']) await toZone(A, n, 'gy');
      await A.evaluate(() => { window.__pick = 'Memnite|Ornithopter'; });
      await toHand(A, 'Behold the Sinister Six!'); await cast(A, 'Behold the Sinister Six!', {B:7});
      check(await kimSees('^Behold the Sinister Six! → (?=.*Memnite)(?=.*Ornithopter)'), 'Kim sees one Memnite and the Ornithopter targeted');
      check(!(await stk(B)).some(x => /Memnite.*Memnite/.test(x)), 'the second Memnite (same name) could not be added');
      await settle(P2); await sleep(1500);
      const r = await onBf(A, 'Memnite|Ornithopter'); check(r.length === 2, `one Memnite and the Ornithopter returned (${r})`);
      await clean(P2);
    });

    await step('#4d Goblin Welder: the artifact card is chosen from that player\'s graveyard on activation; the swap happens on their client', async () => {
      const sr = await putBf(B, 'Sol Ring'); await toZone(B, 'Mind Stone', 'gy'); await sleep(800);
      const w = await putBf(A, 'Goblin Welder'); await A.evaluate(() => { window.__pick = 'Sol Ring|Mind Stone'; window.__seen = []; });
      await A.evaluate(id => { const c = S.bf.find(x => x.id === id); c.sk = false; const ab = abilityList(c).find(a => /Choose target artifact/.test(a.eff)); activateAbility(c, ab); }, w);
      check(await kimSees("^Goblin Welder → Kim's Sol Ring, Kim's Mind Stone"), 'Kim sees both targets (her Sol Ring and the Mind Stone in her graveyard) on the stack');
      await quietResolve('Goblin Welder');
      check(await B.evaluate(() => S.bf.some(c => cname(c) === 'Mind Stone') && S.gy.some(c => cname(c) === 'Sol Ring')), 'on Kim\'s client: Sol Ring went to the graveyard and Mind Stone came back');
      await clean(P2);
    });

    await step("#1c Cloud's Limit Break (Blade Beam): tapped creatures with different controllers", async () => {
      const a1 = await putBf(A, 'Grizzly Bears', {tap:true}); const b1 = await putBf(B, 'Grizzly Bears', {tap:true}); const b2 = await putBf(B, 'Llanowar Elves', {tap:true}); await sleep(800);
      await A.evaluate(() => { window.__want = 'Blade Beam|any number of target tapped'; window.__seen = []; window.__pick = 'Grizzly|Llanowar'; });
      await toHand(A, "Cloud's Limit Break"); await cast(A, "Cloud's Limit Break", {W:3, R:3, G:3, U:3, B:3, C:3});
      await A.evaluate(() => { window.__pick = 'Grizzly|Llanowar'; });
      const ok = await waitFor(B, () => stackAll().some(i => /Cloud's Limit Break/.test(i.nm)), null, 15000);
      const st = (await stk(B)).find(x => /Cloud's Limit Break/.test(x)) || '';
      if (process.env.DBG) console.log(await seen(A, '.'), await logs(A, 10));
      check(ok && (st.match(/Kim's/g) || []).length === 1 && /→ Grizzly Bears/.test(st), `one tapped creature per controller is targeted (${st})`);
      await settle(P2); await sleep(1500);
      check(await A.evaluate(() => !S.bf.some(c => cname(c) === 'Grizzly Bears')) && (await B.evaluate(() => S.bf.filter(c => /Grizzly|Llanowar/.test(cname(c))).length)) === 1, 'both targets destroyed; Kim\'s other creature survives');
      await clean(P2);
    });

    for (let part = 0; process.env.SWEEP && part * 12 < SWEEP.length; part++) await step(`#4c sweep ${part + 1}: every card whose graveyard targets are now read correctly chooses them first and resolves without asking again`, async () => {
      const pool = ['Memnite', 'Grizzly Bears', 'Sol Ring', 'Swiftfoot Boots', 'Phyrexian Arena', 'Lightning Bolt', 'Divination', 'Mountain', 'Llanowar Elves'];
      for (const nm of SWEEP.slice(part * 12, part * 12 + 12).filter(n => !SWEEP_SKIP.test(n))){
        await clean(P2); for (const n of pool){ await toZone(A, n, 'gy'); await toZone(B, n, 'gy'); } await sleep(500);
        const r = await A.evaluate(async nm => {
          const a = [...DICT.values()].find(x => x.n === nm || (x.n || '').startsWith(nm + ' //')); if (!a) return {err:'missing'};
          const lines = tname(a.o, a.n).split('\n').filter(l => targetSpecs(l).some(s => 'p20q' in s || s.p20per || s.p20grp));
          if (!lines.length) return {err:'no fixed line'};
          let eff = lines[0].replace(/^•\s*/, '').replace(/^(?:[IVX, ]+ — )/, '').replace(/^[^.]*?—\s*(?=\S)/, m => /^\{|^[A-Z][a-z]+ —/.test(m) ? '' : m).replace(/^(?:When|Whenever|At)\b[^,]*, /, '').replace(/^[^:"]*: /, '');
          eff = eff.charAt(0).toUpperCase() + eff.slice(1);
          window.__pick = '.'; window.__want = 'Yes|Return|Pay|Cast|Do it'; window.__seen = []; UI.lastX = 2;
          const src = {pid:MYPID, col:a.c, types:a.t, id:-99};
          const tg = await chooseTargets(eff, src, a.n); const g0 = S.gy.map(c => c.id).join(','); const o0 = (OPP.get([...OPP.keys()][0]).gy || []).length;
          const it = pushTrig(a.n, eff, {k:a.k, tgts:tg, tgtNm:tgtLabel(tg).slice(0, 118), x:2});
          return {eff, tg:tgtLabel(tg), n0:window.__seen.length, g0, o0};
        }, nm);
        if (r.err){ console.log(`    ${nm}: ${r.err}`); continue; }
        await settle(P2); await sleep(1200);
        const after = await A.evaluate(([n0, g0, o0]) => ({asked:window.__seen.slice(n0), moved:S.gy.map(c => c.id).join(',') !== g0, omoved:(OPP.get([...OPP.keys()][0]).gy || []).length !== o0, warn:S.log.slice(-6).filter(e => /do by hand/.test(e.s)).map(e => e.s)}), [r.n0, r.g0, r.o0]);
        const ok = r.tg && (after.moved || after.omoved) && !after.warn.length && !after.asked.some(t => /choose|return|exile|which/i.test(t) && !/^(?:You may|Pay|Cast)/i.test(t.split(': ')[1] || t));
        check(ok, `${nm}: targets ${r.tg || 'NONE'}; graveyard changed ${after.moved || after.omoved}; asked on resolution: ${JSON.stringify(after.asked)}${after.warn.length ? ' WARN ' + after.warn : ''}`);
      }
      await clean(P2);
    });

    for (const p of P2) await p.context().close();
    /* ================= 3 players ================= */
    if (!process.env.ONLY || /3p/.test(process.env.ONLY)){
      const names = ['Georges', 'Kim', 'Ana']; const P = [];
      for (let i = 0; i < 3; i++){ P.push(await H.player(browser, names[i], H.deckFor(['Edgar Markov', 'Thalia, Guardian of Thraben', 'Krenko, Mob Boss'][i]), i ? 'join' : 'host', 'r20a3')); await sleep(300); }
      for (const p of P) await waitFor(p, () => OPP.size === 2, null, 30000);
      ALL = names.map((n, i) => [n, P[i]]); const [G, K, N] = P; for (const p of P) await p.evaluate(AUTO);
      await G.click('[data-act="goFirst"]'); await settle(P); await toMain(G, P);
      const sees = (p, re, ms = 10000) => waitFor(p, re => stackAll().some(i => new RegExp(re).test(i.nm + ' → ' + (i.tgtNm || ''))), re, ms);
      await step('#2a3p Sepulchral Primordial with two opponents: one target in each graveyard, chosen on the trigger', async () => {
        await toZone(K, 'Grizzly Bears', 'gy'); await toZone(N, 'Llanowar Elves', 'gy'); await toZone(N, 'Memnite', 'gy'); await sleep(900);
        await G.evaluate(() => { window.__pick = 'Grizzly|Llanowar'; window.__seen = []; });
        const id = await toHand(G, 'Sepulchral Primordial'); await G.evaluate(id => { moveCard(id, 'bf'); commit(); }, id);
        check(await sees(N, "^Sepulchral Primordial → (?=.*Kim's Grizzly Bears)(?=.*Ana's Llanowar Elves)"), 'Ana sees one target from Kim\'s graveyard and one from hers');
        const t = await seen(G, 'Sepulchral'); check(t.length === 2 && /Kim's/.test(t[0]) && /Ana's/.test(t[1]), `Georges was asked once per opponent (${t.join(' / ')})`);
        await settle(P); await sleep(2500);
        check(await G.evaluate(() => S.bf.some(c => cname(c) === 'Grizzly Bears') && S.bf.some(c => cname(c) === 'Llanowar Elves')), 'Georges gets both');
        check(await N.evaluate(() => S.gy.some(c => cname(c) === 'Memnite') && !S.gy.some(c => cname(c) === 'Llanowar Elves')), 'Ana keeps Memnite; Llanowar Elves left her graveyard');
      });
    }
  } catch (e){ console.log('FATAL', e.message); check(false, 'test ran'); }
  console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`);
  await browser.close(); server.close(); process.exit(H.fails() ? 1 : 0);
})();
