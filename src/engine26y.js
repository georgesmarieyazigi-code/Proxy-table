/* ===================== Rules engine — round 26Y: keyword mechanics — Rooms, Cases, soulbond, splice, exert, bargain, harness, sneak, time travel, granted keywords, cloak/manifest, becomes-tapped ===================== */

/* ---------- Derived keys: a Room shows only its unlocked doors, a Case shows its Solved ability only once solved ---------- */
const R26 = {};
function r26Base(c){ return c ? (c.origK || c.k) : null; }
function r26IsRoom(k){ const a = info(k); return !!(a && a.lay === 'split' && a.faces && a.faces.length === 2 && a.faces.every(f => /\bRoom\b/.test(f.t || ''))); }
function r26IsCase(k){ const a = info(k); return !!(a && /\bCase\b/.test(a.t || '') && /(?:^|\n)To solve — /.test(a.o || '')); }
function r26RoomKey(base, d){ return base + '#R' + (d[0] ? 1 : 0) + (d[1] ? 1 : 0); }
function r26CaseKey(base, solved){ return base + '#C' + (solved ? 'S' : 'U'); }
function r26Derive(k){
  if (typeof k !== 'string') return null; let m;
  if ((m = k.match(/^(.*)#R([01])([01])$/))){ const base = DICT.get(m[1]); if (!base || !base.faces) return null; const d = [m[2] === '1', m[3] === '1'];
    const o = base.faces.filter((f, i) => d[i]).map(f => f.o || '').join('\n').replace(/\n+$/, '');
    const e = {...base, k, o, t:base.faces[0].t || 'Enchantment — Room', lay:'room', faces:base.faces, back:null, r26room:d, kw:[]}; DICT.set(k, e); return e; }
  if ((m = k.match(/^(.*)#C([SU])$/))){ const base = DICT.get(m[1]); if (!base) return null; const solved = m[2] === 'S';
    const o = String(base.o || '').split('\n').filter(l => !/^To solve — /.test(l.trim()) && (solved || !/^Solved — /.test(l.trim()))).join('\n');
    const e = {...base, k, o, back:null, r26case:solved ? 'S' : 'U', kw:[]}; DICT.set(k, e); return e; }
  return null;
}
{
  const df = deriveFace;
  deriveFace = function(k){ const r = r26Derive(k); if (r) return r; return df(k); };
}
function r26SetKey(c, key){ if (!c) return; const base = r26Base(c); if (!info(key)) return; if (key === base){ c.k = base; delete c.origK; } else { c.origK = base; c.k = key; } }
function r26Doors(c){ const a = info(c.k); return a && a.r26room ? a.r26room.slice() : null; }
function r26CaseSolved(c){ const a = info(c.k); return a && a.r26case === 'S'; }

/* Room enters: the door that was cast is unlocked; put onto the battlefield any other way → both locked */
{
  const fe = faceEnter;
  faceEnter = function(c){ const w = c && c.baseK ? c.k.split('#').pop() : null; const r = fe(c); try { if (c && w != null && /^[01]$/.test(w) && r26IsRoom(c.k)) c.r26door = +w; } catch {} return r; };
  const oe = onEnter;
  onEnter = function(c, from, o = {}){
    try {
      if (S && c && from !== 'bf' && !c.fd){
        const base = r26Base(c);
        if (r26IsRoom(base)){ const d = [false, false]; if (c.r26door != null) d[c.r26door] = true; delete c.r26door; r26SetKey(c, r26RoomKey(base, d)); }
        else if (r26IsCase(base)) r26SetKey(c, r26CaseKey(base, false));
      }
    } catch (e){ console.warn(e); }
    return oe(c, from, o);
  };
}

/* ---------- Unlocking doors ---------- */
EV_TYPES.push('r26full', 'r26unlock');
STATIC_RULES.push([/^unlock costs you pay cost \{(\d+)\} less$/, m => ({kind:'r26unlockDisc', who:'you', n:+m[1]})]);
function r26UnlockCost(c, i){ const a = info(r26Base(c)); const f = a && a.faces && a.faces[i]; if (!f) return null; const pc = parseCost(f.m || '{0}'); const disc = rulesOn('r26unlockDisc').reduce((s, r) => s + r.n, 0); if (disc) pc.gen = Math.max(0, pc.gen - disc); return pc; }
async function r26Unlock(c, i, how){
  const d = r26Doors(c); if (!d || d[i]) return false; const base = r26Base(c); const a = info(base); const f = a.faces[i];
  d[i] = true; r26SetKey(c, r26RoomKey(base, d)); log(`unlocked ${f.n}${how ? ' (' + how + ')' : ''}`);
  // "When you unlock this door" — only the door just unlocked
  for (const line of tname(f.o || '', a.n).split('\n')){ const m = line.trim().match(/^when you unlock this door, ([\s\S]+)$/i); if (m) pushTrigger({k:c.k, id:c.id, fl:false}, {eff:m[1], raw:line.trim()}, null, MYPID); }
  emit({type:'r26unlock', k:c.k, id:c.id});
  if (d[0] && d[1]){ log(`${cname(c)} is fully unlocked`); emit({type:'r26full', k:c.k, id:c.id}); }
  commit(); return true;
}
function r26UnlockOpts(c){
  const out = []; const d = r26Doors(c); if (!d || !S) return out; const a = info(r26Base(c));
  d.forEach((u, i) => { if (u) return; const pc = r26UnlockCost(c, i); const why = !sorceryTime() ? 'only as a sorcery' : payPlan(pc, S.pool).err || ''; out.push({i, label:`Unlock ${a.faces[i].n} ${costStr(pc)}`, why}); });
  return out;
}
{
  const bi = r7BfItems;
  r7BfItems = function(c){
    let h = bi(c); try { if (c && S && S.bf.includes(c)){
      r26UnlockOpts(c).forEach(o => { h += `<button type="button" data-act="r26unl" data-id="${c.id}" data-i="${o.i}" ${o.why ? 'disabled' : ''}><span>${manaHTML(esc(o.label))}${o.why ? `<small class="why">${esc(o.why)}</small>` : ''}</span></button>`; });
      r26BfOpts(c).forEach((o, j) => { h += `<button type="button" data-act="r26bf" data-id="${c.id}" data-j="${j}" ${o.why ? 'disabled' : ''}><span>${manaHTML(esc(o.label))}${o.why ? `<small class="why">${esc(o.why)}</small>` : ''}</span></button>`; });
    } } catch (e){ console.warn(e); }
    return h;
  };
}
async function r26DoUnlock(c, i){
  const o = r26UnlockOpts(c).find(x => x.i === i); if (!o){ toast('That door is already unlocked'); return false; } if (o.why){ toast(o.why); return false; }
  const plan = payPlan(r26UnlockCost(c, i), S.pool); if (plan.err){ toast(`Not enough mana: ${plan.err}`); return false; }
  S.pool = plan.pool; if (plan.life) S.life -= plan.life; return r26Unlock(c, i);
}
// other battlefield special actions (exert, soulbond …) register here
const R26BF = [];
function r26BfOpts(c){ const out = []; for (const fn of R26BF){ try { (fn(c) || []).forEach(o => out.push(o)); } catch (e){ console.warn(e); } } return out; }
Object.assign(ACT, {
  r26unl(el){ const c = S.bf.find(x => x.id === +el.dataset.id); closeMenu(); if (c) r26DoUnlock(c, +el.dataset.i); },
  r26bf(el){ const c = S.bf.find(x => x.id === +el.dataset.id); closeMenu(); if (!c) return; const o = r26BfOpts(c)[+el.dataset.j]; if (o && !o.why) o.run(); else if (o) toast(o.why); },
});

/* triggers: "When you unlock this door" (pushed directly by r26Unlock), "whenever you fully unlock a Room" */
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){
    let m;
    if (w === 'when' && /^you unlock this door$/.test(c)) return {ev:'r26unlockDoor', subj:'self', ctl:'you', desc:''};
    if (/^you fully unlock a room$/.test(c)) return {ev:'r26full', subj:'any', ctl:'you', desc:''};
    if ((m = c.match(/^(.+?) and whenever you fully unlock a room$/))){ const r = ct(w, m[1]); if (r){ return {...r, evs:[...(r.evs || [r.ev]), 'r26full'], r26fullOr:true}; } }
    return ct(w, c);
  };
  // a full unlock satisfies "an enchantment you control enters and whenever you fully unlock a Room" whatever the enter-subject says
  const sm = subjMatch;
  subjMatch = function(t, src, ev, pid){ if (ev && ev.type === 'r26full' && t && (t.r26fullOr || t.ev === 'r26full')) return pid === MYPID; return sm(t, src, ev, pid); };
}

/* effects: unlock a door, Forgotten Cellar */
async function r26Pre(s, l, ctx){
  let m;
  if ((m = l.match(/^(.+?) or unlock a locked door of a room you control$/))){
    const rooms = S.bf.filter(b => (r26Doors(b) || [true, true]).some(x => !x));
    let pick = 'a';
    if (rooms.length && !UI.dry){ pick = await askChoice({title:`${ctx.name}: choose one`, options:[{label:cap(m[1]), value:'a'}, {label:'Unlock a locked door of a Room you control', value:'u'}]}); if (pick == null) pick = 'a'; }
    if (pick === 'a'){ await doSentence(cap(s.slice(0, m[1].length)), ctx); return true; }
    await r26UnlockAny(rooms, ctx); return true;
  }
  if ((m = l.match(/^return an? (.+?) card from your graveyard to your hand$/)) && !/\btarget\b/.test(l)){ const d = sing(m[1]); const list = S.gy.filter(c => descOk(c.k, d)); if (!list.length){ log(`${ctx.name}: no ${m[1]} card in your graveyard`); return true; } const ids = list.length === 1 || UI.dry ? [list[0].id] : await pickCards({title:`${ctx.name}: return a ${m[1]} card to your hand`, cards:list, min:1, max:1}); if (ids && ids[0]) moveCard(ids[0], 'hand'); commit(); return true; }
  if ((m = l.match(/^(.+?) cards in your graveyard gain "you may cast ~ from your graveyard" until end of turn$/)) || (m = l.match(/^(.+?) cards in your graveyard gain "you may cast this card from your graveyard" until end of turn$/))){ S.r26gyDesc = {t:turnStr(), d:sing(m[1])}; log(`${ctx.name}: ${m[1]} cards in your graveyard may be cast this turn`); commit(); return true; }
  if (/^unlock a locked door of (?:a|target) room you control$/.test(l)){ const rooms = S.bf.filter(b => (r26Doors(b) || [true, true]).some(x => !x)); await r26UnlockAny(rooms, ctx); return true; }
  if ((m = l.match(/^you may cast spells from your graveyard this turn(?:, and (.+))?$/))){ S.r26gyCast = turnStr(); log(`${ctx.name}: may cast spells from the graveyard this turn`); if (m[1]) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); commit(); return true; }
  return false;
}
async function r26UnlockAny(rooms, ctx){
  if (!rooms.length){ log(`${ctx.name}: no Room with a locked door`); return; }
  const opts = []; rooms.forEach(c => (r26Doors(c) || []).forEach((u, i) => { if (!u) opts.push({label:`${info(r26Base(c)).faces[i].n} (${cname(c)})`, value:c.id + ':' + i}); }));
  const v = opts.length === 1 || UI.dry ? opts[0].value : await askChoice({title:`${ctx.name}: unlock which door?`, options:opts}); if (!v) return;
  const [id, i] = String(v).split(':').map(Number); const c = S.bf.find(b => b.id === id); if (c) await r26Unlock(c, i, ctx.name);
}
{
  const go = gyOptions;
  gyOptions = function(c){ const r = go(c) || []; try { if (S && c && (S.r26gyCast === turnStr() || (S.r26gyDesc && S.r26gyDesc.t === turnStr() && descOk(c.k, S.r26gyDesc.d))) && !isLand(c.k) && !r.some(o => o.kind === 'r26gy')){ const a = info(c.k); if (a && a.m) r.push({kind:'r26gy', label:`Cast from graveyard ${a.m}`, mana:a.m, extra:[], after:''}); } } catch {} return r; };
}

/* ---------- Cases: "To solve — …" checked at your end step, "Solved — …" works only once solved ---------- */
function r26CaseCond(k){ const a = info(k); const m = String(a && a.o || '').match(/(?:^|\n)To solve — ([^\n]+)/); return m ? m[1].trim().replace(/\.$/, '') : null; }
function r26CondEval(cond, ctx){
  const l = String(cond).toLowerCase().replace(/\.$/, '').trim(); let m;
  if ((m = l.match(/^you control (\w+) or more (.+)$/))){ const n = wn(m[1]) || +m[1] || 0; return S.bf.filter(b => !b.fd && descOk(b.k, sing(m[2]), {tok:b.tok})).reduce((s, b) => s + (b.n || 1), 0) >= n; }
  if ((m = l.match(/^you've cast (\w+) or more (.+?) spells this turn$/))){ const n = wn(m[1]) || +m[1] || 0; const d = m[2].replace(/ and /g, ' or '); return (S.casts || []).filter(x => x.t === turnStr() && (!d || descOk(x.k, d))).length >= n; }
  if ((m = l.match(/^you've gained (\w+) or more life this turn$/))) return lifeT().g >= (wn(m[1]) || +m[1] || 0);
  if ((m = l.match(/^you control no suspected (.+)$/))) return !S.bf.some(b => !b.fd && b.jSus && descOk(b.k, sing(m[1]), {tok:b.tok}));
  if (typeof jCond === 'function'){ const r = jCond(cond, ctx || {}); if (r != null) return !!r; }
  return null;
}
{
  const fs = fireSteps;
  fireSteps = function(step, activePid){
    const r = fs(step, activePid);
    try { if (step === 'end' && activePid === MYPID && S) S.bf.forEach(c => { if (c.fd) return; const a = info(c.k); if (!a || a.r26case !== 'U') return; const cond = r26CaseCond(r26Base(c)); if (cond && r26CondEval(cond, {k:c.k, name:a.n, srcId:c.id})) r21bTrig(c, `Solve ${a.n} (${cond}).`, {r21b:'r26solve', cond}); }); } catch (e){ console.warn(e); }
    return r;
  };
}
R21BOP.r26solve = async it => {
  const c = S.bf.find(b => b.id === it.srcId); if (!c || r26CaseSolved(c)) return;
  if (!r26CondEval(it.cond, {k:c.k, srcId:c.id, name:it.nm})){ log(`${it.nm}: no longer true — not solved`); return; }
  r26SetKey(c, r26CaseKey(r26Base(c), true)); log(`${it.nm} is solved`); commit();
};
function r26CondKnown(cond, k){ const sv = S; try { if (!S) S = newState(); return r26CondEval(cond, {k}) != null; } catch { return false; } finally { S = sv; } }
// checker: the "To solve" condition is not a static ability of its own
{
  const cc = checkCard;
  checkCard = async function(k){
    const r = await cc(k);
    try { if (r && r.issues && r26IsCase(k)){ const cond = r26CaseCond(k); if (cond && r26CondKnown(cond, k)){ const norm = x => String(x).replace(/\.$/, '').trim().toLowerCase(); r.issues = r.issues.filter(i => !(i.kind === 'static' && norm(i.text) === norm(cond))); } } } catch {}
    return r;
  };
}
STATIC_RULES.push([/^you may look at the top card of your library any time, and you may play lands and cast creature and enchantment spells from the top of your library$/, m => ({kind:'r23fTop', who:'you', lands:true, spells:'creature or enchantment'})]);

/* ---------- doSentence hook ---------- */
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await r26Pre(s, l, ctx)) return; return ds(s0, ctx); };
}

/* ---------- Checker helpers: check an inner ability (∞ —, soulbond grants, exert) as its own line ---------- */
async function r26CheckText(text, k){
  const a = info(k); if (!a) return [{kind:'data', text}]; const tk = 'r26chk|' + k + '|' + norm(text).slice(0, 50);
  if (!DICT.has(tk)) DICT.set(tk, {...a, k:tk, o:text, back:null, faces:null, lay:'', r26chk:1});
  try { const r = await R26.cc(tk); return r.issues; } catch (e){ return [{kind:'effect', text}]; }
}
const R26CHK = [];   // [regex on the lowercased issue text with the card name as ~, async (m, k, a, issue) => replacement issues]
{
  const cc = checkCard; R26.cc = cc;
  checkCard = async function(k){
    const r = await cc(k);
    try { if (r && r.issues && r.issues.length && !String(k).startsWith('r26chk|')){ const a = info(k); const out = [];
      for (const i of r.issues){ const t = tname(String(i.where || i.text), a.n).toLowerCase().replace(/\.$/, '').trim(); const t2 = tname(String(i.text), a.n).toLowerCase().replace(/\.$/, '').trim(); let hit = null;
        for (const [re, fn] of R26CHK){ const m = t2.match(re) || t.match(re); if (m){ hit = await fn(m, k, a, i); if (hit) break; } }
        if (hit) hit.forEach(x => out.push(x)); else out.push(i); }
      r.issues = out.filter((x, j) => out.findIndex(y => y.kind === x.kind && y.text === x.text) === j); } } catch (e){ console.warn(e); }
    return r;
  };
}
{
  const ko = keywordsOnly;
  keywordsOnly = function(l){ return ko(l) || /^bargain$/i.test(String(l).trim()) || /^splice onto arcane (?:\{[^}]+\})+$/i.test(String(l).trim()) || /^sneak (?:\{[^}]+\})+$/i.test(String(l).trim()); };
}

/* ---------- Infinity Stones: harness; "∞ — …" works only while harnessed ---------- */
function r26IsInf(k){ const a = info(k); return !!(a && /(?:^|\n)∞ — /.test(a.o || '')); }
function r26InfKey(base, h){ return base + '#H' + (h ? 1 : 0); }
{
  const r0 = r26Derive;
  r26Derive = function(k){ let m; if (typeof k === 'string' && (m = k.match(/^(.*)#H([01])$/))){ const base = DICT.get(m[1]); if (!base) return null; const h = m[2] === '1';
    const o = String(base.o || '').split('\n').map(l => /^∞ — /.test(l.trim()) ? (h ? l.trim().replace(/^∞ — /, '') : null) : l).filter(l => l != null).join('\n');
    const e = {...base, k, o, back:null, r26inf:h ? 1 : 0, kw:[]}; DICT.set(k, e); return e; } return r0(k); };
  const oe = onEnter;
  onEnter = function(c, from, o = {}){ try { if (S && c && from !== 'bf' && !c.fd && r26IsInf(r26Base(c))) r26SetKey(c, r26InfKey(r26Base(c), false)); } catch {} return oe(c, from, o); };
}
R26CHK.push([/^∞ — ([\s\S]+)$/, async (m, k, a, i) => r26CheckText(String(i.text).replace(/^∞ — /, ''), k)]);

/* ---------- Soulbond: pair two creatures; "as long as ~ is paired …, each of those creatures has …" ---------- */
function r26SoulbondGrants(k){
  const a = info(k); const out = []; if (!a) return out;
  for (const line of tname(a.o || '', a.n).split('\n')){ const l = line.trim(); let m;
    if ((m = l.match(/^as long as ~ is paired with another creature, each of those creatures (?:has|have) "([^"]+)"\.?$/i))) out.push({ab:m[1].replace(/~/g, 'this creature')});
    else if ((m = l.match(/^as long as ~ is paired with another creature, each of those creatures (?:has|have) ([a-z ,]+?)\.?$/i)) && !/"/.test(m[1])) out.push({kw:m[1].split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim().toLowerCase()).filter(Boolean)});
    else if ((m = l.match(/^as long as ~ is paired with another creature, both creatures (?:have|has) ([a-z ,]+?)\.?$/i))) out.push({kw:m[1].split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim().toLowerCase()).filter(Boolean)});
  }
  return out;
}
const r26HasSoulbond = c => !!c && !c.r26noSB && /(?:^|\n)soulbond(?:\n|$)/i.test(r21bClean(info(c.k)?.o || ''));
function r26Unpair(c, quiet){
  if (!c || c.r26pair == null) return; const p = S.bf.find(b => b.id === c.r26pair);
  [c, p].forEach(x => { if (!x) return; delete x.r26pair; if (x.lx){ x.lx = x.lx.filter(m => m.u !== 'r26p'); if (!x.lx.length) delete x.lx; } }); l24bust();
  if (!quiet) log(`${cname(c)} is no longer paired`);
}
function r26ApplyPair(a, b){
  [a, b].forEach(x => { if (x.lx){ x.lx = x.lx.filter(m => m.u !== 'r26p'); } });
  for (const src of [a, b]) for (const g of r26SoulbondGrants(src.k)) for (const x of [a, b]) l24addMod(x, {...(g.ab ? {ab:[g.ab]} : {}), ...(g.kw ? {kw:g.kw} : {}), s:cname(src), u:'r26p'});
  l24bust();
}
function r26Pair(a, b){ if (!a || !b || a === b) return; r26Unpair(a, true); r26Unpair(b, true); a.r26pair = b.id; b.r26pair = a.id; r26ApplyPair(a, b); log(`paired ${cname(a)} with ${cname(b)} (soulbond)`); commit(); }
const r26Unpaired = () => S.bf.filter(b => !b.fd && isCreatureCard(b) && b.r26pair == null);
{
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ try { if (S && to !== 'bf'){ const f = find(id); if (f[0] === 'bf' && f[2] && f[2].r26pair != null) r26Unpair(f[2]); if (f[0] === 'bf' && S.r26tap && S.r26tap.n) delete S.r26tap.n[id]; } } catch {} return mc(id, to, o); };
  const he = handleEvent;
  handleEvent = function(pid, ev){
    try { if (S && ev && pid === MYPID && ev.type === 'tapped'){ if (!S.r26tap || S.r26tap.t !== turnStr()) S.r26tap = {t:turnStr(), n:{}}; S.r26tap.n[ev.id] = (S.r26tap.n[ev.id] || 0) + 1; } } catch {}
    he(pid, ev);
    if (!S || !ev || pid !== MYPID) return;
    try {
      if (ev.type === 'enter'){
        const ent = S.bf.find(b => b.id === ev.id); if (!ent || !isCreatureCard(ent) || ent.r26pair != null) return;
        // soulbond: this (unpaired) creature entering, or another unpaired creature entering while a soulbond creature is unpaired
        const bonds = S.bf.filter(b => !b.fd && r26HasSoulbond(b) && b.r26pair == null && isCreatureCard(b));
        for (const s of bonds){ if (s.id !== ent.id && !r26Unpaired().some(x => x.id === ent.id)) continue; if (s.id === ent.id && r26Unpaired().filter(x => x.id !== s.id).length === 0) continue;
          r21bTrig(s, s.id === ent.id ? 'You may pair it with another unpaired creature you control (soulbond).' : `You may pair it with ${cname(ent)} (soulbond).`, {r21b:'r26pair', a:s.id, b:s.id === ent.id ? null : ent.id}); }
      }
      if (ev.type === 'attack'){
        const c = S.bf.find(b => b.id === ev.id); if (!c) return; const m = r26ExertLine(c); if (m) r21bTrig(c, `You may exert it as it attacks. When you do, ${m}`, {r21b:'r26exert', eff:m});
      }
    } catch (e){ console.warn('r26', e); }
  };
}
R21BOP.r26pair = async it => {
  const a = S.bf.find(b => b.id === it.a); if (!a || a.r26pair != null) return;
  let b = it.b != null ? S.bf.find(x => x.id === it.b) : null;
  if (it.b != null){ if (!b || b.r26pair != null) return; if (!UI.dry && !(await askYes(`${cname(a)}: pair it with ${cname(b)}?`, 'Pair them', 'No'))) return; }
  else { const list = r26Unpaired().filter(x => x.id !== a.id); if (!list.length) return; const ids = UI.dry ? [] : list.length === 1 ? ((await askYes(`${cname(a)}: pair it with ${cname(list[0])}?`, 'Pair them', 'No')) ? [list[0].id] : []) : await pickCards({title:`${cname(a)}: pair it with which creature? (soulbond)`, cards:list, min:0, max:1, noneLabel:'Don\'t pair'}); b = ids && ids[0] != null ? S.bf.find(x => x.id === ids[0]) : null; if (!b) return; }
  r26Pair(a, b);
};
STATIC_KNOWN.push(/^as long as ~ is paired with another creature, each of those creatures (?:has|have) (?:"[^"]+"|[a-z ,]+)$/, /^as long as ~ is paired with another creature, both creatures (?:have|has) [a-z ,]+$/);
R26CHK.push([/^as long as ~ is paired with another creature, each of those creatures (?:has|have) "([^"]+)"$/, async (m, k, a, i) => r26CheckText(m[1].replace(/\bthis creature\b/g, a.n), k)]);
// the granted ability is checked as itself; the plain static line is known only because r26SoulbondGrants applies it
{
  const cc = checkCard;
  checkCard = async function(k){ const r = await cc(k); try { if (r && !String(k).startsWith('r26chk|')){ const a = info(k); const lines = tname(a.o || '', a.n).split('\n').map(x => x.trim()); for (const l of lines){ const m = l.match(/^as long as ~ is paired with another creature, each of those creatures (?:has|have) "([^"]+)"\.?$/i); if (m){ const iss = await r26CheckText(m[1].replace(/\bthis creature\b/gi, a.n), k); iss.forEach(x => { if (!r.issues.some(y => y.text === x.text)) r.issues.push(x); }); } } } } catch {} return r; };
}

/* ---------- Exert ---------- */
function r26ExertLine(c){ const a = info(c.k); if (!a) return null; for (const line of tname(a.o || '', a.n).split('\n')){ const m = line.trim().match(/^(?:if ~ hasn't been exerted this turn, )?you may exert (?:~|it) as it attacks\. when you do, ([\s\S]+)$/i); if (m) return m[1]; } return null; }
R21BOP.r26exert = async it => {
  const c = S.bf.find(b => b.id === it.srcId); if (!c) return;
  if (c.r21exert === turnStr()){ log(`${it.nm} was already exerted this turn`); return; }
  if (!UI.dry && !(await askYes(`Exert ${it.nm}? (it won't untap during your next untap step)`, 'Exert it', 'No'))) return;
  c.exert = true; c.r21exert = turnStr(); log(`exerted ${it.nm}`); commit();
  await runEffects(it.eff, {k:c.k, name:it.nm, srcId:c.id, full:it.eff, it:{kind:'trigger', srcId:c.id}}); commit();
};
STATIC_KNOWN.push(/^(?:if ~ hasn't been exerted this turn, )?you may exert (?:~|it) as it attacks$/);
R26CHK.push([/^(?:if ~ hasn't been exerted this turn, )?you may exert (?:~|it) as it attacks\. when you do, ([\s\S]+)$/, async (m, k, a, i) => { const ms = await dryAll(cap(m[1]).replace(/~/g, a.n), k, a.n); return ms.map(t => ({kind:'effect', text:t})); }]);
// an exerted permanent doesn't untap during its controller's next untap step
{
  const sp = setPhase;
  setPhase = function(i){ try { if (i === 0 && S) S.bf.forEach(c => { if (c.exert){ c.skipUntap = 1; c.exert = false; } }); } catch {} return sp(i); };
}

/* ---------- Bargain (additional cost: sacrifice an artifact, enchantment, or token) ---------- */
const r26BargainOk = b => !b.fd && (b.tok || /\b(Artifact|Enchantment)\b/.test(typeOf(b)));
{
  const ra = r21bAdds;
  r21bAdds = function(c){
    const out = ra(c);
    try {
      if (/(?:^|\n)bargain(?:\n|$)/i.test(r21bText(c.k))) out.push({kind:'r26barg', label:'Bargain (sacrifice an artifact, enchantment, or token)', max:1, cost:{mana:'', label:'sacrifice an artifact, enchantment, or token', extra:[{t:'r21b', label:'sacrifice an artifact, enchantment, or token', feas:() => S.bf.some(r26BargainOk) ? '' : 'you control no artifact, enchantment or token', run:async () => { const list = S.bf.filter(r26BargainOk); const ids = list.length === 1 ? [list[0].id] : await pickCards({title:`${cname(c)}: bargain — sacrifice an artifact, enchantment, or token`, cards:list, min:1, max:1}); const b = ids && S.bf.find(x => x.id === ids[0]); if (!b) return false; sacrificeOne(b); UI.r26barg = c.id; return true; }}]}});
      // splice onto Arcane: reveal cards from your hand and pay their splice costs
      if (/\bArcane\b/.test(info(c.k)?.t || '')) for (const h of S.hand){ if (h === c) continue; const m = r21bText(h.k).match(/(?:^|\n)splice onto arcane ((?:\{[^}]+\})+)/i); if (!m) continue;
        out.push({kind:'r26splice', label:`Splice ${cname(h)} onto it (${m[1]})`, max:1, cost:{mana:m[1], label:m[1], extra:[{t:'r21b', label:`reveal ${cname(h)}`, feas:() => S.hand.includes(h) ? '' : 'not in hand', run:async () => { (UI.r26spl = UI.r26spl || []).push(h.k); log(`spliced ${cname(h)} onto ${cname(c)}`); return true; }}]}}); }
    } catch (e){ console.warn(e); }
    return out;
  };
  const bc = beginCast;
  beginCast = async function(c, zone, o = {}){
    if (UI.dry || !S || !c) return bc(c, zone, o);
    const outer = !UI.r26casting; if (outer){ UI.r26barg = null; UI.r26spl = null; UI.r26casting = true; }
    const n0 = S.stk.length;
    try { await bc(c, zone, o); }
    finally { if (outer){ UI.r26casting = false;
      const it = S.stk.length > n0 ? S.stk.find(x => x.card === c && x.kind === 'spell') : null;
      if (it){ if (UI.r26barg === c.id){ it.bargained = 1; log(`${cname(c)} was bargained`); } if (UI.r26spl && UI.r26spl.length) it.r26spl = UI.r26spl.slice(); if (UI.r26sneak && UI.r26sneak.cid === c.id){ it.r26sneak = UI.r26sneak.def; } }
      UI.r26barg = null; UI.r26spl = null; UI.r26sneak = null; } }
  };
  const re = runEffects;
  runEffects = async function(txt, ctx){
    if (/Search your library for a card, exile it face down, then shuffle\. If this spell was bargained/i.test(String(txt || ''))) txt = String(txt).replace(/Search your library for a card, exile it face down, then shuffle\./i, 'R26 search your library for a card, exile it face down, then shuffle.');
    if (ctx && ctx.it && ctx.it.kind === 'spell' && ctx.it.r26spl && ctx.it.r26spl.length && !ctx.r26splDone){ ctx.r26splDone = true;
      const add = ctx.it.r26spl.map(k => r21bLines(k).filter(l => !/^splice onto /i.test(l)).join('\n').replace(new RegExp(String(info(k)?.n || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ctx.name || '~')).filter(Boolean);
      txt = [txt, ...add].join('\n'); ctx.full = txt; }
    return re(txt, ctx);
  };
}
// Beseech the Mirror
async function r26Pre2(s, l, ctx){
  let m;
  if (/^(?:you may )?cast the exiled card without paying its mana cost if that spell's mana value is (\d+) or less$/.test(l) && ctx.r26bes !== undefined){ return r26Pre2(`if this spell was bargained, ${l}`.replace(/^(if this spell was bargained, )you may /, '$1'), `if this spell was bargained, ${l}`.replace(/^(if this spell was bargained, )you may /, '$1'), {...ctx, it:{...(ctx.it || {}), bargained:1}}); }
  if (/^(?:r26 )?search your library for a card, exile it face down(?:, then shuffle)?$/.test(l)){
    if (UI.dry || !S.lib.length){ ctx.r26bes = null; return true; }
    const ids = await pickCards({title:`${ctx.name}: search your library for a card (exiled face down)`, cards:S.lib.slice(), min:1, max:1}); const c = ids && S.lib.find(x => x.id === ids[0]);
    if (c){ S.lib.splice(S.lib.indexOf(c), 1); c.fd = true; c.fdEx = 1; S.ex.push(c); ctx.r26bes = c.id; log(`${ctx.name}: exiled a card face down`); } shuffle(S.lib); commit(); return true; }
  if ((m = l.match(/^if this spell was bargained, (?:you may )?cast the exiled card without paying its mana cost if that spell's mana value is (\d+) or less$/))){
    const c = ctx.r26bes != null && S.ex.find(x => x.id === ctx.r26bes); if (!c || !(ctx.it && ctx.it.bargained) || UI.dry) return true;
    if (isLand(c.k) || (info(c.k)?.mv || 0) > +m[1]){ log(`${ctx.name}: ${cname(c)} can't be cast this way`); return true; }
    c.fd = false; if (await askYes(`${ctx.name}: cast ${cname(c)} without paying its mana cost?`, 'Cast it', 'No')){ await r21bCastNow(c, 'ex', {free:true}); }
    if (S.ex.includes(c)) c.fd = true; commit(); return true; }
  if (/^put the exiled card into your hand if it wasn't cast this way$/.test(l)){ const c = ctx.r26bes != null && S.ex.find(x => x.id === ctx.r26bes); if (c){ c.fd = false; delete c.fdEx; moveCard(c.id, 'hand', {quiet:true}); log(`${ctx.name}: put the exiled card into hand`); } commit(); return true; }
  if (/^untap all other creatures you control and after this phase, there is an additional combat phase$/.test(l)){ const me = srcCardOf(ctx); S.bf.filter(b => isCreatureCard(b) && b !== me).forEach(b => { b.tap = false; }); S.xc = (S.xc || 0) + 1; log(`${ctx.name}: untapped the other creatures; an additional combat phase follows this one`); commit(); return true; }
  if (/^create a token that's a copy of ~, except it has haste and loses soulbond$/.test(l)){ const me = srcCardOf(ctx); const k = me ? (me.origK || me.k) : ctx.k; if (UI.dry || !k) return true; const tk = cpyTok(r26Base({k}), {haste:true}); if (tk){ tk.r26noSB = 1; ctx.lastTok = [tk.id]; } commit(); return true; }
  // harness
  if (/^harness ~$/.test(l)){ const c = srcCardOf(ctx); if (c && S.bf.includes(c) && r26IsInf(r26Base(c))){ r26SetKey(c, r26InfKey(r26Base(c), true)); log(`${cname(c)} is harnessed`); } commit(); return true; }
  // Planechase-only actions do nothing outside a Planechase game (CR 701.31a, 311.7)
  if (/^planeswalk$/.test(l)){ log(`${ctx.name}: planeswalk — no planar deck in this game, nothing happens`); return true; }
  if (/^chaos ensues$/.test(l)){ log(`${ctx.name}: chaos ensues — no plane in this game, nothing happens`); return true; }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await r26Pre2(s, l, ctx)) return; return ds(s0, ctx); };
}

/* ---------- Keywords granted to cards and spells (warp, prowl, web-slinging, miracle, encore, foretell, plot, sneak, cascade, affinity) ---------- */
function r26Reduce(m, n){ const pc = String(m || ''); let gen = 0; const rest = pc.replace(/\{(\d+)\}/g, (x, d) => { gen += +d; return ''; }); const g = Math.max(0, gen - n); return (g ? `{${g}}` : '') + rest || '{0}'; }
STATIC_RULES.push(
  [/^artifact cards and red creature cards in your hand have warp ((?:\{[^}]+\})+)$/, m => ({kind:'r26gKw', who:'you', kw:'Warp', cost:m[1].toUpperCase(), test:'artOrRedCr'})],
  [/^([a-z]+) spells you cast have (prowl|web-slinging|warp) ((?:\{[^}]+\})+)$/, m => ({kind:'r26gKw', who:'you', kw:cap(m[2]), cost:m[3].toUpperCase(), desc:sing(m[1])})],
  [/^each legendary spell you cast that's one or more colors has web-slinging ((?:\{[^}]+\})+)$/, m => ({kind:'r26gKw', who:'you', kw:'Web-slinging', cost:m[1].toUpperCase(), test:'legColored'})],
  [/^each ([a-z]+) card in your hand has miracle$/, m => ({kind:'r26gMir', who:'you', desc:sing(m[1])})],
  [/^its miracle cost is equal to its mana cost reduced by \{(\d+)\}$/, m => ({kind:'r26gRed', who:'you', what:'miracle', n:+m[1]})],
  [/^each (~|[a-z]+) creature card in your graveyard has encore \{x\}, where x is its mana value$/, m => ({kind:'r26gEnc', who:'you', desc:m[1] === '~' ? '~' : sing(m[1])})],
  [/^each nonland card in your hand without foretell has foretell$/, m => ({kind:'r26gFore', who:'you'})],
  [/^its foretell cost is equal to its mana cost reduced by \{(\d+)\}$/, m => ({kind:'r26gRed', who:'you', what:'foretell', n:+m[1]})],
  [/^the top card of your library has plot$/, m => ({kind:'r26gPlot', who:'you'})],
  [/^the plot cost is equal to its mana cost$/, m => ({kind:'r26gNote', who:'you'})],
  [/^you may plot nonland cards from the top of your library$/, m => ({kind:'r26gPlot', who:'you'})],
  [/^creature cards in your graveyard have sneak ((?:\{[^}]+\})+)$/, m => ({kind:'r26gSneak', who:'you', cost:m[1].toUpperCase()})],
  [/^you may cast creature spells from your graveyard using their sneak abilities$/, m => ({kind:'r26gNote', who:'you'})],
  [/^spells you cast with mana value (\d+) or greater have cascade$/, m => ({kind:'r26cas', who:'you', mv:+m[1]})],
  [/^([a-z]+(?: and [a-z]+)?) spells you cast from your hand have cascade$/, m => ({kind:'r26cas', who:'you', desc:sing(m[1].replace(/ and /, ' or ')).replace(/instants? or sorcer(?:y|ies)/, 'instant or sorcery'), hand:true})],
  [/^the first spell you cast each turn has cascade$/, m => ({kind:'r26cas', who:'you', first:true})],
  [/^the first spell you cast from exile each turn has cascade$/, m => ({kind:'r26cas', who:'you', firstEx:true})],
  [/^([a-z]+) spells you cast have affinity for ([a-z]+)$/, m => ({kind:'giveAffinity', who:'you', desc:sing(m[1]), what:sing(m[2])})],
  [/^spells you cast have affinity for ([a-z]+)$/, m => ({kind:'giveAffinity', who:'you', desc:'', what:sing(m[1])})],
);
function r26Rules(kind){ return S ? rulesOn(kind).filter(r => r26LevelOk(r)) : []; }
// a rule from a leveled Class works only at its level (Ninja Teen level 3)
function r26LevelOk(r){ try { const src = S.bf.find(b => !b.fd && info(b.k)?.n === r.src); if (!src) return true; const a = info(src.k); if (!/(?:^|\n)\{[^}]+\}(?:\{[^}]+\})*: Level \d/.test(a.o || '')) return true;
  // find the level header above the line that made this rule
  const lines = String(a.o || '').split('\n'); let lvl = 1; const want = {r26gSneak:/have sneak/i, r26gNote:/sneak abilities|plot cost/i}[r.kind]; if (!want) return true;
  for (const l of lines){ const m = l.match(/: Level (\d+)/); if (m) lvl = +m[1]; if (want.test(l)) return (src.lvl || 1) >= lvl; } return true; } catch { return true; } }
function r26GrantLines(k, zoneHint){
  const out = []; if (!S) return out; const a = info(k); if (!a || isLand(k)) return out;
  for (const r of r26Rules('r26gKw')){
    if (r.test === 'artOrRedCr' && !(/\bArtifact\b/.test(a.t || '') || (/\bCreature\b/.test(a.t || '') && /R/.test(a.c || '')))) continue;
    if (r.test === 'legColored' && !(/\bLegendary\b/.test(a.t || '') && /[WUBRG]/.test(a.c || ''))) continue;
    if (r.desc && !descOk(k, r.desc)) continue;
    out.push(`${r.kw} ${r.cost}`);
  }
  for (const r of r26Rules('r26gMir')){ if (r.desc && !descOk(k, r.desc)) continue; const red = r26Rules('r26gRed').find(x => x.what === 'miracle' && x.src === r.src); out.push(`Miracle ${r26Reduce(a.m, red ? red.n : 0)}`); }
  for (const r of r26Rules('r26gEnc')){ const d = (r.desc === '~' ? String(r.src || '').split(/[ ,]/)[0].toLowerCase() : r.desc); if (!isCreatureCard({k}) || !descOk(k, d)) continue; out.push(`Encore {${a.mv || 0}}`); }
  return out;
}
{
  const rl = r21bLines;
  r21bLines = function(k, fl){ const out = rl(k, fl); if (fl || !S) return out; try { const add = r26GrantLines(k).filter(x => !out.some(o => o.toLowerCase().split(' ')[0] === x.toLowerCase().split(' ')[0])); return add.length ? out.concat(add) : out; } catch { return out; } };
}
// granted affinity (also "instant and sorcery spells you cast have affinity for creatures")
{
  const ar = affinityRed;
  affinityRed = function(c){ let n = ar(c); try { if (S && c){ for (const r of rulesOn('giveAffinity')){ if (r.desc && !descOk(c.k, r.desc)) continue; n += countOf(`${r.what}s you control`, {}) || 0; } } } catch {} return n; };
}
// granted cascade
{
  const ctr = castTriggers;
  castTriggers = function(c, a, it){
    ctr(c, a, it);
    try {
      const from = UI.castFrom || ''; if (from === 'ex'){ if (!S.r26exc || S.r26exc.t !== turnStr()) S.r26exc = {t:turnStr(), n:0}; S.r26exc.n++; }
      const nth = (S.casts || []).filter(x => x.t === turnStr()).length;
      for (const r of rulesOn('r26cas')){
        if (r.mv && (a.mv || 0) < r.mv) continue; if (r.desc && !descOk(c.k, r.desc)) continue; if (r.hand && from !== 'hand') continue;
        if (r.first && nth !== 1) continue; if (r.firstEx && (from !== 'ex' || S.r26exc.n !== 1)) continue;
        pushTrig(a.n, 'Exile cards from the top until a nonland card with lower mana value; you may cast it free (cascade).', {k:c.k, cmv:it.mv || a.mv || 0}); log(`${a.n} has cascade (${r.src})`);
      }
    } catch (e){ console.warn(e); }
  };
}
// granted foretell (Dream Devourer): foretell from hand, cast later for the reduced cost
EV_TYPES.push('r26fore');
function r26ForeCost(c){ if (!S) return null; const a = info(c.k); if (!a || isLand(c.k) || /(?:^|\n)Foretell /m.test(a.o || '')) return null; const r = r26Rules('r26gFore')[0]; if (!r) return null; const red = r26Rules('r26gRed').find(x => x.what === 'foretell' && x.src === r.src); return r26Reduce(a.m, red ? red.n : 0); }
{
  const fo = foretell;
  foretell = function(c){ const n0 = S.ex.length; const r = fo(c); try { if (S.ex.length > n0 && c.fd && c.fore === turnStr()){ const g = r26ForeCost(c); if (g) c.r26fore = g; emit({type:'r26fore', k:c.k, id:c.id}); } } catch {} return r; };
  const ex = r7ExButtons;
  r7ExButtons = function(c){ const h = ex(c); if (h || !c || !c.r26fore || !c.fore || c.fore === turnStr() || phaseNow().n === 0) return h; return `<button type="button" data-act="r26foreCast" data-id="${c.id}">Cast (foretell ${esc(c.r26fore)})</button>`; };
  ACT.r26foreCast = async el => { const [z,,c] = find(+el.dataset.id); if (z !== 'ex' || !c) return; closeModal(); c.fd = false; await beginCast(c, 'ex', {gy:{mana:c.r26fore, extra:[], label:'Foretell'}}); if (find(c.id)[0] === 'ex') c.fd = true; else { delete c.fore; delete c.r26fore; } commit(); };
}
// sneak: from your hand (printed) or graveyard (Ninja Teen), during the declare blockers step
function r26SneakCost(c, zone){ const m = r21bText(c.k).match(/(?:^|\n)sneak ((?:\{[^}]+\})+)/i); if (m && zone === 'hand') return m[1]; if (zone === 'gy' && isCreatureCard(c)){ const r = r26Rules('r26gSneak')[0]; if (r) return r.cost; } return null; }
function r26SneakWhy(c, zone, cost){ if (!ninjutsuWindow()) return 'only after blockers are declared'; if (!unblockedAttackers().length) return 'no unblocked attacker'; const sc = spellCost(c, zone, {alt:{mana:cost}}); return payPlan(sc.cost, S.pool).err || ''; }
async function r26DoSneak(c, zone, cost){
  const why = r26SneakWhy(c, zone, cost); if (why){ toast(why); return; }
  const un = unblockedAttackers(); const aid = un.length === 1 ? un[0].id : await askChoice({title:`${cname(c)}: sneak — return which unblocked attacker?`, options:un.map(a => ({label:cname(a), value:a.id}))});
  const a = S.bf.find(x => x.id === aid); if (!a) return; const def = a.atk; a.atk = ''; moveCard(a.id, 'hand', {quiet:true, manual:true}); log(`sneak: returned ${cname(a)} to hand`);
  UI.r26sneak = {cid:c.id, def}; await r21bCastNow(c, zone, {gy:{mana:cost, extra:[], label:'Sneak'}}); commit();
}
{
  const ho = r21bHandOpts;
  r21bHandOpts = function(c){ const out = ho(c); try { const cost = S && r26SneakCost(c, 'hand'); if (cost && phaseNow().n > 0) out.push({label:`Sneak ${cost} — return an unblocked attacker`, why:r26SneakWhy(c, 'hand', cost), run:() => r26DoSneak(c, 'hand', cost)});
    const fc = S && phaseNow().n > 0 && S.hand.includes(c) ? r26ForeCost(c) : null; if (fc) out.push({label:`Foretell ({2} now, cast later for ${fc})`, why:!phaseNow().mine ? 'only on your turn' : payPlan(parseCost('{2}'), S.pool).err || '', run:() => foretell(c)}); } catch (e){ console.warn(e); } return out; };
  const ga = r21bGyAbils;
  r21bGyAbils = function(c){ const out = ga(c); try { const cost = S && r26SneakCost(c, 'gy'); if (cost) out.push({label:`Sneak ${cost} — cast it from your graveyard`, why:r26SneakWhy(c, 'gy', cost), run:() => r26DoSneak(c, 'gy', cost)}); } catch (e){ console.warn(e); } return out; };
  const rt = resolveTop;
  resolveTop = async function(it, ...a){ const sn = it && it.kind === 'spell' ? it.r26sneak : null; const c = it && it.card; const r = await rt(it, ...a);
    try { if (sn && c){ const b = S.bf.find(x => x.id === c.id); if (b){ b.tap = true; b.atk = sn; b.sk = false; log(`${cname(b)} entered tapped and attacking ${defLabel(sn)} (sneak)`); commit(); } } } catch {} return r; };
}
// plot from the top of the library (Fblthp)
{
  const lm = libMenu;
  libMenu = function(x, y){ lm(x, y); try { const c = S.lib[0]; if (!c || isLand(c.k) || !r26Rules('r26gPlot').length) return; const menu = document.getElementById('menu'); if (!menu) return; const m = info(c.k)?.m || '{0}';
    menu.insertAdjacentHTML('afterbegin', `<div class="mh">Top card: ${esc(cname(c))} has plot</div>` + mb('r26plotTop', `Plot ${esc(cname(c))} (${esc(m)}) — cast it free on a later turn`) + '<div class="sep"></div>'); } catch (e){ console.warn(e); } };
  ACT.r26plotTop = () => { closeMenu(); const c = S.lib[0]; if (!c || isLand(c.k)) return; r21bDoPlot(c, r21bCost(info(c.k)?.m || '{0}')); };
}

/* ---------- Time travel ---------- */
async function r26TimeTravel(ctx){
  const objs = S.bf.filter(c => (c.nc || {}).time > 0).map(c => ({c, z:'bf'})).concat(S.ex.filter(c => c.r21bsus && (c.nc || {}).time > 0).map(c => ({c, z:'ex'})));
  if (!objs.length){ log(`${ctx.name}: time travel — nothing has time counters`); return; }
  for (const o of objs){
    const n = o.c.nc.time; const v = UI.dry ? 'keep' : await askChoice({title:`${ctx.name}: time travel — ${cname(o.c)} (${o.z === 'ex' ? 'suspended' : 'on the battlefield'}, ${n} time counter${n === 1 ? '' : 's'})`, options:[{label:'Remove a time counter', value:'rem'}, {label:'Add a time counter', value:'add'}, {label:'Leave it', value:'keep'}]});
    if (v === 'add'){ if (o.z === 'bf') addNamed(o.c, 'time', 1); else { o.c.nc.time++; o.c.co = o.c.nc.time; } log(`${ctx.name}: added a time counter to ${cname(o.c)}`); }
    else if (v === 'rem'){
      if (o.z === 'bf') addNamed(o.c, 'time', -1);
      else if (o.c.nc.time > 1){ o.c.nc.time--; o.c.co = o.c.nc.time; }
      else { r21bTrig(o.c, 'Remove the last time counter from it. Cast it without paying its mana cost.', {r21b:'susTick'}); }
      log(`${ctx.name}: removed a time counter from ${cname(o.c)}`);
    }
  }
  commit();
}

/* ---------- manifest from hand (Kozilek), cloak (Unexplained Absence) ---------- */
RQ_OPS.push('r26manH', 'r26cloak');
async function r26ManifestHand(n, why){ const cnt = Math.min(n, S.hand.length); if (!cnt) return 0; const ids = S.hand.length <= n || UI.dry ? S.hand.slice(0, cnt).map(c => c.id) : await pickCards({title:`${why}: manifest ${cnt} card${cnt === 1 ? '' : 's'} from your hand`, cards:S.hand.slice(), min:cnt, max:cnt}); let k = 0; for (const id of ids || []){ const c = S.hand.find(x => x.id === id); if (c && !UI.dry){ r21bManifest(c, why); k++; } } return UI.dry ? cnt : k; }
function r26Cloak(why){ const c = S.lib[0]; if (!c) return null; const b = r21bManifest(c, why); if (b){ b.ekw = [...new Set([...(b.ekw || []), 'ward {2}'])]; b.r26cloak = 1; log(`cloaked a card (ward {2})`); } return b; }
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r && r.op === 'r26manH'){ (async () => { await r26ManifestHand(r.n || 1, r.src || 'manifest'); commit(); })(); return; }
    if (r && r.op === 'r26cloak'){ for (let i = 0; i < (r.n || 1); i++) r26Cloak(r.src); commit(); return; }
    return ao(r, from);
  };
}
{
  const kw = kwOf;
  kwOf = function(c, k, ...rest){ const r = kw(c, k, ...rest); if (r || !c) return r; try { if (c.r26cloak && /^ward/.test(k) && (c.ekw || []).some(x => /^ward/.test(x))) return true; } catch {} return r; };
}

/* ---------- becomes tapped: "during your turn", "for the first time", "you tap an untapped creature an opponent controls" ---------- */
EV_TYPES.push('r26tapOpp');
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){
    let m;
    if ((m = c.match(/^(.+?) becomes tapped for the first time during each of your turns$/))){ const sj = subjOf(m[1]); if (sj) return {ev:'tapped', ...sj, r26my:true, r26first:true}; }
    if ((m = c.match(/^(.+?) becomes tapped during your turn$/))){ const sj = subjOf(m[1]); if (sj) return {ev:'tapped', ...sj, r26my:true}; }
    if (/^you tap an untapped creature an opponent controls$/.test(c)) return {ev:'r26tapOpp', subj:'any', ctl:'any', desc:''};
    if (/^you foretell a card$/.test(c)) return {ev:'r26fore', subj:'any', ctl:'you', desc:''};
    return ct(w, c);
  };
  const sm = subjMatch;
  subjMatch = function(t, src, ev, pid){
    if (t && ev && ev.type === 'tapped'){ if (t.r26my && currentTurn()[1] !== MYPID) return false; if (t.r26first && pid === MYPID && ((S.r26tap && S.r26tap.t === turnStr() && S.r26tap.n[ev.id]) || 0) !== 1) return false; }
    if (t && ev && (ev.type === 'r26tapOpp' || ev.type === 'r26fore')) return pid === MYPID;
    return sm(t, src, ev, pid);
  };
  // "This ability triggers only once each turn"
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    try { if (t && /this ability triggers only once each turn/i.test(t.eff || '') && src){ S.r26once = S.r26once && S.r26once.t === turnStr() ? S.r26once : {t:turnStr(), k:{}}; const key = src.id + '|' + (t.raw || t.eff); if (S.r26once.k[key]) return; S.r26once.k[key] = 1; } } catch {}
    return pt(src, t, ev, evPid);
  };
  const sq = sendRq;
  sendRq = function(to, op, n, src, extra = {}){
    try { if (S && op === 'tap' && to !== MYPID && extra && extra.tid != null){ const o = OPP.get(to); const b = o && (o.bf || []).find(x => x.id === extra.tid); if (b && !b.tp && b.k && isCreatureCard({k:b.k})) emit({type:'r26tapOpp', k:b.k, id:b.id}); } } catch {}
    return sq(to, op, n, src, extra);
  };
}
async function r26Pre3(s, l, ctx){
  let m;
  if (/^this ability triggers only once each turn$/.test(l)) return true;
  // keyword lines whose work is done while casting (bargain, splice, sneak, warp with a non-mana part)
  if (/^bargain$/.test(l) || /^splice onto arcane (?:\{[^}]+\})+$/.test(l) || /^sneak (?:\{[^}]+\})+$/.test(l) || /^warp\s*—\s*(?:\{[^}]+\})+(?:, pay \w+ life)?$/.test(l)) return true;   // enforced when the trigger is put on the stack
  if ((m = l.match(/^if it's the first time that creature has become tapped this turn, (.+)$/))){ const id = ctx.it && ctx.it.evId; const n = id != null && S.r26tap && S.r26tap.t === turnStr() ? (S.r26tap.n[id] || 0) : 0; if (n === 1 || UI.dry){ if (/^untap it$/.test(m[1])){ const c = S.bf.find(b => b.id === id); if (c){ c.tap = false; log(`${ctx.name}: untapped ${cname(c)}`); commit(); } } else await doSentence(cap(s.slice(s.length - m[1].length)), {...ctx, lastT:[{pid:MYPID, id, k:ctx.it && ctx.it.evk}]}); } return true; }
  if (/^it becomes plotted$/.test(l) && ctx.r26ctr){ const t = ctx.r26ctr; if (t.pid === MYPID) r26PlotCountered(t.sid, t.cid, ctx.name); else { sendRq(t.pid, 'r26plotC', 0, ctx.name, {d:t.sid}); log(`${ctx.name}: the countered spell becomes plotted`); } return true; }
  if (/^it becomes plotted$/.test(l) && UI.dry) return true;
  if (/^exile target spell$/.test(l) && /it becomes plotted/i.test(String(ctx.full || ''))){ if (UI.dry) return true;
    let sid = ctx.it && ctx.it.tgt; if (!sid){ const g = ctx.tgts ? nextTargets(ctx) : []; const t = g.find(x => x && x.sid); sid = t && t.sid; }
    const tgt = sid && stackAll().find(x => x.sid === sid); if (!tgt || tgt.kind !== 'spell'){ log(`${ctx.name}: no spell to exile`); return true; }
    ctx.r26ctr = {sid, pid:tgt.pid, cid:tgt.it && tgt.it.card ? tgt.it.card.id : null}; log(`${ctx.name}: exiled ${tgt.nm} from the stack`);
    if (tgt.pid === MYPID){ const it = tgt.it || S.stk.find(x => x.sid === sid); const i = S.stk.indexOf(it); if (i >= 0) S.stk.splice(i, 1); if (it && it.card){ faceRestore(it.card); it.card.fl = false; S.ex.push(it.card); } }
    else { S.ctr.push({id:rid(8), sid, un:0}); if (S.ctr.length > 20) S.ctr.splice(0, S.ctr.length - 20); }
    commit(); return true; }
  if ((m = l.match(/^time travel(?: (twice|three times|four times))?$/))){ const n = {twice:2, 'three times':3, 'four times':4}[m[1]] || 1; for (let i = 0; i < n; i++) await r26TimeTravel(ctx); return true; }
  if ((m = l.match(/^up to (one|two) target players each manifest (a card|two cards) from their hands$/))){ const per = m[2] === 'a card' ? 1 : 2; let tot = 0; const ts = []; let g; while (ctx.tgts && (g = nextTargets(ctx)) && g.length) ts.push(...g);
    for (const p of ts.filter(x => x.t === 'player' || x.pid)){ if (p.pid === MYPID) tot += await r26ManifestHand(per, ctx.name); else { const hc = (OPP.get(p.pid) || {}).hc || 0; tot += Math.min(per, hc); sendRq(p.pid, 'r26manH', per, ctx.name); log(`${ctx.name}: ${nameOf(p.pid)} manifests ${per} card${per === 1 ? '' : 's'} from their hand`); } }
    ctx.r26man = tot; commit(); return true; }
  if (/^for each card manifested this way, you draw a card$/.test(l)){ const n = ctx.r26man || 0; if (n) draw(n); log(`${ctx.name}: drew ${n}`); commit(); return true; }
  if (/^for each permanent exiled this way, its controller cloaks the top card of their library$/.test(l)){ const ex = (ctx.r26ex || []); const by = {}; ex.forEach(t => { by[t.pid] = (by[t.pid] || 0) + 1; });
    for (const [pid, n] of Object.entries(by)){ if (pid === MYPID){ for (let i = 0; i < n; i++) r26Cloak(ctx.name); } else { sendRq(pid, 'r26cloak', n, ctx.name); log(`${ctx.name}: ${nameOf(pid)} cloaks ${n === 1 ? 'the top card' : n + ' cards'} of their library`); } } commit(); return true; }
  if (/^for each player, exile up to one target nonland permanent that player controls$/.test(l)){ const ts = []; let g; while (ctx.tgts && (g = nextTargets(ctx)) && g.length) ts.push(...g); ctx.r26ex = [];
    for (const t of ts){ if (t.t === 'player') continue; if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c && !isLand(c.k)){ moveCard(c.id, 'ex'); ctx.r26ex.push(t); } } else { applyTo(t, {op:'exile', src:ctx.name}); ctx.r26ex.push(t); } }
    commit(); return true; }
  // name stickers (_____ Goblin)
  if (/^you may put a name sticker on it$/.test(l) || /^you may put a name sticker on ~$/.test(l)){ const c = srcCardOf(ctx); if (UI.dry){ ctx.r26stk = 'goblin'; return true; }
    const w = await r26AskSticker(ctx.name); if (!w){ ctx.r26stk = ''; return true; } ctx.r26stk = w; if (c){ c.r26stk = w; } log(`${ctx.name}: put the name sticker “${w}” on it`); commit(); return true; }
  if (/^add \{r\} for each unique vowel on that sticker$/.test(l)){ const w = String(ctx.r26stk || '').toLowerCase(); const n = new Set((w.match(/[aeiou]/g) || [])).size; if (n){ addMana(Array(n).fill('R')); log(`${ctx.name}: added ${'{R}'.repeat(n)} (${n} unique vowel${n === 1 ? '' : 's'})`); } commit(); return true; }
  return false;
}
async function r26AskSticker(name){
  // the word on the physical name sticker the player chose from their sticker sheet
  const v = await askChoice({title:`${name}: put a name sticker on it?`, text:'Type the word on the sticker you put on it.', options:[{label:'Type the sticker word…', value:'type'}, {label:'No sticker', value:''}]});
  if (v !== 'type') return '';
  const w = typeof prompt === 'function' ? prompt('Word on the name sticker:') : ''; return String(w || '').trim().slice(0, 30);
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await r26Pre3(s, l, ctx)) return; return ds(s0, ctx); };
}

/* ---------- a countered spell becomes plotted (Aven Interrupter) ---------- */
RQ_OPS.push('r26plotC');
function r26PlotCountered(sid, cid, why){
  const it = S.stk.find(x => x.sid === sid); if (it){ it.r26plotC = 1; it.exAfter = true; return; }
  const id = cid != null ? cid : (S.r26ctrd || {})[sid]; const [z, , c] = id != null ? find(id) : [];
  if (c && (z === 'gy' || z === 'ex')){ if (z === 'gy') moveCard(c.id, 'ex', {quiet:true}); c.r21bplot = turnStr(); log(`${cname(c)} was exiled and plotted (${why}) — its owner may cast it free on a later turn`); commit(); }
}
{
  const cm = counterMine;
  counterMine = function(it, byPid){ const c = it && it.kind === 'spell' ? it.card : null; const plot = it && it.r26plotC; const r = cm(it, byPid);
    try { if (c){ S.r26ctrd = S.r26ctrd || {}; S.r26ctrd[it.sid] = c.id; if (plot) r26PlotCountered(it.sid, c.id, 'plotted'); } } catch {} return r; };
  const rc = resolveCounter;
  resolveCounter = async function(ctx){ try { const it = ctx.it; const tgt = it && it.tgt && stackAll().find(x => x.sid === it.tgt); if (tgt) ctx.r26ctr = {sid:tgt.sid, pid:tgt.pid, cid:tgt.it && tgt.it.card ? tgt.it.card.id : null}; } catch {} return rc(ctx); };
  const ao = applyOp;
  applyOp = function(r, from){ if (r && r.op === 'r26plotC'){ r26PlotCountered(String(r.d || ''), null, r.src || 'plot'); return; } return ao(r, from); };
}

/* ---------- Warp with a non-mana part ("Warp—{B}, Pay 2 life"), and warp from the graveyard (Timeline Culler) ---------- */
function r26WarpCost(c){ const m = r21bText(c.k).match(/(?:^|\n)warp\s*—\s*([^\n]+)/i); if (!m) return null; const cost = r21bCost(m[1]); return r21bKnown(cost) ? cost : null; }
{
  const ra = r21bAlts;
  r21bAlts = function(c, zone){
    const out = ra(c, zone);
    try { if (zone === 'hand' && S && !out.some(o => o.kind === 'warp')){ const cost = r26WarpCost(c); if (cost){ const sc = spellCost(c, zone, {alt:{mana:cost.mana}}); const tm = timingOk(c); out.push({kind:'warp', label:`Warp ${cost.label} — exiled at end step, cast it again later`, mana:cost.mana, extra:cost.extra, sc, why:!tm.ok ? tm.why : payPlan(sc.cost, S.pool).err || cost.extra.map(x => extraFeasible(x, c)).find(Boolean) || ''}); } } } catch (e){ console.warn(e); }
    return out;
  };
  const go = gyOptions;
  gyOptions = function(c){ const r = go(c) || []; try { if (S && c && /you may cast ~ from your graveyard using its warp ability/i.test(tname(info(c.k)?.o || '', info(c.k)?.n))){ const cost = r26WarpCost(c) || (() => { const m = r21bText(c.k).match(/(?:^|\n)warp ((?:\{[^}]+\})+)/i); return m ? r21bCost(m[1]) : null; })(); if (cost && !r.some(o => o.kind === 'r26warp')) r.push({kind:'r26warp', label:`Warp ${cost.label} (from graveyard)`, mana:cost.mana, extra:cost.extra, after:''}); } } catch (e){ console.warn(e); } return r; };
  const bc = beginCast;
  beginCast = async function(c, zone, o = {}){ const n0 = S ? S.stk.length : 0; const r = await bc(c, zone, o); try { if (S && o && o.gy && o.gy.kind === 'r26warp'){ const it = S.stk.length > n0 ? S.stk.find(x => x.card === c && x.kind === 'spell') : null; if (it){ it.r21balt = 'warp'; it.r21bpost = 1; } } } catch {} return r; };
}
STATIC_KNOWN.push(/^you may cast ~ from your graveyard using its warp ability$/);
{
  const ko = keywordsOnly;
  keywordsOnly = function(l){ return ko(l) || /^warp\s*—\s*(?:\{[^}]+\})+(?:, pay \w+ life)?\.?$/i.test(String(l).trim()); };
}

/* ---------- "~ gets +N/+N until end of turn" as an effect (the base runner skips sentences starting "~ gets", taking them for static text) ---------- */
{
  const re = runEffects;
  // only a sentence that ENDS at "until end of turn": melee's "… until end of turn for each opponent you attacked this combat" is not this
  const SELF = /(^|\.\s+|\n)~ gets ([+-]\d+\/[+-]\d+(?: and gains [a-z ,]+)? until end of turn)(?=\.|\n|$)/g;
  runEffects = async function(txt, ctx){
    try { if (ctx && txt){ const t = tname(String(txt), ctx.name || info(ctx.k)?.n || ''); if (/(^|\.\s+|\n)~ gets [+-]\d+\/[+-]\d+(?: and gains [a-z ,]+)? until end of turn(?=\.|\n|$)/.test(t)) txt = t.replace(SELF, '$1R26self gets $2'); } } catch {}
    return re(txt, ctx);
  };
}
async function r26Pre4(s, l, ctx){
  let m;
  if ((m = l.match(/^r26self gets ([+-]\d+)\/([+-]\d+)(?: and gains ([a-z ,]+?))? until end of turn$/))){ if (UI.dry) return true; const c = srcCardOf(ctx); const f = {p:+m[1], t:+m[2], kw:m[3] ? m[3].split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim()).filter(Boolean) : []};
    if (c && find(c.id)[0] === 'bf') applyOp({op:'pump', tid:c.id, f}, MYPID); else log(`${ctx.name}: it's no longer on the battlefield`); commit(); return true; }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await r26Pre4(s, l, ctx)) return; return ds(s0, ctx); };
}
