/* ===================== Rules engine — round 19a: cards ranked 1000–2199 ===================== */
// Spree, Tiered, repeatable modes (Confluences), Seasons' paw modes, “choose two instead” modes, and many one-line effects.

/* ---------- Modes: Spree, Tiered, repeatable modes, pawprints, conditional “choose two/both instead” ---------- */
{
  const pm = parseModes;
  parseModes = function(txt){
    let t = String(txt || ''); let m;
    if ((m = t.match(/(^|\n)Spree[ \t]*\n((?:[ \t]*\+ [^\n]*(?:\n|$))+)/))){
      const opts = [], costs = [];
      for (const x of m[2].split('\n').map(y => y.trim()).filter(y => /^\+ /.test(y))){ const mm = x.match(/^\+ ((?:\{[^}]+\})+) — ([\s\S]+)$/); if (!mm) return pm(txt); costs.push(mm[1]); opts.push(mm[2]); }
      return {opts, costs, min:1, max:opts.length, pre:t.slice(0, m.index).trim(), post:t.slice(m.index + m[0].length).trim(), spree:true};
    }
    if ((m = t.match(/(^|\n)Tiered[ \t]*\n((?:[ \t]*•[^\n]*(?:\n|$))+)/))){
      const opts = [], costs = [];
      for (const x of m[2].split('\n').map(y => y.trim()).filter(y => /^•/.test(y))){ const mm = x.match(/^•\s*[^—]+? — ((?:\{[^}]+\})+) — ([\s\S]+)$/); if (!mm) return pm(txt); costs.push(mm[1]); opts.push(mm[2]); }
      return {opts, costs, min:1, max:1, pre:t.slice(0, m.index).trim(), post:t.slice(m.index + m[0].length).trim(), tiered:true};
    }
    if ((m = t.match(/(^|\n)Choose up to (\w+) \{P\} worth of modes\. You may choose the same mode more than once\.[ \t]*\n((?:[ \t]*(?:\{P\})+ — [^\n]*(?:\n|$))+)/i))){
      const opts = [], paw = [];
      for (const x of m[3].split('\n').map(y => y.trim()).filter(Boolean)){ const mm = x.match(/^((?:\{P\})+) — ([\s\S]+)$/); if (!mm) return pm(txt); paw.push(mm[1].length / 3); opts.push(mm[2]); }
      return {opts, paw, budget:wn(m[2]) || 5, min:0, max:opts.length, pre:t.slice(0, m.index).trim(), post:t.slice(m.index + m[0].length).trim()};
    }
    let rep = false;
    t = t.replace(/^Choose (one|two|three|four)\. You may choose the same mode more than once\.[ \t]*\n(?=\s*•)/im, (w, a) => { rep = wn(a); return `Choose ${a} —\n`; });
    t = t.replace(/^Choose one\. If you control an? ([A-Za-z]+) as you cast [^,\n]+, you may choose two instead\.[ \t]*\n(?=\s*•)/im, (w, a) => (S && S.bf.some(c => !c.fd && descOk(c.k, a, {tok:c.tok})) ? 'Choose one or both —\n' : 'Choose one —\n'));
    t = t.replace(/^Choose one\. If an opponent has eight or more cards in their graveyard, you may choose both instead\.[ \t]*\n(?=\s*•)/im, () => (S && [...OPP.values()].some(o => ((o.gy || []).length || o.gc || 0) >= 8) ? 'Choose one or both —\n' : 'Choose one —\n'));
    const r = pm(t);
    if (r && rep){ r.rep = rep; r.min = rep; r.max = rep; }
    return r;
  };
  const am = askModes;
  askModes = async function(md, name){
    if (md.paw){
      const got = []; let left = md.budget;
      while (left > 0){
        const opts = md.opts.map((o, i) => ({label:`${'{P}'.repeat(md.paw[i])} — ${o}`, value:i, disabled:md.paw[i] > left}));
        opts.push({label:got.length ? 'That’s all' : 'Choose nothing', value:'done'});
        const v = await askChoice({title:`${name}: choose modes (${left} {P} left)`, options:opts});
        if (v == null) return null; if (v === 'done') break; got.push(v); left -= md.paw[v];
      }
      return got;
    }
    if (md.rep){
      const got = [];
      while (got.length < md.rep){
        const v = await askChoice({title:`${name}: choose ${md.rep} (the same mode may repeat) — ${got.length} chosen`, options:md.opts.map((o, i) => ({label:o, value:i}))});
        if (v == null) return null; got.push(v);
      }
      return got;
    }
    if (md.costs){
      const r = await am({...md, opts:md.opts.map((o, i) => `${md.costs[i]} — ${o}`)}, name);
      if (r) UI.modeAdd = r.map(i => md.costs[i]).join('');
      return r;
    }
    return am(md, name);
  };
  const sc = spellCost;
  spellCost = function(c, zone, o = {}){
    const r = sc(c, zone, o);
    if (UI.modeAdd && UI.casting && r && r.cost){ const a = parseCost(UI.modeAdd); r.cost.gen += a.gen; MANA.forEach(x => { r.cost.col[x] = (r.cost.col[x] || 0) + (a.col[x] || 0); }); r.cost.hyb.push(...a.hyb); r.cost.two.push(...a.two); r.cost.phy.push(...a.phy); r.notes.push(`chosen modes ${UI.modeAdd}`); }
    return r;
  };
  const bc = beginCast;
  beginCast = async function(c, zone, o = {}){ UI.modeAdd = null; try { return await bc(c, zone, o); } finally { UI.modeAdd = null; } };
}

/* ---------- extra creature types: “It's a Phyrexian in addition to its other types” ---------- */
function addXType(c, ty){ if (!c) return; c.xty = [...new Set([...(c.xty || []), ...String(ty).toLowerCase().split(/\s+/).filter(Boolean)])]; commit(); }
{
  const dk = descOk;
  descOk = function(k, desc, o = {}){ const r = dk(k, desc, o); if (r || !S) return r; const d = String(desc || '').toLowerCase().trim().replace(/^(an?|the) /, '').replace(/ (creature|card|permanent)s?$/, ''); if (!d || /\s/.test(d)) return r;
    const w = d.replace(/s$/, ''); for (const c of S.bf){ if (c.k === k && c.xty && (c.xty.includes(d) || c.xty.includes(w))) return true; } return r; };
}

/* ---------- one-line effects ---------- */
function r19Player(ctx){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (t) return t.pid || MYPID; const it = ctx.it || {}; return it.evDp || it.evPid || null; }
function r19Board(pid){ return pid === MYPID ? S.bf : ((OPP.get(pid) || {}).bf || []); }
function r19X(ctx){ const it = ctx.it || {}; return it.x || it.evX || ((S.stk || []).find(x => it.castSid && x.sid === it.castSid) || {}).x || 0; }
function r19Win(ctx){ log(`🏆 ${ctx.name}: wins the game!`); toast(`${ctx.name}: you win the game!`); }
async function doRound19aPre(s, l, ctx){
  let m; const src = () => srcCardOf(ctx); const say = t => doSentence(cap(t), ctx); const tgt = () => (ctx.tgts ? nextTargets(ctx) : [])[0];
  const tail = n => s.slice(s.length - n.length);
  if (/^then /.test(l)){ if (await doRound19aPre(s.slice(5), l.slice(5), ctx)) return true; }
  if ((m = l.match(/^you gain (\d+) life and get ((?:\{e\})+)$/))){ gainLife(+m[1], ctx.name); addPC('energy', m[2].length / 3); commit(); return true; }
  // Noxious Gearhulk
  if ((m = l.match(/^if a creature is destroyed this way, you gain life equal to its toughness$/))){ const t = (ctx.lastT || [])[0]; if (t && t.k){ const c = r19Board(t.pid).find(x => x.id === t.id); const gone = t.pid === MYPID ? !c : !(c && kwOf(c, 'indestructible', t.pid)); const tg = c ? (stats(c, t.pid) || [0, 0])[1] : ((ptOf(info(t.k)) || [0, 0])[1]); if (gone && tg > 0) gainLife(tg, ctx.name); } commit(); return true; }
  // Witch's Clinic and other keyword grants on a target
  if ((m = l.match(/^target commander gains (lifelink|hexproof|indestructible|haste|vigilance|trample|flying) until end of turn$/))){ const t = tgt(); if (t) applyTo(t, {op:'pump', src:ctx.name, f:{p:0, t:0, kw:[m[1]]}}); return true; }
  if ((m = l.match(/^regenerate target ((?:\w+, )+(?:or )?\w+)$/))){ const t = tgt(); const c = t && t.pid === MYPID && S.bf.find(x => x.id === t.id); if (c){ c.regen = (c.regen || 0) + 1; commit(); } else if (t) applyTo(t, {op:'regen', src:ctx.name}); return true; }
  // Secret Rendezvous, Gleaming Splendor
  if ((m = l.match(/^you and target (opponent|player) each draw (a card|\w+ cards)$/))){ const n = m[2] === 'a card' ? 1 : (wn(m[2].split(' ')[0]) || 1); const t = tgt(); draw(n); if (t && t.pid && t.pid !== MYPID) sendRq(t.pid, 'draw', n, ctx.name); commit(); return true; }
  if ((m = l.match(/^two target players each draw (a card|\w+ cards)$/))){ const n = m[1] === 'a card' ? 1 : (wn(m[1].split(' ')[0]) || 1); for (let i = 0; i < 2; i++){ const t = tgt(); if (!t) continue; if (t.pid === MYPID) draw(n); else sendRq(t.pid, 'draw', n, ctx.name); } commit(); return true; }
  // Prismari Command
  if ((m = l.match(/^target player draws (a card|\w+ cards) and discards (a card|\w+ cards)$/))){ const n = wn(m[1].split(' ')[0]) || 1, d = wn(m[2].split(' ')[0]) || 1; const t = tgt(); const pid = t ? t.pid : MYPID; if (pid === MYPID){ draw(n); await discardTracked(d, ctx); } else { sendRq(pid, 'draw', n, ctx.name); sendRq(pid, 'discard', d, ctx.name); } commit(); return true; }
  if ((m = l.match(/^target (player|opponent) creates (an? (?:tapped )?(?:treasure|food|clue|blood) token)$/))){ const t = tgt(); if (t) await ctrlCreate(t, m[2].replace(/(treasure|food|clue|blood)/, w => cap(w)), ctx); commit(); return true; }
  // Jace, Wielder of Mysteries; Triskaidekaphile; Simic Ascendancy; Twenty-Toed Toad
  if ((m = l.match(/^if your library has no cards in it, you win the game$/))){ if (!S.lib.length) r19Win(ctx); return true; }
  if ((m = l.match(/^if you have exactly (\w+) cards in your hand, you win the game$/))){ if (S.hand.length === wn(m[1])) r19Win(ctx); return true; }
  if ((m = l.match(/^if ~ has (\w+) or more (\w+) counters on it, you win the game$/))){ const c = src(); if (c && ((c.nc || {})[m[2]] || 0) >= wn(m[1])) r19Win(ctx); return true; }
  if ((m = l.match(/^you win the game if there are (\w+) or more counters on it or you have (\w+) or more cards in hand$/))){ const c = src(); const n = c ? (c.cp || 0) + (c.cm || 0) + Object.values(c.nc || {}).reduce((a, b) => a + (+b || 0), 0) : 0; if (n >= wn(m[1]) || S.hand.length >= wn(m[2])) r19Win(ctx); return true; }
  // Nezahal
  if ((m = l.match(/^exile ~$/)) && /^return it to the battlefield (?:tapped )?under its owner's control at the beginning of the next end step/im.test(String(info(ctx.k)?.o || '').replace(/\.\s+/g, '.\n'))){ const c = src(); if (c){ moveCard(c.id, 'ex'); ctx.lastT = [{t:'card', pid:MYPID, id:c.id, k:c.k}]; } commit(); return true; }
  // Xenagos, Summon: Titan
  if ((m = l.match(/^another target creature you control gains haste and gets \+x\/\+x until end of turn, where x is that creature's power$/))){ const t = tgt(); if (t){ const st = statsAny(t); const n = st ? Math.max(0, st[0]) : 0; applyTo(t, {op:'pump', src:ctx.name, f:{p:n, t:n, kw:['haste']}}); } return true; }
  if ((m = l.match(/^until end of turn, another target creature you control gains (\w+) and gets \+x\/\+x, where x is (.+)$/))){ const n = countOf(m[2], ctx) ?? 0; const t = tgt(); if (t) applyTo(t, {op:'pump', src:ctx.name, f:{p:n, t:n, kw:[m[1]]}}); return true; }
  // Thassa, Secret Tunnel-like, Key to the City
  if ((m = l.match(/^(target creature you control|up to one target creature|two target creatures you control(?: that share a creature type)?) can't be blocked this turn$/))){ const n = /^two/.test(m[1]) ? 2 : 1; for (let i = 0; i < n; i++){ const t = tgt(); if (t) applyTo(t, {op:'pump', src:ctx.name, f:{p:0, t:0, kw:['unblockable']}}); } return true; }
  // Keeper of the Accord
  if ((m = l.match(/^if (?:target|that) player controls more (creatures|lands) than you, (.+)$/))){ const pid = r19Player(ctx); const ty = m[1] === 'lands' ? 'Land' : 'Creature'; const n = r19Board(pid).filter(c => c.k && new RegExp(ty).test(info(c.k)?.t || '')).length; const me = S.bf.filter(c => !c.fd && new RegExp(ty).test(typeOf(c))).length; if (pid && pid !== MYPID && n > me) await say(tail(m[2])); return true; }
  // Jadar
  if ((m = l.match(/^if you control no creatures with (decayed|flying|defender), (.+)$/))){ if (!S.bf.some(c => isCreatureCard(c) && kwOf(c, m[1]))) await say(tail(m[2])); return true; }
  // Heliod's Intervention
  if ((m = l.match(/^target player gains twice x life$/))){ const x = (ctx.it && ctx.it.x) || 0; const t = tgt(); const pid = t ? t.pid : MYPID; if (x){ if (pid === MYPID) gainLife(2 * x, ctx.name); else sendRq(pid, 'life', 2 * x, ctx.name); } commit(); return true; }
  // Peer into the Abyss
  if ((m = l.match(/^target player draws cards equal to half the number of cards in their library and loses half their life$/))){ const t = tgt(); const pid = t ? t.pid : MYPID; if (pid === MYPID){ const n = Math.ceil(S.lib.length / 2), lf = Math.ceil(Math.max(0, S.life) / 2); draw(n); S.life -= lf; log(`drew ${n} and lost ${lf} life (${ctx.name})`); } else { const o = OPP.get(pid) || {}; const n = Math.ceil((o.lc ?? (o.lib || []).length ?? 0) / 2), lf = Math.ceil(Math.max(0, o.life || 0) / 2); if (n) sendRq(pid, 'draw', n, ctx.name); if (lf) loseLife(pid, lf, ctx.name); } commit(); return true; }
  if ((m = l.match(/^round (up|down) each time$/))) return true;
  // Ad Nauseam
  if ((m = l.match(/^(?:you may )?repeat this process any number of times$/)) && /reveal the top card of your library and put that card into your hand\. you lose life equal to its mana value/i.test(info(ctx.k)?.o || '')){ while (S.lib.length && !UI.dry && await askYes(`${ctx.name}: repeat? (you are at ${S.life} life)`, 'Repeat', 'Stop')){ const c = S.lib[0]; moveCard(c.id, 'hand'); const n = info(c.k)?.mv || 0; S.life -= n; log(`${ctx.name}: revealed ${cname(c)}, lost ${n} life`); commit(); } return true; }
  // Bonehoard Dracosaur
  if ((m = l.match(/^if you exiled an? (land|nonland) card this way, (.+)$/))){ const ex = (ctx.lastEx || []).map(id => find(id)[2]).filter(Boolean); if (ex.some(c => m[1] === 'land' ? isLand(c.k) : !isLand(c.k))) await say(tail(m[2])); return true; }
  // Delayed Blast Fireball
  if ((m = l.match(/^if (?:~|this spell) was cast from exile, (.+?)(?: instead)?$/))){ if (ctx.it && ctx.it.from === 'ex') await say(tail(m[1]).replace(/ instead$/i, '')); return true; }
  // Wave Goodbye
  if ((m = l.match(/^return each creature without a \+1\/\+1 counter on it to its owner's hand$/))){ S.bf.filter(c => isCreatureCard(c) && !(c.cp > 0)).forEach(c => moveCard(c.id, 'hand')); for (const [pid, st] of OPP) (st.bf || []).forEach(c => { if (c.k && isCreatureCard(c) && !(c.cp > 0)) applyTo({t:'card', pid, id:c.id, k:c.k}, {op:'bounce', src:ctx.name}); }); commit(); return true; }
  // Fling
  if ((m = l.match(/^~ deals damage equal to the sacrificed creature's power to any target$/))){ const c = ctx.sacd; const n = c ? Math.max(0, (parseInt(info(c.k)?.p) || 0) + (c.cp || 0) - (c.cm || 0)) : 0; const t = tgt(); if (t && n) dealDamage(t, n, ctx.k, null); return true; }
  // Eldrazi Monument
  if ((m = l.match(/^if you can't, sacrifice ~$/))){ if (!(ctx.sacCnt > 0)){ const c = src(); if (c) moveCard(c.id, 'gy', {sac:true}); } commit(); return true; }
  // Temur Battle Rage
  if ((m = l.match(/^that creature also gains (\w+) until end of turn if you control a creature with power (\d+) or greater$/))){ const t = (ctx.lastT || [])[0]; if (t && S.bf.some(c => isCreatureCard(c) && (stats(c) || [0])[0] >= +m[2])) applyTo(t, {op:'pump', src:ctx.name, f:{p:0, t:0, kw:[m[1]]}}); return true; }
  // Stitch Together
  if ((m = l.match(/^return that card from your graveyard to the battlefield instead if there are seven or more cards in your graveyard$/))){ const t = (ctx.lastT || [])[0]; if (t && S.gy.length >= 7){ const z = find(t.id)[0]; if (z === 'hand' || z === 'gy') moveCard(t.id, 'bf'); } commit(); return true; }
  // Desynchronization
  if ((m = l.match(/^return each nonland permanent that's not historic to its owner's hand$/))){ const hist = k => /Artifact|Legendary|Saga/.test(info(k)?.t || ''); S.bf.filter(c => !isLand(c.k) && !hist(c.k)).forEach(c => moveCard(c.id, 'hand')); for (const [pid, st] of OPP) (st.bf || []).forEach(c => { if (c.k && !isLand(c.k) && !hist(c.k)) applyTo({t:'card', pid, id:c.id, k:c.k}, {op:'bounce', src:ctx.name}); }); commit(); return true; }
  // Dark Deal
  if ((m = l.match(/^each player discards all the cards in their hand and draws that many cards minus one$/))){ const n = S.hand.length; S.hand.slice().forEach(c => moveCard(c.id, 'gy')); if (n > 1) draw(n - 1); opponents().forEach(p => { const o = OPP.get(p.pid) || {}; const h = o.hc ?? (o.hand || []).length ?? 0; sendRq(p.pid, 'discard', 99, ctx.name); if (h > 1) sendRq(p.pid, 'draw', h - 1, ctx.name); }); commit(); return true; }
  // Valakut
  if ((m = l.match(/^if you control at least (\w+) other (\w+?)s, you may have ~ deal (\d+) damage to any target$/))){ const c = src(); const n = S.bf.filter(x => x !== c && !x.fd && descOk(x.k, m[2], {tok:x.tok})).length; if (n >= (wn(m[1]) || 5) && await askYes(`${ctx.name}: deal ${m[3]} damage to any target?`)){ const t = tgt(); if (t) dealDamage(t, +m[3], ctx.k, c); } return true; }
  // Tyrite Sanctum, Portal to Phyrexia, Guide of Souls, Liliana
  if ((m = l.match(/^target legendary creature becomes an? (\w+) in addition to its other types$/))){ const t = tgt(); const c = t && t.pid === MYPID && S.bf.find(x => x.id === t.id); if (c) addXType(c, m[1]); else if (t) handWarn(`${t.nm || 'That creature'} is a ${cap(m[1])} too`, ctx); return true; }
  if ((m = l.match(/^(?:it|it's|that creature) (?:becomes |is )?an? (?:black |white |blue |red |green )?(\w+) in addition to its other (?:colors and )?types$/))){ const t = (ctx.lastT || [])[0]; const c = t && S.bf.find(x => x.id === t.id); if (c) addXType(c, m[1]); else if (t && t.pid !== MYPID) handWarn(`${t.nm || 'That creature'} is a ${cap(m[1])} too`, ctx); return true; }
  // Chart a Course
  if ((m = l.match(/^discard (a card|\w+ cards) unless you attacked this turn$/))){ if (!(S.ev || []).some(e => e.type === 'attack')) await discardTracked(m[1] === 'a card' ? 1 : (wn(m[1].split(' ')[0]) || 1), ctx); commit(); return true; }
  // Thirst for Knowledge
  if ((m = l.match(/^discard (\w+) cards unless you discard an? (artifact|creature|land) card$/))){ const ty = cap(m[2]); const has = S.hand.filter(c => new RegExp(ty).test(info(c.k)?.t || '')); if (has.length && (UI.dry || await askYes(`${ctx.name}: discard an ${m[2]} card instead of ${m[1]} cards?`))){ const ids = has.length === 1 ? [has[0].id] : await pickCards({title:`${ctx.name}: discard an ${m[2]} card`, cards:has, min:1, max:1}); (ids || []).forEach(id => moveCard(id, 'gy')); } else await discardTracked(wn(m[1]) || 2, ctx); commit(); return true; }
  // Nasty End
  if ((m = l.match(/^if the sacrificed creature was legendary, draw (\w+) cards instead$/))){ const c = ctx.sacd; if (c && /Legendary/.test(info(c.k)?.t || '')){ const n = wn(m[1]) || 3; const dm = String(info(ctx.k)?.o || '').match(/Draw (\w+) cards\. If the sacrificed/i); const already = dm ? (wn(dm[1]) || 2) : 2; if (n > already) draw(n - already); } commit(); return true; }
  // Stormfist Crusader
  if ((m = l.match(/^each player draws (a card|\w+ cards) and loses (\d+) life$/))){ const n = m[1] === 'a card' ? 1 : (wn(m[1].split(' ')[0]) || 1); draw(n); S.life -= +m[2]; opponents().forEach(p => { sendRq(p.pid, 'draw', n, ctx.name); loseLife(p.pid, +m[2], ctx.name); }); commit(); return true; }
  // Lord of the Accursed, Ainok Strike Leader, For the Common Good, Mutational Advantage
  if ((m = l.match(/^all (\w+?)s gain (menace|flying|trample|haste|deathtouch|lifelink|indestructible) until end of turn$/))){ const d = m[1]; for (const b of boardsAll()) b.bf.forEach(c => { if (c.k && isCreatureCard(c) && descOk(c.k, d, {tok:c.tok})){ if (b.pid === MYPID) c.ekw = [...new Set([...(c.ekw || []), m[2]])]; else applyTo({t:'card', pid:b.pid, id:c.id, k:c.k}, {op:'pump', src:ctx.name, f:{p:0, t:0, kw:[m[2]]}}); } }); commit(); return true; }
  if ((m = l.match(/^(creature tokens|tokens|permanents) you control(?: with counters on them)? gain ((?:hexproof|indestructible|haste|vigilance)(?: and (?:hexproof|indestructible))?) until (end of turn|your next turn)$/))){ const kws = m[2].split(' and '); const cnt = /with counters/.test(l); S.bf.filter(c => !c.fd && (m[1] === 'permanents' || c.tok) && (m[1] !== 'creature tokens' || isCreatureCard(c)) && (!cnt || c.cp || c.cm || Object.keys(c.nc || {}).length || c.lore)).forEach(c => { c.ekw = [...new Set([...(c.ekw || []), ...kws])]; if (/next turn/.test(m[3])){ c.ekwNT = [...new Set([...(c.ekwNT || []), ...kws])]; c.ekwNTt = turnStr(); } }); commit(); return true; }
  // Crippling Fear-like
  if ((m = l.match(/^creatures that aren't of the chosen type get -(\d+)\/-(\d+) until end of turn$/))){ const ty = ctx.chosenType || (UI.dry ? 'Elf' : await askText(`${ctx.name}: which creature type?`, 'Elf')); ctx.chosenType = ty; for (const b of boardsAll()) b.bf.forEach(c => { if (c.k && isCreatureCard(c) && !descOk(c.k, ty, {tok:c.tok})){ if (b.pid === MYPID) c.pu = [(c.pu ? c.pu[0] : 0) - +m[1], (c.pu ? c.pu[1] : 0) - +m[2]]; else applyTo({t:'card', pid:b.pid, id:c.id, k:c.k}, {op:'pump', src:ctx.name, f:{p:-m[1], t:-m[2], kw:[]}}); } }); commit(); return true; }
  // ---- batch 2 ----
  if ((m = l.match(/^target player draws (four|five|six|seven) cards$/))){ const n = wn(m[1]); const t = tgt(); if (t){ if ((t.pid || MYPID) === MYPID) draw(n); else sendRq(t.pid, 'draw', n, ctx.name); } commit(); return true; }
  if ((m = l.match(/^target player mills twice x cards$/))){ const x = 2 * ((ctx.it && ctx.it.x) || 0); const t = tgt(); const pid = t ? t.pid : MYPID; if (x){ if (pid === MYPID) mill(x); else sendRq(pid, 'mill', x, ctx.name); } commit(); return true; }
  if ((m = l.match(/^if a creature died this turn, (.+)$/))){ if (r19Died() > 0) await say(tail(m[1])); return true; }
  if ((m = l.match(/^(?:then )?any number of target players each mill half their library, rounded (down|up)$/))){ const r = m[1] === 'up' ? Math.ceil : Math.floor; let g; const seen = new Set(); while (ctx.tgts && (g = nextTargets(ctx)).length){ for (const t of g){ const pid = t.pid || MYPID; if (seen.has(pid)) continue; seen.add(pid); if (pid === MYPID){ const n = r(S.lib.length / 2); if (n) mill(n); } else { const o = OPP.get(pid) || {}; const n = r((o.lc ?? (o.lib || []).length ?? 0) / 2); if (n) sendRq(pid, 'mill', n, ctx.name); } } } commit(); return true; }
  if ((m = l.match(/^exile another target permanent$/)) && /^Return (?:that card|it) to the battlefield under its owner's control at the beginning of the next end step/im.test(String(info(ctx.k)?.o || '').replace(/\.\s+/g, '.\n'))){ const t = tgt(); if (t){ ctx.lastT = [t]; applyTo(t, {op:'exile', src:ctx.name}); if (t.pid && t.pid !== MYPID) handWarn(`${t.nm || 'That card'} returns to the battlefield under its owner's control at the beginning of the next end step (${ctx.name})`, ctx); } commit(); return true; }
  if ((m = l.match(/^(?:target|that) player draws (two|three|an) additional cards?$/))){ const n = m[1] === 'an' ? 1 : wn(m[1]); const pid = r19Player(ctx) || MYPID; if (pid === MYPID) draw(n); else sendRq(pid, 'draw', n, ctx.name); commit(); return true; }
  if ((m = l.match(/^double the number of \+1\/\+1 counters on (enchanted|equipped) creature$/))){ const sc = src(); if (sc && sc.att){ if (sc.att.pid === MYPID){ const h = S.bf.find(x => x.id === sc.att.id); if (h && h.cp) modCounters(h, 'cp', h.cp); } else { const h = r19Board(sc.att.pid).find(x => x.id === sc.att.id); if (h && h.cp) applyTo({t:'card', pid:sc.att.pid, id:h.id, k:h.k}, {op:'ctr', src:ctx.name, n:h.cp, ctr:'cp'}); } } commit(); return true; }
  if ((m = l.match(/^target creature gets \+x\/\+x or -x\/-x until end of turn, where x is (.+)$/))){ const n = countOf(m[1], ctx) ?? 0; const t = tgt(); if (t){ const v = UI.dry ? 1 : await askChoice({title:`${ctx.name}: +${n}/+${n} or -${n}/-${n}?`, options:[{label:`+${n}/+${n}`, value:1}, {label:`-${n}/-${n}`, value:-1}]}); applyTo(t, {op:'pump', src:ctx.name, f:{p:v * n, t:v * n}}); } return true; }
  if ((m = l.match(/^(?:when you do, )?if it has (\w+) or more (\w+) counters on it, (.+)$/))){ const c = src(); if (c && ((c.nc || {})[m[2]] || 0) >= (wn(m[1]) || 0)) await say(tail(m[3])); return true; }
  if ((m = l.match(/^(?:you may )?exile an? (creature|artifact|instant or sorcery|land) card from your graveyard$/)) && /If you do, /.test(info(ctx.k)?.o || '')){ const list = S.gy.filter(c => descOk(c.k, m[1])); const ids = list.length ? await pickCards({title:`${ctx.name}: exile a ${m[1]} card from your graveyard`, cards:list, min:0, max:1, noneLabel:'Don’t'}) : []; if (ids && ids[0]){ moveCard(ids[0], 'ex'); ctx.didPay = true; } else ctx.didPay = false; commit(); return true; }
  if ((m = l.match(/^if you don't put the card onto the battlefield, put it into your hand$/))){ const c = ctx.lastRev || S.lib[0]; if (c && S.lib[0] === c && find(c.id)[0] === 'lib') moveCard(c.id, 'hand'); commit(); return true; }
  if ((m = l.match(/^it deals that much damage to each other opponent$/))){ const n = (ctx.it && ctx.it.evN) || 0; const dp = ctx.it && ctx.it.evDp; if (n) opponents().filter(p => p.pid !== dp).forEach(p => dealDamage({t:'player', pid:p.pid}, n, ctx.k, null)); return true; }
  if ((m = l.match(/^it deals that much damage to each creature (?:target|that) player controls$/))){ const n = (ctx.it && ctx.it.evN) || 0; const pid = r19Player(ctx); if (n && pid) r19Board(pid).forEach(c => { if (c.k && isCreatureCard(c)) dealDamage({t:'card', pid, id:c.id, k:c.k}, n, ctx.k, src()); }); return true; }
  if ((m = l.match(/^~ deals (\d+) damage to any target and (\d+) damage to each of up to (one|two|three) other targets$/))){ const g1 = ctx.tgts ? nextTargets(ctx) : []; const rest = g1.length > 1 ? g1.slice(1) : (ctx.tgts ? nextTargets(ctx) : []); if (g1[0]) dealDamage(g1[0], +m[1], ctx.k, src()); rest.slice(0, wn(m[3])).forEach(t => dealDamage(t, +m[2], ctx.k, src())); return true; }
  if ((m = l.match(/^until your next turn, you may cast sorcery spells as though they had flash$/))){ S.r19sf = turnStr(); log(`${ctx.name}: you may cast sorceries at instant speed until your next turn`); commit(); return true; }
  if ((m = l.match(/^target creature you control connives x, where x is the number of creatures that died this turn$/))){ const t = tgt(); const n = r19Died(); const c = t && S.bf.find(x => x.id === t.id); if (c && n) await connive(c, ctx, n); return true; }
  if ((m = l.match(/^sacrifice it$/)) && /^When ~ enters, sacrifice it\. When you do,/m.test(tname(info(ctx.k)?.o || '', info(ctx.k)?.n || ''))){ const c = src(); if (c && find(c.id)[0] === 'bf') moveCard(c.id, 'gy', {sac:true}); ctx.didPay = true; commit(); return true; }
  // ---- batch 3 ----
  if ((m = l.match(/^if you have the city's blessing, (.+)$/))){ if (r19City()) await say(tail(m[1])); return true; }
  if ((m = l.match(/^reveal the top card of your library and put it into your hand$/))){ const c = S.lib[0]; if (c){ moveCard(c.id, 'hand'); ctx.lastRev = c; ctx.lastMV = info(c.k)?.mv || 0; log(`${ctx.name}: revealed ${cname(c)} and put it into their hand`); } commit(); return true; }
  if ((m = l.match(/^each opponent loses x life and you gain x life, where x is that card's mana value$/))){ const n = ctx.lastMV || 0; if (n){ opponents().forEach(p => loseLife(p.pid, n, ctx.name)); gainLife(n, ctx.name); } commit(); return true; }
  if ((m = l.match(/^for each token you control (?:of the chosen type )?that entered this turn, create a token that's a copy of it$/))){ const ty = /chosen type/.test(l) ? ((src() || {}).ctype || null) : null; const list = (S.r19ent && S.r19ent.t === turnStr() ? S.r19ent.list : []).filter(e => !ty || descOk(e.k, ty, {tok:true})); for (const e of list) await createToken(e.k, e.n || 1); commit(); return true; }
  if ((m = l.match(/^~ deals damage equal to the total mana value of other permanents you control to each opponent$/))){ const c = src(); const n = S.bf.filter(x => x !== c && !x.tok && !x.fd).reduce((a, x) => a + (info(x.k)?.mv || 0) * (x.n || 1), 0); if (n) opponents().forEach(p => dealDamage({t:'player', pid:p.pid}, n, ctx.k, c)); return true; }
  if ((m = l.match(/^~ deals five times x damage to each of up to x targets$/))){ const x = (ctx.it && ctx.it.x) || 0; let g, done = 0; while (ctx.tgts && done < x && (g = nextTargets(ctx)).length){ for (const t of g){ if (done >= x) break; dealDamage(t, 5 * x, ctx.k, null); done++; } } return true; }
  if ((m = l.match(/^have target attacking creature gain (double strike|first strike|trample|indestructible) until end of turn$/))){ const t = tgt(); if (t) applyTo(t, {op:'pump', src:ctx.name, f:{p:0, t:0, kw:[m[1]]}}); return true; }
  if ((m = l.match(/^if an opponent controls (\w+) or more creatures, sacrifice ~, search your library for up to (\w+) creature cards, put those cards onto the battlefield$/))){ const need = wn(m[1]) || 3; let ok = false; for (const st of OPP.values()) if ((st.bf || []).filter(c => c.k && isCreatureCard(c)).reduce((a, c) => a + (c.n || 1), 0) >= need) ok = true; if (ok){ const c = src(); if (c) moveCard(c.id, 'gy', {sac:true}); await searchLibrary(`up to ${m[2]} creature`, 'put them onto the battlefield', ctx); } commit(); return true; }
  if ((m = l.match(/^(?:you )?gain half x life and draw half x cards$/)) || (m = l.match(/^you gain half x life$/)) || (m = l.match(/^draw half x cards$/))){ const x = r19X(ctx); const h = Math.floor(x / 2); if (h){ if (/life/.test(l)) gainLife(h, ctx.name); if (/draw/.test(l)) draw(h); } commit(); return true; }
  if ((m = l.match(/^you gain (\d+) life, draw (\w+) cards$/))){ gainLife(+m[1], ctx.name); draw(wn(m[2]) || 1); commit(); return true; }
  if ((m = l.match(/^put up to (\w+) permanent cards from your hand onto the battlefield$/))){ const n = wn(m[1]) || 1; const list = S.hand.filter(c => isPermType(info(c.k)?.t)); const ids = list.length ? await pickCards({title:`${ctx.name}: put up to ${n} permanent cards onto the battlefield`, cards:list, min:0, max:Math.min(n, list.length), noneLabel:'None'}) : []; (ids || []).forEach(id => moveCard(id, 'bf')); commit(); return true; }
  if ((m = l.match(/^(?:you may )?put up to (\w+) creature cards from your hand onto the battlefield$/))){ const n = wn(m[1]) || 1; const list = S.hand.filter(c => isCreatureCard(c)); const ids = list.length ? await pickCards({title:`${ctx.name}: put up to ${n} creature cards onto the battlefield`, cards:list, min:0, max:Math.min(n, list.length), noneLabel:'None'}) : []; (ids || []).forEach(id => moveCard(id, 'bf')); commit(); return true; }
  if ((m = l.match(/^creatures you control with power (\d+) or greater gain ((?:hexproof|indestructible|trample|haste|vigilance)(?: and (?:hexproof|indestructible|trample|haste|vigilance))?) until end of turn$/))){ const kws = m[2].split(' and '); S.bf.filter(c => isCreatureCard(c) && (stats(c) || [0])[0] >= +m[1]).forEach(c => { c.ekw = [...new Set([...(c.ekw || []), ...kws])]; }); commit(); return true; }
  if ((m = l.match(/^return up to (\w+) creature cards with total mana value (\d+) or less from your graveyard to the battlefield$/))){ const n = wn(m[1]) || 2, cap0 = +m[2]; const list = S.gy.filter(c => isCreatureCard(c) && (info(c.k)?.mv || 0) <= cap0); let ids = list.length ? await pickCards({title:`${ctx.name}: up to ${n} creature cards, total mana value ${cap0} or less`, cards:list, min:0, max:Math.min(n, list.length), noneLabel:'None'}) : []; ids = ids || []; let tot = 0; const ok = []; for (const id of ids){ const v = info(find(id)[2]?.k)?.mv || 0; if (tot + v <= cap0){ ok.push(id); tot += v; } } if (ok.length < ids.length) toast(`${ctx.name}: total mana value must be ${cap0} or less — kept ${ok.length}`); ok.forEach(id => moveCard(id, 'bf')); commit(); return true; }
  if ((m = l.match(/^add one mana of that color for each (\w+) counter on ~$/))){ const c = src(); const n = c ? ((c.nc || {})[m[1]] || 0) : 0; if (n){ const col = ctx.chosenColor || (UI.dry ? 'G' : await askChoice({title:`${ctx.name}: choose a color`, options:['W', 'U', 'B', 'R', 'G'].map(x => ({label:`{${x}}`, value:x}))})) || 'G'; S.pool[col] = (S.pool[col] || 0) + n; log(`${ctx.name}: added ${n} {${col}}`); } commit(); return true; }
  if ((m = l.match(/^exile each permanent with mana value x or less that's one or more colors$/))){ const x = (ctx.it && ctx.it.x) || 0; const ok = k => (info(k)?.mv || 0) <= x && /[WUBRG]/.test(info(k)?.c || '') && !isLand(k); S.bf.filter(c => c.k && !c.fd && ok(c.k)).forEach(c => moveCard(c.id, 'ex')); for (const [pid, st] of OPP) (st.bf || []).forEach(c => { if (c.k && ok(c.k)) applyTo({t:'card', pid, id:c.id, k:c.k}, {op:'exile', src:ctx.name}); }); commit(); return true; }
  if ((m = l.match(/^put up to (\w+) (creature and\/or land|creature|land|permanent) cards from among the milled cards into your hand$/))){ const n = wn(m[1]) || 1; const d = m[2] === 'creature and/or land' ? c => isCreatureCard(c) || isLand(c.k) : c => descOk(c.k, m[2]); const list = (ctx.milled2 || []).filter(c => S.gy.includes(c) && d(c)); const ids = list.length ? await pickCards({title:`${ctx.name}: put up to ${n} into your hand`, cards:list, min:0, max:Math.min(n, list.length), noneLabel:'None'}) : []; (ids || []).forEach(id => moveCard(id, 'hand')); commit(); return true; }
  // ---- batch 4 ----
  if ((m = l.match(/^if you've drawn more than one card this turn, put x \+1\/\+1 counters on target creature you control, where x is the number of cards you've drawn this turn minus one$/))){ const d = drawnThisTurn(); const t = tgt(); const c = t && S.bf.find(x => x.id === t.id); if (d > 1 && c) modCounters(c, 'cp', d - 1); commit(); return true; }
  if ((m = l.match(/^(draw a card|you create a treasure token|you gain (\d+) life) if (?:that|target) player (has more cards in hand|controls more lands|has more life) than each other player$/))){ const pid = r19Player(ctx); if (pid){ const val = p => { if (/cards/.test(m[3])){ if (p === MYPID) return S.hand.length; const o = OPP.get(p) || {}; return o.hc ?? (o.hand || []).length ?? 0; } if (/lands/.test(m[3])) return r19Board(p).filter(c => c.k && isLand(c.k)).reduce((a, c) => a + (c.n || 1), 0); return p === MYPID ? S.life : ((OPP.get(p) || {}).life || 0); }; const v = val(pid); if (players().every(p => p.pid === pid || val(p.pid) < v)){ if (/^draw/.test(m[1])) draw(1); else if (/treasure/.test(m[1])) await createFromText('Create a Treasure token', ctx); else gainLife(+m[2], ctx.name); } } commit(); return true; }
  if ((m = l.match(/^~ deals damage to each creature your opponents control equal to the total mana value of other spells you've cast this turn$/))){ const t = turnStr(); const list = (S.casts || []).filter(x => x.t === t); let n = list.reduce((a, x) => a + (info(x.k)?.mv || 0), 0); const self = list.slice().reverse().find(x => x.k === ctx.k); if (self) n -= info(self.k)?.mv || 0; if (n > 0) for (const [pid, st] of OPP) (st.bf || []).forEach(c => { if (c.k && isCreatureCard(c)) dealDamage({t:'card', pid, id:c.id, k:c.k}, n, ctx.k, null); }); return true; }
  if ((m = l.match(/^if you sacrificed a creature this way, you may return another permanent card from your graveyard to the battlefield$/))){ if (ctx.sacCnt > 0){ const sk = ctx.sacd && ctx.sacd.k; let skipped = false; const list = S.gy.filter(c => { if (!isPermType(info(c.k)?.t)) return false; if (!skipped && c.k === sk && c === S.gy.slice().reverse().find(x => x.k === sk)){ skipped = true; return false; } return true; }); const ids = list.length ? await pickCards({title:`${ctx.name}: return another permanent card to the battlefield?`, cards:list, min:0, max:1, noneLabel:'Don’t'}) : []; if (ids && ids[0]) moveCard(ids[0], 'bf'); } commit(); return true; }
  if ((m = l.match(/^return it to its owner's hand$/)) && /becomes blocked, you may return it to its owner's hand/i.test(info(ctx.k)?.o || '')){ const id = ctx.it && ctx.it.evId; const c = id != null && S.bf.find(x => x.id === id); if (c) moveCard(c.id, 'hand'); commit(); return true; }
  if ((m = l.match(/^shuffle any number of target cards from your graveyard into your library$/))){ let g, n = 0; while (ctx.tgts && (g = nextTargets(ctx)).length) g.forEach(t => { if (find(t.id)[0] === 'gy'){ moveCard(t.id, 'lib'); n++; } }); if (n) shuffleLib(); commit(); return true; }
  if ((m = l.match(/^it deals damage to (?:target|defending) player equal to the number of artifacts they control$/))){ const pid = r19Player(ctx); if (pid){ const n = r19Board(pid).filter(c => c.k && /Artifact/.test(info(c.k)?.t || '')).reduce((a, c) => a + (c.n || 1), 0); if (n) dealDamage({t:'player', pid}, n, ctx.k, src()); } return true; }
  if ((m = l.match(/^if that land is a plains, you may return that nonland permanent card to the battlefield instead$/))){ const lk = ctx.it && ctx.it.evk; const t = (ctx.lastT || [])[0]; if (lk && descOk(lk, 'plains') && t && find(t.id)[0] === 'hand' && (UI.dry || await askYes(`${ctx.name}: put it onto the battlefield instead?`))) moveCard(t.id, 'bf'); commit(); return true; }
  if ((m = l.match(/^target player scries x$/))){ const x = r19X(ctx); const t = tgt(); if (t && x){ if ((t.pid || MYPID) === MYPID) await say(`Scry ${x}`); else handWarn(`${t.nm || nameOf(t.pid)} scries ${x} (${ctx.name})`, ctx); } return true; }
  if ((m = l.match(/^exile up to x target cards from graveyards$/))){ let g; while (ctx.tgts && (g = nextTargets(ctx)).length) g.forEach(t => { if (t.pid === MYPID || !t.pid){ if (find(t.id)[0] === 'gy') moveCard(t.id, 'ex'); } else sendRq(t.pid, 'gytake', 0, ctx.name, {d:t.k, ex:1}); }); commit(); return true; }
  if ((m = l.match(/^it deals (\d+) damage to its controller$/)) && /^whenever a goaded creature attacks/im.test(info(ctx.k)?.o || '')){ const pid = ctx.it && ctx.it.evPid; if (pid) dealDamage({t:'player', pid}, +m[1], ctx.k, src()); return true; }
  if ((m = l.match(/^target player puts the cards in their hand on the bottom of their library in any order$/)) && /then draws that many cards/i.test(info(ctx.k)?.o || '')){ const pid = r19Player(ctx) || MYPID; if (pid === MYPID){ const n = S.hand.length; const ids = n > 1 && !UI.dry ? await pickCards({title:`${ctx.name}: order for the bottom (first picked goes deepest)`, cards:S.hand.slice(), min:n, max:n}) : S.hand.map(c => c.id); (ids || S.hand.map(c => c.id)).forEach(id => { const c = find(id)[2]; if (c){ S.hand.splice(S.hand.indexOf(c), 1); S.lib.push(c); } }); ctx.r19puzzle = n; } else handWarn(`${nameOf(pid)} puts their hand on the bottom of their library and draws that many (${ctx.name})`, ctx); commit(); return true; }
  if ((m = l.match(/^draws that many cards$/)) && ctx.r19puzzle != null){ if (ctx.r19puzzle) draw(ctx.r19puzzle); commit(); return true; }
  if ((m = l.match(/^if the discarded card wasn't a land card, (.+)$/))){ const d = ctx.it && ctx.it.disc; if (d && !isLand(d.k)) await say(tail(m[1])); return true; }
  if ((m = l.match(/^remove up to (\w+) counters from target permanent$/))){ const n = wn(m[1]) || 1; const t = tgt(); if (t){ const c = t.pid === MYPID && S.bf.find(x => x.id === t.id); if (c){ let left = n; const take = (key, get, set) => { const v = Math.min(left, get()); if (v > 0 && (UI.dry || true)){ set(get() - v); left -= v; } }; if (c.cm) take('cm', () => c.cm, v => { c.cm = v; }); for (const k of Object.keys(c.nc || {})) take(k, () => c.nc[k], v => addNamed(c, k, v - c.nc[k])); if (left && c.cp) take('cp', () => c.cp, v => { c.cp = v; }); commit(); } else handWarn(`Remove up to ${n} counters from ${t.nm || 'that permanent'} (${ctx.name})`, ctx); } return true; }
  if ((m = l.match(/^target opponent exiles the top half of their library, rounded up$/))){ const t = tgt(); if (t && t.pid && t.pid !== MYPID){ const o = OPP.get(t.pid) || {}; const n = Math.ceil((o.lc ?? (o.lib || []).length ?? 0) / 2); if (n) sendRq(t.pid, 'exileTop', n, ctx.name); } return true; }
  if ((m = l.match(/^exile two target permanents$/))){ for (let i = 0; i < 2; i++){ const g = ctx.tgts ? nextTargets(ctx) : []; g.forEach(t => applyTo(t, {op:'exile', src:ctx.name})); if (g.length > 1) break; } return true; }
  if ((m = l.match(/^(?:target|defending) player exiles the top (\w+) cards of their library$/))){ const n = wn(m[1]) || 1; const pid = r19Player(ctx); if (pid === MYPID){ S.lib.slice(0, n).forEach(c => moveCard(c.id, 'ex')); } else if (pid) sendRq(pid, 'exileTop', n, ctx.name); commit(); return true; }
  if ((m = l.match(/^if the discovered card's mana value is less than (\d+), create a number of tapped treasure tokens equal to the difference$/))){ const mv = ctx.discMV; if (mv != null && mv < +m[1]) for (let i = 0; i < +m[1] - mv; i++) await createFromText('Create a tapped Treasure token', ctx); return true; }
  if ((m = l.match(/^that source's controller sacrifices (\d+|that many) permanents of their choice$/))){ const n = /\d/.test(m[1]) ? +m[1] : ((ctx.it && ctx.it.evN) || 0); if (!n || UI.dry) return true; const pid = await choosePlayer(`${ctx.name}: who controls the source of the damage?`); if (!pid) return true; if (pid === MYPID){ const list = S.bf.filter(c => !c.fd); const ids = await pickCards({title:`${ctx.name}: sacrifice ${n} permanents`, cards:list, min:Math.min(n, list.length), max:Math.min(n, list.length)}); (ids || []).forEach(id => sacrificeOne(find(id)[2])); } else sendRq(pid, 'sac', n, ctx.name, {d:'permanent'}); commit(); return true; }
  // ---- batch 6 ----
  if ((m = l.match(/^(?:you may )?put any number of permanent cards with mana value x or less from among them onto the battlefield$/)) && ctx.r19rev){ const x = r19X(ctx); const ok = ctx.r19rev.filter(c => find(c.id)[0] === 'lib' && isPermType(info(c.k)?.t) && (info(c.k)?.mv || 0) <= x); const ids = ok.length ? await pickCards({title:`${ctx.name}: permanent cards with mana value ${x} or less to put onto the battlefield`, cards:ok, min:0, max:ok.length, noneLabel:'None'}) : []; (ids || []).forEach(id => moveCard(id, 'bf')); commit(); return true; }
  if ((m = l.match(/^put all cards revealed this way that weren't put onto the battlefield into your graveyard$/)) && ctx.r19rev){ ctx.r19rev.filter(c => find(c.id)[0] === 'lib').forEach(c => moveCard(c.id, 'gy')); commit(); return true; }
  if ((m = l.match(/^you may put any number of permanent cards with mana value x or less from among them onto the battlefield\. then put all cards revealed this way that weren't put onto the battlefield into your graveyard$/))){ const x = r19X(ctx); const rev = (ctx.r19rev || []).filter(c => find(c.id)[0] === 'lib'); const ok = rev.filter(c => isPermType(info(c.k)?.t) && (info(c.k)?.mv || 0) <= x); const ids = ok.length ? await pickCards({title:`${ctx.name}: permanent cards with mana value ${x} or less to put onto the battlefield`, cards:ok, min:0, max:ok.length, noneLabel:'None'}) : []; (ids || []).forEach(id => moveCard(id, 'bf')); rev.filter(c => find(c.id)[0] === 'lib').forEach(c => moveCard(c.id, 'gy')); commit(); return true; }
  if ((m = l.match(/^reveal the top x cards of your library$/)) && /from among them onto the battlefield\. Then put all cards revealed this way that weren't put onto the battlefield into your graveyard/i.test(info(ctx.k)?.o || '')){ const x = r19X(ctx); ctx.r19rev = S.lib.slice(0, x); log(`${ctx.name}: revealed ${ctx.r19rev.map(cname).join(', ') || 'nothing'}`); return true; }
  if ((m = l.match(/^return any number of target aura and\/or equipment cards from your graveyard to the battlefield attached to (enchanted|equipped) creature$/))){ const sc = src(); const host = sc && sc.att; let g; while (ctx.tgts && (g = nextTargets(ctx)).length) g.forEach(t => { if (find(t.id)[0] !== 'gy') return; moveCard(t.id, 'bf'); const c = S.bf.find(x => x.id === t.id); if (c && host) c.att = {pid:host.pid, id:host.id}; }); commit(); return true; }
  if ((m = l.match(/^if it's not a token, create a token that's a copy of it, except it's an artifact in addition to its other types$/))){ const id = ctx.srcId ?? (ctx.it && ctx.it.evId); const z = id != null ? find(id)[0] : null; if (z && z !== 'bf'){ await createToken(ctx.k, 1); const tk = S.bf.filter(c => c.tok && c.k === ctx.k).pop(); if (tk) addXType(tk, 'artifact'); } commit(); return true; }
  if ((m = l.match(/^(?:you may )?exile that card from your graveyard$/)) && /^Whenever you discard a card, you may exile that card from your graveyard\. If you do, /m.test(info(ctx.k)?.o || '')){ const id = ctx.it && ctx.it.evId; const k = ctx.it && (ctx.it.evk || (ctx.it.evKs || [])[0]); const c = (id != null && S.gy.find(x => x.id === id)) || (k && S.gy.slice().reverse().find(x => x.k === k)); if (c){ moveCard(c.id, 'ex'); ctx.lastT = [{t:'card', pid:MYPID, id:c.id, k:c.k}]; ctx.lastExC = c; ctx.didPay = true; } else ctx.didPay = false; commit(); return true; }
  if ((m = l.match(/^create a tapped colorless land token named everywhere that is every basic land type$/))){ const k = 'c:everywhere|land'; if (!DICT.has(k)) DICT.set(k, {k, n:'Everywhere', m:'', t:'Token Land — Plains Island Swamp Mountain Forest', o:'({T}: Add {W}, {U}, {B}, {R}, or {G}.)', p:'', img:'', c:'', back:null, toks:[], tok:true, cc:false, lay:'token', full:'Everywhere', set:'', cn:'', pr:'', art:'', mv:0, ci:'', kw:[]}); await createToken(k, 1, null, {tapped:true}); commit(); return true; }
  // ---- batch 7 ----
  if ((m = l.match(/^creatures you control gain first strike until end of turn if a creature you control has first strike$/))){ const o = String(info(ctx.k)?.o || '').toLowerCase(); const mm = o.match(/the same is true for ([a-z ,]+?)\./); const kws = ['first strike'].concat(mm ? mm[1].split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim()).filter(Boolean) : []); const mine = S.bf.filter(c => isCreatureCard(c) && !c.fd); const have = kws.filter(k => mine.some(c => kwOf(c, k))); if (have.length){ mine.forEach(c => { c.ekw = [...new Set([...(c.ekw || []), ...have])]; }); log(`${ctx.name}: creatures gain ${have.join(', ')}`); } commit(); return true; }
  if ((m = l.match(/^the same is true for ([a-z ,]+)$/)) && /creatures you control gain first strike until end of turn if a creature you control has first strike/i.test(info(ctx.k)?.o || '')) return true;
  if ((m = l.match(/^each other creature gets -(\d+)\/-(\d+) until end of turn$/))){ const c = src(); r19ShrinkAll(c, +m[1], +m[2], ctx.name); return true; }
  if ((m = l.match(/^whenever a creature dies this turn, each creature other than ~ gets -(\d+)\/-(\d+) until end of turn$/))){ const c = src(); S.r19mg = (S.r19mg || []).filter(x => x.t === turnStr()).concat({t:turnStr(), srcId:c ? c.id : null, p:+m[1], q:+m[2], nm:ctx.name}); commit(); return true; }
  if ((m = l.match(/^reveal a card from your hand or the top card of your library$/)) && /If you reveal a creature card this way, put it onto the battlefield/i.test(info(ctx.k)?.o || '')){ const list = S.hand.slice().concat(S.lib.slice(0, 1)); const ids = list.length ? await pickCards({title:`${ctx.name}: reveal a card from your hand or the top of your library`, cards:list, min:0, max:1, noneLabel:'Reveal nothing'}) : []; const c = ids && ids[0] != null ? find(ids[0])[2] : null; ctx.r19revC = c || null; if (c) log(`${ctx.name}: revealed ${cname(c)}`); return true; }
  if ((m = l.match(/^if you reveal a creature card this way, put it onto the battlefield$/))){ const c = ctx.r19revC; if (c && isCreatureCard(c) && ['hand', 'lib'].includes(find(c.id)[0])) moveCard(c.id, 'bf'); commit(); return true; }
  if ((m = l.match(/^target player searches their library for a card and puts it on top after shuffling$/))){ const t = tgt(); const pid = t ? (t.pid || MYPID) : null; if (pid === MYPID) await say('Search your library for a card to put on top of your library'); else if (pid) handWarn(`${nameOf(pid)} searches their library for a card, then shuffles and puts it on top (${ctx.name})`, ctx); return true; }
  if ((m = l.match(/^choose any number of target creatures you control$/)) && /^For each of them, create a token that's a copy of that creature, except it has haste/im.test(String(info(ctx.k)?.o || '').replace(/\.\s+/g, '.\n'))){ const all = []; let g; while (ctx.tgts && (g = nextTargets(ctx)).length) all.push(...g); ctx.r19chosen = all; return true; }
  if ((m = l.match(/^for each of them, create a token that's a copy of that creature, except it has haste$/))){ ctx.r19toks = []; for (const t of (ctx.r19chosen || [])){ const c = S.bf.find(x => x.id === t.id) || null; const k = (c && c.k) || t.k; if (!k) continue; const before = new Set(S.bf.map(x => x.id)); await createToken(k, 1, null, {tapped:false}); const tk = S.bf.find(x => !before.has(x.id) && x.k === k) || S.bf.filter(x => x.tok && x.k === k).pop(); if (tk){ tk.ekw = [...new Set([...(tk.ekw || []), 'haste'])]; ctx.r19toks.push(tk.id); ctx.lastCardId = tk.id; } } ctx.lastTok = ctx.r19toks.slice(); commit(); return true; }
  if ((m = l.match(/^exile those tokens at the beginning of the next end step$/)) && ctx.r19toks){ ctx.r19toks.forEach(id => S.dly.push({id:rid(6), eff:'Exile it.', k:ctx.k, nm:ctx.name, srcId:id, op:'exile'})); log(`${ctx.name}: exile those tokens at the next end step`); commit(); return true; }
  if ((m = l.match(/^remove an? (\w+) counter from ~$/))){ const c = src(); if (c && ((c.nc || {})[m[1]] || 0) > 0) addNamed(c, m[1], -1); commit(); return true; }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){
    const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase();
    if (l && await doRound19aPre(s, l, ctx)) return;
    return ds(s0, ctx);
  };
  const re = runEffects;
  runEffects = async function(txt, ctx){
    let t = String(txt || '');
    t = t.replace(/Target player searches their library for a card, then shuffles and puts that card on top\./g, 'Target player searches their library for a card and puts it on top after shuffling.');
    t = t.replace(/Target player draws (a card|\w+ cards), then discards (a card|\w+ cards)\./g, 'Target player draws $1 and discards $2.');
    t = t.replace(/Each player discards all the cards in their hand, then draws that many cards minus one\./g, 'Each player discards all the cards in their hand and draws that many cards minus one.');
    return re(t, ctx);
  };
}

// remember what was sacrificed: “the sacrificed creature's power”, “if you can't”
function r19NoteSac(c){ if (!c || !c.k) return; const rec = {k:c.k, cp:c.cp || 0, cm:c.cm || 0, cmd:!!c.cmd, tok:!!c.tok}; if (UI.curCtx){ UI.curCtx.sacCnt = (UI.curCtx.sacCnt || 0) + 1; UI.curCtx.sacd = rec; } if (UI.casting) UI.castSac = rec; }
{
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ if (o && o.sac && S){ const [from, , c] = find(id); if (from === 'bf') r19NoteSac(c); } return mc(id, to, o); };
  const so = sacrificeOne;
  sacrificeOne = function(c){ if (c && (c.n || 1) > 1) r19NoteSac(c); return so(c); };
  const bc = beginCast;
  beginCast = async function(c, zone, o = {}){ UI.castSac = null; const n0 = S.stk.length; try { return await bc(c, zone, o); } finally { const it = S.stk[S.stk.length - 1]; if (UI.castSac && S.stk.length > n0 && it && it.card === c) it.sacd = UI.castSac; UI.castSac = null; } };
}

// creatures that died this turn (all players); Teferi's sorcery flash; cards that shuffle away from any graveyard
const R19SH = new Map();
function r19ShufK(k){ if (!R19SH.has(k)) R19SH.set(k, /^When (?:~|this \w+) is put into a graveyard from anywhere, (?:its owner shuffles their graveyard into their library|shuffle it into its owner's library)\.?$/im.test(tname(info(k)?.o || '', info(k)?.n || ''))); return R19SH.get(k); }
function r19Died(){ return S && S.r19d && S.r19d.t === turnStr() ? S.r19d.n : 0; }
{
  const he = handleEvent;
  handleEvent = function(pid, ev){ try { if (S && ev && ev.type === 'die'){ if (!S.r19d || S.r19d.t !== turnStr()) S.r19d = {t:turnStr(), n:0}; S.r19d.n += ev.cnt || 1; } } catch {} return he(pid, ev); };
  const to = timingOk;
  timingOk = function(c){ const r = to(c); if (r && !r.ok && S && S.r19sf && /\bSorcery\b/.test(info(c.k)?.t || '') && phaseNow().n > 0 && !/split second/i.test(r.why || '')) return {ok:true}; return r; };
  const tc = turnChanged;
  turnChanged = function(...a){ const r = tc.apply(this, a); try { if (S && S.r19sf && currentTurn()[1] === MYPID && turnStr() !== S.r19sf){ S.r19sf = null; } if (S){ const mine = currentTurn()[1] === MYPID; S.bf.forEach(c => { if (!c.ekwNT) return; if (mine && c.ekwNTt !== turnStr()) { delete c.ekwNT; delete c.ekwNTt; } else c.ekw = [...new Set([...(c.ekw || []), ...c.ekwNT])]; }); } } catch {} return r; };
  const cm = commit;
  commit = function(...a){
    try { if (S && !UI.dry && S.gy && S.gy.length){ const hit = S.gy.filter(c => r19ShufK(c.k)); for (const c of hit){ if (!S.gy.includes(c)) continue; const all = /its owner shuffles their graveyard/i.test(info(c.k)?.o || ''); const list = all ? S.gy.slice() : [c]; list.forEach(x => { S.gy.splice(S.gy.indexOf(x), 1); reset(x); S.lib.push(x); }); shuffle(S.lib); log(`${cname(c)}: shuffled ${all ? 'the graveyard' : 'itself'} into the library`); } } } catch (e){ console.warn(e); }
    return cm.apply(this, a);
  };
}
STATIC_KNOWN.push(/^when ~ is put into a graveyard from anywhere, (?:its owner shuffles their graveyard into their library|shuffle it into its owner's library)$/);

const R19P = new Map();
function r19Parse(k, tag, re){ const key = tag + '|' + k; if (!R19P.has(key)) R19P.set(key, tname(info(k)?.o || '', info(k)?.n || '').toLowerCase().match(re)); return R19P.get(key); }
// the city's blessing (ascend); tokens that entered this turn
function r19City(){ if (!S) return false; if (S.cityB) return true; const asc = S.bf.some(c => !c.fd && /^Ascend\b/im.test(info(c.k)?.o || '')) || (UI.curCtx && /^Ascend\b/im.test(info(UI.curCtx.k)?.o || '')); if (asc && S.bf.reduce((a, c) => a + (c.n || 1), 0) >= 10){ S.cityB = true; log('got the city\u2019s blessing'); } return !!S.cityB; }
{
  const he = handleEvent;
  handleEvent = function(pid, ev){ try { if (S && pid === MYPID && ev && ev.type === 'enter' && ev.tok){ if (!S.r19ent || S.r19ent.t !== turnStr()) S.r19ent = {t:turnStr(), list:[]}; S.r19ent.list.push({k:ev.k, n:ev.cnt || 1}); if (S.r19ent.list.length > 60) S.r19ent.list.shift(); } } catch {} return he(pid, ev); };
  const cm = commit;
  commit = function(...a){ try { if (S && !UI.dry && !S.cityB) r19City(); } catch {} return cm.apply(this, a); };
  const xa = xAnthems;
  xAnthems = function(c, ownerPid){ const r = xa(c, ownerPid); try { if (S && ownerPid === MYPID && c && S.cityB){ for (const s of S.bf){ if (!s.k || s.fd) continue; const mm = r19Parse(s.k, 'city', /^(other )?(.+?) you control get \+(\d+)\/\+(\d+) as long as you have the city's blessing\.?$/m); if (!mm) continue; if (mm[1] && s.id === c.id) continue; if (!descOk(c.k, sing(mm[2]), {tok:c.tok, face:faceOf(c)})) continue; r[0] += +mm[3]; r[1] += +mm[4]; } } } catch {} return r; };
}
STATIC_RULES.push(
  [/^(other )?(.+?) you control get \+(\d+)\/\+(\d+) as long as you have the city's blessing$/, m => ({kind:'noop'})],
  [/^you may cast (artifact|enchantment|creature|instant|noncreature) spells as though they had flash$/, m => ({kind:'allFlash', who:'you', desc:m[1]})],
);

// remember the cards milled by this effect
{
  const ml = mill;
  mill = function(...a){ const before = S ? S.gy.slice() : []; const r = ml.apply(this, a); try { if (S && UI.curCtx){ const got = S.gy.filter(c => !before.includes(c)); UI.curCtx.milled2 = (UI.curCtx.milled2 || []).concat(got); } } catch {} return r; };
}

// discovered card's mana value; the card discarded as an additional cost
{
  const ru = revealUntil;
  revealUntil = async function(...a){ const r = await ru.apply(this, a); try { UI.r19hit = r && r.hit || null; } catch {} return r; };
  const dc = discover;
  discover = async function(n, ctx){ UI.r19hit = null; const r = await dc(n, ctx); try { if (ctx) ctx.discMV = UI.r19hit ? (info(UI.r19hit.k)?.mv || 0) : (UI.dry ? null : 0); } catch {} return r; };
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ if (UI.casting && to === 'gy' && S){ const [from, , c] = find(id); if (from === 'hand' && c) UI.castDisc = {k:c.k}; } return mc(id, to, o); };
  const bc = beginCast;
  beginCast = async function(c, zone, o = {}){ UI.castDisc = null; const n0 = S.stk.length; try { return await bc(c, zone, o); } finally { const it = S.stk[S.stk.length - 1]; if (UI.castDisc && S.stk.length > n0 && it && it.card === c) it.disc = UI.castDisc; UI.castDisc = null; } };
}

// “Whenever ~ becomes untapped”, “When you play another land”, “Whenever a player plays a land”
EV_TYPES.push('untapped');
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){
    if (/^~ becomes untapped$/.test(c)) return {ev:'untapped', subj:'self', ctl:'you', desc:''};
    if (/^you play another land$/.test(c)) return {ev:'land', subj:'any', ctl:'you', desc:'', r19other:true};
    if (/^a player plays a land$/.test(c)) return {ev:'land', subj:'any', ctl:'any', desc:''};
    return ct(w, c);
  };
  const sm = subjMatch;
  subjMatch = function(t, src, ev, pid){
    if (ev && ev.type === 'untapped') return pid === MYPID && ev.id === src.id;
    if (ev && ev.type === 'land' && t && t.r19other && pid === MYPID && ev.id === src.id) return false;
    return sm(t, src, ev, pid);
  };
  const R19UT = new Map();
  const utK = k => { if (!R19UT.has(k)) R19UT.set(k, /^whenever (?:~|this \w+) becomes untapped,/im.test(tname(info(k)?.o || '', info(k)?.n || ''))); return R19UT.get(k); };
  const cm = commit;
  commit = function(...a){
    try { if (S && !UI.dry){ UI.r19tap = UI.r19tap || new Map(); for (const c of S.bf){ if (!c.k || c.fd || !utK(c.k)) continue; const was = UI.r19tap.get(c.id); if (was && !c.tap) emit({type:'untapped', k:c.k, id:c.id, cnt:1}); UI.r19tap.set(c.id, !!c.tap); } } } catch {}
    return cm.apply(this, a);
  };
}
// Delirium — “instead” alternatives (Demonic Counsel)
function r19Delirium(){ const ty = new Set(); for (const c of S.gy){ const t = info(c.k)?.t || ''; ['Artifact', 'Battle', 'Creature', 'Enchantment', 'Instant', 'Kindred', 'Land', 'Planeswalker', 'Sorcery'].forEach(x => { if (new RegExp('\\b' + x + '\\b').test(t.split('—')[0])) ty.add(x); }); } return ty.size >= 4; }
{
  const re = runEffects;
  runEffects = async function(txt, ctx){
    let t = String(txt || ''); const m = t.match(/^([^\n]+)\n(?:Delirium — )?If there are four or more card types among cards in your graveyard, instead ([^\n]+)$/);
    if (m && S) t = r19Delirium() ? cap(m[2]) : m[1];
    return re(t, ctx);
  };
}
STATIC_RULES.push([/^~ gets \+(\d+)\/\+(\d+) as long as (?:you have (\d+) or more life|there are (\w+) or more land cards in your graveyard)$/, m => ({kind:'noop'})]);
{
  const xa = xAnthems;
  xAnthems = function(c, ownerPid){ const r = xa(c, ownerPid); try { if (S && ownerPid === MYPID && c && c.k && S.bf.includes(c)){ const mm = r19Parse(c.k, 'selfa', /^~ gets \+(\d+)\/\+(\d+) as long as (?:you have (\d+) or more life|there are (\w+) or more land cards in your graveyard)\.?$/m); if (mm){ const ok = mm[3] ? S.life >= +mm[3] : S.gy.filter(g => isLand(g.k)).length >= (wn(mm[4]) || 0); if (ok){ r[0] += +mm[1]; r[1] += +mm[2]; } } } } catch {} return r; };
}

// Massacre Girl: shrink every other creature, again whenever a creature dies this turn
function r19ShrinkAll(srcC, p, q, nm){ for (const b of boardsAll()) b.bf.forEach(c => { if (!c.k || !isCreatureCard(c) || (b.pid === MYPID && srcC && c.id === srcC.id)) return; if (b.pid === MYPID) c.pu = [(c.pu ? c.pu[0] : 0) - p, (c.pu ? c.pu[1] : 0) - q]; else applyTo({t:'card', pid:b.pid, id:c.id, k:c.k}, {op:'pump', src:nm, f:{p:-p, t:-q, kw:[]}}); }); commit(); }
{
  const he = handleEvent;
  handleEvent = function(pid, ev){ const r = he(pid, ev); try { if (S && !UI.dry && ev && ev.type === 'die' && S.r19mg && S.r19mg.length){ S.r19mg = S.r19mg.filter(x => x.t === turnStr()); S.r19mg.forEach(x => { const c = x.srcId != null ? S.bf.find(y => y.id === x.srcId) : null; log(`${x.nm}: a creature died — each other creature gets -${x.p}/-${x.q}`); r19ShrinkAll(c, x.p, x.q, x.nm); }); } } catch {} return r; };
}
// Dark Depths: no ice counters left → sacrifice it and create Marit Lage
STATIC_KNOWN.push(/^when ~ has no ice counters on it, sacrifice it$/, /^if you do, create marit lage, a legendary 20\/20 black avatar creature token with flying and indestructible$/);
{
  const cm = commit;
  commit = function(...a){
    try { if (S && !UI.dry){ for (const c of S.bf.slice()){ if (!c.k || c.fd || !c.nc || c.nc.ice !== 0 || c.r19dd) continue; if (!/^When (?:~|this \w+) has no ice counters on it, sacrifice it\. If you do, create Marit Lage/im.test(tname(info(c.k)?.o || '', info(c.k)?.n || ''))) continue; c.r19dd = 1; moveCard(c.id, 'gy', {sac:true}); const k = 'c:marit lage|20/20|B'; if (!DICT.has(k)) DICT.set(k, {k, n:'Marit Lage', m:'', t:'Legendary Token Creature — Avatar', o:'Flying, indestructible', p:'20/20', img:'', c:'B', back:null, toks:[], tok:true, cc:false, lay:'token', full:'Marit Lage', set:'', cn:'', pr:'', art:'', mv:0, ci:'', kw:['Flying', 'Indestructible']}); createToken(k, 1); log(`${cname(c)}: no ice counters — sacrificed it and created Marit Lage`); } } } catch (e){ console.warn(e); }
    return cm.apply(this, a);
  };
}
