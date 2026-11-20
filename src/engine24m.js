/* ===================== Rules engine — round 24M: the stack — copying, exchanging, stealing and imprinting spells and abilities ===================== */
// Everything here runs on the client of the player who controls the effect; things that belong to another player's
// stack item are done on THEIR client through requests (m24* ops, plus r21spellGive / r21ctr from engine21e).
const M24 = {};
const m24Re = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const m24Low = (s, ctx) => { let l = String(s).toLowerCase(); const n = ctx && ctx.name; if (n && n.length > 2){ [n, n.split(',')[0], n.split(' // ')[0]].sort((a, b) => b.length - a.length).forEach(x => { if (x && x.length > 2) l = l.split(x.toLowerCase()).join('~'); }); } return l; };
const m24Who = x => x.pid === MYPID ? 'your' : nameOf(x.pid) + "'s";
const m24Label = x => `${x.nm} — ${m24Who(x)} ${x.kind === 'spell' ? 'spell' : 'ability'}${x.tgtNm ? ' → ' + x.tgtNm : ''}`;
const m24TextOf = x => x ? (x.pid === MYPID && x.it ? String(x.it.txt || '') : String(x.txt || '')) : '';
const m24IsIS = x => /\b(Instant|Sorcery)\b/.test(info(x.k)?.t || x.ty || '');

// ---------- which stack item does "that spell / that ability / it" mean ----------
function m24Ref(ctx, o = {}){
  const it = (ctx && ctx.it) || {}; const all = stackAll().filter(x => !it.sid || x.sid !== it.sid);
  for (const sid of [ctx && ctx.m24sid, it.m24ref, it.tgt, it.copyOf, it.m24sid, it.evDp]){ if (!sid || typeof sid !== 'string') continue; const x = all.find(i => i.sid === sid); if (x) return x; }
  if (o.ability) return null;
  if (it.evk){ const x = all.filter(i => i.kind === 'spell' && i.k === it.evk && (!it.evPid || i.pid === it.evPid)).pop(); if (x) return x; }
  return null;
}
// ---------- copying ----------
function m24NoCopy(x){ return /\bthis (spell|ability) can't be copied\b|\b~ can't be copied\b/i.test(tname(info(x.k)?.o || '', info(x.k)?.n || '')) && (x.kind === 'spell' || /can't be copied/i.test(m24TextOf(x))); }
const m24Twins = () => { try { return rulesOn('m24twin').length; } catch { return 0; } };
// put n copies of stack item x on MY stack. o.newT: 'may' (default) | 'no' | 'must'; o.tgts: fixed targets for every copy
async function m24Copy(x, ctx, o = {}){
  if (!x){ if (!UI.dry) log(`${ctx.name}: nothing to copy (it left the stack)`); return []; }
  if (m24NoCopy(x)){ log(`${ctx.name}: ${x.nm} can't be copied`); return []; }
  let n = Math.max(0, Math.min(o.n == null ? 1 : o.n, 30)); if (!n) return [];
  if (x.kind === 'spell' && !o.noTwin){ const tw = m24Twins(); if (tw){ n += tw; log(`${ctx.name}: Twinning Staff — ${tw} additional cop${tw === 1 ? 'y' : 'ies'}`); } }
  const mine = x.pid === MYPID && x.it; const out = [];
  let modes = mine && Array.isArray(x.it.modes) ? x.it.modes : null; const md = parseModes(x.txt || '');
  let txt = mine ? String(x.it.txt || x.txt) : x.txt;
  if (!mine && md){ const idx = await askModes(md, `${x.nm} (copy)`); modes = idx || []; txt = modeText(md, modes); }
  let same = 'each';
  if (n > 1 && !o.tgts && targetSpecs(txt).length && o.newT !== 'no') same = await askChoice({title:`${ctx.name}: ${n} copies of ${x.nm}`, options:[...(mine ? [{label:'Same targets for every copy', value:'same'}] : []), {label:'Choose targets for each copy', value:'each'}]}) || 'each';
  for (let i = 0; i < n; i++){
    const cp = {sid:rid(6), o:nextO(), kind:x.kind === 'spell' ? 'spell' : 'ability', k:x.k, nm:`${String(x.nm).replace(/ \(copy\)$/, '')} (copy)`, txt, x:x.x || 0, mv:x.mv || 0, ty:x.ty || info(x.k)?.t || '', copy:true,
      srcId:mine ? x.it.srcId ?? null : null, modes, tgt:mine ? x.it.tgt || null : x.tgt || null, tgtNm:x.tgtNm || ''};
    if (o.m24nl) cp.m24nl = 1; if (o.haste) cp.m24haste = 1; if (o.sacEnd) cp.m24sac = 1;
    let tg = o.tgts || (mine ? x.it.tgts : null);
    if (!o.tgts && targetSpecs(txt).length){
      const ask = !tg || o.newT === 'must' || (o.newT !== 'no' && same === 'each' && (i === 0 || same === 'each') && await askYes(`${ctx.name}: choose new targets for the copy of ${x.nm}?`, 'Choose new targets', 'Keep the targets'));
      if (ask){ const t = await chooseTargets(txt, {pid:MYPID, col:info(x.k)?.c, types:info(x.k)?.t, id:cp.srcId}, `${cp.nm}: targets`); if (t) tg = t; }
    }
    if (tg){ cp.tgts = tg; cp.tgtNm = tgtLabel(tg); }
    S.stk.push(cp); S.pass = 's:' + cp.sid; out.push(cp);
  }
  M24.lastCopies = out;
  log(`${ctx.name}: copied ${x.nm}${n > 1 ? ' ' + n + ' times' : ''}${out[0] && out[0].tgtNm ? ' → ' + out[0].tgtNm : ''}`); commit();
  return out;
}
// copy the spell that is resolving right now (Chain Lightning, Sevinne's Reclamation)
async function m24CopySelf(ctx, o = {}){
  const it = ctx.it; if (!it || it.kind !== 'spell') return [];
  const x = {...pubItem(it), pid:MYPID, it}; return m24Copy(x, ctx, {newT:'may', ...o});
}
// cast a copy of a card (Isochron Scepter, Mizzix's Mastery, Mnemonic Deluge …): a copy spell on my stack that counts as cast
async function m24CastCopy(k, ctx, o = {}){
  const a = info(k); if (!a || isLand(k)) return null;
  if (isPermType(a.t) && !o.perm){ /* copies of permanent cards become tokens when they resolve */ }
  let txt = a.o, modes = null; const md = parseModes(txt);
  if (md){ modes = await askModes(md, `${a.n} (copy)`); if (modes == null) return null; txt = modeText(md, modes); }
  let tgt = null; const cs = counterSpec(txt);
  if (cs){ const opts = stackAll().reverse().map(x => { const lg = counterLegal(x, cs); return {label:m24Label(x), value:x.sid, disabled:!lg.ok, why:lg.why || ''}; }); if (opts.some(q => !q.disabled)){ const v = await askChoice({title:`${a.n} (copy): what are you countering?`, options:opts}); if (v) tgt = stackAll().find(i => i.sid === v) || null; } }
  let tgts = null; if (targetSpecs(txt).length){ tgts = await chooseTargets(txt, {pid:MYPID, col:a.c, types:a.t, id:null}, `${a.n} (copy)`); if (tgts == null) tgts = null; }
  let x = 0; if (parseCost(a.m || '').x){ x = o.x || 0; }
  const it = {sid:rid(6), o:nextO(), kind:'spell', k, nm:`${a.n} (copy)`, txt, mv:a.mv || 0, ty:a.t, copy:true, modes, tgt:tgt ? tgt.sid : null, tgtNm:tgt ? tgt.nm : tgts ? tgtLabel(tgts) : '', tgts, x, from:'copy', m24cast:1};
  S.stk.push(it); S.pass = 's:' + it.sid;
  log(`${ctx.name}: cast a copy of ${a.n}${o.free !== false ? ' without paying its mana cost' : ''}${it.tgtNm ? ' targeting ' + it.tgtNm : ''}`);
  emit({type:'cast', k, id:0, nth:(S.casts || []).filter(q => q.t === turnStr()).length}); commit();
  return it;
}
// ---------- countering / moving other players' stack items ----------
function m24Counter(x, ctx, un){
  if (!x) return false;
  if (x.kind === 'spell' && x.uc){ log(`${ctx.name}: ${x.nm} can't be countered`); return false; }
  if (x.pid === MYPID){ if (un) addUnlessPrompt(x.it, un, MYPID); else counterMine(x.it, MYPID); }
  else { S.ctr.push({id:rid(8), sid:x.sid, un:un || 0}); if (S.ctr.length > 20) S.ctr.splice(0, S.ctr.length - 20); }
  log(un ? `${ctx.name}: ${x.nm} is countered unless ${x.pid === MYPID ? 'I pay' : nameOf(x.pid) + ' pays'} {${un}}` : `${ctx.name}: countered ${x.nm}`);
  if (!un && x.kind === 'spell') emit({type:'countered', k:x.k, id:0});
  commit(); return true;
}
// move a spell off the stack on its controller's client. how: hand | top | bottom | tuck (owner chooses) | exile | delay:N (exiled with N time counters, suspended)
function m24MoveLocal(it, how, by, src){
  const i = S.stk.indexOf(it); if (i < 0) return false;
  S.stk.splice(i, 1); UI.r21gone ||= {}; UI.r21gone[it.sid] = it;
  const c = it.kind === 'spell' && !it.copy ? it.card : null;
  if (!c){ log(`${it.nm} left the stack (${src})`); commit(); return true; }
  faceRestore(c);
  if (c.r21 && c.own){ sendRq(c.own.pid, 'back', 0, cname(c), {ref:c.own.ref, d:how === 'hand' ? 'hand' : /^(top|tuck|bottom)$/.test(how) ? 'lib' : how.startsWith('delay') || how === 'exile' ? 'ex' : 'gy'}); log(`${cname(c)} goes back to ${nameOf(c.own.pid)} (${src})`); commit(); return true; }
  if (how === 'hand'){ S.hand.push(c); log(`${cname(c)} was returned to my hand (${src})`); }
  else if (how === 'top'){ S.lib.unshift(c); log(`${cname(c)} was put on top of my library (${src})`); }
  else if (how === 'bottom'){ S.lib.push(c); log(`${cname(c)} was put on the bottom of my library (${src})`); }
  else if (how === 'exile'){ c.fl = false; S.ex.push(c); log(`${cname(c)} was exiled from the stack (${src})`); }
  else if (how.startsWith('delay')){ const n = +how.split(':')[1] || 3; c.fl = false; c.r21bsus = 1; c.nc = {...(c.nc || {}), time:n}; c.co = n; S.ex.push(c); log(`${cname(c)} was exiled with ${n} time counters on it — it has suspend (${src})`); }
  commit(); return true;
}
async function m24Move(x, how, ctx){
  if (!x) return false;
  if (x.pid === MYPID){
    if (how === 'tuck'){ const v = UI.dry ? 'top' : await askChoice({title:`${ctx.name}: put ${x.nm} on the top or bottom of your library?`, options:[{label:'Top', value:'top'}, {label:'Bottom', value:'bottom'}]}); how = v || 'top'; }
    return m24MoveLocal(x.it, how, MYPID, ctx.name);
  }
  sendRq(x.pid, 'm24mv', 0, ctx.name, {d:`${x.sid}|${how}`});
  log(`${ctx.name}: ${x.nm} (${nameOf(x.pid)}'s) — ${how === 'hand' ? "returned to its owner's hand" : how === 'exile' ? 'exiled' : how === 'tuck' ? 'its owner puts it on the top or bottom of their library' : how.startsWith('delay') ? 'exiled with time counters (suspend)' : 'moved'}`); commit(); return true;
}
// gain control of another player's spell (via engine21e's lending), optionally choose new targets
async function m24Steal(x, ctx, o = {}){
  if (!x || x.kind !== 'spell'){ log(`${ctx.name}: no spell to take`); return null; }
  if (x.pid === MYPID) return x.it || null;
  if (UI.dry) return null;
  const res = await r21Ask(x.pid, 'r21spellGive', 0, ctx.name, {d:x.sid}); const c = res.ids.map(id => S.ex.find(e => e.id === id)).find(Boolean);
  if (!c){ log(`${ctx.name}: ${x.nm} is no longer on the stack`); return null; }
  S.ex.splice(S.ex.indexOf(c), 1); c.r21sent = 1; sendRq(c.own.pid, 'r21cast', 0, cname(c), {ref:c.own.ref});
  const a = info(c.k); let tgts = null; const old = String(res.d || '').split(';').filter(Boolean).map(r21DecT).filter(t => t.t !== 'stack');
  if (old.length) tgts = [old];
  if (o.tgts) tgts = o.tgts;
  else if (o.newT && targetSpecs(a.o).length && (o.newT === 'must' || !tgts || await askYes(`${ctx.name}: choose new targets for ${a.n}?`, 'Choose new targets', 'Keep them'))){ const t = await chooseTargets(a.o, {pid:MYPID, col:a.c, types:a.t, id:c.id}, `${a.n}: new targets`); if (t) tgts = t; }
  const it = {sid:rid(6), o:x.o, kind:'spell', card:c, k:c.k, nm:a.n, txt:a.o, mv:x.mv || a.mv || 0, ty:a.t, tgts, tgtNm:tgts ? tgtLabel(tgts) : '', x:x.x || 0, from:'stack'};
  S.stk.push(it); log(`${ctx.name}: gained control of ${a.n}${it.tgtNm ? ' → ' + it.tgtNm : ''}`); commit();
  return it;
}
// give one of my permanents to another player / ask another player to give theirs to a third player
function m24GivePerm(t, to, src){
  if (!t || !to || t.pid === to) return;
  if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c) giveAway(c, to, {}); }
  else if (to === MYPID) sendRq(t.pid, 'steal', 0, src, {tid:t.id});
  else sendRq(t.pid, 'm24give', 0, src, {tid:t.id, d:to});
}
// choose a stack item now (no targets were chosen when it was put on the stack)
async function m24PickStack(ctx, title, ok, o = {}){
  if (UI.dry) return null;
  const opts = stackAll().reverse().filter(x => !(ctx.it && x.sid === ctx.it.sid)).map(x => { const why = ok(x) || ''; return {label:m24Label(x), value:x.sid, disabled:!!why, why}; });
  if (!opts.some(q => !q.disabled)){ log(`${ctx.name}: nothing on the stack to choose`); return null; }
  if (o.upTo) opts.push({label:'Nothing', value:''});
  const v = await askChoice({title:`${ctx.name}: ${title}`, options:opts}); return v ? stackAll().find(i => i.sid === v) || null : null;
}
async function m24PickMany(ctx, title, ok){
  const got = []; if (UI.dry) return got;
  for (let g = 0; g < 12; g++){
    const opts = stackAll().reverse().filter(x => !(ctx.it && x.sid === ctx.it.sid) && !got.some(y => y.sid === x.sid)).map(x => { const why = ok(x) || ''; return {label:m24Label(x), value:x.sid, disabled:!!why, why}; });
    if (!opts.some(q => !q.disabled)) break;
    const v = await askChoice({title:`${ctx.name}: ${title}${got.length ? ` (${got.length} chosen)` : ''}`, options:[...opts, {label:got.length ? 'Done' : 'None', value:''}]});
    if (!v) break; const x = stackAll().find(i => i.sid === v); if (x) got.push(x);
  }
  return got;
}
// ---------- legality of "copy target … ability you control from a … source" ----------
function m24CopyWhy(x, spec, selfSid){
  if (!x) return 'gone'; if (selfSid && x.sid === selfSid) return 'itself';
  const t = String(spec || '').toLowerCase(); const isAb = x.kind !== 'spell';
  if (/\bspell\b/.test(t) && !/\bability\b/.test(t)){
    if (!isAb){ const pre = t.replace(/\bspells?\b.*$/, '').replace(/\btarget\b|\bany number of\b/g, '').replace(/\s+/g, ' ').trim().replace(/ and\/or /, ' or ');
      if (pre && !descOk(x.k, pre)) return `not a ${pre} spell`; } else return 'not a spell';
  } else if (/\bability\b/.test(t)){
    if (!isAb) return 'not an ability';
    if (/^activated ability|[^d] activated ability/.test(t) && !/triggered/.test(t) && x.kind !== 'ability') return 'not an activated ability';
    if (/triggered ability/.test(t) && !/activated/.test(t) && x.kind !== 'trigger') return 'not a triggered ability';
  }
  if (/you control/.test(t) && x.pid !== MYPID) return "you don't control it";
  if (/you don't control/.test(t) && x.pid === MYPID) return 'you control it';
  const a = info(x.k) || {};
  if (/from an enchantment source/.test(t) && !/\bEnchantment\b/.test(a.t || '')) return 'its source isn\'t an enchantment';
  if (/from a colorless source/.test(t) && (a.c || '').replace(/C/g, '')) return 'its source isn\'t colorless';
  if (/from an artifact or enchantment source/.test(t) && !/\b(Artifact|Enchantment)\b/.test(a.t || '')) return 'its source isn\'t an artifact or enchantment';
  if (/from another legendary source/.test(t)){
    if (!/\bLegendary\b/.test(a.t || '')) return 'its source isn\'t legendary';
    const sc = x.pid === MYPID && x.it && x.it.srcId != null ? S.bf.find(b => b.id === x.it.srcId) : null;
    if (/that's not a commander/.test(t) && sc && sc.cmd) return 'its source is a commander';
  }
  if (/with \{x\} in its mana cost/.test(t) && (x.kind !== 'spell' || !/\{X\}/.test(a.m || ''))) return 'no {X} in its mana cost';
  if (m24NoCopy(x) && /^copy/.test(t)) return "it can't be copied";
  return '';
}
// ---------- stack targets that are chosen when the ability is put on the stack ----------
const M24_STK = /\b(counter (?:up to one )?target|copy target|copy any number of target|exchange control of target [a-z ]*spell|gain control of target [a-z ]*spell|choose up to one target (?=creature spell or planeswalker spell))\b([^.]*)/i;
function m24StackSpec(txt){
  const t = String(txt || ''); const m = t.match(M24_STK); if (!m) return null;
  const verb = m[1].toLowerCase(); if (/any number/.test(verb)) return null;
  const rest = (verb.replace(/^(counter|copy|exchange control of|gain control of|choose) (up to one )?/, '') + m[2]).toLowerCase();
  if (!/\b(spell|ability)\b/.test(rest)) return null;
  return {verb, upTo:/up to one/.test(verb), choose:/^choose/.test(verb), spec:rest.replace(/^target /, ''), counter:/^counter/.test(verb)};
}
function m24StackWhy(x, sp, selfSid){
  if (sp.choose) return x.sid === selfSid ? 'itself' : x.kind !== 'spell' ? 'not a spell' : !descOk(x.k, 'creature or planeswalker') ? 'not a creature or planeswalker spell' : '';
  if (sp.counter){ const cs = counterSpec('counter target ' + sp.spec.replace(/ unless its controller pays .*$/, '')); if (x.sid === selfSid) return 'itself'; const lg = counterLegal(x, cs || {what:sp.spec}); if (!lg.ok) return lg.why || 'not legal'; return m24CopyWhy(x, sp.spec.replace(/^(spell|activated ability|triggered ability|spell, activated ability, or triggered ability|activated or triggered ability)\b/, m => m.includes('ability') ? 'ability' : 'spell'), selfSid) === 'not a spell' ? '' : (/you don't control/.test(sp.spec) && x.pid === MYPID ? 'you control it' : /from an artifact or enchantment source/.test(sp.spec) && !/\b(Artifact|Enchantment)\b/.test(info(x.k)?.t || '') ? "its source isn't an artifact or enchantment" : /with \{x\} in its mana cost/.test(sp.spec) && !/\{X\}/.test(info(x.k)?.m || '') ? 'no {X} in its mana cost' : ''); }
  return m24CopyWhy(x, sp.spec, selfSid);
}
async function m24PreStack(name, txt, selfSid){
  const sp = m24StackSpec(txt); if (!sp) return undefined;
  const opts = stackAll().reverse().filter(x => x.sid !== selfSid).map(x => { const why = m24StackWhy(x, sp, selfSid); return {label:m24Label(x), value:x.sid, disabled:!!why, why}; });
  if (!opts.some(q => !q.disabled)) return null;
  if (sp.upTo) opts.push({label:'No target', value:''});
  const v = await askChoice({title:`${name}: target ${sp.spec.replace(/ unless .*$/, '')}`, options:opts});
  return v ? stackAll().find(i => i.sid === v) || null : (sp.upTo ? false : null);
}

/* ---------- triggers: activating abilities ---------- */
EV_TYPES.push('m24act');
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){ const cc = String(c); let mm;
    if (/^an opponent activates an ability of an artifact$/.test(cc)) return {ev:'m24act', m24:'opp', subj:'any', ctl:'opp', desc:'artifact or creature or land'};   // Harsh Mentor (split at its first comma)
    if (/^you activate an ability(?:, if it isn't a mana ability)?$/.test(cc) || /^you activate an ability that isn't a mana ability$/.test(cc)) return {ev:'m24act', m24:'you', subj:'any', ctl:'you', desc:''};
    if (/^an ability of equipped creature is activated(?:, if it isn't a mana ability)?$/.test(cc)) return {ev:'m24act', m24:'equip', subj:'any', ctl:'you', desc:''};
    if ((mm = cc.match(/^an opponent activates an ability of an? (artifact, creature, or land|creature or land|artifact|creature|land|artifact or creature)(?: on the battlefield)?(?: that isn't a mana ability)?$/))) return {ev:'m24act', m24:'opp', subj:'any', ctl:'opp', desc:mm[1].replace(/, or /, ' or ').replace(/, /g, ' or ')};
    if (/^a player activates an ability(?: that isn't a mana ability)?$/.test(cc)) return {ev:'m24act', m24:'any', subj:'any', ctl:'any', desc:''};
    if (/^a sliver creature you control becomes the target of a spell or ability an opponent controls$/.test(cc)) return {ev:'r23kTgtd', subj:'any', ctl:'you', desc:'sliver creature', r23kTgt:true};
    if (/^you cast an instant or sorcery spell or activate an ability$/.test(cc)) return {ev:'m24act', evs:['cast'], m24:'unbound', subj:'any', ctl:'you', desc:'instant or sorcery'};
    return ct(w, c); };
  const sm = subjMatch;
  subjMatch = function(t, src, ev, pid){
    if (ev && ev.type === 'm24act'){
      if (t.m24 === 'you' || t.m24 === 'unbound') return pid === MYPID;
      if (t.m24 === 'any') return true;
      if (t.m24 === 'equip'){ if (pid !== MYPID) return false; const eq = S.bf.find(b => b.id === src.id); return !!(eq && eq.att && eq.att.pid === MYPID && eq.att.id === ev.id); }
      if (t.m24 === 'opp'){ if (pid === MYPID) return false; return !t.desc || descOk(ev.k, t.desc, {tok:ev.tok}); }
      return false;
    }
    return sm(t, src, ev, pid);
  };
  // the new ability's stack id travels in dp; x = 1 when its activation cost has {X}
  const fire = (c, it, ab) => { try { if (!UI.dry && it && c) emit({type:'m24act', k:c.k, id:c.id, tok:c.tok ? 1 : 0, dp:it.sid, x:/\{X\}/i.test(String(ab && ab.cost || '')) ? 1 : 0}); } catch (e){ console.warn(e); } };
  const aa = activateAbility;
  activateAbility = async function(c, ab){
    let pre;
    try {
      if (!UI.casting && !UI.dry && c && ab && ab.eff && !abilityReady(c, ab, false) && !/^counter target/i.test(ab.eff)){
        const sp = m24StackSpec(ab.eff);
        if (sp && !sp.counter){ pre = await m24PreStack(cname(c), ab.eff, null); if (pre === null){ toast(`Nothing on the stack ${cname(c)} can target`); return; } }
      }
    } catch (e){ console.warn(e); }
    const pw = c && isCreatureCard(c) ? (stats(c) || [0, 0])[0] : 0; const top0 = S.stk[S.stk.length - 1];
    const r = await aa(c, ab);
    const it = S.stk[S.stk.length - 1];
    if (it && it !== top0 && it.kind === 'ability' && it.srcId === c.id){
      it.m24pow = pw; if (pre){ it.tgt = pre.sid; it.tgtNm = pre.nm; }
      if (/can't be copied/i.test(ab.eff || '')) it.m24nc = 1;
      commit(); fire(c, it, ab);
    }
    return r;
  };
  const al = activateLoyalty;
  activateLoyalty = async function(c, i){ const top0 = S.stk[S.stk.length - 1]; const r = await al(c, i); const it = S.stk[S.stk.length - 1]; if (it && it !== top0 && it.kind === 'ability' && c && it.srcId === c.id) fire(c, it, null); return r; };
  // triggered abilities that target a spell or ability choose it as they are put on the stack (Mystic Snake, Strionic Resonator copies, Subtlety …)
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    const n0 = S.stk.length; const r = pt(src, t, ev, evPid);
    try {
      const it = S.stk.length > n0 ? S.stk[S.stk.length - 1] : null;
      if (it && ev && ev.type === 'm24act') it.m24sid = ev.dp || null;
      if (it && !UI.dry && !it.tgt && it.kind === 'trigger' && m24StackSpec(it.txt) && !/^(?:if|when you do)\b/i.test(it.txt)){
        it.hold = true; commit();
        (async () => { try {
          const x = await m24PreStack(it.nm, it.txt, it.sid);
          if (x){ it.tgt = x.sid; it.tgtNm = x.nm; log(`${it.nm} targets ${x.nm}`); }
          else if (x === null){ const i = S.stk.indexOf(it); if (i >= 0){ S.stk.splice(i, 1); log(`${it.nm}: no legal target on the stack — the trigger is removed`); } }
          else it.m24none = 1;
        } catch (e){ console.warn(e); } finally { it.hold = false; commit(); } })();
      }
    } catch (e){ console.warn(e); }
    return r;
  };
}

/* ---------- copies that need a target chosen late, the copyOf hand-off, Twinning Staff, "can't be copied" ---------- */
{
  const cti = copyTargetItem;
  copyTargetItem = async function(ctx){
    try {
      if (ctx && ctx.it && !ctx.it.tgt && ctx.it.copyOf) ctx = {...ctx, it:{...ctx.it, tgt:ctx.it.copyOf}};
      if (ctx && ctx.it && !ctx.it.tgt && !UI.dry){
        const full = String(ctx.full || ctx.it.txt || ''); const sp = m24StackSpec(full);
        const x = await m24PickStack(ctx, 'what are you copying?', y => sp ? m24StackWhy(y, sp, ctx.it.sid) : '');
        if (!x) return; ctx = {...ctx, it:{...ctx.it, tgt:x.sid}};
      }
      const orig = ctx && ctx.it && ctx.it.tgt ? stackAll().find(x => x.sid === ctx.it.tgt) : null;
      if (orig && m24NoCopy(orig)){ log(`${ctx.name}: ${orig.nm} can't be copied`); return; }
      if (orig && orig.pid === MYPID && orig.it && orig.it.m24nc){ log(`${ctx.name}: ${orig.nm} can't be copied`); return; }
      const r = await cti(ctx);
      if (orig && orig.kind === 'spell' && !M24.inMany){ const tw = m24Twins(); for (let i = 0; i < tw; i++){ log('Twinning Staff: an additional copy'); await cti(ctx); } }
      // a copy of my own ability keeps its source (707.10)
      if (orig && orig.pid === MYPID && orig.it && orig.kind !== 'spell'){ const cp = S.stk[S.stk.length - 1]; if (cp && cp.copy && cp.srcId == null) cp.srcId = orig.it.srcId ?? null; }
      return r;
    } catch (e){ console.warn(e); }
  };
  const cm = copyMany;
  copyMany = async function(ctx, n){
    if (ctx && ctx.it && !ctx.it.tgt && ctx.it.copyOf) ctx = {...ctx, it:{...ctx.it, tgt:ctx.it.copyOf}};
    const orig = ctx && ctx.it && ctx.it.tgt ? stackAll().find(x => x.sid === ctx.it.tgt) : null;
    if (orig && m24NoCopy(orig)){ log(`${ctx.name}: ${orig.nm} can't be copied`); return; }
    M24.inMany = (M24.inMany || 0) + 1;
    try { await cm(ctx, n); } finally { M24.inMany--; }
    if (orig && orig.kind === 'spell' && !M24.inMany){ const tw = m24Twins(); if (tw){ log(`Twinning Staff: ${tw} additional cop${tw === 1 ? 'y' : 'ies'}`); M24.inMany++; try { await cm(ctx, tw); } finally { M24.inMany--; } } }
  };
}
STATIC_RULES.push(
  [/^if you would copy a spell one or more times, instead copy it that many times plus an additional time$/, m => ({kind:'m24twin', who:'you'})],
  [/^you may choose new targets for the additional copy$/, m => ({kind:'noop'})],
  [/^instant and sorcery spells you cast have storm$/, m => ({kind:'m24storm', who:'you'})],
  [/^spells you cast have ripple (\d+)$/, m => ({kind:'m24ripple', who:'you', n:+m[1]})],
);

/* ---------- copies of permanent spells resolve as tokens ---------- */
{
  const rt = resolveTop;
  resolveTop = async function(it){
    try {
      if (it && it.kind === 'spell' && it.copy && !UI.resolving && S.stk.includes(it) && isPermType(info(it.k)?.t || '')){
        UI.resolving = true;
        try {
          S.stk.splice(S.stk.indexOf(it), 1);
          const a = info(it.k);
          if (/\bAura\b/.test(a.t) && it.tgts && it.tgts.flat().length && !it.tgts.flat().some(targetStillThere)){ log(`${it.nm} fizzled — its target is gone`); commit(); return; }
          const tk = {id:S.nid++, k:it.k, tok:true, copy:true, n:1, sk:true};
          if (it.m24haste) tk.ekw = ['haste']; if (it.m24nl) tk.m24nl = 1;
          if (/\bAura\b/.test(a.t) && it.tgts){ const t = it.tgts.flat().find(targetStillThere); if (t) tk.att = {pid:t.pid, id:t.id}; }
          place(tk); S.bf.push(tk); log(`${it.nm} resolved — it becomes a token${it.m24nl ? " (it isn't legendary)" : ''}`);
          if (it.m24sac) S.dly.push({id:rid(6), eff:'Sacrifice ~.', k:tk.k, nm:a.n, srcId:tk.id});
          onEnter(tk, 'stack', {x:it.x}); commit();
        } finally { UI.resolving = false; queueRender(); }
        return;
      }
    } catch (e){ console.warn(e); UI.resolving = false; }
    return rt(it);
  };
}

/* ---------- storm / ripple granted by statics, Bonus Round ---------- */
{
  const ctr = castTriggers;
  castTriggers = function(c, a, it){
    const r = ctr(c, a, it);
    try {
      if (!UI.dry && c && a && it){
        const isIS = /\b(Instant|Sorcery)\b/.test(a.t || '');
        if (isIS && !hasKwText(a, 'storm') && rulesOn('m24storm').length){
          const t = turnStr(); let n = Math.max(0, (S.casts || []).filter(x => x.t === t).length - 1); for (const s of OPP.values()) if (s.ct === t) n += s.cn || 0;
          if (n) pushTrig(a.n, `Copy it ${n} time${n === 1 ? '' : 's'} (storm).`, {k:c.k, tgt:it.sid, storm:n}); else log(`${a.n}: storm count is 0`);
        }
        const rp = rulesOn('m24ripple'); if (rp.length && it.from === 'hand') pushTrig(a.n, `Ripple ${rp[0].n}: reveal the top ${rp[0].n} cards of your library; you may cast any with the same name without paying their mana costs.`, {k:c.k, m24ripple:rp[0].n, m24nm:a.n});
        if (isIS && S.m24bonus && S.m24bonus.t === turnStr() && S.m24bonus.n > 0) pushTrig('Bonus Round', `Copy ${a.n}${S.m24bonus.n > 1 ? ' ' + S.m24bonus.n + ' times' : ''}. You may choose new targets for the copy.`, {k:null, tgt:it.sid, m24bonusN:S.m24bonus.n});
      }
    } catch (e){ console.warn(e); }
    return r;
  };
}

/* ---------- cross-player ops ---------- */
RQ_OPS.push('m24poss', 'm24exIS', 'm24mv', 'm24give', 'm24tempt', 'm24bonus', 'm24chain', 'm24grab');
{
  const ao = applyOp;
  applyOp = function(r, from){
    switch (r.op){
      case 'm24mv': { const [sid, how] = String(r.d || '').split('|'); const it = S.stk.find(x => x.sid === sid); if (!it){ commit(); return; }
        if (how === 'tuck'){ it.hold = true; commit(); (async () => { const v = await askChoice({title:`${r.src}: put ${it.nm} on the top or bottom of your library?`, options:[{label:'Top', value:'top'}, {label:'Bottom', value:'bottom'}]}); it.hold = false; m24MoveLocal(it, v || 'top', from, r.src); })(); return; }
        m24MoveLocal(it, how || 'hand', from, r.src); return; }
      case 'm24exIS': (async () => { const list = S.gy.filter(c => /\b(Instant|Sorcery)\b/.test(info(c.k)?.t || '')); let k = '';
        if (list.length){ const ids = list.length === 1 ? [list[0].id] : await pickCards({title:`${r.src} (${nameOf(from)}): exile an instant or sorcery card from your graveyard`, cards:list, min:1, max:1}); const c = ids && S.gy.find(g => g.id === ids[0]); if (c){ moveCard(c.id, 'ex', {quiet:true}); k = c.k; log(`exiled ${cname(c)} from my graveyard (${r.src})`); } }
        sendRq(from, 'r21ack', k ? 1 : 0, r.src, {ref:r.ref, d:k}); commit(); })(); return;
      case 'm24poss': m24PossLocal(String(r.d || ''), r.src); return;
      case 'm24give': { const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; if (c && r.d) giveAway(c, String(r.d), {}); commit(); return; }
      case 'm24bonus': { const t = String(r.d || ''); if (!S.m24bonus || S.m24bonus.t !== t) S.m24bonus = {t, n:0}; S.m24bonus.n++; log(`${r.src}: until end of turn, whenever a player casts an instant or sorcery spell, that player copies it`); commit(); return; }
      case 'm24tempt': (async () => { const x = stackAll().find(i => i.sid === r.d); let n = 0;
        if (x && await askYes(`${r.src} (${nameOf(from)}): copy ${x.nm}? If you do, ${nameOf(from)} gets an additional copy.`, 'Copy it', 'No')){ const cps = await m24Copy(x, {name:r.src}, {newT:'may', noTwin:false}); n = cps.length ? 1 : 0; }
        r21Ack(from, r.ref, n, r.src); commit(); })(); return;
      case 'm24chain': (async () => { // Chain Lightning / Chain of Vapor / Chain of Smog: the other player may pay, then copy it onto their own stack
        const [k, cost] = String(r.d || '').split('|'); const a = info(k); if (!a) return; let ok = true;
        if (cost === 'RR'){ const p = payPlan(parseCost('{R}{R}'), S.pool); if (p.err || !(await askYes(`${r.src}: pay {R}{R} to copy ${a.n}?`, 'Pay {R}{R} and copy', 'No'))) ok = false; else { S.pool = p.pool; log(`paid {R}{R} (${r.src})`); } }
        else if (cost === 'land'){ const lands = S.bf.filter(b => isLand(b.k) && !b.fd); if (!lands.length || !(await askYes(`${r.src}: sacrifice a land to copy ${a.n}?`, 'Sacrifice a land', 'No'))) ok = false; else { const ids = lands.length === 1 ? [lands[0].id] : await pickCards({title:`${r.src}: sacrifice a land`, cards:lands, min:1, max:1}); const l = ids && S.bf.find(b => b.id === ids[0]); if (l) sacrificeOne(l); else ok = false; } }
        else if (!(await askYes(`${r.src}: copy ${a.n}?`, 'Copy it', 'No'))) ok = false;
        if (ok){ const fake = {sid:'m24' + rid(4), pid:from, kind:'spell', k, nm:a.n, txt:a.o, x:0, mv:a.mv || 0, ty:a.t}; await m24Copy(fake, {name:r.src}, {newT:'must', noTwin:false}); }
        commit(); })(); return;
      case 'm24grab': (async () => { // take a spell from the sender's stack (Sudden Substitution when I control the creature)
        const x = stackAll().find(i => i.sid === r.d); if (x) await m24Steal(x, {name:r.src}, {newT:'may'}); commit(); })(); return;
    }
    return ao(r, from);
  };
}

/* ---------- effects ---------- */
async function doRound24MPre(s, l, ctx){
  let m; const name = ctx.name || ''; const full = String(ctx.full || ''); const fl = m24Low(full, ctx); const t = m24Low(s, ctx);
  // --- intervening "if it isn't a mana ability" (only non-mana activations raise the event) ---
  if ((m = l.match(/^if it isn't a mana ability, (.+)$/))){ await doSentence(cap(s.slice(s.length - m[1].length)), ctx); return true; }
  // --- "you may pay {N}. If you do, copy …" ---
  if ((m = l.match(/^(?:you may )?pay ((?:\{[0-9wubrgc]\})+)$/)) && /if you do, copy (that ability|it|that spell)/.test(fl)){
    ctx.didPay = false; if (UI.dry){ ctx.didPay = true; return true; }
    const plan = payPlan(parseCost(m[1].toUpperCase()), S.pool); if (plan.err){ log(`${name}: couldn't pay ${m[1].toUpperCase()} (${plan.err})`); return true; }
    if (!/^you may/.test(l) || await askYes(`${name}: pay ${m[1].toUpperCase()}?`, `Pay ${m[1].toUpperCase()}`, 'No')){ S.pool = plan.pool; ctx.didPay = true; log(`${name}: paid ${m[1].toUpperCase()}`); commit(); }
    return true;
  }
  // --- copy that ability (Rings of Brighthearth, Illusionist's Bracers, Battlemage's Bracers) ---
  if (/^(?:if you do, )?copy that ability$/.test(l)){
    if (/^if you do/.test(l) && ctx.didPay === false) return true;
    if (UI.dry) return true;
    const x = m24Ref(ctx, {ability:true}); if (!x){ log(`${name}: the ability already left the stack`); return true; }
    if (x.pid === MYPID && x.it && x.it.m24nc){ log(`${name}: ${x.nm} can't be copied`); return true; }
    await m24Copy(x, ctx, {newT:'may'}); return true;
  }
  if (/^you may choose new targets for the cop(?:y|ies)(?: you control)?$/.test(l) || /^choose new targets for the copies you control$/.test(l)) return true;
  // --- Unbound Flourishing ---
  if (/^if that spell's mana cost or that ability's activation cost contains \{x\}, copy that spell or ability$/.test(l)){
    if (UI.dry) return true; const it = ctx.it || {};
    if (it.m24sid){ if (!it.evX){ log(`${name}: that ability's cost has no {X}`); return true; } await m24Copy(m24Ref(ctx, {ability:true}), ctx, {newT:'may'}); return true; }
    const x = m24Ref(ctx); if (!x || !/\{X\}/.test(info(x.k)?.m || '')){ log(`${name}: that spell's mana cost has no {X}`); return true; }
    await m24Copy(x, ctx, {newT:'may'}); return true;
  }
  // --- copy target … ability you control from a … source; Gogo copies X times ---
  if ((m = l.match(/^copy target (activated or triggered ability you control(?: from (?:an enchantment|a colorless|another legendary) source(?: that's not a commander)?)?)(?: (x) times)?$/))){
    if (UI.dry) return true;
    let x = ctx.it && ctx.it.tgt ? stackAll().find(i => i.sid === ctx.it.tgt) : null;
    if (!x) x = await m24PickStack(ctx, 'copy which ability?', y => m24CopyWhy(y, m[1], ctx.it && ctx.it.sid));
    if (!x){ log(`${name}: the ability is gone`); return true; }
    const why = m24CopyWhy(x, m[1], ctx.it && ctx.it.sid); if (why){ log(`${name}: can't copy ${x.nm} — ${why}`); return true; }
    if (x.pid === MYPID && x.it && x.it.m24nc){ log(`${name}: ${x.nm} can't be copied`); return true; }
    const n = m[2] ? Math.max(1, (ctx.it && ctx.it.x) || 1) : 1; await m24Copy(x, ctx, {newT:'may', n}); return true;
  }
  if (/^this ability can't be copied and x can't be 0$/.test(l) || /^this ability can't be copied$/.test(l)) return true;   // marked on the stack item when activated (m24nc)
  if (/^(?:~|this spell) can't be copied$/.test(t)) return true;   // m24NoCopy reads it from the card
  // --- Display of Power ---
  if (/^copy any number of target instant and\/or sorcery spells$/.test(l)){
    if (UI.dry) return true;
    const list = await m24PickMany(ctx, 'copy which instant and sorcery spells?', y => y.kind !== 'spell' ? 'not a spell' : !m24IsIS(y) ? 'not an instant or sorcery' : m24NoCopy(y) ? "can't be copied" : '');
    for (const x of list) await m24Copy(x, ctx, {newT:'may'}); if (!list.length) log(`${name}: copied nothing`); return true;
  }
  // --- copy this spell (Sevinne's Reclamation; Chain Lightning & co. are below) ---
  if (/^if this spell was cast from a graveyard, you may copy this spell and may choose a new target for the copy$/.test(t) || /^if ~ was cast from a graveyard, you may copy ~ and may choose a new target for the copy$/.test(t)){
    if (UI.dry) return true; if (!ctx.it || ctx.it.from !== 'gy'){ log(`${name}: it wasn't cast from a graveyard — no copy`); return true; }
    if (await askYes(`${name}: copy it?`, 'Copy it', 'No')) await m24CopySelf(ctx, {newT:'may'}); return true;
  }
  if (/^(?:you may )?copy (?:~|this spell) and may choose a new target for the copy$/.test(t) && /cast from a graveyard/.test(fl)){
    if (UI.dry) return true; if (!ctx.it || ctx.it.from !== 'gy'){ log(`${name}: it wasn't cast from a graveyard — no copy`); return true; }
    await m24CopySelf(ctx, {newT:'may'}); return true;
  }
  // --- Chain Lightning, Chain of Vapor, Chain of Smog: the affected player may copy it on their own client ---
  {
    const cost = /^(?:then )?(?:that|target) player or that permanent's controller may pay \{r\}\{r\}$/.test(l) ? 'RR' : /^(?:then )?that permanent's controller may sacrifice a land of their choice$/.test(l) ? 'land' : /^(?:that|target) player may copy (?:~|this spell) and may choose a new target for that copy$/.test(t) ? 'free' : null;
    if (cost){
      if (UI.dry) return true;
      const tg = (ctx.lastT || (ctx.tgts || []).flat()).find(Boolean); const pid = tg ? tg.pid : null;
      ctx.m24chainDone = true; if (!pid){ log(`${name}: no player to copy it`); return true; }
      const k = ctx.k; const a = info(k);
      if (pid === MYPID){
        let ok = true;
        if (cost === 'RR'){ const p = payPlan(parseCost('{R}{R}'), S.pool); if (p.err || !(await askYes(`${name}: pay {R}{R} to copy it?`, 'Pay and copy', 'No'))) ok = false; else S.pool = p.pool; }
        else if (cost === 'land'){ const lands = S.bf.filter(b => isLand(b.k) && !b.fd); if (!lands.length || !(await askYes(`${name}: sacrifice a land to copy it?`, 'Sacrifice a land', 'No'))) ok = false; else { const ids = lands.length === 1 ? [lands[0].id] : await pickCards({title:`${name}: sacrifice a land`, cards:lands, min:1, max:1}); const ld = ids && S.bf.find(b => b.id === ids[0]); if (ld) sacrificeOne(ld); else ok = false; } }
        else if (!(await askYes(`${name}: copy it?`, 'Copy it', 'No'))) ok = false;
        if (ok) await m24CopySelf(ctx, {newT:'must'});
      } else { sendRq(pid, 'm24chain', 0, name, {d:`${k}|${cost}`}); log(`${name}: ${nameOf(pid)} may ${cost === 'RR' ? 'pay {R}{R} and ' : cost === 'land' ? 'sacrifice a land and ' : ''}copy it`); }
      commit(); return true;
    }
    if (/^if the player does, they may copy (?:~|this spell) and may choose a new target for that copy$/.test(t)) return true;   // done with the previous sentence on that player's client
  }
  // --- copy that spell, with riders ---
  if (/^copy that spell$/.test(l) && /the copy targets ~/.test(fl)){
    if (UI.dry) return true; const x = m24Ref(ctx); const sc = srcCardOf(ctx); if (!x || !sc){ log(`${name}: nothing to copy`); return true; }
    ctx.m24ivy = true; await m24Copy(x, ctx, {tgts:[[{t:'card', pid:MYPID, id:sc.id, k:sc.k, nm:cname(sc)}]]}); return true;
  }
  if (/^the copy targets ~$/.test(t)) return true;
  if (/^(?:if you win the flip, )?copy that spell,? and you may choose new targets for the copy$/.test(l)){ if (UI.dry) return true; await m24Copy(m24Ref(ctx), ctx, {newT:'may'}); return true; }
  if ((m = l.match(/^copy (it|that spell), except the copy isn't legendary$/))){ if (UI.dry) return true; await m24Copy(m24Ref(ctx), ctx, {newT:'may', m24nl:true}); return true; }
  if (/^copy target creature spell you control, except it isn't legendary if the spell is legendary$/.test(l)){
    if (UI.dry) return true; let x = ctx.it && ctx.it.tgt ? stackAll().find(i => i.sid === ctx.it.tgt) : null;
    if (!x) x = await m24PickStack(ctx, 'copy which creature spell?', y => y.kind !== 'spell' ? 'not a spell' : y.pid !== MYPID ? "you don't control it" : !descOk(y.k, 'creature') ? 'not a creature spell' : '');
    if (x) await m24Copy(x, ctx, {newT:'no', m24nl:true}); return true;
  }
  if (/^if it's a permanent spell, the copy gains haste and "at the beginning of the end step, sacrifice (?:this permanent|~)\."$/.test(t)){
    if (UI.dry) return true; (M24.lastCopies || []).forEach(cp => { if (isPermType(info(cp.k)?.t || '')){ cp.m24haste = 1; cp.m24sac = 1; } }); commit(); return true;
  }
  // Taigam: copy it, then exile the original with four time counters (suspend)
  if ((m = l.match(/^copy it, then exile the spell you cast with (two|three|four|five|\d+) time counters on it$/))){
    if (UI.dry) return true; const x = m24Ref(ctx); if (!x) return true; await m24Copy(x, ctx, {newT:'may'});
    const n = wn(m[1]) || +m[1] || 4; await m24Move(x, `delay:${n}`, ctx); return true;
  }
  if ((m = l.match(/^(?:then )?exile the spell you cast with (two|three|four|five|\d+) time counters on it$/))){ if (UI.dry) return true; const x = m24Ref(ctx); if (!x){ log(`${name}: the spell already left the stack`); return true; } await m24Move(x, `delay:${wn(m[1]) || +m[1] || 4}`, ctx); return true; }
  if (/^if it doesn't have suspend, it gains suspend$/.test(l)) return true;
  // Harsh Mentor: the trigger condition is split at its first comma
  if ((m = l.match(/^creature, or land on the battlefield, if it isn't a mana ability, (.+)$/))){ await doSentence(cap(s.slice(s.length - m[1].length)), ctx); return true; }
  // --- Wyll's Reversal ---
  if (/^choose target spell or ability with one or more targets$/.test(l)){
    if (UI.dry) return true; let x = ctx.it && ctx.it.tgt ? stackAll().find(i => i.sid === ctx.it.tgt) : null;
    if (!x) x = await m24PickStack(ctx, 'choose a spell or ability with targets', y => !y.tgtNm && !y.tgt ? 'it has no targets' : '');
    if (x){ ctx.m24sid = x.sid; if (ctx.it) ctx.it.m24ref = x.sid; } return true;
  }
  if ((m = l.match(/^roll a d20 and add (.+)$/))){ const add = UI.dry ? 0 : (countOf(m[1], ctx) || 0); const r = 1 + Math.floor(Math.random() * 20); ctx.roll = r + add; if (!UI.dry) log(`🎲 ${name}: rolled ${r} + ${add} = ${ctx.roll}`); return true; }
  if ((m = s.match(/^(\d+)\+ \| ([\s\S]+)$/))){ const lo = +m[1]; if (!UI.dry && (ctx.roll == null || ctx.roll < lo)) return true; for (const part of m[2].split(/(?<=\.)\s+(?=[A-Z~])/)) await doSentence(part, ctx); return true; }
  if (/^(?:you may )?choose new targets for that spell or ability$/.test(l) && ctx.m24sid){ if (UI.dry) return true; await r21Retarget({...ctx, it:{...(ctx.it || {}), tgt:ctx.m24sid}}, {spec:'spell or ability', may:/^you may/.test(l)}); return true; }
  if (/^(?:you may )?choose new targets for that spell or ability$/.test(l) && UI.dry && /choose target spell or ability with one or more targets/i.test(info(ctx.k)?.o || '')) return true;
  if (/^then copy it$/.test(l) && (ctx.m24sid || UI.dry && /choose target spell or ability/i.test(info(ctx.k)?.o || ''))){ if (UI.dry) return true; await m24Copy(stackAll().find(i => i.sid === ctx.m24sid), ctx, {newT:'may'}); return true; }
  // --- Wildfire Devils: a random player exiles an instant or sorcery card from their graveyard; I copy it ---
  if (/^choose a player at random$/.test(l)){ const ps = players(); const p = ps[Math.floor(Math.random() * ps.length)]; ctx.m24rp = p ? p.pid : MYPID; if (!UI.dry) log(`${name}: chose ${ctx.m24rp === MYPID ? 'me' : nameOf(ctx.m24rp)} at random`); return true; }
  if (/^(?:that|target) player exiles an instant or sorcery card from their graveyard$/.test(l) && (ctx.m24rp || UI.dry)){
    ctx.m24exK = []; if (UI.dry) return true; const pid = ctx.m24rp;
    if (pid === MYPID){ const list = S.gy.filter(c => /\b(Instant|Sorcery)\b/.test(info(c.k)?.t || '')); if (list.length){ const ids = list.length === 1 ? [list[0].id] : await pickCards({title:`${name}: exile an instant or sorcery card from your graveyard`, cards:list, min:1, max:1}); const c = ids && S.gy.find(g => g.id === ids[0]); if (c){ moveCard(c.id, 'ex', {quiet:true}); ctx.m24exK = [c.k]; log(`${name}: exiled ${cname(c)}`); } } else log(`${name}: no instant or sorcery in my graveyard`); }
    else { const res = await r21Ask(pid, 'm24exIS', 0, name, {}); if (res.d) ctx.m24exK = [res.d]; else log(`${name}: ${nameOf(pid)} exiled nothing`); }
    commit(); return true;
  }
  // --- Zada, Hedron Grinder ---
  if (/^copy that spell for each other creature you control that the spell could target$/.test(l)){
    ctx.m24zada = true; if (UI.dry) return true; const x = m24Ref(ctx); const sc = srcCardOf(ctx); if (!x) return true;
    const sp = targetSpecs(m24TextOf(x))[0]; const d = sp ? (sp.any ? 'creature' : sp.desc.replace(/\b(you control|an opponent controls|you don't control)\b/g, '').trim() || 'creature') : 'creature';
    const list = S.bf.filter(c => !c.fd && isCreatureCard(c) && (!sc || c.id !== sc.id) && descOk(c.k, d, {tok:c.tok}));
    for (const c of list) await m24Copy(x, ctx, {tgts:[[{t:'card', pid:MYPID, id:c.id, k:c.k, nm:cname(c)}]], noTwin:list.indexOf(c) > 0});
    if (!list.length) log(`${name}: no other creature it could target`); return true;
  }
  if (/^each copy targets a different one of those creatures$/.test(l)) return true;
  // --- Surge to Victory ---
  if (/^creatures you control get \+x\/\+0 until end of turn, where x is that card's mana value$/.test(l) && ctx.m24exK){
    if (UI.dry) return true; const n = info(ctx.m24exK[0])?.mv || 0; S.bf.filter(c => isCreatureCard(c) && !c.fd).forEach(c => applyOp({op:'pump', tid:c.id, f:{p:n, t:0}}, MYPID)); log(`${name}: creatures I control get +${n}/+0`); commit(); return true;
  }
  if (/^whenever a creature you control deals combat damage to a player this turn, copy the exiled card$/.test(l)){ if (UI.dry){ ctx.m24ks = []; return true; } if ((ctx.m24exK || [])[0]) S.m24surge = {t:turnStr(), k:ctx.m24exK[0], src:name}; log(`${name}: copies ${info((ctx.m24exK || [])[0])?.n || 'the exiled card'} whenever a creature I control deals combat damage to a player this turn`); ctx.m24surgeSet = true; commit(); return true; }
  if (ctx.m24surgeSet && /^you may cast the copy without paying its mana cost$/.test(l)) return true;
  if (ctx.it && ctx.it.m24surgeK && /^copy the exiled card$/.test(l)){ ctx.m24ks = [ctx.it.m24surgeK]; return true; }
  // --- Krark / Invert Polarity: losing the flip ---
  if (/^if you lose the flip, return that spell to its owner's hand$/.test(l)){ if (UI.dry) return true; const won = ctx.coin ? ctx.coin === 'heads' : Math.random() < 0.5; ctx.m24won = won; if (!won){ log(`${name}: lost the flip`); await m24Move(m24Ref(ctx), 'hand', ctx); } else ctx.coin = 'heads'; return true; }
  if (/^if you lose the flip, counter that spell$/.test(l)){ if (UI.dry) return true; if (ctx.coin !== 'heads' && !ctx.m24stolen){ log(`${name}: lost the flip`); m24Counter(m24Ref(ctx), ctx, 0); } return true; }
  // --- choose target spell (Invert Polarity, Tempt with Mayhem) ---
  if ((m = l.match(/^choose target (spell|instant or sorcery spell)(?:, then flip a coin)?$/))){
    if (/then flip a coin/.test(l) && !UI.dry){ ctx.coin = Math.random() < 0.5 ? 'heads' : 'tails'; log(`🪙 ${name}: ${ctx.coin === 'heads' ? 'won' : 'lost'} the flip`); }
    if (UI.dry) return true;
    let x = ctx.it && ctx.it.tgt ? stackAll().find(i => i.sid === ctx.it.tgt) : null;
    if (!x) x = await m24PickStack(ctx, `choose target ${m[1]}`, y => y.kind !== 'spell' ? 'not a spell' : m[1] !== 'spell' && !m24IsIS(y) ? 'not an instant or sorcery' : '');
    if (x){ ctx.m24sid = x.sid; if (ctx.it) ctx.it.m24ref = x.sid; } return true;
  }
  if (/^(?:if you win the flip, )?gain control of that spell(?: and you may choose new targets for it)?$/.test(l)){
    if (UI.dry) return true; if (/^if you win/.test(l) && ctx.coin === 'tails'){ log(`${name}: lost the flip`); return true; }
    const x = m24Ref(ctx); const it = await m24Steal(x, ctx, {newT:/choose new targets/.test(l) || /you may choose new targets for it/.test(fl) ? 'may' : null}); if (it) ctx.m24stolen = true; return true;
  }
  if (/^(?:you may )?choose new targets for it$/.test(l) && (ctx.m24stolen || /gain control of that spell/.test(fl))) return true;
  // --- Perplexing Chimera ---
  if (/^exchange control of ~ and that spell$/.test(t)){
    if (UI.dry){ ctx.didPay = true; return true; }
    const sc = srcCardOf(ctx); const x = m24Ref(ctx); ctx.didPay = false;
    if (!sc || !S.bf.includes(sc) || !x || x.kind !== 'spell' || x.pid === MYPID){ log(`${name}: no exchange`); return true; }
    const it = await m24Steal(x, ctx, {newT:'may'}); if (!it) return true;
    giveAway(sc, x.pid, {}); ctx.didPay = true; ctx.m24stolen = true; commit(); return true;
  }
  if (/^(?:if you do, )?(?:you may )?choose new targets for the spell$/.test(l)) return true;   // offered while taking the spell
  // --- Sudden Substitution ---
  if (/^exchange control of target noncreature spell and target creature$/.test(l)){
    if (UI.dry) return true;
    const cr = nextTargets(ctx)[0]; let x = ctx.it && ctx.it.tgt ? stackAll().find(i => i.sid === ctx.it.tgt) : null;
    if (!x) x = await m24PickStack(ctx, 'exchange control of which noncreature spell?', y => y.kind !== 'spell' ? 'not a spell' : descOk(y.k, 'creature') ? 'a creature spell' : '');
    if (!x || !cr){ log(`${name}: nothing to exchange`); return true; }
    if (x.pid === cr.pid){ log(`${name}: the same player controls both — nothing changes`); return true; }
    if (cr.pid === MYPID){ await m24Steal(x, ctx, {newT:'may'}); m24GivePerm(cr, x.pid, name); }
    else if (x.pid === MYPID){ sendRq(cr.pid, 'm24grab', 0, name, {d:x.sid}); m24GivePerm(cr, MYPID, name); log(`${name}: ${nameOf(cr.pid)} gains control of ${x.nm}; I gain control of ${cr.nm}`); }
    else { sendRq(cr.pid, 'm24grab', 0, name, {d:x.sid}); m24GivePerm(cr, x.pid, name); log(`${name}: ${nameOf(cr.pid)} gains control of ${x.nm}; ${nameOf(x.pid)} gains control of ${cr.nm}`); }
    commit(); return true;
  }
  if (/^(?:then )?the spell's controller may choose new targets for it$/.test(l)) return true;   // offered to the new controller as it takes the spell
  // --- Shifting Grift / exchange control of two target permanents ---
  // --- Possibility Storm: the caster does it all on their own client ---
  if (/^(?:that|target) player exiles it(?:, then exiles cards from the top of their library until they exile a card that shares a card type with it)?$/.test(l) && /exiles cards from the top of their library until they exile a card that shares a card type with it/i.test(info(ctx.k)?.o || '')){
    ctx.m24poss = true; if (UI.dry) return true; const x = m24Ref(ctx); if (!x || x.kind !== 'spell'){ log(`${name}: the spell already left the stack`); return true; }
    if (x.pid === MYPID){ await m24PossLocal(x.sid, name); } else { sendRq(x.pid, 'm24poss', 0, name, {d:x.sid}); log(`${name}: ${nameOf(x.pid)} exiles ${x.nm} and reveals until a card that shares a type`); }
    return true;
  }
  if (ctx.m24poss && (/^exiles cards from the top of their library until they exile a card that shares a card type with it$/.test(l) || /^(?:that|target) player may cast that card without paying its mana cost$/.test(l) || /^(?:then )?they put all cards exiled with ~ on the bottom of their library in a random order$/.test(t))) return true;
  // --- exchange ~ / one of mine for a creature an opponent controls (Volatile Stormdrake, Oko) ---
  if (/^exchange control of ~ and target creature an opponent controls$/.test(t)){
    ctx.didPay = false; if (UI.dry){ ctx.didPay = true; return true; }
    const sc = srcCardOf(ctx); const tg = nextTargets(ctx)[0];
    if (!sc || !S.bf.includes(sc) || !tg || tg.pid === MYPID){ log(`${name}: no exchange`); return true; }
    m24GivePerm(tg, MYPID, name); giveAway(sc, tg.pid, {}); ctx.didPay = true; ctx.m24got = tg; commit(); return true;
  }
  if ((m = l.match(/^(?:if you do, )?(you get \{e\}\{e\}\{e\}\{e\}, then )?sacrifice that creature unless you pay an amount of \{e\} equal to its mana value$/))){
    if (UI.dry || ctx.didPay === false) return true; if (m[1]) addPC('energy', 4); const tg = ctx.m24got; if (!tg) return true; const mv = info(tg.k)?.mv || 0;
    const ok = await waitUntil(() => S.bf.find(b => b.k === tg.k && b.own && b.own.pid === tg.pid), 6000); const c = ok || S.bf.find(b => b.k === tg.k && b.own);
    if (!c){ log(`${name}: the creature didn't arrive`); return true; }
    if (((S.pc || {}).energy || 0) >= mv && await askYes(`${name}: pay ${mv} energy to keep ${cname(c)}?`, `Pay ${mv} {E}`, 'Sacrifice it')){ addPC('energy', -mv); log(`${name}: paid ${mv} energy`); }
    else sacrificeOne(c); commit(); return true;
  }
  if ((m = l.match(/^exchange control of target (artifact or creature|creature|artifact|permanent) you control and target creature an opponent controls(?: with power (\d+) or less)?$/))){
    if (UI.dry) return true; const mine = nextTargets(ctx)[0]; const theirs = nextTargets(ctx)[0];
    if (!mine || !theirs || theirs.pid === MYPID){ log(`${name}: no exchange`); return true; }
    m24GivePerm(mine, theirs.pid, name); m24GivePerm(theirs, MYPID, name); log(`${name}: exchanged ${mine.nm} for ${theirs.nm}`); commit(); return true;
  }
  // --- Chrome Host Seedshark: incubate X, where X is that spell's mana value ---
  if (/^incubate x, where x is that spell's mana value$/.test(l)){ if (UI.dry) return true; const x = m24Ref(ctx); const n = x ? x.mv || 0 : (info(ctx.it && ctx.it.evk)?.mv || 0); g23incubate(n, ctx); return true; }
  // --- Unbound Flourishing: double the value of X ---
  if (/^double the value of x$/.test(l)){
    if (UI.dry) return true; const x = m24Ref(ctx); if (!x || x.pid !== MYPID || !x.it){ log(`${name}: the spell is gone`); return true; }
    if (!/\{X\}/.test(info(x.k)?.m || '')){ log(`${name}: its mana cost has no {X}`); return true; }
    const old = x.it.x || 0; x.it.x = old * 2; x.it.mv = (x.it.mv || 0) + old * (parseCost(info(x.k)?.m || '').x || 1); log(`${name}: X for ${x.nm} is now ${x.it.x}`); commit(); return true;
  }
  // --- Diffusion Sliver: counter the spell or ability that targeted my Sliver unless its controller pays ---
  if ((m = l.match(/^counter that spell or ability unless its controller pays \{(\d+)\}$/)) && ctx.it && (ctx.it.evPid || UI.dry)){
    if (UI.dry) return true; const nm = info(ctx.it.evk)?.n || '';
    const x = stackAll().filter(i => i.pid === ctx.it.evPid && i.tgtNm && nm && i.tgtNm.includes(nm)).pop() || stackAll().filter(i => i.pid === ctx.it.evPid).pop();
    if (!x){ log(`${name}: it already left the stack`); return true; } m24Counter(x, ctx, +m[1]); return true;
  }
  // --- Bane's Contingency ---
  if (/^counter target spell$/.test(l) && /if that spell targets a commander you control, instead counter that spell, scry 2, then draw a card/.test(fl)){
    if (UI.dry) return true; const x = ctx.it && ctx.it.tgt ? stackAll().find(i => i.sid === ctx.it.tgt) : null; if (!x){ log(`${name} fizzled — its target is gone`); return true; }
    const cmds = S.bf.filter(b => b.cmd && !b.fd); const tg = x.pid === MYPID && x.it ? (x.it.tgts || []).flat() : [];
    ctx.m24bane = cmds.some(c => tg.some(t => t.pid === MYPID && t.id === c.id) || (x.pid !== MYPID && x.tgtNm && x.tgtNm.includes(cname(c))));
    m24Counter(x, ctx, 0); return true;
  }
  if (/^if that spell targets a commander you control, instead counter that spell, scry 2(?:, then draw a card)?$/.test(l)){ if (UI.dry){ ctx.m24bane = true; return true; } if (ctx.m24bane){ await doSentence('Scry 2', ctx); if (/then draw a card$/.test(l)) draw(1); } return true; }
  if (/^then draw a card$/.test(l) && ctx.m24bane !== undefined && /instead counter that spell, scry 2, then draw a card/.test(fl)){ if (ctx.m24bane && !UI.dry) draw(1); commit(); return true; }
  if ((m = l.match(/^exchange control of two target (creatures|artifacts|enchantments|permanents|lands|nonland permanents)$/))){
    if (UI.dry) return true; const ts = nextTargets(ctx);
    if (ts.length < 2){ log(`${name}: needs two targets`); return true; }
    const [a, b] = ts; if (a.pid === b.pid){ log(`${name}: the same player controls both — nothing changes`); return true; }
    m24GivePerm(a, b.pid, name); m24GivePerm(b, a.pid, name); log(`${name}: exchanged control of ${a.nm} and ${b.nm}`); commit(); return true;
  }
  // --- Narset's Reversal: return it (the copied spell) to its owner's hand ---
  if (/^(?:then )?return it to its owner's hand$/.test(l) && /copy target instant or sorcery spell, then return it/i.test(info(ctx.k)?.o || full)){
    if (UI.dry || !ctx.it || !ctx.it.tgt) return true; const x = stackAll().find(i => i.sid === ctx.it.tgt); if (x) await m24Move(x, 'hand', ctx); return true;
  }
  // --- Delay ---
  if (/^if the spell is countered this way, exile it with three time counters on it instead of putting it into its owner's graveyard$/.test(l)) return true;   // done by the counter below
  if (/^counter target spell$/.test(l) && /exile it with three time counters on it instead/.test(fl)){
    if (UI.dry) return true; const x = ctx.it && ctx.it.tgt ? stackAll().find(i => i.sid === ctx.it.tgt) : null;
    if (!x){ log(`${name} fizzled — its target is gone`); return true; } if (x.uc){ log(`${name}: ${x.nm} can't be countered`); return true; }
    await m24Move(x, 'delay:3', ctx); emit({type:'countered', k:x.k, id:0}); return true;
  }
  // --- Mindbreak Trap ---
  if (/^exile any number of target spells$/.test(l)){
    if (UI.dry) return true; const list = await m24PickMany(ctx, 'exile which spells?', y => y.kind !== 'spell' ? 'not a spell' : '');
    for (const x of list) await m24Move(x, 'exile', ctx); return true;
  }
  // --- mass counters ---
  if ((m = l.match(/^for each spell and ability your opponents control, counter it unless its controller pays \{(\d+)\}$/))){
    if (UI.dry) return true; const list = stackAll().filter(x => x.pid !== MYPID); list.forEach(x => m24Counter(x, ctx, +m[1])); if (!list.length) log(`${name}: nothing to counter`); return true;
  }
  if (/^counter all spells your opponents control and all abilities your opponents control$/.test(l)){
    ctx.m24n = 0; if (UI.dry) return true; const list = stackAll().filter(x => x.pid !== MYPID && !(x.kind === 'spell' && x.uc)); list.forEach(x => { if (m24Counter(x, ctx, 0)) ctx.m24n++; }); return true;
  }
  if ((m = s.match(/^create an? (.+?) token(?: with ([a-z ,]+?))? for each spell and ability countered this way$/i))){
    if (UI.dry) return true; const n = ctx.m24n || 0; for (let i = 0; i < Math.min(n, 30); i++) await createFromText(`Create a ${m[1]} token${m[2] ? ' with ' + m[2] : ''}`, ctx); return true;
  }
  if (/^counter all other spells$/.test(l)){
    if (UI.dry) return true; stackAll().filter(x => x.kind === 'spell' && !(ctx.it && x.sid === ctx.it.sid)).forEach(x => m24Counter(x, ctx, 0)); return true;
  }
  // --- Jin-Gitaxias: counter that spell (the one that triggered it) ---
  if (/^counter that spell$/.test(l) && (ctx.it && ctx.it.kind === 'trigger' && ctx.it.evk || UI.dry && /casts? an? [a-z, ]*spell, counter that spell/i.test(info(ctx.k)?.o || ''))){
    if (UI.dry) return true; const x = m24Ref(ctx); if (!x){ log(`${name}: the spell already left the stack`); return true; } m24Counter(x, ctx, 0); return true;
  }
  // --- counters with restrictions the core reader doesn't know ---
  if ((m = l.match(/^(?:then )?counter (up to one )?target (activated or triggered ability|activated ability|triggered ability|spell, activated ability, or triggered ability|spell|instant or sorcery spell|noncreature spell)( you don't control| from an artifact or enchantment source| with \{x\} in its mana cost)?(?: unless its controller pays (\{(\d+)\}|\{x\}, where x is (.+)|mana equal to (.+)))?$/)) && (m[3] || m[4] || m[1])){
    if (UI.dry) return true;
    const spec = m[2] + (m[3] || ''); const sp = {counter:true, spec, upTo:!!m[1]};
    let x = ctx.it && ctx.it.tgt ? stackAll().find(i => i.sid === ctx.it.tgt) : null;
    if (!x && !(ctx.it && ctx.it.m24none)) x = await m24PickStack(ctx, `counter target ${spec}`, y => m24StackWhy(y, sp, ctx.it && ctx.it.sid), {upTo:!!m[1]});
    if (!x){ if (!m[1]) log(`${name}: nothing to counter`); return true; }
    const why = m24StackWhy(x, sp, ctx.it && ctx.it.sid); if (why){ log(`${name} fizzled — ${why}`); return true; }
    let un = 0;
    if (m[5]) un = +m[5];
    else if (m[6]){ un = /^(?:this creature's|~'s) power$/.test(m24Low(m[6], ctx)) && ctx.it && ctx.it.m24pow != null ? ctx.it.m24pow : (countOf(m[6], ctx) || 0); }
    else if (m[7]) un = countOf(m[7], ctx) || 0;
    if (m[4] && !un){ log(`${name}: the amount is 0 — ${x.nm} isn't countered`); return true; }
    ctx.m24ctrd = x; m24Counter(x, ctx, un); return true;
  }
  if (/^if a permanent's ability is countered this way, destroy that permanent$/.test(l)){
    if (UI.dry) return true; const x = ctx.m24ctrd; if (!x || x.kind === 'spell') return true;
    if (x.pid === MYPID){ const c = x.it && x.it.srcId != null ? S.bf.find(b => b.id === x.it.srcId) : null; if (c) moveCard(c.id, 'gy', {quiet:false}); }
    else { const c = (OPP.get(x.pid)?.bf || []).find(b => b.k === x.k && !b.fd); if (c) applyTo({t:'card', pid:x.pid, id:c.id, k:c.k}, {op:'destroy', src:name}); }
    return true;
  }
  // --- Subtlety: its owner puts it on the top or bottom of their library ---
  if (/^choose up to one target creature spell or planeswalker spell$/.test(l)){
    if (UI.dry) return true; let x = ctx.it && ctx.it.tgt ? stackAll().find(i => i.sid === ctx.it.tgt) : null;
    if (!x && !(ctx.it && ctx.it.m24none)) x = await m24PickStack(ctx, 'choose a creature or planeswalker spell', y => y.kind !== 'spell' ? 'not a spell' : !descOk(y.k, 'creature or planeswalker') ? 'not a creature or planeswalker spell' : '', {upTo:true});
    if (x) ctx.m24sid = x.sid; return true;
  }
  if (/^its owner puts it on their choice of the top or bottom of their library$/.test(l)){ if (UI.dry) return true; const x = ctx.m24sid ? stackAll().find(i => i.sid === ctx.m24sid) : null; if (x) await m24Move(x, 'tuck', ctx); return true; }
  // --- Tempt with Mayhem ---
  if (/^each opponent may copy that spell and may choose new targets for the copy they control$/.test(l)){
    ctx.m24tempt = 0; if (UI.dry) return true; const x = m24Ref(ctx); if (!x) return true;
    const res = await Promise.all(opponents().map(p => r21Ask(p.pid, 'm24tempt', 0, name, {d:x.sid}))); ctx.m24tempt = res.reduce((a, r) => a + (r.n || 0), 0);
    log(`${name}: ${ctx.m24tempt} opponent${ctx.m24tempt === 1 ? '' : 's'} copied it`); return true;
  }
  if (/^you copy that spell once plus an additional time for each opponent who copied the spell this way$/.test(l)){
    if (UI.dry) return true; const x = m24Ref(ctx); if (x) await m24Copy(x, ctx, {newT:'may', n:1 + (ctx.m24tempt || 0)}); return true;
  }
  // --- Bonus Round ---
  if (/^until end of turn, whenever a player casts an instant or sorcery spell, (?:that|target) player copies it and may choose new targets for the copy$/.test(l)){
    if (UI.dry) return true; const tn = turnStr(); if (!S.m24bonus || S.m24bonus.t !== tn) S.m24bonus = {t:tn, n:0}; S.m24bonus.n++;
    opponents().forEach(p => sendRq(p.pid, 'm24bonus', 0, name, {d:tn})); log(`${name}: until end of turn, each instant and sorcery spell is copied by its caster`); commit(); return true;
  }
  if ((m = l.match(/^copy (.+?)(?: (\d+) times)?$/)) && ctx.it && ctx.it.m24bonusN){ if (UI.dry) return true; const x = stackAll().find(i => i.sid === ctx.it.tgt); if (x) await m24Copy(x, ctx, {newT:'may', n:ctx.it.m24bonusN}); return true; }
  // --- Chef's Kiss ---
  if (/^gain control of target spell that targets only a single permanent or player$/.test(l)){
    if (UI.dry) return true; let x = ctx.it && ctx.it.tgt ? stackAll().find(i => i.sid === ctx.it.tgt) : null;
    if (!x) x = await m24PickStack(ctx, 'gain control of which spell?', y => y.kind !== 'spell' ? 'not a spell' : !y.tgtNm || /,/.test(y.tgtNm) ? 'it needs exactly one target' : '');
    if (!x) return true; ctx.m24sid = x.sid; const it = await m24Steal(x, ctx, {}); if (it){ ctx.m24kiss = it; ctx.m24sid = it.sid; } return true;
  }
  if (/^copy it, then reselect the targets at random for the spell and the copy$/.test(l) || /^copy it$/.test(l) && /reselect the targets at random/.test(fl)){
    if (UI.dry) return true; const it = ctx.m24kiss; if (!it || !S.stk.includes(it)) return true;
    const cps = await m24Copy({...pubItem(it), pid:MYPID, it}, ctx, {newT:'no'}); for (const cp of [it, ...cps]) m24RandomTarget(cp, name); commit(); return true;
  }
  if (/^reselect the targets at random for the spell and the copy$/.test(l) || /^the new targets can't be you or a permanent you control$/.test(l)) return true;
  // --- imprint & cast copies ---
  if (/^(?:you may )?exile an instant card with mana value 2 or less from your hand$/.test(l) && /copy the exiled card/i.test(info(ctx.k)?.o || full)){
    if (UI.dry) return true; const sc = srcCardOf(ctx); const list = S.hand.filter(c => /\bInstant\b/.test(info(c.k)?.t || '') && (info(c.k)?.mv || 0) <= 2);
    if (!list.length){ log(`${name}: no instant with mana value 2 or less in hand`); return true; }
    const ids = await pickCards({title:`${name}: imprint an instant card`, cards:list, min:0, max:1, noneLabel:'Exile nothing'}); const c = ids && ids[0] != null ? S.hand.find(h => h.id === ids[0]) : null; if (!c) return true;
    moveCard(c.id, 'ex', {quiet:true}); if (sc){ sc.m24imp = (sc.m24imp || []).concat(c.k); } log(`${name}: exiled ${cname(c)} (imprint)`); commit(); return true;
  }
  if (/^(?:you may )?copy the exiled card$/.test(l)){
    if (UI.dry){ ctx.m24ks = []; return true; } const sc = srcCardOf(ctx); const ks = (sc && sc.m24imp) || ctx.m24exK || [];
    if (!ks.length){ log(`${name}: no exiled card to copy`); ctx.didPay = false; return true; } ctx.m24ks = ks.slice(0, 1); ctx.didPay = true; return true;
  }
  if ((m = l.match(/^(?:if you do, )?(?:you may )?cast (?:the|that) cop(?:y|ies)(?: without paying (?:its|their) mana costs?)?$/)) || (m = l.match(/^(?:you may )?cast any number of the copies without paying their mana costs$/))){
    if (UI.dry) return true; const ks = ctx.m24ks || []; if (!ks.length) return true;
    for (const k of ks){ if (!(await askYes(`${name}: cast a copy of ${info(k)?.n}${/without paying/.test(l) ? ' without paying its mana cost' : ''}?`, 'Cast it', 'No'))) continue;
      if (!/without paying/.test(l)){ const p = payPlan(parseCost(info(k)?.m || ''), S.pool); if (p.err){ log(`${name}: can't pay for the copy (${p.err})`); continue; } S.pool = p.pool; }
      await m24CastCopy(k, ctx); ctx.m24castN = (ctx.m24castN || 0) + 1; }
    return true;
  }
  if ((m = l.match(/^copy (?:that card|it) (three times|twice)$/)) || (m = l.match(/^copy that card$/)) || (m = l.match(/^copy it$/)) && (ctx.m24exK || []).length){
    const n = m[1] === 'three times' ? 3 : m[1] === 'twice' ? 2 : 1; if (UI.dry) return true;
    const k = (ctx.m24exK || [])[0] || ((ctx.lastT || [])[0] || {}).k; if (!k){ log(`${name}: no card to copy`); return true; }
    ctx.m24ks = Array(n).fill(k); return true;
  }
  if (/^then copy each card exiled with ~$/.test(t) || /^copy each card exiled with ~$/.test(t)){ if (UI.dry) return true; const sc = srcCardOf(ctx); ctx.m24ks = ((sc && sc.m24imp) || []).slice(); return true; }
  // exile cards for those copies
  if ((m = l.match(/^exile (?:target card that's an instant or sorcery|target instant or sorcery card) from (your|a) graveyard$/)) && /cop(y|ies)/.test(fl)){
    if (UI.dry){ ctx.m24exK = []; return true; }
    const tg = nextTargets(ctx)[0]; ctx.m24exK = [];
    if (tg){ if (tg.pid === MYPID){ const c = S.gy.find(g => g.id === tg.id); if (c){ moveCard(c.id, 'ex', {quiet:true}); ctx.m24exK.push(c.k); log(`${name}: exiled ${cname(c)}`); } } else { applyTo(tg, {op:'exile', src:name}); ctx.m24exK.push(tg.k); } }
    else { const list = S.gy.filter(c => /\b(Instant|Sorcery)\b/.test(info(c.k)?.t || '')); if (m[1] === 'your' && list.length){ const ids = await pickCards({title:`${name}: exile an instant or sorcery card`, cards:list, min:1, max:1}); const c = ids && S.gy.find(g => g.id === ids[0]); if (c){ moveCard(c.id, 'ex', {quiet:true}); ctx.m24exK.push(c.k); } } }
    return true;
  }
  if (/^for each card exiled this way, copy it, and you may cast the copy without paying its mana cost$/.test(l)){
    if (UI.dry) return true; for (const k of ctx.m24exK || []) if (await askYes(`${name}: cast a copy of ${info(k)?.n} without paying its mana cost?`, 'Cast it', 'No')) await m24CastCopy(k, ctx); return true;
  }
  if ((m = l.match(/^exile an instant or sorcery card at random from your graveyard$/)) && /copy each card exiled with/.test(fl)){
    if (UI.dry) return true; const sc = srcCardOf(ctx); const list = S.gy.filter(c => /\b(Instant|Sorcery)\b/.test(info(c.k)?.t || ''));
    if (!list.length){ log(`${name}: no instant or sorcery in the graveyard`); return true; } const c = list[Math.floor(Math.random() * list.length)];
    moveCard(c.id, 'ex', {quiet:true}); if (sc) sc.m24imp = (sc.m24imp || []).concat(c.k); log(`${name}: exiled ${cname(c)} at random`); commit(); return true;
  }
  if ((m = l.match(/^(?:then )?exile a nonland card at random from your graveyard$/)) && /copy it/.test(fl)){
    if (UI.dry) return true; const list = S.gy.filter(c => !isLand(c.k)); ctx.m24exK = [];
    if (!list.length){ log(`${name}: no nonland card in the graveyard`); return true; } const c = list[Math.floor(Math.random() * list.length)];
    moveCard(c.id, 'ex', {quiet:true}); ctx.m24exK = [c.k]; log(`${name}: exiled ${cname(c)} at random`); commit(); return true;
  }
  if (/^exile (target noncreature, nonland card with mana value less than ~'s power from a graveyard|up to one target black card from your graveyard) and copy it$/.test(t)){
    if (UI.dry) return true; const tg = nextTargets(ctx)[0]; ctx.m24ks = [];
    if (!tg){ log(`${name}: no card exiled`); return true; }
    if (tg.pid === MYPID){ const c = S.gy.find(g => g.id === tg.id); if (c) moveCard(c.id, 'ex', {quiet:true}); } else applyTo(tg, {op:'exile', src:name});
    log(`${name}: exiled ${tg.nm} and copied it`); ctx.m24ks = [tg.k]; return true;
  }
  if (/^if you do, you lose 2 life$/.test(l) && ctx.m24ks){ if (ctx.m24castN){ S.life -= 2; log(`${name}: lost 2 life → ${S.life}`); commit(); } return true; }
  return false;
}
// Chef's Kiss: new random target that isn't me or mine
function m24RandomTarget(it, name){
  const sp = targetSpecs(it.txt || '')[0]; if (!sp) return;
  const cands = []; const wantP = sp.any || /\b(player|opponent)\b/.test(sp.desc);
  if (wantP) opponents().forEach(p => cands.push({t:'player', pid:p.pid, id:null, k:null, nm:nameOf(p.pid)}));
  const cd = sp.any ? 'creature or planeswalker or battle' : sp.desc.replace(/\b(players?|opponents?)\b/g, '').replace(/^\s*(or|and)\s+|\s+(or|and)\s*$/g, '').trim();
  if (cd) for (const [pid, s] of OPP) (s.bf || []).forEach(c => { if (c.k && !c.fd && descOk(c.k, cd.replace(/ you don't control| an opponent controls/, ''), {tok:c.tok})) cands.push({t:'card', pid, id:c.id, k:c.k, nm:info(c.k)?.n || 'a card'}); });
  if (!cands.length){ log(`${name}: no legal new target for ${it.nm}`); return; }
  const pick = cands[Math.floor(Math.random() * cands.length)]; it.tgts = [[pick]]; it.tgtNm = tgtLabel(it.tgts); log(`${name}: ${it.nm} now targets ${it.tgtNm} (at random)`);
}
// ripple: reveal the top N, may cast those with the same name for free, rest to the bottom
async function m24Ripple(ctx){
  const n = ctx.it.m24ripple; const nm = ctx.it.m24nm; const top = S.lib.splice(0, n); log(`ripple ${n}: revealed ${top.map(cname).join(', ') || 'nothing'}`);
  const hits = top.filter(c => cname(c) === nm); const rest = top.filter(c => !hits.includes(c)); S.lib.push(...rest); S.ex.push(...hits); commit();
  for (const c of hits){ if (await askYes(`Ripple: cast ${cname(c)} without paying its mana cost?`, 'Cast it', 'No')) await beginCast(c, 'ex', {free:true}); else { S.ex.splice(S.ex.indexOf(c), 1); S.lib.push(c); } }
  commit();
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){
    const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase();
    if (ctx && ctx.it && ctx.it.m24ripple && /^ripple \d+:/.test(l)){ if (!UI.dry) await m24Ripple(ctx); return; }
    if (l && ctx && await doRound24MPre(s, l, ctx)) return;
    return ds(s0, ctx);
  };
}

// Surge to Victory: whenever a creature I control deals combat damage to a player this turn
{
  const em = emit;
  emit = function(ev){
    const r = em(ev);
    try { if (S && !UI.dry && ev && ev.type === 'cdmg' && ev.dp && S.m24surge && S.m24surge.t === turnStr() && S.bf.some(b => b.id === ev.id && isCreatureCard(b))) pushTrig(S.m24surge.src || 'Surge to Victory', 'Copy the exiled card. You may cast the copy without paying its mana cost.', {k:null, m24surgeK:S.m24surge.k}); } catch (e){ console.warn(e); }
    return r;
  };
}

// Possibility Storm, on the caster's client: exile the spell, exile from the top until a card sharing a card type, may cast it free, rest on the bottom
const M24_TYPES = ['Artifact', 'Battle', 'Creature', 'Enchantment', 'Instant', 'Kindred', 'Land', 'Planeswalker', 'Sorcery'];
async function m24PossLocal(sid, src){
  const it = S.stk.find(x => x.sid === sid); if (!it || it.kind !== 'spell'){ log(`${src}: the spell already left the stack`); commit(); return; }
  const types = M24_TYPES.filter(ty => new RegExp('\\b' + ty + '\\b').test(info(it.k)?.t || it.ty || ''));
  const c0 = it.copy ? null : it.card; S.stk.splice(S.stk.indexOf(it), 1); UI.r21gone ||= {}; UI.r21gone[it.sid] = it;
  const pile = []; if (c0){ faceRestore(c0); c0.fl = false; if (c0.r21 && c0.own){ sendRq(c0.own.pid, 'back', 0, cname(c0), {ref:c0.own.ref, d:'ex'}); } else { S.ex.push(c0); pile.push(c0); } }
  log(`${src}: ${it.nm} was exiled`);
  let hit = null; const seen = [];
  while (S.lib.length){ const c = S.lib.shift(); seen.push(c); S.ex.push(c); pile.push(c); if (types.some(ty => new RegExp('\\b' + ty + '\\b').test(info(c.k)?.t || ''))){ hit = c; break; } }
  log(`${src}: exiled ${seen.map(cname).join(', ') || 'nothing'}`); commit();
  let cast = false;
  if (hit && !isLand(hit.k) && await askYes(`${src}: cast ${cname(hit)} without paying its mana cost?`, 'Cast it', 'No')){ cast = true; UI.m24possSkip = (UI.m24possSkip || 0) + 1; try { await beginCast(hit, 'ex', {free:true}); } finally { UI.m24possSkip--; } }
  const rest = pile.filter(c => S.ex.includes(c) && !(cast && c === hit)); rest.forEach(c => S.ex.splice(S.ex.indexOf(c), 1)); shuffle(rest); S.lib.push(...rest);
  if (rest.length) log(`${src}: put ${rest.length} exiled card${rest.length === 1 ? '' : 's'} on the bottom of my library in a random order`);
  commit();
}
// Bonus Round: engine25s's generic "until end of turn, whenever …" delayed trigger would catch this line first and fire only on the
// Bonus Round caster's client (and then can't do "that player copies it"). Decline it there so doRound24MPre's handler runs:
// every player's client copies its own instants and sorceries this turn (S.m24bonus, set via the m24bonus op).
if (typeof r25DelayTry === 'function'){
  const dt = r25DelayTry;
  r25DelayTry = async function(ctx, cond, eff, exp){
    if (/^a player casts an instant or sorcery spell$/i.test(String(cond)) && /^(?:that|target) player copies it\b/i.test(String(eff))) return false;
    return dt(ctx, cond, eff, exp);
  };
}
