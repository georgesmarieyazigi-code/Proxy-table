// Round 21C: mana — every mana ability produces the right mana by itself
// (counts, "X mana", any combination, could-produce, chosen colour, multipliers and mana triggers, restricted mana, mana costs)
/* ---------- What a mana ability makes, read from its text ---------- */
const R21_COLS = ['W', 'U', 'B', 'R', 'G'];
const R21_W = {a:1, an:1, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10};
let R21_DEPTH = 0;
function r21syms(s){ return (String(s).match(/\{([wubrgc])\}/gi) || []).map(x => x[1].toUpperCase()); }
// colours (and C) a permanent could produce with its own mana abilities, without recursing into other “could produce” lands
function r21couldProduce(c){
  const set = new Set(); if (!c || !c.k) return set;
  if (R21_DEPTH > 1) return set;
  R21_DEPTH++;
  try {
    const abs = manaAbs(c);
    for (const ab of abs){ if (ab.r21cp) continue; (ab.outs || []).forEach(o => o.forEach(x => set.add(x))); if (ab.r21combo) ab.r21combo.cols.forEach(x => set.add(x)); if (ab.r21any) R21_COLS.forEach(x => set.add(x)); }
  } catch {} finally { R21_DEPTH--; }
  return set;
}
function r21count(phrase, c){
  let p = String(phrase || '').toLowerCase().replace(/\.$/, '').trim(); let m;
  const nm = c ? cname(c).toLowerCase() : ''; if (nm){ p = p.split(nm).join('~'); const sh = nm.split(',')[0]; if (sh.length > 2) p = p.split(sh).join('~'); }
  p = p.replace(/\bthis (creature|artifact|land|enchantment|permanent|vehicle)\b/g, '~').replace(/^(?:the number of|each) /, '');
  const mine = S.bf.filter(b => !b.fd);
  if ((m = p.match(/^(charge|storage|stash|soul|mining|depletion|fuse|gem|luck|loyalty|oil|time) counters? on ~$/))) return c ? (m[1] === 'loyalty' ? (c.co || 0) : ((c.nc || {})[m[1]] || 0)) : 0;
  if ((m = p.match(/^\+1\/\+1 counters? on ~$/))) return c ? (c.cp || 0) : 0;
  if ((m = p.match(/^~(?:'s)? power$/))) return c ? Math.max(0, stats(c)[0]) : 0;
  if ((m = p.match(/^~(?:'s)? toughness$/))) return c ? Math.max(0, stats(c)[1]) : 0;
  if ((m = p.match(/^the greatest power among (other )?creatures you control$/))) return Math.max(0, ...mine.filter(b => isCreatureCard(b) && !(m[1] && b === c)).map(b => stats(b)[0]));
  if ((m = p.match(/^the greatest toughness among (other )?creatures you control$/))) return Math.max(0, ...mine.filter(b => isCreatureCard(b) && !(m[1] && b === c)).map(b => stats(b)[1]));
  if ((m = p.match(/^your devotion to (white|blue|black|red|green)$/))){ const L = {white:'W', blue:'U', black:'B', red:'R', green:'G'}[m[1]]; return r21devotion(L); }
  if ((m = p.match(/^(other )?creatures? you control with defender$/))) return mine.filter(b => isCreatureCard(b) && kwOf(b, 'defender') && !(m[1] && b === c)).length;
  if ((m = p.match(/^(other )?creatures you control of (?:that|the chosen) colou?r$/))) return mine.filter(b => isCreatureCard(b) && (info(b.k)?.c || '').includes(c && c.r21col || 'X')).length;
  if (/^creatures you control of the chosen type$/.test(p)) return c && c.ctype ? mine.filter(b => isCreatureCard(b) && new RegExp('\\b' + c.ctype + '\\b', 'i').test(typeOf(b))).length : 0;
  if (/^urza's lands? you control$/.test(p)) return mine.filter(b => /Urza's/.test(info(b.k)?.t || '') && isLand(b.k)).length;
  if ((m = p.match(/^basic (\w+?)s? you control$/))) return mine.filter(b => /\bBasic\b/.test(info(b.k)?.t || '') && descOk(b.k, m[1], {tok:b.tok})).length;
  if ((m = p.match(/^the greatest number of creatures you control that have a creature type in common$/))){ const cnt = {}; mine.filter(isCreatureCard).forEach(b => { const st = ((info(b.k)?.t || '').split('—')[1] || '').trim().split(/\s+/).filter(Boolean); new Set(st).forEach(t => { cnt[t] = (cnt[t] || 0) + 1; }); }); return Math.max(0, ...Object.values(cnt)); }
  if ((m = p.match(/^(swamp|island|forest|mountain|plains)s? you control$/))){ const T = cap(m[1]); const all = rulesOn('landType').some(r => r.type === T) || rulesOn('allBasic').length > 0; return mine.filter(b => new RegExp('\\b' + T + '\\b').test(typeOf(b)) || (all && isLand(b.k))).reduce((a, b) => a + (b.n || 1), 0); }
  if ((m = p.match(/^permanent cards? in your graveyard$/))) return S.gy.filter(g => !/\b(Instant|Sorcery)\b/.test(info(g.k)?.t || '')).length;
  p = p.replace(/\ballies\b/g, 'ally').replace(/\belves\b/g, 'elf');
  const r = countOf(p, {k:c && c.k, name:c ? cname(c) : '', srcId:c ? c.id : null, card:c});
  return r == null ? null : Math.max(0, r);
}
function r21devotion(L){ return S.bf.reduce((a, b) => a + (b.fd ? 0 : ((faceOf(b)?.m || '').match(/\{[^}]+\}/g) || []).filter(s => s.includes(L)).length), 0); }
const R21_SPEC = new Map();
// spec of one mana ability effect: {fixed:[[…]] } | {combo:{n|count, cols, mono, distinct}} | {cp:'own'|'opp'|'basic'|'gate'} | {legend:…} | null
function r21spec(eff){
  const key = eff; if (R21_SPEC.has(key)) return R21_SPEC.get(key);
  const l = String(eff).replace(/\.$/, '').trim().toLowerCase(); let m; let r = null;
  const N = w => R21_W[w];
  if ((m = l.match(/^add (two|three|four|five|ten) mana of any one colou?r$/))) r = {combo:{n:N(m[1]), cols:R21_COLS, mono:true}};
  else if ((m = l.match(/^add (one|two|three|four|five) mana in any combination of colou?rs$/))) r = {combo:{n:N(m[1]), cols:R21_COLS}};
  else if ((m = l.match(/^add (one|two|three|four|five) mana in any combination of ((?:\{[wubrgc]\}(?:,? and\/or |, )?)+)$/))) r = {combo:{n:N(m[1]), cols:r21syms(m[2])}};
  else if ((m = l.match(/^add (two|three|four|five) mana of different colou?rs$/))) r = {combo:{n:N(m[1]), cols:R21_COLS, distinct:true}};
  else if ((m = l.match(/^add (one|two|three|four) mana of the chosen colou?r$/))) r = {chosen:N(m[1])};
  else if ((m = l.match(/^add (\{[wubrgc]\}) or one mana of the chosen colou?r$/))) r = {chosen:1, alt:r21syms(m[1])};
  else if ((m = l.match(/^add one mana of any (type|colou?r) that a (basic )?land you control could produce$/))) r = {cp:m[2] ? 'basic' : 'own', type:m[1] === 'type'};
  else if (/^add one mana of any colou?r that a land an opponent controls could produce$/.test(l)) r = {cp:'opp'};
  else if (/^add one mana of any colou?r that a gate you control could produce$/.test(l)) r = {cp:'gate'};
  else if ((m = l.match(/^add one mana of any colou?r among legendary (creatures and planeswalkers|permanents) you control$/))) r = {legend:m[1] === 'permanents' ? 'perm' : 'crpw'};
  else if (/^add one mana of any colou?r among legendary creature cards in your graveyard$/.test(l)) r = {legend:'gy'};
  if (false) ;
  else if ((m = l.match(/^add an amount of \{([bc])\} equal to the sacrificed creature's mana value$/))) r = {sacmv:{col:m[1].toUpperCase(), plus:0}};
  else if ((m = l.match(/^add x mana of any one colou?r, where x is (?:1|one) plus the exiled creature's mana value$/))) r = {sacmv:{col:null, plus:1}};
  else if ((m = l.match(/^add (\{[wubrgc]\}) for each (\w+) counter removed this way$/))) r = {removed:{col:r21syms(m[1])[0]}};
  else if ((m = l.match(/^add x mana in any combination of colou?rs$/))) r = {removed:{combo:true}};
  else if (/^add one mana of any type the sacrificed land could produce$/.test(l)) r = {sacland:true};
  else if ((m = l.match(/^add (six|seven|ten) (\{[wubrgc]\})$/))) r = {fixed:[Array(N(m[1])).fill(r21syms(m[2])[0])]};
  else if ((m = l.match(/^add (\{[wubrgc]\}) for each (.+)$/))) r = {each:{col:r21syms(m[1])[0], ph:'each ' + m[2]}};
  else if ((m = l.match(/^add an amount of (\{[wubrgc]\}) equal to (.+)$/)) && !/sacrificed|exiled|removed/.test(m[2])) r = {each:{col:r21syms(m[1])[0], ph:m[2]}};
  else if ((m = l.match(/^add x mana of any one colou?r, where x is (.+)$/)) && !/exiled|sacrificed|removed/.test(m[1])) r = {combo:{ph:m[1], cols:R21_COLS, mono:true}};
  else if ((m = l.match(/^add x mana in any combination of colou?rs, where x is (.+)$/))) r = {combo:{ph:m[1], cols:R21_COLS}};
  else if ((m = l.match(/^add x mana in any combination of ((?:\{[wubrgc]\}(?:,? and\/or |, )?)+), where x is (.+)$/))) r = {combo:{ph:m[2], cols:r21syms(m[1])}};
  else if ((m = l.match(/^add x (\{[wubrgc]\}) or x (\{[wubrgc]\}), where x is (.+)$/))) r = {xor:{cols:[r21syms(m[1])[0], r21syms(m[2])[0]], ph:m[3]}};
  else if ((m = l.match(/^choose a colou?r\. add an amount of mana of that colou?r equal to your devotion to that colou?r$/)) || (m = l.match(/^add an amount of mana of that colou?r equal to your devotion to that colou?r$/))) r = {devo:true};
  else if ((m = l.match(/^(?:choose a colou?r\. )?add an amount of mana of that colou?r equal to (.+)$/))) r = {pick:{ph:m[1]}};
  else if ((m = l.match(/^(?:choose a colou?r\. )?add one mana of that colou?r for each (.+)$/))) r = {pick:{ph:'each ' + m[1]}};
  R21_SPEC.set(key, r); return r;
}
// turn a spec into concrete outs for this permanent right now
function r21origEff(ab){ const m = String(ab.line || '').match(/^[^:"]+:\s*(?:choose a colou?r\.\s*)?(add .+?)(?:\.\s+|\.?\s*(?:\(.*\))?$)/i); return m ? m[1] : ab.eff; }
function r21cond(t, c){
  const l = t.toLowerCase().trim(); let m;
  if ((m = l.match(/^~ has an? (luck|\+1\/\+1|charge|oil) counter on it$/))) return m[1] === '+1/+1' ? (c.cp || 0) > 0 : ((c.nc || {})[m[1]] || 0) > 0;
  if ((m = l.match(/^you control a creature with power (\d+) or greater$/))) return S.bf.some(b => !b.fd && isCreatureCard(b) && stats(b)[0] >= +m[1]);
  if ((m = l.match(/^you control (two|three|four|five|six|seven) or more (.+?)$/))){ const n = r21count(m[2] + ' you control', c); return n != null && n >= R21_W[m[1]]; }
  if (/^a card is exiled with ~$/.test(l)) return !!(c.imp || (c.exw && c.exw.length));
  if (/^you played a land this turn$/.test(l)) return !!(S.landT && S.landT[0] === turnStr() && S.landT[1] > 0);
  if (/^you have the initiative$/.test(l)) return holderOf('ini') === MYPID;
  if (/^you're the monarch$/.test(l)) return holderOf('mon') === MYPID;
  return null;
}
function r21apply(ab, c){
  let eff = r21origEff(ab); let rest = ab.rest || '';
  // “If <condition>, add … instead.” / “If <condition>, instead add …”
  const ins = rest.match(/^if ([^,]+), (?:instead (add [^.]+)|(add [^.]+?) instead)\.?(?:\s+(.+))?$/i);
  let inst = null;
  if (ins){ const ok = r21cond(ins[1], c); if (ok == null) return ab; rest = ins[4] || ''; if (ok) inst = ins[2] || ins[3]; }
  if (inst && /^add (two|three) mana of that type$/i.test(inst)){ const k = R21_W[inst.split(' ')[1].toLowerCase()]; const base = r21apply({...ab, rest, line:'{T}: ' + eff + '.'}, c); return {...base, rest, outs:(base.outs || []).map(o => o.flatMap(x => Array(k).fill(x))), r21:base.r21 || {}}; }
  if (inst) eff = inst;
  const sp0 = r21spec(eff);
  const fx = !sp0 && /^add ((?:\{[wubrgc]\})+(?:(?:,? or |, )(?:\{[wubrgc]\})+)*)$/i.test(eff.replace(/\.$/, '')) ? {fixed:eff.replace(/\.$/, '').replace(/^add /i, '').split(/,? or |, /).map(r21syms)} : null;
  const anyc = !sp0 && !fx && /^add one mana of any colou?r$/i.test(eff.replace(/\.$/, '')) ? {fixed:R21_COLS.map(x => [x])} : null;
  const sp = sp0 || (ins ? (fx || anyc) : null);
  if (!sp){ return ins ? {...ab, rest} : ab; }
  const o = {...ab, eff, rest, r21:sp};
  if (sp.sacmv || sp.removed || sp.sacland){ o.outs = []; o.r21late = sp; return o; }
  if (sp.fixed) o.outs = sp.fixed;
  else if (sp.combo){
    const n = sp.combo.ph != null ? r21count(sp.combo.ph, c) : sp.combo.n; if (n == null) return ab;
    const cols = sp.combo.cols;
    if (n === 0) o.outs = [[]];
    else if (cols.length === 1) o.outs = [Array(n).fill(cols[0])];
    else if (sp.combo.mono || n === 1) o.outs = cols.map(x => Array(n).fill(x));
    else { o.outs = []; o.r21combo = {n, cols, distinct:!!sp.combo.distinct}; }
  }
  else if (sp.chosen){ const col = c && c.col && R21_COLS.includes(c.col) ? c.col : null; const base = col ? [Array(sp.chosen).fill(col)] : R21_COLS.map(x => Array(sp.chosen).fill(x)); o.outs = (sp.alt ? [sp.alt] : []).concat(base); }
  else if (sp.cp){
    const set = new Set();
    if (sp.cp === 'opp'){ for (const st of OPP.values()) (st.bf || []).forEach(b => { if (b.k && isLand(b.k)) r21couldProduce({k:b.k, fl:b.fl}).forEach(x => set.add(x)); }); }
    else S.bf.forEach(b => { if (b === c || b.fd || !isLand(b.k)) return; if (sp.cp === 'basic' && !/\bBasic\b/.test(info(b.k)?.t || '')) return; if (sp.cp === 'gate' && !descOk(b.k, 'gate', {tok:b.tok})) return; r21couldProduce(b).forEach(x => set.add(x)); });
    if (!sp.type) set.delete('C');
    o.outs = MANA.filter(x => set.has(x)).map(x => [x]); if (!o.outs.length) o.outs = [[]]; o.r21cp = true;
  }
  else if (sp.legend){
    const set = new Set();
    if (sp.legend === 'gy') S.gy.forEach(g => { const a = info(g.k); if (a && /Legendary/.test(a.t) && /Creature/.test(a.t)) (a.c || '').split('').forEach(x => set.add(x)); });
    else S.bf.forEach(b => { if (b.fd) return; const t = typeOf(b); if (!/Legendary/.test(t)) return; if (sp.legend === 'crpw' && !/Creature|Planeswalker/.test(t)) return; (info(b.k)?.c || '').split('').forEach(x => set.add(x)); });
    o.outs = R21_COLS.filter(x => set.has(x)).map(x => [x]); if (!o.outs.length) o.outs = [[]];
  }
  else if (sp.each){ const n = r21count(sp.each.ph, c); if (n == null) return ab; o.outs = [Array(n).fill(sp.each.col)]; }
  else if (sp.xor){ const n = r21count(sp.xor.ph, c); if (n == null) return ab; o.outs = sp.xor.cols.map(x => Array(n).fill(x)); }
  else if (sp.devo){ o.outs = R21_COLS.map(x => Array(r21devotion(x)).fill(x)).filter(x => x.length); if (!o.outs.length) o.outs = [[]]; o.r21pick = true; }
  else if (sp.pick){ const keep = c.r21col; o.outs = R21_COLS.map(x => { c.r21col = x; const n = r21count(sp.pick.ph, c); return Array(n || 0).fill(x); }).filter(x => x.length); c.r21col = keep; if (!o.outs.length) o.outs = [[]]; o.r21pick = true; }
  return o;
}
{
  const ma = manaAbs;
  manaAbs = function(c){
    let out = ma(c); if (!c) return out;
    const f = faceOf(c);
    // “{2}, {T}: Choose a color. Add …” (Nykthos, Nyx Lotus, Three Tree City, Astral Cornucopia)
    if (f && !c.fd && /choose a colou?r\. add/i.test(f.o || '')){
      const extra = [];
      for (const line of tname(f.o, f.n).split('\n')){ const m = line.trim().match(/^([^:"]+):\s*(choose a colou?r\. add .+)$/i); if (!m || out.some(o => o.line === line.trim())) continue; const parts = m[2].replace(/^choose a colou?r\.\s*/i, '').split(/\.\s+/); extra.push({cost:m[1].trim(), eff:parts[0].replace(/\.$/, ''), rest:parts.slice(1).join('. '), outs:[], tapOnly:/^\{t\}$/i.test(m[1].trim()), line:line.trim()}); }
      if (extra.length) out = out.concat(extra);
    }
    if (!S || !out.length) return out;
    return out.filter(ab => !/from your hand/i.test(ab.cost || '')).map(ab => { if (!ab || !ab.eff || ab.r21) return ab; let a = ab; const st = String(a.cost).match(/^(\d+)\+ \| (.+)$/); if (st) a = {...a, cost:st[2], minCh:+st[1], tapOnly:/^\{t\}$/i.test(st[2])}; return r21apply(a, c); });
  };
}

/* ---------- Tapping for mana: choices only when a colour must be chosen; multipliers and “add an additional” triggers ---------- */
let R21TAP = null; let R21LASTADD = []; let R21REC = null;
{ const ra = recAct; recAct = function(a){ if (a && a.t === 'mana' && R21REC){ a = {...a, ai:R21REC.ai, ch:R21REC.ch}; R21REC = null; } return ra(a); }; }
async function r21askCombo(c, cb){
  const {n, cols, distinct} = cb; const nm = cname(c);
  if (!distinct && cols.length > 1){
    const opts = cols.map(x => ({label:`${n} ${MNAME[x]}`, html:manaHTML(`{${x}}`.repeat(Math.min(n, 6))) + (n > 6 ? ` ×${n}` : ''), value:'all:' + x}));
    opts.push({label:'Mix colors (choose each one)', value:'mix'});
    const v = await askChoice({title:`${nm}: add ${n} mana — which color?`, options:opts}); if (v == null) return null;
    if (v !== 'mix') return Array(n).fill(v.slice(4));
  }
  const got = [];
  for (let i = 0; i < n; i++){
    const left = distinct ? cols.filter(x => !got.includes(x)) : cols;
    if (left.length === 1){ got.push(left[0]); continue; }
    const v = await askChoice({title:`${nm}: mana ${i + 1} of ${n}${got.length ? ' (so far ' + got.map(x => '{' + x + '}').join('') + ')' : ''}`, options:left.map(x => ({label:MNAME[x], html:manaHTML('{' + x + '}'), value:x}))});
    if (v == null) return null; got.push(v);
  }
  return got;
}
function r21textOf(b){ const f = faceOf(b); return f ? tname(f.o, f.n) : ''; }
function r21mult(c){
  let m = 1;
  for (const b of S.bf){ if (b.fd) continue; const o = r21textOf(b); const r = o.match(/^if you tap an? (permanent|land|basic land|creature|artifact) for mana, it produces (twice|three times) as much of that mana instead\.?$/im);
    if (!r) continue; const ty = r[1]; if (ty === 'land' && !isLand(c.k)) continue; if (ty === 'basic land' && !(isLand(c.k) && /\bBasic\b/.test(info(c.k)?.t || ''))) continue; if (ty === 'creature' && !isCreatureCard(c)) continue; if (ty === 'artifact' && !/Artifact/.test(typeOf(c))) continue;
    m *= r[2] === 'twice' ? 2 : 3; }
  return m;
}
{
  const ad = addMana;
  addMana = function(outs){
    if (!S) return ad(outs);
    r21settle(null);
    let list = outs;
    if (R21TAP && outs === R21TAP.outs && !R21TAP.produced){
      const k = /\{T\}/i.test(R21TAP.ab.cost || '') ? r21mult(R21TAP.c) : 1;
      list = []; for (let i = 0; i < k; i++) list.push(...outs);
      R21TAP.produced = list; R21TAP.k = k;
    }
    const r = ad(list);
    R21LASTADD = list.slice(); r21snap();
    return r;
  };
  const am = activateMana;
  activateMana = async function(c, ab, ch){
    if (!c || !ab || !S) return am(c, ab, ch);
    if (ab.minCh && ((c.nc || {}).charge || 0) < ab.minCh){ toast(`${cname(c)} needs ${ab.minCh} charge counters for that (has ${(c.nc || {}).charge || 0})`); return; }
    if (ab.r21late) return r21lateMana(c, ab);
    let outs;
    if (ab.r21combo && !(ab.outs || []).length){ const why = abilityReady(c, ab, true); if (why){ toast(why); return; } outs = await r21askCombo(c, ab.r21combo); if (!outs) return; }
    else outs = (ab.outs || [])[ch] || (ab.outs || [])[0];
    if (!outs) return am(c, ab, ch);
    const ab2 = {...ab, outs:[outs]};
    const tap = R21TAP = {c, ab:ab2, outs, produced:null};
    R21REC = {ai:manaAbs(c).findIndex(x => x.line === ab.line && x.cost === ab.cost), ch};
    try { await am(c, ab2, 0); } finally { if (R21TAP === tap) R21TAP = null; R21REC = null; }
    const got = tap.produced; if (!got) return;
    const extra = []; const add = (cols, why) => { if (!cols.length) return; extra.push(...cols); addMana(cols); log(`${why}: +${cols.map(x => '{' + x + '}').join('')}`); };
    if (tap.k > 1) log(`${cname(c)} produced ${tap.k} times as much (${got.map(x => '{' + x + '}').join('')})`);
    const tapped = /\{T\}/i.test(ab.cost || '');
    const types = [...new Set(got)];
    for (const b of S.bf){
      if (b.fd) continue; const o = r21textOf(b); let m;
      if (isLand(c.k) && b.col && /^whenever a land's ability causes you to add one or more mana of the chosen colou?r, add an additional one mana of that colou?r\.?$/im.test(o) && got.includes(b.col)) add([b.col], cname(b));
      if (isLand(c.k) && b.col && /^whenever a basic land is tapped for mana of the chosen colou?r, its controller adds an additional one mana of that colou?r\.?$/im.test(o) && tapped && /\bBasic\b/.test(info(c.k)?.t || '') && got.includes(b.col)) add([b.col], cname(b));
      if (!isLand(c.k) && tapped && types.length && /^whenever you tap a nonland permanent for mana, add one mana of any type that permanent produced\.?$/im.test(o)){
        const v = types.length === 1 ? types[0] : await askChoice({title:`${cname(b)}: add one mana of which type?`, options:types.map(x => ({label:MNAME[x], html:manaHTML('{' + x + '}'), value:x}))});
        if (v) add([v], cname(b));
      }
      if (tapped && (m = o.match(/^whenever you tap an? (creature|artifact|nonland permanent|land|permanent) for mana, add an additional (\{[wubrgc]\})\.?$/im))){
        const ok = m[1] === 'creature' ? isCreatureCard(c) : m[1] === 'artifact' ? /Artifact/.test(typeOf(c)) : m[1] === 'land' ? isLand(c.k) : m[1] === 'nonland permanent' ? !isLand(c.k) : true;
        if (ok) add(r21syms(m[2]), cname(b));
      }
    }
    R21LASTADD = got.slice();
    commit();
  };
  // one click: tap options include abilities with other costs ({T}, sacrifice ~ / pay life / mill …) and “any combination”
  quickTap = function(id){
    const [z,,c] = find(id); if (z !== 'bf') return;
    const n = c.n || 1; const all = n > 1 ? (c.tn || 0) >= n : c.tap;
    if (isPW(c) && !c.fd){ openModal({type:'pw', id:c.id, key:rid(4)}); return; }
    if (all || c.fd){ tapToggle(id); return; }
    const opts = []; const abs = manaAbs(c);
    const pass = ab => /\{T\}/i.test(ab.cost) && (ab.tapOnly || abilityReady(c, ab, true) === '');
    abs.forEach((ab, ai) => { if (!pass(ab)) return;
      if (ab.r21late) opts.push({ab, ai, ci:0, label:`Add mana (${ab.cost})`});
      else if (ab.r21combo && !(ab.outs || []).length) opts.push({ab, ai, ci:0, label:`Add ${ab.r21combo.n} mana (${ab.r21combo.distinct ? 'different colors' : 'any combination'})`});
      else (ab.outs || []).forEach((o, ci) => opts.push({ab, ai, ci, outs:o})); });
    if (opts.length === 1){ activateMana(c, opts[0].ab, opts[0].ci); return; }
    if (opts.length > 1){
      const el = document.querySelector(`.card[data-id="${id}"]`); const r = el ? el.getBoundingClientRect() : {right:200, top:200};
      openMenuAt(`<div class="mh">${esc(cname(c))}: add mana</div>` + opts.map(o => mb('manaGo', o.label ? esc(o.label) : `Add ${o.outs.length ? manaHTML(o.outs.map(x => '{' + x + '}').join('')) : 'no mana'}${o.ab.tapOnly ? '' : ` <small class="why">${esc(o.ab.cost)}</small>`}`, `data-id="${id}" data-ab="${o.ai}" data-ch="${o.ci}"`)).join('') + `<div class="sep"></div>` + mb('tap', 'Tap without mana', `data-id="${id}"`), r.right + 6, r.top);
      return;
    }
    tapToggle(id);
  };
}

// mana that depends on what was paid (sacrificed creature's mana value, counters removed, the sacrificed land)
let R21PAID = null;
async function r21lateMana(c, ab){
  const sp = ab.r21late; const nm = cname(c);
  recAct({t:'mana', id:c.id, k:c.k, ai:manaAbs(c).findIndex(x => x.line === ab.line), ch:0});
  R21PAID = {sac:null, ex:null, removed:0};
  if (!(await payAbilityCost(c, ab.cost, {mana:true}))){ R21PAID = null; commit(); return; }
  const paid = R21PAID; R21PAID = null; let outs = [];
  if (sp.sacmv){ const k = (paid.sac || paid.ex || {}).k; const n = (k ? (info(k)?.mv || 0) : 0) + sp.sacmv.plus;
    let col = sp.sacmv.col; if (!col && n){ col = await askChoice({title:`${nm}: add ${n} mana of which color?`, options:R21_COLS.map(x => ({label:MNAME[x], html:manaHTML(`{${x}}`.repeat(Math.min(n, 6))), value:x}))}); }
    outs = col ? Array(n).fill(col) : []; }
  else if (sp.removed){ const n = paid.removed || 0; if (sp.removed.col) outs = Array(n).fill(sp.removed.col); else if (n){ outs = await r21askCombo(c, {n, cols:R21_COLS}) || []; } }
  else if (sp.sacland){ const k = (paid.sac || {}).k; const set = k ? r21couldProduce({k}) : new Set(); const opts = MANA.filter(x => set.has(x));
    const v = opts.length > 1 ? await askChoice({title:`${nm}: add one mana of which type?`, options:opts.map(x => ({label:MNAME[x], html:manaHTML('{' + x + '}'), value:x}))}) : opts[0]; if (v) outs = [v]; }
  const tap = R21TAP = {c, ab, outs, produced:null};
  try { addMana(outs); } finally { if (R21TAP === tap) R21TAP = null; }
  log(`${nm}: added ${(tap.produced || outs).map(x => '{' + x + '}').join('') || 'no mana'}`);
  if (ab.rest) await runEffects(ab.rest, {k:c.k, name:nm, srcId:c.id});
  commit();
}
{
  const so = sacrificeOne; sacrificeOne = function(c){ if (R21PAID && c) R21PAID.sac = {k:c.k, id:c.id}; return so(c); };
}

/* ---------- Restricted mana: “Spend this mana only to …” is tracked and enforced ---------- */
// S.r21rm = [{col, n, cast:[desc…]|null, castAny:bool, ab:true|desc|null, src}]  — always capped by what is really in the pool
let R21CTX = null; let R21SNAP = null;
function r21snap(){ if (S) R21SNAP = {...S.pool}; }
function r21usable(e, ctx){
  if (e.nogen) return false;
  if (e.free) return true;
  if (!ctx) return false;
  if (e.faceup) return !!ctx.faceup;
  if (ctx.ab && e.ab === 'xcost') return /\{X\}/i.test(ctx.cost || '');
  if (ctx.spell != null){ if (e.castAny) return true; return (e.cast || []).some(d => r21castOk(ctx.spell, d, e)); }
  if (ctx.ab){ if (e.ab === true) return true; if (typeof e.ab === 'string') return descOk(ctx.ab.k, e.ab, {tok:ctx.ab.tok}); return false; }
  return false;
}
function r21castOk(k, d, e){
  const a = info(k); if (!a) return false; let m0;
  if (d === 'colorless') return !(a.c || '').replace(/[^WUBRG]/g, '');
  if (d === 'monocolored of that color') return (a.c || '').replace(/[^WUBRG]/g, '') === e.col;
  if (d === 'commander') return (S.deck?.cmd || []).includes(k);
  if (d === 'any') return true;
  if (d === 'xcost') return /\{X\}/.test(a.m || '');
  if (d === 'from exile') return R21CTX && R21CTX.zone === 'ex';
  if (d === 'shares a creature type with your commander'){ const sub = kk => new Set(((info(kk)?.t || '').split('—')[1] || '').trim().toLowerCase().split(/\s+/).filter(Boolean)); const mine = sub(k); return /Creature/.test(a.t || '') && (S.deck?.cmd || []).some(ck => [...sub(ck)].some(x => mine.has(x))); }
  if ((m0 = d.match(/^kw:(\w+)$/))) return new RegExp('\\b' + m0[1] + '\\b', 'i').test(a.o || '') || (a.kw || []).some(x => x.toLowerCase() === m0[1]);
  if ((m0 = d.match(/^mv(\d+)\|(.*)$/))) return ((a.mv || 0) >= +m0[1] || /\{X\}/.test(a.m || '')) && (!m0[2] || descOk(k, m0[2]));
  if (d === 'chosen type') return !!(e.ctype && new RegExp('\\b' + e.ctype + '\\b', 'i').test(a.t || ''));
  let m;
  if ((m = d.match(/^(.+?) of the chosen type$/))) return descOk(k, m[1]) && !!(e.ctype && new RegExp('\\b' + e.ctype + '\\b', 'i').test(a.t || ''));
  if ((m = d.match(/^mv(\d+)$/))) return (a.mv || 0) >= +m[1] || /\{X\}/.test(a.m || '');
  return descOk(k, d);
}
function r21settle(ctx){
  if (!S || !S.r21rm || !S.r21rm.length){ r21snap(); return; }
  const prev = R21SNAP || S.pool; const fired = [];
  const take = (e, spent) => { const d = Math.min(spent, e.n); e.n -= d; if (d && e.rider && ctx && ctx.spell != null && !e.fired && r21castOk(ctx.spell, e.rider.desc, e)){ e.fired = true; fired.push(e); } return spent - d; };
  for (const col of MANA){
    let spent = Math.max(0, (prev[col] || 0) - (S.pool[col] || 0));
    const es = S.r21rm.filter(e => e.col === col);
    if (spent && ctx){
      for (const e of es) if (spent && !e.free && r21usable(e, ctx)) spent = take(e, spent);
      for (const e of es) if (spent && e.free && e.rider && ctx.spell != null && r21castOk(ctx.spell, e.rider.desc, e)) spent = take(e, spent);
    }
    if (spent){ const plain = Math.max(0, (prev[col] || 0) - es.reduce((a, e) => a + e.n, 0)); spent -= Math.min(spent, plain); }
    for (const e of es) if (spent && e.free) spent = take(e, spent);
    let over = es.reduce((a, e) => a + e.n, 0) - (S.pool[col] || 0);
    for (const e of es){ if (over <= 0) break; const d = Math.min(over, e.n); e.n -= d; over -= d; }
  }
  S.r21rm = S.r21rm.filter(e => e.n > 0); r21snap();
  const seen = new Set(); for (const e of fired){ const key = e.grp || e; if (seen.has(key)) continue; seen.add(key); r21fire(e, ctx); }
}
function r21fire(e, ctx){
  const k = ctx.spell; const it = [...S.stk].reverse().find(x => x.kind === 'spell' && x.k === k); const r = e.rider; const nm = info(k)?.n || 'that spell';
  if (r.uc && it){ it.uc = true; log(`${nm} can't be countered (${e.src})`); }
  if (r.haste || r.cp || r.cpTax){ S.r21pend = (S.r21pend || []).concat({k, haste:!!r.haste, cp:(r.cp || 0) + (r.cpTax ? (S.tax[k] || 0) : 0), t:turnStr(), src:e.src}); }
  if (r.life){ gainLife(r.life); }
  if (r.copy && it) runEffects('Copy that spell.', {k:null, name:e.src, it:{kind:'trigger', evk:k}});
  const sc = (r.scry || 0) + (r.scryTax ? (S.tax[k] || 0) : 0);
  if (sc) runEffects(`Scry ${sc}.`, {k:null, name:e.src});
  commit();
}
function r21parseOnly(t, c){
  // t: lowercased text after “spend this mana only to ”
  const e = {cast:[], castAny:false, ab:null};
  const parts = t.replace(/\.$/, '').split(/,? or (?=(?:to )?(?:cast|activate)\b)|, (?=(?:cast|activate)\b)/);
  for (let p of parts){
    p = p.replace(/^to /, '').trim(); let m;
    if (/^activate (?:abilities|an ability)$/.test(p)){ e.ab = true; continue; }
    if ((m = p.match(/^activate (?:an ability|abilities) of (?:an? )?(.+?)(?: sources?)?$/))){ e.ab = m[1].replace(/s$/, '').replace(/^(.+?) source$/, '$1'); if (/chosen type/.test(e.ab)) e.ab = c && c.ctype ? c.ctype : 'creature'; continue; }
    if (/^activate an equip ability$/.test(p)){ e.ab = 'equipment'; continue; }
    if ((m = p.match(/^cast (?:a |an )?(.+?) spells? of the chosen type$/))){ e.cast.push(m[1] + ' of the chosen type'); continue; }
    if (/^cast (?:a )?spells? of the chosen type$/.test(p)){ e.cast.push('chosen type'); continue; }
    if (/^activate an ability of an? (?:creature )?source of the chosen type$/.test(p)){ e.ab = c && c.ctype ? c.ctype : 'creature'; continue; }
    if ((m = p.match(/^cast (?:a |an )?(.*?)\s*spells? with mana value (\d+) or greater(?: or (?:a |an )?(.*?)\s*spells? with \{x\} in (?:their|its) mana costs?)?$/))){ e.cast.push('mv' + m[2] + '|' + m[1]); continue; }
    if ((m = p.match(/^cast (?:a |an )?(.+?) spell or a spell that has (\w+)$/))){ e.cast.push(m[1], 'kw:' + m[2]); continue; }
    if ((m = p.match(/^cast (?:a )?spells? with (\w+)$/))){ e.cast.push('kw:' + m[1]); continue; }
    if (/^cast spells from exile$/.test(p)){ e.cast.push('from exile'); continue; }
    if ((m = p.match(/^cast (?:a |an )?(.+?) spells?$/))){
      let d = m[1];
      if (/^spells? with mana value (\d+) or greater or spells? with \{x\} in their mana costs$/.test(p.replace(/^cast /, ''))){ e.cast.push('mv' + p.match(/(\d+)/)[1]); continue; }
      d = d.replace(/ and\/or /g, ' or ').replace(/, (?!or )/g, ' or ').replace(/\binstant and sorcery\b/, 'instant or sorcery');
      if (/^creature spell of the chosen type$|^creature of the chosen type$/.test(d)){ e.cast.push('creature of the chosen type'); continue; }
      if (/^(?:a )?spell of the chosen type$|^of the chosen type$/.test(d)){ e.cast.push('chosen type'); continue; }
      if (d === 'colorless') { e.cast.push('colorless'); continue; }
      if (/^monocolored$/.test(d) && /of that colou?r/.test(t)){ e.cast.push('monocolored of that color'); continue; }
      e.cast.push(d.replace(/s$/, '')); continue;
    }
    if ((m = p.match(/^cast monocolored spells of that colou?r$/))){ e.cast.push('monocolored of that color'); continue; }
    if ((m = p.match(/^cast (?:a |an )?(.+?) spells? or activate abilities of (.+?)s?$/))){ e.cast.push(m[1]); e.ab = m[2]; continue; }
    return null;
  }
  return e;
}
{
  const pp = payPlan;
  payPlan = function(cost, pool){
    if (!S || !S.r21rm || !S.r21rm.length || pool !== S.pool) return pp(cost, pool);
    const blocked = {}; for (const e of S.r21rm) if (!r21usable(e, R21CTX)) blocked[e.col] = (blocked[e.col] || 0) + e.n;
    const p2 = {...pool}; for (const [k, v] of Object.entries(blocked)) p2[k] = Math.max(0, (p2[k] || 0) - v);
    const ng = {}; for (const e of S.r21rm) if (e.nogen) ng[e.col] = (ng[e.col] || 0) + e.n;
    let cost2 = cost; const usedNg = {};
    if (Object.keys(ng).length && cost && cost.col){ cost2 = {...cost, col:{...cost.col}}; for (const [k, v] of Object.entries(ng)){ const u = Math.min(v, cost2.col[k] || 0, pool[k] || 0); if (u){ cost2.col[k] -= u; usedNg[k] = u; } } for (const [k, u] of Object.entries(usedNg)) blocked[k] = Math.max(0, (blocked[k] || 0) - u); }
    for (const [k, u] of Object.entries(usedNg)) p2[k] = Math.max(0, (p2[k] || 0) - u);
    const r = pp(cost2, p2); if (r && r.pool) for (const [k, v] of Object.entries(blocked)) r.pool[k] = (r.pool[k] || 0) + Math.min(v, pool[k] || 0);
    if (r && r.err && Object.keys(blocked).length) r.err += ' (some of your mana is restricted)';
    return r;
  };
  const withCtx = (ctx, fn) => { const keep = R21CTX; R21CTX = ctx; try { return fn(); } finally { R21CTX = keep; } };
  const cc = castCheck; castCheck = function(c, zone){ return c ? withCtx({spell:c.k, zone}, () => cc(c, zone)) : cc(c, zone); };
  const ar = abilityReady; abilityReady = function(c, ab, mana){ return c ? withCtx({ab:c, cost:ab && ab.cost}, () => ar(c, ab, mana)) : ar(c, ab, mana); };
  const tf = turnFaceUp; turnFaceUp = function(c){ if (!S) return tf(c); r21settle(null); const keep = R21CTX; const ctx = {faceup:true}; R21CTX = ctx; try { return tf(c); } finally { r21settle(ctx); R21CTX = keep; } };
  const bc = beginCast;
  beginCast = async function(c, zone, o){ if (!c || !S) return bc(c, zone, o); r21settle(null); const keep = R21CTX; const ctx = {spell:c.k, zone}; R21CTX = ctx;
    try { return await bc(c, zone, o); } finally { R21CTX = ctx; r21settle(ctx); R21CTX = keep;
      try { const cast = S.stk.some(x => x.kind === 'spell' && x.card === c); if (cast && S.r21next && S.r21next.length){ const i = S.r21next.findIndex(n => n.t === turnStr() && descOk(c.k, n.desc)); if (i >= 0){ const n = S.r21next.splice(i, 1)[0]; S.r21pend = (S.r21pend || []).concat({k:c.k, cp:n.cp, t:turnStr(), src:n.src}); commit(); } } } catch {} } };
  const pac = payAbilityCost;
  payAbilityCost = async function(c, cost, o){ if (!c || !S) return pac(c, cost, o);
    const em = String(cost).match(/(?:^|,\s*)pay ((?:\{e\})+)(?=,|$)/i); let e = 0;
    if (em){ e = em[1].length / 3; if (((S.pc || {}).energy || 0) < e){ toast(`You need ${e} energy`); return false; } cost = String(cost).replace(em[0], '').replace(/^,\s*/, '') || '{0}'; }
    const ok = await r21pac(c, cost, o); if (ok && e) addPC('energy', -e); return ok; };
  const r21pac = async function(c, cost, o){ r21settle(null); const keep = R21CTX; const ctx = {ab:c, cost}; R21CTX = ctx; try { return await pac(c, cost, o); } finally { R21CTX = ctx; r21settle(ctx); R21CTX = keep; } };
}

function r21rider(t){
  const l = t.toLowerCase().trim(); let m;
  if (/^(?:that spell|it) can't be countered$/.test(l)) return {uc:true};
  if (/^it gains haste(?: until end of turn)?$/.test(l)) return {haste:true};
  if (/^that creature enters with an additional \+1\/\+1 counter on it$/.test(l)) return {cp:1};
  if (/^that creature enters with two additional \+1\/\+1 counters on it$/.test(l)) return {cp:2};
  if (/^it enters with an additional \+1\/\+1 counter on it and gains haste until end of turn$/.test(l)) return {cp:1, haste:true};
  if (/^it enters with a number of additional \+1\/\+1 counters on it equal to the number of times it's been cast from the command zone this game$/.test(l)) return {cpTax:true};
  if ((m = l.match(/^you gain (\d+) life$/))) return {life:+m[1]};
  if (/^copy that spell(?: or ability)? and you may choose new targets for the copy$/.test(l)) return {copy:true};
  if ((m = l.match(/^scry (\d+)$/))) return {scry:+m[1]};
  if (/^scry x, where x is the number of times it's been cast from the command zone this game$/.test(l)) return {scryTax:true};
  return null;
}
function r21addEntries(got, e, ctx){
  S.r21rm = S.r21rm || []; r21settle(null); const grp = rid(4); const c = srcCardOf(ctx);
  const by = {}; got.forEach(x => { by[x] = (by[x] || 0) + 1; });
  for (const [col, n] of Object.entries(by)) S.r21rm.push({col, n, cast:e.cast || null, castAny:!!e.castAny, ab:e.ab || null, free:!!e.free, nogen:!!e.nogen, faceup:!!e.faceup, rider:e.rider || null, grp, ctype:c && c.ctype || null, src:ctx.name});
  commit();
}
/* ---------- Effect text ---------- */
async function doRound21CPre(s, l, ctx){
  let m; const src = () => srcCardOf(ctx);
  // “If that mana is spent on …” / “When you spend this mana to cast …”: riders on the mana just added
  if ((m = l.match(/^if (?:any of )?(?:that|this) mana is spent (?:on|to cast) (?:an? )?(.+?)(?: spell)?, (.+)$/)) || (m = l.match(/^when (?:that mana is spent|you spend this mana) to cast (?:an? )?(.+?)(?: spell)?, (.+)$/)) || (m = l.match(/^if you spend this mana to cast (?:an? )?(.+?)(?: spell)?, (.+)$/))){
    const got = R21LASTADD.slice(); if (!got.length) return true;
    const rider = r21rider(m[2]); if (!rider) return false;
    let desc = m[1].replace(/ spell$/, '').replace(/^creature spell that shares a creature type with your commander$/, 'shares a creature type with your commander').replace(/^your commander$/, 'commander');
    if (/that shares a creature type with your commander/.test(m[1])) desc = 'shares a creature type with your commander';
    rider.desc = desc;
    r21addEntries(got, {free:true, rider}, ctx); return true;
  }
  if ((m = l.match(/^when you next cast an? (.+?) spell this turn, that (?:creature|spell) enters with (an|two|three) additional \+1\/\+1 counters? on it$/))){
    S.r21next = (S.r21next || []).concat({desc:m[1], cp:wn(m[2]) || 1, t:turnStr(), src:ctx.name}); log(`${ctx.name}: the next ${m[1]} spell you cast this turn enters with ${m[2]} additional +1/+1 counter${m[2] === 'an' ? '' : 's'}`); commit(); return true;
  }
  // restricted mana
  if ((m = l.match(/^spend this mana only on costs that contain \{x\}$/))){ const got = R21LASTADD.slice(); if (!got.length) return true; r21addEntries(got, {cast:['xcost'], ab:'xcost'}, ctx); log(`mana from ${ctx.name} can only be spent on costs with {X}`); return true; }
  if ((m = l.match(/^this mana can't be spent to pay generic mana costs$/))){ const got = R21LASTADD.slice(); if (!got.length) return true; r21addEntries(got, {free:true, nogen:true}, ctx); log(`mana from ${ctx.name} can't pay generic costs`); return true; }
  if ((m = l.match(/^spend this mana only to turn permanents face up$/))){ const got = R21LASTADD.slice(); if (!got.length) return true; r21addEntries(got, {faceup:true}, ctx); log(`mana from ${ctx.name} can only turn permanents face up`); return true; }
  if ((m = l.match(/^spend this mana only (?:to|on) (.+?), and that spell can't be countered$/))){
    const got = R21LASTADD.slice(); if (!got.length) return true; const e = r21parseOnly(m[1], src()); if (!e) return false;
    r21addEntries(got, {...e, rider:{uc:true, desc:'any'}}, ctx); log(`mana from ${ctx.name} can only be spent to ${m[1]}`); return true;
  }
  if ((m = l.match(/^spend this mana only (?:to|on) (.+)$/)) || (m = l.match(/^(this mana can't be spent to cast nonartifact spells)$/))){
    const got = R21LASTADD.slice(); if (!got.length) return true;   // nothing was added (X was 0): nothing to restrict
    const c = src();
    const e = /nonartifact/.test(m[1]) ? {cast:['artifact'], castAny:false, ab:true} : r21parseOnly(m[1], c);
    if (!e) return false;
    S.r21rm = S.r21rm || []; r21settle(null);
    const by = {}; got.forEach(x => { by[x] = (by[x] || 0) + 1; });
    for (const [col, n] of Object.entries(by)) S.r21rm.push({col, n, cast:e.cast, castAny:e.castAny, ab:e.ab, ctype:c && c.ctype || null, src:ctx.name});
    log(`${got.map(x => '{' + x + '}').join('')} from ${ctx.name} can only be spent ${m[1].replace(/^to /, 'to ')}`);
    commit(); return true;
  }
  if ((m = l.match(/^if there are no (\w+) counters on ~, sacrifice it$/))){ const c = src(); if (c && S.bf.includes(c) && !((c.nc || {})[m[1]] > 0)) sacrificeOne(c); commit(); return true; }
  if ((m = l.match(/^each opponent gains (\d+) life$/))){ opponents().forEach(p => sendRq(p.pid, 'life', +m[1], ctx.name)); log(`each opponent gains ${m[1]} life (${ctx.name})`); commit(); return true; }
  // Forsaken City
  if (/^(?:you may )?exile a card from your hand$/.test(l)){ if (!S.hand.length){ ctx.didPay = false; return true; } const ids = await pickCards({title:`${ctx.name}: exile a card from your hand?`, cards:S.hand, min:0, max:1, noneLabel:"Don't exile"}); const id = ids && ids[0]; if (id == null){ ctx.didPay = false; return true; } moveCard(id, 'ex'); ctx.didPay = true; commit(); return true; }
  if ((m = l.match(/^if you do, untap (?:~|this land|this artifact|it)$/))){ if (ctx.didPay === false) return true; const c = src(); if (c){ c.tap = false; c.tn = 0; log(`${ctx.name}: untapped`); commit(); } return true; }
  // Rite of Flame
  if ((m = l.match(/^add (\{[wubrgc]\}(?:\{[wubrgc]\})*), then add (\{[wubrgc]\}) for each card named (.+?) in each graveyard$/))){
    const nm = m[3].toLowerCase() === '~' ? ctx.name : m[3]; const isNm = k => (info(k)?.n || '').toLowerCase() === String(nm).toLowerCase();
    let n = S.gy.filter(g => isNm(g.k)).length; for (const st of OPP.values()) n += (st.gy || []).filter(g => isNm(typeof g === 'object' ? g.k : g)).length;
    const outs = r21syms(m[1]).concat(Array(n).fill(r21syms(m[2])[0])); addMana(outs); log(`added ${outs.map(x => '{' + x + '}').join('')}`); commit(); return true;
  }
  // Mana Echoes
  if ((m = l.match(/^(?:you may )?add an amount of \{c\} equal to the number of creatures you control that share a creature type with it$/))){
    const it = ctx.it && ctx.it.evId != null ? S.bf.find(b => b.id === ctx.it.evId) : null; if (!it) return true;
    const st = b => new Set(((info(b.k)?.t || '').split('—')[1] || '').trim().split(/\s+/).filter(Boolean).map(x => x.toLowerCase()));
    const mine = st(it); const ch = /changeling/i.test(info(it.k)?.o || '');
    const n = S.bf.filter(b => !b.fd && isCreatureCard(b) && (ch || /changeling/i.test(info(b.k)?.o || '') || [...st(b)].some(x => mine.has(x)))).length;
    if (n){ addMana(Array(n).fill('C')); log(`${ctx.name}: added ${n} {C}`); } commit(); return true;
  }
  // “Add X mana of any one color” / “in any combination of colors” as an effect (spells, triggers)
  if ((m = l.match(/^add (two|three|four|five|six|seven|eight|nine|ten|x|\d+) mana of any one colou?r$/))){
    const n = m[1] === 'x' ? ((ctx.it && ctx.it.x) || 0) : (R21_W[m[1]] ?? +m[1]); if (!n) return true;
    const v = await askChoice({title:`${ctx.name}: add ${n} mana of which color?`, options:R21_COLS.map(x => ({label:MNAME[x], html:manaHTML(`{${x}}`.repeat(Math.min(n, 6))), value:x}))}); if (!v) return true;
    addMana(Array(n).fill(v)); log(`added ${n} {${v}}`); commit(); return true;
  }
  if ((m = l.match(/^add (two|three|four|five|six|seven|eight|nine|ten|x|\d+) mana in any combination of colou?rs$/))){
    const n = m[1] === 'x' ? ((ctx.it && ctx.it.x) || 0) : (R21_W[m[1]] ?? +m[1]); if (!n) return true;
    const outs = await r21askCombo({k:ctx.k, n:ctx.name}, {n, cols:R21_COLS}); if (!outs) return true; addMana(outs); log(`added ${outs.map(x => '{' + x + '}').join('')}`); commit(); return true;
  }
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound21CPre(s, l, ctx)) return; return ds(s0, ctx); }; }

{
  const oe = onEnter;
  onEnter = function(c, from, o){ const r = oe(c, from, o); try { if (S && c && S.r21pend && S.r21pend.length){ const i = S.r21pend.findIndex(p => p.k === c.k && p.t === turnStr()); if (i >= 0){ const p = S.r21pend.splice(i, 1)[0]; if (p.haste) c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; if (p.cp) modCounters(c, 'cp', p.cp); log(`${cname(c)}: ${[p.haste ? 'haste' : '', p.cp ? '+' + p.cp + ' +1/+1 counter' + (p.cp > 1 ? 's' : '') : ''].filter(Boolean).join(', ')} (${p.src})`); commit(); } } } catch (e){ console.warn(e); } return r; };
}
/* ---------- Spirit guides: mana abilities that work from your hand ---------- */
function r21handAbs(c){ const f = c && info(c.k); if (!f) return []; const out = []; for (const line of tname(f.o, f.n).split('\n')){ const m = line.trim().match(/^exile ~ from your hand:\s*(add .+?)\.?$/i); if (m){ const outs = manaOuts(m[1]); if (outs.length) out.push({eff:m[1], outs}); } } return out; }
async function r21handMana(c, i = 0, ch = 0){
  const ab = r21handAbs(c)[i]; if (!ab || !S.hand.includes(c)) return;
  let outs = ab.outs[ch] || ab.outs[0];
  moveCard(c.id, 'ex'); addMana(outs); log(`exiled ${cname(c)} from their hand for ${outs.map(x => '{' + x + '}').join('')}`); commit();
}
{
  const cm = castMenuItems;
  castMenuItems = function(c, zone){ let h = cm(c, zone); if (zone === 'hand') r21handAbs(c).forEach((ab, i) => ab.outs.forEach((o, ch) => { h += mb('r21hm', `Exile from hand: add ${manaHTML(o.map(x => '{' + x + '}').join(''))}`, `data-id="${c.id}" data-i="${i}" data-ch="${ch}"`); })); return h; };
  Object.assign(ACT, { r21hm(el){ const [z,,c] = find(+el.dataset.id); closeMenu(); if (c && z === 'hand') r21handMana(c, +el.dataset.i, +el.dataset.ch); } });
}
/* ---------- Costs of mana abilities ---------- */
{
  const pp = payPart;
  payPart = async function(p, c){
    const l = p.toLowerCase().trim(); let m;
    if ((m = l.match(/^mill (a|one|two|three|\d+) cards?$/))){ const n = wn(m[1]) || 1; if (S.lib.length < 1){ toast('Your library is empty'); return false; } mill(n); return true; }
    if ((m = l.match(/^put an? (-0\/-1|-1\/-1|\+1\/\+1) counter on ~$/))){ if (m[1] === '-1/-1') modCounters(c, 'cm', 1); else if (m[1] === '+1/+1') modCounters(c, 'cp', 1); else addNamed(c, '-0/-1', 1); return true; }
    if ((m = l.match(/^remove (an?|one|two|three|four|five|\d+) (charge|storage|depletion|mining|luck|fuse|gem|oil|time|ki|quest|verse|stash|soul|level) counters? from ~$/))){ const n = wn(m[1]) || 1; const have = (c.nc || {})[m[2]] || 0; if (have < n){ toast(`${cname(c)} doesn't have ${n} ${m[2]} counter${n > 1 ? 's' : ''}`); return false; } addNamed(c, m[2], -n); return true; }
    if ((m = l.match(/^exile (an?|one|two|three|four|five|six|seven|\d+) cards? from your graveyard$/))){ const n = wn(m[1]) || 1; if (S.gy.length < n){ toast(`You need ${n} cards in your graveyard`); return false; } const ids = S.gy.length === n ? S.gy.map(g => g.id) : await pickCards({title:`${cname(c)}: exile ${n} card${n > 1 ? 's' : ''} from your graveyard`, cards:S.gy, min:n, max:n}); if (!ids || ids.length < n) return false; ids.forEach(id => moveCard(id, 'ex')); return true; }
    if ((m = l.match(/^remove (four|five|six|seven|eight|nine|ten) (\+1\/\+1|-1\/-1) counters? from ~$/))){ const n = wn(m[1]); const kind = m[2] === '+1/+1' ? 'cp' : 'cm'; if ((c[kind] || 0) < n){ toast(`${cname(c)} doesn't have ${n} ${m[2]} counters`); return false; } c[kind] -= n; return true; }
    if ((m = l.match(/^remove (?:any number of|x) (\w+) counters from ~$/))){ const have = (c.nc || {})[m[1]] || 0; let n = have; if (have > 1) n = await askChoice({title:`${cname(c)}: remove how many ${m[1]} counters?`, options:Array.from({length:have + 1}, (_, i) => ({label:String(have - i), value:have - i}))}); if (n == null) return false; addNamed(c, m[1], -n); if (R21PAID) R21PAID.removed = n; UI.lastX = n; return true; }
    if ((m = l.match(/^exile an? (.+?) you control$/))){ const list = S.bf.filter(b => !b.fd && b.id !== c.id && descOk(b.k, m[1], {tok:b.tok})); if (!list.length){ toast(`You need a ${m[1]} to exile`); return false; } const ids = list.length === 1 ? [list[0].id] : await pickCards({title:`${cname(c)}: exile a ${m[1]} you control`, cards:list, min:1, max:1}); const b = ids && list.find(x => x.id === ids[0]); if (!b) return false; if (R21PAID) R21PAID.ex = {k:b.k, id:b.id}; moveCard(b.id, 'ex'); return true; }
    if (/^forage$/.test(l)){ const food = S.bf.filter(b => !b.fd && descOk(b.k, 'food', {tok:b.tok})); if (S.gy.length < 3 && !food.length){ toast('Forage: you need three cards in your graveyard or a Food'); return false; }
      const how = S.gy.length >= 3 && food.length ? await askChoice({title:'Forage', options:[{label:'Exile three cards from your graveyard', value:'gy'}, {label:'Sacrifice a Food', value:'food'}]}) : S.gy.length >= 3 ? 'gy' : 'food'; if (!how) return false;
      if (how === 'food'){ sacrificeOne(food[0]); return true; } const ids = S.gy.length === 3 ? S.gy.map(g => g.id) : await pickCards({title:'Forage: exile three cards from your graveyard', cards:S.gy, min:3, max:3}); if (!ids || ids.length < 3) return false; ids.forEach(id => moveCard(id, 'ex')); return true; }
    if (/^exert ~$/.test(l)){ c.exert = true; c.r21exert = turnStr(); return true; }
    return pp(p, c);
  };
  // -0/-1 counters lower toughness
  const st = stats;
  stats = function(c, pid){ const r = st(c, pid); const n = c && c.nc && c.nc['-0/-1']; return n && Array.isArray(r) ? [r[0], r[1] - n, ...r.slice(2)] : r; };
}
