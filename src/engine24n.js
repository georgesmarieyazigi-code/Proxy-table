/* ===================== Round 24N: costs, cast permissions and mana tracking =====================
   - free / alternative-cost statics (Omniscience, Dracogenesis, Rooftop Storm, As Foretold, Darksteel Monolith, Demon of Fate's Design …)
   - flash grants for several spell kinds (Liberator, Gandalf, Whirlwing Stormbrood, Quick Sliver)
   - "spend mana as though it were mana of any color" (Chromatic Orrery, Mycosynth Lattice, Oath of Nissa, Vizier, Agatha's Soul Cauldron)
   - activation-cost changes (Heartstone, Agatha, Blossoming Tortoise, Zirda, Tezzeret, Bruenor / Forge Anew, Thran Portal, Kopala, Hylda, Carth)
   - colored cost reductions (Morophon, the Defilers), Shadow of Mortality, Liesa's commander tax
   - granted cost keywords (convoke / improvise / emerge / replicate grants, "the next spell you cast has …")
   - additional costs on spells ("As an additional cost to cast this spell, sacrifice / discard / pay life / exile …")
   - granted mana abilities ("Elves you control have "{T}: Add {G}{G}."", Glorious Sunrise, Song of Freyalise)
   - mana spent tracking (Treasure / creature / artifact mana, colors, amount) and unspent mana (Omnath, Kruphix, Ozai)
*/
const N24W = {a:1, an:1, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10};
const n24n = w => { w = String(w || '').toLowerCase(); return /^\d+$/.test(w) ? +w : (N24W[w] ?? null); };
function n24text(b){ const f = b && faceOf(b); return f && !b.fd ? tname(f.o || '', f.n) : ''; }
function n24once(key){ return !!(S && S.n24once && S.n24once[key] === turnStr()); }
function n24markOnce(key){ S.n24once = S.n24once || {}; S.n24once[key] = turnStr(); }
function n24myTurn(){ return currentTurn()[1] === MYPID; }

/* ---------- statics the checker reads (implemented below) ---------- */
STATIC_RULES.push(
  // free casting / {0} alternative costs
  [/^you may cast (?:(.+?) )?spells (from your hand )?without paying their mana costs$/, m => ({kind:'n24free', who:'you', desc:m[1] || '', zone:m[2] ? 'hand' : ''})],
  [/^you may pay \{0\} rather than pay the mana cost for (.+?) spells you cast$/, m => ({kind:'n24free', who:'you', desc:m[1], zone:''})],
  [/^once each turn, you may pay \{0\} rather than pay the mana cost for an? (?:(.+?) )?spell you cast(?: from (your hand|exile))?(?: with mana value x or less, where x is the number of (\w+) counters on ~)?$/, m => ({kind:'n24free', who:'you', desc:m[1] || '', zone:m[2] === 'exile' ? 'ex' : m[2] ? 'hand' : '', once:true, ctr:m[3] || ''})],
  [/^once during each of your turns, you may cast an? (.+?) spell by paying life equal to its mana value rather than paying its mana cost$/, m => ({kind:'n24free', who:'you', desc:m[1], zone:'', once:true, life:true, myTurn:true})],
  [/^once during each of your turns, you may cast a spell from your hand or the top of your library without paying its mana cost$/, m => ({kind:'n24free', who:'you', desc:'', zones:['hand', 'lib'], once:true, myTurn:true, top:true})],
  [/^you may pay ((?:\{[wubrgc\d]\})+) and tap (\w+) untapped (.+?) you control(?: with flying)? rather than pay ~'s mana cost$/, m => ({kind:'n24note', who:'you'})],
  // flash for several kinds of spells
  [/^(you|any player) may cast (.+?) spells(?: and (.+?) spells)? as though they had flash$/, m => ({kind:'n24flash', who:m[1] === 'you' ? 'you' : 'all', descs:[m[2], m[3]].filter(Boolean)})],
  // spend mana as though it were any color / any type
  [/^(you|players) may spend mana as though it were mana of any colou?r$/, m => ({kind:'n24any', who:m[1] === 'you' ? 'you' : 'all', scope:''})],
  [/^you may spend mana as though it were mana of any colou?r to cast (.+?) spells$/, m => ({kind:'n24any', who:'you', scope:'spell', desc:m[1]})],
  [/^you can spend mana of any type to cast (.+?) spells$/, m => ({kind:'n24any', who:'you', scope:'spell', desc:m[1]})],
  [/^you may spend mana as though it were mana of any colou?r to activate abilities of (.+?) you control$/, m => ({kind:'n24any', who:'you', scope:'ab', desc:sing(m[1])})],
  // activation costs
  [/^activated abilities of (.+?) (you control )?cost \{(\d+|x)\} less to activate(?:, where x is ~'s power)?$/, m => ({kind:'n24abDisc', who:m[2] ? 'you' : 'all', desc:sing(m[1]), n:m[3] === 'x' ? 'pow' : +m[3]})],
  [/^abilities you activate that aren't mana abilities cost \{(\d+)\} less to activate$/, m => ({kind:'n24abDisc', who:'you', desc:'', n:+m[1], nonMana:true})],
  [/^the first activated ability of an? (\w+) you activate each turn costs \{(\d+)\} less to activate$/, m => ({kind:'n24abDisc', who:'you', desc:m[1], n:+m[2], first:true})],
  [/^this effect can't reduce the mana in that cost to less than one mana$/, m => ({kind:'n24note', who:'you'})],
  [/^you may pay \{0\} rather than pay the equip cost of the first equip ability you activate (each turn|during each of your turns)$/, m => ({kind:'n24eq0', who:'you', myTurn:/your turns/.test(m[1])})],
  [/^during your turn, you may activate equip abilities any time you could cast an instant$/, m => ({kind:'n24eqFlash', who:'you'})],
  [/^mana abilities of ~ cost an additional (\d+) life to activate$/, m => ({kind:'n24note', who:'you'})],
  [/^abilities your opponents activate that target an? (.+?) you control cost \{(\d+)\} more to activate$/, m => ({kind:'n24abTax', who:'opp', desc:m[1], n:+m[2]})],
  [/^planeswalkers' loyalty abilities you activate cost an additional \[\+1\] to activate$/, m => ({kind:'n24carth', who:'you'})],
  // colored reductions
  [/^spells of the chosen type you cast cost \{w\}\{u\}\{b\}\{r\}\{g\} less to cast$/, m => ({kind:'n24moro', who:'you'})],
  [/^this effect reduces only the amount of (?:colou?red|white|blue|black|red|green) mana you pay$/, m => ({kind:'n24note', who:'you'})],
  [/^as an additional cost to cast (white|blue|black|red|green) permanent spells, you may pay 2 life$/, m => ({kind:'n24defiler', who:'you', col:{white:'W', blue:'U', black:'B', red:'R', green:'G'}[m[1]]})],
  [/^those spells cost \{[wubrg]\} less to cast if you paid life this way$/, m => ({kind:'n24note', who:'you'})],
  [/^if your life total is less than your starting life total, ~ costs \{x\} less to cast, where x is the difference$/, m => ({kind:'n24note', who:'you'})],
  [/^rather than pay \{2\} for each previous time you've cast ~ from the command zone this game, pay 2 life that many times$/, m => ({kind:'n24note', who:'you'})],
  // granted cost keywords
  [/^(.+?) spells you cast( from exile)? have (convoke|improvise)$/, m => ({kind:'n24kw', who:'you', desc:m[1], ex:!!m[2], kw:m[3]})],
  [/^spells you cast from exile have (convoke|improvise)$/, m => ({kind:'n24kw', who:'you', desc:'', ex:true, kw:m[1]})],
  [/^each (.+?) spell you cast has (replicate|emerge)$/, m => ({kind:'n24kw', who:'you', desc:m[1], kw:m[2]})],
  [/^the (replicate|emerge) cost is equal to its mana cost$/, m => ({kind:'n24note', who:'you'})],
  // riders that depend on the mana spent
  [/^the first spell you cast each turn that mana from a treasure was spent to cast has cascade$/, m => ({kind:'n24trCascade', who:'you'})],
  [/^each spell you cast has split second if mana from an artifact was spent to cast it$/, m => ({kind:'n24arSS', who:'you'})],
  // unspent mana
  [/^you don't lose unspent (white|blue|black|red|green) mana as steps and phases end$/, m => ({kind:'n24keep', who:'you', col:{white:'W', blue:'U', black:'B', red:'R', green:'G'}[m[1]]})],
  [/^if you would lose unspent mana, that mana becomes (colorless|red|black|green|white|blue) instead$/, m => ({kind:'n24conv', who:'you', col:{colorless:'C', white:'W', blue:'U', black:'B', red:'R', green:'G'}[m[1]]})],
  // additional costs of permanent spells (paid by the generic additional-cost code below)
  [/^as an additional cost to cast ~, (.+)$/, m => (n24addParse(m[1]) ? {kind:'n24note', who:'you'} : {kind:'n24unknown', who:'you'})],
  [/^~ costs \{1\} less to cast for each permanent sacrificed this way$/, m => ({kind:'n24note', who:'you'})],
);
// the checker splits quoted abilities at their inner periods: the closing quote of a granted ability
STATIC_KNOWN.push(/^"$/);

/* ---------- free / alternative-cost statics ---------- */
function n24freeOpts(c, zone){
  const out = []; if (!S || !c || !c.k || isLand(c.k)) return out;
  const a = info(c.k); if (!a) return out;
  for (const r of rulesOn('n24free')){
    if (r.zone && r.zone !== zone) continue;
    if (r.zones && !r.zones.includes(zone)) continue;
    if (r.desc && !descOk(c.k, r.desc)) continue;
    if (r.myTurn && !n24myTurn()) continue;
    const key = 'free:' + r.src;
    if (r.once && n24once(key)) continue;
    if (r.ctr){ const src = S.bf.find(b => !b.fd && cname(b) === r.src); const n = src ? ((src.nc || {})[r.ctr] || 0) : 0; if ((a.mv || 0) > n) continue; }
    if (r.life){
      const n = a.mv || 0; const why = S.life >= n ? '' : `you need ${n} life`;
      out.push({label:`Pay ${n} life instead (${r.src})`, mana:'', extra:n ? [{t:'life', n, label:`pay ${n} life`}] : [], ok:!why, why, n24:key, once:r.once});
    } else out.push({label:`Cast without paying its mana cost (${r.src})`, mana:'', extra:[], ok:true, why:'', n24:key, once:r.once});
  }
  return out;
}
{
  const ac = altCosts;
  altCosts = function(c, zone = 'hand'){
    const r = ac(c, zone);
    try { if (UI.r21bforce && UI.casting) return r; const mine = n24freeOpts(c, zone); if (mine.length){ const tax = spellCost(c, zone, {alt:{mana:''}}); const p = payPlan(tax.cost, S.pool); mine.forEach(o => { if (o.ok && p.err){ o.ok = false; o.why = `also costs ${costStr(tax.cost)}: ${p.err}`; } }); return r.concat(mine); } } catch (e){ console.warn(e); }
    return r;
  };
}

// One with the Multiverse: the top card of your library can be cast that way
{
  const tw = r23fTopWays;
  r23fTopWays = function(c){ const out = tw(c); try { if (S && c && c.k && !isLand(c.k) && S.lib[0] === c && n24myTurn()) for (const r of rulesOn('n24free')) if (r.top && !n24once('free:' + r.src)) out.push({r}); } catch {} return out; };
}
// Sephara-style: "You may pay {W} and tap four untapped creatures you control with flying rather than pay ~'s mana cost"
function n24tapList(desc, c){ const fly = /with flying$/.test(desc); const d = desc.replace(/ with flying$/, ''); return S.bf.filter(b => !b.fd && !b.tap && b.id !== c.id && descOk(b.k, sing(d), {tok:b.tok}) && (!fly || kwOf(b, 'flying'))); }
{
  const ac = altCosts;
  altCosts = function(c, zone = 'hand'){
    let r = ac(c, zone);
    try { const a = info(c.k); const m = a && tname(a.o || '', a.n).match(/you may pay ((?:\{[^}]+\})+) and tap (\w+) untapped (.+?) you control( with flying)? rather than pay ~'s mana cost/i);
      if (m){ const n = n24n(m[2]) || 1; const desc = m[3].toLowerCase() + (m[4] ? ' with flying' : ''); r = r.filter(o => !/^pay \{/i.test(o.label || ''));
        const list = n24tapList(desc, c); const sc = spellCost(c, zone, {alt:{mana:m[1]}}); const p = payPlan(sc.cost, S.pool);
        const why = list.length < n ? `you need ${n} untapped ${desc}` : p.err || '';
        r.push({label:`Pay ${m[1]} and tap ${m[2]} untapped ${desc}`, mana:m[1], extra:[{t:'n24tapN', n, desc, label:`tap ${m[2]} untapped ${desc}`}], ok:!why, why}); } } catch (e){ console.warn(e); }
    return r;
  };
  const pe = payExtras;
  payExtras = async function(list, c){
    const mine = (list || []).filter(x => x.t === 'n24tapN'); const rest = (list || []).filter(x => x.t !== 'n24tapN');
    for (const x of mine){ const cands = n24tapList(x.desc, c); if (cands.length < x.n) return false; const ids = cands.length === x.n ? cands.map(b => b.id) : await pickCards({title:`${cname(c)}: tap ${x.n} untapped ${x.desc}`, cards:cands, min:x.n, max:x.n}); if (!ids || ids.length < x.n) return false; ids.forEach(id => { const b = S.bf.find(y => y.id === id); if (b) b.tap = true; }); log(`tapped ${ids.length} ${x.desc} for ${cname(c)}`); }
    return pe(rest, c);
  };
}

/* ---------- flash for several spell kinds ---------- */
{
  const to = timingOk;
  timingOk = function(c){ const r = to(c); try { if (r && !r.ok && c && c.k && phaseNow().n > 0 && !/split second/i.test(r.why || '') && rulesOn('n24flash').some(x => x.descs.some(d => descOk(c.k, d)))) return {ok:true}; } catch {} return r; };
}

/* ---------- spend mana as though it were mana of any color ---------- */
let N24CASTC = null;   // the card being cast (castCheck / beginCast)
function n24anyOk(){
  if (!S) return false;
  const ctx = typeof R21CTX !== 'undefined' ? R21CTX : null;
  if (ctx && ctx.spell != null && N24CASTC && N24CASTC.k === ctx.spell && N24CASTC.n24anyType) return true;
  for (const r of rulesOn('n24any')){
    if (!r.scope) return true;
    if (r.scope === 'spell' && ctx && ctx.spell != null && descOk(ctx.spell, r.desc)) return true;
    if (r.scope === 'ab' && ctx && ctx.ab && descOk(ctx.ab.k, r.desc, {tok:ctx.ab.tok})) return true;
  }
  return false;
}
function n24anyCost(cost){
  const col = {...cost.col}; let gen = cost.gen;
  ['W','U','B','R','G'].forEach(x => { gen += col[x] || 0; col[x] = 0; });
  gen += (cost.hyb || []).length + (cost.two || []).length;
  return {...cost, gen, col, hyb:[], two:[]};
}
{
  const pp = payPlan;
  payPlan = function(cost, pool){
    const r = pp(cost, pool);
    try { if (r && r.err && cost && cost.col && S && n24anyOk()){ const r2 = pp(n24anyCost(cost), pool); if (!r2.err) return r2; } } catch (e){ console.warn(e); }
    return r;
  };
  const cc = castCheck;
  castCheck = function(c, zone){ const keep = N24CASTC; N24CASTC = c; try { return cc(c, zone); } finally { N24CASTC = keep; } };
}

/* ---------- activation costs ---------- */
let N24AB = null;   // the ability being activated (activateAbility)
function n24manaParts(cost){ return (String(cost).match(/\{[^}]+\}/g) || []).filter(x => !/^\{[TQ]\}$/i.test(x) && !/^\{E\}$/i.test(x)); }
function n24minOne(src){ const b = S.bf.find(x => cname(x) === src) || null; const t = b ? n24text(b) : ''; return /can't reduce the mana in that cost to less than one mana/i.test(t); }
function n24setGeneric(cost, n){
  const parts = String(cost).split(/,\s*/); let done = false;
  const out = parts.map(p => { if (done || !/^(\{[^}]+\})+$/.test(p.trim()) || /\{[TQ]\}/i.test(p)) return p; done = true; const syms = p.match(/\{[^}]+\}/g).filter(s => !/^\{\d+\}$/.test(s)); return (n > 0 ? `{${n}}` : '') + syms.join(''); });
  if (!done && n > 0) out.unshift(`{${n}}`);
  return out.filter(p => p.trim()).join(', ') || '{0}';
}
function n24genOf(cost){ for (const p of String(cost).split(/,\s*/)){ if (/^(\{[^}]+\})+$/.test(p.trim()) && !/\{[TQ]\}/i.test(p)){ const g = p.match(/\{(\d+)\}/); return g ? +g[1] : 0; } } return 0; }
function n24adjCost(c, cost, ab, isMana){
  if (!S || !c || !S.bf.includes(c)) return cost;
  let out = String(cost); const notes = [];
  const isEquip = !!(ab && ab.equip);
  // {0} equip (Bruenor Battlehammer, Forge Anew)
  if (isEquip && !(S.n24eq === turnStr())){ const r = rulesOn('n24eq0').find(x => !x.myTurn || n24myTurn()); if (r){ out = out.replace(/(\{[^}]+\})+/g, '').replace(/^,\s*|,\s*$/g, '') || '{0}'; notes.push(r.src); } }
  let gen = n24genOf(out); let red = 0; let floor = 0;
  const tot = n24manaParts(out).length;
  for (const r of rulesOn('n24abDisc')){
    if (r.nonMana && isMana) continue;
    if (r.desc && !descOk(c.k, r.desc, {tok:c.tok}) && !(r.desc === 'artifact token' && c.tok && /Artifact/.test(typeOf(c)))) continue;
    if (r.first && (S.n24first || {})[r.src] === turnStr()) continue;
    let n = r.n; if (n === 'pow'){ const b = S.bf.find(x => cname(x) === r.src); n = b ? Math.max(0, (stats(b) || [0, 0])[0]) : 0; }
    if (!n) continue;
    red += n; notes.push(r.src); if (n24minOne(r.src)) floor = 1;
    if (r.first) (UI.n24firstUse = UI.n24firstUse || []).push(r.src);
  }
  // "This ability costs {1} less to activate during your turn" (Hylda's Crown of Winter)
  const own = ab && String(ab.eff || '').match(/this ability costs \{(\d+)\} less to activate during your turn/i); if (own && n24myTurn()) red += +own[1];
  for (const r of rulesOn('n24abTax')){ const tg = (UI.n24lastT || []).flat().filter(Boolean); if (tg.some(t => t.t === 'card' && t.pid === r.pid && t.k && descOk(t.k, r.desc))){ gen += r.n; notes.push(`${r.src} +${r.n}`); } }
  if (red){ const other = tot - (n24genOf(out) ? 1 : 0); const min = floor && other === 0 ? 1 : 0; gen = Math.max(min, gen - red); }
  if (red || gen !== n24genOf(out)) out = n24setGeneric(out, gen);
  if (ab && /spend only mana of the chosen colou?r to activate this ability/i.test(String(ab.eff || '')) && c.col && /^[WUBRG]$/.test(c.col)){ const g = n24genOf(out); if (g){ out = n24setGeneric(out, 0); const syms = `{${c.col}}`.repeat(g); const parts = out.split(/,\s*/); const i = parts.findIndex(p => /^(\{[^}]+\})+$/.test(p.trim()) && !/\{[TQ]\}/i.test(p)); if (i >= 0) parts[i] = syms + parts[i].replace('{0}', ''); else parts.unshift(syms); out = parts.filter(Boolean).join(', '); notes.push('chosen color only'); } }
  return out;
}
{
  const ab0 = activateAbility;
  activateAbility = async function(c, ab){ const keep = N24AB; N24AB = ab; UI.n24firstUse = null; UI.n24lastT = null; try { return await ab0(c, ab); } finally { N24AB = keep; UI.n24lastT = null; } };
  const ct = chooseTargets;
  chooseTargets = async function(...a){ const r = await ct(...a); if (N24AB) UI.n24lastT = r; return r; };
  const pac = payAbilityCost;
  payAbilityCost = async function(c, cost, o = {}){
    let cost2 = cost;
    try {
      if (S && c && S.bf.includes(c)){
        cost2 = n24adjCost(c, cost, o.mana ? null : N24AB, !!o.mana);
        // Thran Portal: mana abilities cost an additional 1 life
        if (o.mana){ const lm = n24text(c).match(/mana abilities of ~ cost an additional (\d+) life to activate/i); if (lm) cost2 = cost2 + `, Pay ${lm[1]} life`; }
      }
    } catch (e){ console.warn(e); cost2 = cost; }
    UI.n24firstUse = UI.n24firstUse || null; const first = UI.n24firstUse;
    const ok = await pac(c, cost2, o);
    try { if (ok && S && c){
      if (!o.mana && N24AB && N24AB.equip){ if (S.n24eq !== turnStr() && rulesOn('n24eq0').some(x => !x.myTurn || n24myTurn()) && cost2 !== cost) log(`paid {0} for the equip cost`); S.n24eq = turnStr(); }
      if (!o.mana && /Artifact/.test(typeOf(c))) for (const r of rulesOn('n24abDisc')) if (r.first && descOk(c.k, r.desc, {tok:c.tok})){ S.n24first = S.n24first || {}; S.n24first[r.src] = turnStr(); }
      if (cost2 !== cost) log(`${cname(c)}: cost ${cost} → ${cost2}`);
    } } catch {}
    return ok;
  };
  const ar = abilityReady;
  abilityReady = function(c, ab, mana){
    try {
      if (S && c && ab && S.bf.includes(c)){
        let ab2 = ab; const keep = UI.n24lastT; UI.n24lastT = null;
        const adj = n24adjCost(c, ab.cost, mana ? null : ab, !!mana); UI.n24lastT = keep;
        if (adj !== ab.cost) ab2 = {...ab, cost:adj};
        if (ab.equip && ab.sorc && n24myTurn() && rulesOn('n24eqFlash').length) ab2 = {...ab2, sorc:false};
        if (ab2 !== ab) return ar(c, ab2, mana);
      }
    } catch (e){ console.warn(e); }
    return ar(c, ab, mana);
  };
  // Thran Portal: its mana abilities need life, so auto-pay leaves it alone
  const ma = manaAbs;
  manaAbs = function(c){ const out = ma(c); try { if (c && /mana abilities of ~ cost an additional \d+ life to activate/i.test(n24text(c))) return out.map(o => o.tapOnly ? {...o, tapOnly:false} : o); } catch {} return out; };
  // Carth the Lion: loyalty abilities cost an additional [+1]
  const al = activateLoyalty;
  activateLoyalty = async function(c, i){ const n0 = S.stk.length; const r = await al(c, i); try { if (S.stk.length > n0 && S.stk[S.stk.length - 1].srcId === c.id){ const n = rulesOn('n24carth').length; if (n){ c.co = (c.co || 0) + n; log(`${cname(c)}: +${n} loyalty (Carth the Lion)`); commit(); } } } catch {} return r; };
}

/* ---------- colored reductions (Morophon, Defilers), Shadow of Mortality, Liesa ---------- */
function n24defilers(c){
  if (!S || !c || !c.k) return [];
  const a = info(c.k); if (!a || !isPermType(a.t)) return [];
  return rulesOn('n24defiler').filter(r => (a.c || '').includes(r.col));
}
{
  const sc = spellCost;
  spellCost = function(c, zone, o = {}){
    const r = sc(c, zone, o);
    try {
      if (!S || !c || !c.k || !r || !r.cost) return r;
      const a = info(c.k); if (!a) return r;
      // Morophon: spells of the chosen type cost {W}{U}{B}{R}{G} less (colored mana only)
      for (const b of S.bf){ if (b.fd || !b.ctype || !/spells of the chosen type you cast cost \{W\}\{U\}\{B\}\{R\}\{G\} less to cast/i.test(n24text(b))) continue;
        if (!new RegExp('\\b' + b.ctype + '\\b', 'i').test(a.t || '') && !/changeling/i.test(a.o || '')) continue;
        let cut = 0; ['W','U','B','R','G'].forEach(x => { if (r.cost.col[x] > 0){ r.cost.col[x]--; cut++; } else { const i = r.cost.hyb.findIndex(h => h.includes(x)); if (i >= 0){ r.cost.hyb.splice(i, 1); cut++; } } });
        if (cut) r.notes.push(`${cname(b)} −${cut} colored`); }
      // Defilers: pay 2 life → {C} less of that color
      const use = UI.n24def && UI.n24def.cid === c.id ? UI.n24def.cols : (UI.n24defAll ? n24defilers(c).map(x => x.col) : []);
      for (const col of use){ if (r.cost.col[col] > 0){ r.cost.col[col]--; r.notes.push(`2 life for {${col}}`); } }
      // Shadow of Mortality
      if (/if your life total is less than your starting life total, ~ costs \{x\} less to cast, where x is the difference/i.test(tname(a.o || '', a.n))){ const start = S.life0 || (typeof FMT !== 'undefined' && FMT[S.fmt] && FMT[S.fmt].life) || 40; const d = Math.max(0, start - S.life); const cut = Math.min(d, r.cost.gen); if (cut){ r.cost.gen -= cut; r.notes.push(`life below starting −${cut}`); } }
      // Liesa: commander tax paid with life
      if (zone === 'cz' && /rather than pay \{2\} for each previous time you've cast ~ from the command zone this game, pay 2 life that many times/i.test(tname(a.o || '', a.n))){ const t = 2 * (S.tax[c.k] || 0); if (t){ r.cost.gen = Math.max(0, r.cost.gen - t); r.notes = r.notes.filter(x => !/commander tax/.test(x)); r.notes.push(`commander tax paid as ${t} life`); r.n24life = t; } }
    } catch (e){ console.warn(e); }
    return r;
  };
  const cc = castCheck;
  castCheck = function(c, zone){
    const r = cc(c, zone);
    try { if (r && !r.ok && c && n24defilers(c).length && S.life >= 2 && /^Costs /.test(r.why || '')){ UI.n24defAll = true; try { const r2 = cc(c, zone); if (r2.ok) return r2; } finally { UI.n24defAll = false; } } } catch {}
    try { if (r && r.ok && c && zone === 'cz' && /pay 2 life that many times/i.test(info(c.k)?.o || '')){ const t = 2 * (S.tax[c.k] || 0); if (t && S.life < t) return {ok:false, why:`Liesa: you need ${t} life for the commander tax`}; } } catch {}
    return r;
  };
}

/* ---------- additional costs on spells: "As an additional cost to cast this spell, …" ---------- */
// returns a list of parts, or null when the wording isn't understood
function n24addParse(str){
  const parts = []; let m;
  const s0 = String(str || '').toLowerCase().replace(/\.$/, '').trim();
  if (/any number of artifacts and\/or creatures/.test(s0)) return null;   // Dargo-style: engine9
  const alts = s0.split(/ or (?=(?:sacrifice|discard|pay|tap|reveal|exile|behold)\b)/);
  if (alts.length > 1){
    const opts = [];
    for (const a of alts){ const mm = a.match(/^pay ((?:\{[^}]+\})+)$/); if (mm){ opts.push({t:'mana', mana:mm[1].toUpperCase(), label:`pay ${mm[1].toUpperCase()}`}); continue; } const p = n24addParse(a); if (!p || p.length !== 1) return null; opts.push(p[0]); }
    return [{t:'or', opts, label:s0}];
  }
  const opt = /^you may /.test(s0); const s = s0.replace(/^you may /, '');
  for (const p of s.split(/,? and (?=(?:sacrifice|discard|pay|exile|return|tap|behold|reveal)\b)/)){
    const q = p.trim();
    if ((m = q.match(/^sacrifice one or more (.+?)$/))) parts.push({t:'sacAny', desc:sing(m[1]), label:`sacrifice one or more ${m[1]}`});
    else if ((m = q.match(/^sacrifice (an?|one|two|three|four|five) (.+?)$/)) && !/\bany number\b|\bx\b/.test(q)) parts.push({t:'sac', n:n24n(m[1]), desc:sing(m[2].replace(/ or more$/, '')), label:`sacrifice ${m[1]} ${m[2]}`});
    else if ((m = q.match(/^sacrifice any number of (.+?)$/))) parts.push({t:'sacAny', desc:sing(m[1]), label:`sacrifice any number of ${m[1]}`});
    else if ((m = q.match(/^sacrifice x (.+?)$/))) parts.push({t:'sacX', desc:sing(m[1]), label:`sacrifice X ${m[1]}`});
    else if ((m = q.match(/^pay ((?:\{[^}]+\})+)$/))) parts.push({t:'mana', mana:m[1].toUpperCase(), label:`pay ${m[1].toUpperCase()}`});
    else if ((m = q.match(/^discard (an?|one|two|three) (?:(.+?) )?cards?$/))) parts.push({t:'discard', n:n24n(m[1]), desc:(m[2] || '').trim(), label:`discard ${m[1]} ${m[2] ? m[2] + ' ' : ''}card${n24n(m[1]) > 1 ? 's' : ''}`});
    else if ((m = q.match(/^discard your hand$/))) parts.push({t:'discHand', label:'discard your hand'});
    else if ((m = q.match(/^pay (\d+) life$/))) parts.push({t:'life', n:+m[1], label:`pay ${m[1]} life`});
    else if ((m = q.match(/^pay x life$/))) parts.push({t:'lifeX', label:'pay X life'});
    else if ((m = q.match(/^exile (an?|one|two|three|four|five|six|seven|eight|\d+) (?:other )?(?:(.+?) )?cards? from your graveyard$/))) parts.push({t:'gyEx', n:n24n(m[1]), desc:(m[2] || '').trim(), label:`exile ${m[1]} cards from your graveyard`});
    else if ((m = q.match(/^exile an? (.+?) card from your hand$/))) parts.push({t:'exile', desc:m[1], label:`exile a ${m[1]} card from your hand`});
    else if ((m = q.match(/^return an? (.+?) you control to its owner's hand$/))) parts.push({t:'bounce', desc:m[1], label:`return a ${m[1]} you control to its owner's hand`});
    else if ((m = q.match(/^tap (an?|one|two|three|four|five) untapped (.+?) you control$/))) parts.push({t:'tapc', n:n24n(m[1]), desc:sing(m[2]), label:`tap ${m[1]} untapped ${m[2]}`});
    else if ((m = q.match(/^(?:behold|reveal) an? (.+?)(?: card from your hand)?( and exile it)?$/))) parts.push({t:'behold', desc:m[1].replace(/ card$/, ''), ex:!!m[2], hand:/reveal/.test(q), label:q});
    else return null;
  }
  if (!parts.length) return null;
  if (opt) parts.forEach(x => { x.opt = true; });
  return parts;
}
function n24addsOf(c){
  const a = c && info(c.k); if (!a) return null;
  const t = tname(a.o || '', a.n).replace(/\s*\([^()]*\)/g, '');
  const m = t.match(/(?:^|\n)as an additional cost to cast (?:~|this spell), ([^.\n]+)\./i); if (!m) return null;
  return n24addParse(m[1]);
}
const n24cands = (x, c) => {
  if (x.t === 'sac' || x.t === 'sacAny' || x.t === 'sacX'){ const pm = String(x.desc).match(/with power (\d+) or greater/); return S.bf.filter(b => !b.fd && b.id !== c.id && descOk(b.k, x.desc, {tok:b.tok}) && (!pm || (stats(b) || [0, 0])[0] >= +pm[1])); }
  if (x.t === 'mana') return payPlan(parseCost(x.mana), S.pool).err ? [] : [{}];
  if (x.t === 'life') return S.life >= x.n ? [{}] : [];
  if (x.t === 'or') return x.opts.some(o => n24cands(o, c).length >= (o.n || 1)) ? [{}] : [];
  if (x.t === 'discard') return S.hand.filter(h => h.id !== c.id && (!x.desc || descOk(h.k, x.desc)));
  if (x.t === 'gyEx') return S.gy.filter(g => g.id !== c.id && (!x.desc || descOk(g.k, x.desc)));
  if (x.t === 'exile') return S.hand.filter(h => h.id !== c.id && descOk(h.k, x.desc));
  if (x.t === 'bounce') return S.bf.filter(b => !b.fd && descOk(b.k, x.desc, {tok:b.tok}));
  if (x.t === 'tapc') return S.bf.filter(b => !b.fd && !b.tap && b.id !== c.id && descOk(b.k, x.desc, {tok:b.tok}));
  if (x.t === 'behold') return (x.hand ? [] : S.bf.filter(b => !b.fd && b.id !== c.id && descOk(b.k, x.desc, {tok:b.tok}))).concat(S.hand.filter(h => h.id !== c.id && descOk(h.k, x.desc)));
  return [];
};
function n24addWhy(parts, c){
  for (const x of parts || []){
    if (x.opt || x.t === 'sacAny' || x.t === 'sacX' || x.t === 'lifeX' || x.t === 'discHand') continue;
    if (x.t === 'life'){ if (S.life < x.n) return `you need ${x.n} life`; continue; }
    if (x.t === 'or'){ if (!n24cands(x, c).length) return `can't pay the additional cost (${x.label})`; continue; }
    if (n24cands(x, c).length < (x.n || 1)) return `can't pay the additional cost (${x.label})`;
  }
  return '';
}
// pay the chosen parts (after the spell is on the stack); returns a record of what was paid
async function n24payAdds(parts, c, pre){
  const rec = {sac:[], n:0}; const nm = cname(c);
  // CR 601.2h: every mandatory part must still be payable now, or the spell can't be cast at all
  if (!UI.dry){ const why = n24addWhy(parts, c); if (why) return {...rec, fail:why}; }
  const pick = async (cards, n, title, min) => { if (cards.length <= n && min >= cards.length) return cards.map(x => x.id); let r = await pickCards({title, cards, min, max:n}); r = (r || []).filter(id => cards.some(x => x.id === id)); for (const x of cards){ if (r.length >= min) break; if (!r.includes(x.id)) r.push(x.id); } return r; };
  for (const x of parts){
    if (x.t === 'sacAny' || x.t === 'sacX'){ const ids = (pre && pre.ids) || []; ids.forEach(id => { const b = S.bf.find(y => y.id === id); if (b){ rec.sac.push({k:b.k, cp:b.cp || 0, cm:b.cm || 0, tok:!!b.tok, pw:(stats(b) || [0, 0])[0]}); sacrificeOne(b); } }); rec.n = ids.length; if (x.t === 'sacX') rec.x = ids.length; if (ids.length) log(`sacrificed ${ids.length} for ${nm}`); continue; }
    if (x.opt && !UI.dry && !(await askYes(`${nm}: ${x.label} as an additional cost?`, 'Yes', 'No'))) continue;
    if (x.t === 'or'){ const ok = x.opts.filter(o => n24cands(o, c).length >= (o.n || 1)); if (!ok.length){ if (!x.opt) rec.fail = x.label; continue; } let ch = ok[0]; if (ok.length > 1){ const v = await askChoice({title:`${nm}: additional cost`, options:ok.map((o, i) => ({label:cap(o.label), value:i}))}); ch = ok[v == null ? 0 : v]; } const sub = await n24payAdds([ch], c, pre); rec.sac.push(...sub.sac); Object.assign(rec, {...sub, sac:rec.sac}); rec.orPaid = ch.label; continue; }
    if (x.t === 'mana'){ const plan = payPlan(parseCost(x.mana), S.pool); if (!plan.err){ S.pool = plan.pool; if (plan.life) S.life -= plan.life; log(`paid ${x.mana} for ${nm}`); } else if (!x.opt) rec.fail = x.label; continue; }
    if (x.t === 'life'){ if (S.life < x.n){ if (!x.opt) rec.fail = x.label; continue; } S.life -= x.n; log(`paid ${x.n} life for ${nm}`); continue; }
    if (x.t === 'lifeX'){ const v = await askNumber(`${nm}: pay how much life (X)?`, `You have ${S.life} life`, 0); const n = Math.max(0, Math.min(S.life, +v || 0)); S.life -= n; rec.x = n; log(`paid ${n} life (X) for ${nm}`); continue; }
    if (x.t === 'discHand'){ S.hand.slice().forEach(h => { if (h.id !== c.id) moveCard(h.id, 'gy'); }); continue; }
    const cands = n24cands(x, c); const n = x.n || 1; if (!cands.length){ if (!x.opt) rec.fail = rec.fail || x.label; continue; }
    if (x.t === 'sac'){ const ids = await pick(cands, n, `${nm}: sacrifice ${x.label.replace(/^sacrifice /, '')}`, Math.min(n, cands.length)); let done = 0; ids.slice(0, n).forEach(id => { const b = S.bf.find(y => y.id === id); if (b){ rec.sac.push({k:b.k, cp:b.cp || 0, cm:b.cm || 0, tok:!!b.tok, pw:isCreatureCard(b) ? (stats(b) || [0, 0])[0] : 0}); sacrificeOne(b); done++; } }); if (done < n && !x.opt) rec.fail = rec.fail || x.label; continue; }
    if (x.t === 'discard'){ const ids = await pick(cands, n, `${nm}: ${x.label}`, Math.min(n, cands.length)); ids.slice(0, n).forEach(id => moveCard(id, 'gy')); rec.disc = ids.map(id => (find(id)[2] || {}).k); continue; }
    if (x.t === 'gyEx'){ const ids = await pick(cands, n, `${nm}: ${x.label}`, Math.min(n, cands.length)); ids.slice(0, n).forEach(id => moveCard(id, 'ex', {quiet:true})); log(`exiled ${Math.min(n, ids.length)} cards from their graveyard for ${nm}`); continue; }
    if (x.t === 'exile'){ const ids = await pick(cands, 1, `${nm}: ${x.label}`, 1); ids.slice(0, 1).forEach(id => moveCard(id, 'ex')); continue; }
    if (x.t === 'bounce'){ const ids = await pick(cands, 1, `${nm}: ${x.label}`, 1); ids.slice(0, 1).forEach(id => moveCard(id, 'hand')); continue; }
    if (x.t === 'tapc'){ const ids = await pick(cands, n, `${nm}: ${x.label}`, Math.min(n, cands.length)); ids.slice(0, n).forEach(id => { const b = S.bf.find(y => y.id === id); if (b) b.tap = true; }); continue; }
    if (x.t === 'behold'){ const ids = await pick(cands, 1, `${nm}: ${x.label}`, 1); const id = ids[0]; const b = id != null && find(id)[2]; if (b){ rec.behold = b.k; log(`${nm}: beheld ${cname(b)}`); if (x.ex){ moveCard(id, 'ex'); rec.bExId = id; } } continue; }
  }
  return rec;
}

/* ---------- granted cost keywords (convoke, improvise, emerge, replicate) ---------- */
let N24ZONE = '';
function n24kwFor(c){
  const out = new Set(); if (!S || !c || !c.k || isLand(c.k)) return out;
  const zone = N24ZONE || (typeof R21CTX !== 'undefined' && R21CTX && R21CTX.zone) || UI.castFrom || 'hand';
  for (const r of rulesOn('n24kw')){ if (r.ex && zone !== 'ex') continue; if (r.desc && !descOk(c.k, r.desc)) continue; out.add(r.kw); }
  for (const n of (S.n24next || [])) if (n.t === turnStr()) out.add(n.kw);
  return out;
}
{
  const ek = extraKinds;
  extraKinds = function(c){ const r = ek(c); try { if (r && !r.convoke && n24kwFor(c).has('convoke')) return {...r, convoke:true}; } catch {} return r; };
  const rt = r21bText;
  r21bText = function(k, fl){ let t = rt(k, fl); try { const c = N24CASTC; if (c && c.k === k && !fl){ const kws = n24kwFor(c); const a = info(k); if (kws.has('improvise') && !/(?:^|\n)improvise(?:\n|$)/i.test(t)) t += '\nImprovise'; if (kws.has('emerge') && a.m && !/(?:^|\n)emerge/i.test(t)) t += `\nEmerge ${a.m}`; if (kws.has('replicate') && a.m && !/(?:^|\n)replicate/i.test(t)) t += `\nReplicate ${a.m}`; } } catch {} return t; };
  const ra = r21bAlts;
  r21bAlts = function(c, zone){ const keep = N24CASTC, kz = N24ZONE; N24CASTC = c; N24ZONE = zone; try { return ra(c, zone); } finally { N24CASTC = keep; N24ZONE = kz; } };
  const rd = r21bAdds;
  r21bAdds = function(c){ const keep = N24CASTC; N24CASTC = c; try { return rd(c); } finally { N24CASTC = keep; } };
}

/* ---------- mana provenance: which permanent made each mana in your pool ---------- */
let N24SRC = null, N24PICKS = null, N24CAST = null;
function n24tag(c){
  let t = ''; try { t = typeOf(c) || info(c.k)?.t || ''; } catch { t = info(c && c.k)?.t || ''; }
  const nm = c && c.k ? (info(c.k)?.n || '') : '';
  return {tr:/\bTreasure\b/.test(t) || /^Treasure$/.test(nm), cr:/\bCreature\b/.test(t), ar:/\bArtifact\b/.test(t), sn:/\bSnow\b/.test(t)};
}
function n24syncProv(){
  if (!S) return; S.n24prov = S.n24prov || [];
  for (const col of MANA){ const have = S.n24prov.filter(e => e.c === col); let over = have.length - (S.pool[col] || 0); if (over <= 0) continue;
    // drop untagged entries first
    const order = have.slice().sort((a, b) => (a.tr || a.cr || a.ar || a.sn ? 1 : 0) - (b.tr || b.cr || b.ar || b.sn ? 1 : 0));
    for (const e of order){ if (over <= 0) break; S.n24prov.splice(S.n24prov.indexOf(e), 1); over--; } }
}
{
  const ad = addMana;
  addMana = function(outs){
    if (!S) return ad(outs);
    const before = {...S.pool}; const r = ad(outs);
    try {
      let src = N24SRC; if (!src && N24PICKS){ const pk = N24PICKS.find(p => p.outs === outs); if (pk) src = pk.c; }
      const tag = src ? n24tag(src) : {}; S.n24prov = S.n24prov || [];
      for (const col of MANA){ const d = (S.pool[col] || 0) - (before[col] || 0); for (let i = 0; i < d; i++) S.n24prov.push({c:col, ...tag}); if (N24CAST && d > 0) N24CAST.add[col] = (N24CAST.add[col] || 0) + d; }
      if (S.n24prov.length > 60) S.n24prov.splice(0, S.n24prov.length - 60);
    } catch (e){ console.warn(e); }
    return r;
  };
  const am = activateMana;
  activateMana = async function(c, ...a){ const keep = N24SRC; N24SRC = c; try { return await am(c, ...a); } finally { N24SRC = keep; } };
  const at = autoTapNow;
  autoTapNow = function(picks){ const keep = N24PICKS; N24PICKS = picks; try { return at(picks); } finally { N24PICKS = keep; } };
}
function n24spentFrom(before, add){
  const spent = {}; let tot = 0;
  for (const col of MANA){ const s = Math.max(0, (before[col] || 0) + (add[col] || 0) - (S.pool[col] || 0)); spent[col] = s; tot += s; }
  const rec = {tot, col:spent, tr:0, cr:0, ar:0, sn:0, t:turnStr()};
  S.n24prov = S.n24prov || [];
  for (const col of MANA){
    let s = spent[col]; if (!s) continue;
    const have = S.n24prov.filter(e => e.c === col).sort((a, b) => (b.tr ? 4 : 0) + (b.cr ? 2 : 0) + (b.ar ? 1 : 0) + (b.sn ? 1 : 0) - ((a.tr ? 4 : 0) + (a.cr ? 2 : 0) + (a.ar ? 1 : 0) + (a.sn ? 1 : 0)));
    for (const e of have){ if (!s) break; if (e.tr) rec.tr++; if (e.cr) rec.cr++; if (e.ar) rec.ar++; if (e.sn) rec.sn++; S.n24prov.splice(S.n24prov.indexOf(e), 1); s--; }
  }
  n24syncProv();
  return rec;
}
function n24spFor(ctx){
  if (!S) return null; const sp = S.n24sp || {};
  const it = ctx && ctx.it;
  if (it && it.evId != null && sp[it.evId]) return sp[it.evId];
  if (it && it.n24sp) return it.n24sp;
  if (it && it.card && sp[it.card.id]) return sp[it.card.id];
  const c = ctx && srcCardOf(ctx); if (c && sp[c.id]) return sp[c.id];
  if (ctx && ctx.srcId != null && sp[ctx.srcId]) return sp[ctx.srcId];
  return null;
}

/* ---------- the cast itself: additional costs, Defilers, once-each-turn alternatives, Liesa, mana spent ---------- */
{
  const sc = spellCost;
  spellCost = function(c, zone, o = {}){
    const r = sc(c, zone, o);
    try { if (UI.casting && c && o && o.alt && o.alt.n24) UI.n24alt = {cid:c.id, key:o.alt.n24, once:o.alt.once};
      const pre = UI.n24pre; if (pre && c && pre.cid === c.id && pre.red && r && r.cost){ const cut = Math.min(pre.red, r.cost.gen); if (cut){ r.cost.gen -= cut; r.notes.push(`${cut} sacrificed −${cut}`); } } } catch {}
    return r;
  };
  const cc = castCheck;
  castCheck = function(c, zone){
    try { if (c && c.k && S && !isLand(c.k)){ const adds = n24addsOf(c); if (adds){ const why = n24addWhy(adds, c); if (why) return {ok:false, why:cap(why)}; } } } catch {}
    const kz = N24ZONE; N24ZONE = zone; try { return cc(c, zone); } finally { N24ZONE = kz; }
  };
  const bc = beginCast;
  beginCast = async function(c, zone, o = {}){
    if (!S || !c || !c.k || UI.casting || isLand(c.k)) return bc(c, zone, o);
    const nm = cname(c); const n0 = S.stk.length;
    const adds = n24addsOf(c);
    if (adds && !UI.dry){ const why = n24addWhy(adds, c); if (why){ toast(`${nm}: ${why}`); return; } }
    // optional "sacrifice any number of …" that lowers the cost: chosen now
    let pre = null;
    const anyP = adds && adds.find(x => x.t === 'sacAny' || x.t === 'sacX');
    if (anyP && !UI.dry){
      const list = n24cands(anyP, c);
      const per = (tname(info(c.k)?.o || '', info(c.k)?.n).match(/~ costs \{(\d+)\} less to cast for each permanent sacrificed this way/i) || [])[1];
      if (list.length){ const ids = await pickCards({title:`${nm}: ${anyP.label}?${per ? ` (each makes it cost {${per}} less)` : ''}`, cards:list, min:0, max:list.length, noneLabel:'Sacrifice nothing'}); if (ids == null) return; pre = {cid:c.id, ids, red:per ? +per * ids.length : 0}; }
    }
    // Defilers: pay 2 life for a colored mana
    let def = null;
    const defs = n24defilers(c);
    if (defs.length && !UI.dry && !o.free){
      const base = spellCost(c, zone); const cols = [];
      for (const d of defs){ if (!(base.cost.col[d.col] > 0) || S.life < 2 * (cols.length + 1)) continue;
        const y = await askChoice({title:`${d.src}: pay 2 life so ${nm} costs {${d.col}} less?`, options:[{label:'Pay 2 life', value:1}, {label:"Don't", value:0}]}); if (y == null) return; if (y) cols.push(d.col); }
      if (cols.length) def = {cid:c.id, cols};
    }
    const before = {...S.pool}; const cast = {add:{}};
    const keepC = N24CASTC, keepZ = N24ZONE, keepCast = N24CAST;
    N24CASTC = c; N24ZONE = zone; N24CAST = cast; UI.n24pre = pre; UI.n24def = def; UI.n24alt = null;
    let r;
    try { r = await bc(c, zone, o); }
    finally { N24CASTC = keepC; N24ZONE = keepZ; N24CAST = keepCast; UI.n24pre = null; UI.n24def = null; }
    const it = S.stk.length > n0 ? S.stk.slice(n0).find(x => x.kind === 'spell' && x.card === c) : null;
    const alt = UI.n24alt; UI.n24alt = null;
    if (!it) return r;
    try {
      const sp = n24spentFrom(before, cast.add); it.n24sp = sp; if (sp.tot === 0 && !o.free && !alt) {} if (sp.tot > 0) delete it.r21free; else it.r21free = 1; S.n24sp = S.n24sp || {}; S.n24sp[c.id] = sp; const ks = Object.keys(S.n24sp); if (ks.length > 40) delete S.n24sp[ks[0]];
      if (alt && alt.cid === c.id && alt.once) n24markOnce(alt.key);
      if (sp.ar > 0 && rulesOn('n24arSS').length){ it.ss = true; log(`${it.nm} has split second (mana from an artifact was spent)`); }
      if (sp.tr > 0) for (const r of rulesOn('n24trCascade')){ const key = 'trc:' + r.src; if (n24once(key)) continue; n24markOnce(key); pushTrig(r.src, 'Exile cards from the top until a nonland card with lower mana value; you may cast it free (cascade).', {k:c.k, cmv:it.mv || info(c.k)?.mv || 0}); }
      if (def){ S.life -= 2 * def.cols.length; log(`paid ${2 * def.cols.length} life for ${def.cols.map(x => '{' + x + '}').join('')} (Defiler)`); }
      if (zone === 'cz' && /pay 2 life that many times/i.test(info(c.k)?.o || '')){ const t = 2 * Math.max(0, (S.tax[c.k] || 1) - 1); if (t){ S.life -= t; log(`paid ${t} life instead of the commander tax`); } }
      if (S.n24next && S.n24next.length){ const kws = new Set(S.n24next.filter(n => n.t === turnStr()).map(n => n.kw)); if (kws.size) S.n24next = S.n24next.filter(n => n.t !== turnStr()); }
      if (adds){ let rec; try { rec = await n24payAdds(adds, c, pre); } catch (e){ console.warn('n24 additional cost', e); rec = {sac:[], n:0, fail:'the cost could not be paid'}; }
        if (rec.fail){ // the additional cost can't be paid: the spell is not cast (CR 601.2h) — back to where it came from, mana back in the pool
          const i = S.stk.indexOf(it); if (i >= 0) S.stk.splice(i, 1); if (S.pass === 's:' + it.sid) S.pass = '';
          if (zone === 'cz' && S.tax[c.k]) S.tax[c.k]--; (Array.isArray(S[zone]) ? S[zone] : S.hand).push(c);
          for (const col of MANA) if (sp.col && sp.col[col]) S.pool[col] = (S.pool[col] || 0) + sp.col[col];
          log(`couldn't pay the additional cost of ${nm} (${rec.fail}) — it isn't cast`); toast(`${nm}: can't pay the additional cost (${rec.fail})`); commit(); return r; }
        if (rec.sac.length){ it.sacd = rec.sac[rec.sac.length - 1]; it.n24sacN = rec.sac.length; it.n24sacd = rec.sac; } if (rec.x != null) it.x = rec.x; if (rec.behold) it.n24behold = rec.behold; if (rec.bExId != null){ c.n24bEx = rec.bExId; } if (rec.disc) it.n24disc = rec.disc; it.n24paid = 1; }
      commit();
    } catch (e){ console.warn(e); }
    return r;
  };
}

/* ---------- granted mana abilities: "<things> you control have "{T}: Add …"" and effects that grant them ---------- */
STATIC_RULES.push(
  [/^(?:each )?(?:other )?(.+?) you control (?:have|has) "(\{t\}(?:, sacrifice ~)?): add ([^"]+?)"?$/, m => ({kind:'n24gmana', who:'you'})],
  [/^spend this mana only (?:to|on) .+"$/, m => ({kind:'n24note', who:'you'})],
);
const N24GL = new Map();
function n24grantLines(b){
  if (!b || b.fd) return [];
  const key = b.k + (b.fl ? '|b' : ''); let base = N24GL.get(key);
  if (!base){ base = n24grantLines0(b); N24GL.set(key, base); }
  return base.map(g => ({...g, src:b}));
}
function n24grantLines0(b){
  const out = []; const t = n24text(b); if (!t || !/ you control (?:have|has) "\{T\}/i.test(t)) return out;
  for (const line of t.split('\n')){
    const m = line.trim().match(/^(?:Each )?(Other )?(.+?) you control (?:have|has) "(\{T\}(?:, Sacrifice ~)?): (Add [^"]+?)\.?"\.?$/i); if (!m) continue;
    const body = m[4]; const i = body.search(/\.\s+/); const eff = i >= 0 ? body.slice(0, i) : body; const rest = i >= 0 ? body.slice(i).replace(/^\.\s+/, '').replace(/\.$/, '') : '';
    out.push({other:!!m[1], desc:sing(m[2].toLowerCase()), cost:m[3], eff, rest, src:b});
  }
  return out;
}
function n24mkAb(c, g, srcName){
  let outs; const eff = g.eff;
  if (/one mana of any of ~'s colou?rs/i.test(eff)){ const cols = (info(g.src.k)?.c || '').split('').filter(x => /[WUBRG]/.test(x)); outs = cols.length ? cols.map(x => [x]) : [['C']]; }
  else outs = manaOuts(eff);
  let ab = {cost:g.cost, eff:eff.replace(/~/g, srcName), rest:g.rest, outs, tapOnly:/^\{T\}$/i.test(g.cost), line:`${g.cost}: ${eff.replace(/~/g, srcName)}.${g.rest ? ' ' + g.rest + '.' : ''}`, n24:true};
  if (!outs.length && typeof r21apply === 'function'){ try { ab = r21apply(ab, c); ab.n24 = true; } catch {} }
  return ab;
}
{
  const ma = manaAbs;
  manaAbs = function(c){
    let out = ma(c);
    try {
      if (!S || !c || !S.bf.includes(c) || c.fd || out.some(o => o.n24)) return out;
      const add = [];
      for (const b of S.bf){ if (b.fd) continue; for (const g of n24grantLines(b)){
        if (g.other && b === c) continue;
        if (!descOk(c.k, g.desc, {tok:c.tok})) continue;
        const ab = n24mkAb(c, g, cname(b));
        if (out.concat(add).some(o => o.tapOnly === ab.tapOnly && String(o.eff).toLowerCase() === String(ab.eff).toLowerCase() && (o.rest || '') === (ab.rest || ''))) continue;
        add.push(ab);
      } }
      // granted by an effect (Glorious Sunrise, Song of Freyalise, Glimpse the Impossible)
      for (const g of (c.n24gab || [])){
        if (g.until === 'eot' && g.t !== turnStr()) continue;
        if (g.until === 'next' && n24myTurn() && g.t !== turnStr()) continue;
        const ab = n24mkAb(c, {cost:g.cost, eff:g.eff, rest:g.rest || '', src:c}, g.src);
        if (!out.concat(add).some(o => o.line === ab.line)) add.push(ab);
      }
      if (add.length) out = out.concat(add);
    } catch (e){ console.warn(e); }
    return out;
  };
}

/* ---------- unspent mana: Omnath, Kruphix, Horizon Stone, Ozai, Omnath Locus of All, The Last Agni Kai ---------- */
{
  const et = engineTick;
  engineTick = function(...a){
    let keep = null, ph0 = null;
    try { if (S && poolTotal(S.pool)){ keep = {...S.pool}; ph0 = S.seenPh; } } catch {}
    const r = et.apply(this, a);
    try {
      if (keep && S.seenPh !== ph0 && poolTotal(S.pool) < poolTotal(keep)){
        const kc = new Set(rulesOn('n24keep').map(x => x.col)); if (S.n24keepR === turnStr()) kc.add('R');
        const conv = rulesOn('n24conv')[0];
        if (kc.size || conv){
          const np = {...emptyPool()}; let kept = 0, cv = 0;
          for (const col of MANA){ const n = keep[col] || 0; if (!n) continue; if (kc.has(col)){ np[col] += n; kept += n; } else if (conv){ np[conv.col] += n; cv += n; } }
          for (const col of MANA) np[col] = Math.max(np[col], S.pool[col] || 0);
          if (kept || cv){ S.pool = np; log(`unspent mana ${kept ? 'kept' : ''}${kept && cv ? ', ' : ''}${cv ? `${cv} became {${conv.col}} (${conv.src})` : ''}`); n24syncProv(); commit(); }
        }
      }
      if (S && S.n24prov && !poolTotal(S.pool) && S.n24prov.length) S.n24prov = [];
    } catch (e){ console.warn(e); }
    return r;
  };
}

/* ---------- conditions about the mana spent ---------- */
{
  const jc = jCond;
  jCond = function(cond, ctx){
    const r = jc(cond, ctx); if (r != null) return r;
    try {
      let l = String(cond).toLowerCase().trim(); let m;
      const nm = ctx && ctx.name ? String(ctx.name).toLowerCase() : ''; if (nm) l = l.split(nm).join('~');
      l = l.replace(/\b(?:that spell|this spell|that creature)\b|~(?!'s)/g, 'it');
      if (!/\bspent\b/.test(l)) return null;
      const ep = ctx && ctx.it && ctx.it.evPid;
      if (ep && ep !== MYPID && (!UI.dry || /^no mana was spent/.test(l))) return null;
      const sp = n24spFor(ctx) || {tot:0, col:{}, tr:0, cr:0, ar:0, sn:0};
      if ((m = l.match(/^(?:any )?mana from an? (treasure|artifact|creature)s? (?:was|were) spent to cast it$/))) return sp[{treasure:'tr', artifact:'ar', creature:'cr'}[m[1]]] > 0;
      if ((m = l.match(/^(two|three|four|five|\d+) or more mana from (creatures|artifacts|treasures) (?:was|were) spent to cast it$/))) return sp[{creatures:'cr', artifacts:'ar', treasures:'tr'}[m[2]]] >= n24n(m[1]);
      if ((m = l.match(/^at least (one|two|three|four|five|six|seven|\d+) mana (?:was|were) spent to cast it$/))) return sp.tot >= n24n(m[1]);
      if ((m = l.match(/^at least (one|two|three|four|five|\d+) (white|blue|black|red|green|colorless) mana (?:was|were) spent to cast it$/))) return (sp.col[{white:'W', blue:'U', black:'B', red:'R', green:'G', colorless:'C'}[m[2]]] || 0) >= n24n(m[1]);
      if (/^no mana was spent to cast it$/.test(l) || /^no mana was spent to cast them$/.test(l)) return sp.tot === 0;
      if ((m = l.match(/^((?:\{[wubrgc]\})+) (?:was|were) spent to cast it$/))){ const need = {}; (m[1].match(/[wubrgc]/g) || []).forEach(x => { need[x.toUpperCase()] = (need[x.toUpperCase()] || 0) + 1; }); return Object.entries(need).every(([k, v]) => (sp.col[k] || 0) >= v); }
      if (/^the amount of mana spent to cast it was less than its mana value$/.test(l)){ const k = ctx && ctx.it && ctx.it.evk; return sp.tot < (info(k)?.mv || 0); }
      if ((m = l.match(/^the amount of mana spent to cast it is greater than ~'s power$/))){ const c = srcCardOf(ctx); return sp.tot > (c ? (stats(c) || [0, 0])[0] : 0); }
    } catch (e){ console.warn(e); }
    return null;
  };
}

/* ---------- effect sentences ---------- */
async function doRound24NPre(s, l, ctx){
  let m; const name = ctx.name || '';
  const nm = name.toLowerCase(); const L = nm ? l.split(nm).join('~') : l;
  // casting rules handled when the spell is cast
  if (/^cast ~ as though it had flash if you pay \{(\d+)\} more to cast it$/.test(L)) return true;
  if (/^this ability costs \{\d+\} less to activate during your turn$/.test(L)) return true;
  if (/^spend only mana of the chosen colou?r to activate this ability$/.test(L)) return true;
  // "X if {W} was spent to cast ~" (Batwing Brume)
  if ((m = L.match(/^(.+) if ((?:\{[wubrgc]\})+) was spent to cast ~$/))){ const ok = jCond(`${m[2]} was spent to cast it`, ctx); ctx.condResult = !!ok; if (ok || UI.dry) await doSentence(cap(s.slice(0, m[1].length)), ctx); else log(`${name}: ${m[2]} wasn't spent to cast it`); return true; }
  // "if <mana spent condition>, <effect>"
  if ((m = L.match(/^(?:then )?if ((?:any |at least |no |three or more |two or more |the amount of )?(?:mana|\{[wubrgc]\}|\w+ (?:colorless )?mana)[^,]*? spent to cast (?:it|~|that spell)(?: was less than its mana value| is greater than ~'s power)?), (.+)$/)) && !/^no mana was spent to cast that spell$/.test(m[1])){
    const ok = jCond(m[1], ctx); if (ok != null){ ctx.condResult = !!ok; if (ok || UI.dry) await doSentence(cap(s.slice(s.length - m[2].length)), ctx); else log(`${name}: condition not met (${m[1]})`); return true; }
  }
  // "Cast an artifact spell from your hand with mana value less than or equal to <N> without paying its mana cost" (Lady Octopus, Buster Sword)
  if ((m = L.match(/^(?:you may )?cast an? (?:(.+?) )?spell from your hand with mana value less than or equal to (.+?) without paying its mana cost$/))){
    let n = null; const ph = m[2];
    if (/^that damage$/.test(ph)) n = (ctx.it && (ctx.it.evAmt ?? ctx.it.amt ?? ctx.it.evN)) || 0;
    else n = countOf(ph, ctx);
    if (n == null) return false;
    if (UI.dry) return true;
    const list = S.hand.filter(h => !isLand(h.k) && (!m[1] || descOk(h.k, m[1])) && (info(h.k)?.mv || 0) <= n);
    if (!list.length){ log(`${name}: no ${m[1] ? m[1] + ' ' : ''}spell with mana value ${n} or less in hand`); return true; }
    const ids = await pickCards({title:`${name}: cast a spell with mana value ${n} or less without paying its mana cost?`, cards:list, min:0, max:1, noneLabel:"Don't cast"});
    const c = ids && ids[0] != null && S.hand.find(h => h.id === ids[0]); if (c){ UI.afterCast = () => {}; await beginCast(c, 'hand', {free:true}); }
    commit(); return true;
  }
  // Sunforger: "Search your library for a red or white instant card with mana value 4 or less and cast that card without paying its mana cost"
  if ((m = L.match(/^search your library for an? (.+?) card with mana value (\d+) or less and cast that card without paying its mana cost$/))){
    if (UI.dry) return true;
    const list = S.lib.filter(c => descOk(c.k, m[1]) && (info(c.k)?.mv || 0) <= +m[2]);
    const ids = list.length ? await pickCards({title:`${name}: search for a ${m[1]} card with mana value ${m[2]} or less`, cards:list, min:0, max:1, noneLabel:'Find nothing'}) : [];
    const c = ids && ids[0] != null && S.lib.find(x => x.id === ids[0]);
    if (c){ S.lib.splice(S.lib.indexOf(c), 1); S.ex.push(c); shuffleLib(); log(`${name}: found ${cname(c)}`); UI.afterCast = () => {}; await beginCast(c, 'ex', {free:true}); }
    else { shuffleLib(); log(`${name}: found nothing`); }
    commit(); return true;
  }
  // Alchemist's Talent
  if ((m = L.match(/^~ deals damage equal to that spell's mana value to each opponent$/))){ const k = ctx.it && ctx.it.evk; const n = (ctx.it && ctx.it.evMv) || info(k)?.mv || 0; if (n) await doSentence(`${name} deals ${n} damage to each opponent`, ctx); else log(`${name}: mana value 0`); return true; }
  // Roiling Vortex: any player's spell
  if ((m = L.match(/^if no mana was spent to cast that spell, (.+)$/))){
    const pid = ctx.it && ctx.it.evPid; const k = ctx.it && ctx.it.evk; let ok = false;
    if (pid === MYPID){ const sp = n24spFor(ctx); ok = !!sp && sp.tot === 0; }
    else if (pid){ const st = OPP.get(pid); const it = st && (st.stk || []).slice().reverse().find(x => x.kind === 'spell' && x.k === k); ok = !!(it && (st.r21free || []).includes(it.sid)); }
    ctx.condResult = ok; if (ok || UI.dry) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); else log(`${name}: mana was spent to cast that spell`); return true;
  }
  // Search for Glory
  if ((m = L.match(/^you gain (\d+) life for each \{s\} spent to cast ~$/))){ const sp = n24spFor(ctx); const n = +m[1] * ((sp && sp.sn) || 0); if (n) gainLife(n, name); log(`${name}: ${n ? 'gained ' + n + ' life' : 'no snow mana was spent'}`); commit(); return true; }
  // Ancient Cellarspawn: "target opponent loses life equal to the difference"
  if ((m = L.match(/^(?:if the amount of mana spent to cast it was less than its mana value, )?target opponent loses life equal to the difference$/))){
    const sp = n24spFor(ctx); const k = ctx.it && ctx.it.evk; const d = Math.max(0, (info(k)?.mv || 0) - ((sp && sp.tot) || 0));
    const t = (nextTargets(ctx) || []).find(x => x.pid && x.pid !== MYPID) || null;
    if (d && t){ loseLife(t.pid, d, name); log(`${name}: ${nameOf(t.pid)} loses ${d} life`); }
    commit(); return true;
  }
  // the next spell you cast this turn has improvise / convoke
  if ((m = L.match(/^the next spell you cast this turn has (improvise|convoke)$/))){ S.n24next = (S.n24next || []).filter(n => n.t === turnStr()).concat({kw:m[1], t:turnStr()}); log(`${name}: the next spell you cast this turn has ${m[1]}`); commit(); return true; }
  // The Last Agni Kai
  if (/^until end of turn, you don't lose unspent red mana as steps and phases end$/.test(L)){ S.n24keepR = turnStr(); log(`${name}: unspent red mana isn't lost this turn`); commit(); return true; }
  // granted mana abilities from effects
  if ((m = s.match(/^(?:Until end of turn, )?target (land|creature|artifact|permanent) gains "(\{T\}): (Add [^"]+?)\.?"(?: until end of turn)?$/i))){
    const ts = nextTargets(ctx) || []; for (const t of ts){ const c = t && t.pid === MYPID && t.id != null ? S.bf.find(b => b.id === t.id) : null; if (c){ c.n24gab = (c.n24gab || []).concat({cost:m[2], eff:m[3], until:'eot', t:turnStr(), src:name}); log(`${cname(c)} gains "${m[2]}: ${m[3]}" until end of turn`); } }
    commit(); return true;
  }
  if ((m = s.match(/^Until your next turn(?::|,) creatures you control gain "(\{T\}): (Add [^"]+?)\.?"$/i)) || (m = s.match(/^Creatures you control gain "(\{T\}): (Add [^"]+?)\.?" until your next turn$/i))){
    S.bf.filter(b => !b.fd && isCreatureCard(b)).forEach(c => { c.n24gab = (c.n24gab || []).concat({cost:m[1], eff:m[2], until:'next', t:turnStr(), src:name}); });
    log(`${name}: creatures you control gain "${m[1]}: ${m[2]}" until your next turn`); commit(); return true;
  }
  if ((m = s.match(/^(?:Those tokens|They|That token|It) (?:have|has) "Sacrifice (?:~|this (?:creature|token|artifact)): (Add \{[WUBRGC]\})\.?"$/i))){
    const ids = (ctx.made || ctx.lastMade || []); const list = (Array.isArray(ids) ? ids : []).map(id => S.bf.find(b => b.id === (id && id.id != null ? id.id : id))).filter(Boolean);
    list.forEach(c => { c.n24gab = (c.n24gab || []).concat({cost:'Sacrifice ~', eff:m[1], until:'perm', t:turnStr(), src:name}); });
    return true;
  }
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound24NPre(s, l, ctx)) return; return ds(s0, ctx); }; }

// Saproling Symbiosis-style: "Cast ~ as though it had flash if you pay {2} more to cast it"
{
  const to = timingOk;
  timingOk = function(c){ const r = to(c); try { if (r && !r.ok && c && c.k && phaseNow().n > 0 && !/split second/i.test(r.why || '') && /you may cast (?:~|this spell) as though it had flash if you pay \{\d+\} more to cast it/i.test(tname(info(c.k)?.o || '', info(c.k)?.n))) return {ok:true, n24flashTax:true}; } catch {} return r; };
  const sc = spellCost;
  spellCost = function(c, zone, o = {}){ const r = sc(c, zone, o); try { const m = c && c.k && tname(info(c.k)?.o || '', info(c.k)?.n).match(/you may cast (?:~|this spell) as though it had flash if you pay \{(\d+)\} more to cast it/i); if (m && r && r.cost && phaseNow().n > 0 && !sorceryTime()){ r.cost.gen += +m[1]; r.notes.push(`flash +${m[1]}`); } } catch {} return r; };
}

/* ---------- converge / "the amount of mana spent to cast this spell" ---------- */
{
  const co = countOf;
  countOf = function(phrase, ctx, ...a){
    try { const p = String(phrase || '').toLowerCase().replace(/^(?:the )?number of /, '').replace(/\.$/, '').trim();
      if (/^colou?rs of mana spent to cast (?:this spell|~|it|that spell)$/.test(p)){ const sp = n24spFor(ctx || {}); return sp ? ['W','U','B','R','G'].filter(x => (sp.col[x] || 0) > 0).length : 0; }
      if (/^(?:the )?amount of mana spent to cast (?:this spell|~|it|that spell)$/.test(p)){ const sp = n24spFor(ctx || {}); return sp ? sp.tot : 0; }
    } catch {}
    return co(phrase, ctx, ...a);
  };
}
