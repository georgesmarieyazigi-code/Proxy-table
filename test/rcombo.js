// rcombo: infinite combos and "draw your deck, win" lines, played through the real engine in a 2-player game (Georges vs Kim).
// Each loop is done once by hand-equivalent actions while the table records it, then "Repeat the loop" runs it N times.
// PTPORT=19600 PTFILE=dev.html node rcombo.js      (ONLY=<prefix>[,<prefix>] runs some steps; LOGS=1 prints logs)
process.env.TOP = '1';
const CC = require('./cards');
const WANT = ["Thassa's Oracle", 'Demonic Consultation', 'Tainted Pact', 'Laboratory Maniac', 'Jace, Wielder of Mysteries', 'Ad Nauseam', 'Hermit Druid', 'Underworld Breach', "Lion's Eye Diamond", 'Brain Freeze',
  'Kinnan, Bonder Prodigy', 'Basalt Monolith', 'Rings of Brighthearth', 'Grim Monolith', 'Devoted Druid', 'Freed from the Real', "Pemmin's Aura", 'Bloom Tender', 'Isochron Scepter', 'Dramatic Reversal', 'Sol Ring', 'Mana Vault',
  'Sanguine Bond', 'Exquisite Blood', 'Vito, Thorn of the Dusk Rose', 'Bloodthirsty Conqueror', 'Blood Artist', 'Zulaport Cutthroat', 'Gravecrawler', 'Phyrexian Altar', "Ashnod's Altar", 'Viscera Seer',
  'Reveillark', 'Karmic Guide', 'Solemnity', 'Mikaeus, the Unhallowed', 'Triskelion', 'Murderous Redcap', 'Animate Dead', 'Worldgorger Dragon', 'Walking Ballista', 'Heliod, Sun-Crowned',
  'Kiki-Jiki, Mirror Breaker', 'Zealous Conscripts', 'Splinter Twin', 'Dualcaster Mage', 'Twinflame', 'Food Chain', 'Eternal Scourge', 'Edgar Markov', 'Island', 'Swamp', 'Forest', 'Plains', 'Mountain', 'Grizzly Bears', 'Llanowar Elves', 'Gilded Lotus', 'Hullbreaker Horror', 'Ornithopter', 'Necropotence'];
WANT.push(...['Pitiless Plunderer', 'Reassembling Skeleton', 'Enduring Tenacity', 'Marauding Blight-Priest', 'Starscape Cleric', 'Peregrin Took', 'Nuka-Cola Vending Machine', 'Experimental Confectioner', 'Sheoldred, the Apocalypse', 'Peer into the Abyss', 'Niv-Mizzet, Parun', 'Ophidian Eye', 'Chatterfang, Squirrel General', 'Warren Soultrader', 'Squee, the Immortal', 'Staff of Domination', 'Marwyn, the Nurturer', 'Selvala, Heart of the Wilds', 'Scurry Oak', 'Rosie Cotton of South Lane', 'Ghostly Flicker', 'Peregrine Drake', 'Archaeomancer', 'Ayara, First of Locthwain', "Sensei's Divining Top", 'Etherium Sculptor', 'Mystic Forge', 'Carrion Feeder', 'Rooftop Storm', "Hazel's Brewmaster", 'Sprout Swarm', 'Witherbloom, the Balancer', 'Peregrine Drake'].filter(n => !WANT.includes(n)));   // helper A (top_a)
WANT.push(...['Chatterfang, Squirrel General', 'Dakmor Salvage', 'The Gitrog Monster', 'Curiosity', 'Niv-Mizzet, Parun', 'Bloodchief Ascension', 'Mindcrank', 'Aetherflux Reservoir', "Sensei's Divining Top", "Bolas's Citadel", 'Niv-Mizzet, Visionary', 'The Reaver Cleaver', 'Aggravated Assault', 'Flourishing Defenses', 'Blowfly Infestation', 'Psychosis Crawler', 'Teferi, Time Raveler', 'Displacer Kitten', 'Carrion Feeder', 'Blasphemous Act', 'Repercussion', 'Staff of Domination', 'Priest of Titania', 'Maddening Cacophony', 'Bruvac the Grandiloquent', 'Nest of Scarabs', 'Basking Broodscale', 'Rosie Cotton of South Lane', 'Elvish Archdruid', 'Saw in Half', 'Peer into the Abyss', 'Reiterate', 'Mana Geyser', 'Witherbloom Apprentice', 'Chain of Smog', 'Circle of Dreams Druid', 'Tidespout Tyrant', 'Storm-Kiln Artist', 'Haze of Rage', 'Swift Reconfiguration', 'Savvy Hunter', 'Ygra, Eater of All', 'Niv-Mizzet, the Firemind', 'Combat Celebrant', 'Helm of the Host', 'Apex Altisaur', 'Wrathful Raptors', "Akroma's Will", 'Enduring Vitality', 'Emiel the Blessed', 'Singularity Rupture', 'Polyraptor', 'Marauding Raptor', 'Duskmantle Guildmage', 'Neheb, the Eternal', 'Yawgmoth, Thran Physician', 'Pawn of Ulamog', 'Camellia, the Seedmiser', 'Mana Crypt'].filter(n => !WANT.includes(n)));   // helper C
// helper B (slice_b top combos)
WANT.push(...["Exquisite Blood", "Wheel of Fortune", "Jeska's Will", "Forsaken Monument", "Frantic Search", "Narset's Reversal", "Fire Lord Azula", "Sensei's Divining Top", "Foundry Inspector", "Mystic Forge", "Restoration Angel", "Felidar Guardian", "Molten Duplication", "Warren Soultrader", "Hapatra, Vizier of Poisons", "Blowfly Infestation", "Orcish Bowmasters", "Peer into the Abyss", "Grinding Station", "Pitiless Plunderer", "Reiterate", "Cloud Key", "Skirk Prospector", "Goblin Warchief", "Krenko, Mob Boss", "Tandem Lookout", "Niv-Mizzet, Parun", "Springheart Nantuko", "Nissa, Resurgent Animist", "Aurelia, the Warleader", "Helm of the Host", "Goblin Chieftain", "Academy Manufactor", "Chatterfang, Squirrel General", "Hardened Scales", "Gatta and Luzzu", "Forsaken Miner", "Scurry Oak", "Ivy Lane Denizen", "Ashaya, Soul of the Wild", "Quirion Ranger", "Electroduplicate", "Bastion of Remembrance", "Teferi, Time Raveler", "Displacer Kitten", "Heat Shimmer", "Peregrin Took", "Cathars' Crusade", "Sephiroth, Fabled SOLDIER", "Bolas's Citadel", "Sheoldred, the Apocalypse", "Godo, Bandit Warlord", "Glaring Fleshraker", "Jhoira's Familiar", "The Gitrog Monster", "The Necrobloom", "Aggravated Assault", "Old Gnawbone", "Yawgmoth, Thran Physician", "Pawn of Ulamog", "Reassembling Skeleton", "Mox Opal"].filter(n => !WANT.includes(n)));
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
CC.cards.push(...CC.topCards('all.json').filter(c => /^Sephiroth, Fabled SOLDIER \/\//.test(c.name) && !CC.cards.some(x => x.name === c.name)));   // helper B: a DFC is listed by its front name
// cards the offline pool doesn't have — Scryfall-shaped, oracle text as printed
const mk = (id, name, cost, cmc, type, text, colors, p, t) => ({object:'card', id:'id-cmb-' + id, name, mana_cost:cost, cmc, type_line:type, oracle_text:text, colors, color_identity:colors, keywords:[], layout:'normal', set:'tst', collector_number:String(900 + cmc), set_name:'Test', released_at:'2010-01-01', ...(p != null ? {power:String(p), toughness:String(t)} : {}), prices:{usd:'1'}});
CC.cards.push(
  mk('pa', 'Power Artifact', '{U}{U}', 2, 'Enchantment — Aura', "Enchant artifact\nEnchanted artifact's activated abilities cost {2} less to activate. This effect can't reduce the mana in that cost to less than one mana.", ['U']),
  mk('vr', 'Vizier of Remedies', '{1}{W}', 2, 'Creature — Human Cleric', 'If one or more -1/-1 counters would be put on a creature you control, that many -1/-1 counters minus one are put on it instead.', ['W'], 2, 1),
  mk('kf', 'Kitchen Finks', '{1}{G/W}{G/W}', 3, 'Creature — Ouphe', "When Kitchen Finks enters, you gain 2 life.\nPersist (When this creature dies, if it had no -1/-1 counters on it, return it to the battlefield under its owner's control with a -1/-1 counter on it.)", ['G', 'W'], 3, 2),
  mk('me', 'Melira, Sylvok Outcast', '{1}{G}', 2, 'Legendary Creature — Human Scout', "You can't get poison counters.\nCreatures you control can't have -1/-1 counters put on them.\nCreatures your opponents control lose infect.", ['G'], 2, 2),
  mk('pm', 'Pestermite', '{2}{U}', 3, 'Creature — Faerie Rogue', 'Flash\nFlying\nWhen Pestermite enters, you may tap or untap target permanent.', ['U'], 2, 1),
  ...(CC.cards.some(x => x.name === 'Hullbreaker Horror') ? [] : [mk('hh', 'Hullbreaker Horror', '{5}{U}{U}', 7, 'Creature — Kraken Horror', "Flash\nThis spell can't be countered.\nWhenever you cast a spell, choose up to one —\n• Return target spell you don't control to its owner's hand.\n• Return target nonland permanent to its owner's hand.", ['U'], 7, 8)]),
  ...(CC.cards.some(x => x.name === 'Ornithopter') ? [] : [mk('or', 'Ornithopter', '{0}', 0, 'Artifact Creature — Thopter', 'Flying', [], 0, 2)]),
  mk('de', 'Deceiver Exarch', '{2}{U}', 3, 'Creature — Phyrexian Cleric', 'Flash\nWhen Deceiver Exarch enters, choose one —\n• Untap target permanent you control.\n• Tap target permanent an opponent controls.', ['U'], 1, 4),
);
CC.cards.push(...[   // helper C
  mk('mc', 'Mana Crypt', '{0}', 0, 'Artifact', "At the beginning of your upkeep, flip a coin. If you lose the flip, this artifact deals 3 damage to you.\n{T}: Add {C}{C}.", []),
].filter(c => !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, waitFor} = H;
const DECK = 'Commander\n1 Edgar Markov\n\nDeck\n' + WANT.filter(n => !['Edgar Markov', 'Island', 'Swamp', 'Forest', 'Plains', 'Mountain'].includes(n)).map(n => '1 ' + n).join('\n') +
  '\n1 Power Artifact\n1 Vizier of Remedies\n1 Kitchen Finks\n1 Melira, Sylvok Outcast\n1 Pestermite\n1 Deceiver Exarch\n6 Island\n6 Swamp\n6 Forest\n4 Plains\n4 Mountain\n';
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }).catch(() => {}); await sleep(150); } };
// answers dialogs: window.__want (regex for a choice label), __tgt ('opp' | 'kim' | 'me' | regex on the name), __X (numbers), __pick (how many cards), __name (card name to name)
const AUTO = () => { setInterval(() => { const m = UI.modal; if (!m || m.__done || window.__noauto) return; if (window.__noautoAfterLoop && typeof F25L !== 'undefined' && f25lActive() && (F25L.last[f25lKey(m.title)] || !S.lib.length)) return;   // let the loop autopilot answer what it knows (window.__titles = window.__titles || []).push(m.title || m.type);
  try {
    if (m.type === 'pick' && m.resolve){ const want = window.__pick ?? 1; const n = Math.max(m.min || 0, Math.min(want, m.max ?? 1)); const w = window.__pickRe ? new RegExp(window.__pickRe, 'i') : null; const cs = (m.cards || []).slice().sort((a, b) => (w ? (w.test(cname(b)) ? 1 : 0) - (w.test(cname(a)) ? 1 : 0) : 0)); m.__done = 1; m.resolve(cs.slice(0, n).map(c => c.id)); closeModal(); }
    else if (m.type === 'choice' && m.resolve){
      if (m.f19s && window.__name){ m.__done = 1; const el = document.getElementById('f19nq'); if (el){ el.value = window.__name; el.dispatchEvent(new Event('input', {bubbles:true})); }
        setTimeout(() => { const w = new RegExp(window.__name, 'i'); const o = (m.options || []).find(x => w.test(x.label)); m.onClose = null; closeModal(); m.resolve(o ? o.value : null); }, 1200); return; }
      const ws = [].concat(window.__wantQ && window.__wantQ.length ? [window.__wantQ[0]] : [], window.__want || []).map(x => new RegExp(x, 'i'));
      const os = (m.options || []).filter(x => !x.disabled); let o = null; for (const w of ws){ o = os.find(x => w.test(x.label)); if (o) break; }
      if (o && window.__wantQ && window.__wantQ.length && new RegExp(window.__wantQ[0], 'i').test(o.label)) window.__wantQ.shift();
      o = o || os[0]; (window.__chosen = window.__chosen || []).push((m.title || '') + ' → ' + (o ? o.label : 'none')); m.__done = 1; m.resolve(o ? o.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ const t = window.__tgtQ && window.__tgtQ.length ? window.__tgtQ.shift() : (window.__tgt || 'opp'); const ok = (m.cands || []).filter(c => c.ok !== false);
      const pick = t === 'opp' ? ok.find(c => c.t === 'player' && c.pid !== MYPID) || ok.find(c => c.pid && c.pid !== MYPID) : t === 'kim' ? ok.find(c => c.t === 'player' && c.pid !== MYPID) : t === 'me' ? ok.find(c => c.pid === MYPID && c.t !== 'player') : t === 'self' ? ok.find(c => c.t === 'player' && c.pid === MYPID) : ok.find(c => new RegExp(t, 'i').test(c.nm || c.label || ''));
      const n = (m.spec && m.spec.n) || 1; const sel = pick ? [pick] : []; m.__done = 1; (window.__tgts = window.__tgts || []).push((m.title || '') + ' → ' + (pick ? pick.nm || pick.label : 'none')); m.resolve(sel.slice(0, n)); closeModal(); }
    else if (m.type === 'ask' && m.run){ (window.__asks = window.__asks || []).push(m.title); m.__done = 1; m.run(window.__XQ && window.__XQ.length ? window.__XQ.shift() : (window.__X ?? m.def ?? 1)); closeModal(); }
    else if (m.type === 'zone'){ m.__done = 1; closeModal(); }
    else if (m.run){ (window.__asks = window.__asks || []).push(m.title); m.__done = 1; m.run(window.__X ?? m.def ?? 1); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 100);
  setInterval(() => { try { if (S && S.prm && S.prm.length && !UI.modal){ const p = S.prm[0]; if (p.type === 'discard' || p.type === 'sac'){ const pool = p.type === 'sac' ? S.bf.filter(c => !c.fd) : S.hand.slice(); finishChoice(p, pool.slice(0, p.n).map(c => c.id)); } } } catch {} }, 400); };
const settle = async (ps) => { for (let i = 0; i < 60; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), ms))]);
let PA = null, PB = null;
const step = async (name, fn) => { if (process.env.ONLY && !process.env.ONLY.split(',').some(o => name.startsWith(o + ' '))) return; console.log('— ' + name); const f0 = H.fails();
  try { await T(240000, fn()); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if ((H.fails() > f0 || process.env.LOGS) && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, await p.evaluate(() => S.log.slice(-22).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title}) + ' titles=' + JSON.stringify((window.__titles || []).slice(-8)) + ' notes=' + JSON.stringify((UI.notes || []).map(n => n.text)) + ' life=' + S.life + ' stk=' + JSON.stringify(stackAll().map(i => i.nm)) + ' res=' + !!UI.resolving + ' pass=' + S.pass + ' key=' + prioKey()).catch(e => e.message)); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', DECK, 'host', 'rcombo');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'rcombo');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const after = async () => { await sleep(400); await settle([A, B]); await sleep(900); await settle([A, B]); await sleep(300); };
  // a fresh board for each combo: no nonland permanents, empty pool, everyone at 40, the right phase, my turn
  const fresh = async () => {
    for (const p of [A, B]) await p.evaluate(() => { UI.notes = []; window.__f25twice = !window.__early; if (typeof F25 !== 'undefined') F25.kAsk = {}; for (const k of ['__asks', '__titles', '__want', '__wantQ', '__pick', '__pickRe', '__tgt', '__tgtQ', '__X', '__XQ', '__name', '__chosen', '__tgts']) window[k] = null;
      stopRecording && stopRecording(); UI.recDone = null;
      S.bf.filter(c => !isLand(c.k) || c.tok).forEach(c => { if (c.tok) S.bf.splice(S.bf.indexOf(c), 1); else moveCard(c.id, 'lib', {quiet:true}); });
      for (const z of ['hand', 'gy', 'ex']) [...S[z]].forEach(c => moveCard(c.id, 'lib', {quiet:true}));
      S.bf.forEach(c => { c.tap = false; c.cp = 0; c.cm = 0; c.co = 0; c.dmg = 0; }); S.stk.forEach(it => { if (it.card && !it.card.tok && !S.lib.some(x => x.id === it.card.id)) S.lib.push(it.card); }); S.stk = []; S.dly = []; S.pool = emptyPool(); S.life = 40; delete S.lost; delete S.g23lost; delete S.b27lost; commit(); });
    await A.evaluate(() => { if (phaseNow().ph !== 3) setPhase(3); commit(); }); await sleep(800); await settle([A, B]);
  };
  const putP = (p, nm, o = {}) => p.evaluate(([nm, o]) => { for (const z of ['lib', 'hand', 'gy', 'ex']){ const c = S[z].find(x => cname(x) === nm); if (c){ if (o.cp != null) c.cp = o.cp; moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id); if (b){ b.sk = !!o.sick; b.tap = !!o.tap; if (o.cp != null) b.cp = o.cp; } commit(); return c.id; } } const where = []; for (const [z, v] of Object.entries(S)) if (Array.isArray(v) && v.some(x => x && (cname(x) === nm || (x.card && cname(x.card) === nm)))) where.push(z); console.error('PUTP-MISS ' + nm + ' in ' + JSON.stringify(where) + ' stk=' + JSON.stringify(S.stk.map(i => i.nm))); return null; }, [nm, o]);
  const toZone = (p, nm, z) => p.evaluate(([nm, z]) => { for (const y of ['lib', 'hand', 'gy', 'ex', 'bf']){ const c = S[y].find(x => cname(x) === nm); if (c){ if (y !== z) moveCard(c.id, z, {quiet:true}); commit(); return c.id; } } return null; }, [nm, z]);
  const pool = (p, o) => p.evaluate(o => { S.pool = {...emptyPool(), ...o}; commit(); }, o);
  const poolOf = p => p.evaluate(() => ({...S.pool}));
  // activate the ability of a card on my battlefield whose text matches re
  const act = (p, nm, re, ch = 0) => p.evaluate(async ([nm, re, ch]) => { const c = S.bf.find(x => cname(x) === nm && !x.fd); if (!c) return 'no ' + nm; const w = new RegExp(re, 'i');
    const mab = manaAbs(c).find(a => w.test(a.line || a.txt || '')); if (mab){ const r = abilityReady(c, mab, true); if (r) return nm + ': ' + r; await activateMana(c, mab, ch); return 'mana'; }
    const ab = abilityList(c).find(a => w.test(a.line || ((a.cost || '') + ': ' + (a.eff || '')))); if (!ab) return nm + ': no ability ' + re + ' in ' + JSON.stringify(abilityList(c).map(a => a.line)); const r = abilityReady(c, ab, false); if (r && r !== 'Summoning sick') return nm + ': ' + r; activateAbility(c, ab); return 'ok'; }, [nm, re, ch]);
  const castH = (p, nm, o = {}) => p.evaluate(([nm, o]) => { const c = S.hand.find(x => cname(x) === nm) || S.gy.find(x => cname(x) === nm && o.gy); if (!c) return 'not in hand: ' + nm; beginCast(c, S.hand.includes(c) ? 'hand' : 'gy', o); return 'ok'; }, [nm, o]);
  const rec = p => p.evaluate(() => startRecording());
  const repeat = async (p, n) => { await p.evaluate(n => { window.__wantQ = ['number of times']; window.__XQ = [n]; askRepeat(); }, n); await sleep(800); await after();
    return await waitFor(p, n => S.log.some(e => /repeated the loop/.test(e.s)), n, 120000) && await p.evaluate(() => (S.log.filter(e => /repeated the loop/.test(e.s)).pop() || {}).s); };
  const repeatDead = async (p) => { await p.evaluate(() => { window.__wantQ = ['every opponent is dead']; askRepeat(); }); await sleep(800); await after();
    return await waitFor(p, () => S.log.some(e => /repeated the loop/.test(e.s)), null, 180000) && await p.evaluate(() => (S.log.filter(e => /repeated the loop/.test(e.s)).pop() || {}).s); };
  const life = p => p.evaluate(() => S.life);
  const lost = p => p.evaluate(() => !!(S.lost || S.g23lost || S.b27lost || S.j18out));
  const won = p => p.evaluate(() => S.log.some(e => /wins the game|win the game/i.test(e.s)));
  const notes = async () => [...(await A.evaluate(() => (UI.notes || []).map(x => x.name + ': ' + x.text))), ...(await B.evaluate(() => (UI.notes || []).map(x => 'Kim ' + x.name + ': ' + x.text)))];
  const noNotes = async (what) => { const n = await notes(); check(!n.length, `${what}: nothing to do by hand (${JSON.stringify(n)})`); };
  const asks = async () => (await A.evaluate(() => window.__asks || [])).filter(t => !/Repeat how many|number of times/i.test(t));
  const libN = p => p.evaluate(() => S.lib.length);
  const cnt = (p, nm, z = 'bf') => p.evaluate(([nm, z]) => S[z].filter(c => cname(c) === nm).reduce((a, c) => a + (c.n || 1), 0), [nm, z]);
  const ctx = {A, B, check, sleep, waitFor, after, fresh, putP, toZone, pool, poolOf, act, castH, rec, repeat, repeatDead, life, lost, won, notes, noNotes, asks, libN, cnt, step, settle};
  try {
    for (const f of (process.env.CGROUPS || 'thassa,mana,drain,recursion,ballista').split(',')){ const g = require('./combos/' + f.trim() + '.js'); await g(ctx); }
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); H.aedes.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
