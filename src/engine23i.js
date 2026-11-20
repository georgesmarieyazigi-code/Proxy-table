/* ===================== Rules engine — round 23 helper I: ranks 4450–5292 of the 7,000 most-played cards ===================== */
RQ_OPS.push('r23Igyex', 'r23Imillh', 'r23Isac1', 'r23Icopy', 'r23Iexgy', 'r23Imon', 'r23Iphase', 'r23Irfc', 'r23Ifrz', 'r23Ifrz1', 'r23Ipick', 'r23Iwheel', 'r23Iself', 'r23Ibtough', 'r23Igift');
const R23I = {
  KW: /^(flying|first strike|double strike|trample|vigilance|lifelink|deathtouch|haste|menace|reach|hexproof|indestructible|fear|intimidate|shroud|protection from [a-z]+|skulk|wither|infect)$/,
};
// "exile a card from another player's graveyard" was sent as gytake + ex:1, but the ex flag is not part of a published
// request, so the owner handed the card over instead of exiling it. Send it as its own op.
{
  const sr = sendRq;
  sendRq = function(to, op, n, src, extra = {}){ if (op === 'gytake' && extra && extra.ex){ const {ex, ...rest} = extra; return sr(to, 'r23Igyex', n, src, rest); } return sr(to, op, n, src, extra); };
  const tk = takeCard;
  takeCard = function(r, from){ const before = S.bf.length; const out = tk(r, from); try { if (r && r.f && r.f.fromGy && r.f.tap && S.bf.length > before){ const c = S.bf[S.bf.length - 1]; if (c) c.tap = true; } } catch {} return out; };
}
// Vizkopa Guildmage: "whenever you gain life this turn, each opponent loses that much life"
{
  const gl = gainLife;
  gainLife = function(n, ...a){ const r = gl(n, ...a); try { if (r && S && n > 0 && S.r23Iviz && S.r23Iviz.t === turnStr() && !UI.dry){ const times = S.r23Iviz.n || 1; opponents().forEach(p => { sendRq(p.pid, 'life', -n * times, 'Vizkopa Guildmage'); log(`${p.nm} loses ${n * times} life (Vizkopa Guildmage)`); }); } } catch {} return r; };
}
// a nonland permanent left the battlefield this turn (any player)
function r23ILeftNonland(){ return !!(S && S.r23Ileft === turnStr()); }
// trigger conditions that list several creature types ("another Frog, Rabbit, Raccoon, or Squirrel you control enters"):
// the comma list would split the trigger condition, so read it as "Frog or Rabbit or …"
{
  const tn = tname;
  const one = w => { w = w.toLowerCase(); return w === 'mice' ? 'mouse' : w.replace(/ves$/, 'f').replace(/([^s])s$/, '$1'); };
  tname = function(txt, name){
    let t = tn(txt, name);
    if (typeof t === 'string' && /,/.test(t)) t = t.replace(/\b(Whenever (?:another|an?|one or more(?: other)?) )((?:[A-Z][a-z]+, ){2,})(?:and\/or |or )([A-Z][a-z]+)( you control (?:enters?|attacks?|dies|die))/g, (all, pre, list, last, post) => pre + list.split(', ').filter(Boolean).concat(last).map(one).join(' or ') + post);
    return t;
  };
}
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){
    let m;
    if (w === 'whenever' && (m = String(c).match(/^a player sacrifices an? (nontoken )?creature$/))) return {ev:'sac', subj:'any', ctl:'any', desc:(m[1] || '') + 'creature'};
    return ct(w, c);
  };
}
// token copies with a different base power/toughness (and extra types)
function r23ICopyTok(k, o = {}){
  if (!k || !info(k)) return null;
  const tk = {id:S.nid++, k, tok:true, n:1, sk:true}; if (o.tapped) tk.tap = true; if (o.pt) tk.r23pt = o.pt; if (o.types) tk.r23types = o.types; if (o.haste) tk.ekw = ['haste'];
  place(tk); S.bf.push(tk); log(`created a token copy of ${info(k).n}${o.pt ? ` (${o.pt.join('/')})` : ''}${o.types ? ` — also ${o.types}` : ''}`); emit({type:'enter', k, id:tk.id, tok:1}); return tk;
}
{
  const st0 = stats;
  stats = function(c, pid){ const r = st0(c, pid); try { if (c && c.r23pt && r){ const base = r23IPT(c) || [0, 0]; return [r[0] - base[0] + c.r23pt[0], r[1] - base[1] + c.r23pt[1]]; } } catch {} return r; };
  const tyo = typeOf;
  typeOf = function(c){ const t = tyo(c); return c && c.r23types ? t + ' ' + c.r23types : t; };
  const sp = setPhase;
  setPhase = function(i){ if (S && S.r23Ikeep && i > 4){ if (S.keepMana === S.r23Ikeep) S.keepMana = null; S.r23Ikeep = null; } return sp(i); };
}
// exiled cards that come back later (Yorion: next end step, Nahiri's Resolve: my next upkeep)
{
  const fs = fireSteps;
  fireSteps = function(step, activePid){
    const r = fs(step, activePid);
    try { if (S && (S.r23Ifl || []).length && !UI.dry){ const due = S.r23Ifl.filter(f => (f.when === 'end' && step === 'end') || (f.when === 'upkeep' && step === 'upkeep' && activePid === MYPID && f.t !== turnStr()));
      due.forEach(f => { S.r23Ifl.splice(S.r23Ifl.indexOf(f), 1); f.ids.forEach(id => { const c = S.ex.find(x => x.id === id); if (c) moveCard(c.id, 'bf'); }); log(`${f.src}: ${f.ids.length} exiled card${f.ids.length === 1 ? '' : 's'} returned to the battlefield`); }); if (due.length) commit(); } } catch (e){ console.warn(e); }
    return r;
  };
}
// creatures that died under MY control this turn
function r23IDiedMine(){ return S && S.r23Id && S.r23Id.t === turnStr() ? S.r23Id.n : 0; }
// opponents who lost life this turn (life tracker of engine21b)
function r23IOppsLost(){ const L = S.r21blife; if (!L || L.t !== turnStr()) return 0; return opponents().filter(p => L.min[p.pid] != null && L.min[p.pid] < L.start[p.pid]).length; }
function r23ITopLib(c){ if (!c) return; moveCard(c.id, 'lib', {quiet:true}); const i = S.lib.findIndex(x => x.id === c.id); if (i > 0){ const [x] = S.lib.splice(i, 1); S.lib.unshift(x); } log(`put ${cname(c)} on top of their library`); }
function r23IPhaseOut(c){ if (!c) return; const i = S.bf.indexOf(c); if (i < 0) return; S.bf.splice(i, 1); (S.poz ||= []).push(c); log(`${cname(c)} phased out`); }
function r23IKws(txt){ const ks = String(txt).split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim()).filter(Boolean); return ks.every(k => R23I.KW.test(k)) ? ks : null; }
function r23ICount(phrase, ctx){
  const p = String(phrase).trim();
  let m;
  if ((m = p.match(/^twice (.+)$/))){ const n = r23ICount(m[1], ctx); return n == null ? null : 2 * n; }
  if (/^(?:the number of )?attacking creatures?$/.test(p)) return boardsAll().reduce((s, b) => s + b.bf.filter(c => c.k && c.atk && !c.fd).reduce((a, c) => a + (c.n || 1), 0), 0);
  if (/^(?:the number of )?creatures? that died under your control this turn$/.test(p)) return r23IDiedMine();
  if (/^(?:the number of )?opponents? who lost life this turn$/.test(p)) return r23IOppsLost();
  const n = countOf(p, ctx); return n == null || !Number.isFinite(n) ? null : n;
}
function r23IPump(ts, f, name){ (ts || []).forEach(t => { if (t && t.t !== 'player') applyTo(t, {op:'pump', src:name, f}); }); }
{
  const he = handleEvent;
  handleEvent = function(pid, ev){ try { if (S && ev && (ev.type === 'leave' || ev.type === 'die') && ev.k){ if (!isLand(ev.k)) S.r23Ileft = turnStr(); if (pid === MYPID) S.r23IleftMine = turnStr(); } } catch {} try { if (S && ev && ev.type === 'enter' && pid === MYPID && ev.k){ (S.r23Ient ||= []).push({t:turnStr(), id:ev.id, k:ev.k, tok:ev.tok ? 1 : 0}); if (S.r23Ient.length > 60) S.r23Ient.splice(0, S.r23Ient.length - 60); } } catch {} try { if (S && ev && ev.type === 'die' && pid === MYPID){ if (!S.r23Id || S.r23Id.t !== turnStr()) S.r23Id = {t:turnStr(), n:0}; S.r23Id.n += ev.cnt || 1; } } catch {} return he(pid, ev); };
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'r23Igyex'){ const i = S.gy.findIndex(g => g.k === r.d); if (i >= 0){ const g = S.gy[i]; moveCard(g.id, 'ex', {quiet:true}); log(`${cname(g)} was exiled from their graveyard (${r.src || nameOf(from)})`); } commit(); return; }
    if (r.op === 'r23Imillh'){ const n = r.n ? Math.ceil(S.lib.length / 2) : Math.floor(S.lib.length / 2); mill(n); log(`milled half their library — ${n} cards (${r.src})`); commit(); return; }
    if (r.op === 'r23Isac1'){ const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; if (c){ sacrificeOne(single(c)); log(`sacrificed ${cname(c)} (${r.src})`); } commit(); return; }
    if (r.op === 'r23Icopy'){ const tk = r23ICopyTok(String(r.d || '')); if (tk && r.n) tk.goad = {by:from, n:1e9}; commit(); return; }
    if (r.op === 'r23Iexgy'){ const n = S.gy.length; S.gy.slice().forEach(c => moveCard(c.id, 'ex', {quiet:true})); log(`exiled their graveyard — ${n} cards (${r.src})`); commit(); return; }
    if (r.op === 'r23Imon'){ becomeMonarch(r.src); commit(); return; }
    if (r.op === 'r23Iphase'){ const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; if (c) r23IPhaseOut(single(c)); commit(); return; }
    if (r.op === 'r23Irfc'){ const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; if (c){ c.atk = ''; c.blk = null; log(`${cname(c)} was removed from combat (${r.src})`); } commit(); return; }
    if (r.op === 'r23Ifrz'){ const d = String(r.d || 'permanent'); S.bf.filter(c => !c.fd && descOk(c.k, d, {tok:c.tok})).forEach(c => { c.tap = true; if (r.n) c.skipUntap = 1; }); log(`tapped all their ${d}s${r.n ? " — they don't untap during the next untap step" : ''} (${r.src})`); commit(); return; }
    if (r.op === 'r23Ifrz1'){ const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; if (c){ c.skipUntap = 1; } commit(); return; }
    if (r.op === 'r23Ipick'){ (async () => { await r23IPickOwn(String(r.d || ''), r.n || 1, r.src); commit(); })(); return; }
    if (r.op === 'r23Iwheel'){ const n = S.hand.length; S.hand.slice().forEach(c => moveCard(c.id, 'gy', {quiet:true})); draw(r.n || 0); log(`discarded their hand (${n}) and drew ${r.n} (${r.src})`); commit(); return; }
    if (r.op === 'r23Iself'){ S.bf.filter(c => !c.fd && isCreatureCard(c)).forEach(c => { const p = Math.max(0, (stats(c) || [0])[0]); if (p > 0) damageCard(c, p, srcFlags(c.k, MYPID, c)); }); log(`each of their creatures dealt damage to itself equal to its power (${r.src})`); commit(); return; }
    if (r.op === 'r23Ibtough'){ const list = S.bf.filter(c => !c.fd && isCreatureCard(c) && (stats(c) || [0, 0])[1] <= r.n); list.forEach(c => moveCard(c.id, c.tok ? 'gy' : 'hand', {quiet:true})); if (list.length) log(`${list.length} of their creatures returned to hand (${r.src})`); commit(); return; }
    if (r.op === 'r23Igift'){ const [what, amt] = String(r.d || '').split('|'); if (what === 'draw+life'){ draw(r.n || 1); gainLife(+amt || 0, r.src); log(`drew ${r.n} and gained ${amt} life (${r.src})`); } commit(); return; }
    return ao(r, from);
  };
}
// a player chooses cards of their own: zone|action|desc  (hand|ex, gy|ex, bf|keep = keep n and sacrifice the rest)
async function r23IPickOwn(spec, n, src){
  const [zone, act, desc0] = spec.split('|'); const desc = desc0 || 'card';
  const pool = (zone === 'bf' ? S.bf.filter(c => !c.fd) : zone === 'gy' ? S.gy : S.hand).filter(c => desc === 'card' || (desc === 'greatestmv' ? isCreatureCard(c) : descOk(c.k, desc, {tok:c.tok})));
  if (!pool.length) return;
  if (act === 'keep'){
    if (pool.length <= n){ log(`keeps all ${pool.length} ${desc}s (${src})`); return; }
    const ids = UI.dry ? pool.slice(0, n).map(c => c.id) : await pickCards({title:`${src}: choose ${n} ${desc}s to keep — the rest are sacrificed`, cards:pool, min:n, max:n});
    const keep = new Set(ids || pool.slice(0, n).map(c => c.id)); const gone = pool.filter(c => !keep.has(c.id)); gone.forEach(c => sacrificeOne(c)); log(`sacrificed ${gone.length} ${desc}s (${src})`); return;
  }
  if (act === 'bnc' || act === 'exb'){
    let cand = pool; if (desc0 === 'greatestmv'){ const mx = Math.max(...pool.map(c => info(c.k)?.mv || 0)); cand = pool.filter(c => (info(c.k)?.mv || 0) === mx); }
    const ids = cand.length <= 1 || UI.dry ? cand.slice(0, 1).map(c => c.id) : await pickCards({title:`${src}: choose a creature to ${act === 'bnc' ? "return to its owner's hand" : 'exile'}`, cards:cand, min:1, max:1});
    (ids || []).forEach(id => { const c = S.bf.find(x => x.id === id); if (!c) return; if (act === 'bnc') moveCard(c.id, c.tok ? 'gy' : 'hand', {quiet:true}); else moveCard(c.id, 'ex', {quiet:true}); log(`${act === 'bnc' ? 'returned' : 'exiled'} ${cname(c)} (${src})`); }); return;
  }
  const k = Math.min(n, pool.length);
  const ids = pool.length <= k || UI.dry ? pool.slice(0, k).map(c => c.id) : await pickCards({title:`${src}: exile ${k} ${desc}${k === 1 ? '' : 's'} from your ${zone === 'gy' ? 'graveyard' : 'hand'}`, cards:pool, min:k, max:k});
  (ids || []).forEach(id => moveCard(id, 'ex', {quiet:true})); log(`exiled ${(ids || []).length} card${k === 1 ? '' : 's'} from their ${zone === 'gy' ? 'graveyard' : 'hand'} (${src})`);
}
function r23ISubs(k){ const a = info(k) || {}; const t = String(a.t || ''); if (/changeling/i.test(a.o || '')) return ['*']; const i = t.indexOf('—'); return i < 0 ? [] : t.slice(i + 1).trim().split(/\s+/).filter(Boolean); }
function r23IShare(k1, k2){ const a = r23ISubs(k1), b = r23ISubs(k2); if (!a.length || !b.length) return false; if (a.includes('*') || b.includes('*')) return true; return a.some(x => b.includes(x)); }
function r23ICardText(ctx){ const a = info(ctx.k); return a ? tname(String(a.o || '') + (a.back ? '\n' + (a.back.o || '') : ''), ctx.name || a.n).toLowerCase() : ''; }
// a player answers yes/no on their own screen (dry run: no)
async function r23IAsk(pid, q, src){ if (pid === MYPID) return UI.dry ? true : askYes(`${src}: ${q}`, 'Yes', 'No'); return r22ask(pid, q, src); }
// total power of my creatures
function r23ITotPow(){ return S.bf.filter(c => !c.fd && isCreatureCard(c)).reduce((a, c) => a + Math.max(0, (stats(c) || [0])[0]) * (c.n || 1), 0); }
function r23IPT(c){ const a = info(c.k) || {}; const pm = String(a.p || '').match(/^(\d+)\/(\d+)$/); return pm ? [+pm[1], +pm[2]] : null; }
async function doRound23IPre(s, l, ctx){
  let m;
  const name = ctx.name || '';
  const full = tname(String(ctx.full || ''), name).toLowerCase();
  const T = () => (ctx.tgts ? nextTargets(ctx) : []);
  const src = () => srcCardOf(ctx);
  // ---- pumps / keyword grants on targets with any descriptor ("up to two target creatures", "another target attacking creature", "target Shark")
  if ((m = l.replace(/^until end of turn, (.+)$/, '$1 until end of turn').match(/^(?:(up to (?:one|two|three|four|five|x|\d+) )|(another )|(any number of ))?target ([a-z ,'-]+?) (?:gets? ([+-]\d+)\/([+-]\d+)(?: and gains? (.+?))?|gains? (.+?)(?: and gets? ([+-]\d+)\/([+-]\d+))?) until end of turn$/))){
    const kwTxt = m[7] || m[8] || '';
    const kws = kwTxt ? r23IKws(kwTxt) : [];
    const pnum = v => v == null ? 0 : /x/.test(v) ? (v[0] === '-' ? -1 : 1) * ((ctx.it && ctx.it.x) || 0) : +v;
    if (kws && !/\b(gets?|gains?|and)\b/.test(m[4]) && (m[5] || m[8])){
      const f = {p:m[5] ? pnum(m[5]) : pnum(m[9]), t:m[5] ? pnum(m[6]) : pnum(m[10]), kw:kws};
      r23IPump(T(), f, name); commit(); return true;
    }
  }
  // ---- Tifa's Limit Break: triple a creature's power and toughness
  if ((m = l.match(/^(double|triple) target creature's power and toughness until end of turn$/))){
    const t = T()[0]; const st = t && statsAny(t); if (st){ const k = m[1] === 'triple' ? 2 : 1; applyTo(t, {op:'pump', src:name, f:{p:st[0] * k, t:st[1] * k}}); } commit(); return true;
  }
  // ---- Wand of Orcus: it and Zombies you control gain deathtouch
  if ((m = l.match(/^it and ([a-z]+) you control gain ([a-z ]+) until end of turn$/)) && r23IKws(m[2])){
    const kws = r23IKws(m[2]); const sc = src(); const evc = ctx.it && ctx.it.evId != null ? S.bf.find(c => c.id === ctx.it.evId) : null;
    const it = evc || (sc && sc.att && S.bf.find(c => c.id === sc.att.id));
    const list = S.bf.filter(c => !c.fd && isCreatureCard(c) && descOk(c.k, m[1], {tok:c.tok}));
    if (it && !list.includes(it)) list.push(it);
    list.forEach(c => applyOp({op:'pump', tid:c.id, f:{p:0, t:0, kw:kws}}, MYPID)); commit(); return true;
  }
  // ---- mills half their library
  if ((m = l.match(/^(target player|defending player) mills half their library, rounded (up|down)$/))){
    let pid = null; if (m[1] === 'target player'){ const t = T()[0]; pid = t && t.pid; } else pid = ctx.it && (ctx.it.evDp || ctx.it.evPid);
    if (!pid || pid === 'dry-opp' && UI.dry) return true;
    const size = pid === MYPID ? S.lib.length : ((OPP.get(pid) || {}).lc || 0);
    const n = m[2] === 'up' ? Math.ceil(size / 2) : Math.floor(size / 2);
    if (pid === MYPID){ mill(n); log(`milled ${n} cards — half their library (${name})`); } else { sendRq(pid, 'r23Imillh', m[2] === 'up' ? 1 : 0, name); log(`${nameOf(pid)} mills half their library — about ${n} cards (${name})`); }
    commit(); return true;
  }
  // ---- Galvanic Blast metalcraft: 4 damage instead (2 more to the same target)
  if ((m = l.match(/^~ deals (\d+) damage instead if you control (three|\w+) or more artifacts$/))){
    const first = (full.match(/^~ deals (\d+) damage to any target/) || [])[1]; const n = S.bf.filter(c => !c.fd && descOk(c.k, 'artifact')).reduce((a, c) => a + (c.n || 1), 0);
    const t = (ctx.lastT || [])[0];
    if (first && t && n >= (wn(m[2]) || 3)){ dealDamage(t, +m[1] - +first, ctx.k, src()); log(`${name}: metalcraft — ${m[1]} damage instead`); }
    commit(); return true;
  }
  // ---- return target X card with mana value N or less from your graveyard to the battlefield (tapped)
  if ((m = l.match(/^return (another )?target ([a-z ]+?) card with mana value (\d+) or less from your graveyard to the battlefield( tapped)?$/))){
    for (const t of T()){ const c = t.pid === MYPID && S.gy.find(g => g.id === t.id); if (!c) continue; moveCard(c.id, 'bf', {quiet:true}); if (m[4]) c.tap = true; ctx.lastCardId = c.id; log(`returned ${cname(c)} to the battlefield${m[4] ? ' tapped' : ''}`); }
    commit(); return true;
  }
  // ---- draw a card for each …
  if ((m = l.match(/^(?:then )?draw a card for each (attacking creature|creature that died under your control this turn|opponent who lost life this turn)$/))){
    const n = r23ICount(m[1], ctx) || 0; if (n){ draw(n); log(`drew ${n} card${n === 1 ? '' : 's'} (${name})`); } else log(`${name}: no cards to draw`); commit(); return true;
  }
  // ---- target opponent loses life equal to the number of creatures they control
  if ((m = l.match(/^target opponent loses life equal to the number of (creatures|lands|artifacts) they control$/))){
    const t = T()[0]; if (!t) return true; const n = boardOf(t.pid).filter(c => c.k && !c.fd && descOk(c.k, m[1].replace(/s$/, ''))).reduce((a, c) => a + (c.n || 1), 0);
    if (n) await loseLife(t.pid, n, name); commit(); return true;
  }
  // ---- phasing out a target
  if ((m = l.match(/^target (creature|permanent|nonland permanent|creature you control|permanent you control) phases out$/))){
    const t = T()[0]; if (!t) return true; if (t.pid === MYPID) r23IPhaseOut(single(S.bf.find(b => b.id === t.id))); else { sendRq(t.pid, 'r23Iphase', 0, name, {tid:t.id}); log(`${t.nm} phases out (${name})`); } commit(); return true;
  }
  // ---- tap N target permanents
  if ((m = l.match(/^tap (two|three|four|up to two|up to three) target (permanents|creatures|artifacts|lands)$/))){ T().forEach(t => applyTo(t, {op:'tap', src:name})); commit(); return true; }
  // ---- put (another) target card from your graveyard on top of your library
  if ((m = l.match(/^put (another )?target (card|creature card|instant or sorcery card|artifact card|land card) from your graveyard on top of your library$/))){
    const t = T()[0]; const c = t && S.gy.find(g => g.id === t.id); if (c) r23ITopLib(c); commit(); return true;
  }
  // ---- a target player / opponent creates tokens
  if ((m = l.match(/^(target player|target opponent|each opponent|that attacking player|they) creates? (.+? tokens?(?: with [a-z ]+)?)$/))){
    const what = s.slice(s.length - m[2].length);
    let pids = [];
    if (/^target/.test(m[1])){ const t = T()[0]; if (t) pids = [t.pid]; }
    else if (m[1] === 'each opponent') pids = opponents().map(p => p.pid);
    else { const pid = ctx.it && (ctx.it.evPid || ctx.it.evDp); if (pid) pids = [pid]; }
    for (const pid of pids){ if (UI.dry && pid === 'dry-opp'){ await createFromText('Create ' + what, ctx); continue; } await ctrlCreate({pid}, what, ctx); }
    commit(); return true;
  }
  // ---- Fade from History
  if ((m = l.match(/^each player who controls an? (.+?) creates (.+? tokens?)$/))){
    const what = s.slice(s.length - m[2].length);
    for (const p of players()){ const bf = boardOf(p.pid); if (!bf.some(c => c.k && !c.fd && descOk(c.k, m[1]))) continue; await ctrlCreate({pid:p.pid}, what, ctx); }
    commit(); return true;
  }
  // ---- monarch to a target player
  if (/^target player becomes the monarch$/.test(l)){
    const t = T()[0]; if (!t) return true; if (t.pid === MYPID) becomeMonarch(name); else { sendRq(t.pid, 'r23Imon', 0, name); log(`${nameOf(t.pid)} becomes the monarch (${name})`); } commit(); return true;
  }
  // ---- goad up to N / X target creatures
  if ((m = l.match(/^goad (?:up to (?:x|one|two|three|\d+) |each of )?target creatures?(?: your opponents control| an opponent controls)?$/))){
    T().forEach(t => { if (t.pid === MYPID) return; sendRq(t.pid, 'goad', 0, name, {tid:t.id}); log(`goaded ${t.nm}`); }); commit(); return true;
  }
  // ---- Oblivion Ring (old two-trigger wording): exile until it leaves
  if (/^exile another target nonland permanent$/.test(l) && /when ~ leaves the battlefield, return the exiled card to the battlefield under its owner's control/.test(r23ICardText(ctx))){
    await doSentence('Exile another target nonland permanent until ~ leaves the battlefield', ctx);
    (ctx.r21ids || []).forEach(id => { const c = S.ex.find(x => x.id === id); if (c && c.r21until != null) c.r21keep = 1; }); commit(); return true;
  }
  if (/^return the exiled card to the battlefield under its owner's control$/.test(l) && /exile another target nonland permanent\./.test(r23ICardText(ctx))){ log(`${name}: the exiled card returns`); return true; }
  // ---- shuffle graveyard and hand into library
  if (/^shuffle your (graveyard and hand|hand and graveyard) into your library$/.test(l)){
    const n = S.gy.length + S.hand.length; S.lib.push(...S.gy.splice(0).map(c => (reset(c), c)), ...S.hand.splice(0).map(c => (reset(c), c))); shuffle(S.lib); log(`shuffled their graveyard and hand (${n} cards) into their library`); commit(); return true;
  }
  // ---- "<it|~|that creature> deals damage equal to <count> to <target>"
  if ((m = l.match(/^(it|~|that creature) deals damage equal to (.+?) to (target creature(?: or planeswalker)?(?: an opponent controls)?|any target|target player|each creature your opponents control)$/))){
    let n = null;
    if (/^its power$/.test(m[2])){ const c = ctx.it && ctx.it.evId != null ? S.bf.find(x => x.id === ctx.it.evId) : null; const st = c ? stats(c) : (UI.dry ? [2, 2] : null); n = st ? st[0] : 0; }
    else if (/^2 plus the sacrificed permanent's mana value$/.test(m[2])) n = 2 + (ctx.sacd && ctx.sacd[0] ? (info(ctx.sacd[0].k || ctx.sacd[0])?.mv || 0) : 0);
    else if (/^that card's mana value$/.test(m[2])) n = ctx.lastMV != null ? ctx.lastMV : 0;
    else n = r23ICount(m[2], ctx);
    if (n == null) return false;
    const sc = src(); const from = (m[1] === 'that creature' && ctx.it && ctx.it.evId != null && S.bf.find(x => x.id === ctx.it.evId)) || sc;
    if (/^each creature/.test(m[3])){ for (const p of opponents()) if (n > 0) sendRq(p.pid, 'dmgAll', n, name, {d:'creature', f:srcFlags(ctx.k, MYPID, from)}); log(`${name} deals ${n} damage to each creature your opponents control`); commit(); return true; }
    const t = T()[0]; if (t && n > 0) dealDamage(t, n, (from && from.k) || ctx.k, from); commit(); return true;
  }
  // ---- Glimmervoid
  if (/^if you control no artifacts, sacrifice ~$/.test(l)){ if (!S.bf.some(c => !c.fd && descOk(c.k, 'artifact'))){ const sc = src(); if (sc && S.bf.includes(sc)){ moveCard(sc.id, 'gy'); log(`sacrificed ${name} (no artifacts)`); } } commit(); return true; }
  // ---- target <anything> can't be blocked this turn
  if ((m = l.match(/^(?:up to (?:one|two|three|x) |another )?target ([a-z ]+?) can't be blocked this turn$/)) && !/\b(and|or)\b/.test(m[1]) || (m = null)){
    T().forEach(t => applyTo(t, {op:'pump', src:name, f:{p:0, t:0, kw:['unblockable']}})); commit(); return true;
  }
  if (/^counter target spell/.test(l) && /if that spell's mana value was/.test(full) && ctx.it && ctx.it.tgt){ const x = stackAll().find(i => i.sid === ctx.it.tgt); if (x) ctx.counteredMV = x.mv || 0; return false; }
  // ---- conditional on the mana value of the permanent / spell just handled
  if ((m = l.match(/^if that (?:permanent had mana value|spell's mana value was) (\d+) or less, (.+)$/))){
    const t = /spell's/.test(l) ? null : (ctx.lastT || [])[0]; const k = t && t.k; const mv = k ? info(k)?.mv || 0 : (ctx.counteredMV != null ? ctx.counteredMV : null);
    if (UI.dry || (mv != null && mv <= +m[1])) await doSentence(cap(s.slice(s.length - m[2].length)), ctx); else log(`${name}: mana value too high — nothing more`);
    return true;
  }
  // ---- total power conditions (formidable)
  if ((m = l.match(/^(?:then )?if creatures you control have total power (\d+) or greater, (.+)$/))){
    const ok = r23ITotPow() >= +m[1];
    if (ok || UI.dry){ let rest = s.slice(s.length - m[2].length); rest = rest.replace(/^target attacking creature you control fights/i, 'target creature you control fights'); await doSentence(cap(rest), ctx); }
    else { log(`${name}: creatures you control have total power ${r23ITotPow()} (< ${m[1]})`); if (ctx.tgts) { nextTargets(ctx); if (/fights up to one target/.test(l)) nextTargets(ctx); } }
    return true;
  }
  if ((m = l.match(/^target attacking creature you control fights (up to one )?target creature you don't control$/))) return ds23I(cap(s.replace(/^target attacking creature you control/i, 'target creature you control')), ctx);
  // ---- an ability word / flavor name before the effect ("Fight! — …")
  if ((m = s.match(/^([A-Z][A-Za-z!' ,]{1,30}) — (.+)$/)) && !/^(I|II|III|IV|V|VI)\b/.test(m[1])) return ds23I(m[2], ctx);
  // ---- investigate once for each opponent who has more cards in hand than you
  if (/^investigate once for each opponent who has more cards in hand than you$/.test(l)){
    const n = opponents().filter(p => ((OPP.get(p.pid) || {}).hc || 0) > S.hand.length).length;
    for (let i = 0; i < n; i++) await createFromText('Create a Clue token', ctx); log(`${name}: investigated ${n} time${n === 1 ? '' : 's'}`); commit(); return true;
  }
  // ---- High Score
  if (/^draw a card if you control a creature with the greatest power among creatures on the battlefield$/.test(l)){
    const pw = c => Math.max(0, (stats(c) || [0])[0]); let best = -1; boardsAll().forEach(b => b.bf.forEach(c => { if (c.k && !c.fd && isCreatureCard(c)) best = Math.max(best, b.pid === MYPID ? pw(c) : (statsAny({pid:b.pid, id:c.id}) || [0])[0]); }));
    if (S.bf.some(c => !c.fd && isCreatureCard(c) && pw(c) >= best)){ draw(1); log(`drew a card (${name})`); } commit(); return true;
  }
  // ---- exile (up to one) target creature card from an opponent's graveyard
  if ((m = l.match(/^exile (?:up to one )?target (creature|instant or sorcery|artifact|land|enchantment|creature or planeswalker) card from an opponent's graveyard$/)) && !/you may (cast|play)/.test(full)){
    const t = T()[0]; if (t && t.pid !== MYPID){ sendRq(t.pid, 'gytake', 0, name, {d:t.k, ex:1}); ctx.lastT = [t]; ctx.didExile = 1; } commit(); return true;
  }
  if (/^if you do, create a token that's a copy of ~$/.test(l) && /exile up to one target creature card from an opponent's graveyard/.test(full)){
    const sc = src(); if (ctx.didExile || UI.dry){ if (sc){ await createToken(sc.k, 1); log(`${name}: created a token copy of itself`); } } commit(); return true;
  }
  // ---- Savvy Trader: exile a permanent card from your graveyard, you may play it while it stays exiled
  if (/^exile target permanent card from your graveyard$/.test(l)){
    const t = T()[0]; const c = t && S.gy.find(g => g.id === t.id); if (c){ moveCard(c.id, 'ex'); const e = S.ex.find(x => x.id === c.id); if (e && /you may play that card for as long as it remains exiled/.test(full)) e.mayPlay = {t:turnStr(), adv:true, cast:false, src:name, u0:S.untapN}; ctx.lastT = [t]; ctx.lastEx = [c.id]; } commit(); return true;
  }
  if (/^you may play that card for as long as it remains exiled$/.test(l) && /^exile target permanent card from your graveyard/m.test(full)) return true;
  // ---- sacrifice it (the source)
  if (/^sacrifice it$/.test(l)){ const sc = src(); if (sc && S.bf.includes(sc)){ moveCard(sc.id, 'gy'); log(`sacrificed ${name}`); } commit(); return true; }
  // ---- tap all X target opponent controls (+ freeze)
  if ((m = l.match(/^tap all (nonland permanents|creatures|lands|artifacts|permanents) target (?:opponent|player) controls$/))){
    const t = T()[0]; if (!t) return true; const frz = /they don't untap during their controller's next untap step/.test(full); const d = m[1].replace(/s$/, '');
    if (t.pid === MYPID) applyOp({op:'r23Ifrz', n:frz ? 1 : 0, d, src:name}, MYPID); else { sendRq(t.pid, 'r23Ifrz', frz ? 1 : 0, name, {d}); log(`${name}: tapped all ${m[1]} ${nameOf(t.pid)} controls`); }
    ctx.r23Ifrz = 1; commit(); return true;
  }
  if (/^they don't untap during their controller's next untap step$/.test(l) && (ctx.r23Ifrz || UI.dry)) return true;
  // ---- remove target attacking or blocking creature from combat
  if ((m = l.match(/^remove target (attacking or blocking creature|attacking creature|blocking creature|creature) from combat$/))){
    const t = T()[0]; if (t){ if (t.pid === MYPID) applyOp({op:'r23Irfc', tid:t.id, src:name}, MYPID); else { sendRq(t.pid, 'r23Irfc', 0, name, {tid:t.id}); log(`${name}: removed ${t.nm} from combat`); } } commit(); return true;
  }
  // ---- another target Vehicle becomes an artifact creature until end of turn
  if ((m = l.match(/^(?:another )?target vehicle you control becomes an artifact creature until end of turn$/))){
    const t = T()[0]; const c = t && S.bf.find(x => x.id === t.id); const pt = c && r23IPT(c); if (c && pt){ c.anim = 'crew'; c.animPT = pt; log(`${cname(c)} becomes an artifact creature until end of turn`); } commit(); return true;
  }
  // ---- for each opponent, <tap|exile|return|destroy> up to one target X that player controls
  if ((m = l.match(/^for each opponent, (tap|exile|destroy|return) up to one target (.+?) (?:that player|target player) controls( to its owner's hand)?$/))){
    const op = {tap:'tap', exile:'exile', destroy:'destroy', return:'bounce'}[m[1]]; const desc = m[2];
    if (UI.dry) return true;
    for (const p of opponents()){
      const list = (OPP.get(p.pid)?.bf || []).filter(c => c.k && !c.fd && descOk(c.k, desc, {tok:c.tok}) && !kwOf(c, 'hexproof', p.pid) && !kwOf(c, 'shroud', p.pid));
      if (!list.length) continue;
      const v = await askChoice({title:`${name}: ${m[1]} up to one of ${p.nm}'s ${desc}s`, options:[...list.map(c => ({label:info(c.k)?.n || '?', value:String(c.id)})), {label:'None', value:''}]}); if (!v) continue;
      const c = list.find(x => String(x.id) === v); applyTo({t:'card', pid:p.pid, id:c.id, k:c.k}, {op, src:name}); log(`${name}: ${m[1]} ${info(c.k)?.n}`);
    }
    commit(); return true;
  }
  // ---- Titan of Littjara: draw a card for each other creature you control that shares a creature type with it
  if (/^draw a card for each other creature you control that shares a creature type with it$/.test(l)){
    const sc = src(); const n = sc ? S.bf.filter(c => c !== sc && !c.fd && isCreatureCard(c) && (r23IShare(c.k, sc.k) || (sc.chosenType && r23ISubs(c.k).some(x => x === '*' || x.toLowerCase() === String(sc.chosenType).toLowerCase())))).reduce((a, c) => a + (c.n || 1), 0) : 0;
    if (n){ draw(n); log(`drew ${n} (${name})`); } commit(); return true;
  }
  // ---- draw a card and blight N
  if ((m = l.match(/^draw a card and (blight \d+)$/))){ draw(1); log(`drew a card (${name})`); return ds23I(cap(m[1]), ctx); }
  // ---- target player exiles a card from their graveyard (their choice, on their screen)
  if ((m = l.match(/^(target player|each opponent) exiles (a|two|three) cards? from their (graveyard|hand)$/))){
    const n = wn(m[2]) || 1; const zone = m[3] === 'hand' ? 'hand' : 'gy'; let pids = [];
    if (/^target/.test(m[1])){ const t = T()[0]; if (t) pids = [t.pid]; } else pids = opponents().map(p => p.pid);
    for (const pid of pids){ if (pid === MYPID) await r23IPickOwn(`${zone}|ex|card`, n, name); else { sendRq(pid, 'r23Ipick', n, name, {d:`${zone}|ex|card`}); log(`${nameOf(pid)} exiles ${n} card${n === 1 ? '' : 's'} from their ${m[3]} (${name})`); } }
    commit(); return true;
  }
  // ---- return target creature card from your graveyard to the battlefield tapped and attacking
  if (/^return target creature card from your graveyard to the battlefield tapped and attacking$/.test(l)){
    const t = T()[0]; const c = t && S.gy.find(g => g.id === t.id); if (c){ moveCard(c.id, 'bf', {quiet:true}); c.tap = true; const sc = src(); c.atk = (sc && sc.atk) || (defOpts()[0] || {}).key || ''; ctx.lastCardId = c.id; log(`returned ${cname(c)} to the battlefield tapped and attacking`); } commit(); return true;
  }
  // ---- exile the top X cards of your library (X = the spell's/ability's X)
  if (/^exile the top x cards of your library$/.test(l)){
    const x = (ctx.it && (ctx.it.x || ctx.it.evX)) || (srcCardOf(ctx) && srcCardOf(ctx).x) || 0; if (!x){ log(`${name}: X is 0`); return true; }
    const top = S.lib.slice(0, x); top.forEach(c => moveCard(c.id, 'ex', {quiet:true})); ctx.lastEx = top.map(c => c.id); ctx.r21ids = ctx.lastEx.slice(); ctx.r21 = true; log(`exiled the top ${top.length} cards of their library`); commit(); return true;
  }
  // ---- "if you control your commander, …" (lieutenant)
  if ((m = l.match(/^if you control your commander, (.+)$/))){
    const cmd = S.bf.some(c => c.cmd && !c.fd); if (cmd || UI.dry) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); else log(`${name}: you don't control your commander`); return true;
  }
  // ---- Ancient Animus: "Then it fights target creature an opponent controls"
  if (/^it fights target creature an opponent controls$/.test(l)){
    const a = (ctx.lastT || [])[0]; const b = T()[0]; if (!a || !b || a.pid !== MYPID) return true;
    const ca = S.bf.find(x => x.id === a.id); const sa = ca && stats(ca); const sb = statsAny(b); if (!sa || !sb) return true;
    applyTo(b, {op:'dmg', n:sa[0], src:name, f:srcFlags(ca.k, MYPID, ca)}); const cb = boardOf(b.pid).find(x => x.id === b.id); applyOp({op:'dmg', tid:ca.id, n:sb[0], src:name, f:srcFlags(b.k, b.pid, cb)}, MYPID); log(`${cname(ca)} fights ${b.nm}`); commit(); return true;
  }
  // ---- Tinybones
  if ((m = l.match(/^if an opponent discarded a card this turn, (.+)$/))){
    const ok = r23IOppDiscarded();
    if (ok || UI.dry) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); return true;
  }
  if ((m = l.match(/^each opponent with no cards in hand loses (\d+) life$/))){ for (const p of opponents()){ if (((OPP.get(p.pid) || {}).hc || 0) === 0) await loseLife(p.pid, +m[1], name); } commit(); return true; }
  // ---- Goblin Chainwhirler
  if ((m = l.match(/^(?:it|~) deals (\d+) damage to each opponent and each creature and planeswalker they control$/))){
    const n = +m[1]; const sc = src(); const f = srcFlags(ctx.k, MYPID, sc);
    for (const p of opponents()){ dealDamage({t:'player', pid:p.pid}, n, ctx.k, sc); sendRq(p.pid, 'dmgAll', n, name, {d:'creature or planeswalker', f}); }
    log(`${name} deals ${n} damage to each opponent and each creature and planeswalker they control`); commit(); return true;
  }
  // ---- Prismari Charm: 1 damage to each of one or two targets
  if ((m = l.match(/^~ deals (\d+) damage to each of one or two targets$/))){ const sc = src(); T().forEach(t => dealDamage(t, +m[1], ctx.k, sc)); commit(); return true; }
  // ---- God-Eternal Rhonas
  if (/^double the power of each other creature you control until end of turn$/.test(l)){
    const sc = src(); const list = S.bf.filter(c => c !== sc && !c.fd && isCreatureCard(c)); list.forEach(c => { const p = (stats(c) || [0])[0]; if (p > 0) applyOp({op:'pump', tid:c.id, f:{p, t:0}}, MYPID); }); ctx.r23Ilist = list.map(c => c.id); commit(); return true;
  }
  if (/^those creatures gain vigilance until end of turn$/.test(l) && (ctx.r23Ilist || UI.dry)){ (ctx.r23Ilist || []).forEach(id => applyOp({op:'pump', tid:id, f:{p:0, t:0, kw:['vigilance']}}, MYPID)); commit(); return true; }
  // ---- each player may discard their hand and draw N cards (each decides on their own screen)
  if ((m = l.match(/^each player may discard their hand and draw (\w+) cards$/))){
    const n = wn(m[1]) || 0; ctx.r23Iwheeled = [];
    for (const p of players()){
      const yes = await r23IAsk(p.pid, `discard your hand and draw ${n} cards?`, name);
      if (!yes) continue; ctx.r23Iwheeled.push(p.pid);
      if (p.pid === MYPID) applyOp({op:'r23Iwheel', n, src:name}, MYPID); else { sendRq(p.pid, 'r23Iwheel', n, name); log(`${nameOf(p.pid)} discards their hand and draws ${n} (${name})`); }
    }
    commit(); return true;
  }
  if ((m = l.match(/^(?:then )?~ deals (\d+) damage to each opponent who discarded their hand this way$/))){ const sc = src(); (ctx.r23Iwheeled || []).filter(pid => pid !== MYPID).forEach(pid => dealDamage({t:'player', pid}, +m[1], ctx.k, sc)); commit(); return true; }
  // ---- destroy any number of target tapped creatures with different controllers
  if (/^destroy any number of target tapped creatures with different controllers$/.test(l)){ const seen = new Set(); T().forEach(t => { if (seen.has(t.pid)) return; seen.add(t.pid); applyTo(t, {op:'destroy', src:name}); }); commit(); return true; }
  // ---- Planetary Annihilation: each player keeps six lands, sacrifices the rest
  if ((m = l.match(/^each player chooses (\w+) lands they control and sacrifices the rest$/))){
    const n = wn(m[1]) || 6; for (const p of players()){ if (p.pid === MYPID) await r23IPickOwn('bf|keep|land', n, name); else { sendRq(p.pid, 'r23Ipick', n, name, {d:'bf|keep|land'}); } } log(`${name}: each player keeps ${n} lands and sacrifices the rest`); commit(); return true;
  }
  // ---- Fecundity: that creature's controller may draw a card
  if (/^that creature's controller may draw a card$/.test(l)){
    const pid = ctx.it && ctx.it.evPid; if (!pid || pid === MYPID){ if (UI.dry || await askYes(`${name}: draw a card?`, 'Draw', "Don't")){ draw(1); log(`drew a card (${name})`); } } else { sendRq(pid, 'r22mayDraw', 0, name); log(`${nameOf(pid)} may draw a card (${name})`); }
    commit(); return true;
  }
  // ---- Oriq Loremage
  if ((m = l.match(/^if it's an? (instant or sorcery|creature|land|artifact) card, put a \+1\/\+1 counter on ~$/))){
    const id = ctx.lastCardId; const c = (ctx.found && ctx.found[0]) || (id != null && find(id)[2]) || S.gy[S.gy.length - 1];
    const sc = src(); if (sc && (UI.dry || (c && descOk(c.k, m[1])))){ addCounters(sc, 'cp', 1); log(`${name} gets a +1/+1 counter`); } commit(); return true;
  }
  // ---- "amass Orcs N, mill N cards"
  if ((m = l.match(/^(amass \w+ \d+), (mill \w+ cards?)$/))){ await doSentence(cap(m[1]), ctx); await doSentence(cap(m[2]), ctx); return true; }
  // ---- Opera Love Song: one or two target creatures each get +N/+N
  if ((m = l.match(/^(?:one or two|up to two|two) target creatures each get ([+-]\d+)\/([+-]\d+) until end of turn$/))){ r23IPump(T(), {p:+m[1], t:+m[2]}, name); commit(); return true; }
  // ---- Esper Valigarmanda: exile an instant or sorcery card from each graveyard
  if ((m = l.match(/^exile an? (instant or sorcery|creature|artifact|land) card from each graveyard$/))){
    const desc = m[1]; ctx.r23Iexd = [];
    const mine = S.gy.filter(c => descOk(c.k, desc)); if (mine.length){ const ids = mine.length === 1 || UI.dry ? [mine[0].id] : await pickCards({title:`${name}: exile a ${desc} card from your graveyard`, cards:mine, min:1, max:1}); (ids || []).forEach(id => { moveCard(id, 'ex'); ctx.r23Iexd.push(id); }); }
    for (const p of opponents()){ const gy = (OPP.get(p.pid)?.gy || []).filter(k => k && descOk(k, desc)); if (!gy.length) continue; const cards = gy.map((k, i) => ({id:-500 - i, k})); const ids = cards.length === 1 || UI.dry ? [cards[0].id] : await pickCards({title:`${name}: exile a ${desc} card from ${p.nm}'s graveyard`, cards, min:1, max:1}); const c = cards.find(x => x.id === (ids || [])[0]); if (c) sendRq(p.pid, 'gytake', 0, name, {d:c.k, ex:1}); }
    commit(); return true;
  }
  // ---- Soul of Windgrace: put a land card from a graveyard onto the battlefield tapped under your control
  if (/^put a land card from a graveyard onto the battlefield tapped under your control$/.test(l)){
    const cards = S.gy.filter(c => isLand(c.k)).map(c => ({id:c.id, k:c.k, own:MYPID}));
    for (const p of opponents()) (OPP.get(p.pid)?.gy || []).forEach((k, i) => { if (k && isLand(k)) cards.push({id:-700 - cards.length, k, own:p.pid}); });
    if (!cards.length){ log(`${name}: no land card in any graveyard`); return true; }
    const ids = UI.dry ? [cards[0].id] : await pickCards({title:`${name}: put a land card from a graveyard onto the battlefield tapped`, cards, min:1, max:1});
    const c = cards.find(x => x.id === (ids || [])[0]); if (!c) return true;
    if (c.own === MYPID){ moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id); if (b) b.tap = true; log(`put ${cname(b || c)} onto the battlefield tapped`); }
    else { sendRq(c.own, 'gytake', 0, name, {d:c.k, f:{tap:true}}); log(`put ${info(c.k)?.n} from ${nameOf(c.own)}'s graveyard onto the battlefield tapped`); }
    commit(); return true;
  }
  // ---- untap each creature/permanent you control with a counter on it
  if ((m = l.match(/^untap each (creature|permanent) you control with a counter on it$/))){ S.bf.filter(c => !c.fd && (m[1] === 'permanent' || isCreatureCard(c)) && (c.cp || c.cm || c.co || Object.values(c.nc || {}).some(v => v > 0))).forEach(c => { c.tap = false; }); log(`${name}: untapped each ${m[1]} with a counter on it`); commit(); return true; }
  // ---- coin flips
  if ((m = l.match(/^if you win the flip, (.+)$/))){ const won = ctx.coin ? ctx.coin === 'heads' : Math.random() < 0.5; if (won || UI.dry){ if (!UI.dry) log(`${name}: won the flip`); await doSentence(cap(s.slice(s.length - m[1].length)), ctx); } else log(`${name}: lost the flip`); return true; }
  // ---- Ashcoat of the Shadow Swarm
  if ((m = l.match(/^other ([a-z]+) you control get \+x\/\+x until end of turn, where x is the number of ([a-z]+) you control$/))){
    const sc = src(); const n = S.bf.filter(c => !c.fd && descOk(c.k, m[2], {tok:c.tok})).reduce((a, c) => a + (c.n || 1), 0);
    S.bf.filter(c => c !== sc && !c.fd && isCreatureCard(c) && descOk(c.k, m[1], {tok:c.tok})).forEach(c => applyOp({op:'pump', tid:c.id, f:{p:n, t:n}}, MYPID)); commit(); return true;
  }
  if ((m = l.match(/^(?:if you do, )?return up to (one|two|three) ([a-z]+) creature cards from your graveyard to your hand$/))){
    const n = wn(m[1]) || 1; const pool = S.gy.filter(c => descOk(c.k, m[2] + ' creature'));
    if (!pool.length) return true; const ids = pool.length <= n || UI.dry ? pool.slice(0, n).map(c => c.id) : await pickCards({title:`${name}: return up to ${n} ${m[2]} creature cards to your hand`, cards:pool, min:0, max:n});
    (ids || []).forEach(id => moveCard(id, 'hand')); commit(); return true;
  }
  // ---- Ring of Valkas
  if ((m = l.match(/^put a \+1\/\+1 counter on equipped creature if it's (white|blue|black|red|green)$/))){ const sc = src(); const h = sc && sc.att && S.bf.find(x => x.id === sc.att.id); const col = {white:'W', blue:'U', black:'B', red:'R', green:'G'}[m[1]]; if (h && (info(h.k)?.c || '').includes(col)){ addCounters(h, 'cp', 1); log(`${cname(h)} gets a +1/+1 counter (${name})`); } commit(); return true; }
  // ---- Klothys
  if ((m = l.match(/^if it was a land card, add \{(\w)\} or \{(\w)\}$/))){
    const t = (ctx.lastT || [])[0] || ctx.lastExGy; const land = t && t.k && isLand(t.k); ctx.r23Iland = !!land;
    if (land){ const col = UI.dry ? m[1].toUpperCase() : await askChoice({title:`${name}: add which mana?`, options:[{label:`{${m[1].toUpperCase()}}`, value:m[1].toUpperCase()}, {label:`{${m[2].toUpperCase()}}`, value:m[2].toUpperCase()}]}); addMana([col || m[1].toUpperCase()]); log(`added {${col}} (${name})`); }
    ctx.r23IotherOk = !land; commit(); return true;
  }
  if ((m = l.match(/^otherwise, (.+)$/)) && ctx.r23IotherOk != null){ const go = ctx.r23IotherOk; ctx.r23IotherOk = null; if (go || UI.dry) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); return true; }
  // ---- Bounty Board: each of its controller's opponents draws a card and gains 2 life
  if ((m = l.match(/^each of its controller's opponents draws a card and gains (\d+) life$/))){
    const pid = (ctx.it && ctx.it.evPid) || MYPID;
    for (const p of players()){ if (p.pid === pid) continue; if (p.pid === MYPID){ draw(1); gainLife(+m[1], name); log(`drew a card and gained ${m[1]} life (${name})`); } else sendRq(p.pid, 'r23Igift', 1, name, {d:`draw+life|${m[1]}`}); }
    commit(); return true;
  }
  // ---- Prophet of the Scarab
  if (/^draw cards equal to the number of zombies you control or the number of zombie cards in your graveyard, whichever is greater$/.test(l)){
    const a = S.bf.filter(c => !c.fd && descOk(c.k, 'zombie', {tok:c.tok})).reduce((x, c) => x + (c.n || 1), 0); const b = S.gy.filter(c => descOk(c.k, 'zombie')).length; const n = Math.max(a, b);
    if (n){ draw(n); log(`drew ${n} (${name})`); } commit(); return true;
  }
  // ---- Engulf the Shore
  if (/^return to their owners' hands all creatures with toughness less than or equal to the number of islands you control$/.test(l)){
    const n = S.bf.filter(c => !c.fd && descOk(c.k, 'island')).reduce((a, c) => a + (c.n || 1), 0);
    applyOp({op:'r23Ibtough', n, src:name}, MYPID); opponents().forEach(p => sendRq(p.pid, 'r23Ibtough', n, name)); log(`${name}: creatures with toughness ${n} or less return to hand`); commit(); return true;
  }
  // ---- Eshki: if that spell's power is N or greater
  if ((m = l.match(/^if that spell's power is (\d+) or greater, (.+)$/))){
    const k = ctx.it && ctx.it.evk; const pt = k && r23IPT({k}); const pw = pt ? pt[0] : 0;
    if (pw >= +m[1] || UI.dry) await doSentence(cap(s.slice(s.length - m[2].length)), ctx); return true;
  }
  if ((m = l.match(/^~ deals damage equal to ~'s power to each opponent$/))){ const sc = src(); const n = sc ? Math.max(0, (stats(sc) || [0])[0]) : 0; if (n) opponents().forEach(p => dealDamage({t:'player', pid:p.pid}, n, ctx.k, sc)); commit(); return true; }
  // ---- Moria Scavenger
  if ((m = l.match(/^if the discarded card was an? (creature|land|artifact|instant or sorcery) card, (.+)$/))){ const d = (ctx.it && ctx.it.disc) || (ctx.discCards || [])[0]; if (UI.dry || (d && descOk(d.k, m[1]))) await doSentence(cap(s.slice(s.length - m[2].length)), ctx); return true; }
  // ---- Wave of Reckoning
  if (/^each creature deals damage to itself equal to its power$/.test(l)){ applyOp({op:'r23Iself', src:name}, MYPID); opponents().forEach(p => sendRq(p.pid, 'r23Iself', 0, name)); commit(); return true; }
  // ---- Narci: X = that Saga's mana value
  if ((m = l.match(/^each opponent loses x life and you gain x life, where x is that saga's mana value$/))){ const k = ctx.it && ctx.it.evk; const n = (k && info(k)?.mv) || (UI.dry ? 2 : 0); if (n){ for (const p of opponents()) await loseLife(p.pid, n, name); gainLife(n, name); log(`gained ${n} life (${name})`); } commit(); return true; }
  // ---- Ancient Animus: the counter only goes on a legendary creature
  if ((m = l.match(/^put an? (\+1\/\+1|-1\/-1) counter on target creature(?: you control)? if it's (legendary|an? [a-z]+)$/))){ const t = T()[0]; const ok = t && t.k && (m[2] === 'legendary' ? /Legendary/.test(info(t.k)?.t || '') : descOk(t.k, m[2].replace(/^an? /, ''))); if (ok) applyTo(t, {op:'ctr', n:1, src:name, d:m[1] === '+1/+1' ? 'cp' : 'cm'}); else if (t) log(`${name}: ${t.nm} isn't ${m[2]} — no counter`); commit(); return true; }
  // ---- Ancient Animus with "then"
  if (/^then it fights target creature an opponent controls$/.test(l)) return ds23I('It fights target creature an opponent controls', ctx);
  // ---- Planetary Annihilation (split at ", then")
  if ((m = l.match(/^each player chooses (\w+) lands they control$/)) && /sacrifices the rest/.test(full)){ const n = wn(m[1]) || 6; for (const p of players()){ if (p.pid === MYPID) await r23IPickOwn('bf|keep|land', n, name); else sendRq(p.pid, 'r23Ipick', n, name, {d:'bf|keep|land'}); } log(`${name}: each player keeps ${n} lands and sacrifices the rest`); ctx.r23Ikeep = 1; commit(); return true; }
  if (/^sacrifices the rest$/.test(l) && (ctx.r23Ikeep || UI.dry)) return true;
  // ---- Ravenous Tyrannosaurus: damage equal to its power, excess to the controller
  if (/^it deals damage equal to its power to up to one other target creature$/.test(l) && /excess damage is dealt to that creature's controller instead/.test(full)){
    const sc = src(); const t = T()[0]; if (!t || !sc) return true; const p = Math.max(0, (stats(sc) || [0])[0]); const st = statsAny(t); const c = boardOf(t.pid).find(x => x.id === t.id);
    const left = st ? Math.max(0, st[1] - ((c && c.dmg) || 0)) : p; const toC = Math.min(p, left), ex = p - toC;
    if (toC > 0) dealDamage(t, toC, sc.k, sc); if (ex > 0) dealDamage({t:'player', pid:t.pid}, ex, sc.k, sc); ctx.r23Iex = 1; commit(); return true;
  }
  if (/^excess damage is dealt to that creature's controller instead$/.test(l) && (ctx.r23Iex || UI.dry)) return true;
  // ---- Long-Term Plans
  if (/^search your library for a card, then shuffle and put that card third from the top$/.test(l) || (/^search your library for a card$/.test(l) && /put that card third from the top/.test(full))){
    if (!S.lib.length) return true; const ids = UI.dry ? [S.lib[0].id] : await pickCards({title:`${name}: search for a card`, cards:S.lib.slice(), min:0, max:1, noneLabel:'Find nothing'});
    const c = S.lib.find(x => x.id === (ids || [])[0]); if (c) S.lib.splice(S.lib.indexOf(c), 1); shuffle(S.lib); if (c){ S.lib.splice(Math.min(2, S.lib.length), 0, c); log(`${name}: searched, shuffled, and put a card third from the top`); } ctx.r23Ithird = 1; commit(); return true;
  }
  if (/^(?:then )?(?:shuffle and )?put that card third from the top$/.test(l) && (ctx.r23Ithird || UI.dry)) return true;
  if (/^shuffle$/.test(l) && ctx.r23Ithird) return true;
  // ---- Old Rutstein / Cache Grab: what was milled this way
  if ((m = l.match(/^if an? (land|creature|noncreature, nonland|artifact|instant or sorcery) card is milled this way, (.+)$/))){
    const ms = (ctx.milled || []).map(x => x && x.k ? x : {k:x}); const ok = ms.some(c => c.k && descOk(c.k, m[1].replace(', ', ' ')));
    if (ok || UI.dry) await doSentence(cap(s.slice(s.length - m[2].length)), ctx); return true;
  }
  if ((m = l.match(/^(?:you may )?put an? (permanent|creature|land|artifact) card from among the cards milled this way into your hand$/))){
    const ms = (ctx.milled || []).map(x => x && x.id != null ? x : null).filter(c => c && S.gy.includes(c) && (m[1] === 'permanent' ? !/\b(Instant|Sorcery)\b/.test(info(c.k)?.t || '') : descOk(c.k, m[1])));
    if (!ms.length) return true; const ids = UI.dry ? [ms[0].id] : await pickCards({title:`${name}: put a ${m[1]} card into your hand?`, cards:ms, min:0, max:1, noneLabel:"Don't"});
    (ids || []).forEach(id => { moveCard(id, 'hand'); ctx.r23Iret = (ctx.r23Iret || []).concat(find(id)[2]); }); commit(); return true;
  }
  if ((m = l.match(/^if you control an? ([a-z]+) or returned an? ([a-z]+) card to your hand this way, (.+)$/))){
    const ok = S.bf.some(c => !c.fd && descOk(c.k, m[1], {tok:c.tok})) || (ctx.r23Iret || []).some(c => c && descOk(c.k, m[2]));
    if (ok || UI.dry) await doSentence(cap(s.slice(s.length - m[3].length)), ctx); return true;
  }
  // ---- return X / up to X target creature cards from your graveyard to the battlefield
  if ((m = l.match(/^return (?:up to )?x target ([a-z ]+?) cards from your graveyard to the battlefield(?:, where x is .+)?$/))){
    let g; const all = []; while (ctx.tgts && (g = nextTargets(ctx)).length) all.push(...g); if (!ctx.tgts) return true;
    all.forEach(t => { const c = t.pid === MYPID && S.gy.find(x => x.id === t.id); if (c){ moveCard(c.id, 'bf'); log(`returned ${cname(c)} to the battlefield`); } }); commit(); return true;
  }
  // ---- Ancestral Anger
  if ((m = l.match(/^target creature gains ([a-z ]+) and gets \+x\/\+0 until end of turn, where x is 1 plus the number of cards named ~ in your graveyard$/))){
    const x = 1 + S.gy.filter(c => cname(c) === name).length; const kws = r23IKws(m[1]) || []; T().forEach(t => applyTo(t, {op:'pump', src:name, f:{p:x, t:0, kw:kws}})); commit(); return true;
  }
  // ---- return target X card with mana value X or less, where X is ~'s power / with mana value X (paid)
  if ((m = l.match(/^return (another )?target ([a-z ]+?) card with mana value x( or less)? from your graveyard to the battlefield(?:, where x is ~'s power)?( with a finality counter on it)?$/))){
    const sc = src(); let x; if (/where x is ~'s power/.test(l)) x = sc ? Math.max(0, (stats(sc) || [0])[0]) : 0; else x = (ctx.it && (ctx.it.x != null ? ctx.it.x : ctx.it.evX)) || 0;
    const t = T()[0]; const c = t && t.pid === MYPID && S.gy.find(g => g.id === t.id);
    if (c){ const mv = info(c.k)?.mv || 0; if (m[3] ? mv <= x : mv === x){ moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(y => y.id === c.id); if (b && m[4]) b.nc = {...(b.nc || {}), finality:1}; ctx.lastCardId = c.id; log(`returned ${cname(c)} to the battlefield`); } else log(`${name}: ${cname(c)} has mana value ${mv}, not ${m[3] ? x + ' or less' : x}`); }
    commit(); return true;
  }
  // ---- Elegy Acolyte
  if ((m = l.match(/^if a nonland permanent left the battlefield this turn or a spell was warped this turn, (.+)$/))){ const warped = (S.casts || []).some(x => x.t === turnStr() && x.warp); if (r23ILeftNonland() || warped || UI.dry) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); return true; }
  // ---- Fevered Visions
  if ((m = l.match(/^if the player is your opponent and has (\w+) or more cards in hand, ~ deals (\d+) damage to (?:that|target) player$/))){
    const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; const pid = (t && t.pid) || (ctx.it && ctx.it.evPid); if (!pid || pid === MYPID || pid === 'dry-opp') return true;
    if (((OPP.get(pid) || {}).hc || 0) >= (wn(m[1]) || 4)) dealDamage({t:'player', pid}, +m[2], ctx.k, src()); commit(); return true;
  }
  // ---- Garnet
  if (/^remove a lore counter from each of any number of sagas you control$/.test(l)){
    const sagas = S.bf.filter(c => !c.fd && /Saga/.test(typeOf(c)) && (c.lore || 0) > 0); ctx.r23Ilore = 0; if (!sagas.length) return true;
    const ids = UI.dry ? [] : await pickCards({title:`${name}: remove a lore counter from which Sagas?`, cards:sagas, min:0, max:sagas.length, noneLabel:'None'});
    (ids || []).forEach(id => { const c = S.bf.find(x => x.id === id); if (c && c.lore > 0){ c.lore--; ctx.r23Ilore++; } }); commit(); return true;
  }
  if (/^put a \+1\/\+1 counter on ~ for each lore counter removed this way$/.test(l)){ const sc = src(); const n = ctx.r23Ilore || 0; if (sc && n){ addCounters(sc, 'cp', n); log(`${name} gets ${n} +1/+1 counter${n === 1 ? '' : 's'}`); } commit(); return true; }
  // ---- Prishe's Wanderings (reflexive)
  if (/^when you search your library this way, put a \+1\/\+1 counter on target creature you control$/.test(l)){ const t = T()[0]; if (t) applyTo(t, {op:'ctr', n:1, src:name, d:'cp'}); commit(); return true; }
  // ---- Rundvelt Hordemaster
  if ((m = l.match(/^if it's an? ([a-z]+ creature) card, you may cast that card until the end of your next turn$/))){
    const c = ctx.lastExC || (ctx.lastEx && find(ctx.lastEx[0])[2]); if (c && descOk(c.k, m[1]) && S.ex.includes(c)){ c.mayPlay = {t:turnStr(), next:true, cast:true, src:name, u0:S.untapN}; log(`${name}: may cast ${cname(c)} until the end of their next turn`); } commit(); return true;
  }
  // ---- Vizkopa Guildmage
  if (/^whenever you gain life this turn, each opponent loses that much life$/.test(l)){ if (!S.r23Iviz || S.r23Iviz.t !== turnStr()) S.r23Iviz = {t:turnStr(), n:0}; S.r23Iviz.n++; log(`${name}: this turn, whenever you gain life, each opponent loses that much life`); commit(); return true; }
  // ---- Sylvan Offering: you and that player each create …
  if ((m = l.match(/^you and (that player|target player|target opponent) each create (.+)$/))){
    const what = s.slice(s.length - m[2].length).replace(/^(an )x\/x/i, (a, b) => `a ${(ctx.it && ctx.it.x) || 0}/${(ctx.it && ctx.it.x) || 0}`).replace(/^x (\d)/i, (a, b) => `${(ctx.it && ctx.it.x) || 0} ${b}`);
    let t = (ctx.tgts ? nextTargets(ctx) : [])[0]; let pid = t && t.pid; if (!pid) pid = ctx.r23Iopp || (opponents().length === 1 ? opponents()[0].pid : (UI.dry ? null : await choosePlayer(`${name}: choose an opponent`, true)));
    await createFromText('Create ' + what, ctx); if (pid && pid !== MYPID) await ctrlCreate({pid}, what, ctx); commit(); return true;
  }
  if (/^choose an opponent$/.test(l) && /you and that player each create/.test(full)){ ctx.r23Iopp = opponents().length === 1 ? opponents()[0].pid : (UI.dry ? null : await choosePlayer(`${name}: choose an opponent`, true)); return true; }
  // ---- Star Athlete
  if (/^choose up to one target nonland permanent$/.test(l) && /its controller may sacrifice it/.test(full)){ ctx.r23Isa = T()[0] || null; return true; }
  if (/^its controller may sacrifice it$/.test(l) && ctx.r23Isa !== undefined){
    const t = ctx.r23Isa; if (!t){ ctx.r23IsaDid = true; return true; }
    const yes = await r23IAsk(t.pid, `sacrifice ${t.nm}? (If you don't, ${name} deals 5 damage to you.)`, name); ctx.r23IsaDid = yes;
    if (yes){ if (t.pid === MYPID) applyOp({op:'r23Isac1', tid:t.id, src:name}, MYPID); else sendRq(t.pid, 'r23Isac1', 0, name, {tid:t.id}); } commit(); return true;
  }
  if ((m = l.match(/^if they don't, ~ deals (\d+) damage to (?:that|target) player$/)) && ctx.r23Isa !== undefined){ if (ctx.tgts) nextTargets(ctx); const t = ctx.r23Isa; if (t && !ctx.r23IsaDid) dealDamage({t:'player', pid:t.pid}, +m[1], ctx.k, src()); commit(); return true; }
  // ---- Doors of Durin
  if (/^if a creature card is revealed this way, put it onto the battlefield tapped and attacking$/.test(l)){
    const c = ctx.lastRev || S.lib[0]; if (c && isCreatureCard(c) && S.lib.includes(c) && !UI.dry){ moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id); if (b){ b.tap = true; b.atk = (defOpts()[0] || {}).key || ''; ctx.lastCardId = b.id; ctx.lastT = [{t:'card', pid:MYPID, id:b.id, k:b.k, nm:cname(b)}]; log(`put ${cname(b)} onto the battlefield tapped and attacking`); } } commit(); return true;
  }
  // ---- "If you do, look at the top N" (Trail of Crumbs)
  if ((m = l.match(/^if you do, (look at the top .+)$/))){ if (ctx.didPay === false || ctx.mayYes === false){ ctx.r23Iskip = true; return true; } return ds23I(cap(s.slice(s.length - m[1].length)), ctx); }
  if (ctx.r23Iskip && /^(you may reveal|reveal|put (it|that card) into your hand|put the rest)/.test(l)) return true;
  // ---- Klothys "otherwise" branch
  if ((m = l.match(/^you gain (\d+) life and ~ deals (\d+) damage to each opponent$/))){ gainLife(+m[1], name); log(`gained ${m[1]} life (${name})`); const sc = src(); opponents().forEach(p => dealDamage({t:'player', pid:p.pid}, +m[2], ctx.k, sc)); commit(); return true; }
  // ---- Minthara
  if ((m = l.match(/^if a permanent you controlled left the battlefield this turn, (.+)$/))){ if (S.r23IleftMine === turnStr() || UI.dry) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); return true; }
  // ---- Nicol Bolas, God-Pharaoh
  if (/^exile each nonland permanent your opponents control$/.test(l)){ opponents().forEach(p => sendRq(p.pid, 'wipeEx', 0, name, {d:'nonland permanent'})); log(`${name}: exiled each nonland permanent opponents control`); commit(); return true; }
  // ---- devotion to two colors
  if ((m = l.match(/^if your devotion to (white|blue|black|red|green) and (white|blue|black|red|green) is (\w+) or greater, (.+)$/))){ const d = devotion([m[1], m[2]]); if (d >= (wn(m[3]) || +m[3]) || UI.dry) await doSentence(cap(s.slice(s.length - m[4].length)), ctx); else log(`${name}: devotion to ${m[1]} and ${m[2]} is ${d}`); return true; }
  // ---- Anvil of Bogardan: "… that player draws an additional card, then discards a card"
  if (/^discards a card$/.test(l) && /that player draws an additional card, then discards a card/.test(full)){ const pid = ctx.it && ctx.it.evPid; if (!pid || pid === MYPID) addChoicePrompt('discard', '', 1, MYPID, name); else sendRq(pid, 'discard', 1, name); commit(); return true; }
  // ---- Reunion of the House
  if (/^return any number of target creature cards with total power 10 or less from your graveyard to the battlefield$/.test(l)){
    let tot = 0; T().forEach(t => { const c = t.pid === MYPID && S.gy.find(x => x.id === t.id); if (!c) return; const p = (r23IPT(c) || [0])[0]; if (tot + p > 10){ log(`${name}: ${cname(c)} would go over total power 10`); return; } tot += p; moveCard(c.id, 'bf'); }); commit(); return true;
  }
  // ---- Samwise / Brought Back: permanent cards put into the graveyard from the battlefield this turn
  if ((m = l.match(/^choose up to (one|two) target permanent cards? in your graveyard that (?:was|were) put there from the battlefield this turn$/))){
    const ok = new Set((S.r23Ibfgy || []).filter(x => x.t === turnStr()).map(x => x.id)); const all = T(); const ts = all.filter(t => ok.has(t.id) || UI.dry); ctx.r23Ich = ts; if (ts.length < all.length) log(`${name}: only cards that went to the graveyard from the battlefield this turn count`); return true;
  }
  if ((m = l.match(/^return (it|them) to (your hand|the battlefield tapped)$/)) && ctx.r23Ich){ ctx.r23Ich.forEach(t => { const c = S.gy.find(x => x.id === t.id); if (c){ moveCard(c.id, /hand/.test(m[2]) ? 'hand' : 'bf'); if (!/hand/.test(m[2])){ const b = S.bf.find(x => x.id === c.id); if (b) b.tap = true; } } }); commit(); return true; }
  // ---- Observed Stasis
  if (/^remove enchanted creature from combat$/.test(l)){ const sc = src(); const h = sc && sc.att; if (h){ if (h.pid === MYPID || !h.pid) applyOp({op:'r23Irfc', tid:h.id, src:name}, MYPID); else sendRq(h.pid, 'r23Irfc', 0, name, {tid:h.id}); } commit(); return true; }
  if (/^draw a card for each tapped creature its controller controls$/.test(l)){ const sc = src(); const h = sc && sc.att; const pid = h ? (h.pid || MYPID) : null; const n = pid ? boardOf(pid).filter(c => c.k && c.tp !== undefined ? c.tp : c.tap).filter(c => c.k && isCreatureCard(c)).reduce((a, c) => a + (c.n || 1), 0) : 0; if (n){ draw(n); log(`drew ${n} (${name})`); } commit(); return true; }
  // ---- Life of the Party
  if (/^if it's not a token, each opponent creates a token that's a copy of it$/.test(l)){ const sc = src(); if (!sc || sc.tok){ return true; } opponents().forEach(p => sendRq(p.pid, 'r23Icopy', /goaded/.test(full) ? 1 : 0, name, {d:sc.k})); log(`${name}: each opponent creates a token copy of it`); ctx.r23Igoad = 1; commit(); return true; }
  if (/^the tokens are goaded for the rest of the game$/.test(l) && (ctx.r23Igoad || UI.dry)) return true;
  // ---- Battle Cry Goblin
  if ((m = l.match(/^if you attacked with creatures with total power (\d+) or greater this combat, (.+)$/))){ const tot = S.bf.filter(c => c.atk && !c.fd).reduce((a, c) => a + Math.max(0, (stats(c) || [0])[0]) * (c.n || 1), 0); if (tot >= +m[1] || UI.dry) await doSentence(cap(s.slice(s.length - m[2].length)), ctx); else log(`${name}: attacking power ${tot} (< ${m[1]})`); return true; }
  // ---- Kaya, Geist Hunter −6
  if (/^exile all cards from all graveyards$/.test(l)){ let n = S.gy.length; S.gy.slice().forEach(c => moveCard(c.id, 'ex', {quiet:true})); opponents().forEach(p => { n += ((OPP.get(p.pid) || {}).gy || []).length; sendRq(p.pid, 'r23Iexgy', 0, name); }); ctx.r23In = n; log(`${name}: exiled all graveyards (${n} cards)`); commit(); return true; }
  if ((m = l.match(/^create a (.+? token(?: with [a-z]+)?) for each card exiled this way$/)) && ctx.r23In != null){ const n = ctx.r23In; const what = s.slice(7, 7 + m[1].length); for (let i = 0; i < n; i++) await createFromText('Create a ' + what.replace(/^a /i, ''), ctx); commit(); return true; }
  // ---- Summon: Valefor / Sothera: each opponent chooses one of their creatures
  if ((m = l.match(/^each opponent chooses a creature with the greatest mana value among creatures they control$/))){ ctx.r23Ival = 1; return true; }
  if (/^return those creatures to their owners' hands$/.test(l) && (ctx.r23Ival || UI.dry)){ opponents().forEach(p => sendRq(p.pid, 'r23Ipick', 1, name, {d:'bf|bnc|greatestmv'})); log(`${name}: each opponent returns their creature with the greatest mana value`); commit(); return true; }
  if (/^each opponent chooses a creature they control and exiles it$/.test(l)){ opponents().forEach(p => sendRq(p.pid, 'r23Ipick', 1, name, {d:'bf|exb|creature'})); log(`${name}: each opponent exiles a creature of their choice`); commit(); return true; }
  // ---- Shadowgrange Archfiend
  if (/^each opponent sacrifices a creature with the greatest power among creatures they control$/.test(l)){ ctx.r23Imaxp = Math.max(0, ...opponents().map(p => Math.max(0, ...((OPP.get(p.pid) || {}).bf || []).filter(c => c.k && isCreatureCard(c)).map(c => (statsAny({pid:p.pid, id:c.id}) || [0])[0])))); return false; }
  if (/^you gain life equal to the greatest power among creatures sacrificed this way$/.test(l)){ const n = ctx.r23Imaxp || 0; if (n){ gainLife(n, name); log(`gained ${n} life (${name})`); } commit(); return true; }
  // ---- Yorion / Nahiri's Resolve: exile any number now, return later
  if ((m = l.match(/^exile any number of (other nonland permanents you own and control|nontoken artifacts and\/or creatures you control)$/))){
    const sc = src(); const pool = S.bf.filter(c => !c.fd && c !== sc && !c.own && (/^other/.test(m[1]) ? !isLand(c.k) : (!c.tok && (isCreatureCard(c) || /Artifact/.test(typeOf(c))))));
    const ids = UI.dry || !pool.length ? [] : await pickCards({title:`${name}: exile any number`, cards:pool, min:0, max:pool.length, noneLabel:'None'});
    const ex = []; (ids || []).forEach(id => { const c = S.bf.find(x => x.id === id); if (!c) return; if (c.tok){ moveCard(c.id, 'gy', {quiet:true}); return; } moveCard(c.id, 'ex', {quiet:true}); ex.push(c.id); });
    ctx.r23Ifl = ex; log(`${name}: exiled ${ex.length} permanent${ex.length === 1 ? '' : 's'}`); commit(); return true;
  }
  if ((m = l.match(/^return (?:those cards|them) to the battlefield(?: under their owner's control)? at the beginning of (the next end step|your next upkeep)$/)) && (ctx.r23Ifl || UI.dry)){ if (ctx.r23Ifl && ctx.r23Ifl.length) (S.r23Ifl ||= []).push({ids:ctx.r23Ifl, when:/upkeep/.test(m[1]) ? 'upkeep' : 'end', t:turnStr(), src:name}); commit(); return true; }
  // ---- Gyome: tokens equal to nontoken creatures that entered under your control this turn
  if ((m = l.match(/^create a number of (.+? tokens?) equal to the number of nontoken creatures you had enter the battlefield under your control this turn$/))){
    const seen = new Set(); const n = (S.r23Ient || []).filter(e => e.t === turnStr() && !e.tok && isCreatureCard({k:e.k}) && !seen.has(e.id) && seen.add(e.id)).length;
    const what = s.slice(s.length - l.length + 'create a number of '.length, s.length - l.length + 'create a number of '.length + m[1].length);
    for (let i = 0; i < n; i++) await createFromText('Create a ' + what.replace(/s$/, ''), ctx); log(`${name}: ${n} nontoken creature${n === 1 ? '' : 's'} entered this turn`); commit(); return true;
  }
  // ---- Hoard Hauler: a Treasure for each artifact they control
  if ((m = l.match(/^create (a treasure token|a clue token|a food token) for each artifact they control$/))){
    const pid = ctx.it && (ctx.it.evDp || ctx.it.evPid); const n = pid && pid !== MYPID && pid !== 'dry-opp' ? ((OPP.get(pid) || {}).bf || []).filter(c => c.k && descOk(c.k, 'artifact', {tok:c.tok})).reduce((a, c) => a + (c.n || 1), 0) : 0;
    const what = s.slice(7, 7 + m[1].length); for (let i = 0; i < n; i++) await createFromText('Create ' + what, ctx); log(`${name}: ${n} artifact${n === 1 ? '' : 's'}`); commit(); return true;
  }
  // ---- Cream of the Crop
  if (/^you may look at the top x cards of your library, where x is that creature's power$/.test(l)){
    const c = ctx.it && ctx.it.evId != null ? S.bf.find(x => x.id === ctx.it.evId) : null; const x = c ? Math.max(0, (stats(c) || [0])[0]) : (UI.dry ? 2 : 0);
    if (!x || !S.lib.length){ ctx.r23Icc = null; return true; } if (!UI.dry && !(await askYes(`${name}: look at the top ${x} cards?`, 'Look', "Don't"))){ ctx.r23Icc = null; return true; }
    ctx.r23Icc = S.lib.slice(0, x); return true;
  }
  if (/^if you do, put one of those cards on top of your library and the rest on the bottom of your library in any order$/.test(l)){
    const top = ctx.r23Icc; if (!top || !top.length) return true; const ids = top.length === 1 || UI.dry ? [top[0].id] : await pickCards({title:`${name}: put one card on top`, cards:top, min:1, max:1});
    const keep = top.find(c => c.id === (ids || [])[0]) || top[0]; const rest = top.filter(c => c !== keep); top.forEach(c => S.lib.splice(S.lib.indexOf(c), 1)); S.lib.unshift(keep); S.lib.push(...rest); log(`${name}: kept one on top, ${rest.length} on the bottom`); commit(); return true;
  }
  // ---- Goblin Negotiation: excess damage
  if ((m = l.match(/^~ deals (x|\d+) damage to target creature$/)) && /equal to the amount of excess damage dealt to that creature this way/.test(full)){
    const n = m[1] === 'x' ? ((ctx.it && ctx.it.x) || 0) : +m[1]; const t = (ctx.tgts || [])[ctx.ti || 0] && (ctx.tgts[ctx.ti || 0] || [])[0]; const st = t && statsAny(t); const c = t && boardOf(t.pid).find(x => x.id === t.id);
    ctx.r23Iexcess = st ? Math.max(0, n - Math.max(0, st[1] - ((c && c.dmg) || 0))) : 0; return false;
  }
  if ((m = l.match(/^create a number of (.+? tokens?) equal to the amount of excess damage dealt to that creature this way$/))){ const n = ctx.r23Iexcess || 0; const what = s.slice('create a number of '.length, 'create a number of '.length + m[1].length); for (let i = 0; i < n; i++) await createFromText('Create a ' + what.replace(/tokens$/i, 'token'), ctx); commit(); return true; }
  // ---- Luck Bobblehead
  if (/^roll x six-sided dice, where x is the number of bobbleheads you control$/.test(l)){ const x = S.bf.filter(c => !c.fd && descOk(c.k, 'bobblehead')).reduce((a, c) => a + (c.n || 1), 0) || (UI.dry ? 1 : 0); ctx.r23Irolls = Array.from({length:x}, () => 1 + Math.floor(Math.random() * 6)); log(`🎲 ${name}: rolled ${ctx.r23Irolls.join(', ') || 'nothing'}`); return true; }
  if (/^create a tapped treasure token for each even result$/.test(l) && ctx.r23Irolls){ const n = ctx.r23Irolls.filter(v => v % 2 === 0).length; for (let i = 0; i < n; i++) await createFromText('Create a tapped Treasure token', ctx); commit(); return true; }
  if (/^if you rolled 6 exactly seven times, you win the game$/.test(l) && ctx.r23Irolls){ if (ctx.r23Irolls.filter(v => v === 6).length === 7) return ds23I('You win the game', ctx); return true; }
  // ---- Wild Growth / Wolfwillow Haven: the enchanted land's controller adds an additional mana
  if ((m = l.match(/^its controller adds an additional \{([wubrgc])\}$/))){ const sc = src(); const h = sc && sc.att; if (!h || h.pid === MYPID || !h.pid){ addMana([m[1].toUpperCase()]); log(`added an additional {${m[1].toUpperCase()}} (${name})`); } commit(); return true; }
  // ---- Endless Evil
  if ((m = l.match(/^if that creature was an? ([a-z]+), return ~ to its owner's hand$/))){ const k = ctx.it && ctx.it.evk; const sc = src(); if ((k && descOk(k, m[1])) || UI.dry){ if (sc && find(sc.id)[0] === 'gy'){ moveCard(sc.id, 'hand'); log(`${name} returned to its owner's hand`); } } commit(); return true; }
  // ---- Raven Man
  if ((m = l.match(/^if a player discarded a card this turn, (.+)$/))){ if (r23IAnyDiscarded() || UI.dry) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); else log(`${name}: nobody discarded a card this turn`); return true; }
  // ---- Cartographer's Hawk: return it to its owner's hand
  if (/^return it to its owner's hand$/.test(l) && /^when (?:~|this creature) deals combat damage/m.test(r23ICardText(ctx))){ const sc = src(); if (sc && S.bf.includes(sc)){ moveCard(sc.id, 'hand'); log(`${name} returned to its owner's hand`); ctx.didPay = true; ctx.mayYes = true; } else ctx.didPay = false; commit(); return true; }
  // ---- Liliana Vess ultimate / Rise of the Dark Realms
  if (/^put all creature cards from all graveyards onto the battlefield under your control$/.test(l)){
    const mine = S.gy.filter(c => isCreatureCard(c)); mine.forEach(c => moveCard(c.id, 'bf')); let n = mine.length;
    for (const p of opponents()){ const g = (OPP.get(p.pid)?.gy || []).filter(k => k && isCreatureCard({k})); g.forEach(k => sendRq(p.pid, 'gytake', 0, name, {d:k})); n += g.length; }
    log(`${name}: put ${n} creature cards from all graveyards onto the battlefield`); commit(); return true;
  }
  // ---- Avatar Roku: add six {R}; keep it until end of combat
  if ((m = l.match(/^add (two|three|four|five|six|seven|eight|ten) \{([wubrgc])\}$/))){ const n = wn(m[1]); addMana(Array(n).fill(m[2].toUpperCase())); log(`added ${n} {${m[2].toUpperCase()}} (${name})`); commit(); return true; }
  if (/^until end of combat, you don't lose this mana as steps end$/.test(l)){ S.keepMana = turnStr(); S.r23Ikeep = turnStr(); return true; }
  // ---- Angelic Skirmisher
  if ((m = l.match(/^choose ([a-z ]+), ([a-z ]+), or ([a-z ]+)$/)) && /creatures you control gain that ability until end of turn/.test(full) && [m[1], m[2], m[3]].every(k => R23I.KW.test(k))){
    const opts = [m[1], m[2], m[3]]; const kw = UI.dry ? opts[0] : await askChoice({title:`${name}: creatures you control gain…`, options:opts.map(k => ({label:k, value:k}))}); ctx.r23Ikw = kw || opts[0]; return true;
  }
  if (/^creatures you control gain that ability until end of turn$/.test(l) && ctx.r23Ikw){ S.bf.filter(c => !c.fd && isCreatureCard(c)).forEach(c => applyOp({op:'pump', tid:c.id, f:{p:0, t:0, kw:[ctx.r23Ikw]}}, MYPID)); commit(); return true; }
  // ---- airbend another target creature
  if (/^airbend another target creature$/.test(l)) return ds23I('Airbend up to one other target creature', ctx);
  // ---- V.A.T.S.
  if (/^choose any number of target creatures with equal toughness$/.test(l)){ ctx.r23Ich = T(); return true; }
  if (/^destroy the chosen creatures$/.test(l) && (ctx.r23Ich || UI.dry)){ (ctx.r23Ich || []).forEach(t => applyTo(t, {op:'destroy', src:name})); commit(); return true; }
  // ---- token copies that are 1/1 / artifacts / Nightmares
  if ((m = l.match(/^(?:then if the gift was promised and that creature isn't legendary, )?create a token that's a copy of (enchanted creature|that creature|another target creature or artifact you control|the sacrificed creature)(?:,)? except (?:the token is|it's) (1\/1|an artifact)(?: and it's an? ([a-z]+))?(?: in addition to its other types)?$/))){
    let k = null; const sc = src();
    if (/^then if the gift/.test(l)){ if (!(ctx.gift || (ctx.it && ctx.it.gift)) && !UI.dry) return true; }
    if (m[1] === 'enchanted creature'){ const h = sc && sc.att && S.bf.find(x => x.id === sc.att.id); k = h && h.k; }
    else if (m[1] === 'that creature'){ const id = ctx.lastCardId != null ? ctx.lastCardId : ctx.it && ctx.it.evId; const c = id != null && find(id)[2]; k = (c && c.k) || (ctx.it && ctx.it.evk) || ((ctx.lastT || [])[0] || {}).k; if (/isn't legendary/.test(l) && k && /Legendary/.test(info(k)?.t || '')) return true; }
    else if (m[1] === 'the sacrificed creature'){ const sd = (ctx.sacd || [])[0]; k = sd && (sd.k || sd); }
    else { const t = T()[0]; k = t && t.k; }
    if (!k){ if (UI.dry) return true; log(`${name}: nothing to copy`); return true; }
    const o = m[2] === '1/1' ? {pt:[1, 1]} : {types:'Artifact'}; if (m[3]) o.types = cap(m[3]);
    const tk = r23ICopyTok(k, o); if (tk){ ctx.lastCardId = tk.id; ctx.lastTok = [tk.id]; } commit(); return true;
  }
  if ((m = l.match(/^create two tokens that are copies of the sacrificed creature$/))){ const sd = (ctx.sacd || [])[0]; const k = sd && (sd.k || sd); if (k){ r23ICopyTok(k); r23ICopyTok(k); } commit(); return true; }
  if (/^it gains haste$/.test(l) && ctx.lastTok && ctx.lastTok.length){ ctx.lastTok.forEach(id => { const c = S.bf.find(x => x.id === id); if (c) c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; }); return true; }
  if (/^sacrifice it at the beginning of the next end step$/.test(l) && ctx.lastTok && ctx.lastTok.length){ return ds23I('Sacrifice that token at the beginning of the next end step', ctx); }
  // ---- Skemfar Shadowsage: greatest number of creatures you control that share a creature type
  if ((m = l.match(/^(each opponent loses|you gain) x life, where x is the greatest number of creatures you control that have a creature type in common$/))){
    const cnt = {}; let all = 0; S.bf.filter(c => !c.fd && isCreatureCard(c)).forEach(c => { const ts = r23ISubs(c.k); const n = c.n || 1; if (ts.includes('*')) all += n; else new Set(ts).forEach(t => { cnt[t] = (cnt[t] || 0) + n; }); });
    const x = Math.max(0, ...Object.values(cnt)) + all;
    if (x){ if (/^each opponent/.test(m[1])){ for (const p of opponents()) await loseLife(p.pid, x, name); } else { gainLife(x, name); log(`gained ${x} life (${name})`); } } commit(); return true;
  }
  // ---- Éowyn: if another Human entered under your control this turn
  if ((m = l.match(/^if another ([a-z]+) entered the battlefield under your control this turn, (.+)$/))){
    const sc = src(); const ok = (S.r23Ient || []).some(e => e.t === turnStr() && (!sc || e.id !== sc.id) && descOk(e.k, m[1]));
    if (ok || UI.dry) await doSentence(cap(s.slice(s.length - m[2].length)), ctx); else log(`${name}: no other ${m[1]} entered this turn`); return true;
  }
  // ---- Deadly Brew
  if (/^if you sacrificed a permanent this way, you may return another permanent card from your graveyard to your hand$/.test(l)){
    const sd = ctx.r23Isac; const pool = S.gy.filter(c => !(sd && sd.includes(c.id)) && !/\b(Instant|Sorcery)\b/.test(info(c.k)?.t || ''));
    if (!(sd && sd.length) && !UI.dry){ log(`${name}: you sacrificed nothing`); return true; }
    if (!pool.length || UI.dry) return true; const ids = await pickCards({title:`${name}: return another permanent card to your hand?`, cards:pool, min:0, max:1, noneLabel:"Don't"}); (ids || []).forEach(id => moveCard(id, 'hand')); commit(); return true;
  }
  if (/^each player sacrifices a creature or planeswalker of their choice$/.test(l) && /if you sacrificed a permanent this way/.test(full)){
    const pool = S.bf.filter(c => !c.fd && (isCreatureCard(c) || isPW(c)));
    if (pool.length){ const ids = pool.length === 1 || UI.dry ? [pool[0].id] : await pickCards({title:`${name}: sacrifice a creature or planeswalker`, cards:pool, min:1, max:1}); ctx.r23Isac = []; (ids || []).forEach(id => { const c = S.bf.find(x => x.id === id); if (c){ ctx.r23Isac.push(c.id); sacrificeOne(c); } }); }
    opponents().forEach(p => sendRq(p.pid, 'sac', 1, name, {d:'creature or planeswalker'})); commit(); return true;
  }
  return false;
}
function r23IOppDiscarded(){ return !!(S.r23IoppDisc && S.r23IoppDisc === turnStr()); }
function r23IAnyDiscarded(){ return r23IOppDiscarded() || !!(S.r23Idisc && S.r23Idisc === turnStr()); }
// discards: a card going from my hand to my graveyard is published as an event so others can see "discarded a card this turn"
EV_TYPES.push('r23disc');
{
  const mc = moveCard;
  moveCard = function(id, to, ...a){
    let disc = false; try { disc = !!(S && to === 'gy' && S.hand.some(c => c.id === id)); if (S && to === 'gy' && S.bf.some(c => c.id === id && !c.tok)){ (S.r23Ibfgy ||= []).push({id, t:turnStr()}); if (S.r23Ibfgy.length > 80) S.r23Ibfgy.splice(0, 40); } } catch {}
    const r = mc.call(this, id, to, ...a);
    try { if (disc && !UI.dry && S.r23Idisc !== turnStr()){ S.r23Idisc = turnStr(); emit({type:'r23disc', k:null, id:0}); } } catch {}
    return r;
  };
  const he = handleEvent;
  handleEvent = function(pid, ev){ try { if (S && ev && ev.type === 'r23disc'){ if (pid !== MYPID) S.r23IoppDisc = turnStr(); return; } } catch {} return he(pid, ev); };
}
async function ds23I(s, ctx){ await doSentence(s, ctx); return true; }
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound23IPre(s, l, ctx)) return; return ds(s0, ctx); };
}
