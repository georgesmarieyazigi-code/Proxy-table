
/* ===================== Rules engine — round 5: static rules, strict play, look-at-the-top, deck checker ===================== */

/* ---------- Static rules from every board (Narset, Rule of Law, Erebos, Teferi, …) ---------- */
const whoOf = s => /^(each opponent|your opponents|opponents)$/.test(s) ? 'opp' : s === 'you' ? 'you' : 'all';
const WHO = '(each opponent|your opponents|players|each player|you)';
const STATIC_RULES = [
  [new RegExp(`^${WHO} can't draw more than (one|two|three|\\d+) cards? each turn$`), m => ({kind:'drawMax', who:whoOf(m[1]), n:wn(m[2])})],
  [new RegExp(`^${WHO} can't draw cards$`), m => ({kind:'drawMax', who:whoOf(m[1]), n:0})],
  [new RegExp(`^${WHO} can't gain life$`), m => ({kind:'noGain', who:whoOf(m[1])})],
  [/^if (a player|an opponent) would gain life, that player gains no life instead$/, m => ({kind:'noGain', who:m[1] === 'a player' ? 'all' : 'opp'})],
  [new RegExp(`^${WHO} can't cast more than one (noncreature |creature |instant or sorcery |nonartifact )?spells? each turn$`), m => ({kind:'castMax', who:whoOf(m[1]), n:1, desc:(m[2] || '').trim()})],
  [/^(each opponent|your opponents) can cast spells only any time they could cast a sorcery$/, m => ({kind:'sorcOnly', who:'opp'})],
  [/^(each opponent|your opponents) can't cast spells during your turn$/, m => ({kind:'notOnTurn', who:'opp'})],
  [/^(each opponent|your opponents) can't cast spells or activate abilities of artifacts, creatures, or enchantments during your turn$/, m => ({kind:'notOnTurn', who:'opp', abil:true})],
  [new RegExp(`^${WHO} can't search libraries$`), m => ({kind:'noSearch', who:whoOf(m[1])})],
  [new RegExp(`^${WHO} can't cast spells from anywhere other than their hands?$`), m => ({kind:'handOnly', who:whoOf(m[1])})],
];
function staticRulesOf(k, fl){
  const a = info(k); if (!a) return []; const f = fl && a.back ? a.back : a; const out = [];
  for (const line of tname(f.o, f.n).toLowerCase().split('\n'))
    for (const sen of line.split(/\.\s*/)){ const s = sen.trim(); if (!s) continue;
      for (const [re, mk] of STATIC_RULES){ const m = s.match(re); if (m){ out.push({...mk(m), src:f.n}); break; } } }
  return out;
}
function staticRules(){
  if (!S) return []; const out = [];
  S.bf.forEach(b => { if (!b.fd) staticRulesOf(b.k, b.fl).forEach(r => out.push({...r, pid:MYPID})); });
  for (const [pid, s] of OPP) (s.bf || []).forEach(b => { if (b.k && !b.fd) staticRulesOf(b.k, b.fl).forEach(r => out.push({...r, pid})); });
  return out;
}
function rulesOn(kind, pid = MYPID){ return staticRules().filter(r => r.kind === kind && (r.who === 'all' || (r.who === 'opp' && r.pid !== pid) || (r.who === 'you' && r.pid === pid))); }
const drawnThisTurn = () => S.drawnT === turnStr() ? (S.drawn || 0) : 0;
function drawAllowed(){
  const rs = rulesOn('drawMax'); if (!rs.length) return {ok:true};
  const r = rs.reduce((a, b) => b.n < a.n ? b : a);
  return drawnThisTurn() < r.n ? {ok:true} : {ok:false, why:`${r.src}: you can't draw more than ${r.n} card${r.n === 1 ? '' : 's'} each turn`};
}
function canGain(){ const r = rulesOn('noGain')[0]; return r ? {ok:false, why:`${r.src}: you can't gain life`} : {ok:true}; }
function gainLife(n, src){
  if (n <= 0) return 0; const g = canGain();
  if (!g.ok){ log(`would gain ${n} life${src ? ' (' + src + ')' : ''} — ${g.why}`); return 0; }
  S.life += n; emit({type:'gain', cnt:1}); return n;
}
function castLimit(c, zone){
  const pn = phaseNow();
  for (const r of rulesOn('sorcOnly')) if (!sorceryTime()) return {ok:false, why:`${r.src}: you can only cast spells when you could cast a sorcery`};
  for (const r of rulesOn('notOnTurn')) if (pn.pid === r.pid) return {ok:false, why:`${r.src}: you can't cast spells during ${nameOf(r.pid)}'s turn`};
  for (const r of rulesOn('handOnly')) if (zone && zone !== 'hand') return {ok:false, why:`${r.src}: spells can only be cast from your hand`};
  for (const r of rulesOn('castMax')){
    if (r.desc && !descOk(c.k, r.desc)) continue;
    const n = (S.casts || []).filter(x => x.t === turnStr() && (!r.desc || descOk(x.k, r.desc))).length;
    if (n >= r.n) return {ok:false, why:`${r.src}: you can't cast more than one ${r.desc ? r.desc + ' ' : ''}spell each turn`};
  }
  return {ok:true};
}
function noteCast(c){
  const t = turnStr();
  S.casts = (S.casts || []).filter(x => x.t === t).concat({k:c.k, t}).slice(-2000);
  const before = (S.nextRed || []).length;
  S.nextRed = (S.nextRed || []).filter(r => r.t === t && !(!r.desc || descOk(c.k, r.desc)));
  if (before && S.nextRed.length < before) log(`used up the “next spell costs less” discount`);
}
function nextRedFor(c){ const t = turnStr(); return (S.nextRed || []).filter(r => r.t === t && (!r.desc || descOk(c.k, r.desc))); }

/* ---------- Effects text added in round 5 ---------- */
async function doRound5Text(s, l, ctx){
  let m;
  if ((m = l.match(/^the next (.*?)spell you cast this turn costs \{(x|\d+)\} less to cast(?:, where x is (.+))?$/))){
    let n;
    if (m[2] !== 'x') n = +m[2];
    else if (/cards looked at while scrying/.test(m[3] || '') && ctx.it && ctx.it.evX != null) n = ctx.it.evX;
    else n = await askNumber(`${ctx.name}: X = ? (${m[3] || 'X'})`, '', 1);
    if (n == null) return true;
    S.nextRed = (S.nextRed || []).concat({n, desc:m[1].trim(), t:turnStr(), src:ctx.name});
    log(`${ctx.name}: the next ${m[1] || ''}spell they cast this turn costs {${n}} less`); return true;
  }
  if ((m = l.match(/^(look at|reveal) the top (a|one|two|three|four|five|six|seven|eight|nine|ten|x|\d+) cards? of your library$/))){
    const n = await numOf(m[2], ctx, 'cards'); ctx.looked = true;
    const after = digRest(ctx, l);
    const spec = parseDig(after);
    if (spec){ await digTop(n, ctx, m[1] === 'reveal', spec); return true; }
    log(`${m[1] === 'reveal' ? 'revealed' : 'looked at'} the top ${n} card${n === 1 ? '' : 's'}${m[1] === 'reveal' ? ': ' + S.lib.slice(0, n).map(cname).join(', ') : ''}`);
    handWarn(after ? cap(after) : `Look at the top ${n}`, ctx);
    await lookTopAwait(n, `${ctx.name}: top`, null, after ? `The card says: ${cap(after).replace(/~/g, ctx.name)}` : 'Move each card where the card says.');
    return true;
  }
  if ((m = l.match(/^(?:you may )?shuffle(?: your library)?$/))){ if (ctx.skipShuffle) return true; if (/^you may/.test(l) && !(await askYes(`${ctx.name}: shuffle your library?`, 'Shuffle', 'Don\'t'))) return true; shuffleLib(); return true; }
  return false;
}
function digRest(ctx, l){
  const full = tname(String(ctx.full || ''), ctx.name || '').toLowerCase();
  if (ctx.digRestTxt) return ctx.digRestTxt;
  const key = l.replace(/^(look at|reveal) /, ''); const i = full.indexOf(key); if (i < 0) return '';
  let rest = full.slice(i + key.length).replace(/^[.,]\s*(then )?/, '');
  const nl = rest.indexOf('\n'); if (nl >= 0) rest = rest.slice(0, nl);
  return rest.trim();
}
function digOk(k, desc){
  if (!desc) return true;
  if (/,/.test(desc) && !/\b(or|and)\b/.test(desc.replace(/with .*$/, ''))){ const mv = (desc.match(/ with .*$/) || [''])[0]; return desc.replace(/ with .*$/, '').split(/,\s*/).every(d => descOk(k, d + mv)); }
  return descOk(k, desc);
}
function parseDig(r){
  if (!r) return null; let m; const spec = {take:null, rest:null};
  const DEST = '(into your hand|onto the battlefield(?: tapped and attacking| tapped)?|on top of your library|into your graveyard)';
  if ((m = r.match(new RegExp(`(you may )?reveal (an?|up to (\\w+)|any number of) (.+?) cards?((?: with [^.]*?)?) from among them(?: and put (?:it|them|those cards) ${DEST})?`)))){
    spec.take = {may:true, max:m[3] ? wn(m[3]) : /any number/.test(m[2]) ? 99 : 1, desc:(m[4] + m[5]).trim(), dest:m[6] || 'into your hand'};
  } else if ((m = r.match(new RegExp(`(you may )?put (up to (\\w+)|any number|one|two|three|an?) (?:of them|(?:(.+?) cards?((?: with [^.]*?)?) )?(?:from )?among them|of those cards) ${DEST}`)))){
    const upTo = !!m[3] || /any number/.test(m[2]);
    spec.take = {may:!!m[1] || upTo, max:m[3] ? wn(m[3]) : /any number/.test(m[2]) ? 99 : (wn(m[2]) || 1), desc:((m[4] || '') + (m[5] || '')).trim().replace(/^of /, ''), dest:m[6]};
  } else if ((m = r.match(new RegExp(`(you may )?put (?:(an?|one) )?(.+?) card from among them ${DEST}`)))){
    spec.take = {may:!!m[1], max:1, desc:m[3], dest:m[4]};
  }
  r = r.replace(/the rest of (?:the cards|them)\b/g, 'the rest');
  if ((m = r.match(/(?:put )?the rest (on the bottom of your library(?: in (a random|any) order)?|into your graveyard|back (?:on top )?in any order|on top of your library in any order)/)) || (m = r.match(/(exile) the rest/))){
    const w = m[1];
    spec.rest = /bottom/.test(w) ? (m[2] === 'any' ? 'bottomAny' : 'bottomRandom') : /graveyard/.test(w) ? 'gy' : w === 'exile' ? 'ex' : 'topAny';
  } else if (/put them back in any order|put those cards back in any order|put them back on top in any order/.test(r) && !spec.take) spec.rest = 'topAny';
  else if (/(put them|put those cards|the rest) on the bottom of your library in (a random|any) order/.test(r)) spec.rest = /random/.test(r) ? 'bottomRandom' : 'bottomAny';
  else if (/put them into your graveyard/.test(r) && !spec.take) spec.rest = 'gy';
  if (!spec.rest) return null;
  if (spec.take && /\bopponent\b|\bpiles?\b|separates?/.test(r)) return null;   // Fact or Fiction-style: by hand
  return spec;
}
async function digTop(n, ctx, reveal, spec){
  const top = S.lib.slice(0, n); if (!top.length){ log(`${ctx.name}: library is empty`); return; }
  log(`${reveal ? 'revealed' : 'looked at'} the top ${top.length} card${top.length === 1 ? '' : 's'}${reveal ? ': ' + top.map(cname).join(', ') : ''}`);
  let chosen = [];
  if (spec.take){
    const t = spec.take; const legal = top.filter(c => digOk(c.k, t.desc)); const other = top.filter(c => !legal.includes(c));
    const where = t.dest.replace('into your hand', 'into your hand').replace('your', 'your');
    const max = Math.min(t.max, legal.length); const min = t.may ? 0 : max;
    const restWhere = {bottomRandom:'on the bottom in a random order', bottomAny:'on the bottom in the order you choose next', gy:'into your graveyard', ex:'into exile', topAny:'back on top in the order you choose next'}[spec.rest];
    if (legal.length){
      const ids = await pickCards({title:`${ctx.name}: top ${top.length} of your library`, hint:`Pick ${t.may || max > 1 ? 'up to ' : ''}${max === 99 ? 'any number' : max}${t.desc ? ' ' + t.desc : ''} to put ${where}. The rest go ${restWhere}.`, cards:legal, extra:other, min, max, noneLabel:min ? undefined : 'Take nothing'});
      chosen = (ids || []).map(id => S.lib.find(c => c.id === id)).filter(Boolean);
    } else {
      await pickCards({title:`${ctx.name}: top ${top.length} of your library`, hint:`Nothing here can be taken${t.desc ? ' (needs ' + t.desc + ')' : ''}. They all go ${restWhere}.`, cards:[], extra:other, min:0, max:0, noneLabel:'OK'});
    }
    for (const c of chosen){
      if (/battlefield/.test(t.dest)){ moveCard(c.id, 'bf', {tapped:/tapped/.test(t.dest)}); const b = S.bf.find(x => x.id === c.id); if (b && /tapped/.test(t.dest)) b.tap = true; if (b && /attacking/.test(t.dest)) b.atk = attackDefFor(ctx); }
      else if (/graveyard/.test(t.dest)) moveCard(c.id, 'gy');
      else if (/top of your library/.test(t.dest)) { /* stays on top */ }
      else { const i = S.lib.findIndex(x => x.id === c.id); if (i >= 0){ const [cc] = S.lib.splice(i, 1); S.hand.push(cc); } }
    }
    if (chosen.length) ctx.lastT = chosen.map(c => ({t:'card', pid:MYPID, id:c.id, k:c.k, nm:cname(c)}));
    if (chosen.length) log(`put ${reveal || /battlefield/.test(t.dest) ? chosen.map(cname).join(', ') : chosen.length + ' card' + (chosen.length === 1 ? '' : 's')} ${t.dest}`);
  }
  const keepTop = spec.take && /top of your library/.test(spec.take.dest) ? chosen.map(c => c.id) : [];
  let rest = top.filter(c => !chosen.includes(c) && S.lib.some(x => x.id === c.id));
  rest = rest.filter(c => !keepTop.includes(c.id));
  if (!rest.length){ commit(); return; }
  const pull = () => rest.map(c => { const i = S.lib.findIndex(x => x.id === c.id); return S.lib.splice(i, 1)[0]; });
  if (spec.rest === 'bottomRandom'){ const cs = pull(); shuffle(cs); S.lib.push(...cs); log(`put ${cs.length} card${cs.length === 1 ? '' : 's'} on the bottom in a random order`); }
  else if (spec.rest === 'bottomAny'){
    let order = rest.map(c => c.id);
    if (rest.length > 1){ const ids = await pickCards({title:`${ctx.name}: order for the bottom`, hint:'Click them in the order you want them, top to bottom. They all go under the rest of your library.', cards:rest, min:rest.length, max:rest.length}); if (ids && ids.length === rest.length) order = ids; }
    const cs = pull(); S.lib.push(...order.map(id => cs.find(c => c.id === id)));
    log(`put ${cs.length} card${cs.length === 1 ? '' : 's'} on the bottom`);
  }
  else if (spec.rest === 'gy'){ rest.forEach(c => moveCard(c.id, 'gy')); }
  else if (spec.rest === 'ex'){ rest.forEach(c => moveCard(c.id, 'ex')); }
  else if (spec.rest === 'topAny'){
    if (rest.length > 1){ const ids = await pickCards({title:`${ctx.name}: order on top`, hint:'Click them in the order you want them, top card first.', cards:rest, min:rest.length, max:rest.length}); const cs = pull(); const order = ids && ids.length === rest.length ? ids : cs.map(c => c.id); S.lib.unshift(...order.map(id => cs.find(c => c.id === id))); }
    log(`put ${rest.length} card${rest.length === 1 ? '' : 's'} back on top`);
  }
  commit();
}

/* ---------- Strict play: no drawing, searching or moving cards unless a card says so ---------- */
UI.strict = store.get('pt.strict') !== false;
const fixing = () => Date.now() < (UI.fixUntil || 0);
const looseOk = () => !UI.strict || fixing();
function manualOk(what){
  if (looseOk() || UI.dry) { if (fixing()) log(`⚠ fixed by hand: ${what}`); return true; }
  toast(`${cap(what)} isn't allowed — only a card can make that happen. If the game got something wrong: Game ▾ → Fix something by hand.`);
  return false;
}
(function guardActs(){
  const G = (name, what, skip) => { const f = ACT[name]; if (!f) return; ACT[name] = function(el, e){ if (skip && skip(el)) return f.call(this, el, e); if (!manualOk(typeof what === 'function' ? what(el) : what)){ closeMenu(); return; } return f.call(this, el, e); }; };
  const preGame = () => !S || phaseNow().n === 0;
  G('draw', 'drawing a card'); G('drawN', 'drawing cards'); G('millN', 'milling'); G('lookTop', 'looking at your library'); G('search', 'searching your library');
  G('shuffle', 'shuffling your library', preGame); G('revealTop', 'revealing the top card'); G('topFd', 'putting the top card onto the battlefield');
  G('mull', 'a mulligan after the game started', preGame);
  G('mv', el => `moving ${cname(find(+el.dataset.id)[2] || {}) || 'a card'}`);
  G('mvz', 'moving a card', () => UI.modal && (UI.modal.dests || UI.modal.eng));
  G('play', 'putting a card onto the battlefield'); G('playFd', 'playing a card face down'); G('putBf', 'putting a card onto the battlefield without casting it');
  G('castFree', 'casting without paying'); G('playLand', 'playing an extra land', el => !el.dataset.force);
  G('openTokens', 'making tokens'); G('tok1', 'making a token'); G('mkTok', 'making tokens'); G('presetTok', 'making tokens'); G('copy', 'copying a card');
})();
function strictMenu(){
  const left = Math.max(0, Math.ceil(((UI.fixUntil || 0) - Date.now()) / 1000));
  return `<div class="sep"></div>` + mb('toggleStrict', `Strict rules (only cards move cards): <b>${UI.strict ? 'on' : 'off'}</b>`) +
    (UI.strict ? (fixing() ? mb('fixStop', `<b>Stop fixing by hand</b> (${left}s left)`) : mb('fixStart', 'Fix something by hand (2 minutes, everyone sees it)…')) : '') +
    mb('checkGame', 'Check my deck’s rules text…');
}
Object.assign(ACT, {
  toggleStrict(){ UI.strict = !UI.strict; store.set('pt.strict', UI.strict); log(`turned strict rules ${UI.strict ? 'on' : '⚠ off — they can move cards freely'}`); commit(); },
  fixStart(){ UI.fixUntil = Date.now() + 120000; log('⚠ is fixing something by hand for 2 minutes'); toast('Manual moves unlocked for 2 minutes. Everything you do is logged for the table.'); commit(); },
  fixStop(){ UI.fixUntil = 0; log('finished fixing by hand'); commit(); },
  checkDeck(){ runDeckCheck(); },
  checkGame(){ closeMenu(); if (!S || !S.deck){ toast('No deck loaded'); return; } runDeckCheck(S.deck); },
  copyCheck(){ const t = UI.modal && UI.modal.report; if (!t) return; navigator.clipboard?.writeText(t).then(() => toast('Copied — paste it to Claude'), () => toast('Select the text and copy it')); },
});

/* ---------- Deck checker: which rules text does the game understand? ---------- */
const STATIC_KNOWN = [
  /costs? \{\d+\} (more|less) to cast/, /^~ can be your commander$/, /can't be countered/, /^(enchant|equip)\b/,
  /\b(get|gets) [+\-−]\d+\/[+\-−]\d+(?: and (?:have|has) [a-z ,]+)?$/, /enters tapped/, /^if you don't, it enters tapped/, /would put one or more counters/, /^whenever you tap a nonland permanent for mana/, /\b(have|has) (flying|haste|trample|vigilance|lifelink|deathtouch|reach|menace|first strike|double strike|hexproof|indestructible|shroud|undying|persist|ward|protection)/,
  /can't be the target of/, /^~ enters (the battlefield )?tapped/, /^as ~ enters/, /enters with .* counters? on it/, /doesn't untap during/,
  /^~ can't (block|attack)/, /attacks each combat if able/, /can't be blocked/, /can block only creatures with flying/, /you have no maximum hand size/,
  /if an effect would create one or more tokens/, /if one or more .*counters would be put/, /twice that many/, /if a source would deal damage/, /prevent all .*damage/,
  /^you may play an additional land/, /^(defender|flying|haste)$/, /^\(.*\)$/, /^activate only/, /^(split second|flash|cascade|convoke|delve|storm)$/,
  /each (spell|creature) spell/, /^(equipped|enchanted) (creature|permanent) (gets|has|have|can't attack|can't block|doesn't untap)/, /enter(?: the battlefield)? as a copy of/, /^(affinity for|delve|convoke)/, /^spells your opponents cast/, /^~ has (flying|haste|trample)/, /^you may cast ~ from your graveyard/,
];
function lineKind(line){
  if (/^(when|whenever|at) /i.test(line)) return 'trigger';
  if (/^(I|II|III|IV|V|VI|VII)(, (I|II|III|IV|V|VI|VII))* — /.test(line)) return 'chapter';
  if (/^[+−\-]?\d+:|^[+−\-]X:|^0:/.test(line)) return 'loyalty';
  if (/^[^:"•]+:\s/.test(line) && /\{|^(sacrifice|pay|discard|remove|exile|tap|return)\b/i.test(line.split(':')[0])) return 'ability';
  if (/^choose (one|two|one or more|any number)/i.test(line)) return 'modal';
  return 'other';
}
const KW_EXTRA = /^(ninjutsu|commander ninjutsu|partner|partner with [a-z ,']+|choose a background|friends forever|eminence|foretell|morph|megamorph|disguise|cloak|cascade|storm|unearth|disturb|jump-start|retrace|intimidate|fear|shadow|horsemanship|[a-z]+walk|infect|wither|partner|vigilance)\b/i;
function keywordsOnly(l){ return l.split(/,\s*/).every(w => KW_LINE.test(w.trim()) || KW_EXTRA.test(w.trim())); }
function staticKnown(l){
  const x = l.toLowerCase().replace(/\.$/, '');
  if (STATIC_RULES.some(([re]) => x.split(/\.\s*/).every(s => !s || re.test(s.trim()) || STATIC_KNOWN.some(r => r.test(s.trim()))))) return true;
  return x.split(/\.\s*/).every(s => !s.trim() || STATIC_KNOWN.some(r => r.test(s.trim())));
}
async function dryEffects(text, k, name, spell){
  const saved = S; const misses = [];
  UI.dry = misses;
  try {
    S = saved ? JSON.parse(JSON.stringify(saved)) : newState();
    if (!S.lib.length) S.lib = Array.from({length:10}, (_, i) => ({id:900000 + i, k}));
    S.turn = [1, MYPID, 0]; S.ph = [1, 3, 0];
    const run = runEffects(text, {k, name, full:text, it:{kind:spell ? 'spell' : 'ability', evX:2, x:2, sid:'dry', evDp:'dry-opp', evId:1, evPid:'dry-opp', evN:2}, tgts:null});
    await Promise.race([run, new Promise(r => setTimeout(r, 4000))]);
  } catch (e){ misses.push(String(text)); }
  finally { S = saved; UI.dry = null; }
  return misses;
}
async function dryAll(text, k, name, spell){
  const md = parseModes(text); if (!md) return dryEffects(text, k, name, spell);
  const out = []; for (let i = 0; i < md.opts.length; i++) (await dryEffects(modeText(md, [i]), k, name, spell)).forEach(x => out.includes(x) || out.push(x));
  return out;
}
async function checkCard(k){
  const a = info(k); if (!a) return {name:k, issues:[{kind:'data', text:'card data not loaded'}]};
  const faces = a.lay === 'split' && a.faces ? a.faces : a.lay === 'adventure' && a.faces ? [a, a.faces[1]] : a.back ? [a, a.back] : [a]; const issues = []; let ok = 0;
  for (const f of faces){
    const isSpell = /\b(instant|sorcery)\b/i.test(f.t || '');
    const lines = []; for (const x0 of tname(f.o, f.n).split('\n')){ const x = x0.trim(); if (!x) continue; if (/^•/.test(x) && lines.length) lines[lines.length - 1] += '\n' + x; else lines.push(x); }
    if (isSpell){
      const body = lines.filter(l => !keywordsOnly(l) && lineKind(l) !== 'trigger').join('\n');
      if (body){ const cs = counterSpec(tname(f.o, f.n)); const ms = (await dryAll(body.replace(/~/g, f.n), k, f.n, true)).filter(t => !(cs && /^counter target/i.test(t))); ms.length ? ms.forEach(t => issues.push({kind:'effect', text:t})) : ok++; }
      continue;
    }
    for (const l of lines){
      const kind = lineKind(l); const t = l.replace(/~/g, f.n);
      if (keywordsOnly(l)){ ok++; continue; }
      if (kind === 'modal'){ const ms = await dryAll(t, k, f.n); ms.length ? ms.forEach(x => issues.push({kind:'effect', text:x, where:t})) : ok++; continue; }
      if (kind === 'trigger' && staticKnown(l)){ ok++; continue; }
      if (kind === 'trigger'){
        const m = l.match(/^(when|whenever|at) (.+?), ([\s\S]+)$/i);
        const cl = m && (/^you cast (?:this spell|~)$/i.test(m[2].trim()) ? {ev:'cast'} : classifyTrig(m[1].toLowerCase(), m[2].toLowerCase().trim()));
        if (!cl){ issues.push({kind:'trigger', text:t}); continue; }
        const ms = await dryAll(m[3].replace(/~/g, f.n), k, f.n);
        ms.length ? ms.forEach(x => issues.push({kind:'effect', text:x, where:t})) : ok++;
        continue;
      }
      if (kind === 'chapter' || kind === 'loyalty' || kind === 'ability'){
        const eff = kind === 'chapter' ? l.replace(/^[IVX, ]+ — /, '') : l.slice(l.indexOf(':') + 1).trim();
        if (/^add\b/i.test(eff)){ ok++; continue; }
        const ms = await dryAll(eff.replace(/~/g, f.n), k, f.n);
        ms.length ? ms.forEach(x => issues.push({kind:'effect', text:x, where:t})) : ok++;
        continue;
      }
      if (staticKnown(l)) ok++; else issues.push({kind:'static', text:t});
    }
  }
  return {name:a.n, ok, issues};
}
async function runDeckCheck(deck){
  deck = deck || LOBBY.deck; if (!deck){ toast('Load a deck first'); return; }
  const keys = [...new Set([...deck.cmd, ...deck.main.map(e => e.k)])].filter(k => !isLand(k) || (info(k)?.o || '').length > 40);
  openModal({type:'check', title:'Checking rules text…', done:0, total:keys.length, rows:[]});
  const rows = [];
  for (const k of keys){
    rows.push(await checkCard(k));
    if (UI.modal && UI.modal.type === 'check'){ UI.modal.done = rows.length; if (rows.length % 5 === 0) renderModal(); }
    else return;
  }
  const bad = rows.filter(r => r.issues.length);
  const label = {static:'Passive text the game may ignore', trigger:'Trigger it can’t detect', effect:'Effect it can’t do', modal:'“Choose one” (pick by hand)', data:'No card data'};
  const report = `Proxy Table rules check — ${deck.name || LOBBY.deckName || 'deck'}: ${rows.length} cards, ${rows.length - bad.length} fully understood, ${bad.length} with gaps.\n\n` +
    bad.map(r => `${r.name}\n` + r.issues.map(i => `  - [${label[i.kind]}] ${i.text}${i.where && i.where !== i.text ? `  (in: ${i.where})` : ''}`).join('\n')).join('\n\n');
  if (UI.modal && UI.modal.type === 'check'){ Object.assign(UI.modal, {title:'Rules text check', rows, bad, report, finished:true, label}); renderModal(); }
}
function renderCheckModal(m){
  if (!m.finished) return {title:m.title, body:`<p class="hint">Reading every card the way the game will… ${m.done} of ${m.total}</p>`};
  const head = `<button class="btn small primary" type="button" data-act="copyCheck">Copy the report</button>`;
  const body = `<p class="hint">${m.rows.length - m.bad.length} of ${m.rows.length} cards are fully understood. The ${m.bad.length} below have text the game can't do by itself yet: in a game it will show a “Do this by hand” box for them. Copy the report and paste it to Claude to go through them one by one.</p>` +
    m.bad.map(r => `<div class="chkcard"><b>${esc(r.name)}</b>${r.issues.map(i => `<div class="chkline"><span class="chktag t-${i.kind}">${esc(m.label[i.kind])}</span> ${manaHTML(i.text)}</div>`).join('')}</div>`).join('');
  return {title:m.title, head, body};
}

/* ---------- Dry-run guards: nothing leaves the sandbox while checking ---------- */
(function dryGuards(){
  const wrap = (fn, alt) => (...a) => UI.dry ? alt(...a) : fn(...a);
  emit = wrap(emit, () => {}); log = wrap(log, () => {}); toast = wrap(toast, () => {}); commit = wrap(commit, () => {});
  publish = wrap(publish, () => {}); queueSave = wrap(queueSave, () => {}); renderStackPanel = wrap(renderStackPanel, () => {});
  ensureTokens = wrap(ensureTokens, async () => {}); searchToken = wrap(searchToken, async () => null);
  const om = openModal;
  openModal = m => {
    if (!UI.dry) return om(m);
    if (m.type === 'choice' && m.resolve){ const o = (m.options || []).find(x => !x.disabled); return m.resolve(o ? o.value : null); }
    if (m.type === 'pick' && m.resolve) return m.resolve((m.cards || []).slice(0, m.min || 0).map(c => c.id));
    if (m.resolve) return m.resolve(m.type === 'target' ? [] : null);
    if (m.run) return m.run(m.def ?? 1);
    if (m.onClose) return m.onClose();
  };
  const hw = handWarn; handWarn = (s, ctx) => { if (UI.dry){ UI.dry.push(ctx && ctx.name ? String(s).replace(/~/g, ctx.name) : String(s)); return; } return hw(s, ctx); };
})();
