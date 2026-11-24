/* ===================== Rules engine — round 9: the real Oracle text of the top commanders ===================== */
// Built from the actual Scryfall wording of the EDHREC top 100 + Duel Commander metagame (fetched Nov 2026).
// Short names ("Edgar attacks"), life-loss / discard / mill / search / crime / tempt / roll triggers, "the Nth time this
// ability resolved", amass, the Ring, explore, connive, earthbend, firebending, mobilize, crew, station, convert, finality
// counters, Roles, voting, and a long tail of one-off sentences from those cards.

/* ---------- Plumbing: new event types travel between players ---------- */
EV_TYPES.push('loselife', 'discard', 'mill', 'search', 'tempt', 'roll', 'crime', 'ctrm', 'tgt', 'exiled', 'sagaend', 'bend', 'land', 'togy', 'dealt', 'explore');
RQ_OPS.push('blight', 'vote');

/* ---------- Life gained / lost this turn (and the “loses life” event) ---------- */
function lifeT(){ if (!S) return {g:0, l:0, f:0}; if (!S.lt || S.lt.t !== turnStr()) S.lt = {t:turnStr(), g:0, l:0, f:0}; return S.lt; }
function lifeWatch(){
  if (!S || UI.dry) return;
  const was = UI.lastLife; UI.lastLife = S.life;
  if (was == null || UI.lifeGame !== S.gid) { UI.lifeGame = S.gid; return; }
  const d = S.life - was; if (!d) return;
  const lt = lifeT();
  if (d > 0) lt.g += d;
  else { lt.l += -d; lt.f++; emit({type:'loselife', amt:-d, cnt:1, x:lt.f === 1 ? 1 : 0}); }
}
{
  const cm = commit;
  commit = function(...a){ try { lifeWatch(); } catch (e){ console.warn(e); } return cm.apply(this, a); };
  const ep = enginePublic;
  enginePublic = function(){ const o = ep(); const lt = lifeT(); o.lt = {t:lt.t, g:lt.g, l:lt.l}; o.ring = S.ring || 0; return o; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); const n = v => Number.isFinite(v) ? Math.max(0, Math.min(999, v)) : 0;
    o.lt = s.lt && typeof s.lt === 'object' ? {t:String(s.lt.t || '').slice(0, 20), g:n(s.lt.g), l:n(s.lt.l)} : null; o.ring = n(s.ring); return o; };
}
const lostThisTurn = pid => { if (pid === MYPID) return lifeT().l; const s = OPP.get(pid); return s && s.lt && s.lt.t === turnStr() ? s.lt.l : 0; };

/* ---------- Counting: more phrases ---------- */
{
  const co = countOf;
  countOf = function(phrase, ctx){
    const p = String(phrase || '').toLowerCase().trim().replace(/\.$/, '').replace(/^the number of /, ''); let m;
    if (/^(?:the )?amount of life you gained this turn$/.test(p)) return lifeT().g;
    if (/^(?:the )?amount of life you lost this turn$/.test(p)) return lifeT().l;
    if (/^(?:the )?amount of damage dealt$/.test(p) && ctx && ctx.it && ctx.it.evN) return ctx.it.evN;
    if (/^(?:the )?amount of mana spent to cast (?:her|him|it|~)$/.test(p)){ const c = ctx && srcCardOf(ctx); return c && c.spent != null ? c.spent : (info(ctx && ctx.k)?.mv || 0); }
    if ((m = p.match(/^(experience|energy|rad|poison) counters you have$/))) return (S.pc || {})[m[1]] || 0;
    if ((m = p.match(/^creatures you control with power (\d+) or (less|greater)$/))) return S.bf.filter(c => isCreatureCard(c) && !c.fd).reduce((a, c) => { const pw = stats(c)[0]; return a + ((m[2] === 'less' ? pw <= +m[1] : pw >= +m[1]) ? (c.n || 1) : 0); }, 0);
    if (/^creatures? you control with toughness greater than (?:its|their) power$/.test(p)) return S.bf.filter(c => isCreatureCard(c) && !c.fd).reduce((a, c) => { const s = stats(c); return a + (s[1] > s[0] ? (c.n || 1) : 0); }, 0);
    if (/^equipped attacking creatures you control$/.test(p)) return S.bf.filter(c => isCreatureCard(c) && c.atk && S.bf.some(e => e.att && e.att.id === c.id && /Equipment/.test(typeOf(e)))).length;
    if (/^planeswalker types among planeswalkers you control$/.test(p)) return new Set(S.bf.filter(c => /Planeswalker/.test(typeOf(c))).map(c => typeOf(c).split('—')[1]?.trim()).filter(Boolean)).size;
    if (/^card types among cards discarded this way$/.test(p)) return ctx && ctx.discTypes != null ? ctx.discTypes : 0;
    if (/^cards? discarded this way$/.test(p)) return ctx && ctx.discN != null ? ctx.discN : 0;
    if ((m = p.match(/^(.+?) you control with (\d+) or more (.+?) counters? on (?:it|them)$/))) return S.bf.filter(c => descOk(c.k, sing(m[1]), {tok:c.tok}) && ((c.nc || {})[m[3]] || 0) >= +m[2]).length;
    if (/^colors? among other legendary permanents you control$/.test(p)){ const src = ctx && srcCardOf(ctx); const cols = new Set(); S.bf.forEach(c => { if (c === src || c.fd || !/Legendary/.test(typeOf(c))) return; (info(c.k)?.c || '').split('').forEach(x => /[WUBRG]/.test(x) && cols.add(x)); }); return cols.size; }
    if (/^other artifacts? you control$/.test(p)){ const src = ctx && srcCardOf(ctx); return S.bf.filter(c => c !== src && !c.fd && /Artifact/.test(typeOf(c))).reduce((a, c) => a + (c.n || 1), 0); }
    if (/^towns? you control$/.test(p)) return S.bf.filter(c => /\bTown\b/.test(typeOf(c))).length;
    if (/^lands? with different names you control$|^lands you control with different names$/.test(p)) return new Set(S.bf.filter(c => isLand(c.k)).map(c => info(c.k)?.n)).size;
    if (/^(?:creature )?tokens you control$/.test(p)) return S.bf.filter(c => c.tok && !c.emb && (!/^creature/.test(p) || isCreatureCard(c))).reduce((a, c) => a + (c.n || 1), 0);
    if (/^cards in exile$/.test(p)){ let n = S.ex.length; for (const s of OPP.values()) n += (s.ex || []).length; return n; }
    return co(phrase, ctx);
  };
}

/* ---------- “Nth time this ability has resolved this turn” ---------- */
{
  const re = runEffects;
  runEffects = async function(txt, ctx){
    if (ctx && ctx.it && (ctx.it.kind === 'trigger' || ctx.it.kind === 'ability') && S){
      const key = (ctx.it.srcId != null ? ctx.it.srcId : ctx.k) + '|' + String(ctx.it.txt || txt).slice(0, 80);
      S.resN = S.resN || {}; const r = S.resN[key]; const n = r && r[0] === turnStr() ? r[1] + 1 : 1; S.resN[key] = [turnStr(), n]; ctx.resN = n;
    }
    return re(txt, ctx);
  };
}
const ORD = {first:1, second:2, third:3, fourth:4, fifth:5};

/* ---------- Triggers: wording seen on the top commanders ---------- */
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){
    let m;
    if (w === 'at'){
      if (/^the beginning of (?:your (?:first|precombat) main phase|each of your (?:first|precombat) main phases)/.test(c)) return {ev:'step', step:'main1', whose:'your'};
      if (/^the beginning of (?:your postcombat main phase|each of your postcombat main phases|your second main phase)/.test(c)) return {ev:'step', step:'main2', whose:'your'};
      if (/^the beginning of combat on each opponent's turn/.test(c)) return {ev:'step', step:'combat', whose:'opp'};
      if (/^the beginning of each player's end step/.test(c)) return {ev:'step', step:'end', whose:'each'};
      if (/^the beginning of each upkeep/.test(c)) return {ev:'step', step:'upkeep', whose:'each'};
      return ct(w, c);
    }
    if (/^you attack\b/.test(c)) return {ev:'attack', subj:'any', ctl:'you', desc:'', batch:true, anyAtk:true};
    if ((m = c.match(/^~ attacks an opponent\b/))) return {ev:'attack', subj:'self', ctl:'you', desc:''};
    if (/^the ring tempts you$/.test(c)) return {ev:'tempt', subj:'any', ctl:'you', desc:''};
    if ((m = c.match(/^an opponent loses life( for the first time)?(?: during (your turn|each of their turns))?$/))) return {ev:'loselife', subj:'any', ctl:'opp', desc:'', first:!!m[1], during:m[2] || ''};
    if ((m = c.match(/^you discard (one or more cards|a card|an? (.+?) card)$/))) return {ev:'discard', subj:'any', ctl:'you', desc:m[2] ? sing(m[2]) : '', batch:/one or more/.test(m[1])};
    if (/^you play a land or cast a spell$/.test(c)) return {ev:'cast', evs:['cast', 'land'], subj:'any', ctl:'you', desc:''};
    if (/^you play a land$/.test(c)) return {ev:'land', subj:'any', ctl:'you', desc:''};
    if ((m = c.match(/^one or more (nonland )?cards are milled$/))) return {ev:'mill', subj:'any', ctl:'any', desc:'', batch:true, nonland:!!m[1]};
    if (/^~ is dealt damage$/.test(c)) return {ev:'dealt', subj:'self', ctl:'you', desc:''};
    if (/^an opponent searches their library$/.test(c)) return {ev:'search', subj:'any', ctl:'opp', desc:''};
    if ((m = c.match(/^you roll an? (\d+) or higher$/))) return {ev:'roll', subj:'any', ctl:'you', desc:'', min:+m[1]};
    if (/^you commit a crime$/.test(c)) return {ev:'crime', subj:'any', ctl:'you', desc:''};
    if (/^one or more -1\/-1 counters are put on a creature$/.test(c)) return {ev:'ctrm', subj:'any', ctl:'any', desc:'creature'};
    if (/^you or a permanent you control becomes the target of a spell or ability an opponent controls$/.test(c)) return {ev:'tgt', subj:'any', ctl:'opp', desc:''};
    if (/^one or more cards are put into exile from graveyards and\/or the battlefield( during your turn)?$/.test(c)) return {ev:'exiled', subj:'any', ctl:'any', desc:'', batch:true, myTurn:/your turn/.test(c)};
    if (/^the final chapter ability of a saga you control resolves$/.test(c)) return {ev:'sagaend', subj:'any', ctl:'you', desc:''};
    if (/^you waterbend, earthbend, firebend, or airbend$/.test(c)) return {ev:'bend', subj:'any', ctl:'you', desc:''};
    if ((m = c.match(/^one or more (.*?)cards are put into your graveyard from anywhere$/))) return {ev:'togy', subj:'any', ctl:'you', desc:sing(m[1].trim()), batch:true};
    if ((m = c.match(/^you cast your first spell during each opponent's turn$/))) return {ev:'cast', subj:'any', ctl:'you', desc:'', firstOpp:true};
    if ((m = c.match(/^you cast or copy (?:an? )?(.+?) spell$/))) return {ev:'cast', subj:'any', ctl:'you', desc:sing(m[1])};
    if ((m = c.match(/^you cast a spell while ~ is attacking$/))) return {ev:'cast', subj:'any', ctl:'you', desc:'', whileAtk:true};
    if ((m = c.match(/^you cast an? (.+?) spell that targets (.+)$/))) return {ev:'cast', subj:'any', ctl:'you', desc:sing(m[1]), tgtDesc:sing(m[2])};
    if ((m = c.match(/^you cast an? (.+?) spell from your hand$/))) return {ev:'cast', subj:'any', ctl:'you', desc:sing(m[1]), fromHand:true};
    if ((m = c.match(/^you cast an? (.+?) spell from your graveyard$/))) return {ev:'cast', subj:'any', ctl:'you', desc:sing(m[1]), fromGy:true};
    if ((m = c.match(/^you cast a spell that targets ~$/))) return {ev:'cast', subj:'any', ctl:'you', desc:'', tgtSelf:true};
    if ((m = c.match(/^you cast (?:an? )?(.+?) spell with mana value (\d+) or greater$/))) return {ev:'cast', subj:'any', ctl:'you', desc:sing(m[1]), mvMin:+m[2]};
    if ((m = c.match(/^you cast a spell with \{x\} in its mana cost$/))) return {ev:'cast', subj:'any', ctl:'you', desc:'', hasX:true};
    if ((m = c.match(/^you cast (?:an? )?noncreature spell with one or more blue mana symbols in its mana cost$/))) return {ev:'cast', subj:'any', ctl:'you', desc:'noncreature', blueSym:true};
    if ((m = c.match(/^another source you control deals exactly (\d+) damage to a permanent or player$/))) return {ev:'dmg', subj:'other', ctl:'you', desc:'', exact:+m[1]};
    if ((m = c.match(/^one or more (.+?) you control (?:with counters on them |that entered this turn )?deal combat damage to a player$/))){ const sj = subjOf('one or more ' + m[1] + ' you control'); if (sj){ sj.batch = true; return {ev:'cdmg', ...sj, withCtr:/counters/.test(c), enteredTurn:/entered this turn/.test(c)}; } }
    if ((m = c.match(/^an? (.+?) you control with (.+?) deals combat damage to a player$/))){ const sj = subjOf('a ' + m[1] + ' you control'); if (sj) return {ev:'cdmg', ...sj, withKw:m[2]}; }
    if ((m = c.match(/^an enchanted creature you control deals combat damage to a player$/))) return {ev:'cdmg', subj:'any', ctl:'you', desc:'creature', enchanted:true};
    if ((m = c.match(/^an? (.+?) is put into a graveyard from the battlefield$/))) return {ev:'die', subj:'any', ctl:'any', desc:sing(m[1]), anyType:true};
    if ((m = c.match(/^one or more nontoken artifacts you control are put into a graveyard from the battlefield$/))) return {ev:'die', subj:'any', ctl:'you', desc:'nontoken artifact', batch:true, anyType:true};
    if ((m = c.match(/^an aura you control enters$/))) return {ev:'enter', subj:'any', ctl:'you', desc:'aura'};
    if ((m = c.match(/^a creature you control with defender enters$/))) return {ev:'enter', subj:'any', ctl:'you', desc:'creature', withKw:'defender'};
    if ((m = c.match(/^one or more (?:other )?creatures you control enter$/))) return {ev:'enter', subj:/other/.test(c) ? 'other' : 'any', ctl:'you', desc:'creature', batch:true};
    if ((m = c.match(/^~ enters or deals combat damage to a player$/))) return {ev:'enter', evs:['enter', 'cdmg'], subj:'self', ctl:'you', desc:''};
    return ct(w, c);
  };
}
// filters for the new trigger kinds, applied when a trigger would go on the stack
{
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    if (ev && t){
      const me = evPid === MYPID;
      if (t.ev === 'loselife'){ if (t.during === 'your turn' && currentTurn()[1] !== MYPID && phaseNow().pid !== MYPID) return; if (t.during === 'each of their turns' && phaseNow().pid !== evPid) return; if (t.first && !ev.x) return; }
      if (t.anyAtk && ev.type !== 'attack') return;
      if (t.firstOpp && (phaseNow().pid === MYPID || (S.casts || []).filter(x => x.t === turnStr()).length !== 1)) return;
      if (t.whileAtk){ const s = S.bf.find(c => c.id === src.id); if (!s || !s.atk) return; }
      if (t.mvMin && (info(ev.k)?.mv || 0) < t.mvMin) return;
      if (t.hasX && !/\{X\}/.test(info(ev.k)?.m || '')) return;
      if (t.blueSym && !/\{(?:[^}]*U[^}]*)\}/.test(info(ev.k)?.m || '')) return;
      if (t.fromHand && ev.from && ev.from !== 'hand') return;
      if (t.fromGy && ev.from !== 'gy') return;
      if ((t.tgtDesc || t.tgtSelf) && !ev.tg) return;
      if (t.tgtDesc && !String(ev.tg).split(',').some(k => k && descOk(k, t.tgtDesc))) return;
      if (t.tgtSelf && !String(ev.tg).split(',').includes(String(src.k))) return;
      if (t.exact && ev.amt !== t.exact) return;
      if (t.ev === 'mill' && t.nonland && !(ev.x > 0)) return;
      if (t.ev === 'roll' && (ev.x || 0) < t.min) return;
      if (t.ev === 'tgt' && ev.dp !== MYPID) return;
      if (t.myTurn && phaseNow().pid !== MYPID) return;
      if (t.withKw && ev.id != null && me){ const c = S.bf.find(x => x.id === ev.id); if (!c || !kwOf(c, t.withKw)) return; }
      if (t.enchanted && me){ const c = S.bf.find(x => x.id === ev.id); if (!c || !boardsAll().some(b => b.bf.some(a => a.att && a.att.id === c.id && /Aura/.test(info(a.k)?.t || '')))) return; }
      if (t.withCtr && me){ const c = S.bf.find(x => x.id === ev.id); if (!c || !((c.cp || 0) + (c.cm || 0) + (c.co || 0))) return; }
      if (t.enteredTurn && me){ const c = S.bf.find(x => x.id === ev.id); if (!c || c.et !== turnStr()) return; }
      if (t.ev === 'dealt' && ev.id !== src.id) return;
      if (/this ability triggers only once each turn/i.test(t.eff)){ const key = src.id + '|' + t.raw; S.once = S.once || {}; if (S.once[key] === turnStr()) return; S.once[key] = turnStr(); }
    }
    pt(src, t, ev, evPid);
    const it = S.stk[S.stk.length - 1];
    if (it && ev){ if (ev.type === 'discard' && ev.kk) it.evKs = ev.kk; if (ev.type === 'dealt') it.evN = ev.amt; if (ev.type === 'mill') it.evN = ev.x || ev.amt; if (ev.type === 'loselife') it.evN = ev.amt; if (ev.type === 'cast') it.evFrom = ev.from || ''; }
  };
}
// the dealt / mill / mana-value events need the matching subject check skipped (handleEvent's generic branch)
{
  const sm = subjMatch;
  subjMatch = function(t, src, ev, pid){
    if (['loselife', 'discard', 'mill', 'search', 'tempt', 'roll', 'crime', 'tgt', 'exiled', 'sagaend', 'bend', 'land', 'togy'].includes(ev.type)){
      if (t.ctl === 'you' && pid !== MYPID) return false; if (t.ctl === 'opp' && pid === MYPID) return false;
      if (t.desc && ev.k && !descOk(ev.k, t.desc)) return false; return true;
    }
    if (ev.type === 'dealt') return pid === MYPID && ev.id === src.id;
    if (ev.type === 'ctrm') return true;
    if (t.anyType && ev.type === 'die'){ if (t.ctl === 'you' && pid !== MYPID) return false; return !t.desc || descOk(ev.k, t.desc, {tok:ev.tok}); }
    return sm(t, src, ev, pid);
  };
}

/* ---------- Emitting the new events ---------- */
{
  const ml = mill;
  mill = function(n = 1){ const before = S.lib.slice(0, n); const r = ml(n); const gone = before.filter(c => !S.lib.includes(c)); if (gone.length && !UI.dry){ emit({type:'mill', cnt:1, amt:gone.length, x:gone.filter(c => !isLand(c.k)).length}); const lands = gone.filter(c => isLand(c.k) && S.gy.includes(c)); lands.forEach(c => emit({type:'togy', k:c.k, id:c.id, cnt:1})); } if (UI.millLog) UI.millLog.push(...gone); return r; };
  const mc = moveCard;
  moveCard = function(id, to, o = {}){
    const [from, , c] = find(id); const r = mc(id, to, o);
    if (c && S && from !== to && typeof emit === 'function'){
      const [now] = find(id);
      if (now === 'gy' && from === 'hand' && !o.noDiscard && UI.discarding) { emit({type:'discard', k:c.k, id:c.id, cnt:1}); UI.discarding.push(c); }
      if (now === 'gy' && from !== 'gy' && isLand(c.k) && from !== 'lib') emit({type:'togy', k:c.k, id:c.id, cnt:1});
      if (now === 'ex' && (from === 'gy' || from === 'bf')) emit({type:'exiled', k:c.k, id:c.id, cnt:1});
    }
    return r;
  };
  const pl = playLand;
  playLand = function(c, o){ const r = pl(c, o); try { if (S.bf.some(b => b.id === c.id)) emit({type:'land', k:c.k, id:c.id, cnt:1}); } catch {} return r; };
  const mcn = modCounters;
  modCounters = function(c, kind, n, putter, ownerPid){ const r = mcn(c, kind, n, putter, ownerPid); if (kind === 'cm' && r > 0 && S && S.bf.includes(c) && isCreatureCard(c)) emit({type:'ctrm', k:c.k, id:c.id, cnt:1}); return r; };
  const sl = searchLibrary;
  searchLibrary = async function(...a){ emit({type:'search', cnt:1}); return sl.apply(this, a); };
  const dc = damageCard;
  damageCard = function(c, n, f){ const r = dc(c, n, f); if (n > 0 && c && S.bf.includes(c) || (n > 0 && c && S.gy.includes(c))) emit({type:'dealt', k:c.k, id:c.id, cnt:1, amt:n}); return r; };
  const ctg = chooseTargets;
  chooseTargets = async function(text, src, name){
    const r = await ctg(text, src, name);
    try { const list = Array.isArray(r) ? r.flat(2) : []; const opp = list.filter(t => t && t.pid && t.pid !== MYPID);
      if (opp.length && !UI.dry){ emit({type:'crime', cnt:1}); [...new Set(opp.map(t => t.pid))].forEach(pid => emit({type:'tgt', dp:pid, cnt:1})); }
      UI.lastTg = list.filter(t => t && t.k).map(t => t.k).join(','); } catch {}
    return r;
  };
  const sd = sagaDone;
  sagaDone = function(it){ const r = sd(it); try { emit({type:'sagaend', k:it.k, id:it.srcId || 0, cnt:1}); } catch {} return r; };
}
// discards inside effects are tracked so “card types among cards discarded this way” works
async function discardTracked(n, ctx, any){
  if (!S.hand.length) { ctx.discN = 0; ctx.discTypes = 0; return []; }
  const k = any ? null : Math.min(n, S.hand.length);
  const ids = any ? await pickCards({title:`${ctx.name}: discard any number of cards`, cards:S.hand.slice(), min:0, max:S.hand.length, noneLabel:'Discard nothing'})
    : S.hand.length === k ? S.hand.map(c => c.id) : await pickCards({title:`${ctx.name}: discard ${k === 1 ? 'a card' : k + ' cards'}`, cards:S.hand.slice(), min:k, max:k});
  UI.discarding = []; (ids || []).forEach(id => moveCard(id, 'gy')); const got = UI.discarding; UI.discarding = null;
  ctx.discN = got.length; ctx.discCards = got; ctx.discTypes = new Set(got.flatMap(c => typesOf(c.k))).size; ctx.discLand = got.some(c => isLand(c.k)); ctx.discIS = got.some(c => /\b(Instant|Sorcery)\b/.test(info(c.k)?.t || ''));
  if (got.length) log(`discarded ${got.map(cname).join(', ')}`); commit(); return got;
}

/* ---------- The Ring tempts you ---------- */
async function ringTempts(ctx){
  S.ring = (S.ring || 0) + 1;
  const cr = S.bf.filter(c => isCreatureCard(c) && !c.fd);
  let bearer = null;
  if (cr.length){ const ids = cr.length === 1 ? [cr[0].id] : await pickCards({title:`The Ring tempts you (${S.ring}${S.ring === 1 ? 'st' : S.ring === 2 ? 'nd' : S.ring === 3 ? 'rd' : 'th'} time): choose your Ring-bearer`, cards:cr, min:1, max:1}); bearer = ids && S.bf.find(c => c.id === ids[0]); }
  S.bf.forEach(c => { c.ring = c === bearer ? 1 : 0; });
  log(`the Ring tempts them${bearer ? ' — ' + cname(bearer) + ' is their Ring-bearer' : ''} (level ${Math.min(4, S.ring)})`);
  const lvl = [null, 'Your Ring-bearer is legendary and can\'t be blocked by creatures with greater power.', 'Whenever your Ring-bearer attacks, draw a card, then discard a card.', 'Whenever your Ring-bearer becomes blocked by a creature, that creature\'s controller sacrifices it at end of combat.', 'Whenever your Ring-bearer deals combat damage to a player, each opponent loses 3 life.'];
  if (S.ring <= 4) makeEmblem(lvl[S.ring], 'The Ring');
  emit({type:'tempt', cnt:1}); commit();
}
// the Ring's emblems talk about “your Ring-bearer”
{
  const so = subjOf;
  subjOf = function(s){ if (/^your ring-bearer$/.test(String(s).trim())) return {subj:'any', ctl:'you', desc:'', ringBearer:true}; return so(s); };
  const sm = subjMatch;
  subjMatch = function(t, src, ev, pid){ if (t.ringBearer){ if (pid !== MYPID) return false; const c = S.bf.find(x => x.id === ev.id); return !!(c && c.ring); } return sm(t, src, ev, pid); };
}

/* ---------- Amass, explore, connive, blight, earthbend, airbend ---------- */
async function amass(type, n, ctx){
  let army = S.bf.find(c => /\bArmy\b/.test(typeOf(c)) && !c.fd);
  if (!army){ await createFromText(`Create a 0/0 black ${type} Army creature token`, ctx); army = S.bf.filter(c => /\bArmy\b/.test(typeOf(c)) || /Army/.test(cname(c))).pop(); }
  if (army){ modCounters(army, 'cp', n); log(`amass ${type} ${n}: ${cname(army)} gets ${n} +1/+1 counter${n === 1 ? '' : 's'}`); }
  ctx.lastT = army ? [{t:'card', pid:MYPID, id:army.id, k:army.k, nm:cname(army)}] : []; commit();
}
async function explore(c, ctx){
  if (!c || !S.lib.length) return;
  const top = S.lib.shift(); log(`${cname(c)} explores: revealed ${cname(top)}`);
  if (isLand(top.k)){ S.hand.push(top); log(`put ${cname(top)} into their hand`); }
  else { modCounters(c, 'cp', 1); const keep = await askChoice({title:`${cname(c)} explores: ${cname(top)}`, options:[{label:'Leave it on top of your library', value:'top'}, {label:'Put it into your graveyard', value:'gy'}]}); if (keep === 'gy'){ S.gy.push(top); log(`put ${cname(top)} into their graveyard`); } else S.lib.unshift(top); }
  emit({type:'explore', k:c.k, id:c.id, cnt:1}); commit();
}
async function connive(c, ctx, n = 1){
  draw(n); const got = await discardTracked(n, ctx);
  const nonland = got.filter(x => !isLand(x.k)).length; if (c && nonland) modCounters(c, 'cp', nonland);
  log(`${c ? cname(c) : ctx.name} connives${nonland ? ` (+${nonland} counter${nonland === 1 ? '' : 's'})` : ''}`); commit();
}
async function blightMe(n, src){
  const cr = S.bf.filter(c => isCreatureCard(c) && !c.fd); if (!cr.length || n <= 0) return;
  const ids = cr.length === 1 ? [cr[0].id] : await pickCards({title:`${src}: blight ${n} — put ${n} -1/-1 counter${n === 1 ? '' : 's'} on a creature you control`, cards:cr, min:1, max:1});
  const c = ids && S.bf.find(x => x.id === ids[0]); if (c){ modCounters(c, 'cm', n); log(`blighted ${n}: ${cname(c)}`); commit(); }
}
async function earthbend(n, ctx){
  const lands = S.bf.filter(c => isLand(c.k) && !c.fd); if (!lands.length){ log(`${ctx.name}: no land to earthbend`); return; }
  const ids = lands.length === 1 ? [lands[0].id] : await pickCards({title:`${ctx.name}: earthbend ${n} — choose a land you control`, hint:'It becomes a 0/0 creature with haste (and stays a land) with the counters on it. When it dies or is exiled, it returns tapped.', cards:lands, min:1, max:1});
  const c = ids && S.bf.find(x => x.id === ids[0]); if (!c) return;
  c.anim = 'eb'; c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; modCounters(c, 'cp', n); c.ebd = 1;
  log(`earthbend ${n}: ${cname(c)} is now a 0/0 creature land with ${n} +1/+1 counters and haste`); bent('earth'); commit();
}
function bent(kind){ S.bend = S.bend || {}; if (S.bend.t !== turnStr()) S.bend = {t:turnStr()}; S.bend[kind] = 1; emit({type:'bend', cnt:1}); }

/* ---------- Animated permanents (crew, station, earthbend, “during your turn … is a creature”) ---------- */
{
  const pt0 = (c) => { const a = info(c.k); return a ? [parseInt(a.p) || 0, parseInt(a.t) || 0] : [0, 0]; };
  isCreatureCard = c => !!(c && c.fd && c.fdc) || !!(c && c.anim) || /\bCreature\b/.test(typeOf(c)) || bardAnim(c);
  const st0 = stats;
  stats = function(c, pid){
    let r = st0(c, pid);
    if (c && c.anim && !r){ const b = c.anim === 'eb' ? [0, 0] : pt0(c); const pu = c.pu || [0, 0]; const n = (c.cp || 0) - (c.cm || 0); r = [b[0] + n + (pu[0] || 0), b[1] + n + (pu[1] || 0)]; return r; }
    if (c && (c.anim === 'crew' || c.anim === 'st') && !/\bCreature\b/.test(typeOf(c)) && r[0] === 0 && r[1] === 0){ const b = pt0(c); return [b[0] + (c.cp || 0) - (c.cm || 0), b[1] + (c.cp || 0) - (c.cm || 0)]; }
    if (c && bardAnim(c) && !/\bCreature\b/.test(typeOf(c))) return [4 + (c.cp || 0) - (c.cm || 0), 4 + (c.cp || 0) - (c.cm || 0)];
    return r;
  };
  const kw0 = kwOf;
  kwOf = function(c, kw, pid){
    const r = kw0(c, kw, pid); if (r) return r;
    if (c && c.anim === 'st' && stationKw(c).includes(kw)) return true;
    if (c && bardAnim(c) && /^(indestructible|haste)$/.test(kw)) return true;
    return r;
  };
}
// Bello: your big artifacts and enchantments are 4/4 creatures during your turn
function bardAnim(c){
  if (!c || !S || c.fd || !c.k || phaseNow().pid !== MYPID || !S.bf.includes(c)) return false;
  if (!S.bf.some(b => !b.fd && /each non-equipment artifact and non-aura enchantment you control with mana value 4 or greater is a 4\/4/i.test(info(b.k)?.o || ''))) return false;
  const t = info(c.k)?.t || ''; if (/\bCreature\b/.test(t)) return false;
  return ((/\bArtifact\b/.test(t) && !/Equipment/.test(t)) || (/\bEnchantment\b/.test(t) && !/Aura/.test(t))) && (info(c.k)?.mv || 0) >= 4;
}
function stationKw(c){
  const o = info(c.k)?.o || ''; const ch = (c.nc || {}).charge || 0; const out = [];
  for (const l of o.split('\n')){ const m = l.match(/^(\d+)\+ \| ([a-z ,]+)$/i); if (m && ch >= +m[1]) m[2].split(/,\s*/).forEach(k => out.push(k.trim().toLowerCase())); }
  return out;
}
function stationNeed(c){ const o = info(c.k)?.o || ''; let max = 0; for (const l of o.split('\n')){ const m = l.match(/^(\d+)\+ \|/); if (m && /^\d+\+ \| [a-z ,]+$/i.test(l.trim())) max = Math.max(max, +m[1]); } return max; }
function addNamed(c, kind, n){ c.nc = c.nc || {}; c.nc[kind] = Math.max(0, (c.nc[kind] || 0) + n); c.co = Object.values(c.nc).reduce((a, b) => a + b, 0); if (kind === 'charge' && info(c.k)?.t && /Spacecraft/.test(info(c.k).t)){ const need = stationNeed(c); if (need && c.nc.charge >= need && c.anim !== 'st'){ c.anim = 'st'; log(`${cname(c)} is fully stationed — it's now an artifact creature`); } } }
{
  const al = abilityList;
  abilityList = function(c){
    const base = al(c).map(ab => { const m = ab.cost.match(/^(\d+)\+ \| (.+)$/); return m ? {...ab, cost:m[2], minCh:+m[1]} : ab; })
      .map(ab => /^waterbend /i.test(ab.cost) ? {...ab, cost:ab.cost.replace(/^waterbend /i, ''), waterbend:true} : ab);
    const f = faceOf(c); if (!f || c.fd) return base;
    const o = tname(f.o, f.n); let m;
    if ((m = o.match(/^crew (\d+)$/im))) base.push({cost:`Crew ${m[1]}`, eff:'~ becomes an artifact creature until end of turn.', sorc:false, line:m[0], crew:+m[1]});
    if (/^station$/im.test(o)) base.push({cost:'Tap another untapped creature you control', eff:'Put charge counters equal to the tapped creature\'s power on ~.', sorc:true, line:'Station', station:true});
    if (/^more than meets the eye/im.test(o) || /^living metal/im.test(o)) {}
    return base;
  };
  const ar = abilityReady;
  abilityReady = function(c, ab, mana){
    if (ab.minCh && ((c.nc || {}).charge || 0) < ab.minCh) return `Needs ${ab.minCh} charge counters (has ${(c.nc || {}).charge || 0})`;
    if (ab.crew){ const pw = S.bf.filter(x => x !== c && isCreatureCard(x) && !x.tap && !x.fd).reduce((a, x) => a + Math.max(0, stats(x)[0] + +(((tname(info(x.k)?.o || '', info(x.k)?.n).match(/crews vehicles as though its power were (\d+) greater/i)) || [])[1] || 0)), 0); if (pw < ab.crew) return `Needs untapped creatures with total power ${ab.crew}`; return ''; }
    if (ab.station){ if (!S.bf.some(x => x !== c && isCreatureCard(x) && !x.tap && !x.fd)) return 'No untapped creature to station with'; if (!sorceryTime()) return 'Only as a sorcery'; return ''; }
    return ar(c, ab, mana);
  };
  const aa = activateAbility;
  activateAbility = async function(c, ab){
    if (ab.crew){
      const list = S.bf.filter(x => x !== c && isCreatureCard(x) && !x.tap && !x.fd);
      const ids = await pickCards({title:`Crew ${ab.crew}: tap creatures with total power ${ab.crew} or more`, cards:list, min:1, max:list.length}); if (!ids || !ids.length) return;
      const pw = ids.reduce((a, id) => { const x = S.bf.find(y => y.id === id); const bonus = +(((tname(info(x.k)?.o || '', info(x.k)?.n).match(/crews vehicles as though its power were (\d+) greater/i)) || [])[1] || 0); return a + Math.max(0, stats(x)[0] + bonus); }, 0);
      if (pw < ab.crew){ toast(`That's only ${pw} power — need ${ab.crew}`); return; }
      ids.forEach(id => { const x = S.bf.find(y => y.id === id); if (x) x.tap = true; }); c.anim = 'crew'; log(`crewed ${cname(c)} (it's an artifact creature until end of turn)`); commit(); return;
    }
    if (ab.station){
      const list = S.bf.filter(x => x !== c && isCreatureCard(x) && !x.tap && !x.fd);
      const ids = list.length === 1 ? [list[0].id] : await pickCards({title:`Station ${cname(c)}: tap a creature`, cards:list, min:1, max:1}); const x = ids && S.bf.find(y => y.id === ids[0]); if (!x) return;
      x.tap = true; const n = Math.max(0, stats(x)[0]); addNamed(c, 'charge', n); log(`stationed ${cname(c)} with ${cname(x)}: +${n} charge (${c.nc.charge})`); commit(); return;
    }
    if (ab.waterbend){
      const m = ab.cost.match(/^\{(\d+)\}$/); const gen = m ? +m[1] : 0; const helpers = S.bf.filter(x => x !== c && !x.tap && !x.fd && (isCreatureCard(x) || /Artifact/.test(typeOf(x))));
      let tapN = 0; if (helpers.length && gen){ const ids = await pickCards({title:`Waterbend {${gen}}: tap artifacts and creatures to pay {1} each`, hint:'Pay the rest with mana.', cards:helpers, min:0, max:Math.min(gen, helpers.length), noneLabel:'Pay with mana only'}); (ids || []).forEach(id => { const x = S.bf.find(y => y.id === id); if (x){ x.tap = true; tapN++; } }); }
      const left = gen - tapN; bent('water'); return aa(c, {...ab, cost:left ? `{${left}}` : '{0}'});
    }
    return aa(c, ab);
  };
}
// animation wears off: crew lasts until end of turn
{
  const tc = turnChanged;
  turnChanged = function(...a){ if (S) S.bf.forEach(c => { if (c.anim === 'crew') c.anim = ''; c.cdt = 0; }); return tc.apply(this, a); };
}

/* ---------- Keyword abilities that make triggers: firebending, mobilize, “More Than Meets the Eye” ---------- */
{
  const tg = trigsOf;
  trigsOf = function(k, fl){
    const out = tg(k, fl); if (out.r9) return out;
    const a = info(k); const f = a ? (fl && a.back ? a.back : a) : null; if (!f) return out;
    const o = tname(f.o, f.n); let m;
    if ((m = o.match(/\bfirebending (\d+|x)\b/i))) out.push({ev:'attack', subj:'self', ctl:'you', desc:'', eff:`Add ${'{R}'.repeat(+m[1] || 1)}. (firebending)`, raw:'firebending ' + m[1]});
    if ((m = o.match(/^mobilize (\d+)$/im))) out.push({ev:'attack', subj:'self', ctl:'you', desc:'', eff:`Create ${m[1] === '1' ? 'a' : m[1]} 1/1 red Warrior creature token${m[1] === '1' ? '' : 's'} that ${m[1] === '1' ? "is" : 'are'} tapped and attacking. Sacrifice ${m[1] === '1' ? 'it' : 'them'} at the beginning of the next end step.`, raw:'mobilize ' + m[1]});
    out.r9 = true; return out;
  };
}
// firebending mana stays until end of combat; mark firebend
{
  const am = addMana;
  addMana = function(outs){ return am(outs); };
}

/* ---------- Static abilities ---------- */
STATIC_RULES.push(
  [/^each creature you control assigns combat damage equal to its toughness rather than its power$/, m => ({kind:'toughDmg', who:'you'})],
  [/^each creature you control with defender assigns combat damage equal to its toughness rather than its power and can attack as though it didn't have defender$/, m => ({kind:'toughDmg', who:'you', kw:'defender'})],
  [/^creatures you control can attack as though they didn't have defender$/, m => ({kind:'defAtk', who:'you'})],
  [/^lands you control enter untapped$/, m => ({kind:'landsUntapped', who:'you'})],
  [/^nontoken artifacts you control are lands in addition to their other types$/, m => ({kind:'artLand', who:'you'})],
  [/^activated abilities of foods you control cost \{1\} less to activate$/, m => ({kind:'foodDisc', who:'you'})],
  [/^you may look at the top card of your library any time$/, m => ({kind:'peekTop', who:'you'})],
  [/^you may play lands and cast spells with mana value (\d+) or greater from the top of your library$/, m => ({kind:'topPlay', who:'you', mv:+m[1]})],
  [/^for each \{b\} in a cost, you may pay 2 life rather than pay that mana$/, m => ({kind:'phyB', who:'you'})],
  [/^(.+?) spells you cast have cascade$/, m => ({kind:'giveCascade', who:'you', desc:sing(m[1]), n:1})],
  [/^colorless spells you cast from your hand with mana value 7 or greater have "cascade, cascade"$/, m => ({kind:'giveCascade', who:'you', desc:'colorless', mv:7, n:2})],
  [/^each instant and sorcery card in your graveyard has flashback$/, m => ({kind:'gyFlash', who:'you'})],
  [/^the flashback cost is equal to that card's mana cost$/, m => ({kind:'noop'})],
  [/^during your turn, you may play cards from your graveyard$/, m => ({kind:'gyAll', who:'you'})],
  [/^if a card or token would be put into your graveyard from anywhere, exile it instead$/, m => ({kind:'gyEx', who:'you', scope:''})],
  [/^(?:~'s|its) power and toughness are each equal to the number of (.+)$/, m => ({kind:'cda', who:'you', both:true, what:m[1]})],
  [/^(?:~'s|its) power is equal to the number of (.+)$/, m => ({kind:'cda', who:'you', what:m[1]})],
  [/^~ gets \+1\/\+1 for each color among other legendary permanents you control$/, m => ({kind:'cdaPlus', who:'you', what:'colors among other legendary permanents you control', both:true})],
  [/^~ gets \+1\/\+0 for each other artifact you control$/, m => ({kind:'cdaPlus', who:'you', what:'other artifacts you control'})],
  [/^other creatures you control get \+1\/\+0 for each aura and equipment attached to ~$/, m => ({kind:'kellan', who:'you'})],
  [/^if a wizard you control would deal damage to a permanent or player, it deals double that damage instead$/, m => ({kind:'dmgDouble', who:'you', desc:'wizard'})],
  [/^each nonland card in your graveyard has mayhem$/, m => ({kind:'gyMayhem', who:'you'})],
  [/^the mayhem cost is equal to its mana cost$/, m => ({kind:'noop'})],
  [/^spells you cast from your graveyard cost \{(\d+)\} less to cast$/, m => ({kind:'gyDisc', who:'you', n:+m[1]})],
  [/^each creature spell you cast with mana value (\d+) or greater has blitz$/, m => ({kind:'giveBlitz', who:'you', mv:+m[1]})],
  [/^the blitz cost is equal to its mana cost$/, m => ({kind:'noop'})],
  [/^blitz costs you pay cost \{1\} less for each time you've cast your commander from the command zone this game$/, m => ({kind:'blitzDisc', who:'you'})],
  [/^elemental permanent spells you cast from your hand gain evoke \{4\} as you cast them$/, m => ({kind:'giveEvoke', who:'you', desc:'elemental', cost:'{4}'})],
  [/^instant and sorcery spells you cast have affinity for creatures$/, m => ({kind:'giveAffinity', who:'you', desc:'instant or sorcery', what:'creature'})],
  [/^other legendary creatures you control have vigilance and "\{t\}: add one mana of any color"$/, m => ({kind:'esika', who:'you'})],
  [/^(?:other creatures are|artifacts you control are) foods? (?:artifacts )?in addition to their other types and have "\{2\}, \{t\}, sacrifice ~: you gain 3 life"$/, m => ({kind:'foodAll', who:'you', other:/^other creatures/.test(m[0])})],
  [/^other creatures are food artifacts in addition to their other types and have "\{2\}, \{t\}, sacrifice (?:~|this permanent): you gain 3 life"$/, m => ({kind:'foodAll', who:'you', other:true})],
  [/^artifacts you control are foods in addition to their other types and have "\{2\}, \{t\}, sacrifice (?:~|this artifact): you gain 3 life"$/, m => ({kind:'foodArt', who:'you'})],
  [/^during your turn, ~ has indestructible$/, m => ({kind:'myTurnKw', who:'you', kw:'indestructible'})],
  [/^as long as ~ isn't on the battlefield, it's a 1\/1 insect creature in addition to its other types$/, m => ({kind:'noop'})],
  [/^all creatures have haste$/, m => ({kind:'allHaste', who:'all'})],
  [/^land creatures you control have double strike$/, m => ({kind:'grantKw', who:'you', land:true, kws:['double strike']})],
  [/^~ can't attack or block unless there are seven or more cards in exile$/, m => ({kind:'sevenEx', who:'you'})],
  [/^as long as there are four or more lore counters among sagas you control, ~ has hexproof and indestructible$/, m => ({kind:'loreKw', who:'you', kws:['hexproof', 'indestructible']})],
  [/^as long as ~ is equipped, if a triggered ability of ~ or an equipment attached to it triggers, that ability triggers an additional time$/, m => ({kind:'cloudTwice', who:'you'})],
  [/^if a creature attacking causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time$/, m => ({kind:'trigTwice', who:'you', desc:'creature', ev:'attack'})],
  [/^if a creature dying causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time$/, m => ({kind:'trigTwice', who:'you', desc:'creature', ev:'die'})],
  [/^(other )?(.+?) you control have (menace and prowess|menace|prowess)$/, m => ({kind:'grantKw', who:'you', other:!!m[1], desc:sing(m[2]), kws:m[3].split(' and ')})],
  [/^while voting, you may vote an additional time$/, m => ({kind:'extraVote', who:'you'})],
  [/^once during each of your turns, you may cast a dragon creature spell from your graveyard$/, m => ({kind:'gyCast', who:'you', desc:'dragon creature', once:true})],
  [/^spells you cast cost \{w\}\{u\}\{b\}\{r\}\{g\} less to cast$/, m => ({kind:'wubrgDisc', who:'you'})],
);
STATIC_KNOWN.push(
  /^(firebending|mobilize) (\d+|x)$/, /^station$/, /^\d+\+ \| [a-z ,]+$/, /^crew \d+$/, /^living metal$/, /^more than meets the eye/, /^ward—/, /^escape—/, /^affinity for /,
  /^creature tokens you control have vigilance and lifelink$/, /^land creatures you control have/, /^all creatures have haste$/, /^["”]$/, /^as ~ transforms into ~, you get an emblem with/,
  /^horrors you control have menace$/, /^artifact creatures you control have vigilance$/, /^~ crews vehicles/, /^(other )?(dwarves|allies) you control (get \+1\/\+0|have menace and prowess)$/,
  /^~'s power (and toughness are each|is) equal to/, /^other legendary creatures you control have vigilance and/, /^(protection from|devoid)/,
  /^(super nova|flare star|goblin formula|echo of the lost|cheer|trance|three autostubs|master tactician|chapter master|the minstrel's ballad|power-up|delirium|heroic|magecraft|eminence|landfall) —/,
);
// toughness-for-damage, defender attacks, lands enter untapped, artifact lands, mana symbols
{
  const ad = attackerDamage;
  attackerDamage = function(step, blocks){ const r = ad(step, blocks); return r; };
  const ca = canAttack;
  canAttack = function(c){
    const r = ca(c);
    if (r === 'defender' && (rulesOn('defAtk').length || rulesOn('toughDmg').some(x => x.kw === 'defender'))) return '';
    if (!r && c.k && /can't attack or block unless there are seven or more cards in exile/i.test(info(c.k)?.o || '') && countOf('cards in exile') < 7) return 'needs seven or more cards in exile';
    return r;
  };
}
function toughDmg(c){ return rulesOn('toughDmg').some(r => !r.kw || kwOf(c, r.kw)) || (c.tdt === turnStr()); }
{
  const st0 = stats;
  stats = function(c, pid = MYPID){
    let r = st0(c, pid); if (!c || !c.k || pid !== MYPID || !S || !Array.isArray(r)) return r;
    for (const ru of rulesOn('cda')) if (ru.src === cname(c) || ru.sid === c.id){ const n = countOf(ru.what, {k:c.k, srcId:c.id}) || 0; const a = info(c.k); const bp = parseInt(a.p) || 0, bt = parseInt(a.t) || 0; r = [r[0] - bp + n, ru.both ? r[1] - bt + n : r[1]]; }
    for (const ru of rulesOn('cdaPlus')) if (ru.src === cname(c) || ru.sid === c.id){ const n = countOf(ru.what, {k:c.k, srcId:c.id}) || 0; r = [r[0] + n, ru.both ? r[1] + n : r[1]]; }
    if (rulesOn('kellan').length && isCreatureCard(c)){ for (const k of S.bf.filter(x => /other creatures you control get \+1\/\+0 for each aura and equipment attached to/i.test(tname(info(x.k)?.o || '', info(x.k)?.n)))) if (k.id !== c.id) r = [r[0] + S.bf.filter(a => a.att && a.att.id === k.id).length, r[1]]; }
    return r;
  };
}
{
  const ld = onEnter;
  onEnter = function(c, from, o = {}){ const r = ld(c, from, o); try { if (c && isLand(c.k) && rulesOn('landsUntapped').length && c.tap && !o.tapped) c.tap = false; c.et = turnStr(); } catch {} return r; };
}

/* ---------- Effects: one-off sentences from the top commanders ---------- */
async function doRound9Pre(s, l, ctx){
  let m;
  const src = () => srcCardOf(ctx);
  const say = t => doSentence(cap(t), ctx);
  // “the Nth time this ability has resolved this turn”
  if ((m = l.match(/^(.+?) if this is the (first|second|third|fourth) time this ability has resolved this turn$/))){ if ((ctx.resN || 1) === ORD[m[2]]) await say(s.slice(0, m[1].length)); return true; }
  if ((m = l.match(/^if this is the (first|second|third|fourth) time this ability has resolved this turn, (.+)$/))){ if ((ctx.resN || 1) === ORD[m[1]]) await say(s.slice(s.length - m[2].length)); return true; }
  if ((m = l.match(/^if it's the (first|second|third|fourth) time, (.+)$/))){ if ((ctx.resN || 1) === ORD[m[1]]) await say(s.slice(s.length - m[2].length)); return true; }
  if (/^(?:this ability triggers only once each turn|do this only once each turn)$/.test(l)) return true;
  // life lost / gained this turn
  if ((m = l.match(/^if a player lost (\d+) or more life this turn, (.+)$/))){ if (players().some(p => lostThisTurn(p.pid) >= +m[1])) await say(s.slice(s.length - m[2].length)); else log(`${ctx.name}: nobody lost ${m[1]} life this turn`); return true; }
  if ((m = l.match(/^if you gained (\d+ or more )?life this turn, (.+)$/))){ const need = m[1] ? parseInt(m[1]) : 1; if (lifeT().g >= need) await say(s.slice(s.length - m[2].length)); else log(`${ctx.name}: didn't gain ${need > 1 ? need + ' ' : ''}life this turn`); return true; }
  if ((m = l.match(/^if you control (\w+) or more (.+?), (.+)$/)) && wn(m[1])){ const n = countOf(m[2] + ' you control', ctx); if (n != null){ if (n >= wn(m[1])) await say(s.slice(s.length - m[3].length)); else log(`${ctx.name}: you control ${n} ${m[2]} — not enough`); ctx.condResult = n >= wn(m[1]); return true; } }
  if ((m = l.match(/^if there are (\w+) or more cards in your graveyard, (.+)$/)) && wn(m[1])){ if (S.gy.length >= wn(m[1])) await say(s.slice(s.length - m[2].length)); return true; }
  if ((m = l.match(/^if you have fewer than (\w+) cards in hand, draw cards equal to the difference$/))){ const n = (wn(m[1]) || 0) - S.hand.length; if (n > 0) draw(n); commit(); return true; }
  if ((m = l.match(/^(?:then )?if ~ has power (\d+) or greater, (.+)$/))){ const c = src(); if (c && stats(c)[0] >= +m[1]) await say(s.slice(s.length - m[2].length)); return true; }
  if ((m = l.match(/^if it didn't have decayed, (.+)$/))){ const k = ctx.it && ctx.it.evk; if (!k || !/decayed/i.test(info(k)?.o || '') ) await say(s.slice(s.length - m[1].length)); return true; }
  if ((m = l.match(/^if you cast it, (.+)$/))){ if (!ctx.it || !ctx.it.evId || (S.casts || []).some(x => x.id === ctx.it.evId || x.k === ctx.it.evk)) await say(s.slice(s.length - m[1].length)); return true; }
  if ((m = l.match(/^if one or more of them entered from a graveyard or was cast from a graveyard, (.+)$/))){ const c = ctx.it && S.bf.find(x => x.id === ctx.it.evId); if (c && (c.fromGy || c.from === 'gy')) await say(s.slice(s.length - m[1].length)); else if (!c) await say(s.slice(s.length - m[1].length)); return true; }
  // “X if Y. Otherwise, Z.” (Flubs, Zurgo)
  if ((m = l.match(/^draw a card if you have no cards in hand$/))){ if (!S.hand.length){ draw(1); ctx.condResult = true; } else ctx.condResult = false; commit(); return true; }
  if ((m = l.match(/^draw a card if it was attacking$/))){ const was = ctx.it && (S.ev || []).some(e => e.type === 'attack' && e.id === ctx.it.evId && (S.cb && S.cb.t === turnStr() || phaseNow().ph === 4)); ctx.condResult = !!was; if (was) draw(1); commit(); return true; }
  if ((m = l.match(/^then destroy all other creatures if its power is exactly (\d+)$/))){ const c = src(); if (c && stats(c)[0] === +m[1]) await say('Destroy all other creatures'); return true; }
  // the Ring, amass, explore, connive, blight, bending
  if (/^the ring tempts you$/.test(l)){ await ringTempts(ctx); return true; }
  if ((m = l.match(/^(?:if you gained 3 or more life this turn, )the ring tempts you$/))){ if (lifeT().g >= 3) await ringTempts(ctx); return true; }
  if ((m = l.match(/^(?:then )?if ~ is your ring-bearer and the ring has tempted you (\w+) or more times this game, (.+)$/))){ const c = src(); if (c && c.ring && (S.ring || 0) >= (wn(m[1]) || 2)) await say(s.slice(s.length - m[2].length)); return true; }
  if ((m = l.match(/^amass ([a-z]+) (\d+|x)$/))){ await amass(cap(m[1].replace(/s$/, '')), m[2] === 'x' ? await numOf('x', ctx, 'amass') : +m[2], ctx); return true; }
  if ((m = l.match(/^(~|it|each (.+?) you control) explores?$/))){ const list = m[1] === '~' || m[1] === 'it' ? [src()].filter(Boolean) : S.bf.filter(c => descOk(c.k, sing(m[2]), {tok:c.tok}) && isCreatureCard(c)); for (const c of list) await explore(c, ctx); return true; }
  // Map token: "Target creature you control explores" (also "up to one target creature you control explores")
  if ((m = l.match(/^(?:up to one )?target creature(?: you control)? explores$/))){ const ts = ctx.tgts ? nextTargets(ctx) : []; const t = ts.find(x => x.t === 'card');
    if (!t){ if (!UI.dry) log(`${ctx.name}: no creature to explore`); return true; }
    if (t.pid && t.pid !== MYPID){ sendRq(t.pid, 'r18kExplore', 0, ctx.name, {tid:t.id}); log(`${ctx.name}: ${t.nm || 'that creature'} explores`); commit(); return true; }
    const c = S.bf.find(x => x.id === t.id); if (c) await explore(c, ctx); else log(`${ctx.name}: the target is gone`); commit(); return true; }
  if ((m = l.match(/^(?:~|he|she|it) connives$/))){ await connive(src(), ctx); return true; }
  if ((m = l.match(/^each opponent blights (\d+)$/))){ opponents().forEach(p => sendRq(p.pid, 'blight', +m[1], ctx.name)); log(`${ctx.name}: each opponent blights ${m[1]}`); return true; }
  if ((m = l.match(/^(?:you )?blight (\d+)$/))){ await blightMe(+m[1], ctx.name); return true; }
  if ((m = l.match(/^earthbend (\d+|x)(?:, where x is .+)?$/))){ let n = m[1] === 'x' ? (countOf(l.split('where x is ')[1] || '', ctx) ?? await numOf('x', ctx, 'earthbend')) : +m[1]; await earthbend(n, ctx); return true; }
  if ((m = l.match(/^airbend up to one (?:other )?target (.+)$/))){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; bent('air'); if (!t){ log(`${ctx.name}: airbend — no target`); return true; }
    if (t.t === 'card'){ if (t.pid === MYPID){ moveCard(t.id, 'ex'); const c = find(t.id)[2]; if (c){ c.airK = 1; grantPlay([c.id], {cast:true, src:ctx.name, alt:'{2}'}); } } else sendRq(t.pid, 'exile', 0, ctx.name, {tid:t.id}); log(`airbent ${t.nm || 'the target'} (its owner may cast it for {2})`); }
    else handWarn(`Airbend ${t.nm || 'that spell'}: exile it; its owner may cast it for {2}`, ctx); commit(); return true; }
  if ((m = l.match(/^waterbend /))) { bent('water'); return false; }
  // “you get an emblem”, venture etc. handled elsewhere; transform / convert
  if ((m = l.match(/^(?:transform|convert) (~|it|him|her)$/)) || (m = l.match(/^you may (?:transform|convert) (~)$/))){ const c = src(); if (c && info(c.k)?.back){ c.fl = !c.fl; log(`${cname(c)} transformed`); if (c.fl && /^Super Nova — /m.test(info(c.k).back.o || '')){ const q = (info(c.k).back.o.match(/you get an emblem with "([^"]+)"/) || [])[1]; if (q) makeEmblem(q, cname(c)); } emit({type:'enter', k:c.k, id:c.id, tok:0, tf:1}); commit(); } else if (c && /More Than Meets the Eye|Living metal/i.test(info(c.k)?.o || '')) { c.fl = !c.fl; commit(); } return true; }
  if ((m = l.match(/^(?:put a \+1\/\+1 counter on ~ and convert it)$/))){ const c = src(); if (c){ modCounters(c, 'cp', 1); c.fl = !c.fl; log(`${cname(c)} converted`); commit(); } return true; }
  if ((m = l.match(/^exile ~, then return it to the battlefield transformed under its owner's control$/)) || (m = l.match(/^exile ~$/)) && /return it to the battlefield transformed/.test(String(ctx.full || '').toLowerCase())){ const c = src(); if (c){ c.fl = !c.fl; c.tap = false; c.cp = c.cm = 0; c.lore = 0; log(`${cname(c)} was exiled and returned transformed`); onEnter(c, 'ex'); commit(); } return true; }
  if (/^return it to the battlefield transformed under its owner's control$/.test(l)) return true;
  if ((m = l.match(/^exile (?:esper terra|~), then return it to the battlefield$/))){ const c = src(); if (c){ c.fl = false; c.lore = 0; log(`${cname(c)} was exiled and returned`); commit(); } return true; }
  // Vivi, Helga, and other “X and it deals …” / “you draw, gain, and put” lists
  if ((m = l.match(/^(put .+? counters? on ~) and (?:it|~) deals (.+)$/))){ await say(s.slice(0, m[1].length)); await say('~ deals ' + s.slice(s.length - m[2].length)); return true; }
  if ((m = l.match(/^you draw (a card|two cards), gain (\d+) life, and (put .+)$/))){ await say('Draw ' + m[1]); await say(`You gain ${m[2]} life`); await say(s.slice(s.length - m[3].length)); return true; }
  if ((m = l.match(/^you draw a card and you lose (\d+) life$/))){ draw(1); S.life -= +m[1]; log(`drew a card and lost ${m[1]} life`); commit(); return true; }
  if ((m = l.match(/^you draw a card and lose (\d+) life$/))){ draw(1); S.life -= +m[1]; log(`drew a card and lost ${m[1]} life`); commit(); return true; }
  if ((m = l.match(/^put a \+1\/\+1 counter on ~ and draw a card$/))){ const c = src(); if (c) modCounters(c, 'cp', 1); draw(1); commit(); return true; }
  if ((m = l.match(/^you gain (\d+) life, draw (\w+) cards?, put (\w+) \+1\/\+1 counters on (?:him|her|it|~), and (?:he|she|it|~) deals (\d+) damage to each opponent$/))){ gainLife(+m[1], ctx.name); draw(wn(m[2]) || 1); const c = src(); if (c) modCounters(c, 'cp', wn(m[3]) || 1); await say(`~ deals ${m[4]} damage to each opponent`); commit(); return true; }
  if ((m = l.match(/^draw a card and proliferate$/))){ draw(1); await say('Proliferate'); return true; }
  // opponents drawing
  if ((m = l.match(/^(target opponent|target player|that player|each other player|each opponent) draws? (a|one|two|three|\d+) cards?$/))){
    const n = wn(m[2]) || 1; let pids = [];
    if (/^target/.test(m[1])){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; pids = t ? [t.pid] : []; }
    else if (m[1] === 'that player') pids = [ctx.it && (ctx.it.evDp || ctx.it.evPid)].filter(Boolean);
    else pids = opponents().map(p => p.pid);
    pids.forEach(pid => { if (pid === MYPID) draw(n); else sendRq(pid, 'draw', n, ctx.name); }); log(`${ctx.name}: ${pids.map(nameOf).join(', ') || 'nobody'} draw${n > 1 ? ' ' + n : 's a card'}`); commit(); return true;
  }
  if ((m = l.match(/^you and that player each draw (\d+|that many) cards?$/))){ const n = m[1] === 'that many' ? (ctx.it && ctx.it.evN) || 1 : +m[1]; draw(n); const pid = ctx.it && (ctx.it.evDp || ctx.it.evPid); if (pid && pid !== MYPID) sendRq(pid, 'draw', n, ctx.name); commit(); return true; }
  if ((m = l.match(/^you draw that many cards$/))){ draw((ctx.it && ctx.it.evN) || 1); commit(); return true; }
  // Kefka, Celes, Vohar, Windgrace: discards that count
  if ((m = l.match(/^each player discards a card$/))){ await discardTracked(1, ctx); opponents().forEach(p => sendRq(p.pid, 'discard', 1, ctx.name)); ctx.discWait = true; return true; }
  if ((m = l.match(/^(?:then )?you draw a card for each card type among cards discarded this way$/))){
    const mine = new Set((ctx.discCards || []).flatMap(c => typesOf(c.k)));
    const n = UI.dry ? mine.size : await askNumber(`${ctx.name}: how many card types among all the discarded cards? (yours: ${[...mine].join(', ') || 'none'})`, 'Check what the others discarded in the log.', mine.size);
    if (n) draw(n); commit(); return true;
  }
  if ((m = l.match(/^discard any number of cards$/))){ await discardTracked(0, ctx, true); return true; }
  if ((m = l.match(/^draw that many cards plus one$/))){ draw((ctx.discN || 0) + 1); commit(); return true; }
  if ((m = l.match(/^draw a card, then discard a card$/)) && /discarded this way|the discarded card/.test(String(ctx.full || '').toLowerCase())){ draw(1); await discardTracked(1, ctx); return true; }
  if ((m = l.match(/^discard a card$/)) && /discarded this way|the discarded card/.test(String(ctx.full || '').toLowerCase())){ await discardTracked(1, ctx); return true; }
  if ((m = l.match(/^if you discarded an instant or sorcery card this way, (.+)$/))){ if (ctx.discIS) await say(s.slice(s.length - m[1].length)); return true; }
  if ((m = l.match(/^if a land card is discarded this way, (.+)$/))){ if (ctx.discLand) await say(s.slice(s.length - m[1].length).replace(/an additional card/i, 'a card')); return true; }
  if ((m = l.match(/^draw cards equal to the sacrificed creature's toughness$/))){ const c = ctx.sacd; const n = c ? (parseInt(info(c.k)?.t) || 0) + (c.cp || 0) - (c.cm || 0) : await askNumber(`${ctx.name}: the sacrificed creature's toughness`, '', 1); if (n > 0) draw(n); commit(); return true; }
  if ((m = l.match(/^discard cards equal to its power$/))){ const c = ctx.sacd; const n = c ? Math.max(0, (parseInt(info(c.k)?.p) || 0) + (c.cp || 0) - (c.cm || 0)) : await askNumber(`${ctx.name}: the sacrificed creature's power`, '', 1); if (n > 0) await discardTracked(n, ctx); return true; }
  if ((m = l.match(/^you may discard your hand$/))){ if (await askYes(`${ctx.name}: discard your hand?`)){ ctx.mayYes = true; UI.discarding = []; S.hand.slice().forEach(c => moveCard(c.id, 'gy')); UI.discarding = null; log('discarded their hand'); commit(); } else ctx.mayYes = false; return true; }
  // sacrifice-as-cost effects
  if ((m = l.match(/^(?:you may )?sacrifice any number of other creatures$/))){ const list = S.bf.filter(c => isCreatureCard(c) && c.id !== ctx.srcId && !c.fd); const ids = await pickCards({title:`${ctx.name}: sacrifice any number of other creatures`, cards:list, min:0, max:list.length, noneLabel:'None'}); (ids || []).forEach(id => moveCard(id, 'gy', {sac:true})); ctx.mayYes = !!(ids && ids.length); ctx.it && (ctx.it.evN = (ids || []).length); commit(); return true; }
  if ((m = l.match(/^sacrifice ~ unless you sacrifice an? (.+)$/))){ const d = sing(m[1]); const list = S.bf.filter(c => descOk(c.k, d, {tok:c.tok}) && c.id !== ctx.srcId); const ids = list.length ? await pickCards({title:`${ctx.name}: sacrifice a ${d}, or ${ctx.name} is sacrificed`, cards:list, min:0, max:1, noneLabel:`Sacrifice ${ctx.name}`}) : []; if (ids && ids.length) moveCard(ids[0], 'gy', {sac:true}); else if (ctx.srcId != null && find(ctx.srcId)[0] === 'bf') moveCard(ctx.srcId, 'gy', {sac:true}); commit(); return true; }
  if ((m = l.match(/^sacrifice (?:it|~) unless it escaped$/))){ const c = src(); if (c && !c.esc && find(c.id)[0] === 'bf'){ moveCard(c.id, 'gy', {sac:true}); log(`${cname(c)} is sacrificed (it didn't escape)`); } commit(); return true; }
  if ((m = l.match(/^(?:at the beginning of (?:your|the) next end step, )?sacrifice (it|that token|them) unless you pay (.+)$/))){ const ids = (ctx.lastT || []).map(t => t.id).concat(ctx.lastTok || []); const cost = m[2]; ids.forEach(id => S.dly.push({id:rid(6), eff:`You may pay ${cost}. If you don't, sacrifice it.`, k:ctx.k, nm:ctx.name, srcId:id, op:'payOrSac', cost})); log(`${ctx.name}: at the next end step, pay ${cost} or sacrifice it`); commit(); return true; }
  if ((m = l.match(/^sacrifice (it|them) at the beginning of (?:your|the) next end step$/))){ const ids = (ctx.lastTok || []).concat((ctx.lastT || []).map(t => t.id)); ids.forEach(id => S.dly.push({id:rid(6), eff:'Sacrifice it.', k:ctx.k, nm:ctx.name, srcId:id, op:'sac'})); commit(); return true; }
  if ((m = l.match(/^you may pay (.+?)\. if you don't, sacrifice it$/)) || (m = l.match(/^you may pay (.+?)$/)) && ctx.it && ctx.it.dop === 'payOrSac'){ return false; }
  // targeted one-offs
  if ((m = l.match(/^goad target creature (?:that player|target player) controls$/))){ const pid = ctx.it && (ctx.it.evDp || ctx.it.evPid); if (!pid || pid === MYPID){ log(`${ctx.name}: no player`); return true; } const st = OPP.get(pid); const list = ((st && st.bf) || []).filter(c => c.k && isCreatureCard(c)); if (!list.length) return true; const ids = await pickCards({title:`${ctx.name}: goad a creature ${nameOf(pid)} controls`, cards:list.map(c => ({...c})), min:1, max:1}); if (ids && ids.length) sendRq(pid, 'goad', 0, ctx.name, {tid:ids[0]}); return true; }
  if ((m = l.match(/^up to one target creature can't block this turn$/))){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (t) applyTo(t, {op:'pump', src:ctx.name, f:{p:0, t:0, kw:['cantblock']}}); return true; }
  if ((m = l.match(/^creatures can't block this turn$/))){ S.noBlock = turnStr(); log(`${ctx.name}: creatures can't block this turn`); commit(); return true; }
  if ((m = l.match(/^(~|target creature) can't be blocked this turn$/))){ const c = m[1] === '~' ? src() : null; if (c){ c.ekw = [...new Set([...(c.ekw || []), 'unblockable'])]; commit(); } else { const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (t) applyTo(t, {op:'pump', src:ctx.name, f:{p:0, t:0, kw:['unblockable']}}); } return true; }
  if ((m = l.match(/^target creature (?:you control )?(?:has base power and toughness (\d+)\/(\d+)|assigns combat damage equal to its toughness rather than its power) (?:until end of turn|this turn)$/))){
    const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (!t) return true; const c = t.pid === MYPID ? S.bf.find(x => x.id === t.id) : null;
    if (m[1]){ if (c){ const st = stats(c); const d = [+m[1] - (st[0] - (c.pu ? c.pu[0] : 0) - (c.cp || 0) + (c.cm || 0)), +m[2] - (st[1] - (c.pu ? c.pu[1] : 0) - (c.cp || 0) + (c.cm || 0))]; c.pu = [(c.pu ? c.pu[0] : 0) + d[0], (c.pu ? c.pu[1] : 0) + d[1]]; log(`${cname(c)} has base power and toughness ${m[1]}/${m[2]} until end of turn`); } else handWarn(`${t.nm}: base power and toughness ${m[1]}/${m[2]} until end of turn`, ctx); }
    else if (c){ c.tdt = turnStr(); log(`${cname(c)} assigns combat damage equal to its toughness this turn`); }
    commit(); return true;
  }
  if ((m = l.match(/^(?:that player|target player) gets two poison counters$/))){ const pid = ctx.it && (ctx.it.evDp || ctx.it.evPid); if (pid && pid !== MYPID){ sendRq(pid, 'psn', 2, ctx.name); log(`${nameOf(pid)} gets two poison counters`); } return true; }
  if ((m = l.match(/^you gain life equal to that creature's toughness$/))){ const c = ctx.it && S.bf.find(x => x.id === ctx.it.evId); const n = c ? Math.max(0, stats(c)[1]) : 0; if (n) gainLife(n, ctx.name); commit(); return true; }
  if ((m = l.match(/^~ deals damage equal to that spell's mana value to that player or a planeswalker that player controls$/))){ const pid = ctx.randOpp; const n = ctx.it && ctx.it.evk ? info(ctx.it.evk)?.mv || 0 : 0; if (pid && n) dealDamage({t:'player', pid}, n, ctx.k, src()); return true; }
  if ((m = l.match(/^choose an opponent at random$/))){ const o = opponents(); ctx.randOpp = o.length ? o[Math.floor(Math.random() * o.length)].pid : null; if (ctx.randOpp) log(`${ctx.name}: chose ${nameOf(ctx.randOpp)} at random`); return true; }
  if ((m = l.match(/^~ deals damage to that player equal to the number of creatures that player controls that didn't attack this turn$/))){ const pid = ctx.it && ctx.it.evPid; if (!pid) return true; let n;
    if (pid === MYPID){ const atk = new Set((S.ev || []).filter(e => e.type === 'attack').map(e => e.id)); n = S.bf.filter(c => isCreatureCard(c) && !atk.has(c.id) && !c.fd).reduce((a, c) => a + (c.n || 1), 0); dealDamage({t:'player', pid}, n, ctx.k, src()); }
    else { const st = OPP.get(pid); const atk = new Set(((st && st.ev) || []).filter(e => e.type === 'attack' && String(e.n) && true).map(e => e.id)); n = ((st && st.bf) || []).filter(c => c.k && isCreatureCard(c) && !atk.has(c.id)).reduce((a, c) => a + (c.n || 1), 0); dealDamage({t:'player', pid}, n, ctx.k, src()); }
    return true; }
  if ((m = l.match(/^~ deals (\d+) damage to each opponent and each planeswalker you don't control$/))){ await say(`~ deals ${m[1]} damage to each opponent`); for (const [pid, st] of OPP) (st.bf || []).filter(c => c.k && /Planeswalker/.test(info(c.k)?.t || '')).forEach(c => dealDamage({t:'card', pid, id:c.id, k:c.k}, +m[1], ctx.k, src())); return true; }
  if ((m = l.match(/^(?:it|~) deals x damage to each opponent and you gain x life, where x is (.+)$/))){ const n = countOf(m[1], ctx) || 0; opponents().forEach(p => dealDamage({t:'player', pid:p.pid}, n, ctx.k, src())); if (n) gainLife(n, ctx.name); commit(); return true; }
  if ((m = l.match(/^each opponent loses x life and you scry x, where x is (.+)$/))){ const n = countOf(m[1], ctx) || 0; opponents().forEach(p => loseLife(p.pid, n, ctx.name)); if (n) await say(`Scry ${n}`); commit(); return true; }
  if ((m = l.match(/^each opponent mills x cards, where x is (.+)$/))){ const n = countOf(m[1], ctx) || 0; if (n) opponents().forEach(p => sendRq(p.pid, 'mill', n, ctx.name)); log(`${ctx.name}: each opponent mills ${n}`); return true; }
  if ((m = l.match(/^(?:that player|target player) mills that many cards$/))){ const pid = ctx.it && (ctx.it.evDp || ctx.it.evPid); const n = (ctx.it && ctx.it.evN) || 1; if (pid && pid !== MYPID) sendRq(pid, 'mill', n, ctx.name); return true; }
  if ((m = l.match(/^each opponent who didn't discard a nonland card this way loses (\d+) life$/))){ for (const p of opponents()){ const nl = await askYes(`${ctx.name}: did ${p.nm} discard a nonland card?`, 'Yes, nonland', 'No (land or nothing)'); if (!nl) loseLife(p.pid, +m[1], ctx.name); } commit(); return true; }
  if ((m = l.match(/^you get (that many|\d+) additional upkeep steps? after this phase$/))){ const n = m[1] === 'that many' ? (ctx.it && ctx.it.evN) || 1 : +m[1]; S.xUp = (S.xUp || 0) + n; log(`${ctx.name}: ${n} additional upkeep step${n === 1 ? '' : 's'} after this phase`); commit(); return true; }
  // counters: chorus, intel, finality, named ones; moving counters
  if ((m = l.match(/^put (an?|one|two|three|\d+) (chorus|intel|finality|charge|oil|stun|shield|lore|time|verse|quest|age|ki|memory) counters? on (~|it|each of them)$/))){
    const n = wn(m[1]) || 1; const list = m[3] === '~' ? [src()] : m[3] === 'each of them' ? (ctx.lastEx || []).map(id => find(id)[2]) : (ctx.lastT || []).map(t => find(t.id)[2]).concat(m[3] === 'it' && !(ctx.lastT || []).length ? [src()] : []);
    list.filter(Boolean).forEach(c => addNamed(c, m[2], n)); commit(); return true;
  }
  if ((m = l.match(/^(?:then )?if there are (\w+) or more (\w+) counters on ~, (.+)$/))){ const c = src(); const n = c ? ((c.nc || {})[m[2]] || 0) : 0; if (n >= (wn(m[1]) || 0)) await say(s.slice(s.length - m[3].length)); return true; }
  if ((m = l.match(/^you may cast the discarded card without paying its mana cost$/))){ const c = (ctx.discCards || [])[0]; if (c && S.gy.includes(c) && !isLand(c.k) && await askYes(`${ctx.name}: cast ${cname(c)} without paying its mana cost?`)){ UI.afterCast = () => {}; await beginCast(c, 'gy', {free:true}); } return true; }
  if ((m = l.match(/^move a counter from target creature you control onto a second target creature you control$/))){ const ts = ctx.tgts ? [nextTargets(ctx)[0], nextTargets(ctx)[0]] : []; const [a, b] = ts.map(t => t && S.bf.find(x => x.id === t.id)); if (!a || !b){ log(`${ctx.name}: needs two creatures`); return true; }
    const kinds = [['cp', '+1/+1'], ['cm', '-1/-1'], ...Object.keys(a.nc || {}).map(k => ['nc:' + k, k])].filter(([k]) => k.startsWith('nc:') ? (a.nc[k.slice(3)] || 0) > 0 : (a[k] || 0) > 0);
    if (!kinds.length){ log(`${cname(a)} has no counters`); return true; }
    const kd = kinds.length === 1 ? kinds[0][0] : await askChoice({title:`Move which counter from ${cname(a)}?`, options:kinds.map(([v, label]) => ({label, value:v}))});
    if (String(kd).startsWith('nc:')){ addNamed(a, kd.slice(3), -1); addNamed(b, kd.slice(3), 1); } else { a[kd]--; b[kd] = (b[kd] || 0) + 1; }
    log(`moved a counter from ${cname(a)} to ${cname(b)}`); commit(); return true; }
  // “up to X target creatures” from the milled count (Mothman)
  if ((m = l.match(/^put a \+1\/\+1 counter on each of up to x target creatures, where x is (.+)$/))){ const ts = []; let t; while (ctx.tgts && (t = nextTargets(ctx)[0])) ts.push(t); ts.forEach(t => { if (t.pid === MYPID){ const c = S.bf.find(x => x.id === t.id); if (c) modCounters(c, 'cp', 1); } else applyTo(t, {op:'ctr', n:1, src:ctx.name, d:'cp'}); }); commit(); return true; }
  if ((m = l.match(/^each player gets an? (rad|poison) counters?$/))){ addPC(m[1], 1); opponents().forEach(p => sendRq(p.pid, m[1] === 'poison' ? 'psn' : 'rad', 1, ctx.name)); return true; }
  // Equipment and auras
  if ((m = l.match(/^attach up to one target equipment you control to (?:it|~)$/))){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; const c = src(); const e = t && S.bf.find(x => x.id === t.id); if (e && c){ e.att = {pid:MYPID, id:c.id}; log(`attached ${cname(e)} to ${cname(c)}`); commit(); } return true; }
  if ((m = l.match(/^create an? (\w+) role token attached to (?:another )?target creature you control$/))){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; await createFromText(`Create a ${cap(m[1])} Role token`, ctx); const tok = S.bf.filter(x => /Role/.test(cname(x)) || /Role/.test(typeOf(x))).pop(); if (tok && t) tok.att = {pid:t.pid, id:t.id}; commit(); return true; }
  if ((m = l.match(/^you may search your library for an aura card with mana value less than or equal to that aura and with a different name than each aura you control, put that card onto the battlefield attached to ~, then shuffle$/))){
    const mv = ctx.it && ctx.it.evk ? info(ctx.it.evk)?.mv || 0 : 0; const names = new Set(S.bf.filter(c => /Aura/.test(typeOf(c))).map(c => info(c.k)?.n)); const list = S.lib.filter(c => /\bAura\b/.test(info(c.k)?.t || '') && (info(c.k)?.mv || 0) <= mv && !names.has(info(c.k)?.n));
    if (!(await askYes(`${ctx.name}: search for an Aura (mana value ${mv} or less, new name)?`))) return true; emit({type:'search', cnt:1});
    const ids = list.length ? await pickCards({title:`${ctx.name}: an Aura with mana value ${mv} or less`, cards:list, min:0, max:1, noneLabel:'Find nothing'}) : []; const c = ids && ids[0] && S.lib.find(x => x.id === ids[0]);
    if (c){ moveCard(c.id, 'bf'); const b = S.bf.find(x => x.id === c.id); if (b && src()) b.att = {pid:MYPID, id:src().id}; log(`put ${cname(c)} onto the battlefield attached to ${ctx.name}`); } shuffleLib(); commit(); return true; }
  // graveyards
  if ((m = l.match(/^return a land card from your graveyard to the battlefield tapped$/))){ const list = S.gy.filter(c => isLand(c.k)); if (!list.length){ log(`${ctx.name}: no land in the graveyard`); return true; } const ids = list.length === 1 ? [list[0].id] : await pickCards({title:`${ctx.name}: return a land card to the battlefield tapped`, cards:list, min:1, max:1}); if (ids && ids[0]){ moveCard(ids[0], 'bf'); const b = S.bf.find(x => x.id === ids[0]); if (b) b.tap = true; } commit(); return true; }
  if ((m = l.match(/^(?:then )?return all land cards from your graveyard to the battlefield tapped$/))){ S.gy.filter(c => isLand(c.k)).forEach(c => { moveCard(c.id, 'bf'); const b = S.bf.find(x => x.id === c.id); if (b) b.tap = true; }); commit(); return true; }
  if ((m = l.match(/^return up to (one|two|three) target land cards? from your graveyard to the battlefield$/))){ const ts = []; let t; while (ctx.tgts && (t = nextTargets(ctx)[0])) ts.push(t); ts.forEach(t => { if (t.pid === MYPID && find(t.id)[0] === 'gy') moveCard(t.id, 'bf'); }); commit(); return true; }
  if ((m = l.match(/^(?:when you do, )?return target (.+?) card (?:with (power \d+ or less|mana value less than or equal to (.+?)) )?from your graveyard to the battlefield( tapped)?$/))){
    if (/^when you do, /.test(l) && ctx.didPay === false) return true;
    const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; let c = t && find(t.id)[0] === 'gy' ? find(t.id)[2] : null;
    if (!c){ const d = sing(m[1]); let lim = Infinity, pw = Infinity; if (m[3]) lim = countOf(m[3], ctx) ?? Infinity; const pm = (m[2] || '').match(/power (\d+) or less/); if (pm) pw = +pm[1];
      const list = S.gy.filter(x => descOk(x.k, d) && (info(x.k)?.mv || 0) <= lim && (parseInt(info(x.k)?.p) || 0) <= pw); if (!list.length){ log(`${ctx.name}: no legal card in the graveyard`); return true; }
      const ids = await pickCards({title:`${ctx.name}: return a ${m[1]} card${m[2] ? ' with ' + m[2] : ''}`, cards:list, min:0, max:1, noneLabel:'None'}); c = ids && ids[0] && S.gy.find(x => x.id === ids[0]); }
    if (c){ moveCard(c.id, 'bf'); const b = S.bf.find(x => x.id === c.id); if (b && m[4]) b.tap = true; if (b) b.fromGy = 1; } commit(); return true; }
  if ((m = l.match(/^return up to one target creature card with mana value less than or equal to (.+?) from your graveyard to the battlefield$/))){ const lim = countOf(m[1], ctx) ?? 0; const list = S.gy.filter(x => isCreatureCard(x) && (info(x.k)?.mv || 0) <= lim); if (!list.length){ log(`${ctx.name}: no creature card with mana value ${lim} or less`); return true; } const ids = await pickCards({title:`${ctx.name}: return a creature card with mana value ${lim} or less`, cards:list, min:0, max:1, noneLabel:'None'}); if (ids && ids[0]) moveCard(ids[0], 'bf'); commit(); return true; }
  if ((m = l.match(/^put a number of \+1\/\+1 counters on up to one other target creature you control equal to (.+)$/))){ const n = countOf(m[1], ctx) || 0; const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; const c = t && S.bf.find(x => x.id === t.id); if (c && n) modCounters(c, 'cp', n); commit(); return true; }
  if ((m = l.match(/^return ~ and up to one other target creature card from your graveyard to the battlefield$/))){ const me = S.gy.find(c => c.k === ctx.k) || (ctx.srcId != null && find(ctx.srcId)[0] === 'gy' ? find(ctx.srcId)[2] : null); if (me) moveCard(me.id, 'bf'); const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (t && find(t.id)[0] === 'gy') moveCard(t.id, 'bf'); commit(); return true; }
  if ((m = l.match(/^return a nonland card of an opponent's choice from your graveyard to your hand$/))){ const list = S.gy.filter(c => !isLand(c.k)); if (!list.length) return true; const ids = await pickCards({title:`${ctx.name}: return the nonland card your opponents choose`, hint:'Your opponents pick — ask them, then click it.', cards:list, min:1, max:1}); if (ids && ids[0]) moveCard(ids[0], 'hand'); commit(); return true; }
  if ((m = l.match(/^(?:you may )?cast (?:that card|target (.+?) card from your graveyard) this turn$/))){ const ids = (ctx.lastT || []).map(t => t.id).concat(((ctx.tgts ? nextTargets(ctx) : []) || []).map(t => t.id)).filter(id => find(id)[0] === 'gy'); if (!ids.length){ log(`${ctx.name}: nothing to cast`); return true; } S.gyOk = (S.gyOk || []).concat(ids.map(id => ({id, t:turnStr(), ex:/exile it instead/.test(String(ctx.full || '').toLowerCase())}))); log(`${ctx.name}: may cast ${ids.map(id => cname(find(id)[2])).join(', ')} from the graveyard this turn`); commit(); return true; }
  if (/^if that spell would be put into your graveyard, exile it instead$/.test(l)) return true;
  if ((m = l.match(/^put up to one (.+?) card milled this way into your hand$/))){ const d = sing(m[1]); const list = (ctx.milled || []).filter(c => S.gy.includes(c) && descOk(c.k, d)); if (!list.length) return true; const ids = await pickCards({title:`${ctx.name}: put a ${m[1]} card into your hand`, cards:list, min:0, max:1, noneLabel:'None'}); if (ids && ids[0]) moveCard(ids[0], 'hand'); commit(); return true; }
  if ((m = l.match(/^mill (\w+) cards?$/)) && /milled this way|an? .+ card was milled/.test(String(ctx.full || '').toLowerCase())){ UI.millLog = []; mill(wn(m[1]) || 1); ctx.milled = UI.millLog; UI.millLog = null; commit(); return true; }
  if ((m = l.match(/^create a 1\/1 black and green insect creature token, then mill a card$/))){ for (let i = 0; i < 40; i++){ await createFromText('Create a 1/1 black and green Insect creature token', ctx); UI.millLog = []; mill(1); const got = UI.millLog; UI.millLog = null; if (!got.length || !/\bInsect\b/.test(info(got[0].k)?.t || '')) break; const c = src(); if (c){ c.co = (c.co || 0) + 1; log(`milled an Insect: +1 loyalty, repeat`); } } commit(); return true; }
  if (/^if an insect card was milled this way, put a loyalty counter on ~ and repeat this process$/.test(l)) return true;
  if ((m = l.match(/^choose target (.+?) card in an opponent's graveyard that was put there from their library this turn$/))){ const opts = []; for (const [pid, st] of OPP) (st.gy || []).forEach(k => descOk(k, sing(m[1].replace(/ or /, ' or '))) && opts.push({pid, k}));
    if (!opts.length){ log(`${ctx.name}: nothing milled to take`); ctx.lastOppGy = null; return true; }
    const v = await askChoice({title:`${ctx.name}: choose a ${m[1]} card milled from an opponent's library this turn`, options:opts.slice(-12).map((o, i) => ({label:`${info(o.k)?.n} (${nameOf(o.pid)})`, value:String(i)}))}); ctx.lastOppGy = v != null ? opts.slice(-12)[+v] : null; return true; }
  if ((m = l.match(/^put it onto the battlefield under your control$/)) && ctx.lastOppGy !== undefined){ const o = ctx.lastOppGy; if (o){ sendRq(o.pid, 'gytake', 0, ctx.name, {d:o.k}); handWarn(`Take ${info(o.k)?.n} from ${nameOf(o.pid)}'s graveyard and put it onto your battlefield (use the card's menu once they hand it over)`, ctx); } return true; }
  // exile from opponents' libraries and cast (Maralen, Kotis)
  if ((m = l.match(/^exile the top (two|three|x|\d+) cards of (target opponent's|their) library(?:, where x is (.+))?$/))){ const n = m[1] === 'x' ? (countOf(m[3] || '', ctx) ?? (ctx.it && ctx.it.evN) ?? 1) : (wn(m[1]) || 1); const pid = /target/.test(m[2]) ? ((ctx.tgts ? nextTargets(ctx) : [])[0] || {}).pid : ctx.it && (ctx.it.evDp || ctx.it.evPid); if (!pid || pid === MYPID){ log(`${ctx.name}: no opponent`); return true; } sendRq(pid, 'exileTop', n, ctx.name); ctx.oppEx = {pid, n}; handWarn(`${nameOf(pid)} exiles the top ${n} card${n === 1 ? '' : 's'} of their library for ${ctx.name}: you may cast from among them as the card says (use the Exile view)`, ctx); return true; }
  if ((m = l.match(/^you may cast any number of spells with mana value x or less from among them without paying their mana costs$/))) return true;
  // reveal until / dig variants
  if ((m = l.match(/^reveal cards from the top of your library until you reveal an? (.+?) card$/))){ const d = sing(m[1]); const {hit, rest} = await revealUntil(c => descOk(c.k, d), ctx.name); ctx.untilHit = hit; ctx.untilRest = rest; ctx.lastEx = hit ? [hit.id] : []; return true; }
  if ((m = l.match(/^(?:you may )?put that card onto the battlefield(?: (tapped and attacking|tapped))?(?: and the rest on the bottom of your library in a random order)?$/)) && (ctx.untilHit !== undefined || ctx.untilRest)){
    const h = ctx.untilHit; ctx.untilHit = null;
    if (h && S.ex.includes(h) && (!/^you may/.test(l) || await askYes(`${ctx.name}: put ${cname(h)} onto the battlefield?`))){ S.ex.splice(S.ex.indexOf(h), 1); S.lib.unshift(h); moveCard(h.id, 'bf'); const b = S.bf.find(x => x.id === h.id); if (b && m[1]) b.tap = true; if (b && /attacking/.test(m[1] || '')) b.atk = attackDefFor(ctx); log(`put ${cname(h)} onto the battlefield${m[1] ? ' ' + m[1] : ''}`); }
    if (/the rest on the bottom/.test(l) && ctx.untilRest){ bottomRandom(ctx.untilRest.concat(h && S.ex.includes(h) ? [h] : [])); ctx.untilRest = null; }
    commit(); return true;
  }
  if (/^then shuffle$/.test(l) && ctx.untilRest){ const left = ctx.untilRest.concat(ctx.untilHit && S.ex.includes(ctx.untilHit) ? [ctx.untilHit] : []); left.forEach(c => { const i = S.ex.indexOf(c); if (i >= 0){ S.ex.splice(i, 1); S.lib.push(c); } }); shuffleLib(); ctx.untilRest = null; commit(); return true; }
  if ((m = l.match(/^look at (\d+|that many) cards from the top of your library$/))){ await say(`Look at the top ${m[1] === 'that many' ? (ctx.it && ctx.it.evN) || 1 : m[1]} cards of your library`); return true; }
  if ((m = l.match(/^for each card type, you may put a card of that type from among the revealed cards into your hand$/))) return true;
  if ((m = l.match(/^reveal the top (\w+) cards of your library$/)) && /for each card type, you may put a card of that type/.test(String(ctx.full || '').toLowerCase())){
    const n = wn(m[1]) || 10; const top = S.lib.slice(0, n); log(`revealed ${top.map(cname).join(', ')}`);
    const ids = await pickCards({title:`${ctx.name}: take up to one card of each card type`, hint:'Each card type (artifact, battle, creature, enchantment, instant, land, planeswalker, sorcery) at most once. The rest go to the bottom in a random order.', cards:top, min:0, max:top.length, noneLabel:'Take nothing'});
    const used = new Set(); const take = [];
    for (const id of ids || []){ const c = top.find(x => x.id === id); const ty = typesOf(c.k).find(t => !used.has(t)); if (ty){ typesOf(c.k).forEach(t => 0); used.add(ty); take.push(c); } }
    take.forEach(c => { S.lib.splice(S.lib.indexOf(c), 1); S.hand.push(c); }); const rest = top.filter(c => !take.includes(c)); rest.forEach(c => S.lib.splice(S.lib.indexOf(c), 1)); shuffle(rest); S.lib.push(...rest);
    log(`put ${take.map(cname).join(', ') || 'nothing'} into their hand; the rest on the bottom`); ctx.looked = true; commit(); return true;
  }
  if ((m = l.match(/^look at the top (\w+|\d+) cards of your library$/)) && /you may put one of them into your hand\. then put any number of land cards from among them onto the battlefield tapped and the rest into your graveyard/.test(String(ctx.full || '').toLowerCase().replace(/\n/g, ' '))){
    const n = wn(m[1]) || +m[1] || (ctx.it && ctx.it.evN) || 1; const top = S.lib.slice(0, n);
    const one = await pickCards({title:`${ctx.name}: put one into your hand`, cards:top, min:0, max:1, noneLabel:'None'}); const h = one && one[0] && top.find(c => c.id === one[0]);
    const lands = top.filter(c => c !== h && isLand(c.k)); const ls = lands.length ? await pickCards({title:`${ctx.name}: lands onto the battlefield tapped`, cards:lands, min:0, max:lands.length, noneLabel:'None'}) : [];
    top.forEach(c => S.lib.splice(S.lib.indexOf(c), 1));
    if (h) S.hand.push(h); top.forEach(c => { if (c === h) return; if ((ls || []).includes(c.id)){ S.lib.unshift(c); moveCard(c.id, 'bf'); const b = S.bf.find(x => x.id === c.id); if (b) b.tap = true; } else S.gy.push(c); });
    ctx.looked = true; log(`${ctx.name}: looked at ${top.length}`); commit(); return true;
  }
  if ((m = l.match(/^scry 1, then reveal the top card of your library$/))) { await say('Scry 1'); const c = S.lib[0]; ctx.lastRev = c; if (c) log(`revealed ${cname(c)}`); return true; }
  if ((m = l.match(/^reveal the top card of your library$/)) && /if it's a land card, put it onto the battlefield/.test(String(ctx.full || '').toLowerCase())){ const c = S.lib[0]; ctx.lastRev = c; if (c) log(`revealed ${cname(c)}`); return true; }
  if ((m = l.match(/^if it's a land card, put it onto the battlefield( tapped)?$/))){ const c = ctx.lastRev; if (c && isLand(c.k) && S.lib[0] === c){ moveCard(c.id, 'bf'); const b = S.bf.find(x => x.id === c.id); if (b && m[1]) b.tap = true; ctx.condResult = true; } else ctx.condResult = false; commit(); return true; }
  if (/^otherwise, draw a card$/.test(l) && ctx.condResult === false){ draw(1); ctx.condResult = null; commit(); return true; }
  if ((m = l.match(/^exile the top card of your library$/)) && /target opponent loses life equal to its mana value|if it's an instant or sorcery card, you may cast it/.test(String(ctx.full || '').toLowerCase())){ const c = S.lib[0]; if (c){ moveCard(c.id, 'ex'); ctx.lastMV = info(c.k)?.mv || 0; ctx.lastExC = c; ctx.lastEx = [c.id]; log(`exiled ${cname(c)} from the top`); } return true; }
  if ((m = l.match(/^target opponent loses life equal to its mana value$/))){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (t && ctx.lastMV) loseLife(t.pid, ctx.lastMV, ctx.name); return true; }
  if ((m = l.match(/^if it's an instant or sorcery card, you may cast it without paying its mana cost$/))){ const c = ctx.lastExC; if (c && S.ex.includes(c) && /\b(Instant|Sorcery)\b/.test(info(c.k)?.t || '') && await askYes(`${ctx.name}: cast ${cname(c)} without paying its mana cost?`)){ UI.afterCast = () => {}; await beginCast(c, 'ex', {free:true}); } return true; }
  if ((m = l.match(/^exile (that many|\d+) cards from the top of your library( face down)?$/))){ const n = m[1] === 'that many' ? (ctx.it && ctx.it.evN) || 1 : +m[1]; const top = S.lib.slice(0, n); top.forEach(c => moveCard(c.id, 'ex')); ctx.lastEx = top.map(c => c.id); log(`exiled ${top.length} card${top.length === 1 ? '' : 's'} from the top${m[2] ? ' face down' : ''}`); return true; }
  if ((m = l.match(/^choose one of them$/)) && ctx.lastEx && ctx.lastEx.length){ const list = ctx.lastEx.map(id => find(id)[2]).filter(Boolean); const ids = list.length <= 1 ? list.map(c => c.id) : await pickCards({title:`${ctx.name}: choose one of them`, cards:list, min:1, max:1}); ctx.lastEx = ids || []; return true; }
  if ((m = l.match(/^until the end of your next turn, you may play that card$/)) && ctx.lastEx){ grantPlay(ctx.lastEx, {cast:false, src:ctx.name, long:true}); return true; }
  if ((m = l.match(/^put all exiled cards you own with intel counters on them into your hand$/))){ S.ex.filter(c => (c.nc || {}).intel).forEach(c => moveCard(c.id, 'hand')); commit(); return true; }
  // tokens and copies
  if ((m = l.match(/^create a token that's a copy of it, except it's a (\d+)\/(\d+) black zombie$/)) || (m = l.match(/^create a (tapped )?token that's a copy of that card, except it's a (\d+)\/(\d+) black zombie$/))){
    const k = (ctx.lastT && ctx.lastT[0] && ctx.lastT[0].k) || (ctx.it && (ctx.it.evk || (ctx.it.evKs || [])[0])); if (!k){ log(`${ctx.name}: nothing to copy`); return true; }
    const p = m.length === 3 ? m[1] : m[2], t = m.length === 3 ? m[2] : m[3]; const id = await createToken(k, 1, null, {pt:`${p}/${t}`, zombie:true});
    const tk = S.bf.filter(c => c.tok && c.k === k).pop(); if (tk){ tk.zb = [+p, +t]; if (/tapped/.test(l)) tk.tap = true; } log(`created a ${p}/${t} black Zombie copy of ${info(k)?.n}`); commit(); return true; }
  if ((m = l.match(/^exile target creature card from a graveyard$/))){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (!t){ log(`${ctx.name}: no target`); return true; } if (t.pid === MYPID) moveCard(t.id, 'ex'); else sendRq(t.pid, 'gytake', 0, ctx.name, {d:t.k, ex:1}); ctx.lastT = [t]; return true; }
  if ((m = l.match(/^create a token that's a copy of target nonlegendary enchantment you control$/))){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; const c = t && S.bf.find(x => x.id === t.id); if (!c) return true; await createToken(c.k, 1); const tk = S.bf.filter(x => x.tok && x.k === c.k).pop(); ctx.lastT = tk ? [{t:'card', pid:MYPID, id:tk.id, k:tk.k}] : []; ctx.lastTok = tk ? [tk.id] : []; return true; }
  if ((m = l.match(/^(?:it|the token) gains haste(?: until end of turn)?$/))){ const ids = (ctx.lastTok || []).concat((ctx.lastT || []).map(t => t.id)); ids.forEach(id => { const c = S.bf.find(x => x.id === id); if (c) c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; }); commit(); return true; }
  if ((m = l.match(/^if it's a saga, put up to three lore counters on it$/))){ const c = (ctx.lastTok || []).map(id => S.bf.find(x => x.id === id))[0]; if (c && sagaChapters(c)){ const n = await askNumber(`${ctx.name}: lore counters to add (0–3)`, '', 3); modCounters(c, 'lore', Math.min(3, n || 0)); } return true; }
  if ((m = l.match(/^create (?:a|one) tapped and attacking token that's a copy of up to one other target nontoken creature you control$/)) || (m = l.match(/^create a token that's a copy of up to one other target nontoken creature you control$/))){
    const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; const c = t && S.bf.find(x => x.id === t.id); if (!c) return true; await createToken(c.k, 1); const tk = S.bf.filter(x => x.tok && x.k === c.k).pop(); if (tk){ tk.tap = true; tk.sk = false; if (phaseNow().ph === 4) tk.atk = attackDefFor(ctx); } ctx.lastTok = tk ? [tk.id] : []; ctx.lastT = tk ? [{t:'card', pid:MYPID, id:tk.id, k:tk.k}] : []; commit(); return true; }
  if ((m = l.match(/^at the beginning of the next end step, sacrifice that token unless you pay an amount of \{e\} equal to its mana value$/))){ const ids = ctx.lastTok || []; ids.forEach(id => { const c = S.bf.find(x => x.id === id); const mv = c ? info(c.k)?.mv || 0 : 0; S.dly.push({id:rid(6), eff:`You may pay ${'{E}'.repeat(mv) || '{0}'}. If you don't, sacrifice it.`, k:ctx.k, nm:ctx.name, srcId:id, op:'payOrSac', cost:'{E}'.repeat(mv)}); }); commit(); return true; }
  if ((m = l.match(/^for each opponent, you create a 2\/2 black zombie creature token unless that player sacrifices a creature of their choice$/))){ for (const p of opponents()){ const yes = await askYes(`${ctx.name}: does ${p.nm} sacrifice a creature? (otherwise you get a 2/2 Zombie)`, 'They sacrifice one', 'They don\'t'); if (yes) sendRq(p.pid, 'sac', 1, ctx.name, {d:'creature'}); else await createFromText('Create a 2/2 black Zombie creature token', ctx); } return true; }
  if ((m = l.match(/^for each legendary enchantment you control, create (.+)$/))){ const n = S.bf.filter(c => /Legendary/.test(typeOf(c)) && /Enchantment/.test(typeOf(c))).length; for (let i = 0; i < n; i++) await createFromText('Create ' + s.slice(s.length - m[1].length), ctx); return true; }
  if ((m = l.match(/^if you control seven or more lands with different names, create (.+?) instead$/))) return true;
  if ((m = l.match(/^create a 0\/1 green plant creature token$/)) && /seven or more lands with different names/.test(String(ctx.full || '').toLowerCase())){ const n = countOf('lands you control with different names', ctx); await createFromText(n >= 7 ? 'Create a 2/2 black Zombie creature token' : 'Create a 0/1 green Plant creature token', ctx); return true; }
  if ((m = l.match(/^if you control (five|\w+) or more towns, (.+)$/))){ const n = countOf('towns you control', ctx); if (n >= (wn(m[1]) || 5)) await say(s.slice(s.length - m[2].length)); return true; }
  if ((m = l.match(/^create a (\d+)\/(\d+) elemental creature token that's all colors$/))){ await createFromText(`Create a ${m[1]}/${m[2]} white, blue, black, red, and green Elemental creature token`, ctx); return true; }
  if ((m = l.match(/^create a 0\/0 green hydra creature token, then put x \+1\/\+1 counters on it$/)) || (m = l.match(/^create a 0\/0 green hydra creature token$/)) && ctx.it && ctx.it.evk){ const x = ctx.it && ctx.it.evX != null ? ctx.it.evX : await numOf('x', ctx, 'X of that spell'); await createFromText('Create a 0/0 green Hydra creature token', ctx); const tk = S.bf.filter(c => c.tok && /Hydra/.test(cname(c))).pop(); if (tk && x) modCounters(tk, 'cp', x); commit(); return true; }
  if (/^put x \+1\/\+1 counters on it$/.test(l) && ctx.it && ctx.it.evX != null) return true;
  if ((m = l.match(/^create that many 1\/1 blue merfolk creature tokens$/)) || (m = l.match(/^create that many (.+?) tokens?$/)) && ctx.it && ctx.it.evk && !(ctx.it.evN)){ const sym = (info(ctx.it.evk)?.m || '').match(/\{[^}]*U[^}]*\}/g) || []; const n = sym.length || 1; await createFromText(`Create ${n} 1/1 blue Merfolk creature token${n === 1 ? '' : 's'}`, ctx); return true; }
  if ((m = l.match(/^create two treasure tokens$/))) return false;
  // spells on the stack
  if ((m = l.match(/^copy that spell$/))){ const sp = stackAll().filter(i => i.kind === 'spell' && (!ctx.it || !ctx.it.evId || i.id === ctx.it.evId || i.k === ctx.it.evk)).pop() || stackAll().filter(i => i.kind === 'spell').pop(); if (!sp){ log(`${ctx.name}: the spell is gone`); return true; } ctx.copyOf = sp; await copyMany({...ctx, it:{...(ctx.it || {}), copyOf:sp.sid}}, 1).catch(() => handWarn('Copy that spell', ctx)); return true; }
  if ((m = l.match(/^that spell gains deathtouch and lifelink$/))){ const sp = stackAll().filter(i => i.kind === 'spell').pop(); if (sp){ sp.dtll = 1; S.dtll = (S.dtll || []).concat(sp.sid); log(`${sp.nm} gains deathtouch and lifelink`); commit(); } return true; }
  if ((m = l.match(/^it gains "when this creature dies, exile it\."$/)) || (m = l.match(/^it gains "when ~ dies, exile it\."$/)) || /^it gains "when .+ dies, exile it/.test(l)){ const k = ctx.it && ctx.it.evk; S.dieEx = (S.dieEx || []).concat(k ? [k] : []); log(`${info(k)?.n || 'it'}: exiled when it dies`); commit(); return true; }
  // misc
  if ((m = l.match(/^untap each (.+?) you control$/))){ const d = sing(m[1]); S.bf.filter(c => descOk(c.k, d, {tok:c.tok})).forEach(c => { c.tap = false; c.tn = 0; }); log(`${ctx.name}: untapped each ${m[1]}`); commit(); return true; }
  if ((m = l.match(/^untap ~$/))){ const c = src(); if (c){ c.tap = false; c.tn = 0; commit(); } return true; }
  if ((m = l.match(/^put x \+1\/\+1 counters on each creature you control, where x is (.+)$/))){ const n = countOf(m[1], ctx) || 0; if (n) S.bf.filter(c => isCreatureCard(c) && !c.fd).forEach(c => modCounters(c, 'cp', n)); log(`${ctx.name}: ${n} +1/+1 counters on each creature`); commit(); return true; }
  if ((m = l.match(/^draw a card for each (.+)$/))){ const n = countOf(m[1].replace(/ you have$/, ' you have'), ctx); if (n != null){ if (n) draw(n); log(`${ctx.name}: drew ${n}`); commit(); return true; } }
  if ((m = l.match(/^(?:you may )?draw a card for each experience counter you have$/))){ const n = (S.pc || {}).experience || 0; if (n) draw(n); return true; }
  if ((m = l.match(/^put x \+1\/\+1 counters on (?:him|her|it|~)$/))){ const c = src(); const x = ctx.it && ctx.it.x ? ctx.it.x : (c && c.xv != null) ? c.xv : await numOf('x', ctx, 'X'); if (c && x) modCounters(c, 'cp', x); ctx.xv = x; commit(); return true; }
  if ((m = l.match(/^then draw half x cards, rounded down$/)) || (m = l.match(/^draw half x cards, rounded down$/))){ const x = ctx.xv ?? (ctx.it && ctx.it.x) ?? 0; const n = Math.floor(x / 2); if (n) draw(n); commit(); return true; }
  if ((m = l.match(/^then (.+?) gets \+x\/\+0 until end of turn, where x is (.+)$/)) || (m = l.match(/^(~) gets \+x\/\+0 until end of turn, where x is (.+)$/))){ const n = countOf(m[2], ctx) || 0; const c = src(); if (c){ c.pu = [(c.pu ? c.pu[0] : 0) + n, c.pu ? c.pu[1] : 0]; log(`${cname(c)} gets +${n}/+0`); commit(); } return true; }
  if ((m = l.match(/^double (?:~'s|its) power until end of turn$/))){ const c = src(); if (c){ const p = stats(c)[0]; c.pu = [(c.pu ? c.pu[0] : 0) + p, c.pu ? c.pu[1] : 0]; log(`${cname(c)}'s power doubles to ${p * 2}`); commit(); } return true; }
  if ((m = l.match(/^target creature gets \+(\d+)\/\+0 until end of turn for each card discarded this way$/))){ const n = ctx.it && ctx.it.evN || 1; return say(`Target creature gets +${2 * n}/+0 until end of turn`).then(() => true); }
  if ((m = l.match(/^whenever that creature deals combat damage to a player this turn, you draw a card$/))){ handWarn('Whenever that creature deals combat damage to a player this turn, draw a card', ctx); return true; }
  if ((m = l.match(/^choose (left or right|odd or even)$/))){ const opts = m[1].split(' or '); ctx.chosen = await askChoice({title:`${ctx.name}: choose ${m[1]}`, options:opts.map(o => ({label:cap(o), value:o}))}); log(`${ctx.name}: chose ${ctx.chosen}`); return true; }
  if ((m = l.match(/^destroy each other creature with mana value of the chosen quality$/))){ const odd = ctx.chosen === 'odd'; const ok = c => { const mv = info(c.k)?.mv || 0; return odd ? mv % 2 === 1 : mv % 2 === 0; }; S.bf.filter(c => isCreatureCard(c) && c.id !== ctx.srcId && ok(c)).forEach(c => destroyCard(c, ctx.name)); for (const [pid, st] of OPP) (st.bf || []).filter(c => c.k && isCreatureCard(c) && ok(c)).forEach(c => applyTo({t:'card', pid, id:c.id, k:c.k}, {op:'destroy', src:ctx.name})); commit(); return true; }
  if ((m = l.match(/^draw another card if the sacrificed permanent was a commander$/))){ if (ctx.sacd && ctx.sacd.cmd) draw(1); return true; }
  if ((m = l.match(/^put a card from your hand on the bottom of your library$/))){ if (!S.hand.length) return true; const ids = await pickCards({title:`${ctx.name}: put a card from your hand on the bottom of your library`, cards:S.hand.slice(), min:1, max:1}); const i = S.hand.findIndex(c => c.id === (ids || [])[0]); if (i >= 0) S.lib.push(S.hand.splice(i, 1)[0]); log('put a card from their hand on the bottom of their library'); commit(); return true; }
  if ((m = l.match(/^exile another target (planeswalker or creature|creature or planeswalker) you control$/))){ await say('Exile target ' + m[1]); return true; }
  if ((m = l.match(/^roll a six-sided die plus an additional six-sided die for each mana from treasures spent to activate this ability$/))){ const extra = UI.dry ? 0 : await askNumber(`${ctx.name}: how much mana from Treasures did you spend?`, '', 0); const n = 1 + (extra || 0); for (let i = 0; i < n; i++){ const r = 1 + Math.floor(Math.random() * 6); log(`🎲 ${ctx.name}: rolled a ${r}`); emit({type:'roll', x:r, cnt:1}); } commit(); return true; }
  if ((m = l.match(/^roll a (six|twenty|four|eight|ten|twelve)-sided die$/))){ const sides = {four:4, six:6, eight:8, ten:10, twelve:12, twenty:20}[m[1]]; const r = 1 + Math.floor(Math.random() * sides); ctx.roll = r; log(`🎲 ${ctx.name}: rolled a ${r}`); emit({type:'roll', x:r, cnt:1}); commit(); return true; }
  if ((m = l.match(/^create a 3\/3 colorless robot artifact creature token$/)) && /if you rolled 6 or higher/.test(String(ctx.full || '').toLowerCase()) && !ctx.r9robot){ ctx.r9robot = 1; await createFromText('Create a 3/3 colorless Robot artifact creature token', ctx); const last = (S.ev || []).slice().reverse().find(e => e.type === 'roll'); if (last && last.x >= 6) await createFromText('Create a Treasure token', ctx); ctx.r9robot = 0; return true; }
  if (/^if you rolled 6 or higher, instead create that token and a treasure token$/.test(l)) return true;
  if ((m = l.match(/^starting with you, each player votes for (\w+) or (\w+)$/))){ const a = m[1], b = m[2]; const votes = {[a]:0, [b]:0}; const extra = rulesOn('extraVote').length ? 2 : 1;
    for (let i = 0; i < extra; i++){ const v = await askChoice({title:`${ctx.name}: your vote${extra > 1 ? ' ' + (i + 1) : ''}`, options:[{label:cap(a), value:a}, {label:cap(b), value:b}]}); if (v) votes[v]++; }
    // each other player votes on their own screen, in turn order starting after you
    for (const p of opponents()){
      if (UI.dry){ votes[a]++; continue; }
      const ref = rid(6); UI.voteAns = UI.voteAns || {}; sendRq(p.pid, 'vote', 1, ctx.name, {ref, d:a + '|' + b}); commit(); toast(`Waiting for ${p.nm} to vote…`);
      const ans = await waitUntil(() => UI.voteAns[ref], 90000);
      if (ans){ ans.forEach(v => { if (v in votes) votes[v]++; }); log(`${p.nm} voted ${ans.join(' and ')}`); }
      else log(`${p.nm} didn't vote in time`);
    }
    ctx.votes = votes; log(`${ctx.name}: votes — ${a} ${votes[a]}, ${b} ${votes[b]}`); return true; }
  if ((m = l.match(/^for each (\w+) vote, (.+)$/)) && ctx.votes){ const n = ctx.votes[m[1]] || 0; for (let i = 0; i < n; i++) await say(s.slice(s.length - m[2].length)); return true; }
  if ((m = l.match(/^investigate$/))){ await createFromText('Create a Clue token', ctx); return true; }
  if ((m = l.match(/^you may exile any number of cards from your graveyard with four or more card types among them$/))){
    const ids = await pickCards({title:`${ctx.name}: exile cards from your graveyard with four or more card types among them`, cards:S.gy.slice(), min:0, max:S.gy.length, noneLabel:'Don\'t'});
    const list = (ids || []).map(id => S.gy.find(c => c.id === id)).filter(Boolean); const types = new Set(list.flatMap(c => typesOf(c.k)));
    if (types.size < 4){ if (list.length) toast(`Only ${types.size} card types — needs four`); ctx.mayYes = false; return true; }
    list.forEach(c => moveCard(c.id, 'ex')); ctx.mayYes = true; ctx.lastEx = list.map(c => c.id); return true; }
  if ((m = l.match(/^put a permanent card from among them onto the battlefield with a finality counter on it$/))){ const list = (ctx.lastEx || []).map(id => find(id)[2]).filter(c => c && isPermType(info(c.k)?.t)); if (!list.length) return true; const ids = await pickCards({title:`${ctx.name}: put a permanent card onto the battlefield (finality counter)`, cards:list, min:1, max:1}); const c = ids && list.find(x => x.id === ids[0]); if (c){ moveCard(c.id, 'bf'); const b = S.bf.find(x => x.id === c.id); if (b) addNamed(b, 'finality', 1); } commit(); return true; }
  if ((m = l.match(/^gain control of all commanders$/))){ handWarn('Gain control of all commanders (and put all commanders from the command zone onto the battlefield under your control) — do this with the players', ctx); return true; }
  if (/^put all commanders from the command zone onto the battlefield under your control$/.test(l)) return true;
  if ((m = l.match(/^each player gains control of all nonland permanents other than ~ controlled by the next player in the chosen direction$/))){ handWarn(`Each player gains control of all nonland permanents (except ${ctx.name}) controlled by the next player to the ${ctx.chosen || 'chosen side'}`, ctx); return true; }
  if ((m = l.match(/^copy all spells you control, then copy all other activated and triggered abilities you control$/)) || (m = l.match(/^copy all spells you control$/))){ const mine = stackAll().filter(i => i.kind === 'spell' && S.stk.includes(i)); for (const sp of mine) await copyMany({...ctx, it:{...(ctx.it || {}), copyOf:sp.sid}}, 1).catch(() => {}); const abs = S.stk.filter(i => i !== ctx.it && (i.kind === 'ability' || i.kind === 'trigger')); abs.forEach(i => { const cp = {...i, sid:rid(6), o:nextO()}; S.stk.push(cp); }); log(`${ctx.name}: copied ${mine.length} spell${mine.length === 1 ? '' : 's'} and ${abs.length} abilit${abs.length === 1 ? 'y' : 'ies'}`); commit(); return true; }
  if (/^copy all other activated and triggered abilities you control$/.test(l)) return true;
  if ((m = l.match(/^(spirits|creatures|\w+) you control gain (.+?) until end of turn$/)) && !/^(all creatures|creatures you control)$/.test(m[1])){ const d = sing(m[1]); const kws = m[2].split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim()); S.bf.filter(c => isCreatureCard(c) && descOk(c.k, d, {tok:c.tok})).forEach(c => { c.ekw = [...new Set([...(c.ekw || []), ...kws])]; }); log(`${ctx.name}: ${m[1]} gain ${kws.join(', ')}`); commit(); return true; }
  if ((m = l.match(/^if it entered under your control, put a \+1\/\+1 counter on ~$/))){ const c = src(); if (c) S.dly.push({id:rid(6), eff:'', k:ctx.k, nm:ctx.name, srcId:c.id, op:'pheliaChk'}); return true; }
  if ((m = l.match(/^if it's a double-faced card, you may transform it$/))){ const c = (ctx.lastT || []).map(t => S.bf.find(x => x.id === t.id)).filter(Boolean)[0]; if (c && info(c.k)?.back && await askYes(`${ctx.name}: transform ${cname(c)}?`)){ c.fl = !c.fl; commit(); } return true; }
  if ((m = l.match(/^put (one|two) of them into your hand and the other on the bottom of your library$/))) return false;
  if ((m = l.match(/^proliferate x times, where x is (.+)$/))){ const n = countOf(m[1], ctx) || 0; for (let i = 0; i < n; i++) await say('Proliferate'); return true; }
  if ((m = l.match(/^draw cards equal to the difference$/))) return true;
  if ((m = l.match(/^exile them, then meld them into (.+)$/)) || /meld them into/.test(l)){ handWarn(s, ctx); return true; }
  if ((m = l.match(/^you may pay x life, where x is the number of opponents that were dealt combat damage this turn$/))){ const x = new Set((S.ev || []).filter(e => e.type === 'cdmg' && e.dp && e.dp !== MYPID).map(e => e.dp)).size; ctx.xv = x; if (!x){ log(`${ctx.name}: no opponent was dealt combat damage`); ctx.mayYes = false; return true; } if (await askYes(`${ctx.name}: pay ${x} life to draw ${x}?`)){ S.life -= x; ctx.mayYes = true; } else ctx.mayYes = false; commit(); return true; }
  if ((m = l.match(/^if you do, draw x cards$/)) && ctx.xv != null){ if (ctx.mayYes) draw(ctx.xv); commit(); return true; }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){
    const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase();
    if (l && await doRound9Pre(s, l, ctx)) return;
    return ds(s0, ctx);
  };
}
// “put one of them into your hand and the other on the bottom” (Teferi) — the dig reader calls it “the rest”
{
  const pd = parseDig;
  parseDig = function(r){ return pd(String(r || '').replace(/\band the other\b/g, 'and the rest').replace(/\bput one of them into your hand and the rest\b/, 'put one of them into your hand. put the rest')); };
}
// delayed triggers: pay-or-sacrifice, Phelia's counter
{
  const rt = resolveTop;
  resolveTop = async function(it, ...a){
    if (it && it.dop === 'payOrSac'){ const c = S.bf.find(x => x.id === it.srcId); if (c){ const cost = it.cost || ''; const e = (cost.match(/\{E\}/g) || []).length; let paid = false;
        if (e){ if (((S.pc || {}).energy || 0) >= e && await askYes(`${it.nm}: pay ${e} energy to keep ${cname(c)}?`)){ addPC('energy', -e); paid = true; } }
        else if (cost){ const plan = payPlan(parseCost(cost), S.pool); if (!plan.err && await askYes(`${it.nm}: pay ${cost} to keep ${cname(c)}?`)){ S.pool = plan.pool; paid = true; } else if (plan.err) toast(`${it.nm}: tap mana for ${cost} first to keep ${cname(c)}`); }
        else paid = true;
        if (!paid){ moveCard(c.id, 'gy', {sac:true}); log(`sacrificed ${cname(c)} (${it.nm})`); } }
      S.stk = S.stk.filter(x => x !== it); commit(); return; }
    if (it && it.dop === 'sac'){ const c = S.bf.find(x => x.id === it.srcId); if (c) moveCard(c.id, 'gy', {sac:true}); S.stk = S.stk.filter(x => x !== it); commit(); return; }
    if (it && it.dop === 'pheliaChk'){ S.stk = S.stk.filter(x => x !== it); commit(); return; }
    return rt(it, ...a);
  };
}
// more opponent requests: blight, exile the top of the library for someone, goad
{
  RQ_OPS.push('exileTop', 'rad');
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'blight'){ blightMe(r.n, r.src); return; }
    if (r.op === 'exileTop'){ const top = S.lib.slice(0, r.n); top.forEach(c => moveCard(c.id, 'ex')); log(`exiled the top ${top.length} card${top.length === 1 ? '' : 's'} of their library (${r.src}): ${top.map(cname).join(', ')}`); commit(); return; }
    if (r.op === 'rad'){ addPC('rad', r.n); return; }
    return ao(r, from);
  };
}
// rad counters: at the beginning of your precombat main phase, mill that many; lose 1 life and a rad counter for each nonland
{
  const fs = fireSteps;
  fireSteps = function(step, activePid){
    fs(step, activePid);
    if (step === 'main1' && activePid === MYPID && (S.pc || {}).rad){ const n = S.pc.rad; UI.millLog = []; mill(n); const got = UI.millLog; UI.millLog = null; const nl = got.filter(c => !isLand(c.k)).length; if (nl){ S.life -= nl; addPC('rad', -nl); } log(`rad counters: milled ${got.length}, lost ${nl} life`); commit(); }
    if (step === 'upkeep' && activePid === MYPID && S.xUp > 0){ /* extra upkeeps are announced; triggers repeat */ const n = S.xUp; S.xUp = 0; for (let i = 0; i < n; i++){ log('additional upkeep step'); fs('upkeep', activePid); } }
  };
}
// mobilize warriors and other “sacrifice at end step” tokens: track the tokens a sentence just made
{
  const cft = createFromText;
  createFromText = async function(s, ctx){ const before = new Set(S.bf.map(c => c.id)); const r = await cft(s, ctx); try { const made = S.bf.filter(c => !before.has(c.id) && c.tok).map(c => c.id); if (made.length) ctx.lastTok = made; } catch {} return r; };
}
// creatures-can't-block days; casting from graveyard permissions (Emry, Silas, Vohar); first-spell-each-turn uses S.casts
{
  const cb = canBlock;
  canBlock = function(b, a, apid){ if (S && S.noBlock === turnStr()) return "creatures can't block this turn"; if (b && (b.ekw || []).includes('cantblock')) return "can't block this turn"; if (a && (a.ekw || []).includes('unblockable')) return "can't be blocked this turn"; return cb(b, a, apid); };
  const go = gyOptions;
  gyOptions = function(c){ const r = go(c) || []; const a = info(c.k); if (!a || !S) return r;
    const ok = (S.gyOk || []).find(x => x.id === c.id && x.t === turnStr());
    if (ok && !isLand(c.k)) r.push({kind:'gycast', label:`Cast from graveyard (this turn) ${a.m}`, mana:a.m, extra:[], after:ok.ex ? 'ex' : ''});
    if (rulesOn('gyFlash').length && /\b(Instant|Sorcery)\b/.test(a.t) && !r.some(o => o.kind === 'flashback')) r.push({kind:'flashback', label:`Flashback ${a.m} (${rulesOn('gyFlash')[0].src})`, mana:a.m, extra:[], after:'ex'});
    if (rulesOn('gyMayhem').length && !isLand(c.k) && c.disc === turnStr() && !r.some(o => o.kind === 'mayhem')) r.push({kind:'mayhem', label:`Mayhem ${a.m}`, mana:a.m, extra:[], after:''});
    if (rulesOn('gyAll').length && phaseNow().pid === MYPID){ if (isLand(c.k)){ if (!r.some(o => o.land)) r.push({kind:'gyland', label:'Play land from graveyard', land:true}); } else if (!r.some(o => o.kind === 'gycast')) r.push({kind:'gycast', label:`Cast from graveyard ${a.m}`, mana:a.m, extra:[], after:''}); }
    return r; };
}
// Elminster etc.: the “first spell each turn”, “cast from hand” checks need where a spell came from
{
  const nc = noteCast;
  noteCast = function(c){ const r = nc(c); try { const last = (S.casts || [])[S.casts.length - 1]; if (last){ last.id = c.id; last.k = c.k; last.from = UI.castFrom || ''; } } catch {} return r; };
  const em = emit;
  emit = function(ev){ if (ev && ev.type === 'cast'){ ev.from = UI.castFrom || ev.from || ''; if (UI.lastTg) ev.tg = UI.lastTg; } return em(ev); };
  const bc = beginCast;
  beginCast = async function(c, zone, o){ UI.castFrom = zone; UI.lastTg = ''; try { return await bc(c, zone, o); } finally { UI.castFrom = ''; } };
}
// Zombie copies (Scarab God, Hashaton): 4/4 black Zombie
{
  const st0 = stats;
  stats = function(c, pid){ const r = st0(c, pid); if (c && c.zb){ const a = info(c.k); const bp = parseInt(a?.p) || 0, bt = parseInt(a?.t) || 0; return [r[0] - bp + c.zb[0], r[1] - bt + c.zb[1]]; } return r; };
}
// dies-and-exile marks (Rivaz), creatures can't attack enchanted (Eriette) — remind on attack
{
  const gr = gyReplace;
  gyReplace = function(c, from){ if (from === 'bf' && (S.dieEx || []).includes(c.k)){ S.dieEx = S.dieEx.filter(k => k !== c.k); return 'ex'; } return gr(c, from); };
}
// phyrexian black (K'rrik) and WUBRG discount (Aang): mana planning helpers
{
  const pp = payPlan;
  payPlan = function(cost, pool){
    let r = pp(cost, pool);
    if (r.err && S && UI.phyLife == null && rulesOn('phyB').length && cost && cost.col && cost.col.B){ const nB = cost.col.B; for (let b = 1; b <= nB; b++){ const c2 = {...cost, col:{...cost.col, B:nB - b}}; const r2 = pp(c2, pool); if (!r2.err && S.life >= 2 * b + (r2.life || 0)){ r2.life = (r2.life || 0) + 2 * b; return r2; } } }
    return r;
  };
}

/* ---------- Ward with a non-mana cost, escape, partner with ---------- */
STATIC_KNOWN.push(/^as an additional cost to cast ~, you may sacrifice any number of artifacts and\/or creatures$/, /^~ costs \{2\} less to cast for each permanent sacrificed this way and \{2\} less to cast for each other artifact or creature you've sacrificed this turn$/);
STATIC_KNOWN.push(/^ward—(pay \d+ life|sacrifice .+|\{\d+\}, pay \d+ life|blight \d+|discard a card)$/);

/* ---------- Sentence splitting that respects quotes, and a cache for static rules ---------- */
function senSplit(line){ const masked = String(line).replace(/["“][^"”]*["”]/g, q => q.replace(/\./g, '\u2024')); return masked.split(/\.\s*/).map(x => x.replace(/\u2024/g, '.').trim().replace(/\.(["”])$/, '$1')).filter(x => x && !/^["”]$/.test(x)); }
const SR_CACHE = new Map();
staticRulesOf = function(k, fl){
  const key = k + (fl ? '|b' : ''); if (SR_CACHE.has(key)) return SR_CACHE.get(key);
  const a = info(k); if (!a) return []; const f = fl && a.back ? a.back : a; const out = [];
  for (const line of tname(f.o, f.n).toLowerCase().split('\n'))
    for (const s of senSplit(line)) for (const [re, mk] of STATIC_RULES){ const m = s.match(re); if (m){ out.push({...mk(m), src:f.n}); break; } }
  SR_CACHE.set(key, out); return out;
};
staticKnown = function(l){
  const x = String(l).toLowerCase().replace(/\.$/, '');
  return senSplit(x).every(s => STATIC_RULES.some(([re]) => re.test(s)) || STATIC_KNOWN.some(r => r.test(s)));
};
{
  const ko = keywordsOnly;
  keywordsOnly = function(l){ return String(l).split(/,\s*/).every(w => { const t = w.trim(); return ko(t) || /^(firebending|mobilize|amass|crew|afflict|bushido|rampage|annihilator|toxic|backup|bloodthirst|fabricate|modular|renown|tribute|afterlife|training|exploit|ravenous|squad|offspring|gift|impending|plot|saddle|station|living metal|myriad|melee|provoke|dethrone|extort|exalted|soulbond|flanking|battle cry|riot|ascend|mentor|enlist|reconfigure|decayed|unleash|evolve|cipher|haunt|sunburst|graft|bloodrush|scavenge|dredge|ingest|emerge|escalate|surge|improvise|partner|for mirrodin!|read ahead|compleated|casualty|blitz|prototype|more than meets the eye)\b/i.test(t); }); };
}
// “Whenever you waterbend, earthbend, firebend, or airbend” has commas inside the condition
{
  const tn = tname;
  tname = function(txt, name){ return tn(txt, name).replace(/\byou waterbend, earthbend, firebend, or airbend\b/gi, 'you bend elementally'); };
  const ct = classifyTrig;
  classifyTrig = function(w, c){ if (/^you bend elementally$/.test(c)) return {ev:'bend', subj:'any', ctl:'you', desc:''}; return ct(w, c); };
}
// reflexive triggers: “You may sacrifice X. When you do, …” runs the rest only if you did
{
  const re = runEffects;
  runEffects = async function(txt, ctx){
    const t = String(txt || ''); const m = t.match(/^([\s\S]*?)\.\s+When you do(?:,\s*|\s*\n)([\s\S]+)$/);
    if (m && !/^when you do/i.test(t)){ ctx.mayYes = null; ctx.didPay = null; await re(m[1] + '.', ctx); if (ctx.mayYes === false || ctx.didPay === false){ log(`${ctx.name}: didn't — nothing more happens`); return; } return re(cap(m[2]), ctx); }
    return re(txt, ctx);
  };
}
// keywords from statics
{
  const kw0 = kwOf;
  kwOf = function(c, kw, pid = MYPID){
    const r = kw0(c, kw, pid); if (r || !c || !c.k || !S) return r;
    const mine = pid === MYPID;
    if (mine && rulesOn('myTurnKw').some(x => x.kw === kw && x.src === cname(c)) && phaseNow().pid === MYPID) return true;
    if (mine && rulesOn('loreKw').some(x => x.kws.includes(kw) && x.src === cname(c)) && S.bf.filter(s => sagaChapters(s)).reduce((a, s) => a + (s.lore || 0), 0) >= 4) return true;
    if (mine && isCreatureCard(c)) for (const g of rulesOn('grantKw')){ if (!g.kws.includes(kw)) continue; if (g.land && !isLand(c.k)) continue; if (g.other && g.src === cname(c)) continue; if (g.desc && !descOk(c.k, g.desc, {tok:c.tok})) continue; return true; }
    if (mine && kw === 'vigilance' && rulesOn('esika').length && /Legendary/.test(typeOf(c)) && isCreatureCard(c) && !rulesOn('esika').some(x => x.src === cname(c))) return true;
    if (kw === 'vigilance' || kw === 'lifelink'){ if (mine && c.tok && isCreatureCard(c) && S.bf.some(b => /creature tokens you control have vigilance and lifelink/i.test(info(b.k)?.o || ''))) return true; }
    if (kw === 'haste' && isCreatureCard(c) && rulesOn('allHaste').length) return true;
    return r;
  };
  const hh = hasHaste;
  hasHaste = function(c){ return hh(c) || (isCreatureCard(c) && rulesOn('allHaste').length > 0); };
  const cb = canBlock;
  canBlock = function(b, a, apid){ if (b && b.k && rulesOn('sevenEx').some(x => x.src === cname(b)) && countOf('cards in exile') < 7) return "can't block (fewer than seven cards in exile)"; return cb(b, a, apid); };
}
// Esika: other legendary creatures tap for any color; Foods everywhere (Ygra, Ragost)
{
  const ma = manaAbs;
  manaAbs = function(c){ const out = ma(c); if (!S || !c || !S.bf.includes(c)) return out;
    if (rulesOn('esika').length && /Legendary/.test(typeOf(c)) && isCreatureCard(c) && !out.some(o => o.esika) && !rulesOn('esika').some(x => x.src === cname(c))) return out.concat({cost:'{T}', eff:'Add one mana of any color', rest:'', outs:manaOuts('Add one mana of any color'), tapOnly:true, line:'{T}: Add one mana of any color. (Esika)', esika:true});
    return out; };
  const al = abilityList;
  abilityList = function(c){ const out = al(c); if (!S || !c || !S.bf.includes(c)) return out;
    const food = (rulesOn('foodAll').length && isCreatureCard(c) && !rulesOn('foodAll').some(x => x.src === cname(c))) || (rulesOn('foodArt').length && /Artifact/.test(typeOf(c)));
    if (food && !out.some(a => a.food)) return out.concat({cost:'{2}, {T}, Sacrifice ~', eff:'You gain 3 life.', sorc:false, line:'{2}, {T}, Sacrifice this: You gain 3 life. (Food)', food:true});
    return out; };
  const dk = descOk;
  descOk = function(k, desc, o = {}){ const r = dk(k, desc, o); if (r || !S) return r; if (/^\s*(?:a |an )?foods?\s*$/i.test(String(desc || ''))){ const t = info(k)?.t || ''; if (/\bCreature\b/.test(t) && boardsAll().some(b => b.bf.some(x => x.k && /other creatures are food artifacts/i.test(info(x.k)?.o || '') && x.k !== k))) return true; if (/\bArtifact\b/.test(t) && rulesOn('foodArt').length) return true; } return r; };
  const ac = abilityReady;
  abilityReady = function(c, ab, mana){ if (/\bfoods?\b/i.test(c && info(c.k)?.t || '') || ab.food){ /* Sam: Food abilities cost {1} less */ } return ac(c, ab, mana); };
}
// Sam, Loyal Attendant: Food abilities cost {1} less
{
  const pac = payAbilityCost;
  payAbilityCost = async function(c, cost, o){
    if (S && rulesOn('foodDisc').length && (ab9IsFood(c))){ cost = String(cost).replace(/\{(\d+)\}/, (w, n) => +n > 1 ? `{${+n - 1}}` : '').replace(/^,\s*/, ''); }
    return pac(c, cost, o);
  };
}
function ab9IsFood(c){ return !!c && (/\bFood\b/.test(typeOf(c)) || /Food/.test(cname(c)) || descOk(c.k, 'food')); }
// more event reactions: Bello's granted trigger, Captain Howler's delayed draw, Ghyrson
{
  const he = handleEvent;
  handleEvent = function(pid, ev){
    he(pid, ev);
    if (!S || pid !== MYPID || ev.type !== 'cdmg') return;
    const c = S.bf.find(x => x.id === ev.id); if (!c) return;
    if (bardAnim(c)){ const b = S.bf.find(x => /each non-equipment artifact and non-aura enchantment you control with mana value 4 or greater is a 4\/4/i.test(info(x.k)?.o || '')); pushTrig(cname(c), 'Draw a card.', {k:c.k, srcId:c.id}); }
    if (c.howl === turnStr()) pushTrig(cname(c), 'Draw a card.', {k:c.k, srcId:c.id});
  };
  const de = r7DamageEvent;
  r7DamageEvent = function(t, n, srcK, srcCard){ if (n > 0 && srcK){ UI.dmgTgt = t; } return de(t, n, srcK, srcCard); };
  const em = emit;
  emit = function(ev){ if (ev && ev.type === 'dmg' && UI.dmgTgt){ ev.tgt = UI.dmgTgt; UI.dmgTgt = null; } return em(ev); };
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    if (t && t.exact && (evPid !== MYPID || (ev && ev.id === src.id))) return;
    pt(src, t, ev, evPid); const it = S.stk[S.stk.length - 1];
    if (it && ev){ if (ev.tgt) it.evTgt = ev.tgt; if (ev.cp != null) it.evCp = ev.cp; }
  };
}
// extra land this turn (Hearthhull)
{
  const cp = canPlayLand;
  canPlayLand = function(c){ const r = cp(c); if (!r.ok && r.extra && S.xland && S.xland.t === turnStr()){ const max = 1 + rulesOn('extraLand').reduce((a, x) => a + x.n, 0) + S.xland.n; if (S.landT[1] < max) return {ok:true}; } return r; };
}
// discards remember the turn (mayhem)
{
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ const [from, , c] = find(id); const r = mc(id, to, o); if (c && from === 'hand' && to === 'gy') c.disc = turnStr(); if (c && from === 'bf' && o.sac && S && (isCreatureCard(c) || /Artifact/.test(info(c.k)?.t || ''))){ if (!S.sacT || S.sacT.t !== turnStr()) S.sacT = {t:turnStr(), n:0}; S.sacT.n++; } return r; };
}
// cascade given by statics (The First Sliver, Zhulodok)
{
  const ctr = castTriggers;
  castTriggers = function(c, a, it){
    ctr(c, a, it);
    try { for (const r of rulesOn('giveCascade')){ if (r.desc && !descOk(c.k, r.desc)) continue; if (r.mv && (a.mv || 0) < r.mv) continue; if (r.mv && UI.castFrom && UI.castFrom !== 'hand') continue; if (r.desc === 'colorless' && (a.c || '').replace(/[^WUBRG]/g, '')) continue;
      for (let i = 0; i < r.n; i++) pushTrig(a.n, 'Exile cards from the top until a nonland card with lower mana value; you may cast it free (cascade).', {k:c.k, cmv:it.mv || a.mv || 0}); } } catch (e){ console.warn(e); }
  };
}
// costs: graveyard discount (Green Goblin), WUBRG discount (Aang), Dargo
{
  const cmo = costMods;
  costMods = function(c, caster){
    const out = cmo(c, caster); if (!S || caster !== MYPID) return out;
    for (const r of rulesOn('gyDisc')) if (UI.castFrom === 'gy') out.less.push({src:r.src, n:r.n});
    if (/costs \{2\} less to cast for each permanent sacrificed this way and \{2\} less to cast for each other artifact or creature you've sacrificed this turn/i.test(info(c.k)?.o || '')){
      const n = (UI.dargoN || 0) + ((S.sacT && S.sacT.t === turnStr() ? S.sacT.n : 0) - (UI.dargoN || 0)); if (n > 0) out.less.push({src:info(c.k).n, n:2 * n}); }
    return out;
  };
  const sc = spellCost;
  spellCost = function(c, zone, o = {}){
    const r = sc(c, zone, o);
    if (S && rulesOn('wubrgDisc').length && r && r.cost){ for (const col of ['W', 'U', 'B', 'R', 'G']){ if ((r.cost[col] || 0) > 0) r.cost[col]--; else if (r.cost.gen > 0) r.cost.gen--; } }
    return r;
  };
  const bc = beginCast;
  beginCast = async function(c, zone, o = {}){
    UI.dargoN = 0;
    if (c && /as an additional cost to cast this spell, you may sacrifice any number of artifacts and\/or creatures/i.test(info(c.k)?.o || '') && !UI.dry){
      const list = S.bf.filter(x => (isCreatureCard(x) || /Artifact/.test(typeOf(x))) && !x.fd);
      if (list.length){ const ids = await pickCards({title:`${cname(c)}: sacrifice artifacts and/or creatures? (each makes it cost {2} less)`, cards:list, min:0, max:list.length, noneLabel:'Sacrifice nothing'}); (ids || []).forEach(id => moveCard(id, 'gy', {sac:true})); UI.dargoN = (ids || []).length; if (UI.dargoN) log(`sacrificed ${UI.dargoN} for ${cname(c)}`); commit(); }
    }
    return bc(c, zone, o);
  };
}
// more one-off sentences
{
  const r9 = doRound9Pre;
  doRound9Pre = async function(s, l, ctx){
    let m;
    if ((m = l.match(/^counter target spell, activated ability, or triggered ability$/))){ if (!UI.dry) await resolveCounter(ctx); return true; }
    if ((m = l.match(/^its controller draws a card$/))){ const t = (ctx.lastT || [])[0]; const pid = t && (t.pid || t.owner); if (pid === MYPID) draw(1); else if (pid) sendRq(pid, 'draw', 1, ctx.name); commit(); return true; }
    if ((m = l.match(/^destroy another target (.+)$/))){ await doSentence('Destroy target ' + s.slice(s.length - m[1].length), ctx); return true; }
    if ((m = l.match(/^you may play an additional land this turn$/))){ if (!S.xland || S.xland.t !== turnStr()) S.xland = {t:turnStr(), n:0}; S.xland.n++; log(`${ctx.name}: may play an additional land this turn`); commit(); return true; }
    if ((m = l.match(/^draw a card if you control that creature$/))){ const pid = ctx.it && ctx.it.evPid; ctx.condResult = pid === MYPID; if (pid === MYPID) draw(1); commit(); return true; }
    if ((m = l.match(/^if you don't control it, its controller loses (\d+) life$/))){ const pid = ctx.it && ctx.it.evPid; if (pid && pid !== MYPID) loseLife(pid, +m[1], ctx.name); return true; }
    if ((m = l.match(/^~ deals (\d+) damage to that permanent or player$/))){ const t = ctx.it && ctx.it.evTgt; if (t) dealDamage(t, +m[1], ctx.k, srcCardOf(ctx)); else log(`${ctx.name}: the damaged permanent or player is gone`); return true; }
    if ((m = l.match(/^return it to its owner's hand at the beginning of the next end step$/))){ const id = ctx.srcId; if (id != null) S.dly.push({id:rid(6), eff:"Return it to its owner's hand.", k:ctx.k, nm:ctx.name, srcId:id, op:'retHand'}); log(`${ctx.name}: returns to hand at the next end step`); commit(); return true; }
    if ((m = l.match(/^return it to its owner's hand$/)) && ctx.it && ctx.it.dop === 'retHand'){ const [z] = find(ctx.it.srcId); if (z === 'gy' || z === 'ex') moveCard(ctx.it.srcId, 'hand'); else if (S.cz.some(c => c.id === ctx.it.srcId)) log(`${ctx.name} is in the command zone`); commit(); return true; }
    if ((m = l.match(/^if you haven't completed tomb of annihilation, return ~ to its owner's hand and venture into the dungeon$/))){ if ((S.dgList || []).includes('Tomb of Annihilation')){ log(`${ctx.name}: Tomb of Annihilation is completed — it stays`); return true; } const c = srcCardOf(ctx); if (c && find(c.id)[0] === 'bf') moveCard(c.id, 'hand'); await doSentence('Venture into the dungeon', ctx); return true; }
    if ((m = l.match(/^if there are (fourteen|thirteen|twelve|eleven|ten|\w+) or more cards in your graveyard, (.+)$/))){ const n = {ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, twenty:20}[m[1]] || wn(m[1]) || 0; if (S.gy.length >= n) await doSentence(cap(s.slice(s.length - m[2].length)), ctx); else log(`${ctx.name}: only ${S.gy.length} cards in the graveyard`); return true; }
    if ((m = l.match(/^if it had one or more \+1\/\+1 counters on it, (?:you may )?put that many \+1\/\+1 counters on target creature$/))){ const n = ctx.it && ctx.it.evCp || 0; if (!n){ log(`${ctx.name}: it had no +1/+1 counters`); return true; } if (/you may/.test(l) && !(await askYes(`${ctx.name}: put ${n} +1/+1 counters on target creature?`))) return true; const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (t){ if (t.pid === MYPID){ const c = S.bf.find(x => x.id === t.id); if (c) modCounters(c, 'cp', n); } else applyTo(t, {op:'ctr', n, src:ctx.name, d:'cp'}); } commit(); return true; }
    if ((m = l.match(/^draw a card$/)) && ctx.it && ctx.it.kind === 'trigger' && /you bend elementally|done all four this turn/.test(String(ctx.full || ctx.it.txt || '').toLowerCase())){ draw(1); commit(); return true; }
    if ((m = l.match(/^(?:then )?if you've done all four this turn, transform ~$/))){ const b = S.bend || {}; if (b.t === turnStr() && b.water && b.earth && b.fire && b.air) await doSentence('Transform ~', ctx); return true; }
    if ((m = l.match(/^add ((?:\{r\})+)$/)) && ctx.it && /^firebending/i.test(ctx.it.raw || '') ){ bent('fire'); return false; }
    if ((m = l.match(/^target creature gets \+(\d+)\/\+0 until end of turn for each card discarded this way$/))){ const n = (ctx.it && ctx.it.evN) || 1; const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (t){ ctx.howlT = t; if (t.pid === MYPID){ const c = S.bf.find(x => x.id === t.id); if (c){ c.pu = [(c.pu ? c.pu[0] : 0) + (+m[1]) * n, c.pu ? c.pu[1] : 0]; log(`${cname(c)} gets +${(+m[1]) * n}/+0`); } } else applyTo(t, {op:'pump', src:ctx.name, f:{p:(+m[1]) * n, t:0}}); } commit(); return true; }
    if ((m = l.match(/^whenever that creature deals combat damage to a player this turn, you draw a card$/))){ const t = ctx.howlT; const c = t && t.pid === MYPID && S.bf.find(x => x.id === t.id); if (c){ c.howl = turnStr(); log(`${cname(c)}: draws when it deals combat damage this turn`); } else if (t) handWarn('If that creature deals combat damage to a player this turn, draw a card', ctx); return true; }
    return r9(s, l, ctx);
  };
}
// cascade/discover etc. get the stack item's firebending marker
{
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){ pt(src, t, ev, evPid); const it = S.stk[S.stk.length - 1]; if (it && t && /^firebending/.test(t.raw || '')) it.raw = t.raw; };
}

// a permanent remembers the X and the mana spent on the spell that made it (Wan Shi Tong, Toph)
{
  const rt = resolveTop;
  resolveTop = async function(it, ...a){ if (it && it.kind === 'spell' && it.card){ UI.spellX = {id:it.card.id, x:it.x || 0, spent:it.free ? 0 : (it.mv || 0)}; } try { return await rt(it, ...a); } finally { UI.spellX = null; } };
  const oe = onEnter;
  onEnter = function(c, from, o = {}){ if (c && UI.spellX && UI.spellX.id === c.id){ c.xv = UI.spellX.x; c.spent = UI.spellX.spent; } return oe(c, from, o); };
}
// animated lands and vehicles have no printed power/toughness on their face
livePTFor = function(c, pid){
  if (!c.k || c.fd || !isCreatureCard(c)) return '';
  const s = stats(c, pid); if (!s) return ''; const b = ptOf(faceOf(c)) || [null, null];
  return (s[0] !== b[0] || s[1] !== b[1] || c.dmg) ? `${s[0]}/${s[1]}${c.dmg ? ' · ' + c.dmg + ' dmg' : ''}` : '';
};
// static rules are read many times per render: reuse them until something enters, leaves or flips
{
  const sr = staticRules;
  staticRules = function(){
    if (!S) return [];
    let fl = 0; for (const c of S.bf) if (c.fl) fl++;
    let ob = ''; for (const s of OPP.values()) ob += (s.bf || []).length + ',';
    const key = `${S.evn}|${S.bf.length}|${fl}|${ob}`;
    const now = Date.now(); const c = UI.srMemo;
    if (c && c.key === key && now - c.t < 1000 && !UI.dry) return c.v;
    const v = sr(); UI.srMemo = {key, t:now, v}; return v;
  };
  const ba = bardAnim;
  bardAnim = function(c){
    if (!c || !S) return false; const now = Date.now();
    if (!UI.bardC || now - UI.bardC.t > 300 || UI.bardC.n !== S.bf.length){ UI.bardC = {t:now, n:S.bf.length, on:S.bf.some(b => !b.fd && b.k && /each non-equipment artifact and non-aura enchantment you control with mana value 4 or greater is a 4\/4/i.test(info(b.k)?.o || ''))}; }
    return UI.bardC.on ? ba(c) : false;
  };
}

// voting: the other players answer on their own screen
RQ_OPS.push('voteAns');
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'vote'){ (async () => { const [a, b] = String(r.d || '').split('|'); const out = [];
        const extra = rulesOn('extraVote').length ? 2 : 1;
        for (let i = 0; i < extra; i++){ const v = await askChoice({title:`${r.src}: vote${extra > 1 ? ' ' + (i + 1) : ''} — ${cap(a)} or ${cap(b)}?`, options:[{label:cap(a), value:a}, {label:cap(b), value:b}]}); if (v) out.push(v); }
        log(`voted ${out.join(' and ') || 'nothing'} (${r.src})`); sendRq(from, 'voteAns', out.length, r.src, {ref:r.ref, d:out.join('|')}); commit(); })(); return; }
    if (r.op === 'voteAns'){ UI.voteAns = UI.voteAns || {}; UI.voteAns[r.ref] = String(r.d || '').split('|').filter(Boolean); return; }
    return ao(r, from);
  };
}
