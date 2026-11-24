
/* ===================== Rules engine — round 6: combat damage triggers, modes, equipment & auras, play from exile, copies, counting ===================== */

/* ---------- Counting ("for each", "equal to the number of", "where X is") ---------- */
const sing = d => String(d || '').replace(/\b([a-z]+?)s\b/g, (w, b) => /^(plain|les|clas|bos|i|thi|ha|wa|it)$/.test(b) ? w : b).trim();
function countOf(phrase, ctx){
  let p = String(phrase || '').toLowerCase().trim().replace(/\.$/, '').replace(/^(the number of|each) /, ''); let m;
  const src = ctx ? srcCardOf(ctx) : null;
  const cnt = (list, d, other) => (list || []).reduce((s, b) => s + ((b.k && !b.fd && (!other || !src || b.id !== src.id) && (!d || descOk(b.k, d, {tok:b.tok}))) ? (b.n || 1) : 0), 0);
  if ((m = p.match(/^(other )?(.+?) you control$/))) return cnt(S.bf, sing(m[2]), !!m[1]);
  if ((m = p.match(/^(.+?) (?:your opponents control|an opponent controls|you don't control)$/))){ let n = 0; for (const s of OPP.values()) n += cnt(s.bf, sing(m[1])); return n; }
  if ((m = p.match(/^(other )?(.+?) on the battlefield$/))){ let n = 0; for (const b of boardsAll()) n += cnt(b.bf, sing(m[2]), !!m[1] && b.pid === MYPID); return n; }
  if ((m = p.match(/^(.*?)cards? in your hand$/))){ const d = sing(m[1]); return S.hand.filter(c => !d || descOk(c.k, d)).length; }
  if ((m = p.match(/^(.*?)cards? in your graveyard$/))){ const d = sing(m[1]); return S.gy.filter(c => !d || descOk(c.k, d)).length; }
  if ((m = p.match(/^(.*?)cards? in (?:all graveyards|graveyards)$/))){ const d = sing(m[1]); let n = S.gy.filter(c => !d || descOk(c.k, d)).length; for (const s of OPP.values()) n += (s.gy || []).filter(k => !d || descOk(k, d)).length; return n; }
  if (/^cards? in your library$/.test(p)) return S.lib.length;
  if (/^opponents?(?: you have)?$/.test(p)) return opponents().length;
  if (/^players?$/.test(p)) return players().length;
  if ((m = p.match(/^(\+1\/\+1|-1\/-1|loyalty|lore) counters? on (?:~|it)$/))) return src ? ({'+1/+1':src.cp, '-1/-1':src.cm, loyalty:src.co, lore:src.lore}[m[1]] || 0) : null;
  if (/^(?:~'s|its) power$/.test(p)){ const st = src && stats(src); return st ? Math.max(0, st[0]) : null; }
  if (/^(?:~'s|its) toughness$/.test(p)){ const st = src && stats(src); return st ? Math.max(0, st[1]) : null; }
  if (/^your life total$/.test(p)) return S.life;
  return null;
}
function scaleSentence(t, n){
  let done = false;
  t = t.replace(/([+-])(\d+)\/([+-])(\d+)/, (w, s1, a, s2, b) => { done = true; return `${s1}${a * n}/${s2}${b * n}`; });
  if (done) return t;
  return t.replace(/\b(a|an|one|two|three|four|five|\d+) ((?:\S+ )*?(?:cards?|life|damage|counters?|tokens?))\b/i, (w, q, noun) => `${(wn(String(q).toLowerCase()) || 1) * n} ${noun}`);
}
function countRewrite(s, l0){
  let m; const l = String(l0).replace(/["“][^"”]*["”]/g, q => '_'.repeat(q.length));
  if ((m = l.match(/,? where x is (.+)$/))){ const n = countOf(m[1], this); if (n == null) return null; return s.slice(0, m.index).replace(/\bX\b/gi, String(n)); }
  if ((m = l.match(/ for each ([^,]+?)(?=,| until end of turn|$)/))){ const n = countOf(m[1], this); if (n == null) return null; return scaleSentence(s.slice(0, m.index) + s.slice(m.index + m[0].length), n); }
  if ((m = l.match(/ equal to the number of ([^,]+?)(?=,| until end of turn|$)/))){
    const n = countOf(m[1], this); if (n == null) return null;
    return (s.slice(0, m.index) + s.slice(m.index + m[0].length))
      .replace(/\bdraws? cards\b/i, w => `${w.split(' ')[0]} ${n} cards`).replace(/\bdeals damage\b/i, `deals ${n} damage`)
      .replace(/\b(gains?|loses?) life\b/i, (w, v) => `${v} ${n} life`).replace(/\bmills? cards\b/i, w => `${w.split(' ')[0]} ${n} cards`)
      .replace(/\b(create|put) a number of\b/i, (w, v) => `${v} ${n}`);
  }
  return null;
}

/* ---------- Text handled before everything else ---------- */
async function doRound6Pre(s, l, ctx){
  let m;
  // "that player" = the player a combat-damage trigger hit
  const tp = ctx.it && (ctx.it.evDp || ctx.it.evPid);
  if (tp && /\b(that player|defending player)\b/.test(l) && !(ctx.tgts && ctx.tgts.length)){
    ctx.tgts = Array.from({length:6}, () => [{t:'player', pid:tp, nm:nameOf(tp)}]); ctx.ti = 0;
    await doSentence(cap(s.replace(/\b(that player|defending player)\b/gi, 'target player').replace(/\bdraws an additional card\b/i, 'draws a card')), ctx); ctx.tgts = null; ctx.ti = 0; return true;
  }
  const r = countRewrite.call(ctx, s, l); if (r && r !== s){ await doSentence(cap(r), ctx); return true; }
  // play from exile
  if ((m = l.match(/^(?:until (?:the )?end of (this turn|turn|your next turn), )?you may (play|cast) (it|them|that card|those cards|the exiled cards?|cards exiled this way|that spell|spells from among them)(?: this turn| until (?:the )?end of (this turn|turn|your next turn))?$/))){
    const ids = (ctx.lastEx || []).filter(id => S.ex.some(c => c.id === id)); if (!ids.length) return false;
    grantPlay(ids, {next:/next turn/.test((m[1] || '') + (m[4] || '')), cast:m[2] === 'cast', src:ctx.name}); return true;
  }
  // copies
  if ((m = l.match(/^copy target (.*?)(spell|ability)(?: you control)?$/))){ await copyTargetItem(ctx); return true; }
  if (/^you may choose new targets for (the|that) cop(y|ies)$/.test(l)) return true;
  // equip / attach
  if ((m = l.match(/^attach (~|it) to target (.+)$/))){
    const t = (nextTargets(ctx) || [])[0]; const c = srcCardOf(ctx);
    if (c && t && find(c.id)[0] === 'bf'){ c.att = {pid:t.pid, id:t.id}; log(`attached ${cname(c)} to ${t.nm || info(t.k)?.n || 'a creature'}`); commit(); }
    return true;
  }
  // divided damage
  if ((m = l.match(/^(?:~|it) deals (\d+|x) damage divided as you choose among (.+)$/))){
    const total = await numOf(m[1], ctx, 'damage'); let ts = ctx.tgts ? nextTargets(ctx) : [];
    if (!ts.length){ const p = await pickTargets(divSpec(m[2]), {pid:MYPID, col:info(ctx.k)?.c, types:info(ctx.k)?.t, id:ctx.srcId}, `${ctx.name}: choose targets for ${total} damage`); ts = (p || []).map(x => ({t:x.t, pid:x.pid, id:x.id, k:x.k || null, nm:x.nm})); }
    if (!ts.length){ log(`${ctx.name}: no targets`); return true; }
    let left = total; const plan = [];
    for (let i = 0; i < ts.length; i++){
      const t = ts[i]; const rest = ts.length - i - 1;
      let n = i === ts.length - 1 ? left : await askNumber(`${ctx.name}: how much damage to ${t.nm || info(t.k)?.n || nameOf(t.pid)}?`, `${left} left · each other target needs at least 1`, Math.max(1, Math.floor(left / (rest + 1))));
      n = Math.max(1, Math.min(left - rest, n || 1)); plan.push([t, n]); left -= n;
    }
    const src = srcCardOf(ctx); plan.forEach(([t, n]) => dealDamage(t, n, ctx.k, src));
    log(`${ctx.name} divided ${total} damage: ${plan.map(([t, n]) => `${n} to ${t.nm || nameOf(t.pid)}`).join(', ')}`); commit(); return true;
  }
  return false;
}
function divSpec(w){
  const n = /any number/.test(w) ? 99 : /\bthree\b/.test(w) ? 3 : /\btwo\b/.test(w) ? 2 : 1;
  if (/targets?$/.test(w.trim()) && !/target [a-z]/.test(w)) return {desc:'any', any:true, zone:'bf', n, upTo:true};
  const d = (w.match(/target (.+)$/) || [, 'creature'])[1];
  return {desc:sing(d), zone:'bf', n, upTo:true};
}

/* ---------- Modes ("Choose one —") ---------- */
const MODE_RE = /(^|\n)([^\n]*?)\bchoose (one or both|one or more|up to one|up to two|up to three|any number|one|two|three)\b[^\n—]*—\s*\n((?:\s*•[^\n]*(?:\n|$))+)/i;
function parseModes(txt){
  const m = String(txt || '').match(MODE_RE); if (!m) return null;
  const opts = m[4].split('\n').map(x => x.trim()).filter(x => x.startsWith('•')).map(x => x.replace(/^•\s*/, ''));
  const w = m[3].toLowerCase(); const N = opts.length;
  const [min, max] = w === 'one' ? [1, 1] : w === 'two' ? [2, 2] : w === 'three' ? [3, 3] : w === 'one or both' ? [1, 2] : w === 'one or more' ? [1, N] : w === 'any number' ? [0, N] : [0, wn(w.split(' ')[2]) || 1];
  const pre = String(txt).slice(0, m.index) + (m[1] || '') + m[2].replace(/,?\s*$/, '');
  const post = String(txt).slice(m.index + m[0].length);
  return {opts, min:Math.min(min, N), max:Math.min(max, N), pre:pre.trim(), post:post.trim()};
}
async function askModes(md, name){
  if (md.max === 1){
    const v = await askChoice({title:`${name}: choose one`, options:md.opts.map((o, i) => ({label:o, value:i}))});
    return v == null ? null : [v];
  }
  const got = [];
  // bots and dry runs: one mode at a time, as before
  if (UI.dry || (typeof BOT !== 'undefined' && BOT.on)){
    while (got.length < md.max){
      const opts = md.opts.map((o, i) => ({label:o, value:i})).filter(o => !got.includes(o.value));
      if (got.length >= md.min) opts.push({label:got.length ? 'That’s all' : 'Choose nothing', value:'done'});
      const v = await askChoice({title:`${name}: choose ${md.min === md.max ? md.max : (md.min ? md.min + ' to ' : 'up to ') + md.max} (${got.length} chosen)`, options:opts});
      if (v == null) return null; if (v === 'done') break; got.push(v);
    }
    return got.sort((a, b) => a - b);
  }
  // people: every mode stays on the list; chosen ones are ticked (listed last) and tapping one again unticks it
  for (;;){
    const opts = md.opts.map((o, i) => ({label:(got.includes(i) ? '✓ ' : '') + o + (got.includes(i) ? '  (tap to remove)' : ''), value:i, disabled:!got.includes(i) && got.length >= md.max}));
    opts.sort((a, b) => (got.includes(a.value) ? 1 : 0) - (got.includes(b.value) ? 1 : 0));
    const ok = got.length >= md.min && got.length > 0;
    (ok ? opts.unshift.bind(opts) : opts.push.bind(opts))({label:got.length ? `Done — use ${got.length === 1 ? 'this mode' : 'these ' + got.length + ' modes'}` : (md.min === 0 ? 'Choose nothing' : `Pick ${md.min === md.max ? md.max : 'at least ' + Math.max(1, md.min)}`), value:'done', disabled:!(ok || md.min === 0)});
    const v = await askChoice({title:`${name}: choose ${md.min === md.max ? md.max : (md.min ? md.min + ' to ' : 'up to ') + md.max} — tap to tick (${got.length} chosen)`, options:opts});
    if (v == null) return null; if (v === 'done') break;
    const i = got.indexOf(v); if (i >= 0) got.splice(i, 1); else got.push(v);
    if (md.min === md.max && got.length === md.max) break;   // "choose two": done as soon as two are ticked
  }
  return got.sort((a, b) => a - b);
}
function modeText(md, idx){ return [md.pre, ...idx.map(i => md.opts[i]), md.post].filter(Boolean).join('\n'); }
async function modalText(txt, ctx){
  const md = parseModes(txt); if (!md) return txt;
  let idx = ctx.it && Array.isArray(ctx.it.modes) ? ctx.it.modes : null;
  if (!idx){ idx = await askModes(md, ctx.name); if (!idx) return md.pre; }
  if (idx.length) log(`${ctx.name}: chose ${idx.map(i => '“' + short(md.opts[i], 50) + '”').join(', ')}`);
  return modeText(md, idx);
}

/* ---------- Equipment and Auras ---------- */
const isAuraCard = c => /\bAura\b/.test(typeOf(c));
let AFX = null;
function attachFx(c, pid = MYPID){
  if (!c) return {p:0, t:0, kws:[], names:[]};
  if (!AFX){ AFX = new Map(); setTimeout(() => { AFX = null; }, 0); }
  const key = pid + '|' + c.id; if (AFX.has(key)) return AFX.get(key);
  const fx = {p:0, t:0, kws:[], noAtk:false, noBlk:false, noUntap:false, names:[]};
  for (const b of boardsAll()) for (const s of b.bf){
    if (!s.att || s.att.pid !== pid || s.att.id !== c.id || !s.k || s.fd) continue;
    const f = faceOf(s); if (!f) continue; fx.names.push(f.n);
    for (const sen of tname(f.o, f.n).toLowerCase().split(/\.\s*|\n/)){
      const x = sen.trim(); if (!/^(equipped|enchanted) (creature|permanent|artifact|land)/.test(x)) continue; let m;
      if ((m = x.match(/gets? ([+-]\d+)\/([+-]\d+)/))){ fx.p += +m[1]; fx.t += +m[2]; }
      if ((m = x.match(/(?:has|have) ([a-z ,]+?)(?: and gets.*)?$/))) m[1].split(/,\s*(?:and\s+)?|\s+and\s+/).forEach(k => { k = k.trim(); if (k) fx.kws.push(k); });
      if (/can't attack or block/.test(x)){ fx.noAtk = fx.noBlk = true; }
      else { if (/can't attack/.test(x)) fx.noAtk = true; if (/can't block/.test(x)) fx.noBlk = true; }
      if (/doesn't untap/.test(x)) fx.noUntap = true;
    }
  }
  AFX.set(key, fx); return fx;
}
function attachSBA(){
  let ch = false;
  for (const s of S.bf.slice()){
    if (!s.att) continue;
    if (s.att.pid !== MYPID && !(OPP.get(s.att.pid) && Array.isArray(OPP.get(s.att.pid).bf))) continue;
    const host = boardOf(s.att.pid).find(x => x.id === s.att.id);
    if (host && host.k && !host.fd) continue;
    if (isAuraCard(s)){ log(`${cname(s)} went to the graveyard — what it enchanted is gone`); moveCard(s.id, 'gy', {quiet:true}); }
    else { delete s.att; log(`${cname(s)} is no longer attached`); }
    ch = true;
  }
  return ch;
}
function attachBadge(c, pid){
  if (c.att){ const h = boardOf(c.att.pid).find(x => x.id === c.att.id); return h ? `→ ${(c.att.pid === pid ? '' : nameOf(c.att.pid) + "'s ")}${info(h.k)?.n || ''}` : ''; }
  const fx = attachFx(c, pid); return fx.names.length ? '⚙ ' + fx.names.join(', ') : '';
}
const enchantDesc = txt => { const m = String(txt || '').match(/(?:^|\n)enchant ([a-z ,']+?)(?:\n|$)/i); return m ? m[1].trim().toLowerCase().replace(/,\s*(?:or\s+)?/g, ' or ') : null; };
const doesntUntap = c => /~ doesn't untap during (?:your|its controller's) untap step/i.test(tname(textOf(c), cname(c))) || attachFx(c, MYPID).noUntap;

/* ---------- Play from exile ---------- */
function grantPlay(ids, o){
  ids.forEach(id => { const c = S.ex.find(x => x.id === id); if (c) c.mayPlay = {t:turnStr(), next:!!o.next, cast:!!o.cast, src:o.src, u0:S.untapN, free:!!o.free}; });
  log(`${o.src}: may ${o.cast ? 'cast' : 'play'} ${ids.length === 1 ? 'that card' : 'those cards'} ${o.next ? 'until the end of their next turn' : 'this turn'}`); commit();
}
function exWindowOk(c){
  const mp = c && c.mayPlay; if (!mp) return false;
  if (mp.adv) return true;
  if (mp.t === turnStr()) return true; if (!mp.next) return false;
  if (S.untapN === mp.u0) return true;
  if (mp.u1 == null) mp.u1 = S.untapN;
  const [n, pid] = currentTurn(); return pid === MYPID && S.untapN === mp.u1 && n === S.untapN;
}
const exPlayable = () => (S ? S.ex.filter(exWindowOk) : []);
function exButtons(c){
  const fb = r7ExButtons(c); if (fb) return fb;
  if (!exWindowOk(c)) return '';
  if (isLand(c.k)) return c.mayPlay.cast ? '' : `<button type="button" data-act="exPlay" data-id="${c.id}">Play land</button>`;
  const chk = c.mayPlay.free ? {ok:true} : castCheck(c, 'ex');
  return `<button type="button" data-act="exCast" data-id="${c.id}" ${chk.ok ? '' : `disabled title="${esc(chk.why)}"`}>Cast${chk.ok ? '' : ' — ' + esc(short(chk.why, 40))}</button>`;
}
function exChip(){ const n = exPlayable().length; return n ? `<button class="btn small glow" data-act="viewZone" data-z="ex" type="button">▶ ${n} playable from exile</button>` : ''; }

/* ---------- Copies ---------- */
const copySpec = t => { const m = String(t || '').match(/\bcopy target (instant or sorcery |instant |sorcery |activated or triggered |activated |triggered )?(spell|ability)/i); return m ? {what:(m[1] || '').trim().toLowerCase(), kind:m[2].toLowerCase()} : null; };
function copyLegal(it, cs){
  if (cs.kind === 'spell'){ if (it.kind !== 'spell') return {ok:false, why:'not a spell'}; if (cs.what && !descOk(it.k, cs.what.replace(/ or /, ' or '))) return {ok:false, why:`not an ${cs.what}`}; return {ok:true}; }
  if (it.kind === 'spell') return {ok:false, why:'not an ability'};
  if (cs.what === 'activated' && it.kind !== 'ability') return {ok:false, why:'not an activated ability'};
  if (cs.what === 'triggered' && it.kind !== 'trigger') return {ok:false, why:'not a triggered ability'};
  return {ok:true};
}
async function copyTargetItem(ctx){
  const orig = ctx.it && ctx.it.tgt ? stackAll().find(x => x.sid === ctx.it.tgt) : null;
  if (!orig){ log(`${ctx.name}: nothing to copy (it left the stack)`); return; }
  const cp = {sid:rid(6), o:nextO(), kind:orig.kind === 'spell' ? 'spell' : 'ability', k:orig.k, nm:`${orig.nm} (copy)`, txt:orig.txt, x:orig.x || 0, copy:true, srcId:null};
  if (orig.pid === MYPID && Array.isArray(orig.modes) && orig.modes.length && parseModes(orig.txt)) cp.modes = orig.modes;   // an empty mode list means "not modal" (Twinflame)
  else if (parseModes(orig.txt)){ const md = parseModes(orig.txt); const idx = await askModes(md, `${orig.nm} (copy)`); cp.modes = idx || []; }
  const ttxt = cp.modes && cp.modes.length ? modeText(parseModes(orig.txt), cp.modes) : orig.txt;
  if (targetSpecs(ttxt).length){ const t = await chooseTargets(ttxt, {pid:MYPID, col:info(orig.k)?.c, types:info(orig.k)?.t, id:null}, `${orig.nm} (copy): new targets`); if (t && t.flat().length){ cp.tgts = t; cp.tgtNm = tgtLabel(t); } else { const ot = orig.tgts || (orig.it && orig.it.tgts); if (ot){ cp.tgts = ot; cp.tgtNm = orig.tgtNm || tgtLabel(ot); } } }   // no new targets → the copy keeps the original's
  S.stk.push(cp); S.pass = 's:' + cp.sid; log(`copied ${orig.nm}${cp.tgtNm ? ' → ' + cp.tgtNm : ''}`); commit();
}
async function cloneChoice(c, a){
  const t = tname(a.o, a.n); const m = t.match(/you may have ~ enter(?: the battlefield)? as a copy of (?:any|an?) (.+?) on the battlefield(?:, except (.+?))?(?:\.|$)/im); if (!m) return;
  const desc = m[1].toLowerCase(); const opts = [];
  for (const b of boardsAll()) b.bf.forEach(x => { if (x.k && !x.fd && x.id !== c.id && descOk(x.k, desc, {tok:x.tok})) opts.push({label:`${info(x.k)?.n} (${b.pid === MYPID ? 'yours' : nameOf(b.pid) + "'s"})`, value:x.k}); });
  if (!opts.length){ log(`${a.n}: nothing to copy`); return; }
  const v = await askChoice({title:`${a.n}: enter as a copy of…`, options:[...opts, {label:'Don’t copy anything', value:''}]});
  if (!v) return;
  c.origK = c.k; c.k = v; log(`${a.n} enters as a copy of ${info(v)?.n}`);
  if (m[2]){ if (/it has haste/i.test(m[2])) c.ekw = [...(c.ekw || []), 'haste']; if (!/^it has haste$/i.test(m[2].trim())) handWarn(`Copy exception: except ${m[2]}`, {name:a.n}); }
}

/* ---------- Costs: affinity, delve, convoke ---------- */
function affinityRed(c){
  const m = tname(info(c.k)?.o, info(c.k)?.n).match(/(?:^|\n)affinity for ([a-z ]+?)(?:\n|$)/i); if (!m) return 0;
  return countOf(`${m[1]} you control`, {});
}
function extraKinds(c){ const t = tname(info(c.k)?.o, info(c.k)?.n); return {delve:/(?:^|\n|, )delve(?:\n|,|$)/i.test(t), convoke:/(?:^|\n|, )convoke(?:\n|,|$)/i.test(t)}; }
function extraCanPay(c, sc){
  const xk = extraKinds(c); if (!xk.delve && !xk.convoke) return false;
  const pot = (xk.delve ? S.gy.filter(g => g.id !== c.id).length : 0) + (xk.convoke ? S.bf.filter(b => isCreatureCard(b) && !b.tap && !b.fd).length : 0);
  const cost = {...sc.cost, gen:Math.max(0, sc.cost.gen - pot)}; return !payPlan(cost, S.pool).err;
}
async function extraPayments(c, sc){
  const xk = extraKinds(c); if (!xk.delve && !xk.convoke) return null;
  const gen = sc.cost.gen; if (!gen) return null;
  let gyIds = [], crIds = [];
  if (xk.delve){
    const cards = S.gy.filter(g => g.id !== c.id);
    if (cards.length){ const r = await pickCards({title:`Delve: exile cards from your graveyard`, hint:`Each card exiled pays {1}. Generic cost: {${gen}}.`, cards, min:0, max:Math.min(gen, cards.length), noneLabel:'Exile none'}); if (r == null) return false; gyIds = r; }
  }
  const left = gen - gyIds.length;
  if (xk.convoke && left > 0){
    const cards = S.bf.filter(b => isCreatureCard(b) && !b.tap && !b.fd);
    if (cards.length){ const r = await pickCards({title:`Convoke: tap creatures to help pay`, hint:`Each creature tapped pays {1}. Generic left: {${left}}.`, cards, min:0, max:Math.min(left, cards.length), noneLabel:'Tap none'}); if (r == null) return false; crIds = r; }
  }
  sc.cost.gen -= gyIds.length + crIds.length;
  if (gyIds.length) sc.notes.push(`delve −${gyIds.length}`); if (crIds.length) sc.notes.push(`convoke −${crIds.length}`);
  return {apply(){ gyIds.forEach(id => moveCard(id, 'ex', {quiet:true})); crIds.forEach(id => { const b = S.bf.find(x => x.id === id); if (b) b.tap = true; }); if (gyIds.length) log(`delved ${gyIds.length} card${gyIds.length === 1 ? '' : 's'}`); if (crIds.length) log(`convoked with ${crIds.length} creature${crIds.length === 1 ? '' : 's'}`); }};
}

Object.assign(ACT, {
  exCast(el){ const [z,,c] = find(+el.dataset.id); if (z !== 'ex' || !c || !exWindowOk(c)) return; const free = c.mayPlay && c.mayPlay.free; if (!free){ const chk = castCheck(c, 'ex'); if (!chk.ok){ toast(chk.why); return; } } closeModal(); beginCast(c, 'ex', free ? {free:true} : {}); },
  exPlay(el){ const [z,,c] = find(+el.dataset.id); if (z !== 'ex' || !c || !exWindowOk(c)) return; closeModal(); playLand(c); },
});
