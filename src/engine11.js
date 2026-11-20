/* ===================== Rules engine — round 11: the long tail of the 7,000 most-played cards ===================== */

/* ---------- More name forms: “this Saga”, “this Class”, “him/her” after transform ---------- */
{
  const tn = tname;
  tname = function(txt, name){ return tn(txt, name).replace(/\bthis (saga|class|room|case|siege|attraction|token creature)\b/gi, '~'); };
}

/* ---------- Enginewide flags shared with the table: Fog ---------- */
{
  const ep = enginePublic;
  enginePublic = function(){ const o = ep(); o.fog = S.fog === turnStr() ? 1 : 0; return o; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); o.fog = s.fog ? 1 : 0; return o; };
  const ad = attackerDamage;
  attackerDamage = async function(step, bl){
    const fog = S.fog === turnStr() || [...OPP.values()].some(s => s.fog && s.ct === turnStr());
    if (fog){ log('combat damage is prevented this turn'); return; }
    return ad(step, bl);
  };
}

/* ---------- Class levels: abilities after “Level N” only work at that level ---------- */
function classLevelOf(raw, k){
  const o = tname(info(k)?.o || '', info(k)?.n); let lvl = 1;
  for (const line of o.split('\n')){ const m = line.match(/^(?:\{[^}]+\})+: level (\d+)$/i); if (m) lvl = +m[1]; if (line.trim() === String(raw).trim().split('\n')[0]) return lvl; }
  return 1;
}
{
  const tg = trigsOf;
  trigsOf = function(k, fl){ const out = tg(k, fl); if (out.r11) return out; if (/\bClass\b/.test(info(k)?.t || '')) out.forEach(t => { t.minLvl = classLevelOf(t.raw || '', k); }); out.r11 = true; return out; };
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){ if (t && t.minLvl > 1){ const c = S.bf.find(x => x.id === src.id); if (!c || (c.lvl || 1) < t.minLvl) return; } return pt(src, t, ev, evPid); };
  const ar = abilityReady;
  abilityReady = function(c, ab, mana){ const m = String(ab.eff || '').match(/^level (\d+)\.?$/i); if (m && (c.lvl || 1) !== +m[1] - 1) return `Only from level ${+m[1] - 1}`; return ar(c, ab, mana); };
}

/* ---------- Effects ---------- */
async function doRound11Pre(s, l, ctx){
  let m; const src = () => srcCardOf(ctx); const say = t => doSentence(cap(t), ctx);
  if (/^then /.test(l)){ const r = await doRound11Pre(s.slice(5), l.slice(5), ctx); if (r) return true; }
  if ((m = l.match(/^level (\d+)$/))){ const c = src(); if (c){ c.lvl = +m[1]; log(`${cname(c)} is now level ${m[1]}`); commit(); } return true; }
  // man-lands and animations
  if ((m = l.match(/^(?:until end of turn, )?(~|target land you control|target land) becomes an? (\d+)\/(\d+) (.+?) creature(?: with (.+?))?(?: until end of turn)?(?: that's still a land)?$/))){
    const c = m[1] === '~' ? src() : (() => { const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; return t && S.bf.find(x => x.id === t.id); })(); if (!c) return true;
    c.anim = 'crew'; c.animPT = [+m[2], +m[3]]; const kws = (m[5] || '').replace(/"[^"]*"/g, '').split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim()).filter(x => /^(flying|haste|trample|vigilance|lifelink|deathtouch|reach|menace|first strike|double strike|hexproof|indestructible|infect|defender)$/.test(x));
    c.ekw = [...new Set([...(c.ekw || []), ...kws])]; log(`${cname(c)} becomes a ${m[2]}/${m[3]} ${m[4]} creature until end of turn`); commit(); return true; }
  if (/^(?:it's|they're) still (?:a )?lands?$/.test(l)) return true;
  if (/^it's an enchantment$/.test(l)) return true;
  // extra turns
  if ((m = l.match(/^(you|target player) takes? an extra turn after this one$/))){ const t = /^target/.test(m[1]) ? (ctx.tgts ? nextTargets(ctx) : [])[0] : null; if (t && t.pid !== MYPID){ handWarn(`${nameOf(t.pid)} takes an extra turn after this one`, ctx); return true; } S.xt = (S.xt || 0) + 1; log(`${ctx.name}: will take an extra turn after this one`); commit(); return true; }
  // saga flip / transform back
  if ((m = l.match(/^exile ~, then return it to the battlefield (tapped and )?transformed under (?:your|its owner's|his owner's|her owner's) control$/)) || (m = l.match(/^exile (?:him|her|it), then return (?:him|her|it) to the battlefield (tapped and )?transformed under (?:his|her|its) owner's control$/))){ const c = src(); if (c){ c.fl = !c.fl; c.lore = 0; c.cp = c.cm = 0; c.tap = !!m[1]; log(`${cname(c)} returned transformed`); onEnter(c, 'ex'); commit(); } return true; }
  if (/^return (?:it|him|her) to the battlefield (?:tapped and )?transformed under (?:your|its owner's|his owner's|her owner's) control$/.test(l)) return true;
  // fog and damage rules
  if ((m = l.match(/^prevent all combat damage that would be dealt this turn$/))){ S.fog = turnStr(); log(`${ctx.name}: combat damage is prevented this turn`); commit(); return true; }
  if ((m = l.match(/^prevent all combat damage that would be dealt (?:to and )?by (?:target creature|it) this turn$/))){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (t) applyTo(t, {op:'pump', src:ctx.name, f:{p:0, t:0, kw:['nodamage']}}); return true; }
  if (/^damage can't be prevented this turn$/.test(l)) return true;
  // modal extras
  if (/^choose the same mode more than once$/.test(l)) return true;
  // copies
  if ((m = l.match(/^copy it$/)) && ctx.it){ const sp = stackAll().filter(i => i.kind === 'spell' && (!ctx.it.evId || i.id === ctx.it.evId || i.k === ctx.it.evk)).pop(); if (sp){ await copyMany({...ctx, it:{...ctx.it, copyOf:sp.sid}}, 1).catch(() => handWarn('Copy that spell', ctx)); } return true; }
  // mana that doesn't empty
  if (/^until end of turn, you don't lose this mana as steps and phases end$/.test(l)){ S.keepMana = turnStr(); return true; }
  // “that much” life
  if ((m = l.match(/^(target opponent|each opponent|target player) loses that much life$/))){ const n = (ctx.it && ctx.it.evN) || 0; const pids = /^each/.test(m[1]) ? opponents().map(p => p.pid) : [((ctx.tgts ? nextTargets(ctx) : [])[0] || {}).pid].filter(Boolean); pids.forEach(pid => loseLife(pid, n, ctx.name)); return true; }
  if ((m = l.match(/^you gain that much life$/))){ const n = (ctx.it && ctx.it.evN) || 0; if (n) gainLife(n, ctx.name); commit(); return true; }
  if ((m = l.match(/^~ deals that much damage to (each opponent|any target|target player)$/))){ const n = (ctx.it && ctx.it.evN) || 0; if (/each/.test(m[1])) opponents().forEach(p => dealDamage({t:'player', pid:p.pid}, n, ctx.k, src())); else { const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (t) dealDamage(t, n, ctx.k, src()); } return true; }
  if ((m = l.match(/^you gain life equal to its (toughness|power)$/))){ const c = ctx.it && (S.bf.find(x => x.id === ctx.it.evId) || S.gy.find(x => x.id === ctx.it.evId)); const n = c ? (S.bf.includes(c) ? stats(c)[m[1] === 'power' ? 0 : 1] : parseInt(info(c.k)?.[m[1] === 'power' ? 'p' : 't']) || 0) : 0; if (n > 0) gainLife(n, ctx.name); commit(); return true; }
  // untaps
  if ((m = l.match(/^untap (those creatures|them|enchanted creature|another target permanent|target permanent|target creature|target land)$/))){ let list = [];
    if (/^(those creatures|them)$/.test(m[1])) list = (ctx.those || (ctx.lastT || []).map(t => S.bf.find(x => x.id === t.id))).filter(Boolean);
    else if (/enchanted/.test(m[1])){ const sc = src(); const h = sc && sc.att && S.bf.find(x => x.id === sc.att.id); if (h) list = [h]; }
    else { const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (t){ if (t.pid === MYPID){ const c = S.bf.find(x => x.id === t.id); if (c) list = [c]; } else applyTo(t, {op:'untap', src:ctx.name}); } }
    list.forEach(c => { c.tap = false; c.tn = 0; }); commit(); return true; }
  // “X and target opponent each draw a card”
  if ((m = l.match(/^you and target opponent each draw (a|one|two) cards?$/))){ const n = wn(m[1]) || 1; draw(n); const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (t && t.pid !== MYPID) sendRq(t.pid, 'draw', n, ctx.name); commit(); return true; }
  // the rest on the bottom after another effect picked one
  if ((m = l.match(/^put the rest on the bottom of your library in a random order$/)) && ctx.lastEx && ctx.lastEx.length){ bottomRandom(ctx.lastEx.map(id => find(id)[2]).filter(c => c && S.ex.includes(c))); return true; }
  if ((m = l.match(/^put that card into your hand and the rest on the bottom of your library in a random order$/)) && (ctx.untilHit || ctx.untilRest)){ const h = ctx.untilHit; if (h && S.ex.includes(h)){ S.ex.splice(S.ex.indexOf(h), 1); S.hand.push(h); log(`put ${cname(h)} into their hand`); } if (ctx.untilRest) bottomRandom(ctx.untilRest); ctx.untilRest = null; ctx.untilHit = null; commit(); return true; }
  // casting what you just exiled
  if ((m = l.match(/^(?:you may )?cast (?:that card|the copy|it) without paying its mana cost$/)) && (ctx.lastEx && ctx.lastEx.length)){ const c = find(ctx.lastEx[0])[2]; if (c && S.ex.includes(c) && !isLand(c.k) && !UI.dry){ UI.afterCast = () => {}; await beginCast(c, 'ex', {free:true}); } return true; }
  if ((m = l.match(/^(?:you may )?play (?:that card|those cards|them|it) (this turn|for as long as (?:it|they) remains? exiled|until the end of your next turn)$/)) || (m = l.match(/^until (?:the )?end of (?:your next )?turn, you may play (?:that card|those cards|them)$/))){ if (ctx.lastEx && ctx.lastEx.length) grantPlay(ctx.lastEx, {cast:false, src:ctx.name, long:!/this turn/.test(l)}); return true; }
  if ((m = l.match(/^(?:you may )?cast (?:that card|it) for as long as it remains exiled(?:, and mana of any type can be spent to cast that spell)?$/))){ if (ctx.lastEx && ctx.lastEx.length) grantPlay(ctx.lastEx, {cast:true, src:ctx.name, long:true}); return true; }
  if ((m = l.match(/^exile the top card of (target player's|each player's|target opponent's|your) library$/))){ const t = /target/.test(m[1]) ? (ctx.tgts ? nextTargets(ctx) : [])[0] : null; const pids = m[1] === 'your' ? [MYPID] : /each/.test(m[1]) ? players().map(p => p.pid) : [t && t.pid].filter(Boolean);
    for (const pid of pids){ if (pid === MYPID){ const c = S.lib[0]; if (c){ moveCard(c.id, 'ex'); ctx.lastEx = (ctx.lastEx || []).concat(c.id); ctx.lastExC = c; ctx.lastMV = info(c.k)?.mv || 0; } } else { sendRq(pid, 'exileTop', 1, ctx.name); if (/play|cast/.test(String(ctx.full || '').toLowerCase())) handWarn(`You may play the card exiled from ${nameOf(pid)}'s library as ${ctx.name} says (by hand)`, ctx); } }
    commit(); return true; }
  // poison, half life
  if ((m = l.match(/^each opponent gets (a|one|two|three) poison counters?$/))){ const n = wn(m[1]) || 1; opponents().forEach(p => sendRq(p.pid, 'psn', n, ctx.name)); log(`${ctx.name}: each opponent gets ${n} poison`); return true; }
  if ((m = l.match(/^target player loses half their life, rounded up$/))){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (!t) return true; if (t.pid === MYPID){ const n = Math.ceil(S.life / 2); S.life -= n; } else { const st = OPP.get(t.pid); const n = Math.ceil(((st && st.life) || 0) / 2); loseLife(t.pid, n, ctx.name); } commit(); return true; }
  // hands
  if ((m = l.match(/^look at target (?:player's|opponent's) hand$/))){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (t && t.pid !== MYPID) sendRq(t.pid, 'reveal', 0, ctx.name); return true; }
  if ((m = l.match(/^discard (?:your hand|up to (two|three|one) cards?)$/))){ if (/your hand/.test(l)){ UI.discarding = []; S.hand.slice().forEach(c => moveCard(c.id, 'gy')); ctx.discN = UI.discarding.length; UI.discarding = null; } else { const n = wn(m[1]) || 1; const ids = await pickCards({title:`${ctx.name}: discard up to ${n}`, cards:S.hand.slice(), min:0, max:Math.min(n, S.hand.length), noneLabel:'None'}); UI.discarding = []; (ids || []).forEach(id => moveCard(id, 'gy')); ctx.discN = UI.discarding.length; UI.discarding = null; } commit(); return true; }
  if ((m = l.match(/^draw that many cards$/))){ const n = ctx.discN ?? (ctx.it && ctx.it.evN) ?? 0; if (n) draw(n); commit(); return true; }
  // graveyard to battlefield en masse
  if ((m = l.match(/^return all (.+?) cards from your graveyard to the battlefield$/))){ const d = sing(m[1]); S.gy.filter(c => descOk(c.k, d)).forEach(c => moveCard(c.id, 'bf')); commit(); return true; }
  if ((m = l.match(/^put all creature cards from all graveyards onto the battlefield under your control$/))){ S.gy.filter(c => isCreatureCard(c)).forEach(c => moveCard(c.id, 'bf')); handWarn("Take every creature card from the other players' graveyards onto your battlefield (use their graveyard view)", ctx); return true; }
  if ((m = l.match(/^return (?:target|a) (.+?) card (?:with mana value (\d+) or less )?from your graveyard to the battlefield$/))){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; let c = t && find(t.id)[0] === 'gy' ? find(t.id)[2] : null;
    if (!c && !UI.dry){ const d = sing(m[1]); const list = S.gy.filter(x => descOk(x.k, d) && (!m[2] || (info(x.k)?.mv || 0) <= +m[2])); if (list.length){ const ids = await pickCards({title:`${ctx.name}: return a ${m[1]} card`, cards:list, min:0, max:1}); c = ids && ids[0] && S.gy.find(x => x.id === ids[0]); } }
    if (c) moveCard(c.id, 'bf'); commit(); return true; }
  if ((m = l.match(/^return another target (.+?) card from your graveyard to your hand$/))){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (t && find(t.id)[0] === 'gy') moveCard(t.id, 'hand'); commit(); return true; }
  if ((m = l.match(/^exile target (instant or sorcery|creature|artifact|land|enchantment) card from a graveyard$/))){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (!t) return true; if (t.pid === MYPID) moveCard(t.id, 'ex'); else sendRq(t.pid, 'gytake', 0, ctx.name, {d:t.k, ex:1}); ctx.lastT = [t]; commit(); return true; }
  // fight / bite
  if ((m = l.match(/^target creature you control deals damage equal to its power to target creature (?:you don't control|an opponent controls)$/)) || (m = l.match(/^(?:it|~) fights up to one target creature you don't control$/))){
    const fight = /fights/.test(l); const a = fight ? src() : (() => { const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; return t && S.bf.find(x => x.id === t.id); })(); const b = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (!a || !b) return true;
    dealDamage(b, Math.max(0, stats(a)[0]), a.k, a); if (fight){ const bs = statsAny(b); if (bs) damageCard(a, Math.max(0, bs[0]), {}); } commit(); return true; }
  // “Choose target creature” / “Choose an opponent” preludes
  if ((m = l.match(/^choose (?:target creature(?: you control)?|an opponent|target player)$/))){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (t) ctx.lastT = [t]; else if (/opponent/.test(l)){ const o = opponents(); const pid = o.length === 1 ? o[0].pid : await choosePlayer(`${ctx.name}: choose an opponent`, true); if (pid) ctx.lastT = [{t:'player', pid}]; } return true; }
  // tokens' granted mana / sacrifice
  if ((m = l.match(/^it has "sacrifice ~: add \{c\}\."$/)) || /^it has "sacrifice (?:this creature|~): add \{c\}/.test(l)) return true;
  // creatures your opponents control get -N/-N
  if ((m = l.match(/^creatures your opponents control get -(\d+)\/-(\d+) until end of turn$/))){ for (const [pid, st] of OPP) (st.bf || []).forEach(c => { if (c.k && isCreatureCard(c)) applyTo({t:'card', pid, id:c.id, k:c.k}, {op:'pump', src:ctx.name, f:{p:-m[1], t:-m[2]}}); }); return true; }
  if ((m = l.match(/^(you and )?permanents you control gain (hexproof|indestructible|hexproof and indestructible) until end of turn$/)) || (m = l.match(/^target permanent you control gains (hexproof and indestructible|hexproof|indestructible) until end of turn$/))){ const kws = (m[2] || m[1]).split(' and '); const list = /^target/.test(l) ? [(ctx.tgts ? nextTargets(ctx) : [])[0]].filter(Boolean).map(t => S.bf.find(x => x.id === t.id)).filter(Boolean) : S.bf; list.forEach(c => { c.ekw = [...new Set([...(c.ekw || []), ...kws])]; }); commit(); return true; }
  // double counters
  if ((m = l.match(/^double the number of \+1\/\+1 counters on (it|~|target creature|each creature you control)$/))){ const list = m[1] === 'each creature you control' ? S.bf.filter(c => isCreatureCard(c)) : m[1] === '~' ? [src()] : [((ctx.lastT || [])[0] && S.bf.find(x => x.id === ctx.lastT[0].id)) || (() => { const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; return t && S.bf.find(x => x.id === t.id); })()]; list.filter(Boolean).forEach(c => { if (c.cp) modCounters(c, 'cp', c.cp); }); commit(); return true; }
  if ((m = l.match(/^draw a card for each \+1\/\+1 counter on (?:it|~)$/))){ const c = src(); const n = c ? c.cp || 0 : 0; if (n) draw(n); commit(); return true; }
  // misc
  if ((m = l.match(/^attach ~ to it$/))){ const c = src(); const t = (ctx.lastT || [])[0] || (ctx.it && ctx.it.evId != null ? {id:ctx.it.evId, pid:MYPID} : null); if (c && t && t.pid === MYPID){ c.att = {pid:MYPID, id:t.id}; commit(); } return true; }
  if ((m = l.match(/^put it into its owner's library third from the top$/))){ const c = src(); if (c && find(c.id)[0] !== 'lib'){ moveCard(c.id, 'lib'); const i = S.lib.findIndex(x => x.id === c.id); if (i >= 0){ const [x] = S.lib.splice(i, 1); S.lib.splice(Math.min(2, S.lib.length), 0, x); } } commit(); return true; }
  if ((m = l.match(/^put ~ from your hand onto the battlefield$/))){ const c = S.hand.find(x => x.k === ctx.k); if (c) moveCard(c.id, 'bf'); commit(); return true; }
  if ((m = l.match(/^(?:you may )?cast spells this turn as though they had flash$/))){ S.flashT = turnStr(); return true; }
  if ((m = l.match(/^your opponents can't cast spells this turn$/))){ S.silence = turnStr(); handWarn('Your opponents can\'t cast spells this turn', ctx); return true; }
  if ((m = l.match(/^the next spell you cast this turn can't be countered$/))){ S.uncNext = turnStr(); return true; }
  if ((m = l.match(/^you gain (\d+) life for each (.+)$/))){ const n = countOf(m[2], ctx); if (n != null){ if (n) gainLife(+m[1] * n, ctx.name); commit(); return true; } }
  if ((m = l.match(/^you gain 1 life for each spell you've cast this turn$/))){ const n = (S.casts || []).filter(x => x.t === turnStr()).length; if (n) gainLife(n, ctx.name); commit(); return true; }
  if ((m = l.match(/^(?:if no mana was spent to cast it, )?counter that spell$/))){ handWarn(s, ctx); return true; }
  if ((m = l.match(/^each creature deals 1 damage to its controller$/))){ const n = S.bf.filter(c => isCreatureCard(c)).reduce((a, c) => a + (c.n || 1), 0); if (n) S.life -= n; for (const [pid, st] of OPP){ const k = (st.bf || []).filter(c => c.k && isCreatureCard(c)).reduce((a, c) => a + (c.n || 1), 0); if (k) loseLife(pid, k, ctx.name); } commit(); return true; }
  if ((m = l.match(/^(?:target player|each player) shuffles$/)) || /^shuffles$/.test(l)) return true;
  if ((m = l.match(/^a creature destroyed this way can't be regenerated$/))) return true;
  if ((m = l.match(/^if that spell is countered this way, exile it instead of putting it into its owner's graveyard$/))) return true;
  if ((m = l.match(/^if that spell would be put into (?:a|your) graveyard, exile it instead$/))) return true;
  if ((m = l.match(/^if you search your library this way, shuffle$/))) return true;
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){
    const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase();
    if (l && await doRound11Pre(s, l, ctx)) return;
    return ds(s0, ctx);
  };
}
// animated lands use their animation's P/T
{
  const st0 = stats;
  stats = function(c, pid){ const r = st0(c, pid); if (c && c.animPT && c.anim){ const pu = c.pu || [0, 0]; const n = (c.cp || 0) - (c.cm || 0); return [c.animPT[0] + n + (pu[0] || 0), c.animPT[1] + n + (pu[1] || 0)]; } return r; };
  const tc = turnChanged;
  turnChanged = function(...a){ if (S) S.bf.forEach(c => { if (c.animPT){ c.animPT = null; if (c.anim === 'crew') c.anim = ''; } }); return tc.apply(this, a); };
  const kw = kwOf;
  kwOf = function(c, k, pid){ const r = kw(c, k, pid); if (r) return r; if (c && (c.ekwp || []).includes(k)) return true; if (k === 'hexproof' || k === 'indestructible'){ /* Shadowspear */ } return r; };
}
// keyword statics that are reminders or handled elsewhere
STATIC_KNOWN.push(/^(eternalize|transmute|bestow|miracle|freerunning|devour|aftermath|demonstrate|for mirrodin!|suspend|spree|tiered|paradigm|rebound|prepared|~ enters prepared)/,
  /^play with the top card of your library revealed$/, /^players have no maximum hand size$/);
STATIC_RULES.push(
  [/^you may play lands from the top of your library$/, m => ({kind:'topPlay', who:'you', mv:99, landsOnly:true})],
  [/^you may cast creature spells from the top of your library$/, m => ({kind:'topPlay', who:'you', mv:0, creaturesOnly:true})],
  [/^untap ~ during each other player's untap step$/, m => ({kind:'selfSeedborn', who:'you'})],
  [/^lands you control are every basic land type in addition to their other types$/, m => ({kind:'allBasic', who:'you'})],
  [/^creatures you control have "\{t\}: add one mana of any color"$/, m => ({kind:'crMana', who:'you'})],
  [/^treasures you control have "\{t\}, sacrifice ~: add two mana of any one color"$/, m => ({kind:'goldspan', who:'you'})],
  [/^artifacts and creatures your opponents control enter tapped$/, m => ({kind:'oppTapped', who:'opp', art:true})],
  [/^you don't lose unspent red mana as steps and phases end$/, m => ({kind:'keepRed', who:'you'})],
  [/^you may activate abilities of creatures you control as though those creatures had haste$/, m => ({kind:'abilHaste', who:'you'})],
);
{
  const ma = manaAbs;
  manaAbs = function(c){ let out = ma(c); if (!S || !c || !S.bf.includes(c)) return out;
    if (isLand(c.k) && rulesOn('allBasic').length) for (const col of ['W', 'U', 'B', 'R', 'G']) if (!out.some(o => o.tapOnly && o.outs.some(x => x.join('') === col))) out = out.concat({cost:'{T}', eff:`Add {${col}}`, rest:'', outs:[[col]], tapOnly:true, line:`{T}: Add {${col}}.`});
    if (isCreatureCard(c) && rulesOn('crMana').length && !out.some(o => o.crm)) out = out.concat({cost:'{T}', eff:'Add one mana of any color', rest:'', outs:manaOuts('Add one mana of any color'), tapOnly:true, line:'{T}: Add one mana of any color.', crm:true});
    if (/Treasure/.test(cname(c) + typeOf(c)) && rulesOn('goldspan').length && !out.some(o => o.gs)) out = out.concat({cost:'{T}, Sacrifice ~', eff:'Add two mana of any one color', rest:'', outs:manaOuts('Add two mana of any one color'), tapOnly:false, line:'{T}, Sacrifice this: Add two mana of any one color.', gs:true});
    return out; };
  const tc = turnChanged;
  turnChanged = function(...a){ const r = tc.apply(this, a); try { if (S && currentTurn()[1] !== MYPID){ const names = rulesOn('selfSeedborn').map(x => x.src); S.bf.forEach(c => { if (names.includes(cname(c))){ c.tap = false; c.tn = 0; } }); } } catch {} return r; };
  const ab = abilityReady;
  abilityReady = function(c, abl, mana){ const r = ab(c, abl, mana); if (r === 'Summoning sick' && rulesOn('abilHaste').length) return ''; return r; };
}
// mana that stays: “you don't lose this mana” and red mana (Birgi, Leyline Tyrant)
{
  const et = engineTick;
  engineTick = function(){ const keep = S && S.pool && (S.keepMana === turnStr() ? {...S.pool} : rulesOn('keepRed').length ? {R:S.pool.R || 0} : null); const r = et(); if (keep && S){ for (const [k, v] of Object.entries(keep)) if (v && !(S.pool[k] > 0)) S.pool[k] = v; } return r; };
}
// opponents' creatures (and artifacts) enter tapped
{
  const oe = onEnter;
  onEnter = function(c, from, o){ const r = oe(c, from, o); try { if (c && S.bf.includes(c) && !isCreatureCard(c) && /Artifact/.test(typeOf(c)) && rulesOn('oppTapped').some(x => x.art)) c.tap = true; } catch {} return r; };
}
// flash this turn
{
  const to = timingOk;
  timingOk = function(c){ const r = to(c); if (r && !r.ok && S && S.flashT === turnStr() && phaseNow().n > 0 && !/split second/i.test(r.why || '')) return {ok:true}; return r; };
}
