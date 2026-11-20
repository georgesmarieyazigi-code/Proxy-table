/* ===================== Rules engine — round 27 helper F: transform / convert / prepared / day & night =====================
   - transforming (701.27) and converting (701.28) emit a real "xform" event instead of a fake "enter" one (other players no longer see an
     ETB), "transforms into ~" / "enters or transforms into ~" triggers, 701.27c/d (not a TDFC / instant-sorcery face: nothing happens),
     701.27f (an ability of the permanent only transforms it if it hasn't transformed since the ability was put on the stack)
   - "return it to the battlefield [tapped and] transformed under its owner's control [with N time counters]" (Ojers, Edgar …) really
     returns the card from the graveyard with its back face up; Journey to Eternity; Esper Origins (flashback → onto the battlefield
     transformed with a finality counter); delayed "transform ~ at the beginning of the next upkeep" (Aang); "convert it at end of combat"
   - preparation cards (CR 722): the prepared designation, "enters prepared", "becomes prepared"; as it becomes prepared a copy of its
     prepare spell is created in exile that its controller may cast (paying its cost); casting it unprepares the permanent (601.2i);
     the copy ceases to exist when the permanent leaves or is unprepared, and after it resolves
   - day and night (CR 731, 702.145): the game's day/night designation is shared by every client (highest sequence number wins);
     daybound permanents make it day, nightbound ones night; the untap-step check uses the previous turn's active player's spell count;
     daybound/nightbound permanents transform as it changes and enter transformed at night, and can't transform otherwise
   - spells cast last turn (Duskwatch Recruiter / Krallenhorde Howler); becoming the monarch (Starscream); Zenos / Shinryu; Slicer;
     The Myriad Pools; Elesh Norn; Ojer Pakpatiq's rebound; Thing in the Ice / Black Chocobo / Ashling transform triggers */

const F27 = {};
const f27T = () => (typeof turnStr === 'function' ? turnStr() : '');
const f27face = c => { const a = c && info(c.k); return a ? (c.fl && a.back ? a.back : a) : null; };
const f27txt = c => { const f = f27face(c); return f ? String(f.o || '') : ''; };
const f27prepCard = c => { const a = c && info(c.k); return !!(a && a.lay === 'prepare' && a.back); };
// 701.27c/d: only a transforming double-faced permanent can transform; never into an instant/sorcery face; MDFCs and preparation cards can't
function f27canFlip(c){
  const a = c && info(c.k); if (!a || !a.back || c.fd) return false;
  if (a.lay === 'prepare' || a.lay === 'modal_dfc' || a.lay === 'adventure' || a.lay === 'split') return false;
  const to = c.fl ? a : a.back; if (/\b(Instant|Sorcery)\b/.test(to.t || '')) return false;
  return true;
}
const f27day = c => /(^|\n)Daybound\b/.test(String((info(c.k) || {}).o || ''));
const f27night = c => { const b = (info(c.k) || {}).back; return !!(b && /(^|\n)Nightbound\b/.test(String(b.o || ''))); };
function f27src(ctx){ const c = srcCardOf(ctx); return c && S.bf.includes(c) ? c : null; }
// one place that turns a permanent over (used by everything in this file); "why" goes to the log
function f27flip(c, why){
  if (!c || !f27canFlip(c)) return false;
  const was = (f27face(c) || {}).n; c.fl = !c.fl; log(`${was} ${why || 'transformed'} into ${(f27face(c) || {}).n}`);
  emit({type:'xform', k:c.k, id:c.id, tok:c.tok ? 1 : 0}); commit(); return true;
}

/* ---------- the transform event ---------- */
EV_TYPES.push('xform', 'f27mon', 'f27zl', 'f27pl', 'f27pools');
{
  const em = emit;
  emit = function(ev){
    try {
      if (S && ev && ev.type === 'enter' && ev.tf){ ev = {...ev, type:'xform'}; delete ev.tf; }
      if (S && ev && ev.type === 'xform'){ const c = S.bf.find(b => b.id === ev.id); if (c){ c.f27xn = (c.f27xn || 0) + 1; f27asTransforms(c); } }
    } catch (e){ console.warn(e); }
    return em(ev);
  };
}
// "As this creature transforms into Shinryu, choose an opponent."
function f27asTransforms(c){
  if (!c.fl) return; const f = f27face(c); if (!f) return;
  if (/(^|\n)As (?:this creature|~|[^,\n]+) transforms into [^,\n]+, choose an opponent\./i.test(tname(f.o || '', f.n))){
    const ops = opponents(); if (!ops.length || UI.dry) return;
    c.f27opp = ops.length === 1 ? ops[0].pid : null;
    if (c.f27opp){ log(`${f.n}: chose ${nameOf(c.f27opp)}`); return; }
    (async () => { const pid = await choosePlayer(`${f.n}: choose an opponent`, true); if (pid && S.bf.includes(c)){ c.f27opp = pid; log(`${f.n}: chose ${nameOf(pid)}`); commit(); } })();
  }
}
STATIC_KNOWN.push(/^as (?:this creature|~) transforms into ~, choose an opponent$/);
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){
    if (/^~ transforms into ~$/.test(c) || /^this (?:creature|permanent) transforms into ~$/.test(c)) return {ev:'xform', subj:'self', ctl:'you', desc:''};
    if (/^~ enters or transforms into ~$/.test(c)) return {ev:'enter', evs:['enter', 'xform'], subj:'self', ctl:'you', desc:''};
    if (/^~ transforms into ~ and at the beginning of your first main phase$/.test(c)) return {ev:'step', step:'g23main1', whose:'your', evs:['xform'], subj:'self', ctl:'you', desc:''};
    if (/^you become the monarch$/.test(c)) return {ev:'f27mon', subj:'any', ctl:'you', desc:''};
    if (/^the chosen creature leaves the battlefield$/.test(c)) return {ev:'f27zl', subj:'self', ctl:'you', desc:''};
    if (/^the chosen player loses the game$/.test(c)) return {ev:'f27pl', subj:'self', ctl:'you', desc:''};
    if (/^you cast a permanent spell using mana produced by ~$/.test(c)) return {ev:'f27pools', subj:'self', ctl:'you', desc:''};
    return ct(w, c);
  };
  // 701.27f: remember how often the source had transformed when its ability went on the stack
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    const n0 = S ? S.stk.length : 0; const r = pt(src, t, ev, evPid);
    try { if (S && src && src.id != null){ const c = S.bf.find(b => b.id === src.id); if (c) S.stk.slice(n0).forEach(it => { if (it.srcId === c.id) it.f27xn = c.f27xn || 0; }); } } catch {}
    return r;
  };
}

/* ---------- spells cast per turn, turn history (for "last turn" and day/night) ---------- */
function f27track(){
  if (!S) return; let t; try { t = currentTurn(); } catch { return; } if (!t || !(t[0] > 0)) return;
  const ts = f27T(); S.f27th = S.f27th || [];
  const last = S.f27th[S.f27th.length - 1]; if (!last || last[0] !== ts){ S.f27th.push([ts, t[1] || '']); if (S.f27th.length > 6) S.f27th.splice(0, S.f27th.length - 6); }
}
function f27prevTurn(){
  const t = currentTurn(); const ts = `${t[2] || 0}.${t[0] - 1}`;
  const h = (S.f27th || []).find(x => x[0] === ts); let pid = h ? h[1] : null;
  if (!pid){ const ps = players(); const i = ps.findIndex(p => p.pid === t[1]); if (i >= 0 && ps.length) pid = ps[(i - 1 + ps.length) % ps.length].pid; }
  return {ts, pid};
}
function f27castsIn(pid, ts){ if (pid === MYPID) return (S.f27cc || {})[ts] || 0; const st = OPP.get(pid); return st && st.f27cc ? (st.f27cc[ts] || 0) : 0; }
function f27castsLast(){ const {ts} = f27prevTurn(); return players().map(p => ({pid:p.pid, n:f27castsIn(p.pid, ts)})); }
{
  const nc = noteCast;
  noteCast = function(c){ const r = nc(c); try { if (S && !UI.dry){ const ts = f27T(); S.f27cc = S.f27cc || {}; S.f27cc[ts] = (S.f27cc[ts] || 0) + 1; const ks = Object.keys(S.f27cc); if (ks.length > 4) ks.slice(0, ks.length - 4).forEach(k => delete S.f27cc[k]); } } catch {} return r; };
  const ep = enginePublic;
  enginePublic = function(){ const o = ep(); try { if (S){ if (S.f27cc) o.f27cc = S.f27cc; if (S.f27dn) o.f27dn = S.f27dn; } } catch {} return o; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); try {
    if (s && s.f27cc && typeof s.f27cc === 'object'){ o.f27cc = {}; Object.entries(s.f27cc).slice(0, 4).forEach(([k, v]) => { if (Number.isFinite(v)) o.f27cc[String(k).slice(0, 20)] = Math.max(0, Math.min(99, v)); }); }
    if (s && s.f27dn && (s.f27dn.v === 'day' || s.f27dn.v === 'night') && Number.isFinite(s.f27dn.n)) o.f27dn = {v:s.f27dn.v, n:Math.max(0, Math.min(1e6, s.f27dn.n))};
  } catch {} return o; };
}

/* ---------- day and night ---------- */
function f27dn(){ let best = S && S.f27dn ? S.f27dn : null; for (const [, st] of OPP) if (st.f27dn && (!best || st.f27dn.n > best.n)) best = st.f27dn; return best; }
const f27dnNow = () => { const d = f27dn(); return d ? d.v : ''; };
function f27setDN(v, why){
  const d = f27dn(); if (d && d.v === v) return; S.f27dn = {v, n:(d ? d.n : 0) + 1};
  log(`${v === 'night' ? '🌙 it became night' : '☀ it became day'}${why ? ' (' + why + ')' : ''}`); toast(v === 'night' ? 'It became night' : 'It became day'); f27dnApply(); commit();
}
// 702.145c–g: my daybound/nightbound permanents follow the game's designation; a daybound or nightbound permanent starts it
function f27dnApply(){
  if (!S || UI.dry || F27.dnBusy) return; F27.dnBusy = true;
  try {
    const mine = S.bf.filter(c => c.k && !c.fd && (f27day(c) || f27night(c)));
    if (!mine.length) return;
    let v = f27dnNow();
    if (!v){
      if (mine.some(c => !c.fl && f27day(c))) { f27setDN('day', 'a daybound permanent'); return; }
      const anyDay = S.bf.concat(...[...OPP.values()].map(st => st.bf || [])).some(c => c.k && !c.fd && !c.fl && f27day(c));
      if (!anyDay && mine.some(c => c.fl && f27night(c))) { f27setDN('night', 'a nightbound permanent'); return; }
      return;
    }
    for (const c of mine){
      if (v === 'night' && !c.fl && f27day(c)){ F27.dnFlip = true; try { f27flip(c, 'transformed (daybound — it is night)'); } finally { F27.dnFlip = false; } }
      else if (v === 'day' && c.fl && f27night(c)){ F27.dnFlip = true; try { f27flip(c, 'transformed (nightbound — it is day)'); } finally { F27.dnFlip = false; } }
    }
  } finally { F27.dnBusy = false; }
}
// 731.2: as the second part of the untap step the active player's client checks the previous turn
function f27dnCheck(){
  if (!S || UI.dry) return; const ts = f27T(); if (S.f27dnChk === ts) return; S.f27dnChk = ts;
  const v = f27dnNow(); if (!v) return; const {ts:pt, pid} = f27prevTurn(); if (!pid) return; const n = f27castsIn(pid, pt);
  if (v === 'day' && n === 0) f27setDN('night', `${nameOf(pid)} cast no spells last turn`);
  else if (v === 'night' && n >= 2) f27setDN('day', `${nameOf(pid)} cast ${n} spells last turn`);
}
STATIC_KNOWN.push(/^daybound$/, /^nightbound$/, /^daybound \(/, /^nightbound \(/);
{
  const fs = fireSteps;
  fireSteps = function(step, activePid){
    try { if (S && step === 'upkeep'){ f27track(); if (activePid === MYPID) f27dnCheck(); f27dnApply(); } } catch (e){ console.warn(e); }
    return fs(step, activePid);
  };
  const ors = onRemoteState;
  onRemoteState = function(pid, s){ const r = ors(pid, s); try { if (S){ f27track(); f27dnApply(); f27lossWatch(); } } catch (e){ console.warn(e); } return r; };
}

/* ---------- preparation cards (CR 722) ---------- */
function f27prepare(c, why){
  if (!c || !S.bf.includes(c) || !f27prepCard(c) || c.fd) return false;
  if (c.prep){ log(`${cname(c)} is already prepared`); return false; }   // 722.3a: can't gain the designation twice
  const a = info(c.k); const k = a.k + '#b'; if (!deriveFace(k)) return false;
  c.prep = 1;
  const cp = {id:S.nid++, k, prepOf:c.id, mayPlay:{adv:true, cast:true, src:a.n, f27prep:1}};
  S.ex.push(cp); log(`${a.n} became prepared${why ? ' (' + why + ')' : ''} — you may cast ${a.back.n} from exile`); commit(); return true;
}
function f27unprepare(c, why){
  if (!c || !c.prep) return; delete c.prep;
  S.ex = S.ex.filter(x => !(x.prepOf === c.id)); if (why) log(`${cname(c)} is no longer prepared (${why})`);
}
// copies whose permanent is gone or unprepared stop existing (722.3c)
function f27prepSweep(){
  if (!S || !S.ex) return; let ch = false;
  for (let i = S.ex.length - 1; i >= 0; i--){ const x = S.ex[i]; if (x.prepOf == null) continue; const p = S.bf.find(b => b.id === x.prepOf); if (!p || !p.prep){ S.ex.splice(i, 1); ch = true; } }
  return ch;
}
STATIC_KNOWN.push(/^(?:this creature|~) enters prepared$/);
{
  const oe = onEnter;
  onEnter = function(c, from, o = {}){
    try { if (S && c && from !== 'bf' && !c.fd && f27day(c) && !c.fl && f27dnNow() === 'night' && f27canFlip(c)){ c.fl = true; log(`${info(c.k)?.back?.n || cname(c)} entered transformed (it is night)`); } } catch {}
    const r = oe(c, from, o);
    try { if (S && c && from !== 'bf' && !c.fd && S.bf.includes(c)){
      if (f27prepCard(c) && /(^|\n)(?:This creature|~) enters prepared\.?(\n|$)/i.test(tname(info(c.k).o || '', info(c.k).n))) f27prepare(c, 'it entered prepared');
      if (f27day(c) || f27night(c)) setTimeout(() => { try { f27dnApply(); } catch {} }, 0);
    } } catch (e){ console.warn(e); }
    return r;
  };
  const ol = onLeave;
  onLeave = function(c, to, w){ try { if (c && c.prep) f27unprepare(c); if (c) { delete c.f27xn; delete c.f27opp; } } catch {} return ol(c, to, w); };
  const bc = beginCast;
  beginCast = async function(c, zone, o = {}){
    const prepOf = c && c.prepOf; const r = await bc(c, zone, o);
    try { if (prepOf != null && S && !S.ex.includes(c) && S.stk.some(it => it.card === c)){ c.prepCast = 1; const p = S.bf.find(b => b.id === prepOf); if (p && p.prep){ delete p.prep; log(`${cname(p)} is no longer prepared (its prepare spell was cast)`); } commit(); } } catch (e){ console.warn(e); }
    try { if (S && c && !UI.dry) f27poolsAfterCast(c); } catch (e){ console.warn(e); }
    return r;
  };
  const tg = toGrave;
  toGrave = function(c, it){
    if (c && c.prepOf != null){ log(`${cname(c)} (a prepare-spell copy) ceased to exist`); return; }
    if (c && it && it.f27toBf){ faceRestore(c); c.fl = true; c.nc = {}; c.co = 0; c.tap = false; S.bf.push(c); place(c); if (it.f27toBf.fin) addNamed(c, 'finality', 1);
      log(`${cname(c)} was exiled, then put onto the battlefield transformed${it.f27toBf.fin ? ' with a finality counter' : ''}`); onEnter(c, 'ex'); return; }
    return tg(c, it);
  };
  const cm = commit;
  commit = function(...a){ try { if (S){ f27prepSweep(); f27monWatch(); } } catch {} return cm.apply(this, a); };
}

/* ---------- monarch, Shinryu's chosen player, Zenos's chosen creature ---------- */
function f27monWatch(){
  if (UI.dry) return; const me = holderOf('mon') === MYPID;
  if (me && !S.f27monH){ S.f27monH = 1; emit({type:'f27mon', k:null, id:0}); }
  else if (!me && S.f27monH) S.f27monH = 0;
}
function f27oppLost(pid){
  const st = OPP.get(pid); if (!st) return !players().some(p => p.pid === pid);
  return st.life <= 0 || (st.psn || 0) >= 10 || !!st.b27lost || (Array.isArray(st.cdt) && st.cdt.some(x => (x[2] || 0) >= 21));
}
function f27lossWatch(){
  if (!S || UI.dry) return;
  S.bf.forEach(c => { if (c.f27opp && !c.f27plDone && f27oppLost(c.f27opp)){ c.f27plDone = 1; emit({type:'f27pl', k:c.k, id:c.id}); } });
}
{
  const he = handleEvent;
  handleEvent = function(pid, ev){
    try { if (S && ev && ev.type === 'leave' && (S.f27zen || []).length){
      const hit = S.f27zen.filter(z => z.pid === pid && z.id === ev.id);
      if (hit.length){ S.f27zen = S.f27zen.filter(z => !hit.includes(z)); hit.forEach(z => { const c = S.bf.find(b => b.id === z.srcId); if (c) emit({type:'f27zl', k:c.k, id:c.id}); }); }
    } } catch (e){ console.warn(e); }
    try { if (S && ev && ev.type === 'cdmg' && ev.dp && (S.f27sang || []).length){
      const T = f27T(); S.f27sang = S.f27sang.filter(w => w.t === T);
      S.f27sang.filter(w => w.pid === pid && w.id === ev.id).forEach(w => { const c = S.bf.find(b => b.id === w.srcId); if (c) pushTrig(cname(c), '~ becomes prepared.', {k:c.k, srcId:c.id}); });
    } } catch (e){ console.warn(e); }
    return he(pid, ev);
  };
}

/* ---------- The Myriad Pools: which spell used its mana ---------- */
{
  const tg = n24tag;
  n24tag = function(c){ const o = tg(c); try { if (c && /(^|\n)Whenever you cast a permanent spell using mana produced by /i.test(f27txt(c))) o.f27p = c.id; } catch {} return o; };
  const sf = n24spentFrom;
  n24spentFrom = function(before, add){
    const pre = (S.n24prov || []).slice(); const r = sf(before, add);
    try { const now = new Set(S.n24prov || []); const used = pre.filter(e => !now.has(e) && e.f27p != null).map(e => e.f27p); F27.poolsUsed = [...new Set(used)]; } catch {}
    return r;
  };
}
function f27poolsAfterCast(c){
  const used = F27.poolsUsed || []; F27.poolsUsed = []; if (!used.length) return;
  const it = S.stk.find(x => x.kind === 'spell' && x.card === c); if (!it || !isPermType(info(c.k)?.t || '')) return;
  used.forEach(id => { const p = S.bf.find(b => b.id === id); if (p){ S.f27poolSp = S.f27poolSp || {}; S.f27poolSp[p.id] = {k:c.k, t:f27T()}; emit({type:'f27pools', k:p.k, id:p.id}); } });
}

/* ---------- conditions ---------- */
const F27N = {one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10};
const f27n = w => F27N[w] ?? (+w || 0);
function f27cond(l, ctx){
  let m;
  if ((m = l.match(/^(two|three|four|\d+) or more creatures died this turn$/))) return r19Died() >= f27n(m[1]);
  if (/^an opponent controls more creatures than you$/.test(l)){ const me = S.bf.filter(c => !c.fd ? isCreatureCard(c) : true).reduce((a, c) => a + (c.n || 1), 0); return [...OPP.values()].some(st => (st.bf || []).filter(c => c.fd || (c.k && isCreatureCard(c))).reduce((a, c) => a + (c.n || 1), 0) > me); }
  if ((m = l.match(/^you have (seven|\w+|\d+) or more cards in your graveyard$/))) return S.gy.length >= f27n(m[1]);
  if ((m = l.match(/^each player has (\d+) or less life$/))){ const n = +m[1]; return S.life <= n && [...OPP.values()].every(st => (st.life ?? 40) <= n); }
  if (/^no spells were cast last turn$/.test(l)) return f27castsLast().every(x => x.n === 0);
  if ((m = l.match(/^a player cast (two|\d+) or more spells last turn$/))) return f27castsLast().some(x => x.n >= f27n(m[1]));
  if ((m = l.match(/^that creature has (three|\w+|\d+) or more \+1\/\+1 counters on it$/))){ const t = (ctx.lastT || [])[0]; if (!t) return false; const c = boardOf(t.pid).find(b => b.id === t.id); return !!c && (c.cp || 0) >= f27n(m[1]); }
  if ((m = l.match(/^there are (eight|\w+|\d+) or more permanent cards in your graveyard$/))) return S.gy.filter(c => isPermType(info(c.k)?.t || '')).length >= f27n(m[1]);
  if ((m = l.match(/^you control (four|\w+|\d+) or more artifacts$/))) return S.bf.filter(c => !c.fd && /\bArtifact\b/.test(typeOf(c))).reduce((a, c) => a + (c.n || 1), 0) >= f27n(m[1]);
  return null;
}
{ const jc = jCond; jCond = function(cond, ctx){ try { const r = /^you control /.test(String(cond).toLowerCase().trim()) ? null : f27cond(String(cond).toLowerCase().trim(), ctx || {}); if (r != null) return r; } catch (e){ console.warn(e); } return jc(cond, ctx); }; }

/* ---------- effects ---------- */
async function doRound27FPre(s, l, ctx){
  let m; const name = ctx.name;
  // ---- transform / convert ~ (701.27c/d/f, daybound/nightbound) ----
  if ((m = l.match(/^(you may )?(transform|convert) (~|it|him|her)$/))){
    const c = srcCardOf(ctx); if (!c || !S.bf.includes(c)) return false;
    if ((f27day(c) || f27night(c)) && !F27.dnFlip){ log(`${cname(c)} can't transform except by its daybound/nightbound ability`); return true; }
    if (info(c.k)?.back && !f27canFlip(c)){ log(`${cname(c)} can't ${m[2]} (it isn't a transforming double-faced permanent)`); return true; }
    const it = ctx.it; if (it && it.f27xn != null && it.srcId === c.id && (c.f27xn || 0) !== it.f27xn){ log(`${cname(c)} already transformed since this ability triggered — nothing happens`); return true; }
    if (it && it.r21bdly && S.f27dx && S.f27dx[c.id] != null && S.f27dx[c.id] !== (c.f27xn || 0)){ delete S.f27dx[c.id]; log(`${cname(c)} already transformed since the delayed trigger was created — nothing happens`); return true; }
    return false;   // the engine's own transform handler does the flip (and the emit wrapper above turns it into a real transform event)
  }
  if ((m = l.match(/^(?:then )?if ([^,]+), (you may )?(transform|convert) ~$/))){ const ok = f27cond(m[1], ctx); if (ok == null) return false; if (UI.dry) return true;
    if (!ok){ log(`${name}: ${m[1]} — not this time`); return true; } await doSentence(cap((m[2] || '') + m[3] + ' ~'), ctx); return true; }
  if ((m = l.match(/^(?:then )?(transform|convert) ~ if (.+)$/))){ const ok = f27cond(m[2], ctx); if (ok == null) return false; if (UI.dry) return true;
    if (!ok){ log(`${name}: ${m[2]} — not this time`); return true; } await doSentence(cap(m[1] + ' ~'), ctx); return true; }
  // delayed: Aang
  if ((m = l.match(/^(transform|convert) ~ at the beginning of the next upkeep$/))){ if (UI.dry) return true; const c = f27src(ctx); if (!c) return true;
    S.f27dx = S.f27dx || {}; S.f27dx[c.id] = c.f27xn || 0; r21bDelay('upkeep', false, cap(m[1]) + ' ~.', {...ctx, lastT:[], lastTok:[], lastPut:[], r19toks:[], srcId:c.id}); return true; }
  if ((m = l.match(/^(transform|convert) (?:it|~) at end of combat$/))){ if (UI.dry) return true; const c = f27src(ctx); if (!c) return true;
    S.f27dx = S.f27dx || {}; S.f27dx[c.id] = c.f27xn || 0; r21bDelay('eoc', false, cap(m[1]) + ' ~.', {...ctx, lastT:[], lastTok:[], lastPut:[], r19toks:[], srcId:c.id}); return true; }
  // ---- "Exile ~, then return it to the battlefield transformed": a real exile (leaves-the-battlefield, new object) and a real return ----
  if (/^exile ~$/.test(l) && /(?:^|\n|[.,] )(?:then )?return (?:it|him|her) to the battlefield (?:tapped and )?transformed under (?:your|its owner's|his owner's|her owner's) control/i.test(String(ctx.full || '').replace(/~/g, 'it'))){
    if (UI.dry) return false; const c = f27src(ctx); if (!c || c.own || c.tok || !f27canFlip({...c, fl:false})) return false;
    moveCard(c.id, 'ex', {quiet:true, manual:true}); if (find(c.id)[0] === 'ex'){ ctx.f27exRet = c.id; log(`${name}: exiled`); } commit(); return true;
  }
  if ((m = l.match(/^(?:if you do, )?return (?:it|him|her) to the battlefield (tapped and )?transformed under (?:your|its owner's|his owner's|her owner's) control$/)) && ctx.f27exRet != null){
    if (/^if you do/.test(l) && ctx.mayYes === false) return true;
    const id = ctx.f27exRet; delete ctx.f27exRet; const [z, , c] = find(id); if (z !== 'ex' || !c){ log(`${name}: it isn't in exile any more`); return true; }
    c.nc = {}; c.co = 0; c.fl = true; moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === id); if (b){ b.fl = true; if (m[1]) b.tap = true; log(`${name}: returned to the battlefield transformed → ${(f27face(b) || {}).n}`); }
    commit(); return true;
  }
  // ---- return it to the battlefield transformed (dies triggers: Ojers, Edgar) ----
  if ((m = l.match(/^return (?:it|him|her|~) to the battlefield (tapped and )?transformed under (?:its|his|her) owner's control(?: with (a|an|one|two|three|four|five|\d+) (time|\w+) counters? on it)?$/))){
    if (UI.dry) return true; const [z, , c] = ctx.srcId != null ? find(ctx.srcId) : [];
    if (!c || z === 'bf'){ if (c && z === 'bf') return false; log(`${name}: the card isn't there to return`); return true; }
    if (!['gy', 'ex'].includes(z)){ log(`${name}: the card left the graveyard — it can't be returned`); return true; }
    const a = info(c.k); c.nc = {}; c.co = 0; c.fl = !!(a && a.back && f27canFlip({...c, fl:false})); if (m[1]) c.tap = true;
    moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id);
    if (b){ b.fl = c.fl; if (m[1]) b.tap = true; const nn = m[2] ? (f27n(/^an?$/.test(m[2]) ? 'one' : m[2]) || 1) : 0; if (nn) addNamed(b, m[3], nn); log(`${name}: returned to the battlefield${m[1] ? ' tapped' : ''} and transformed${nn ? ` with ${nn} ${m[3]} counter${nn > 1 ? 's' : ''}` : ''} → ${(f27face(b) || {}).n}`); }
    commit(); return true;
  }
  // Journey to Eternity: return this card to the battlefield transformed under your control
  if ((m = l.match(/^return ~ to the battlefield transformed under your control$/))){
    if (UI.dry) return true; const [z, , c] = ctx.srcId != null ? find(ctx.srcId) : [];
    if (!c || !['gy', 'ex'].includes(z)){ log(`${name}: it isn't in the graveyard — it stays where it is`); return true; }
    c.fl = true; c.nc = {}; c.co = 0; moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id); if (b){ b.fl = true; log(`${name}: returned to the battlefield transformed → ${(f27face(b) || {}).n}`); } commit(); return true;
  }
  // Esper Origins
  if (/^put it onto the battlefield transformed under its owner's control with a finality counter on it$/.test(l)){
    if (UI.dry) return true; const it = ctx.it; if (!it || it.kind !== 'spell' || it.copy) return true;
    if (it.from !== 'gy'){ return true; } it.f27toBf = {fin:1}; it.exAfter = false; return true;
  }
  // ---- prepared ----
  if (/^(?:then )?(?:~|this creature) becomes prepared$/.test(l) || (/^if you do, (?:~|this creature) becomes prepared$/.test(l))){
    if (/^if you do/.test(l) && (ctx.mayYes === false || ctx.didPay === false || ctx.f27exFail)){ return true; }
    if (UI.dry) return true; const c = f27src(ctx); if (!c){ log(`${name}: it's no longer on the battlefield`); return true; }
    f27prepare(c, name); return true;
  }
  if (/^target player creates /.test(l) && /becomes prepared/.test(String(ctx.full || ''))){
    const cnt = st => (st.bf || []).filter(c => c.fd || (c.k && isCreatureCard(c))).reduce((a, c) => a + (c.n || 1), 0);
    const snap = {}; for (const [pid, st] of OPP) snap[pid] = cnt(st); await F27.ds(s, ctx);
    const t = (ctx.lastT || [])[0]; if (t && t.pid && t.pid !== MYPID && !UI.dry) await waitUntil(() => OPP.has(t.pid) && cnt(OPP.get(t.pid)) !== snap[t.pid], 4000);
    return true;
  }
  if ((m = l.match(/^(?:then )?if ([^,]+), (?:~|this creature) becomes prepared$/))){ const ok = f27cond(m[1], ctx); if (ok == null) return false; if (UI.dry) return true;
    if (!ok){ log(`${name}: ${m[1]} — not prepared`); return true; } const c = f27src(ctx); if (c) f27prepare(c, name); return true; }
  if ((m = l.match(/^exile (eight|\w+|\d+) cards from your graveyard$/)) && /becomes prepared/.test(String(ctx.full || ''))){
    const n = f27n(m[1]); if (UI.dry) return true;
    if (S.gy.length < n){ ctx.f27exFail = true; ctx.didPay = false; log(`${name}: fewer than ${n} cards in the graveyard — can't exile ${n}`); return true; }
    const ids = S.gy.length === n ? S.gy.map(c => c.id) : await pickCards({title:`${name}: exile ${n} cards from your graveyard`, cards:S.gy.slice(), min:n, max:n});
    if (!ids || ids.length < n){ ctx.f27exFail = true; ctx.didPay = false; return true; }
    ids.forEach(id => moveCard(id, 'ex', {quiet:true})); ctx.didPay = true; log(`${name}: exiled ${n} cards from their graveyard`); commit(); return true;
  }
  // Stensian Sanguinist: the deathtouch creature's combat damage this combat
  if (/^whenever that creature deals combat damage to a player this combat, (?:~|this creature) becomes prepared$/.test(l)){
    if (UI.dry) return true; const t = (ctx.lastT || [])[0]; const c = f27src(ctx); if (!t || !c) return true;
    S.f27sang = (S.f27sang || []).concat({pid:t.pid || MYPID, id:t.id, srcId:c.id, t:f27T()}); log(`${name}: if ${t.nm || 'that creature'} deals combat damage to a player this combat, ${cname(c)} becomes prepared`); commit(); return true;
  }
  // ---- Zenos yae Galvus ----
  if (/^choose a creature an opponent controls$/.test(l) && /the chosen creature/.test(String(ctx.full || ''))){
    if (UI.dry) return true; const cands = []; for (const [pid, st] of OPP) (st.bf || []).forEach(c => { if (c.k && (c.fd || isCreatureCard(c))) cands.push({pid, id:c.id, k:c.k, nm:c.fd ? 'face-down creature' : (info(c.k)?.n || 'a creature')}); });
    if (!cands.length){ log(`${name}: no creature an opponent controls`); ctx.f27ch = null; return true; }
    let pick = cands[0]; if (cands.length > 1){ const v = await askChoice({title:`${name}: choose a creature an opponent controls`, options:cands.map((x, i) => ({label:`${x.nm} (${nameOf(x.pid)})`, value:String(i)}))}); pick = cands[+v] || cands[0]; }
    ctx.f27ch = pick; const sc = f27src(ctx); if (sc) S.f27zen = (S.f27zen || []).concat({srcId:sc.id, pid:pick.pid, id:pick.id});
    log(`${name}: chose ${pick.nm} (${nameOf(pick.pid)})`); commit(); return true;
  }
  if (/^until end of turn, creatures other than ~ and the chosen creature get -2\/-2$/.test(l)){
    if (UI.dry) return true; const sc = srcCardOf(ctx); const ch = ctx.f27ch;
    S.bf.forEach(c => { if (!c.fd && !isCreatureCard(c)) return; if (sc && c.id === sc.id) return; c.pu = [(c.pu || [0, 0])[0] - 2, (c.pu || [0, 0])[1] - 2]; });
    opponents().forEach(p => sendRq(p.pid, 'f27pumpAll', -2, name, {tid:ch && ch.pid === p.pid ? ch.id : -1}));
    log(`${name}: creatures other than ${sc ? cname(sc) : '~'}${ch ? ' and ' + ch.nm : ''} get -2/-2 until end of turn`); commit(); return true;
  }
  // ---- Shinryu: you win the game (104.2a: every other player loses) ----
  if (/^you win the game$/.test(l) && /the chosen player loses the game/.test(String(ctx.full || ''))){
    if (UI.dry) return true; opponents().forEach(p => { if (!f27oppLost(p.pid)) sendRq(p.pid, 'g23lose', 0, name); }); log(`🏆 ${name}: wins the game!`); toast(`${name}: you win the game!`); commit(); return true;
  }
  // ---- Slicer, Hired Muscle ----
  if ((m = l.match(/^have (?:that|target) player gain control of ~ until end of turn$/))){
    if (UI.dry) return true; const c = f27src(ctx); const pid = ctx.it && ctx.it.evPid && ctx.it.evPid !== MYPID ? ctx.it.evPid : null;
    if (!c || !pid){ ctx.mayYes = false; log(`${name}: nobody to give it to`); return true; }
    const ref0 = (S.lent || []).length; giveAway(c, pid, {eot:true, untap:true}); const lent = (S.lent || [])[S.lent.length - 1]; ctx.f27gref = lent && S.lent.length > ref0 ? lent.ref : null; commit(); return true;
  }
  if (/^untap ~, goad it, and it can't be sacrificed this turn$/.test(l)){
    if (UI.dry) return true; if (ctx.mayYes === false) return true;
    const lent = ctx.f27gref && (S.lent || []).find(x => x.ref === ctx.f27gref);
    if (lent){ sendRq(lent.to, 'f27slicer', 0, name, {ref:lent.ref}); log(`${name}: untapped, goaded and it can't be sacrificed this turn`); }
    else { const c = f27src(ctx); if (c){ c.tap = false; c.f27noSac = f27T(); log(`${name}: untapped; it can't be sacrificed this turn`); } }
    commit(); return true;
  }
  // ---- The Myriad Pools ----
  if (/^up to one other target permanent you control becomes a copy of that spell until end of turn$/.test(l)){
    if (UI.dry) return true; const t = nextTargets(ctx)[0]; const sc = srcCardOf(ctx); const rec = sc && S.f27poolSp && S.f27poolSp[sc.id];
    if (!t){ log(`${name}: no target chosen`); return true; } if (!rec){ log(`${name}: that spell is unknown`); return true; }
    const c = S.bf.find(b => b.id === t.id); if (c && c.id !== (sc && sc.id)) cpyBecome(c, rec.k, {eot:true, src:name}); commit(); return true;
  }
  // ---- Elesh Norn ----
  if (/^that source's controller loses 2 life unless they pay \{1\}$/.test(l)){
    if (UI.dry) return true; const pid = ctx.it && ctx.it.evPid; if (!pid || pid === MYPID){ log(`${name}: the source's controller isn't an opponent`); return true; }
    const paid = await askOpponentPay(pid, '{1}', name); if (!paid){ sendRq(pid, 'life', -2, name); log(`${nameOf(pid)} didn't pay {1} — loses 2 life (${name})`); } else log(`${nameOf(pid)} paid {1} (${name})`); commit(); return true;
  }
  if ((m = l.match(/^incubate (\d+) (two|three|four|five|\w+) times$/))){ if (UI.dry) return true; const n = +m[1], k = f27n(m[2]); for (let i = 0; i < k; i++) g23incubate(n, ctx); commit(); return true; }
  if (/^transform all incubator tokens you control$/.test(l)){
    if (UI.dry) return true; const list = S.bf.filter(c => c.tok && !c.fd && /\bIncubator\b/.test(typeOf(c)) && !/\|ph$/.test(c.k));
    for (const c of list) await doSentence('Transform ~', {...ctx, k:c.k, srcId:c.id, name:'Incubator', it:{kind:'ability'}});
    log(`${name}: transformed ${list.length} Incubator token${list.length === 1 ? '' : 's'}`); commit(); return true;
  }
  // ---- Ojer Pakpatiq: the instant spell gains rebound ----
  if (/^it gains rebound$/.test(l)){
    if (UI.dry) return true; const id = ctx.it && ctx.it.evId; const sp = S.stk.find(x => x.kind === 'spell' && x.card && x.card.id === id);
    if (!sp){ log(`${name}: that spell is no longer on the stack`); return true; } if (sp.from !== 'hand'){ log(`${name}: it wasn't cast from a hand — no rebound`); return true; }
    sp.f27reb = 1; log(`${name}: ${sp.nm} gains rebound`); commit(); return true;
  }
  return false;
}
{ const ds = doSentence; F27.ds = ds; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound27FPre(s, l, ctx)) return; return ds(s0, ctx); }; }

// rebound gained from Ojer Pakpatiq: exile as it resolves, offer the free cast at my next upkeep (engine19b's rebound list)
{
  const rt = resolveTop;
  resolveTop = async function(it){
    const reb = it && it.f27reb && it.kind === 'spell' && !it.copy && it.from === 'hand' && it.card; if (reb) it.exAfter = true;
    const r = await rt(it);
    try { if (reb && S.ex.some(e => e.id === it.card.id)){ S.r19reb = (S.r19reb || []).concat({id:it.card.id, t:f27T()}); log(`${it.nm}: rebound — exiled; it can be cast again at your next upkeep`); commit(); } } catch (e){ console.warn(e); }
    return r;
  };
}
// Slicer's "can't be sacrificed this turn"
{ const ns = v25noSac; v25noSac = function(c){ if (c && c.f27noSac && c.f27noSac === f27T()) return true; return ns(c); }; }

RQ_OPS.push('f27pumpAll', 'f27slicer');
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r && r.op === 'f27pumpAll'){ const ex = r.tid; let n = 0; S.bf.forEach(c => { if (c.id === ex || (!c.fd && !isCreatureCard(c))) return; c.pu = [(c.pu || [0, 0])[0] + r.n, (c.pu || [0, 0])[1] + r.n]; n++; }); log(`${n} creature${n === 1 ? '' : 's'} get ${r.n}/${r.n} until end of turn (${r.src})`); commit(); return; }
    if (r && r.op === 'f27slicer'){ const c = S.bf.find(b => b.own && b.own.ref === r.ref); if (c){ c.tap = false; c.goad = {by:from, n:currentTurn()[0]}; c.f27noSac = f27T(); log(`${cname(c)} is untapped and goaded by ${nameOf(from)}; it can't be sacrificed this turn (${r.src})`); commit(); } return; }
    return ao(r, from);
  };
}
// "Descend 8 — At the beginning of your upkeep, …": an ability word with a number is still only a label on a triggered ability
{ const tn = tname; tname = function(txt, name){ let t = String(txt || ''); if (/(^|\n)Descend \d+ — (?:When|Whenever|At)\b/.test(t)) t = t.replace(/(^|\n)Descend \d+ — (?=(?:When|Whenever|At)\b)/g, '$1'); return tn(t, name); }; }
