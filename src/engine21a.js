/* ===== Rules engine — round 21A: counters, fully automatic ===== */

/* ---------- Toxic / poisonous: combat damage to a PLAYER also gives poison counters (CR 702.164, 702.70) ---------- */
function r21aKwN(c, kw, pid=MYPID){ // total of all instances of "kw N" (toxic, poisonous) on c — instances are cumulative
  if (!c || !c.k || c.fd) return 0;
  let n = 0; const f = faceOf(c); const re = new RegExp('(?:^|, )' + kw + ' (\\d+)(?=,|$| \\()', 'gim');
  const own = tname(f && f.o || '', f && f.n || '').replace(/\([^)]*\)/g, '');
  for (const line of own.split('\n')){ if (!/^[a-z ,0-9—{}\/-]+$/i.test(line.trim())) continue; let m; re.lastIndex = 0; while ((m = re.exec(line.trim()))) n += +m[1]; }
  for (const e of [...(c.ekw || []), ...(c.ekwp || [])]){ const m = String(e).match(new RegExp('^' + kw + ' (\\d+)$', 'i')); if (m) n += +m[1]; }
  // statics on this player's board: "Other Rats you control have toxic 1", "All Sliver creatures have poisonous 1", "Enchanted creature has toxic 2"
  for (const b of boardsAll()) for (const s of b.bf){
    if (!s.k || s.fd) continue; const a = info(s.k); if (!a) continue; const sf = s.fl && a.back ? a.back : a;
    for (const sen of tname(sf.o, sf.n).toLowerCase().split(/\.\s*|\n/)){
      let m = sen.match(new RegExp('^(other )?(.+?) ha(?:ve|s) ' + kw + ' (\\d+)$')); if (!m) continue;
      let desc = m[2].trim(); const amt = +m[3];
      if (/^(equipped|enchanted) (creature|permanent)$/.test(desc)){ if (s.att && s.att.id === c.id && s.att.pid === pid) n += amt; continue; }
      if (/^(~|it|target|that)\b/.test(desc)) continue;
      let who = 'any'; desc = desc.replace(/^all /, '');
      if (/ you control$/.test(desc)){ who = 'you'; desc = desc.replace(/ you control$/, ''); }
      if (who === 'you' && b.pid !== pid) continue;
      if (m[1] && b.pid === pid && s.id === c.id) continue;
      if (!isCreatureCard(c) || !descOk(c.k, sing(desc.replace(/ creatures?$/, '') || 'creature'), {tok:c.tok, face:faceOf(c)})) continue;
      n += amt;
    }
  }
  return n;
}
{
  const hd = hitDefender;
  hitDefender = function(def, n, a, extra){
    const r = hd(def, n, a, extra);
    try {
      if (def && def.t === 'player' && def.pid !== MYPID && n > 0 && a){
        const pw = Math.max(1, (stats(a) || [1])[0]); const k = (a.n || 1) > 1 ? Math.max(1, Math.round(n / pw)) : 1; // a token stack: one instance per unblocked creature
        const tx = r21aKwN(a, 'toxic') * k, po = r21aKwN(a, 'poisonous') * k;
        if (tx){ sendRq(def.pid, 'psn', tx, cname(a)); log(`${cname(a)} (toxic): ${nameOf(def.pid)} gets ${tx} poison counter${tx === 1 ? '' : 's'}`); }
        if (po){ sendRq(def.pid, 'psn', po, cname(a)); log(`${cname(a)} (poisonous): ${nameOf(def.pid)} gets ${po} poison counter${po === 1 ? '' : 's'}`); }
      }
    } catch (e){ console.warn('r21a toxic', e); }
    return r;
  };
}

/* ---------- Counter model helpers: one place that reads/writes every kind of counter ---------- */
// c.cp (+1/+1) · c.cm (−1/−1) · c.co (loyalty on planeswalkers, defense on battles) · c.lore · c.nc[kind] (every named counter)
const R21A_KIND = k => { k = String(k || '').toLowerCase().trim(); return k === '+1/+1' ? 'cp' : (k === '-1/-1' || k === '−1/−1') ? 'cm' : k === 'lore' ? 'lore' : (k === 'loyalty' || k === 'defense') ? 'co' : k; };
const R21A_LABEL = k => ({cp:'+1/+1', cm:'−1/−1', lore:'lore', co:'loyalty'})[k] || k;
function r21aGet(c, kind){
  if (!c) return 0; const k = R21A_KIND(kind);
  if (k === 'cp' || k === 'cm' || k === 'lore') return c[k] || 0;
  if (k === 'co') return (isPW(c) || isBattle(c)) ? (c.co || 0) : ((c.nc || {}).loyalty || 0);
  return (c.nc || {})[k] || 0;
}
function r21aKinds(c){ // [[kind, n]…] for every kind of counter on c
  if (!c) return []; const out = [];
  ['cp', 'cm', 'lore'].forEach(k => { if ((c[k] || 0) > 0) out.push([k, c[k]]); });
  if ((isPW(c) || isBattle(c)) && (c.co || 0) > 0) out.push(['co', c.co]);
  for (const [k, v] of Object.entries(c.nc || {})) if (v > 0 && !(k === 'loyalty' && (isPW(c) || isBattle(c)))) out.push([k, v]);
  return out;
}
const r21aTotal = c => r21aKinds(c).reduce((a, x) => a + x[1], 0);
// change counters on MY card c by d (d<0 removes); put = goes through replacement effects (Hardened Scales …)
function r21aMod(c, kind, d, putter=MYPID){
  if (!c || !d) return 0; const k = R21A_KIND(kind);
  if (d > 0){
    if (k === 'cp' || k === 'cm' || k === 'lore') return modCounters(c, k, d, putter);
    if (k === 'co' && (isPW(c) || isBattle(c))){ c.co = (c.co || 0) + d; r21aEmitPut(c, 'co', d, putter); return d; }
    addNamed(c, k, d); if (KW_CTR.test(k)) c.ekwp = [...new Set([...(c.ekwp || []), k])]; return d;
  }
  const have = r21aGet(c, k); const n = Math.min(have, -d); if (!n) return 0;
  if (k === 'cp' || k === 'cm' || k === 'lore') c[k] = have - n;
  else if (k === 'co' && (isPW(c) || isBattle(c))) c.co = have - n;
  else { addNamed(c, k, -n); if (KW_CTR.test(k) && !r21aGet(c, k)) c.ekwp = (c.ekwp || []).filter(x => x !== k); }
  r21aRemoved(c, k, n);
  return -n;
}
// the same on any board: my cards directly, other players' cards by request
function r21aModAny(pid, c, kind, d, src){
  if (!c) return;
  if (pid === MYPID || pid == null){ const mine = S.bf.find(x => x.id === c.id) || c; return r21aMod(mine, kind, d); }
  sendRq(pid, 'r21c', d, src || 'counters', {tid:c.id, d:R21A_KIND(kind)});
}
function r21aEmitPut(c, k, n, putter){ try { if (c && n > 0 && S) c.r21pt = turnStr(); } catch {} try { if (S && n > 0 && k === 'cp' && (putter || MYPID) === MYPID && S.bf.includes(c) && isCreatureCard(c)){ if (!S.r21cpT || S.r21cpT.t !== turnStr()) S.r21cpT = {t:turnStr(), n:0}; S.r21cpT.n += n; } } catch {} try { if (S && n > 0 && S.bf.includes(c)) emit({type:'r21ctr', k:c.k, id:c.id, tok:c.tok ? 1 : 0, cnt:1, amt:n, x:k === 'cp' ? 1 : k === 'cm' ? 2 : k === 'lore' ? 3 : k === 'co' ? 4 : 5, dp:putter || MYPID}); } catch {} }
function r21aRemoved(c, k, n){
  // "when the last … counter is removed from ~" (suspend-like and vanishing-like cards handled here generically)
  try {
    if (!S || !S.bf.includes(c) || r21aGet(c, k)) return; const o = (faceOf(c)?.o || '').toLowerCase(); const nm = cname(c);
    const kn = R21A_LABEL(k);
    const re = new RegExp(`when the last ${kn.replace(/[+/]/g, m => '\\' + m)} counter is removed from (?:it|${nm.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|this [a-z]+), ([^\\n]+)`);
    const m = o.match(re); if (!m) return;
    const it = {sid:rid(6), o:nextO(), kind:'trigger', k:c.k, nm, txt:cap(m[1].trim()), srcId:c.id}; S.stk.push(it); S.pass = 's:' + it.sid; log(`trigger: ${nm} — the last ${kn} counter was removed`);
  } catch (e){ console.warn('r21a last', e); }
}
{
  // every +1/+1, −1/−1 and lore counter that lands on my permanents announces itself (for “whenever one or more counters are put on …”)
  const mc = modCounters;
  modCounters = function(c, kind, n, putter, owner){ const r = mc(c, kind, n, putter, owner); if (r > 0) r21aEmitPut(c, kind, r, putter == null ? MYPID : putter); return r; };
  const an = addNamed;
  addNamed = function(c, kind, n){ const r = an(c, kind, n); if (n > 0) r21aEmitPut(c, String(kind), n, UI.r21aPutter || MYPID); return r; };
  EV_TYPES.push('r21ctr', 'r21prolif');
  RQ_OPS.push('r21c', 'r21pc');
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'r21c'){ const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; if (c){ const kind = String(r.d || 'cp'); UI.r21aPutter = from; try { const n = r21aMod(single(c), kind, r.n, from); log(`${cname(c)} ${n >= 0 ? 'gets' : 'loses'} ${Math.abs(n)} ${R21A_LABEL(R21A_KIND(kind))} counter${Math.abs(n) === 1 ? '' : 's'} (${r.src || nameOf(from)})`); } finally { UI.r21aPutter = null; } commit(); } return; }
    if (r.op === 'r21pc'){ const kind = String(r.d || 'energy'); if (kind === 'poison'){ S.psn = Math.max(0, S.psn + r.n); log(`${r.n >= 0 ? 'gets' : 'loses'} ${Math.abs(r.n)} poison counter${Math.abs(r.n) === 1 ? '' : 's'} (${r.src || nameOf(from)}) → ${S.psn}`); } else addPC(kind, r.n); commit(); return; }
    if (r.op === 'ctr' && r.tid != null && r.d && !['cp', 'cm', 'co', 'lore'].includes(r.d)){ const c = S.bf.find(b => b.id === r.tid); if (c){ addNamed(single(c), String(r.d), r.n); log(`${cname(c)} gets ${r.n} ${r.d} counter${r.n === 1 ? '' : 's'} (${r.src || nameOf(from)})`); commit(); } return; }
    return ao(r, from);
  };
  // other players can see named counters and player counters (energy, experience, rad, ticket)
  const cpe = cardPublicExtra;
  cardPublicExtra = function(c){ const o = cpe(c); if (c && c.nc){ const e = Object.entries(c.nc).filter(([, v]) => v > 0).slice(0, 12); if (e.length) o.nc = Object.fromEntries(e); } return o; };
  const ps = publicState;
  publicState = function(){ const o = ps(); try { if (S && S.pc){ const e = Object.entries(S.pc).filter(([, v]) => v > 0).slice(0, 12); if (e.length) o.pc = Object.fromEntries(e); } } catch {} return o; };
  const ss = sanitizeState;
  sanitizeState = function(s){ const o = ss(s); try {
    const clean = v => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).slice(0, 12).filter(([k, n]) => /^[a-z +\/-]{1,24}$/i.test(k) && Number.isFinite(n)).map(([k, n]) => [k, clamp(n, 0, 9999)])) : undefined;
    if (o && s && Array.isArray(s.bf)) o.bf.forEach((c, i) => { const nc = clean(s.bf[i] && s.bf[i].nc); if (nc && Object.keys(nc).length) c.nc = nc; });
    if (o && s){ const pc = clean(s.pc); if (pc) o.pc = pc; }
  } catch {} return o; };
  // last-known counters: a permanent that left the battlefield still "had" its counters for abilities that ask (Hangarback Walker, The Ozolith …)
  const rs = reset;
  reset = function(c){
    try { if (c && c.id != null && (c.cp || c.cm || c.lore || (c.nc && Object.values(c.nc).some(v => v > 0)) || ((isPW(c) || isBattle(c)) && c.co))){
      UI.r21lki = UI.r21lki || new Map(); UI.r21lki.set(c.id, {id:c.id, k:c.k, cp:c.cp || 0, cm:c.cm || 0, lore:c.lore || 0, co:c.co || 0, nc:{...(c.nc || {})}, pw:isPW(c), t:Date.now()});
      if (UI.r21lki.size > 200) UI.r21lki.delete(UI.r21lki.keys().next().value); } } catch {}
    const r = rs(c); if (c){ c.nc = {}; c.lore = 0; c.ekwp = []; } return r;
  };
}
function r21aLki(id){ const e = UI.r21lki && UI.r21lki.get(id); if (!e) return null; const pw = e.pw; return {...e, nc:{...e.nc}, __pw:pw}; }
// which card does a phrase like "~", "it", "that creature" mean (live, or as it last existed)
function r21aRef(ref, ctx){
  ref = String(ref || '').trim(); const it = ctx && ctx.it;
  const live = (pid, id) => pid === MYPID || pid == null ? S.bf.find(x => x.id === id) : boardOf(pid).find(x => x.id === id);
  const self = () => { const c = ctx ? srcCardOf(ctx) : null; if (c && S.bf.includes(c)) return {c, pid:MYPID}; const l = ctx && ctx.srcId != null ? r21aLki(ctx.srcId) : null; return l ? {c:l, pid:MYPID, lki:true} : null; };
  const tgt = () => { const t = ctx && ctx.lastT && ctx.lastT[0]; if (!t || t.t !== 'card') return null; const x = live(t.pid, t.id); if (x) return {c:x, pid:t.pid}; const l = r21aLki(t.id); return l ? {c:l, pid:t.pid, lki:true} : null; };
  const evc = () => { if (!it || it.evId == null || (ctx && it.evId === ctx.srcId)) return null; const pid = it.evPid || MYPID; const x = live(pid, it.evId); if (x) return {c:x, pid}; const l = pid === MYPID ? r21aLki(it.evId) : null; return l ? {c:l, pid, lki:true} : null; };
  if (/^(~|this creature|this artifact|this enchantment|this land|this permanent|this vehicle|this spacecraft|this saga|him|her|itself)$/.test(ref)) return self();
  if (ref === 'it') return tgt() || evc() || self();
  if (/^(that creature|that permanent|that card|the exiled creature|that land|that artifact)$/.test(ref)) return tgt() || evc() || null;
  if (ref === 'the sacrificed creature' && ctx && ctx.sacd){ const l = r21aLki(ctx.sacd.id); return l ? {c:l, pid:MYPID, lki:true} : {c:ctx.sacd, pid:MYPID}; }
  if (/^(equipped|enchanted) (creature|permanent|land|artifact)$/.test(ref)){ const sc = ctx && srcCardOf(ctx); if (sc && sc.att){ const x = live(sc.att.pid, sc.att.id); if (x) return {c:x, pid:sc.att.pid}; } return null; }
  return null;
}

/* ---------- Counting counters: "for each +1/+1 counter on ~", "the number of time counters on it", "X, where X is the number of counters on ~" ---------- */
function r21aCount(p, ctx){
  let m; p = String(p || '').toLowerCase().trim().replace(/\.$/, '').replace(/^(?:the (?:total )?number of|each|the amount of) /, '');
  if ((m = p.match(/^(experience|energy|rad|ticket|poison) counters? you have$/))) return m[1] === 'poison' ? (S.psn || 0) : ((S.pc || {})[m[1]] || 0);
  if (/^\+1\/\+1 counters? you've put on creatures under your control this turn$/.test(p)) return S.r21cpT && S.r21cpT.t === turnStr() ? S.r21cpT.n : 0;
  if ((m = p.match(/^(?:(.+?) )?counters? (it|that creature|~) had on (?:it|them)$/))){ const r = (ctx && ctx.r21had) || r21aRef(m[2] === '~' ? '~' : 'that creature', ctx) || r21aRef('it', ctx); return r ? (m[1] ? r21aGet(r.c, m[1]) : r21aTotal(r.c)) : 0; }
  if (/^counters? removed this way$/.test(p)) return ctx && ctx.r21rem != null ? ctx.r21rem : 0;
  if ((m = p.match(/^(?:(.+?) )?counters? (?:put on (?:it|~|them) this way|moved this way)$/))) return ctx && ctx.r21put != null ? ctx.r21put : 0;
  if ((m = p.match(/^poison counters? (that player|target player|target opponent|your opponents|each opponent|all opponents|you) ha(?:s|ve)$/))){
    if (m[1] === 'you') return S.psn || 0;
    if (/opponents|each opponent/.test(m[1])) return opponents().reduce((a, o) => a + ((OPP.get(o.pid) || {}).psn || 0), 0);
    const pid = (ctx && ctx.lastT && ctx.lastT[0] && ctx.lastT[0].t === 'player' && ctx.lastT[0].pid) || (ctx && ctx.it && (ctx.it.evDp || ctx.it.evPid)); return pid === MYPID ? S.psn : ((OPP.get(pid) || {}).psn || 0);
  }
  if ((m = p.match(/^(?:(.+?) )?counters? (?:on|among) (?:(other )?(.+?) you control|permanents you control)$/))){
    const kind = m[1]; const desc = m[3] ? sing(m[3].replace(/ and /g, ' or ')) : ''; const sc = ctx && srcCardOf(ctx);
    return S.bf.filter(c => !c.fd && (!m[2] || c !== sc) && (!desc || /^permanents?$/.test(desc) || descOk(c.k, desc, {tok:c.tok}))).reduce((a, c) => a + (kind ? r21aGet(c, kind) : r21aTotal(c)), 0);
  }
  if ((m = p.match(/^(?:(.+?) )?counters? on (~|it|this creature|this artifact|this enchantment|this land|this permanent|this vehicle|this saga|him|her|that creature|that permanent|the sacrificed creature|the exiled creature|equipped creature|enchanted creature)$/))){
    if (m[1] && /\b(?:for each|with|and)\b/.test(m[1])) return null;
    const r = r21aRef(m[2], ctx); if (!r) return 0;
    return m[1] ? r21aGet(r.c, m[1]) : r21aTotal(r.c);
  }
  return null;
}
{
  const co = countOf;
  countOf = function(phrase, ctx){ try { const n = r21aCount(phrase, ctx); if (n != null) return n; } catch (e){ console.warn('r21a count', e); } return co(phrase, ctx); };
}

/* ---------- Sentences: double, move, remove, lose all, conditions on counters, last-known counters, poison maths ---------- */
const R21A_ONE = w => /^(?:another |up to one (?:other )?|a second )?target\b|^(~|it|that creature|that permanent|this [a-z]+|equipped creature|enchanted creature|him|her)$/.test(String(w || '').trim());
const R21A_OK = w => R21A_ONE(w) || /^(each of them|those creatures)$/.test(String(w || '').trim()) || /^each (other )?(?:creature|permanent|artifact|land|planeswalker|enchantment|[a-z]+ creature)( you control| your opponents control| an opponent controls)?$/.test(String(w || '').trim());
const R21A_N = w => { w = String(w || '').toLowerCase(); return w === 'a' || w === 'an' ? 1 : wn(w); };
const R21A_KINDW = "(\\+1\\/\\+1|-1\\/-1|[a-z]+(?: [a-z]+)?)"; // "+1/+1", "time", "double strike"
function r21aTgtCard(ctx){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (!t || t.t !== 'card') return null; const c = boardOf(t.pid).find(x => x.id === t.id); return c ? {c, pid:t.pid} : null; }
// resolve "target creature", "~", "it", "that creature", "each creature you control" → [{c, pid}]
async function r21aWho(who, ctx){
  who = String(who || '').trim();
  if (/^(?:another |up to one (?:other )?|a second )?target\b/.test(who)){ const r = r21aTgtCard(ctx); return r ? [r] : []; }
  if (who === 'each of them' || who === 'those creatures'){ return (ctx.lastT || []).filter(t => t.t === 'card').map(t => ({c:boardOf(t.pid).find(x => x.id === t.id), pid:t.pid})).filter(x => x.c); }
  if (/^each (other )?(.+?)( you control| your opponents control| an opponent controls)?$/.test(who)){
    const m = who.match(/^each (other )?(.+?)( you control| your opponents control| an opponent controls)?$/); const d = sing(m[2]); const sc = srcCardOf(ctx); const out = [];
    if (!m[3] || m[3] === ' you control') S.bf.forEach(c => { if (!c.fd && (!m[1] || !sc || c.id !== sc.id) && descOk(c.k, d, {tok:c.tok}) && (d !== 'creature' || isCreatureCard(c))) out.push({c, pid:MYPID}); });
    if (m[3] && m[3] !== ' you control' || !m[3]) for (const [pid, st] of OPP) (st.bf || []).forEach(c => { if (c.k && !c.fd && descOk(c.k, d, {tok:c.tok})) out.push({c, pid}); });
    return out;
  }
  const r = r21aRef(who, ctx); return r && !r.lki ? [r] : [];
}
async function doRound21APre(s, l, ctx){
  let m; const say = t => doSentence(cap(t), ctx);
  if (/^then /.test(l) && await doRound21APre(s.slice(5), l.slice(5), ctx)) return true;

  // modal bullets and ability words in front of a counter sentence: "• Put two +1/+1 counters on target creature", "Defense! — Put a shield counter on …"
  if (/\bcounters?\b/.test(l) && ((m = s.match(/^•\s*(.+)$/)) || (m = s.match(/^[A-Z][^—.]{0,40}!? — (.+)$/)))){ await doSentence(m[1], ctx); return true; }
  // "put a +1/+1 counter on her", "… on King Darien" (a short name)
  if ((m = l.match(/^put (.+? counters?) on (her|him|[a-z][a-z' -]+)$/)) && (/^(her|him)$/.test(m[2]) || (ctx.name && m[2].length >= 4 && ctx.name.toLowerCase().startsWith(m[2]) && m[2] !== ctx.name.toLowerCase()))){ await say(`Put ${m[1]} on ~`); return true; }
  // Forge of Heroes
  if ((m = l.match(/^put a \+1\/\+1 counter on it if it's a creature and a loyalty counter on it if it's a planeswalker$/))){
    const r = r21aRef('it', ctx); if (!r || r.lki) return true; if (isCreatureCard(r.c)) r21aModAny(r.pid, r.c, 'cp', 1, ctx.name); if (isPW(r.c)) r21aModAny(r.pid, r.c, 'co', 1, ctx.name); commit(); return true;
  }
  // "for each hatchling counter on it, create a 1/1 …", "for each blight counter on it, each opponent loses 4 life unless …"
  if ((m = l.match(/^for each ((?:[a-z+\/1-]+ )?counters? (?:on (?:it|~|this [a-z]+)|removed this way)), (.+)$/))){
    const n = countOf(m[1], ctx); if (n == null) return false; const rest = s.slice(s.length - m[2].length);
    if (!n){ log(`${ctx.name}: no counters — nothing happens`); return true; }
    for (let i = 0; i < Math.min(n, 50); i++) await say(rest); return true;
  }
  // "if there are thirty or more counters among artifacts and creatures you control, …"
  if ((m = l.match(/^if there are (\w+) or more ((?:[a-z+\/1-]+ )?counters? among .+? you control), (.+)$/))){
    const n = countOf(m[2], ctx); if (n == null) return false; const need = R21A_N(m[1]) || 0;
    if (n >= need) await say(s.slice(s.length - m[3].length)); else log(`${ctx.name}: only ${n} counters (needs ${need})`); return true;
  }
  // "if a counter was put on ~ this turn, …"
  if ((m = l.match(/^if a counter was put on (~|it) this turn, (.+)$/))){
    const r = r21aRef(m[1], ctx); const ok = r && r.c.r21pt === turnStr();
    if (ok) await say(s.slice(s.length - m[2].length)); else log(`${ctx.name}: no counter was put on it this turn`); return true;
  }
  // ---- doubling ----
  if ((m = l.match(new RegExp(`^double the number of ${R21A_KINDW} counters on (.+)$`))) && !/each kind/.test(m[1])){
    if (!R21A_OK(m[2])) return false; const kind = m[1]; const list = await r21aWho(m[2], ctx); let tot = 0;
    for (const {c, pid} of list){ const n = r21aGet(c, kind); if (n){ r21aModAny(pid, c, kind, n, ctx.name); tot += n; } }
    log(`${ctx.name}: doubled ${R21A_LABEL(R21A_KIND(kind))} counters${list.length ? ' on ' + list.map(x => cname(x.c)).join(', ') : ''}${tot ? '' : ' (there were none)'}`); commit(); return true;
  }
  if ((m = l.match(/^double the number of each kind of counter on (.+)$/))){
    if (!R21A_OK(m[1])) return false; const list = await r21aWho(m[1], ctx); for (const {c, pid} of list) for (const [k, n] of r21aKinds(c)) r21aModAny(pid, c, k, n, ctx.name);
    log(`${ctx.name}: doubled every kind of counter on ${list.map(x => cname(x.c)).join(', ') || 'nothing'}`); commit(); return true;
  }
  if ((m = l.match(/^double the number of each kind of counter (you|target player|each player) ha(?:s|ve)$/))){
    const me = () => { if (S.psn) S.psn += S.psn; for (const [k, v] of Object.entries(S.pc || {})) if (v > 0) addPC(k, v); };
    if (m[1] === 'you') me(); else { const t = m[1] === 'target player' ? (ctx.tgts ? nextTargets(ctx) : [])[0] : null; const pids = m[1] === 'each player' ? players().map(p => p.pid) : t ? [t.pid] : [];
      for (const pid of pids){ if (pid === MYPID){ me(); continue; } const o = OPP.get(pid) || {}; if (o.psn) sendRq(pid, 'r21pc', o.psn, ctx.name, {d:'poison'}); for (const [k, v] of Object.entries(o.pc || {})) if (v > 0) sendRq(pid, 'r21pc', v, ctx.name, {d:k}); } }
    log(`${ctx.name}: doubled each kind of counter`); commit(); return true;
  }

  // ---- distributing: the counters are split as evenly as possible among the chosen targets (first targets get the extra) ----
  if ((m = l.match(new RegExp(`^distribute (two|three|four|five|six|x|\\d+) ${R21A_KINDW.replace('[a-z]+(?: [a-z]+)?', '[a-z]+')} counters among (?:up to (?:one|two|three|four|five|x|\\d+)|one or two|one, two, or three|one or more|any number of) target (creatures?|permanents?|creatures? you control|creatures? and\/or vehicles?)(?: you control)?$`)))){
    const N = m[1] === 'x' ? ((ctx.it && ctx.it.x) || 0) : R21A_N(m[1]) || 0; const kind = m[2]; const list = []; let g;
    while (ctx.tgts && (g = nextTargets(ctx)).length){ for (const t of g){ if (t.t !== 'card') continue; const c = boardOf(t.pid).find(x => x.id === t.id); if (c && !list.some(x => x.c === c)) list.push({c, pid:t.pid}); } if (list.length >= N) break; }
    if (!list.length || !N){ log(`${ctx.name}: no targets to distribute counters among`); return true; }
    const per = list.slice(0, N).map((x, i, a) => [x, Math.floor(N / a.length) + (i < N % a.length ? 1 : 0)]);
    for (const [x, n] of per) if (n) r21aModAny(x.pid, x.c, kind, n, ctx.name);
    log(`${ctx.name}: distributed ${N} ${R21A_LABEL(R21A_KIND(kind))} counters — ${per.map(([x, n]) => `${n} on ${cname(x.c)}`).join(', ')}`); commit(); return true;
  }
  if ((m = l.match(/^proliferate x times$/))){ const n = (ctx.it && ctx.it.x) || 0; for (let i = 0; i < n; i++) await say('Proliferate'); return true; }
  if ((m = l.match(/^remove all ([a-z+\/1-]+ )?counters from (all permanents|all creatures|each permanent|each creature)$/))){
    const kind = m[1] ? m[1].trim() : null; const cre = /creature/.test(m[2]); let n = 0;
    for (const b of boardsAll()) for (const c of b.bf){ if (!c.k || c.fd || (cre && !isCreatureCard(c))) continue; for (const [k, v] of r21aKinds(c)){ if (kind && k !== R21A_KIND(kind)) continue; r21aModAny(b.pid, c, k, -v, ctx.name); n += v; } }
    ctx.r21rem = n; log(`${ctx.name}: removed ${n} ${kind || ''} counters from ${m[2]}`); commit(); return true;
  }
  // ---- moving ----
  if ((m = l.match(new RegExp(`^(?:you may )?move (a|an|one|two|three|all|any number of|x|\\d+) ${R21A_KINDW.replace('[a-z]+(?: [a-z]+)?', '[a-z]+')} counters? from (.+?) onto (.+)$`))) || (m = l.match(/^(?:you may )?move (a|an|one|two|three|all|any number of|x|\d+) counters? from (.+?) onto (.+)$/))){
    if (m[1] === 'any number of') m[1] = 'all';
    const anyKind = m.length === 4; const q = m[1]; const kind = anyKind ? null : m[2]; const fromW = anyKind ? m[2] : m[3]; const toW = anyKind ? m[3] : m[4];
    if (!R21A_ONE(fromW) || !R21A_ONE(toW)) return false;
    const from = (await r21aWho(fromW, ctx))[0]; const to = (await r21aWho(toW, ctx))[0];
    if (!from || !to){ log(`${ctx.name}: nothing to move counters from/to`); return true; }
    let kinds = kind ? [[R21A_KIND(kind), r21aGet(from.c, kind)]] : r21aKinds(from.c);
    if (!kind && q !== 'all' && kinds.length > 1){ // which kind — the mover's choice
      const pref = from.pid === MYPID ? ['cm'] : ['cp', 'co'];
      kinds.sort((a, b) => (pref.includes(b[0]) ? 1 : 0) - (pref.includes(a[0]) ? 1 : 0));
      if (kinds.length > 1 && !UI.dry){ const v = await askChoice(`${ctx.name}: move which kind of counter?`, kinds.map(([k, n]) => ({label:`${R21A_LABEL(k)} (${n})`, value:k}))); if (v) kinds = kinds.filter(x => x[0] === v); }
      kinds = kinds.slice(0, 1);
    }
    let moved = 0;
    for (const [k, have] of kinds){ const n = q === 'all' ? have : Math.min(have, q === 'x' ? ((ctx.it && ctx.it.x) || 0) : R21A_N(q) || 1); if (!n) continue;
      r21aModAny(from.pid, from.c, k, -n, ctx.name); r21aModAny(to.pid, to.c, k, n, ctx.name); moved += n; }
    ctx.r21put = moved; log(`${ctx.name}: moved ${moved} counter${moved === 1 ? '' : 's'} from ${cname(from.c)} onto ${cname(to.c)}`); commit(); return true;
  }
  if ((m = l.match(/^(?:you may )?move all counters from (.+?) onto (.+)$/)) && R21A_ONE(m[1]) && R21A_ONE(m[2])){
    const from = (await r21aWho(m[1], ctx))[0]; const to = (await r21aWho(m[2], ctx))[0]; if (!from || !to) return true;
    let n = 0; for (const [k, v] of r21aKinds(from.c)){ r21aModAny(from.pid, from.c, k, -v, ctx.name); r21aModAny(to.pid, to.c, k, v, ctx.name); n += v; }
    log(`${ctx.name}: moved ${n} counters onto ${cname(to.c)}`); commit(); return true;
  }

  // ---- removing ----
  if ((m = l.match(new RegExp(`^(?:you may )?remove (a|an|one|two|three|four|five|all|x|\\d+|up to (?:one|two|three|four|five|x|\\d+)) ${R21A_KINDW.replace('[a-z]+(?: [a-z]+)?', '[a-z]+')}?\\s?counters? from (.+)$`))) && !/^each of any number/.test(m[3])){
    let q = m[1]; const kind = m[2] && m[2] !== 'counter' ? m[2] : null; const who = m[3]; if (!R21A_OK(who)) return false;
    const list = await r21aWho(who, ctx); let tot = 0;
    for (const {c, pid} of list){
      let kinds = kind ? [[R21A_KIND(kind), r21aGet(c, kind)]] : r21aKinds(c);
      // best for the remover: their own bad counters first, an opponent's good counters first
      const bad = k => k === 'cm' || k === 'stun' || k === 'time' && false;
      kinds.sort((a, b) => pid === MYPID ? (bad(b[0]) - bad(a[0])) : (bad(a[0]) - bad(b[0])));
      let left = q === 'all' ? Infinity : q === 'x' ? ((ctx.it && ctx.it.x) || 0) : R21A_N(q.replace(/^up to /, '')) || 1;
      for (const [k, have] of kinds){ if (left <= 0) break; const n = Math.min(have, left); if (!n) continue; r21aModAny(pid, c, k, -n, ctx.name); left -= n; tot += n; }
    }
    ctx.r21rem = tot; log(`${ctx.name}: removed ${tot} counter${tot === 1 ? '' : 's'}${list.length ? ' from ' + list.map(x => cname(x.c)).join(', ') : ''}`); commit(); return true;
  }
  if ((m = l.match(/^(each opponent|target player|target opponent|each player|that player) loses all counters$/))){
    let pids = /each opponent/.test(m[1]) ? opponents().map(p => p.pid) : m[1] === 'each player' ? players().map(p => p.pid) : [];
    if (/^target/.test(m[1])){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (t) pids = [t.pid]; } if (m[1] === 'that player'){ const p = ctx.it && (ctx.it.evDp || ctx.it.evPid); if (p) pids = [p]; }
    for (const pid of pids){
      if (pid === MYPID){ S.psn = 0; for (const k of Object.keys(S.pc || {})) S.pc[k] = 0; continue; }
      const o = OPP.get(pid) || {}; if (o.psn) sendRq(pid, 'r21pc', -o.psn, ctx.name, {d:'poison'}); for (const [k, v] of Object.entries(o.pc || {})) if (v > 0) sendRq(pid, 'r21pc', -v, ctx.name, {d:k});
    }
    log(`${ctx.name}: ${pids.map(nameOf).join(', ') || 'nobody'} lose${pids.length === 1 ? 's' : ''} all counters`); commit(); return true;
  }

  // ---- conditions on counters ----
  const cond = async (ok, rest, why) => { if (ok) await say(rest); else log(`${ctx.name}: ${why} — nothing happens`); return true; };
  if ((m = l.match(new RegExp(`^(?:if|as long as) (~|it) has (?:(no|one or more|a|an|\\w+ or more|exactly \\w+|fewer than \\w+) )?${R21A_KINDW}?\\s?counters? on it, (.+)$`)))){
    const r = r21aRef(m[1], ctx); const have = r ? (m[3] && m[3] !== 'counter' ? r21aGet(r.c, m[3]) : r21aTotal(r.c)) : 0; const q = m[2] || 'one or more';
    const ok = q === 'no' ? have === 0 : /^(one or more|a|an)$/.test(q) ? have >= 1 : /or more$/.test(q) ? have >= (R21A_N(q.split(' ')[0]) || 0) : /^exactly/.test(q) ? have === R21A_N(q.split(' ')[1]) : have < (R21A_N(q.split(' ')[2]) || 0);
    return cond(ok, s.slice(s.length - m[4].length), `it has ${have} counter${have === 1 ? '' : 's'}`);
  }
  if ((m = l.match(new RegExp(`^if there are (no|one or more|\\w+ or more) ${R21A_KINDW}?\\s?counters? on (~|it|this \\w+), (.+)$`)))){
    const r = r21aRef(m[3], ctx); const have = r ? (m[2] ? r21aGet(r.c, m[2]) : r21aTotal(r.c)) : 0; const q = m[1];
    const ok = q === 'no' ? have === 0 : q === 'one or more' ? have >= 1 : have >= (R21A_N(q.split(' ')[0]) || 0);
    return cond(ok, s.slice(s.length - m[4].length), `${have} counter${have === 1 ? '' : 's'}`);
  }
  if ((m = l.match(/^if (?:it|that creature) had (?:(no|one or more|a|an) )?([a-z+\/1-]+ )?counters? on it, (.+)$/))){
    const r = r21aRef('that creature', ctx) || r21aRef('it', ctx); const have = r ? (m[2] ? r21aGet(r.c, m[2].trim()) : r21aTotal(r.c)) : 0;
    ctx.r21had = r; return cond(m[1] === 'no' ? have === 0 : have > 0, s.slice(s.length - m[3].length), `it had ${have} counter${have === 1 ? '' : 's'}`);
  }
  if ((m = l.match(/^if (an opponent|target opponent|that player|each opponent) has (\w+) or more poison counters, (.+)$/))){
    const need = R21A_N(m[2]) || 0; const ok = m[1] === 'an opponent' ? opponents().some(o => ((OPP.get(o.pid) || {}).psn || 0) >= need) : (() => { const pid = ctx.it && (ctx.it.evDp || ctx.it.evPid); return pid && ((OPP.get(pid) || {}).psn || 0) >= need; })();
    return cond(ok, s.slice(s.length - m[3].length), `no opponent has ${need}+ poison`);
  }

  // ---- counters a card had when it left: "put its counters on target creature", "put those counters on ~" ----
  if ((m = l.match(/^(?:you may )?put (its|those|that creature's|~'s|his|her) counters on (.+)$/))){
    const from = ctx.r21had || (m[1] === "~'s" ? r21aRef('~', ctx) : (r21aRef('that creature', ctx) || r21aRef('it', ctx)));
    if (!R21A_ONE(m[2])) return false; const to = (await r21aWho(m[2], ctx))[0];
    if (!from || !to){ log(`${ctx.name}: no counters to put`); return true; }
    let n = 0; const live = !from.lki && S.bf.includes(from.c) && from.c !== to.c;
    for (const [k, v] of r21aKinds(from.c)){ if (live) r21aModAny(from.pid, from.c, k, -v, ctx.name); r21aModAny(to.pid, to.c, k, v, ctx.name); n += v; }
    log(`${ctx.name}: put ${n} counter${n === 1 ? '' : 's'} on ${cname(to.c)}`); commit(); return true;
  }

  // ---- "choose a counter on target permanent or player" → "give that permanent or player another counter of that kind" (Animation Module, Ichormoon Gauntlet) ----
  if ((m = l.match(/^choose a counter on (target permanent(?: or player)?|target creature|target permanent you control)$/))){
    const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; ctx.r21sel = null; if (!t){ return true; }
    let kinds = [];
    if (t.t === 'player'){ const psn = t.pid === MYPID ? S.psn : ((OPP.get(t.pid) || {}).psn || 0); const pc = t.pid === MYPID ? (S.pc || {}) : ((OPP.get(t.pid) || {}).pc || {}); kinds = [...(psn ? [['poison', psn]] : []), ...Object.entries(pc).filter(([, v]) => v > 0)]; }
    else { const c = boardOf(t.pid).find(x => x.id === t.id); kinds = c ? r21aKinds(c) : []; }
    if (!kinds.length){ log(`${ctx.name}: there are no counters there`); return true; }
    let k = kinds[0][0];
    if (kinds.length > 1){ const v = await askChoice(`${ctx.name}: choose a kind of counter`, kinds.map(([kk, n]) => ({label:`${R21A_LABEL(kk)} (${n})`, value:kk}))); if (v) k = v; }
    ctx.r21sel = {t, k}; return true;
  }
  if ((m = l.match(/^(?:give that permanent or player another counter of that kind|put an additional counter of that kind on that permanent|give that permanent another counter of that kind)$/))){
    const sel = ctx.r21sel; if (!sel) return true; const {t, k} = sel;
    if (t.t === 'player'){ if (t.pid === MYPID){ if (k === 'poison') S.psn++; else addPC(k, 1); } else sendRq(t.pid, k === 'poison' ? 'psn' : 'r21pc', 1, ctx.name, {d:k}); }
    else { const c = boardOf(t.pid).find(x => x.id === t.id); if (c) r21aModAny(t.pid, c, k, 1, ctx.name); }
    log(`${ctx.name}: one more ${R21A_LABEL(k)} counter`); commit(); return true;
  }
  if ((m = l.match(/^(?:you may )?gain that much life$/))){ const n = (ctx.it && ctx.it.evN) || 0; if (n) gainLife(n, ctx.name); commit(); return true; }
  // ---- player counters ----
  if ((m = l.match(/^(?:you )?get (a|an|one|two|three|four|five|x|\d+) (experience|energy|rad|ticket|poison) counters?$/))){ const n = m[1] === 'x' ? (ctx.it && ctx.it.x) || 0 : R21A_N(m[1]) || 1; if (m[2] === 'poison'){ S.psn += n; log(`gets ${n} poison → ${S.psn}`); } else addPC(m[2], n); commit(); return true; }
  if ((m = l.match(/^if target player has fewer than (\w+) poison counters, they get a number of poison counters equal to the difference$/))){
    const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (!t) return true; const need = R21A_N(m[1]) || 0; const have = t.pid === MYPID ? S.psn : ((OPP.get(t.pid) || {}).psn || 0); const d = need - have;
    if (d > 0){ if (t.pid === MYPID) S.psn += d; else sendRq(t.pid, 'psn', d, ctx.name); log(`${ctx.name}: ${nameOf(t.pid)} gets ${d} poison counters (to ${need})`); } else log(`${ctx.name}: ${nameOf(t.pid)} already has ${have} poison`); commit(); return true;
  }
  if ((m = l.match(/^(target player|each opponent|target opponent) gets (a|an|one|two|three|\d+) (rad|poison|energy) counters? if they don't have any \3 counters$/))){
    const n = R21A_N(m[2]) || 1; let pids = m[1] === 'each opponent' ? opponents().map(p => p.pid) : []; if (/^target/.test(m[1])){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (t) pids = [t.pid]; }
    for (const pid of pids){ const have = pid === MYPID ? (m[3] === 'poison' ? S.psn : (S.pc || {})[m[3]] || 0) : (m[3] === 'poison' ? (OPP.get(pid) || {}).psn : ((OPP.get(pid) || {}).pc || {})[m[3]]) || 0;
      if (have) { log(`${ctx.name}: ${nameOf(pid)} already has ${m[3]} counters`); continue; }
      if (pid === MYPID){ if (m[3] === 'poison') S.psn += n; else addPC(m[3], n); } else sendRq(pid, m[3] === 'poison' ? 'psn' : 'r21pc', n, ctx.name, {d:m[3]}); log(`${ctx.name}: ${nameOf(pid)} gets ${n} ${m[3]} counters`); }
    commit(); return true;
  }
  if ((m = l.match(/^(each opponent|target player|target opponent|that player|you) gets? a number of (poison|rad|energy|experience) counters equal to (.+)$/))){
    const n = countOf(m[3], ctx); if (n == null) return false;
    let pids = m[1] === 'each opponent' ? opponents().map(p => p.pid) : m[1] === 'you' ? [MYPID] : []; if (/^target/.test(m[1])){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (t) pids = [t.pid]; } if (m[1] === 'that player'){ const p = ctx.it && (ctx.it.evDp || ctx.it.evPid); if (p) pids = [p]; }
    if (n > 0) for (const pid of pids){ if (pid === MYPID){ if (m[2] === 'poison') S.psn += n; else addPC(m[2], n); } else sendRq(pid, m[2] === 'poison' ? 'psn' : 'r21pc', n, ctx.name, {d:m[2]}); }
    log(`${ctx.name}: ${pids.map(nameOf).join(', ') || 'nobody'} get${pids.length === 1 ? 's' : ''} ${n} ${m[2]} counter${n === 1 ? '' : 's'}`); commit(); return true;
  }
  if ((m = l.match(/^each creature your opponents control gets -1\/-1 until end of turn for each poison counter its controller has$/))){
    for (const [pid, st] of OPP){ const n = st.psn || 0; if (!n) continue; (st.bf || []).forEach(c => { if (c.k && isCreatureCard(c)) applyTo({t:'card', pid, id:c.id, k:c.k}, {op:'pump', src:ctx.name, f:{p:-n, t:-n}}); }); log(`${ctx.name}: ${nameOf(pid)}'s creatures get -${n}/-${n}`); }
    commit(); return true;
  }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound21APre(s, l, ctx)) return; return ds(s0, ctx); };
}

/* ---------- Proliferate: automatic (the choices that help you), every kind of counter, players' counters too, Tekuthal doubling ---------- */
STATIC_RULES.push([/^if you would proliferate, proliferate twice instead$/, m => ({kind:'r21prolif2', who:'you'})]);
const R21A_BAD = new Set(['cm', 'stun', 'doom', 'blight', 'slime', 'bounty', 'hit', 'vow', 'decayed', 'void', 'rust', 'corpse_bad']);
const R21A_PBAD = new Set(['poison', 'rad']);
proliferate = async function(name){
  const times = Math.pow(2, rulesOn('r21prolif2').length);
  for (let i = 0; i < times; i++){
    const done = [];
    for (const b of boardsAll()) for (const c of b.bf){
      if (!c.k || c.fd) continue; const ks = r21aKinds(c); if (!ks.length) continue;
      const mine = b.pid === MYPID; const bad = ks.filter(([k]) => R21A_BAD.has(k) || (k === 'co' && isBattle(c))).length; const good = ks.length - bad;
      if (mine ? good <= bad : bad <= good) continue;
      for (const [k] of ks){ if (mine) r21aMod(c, k, 1); else sendRq(b.pid, 'r21c', 1, name, {tid:c.id, d:k}); }
      done.push(`${mine ? '' : nameOf(b.pid) + "'s "}${cname(c)}`);
    }
    for (const p of players()){
      const psn = p.me ? S.psn : ((OPP.get(p.pid) || {}).psn || 0); const pc = p.me ? (S.pc || {}) : ((OPP.get(p.pid) || {}).pc || {});
      const ks = [...(psn > 0 ? [['poison', psn]] : []), ...Object.entries(pc).filter(([, v]) => v > 0)]; if (!ks.length) continue;
      const bad = ks.filter(([k]) => R21A_PBAD.has(k)).length, good = ks.length - bad;
      if (p.me ? good <= bad : bad <= good) continue;
      for (const [k] of ks){ if (p.me){ if (k === 'poison') S.psn += playerCounterMod(1, MYPID); else addPC(k, 1); } else if (k === 'poison') sendRq(p.pid, 'psn', 1, name); else sendRq(p.pid, 'r21pc', 1, name, {d:k}); }
      done.push(p.me ? 'you' : p.nm);
    }
    log(`${name}: proliferated${times > 1 ? ` (${i + 1}/${times})` : ''} — ${done.join(', ') || 'nothing to proliferate'}`);
    try { emit({type:'r21prolif', k:null, id:0, cnt:1}); } catch {}
    commit();
  }
};

/* ---------- Triggers: counters being put on permanents, proliferating ---------- */
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){
    const r = ct(w, c); if (r || w === 'at') return r; let m;
    const kcode = k => { k = String(k || '').trim(); return !k ? 0 : k === '+1/+1' ? 1 : k === '-1/-1' ? 2 : 5; };
    if (/^you proliferate$/.test(c)) return {ev:'r21prolif', subj:'any', ctl:'you', desc:''};
    if ((m = c.match(/^(?:one or more|a|an) (\+1\/\+1 |-1\/-1 |[a-z]+ )?counters? (?:is|are) put on (~|a creature you control|another creature you control|another non-[a-z]+ creature you control|a creature|a permanent you control|a creature an opponent controls|a creature you don't control)$/))){
      const sj = subjOf(m[2].replace(/^another non-([a-z]+) creature/, 'another non$1 creature')); if (!sj) return null;
      if (/non-?[a-z]+ creature/.test(m[2])){ const nm = m[2].match(/non-([a-z]+)/)[1]; sj.desc = 'creature'; sj.r21not = nm; }
      return {ev:'r21ctr', ...sj, r21k:kcode(m[1])};
    }
    if ((m = c.match(/^you put one or more (\+1\/\+1 |-1\/-1 )?counters on (~|a creature|a permanent|a permanent or player|a creature you don't control|another creature you control|a creature you control)$/))){
      const sj = m[2] === '~' ? {subj:'self', ctl:'you', desc:''} : m[2] === 'a creature' ? {subj:'any', ctl:'any', desc:'creature'} : /permanent/.test(m[2]) ? {subj:'any', ctl:'any', desc:'', r21pl:/or player/.test(m[2])} : subjOf(m[2]);
      if (!sj) return null; if (m[2] === "a creature you don't control"){ sj.ctl = 'opp'; sj.desc = 'creature'; }
      return {ev:'r21ctr', ...sj, r21k:kcode(m[1]), r21me:true};
    }
    return null;
  };
  const sm = subjMatch;
  subjMatch = function(t, src, ev, pid){
    if (ev.type === 'r21prolif') return pid === MYPID;
    if (ev.type === 'r21ctr'){
      if (!ev.k && !t.r21pl) return false; // counters put on a player
      if (!ev.k) return t.r21me ? ev.dp === MYPID : true;
      if (t.r21k && (ev.x || 0) !== t.r21k) return false;
      if (t.r21me && ev.dp !== MYPID) return false;
      if (t.r21not && ev.k && new RegExp('\\b' + t.r21not + '\\b', 'i').test(info(ev.k)?.t || '')) return false;
      if (t.desc === 'creature' && ev.k && !/Creature/.test(info(ev.k)?.t || '') && !(pid === MYPID && S.bf.some(b => b.id === ev.id && isCreatureCard(b)))) return false;
      const t2 = t.desc === 'creature' ? {...t, desc:''} : t; return sm(t2, src, ev, pid);
    }
    return sm(t, src, ev, pid);
  };
}

/* ---------- State triggers on counters: "When ~ has twenty or more charge counters on it", "When the twelfth hour counter is put on ~" ---------- */
const R21A_STC = new Map();
function r21aStateTrigs(k){
  if (R21A_STC.has(k)) return R21A_STC.get(k); const f = info(k); if (!f) return []; const out = []; R21A_STC.set(k, out);
  for (const line of tname(f.o || '', f.n).split('\n')){
    let m = line.match(/^When (?:~ has|there are) ([\d,]+|\w+) or more ([a-z+\/1-]+) counters on (?:it|~), (.+)$/i);
    if (m){ out.push({need:+String(m[1]).replace(/,/g, '') || R21A_N(m[1]) || 1, kind:m[2].toLowerCase(), eff:m[3], raw:line}); continue; }
    m = line.match(/^When the (\w+?)(?:st|nd|rd|th) ([a-z]+) counter is put on ~, (.+)$/i);
    if (m){ const ord = {first:1, second:2, third:3, fourth:4, fifth:5, sixth:6, seventh:7, eighth:8, ninth:9, tenth:10, eleventh:11, twelfth:12}[m[1].toLowerCase() + (/^(fir|seco|thi)$/i.test(m[1]) ? '' : 'th')] || {first:1, second:2, third:3, twelf:12, eleven:11, ten:10, nin:9, eigh:8, seven:7, six:6, fif:5, four:4}[m[1].toLowerCase()]; if (ord) out.push({need:ord, kind:m[2].toLowerCase(), eff:m[3], raw:line}); }
  }
  return out;
}
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){ const r = ct(w, c); if (r) return r; if (w === 'when' && (/^(?:~ has|there are) (?:[\d,]+|\w+) or more [a-z+\/1-]+ counters on (?:it|~)$/.test(c) || /^the \w+ [a-z]+ counter is put on ~$/.test(c))) return {ev:'r21state', subj:'self', ctl:'you', desc:''}; return r; };
  const cm = commit;
  commit = function(...a){
    try { if (S && !UI.dry && !UI.r21stBusy){ UI.r21stBusy = true;
      for (const c of S.bf){ if (c.fd || !c.k) continue; const ts = r21aStateTrigs(c.k); if (!ts.length) continue;
        for (const t of ts){ const have = r21aGet(c, t.kind); const key = t.raw; c.r21st = c.r21st || {};
          if (have >= t.need && !c.r21st[key]){ c.r21st[key] = 1; const it = {sid:rid(6), o:nextO(), kind:'trigger', k:c.k, nm:cname(c), txt:t.eff, srcId:c.id}; S.stk.push(it); S.pass = 's:' + it.sid; log(`trigger: ${cname(c)} — ${have} ${t.kind} counters`); }
          else if (have < t.need && c.r21st[key]) delete c.r21st[key]; } }
      UI.r21stBusy = false; } } catch (e){ UI.r21stBusy = false; console.warn('r21a state', e); }
    return cm(...a);
  };
}

/* ---------- Winding Constrictor-style "you get that many plus one", Solemnity ---------- */
STATIC_RULES.push([/^if you would get one or more counters, you get that many plus one of each of those kinds of counters instead$/, m => ({kind:'r21getPlus', who:'you'})]);
STATIC_RULES.push([/^players can't get counters$/, m => ({kind:'r21noPC', who:'all'})]);
STATIC_RULES.push([/^counters can't be put on artifacts, creatures, enchantments, or lands$/, m => ({kind:'r21noCtr', who:'all'})]);
{
  const ap = addPC;
  addPC = function(kind, n){ if (n > 0 && S){ if (rulesOn('r21noPC').length){ log(`no ${kind} counters (players can't get counters)`); return; } n += rulesOn('r21getPlus').length; } return ap(kind, n); };
  const pcm = playerCounterMod;
  playerCounterMod = function(n, putter){ let r = pcm(n, putter); if (r > 0 && S){ if (rulesOn('r21noPC').length) return 0; r += rulesOn('r21getPlus').length; } return r; };
  const blocked = c => S && rulesOn('r21noCtr').length && /\b(Artifact|Creature|Enchantment|Land)\b/.test(typeOf(c) || '');
  const mc = modCounters;
  modCounters = function(c, kind, n, putter, owner){ if (n > 0 && c && blocked(c)){ log(`counters can't be put on ${cname(c)}`); return 0; } return mc(c, kind, n, putter, owner); };
  const an = addNamed;
  addNamed = function(c, kind, n){ if (n > 0 && c && blocked(c)){ log(`counters can't be put on ${cname(c)}`); return; } return an(c, kind, n); };
}

// putting counters on players announces itself too (All Will Be One: "Whenever you put one or more counters on a permanent or player")
{
  const sr = sendRq;
  sendRq = function(pid, op, n, src, extra){ const r = sr(pid, op, n, src, extra); try { if (S && n > 0 && ['psn', 'pctr', 'rad', 'r21pc', 'pois2'].includes(op) && !(op === 'r21pc' && extra && extra.d && /^(energy|experience|ticket)$/.test(extra.d) && false)) emit({type:'r21ctr', k:null, id:0, cnt:1, amt:n, x:6, dp:MYPID}); } catch {} return r; };
}
