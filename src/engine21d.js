/* ===================== Rules engine — round 21D: stax, taxes, restrictions and rule-changing statics ===================== */
// Every restriction here is checked on the restricted player's own client: rulesOn() and r21Perms() see every board.

/* ---------- helpers ---------- */
function r21Perms(){ const out = []; if (!S) return out; for (const {pid, bf} of boardsAll()) (bf || []).forEach(b => { if (b && b.k && !b.fd) out.push({b, pid}); }); return out; }
function r21Txt(b){ const a = info(b.k); if (!a) return ''; const f = b.fl && a.back ? a.back : a; return tname(f.o, f.n).toLowerCase(); }
const r21Untapped = (b, pid) => pid === MYPID ? !b.tap : !b.tp;
function r21Find(re){ const out = []; for (const x of r21Perms()){ const m = r21Txt(x.b).match(re); if (m) out.push({...x, m, nm:info(x.b.k)?.n || '?'}); } return out; }
const r21Name = c => { const a = info(c.k); if (!a) return ''; const f = c.fl && a.back ? a.back : a; return f.n || a.n; };
const r21CostTotal = cost => (cost.gen || 0) + Object.values(cost.col || {}).reduce((a, b) => a + b, 0) + (cost.hyb || []).length + (cost.two || []).length + (cost.phy || []).length;
const r21Lands = () => S.bf.filter(c => !c.fd && isLand(c.k)).length;

/* ---------- static rules (the checker counts these lines as understood only because they are enforced below) ---------- */
STATIC_RULES.push(
  [/^each player who has cast a nonartifact spell this turn can't cast additional nonartifact spells$/, m => ({kind:'castMax', who:'all', n:1, desc:'nonartifact'})],
  [/^(nonbasic lands|artifacts, creatures, and lands|creatures and lands|lands) your opponents control enter tapped$/, m => ({kind:'r21etTap', who:'opp', types:m[1]})],
  [/^(artifacts and lands|artifacts|lands|creatures|artifacts and creatures|artifacts, creatures, and lands) enter tapped$/, m => ({kind:'r21etTap', who:'all', types:m[1]})],
  [/^players can cast spells only during their own turns$/, m => ({kind:'r21ownTurn', who:'all'})],
  [/^each opponent can't cast noncreature spells with mana value greater than the number of lands that player controls$/, m => ({kind:'r21lavinia', who:'opp'})],
  [/^(each opponent|your opponents) can't cast spells with even mana values$/, m => ({kind:'r21even', who:'opp'})],
  [/^if an opponent would draw a card except the first one they draw in each of their draw steps, instead that player skips that draw and you draw a card$/, m => ({kind:'r21notion', who:'opp'})],
  [/^if an opponent would search a library, that player searches the top four cards of that library instead$/, m => ({kind:'r21censor', who:'opp'})],
  [/^you control your opponents while they're searching their libraries$/, m => ({kind:'r21agent', who:'opp'})],
  [/^while an opponent is searching their library, they exile each card they find$/, m => ({kind:'r21agent2', who:'opp'})],
  [/^you may play those cards for as long as they remain exiled, and you may spend mana as though it were mana of any color to cast them$/, m => ({kind:'r21agent3', who:'opp'})],
  [/^activated abilities of sources with the chosen name can't be activated( unless they're mana abilities)?$/, m => ({kind:'r21needle', who:'all', mana:!!m[1]})],
  [/^lands with the chosen name have "\{t\}: add \{c\}\.?"$/, m => ({kind:'r21hamlet', who:'all'})],
  [/^(creatures|artifacts and creatures|permanents) entering(?: the battlefield)?( or dying)? don't cause abilities( of permanents your opponents control)? to trigger$/, m => ({kind:'r21noEnter', who:m[3] ? 'opp' : 'all', types:m[1], die:!!m[2]})],
  [/^as long as ~ is untapped, players can't untap more than (one|two) (lands?|permanents?) during their untap steps$/, m => ({kind:'r21orb', who:'all'})],
  [/^(nonbasic lands|lands|artifacts|creatures) don't untap during their controllers' untap steps$/, m => ({kind:'noUntapAll', who:'all', scope:{'nonbasic lands':'nonbasic land', lands:'land', artifacts:'artifact', creatures:'creature'}[m[1]]})],
  [/^as long as ~ is untapped, each spell that would cost less than three mana to cast costs three mana to cast$/, m => ({kind:'r21trini', who:'all'})],
  [/^if a land is tapped for two or more mana, it produces \{c\} instead of any other type and amount$/, m => ({kind:'r21damp', who:'all'})],
  [/^each spell a player casts costs \{1\} more to cast for each other spell that player has cast this turn$/, m => ({kind:'r21dampTax', who:'all'})],
  [/^spells of the chosen type cost \{(\d+)\} more to cast$/, m => ({kind:'r21chosenTax', who:'all'})],
  [/^creatures without flying can't attack$/, m => ({kind:'r21moat', who:'all'})],
  [/^creature cards in graveyards and libraries can't enter the battlefield$/, m => ({kind:'r21cage', who:'all'})],
  [/^players can't cast spells from graveyards or libraries$/, m => ({kind:'r21cageCast', who:'all'})],
  [/^if a nontoken creature would enter and it wasn't cast, exile it instead$/, m => ({kind:'r21priest', who:'all'})],
  [/^fading (\d+)$/, m => ({kind:'r21fading', who:'you'})],
);

/* ---------- publish the chosen name / type, Knowledge Pool cards and free spells to the other players ---------- */
{
  const cpe = cardPublicExtra;
  cardPublicExtra = function(c){ const o = cpe(c); if (c && c.r21) o.r21 = String(c.r21).slice(0, 60); return o; };
  const ss = sanitizeState;
  sanitizeState = function(s){ const r = ss(s); try { if (r && s && Array.isArray(s.bf)) r.bf.forEach((c, i) => { const o = s.bf[i]; if (o && typeof o.r21 === 'string') c.r21 = o.r21.slice(0, 60); }); } catch {} return r; };
  const ep = enginePublic;
  enginePublic = function(){ const r = ep(); try { r.r21kp = S.ex.filter(c => c.r21kp).map(c => c.k).slice(0, 60); r.r21free = S.stk.filter(it => it.r21free).map(it => it.sid).slice(0, 20); r.r21hand = S.stk.filter(it => it.kind === 'spell' && it.from === 'hand' && it.card).map(it => it.card.id).slice(0, 20); } catch {} return r; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const r = se(s); try { r.r21kp = Array.isArray(s.r21kp) ? s.r21kp.slice(0, 60).filter(k => typeof k === 'string').map(k => k.slice(0, 80)) : []; r.r21free = Array.isArray(s.r21free) ? s.r21free.slice(0, 20).filter(x => typeof x === 'string').map(x => x.slice(0, 16)) : []; r.r21hand = Array.isArray(s.r21hand) ? s.r21hand.slice(0, 20).filter(Number.isFinite) : []; } catch {} return r; };
}

/* ---------- costs: Arachne's chosen type, Damping Sphere, Trinisphere ---------- */
{
  const cm = costMods;
  costMods = function(c, caster){
    const out = cm(c, caster);
    try {
      if (!S || !c || !c.k) return out;
      const ty = info(c.k)?.t || '';
      for (const x of r21Find(/(?:^|\n|\. )spells of the chosen type cost \{(\d+)\} more to cast/)) if (x.b.r21 && new RegExp('\\b' + x.b.r21 + '\\b', 'i').test(ty)) out.more.push({n:+x.m[1], src:x.nm});
      const others = caster === MYPID ? (S.casts || []).filter(z => z.t === turnStr()).length : 0;
      if (others) for (const x of r21Find(/each spell a player casts costs \{1\} more to cast for each other spell that player has cast this turn/)) out.more.push({n:others, src:x.nm});
    } catch (e){ console.warn(e); }
    return out;
  };
  const sc = spellCost;
  spellCost = function(c, zone, o = {}){
    const r = sc(c, zone, o);
    try {
      const tr = r21Find(/as long as ~ is untapped, each spell that would cost less than three mana to cast costs three mana to cast/).filter(x => r21Untapped(x.b, x.pid));
      if (tr.length){ const tot = r21CostTotal(r.cost); if (tot < 3){ r.cost.gen += 3 - tot; r.notes.push(`${tr[0].nm}: costs three mana`); } }
    } catch (e){ console.warn(e); }
    return r;
  };
  // Damping Sphere: a land tapped for two or more mana makes {C}
  const ma = manaAbs;
  manaAbs = function(c){
    let out = ma(c);
    try {
      if (!S || !c || !isLand(c.k)) return out;
      if (rulesOn('r21damp').length) out = out.map(ab => ab.outs && ab.outs.some(o => o.length >= 2) ? {...ab, outs:[['C']], eff:'Add {C}', line:ab.line + ' (Damping Sphere: {C} instead)'} : ab);
      const nm = r21Name(c);
      if (r21Find(/lands with the chosen name have "\{t\}: add \{c\}/).some(x => x.b.r21 && x.b.r21 === nm) && !out.some(o => o.r21h)) out = out.concat({cost:'{T}', eff:'Add {C}', rest:'', outs:[['C']], tapOnly:true, line:'{T}: Add {C}. (Petrified Hamlet)', r21h:true});
    } catch (e){ console.warn(e); }
    return out;
  };
}

/* ---------- casting limits ---------- */
function r21CastBan(c, zone){
  if (!S || !c || !c.k || isLand(c.k)) return null;
  const a = info(c.k) || {}; const pn = phaseNow();
  for (const r of rulesOn('r21ownTurn')) if (pn.pid !== MYPID) return `${r.src}: spells can only be cast during their controller's own turn`;
  for (const r of rulesOn('r21lavinia')){ const n = r21Lands(); if (!/\bCreature\b/.test(a.t || '') && (a.mv || 0) > n) return `${r.src}: you can't cast noncreature spells with mana value greater than your number of lands (${n})`; }
  for (const r of rulesOn('r21even')) if ((a.mv || 0) % 2 === 0) return `${r.src}: you can't cast spells with even mana values`;
  for (const r of rulesOn('r21cageCast')) if (zone === 'gy' || zone === 'lib') return `${r.src}: spells can't be cast from graveyards or libraries`;
  for (const b of (S.r21ban || [])) if (b.t === turnStr() && (!b.d || descOk(c.k, b.d))) return `${b.src}: you can't cast ${b.d ? b.d + ' ' : ''}spells this turn`;
  return null;
}
{
  const cc = castCheck;
  castCheck = function(c, zone){ const why = r21CastBan(c, zone); if (why) return {ok:false, why}; return cc(c, zone); };
  // the cast itself (drag, cascade, free casts) must respect the same limits, not only the menu
  const bc = beginCast;
  beginCast = async function(c, zone, o = {}){
    if (S && c && c.k && !isLand(c.k) && !UI.casting){
      const why = r21CastBan(c, zone) || (() => { const l = castLimit(c, zone); return l.ok ? null : l.why; })();
      if (why){ toast(why); log(`can't cast ${cname(c)} — ${why}`); return; }
      UI.r21pool0 = poolTotal(S.pool); UI.r21free0 = !!o.free;
    }
    return bc(c, zone, o);
  };
  const ct = castTriggers;
  castTriggers = function(c, a, it){
    try { if (it && it.kind === 'spell'){ const spent = UI.r21free0 ? 0 : Math.max(0, (UI.r21pool0 || 0) - poolTotal(S.pool)); if (!spent) it.r21free = 1; } } catch {}
    return ct(c, a, it);
  };
  RQ_OPS.push('r21ban');
}

/* ---------- draws and searches: Notion Thief, Aven Mindcensor, Opposition Agent ---------- */
{
  const dr = draw;
  draw = function(n = 1){
    const rs = S && !UI.dry ? rulesOn('r21notion') : [];
    if (!rs.length) return dr(n);
    let left = n;
    if (UI.r21firstDraw){ UI.r21firstDraw = false; dr(1); left--; }
    const r = rs[0];
    for (let i = 0; i < left; i++){ sendRq(r.pid, 'draw', 1, r.src); log(`skipped a draw — ${r.src}: ${nameOf(r.pid)} draws instead`); }
    commit();
  };
  const sl = searchLibrary;
  searchLibrary = async function(descRaw, rest, ctx){
    if (!S || UI.dry || UI.r21search) return sl(descRaw, rest, ctx);
    UI.r21search = true;
    const mc = rulesOn('r21censor')[0]; const ag = rulesOn('r21agent')[0];
    const tail = mc ? S.lib.splice(4) : null; if (mc) log(`${mc.src}: searches only the top ${S.lib.length} cards`);
    const found = [];
    if (ag) UI.r21agentOn = found;
    try { return await sl(descRaw, rest, ctx); }
    finally {
      UI.r21search = false; UI.r21agentOn = null;
      if (tail){ const top = /top of (?:your|their) library/i.test(rest) && S.lib.length ? S.lib.shift() : null; S.lib.push(...tail); shuffle(S.lib); if (top) S.lib.unshift(top); }
      if (ag && found.length) r21AgentGive(ag, found);
      commit();
    }
  };
  // searches written straight into a handler (tutors to the top) go through here
  const ds = doSentence;
  doSentence = async function(s0, ctx){
    const l = String(s0).toLowerCase();
    if (S && !UI.dry && !UI.r21search && /^(?:you may )?search your library\b/.test(l) && (rulesOn('r21censor').length || rulesOn('r21agent').length)){
      UI.r21search = true; const mc = rulesOn('r21censor')[0]; const ag = rulesOn('r21agent')[0];
      const tail = mc ? S.lib.splice(4) : null; const found = []; if (ag) UI.r21agentOn = found;
      try { return await ds(s0, ctx); }
      finally { UI.r21search = false; UI.r21agentOn = null;
        if (tail){ const top = /top of (?:your|their) library/.test(l) && S.lib.length ? S.lib.shift() : null; S.lib.push(...tail); shuffle(S.lib); if (top) S.lib.unshift(top); }
        if (ag && found.length) r21AgentGive(ag, found); commit(); }
    }
    return ds(s0, ctx);
  };
}
function r21AgentGive(r, cards){
  for (const c of cards){
    const i = S.ex.indexOf(c); if (i < 0) continue; S.ex.splice(i, 1);
    const ref = rid(6); S.lent.push({ref, to:r.pid, card:c, perm:true});
    sendRq(r.pid, 'r21agentGive', 0, r.src, {ref, d:c.k});
  }
  log(`${r.src}: exiled ${cards.map(cname).join(', ')} — ${nameOf(r.pid)} may play ${cards.length === 1 ? 'it' : 'them'}`);
}
RQ_OPS.push('r21agentGive', 'r21untapLand', 'r21tapN', 'r21tithe', 'r21kp', 'r21kpEx', 'r21kpTake', 'r21kpGive', 'r21fate');

/* ---------- Containment Priest, Grafdigger's Cage, Opposition Agent: moving cards ---------- */
{
  const mc = moveCard;
  moveCard = function(id, to, o = {}){
    try {
      if (S && !UI.dry){
        const [from, , c] = find(id);
        if (UI.r21agentOn && from === 'lib' && to !== 'lib' && c){ const r = mc(id, 'ex', {...o, quiet:true}); if (find(id)[0] === 'ex') UI.r21agentOn.push(c); return r; }
        if (to === 'bf' && from && from !== 'bf' && c && !c.tok && !o.fd && isCreatureCard(c)){
          const cg = rulesOn('r21cage')[0]; if (cg && (from === 'gy' || from === 'lib')){ log(`${cname(c)} can't enter the battlefield from ${ZNAME[from]} — ${cg.src}`); toast(`${cg.src}: creature cards in graveyards and libraries can't enter the battlefield`); commit(); return; }
          const pr = rulesOn('r21priest')[0]; if (pr){ log(`${cname(c)} would enter without being cast — exiled instead (${pr.src})`); return mc(id, 'ex', o); }
        }
      }
    } catch (e){ console.warn(e); }
    return mc(id, to, o);
  };
}

/* ---------- abilities: Pithing Needle, Phyrexian Revoker, Petrified Hamlet, Null Rod & co. ---------- */
function r21AbBan(c, mana){
  if (!S || !c || !c.k) return '';
  const nm = r21Name(c);
  for (const x of r21Find(/activated abilities of sources with the chosen name can't be activated( unless they're mana abilities)?/)) if (x.b.r21 && x.b.r21 === nm && !(mana && x.m[1])) return `${x.nm}: abilities of ${nm} can't be activated`;
  if (mana) for (const r of rulesOn('noAbil')) if (new RegExp('\\b' + r.type + '\\b').test(typeOf(c))) return `${r.src}: abilities of ${r.type.toLowerCase()}s can't be activated`;
  if (mana){ const r = rulesOn('notOnTurn').find(r => r.abil && phaseNow().pid === r.pid && /\b(Artifact|Creature|Enchantment)\b/.test(typeOf(c))); if (r) return `${r.src}: no abilities of artifacts, creatures or enchantments during ${nameOf(r.pid)}'s turn`; }
  return '';
}
{
  const ar = abilityReady;
  abilityReady = function(c, ab, mana){ const w = r21AbBan(c, !!mana); if (w) return w; return ar(c, ab, mana); };
  const am = activateMana;
  activateMana = async function(c, ab, ch){ const w = r21AbBan(c, true); if (w){ toast(w); return; } return am(c, ab, ch); };
  const lr = loyaltyReady;
  loyaltyReady = function(c, ab){ const w = r21AbBan(c, false); if (w) return w; return lr(c, ab); };
}

/* ---------- entering: enter tapped, “as ~ enters, choose a card name / card type”, fading ---------- */
function r21TypesHit(c, types){
  const t = typeOf(c) || info(c.k)?.t || '';
  return types.split(/,\s*(?:and\s+)?|\s+and\s+/).some(w => { w = w.trim().replace(/s$/, ''); if (w === 'nonbasic land') return isLand(c.k) && !/\bBasic\b/.test(t); return new RegExp('\\b' + w + '\\b', 'i').test(t); });
}
function r21NameOptions(desc){
  const seen = new Set(); const add = k => { const a = k && info(k); if (!a) return; const n = a.n; if (seen.has(n)) return; if (desc === 'land' && !/\bLand\b/.test(a.t)) return; if (desc === 'nonland' && /\bLand\b/.test(a.t)) return; seen.add(n); };
  for (const [, s] of OPP){ (s.bf || []).forEach(b => add(b.k)); (s.cz || []).forEach(b => add(b.k)); (s.cmd || []).forEach(add); (s.gy || []).forEach(add); (s.ex || []).forEach(add); }
  S.bf.forEach(b => add(b.k)); S.hand.forEach(b => add(b.k)); S.gy.forEach(b => add(b.k));
  return [...seen].sort();
}
async function r21ChooseName(c, desc, src){
  const opts = r21NameOptions(desc); if (!opts.length){ log(`${src}: no ${desc ? desc + ' ' : ''}card name to choose`); return; }
  const v = await askChoice({title:`${src}: choose a ${desc ? desc + ' ' : ''}card name`, options:opts.map(n => ({label:n, value:n}))});
  if (v){ c.r21 = v; log(`${src}: chose ${v}`); commit(); }
}
{
  const oe = onEnter;
  onEnter = function(c, from, o = {}){
    const r = oe(c, from, o);
    try {
      if (c && S && S.bf.includes(c) && from !== 'bf' && !c.fd){
        for (const x of rulesOn('r21etTap')) if (r21TypesHit(c, x.types) && !c.tap){ c.tap = true; log(`${cname(c)} enters tapped (${x.src})`); }
        const t = r21Txt(c); let m;
        if (!UI.dry && (m = t.match(/(?:^|\n)as ~ enters(?: the battlefield)?, choose an? (nonland |land )?card name/))) r21ChooseName(c, (m[1] || '').trim(), cname(c));
        if (!UI.dry && /(?:^|\n)as ~ enters(?: the battlefield)?, look at an opponent's hand, then choose a card type other than creature/.test(t)){
          const opp = opponents()[0]; if (opp) sendRq(opp.pid, 'reveal', 0, cname(c));
          (async () => { const v = await askChoice({title:`${cname(c)}: choose a card type other than creature`, options:['Artifact', 'Enchantment', 'Instant', 'Sorcery', 'Planeswalker', 'Land', 'Battle', 'Kindred'].map(x => ({label:x, value:x}))}); if (v){ c.r21 = v; log(`${cname(c)}: chose ${v}`); commit(); } })();
        }
        if ((m = t.match(/(?:^|\n)fading (\d+)/))){ addNamed(c, 'fade', +m[1]); }
      }
    } catch (e){ console.warn(e); }
    return r;
  };
}

/* ---------- triggers: Torpor Orb, Hushbringer, Karn, Elesh Norn, Strict Proctor ---------- */
function r21Suppress(pid, ev){
  if (!S || !ev) return null;
  const isType = (k, types) => { const t = info(k)?.t || ''; if (types === 'permanents') return true; if (types === 'creatures') return /\bCreature\b/.test(t); return /\b(Artifact|Creature)\b/.test(t); };
  for (const r of rulesOn('r21noEnter')){
    if (ev.type === 'enter' && isType(ev.k, r.types)) return r;
    if (r.die && ev.type === 'die') return r;
    if (r.die && ev.type === 'leave' && /\bCreature\b/.test(info(ev.k)?.t || '') && (UI.curQ || []).some(([p2, e2]) => p2 === pid && e2.type === 'die' && e2.id === ev.id)) return r;
  }
  return null;
}
{
  classifyTrig = (ct => function(w, c){ if (/^a permanent entering causes a triggered ability to trigger$/.test(c)) return {ev:'r21proctor', subj:'any', ctl:'any', desc:''}; return ct(w, c); })(classifyTrig);
  const he = handleEvent;
  handleEvent = function(pid, ev){
    const sup = r21Suppress(pid, ev);
    const before = new Set((S && S.stk || []).map(it => it.sid));
    UI.r21sup = sup; let r;
    try { r = he(pid, ev); } finally { UI.r21sup = null; }
    try {
      if (S && !UI.dry && ev && ev.type === 'enter'){
        const pr = r21Find(/whenever a permanent entering causes a triggered ability to trigger, counter that ability unless its controller pays \{(\d+)\}/);
        if (pr.length) S.stk.filter(it => !before.has(it.sid) && it.kind === 'trigger' && !it.r21pr).forEach(it => { it.r21pr = 1; for (const x of pr){ log(`${x.nm}: ${it.nm}'s ability is countered unless ${S.nm} pays {${x.m[1]}}`); addUnlessPrompt(it, +x.m[1], x.pid); } });
      }
    } catch (e){ console.warn(e); }
    return r;
  };
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    if (UI.r21sup){ log(`${info(src.k)?.n || 'a permanent'}: doesn't trigger (${UI.r21sup.src})`); return; }
    // “whenever a player casts a spell from their hand” (Knowledge Pool): only spells cast from a hand
    try { if (t && ev && ev.type === 'cast' && /casts? a spell from (?:their|your) hand/i.test(t.raw || '')){ const fromHand = evPid === MYPID ? S.stk.some(i => i.kind === 'spell' && i.card && i.card.id === ev.id && i.from === 'hand') : ((OPP.get(evPid) || {}).r21hand || []).includes(ev.id); if (!fromHand) return; } } catch {}
    return pt(src, t, ev, evPid); };
  const ptg = pushTrig;
  pushTrig = function(nm, txt, extra = {}){ if (UI.r21sup){ log(`${nm}: doesn't trigger (${UI.r21sup.src})`); return null; } return ptg(nm, txt, extra); };
}

/* ---------- untap step: Winter Orb, Static Orb; draw step (Notion Thief); Fatespinner skipping main phases ---------- */
{
  const sp = setPhase;
  setPhase = function(i){
    if (i === 2){ UI.r21firstDraw = true; try { return sp(i); } finally { UI.r21firstDraw = false; } }
    if ((i === 3 || i === 5) && S && S.r21skipMain === turnStr()){ log('skips their main phase (Fatespinner)'); return setPhase(i === 3 ? 4 : 6); }
    if (i !== 0 || !S || UI.dry) return sp(i);
    let landMax = 99, permMax = 99; const src = [];
    for (const x of r21Find(/as long as ~ is untapped, players can't untap more than (one|two) (lands?|permanents?) during their untap steps/)){
      if (!r21Untapped(x.b, x.pid)) continue; const n = wn(x.m[1]) || 1;
      if (/land/.test(x.m[2])) landMax = Math.min(landMax, n); else permMax = Math.min(permMax, n); src.push(x.nm);
    }
    if (!src.length) return sp(i);
    const snap = S.bf.filter(c => c.tap || (c.tn || 0) > 0).map(c => [c, c.tap, c.tn || 0]);
    const r = sp(i);
    try {
      const up = snap.filter(([c]) => S.bf.includes(c) && !c.tap && !(c.tn || 0));
      const lands = up.filter(([c]) => isLand(c.k)), non = up.filter(([c]) => !isLand(c.k));
      const need = lands.length > landMax || up.length > permMax;
      if (need){
        up.forEach(([c, t, tn]) => { c.tap = t; c.tn = tn; });
        log(`untap step limited by ${[...new Set(src)].join(', ')}`);
        (async () => {
          const pick = async (list, n, what) => { if (n <= 0 || !list.length) return []; if (list.length <= n) return list.map(([c]) => c.id); return (await pickCards({title:`${[...new Set(src)].join(', ')}: untap up to ${n} ${what}`, cards:list.map(([c]) => c), min:Math.min(n, list.length), max:n})) || []; };
          const lp = await pick(lands, Math.min(landMax, permMax), landMax < 99 ? 'land' + (Math.min(landMax, permMax) > 1 ? 's' : '') : 'permanents');
          const np = permMax < 99 ? await pick(non, permMax - lp.length, 'permanents') : non.map(([c]) => c.id);
          const ids = new Set([...lp, ...np]);
          S.bf.forEach(c => { if (ids.has(c.id)){ c.tap = false; c.tn = 0; } });
          log(`untapped only ${ids.size}: ${S.bf.filter(c => ids.has(c.id)).map(cname).join(', ') || 'nothing'}`); commit();
        })();
        commit();
      }
    } catch (e){ console.warn(e); }
    return r;
  };
}

/* ---------- attacking: Moat ---------- */
{
  const ca = canAttack;
  canAttack = function(c){ const w = ca(c); if (w) return w; try { const r = rulesOn('r21moat')[0]; if (r && !kwOf(c, 'flying')) return `can't attack (${r.src}: creatures without flying can't attack)`; } catch {} return ''; };
}

/* ---------- effects ---------- */
async function doRound21DPre(s, l, ctx){
  let m; const src = () => srcCardOf(ctx); const evPid = () => (ctx.it && (ctx.it.evPid || ctx.it.evDp)) || ((ctx.tgts ? nextTargets(ctx) : [])[0] || {}).pid || null;
  // Silence, Ranger-Captain of Eos, Bilbo's Gambit
  if ((m = l.match(/^(your opponents|players|each opponent) can't cast (noncreature )?spells this turn$/))){
    const d = (m[2] || '').trim(); const t = turnStr();
    for (const p of opponents()) sendRq(p.pid, 'r21ban', 0, ctx.name, {d, t});
    if (m[1] === 'players'){ S.r21ban = (S.r21ban || []).filter(x => x.t === t).concat({t, d, src:ctx.name}); }
    log(`${ctx.name}: ${m[1] === 'players' ? 'players' : 'opponents'} can't cast ${d ? d + ' ' : ''}spells this turn`); commit(); return true;
  }
  // Spelltithe Enforcer
  if ((m = l.match(/^(?:that|target) player sacrifices a permanent of their choice unless they pay (\{[^}]+\})$/))){
    const pid = evPid(); if (!pid) return true;
    if (pid === MYPID){ await r21PayOrSac(m[1].toUpperCase(), ctx.name, MYPID); return true; }
    sendRq(pid, 'r21tithe', 0, ctx.name, {d:m[1].toUpperCase()}); log(`${ctx.name}: ${nameOf(pid)} sacrifices a permanent unless they pay ${m[1].toUpperCase()}`); commit(); return true;
  }
  // Stasis & co.: upkeep sacrifice unless you pay
  if ((m = l.match(/^sacrifice ~ unless you pay ((?:\{[^}]+\})+)$/))){
    const c = src(); if (!c || !S.bf.includes(c)) return true; const cost = m[1].toUpperCase();
    if (UI.dry){ return true; }
    const plan = payPlan(parseCost(cost), S.pool);
    const v = await askChoice({title:`${cname(c)}: pay ${cost} or sacrifice it${plan.err ? ' (tap mana first — not enough in your pool)' : ''}`, options:[{label:`Pay ${cost}`, value:'pay', disabled:!!plan.err}, {label:`Sacrifice ${cname(c)}`, value:'sac'}]});
    const p2 = payPlan(parseCost(cost), S.pool);
    if (v === 'pay' && !p2.err){ S.pool = p2.pool; log(`paid ${cost} to keep ${cname(c)}`); } else sacrificeOne(c);
    commit(); return true;
  }
  // Rising Waters, Hokori
  if ((m = l.match(/^(?:that|target) player untaps a land they control$/))){
    const pid = evPid() || MYPID;
    if (pid === MYPID) await r21UntapLands(1, ctx.name); else { sendRq(pid, 'r21untapLand', 1, ctx.name); log(`${ctx.name}: ${nameOf(pid)} untaps a land`); }
    commit(); return true;
  }
  // Tangle Wire
  if ((m = l.match(/^(?:that|target) player taps an untapped artifact, creature, or land they control for each (\w+) counter on ~$/))){
    const c = src(); const n = c ? ((c.nc || {})[m[1]] || 0) : 0; const pid = evPid() || MYPID;
    if (!n){ log(`${ctx.name}: no ${m[1]} counters`); return true; }
    if (pid === MYPID) await r21TapN(n, ctx.name); else { sendRq(pid, 'r21tapN', n, ctx.name); log(`${ctx.name}: ${nameOf(pid)} taps ${n} untapped artifact, creature, or land`); }
    commit(); return true;
  }
  // Smokestack
  if ((m = l.match(/^(?:that|target) player sacrifices a permanent for each (\w+) counter on ~$/))){
    const c = src(); const n = c ? ((c.nc || {})[m[1]] || 0) : 0; const pid = evPid() || MYPID;
    if (!n){ log(`${ctx.name}: no ${m[1]} counters`); return true; }
    if (pid === MYPID) addChoicePrompt('sac', 'permanent', n, MYPID, ctx.name); else sendRq(pid, 'sac', n, ctx.name, {d:'permanent'});
    log(`${ctx.name}: ${nameOf(pid)} sacrifices ${n} permanent${n === 1 ? '' : 's'}`); commit(); return true;
  }
  if ((m = l.match(/^(?:you may )?put an? (\w+) counter on ~$/)) && /^(soot|fade)$/.test(m[1])){ const c = src(); if (c && (!/^you may/.test(l) || UI.dry || await askYes(`${ctx.name}: put a ${m[1]} counter on it?`))) addNamed(c, m[1], 1); commit(); return true; }
  // fading upkeep
  if ((m = l.match(/^remove a fade counter from ~\. if you can't, sacrifice it$/)) || (m = l.match(/^remove a fade counter from ~ or sacrifice it \(fading\)$/))){ const c = src(); if (!c) return true; if ((c.nc || {}).fade > 0){ addNamed(c, 'fade', -1); log(`${cname(c)}: ${c.nc.fade} fade counter${c.nc.fade === 1 ? '' : 's'} left`); } else sacrificeOne(c); commit(); return true; }
  // Lavinia: if no mana was spent to cast it, counter that spell
  if ((m = l.match(/^if no mana was spent to cast it, counter that spell$/))){
    const pid = ctx.it && ctx.it.evPid; const k = ctx.it && ctx.it.evk; if (!pid || UI.dry) return true;
    if (pid === MYPID){ const it = S.stk.slice().reverse().find(x => x.kind === 'spell' && x.k === k && x.r21free); if (it) counterMine(it, MYPID); return true; }
    const st = OPP.get(pid); const it = st && (st.stk || []).slice().reverse().find(x => x.kind === 'spell' && x.k === k);
    if (it && (st.r21free || []).includes(it.sid)){ S.ctr.push({id:rid(8), sid:it.sid, un:0}); log(`${ctx.name}: countered ${it.nm} (no mana was spent to cast it)`); }
    else log(`${ctx.name}: mana was spent on ${info(k)?.n || 'that spell'} — no counter`);
    commit(); return true;
  }
  // Knowledge Pool
  if ((m = l.match(/^each player exiles the top (\w+) cards of their library$/)) && /exiled with ~/.test(tname(info(ctx.k)?.o || '', info(ctx.k)?.n).toLowerCase())){
    const n = wn(m[1]) || 3; r21KpExile(n, ctx.name); opponents().forEach(p => sendRq(p.pid, 'r21kpEx', n, ctx.name)); commit(); return true;
  }
  if ((m = l.match(/^(?:that|target) player exiles it$/)) && /cast a spell from among other cards exiled with ~/.test(tname(info(ctx.k)?.o || '', info(ctx.k)?.n).toLowerCase())){
    const pid = ctx.it && ctx.it.evPid; if (!pid || UI.dry){ ctx.r21kp = 1; return true; }
    if (pid === MYPID) await r21KpCast(ctx.it.evId, ctx.name); else { sendRq(pid, 'r21kp', 0, ctx.name, {tid:ctx.it.evId}); log(`${ctx.name}: ${nameOf(pid)} exiles their spell and may cast another exiled card`); }
    ctx.r21kp = 1; commit(); return true;
  }
  if ((m = l.match(/^if the player does, they may cast a spell from among other cards exiled with ~ without paying its mana cost$/)) && ctx.r21kp) return true;   // done by r21KpCast together with the exile
  // Strict Proctor (its effect is applied by the entering event itself; this handles a copied/explicit trigger on my own stack)
  if ((m = l.match(/^counter that ability unless its controller pays \{(\d+)\}$/))){ const it = ctx.it && ctx.it.r21sid && S.stk.find(x => x.sid === ctx.it.r21sid); if (it) addUnlessPrompt(it, +m[1], MYPID); return true; }
  // Pithing Needle style choice that happens as a trigger (Petrified Hamlet)
  if ((m = l.match(/^choose an? (land |nonland )?card name$/))){ const c = src(); if (c && !UI.dry) await r21ChooseName(c, (m[1] || '').trim(), ctx.name); return true; }
  // Fatespinner
  if ((m = l.match(/^(?:that|target) player chooses draw step, main phase, or combat phase$/))){ const pid = evPid(); if (!pid) return true; if (pid === MYPID) await r21Fate(ctx.name); else { sendRq(pid, 'r21fate', 0, ctx.name); log(`${ctx.name}: ${nameOf(pid)} chooses a step or phase to skip`); } ctx.r21fate = 1; commit(); return true; }
  if ((m = l.match(/^the player skips each instance of the chosen step or phase this turn$/)) && ctx.r21fate) return true;   // done by r21Fate with the choice
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound21DPre(s, l, ctx)) return; return ds(s0, ctx); };
}
// the fading upkeep trigger
{
  const fs = fireSteps;
  fireSteps = function(step, activePid){
    const r = fs(step, activePid);
    try { if (step === 'upkeep' && activePid === MYPID) S.bf.forEach(b => { if (!b.fd && /(?:^|\n)fading \d+/.test(r21Txt(b))) pushTrig(cname(b), 'Remove a fade counter from ~ or sacrifice it (fading).', {k:b.k, srcId:b.id}); }); } catch (e){ console.warn(e); }
    return r;
  };
}
async function r21PayOrSac(cost, src, from){
  const plan = payPlan(parseCost(cost), S.pool);
  const v = UI.dry ? 'no' : await askChoice({title:`${src}: pay ${cost}, or sacrifice a permanent?${plan.err ? ' (tap mana first — not enough in your pool)' : ''}`, options:[{label:`Pay ${cost}`, value:'pay', disabled:!!plan.err}, {label:'Sacrifice a permanent', value:'no'}]});
  const p2 = payPlan(parseCost(cost), S.pool);
  if (v === 'pay' && !p2.err){ S.pool = p2.pool; log(`paid ${cost} (${src})`); commit(); return true; }
  log(`didn't pay ${cost} (${src}) — sacrifices a permanent`); addChoicePrompt('sac', 'permanent', 1, from, src); commit(); return false;
}
async function r21UntapLands(n, src){
  const list = S.bf.filter(c => !c.fd && isLand(c.k) && (c.tap || (c.tn || 0) > 0)); if (!list.length){ log(`${src}: no tapped land to untap`); return; }
  const ids = list.length <= n ? list.map(c => c.id) : await pickCards({title:`${src}: untap ${n} land${n === 1 ? '' : 's'}`, cards:list, min:n, max:n});
  (ids || []).forEach(id => { const c = S.bf.find(x => x.id === id); if (c){ c.tap = false; c.tn = 0; log(`untapped ${cname(c)} (${src})`); } }); commit();
}
async function r21TapN(n, src){
  const list = S.bf.filter(c => !c.fd && !c.tap && (isLand(c.k) || /\b(Artifact|Creature)\b/.test(typeOf(c))));
  if (!list.length){ log(`${src}: nothing untapped to tap`); return; }
  const ids = list.length <= n ? list.map(c => c.id) : await pickCards({title:`${src}: tap ${n} untapped artifact, creature, or land`, cards:list, min:n, max:n});
  const got = (ids || []).map(id => S.bf.find(x => x.id === id)).filter(Boolean); got.forEach(c => { c.tap = true; });
  log(`tapped ${got.map(cname).join(', ')} (${src})`); commit();
}
async function r21Fate(src){
  const v = UI.dry ? null : await askChoice({title:`${src}: choose a step or phase to skip this turn`, options:[{label:'Draw step', value:'draw'}, {label:'Main phase', value:'main'}, {label:'Combat phase', value:'combat'}]});
  if (v === 'draw') skipNext('draw'); else if (v === 'combat') skipNext('combat'); else if (v === 'main') S.r21skipMain = turnStr();
  if (v) log(`${src}: skips the ${v === 'draw' ? 'draw step' : v === 'main' ? 'main phase' : 'combat phase'} this turn`); commit();
}
function r21KpExile(n, src){ const out = S.lib.splice(0, n); out.forEach(c => { c.r21kp = 1; S.ex.push(c); }); log(`${src}: exiled ${out.length} card${out.length === 1 ? '' : 's'} from the top of their library`); commit(); }
async function r21KpCast(cardId, src){
  const it = S.stk.find(x => x.kind === 'spell' && x.card && x.card.id === cardId);
  if (!it){ log(`${src}: the spell isn't on the stack any more`); return; }
  if (it.from !== 'hand'){ log(`${src}: ${it.nm} wasn't cast from the hand`); return; }
  S.stk.splice(S.stk.indexOf(it), 1); const c = it.card; faceRestore(c); c.r21kp = 1; S.ex.push(c);
  log(`${src}: exiled ${it.nm} instead of letting it resolve`); commit();
  const mine = S.ex.filter(x => x.r21kp && x !== c && !isLand(x.k));
  const theirs = []; for (const [pid, s] of OPP) (s.r21kp || []).forEach(k => { if (!isLand(k)) theirs.push({pid, k}); });
  if (!mine.length && !theirs.length){ log(`${src}: no other card to cast`); return; }
  const opts = [...mine.map(x => ({label:`${cname(x)} (yours)`, value:'m' + x.id})), ...theirs.map((x, i) => ({label:`${info(x.k)?.n} (${nameOf(x.pid)}'s)`, value:'o' + i})), {label:'Cast nothing', value:'none'}];
  const v = await askChoice({title:`${src}: cast a spell from among the other exiled cards without paying its mana cost?`, options:opts});
  if (!v || v === 'none') return;
  if (v[0] === 'm'){ const x = S.ex.find(y => y.id === +v.slice(1)); if (x){ await waitUntil(() => !UI.casting, 8000); x.r21kp = 0; await beginCast(x, 'ex', {free:true}); } }
  else { const x = theirs[+v.slice(1)]; sendRq(x.pid, 'r21kpTake', 0, src, {d:x.k}); log(`${src}: casts ${info(x.k)?.n} from ${nameOf(x.pid)}'s Knowledge Pool cards`); }
  commit();
}
{
  const ao = applyOp;
  applyOp = function(r, from){
    switch (r.op){
      case 'r21ban': S.r21ban = (S.r21ban || []).filter(x => x.t === turnStr()).concat({t:String(r.t || turnStr()), d:String(r.d || ''), src:r.src}); log(`can't cast ${r.d ? r.d + ' ' : ''}spells this turn (${r.src})`); return;
      case 'r21tithe': (async () => { await r21PayOrSac(String(r.d || '{1}'), r.src, from); commit(); })(); return;
      case 'r21untapLand': (async () => { await r21UntapLands(r.n || 1, r.src); })(); return;
      case 'r21tapN': (async () => { await r21TapN(r.n || 1, r.src); })(); return;
      case 'r21fate': (async () => { await r21Fate(r.src); })(); return;
      case 'r21kpEx': r21KpExile(r.n || 3, r.src); return;
      case 'r21kp': (async () => { await r21KpCast(r.tid, r.src); })(); return;
      case 'r21kpTake': { const i = S.ex.findIndex(c => c.r21kp && c.k === r.d); if (i < 0) return; const [c] = S.ex.splice(i, 1); const ref = rid(6); S.lent.push({ref, to:from, card:c, perm:true}); sendRq(from, 'r21kpGive', 0, r.src, {ref, d:c.k}); log(`${nameOf(from)} casts ${cname(c)} from Knowledge Pool`); commit(); return; }
      case 'r21kpGive': { const c = {id:S.nid++, k:r.d, own:{pid:from, ref:r.ref}}; S.ex.push(c); c.mayPlay = {adv:true, src:r.src, free:true}; commit(); (async () => { await waitUntil(() => !UI.casting, 8000); await beginCast(c, 'ex', {free:true}); })(); return; }
      case 'r21agentGive': { const c = {id:S.nid++, k:r.d, own:{pid:from, ref:r.ref}}; S.ex.push(c); c.mayPlay = {adv:true, src:r.src, cast:false}; log(`${r.src}: may play ${cname(c)} (exiled from ${nameOf(from)}'s library)`); commit(); return; }
    }
    return ao(r, from);
  };
}
