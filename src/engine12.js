/* ===================== Rules engine — round 12: more of the most-played cards ===================== */

/* ---------- Triggers ---------- */
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){
    let m;
    if ((m = c.match(/^enchanted creature deals (?:combat )?damage(?: to an opponent| to a player)?$/))) return {ev:/combat/.test(c) ? 'cdmg' : 'dmg', evs:['dmg', 'cdmg'], subj:'any', ctl:'any', desc:'', enchantedBy:true, toOpp:/opponent/.test(c)};
    if ((m = c.match(/^an opponent discards a card$/))) return {ev:'discard', subj:'any', ctl:'opp', desc:''};
    if ((m = c.match(/^a player sacrifices a permanent$/))) return {ev:'sac', subj:'any', ctl:'any', desc:''};
    if ((m = c.match(/^(?:you|a player) taps? (?:a|an) (land|swamp|island|forest|mountain|plains|nonland permanent) for mana$/))) return {ev:'manatap', subj:'any', ctl:/^you/.test(c) ? 'you' : 'any', desc:m[1]};
    if ((m = c.match(/^an opponent plays a land$/))) return {ev:'land', subj:'any', ctl:'opp', desc:''};
    if ((m = c.match(/^you put one or more \+1\/\+1 counters on a creature you control$/))) return {ev:'ctrp', subj:'any', ctl:'you', desc:'creature'};
    if ((m = c.match(/^~ becomes level (\d+)$/))) return {ev:'level', subj:'self', ctl:'you', desc:'', lvl:+m[1]};
    if ((m = c.match(/^enchanted permanent dies or is put into exile$/))) return {ev:'leave', subj:'any', ctl:'any', desc:'', enchantedBy:true};
    if ((m = c.match(/^a card is put into an opponent's graveyard from anywhere$/))) return {ev:'togy', subj:'any', ctl:'opp', desc:''};
    return ct(w, c);
  };
  EV_TYPES.push('manatap', 'ctrp', 'level');
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    if (t && ev){ if (t.ev === 'level' && ev.type === 'level' && ev.x !== t.lvl) return; if (t.toOpp && (!ev.dp || ev.dp === evPid)) return; if (t.ev === 'manatap' && t.desc && ev.k && !descOk(ev.k, t.desc)) return; }
    return pt(src, t, ev, evPid);
  };
  const sm = subjMatch;
  subjMatch = function(t, src, ev, pid){ if (['manatap', 'ctrp', 'level'].includes(ev.type)){ if (t.ctl === 'you' && pid !== MYPID) return false; if (t.ctl === 'opp' && pid === MYPID) return false; if (ev.type === 'level') return ev.id === src.id; return true; } return sm(t, src, ev, pid); };
  // emit: tapping for mana, putting +1/+1 counters, reaching a level
  const am = activateMana;
  activateMana = async function(c, ab, ch){ const r = await am(c, ab, ch); if (r === false) return r; try { if (c && !UI.dry) emit({type:'manatap', k:c.k, id:c.id, cnt:1}); } catch {} return r; };
  const mc = modCounters;
  modCounters = function(c, kind, n, putter, owner){ const r = mc(c, kind, n, putter, owner); try { if (kind === 'cp' && r > 0 && S && S.bf.includes(c) && isCreatureCard(c) && (putter == null || putter === MYPID)) emit({type:'ctrp', k:c.k, id:c.id, cnt:1, amt:r}); } catch {} return r; };
}
// the level-up sentence announces itself
{
  const r11 = doRound11Pre;
  doRound11Pre = async function(s, l, ctx){ const m = l.match(/^level (\d+)$/); if (m){ const c = srcCardOf(ctx); if (c){ c.lvl = +m[1]; log(`${cname(c)} is now level ${m[1]}`); emit({type:'level', k:c.k, id:c.id, x:+m[1], cnt:1}); commit(); } return true; } return r11(s, l, ctx); };
}
// “its controller adds an additional …” when an enchanted land is tapped (Wild Growth, Utopia Sprawl) and Crypt Ghast-style
{
  const am = activateMana;
  activateMana = async function(c, ab, ch){
    const r = await am(c, ab, ch); if (r === false) return r;   // the land's own cost failed (already tapped, cancelled): no extra mana
    try { if (c && isLand(c.k) && !UI.dry){
      for (const b of S.bf){ if (!b.att || b.att.id !== c.id || b.att.pid !== MYPID) continue; const o = tname(info(b.k)?.o || '', info(b.k)?.n); const mm = o.match(/^whenever enchanted (?:land|forest) is tapped for mana, its controller adds an additional (\{[wubrgc]\}|one mana of the chosen color|one mana of any color)/im); if (mm){ const col = /^\{/.test(mm[1]) ? mm[1][1].toUpperCase() : (b.col || 'G'); addMana([col]); log(`${cname(b)}: +{${col}}`); } }
      for (const b of S.bf){ const o = tname(info(b.k)?.o || '', info(b.k)?.n); const mm = o.match(/^whenever you tap an? (swamp|island|forest|mountain|plains) for mana, add an additional (\{[wubrgc]\})/im); if (mm && new RegExp('\\b' + mm[1] + '\\b', 'i').test(info(c.k)?.t || '')) addMana([mm[2][1].toUpperCase()]); const m2 = o.match(/^whenever (?:you tap a land|a player taps a land) for mana, (?:that player )?adds? one mana of any type that land produced/im); if (m2 && ab && ab.outs && ab.outs[0]) addMana([ab.outs[0][0]]); }
      for (const [, st] of OPP) for (const b of (st.bf || [])){ if (!b.k) continue; const o = info(b.k)?.o || ''; if (/whenever a player taps a land for mana, that player adds one mana of any type that land produced/i.test(o) && ab && ab.outs && ab.outs[0]) addMana([ab.outs[0][0]]); }
      commit(); } } catch (e){ console.warn(e); }
    return r;
  };
}

/* ---------- Effects ---------- */
async function doRound12Pre(s, l, ctx){
  let m; const src = () => srcCardOf(ctx); const say = t => doSentence(cap(t), ctx);
  if (/^then /.test(l)){ const r = await doRound12Pre(s.slice(5), l.slice(5), ctx); if (r) return true; }
  const tgt = () => (ctx.tgts ? nextTargets(ctx) : [])[0];
  // pump with X, trample
  if ((m = l.match(/^target creature gets \+(x|\d+)\/\+(0|x|\d+) and gains (.+?) until end of turn$/))){ const x = ctx.it && ctx.it.x || 0; const p = m[1] === 'x' ? x : +m[1], tt = m[2] === 'x' ? x : +m[2]; const t = tgt(); if (t) applyTo(t, {op:'pump', src:ctx.name, f:{p, t:tt, kw:m[3].split(/,\s*(?:and\s+)?|\s+and\s+/)}}); return true; }
  if ((m = l.match(/^until end of turn, creatures you control gain (.+?) and get \+(\d+)\/\+(\d+)$/))){ await say(`Creatures you control get +${m[2]}/+${m[3]} and gain ${m[1]} until end of turn`); return true; }
  if ((m = l.match(/^each creature you control with power (\d+) or greater gets \+(\d+)\/\+(\d+)(?: and gains (.+?))? until end of turn$/))){ S.bf.filter(c => isCreatureCard(c) && stats(c)[0] >= +m[1]).forEach(c => { c.pu = [(c.pu ? c.pu[0] : 0) + +m[2], (c.pu ? c.pu[1] : 0) + +m[3]]; if (m[4]) c.ekw = [...new Set([...(c.ekw || []), ...m[4].split(/\s+and\s+/)])]; }); commit(); return true; }
  if ((m = l.match(/^(?:target legendary creature|target creature) gains (.+?) until end of turn$/))){ const t = tgt(); if (t) applyTo(t, {op:'pump', src:ctx.name, f:{p:0, t:0, kw:m[1].split(/,\s*(?:and\s+)?|\s+and\s+/)}}); return true; }
  if ((m = l.match(/^(?:(?:it|target creature)(?: with power (\d+) or less)?) can't be blocked this turn$/))){ const t = tgt(); const c = !t && src(); if (t) applyTo(t, {op:'pump', src:ctx.name, f:{p:0, t:0, kw:['unblockable']}}); else if (c){ c.ekw = [...new Set([...(c.ekw || []), 'unblockable'])]; commit(); } return true; }
  if ((m = l.match(/^creatures your opponents control attack this turn if able$/))){ handWarn('Creatures your opponents control attack this turn if able', ctx); return true; }
  // mass -N/-N on each creature
  if ((m = l.match(/^each creature gets -(\d+)\/-(\d+) until end of turn$/))){ await say(`All creatures get -${m[1]}/-${m[2]} until end of turn`); return true; }
  // conditional mana
  if ((m = l.match(/^add (\{[^}]+\}(?:\{[^}]+\})*) instead if there are (\w+) or more cards in your graveyard$/))) return true;
  if ((m = l.match(/^add (\{[^}]+\}(?:\{[^}]+\})*)$/)) && /instead if there are (\w+) or more cards in your graveyard/i.test(String(ctx.full || ''))){ const mm = String(ctx.full).match(/add ((?:\{[^}]+\})+) instead if there are (\w+) or more cards in your graveyard/i); const big = mm && S.gy.length >= (wn(mm[2].toLowerCase()) || 7); const sym = (big ? mm[1] : m[1]).match(/\{([^}]+)\}/g).map(x => x.slice(1, -1).toUpperCase()); addMana(sym); log(`added ${sym.map(x => '{' + x + '}').join('')}`); commit(); return true; }
  // living death and friends
  if ((m = l.match(/^each player exiles all creature cards from their graveyard, then sacrifices all creatures they control, then puts all cards they exiled this way onto the battlefield$/))){ const ex = S.gy.filter(c => isCreatureCard(c)); ex.forEach(c => moveCard(c.id, 'ex')); S.bf.filter(c => isCreatureCard(c)).forEach(c => moveCard(c.id, 'gy', {sac:true})); ex.forEach(c => moveCard(c.id, 'bf')); opponents().forEach(p => sendRq(p.pid, 'livingDeath', 0, ctx.name)); commit(); return true; }
  if ((m = l.match(/^each player sacrifices thirteen creatures of their choice$/))){ S.bf.filter(c => isCreatureCard(c)).slice(0, 13).forEach(c => moveCard(c.id, 'gy', {sac:true})); opponents().forEach(p => sendRq(p.pid, 'wipe', 0, ctx.name, {f:{types:'Creature'}})); handWarn('Each other player sacrifices up to thirteen creatures (all of them, usually)', ctx); commit(); return true; }
  // damage equal to power
  if ((m = l.match(/^~ deals damage equal to that creature's power to any target$/))){ const c = ctx.it && S.bf.find(x => x.id === ctx.it.evId); const n = c ? Math.max(0, stats(c)[0]) : 0; const t = tgt(); if (t && n) dealDamage(t, n, ctx.k, src()); return true; }
  if ((m = l.match(/^target creature you control deals damage equal to its power to each other creature$/))){ const t = tgt(); const c = t && S.bf.find(x => x.id === t.id); if (!c) return true; const n = Math.max(0, stats(c)[0]); ctx.dmgN = n; S.bf.filter(x => x !== c && isCreatureCard(x)).forEach(x => damageCard(x, n, {})); for (const [pid, st] of OPP) (st.bf || []).forEach(x => { if (x.k && isCreatureCard(x)) dealDamage({t:'card', pid, id:x.id, k:x.k}, n, c.k, c); }); return true; }
  if ((m = l.match(/^(?:and )?each opponent$/)) && ctx.dmgN){ opponents().forEach(p => dealDamage({t:'player', pid:p.pid}, ctx.dmgN, ctx.k, src())); return true; }
  // tokens: one per opponent, attacking them
  if ((m = l.match(/^for each opponent, create an? (.+?) token that's tapped and attacking (?:that player|target player)(?: or a planeswalker they control)?$/))){ for (const p of opponents()){ const before = new Set(S.bf.map(c => c.id)); await createFromText('Create a ' + s.match(/create an? (.+?) token/i)[1] + ' token', ctx); S.bf.filter(c => !before.has(c.id) && c.tok).forEach(c => { c.tap = true; c.sk = false; if (phaseNow().ph === 4) c.atk = 'p:' + p.pid; }); } commit(); return true; }
  if ((m = l.match(/^for each token you control, create a token that's a copy of that permanent$/))){ const toks = S.bf.filter(c => c.tok && !c.emb); for (const c of toks) await createToken(c.k, c.n || 1); commit(); return true; }
  if ((m = l.match(/^if you control no (\w+), (create .+)$/))){ const n = countOf(m[1] + ' you control', ctx) || 0; if (!n) await say(s.slice(s.length - m[2].length)); return true; }
  if ((m = l.match(/^(?:you )?create a number of (.+?) tokens equal to the result$/))){ const n = ctx.roll || 0; for (let i = 0; i < n; i++) await createFromText(`Create a ${m[1]} token`, ctx); return true; }
  if ((m = l.match(/^if you control your commander, (create .+)$/))){ if (S.bf.some(c => c.cmd)) await say(s.slice(s.length - m[1].length)); return true; }
  // graveyard tricks
  if ((m = l.match(/^put target card from a graveyard on top of its owner's library$/))){ const t = tgt(); if (t && t.pid === MYPID && find(t.id)[0] === 'gy'){ const c = find(t.id)[2]; S.gy.splice(S.gy.indexOf(c), 1); S.lib.unshift(c); } else if (t) handWarn(`Put ${t.nm || 'that card'} on top of its owner's library`, ctx); commit(); return true; }
  if ((m = l.match(/^return up to (one|two|three) target (.+?) cards? from your graveyard to your hand$/))){ let t; while (ctx.tgts && (t = nextTargets(ctx)[0])) if (t.pid === MYPID && find(t.id)[0] === 'gy') moveCard(t.id, 'hand'); commit(); return true; }
  if ((m = l.match(/^return to your hand target artifact card in your graveyard with lesser mana value$/))){ const t = tgt(); if (t && find(t.id)[0] === 'gy') moveCard(t.id, 'hand'); commit(); return true; }
  if ((m = l.match(/^target player mills cards equal to the sacrificed creature's power$/))){ const t = tgt(); const c = ctx.sacd; const n = c ? Math.max(0, (parseInt(info(c.k)?.p) || 0) + (c.cp || 0) - (c.cm || 0)) : 0; if (t && n){ if (t.pid === MYPID) mill(n); else sendRq(t.pid, 'mill', n, ctx.name); } commit(); return true; }
  if ((m = l.match(/^each player mills (\w+) cards$/))){ const n = wn(m[1]) || ({ten:10}[m[1]]) || 1; mill(n); opponents().forEach(p => sendRq(p.pid, 'mill', n, ctx.name)); commit(); return true; }
  // untap everything
  if ((m = l.match(/^untap all (nonland permanents|lands|artifacts|creatures|permanents) you control$/)) || (m = l.match(/^you untap all (lands) you control$/))){ const f = {['nonland permanents']:c => !isLand(c.k), lands:c => isLand(c.k), artifacts:c => /Artifact/.test(typeOf(c)), creatures:c => isCreatureCard(c), permanents:() => true}[m[1]]; S.bf.filter(f).forEach(c => { c.tap = false; c.tn = 0; }); log(`${ctx.name}: untapped all ${m[1]}`); commit(); return true; }
  // goad all, phase out (approx: by hand), prevention
  if ((m = l.match(/^goad all creatures you don't control$/))){ for (const [pid, st] of OPP) (st.bf || []).forEach(c => { if (c.k && isCreatureCard(c)) sendRq(pid, 'goad', 0, ctx.name, {tid:c.id}); }); return true; }
  if ((m = l.match(/^(?:any number of target nonland permanents you control|up to one target creature|target permanent you control|all permanents you control) phases? out$/))){ let t; const list = []; while (ctx.tgts && (t = nextTargets(ctx)[0])) list.push(t); if (/^all/.test(l)) S.bf.forEach(c => list.push({id:c.id, pid:MYPID})); list.forEach(t => { const c = t.pid === MYPID && S.bf.find(x => x.id === t.id); if (c){ c.phased = MYPID; c.fd = c.fd; } }); handWarn(`Phase out: ${list.length ? list.length + ' permanent(s)' : 'the target'} — treat them as gone until your next untap`, ctx); return true; }
  if ((m = l.match(/^prevent all combat damage that would be dealt to and dealt by that creature this turn$/))){ const t = (ctx.lastT || [])[0] || tgt(); if (t) applyTo(t, {op:'pump', src:ctx.name, f:{p:0, t:0, kw:['nodamage']}}); return true; }
  if ((m = l.match(/^prevent all combat damage that would be dealt to you this turn$/))){ S.fogMe = turnStr(); return true; }
  // more “if X” conditions
  if ((m = l.match(/^(?:draw a card )?if (?:an opponent|target player) controls more lands than you, (.+)$/))){ const mine = S.bf.filter(c => isLand(c.k)).length; const more = [...OPP.values()].some(s => (s.bf || []).filter(c => c.k && isLand(c.k)).length > mine); if (more) await say(s.slice(s.length - m[1].length)); else log(`${ctx.name}: no opponent controls more lands`); return true; }
  if ((m = l.match(/^draw a card if an opponent has cast a (\w+) or (\w+) spell this turn$/))){ handWarn(s, ctx); return true; }
  if ((m = l.match(/^(?:its controller may )?draw a card if its power is (?:greater than each other creature's power|(\d+) or greater)$/))){ const c = ctx.it && S.bf.find(x => x.id === ctx.it.evId); const ok = c && (m[1] ? stats(c)[0] >= +m[1] : true); if (ok && (!ctx.it || ctx.it.evPid === MYPID || !ctx.it.evPid)) draw(1); commit(); return true; }
  if ((m = l.match(/^if (?:two|three) or more of those creatures are attacking you and\/or planeswalkers you control, draw a card$/))){ draw(1); commit(); return true; }
  if ((m = l.match(/^if (?:it|~) is untapped, (.+)$/))){ const c = src(); if (c && !c.tap) await say(s.slice(s.length - m[1].length)); return true; }
  if ((m = l.match(/^if howling mine is untapped, (.+)$/)) || (m = l.match(/^if ~ is untapped, (.+)$/))){ const c = src(); if (c && !c.tap) await say(s.slice(s.length - m[1].length)); return true; }
  if ((m = l.match(/^if an opponent lost (\d+) or more life this turn, (.+)$/))){ if (opponents().some(p => lostThisTurn(p.pid) >= +m[1])) await say(s.slice(s.length - m[2].length)); return true; }
  // counters moving / distributing
  if ((m = l.match(/^distribute (two|three|\w+) \+1\/\+1 counters among one or (?:two|three) target creatures(?: you control)?$/))){ const n = wn(m[1]) || 2; const ts = []; let t; while (ctx.tgts && (t = nextTargets(ctx)[0])) ts.push(t); ts.forEach((t, i) => { const k = Math.floor(n / ts.length) + (i < n % ts.length ? 1 : 0); const c = t.pid === MYPID && S.bf.find(x => x.id === t.id); if (c) modCounters(c, 'cp', k); else applyTo(t, {op:'ctr', n:k, src:ctx.name, d:'cp'}); }); commit(); return true; }
  if ((m = l.match(/^move (?:a counter|any number of \+1\/\+1 counters) from (?:target permanent you control|~) onto (?:a second target permanent|other creatures)$/))){ handWarn(s, ctx); return true; }
  // equipment
  if ((m = l.match(/^attach that equipment to target creature you control$/))){ const e = ctx.it && S.bf.find(x => x.id === ctx.it.evId); const t = tgt(); if (e && t && t.pid === MYPID){ e.att = {pid:MYPID, id:t.id}; commit(); } return true; }
  if ((m = l.match(/^create a token that's a copy of equipped creature, except the token isn't legendary$/))){ const sc = src(); const h = sc && sc.att && S.bf.find(x => x.id === sc.att.id); if (h){ await createToken(h.k, 1); const tk = S.bf.filter(x => x.tok && x.k === h.k).pop(); if (tk) tk.nonLeg = 1; ctx.lastTok = tk ? [tk.id] : []; } commit(); return true; }
  // misc
  if ((m = l.match(/^draw a card for each permanent you control of that type$/))){ const ty = ctx.ctype || 'Creature'; const n = S.bf.filter(c => new RegExp('\\b' + ty + '\\b', 'i').test(typeOf(c))).length; if (n) draw(n); commit(); return true; }
  if ((m = l.match(/^(?:you may )?search your library for an? (.+?) card and reveal it$/)) && /put it onto the battlefield tapped if it's a land card/i.test(String(ctx.full || ''))){ const d = m[1]; const legal = S.lib.filter(c => descOk(c.k, d)); emit({type:'search', cnt:1}); const ids = await pickCards({title:`${ctx.name}: search for a ${d} card`, cards:legal, min:0, max:1, noneLabel:'Find nothing'}); const c = ids && ids[0] && S.lib.find(x => x.id === ids[0]); if (c){ if (isLand(c.k)){ moveCard(c.id, 'bf'); const b = S.bf.find(x => x.id === c.id); if (b) b.tap = true; } else moveCard(c.id, 'hand'); } shuffleLib(); commit(); return true; }
  if (/^put it onto the battlefield tapped if it's a land card$/.test(l) || /^otherwise, put it into your hand$/.test(l)) return true;
  if ((m = l.match(/^an opponent gains control of ~$/)) || (m = l.match(/^the player to your right gains control of ~$/))){ handWarn(`${s} (hand it over with the card's menu)`, ctx); return true; }
  if ((m = l.match(/^put a land card from among them into your hand$/))) return false;
  if ((m = l.match(/^(?:it|that creature) gets -13\/-13 until end of turn instead if a creature died this turn$/))) return true;
  if ((m = l.match(/^target creature gets -(\d+)\/-(\d+) until end of turn$/)) && /-13\/-13 until end of turn instead if a creature died this turn/.test(String(ctx.full || '').toLowerCase())){ const died = (S.ev || []).some(e => e.type === 'die'); const t = tgt(); if (t) applyTo(t, {op:'pump', src:ctx.name, f:died ? {p:-13, t:-13} : {p:-m[1], t:-m[2]}}); return true; }
  if ((m = l.match(/^exile x target creatures$/)) && /creates a 2\/2 green boar/.test(String(ctx.full || '').toLowerCase())){ let t; while (ctx.tgts && (t = nextTargets(ctx)[0])){ applyTo(t, {op:'exile', src:ctx.name}); if (t.pid === MYPID) await createFromText('Create a 2/2 green Boar creature token', ctx); else sendRq(t.pid, 'tokText', 0, ctx.name, {d:'a 2/2 green Boar creature token'}); } return true; }
  if (/^for each creature exiled this way, its controller creates a 2\/2 green boar creature token$/.test(l)) return true;
  if ((m = l.match(/^remove target attacking creature you control from combat and untap it$/))){ const t = tgt(); const c = t && S.bf.find(x => x.id === t.id); if (c){ c.atk = ''; c.tap = false; commit(); } return true; }
  if ((m = l.match(/^exile two target artifacts, creatures, and\/or lands you control, then return those cards to the battlefield under their owner's control$/)) || (m = l.match(/^exile two target artifacts, creatures, and\/or lands you control$/))){ let t; while (ctx.tgts && (t = nextTargets(ctx)[0])){ const c = S.bf.find(x => x.id === t.id); if (c){ moveCard(c.id, 'ex'); moveCard(c.id, 'bf'); } } commit(); return true; }
  if ((m = l.match(/^untap all creatures you control$/))){ S.bf.filter(c => isCreatureCard(c)).forEach(c => { c.tap = false; c.tn = 0; }); commit(); return true; }
  if ((m = l.match(/^your opponents can't cast noncreature spells this turn$/))){ handWarn("Your opponents can't cast noncreature spells this turn", ctx); return true; }
  if ((m = l.match(/^you win the game$/))){ log(`🏆 ${ctx.name}: wins the game!`); toast(`${ctx.name}: you win the game!`); return true; }
  if ((m = l.match(/^if x is greater than or equal to the number of cards in your library, you win the game$/))){ const x = ctx.devX ?? 0; if (x >= S.lib.length){ log(`🏆 ${ctx.name}: wins the game!`); toast('You win the game!'); } return true; }
  if ((m = l.match(/^look at the top x cards of your library, where x is your devotion to (\w+)$/))){ ctx.devX = devotion([m[1]]); await say(`Look at the top ${ctx.devX} cards of your library. Put up to one of them on top of your library and the rest on the bottom of your library in a random order`); return true; }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){
    const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase();
    if (l && await doRound12Pre(s, l, ctx)) return;
    return ds(s0, ctx);
  };
}
// Thassa's Oracle has the whole look-at line in one sentence
{
  const re = runEffects;
  runEffects = async function(txt, ctx){ let t = String(txt || ''); t = t.replace(/Look at the top X cards of your library, where X is your devotion to (\w+)\. Put up to one of them on top of your library and the rest on the bottom of your library in a random order\./i, 'Look at the top X cards of your library, where X is your devotion to $1.').replace(/If X is greater than or equal to the number of cards in your library, you win the game\./i, 'If X is greater than or equal to the number of cards in your library, you win the game.'); return re(t, ctx); };
}
// Living Death on the other players' boards
{
  RQ_OPS.push('livingDeath');
  const ao = applyOp;
  applyOp = function(r, from){ if (r.op === 'livingDeath'){ const ex = S.gy.filter(c => isCreatureCard(c)); ex.forEach(c => moveCard(c.id, 'ex')); S.bf.filter(c => isCreatureCard(c)).forEach(c => moveCard(c.id, 'gy', {sac:true})); ex.forEach(c => moveCard(c.id, 'bf')); log(`Living Death (${r.src})`); commit(); return; } return ao(r, from); };
}
STATIC_RULES.push(
  [/^untap all artifacts you control during each other player's untap step$/, m => ({kind:'clockUntap', who:'you'})],
  [/^you may cast (artifact spells and colorless spells|creature spells of the chosen type|noncreature spells|aura and equipment spells) (?:from the top of your library|as though they had flash)$/, m => ({kind:/top/.test(m[0]) ? 'topPlay' : 'allFlash', who:'you', mv:0, desc:{['artifact spells and colorless spells']:'artifact', ['noncreature spells']:'noncreature', ['aura and equipment spells']:'aura or equipment'}[m[1]] || ''})],
  [/^other creatures you control have "ward—pay (\d+) life\."?$/, m => ({kind:'noop'})],
  [/^equipment you control have equip \{0\} as long as you control three or more artifacts$/, m => ({kind:'equip0', who:'you'})],
  [/^if one or more tokens would be created under your control, those tokens plus an additional (food|treasure|clue) token are created instead$/, m => ({kind:'tokExtra', who:'you', name:cap(m[1])})],
  [/^if you would create one or more treasure tokens, instead create those tokens plus an additional treasure token$/, m => ({kind:'tokExtra', who:'you', name:'Treasure', only:'Treasure'})],
  [/^if a source you control would deal damage to an opponent or a permanent an opponent controls, it deals double that damage instead$/, m => ({kind:'dmgX2opp', who:'you'})],
  [/^if a source you control would deal damage to a permanent or player, it deals triple that damage to that permanent or player instead$/, m => ({kind:'dmgX3', who:'you'})],
  [/^if an opponent would lose life during your turn, they lose twice that much life instead$/, m => ({kind:'noop'})],
);
{
  const tc = turnChanged;
  turnChanged = function(...a){ const r = tc.apply(this, a); try { if (S && currentTurn()[1] !== MYPID && rulesOn('clockUntap').length) S.bf.forEach(c => { if (/Artifact/.test(typeOf(c))){ c.tap = false; c.tn = 0; } }); } catch {} return r; };
  const dd = dealDamage;
  dealDamage = function(t, n, srcK, srcCard, extra){ if (S && n > 0 && srcCard && S.bf.includes(srcCard)){ if (rulesOn('dmgX3').length) n *= 3; else if (rulesOn('dmgX2opp').length && t.pid && t.pid !== MYPID) n *= 2; } return dd(t, n, srcK, srcCard, extra); };
  const cft = createFromText;
  createFromText = async function(s, ctx){ const r = await cft(s, ctx); try { if (!/^create an? (food|treasure|clue) token$/i.test(s)) for (const x of rulesOn('tokExtra')){ if (x.only && !new RegExp(x.only, 'i').test(s)) continue; await cft(`Create a ${x.name} token`, ctx); } } catch {} return r; };
}
