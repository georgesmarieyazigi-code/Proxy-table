/* ===================== Rules engine — round 24 helper L: copy effects (rule 707) =====================
   Copiable values (707.2) are carried by the card key. A copy with exceptions (707.9) gets a derived key
   "<base key>|CPY:<encoded exceptions>", built on demand by deriveFace on every client, so another player's
   screen shows exactly the same copy (and the DICT entry is also published with my cards).
   - copies of copies: the copied object's current key already includes its own copy effects and exceptions (707.3)
   - face-down permanents copy as a nameless 2/2 (707.2a); a transformed DFC copies the face that is up
   - "becomes a copy of … until end of turn" keeps the earlier key and puts it back when the turn ends
   - "enter as a copy" works however the permanent enters (cast, played land, reanimated, flickered)
   - a copy of a permanent spell resolves into a token (707.10f / 111.12) */
const CPY = {};
function cpyEnc(o){ return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-'); }
function cpyDec(s){ try { let b = String(s).replace(/_/g, '/').replace(/-/g, '+'); while (b.length % 4) b += '='; return JSON.parse(decodeURIComponent(escape(atob(b)))); } catch { return null; } }
const CPY_FD = 'CPY:fd';
const CPY_COL = {white:'W', blue:'U', black:'B', red:'R', green:'G'};
const CPY_CT = ['Artifact', 'Battle', 'Creature', 'Enchantment', 'Instant', 'Kindred', 'Land', 'Planeswalker', 'Sorcery', 'Tribal'];
const CPY_SUPER = ['Legendary', 'Basic', 'Snow', 'World', 'Ongoing'];
const CPY_KW = /^(flying|haste|vigilance|myriad|changeling|defender|trample|menace|lifelink|deathtouch|reach|hexproof|indestructible|first strike|double strike|shroud|flash|vanishing \d+|crew \d+|ward \{\d+\}|persist|undying)/i;
// keys stay short (other players' boards keep 80 characters of a key): <root key>|CPY:<hash>; the registry knows how to build it,
// and the built face is published with my other cards so every client can show it
CPY.reg = {}; CPY.made = new Set();
function cpyHash(str){ let h1 = 0x811c9dc5, h2 = 0x01000193 ^ str.length; for (let i = 0; i < str.length; i++){ const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519) ^ (h2 >>> 13); } return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36); }
function cpyKey(base, ex){
  if (!base) return base; if (!ex || !Object.keys(ex).length) return base;
  const root = String(base).split('|CPY:')[0]; const key = root + '|CPY:' + cpyHash(base + '\u0001' + JSON.stringify(ex));
  if (!CPY.reg[key]) CPY.reg[key] = {base, ex}; CPY.made.add(key); try { if (S){ S.cpyReg = S.cpyReg || {}; if (!S.cpyReg[key]) S.cpyReg[key] = {base, ex}; } } catch {}
  try { if (!DICT.has(key)) info(key); } catch {}
  return key;
}
function cpyCap(w){ return String(w).replace(/^./, x => x.toUpperCase()); }
// the characteristics an object copies as (707.2): its current key, plus what face is up
function cpyCV(c){
  if (!c) return null; if (c.fd || !c.k) return CPY_FD;
  let k = c.k; const a = info(k);
  if (c.fl && a && a.back) k = cpyKey(k, {fb:1});
  if (c.zb) k = cpyKey(k, {pt:`${c.zb[0]}/${c.zb[1]}`});
  return k;
}
function cpyBuild(k){
  if (k === CPY_FD) return {k, n:'Face-down creature', m:'', mv:0, t:'Creature', o:'', p:'2/2', c:'', img:''};
  const r = CPY.reg[k] || (S && S.cpyReg && S.cpyReg[k]); if (!r) return null;
  const base = info(r.base); const ex = r.ex; if (!base || !ex) return null; const i = String(k).lastIndexOf('|CPY:');
  const a = ex.fb && base.back ? {...base, ...base.back, back:null} : {...base};
  let t = String(a.t || ''); const [L, R] = t.split(/\s+—\s+/);
  let sup = (L || '').split(/\s+/).filter(w => CPY_SUPER.includes(w)); let ct = (L || '').split(/\s+/).filter(w => w && !CPY_SUPER.includes(w)); let sub = R ? R.split(/\s+/).filter(Boolean) : [];
  if (ex.leg === 0) sup = sup.filter(w => w !== 'Legendary'); if (ex.leg === 1 && !sup.includes('Legendary')) sup.unshift('Legendary');
  if (ex.snow && !sup.includes('Snow')) sup.push('Snow');
  if (ex.setCT){ ct = ex.setCT.slice(); if (!ex.setSub && !ex.addSub) sub = []; }
  (ex.addCT || []).forEach(x => { if (!ct.includes(x)) ct.unshift(x); });
  if (ex.setSub) sub = ex.setSub.slice(); (ex.addSub || []).forEach(x => { if (!sub.includes(x)) sub.push(x); });
  ct.sort((x, y) => CPY_CT.indexOf(x) - CPY_CT.indexOf(y));
  t = [...sup, ...ct].join(' ') + (sub.length ? ' — ' + sub.join(' ') : '');
  let o = String(a.o || '');
  if (ex.nm && ex.nm !== a.n){ const nm0 = String(a.n || '').split(' // ')[0]; if (nm0) o = o.split(nm0).join(ex.nm); const sh = nm0.split(',')[0]; if (sh !== nm0 && sh.length > 3) o = o.split(sh).join(ex.nm); }
  const pre = (ex.kw || []).filter(w => !new RegExp('(^|\\n|, )' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\n|,|$)', 'i').test(o)).map(cpyCap);
  o = [pre.join(', '), o, ...(ex.add || [])].filter(Boolean).join('\n');
  const e = {...a, k, t, o, n:ex.nm || a.n, base:k.slice(0, i)}; CPY.made.add(k);
  if (ex.pt) e.p = ex.pt;
  if (ex.col != null) e.c = ex.col; if (ex.addCol) e.c = [...new Set(String(e.c || '').split('').concat(ex.addCol.split('')))].join('');
  if (ex.noMana){ e.m = ''; e.mv = 0; }
  if (ex.fb) e.back = null;
  return e;
}
{
  const df = deriveFace;
  deriveFace = function(k){
    if (typeof k === 'string' && (k === CPY_FD || k.includes('|CPY:'))){ try { const e = cpyBuild(k); if (e){ DICT.set(k, e); return e; } } catch (e){ console.warn(e); } return null; }
    return df(k);
  };
}
function cpyProtect(s){ const q = []; const r = String(s).replace(/"([^"]*)"|“([^”]*)”/g, (_, a, b) => { q.push((a ?? b).replace(/^\s+|\s+$/g, '')); return `§${q.length - 1}§`; }); return {r, q}; }
// parse "except …" (707.9). env: {self (name of the object that becomes / enters as the copy), line (the ability's own line), lines (all the source's lines), tgtK, tok, x, mine}
function cpyExc(str, env = {}){
  if (!str) return {ex:{}, post:[]};
  let {r, q} = cpyProtect(String(str).trim().replace(/\.$/, ''));
  r = r.replace(/\b(it|she|he|that)'s\b/gi, '$1 is').replace(/\bthey're\b/gi, 'they are').replace(/\bisn't\b/gi, 'is not').replace(/\baren't\b/gi, 'are not').replace(/\bdoesn't\b/gi, 'does not').replace(/\bdon't\b/gi, 'do not');
  const ex = {}; const post = []; let cond = null; let guard = 0;
  const SUBJ = /^(?:(?:it|she|he|they|the copy|the token|the tokens|this creature|that creature|~)\s+)?/i;
  const addKw = w => { (ex.kw ||= []).push(w.toLowerCase().replace(/\{(\d+)\}/, '{$1}')); };
  const addTxt = t => { (ex.add ||= []).push(String(t).replace(/~/g, 'this permanent')); };
  const unq = t => String(t).replace(/§(\d+)§/g, (_, i) => q[+i]);
  const abil = (seg) => { // "flying and this ability", "§0§", "~'s other abilities", "vanishing 3 if …"
    let rest = seg.trim(); let g = 0;
    while (rest && g++ < 12){
      let m;
      if ((m = rest.match(/^§(\d+)§/))){ addTxt(q[+m[1]].replace(/,$/, '').replace(/([^.])$/, '$1.')); rest = rest.slice(m[0].length); }
      else if ((m = rest.match(/^this ability/i))){ if (!env.line) return null; addTxt(env.line); rest = rest.slice(m[0].length); }
      else if ((m = rest.match(/^(?:~|[A-Z][\w ,'-]*?)'s other abilities/))){ (env.lines || []).filter(x => x !== env.cloneLine).forEach(addTxt); rest = rest.slice(m[0].length); }
      else if ((m = rest.match(CPY_KW))){ const kw = m[1]; rest = rest.slice(m[0].length); let c2;
        if ((c2 = rest.match(/^ if that creature does not have (\w+)/i))){ rest = rest.slice(c2[0].length); if (!new RegExp('(^|\\n)' + c2[1], 'i').test(info(env.tgtK)?.o || '')) addKw(kw); }
        else addKw(kw); }
      else return rest;
      const s2 = rest.match(/^(?:,\s*and\s+|,\s*|\s+and\s+)(?!(?:it|she|he|they|its|her|his|their|is|are|enters?|if)\b)/i); if (s2) rest = rest.slice(s2[0].length); else break;
    }
    return rest;
  };
  const desc = (words, addition) => {
    const ws = words.trim().split(/\s+/).filter(w => !/^(an?|the)$/i.test(w)); const cts = [], subs = [], cols = [];
    for (const w of ws){ const lw = w.toLowerCase();
      if (/^\d+\/\d+$/.test(w)) ex.pt = w;
      else if (CPY_COL[lw]) cols.push(CPY_COL[lw]);
      else if (lw === 'colorless') cols.push('');
      else if (CPY_CT.map(x => x.toLowerCase()).includes(lw)) cts.push(cpyCap(lw));
      else if (lw === 'legendary') ex.leg = 1;
      else if (lw === 'snow') ex.snow = 1;
      else if (lw === 'and') continue;
      else if (/^[a-z][a-z'-]*$/i.test(w) && !/^(or|with|in|addition|to|its|other|types|colors|of)$/i.test(lw)) subs.push(cpyCap(w));
      else return false; }
    if (addition){ if (cts.length) ex.addCT = (ex.addCT || []).concat(cts); if (subs.length) ex.addSub = (ex.addSub || []).concat(subs); if (cols.length) ex.addCol = cols.join(''); }
    else { if (cts.length) ex.setCT = cts; if (subs.length) ex.setSub = subs; if (cols.length) ex.col = cols.join(''); }
    return true;
  };
  while (r && guard++ < 16){
    r = r.trim().replace(/^(?:,\s*and,?\s+|,\s*|and,?\s+)/i, '').trim(); if (!r) break; let m;
    if ((m = r.match(/^if (?:it is|that permanent is) a (creature|planeswalker),\s*/i))){ cond = m[1].toLowerCase(); r = r.slice(m[0].length); continue; }
    if ((m = r.match(/^if (?:this creature|~) was embalmed, the token has no mana cost, it is white, and it is a zombie in addition to its other types/i))){ if (env.tok){ ex.noMana = 1; ex.col = 'W'; ex.addSub = (ex.addSub || []).concat('Zombie'); } r = r.slice(m[0].length); continue; }
    if ((m = r.match(/^(?:its|their) power is half that creature's power and (?:its|their) toughness is half that creature's toughness/i))){ ex.half = 1; r = r.slice(m[0].length); continue; }
    if ((m = r.match(/^(?:its|her|his|their) name is (.+?)(?=,? and (?:it|she|he|they|its|her|his)\b|, (?:it|she|he|they)\b|$)/i))){ ex.nm = m[1].trim() === '~' ? env.self : unq(m[1].trim()); r = r.slice(m[0].length); continue; }
    const r0 = r; r = r.replace(SUBJ, '');
    if ((m = r.match(/^(?:is|are) not legendary(?: if the spell is legendary)?/i))){ ex.leg = 0; r = r.slice(m[0].length); continue; }
    if ((m = r.match(/^(?:enters?|enter) with (an?|one|two|three|x|\d+)(?: additional)? (\+1\/\+1|loyalty|shield) counters? on (?:it|them|her|him)(?: if (?:it is a (creature|planeswalker)|(you control that creature)))?/i))){
      const n = m[1].toLowerCase() === 'x' ? (env.x || 0) : (wn(m[1]) || 1); post.push({kind:m[2] === '+1/+1' ? 'cp' : m[2] === 'loyalty' ? 'loy' : 'shield', n, cond:m[3] ? m[3].toLowerCase() : m[4] ? 'ctl' : cond}); r = r.slice(m[0].length); continue; }
    if ((m = r.match(/^loses all other card types/i))){ if (ex.addCT){ ex.setCT = ex.addCT; delete ex.addCT; } if (ex.addSub && !ex.setSub){ ex.setSub = ex.addSub; delete ex.addSub; } r = r.slice(m[0].length); continue; }
    if ((m = r.match(/^(?:is|are) (.+?) in addition to (?:its|his|her|their) other (?:colors and |creature )?types/i))){ if (!desc(m[1], true)) return null; r = r.slice(m[0].length); continue; }
    if ((m = r.match(/^(?:is|are) (.+?) with (.+?)(?= and (?:it|they) loses?\b|$)/i))){ const d = m[1]; if (/(^|\s)(artifact|enchantment|creature|land)$/i.test(d) && /loses? all other card types/i.test(r.slice(m[0].length))){ if (!desc(d, true)) return null; } else if (!desc(d, false)) return null; const left = abil(m[2]); if (left == null || left.trim()) return null; r = r.slice(m[0].length); continue; }
    if ((m = r.match(/^(?:is|are) (.+?)(?=,| and (?:it|she|he|they|has|have|is|its|her|his)\b|$)/i))){ const d = m[1]; const lose = /^(?:,?\s*and\s+)?(?:it|they)?\s*loses? all other card types/i.test(r.slice(m[0].length).replace(/^\s*and\s+/, ''));
      if (!desc(d, lose)) return null; r = r.slice(m[0].length); continue; }
    if ((m = r.match(/^(?:has|have|gains?) /i))){ const left = abil(r.slice(m[0].length)); if (left == null) return null; r = left; continue; }
    r = r0; return null;
  }
  if (r && r.trim()) return null;
  return {ex, post};
}
function cpyLine(srcK, re){ const a = info(srcK); if (!a) return ''; const ls = String(a.o || '').split('\n').map(x => x.trim()).filter(Boolean); return ls.find(x => re.test(tname(x, a.n))) || ''; }
function cpyLines(srcK){ const a = info(srcK); return a ? String(a.o || '').split('\n').map(x => x.trim()).filter(Boolean) : []; }
// a key for a copy of object k with the parsed exceptions; half P/T needs the copied object's power/toughness
function cpyApplyEx(k, ex, st){
  ex = {...(ex || {})};
  if (ex.half){ const p = st ? st[0] : (parseInt(info(k)?.p) || 0), t = st ? st[1] : (parseInt(String(info(k)?.p || '').split('/')[1]) || 0); delete ex.half; ex.pt = `${Math.ceil(p / 2)}/${Math.ceil(t / 2)}`; }
  return cpyKey(k, ex);
}
function cpyPost(c, post, o = {}){
  for (const p of post || []){
    if (p.cond === 'creature' && !isCreatureCard(c)) continue; if (p.cond === 'planeswalker' && !isPW(c)) continue; if (p.cond === 'ctl' && !o.ctl) continue;
    if (p.kind === 'cp'){ if (isCreatureCard(c)) modCounters(c, 'cp', p.n); }
    else if (p.kind === 'loy'){ if (isPW(c)) c.co = (c.co || 0) + p.n; }
    else if (p.kind === 'shield') addNamed(c, 'shield', p.n);
  }
}
// make my permanent a copy of key k (o.eot: until end of turn)
function cpyBecome(c, k, o = {}){
  if (!c || !k || !info(k)) return false;
  const before = cname(c);
  if (o.eot){ if (c.cpyEot == null) c.cpyEot = c.k; } else delete c.cpyEot;
  if (!c.origK) c.origK = c.k;
  c.k = k; if (c.fl && !info(k)?.back) c.fl = false;
  if (isPW(c) && !c.pw && /^L\d+/.test(info(k)?.p || '')){ c.pw = 1; if (!c.co) c.co = parseInt(info(k).p.slice(1), 10) || 0; }
  if (!o.quiet) log(`${before} became a copy of ${info(k)?.n}${o.eot ? ' until end of turn' : ''}${o.src ? ` (${o.src})` : ''}`);
  return true;
}
// any board's permanent becomes a copy of key k
function cpyBecomeAny(t, k, o = {}){
  if (!t || !k) return;
  if (t.pid === MYPID || !t.pid){ const c = S.bf.find(b => b.id === t.id); if (c) cpyBecome(c, k, o); return; }
  sendRq(t.pid, 'cpyBecome', o.eot ? 1 : 0, o.src || '', {tid:t.id, d:k});
}
{
  const pc = publishCards;
  publishCards = function(force){ const r = pc(force);
    try { if (NET.peer){ const fresh = [...CPY.made].filter(k => k && DICT.has(k) && !NET.published.has(k)).slice(0, 80);
      for (let i = 0; i < fresh.length; i += 40){ const part = fresh.slice(i, i + 40); part.forEach(k => NET.published.add(k)); NET.chunks.push(part.map(k => DICT.get(k))); mqPublish(`${base()}/c/${MYPID}/${NET.chunks.length - 1}`, {pid:MYPID, cards:NET.chunks[NET.chunks.length - 1]}); } } } catch (e){ console.warn(e); }
    return r; };
}
// another player's request that names a copy key waits (a few seconds at most) for that face to arrive
function cpyWhenKnown(k, fn, tries = 0){ if (!k || info(k) || tries > 16){ fn(); return; } setTimeout(() => cpyWhenKnown(k, fn, tries + 1), 400); }
RQ_OPS.push('cpyBecome', 'cpyTok', 'cpyMR');
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r && r.op === 'cpyBecome'){ cpyWhenKnown(r.d, () => { const c = S.bf.find(b => b.id === r.tid); if (c && info(r.d)) cpyBecome(c, r.d, {eot:!!r.n, src:r.src}); commit(); }); return; }
    if (r && r.op === 'cpyTok'){ cpyWhenKnown(r.d, () => { if (info(r.d)){ for (let i = 0; i < Math.max(1, r.n || 1); i++) cpyTok(r.d, {tapped:r.ref === 'tp', quiet:true}); log(`created ${Math.max(1, r.n || 1)} token cop${(r.n || 1) > 1 ? 'ies' : 'y'} of ${info(r.d)?.n} (${r.src})`); } commit(); }); return; }
    if (r && r.op === 'cpyMR'){ if (r.d === 'off'){ delete S.cpyMR; commit(); return; } cpyWhenKnown(r.d, () => { if (info(r.d)) S.cpyMR = {k:r.d, t:turnStr(), src:r.src}; commit(); }); return; }
    return ao(r, from);
  };
}
// "until end of turn" copies wear off with the other end-of-turn effects
{
  const tc = turnChanged;
  turnChanged = function(...a){
    try { for (const c of (S ? S.bf : [])){ if (c.cpyEot != null){ const was = cname(c); c.k = c.cpyEot; delete c.cpyEot; if (c.origK === c.k) delete c.origK; log(`${was} is ${cname(c)} again`); } } } catch (e){ console.warn(e); }
    return tc.apply(this, a);
  };
  const ol = onLeave;
  onLeave = function(c, to, w){ try { if (c){ if (c.cpyEot != null && !c.origK) c.k = c.cpyEot; delete c.cpyEot; delete c.cpyCl; } } catch {} return ol(c, to, w); };
}
// a token that's a copy of key k
function cpyTok(k, o = {}){
  if (!k || !info(k)) return null;
  const tk = {id:S.nid++, k, tok:true, copy:true, n:1, sk:true};
  if (o.haste) tk.ekw = ['haste']; if (o.tapped || o.atk) tk.tap = true; if (o.atk) tk.atk = o.atk;
  place(tk); S.bf.push(tk); S.recent = [k, ...S.recent.filter(x => x !== k)].slice(0, 8);
  cpyPost(tk, o.post, {ctl:true});
  if (o.cp) modCounters(tk, 'cp', o.cp);
  if (!o.quiet) log(`created a token copy of ${info(k)?.n}${o.tapped || o.atk ? ' tapped' : ''}${o.atk ? ' and attacking' : ''}`);
  try { if (/(^|\n)At end of combat, exile this (?:permanent|token)\.?($|\n)/i.test(info(k)?.o || '')) r21bDelay('eoc', false, 'Exile it.', {lastTok:[tk.id], k, name:info(k)?.n, srcId:null}); } catch {}
  emit({type:'enter', k, id:tk.id, tok:1}); return tk;
}
function cpyTokFor(pid, k, n, src, o = {}){
  if (pid === MYPID){ const ids = []; for (let i = 0; i < n; i++){ const t = cpyTok(k, o); if (t) ids.push(t.id); } return ids; }
  sendRq(pid, 'cpyTok', n, src, {d:k, ref:o.tapped ? 'tp' : ''}); return [];
}
// the object a target / reference points at → its copiable key
function cpyKOf(t){
  if (!t) return null;
  if (t.t === 'gy' || t.zone === 'gy' || t.t === 'ex') return t.k || null;
  if (t.t === 'card' || t.id != null){ const c = boardOf(t.pid || MYPID).find(b => b.id === t.id); if (c) return cpyCV(c); }
  return t.k || null;
}

/* ---------- enter as a copy (Clone, Spark Double, Vesuva, Body Double, Superior Spider-Man …) ---------- */
const CPY_CLONE = /^(?:as ~ enters, )?you may have (?:~|it) (enter( tapped)? as a copy of|become a copy of) (any|an?|another) (.+?)( until end of turn)?(?:, except (.+?))?(\. when you do, (?:exile that card|tap the copied creature and it doesn't untap during its controller's untap step for as long as you control ~))?\.?$/i;
function cpyCloneSpec(k){
  const a = info(k); if (!a) return null;
  for (const ln of String(a.o || '').split('\n')){ const t = tname(ln.trim(), a.n); const m = t.match(CPY_CLONE); if (m) return {line:ln.trim(), tl:t, become:/^become/i.test(m[1]), tapped:!!m[2], what:m[4], eot:!!m[5], exc:m[6] || '', exileIt:/exile that card/i.test(m[7] || ''), tapLock:/tap the copied/i.test(m[7] || '')}; }
  return null;
}
function cpyCloneOpts(c, spec){
  let w = spec.what.trim(); let zone = 'bf', who = 'all', filt = null;
  let m;
  if ((m = w.match(/^(.+?) cards? in a graveyard$/))){ zone = 'gy'; w = m[1]; }
  else if ((m = w.match(/^(.+?) on the battlefield(?: (.+))?$/))){ w = m[1]; if (m[2]) filt = m[2]; }
  else if ((m = w.match(/^(.+?) you control(?: (.+))?$/))){ w = m[1]; who = 'me'; if (m[2]) filt = m[2]; }
  else if ((m = w.match(/^(.+?) an opponent controls$/))){ w = m[1]; who = 'opp'; }
  if ((m = w.match(/^(.+?) (that entered this turn|with mana value less than or equal to the amount of mana spent to cast ~|with power (\d+) or greater)$/))){ w = m[1]; filt = m[2]; }
  const out = [];
  const okF = (x, pid, key) => {
    if (!filt) return true;
    if (/^that entered this turn$/.test(filt)) return pid === MYPID ? (x.et === turnStr() || x.cpyEt === turnStr()) : !!(x.et === turnStr() || x.sk);
    if (/mana spent/.test(filt)){ const sp = UI.spellX && UI.spellX.id === c.id ? (UI.spellX.spent || 0) : (c.spent != null ? c.spent : (info(c.k)?.mv || 0) + (c.xv || 0)); return (info(key)?.mv || 0) <= sp; }
    if ((m = filt.match(/^with power (\d+) or greater$/))){ const st = statsAny({pid, id:x.id}); return !!st && st[0] >= +m[1]; }
    return true; };
  if (zone === 'gy'){
    S.gy.forEach(g => { if (descOk(g.k, w) && g.id !== c.id) out.push({label:`${info(g.k)?.n} (your graveyard)`, k:g.k, pid:MYPID, id:g.id, zone:'gy'}); });
    for (const [pid, s] of OPP) (s.gy || []).forEach((k, i) => { if (k && descOk(k, w)) out.push({label:`${info(k)?.n} (${nameOf(pid)}'s graveyard)`, k, pid, gi:i, zone:'gy'}); });
  } else {
    for (const b of boardsAll()){
      if (who === 'me' && b.pid !== MYPID) continue; if (who === 'opp' && b.pid === MYPID) continue;
      for (const x of b.bf){ if (!x.k || x.fd || (b.pid === MYPID && x.id === c.id)) continue; if (!descOk(x.k, w, {tok:x.tok})) continue; const key = cpyCV(x); if (!okF(x, b.pid, key)) continue;
        out.push({label:`${info(x.k)?.n} (${b.pid === MYPID ? 'yours' : nameOf(b.pid) + "'s"})`, k:key, pid:b.pid, id:x.id, zone:'bf'}); }
    }
  }
  return out;
}
async function cpyCloneEnter(c){
  const spec = cpyCloneSpec(c.k); if (!spec) return false;
  const a = info(c.k); const self = a.n;
  if (spec.tapped) c.tap = true;
  const opts = cpyCloneOpts(c, spec);
  if (!opts.length){ log(`${self}: nothing to copy`); return true; }
  const v = UI.dry ? '' : await askChoice({title:`${self}: ${spec.become ? 'become' : 'enter as'} a copy of…`, options:[...opts.map((o, i) => ({label:o.label, value:String(i)})), {label:'Don’t copy anything', value:''}]});
  if (v === '' || v == null) return true;
  const pick = opts[+v]; if (!pick) return true;
  const xs = UI.spellX && UI.spellX.id === c.id ? UI.spellX.x : (c.xv || 0);
  const pe = spec.exc ? cpyExc(spec.exc.replace(/~/g, '~'), {self, line:spec.line, cloneLine:spec.line, lines:cpyLines(c.k), tgtK:pick.k, tok:!!c.tok, x:xs}) : {ex:{}, post:[]};
  if (spec.exc && !pe){ handWarn(`Copy exception: except ${spec.exc}`, {name:self}); }
  const k = pe ? cpyApplyEx(pick.k, pe.ex) : pick.k;
  cpyBecome(c, k, {eot:spec.eot, quiet:true}); c.cpyEt = turnStr();
  log(`${self} ${spec.become ? 'became' : 'entered as'} a copy of ${info(pick.k)?.n}${spec.eot ? ' until end of turn' : ''}`);
  if (pe) cpyPost(c, pe.post, {ctl:pick.pid === MYPID});
  if (spec.exileIt && pick.zone === 'gy'){ if (pick.pid === MYPID){ if (find(pick.id)[0] === 'gy') moveCard(pick.id, 'ex', {quiet:true}); } else sendRq(pick.pid, 'gytake', 0, self, {d:pick.k, ex:1}); log(`${self}: exiled ${info(pick.k)?.n}`); }
  if (spec.tapLock && pick.zone === 'bf'){ const t = {t:'card', pid:pick.pid, id:pick.id, k:pick.k}; applyTo(t, {op:'tap', src:self}); applyTo(t, {op:'r23kLock', src:self, ref:String(c.id), d:MYPID}); log(`${self}: tapped ${info(pick.k)?.n}; it doesn't untap while you control ${self}`); }
  return true;
}
cloneChoice = async function(c, a){ try { c.cpyCl = 1; await cpyCloneEnter(c); } catch (e){ console.warn(e); } };
{
  const oe = onEnter;
  onEnter = function(c, from, o = {}){
    try {
      if (c && S && from !== 'bf' && !c.fd){ c.cpyFrom = from;
        if (c.cpyCl){ delete c.cpyCl; return oe(c, from, o); }
        if (!UI.dry && S.bf.includes(c) && cpyCloneSpec(c.k)){ c.cpyCl = 2; const sp = cpyCloneSpec(c.k); if (sp.tapped) c.tap = true;
          (async () => { try { await cpyCloneEnter(c); } catch (e){ console.warn(e); } delete c.cpyCl; if (S.bf.includes(c)) oe(c, from, o); commit(); })(); return; }
      }
    } catch (e){ console.warn(e); }
    return oe(c, from, o);
  };
}
STATIC_KNOWN.push(/^you may have ~ enter tapped as a copy of any (?:land|creature) (?:on the battlefield|card in a graveyard)/);

/* ---------- copies of permanent spells resolve as tokens (707.10f) ---------- */
{
  const rt = resolveTop;
  resolveTop = async function(it, ...a){
    if (it && it.kind === 'spell' && it.copy && !it.card && isPermType(info(it.k)?.t || '') && S.stk.includes(it) && !UI.resolving){
      S.stk.splice(S.stk.indexOf(it), 1);
      const tk = cpyTok(it.k, {quiet:true, haste:!!it.cpyHaste}); log(`${it.nm} resolved — it became a token`);
      if (tk && /\bAura\b/.test(info(it.k)?.t || '') && it.tgts && it.tgts.flat().length){ const t = it.tgts.flat().find(targetStillThere); if (t) tk.att = {pid:t.pid, id:t.id}; }
      if (tk && it.cpySacEnd) S.dly.push({id:rid(6), eff:'Sacrifice ~.', k:it.k, nm:info(it.k)?.n, srcId:tk.id});
      commit(); return;
    }
    return rt(it, ...a);
  };
  // remember the last spell copy put on the stack (so "the copy" / "except the copy isn't legendary" can change it)
  const ct = copyTargetItem;
  copyTargetItem = async function(ctx, ...a){ const n0 = S.stk.length; const r = await ct(ctx, ...a); try { const it = S.stk.slice(n0).reverse().find(x => x.copy); if (it) CPY.lastCopy = it; } catch {} return r; };
}

/* ---------- Mystic Reflection: the next creatures / planeswalkers to enter this turn enter as copies ---------- */
{
  const em = emit;
  emit = function(ev){
    try {
      if (S && ev && ev.type === 'enter' && S.cpyMR && S.cpyMR.t === turnStr()){
        const c = S.bf.find(b => b.id === ev.id);
        if (c && (isCreatureCard(c) || isPW(c)) && c.k !== S.cpyMR.k){ cpyBecome(c, S.cpyMR.k, {src:S.cpyMR.src}); ev = {...ev, k:c.k};
          if (!S.cpyMR.used){ S.cpyMR.used = 1; Promise.resolve().then(() => { if (S.cpyMR && S.cpyMR.used){ delete S.cpyMR; opponents().forEach(p => sendRq(p.pid, 'cpyMR', 0, '', {d:'off'})); commit(); } }); } }
      } else if (S && S.cpyMR && S.cpyMR.t !== turnStr()) delete S.cpyMR;
    } catch (e){ console.warn(e); }
    return em(ev);
  };
}

/* ---------- helpers for the card handlers ---------- */
// the objects of a "one or more … enter" batch trigger
function cpyBatch(ctx){ const it = ctx.it || {}; if (it.cpyBatch && it.cpyBatch.length) return it.cpyBatch; if (it.evId != null) return [{t:'card', pid:it.evPid || MYPID, id:it.evId, k:it.evk}]; return []; }
{
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){ const n0 = S.stk.length; const r = pt(src, t, ev, evPid);
    try { if (t && t.batch && ev && UI.curQ && S.stk.length > n0){ const it = S.stk[S.stk.length - 1]; it.cpyBatch = UI.curQ.filter(([p2, e2]) => e2.type === ev.type && p2 === (evPid || MYPID) && e2.id != null && (!t.desc || descOk(e2.k, t.desc, {tok:e2.tok})) && (!t.tokOnly || e2.tok)).map(([p2, e2]) => ({t:'card', pid:p2, id:e2.id, k:e2.k})).slice(0, 30); } } catch {}
    return r; };
}
// where a permanent spell was cast from (Twilight Diviner)
{
  const rt = resolveTop;
  resolveTop = async function(it, ...a){ try { if (it && it.kind === 'spell' && it.card) it.card.cpyCastFrom = it.from || ''; } catch {} return rt(it, ...a); };
}
// when did a card reach my graveyard (Abyssal Harvester); published as indices for the other players
{
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ const r = mc(id, to, o); try { if (S && to === 'gy'){ const c = S.gy.find(g => g.id === id); if (c) c.cpyGyT = turnStr(); } } catch {} return r; };
  const ep = enginePublic;
  enginePublic = function(){ const o = ep(); try { const T = turnStr(); const ix = []; S.gy.forEach((c, i) => { if (c.cpyGyT === T) ix.push(i); }); if (ix.length) o.cpyGyT = [T, ix.slice(-40)]; } catch {} return o; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); try { if (Array.isArray(s.cpyGyT) && Array.isArray(s.cpyGyT[1])) o.cpyGyT = [String(s.cpyGyT[0]).slice(0, 20), s.cpyGyT[1].filter(n => Number.isInteger(n)).slice(0, 40)]; } catch {} return o; };
}
function cpyGyThisTurn(t){
  if (UI.dry) return true;
  if (t.pid === MYPID){ const c = S.gy.find(g => g.id === t.id); return !!(c && c.cpyGyT === turnStr()); }
  const st = OPP.get(t.pid); const i = parseInt(String(t.id).replace(/^g/, ''), 10); return !!(st && Array.isArray(st.cpyGyT) && st.cpyGyT[0] === turnStr() && st.cpyGyT[1].includes(i));
}
function cpyExileGy(t, src){ if (t.pid === MYPID){ if (find(t.id)[0] === 'gy') moveCard(t.id, 'ex', {quiet:true}); log(`${src}: exiled ${info(t.k)?.n} from a graveyard`); } else { sendRq(t.pid, 'gytake', 0, src, {d:t.k, ex:1}); log(`${src}: exiled ${info(t.k)?.n} from ${nameOf(t.pid)}'s graveyard`); } }
// Saw in Half on my own creature (or on the controller's client)
function cpySawLocal(id, k, src){
  const c = S.bf.find(b => b.id === id); if (!c) return; const one = single(c); const tok = !!one.tok;
  destroyCard(one, src);
  const died = tok ? !S.bf.includes(one) : find(one.id)[0] === 'gy';
  if (died && k && info(k)){ cpyTok(k, {quiet:true}); cpyTok(k, {quiet:true}); log(`${src}: created two half-size token copies of ${info(k)?.n}`); }
  else log(`${src}: it didn't die — no tokens`);
}
RQ_OPS.push('cpySaw');
{
  const ao = applyOp;
  applyOp = function(r, from){ if (r && r.op === 'cpySaw'){ cpyWhenKnown(r.d, () => { cpySawLocal(r.tid, r.d, r.src); commit(); }); return; } return ao(r, from); };
}
// change the spell copy just put on the stack (Double Major, Storm of Saruman)
function cpyFixCopy(n0, ex){ const cp = S.stk.slice(n0).reverse().find(x => x.copy && x.kind === 'spell'); if (!cp) return; const a = info(cp.k); if (ex.leg === 0 && !/\bLegendary\b/.test(a?.t || '')) return; cp.k = cpyKey(cp.k, ex); log(`the copy of ${a?.n} isn't legendary`); }
// Gogo: creatures that must attack this turn if able
{
  const da = declareAttackers;
  declareAttackers = function(...a){
    try { const pn = phaseNow(); const T = turnStr(); if (pn.mine && S.cb && S.cb.step === 'atk'){ const miss = S.bf.filter(c => c.cpyMust === T && !c.fd && isCreatureCard(c) && !canAttack(c) && !UI.atkSel[c.id]); if (miss.length){ toast(`${miss.map(cname).slice(0, 4).join(', ')} must attack this turn if able`); return; } } } catch (e){ console.warn(e); }
    return da.apply(this, a);
  };
}
// a token copy of an Aura enters attached to something it can enchant (303.4f)
{
  const em = emit;
  emit = function(ev){
    try { if (S && ev && ev.type === 'enter' && ev.tok && !UI.dry){ const tk = S.bf.find(b => b.id === ev.id); if (tk && tk.copy && !tk.att && /\bAura\b/.test(typeOf(tk))) cpyAuraAttach(tk); } } catch (e){ console.warn(e); }
    return em(ev);
  };
}
async function cpyAuraAttach(tk){
  const m = String(info(tk.k)?.o || '').match(/^Enchant ([^\n(]+)/im); const d = m ? m[1].trim().toLowerCase() : 'permanent';
  const mine = /\byou control\b/.test(d); const dd = d.replace(/ you control$/, '').replace(/ an opponent controls$/, ''); const opts = [];
  for (const b of boardsAll()){ if (mine && b.pid !== MYPID) continue; if (/an opponent controls$/.test(d) && b.pid === MYPID) continue; for (const x of b.bf){ if (!x.k || x.fd || x.id === tk.id) continue; if (descOk(x.k, dd, {tok:x.tok})) opts.push({label:`${info(x.k)?.n} (${b.pid === MYPID ? 'yours' : nameOf(b.pid) + "'s"})`, value:b.pid + '|' + x.id}); } }
  if (!opts.length){ log(`${cname(tk)} has nothing to enchant`); moveCard(tk.id, 'gy', {quiet:true}); commit(); return; }
  const v = opts.length === 1 ? opts[0].value : await askChoice({title:`${cname(tk)} (token copy): enchant what?`, options:opts});
  const [pid, id] = String(v || opts[0].value).split('|'); tk.att = {pid, id:+id}; log(`${cname(tk)} is attached to ${opts.find(o => o.value === v)?.label || 'a permanent'}`); commit();
}
STATIC_KNOWN.push(/^you may roll again$/);

async function doRound24LPre(s, l, ctx){
  let m; const name = ctx.name || '';
  const full = tname(String(ctx.full || info(ctx.k)?.o || ''), name).toLowerCase();
  const T = () => (ctx.tgts ? nextTargets(ctx) : []);
  const src = () => srcCardOf(ctx);
  const selfObj = () => { const c = src(); if (c && find(c.id)[0] === 'bf') return c; const k = ctx.k; return S.bf.find(b => b.k === k || b.origK === k) || null; };
  const srcLine = re => cpyLine(ctx.k, re);
  const exOf = (str, tk, extra = {}) => str ? cpyExc(s.slice(s.length - str.length), {self:info(ctx.k)?.n || name, line:srcLine(/becomes? a copy|become copies|copy of|copies of/i), lines:cpyLines(ctx.k), tgtK:tk, ...extra}) : {ex:{}, post:[]};
  const refT = (w) => { // "it", "that creature", "target …" → [target]
    if (/\btarget\b/.test(w)) return T();
    if (/^(?:it|that creature|that permanent|that artifact|that token|that card|the exiled card|that artifact or creature|one of them|the sacrificed creature)$/.test(w)){
      if (ctx.lastT && ctx.lastT.length) return ctx.lastT.slice(0, 1);
      const it = ctx.it || {}; if (it.evId != null){ const pid = it.evPid || MYPID; const c = boardOf(pid).find(b => b.id === it.evId); if (c) return [{t:'card', pid, id:c.id, k:c.k}]; }
      if (it.evk) return [{t:'k', k:it.evk}];
    }
    return [];
  };

  const copyFull = /cop(?:y|ies) of|becomes? a copy|become copies|as copies of/.test(full);
  // choosing a target that a later copy sentence refers to ("choose target …", "choose up to one other target …")
  if ((m = l.match(/^choose (?:up to one )?(?:other )?target (.+?)$/)) && copyFull && !/\bthen\b|, /.test(m[1])){ const t = T(); if (t.length){ ctx.lastT = t; log(`${name}: chose ${tgtLabel([t])}`); } return true; }
  if (/^choose each artifact creature you control$/.test(l) && copyFull){ ctx.lastT = S.bf.filter(c => !c.fd && isCreatureCard(c) && /\bArtifact\b/.test(typeOf(c))).map(c => ({t:'card', pid:MYPID, id:c.id, k:c.k})); return true; }
  // Kimahri: "put a +1/+1 counter on ~ and tap target creature an opponent controls"
  if ((m = l.match(/^put a \+1\/\+1 counter on ~ and tap target (.+)$/))){ const me = selfObj(); if (me) modCounters(me, 'cp', 1); const t = T()[0]; if (t){ applyTo(t, {op:'tap', src:name}); ctx.lastT = [t]; } commit(); return true; }
  // March of Progress
  if (/^for each creature chosen this way, create a token that's a copy of it$/.test(l)){ for (const t of (ctx.lastT || [])){ const k = cpyKOf(t); if (k) cpyTok(k); } commit(); return true; }
  // Kambal: "for each of them, create a tapped token that's a copy of it"
  if (/^for each of them, create a (tapped )?token that's a copy of it$/.test(l)){ const list = cpyBatch(ctx); for (const e of list){ const k = cpyKOf(e) || e.k; if (k) cpyTok(k, {tapped:/tapped/.test(l)}); } commit(); return true; }
  // Twilight Diviner
  if (/^if they entered or were cast from a graveyard, create a token that's a copy of one of them$/.test(l)){
    const list = cpyBatch(ctx).map(e => ({e, c:e.pid === MYPID ? S.bf.find(b => b.id === e.id) : null})).filter(x => x.c && (x.c.cpyFrom === 'gy' || x.c.cpyCastFrom === 'gy'));
    if (!list.length){ if (!UI.dry) log(`${name}: none of them came from a graveyard`); return true; }
    let pick = list[0]; if (list.length > 1 && !UI.dry){ const v = await askChoice({title:`${name}: copy which one?`, options:list.map((x, i) => ({label:cname(x.c), value:String(i)}))}); pick = list[+v] || list[0]; }
    cpyTok(cpyCV(pick.c)); commit(); return true; }
  // Preston: "if it wasn't cast, create a token that's a copy of that creature, except …"
  if ((m = s.match(/^if it wasn't cast, (create a token that's a copy of that creature, except .+)$/i))){ const it = ctx.it || {}; const c = it.evId != null ? S.bf.find(b => b.id === it.evId) : null; if (c && c.wasCast === turnStr()){ log(`${name}: it was cast — no token`); return true; } if (c) ctx.lastT = [{t:'card', pid:MYPID, id:c.id, k:c.k}]; await doSentence(cap(m[1]), ctx); return true; }
  // Court of Vantress: "if you're not the monarch, you may have ~ become a copy of it, except it has this ability"
  if ((m = s.match(/^if you're not the monarch, you may (have ~ become a copy of it(?:, except .+)?)$/i))){ if (holderOf('mon') === MYPID){ return true; } if (!(ctx.lastT || []).length){ if (!UI.dry) log(`${name}: nothing chosen`); return true; } if (UI.dry || await askYes(`${name}: become a copy of ${tgtLabel([ctx.lastT])}?`)) await doSentence(cap(m[1]), ctx); return true; }
  // Gogo: "~ and that creature each get +2/+0 and gain haste until end of turn and attack this turn if able"
  if ((m = l.match(/^~ and that creature each get \+(\d+)\/\+(\d+) and gain (\w+) until end of turn and attack this turn if able$/))){
    const me = selfObj(); const t = (ctx.lastT || [])[0]; const f = {p:+m[1], t:+m[2], kw:[m[3]]};
    if (me){ applyOp({op:'pump', tid:me.id, f, src:name}, MYPID); me.cpyMust = turnStr(); }
    if (t){ applyTo(t, {op:'pump', src:name, f}); const c = t.pid === MYPID ? S.bf.find(b => b.id === t.id) : null; if (c) c.cpyMust = turnStr(); }
    commit(); return true; }
  // Yenna: "if the token is an Aura, untap ~"
  if (/^if the token is an aura, untap ~$/.test(l)){ const tk = S.bf.find(b => b.id === ctx.lastCardId); if (tk && /\bAura\b/.test(typeOf(tk))){ const me = selfObj(); if (me){ me.tap = false; log(`${name} untapped`); } } return true; }
  // Mystic Reflection
  if (/^the next time one or more creatures or planeswalkers enter this turn, they enter as copies of the chosen creature$/.test(l)){ const t = (ctx.lastT || [])[0]; const k = t && cpyKOf(t); if (!k){ if (!UI.dry) log(`${name}: no creature chosen`); return true; }
    S.cpyMR = {k, t:turnStr(), src:name}; const a = info(k); opponents().forEach(p => sendRq(p.pid, 'cpyMR', 0, name, {d:k})); log(`${name}: the next creatures or planeswalkers to enter this turn enter as copies of ${a?.n}`); commit(); return true; }
  // Benthic Anomaly
  if (/^for each opponent, choose a creature (?:target|that) player controls$/.test(l)){ ctx.cpyChosen = [];
    for (const p of opponents()){ const list = boardOf(p.pid).filter(c => c.k && !c.fd ? isCreatureCard({...c}) : !!c.fd); if (!list.length) continue; let c = list[0];
      if (list.length > 1 && !UI.dry){ const v = await askChoice({title:`${name}: choose a creature ${nameOf(p.pid)} controls`, options:list.map((x, i) => ({label:x.fd ? 'face-down creature' : info(x.k)?.n, value:String(i)}))}); c = list[+v] || c; }
      ctx.cpyChosen.push({t:'card', pid:p.pid, id:c.id, k:c.k}); }
    if (ctx.cpyChosen.length) log(`${name}: chose ${tgtLabel([ctx.cpyChosen.map(t => ({...t, nm:info(t.k)?.n}))])}`); return true; }
  if (/^create a token that's a copy of one of those creatures, except its power is equal to the total power of those creatures, its toughness is equal to the total toughness of those creatures, and it's a colorless eldrazi creature$/.test(l)){
    const ch = ctx.cpyChosen || []; if (!ch.length){ if (!UI.dry) log(`${name}: no creatures chosen`); return true; }
    let P = 0, Tt = 0; ch.forEach(t => { const st = statsAny(t) || [0, 0]; P += st[0]; Tt += st[1]; });
    let pick = ch[0]; if (ch.length > 1 && !UI.dry){ const v = await askChoice({title:`${name}: copy which one?`, options:ch.map((t, i) => ({label:`${info(t.k)?.n} (${nameOf(t.pid)})`, value:String(i)}))}); pick = ch[+v] || pick; }
    const k0 = cpyKOf(pick); if (!k0) return true; cpyTok(cpyKey(k0, {pt:`${P}/${Tt}`, col:'', setCT:['Creature'], setSub:['Eldrazi']})); commit(); return true; }
  // Saw in Half: destroy it; if it dies, its controller makes two half-size copies
  if (/^destroy target creature$/.test(l) && /if that creature dies this way, its controller creates two tokens that are copies of that creature, except their power is half/.test(full)){
    ctx.cpySaw = 1; const t = T()[0]; if (!t) return true; ctx.lastT = [t];
    const st = statsAny(t) || [0, 0]; const k0 = cpyKOf(t); const k = k0 ? cpyKey(k0, {pt:`${Math.ceil(st[0] / 2)}/${Math.ceil(st[1] / 2)}`}) : null;
    if (t.pid === MYPID){ cpySawLocal(t.id, k, name); } else { sendRq(t.pid, 'cpySaw', 0, name, {tid:t.id, d:k}); }
    commit(); return true; }
  if (/^if that creature dies this way, its controller creates two tokens that are copies of that creature, except their power is half that creature's power and their toughness is half that creature's toughness$/.test(l) && ctx.cpySaw) return true;
  if (/^round up each time$/.test(l) && ctx.cpySaw) return true;
  // Abyssal Harvester: "exile target creature card from a graveyard that was put there this turn"
  if (/^exile target creature card from a graveyard that was put there this turn$/.test(l)){ const t = T()[0]; ctx.cpyExK = null; if (!t) return true;
    if (!cpyGyThisTurn(t)){ log(`${name}: ${t.nm || info(t.k)?.n} wasn't put into a graveyard this turn`); return true; }
    cpyExileGy(t, name); ctx.cpyExK = t.k; ctx.lastT = [t]; commit(); return true; }
  // Nexus of Becoming: "exile an artifact or creature card from your hand"
  if ((m = l.match(/^exile an? (.+?) card from your hand$/)) && /copy of the exiled card/.test(full)){ const d = m[1]; const list = S.hand.filter(c => descOk(c.k, d)); ctx.cpyExK = null; if (!list.length) return true;
    const ids = UI.dry ? [] : await pickCards({title:`${name}: exile ${/^[aeiou]/.test(d) ? 'an' : 'a'} ${d} card from your hand`, cards:list, min:1, max:1}); const c = list.find(x => x.id === (ids || [])[0]);
    if (c){ ctx.cpyExK = c.k; moveCard(c.id, 'ex', {quiet:true}); log(`${name}: exiled ${cname(c)} from hand`); ctx.didExile = true; } commit(); return true; }
  // Espers to Magicite: remember what "exile each opponent's graveyard" exiles, then choose one of them
  if (/^exile each opponent's graveyard$/.test(l) && /exiled this way/.test(full) && /copy of that card/.test(full)){ ctx.cpyExList = []; for (const p of opponents()) (OPP.get(p.pid)?.gy || []).forEach(k => k && ctx.cpyExList.push({k, pid:p.pid})); return false; }
  if (/^choose up to one target creature card exiled this way$/.test(l)){ const list = (ctx.cpyExList || []).filter(x => isCreatureCard({k:x.k})); ctx.cpyExK = null; if (!list.length) return true;
    const v = UI.dry ? '' : await askChoice({title:`${name}: choose up to one creature card exiled this way`, options:[...list.map((x, i) => ({label:`${info(x.k)?.n} (${nameOf(x.pid)})`, value:String(i)})), {label:'None', value:''}]});
    if (v !== '' && v != null && list[+v]){ ctx.cpyExK = list[+v].k; log(`${name}: chose ${info(ctx.cpyExK)?.n}`); } return true; }
  // Scion of the Ur-Dragon: "search your library for a Dragon permanent card and put it into your graveyard"
  if ((m = l.match(/^search your library for an? (.+?) card and put it into your graveyard$/)) && /becomes a copy of that card/.test(full)){ const d = m[1]; const list = S.lib.filter(c => descOk(c.k, d) && isPermType(info(c.k)?.t || '')); ctx.cpyCard = null;
    const ids = UI.dry || !list.length ? [] : await pickCards({title:`${name}: search for ${/^[aeiou]/.test(d) ? 'an' : 'a'} ${d} card (it goes to your graveyard)`, cards:list, min:0, max:1, noneLabel:'Find nothing'}); const c = list.find(x => x.id === (ids || [])[0]);
    if (c){ moveCard(c.id, 'gy', {quiet:true}); ctx.cpyCard = {t:'gy', pid:MYPID, id:c.id, k:c.k}; ctx.didSearch = true; log(`${name}: put ${cname(c)} into the graveyard`); } else log(`${name}: found nothing`); commit(); return true; }
  // Ochre Jelly: a delayed token copy with half the counters
  if (/^if it had two or more \+1\/\+1 counters on it, create a token that's a copy of it at the beginning of the next end step$/.test(l)){ ctx.cpyJelly = 1; const it = ctx.it || {}; const n = it.evCp != null ? it.evCp : 0; const k = it.evk || ctx.k;
    if (n < 2){ if (!UI.dry) log(`${name}: it had fewer than two +1/+1 counters`); return true; }
    S.dly.push({id:rid(6), eff:`Create a token that's a copy of it with ${Math.floor(n / 2)} +1/+1 counters on it.`, k, nm:name, srcId:null}); log(`${name}: a token copy with ${Math.floor(n / 2)} +1/+1 counters arrives at the next end step`); commit(); return true; }
  if (/^the token enters with half (?:that many|\d+) \+1\/\+1 counters on it, rounded down$/.test(l) && ctx.cpyJelly) return true;
  if ((m = l.match(/^create a token that's a copy of it with (\d+) \+1\/\+1 counters on it$/)) && ctx.it && ctx.it.kind === 'trigger'){ cpyTok(ctx.k, {cp:+m[1]}); commit(); return true; }
  // Flamerush Rider: "create a token that's a copy of another target attacking creature and that's tapped and attacking"
  if (/^create a token that's a copy of another target attacking creature and$/.test(l) && /that's tapped and attacking/.test(full)){ const t = T()[0]; if (!t) return true; const k = cpyKOf(t); const c = boardOf(t.pid).find(b => b.id === t.id); const me = selfObj();
    const tk = cpyTok(k, {tapped:true, atk:(c && c.atk) || (me && me.atk) || (defOpts()[0] || {}).key || ''}); if (tk){ ctx.lastTok = [tk.id]; ctx.lastCardId = tk.id; ctx.cpyFR = 1; } commit(); return true; }
  if (/^that's tapped and attacking$/.test(l) && ctx.cpyFR) return true;
  if (/^exile the token at end of combat$/.test(l)){ if (ctx.lastTok && ctx.lastTok.length) r21bDelay('eoc', false, 'Exile it.', {...ctx, lastT:[]}); return true; }
  // Echoing Assault: "the token enters tapped and attacking that player"
  if (/^the token enters tapped and attacking (?:that|target) player$/.test(l)){ const tk = S.bf.find(b => b.id === ctx.lastCardId); const t = (ctx.lastT || [])[0]; const c = t && S.bf.find(b => b.id === t.id); if (tk){ tk.tap = true; tk.atk = (c && c.atk) || (defOpts()[0] || {}).key || ''; } commit(); return true; }
  // Orvar: "if it targets one or more other permanents you control, create a token that's a copy of one of those permanents"
  if (/^if it targets one or more other permanents you control, create a token that's a copy of one of those permanents$/.test(l)){
    const it = ctx.it || {}; const sp = stackAll().filter(x => x.kind === 'spell' && (it.evId == null || (x.card && x.card.id === it.evId) || x.k === it.evk)).pop(); const me = selfObj();
    const tg = sp ? (sp.tgts || (sp.it && sp.it.tgts) || []).flat().filter(t => t.t === 'card' && t.pid === MYPID && (!me || t.id !== me.id) && S.bf.some(b => b.id === t.id)) : [];
    if (!tg.length){ if (!UI.dry) log(`${name}: it doesn't target another permanent you control`); return true; }
    let pick = tg[0]; if (tg.length > 1 && !UI.dry){ const v = await askChoice({title:`${name}: copy which permanent?`, options:tg.map((t, i) => ({label:info(t.k)?.n, value:String(i)}))}); pick = tg[+v] || pick; }
    cpyTok(cpyKOf(pick)); commit(); return true; }
  // spell copies with copiable-value exceptions: Double Major, Storm of Saruman, The Sixth Doctor
  if (/^copy target creature spell you control, except it isn't legendary if the spell is legendary$/.test(l)){
    let sid = ctx.it && ctx.it.tgt; if (!sid || !stackAll().some(x => x.sid === sid)){ const self = ctx.it && ctx.it.sid; const list = (S.stk || []).filter(x => x.kind === 'spell' && x.sid !== self && x.card && /\bCreature\b/.test(info(x.card.k)?.t || ''));
      if (!list.length){ if (!UI.dry) log(`${name}: no creature spell of yours to copy`); return true; }
      sid = list[list.length - 1].sid; if (list.length > 1 && !UI.dry){ const v = await askChoice({title:`${name}: copy which creature spell?`, options:list.map(x => ({label:x.nm || info(x.k)?.n, value:x.sid}))}); if (v) sid = v; } }
    const n0 = S.stk.length; await copyTargetItem({...ctx, it:{...(ctx.it || {}), tgt:sid}}); cpyFixCopy(n0, {leg:0}); commit(); return true; }
  if (/^copy it, except the copy isn't legendary$/.test(l)){ const it = ctx.it || {}; const sp = stackAll().filter(i => i.kind === 'spell' && (!it.evId || (i.card && i.card.id === it.evId) || i.id === it.evId || i.k === it.evk)).pop();
    if (!sp){ if (!UI.dry) log(`${name}: the spell is gone`); return true; } const n0 = S.stk.length; await copyTargetItem({...ctx, it:{...it, tgt:sp.sid}}); cpyFixCopy(n0, {leg:0}); commit(); return true; }
  // Nalfeshnee: "if it's a permanent spell, the copy gains haste and "At the beginning of the end step, sacrifice ~.""
  if (/^if it's a permanent spell, the copy gains haste and "at the beginning of the end step, sacrifice ~\."?"?$/.test(l)){ const cp = S.stk.slice().reverse().find(x => x.copy && x.kind === 'spell'); if (cp && isPermType(info(cp.k)?.t || '')){ cp.cpyHaste = 1; cp.cpySacEnd = 1; log(`${name}: the copy gains haste and is sacrificed at the end step`); } return true; }
  // Delina: "create one of those tokens" / "roll again"
  if (/^create one of those tokens$/.test(l)){ const row = cpyLines(ctx.k).map(x => tname(x, name)).find(x => /^\d+—\d+ \| create .*token that's a copy/i.test(x)); if (row){ const sen = row.replace(/^\d+—\d+ \| /, '').match(/^(.+?token that's a copy of .+?)(?:\.\s|\.$|$)/i); if (sen) await doSentence(cap(sen[1].replace(/\.$/, '')), ctx); } return true; }
  if (/^roll again$/.test(l) && /\n?\d+—\d+ \|/.test(tname(info(ctx.k)?.o || '', name))){ const r = 1 + Math.floor(Math.random() * 20); ctx.roll = r; log(`🎲 ${name}: rolled a ${r}`);
    if (!UI.dry){ const rows = cpyLines(ctx.k).map(x => tname(x, name)).filter(x => /^\d+(?:—\d+)? \| /.test(x)); for (const row of rows){ const mm = row.match(/^(\d+)(?:—(\d+))? \| /); if (r >= +mm[1] && r <= +(mm[2] || mm[1])){ await doSentence(row, ctx); break; } } } return true; }

  // ---------- "~ becomes a copy of …" ----------
  if ((m = l.match(/^(?:have )?(~|it) (?:becomes?|become) a copy of (?:up to one )?((?:another |other |a second )?target .+?|it|that creature|that card|that token)( until end of turn)?(?:, except (.+))?$/)) && !/^each /.test(l)){
    const me = selfObj(); const what = m[2]; let tg = refT(what); let t = tg[0];
    if (!t && /^that card$/.test(what) && ctx.cpyCard) t = ctx.cpyCard;
    if (!me || !t){ if (!UI.dry) log(`${name}: nothing to copy`); return true; }
    let k = cpyKOf(t); if (!k){ log(`${name}: nothing to copy`); return true; }
    let mv; if ((mv = what.match(/with mana value x$/)) && ctx.it && (info(k)?.mv || 0) !== (ctx.it.x || 0)){ log(`${name}: that has mana value ${info(k)?.mv || 0}, not ${ctx.it.x || 0}`); return true; }
    const pe = exOf(m[4], k); if (!pe) return false;
    cpyBecome(me, cpyApplyEx(k, pe.ex), {eot:!!m[3], src:name}); cpyPost(me, pe.post, {ctl:t.pid === MYPID}); commit(); return true; }
  // Saheeli, Shuri: "target artifact you control becomes a copy of another / a second target …"
  if ((m = l.match(/^target (.+?) you control becomes a copy of (?:another|a second) target (.+?)( until end of turn)?(?:, except (.+))?$/))){
    const a1 = T()[0], a2 = T()[0]; if (!a1 || !a2) return true; const k = cpyKOf(a2); if (!k) return true;
    const pe = exOf(m[4], k); if (!pe) return false; cpyBecomeAny(a1, cpyApplyEx(k, pe.ex), {eot:!!m[3], src:name}); commit(); return true; }
  // Nanogene Conversion, Naga Fleshcrafter, Mirrorform, Brudiclad
  if ((m = l.match(/^each (other creature|other creature you control|nonland permanent you control|other token you control) becomes a copy of (that creature|target non-aura permanent|that token)( until end of turn)?(?:, except (.+))?$/))){
    let t; if (/^target/.test(m[2])) t = T()[0]; else if (m[2] === 'that token') t = ctx.cpyTokPick ? {t:'card', pid:MYPID, id:ctx.cpyTokPick.id} : null; else t = (ctx.lastT || [])[0];
    if (!t){ if (!UI.dry) log(`${name}: nothing chosen`); return true; }
    const k0 = cpyKOf(t); if (!k0) return true; const pe = exOf(m[4], k0); if (!pe) return false; const k = cpyApplyEx(k0, pe.ex); const eot = !!m[3]; let n = 0;
    for (const b of boardsAll()){
      if (m[1] !== 'other creature' && b.pid !== MYPID) continue;
      for (const x of b.bf.slice()){ if (!x.k && !x.fd) continue; if (x.id === t.id && b.pid === (t.pid || MYPID)) continue;
        if (/creature/.test(m[1]) && !(x.fd || isCreatureCard({...x}))) continue; if (/nonland/.test(m[1]) && isLand(x.k)) continue; if (/token/.test(m[1]) && !x.tok) continue;
        cpyBecomeAny({t:'card', pid:b.pid, id:x.id, k:x.k}, k, {eot, src:name, quiet:true}); n++; } }
    log(`${name}: ${n} permanent${n === 1 ? '' : 's'} became copies of ${info(k0)?.n}${eot ? ' until end of turn' : ''}`); commit(); return true; }
  if (/^choose a token you control$/.test(l) && /each other token you control becomes a copy of that token/.test(full)){
    const toks = S.bf.filter(c => c.tok); ctx.cpyTokPick = null; if (!toks.length) return true;
    const ids = UI.dry ? [] : await pickCards({title:`${name}: choose a token — each other token you control becomes a copy of it`, cards:toks, min:1, max:1}); const c = toks.find(x => x.id === (ids || [])[0]); if (c){ ctx.cpyTokPick = c; log(`${name}: chose ${cname(c)}`); } return true; }

  // ---------- "create … token(s) that's a copy of …, except …" ----------
  if ((m = l.match(/^(?:for each (opponent|other opponent), )?(?:you )?create (a|an|one|two|three|x|\d+) (tapped )?(and attacking )?tokens? that(?:'s| is| are) (?:a )?cop(?:y|ies) of (~|it|that creature|that card|the exiled card|that artifact or creature|one of them|(?:another |other )?target [a-z ,\-]+?|one of those creatures)( tapped and attacking (?:that|target) (?:player|opponent))?( attacking that opponent)?(?:, except (.+))?$/)) && (m[8] || m[1] || m[4])){
    const [, fe, cnt, tpd, andAtk, ref, tapAtkP, atkOpp, exc] = m;
    let k0 = null, st = null;
    if (ref === '~'){ const c = selfObj(); k0 = c ? cpyCV(c) : ctx.k; }
    else if (ref === 'the exiled card'){ k0 = ctx.cpyExK || null; if (!k0){ const c = selfObj(); const ex = c && S.ex.find(x => x.r21until === c.id); k0 = ex && ex.k; } if (!k0){ const c = selfObj(); const im = c && (c.g23imps || [])[0]; k0 = im && im.k; } }
    else if (/^that card$/.test(ref) && ctx.cpyExK) k0 = ctx.cpyExK;
    else { const t = refT(ref)[0]; if (t){ k0 = cpyKOf(t); if (t.id != null) st = statsAny({pid:t.pid || MYPID, id:t.id}); } }
    if (!k0){ if (!UI.dry) log(`${name}: nothing to copy`); return true; }
    const pe = exOf(exc, k0); if (!pe) return false;
    const k = cpyApplyEx(k0, pe.ex, st);
    const n = cnt === 'x' ? ((ctx.it && ctx.it.x) || 0) : (wn(cnt) || 1);
    const ids = [];
    if (fe){ const opps = opponents().filter(p => !(p.s && p.s.lost)); const exclude = fe === 'other opponent' ? (String((selfObj() || {}).atk || '').replace(/^p:/, '')) : null;
      for (const p of opps){ if (exclude && p.pid === exclude) continue; for (let i = 0; i < n; i++){ const tk = cpyTok(k, {tapped:true, atk:(tapAtkP || atkOpp) ? 'p:' + p.pid : '', post:pe.post}); if (tk) ids.push(tk.id); } } }
    else for (let i = 0; i < n; i++){ const me = selfObj(); const tk = cpyTok(k, {tapped:!!tpd || !!tapAtkP || !!andAtk, atk:(tapAtkP || andAtk) ? ((me && me.atk) || (defOpts()[0] || {}).key || '') : '', post:pe.post}); if (tk) ids.push(tk.id); }
    if ((pe.ex.add || []).some(x => /return the exiled card/i.test(x))){ const eid = ctx.it && ctx.it.evId; if (eid != null){ S.cpyLinks = S.cpyLinks || {}; ids.forEach(id => { S.cpyLinks[id] = eid; }); } }
    ctx.lastTok = ids; if (ids.length) ctx.lastCardId = ids[ids.length - 1]; commit(); return true; }

  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound24LPre(s, l, ctx)) return; return ds(s0, ctx); };
}
// "enter as a copy" lines are understood only when their exceptions are
{
  const sk = staticKnown;
  staticKnown = function(l){
    try { const t = String(l).trim(); const m = t.match(CPY_CLONE); if (m){ if (!m[6]) return true; const r = cpyExc(m[6], {self:'~', line:t, cloneLine:t, lines:[t], tgtK:null, tok:false, x:0}); return !!r; } } catch (e){ console.warn(e); }
    return sk(l);
  };
}
// a permanent that is still choosing what to enter as a copy of (a replacement effect, 614.1c) is not yet checked by state-based actions
{
  const sb = sba;
  sba = function(...a){
    const held = []; try { if (S) for (let i = S.bf.length - 1; i >= 0; i--) if (S.bf[i] && S.bf[i].cpyCl === 2) held.unshift([i, S.bf.splice(i, 1)[0]]); } catch {}
    try { return sb.apply(this, a); } finally { for (const [i, c] of held) if (!S.bf.includes(c)) S.bf.splice(Math.min(i, S.bf.length), 0, c); }
  };
}

/* ---------- Moonlit Meditation: the first token creation each turn may make copies of the enchanted permanent ---------- */
const CPY_MOON = /the first time you would create one or more tokens each turn, you may instead create that many tokens that are copies of enchanted permanent/i;
STATIC_KNOWN.push(/^the first time you would create one or more tokens each turn, you may instead create that many tokens that are copies of enchanted permanent$/);
{
  const ct = createToken;
  createToken = function(k, n, near, o){
    let moon = null;
    try { if (S && !UI.dry && !CPY.moonBusy && S.cpyMoon !== turnStr()) moon = S.bf.find(c => !c.fd && c.att && c.att.pid === MYPID && CPY_MOON.test(info(c.k)?.o || '') && S.bf.some(b => b.id === c.att.id && !b.fd)); } catch {}
    if (!moon) return ct(k, n, near, o);
    S.cpyMoon = turnStr(); const host = S.bf.find(b => b.id === moon.att.id); const ck = cpyCV(host);
    const hid = S.bf.filter(c => c.tok && c.k === k && !c.fd); hid.forEach(c => { c.fd = true; c.cpyTmp = 1; });
    const ids0 = new Set(S.bf.map(c => c.id)); CPY.hold = []; CPY.moonBusy = true; let r;
    try { r = ct(k, n, near, o); } finally { CPY.moonBusy = false; hid.forEach(c => { delete c.fd; delete c.cpyTmp; }); }
    const made = S.bf.filter(c => !ids0.has(c.id) && c.tok); const held = CPY.hold || []; CPY.hold = null;
    made.forEach(c => { c.cpyPend = 1; });
    (async () => {
      const yes = made.length && host && await askYes(`${cname(moon)}: create ${made.reduce((a, c) => a + (c.n || 1), 0)} token cop${made.length === 1 && (made[0].n || 1) === 1 ? 'y' : 'ies'} of ${cname(host)} instead of ${info(k)?.n}?`, 'Copies', `${info(k)?.n} tokens`);
      for (const c of made){ delete c.cpyPend; if (yes){ c.k = ck; c.copy = true; } }
      if (yes) log(`${cname(moon)}: created copies of ${info(ck)?.n} instead`);
      for (const ev of held){ if (yes && made.some(c => c.id === ev.id)) ev.k = ck; CPY.emit0(ev); }
      commit();
    })();
    return r;
  };
  const em = emit; CPY.emit0 = em;
  emit = function(ev){ if (CPY.hold && ev && ev.type === 'enter' && ev.tok){ CPY.hold.push(ev); return; } return em(ev); };
}

/* ---------- Summon: Good King Mog XII: "whenever you cast a noncreature spell this turn, create a token that's a copy of a non-Saga token you control" ---------- */
async function doRound24LPre2(s, l, ctx){
  const name = ctx.name || '';
  if (/^whenever you cast a noncreature spell this turn, create a token that's a copy of a non-saga token you control$/.test(l)){
    if (!UI.dry){ const T = turnStr(); if (!S.cpyMog || S.cpyMog.t !== T) S.cpyMog = {t:T, n:0, k:ctx.k, nm:name, src:ctx.srcId ?? null}; S.cpyMog.n++; log(`${name}: this turn, each noncreature spell you cast makes a token copy`); commit(); }
    return true; }
  if (/^create a token that's a copy of a non-saga token you control$/.test(l)){
    const list = S.bf.filter(c => c.tok && !c.fd && !/\bSaga\b/.test(typeOf(c))); if (!list.length){ if (!UI.dry) log(`${name}: no non-Saga token to copy`); return true; }
    let c = list[0]; if (list.length > 1 && !UI.dry){ const ids = await pickCards({title:`${name}: copy which token?`, cards:list, min:1, max:1}); c = list.find(x => x.id === (ids || [])[0]) || c; }
    cpyTok(cpyCV(c)); commit(); return true; }
  // Hofri's Spirit token: "When this token leaves the battlefield, return the exiled card to its owner's graveyard."
  if (/^return the exiled card to its owner's graveyard$/.test(l)){ const id = S.cpyLinks && ctx.srcId != null ? S.cpyLinks[ctx.srcId] : null; if (id == null){ if (!UI.dry) log(`${name}: no exiled card`); return true; } delete S.cpyLinks[ctx.srcId]; if (find(id)[0] === 'ex'){ moveCard(id, 'gy', {quiet:true}); log(`${name}: returned ${cname(find(id)[2])} to the graveyard`); } commit(); return true; }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound24LPre2(s, l, ctx)) return; return ds(s0, ctx); };
  const em = emit;
  emit = function(ev){
    const r = em(ev);
    try { if (S && ev && ev.type === 'cast' && S.cpyMog && S.cpyMog.t === turnStr() && !UI.dry && !/\bCreature\b/.test(info(ev.k)?.t || '')){
      for (let i = 0; i < S.cpyMog.n; i++){ const it = {sid:rid(6), o:nextO(), kind:'trigger', k:S.cpyMog.k, nm:S.cpyMog.nm, txt:"Create a token that's a copy of a non-Saga token you control.", srcId:S.cpyMog.src}; S.stk.push(it); S.pass = 's:' + it.sid; }
      log(`${S.cpyMog.nm}: triggers`); commit(); } } catch (e){ console.warn(e); }
    return r;
  };
}
// "target artifact, creature, enchantment, or land" (Mirage Mirror): a comma list of card types is one target description
{
  const ts = targetSpecs;
  targetSpecs = function(t){
    const out = ts(t);
    try { const low = String(t || '').toLowerCase(); const re = /\btarget ((?:(?:non)?(?:artifact|creature|enchantment|land|planeswalker|battle|permanent), )+(?:or|and\/or) (?:non)?(?:artifact|creature|enchantment|land|planeswalker|battle|permanent))\b/g; let m;
      while ((m = re.exec(low))){ const items = m[1].split(/,\s*(?:or\s+|and\/or\s+)?/).map(x => x.trim()).filter(Boolean); const sp = out.find(x => x.zone === 'bf' && x.desc === items[0]); if (sp) sp.desc = items.join(' or '); } } catch {}
    return out;
  };
}
// engine24m marks nonlegendary spell copies with m24nl (Double Major, Storm of Saruman, The Sixth Doctor): give the token a real nonlegendary copy face
{
  const oe = onEnter;
  onEnter = function(c, from, o = {}){
    try { if (c && c.tok && c.m24nl && /\bLegendary\b/.test(info(c.k)?.t || '')){ const i = S.recent.indexOf(c.k); c.k = cpyKey(c.k, {leg:0}); if (i >= 0) S.recent[i] = c.k; } } catch (e){ console.warn(e); }
    return oe(c, from, o);
  };
}
