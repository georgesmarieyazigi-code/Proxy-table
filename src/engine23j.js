// engine23j.js — round 23 helper J (ranks 5293–6159)
/* ===================== Rules engine — round 23J ===================== */
RQ_OPS.push('jGive', 'jShufGy', 'jHalfSac', 'jHalfDisc', 'jLibBot', 'jCtl');
RQ_OPS.push('jTopTo', 'jGyTake');
const J_W = {a:1, an:1, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, eleven:11, twelve:12, thirteen:13, twenty:20};
const jn = w => J_W[String(w).toLowerCase()] ?? (/^\d+$/.test(w) ? +w : null);
// the object an event trigger is about ("it", "that creature")
function jEv(ctx){ const it = ctx && ctx.it; if (!it || it.evId == null) return null; return {t:'card', pid:it.evPid || MYPID, id:it.evId, k:it.evk || null, nm:it.evk ? info(it.evk)?.n : 'it'}; }
function jCardOf(t){ return t ? boardOf(t.pid).find(b => b.id === t.id) || null : null; }
function jMine(t){ return t && (t.pid === MYPID || !t.pid); }
function jPids(t){ return t ? [t.pid] : []; }
function jTg(ctx){ return ctx.tgts ? nextTargets(ctx) : []; }
const jCmdOnBf = () => S.bf.some(c => c.cmd && !c.fd);
// track things that happened this turn
function jTurnRec(){ if (!S.jt || S.jt.t !== turnStr()) S.jt = {t:turnStr(), ctrC:0, crGy:0, disc:0, desc:0, mil:[], pay:0}; return S.jt; }
{
  const he = handleEvent;
  handleEvent = function(pid, ev){
    try { if (S && ev && pid === MYPID){ const r = jTurnRec();
      if (ev.type === 'discard') r.disc += ev.cnt || 1;
    } } catch {}
    return he(pid, ev);
  };
  const mc = moveCard;
  moveCard = function(id, to, o = {}){
    try { if (S && to === 'gy'){ const [z0, , c0] = find(id); if (z0 === 'bf' && c0 && isCreatureCard(c0)) (jTurnRec().bfGy ||= []).push(id); } } catch {}
    try { if (S && o && o.sac){ const r = jTurnRec(); r.sac = (r.sac || 0) + 1; } } catch {}
    try { if (S && to === 'gy'){ const [from, , c] = find(id); if (c && from && from !== 'gy' && !c.tok){ const r = jTurnRec(); if (from === 'hand') r.hd = (r.hd || 0) + 1; if (isCreatureCard(c) || /Creature/.test(info(c.k)?.t || '')) r.crGy++; if (/Artifact|Creature|Enchantment|Land|Planeswalker|Battle/.test(info(c.k)?.t || '')) r.desc++; } if (c && from === 'bf' && isCreatureCard(c)){ const r = jTurnRec(); r.died = (r.died || 0) + (c.n || 1); if (c.own && c.own.pid){ (JC.owner ||= {})[c.id] = c.own.pid; } } } } catch {}
    return mc(id, to, o);
  };
  const ml = mill;
  mill = function(n = 1){ const ids = S.lib.slice(0, n).map(c => c.id); const r = ml(n); try { jTurnRec().mil.push(...ids); } catch {} return r; };
  const mo = modCounters;
  modCounters = function(c, kind, n, ...a){ const r = mo(c, kind, n, ...a); try { if (n > 0 && c && isCreatureCard(c)) jTurnRec().ctrC++; } catch {} return r; };
}
// conditions used by "if …, …" and "… if …"
function jCond(cond, ctx){
  const l = String(cond).toLowerCase().trim(); let m; const src = srcCardOf(ctx);
  if (/^you control your commander$/.test(l)) return jCmdOnBf();
  if (/^an opponent lost life this turn$/.test(l)) return r21bOppLost();
  if (/^a creature died this turn$/.test(l)) return r19Died() > 0;
  if (/^there is no monarch$/.test(l)) return holderOf('mon') == null;
  if (/^it's your turn$/.test(l)) return currentTurn()[1] === MYPID;
  if (/^it's not your turn$/.test(l)) return currentTurn()[1] !== MYPID;
  if (/^you descended this turn$/.test(l)) return jTurnRec().desc > 0;
  if (/^you put a counter on a creature this turn$/.test(l)) return jTurnRec().ctrC > 0;
  if (/^a creature card was put into your graveyard from anywhere this turn$/.test(l)) return jTurnRec().crGy > 0;
  if (/^you've completed a dungeon$/.test(l)) return (S.dgList || []).length > 0;
  if ((m = l.match(/^you control another (.+?)$/))) return (countOf('other ' + m[1] + ' you control', ctx) || 0) > 0;
  if ((m = l.match(/^you control no (.+?) other than ~$/))) return (countOf('other ' + m[1] + ' you control', ctx) || 0) === 0;
  if ((m = l.match(/^you (?:don't control|control no) an? (.+?)$/))) return (countOf(m[1] + ' you control', ctx) || 0) === 0;
  if ((m = l.match(/^there are (one|two|three|four|five|six|seven|\d+) or more (.+?) cards? in your graveyard$/)) || (m = l.match(/^(one|two|three|four|five|six|seven|\d+) or more (.+?) cards are in your graveyard$/))) return S.gy.filter(c => descOk(c.k, sing(m[2]))).length >= jn(m[1]);
  if ((m = l.match(/^a graveyard has (twenty|\d+) or more cards in it$/))){ const n = jn(m[1]); return S.gy.length >= n || [...OPP.values()].some(s => (s.gy || []).length >= n); }
  if (/^it has an odd number of counters on it$/.test(l)){ const c = src; if (!c) return false; const n = (c.cp || 0) + (c.cm || 0) + (c.co || 0) + Object.values(c.nc || {}).reduce((a, b) => a + b, 0); return n % 2 === 1; }
  if (/^an opponent controls more lands than you$/.test(l)){ const me = S.bf.filter(c => isLand(c.k)).length; return [...OPP.values()].some(s => (s.bf || []).filter(c => c.k && isLand(c.k)).length > me); }
  if (/^it isn't a token$/.test(l)) return !(src && src.tok);
  if (/^it was cast$/.test(l)) return !!(src && src.wasCast === turnStr());
  return null;
}

// added types (c.jty) and permanent keywords (c.jkw: merged into ekw so other clients see them)
{
  const to0 = typeOf;
  typeOf = c => { let t = to0(c); if (!c || !c.jty || !c.jty.length) return t; for (const ty of c.jty){ if (new RegExp('\\b' + ty + '\\b').test(t)) continue; if (/^(Artifact|Enchantment|Creature|Land)$/.test(ty)){ const i = t.search(/\b(Artifact|Enchantment|Creature|Land|Instant|Sorcery|Planeswalker|Battle)\b/); t = i >= 0 ? t.slice(0, i) + ty + ' ' + t.slice(i) : ty + ' ' + t; } else t = /—/.test(t) ? t + ' ' + ty : t + ' — ' + ty; } return t; };
  const cm = commit;
  commit = function(...a){ try { if (S) S.bf.forEach(c => { if (c.jkw && c.jkw.length){ const e = c.ekw || []; if (c.jkw.some(k => !e.includes(k))) c.ekw = [...new Set([...e, ...c.jkw])]; } }); } catch {} return cm.apply(this, a); };
  const ko = kwOf;
  kwOf = function(c, kw, pid = MYPID){ if (c && !c.fd && (c.jkw || []).includes(kw)) return true; return ko(c, kw, pid); };
}
function jAddKw(c, kws){ if (!c) return; c.jkw = [...new Set([...(c.jkw || []), ...kws])]; c.ekw = [...new Set([...(c.ekw || []), ...kws])]; }
function jAddTy(c, tys){ if (!c) return; c.jty = [...new Set([...(c.jty || []), ...tys])]; }
// "until your next turn": undo list
function jUntilNext(fn){ (S.jun ||= []).push(fn); }
const J_UNDO = {
  land22(c){ if (c.anim === 'perm' && c.jAn){ c.anim = ''; c.r19pt = null; c.jkw = (c.jkw || []).filter(k => !(c.jAn || []).includes(k)); c.ekw = (c.ekw || []).filter(k => !(c.jAn || []).includes(k)); c.jAn = null; c.jty = (c.jty || []).filter(t => t !== 'Elemental'); } },
};
{
  const tc = turnChanged;
  turnChanged = function(...a){ const r = tc.apply(this, a); try { if (S) S.bf.forEach(c => { if (c.jtyE && c.jtyT !== turnStr()){ c.jty = (c.jty || []).filter(t => !c.jtyE.includes(t)); delete c.jtyE; delete c.jtyT; } }); } catch {} try { if (S && currentTurn()[1] === MYPID && S.jun && S.jun.length){ const keep = []; for (const u of S.jun){ if (u.t === turnStr()){ keep.push(u); continue; } const c = S.bf.find(b => b.id === u.id); if (c && J_UNDO[u.f]) J_UNDO[u.f](c); } S.jun = keep; commit(); } } catch (e){ console.warn(e); } return r; };
}
function jAnimate(c, p, t, kws, tys, until){
  if (!c) return;
  if (until === 'eot'){ c.anim = 'crew'; c.animPT = [p, t]; c.ekw = [...new Set([...(c.ekw || []), ...kws])]; const add = tys.filter(t => !(c.jty || []).includes(t)); if (add.length){ c.jty = [...(c.jty || []), ...add]; c.jtyE = [...new Set([...(c.jtyE || []), ...add])]; c.jtyT = turnStr(); } return; }
  c.anim = 'perm'; c.r19pt = [p, t]; jAddKw(c, kws); jAddTy(c, tys);
  if (until === 'next'){ c.jAn = kws.slice(); (S.jun ||= []).push({id:c.id, f:'land22', t:turnStr()}); }
}
// other players' side of my requests
{
  const ao = applyOp;
  applyOp = function(r, from){
    const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null;
    if (r.op === 'jGive'){ if (c) giveAway(single(c), String(r.d || from), {}); commit(); return; }
    if (r.op === 'jGyTake'){ const d = String(r.d || ''); const i = d.lastIndexOf('|'); const fl = d.slice(0, i), k = d.slice(i + 1); const gi = S.gy.findIndex(g => g.k === k); if (gi >= 0){ const [g] = S.gy.splice(gi, 1); const ref = rid(6); S.lent.push({ref, to:from, card:g, perm:true}); sendRq(from, 'give', 0, '', {ref, c:{k:g.k, cmd:g.cmd ? 1 : 0}, f:{fromGy:1}, d:'j:' + fl}); log(`${nameOf(from)} took ${cname(g)} from my graveyard (${r.src})`); } commit(); return; }
    if (r.op === 'jTopTo'){ const top = S.lib.splice(0, clamp(r.n || 1, 0, 10)); top.forEach(c => { const ref = rid(6); S.lent.push({ref, to:from, card:c, perm:true}); sendRq(from, 'give', 0, '', {ref, c:{k:c.k}, d:'j:fd'}); }); log(`the top ${top.length} card${top.length === 1 ? '' : 's'} of their library went face down onto ${nameOf(from)}'s battlefield (${r.src})`); commit(); return; }
    if (r.op === 'jCtl'){ (async () => { await jRemote(r, from); commit(); })(); return; }
    if (r.op === 'jShufGy'){ const ks = String(r.d || '').split('|').filter(Boolean); let n = 0; if (r.n === -1){ n = S.gy.length; S.lib.push(...S.gy.splice(0)); } else for (const k of ks){ const i = S.gy.findIndex(g => g.k === k); if (i >= 0){ S.lib.push(S.gy.splice(i, 1)[0]); n++; } } shuffle(S.lib); log(`shuffled ${n} card${n === 1 ? '' : 's'} from their graveyard into their library (${r.src})`); commit(); return; }
    if (r.op === 'jHalfSac'){ const n = Math.ceil(S.bf.filter(b => !b.fd && isCreatureCard(b)).reduce((a, b) => a + (b.n || 1), 0) / 2); if (n) addChoicePrompt('sac', 'creature', n, from, r.src); commit(); return; }
    if (r.op === 'jHalfDisc'){ const n = Math.ceil(S.hand.length / 2); if (n) addChoicePrompt('discard', '', n, from, r.src); commit(); return; }
    if (r.op === 'jLibBot'){ if (c){ const s = single(c); if (s.tok) moveCard(s.id, 'gy', {quiet:true}); else { moveCard(s.id, 'lib', {quiet:true}); if (r.d === 'shuf') shuffle(S.lib); } log(`${cname(s)} was shuffled into its owner's library (${r.src})`); if (r.n > 0){ draw(r.n); } } commit(); return; }
    return ao(r, from);
  };
}
// generic remote actions run on the other player's own client
async function jRemote(r, from){
  const d = String(r.d || ''); const src = r.src || nameOf(from);
  const ctx = {name:src, k:null, it:{}, tgts:null};
  if (d === 'sacGreatest'){ const cr = S.bf.filter(b => !b.fd && isCreatureCard(b)); if (!cr.length) return; const hi = Math.max(...cr.map(b => (stats(b) || [0])[0])); const list = cr.filter(b => (stats(b) || [0])[0] === hi); let c = list[0]; if (list.length > 1){ const ids = await pickCards({title:`${src}: sacrifice a creature with the greatest power`, cards:list, min:1, max:1}); c = (ids && find(ids[0])[2]) || c; } sacrificeOne(c); log(`sacrificed ${cname(c)} (${src})`); return; }
  if (d.startsWith('killWave:')){ const x = +d.slice(9) || 0; for (const c of S.bf.filter(b => !b.fd && isCreatureCard(b))){ const pay = x <= S.life && await askYes(`${src}: pay ${x} life to keep ${cname(c)}? (otherwise sacrifice it)`, `Pay ${x} life`, 'Sacrifice it'); if (pay){ S.life -= x; log(`paid ${x} life to keep ${cname(c)} (${src})`); } else sacrificeOne(c); } return; }
  if (d.startsWith('wheel:')){ await doSentence('Discard your hand', ctx); draw(+d.slice(6) || 7); log(`drew ${+d.slice(6) || 7} cards (${src})`); return; }
  if (d.startsWith('exGyK:')){ const k = d.slice(6); const c = S.gy.find(g => g.k === k); if (c){ moveCard(c.id, 'ex'); log(`${cname(c)} was exiled from their graveyard (${src})`); } return; }
  if (d === 'tangle'){ S.bf.filter(c => c.atk && isCreatureCard(c)).forEach(c => { c.jNoUntap = true; c.jNoUntapSrc = src; }); log(`attacking creatures won't untap next untap step (${src})`); return; }
  if (d === 'faceupCr'){ const c = S.bf.find(b => b.id === r.tid); if (c && c.fd){ if (/\bCreature\b/.test(info(c.k)?.t || '')){ c.fd = false; delete c.fdc; log(`${cname(c)} was turned face up (${src})`); emit({type:'turnup', k:c.k, id:c.id}); } else log(`revealed a face-down ${info(c.k)?.n} — not a creature card (${src})`); } return; }
  if (d.startsWith('mana:')){ const [, col, n] = d.split(':'); addMana(Array(+n || 0).fill(col)); log(`added ${n} {${col}} (${src})`); return; }
  if (d === 'gearhulk'){ const keep = []; for (const ty of ['Artifact', 'Creature', 'Enchantment', 'Planeswalker']){ const list = S.bf.filter(c => c.k && !c.fd && !isLand(c.k) && new RegExp('\\b' + ty + '\\b').test(typeOf(c)) && !keep.includes(c.id)); if (!list.length) continue; const ids = list.length === 1 ? [list[0].id] : await pickCards({title:`${src}: choose ${ty === 'Artifact' || ty === 'Enchantment' ? 'an' : 'a'} ${ty.toLowerCase()} to keep`, cards:list, min:1, max:1}); if (ids && ids[0] != null) keep.push(ids[0]); } const sac = S.bf.filter(c => c.k && !c.emb && !isLand(c.k) && !keep.includes(c.id)); sac.forEach(c => { while ((c.n || 1) > 1) sacrificeOne(c); sacrificeOne(c); }); log(`kept ${keep.length}, sacrificed ${sac.length} nonland permanent${sac.length === 1 ? '' : 's'} (${src})`); return; }
  if (d === 'revealPerm'){ const c = S.lib[0]; if (!c) return; log(`revealed ${cname(c)} from the top of their library (${src})`); if (/Artifact|Creature|Enchantment|Land|Planeswalker|Battle/.test(info(c.k)?.t || '')){ moveCard(c.id, 'bf'); log(`put ${cname(c)} onto the battlefield (${src})`); } return; }
  if (d.startsWith('uc:')){ const it = S.stk.find(x => x.sid === d.slice(3)); if (it){ it.uc = true; log(`${it.nm} can't be countered (${src})`); } return; }
  if (d.startsWith('may:')){ const eff = d.slice(4); if (await askYes(`${src}: you may ${eff.replace(/^./, x => x.toLowerCase())}. Do it?`, 'Yes', 'No')) await doSentence(cap(eff), ctx); return; }
  if (d.startsWith('do:')){ await doSentence(cap(d.slice(3)), ctx); return; }
  if (d === 'discRand'){ if (S.hand.length){ const c = S.hand[Math.floor(Math.random() * S.hand.length)]; moveCard(c.id, 'gy'); log(`discarded ${cname(c)} at random (${src})`); } return; }
  if (d === 'manifestDread'){ await doSentence('Manifest dread', ctx); return; }
  if (d.startsWith('mayPut:')){ const desc = d.slice(7); const list = S.hand.filter(h => descOk(h.k, desc)); if (!list.length) return; const ids = await pickCards({title:`${src}: you may put ${desc.replace(/ or /g, ' / ')} card from your hand onto the battlefield`, cards:list, min:0, max:1}); for (const id of ids || []){ moveCard(id, 'bf'); } return; }
  if (d.startsWith('discover:')){ await discover(+d.slice(9) || 0, ctx); return; }
  if (d === 'shufGy'){ const n = S.gy.length; S.lib.push(...S.gy.splice(0)); shuffle(S.lib); log(`shuffled their graveyard (${n}) into their library (${src})`); return; }
  if (d.startsWith('pumpAll:')){ const [p, t, desc] = d.slice(8).split(','); S.bf.filter(b => !b.fd && isCreatureCard(b) && (!desc || descOk(b.k, desc, {tok:b.tok}))).forEach(b => { b.pu = [(b.pu || [0, 0])[0] + +p, (b.pu || [0, 0])[1] + +t]; }); log(`creatures they control get ${+p >= 0 ? '+' : ''}${p}/${+t >= 0 ? '+' : ''}${t} until end of turn (${src})`); return; }
  if (d.startsWith('kw:')){ const c = S.bf.find(b => b.id === r.tid); if (c){ jAddKw(c, d.slice(3).split(',')); log(`${cname(c)} gains ${d.slice(3)} (${src})`); } return; }
  if (d.startsWith('ty:')){ const c = S.bf.find(b => b.id === r.tid); if (c){ jAddTy(c, d.slice(3).split(',')); log(`${cname(c)} becomes ${d.slice(3)} in addition to its other types (${src})`); } return; }
}
function jCtl(pid, d, src, extra = {}){ if (pid === MYPID) return jRemote({d, src, ...extra}, MYPID); sendRq(pid, 'jCtl', 0, src, {d, ...extra}); }
// cast-with-flash grants ("the next sorcery spell you cast this turn can be cast as though it had flash")
{
  const to = timingOk;
  timingOk = function(c){ const r = to(c); if (r && !r.ok && S && (S.jfl || []).some(f => f.t === turnStr() && descOk(c.k, f.d) && (!f.ty || new RegExp('\\b' + f.ty + '\\b', 'i').test(info(c.k)?.t || ''))) && phaseNow().n > 0 && !/split second/i.test(r.why || '')) return {ok:true}; return r; };
  const bc = beginCast;
  beginCast = async function(c, zone, ...a){ const n0 = S.stk.length; const r = await bc.call(this, c, zone, ...a); try { if (S && S.jfl && S.stk.length > n0){ const i = S.jfl.findIndex(f => f.t === turnStr() && descOk(c.k, f.d) && (!f.ty || new RegExp('\\b' + f.ty + '\\b', 'i').test(info(c.k)?.t || ''))); if (i >= 0) S.jfl.splice(i, 1); } } catch {} return r; };
}
// remember the countered spell's controller and card ("its controller manifests dread", "if it was a legendary spell")
{
  const rc = resolveCounter;
  resolveCounter = async function(ctx){ try { const it = ctx.it; const tgt = it && it.tgt ? stackAll().find(x => x.sid === it.tgt) : null; if (tgt){ ctx.jCtrPid = tgt.pid; ctx.jCtrK = tgt.k; } } catch {} return rc(ctx); };
}
// lands put onto the battlefield (Expand the Sphere), cards milled by the last mill
const JC = {landIn:0, lastMill:[]};
{
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ try { if (S && to === 'bf'){ const [z, , c] = find(id); if (c && z !== 'bf' && isLand(c.k)) JC.landIn++; } } catch {} return mc(id, to, o); };
  const ml = mill;
  mill = function(n = 1){ JC.lastMill = S.lib.slice(0, n).map(c => c.id); return ml(n); };
  const re = runEffects;
  runEffects = async function(txt, ctx){ if (ctx && ctx.jLand0 == null) ctx.jLand0 = JC.landIn; return re(txt, ctx); };
}
// prevent damage and put that many +1/+1 counters instead (Gatta and Luzzu)
{
  const dc = damageCard;
  damageCard = function(c, n, f = {}){ if (c && n > 0 && c.jPrevCtr === turnStr()){ modCounters(c, 'cp', n); log(`${cname(c)}: ${n} damage prevented — ${n} +1/+1 counter${n === 1 ? '' : 's'} instead`); return 0; } return dc(c, n, f); };
}
// noncreature spells each player cast this turn (Magebane Lizard)
{
  const he = handleEvent;
  handleEvent = function(pid, ev){ try { if (S && ev && ev.type === 'cast' && ev.k && !/\bCreature\b/.test(info(ev.k)?.t || '')){ if (!S.jnc || S.jnc.t !== turnStr()) S.jnc = {t:turnStr(), n:{}}; S.jnc.n[pid] = (S.jnc.n[pid] || 0) + 1; } } catch {} return he(pid, ev); };
}
function jAttackedPids(desc){ const out = new Set(); S.bf.forEach(c => { if (c.atk && (!desc || descOk(c.k, desc, {tok:c.tok}))){ const d = parseDef(c.atk); if (d) out.add(d.pid); } }); return [...out].filter(p => p !== MYPID); }
function jLess(a, b){ return a < b; }

// "if it was cast": remember permanents that entered from the stack
{
  const oe = onEnter;
  onEnter = function(c, from, o = {}){ try { if (c){ if (from === 'stack') c.wasCast = turnStr(); else delete c.wasCast; } } catch {} return oe(c, from, o); };
  const tk = takeCard;
  takeCard = function(r, from){ const n0 = S.bf.length; const out = tk(r, from); try { if (r && /^j:/.test(String(r.d || '')) && S.bf.length > n0){ const c = S.bf[S.bf.length - 1]; const fl = {}; String(r.d).slice(2).split(';').forEach(x => { const [a, b] = x.split('='); if (a) fl[a] = b ?? '1'; }); if (fl.ty) jAddTy(c, fl.ty.split(',')); if (fl.cm) { c.cm = (c.cm || 0) + (+fl.cm || 1); cancelCounters(c); } if (fl.kw) jAddKw(c, fl.kw.split(',')); if (fl.fd){ c.fd = true; c.fdc = 'manifest'; c.sk = true; } } } catch {} return out; };
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){ const n0 = S.stk.length; const r = pt(src, t, ev, evPid); try { if (ev && S.stk.length > n0){ const it = S.stk[S.stk.length - 1]; if (ev.cp != null) it.evCp = ev.cp; if (ev.amt != null && it.evN == null) it.evN = ev.amt; } } catch {} return r; };
}
// token copy of a card with "except it's a P/T <types> creature …"
function jTokenCopy(k, o = {}){
  const tk = {id:S.nid++, k, tok:true, copy:true, n:1, sk:true};
  if (o.pt){ tk.anim = 'perm'; tk.r19pt = o.pt; }
  if (o.ty && o.ty.length) tk.jty = o.ty.slice(); if (o.kw && o.kw.length) tk.jkw = o.kw.slice(), tk.ekw = o.kw.slice();
  if (o.tapped) tk.tap = true;
  place(tk); S.bf.push(tk); emit({type:'enter', k, id:tk.id, tok:1}); commit(); return tk;
}
// cast a card I hold (hand / my graveyard / exile) right now without paying its mana cost
async function jCastFree(c, zone, ctx, o = {}){
  if (!c || UI.dry) return false;
  if (!(await askYes(`${ctx.name}: cast ${cname(c)} without paying its mana cost?`, 'Cast it', 'No'))) return false;
  if (o.exAfter) c.r21exAfter = 1;
  UI.afterCast = () => {}; await r21bCastNow(c, zone, {free:true}); return true;
}

// creatures that entered under my control, per turn (Ephara)
{
  const he = handleEvent;
  handleEvent = function(pid, ev){ try { if (S && pid === MYPID && ev && ev.type === 'enter' && ev.k && /\bCreature\b/.test(info(ev.k)?.t || '')){ if (!S.jEnt || S.jEnt.t !== turnStr()) S.jEnt = {t:turnStr(), ks:[]}; S.jEnt.ks.push(ev.k); } } catch {} return he(pid, ev); };
  const tc = turnChanged;
  turnChanged = function(...a){ const r = tc.apply(this, a); try { if (S){ const now = turnStr(); if (S.jTT !== now){ S.jEntPrev = (S.jEnt && S.jEnt.t === S.jTT) ? S.jEnt.ks.slice() : []; S.jTT = now; } } } catch {} return r; };
}
async function jBolster(n, name){ const cr = S.bf.filter(c => isCreatureCard(c) && !c.fd); if (!cr.length) return; const lo = Math.min(...cr.map(c => (stats(c) || [0, 0])[1])); const list = cr.filter(c => (stats(c) || [0, 0])[1] === lo); let c = list[0]; if (list.length > 1 && !UI.dry){ const ids = await pickCards({title:`${name}: bolster ${n} — choose among your creatures with the least toughness`, cards:list, min:1, max:1}); c = (ids && find(ids[0])[2]) || c; } modCounters(c, 'cp', n); log(`bolster ${n}: ${cname(c)} gets ${n} +1/+1 counter${n === 1 ? '' : 's'}`); commit(); }

{
  const ct = createToken;
  createToken = function(k, n = 1, near, o = {}){ const r = ct(k, n, near, o); try { const st = S.bf.slice().reverse().find(c => c.tok && c.k === k); if (st) JC.lastTok = st.id; } catch {} return r; };
}

// statics: creatures with counters can't attack/block; conditional self-anthems; Raised by Giants
STATIC_RULES.push(
  [/^creatures your opponents control with counters on them can't attack or block$/, m => ({kind:'jNoAB', who:'opp', cm:false, atk:true, blk:true})],
  [/^creatures your opponents control with -1\/-1 counters on them can't block$/, m => ({kind:'jNoAB', who:'opp', cm:true, atk:false, blk:true})],
);
function jNoAB(c, which){ if (!c) return ''; const hasC = (c.cp || 0) + (c.cm || 0) + (c.co || 0) + Object.values(c.nc || {}).reduce((a, b) => a + b, 0) > 0; for (const r of rulesOn('jNoAB')){ if (!r[which]) continue; if (r.cm ? (c.cm || 0) > 0 : hasC) return `can't ${which === 'atk' ? 'attack' : 'block'} (${r.src})`; } return ''; }
{
  const ca = canAttack;
  canAttack = function(c){ const w = ca(c); if (w) return w; try { return jNoAB(c, 'atk'); } catch { return ''; } };
  const cb = canBlock;
  canBlock = function(b, a, apid){ const w = cb(b, a, apid); if (w) return w; try { if (S && S.bf.includes(b)) return jNoAB(b, 'blk'); } catch {} return ''; };
}
const J_SELFANTH = new Map();
function jSelfAnth(k){ if (J_SELFANTH.has(k)) return J_SELFANTH.get(k); const a = info(k); let r = null; if (a){ const m = tname(a.o || '', a.n).toLowerCase().match(/^~ gets \+(\d+)\/\+(\d+) as long as you control an? ([a-z]+)\.?$/m); if (m) r = {p:+m[1], t:+m[2], d:m[3]}; } J_SELFANTH.set(k, r); return r; }
function jRaised(pid){ return boardOf(pid).some(b => b.k && !b.fd && /^Commander creatures you own have base power and toughness 10\/10 and are Giants in addition to their other types\.?$/m.test(info(b.k)?.o || '')); }
{
  const st = stats;
  stats = function(c, pid = MYPID){ let r = st(c, pid); try { if (r && c && c.k && !c.fd){ const x = jSelfAnth(c.k); if (x && boardOf(pid).some(b => b !== c && b.k && !b.fd && descOk(b.k, x.d, {tok:b.tok}))) r = [r[0] + x.p, r[1] + x.t]; if (c.cmd && jRaised(pid)){ const b = ptOf(faceOf(c)); if (b) r = [r[0] - b[0] + 10, r[1] - b[1] + 10]; } } } catch {} return r; };
  const to = typeOf;
  typeOf = c => { const t = to(c); try { if (c && c.cmd && S && S.bf.includes(c) && jRaised(MYPID) && !/\bGiant\b/.test(t)) return /—/.test(t) ? t + ' Giant' : t + ' — Giant'; } catch {} return t; };
}
STATIC_KNOWN.push(/^~ gets \+\d+\/\+\d+ as long as you control an? [a-z]+$/, /^commander creatures you own have base power and toughness 10\/10 and are giants in addition to their other types$/);
// "this Spacecraft" is the card's own name
{ const tn = tname; tname = function(txt, name){ return tn(txt, name).replace(/\bthis Spacecraft\b/g, '~'); }; }
// die-roll result tables: run only the matching row (all rows in the checker)
{
  const re = runEffects;
  runEffects = async function(txt, ctx){
    const t = String(txt || '');
    if (!/^\d+(?:—\d+)? \| /m.test(t) || (ctx && ctx.jTbl)) return re(txt, ctx);
    ctx.jTbl = true;
    try {
      for (const line of t.split('\n')){
        const m = line.match(/^(\d+)(?:—(\d+))? \| ([\s\S]+)$/);
        if (!m){ if (line.trim()) await re(line, ctx); continue; }
        const lo = +m[1], hi = m[2] ? +m[2] : +m[1]; const r = ctx.roll;
        if (UI.dry || (r != null && r >= lo && r <= hi)){ if (!UI.dry) log(`${ctx.name}: ${r} — ${short(m[3], 80)}`); await re(m[3], ctx); }
      }
    } finally { ctx.jTbl = false; }
  };
}

// emblems whose quoted text has several sentences
{
  const re = runEffects;
  runEffects = async function(txt, ctx){
    let t = String(txt || ''); const m = t.match(/(?:^|\.\s+|\n)(You get an emblem with ["“]([^"”]+)["”]\.?)/);
    if (m && /\.\s+\S/.test(m[2])){ makeEmblem(m[2].replace(/\.?$/, '.'), ctx.name); t = t.replace(m[1], '').trim(); if (!t) return; return re(t, ctx); }
    return re(txt, ctx);
  };
}

// "sacrifices a creature of their choice": the choice words aren't part of the card description
{
  const acp = addChoicePrompt;
  addChoicePrompt = function(kind, desc, n, from, src){ return acp(kind, String(desc || '').replace(/\s+of (?:their|his or her|your) choice$/i, '').trim(), n, from, src); };
}

// suspected creatures: menace and can't block
{
  const cb = canBlock;
  canBlock = function(b, a, apid){ const w = cb(b, a, apid); if (w) return w; try { if (b && b.jSus) return "can't block (suspected)"; } catch {} return ''; };
}

// mana that isn't lost as steps and phases end (Grand Warlord Radha) — only the amount added that way
{
  const et = engineTick;
  engineTick = function(...a){
    let keep = null, ph0 = null;
    try { if (S && S.jKeepMana === turnStr() && S.jKeepAmt){ keep = {...S.pool}; ph0 = S.seenPh; } } catch {}
    const r = et.apply(this, a);
    try { if (keep && S.seenPh !== ph0 && poolTotal(S.pool) === 0){ let left = S.jKeepAmt; const np = emptyPool(); for (const c of Object.keys(S.jKeepCols || {})){ const n = Math.min(keep[c] || 0, S.jKeepCols[c], left); if (n > 0){ np[c] = n; left -= n; } } if (poolTotal(np)){ S.pool = np; log(`kept ${poolTotal(np)} mana (${S.jKeepSrc || 'until end of turn'})`); commit(); } } else if (S && S.jKeepMana && S.jKeepMana !== turnStr()){ S.jKeepMana = null; S.jKeepAmt = 0; } } catch {}
    return r;
  };
}

// "loses <keyword> until end of turn" (marker in ekw, published with the card); Archetype of Finality; Tangle
STATIC_RULES.push([/^creatures your opponents control lose deathtouch and can't have or gain deathtouch$/, m => ({kind:'jNoDT', who:'opp'})]);
{
  const ko = kwOf;
  kwOf = function(c, kw, pid = MYPID){ if (c && (c.ekw || []).includes('no' + kw)) return false; if (kw === 'deathtouch' && c && S){ try { if (rulesOn('jNoDT', pid).length && isCreatureCard(c)) return false; } catch {} } return ko(c, kw, pid); };
  const sp = setPhase;
  setPhase = function(i, ...a){ let keep = []; try { if (i === 0 && S) keep = S.bf.filter(c => c.jNoUntap && (c.tap || c.tn)).map(c => [c, c.tap, c.tn]); } catch {} const r = sp.call(this, i, ...a); try { keep.forEach(([c, tp, tn]) => { c.tap = tp; c.tn = tn; delete c.jNoUntap; log(`${cname(c)} doesn't untap (${c.jNoUntapSrc || 'effect'})`); }); S && S.bf.forEach(c => { if (i === 0 && c.jNoUntap) delete c.jNoUntap; }); if (keep.length) commit(); } catch {} return r; };
}

{
  const co = countOf;
  countOf = function(phrase, ctx){
    const p = String(phrase || '').toLowerCase().trim().replace(/\.$/, '');
    if (/^the greatest mana value of a commander you own on the battlefield or in the command zone$/.test(p)){ const list = S.bf.concat(S.cz || []).filter(c => c.cmd); return list.length ? Math.max(...list.map(c => info(c.k)?.mv || 0)) : 0; }
    if (/^players? being attacked$/.test(p)) return jAttackedPids().length;
    if (/^your devotion to (white|blue|black|red|green)$/.test(p)) return devotion([p.split(' ').pop()]);
    return co(phrase, ctx);
  };
}

// Sieges: "As ~ enters, choose Khans or Dragons." — the permanent becomes a derived card whose text is the chosen mode
const J_SIEGE = /^As (?:~|this enchantment|[^\n]+?) enters, choose Khans or Dragons\.\n• Khans — ([^\n]+)\n• Dragons — ([^\n]+)$/m;
{
  const df = deriveFace;
  deriveFace = function(k){
    const m = typeof k === 'string' && k.match(/^(.+)\|siege:(Khans|Dragons)$/);
    if (m){ const base = DICT.get(m[1]); if (!base) return null; const sm = String(base.o || '').match(J_SIEGE); if (!sm) return null; const e = {...base, k, o:String(base.o).replace(J_SIEGE, m[2] === "Khans" ? sm[1] : sm[2]), base:base.k}; DICT.set(k, e); return e; }
    return df(k);
  };
  const oe = onEnter;
  onEnter = function(c, from, o = {}){
    try { if (typeof g23modesOf !== 'function' && c && c.k && !/\|siege:/.test(c.k) && !c.jSiegeAsk && J_SIEGE.test(info(c.k)?.o || '') && S.bf.includes(c) && !UI.dry){ c.jSiegeAsk = 1; (async () => { const v = await askChoice({title:`${cname(c)}: choose Khans or Dragons`, options:[{label:'Khans', value:'Khans'}, {label:'Dragons', value:'Dragons'}]}); const ch = v || 'Khans'; delete c.jSiegeAsk; if (!S.bf.includes(c) || /\|siege:/.test(c.k)) return; c.jBase = c.k; c.k = c.k + '|siege:' + ch; info(c.k); TRIG_CACHE && TRIG_CACHE.clear && TRIG_CACHE.clear(); log(`${cname(c)}: chose ${ch}`); commit(); })(); } } catch (e){ console.warn(e); }
    return oe(c, from, o);
  };
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ try { const [z, , c] = find(id); if (c && z === 'bf' && to !== 'bf' && c.jBase){ c.k = c.jBase; delete c.jBase; } } catch {} return mc(id, to, o); };
}
STATIC_KNOWN.push(/^as ~ enters, choose khans or dragons$/, /^• khans — at the beginning of (combat on your turn, put two \+1\/\+1 counters on target creature you control|your upkeep, return target creature card from your graveyard to your hand)$/, /^• dragons — at the beginning of (combat on each opponent's turn, tap target creature that player controls|your upkeep, each opponent loses 2 life and you gain 2 life)$/);

{
  const ct = classifyTrig;
  classifyTrig = function(w, c){ if (w === 'at' && /^the beginning of each player's (?:first|precombat) main phase$/.test(c)) return {ev:'step', step:'main1', whose:'each'}; return ct(w, c); };
}

// "You may pay {W}{U}{B}{R}{G} rather than pay the mana cost for spells you cast." (Jodah, Fist of Suns, Leyline of Mutation)
STATIC_RULES.push([/^you may pay \{w\}\{u\}\{b\}\{r\}\{g\} rather than pay the mana cost for spells you cast$/, m => ({kind:'jWUBRG', who:'you'})]);
{
  const ra = r21bAlts;
  r21bAlts = function(c, zone){
    const out = ra(c, zone);
    try { if (S && c && !isLand(c.k) && (zone === 'hand' || zone === 'cz') && rulesOn('jWUBRG').length){ const mana = '{W}{U}{B}{R}{G}'; const o = {kind:'jwubrg', label:`${mana} instead of its mana cost (${rulesOn('jWUBRG')[0].src})`, mana, extra:[]}; const sc = spellCost(c, zone, {alt:{mana}}); o.sc = sc; const tm = timingOk(c); o.why = !tm.ok ? tm.why : payPlan(sc.cost, S.pool).err || ''; out.push(o); } } catch (e){ console.warn(e); }
    return out;
  };
}
// extort: whenever I cast a spell, each permanent of mine with extort lets me pay {W/B} to drain each opponent for 1
async function jExtort(k){
  const ex = S.bf.filter(c => !c.fd && c.k && kwOf(c, 'extort'));
  for (const c of ex){
    for (let i = 0; i < (c.n || 1); i++){
      const plan = payPlan(parseCost('{W/B}'), S.pool);
      if (plan.err) { log(`${cname(c)}: extort — can't pay {W/B}`); return; }
      if (!(await askYes(`${cname(c)} — extort: pay {W/B}? (each opponent loses 1 life, you gain that much)`, 'Pay {W/B}', 'No'))) continue;
      const p2 = payPlan(parseCost('{W/B}'), S.pool); if (p2.err) return; S.pool = p2.pool; let n = 0;
      for (const p of opponents()){ await loseLife(p.pid, 1, `${cname(c)} (extort)`); n++; }
      if (n && gainLife(n, 'extort')) log(`gained ${n} life (extort) → ${S.life}`); commit();
    }
  }
}
{
  const he = handleEvent;
  handleEvent = function(pid, ev){ const r = he(pid, ev); try { if (S && pid === MYPID && ev && ev.type === 'cast' && !UI.dry && !UI.replay && S.bf.some(c => !c.fd && c.k && kwOf(c, 'extort'))) setTimeout(() => { jExtort(ev.k).catch(e => console.warn(e)); }, 0); } catch {} return r; };
}
STATIC_KNOWN.push(/^other creatures you control have extort$/);

// "Whenever a creature you control is dealt damage" (its own event so the generic subject check applies); "When ~ enters and whenever it deals combat damage to a player"
EV_TYPES.push('jdealt');
{
  const dc = damageCard;
  damageCard = function(c, n, f){ const r = dc(c, n, f); try { if (r > 0 && c && S.bf.includes(c) && isCreatureCard(c)) emit({type:'jdealt', k:c.k, id:c.id, cnt:1, amt:r}); } catch {} return r; };
  const ct = classifyTrig;
  classifyTrig = function(w, c){
    let m;
    if ((m = c.match(/^an? (creature|[a-z]+ creature) you control is dealt damage$/))) return {ev:'jdealt', subj:'any', ctl:'you', desc:m[1]};
    if ((m = c.match(/^~ enters and whenever (?:it|~) deals combat damage to a player$/))){ const a = ct(w, '~ enters'), b = ct('whenever', '~ deals combat damage to a player'); if (a && b) return {...a, evs:[a.ev, b.ev]}; }
    return ct(w, c);
  };
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){ const n0 = S.stk.length; const r = pt(src, t, ev, evPid); try { if (ev && ev.type === 'jdealt' && S.stk.length > n0){ const it = S.stk[S.stk.length - 1]; it.jdealt = 1; it.evN = ev.amt; } } catch {} return r; };
}

// "You may have ~ enter tapped. If you do, you get two rad counters." (Mariposa Military Base)
{
  const oe = onEnter;
  onEnter = function(c, from, o = {}){
    const r = oe(c, from, o);
    try { if (c && S.bf.includes(c) && !UI.dry && /^You may have (?:~|this land) enter tapped\. If you do, you get (two|three|a|one) (rad|energy|experience) counters?\.$/m.test(tname(info(c.k)?.o || '', info(c.k)?.n))){ const m = tname(info(c.k).o, info(c.k).n).match(/If you do, you get (two|three|a|one) (rad|energy|experience) counters?/); (async () => { if (await askYes(`${cname(c)}: enter tapped and get ${m[1]} ${m[2]} counter${m[1] === 'a' || m[1] === 'one' ? '' : 's'}?`, 'Enter tapped', 'Untapped')){ c.tap = true; addPC(m[2], jn(m[1]) || 1); commit(); } })(); } } catch (e){ console.warn(e); }
    return r;
  };
}
STATIC_KNOWN.push(/^you may have ~ enter tapped$/, /^if you do, you get (two|three|a|one) (rad|energy|experience) counters?$/);

// remember the cards a library search moved (Loyal Inventor)
{
  const sl = searchLibrary;
  searchLibrary = async function(descRaw, rest, ctx){ const before = new Set(S.hand.map(c => c.id)); const r = await sl(descRaw, rest, ctx); try { if (ctx) ctx.jSrch = S.hand.filter(c => !before.has(c.id)).map(c => c.id); } catch {} return r; };
}
async function jSay(s, ctx){ return doSentence(cap(s), ctx); }
async function doRound23JPre(s, l, ctx){
  let m;
  const name = ctx.name; const srcC = srcCardOf(ctx);
  const rest = w => s.slice(s.length - w.length);

  if (/^each player shuffles their hand and graveyard into their library$/.test(l)){ ctx.jEachP = true; return false; }
  if ((m = l.match(/^draws (seven|\w+) cards$/)) && ctx.jEachP){ const n = jn(m[1]) || 7; draw(n); opponents().forEach(p => sendRq(p.pid, 'draw', n, name)); ctx.jEachP = false; commit(); return true; }
  // ---------- generic intervening / trailing conditions
  if ((m = l.match(/^(?:then )?if ([^,]+), (.+)$/)) && !/\binstead\b|repeat this process|opponent controls more lands/.test(l)){ const ok = jCond(m[1], ctx); if (ok != null){ ctx.condResult = !!ok; if (ok || UI.dry) await jSay(rest(m[2]), ctx); else log(`${name}: condition not met (${m[1]})`); return true; } }
  if (!/\binstead\b/.test(l) && (m = l.match(/^(.+?) if (a creature died this turn|you control your commander|an opponent lost life this turn|you control an? .+|seven or more land cards are in your graveyard)$/))){ const ok = jCond(m[2], ctx); if (ok != null){ ctx.condResult = !!ok; if (ok || UI.dry) await jSay(s.slice(0, m[1].length), ctx); else log(`${name}: condition not met (${m[2]})`); return true; } }

  const T = () => jTg(ctx);
  const cardsT = ts => ts.filter(t => t.t === 'card');
  // ---------- target descriptions narrower than "creature" ("Target Bear you control fights …", "Target Ninja creature can't be blocked")
  if ((m = l.match(/^(up to one )?target ((?:(?!(?:creatures?|player|opponent|permanent|spell)\b)[a-z0-9\/,'-]+ )+?)(creature )?(you control )?(gets [+-]\d+\/[+-]\d+(?: and gains [a-z ,]+)? until end of turn|gains [a-z ,]+ until end of turn|can't be blocked this turn|fights target creature (?:you don't control|an opponent controls))$/))){
    await jSay(`${m[1] || ''}Target creature ${m[4] || ''}${s.slice(s.length - m[5].length)}`, ctx); return true; }
  if ((m = l.match(/^target creature can't be blocked this turn$/))){ cardsT(T()).forEach(t => applyTo(t, {op:'pump', src:name, f:{p:0, t:0, kw:['unblockable']}})); return true; }
  // ---------- groups of creatures with a quality
  if ((m = l.match(/^(other )?(attacking |blocking )?creatures( you control)?(?: with (flying|counters on them|power (\d+) or greater))? (?:get ([+-]\d+)\/([+-]\d+)(?: and gain ([a-z ,]+?))?|gain ([a-z ,]+?)) until end of turn$/)) && (m[3] || m[2])){
    const p = +(m[6] || 0), tt = +(m[7] || 0); const kws = String(m[8] || m[9] || '').split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim()).filter(Boolean);
    const ok = c => isCreatureCard(c) && !c.fd && !(m[1] && c.id === ctx.srcId) && (m[2] !== 'attacking ' || c.atk) && (m[2] !== 'blocking ' || c.blk != null) && (m[4] !== 'flying' || kwOf(c, 'flying')) && (m[4] !== 'counters on them' || (c.cp || c.cm || c.co || Object.values(c.nc || {}).some(Boolean))) && (!m[5] || (stats(c) || [0])[0] >= +m[5]);
    const list = S.bf.filter(ok); list.forEach(c => applyOp({op:'pump', tid:c.id, f:{p, t:tt, kw:kws}}, MYPID)); log(`${name}: ${list.length} creature${list.length === 1 ? '' : 's'} affected`); return true; }
  // ---------- control changes
  if ((m = l.match(/^target opponent gains control of target (permanent you control|creature)$/))){ const p = T().find(t => t.t === 'player'); const c = cardsT(T())[0]; if (p && c){ if (c.pid === MYPID){ const cc = S.bf.find(b => b.id === c.id); if (cc) giveAway(single(cc), p.pid, {}); } else if (c.pid !== p.pid) sendRq(c.pid, 'jGive', 0, name, {tid:c.id, d:p.pid}); } return true; }
  // ---------- "its controller may …" (event object's controller)
  if ((m = l.match(/^its controller may (create .+|draw a card)$/))){ const pid = (ctx.it && ctx.it.evPid) || MYPID; const eff = rest(m[1]); if (pid === MYPID){ if (await askYes(`${name}: ${cap(eff)}?`, 'Yes', 'No')) await jSay(eff, ctx); } else { jCtl(pid, 'may:' + eff, name); log(`${name}: ${nameOf(pid)} may ${eff.toLowerCase()}`); } return true; }
  if ((m = l.match(/^its controller manifests dread$/))){ const pid = ctx.jCtrPid || (ctx.it && ctx.it.evPid) || MYPID; if (pid === MYPID) await jSay('Manifest dread', ctx); else { jCtl(pid, 'manifestDread', name); log(`${name}: ${nameOf(pid)} manifests dread`); } return true; }
  if ((m = l.match(/^if it was a legendary spell, (.+)$/))){ const ok = ctx.jCtrK && /\bLegendary\b/.test(info(ctx.jCtrK)?.t || ''); if (ok || UI.dry) await jSay(rest(m[1]), ctx); return true; }
  // ---------- Zurzoth
  if ((m = l.match(/^if it's not their turn, (.+)$/))){ const pid = ctx.it && ctx.it.evPid; if (!pid || currentTurn()[1] !== pid || UI.dry) await jSay(rest(m[1]), ctx); else log(`${name}: it's their turn — nothing happens`); return true; }
  if ((m = l.match(/^you and those players each draw a card$/))){ const pids = jAttackedPids('devil'); ctx.jThose = pids; draw(1); pids.forEach(pid => sendRq(pid, 'draw', 1, name)); return true; }
  if ((m = l.match(/^discard a card at random$/))){ if (S.hand.length){ const c = S.hand[Math.floor(Math.random() * S.hand.length)]; moveCard(c.id, 'gy'); log(`discarded ${cname(c)} at random`); } (ctx.jThose || []).forEach(pid => jCtl(pid, 'discRand', name)); return true; }
  // ---------- flash for the next spell
  if ((m = l.match(/^the next (sorcery |instant |creature )?spell (of the chosen type )?you cast this turn can be cast as though it had flash$/))){ const ty = m[2] ? (srcC && srcC.ctype) || '' : ''; (S.jfl ||= []).push({t:turnStr(), d:(m[1] || '').trim(), ty}); log(`${name}: the next ${m[1] || ''}${ty ? ty + ' ' : ''}spell this turn can be cast as though it had flash`); return true; }
  // ---------- lands become creatures
  if ((m = l.match(/^until your next turn: all lands you control become (\d+)\/(\d+) (\w+) creatures with ([a-z ,]+)$/)) || (m = l.match(/^until your next turn, all lands you control become (\d+)\/(\d+) (\w+) creatures with ([a-z ,]+)$/))){ const kws = m[4].split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim()).filter(Boolean); const ty = cap(m[3]); S.bf.filter(c => isLand(c.k)).forEach(c => jAnimate(c, +m[1], +m[2], kws, [ty], 'next')); log(`${name}: lands become ${m[1]}/${m[2]} ${ty} creatures until your next turn`); return true; }
  if (/^they're still lands$/.test(l) || /^it's still a land$/.test(l)) return true;
  if ((m = l.match(/^it becomes an? (\d+)\/(\d+) (\w+) (\w+) creature with ([a-z ,]+)$/))){ const t = (ctx.lastT || [])[0]; const c = t && t.pid === MYPID ? S.bf.find(b => b.id === t.id) : null; if (c){ jAnimate(c, +m[1], +m[2], m[5].split(/,\s*(?:and\s+)?|\s+and\s+/), [cap(m[4])], 'perm'); log(`${cname(c)} becomes a ${m[1]}/${m[2]} ${m[4]} creature`); } return true; }
  // ---------- damage to the event object
  if ((m = l.match(/^(?:~|it) deals (\d+) damage to it$/))){ const t = jEv(ctx); if (t) dealDamage(t, +m[1], ctx.k, srcC); return true; }
  // ---------- Expand the Sphere
  if ((m = l.match(/^if you put fewer than two lands onto the battlefield this way, proliferate a number of times equal to the difference$/))){ const put = JC.landIn - (ctx.jLand0 || 0); const n = Math.max(0, 2 - put); for (let i = 0; i < n; i++) await proliferate(name); if (!n) log(`${name}: two lands entered — no proliferate`); return true; }
  // ---------- Braids: that player may put a card from hand
  if ((m = l.match(/^(?:that|target) player may put an? (.+?) card from their hand onto the battlefield$/))){ const pid = (/^target/.test(l) ? (T()[0] || {}).pid : null) || (ctx.it && ctx.it.evPid) || MYPID; const desc = m[1].replace(/, or /g, ' or ').replace(/, /g, ' or '); if (pid === MYPID){ const list = S.hand.filter(h => descOk(h.k, desc)); if (list.length){ const ids = await pickCards({title:`${name}: you may put ${m[1]} card from your hand onto the battlefield`, cards:list, min:0, max:1}); (ids || []).forEach(id => moveCard(id, 'bf')); } } else { jCtl(pid, 'mayPut:' + desc, name); log(`${name}: ${nameOf(pid)} may put ${m[1]} card onto the battlefield`); } return true; }
  // ---------- choose up to one target creature / keyword counters
  if ((m = l.match(/^choose (?:up to one )?target (creature|permanent)(?: you control)?$/))){ ctx.lastT = T(); return true; }
  if ((m = l.match(/^put a \+1\/\+1 counter and a counter from among ([a-z ,]+) on it$/))){ const t = (ctx.lastT || [])[0]; if (!t) return true; const opts = m[1].replace(/,? or /, ', ').split(/,\s*/).filter(Boolean); const kw = UI.dry ? opts[0] : await askChoice({title:`${name}: which counter?`, options:opts.map(o => ({label:o, value:o}))}); applyTo(t, {op:'ctr', n:1, src:name, d:'cp'}); if (kw){ if (t.pid === MYPID) jAddKw(S.bf.find(b => b.id === t.id), [kw]); else jCtl(t.pid, 'kw:' + kw, name, {tid:t.id}); log(`${name}: ${t.nm} gets a +1/+1 counter and a ${kw} counter`); } return true; }
  // ---------- Shelinda
  if ((m = l.match(/^put a \+1\/\+1 counter on that creature if its power is less than ~'s power$/))){ const e = jEv(ctx); const c = e && e.pid === MYPID ? S.bf.find(b => b.id === e.id) : null; const me = srcC && stats(srcC); const ok = c && me && (stats(c) || [0])[0] < me[0]; ctx.condResult = !!ok; if (ok){ modCounters(c, 'cp', 1); log(`${cname(c)} gets a +1/+1 counter`); } return true; }
  if ((m = l.match(/^otherwise, put a \+1\/\+1 counter on ~$/))){ if (ctx.condResult === false && srcC && find(srcC.id)[0] === 'bf'){ modCounters(srcC, 'cp', 1); log(`${cname(srcC)} gets a +1/+1 counter`); } ctx.condResult = null; return true; }
  // ---------- return up to N target cards from your graveyard to the battlefield
  if ((m = l.match(/^return up to (\d+|one|two|three|four|five|six) target (.+?) cards? (?:with different names )?from your graveyard to the battlefield( tapped)?$/))){ const n = jn(m[1]); const ts = T().slice(0, n); for (const t of ts){ if (t.pid === MYPID && find(t.id)[0] === 'gy'){ moveCard(t.id, 'bf'); if (m[3]){ const c = find(t.id)[2]; if (c) c.tap = true; } } } commit(); return true; }
  // ---------- damage to each <kind> creature, then "and each player"
  if ((m = l.match(/^(?:~|it) deals (\d+|x|twice x) damage to each ((?:non)?[a-z]+) creature$/)) && !/^(other|attacking|blocking|tapped|untapped)$/.test(m[2])){ const n = m[1] === 'twice x' ? 2 * ((ctx.it && ctx.it.x) || 0) : await numOf(m[1], ctx, 'damage'); const f = srcFlags(ctx.k, MYPID, srcC); const d = m[2] + ' creature'; applyOp({op:'dmgAll', n, d, f}, MYPID); opponents().forEach(p => sendRq(p.pid, 'dmgAll', n, name, {d, f})); ctx.dmgN = n; return true; }
  if ((m = l.match(/^(?:~|it) deals (\d+|x|twice x) damage to each creature with (flying|reach)$/))){ const n = m[1] === 'twice x' ? 2 * ((ctx.it && ctx.it.x) || 0) : await numOf(m[1], ctx, 'damage'); const f = srcFlags(ctx.k, MYPID, srcC); S.bf.filter(c => isCreatureCard(c) && kwOf(c, m[2])).forEach(c => damageCard(c, n, f)); opponents().forEach(p => sendRq(p.pid, 'dmgAll', n, name, {d:'creature with ' + m[2], f})); return true; }
  if (/^(?:and )?each player$/.test(l) && ctx.dmgN){ const f = srcFlags(ctx.k, MYPID, srcC); players().forEach(p => dealDamage({t:'player', pid:p.pid}, ctx.dmgN, ctx.k, srcC)); return true; }
  // ---------- Frogantua / milled lands
  if ((m = l.match(/^put any number of land cards from among them onto the battlefield tapped$/))){ const list = JC.lastMill.map(id => S.gy.find(c => c.id === id)).filter(c => c && isLand(c.k)); if (list.length){ const ids = UI.dry ? [] : await pickCards({title:`${name}: put any number of lands onto the battlefield tapped`, cards:list, min:0, max:list.length}); (ids || []).forEach(id => { moveCard(id, 'bf'); const c = find(id)[2]; if (c) c.tap = true; }); } return true; }
  // ---------- Gruff Triplets
  if ((m = l.match(/^put a number of \+1\/\+1 counters equal to its power on each creature you control named (.+)$/))){ const k = (ctx.it && ctx.it.evk) || ctx.k; const p = Math.max(0, parseInt(info(k)?.p) || 0); const nm = m[1]; S.bf.filter(c => isCreatureCard(c) && cname(c).toLowerCase() === nm).forEach(c => modCounters(c, 'cp', p)); log(`${name}: +${p} counters on each ${cap(nm)}`); return true; }
  if ((m = l.match(/^create two tokens that are copies of it$/))){ const c = srcC; if (c){ for (let i = 0; i < 2; i++){ const tk = {id:S.nid++, k:c.k, tok:true, copy:true, n:1, sk:true}; place(tk); S.bf.push(tk); emit({type:'enter', k:c.k, id:tk.id, tok:1}); } log(`created two token copies of ${cname(c)}`); commit(); } return true; }
  // ---------- half of things
  if ((m = l.match(/^target opponent (sacrifices half the creatures they control|discards half the cards in their hand),? (?:of their choice, )?rounded up$/))){ const t = T().find(x => x.t === 'player'); if (t && t.pid !== MYPID){ sendRq(t.pid, /sacrifices/.test(m[1]) ? 'jHalfSac' : 'jHalfDisc', 0, name); log(`${name}: ${nameOf(t.pid)} ${m[1]}, rounded up`); } return true; }
  // ---------- Clackbridge Troll
  if ((m = l.match(/^target opponent creates (.+)$/))){ const t = T().find(x => x.t === 'player'); if (t) await ctrlCreate(t, rest(m[1]), ctx); return true; }
  if ((m = l.match(/^any opponent may sacrifice a creature of their choice$/))){ ctx.jDid = false; for (const p of opponents()){ if (!(OPP.get(p.pid)?.bf || []).some(b => b.k && isCreatureCard(b))) continue; if (await r22ask(p.pid, `${name}: sacrifice a creature? (If you do, ${nameOf(MYPID)}'s ${name} is tapped, they gain 3 life and draw a card)`, name)){ sendRq(p.pid, 'sac', 1, name, {d:'creature'}); ctx.jDid = true; log(`${nameOf(p.pid)} sacrifices a creature to ${name}`); break; } } return true; }
  if ((m = l.match(/^if a player does, tap ~, you gain (\d+) life, and you draw a card$/))){ if (ctx.jDid || UI.dry){ if (srcC) srcC.tap = true; if (gainLife(+m[1], name)) log(`gained ${m[1]} life → ${S.life}`); draw(1); } return true; }
  // ---------- Smallpox
  if ((m = l.match(/^each player loses (\d+) life, discards a card, sacrifices a creature of their choice$/))){ const n = +m[1]; for (const p of players()) await loseLife(p.pid, n, name); for (const p of players()){ if (p.pid === MYPID){ addChoicePrompt('discard', '', 1, MYPID, name); addChoicePrompt('sac', 'creature', 1, MYPID, name); } else { sendRq(p.pid, 'discard', 1, name, {d:''}); sendRq(p.pid, 'sac', 1, name, {d:'creature'}); } } ctx.jEachSac = true; return true; }
  if ((m = l.match(/^sacrifices a (land|creature) of their choice$/)) && ctx.jEachSac){ for (const p of players()){ if (p.pid === MYPID) addChoicePrompt('sac', m[1], 1, MYPID, name); else sendRq(p.pid, 'sac', 1, name, {d:m[1]}); } return true; }
  // ---------- Gatta and Luzzu
  if ((m = l.match(/^if damage would be dealt to that creature this turn, prevent that damage and put that many \+1\/\+1 counters on it$/))){ const t = (ctx.lastT || [])[0]; const c = t && t.pid === MYPID ? S.bf.find(b => b.id === t.id) : null; if (c){ c.jPrevCtr = turnStr(); log(`${name}: damage to ${cname(c)} this turn becomes +1/+1 counters`); } return true; }
  if ((m = l.match(/^choose target creature you control$/))){ ctx.lastT = T(); return true; }
  // ---------- draw for each tapped creature target player controls
  if ((m = l.match(/^draw a card for each tapped creature target (?:player|opponent) controls$/))){ const t = T().find(x => x.t === 'player'); if (!t) return true; const n = boardOf(t.pid).filter(c => c.k && !c.fd && c.tap && isCreatureCard(c)).reduce((a, c) => a + (c.n || 1), 0); if (n) draw(n); log(`${name}: drew ${n} (tapped creatures ${t.nm} controls)`); return true; }
  // ---------- Nahiri: Equipment from exile for free
  if ((m = l.match(/^(?:you may )?cast (equipment|artifact|creature) spells this way without paying their mana costs$/))){ (ctx.lastEx || []).forEach(id => { const c = S.ex.find(x => x.id === id); if (c && c.mayPlay && descOk(c.k, m[1])) c.mayPlay.free = true; }); return true; }
  // ---------- Great Unclean One
  if ((m = l.match(/^(?:then )?for each opponent who has less life than you, create (.+)$/))){ const n = opponents().filter(p => (OPP.get(p.pid)?.life ?? 1e9) < S.life).length; for (let i = 0; i < (UI.dry ? 1 : n); i++) await createFromText('Create ' + rest(m[1]).replace(/ named [^.]+$/i, ''), ctx); log(`${name}: ${n} opponent${n === 1 ? '' : 's'} with less life`); return true; }
  // ---------- Jace: three times X
  if ((m = l.match(/^target player mills three times x cards$/))){ const n = 3 * ((ctx.it && ctx.it.x) || 0); T().forEach(t => { if (t.pid === MYPID) mill(n); else { sendRq(t.pid, 'mill', n, name); log(`${t.nm} mills ${n}`); } }); return true; }
  // ---------- graveyard to library
  if ((m = l.match(/^put up to one target card from your graveyard on the bottom of your library$/))){ const t = T()[0]; if (t && t.pid === MYPID){ const c = S.gy.find(g => g.id === t.id); if (c){ S.gy.splice(S.gy.indexOf(c), 1); S.lib.push(c); log(`put ${cname(c)} on the bottom of their library`); commit(); } } return true; }
  if ((m = l.match(/^put up to one target (instant or sorcery|creature|artifact|land)? ?card from your graveyard on top of your library$/))){ const t = T()[0]; if (t && t.pid === MYPID){ const c = S.gy.find(g => g.id === t.id); if (c){ S.gy.splice(S.gy.indexOf(c), 1); S.lib.unshift(c); log(`put ${cname(c)} on top of their library`); commit(); } } return true; }
  if ((m = l.match(/^target player shuffles their graveyard into their library$/))){ const t = T().find(x => x.t === 'player'); if (t) jCtl(t.pid, 'shufGy', name); return true; }
  if ((m = l.match(/^target player shuffles up to (one|two|three) target cards from their graveyard into their library$/))){ const p = T().find(x => x.t === 'player'); const cs = T().filter(x => x.t === 'gy' || x.t === 'card'); if (!p) return true; const mine = cs.filter(c => c.pid === p.pid); if (p.pid === MYPID){ mine.forEach(c => { const g = S.gy.find(x => x.id === c.id); if (g){ S.gy.splice(S.gy.indexOf(g), 1); S.lib.push(g); } }); shuffle(S.lib); log(`shuffled ${mine.length} card${mine.length === 1 ? '' : 's'} from their graveyard into their library`); commit(); } else mine.forEach(c => sendRq(p.pid, 'jShufGy', 1, name, {d:c.k})); return true; }
  // ---------- owner shuffles it into their library (Oblation, Zoyowa's Justice, Ominous Cemetery)
  if ((m = l.match(/^(?:the owner of target (.+?)|target creature's owner) shuffles it into their library$/))){ const t = cardsT(T())[0]; if (!t) return true; ctx.jOwner = t.pid; ctx.lastMV = info(t.k)?.mv || 0; if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c){ const sc = single(c); if (sc.own){ sendBack(sc, 'lib'); } else if (sc.tok) moveCard(sc.id, 'gy', {quiet:true}); else { moveCard(sc.id, 'lib', {quiet:true}); shuffle(S.lib); } log(`${t.nm} was shuffled into its owner's library`); commit(); } } else { sendRq(t.pid, 'jLibBot', 0, name, {tid:t.id, d:'shuf'}); log(`${name}: ${t.nm} is shuffled into ${nameOf(t.pid)}'s library`); } return true; }
  if ((m = l.match(/^draws two cards$/)) && ctx.jOwner){ if (ctx.jOwner === MYPID) draw(2); else sendRq(ctx.jOwner, 'draw', 2, name); return true; }
  if ((m = l.match(/^(?:then )?that player discovers x, where x is its mana value$/)) && ctx.jOwner){ const n = ctx.lastMV || 0; if (ctx.jOwner === MYPID) await discover(n, ctx); else jCtl(ctx.jOwner, 'discover:' + n, name); return true; }
  if ((m = l.match(/^(?:then )?(?:target player|that player) discovers x, where x is its mana value$/))){ const n = ctx.lastMV || 0; const pid = ctx.jOwner || MYPID; if (pid === MYPID) await discover(n, ctx); else jCtl(pid, 'discover:' + n, name); return true; }
  if ((m = l.match(/^return all cards from your graveyard to your hand$/))){ const n = S.gy.length; S.hand.push(...S.gy.splice(0).map(c => (reset(c), c))); log(`returned ${n} cards from their graveyard to their hand`); commit(); return true; }
  if ((m = l.match(/^put target (noncreature permanent|nonland permanent|creature|permanent) on top of its owner's library$/))){ const t = cardsT(T())[0]; if (t) r22applyLib(t, 'top', name); return true; }
  // ---------- bounce lands
  if ((m = l.match(/^sacrifice it unless you return an untapped (\w+) you control to its owner's hand$/))){ const c = srcC; const list = S.bf.filter(b => b !== c && !b.tap && !b.fd && descOk(b.k, m[1])); let ok = false; if (list.length){ const ids = UI.dry ? [list[0].id] : await pickCards({title:`${name}: return an untapped ${cap(m[1])} to your hand (or ${name} is sacrificed)`, cards:list, min:0, max:1}); if (ids && ids.length){ moveCard(ids[0], 'hand'); ok = true; } } if (!ok && c && find(c.id)[0] === 'bf'){ sacrificeOne(c); log(`${name}: sacrificed (no ${m[1]} returned)`); } commit(); return true; }
  // ---------- Doran
  if ((m = l.match(/^it gets \+x\/\+x until end of turn, where x is the difference between its power and toughness$/))){ const e = jEv(ctx); const c = e && e.pid === MYPID ? S.bf.find(b => b.id === e.id) : null; if (c){ const st = stats(c) || [0, 0]; const x = Math.abs(st[1] - st[0]); applyOp({op:'pump', tid:c.id, f:{p:x, t:x, kw:[]}}, MYPID); } return true; }
  // ---------- Magebane Lizard
  if ((m = l.match(/^(?:~|it) deals damage to (?:that|target) player equal to the number of noncreature spells they've cast this turn$/))){ const pid = (ctx.it && ctx.it.evPid) || (T()[0] || {}).pid; if (!pid) return true; const n = S.jnc && S.jnc.t === turnStr() ? (S.jnc.n[pid] || 0) : 0; if (n) dealDamage({t:'player', pid}, n, ctx.k, srcC); return true; }
  // ---------- conditions about my board
  if ((m = l.match(/^if you control another creature with a \+1\/\+1 counter on it, (.+)$/))){ const ok = S.bf.some(c => c.id !== ctx.srcId && isCreatureCard(c) && (c.cp || 0) > 0); if (ok || UI.dry) await jSay(rest(m[1]), ctx); return true; }
  if ((m = l.match(/^then if you have fewer than (three|four|five|seven) cards in hand, draw cards equal to the difference$/))){ const n = Math.max(0, jn(m[1]) - S.hand.length); if (n) draw(n); return true; }
  // ---------- life from the sacrificed creature
  if ((m = l.match(/^you gain life equal to the sacrificed creature's (toughness|power)$/))){ const c = ctx.sacd; const a = c && info(c.k); const n = a ? Math.max(0, (parseInt(m[1] === 'power' ? (a.p || '').split('/')[0] : (a.p || '').split('/')[1]) || 0) + (c.cp || 0) - (c.cm || 0)) : 0; if (n && gainLife(n, name)) log(`gained ${n} life → ${S.life}`); return true; }
  // ---------- creatures a player controls get -N/-N
  if ((m = l.match(/^creatures target player controls get ([+-]\d+)\/([+-]\d+) until end of turn$/))){ const t = T().find(x => x.t === 'player'); if (t) jCtl(t.pid, `pumpAll:${+m[1]},${+m[2]},`, name); return true; }

  // ---------- batch 3
  if ((m = l.match(/^tap or untap equipped creature$/))){ const c = srcC && srcC.att && srcC.att.pid === MYPID ? S.bf.find(b => b.id === srcC.att.id) : null; if (!c) return true; const v = UI.dry ? 'tap' : await askChoice({title:`${name}: tap or untap ${cname(c)}?`, options:[{label:'Tap', value:'tap'}, {label:'Untap', value:'untap'}]}); if (v === 'tap') c.tap = true; else if (v === 'untap') c.tap = false; if (v) log(`${v === 'tap' ? 'tapped' : 'untapped'} ${cname(c)} (${name})`); commit(); return true; }
  if ((m = l.match(/^exile any number of target cards from your graveyard$/))){ const ids = []; T().forEach(t => { if (t.pid === MYPID && S.gy.some(g => g.id === t.id)){ moveCard(t.id, 'ex', {quiet:true}); ids.push(t.id); } }); ctx.lastEx = ids; ctx.jExN = ids.length; log(`exiled ${ids.length} card${ids.length === 1 ? '' : 's'} from their graveyard`); commit(); return true; }
  if ((m = l.match(/^add \{([wubrgc])\} for each card exiled this way$/))){ const n = ctx.jExN ?? (ctx.lastEx || []).length; addMana(Array(n).fill(m[1].toUpperCase())); log(`added ${n} {${m[1].toUpperCase()}}`); return true; }
  if ((m = l.match(/^(?:you may )?play those cards this turn$/)) && (ctx.lastEx || []).length){ grantPlay(ctx.lastEx, {src:name}); return true; }
  // exile a card from your graveyard, then a token copy of it with changes (Anikthea, Sauron)
  if ((m = l.match(/^exile (?:up to one )?target (.+?) card from your graveyard$/)) && /create a (?:tapped and attacking )?token that's a copy of (?:that card|it), except/i.test(String(ctx.full || ''))){ const t = T()[0]; ctx.jCopyK = null; if (t && t.pid === MYPID && S.gy.some(g => g.id === t.id)){ ctx.jCopyK = t.k; moveCard(t.id, 'ex'); } return true; }
  if ((m = l.match(/^create a (tapped and attacking )?token that's a copy of (?:that card|it), except it's an? (\d+)\/(\d+) ([a-z ]+?)(?: creature)?(?: with ([a-z ,]+?))?( in addition to its other types)?$/))){ m.splice(1, 1, m[1]); const atk = !!m[1]; m.splice(1, 1); const k = ctx.jCopyK; if (!k) return true; const words = m[3].split(' ').filter(w => !COLW[w] && w !== 'creature').map(cap); const tk = jTokenCopy(k, {pt:[+m[1], +m[2]], ty:['Creature', ...words], kw:(m[4] || '').split(/,\s*(?:and\s+)?|\s+and\s+/).filter(Boolean), tapped:atk}); if (atk) tk.atk = (srcC && srcC.atk) || (defOpts()[0] || {}).key || ''; ctx.lastCardId = tk.id; log(`created a ${m[1]}/${m[2]} token copy of ${info(k)?.n}`); return true; }
  // cast a card from a graveyard for free
  if ((m = l.match(/^(?:you may )?cast target (instant or sorcery|instant|sorcery|creature) card (?:with mana value (\d+) or less )?from (that player's|a|your) graveyard(?: this turn)?(?: without paying its mana cost)?$/))){
    const t = T()[0]; ctx.r21 = true; if (!t || UI.dry) return true; const free = /without paying/.test(l);
    const exAfter = /would be put into (?:a|your|their) graveyard, exile it instead/i.test(String(ctx.full || ''));
    if (t.pid === MYPID){ const c = S.gy.find(g => g.id === t.id); if (!c) return true; if (free) await jCastFree(c, 'gy', ctx, {exAfter}); else { if (await askYes(`${name}: cast ${cname(c)} from your graveyard?`, 'Cast it', 'No')){ if (exAfter) c.r21exAfter = 1; await r21bCastNow(c, 'gy', {}); } } return true; }
    const res = await r21Ask(t.pid, 'r21gyLend', 0, name, {d:t.k}); ctx.r21ids = res.ids; if (exAfter) res.ids.forEach(id => { const c = S.ex.find(x => x.id === id); if (c) c.r21exAfter = 1; }); await r21CastNow(ctx, {free, max:1}); return true; }
  if (/^if (?:that spell|a spell cast this way) would be put into (?:a|your|their) graveyard, exile it instead$/.test(l)) return true;
  // types and keywords on the last target
  if ((m = l.match(/^it becomes an? ([a-z]+) in addition to its other types and gains ([a-z ]+)$/)) || (m = l.match(/^(?:that creature|it) is (?:[a-z]+ and is )?an? ([a-z]+) in addition to its other (?:creature )?types$/))){ const t = (ctx.lastT || [])[0] || (ctx.lastCardId != null ? {pid:MYPID, id:ctx.lastCardId} : null); if (!t) return true; const ty = cap(m[1]); const kw = m[2] ? [m[2]] : []; if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); jAddTy(c, [ty]); if (kw.length) jAddKw(c, kw); } else { jCtl(t.pid, 'ty:' + ty, name, {tid:t.id}); if (kw.length) jCtl(t.pid, 'kw:' + kw[0], name, {tid:t.id}); } log(`${name}: ${t.nm || 'it'} becomes ${ty === 'Angel' ? 'an' : 'a'} ${ty}${kw.length ? ' with ' + kw[0] : ''}`); return true; }
  // Doomsday Excruciator
  if ((m = l.match(/^each player exiles all but the bottom (six|\w+) cards of their library face down$/))){ const n = jn(m[1]) || 6; const go = () => { const k = Math.max(0, S.lib.length - n); const out = S.lib.splice(0, k); out.forEach(c => { c.fd = true; S.ex.push(c); }); log(`exiled ${k} cards from their library face down (${name})`); }; go(); opponents().forEach(p => jCtl(p.pid, 'do:' + s, name)); commit(); return true; }
  // Grimoire of the Dead
  if ((m = l.match(/^put all creature cards from all graveyards onto the battlefield under your control$/))){ const mine = S.gy.filter(c => /\bCreature\b/.test(info(c.k)?.t || '')); ctx.jIds = mine.map(c => c.id); mine.forEach(c => moveCard(c.id, 'bf', {quiet:true})); let n = mine.length; const ty = /they're black zombies/i.test(String(ctx.full || '')) ? 'Zombie' : ''; for (const [pid, st] of OPP){ (st.gy || []).forEach(k => { if (/\bCreature\b/.test(info(k)?.t || '')){ sendRq(pid, 'jGyTake', 0, name, {d:(ty ? 'ty=' + ty : '') + '|' + k}); n++; } }); } log(`${name}: put ${n} creature card${n === 1 ? '' : 's'} from all graveyards onto the battlefield`); commit(); return true; }
  if ((m = l.match(/^they're black zombies in addition to their other colors and types$/))){ (ctx.jIds || []).forEach(id => { const c = S.bf.find(b => b.id === id); if (c) jAddTy(c, ['Zombie']); }); return true; }
  // Tomb Tyrant
  if ((m = l.match(/^return an? (.+?) card at random from your graveyard to (the battlefield|your hand)$/))){ const list = S.gy.filter(c => descOk(c.k, m[1])); if (!list.length){ log(`${name}: no ${m[1]} card in the graveyard`); return true; } const c = list[Math.floor(Math.random() * list.length)]; moveCard(c.id, m[2] === 'your hand' ? 'hand' : 'bf'); log(`${name}: returned ${cname(c)} at random`); commit(); return true; }
  // reflexive "when you exile a card this way"
  if ((m = l.match(/^when you exile a card this way, (.+)$/))){ if ((ctx.lastEx || []).length || UI.dry) await jSay(rest(m[1]), ctx); return true; }
  // cast a spell from hand for free (Press the Enemy, Glamdring)
  if ((m = l.match(/^cast an instant or sorcery spell (?:with equal or lesser mana value|from your hand with mana value less than or equal to that damage) (?:from your hand )?without paying its mana cost$/))){
    const lim = /that damage/.test(l) ? ((ctx.it && (ctx.it.evN || ctx.it.evX)) || 0) : (ctx.lastMV ?? ((ctx.lastT || [])[0] ? info(ctx.lastT[0].k)?.mv || 0 : 0));
    const list = S.hand.filter(c => /\b(Instant|Sorcery)\b/.test(info(c.k)?.t || '') && (info(c.k)?.mv || 0) <= lim); if (!list.length || UI.dry){ log(`${name}: no instant or sorcery with mana value ${lim} or less in hand`); return true; }
    const ids = await pickCards({title:`${name}: cast an instant or sorcery (mana value ${lim} or less) for free`, cards:list, min:0, max:1}); const c = ids && ids[0] != null ? find(ids[0])[2] : null; if (c){ UI.afterCast = () => {}; await r21bCastNow(c, 'hand', {free:true}); } return true; }
  // token copy of this creature
  if ((m = l.match(/^create a tapped token that's a copy of ~$/))){ if (srcC) jTokenCopy(srcC.k, {tapped:true}); log(`created a tapped token copy of ${name}`); return true; }
  // distribute counters from a dying creature (Vastwood Hydra)
  if ((m = l.match(/^(?:you may )?distribute a number of \+1\/\+1 counters equal to the number of \+1\/\+1 counters on ~ among any number of creatures you control$/))){ let n = (ctx.it && ctx.it.evCp) || 0; const list = S.bf.filter(c => isCreatureCard(c) && !c.fd); if (!n || !list.length || UI.dry) return true; while (n > 0){ const v = await askChoice({title:`${name}: put a +1/+1 counter on… (${n} left)`, options:list.map(c => ({label:cname(c), value:String(c.id)}))}); if (v == null) break; const c = list.find(x => String(x.id) === v); if (c) modCounters(c, 'cp', 1); n--; } commit(); return true; }
  // Strength-Testing Hammer
  if ((m = l.match(/^that creature gets \+x\/\+0 until end of turn, where x is the result$/))){ const t = (ctx.lastT || [])[0] || jEv(ctx); const n = ctx.roll || 0; if (t){ applyTo(t, {op:'pump', src:name, f:{p:n, t:0, kw:[]}}); ctx.lastT = [t]; } return true; }
  if ((m = l.match(/^then if it has the greatest power or is tied for greatest power among creatures on the battlefield, (.+)$/))){ const t = (ctx.lastT || [])[0]; const c = t ? jCardOf(t) : null; let best = -1e9; boardsAll().forEach(b => b.bf.forEach(x => { if (x.k && !x.fd && isCreatureCard(x)) best = Math.max(best, (stats(x, b.pid) || [0])[0]); })); if ((c && (stats(c, t.pid) || [0])[0] >= best) || UI.dry) await jSay(rest(m[1]), ctx); return true; }

  // ---------- batch 4
  if ((m = l.match(/^at the beginning of the next end step, exile that token unless ~ is your ring-bearer$/))){ if (ctx.lastCardId != null) S.dly.push({id:rid(6), eff:'If ~ is not your Ring-bearer, exile that token.', k:ctx.k, nm:name, srcId:ctx.lastCardId, jSrc:ctx.srcId}); return true; }
  if ((m = l.match(/^if ~ is not your ring-bearer, exile that token$/))){ const bearer = S.bf.some(c => c.k === ctx.k && c.ring && !c.tok); const tk = ctx.srcId != null ? S.bf.find(b => b.id === ctx.srcId) : null; if (tk && !bearer){ moveCard(tk.id, 'ex', {quiet:true}); log(`${name}: exiled the token (${name} isn't your Ring-bearer)`); commit(); } else if (tk) log(`${name}: keeps the token (${name} is your Ring-bearer)`); return true; }
  if ((m = l.match(/^(?:~|it) deals (\d+) damage to the player or planeswalker it's attacking$/))){ const e = jEv(ctx); const c = e && e.pid === MYPID ? S.bf.find(b => b.id === e.id) : null; const d = c && parseDef(c.atk); if (d) dealDamage(d.t === 'player' ? {t:'player', pid:d.pid} : {t:'card', pid:d.pid, id:d.id}, +m[1], ctx.k, srcC); return true; }
  if ((m = l.match(/^put a creature card with mana value equal to the number of charge counters on ~ from your hand onto the battlefield$/))){ const n = srcC ? ((srcC.nc || {}).charge || 0) : 0; const list = S.hand.filter(c => /\bCreature\b/.test(info(c.k)?.t || '') && (info(c.k)?.mv || 0) === n); if (!list.length){ log(`${name}: no creature card with mana value ${n} in hand`); return true; } const ids = UI.dry ? [] : await pickCards({title:`${name}: put a creature card with mana value ${n} onto the battlefield`, cards:list, min:0, max:1}); (ids || []).forEach(id => moveCard(id, 'bf')); commit(); return true; }
  if ((m = l.match(/^up to (x|one|two|three|four|five) target creatures( you control)? gets? ([+-]\d+)\/([+-]\d+)(?: and gains? ([a-z ,]+?))? until end of turn(?:, where x is .+)?$/))){ const kws = String(m[5] || '').split(/,\s*(?:and\s+)?|\s+and\s+/).filter(Boolean); cardsT(T()).forEach(t => applyTo(t, {op:'pump', src:name, f:{p:+m[3], t:+m[4], kw:kws}})); return true; }
  if ((m = l.match(/^you gain x life, where x is the number of cards in your hand minus (\d+)$/))){ const n = Math.max(0, S.hand.length - +m[1]); if (n && gainLife(n, name)) log(`gained ${n} life → ${S.life}`); return true; }
  if ((m = l.match(/^draw a card for each card you've discarded this turn$/))){ const n = jTurnRec().hd || 0; if (n) draw(n); log(`${name}: drew ${n} (cards discarded this turn)`); return true; }
  if ((m = l.match(/^(?:then )?for each creature you control that's an? (.+?), create (a|an) (.+?) tokens?$/))){ const desc = m[1].replace(/ or an? /g, ' or '); const n = S.bf.filter(c => isCreatureCard(c) && !c.fd && descOk(c.k, desc, {tok:c.tok})).reduce((a, c) => a + (c.n || 1), 0); const i0 = l.lastIndexOf(m[3]); const tx = s.slice(i0, i0 + m[3].length); if (n || UI.dry) await createFromText(`Create ${UI.dry ? 'a' : n} ${tx} token${n === 1 || UI.dry ? '' : 's'}`, ctx); return true; }
  if ((m = l.match(/^search your library for up to two creature cards and reveal them$/)) && /put one into your hand and the other into your graveyard/i.test(String(ctx.full || ''))){ const list = S.lib.filter(c => /\bCreature\b/.test(info(c.k)?.t || '')); const ids = UI.dry ? [] : await pickCards({title:`${name}: search for up to two creature cards`, cards:list, min:0, max:2, noneLabel:'Find nothing'}); const ch = (ids || []).map(id => find(id)[2]).filter(Boolean); if (ch.length === 1) moveCard(ch[0].id, 'hand'); else if (ch.length === 2){ const v = await askChoice({title:`${name}: which one goes to your hand? (the other goes to your graveyard)`, options:ch.map((c, i) => ({label:cname(c), value:i}))}); const a = ch[v ?? 0], b = ch[1 - (v ?? 0)]; moveCard(a.id, 'hand'); moveCard(b.id, 'gy'); } log(`${name}: revealed ${ch.map(cname).join(' and ') || 'nothing'}`); ctx.jJarad = true; commit(); return true; }
  if (/^put one into your hand and the other into your graveyard$/.test(l) && ctx.jJarad) return true;
  if ((m = l.match(/^return ~ from your graveyard to the battlefield tapped and attacking$/))){ const c = srcC || (ctx.srcId != null ? find(ctx.srcId)[2] : null); if (c && find(c.id)[0] === 'gy'){ moveCard(c.id, 'bf', {quiet:true}); c.tap = true; c.atk = (defOpts()[0] || {}).key || ''; log(`returned ${cname(c)} tapped and attacking ${defLabel(c.atk)}`); commit(); } return true; }
  if ((m = l.match(/^untap (two|three|four|up to two|up to three) target (lands|permanents|creatures)$/))){ cardsT(T()).forEach(t => applyTo(t, {op:'untap', src:name})); return true; }
  if ((m = l.match(/^other (\w+)s you control become (\d+)\/(\d+) (\w+) creatures in addition to their other types until end of turn$/))){ const list = S.bf.filter(c => c.id !== ctx.srcId && !c.fd && descOk(c.k, m[1], {tok:c.tok})); list.forEach(c => jAnimate(c, +m[2], +m[3], [], [cap(m[4]), 'Creature'], 'eot')); log(`${name}: ${list.length} ${m[1]}${list.length === 1 ? '' : 's'} become ${m[2]}/${m[3]} creatures until end of turn`); return true; }
  if ((m = l.match(/^~ becomes an? (\d+)\/(\d+) creature with ([a-z]+) and all creature types$/))){ const c = srcC; if (c){ jAnimate(c, +m[1], +m[2], [m[3]], [], 'perm'); c.allTypes = 'perm'; log(`${cname(c)} becomes a ${m[1]}/${m[2]} creature`); commit(); } return true; }

  if (/^end the turn$/.test(l)){ const mine = S.stk.filter(x => x !== ctx.it && x.sid !== (ctx.it && ctx.it.sid)); mine.forEach(x => { const i = S.stk.indexOf(x); if (i >= 0) S.stk.splice(i, 1); if (x.card && !x.copy) S.ex.push(x.card); }); S.bf.forEach(c => { c.atk = ''; c.blk = null; }); S.xc = 0; log(`${name}: ends the turn${mine.length ? ' (exiled ' + mine.length + ' spell' + (mine.length === 1 ? '' : 's') + '/abilit' + (mine.length === 1 ? 'y' : 'ies') + ' from the stack)' : ''}`); if (!UI.dry && phaseNow().mine) setTimeout(() => { try { if (phaseNow().mine && !stackAll().length) setPhase(7); } catch {} }, 50); commit(); return true; }

  // ---------- batch 5
  if ((m = l.match(/^put (one, two, or three|up to (?:one|two|three)) target creature cards from graveyards onto the battlefield under your control$/))){ ctx.jRe = []; for (const t of T()){ if (t.pid === MYPID){ const c = S.gy.find(g => g.id === t.id); if (c){ moveCard(c.id, 'bf'); ctx.jRe.push(c.id); } } else { sendRq(t.pid, 'jGyTake', 0, name, {d:(/additional -1\/-1 counter/i.test(String(ctx.full || '')) ? 'cm=1' : '') + '|' + t.k}); log(`${name}: takes ${t.nm} from ${nameOf(t.pid)}'s graveyard`); } } commit(); return true; }
  if ((m = l.match(/^each of them enters with an additional -1\/-1 counter on it$/))){ (ctx.jRe || []).forEach(id => { const c = S.bf.find(b => b.id === id); if (c) f24cmAdd(c, 1); }); return true; }
  if ((m = l.match(/^if it's not (?:target|that) player's turn, destroy that land$/))){ const p = T()[0]; const pid = (p && p.pid) || (ctx.it && ctx.it.evPid); const e = jEv(ctx); if (pid && e && currentTurn()[1] !== pid) applyTo({t:'card', pid, id:e.id}, {op:'destroy', src:name}); return true; }
  if ((m = l.match(/^untap ~ and put a \+1\/\+1 counter on it$/))){ if (srcC && find(srcC.id)[0] === 'bf'){ srcC.tap = false; modCounters(srcC, 'cp', 1); log(`untapped ${cname(srcC)} and put a +1/+1 counter on it`); commit(); } return true; }
  if ((m = l.match(/^if you had another creature enter the battlefield under your control last turn, (.+)$/))){ const ks = S.jEntPrev || []; const me = srcC ? srcC.k : ctx.k; const ok = ks.filter(k => k !== me).length > 0 || ks.filter(k => k === me).length > 1; if (ok || UI.dry) await jSay(rest(m[1]), ctx); return true; }
  if ((m = l.match(/^it fights target creature (?:target|defending) player controls$/))){ const a = srcC; const b = T().find(t => t.t === 'card') || T().find(t => t.t === 'card'); if (!a || !b) return true; const sa = stats(a) || [0], sb = statsAny(b) || [0]; dealDamage(b, Math.max(0, sa[0]), a.k, a); damageCard(a, Math.max(0, sb[0]), {}); log(`${cname(a)} fights ${b.nm}`); commit(); return true; }
  if ((m = l.match(/^(?:~|it) deals (\d+) damage to each creature target player controls$/))){ const t = T().find(x => x.t === 'player'); if (!t) return true; const f = srcFlags(ctx.k, MYPID, srcC); if (t.pid === MYPID) applyOp({op:'dmgAll', n:+m[1], d:'creature', f}, MYPID); else sendRq(t.pid, 'dmgAll', +m[1], name, {d:'creature', f}); return true; }
  if ((m = l.match(/^target player creates (.+)$/))){ const t = T().find(x => x.t === 'player'); if (t) await ctrlCreate(t, rest(m[1]), ctx); return true; }
  if ((m = l.match(/^target (opponent|player) mills (\w+) cards$/)) && jn(m[2]) != null){ const n = jn(m[2]); T().forEach(t => { if (t.pid === MYPID) mill(n); else { sendRq(t.pid, 'mill', n, name); log(`${t.nm} mills ${n}`); } }); return true; }
  if ((m = l.match(/^flip (two|three|four|five|six|x) coins$/))){ const n = m[1] === 'x' ? ((ctx.it && ctx.it.x) || 0) : jn(m[1]); let h = 0; for (let i = 0; i < n; i++) if (Math.random() < .5) h++; ctx.jHeads = h; log(`🪙 ${name}: flipped ${n} coins — ${h} heads`); return true; }
  if ((m = l.match(/^take an extra turn after this one for each coin that comes up heads$/))){ const h = ctx.jHeads || 0; S.xt = (S.xt || 0) + h; log(`${name}: ${h} extra turn${h === 1 ? '' : 's'}`); commit(); return true; }
  if ((m = l.match(/^attach an equipment you control to ~$/))){ const list = S.bf.filter(c => /\bEquipment\b/.test(typeOf(c)) && !c.fd); if (!list.length || !srcC) return true; const ids = list.length === 1 || UI.dry ? [list[0].id] : await pickCards({title:`${name}: attach an Equipment`, cards:list, min:1, max:1}); const e = ids && S.bf.find(b => b.id === ids[0]); if (e){ e.att = {pid:MYPID, id:srcC.id}; log(`attached ${cname(e)} to ${cname(srcC)}`); commit(); } return true; }
  if ((m = l.match(/^up to (two|three|four) target creatures can't block this turn$/))){ cardsT(T()).forEach(t => applyTo(t, {op:'pump', src:name, f:{p:0, t:0, kw:['cantblock']}})); return true; }
  if ((m = l.match(/^when you discard a card this way, (.+)$/))){ if (ctx.jDiscK || UI.dry){ ctx.lastMV = ctx.jDiscK ? info(ctx.jDiscK)?.mv || 0 : 0; await jSay(rest(m[1]).replace(/equal to that card's mana value/i, `equal to ${ctx.lastMV}`), ctx); } return true; }
  if ((m = l.match(/^(?:~|it) deals damage equal to (\d+) to each opponent$/))){ const n = +m[1]; opponents().forEach(p => dealDamage({t:'player', pid:p.pid}, n, ctx.k, srcC)); return true; }
  if ((m = l.match(/^if a creature card is revealed this way, (.+)$/))){ const c = ctx.lastRev; if ((c && /\bCreature\b/.test(info(c.k)?.t || '')) || UI.dry) await jSay(rest(m[1]), ctx); return true; }
  if ((m = l.match(/^put all commanders you own from the command zone and from your graveyard into your hand$/))){ const cz = (S.cz || []).filter(c => c.cmd); const gy = S.gy.filter(c => c.cmd); [...cz, ...gy].forEach(c => { const z = find(c.id)[0]; if (z){ const i = S[z].indexOf(c); S[z].splice(i, 1); S.hand.push(c); } }); log(`${name}: put ${cz.length + gy.length} commander${cz.length + gy.length === 1 ? '' : 's'} into their hand`); commit(); return true; }
  if ((m = l.match(/^up to one target creature you control fights target creature (?:an opponent controls|you don't control)$/))){ await jSay('Target creature you control fights target creature you don\'t control', ctx); return true; }
  if ((m = l.match(/^any number of target opponents each discard their hands$/))){ ctx.jPl = T().filter(t => t.t === 'player').map(t => t.pid); const then7 = /each discard their hands, then draw seven cards/i.test(String(ctx.full || '')); ctx.jPl.forEach(pid => jCtl(pid, then7 ? 'wheel:7' : 'do:Discard your hand', name)); ctx.jWheel = then7; log(`${name}: ${ctx.jPl.map(nameOf).join(', ') || 'nobody'} discard their hands${then7 ? ', then draw seven' : ''}`); return true; }
  if ((m = l.match(/^draw seven cards$/)) && ctx.jPl && ctx.jWheel){ ctx.jPl = null; ctx.jWheel = false; return true; }
  if ((m = l.match(/^target opponent sacrifices a creature of their choice, discards (\w+) cards$/))){ const t = T().find(x => x.t === 'player'); if (t && t.pid !== MYPID){ sendRq(t.pid, 'sac', 1, name, {d:'creature'}); sendRq(t.pid, 'discard', jn(m[1]), name, {d:''}); ctx.jOpp = t.pid; log(`${name}: ${nameOf(t.pid)} sacrifices a creature and discards ${m[1]} cards`); } return true; }
  if ((m = l.match(/^loses (\d+) life$/)) && (ctx.jOpp || (UI.dry && /^target opponent sacrifices/i.test(String(ctx.full || ''))))){ if (!ctx.jOpp) return true; await loseLife(ctx.jOpp, +m[1], name); return true; }
  if ((m = l.match(/^you return a creature card from your graveyard to your hand, draw (\w+) cards$/))){ const list = S.gy.filter(c => /\bCreature\b/.test(info(c.k)?.t || '')); if (list.length){ const ids = list.length === 1 || UI.dry ? [list[0].id] : await pickCards({title:`${name}: return a creature card to your hand`, cards:list, min:1, max:1}); (ids || []).forEach(id => moveCard(id, 'hand')); } draw(jn(m[1])); return true; }
  if ((m = l.match(/^draw x cards, where x is the number of creatures that died under your control this turn$/))){ const n = jTurnRec().died || 0; if (n) draw(n); log(`${name}: drew ${n}`); return true; }
  if ((m = l.match(/^return (?:it|~) to its owner's hand at end of combat$/))){ r21bDelay('eoc', false, "Return ~ to its owner's hand.", ctx); return true; }
  if ((m = l.match(/^up to one other target creature has base power and toughness (\d+)\/(\d+) until end of turn$/))){ await jSay(`Target creature has base power and toughness ${m[1]}/${m[2]} until end of turn`, ctx); return true; }
  if ((m = l.match(/^target creature gets ([+-]\d+)\/([+-]\d+) until end of turn and can't be blocked this turn$/))){ cardsT(T()).forEach(t => applyTo(t, {op:'pump', src:name, f:{p:+m[1], t:+m[2], kw:['unblockable']}})); return true; }
  if ((m = l.match(/^you (?:draw x cards and you )?lose x life, where x is the number of creature cards in target player's graveyard$/)) || (m = l.match(/^you draw x cards and you lose x life, where x is the number of creature cards in target player's graveyard$/))){ const t = T().find(x => x.t === 'player'); const n = !t ? 0 : t.pid === MYPID ? S.gy.filter(c => /\bCreature\b/.test(info(c.k)?.t || '')).length : (OPP.get(t.pid)?.gy || []).filter(k => /\bCreature\b/.test(info(k)?.t || '')).length; if (/draw x/.test(l)) draw(n); S.life -= n; log(`${name}: drew ${/draw x/.test(l) ? n : 0} and lost ${n} life → ${S.life}`); commit(); return true; }
  if ((m = l.match(/^(?:you )?draw x cards$/)) && ctx.jX != null){ draw(ctx.jX); return true; }
  if ((m = l.match(/^for each creature you control of the chosen type, create a token that's a copy of that creature$/))){ const ty = ctx.ctype || (srcC && srcC.ctype) || (UI.dry ? 'Goblin' : await askChoice({title:`${name}: choose a creature type`, options:[...new Set(S.bf.filter(isCreatureCard).flatMap(c => ((typeOf(c).split('—')[1] || '').trim().split(/\s+/)).filter(Boolean)))].map(t => ({label:t, value:t}))})); const list = S.bf.filter(c => isCreatureCard(c) && !c.fd && ty && new RegExp('\\b' + ty + '\\b', 'i').test(typeOf(c))); ctx.lastTok = []; list.forEach(c => { const tk = jTokenCopy(c.k, {kw:/those tokens gain haste/i.test(String(ctx.full || '')) ? ['haste'] : []}); ctx.lastTok.push(tk.id); }); log(`${name}: created ${list.length} token cop${list.length === 1 ? 'y' : 'ies'} of ${ty || '?'} creatures`); return true; }
  if (/^those tokens gain haste$/.test(l) && ctx.lastTok) return true;
  if ((m = l.match(/^exile them at the beginning of the next end step$/)) && ctx.lastTok){ ctx.lastTok.forEach(id => S.dly.push({id:rid(6), eff:'Exile it.', k:ctx.k, nm:name, srcId:id, op:'exile'})); log(`${name}: exile them at the next end step`); return true; }
  if ((m = l.match(/^have (\w+)s you control become (\d+)\/(\d+) ([a-z ]+?) artifact creatures in addition to their other types until end of turn$/))){ const list = S.bf.filter(c => !c.fd && descOk(c.k, m[1], {tok:c.tok})); list.forEach(c => jAnimate(c, +m[2], +m[3], [], [...m[4].split(' ').map(cap), 'Creature'], 'eot')); log(`${name}: ${list.length} ${m[1]}${list.length === 1 ? '' : 's'} become ${m[2]}/${m[3]} creatures until end of turn`); return true; }
  if ((m = l.match(/^bolster (\d+|x)$/))){ await jBolster(m[1] === 'x' ? ((ctx.it && ctx.it.x) || 0) : +m[1], name); return true; }
  if ((m = l.match(/^target creature you control deals damage equal to its power to another target (creature, planeswalker, or battle|creature or planeswalker|creature)$/))){ const a = T()[0]; const b = T()[0]; const ca = a && jCardOf(a); if (!ca || !b) return true; dealDamage(b, Math.max(0, (stats(ca) || [0])[0]), ca.k, ca); return true; }
  if ((m = l.match(/^you gain life equal to the greatest (toughness|power) among other creatures you control$/))){ const i = m[1] === 'power' ? 0 : 1; const list = S.bf.filter(c => isCreatureCard(c) && !c.fd && c.id !== ctx.srcId); const n = list.length ? Math.max(0, ...list.map(c => (stats(c) || [0, 0])[i])) : 0; if (n && gainLife(n, name)) log(`gained ${n} life → ${S.life}`); return true; }
  if ((m = l.match(/^each opponent loses x life and you gain x life, where x is its power$/))){ const k = (ctx.it && ctx.it.evk) || ctx.k; const c = srcC; const n = Math.max(0, c && find(c.id)[0] === 'bf' ? (stats(c) || [0])[0] : (parseInt(info(k)?.p) || 0) + ((ctx.it && ctx.it.evCp) || 0)); for (const p of opponents()) await loseLife(p.pid, n, name); if (n && gainLife(n, name)) log(`gained ${n} life → ${S.life}`); return true; }
  if ((m = l.match(/^return (one or two|up to two|up to three) target (.+?) you own to your hand$/))){ cardsT(T()).forEach(t => applyTo(t, {op:'bounce', src:name})); return true; }
  if ((m = l.match(/^return each nonland permanent card with mana value x from your graveyard to the battlefield$/))){ const x = (ctx.it && ctx.it.x) || 0; const list = S.gy.filter(c => !isLand(c.k) && /Artifact|Creature|Enchantment|Planeswalker|Battle/.test(info(c.k)?.t || '') && (info(c.k)?.mv || 0) === x); list.forEach(c => moveCard(c.id, 'bf')); log(`${name}: returned ${list.length} card${list.length === 1 ? '' : 's'} with mana value ${x}`); commit(); return true; }
  if ((m = l.match(/^exile (another target creature or artifact|x target creatures|target creature) you control$/)) && /return (?:it|those cards|that card) to the battlefield under (?:its|their) owner's control/i.test(String(ctx.full || ''))){ ctx.jFl = []; ctx.jFlK = []; cardsT(T()).forEach(t => { const c = S.bf.find(b => b.id === t.id); if (!c) return; ctx.jFlK.push(c.k); if (c.tok){ moveCard(c.id, 'gy', {quiet:true}); return; } if (c.own){ sendBack(c, 'ex'); return; } moveCard(c.id, 'ex', {quiet:true}); ctx.jFl.push(c.id); }); ctx.lastEx = ctx.jFl.slice(); log(`${name}: exiled ${ctx.jFlK.length} creature${ctx.jFlK.length === 1 ? '' : 's'}`); commit(); return true; }
  if ((m = l.match(/^(?:then )?return (?:it|that card) to the battlefield under its owner's control$/)) && ctx.jFl){ ctx.jFl.forEach(id => { if (S.ex.some(c => c.id === id)) moveCard(id, 'bf'); }); commit(); return true; }
  if ((m = l.match(/^return (?:it|those cards) to the battlefield under (?:its|their) owners?'s? control at the beginning of the next end step$/)) && ctx.jFl){ ctx.jFl.forEach(id => S.dly.push({id:rid(6), eff:'Return it to the battlefield.', k:ctx.k, nm:name, srcId:id, jRet:1})); log(`${name}: returns at the beginning of the next end step`); return true; }
  if ((m = l.match(/^return it to the battlefield$/)) && ctx.srcId != null && S.ex.some(c => c.id === ctx.srcId)){ moveCard(ctx.srcId, 'bf'); commit(); return true; }
  if ((m = l.match(/^if an? (\w+) was exiled this way, (.+)$/))){ const ok = (ctx.jFlK || []).some(k => descOk(k, m[1])); if (ok || UI.dry) await jSay(rest(m[2]), ctx); return true; }
  if ((m = l.match(/^if that land is an? (\w+), put two \+1\/\+1 counters on ~ instead$/))){ const e = jEv(ctx); if (e && e.k && descOk(e.k, m[1]) && srcC){ modCounters(srcC, 'cp', 1); log(`${cname(srcC)}: ${cap(m[1])} — two counters instead of one`); } return true; }
  if ((m = l.match(/^(\w+) enters tapped and attacking$/)) && (JC.lastTok != null || UI.dry)){ const c = S.bf.find(b => b.id === JC.lastTok && cname(b).toLowerCase().startsWith(m[1])); if (c) ctx.lastCardId = c.id; if (c){ c.tap = true; c.atk = (srcC && srcC.atk) || (defOpts()[0] || {}).key || ''; log(`${cname(c)} enters tapped and attacking ${defLabel(c.atk)}`); commit(); } return true; }

  // ---------- batch 6
  if (/^choose an opponent$/.test(l)){ ctx.jPl = [await choosePlayer(`${name}: choose an opponent`, true)].filter(Boolean); return true; }
  if ((m = l.match(/^that player sacrifices a creature of their choice$/)) && ctx.jPl){ ctx.jPl.forEach(pid => { if (pid === MYPID) addChoicePrompt('sac', 'creature', 1, MYPID, name); else { sendRq(pid, 'sac', 1, name, {d:'creature'}); log(`${nameOf(pid)} sacrifices a creature (${name})`); } }); return true; }
  if ((m = l.match(/^each opponent sacrifices a creature with the greatest power among creatures (?:that|target) player controls$/))){ if (/target player/.test(l)) T(); opponents().forEach(p => { jCtl(p.pid, 'sacGreatest', name); log(`${nameOf(p.pid)} sacrifices their creature with the greatest power (${name})`); }); return true; }
  if ((m = l.match(/^for each creature, its controller sacrifices it unless they pay x life$/))){ const x = (ctx.it && ctx.it.x) || 0; players().forEach(p => jCtl(p.pid, 'killWave:' + x, name)); return true; }
  if ((m = l.match(/^each opponent who can't loses (\d+) life$/))){ for (const p of opponents()){ const hc = OPP.get(p.pid)?.hc ?? (OPP.get(p.pid)?.hand || []).length; if (!hc) await loseLife(p.pid, +m[1], name); } return true; }
  if ((m = l.match(/^look at the top three cards of your library$/)) && /put one of those cards into your hand, one on top of your library, and one on the bottom of your library/i.test(String(ctx.full || ''))){ const top = S.lib.slice(0, 3); ctx.jTT = true; if (UI.dry || !top.length) return true; let rest3 = top.slice(); const pick = async (title) => { if (rest3.length <= 1) return rest3[0]; const ids = await pickCards({title, cards:rest3, min:1, max:1}); const c = (ids && rest3.find(x => x.id === ids[0])) || rest3[0]; return c; }; const h = await pick(`${name}: choose the card to put into your hand`); rest3 = rest3.filter(x => x !== h); const tp = await pick(`${name}: choose the card to put on top of your library`); rest3 = rest3.filter(x => x !== tp); const bt = rest3[0]; [h, tp, bt].filter(Boolean).forEach(c => { const i = S.lib.indexOf(c); if (i >= 0) S.lib.splice(i, 1); }); if (h) S.hand.push(h); if (tp) S.lib.unshift(tp); if (bt) S.lib.push(bt); log(`${name}: one card to hand, one on top, one on the bottom`); commit(); return true; }
  if (/^put one of those cards into your hand, one on top of your library, and one on the bottom of your library$/.test(l) && ctx.jTT) return true;
  if ((m = l.match(/^if you attacked with creatures with total power (\d+) or greater this combat, (.+)$/))){ const tot = S.bf.filter(c => c.atk && isCreatureCard(c)).reduce((a, c) => a + Math.max(0, (stats(c) || [0])[0]) * (c.n || 1), 0); if (tot >= +m[1] || UI.dry) await jSay(rest(m[2]), ctx); else log(`${name}: attacking power ${tot} — less than ${m[1]}`); return true; }

  if ((m = l.match(/^put target creature card from a graveyard onto the battlefield under your control$/))){ const t = T()[0]; const hs = /^it gains haste$/im.test(String(ctx.full || '').split(/\.\s*/).join('\n')); if (!t) return true; if (t.pid === MYPID){ const c = S.gy.find(g => g.id === t.id); if (c){ moveCard(c.id, 'bf'); ctx.lastCardId = c.id; if (hs) jAddKw(c, ['haste']); } } else { sendRq(t.pid, 'jGyTake', 0, name, {d:(hs ? 'kw=haste' : '') + '|' + t.k}); log(`${name}: takes ${t.nm} from ${nameOf(t.pid)}'s graveyard`); } ctx.jHasteDone = hs; commit(); return true; }
  if (/^it gains haste$/.test(l) && ctx.jHasteDone) return true;

  // ---------- batch 7
  if ((m = l.match(/^you get (\d+|x) \{e\}$/))){ const n = m[1] === 'x' ? ((ctx.it && ctx.it.x) || 0) : +m[1]; addPC('energy', n); return true; }
  if ((m = l.match(/^you get an amount of \{e\} equal to (its mana value|the amount of mana spent to cast that spell)$/))){ const k = /its mana value/.test(m[1]) ? (ctx.jCtrK || (ctx.it && ctx.it.evk)) : (ctx.it && ctx.it.evk); const n = k ? (info(k)?.mv || 0) + (/mana spent/.test(m[1]) && ctx.it && ctx.it.evX ? ctx.it.evX * ((info(k)?.m || '').match(/\{X\}/g) || []).length : 0) : 0; if (n) addPC('energy', n); else log(`${name}: no energy`); return true; }
  if ((m = l.match(/^if (\w+) gets more votes(?: or the vote is tied)?, (.+)$/))){ const v = ctx.votes || {}; const ks = Object.keys(v); const other = ks.find(x => x !== m[1]); const tieOk = /or the vote is tied/.test(l); const ok = (v[m[1]] || 0) > (v[other] || 0) || (tieOk && (v[m[1]] || 0) === (v[other] || 0)); if (ok || UI.dry) await jSay(rest(m[2]), ctx); return true; }
  if ((m = l.match(/^attach it to up to one target creature you control$/))){ const t = T()[0]; if (t && srcC && t.pid === MYPID){ srcC.att = {pid:MYPID, id:t.id}; log(`attached ${cname(srcC)} to ${t.nm}`); commit(); } return true; }
  if ((m = l.match(/^tap all creatures target (?:opponent|player) controls$/))){ const t = T().find(x => x.t === 'player'); if (t) jCtl(t.pid, 'do:Tap all creatures you control', name); return true; }
  if ((m = l.match(/^tap all creatures you control$/))){ S.bf.filter(c => isCreatureCard(c) && !c.fd).forEach(c => { c.tap = true; }); log(`tapped all their creatures (${name})`); commit(); return true; }
  if ((m = l.match(/^untap up to x lands, where x is the greatest power among those creatures$/))){ const atk = S.bf.filter(c => c.atk && isCreatureCard(c)); const x = atk.length ? Math.max(0, ...atk.map(c => (stats(c) || [0])[0])) : 0; const lands = S.bf.filter(c => isLand(c.k) && c.tap); const n = Math.min(x, lands.length); if (!n) return true; const ids = UI.dry ? [] : (lands.length <= n ? lands.map(c => c.id) : await pickCards({title:`${name}: untap up to ${n} lands`, cards:lands, min:0, max:n})); (ids || []).forEach(id => { const c = S.bf.find(b => b.id === id); if (c) c.tap = false; }); log(`${name}: untapped ${(ids || []).length} land${(ids || []).length === 1 ? '' : 's'}`); commit(); return true; }
  if ((m = l.match(/^suspect (it|~|target creature)$/))){ const t = m[1] === 'target creature' ? T()[0] : (srcC ? {pid:MYPID, id:srcC.id} : null); const c = t && t.pid === MYPID ? S.bf.find(b => b.id === t.id) : null; if (c){ c.jSus = 1; jAddKw(c, ['menace']); log(`${cname(c)} is suspected (menace, can't block)`); commit(); } return true; }
  if ((m = l.match(/^exile a card from a graveyard$/))){ const opts = []; S.gy.forEach(c => opts.push({label:`${cname(c)} (your graveyard)`, value:'m' + c.id})); for (const [pid, st] of OPP) (st.gy || []).forEach((k, i) => opts.push({label:`${info(k)?.n || '?'} (${nameOf(pid)}'s graveyard)`, value:pid + '|' + k})); if (!opts.length || UI.dry) return true; const v = await askChoice({title:`${name}: exile a card from a graveyard`, options:opts}); if (!v) return true; if (v[0] === 'm' && S.gy.some(c => 'm' + c.id === v)){ const id = +v.slice(1); moveCard(id, 'ex'); ctx.lastEx = [id]; if (srcC){ srcC.exw = (srcC.exw || []).concat(S.ex.find(c => c.id === id)?.k).filter(Boolean); } } else { const [pid, k] = v.split('|'); jCtl(pid, 'exGyK:' + k, name); if (srcC) srcC.exw = (srcC.exw || []).concat(k); } commit(); return true; }
  if ((m = l.match(/^surveil x, where x is the amount of damage it dealt to (?:that|target) player$/))){ T(); const n = (ctx.it && (ctx.it.evN || ctx.it.evX)) || 0; if (n || UI.dry) await jSay(`Surveil ${UI.dry ? 1 : n}`, ctx); return true; }
  if ((m = l.match(/^return to the battlefield target nonland permanent card in your graveyard with mana value less than or equal to the number of permanent cards in your graveyard$/))){ const t = T()[0]; if (t && t.pid === MYPID && S.gy.some(g => g.id === t.id)){ const n = S.gy.filter(c => /Artifact|Creature|Enchantment|Land|Planeswalker|Battle/.test(info(c.k)?.t || '')).length; if ((info(t.k)?.mv || 0) <= n){ moveCard(t.id, 'bf'); commit(); } else log(`${name}: mana value too high — nothing happens`); } return true; }
  if ((m = l.match(/^add that much mana in any combination of \{([wubrg])\} and\/or \{([wubrg])\}$/))){ const n = S.bf.filter(c => c.atk && isCreatureCard(c)).reduce((a, c) => a + (c.n || 1), 0) || ((ctx.it && ctx.it.evN) || 0); if (!n) return true; let a = n; if (!UI.dry){ const v = await askChoice({title:`${name}: how much of the ${n} mana is {${m[1].toUpperCase()}}? (the rest is {${m[2].toUpperCase()}})`, options:Array.from({length:n + 1}, (_, i) => ({label:`${i} {${m[1].toUpperCase()}} + ${n - i} {${m[2].toUpperCase()}}`, value:String(i)}))}); a = v == null ? n : +v; } addMana([...Array(a).fill(m[1].toUpperCase()), ...Array(n - a).fill(m[2].toUpperCase())]); S.jKeepMana = turnStr(); S.jKeepAmt = (S.jKeepAmt || 0) + n; S.jKeepCols = {...(S.jKeepCols || {})}; S.jKeepCols[m[1].toUpperCase()] = (S.jKeepCols[m[1].toUpperCase()] || 0) + a; S.jKeepCols[m[2].toUpperCase()] = (S.jKeepCols[m[2].toUpperCase()] || 0) + n - a; S.jKeepSrc = name; log(`${name}: added ${a} {${m[1].toUpperCase()}} and ${n - a} {${m[2].toUpperCase()}}`); commit(); return true; }
  if (/^until end of turn, you don't lose this mana as steps and phases end$/.test(l) && S.jKeepMana === turnStr()) return true;
  if ((m = l.match(/^draw a card for each permanent you control but don't own$/))){ const n = S.bf.filter(c => c.own && !c.fd).length; if (n) draw(n); log(`${name}: drew ${n}`); return true; }
  if ((m = l.match(/^put target legendary permanent card not named (.+?) from a graveyard onto the battlefield under your control$/))){ const t = T()[0]; if (!t) return true; if (t.pid === MYPID){ if (S.gy.some(g => g.id === t.id)) moveCard(t.id, 'bf'); } else sendRq(t.pid, 'gytake', 0, name, {d:t.k, f:{}}); commit(); return true; }
  if ((m = l.match(/^if you chose a creature other than (.+?) as your ring-bearer, (.+)$/))){ const rb = S.bf.find(c => c.ring); const ok = rb && cname(rb).toLowerCase() !== m[1]; if (ok || UI.dry) await jSay(rest(m[2]), ctx); return true; }
  if ((m = l.match(/^if x is (three|two|four|five) or more, that creature gains (\w+) until end of turn$/))){ const x = ctx.jX ?? 0; const t = (ctx.lastT || [])[0]; if ((x >= jn(m[1]) || UI.dry) && t) applyTo(t, {op:'pump', src:name, f:{p:0, t:0, kw:[m[2]]}}); return true; }
  if ((m = l.match(/^put x \+1\/\+1 counters on target attacking creature, where x is the number of permanents you've sacrificed this turn$/))){ const x = jTurnRec().sac || 0; ctx.jX = x; const t = T()[0]; if (t){ ctx.lastT = [t]; if (x) applyTo(t, {op:'ctr', n:x, src:name, d:'cp'}); } return true; }

  // ---------- batch 8
  if ((m = l.match(/^any number of target players each draw (\w+) cards$/))){ const n = jn(m[1]) || 0; T().filter(t => t.t === 'player').forEach(t => { if (t.pid === MYPID) draw(n); else { sendRq(t.pid, 'draw', Math.min(n, 20), name); log(`${t.nm} draws ${n}`); } }); return true; }
  if ((m = l.match(/^discard (\d+) cards$/))){ await jSay(`Discard ${['', 'a card', 'two cards', 'three cards'][+m[1]] || m[1] + ' cards'}`, ctx); return true; }
  if ((m = l.match(/^put a land card from your hand or graveyard onto the battlefield tapped$/))){ const list = S.hand.concat(S.gy).filter(c => isLand(c.k)); if (!list.length) return true; const ids = UI.dry ? [] : await pickCards({title:`${name}: put a land card from your hand or graveyard onto the battlefield tapped`, cards:list, min:0, max:1}); (ids || []).forEach(id => { moveCard(id, 'bf'); const c = find(id)[2]; if (c) c.tap = true; }); commit(); return true; }
  if ((m = l.match(/^manifest dread (twice|three times)$/))){ const n = m[1] === 'twice' ? 2 : 3; for (let i = 0; i < n; i++) await jSay('Manifest dread', ctx); return true; }
  if ((m = l.match(/^(?:have it|it) becomes? an? (\d+)\/(\d+) (\w+) creature with ([a-z ,]+?) until end of turn$/))){ const t = (ctx.lastT || [])[0]; const c = t && t.pid === MYPID ? S.bf.find(b => b.id === t.id) : null; if (c){ jAnimate(c, +m[1], +m[2], m[4].split(/,\s*(?:and\s+)?|\s+and\s+/).filter(Boolean), [cap(m[3])], 'eot'); log(`${cname(c)} becomes a ${m[1]}/${m[2]} ${m[3]} creature until end of turn`); commit(); } return true; }
  if ((m = l.match(/^return target creature card with mana value (\d+) or less from your graveyard to the battlefield and attach ~ to it$/))){ const t = T()[0]; if (t && t.pid === MYPID && S.gy.some(g => g.id === t.id)){ moveCard(t.id, 'bf'); if (srcC && find(srcC.id)[0] === 'bf') srcC.att = {pid:MYPID, id:t.id}; log(`${name}: returned ${t.nm} and attached to it`); commit(); } return true; }
  if ((m = l.match(/^target creature loses (flying|deathtouch|trample|first strike|lifelink|hexproof|indestructible|menace|reach|vigilance) until end of turn$/))){ cardsT(T()).forEach(t => applyTo(t, {op:'pump', src:name, f:{p:0, t:0, kw:['no' + m[1]]}})); return true; }
  if ((m = l.match(/^each attacking creature doesn't untap during its controller's next untap step$/))){ const pids = new Set(); boardsAll().forEach(b => b.bf.forEach(c => { if (c.k && c.atk) pids.add(b.pid); })); if (!pids.size) [...OPP.keys()].forEach(p => pids.add(p)); [...pids].forEach(pid => jCtl(pid, 'tangle', name)); return true; }
  if ((m = l.match(/^until the end of your next turn, you may play cards exiled this way$/)) && ((ctx.lastEx || []).length || UI.dry)){ if ((ctx.lastEx || []).length) grantPlay(ctx.lastEx, {next:true, src:name}); return true; }
  if ((m = l.match(/^exile all the cards from your hand, then draw that many cards$/)) || (m = l.match(/^exile all the cards from your hand$/))){ const ids = S.hand.map(c => c.id); ids.forEach(id => moveCard(id, 'ex', {quiet:true})); ctx.lastEx = ids; ctx.jThatMany = ids.length; log(`${name}: exiled ${ids.length} cards from their hand`); if (/then draw/.test(l)) draw(ids.length); commit(); return true; }
  if ((m = l.match(/^draw that many cards$/)) && ctx.jThatMany != null){ draw(ctx.jThatMany); return true; }
  if ((m = l.match(/^exile target creature you control$/)) && /exiled with ~/i.test(String(info(ctx.k)?.o || '').replace(/this land|this artifact|this enchantment/gi, '~').replace(new RegExp(escRe(name), 'g'), '~'))){ const t = T()[0]; const c = t && t.pid === MYPID ? S.bf.find(b => b.id === t.id) : null; if (c && srcC){ if (c.tok){ moveCard(c.id, 'gy', {quiet:true}); } else if (c.own){ sendBack(c, 'ex'); } else { moveCard(c.id, 'ex', {quiet:true}); srcC.jExw = (srcC.jExw || []).concat(c.id); } log(`${name}: exiled ${t.nm}`); commit(); } return true; }
  if ((m = l.match(/^return each creature card exiled with ~ to the battlefield under its owner's control$/))){ const ids = (srcC && srcC.jExw) || (ctx.it && ctx.it.jExw) || []; ids.forEach(id => { if (S.ex.some(c => c.id === id)) moveCard(id, 'bf'); }); log(`${name}: returned ${ids.length} card${ids.length === 1 ? '' : 's'}`); commit(); return true; }
  if ((m = l.match(/^search your library for up to (five|four|three|two) land cards that have different names, exile them, then shuffle$/))){ const n = jn(m[1]); const lands = S.lib.filter(c => isLand(c.k)); const ids = UI.dry ? [] : await pickCards({title:`${name}: search for up to ${n} land cards with different names`, cards:lands, min:0, max:n}); const seen = new Set(); const ok = (ids || []).map(id => find(id)[2]).filter(c => c && !seen.has(cname(c)) && seen.add(cname(c))); ok.forEach(c => moveCard(c.id, 'ex', {quiet:true})); if (srcC) srcC.jExw = (srcC.jExw || []).concat(ok.map(c => c.id)); shuffleLib(); log(`${name}: exiled ${ok.length} land${ok.length === 1 ? '' : 's'}`); commit(); return true; }
  if ((m = l.match(/^choose a card at random exiled with ~ and put it onto the battlefield tapped$/))){ const ids = ((srcC && srcC.jExw) || []).filter(id => S.ex.some(c => c.id === id)); if (!ids.length) return true; const id = ids[Math.floor(Math.random() * ids.length)]; moveCard(id, 'bf'); const c = find(id)[2]; if (c) c.tap = true; srcC.jExw = srcC.jExw.filter(x => x !== id); log(`${name}: put ${c ? cname(c) : 'a card'} onto the battlefield tapped`); commit(); return true; }
  if ((m = l.match(/^remove a loyalty counter from each of any number of permanents you control$/))){ const list = S.bf.filter(c => (c.co || 0) > 0 && isPW(c)); const ids = UI.dry ? [] : await pickCards({title:`${name}: remove a loyalty counter from any number of permanents`, cards:list, min:0, max:list.length}); (ids || []).forEach(id => { const c = S.bf.find(b => b.id === id); if (c) c.co = Math.max(0, (c.co || 0) - 1); }); ctx.jThatMany = (ids || []).length; log(`${name}: removed ${ctx.jThatMany} loyalty counter${ctx.jThatMany === 1 ? '' : 's'}`); commit(); return true; }
  if ((m = l.match(/^exile that many cards from the top of your library$/)) && ctx.jThatMany != null){ const out = S.lib.splice(0, ctx.jThatMany); S.ex.push(...out); ctx.lastEx = out.map(c => c.id); log(`${name}: exiled ${out.length} from the top of their library`); commit(); return true; }
  if ((m = l.match(/^(?:you may )?play them this turn$/)) && (ctx.lastEx || []).length){ grantPlay(ctx.lastEx, {src:name}); return true; }

  if ((m = l.match(/^(?:you )?create (?:a number of )?(an? )?(.+?) tokens?( with flying)? (?:for each (player being attacked|tapped [a-z]+(?:, [a-z]+)*,? and\/or [a-z]+ you control)|equal to (your devotion to (?:white|blue|black|red|green)))$/))){
    let n; if (m[5]) n = countOf(m[5], ctx); else if (/^player/.test(m[4])) n = jAttackedPids().length; else { const ds = m[4].replace(/^tapped /, '').replace(/ you control$/, '').split(/,\s*(?:and\/or\s+)?|\s+and\/or\s+/).filter(Boolean); n = S.bf.filter(c => c.tap && !c.fd && ds.some(d => descOk(c.k, d, {tok:c.tok}))).reduce((a, c) => a + (c.n || 1), 0); }
    const i0 = l.indexOf(m[2]); const desc = s.slice(i0, i0 + m[2].length);
    if (!n && !UI.dry){ log(`${name}: no tokens (0)`); return true; }
    await createFromText(`Create ${UI.dry ? 'a' : n} ${desc} token${n === 1 || UI.dry ? '' : 's'}${m[3] ? ' with flying' : ''}`, ctx); return true; }

  // ---------- batch 9: other players' libraries and exiled cards
  if ((m = l.match(/^(?:you )?manifest the top card of (?:that|target) player's library$/))){ const t = T().find(x => x.t === 'player'); const pid = (t && t.pid) || (ctx.it && (ctx.it.evDp || ctx.it.evPid)); if (!pid) return true; if (pid === MYPID) await jSay('Manifest the top card of your library', ctx); else { sendRq(pid, 'jTopTo', 1, name, {d:'manifest'}); log(`${name}: manifests the top card of ${nameOf(pid)}'s library`); } return true; }
  if ((m = l.match(/^put the top (one|two|three|card) cards? of (?:that|target) player's library onto the battlefield face down under your control$/))){ const t = T().find(x => x.t === 'player'); const pid = (t && t.pid) || (ctx.it && (ctx.it.evDp || ctx.it.evPid)); if (!pid || pid === MYPID) return true; const n = jn(m[1]) || 1; sendRq(pid, 'jTopTo', n, name, {d:'manifest'}); log(`${name}: puts the top ${n} cards of ${nameOf(pid)}'s library onto the battlefield face down`); return true; }
  if (/^they're 2\/2 [a-z]+ artifact creatures$/.test(l)) return true;
  if ((m = l.match(/^its owner loses (\d+) life$/))){ const e = jEv(ctx); const pid = e && JC.owner && JC.owner[e.id]; if (pid && pid !== MYPID) await loseLife(pid, +m[1], name); else if (!UI.dry) log(`${name}: owner unknown — no life loss`); return true; }
  if ((m = l.match(/^each opponent who has (three|two|four|five|ten) or more poison counters exiles the top card of their library face down$/))){ const pids = opponents().filter(p => (OPP.get(p.pid)?.psn || 0) >= jn(m[1])).map(p => p.pid); ctx.jIx = true; if (pids.length) await r21ExileFrom(pids, ctx, {n:1, w:'pal'}); else log(`${name}: no opponent has ${m[1]} or more poison counters`); return true; }
  if (/^(?:you may )?look at and play those cards for as long as they remain exiled, and you may spend mana as though it were mana of any color to cast those spells$/.test(l) && ctx.jIx) return true;
  if ((m = l.match(/^exile all creatures$/)) && /for each card exiled this way, you may play that card for as long as it remains exiled/i.test(String(ctx.full || ''))){ ctx.jHC = true; S.bf.filter(c => isCreatureCard(c) && !c.fd).forEach(c => { if (c.tok){ moveCard(c.id, 'gy', {quiet:true}); return; } if (c.own){ sendBack(c, 'ex'); return; } moveCard(c.id, 'ex', {quiet:true}); const x = S.ex.find(e => e.id === c.id); if (x) x.mayPlay = r21Perm('pal', name); }); const jobs = []; for (const [pid, st] of OPP) (st.bf || []).forEach(c => { if (c.k && !c.fd && isCreatureCard(c)) jobs.push(r21Ask(pid, 'r21exCard', 0, name, {tid:c.id, d:'pal'})); }); await Promise.all(jobs); log(`${name}: exiled all creatures — you may play them for as long as they remain exiled`); commit(); return true; }
  if (/^for each card exiled this way, you may play that card for as long as it remains exiled, and mana of any type can be spent to cast that spell$/.test(l) && ctx.jHC) return true;

  if ((m = l.match(/^(?:you may )?cast any number of spells from your hand without paying their mana costs$/))){ if (UI.dry) return true; for (let i = 0; i < 30; i++){ const list = S.hand.filter(c => !isLand(c.k)); if (!list.length) break; const ids = await pickCards({title:`${name}: cast a spell from your hand without paying its mana cost (or stop)`, cards:list, min:0, max:1, noneLabel:'Stop'}); const c = ids && ids[0] != null ? S.hand.find(x => x.id === ids[0]) : null; if (!c) break; UI.afterCast = () => {}; await r21bCastNow(c, 'hand', {free:true}); } return true; }

  if ((m = l.match(/^(khans|dragons) — (.+)$/))){ await jSay(rest(m[2]), ctx); return true; }
  if ((m = l.match(/^tap target creature that player controls$/))){ let t = T()[0]; const pid = ctx.it && ctx.it.evPid; if (!t && pid && pid !== MYPID && !UI.dry){ const list = (OPP.get(pid)?.bf || []).filter(c => c.k && !c.fd && isCreatureCard(c)); if (list.length){ const v = list.length === 1 ? String(list[0].id) : await askChoice({title:`${name}: tap target creature ${nameOf(pid)} controls`, options:list.map(c => ({label:info(c.k)?.n || '?', value:String(c.id)}))}); const c = list.find(x => String(x.id) === v); if (c) t = {t:'card', pid, id:c.id, k:c.k, nm:info(c.k)?.n}; } } if (t) applyTo(t, {op:'tap', src:name}); return true; }

  // ---------- batch 10
  if ((m = l.match(/^exile target nonland permanent$/)) && /you may cast that card for as long as it remains exiled, and you may spend colorless mana as though it were mana of any color/i.test(String(ctx.full || ''))){ const t = cardsT(T())[0]; ctx.jAA = true; if (!t || UI.dry) return true; if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c && !c.tok && !c.own){ moveCard(c.id, 'ex', {quiet:true}); const x = S.ex.find(e => e.id === c.id); if (x) x.mayPlay = r21Perm('al', name); } else if (c) moveCard(c.id, 'gy', {quiet:true}); } else await r21Ask(t.pid, 'r21exCard', 0, name, {tid:t.id, d:'al'}); log(`${name}: exiled ${t.nm} — you may cast it for as long as it remains exiled`); commit(); return true; }
  if (/^you may cast that card for as long as it remains exiled, and you may spend colorless mana as though it were mana of any color to cast that spell$/.test(l) && ctx.jAA) return true;
  if ((m = l.match(/^each opponent exiles cards from the top of their library until they exile a nonland card$/))){ ctx.jFS = true; await r21ExileFrom(opponents().map(p => p.pid), ctx, {until:'nonland', w:'r'}); return true; }
  if (/^you may cast any number of spells from among those nonland cards without paying their mana costs$/.test(l) && ctx.jFS){ await r21CastNow(ctx, {free:true}); return true; }
  if ((m = l.match(/^until end of turn, you may cast the exiled card without paying its mana cost$/))){ const ids = (ctx.lastEx || []).filter(id => S.ex.some(c => c.id === id)); if (ids.length) grantPlay(ids, {cast:true, src:name, free:true}); else if (!UI.dry) log(`${name}: nothing was exiled`); return true; }
  if ((m = l.match(/^reveal the top x plus one cards of your library$/)) && /choose a creature card and\/or a land card from among them/i.test(String(ctx.full || ''))){ const x = (ctx.it && ctx.it.x) || 0; const top = S.lib.slice(0, x + 1); ctx.jGST = true; if (UI.dry || !top.length) return true; log(`${name}: revealed ${top.map(cname).join(', ')}`); const cr = top.filter(c => /\bCreature\b/.test(info(c.k)?.t || '')), ld = top.filter(c => isLand(c.k)); const pick = []; if (cr.length){ const ids = await pickCards({title:`${name}: choose a creature card (optional)`, cards:cr, min:0, max:1}); if (ids && ids[0] != null) pick.push(ids[0]); } const ld2 = ld.filter(c => !pick.includes(c.id)); if (ld2.length){ const ids = await pickCards({title:`${name}: choose a land card (optional)`, cards:ld2, min:0, max:1}); if (ids && ids[0] != null) pick.push(ids[0]); } for (const id of pick){ const c = S.lib.find(z => z.id === id); if (!c) continue; let bf = false; if (x >= 5) bf = await askYes(`${name}: put ${cname(c)} onto the battlefield (or into your hand)?`, 'Battlefield', 'Hand'); moveCard(id, bf ? 'bf' : 'hand'); } const rest2 = top.filter(c => S.lib.includes(c)); rest2.forEach(c => S.lib.splice(S.lib.indexOf(c), 1)); shuffle(rest2); S.lib.push(...rest2); commit(); return true; }
  if (ctx.jGST && /^(choose a creature card and\/or a land card from among them|put those cards into your hand and the rest on the bottom of your library in a random order|if x is 5 or more, instead put the chosen cards onto the battlefield or into your hand and the rest on the bottom of your library)$/.test(l)) return true;
  if ((m = l.match(/^reveal target face-down permanent$/))){ ctx.lastT = T(); const t = ctx.lastT[0]; if (t) log(`${name}: reveals ${t.pid === MYPID ? cname(S.bf.find(b => b.id === t.id) || {}) : 'a face-down permanent'}`); return true; }
  if ((m = l.match(/^if it's a creature card, you may turn it face up$/))){ const t = (ctx.lastT || [])[0]; if (!t || UI.dry) return true; if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c && c.fd && /\bCreature\b/.test(info(c.k)?.t || '') && await askYes(`${name}: turn ${cname(c)} face up?`, 'Turn face up', 'No')){ c.fd = false; delete c.fdc; log(`turned ${cname(c)} face up`); emit({type:'turnup', k:c.k, id:c.id}); commit(); } } else jCtl(t.pid, 'faceupCr', name, {tid:t.id}); return true; }
  if ((m = l.match(/^each (\w+) you control deals (\d+) damage to that creature$/))){ const e = jEv(ctx); if (!e) return true; S.bf.filter(c => isCreatureCard(c) && !c.fd && descOk(c.k, m[1], {tok:c.tok})).forEach(c => { for (let i = 0; i < (c.n || 1); i++) dealDamage(e, +m[2], c.k, c); }); return true; }
  if ((m = l.match(/^until end of turn, each planeswalker you control becomes an? (\d+)\/(\d+) (?:\w+ )?(\w+) creature and gains (\w+)$/))){ S.bf.filter(c => isPW(c) && !c.fd).forEach(c => jAnimate(c, +m[1], +m[2], [m[4]], [cap(m[3]), 'Creature'], 'eot')); log(`${name}: planeswalkers become ${m[1]}/${m[2]} ${m[3]} creatures until end of turn`); return true; }
  if ((m = l.match(/^choose up to (four|three|two) target creature cards in your graveyard that were put there from the battlefield this turn$/))){ ctx.jCont = T().filter(t => t.pid === MYPID && (jTurnRec().bfGy || []).includes(t.id)).map(t => t.id); return true; }
  if (/^return them to the battlefield$/.test(l) && ctx.jCont){ ctx.jCont.forEach(id => { if (S.gy.some(g => g.id === id)) moveCard(id, 'bf'); }); commit(); return true; }
  if ((m = l.match(/^airbend another target (.+)$/))){ await jSay('Airbend up to one other target ' + rest(m[1]), ctx); return true; }
  if ((m = l.match(/^if ~ is untapped, that player adds \{c\} for each artifact they control$/))){ if (!srcC || srcC.tap) return true; const pid = (ctx.it && ctx.it.evPid) || MYPID; const n = boardOf(pid).filter(c => c.k && !c.fd && /\bArtifact\b/.test(pid === MYPID ? typeOf(c) : (info(c.k)?.t || ''))).reduce((a, c) => a + (c.n || 1), 0); if (!n) return true; if (pid === MYPID){ addMana(Array(n).fill('C')); log(`${name}: added ${n} {C}`); commit(); } else jCtl(pid, `mana:C:${n}`, name); return true; }

  // ---------- batch 11
  if ((m = l.match(/^reveal the top two cards of your library$/)) && /an opponent chooses one of them/i.test(String(ctx.full || ''))){ ctx.jKarn = S.lib.slice(0, 2); log(`${name}: revealed ${ctx.jKarn.map(cname).join(' and ')}`); return true; }
  if ((m = l.match(/^an opponent chooses one of them$/)) && ctx.jKarn){ const two = ctx.jKarn; if (!two.length) return true; let pickId = two[0].id; const opp = opponents()[0]; if (two.length === 2 && opp){ const pid = opponents().length > 1 && !UI.dry ? await choosePlayer(`${name}: which opponent chooses?`, true) : opp.pid; const ids = await r22oppPick(pid, two, 1, `${name}: choose the card ${nameOf(MYPID)} puts into their hand (the other is exiled with a silver counter)`, name); pickId = (ids || [])[0] ?? two[0].id; } ctx.jKarnPick = pickId; return true; }
  if ((m = l.match(/^put that card into your hand and exile the other with a silver counter on it$/)) && ctx.jKarn){ for (const c of ctx.jKarn){ const i = S.lib.indexOf(c); if (i < 0) continue; S.lib.splice(i, 1); if (c.id === ctx.jKarnPick){ S.hand.push(c); log(`${name}: put ${cname(c)} into their hand`); } else { S.ex.push(c); c.nc = {...(c.nc || {}), silver:1}; log(`${name}: exiled ${cname(c)} with a silver counter`); } } commit(); return true; }
  if ((m = l.match(/^put a card you own with a silver counter on it from exile into your hand$/))){ const list = S.ex.filter(c => (c.nc || {}).silver && !c.own); if (!list.length){ log(`${name}: no card with a silver counter in exile`); return true; } const ids = list.length === 1 || UI.dry ? [list[0].id] : await pickCards({title:`${name}: put a card with a silver counter into your hand`, cards:list, min:1, max:1}); (ids || []).forEach(id => { const c = S.ex.find(x => x.id === id); if (c){ S.ex.splice(S.ex.indexOf(c), 1); delete c.nc.silver; S.hand.push(c); log(`${name}: put ${cname(c)} into their hand`); } }); commit(); return true; }
  if ((m = l.match(/^starting with the next opponent in turn order, each player chooses a creature you don't control$/))){ const all2 = []; for (const [pid, st] of OPP) (st.bf || []).forEach(c => { if (c.k && !c.fd && isCreatureCard(c)) all2.push({pid, c}); }); ctx.jChosen = []; if (!all2.length) return true; const ps = players(); const me = ps.findIndex(p => p.me); const order = ps.slice(me + 1).concat(ps.slice(0, me + 1)); for (const p of order){ let pick; if (p.me){ if (UI.dry) pick = all2[0]; else { const v = await askChoice({title:`${name}: choose a creature you don't control`, options:all2.map((x, i) => ({label:`${info(x.c.k)?.n} (${nameOf(x.pid)})`, value:String(i)}))}); pick = all2[+v] || all2[0]; } } else { const cards = all2.map(x => ({id:x.c.id, k:x.c.k})); const ids = await r22oppPick(p.pid, cards.slice(0, 12), 1, `${name}: choose a creature ${nameOf(MYPID)} doesn't control (it will be destroyed)`, name); const id = (ids || [])[0]; pick = all2.find(x => x.c.id === id) || all2[0]; } if (pick){ ctx.jChosen.push(pick); log(`${name}: ${p.nm} chose ${info(pick.c.k)?.n} (${nameOf(pick.pid)})`); } } return true; }
  if (/^destroy the chosen creatures$/.test(l) && ctx.jChosen){ const seen = new Set(); ctx.jChosen.forEach(x => { const key = x.pid + ':' + x.c.id; if (seen.has(key)) return; seen.add(key); applyTo({t:'card', pid:x.pid, id:x.c.id}, {op:'destroy', src:name}); }); return true; }
  if ((m = l.match(/^each player chooses an artifact, a creature, an enchantment, and a planeswalker from among the nonland permanents they control$/))){ ctx.jGear = true; players().forEach(p => jCtl(p.pid, 'gearhulk', name)); return true; }
  if (/^sacrifices the rest$/.test(l) && ctx.jGear) return true;
  if ((m = l.match(/^(?:you may )?pay x life, where x is that spell's mana value$/))){ const k = ctx.it && ctx.it.evk; const x = k ? (info(k)?.mv || 0) : 0; ctx.jX = x; if (ctx.srcId != null){ S.jOnce = S.jOnce || {}; if (S.jOnce[ctx.srcId] === turnStr()){ ctx.didPay = false; log(`${name}: already done this turn`); return true; } } S.life -= x; ctx.didPay = true; if (ctx.srcId != null) S.jOnce[ctx.srcId] = turnStr(); log(`${name}: paid ${x} life`); commit(); return true; }
  if ((m = l.match(/^create a 1\/1 colorless hero creature token and put x \+1\/\+1 counters on it$/))){ await createFromText('Create a 1/1 colorless Hero creature token', ctx); const tk = S.bf.find(b => b.id === JC.lastTok); if (tk && ctx.jX){ const t2 = (tk.n || 1) > 1 ? single(tk) : tk; modCounters(t2, 'cp', ctx.jX); } return true; }
  if ((m = l.match(/^until end of turn, gain control of target nonlegendary creature an opponent controls with power less than or equal to the amassed army's power$/))){ const t = T()[0]; ctx.stoleFlags = true; if (!t || t.pid === MYPID) return true; const army = S.bf.find(c => /\bArmy\b/.test(typeOf(c)) && !c.fd); const ap = army ? (stats(army) || [0])[0] : 0; const tp = (statsAny(t) || [99])[0]; if (tp > ap){ log(`${name}: ${t.nm} has power ${tp} — more than the Army's ${ap}`); return true; } applyTo(t, {op:'steal', src:name, f:{eot:true, untap:true, haste:true}}); return true; }
  if ((m = l.match(/^(?:you may )?put that card onto the battlefield under your control$/)) && ctx.it && (ctx.it.evk || UI.dry) && /a creature an opponent controls/i.test(String(info(ctx.k)?.o || ''))){ const once = /do this only once each turn/i.test(String(info(ctx.k)?.o || '')); S.jOnce = S.jOnce || {}; const key = 'r' + ctx.srcId; if (once && S.jOnce[key] === turnStr()){ log(`${name}: already done this turn`); return true; } const pid = ctx.it.evPid; if (!pid || pid === MYPID || UI.dry) return true; if (!(await askYes(`${name}: put ${info(ctx.it.evk)?.n} onto the battlefield under your control?`, 'Yes', 'No'))) return true; sendRq(pid, 'jGyTake', 0, name, {d:'|' + ctx.it.evk}); if (once) S.jOnce[key] = turnStr(); log(`${name}: takes ${info(ctx.it.evk)?.n} from ${nameOf(pid)}'s graveyard`); return true; }

  if ((m = l.match(/^put (a|an|one|two) \+1\/\+1 counters? on it$/)) && ctx.it && ctx.it.jdealt){ const e = jEv(ctx); const c = e && e.pid === MYPID ? S.bf.find(b => b.id === e.id) : null; if (c){ modCounters(c, 'cp', jn(m[1]) || 1); log(`${cname(c)} gets a +1/+1 counter (${name})`); commit(); } return true; }

  if (/^reveals the top card of their library$/.test(l) && (ctx.jOwner || UI.dry)){ ctx.jRevP = true; return true; }
  if (/^if it's a permanent card, they put it onto the battlefield$/.test(l) && (ctx.jRevP || UI.dry)){ if (ctx.jOwner) jCtl(ctx.jOwner, 'revealPerm', name); return true; }

  if (/^target spell can't be countered$/.test(l)){ const sid = ctx.it && ctx.it.tgt; if (!sid) return true; const it = S.stk.find(x => x.sid === sid); if (it){ it.uc = true; log(`${name}: ${it.nm} can't be countered`); commit(); } else { const st = stackAll().find(x => x.sid === sid); if (st && st.pid) jCtl(st.pid, 'uc:' + sid, name); } return true; }

  if ((m = l.match(/^put that card into your hand if you control an? (\w+)$/)) && Array.isArray(ctx.jSrch)){ const ok = (countOf(m[1] + ' you control', ctx) || 0) > 0; ctx.condResult = ok; if (ok) log(`${name}: you control ${m[1] === 'assassin' ? 'an' : 'a'} ${cap(m[1])} — the card stays in your hand`); return true; }
  if ((m = l.match(/^otherwise, put that card on top of your library$/)) && Array.isArray(ctx.jSrch)){ if (ctx.condResult === false) ctx.jSrch.forEach(id => { const i = S.hand.findIndex(c => c.id === id); if (i >= 0){ const [c] = S.hand.splice(i, 1); S.lib.unshift(c); log(`${name}: put ${cname(c)} on top of their library`); } }); ctx.condResult = null; commit(); return true; }
  if ((m = l.match(/^pay any amount of mana$/)) && /look at that many cards from the top of your library/i.test(String(ctx.full || ''))){ if (UI.dry){ ctx.jPaid = 2; return true; } let max = 0; for (let n = 1; n <= 20; n++){ if (payPlan(parseCost(`{${n}}`), S.pool).err) break; max = n; } const v = await askChoice({title:`${name}: pay how much mana? (look at that many cards)`, options:Array.from({length:max + 1}, (_, i) => ({label:String(i), value:String(i)}))}); const n = +(v || 0); if (n){ const plan = payPlan(parseCost(`{${n}}`), S.pool); if (!plan.err){ S.pool = plan.pool; log(`${name}: paid {${n}}`); } } ctx.jPaid = n; commit(); return true; }
  if ((m = l.match(/^look at that many cards from the top of your library$/)) && ctx.jPaid != null){ ctx.jLL = S.lib.slice(0, ctx.jPaid); return true; }
  if (/^put one of those cards into your hand and the rest on the bottom of your library in a random order$/.test(l) && ctx.jLL){ const cs = ctx.jLL.filter(c => S.lib.includes(c)); if (!cs.length || UI.dry) return true; const ids = cs.length === 1 ? [cs[0].id] : await pickCards({title:`${name}: put one into your hand`, cards:cs, min:1, max:1}); const h = cs.find(c => c.id === (ids || [])[0]) || cs[0]; cs.forEach(c => S.lib.splice(S.lib.indexOf(c), 1)); S.hand.push(h); const restc = cs.filter(c => c !== h); shuffle(restc); S.lib.push(...restc); log(`${name}: one card to hand, ${restc.length} on the bottom`); commit(); return true; }
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound23JPre(s, l, ctx)) return; return ds(s0, ctx); }; }
STATIC_KNOWN.push(/^other .+? you control have (horsemanship|intimidate)$/);

// installed after every script has loaded, so these few wordings win over later helper files that read them more narrowly
setTimeout(() => {
  const ds = doSentence;
  doSentence = async function(s0, ctx){
    const l = String(s0).replace(/\.$/, '').trim().toLowerCase(); let m;
    if (ctx && ctx.jEachSac && (m = l.match(/^sacrifices a (land|creature) of their choice$/))){ for (const p of players()){ if (p.pid === MYPID) addChoicePrompt('sac', m[1], 1, MYPID, ctx.name); else sendRq(p.pid, 'sac', 1, ctx.name, {d:m[1]}); } return; }
    return ds(s0, ctx);
  };
}, 0);
