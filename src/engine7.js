
/* ===================== Rules engine — round 7: turns, monarch, initiative & dungeons, emblems, adventures, split/MDFC, foretell, morph, cascade, storm, cast triggers, hand attacks, piles, replacements, misc ===================== */

/* ---------- Helpers ---------- */
function costMV(m){ return (String(m || '').match(/\{[^}]+\}/g) || []).reduce((s, x) => { const v = x.slice(1, -1); if (/^\d+$/.test(v)) return s + +v; if (/^[XYZ]$/i.test(v)) return s; const h = v.match(/^(\d+)\//); return s + (h ? +h[1] : 1); }, 0); }
function deriveFace(k){
  if (typeof k !== 'string') return null; const i = k.lastIndexOf('#'); if (i < 0) return null;
  const base = DICT.get(k.slice(0, i)); if (!base) return null; const w = k.slice(i + 1); let f = null;
  if (w === 'b') f = base.back; else if (w === 'fd') f = {n:'Face-down creature', m:'{3}', t:'Creature', o:'', p:'2/2'}; else f = base.faces && base.faces[+w];
  if (!f) return null;
  const e = {...base, k, n:f.n, m:f.m || '', t:f.t || '', o:f.o || '', p:f.p || '', mv:costMV(f.m), back:null, faces:null, lay:'face', base:base.k, img:f.img || base.img, kw:[]};
  if (w === 'fd'){ e.c = ''; e.mv = 0; }
  DICT.set(k, e); return e;
}
function pushTrig(nm, txt, extra = {}){
  const it = {sid:rid(6), o:nextO(), kind:'trigger', k:extra.k || null, nm, txt, srcId:extra.srcId ?? null, ...extra};
  S.stk.push(it); S.pass = 's:' + it.sid; log(`trigger: ${nm} — ${short(txt, 90)}`); commit(); return it;
}
const topClock = f => Math.max(S[f] || 0, ...[...OPP.values()].map(s => s[f] || 0));
function holderOf(f){ let best = S[f] ? {pid:MYPID, v:S[f]} : null; for (const [pid, s] of OPP){ if ((s[f] || 0) > (best ? best.v : 0)) best = {pid, v:s[f]}; } return best ? best.pid : null; }
function waitUntil(fn, ms){ if (UI.dry) return Promise.resolve(null); return new Promise(res => { const t0 = Date.now(); const tick = () => { let v; try { v = fn(); } catch {} if (v) return res(v); if (Date.now() - t0 > ms) return res(null); setTimeout(tick, 200); }; tick(); }); }

/* ---------- Monarch and initiative ---------- */
function becomeMonarch(why){ if (holderOf('mon') === MYPID) return; S.mon = topClock('mon') + 1; log(`👑 became the monarch${why ? ' (' + why + ')' : ''}`); commit(); }
async function takeInitiative(why){ const had = holderOf('ini') === MYPID; S.ini = topClock('ini') + 1; log(`🗡 took the initiative${why ? ' (' + why + ')' : ''}`); commit(); await venture(true); return had; }
function r7CombatHit(defPid){
  if (holderOf('mon') === defPid) becomeMonarch('combat damage to the monarch');
  if (holderOf('ini') === defPid) pushTrig('The initiative', 'Take the initiative.', {});
}
function r7Steps(step, pn){
  if (!pn.mine) return; const ts = turnStr();
  if (step === 'end' && holderOf('mon') === MYPID && S.monT !== ts){ S.monT = ts; pushTrig('The monarch', 'Draw a card.'); }
  if (step === 'upkeep' && holderOf('ini') === MYPID && S.iniT !== ts){ S.iniT = ts; pushTrig('The initiative', 'Venture into Undercity.'); }
}

/* ---------- Dungeons ---------- */
const DUNGEONS = {
  'Lost Mine of Phandelver': [
    ['Cave Entrance', 'Scry 1.', [1, 2]], ['Goblin Lair', 'Create a 1/1 red Goblin creature token.', [3, 4]], ['Mine Tunnels', 'Create a Treasure token.', [4, 5]],
    ['Storeroom', 'Put a +1/+1 counter on target creature.', [6]], ['Dark Pool', 'Each opponent loses 1 life and you gain 1 life.', [6]], ['Fungi Cavern', 'Target creature gets -4/-0 until your next turn.', [6]],
    ['Temple of Dumathoin', 'Draw a card.', []]],
  'Dungeon of the Mad Mage': [
    ['Yawning Portal', 'You gain 1 life.', [1]], ['Dungeon Level', 'Scry 1.', [2, 3]], ['Goblin Bazaar', 'Create a Treasure token.', [4]], ['Twisted Caverns', "Target creature can't attack until your next turn.", [4]],
    ['Lost Level', 'Scry 2.', [5, 6]], ['Runestone Caverns', 'Exile the top two cards of your library. You may play them.', [7]], ["Muiral's Graveyard", 'Create two 1/1 black Skeleton creature tokens.', [7]],
    ['Deep Mines', 'Scry 3.', [8]], ["Mad Wizard's Lair", 'Draw three cards and reveal them. You may cast one of them without paying its mana cost.', []]],
  'Tomb of Annihilation': [
    ['Trapped Entry', 'Each player loses 1 life.', [1, 2]], ['Veils of Fear', 'Each player loses 2 life unless they discard a card.', [3]], ['Oubliette', 'Discard a card and sacrifice an artifact, a creature, and a land.', [4]],
    ['Sandfall Cell', 'Each player loses 2 life unless they sacrifice an artifact, a creature, or a land.', [4]], ['Cradle of the Death God', 'Create a 4/4 black God Horror creature token with deathtouch.', []]],
  'Undercity': [
    ['Secret Entrance', 'Search your library for a basic land card, reveal it, put it into your hand, then shuffle.', [1, 2]], ['Forge', 'Put two +1/+1 counters on target creature.', [3, 4]], ['Lost Well', 'Scry 2.', [4, 5]],
    ['Trap!', 'Target player loses 5 life.', [6]], ['Arena', 'Goad target creature.', [6, 7]], ['Stash', 'Create a Treasure token.', [7]],
    ['Archives', 'Draw a card.', [8]], ['Catacombs', 'Create a 4/1 black Skeleton creature token with menace.', [8]],
    ['Throne of the Dead Three', 'Reveal the top ten cards of your library. Put a creature card from among them onto the battlefield with three +1/+1 counters on it. It gains hexproof until your next turn. Then shuffle.', []]],
};
async function venture(under){
  let dg = S.dg;
  if (dg && !DUNGEONS[dg.d]?.[dg.r]?.[2].length){ S.dgDone = (S.dgDone || 0) + 1; S.dgList = (S.dgList || []).concat(dg.d); log(`completed ${dg.d}`); dg = null; }
  let room;
  if (!dg){
    let d = 'Undercity';
    if (!under){ d = await askChoice({title:'Venture into the dungeon: which dungeon?', options:['Lost Mine of Phandelver', 'Dungeon of the Mad Mage', 'Tomb of Annihilation'].map(n => ({label:n, value:n, why:DUNGEONS[n].map(r => r[0]).join(' → ')}))}); if (!d) d = 'Lost Mine of Phandelver'; }
    dg = {d, r:0}; room = 0;
  } else {
    const nx = DUNGEONS[dg.d][dg.r][2];
    room = nx.length === 1 ? nx[0] : await askChoice({title:`${dg.d}: next room`, options:nx.map(i => ({label:DUNGEONS[dg.d][i][0], value:i, why:DUNGEONS[dg.d][i][1]}))});
    if (room == null) room = nx[0];
    dg = {d:dg.d, r:room};
  }
  S.dg = dg; const R = DUNGEONS[dg.d][room];
  log(`ventured into ${dg.d}: ${R[0]}`); pushTrig(`${dg.d} — ${R[0]}`, R[1], {});
}

/* ---------- Emblems ---------- */
function makeEmblem(text, src){
  const k = 'emb:' + norm(src + '|' + text).slice(0, 60);
  if (!DICT.has(k)) DICT.set(k, {k, n:`Emblem — ${src}`, m:'', t:'Emblem', o:text, p:'', img:'', c:'', back:null, toks:[], tok:true, cc:false, lay:'emblem', full:'', set:'', cn:'', pr:'', art:'', mv:0, ci:'', kw:[]});
  const c = {id:S.nid++, k, tok:true, emb:true, n:1}; place(c); S.bf.push(c); log(`got an emblem: “${short(text, 80)}”`); commit();
}

/* ---------- Faces: adventures, split cards, modal double-faced cards, face-down ---------- */
function faceOpts(c, zone){
  const a = info(c.k); if (!a || /#/.test(c.k)) return [];
  const out = [];
  if (a.lay === 'adventure' && a.faces && a.faces[1] && zone === 'hand') out.push({w:'1', label:`Cast ${a.faces[1].n} (adventure)`, f:a.faces[1]});
  if (a.lay === 'split' && a.faces) a.faces.forEach((f, i) => out.push({w:String(i), label:`Cast ${f.n}`, f}));
  if (a.lay === 'modal_dfc' && a.back && (zone === 'hand' || zone === 'cz')) out.push({w:'b', label:/\bLand\b/.test(a.back.t) ? `Play ${a.back.n} (back face)` : `Cast ${a.back.n} (back face)`, f:a.back, land:/\bLand\b/.test(a.back.t)});
  const mo = a.o.match(/^(Morph|Megamorph|Disguise|Cloak) ((?:\{[^}]+\})+)/m);
  if (mo && zone === 'hand') out.push({w:'fd', label:`Cast face down ({3}, ${mo[1].toLowerCase()})`, f:{n:'Face-down creature'}});
  return out;
}
async function castFace(c, zone, w, o = {}){
  const a = info(c.k);
  if (w === 'b' && a.back && /\bLand\b/.test(a.back.t)){ c.fl = true; playLand(c, o); if (find(c.id)[0] !== 'bf') c.fl = false; return; }
  const base = c.k; c.baseK = base; c.k = base + '#' + w; deriveFace(c.k);
  try { await beginCast(c, zone, o); }
  finally { if (find(c.id)[0] === zone){ c.k = base; delete c.baseK; } commit(); }
}
function faceRestore(c){
  if (!c || !c.baseK) return null; const w = c.k.split('#').pop(); c.k = c.baseK; delete c.baseK; return w;
}
function faceEnter(c){
  const w = faceRestore(c); if (w == null) return;
  if (w === 'b') c.fl = true;
  if (w === 'fd'){ c.fd = true; c.fdc = info(c.k)?.o.match(/^(Morph|Megamorph|Disguise|Cloak)/m)?.[1].toLowerCase() || 'morph'; }
}
function advExile(c, it){
  if (!c.baseK) return false; const base = info(c.baseK); const w = faceRestore(c);
  if (base && base.lay === 'adventure' && w === '1'){ c.mayPlay = {adv:true, t:turnStr()}; S.ex.push(c); log(`${cname(c)} went on an adventure (exile) — cast the creature from exile later`); return true; }
  return false;
}
function turnUpCost(c){ const m = (info(c.k)?.o || '').match(/^(Morph|Megamorph|Disguise|Cloak) ((?:\{[^}]+\})+)/m); return m ? {kind:m[1].toLowerCase(), cost:m[2]} : null; }
function turnFaceUp(c){
  const tu = turnUpCost(c); if (!tu){ toast('This card has no morph or disguise cost'); return; }
  const plan = payPlan(parseCost(tu.cost), S.pool); if (plan.err){ toast(`Turning it face up costs ${tu.cost}: ${plan.err}`); return; }
  S.pool = plan.pool; c.fd = false; delete c.fdc;
  if (tu.kind === 'megamorph') modCounters(c, 'cp', 1);
  log(`turned ${cname(c)} face up (${tu.kind} ${tu.cost})`); emit({type:'turnup', k:c.k, id:c.id}); commit();
}

/* ---------- Foretell ---------- */
const foretellCost = c => (info(c.k)?.o || '').match(/^Foretell ((?:\{[^}]+\})+)/m)?.[1] || null;
function foretell(c){
  const pn = phaseNow(); if (!pn.mine){ toast('Foretell only on your turn'); return; }
  const plan = payPlan(parseCost('{2}'), S.pool); if (plan.err){ toast(`Foretelling costs {2}: ${plan.err}`); return; }
  S.pool = plan.pool; const i = S.hand.indexOf(c); if (i < 0) return; S.hand.splice(i, 1);
  c.fd = true; c.fore = turnStr(); S.ex.push(c); log('foretold a card (exiled face down for {2})'); commit();
}

/* ---------- Cast triggers, cascade, storm ---------- */
function castTriggers(c, a, it){
  const own = tname(a.o, a.n);
  for (const line of own.split('\n')){ const m = line.trim().match(/^when(?:ever)? you cast (?:this spell|~), ([\s\S]+)$/i); if (m) pushTrig(a.n, m[1], {k:c.k, tgt:it.sid, castSid:it.sid}); }
  if (hasKwText(a, 'cascade')) pushTrig(a.n, 'Exile cards from the top until a nonland card with lower mana value; you may cast it free (cascade).', {k:c.k, cmv:it.mv || a.mv || 0});
  if (hasKwText(a, 'storm')){
    const t = turnStr(); let n = Math.max(0, (S.casts || []).filter(x => x.t === t).length - 1);
    for (const s of OPP.values()) if (s.ct === t) n += s.cn || 0;
    if (n) pushTrig(a.n, `Copy it ${n} time${n === 1 ? '' : 's'} (storm).`, {k:c.k, tgt:it.sid, storm:n}); else log(`${a.n}: storm count is 0`);
  }
}
async function doCascade(ctx){
  const mv = ctx.it && ctx.it.cmv || 0; const seen = []; let hit = null;
  while (S.lib.length){ const c = S.lib.shift(); seen.push(c); if (!isLand(c.k) && (info(c.k)?.mv || 0) < mv){ hit = c; break; } }
  S.ex.push(...seen); log(`cascade: exiled ${seen.map(cname).join(', ') || 'nothing'}`);
  let cast = false;
  if (hit && await askYes(`Cascade: cast ${cname(hit)} without paying its mana cost?`, 'Cast it', 'No')){ cast = true; }
  const rest = seen.filter(c => !(cast && c === hit)); rest.forEach(c => { const i = S.ex.indexOf(c); if (i >= 0) S.ex.splice(i, 1); }); shuffle(rest); S.lib.push(...rest);
  if (rest.length) log(`put ${rest.length} card${rest.length === 1 ? '' : 's'} on the bottom in a random order`);
  commit();
  if (cast) await beginCast(hit, 'ex', {free:true});
}
async function copyMany(ctx, n){
  const same = n > 1 ? await askChoice({title:`${ctx.name}: ${n} copies`, options:[{label:'Same targets for every copy', value:'same'}, {label:'Choose targets for each copy', value:'each'}]}) : 'each';
  const orig = stackAll().find(x => x.sid === ctx.it.tgt); if (!orig){ log(`${ctx.name}: the spell is gone`); return; }
  for (let i = 0; i < n; i++){
    if (same === 'same' && orig.pid === MYPID){ const cp = {sid:rid(6), o:nextO(), kind:'spell', k:orig.k, nm:`${orig.nm} (copy)`, txt:orig.txt, x:orig.x || 0, copy:true, tgts:orig.it && orig.it.tgts, tgtNm:orig.tgtNm, modes:orig.it && orig.it.modes}; S.stk.push(cp); S.pass = 's:' + cp.sid; }
    else await copyTargetItem(ctx);
  }
  log(`made ${n} cop${n === 1 ? 'y' : 'ies'} of ${orig.nm}`); commit();
}

/* ---------- Turns: extra turns and skips ---------- */
function r7PassTurnNext(){ if ((S.xt || 0) > 0){ S.xt--; return true; } return false; }
function skipNext(kind){ S.skip = S.skip || {}; S.skip[kind] = (S.skip[kind] || 0) + 1; }
function useSkip(kind){ if (S.skip && S.skip[kind] > 0){ S.skip[kind]--; return true; } return false; }
const goadOn = c => { if (!c.goad) return false; const [n, pid] = currentTurn(); if (pid === c.goad.by && n > c.goad.n){ delete c.goad; return false; } return true; };

/* ---------- Static replacements (Rest in Peace, Leyline of the Void, Kalitas) ---------- */
STATIC_RULES.push(
  [/^if a card or token would be put into a graveyard from anywhere, exile it instead$/, m => ({kind:'gyEx', who:'all'})],
  [/^if a card would be put into a graveyard from anywhere, exile it instead$/, m => ({kind:'gyEx', who:'all'})],
  [/^if a card would be put into an opponent's graveyard from anywhere, exile it instead$/, m => ({kind:'gyEx', who:'opp'})],
  [/^if a (nontoken )?creature an opponent controls would die, exile (?:it|that card) instead$/, m => ({kind:'dieEx', who:'opp', nontoken:!!m[1]})],
  [/^if a (nontoken )?creature would die, exile it instead$/, m => ({kind:'dieEx', who:'all', nontoken:!!m[1]})],
  [/^(creatures|nonland permanents|artifacts|lands) your opponents control (?:can't|don't) untap during their controllers' untap steps$/, m => ({kind:'noUntapAll', who:'opp', scope:sing(m[1])})],
  [/^players skip their untap steps$/, m => ({kind:'noUntapAll', who:'all', scope:''})],
);
function gyReplace(c, from){
  if (!S || UI.dry) return null;
  if (rulesOn('gyEx').length) return 'ex';
  if (from === 'bf' && isCreatureCard(c) && rulesOn('dieEx').some(r => !r.nontoken || !c.tok)) return 'ex';
  return null;
}

/* ---------- Cross-player operations ---------- */
RQ_OPS.push('reveal', 'unreveal', 'discardK', 'piles', 'pileAns', 'rampSearch', 'switch', 'goad');
{
  const ao = applyOp;
  applyOp = function(r, from){
    const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null;
    switch (r.op){
      case 'reveal': if (!S.rh){ S.rh = true; S.rhTmp = true; } log(`revealed their hand to ${nameOf(from)} (${r.src})`); commit(); return;
      case 'unreveal': if (S.rhTmp){ S.rh = false; delete S.rhTmp; } commit(); return;
      case 'discardK': { const h = S.hand.find(x => x.k === r.d); if (h){ log(`discarded ${cname(h)} (${r.src})`); moveCard(h.id, 'gy', {quiet:true}); } commit(); return; }
      case 'switch': if (c){ c.sw = !c.sw; log(`${cname(c)}'s power and toughness are switched (${r.src})`); commit(); } return;
      case 'goad': if (c){ c.goad = {by:from, n:currentTurn()[0]}; log(`${cname(c)} is goaded by ${nameOf(from)}`); commit(); } return;
      case 'rampSearch': (async () => { if (await askYes(`${r.src}: search your library for a ${r.d} card and put it onto the battlefield${r.n ? ' tapped' : ''}?`, 'Search', 'No')) await searchLibrary(`a ${r.d} card`, `put that card onto the battlefield${r.n ? ' tapped' : ''}, then shuffle`, {name:r.src}); commit(); })(); return;
      case 'piles': answerPiles(r, from); return;
      case 'pileAns': UI.pileAns = UI.pileAns || {}; UI.pileAns[r.ref] = {mask:r.n}; return;
    }
    return ao(r, from);
  };
}
async function answerPiles(r, from){
  const p = OPP.get(from)?.pile; if (!p || p.ref !== r.ref){ return; }
  const cards = p.ks.map((k, i) => ({id:i, k}));
  const ids = await pickCards({title:`${r.src} (${nameOf(from)}): split these into two piles`, hint:'Pick the cards for pile 1. Everything else is pile 2. They choose one pile for their hand.', cards, min:0, max:cards.length, noneLabel:'Pile 1 is empty'});
  const mask = (ids || []).reduce((m, i) => m | (1 << i), 0);
  sendRq(from, 'pileAns', mask, r.src, {ref:r.ref}); commit();
}

/* ---------- Effects text ---------- */
async function doRound7Pre(s, l, ctx){
  let m;
  if ((m = l.match(/^(destroy|exile|tap|untap) (it|that creature|that permanent)$/)) && ctx.it && ctx.it.evId && !(ctx.lastT && ctx.lastT.length) && !(ctx.tgts && ctx.tgts.length)){
    const t = {t:'card', pid:ctx.it.evPid || MYPID, id:ctx.it.evId, k:ctx.it.evk}; applyTo(t, {op:m[1], src:ctx.name}); log(`${ctx.name}: ${m[1]} ${info(t.k)?.n || 'it'}`); commit(); return true;
  }
  if (/^take an extra turn after this one$/.test(l)){ S.xt = (S.xt || 0) + 1; log(`${ctx.name}: will take an extra turn after this one`); commit(); return true; }
  if ((m = l.match(/^(?:you )?skip your next (untap step|draw step|combat phase|turn)$/))){ skipNext(m[1].split(' ')[0]); log(`${ctx.name}: skips their next ${m[1]}`); commit(); return true; }
  if (/^you become the monarch$/.test(l)){ becomeMonarch(ctx.name); return true; }
  if (/^(?:you )?take the initiative$/.test(l)){ await takeInitiative(ctx.name); return true; }
  if ((m = l.match(/^venture into (the dungeon|undercity)$/))){ await venture(m[1] === 'undercity'); return true; }
  if ((m = s.match(/^you get an emblem with ["“](.+)["”]$/i))){ makeEmblem(m[1].replace(/\.?$/, '.'), ctx.name); return true; }
  if (/^exile cards from the top until a nonland card with lower mana value/.test(l)){ await doCascade(ctx); return true; }
  if ((m = l.match(/^copy it (\d+) times?$/))){ await copyMany(ctx, +m[1]); return true; }
  if (/^copy (it|this spell|~)$/.test(l) && ctx.it && ctx.it.tgt){ await copyTargetItem(ctx); return true; }
  if ((m = l.match(/^switch the power and toughness of (each creature|target creature|~) until end of turn$/))) m = [m[0], {'each creature':"each creature's", 'target creature':"target creature's", '~':"~'s"}[m[1]]];
  if (m || (m = l.match(/^switch (target creature's|~'s|its|each creature's) power and toughness until end of turn$/))){
    const flip = (c, pid) => { if (pid === MYPID){ c.sw = !c.sw; } else sendRq(pid, 'switch', 0, ctx.name, {tid:c.id}); };
    if (m[1] === "each creature's"){ for (const b of boardsAll()) b.bf.forEach(c => { if (c.k && isCreatureCard(c)) flip(c, b.pid); }); }
    else if (m[1] === "~'s"){ const c = srcCardOf(ctx); if (c) flip(c, MYPID); }
    else (m[1] === 'its' ? (ctx.lastT || []) : nextTargets(ctx)).forEach(t => { const c = boardOf(t.pid).find(x => x.id === t.id); if (c) flip(c, t.pid); });
    log(`${ctx.name}: switched power and toughness`); commit(); return true;
  }
  if ((m = l.match(/^goad (target creature|each creature (?:your opponents control|you don't control))$/))){
    const go = (c, pid) => { if (pid === MYPID) c.goad = {by:MYPID, n:currentTurn()[0]}; else sendRq(pid, 'goad', 0, ctx.name, {tid:c.id}); };
    if (/^target/.test(m[1])) nextTargets(ctx).forEach(t => { const c = boardOf(t.pid).find(x => x.id === t.id); if (c) go(c, t.pid); });
    else for (const [pid, s] of OPP) (s.bf || []).forEach(c => { if (c.k && isCreatureCard(c)) go(c, pid); });
    log(`${ctx.name}: goaded`); commit(); return true;
  }
  // Path to Exile / Swords variants: the creature's controller searches
  if ((m = l.match(/^its controller may search their library for an? (basic land|land) card,? (?:and )?put (?:that card|it) onto the battlefield( tapped)?$/))){
    for (const t of (ctx.lastT || [])){ if (t.pid === MYPID){ if (await askYes(`${ctx.name}: search for a ${m[1]} card?`)) await searchLibrary(`a ${m[1]} card`, `put that card onto the battlefield${m[2] ? ' tapped' : ''}, then shuffle`, ctx); } else sendRq(t.pid, 'rampSearch', m[2] ? 1 : 0, ctx.name, {d:m[1]}); }
    ctx.skipShuffle = true; commit(); return true;
  }
  // Thoughtseize / Duress
  if ((m = l.match(/^target (opponent|player) reveals (?:their|his or her) hand$/))){
    const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; const pid = t ? t.pid : await choosePlayer(`${ctx.name}: whose hand?`, m[1] === 'opponent');
    if (!pid) return true;
    if (pid === MYPID){ ctx.revealed = {pid, ks:S.hand.map(c => c.k)}; log(`revealed their hand: ${S.hand.map(cname).join(', ')}`); return true; }
    if (UI.dry){ ctx.revealed = {pid, ks:S.lib.slice(0, 4).map(c => c.k)}; return true; }
    sendRq(pid, 'reveal', 0, ctx.name); commit();
    const hr = await waitUntil(() => Array.isArray(OPP.get(pid)?.hr) && OPP.get(pid).hr, 20000);
    if (!hr){ handWarn(`${nameOf(pid)} didn't reveal their hand in time — ask them to show it`, ctx); return true; }
    ctx.revealed = {pid, ks:hr.slice()}; log(`looked at ${nameOf(pid)}'s hand: ${hr.map(k => info(k)?.n).join(', ')}`); return true;
  }
  if ((m = l.match(/^you (?:may )?choose an? (.*?)card from it$/)) && ctx.revealed){
    const d = m[1].trim(); const opts = ctx.revealed.ks.map((k, i) => ({label:info(k)?.n || 'a card', value:k, disabled:!!d && !digOk(k, d), why:d && !digOk(k, d) ? `not a ${d} card` : ''}));
    ctx.chosenK = opts.some(o => !o.disabled) ? await askChoice({title:`${ctx.name}: choose a ${d ? d + ' ' : ''}card`, options:opts}) : null;
    if (!ctx.chosenK) log(`${ctx.name}: nothing to choose`); return true;
  }
  if (/^(?:that player|they) discards? (?:that card|it)$/.test(l) && ctx.revealed){
    if (ctx.chosenK){ if (ctx.revealed.pid === MYPID){ const h = S.hand.find(x => x.k === ctx.chosenK); if (h) moveCard(h.id, 'gy'); } else sendRq(ctx.revealed.pid, 'discardK', 0, ctx.name, {d:ctx.chosenK}); log(`${nameOf(ctx.revealed.pid)} discards ${info(ctx.chosenK)?.n}`); }
    if (ctx.revealed.pid !== MYPID) sendRq(ctx.revealed.pid, 'unreveal', 0, ctx.name); commit(); return true;
  }
  // Fact or Fiction
  if ((m = l.match(/^reveal the top (\w+) cards of your library$/)) && /separates? those cards into two piles/.test(digRest(ctx, l))){
    const n = wn(m[1]) || 5; const top = S.lib.slice(0, n); ctx.looked = true;
    log(`revealed the top ${top.length}: ${top.map(cname).join(', ')}`);
    const opp = opponents().length ? await choosePlayer(`${ctx.name}: which opponent separates the piles?`, true) : null;
    let mask = null;
    if (opp){
      const ref = rid(6); S.pile = {ref, ks:top.map(c => c.k)}; UI.pileAns = UI.pileAns || {};
      sendRq(opp, 'piles', top.length, ctx.name, {ref}); commit(); toast(`Waiting for ${nameOf(opp)} to split the piles…`);
      const a = await waitUntil(() => UI.pileAns[ref], 75000); S.pile = null;
      mask = a ? a.mask : top.reduce((mm, c, i) => mm | (Math.random() < .5 ? 1 << i : 0), 0); if (!a) log('no answer — piles split at random');
    } else {
      const ids = await pickCards({title:`${ctx.name}: split into two piles (no opponent here)`, hint:'Pick pile 1.', cards:top, min:0, max:top.length, noneLabel:'Pile 1 is empty'});
      mask = top.reduce((mm, c, i) => mm | ((ids || []).includes(c.id) ? 1 << i : 0), 0);
    }
    const p1 = top.filter((c, i) => mask & (1 << i)), p2 = top.filter((c, i) => !(mask & (1 << i)));
    const v = await askChoice({title:`${ctx.name}: which pile goes to your hand?`, options:[{label:`Pile 1 (${p1.length}): ${p1.map(cname).join(', ') || 'empty'}`, value:1}, {label:`Pile 2 (${p2.length}): ${p2.map(cname).join(', ') || 'empty'}`, value:2}]});
    const keep = v === 2 ? p2 : p1, lose = v === 2 ? p1 : p2;
    keep.forEach(c => { const i = S.lib.indexOf(c); if (i >= 0){ S.lib.splice(i, 1); S.hand.push(c); } });
    lose.forEach(c => moveCard(c.id, 'gy', {quiet:true}));
    log(`${ctx.name}: took ${keep.map(cname).join(', ') || 'nothing'}; ${lose.map(cname).join(', ') || 'nothing'} to the graveyard`); commit(); return true;
  }
  return false;
}

/* ---------- Damage events (non-combat too) ---------- */
function r7DamageEvent(t, n, srcK, srcCard){ if (n > 0 && srcK) emit({type:'dmg', k:srcK, id:srcCard && srcCard.id || 0, dp:t.t === 'player' ? t.pid : '', cnt:1, amt:n}); }

/* ---------- Status chips ---------- */
function r7Chips(){
  if (!S) return '';
  const out = []; const mon = holderOf('mon'), ini = holderOf('ini');
  if (mon) out.push(`<span class="chip3" title="The monarch draws a card at the beginning of their end step. Deal combat damage to them to take it.">👑 ${esc(mon === MYPID ? 'You are' : nameOf(mon) + ' is')} the monarch</span>`);
  if (ini) out.push(`<span class="chip3" title="The initiative: venture into Undercity at your upkeep. Deal combat damage to them to take it.">🗡 ${esc(ini === MYPID ? 'You have' : nameOf(ini) + ' has')} the initiative</span>`);
  if (S.dg) out.push(`<span class="chip3" title="${esc(DUNGEONS[S.dg.d].map(r => r[0] + ': ' + r[1]).join('\n'))}">🏰 ${esc(S.dg.d)}: ${esc(DUNGEONS[S.dg.d][S.dg.r][0])}</span>`);
  if (S.xt) out.push(`<span class="chip3">⟳ ${S.xt} extra turn${S.xt > 1 ? 's' : ''} coming</span>`);
  return out.join('');
}

/* ---------- Menu items ---------- */
function r7HandItems(c, zone){
  let h = '';
  faceOpts(c, zone).forEach(o => { h += mb('castFace', esc(o.label), `data-id="${c.id}" data-w="${o.w}" data-z="${zone}"`); });
  if (zone === 'hand' && foretellCost(c)) h += mb('foretell', `Foretell ({2} now, cast later for ${esc(foretellCost(c))})`, `data-id="${c.id}"`);
  return h;
}
function r7BfItems(c){ return c.fd && c.fdc && turnUpCost(c) ? mb('turnUp', `Turn face up (${esc(turnUpCost(c).kind)} ${esc(turnUpCost(c).cost)})`, `data-id="${c.id}"`) : ''; }
function r7ExButtons(c){
  if (c.fore && c.fore !== turnStr() && foretellCost(c) && phaseNow().n > 0) return `<button type="button" data-act="foreCast" data-id="${c.id}">Cast (foretell ${esc(foretellCost(c))})</button>`;
  return '';
}
Object.assign(ACT, {
  castFace(el){ const [z,,c] = find(+el.dataset.id); closeMenu(); if (c) castFace(c, z, el.dataset.w); },
  foretell(el){ const [,,c] = find(+el.dataset.id); closeMenu(); if (c) foretell(c); },
  turnUp(el){ const [,,c] = find(+el.dataset.id); closeMenu(); if (c) turnFaceUp(c); },
  async foreCast(el){ const [z,,c] = find(+el.dataset.id); if (z !== 'ex' || !c) return; closeModal(); c.fd = false; await beginCast(c, 'ex', {gy:{mana:foretellCost(c), extra:[], label:'Foretell'}}); if (find(c.id)[0] === 'ex') c.fd = true; else delete c.fore; commit(); },
});
