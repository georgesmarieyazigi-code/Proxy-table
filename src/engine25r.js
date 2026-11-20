/* ===================== Rules engine — round 25 helper R: doublers and ability sharing =====================
   1. Ability sharing (CR 613.1f, layer 6): "has all activated abilities of …" — Necrotic Ooze, Marvin, Drana and Linvala,
      Conspicuous Snoop, Experiment Kraj, Agatha's Soul Cauldron, Hazel's Brewmaster; "has all loyalty abilities of …" (Nicol Bolas, Dragon-God).
      The shared abilities are added to abilityList / manaAbs (and loyaltyAbs) of the holder; a holder or source that lost
      all its abilities in the layer pass (engine24o) shares nothing.
   2. Trigger doublers keyed on the source or on the event: Katara, Twinflame Travelers, Wizard's Staff, Krang, Wulfgar,
      Felix Five-Boots, Windcrag Siege (chosen-mode static abilities apply); step triggers and granted triggers are doubled too.
   3. Mana: Extraplanar Lens (imprint a land), Roxanne; Tyvar's granted "whenever a mana ability of this creature resolves".
   4. Energy (Aether Refinery, Izzet Generatorium), Sword of Hours. */
const R25 = { busy:0, abObj:new Map() };
EV_TYPES.push('r25manaRes');
function r25text(c){ const f = c && faceOf(c); return f ? tname(f.o, f.n) : ''; }
function r25lines(c){ return r25text(c).split('\n').map(x => x.trim().replace(/\.$/, '')).filter(Boolean); }

/* ---------- 1. ability sharing ---------- */
// one holder spec per line: {self:true | holder:'ctr'|'food', pool, desc, notName, anyCol}
function r25shareSpec(line){
  const l = String(line).toLowerCase().replace(/\.$/, ''); let m;
  if (/^(?:as long as ~ is on the battlefield, )?(?:~|it) has all activated abilities of all creature cards in all graveyards$/.test(l)) return {self:true, pool:'gyAll', desc:'creature'};
  if (/^~ has all activated abilities of (?:all )?creatures you control that don't have the same name as ~$/.test(l)) return {self:true, pool:'myCre', notName:true};
  if (/^~ has all activated abilities of all creatures your opponents control(?:\. you may spend mana as though it were mana of any colou?r to activate those abilities)?$/.test(l)) return {self:true, pool:'oppCre', anyCol:/any colou?r/.test(l)};
  if ((m = l.match(/^as long as the top card of your library is an? ([a-z]+) card, ~ has all activated abilities of that card$/))) return {self:true, pool:'top', desc:m[1]};
  if (/^~ has all activated abilities of each other creature with a \+1\/\+1 counter on it$/.test(l)) return {self:true, pool:'ctrCre'};
  if ((m = l.match(/^(creatures you control with \+1\/\+1 counters on them|foods you control) have all activated abilities of all creature cards exiled with ~$/))) return {holder:/^foods/.test(m[1]) ? 'food' : 'ctr', pool:'exw', desc:'creature'};
  return null;
}
STATIC_RULES.push(
  [/^(?:(?:as long as ~ is on the battlefield, )?(?:~|it) has all activated abilities of all creature cards in all graveyards|~ has all activated abilities of (?:all )?creatures you control that don't have the same name as ~|~ has all activated abilities of all creatures your opponents control|you may spend mana as though it were mana of any colou?r to activate those abilities|as long as the top card of your library is an? [a-z]+ card, ~ has all activated abilities of that card|~ has all activated abilities of each other creature with a \+1\/\+1 counter on it|(?:creatures you control with \+1\/\+1 counters on them|foods you control) have all activated abilities of all creature cards exiled with ~)$/, m => ({kind:'r25share', who:'you'})],
  [/^~ has all loyalty abilities of all other planeswalkers on the battlefield$/, m => ({kind:'r25loyal', who:'you'})],
);
function r25specsOf(c){ if (!c || !c.k || c.fd) return []; const out = []; for (const line of r25lines(c)){ const sp = r25shareSpec(line); if (sp) out.push(sp); } return out; }
const r25fake = (k, pid) => ({k, id:-1, r25fake:1, r25pid:pid});
// the cards whose activated abilities this holder gains: [{c (real or fake card), pid}]
function r25sources(h){
  if (!S || !h || !S.bf.includes(h) || h.fd) return [];
  if (l24noAbCard(h, MYPID)) return [];
  const out = []; const add = (c, pid) => out.push({c, pid});
  const pools = [];
  for (const sp of r25specsOf(h)) if (sp.self) pools.push({sp, src:h});
  for (const s of S.bf){ if (s === h || s.fd) continue; for (const sp of r25specsOf(s)){ if (sp.self) continue;
    if (sp.holder === 'ctr' && !(isCreatureCard(h) && (h.cp || 0) > 0)) continue;
    if (sp.holder === 'food' && !descOk(h.k, 'food', {tok:h.tok, card:h})) continue;
    if (l24noAbCard(s, MYPID)) continue; pools.push({sp, src:s}); } }
  for (const x of (h.r25gain || [])) if (x.t === turnStr()) add(r25fake(x.k, MYPID), MYPID);
  for (const {sp, src} of pools){
    if (sp.pool === 'gyAll'){ S.gy.forEach(g => { if (/\bCreature\b/.test(info(g.k)?.t || '')) add(r25fake(g.k, MYPID), MYPID); });
      for (const [pid, o] of OPP) (o.gy || []).forEach(k => { const kk = typeof k === 'string' ? k : k && k.k; if (kk && /\bCreature\b/.test(info(kk)?.t || '')) add(r25fake(kk, pid), pid); }); }
    else if (sp.pool === 'myCre'){ S.bf.forEach(b => { if (b !== h && !b.fd && isCreatureCard(b) && cname(b) !== cname(h)) add(b, MYPID); }); }
    else if (sp.pool === 'oppCre'){ for (const [pid, o] of OPP) (o.bf || []).forEach(b => { if (b && b.k && !b.fd && isCreatureCard(b)) add(b, pid); }); }
    else if (sp.pool === 'ctrCre'){ for (const b of boardsAll()) b.bf.forEach(x => { if (x && x.k && x !== h && !x.fd && isCreatureCard(x) && (x.cp || 0) > 0) add(x, b.pid); }); }
    else if (sp.pool === 'top'){ const t = S.lib[0]; if (t && new RegExp('\\b' + sp.desc + '\\b', 'i').test(info(t.k)?.t || '')) add(r25fake(t.k, MYPID), MYPID); }
    else if (sp.pool === 'exw'){ (src.r25exw || []).forEach(x => { if (!x || !x.k) return; if (sp.desc && !new RegExp('\\b' + sp.desc + '\\b', 'i').test(info(x.k)?.t || '')) return;
      if (x.pid === MYPID && !S.ex.some(e => e.k === x.k)) return; add(r25fake(x.k, x.pid), x.pid); }); }
  }
  return out;
}
function r25obj(h, s, ab, kind){
  const key = kind + '|' + h.id + '|' + s.c.k + '|' + (s.c.id || 0) + '|' + ab.line + '|' + ab.cost;
  let o = R25.abObj.get(key); if (!o){ o = {...ab, r25:1, r25from:info(s.c.k)?.n || '?'}; delete o.l24; R25.abObj.set(key, o); if (R25.abObj.size > 600) R25.abObj.delete(R25.abObj.keys().next().value); }
  return o;
}
function r25plain(ab){ return ab && !ab.equip && !ab.crew && !ab.station && !ab.food && !ab.minCh && !ab.r25; }
{
  const al = abilityList;
  abilityList = function(c){
    const out = al(c); if (R25.busy || !S || !c || c.r25fake || !S.bf.includes(c)) return out;
    let add = [];
    R25.busy++;
    try { for (const s of r25sources(c)){ for (const ab of al(s.c)){ if (!r25plain(ab)) continue; const o = r25obj(c, s, ab, 'a'); if (!out.includes(o) && !add.includes(o) && !out.some(x => x.line === ab.line && x.cost === ab.cost)) add.push(o); } } }
    catch (e){ console.warn('r25 share', e); } finally { R25.busy--; }
    return add.length ? out.concat(add) : out;
  };
  const ma = manaAbs;
  manaAbs = function(c){
    const out = ma(c); if (R25.busy || !S || !c || c.r25fake || !S.bf.includes(c)) return out;
    let add = [];
    R25.busy++;
    try { for (const s of r25sources(c)){ for (const ab of ma(s.c)){ if (!ab || ab.r25 || ab.esika) continue; const o = r25obj(c, s, ab, 'm'); if (!out.includes(o) && !add.includes(o) && !out.some(x => x.line === ab.line && x.cost === ab.cost)) add.push(o); } } }
    catch (e){ console.warn('r25 share mana', e); } finally { R25.busy--; }
    return add.length ? out.concat(add) : out;
  };
  // Drana and Linvala: spend mana as though it were any color to activate those abilities
  const ao = n24anyOk;
  n24anyOk = function(){ if (ao()) return true; try { const ctx = typeof R21CTX !== 'undefined' ? R21CTX : null; const c = ctx && ctx.ab;
    if (c && S.bf.includes(c) && r25specsOf(c).some(sp => sp.anyCol)) return true; } catch {} return false; };
  // Nicol Bolas, Dragon-God: all loyalty abilities of all other planeswalkers on the battlefield
  const la = loyaltyAbs;
  loyaltyAbs = function(c){
    const out = la(c); if (R25.busy || !S || !c || !S.bf.includes(c) || c.fd) return out;
    if (!r25lines(c).some(l => /^~ has all loyalty abilities of all other planeswalkers on the battlefield$/i.test(l)) || l24noAbCard(c, MYPID)) return out;
    const add = []; R25.busy++;
    try { for (const b of boardsAll()) for (const x of b.bf){ if (!x || !x.k || x === c || x.fd || !isPW(x)) continue;
      for (const ab of la(x)){ if (out.some(o => o.raw === ab.raw && o.eff === ab.eff) || add.some(o => o.raw === ab.raw && o.eff === ab.eff)) continue; add.push({...ab, r25from:cname(x)}); } } }
    catch (e){ console.warn('r25 loyalty', e); } finally { R25.busy--; }
    return add.length ? out.concat(add) : out;
  };
}
// recording the cards "exiled with ~" for Agatha's Soul Cauldron / Hazel's Brewmaster
function r25exwSrc(ctx){ const c = srcCardOf(ctx); if (!c || !S.bf.includes(c)) return null; return r25specsOf(c).some(sp => sp.pool === 'exw') ? c : null; }
async function doRound25RPre(s, l, ctx){
  let m; const name = ctx.name;
  // exile from a graveyard, remembering the card on the source
  if ((m = l.match(/^exile (target|up to one target) card from a graveyard(?:,? and create a food token)?$/)) && r25exwSrc(ctx)){
    const src = r25exwSrc(ctx); const t = (ctx.tgts ? nextTargets(ctx) : [])[0];
    if (t && t.k){ if (t.pid === MYPID || t.pid == null){ if (S.gy.some(g => g.id === t.id)) moveCard(t.id, 'ex'); } else sendRq(t.pid, 'gytake', 0, name, {d:t.k, ex:1});
      src.r25exw = (src.r25exw || []).concat({k:t.k, pid:t.pid || MYPID}).slice(-30); ctx.lastT = [t]; ctx.lastExGy = t; ctx.r25exK = t.k; log(`${name}: exiled ${info(t.k)?.n || 'a card'} — it shares its activated abilities now`); }
    if (/food/.test(l)) await createFromText('Create a Food token', ctx);
    commit(); return true;
  }
  // a named token with two quoted abilities (Roxanne's Meteorite): both abilities, not one run-on line
  if ((m = s.match(/^create (a|an|one|two|three) (tapped )?((?:colorless |snow |legendary |white |blue |black |red |green )*)(artifact |enchantment )?token named ([A-Z][\w' -]+?) with ["“]([^"”]+?)\.?["”] and ["“]([^"”]+?)\.?["”]$/i))){
    if (UI.dry) return true; const mm = m.slice(0, 6).concat(m[6] + '.\n' + m[7] + '.'); await r23kNamedToken(MYPID, mm, ctx); return true;
  }
  // Agatha's Soul Cauldron: reflexive trigger
  if ((m = l.match(/^when a creature card is exiled this way, put a \+1\/\+1 counter on target creature you control$/))){
    const k = ctx.r25exK || (ctx.lastExGy && ctx.lastExGy.k); if (!k || !/\bCreature\b/.test(info(k)?.t || '')){ if (!UI.dry) log(`${name}: no creature card was exiled`); return true; }
    if (UI.dry) return true;
    const t = (ctx.tgts ? nextTargets(ctx) : [])[0];   // chosen with the ability
    if (t){ applyTo(t, {op:'ctr', n:1, src:name, d:'cp'}); log(`${name}: a creature card was exiled — +1/+1 counter on ${t.nm || 'the target'}`); commit(); return true; }
    const it = {sid:rid(6), o:nextO(), kind:'trigger', k:ctx.k, nm:name, txt:'Put a +1/+1 counter on target creature you control.', srcId:ctx.srcId};
    S.stk.push(it); S.pass = 's:' + it.sid; log(`trigger: ${name} — a creature card was exiled: put a +1/+1 counter on target creature you control`); commit(); return true;
  }
  // Extraplanar Lens: imprint a land
  if (/^(?:you may )?exile target land you control$/.test(l) && /same name as the exiled card is tapped for mana/i.test(String(info(ctx.k)?.o || ''))){
    const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; const src = srcCardOf(ctx); if (!t) return true;
    const c = S.bf.find(b => b.id === t.id); if (!c) return true;
    if (c.tok){ moveCard(c.id, 'gy', {quiet:true}); } else moveCard(c.id, 'ex'); if (src) src.imp = c.k; log(`${name} imprinted ${cname(c)}`); commit(); return true;
  }
  // mana triggers resolved at tap time (r23fTapExtras below)
  if (/^its controller adds one mana of any type that land produced$/.test(l) && /same name as the exiled card is tapped for mana/i.test(String(info(ctx.k)?.o || ''))) return true;
  if (/^add one mana of any type that artifact token produced$/.test(l) && /whenever you tap an artifact token for mana/i.test(String(info(ctx.k)?.o || ''))) return true;
  // Tyvar's granted ability
  if (/^put a number of \+1\/\+1 counters on (?:it|~) equal to the amount of mana (?:this creature|~|it) produced$/.test(l)){
    const n = (ctx.it && ctx.it.evN) || 0; if (UI.dry) return true; const c = srcCardOf(ctx);
    if (c && S.bf.includes(c) && n > 0){ modCounters(c, 'cp', n); log(`${name}: put ${n} +1/+1 counter${n === 1 ? '' : 's'} on ${cname(c)}`); } commit(); return true;
  }
  // Sword of Hours
  if ((m = l.match(/^if the result is greater than the damage dealt or the result is 12, double the number of \+1\/\+1 counters on that creature$/))){
    const r = ctx.roll; const d = (ctx.it && ctx.it.evN) || 0; if (UI.dry) return true;
    if (r == null || !(r > d || r === 12)){ log(`${name}: rolled ${r}, not more than ${d} damage — nothing happens`); return true; }
    const sc = srcCardOf(ctx); const id = (sc && sc.att && sc.att.pid === MYPID && sc.att.id) || (ctx.it && ctx.it.evId);
    const c = S.bf.find(b => b.id === id); if (c && (c.cp || 0) > 0){ modCounters(c, 'cp', c.cp); log(`${name}: doubled the +1/+1 counters on ${cname(c)} (${c.cp})`); } commit(); return true;
  }
  // Havengul Lich: cast a creature card from any graveyard this turn; when you do, it gains that card's activated abilities until end of turn
  if (/^(?:you may )?cast target creature card in a graveyard this turn$/.test(l)){
    const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; const src = srcCardOf(ctx); if (!t || UI.dry) return true;
    if (t.pid === MYPID || !t.pid){ const c = S.gy.find(g => g.id === t.id); if (!c){ log(`${name}: that card is no longer in the graveyard`); return true; } S.gyOk = (S.gyOk || []).concat({id:c.id, t:turnStr(), ex:false}); }
    else { const res = await r21Ask(t.pid, 'r21gyLend', 0, name, {d:t.k}); (res.ids || []).forEach(id => { const c = S.ex.find(x => x.id === id); if (c) c.mayPlay = {t:turnStr(), cast:true, src:name, u0:S.untapN}; }); if (!(res.ids || []).length){ log(`${name}: couldn't get that card`); return true; } }
    if (src) src.r25lich = (src.r25lich || []).filter(x => x.t === turnStr()).concat({t:turnStr(), k:t.k});
    log(`${name}: may cast ${info(t.k)?.n || 'that card'} from the graveyard this turn`); commit(); return true;
  }
  if (/^when you cast it this turn, ~ gains all activated abilities of that card until end of turn$/.test(l.replace(new RegExp(escRe(String(name || '').toLowerCase()), 'g'), '~')) && /gains all activated abilities of that card until end of turn/i.test(String(info(ctx.k)?.o || ''))) return true;
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && ctx && await doRound25RPre(s, l, ctx)) return; return ds(s0, ctx); }; }

/* ---------- 2. trigger doublers ---------- */
STATIC_RULES.push(
  [/^if a triggered ability of (another )?an? ([a-z]+) you control triggers, (?:that ability|it) triggers an additional time$/, m => ({kind:'r25trigSub', who:'you', other:!!m[1], sub:m[2]})],
  [/^if a triggered ability of another ([a-z]+) you control triggers, (?:that ability|it) triggers an additional time$/, m => ({kind:'r25trigSub', who:'you', other:true, sub:m[1]})],
  [/^if a triggered ability of equipped creature triggers, that ability triggers an additional time$/, m => ({kind:'r25trigEq', who:'you'})],
  [/^if a player drawing a card causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time$/, m => ({kind:'r25trigEv', who:'you', ev:'draw'})],
  [/^if a creature you control attacking causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time$/, m => ({kind:'r25trigEv', who:'you', ev:'attack', mine:true, desc:'creature'})],
  [/^if a creature you control dealing combat damage to a player causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time$/, m => ({kind:'r25trigEv', who:'you', ev:'cdmg', mine:true, desc:'creature'})],
);
// static abilities of the chosen mode (Windcrag Siege: "• Mardu — If a creature attacking causes …")
{
  const sr = staticRules;
  staticRules = function(){
    const out = sr(); if (!S) return out;
    try { for (const b of boardsAll()) for (const c of b.bf){ if (!c || !c.k || c.fd || !c.g23mode) continue; const a = info(c.k); if (!a) continue;
      for (const md of g23modesOf(tname(a.o || '', a.n))){ if (md.mode !== c.g23mode || /^(when|whenever|at) /i.test(md.line)) continue;
        for (const sen of md.line.toLowerCase().replace(/\.$/, '').split(/\.\s*/)){ const s = sen.trim(); if (!s) continue; for (const [re, mk] of STATIC_RULES){ const m = s.match(re); if (m){ if (!out.some(x => x.r25mode === c.id && x.pid === b.pid)) out.push({...mk(m), src:a.n, pid:b.pid, r25mode:c.id}); break; } } } } } }
    catch (e){ console.warn('r25 modes', e); }
    return out;
  };
  const cc = checkCard;
  checkCard = async function(k){
    const r = await cc(k);
    try { const a = info(k); const ms = a ? g23modesOf(tname(a.o || '', a.n)) : []; if (ms.length && r && r.issues){
      for (const md of ms){ if (/^(when|whenever|at) /i.test(md.line) || !staticKnown(md.line)) continue; const txt = md.line.replace(/~/g, a.n);
        const i = r.issues.findIndex(x => x.kind === 'trigger' && x.text === txt); if (i >= 0) r.issues.splice(i, 1); }
      if (!r.issues.length) r.ok = Math.max(1, r.ok || 0); } } catch (e){ console.warn(e); }
    return r;
  };
}
function r25srcCard(src){ return src && src.id != null && !src.cz && !src.gone ? S.bf.find(b => b.id === src.id) : null; }
{
  const tm = trigMult;
  trigMult = function(ev, src){
    let n = tm(ev, src); if (!ev || !S) return n;
    try {
      const c = r25srcCard(src); const evPid = UI.r23evPid;
      for (const r of rulesOn('r25trigSub')){ if (!c) continue;
        if (!new RegExp('\\b' + r.sub + '\\b', 'i').test(typeOf(c)) && !(r.sub === 'creature' && isCreatureCard(c))) continue;
        if (r.other && cname(c) === r.src && !S.bf.some(b => b !== c && cname(b) === r.src && !b.fd)) continue;
        n++; }
      if (c) for (const s of S.bf){ if (s.fd || !s.att || s.att.pid !== MYPID || s.att.id !== c.id) continue; if (!/^if a triggered ability of equipped creature triggers, that ability triggers an additional time\.?$/im.test(r25text(s)) || l24noAbCard(s, MYPID)) continue; n++; }
      for (const r of rulesOn('r25trigEv')){
        if (r.ev !== ev.type || (src && src.cz)) continue;
        if (r.mine && evPid != null && evPid !== MYPID) continue;
        if (r.ev === 'cdmg' && !ev.dp) continue;
        if (r.desc && ev.k && !descOk(ev.k, r.desc, {tok:ev.tok})) continue;
        n++; }
    } catch (e){ console.warn('r25 trigMult', e); }
    return Math.min(n, 8);
  };
}
// step triggers ("at the beginning of …") and granted triggers are doubled by source-keyed doublers too
{
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    const n0 = S ? S.stk.length : 0; const r = pt(src, t, ev, evPid);
    try { if (S && !R25.push && t && S.stk.length > n0 && ((t.ev === 'step' && !ev) || t.l24g)){
      const extra = Math.min(trigMult(ev || {type:'step'}, src), 8) - 1;
      if (extra > 0){ R25.push = 1; try { for (let i = 0; i < extra; i++) pt(src, t, ev, evPid); } finally { R25.push = 0; } } } } catch (e){ console.warn('r25 push', e); }
    return r;
  };
}

/* ---------- 3. mana ---------- */
{
  const te = r23fTapExtras;
  r23fTapExtras = function(c, ab, outs, auto){
    const extra = te(c, ab, outs, auto);
    try { if (c && outs && outs.length && S && S.bf.includes(c)){
      const ty = outs[0];
      // Extraplanar Lens: any land with the imprinted land's name (its controller adds the mana)
      if (isLand(c.k)) for (const b of boardsAll()) for (const s of b.bf){ if (!s || !s.k || s.fd || !s.imp) continue;
        if (!/same name as the exiled card is tapped for mana, its controller adds one mana of any type that land produced/i.test(r25text(s))) continue;
        if (info(s.imp)?.n === info(c.k)?.n) extra.push(ty); }
      // Roxanne: artifact tokens you tap for mana
      if (c.tok && /\bArtifact\b/.test(typeOf(c))) for (const s of S.bf){ if (!s.fd && /^whenever you tap an artifact token for mana, add one mana of any type that artifact token produced\.?$/im.test(r25text(s)) && !l24noAbCard(s, MYPID)) extra.push(ty); }
    } } catch (e){ console.warn('r25 mana', e); }
    return extra;
  };
}
// Tyvar: "Whenever a mana ability of this creature resolves" — emitted after each mana ability of a creature, with the amount
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){ if (/^a mana ability of (?:this creature|~) resolves$/.test(c)) return {ev:'r25manaRes', subj:'self', ctl:'you', desc:''}; return ct(w, c); };
  const am = activateMana;
  activateMana = async function(c, ab, ch){
    const before = S ? {...S.pool} : null; const r = await am(c, ab, ch);
    try { if (S && c && before && !UI.dry && S.bf.includes(c) && isCreatureCard(c)){ let n = 0; for (const k of Object.keys(S.pool)) n += Math.max(0, (S.pool[k] || 0) - (before[k] || 0)); if (n > 0) emit({type:'r25manaRes', k:c.k, id:c.id, cnt:1, amt:n}); } } catch (e){ console.warn(e); }
    return r;
  };
  const at = autoTapNow;
  autoTapNow = function(picks){ const r = at(picks); try { if (S && !UI.dry) for (const pk of picks){ const c = S.bf.find(b => b.id === pk.c.id); if (c && isCreatureCard(c) && pk.outs && pk.outs.length) emit({type:'r25manaRes', k:c.k, id:c.id, cnt:1, amt:pk.outs.length}); } } catch (e){ console.warn(e); } return r; };
}
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){
    if (/^a land with the same name as the exiled card is tapped for mana$/.test(c) || /^you tap an artifact token for mana$/.test(c)) return {ev:'manaHandled', subj:'any', ctl:'you', desc:''};
    return ct(w, c); };
}

/* ---------- 4. energy ---------- */
STATIC_RULES.push(
  [/^if you would get one or more \{e\}, you get twice that many \{e\} instead$/, m => ({kind:'r25enX2', who:'you'})],
  [/^if you would get one or more \{e\}, you get that many plus one \{e\} instead$/, m => ({kind:'r25enP1', who:'you'})],
);
{
  const ap = addPC;
  addPC = function(kind, n){ if (S && kind === 'energy' && n > 0){ const n0 = n; for (let i = 0; i < rulesOn('r25enX2').length; i++) n *= 2; n += rulesOn('r25enP1').length; if (n !== n0) log(`energy: ${n0} → ${n} (replacement)`); } return ap(kind, n); };
}
// Conspicuous Snoop: "You may cast Goblin spells from the top of your library" (the top-of-library machinery in engine23f)
STATIC_RULES.push([/^you may cast ([a-z]+) spells from the top of your library$/, m => ({kind:'r23fTop', who:'you', spells:m[1]})]);

// Havengul Lich: casting the chosen card this turn gives the Lich its activated abilities until end of turn
{
  const nc = noteCast;
  noteCast = function(c){ const r = nc(c);
    try { if (S && c && c.k) for (const b of S.bf){ const l = (b.r25lich || []).filter(x => x.t === turnStr()); const hit = l.find(x => info(x.k)?.n === info(c.k)?.n); if (!hit) continue;
      b.r25lich = l.filter(x => x !== hit); b.r25gain = (b.r25gain || []).filter(x => x.t === turnStr()).concat({t:turnStr(), k:c.k}); log(`${cname(b)} gains all activated abilities of ${cname(c)} until end of turn`); } } catch (e){ console.warn(e); }
    return r; };
}
// engine26z exiles "exiled with ~" graveyard cards itself (linked exile, rule 607): remember them for Agatha's Soul Cauldron /
// Hazel's Brewmaster and the Cauldron's "when a creature card is exiled this way". (function declarations are hoisted, so 26z's exists here)
if (typeof zExileGyCard === 'function'){
  const zg = zExileGyCard;
  zExileGyCard = async function(pid, k, ctx, o = {}){
    const out = await zg(pid, k, ctx, o);
    try { if (ctx && k){ ctx.r25exK = k; const src = r25exwSrc(ctx); if (src && (out || []).length){ src.r25exw = (src.r25exw || []).concat({k, pid:pid || MYPID}).slice(-30); } } } catch (e){ console.warn(e); }
    return out;
  };
}
