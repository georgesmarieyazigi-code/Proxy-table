/* ===================== Rules engine — round 27 helper C: v17 one-offs ===================== */
const C27 = {};
function c27Tg(ctx){ return ctx && ctx.tgts ? nextTargets(ctx) : []; }
function c27Ctl(c){ if (!S || !c) return null; if (S.bf.includes(c)) return MYPID; for (const [pid, s] of OPP) if ((s.bf || []).includes(c)) return pid; return null; }
function c27RuleFor(kind, pid){ return staticRules().some(r => r.kind === kind && r.pid === pid); }
function c27Name(c){ return c && c.k ? (info(c.k)?.n || '') : ''; }

STATIC_RULES.push(
  // Elsha of the Infinite (the first sentence is engine12's topPlay rule; this one gives those casts flash)
  [/^(?:you may cast noncreature spells from the top of your library|if you cast a spell this way, you may cast it as though it had flash)$/, m => ({kind:'c27topFlash', who:'you'})],
  // Brighthearth Banneret
  [/^reinforce (\w+)—(?:\{[^}]+\})+$/, m => ({kind:'c27reinforce', who:'you'})],
  // Kíli the Resourceful
  [/^storied$/, m => ({kind:'c27storied', who:'you'})],
  [/^as long as you have an enduring story, you may pay \{0\} rather than pay the equip cost of the first equip ability you activate each turn$/, m => ({kind:'n24eq0', who:'you', c27story:true})],
  // Gemcutter Buccaneer
  [/^treasures you control are equipment in addition to their other types and have "equipped creature gets \+2\/\+0," equip pirate \{1\}, and equip \{3\}$/, m => ({kind:'c27gem', who:'you'})],
);

/* ---------- flags that travel in cross-player requests ---------- */
{
  const cf = cleanFlags;
  cleanFlags = function(f){ const o = cf(f); try { if (f && typeof f === 'object') for (const k of Object.keys(f)) if (/^c27[a-z]+$/i.test(k) && f[k]) o[k] = typeof f[k] === 'number' ? Math.max(0, Math.min(99, Math.floor(f[k]))) : true; } catch {} return o; };
}

/* ---------- Elsha of the Infinite: noncreature spells from the top of the library, as though they had flash ---------- */
{
  const to = timingOk;
  timingOk = function(c, ...a){ const r = to(c, ...a);
    try { if (r && !r.ok && c && S && S.lib[0] === c && !isLand(c.k) && !isCreatureCard(c) && phaseNow().n > 0 && !/split second/i.test(r.why || '')){
      const fl = rulesOn('c27topFlash'); if (fl.length && rulesOn('topPlay').some(t => t.desc === 'noncreature' && fl.some(f => f.src === t.src))){ log(`${cname(c)}: cast from the top of the library as though it had flash (${fl[0].src})`); return {ok:true}; } } } catch (e){ console.warn(e); }
    return r; };
}

/* ---------- Reinforce N—{cost}: "{cost}, Discard this card: Put N +1/+1 counters on target creature" (CR 702.77) ---------- */
{
  const ha = handAbilities;
  handAbilities = function(c){ const out = ha(c);
    try { const f = info(c.k); if (f) for (const raw of tname(f.o || '', f.n).split('\n')){ const m = raw.trim().match(/^reinforce (\w+)—((?:\{[^}]+\})+)$/i); if (!m) continue; const n = wn(m[1].toLowerCase()) || +m[1] || 1;
      out.push({cost:`${m[2]}, Discard ~`, eff:`Put ${n} +1/+1 counter${n > 1 ? 's' : ''} on target creature.`, c27reinforce:n}); } } catch {}
    return out; };
}

/* ---------- Kíli: Storied / enduring story ---------- */
function c27StoryCheck(){
  if (!S || S.c27story || UI.dry) return false;
  if (!rulesOn('c27storied').length) return false;
  const n = S.bf.filter(b => !b.fd && b.k && /\b(Legendary|Saga|Artifact)\b/.test(typeOf(b))).length;
  if (n >= 3){ S.c27story = 1; log(`📖 has an enduring story (a storied permanent and ${n} legendary, Saga or artifact permanents) — kept for the rest of the game`); return true; }
  return false;
}
{
  const ro = rulesOn;
  rulesOn = function(kind, pid = MYPID){ const r = ro(kind, pid); if (kind !== 'n24eq0') return r;
    return r.filter(x => !x.c27story || (x.pid === MYPID ? !!(S && S.c27story) : !!(OPP.get(x.pid) || {}).c27story)); };
  const cm = commit;
  commit = function(...a){ try { c27StoryCheck(); c27GemSBA(); } catch (e){ console.warn(e); } return cm.apply(this, a); };
  const ps = publicState;
  publicState = function(){ const o = ps(); try { if (S && S.c27story) o.c27story = 1; if (S && S.lost) o.c27lost = 1; if (S && S.c27atk && S.c27atk.t === turnStr()) o.c27atk = S.c27atk; } catch {} return o; };
  const ss = sanitizeState;
  sanitizeState = function(s){ const o = ss(s); try { if (o && s){ if (s.c27story) o.c27story = 1; if (s.c27lost) o.c27lost = 1;
    if (s.c27atk && typeof s.c27atk === 'object' && typeof s.c27atk.t === 'string') o.c27atk = {t:s.c27atk.t.slice(0, 20), by:(Array.isArray(s.c27atk.by) ? s.c27atk.by.slice(0, 8) : []).map(x => String(x).slice(0, 40))}; } } catch {} return o; };
}

/* ---------- Crypt Rats: X paid with black mana only ---------- */
function c27BlackMax(){ let n = 0; while (n < 60 && !payPlan(parseCost('{B}'.repeat(n + 1)), S.pool).err) n++; return n; }
{
  const aa = activateAbility;
  activateAbility = async function(c, ab, ...rest){
    if (!c || !ab || !/spend only black mana on x/i.test(ab.eff || '') || !/\{X\}/i.test(ab.cost || '')) return aa(c, ab, ...rest);
    if (UI.casting) return;
    const max = c27BlackMax();
    const v = await askNumber(`${cname(c)}: choose X (black mana only — you can make ${max} black)`, `Up to ${max}`, Math.min(1, max)); if (v == null) return;
    const x = Math.max(0, Math.floor(+v || 0)); if (x > max){ toast(`You can only pay ${max} black mana for X`); return; }
    const other = String(ab.cost).replace(/\{X\}/gi, '').replace(/^,\s*|,\s*$/g, '');
    const ab2 = {...ab, cost:[('{B}'.repeat(x) + other.match(/^(?:\{[^}TQ]+\})*/i)[0]) || '', other.replace(/^(?:\{[^}TQ]+\})*/i, '').replace(/^,\s*/, '')].filter(Boolean).join(', ') || '{0}'};
    C27.ratsX = x;
    try { return await aa(c, ab2, ...rest); } finally { C27.ratsX = null; }
  };
  const pac = payAbilityCost;
  payAbilityCost = async function(c, cost, o){ const ok = await pac(c, cost, o); if (ok && C27.ratsX != null){ UI.lastX = C27.ratsX; log(`${cname(c)}: X = ${C27.ratsX}, paid with black mana`); } return ok; };
}

/* ---------- Gemcutter Buccaneer: Treasures are Equipment ---------- */
function c27IsTreasure(c){ return !!c && !c.fd && /\bTreasure\b/.test(C27.to0 ? C27.to0(c) : (info(c.k)?.t || '')); }
function c27GemOn(pid){ try { return c27RuleFor('c27gem', pid); } catch { return false; } }
{
  const to = typeOf; C27.to0 = to;
  typeOf = c => { const t = to(c); try { if (c && S && /\bTreasure\b/.test(t) && !/\bEquipment\b/.test(t)){ const pid = c27Ctl(c); if (pid && c27GemOn(pid)) return t + ' Equipment'; } } catch {} return t; };
  const al = abilityList;
  abilityList = function(c){ const out = al(c);
    try { if (c && S && S.bf.includes(c) && c27IsTreasure(c) && c27GemOn(MYPID) && !out.some(o => o.c27gem)){
      return out.concat([{cost:'{1}', eff:'Attach ~ to target Pirate creature you control.', sorc:true, line:'Equip Pirate {1}', equip:true, c27gem:1},
                         {cost:'{3}', eff:'Attach ~ to target creature you control.', sorc:true, line:'Equip {3}', equip:true, c27gem:1}]); } } catch {}
    return out; };
  const af = attachFx;
  attachFx = function(c, pid = MYPID){ const fx = af(c, pid);
    try { if (c && !fx.c27gem){ fx.c27gem = 1; for (const b of boardsAll()){ if (!c27GemOn(b.pid)) continue; for (const s of b.bf){ if (!s.att || s.att.pid !== pid || s.att.id !== c.id || !s.k || s.fd) continue; if (!/\bTreasure\b/.test(info(s.k)?.t || '')) continue; fx.p += 2; fx.names.push(info(s.k)?.n || 'Treasure'); } } } } catch {}
    return fx; };
}
function c27GemSBA(){
  if (!S || UI.dry) return; let gone = false;
  for (const s of S.bf){ if (!s.att || !s.k || !/\bTreasure\b/.test(info(s.k)?.t || '') || /\bEquipment\b/.test(info(s.k)?.t || '')) continue; if (c27GemOn(MYPID)) continue; delete s.att; gone = true; log(`${cname(s)} is no longer an Equipment — it becomes unattached`); }
  return gone;
}

/* ---------- Oft-Nabbed Goat: only opponents may activate, as a sorcery ---------- */
const C27_OPPAB = /^only your opponents may activate this ability and only as a sorcery$/i;
function c27OppAbs(){
  const out = []; if (!S) return out;
  for (const [pid, s] of OPP) for (const c of (s.bf || [])){ if (!c.k || c.fd) continue; const a = info(c.k); if (!a || !/only your opponents may activate this ability/i.test(a.o || '')) continue;
    for (const raw of tname(a.o, a.n).split('\n')){ const m = raw.trim().match(/^((?:\{[^}]+\})+):\s*([\s\S]+)$/); if (m && /only your opponents may activate this ability/i.test(m[2])) out.push({pid, c, cost:m[1], eff:m[2], nm:a.n}); } }
  return out;
}
function c27OppAbWhy(x){ if (phaseNow().n === 0) return 'Start the game first'; if (!sorceryTime()) return 'Only as a sorcery (your main phase, empty stack)'; const p = payPlan(parseCost(x.cost), S.pool); if (p.err) return 'Mana ' + p.err; return ''; }
async function c27OppActivate(pid, id){
  if (UI.casting) return; const x = c27OppAbs().find(o => o.pid === pid && o.c.id === id); if (!x){ toast("That permanent isn't there any more"); return; }
  const why = c27OppAbWhy(x); if (why){ toast(why); return; }
  UI.casting = true;
  try {
    const plan = payPlan(parseCost(x.cost), S.pool); if (plan.err){ toast(plan.err); return; } S.pool = plan.pool;
    const txt = x.eff.replace(/\s*Only your opponents may activate this ability and only as a sorcery\.?/i, '').trim();
    const it = {sid:rid(6), o:nextO(), kind:'ability', k:x.c.k, nm:x.nm, txt, srcId:null, tgts:null, tgtNm:`${nameOf(pid)}'s ${x.nm}`, c27opp:{pid, id}};
    S.stk.push(it); S.pass = 's:' + it.sid; log(`activated ${nameOf(pid)}'s ${x.nm} (paid ${x.cost}): ${short(txt, 80)}`); commit();
  } finally { UI.casting = false; }
}
{
  const ar = abilityReady;
  abilityReady = function(c, ab, mana){ try { if (ab && C27_OPPAB.test(String(ab.eff || '').split(/\.\s*/).map(s => s.trim()).filter(Boolean).pop() || '')) return 'Only your opponents may activate this'; } catch {} return ar(c, ab, mana); };
  const ch = r7Chips;
  r7Chips = function(){ let h = ch();
    try { for (const x of c27OppAbs()){ const why = c27OppAbWhy(x); h += `<button type="button" class="chip3" data-act="c27oppAb" data-pid="${esc(x.pid)}" data-id="${x.c.id}" ${why ? 'disabled' : ''} title="${esc(why || x.eff)}">${esc(nameOf(x.pid))}'s ${esc(x.nm)}: ${manaHTML(x.cost)} ${esc(short(x.eff.split('.')[0], 30))}</button>`; } } catch {}
    return h; };
  ACT.c27oppAb = el => { c27OppActivate(el.dataset.pid, +el.dataset.id); };
  const tc = takeCard;
  takeCard = function(r, from){ const n0 = S.bf.length; const out = tc(r, from); try { if (r && r.f && r.f.c27cm && S.bf.length > n0){ const c = S.bf[S.bf.length - 1]; modCounters(c, 'cm', 1); log(`${cname(c)} gets a -1/-1 counter`); } } catch {} return out; };
}

/* ---------- cross-player ops ---------- */
RQ_OPS.push('c27exHand', 'c27reb', 'c27hpSteal');
{
  const ao = applyOp;
  applyOp = function(r, from){
    try {
      if (r.op === 'c27exHand'){ // Cruelclaw's Heist: exile the chosen card from my hand; d = key|w (w: lend permission, '' = none)
        const [k, w] = String(r.d || '').split('|'); const h = S.hand.find(x => x.k === k); let n = 0;
        if (h){ moveCard(h.id, 'ex', {quiet:true}); const e = S.ex.find(x => x.id === h.id); log(`${cname(h)} was exiled from my hand (${r.src})`); if (e && w){ r21Lend(e, from, r.ref, w, r.src); n = 1; } }
        r21Ack(from, r.ref, n, r.src); commit(); return; }
      if (r.op === 'c27reb'){ // Hellish Rebuke: my permanents (right now) gain the damage trigger until end of turn
        (S.c27reb ||= []).push({by:from, t:turnStr(), ids:S.bf.map(c => c.id), src:r.src}); if (S.c27reb.length > 10) S.c27reb.splice(0, S.c27reb.length - 10);
        log(`${r.src}: my permanents gain “when this permanent deals damage to ${nameOf(from)}, sacrifice it and lose 2 life” until end of turn`); commit(); return; }
      if (r.op === 'c27hpSteal'){ // Hot Pursuit: give all my goaded and/or suspected creatures to the sender until end of turn, untapped, with haste
        const list = S.bf.filter(c => c.k && !c.fd && isCreatureCard(c) && (goadOn(c) || c.jSus));
        list.forEach(c => giveAway(single(c), from, {eot:true, untap:true, haste:true})); if (!list.length) log(`${r.src}: no goaded or suspected creatures to give`); commit(); return; }
      if (r.op === 'dmg'){ const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null;
        if (c && c27IsGrothama(c)){ const d0 = c.dmg || 0; const out = ao(r, from); const c2 = S.bf.find(b => b.id === c.id); const dealt = c2 ? Math.max(0, (c2.dmg || 0) - d0) : Math.max(0, r.n || 0); c27GroRec(c.id, from, dealt); return out; } }
    } catch (e){ console.warn(e); }
    return ao(r, from);
  };
}

/* ---------- Grothama, All-Devouring ---------- */
function c27IsGrothama(c){ return !!c && !!c.k && /each player draws cards equal to the amount of damage dealt to ~ this turn by sources they controlled/i.test(tname(info(c.k)?.o || '', info(c.k)?.n || '')); }
function c27GroRec(id, pid, n){ if (!n) return; S.c27gd ||= {}; const T = turnStr(); let e = S.c27gd[id]; if (!e || e.t !== T) e = S.c27gd[id] = {t:T, by:{}}; e.by[pid] = (e.by[pid] || 0) + n; const ks = Object.keys(S.c27gd); if (ks.length > 20) delete S.c27gd[ks[0]]; }
function c27Grothamas(){ const out = []; for (const b of boardsAll()) for (const c of b.bf) if (c.k && !c.fd && /^other creatures have "whenever (?:~|this creature) attacks, you may have it fight ~[.․]?"$/im.test(tname(info(c.k)?.o || '', info(c.k)?.n || ''))) out.push({pid:b.pid, c}); return out; }

/* ---------- Ramses / Hot Pursuit: who attacked whom with what, who has lost ---------- */
function c27LostCount(){ let n = S && S.lost ? 1 : 0; for (const [, s] of OPP) if (s && s.c27lost) n++; return n; }
function c27LossScan(){
  if (!S || UI.dry) return; C27.lostSeen ||= new Set();
  for (const [pid, s] of OPP){ if (s && !s.c27lost) C27.lostSeen.delete(pid); if (!s || !s.c27lost || C27.lostSeen.has(pid)) continue; C27.lostSeen.add(pid);
    for (const r of S.bf.filter(b => b.k && !b.fd && /^whenever a player loses the game, if they were attacked this turn by an assassin you controlled, you win the game\.?$/im.test(info(b.k)?.o || ''))){
      const a = S.c27atk; if (!(a && a.t === turnStr() && a.by.includes(pid))) continue;   // intervening "if"
      pushTrig(cname(r), 'If they were attacked this turn by an Assassin you controlled, you win the game.', {k:r.k, srcId:r.id, c27lostPid:pid}); } }
}
function c27HpGoadSync(){
  if (!S || UI.dry) return false; let ch = false;
  const hp = []; for (const b of boardsAll()) for (const c of b.bf) if (c.k && !c.fd && c.c27hp) hp.push({pid:b.pid, h:c.c27hp});
  for (const c of S.bf){ if (!c.k || c.fd) continue; const x = hp.find(o => o.h.pid === MYPID && o.h.id === c.id);
    if (x){ if (!c.c27hpg){ c.goad = {by:x.pid, n:1e9}; c.c27hpg = x.pid; ch = true; log(`${cname(c)} is goaded for as long as Hot Pursuit remains`); } }
    else if (c.c27hpg){ if (c.goad && c.goad.n === 1e9) delete c.goad; delete c.c27hpg; ch = true; log(`${cname(c)} is no longer goaded by Hot Pursuit`); } }
  return ch;
}
{
  const em = emit;
  emit = function(ev){ const r = em(ev);
    try { if (S && ev && !UI.dry){
      if (ev.type === 'attack'){ const c = S.bf.find(b => b.id === ev.id);
        if (c && /\bAssassin\b/.test(typeOf(c)) && /^p:/.test(c.atk || '')){ const T = turnStr(); if (!S.c27atk || S.c27atk.t !== T) S.c27atk = {t:T, by:[]}; const pid = String(c.atk).slice(2); if (!S.c27atk.by.includes(pid)) S.c27atk.by.push(pid); }
        if (c && isCreatureCard(c)) for (const g of c27Grothamas()){ if (g.pid === MYPID && g.c.id === c.id) continue;
          pushTrig(cname(c), `You may have it fight ${info(g.c.k)?.n}.`, {k:c.k, srcId:c.id, c27gro:{pid:g.pid, id:g.c.id, k:g.c.k}}); } }
      if ((ev.type === 'dmg' || ev.type === 'cdmg') && ev.dp && S.c27reb && S.c27reb.length){ const T = turnStr();
        for (const e of S.c27reb){ if (e.t !== T || e.by !== ev.dp || !e.ids.includes(ev.id)) continue; const c = S.bf.find(b => b.id === ev.id); if (!c) continue;
          pushTrig(cname(c), 'Sacrifice this permanent. You lose 2 life.', {k:c.k, srcId:c.id, c27reb:e.src || 'Hellish Rebuke'}); break; } }
    } } catch (e){ console.warn(e); }
    return r; };
  const ct = classifyTrig;
  classifyTrig = function(w, c){ if (w === 'whenever' && /^a player loses the game$/.test(String(c || '').trim())) return {ev:'c27lose', subj:'any', ctl:'any', desc:''}; return ct(w, c); };
  const cm = commit;
  commit = function(...a){ try { c27HpGoadSync(); } catch (e){ console.warn(e); } return cm.apply(this, a); };
  setInterval(() => { try { if (S && !UI.dry){ c27LossScan(); if (c27HpGoadSync()) commit(); } } catch {} }, 700);
  const cpe = cardPublicExtra;
  cardPublicExtra = function(c){ const o = cpe(c); if (c && c.c27hp) o.c27hp = {pid:c.c27hp.pid, id:c.c27hp.id}; return o; };
  const ss = sanitizeState;
  sanitizeState = function(s){ const r = ss(s); try { if (r && s && Array.isArray(s.bf)) r.bf.forEach((c, i) => { const o = s.bf[i]; if (o && o.c27hp && typeof o.c27hp === 'object' && typeof o.c27hp.pid === 'string' && Number.isFinite(o.c27hp.id)) c.c27hp = {pid:o.c27hp.pid.slice(0, 40), id:o.c27hp.id}; }); } catch {} return r; };
}

/* ---------- extra casting costs: forage, removing three counters from among your creatures ---------- */
function c27CtrUnits(){ const out = []; for (const c of S.bf){ if (c.fd || !isCreatureCard(c)) continue; if (c.cp) out.push({c, kind:'cp', n:c.cp, nm:'+1/+1'}); if (c.cm) out.push({c, kind:'cm', n:c.cm, nm:'-1/-1'}); if (c.co) out.push({c, kind:'co', n:c.co, nm:'loyalty'}); for (const [k, v] of Object.entries(c.nc || {})) if (v > 0) out.push({c, kind:'nc', nc:k, n:v, nm:k}); } return out; }
function c27Foods(){ return S.bf.filter(b => !b.fd && descOk(b.k, 'food', {tok:b.tok})); }
{
  const ef = extraFeasible;
  extraFeasible = function(x, c){
    if (x && x.t === 'c27forage') return (S.gy.filter(g => !c || g.id !== c.id).length >= 3 || c27Foods().length) ? '' : 'forage: you need three other cards in your graveyard or a Food';
    if (x && x.t === 'c27ctr3') return c27CtrUnits().reduce((a, u) => a + u.n, 0) >= 3 ? '' : 'you need three counters among creatures you control';
    return ef(x, c); };
  const pe = payExtras;
  payExtras = async function(list, c){
    for (const x of (list || [])){
      if (x.t === 'c27forage'){
        const gy = S.gy.filter(g => g.id !== c.id); const food = c27Foods(); if (gy.length < 3 && !food.length){ toast('Forage: you need three other cards in your graveyard or a Food'); return false; }
        const how = gy.length >= 3 && food.length ? await askChoice({title:'Forage', options:[{label:'Exile three cards from your graveyard', value:'gy'}, {label:'Sacrifice a Food', value:'food'}]}) : gy.length >= 3 ? 'gy' : 'food'; if (!how) return false;
        if (how === 'food'){ const ids = food.length === 1 ? [food[0].id] : await pickCards({title:'Forage: sacrifice a Food', cards:food, min:1, max:1}); const f = ids && S.bf.find(b => b.id === ids[0]); if (!f) return false; sacrificeOne(f); log('foraged: sacrificed a Food'); continue; }
        const ids = gy.length === 3 ? gy.map(g => g.id) : await pickCards({title:'Forage: exile three other cards from your graveyard', cards:gy, min:3, max:3}); if (!ids || ids.length < 3) return false;
        ids.forEach(id => moveCard(id, 'ex', {quiet:true})); log('foraged: exiled three cards from their graveyard'); continue; }
      if (x.t === 'c27ctr3'){
        let left = 3; const tot = c27CtrUnits().reduce((a, u) => a + u.n, 0); if (tot < 3){ toast('You need three counters among creatures you control'); return false; }
        while (left > 0){ const us = c27CtrUnits(); let u = us[0];
          if (us.length > 1 && !(us.length === 1)){ const v = await askChoice({title:`Remove a counter (${4 - left} of 3)`, options:us.map((u, i) => ({label:`${cname(u.c)}: ${u.nm} (${u.n})`, value:String(i)}))}); if (v == null) return false; u = us[+v]; }
          if (!u) return false;
          if (u.kind === 'nc') addNamed(u.c, u.nc, -1); else u.c[u.kind] = Math.max(0, (u.c[u.kind] || 0) - 1);
          log(`removed a ${u.nm} counter from ${cname(u.c)}`); left--; }
        continue; }
      if (!(await pe([x], c))) return false;
    }
    return true; };
}

/* ---------- Osteomancer Adept: creature spells from the graveyard by foraging, finality counter ---------- */
{
  const go = gyOptions;
  gyOptions = function(c){ const out = go(c);
    try { const a = info(c.k); if (S && a && S.c27osteo === turnStr() && /\bCreature\b/.test(a.t || '') && !isLand(c.k) && S.gy.includes(c)) out.push({kind:'c27osteo', label:`Cast by foraging (Osteomancer Adept) ${a.m}`, mana:a.m, extra:[{t:'c27forage', label:'forage'}], after:'', c27fin:true}); } catch {}
    return out; };
  const bc = beginCast;
  beginCast = async function(c, zone, o = {}){
    const x = c && c.k && !isLand(c.k) ? c27XanBan() : ''; if (x && !UI.dry){ toast(x); return; }
    const n0 = S ? S.stk.length : 0; const r = await bc.apply(this, arguments);
    try { if (o && o.gy && (o.gy.c27fin) && S.stk.length > n0){ const it = S.stk[S.stk.length - 1]; if (it && it.card && it.card.id === c.id){ it.c27fin = 1; } } } catch {}
    return r; };
  const rt = resolveTop;
  resolveTop = async function(it, ...a){ try { if (it && it.c27fin && it.card) it.card.c27fin = 1; } catch {} return rt(it, ...a); };
  const oe = onEnter;
  onEnter = function(c, from, o = {}){ const r = oe(c, from, o); try { if (c && c.c27fin){ delete c.c27fin; addNamed(c, 'finality', 1); log(`${cname(c)} enters with a finality counter (Osteomancer Adept)`); } } catch {} return r; };
}

/* ---------- Into the Pit: cast spells from the top of your library by sacrificing a nonland permanent ---------- */
STATIC_RULES.push([/^you may cast spells from the top of your library by sacrificing a nonland permanent in addition to paying their other costs$/, m => ({kind:'c27pit', who:'you'})]);
const C27_PIT = {t:'sac', desc:'nonland permanent', n:1, label:'sacrifice a nonland permanent'};
function c27PitWhy(c){ if (!c || isLand(c.k)) return 'not a spell'; const tm = timingOk(c); if (!tm.ok) return tm.why; const f = extraFeasible(C27_PIT, c); if (f) return f; const sc = spellCost(c, 'lib'); const p = payPlan(sc.cost, S.pool); return p.err ? 'Mana ' + p.err : ''; }
async function c27PitCast(){ const c = S.lib[0]; const r = rulesOn('c27pit')[0]; if (!c || !r) return; const why = c27PitWhy(c); if (why){ toast(why); return; }
  const a = info(c.k); await beginCast(c, 'lib', {gy:{mana:a.m, extra:[C27_PIT], label:r.src, after:''}}); commit(); }
{
  const lm = libMenu;
  libMenu = function(x, y){ lm(x, y);
    try { const c = S.lib[0]; const r = rulesOn('c27pit')[0]; if (!c || !r || isLand(c.k)) return; const menu = document.getElementById('menu'); if (!menu) return; const why = c27PitWhy(c);
      menu.insertAdjacentHTML('afterbegin', `<div class="mh">Top card: ${esc(cname(c))} (${esc(r.src)})</div>` + `<button type="button" data-act="c27pit" ${why ? 'disabled' : ''}><span>Cast ${esc(cname(c))} — sacrifice a nonland permanent + ${manaHTML(info(c.k)?.m || '')}${why ? `<small class="why">${esc(why)}</small>` : ''}</span></button><div class="sep"></div>`); } catch (e){ console.warn(e); } };
  ACT.c27pit = () => { closeMenu(); c27PitCast(); };
}

/* ---------- Dawnhand Dissident: cast creature cards exiled with it by removing three counters ---------- */
STATIC_RULES.push([/^during your turn, you may cast creature spells from among cards you own exiled with ~ by removing three counters from among creatures you control in addition to paying their other costs$/, m => ({kind:'c27dd', who:'you'})]);
function c27DdWhy(c){ if (!c || !c.c27dd) return 'no'; if (!S.bf.some(b => b.id === c.c27dd && !b.fd)) return 'the Dissident that exiled it is gone'; if (!isCreatureCard(c) || isLand(c.k)) return 'not a creature card'; if (currentTurn()[1] !== MYPID) return 'only during your turn';
  const tm = timingOk(c); if (!tm.ok) return tm.why; const f = extraFeasible({t:'c27ctr3'}, c); if (f) return f; const sc = spellCost(c, 'ex'); const p = payPlan(sc.cost, S.pool); return p.err ? 'Mana ' + p.err : ''; }
{
  const eb = r7ExButtons;
  r7ExButtons = function(c){ const fb = eb(c); try { if (c && c.c27dd && S.ex.includes(c) && isCreatureCard(c)){ const why = c27DdWhy(c); if (why === 'the Dissident that exiled it is gone') return fb; return `<button type="button" data-act="c27ddCast" data-id="${c.id}" ${why ? `disabled title="${esc(why)}"` : ''}>Cast (Dawnhand Dissident: remove three counters)${why ? ' — ' + esc(short(why, 40)) : ''}</button>` + (fb || ''); } } catch {} return fb; };
  ACT.c27ddCast = el => { const c = S.ex.find(x => x.id === +el.dataset.id); if (!c) return; const why = c27DdWhy(c); if (why){ toast(why); return; } closeModal(); const a = info(c.k);
    beginCast(c, 'ex', {gy:{mana:a.m, extra:[{t:'c27ctr3', label:'remove three counters from among creatures you control'}], label:'Dawnhand Dissident', after:''}}); };
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ const [from, , c] = find(id); const r = mc(id, to, o); try { if (c && from === 'ex' && to !== 'ex'){ delete c.c27dd; delete c.c27diary; } } catch {} return r; };
}

/* ---------- Saddle N (CR 702.171) and Calamity, Galloping Inferno ---------- */
function c27SaddlePow(c){ return S.bf.filter(x => x !== c && !x.fd && !x.tap && isCreatureCard(x)).reduce((a, x) => a + Math.max(0, (stats(x) || [0])[0]), 0); }
function c27Saddlers(c){ const T = turnStr(); return c && c.saddled === T ? (c.saddledBy || []).filter(x => x && x.t === T) : []; }
{
  const al = abilityList;
  abilityList = function(c){ const out = al(c); try { const f = c && !c.fd && faceOf(c); const m = f && tname(f.o || '', f.n).match(/^saddle (\d+)$/im); if (m && !out.some(a => a.saddle)) out.push({cost:`Saddle ${m[1]}`, eff:'~ becomes saddled until end of turn.', sorc:true, line:m[0], saddle:+m[1]}); } catch {} return out; };
  const ar = abilityReady;
  abilityReady = function(c, ab, mana){ if (ab && ab.saddle){ if (phaseNow().n === 0) return 'Start the game first'; if (!sorceryTime()) return 'Only as a sorcery'; if (c27SaddlePow(c) < ab.saddle) return `Needs other untapped creatures with total power ${ab.saddle}`; return ''; } return ar(c, ab, mana); };
  const aa = activateAbility;
  activateAbility = async function(c, ab, ...rest){
    if (!ab || !ab.saddle) return aa(c, ab, ...rest);
    const why = abilityReady(c, ab, false); if (why){ toast(why); return; }
    const list = S.bf.filter(x => x !== c && !x.fd && !x.tap && isCreatureCard(x));
    const ids = await pickCards({title:`Saddle ${ab.saddle}: tap other creatures with total power ${ab.saddle} or more`, cards:list, min:1, max:list.length}); if (!ids || !ids.length) return;
    const pw = ids.reduce((a, id) => a + Math.max(0, (stats(S.bf.find(y => y.id === id)) || [0])[0]), 0); if (pw < ab.saddle){ toast(`That's only ${pw} power — need ${ab.saddle}`); return; }
    const T = turnStr(); if (c.saddled !== T) c.saddledBy = []; c.saddled = T;
    ids.forEach(id => { const x = S.bf.find(y => y.id === id); if (x){ x.tap = true; c.saddledBy.push({id:x.id, k:x.k, t:T}); try { emit({type:'tapped', k:x.k, id:x.id}); } catch {} } });
    log(`saddled ${cname(c)} with ${ids.map(id => cname(S.bf.find(y => y.id === id))).join(', ')} (until end of turn)`); commit(); };
}
async function c27CalamityOnce(ctx){
  const src = srcCardOf(ctx); const list = []; const seen = new Set();
  for (const x of c27Saddlers(src)){ if (seen.has(x.id)) continue; seen.add(x.id); if (/\bLegendary\b/.test(info(x.k)?.t || '')) continue; list.push(x); }
  if (!src || !list.length){ log(`${ctx.name}: no nonlegendary creature saddled it this turn`); return null; }
  let pick = list[0]; if (list.length > 1){ const v = await askChoice({title:`${ctx.name}: copy which creature that saddled it?`, options:list.map(x => ({label:info(x.k)?.n || 'creature', value:String(x.id)}))}); pick = list.find(x => String(x.id) === String(v)) || list[0]; }
  const tk = g23tokCopy(pick.k, {tapped:true, atk:src.atk || ''}); S.dly.push({id:rid(6), eff:'Sacrifice it.', k:tk.k, nm:cname(tk), srcId:tk.id, op:'sac'});
  log(`${ctx.name}: the ${info(pick.k)?.n} token will be sacrificed at the beginning of the next end step`); commit(); return tk;
}

/* ---------- Gift of Doom: as it's turned face up, you may attach it to a creature ---------- */
STATIC_RULES.push([/^as ~ is turned face up, you may attach it to a creature$/, m => ({kind:'c27upAttach', who:'you'})]);
async function c27UpAttach(c){
  const f = faceOf(c); if (!f || !/as ~ is turned face up, you may attach it to a creature/i.test(tname(f.o || '', f.n))) return;
  const opts = []; for (const b of boardsAll()) for (const x of b.bf) if (x.k && !x.fd && x.id !== c.id && /\bCreature\b/.test(b.pid === MYPID ? typeOf(x) : (info(x.k)?.t || ''))) opts.push({label:`${b.pid === MYPID ? 'My' : nameOf(b.pid) + "'s"} ${info(x.k)?.n}`, value:b.pid + '|' + x.id});
  const v = opts.length ? await askChoice({title:`${f.n} is turned face up: attach it to a creature?`, options:opts.concat([{label:"Don't attach", value:'none'}])}) : 'none';
  if (v && v !== 'none'){ const i = v.lastIndexOf('|'); c.att = {pid:v.slice(0, i), id:+v.slice(i + 1)}; log(`${f.n} is turned face up attached to ${opts.find(o => o.value === v).label}`); }
  else if (/\bAura\b/.test(f.t || '') && !c.att){ log(`${f.n} is an Aura attached to nothing — it goes to the graveyard`); moveCard(c.id, 'gy', {quiet:true}); }
  commit();
}

/* ---------- morph / disguise costs that aren't mana ("Morph—Sacrifice another creature") ---------- */
{
  const tu = turnUpCost;
  turnUpCost = function(c){ const r = tu(c); if (r) return r; try { const m = (info(c.k)?.o || '').match(/^(Morph|Megamorph|Disguise)—([^\n(]+?)\.?(?:\s*\(|$)/m); if (m) return {kind:m[1].toLowerCase(), cost:'{0}', c27extra:m[2].trim(), label:m[2].trim()}; } catch {} return null; };
  const tf = turnFaceUp;
  turnFaceUp = async function(c){ const t = c && c.fd ? turnUpCost(c) : null; if (!t || !t.c27extra) return tf(c);
    if (typeof b26noUp === 'function' && b26noUp(c)){ toast("It can't be turned face up"); return; }
    if (!(await payPart(t.c27extra, c))) { commit(); return; }
    c.fd = false; delete c.fdc; if (t.kind === 'megamorph') modCounters(c, 'cp', 1);
    log(`turned ${cname(c)} face up (${t.kind} — ${t.c27extra})`); emit({type:'turnup', k:c.k, id:c.id}); commit(); };
}

/* ---------- Psychic Paper: as it becomes attached, choose a creature card name and a creature type ---------- */
STATIC_RULES.push([/^as ~ becomes attached to a creature, choose a creature card name and a creature type$/, m => ({kind:'c27paper', who:'you'})]);
C27.pp = {};
function c27CreatureNames(){ const seen = new Set(); try { for (const a of DICT.values()) if (a && a.n && !a.tok && /\bCreature\b/.test(a.t || '') && a.lay !== 'token' && !String(a.k).includes('|p27|')) seen.add(a.n); } catch {} return [...seen].sort(); }
function c27CreatureTypes(){ const seen = new Set(['Human', 'Elf', 'Goblin', 'Zombie', 'Vampire', 'Dragon', 'Angel', 'Wizard', 'Warrior', 'Knight', 'Soldier', 'Cleric', 'Rogue', 'Merfolk', 'Spirit', 'Beast', 'Elemental', 'Sliver', 'Dinosaur', 'Cat', 'Dog', 'Pirate', 'Demon', 'Horror', 'Faerie', 'Squirrel', 'Rat', 'Ninja', 'Assassin', 'Eldrazi']);
  try { for (const a of DICT.values()){ const t = String(a && a.t || ''); if (!/\bCreature\b/.test(t) || !t.includes('—')) continue; t.split('//')[0].split('—')[1].trim().split(/\s+/).forEach(w => { if (/^[A-Z][a-z'-]+$/.test(w)) seen.add(w); }); } } catch {} return [...seen].sort(); }
async function c27PaperChoose(s){
  const key = s.att.pid + ':' + s.att.id; if (s.c27pp && s.c27pp.key === key) return; s.c27pp = {key, nm:'', ty:'', h:''};
  const names = c27CreatureNames(); const nm = names.length ? await askChoice({title:`${cname(s)}: choose a creature card name`, options:names.map(n => ({label:n, value:n}))}) : null;
  const tys = c27CreatureTypes(); const ty = await askChoice({title:`${cname(s)}: choose a creature type`, options:tys.map(n => ({label:n, value:n}))});
  if (!S.bf.includes(s) || !s.att || s.att.pid + ':' + s.att.id !== key) return;
  const h = rid(6); C27.pp[h] = {nm:nm || '', ty:ty || ''}; s.c27pp = {key, nm:nm || '', ty:ty || '', h};
  log(`${cname(s)}: the equipped creature's name is ${nm || '(unchanged)'} and its creature type is ${ty || '(unchanged)'}`); commit();
}
function c27PaperSync(){
  if (!S || UI.dry) return;
  for (const s of S.bf){ if (!s.k || s.fd || !s.att) continue; if (!/as ~ becomes attached to a creature, choose a creature card name and a creature type/i.test(tname(info(s.k)?.o || '', info(s.k)?.n))) continue; const key = s.att.pid + ':' + s.att.id; if (!s.c27pp || s.c27pp.key !== key) c27PaperChoose(s); }
  for (const c of S.bf){ if (!c.k || c.fd) continue;
    const p = S.bf.find(s => s.att && s.att.pid === MYPID && s.att.id === c.id && s.c27pp && s.c27pp.h && s.c27pp.key === MYPID + ':' + c.id && !s.fd);
    const base = c.c27ppOrig || c.k;
    if (p){ const want = base + '|p27|' + p.c27pp.h; if (c.k !== want && info(want)){ c.c27ppOrig = base; c.k = want; } }
    else if (c.c27ppOrig){ c.k = c.c27ppOrig; delete c.c27ppOrig; } }
}
{
  const df = deriveFace;
  deriveFace = function(k){ if (typeof k === 'string' && k.includes('|p27|')){ const i = k.lastIndexOf('|p27|'); const base = info(k.slice(0, i)); const pp = C27.pp[k.slice(i + 5)]; if (!base || !pp) return null;
      const t0 = String(base.t || ''); const t = pp.ty && /\bCreature\b/.test(t0) ? t0.split('—')[0].trim() + ' — ' + pp.ty : t0; const nm = pp.nm || base.n;
      const e = {...base, k, n:nm, full:nm, t, o:String(base.o || '').split(base.n).join(nm), back:null, faces:null}; DICT.set(k, e); return e; }
    return df(k); };
  const cm = commit;
  commit = function(...a){ try { c27PaperSync(); } catch (e){ console.warn(e); } return cm.apply(this, a); };
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ try { const [from, , c] = find(id); if (c && from === 'bf' && to !== 'bf' && c.c27ppOrig){ c.k = c.c27ppOrig; delete c.c27ppOrig; } } catch {} return mc(id, to, o); };
  const ps = publicState;
  publicState = function(){ const o = ps(); try { const m = {}; S.bf.forEach(s => { if (s.c27pp && s.c27pp.h) m[s.c27pp.h] = {nm:s.c27pp.nm, ty:s.c27pp.ty}; }); if (Object.keys(m).length) o.c27ppMap = m; } catch {} return o; };
  const ss = sanitizeState;
  sanitizeState = function(st){ const r = ss(st); try { if (r && st && st.c27ppMap && typeof st.c27ppMap === 'object'){ const m = {}; for (const [h, v] of Object.entries(st.c27ppMap).slice(0, 10)){ if (!/^[a-z0-9]{1,8}$/i.test(h) || !v) continue; m[h] = {nm:String(v.nm || '').slice(0, 60), ty:String(v.ty || '').slice(0, 30)}; C27.pp[h] = m[h]; } r.c27ppMap = m; } } catch {} return r; };
  const em = emit;
  emit = function(ev){ const r = em(ev); try { if (S && ev && ev.type === 'turnup' && !UI.dry){ const c = S.bf.find(b => b.id === ev.id); if (c) c27UpAttach(c); } } catch (e){ console.warn(e); } return r; };
}

/* ---------- River Song's Diary: imprint instants and sorceries cast from hand ---------- */
function c27Diaries(){ const out = []; for (const b of boardsAll()) for (const c of b.bf) if (c.k && !c.fd && /^imprint — whenever a player casts an instant or sorcery spell from their hand, exile it instead of putting it into a graveyard as it resolves/im.test(info(c.k)?.o || '')) out.push({pid:b.pid, c}); return out; }
function c27DiaryCards(pid, id){ const out = []; for (const c of S.ex) if (c.c27diary && c.c27diary.pid === pid && c.c27diary.id === id) out.push({pid:MYPID, k:c.k, cid:c.id});
  for (const [opid, st] of OPP) for (const e of (st.c27dEx || [])) if (e.p === pid && e.d === id) out.push({pid:opid, k:e.k}); return out; }
{
  const rt = resolveTop;
  resolveTop = async function(it, ...a){
    let card = null, dia = null;
    try { if (it && it.kind === 'spell' && !it.copy && it.card && it.from === 'hand' && /\b(Instant|Sorcery)\b/.test(info(it.card.k)?.t || '')){ const ds = c27Diaries(); if (ds.length){ dia = ds[0]; card = it.card; it.exAfter = true; } } } catch {}
    const r = await rt(it, ...a);
    try { if (card && S.ex.includes(card)){ card.c27diary = {pid:dia.pid, id:dia.c.id}; log(`${cname(card)} was exiled with ${info(dia.c.k)?.n} (imprint)`); commit(); } } catch {}
    return r; };
  const ps = publicState;
  publicState = function(){ const o = ps(); try { const l = S.ex.filter(c => c.c27diary).slice(-40).map(c => ({k:c.k, p:c.c27diary.pid, d:c.c27diary.id})); if (l.length) o.c27dEx = l; } catch {} return o; };
  const ss = sanitizeState;
  sanitizeState = function(st){ const r = ss(st); try { if (r && st && Array.isArray(st.c27dEx)) r.c27dEx = st.c27dEx.slice(-40).filter(e => e && typeof e.k === 'string' && typeof e.p === 'string' && Number.isFinite(e.d)).map(e => ({k:e.k.slice(0, 80), p:e.p.slice(0, 40), d:e.d})); } catch {} return r; };
}

/* ---------- Xanathar, Guild Kingpin ---------- */
function c27XanOn(){ if (!S) return null; const T = turnStr(); for (const [pid, st] of OPP){ const x = st && st.c27xan; if (x && x.t === T && x.pid === MYPID) return {by:pid, src:x.src}; } return null; }
function c27XanBan(){ const x = c27XanOn(); return x ? `${x.src || 'Xanathar'}: you can't cast spells this turn` : ''; }
{
  const cc = castCheck;
  castCheck = function(c, zone){ const w = c27XanBan(); if (w && c && !isLand(c.k)) return {ok:false, why:w}; return cc(c, zone); };
  const ps = publicState;
  publicState = function(){ const o = ps(); try { const T = turnStr(); if (S.c27xan && S.c27xan.t === T) o.c27xan = S.c27xan; const x = c27XanOn(); if (x && S.lib[0]) o.c27xtop = {t:T, k:S.lib[0].k, to:x.by}; } catch {} return o; };
  const ss = sanitizeState;
  sanitizeState = function(st){ const r = ss(st); try { if (r && st){ if (st.c27xan && typeof st.c27xan === 'object') r.c27xan = {t:String(st.c27xan.t || '').slice(0, 20), pid:String(st.c27xan.pid || '').slice(0, 40), src:String(st.c27xan.src || '').slice(0, 40)};
    if (st.c27xtop && typeof st.c27xtop === 'object') r.c27xtop = {t:String(st.c27xtop.t || '').slice(0, 20), k:String(st.c27xtop.k || '').slice(0, 80), to:String(st.c27xtop.to || '').slice(0, 40)}; } } catch {} return r; };
  const ch = r7Chips;
  r7Chips = function(){ let h = ch();
    try { const x = S && S.c27xan; if (x && x.t === turnStr()){ const st = OPP.get(x.pid); const top = st && st.c27xtop; if (top && top.t === x.t && top.to === MYPID && top.k){ const nm = info(top.k)?.n || 'a card';
      h += `<button type="button" class="chip3" data-act="c27xanPlay" title="${esc(x.src)}: you may look at and play the top card of ${esc(nameOf(x.pid))}'s library this turn">${esc(nameOf(x.pid))}'s top card: <b>${esc(nm)}</b> — ${isLand(top.k) ? 'play it' : 'cast it'}</button>`; } } } catch {}
    return h; };
  ACT.c27xanPlay = () => { c27XanPlay(); };
}
async function c27XanPlay(){
  const x = S.c27xan; if (!x || x.t !== turnStr()){ toast('Xanathar’s effect has ended'); return; } const st = OPP.get(x.pid); const top = st && st.c27xtop; if (!top || !top.k){ toast('Their library is empty'); return; }
  if (UI.casting) return;
  const land = isLand(top.k); if (land){ const ok = canPlayLand({k:top.k, id:-1}); if (ok && !ok.ok){ toast(ok.why || "You can't play a land now"); return; } }
  const r = await r21Ask(x.pid, 'c27xanTake', 0, x.src, {d:(top.k + '|' + (land ? 'pae' : 'cae')).slice(0, 80)});
  const c = (r.ids || []).map(id => S.ex.find(e => e.id === id)).find(Boolean); if (!c){ toast(`${nameOf(x.pid)}'s top card changed — try again`); return; }
  if (land) playLand(c, {}); else await beginCast(c, 'ex', {});
  if (S.ex.includes(c)){ S.ex.splice(S.ex.indexOf(c), 1); sendRq(c.own.pid, 'c27xanBack', 0, x.src, {ref:c.own.ref}); log(`didn't play ${cname(c)} — it stays on top of ${nameOf(x.pid)}'s library`); }
  commit();
}
RQ_OPS.push('c27xanTake', 'c27xanBack', 'c27lendEx');
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'c27xanTake'){ const [k, w] = String(r.d || '').split('|'); const c = S.lib[0]; let n = 0;
      if (c && c.k === k){ S.lib.shift(); S.ex.push(c); r21Lend(c, from, r.ref, w || 'cae', r.src); n = 1; log(`${nameOf(from)} plays the top card of my library: ${cname(c)} (${r.src})`); }
      r21Ack(from, r.ref, n, r.src); commit(); return; }
    if (r.op === 'c27xanBack'){ const i = S.lent.findIndex(l => l.ref === r.ref); r21Unlist(r.ref); if (i >= 0){ const [l] = S.lent.splice(i, 1); const j = S.ex.indexOf(l.card); if (j >= 0){ S.ex.splice(j, 1); S.lib.unshift(l.card); log(`${cname(l.card)} goes back on top of my library`); } } commit(); return; }
    if (r.op === 'c27lendEx'){ const [k, d] = String(r.d || '').split('|'); const c = S.ex.find(e => e.k === k && e.c27diary && e.c27diary.pid === from && e.c27diary.id === +d && !S.lent.some(l => l.card === e)); let n = 0;
      if (c){ r21Lend(c, from, r.ref, 'r', r.src); n = 1; log(`${nameOf(from)} may cast my ${cname(c)} from exile (${r.src})`); } r21Ack(from, r.ref, n, r.src); commit(); return; }
    return ao(r, from);
  };
}

/* ---------- Effects ---------- */
async function doRound27CPre(s, l, ctx){
  let m; const name = ctx.name; const it = ctx.it || {};
  // Oft-Nabbed Goat
  if (/^gain control of ~ and put a -1\/-1 counter on it$/.test(l) && /only your opponents may activate this ability/i.test(info(ctx.k)?.o || '')){
    const o = it.c27opp; if (!o || UI.dry) return true;
    if (o.pid === MYPID) return true;
    sendRq(o.pid, 'steal', 0, name, {tid:o.id, f:{c27cm:true}}); log(`${name}: gains control of it and puts a -1/-1 counter on it`); commit(); return true; }
  if (C27_OPPAB.test(l)) return true;   // enforced by abilityReady (controller) and the opponents' activation button
  // Crypt Rats: enforced when the ability is activated (X is paid only with black mana)
  if (/^spend only black mana on x$/.test(l)) return true;
  // Ramses, Assassin Lord
  if (/^if they were attacked this turn by an assassin you controlled, you win the game$/.test(l)){
    if (UI.dry) return true; const pid = it.c27lostPid; const a = S.c27atk;
    if (!pid || !(a && a.t === turnStr() && a.by.includes(pid))){ log(`${name}: that player wasn't attacked by my Assassin this turn`); return true; }
    log(`🏆 ${name}: ${nameOf(pid)} lost the game after an Assassin attacked them — wins the game!`); toast(`${name}: you win the game!`);
    for (const p of opponents()){ const st = OPP.get(p.pid); if (st && st.c27lost) continue; sendRq(p.pid, 'g23lose', 0, name); }
    commit(); return true; }
  // Hot Pursuit
  if (/^suspect target creature an opponent controls$/.test(l)){ const t = c27Tg(ctx)[0]; ctx.c27sus = null; if (!t || t.t !== 'card') return true;
    if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c){ c.jSus = 1; if (typeof jAddKw === 'function') jAddKw(c, ['menace']); } }
    else sendRq(t.pid, 'r26b', 0, name, {tid:t.id, d:'sus|'});
    ctx.c27sus = {pid:t.pid, id:t.id}; log(`${name}: ${t.nm || 'that creature'} is suspected`); commit(); return true; }
  if (/^as long as ~ remains on the battlefield, that creature is also goaded$/.test(l)){ const src = srcCardOf(ctx); if (src && ctx.c27sus && S.bf.includes(src)){ src.c27hp = ctx.c27sus; log(`${name}: ${ctx.c27sus.pid === MYPID ? 'it' : nameOf(ctx.c27sus.pid) + "'s creature"} is goaded while ${name} remains`); } commit(); return true; }
  if (/^if two or more players have lost the game, gain control of all goaded and\/or suspected creatures until end of turn$/.test(l)){
    ctx.c27hpRun = false; const n = c27LostCount(); if (n < 2){ if (!UI.dry) log(`${name}: only ${n} player${n === 1 ? ' has' : 's have'} lost the game`); return true; }
    ctx.c27hpRun = true; for (const p of opponents()) sendRq(p.pid, 'c27hpSteal', 0, name);
    S.bf.filter(c => c.k && !c.fd && isCreatureCard(c) && (goadOn(c) || c.jSus)).forEach(c => { c.tap = false; c.tn = 0; c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; c.eotHaste = 1; });
    log(`${name}: gaining control of all goaded and/or suspected creatures until end of turn`); commit(); return true; }
  if ((/^untap them$/.test(l) || /^they gain haste until end of turn$/.test(l)) && ctx.c27hpRun != null) return true;   // done with the gain of control above (stolen creatures arrive untapped with haste)
  // Hellish Rebuke
  if (/^until end of turn, permanents your opponents control gain "when ~ deals damage to the player who cast ~, sacrifice ~[.․]? ?(?:you lose 2 life[.․]?)?"?$/.test(l)){
    if (!UI.dry) for (const p of opponents()) sendRq(p.pid, 'c27reb', 0, name);
    log(`${name}: until end of turn, each opponent's permanents are sacrificed (and their controller loses 2 life) when they deal damage to me`); commit(); return true; }
  if ((/^sacrifice ~$/.test(l) || /^sacrifice this permanent$/.test(l)) && it.c27reb){ const c = srcCardOf(ctx); if (c && S.bf.includes(c)){ log(`${cname(c)} dealt damage to the caster of ${it.c27reb} — sacrificed`); sacrificeOne(c); } commit(); return true; }
  if (/^you lose 2 life$/.test(l) && it.c27reb){ S.life -= 2; log(`lost 2 life (${it.c27reb}) → ${S.life}`); commit(); return true; }
  // Grothama
  if (/^(?:you may )?have it fight (?:~|grothama, all-devouring)$/.test(l)){
    const g = it.c27gro; if (UI.dry || !g) return true;
    const a = srcCardOf(ctx); if (!a || !S.bf.includes(a)) return true;
    const gc = boardOf(g.pid).find(x => x.id === g.id); if (!gc){ log(`${name}: Grothama is gone`); return true; }
    if (/^you may/.test(l) && !(await askYes(`${cname(a)} attacks: have it fight ${info(g.k)?.n}?`, 'Fight', 'No'))) return true;
    const ap = Math.max(0, (stats(a) || [0])[0]); const gp = Math.max(0, ((g.pid === MYPID ? stats(gc) : stats(gc, g.pid)) || [0])[0]);
    log(`${cname(a)} fights ${info(g.k)?.n} (${ap} and ${gp} damage)`);
    if (ap) dealDamage({t:'card', pid:g.pid, id:g.id, k:g.k}, ap, a.k, a);
    if (gp){ if (g.pid === MYPID) dealDamage({t:'card', pid:MYPID, id:a.id, k:a.k}, gp, gc.k, gc); else applyOp({op:'dmg', tid:a.id, n:gp, src:info(g.k)?.n, f:{}}, g.pid); }
    commit(); return true; }
  if (/^each player draws cards equal to the amount of damage dealt to ~ this turn by sources they controlled$/.test(l)){
    if (UI.dry) return true; const id = ctx.srcId != null ? ctx.srcId : it.evId; const e = (S.c27gd || {})[id]; const by = e && e.t === turnStr() ? e.by : {};
    for (const p of players()){ const n = by[p.pid] || 0; if (!n) continue; if (p.pid === MYPID) draw(n); else sendRq(p.pid, 'draw', n, name); log(`${name}: ${p.pid === MYPID ? 'I draw' : nameOf(p.pid) + ' draws'} ${n}`); }
    if (!Object.values(by).some(Boolean)) log(`${name}: no damage was dealt to it this turn`); commit(); return true; }
  // Cruelclaw's Heist
  if (/^exile that card$/.test(l) && ctx.revealed && /^gift a card$/im.test(info(ctx.k)?.o || '')){
    ctx.c27heist = true; const k = ctx.chosenK; const pid = ctx.revealed.pid; if (!k || UI.dry){ if (!k && !UI.dry) log(`${name}: no nonland card to exile`); return true; }   // v23: nothing chosen → nothing to cast later either
    const gift = !!(ctx.gift || it.gift);
    if (pid === MYPID){ const h = S.hand.find(x => x.k === k); if (h){ moveCard(h.id, 'ex'); if (gift){ const e = S.ex.find(x => x.id === h.id); if (e) e.mayPlay = {t:turnStr(), adv:true, cast:true, any:true, src:name}; } } commit(); return true; }
    const r = await r21Ask(pid, 'c27exHand', 0, name, {d:(k + '|' + (gift ? 'cal' : '')).slice(0, 80)});
    log(`${name}: exiled ${nameOf(pid)}'s ${info(k)?.n}${gift ? ' — I may cast it for as long as it remains exiled, with mana of any type' : ''}`);
    if (pid !== MYPID) sendRq(pid, 'unreveal', 0, name); commit(); return true; }
  if (/^if the gift was promised, you may cast that card for as long as it remains exiled, and mana of any type can be spent to cast it$/.test(l) && (ctx.c27heist || UI.dry)) return true;   // granted while exiling it
  // Osteomancer Adept
  if (/^until end of turn, you may cast creature spells from your graveyard by foraging in addition to paying their other costs$/.test(l)){ S.c27osteo = turnStr(); log(`${name}: until end of turn, creature cards in the graveyard may be cast by foraging (they enter with a finality counter)`); commit(); return true; }
  if (/^if you cast a spell this way, that creature enters with a finality counter on it$/.test(l) && S.c27osteo === turnStr()) return true;   // the graveyard cast option marks the spell; it enters with the counter
  if (/^if you cast a spell this way, that creature enters with a finality counter on it$/.test(l) && UI.dry) return true;
  // Dawnhand Dissident
  if (/^exile target card from a graveyard$/.test(l) && /exiled with ~ by removing three counters/i.test(tname(info(ctx.k)?.o || '', info(ctx.k)?.n || ''))){
    const t = c27Tg(ctx)[0]; if (!t) return true;
    if (t.pid === MYPID || !t.pid){ const c = S.gy.find(g => g.id === t.id); if (c){ moveCard(c.id, 'ex'); const e = S.ex.find(x => x.id === c.id); if (e && ctx.srcId != null) e.c27dd = ctx.srcId; log(`${name}: exiled ${cname(c)} from my graveyard`); } }
    else { sendRq(t.pid, 'g23gyEx', 0, name, {d:t.k}); log(`${name}: exiled ${nameOf(t.pid)}'s ${info(t.k)?.n || 'card'} from their graveyard`); }
    commit(); return true; }
  // Calamity
  if (/^choose a nonlegendary creature that saddled it this turn and create a tapped and attacking token that's a copy of it$/.test(l)){ ctx.c27cal = true; if (UI.dry) return true; ctx.c27calTok = await c27CalamityOnce(ctx); return true; }
  if (/^sacrifice that token at the beginning of the next end step$/.test(l) && ctx.c27cal) return true;   // scheduled with the token
  if (/^repeat this process once$/.test(l) && ctx.c27cal){ if (!UI.dry) await c27CalamityOnce(ctx); return true; }
  // River Song's Diary
  if (/^exile it instead of putting it into a graveyard as it resolves$/.test(l) && /^imprint — whenever a player casts an instant or sorcery spell from their hand/im.test(info(ctx.k)?.o || '')) return true;   // a replacement on the caster's client (resolveTop)
  if (/^if there are four or more cards exiled with ~, choose one of them at random$/.test(l)){ ctx.c27dpick = null; if (UI.dry){ ctx.c27dpick = {dry:1}; return true; }
    const list = c27DiaryCards(MYPID, ctx.srcId); if (list.length < 4){ log(`${name}: only ${list.length} card${list.length === 1 ? '' : 's'} exiled with it`); return true; }
    ctx.c27dpick = list[Math.floor(Math.random() * list.length)]; log(`${name}: chose ${info(ctx.c27dpick.k)?.n} at random (${ctx.c27dpick.pid === MYPID ? 'my card' : nameOf(ctx.c27dpick.pid) + "'s card"})`); return true; }
  if (/^(?:you may )?cast it without paying its mana cost$/.test(l) && ctx.c27dpick !== undefined){ const p = ctx.c27dpick; if (!p || p.dry) return true;
    if (p.pid === MYPID){ const c = S.ex.find(x => x.id === p.cid); if (c && await askYes(`${name}: cast ${cname(c)} without paying its mana cost?`, 'Cast it', 'No')){ UI.afterCast = () => {}; await beginCast(c, 'ex', {free:true}); } return true; }
    const r = await r21Ask(p.pid, 'c27lendEx', 0, name, {d:`${p.k}|${ctx.srcId}`}); if (!r.ids.length){ log(`${name}: ${nameOf(p.pid)}'s card is no longer exiled`); return true; }
    await r21CastNow({...ctx, r21ids:r.ids}, {free:true}); return true; }
  // Xanathar
  if ((m = l.match(/^until end of turn, (target|that) player can't cast spells, you may look at the top card of their library any time, you may play the top card of their library, and you may spend mana as though it were mana of any color to cast spells this way$/))){
    const t = (m[1] === 'target' ? c27Tg(ctx)[0] : null) || (ctx.lastT || []).find(x => x && x.pid) || (ctx.tgts || []).flat().find(x => x && x.pid); if (!t || !t.pid || t.pid === MYPID || UI.dry) return true;
    S.c27xan = {t:turnStr(), pid:t.pid, src:name}; log(`${name}: until end of turn ${nameOf(t.pid)} can't cast spells, and I may look at and play the top card of their library (mana as any color)`); commit(); return true; }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound27CPre(s, l, ctx)) return; return ds(s0, ctx); };
}
