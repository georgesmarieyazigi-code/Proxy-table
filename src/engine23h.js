// engine23h.js — round 23 helper H (ranks 3531–4449)
/* ===================== Rules engine — round 23H: long-tail wording from EDHREC ranks 3531–4449 ===================== */

/* ---------- small helpers ---------- */
const h23t = ctx => (ctx && ctx.tgts ? nextTargets(ctx) : []);
const h23o = (s, l, frag) => { const i = l.indexOf(frag); return i >= 0 ? s.slice(i, i + frag.length) : frag; };
const h23cards = ts => (ts || []).filter(t => t.t === 'card');
const H23W = {a:1, an:1, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, twenty:20};
function h23n(w, ctx){ w = String(w || '').toLowerCase(); if (/^\d+$/.test(w)) return +w; if (w === 'x') return (ctx && ctx.it && (ctx.it.x || ctx.it.evX)) || 0; return H23W[w] ?? null; }
function h23card(t){ return t ? boardOf(t.pid).find(b => b.id === t.id) : null; }
function h23pump(c, pid, p, t, kws, src){ if (!c) return; const f = {p:p || 0, t:t || 0, kw:kws || []}; if (pid === MYPID) applyOp({op:'pump', tid:c.id, f}, MYPID); else applyTo({t:'card', pid, id:c.id}, {op:'pump', src, f}); }
const h23kws = s => String(s || '').split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim()).filter(Boolean);
const h23cnt = list => list.reduce((a, c) => a + (c.n || 1), 0);
const h23myCr = () => S.bf.filter(c => !c.fd && isCreatureCard(c));
function h23oppCr(pid){ return (OPP.get(pid)?.bf || []).filter(c => c.k && !c.fd && isCreatureCard(c)); }
function h23say(pid, txt, ctx){ if (pid === MYPID) return; log(`${ctx.name}: ${nameOf(pid)} ${txt}`); }
// conditions written after the effect: "Draw a card if you control an artifact"
function h23cond(t, ctx){
  const l = String(t || '').toLowerCase().trim(); let m;
  if ((m = l.match(/^you control an? ([a-z]+)$/))){ const d = m[1]; return S.bf.some(b => !b.fd && descOk(b.k, d, {tok:b.tok})); }
  if ((m = l.match(/^you control a creature with power (\d+) or greater$/))) return h23myCr().some(b => stats(b)[0] >= +m[1]);
  if (/^an opponent has more life than you$/.test(l)) return opponents().some(p => (OPP.get(p.pid)?.life ?? -1e9) > S.life);
  if (/^an opponent has more cards in hand than you$/.test(l)) return opponents().some(p => (OPP.get(p.pid)?.hc || 0) > S.hand.length);
  if (/^an opponent controls more creatures than you$/.test(l)) return opponents().some(p => h23cnt(h23oppCr(p.pid)) > h23cnt(h23myCr()));
  if (/^an opponent controls more lands than you$/.test(l)) return opponents().some(p => (OPP.get(p.pid)?.bf || []).filter(b => b.k && isLand(b.k)).length > S.bf.filter(b => isLand(b.k)).length);
  if (/^you're the monarch$/.test(l)) return holderOf('mon') === MYPID;
  if ((m = l.match(/^there are (two|three|four|five|seven) or more (.+?) cards in your graveyard$/))){ const ds = m[2].split(/ and\/or | or /).map(x => x.trim()); return S.gy.filter(g => ds.some(d => descOk(g.k, d))).length >= H23W[m[1]]; }
  return typeof r21cond === 'function' ? r21cond(t, srcCardOf(ctx) || {}) : null;
}

/* ---------- more number words on targets ("six target", "one or two target") ---------- */
{
  const ts0 = targetSpecs;
  targetSpecs = function(t){
    const raw = String(t || '');
    if (!/\b(five|six|seven|eight|nine|ten|one hundred|one or two|two or three) (?:other )?target\b/i.test(raw)) return ts0(t);
    const fixes = []; const low = ' ' + raw.toLowerCase().replace(/\([^)]*\)/g, '');
    const re = /(?:\b(up to )?(one hundred|one or two|two or three|one|two|three|four|five|six|seven|eight|nine|ten|x|any number of) )?(other )?\b(any )?target(?=[ .,;])/g; let m;
    while ((m = re.exec(low))){ const before = low.slice(Math.max(0, m.index - 9), m.index); if (/counter $/.test(before)) continue; fixes.push(m[2] || ''); }
    const repl = raw.replace(/\b(five|six|seven|eight|nine|ten|one hundred|one or two|two or three) ((?:other )?target)\b/gi, 'four $2');
    const out = ts0(repl); let i = 0;
    for (const sp of out){ const w = fixes[i++] || ''; if (/^(five|six|seven|eight|nine|ten)$/.test(w)) sp.n = H23W[w]; else if (w === 'one hundred') sp.n = 100; else if (w === 'one or two'){ sp.n = 2; sp.upTo = true; } else if (w === 'two or three'){ sp.n = 3; sp.upTo = true; } }
    return out;
  };
}

/* ---------- added card types (until end of turn, or from statics) ---------- */
// c.h23ty = [{ty:'Artifact', t:turnStr()|''}] — '' means permanent while the card stays put
function h23addType(c, ty, eot){ if (!c) return; c.h23ty = (c.h23ty || []).filter(x => x.ty !== ty).concat({ty, t:eot ? turnStr() : ''}); }
RQ_OPS.push('h23ty');
const H23TY = {at:0, objs:null, add:null};
function h23staticTypes(){
  const now = Date.now(); if (H23TY.objs && now - H23TY.at < 40 && H23TY.s === S) return H23TY;
  H23TY.at = now; H23TY.s = S; H23TY.objs = new Map();
  if (!S) return H23TY;
  const add = (c, ty) => { const a = H23TY.objs.get(c) || []; if (!a.includes(ty)) a.push(ty); H23TY.objs.set(c, a); };
  const mine = S.bf.filter(b => !b.fd && b.k);
  for (const b of mine){
    const o = String(info(b.k)?.o || '');
    if (/^Creatures you control are the chosen type in addition to their other types\./m.test(o) && b.ctype){
      const ty = b.ctype; [...S.bf, ...S.hand, ...S.gy, ...S.lib, ...S.ex, ...(S.cz || [])].forEach(c => { if (c.k && /\bCreature\b/.test(faceOf(c)?.t || '')) add(c, ty); });
    }
    if (/^Nonland permanents you control are artifacts in addition to their other types\./m.test(o)){
      S.bf.forEach(c => { if (c.k && !isLand(c.k)) add(c, 'Artifact'); });
      [...S.hand, ...S.gy, ...S.lib, ...S.ex, ...(S.cz || [])].forEach(c => { const t = faceOf(c)?.t || ''; if (c.k && /Artifact|Creature|Enchantment|Planeswalker|Battle/.test(t) && !/\bLand\b/.test(t)) add(c, 'Artifact'); });
    }
    if (/^Creatures you control are artifacts in addition to their other types\./m.test(o)){
      [...S.bf, ...S.hand, ...S.gy, ...S.lib, ...S.ex, ...(S.cz || [])].forEach(c => { if (c.k && /\bCreature\b/.test(faceOf(c)?.t || '')) add(c, 'Artifact'); });
    }
    if (/^Creatures you control but don't own are Mercenaries in addition to their other types\./m.test(o)){
      S.bf.forEach(c => { if (c.own && /\bCreature\b/.test(faceOf(c)?.t || '')) add(c, 'Mercenary'); });
    }
  }
  return H23TY;
}
{
  const to0 = typeOf;
  typeOf = c => {
    let t = to0(c);
    if (!c || !S) return t;
    const extra = [];
    if (c.h23ty) for (const x of c.h23ty){ if (!x.t || x.t === turnStr()) extra.push(x.ty); }
    const st = h23staticTypes().objs.get(c); if (st) extra.push(...st);
    if (!extra.length) return t;
    for (const ty of extra){
      if (new RegExp('\\b' + ty + '\\b').test(t)) continue;
      if (/^(Artifact|Enchantment|Creature|Land)$/.test(ty)){ const i = t.search(/\b(Artifact|Enchantment|Creature|Land|Instant|Sorcery|Planeswalker|Battle)\b/); t = i >= 0 ? t.slice(0, i) + ty + ' ' + t.slice(i) : ty + ' ' + t; }
      else t = /—/.test(t) ? t + ' ' + ty : t + ' — ' + ty;
    }
    return t;
  };
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'h23ty'){ const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; if (c){ String(r.d || '').split(',').filter(Boolean).forEach(ty => h23addType(c, ty, true)); log(`${cname(c)} becomes ${String(r.d).replace(/,/g, ' ')} until end of turn (${r.src})`); commit(); } return; }
    return ao(r, from);
  };
}
function h23typeTo(t, types, src){ if (!t) return; if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); types.forEach(ty => h23addType(c, ty, true)); if (c) log(`${cname(c)} becomes ${types.join(' ')} until end of turn`); } else sendRq(t.pid, 'h23ty', 0, src, {tid:t.id, d:types.join(',')}); }
STATIC_KNOWN.push(
  /^creatures you control are the chosen type in addition to their other types$/,
  /^the same is true for creature spells you control and creature cards you own that aren't on the battlefield$/,
  /^nonland permanents you control are artifacts in addition to their other types$/,
  /^the same is true for permanent spells you control and nonland permanent cards you own that aren't on the battlefield$/,
  /^creatures you control are artifacts in addition to their other types$/,
  /^creatures you control but don't own are mercenaries in addition to their other types$/
);

/* ---------- sentences ---------- */
async function doRound23HPre(s, l, ctx){
  let m;
  const name = ctx.name; const full = String(ctx.full || '').toLowerCase();
  // ---- "<effect> if <condition>" (Roadside Reliquary, Glorious Sunrise, Beza, Might of the Meek)
  if ((m = l.match(/^(draw a card|draw two cards|you gain (?:\d+) life|create (?:a|an|one) .+? token|it also gets [+-]\d+\/[+-]\d+ until end of turn) if (.+)$/))){
    const ok = h23cond(m[2], ctx); if (ok == null) return false;
    if (!ok){ log(`${name}: condition not met (${m[2]})`); return true; }
    const eff = m[1].replace(/^it also gets/, 'it gets');
    await doSentence(cap(eff), ctx); return true;
  }
  if ((m = l.match(/^if there are (two|three) or more (.+?) cards in your graveyard, (add (?:\{[wubrgc]\})+)$/))){
    const ok = h23cond(`there are ${m[1]} or more ${m[2]} cards in your graveyard`, ctx);
    if (ok){ const syms = m[3].match(/\{([wubrgc])\}/g).map(x => x[1].toUpperCase()); addMana(syms); log(`${name}: spell mastery — added ${syms.map(x => '{' + x + '}').join('')}`); }
    else log(`${name}: spell mastery not active`);
    commit(); return true;
  }
  // ---- bigger numbers
  if ((m = l.match(/^(?:you )?draws? (eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty) cards$/))){ draw(H23W[m[1]]); commit(); return true; }
  if ((m = l.match(/^you draw (two|three|four) cards and (?:you )?gain (\d+|two|three|four) life$/))){ draw(H23W[m[1]]); const n = h23n(m[2]); if (gainLife(n, name)) log(`gained ${n} life → ${S.life}`); commit(); return true; }
  // ---- several targets at once
  if ((m = l.match(/^(destroy|exile|tap|untap) (two|three|four|five|six|seven|x|one or two|two or three) (?:other )?target (.+)$/)) && !/graveyard/.test(m[3])){
    h23cards(h23t(ctx)).forEach(t => applyTo(t, {op:m[1], src:name})); return true; }
  if ((m = l.match(/^return (two|three|four|five|six|seven|x) target (.+?) to (?:its|their) owners?'s? hands?$/))){ h23cards(h23t(ctx)).forEach(t => applyTo(t, {op:'bounce', src:name})); return true; }
  // ---- players losing life / drawing
  if ((m = l.match(/^(target player|that player) loses (\d+|one|two|three) life and draws (a|one|two|three) cards?$/))){
    const t = /^target/.test(m[1]) ? h23t(ctx)[0] : null; const pid = t ? t.pid : (ctx.it && (ctx.it.evPid || ctx.it.evDp)) || null;
    if (!pid) return true; const n = h23n(m[2]), d = h23n(m[3]);
    if (pid === MYPID){ S.life -= n; log(`lost ${n} life → ${S.life}`); draw(d); }
    else { sendRq(pid, 'life', -n, name); sendRq(pid, 'draw', d, name); log(`${name}: ${nameOf(pid)} loses ${n} life and draws ${d}`); }
    commit(); return true;
  }
  if ((m = l.match(/^you and the attacking player each draw a card and lose (\d+) life$/))){
    const n = +m[1]; draw(1); S.life -= n; log(`drew a card and lost ${n} life → ${S.life}`);
    const pid = ctx.it && (ctx.it.evPid || ctx.it.evDp); if (pid && pid !== MYPID){ sendRq(pid, 'draw', 1, name); sendRq(pid, 'life', -n, name); log(`${name}: ${nameOf(pid)} draws a card and loses ${n} life`); }
    commit(); return true;
  }
  if ((m = l.match(/^(?:~|it) deals (\d+) damage to target opponent or planeswalker$/))){ const srcC = srcCardOf(ctx); h23t(ctx).forEach(t => dealDamage(t, +m[1], ctx.k, srcC)); return true; }
  if ((m = l.match(/^target opponent loses life equal to the amount of life they lost this turn$/))){
    const t = h23t(ctx)[0]; if (!t) return true; const n = lostThisTurn(t.pid);
    if (n) await loseLife(t.pid, n, name); else log(`${name}: ${nameOf(t.pid)} lost no life this turn`); return true; }
  if ((m = l.match(/^you gain life equal to the amount of life you gained this turn$/))){ const n = lifeT().g; if (n && gainLife(n, name)) log(`gained ${n} life → ${S.life}`); commit(); return true; }
  if ((m = l.match(/^you gain life equal to the life you've lost this turn$/))){ const n = lifeT().l; if (n && gainLife(n, name)) log(`gained ${n} life → ${S.life}`); commit(); return true; }
  if ((m = l.match(/^each opponent loses x life, where x is the number of other attacking creatures$/))){
    const sc = srcCardOf(ctx); const n = h23cnt(S.bf.filter(c => c.atk && c !== sc && isCreatureCard(c)));
    for (const p of opponents()) await loseLife(p.pid, n, name); if (!n) log(`${name}: no other attackers`); return true; }
  if ((m = l.match(/^(?:then )?if you're the monarch, ~ deals (\d+|x) damage to each opponent(?:, where x is the number of creatures you control)?$/))){
    if (holderOf('mon') !== MYPID){ log(`${name}: not the monarch`); return true; }
    const n = m[1] === 'x' || /where x is/.test(l) ? h23cnt(h23myCr()) : +m[1];
    const srcC = srcCardOf(ctx); opponents().forEach(p => dealDamage({t:'player', pid:p.pid}, n, ctx.k, srcC)); return true; }
  if ((m = l.match(/^(?:~|it) deals damage to each opponent equal to your devotion to (white|blue|black|red|green)$/))){
    const n = devotion([m[1]]); const srcC = srcCardOf(ctx); opponents().forEach(p => dealDamage({t:'player', pid:p.pid}, n, ctx.k, srcC)); log(`${name}: devotion to ${m[1]} is ${n}`); return true; }
  // ---- pumps
  // m[1] must be a creature subtype ("Goblin creatures get +1/+1"), not a quantifier, state or colour word ("All creatures get -4/-4" is Languish)
  if ((m = s.match(/^([A-Z][a-z]+) creatures get ([+-]\d+)\/([+-]\d+) until end of turn$/)) && !/^(all|other|each|every|attacking|blocking|tapped|untapped|nontoken|token|legendary|nonlegendary|artifact|enchantment|land|snow|white|blue|black|red|green|colorless|multicolored|monocolored|nonwhite|nonblue|nonblack|nonred|nongreen|noncolorless|your|target|those|these|such|any|both|equipped|enchanted|modified|untapped|unblocked|nonartifact|nonhuman|basic|historic|outlaw)$/i.test(m[1])){
    const ty = m[1]; const p = +m[2], tt = +m[3];
    boardsAll().forEach(b => b.bf.forEach(c => { if (c.k && !c.fd && isCreatureCard(c) && new RegExp('\\b' + ty + '\\b').test(typeOf(c))) h23pump(c, b.pid, p, tt, [], name); }));
    log(`${name}: ${ty} creatures get ${m[2]}/${m[3]}`); return true; }
  if ((m = l.match(/^attacking creatures you control get \+(\w+)\/\+(\w+) until end of turn, where x is the number of attacking creatures$/))){
    const att = S.bf.filter(c => c.atk && isCreatureCard(c)); const n = h23cnt(att); att.forEach(c => h23pump(c, MYPID, n, n, [], name)); log(`${name}: attackers get +${n}/+${n}`); return true; }
  if ((m = l.match(/^until end of turn, creatures you control get \+1\/\+1 for each (\w+) you control and gain ([a-z ,]+)$/))){
    const d = m[1]; const n = S.bf.filter(c => !c.fd && descOk(c.k, d.toLowerCase(), {tok:c.tok})).length; h23myCr().forEach(c => h23pump(c, MYPID, n, n, h23kws(m[2]), name)); log(`${name}: creatures get +${n}/+${n}`); return true; }
  if ((m = l.match(/^(other )?(creatures|permanents) you control of (?:the chosen type|that type) (?:get ([+-]\d+)\/([+-]\d+) and )?gain ([a-z ,]+?) until end of turn$/))){
    const sc = srcCardOf(ctx); const ty = ctx.ctype || (sc && sc.ctype); if (!ty) return true;
    const re = new RegExp('\\b' + ty + '\\b', 'i');
    S.bf.filter(c => !c.fd && (m[2] === 'permanents' || isCreatureCard(c)) && !(m[1] && c === sc) && (re.test(typeOf(c)) || kwOf(c, 'changeling'))).forEach(c => h23pump(c, MYPID, +(m[3] || 0), +(m[4] || 0), h23kws(m[5]), name));
    return true; }
  if ((m = l.match(/^(?:up to one )?(another )?target (attacking|blocking|attacking or blocking) creature(?: you control)? gets ([+-]\d+)\/([+-]\d+)(?: and gains ([a-z ,]+?))? until end of turn$/)) ||
      (m = l.match(/^(another) target creature you control gets ([+-]\d+)\/([+-]\d+)(?: and gains ([a-z ,]+?))? until end of turn$/))){
    const [p, tt, kw] = m.length === 6 ? [m[3], m[4], m[5]] : [m[2], m[3], m[4]];
    h23cards(h23t(ctx)).forEach(t => applyTo(t, {op:'pump', src:name, f:{p:+p, t:+tt, kw:h23kws(kw)}})); return true; }
  if ((m = l.match(/^each other creature that's attacking one of your opponents gets \+(\d+)\/\+(\d+) until end of turn$/))){
    const id = ctx.it && ctx.it.evId; const ek = ctx.it && ctx.it.evk; const ep = (ctx.it && ctx.it.evPid) || null;
    boardsAll().forEach(b => b.bf.forEach(c => { if (!c.k || !c.atk) return; if (c.id === id && (!ek || c.k === ek) && (!ep || ep === b.pid)) return;
      const d = parseDef(c.atk); if (!d || d.t !== 'player' || d.pid === MYPID) return; h23pump(c, b.pid, +m[1], +m[2], [], name); }));
    return true; }
  if ((m = l.match(/^untap each attacking creature$/))){ S.bf.filter(c => c.atk && isCreatureCard(c)).forEach(c => { c.tap = false; }); log(`${name}: untapped each attacking creature`); commit(); return true; }
  if ((m = l.match(/^untap all modified creatures you control$/))){ S.bf.filter(c => isCreatureCard(c) && h23modified(c)).forEach(c => { c.tap = false; }); log(`${name}: untapped modified creatures`); commit(); return true; }
  if ((m = l.match(/^creatures you control with counters on them gain ([a-z ]+) until end of turn$/))){ h23myCr().filter(c => h23ctrs(c) > 0).forEach(c => h23pump(c, MYPID, 0, 0, h23kws(m[1]), name)); return true; }
  if ((m = l.match(/^(treefolk and forests|\w+ and \w+) you control gain ([a-z ]+) until end of turn$/))){
    const ds = m[1].split(' and ').map(x => sing(x)); S.bf.filter(c => !c.fd && ds.some(d => descOk(c.k, d, {tok:c.tok}))).forEach(c => h23pump(c, MYPID, 0, 0, h23kws(m[2]), name)); return true; }
  if ((m = l.match(/^creatures you control with defender gain ([a-z ]+) until end of turn$/))){ h23myCr().filter(c => kwOf(c, 'defender')).forEach(c => h23pump(c, MYPID, 0, 0, h23kws(m[1]), name)); return true; }
  if ((m = l.match(/^all non-(\w+) creatures get ([+-]\d+)\/([+-]\d+) until end of turn$/))){
    const ty = cap(m[1]); boardsAll().forEach(b => b.bf.forEach(c => { if (c.k && !c.fd && isCreatureCard(c) && !new RegExp('\\b' + ty + '\\b').test(typeOf(c)) && !kwOf(c, 'changeling', b.pid)) h23pump(c, b.pid, +m[2], +m[3], [], name); })); return true; }
  // ---- type changes until end of turn
  if ((m = l.match(/^(?:until end of turn, )?(target (?:permanent|creature|artifact|land)(?: you control)?|it) becomes an? (artifact|blue artifact|\w+) in addition to its other (?:colors and )?types(?: until end of turn)?$/))){
    const t = /^target/.test(m[1]) ? h23t(ctx)[0] : (ctx.lastT || [])[0]; if (!t) return true;
    h23typeTo(t, [cap(m[2].replace(/^blue /, ''))], name); return true; }
  if ((m = l.match(/^until end of turn, it gains haste and becomes an? (\w+) in addition to its other types$/))){
    const t = (ctx.lastT || [])[0]; if (!t) return true; applyTo(t, {op:'pump', src:name, f:{p:0, t:0, kw:['haste']}}); h23typeTo(t, [cap(m[1])], name); return true; }
  if ((m = l.match(/^target attacking (\w+) that isn't an? (\w+) becomes an? (\w+) in addition to its other types$/))){ const t = h23t(ctx)[0]; if (t) h23typeTo(t, [cap(m[3])], name); return true; }
  return false;
}
function h23ctrs(c){ return (c.cp || 0) + (c.cm || 0) + Object.values(c.nc || {}).reduce((a, b) => a + (b || 0), 0) + (isPW(c) ? 0 : (c.co || 0)); }
function h23modified(c){ return h23ctrs(c) > 0 || S.bf.some(e => e.att && e.att.id === c.id); }
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ let s = String(s0).replace(/\.$/, '').trim().replace(/^then /i, ''); const w1 = String(ctx && ctx.name || '').split(/[ ,]/)[0]; if (w1.length >= 3 && s.startsWith(w1 + ' ') && /legendary/i.test(info(ctx.k)?.t || '')) s = '~' + s.slice(w1.length); const l = s.toLowerCase(); if (l && await doRound23HPre(s, l, ctx)) return; return ds(s0, ctx); };
}

/* ---------- batch 2 ---------- */
RQ_OPS.push('h23mana', 'h23gyRet', 'h23gyPut', 'h23shufGy', 'h23handLib');
UI.h23die = {};
{
  const em = emit;
  emit = function(ev){ try { if (ev && ev.type === 'die' && ev.id != null){ UI.h23die[ev.id] = {cp:ev.cp || 0, cm:ev.cm || 0, k:ev.k}; } } catch {} return em(ev); };
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'h23mana'){ const syms = String(r.d || 'C').split(',').filter(Boolean); addMana(syms); log(`${nameOf(from)} gave me ${syms.map(x => '{' + x + '}').join('')} (${r.src})`); commit(); return; }
    if (r.op === 'h23gyRet'){ (async () => { const list = S.gy.filter(g => !r.d || descOk(g.k, r.d)); if (!list.length){ log(`no card in graveyard to return (${r.src})`); return; }
      const ids = list.length === 1 ? [list[0].id] : await pickCards({title:`${r.src}: return a ${r.d || 'card'} from your graveyard to your hand`, cards:list, min:1, max:1});
      (ids || []).forEach(id => { moveCard(id, 'hand', {quiet:true}); }); log(`returned ${(ids || []).map(id => cname(S.hand.find(c => c.id === id) || {k:''})).join(', ')} from graveyard to hand (${r.src})`); commit(); })(); return; }
    if (r.op === 'h23gyPut'){ (async () => { const list = S.gy.filter(g => isCreatureCard(g)); if (!list.length){ log(`no creature card in graveyard (${r.src})`); return; }
      const ids = list.length === 1 ? [list[0].id] : await pickCards({title:`${r.src}: put a creature card from your graveyard onto the battlefield`, cards:list, min:1, max:1});
      (ids || []).forEach(id => { const c = S.gy.find(g => g.id === id); moveCard(id, 'bf', {quiet:true}); if (c) log(`put ${cname(c)} onto the battlefield from graveyard (${r.src})`); }); commit(); })(); return; }
    if (r.op === 'h23shufGy'){ const n = S.gy.length; S.lib.push(...S.gy.splice(0)); shuffle(S.lib); log(`shuffled their graveyard (${n} cards) into their library (${r.src})`); commit(); return; }
    if (r.op === 'h23handLib'){ const n = S.hand.length; S.lib.push(...S.hand.splice(0)); shuffle(S.lib); log(`shuffled their hand into their library (${r.src})`); if (r.d === 'draw') draw(n); commit(); return; }
    return ao(r, from);
  };
}
function h23tokFor(pid, text, ctx){ if (pid === MYPID) return createFromText('Create ' + text, ctx); sendRq(pid, 'tokText', 0, ctx.name, {d:text}); log(`${nameOf(pid)} creates ${text} (${ctx.name})`); }
// choose up to one permanent per player (the "for each opponent/player, … target … that player controls" family)
async function h23perPlayer(ctx, who, desc, test, verb){
  if (UI.dry) return [];
  const out = []; const ps = who === 'player' ? players() : opponents();
  for (const p of ps){
    const bf = boardOf(p.pid).filter(c => c.k && !c.fd && descOk(c.k, desc, {tok:c.tok}) && (!test || test(c)) && !(p.pid !== MYPID && kwOf(c, 'hexproof', p.pid)) && !kwOf(c, 'shroud', p.pid));
    if (!bf.length) continue;
    const v = await askChoice({title:`${ctx.name}: ${verb} up to one ${desc} ${p.pid === MYPID ? 'you control' : p.nm + ' controls'}`, options:[...bf.map(c => ({label:info(c.k)?.n || '?', value:String(c.id)})), {label:'None', value:''}]});
    if (!v) continue; const c = bf.find(x => String(x.id) === v); out.push({t:'card', pid:p.pid, id:c.id, k:c.k, nm:info(c.k)?.n});
  }
  return out;
}
const h23mvParity = (k, even) => { const mv = info(k)?.mv || 0; return even ? mv % 2 === 0 : mv % 2 === 1; };
function h23lkPow(id, k){ const c = S.bf.find(b => b.id === id); if (c) return Math.max(0, stats(c)[0]); const d = UI.h23die[id] || {}; const p = parseInt(info(k || d.k)?.p, 10); return Math.max(0, (Number.isFinite(p) ? p : 0) + (d.cp || 0) - (d.cm || 0)); }
async function doRound23HPre2(s, l, ctx){
  let m; const name = ctx.name; const full = String(ctx.full || '').toLowerCase();
  if ((m = l.match(/^exile the top x cards of your library$/))){
    const n = h23n('x', ctx); const out = S.lib.splice(0, n); S.ex.push(...out); ctx.lastEx = out.map(c => c.id);
    log(`${name}: exiled ${out.length ? out.map(cname).join(', ') : 'nothing'} from the top of their library`); commit(); return true; }
  if ((m = l.match(/^a player of your choice adds (\{[wubrgc]\})$/))){
    const sym = m[1][1].toUpperCase(); const pid = UI.dry ? MYPID : (players().length === 1 ? MYPID : await choosePlayer(`${name}: which player adds ${m[1].toUpperCase()}?`));
    if (!pid) return true; if (pid === MYPID){ addMana([sym]); log(`${name}: added {${sym}}`); } else { sendRq(pid, 'h23mana', 1, name, {d:sym}); log(`${name}: ${nameOf(pid)} adds {${sym}}`); }
    commit(); return true; }
  if ((m = l.match(/^target player creates (a|an|one|two|three) (.+? tokens?)$/))){ const t = h23t(ctx)[0]; if (!t) return true; await h23tokFor(t.pid, s.replace(/^target player creates /i, ''), ctx); commit(); return true; }
  if ((m = l.match(/^you and target opponent each create (a|an|one|two) (.+? tokens?)$/))){ const txt = s.replace(/^you and target opponent each create /i, ''); await createFromText('Create ' + txt, ctx); const t = h23t(ctx)[0]; if (t && t.pid !== MYPID) await h23tokFor(t.pid, txt, ctx); commit(); return true; }
  if ((m = l.match(/^(?:target player|that player|target opponent) returns a card from their graveyard to their hand$/))){
    let t = h23t(ctx)[0]; if (!t) t = (ctx.lastT || []).find(x => x.t === 'player');
    let pid = t ? t.pid : null; if (!pid && /choose an opponent/.test(full)){ const o = opponents(); pid = UI.dry ? null : o.length === 1 ? o[0].pid : await choosePlayer(`${name}: choose an opponent`, true); }
    if (!pid) return true;
    if (pid === MYPID) applyOp({op:'h23gyRet', src:name, d:''}, MYPID); else { sendRq(pid, 'h23gyRet', 0, name, {d:''}); log(`${name}: ${nameOf(pid)} returns a card from their graveyard to their hand`); }
    commit(); return true; }
  if ((m = l.match(/^discard two cards unless you discard an? (basic land|land|artifact|creature) card$/))){
    const d = m[1]; const has = S.hand.filter(c => descOk(c.k, d));
    let one = false;
    if (has.length && !UI.dry) one = await askChoice({title:`${name}: discard one ${d} card, or two cards?`, options:[{label:`Discard a ${d} card`, value:true}, {label:'Discard two cards', value:false}]});
    if (one){ const ids = has.length === 1 ? [has[0].id] : await pickCards({title:`${name}: discard a ${d} card`, cards:has, min:1, max:1}); (ids || []).forEach(id => moveCard(id, 'gy')); }
    else { const n = Math.min(2, S.hand.length); const ids = n >= S.hand.length ? S.hand.map(c => c.id) : await pickCards({title:`${name}: discard two cards`, cards:S.hand.slice(), min:n, max:n}); (ids || []).forEach(id => moveCard(id, 'gy')); }
    commit(); return true; }
  if ((m = l.match(/^discard a card unless ~ entered this turn$/))){
    const c = srcCardOf(ctx); if (c && c.et === turnStr()){ log(`${name}: entered this turn — no discard`); return true; }
    if (!S.hand.length) return true; const ids = S.hand.length === 1 ? [S.hand[0].id] : await pickCards({title:`${name}: discard a card`, cards:S.hand.slice(), min:1, max:1}); (ids || []).forEach(id => moveCard(id, 'gy')); commit(); return true; }
  // ---- for each opponent / player, up to one target each
  if ((m = l.match(/^for each (opponent|player), (destroy|exile|put a \+1\/\+1 counter on|put) up to one target (.+?) (?:that player|target player) controls( with an? (?:even|odd) mana value)?( into its owner's library third from the top)?$/))){
    const desc = m[3]; const par = m[4] ? /even/.test(m[4]) : null; const verb = m[2];
    if (verb === 'put' && !m[5]) return false;
    const ts = await h23perPlayer(ctx, m[1], desc, par == null ? null : c => h23mvParity(c.k, par), verb.replace(/ a \+1\/\+1 counter on/, ' a +1/+1 counter on'));
    ctx.h23per = ts;
    for (const t of ts){
      if (verb === 'destroy') applyTo(t, {op:'destroy', src:name});
      else if (verb === 'exile') applyTo(t, {op:'exile', src:name});
      else if (/counter/.test(verb)) applyTo(t, {op:'ctr', n:1, src:name, d:'cp'});
      else r22applyLib(t, 2, name);
    }
    commit(); return true; }
  if ((m = l.match(/^if a creature you controlled was destroyed this way, put two \+1\/\+1 counters on ~$/))){
    const mine = (ctx.h23per || []).some(t => t.pid === MYPID && !S.bf.some(b => b.id === t.id) && /Creature/.test(info(t.k)?.t || ''));
    const c = srcCardOf(ctx); if (mine && c && S.bf.includes(c)){ modCounters(c, 'cp', 2); log(`${name}: gets two +1/+1 counters`); } commit(); return true; }
  // ---- graveyard → battlefield
  if ((m = l.match(/^return target creature card from your graveyard to the battlefield with (a|an|one|two|three) additional \+1\/\+1 counters? on it$/))){
    const t = h23t(ctx)[0]; if (!t) return true; const c = S.gy.find(g => g.id === t.id); if (!c) return true;
    moveCard(c.id, 'bf', {quiet:true}); modCounters(c, 'cp', h23n(m[1])); log(`${name}: returned ${cname(c)} with ${h23n(m[1])} additional +1/+1 counters`); commit(); return true; }
  if ((m = l.match(/^~ deals damage equal to that creature's power to (target opponent|target player|any target|each opponent)$/))){
    const id = ctx.it && ctx.it.evId; const n = h23lkPow(id, ctx.it && ctx.it.evk); const srcC = srcCardOf(ctx);
    const ts = m[1] === 'each opponent' ? opponents().map(p => ({t:'player', pid:p.pid})) : h23t(ctx);
    if (n) ts.forEach(t => dealDamage(t, n, ctx.k, srcC)); log(`${name}: ${n} damage`); return true; }
  if ((m = l.match(/^each player puts a creature card from their graveyard onto the battlefield$/))){
    const list = S.gy.filter(g => isCreatureCard(g));
    if (list.length){ const ids = list.length === 1 || UI.dry ? [list[0].id] : await pickCards({title:`${name}: put a creature card from your graveyard onto the battlefield`, cards:list, min:1, max:1}); (ids || []).forEach(id => { const c = S.gy.find(g => g.id === id); moveCard(id, 'bf', {quiet:true}); if (c) log(`${name}: put ${cname(c)} onto the battlefield`); }); }
    opponents().forEach(p => sendRq(p.pid, 'h23gyPut', 0, name)); commit(); return true; }
  if ((m = l.match(/^target player shuffles their graveyard into their library$/))){ const t = h23t(ctx)[0]; if (!t) return true; if (t.pid === MYPID) applyOp({op:'h23shufGy', src:name}, MYPID); else { sendRq(t.pid, 'h23shufGy', 0, name); log(`${name}: ${nameOf(t.pid)} shuffles their graveyard into their library`); } commit(); return true; }
  if ((m = l.match(/^each player shuffles the cards from their hand into their library$/)) && /then draws that many cards/.test(full)){
    const n = S.hand.length; S.lib.push(...S.hand.splice(0)); shuffle(S.lib); draw(n); log(`${name}: shuffled ${n} cards from hand into library and drew ${n}`);
    opponents().forEach(p => sendRq(p.pid, 'h23handLib', 0, name, {d:'draw'})); ctx.h23psy = true; commit(); return true; }
  if (ctx.h23psy && /^(?:then )?draws that many cards$/.test(l)) return true;
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim().replace(/^then /i, ''); const l = s.toLowerCase(); if (l && await doRound23HPre2(s, l, ctx)) return; return ds(s0, ctx); };
}

/* ---------- batch 3 ---------- */
RQ_OPS.push('h23gyAllBf', 'h23tokK', 'h23unless', 'h23exGyCount');
// keyword counters (indestructible, flying, …) grant the keyword
{
  const ko = kwOf;
  kwOf = function(c, kw, pid = MYPID){ if (c && !c.fd && c.nc && c.nc[kw] > 0 && /^(indestructible|flying|first strike|double strike|deathtouch|lifelink|hexproof|menace|reach|trample|vigilance|haste)$/.test(kw)) return true; return ko(c, kw, pid); };
}
// finality counters; Cosmic Intervention
{
  const gr = gyReplace;
  gyReplace = function(c, from){
    const r = gr(c, from); if (r) return r;
    if (S && c && from === 'bf' && c.nc && c.nc.finality > 0){ return 'ex'; }
    if (S && c && from === 'bf' && S.h23cosmic === turnStr() && S.bf.includes(c) && !c.own){ S.h23eot = (S.h23eot || []).concat({ret:c.id, t:turnStr()}); return 'ex'; }
    return r;
  };
  const fs = fireSteps;
  fireSteps = function(...a){
    const r = fs.apply(this, a);
    try { const [step] = a;
      if (S && step === 'end' && (S.h23eot || []).length){
        const due = S.h23eot.filter(d => d.t === turnStr()); S.h23eot = S.h23eot.filter(d => d.t !== turnStr());
        for (const d of due){
          if (d.ret != null){ const c = S.ex.find(x => x.id === d.ret); if (c){ moveCard(c.id, 'bf', {quiet:true}); log(`${cname(c)} returned to the battlefield (${d.src || 'delayed'})`); } }
          if (d.sac != null){ const c = S.bf.find(x => x.id === d.sac); if (c){ sacrificeOne(c); } }
          if (d.exile != null){ const c = S.bf.find(x => x.id === d.exile); if (c){ moveCard(c.id, 'ex', {quiet:true}); log(`${cname(c)} was exiled (${d.src || 'delayed'})`); } }
        }
        if (due.length) commit();
      }
    } catch (e){ console.warn(e); }
    return r;
  };
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'h23gyAllBf'){ const list = S.gy.filter(g => String(r.d || '').split('|').some(d => descOk(g.k, d))); list.forEach(g => moveCard(g.id, 'bf', {quiet:true})); if (list.length) log(`returned ${list.map(cname).join(', ')} from graveyard to the battlefield (${r.src})`); commit(); return; }
    if (r.op === 'h23tokK'){ if (r.d && DICT.has(r.d)){ createToken(r.d, Math.max(1, r.n || 1)); log(`created a token copy of ${info(r.d)?.n} (${r.src})`); } commit(); return; }
    if (r.op === 'h23unless'){ (async () => {
      const opts = String(r.d || '').split('|'); const can = opts.map(o => /^sac:/.test(o) ? S.bf.some(c => !c.fd && descOk(c.k, o.slice(4), {tok:c.tok})) : /^life:/.test(o) ? true : true);
      const choices = opts.map((o, i) => ({label:/^sac:/.test(o) ? `Sacrifice a ${o.slice(4)}` : /^life:/.test(o) ? `Pay ${o.slice(5)} life` : `Let ${nameOf(from)} ${o.slice(5)}`, value:i, disabled:!can[i]}));
      const v = await askChoice({title:`${r.src}: choose`, options:choices});
      const o = opts[v ?? opts.length - 1] || '';
      if (/^sac:/.test(o)) addChoicePrompt('sac', o.slice(4), 1, from, r.src);
      else if (/^life:/.test(o)){ const n = +o.slice(5) || 0; S.life -= n; log(`paid ${n} life (${r.src}) → ${S.life}`); }
      sendRq(from, 'r22pickAns', 1, r.src, {ref:r.ref, d:String(v ?? opts.length - 1)}); commit(); })(); return; }
    if (r.op === 'h23exGyCount'){ const all = S.gy.splice(0); S.ex.push(...all); const n = all.filter(c => String(r.d || '').split('|').some(d => d && descOk(c.k, d))).length; log(`exiled my graveyard (${r.src}): ${all.length} card${all.length === 1 ? '' : 's'}`); sendRq(from, 'r22pickAns', 1, r.src, {ref:r.ref, d:String(r.d ? n : all.length)}); commit(); return; }
    return ao(r, from);
  };
}
async function h23oppAnswer(pid, op, extra, src, timeout){
  if (UI.dry) return null; const ref = rid(6); sendRq(pid, op, 0, src, {...extra, ref}); commit();
  const a = await waitUntil(() => R22.ans[ref], timeout || 90000); return a ? a.idx[0] : null;
}
function h23colorPick(ctx, n){ return UI.dry ? Promise.resolve('R') : askChoice({title:`${ctx.name}: add ${n} mana of which color?`, options:['W','U','B','R','G'].map(x => ({label:x, html:manaHTML('{' + x + '}'), value:x}))}); }
async function doRound23HPre3(s, l, ctx){
  let m; const name = ctx.name; const full = String(ctx.full || '').toLowerCase(); const srcC = srcCardOf(ctx);
  if ((m = l.match(/^target player draws cards equal to the greatest mana value among permanents you control$/))){
    const n = Math.max(0, ...S.bf.filter(c => !c.fd).map(c => info(c.k)?.mv || 0)); const t = h23t(ctx)[0]; if (!t) return true;
    if (t.pid === MYPID) draw(n); else { sendRq(t.pid, 'draw', n, name); log(`${name}: ${nameOf(t.pid)} draws ${n}`); } commit(); return true; }
  if ((m = l.match(/^if ~ was cast from your hand, add ten mana of any one colou?r$/))){
    const hist = (S.castHist || []).filter(h => h.n === name); const z = hist.length ? hist[hist.length - 1].z : (UI.dry ? 'hand' : '');
    if (z !== 'hand'){ log(`${name}: not cast from hand — no mana`); return true; }
    const col = await h23colorPick(ctx, 10); if (!col) return true; addMana(Array(10).fill(col)); log(`${name}: added ten {${col}}`); commit(); return true; }
  if ((m = l.match(/^(?:if you do, )?draw (that many|\d+) cards and add that much \{r\}$/))){
    const n = m[1] === 'that many' || UI.dry ? (ctx.discN != null ? ctx.discN : (UI.dry ? 2 : 0)) : +m[1]; if (!n) return true;
    draw(n); addMana(Array(n).fill('R')); S.h23keepR = turnStr(); log(`${name}: drew ${n} and added ${'{R}'.repeat(n)}`); commit(); return true; }
  if ((m = l.match(/^for each token you control, create (a|an) (.+? token)$/))){
    const n = S.bf.filter(c => c.tok && !c.emb).reduce((a, c) => a + (c.n || 1), 0); if (!n){ log(`${name}: no tokens`); return true; }
    await createFromText(`Create ${n} ${h23o(s, l, m[2])}s`.replace(/ tokens?s$/, ' tokens'), ctx); return true; }
  if ((m = l.match(/^each of (?:that|target) player's opponents may draw a card$/))){
    const pid = (ctx.it && ctx.it.evPid) || (h23t(ctx)[0] || {}).pid; if (!pid) return true;
    for (const p of players()){ if (p.pid === pid) continue; if (p.pid === MYPID){ if (UI.dry || await askYes(`${name}: draw a card?`, 'Draw', "Don't")){ draw(1); } } else sendRq(p.pid, 'r22mayDraw', 0, name); }
    commit(); return true; }
  if ((m = l.match(/^draw a card unless target opponent sacrifices an? (creature|artifact|land|nonland permanent) of their choice or pays (\d+) life$/))){
    const t = h23t(ctx)[0]; if (!t || t.pid === MYPID){ draw(1); commit(); return true; }
    const v = await h23oppAnswer(t.pid, 'h23unless', {d:`sac:${m[1]}|life:${m[2]}|draw:draw a card`}, name);
    if (v === 0) log(`${name}: ${nameOf(t.pid)} sacrifices a ${m[1]}`); else if (v === 1) log(`${name}: ${nameOf(t.pid)} pays ${m[2]} life`); else { draw(1); log(`${name}: ${t.pid ? nameOf(t.pid) : 'they'} let me draw`); }
    commit(); return true; }
  if ((m = l.match(/^~ deals x damage to each creature and planeswalker your opponents control, where x is the number of spells you've cast this turn$/))){
    const n = (S.casts || []).filter(x => x.t === turnStr()).length || (UI.dry ? 1 : 0); const f = srcFlags(ctx.k, MYPID, srcC);
    opponents().forEach(p => sendRq(p.pid, 'dmgAll', n, name, {d:'creature or planeswalker', f})); log(`${name}: ${n} damage to each creature and planeswalker opponents control`); commit(); return true; }
  if ((m = l.match(/^look at twice x cards from the top of your library$/))){
    const x = h23n('x', ctx); const top = S.lib.slice(0, 2 * x); if (!top.length){ ctx.h23star = true; return true; }
    const ids = UI.dry ? top.slice(0, x).map(c => c.id) : await pickCards({title:`${name}: put ${x} card${x === 1 ? '' : 's'} into your hand (the rest go to your graveyard)`, cards:top, min:Math.min(x, top.length), max:Math.min(x, top.length)});
    top.forEach(c => { const i = S.lib.indexOf(c); if (i >= 0) S.lib.splice(i, 1); if ((ids || []).includes(c.id)) S.hand.push(c); else S.gy.push(c); });
    log(`${name}: looked at ${top.length}, took ${(ids || []).length}`); ctx.h23star = true; commit(); return true; }
  if (ctx.h23star && /^put x cards from among them into your hand and the rest into your graveyard$/.test(l)) return true;
  if ((m = l.match(/^(?:up to one )?target ([a-z ]*?creature(?: you control)?) can't be blocked this turn$/))){ h23cards(h23t(ctx)).forEach(t => applyTo(t, {op:'pump', src:name, f:{p:0, t:0, kw:['unblockable']}})); return true; }
  if ((m = l.match(/^target creature can't be the target of spells or abilities your opponents control this turn$/))){ h23cards(h23t(ctx)).forEach(t => applyTo(t, {op:'pump', src:name, f:{p:0, t:0, kw:['hexproof']}})); return true; }
  if ((m = l.match(/^return all (artifact and enchantment|artifact|enchantment|creature) cards from all graveyards to the battlefield under their owners' control$/))){
    const ds = m[1].split(' and '); S.gy.filter(g => ds.some(d => descOk(g.k, d))).forEach(g => moveCard(g.id, 'bf', {quiet:true}));
    opponents().forEach(p => sendRq(p.pid, 'h23gyAllBf', 0, name, {d:ds.join('|')})); log(`${name}: returned all ${m[1]} cards from all graveyards`); commit(); return true; }
  if ((m = l.match(/^return (?:up to one )?target (.+?) card(?: with mana value (\d+) or less)? from your graveyard to the battlefield with an? (finality|indestructible|shield|flying|lifelink|deathtouch) counter on it$/))){
    const t = h23t(ctx)[0]; if (!t) return true; const c = S.gy.find(g => g.id === t.id); if (!c) return true;
    moveCard(c.id, 'bf', {quiet:true}); addNamed(c, m[3], 1); log(`${name}: returned ${cname(c)} with a ${m[3]} counter`); commit(); return true; }
  if ((m = l.match(/^if (?:target|that) player has more cards in hand than you, draw cards equal to the difference$/))){
    let t = h23t(ctx)[0] || (ctx.lastT || []).find(x => x.t === 'player'); let pid = t && t.pid;
    if (!pid){ const o = opponents(); pid = o.length === 1 ? o[0].pid : UI.dry ? null : await choosePlayer(`${name}: choose an opponent`, true); }
    if (!pid) return true; const d = (OPP.get(pid)?.hc || 0) - S.hand.length; if (d > 0){ draw(d); log(`${name}: drew ${d}`); } else log(`${name}: ${nameOf(pid)} doesn't have more cards`); commit(); return true; }
  if ((m = l.match(/^exile target player's graveyard$/)) && /for each (?:card|artifact or land card) exiled this way/.test(full)){
    const t = h23t(ctx)[0]; ctx.h23exN = 0; if (!t) return true;
    const want = /for each artifact or land card/.test(full) ? 'artifact|land' : '';
    if (t.pid === MYPID){ const all = S.gy.splice(0); S.ex.push(...all); ctx.h23exN = want ? all.filter(c => descOk(c.k, 'artifact') || isLand(c.k)).length : all.length; log(`${name}: exiled their graveyard (${all.length})`); }
    else { const gy = OPP.get(t.pid)?.gy || []; const est = want ? gy.filter(k => descOk(k, 'artifact') || isLand(k)).length : gy.length; const v = await h23oppAnswer(t.pid, 'h23exGyCount', {d:want}, name, 15000); ctx.h23exN = v != null ? v : est; log(`${name}: exiled ${nameOf(t.pid)}'s graveyard`); }
    commit(); return true; }
  if ((m = l.match(/^you gain 1 life for each card exiled this way$/)) && ctx.h23exN != null){ if (ctx.h23exN && gainLife(ctx.h23exN, name)) log(`gained ${ctx.h23exN} life → ${S.life}`); commit(); return true; }
  if ((m = l.match(/^for each artifact or land card exiled this way, create (a|an) (.+? token)(.*)$/)) && ctx.h23exN != null){ if (ctx.h23exN) await createFromText(`Create ${ctx.h23exN} ${h23o(s, l, m[2])}s${h23o(s, l, m[3])}`.replace(/ tokens?s\b/, ' tokens'), ctx); commit(); return true; }
  if ((m = l.match(/^any number of target players each (discard a card|mill a card and lose 1 life|mill (two|three) cards)$/))){
    const ts = (ctx.tgts ? nextTargets(ctx) : []).filter(t => t.t === 'player');
    for (const t of ts){
      if (/^discard/.test(m[1])){ if (t.pid === MYPID) addChoicePrompt('discard', '', 1, MYPID, name); else sendRq(t.pid, 'discard', 1, name, {d:''}); }
      else { const n = m[2] ? H23W[m[2]] : 1; if (t.pid === MYPID){ mill(n); if (/lose 1 life/.test(m[1])){ S.life -= 1; } } else { sendRq(t.pid, 'mill', n, name); if (/lose 1 life/.test(m[1])) sendRq(t.pid, 'life', -1, name); } }
    }
    if (ts.length) log(`${name}: ${ts.map(t => nameOf(t.pid)).join(', ')} each ${m[1]}`); commit(); return true; }
  if ((m = l.match(/^target player creates a token that's a copy of target creature you control$/))){
    const p = h23t(ctx)[0]; const c = h23t(ctx)[0]; if (!p || !c) return true; const card = S.bf.find(b => b.id === c.id); const k = card ? card.k : c.k;
    if (p.pid === MYPID){ createToken(k, 1); log(`${name}: created a token copy of ${info(k)?.n}`); } else { sendRq(p.pid, 'h23tokK', 1, name, {d:k}); log(`${name}: ${nameOf(p.pid)} creates a token copy of ${info(k)?.n}`); }
    commit(); return true; }
  if ((m = l.match(/^return a (creature|land|artifact|enchantment|permanent) card from your graveyard to the battlefield( tapped)?$/))){
    const list = S.gy.filter(g => m[1] === 'permanent' ? isPermType(info(g.k)?.t) : descOk(g.k, m[1])); if (!list.length){ log(`${name}: no ${m[1]} card in graveyard`); return true; }
    const ids = UI.dry || list.length === 1 ? [list[0].id] : await pickCards({title:`${name}: return a ${m[1]} card to the battlefield`, cards:list, min:1, max:1});
    (ids || []).forEach(id => { const c = S.gy.find(g => g.id === id); moveCard(id, 'bf', {quiet:true}); if (c && m[2]) c.tap = true; if (c) log(`${name}: returned ${cname(c)} to the battlefield${m[2] ? ' tapped' : ''}`); }); commit(); return true; }
  if ((m = l.match(/^sacrifice it$/)) && /if ~ has no (\w+) counters on it, sacrifice it/.test(tname(ctx.full || '', name).toLowerCase())){ if (srcC && S.bf.includes(srcC)) sacrificeOne(srcC); commit(); return true; }
  if ((m = l.match(/^target opponent loses life equal to the difference between that creature's power and its toughness$/))){
    const id = ctx.it && ctx.it.evId; const c = S.bf.find(b => b.id === id); const t = h23t(ctx)[0]; if (!c || !t) return true; const st = stats(c); const n = Math.abs(st[0] - st[1]);
    if (n) await loseLife(t.pid, n, name); else log(`${name}: no difference`); return true; }
  if ((m = l.match(/^if a permanent you control would be put into a graveyard from the battlefield this turn, exile it instead$/))){ S.h23cosmic = turnStr(); log(`${name}: this turn my permanents are exiled instead of dying, and come back at the next end step`); commit(); return true; }
  if (S.h23cosmic === turnStr() && /^return it to the battlefield under its owner's control at the beginning of the next end step$/.test(l) && /if a permanent you control would be put into a graveyard/.test(full)) return true;
  if ((m = l.match(/^flip a coin until you lose a flip$/))){ let w = 0; while (Math.random() < 0.5 && w < 30) w++; ctx.h23wins = w; log(`🪙 ${name}: won ${w} flip${w === 1 ? '' : 's'} before losing`); return true; }   /* the qcoin events for these wins are emitted by engine24q */
  if ((m = l.match(/^for each flip you won, create a token that's a copy of that creature$/))){
    const n = ctx.h23wins || 0; const id = ctx.it && ctx.it.evId; const k = (S.bf.find(b => b.id === id) || {}).k || (ctx.it && ctx.it.evk);
    ctx.h23toks = []; if (!n || !k) return true;
    for (let i = 0; i < n; i++){ const tk = {id:S.nid++, k, tok:true, copy:true, n:1, sk:true}; place(tk); S.bf.push(tk); ctx.h23toks.push(tk.id); emit({type:'enter', k, id:tk.id, tok:1}); }
    log(`${name}: created ${n} token cop${n === 1 ? 'y' : 'ies'} of ${info(k)?.n}`); commit(); return true; }
  if (ctx.h23toks && /^those tokens gain haste$/.test(l)){ ctx.h23toks.forEach(id => { const c = S.bf.find(b => b.id === id); if (c) c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; }); return true; }
  if (ctx.h23toks && /^exile them at the beginning of the next end step$/.test(l)){ S.h23eot = (S.h23eot || []).concat(ctx.h23toks.map(id => ({exile:id, t:turnStr(), src:name}))); commit(); return true; }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim().replace(/^then /i, ''); const l = s.toLowerCase(); if (l && await doRound23HPre3(s, l, ctx)) return; return ds(s0, ctx); };
}

/* ---------- batch 4 ---------- */
RQ_OPS.push('h23keep1', 'h23sacBig', 'h23setLife', 'h23wipeLose', 'h23tapAll', 'h23gyShuf');
function h23kh(k){ let h = 0x811c9dc5; const t = String(k || ''); for (let i = 0; i < t.length; i++){ h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return '#' + h.toString(36); }   // 8-char key hash for request payloads
UI.h23take = UI.h23take || [];
{
  const tk = takeCard;
  takeCard = function(r, from){
    const before = S.bf.length; const res = tk(r, from);
    try { const c = S.bf.length > before ? S.bf[S.bf.length - 1] : null; const i = c ? UI.h23take.findIndex(p => p.k === c.k && p.from === from) : -1;
      if (c && i >= 0){ const [p] = UI.h23take.splice(i, 1); if (p.tap) c.tap = true; if (p.ty) h23addType(c, p.ty, false); if (p.exileLeave) c.h23exl = 1; commit(); } } catch (e){ console.warn(e); }
    return res;
  };
  const gr = gyReplace;
  gyReplace = function(c, from){ const r = gr(c, from); if (r) return r; if (c && c.h23exl && from === 'bf') return 'ex'; return r; };
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'h23keep1'){ (async () => { const desc = String(r.d || 'creature'); const list = S.bf.filter(c => !c.fd && descOk(c.k, desc, {tok:c.tok}));
      let keep = list.length <= 1 ? list.map(c => c.id) : await pickCards({title:`${r.src}: choose a ${desc} you control to keep`, cards:list, min:1, max:1}); keep = keep || [list[0].id];
      const rest = list.filter(c => !keep.includes(c.id));
      if (r.n === 1) rest.forEach(c => moveCard(c.id, c.tok ? 'gy' : 'hand', {quiet:true})); else rest.forEach(c => destroyCard(c, r.src));
      log(`${r.src}: kept ${list.filter(c => keep.includes(c.id)).map(cname).join(', ') || 'nothing'}`); sendRq(from, 'r22pickAns', 1, r.src, {ref:r.ref, d:String(S.hand.length)}); commit(); })(); return; }
    if (r.op === 'h23sacBig'){ (async () => { const cr = S.bf.filter(c => !c.fd && isCreatureCard(c)); if (!cr.length) return; const top = Math.max(...cr.map(c => stats(c)[0])); const list = cr.filter(c => stats(c)[0] === top);
      const ids = list.length === 1 ? [list[0].id] : await pickCards({title:`${r.src}: sacrifice a creature with the greatest power`, cards:list, min:1, max:1}); const c = S.bf.find(b => b.id === (ids || [list[0].id])[0]); if (c){ sacrificeOne(c); log(`sacrificed ${cname(c)} (${r.src})`); } commit(); })(); return; }
    if (r.op === 'h23setLife'){ const was = S.life; S.life = r.n; log(`life total becomes ${r.n} (was ${was}) (${r.src})`); commit(); return; }
    if (r.op === 'h23wipeLose'){ const desc = String(r.d || 'creature'); const list = S.bf.filter(c => !c.fd && descOk(c.k, desc, {tok:c.tok})); let n = 0;
      list.forEach(c => { const cnt = c.n || 1; destroyCard(c, r.src); if (!S.bf.includes(c)) n += cnt; }); if (n){ S.life -= n; log(`lost ${n} life (${r.src}) → ${S.life}`); } commit(); return; }
    if (r.op === 'h23tapAll'){ const [desc, how] = String(r.d || 'creature|tap').split('|'); S.bf.filter(c => !c.fd && descOk(c.k, desc, {tok:c.tok})).forEach(c => { c.tap = how === 'tap'; if (how !== 'tap') c.tn = 0; }); log(`${how === 'tap' ? 'tapped' : 'untapped'} all their ${desc}s (${r.src})`); commit(); return; }
    if (r.op === 'h23gyShuf'){ const ks = String(r.d || '').split(',').filter(Boolean); let n = 0; ks.forEach(k => { const i = S.gy.findIndex(g => g.k === k || h23kh(g.k) === k); if (i >= 0){ S.lib.push(S.gy.splice(i, 1)[0]); n++; } }); shuffle(S.lib); log(`shuffled ${n} card${n === 1 ? '' : 's'} from graveyard into library (${r.src})`); commit(); return; }
    return ao(r, from);
  };
}
function h23pickOppGy(pid, test, title){ const gy = (OPP.get(pid)?.gy || []).map((k, i) => ({id:-7000 - i, k})).filter(c => c.k && test(c.k)); return gy; }
async function doRound23HPre4(s, l, ctx){
  let m; const name = ctx.name; const full = tname(String(ctx.full || ''), name).toLowerCase(); const srcC = srcCardOf(ctx);
  if ((m = l.match(/^exile target creature$/)) && /where x is the power of the creature exiled this way/.test(full)){
    const t = h23t(ctx)[0]; if (!t) return true; const c = h23card(t); ctx.h23exP = c ? Math.max(0, (t.pid === MYPID ? stats(c) : stats(c, t.pid))[0]) : 0; applyTo(t, {op:'exile', src:name}); return true; }
  if ((m = l.match(/^put x \+1\/\+1 counters on a commander creature you control, where x is the power of the creature exiled this way$/))){
    const n = ctx.h23exP || 0; const list = S.bf.filter(c => c.cmd && isCreatureCard(c)); if (!list.length || !n){ log(`${name}: no commander creature or X = 0`); return true; }
    const ids = list.length === 1 ? [list[0].id] : await pickCards({title:`${name}: put ${n} +1/+1 counters on a commander`, cards:list, min:1, max:1}); const c = S.bf.find(b => b.id === (ids || [])[0]); if (c){ modCounters(c, 'cp', n); log(`${name}: ${cname(c)} gets ${n} +1/+1 counters`); } commit(); return true; }
  if ((m = l.match(/^you gain life equal to the sacrificed (?:permanent|creature|artifact)'s mana value$/))){ const n = ctx.sacd ? (info(ctx.sacd.k)?.mv || 0) : 0; if (n && gainLife(n, name)) log(`gained ${n} life → ${S.life}`); commit(); return true; }
  // Afterlife from the Loam
  if ((m = l.match(/^for each player, choose up to one target creature card in (?:that|target) player's graveyard$/))){
    ctx.h23loam = []; if (UI.dry) return true;
    for (const p of players()){
      const list = p.pid === MYPID ? S.gy.filter(g => isCreatureCard(g)) : h23pickOppGy(p.pid, k => /Creature/.test(info(k)?.t || ''));
      if (!list.length) continue;
      const v = await askChoice({title:`${name}: choose up to one creature card in ${p.pid === MYPID ? 'your' : p.nm + "'s"} graveyard`, options:[...list.map(c => ({label:info(c.k)?.n || '?', value:String(c.id)})), {label:'None', value:''}]});
      if (v) ctx.h23loam.push({pid:p.pid, id:p.pid === MYPID ? +v : null, k:list.find(c => String(c.id) === v).k});
    }
    return true; }
  if ((m = l.match(/^put those cards onto the battlefield under your control$/)) && ctx.h23loam){
    const zomb = /they're zombies in addition to their other types/.test(full);
    for (const x of ctx.h23loam){
      if (x.pid === MYPID){ const c = S.gy.find(g => g.id === x.id); if (c){ moveCard(c.id, 'bf', {quiet:true}); if (zomb) h23addType(c, 'Zombie', false); log(`${name}: put ${cname(c)} onto the battlefield`); } }
      else { UI.h23take.push({k:x.k, from:x.pid, ty:zomb ? 'Zombie' : null}); sendRq(x.pid, 'gytake', 0, name, {d:x.k}); log(`${name}: took ${info(x.k)?.n} from ${nameOf(x.pid)}'s graveyard`); }
    }
    commit(); return true; }
  if (ctx.h23loam && /^they're zombies in addition to their other types$/.test(l)) return true;
  // Realmbreaker
  if ((m = l.match(/^put a land card from their graveyard onto the battlefield tapped under your control$/))){
    const t = (ctx.lastT || []).find(x => x.t === 'player') || h23t(ctx)[0]; const pid = t && t.pid; if (!pid || UI.dry) return true;
    await new Promise(r => setTimeout(r, 1500));
    if (pid === MYPID){ const list = S.gy.filter(g => isLand(g.k)); if (!list.length) return true; const ids = list.length === 1 ? [list[0].id] : await pickCards({title:`${name}: choose a land card`, cards:list, min:1, max:1}); const c = S.gy.find(g => g.id === (ids || [])[0]); if (c){ moveCard(c.id, 'bf', {quiet:true}); c.tap = true; c.h23exl = /exile it instead/.test(full) ? 1 : 0; } commit(); return true; }
    const list = h23pickOppGy(pid, k => isLand(k)); if (!list.length){ log(`${name}: no land card in ${nameOf(pid)}'s graveyard`); return true; }
    const v = list.length === 1 ? String(list[0].id) : await askChoice({title:`${name}: choose a land card from ${nameOf(pid)}'s graveyard`, options:list.map(c => ({label:info(c.k)?.n || '?', value:String(c.id)}))});
    const c = list.find(x => String(x.id) === v) || list[0]; UI.h23take.push({k:c.k, from:pid, tap:true, exileLeave:/exile it instead/.test(full)}); sendRq(pid, 'gytake', 0, name, {d:c.k}); log(`${name}: puts ${info(c.k)?.n} from ${nameOf(pid)}'s graveyard onto the battlefield`); commit(); return true; }
  if (/^it gains "if this land would leave the battlefield, exile it instead of putting it anywhere else\."?$/.test(l)) return true;
  if ((m = l.match(/^return target commander you own from the battlefield to your hand$/))){ h23cards(h23t(ctx)).forEach(t => { if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c && c.cmd){ moveCard(c.id, 'hand', {quiet:true, manual:true}); log(`${name}: returned ${cname(c)} to hand`); } } }); commit(); return true; }
  // Nibelheim Aflame
  if ((m = l.match(/^it deals damage equal to its power to each other creature$/))){
    const t = (ctx.lastT || [])[0]; const c = t && h23card(t); if (!c) return true; const p = Math.max(0, (t.pid === MYPID ? stats(c) : stats(c, t.pid))[0]); if (!p) return true;
    const f = srcFlags(c.k, t.pid, c);
    S.bf.filter(b => !b.fd && isCreatureCard(b) && b !== c).forEach(b => damageCard(b, p, f));
    opponents().forEach(o => (OPP.get(o.pid)?.bf || []).forEach(b => { if (b.k && !b.fd && isCreatureCard(b)) applyTo({t:'card', pid:o.pid, id:b.id}, {op:'dmg', n:p, src:cname(c), f}); }));
    log(`${cname(c)} deals ${p} damage to each other creature`); commit(); return true; }
  if ((m = l.match(/^if ~ was cast from a graveyard, discard your hand and draw (\w+) cards$/))){
    const hist = (S.castHist || []).filter(h => h.n === name); const z = hist.length ? hist[hist.length - 1].z : ''; if (z !== 'gy'){ log(`${name}: not cast from a graveyard`); return true; }
    S.hand.slice().forEach(c => moveCard(c.id, 'gy')); draw(h23n(m[1])); commit(); return true; }
  // Sephiroth: base 7/5
  if ((m = l.match(/^until end of turn, each modified creature you control has base power and toughness (\d+)\/(\d+)$/))){
    S.bf.filter(c => isCreatureCard(c) && h23modified(c)).forEach(c => { const st = stats(c); const bp = st[0] - (c.pu ? c.pu[0] : 0) - (c.cp || 0) + (c.cm || 0); const bt = st[1] - (c.pu ? c.pu[1] : 0) - (c.cp || 0) + (c.cm || 0); c.pu = [(c.pu ? c.pu[0] : 0) + (+m[1] - bp), (c.pu ? c.pu[1] : 0) + (+m[2] - bt)]; });
    log(`${name}: modified creatures have base power and toughness ${m[1]}/${m[2]}`); commit(); return true; }
  // Deadly Tempest / Kaya's Wrath
  if ((m = l.match(/^destroy all creatures$/)) && /(each player loses life equal to the number of creatures they controlled|you gain life equal to the number of creatures you controlled) that were destroyed this way/.test(full)){
    const each = /each player loses life/.test(full); const list = S.bf.filter(c => !c.fd && isCreatureCard(c)); let n = 0;
    list.forEach(c => { const cnt = c.n || 1; destroyCard(c, name); if (!S.bf.includes(c)) n += cnt; });
    ctx.h23dead = n;
    opponents().forEach(p => sendRq(p.pid, each ? 'h23wipeLose' : 'wipe', 0, name, {d:'creature'}));
    log(`${name}: destroyed all creatures (${n} of mine)`); commit(); return true; }
  if (ctx.h23dead != null && /^each player loses life equal to the number of creatures they controlled that were destroyed this way$/.test(l)){ if (ctx.h23dead){ S.life -= ctx.h23dead; log(`lost ${ctx.h23dead} life → ${S.life}`); } commit(); return true; }
  if (ctx.h23dead != null && /^you gain life equal to the number of creatures you controlled that were destroyed this way$/.test(l)){ if (ctx.h23dead && gainLife(ctx.h23dead, name)) log(`gained ${ctx.h23dead} life → ${S.life}`); commit(); return true; }
  // Metalworker
  if ((m = l.match(/^reveal any number of (artifact) cards in your hand$/)) && /add \{c\}\{c\} for each card revealed this way/.test(full)){
    const list = S.hand.filter(c => descOk(c.k, m[1])); const ids = UI.dry || !list.length ? [] : await pickCards({title:`${name}: reveal artifact cards (each adds {C}{C})`, cards:list, min:0, max:list.length});
    ctx.h23rev = (ids || []).length; if (ctx.h23rev) log(`${name}: revealed ${(ids || []).map(id => cname(S.hand.find(c => c.id === id))).join(', ')}`); return true; }
  if (ctx.h23rev != null && /^add \{c\}\{c\} for each card revealed this way$/.test(l)){ const n = ctx.h23rev * 2; if (n){ addMana(Array(n).fill('C')); log(`${name}: added ${'{C}'.repeat(n)}`); } commit(); return true; }
  // Divine Reckoning / Consuming Tide
  if ((m = l.match(/^each player chooses an? (creature|nonland permanent) they control$/)) && /(destroy the rest|return all nonland permanents not chosen this way to their owners' hands)/.test(full)){
    const bounce = /return all nonland permanents not chosen/.test(full); const desc = m[1];
    const list = S.bf.filter(c => !c.fd && descOk(c.k, desc, {tok:c.tok}));
    let keep = list.length <= 1 || UI.dry ? list.slice(0, 1).map(c => c.id) : await pickCards({title:`${name}: choose a ${desc} to keep`, cards:list, min:1, max:1}); keep = keep || [];
    const refs = opponents().map(p => { const ref = rid(6); sendRq(p.pid, 'h23keep1', bounce ? 1 : 0, name, {d:desc, ref}); return [p.pid, ref]; });
    list.filter(c => !keep.includes(c.id)).forEach(c => bounce ? moveCard(c.id, c.tok ? 'gy' : 'hand', {quiet:true}) : destroyCard(c, name));
    log(`${name}: everything but the chosen ${desc}s is ${bounce ? 'returned to hand' : 'destroyed'}`); commit();
    ctx.h23keep = {bounce, refs}; return true; }
  if (ctx.h23keep && /^(destroy the rest|return all nonland permanents not chosen this way to their owners' hands)$/.test(l)) return true;
  if (ctx.h23keep && /^you draw a card for each opponent who has more cards in their hand than you$/.test(l)){
    let n = 0; for (const [pid, ref] of ctx.h23keep.refs){ const a = UI.dry ? null : await waitUntil(() => R22.ans[ref], 60000); const hc = a ? a.idx[0] : (OPP.get(pid)?.hc || 0); if (hc > S.hand.length) n++; }
    if (n) draw(n); log(`${name}: drew ${n}`); commit(); return true; }
  // Papalymo
  if ((m = l.match(/^each opponent who lost life this turn sacrifices a creature with the greatest power among creatures they control$/))){
    const ps = opponents().filter(p => lostThisTurn(p.pid) > 0); ps.forEach(p => sendRq(p.pid, 'h23sacBig', 0, name)); log(`${name}: ${ps.map(p => p.nm).join(', ') || 'nobody'} sacrifices their biggest creature`); commit(); return true; }
  // Genesis Ultimatum
  if ((m = l.match(/^look at the top (five|four|three|six|seven) cards of your library$/)) && /put any number of permanent cards from among them onto the battlefield and the rest into your hand/.test(full)){
    const top = S.lib.splice(0, H23W[m[1]]); const perms = top.filter(c => isPermType(info(c.k)?.t));
    const ids = UI.dry ? [] : await pickCards({title:`${name}: put any number of permanent cards onto the battlefield (the rest go to your hand)`, cards:perms, min:0, max:perms.length});
    for (const c of top){ S.hand.push(c); } for (const id of ids || []) moveCard(id, 'bf', {quiet:true});
    log(`${name}: ${(ids || []).length} onto the battlefield, ${top.length - (ids || []).length} into hand`); ctx.h23gen = true; commit(); return true; }
  if (ctx.h23gen && /^put any number of permanent cards from among them onto the battlefield and the rest into your hand/.test(l)){ if (/exile ~$/.test(l)) ctx.h23exSelf = true; return true; }
  // Vincent
  if ((m = l.match(/^it deals that much damage to each other opponent if ~'s power is (\d+) or greater$/))){
    const c = srcC; if (!c || stats(c)[0] < +m[1]){ log(`${name}: power below ${m[1]}`); return true; } const n = (ctx.it && ctx.it.evN) || 0; const hit = ctx.it && (ctx.it.evDp || ctx.it.evPid);
    opponents().filter(p => p.pid !== hit).forEach(p => dealDamage({t:'player', pid:p.pid}, n, ctx.k, c)); return true; }
  // Clown Car
  if ((m = l.match(/^roll x six-sided dice$/))){ const c = srcC; const x = (c && c.xv != null ? c.xv : null) ?? (ctx.it && ctx.it.x) ?? (UI.dry ? 2 : 0); ctx.h23dice = Array.from({length:x}, () => 1 + Math.floor(Math.random() * 6)); log(`🎲 ${name}: rolled ${ctx.h23dice.join(', ') || 'no dice'}`); if (x) emit({type:'roll', x:Math.max(...ctx.h23dice), cnt:x}); return true; }
  if (ctx.h23dice && (m = l.match(/^for each odd result, create (a|an) (.+? token)$/))){ const n = ctx.h23dice.filter(v => v % 2).length; if (n) await createFromText(`Create ${n} ${h23o(s, l, m[2])}s`.replace(/ tokens?s$/, ' tokens'), ctx); return true; }
  if (ctx.h23dice && (m = l.match(/^for each even result, put a \+1\/\+1 counter on ~$/))){ const n = ctx.h23dice.filter(v => v % 2 === 0).length; if (n && srcC && S.bf.includes(srcC)){ modCounters(srcC, 'cp', n); log(`${name}: ${n} +1/+1 counters`); } commit(); return true; }
  // Rug of Smothering
  if ((m = l.match(/^(?:they|that player|target player) loses? 1 life for each spell they've cast this turn$/))){
    const pid = (ctx.it && ctx.it.evPid) || (h23t(ctx)[0] || {}).pid; if (!pid) return true;
    const n = pid === MYPID ? (S.casts || []).filter(x => x.t === turnStr()).length : ((OPP.get(pid)?.ct === turnStr() ? OPP.get(pid)?.cn : 0) || 1);
    await loseLife(pid, n, name); return true; }
  // "for each X, create a token"
  if ((m = l.match(/^for each (spell you've cast this turn|creature you control), create (a|an) (.+? token)(.*)$/))){
    const n = /spell/.test(m[1]) ? (S.casts || []).filter(x => x.t === turnStr()).length : h23cnt(h23myCr()); if (!n){ log(`${name}: no tokens`); return true; }
    await createFromText(`Create ${n} ${h23o(s, l, m[3])}s${h23o(s, l, m[4])}`.replace(/ tokens?s\b/, ' tokens'), ctx); return true; }
  if ((m = l.match(/^~ deals x damage to each opponent, where x is the number of modified creatures you control other than ~$/))){
    const n = h23cnt(S.bf.filter(c => c !== srcC && isCreatureCard(c) && h23modified(c))); opponents().forEach(p => dealDamage({t:'player', pid:p.pid}, n, ctx.k, srcC)); log(`${name}: ${n} damage to each opponent`); return true; }
  if ((m = l.match(/^(?:you may )?gain life equal to the power of target creature you control$/))){ const t = h23t(ctx)[0]; const c = t && h23card(t); const n = c ? Math.max(0, stats(c)[0]) : 0; if (n && gainLife(n, name)) log(`gained ${n} life → ${S.life}`); commit(); return true; }
  if ((m = l.match(/^put target creature on top of its owner's library$/))){ h23cards(h23t(ctx)).forEach(t => r22applyLib(t, 'top', name)); commit(); return true; }
  if ((m = l.match(/^(?:if he was cast, |you may )?return (another )?target creature card(?: with (lesser )?mana value(?: (\d+) or less)?)? from your graveyard to the battlefield( tapped)?$/))){
    if (/^if he was cast/.test(l)){ const ek = ctx.it && ctx.it.evk; if (!UI.dry && !(S.casts || []).some(x => x.k === (srcC && srcC.k) && x.t === turnStr())){ log(`${name}: wasn't cast`); return true; } }
    const t = h23t(ctx)[0]; if (!t) return true; const c = S.gy.find(g => g.id === t.id); if (!c) return true;
    if (m[4] && (info(c.k)?.mv || 0) > +m[4]){ log(`${name}: ${cname(c)} has mana value over ${m[4]}`); return true; }
    if (m[3]){ const ref = ctx.sacd ? info(ctx.sacd.k)?.mv : (ctx.it && ctx.it.evk ? info(ctx.it.evk)?.mv : null); if (ref != null && (info(c.k)?.mv || 0) >= ref){ log(`${name}: ${cname(c)} doesn't have lesser mana value`); return true; } }
    moveCard(c.id, 'bf', {quiet:true}); if (m[5]) c.tap = true; log(`${name}: returned ${cname(c)} to the battlefield${m[5] ? ' tapped' : ''}`); commit(); return true; }
  if ((m = l.match(/^discard a card at random$/))){ if (!S.hand.length) return true; const c = S.hand[Math.floor(Math.random() * S.hand.length)]; moveCard(c.id, 'gy'); log(`${name}: discarded ${cname(c)} at random`); ctx.discN = 1; emit({type:'discard', k:c.k, id:c.id, cnt:1}); commit(); return true; }
  if ((m = l.match(/^(?:you may )?discard a card or sacrifice a land$/))){
    const lands = S.bf.filter(c => isLand(c.k)); const opts = [{label:'Discard a card', value:'d', disabled:!S.hand.length}, {label:'Sacrifice a land', value:'s', disabled:!lands.length}, {label:"Don't", value:''}];
    const v = UI.dry ? '' : await askChoice({title:`${name}: discard a card or sacrifice a land?`, options:opts}); ctx.mayYes = !!v; ctx.didPay = !!v;
    if (v === 'd'){ const ids = S.hand.length === 1 ? [S.hand[0].id] : await pickCards({title:`${name}: discard a card`, cards:S.hand.slice(), min:1, max:1}); (ids || []).forEach(id => moveCard(id, 'gy')); }
    if (v === 's'){ const ids = lands.length === 1 ? [lands[0].id] : await pickCards({title:`${name}: sacrifice a land`, cards:lands, min:1, max:1}); (ids || []).forEach(id => sacrificeOne(S.bf.find(b => b.id === id))); }
    ctx.h23did = !!v; commit(); return true; }
  if (ctx.h23did !== undefined && (m = l.match(/^if you do, (.+)$/))){ if (ctx.h23did) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); return true; }
  // Akroan Horse / Fractured Identity
  if ((m = l.match(/^an opponent gains control of it$/))){ const c = srcC; if (!c || !S.bf.includes(c)) return true; const o = opponents(); if (!o.length) return true; const pid = o.length === 1 || UI.dry ? o[0].pid : await choosePlayer(`${name}: which opponent gains control of it?`, true); if (pid) giveAway(c, pid, {}); commit(); return true; }
  if ((m = l.match(/^each opponent creates (a|an|one|two) (.+? tokens?)$/))){ for (const p of opponents()) await h23tokFor(p.pid, s.replace(/^each opponent creates /i, ''), ctx); commit(); return true; }
  if ((m = l.match(/^each player other than its controller creates a token that's a copy of it$/))){
    const t = (ctx.lastT || [])[0]; if (!t || !t.k) return true;
    for (const p of players()){ if (p.pid === t.pid) continue; if (p.pid === MYPID){ createToken(t.k, 1); log(`${name}: created a token copy of ${info(t.k)?.n}`); } else sendRq(p.pid, 'h23tokK', 1, name, {d:t.k}); }
    commit(); return true; }
  if ((m = l.match(/^(?:~|it) deals damage equal to that spell's mana value to any target that isn't a commander$/))){
    const t = h23t(ctx)[0]; const n = ctx.it && ctx.it.evk ? (info(ctx.it.evk)?.mv || 0) : 0; if (!t || !n) return true; const c = h23card(t); if (c && c.cmd){ log(`${name}: can't target a commander`); return true; } dealDamage(t, n, ctx.k, srcC); return true; }
  if ((m = l.match(/^target player draws 2ˣ cards$/))){ const x = h23n('x', ctx); const n = Math.min(64, Math.pow(2, x)); const t = h23t(ctx)[0]; if (!t) return true; if (t.pid === MYPID) draw(n); else { sendRq(t.pid, 'draw', Math.min(n, 20), name); log(`${name}: ${nameOf(t.pid)} draws ${n}`); } commit(); return true; }
  if ((m = l.match(/^target opponent's life total becomes (\d+)$/))){ const t = h23t(ctx)[0]; if (!t) return true; if (t.pid === MYPID) applyOp({op:'h23setLife', n:+m[1], src:name}, MYPID); else { sendRq(t.pid, 'h23setLife', +m[1], name); log(`${name}: ${nameOf(t.pid)}'s life total becomes ${m[1]}`); } commit(); return true; }
  if ((m = l.match(/^(?:each opponent|they) gets? a number of rad counters equal to its power$/))){
    const id = ctx.it && ctx.it.evId; const n = h23lkPow(id != null ? id : (srcC && srcC.id), (ctx.it && ctx.it.evk) || ctx.k); if (!n) return true;
    opponents().forEach(p => sendRq(p.pid, 'rad', n, name, {d:'rad'})); log(`${name}: each opponent gets ${n} rad counters`); commit(); return true; }
  if ((m = l.match(/^each player sacrifices half the non-(\w+) creatures they control of their choice, rounded down$/))){
    const ty = cap(m[1]); const notTy = c => !new RegExp('\\b' + ty + '\\b').test(typeOf(c));
    const mine = S.bf.filter(c => !c.fd && isCreatureCard(c) && notTy(c)); const n = Math.floor(h23cnt(mine) / 2);
    if (n){ const ids = UI.dry ? mine.slice(0, n).map(c => c.id) : await pickCards({title:`${name}: sacrifice ${n} non-${ty} creature${n === 1 ? '' : 's'}`, cards:mine, min:n, max:n}); (ids || []).forEach(id => { const c = S.bf.find(b => b.id === id); if (c) sacrificeOne(c); }); }
    opponents().forEach(p => { const k = Math.floor(h23cnt(h23oppCr(p.pid).filter(c => !new RegExp('\\b' + ty + '\\b').test(info(c.k)?.t || ''))) / 2); if (k) sendRq(p.pid, 'sac', k, name, {d:'non' + m[1] + ' creature'}); });
    log(`${name}: each player sacrifices half their non-${ty} creatures`); commit(); return true; }
  if ((m = l.match(/^return it to its owner's hand$/)) && /^whenever a permanent deals damage to you/.test(String(info(ctx.k)?.o || '').toLowerCase())){
    const id = ctx.it && ctx.it.evId; const pid = (ctx.it && ctx.it.evPid) || MYPID; if (id == null) return true; applyTo({t:'card', pid, id}, {op:'bounce', src:name}); commit(); return true; }
  // Turnabout
  if ((m = l.match(/^choose artifact, creature, or land$/))){ ctx.h23ty = UI.dry ? 'creature' : await askChoice({title:`${name}: choose a type`, options:['artifact', 'creature', 'land'].map(x => ({label:cap(x), value:x}))}); return true; }
  if ((m = l.match(/^tap all untapped permanents of the chosen type target player controls, or untap all tapped permanents of that type (?:that|target) player controls$/))){
    const t = h23t(ctx)[0]; if (!t || !ctx.h23ty) return true; const how = UI.dry ? 'tap' : await askChoice({title:`${name}: tap or untap?`, options:[{label:`Tap all their ${ctx.h23ty}s`, value:'tap'}, {label:`Untap all their ${ctx.h23ty}s`, value:'untap'}]});
    if (t.pid === MYPID) applyOp({op:'h23tapAll', d:`${ctx.h23ty}|${how}`, src:name}, MYPID); else { sendRq(t.pid, 'h23tapAll', 0, name, {d:`${ctx.h23ty}|${how}`}); log(`${name}: ${how} all ${ctx.h23ty}s ${nameOf(t.pid)} controls`); } commit(); return true; }
  // Tail Swipe
  if ((m = l.match(/^choose target creature you control and target creature you don't control$/))){ const a = h23t(ctx)[0]; const b = h23t(ctx)[0]; ctx.h23fight = [a, b]; ctx.lastT = a ? [a] : []; return true; }
  if ((m = l.match(/^if you cast this spell during your main phase, the creature you control gets \+1\/\+1 until end of turn$/))){ const a = (ctx.h23fight || [])[0]; const ph = phaseNow(); if (a && ph && ph.pid === MYPID && /main/.test(String(ph.step || ph.name || ph.k || ''))) applyTo(a, {op:'pump', src:name, f:{p:1, t:1, kw:[]}}); return true; }
  if ((m = l.match(/^those creatures fight each other$/)) && ctx.h23fight){
    const [a, b] = ctx.h23fight; const ca = h23card(a), cb = h23card(b); if (!ca || !cb){ log(`${name}: fight didn't happen`); return true; }
    const sa = stats(ca, a.pid), sb = stats(cb, b.pid); dealDamage(b, Math.max(0, sa[0]), ca.k, ca); applyTo(a, {op:'dmg', n:Math.max(0, sb[0]), src:name, f:srcFlags(cb.k, b.pid, cb)}); log(`${cname(ca)} fights ${info(cb.k)?.n}`); commit(); return true; }
  if ((m = l.match(/^until end of turn, target creature you control becomes an? (\w+) in addition to its other types and gains ([a-z ,]+)$/))){ const t = h23t(ctx)[0]; if (!t) return true; h23typeTo(t, [cap(m[1])], name); applyTo(t, {op:'pump', src:name, f:{p:0, t:0, kw:h23kws(m[2])}}); return true; }
  if ((m = l.match(/^choose any number of target creatures$/)) && /each of those creatures gains (\w+) until end of turn/.test(full)){ ctx.h23any = (ctx.tgts ? nextTargets(ctx) : []); return true; }
  if (ctx.h23any && (m = l.match(/^each of those creatures gains (\w+) until end of turn$/))){ h23cards(ctx.h23any).forEach(t => applyTo(t, {op:'pump', src:name, f:{p:0, t:0, kw:[m[1]]}})); return true; }
  if ((m = l.match(/^each opponent loses life equal to the number of creatures attacking them$/))){
    for (const p of opponents()){ const n = h23cnt(S.bf.filter(c => c.atk && (parseDef(c.atk) || {}).pid === p.pid && isCreatureCard(c))); if (n) await loseLife(p.pid, n, name); } return true; }
  if ((m = l.match(/^target attacking creature connives x, where x is the number of attacking creatures$/))){
    const t = h23t(ctx)[0]; const x = h23cnt(S.bf.filter(c => c.atk && isCreatureCard(c))); const c = t && t.pid === MYPID ? S.bf.find(b => b.id === t.id) : null; if (!c || !x) return true; await connive(c, ctx, x); return true; }
  if ((m = l.match(/^exile all creature cards from target player's graveyard$/)) && /you gain (\d+) life for each card exiled this way/.test(full)){
    const t = h23t(ctx)[0]; ctx.h23exN = 0; if (!t) return true;
    if (t.pid === MYPID){ const list = S.gy.filter(g => isCreatureCard(g)); list.forEach(g => moveCard(g.id, 'ex', {quiet:true})); ctx.h23exN = list.length; }
    else { const est = (OPP.get(t.pid)?.gy || []).filter(k => /Creature/.test(info(k)?.t || '')).length; sendRq(t.pid, 'h23exGyD', 0, name, {d:'creature'}); ctx.h23exN = est; }
    log(`${name}: exiled ${ctx.h23exN} creature cards`); commit(); return true; }
  if (ctx.h23exN != null && (m = l.match(/^you gain (\d+) life for each card exiled this way$/))){ const n = ctx.h23exN * +m[1]; if (n && gainLife(n, name)) log(`gained ${n} life → ${S.life}`); commit(); return true; }
  if ((m = l.match(/^it deals damage equal to its power to the player or planeswalker it's attacking$/))){
    const id = ctx.it && ctx.it.evId; const c = S.bf.find(b => b.id === id); if (!c || !c.atk) return true; const d = parseDef(c.atk); const n = Math.max(0, stats(c)[0]); if (!d || !n) return true;
    dealDamage(d.t === 'player' ? {t:'player', pid:d.pid} : {t:'card', pid:d.pid, id:d.id}, n, c.k, c); return true; }
  if ((m = l.match(/^you have no maximum hand size until your next turn$/))){ S.h23nomax = {t:turnStr(), prev:S.noMax || 0}; S.noMax = true; log(`${name}: no maximum hand size until their next turn`); commit(); return true; }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim().replace(/^then /i, ''); const l = s.toLowerCase(); if (l && await doRound23HPre4(s, l, ctx)) return; return ds(s0, ctx); };
}

/* ---------- batch 4b: statics/plumbing ---------- */
RQ_OPS.push('h23exGyD');
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'h23exGyD'){ const d = String(r.d || ''); const list = S.gy.filter(g => !d || descOk(g.k, d)); list.forEach(g => { S.gy.splice(S.gy.indexOf(g), 1); S.ex.push(g); }); log(`exiled ${list.length} ${d || 'card'} card${list.length === 1 ? '' : 's'} from my graveyard (${r.src})`); commit(); return; }
    return ao(r, from);
  };
  const tc = turnChanged;
  turnChanged = function(...a){ const r = tc.apply(this, a); try { if (S && S.h23nomax && currentTurn()[1] === MYPID && S.h23nomax.t !== turnStr()){ S.noMax = S.h23nomax.prev || 0; S.h23nomax = null; log('maximum hand size applies again'); } } catch {} return r; };
}
STATIC_RULES.push([/^your maximum hand size is (six|seven|eight|nine|ten|eleven|twelve)$/, m => ({kind:'maxHand', who:'you', n:H23W[m[1]]})]);

/* ---------- batch 5: animation (becomes an N/N creature), enters/food tracking, misc ---------- */
RQ_OPS.push('h23millCount', 'h23exDie', 'h23anim');
// c.h23bpt = {p, t, until:turnStr()|''} — base power/toughness override for permanents that became creatures
function h23bptOn(c){ return c && c.h23bpt && (!c.h23bpt.until || c.h23bpt.until === turnStr()); }
{
  const st0 = stats;
  stats = function(c, pid = MYPID){
    if (!h23bptOn(c)) return st0(c, pid);
    const b = [c.h23bpt.p, c.h23bpt.t];
    const [ap0, at0] = anthems(c, pid); const [xp, xt] = typeof xAnthems === 'function' ? xAnthems(c, pid) : [0, 0]; const d = (c.cp || 0) - (c.cm || 0); const pu = c.pu || [0, 0]; const ax = attachFx(c, pid);
    const r = [b[0] + d + ap0 + xp + pu[0] + ax.p, b[1] + d + at0 + xt + pu[1] + ax.t];
    return c.sw ? [r[1], r[0]] : r;
  };
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'h23millCount'){ const g0 = S.gy.length; mill(clamp(r.n, 0, 60)); const got = S.gy.slice(g0); const n = got.filter(c => isCreatureCard(c)).length; sendRq(from, 'r22pickAns', 1, r.src, {ref:r.ref, d:String(n)}); commit(); return; }
    if (r.op === 'h23exDie'){ const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; if (c){ c.h23exDie = turnStr(); log(`${cname(c)} will be exiled if it would die this turn (${r.src})`); commit(); } return; }
    if (r.op === 'h23anim'){ const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; if (c){ const [p, t, eot, types] = String(r.d || '').split('|'); h23animate(c, +p, +t, eot === '1', (types || '').split(',').filter(Boolean)); commit(); } return; }
    return ao(r, from);
  };
  const gr = gyReplace;
  gyReplace = function(c, from){ const r = gr(c, from); if (r) return r; if (c && from === 'bf' && c.h23exDie === turnStr()) return 'ex'; return r; };
  // track what entered under my control this turn, and Food sacrifices
  const em = emit;
  emit = function(ev){
    try { if (S && ev && !UI.dry){
      if (ev.type === 'enter' && ev.k){ if (!S.h23ent || S.h23ent.t !== turnStr()) S.h23ent = {t:turnStr(), ks:[]}; S.h23ent.ks.push(ev.k); if (S.h23ent.ks.length > 200) S.h23ent.ks.splice(0, 100); }
      if (ev.type === 'sac' && ev.k && /\bFood\b/.test(info(ev.k)?.t || '')) S.h23food = turnStr();
    } } catch {}
    return em(ev);
  };
}
function h23animate(c, p, t, eot, types){
  if (!c) return; const until = eot ? turnStr() : '';
  c.h23bpt = {p, t, until}; ['Creature', ...(types || [])].forEach(ty => { c.h23ty = (c.h23ty || []).filter(x => x.ty !== ty).concat({ty, t:until}); });
  log(`${cname(c)} becomes a ${p}/${t} ${(types || []).join(' ')} creature${eot ? ' until end of turn' : ''}`.replace(/\s+/g, ' '));
}
function h23animTo(t, p, tt, eot, types, src){ if (!t) return; if (t.pid === MYPID){ h23animate(S.bf.find(b => b.id === t.id), p, tt, eot, types); } else sendRq(t.pid, 'h23anim', 0, src, {tid:t.id, d:`${p}|${tt}|${eot ? 1 : 0}|${(types || []).join(',')}`}); }
async function h23putFromHand(ctx, max, filter, tapped){
  const list = S.hand.filter(c => isPermType(info(c.k)?.t) && (info(c.k)?.mv || 0) <= max && (!filter || filter(c))); if (!list.length){ log(`${ctx.name}: nothing to put onto the battlefield`); return []; }
  const ids = UI.dry ? [] : await pickCards({title:`${ctx.name}: put a permanent card with mana value ${max} or less onto the battlefield`, cards:list, min:0, max:1});
  (ids || []).forEach(id => { const c = S.hand.find(x => x.id === id); moveCard(id, 'bf', {quiet:true}); if (c && tapped) c.tap = true; if (c) log(`${ctx.name}: put ${cname(c)} onto the battlefield`); }); commit(); return ids || [];
}
async function doRound23HPre5(s, l, ctx){
  let m; const name = ctx.name; const full = tname(String(ctx.full || ''), name).toLowerCase(); const srcC = srcCardOf(ctx);
  // Famished Worldsire
  if ((m = l.match(/^look at the top x cards of your library, where x is ~'s power$/)) && /put any number of land cards from among them onto the battlefield tapped/.test(full)){
    const n = srcC ? Math.max(0, stats(srcC)[0]) : 0; const top = S.lib.slice(0, n); const lands = top.filter(c => isLand(c.k));
    const ids = UI.dry || !lands.length ? [] : await pickCards({title:`${name}: put any number of land cards onto the battlefield tapped`, cards:lands, min:0, max:lands.length});
    (ids || []).forEach(id => { const c = S.lib.find(x => x.id === id); moveCard(id, 'bf', {quiet:true}); if (c) c.tap = true; });
    log(`${name}: looked at ${top.length}, put ${(ids || []).length} land${(ids || []).length === 1 ? '' : 's'} onto the battlefield`); shuffleLib(); ctx.h23fw = true; return true; }
  if (ctx.h23fw && /^put any number of land cards from among them onto the battlefield tapped/.test(l)) return true;
  if (ctx.h23fw && /^shuffle$/.test(l)) return true;
  // Come Back Wrong
  if ((m = l.match(/^destroy target creature$/)) && /if a creature card is put into a graveyard this way, return it to the battlefield under your control/.test(full)){
    const t = h23t(ctx)[0]; ctx.h23cbw = t || null; if (t) applyTo(t, {op:'destroy', src:name}); commit(); return true; }
  if ((m = l.match(/^if a creature card is put into a graveyard this way, return it to the battlefield under your control$/)) && ctx.h23cbw !== undefined){
    const t = ctx.h23cbw; if (!t || UI.dry) return true; const sac = /sacrifice it at the beginning of your next end step/.test(full);
    if (t.pid === MYPID){ const c = S.gy.find(g => g.id === t.id); if (c){ moveCard(c.id, 'bf', {quiet:true}); if (sac) S.h23eot = (S.h23eot || []).concat({sac:c.id, t:turnStr(), src:name}); log(`${name}: ${cname(c)} returned`); } }
    else { const ok = await waitUntil(() => (OPP.get(t.pid)?.gy || []).includes(t.k) ? 1 : 0, 8000); if (ok){ UI.h23take.push({k:t.k, from:t.pid, sacEot:sac}); sendRq(t.pid, 'gytake', 0, name, {d:t.k}); log(`${name}: returns ${info(t.k)?.n} under my control`); } else log(`${name}: ${info(t.k)?.n} didn't go to the graveyard`); }
    commit(); return true; }
  if (ctx.h23cbw !== undefined && /^sacrifice it at the beginning of your next end step$/.test(l)) return true;
  // amass X where X is that spell's mana value
  if ((m = l.match(/^amass (\w+?)s? x, where x is that spell's mana value$/))){ const n = ctx.it && ctx.it.evk ? (info(ctx.it.evk)?.mv || 0) : (UI.dry ? 2 : 0); if (!n){ log(`${name}: X is 0`); return true; } await amass(cap(m[1]), n, ctx); return true; }
  // Clone Legion
  if ((m = l.match(/^for each creature target player controls, create a token that's a copy of that creature$/))){
    const t = h23t(ctx)[0]; if (!t) return true; const list = boardOf(t.pid).filter(c => c.k && !c.fd && isCreatureCard(c));
    for (const c of list){ createToken(c.k, c.n || 1); } log(`${name}: created ${h23cnt(list)} token copies`); commit(); return true; }
  // Elanor Gardner
  if ((m = l.match(/^if you sacrificed a food this turn, (.+)$/))){ if (S.h23food !== turnStr() && !UI.dry){ log(`${name}: no Food sacrificed this turn`); return true; } await doSentence(cap(s.slice(s.length - m[1].length)), ctx); return true; }
  // Hobgoblin Bandit Lord
  if ((m = l.match(/^~ deals damage equal to the number of (\w+?)s that entered the battlefield under your control this turn to any target$/))){
    const ty = cap(m[1]); const n = S.h23ent && S.h23ent.t === turnStr() ? S.h23ent.ks.filter(k => new RegExp('\\b' + ty + '\\b').test(info(k)?.t || '') || /Changeling/.test(info(k)?.o || '')).length : 0;
    const t = h23t(ctx)[0]; if (t && n) dealDamage(t, n, ctx.k, srcC); log(`${name}: ${n} ${ty}s entered this turn`); return true; }
  // Dread Summons
  if ((m = l.match(/^each player mills x cards$/)) && /for each creature card put into a graveyard this way, you create/.test(full)){
    const x = h23n('x', ctx); const g0 = S.gy.length; mill(x); let n = S.gy.slice(g0).filter(c => isCreatureCard(c)).length;
    for (const p of opponents()){ const v = await h23oppAnswer(p.pid, 'h23millCount', {}, name, 15000).catch(() => null); if (UI.dry) sendRq(p.pid, 'mill', x, name); n += v || 0; }
    ctx.h23crN = n; log(`${name}: ${n} creature cards were milled`); commit(); return true; }
  if (ctx.h23crN != null && (m = l.match(/^for each creature card put into a graveyard this way, you create a (tapped )?(.+? token)$/))){ if (ctx.h23crN) await createFromText(`Create ${ctx.h23crN} ${m[1] || ''}${h23o(s, l, m[2])}s`.replace(/ tokens?s$/, ' tokens'), ctx); return true; }
  // Broodcaller Scourge / Minn
  if ((m = l.match(/^(?:you may )?put a permanent card with mana value less than or equal to (that damage|that creature's power) from your hand onto the battlefield$/))){
    const n = m[1] === 'that damage' ? ((ctx.it && ctx.it.evN) || 0) : h23lkPow(ctx.it && ctx.it.evId, ctx.it && ctx.it.evk); await h23putFromHand(ctx, n); return true; }
  if ((m = l.match(/^put up to x land cards from your hand onto the battlefield tapped, where x is the sacrificed creature's power$/))){
    const c = ctx.sacd; const n = c ? Math.max(0, (parseInt(info(c.k)?.p) || 0) + (c.cp || 0) - (c.cm || 0)) : 0; const lands = S.hand.filter(h => isLand(h.k)); if (!n || !lands.length) return true;
    const ids = UI.dry ? [] : await pickCards({title:`${name}: put up to ${n} land cards onto the battlefield tapped`, cards:lands, min:0, max:Math.min(n, lands.length)}); (ids || []).forEach(id => { const h = S.hand.find(x => x.id === id); moveCard(id, 'bf', {quiet:true}); if (h) h.tap = true; }); commit(); return true; }
  // Haste Magic
  if ((m = l.match(/^(?:you may )?play it until your next end step$/))){ const ids = ctx.lastEx || []; if (!ids.length) return true; const mine = currentTurn()[1] === MYPID; grantPlay(ids, {src:name, next:!mine}); return true; }
  // Bucknard's Everfull Purse
  if ((m = l.match(/^the player to your right gains control of ~$/))){
    const ps = players(); const i = ps.findIndex(p => p.pid === MYPID); const right = ps.length > 1 ? ps[(i - 1 + ps.length) % ps.length] : null; if (!right || !srcC || !S.bf.includes(srcC)) return true;
    giveAway(srcC, right.pid, {}); commit(); return true; }
  // Blacksmith's Talent
  if ((m = l.match(/^attach target equipment you control to up to one target creature you control$/))){
    const e = h23t(ctx)[0], cr = h23t(ctx)[0]; if (!e || !cr || e.pid !== MYPID || cr.pid !== MYPID) return true; const ec = S.bf.find(b => b.id === e.id); if (!ec) return true;
    ec.att = {pid:MYPID, id:cr.id}; log(`${name}: attached ${cname(ec)} to ${cr.nm || 'a creature'}`); commit(); return true; }
  // Determined Iteration
  if ((m = l.match(/^populate$/)) && /the token created this way gains haste/.test(full) && !ctx.h23pop){
    const before = new Set(S.bf.map(c => c.id)); ctx.h23pop = true; await doSentence('Populate', ctx); const nw = S.bf.filter(c => !before.has(c.id) && c.tok); ctx.h23popIds = nw.map(c => c.id); return true; }
  if (ctx.h23popIds && /^the token created this way gains haste$/.test(l)){ ctx.h23popIds.forEach(id => { const c = S.bf.find(b => b.id === id); if (c) c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; }); return true; }
  if (ctx.h23popIds && /^sacrifice it at the beginning of the next end step$/.test(l)){ S.h23eot = (S.h23eot || []).concat(ctx.h23popIds.map(id => ({sac:id, t:turnStr(), src:name}))); commit(); return true; }
  // Barrowgoyf
  if ((m = l.match(/^(?:you may )?mill that many cards$/)) && /put a creature card from among them into your hand/.test(full)){
    const n = (ctx.it && ctx.it.evN) || 0; if (!UI.dry && !(await askYes(`${name}: mill ${n} cards?`, 'Mill', "Don't"))){ ctx.h23mill = []; return true; }
    const g0 = S.gy.length; mill(n); ctx.h23mill = S.gy.slice(g0).map(c => c.id); commit(); return true; }
  if (ctx.h23mill && /^if you do, you may put a creature card from among them into your hand$|^put a creature card from among them into your hand$/.test(l)){
    const list = ctx.h23mill.map(id => S.gy.find(g => g.id === id)).filter(c => c && isCreatureCard(c)); if (!list.length) return true;
    const ids = UI.dry ? [] : await pickCards({title:`${name}: put a creature card into your hand`, cards:list, min:0, max:1}); (ids || []).forEach(id => moveCard(id, 'hand')); commit(); return true; }
  // Suplex
  if ((m = l.match(/^if that creature would die this turn, exile it instead$/))){ const t = (ctx.lastT || [])[0]; if (!t) return true; if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c) c.h23exDie = turnStr(); } else sendRq(t.pid, 'h23exDie', 0, name, {tid:t.id}); commit(); return true; }
  // Quandrix Command
  if ((m = l.match(/^target player shuffles up to three target cards from their graveyard into their library$/))){
    const p = h23t(ctx)[0]; const cs = (ctx.tgts ? nextTargets(ctx) : []).filter(x => x.t === 'gy'); const pid = p ? p.pid : (cs[0] || {}).pid; if (!pid) return true;
    if (pid === MYPID){ cs.forEach(x => { const i = S.gy.findIndex(g => g.id === x.id); if (i >= 0) S.lib.push(S.gy.splice(i, 1)[0]); }); shuffle(S.lib); log(`${name}: shuffled ${cs.length} cards into library`); }
    else { sendRq(pid, 'h23gyShuf', 0, name, {d:cs.map(x => h23kh(x.k)).join(',')}); /* short key hashes, not 36-char keys: d is cut at 80 chars (and other players' graveyard targets have no ids) */ log(`${name}: ${nameOf(pid)} shuffles ${cs.length} cards from graveyard into library`); }
    commit(); return true; }
  // animation
  if ((m = l.match(/^(target noncreature artifact you control|each noncreature artifact you control) becomes? an? (\d+)\/(\d+) artifact creature$/))){
    const ts = /^target/.test(m[1]) ? h23t(ctx) : S.bf.filter(c => !c.fd && /Artifact/.test(typeOf(c)) && !isCreatureCard(c)).map(c => ({t:'card', pid:MYPID, id:c.id, k:c.k}));
    ctx.h23anim = ts.filter(t => t.pid === MYPID).map(t => t.id); ts.forEach(t => h23animTo(t, +m[2], +m[3], false, [], name)); commit(); return true; }
  if ((m = l.match(/^put (four|two|three|\w+) \+1\/\+1 counters on each artifact that became a creature this way$/)) && ctx.h23anim){ ctx.h23anim.forEach(id => { const c = S.bf.find(b => b.id === id); if (c) modCounters(c, 'cp', H23W[m[1]] || 1); }); commit(); return true; }
  if ((m = l.match(/^target artifact becomes an artifact creature$/)) && /if it isn't a vehicle, it has base power and toughness (\d+)\/(\d+)/.test(full)){
    const t = h23t(ctx)[0]; if (!t) return true; const pt = full.match(/if it isn't a vehicle, it has base power and toughness (\d+)\/(\d+)/); const veh = /Vehicle/.test(info(t.k)?.t || '');
    const vp = veh ? (ptOf(info(t.k)) || [0, 0]) : null; if (veh) h23animTo(t, vp[0], vp[1], false, [], name); else h23animTo(t, +pt[1], +pt[2], false, [], name); commit(); return true; }
  if (/^if it isn't a vehicle, it has base power and toughness \d+\/\d+$/.test(l)) return true;
  if ((m = l.match(/^any number of target noncreature artifacts you control become (\d+)\/(\d+) artifact creatures$/))){
    const ts = (ctx.tgts ? nextTargets(ctx) : []).filter(t => t.pid === MYPID); ts.forEach(t => h23animTo(t, +m[1], +m[2], false, [], name)); ctx.h23anim = ts.map(t => t.id); commit(); return true; }
  if (ctx.h23anim && /^sacrifice them at the beginning of the next end step$/.test(l)){ S.h23eot = (S.h23eot || []).concat(ctx.h23anim.map(id => ({sac:id, t:turnStr(), src:name}))); commit(); return true; }
  if ((m = l.match(/^until end of turn, ~ becomes an x\/x (\w+) (\w+) creature with ([a-z ]+), where x is the greatest mana value among your commanders$/))){
    if (!srcC) return true; const n = Math.max(0, ...[...S.bf, ...S.cz, ...S.gy, ...S.ex, ...S.hand].filter(c => c.cmd).map(c => info(c.k)?.mv || 0));
    h23animate(srcC, n, n, true, [cap(m[2])]); srcC.ekw = [...new Set([...(srcC.ekw || []), ...h23kws(m[3])])]; commit(); return true; }
  if (/^it's still a land$/.test(l)) return true;
  if ((m = l.match(/^target non-aura enchantment you control becomes a creature in addition to its other types and has base power and base toughness each equal to its mana value$/))){
    const t = h23t(ctx)[0]; if (!t) return true; const mv = info(t.k)?.mv || 0; h23animTo(t, mv, mv, false, [], name); commit(); return true; }
  if ((m = l.match(/^if the token isn't a creature, it becomes a (\d+)\/(\d+) ([a-z ]+?) creature in addition to its other types$/))){
    const id = ctx.lastCardId; const c = id != null ? S.bf.find(b => b.id === id && b.tok) : null; if (!c || isCreatureCard(c)) return true;
    h23animate(c, +m[1], +m[2], false, m[3].split(' ').map(cap)); commit(); return true; }
  // Kor Haven
  if ((m = l.match(/^prevent all combat damage that would be dealt by target attacking creature this turn$/))){ h23cards(h23t(ctx)).forEach(t => applyTo(t, {op:'pump', src:name, f:{p:0, t:0, kw:['h23nocd']}})); return true; }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim().replace(/^then /i, ''); const l = s.toLowerCase(); if (l && await doRound23HPre5(s, l, ctx)) return; return ds(s0, ctx); };
  // takeCard extras: sacrifice at my end step
  const tk = takeCard;
  takeCard = function(r, from){ const i = UI.h23take.findIndex(p => p.sacEot && r.c && p.k === r.c.k && p.from === from); const p = i >= 0 ? UI.h23take.splice(i, 1)[0] : null; const before = S.bf.length; const res = tk(r, from);
    if (p && S.bf.length > before){ const c = S.bf[S.bf.length - 1]; S.h23eot = (S.h23eot || []).concat({sac:c.id, t:turnStr(), src:'delayed'}); commit(); } return res; };
}
// Kor Haven: an attacker whose combat damage is prevented deals none (to blockers or the defender)
{
  const ad = attackerDamage;
  attackerDamage = async function(step, blocks){
    const off = S.bf.filter(c => c.atk && (c.ekw || []).includes('h23nocd')); const keep = off.map(c => c.atk);
    off.forEach(c => { c.atk = ''; log(`combat damage from ${cname(c)} is prevented`); });
    try { return await ad(step, blocks); } finally { off.forEach((c, i) => { if (S.bf.includes(c)) c.atk = keep[i]; }); }
  };
}

/* ---------- batch 6: numbers the engine can compute (no "how many?") ---------- */
// nontoken creatures that died this turn (any player)
{
  const he = handleEvent;
  handleEvent = function(pid, ev){
    try { if (S && ev && ev.type === 'die' && !ev.tok && !UI.dry){ const key = pid + ':' + ev.n; if (!S.h23died || S.h23died.t !== turnStr()) S.h23died = {t:turnStr(), n:0, seen:[]}; if (!S.h23died.seen.includes(key)){ S.h23died.seen.push(key); S.h23died.n += (ev.cnt || 1); if (S.h23died.seen.length > 200) S.h23died.seen.splice(0, 100); } } } catch {}
    return he(pid, ev);
  };
}
async function doRound23HPre6(s, l, ctx){
  let m; const name = ctx.name; const full = tname(String(ctx.full || ''), name).toLowerCase(); const srcC = srcCardOf(ctx);
  if ((m = l.match(/^look at the top x cards of your library, where x is the total amount of life your opponents lost this turn$/))){
    const n = opponents().reduce((a, p) => a + lostThisTurn(p.pid), 0); const top = S.lib.slice(0, n);
    if (!top.length){ log(`${name}: opponents lost no life this turn`); ctx.h23flo = true; return true; }
    const ids = UI.dry ? [top[0].id] : await pickCards({title:`${name}: exile one (you may play it this turn); the rest go to the bottom`, cards:top, min:1, max:1});
    const ex = top.find(c => c.id === (ids || [])[0]) || top[0]; S.lib.splice(S.lib.indexOf(ex), 1); S.ex.push(ex);
    const rest = top.filter(c => c !== ex); rest.forEach(c => S.lib.splice(S.lib.indexOf(c), 1)); shuffle(rest); S.lib.push(...rest);
    grantPlay([ex.id], {src:name}); log(`${name}: looked at ${top.length}, exiled ${cname(ex)}`); ctx.h23flo = true; commit(); return true; }
  if (ctx.h23flo && /^(exile one of those cards and put the rest on the bottom of your library in a random order|you may play the exiled card this turn)$/.test(l)) return true;
  if ((m = l.match(/^create (a|an) (.+? token) for each nontoken creature that died this turn$/))){ const n = S.h23died && S.h23died.t === turnStr() ? S.h23died.n : 0; if (n) await createFromText(`Create ${n} ${h23o(s, l, m[2])}s`.replace(/ tokens?s$/, ' tokens'), ctx); else log(`${name}: no nontoken creature died this turn`); return true; }
  if ((m = l.match(/^create a number of (.+? tokens) equal to the number of other creatures you control named ~$/))){
    const n = h23cnt(S.bf.filter(c => c !== srcC && isCreatureCard(c) && cname(c) === name)); if (n) await createFromText(`Create ${n} ${h23o(s, l, m[1])}`, ctx); else log(`${name}: no other ${name}`); return true; }
  if ((m = l.match(/^target creature you control deals damage equal to its power to target creature you don't control$/)) && /equal to the amount of excess damage dealt this way/.test(full)){
    const a = h23t(ctx)[0], b = h23t(ctx)[0]; ctx.h23excess = 0; const ca = h23card(a), cb = h23card(b); if (!ca || !cb) return true;
    const p = Math.max(0, stats(ca)[0]); const sb = stats(cb, b.pid); const need = Math.max(0, sb[1] - (cb.dmg || 0)); ctx.h23excess = isCreatureCard(cb) ? Math.max(0, p - (kwOf(ca, 'deathtouch') ? Math.min(1, need) : need)) : 0;
    dealDamage(b, p, ca.k, ca); return true; }
  if ((m = l.match(/^create a number of (.+? tokens) equal to the amount of excess damage dealt this way$/)) && ctx.h23excess != null){ if (ctx.h23excess) await createFromText(`Create ${ctx.h23excess} ${h23o(s, l, m[1])}`, ctx); return true; }
  if ((m = l.match(/^draw cards equal to the sacrificed creature's toughness, then discard cards equal to its power$/)) || (m = l.match(/^draw cards equal to the sacrificed creature's toughness$/))){
    const c = ctx.sacd; const st = c ? [(parseInt(info(c.k)?.p) || 0) + (c.cp || 0) - (c.cm || 0), (parseInt(String(info(c.k)?.pt || '').split('/')[1]) || h23tough(c.k)) + (c.cp || 0) - (c.cm || 0)] : [0, 0];
    ctx.h23sacP = Math.max(0, st[0]); if (st[1] > 0) draw(st[1]); commit(); return true; }
  if ((m = l.match(/^discard cards equal to its power$/)) && ctx.h23sacP != null){ const n = Math.min(ctx.h23sacP, S.hand.length); if (n){ const ids = n >= S.hand.length || UI.dry ? S.hand.slice(0, n).map(c => c.id) : await pickCards({title:`${name}: discard ${n} card${n === 1 ? '' : 's'}`, cards:S.hand.slice(), min:n, max:n}); (ids || []).forEach(id => moveCard(id, 'gy')); } commit(); return true; }
  if ((m = l.match(/^you draw cards equal to its power$/))){ const n = h23lkPow(ctx.it && ctx.it.evId, ctx.it && ctx.it.evk); if (n) draw(n); log(`${name}: drew ${n}`); commit(); return true; }
  if ((m = l.match(/^create (a|an) (.+? token) for each creature you control of that type$/))){
    const ty = ctx.ctype || (srcC && srcC.ctype); const n = ty ? h23cnt(h23myCr().filter(c => new RegExp('\\b' + ty + '\\b', 'i').test(typeOf(c)) || kwOf(c, 'changeling'))) : 0;
    if (n) await createFromText(`Create ${n} ${h23o(s, l, m[2])}s`.replace(/ tokens?s$/, ' tokens'), ctx); else log(`${name}: no creatures of that type`); return true; }
  return false;
}
function h23tough(k){ const a = info(k) || {}; for (const f of ['t2', 'tt', 'to', 'tg']) if (a[f] != null && /^\d+$/.test(String(a[f]))) return +a[f]; const pt = typeof ptOf === 'function' ? ptOf(a) : null; return pt ? pt[1] : 0; }
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim().replace(/^then /i, ''); const l = s.toLowerCase(); if (l && await doRound23HPre6(s, l, ctx)) return; return ds(s0, ctx); };
}

/* ---------- batch 7: triggers ---------- */
EV_TYPES.push('h23crlib', 'h23bfgy');
{
  // "this Spacecraft" is the card itself
  const tn = tname;
  tname = function(txt, name){ return tn(String(txt || '').replace(/\bthis Spacecraft\b/g, 'this permanent'), name); };
  // creature cards put into my graveyard from my library; permanents put into a graveyard from the battlefield
  const mc = moveCard;
  moveCard = function(id, to, o = {}){
    const [from, , c] = find(id); const r = mc(id, to, o);
    try { if (c && S && !UI.dry && to === 'gy'){
      const [now] = find(id); const landed = now === 'gy' || (c.tok && from === 'bf' && !now);
      if (from === 'lib' && now === 'gy' && isCreatureCard(c)) emit({type:'h23crlib', k:c.k, id:c.id, cnt:1});
      if (from === 'bf' && landed) emit({type:'h23bfgy', k:c.k, id:c.id, tok:c.tok ? 1 : 0, cnt:1});
    } } catch {}
    return r;
  };
  const ml = mill;
  mill = function(n = 1){ const before = S.lib.slice(0, n); const r = ml(n); try { if (!UI.dry){ const cr = before.filter(c => !S.lib.includes(c) && S.gy.includes(c) && isCreatureCard(c)); cr.forEach(c => emit({type:'h23crlib', k:c.k, id:c.id, cnt:1})); } } catch {} return r; };
  const ct = classifyTrig;
  classifyTrig = function(w, c){
    let m;
    if (w === 'whenever'){
      if (/^you roll one or more dice$/.test(c)) return {ev:'roll', subj:'any', ctl:'you', desc:'', min:0};
      if (/^one or more creature cards are put into your graveyard from your library$/.test(c)) return {ev:'h23crlib', subj:'any', ctl:'you', desc:'', batch:true};
      if ((m = c.match(/^a player sacrifices another (creature)$/))) return {ev:'sac', subj:'other', ctl:'any', desc:'creature'};
      if ((m = c.match(/^an opponent sacrifices a (noncreature token)$/))) return {ev:'sac', subj:'any', ctl:'opp', desc:'noncreature', h23k:'tok'};
      if ((m = c.match(/^an? (artifact|creature|enchantment|permanent) is put into an opponent's graveyard from the battlefield$/))) return {ev:'h23bfgy', subj:'any', ctl:'opp', desc:m[1] === 'permanent' ? '' : m[1]};
      if ((m = c.match(/^an? (artifact|creature|enchantment|permanent) you control is put into a graveyard$/))) return {ev:'h23bfgy', subj:'any', ctl:'you', desc:m[1] === 'permanent' ? '' : m[1]};
      if (/^equipped creature becomes blocked by a creature$/.test(c)) return {ev:'blocked', subj:'any', ctl:'you', desc:'', h23k:'equipped'};
      if (/^~ or equipped creature deals combat damage to a player$/.test(c)) return {ev:'cdmg', subj:'any', ctl:'you', desc:'', toPlayer:true, h23k:'selfOrEquipped'};
      if (/^~ or an enchanted creature you control deals combat damage to a player$/.test(c)) return {ev:'cdmg', subj:'any', ctl:'you', desc:'', toPlayer:true, h23k:'selfOrEnchanted'};
      if ((m = c.match(/^an? ((?:[a-z]+, )+(?:or )?[a-z]+) you control deals combat damage to a player$/))) return {ev:'cdmg', subj:'any', ctl:'you', desc:'', toPlayer:true, h23types:m[1].split(/,\s*(?:or\s+)?/).map(x => cap(x.trim()))};
      if ((m = c.match(/^a source you control deals (\d+) or more damage to a player$/))) return {ev:'dmg', subj:'any', ctl:'you', desc:'', toPlayer:true, h23min:+m[1]};
      if (/^one or more creatures an opponent controls deal combat damage to you$/.test(c)) return {ev:'cdmg', subj:'any', ctl:'opp', desc:'', toYou:true, batch:true};
    }
    return ct(w, c);
  };
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    if (t && ev && (t.h23k || t.h23types || t.h23min)){
      const me = evPid === MYPID; const c = me ? S.bf.find(x => x.id === ev.id) : null;
      if (t.h23k === 'tok' && !ev.tok) return;
      if (t.h23k === 'equipped'){ const e = S.bf.find(x => x.id === src.id); if (!me || !e || !e.att || e.att.id !== ev.id) return; }
      if (t.h23k === 'selfOrEquipped'){ const e = S.bf.find(x => x.id === src.id); if (!me || !(ev.id === src.id || (e && e.att && e.att.id === ev.id))) return; }
      if (t.h23k === 'selfOrEnchanted'){ if (!me) return; if (ev.id !== src.id && !(c && boardsAll().some(b => b.bf.some(a => a.att && a.att.id === c.id && /Aura/.test(info(a.k)?.t || ''))))) return; }
      if (t.h23types){ if (!me) return; const ty = c ? typeOf(c) : (info(ev.k)?.t || ''); if (!t.h23types.some(x => new RegExp('\\b' + x + '\\b').test(ty)) && !/Changeling/.test(info(ev.k)?.o || '')) return; }
      if (t.h23min && (ev.amt || 0) < t.h23min) return;
    }
    const r = pt(src, t, ev, evPid);
    try { const it = S.stk[S.stk.length - 1]; if (it && ev && ev.type === 'roll' && it.evX == null) it.evX = ev.x; if (it && ev && (ev.type === 'cdmg' || ev.type === 'dmg') && it.evN == null) it.evN = ev.amt; } catch {}
    return r;
  };
}
async function doRound23HPre7(s, l, ctx){
  let m; const name = ctx.name; const srcC = srcCardOf(ctx);
  if ((m = l.match(/^put a number of charge counters on ~ equal to the result$/))){ const n = (ctx.it && (ctx.it.evX ?? ctx.it.x)) || 0; if (srcC && S.bf.includes(srcC) && n){ addNamed(srcC, 'charge', n); log(`${name}: ${n} charge counters (${srcC.nc.charge} total)`); } commit(); return true; }
  if ((m = l.match(/^goad each creature that player controls$/))){ const pid = ctx.it && (ctx.it.evDp || ctx.it.evPid); if (!pid || pid === MYPID) return true; boardOf(pid).forEach(c => { if (c.k && !c.fd && isCreatureCard(c)) sendRq(pid, 'goad', 0, name, {tid:c.id}); }); log(`${name}: goaded each creature ${nameOf(pid)} controls`); commit(); return true; }
  if ((m = l.match(/^that opponent gets (a|one|two) poison counters?$/))){ const pid = ctx.it && (ctx.it.evPid || ctx.it.evDp); if (!pid || pid === MYPID) return true; const n = H23W[m[1]] || 1; sendRq(pid, 'psn', n, name); log(`${name}: ${nameOf(pid)} gets ${n} poison counter${n === 1 ? '' : 's'}`); commit(); return true; }
  if ((m = l.match(/^you may create a token that's a copy of a nonlegendary enchantment you control$/))){
    const key = 'calix|' + (srcC ? srcC.id : name); S.h23once = S.h23once || {}; if (S.h23once[key] === turnStr()){ log(`${name}: already done this turn`); return true; }
    const list = S.bf.filter(c => !c.fd && /Enchantment/.test(typeOf(c)) && !/Legendary/.test(typeOf(c))); if (!list.length || UI.dry) return true;
    const ids = await pickCards({title:`${name}: create a token copy of a nonlegendary enchantment (optional)`, cards:list, min:0, max:1}); const c = list.find(x => x.id === (ids || [])[0]);
    if (c){ S.h23once[key] = turnStr(); createToken(c.k, 1); log(`${name}: created a token copy of ${cname(c)}`); } commit(); return true; }
  if (/^do this only once each turn$/.test(l)) return true;
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim().replace(/^then /i, ''); const l = s.toLowerCase(); if (l && await doRound23HPre7(s, l, ctx)) return; return ds(s0, ctx); };
}

/* ---------- batch 8: statics ---------- */
{
  const tn = tname;
  tname = function(txt, name){ return tn(String(txt || '').replace(/\b(an?) ((?:[A-Z][a-z]+, )+or [A-Z][a-z]+) you control deals combat damage to a player\b/g, (w, a, list) => `${a} ${list.replace(/,? or /, ', ').split(/, /).join('-')}-h23multi you control deals combat damage to a player`), name); };
  const ct = classifyTrig;
  classifyTrig = function(w, c){ let m; if ((m = c.match(/^an? ([a-z-]+)-h23multi you control deals combat damage to a player$/))) return {ev:'cdmg', subj:'any', ctl:'you', desc:'', toPlayer:true, h23types:m[1].split('-').map(cap)}; return ct(w, c); };
}
STATIC_KNOWN.push(/^(other )?[a-z]+ you control have (toxic|poisonous) \d+$/);
STATIC_RULES.push(
  [/^each creature you control with toughness greater than its power assigns combat damage equal to its toughness rather than its power$/, m => ({kind:'h23tDmg', who:'you', gt:true})],
  [/^during your turn, each creature assigns combat damage equal to its toughness rather than its power$/, m => ({kind:'h23tDmg', who:'all', myTurn:true})],
  [/^creature cards you own that aren't on the battlefield have flash$/, m => ({kind:'allFlash', who:'you', desc:'creature'})],
  [/^any player may cast spells as though they had flash$/, m => ({kind:'allFlash', who:'all'})],
  [/^double all damage equipped creature would deal$/, m => ({kind:'h23x2', who:'you', how:'equipped'})],
  [/^if enchanted creature would deal combat damage to a permanent or player, it deals double that damage instead$/, m => ({kind:'h23x2', who:'all', how:'enchanted', combat:true})],
  [/^if equipped creature would deal combat damage, it deals double that damage instead$/, m => ({kind:'h23x2', who:'you', how:'equipped', combat:true})],
  [/^if another creature would deal combat damage to equipped creature, it deals double that damage to equipped creature instead$/, m => ({kind:'h23x2to', who:'all', how:'equipped', combat:true})],
  [/^creatures you control have base power and toughness (\d+)\/(\d+) and are (\w+?)s? in addition to their other types$/, m => ({kind:'h23base', who:'you', p:+m[1], t:+m[2], ty:cap(m[3])})],
);
{
  const td = toughDmg;
  toughDmg = function(c){ if (td(c)) return true; try { return rulesOn('h23tDmg').some(r => (!r.myTurn || currentTurn()[1] === r.pid) && (!r.gt || (() => { const s = stats(c); return s && s[1] > s[0]; })())); } catch { return false; } };
  // double damage from equipment / auras on the source (or to the equipped creature)
  const attachedTo = (c, pid, how) => { const out = []; for (const b of boardsAll()) for (const a of b.bf){ if (!a.k || a.fd || !a.att || a.att.id !== c.id || (a.att.pid && a.att.pid !== pid)) continue; const t = info(a.k)?.t || ''; if (how === 'equipped' ? /Equipment/.test(t) : /Aura/.test(t)) out.push({a, pid:b.pid}); } return out; };
  const dd = dealDamage;
  dealDamage = function(t, n, srcK, srcCard, extra){
    try { if (S && n > 0 && srcCard && S.bf.includes(srcCard)){
      let mult = 1; const combat = !!UI.h23combat;
      for (const r of staticRules().filter(x => x.kind === 'h23x2')){
        if (r.combat && !combat) continue; const src = boardsAll().find(b => b.pid === r.pid)?.bf.find(b => info(b.k)?.n === r.src && b.att); if (!src) continue;
        if (src.att.id === srcCard.id && (!src.att.pid || src.att.pid === MYPID) && (r.who === 'all' || r.pid === MYPID)) mult *= 2;
      }
      if (combat && t && t.t === 'card'){ for (const r of staticRules().filter(x => x.kind === 'h23x2to')){ const src = boardsAll().find(b => b.pid === r.pid)?.bf.find(b => info(b.k)?.n === r.src && b.att); if (src && src.att.id === t.id && (!src.att.pid || src.att.pid === t.pid) && srcCard.id !== t.id) mult *= 2; } }
      if (mult > 1){ log(`${cname(srcCard)}'s damage is doubled (${n} → ${n * mult})`); n *= mult; }
    } } catch (e){ console.warn(e); }
    return dd(t, n, srcK, srcCard, extra);
  };
  const ad = attackerDamage;
  attackerDamage = async function(...a){ UI.h23combat = true; try { return await ad.apply(this, a); } finally { UI.h23combat = false; } };
  const dt = defenderTick;
  defenderTick = function(...a){ UI.h23combat = true; try { return dt.apply(this, a); } finally { UI.h23combat = false; } };
  // March of the World Ooze: base 6/6 and Ooze
  const st = stats;
  stats = function(c, pid = MYPID){
    const r = st(c, pid); if (!r || !c || !c.k || h23bptOn(c)) return r;
    try { const rs = rulesOn('h23base', pid); if (!rs.length || !isCreatureCard(c)) return r; const ru = rs[rs.length - 1]; const b = ptOf(faceOf(c)) || [0, 0]; const d = [ru.p - b[0], ru.t - b[1]]; return c.sw ? [r[0] + d[1], r[1] + d[0]] : [r[0] + d[0], r[1] + d[1]]; } catch { return r; }
  };
}
{
  // March of the World Ooze types: creatures I control are Oozes
  const to = typeOf;
  typeOf = c => { const t = to(c); try { if (c && S && S.bf.includes(c) && /\bCreature\b/.test(t)){ const rs = staticRules().filter(r => r.kind === 'h23base' && r.pid === MYPID); for (const r of rs) if (!new RegExp('\\b' + r.ty + '\\b').test(t)) return t + (/—/.test(t) ? ' ' : ' — ') + r.ty; } } catch {} return t; };
}
async function doRound23HPre8(s, l, ctx){
  let m; const name = ctx.name;
  if ((m = l.match(/^if it's not their turn, (.+)$/))){ const pid = ctx.it && ctx.it.evPid; if (!UI.dry && pid && currentTurn()[1] === pid){ log(`${name}: it's their turn — nothing happens`); return true; } await doSentence(cap(s.slice(s.length - m[1].length)), ctx); return true; }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim().replace(/^then /i, ''); const l = s.toLowerCase(); if (l && await doRound23HPre8(s, l, ctx)) return; return ds(s0, ctx); };
}

/* ---------- batch 9 ---------- */
RQ_OPS.push('h23noGain', 'h23choose');
{
  const cg = canGain;
  canGain = function(){ if (S && S.h23noGain) return {ok:false, why:`${S.h23noGain}: you can't gain life for the rest of the game`}; return cg(); };
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'h23noGain'){ S.h23noGain = r.src || 'a card'; log(`can't gain life for the rest of the game (${r.src})`); commit(); return; }
    if (r.op === 'h23choose'){ (async () => { const opts = String(r.d || '').split('|'); const v = await askChoice({title:`${r.src}: choose (${nameOf(from)} will see it after everyone chooses)`, options:opts.map((o, i) => ({label:o, value:i}))}); sendRq(from, 'r22pickAns', 1, r.src, {ref:r.ref, d:String(v ?? 0)}); commit(); })(); return; }
    return ao(r, from);
  };
}
async function doRound23HPre9(s, l, ctx){
  let m; const name = ctx.name; const full = tname(String(ctx.full || ''), name).toLowerCase(); const srcC = srcCardOf(ctx);
  if ((m = l.match(/^up to one hundred target creatures each get \+(\d+)\/\+(\d+|x) until end of turn(?:, where x is the number of cards in your hand)?$/))){
    const x = /cards in your hand/.test(full) ? S.hand.length : +m[2] || 0; h23cards(h23t(ctx)).forEach(t => applyTo(t, {op:'pump', src:name, f:{p:+m[1], t:x, kw:[]}})); log(`${name}: +${m[1]}/+${x}`); return true; }
  // Haunting Voyage
  if ((m = l.match(/^return up to two creature cards of that type from your graveyard to the battlefield$/))){
    const ty = ctx.ctype; const card = ctx.it && ctx.it.card; const fore = !!(card && card.fore);
    const list = S.gy.filter(g => isCreatureCard(g) && ty && (new RegExp('\\b' + ty + '\\b', 'i').test(typeOf(g)) || /Changeling/.test(info(g.k)?.o || '')));
    const ids = fore ? list.map(c => c.id) : (UI.dry || !list.length ? [] : await pickCards({title:`${name}: return up to two ${ty} creature cards`, cards:list, min:0, max:Math.min(2, list.length)}));
    (ids || []).forEach(id => moveCard(id, 'bf', {quiet:true})); log(`${name}: returned ${(ids || []).length} ${ty || ''} creature card${(ids || []).length === 1 ? '' : 's'}${fore ? ' (foretold: all of them)' : ''}`); ctx.h23hv = true; commit(); return true; }
  if (ctx.h23hv && /^if ~ was foretold, return all creature cards of that type from your graveyard to the battlefield instead$/.test(l)) return true;
  // Screaming Nemesis
  if ((m = l.match(/^it deals that much damage to any other target$/))){
    const n = (ctx.it && ctx.it.evN) || 0; const t = h23t(ctx)[0]; ctx.h23nem = null; if (!t || !n) return true; dealDamage(t, n, ctx.k, srcC); if (t.t === 'player') ctx.h23nem = t.pid; return true; }
  if ((m = l.match(/^if a player is dealt damage this way, they can't gain life for the rest of the game$/))){ const pid = ctx.h23nem; if (!pid) return true; if (pid === MYPID) S.h23noGain = name; else sendRq(pid, 'h23noGain', 0, name); log(`${name}: ${nameOf(pid)} can't gain life for the rest of the game`); commit(); return true; }
  // Breaching Dragonstorm
  if ((m = l.match(/^(?:you may )?cast it without paying its mana cost if that spell's mana value is (\d+) or less$/))){
    const ids = ctx.lastEx || []; const c = ids.map(id => S.ex.find(x => x.id === id)).filter(x => x && !isLand(x.k)).pop(); ctx.h23bd = c ? c.id : null; if (!c || UI.dry) return true;
    if ((info(c.k)?.mv || 0) > +m[1]){ log(`${name}: ${cname(c)} has mana value over ${m[1]}`); return true; }
    if (await askYes(`${name}: cast ${cname(c)} without paying its mana cost?`, 'Cast it', 'No')){ UI.afterCast = () => {}; await beginCast(c, 'ex', {free:true}); } commit(); return true; }
  if ((m = l.match(/^if you don't, put that card into your hand$/)) && ctx.h23bd !== undefined){ const c = S.ex.find(x => x.id === ctx.h23bd); if (c){ moveCard(c.id, 'hand', {quiet:true}); log(`${name}: put ${cname(c)} into hand`); } commit(); return true; }
  // Rashmi
  if ((m = l.match(/^(?:you may )?cast it without paying its mana cost if it's a spell with lesser mana value$/))){
    const c = ctx.lastRev || S.lib[0]; ctx.h23ra = c ? c.id : null; if (!c || UI.dry) return true; const ref = ctx.it && ctx.it.evk ? (info(ctx.it.evk)?.mv || 0) : 0;
    if (isLand(c.k) || (info(c.k)?.mv || 0) >= ref){ log(`${name}: ${cname(c)} isn't a spell with lesser mana value`); return true; }
    if (await askYes(`${name}: cast ${cname(c)} without paying its mana cost?`, 'Cast it', 'No')){ const i = S.lib.indexOf(c); if (i >= 0){ S.lib.splice(i, 1); S.ex.push(c); } UI.afterCast = () => {}; await beginCast(c, 'ex', {free:true}); if (S.ex.includes(c)){ S.ex.splice(S.ex.indexOf(c), 1); S.lib.unshift(c); } } commit(); return true; }
  if ((m = l.match(/^if you don't cast it, put it into your hand$/)) && ctx.h23ra !== undefined){ const i = S.lib.findIndex(x => x.id === ctx.h23ra); if (i >= 0){ S.hand.push(S.lib.splice(i, 1)[0]); log(`${name}: put it into hand`); } commit(); return true; }
  // Retether
  if ((m = l.match(/^return each aura card from your graveyard to the battlefield$/)) && /only creatures can be enchanted this way/.test(full)){
    const auras = S.gy.filter(g => /\bAura\b/.test(info(g.k)?.t || '')); const cands = []; boardsAll().forEach(b => b.bf.forEach(c => { if (c.k && !c.fd && isCreatureCard(c)) cands.push({pid:b.pid, c}); }));
    for (const a of auras){
      const enchant = (String(info(a.k)?.o || '').match(/^Enchant ([^\n(]+)/m) || [])[1] || ''; const ok = cands.filter(x => /creature/i.test(enchant) && (!/you control/i.test(enchant) || x.pid === MYPID) && !(x.pid !== MYPID && kwOf(x.c, 'shroud', x.pid)));
      if (!ok.length){ log(`${name}: ${cname(a)} can't enchant anything — stays in the graveyard`); continue; }
      const v = UI.dry ? '0' : await askChoice({title:`${name}: attach ${cname(a)} to which creature?`, options:ok.map((x, i) => ({label:(x.pid === MYPID ? '' : nameOf(x.pid) + "'s ") + (info(x.c.k)?.n || '?'), value:String(i)}))});
      const pick = ok[+v] || ok[0]; moveCard(a.id, 'bf', {quiet:true}); const placed = S.bf.find(b => b.id === a.id); if (placed){ placed.att = {pid:pick.pid, id:pick.c.id}; log(`${name}: ${cname(placed)} enchants ${info(pick.c.k)?.n}`); }
    }
    ctx.h23ret = true; commit(); return true; }
  if (ctx.h23ret && /^only creatures can be enchanted this way$/.test(l)) return true;
  // Communal Brewing
  if ((m = l.match(/^any number of target opponents each draw a card$/))){ const ts = (ctx.tgts ? nextTargets(ctx) : []).filter(t => t.t === 'player' && t.pid !== MYPID); ts.forEach(t => sendRq(t.pid, 'draw', 1, name)); ctx.h23drawn = ts.filter(t => (OPP.get(t.pid)?.lc ?? 1) > 0).length; if (ts.length) log(`${name}: ${ts.map(t => nameOf(t.pid)).join(', ')} draw a card`); commit(); return true; }
  if ((m = l.match(/^put an? (\w+) counter on ~, then put an? \w+ counter on it for each card drawn this way$/)) || (m = l.match(/^put an? (\w+) counter on it for each card drawn this way$/))){
    const n = (/, then /.test(l) ? 1 : 0) + (ctx.h23drawn || 0); if (srcC && S.bf.includes(srcC) && n){ addNamed(srcC, m[1], n); log(`${name}: ${n} ${m[1]} counter${n === 1 ? '' : 's'}`); } commit(); return true; }
  if ((m = l.match(/^put an? (\w+) counter on ~$/)) && /put an? \w+ counter on it for each card drawn this way/.test(full)){ if (srcC && S.bf.includes(srcC)) addNamed(srcC, m[1], 1); commit(); return true; }
  // Heirloom Blade
  if ((m = l.match(/^(?:you may )?reveal cards from the top of your library until you reveal a creature card that shares a creature type with it$/))){
    const k = ctx.it && ctx.it.evk; const types = (String(info(k)?.t || '').split('—')[1] || '').trim().split(/\s+/).filter(Boolean); const rev = []; let hit = null;
    if (UI.dry || !types.length){ ctx.h23hb = true; return true; }
    if (/^you may/.test(l) && !(await askYes(`${name}: reveal until a creature sharing a type with ${info(k)?.n}?`, 'Reveal', "Don't"))){ ctx.h23hb = true; return true; }
    while (S.lib.length){ const c = S.lib.shift(); if (isCreatureCard(c) && (types.some(t => new RegExp('\\b' + t + '\\b').test(typeOf(c))) || /Changeling/.test(info(c.k)?.o || ''))){ hit = c; break; } rev.push(c); }
    if (hit) S.hand.push(hit); shuffle(rev); S.lib.push(...rev); log(`${name}: revealed ${rev.length + (hit ? 1 : 0)} cards${hit ? ', put ' + cname(hit) + ' into hand' : ''}`); ctx.h23hb = true; commit(); return true; }
  if (ctx.h23hb && /^put that card into your hand and the rest on the bottom of your library in a random order$/.test(l)) return true;
  // Prisoner's Dilemma
  if ((m = l.match(/^each opponent secretly chooses silence or snitch, then the choices are revealed$/)) || (m = l.match(/^each opponent secretly chooses silence or snitch$/))){
    const ops = opponents(); const refs = ops.map(p => { const ref = rid(6); if (!UI.dry) sendRq(p.pid, 'h23choose', 0, name, {ref, d:'Silence|Snitch'}); return [p.pid, ref]; }); commit();
    const ch = {}; for (const [pid, ref] of refs){ const a = UI.dry ? null : await waitUntil(() => R22.ans[ref], 90000); ch[pid] = a ? (a.idx[0] === 1 ? 'snitch' : 'silence') : 'silence'; }
    ctx.h23pd = ch; log(`${name}: ${Object.entries(ch).map(([p, v]) => nameOf(p) + ' chose ' + v).join(', ')}`);
    const vals = Object.values(ch); const srcK = ctx.k;
    if (vals.length && vals.every(v => v === 'silence')) ops.forEach(p => dealDamage({t:'player', pid:p.pid}, 4, srcK, null));
    else if (vals.length && vals.every(v => v === 'snitch')) ops.forEach(p => dealDamage({t:'player', pid:p.pid}, 8, srcK, null));
    else ops.filter(p => ch[p.pid] === 'silence').forEach(p => dealDamage({t:'player', pid:p.pid}, 12, srcK, null));
    commit(); return true; }
  if (ctx.h23pd && /^(the choices are revealed|if each opponent chose (silence|snitch), ~ deals \d+ damage to each of them|otherwise, ~ deals \d+ damage to each opponent who chose silence)$/.test(l)) return true;
  // Another Round
  if ((m = l.match(/^exile any number of creatures you control, then return them to the battlefield under their owner's control$/)) || (m = l.match(/^exile any number of creatures you control$/))){
    const x = h23n('x', ctx); const rounds = /repeat this process x more times/.test(full) ? 1 + x : 1; ctx.h23ar = true; if (UI.dry) return true;
    for (let i = 0; i < rounds; i++){
      const list = S.bf.filter(c => isCreatureCard(c) && !c.fd && !c.own); if (!list.length) break;
      const ids = await pickCards({title:`${name}: exile and return any number of creatures (${i + 1} of ${rounds})`, cards:list, min:0, max:list.length}); if (!ids || !ids.length) break;
      ids.forEach(id => moveCard(id, 'ex', {quiet:true})); ids.forEach(id => { if (S.ex.some(c => c.id === id)) moveCard(id, 'bf', {quiet:true}); }); log(`${name}: flickered ${ids.length} creature${ids.length === 1 ? '' : 's'}`); commit();
      await new Promise(r => setTimeout(r, 300));
    }
    return true; }
  if (ctx.h23ar && /^(return them to the battlefield under their owner's control|repeat this process x more times)$/.test(l)) return true;
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim().replace(/^then /i, ''); const l = s.toLowerCase(); if (l && await doRound23HPre9(s, l, ctx)) return; return ds(s0, ctx); };
}

/* ---------- batch 10: attack restrictions, hexproof-ignoring, targeting triggers ---------- */
RQ_OPS.push('h23noAtk', 'h23mayDrawAns', 'h23nc', 'h23lose');
EV_TYPES.push('h23tgtC');
// can't attack <player>: my S.h23noAtk = [{pid, armed|t}] (player-level); c.h23noAtkP = {t, n, pids} (creature-level, this combat)
function h23atkBanned(c, def){
  const d = parseDef(def); if (!d) return ''; const P = attackTargetProtector(d) || d.pid; const cbn = S.cb && S.cb.t === turnStr() ? S.cb.n : 1;
  if ((S.h23noAtk || []).some(x => x.pid === P && x.t === turnStr())) return `can't attack ${nameOf(P)} this turn`;
  if (c.h23noAtkP && c.h23noAtkP.t === turnStr() && c.h23noAtkP.n === cbn && c.h23noAtkP.pids.includes(P)) return `can't attack ${nameOf(P)} this combat`;
  if (S.h23landOnly && S.h23landOnly.t === turnStr() && S.h23landOnly.n === cbn && !isLand(c.k)) return 'only land creatures can attack this combat';
  if (P !== MYPID){ const pb = OPP.get(P)?.bf || []; if (pb.some(e => e.k && !e.fd && /^Each creature that's enchanted by an Aura you control can't attack you or planeswalkers you control\.?$/m.test(info(e.k)?.o || '')) && pb.some(a => a.k && a.att && a.att.id === c.id && (!a.att.pid || a.att.pid === MYPID) && /\bAura\b/.test(info(a.k)?.t || ''))) return `enchanted by ${nameOf(P)}'s Aura`; }
  return '';
}
STATIC_KNOWN.push(/^each creature that's enchanted by an aura you control can't attack you or planeswalkers you control$/);
{
  const da = declareAttackers;
  declareAttackers = function(){
    try { if (S && UI.atkSel){ for (const [id, def] of Object.entries(UI.atkSel)){ if (!def) continue; const c = S.bf.find(x => x.id === +id); if (!c) continue; const why = h23atkBanned(c, def); if (why){ toast(`${cname(c)}: ${why}`); delete UI.atkSel[id]; } } } } catch (e){ console.warn(e); }
    return da();
  };
  const tc = turnChanged;
  turnChanged = function(...a){ const r = tc.apply(this, a); try { if (S && S.h23noAtk){ const me = currentTurn()[1] === MYPID; S.h23noAtk = S.h23noAtk.filter(x => x.armed ? true : x.t === turnStr()); S.h23noAtk.forEach(x => { if (x.armed && me){ x.t = turnStr(); delete x.armed; } }); } } catch {} return r; };
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'h23noAtk'){ S.h23noAtk = (S.h23noAtk || []).concat({pid:from, armed:true}); log(`can't attack ${nameOf(from)} or their permanents during my next turn (${r.src})`); commit(); return; }
    if (r.op === 'h23mayDrawAns'){ (async () => { const yes = await askYes(`${r.src}: you may draw a card${r.d ? ' (' + r.d + ')' : ''}. Draw?`, 'Draw', "Don't"); if (yes){ draw(1); log(`drew a card (${r.src})`); } sendRq(from, 'r22pickAns', 1, r.src, {ref:r.ref, d:yes ? '1' : '0'}); commit(); })(); return; }
    if (r.op === 'h23nc'){ const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; if (c){ addNamed(c, String(r.d || 'bounty'), r.n || 1); log(`${cname(c)} gets a ${r.d} counter (${r.src})`); commit(); } return; }
    if (r.op === 'h23lose'){ S.h23lose = turnStr(); log(`my permanents lose hexproof, indestructible, protection, shroud, and ward until end of turn (${r.src})`); commit(); return; }
    return ao(r, from);
  };
  // Detection Tower / Shay Cormac: my spells and abilities ignore hexproof (and more)
  const tcs = targetCands;
  targetCands = function(spec, src){
    const out = tcs(spec, src);
    try { if (S && src && src.pid === MYPID){
      const dt = S.h23dt === turnStr(), sh = S.h23shay === turnStr();
      if (dt || sh) out.forEach(x => { if (x.ok || x.pid === MYPID) return; if ((dt || sh) && x.why === 'hexproof') { x.ok = true; x.why = ''; } else if (sh && /shroud|protection/.test(x.why || '')){ x.ok = true; x.why = ''; } });
    } } catch {}
    return out;
  };
  const ko = kwOf;
  kwOf = function(c, kw, pid = MYPID){ if (S && S.h23lose === turnStr() && pid === MYPID && c && S.bf.includes(c) && /^(hexproof|indestructible|shroud|ward)$/.test(kw)) return false; return ko(c, kw, pid); };
  // Shay Cormac: an opponent's creature becomes the target of my spell or ability
  const ctg = chooseTargets;
  chooseTargets = async function(text, src, name){
    const r = await ctg(text, src, name);
    try { if (!UI.dry){ const list = Array.isArray(r) ? r.flat(2) : []; list.filter(t => t && t.t === 'card' && t.pid && t.pid !== MYPID && t.k && /Creature/.test(info(t.k)?.t || '')).forEach(t => emit({type:'h23tgtC', k:t.k, id:t.id, dp:t.pid, cnt:1})); } } catch {}
    return r;
  };
  const ct = classifyTrig;
  classifyTrig = function(w, c){ if (w === 'whenever' && /^a creature an opponent controls becomes the target of a spell or ability you control$/.test(c)) return {ev:'h23tgtC', subj:'any', ctl:'you', desc:''}; return ct(w, c); };
  const sm = subjMatch;
  subjMatch = function(t, src, ev, pid){ if (ev && ev.type === 'h23tgtC') return pid === MYPID; return sm(t, src, ev, pid); };
}
async function doRound23HPre10(s, l, ctx){
  let m; const name = ctx.name; const full = tname(String(ctx.full || ''), name).toLowerCase(); const srcC = srcCardOf(ctx);
  // The Second Doctor
  if ((m = l.match(/^each player may draw a card$/)) && /each opponent who does can't attack you or permanents you control during their next turn/.test(full)){
    if (UI.dry || await askYes(`${name}: draw a card?`, 'Draw', "Don't")) draw(1);
    const refs = opponents().map(p => { const ref = rid(6); if (!UI.dry) sendRq(p.pid, 'h23mayDrawAns', 0, name, {ref, d:`if you do, you can't attack ${nameOf(MYPID)} during your next turn`}); return [p.pid, ref]; }); commit();
    for (const [pid, ref] of refs){ const a = UI.dry ? null : await waitUntil(() => R22.ans[ref], 60000); if (a && a.idx[0] === 1){ sendRq(pid, 'h23noAtk', 0, name); log(`${name}: ${nameOf(pid)} drew — can't attack me next turn`); } }
    ctx.h23doc = true; commit(); return true; }
  if (ctx.h23doc && /^each opponent who does can't attack you or permanents you control during their next turn$/.test(l)) return true;
  // Chaos Dragon
  if ((m = l.match(/^each player rolls a d20$/)) && /had the highest result, ~ can't attack those players/.test(full)){
    const rolls = players().map(p => ({pid:p.pid, r:1 + Math.floor(Math.random() * 20)})); const top = Math.max(...rolls.map(x => x.r));
    log(`🎲 ${name}: ${rolls.map(x => nameOf(x.pid) + ' ' + x.r).join(', ')}`); emit({type:'roll', x:(rolls.find(x => x.pid === MYPID) || {}).r || 0, cnt:1});
    const ban = rolls.filter(x => x.r === top && x.pid !== MYPID).map(x => x.pid); if (srcC && ban.length){ srcC.h23noAtkP = {t:turnStr(), n:S.cb && S.cb.t === turnStr() ? S.cb.n : 1, pids:ban}; log(`${name} can't attack ${ban.map(nameOf).join(', ')} this combat`); }
    ctx.h23cd = true; commit(); return true; }
  if (ctx.h23cd && /^if one or more opponents had the highest result, ~ can't attack those players or planeswalkers they control this combat$/.test(l)) return true;
  // Bumi
  if ((m = l.match(/^only land creatures can attack during that combat phase$/))){ S.h23landOnly = {t:turnStr(), n:(S.cb && S.cb.t === turnStr() ? S.cb.n : 1) + 1}; log(`${name}: only land creatures can attack in the extra combat`); commit(); return true; }
  // Detection Tower / Shay Cormac
  if ((m = l.match(/^until end of turn, your opponents and creatures your opponents control with hexproof can be the targets of spells and abilities you control as though they didn't have hexproof$/))){ S.h23dt = turnStr(); log(`${name}: my spells and abilities ignore hexproof this turn`); commit(); return true; }
  if ((m = l.match(/^permanents your opponents control lose hexproof, indestructible, protection, shroud, and ward until end of turn$/))){ S.h23shay = turnStr(); opponents().forEach(p => sendRq(p.pid, 'h23lose', 0, name)); log(`${name}: opponents' permanents lose hexproof, indestructible, protection, shroud, and ward`); commit(); return true; }
  if ((m = l.match(/^put a (\w+) counter on that creature$/)) && ctx.it && ctx.it.evId != null && ctx.it.evDp){ const pid = ctx.it.evDp; if (pid === MYPID){ const c = S.bf.find(b => b.id === ctx.it.evId); if (c) addNamed(c, m[1], 1); } else sendRq(pid, 'h23nc', 1, name, {tid:ctx.it.evId, d:m[1]}); commit(); return true; }
  // Unsettled Mariner
  if ((m = l.match(/^counter that spell or ability unless its controller pays \{(\d+)\}$/))){
    const pid = ctx.it && (ctx.it.evPid || ctx.it.evDp); const it = stackAll().filter(x => x.pid === pid && pid !== MYPID).pop(); if (!it){ log(`${name}: nothing to counter`); return true; }
    S.ctr.push({id:rid(8), sid:it.sid, un:+m[1]}); if (S.ctr.length > 20) S.ctr.splice(0, S.ctr.length - 20); log(`${name}: ${it.nm} is countered unless ${nameOf(pid)} pays {${m[1]}}`); commit(); return true; }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim().replace(/^then /i, ''); const l = s.toLowerCase(); if (l && await doRound23HPre10(s, l, ctx)) return; return ds(s0, ctx); };
}

/* ---------- batch 11 ---------- */
{
  const tn = tname;
  tname = function(txt, name){ return tn(String(txt || '').replace(/\b(an?) ((?:[A-Z][a-z]+, )+or [A-Z][a-z]+) you control enters\b/g, (w, a, list) => `${a} ${list.replace(/,? or /, ', ').split(/, /).join('-')}-h23multi you control enters`), name); };
  const ct = classifyTrig;
  classifyTrig = function(w, c){ let m; if ((m = c.match(/^an? ([a-z-]+)-h23multi you control enters$/))) return {ev:'enter', subj:'any', ctl:'you', desc:'', h23types:m[1].split('-').map(cap)}; return ct(w, c); };
  const oe = onEnter;
  onEnter = function(c, from, o = {}){ const r = oe(c, from, o); try { if (c && S && S.h23landTap === turnStr() && isLand(c.k) && S.bf.includes(c)) c.tap = true; } catch {} return r; };
  // "cast one of them" groups: once one is cast, the others lose the permission
  const bc = beginCast;
  beginCast = async function(c, zone, ...a){ const g = c && c.h23grp; const r = await bc.call(this, c, zone, ...a); try { if (g && !S.ex.includes(c)) S.ex.forEach(x => { if (x.h23grp === g && x !== c){ delete x.mayPlay; delete x.h23grp; } }); } catch {} return r; };
}
async function doRound23HPre11(s, l, ctx){
  let m; const name = ctx.name; const full = tname(String(ctx.full || ''), name).toLowerCase(); const srcC = srcCardOf(ctx);
  if ((m = l.match(/^airbend target (.+)$/))){ await doSentence('Airbend up to one target ' + s.slice(s.length - m[1].length), ctx); return true; }
  if ((m = l.match(/^(?:you may )?attach ~ to that creature$/))){ const id = ctx.it && ctx.it.evId; const c = S.bf.find(b => b.id === id); if (!srcC || !c || !S.bf.includes(srcC)) return true; if (!UI.dry && !(await askYes(`${name}: attach to ${cname(c)}?`, 'Attach', "Don't"))) return true; srcC.att = {pid:MYPID, id:c.id}; log(`${name}: attached to ${cname(c)}`); commit(); return true; }
  if ((m = l.match(/^if that enchantment is an aura, you may attach it to the token$/))){
    const a = S.bf.find(b => b.id === (ctx.it && ctx.it.evId)); const tk = ctx.lastCardId != null ? S.bf.find(b => b.id === ctx.lastCardId) : S.bf.filter(b => b.tok && isCreatureCard(b)).pop();
    if (!a || !tk || !/\bAura\b/.test(typeOf(a))) return true; if (!UI.dry && !(await askYes(`${name}: attach ${cname(a)} to the token?`, 'Attach', "Don't"))) return true; a.att = {pid:MYPID, id:tk.id}; log(`${name}: attached ${cname(a)} to ${cname(tk)}`); commit(); return true; }
  // Teferi, Who Slows the Sunset
  if ((m = l.match(/^choose up to one target artifact, up to one target creature, and up to one target land$/))){ ctx.h23tws = [h23t(ctx), h23t(ctx), h23t(ctx)].flat(); return true; }
  if (ctx.h23tws && /^untap the chosen permanents you control$/.test(l)){ ctx.h23tws.filter(t => t.pid === MYPID).forEach(t => applyTo(t, {op:'untap', src:name})); return true; }
  if (ctx.h23tws && /^tap the chosen permanents you don't control$/.test(l)){ ctx.h23tws.filter(t => t.pid !== MYPID).forEach(t => applyTo(t, {op:'tap', src:name})); commit(); return true; }
  // Old Stickfingers
  if ((m = l.match(/^reveal cards from the top of your library until you reveal x creature cards$/))){
    const x = (ctx.it && (ctx.it.evX ?? ctx.it.x)) || (srcC && srcC.xv) || 0; const rev = []; let n = 0; const crs = [];
    while (S.lib.length && n < x){ const c = S.lib.shift(); if (isCreatureCard(c)){ crs.push(c); n++; } else rev.push(c); }
    crs.forEach(c => S.gy.push(c)); shuffle(rev); S.lib.push(...rev); log(`${name}: revealed ${crs.length + rev.length}, ${crs.length} creature card${crs.length === 1 ? '' : 's'} into the graveyard`); ctx.h23osf = true; commit(); return true; }
  if (ctx.h23osf && /^(put all creature cards revealed this way into your graveyard|put the rest on the bottom of your library in a random order)$/.test(l)) return true;
  // Nahiri's Lithoforming
  if ((m = l.match(/^sacrifice x lands$/))){ const x = h23n('x', ctx); const lands = S.bf.filter(c => isLand(c.k)); const n = Math.min(x, lands.length);
    const ids = n >= lands.length || UI.dry ? lands.slice(0, n).map(c => c.id) : await pickCards({title:`${name}: sacrifice ${n} land${n === 1 ? '' : 's'}`, cards:lands, min:n, max:n});
    (ids || []).forEach(id => { const c = S.bf.find(b => b.id === id); if (c) sacrificeOne(c); }); ctx.h23sacL = (ids || []).length; commit(); return true; }
  if ((m = l.match(/^for each land sacrificed this way, draw a card$/)) && (ctx.h23sacL != null || ctx.r23kSacN != null)){ const n = ctx.h23sacL ?? ctx.r23kSacN; if (n) draw(n); commit(); return true; }
  if ((m = l.match(/^(?:you may )?play x additional lands this turn$/))){ const x = h23n('x', ctx); S.xland = {t:turnStr(), n:((S.xland && S.xland.t === turnStr()) ? S.xland.n : 0) + x}; log(`${name}: may play ${x} additional land${x === 1 ? '' : 's'} this turn`); commit(); return true; }
  if ((m = l.match(/^lands you control enter tapped this turn$/))){ S.h23landTap = turnStr(); commit(); return true; }
  // Bandit's Talent
  if ((m = l.match(/^if (?:target|that) player has one or fewer cards in hand, they lose (\d+) life$/))){ const pid = (h23t(ctx)[0] || {}).pid || (ctx.it && ctx.it.evPid); if (!pid) return true; const hc = pid === MYPID ? S.hand.length : (OPP.get(pid)?.hc || 0); if (hc <= 1) await loseLife(pid, +m[1], name); else log(`${name}: ${nameOf(pid)} has ${hc} cards`); return true; }
  if ((m = l.match(/^(?:you )?draw an additional card for each opponent who has one or fewer cards in hand$/))){ const n = opponents().filter(p => (OPP.get(p.pid)?.hc || 0) <= 1).length; if (n) draw(n); log(`${name}: drew ${n} more`); commit(); return true; }
  // Chandra, Hope's Beacon
  if ((m = l.match(/^until the end of your next turn, you may cast an instant or sorcery spell from among those exiled cards$/))){
    const ids = (ctx.lastEx || []).filter(id => { const c = S.ex.find(x => x.id === id); return c && /\b(Instant|Sorcery)\b/.test(info(c.k)?.t || ''); }); if (!ids.length) return true;
    grantPlay(ids, {src:name, cast:true, next:true}); const g = rid(5); ids.forEach(id => { const c = S.ex.find(x => x.id === id); if (c) c.h23grp = g; }); return true; }
  if ((m = l.match(/^~ deals x damage to each of up to two targets$/))){ const x = h23n('x', ctx); h23t(ctx).forEach(t => dealDamage(t, x, ctx.k, srcC)); return true; }
  // Unstable Amulet
  if ((m = l.match(/^(?:you may )?play it until you exile another card with ~$/))){
    const id = (ctx.lastEx || []).slice(-1)[0]; if (id == null) return true; const key = 'ua' + (srcC ? srcC.id : name); S.h23ua = S.h23ua || {};
    const prev = S.ex.find(x => x.id === S.h23ua[key]); if (prev && prev.mayPlay) delete prev.mayPlay;
    const c = S.ex.find(x => x.id === id); if (c){ c.mayPlay = {t:turnStr(), adv:true, src:name, u0:S.untapN}; S.h23ua[key] = id; log(`${name}: may play ${cname(c)} until another card is exiled with it`); } commit(); return true; }
  // Waterbending Lesson
  if ((m = l.match(/^discard a card unless you waterbend \{(\d+)\}$/))){
    const gen = +m[1]; const helpers = S.bf.filter(x => !x.tap && !x.fd && (isCreatureCard(x) || /Artifact/.test(typeOf(x)))); const plan = payPlan(parseCost(`{${Math.max(0, gen - helpers.length)}}`), S.pool);
    const can = !plan.err; let v = 'd';
    if (!UI.dry && S.hand.length) v = await askChoice({title:`${name}: waterbend {${gen}} or discard a card?`, options:[{label:`Waterbend {${gen}}`, value:'w', disabled:!can}, {label:'Discard a card', value:'d'}]}); else if (!UI.dry && can) v = 'w';
    if (v === 'w'){ let tapN = 0; if (helpers.length){ const ids = await pickCards({title:`Waterbend {${gen}}: tap artifacts and creatures to pay {1} each`, cards:helpers, min:0, max:Math.min(gen, helpers.length)}); (ids || []).forEach(id => { const x = S.bf.find(b => b.id === id); if (x){ x.tap = true; tapN++; } }); }
      const left = gen - tapN; if (left){ const p = payPlan(parseCost(`{${left}}`), S.pool); if (p.err){ toast(p.err); v = 'd'; } else S.pool = p.pool; } if (v === 'w'){ log(`${name}: waterbent {${gen}}`); emit({type:'bend', cnt:1}); } }
    if (v === 'd' && S.hand.length){ const ids = S.hand.length === 1 || UI.dry ? [S.hand[0].id] : await pickCards({title:`${name}: discard a card`, cards:S.hand.slice(), min:1, max:1}); (ids || []).forEach(id => moveCard(id, 'gy')); }
    commit(); return true; }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim().replace(/^then /i, ''); const l = s.toLowerCase(); if (l && await doRound23HPre11(s, l, ctx)) return; return ds(s0, ctx); };
}

/* ---------- batch 12: manifest ---------- */
RQ_OPS.push('h23mdread');
{
  const ao = applyOp;
  applyOp = function(r, from){ if (r.op === 'h23mdread'){ (async () => { await runEffects('Manifest dread.', {name:r.src || 'manifest dread', k:null, it:{kind:'trigger'}, full:'Manifest dread.'}); commit(); })(); return; } return ao(r, from); };
}
async function doRound23HPre12(s, l, ctx){
  let m; const name = ctx.name;
  if ((m = l.match(/^manifest a card from your hand$/))){ if (!S.hand.length) return true; const ids = S.hand.length === 1 || UI.dry ? [S.hand[0].id] : await pickCards({title:`${name}: manifest a card from your hand`, cards:S.hand.slice(), min:1, max:1}); const c = S.hand.find(x => x.id === (ids || [])[0]); if (c && !UI.dry){ r21bManifest(c, name); log(`${name}: manifested a card from hand`); } commit(); return true; }
  if ((m = l.match(/^its controller manifests dread$/))){ const t = (ctx.lastT || [])[0]; const pid = t && t.pid; if (!pid) return true; if (pid === MYPID) await doSentence('Manifest dread', ctx); else { sendRq(pid, 'h23mdread', 0, name); log(`${name}: ${nameOf(pid)} manifests dread`); } commit(); return true; }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim().replace(/^then /i, ''); const l = s.toLowerCase(); if (l && await doRound23HPre12(s, l, ctx)) return; return ds(s0, ctx); };
}
