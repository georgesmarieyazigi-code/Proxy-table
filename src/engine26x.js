/* ===================== Rules engine — round 26 helper X: state-based actions (CR 704) =====================
   Every client checks its own permanents and its own player state (704.3), repeating until nothing changes:
   - legend rule (704.5j), with "the legend rule doesn't apply" effects (Mirror Box, Sakashima, Cadric, The Master, Sliver Gravemother,
     Mirror Gallery, Hall of Echoes this turn); copies compare by the copy's name, nonlegendary copies are exempt
   - creatures/planeswalkers that die to SBAs are found first and then all leave together (704.3 / 704.8), face-down 2/2s included;
     leaves-the-battlefield triggers look back (603.10a), so creatures dying at the same time see each other die
   - drawing from an empty library loses (704.5b); "can't lose the game" (Platinum Angel, Cloudsteel Kirin, Abyssal Persecutor,
     Angel's Grace) stops every way of losing, without repeating the "out of the game" log every tick
   - Saga with its final chapter and no chapter ability on the stack (704.5s), dungeon completed (704.5t), world rule (704.5k),
     Auras / Equipment / Fortifications / bestowed or other attached permanents that are attached illegally (704.5m/n/p),
     +1/+1 and −1/−1 counter annihilation (704.5q), one Role per controller per permanent (704.5y), tokens and card copies
     outside the battlefield (704.5d/e), a Siege protected by its own controller (704.5w/x), Ring-bearer under another player's control */

const R26X = {};
const r26T = () => (typeof turnStr === 'function' ? turnStr() : '');
const r26Live = () => { try { const t = S && currentTurn(); return !!(t && t[0] > 0); } catch { return false; } };
// SBAs that move permanents around wait until no spell or ability is in the middle of resolving (704.3: only when a player would receive priority)
const r26Quiet = () => !UI.resolving && !UI.casting && !UI.dry;
const r26Name = c => { const f = c && !c.fd && faceOf(c); return f ? String(f.n || '') : ''; };
const r26Txt = c => { const f = c && !c.fd && faceOf(c); return f ? tname(f.o || '', f.n || '').toLowerCase().replace(/[“”]/g, '"') : ''; };
const r26Sents = c => r26Txt(c).split('\n').flatMap(l => l.split(/\.\s*/)).map(s => s.trim()).filter(Boolean);
const r26Cnt = c => c.n || 1;
// remove all but `keep` tokens from a token stack: they go to the graveyard (and cease to exist), triggering like a death (not a sacrifice)
function r26Trim(c, keep){
  const k = r26Cnt(c) - keep; if (k <= 0) return; c.n = keep; if ((c.tn || 0) > c.n) c.tn = c.n;
  for (let i = 0; i < Math.min(k, 30); i++){ emit({type:'leave', k:c.k, id:c.id, tok:1}); if (isCreatureCard(c)) emit({type:'die', k:c.k, id:c.id, tok:1}); }
}

/* ---------- statics and effects that switch the legend rule off ---------- */
STATIC_RULES.push(
  [/^the "legend rule" doesn't apply$/, m => ({kind:'noLegend', who:'all'})],
);
STATIC_KNOWN.push(/^the "legend rule" doesn't apply$/);
function r26ScopePred(d){
  d = String(d || '').trim();
  if (/^permanents$/.test(d)) return () => true;
  const tok = /\btokens?\b/.test(d); const w = d.replace(/\btokens?\b/, '').trim().replace(/s$/, '');
  return c => (!tok || !!c.tok) && (!w || w === 'permanent' || (w === 'creature' ? isCreatureCard(c) : new RegExp('\\b' + w.replace(/[^a-z' -]/g, '') + '\\b', 'i').test(typeOf(c))));
}
function r26NoLegend(){
  const out = []; if (S.r26noLegT && S.r26noLegT === r26T()) out.push(() => true);
  const scan = (bf, mine) => bf.forEach(b => { if (!b.k || b.fd) return; for (const s of r26Sents(b)){ let m;
    if (/^the "legend rule" doesn't apply$/.test(s)) out.push(() => true);
    else if (mine && (m = s.match(/^the "legend rule" doesn't apply to (.+?) you control$/))) out.push(r26ScopePred(m[1])); } });
  scan(S.bf, true); for (const [, st] of OPP) scan(st.bf || [], false);
  return out;
}
async function doRound26XPre(s, l, ctx){
  if (/^the ["“]legend rule["”] doesn't apply to permanents you control this turn$/.test(l)){ S.r26noLegT = r26T(); log(`${ctx.name}: the legend rule doesn't apply to their permanents this turn`); commit(); return true; }
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound26XPre(s, l, ctx)) return; return ds(s0, ctx); }; }

// Role tokens (111.10t): when the source card brings no token data, build the real Role Aura instead of a generic creature named "Role"
const R26_ROLES = {cursed:'Enchant creature\nEnchanted creature has base power and toughness 1/1.', monster:'Enchant creature\nEnchanted creature gets +1/+1 and has trample.',
  royal:'Enchant creature\nEnchanted creature gets +1/+1 and has ward {1}.', sorcerer:'Enchant creature\nEnchanted creature gets +1/+1 and has "Whenever this creature attacks, scry 1."',
  virtuous:'Enchant creature\nEnchanted creature gets +1/+1 for each enchantment you control.', wicked:'Enchant creature\nEnchanted creature gets +1/+1.\nWhen this Aura is put into a graveyard from the battlefield, each opponent loses 1 life.',
  'young hero':'Enchant creature\nEnchanted creature has "Whenever this creature attacks, if its toughness is 3 or less, put a +1/+1 counter on it."'};
function r26RoleKey(w){ const nm = w.replace(/\b\w/g, x => x.toUpperCase()) + ' Role'; const k = 'r26role:' + w; if (!DICT.has(k)) DICT.set(k, {k, n:nm, m:'', t:'Token Enchantment — Aura Role', o:R26_ROLES[w], p:'', img:'', c:'', back:null, toks:[], tok:true, cc:false, lay:'token', full:nm, set:'', cn:'', pr:'', art:'', mv:0, ci:'', kw:[]}); return k; }
{
  const cft = createFromText;
  createFromText = async function(s, ctx = {}){
    try { const m = String(s || '').match(/^create an? (cursed|monster|royal|sorcerer|virtuous|wicked|young hero) role token\b/i);
      if (m && S && !((info(ctx && ctx.k)?.toks) || []).length){ const k = r26RoleKey(m[1].toLowerCase()); createToken(k, 1); const tk = S.bf.filter(c => c.k === k).pop(); if (tk && ctx) ctx.lastTok = [tk.id]; return; } } catch (e){ console.warn('r26 role', e); }
    return cft(s, ctx);
  };
}

/* ---------- legend rule (704.5j) ---------- */
const r26IsLegend = c => !!(c && c.k && !c.fd && !c.nonLeg && (/\bLegendary\b/.test(typeOf(c)) || (c.ring && (S.ring || 0) > 0 && isCreatureCard(c))));
function r26LegendGroups(){
  const g = new Map(); const tot = l => l.reduce((a, c) => a + r26Cnt(c), 0);
  for (const c of S.bf){ if (!r26IsLegend(c) || c.cpyCl === 2 || c.cpyPend) continue; const n = r26Name(c); if (!n) continue; (g.get(n) || g.set(n, []).get(n)).push(c); }
  const hot = [...g.entries()].filter(([, l]) => tot(l) >= 2); if (!hot.length) return hot;
  const free = r26NoLegend(); if (!free.length) return hot;
  return hot.map(([n, l]) => [n, l.filter(c => !free.some(f => f(c)))]).filter(([, l]) => tot(l) >= 2);
}
function r26Legend(){
  if (!r26Live() || UI.dry || R26X.legBusy) return false; const groups = r26LegendGroups(); if (!groups.length) return false;
  let ch = false;
  for (const [nm, list] of groups){
    if (list.length === 1){ const c = list[0]; const k = r26Cnt(c) - 1; r26Trim(c, 1); log(`legend rule: ${k} ${nm} token${k === 1 ? '' : 's'} put into the graveyard (kept one)`); ch = true; continue; }
    if (!r26Quiet() || UI.modal) continue;   // the choice waits for a free screen
    R26X.legBusy = true;
    (async () => {
      try {
        const ids = await pickCards({title:`Legend rule: you control ${list.reduce((a, c) => a + r26Cnt(c), 0)} legendary permanents named ${nm} — choose the one to keep (the rest go to the graveyard)`, cards:list, min:1, max:1});
        const now = list.filter(c => S.bf.includes(c) && r26IsLegend(c) && r26Name(c) === nm); if (now.length < 1) return;
        const keep = now.find(c => ids && c.id === ids[0]) || now[0];
        const gone = now.filter(c => c !== keep);
        gone.forEach(c => moveCard(c.id, 'gy', {quiet:true})); if (r26Cnt(keep) > 1) r26Trim(keep, 1);
        if (gone.length) log(`legend rule: kept ${cname(keep)}, put ${gone.length === 1 ? 'the other' : gone.length + ' others'} into the graveyard`);
        commit();
      } catch (e){ console.warn('r26 legend', e); } finally { R26X.legBusy = false; try { queueRender(); } catch {} }
    })();
    break;
  }
  if (ch) commit(); return ch;
}

/* ---------- creatures and planeswalkers: found first, then put into the graveyard together (704.3, 704.5f–i) ---------- */
function r26Doomed(){
  const out = [];
  for (const c of S.bf){
    if (!c.k && !(c.fd && c.fdc)) continue; if (c.fd && !c.fdc) continue; if (c.cpyCl === 2) continue;
    if (isCreatureCard(c)){
      const st = stats(c); if (!st) continue;
      if (st[1] <= 0){ out.push({c, why:'t', v:st[1]}); continue; }
      const ind = !c.fd && kwOf(c, 'indestructible');
      if (!ind && ((c.dmg || 0) >= st[1] || (c.dtd && c.dmg > 0))){ out.push({c, why:'d'}); continue; }
    }
    if (!c.fd && isPW(c) && c.pw && (c.co || 0) <= 0) out.push({c, why:'pw'});
  }
  return out;
}
function r26Deaths(){
  const list = r26Doomed(); if (!list.length) return false; let ch = false;
  for (const {c, why, v} of list){
    if (!S.bf.includes(c)) continue; const nm = c.fd ? 'a face-down creature' : cname(c);
    if (why === 't'){ log(`${nm} died (toughness ${v})`); moveCard(c.id, 'gy', {quiet:true}); ch = true; }
    else if (why === 'd'){ if (c.regen > 0){ c.regen--; c.tap = true; c.dmg = 0; c.dtd = 0; log(`${nm} regenerated`); ch = true; continue; } log(`${nm} died (lethal damage)`); moveCard(c.id, 'gy', {quiet:true}); ch = true; }
    else { log(`${nm} has no loyalty left`); moveCard(c.id, 'gy', {quiet:true}); ch = true; }
  }
  return ch;
}
// leaves-the-battlefield abilities look back in time (603.10a): a permanent that left in the same event still sees the others leave
{
  const he = handleEvent;
  handleEvent = function(pid, ev){
    const r = he(pid, ev);
    try {
      if (S && ev && (ev.type === 'die' || ev.type === 'leave') && Array.isArray(UI.curQ)){
        const seen = new Set();
        for (const [p2, e2] of UI.curQ){
          if (p2 !== MYPID || !e2 || e2.type !== 'leave' || e2.id === ev.id || e2.id == null || seen.has(e2.id) || !e2.k) continue; seen.add(e2.id);
          if (S.bf.some(b => b.id === e2.id && !b.fd)) continue;
          const s = {k:e2.k, fl:false, id:e2.id, r26lb:1};
          for (const t of trigsOf(s.k, s.fl)){
            if (t.ev !== ev.type && !(t.evs && t.evs.includes(ev.type))) continue;
            if (t.subj === 'self' || !t.subj) continue; if (/~ is in your graveyard|(?:return|cast|exile) ~ from your graveyard/i.test(String(t.raw || ''))) continue;
            let evT = ev; if (t.batch){ const nq = (UI.curQ || []).filter(([p3, e3]) => e3.type === ev.type && p3 === pid && (!t.desc || descOk(e3.k, t.desc, {tok:e3.tok}))).reduce((a, x) => a + (x[1].cnt || 1), 0); evT = {...ev, amt:nq || 1, cnt:1}; }
            if (t.batch){ const bk = s.id + '|' + t.raw; UI.batch = UI.batch || new Set(); if (UI.batch.has(bk)) continue; UI.batch.add(bk); }
            if (!subjMatch(t, s, ev, pid)) continue;
            const times = Math.min((evT.cnt || 1) * (typeof trigMult === 'function' ? trigMult(ev, s) : 1), 30);
            for (let i = 0; i < times; i++) pushTrigger(s, t, evT, pid);
          }
        }
      }
    } catch (e){ console.warn('r26 lookback', e); }
    return r;
  };
}

/* ---------- drawing from an empty library (704.5b) ---------- */
{
  const dr = draw;
  draw = function(n = 1, ...a){
    let want = 0; try { if (S && !UI.dry && r26Live() && n > 0 && !rulesOn('labMan').length && drawAllowed().ok) want = n - S.lib.length; } catch {}
    const r = dr(n, ...a);
    try { if (want > 0 && S && !S.lib.length && !rulesOn('labMan').length){ S.r26empty = 1; log('tried to draw from an empty library'); commit(); } } catch {}
    return r;
  };
}

/* ---------- "can't lose the game" ---------- */
function r26CantLose(){
  if (!S) return ''; const T = r26T();
  const a = rulesOn('noLose')[0]; if (a) return a.src;
  if (S.bf.some(c => c.b26noLose && !c.fd && c.k)) return 'it gained "you can\'t lose the game"';
  const p = rulesOn('r23kPersecutor')[0]; if (p) return p.src;
  if (S.r23noLose === T) return 'this turn';
  if ([...OPP.values()].some(st => st.r23noLose === T && st.r23ell === T)) return 'this turn';
  // Cloudsteel Kirin: equipped/enchanted creature has "You can't lose the game …"
  for (const b of boardsAll()) for (const x of b.bf){
    if (!x.k || x.fd || !x.att || x.att.pid !== MYPID || x.att.id == null) continue;
    if (!/(?:equipped|enchanted) creature has [^"\n]*"you can't lose the game/i.test(r26Txt(x))) continue;
    const h = S.bf.find(c => c.id === x.att.id && !c.fd && isCreatureCard(c)); if (h) return info(x.k)?.n || 'an attachment';
  }
  return '';
}
{
  const lg = log;
  log = function(s, ...a){
    try {
      const t = String(s || '');
      if (UI.r26mute && /^☠ is out of the game/.test(t)){ UI.r26muted = t; return; }
      if (/^doesn't lose the game at -?\d+ life/.test(t)){ if (UI.r26lastNL === t) return; UI.r26lastNL = t; }
    } catch {}
    return lg(s, ...a);
  };
  const ts = toast;
  toast = function(m, ...a){ try { if (UI.r26mute && /^You're out of the game/.test(String(m || ''))) return; } catch {} return ts(m, ...a); };
}

/* ---------- other state-based actions ---------- */
function r26EnchOk(desc, host, hpid){
  let d = String(desc || '').toLowerCase().trim(); if (!d || /graveyard|\bcard\b|player|opponent$/.test(d)) return true;
  let ctl = null;
  if (/ you control$/.test(d)){ ctl = 'you'; d = d.replace(/ you control$/, ''); }
  else if (/ (?:an opponent controls|you don't control)$/.test(d)){ ctl = 'opp'; d = d.replace(/ (?:an opponent controls|you don't control)$/, ''); }
  if (ctl === 'you' && hpid !== MYPID) return false; if (ctl === 'opp' && hpid === MYPID) return false;
  if (hpid !== MYPID) return true;   // another player's layer effects aren't all public: only the controller part is checked there
  const ty = typeOf(host); const alts = d.split(/,\s*(?:or\s+)?|\s+or\s+/).map(x => x.trim()).filter(Boolean); let unknown = false;
  for (const a of alts){
    const m = a.match(/^(?:(tapped|untapped|legendary|nonlegendary|basic|nonbasic|snow) )?(non)?(creature|land|artifact|enchantment|planeswalker|battle|permanent)(?: (permanent|creature))?$/);
    if (!m){ if (/^[a-z]+$/.test(a) && !/^(an?|the)$/.test(a)){ if (new RegExp('\\b' + a + '\\b', 'i').test(ty)) return true; continue; } unknown = true; continue; }
    const has = w => w === 'permanent' ? true : w === 'creature' ? isCreatureCard(host) : new RegExp('\\b' + w + '\\b', 'i').test(ty);
    let ok = m[2] ? !has(m[3]) : has(m[3]); if (m[4] && !has(m[4])) ok = false;
    const md = m[1]; if (md === 'tapped' && !host.tap) ok = false; if (md === 'untapped' && host.tap) ok = false; if (md === 'legendary' && !/Legendary/.test(ty)) ok = false; if (md === 'nonlegendary' && /Legendary/.test(ty)) ok = false;
    if (md === 'basic' && !/Basic/.test(ty)) ok = false; if (md === 'nonbasic' && /Basic/.test(ty)) ok = false; if (md === 'snow' && !/Snow/.test(ty)) ok = false;
    if (ok) return true;
  }
  return unknown;
}
const r26Prot = (host, s) => { try { const src = {col:String(info(s.k)?.c || ''), types:typeOf(s)}; if (protects(host, src)) return true; const ek = (host.ekw || []).filter(x => /^protection from /.test(x)).map(x => x.replace(/^protection from /, '').replace(/s$/, ''));
  return ek.some(x => x === 'everything' || (COLW[x] && src.col.includes(COLW[x])) || new RegExp('\\b' + x + '\\b', 'i').test(src.types)); } catch { return false; } };
function r26Attach(){
  let ch = false;
  for (const s of S.bf.slice()){
    if (!s.att || s.att.id == null || !s.k || s.fd || s.r23anim || s.cpyCl === 2) continue;
    const hpid = s.att.pid; const host = boardOf(hpid).find(x => x.id === s.att.id); if (!host || !host.k || host.fd) continue;
    const ty = typeOf(s);
    if (s.r21bbestow){ if (hpid === MYPID && !isCreatureCard(host) || r26Prot(host, s)){ delete s.att; delete s.r21bbestow; log(`${cname(s)} is no longer bestowed — it's a creature again`); ch = true; } continue; }
    if (/\bAura\b/.test(ty)){
      let why = '';
      if (host === s || (hpid === MYPID && host.id === s.id)) why = "it can't enchant itself";
      else if (isCreatureCard(s)) why = "an Aura that's also a creature can't enchant anything";
      else { const d = enchantDesc(textOf(s)); if (d && !r26EnchOk(d, host, hpid)) why = `${cname(host)} isn't a legal ${d} any more`; else if (r26Prot(host, s)) why = `${cname(host)} has protection from it`; }
      if (why){ delete s.att; log(`${cname(s)} went to the graveyard — ${why}`); moveCard(s.id, 'gy', {quiet:true}); ch = true; }
      continue;
    }
    if (/\bEquipment\b/.test(ty)){
      let why = '';
      if (host === s) why = "it can't equip itself";
      else if (isCreatureCard(s) && !/^reconfigure\b/im.test(textOf(s))) why = "it's a creature";
      else if (hpid === MYPID && !isCreatureCard(host)) why = `${cname(host)} isn't a creature`;
      else if (r26Prot(host, s)) why = `${cname(host)} has protection from it`;
      if (why){ delete s.att; log(`${cname(s)} became unattached — ${why}`); ch = true; }
      continue;
    }
    if (/\bFortification\b/.test(ty)){ if (hpid === MYPID && !isLand(host.k) && !/\bLand\b/.test(typeOf(host))){ delete s.att; log(`${cname(s)} became unattached — ${cname(host)} isn't a land`); ch = true; } continue; }
    if (isCreatureCard(s) || /\bBattle\b/.test(ty)){ delete s.att; log(`${cname(s)} became unattached — a ${isCreatureCard(s) ? 'creature' : 'battle'} can't be attached`); ch = true; }
  }
  return ch;
}
function r26Counters(){ let ch = false; for (const c of S.bf){ if (c.cp > 0 && c.cm > 0){ const n = Math.min(c.cp, c.cm); cancelCounters(c); log(`${cname(c)}: ${n} +1/+1 and ${n} −1/−1 counter${n === 1 ? '' : 's'} removed`); ch = true; } } return ch; }
function r26Sagas(){
  let ch = false; const stk = (typeof stackAll === 'function' ? stackAll() : S.stk) || [];
  for (const c of S.bf.slice()){
    if (c.fd || !c.k || !/\bSaga\b/.test(typeOf(c))) continue; const ch0 = sagaChapters(c); if (!ch0 || !ch0.length) continue;
    const max = Math.max(...ch0.map(x => x.n)); if ((c.lore || 0) < max) continue;
    if (stk.some(x => x && x.srcId === c.id && (x.op === 'saga' || /\(chapter /.test(String(x.nm || ''))))) continue;
    log(`${cname(c)} has its final chapter and no chapter ability waiting — sacrificed`); sacrificeOne(c); ch = true;
  }
  return ch;
}
function r26Roles(){
  let ch = false; const by = new Map();
  for (const c of S.bf){ if (!c.k || c.fd || !c.att || c.att.id == null || !/\bRole\b/.test(typeOf(c))) continue; const key = c.att.pid + '|' + c.att.id; (by.get(key) || by.set(key, []).get(key)).push(c); }
  for (const list of by.values()){ if (list.length < 2) continue; list.sort((a, b) => ((a.r26ts || 0) - (b.r26ts || 0)) || (a.id - b.id)); const keep = list[list.length - 1];
    list.slice(0, -1).forEach(c => { delete c.att; log(`${cname(c)} went to the graveyard — only the newest Role (${cname(keep)}) stays`); moveCard(c.id, 'gy', {quiet:true}); ch = true; }); }
  return ch;
}
const r26World = c => c && c.k && !c.fd && /\bWorld\b/.test(typeOf(c));
function r26Worlds(){
  const mine = S.bf.filter(r26World); if (!mine.length) return false;
  const all = mine.map(c => c.r26ts || 0); for (const [, st] of OPP) (st.r26w || []).forEach(x => all.push(x[1] || 0));
  if (all.length < 2) return false; const top = Math.max(...all); const tie = all.filter(t => t === top).length > 1;
  let ch = false; mine.forEach(c => { if ((c.r26ts || 0) < top || tie){ log(`world rule: ${cname(c)} is put into the graveyard`); moveCard(c.id, 'gy', {quiet:true}); ch = true; } }); return ch;
}
function r26Zones(){
  let ch = false;
  for (const z of ['hand', 'gy', 'ex', 'lib', 'cz']){ const arr = S[z]; if (!Array.isArray(arr)) continue;
    for (let i = arr.length - 1; i >= 0; i--){ const c = arr[i]; if (c && c.tok && !c.emb){ arr.splice(i, 1); log(`${cname(c)} token ceased to exist (${ZNAME[z] || z})`); ch = true; } } }
  return ch;
}
function r26Dungeon(){
  const dg = S.dg; if (!dg || typeof DUNGEONS === 'undefined' || !DUNGEONS[dg.d] || !DUNGEONS[dg.d][dg.r]) return false; if ((DUNGEONS[dg.d][dg.r][2] || []).length) return false;
  const stk = (typeof stackAll === 'function' ? stackAll() : S.stk) || []; if (stk.some(x => x && String(x.nm || '').startsWith(dg.d + ' — '))) return false;
  S.dgDone = (S.dgDone || 0) + 1; S.dgList = (S.dgList || []).concat(dg.d); S.dg = null; log(`completed ${dg.d}`); return true;
}
function r26Ring(){
  let ch = false; const rb = S.bf.filter(c => c.ring);
  rb.forEach(c => { if (c.own){ c.ring = 0; log(`${cname(c)} is no longer a Ring-bearer (another player controls it now)`); ch = true; } });
  const left = S.bf.filter(c => c.ring); if (left.length > 1){ left.sort((a, b) => (a.tok ? 1 : 0) - (b.tok ? 1 : 0) || a.id - b.id); left.slice(1).forEach(c => { c.ring = 0; }); ch = true; }
  return ch;
}
function r26Battles(){
  let ch = false;
  for (const c of S.bf.slice()){
    if (c.fd || !c.k || !isBattle(c) || !c.bt) continue; if (S.cb) continue;
    const opp = opponents(); const bad = !c.prot || (c.prot === MYPID && /\bSiege\b/.test(typeOf(c))) || (c.prot !== MYPID && !OPP.has(c.prot));
    if (!bad) continue;
    if (!opp.length){ log(`${cname(c)} has no player who can protect it — put into the graveyard`); moveCard(c.id, 'gy', {quiet:true}); ch = true; continue; }
    if (opp.length === 1 || UI.modal || R26X.batBusy){ if (opp.length === 1){ c.prot = opp[0].pid; log(`${cname(c)} is now protected by ${nameOf(c.prot)}`); ch = true; } continue; }
    R26X.batBusy = true; (async () => { try { const v = await askChoice({title:`${cname(c)}: choose an opponent to protect it`, options:opp.map(p => ({label:p.nm, value:p.pid}))}); c.prot = v || opp[0].pid; log(`${cname(c)} is now protected by ${nameOf(c.prot)}`); commit(); } finally { R26X.batBusy = false; } })();
  }
  return ch;
}
// a permanent gets a new timestamp each time it enters (613.7d); used by the world rule and the Role rule
{ const oe = onEnter; onEnter = function(c, ...a){ try { if (c) c.r26ts = Date.now(); } catch {} return oe(c, ...a); }; }
// world timestamps are published so every client can compare them
{
  const ep = enginePublic;
  enginePublic = function(){ const o = ep(); try { const w = S.bf.filter(r26World).map(c => [c.id, c.r26ts || 0]).slice(0, 10); if (w.length) o.r26w = w; } catch {} return o; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); try { if (Array.isArray(s.r26w)) o.r26w = s.r26w.slice(0, 10).filter(Array.isArray).map(x => [Number(x[0]) || 0, Number(x[1]) || 0]); } catch {} return o; };
}

/* ---------- the check: performed until nothing changes ---------- */
{
  const sb = sba;
  const sig = () => S.bf.map(c => c.id + ':' + r26Cnt(c) + (c.att ? '@' + c.att.id : '')).join(',') + '|' + S.gy.length + '|' + S.ex.length + '|' + (S.lost || '');
  const once = function(self, a){
    let ch = false;
    try { const now = Date.now(); S.bf.forEach(c => { if (!c.r26ts) c.r26ts = now; }); } catch {}
    const shield = r26CantLose();
    // 704.5b
    if (S.r26empty){ S.r26empty = 0; if (shield){ log(`drew from an empty library but can't lose the game (${shield})`); }
      else { S.g23lost = 1; S.qLoseMsg = 'lost the game (drew from an empty library)'; log('☠ loses the game — drew from an empty library'); toast('You lose the game: you drew from an empty library'); ch = true; } }
    try { if (r26Deaths()) ch = true; } catch (e){ console.warn('r26 deaths', e); }
    if (r26Live()){
      for (const f of [r26Counters, r26Zones, r26Ring, r26Dungeon]) try { if (f()) ch = true; } catch (e){ console.warn('r26', f.name, e); }
      if (r26Quiet()) for (const f of [r26Attach, r26Sagas, r26Roles, r26Worlds, r26Battles]) try { if (f()) ch = true; } catch (e){ console.warn('r26', f.name, e); }
      try { if (r26Legend()) ch = true; } catch (e){ console.warn('r26 legend', e); }
    }
    UI.r26mute = !!shield; UI.r26muted = null; let r;
    try { r = sb.apply(self, a); } finally { UI.r26mute = false; }
    if (shield && S.lost){ S.lost = ''; S.g23lost = 0; S.r23kLost = 0; const msg = `can't lose the game (${shield})`; if (S.r26nl !== msg){ S.r26nl = msg; log(msg); } }
    else if (S.lost && UI.r26muted){ log(UI.r26muted); }
    if (!shield) S.r26nl = '';
    if (ch) commit();
    return !!(r || ch);
  };
  sba = function(...a){
    if (!S) return sb.apply(this, a);
    let any = false;
    for (let i = 0; i < 6; i++){ const s0 = sig(); const r = once(this, a); any = any || r; if (sig() === s0) break; }
    return any;
  };
}
