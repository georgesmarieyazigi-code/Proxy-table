/* ===================== Rules engine — round 27 helper A: the last one-offs =====================
   Brave the Sands (block an additional creature), Fallen Shinobi, Wand of Wonder, Duplicant, Xantcha (enters under an
   opponent's control, "any player may activate this ability", can't attack its owner), Yedora (face-down Forest lands),
   Ensnared by the Mara (villainous choice), Jeweled Amulet (noted mana type), Neyali, Lux Artillery + sunburst,
   Satoru Umezawa (granted ninjutsu + "whenever you activate a ninjutsu ability"), The Master, Multiplied,
   The Necrobloom + dredge, Illusionist's Gambit, Avenger of the Fallen (mobilize X), Noble Heritage (protection from a player),
   Invoke Calamity, Locke (Mug), Dance with Calamity, Joraga Treespeaker (level up). */

const A27 = {};
const a27T = () => turnStr();
const a27Txt = c => { const f = c && !c.fd && c.k ? faceOf(c) : null; return f ? tname(f.o || '', f.n || '') : ''; };
const a27Full = ctx => tname(String(ctx.full || info(ctx.k)?.o || ''), ctx.name || '').toLowerCase();
const a27Sing = d => { d = String(d || '').toLowerCase().trim(); const irr = {elves:'elf', dwarves:'dwarf', wolves:'wolf', mice:'mouse', men:'man'}; return irr[d] || sing(d); };
EV_TYPES.push('a27nj');
RQ_OPS.push('a27yed', 'a27gambit', 'a27mug', 'a27mugAns', 'a27ex4', 'a27ex4Ans');

/* ======================================================================
   Joraga Treespeaker — level up (CR 702.87, 711)
   ====================================================================== */
function a27Lev(k){
  const a = info(k); if (!a) return null; const o = tname(a.o || '', a.n || ''); const m = o.match(/^Level up ((?:\{[^}]+\})+)$/m); if (!m) return null;
  const bands = []; let cur = null; const pre = [];
  for (const raw of o.split('\n')){ const l = raw.trim(); const h = l.match(/^LEVEL (\d+)(?:-(\d+)|(\+))$/);
    if (h){ cur = {lo:+h[1], hi:h[3] ? 99 : +h[2], pt:null, lines:[]}; bands.push(cur); continue; }
    if (!cur){ pre.push(l); continue; }
    const pt = l.match(/^(\d+)\/(\d+)$/); if (pt && !cur.pt && !cur.lines.length){ cur.pt = [+pt[1], +pt[2]]; continue; }
    cur.lines.push(l); }
  return {cost:m[1], bands, pre};
}
const a27LvN = c => (c && c.nc && c.nc.level) || 0;
function a27Band(c){ const L = a27Lev(c.k); if (!L) return null; const n = a27LvN(c); return L.bands.find(b => n >= b.lo && n <= b.hi) || null; }
// a band line is active only while the permanent's level is inside the band
function a27LineOn(c, line){ const L = a27Lev(c.k); if (!L) return true; const t = String(line || '').trim(); const b = L.bands.find(x => x.lines.includes(t)); if (!b) return true; const n = a27LvN(c); return n >= b.lo && n <= b.hi; }
STATIC_KNOWN.push(/^level up \{/, /^level \d+-\d+$/, /^level \d+\+$/);
{
  const al = abilityList;
  abilityList = function(c){ let out = al(c); try { if (c && c.k && !c.fd){ const L = a27Lev(c.k); if (L){ out = out.filter(ab => a27LineOn(c, ab.line)); out = out.concat({cost:L.cost, eff:'Put a level counter on ~.', sorc:true, line:'Level up ' + L.cost, a27lv:true}); } } } catch (e){ console.warn('a27 lv', e); } return out; };
  const ma = manaAbs;
  manaAbs = function(c){ let out = ma(c); try { if (!c || !c.k || c.fd) return out;
      if (a27Lev(c.k)) out = out.filter(ab => a27LineOn(c, ab.line));
      // "Elves you control have "{T}: Add {G}{G}."" from an active band of a leveler I control
      if (S && S.bf.includes(c) && isCreatureCard(c)) for (const b of S.bf){ if (b.fd || !b.k) continue; const bd = a27Lev(b.k) && a27Band(b); if (!bd) continue;
        for (const l of bd.lines){ const m = l.match(/^(.+?) you control have "(\{T\}): (Add [^"]+?)\.?"$/); if (!m) continue; if (!descOk(c.k, a27Sing(m[1]), {tok:c.tok})) continue;
          if (out.some(o => o.a27g === b.id || (o.tapOnly && o.line === `{T}: ${m[3]}.`))) continue; out = out.concat({cost:'{T}', eff:m[3], rest:'', outs:manaOuts(m[3]), tapOnly:true, line:`{T}: ${m[3]}.`, a27g:b.id}); } }
    } catch (e){ console.warn('a27 lvm', e); } return out; };
  const st = stats;
  stats = function(c, pid){ const r = st(c, pid); try { if (r && c && c.k && !c.fd && a27Lev(c.k)){ const bd = a27Band(c); const base = ptOf(info(c.k)); if (bd && bd.pt && base) return [r[0] - base[0] + bd.pt[0], r[1] - base[1] + bd.pt[1], ...r.slice(2)]; } } catch {} return r; };
}
async function a27LevelUp(ctx){ const c = srcCardOf(ctx); if (!c || !S.bf.includes(c)){ return; } addNamed(c, 'level', 1); log(`${cname(c)} levels up — level ${a27LvN(c)}`); commit(); }

/* ======================================================================
   Brave the Sands — each creature you control can block an additional creature (CR 509.1a, 510.1d)
   ====================================================================== */
STATIC_RULES.push([/^each creature you control can block an additional creature each combat$/, m => ({kind:'a27blk', who:'you'})]);
UI.a27blk2 = {};
const a27Extra = () => { try { return S ? rulesOn('a27blk').length : 0; } catch { return 0; } };
{
  const rc = renderCombatPanel;
  renderCombatPanel = function(...a){ const r = rc.apply(this, a);
    try { const n = a27Extra(); const pn = phaseNow(); const cb = cbOf(pn); const el = document.getElementById('cbpanel');
      if (n && el && !pn.mine && cb && cb.step === 'blk' && (S.bd || '') !== cbKey(pn, cb)){
        const atts = attackersOnMe(pn);
        for (const b of S.bf.filter(c => isCreatureCard(c) && !c.fd && !c.tap)){
          const btn = el.querySelector(`[data-act="blkSet"][data-id="${b.id}"]`); const row = btn && btn.closest('.cbrow'); if (!row) continue;
          const prim = UI.blkSel[b.id]; if (prim == null || prim === ''){ continue; }
          const sel = UI.a27blk2[b.id] || [];
          const chips = atts.filter(x => String(x.id) !== String(prim)).map(x => { const why = canBlock(b, x, pn.pid); return `<button type="button" class="chip2${sel.includes(x.id) ? ' on' : ''}" data-act="a27blk2" data-id="${b.id}" data-a="${x.id}" ${why ? `disabled title="${esc(why)}"` : ''}>Also block ${esc(info(x.k)?.n)}</button>`; }).join('');
          if (chips){ const d = document.createElement('div'); d.className = 'cbchips a27b2'; d.innerHTML = `<small class="hint">can block ${n} more:</small> ` + chips; row.appendChild(d); }
        }
      } } catch (e){ console.warn('a27 blk ui', e); }
    return r; };
  ACT.a27blk2 = el => { const id = el.dataset.id, a = +el.dataset.a; const n = a27Extra(); const cur = (UI.a27blk2[id] || []).slice(); const i = cur.indexOf(a); if (i >= 0) cur.splice(i, 1); else { cur.push(a); while (cur.length > n) cur.shift(); } UI.a27blk2[id] = cur; renderCombatPanel(); };
  const cfb = confirmBlocks;
  confirmBlocks = function(auto){
    const pn = phaseNow(); const extra = UI.a27blk2 || {}; const n = a27Extra(); UI.a27blk2 = {};
    const r = cfb(auto);
    try { if (n && cbOf(pn) && Object.keys(extra).length){
      const atts = attackersOnMe(pn); const add = [];
      for (const [id, list] of Object.entries(extra)){
        const b = S.bf.find(x => x.id === +id); if (!b || b.blk == null) continue;
        const ok = list.map(aid => atts.find(x => x.id === aid)).filter(a => a && a.id !== b.blk && !canBlock(b, a, pn.pid)).slice(0, n);
        if (ok.length){ b.a27b2 = ok.map(a => a.id); add.push(...ok.map(a => [b, a])); }
      }
      // menace: an attacker blocked only by one creature's extra block isn't legally blocked
      const cnt = {}; S.bf.forEach(b => { if (b.blk != null) cnt[b.blk] = (cnt[b.blk] || 0) + 1; (b.a27b2 || []).forEach(x => { cnt[x] = (cnt[x] || 0) + 1; }); });
      for (const [b, a] of add){ if (cnt[a.id] === 1 && hasMenace(a, pn.pid) && (a.n || 1) === 1){ b.a27b2 = (b.a27b2 || []).filter(x => x !== a.id); if (!auto) toast(`${info(a.k)?.n} has menace: block it with two or more creatures`); } }
      const done = add.filter(([b, a]) => (b.a27b2 || []).includes(a.id));
      if (done.length) log(`also blocks (${rulesOn('a27blk')[0].src}): ${done.map(([b, a]) => `${cname(b)} → ${info(a.k)?.n}`).join(', ')}`);
      commit();
    } } catch (e){ console.warn('a27 cfb', e); }
    return r; };
  const bf = blockersFor;
  blockersFor = function(){ const m = bf(); try { for (const [pid, s] of OPP) (s.bf || []).forEach(b => { if (b.blk == null || !b.k || !Array.isArray(b.a27b2)) return; for (const aid of b.a27b2){ if (!m.has(aid)) m.set(aid, []); if (!m.get(aid).some(x => x.pid === pid && x.id === b.id)) m.get(aid).push({t:'card', pid, id:b.id, k:b.k, nm:info(b.k)?.n, c:b}); } }); } catch {} return m; };
  // the defender: blockers of attackers that were removed from combat deal no damage; a creature blocking several attackers divides its damage (510.1d)
  const dt = defenderTick;
  defenderTick = function(pn){
    const cb = cbOf(pn); if (!cb || pn.mine) return dt(pn);
    try { const att = boardOf(pn.pid); S.bf.forEach(b => { if (b.blk == null) return; const a = att.find(x => x.id === b.blk); if (a && !a.atk && cb.step !== 'end'){ b.blk = null; b.a27b2 = null; } else if (b.a27b2) b.a27b2 = b.a27b2.filter(id => { const x = att.find(y => y.id === id); return !x || x.atk; }); }); } catch {}
    const key = cbKey(pn, cb); const fire = (cb.step === 'fs' || cb.step === 'dmg') && S.dd !== key + cb.step;
    const multi = fire ? S.bf.filter(b => b.blk != null && (b.a27b2 || []).length) : [];
    const keep = multi.map(b => [b, b.blk]); keep.forEach(([b]) => { b.blk = null; });
    let r; try { r = dt(pn); } finally { keep.forEach(([b, v]) => { b.blk = v; }); }
    if (cb.step === 'end') S.bf.forEach(b => { if (b.a27b2) b.a27b2 = null; });
    if (multi.length){ const step = cb.step; (async () => { for (const b of multi){
      const fs = isFS(b, MYPID), ds = kwOf(b, 'double strike'); if (step === 'fs' && !fs) continue; if (step === 'dmg' && fs && !ds) continue;
      const st = stats(b); const pow = st ? Math.max(0, st[0]) : 0; if (!pow) continue;
      const list = [b.blk, ...b.a27b2].map(id => boardOf(pn.pid).find(x => x.id === id)).filter(Boolean).map(x => ({t:'card', pid:pn.pid, id:x.id, k:x.k, nm:info(x.k)?.n, c:x}));
      if (!list.length) continue;
      let plan = defaultAssign(b, list, pow); if (list.length > 1 && !UI.dry) plan = await splitDamage(b, list, pow, plan);
      plan.to.forEach(([t, d]) => { if (d > 0) dealDamage(t, d, b.k, b); }); commit();
    } })(); }
    return r; };
  const ctk = combatTick;
  combatTick = function(...a){ const r = ctk.apply(this, a); try { if (S && phaseNow().ph !== 4 && S.bf.some(c => c.a27b2)) S.bf.forEach(c => { c.a27b2 = null; }); } catch {} return r; };
  const rs = reset; reset = function(c){ const r = rs(c); try { if (c){ c.a27b2 = null; } } catch {} return r; };
  const cpe = cardPublicExtra;
  cardPublicExtra = function(c){ const o = cpe(c); try { if (c && c.blk != null && Array.isArray(c.a27b2) && c.a27b2.length) o.a27b2 = c.a27b2.slice(0, 6); if (c && c.a27dup) o.a27dup = c.a27dup; } catch {} return o; };
  const ss = sanitizeState;
  sanitizeState = function(s){ const o = ss(s); try { if (o && s && Array.isArray(s.bf)) o.bf.forEach((c, i) => { const x = s.bf[i] || {}; if (Array.isArray(x.a27b2)) c.a27b2 = x.a27b2.filter(Number.isFinite).slice(0, 6); if (typeof x.a27dup === 'string') c.a27dup = x.a27dup.slice(0, 80); });
      if (o && s && s.a27prot && Array.isArray(s.a27prot.p)) o.a27prot = {p:s.a27prot.p.map(x => String(x).slice(0, 40)).slice(0, 6)}; } catch {} return o; };
}

/* ======================================================================
   Duplicant — imprint a nontoken creature; P/T and creature types of the last creature card exiled with it
   ====================================================================== */
STATIC_KNOWN.push(/^as long as a card exiled with ~ is a creature card, ~ has the power, toughness, and creature types of the last creature card exiled with it$/, /^it's still a shapeshifter$/);
const a27DupOn = c => !!(c && c.a27dup && !c.fd && /exiled with (?:~|this creature) is a creature card, (?:~|this creature) has the power, toughness, and creature types/i.test(a27Txt(c)) && /\bCreature\b/.test(info(c.a27dup)?.t || ''));
{
  const st = stats;
  stats = function(c, pid){ const r = st(c, pid); try { if (r && a27DupOn(c)){ const b = ptOf(faceOf(c)) || [0, 0]; const pt = ptOf(info(c.a27dup)) || [0, 0]; return [r[0] - b[0] + pt[0], r[1] - b[1] + pt[1], ...r.slice(2)]; } } catch {} return r; };
  const to = typeOf;
  typeOf = function(c){ const t = to(c); try { if (a27DupOn(c)){ const sub = (String(info(c.a27dup).t || '').split('—')[1] || '').trim().split(/\s+/).filter(Boolean); const add = sub.filter(x => !new RegExp('\\b' + x + '\\b').test(t)); if (add.length) return (/—/.test(t) ? t + ' ' : t + ' — ') + add.join(' '); } } catch {} return t; };
}

/* ======================================================================
   Xantcha, Sleeper Agent
   ====================================================================== */
STATIC_KNOWN.push(/^~ enters under the control of an opponent of your choice$/);
const a27XanText = c => /^~ enters under the control of an opponent of your choice\.?$/m.test(a27Txt(c));
{
  const oe = onEnter;
  onEnter = function(c, from, o = {}){
    try { if (S && c && from !== 'bf' && !c.own && !UI.dry && S.bf.includes(c) && a27XanText(c) && opponents().length){
      const opps = opponents();
      const give = pid => { if (!S.bf.includes(c)) return; log(`${cname(c)} enters under ${nameOf(pid)}'s control`); giveAway(c, pid, {}); commit(); };
      if (opps.length === 1) give(opps[0].pid);
      else (async () => { const pid = await askChoice({title:`${cname(c)} enters under the control of an opponent of your choice`, options:opps.map(p => ({label:p.nm, value:p.pid})), noClose:true}); give(pid || opps[0].pid); })();
      return;
    } } catch (e){ console.warn('a27 xan', e); }
    return oe(c, from, o);
  };
}
// "Any player may activate this ability": a button under each opponent's board
function a27AnyAbs(c){ const out = []; const t = a27Txt(c); if (!/any player may activate this ability/i.test(t)) return out;
  t.split('\n').forEach((line, i) => { const m = line.trim().match(/^([^:"]+):\s*(.+?)\s*Any player may activate this ability\.?$/i); if (m) out.push({i, cost:m[1].trim(), eff:m[2].trim()}); }); return out; }
{
  const ro = renderOpps;
  renderOpps = function(...a){ const r = ro.apply(this, a);
    try { if (!S) return r; const opps = players().filter(p => !p.me); const els = document.querySelectorAll('#opps .opp');
      opps.forEach((p, i) => { const el = els[i]; if (!el) return; let h = '';
        (p.s && p.s.bf || []).forEach(c => { if (!c.k || c.fd) return; a27AnyAbs(c).forEach(ab => { h += `<button class="btn small" type="button" data-act="a27any" data-pid="${esc(p.pid)}" data-id="${c.id}" data-i="${ab.i}">${esc(info(c.k)?.n || '')}: ${manaHTML(ab.cost)} — ${esc(short(ab.eff, 50))}</button>`; }); });
        if (h){ const d = document.createElement('div'); d.className = 'a27any'; d.innerHTML = h; el.appendChild(d); } });
    } catch (e){ console.warn('a27 any ui', e); }
    return r; };
  ACT.a27any = async el => { const pid = el.dataset.pid, id = +el.dataset.id, i = +el.dataset.i; await a27ActivateOther(pid, id, i); };
}
async function a27ActivateOther(pid, id, li){
  if (UI.casting) return 'busy'; const c = (OPP.get(pid)?.bf || []).find(x => x.id === id); if (!c) return 'gone';
  const ab = a27AnyAbs(c).find(x => x.i === li); if (!ab) return 'no ability';
  if (phaseNow().n === 0){ toast('Start the game first'); return 'not started'; }
  const top = stackTop(); if (top && top.ss){ toast('Split second'); return 'split second'; }
  if (!/^(?:\{[^}]+\})+$/.test(ab.cost)){ toast('Only mana costs can be paid for another player’s permanent'); return 'cost'; }
  const plan = payPlan(parseCost(ab.cost), S.pool); if (plan.err){ toast(`${ab.cost}: ${plan.err}`); return 'mana'; }
  S.pool = plan.pool;
  const nm = info(c.k)?.n || ''; const it = {sid:rid(6), o:nextO(), kind:'ability', k:c.k, nm, txt:ab.eff, a27ctl:pid, a27src:id};
  S.stk.push(it); S.pass = 's:' + it.sid; log(`activated ${nameOf(pid)}'s ${nm}: ${short(ab.eff, 90)}`); commit(); return 'ok';
}
// can't attack its owner or planeswalkers its owner controls; Illusionist's Gambit: can't attack the caster this turn
function a27Ban(c, def){
  const d = typeof def === 'string' ? parseDef(def) : def; if (!d || !c) return '';
  const pidOf = d.pid; const isPw = d.t === 'card' ? /\bPlaneswalker\b/.test(info(boardOf(d.pid).find(x => x.id === d.id)?.k)?.t || '') : false;
  if (/can't attack its owner or planeswalkers its owner controls/i.test(a27Txt(c))){ const own = c.own ? c.own.pid : MYPID; if (pidOf === own && (d.t === 'player' || isPw)) return `${cname(c)} can't attack its owner`; }
  if (c.a27g && c.a27g.t === a27T() && pidOf === c.a27g.by && (d.t === 'player' || isPw)) return `${cname(c)} can't attack ${nameOf(c.a27g.by)} this combat (Illusionist's Gambit)`;
  return '';
}
{
  const ca = canAttack;
  canAttack = function(c){ const w = ca(c); if (w) return w; try { if (S && c && S.bf.includes(c) && (c.a27g || /can't attack its owner/i.test(a27Txt(c)))){ const opts = defOpts(); if (opts.length && opts.every(o => a27Ban(c, o.key))) return a27Ban(c, opts[0].key); } } catch {} return w; };
  const ap = p24AtkPlan;
  p24AtkPlan = function(){ const e = ap(); if (e) return e; try { for (const [id, d] of Object.entries(UI.atkSel || {})){ if (!d) continue; const c = S.bf.find(x => x.id === +id); const why = c && a27Ban(c, d); if (why) return why; } } catch {} return ''; };
  const ac = advanceCombat;
  advanceCombat = function(...a){ const r = ac.apply(this, a); try { const opts = defOpts(); for (const [id, d] of Object.entries(UI.atkSel || {})){ if (!d) continue; const c = S.bf.find(x => x.id === +id); if (c && a27Ban(c, d)){ const o = opts.find(x => !a27Ban(c, x.key)); UI.atkSel[id] = o ? o.key : ''; } } } catch {} return r; };
  const an = ACT.atkNone;
  ACT.atkNone = function(...a){ const r = an.apply(this, a); try { const opts = defOpts(); for (const [id, d] of Object.entries(UI.atkSel || {})){ const c = S.bf.find(x => x.id === +id); if (c && d && a27Ban(c, d)){ const o = opts.find(x => !a27Ban(c, x.key)); UI.atkSel[id] = o ? o.key : ''; } } renderCombatPanel(); } catch {} return r; };
}

/* ======================================================================
   Yedora — a face-down Forest land (the card keeps its identity underneath)
   ====================================================================== */
const A27FD = 'a27:fdforest';
try { if (!DICT.has(A27FD)) DICT.set(A27FD, {k:A27FD, n:'Face-down land', m:'', t:'Land — Forest', o:'({T}: Add {G}.)', p:'', img:'', c:'', back:null, toks:[], tok:false, cc:false, lay:'normal', full:'Face-down land', set:'', cn:'', pr:'', art:'', mv:0, ci:'', kw:[]}); } catch (e){ console.warn('a27 fd', e); }
function a27FaceDownForest(c, src){
  if (!c) return false; const [z] = find(c.id); if (!z || z === 'bf') return false;
  c.a27real = c.k; c.k = A27FD; moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id);
  if (!b){ c.k = c.a27real; delete c.a27real; return false; }
  log(`${src}: returned a creature card face down — it's a Forest land`); commit(); return true;
}
{
  const mc = moveCard;
  moveCard = function(id, to, o = {}){
    let c0 = null; try { const [z,, c] = find(id); if (z === 'bf' && to !== 'bf' && c && c.a27real) c0 = c; } catch {}
    const r = mc(id, to, o);
    try { if (c0){ const [z2,, c2] = find(id); const x = c2 || c0; if (x && x.a27real && z2 !== 'bf'){ x.k = x.a27real; delete x.a27real; } } } catch {}
    return r;
  };
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'a27yed'){ const c = [...S.gy].reverse().find(g => g.k === r.d); if (c) a27FaceDownForest(c, r.src || 'Yedora'); return; }
    return ao(r, from);
  };
}

/* ======================================================================
   Jeweled Amulet — note the type of mana spent
   ====================================================================== */
A27.rec = null;
{
  const am = addMana;
  addMana = function(outs){ try { if (A27.rec) (outs || []).forEach(x => { A27.rec[x] = (A27.rec[x] || 0) + 1; }); } catch {} return am(outs); };
  const pac = payAbilityCost;
  payAbilityCost = async function(c, cost, o = {}){
    const note = !o.mana && c && S && S.bf.includes(c) && /note the type of mana spent to pay this activation cost/i.test(a27Txt(c));
    if (!note) return pac(c, cost, o);
    const before = {...S.pool}; const keep = A27.rec; A27.rec = {};
    let ok; try { ok = await pac(c, cost, o); } finally { const add = A27.rec; A27.rec = keep;
      if (ok){ const spent = MANA.filter(col => (before[col] || 0) + (add[col] || 0) - (S.pool[col] || 0) > 0); if (spent.length){ c.a27note = spent[spent.length - 1]; log(`${cname(c)}: noted {${c.a27note}}`); } } }
    return ok;
  };
  const ma = manaAbs;
  manaAbs = function(c){ const out = ma(c); try { if (c && c.k && !c.fd && /add one mana of (?:~|this artifact)'s last noted type/i.test(a27Txt(c))) return out.map(ab => /last noted type/i.test(ab.eff || '') ? {...ab, outs:c.a27note ? [[c.a27note]] : [], eff:c.a27note ? `Add {${c.a27note}}` : ab.eff} : ab); } catch {} return out; };
}

/* ======================================================================
   Sunburst (CR 702.44) and Lux Artillery
   ====================================================================== */
{
  const oe = onEnter;
  onEnter = function(c, from, o = {}){
    try { if (S && c && from === 'stack' && !c.fd && c.k){
      const own = /^sunburst\b/im.test(a27Txt(c)); const g = S.a27sun && S.a27sun.t === a27T() && (S.a27sun.ids || []).includes(c.id);
      if (own || g){ const sp = (S.n24sp || {})[c.id]; const n = sp && sp.col ? ['W', 'U', 'B', 'R', 'G'].filter(x => sp.col[x] > 0).length : 0;
        if (n){ if (isCreatureCard(c)) addCounters(c, 'cp', n); else addNamed(c, 'charge', n); log(`${cname(c)} enters with ${n} ${isCreatureCard(c) ? '+1/+1' : 'charge'} counter${n === 1 ? '' : 's'} (sunburst)`); }
        else log(`${cname(c)}: sunburst — no colored mana was spent`);
        if (g) S.a27sun.ids = S.a27sun.ids.filter(x => x !== c.id); } } } catch (e){ console.warn('a27 sun', e); }
    return oe(c, from, o);
  };
}

/* ======================================================================
   Satoru Umezawa — granted ninjutsu; "whenever you activate a ninjutsu ability"
   ====================================================================== */
STATIC_RULES.push([/^each creature card in your hand has ninjutsu ((?:\{[^}]+\})+)$/, m => ({kind:'a27nj', who:'you', cost:m[1].toUpperCase()})]);
{
  const no = ninjutsuOf;
  ninjutsuOf = function(c){ const r = no(c); if (r) return r; try { if (S && c && S.hand.includes(c) && isCreatureCard(c)){ const g = rulesOn('a27nj')[0]; if (g) return {cmd:false, cost:g.cost, a27:g.src}; } } catch {} return r; };
  const dn = doNinjutsu;
  doNinjutsu = async function(c, zone){ const r = await dn(c, zone); try { if (c && S.bf.some(b => b.id === c.id && b.atk)) emit({type:'a27nj', k:c.k, id:c.id}); } catch {} return r; };
  const ct = classifyTrig;
  classifyTrig = function(w, c){ if (w === 'whenever' && /^you activate a ninjutsu ability$/.test(c)) return {ev:'a27nj', subj:'any', ctl:'any', desc:'', qf:(s, ev, pid) => pid === MYPID}; return ct(w, c); };
}

/* ======================================================================
   The Master, Multiplied — my triggered abilities can't make me sacrifice or exile my creature tokens
   ====================================================================== */
STATIC_RULES.push([/^triggered abilities you control can't cause you to sacrifice or exile creature tokens you control$/, m => ({kind:'a27master', who:'you'})]);
A27.trig = 0;
const a27Shield = c => !!(A27.trig && c && c.tok && S.bf.includes(c) && isCreatureCard(c) && rulesOn('a27master').length);
{
  const rt = resolveTop;
  resolveTop = async function(it){ const t = it && (it.kind === 'trigger' || it.op === 'dly'); if (t) A27.trig++; try { return await rt(it); } finally { if (t) A27.trig--; } };
  const so = sacrificeOne;
  sacrificeOne = function(c){ if (a27Shield(c)){ log(`${cname(c)} isn't sacrificed (${rulesOn('a27master')[0].src})`); return; } return so(c); };
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ try { if (A27.trig && (to === 'ex' || (o && o.sac))){ const c = S.bf.find(b => b.id === id); if (a27Shield(c)){ log(`${cname(c)} isn't ${to === 'ex' ? 'exiled' : 'sacrificed'} (${rulesOn('a27master')[0].src})`); return; } } } catch {} return mc(id, to, o); };
  // myriad's "exile those tokens at end of combat" is a delayed triggered ability I control
  const ec = endCombat;
  endCombat = function(...a){ try { if (S && (S.l24myr || []).length && rulesOn('a27master').length){ const keep = S.l24myr.filter(id => S.bf.some(b => b.id === id && b.tok && isCreatureCard(b))); if (keep.length){ S.l24myr = S.l24myr.filter(id => !keep.includes(id)); log(`myriad tokens stay (${rulesOn('a27master')[0].src})`); } } } catch {} return ec.apply(this, a); };
}

/* ======================================================================
   Dredge (CR 702.52) and The Necrobloom
   ====================================================================== */
STATIC_RULES.push([/^land cards in your graveyard have dredge (\d+)$/, m => ({kind:'a27dredgeLand', who:'you', n:+m[1]})]);
function a27DredgeN(c){ const m = String(info(c.k)?.o || '').match(/^Dredge (\d+)/m); let n = m ? +m[1] : 0; try { if (isLand(c.k)) for (const r of rulesOn('a27dredgeLand')) n = Math.max(n, r.n); } catch {} return n; }
function a27Dredgers(){ return S ? S.gy.filter(c => { const n = a27DredgeN(c); return n && S.lib.length >= n; }) : []; }
async function a27DrawOne(dr){
  const list = a27Dredgers();
  if (!list.length || UI.dry) return dr(1);
  const v = await askChoice({title:'Draw a card — or dredge instead?', options:[{label:'Draw normally', value:'draw'}, ...list.map(c => ({label:`Dredge ${cname(c)} (mill ${a27DredgeN(c)})`, value:c.id}))]});
  const c = v != null && v !== 'draw' ? S.gy.find(g => g.id === v) : null;
  if (!c) return dr(1);
  const n = a27DredgeN(c); if (S.lib.length < n) return dr(1);
  mill(n); moveCard(c.id, 'hand', {quiet:true}); log(`dredged ${cname(c)} (milled ${n}) instead of drawing`); commit();
}
{
  const dr = draw;
  A27.draw0 = dr;
  draw = function(n = 1, ...a){
    if (!S || UI.dry || A27.noDr || !(n > 0) || !a27Dredgers().length) return dr(n, ...a);
    for (let i = 0; i < n; i++) p24Later(() => a27DrawOne(x => dr(x)));
  };
}

/* ======================================================================
   Avenger of the Fallen — mobilize X
   ====================================================================== */
STATIC_KNOWN.push(/^mobilize x, where x is the number of creature cards in your graveyard$/);
{
  const tg = trigsOf;
  trigsOf = function(k, fl){ const out = tg(k, fl); try { if (out.a27) return out; const a = info(k); const f = a ? (fl && a.back ? a.back : a) : null;
      const m = f && tname(f.o || '', f.n || '').match(/^mobilize x, where x is (the number of creature cards in your graveyard)\.?$/im);
      if (m) out.push({ev:'attack', subj:'self', ctl:'you', desc:'', eff:`Mobilize X, where X is ${m[1]}.`, raw:'mobilize x'}); out.a27 = true; } catch {} return out; };
}

/* ======================================================================
   Noble Heritage — protection from a player (CR 702.16k)
   ====================================================================== */
const a27ProtLive = () => !!(S && S.a27prot && g23live(S.a27prot.u) && (S.a27prot.p || []).length);
{
  const tc = turnChanged;
  turnChanged = function(...a){ const r = tc.apply(this, a); try { if (S && S.a27prot && !g23live(S.a27prot.u)){ S.a27prot = null; log('protection from players ended'); commit(); } } catch {} return r; };
  const ps = publicState;
  publicState = function(){ const o = ps(); try { if (a27ProtLive()) o.a27prot = {p:S.a27prot.p.slice(0, 6)}; } catch {} return o; };
  const tcs = targetCands;
  targetCands = function(spec, src){ const out = tcs(spec, src); try { for (const x of out){ if (x.t !== 'player' || x.pid === MYPID || !x.ok) continue; const o = OPP.get(x.pid); if (o && o.a27prot && (o.a27prot.p || []).includes(MYPID)){ x.ok = false; x.why = 'protection from you'; } } } catch {} return out; };
  const dm = damageMe;
  damageMe = function(n, f = {}, from){ try { if (from && from !== MYPID && a27ProtLive() && S.a27prot.p.includes(from)){ log(`damage from ${nameOf(from)}'s source prevented (protection from ${nameOf(from)})`); return; } } catch {} return dm(n, f, from); };
}

/* ======================================================================
   Illusionist's Gambit — cast timing
   ====================================================================== */
{
  const cc = castCheck;
  castCheck = function(c, zone, ...a){ const r = cc(c, zone, ...a); try { if (r && r.ok && c && /^cast (?:this spell|~) only during the declare blockers step on an opponent's turn\.?$/im.test(a27Txt(c))){ const pn = phaseNow(); const cb = cbOf(pn); if (pn.mine || pn.ph !== 4 || !cb || cb.step !== 'blkd') return {ok:false, why:'only during the declare blockers step on an opponent’s turn'}; } } catch {} return r; };
}

/* ======================================================================
   cross-player requests
   ====================================================================== */
A27.ans = {};
async function a27Wait(ref, ms){ return waitUntil(() => A27.ans[ref], ms || 30000); }
{
  const ao = applyOp;
  applyOp = function(r, from){
    // Illusionist's Gambit, on the attacking player's client
    if (r.op === 'a27gambit'){
      const by = String(r.d || from); const ids = [];
      S.bf.forEach(c => { if (c.atk){ c.atk = ''; c.tap = false; c.tn = 0; c.a27g = {t:a27T(), by}; c.p24mustT = p24T(); ids.push(c.id); } });
      S.xc = (S.xc || 0) + 1;
      log(`${r.src || "Illusionist's Gambit"} (${nameOf(from)}): ${ids.length} attacking creature${ids.length === 1 ? ' was' : 's were'} removed from combat and untapped; an additional combat phase follows — they must attack, but not ${nameOf(by)}`);
      commit(); return;
    }
    // Locke's Mug: mill one; lend a nonland card so the attacker may cast it this turn
    if (r.op === 'a27mug'){ const c = S.lib[0]; let d = 'none';
      if (c){ mill(1); const g = S.gy.find(x => x.id === c.id); if (g){ d = isLand(g.k) ? 'land' : 'non'; if (d === 'non') r21Lend(g, from, r.ref, 'c', r.src); } }
      sendRq(from, 'a27mugAns', d === 'non' ? 1 : 0, r.src || '', {ref:r.ref, d}); commit(); return; }
    if (r.op === 'a27mugAns' || r.op === 'a27ex4Ans'){ A27.ans[r.ref] = {n:r.n, d:String(r.d || '')}; return; }
    // Ensnared by the Mara: exile my top four; answer the total mana value
    if (r.op === 'a27ex4'){ const top = S.lib.slice(0, clamp(r.n || 4, 0, 20)); top.forEach(c => moveCard(c.id, 'ex', {quiet:true})); const mv = top.reduce((a, c) => a + (info(c.k)?.mv || 0), 0);
      log(`exiled the top ${top.length} cards of my library (${r.src}): ${top.map(cname).join(', ') || 'none'} — total mana value ${mv}`); sendRq(from, 'a27ex4Ans', mv, r.src || '', {ref:r.ref, d:String(top.length)}); commit(); return; }
    return ao(r, from);
  };
}

/* ======================================================================
   Invoke Calamity — exile instead of the graveyard
   ====================================================================== */
{
  const tg = toGrave;
  toGrave = function(c, it){ try { if (c && c.a27exi){ delete c.a27exi; if (c.cmd) return tg(c, it); S.ex.push(c); log(`${cname(c)} is exiled instead of going to the graveyard`); return; } } catch {} return tg(c, it); };
}
async function a27CastFree(c, zone, ctx, o = {}){
  if (!c) return false; const z0 = find(c.id)[0]; if (z0 !== zone) return false;
  if (o.exi) c.a27exi = 1;
  UI.afterCast = () => {};
  const n0 = S.stk.length;
  await beginCast(c, zone, zone === 'gy' ? {free:true, gy:{kind:'gycast', label:ctx.name, mana:'', extra:[], after:''}} : {free:true});
  const ok = find(c.id)[0] !== zone || S.stk.length > n0;
  if (!ok) delete c.a27exi;
  return ok;
}

/* ======================================================================
   sentences
   ====================================================================== */
async function doRound27APre(s, l, ctx){
  let m; const name = ctx.name || ''; const full = a27Full(ctx);
  // dredge: a plain "draw N cards" sentence waits for each draw-or-dredge choice before the next sentence
  if (!UI.dry && S && (m = l.match(/^draw (a|two|three|four|\d+) cards?$/)) && a27Dredgers().length){ const n = m[1] === 'a' ? 1 : (wn(m[1]) || 1); for (let i = 0; i < n; i++) await a27DrawOne(x => A27.draw0(x)); commit(); return true; }
  // Joraga Treespeaker
  if (/^put a level counter on ~$/.test(l)){ const c = srcCardOf(ctx); if (!c || !a27Lev(c.k)) return false; await a27LevelUp(ctx); return true; }

  // Fallen Shinobi
  if ((m = l.match(/^that player exiles the top (\w+) cards of their library$/)) && /until end of turn, you may play those cards without paying their mana costs/.test(full)){
    const n = wn(m[1]) || 2; await r21ExileFrom(r21Pids('that player', ctx), ctx, {n, w:'r'}); ctx.a27shin = true; return true; }
  if (/^until end of turn, you may play those cards without paying their mana costs$/.test(l)){
    const ids = (ctx.r21ids || ctx.lastEx || []).filter(id => S.ex.some(c => c.id === id));
    ids.forEach(id => { const c = S.ex.find(x => x.id === id); c.mayPlay = {t:a27T(), cast:false, src:name, u0:S.untapN, free:true}; });
    if (ids.length) log(`${name}: may play ${ids.length === 1 ? 'that card' : 'those ' + ids.length + ' cards'} this turn without paying their mana costs`); commit(); return true; }

  // Wand of Wonder: d20 rows set X
  if ((m = l.match(/^x is (one|two|three)$/)) && /you may cast up to x instant and\/or sorcery spells from among cards exiled this way/.test(full)){ ctx.r21x = wn(m[1]); ctx.a27x = ctx.r21x; return true; }

  // Duplicant
  if ((m = l.match(/^(?:imprint — )?(you may )?exile target nontoken creature$/)) && /exiled with (?:~|this creature) is a creature card, (?:~|this creature) has the power, toughness, and creature types/.test(tname(info(ctx.k)?.o || '', name).toLowerCase())){
    const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (!t || UI.dry) return true;
    if (m[1] && !(await askYes(`${name}: exile ${info(t.k)?.n || 'that creature'}?`, 'Exile it', 'No'))) return true;
    const k = t.k || boardOf(t.pid).find(x => x.id === t.id)?.k; applyTo(t, {op:'exile', src:name});
    const c = srcCardOf(ctx); if (c && k && S.bf.includes(c) && /\bCreature\b/.test(info(k)?.t || '')){ c.a27dup = k; c.imp = k; log(`${name} imprinted ${info(k)?.n} — it has that card's power, toughness and creature types`); }
    commit(); return true; }

  // Xantcha
  if ((m = l.match(/^(.+?)'s controller loses (\d+) life$/)) && (m[1] === '~' || m[1] === name.toLowerCase() || m[1] === name.split(',')[0].toLowerCase())){
    const it = ctx.it || {}; const pid = it.a27ctl || (it.srcId != null && S.bf.some(b => b.id === it.srcId) ? MYPID : null) || (ctx.srcId != null && S.bf.some(b => b.id === ctx.srcId) ? MYPID : null);
    if (!pid) return true; const n = +m[2];
    if (pid === MYPID){ S.life -= n; log(`lost ${n} life (${name})`); } else await loseLife(pid, n, name); commit(); return true; }
  if (/^any player may activate this ability$/.test(l)) return true;

  // Yedora
  if (/^(?:you may )?return it to the battlefield face down under its owner's control$/.test(l) && /it's a forest land/.test(full)){
    const it = ctx.it || {}; const k = it.evk || it.evK; if (UI.dry) return true;
    if (/^you may/.test(l) && !(await askYes(`${name}: return ${info(k)?.n || 'it'} face down as a Forest land?`, 'Return it', 'No'))){ ctx.a27yed = 1; return true; }
    let c = it.evId != null ? S.gy.find(g => g.id === it.evId) : null; if (!c && k) c = [...S.gy].reverse().find(g => g.k === k);
    if (c) a27FaceDownForest(c, name);
    else if (k){ const own = [...OPP].find(([, st]) => (st.gy || []).includes(k)); if (own){ sendRq(own[0], 'a27yed', 0, name, {d:k}); log(`${name}: ${nameOf(own[0])} returns ${info(k)?.n} face down as a Forest land`); } }
    ctx.a27yed = 1; commit(); return true; }
  if (/^it's a forest land$/.test(l) && (ctx.a27yed || UI.dry)) return true;

  // Ensnared by the Mara
  if (/^each opponent faces a villainous choice — they exile cards from the top of their library until they exile a nonland card$/.test(l) && /exiles the top four cards of their library and ~ deals damage equal to the total mana value of those exiled cards to that player/.test(full)){
    ctx.a27mara = true; if (UI.dry) return true;
    for (const p of opponents()){
      const a = await r22ask(p.pid, `villainous choice: exile until a nonland card that ${nameOf(MYPID)} may cast free? (No = exile your top 4, take damage equal to their mana value)`, name);
      if (a){ log(`${p.nm} chose: exile until a nonland card`); const sub = {...ctx, r21ids:[], lastEx:[]}; const ids = await r21ExileFrom([p.pid], sub, {until:'nonland', w:'r'}); sub.r21ids = ids; await r21CastNow(sub, {free:true, max:1}); }
      else { log(`${p.nm} chose: exile the top four cards`); const ref = rid(6); sendRq(p.pid, 'a27ex4', 4, name, {ref}); commit(); const ans = await a27Wait(ref, 30000); const mv = ans ? ans.n : 0; if (mv > 0) dealDamage({t:'player', pid:p.pid}, mv, ctx.k, srcCardOf(ctx)); }
      commit();
    }
    return true; }
  if (ctx.a27mara && /^(?:you may )?cast that card without paying its mana cost, or that player exiles the top four cards of their library and ~ deals damage equal to the total mana value of those exiled cards to that player$/.test(l)) return true;

  // Jeweled Amulet (noted while the cost is paid, see payAbilityCost above)
  if (/^note the type of mana spent to pay this activation cost$/.test(l)) return true;

  // Neyali
  if (/^exile the top card of your library$/.test(l) && /during any turn you attacked with a token, you may play that card/.test(full)){
    const c = S.lib[0]; if (!c) return true; moveCard(c.id, 'ex', {quiet:true}); ctx.a27ney = c.id; ctx.lastEx = [c.id]; log(`${name}: exiled ${cname(c)}`); commit(); return true; }
  if (/^during any turn you attacked with a token, you may play that card$/.test(l)){
    const c = ctx.a27ney != null ? S.ex.find(x => x.id === ctx.a27ney) : null; if (!c) return true;
    c.mayPlay = {t:'', cast:false, src:name, u0:S.untapN, a27ney:1}; log(`${name}: may play ${cname(c)} during any turn they attacked with a token`); commit(); return true; }

  // Lux Artillery
  if (/^it gains sunburst$/.test(l)){ const it = ctx.it || {}; let id = it.evId; if (id == null || !S.stk.some(x => x.card && x.card.id === id)){ const sp = [...S.stk].reverse().find(x => x.kind === 'spell' && x.card && descOk(x.card.k, 'artifact creature')); id = sp ? sp.card.id : null; }
    if (id == null) return true; if (!S.a27sun || S.a27sun.t !== a27T()) S.a27sun = {t:a27T(), ids:[]}; S.a27sun.ids.push(id); log(`${name}: that spell gains sunburst`); commit(); return true; }

  // Avenger of the Fallen
  if ((m = l.match(/^mobilize x, where x is (the number of creature cards in your graveyard)$/))){
    const n = S.gy.filter(c => isCreatureCard(c)).length; ctx.a27mob = n; if (!n){ log(`${name}: mobilize 0`); return true; }
    await doSentence(`Create ${n === 1 ? 'a' : n} 1/1 red Warrior creature token${n === 1 ? '' : 's'} that ${n === 1 ? 'is' : 'are'} tapped and attacking.`, ctx);
    await doSentence(`Sacrifice ${n === 1 ? 'it' : 'them'} at the beginning of the next end step.`, ctx); return true; }

  // Noble Heritage
  if (/^for each opponent who does, you gain protection from (?:that|target) player until your next turn$/.test(l)){
    const pids = (ctx.g23ctr2 || []).map(x => x.pid).filter(p => p !== MYPID); if (!pids.length) return true;
    const cur = a27ProtLive() ? S.a27prot.p : []; S.a27prot = {p:[...new Set([...cur, ...pids])], u:g23untilNext()};
    log(`${name}: has protection from ${pids.map(nameOf).join(', ')} until their next turn`); commit(); return true; }

  // Illusionist's Gambit
  if (/^cast (?:this spell|~) only during the declare blockers step on an opponent's turn$/.test(l)) return true;
  if (/^remove all attacking creatures from combat and untap them$/.test(l) && /each of those creatures attacks that combat if able/.test(full)){
    const pn = phaseNow(); ctx.a27gam = true; if (UI.dry || pn.mine || !pn.pid) return true;
    sendRq(pn.pid, 'a27gambit', 0, name, {d:MYPID});
    S.bf.forEach(b => { b.blk = null; b.a27b2 = null; }); log(`${name}: all attacking creatures are removed from combat and untapped`); commit(); return true; }
  if (ctx.a27gam && /^after this phase, there is an additional combat phase$/.test(l)) return true;
  if (ctx.a27gam && /^(each of those creatures attacks that combat if able|they can't attack you or planeswalkers you control that combat)$/.test(l)) return true;

  // Invoke Calamity
  if ((m = l.match(/^you may cast up to two instant and\/or sorcery spells with total mana value (\d+) or less from your graveyard and\/or hand without paying their mana costs$/))){
    const lim = +m[1]; ctx.a27inv = true; if (UI.dry) return true; const exi = /if those spells would be put into your graveyard, exile them instead/.test(full);
    const self = ctx.card || (ctx.it && ctx.it.card);
    const pool = [...S.hand, ...S.gy].filter(c => c !== self && /\b(Instant|Sorcery)\b/.test(info(c.k)?.t || ''));
    if (!pool.length) return true;
    let ids = null; for (let tries = 0; tries < 4; tries++){
      ids = await pickCards({title:`${name}: cast up to two instant and/or sorcery spells (total mana value ${lim} or less) from your hand and/or graveyard for free`, cards:pool, min:0, max:2, noneLabel:'None'});
      const tot = (ids || []).reduce((a, id) => a + (info(pool.find(c => c.id === id)?.k)?.mv || 0), 0);
      if (tot <= lim) break; toast(`That's mana value ${tot} — ${lim} or less`); ids = null; }
    for (const id of ids || []){ const [z,, c] = find(id); if (c && (z === 'hand' || z === 'gy')) await a27CastFree(c, z, ctx, {exi}); }
    commit(); return true; }
  if (ctx.a27inv && /^if those spells would be put into your graveyard, exile them instead$/.test(l)) return true;

  // Locke, Treasure Hunter
  if (/^each player mills a card$/.test(l) && /if a land card was milled this way, create a treasure token/.test(full)){
    ctx.a27mug = {land:false, mine:null, ids:[]}; const g = rid(6); ctx.a27grp = g;
    const c = S.lib[0]; if (c){ mill(1); const x = S.gy.find(y => y.id === c.id); if (x){ if (isLand(x.k)) ctx.a27mug.land = true; else { x.a27gy = {t:a27T(), grp:g, src:name}; ctx.a27mug.mine = x.id; } } }
    const jobs = opponents().map(async p => { const ref = rid(6); UI.r21ack ||= {}; UI.r21tok ||= {}; sendRq(p.pid, 'a27mug', 0, name, {ref}); commit(); if (UI.dry) return;
      const a = await a27Wait(ref, 25000); if (!a) return; if (a.d === 'land') ctx.a27mug.land = true; if (a.n) { await waitUntil(() => (UI.r21tok[ref] || []).length ? 1 : 0, 8000); (UI.r21tok[ref] || []).forEach(id => ctx.a27mug.ids.push(id)); } });
    await Promise.all(jobs); commit(); return true; }
  if (/^if a land card was milled this way, create a treasure token$/.test(l) && ctx.a27mug){ if (ctx.a27mug.land) await createFromText('Create a Treasure token.', ctx); return true; }
  if (/^until end of turn, you may cast a spell from among those cards$/.test(l) && (ctx.a27mug || UI.dry)){
    if (!ctx.a27mug) return true; const g = ctx.a27grp;
    ctx.a27mug.ids.forEach(id => { const c = S.ex.find(x => x.id === id); if (c){ c.mayPlay = {...(c.mayPlay || {}), t:a27T(), cast:true, src:name, u0:S.untapN, zGroup:g}; } });
    const n = ctx.a27mug.ids.length + (ctx.a27mug.mine != null ? 1 : 0); if (n) log(`${name}: may cast a spell from among the ${n} milled nonland card${n === 1 ? '' : 's'} this turn`); commit(); return true; }

  // Dance with Calamity
  if (/^as many times as you choose, you may exile the top card of your library$/.test(l) && /if the total mana value of the cards exiled this way is (\d+) or less/.test(full)){
    ctx.a27dance = []; if (UI.dry) return true; let tot = 0;
    while (S.lib.length){ const lim = +(full.match(/is (\d+) or less/) || [0, 13])[1];
      if (!(await askYes(`${name}: exile the top card of your library? (total mana value so far ${tot}${tot > lim ? ' — over ' + lim : ''})`, 'Exile the top card', 'Stop'))) break;
      const c = S.lib[0]; moveCard(c.id, 'ex', {quiet:true}); ctx.a27dance.push(c.id); tot += info(c.k)?.mv || 0; log(`${name}: exiled ${cname(c)} (total ${tot})`); commit(); }
    ctx.a27danceTot = tot; return true; }
  if ((m = l.match(/^if the total mana value of the cards exiled this way is (\d+) or less, you may cast any number of spells from among those cards without paying their mana costs$/)) && (ctx.a27dance || UI.dry)){
    if (!ctx.a27dance) return true; if ((ctx.a27danceTot || 0) > +m[1]){ log(`${name}: total mana value ${ctx.a27danceTot} — more than ${m[1]}, no free spells`); return true; }
    const sub = {...ctx, r21ids:ctx.a27dance.slice()}; await r21CastNow(sub, {free:true}); return true; }

  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound27APre(s, l, ctx)) return; return ds(s0, ctx); }; }

/* ---------- play-permission windows ---------- */
{
  const ew = exWindowOk;
  exWindowOk = function(c){ const mp = c && c.mayPlay; if (mp && mp.a27ney) return S.a27tokAtk === a27T(); return ew(c); };
  const da = declareAttackers;
  declareAttackers = function(...a){ const r = da.apply(this, a); try { if (S.bf.some(c => c.atk && c.tok)){ S.a27tokAtk = a27T(); commit(); } } catch {} return r; };
  // Locke: my own milled card may be cast from my graveyard this turn (one spell among all of them)
  const go = gyOptions;
  gyOptions = function(c){ const r = go(c) || []; try { const g = c && c.a27gy; if (g && g.t === a27T() && !(S.zGroupUsed || {})[g.grp] && !isLand(c.k)){ const a = info(c.k); r.push({kind:'gycast', label:`Cast from graveyard (${g.src}) ${a.m || ''}`, mana:a.m || '', extra:[], after:'', a27grp:g.grp}); } } catch {} return r; };
  const cfg = castFromGy;
  castFromGy = async function(c, g){ const r = await cfg(c, g); try { if (g && g.a27grp && !S.gy.includes(c)){ (S.zGroupUsed ||= {})[g.a27grp] = 1; S.ex.filter(x => x.mayPlay && x.mayPlay.zGroup === g.a27grp).forEach(x => { delete x.mayPlay; if (x.r21 && x.own) r21Drop(x, ''); }); delete c.a27gy; commit(); } } catch {} return r; };
  const bc = beginCast;
  beginCast = async function(c, zone, o = {}){ const grp = c && zone === 'ex' && c.mayPlay && c.mayPlay.zGroup; const r = await bc(c, zone, o); try { if (grp && (S.zGroupUsed || {})[grp]) S.gy.forEach(x => { if (x.a27gy && x.a27gy.grp === grp) delete x.a27gy; }); } catch {} return r; };
}
