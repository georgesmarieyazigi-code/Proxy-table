/* ===================== Rules engine — round 24 helper O: characteristic-changing effects (layers 4–7) and granted abilities =====================
   One small layer pass for every permanent on every board:
     layer 4 type (add / set / lose card types and subtypes, "every creature type"), layer 5 color, layer 6 abilities
     (loses all abilities, granted keywords, granted quoted abilities), layer 7b base power/toughness.
   Sources: (a) per-card records c.lx written by effects (published, so every client computes the same result) and
            (b) static abilities of permanents on any board (Dress Down, Song of the Dryads, Maskwood Nexus, Slivers …).
   Consumers: typeOf, isCreatureCard, descOk, kwOf, stats, abilityList, manaAbs, triggers (handleEvent / fireSteps / pushTrigger),
              staticRules (abilities of a permanent that lost its abilities stop working), anthems, grantedKw. */
const L24 = { ts:1, cache:null, busy:0 };
const L24_CARDT = ['Artifact', 'Battle', 'Creature', 'Enchantment', 'Instant', 'Kindred', 'Land', 'Planeswalker', 'Sorcery', 'Tribal'];
const L24_NONCRE = new Set(('equipment food treasure clue vehicle blood gold map powerstone incubator junk fortification attraction contraption bobblehead spacecraft lander ' +
  'aura saga class case curse shrine background role room rune cartouche shard plains island swamp mountain forest desert gate lair locus cave sphere town mine power-plant tower cloud urza\'s').split(' '));
const L24_COLW = {white:'W', blue:'U', black:'B', red:'R', green:'G'};
const l24isCreSub = w => !L24_NONCRE.has(String(w).toLowerCase());
function l24parse(t){ t = String(t || ''); const i = t.indexOf('—'); const a = (i >= 0 ? t.slice(0, i) : t).trim().split(/\s+/).filter(Boolean); const sub = i >= 0 ? t.slice(i + 1).trim().split(/\s+/).filter(Boolean) : [];
  return {sup:a.filter(w => !L24_CARDT.includes(w)), card:a.filter(w => L24_CARDT.includes(w)), sub}; }
function l24fmt(o){ const head = [...o.sup, ...o.card].join(' '); return o.sub.length ? `${head} — ${o.sub.join(' ')}` : head; }
const l24capW = w => String(w).split('-').map(x => x.charAt(0).toUpperCase() + x.slice(1)).join('-');
function l24colors(s){ s = String(s || '').toLowerCase(); if (/\bcolorless\b/.test(s)) return ''; if (/\ball colors\b/.test(s)) return 'WUBRG'; let o = ''; for (const [w, c] of Object.entries(L24_COLW)) if (new RegExp('\\b' + w + '\\b').test(s)) o += c; return o; }
function l24kwList(s){ return String(s || '').split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim().toLowerCase()).filter(Boolean); }

/* ---------- which board a card object is on ---------- */
function l24pidOf(c){
  if (!c || !S) return null;
  if (S.bf.includes(c)) return MYPID;
  for (const [pid, s] of OPP) if ((s.bf || []).includes(c)) return pid;
  return null;
}
/* ---------- per-card records ---------- */
// mod: {ts, s:source name, u:'' | 'e<turnStr>' (end of turn) | 'n<pid>|<turnStr>' (until that player's next turn),
//       setC:[card types] (loses all other card types), addC:[], crSub:[creature types] (becomes a … creature), setSub:[], addS:[], loseCT:1,
//       col:'G' (is green) | '' (colorless) | 'WUBRG', colAdd:'R', noAb:1, pt:[p,t] (base), ab:["quoted ability"], kw:["flying"], allCT:1}
function l24live(m){
  if (!m) return false; const u = m.u || '';
  if (!u) return true;
  if (u[0] === 'e') return u.slice(1) === turnStr();
  if (u[0] === 'n'){ const [pid, t0] = u.slice(1).split('|'); const cur = currentTurn(); return !(cur[1] === pid && turnStr() !== t0); }
  return true;
}
function l24until(text, pid = MYPID){
  const l = String(text || '').toLowerCase();
  if (/until end of turn|this turn/.test(l)) return 'e' + turnStr();
  if (/until your next turn/.test(l)) return 'n' + pid + '|' + turnStr();
  return '';
}
function l24addMod(c, mod){
  if (!c) return; mod = {...mod, ts:Date.now() * 100 + (L24.ts++ % 100)};
  c.lx = (c.lx || []).filter(l24live).concat(mod).slice(-12); l24bust();
}
function l24bust(){ L24.cache = null; }

/* ---------- static sources (any board) ---------- */
const L24_STAT_CACHE = new Map();
function l24statsOf(k, fl){
  const key = k + (fl ? '|b' : ''); if (L24_STAT_CACHE.has(key)) return L24_STAT_CACHE.get(key);
  const a = info(k); const f = a ? (fl && a.back ? a.back : a) : null; const out = [];
  if (f) for (const line of tname(f.o, f.n).split('\n')){ const st = l24parseStatic(line.trim().replace(/\.$/, '')); if (st) (Array.isArray(st) ? st : [st]).forEach(x => out.push(x)); }
  if (a) L24_STAT_CACHE.set(key, out);
  return out;
}
// one static line → [{scope, other, desc, cond, mod}]
function l24parseStatic(line){
  const s = line; const l = s.toLowerCase(); let m;
  const Q = '"([^"]+)"';
  // ---- granted quoted abilities
  if ((m = s.match(new RegExp('^(?:As long as you control your commander, )?(Other |All |Each other |Each )?(.+?) (?:you control |you own )?ha(?:ve|s) ' + Q + '(?: and ' + Q + ')?$', 'i'))) && !/ get [+-]/i.test(m[2])){
    const r = l24scopeOf(m[1], s.slice((m[1] || '').length).replace(/ ha(?:ve|s) ".*$/i, '')); if (!r) return null;
    r.mod = {ab:[m[3], m[4]].filter(Boolean).map(x => x.replace(/\.$/, '') + '.')}; if (/^as long as you control your commander/i.test(s)) r.cond = 'cmdr';
    return r;
  }
  // ---- granted keywords ("Creatures you control have skulk", "All Sliver creatures have poisonous 1", "Clues you control have exalted")
  if ((m = s.match(/^(?:As long as you control your commander, )?(Other |All |Each other |Each )?(.+?) ha(?:ve|s) ((?:[a-z]+(?:walk)?(?: \d+)?)(?:, (?:and )?[a-z]+(?: \d+)?)*(?: and [a-z]+(?: \d+)?)?)$/i))){
    const kws = l24kwList(m[3]); if (!kws.length || !kws.every(k => L24_KWS.test(k))) return null;
    const subj = s.slice((m[1] || '').length).replace(/ ha(?:ve|s) [^"]*$/i, '').replace(/^As long as you control your commander, /i, '');
    const r = l24scopeOf(m[1], subj); if (!r) return null; r.mod = {kw:kws}; if (/^as long as you control your commander/i.test(s)) r.cond = 'cmdr'; return r;
  }
  // ---- loses all abilities
  if (/^creatures lose all abilities$/.test(l)) return {scope:'all', desc:'creature', mod:{noAb:1}};
  if (/^enchanted creature loses all abilities and can't attack or block$/.test(l) || /^enchanted creature loses all abilities$/.test(l)) return {scope:'att', desc:'', mod:{noAb:1}};
  if ((m = l.match(/^enchanted creature loses all abilities and is an? ((?:(?:white|blue|black|red|green|colorless)(?:,? and |, )?)*)\s*([a-z ]+?) (artifact creature|creature) with base power and toughness (\d+)\/(\d+)(?: named ([^.]+?))?( in addition to its other types)?$/))){
    const mod = {noAb:1, pt:[+m[4], +m[5]], crSub:m[2].trim().split(/\s+/).map(l24capW)}; if (m[1].trim()) mod.col = l24colors(m[1]); if (/artifact/.test(m[3])) mod.addC = ['Artifact']; mod.addC = (mod.addC || []).concat('Creature');
    if (m[7]) { mod.addS = mod.crSub; delete mod.crSub; }
    return {scope:'att', desc:'', mod}; }
  if ((m = l.match(/^enchanted (?:creature|permanent) is an? ((?:(?:white|blue|black|red|green|colorless)(?:,? and |, )?)*)\s*([a-z ]+?) with base power and toughness (\d+)\/(\d+) and loses all abilities$/))){
    return {scope:'att', desc:'', mod:{noAb:1, pt:[+m[3], +m[4]], crSub:m[2].replace(/\bcreature\b/, '').trim().split(/\s+/).filter(Boolean).map(l24capW), addC:['Creature'], ...(m[1].trim() ? {col:l24colors(m[1])} : {})}}; }
  if ((m = l.match(/^enchanted permanent is a colorless ([a-z]+) land$/))) return {scope:'att', desc:'', mod:{setC:['Land'], setSub:[l24capW(m[1])], col:'', noAb:1}};
  if (/^enchanted permanent is a colorless land with "\{t\}: add \{c\}" and loses all other card types and abilities$/.test(l)) return {scope:'att', desc:'', mod:{setC:['Land'], setSub:[], col:'', noAb:1, ab:['{T}: Add {C}.']}};
  if ((m = l.match(/^non-([a-z]+) creatures with (\w+) counters on them lose all abilities and have base power and toughness (\d+)\/(\d+)$/))) return {scope:'all', desc:'non' + m[1] + ' creature', cond:'ctr:' + m[2], mod:{noAb:1, pt:[+m[3], +m[4]]}};
  if ((m = l.match(/^creatures your opponents control have base toughness (\d+)$/))) return {scope:'opp', desc:'creature', mod:{bt:+m[1]}};
  // ---- types
  if (/^creatures you control are every creature type(?:\. the same is true for .*)?$/.test(l)) return {scope:'you', desc:'creature', mod:{allCT:1}};
  if (/^all permanents are artifacts in addition to their other types$/.test(l)) return {scope:'all', desc:'permanent', mod:{addC:['Artifact']}};
  if (/^all cards that aren't on the battlefield, spells, and permanents are colorless$/.test(l)) return {scope:'all', desc:'permanent', mod:{col:''}};
  if ((m = l.match(/^nonland permanents you control are artifacts in addition to their other types(?:\. the same is true for .*)?$/))) return {scope:'you', desc:'nonland permanent', mod:{addC:['Artifact']}};
  if ((m = l.match(/^(nontoken creatures|creatures|lands) you control are ([a-z]+) lands in addition to their other types$/))) return {scope:'you', desc:m[1].replace(/s$/, '').replace('creature', 'creature'), mod:{addC:['Land'], addS:[l24capW(m[2])]}};
  if ((m = l.match(/^lands you control and land cards you own that aren't on the battlefield are ([a-z]+)s in addition to their other types$/))) return {scope:'you', desc:'land', mod:{addS:[l24capW(m[1])]}};
  if ((m = l.match(/^(other )?creatures you control have base power and toughness (\d+)\/(\d+) and are ([a-z]+)s in addition to their other creature types$/))) return {scope:'you', other:!!m[1], desc:'creature', mod:{pt:[+m[2], +m[3]], addS:[l24capW(m[4])]}};
  if ((m = l.match(/^equipped creature is an? ([a-z]+) in addition to its other types and has "([^"]+)"$/))) return {scope:'att', desc:'', mod:{addS:[l24capW(m[1])], ab:[s.match(/has "([^"]+)"/i)[1]]}};
  return null;
}
const L24_KWS = /^(skulk|dethrone|melee|myriad|exalted|afflict \d+|poisonous \d+|bloodthirst \d+|(?:plains|island|swamp|mountain|forest)walk|fear|intimidate|flying|haste|trample|vigilance|lifelink|deathtouch|reach|menace|first strike|double strike|hexproof|indestructible|shroud|defender|wither|infect|shadow|horsemanship|flanking|provoke|undying|persist|annihilator \d+|toxic \d+|banding|prowess)$/;
// "Other Zombie creatures", "All Slivers", "Sliver creatures you control", "Commander creatures you own", "Enchanted land", "Equipped creature", "Creatures of the chosen type"
function l24scopeOf(pre, subj){
  let d = String(subj || '').trim().toLowerCase(); const other = /^(other|each other)/i.test(String(pre || '').trim());
  if (/^(enchanted|equipped) (creature|land|permanent|artifact)$/.test(d)) return {scope:'att', desc:'', other:false};
  if (/^(~|it|target|that|this)\b/.test(d)) return null;
  let scope = 'all';
  if (/ you control$/.test(d)){ scope = 'you'; d = d.replace(/ you control$/, ''); }
  else if (/ you own$/.test(d)){ scope = 'you'; d = d.replace(/ you own$/, ''); }
  else if (/ your opponents control$/.test(d)){ scope = 'opp'; d = d.replace(/ your opponents control$/, ''); }
  d = d.replace(/^(all|each) /, '');
  if (/^commander creatures?$/.test(d)) return {scope, other, desc:'creature', cmdOnly:true};
  let cond = '';
  if ((d = d.replace(/ of the chosen type$/, () => { cond = 'ctype'; return ''; })) && false) {}
  if (/(?:^| )with |that |who |which |named /.test(d)) return null;
  return {scope, other, desc:sing(d), cond};
}

/* ---------- the layer pass ---------- */
function l24baseType(c){ return L24.prevTypeOf ? L24.prevTypeOf(c) : (faceOf(c)?.t || ''); }
function l24srcList(){
  // every permanent with a layer static, on every board
  const out = []; if (!S) return out;
  for (const b of boardsAll()) for (const s of b.bf){
    if (!s.k || s.fd) continue; const st = l24statsOf(s.k, s.fl); if (!st.length) continue;
    st.forEach((x, i) => out.push({pid:b.pid, s, st:x, ts:(s.id || 0) * 10 + i}));
  }
  return out;
}
function l24state(){
  if (L24.cache) return L24.cache;
  const C = {src:l24srcList(), eff:new Map(), pidOf:new Map()};
  for (const b of boardsAll()) for (const c of b.bf) C.pidOf.set(c, b.pid);
  L24.cache = C; queueMicrotask(() => { if (L24.cache === C) L24.cache = null; });
  return C;
}
function l24cmdrOn(pid){ return boardOf(pid).some(x => x.cmd && !x.fd); }
function l24applies(src, c, pid, t4){
  const st = src.st;
  if (src.s !== c && l24noAbCard(src.s, src.pid)) return false;
  if (st.scope === 'att'){ const a = src.s.att; if (!a || a.id !== c.id || a.pid !== pid) return false; }
  else {
    if (st.scope === 'you' && src.pid !== pid) return false;
    if (st.scope === 'opp' && src.pid === pid) return false;
    if (st.other && src.pid === pid && src.s.id === c.id) return false;
    if (st.cmdOnly && !c.cmd) return false;
    if (st.desc && !l24descOk(c, st.desc, t4)) return false;
  }
  if (st.cond === 'cmdr' && !l24cmdrOn(src.pid)) return false;
  if (st.cond === 'ctype'){ const ty = src.s.ctype; if (!ty || !new RegExp('\\b' + ty + '\\b', 'i').test(t4) ) return false; }
  if (st.cond && st.cond.startsWith('ctr:')){ const k = st.cond.slice(4); if (!((c.nc || {})[k] > 0)) return false; }
  return true;
}
// descOk on a card whose type line is already known (no recursion into the layer pass)
function l24descOk(c, desc, t){
  const a = info(c.k); if (!a) return false;
  return L24.prevDescOk(c.k, desc, {tok:c.tok, face:{...(faceOf(c) || a), t}});
}
function l24new(mod){ return mod; }
function l24apply(st, mod){
  if (mod.noAb){ st.noAb = true; st.ab = []; st.kw = []; }
  if (mod.setC){ st.ty.card = mod.setC.slice(); st.ty.sub = (mod.setSub || mod.addS || []).slice(); }
  else if (mod.setSub) st.ty.sub = mod.setSub.slice();
  if (mod.addC) mod.addC.forEach(x => { if (!st.ty.card.includes(x)) st.ty.card.push(x); });
  if (mod.loseCT) st.ty.sub = st.ty.sub.filter(w => !l24isCreSub(w));
  if (mod.crSub){ st.ty.sub = st.ty.sub.filter(w => !l24isCreSub(w)); mod.crSub.forEach(w => { if (!st.ty.sub.includes(w)) st.ty.sub.push(w); }); }
  if (mod.addS && !mod.setC) mod.addS.forEach(x => { if (!st.ty.sub.includes(x)) st.ty.sub.push(x); });
  if (mod.allCT) st.allCT = true;
  if (mod.col != null) st.col = mod.col;
  if (mod.colAdd) st.col = [...new Set((st.col || '') + mod.colAdd)].join('');
  if (mod.pt) st.pt = mod.pt.slice();
  if (mod.ab) st.ab = st.ab.concat(mod.ab);
  if (mod.kw) st.kw = st.kw.concat(mod.kw);
  if (mod.nm) st.nm = mod.nm;
  st.n++;
}
// effective characteristics, or null if nothing changes this card
function l24eff(c, pid){
  if (!c || !c.k || c.fd || !S) return null;
  const C = l24state();
  if (C.eff.has(c)) return C.eff.get(c);
  if (pid == null) pid = C.pidOf.get(c); if (pid == null){ C.eff.set(c, null); return null; }
  if (L24.busy > 6) return null;
  C.eff.set(c, null); // provisional: re-entry while computing sees the printed characteristics
  L24.busy++;
  try {
    const own = L24.own(c);
    const base = l24baseType(c); const f = faceOf(c);
    const st = {ty:l24parse(base), col:f ? (f.c != null ? f.c : info(c.k)?.c || '') : '', col0:null, noAb:false, pt:null, ab:[], kw:[], allCT:false, n:0, nm:null, src:[]};
    st.col0 = st.col;
    // layer-4 view for static filters: own records only
    own.forEach(m => l24apply(st, m));
    const t4 = l24fmt(st.ty);
    const hits = C.src.filter(x => l24applies(x, c, pid, t4));
    if (!own.length && !hits.length){ C.eff.set(c, null); return null; }
    // full pass in timestamp order: static abilities (ordered by when their source arrived) then this card's own records
    const st2 = {ty:l24parse(base), col:st.col0, noAb:false, pt:null, ab:[], kw:[], allCT:false, n:0, nm:null, src:[]};
    const all = hits.map(h => ({ts:h.ts, mod:h.st.mod, src:cname(h.s), sid:h.s.id, spid:h.pid})).concat(own.map(m => ({ts:m.ts, mod:m, src:m.s})));
    // records written by effects are newer than statics already on the battlefield
    all.sort((a, b) => (a.mod.ts ? 1 : 0) - (b.mod.ts ? 1 : 0) || a.ts - b.ts);
    // layer order: 4 (types), 5 (colors), 6 (abilities), 7b (base P/T) — apply each layer separately in timestamp order
    for (const x of all){ const m = x.mod; l24apply(st2, {setC:m.setC, setSub:m.setSub, addC:m.addC, loseCT:m.loseCT, crSub:m.crSub, addS:m.addS, allCT:m.allCT}); }
    for (const x of all){ const m = x.mod; if (m.col != null || m.colAdd) l24apply(st2, {col:m.col, colAdd:m.colAdd}); }
    for (const x of all){ const m = x.mod; if (m.noAb || m.ab || m.kw) l24apply(st2, {noAb:m.noAb, ab:m.ab && m.ab.map(t => ({t, src:x.src, sid:x.sid, spid:x.spid})), kw:m.kw}); }
    for (const x of all){ const m = x.mod; if (m.pt) l24apply(st2, {pt:m.pt}); if (m.bt != null){ st2.pt = [(st2.pt || ptOf(faceOf(c)) || [0, 0])[0], m.bt]; } }
    st2.src = [...new Set(all.map(x => x.src))];
    const out = {t:l24fmt(st2.ty), card:st2.ty.card, sub:st2.ty.sub, col:st2.col, colChanged:st2.col !== st.col0, noAb:st2.noAb, pt:st2.pt, ab:st2.ab, kw:st2.kw, allCT:st2.allCT, src:st2.src, base};
    out.tyChanged = out.t !== base;
    C.eff.set(c, out); return out;
  } finally { L24.busy--; }
}
// does this permanent (a static source) currently have no abilities?
function l24noAbCard(c, pid){ const e = l24eff(c, pid); return !!(e && e.noAb); }

/* ---------- consumers ---------- */
{
  // older "extra type" fields written by earlier rounds now go through the layer pass, so every client sees them
  const own0 = c => (c.lx || []).filter(l24live);
  L24.own = c => { const out = own0(c); if (c && c.xty && c.xty.length) out.unshift({addS:c.xty.map(l24capW), s:'', ts:1}); return out; };
}
// typeOf / isCreatureCard
{
  L24.prevTypeOf = typeOf;
  const to0 = typeOf;
  typeOf = c => { if (!c || !c.k || c.fd || !S) return to0(c); const e = l24eff(c); return e && e.tyChanged ? e.t : to0(c); };
  const ic0 = isCreatureCard;
  isCreatureCard = c => { if (!c || !c.k || c.fd || !S) return ic0(c); const e = l24eff(c);
    if (e && e.tyChanged){ if (e.card.includes('Creature')) return true; if (/\bCreature\b/.test(e.base)) return false; }
    return ic0(c); };
}
// descOk: a card with changed characteristics is judged by them (a synthetic face, served through deriveFace)
L24.fake = new Map();
{
  const df = deriveFace;
  deriveFace = function(k){ if (typeof k === 'string' && k.startsWith('L24|')) return L24.fake.get(k) || null; return df(k); };
  L24.prevDescOk = descOk;
  const dk0 = descOk;
  descOk = function(k, desc, o = {}){
    if (!S || !k || typeof k !== 'string' || k.startsWith('L24|')) return dk0(k, desc, o);
    let c = o.card || null;
    if (!c){ const C = l24state(); if (!C.byK){ C.byK = new Map(); for (const [x] of C.pidOf) if (x.k && !x.fd){ const l = C.byK.get(x.k) || []; l.push(x); C.byK.set(x.k, l); } }
      const list = (C.byK.get(k) || []).filter(x => o.tok == null || !!x.tok === !!o.tok);
      if (!list.length) return dk0(k, desc, o);
      const es = list.map(x => l24eff(x)); const sig = es.map(e => e ? l24sig(e) : '');
      if (sig.some(x => x !== sig[0])) return dk0(k, desc, o);   // copies with different characteristics: can't tell which one is meant
      c = list[0]; }
    const e = l24eff(c); if (!e) return dk0(k, desc, o);
    const fk = l24fake(c, e); return dk0(fk, desc, {...o, face:info(fk)});
  };
}
function l24sig(e){ return [e.t, e.col, e.noAb ? 1 : 0, e.allCT ? 1 : 0, e.pt ? e.pt.join('/') : ''].join('|'); }
function l24fake(c, e){
  const f = faceOf(c) || info(c.k); const key = 'L24|' + c.k + '|' + l24sig(e);
  if (!L24.fake.has(key)){ if (L24.fake.size > 400) L24.fake.clear();
    L24.fake.set(key, {...f, k:key, t:e.t, c:e.col, o:(e.noAb ? '' : (f.o || '')) + (e.allCT ? '\nChangeling' : ''), p:e.pt ? `${e.pt[0]}/${e.pt[1]}` : f.p}); }
  return key;
}
// keywords
function l24kwHas(list, kw){ return (list || []).some(x => x === kw || x.startsWith(kw + ' ')); }
{
  const kw0 = kwOf;
  kwOf = function(c, kw, pid){
    if (!c || !c.k || c.fd || !S) return kw0(c, kw, pid);
    const e = l24eff(c);
    if (!e) return kw0(c, kw, pid);
    if (e.noAb) return (c.ekw || []).includes(kw) || l24kwHas(e.kw, kw);
    return kw0(c, kw, pid) || l24kwHas(e.kw, kw);
  };
  const gk0 = grantedKw;
  grantedKw = function(c, kw, bf = S.bf){ try { if (S && Array.isArray(bf) && bf.length) bf = bf.filter(b => !b || b.fd || !l24noAbCard(b)); } catch {} return gk0(c, kw, bf); };
}
// "kw N" totals (afflict 3, bloodthirst 2, annihilator 2): printed + granted by the layer pass
function l24kwN(c, kw){
  if (!c || !c.k || c.fd) return 0; const e = l24eff(c); let n = 0;
  if (!(e && e.noAb)){ const f = faceOf(c); const own = tname(f && f.o || '', f && f.n || ''); for (const line of own.split('\n')){ const t = line.trim(); if (!/^[a-z ,0-9]+$/i.test(t)) continue; const re = new RegExp('(?:^|, )' + kw + ' (\\d+)(?=,|$)', 'gi'); let m; while ((m = re.exec(t))) n += +m[1]; } }
  for (const x of (c.ekw || [])){ const m = String(x).match(new RegExp('^' + kw + ' (\\d+)$', 'i')); if (m) n += +m[1]; }
  if (e) for (const x of e.kw){ const m = String(x).match(new RegExp('^' + kw + ' (\\d+)$', 'i')); if (m) n += +m[1]; }
  return n;
}
function l24kwCount(c, kw){ // instances of a keyword without N (exalted, melee, dethrone, myriad): printed counts once, each grant once more
  if (!c || !c.k || c.fd) return 0; const e = l24eff(c); let n = 0;
  if (!(e && e.noAb) && hasKwText(faceOf(c), kw)) n++;
  if ((c.ekw || []).includes(kw)) n++;
  if (e) n += e.kw.filter(x => x === kw).length;
  if (!n && kwOf(c, kw)) n = 1;
  return n;
}
// base power/toughness (layer 7b) and the anthems of permanents that lost their abilities
{
  const st0 = stats;
  stats = function(c, pid = MYPID){
    if (!c || !c.k || c.fd || !S) return st0(c, pid);
    const e = l24eff(c); if (!e || !e.pt) return st0(c, pid);
    const b = e.pt; const [ap, at] = anthems(c, pid); const [xp, xt] = e.noAb ? [0, 0] : xAnthems(c, pid); const d = (c.cp || 0) - (c.cm || 0); const pu = c.pu || [0, 0]; const ax = attachFx(c, pid);
    const r = [b[0] + d + ap + xp + (pu[0] || 0) + ax.p, b[1] + d + at + xt + (pu[1] || 0) + ax.t];
    return c.sw ? [r[1], r[0]] : r;
  };
  anthems = function(c, ownerPid){
    let dp = 0, dt = 0;
    for (const b of boardsAll()) for (const s of b.bf){
      if (!s.k || s.fd) continue; const a = info(s.k); if (!a) continue; const f = s.fl && a.back ? a.back : a;
      if (l24noAbCard(s, b.pid)) continue;
      for (const sen of tname(f.o, f.n).toLowerCase().split(/\.\s*|\n/)){
        const m = sen.match(/^(other )?(.+?) gets? ([+-]\d+)\/([+-]\d+)(?: and |$)/); if (!m) continue;
        let desc = m[2]; if (/^(~|equipped|enchanted|target|each|it|that|they)\b/.test(desc) || /until end of turn|for each|as long as/.test(sen)) continue;
        let who = 'any';
        if (/ you control$/.test(desc)){ who = 'you'; desc = desc.replace(/ you control$/, ''); }
        else if (/ (your opponents|an opponent) controls?$/.test(desc)){ who = 'opp'; desc = desc.replace(/ (your opponents|an opponent) controls?$/, ''); }
        if (who === 'you' && b.pid !== ownerPid) continue;
        if (who === 'opp' && b.pid === ownerPid) continue;
        if (m[1] && b.pid === ownerPid && s.id === c.id) continue;
        if (!descOk(c.k, desc, {tok:c.tok, face:faceOf(c), card:c})) continue;
        dp += +m[3]; dt += +m[4];
      }
    }
    return [dp, dt];
  };
}
// activated and mana abilities
function l24split(t){ const m = String(t).match(/^([^:"]+):\s*([\s\S]+)$/); return m ? {cost:m[1].trim(), eff:m[2].trim()} : null; }
function l24isCost(cost){ return /\{|^(sacrifice|pay|discard|remove|exile|tap|return)\b/i.test(cost) && !/^[+−\-]?\d+$/.test(cost); }
{
  const al0 = abilityList;
  abilityList = function(c){
    const out = al0(c); if (!c || !S || c.fd) return out; const e = l24eff(c); if (!e) return out;
    let r = e.noAb ? [] : out.slice(); const nm = cname(c);
    for (const g of e.ab){ const p = l24split(tname(g.t, nm)); if (!p || !l24isCost(p.cost) || /^add\b/i.test(p.eff)) continue; const line = g.t;
      if (r.some(a => a.line === line)) continue; const key = 'l24|' + c.id + '|' + line; let ab = L24.abObj && L24.abObj.get(key);
      if (!ab){ ab = {cost:p.cost, eff:p.eff, sorc:/activate only as a sorcery/i.test(p.eff), line, l24:1}; (L24.abObj = L24.abObj || new Map()).set(key, ab); }
      r.push(ab); }
    return r;
  };
  const ma0 = manaAbs;
  manaAbs = function(c){
    const out = ma0(c); if (!c || !S || c.fd) return out; const e = l24eff(c); if (!e) return out;
    let r = e.noAb ? [] : out.slice();
    if (e.tyChanged || e.noAb){ // basic land types give their mana ability (CR 305.6); lost land types take it away
      for (const [bt, col] of Object.entries(BASIC)){ const line = `{T}: Add {${col}}.`; const has = e.sub.includes(bt); const printed = !e.noAb && new RegExp('\\{T\\}: Add \\{' + col + '\\}', 'i').test(textOf(c));
        if (!has && !printed) r = r.filter(o => o.line !== line);
        if (has && !r.some(o => o.tapOnly && o.outs.some(x => x.join('') === col))) r.push({cost:'{T}', eff:`Add {${col}}`, rest:'', outs:[[col]], tapOnly:true, line, l24:1}); } }
    const nm = cname(c);
    for (const g of e.ab){ const p = l24split(tname(g.t, nm)); if (!p || !/^add\b/i.test(p.eff)) continue; if (r.some(o => o.line === g.t)) continue;
      const [effMain, ...rest] = p.eff.split(/\.\s+/); r.push({cost:p.cost, eff:effMain.replace(/\.$/, ''), rest:rest.join('. '), outs:manaOuts(effMain), tapOnly:/^\{t\}$/i.test(p.cost), line:g.t, l24:1}); }
    return r;
  };
}
// static abilities: a permanent that lost its abilities stops applying its rules; quoted static abilities it gained apply
{
  const sr0 = staticRules;
  staticRules = function(){
    const out = sr0(); if (!S) return out;
    let dead = null, add = [];
    try {
      for (const b of boardsAll()) for (const c of b.bf){ if (!c.k || c.fd) continue; const e = l24eff(c, b.pid); if (!e) continue;
        if (e.noAb){ (dead = dead || new Set()).add(b.pid + '|' + (faceOf(c)?.n || '')); }
        for (const g of e.ab){ const t = tname(g.t, cname(c)); if (/^(when|whenever|at) /i.test(t) || l24split(t) && l24isCost(l24split(t).cost)) continue;
          for (const sen of t.toLowerCase().replace(/\.$/, '').split(/\.\s*/)){ const s = sen.trim(); if (!s) continue; for (const [re, mk] of STATIC_RULES){ const m = s.match(re); if (m){ add.push({...mk(m), src:cname(c), pid:b.pid, l24id:c.id}); break; } } } }
      }
    } catch (e){ console.warn('l24 statics', e); }
    if (!dead && !add.length) return out;
    return out.filter(r => !(dead && dead.has(r.pid + '|' + r.src))).concat(add);
  };
}

/* ---------- granted triggered abilities ---------- */
function l24trigsOf(c, e){
  const out = []; if (!e) return out; const nm = cname(c);
  for (const g of e.ab){
    const t = tname(g.t, nm).replace(/\.$/, ''); const m = t.match(/^(when|whenever|at) (.+?), ([\s\S]+)$/i); if (!m) continue;
    let cond = m[2].toLowerCase().trim(); let cl = null;
    if (/^~ enters or leaves the battlefield$/.test(cond)) cl = {ev:'enter', evs:['enter', 'leave'], subj:'self', ctl:'you', desc:''};
    else if (/^~ attacks a player$/.test(cond)) cl = {ev:'attack', subj:'self', ctl:'you', desc:'', l24player:true};
    else if (/^~ is dealt damage$/.test(cond)) cl = {ev:'g23dealt', subj:'self', ctl:'you', desc:''};
    else if (/^~ becomes the target of a spell or ability for the first time each turn$/.test(cond)) cl = {ev:'l24targeted', subj:'self', ctl:'you', desc:''};
    else cl = classifyTrig(m[1].toLowerCase(), cond);
    if (!cl) continue;
    out.push({...cl, eff:m[3].trim(), raw:t, l24g:1, gsrc:g.src});
  }
  return out;
}
L24.gone = new Map();   // id → {noAb, trigs, k, t} snapshot of a permanent as it last existed (leaves-the-battlefield triggers look back)
{
  const mc = moveCard;
  moveCard = function(id, to, o = {}){
    try { if (S && to !== 'bf'){ const f = find(id); if (f[0] === 'bf' && f[2] && f[2].k){ const c = f[2]; const e = l24eff(c, MYPID); if (e) L24.gone.set(id, {noAb:e.noAb, trigs:l24trigsOf(c, e), k:c.k, nm:cname(c), t:turnStr()}); if (L24.gone.size > 60) L24.gone.delete(L24.gone.keys().next().value); } } } catch (err){ console.warn(err); }
    l24bust(); return mc(id, to, o);
  };
  const he = handleEvent;
  handleEvent = function(pid, ev){
    he(pid, ev);
    if (!S || !ev) return;
    try {
      const srcs = S.bf.filter(b => b.k && !b.fd).map(b => ({c:b, e:l24eff(b, MYPID)})).filter(x => x.e && x.e.ab.length);
      if (pid === MYPID && (ev.type === 'die' || ev.type === 'leave') && !S.bf.some(b => b.id === ev.id)){ const g = L24.gone.get(ev.id); if (g && g.trigs.length) srcs.push({c:{k:g.k, id:ev.id, fl:false}, gone:g}); }
      for (const x of srcs){
        const trigs = x.gone ? x.gone.trigs : l24trigsOf(x.c, x.e);
        for (const t of trigs){
          if (t.ev !== ev.type && !(t.evs && t.evs.includes(ev.type))) continue;
          if (x.gone && t.subj !== 'self' && t.subj !== 'selfOr') continue;
          if (t.ev === 'step') continue;
          if (ev.type === 'draw' || ev.type === 'gain' || ev.type === 'scry'){ if (t.ctl === 'you' && pid !== MYPID) continue; if (t.ctl === 'opp' && pid === MYPID) continue; }
          else if (ev.type === 'dmg' || ev.type === 'cdmg'){ if (!subjMatch(t, x.c, ev, pid)) continue; if (t.toYou && ev.dp !== MYPID) continue; if (t.toPlayer && !ev.dp) continue; if (t.oppOnly && (!ev.dp || ev.dp === pid)) continue; }
          else if (ev.type === 'cast'){ if (t.ctl === 'you' && pid !== MYPID) continue; if (t.ctl === 'opp' && pid === MYPID) continue; if (t.desc && !descOk(ev.k, t.desc)) continue; }
          else if (!subjMatch(t, x.c, ev, pid)) continue;
          if (t.l24player && !ev.dp) continue;
          pushTrigger({k:x.c.k, id:x.c.id, fl:x.c.fl}, t, ev, pid);
        }
      }
    } catch (err){ console.warn('l24 granted triggers', err); }
  };
  const fs = fireSteps;
  fireSteps = function(step, activePid){
    const r = fs(step, activePid);
    try { if (S) for (const b of S.bf){ if (!b.k || b.fd) continue; const e = l24eff(b, MYPID); if (!e || !e.ab.length) continue;
      for (const t of l24trigsOf(b, e)){ if (t.ev !== 'step' || t.step !== step || t.whose === 'next') continue; if (t.whose === 'your' && activePid !== MYPID) continue; if (t.whose === 'opp' && activePid === MYPID) continue;
        pushTrigger({k:b.k, id:b.id, fl:b.fl}, t, null, activePid); } } } catch (err){ console.warn('l24 steps', err); }
    return r;
  };
  // a permanent with no abilities has no triggered abilities of its own (granted ones it gained afterwards still work)
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    try { if (S && src && src.id != null && !(t && t.l24g)){
      const c = S.bf.find(b => b.id === src.id && b.k === src.k);
      const noAb = c ? l24noAbCard(c, MYPID) : (L24.gone.get(src.id) || {}).noAb;
      if (noAb){ log(`${c ? cname(c) : (L24.gone.get(src.id) || {}).nm || 'it'} has no abilities — its trigger doesn't happen`); return; } } } catch {}
    return pt(src, t, ev, evPid);
  };
}

/* ---------- publishing: the other players see the same characteristics ---------- */
{
  const clean = v => String(v == null ? '' : v);
  const cleanMod = m => { if (!m || typeof m !== 'object') return null; const o = {}; const arr = (a, n, len) => Array.isArray(a) ? a.slice(0, n).map(x => clean(x).slice(0, len)) : undefined;
    o.ts = Number.isFinite(m.ts) ? m.ts : 0; o.s = clean(m.s).slice(0, 60); o.u = clean(m.u).slice(0, 60);
    for (const k of ['setC', 'addC', 'crSub', 'setSub', 'addS']){ const v = arr(m[k], 8, 24); if (v) o[k] = v.map(x => x.replace(/[^A-Za-z'\-]/g, '')); }
    for (const k of ['loseCT', 'noAb', 'allCT']) if (m[k]) o[k] = 1;
    if (m.col != null) o.col = clean(m.col).replace(/[^WUBRG]/g, '').slice(0, 5); if (m.colAdd) o.colAdd = clean(m.colAdd).replace(/[^WUBRG]/g, '').slice(0, 5);
    if (Array.isArray(m.pt) && m.pt.length === 2 && m.pt.every(Number.isFinite)) o.pt = [clamp(m.pt[0], -99, 999), clamp(m.pt[1], -99, 999)];
    const ab = arr(m.ab, 4, 400); if (ab) o.ab = ab; const kw = arr(m.kw, 8, 30); if (kw) o.kw = kw.map(x => x.toLowerCase());
    return o; };
  L24.cleanMod = cleanMod;
  const cpe = cardPublicExtra;
  cardPublicExtra = function(c){ const o = cpe(c);
    try { const lx = (c.lx || []).filter(l24live); if (lx.length) o.lx = lx.slice(-12);
      if (c.xty && c.xty.length) o.xty = c.xty.slice(0, 8); if (c.jty && c.jty.length) o.jty = c.jty.slice(0, 8); if (c.r23types) o.r23types = String(c.r23types).slice(0, 60);
      if (c.r23kType) o.r23kType = String(c.r23kType).slice(0, 30); if (c.ctype) o.ctype = String(c.ctype).slice(0, 30); } catch {}
    return o; };
  const ss = sanitizeState;
  sanitizeState = function(s){ const r = ss(s);
    try { if (r && s && Array.isArray(s.bf)) r.bf.forEach((c, i) => { const o = s.bf[i]; if (!o || o.id !== c.id) return;
      if (Array.isArray(o.lx)) c.lx = o.lx.slice(0, 12).map(cleanMod).filter(Boolean);
      const wl = a => Array.isArray(a) ? a.slice(0, 8).map(x => clean(x).replace(/[^A-Za-z'\-]/g, '').slice(0, 24)).filter(Boolean) : undefined;
      if (o.xty) c.xty = wl(o.xty); if (o.jty) c.jty = wl(o.jty);
      if (typeof o.r23types === 'string') c.r23types = o.r23types.replace(/[^A-Za-z' \-]/g, '').slice(0, 60);
      if (typeof o.r23kType === 'string') c.r23kType = o.r23kType.replace(/[^A-Za-z'\-]/g, '').slice(0, 30);
      if (typeof o.ctype === 'string') c.ctype = o.ctype.replace(/[^A-Za-z'\-]/g, '').slice(0, 30); }); } catch (e){ console.warn(e); }
    return r; };
  const ors = onRemoteState;
  onRemoteState = function(pid, s){ l24bust(); return ors(pid, s); };
  const cm = commit;
  commit = function(...a){ l24bust(); return cm.apply(this, a); };
  // expiry: "until end of turn" and "until your next turn" records disappear on the turn change
  const tc = turnChanged;
  turnChanged = function(...a){ const r = tc.apply(this, a); try { if (S) S.bf.forEach(c => { if (c.lx) c.lx = c.lx.filter(l24live); if (c.lx && !c.lx.length) delete c.lx; }); l24bust(); } catch {} return r; };
  // a card that leaves the battlefield is a new object: its records go away
  const ol = onLeave;
  onLeave = function(c, to, w){ const r = ol(c, to, w); try { if (c){ delete c.lx; delete c.xty; } } catch {} l24bust(); return r; };
}
// a short label on the card so the whole table sees what it has become
{
  const ab0 = attachBadge;
  attachBadge = function(c, pid){ const b = ab0(c, pid); try { const e = l24eff(c, pid); if (!e) return b;
    const parts = []; if (e.tyChanged){ const ty = e.t.replace(/^Legendary /, ''); parts.push(ty.length > 40 ? ty.slice(0, 40) + '…' : ty); }
    if (e.colChanged) parts.push(e.col ? e.col.split('').join('') : 'colorless');
    if (e.noAb) parts.push('no abilities'); if (e.allCT) parts.push('every creature type');
    const kws = [...new Set(e.kw)]; if (kws.length) parts.push(kws.join(', '));
    if (e.ab.length) parts.push(e.ab.length === 1 ? `has “${short(e.ab[0].t, 40)}”` : `+${e.ab.length} abilities`);
    if (!parts.length) return b; return (b ? b + ' · ' : '') + parts.join(' · '); } catch { return b; } };
}

/* ---------- "becomes a green Elk creature with base power and toughness 3/3" → a record ---------- */
const L24_CT_WORDS = {artifact:'Artifact', creature:'Creature', land:'Land', enchantment:'Enchantment', planeswalker:'Planeswalker'};
function l24becomes(phrase0, orig0){
  // phrase: lowercase, after "becomes"/"is"; orig: same text with original case (for quoted abilities)
  let p = String(phrase0 || '').trim().replace(/\.$/, ''); let orig = String(orig0 || phrase0 || '').trim().replace(/\.$/, '');
  const mod = {}; let m;
  // quoted abilities first (they may contain anything)
  const ab = []; orig = orig.replace(/"([^"]+)"/g, (w, q) => { ab.push(q.replace(/\.?$/, '.')); return '"Q"'; }); p = orig.toLowerCase();
  if (ab.length) mod.ab = ab;
  let add = false;
  p = p.replace(/,? (?:that's|that is) still an? (land|artifact|enchantment)$/, (w, t) => { mod.addC = [L24_CT_WORDS[t]]; return ''; });
  if ((m = p.match(/ and (?:has|it has) no abilities$/))){ mod.noAb = 1; p = p.slice(0, m.index); }
  if ((m = p.match(/ in addition to its other (colors and types|types|creature types|colors)$/))){ add = true; if (/colors/.test(m[1])) mod.colAddMode = 1; p = p.slice(0, m.index); }
  if ((m = p.match(/,? and (?:it )?loses all other card types(?: and creature types)?(?: and abilities)?$/))){ mod.setC = []; if (/abilities/.test(m[0])) mod.noAb = 1; p = p.slice(0, m.index); }
  if ((m = p.match(/,? and (?:it )?loses all other card types and abilities$/))){ mod.setC = []; mod.noAb = 1; p = p.slice(0, m.index); }
  if ((m = p.match(/ and (?:has|it has) no abilities$/))){ mod.noAb = 1; p = p.slice(0, m.index); }
  if ((m = p.match(/ with base power and toughness (\d+)\/(\d+)$/))){ mod.pt = [+m[1], +m[2]]; p = p.slice(0, m.index); }
  if ((m = p.match(/ with ((?:"q"|[a-z ]+?)(?:,? (?:and )?(?:"q"|[a-z0-9 ]+?))*)$/))){ const parts = m[1].split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim()).filter(Boolean);
    const kws = parts.filter(x => x !== '"q"'); if (!kws.every(k => L24_KWS.test(k) || /^(crew|ward) \d+$/.test(k))) return null; if (kws.length) mod.kw = kws; p = p.slice(0, m.index); }
  if ((m = p.match(/^an? /))) p = p.slice(m[0].length);
  if ((m = p.match(/^(\d+)\/(\d+) /))){ mod.pt = [+m[1], +m[2]]; p = p.slice(m[0].length); }
  // colors
  if ((m = p.match(/^all colors$/))){ mod.col = 'WUBRG'; return mod; }
  if ((m = p.match(/^((?:(?:white|blue|black|red|green|colorless)(?:,? and |, | )?)+)/))){ const c = l24colors(m[1]); if (add && mod.colAddMode) mod.colAdd = c; else mod.col = c; p = p.slice(m[0].length).trim(); }
  delete mod.colAddMode;
  if (!p) return Object.keys(mod).length ? mod : null;
  const words = p.split(/\s+/); if (!words.every(w => /^[a-z'\-]+$/.test(w))) return null;
  const cts = words.filter(w => L24_CT_WORDS[w]).map(w => L24_CT_WORDS[w]); const subs = words.filter(w => !L24_CT_WORDS[w]).map(l24capW);
  if (subs.some(w => /^(and|or|the|with|that|its|it|has|have|of|until|for|as|long|this|turn|end)$/i.test(w))) return null;
  if (mod.setC){ mod.setC = cts; mod.setSub = subs; return mod; }
  if (add){ if (cts.length) mod.addC = (mod.addC || []).concat(cts); if (subs.length) mod.addS = subs; return mod; }
  if (cts.length) mod.addC = (mod.addC || []).concat(cts);
  // "becomes a Coward" / "becomes an Elk creature": the new creature types replace the old ones (CR 205.1b)
  if (subs.length){ if (subs.every(l24isCreSub)) mod.crSub = subs; else mod.addS = subs; }
  return mod;
}
L24.say = (s, ctx) => doSentence(s, ctx);
// put a record on a permanent wherever it is (another player's permanent goes through their client)
RQ_OPS.push('l24mod');
function l24modTo(t, mod, src){
  if (!t) return; mod = {...mod, s:src || mod.s || ''};
  if (t.pid === MYPID || !t.pid){ const c = S.bf.find(b => b.id === t.id); if (c){ const x = single(c); l24addMod(x, mod); if (mod.ab || mod.kw) l24enterNote(x, mod); } return; }
  sendRq(t.pid, 'l24mod', 0, src, {tid:t.id, lx:mod});
}
function l24enterNote(c, mod){}
function l24describe(mod){
  const p = []; if (mod.noAb) p.push('loses all abilities'); if (mod.setC) p.push(`is ${[...mod.setC, ...(mod.setSub || [])].join(' ') || 'nothing else'}`);
  if (mod.crSub) p.push(`is a ${mod.crSub.join(' ')}`); if (mod.addC || mod.addS) p.push(`is also ${[...(mod.addC || []), ...(mod.addS || [])].join(' ')}`);
  if (mod.loseCT) p.push('loses all creature types'); if (mod.allCT) p.push('is every creature type');
  if (mod.col != null) p.push(mod.col ? (mod.col === 'WUBRG' ? 'is all colors' : `is ${mod.col}`) : 'is colorless'); if (mod.colAdd) p.push(`is also ${mod.colAdd}`);
  if (mod.pt) p.push(`has base power and toughness ${mod.pt[0]}/${mod.pt[1]}`); if (mod.kw) p.push(`gains ${mod.kw.join(', ')}`); if (mod.ab) p.push(`gains “${short(mod.ab.join(' / '), 70)}”`);
  return p.join(', ') + (mod.u ? (mod.u[0] === 'e' ? ' until end of turn' : ' until its caster\'s next turn') : '');
}
{
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); try { if (o && Array.isArray(o.rq) && Array.isArray(s.rq)) o.rq.forEach(r => { if (r.op !== 'l24mod') return; const src = s.rq.find(x => x && x.id === r.id); if (src && src.lx) r.lx = L24.cleanMod(src.lx); }); } catch {} return o; };
  const ao = applyOp;
  applyOp = function(r, from){
    if (r && r.op === 'l24mod'){ const c = S.bf.find(b => b.id === r.tid); if (c && r.lx){ const x = single(c); l24addMod(x, L24.cleanMod(r.lx)); log(`${cname(x)} ${l24describe(r.lx)} (${r.src})`); } commit(); return; }
    return ao(r, from);
  };
}
// cards an effect just put onto the battlefield ("Each of them is a 1/1 Spirit …", "It's a Skeleton …")
{
  const re = runEffects;
  runEffects = async function(txt, ctx){ (L24.ctxs = L24.ctxs || []).push(ctx);
    // a quoted ability is one piece of text: don't let the sentence splitter cut it at its inner periods or ", then"
    txt = String(txt == null ? '' : txt).replace(/"[^"\n]*"/g, q => q.replace(/\.\s+(?=[A-Z~"{])/g, '\u2024 ').replace(/,? then /g, m => m.replace('then', 'the\u200bn'))); try { return await re(txt, ctx); } finally { const i = L24.ctxs.lastIndexOf(ctx); if (i >= 0) L24.ctxs.splice(i, 1); } };
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ const r = mc(id, to, o); try { if (to === 'bf' && L24.ctxs && L24.ctxs.length){ const ctx = L24.ctxs[L24.ctxs.length - 1]; if (ctx){ ctx.l24moved = (ctx.l24moved || []).concat(id).slice(-40); } } } catch {} return r; };
}

/* ---------- checking a quoted ability honestly (sandbox only): is its trigger detected and its effect understood? ---------- */
function l24classify(w, cond){
  cond = String(cond).toLowerCase().trim();
  if (/^you don't control an? [a-z ]+$/.test(cond)) return {ev:'l24state'};
  if (/^~ enters or leaves the battlefield$/.test(cond)) return {ev:'enter'};
  if (/^~ attacks a player$/.test(cond)) return {ev:'attack'};
  if (/^~ is dealt damage$/.test(cond)) return {ev:'g23dealt'};
  return classifyTrig(String(w).toLowerCase(), cond);
}
async function l24checkQuoted(q, ctx){
  const t = String(q).trim().replace(/\.$/, ''); let m;
  // the quoted ability runs with the permanent that has it as its source: put a stand-in into the sandbox
  const fakeK = () => { if (!L24.fakeCre){ for (const a of DICT.values()) if (/\bCreature\b/.test(a.t || '') && /^\d+\/\d+$/.test(a.p || '') && !a.back){ L24.fakeCre = a.k; break; } } return L24.fakeCre || ctx.k; };
  const run = async (eff, zone, it) => { if (!UI.dry) return []; const id = 777777; const c = {id, k:fakeK(), n:1}; S[zone].push(c);
    const n0 = UI.dry.length; try { await runEffects(eff, {k:c.k, name:info(c.k)?.n || ctx.name, full:eff, srcId:id, it:{...(ctx.it || {}), ...it}, tgts:null}); } finally { const i = S[zone].indexOf(c); if (i >= 0) S[zone].splice(i, 1); }
    return UI.dry.splice(n0).map(x => String(x).split(info(c.k)?.n || '\u0000').join('~')); };
  if ((m = t.match(/^(when|whenever|at) (.+?), ([\s\S]+)$/i))){
    const cl = l24classify(m[1], m[2]); if (!cl) return [t];
    const gone = /^(die|leave)$/.test(cl.ev) && (cl.subj === 'self' || /^~ (dies|leaves)/.test(m[2].toLowerCase()));
    return run(m[3], gone ? 'gy' : 'bf', {kind:'trigger', evId:777777, evPid:MYPID, evk:fakeK()});
  }
  const p = l24split(t);
  if (p && l24isCost(p.cost)){ if (/^add\b/i.test(p.eff)) return []; return run(p.eff, 'bf', {kind:'ability'}); }
  if (keywordsOnly(t)) return [];
  if (L24_QSTATIC.some(re => re.test(t.toLowerCase()))) return [];
  return staticKnown(t) ? [] : [t];
}
// quoted static abilities the layer pass implements itself
const L24_QSTATIC = [/^if ~ would leave the battlefield, exile it instead of putting it anywhere else$/, /^if (?:this (?:permanent|creature|land)|~) would be put into a graveyard from anywhere, exile it instead$/];
/* ---------- effects ---------- */
function l24subj(subj, ctx){
  const d = String(subj || '').trim().toLowerCase(); let m;
  const card = t => t && (t.pid === MYPID ? S.bf.find(b => b.id === t.id) : (OPP.get(t.pid)?.bf || []).find(b => b.id === t.id));
  const mine = id => { const c = S.bf.find(b => b.id === id); return c ? {t:'card', pid:MYPID, id:c.id, k:c.k} : null; };
  if (/^(?:(?:up to )?(?:one|two|three) )?(?:other )?(?:another )?target\b/.test(d) || /^(?:a|one) (?:second )?target\b/.test(d)) return (ctx.tgts ? nextTargets(ctx) : []).filter(Boolean);
  if (/^(it|that creature|that permanent|that land|that artifact|that card|the creature|the token|that token|this creature|the chosen creature)$/.test(d)){
    if (ctx.l24it) return [ctx.l24it];
    if (ctx.lastT && ctx.lastT.length) return ctx.lastT.slice(0, 1);
    if (ctx.lastCardId != null && mine(ctx.lastCardId)) return [mine(ctx.lastCardId)];
    if (ctx.l24moved && ctx.l24moved.length && mine(ctx.l24moved[ctx.l24moved.length - 1])) return [mine(ctx.l24moved[ctx.l24moved.length - 1])];
    if (ctx.lastTok && ctx.lastTok.length) return ctx.lastTok.map(mine).filter(Boolean).slice(0, 1);
    const ev = ctx.it && ctx.it.evId; if (ev != null){ const pid = ctx.it.evPid || MYPID; const c = card({pid, id:ev}); if (c) return [{t:'card', pid, id:c.id, k:c.k}]; }
    return [];
  }
  if (/^(each of them|they|those creatures|those permanents|those tokens|each of those creatures)$/.test(d)){
    if (ctx.l24moved && ctx.l24moved.length) return ctx.l24moved.map(mine).filter(Boolean);
    if (ctx.lastTok && ctx.lastTok.length) return ctx.lastTok.map(mine).filter(Boolean);
    if (ctx.lastT && ctx.lastT.length) return ctx.lastT;
    return [];
  }
  if (d === '~'){ const c = srcCardOf(ctx); return c && S.bf.includes(c) ? [{t:'card', pid:MYPID, id:c.id, k:c.k}] : []; }
  // mass subjects
  let who = 'any', desc = d, other = false, tp = null;
  desc = desc.replace(/^(each|all) /, '').replace(/^other /, () => { other = true; return ''; });
  if ((m = desc.match(/^(.+?) (you control|your opponents control|an opponent controls|target player controls|target opponent controls|that player controls|defending player controls)$/))){
    desc = m[1]; who = m[2] === 'you control' ? 'you' : /target/.test(m[2]) ? 'tp' : m[2] === 'that player controls' || m[2] === 'defending player controls' ? 'that' : 'opp'; }
  if (who === 'tp'){ const t = (ctx.tgts ? nextTargets(ctx) : []).find(x => x && x.t === 'player'); if (!t) return []; tp = t.pid; }
  if (who === 'that'){ tp = (ctx.it && (ctx.it.evDp || ctx.it.evPid)) || null; if (!tp) return []; }
  desc = desc.replace(/^face-up /, '');
  if (!/^[a-z \-]+$/.test(desc) || /\b(with|without|that|named|of)\b/.test(desc)) return null;
  const out = [];
  for (const b of boardsAll()){
    if (who === 'you' && b.pid !== MYPID) continue; if (who === 'opp' && b.pid === MYPID) continue; if (tp && b.pid !== tp) continue;
    for (const c of b.bf){ if (!c.k || c.fd) continue; if (other && b.pid === MYPID && c.id === ctx.srcId) continue;
      if (!descOk(c.k, sing(desc), {tok:c.tok, face:faceOf(c), card:c})) continue; if (/\bcreature\b/.test(desc) && !isCreatureCard(c)) continue;
      out.push({t:'card', pid:b.pid, id:c.id, k:c.k}); }
  }
  return out;
}
async function doRound24OPre(s, l, ctx){
  let m; const name = ctx.name || '';
  // durations at either end
  let dur = '', body = s, bl = l;
  if ((m = bl.match(/^(until end of turn|until your next turn|this turn),? /))){ dur = m[1]; body = body.slice(m[0].length); bl = bl.slice(m[0].length); }
  if ((m = bl.match(/ (until end of turn|until your next turn|this turn)$/))){ dur = m[1]; body = body.slice(0, body.length - m[0].length); bl = bl.slice(0, bl.length - m[0].length); }
  const u = dur ? l24until(dur, MYPID) : '';
  const SUBJ = "(~|it|they|each of them|that creature|that permanent|that land|that token|the token|the creature|(?:up to (?:one|two|three) )?(?:other )?target [^\"]+?|(?:each|all) [^\"]+?|creatures [^\"]+?|face-up [^\"]+?|[a-z \\-]+? you control)";
  const apply = async (list, mod, label) => {
    if (list == null) return false;
    if (UI.dry && mod.ab) for (const q of mod.ab){ const miss = await l24checkQuoted(q, ctx); miss.forEach(x => UI.dry.push(x)); }
    mod = {...mod, u};
    for (const t of list) l24modTo(t, mod, name);
    if (list.length) log(`${name}: ${list.length === 1 ? (list[0].nm || cname(l24card(list[0]) || {}) || 'it') : list.length + ' permanents'} ${label || l24describe(mod)}`);
    commit(); return true;
  };
  // "… loses all abilities [and becomes …]" / "… lose all abilities and have base power and toughness 0/2"
  if ((m = bl.match(new RegExp('^' + SUBJ + ' (?:loses|lose) all abilities(?: and (?:becomes?|is|are|has|have) (.+))?$')))){
    let mod = {noAb:1};
    if (m[2]){ const rest = body.slice(body.length - m[2].length); let x;
      if ((x = m[2].match(/^base power and toughness (\d+)\/(\d+)$/))) mod.pt = [+x[1], +x[2]];
      else { const b2 = l24becomes(m[2], rest); if (!b2) return false; mod = {...b2, noAb:1}; } }
    // Azure Beastbinder's second sentence sets the base P/T separately
    return apply(l24subj(m[1], ctx), mod);
  }
  // "If it's a creature, it also has base power and toughness 2/2 until your next turn"
  if ((m = bl.match(/^if it's a creature, it also has base power and toughness (\d+)\/(\d+)$/))){
    const t = (ctx.lastT || [])[0]; const c = l24card(t); if (!t || !c || !isCreatureCard(c)) return true;
    return apply([t], {pt:[+m[1], +m[2]]}); }
  // "… loses all creature types"
  if ((m = bl.match(new RegExp('^' + SUBJ + ' (?:loses|lose) all creature types$')))) return apply(l24subj(m[1], ctx), {loseCT:1});
  // "… has/have base power and toughness X/Y and gains trample, annihilator 2, and haste"
  if ((m = bl.match(new RegExp('^' + SUBJ + ' (?:has|have) base power and toughness (\\d+)\\/(\\d+) and (?:gains?|has|have) ([a-z0-9 ,]+)$')))){
    const kws = l24kwList(m[4]); if (!kws.every(k => L24_KWS.test(k))) return false;
    return apply(l24subj(m[1], ctx), {pt:[+m[2], +m[3]], kw:kws}); }
  // "… becomes / is / are …"
  if ((m = bl.match(new RegExp('^' + SUBJ + ' (?:becomes?|is|are|each become) (an? .+|all colors|[a-z]+ and [a-z]+|(?:white|blue|black|red|green|colorless) .+|\\d+\\/\\d+ .+)$'))) && !/^(?:the|tapped|attacking|blocked|a copy|copies|an? copy|unblocked|monstrous|renowned|suspected|saddled|prepared|goaded|the target|the monarch)/.test(m[2]) && !/ copy of /.test(m[2])){
    const rest = body.slice(body.length - m[2].length); const mod = l24becomes(m[2], rest); if (!mod) return false;
    if (await l24older(s, ctx)) return true;
    return apply(l24subj(m[1], ctx), mod); }
  if ((m = bl.match(/^(it's|they're) (an? .+)$/))){ const rest = body.slice(body.length - m[2].length); const mod = l24becomes(m[2], rest); if (!mod) return false; if (await l24older(s, ctx)) return true; return apply(l24subj(m[1] === "it's" ? 'it' : 'they', ctx), mod); }
  // "… gains "…"" / "… gets +2/+0 and gains "…"" / "… gain kw and "…""
  if ((m = body.match(new RegExp('^' + SUBJ.replace(/\[\^"\]/g, '[^"]') + ' (?:gets? ([+-]\\d+)\\/([+-]\\d+),? and )?(?:gains?|has|have) ((?:[a-z ,]+?,? and )?)((?:"[^"]+"(?:,? and )?)+)$', 'i')))){
    const subj = m[1].toLowerCase(); const kws = m[4] ? l24kwList(m[4].replace(/,? and $/, '')) : [];
    if (!kws.every(k => L24_KWS.test(k))) return false;
    const abs = []; m[5].replace(/"([^"]+)"/g, (w, q) => { abs.push(q.replace(/\.?$/, '.')); return w; });
    const list = l24subj(subj, ctx); if (list == null) return false;
    if (m[2] != null && list.length){ const f = {p:+m[2], t:+m[3]}; list.forEach(t => applyTo(t, {op:'pump', src:name, f})); }
    const mod = {ab:abs}; if (kws.length) mod.kw = kws;
    // "gains … until end of turn" from an instant: still until end of turn when no duration is spelled out but the effect is temporary
    return apply(list, mod); }
  return false;
}
// older rounds already animate many permanents (c.anim, h23bpt, jty …): let them do the sentence; only if they would fall back to
// "do this by hand" does the layer pass record it instead
async function l24older(s, ctx){
  if (!L24.dsOld) return false;
  // the probe flag rides on this sentence's ctx (copies of ctx share the same object), not on the global handWarn, so other
  // flows that run while dsOld awaits a prompt (an incoming request, a trigger) keep their own warnings
  ctx = ctx || {}; const pr = {on:true, warned:false}; const prev = ctx.l24probe; const dry0 = UI.dry ? UI.dry.length : 0;
  ctx.l24probe = pr;
  try { await L24.dsOld(s, ctx); } catch { pr.warned = true; } finally { pr.on = false; ctx.l24probe = prev; }
  if (UI.dry && UI.dry.length > dry0){ UI.dry.splice(dry0); pr.warned = true; }
  return !pr.warned;
}
{ const hw0 = handWarn; handWarn = function(s, c){ if (c && c.l24probe && c.l24probe.on){ c.l24probe.warned = true; return; } return hw0.apply(this, arguments); }; }
function l24card(t){ if (!t) return null; return t.pid === MYPID ? S.bf.find(b => b.id === t.id) : (OPP.get(t.pid)?.bf || []).find(b => b.id === t.id); }
{ const ds = doSentence; L24.dsOld = ds; doSentence = async function(s0, ctx){ s0 = String(s0).replace(/\u2024/g, '.').replace(/\u200b/g, ''); const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound24OPre(s, l, ctx)) return; return ds(s0, ctx); }; }

/* ---------- inner effects of granted abilities ---------- */
async function doRound24OInner(s, l, ctx){
  let m;
  // "When this creature dies, return it to the battlefield tapped under its owner's control [with a +1/+1 counter on it]"
  if ((m = l.match(/^return it to the battlefield( tapped)? under (?:its owner's|your) control(?: with an? (\+1\/\+1|-1\/-1|[a-z]+) counter on it)?$/))){
    const id = ctx.it && ctx.it.evId != null ? ctx.it.evId : ctx.srcId; const z = id != null ? find(id)[0] : null;
    if (z !== 'gy' && z !== 'ex') return !!(ctx.it && ctx.it.kind === 'trigger') || UI.dry ? true : false;
    moveCard(id, 'bf', {quiet:true}); const c = S.bf.find(b => b.id === id);
    if (c){ if (m[1]) c.tap = true; if (m[2]){ const k = m[2] === '+1/+1' ? 'cp' : m[2] === '-1/-1' ? 'cm' : m[2]; if (k === 'cp' || k === 'cm') modCounters(c, k, 1); else addNamed(c, k, 1); } log(`${cname(c)} returned to the battlefield${m[1] ? ' tapped' : ''}${m[2] ? ` with a ${m[2]} counter` : ''} (${ctx.name})`); }
    commit(); return true; }
  // "Whenever this creature becomes tapped, it deals damage equal to its power to up to one target creature"
  if ((m = l.match(/^(?:it|~) deals damage equal to its power to (up to one target creature|target creature|any target|target creature or planeswalker|target player or planeswalker|target player)$/))){
    const c = srcCardOf(ctx); const t = (ctx.tgts ? nextTargets(ctx) : [])[0];
    if (!c || !S.bf.includes(c) || !t) return true; const n = Math.max(0, (stats(c) || [0])[0]);
    dealDamage(t, n, c.k, c); log(`${cname(c)} deals ${n} damage to ${t.nm || 'its target'}`); commit(); return true; }
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound24OInner(s, l, ctx)) return; return ds(s0, ctx); }; }
// "If this permanent would leave the battlefield, exile it instead of putting it anywhere else" (granted)
{
  const mc = moveCard;
  moveCard = function(id, to, o = {}){
    try { if (S && to !== 'bf' && to !== 'ex'){ const c = S.bf.find(b => b.id === id); if (c){ const e = l24eff(c, MYPID);
      if (e && e.ab.some(g => /^if (?:this (?:permanent|creature|artifact|enchantment|land)|~|it) would leave the battlefield, exile it instead of putting it anywhere else\.?$/i.test(tname(g.t, cname(c))))){ log(`${cname(c)} is exiled instead of leaving the battlefield another way`); to = 'ex'; } } } } catch {}
    return mc(id, to, o);
  };
}
// state triggers granted in quotes: "When you don't control a legendary Vampire, exile this creature."
{
  const cm = commit;
  commit = function(...a){ const r = cm.apply(this, a);
    try { if (S && !UI.dry && !UI.replay && !L24.stBusy){ for (const c of S.bf){ if (!c.k || c.fd) continue; const e = l24eff(c, MYPID); if (!e || !e.ab.length) continue;
      for (const g of e.ab){ const t = tname(g.t, cname(c)).replace(/\.$/, ''); const m = t.match(/^when you don't control an? ([a-z ]+), ([\s\S]+)$/i); if (!m) continue;
        if (S.bf.some(x => x !== c && x.k && !x.fd && descOk(x.k, m[1].toLowerCase(), {tok:x.tok, face:faceOf(x), card:x}))) { if (c.l24st) delete c.l24st; continue; }
        if (c.l24st === g.t) continue; c.l24st = g.t; L24.stBusy = 1;
        try { pushTrigger({k:c.k, id:c.id, fl:c.fl}, {ev:'l24state', eff:m[2], raw:t, l24g:1}, null, MYPID); } finally { L24.stBusy = 0; } } } } } catch (err){ console.warn(err); }
    return r; };
}

/* ---------- the deck checker: static lines the layer pass implements ---------- */
async function l24dryQuoted(q, k, name){
  const saved = S; const misses = []; UI.dry = misses; let out = [];
  try {
    S = saved ? JSON.parse(JSON.stringify(saved)) : newState();
    if (!S.lib.length) S.lib = Array.from({length:10}, (_, i) => ({id:900000 + i, k}));
    S.turn = [1, MYPID, 0]; S.ph = [1, 3, 0];
    const run = l24checkQuoted(q, {k, name, it:{kind:'ability', evX:2, x:2, sid:'dry', evDp:'dry-opp', evId:1, evPid:'dry-opp', evN:2}});
    out = await Promise.race([run, new Promise(r => setTimeout(() => r(['(timed out) ' + q]), 4000))]);
  } catch (e){ out = [String(q)]; }
  finally { S = saved; UI.dry = null; }
  return out.concat(misses);
}
{
  const cc = checkCard;
  checkCard = async function(k){
    const r = await cc(k);
    try { const a = info(k); if (!a || !r || !r.issues) return r;
      for (let i = r.issues.length - 1; i >= 0; i--){
        const x = r.issues[i]; if (x.kind !== 'static') continue;
        const line = tname(String(x.text).split(a.n).join('~'), a.n).replace(/\.$/, '');
        const st = l24parseStatic(line); if (!st) continue;
        const list = Array.isArray(st) ? st : [st]; const miss = [];
        for (const y of list) for (const q of (y.mod.ab || [])) (await l24dryQuoted(tname(q, a.n), k, a.n)).forEach(t => miss.push(t));
        r.issues.splice(i, 1, ...miss.map(t => ({kind:'effect', text:String(t).replace(/~/g, a.n), where:x.text})));
      }
      if (!r.issues.length) r.ok = (r.ok || 0) + 1;
    } catch (e){ console.warn('l24 check', e); }
    return r;
  };
}

/* ---------- combat keywords, printed or granted (CR 702.x): skulk, landwalk, dethrone, melee, exalted, afflict, annihilator, myriad, bloodthirst ---------- */
{
  const cb0 = canBlock;
  canBlock = function(b, a, apid){
    const r = cb0(b, a, apid); if (r || !a || !b || !S) return r;
    try {
      if (kwOf(a, 'skulk', apid)){ const pa = (stats(a, apid) || [0])[0], pb = (stats(b, MYPID) || [0])[0]; if (pb > pa) return 'skulk'; }
      for (const [bt] of Object.entries(BASIC)){ if (bt === 'Wastes') continue; const kw = bt.toLowerCase() + 'walk';
        if (kwOf(a, kw, apid) && S.bf.some(l => l.k && !l.fd && new RegExp('\\b' + bt + '\\b').test(typeOf(l)))) return kw; }
    } catch (e){ console.warn(e); }
    return r;
  };
  const lifeOf = pid => pid === MYPID ? S.life : (OPP.get(pid)?.life ?? -999);
  const he = handleEvent;
  handleEvent = function(pid, ev){
    he(pid, ev);
    if (!S || !ev || pid !== MYPID || UI.dry) return;
    try {
      if (ev.type === 'attack'){
        const c = S.bf.find(b => b.id === ev.id); if (!c) return; const dp = ev.dp || (parseDef(c.atk) || {}).pid || '';
        const isPlayer = c.atk && String(c.atk).startsWith('p:');
        const mk = (eff, raw, extra = {}) => pushTrigger({k:c.k, id:c.id, fl:c.fl}, {ev:'attack', eff, raw, l24g:1}, {...ev, dp, ...extra}, MYPID);
        const nD = l24kwCount(c, 'dethrone'); if (nD && isPlayer && dp && players().every(p => lifeOf(dp) >= lifeOf(p.pid))) for (let i = 0; i < nD; i++) mk('Put a +1/+1 counter on ~.', 'dethrone');
        const nM = l24kwCount(c, 'melee'); for (let i = 0; i < nM; i++) mk('~ gets +1/+1 until end of turn for each opponent you attacked this combat.', 'melee');
        const nA = l24kwN(c, 'annihilator'); if (nA && dp) mk(`Defending player sacrifices ${nA} permanent${nA === 1 ? '' : 's'}.`, `annihilator ${nA}`);
        const nY = l24kwCount(c, 'myriad'); if (nY && dp && opponents().length > 1) for (let i = 0; i < nY; i++) mk('For each opponent other than defending player, you may create a token copy of ~ tapped and attacking that player. Exile those tokens at end of combat.', 'myriad');
        // exalted: once per combat, when exactly one creature attacks
        const key = S.cb ? `${S.cb.t}|${S.cb.n}` : turnStr();
        const atk = S.bf.filter(x => x.atk && !x.fd);
        if (atk.length === 1 && (atk[0].n || 1) === 1 && atk[0].id === c.id && L24.exKey !== key){ L24.exKey = key;
          for (const p of S.bf){ const n = l24kwCount(p, 'exalted'); for (let i = 0; i < n; i++) pushTrigger({k:p.k, id:p.id, fl:p.fl}, {ev:'attack', eff:'The creature attacking alone gets +1/+1 until end of turn.', raw:'exalted', l24g:1}, {...ev, dp}, MYPID); } }
      }
      if (ev.type === 'blocked'){
        const c = S.bf.find(b => b.id === ev.id); if (!c) return; const d = parseDef(c.atk); const dp = d ? attackTargetProtector(d) : '';
        const nF = l24kwN(c, 'afflict'); if (nF && dp && dp !== MYPID) pushTrigger({k:c.k, id:c.id, fl:c.fl}, {ev:'blocked', eff:`Defending player loses ${nF} life.`, raw:`afflict ${nF}`, l24g:1}, {...ev, dp}, MYPID);
      }
    } catch (err){ console.warn('l24 combat kw', err); }
  };
  // myriad tokens leave at end of combat
  const ec = endCombat;
  endCombat = function(...a){ try { const ids = (S.l24myr || []).splice(0); ids.forEach(id => { if (S.bf.some(b => b.id === id)) moveCard(id, 'ex', {quiet:true}); }); if (ids.length) log(`myriad: exiled ${ids.length} token${ids.length === 1 ? '' : 's'} at end of combat`); } catch {} return ec.apply(this, a); };
  // bloodthirst N: enters with N +1/+1 counters if an opponent was dealt damage this turn
  const oe = onEnter;
  onEnter = function(c, from, o = {}){ const r = oe(c, from, o);
    try { if (S && c && !c.fd && from !== 'bf' && S.bf.includes(c)){ const n = l24kwN(c, 'bloodthirst');
      if (n && (S.l24hit === turnStr() || opponents().some(p => typeof r23kLostLife === 'function' && r23kLostLife(p.pid)))){ modCounters(c, 'cp', n); log(`${cname(c)} enters with ${n} +1/+1 counter${n === 1 ? '' : 's'} (bloodthirst)`); } } } catch (e){ console.warn(e); }
    return r; };
  const dd = dealDamage;
  dealDamage = function(t, n, ...a){ try { if (S && t && t.t === 'player' && t.pid && t.pid !== MYPID && n > 0) S.l24hit = turnStr(); } catch {} return dd(t, n, ...a); };
  const hd = hitDefender;
  hitDefender = function(def, n, ...a){ try { if (S && def && def.t === 'player' && def.pid !== MYPID && n > 0) S.l24hit = turnStr(); } catch {} return hd(def, n, ...a); };
}
async function doRound24OKw(s, l, ctx){
  let m; const it = ctx.it || {};
  if ((m = l.match(/^~ gets \+1\/\+1 until end of turn for each opponent you attacked this combat$/))){
    const c = srcCardOf(ctx); if (!c || !S.bf.includes(c)) return true; const set = new Set(); S.bf.forEach(x => { const d = parseDef(x.atk); if (d){ const p = attackTargetProtector(d); if (p && p !== MYPID) set.add(p); } });
    const n = set.size; if (n){ c.pu = [(c.pu || [0, 0])[0] + n, (c.pu || [0, 0])[1] + n]; log(`${cname(c)} gets +${n}/+${n} until end of turn (melee)`); } commit(); return true; }
  if ((m = l.match(/^the creature attacking alone gets \+1\/\+1 until end of turn$/))){
    const c = it.evId != null ? S.bf.find(b => b.id === it.evId) : null; if (!c) return true; c.pu = [(c.pu || [0, 0])[0] + 1, (c.pu || [0, 0])[1] + 1]; log(`${cname(c)} gets +1/+1 until end of turn (exalted)`); commit(); return true; }
  if ((m = l.match(/^defending player sacrifices (\d+|a|one|two|three) permanents?$/))){
    const n = +m[1] || wn(m[1]) || 1; const dp = it.evDp; if (!dp || dp === MYPID || UI.dry) return true; sendRq(dp, 'sac', n, ctx.name, {d:'permanent'}); log(`${ctx.name}: ${nameOf(dp)} sacrifices ${n} permanent${n === 1 ? '' : 's'} (annihilator)`); commit(); return true; }
  if ((m = l.match(/^defending player loses (\d+) life$/))){
    const dp = it.evDp; if (!dp || dp === MYPID || UI.dry) return true; sendRq(dp, 'life', -(+m[1]), ctx.name); log(`${ctx.name}: ${nameOf(dp)} loses ${m[1]} life (afflict)`); commit(); return true; }
  if ((m = l.match(/^for each opponent other than defending player, you may create a token copy of ~ tapped and attacking that player$/))){
    const c = srcCardOf(ctx); const dp = it.evDp; if (!c || UI.dry) return true;
    for (const p of opponents()){ if (p.pid === dp) continue; if (!(await askYes(`${cname(c)} (myriad): create a token copy attacking ${p.nm}?`, 'Create it', 'No'))) continue;
      const tk = {id:S.nid++, k:c.k, tok:true, copy:true, n:1, sk:true, tap:true, atk:'p:' + p.pid}; place(tk); S.bf.push(tk); (S.l24myr = S.l24myr || []).push(tk.id); emit({type:'enter', k:c.k, id:tk.id, tok:1}); log(`${cname(c)} (myriad): a token copy attacks ${p.nm}`); }
    commit(); return true; }
  if (/^exile those tokens at end of combat$/.test(l)) return true;   // done by endCombat (S.l24myr)
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound24OKw(s, l, ctx)) return; return ds(s0, ctx); }; }

/* ---------- Gornog, the Red Reaper: "Cowards can't block Warriors" (types from the layer pass, on every client) ---------- */
STATIC_RULES.push([/^cowards can't block warriors$/, m => ({kind:'l24coward', who:'all'})]);
{
  const cb = canBlock;
  canBlock = function(b, a, apid){ const r = cb(b, a, apid); if (r || !a || !b) return r;
    try { if (rulesOn('l24coward').length && /\bCoward\b/.test(typeOf(b)) && /\bWarrior\b/.test(typeOf(a))) return "Cowards can't block Warriors"; } catch {} return r; };
}
