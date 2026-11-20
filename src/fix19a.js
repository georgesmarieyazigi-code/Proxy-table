/* ===== fix19a: taking opponents' permanents and cards (gain / exchange / donate control) — helper L, 6 Nov =====
   1. Targets: "gain control of target creature for as long as …" / "… with an equal or lesser mana value" no longer
      break the target description (Sower of Temptation, Dragonlord Silumgar, Mind Flayer, Rubinia, Olivia, Kellogg,
      Yuffie, Roil Elemental, Scroll of Isildur, Puca's Mischief had no legal targets, so nothing was stolen).
   2. Durations "for as long as": the new controller tracks the condition (the source stays on the battlefield under
      their control / stays tapped / the creature's power stays ≤ the source's power) and the permanent goes home the
      moment it fails — including when the source changes controller, not only when it leaves.
      "You may choose not to untap ~ during your untap step" (Vedalken Shackles, Old Man of the Sea, Rubinia): while
      it holds something it stays tapped and its controller is asked whether to untap it.
   3. Effects that follow a control change: requests aimed at a permanent its owner has just given away (the pump /
      haste / base P/T of Flayer of Loyalties, counters, untap …) are forwarded to whoever controls it now (a control
      change doesn't make a new object, CR 110.2).
   4. Nested loans: a permanent I control but don't own that I give to a third player goes to its real owner's
      graveyard / hand / library / exile when it leaves the battlefield (it used to land in the middle player's zones).
   5. Exchanges: "two target permanents that share a card type" (Shifting Loyalties), "target X you control and target
      Y an opponent controls [with power ≤ that creature's power | with an equal or lesser mana value]" (Political
      Trickery, Spawnbroker, Puca's Mischief, Oko), "~ and target nonland permanent" (Avarice Totem), Juxtapose,
      Cultural Exchange. "Gain control of target X with mana value X or less" checks X (Dominate, Blue Sun's Twilight,
      Thieving Skydiver — whose Kicker {X} is now offered, X = times kicked — and its Equipment attaches to it).
      "It becomes a <type> in addition to its other types" with no duration is permanent (Captivating Vampire).
   6. Costs: "tap N untapped Vampires you control" may include the source; stacked tokens count one by one for
      "sacrifice three Rats" (Captivating Vampire, Piper of the Swarm).
   7. Sliver Overlord & co.: a legendary creature's first name word that is also its creature type isn't read as "~".
   8. Thada Adel / Dream Harvest: the card exiled from the opponent's library is lent (stays theirs), not copied.
   9. Ownership: a card put onto my battlefield from another player's graveyard/library/exile keeps its owner (dies →
      their graveyard); giving a permanent back to its owner ends the loan (they simply control their card again).
  10. Auras / Equipment stay attached across control changes (all clients re-point the attachment).
  11. Counters (named ones too), layer effects, tapped state and granted keywords travel with the permanent both ways.
  12. Alexios: the upkeep player gains control, untapped, with a +1/+1 counter and haste. */

const L19 = {busy:false};
// ---------- 1. target descriptions ----------
{
  const ts = targetSpecs;
  targetSpecs = function(t){
    let s = String(t || '');
    try {
      s = s.replace(/ for as long as [^.;\n]*/gi, '')
           .replace(/ with an equal or lesser mana value/gi, '')
           .replace(/ with power less than or equal to (?:that creature's power|~'s power|[A-Z][^.;\n]*?'s power)/g, '');
    } catch {}
    const out = ts(s);
    try { out.forEach(sp => { const m = String(sp.desc || '').match(/^(.+?) (an opponent controls|you control|you don't control|that player controls|defending player controls) (with .+)$/); if (m) sp.desc = `${m[1]} ${m[3]} ${m[2]}`; }); } catch {}
    return out;
  };
}

// ---------- 2. "for as long as" durations ----------
function l19DurOf(clause){
  const c = String(clause || '').toLowerCase().trim(); if (!c) return null;
  const d = {cond:'src'};
  if (/remains tapped/.test(c)) d.tap = true;
  if (/power remains less than or equal to/.test(c)) d.pow = true;
  return d;
}
// remember: the next card k that arrives from pid is held under this duration
function l19Expect(pid, k, srcId, dur){ (S.l19pend ||= []).push({pid, k, src:srcId, ...dur, t:Date.now()}); }
{
  const tk = takeCard;
  takeCard = function(r, from){
    const before = new Set(S.bf.map(b => b.id)); const out = tk(r, from);
    try {
      const p = (S.l19pend || []).find(x => x.pid === from && r.c && x.k === r.c.k);
      if (p){ S.l19pend.splice(S.l19pend.indexOf(p), 1); const nc = S.bf.find(b => !before.has(b.id) && b.k === p.k);
        if (nc && p.attach != null){ const eq = S.bf.find(b => b.id === p.attach); if (eq){ nc.att = {pid:MYPID, id:eq.id}; log(`attached ${cname(nc)} to ${cname(eq)}`); } }
        else if (nc){ nc.l19dur = {src:p.src, tap:!!p.tap, pow:!!p.pow}; l19Check(); } }
      // a card put onto my battlefield from another player's graveyard / library / exile is still theirs (CR 108.3):
      // when it leaves the battlefield it goes to its owner's zone, not mine
      if (r.f && r.f.fromGy && r.ref && from !== MYPID){ const nc = S.bf.find(b => !before.has(b.id) && r.c && b.k === r.c.k && !b.own); if (nc) nc.own = {pid:from, ref:r.ref, keep:1}; }
      // pump that came with the card (until end of turn effects applied just before the control change)
      if (r.f && (Number.isFinite(r.f.l19p) || Number.isFinite(r.f.l19t))){ const nc = S.bf.find(b => !before.has(b.id)); if (nc) nc.pu = [(nc.pu || [0, 0])[0] + (r.f.l19p || 0), (nc.pu || [0, 0])[1] + (r.f.l19t || 0)]; }
    } catch (e){ console.warn('l19 take', e); }
    return out;
  };
}
// the duration check: run after every change
function l19Check(){
  if (L19.busy || !S || !S.bf || UI.dry) return;
  L19.busy = true;
  try {
    for (const c of S.bf.slice()){
      if (!c.own) continue;
      let why = '';
      if (c.l19dur){ const d = c.l19dur; const src = S.bf.find(b => b.id === d.src);
        if (!src) why = 'its source left or changed control';
        else if (d.tap && !src.tap && !(L19.keep && L19.keep.has(src.id))) why = `${cname(src)} is no longer tapped`;
        else if (d.pow){ const a = (stats(c) || [0])[0], b = (stats(src) || [0])[0]; if (a > b) why = `its power is greater than ${cname(src)}'s`; } }
      else if (c.r21by != null && !S.bf.some(b => b.id === c.r21by)) why = 'its source is no longer under my control';
      if (why){ log(`${cname(c)} goes back to ${nameOf(c.own.pid)} (${why})`); delete c.l19dur; sendBack(c, 'bf'); }
    }
  } catch (e){ console.warn('l19 check', e); }
  L19.busy = false;
}
{
  const cm = commit;
  commit = function(keepMenu){ try { if (S && S.bf && S.bf.some(c => c.own && (c.l19dur || c.r21by != null))) l19Check(); } catch {} return cm(keepMenu); };
}
// "You may choose not to untap ~ during your untap step": keep it tapped while it holds something, then ask
const l19MayKeep = c => /(?:^|\n)you may choose not to untap (?:~|this [a-z]+) during your untap step\.?/i.test(tname(textOf(c), cname(c)));
const l19Holding = c => S.bf.filter(x => x.own && x.l19dur && x.l19dur.src === c.id && x.l19dur.tap);
{
  const sp = setPhase;
  setPhase = function(i){
    if (i !== 0 || UI.dry || !S || !S.bf) return sp(i);
    const keep = S.bf.filter(c => c.tap && l19MayKeep(c) && l19Holding(c).length);
    L19.keep = new Set(keep.map(c => c.id)); let r;
    try { r = sp(i); } finally { keep.forEach(c => { if (S.bf.includes(c)){ c.tap = true; } }); L19.keep = null; }
    if (keep.length) (async () => { for (const c of keep){ if (!S.bf.includes(c) || !c.tap) continue; const held = l19Holding(c).map(cname).join(', ');
      const ok = await askYes(`${cname(c)}: you may choose not to untap it. If it untaps, ${held || 'what it holds'} goes back to its owner.`, 'Keep it tapped', 'Untap it');
      if (ok === false){ c.tap = false; c.tn = 0; log(`untapped ${cname(c)}`); } else log(`kept ${cname(c)} tapped`); commit(); } })();
    return r;
  };
}

// a granted haste (layer effects: Flayer of Loyalties "gains … and haste") lets a stolen creature attack
{ const hh = hasHaste; hasHaste = function(c){ if (hh(c)) return true; try { if (S && c && c.k && !c.fd && typeof l24eff === 'function'){ const e = l24eff(c); if (e && l24kwHas(e.kw, 'haste')) return true; } } catch {} return false; }; }

// ---------- 3. requests aimed at a permanent that has just changed controller follow it ----------
RQ_OPS.push('l19ret');
{
  const ao = applyOp;
  applyOp = function(r, from){
    try {
      if (r && from !== MYPID && r.tid == null && typeof r.ref === 'string' && r.ref.startsWith('l19:') && r.op !== 'give' && r.op !== 'back'){
        const ref = r.ref.slice(4); const c = S.bf.find(b => b.own && b.own.ref === ref);
        if (c) return ao({...r, ref:'', tid:c.id}, from);
        const l = (S.lent || []).find(x => x.card && x.card.own && x.card.own.ref === ref);   // passed on again: forward once more
        if (l){ sendRq(l.to, r.op, r.n, r.src, {...l19Rest(r), ref:'l19:' + l.ref}); commit(); }
        return;
      }
      if (r && r.tid != null && !['give', 'back', 'gytake'].includes(r.op) && !r.ref && !S.bf.some(b => b.id === r.tid) && !find(r.tid)[0]){
        const l = (S.lent || []).find(x => x.card && x.card.id === r.tid);
        if (l && l.to !== MYPID){ sendRq(l.to, r.op, r.n, r.src, {...l19Rest(r), ref:'l19:' + l.ref}); commit(); return; }
      }
    } catch (e){ console.warn('l19 fwd', e); }
    return ao(r, from);
  };
}
function l19Rest(r){ const o = {...r}; ['id', 'to', 'op', 'n', 'src', 'tid', 'ref'].forEach(k => delete o[k]); return o; }

// ---------- 4. nested loans: zone changes go to the real owner ----------
{
  const tb = takeBack;
  takeBack = function(r){
    try {
      const i = S.lent.findIndex(l => l.ref === r.ref);
      if (i >= 0){ const l = S.lent[i]; const c = l.card; const to = ['bf','gy','ex','hand','lib','cz'].includes(r.d) ? r.d : 'gy';
        if (c && c.own && to !== 'bf'){ S.lent.splice(i, 1); sendRq(c.own.pid, 'back', 0, cname(c), {ref:c.own.ref, d:to}); log(`${cname(c)} goes to ${nameOf(c.own.pid)}'s ${ZNAME[to] || to} (they own it)`); commit(); return; }
      }
    } catch (e){ console.warn('l19 back', e); }
    return tb(r);
  };
}
// a pump on the card at the moment it changes controller goes along with it
{
  const ga = giveAway;
  giveAway = function(c, to, f = {}){
    try { if (c && S.bf.includes(c) && c.pu && (c.pu[0] || c.pu[1]) && !(f && (f.l19p || f.l19t))) f = {...(f || {}), l19p:c.pu[0], l19t:c.pu[1]}; if (c && (c.ekw || []).length && !(f && f.kw)) f = {...(f || {}), kw:c.ekw.slice(0, 6)}; } catch {}
    return ga(c, to, f);
  };
  const cf = cleanFlags;
  cleanFlags = function(f){ const o = cf(f); try { if (f && typeof f === 'object') ['l19p', 'l19t'].forEach(k => { if (Number.isFinite(f[k])) o[k] = Math.max(-99, Math.min(99, f[k])); }); } catch {} return o; };
}

// ---------- 5. effects ----------
const l19Card = t => t ? boardOf(t.pid).find(b => b.id === t.id) || null : null;
const l19Types = k => (String(info(k)?.t || '').match(/\b(Artifact|Creature|Enchantment|Land|Planeswalker|Battle)\b/g) || []);
const l19Pow = t => { const c = l19Card(t); return c ? (stats(c, t.pid) || [0])[0] : 0; };
function l19Exchange(a, b, name){
  if (!a || !b){ log(`${name}: no exchange`); return false; }
  if (a.pid === b.pid){ log(`${name}: the same player controls both — nothing changes`); return false; }
  m24GivePerm(a, b.pid, name); m24GivePerm(b, a.pid, name); log(`${name}: exchanged control of ${a.nm} and ${b.nm}`); commit(); return true;
}
// the permanent a player controls with the highest mana value among `desc` (their controller breaks ties)
async function l19Highest(pid, desc, name){
  const list = boardOf(pid).filter(c => c.k && !c.fd && descOk(c.k, desc, {tok:c.tok}));
  if (!list.length) return null;
  const mv = c => c.tok ? 0 : (+info(c.k)?.mv || 0); const top = Math.max(...list.map(mv)); const tied = list.filter(c => mv(c) === top);
  let pick = tied[0];
  if (tied.length > 1 && !UI.dry){
    if (pid === MYPID){ const ids = await pickCards({title:`${name}: your ${desc}s tied for highest mana value — choose one`, cards:tied, min:1, max:1}); pick = tied.find(c => c.id === (ids || [])[0]) || tied[0]; }
    else { const ids = await r22oppPick(pid, tied.map(c => ({id:c.id, k:c.k})), 1, `${name}: choose your ${desc} to exchange (tied for highest mana value)`, name); pick = tied.find(c => c.id === (ids || [])[0]) || tied[0]; }
  }
  return {t:'card', pid, id:pick.id, k:pick.k, nm:info(pick.k)?.n || 'a card'};
}
async function doFix19aPre(s, l, ctx){
  let m; const name = ctx.name || ''; const full = String(ctx.full || '').toLowerCase();
  const tgs = () => sentenceHasTarget(l) ? nextTargets(ctx) : (ctx.lastT || []);
  // --- gain control … for as long as … ---
  if ((m = l.match(/^(you may )?gain control of (up to one |another )?target (.+?) for as long as (.+)$/))){
    const dur = l19DurOf(m[4]); const src = srcCardOf(ctx);
    if (m[1] && !UI.dry && !(await askYes(`${name}: gain control of target ${m[3]}?`, 'Yes', 'No'))){ nextTargets(ctx); return true; }
    const ts = nextTargets(ctx).filter(t => t.t === 'card'); if (UI.dry) return true;
    if (!src || !S.bf.includes(src)){ log(`${name}: its source is gone — no control change`); return true; }
    for (const t of ts){
      if (t.pid === MYPID) continue;
      // "with power less than or equal to …" (Vedalken Shackles, Old Man of the Sea) is checked on resolution
      const pm = m[3].match(/with power less than or equal to (.+)$/);
      if (pm){ const lim = /'s power$/.test(pm[1]) ? (stats(src) || [0])[0] : countOf(pm[1], ctx); const p = l19Pow(t); if (p > lim){ log(`${name}: ${t.nm} has power ${p} — more than ${lim}`); continue; } }
      l19Expect(t.pid, t.k, src.id, dur); applyTo(t, {op:'steal', src:name, f:{}}); log(`${name}: gaining control of ${nameOf(t.pid)}'s ${t.nm} for as long as ${m[4].replace(/~/g, name)}`);
    }
    commit(); return true;
  }
  // --- exchanges ---
  if (/^exchange control of two target permanents that share a card type$/.test(l)){
    if (UI.dry) return true; const ts = nextTargets(ctx); if (ts.length < 2){ log(`${name}: needs two targets`); return true; }
    const [a, b] = ts; const ta = l19Types(a.k), tb = l19Types(b.k); if (!ta.some(x => tb.includes(x))){ log(`${name}: ${a.nm} and ${b.nm} don't share a card type — nothing changes`); return true; }
    l19Exchange(a, b, name); return true;
  }
  if ((m = l.match(/^(you may )?exchange control of target (.+?) you control and target (.+?) an opponent controls( with an equal or lesser mana value)?$/))){
    if (UI.dry) return true;
    if (m[1] && !(await askYes(`${name}: exchange control?`, 'Exchange', 'No'))){ nextTargets(ctx); nextTargets(ctx); return true; }
    const mine = nextTargets(ctx)[0], theirs = nextTargets(ctx)[0];
    if (!mine || !theirs || mine.pid !== MYPID || theirs.pid === MYPID){ log(`${name}: no exchange (a target is gone)`); return true; }
    if (/with power less than or equal to that creature's power/.test(m[3]) && l19Pow(theirs) > l19Pow(mine)){ log(`${name}: ${theirs.nm}'s power is greater than ${mine.nm}'s — no exchange`); return true; }
    const pn = m[3].match(/with power (\d+) or less/); if (pn && l19Pow(theirs) > +pn[1]){ log(`${name}: ${theirs.nm} has power greater than ${pn[1]} — no exchange`); return true; }
    if (m[4] && (+info(theirs.k)?.mv || 0) > (+info(mine.k)?.mv || 0)){ log(`${name}: ${theirs.nm} has a greater mana value — no exchange`); return true; }
    l19Exchange(mine, theirs, name); return true;
  }
  if ((m = l.match(/^exchange control of ~ and target (nonland permanent|permanent|artifact|creature)$/))){
    if (UI.dry) return true; const sc = srcCardOf(ctx); const t = nextTargets(ctx)[0];
    if (!sc || !S.bf.includes(sc) || !t){ log(`${name}: no exchange`); return true; }
    if (t.pid === MYPID){ log(`${name}: I already control both — nothing changes`); return true; }
    m24GivePerm(t, MYPID, name); giveAway(sc, t.pid, {}); log(`${name}: exchanged control of ${name} and ${t.nm}`); commit(); return true;
  }
  // Juxtapose
  if ((m = l.match(/^you and target player exchange control of the (creature|artifact) you each control with the highest mana value$/))){
    const p = nextTargets(ctx).find(t => t.t === 'player'); ctx.l19jux = p ? p.pid : null; if (UI.dry) return true;
    if (!p || p.pid === MYPID){ log(`${name}: no other player`); return true; }
    l19Exchange(await l19Highest(MYPID, m[1], name), await l19Highest(p.pid, m[1], name), name); return true;
  }
  if ((m = l.match(/^then exchange control of (artifacts|creatures|enchantments) the same way$/)) && ctx.l19jux !== undefined){
    if (UI.dry || !ctx.l19jux) return true; const d = m[1].replace(/s$/, '');
    l19Exchange(await l19Highest(MYPID, d, name), await l19Highest(ctx.l19jux, d, name), name); return true;
  }
  if (/^if two or more permanents a player controls are tied for highest mana value, their controller chooses one of them$/.test(l) && ctx.l19jux !== undefined) return true;
  // Cultural Exchange: the caster picks the creatures on both sides (same number)
  if (/^choose any number of creatures target player controls and choose the same number of creatures another target player controls$/.test(l)){
    const a = nextTargets(ctx).find(t => t.t === 'player'), b = nextTargets(ctx).find(t => t.t === 'player'); ctx.l19cx = []; if (UI.dry || !a || !b || a.pid === b.pid) return true;
    const ca = boardOf(a.pid).filter(c => c.k && !c.fd && isCreatureCard(c)), cb = boardOf(b.pid).filter(c => c.k && !c.fd && isCreatureCard(c));
    const n = Math.min(ca.length, cb.length); if (!n){ log(`${name}: a player has no creatures`); return true; }
    const ia = await pickCards({title:`${name}: choose any number of ${nameOf(a.pid)}'s creatures`, cards:ca.map(c => ({id:c.id, k:c.k})), min:0, max:n}) || [];
    if (!ia.length) return true;
    const ib = await pickCards({title:`${name}: choose ${ia.length} of ${nameOf(b.pid)}'s creatures`, cards:cb.map(c => ({id:c.id, k:c.k})), min:ia.length, max:ia.length}) || [];
    const T = (pid, id) => { const c = boardOf(pid).find(x => x.id === id); return c ? {t:'card', pid, id, k:c.k, nm:info(c.k)?.n} : null; };
    ctx.l19cx = [ia.map(id => T(a.pid, id)).filter(Boolean), ib.map(id => T(b.pid, id)).filter(Boolean)]; return true;
  }
  if (/^those players exchange control of those creatures$/.test(l) && ctx.l19cx){
    if (UI.dry) return true; const [xa, xb] = ctx.l19cx; if (!xa || !xb || !xa.length || xa.length !== xb.length) return true;
    xa.forEach(t => m24GivePerm(t, xb[0].pid, name)); xb.forEach(t => m24GivePerm(t, xa[0].pid, name)); log(`${name}: ${nameOf(xa[0].pid)} and ${nameOf(xb[0].pid)} exchanged ${xa.length} creature${xa.length === 1 ? '' : 's'}`); commit(); return true;
  }
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = m24Low(s, ctx); if (l && ctx && await doFix19aPre(s, l, ctx)) return; return ds(s0, ctx); }; }

// ---------- 6. costs that take several of my permanents (Captivating Vampire, Piper of the Swarm) ----------
// "Tap five untapped Vampires you control" may tap the source itself (it isn't a {T} cost, CR 302.6 doesn't apply);
// stacked tokens count one by one for "sacrifice three Rats" / "tap N untapped X".
function l19Explode(desc){ for (const b of S.bf.slice()) if ((b.n || 1) > 1 && !b.fd && descOk(b.k, desc, {tok:b.tok})){ let g = 0; while ((b.n || 1) > 1 && g++ < 60){ const s = single(b); if (b.tn && b.tn > 0){ s.tap = true; b.tn--; } } } }
{
  const pp = payPart;
  payPart = async function(p, c){
    try {
      const l = String(p).toLowerCase().trim(); let m;
      if ((m = l.match(/^tap (two|three|four|five|six|seven|eight|nine|ten|\d+) untapped (.+?) you control$/))){
        const n = wn(m[1]) || +m[1]; const d = sing(m[2]); l19Explode(d);
        const list = S.bf.filter(b => !b.fd && !b.tap && descOk(b.k, d, {tok:b.tok}));
        if (list.length < n){ toast(`You need ${n} untapped ${m[2]}`); return false; }
        const ids = list.length === n ? list.map(b => b.id) : await pickCards({title:`Tap ${n} untapped ${m[2]}`, cards:list, min:n, max:n}); if (!ids || ids.length < n) return false;
        ids.forEach(id => { const b = S.bf.find(x => x.id === id); if (b) b.tap = true; }); return true;
      }
      if ((m = l.match(/^sacrifice (two|three|four|five|six|\d+) (.+)$/)) && !/^sacrifice \w+ (?:other )?(?:cards?|permanents?)$/.test(l) && !/ or /.test(m[2])){
        const n = wn(m[1]) || +m[1]; const d = sing(m[2]); l19Explode(d);
        const list = S.bf.filter(b => !b.fd && descOk(b.k, d, {tok:b.tok}));
        if (list.length < n){ toast(`You need to sacrifice ${n} ${m[2]}`); return false; }
        const ids = list.length === n ? list.map(b => b.id) : await pickCards({title:`Sacrifice ${n} ${m[2]}`, cards:list, min:n, max:n}); if (!ids || ids.length < n) return false;
        ids.forEach(id => { const b = S.bf.find(x => x.id === id); if (b) sacrificeOne(b); }); return true;
      }
    } catch (e){ console.warn('l19 cost', e); }
    return pp(p, c);
  };
}

// ---------- 7. a legendary card whose first word is one of its own creature types keeps that word (Sliver Overlord:
// "Gain control of target Sliver", "search your library for a Sliver card" — not "target ~") ----------
{
  const tn = tname; const cache = new Map();
  tname = function(txt, name){
    try {
      const n = String(name || '').split(' // ')[0]; const s = n.split(',')[0]; const w1 = s.split(' ')[0];
      if (w1 && w1 !== s && w1.length > 3 && /^[A-Z][a-z]+$/.test(w1)){
        const ck = n + '|' + (typeof DICT !== 'undefined' ? DICT.size : 0); let hit = cache.get(ck);
        if (hit === undefined){ hit = false; if (typeof legendName === 'function' && legendName(n)){ const a = [...DICT.values()].find(x => x.n === n || String(x.n).split(' // ')[0] === n); const sub = a ? String(a.t || '').split(/[—-]/)[1] || '' : '';
          hit = !!(a && /\bCreature\b/.test(a.t || '') && !/Planeswalker/.test(a.t || '') && new RegExp('\\b' + w1 + '\\b').test(sub)); } if (cache.size > 5000) cache.clear(); cache.set(ck, hit); }
        if (hit){ const PH = '\u0001L19\u0001'; const rest = s.slice(w1.length); const t2 = String(txt || '').replace(new RegExp('\\b' + w1 + '\\b(?!' + rest.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'g'), PH); return tn(t2, name).split(PH).join(w1); }
      }
    } catch {}
    return tn(txt, name);
  };
}

// ---------- 8. Thada Adel / Dream Harvest: a card exiled from an opponent's library for me stays theirs ----------
// (it used to be re-created in my exile as my own card; now it is lent the way Gonti / Ragavan lend: it goes to its
// owner's graveyard after it resolves, and back to them if I don't play it in time)
{
  const ao = applyOp;
  applyOp = function(r, from){
    try {
      if (r && from !== MYPID && r.op === 'qlibTake' && r.n === 1){
        const i = S.lib.findIndex(c => c.k === r.d); if (i < 0) return;
        const [c] = S.lib.splice(i, 1); S.ex.push(c); r21Lend(c, from, '', 'pe', r.src || '');
        log(`${nameOf(from)} exiles ${cname(c)} from my library — they may play it this turn (${r.src})`);
        if (r.f && r.f.other){ shuffle(S.lib); log('shuffled their library'); } commit(); return;
      }
      if (r && from !== MYPID && r.op === 'qexMvGive'){
        let tot = 0; const out = []; while (S.lib.length && tot < r.n){ const c = S.lib.shift(); out.push(c); tot += info(c.k)?.mv || 0; }
        out.forEach(c => { S.ex.push(c); r21Lend(c, from, '', 'fe', r.src || ''); });
        log(`exiled ${out.map(cname).join(', ') || 'nothing'} (total mana value ${tot}) — ${nameOf(from)} may cast them this turn without paying their mana costs (${r.src})`); commit(); return;
      }
    } catch (e){ console.warn('l19 lib', e); }
    return ao(r, from);
  };
}

// ---------- 9. Kicker {X} (Thieving Skydiver): kicking it X times = paying {X}; X is how many times it was kicked ----------
{
  const ra = r21bAdds;
  r21bAdds = function(c){
    const out = ra(c);
    try { if (c && c.k && !out.some(a => a.kind === 'kick') && /(?:^|\n)Kicker \{X\}\.?/i.test(info(c.k)?.o || '')) out.push({kind:'kick', label:'Kicker {X} (X = how many times you pay {1})', cost:r21bCost('{1}'), max:20}); } catch {}
    return out;
  };
}
async function doFix19aPre2(s, l, ctx){
  let m; const name = ctx.name || '';
  // "gain control of target artifact with mana value X or less" (Thieving Skydiver kicked X times, Dominate, Blue Sun's Twilight)
  if ((m = l.match(/^gain control of target (.+?) with mana value x or less$/))){
    const src = srcCardOf(ctx); const it = ctx.it || {}; const x = it.x || it.kicked || (src && src.kicked) || 0; const t = nextTargets(ctx).find(t => t.t === 'card'); ctx.stoleFlags = true; if (UI.dry || !t || t.pid === MYPID) return true;
    const mv = t.k && boardOf(t.pid).find(b => b.id === t.id)?.tok ? 0 : (+info(t.k)?.mv || 0);
    if (mv > x){ log(`${name}: ${t.nm} has mana value ${mv} — more than X = ${x}`); return true; }
    const full = String(ctx.full || '').toLowerCase();
    if (/if that artifact is an equipment, attach it to (?:this creature|~)/.test(full) && src && S.bf.includes(src) && /\bEquipment\b/.test(info(t.k)?.t || '')) (S.l19pend ||= []).push({pid:t.pid, k:t.k, attach:src.id, t:Date.now()});
    applyTo(t, {op:'steal', src:name, f:{}}); log(`${name}: gaining control of ${nameOf(t.pid)}'s ${t.nm}`); commit(); return true;
  }
  if (/^if that artifact is an equipment, attach it to (?:this creature|~)$/.test(l)) return true;   // done when the artifact arrives
  // Alexios: "that player gains control of ~, untaps it, and puts a +1/+1 counter on it. It gains haste until end of turn."
  if (/^that player gains control of ~, untaps it, and puts a \+1\/\+1 counter on it$/.test(l)){
    const c = srcCardOf(ctx); const it = ctx.it || {}; const pid = it.evPid || it.evDp || phaseNow().pid; ctx.l19alx = true; if (UI.dry || !c || !S.bf.includes(c) || !pid) return true;
    const haste = /it gains haste until end of turn/i.test(String(ctx.full || '') + ' ' + (info(c.k)?.o || ''));
    const x = single(c); x.tap = false; x.tn = 0; modCounters(x, 'cp', 1);
    if (pid === MYPID){ if (haste) x.ekw = [...new Set([...(x.ekw || []), 'haste'])]; log(`${name}: untapped with a +1/+1 counter${haste ? ' and haste' : ''}`); }
    else { if (haste) x.ekw = [...new Set([...(x.ekw || []), 'haste'])]; giveAway(x, pid, {untap:true, haste}); }
    commit(); return true;
  }
  if (/^it gains haste until end of turn$/.test(l) && ctx.l19alx) return true;
  // "It becomes a Vampire in addition to its other types" with no duration lasts indefinitely (Captivating Vampire, New Blood-style)
  if ((m = l.match(/^(it|that creature|target creature|target permanent) becomes an? ([a-z]+) in addition to its other (?:creature )?types$/)) && !/until end of turn/.test(String(ctx.full || '').toLowerCase().split(/[.\n]/).find(x => x.includes('in addition to its other')) || '') && typeof l24modTo === 'function'){
    const t = /^target/.test(m[1]) ? nextTargets(ctx)[0] : (ctx.lastT || [])[0]; if (UI.dry || !t) return true;
    l24modTo(t, {addS:[l24capW(m[2])], u:''}, name); log(`${name}: ${t.nm || 'it'} becomes a ${l24capW(m[2])} in addition to its other types`); commit(); return true;
  }
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = m24Low(s, ctx); if (l && ctx && await doFix19aPre2(s, l, ctx)) return; return ds(s0, ctx); }; }

// ---------- 10. Auras and Equipment stay attached across a control change (CR 301.5c, 303.4e) ----------
// The permanent gets a new id on its new controller's board; every client re-points attachments from the old
// (player, id) to the new one when the new controller announces it ('l19id'), and back again when it returns.
RQ_OPS.push('l19id');
function l19Remap(opid, oid, npid, nid){
  let ch = false; for (const b of S.bf) if (b.att && b.att.pid === opid && b.att.id === oid){ b.att = {...b.att, pid:npid, id:nid}; ch = true; }
  return ch;
}
function l19Announce(opid, oid, nid){
  if (oid == null || nid == null) return;
  for (const p of players()) if (!p.me) sendRq(p.pid, 'l19id', nid, '', {d:String(opid) + '|' + String(oid)});
  if (l19Remap(opid, oid, MYPID, nid)) commit();
}
{
  const tk = takeCard;
  takeCard = function(r, from){
    const before = new Set(S.bf.map(b => b.id)); const out = tk(r, from);
    try { if (r && r.f && Number.isFinite(r.f.l19o) && from !== MYPID){ const nc = S.bf.find(b => !before.has(b.id) && r.c && b.k === r.c.k); if (nc) l19Announce(from, r.f.l19o, nc.id); } } catch (e){ console.warn('l19 att', e); }
    return out;
  };
  const ga = giveAway;
  giveAway = function(c, to, f = {}){ try { if (c && S.bf.includes(c)) f = {...(f || {}), l19o:c.id}; } catch {} return ga(c, to, f); };
  const tb = takeBack;
  takeBack = function(r){
    let info0 = null; try { const l = S.lent.find(x => x.ref === r.ref); if (l && l.card && r.d === 'bf') info0 = {to:l.to, nid:l.l19nid, card:l.card}; } catch {}
    const out = tb(r);
    try { if (info0 && info0.nid != null && S.bf.includes(info0.card)) l19Announce(info0.to, info0.nid, info0.card.id); } catch (e){ console.warn('l19 att back', e); }
    return out;
  };
  const ao = applyOp;
  applyOp = function(r, from){
    if (r && r.op === 'l19id'){
      try { const [opid, oid] = String(r.d || '').split('|'); const id = +oid;
        if (opid === MYPID){ const l = S.lent.find(x => x.card && x.card.id === id && x.to === from); if (l) l.l19nid = r.n; }
        if (l19Remap(opid, id, from, r.n)) log(`an Aura or Equipment follows its permanent to ${nameOf(from)}`);
        commit(); } catch (e){ console.warn('l19id', e); }
      return;
    }
    return ao(r, from);
  };
  const cf = cleanFlags;
  cleanFlags = function(f){ const o = cf(f); try { if (f && Number.isFinite(f.l19o)) o.l19o = Math.max(0, Math.min(1e7, Math.floor(f.l19o))); } catch {} return o; };
}

// ---------- 11. continuous effects and named counters go with the permanent (CR 613, 122.2) ----------
// a type / P/T / ability change from a resolved effect (c.lx) and counters other than +1/+1, -1/-1 and loyalty (c.nc)
// travel with a 'give' and with a 'back' to the battlefield
function l19Extra(c){ try { const lx = (c.lx || []).filter(l24live); const nc = c.nc && Object.keys(c.nc).length ? {...c.nc} : null; return lx.length || nc ? {lx, nc} : null; } catch { return null; } }
function l19Tag(op, to, k, x){ if (!x) return; for (let i = S.rq.length - 1; i >= 0; i--){ const q = S.rq[i]; if (q.op === op && q.to === to && (op !== 'give' || (q.c && q.c.k === k))){ q.l19x = x; return; } } }
function l19Apply(c, x){ if (!c || !x) return; if (Number.isFinite(x.cp)){ c.cp = x.cp; c.cm = x.cm || 0; c.co = x.co || 0; c.tap = !!x.tap; if (Array.isArray(x.kw) && x.kw.length) c.ekw = [...new Set([...(c.ekw || []), ...x.kw])]; if (Array.isArray(x.pu)) c.pu = x.pu; } if (Array.isArray(x.lx) && x.lx.length){ c.lx = (c.lx || []).concat(x.lx).slice(-12); l24bust(); } if (x.nc && typeof x.nc === 'object') c.nc = {...(c.nc || {}), ...x.nc}; }
{
  const ga = giveAway;
  giveAway = function(c, to, f = {}){ const x = c && S.bf.includes(c) ? l19Extra(c) : null; const k = c && c.k; const r = ga(c, to, f); try { l19Tag('give', to, k, x); } catch {} return r; };
  const sb = sendBack;
  sendBack = function(c, to){ let x = c && to === 'bf' ? l19Extra(c) : null; if (c && to === 'bf') x = {...(x || {lx:[], nc:null}), cp:c.cp || 0, cm:c.cm || 0, co:c.co || 0, tap:c.tap ? 1 : 0, kw:(c.ekw || []).slice(0, 6), pu:c.pu && (c.pu[0] || c.pu[1]) ? [c.pu[0] || 0, c.pu[1] || 0] : null}; const pid = c && c.own && c.own.pid; const r = sb(c, to); try { if (pid) l19Tag('back', pid, null, x); } catch {} return r; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); try { if (o && Array.isArray(o.rq) && Array.isArray(s.rq)) o.rq.forEach(r => { if (r.op !== 'give' && r.op !== 'back') return; const src = s.rq.find(x => x && x.id === r.id); const x = src && src.l19x; if (!x || typeof x !== 'object') return;
    const nc = {}; if (x.nc && typeof x.nc === 'object') Object.keys(x.nc).slice(0, 12).forEach(k => { if (/^[a-z0-9+\-\/ ]{1,24}$/i.test(k) && Number.isFinite(x.nc[k])) nc[k] = Math.max(0, Math.min(999, Math.floor(x.nc[k]))); });
    r.l19x = {lx:Array.isArray(x.lx) ? x.lx.slice(0, 12).map(L24.cleanMod).filter(Boolean) : [], nc};
    if (r.op === 'back' && Number.isFinite(x.cp)){ const n = v => Math.max(0, Math.min(999, Math.floor(+v || 0))); Object.assign(r.l19x, {cp:n(x.cp), cm:n(x.cm), co:n(x.co), tap:x.tap ? 1 : 0, kw:Array.isArray(x.kw) ? x.kw.slice(0, 6).map(k => String(k).slice(0, 24)) : [], pu:Array.isArray(x.pu) ? x.pu.slice(0, 2).map(v => Math.max(-99, Math.min(99, +v || 0))) : null}); } }); } catch (e){ console.warn('l19 san', e); } return o; };
  const tk = takeCard;
  takeCard = function(r, from){ const before = new Set(S.bf.map(b => b.id)); const out = tk(r, from); try { if (r && r.l19x){ const nc = S.bf.find(b => !before.has(b.id) && r.c && b.k === r.c.k); l19Apply(nc, r.l19x); } } catch (e){ console.warn('l19 x', e); } return out; };
  const tb = takeBack;
  takeBack = function(r){ let card = null; try { const l = S.lent.find(x => x.ref === r.ref); if (l && r.d === 'bf' && r.l19x) card = l.card; } catch {} const out = tb(r); try { if (card && S.bf.includes(card)) l19Apply(card, r.l19x); } catch {} return out; };
}
const l19Elsewhere = (pid, k) => boardsAll().filter(b => b.pid !== pid).reduce((a, b) => a + b.bf.filter(x => x.k === k).length, 0);
// an Aura / Equipment whose permanent has just changed controller isn't "attached to nothing": wait for the new
// controller's 'l19id' instead of unattaching it (or putting the Aura into the graveyard)
{
  const as = attachSBA; L19.miss = new Map();
  attachSBA = function(){
    const hold = [];
    try {
      const now = Date.now();
      for (const s of S.bf){ if (!s.att || s.att.id == null) continue; const key = s.att.pid + '|' + s.att.id;
        const host = boardOf(s.att.pid).find(x => x.id === s.att.id); if (host){ L19.miss.delete(key); s.l19hk = host.k; s.l19hn = l19Elsewhere(s.att.pid, host.k); continue; }
        // mine: hold only while that permanent is lent out; someone else's: hold briefly only if a permanent with the same
        // name has turned up on another player's board (it changed controller and its new id is on the way)
        const lent = s.att.pid === MYPID && (S.lent || []).some(l => l.card && l.card.id === s.att.id && !l.ex);
        const moved = s.att.pid !== MYPID && s.l19hk && l19Elsewhere(s.att.pid, s.l19hk) > (s.l19hn || 0);
        if (!lent && !moved) continue;
        if (!L19.miss.has(key)){ L19.miss.set(key, now); setTimeout(() => { try { commit(); } catch {} }, 5200); }
        if (lent || now - L19.miss.get(key) < 5000){ hold.push([s, s.att]); delete s.att; } }
    } catch {}
    try { return as(); } finally { hold.forEach(([s, a]) => { if (S.bf.includes(s)) s.att = a; }); }
  };
}
// giving a permanent to its own owner (they steal it back, Donate it home, an exchange that returns it) ends the loan
// instead of starting a new one, so the owner holds it as their own card again
{
  const ga = giveAway;
  giveAway = function(c, to, f = {}){
    try { if (c && c.own && to === c.own.pid && S.bf.includes(c) && !UI.dry){ log(`${cname(c)} goes back to its owner, ${nameOf(to)}`); sendBack(c, 'bf'); commit(); return; } } catch (e){ console.warn('l19 home', e); }
    return ga(c, to, f);
  };
}
