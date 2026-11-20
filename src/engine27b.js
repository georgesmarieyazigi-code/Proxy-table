/* ===================== Rules engine — round 27 helper B: the last one-offs (v17 wave) ===================== */
RQ_OPS.push('r27b');
const B27 = { h:{} };
const b27T = ctx => (ctx && ctx.tgts ? nextTargets(ctx) : []);
const b27Src = ctx => srcCardOf(ctx) || (ctx && ctx.it && ctx.it.srcId != null ? find(ctx.it.srcId)[2] : null);
const b27Txt = c => { try { const a = info(c.k); const f = c.fl && a.back ? a.back : a; return tname(f.o || '', f.n || ''); } catch { return ''; } };
// ask another player's client to run sub-handler `sub`; optionally wait for its reply (a list of numbers)
async function b27Ask(pid, sub, n, src, d, wait, ms){
  if (UI.dry || !pid || pid === MYPID) return null;
  const ref = wait ? rid(6) : ''; sendRq(pid, 'r27b', n || 0, src, {ref, d:(sub + '|' + (d || '')).slice(0, 80)}); commit();
  if (!wait) return null;
  const a = await waitUntil(() => R22.ans[ref], ms || 90000); return a ? a.idx : null;
}
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'r27b'){
      const s = String(r.d || ''); const i = s.indexOf('|'); const sub = i < 0 ? s : s.slice(0, i); const rest = i < 0 ? '' : s.slice(i + 1); const h = B27.h[sub];
      (async () => { let out = []; try { if (h) out = (await h(r, from, rest)) || []; } catch (e){ console.warn(e); }
        if (r.ref) sendRq(from, 'r22pickAns', out.length, r.src, {ref:r.ref, d:out.join(',')}); commit(); })();
      return;
    }
    return ao(r, from);
  };
}
// "you may put a land card from your hand onto the battlefield" on this client
async function b27LandFromHand(src){
  const lands = S.hand.filter(c => isLand(c.k)); if (!lands.length || UI.dry) return 0;
  const ids = await pickCards({title:`${src}: you may put a land card from your hand onto the battlefield`, cards:lands, min:0, max:1, noneLabel:"Don't"});
  const c = ids && ids[0] != null && S.hand.find(x => x.id === ids[0]); if (!c) return 0;
  moveCard(c.id, 'bf'); log(`${src}: put ${cname(c)} from their hand onto the battlefield`); commit(); return 1;
}
B27.h.land = async (r) => { draw(1); log(`drew a card (${r.src})`); commit(); return [await b27LandFromHand(r.src)]; };

/* ---------- Astor, Bearer of Blades: Equipment you control have equip {1}; Vehicles have crew 1 (an extra ability) ---------- */
STATIC_RULES.push([/^equipment you control have equip \{(\d+)\}$/, m => ({kind:'b27equip', who:'you', n:+m[1]})]);
{
  const al = abilityList;
  abilityList = function(c){ let out = al(c);
    try { if (S && c && S.bf.includes(c) && !c.fd && /\bEquipment\b/.test(typeOf(c))){
      for (const g of rulesOn('b27equip')){ const cost = `{${g.n}}`; if (!out.some(a => a.equip && a.cost === cost)) out = out.concat({cost, eff:'Attach ~ to target creature you control.', sorc:true, line:`Equip ${cost}`, equip:true, b27g:g.src}); } }
      if (S && c && S.bf.includes(c) && !c.fd && /\bVehicle\b/.test(typeOf(c))){
        for (const g of rulesOn('giveCrew')) if (!out.some(a => a.crew === g.n) && out.some(a => a.crew)) out = out.concat({cost:`Crew ${g.n}`, eff:'~ becomes an artifact creature until end of turn.', sorc:false, line:`Crew ${g.n}`, crew:g.n}); }
    } catch (e){ console.warn(e); }
    return out; };
}

/* ---------- Greymond, Avacyn's Stalwart: choose two of first strike / vigilance / lifelink; Humans you control have them ---------- */
const B27GM = ['first strike', 'vigilance', 'lifelink'];
STATIC_RULES.push([/^humans you control have each of the chosen abilities$/, m => ({kind:'b27gm', who:'you'})]);
{
  const oe = onEnter;
  onEnter = function(c, from, o){ const r = oe(c, from, o);
    try { if (c && S && S.bf.includes(c) && !c.b27gm && /^As ~ enters, choose two abilities from among first strike, vigilance, and lifelink\.?$/m.test(b27Txt(c))){
      c.b27gm = ['first strike', 'vigilance'];
      if (!UI.dry) (async () => { const v = await askChoice({title:`${cname(c)}: choose two abilities for your Humans`, options:[{label:'First strike + vigilance', value:'2'}, {label:'First strike + lifelink', value:'1'}, {label:'Vigilance + lifelink', value:'0'}]});
        const skip = v == null ? 2 : +v; c.b27gm = B27GM.filter((x, i) => i !== skip); log(`${cname(c)}: chose ${c.b27gm.join(' and ')}`); commit(); })(); } } catch (e){ console.warn(e); }
    return r; };
  const cpe = cardPublicExtra;
  cardPublicExtra = function(c){ const o = cpe(c); if (c && Array.isArray(c.b27gm)) o.b27gm = c.b27gm; return o; };
  const ss = sanitizeState;
  sanitizeState = function(s){ const r = ss(s); try { if (r && s && Array.isArray(s.bf)) r.bf.forEach((c, i) => { const o = s.bf[i]; if (o && Array.isArray(o.b27gm)) c.b27gm = o.b27gm.filter(x => B27GM.includes(x)).slice(0, 2); }); } catch {} return r; };
  const kw = kwOf;
  kwOf = function(c, k, pid = MYPID){ const r = kw(c, k, pid); if (r || !S || !c || !c.k || !B27GM.includes(k)) return r;
    try { const p = pid || MYPID; const bf = boardOf(p); if (!bf.includes(c) && p === MYPID && !S.bf.includes(c)) return r;
      if (isCreatureCard(c) && /\bHuman\b/.test(typeOf(c)) && bf.some(g => !g.fd && Array.isArray(g.b27gm) && g.b27gm.includes(k) && /Humans you control have each of the chosen abilities/.test(b27Txt(g)))) return true; } catch {}
    return r; };
}

/* ---------- Jeska, Thrice Reborn: loyalty = times you've cast a commander from the command zone ---------- */
STATIC_RULES.push([/^~ enters with a loyalty counter on (?:her|him|it) for each time you've cast a commander from the command zone this game$/, m => ({kind:'b27jeska', who:'you'})]);
{
  const oe = onEnter;
  onEnter = function(c, from, o){ const r = oe(c, from, o);
    try { if (c && S && S.bf.includes(c) && from !== 'bf' && /^~ enters with a loyalty counter on (?:her|him|it) for each time you've cast a commander from the command zone this game\.?$/m.test(b27Txt(c))){
      const n = Object.values(S.tax || {}).reduce((a, v) => a + (+v || 0), 0); if (n) modCounters(c, 'co', n); log(`${cname(c)} enters with ${n} loyalty (commanders cast from the command zone: ${n})`); } } catch (e){ console.warn(e); }
    return r; };
}

/* ---------- Pendant of Prosperity: enters under the control of an opponent of your choice; its owner also draws ---------- */
STATIC_RULES.push([/^(?:~|this artifact) enters under the control of an opponent of your choice$/, m => ({kind:'b27pendant', who:'you'})]);
{
  const oe = onEnter;
  onEnter = function(c, from, o){
    try { if (c && S && S.bf.includes(c) && !c.own && !c.tok && !UI.dry && /^(?:~|This artifact) enters under the control of an opponent of your choice\.?$/m.test(b27Txt(c))){
      const opps = opponents(); if (opps.length){
        const give = pid => { if (!S.bf.includes(c)) S.bf.push(c); giveAway(c, pid, {}); commit(); };
        if (opps.length === 1) give(opps[0].pid);
        else { S.bf.splice(S.bf.indexOf(c), 1); (async () => { const v = await askChoice({title:`${cname(c)} enters under the control of an opponent of your choice`, options:opps.map(p => ({label:p.nm, value:p.pid}))}); give(v || opps[0].pid); })(); }
        return; } } } catch (e){ console.warn(e); }
    return oe(c, from, o); };
}
async function b27Pendant(ctx){
  const src = b27Src(ctx); const owner = src && src.own ? src.own.pid : MYPID; ctx.b27owner = owner;
  if (owner === MYPID){ draw(1); log(`${ctx.name}: its owner draws a card`); await b27LandFromHand(ctx.name); commit(); return; }
  log(`${ctx.name}: its owner ${nameOf(owner)} draws a card and may put a land onto the battlefield`);
  await b27Ask(owner, 'land', 0, ctx.name, '', true);
}

/* ---------- sentence handlers ---------- */
async function doRound27BPre(s, l, ctx){
  let m; const name = ctx.name;
  // Pendant of Prosperity
  if (/^(?:~|this artifact)'s owner draws a card(?:, then that player may put a land card from their hand onto the battlefield)?$/.test(l)){ await b27Pendant(ctx); return true; }
  if (ctx.b27owner && /^(?:then )?that player may put a land card from their hand onto the battlefield$/.test(l)) return true;
  // Breeches, Brazen Plunderer
  if (/^exile the top card of each of those opponents' libraries$/.test(l)){
    const pids = ((ctx.it && ctx.it.b27dp) || []).filter(p => p && p !== MYPID && OPP.has(p));
    await r21ExileFrom(pids, ctx, {n:1, w:'r'}); ctx.b27br = true; return true; }
  if ((ctx.b27br || ctx.r21) && /^(?:you may )?play those cards this turn, and you may spend mana as though it were mana of any color to cast those spells$/.test(l)){
    const ids = (ctx.r21ids || []).filter(id => S.ex.some(c => c.id === id));
    ids.forEach(id => { const c = S.ex.find(x => x.id === id); if (c) c.mayPlay = {t:turnStr(), cast:false, src:name, u0:S.untapN, any:true}; });
    if (ids.length) log(`${name}: may play ${ids.length === 1 ? 'that card' : 'those cards'} this turn, with mana of any type`); commit(); return true; }
  // Triple Triad
  if (/^each player exiles the top card of their library$/.test(l) && /lesser mana value than it without paying their mana costs/.test(String(ctx.full || '').toLowerCase())){
    const before = (ctx.r21ids || []).length; await r21ExileFrom(players().map(p => p.pid), ctx, {n:1, w:'r'}); ctx.b27tt = (ctx.r21ids || []).slice(before); return true; }
  if (ctx.b27tt && /^until end of turn, you may play the card you own exiled this way(?: and each other card exiled this way with lesser mana value than it without paying their mana costs)?$/.test(l)){
    const cards = ctx.b27tt.map(id => S.ex.find(c => c.id === id)).filter(Boolean);
    const mine = cards.find(c => !c.r21 && !c.own); const mv = c => info(c.k)?.mv || 0;
    if (mine){ mine.mayPlay = {t:turnStr(), cast:false, src:name, u0:S.untapN, free:true}; log(`${name}: may play ${cname(mine)} this turn without paying its mana cost`);
      const lesser = cards.filter(c => c !== mine && mv(c) < mv(mine));
      lesser.forEach(c => { c.mayPlay = {t:turnStr(), cast:false, src:name, u0:S.untapN, free:true}; });
      if (lesser.length) log(`${name}: may also play ${lesser.map(cname).join(', ')} (lesser mana value than ${mv(mine)}) without paying their mana costs`);
      cards.filter(c => c !== mine && !lesser.includes(c) && c.r21 && c.own).forEach(c => r21Drop(c, ''));
    } else { log(`${name}: my library was empty — nothing to play`); cards.filter(c => c.r21 && c.own).forEach(c => r21Drop(c, '')); }
    ctx.b27tt2 = true; commit(); return true; }
  if (ctx.b27tt2 && /^(?:and )?each other card exiled this way with lesser mana value than it without paying their mana costs$/.test(l)) return true;
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound27BPre(s, l, ctx)) return; return ds(s0, ctx); }; }

/* ---------- Breeches: remember which opponents the Pirates damaged ---------- */
{
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    const n0 = S ? S.stk.length : 0; const r = pt(src, t, ev, evPid);
    try { if (t && t.a26mal && S.stk.length > n0){ const ds = [...new Set((UI.curQ || []).filter(([p, e]) => p === MYPID && e.type === 'dmg' && e.dp && e.dp !== MYPID && descOk(e.k, 'pirate')).map(([, e]) => e.dp))]; S.stk[S.stk.length - 1].b27dp = ds; } } catch (e){ console.warn(e); }
    return r; };
}

/* ---------- Shadowgrange Archfiend: "Madness—{2}{B}, Pay 8 life." (engine21b's madness pays the life as an extra cost) ---------- */
{
  const ko = keywordsOnly;
  keywordsOnly = function(l){ if (/^madness—(?:\{[^}]+\})+, pay \d+ life\.?$/i.test(String(l).trim())) return true; return ko(l); };
}

/* ---------- whole-text rewrites ---------- */
const B27RW = [
  [/choose one or more\. Each mode must target a different player\.\n• Target opponent draws three cards, then discards three cards at random\.\n• Target opponent sacrifices a nontoken artifact of their choice\.\n• (?:This creature|~|Balor) deals damage to target opponent equal to the number of cards in their hand\.?/i, 'B27 balor.'],
  [/you may exile one of them from your graveyard\. If you do, you may cast it this turn\.?/i, 'B27 theorist.'],
  [/Choose left or right\. Each player gains control of all nonland permanents other than (?:~|Aminatou(?:, the Fateshifter)?) controlled by the next player in the chosen direction\.?/i, 'B27 aminatou.'],
  [/for each player, choose up to one other target artifact or creature that player controls\. For as long as (?:this creature|~|Kitesail Larcenist) remains on the battlefield, the chosen permanents become Treasure artifacts with "\{T\}, Sacrifice (?:this artifact|~|Kitesail Larcenist): Add one mana of any color" and lose all other abilities\.?/i, 'B27 larcenist.'],
  [/^For each player, choose target nonenchantment, nonland permanent that player controls\. Those permanents' owners shuffle them into their libraries\. Each player who controlled one of those permanents exiles cards from the top of their library until they exile a nonland card, then puts the rest on the bottom of their library in a random order\. Each player may cast the nonland card they exiled without paying its mana cost\.?$/i, 'B27 guff.'],
];
{
  const re = runEffects;
  runEffects = async function(txt, ctx){ let t = String(txt || ''); for (const [r, w] of B27RW) t = t.replace(r, w); return re(t, ctx); };
}

/* ---------- Balor: choose one or more, each mode targets a different opponent ---------- */
const B27BALOR = ['Target opponent draws three cards, then discards three cards at random', 'Target opponent sacrifices a nontoken artifact of their choice', '~ deals damage to target opponent equal to the number of cards in their hand'];
async function b27Balor(ctx){
  const name = ctx.name; if (UI.dry) return;
  const opps = opponents().filter(p => !(p.s && p.s.lost)); if (!opps.length) return;
  const picks = []; const used = new Set(); const max = Math.min(3, opps.length);
  while (picks.length < max){
    const opts = B27BALOR.map((t, j) => ({label:t.replace(/~/g, name), value:j, disabled:picks.some(p => p.m === j)}));
    if (picks.length) opts.push({label:"That's all", value:'done'});
    const mi = await askChoice({title:`${name}: choose ${picks.length ? 'another mode' : 'one or more modes'} (each targets a different opponent)`, options:opts});
    if (mi == null || mi === 'done') break;
    const left = opps.filter(p => !used.has(p.pid));
    const pid = left.length === 1 ? left[0].pid : await askChoice({title:`${name}: ${B27BALOR[mi].replace(/~/g, name)} — which opponent?`, options:left.map(p => ({label:p.nm, value:p.pid}))});
    if (pid == null) break; used.add(pid); picks.push({m:mi, pid});
  }
  const src = b27Src(ctx);
  for (const {m:mi, pid} of picks){
    if (mi === 0){ sendRq(pid, 'draw', 3, name); sendRq(pid, 'g23discRand', 3, name); log(`${name}: ${nameOf(pid)} draws three cards, then discards three at random`); }
    if (mi === 1){ sendRq(pid, 'sac', 1, name, {d:'nontoken artifact'}); log(`${name}: ${nameOf(pid)} sacrifices a nontoken artifact`); }
    if (mi === 2){ const n = OPP.get(pid)?.hc || 0; if (n) dealDamage({t:'player', pid}, n, ctx.k, src && S.bf.includes(src) ? src : null); log(`${name} deals ${n} damage to ${nameOf(pid)} (cards in their hand)`); }
  }
  commit();
}

/* ---------- Conspiracy Theorist: whenever you discard one or more nonland cards ---------- */
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){
    if (w === 'whenever' && /^you discard one or more nonland cards$/.test(c)) return {ev:'discard', subj:'any', ctl:'you', desc:'', batch:true, b27ct:true};
    if (w === 'whenever' && /^~ attacks or dies$/.test(c)) return {ev:'attack', evs:['die'], subj:'self', ctl:'you', desc:''};
    if (w === 'when' && /^a legendary creature you control attacks and isn't blocked$/.test(c)) return {ev:'b27unbl', subj:'any', ctl:'you', desc:'legendary creature', b27senu:true};
    return ct(w, c); };
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    try {
      if (t && t.b27ct){ const ids = (UI.curQ || []).filter(([p, e]) => p === MYPID && e.type === 'discard' && e.k && !isLand(e.k)).map(([, e]) => e.id); if (!ids.length) return;
        const n0 = S.stk.length; pt(src, t, ev, evPid); if (S.stk.length > n0) S.stk[S.stk.length - 1].b27ids = ids; return; }
      if (t && t.b27senu){ if (!src || !S.ex.some(c => c.id === src.id)) return; const n0 = S.stk.length; pt(src, t, ev, evPid); if (S.stk.length > n0){ const a = S.bf.find(b => ev && b.id === ev.id); S.stk[S.stk.length - 1].b27atk = a && a.atk || ''; } return; }
    } catch (e){ console.warn(e); }
    return pt(src, t, ev, evPid); };
}
async function b27Theorist(ctx){
  const ids = (ctx.it && ctx.it.b27ids) || []; const cards = S.gy.filter(c => ids.includes(c.id)); if (!cards.length || UI.dry) return;
  const pick = await pickCards({title:`${ctx.name}: you may exile one of them from your graveyard — you may cast it this turn`, cards, min:0, max:1, noneLabel:"Don't exile"});
  const c = pick && pick[0] != null && S.gy.find(x => x.id === pick[0]); if (!c) return;
  moveCard(c.id, 'ex', {quiet:true}); const e = S.ex.find(x => x.id === c.id);
  if (e){ e.mayPlay = {t:turnStr(), cast:true, src:ctx.name, u0:S.untapN}; log(`${ctx.name}: exiled ${cname(e)} — may cast it this turn`); }
  commit();
}

/* ---------- Senu, Keen-Eyed Protector: triggers from exile when a legendary creature you control attacks and isn't blocked ---------- */
EV_TYPES.push('b27unbl');
{
  const ss = setStep;
  setStep = function(step){ const r = ss(step);
    try { if (step === 'blkd' && S && S.cb && !UI.dry && phaseNow().mine){ const key = S.cb.t + ':' + (S.cb.n || 0); if (B27.unblK !== key){ B27.unblK = key; const bl = blockersFor();
      S.bf.filter(c => c.atk && !c.fd && !(bl.get(c.id) || []).length).forEach(c => emit({type:'b27unbl', k:c.k, id:c.id})); } } } catch (e){ console.warn(e); }
    return r; };
  const he = handleEvent;
  handleEvent = function(pid, ev){ const r = he(pid, ev);
    try { if (S && pid === MYPID && ev && ev.type === 'b27unbl' && descOk(ev.k, 'legendary creature')){
      for (const c of S.ex.slice()){ if (c.fd || !c.k) continue; for (const t of trigsOf(c.k, false)) if (t.b27senu) pushTrigger({k:c.k, id:c.id, fl:false}, t, ev, pid); } } } catch (e){ console.warn(e); }
    return r; };
}
async function b27Senu(ctx){
  const id = ctx.it && ctx.it.srcId; const c = S.ex.find(x => x.id === id); if (!c){ log(`${ctx.name} isn't exiled — nothing happens`); return; }
  if (UI.dry) return;
  moveCard(c.id, 'bf'); const b = S.bf.find(x => x.id === c.id); if (!b) return;
  let atk = ctx.it.b27atk || ''; if (!atk){ const o = opponents()[0]; if (o) atk = 'p:' + o.pid; }
  b.atk = atk; b.sk = true; log(`${cname(b)} is put onto the battlefield attacking`); commit();
}

/* ---------- Tato Farmer: a land card in a graveyard that was milled this turn ---------- */
{
  const tk = takeCard;
  takeCard = function(r, from){ const n0 = S.bf.length; const out = tk(r, from); try { if (r && /^j:(?:.*;)?b27tap=1/.test(String(r.d || '')) && S.bf.length > n0){ const c = S.bf[S.bf.length - 1]; c.tap = true; commit(); } } catch {} return out; };
}

/* ---------- Fabricate N (702.123) and Cayth, Famed Mechanist's grant ---------- */
STATIC_RULES.push([/^other nontoken creatures you control have fabricate (\d+)$/, m => ({kind:'b27fab', who:'you', n:+m[1]})]);
{
  const tg = trigsOf;
  trigsOf = function(k, fl){ const out = tg(k, fl); if (out.b27fab) return out; out.b27fab = true;
    try { const a = info(k); const f = a ? (fl && a.back ? a.back : a) : null; const m = f && tname(f.o, f.n).match(/^(?:[a-z ]+, )*fabricate (\d+)$/im); if (m) out.push({ev:'enter', subj:'self', ctl:'you', desc:'', eff:`B27 fabricate ${m[1]}.`, raw:'fabricate ' + m[1]}); } catch {}
    return out; };
  const oe = onEnter;
  onEnter = function(c, from, o){ const r = oe(c, from, o);
    try { if (c && S && from !== 'bf' && S.bf.includes(c) && !c.tok && !c.fd && isCreatureCard(c) && !UI.dry){
      for (const g of S.bf){ if (g === c || g.fd || !g.k) continue; const m = b27Txt(g).match(/^Other nontoken creatures you control have fabricate (\d+)\.?$/m); if (m) pushTrig(cname(c), `B27 fabricate ${m[1]}.`, {k:c.k, srcId:c.id, b27by:cname(g)}); } } } catch (e){ console.warn(e); }
    return r; };
}
async function b27Fabricate(n, ctx){
  const src = b27Src(ctx); const onBf = src && S.bf.includes(src);
  let counters = false;
  if (onBf) counters = UI.dry ? true : (await askChoice({title:`${cname(src)} — fabricate ${n}`, options:[{label:`Put ${n} +1/+1 counter${n === 1 ? '' : 's'} on it`, value:'c'}, {label:`Create ${n} 1/1 Servo${n === 1 ? '' : 's'}`, value:'s'}]})) !== 's';
  if (counters){ modCounters(src, 'cp', n); log(`${cname(src)}: fabricate — ${n} +1/+1 counter${n === 1 ? '' : 's'}`); }
  else await createFromText(`Create ${n === 1 ? 'a' : n} 1/1 colorless Servo artifact creature token${n === 1 ? '' : 's'}`, ctx);
  commit();
}

/* ---------- Umbra armor (702.89) and Umbra Mystic ---------- */
STATIC_RULES.push([/^auras attached to permanents you control have umbra armor$/, m => ({kind:'b27umbra', who:'you'})]);
function b27UmbraAuras(c){
  const out = []; if (!c) return out; const mystic = rulesOn('b27umbra').length > 0;
  for (const b of boardsAll()) for (const a of b.bf){ if (!a.k || a.fd || !a.att || a.att.id !== c.id || (a.att.pid || b.pid) !== MYPID) continue; if (!/\bAura\b/.test(typeOf(a))) continue;
    if (mystic || /^(?:umbra|totem) armor$/im.test(b27Txt(a))) out.push({a, pid:b.pid}); }
  return out;
}
function b27UmbraSave(c){
  try { if (!S || !c || !S.bf.includes(c)) return false; const list = b27UmbraAuras(c); if (!list.length) return false;
    const {a, pid} = list[0]; c.dmg = 0; c.dtd = 0;
    log(`${cname(c)} would be destroyed — umbra armor: ${cname(a)} is destroyed instead and the damage is removed`);
    if (pid === MYPID) destroyCard(a, 'umbra armor'); else applyTo({t:'card', pid, id:a.id, k:a.k}, {op:'destroy', src:'umbra armor'});
    commit(); return true; } catch (e){ console.warn(e); return false; }
}
{
  const dc = destroyCard;
  destroyCard = function(c, why){ if (S && c && S.bf.includes(c) && !kwOf(c, 'indestructible') && b27UmbraAuras(c).length && b27UmbraSave(c)) return; return dc(c, why); };
  const rd = r26Deaths;
  r26Deaths = function(){ let ch = false; try { for (const {c, why} of r26Doomed()) if (why === 'd' && !(c.regen > 0) && b27UmbraAuras(c).length && b27UmbraSave(c)) ch = true; } catch (e){ console.warn(e); } return rd() || ch; };
}

/* ---------- Offering (702.48): "[quality] offering" ---------- */
function b27OfferQ(c){ const m = c && c.k ? tname(info(c.k)?.o || '', info(c.k)?.n || '').match(/^([a-z]+(?: [a-z]+)?) offering$/im) : null; return m ? m[1].toLowerCase() : ''; }
function b27OfferWhy(c){ const q = b27OfferQ(c); if (!q) return 'no offering'; const top = stackTop(); if (top && top.ss) return 'split second';
  if (!S.bf.some(b => !b.fd && b.k && descOk(b.k, q, {tok:b.tok}))) return `you control no ${q}`; return ''; }
function b27Reduce(cost, m){
  const a = parseCost(m || ''); const r = {...cost, col:{...cost.col}};
  r.gen = Math.max(0, r.gen - (a.gen || 0));
  for (const x of MANA){ const n = a.col[x] || 0; if (!n) continue; const use = Math.min(n, r.col[x] || 0); r.col[x] = (r.col[x] || 0) - use; r.gen = Math.max(0, r.gen - (n - use)); }
  for (const h of (a.hyb || [])){ const cs = String(h).replace(/[^WUBRGC]/g, '').split(''); const x = cs.find(y => (r.col[y] || 0) > 0); if (x) r.col[x]--; else r.gen = Math.max(0, r.gen - 1); }
  for (const p of (a.phy || [])){ const x = String(p).replace(/[^WUBRG]/g, '')[0]; if (x && (r.col[x] || 0) > 0) r.col[x]--; else r.gen = Math.max(0, r.gen - 1); }
  return r;
}
{
  const hi = r8HandItems;
  r8HandItems = function(c, zone){ let s = hi(c, zone);
    try { if (zone === 'hand' && S && phaseNow().n > 0 && b27OfferQ(c)){ const why = b27OfferWhy(c); s += `<button type="button" data-act="b27off" data-id="${c.id}" ${why ? 'disabled' : ''}><span>Cast — ${esc(b27OfferQ(c))} offering (any time; sacrifice one, minus its mana cost)${why ? `<small class="why">${esc(why)}</small>` : ''}</span></button>`; } } catch {}
    return s; };
  Object.assign(ACT, { b27off(el){ const [z,,c] = find(+el.dataset.id); closeMenu(); if (!c || z !== 'hand') return; const why = b27OfferWhy(c); if (why){ toast(why); return; } b27CastOffering(c); } });
  const xp0 = extraPayments;
  extraPayments = async function(c, sc){
    const f = UI.b27off && c && UI.b27off.cid === c.id ? UI.b27off : null; if (!f) return xp0(c, sc);
    const list = S.bf.filter(b => !b.fd && b.k && descOk(b.k, f.q, {tok:b.tok})); if (!list.length) return false;
    const ids = list.length === 1 ? [list[0].id] : await pickCards({title:`${cname(c)} — ${f.q} offering: sacrifice which? (its mana cost is subtracted)`, cards:list, min:1, max:1}); if (!ids || ids[0] == null) return false;
    const b = S.bf.find(x => x.id === ids[0]); if (!b) return false; const m = b.tok ? '' : (info(b.k)?.m || '');
    const red = b27Reduce(sc.cost, m); Object.assign(sc.cost, red); sc.notes.push(`offering −${m || '{0}'}`);
    const base = await xp0(c, sc); if (base === false) return false;
    return {apply(){ if (base) base.apply(); const bb = S.bf.find(x => x.id === ids[0]); if (bb){ sacrificeOne(bb); log(`sacrificed ${cname(bb)} for ${cname(c)}'s offering`); } }};
  };
}
async function b27CastOffering(c){ UI.b27off = {cid:c.id, q:b27OfferQ(c)}; UI.r21bany = true; try { await beginCast(c, 'hand', {}); } finally { UI.b27off = null; UI.r21bany = false; } }
{
  const ko = keywordsOnly;
  keywordsOnly = function(l){ if (/^[a-z]+(?: [a-z]+)? offering$/i.test(String(l).trim())) return true; return ko(l); };
}

/* ---------- Professor Hojo: the first activated ability you activate during your turn that targets a creature you control costs {2} less ---------- */
STATIC_RULES.push([/^the first activated ability you activate during your turn that targets a creature you control costs \{(\d+)\} less to activate$/, m => ({kind:'b27hojo', who:'you', n:+m[1]})]);
function b27TgMine(){ return (UI.n24lastT || []).flat(2).filter(Boolean).some(t => t.t === 'card' && t.pid === MYPID && (() => { const c = S.bf.find(b => b.id === t.id); return c && isCreatureCard(c); })()); }
{
  const adj = n24adjCost;
  n24adjCost = function(c, cost, ab, isMana){ let out = adj(c, cost, ab, isMana);
    try { if (!isMana && ab && S && n24myTurn() && S.b27hojo !== turnStr()){ const rs = rulesOn('b27hojo'); const tg = UI.n24lastT ? b27TgMine() : /target creature you control|attach ~ to target creature you control/i.test(String(ab.eff || ''));
      if (rs.length && tg){ const n = rs.reduce((a, r) => a + r.n, 0); const g = n24genOf(out); if (g) out = n24setGeneric(out, Math.max(0, g - n)); } } } catch (e){ console.warn(e); }
    return out; };
  const pac = payAbilityCost;
  payAbilityCost = async function(c, cost, o = {}){ const ok = await pac(c, cost, o); try { if (ok && !o.mana && N24AB && S && n24myTurn() && b27TgMine()) S.b27hojo = turnStr(); } catch {} return ok; };
}

/* ---------- Sokrates, Athenian Teacher: the granted combat-damage replacement ---------- */
B27.h.sok = async (r) => { const c = S.bf.find(b => b.id === r.tid); if (c){ c.b27sok = turnStr(); log(`${cname(c)} gains Sokrates's dialogue until end of turn (${r.src})`); commit(); } return []; };
{
  const dd = dealDamage;
  dealDamage = function(t, n, srcK, srcCard, extra = {}){
    try { if (S && n > 0 && t && t.t === 'player' && srcCard && S.bf.includes(srcCard) && srcCard.b27sok === turnStr() && (UI.r23cmb || UI.h23combat)){
      const h = Math.floor(n / 2); log(`${cname(srcCard)}'s combat damage to ${t.pid === MYPID ? 'me' : nameOf(t.pid)} is prevented — each of us draws ${h}`);
      if (h){ draw(h); if (t.pid && t.pid !== MYPID) sendRq(t.pid, 'draw', h, cname(srcCard)); else draw(h); }
      commit(); return 0; } } catch (e){ console.warn(e); }
    return dd(t, n, srcK, srcCard, extra); };
}

/* ---------- Aminatou, the Fateshifter −6 ---------- */
B27.h.amin = async (r, from, rest) => { const [sid, to, keep] = rest.split('|'); b27AminGive(sid, to, keep ? +keep : null, r.src); commit(); return []; };
function b27AminGive(sid, to, keepId, src){
  if (!to || to === MYPID) return 0;
  const list = S.bf.filter(c => c.k && !isLand(c.k) && c.id !== keepId && c.b27amT !== sid);
  list.forEach(c => giveAway(c, to, {b27am:sid}));
  if (list.length) log(`${src}: ${nameOf(to)} gains control of my ${list.length} nonland permanent${list.length === 1 ? '' : 's'}`);
  return list.length;
}
{
  const tk = takeCard;
  takeCard = function(r, from){ const n0 = S.bf.length; const out = tk(r, from); try { if (r && r.f && r.f.b27am && S.bf.length > n0) S.bf[S.bf.length - 1].b27amT = String(r.f.b27am).slice(0, 12); } catch {} return out; };
}
async function b27Aminatou(ctx){
  const name = ctx.name; const src = b27Src(ctx); if (UI.dry) return;
  const dir = await askChoice({title:`${name}: choose left or right`, options:[{label:'Left', value:'left'}, {label:'Right', value:'right'}]}) || 'left';
  const back = dir === 'left' ? 'right' : 'left'; const sid = rid(5);
  log(`${name}: chose ${dir} — each player gains control of the nonland permanents of the next player to the ${dir}`);
  for (const p of opponents()) await b27Ask(p.pid, 'amin', 0, name, `${sid}|${c2Nearest(p.pid, back) || ''}|`, false);
  b27AminGive(sid, c2Nearest(MYPID, back), src ? src.id : null, name); commit();
}

/* ---------- Kitesail Larcenist: the chosen permanents are Treasures for as long as it remains on the battlefield ---------- */
{
  const lv = l24live;
  l24live = function(m){ const u = m && m.u || ''; if (u[0] === 'b'){ const [pid, id, et] = u.slice(1).split('|'); try { const c = boardOf(pid).find(b => String(b.id) === id); return !!(c && !c.fd && String(c.b27et || '') === et); } catch { return false; } } return lv(m); };
  const oe = onEnter;
  onEnter = function(c, from, o){ const r = oe(c, from, o); try { if (c && S && from !== 'bf' && /remains on the battlefield, the chosen permanents become Treasure artifacts/.test(b27Txt(c))) c.b27et = rid(4); } catch {} return r; };
  const cpe = cardPublicExtra;
  cardPublicExtra = function(c){ const o = cpe(c); if (c && c.b27et) o.b27et = c.b27et; return o; };
  const ss = sanitizeState;
  sanitizeState = function(s){ const r = ss(s); try { if (r && s && Array.isArray(s.bf)) r.bf.forEach((c, i) => { const o = s.bf[i]; if (o && typeof o.b27et === 'string') c.b27et = o.b27et.replace(/[^a-z0-9]/gi, '').slice(0, 12); }); } catch {} return r; };
}
async function b27Larcenist(ctx){
  const name = ctx.name; const src = b27Src(ctx); if (!src || !S.bf.includes(src) || UI.dry) return;
  if (!src.b27et) src.b27et = rid(4);
  const mod = {s:name, u:`b${MYPID}|${src.id}|${src.b27et}`, setC:['Artifact'], setSub:['Treasure'], noAb:1, ab:['{T}, Sacrifice this artifact: Add one mana of any color.']};
  for (const p of players()){
    const cands = boardOf(p.pid).filter(b => b.k && !b.fd && !(p.me && b.id === src.id) && /\b(Artifact|Creature)\b/.test(typeOf(b)) && (p.me || !(kwOf(b, 'hexproof', p.pid) || kwOf(b, 'shroud', p.pid))));
    if (!cands.length) continue;
    const ids = await pickCards({title:`${name}: choose up to one artifact or creature ${p.me ? 'you control' : nameOf(p.pid) + ' controls'} — it becomes a Treasure`, cards:cands, min:0, max:1, noneLabel:'None'});
    const c = ids && ids[0] != null && cands.find(x => x.id === ids[0]); if (!c) continue;
    l24modTo({t:'card', pid:p.pid, id:c.id, k:c.k}, mod, name); log(`${name}: ${cname(c)} becomes a Treasure artifact with no other abilities while ${name} remains`);
  }
  commit();
}

/* ---------- Guff Rewrites History ---------- */
async function b27GuffSelf(id, src){
  const c = S.bf.find(b => b.id === id); if (!c || c.fd || isLand(c.k) || /\bEnchantment\b/.test(typeOf(c))) return;
  if (c.own){ sendBack(c, 'lib'); } else { moveCard(c.id, 'lib', {quiet:true}); shuffleLib(); }
  log(`${src}: ${cname(c)} was shuffled into its owner's library`);
  const {hit, rest} = await revealUntil(x => !isLand(x.k), src); bottomRandom(rest);
  if (hit && S.ex.includes(hit) && await askYes(`${src}: cast ${cname(hit)} without paying its mana cost?`, 'Cast it', "Don't")) await a26Free(hit, 'ex');
  commit();
}
B27.h.guff = async (r) => { await b27GuffSelf(r.tid, r.src); return []; };
async function b27Guff(ctx){
  const name = ctx.name; if (UI.dry) return; const picks = [];
  for (const p of players()){
    const cands = boardOf(p.pid).filter(b => b.k && !b.fd && !isLand(b.k) && !/\bEnchantment\b/.test(typeOf(b)) && (p.me || !(kwOf(b, 'hexproof', p.pid) || kwOf(b, 'shroud', p.pid))));
    if (!cands.length) continue;
    const ids = cands.length === 1 ? [cands[0].id] : await pickCards({title:`${name}: choose target nonenchantment, nonland permanent ${p.me ? 'you control' : nameOf(p.pid) + ' controls'}`, cards:cands, min:1, max:1});
    const c = ids && ids[0] != null && cands.find(x => x.id === ids[0]); if (c) picks.push({pid:p.pid, id:c.id, nm:cname(c)});
  }
  if (picks.length) log(`${name}: ${picks.map(x => x.nm).join(', ')} will be shuffled away`);
  for (const x of picks) if (x.pid !== MYPID) { sendRq(x.pid, 'r27b', 0, name, {tid:x.id, d:'guff|'}); }
  commit();
  const me = picks.find(x => x.pid === MYPID); if (me) await b27GuffSelf(me.id, name);
}

/* ---------- sentence handlers (2) ---------- */
async function doRound27BPre2(s, l, ctx){
  let m; const name = ctx.name;
  if (l === 'b27 balor'){ await b27Balor(ctx); return true; }
  if (l === 'b27 theorist'){ await b27Theorist(ctx); return true; }
  if (l === 'b27 aminatou'){ await b27Aminatou(ctx); return true; }
  if (l === 'b27 larcenist'){ await b27Larcenist(ctx); return true; }
  if (l === 'b27 guff'){ await b27Guff(ctx); return true; }
  if ((m = l.match(/^b27 fabricate (\d+)$/))){ await b27Fabricate(+m[1], ctx); return true; }
  if (/^if (?:~|this card|[a-z ,'-]+?) is exiled, put it onto the battlefield attacking$/.test(l) && ctx.it && (ctx.it.b27atk !== undefined || UI.dry)){ await b27Senu(ctx); return true; }
  // Tato Farmer
  if (/^put target land card in a graveyard that was milled this turn onto the battlefield tapped under your control$/.test(l)){
    const t = b27T(ctx).find(x => x.t === 'card' || x.t === 'gy'); if (!t) return true;
    if (!isLand(t.k)){ log(`${name}: that isn't a land card`); return true; }
    if (!c2MilledNow(t)){ log(`${name}: ${t.nm || 'that card'} wasn't milled this turn — no effect`); return true; }
    if (t.pid === MYPID){ const c = c2MyGy(t); if (c){ moveCard(c.id, 'bf'); const b = S.bf.find(x => x.id === c.id); if (b) b.tap = true; log(`${name}: put ${cname(c)} onto the battlefield tapped`); } }
    else { sendRq(t.pid, 'jGyTake', 0, name, {d:'b27tap=1|' + t.k}); log(`${name}: takes ${t.nm} from ${nameOf(t.pid)}'s graveyard onto the battlefield tapped`); }
    commit(); return true; }
  // Sokrates, Athenian Teacher
  if (/^until end of turn, target creature gains "if (?:this creature|~|[^"]+?) would deal combat damage to a player, prevent that damage[.\u2024] (?:this creature|~|[^"]+?)'s controller and that player each draw half that many cards, rounded down[.\u2024]?"$/.test(l)){
    const t = b27T(ctx).find(x => x.t === 'card'); if (!t) return true;
    if (t.pid === MYPID || !t.pid){ const c = S.bf.find(b => b.id === t.id); if (c){ c.b27sok = turnStr(); log(`${name}: ${cname(c)} gains the dialogue until end of turn`); } }
    else sendRq(t.pid, 'r27b', 0, name, {tid:t.id, d:'sok|'});
    commit(); return true; }
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound27BPre2(s, l, ctx)) return; return ds(s0, ctx); }; }

/* ---------- Share the Spoils ---------- */
// Cards exiled with it stay in their OWNERS' exile, tagged c.b27sts = key ('<controller pid>|<StS id>|<entry stamp>').
// The owner lends each tagged card to every other player (engine21e lending, permission "play, any mana, while exiled");
// every client gates those permissions: only during your own turn, once per turn, and only while that Share the Spoils is on the battlefield.
STATIC_RULES.push([/^during each player's turn, that player may play a land or cast a spell from among cards exiled with ~, and they may spend mana as though it were mana of any color to cast that spell$/, m => ({kind:'b27sts', who:'all'})],
  [/^when they do, exile the top card of their library$/, m => ({kind:'b27sts2', who:'all'})]);
const B27STS_RE = /^During each player's turn, that player may play a land or cast a spell from among cards exiled with ~/m;
function b27StsLive(key){ const [pid, id, et] = String(key || '').split('|'); try { const c = boardOf(pid).find(b => String(b.id) === id); return !!(c && !c.fd && String(c.b27et || '') === et); } catch { return false; } }
const b27StsKey = mp => mp && typeof mp.src === 'string' && mp.src.startsWith('StS|') ? mp.src.slice(4) : '';
function b27StsTag(c, key){
  if (!c) return; c.b27sts = key; c.mayPlay = {adv:true, cast:false, any:true, src:'StS|' + key, u0:S.untapN, t:turnStr()};
  for (const p of opponents()) r21Lend(c, p.pid, '', 'pal', 'StS|' + key);
}
function b27StsExileTop(key, src){ const c = S.lib[0]; if (!c){ log(`${src}: my library is empty`); return null; } moveCard(c.id, 'ex', {quiet:true}); const e = S.ex.find(x => x.id === c.id); if (e){ b27StsTag(e, key); log(`${src}: exiled ${cname(e)} from the top of my library`); } commit(); return e; }
B27.h.stsEx = async (r, from, rest) => { b27StsExileTop(rest, r.src); return []; };
function b27StsUnlend(c){ const refs = S.lent.filter(l => l.card === c).map(l => l.ref); S.lent = S.lent.filter(l => l.card !== c); refs.forEach(r21Unlist); }
{
  const oe = onEnter;
  onEnter = function(c, from, o){ const r = oe(c, from, o); try { if (c && S && from !== 'bf' && B27STS_RE.test(b27Txt(c))) c.b27et = rid(4); } catch {} return r; };
  const ew = exWindowOk;
  exWindowOk = function(c){ const key = b27StsKey(c && c.mayPlay); if (!key) return ew(c);
    if (currentTurn()[1] !== MYPID || S.b27stsT === turnStr() || !b27StsLive(key)) return false; return ew(c); };
  // a card played this way: once per turn, and its reflexive trigger exiles the top card of my library
  const done = (c, key) => { S.b27stsT = turnStr(); if (c && c.b27sts) b27StsUnlend(c); const nm = (boardOf(key.split('|')[0]).find(b => String(b.id) === key.split('|')[1]) || {}).k; b27StsExileTop(key, nm ? info(nm)?.n : 'Share the Spoils'); };
  const bc = beginCast;
  beginCast = async function(c, zone, o = {}){ const key = zone === 'ex' && c ? b27StsKey(c.mayPlay) : ''; const r = await bc(c, zone, o); try { if (key && !S.ex.includes(c)) done(c, key); } catch (e){ console.warn(e); } return r; };
  const pl = playLand;
  playLand = function(c, o){ const key = c && S.ex.includes(c) ? b27StsKey(c.mayPlay) : ''; const r = pl(c, o); try { if (key && !S.ex.includes(c)) done(c, key); } catch (e){ console.warn(e); } return r; };
  // owner: when one player casts a tagged card, nobody else can any more
  const ao = applyOp;
  applyOp = function(r, from){ try { if (r && r.op === 'r21cast'){ const l = S.lent.find(x => x.ref === r.ref); if (l && l.card && l.card.b27sts){ const c = l.card; const others = S.lent.filter(x => x.card === c && x.ref !== r.ref); S.lent = S.lent.filter(x => !(x.card === c && x.ref !== r.ref)); others.forEach(x => r21Unlist(x.ref)); } } } catch (e){ console.warn(e); } return ao(r, from); };
  // "whenever an opponent loses the game"
  const ep = enginePublic;
  enginePublic = function(){ const o = ep(); try { if (S && S.lost) o.b27lost = 1; } catch {} return o; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); try { if (s && s.b27lost) o.b27lost = 1; } catch {} return o; };
  const ors = onRemoteState;
  onRemoteState = function(pid, s){ B27.lost = B27.lost || {}; const was = !!B27.lost[pid]; const r = ors(pid, s);
    try { const now = !!(s && s.b27lost); B27.lost[pid] = now; if (!was && now && S && !UI.dry) for (const c of S.bf) if (!c.fd && c.k && /whenever an opponent loses the game, exile the top card of each player's library/i.test(b27Txt(c))) pushTrig(cname(c), "Exile the top card of each player's library.", {k:c.k, srcId:c.id}); } catch (e){ console.warn(e); }
    return r; };
}
async function b27StsTrigger(ctx){
  const src = b27Src(ctx); if (!src || !S.bf.includes(src)){ log(`${ctx.name} isn't on the battlefield — nothing is exiled with it`); return; }
  if (!src.b27et) src.b27et = rid(4); const key = `${MYPID}|${src.id}|${src.b27et}`;
  b27StsExileTop(key, ctx.name);
  for (const p of opponents()) if (!(p.s && p.s.b27lost)) await b27Ask(p.pid, 'stsEx', 0, ctx.name, key, false);
  commit();
}
{
  const pre = doRound27BPre2;
  doRound27BPre2 = async function(s, l, ctx){ if (/^exile the top card of each player's library$/.test(l) && B27STS_RE.test(tname(info(ctx.k)?.o || '', info(ctx.k)?.n || ''))){ await b27StsTrigger(ctx); return true; } return pre(s, l, ctx); };
}

/* ---------- per-player targets are chosen by the handlers above (one per player / per mode), not by the generic one-target prompt ---------- */
{
  const ts = targetSpecs;
  targetSpecs = function(t){ const s = String(t || '');
    if (/for each player, choose (?:up to one other )?target [^.]*? that player controls/i.test(s) || /^B27 (?:guff|larcenist|balor)\.?$/i.test(s.trim()) || /choose one or more\. Each mode must target a different player/i.test(s)) return [];
    return ts(t); };
}
{ const d0 = l24describe; l24describe = function(mod){ if (mod && String(mod.u || '')[0] === 'b') return d0({...mod, u:''}) + ` for as long as ${mod.s || 'its source'} remains on the battlefield`; return d0(mod); }; }
